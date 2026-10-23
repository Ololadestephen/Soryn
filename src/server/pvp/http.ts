import {
  AccessBoundary,
  protectWalletActor,
  requireAdmissionsOpen,
} from "../access/boundary";
import { walletPlay } from "../access/auth";
import { parseInput } from "../httpShared";
import { randomUUID } from "node:crypto";
import { NextRequest, type NextResponse } from "next/server";
import { z } from "zod";
import { characterIdSchema } from "../../domain/characters/definitions";
import type { OfficialAuthority } from "../../domain/identity";
import { tokenKey } from "../../domain/identity";
import { seatIds, seatOf, type PvpRoom } from "../../domain/pvp/types";
import { hasOfficialSeats } from "../../domain/pvp/ownership";
import { arenaChoiceSchema } from "../../domain/combat/arenas";
import { battleModeSchema, moveSchema } from "../../domain/combat/contracts";
import { PVP_TIMERS, timersFromEnv } from "../../domain/pvp/timers";
import { presentRoom, previewRoom } from "../../domain/pvp/view";
import type { SeatActor } from "../../domain/pvp/actions";
import type { AuthService } from "../auth/service";
import type { PrivyVerifier } from "../auth/privy";
import { matchSession, privyFor, walletSecret } from "../auth/request";
import { identityRuntime } from "../auth/runtime";
import { ServiceError } from "../errors";
import {
  body,
  failure,
  guestCookieOptions,
  requireJsonOrigin,
  response,
} from "../httpShared";
import type { Store } from "../persistence";
import type { PvpService } from "./service";
import { createOwnedPvpService, checkSeatOwnership } from "./ownedService";
import { requestedSeatMode } from "./seatMode";
import { reconcileParticipation } from "../participation";

/** Presence polls must not invalidate a slow holdings check; gameplay edits must. */
export function admissionState(room: PvpRoom, actor: string): string {
  return JSON.stringify({
    closedAt: room.closedAt,
    arena: room.arenaChoice,
    series: room.series,
    match: room.match?.id,
    roster: room.roster,
    seats: seatIds.map((id) => {
      const seat = room.seats[id];
      return (
        seat && {
          actor: seat.actor,
          mode: seat.mode,
          characterId: seat.characterId,
          ready: seat.actor === actor ? seat.ready : undefined,
          holderGrant: seat.holderGrant,
        }
      );
    }),
  });
}

const READS_PER_MINUTE = 90;
const ANONYMOUS_SESSIONS_PER_MINUTE = 120;
const inviteSchema = z.string().regex(/^[A-Za-z0-9_-]{20,80}$/);
const modeField = battleModeSchema.optional();
const inputSchema = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("create"), mode: modeField }),
  z.strictObject({
    operation: z.literal("join"),
    invite: inviteSchema,
    mode: modeField,
  }),
  z.strictObject({
    operation: z.literal("leave"),
    invite: inviteSchema,
    mode: modeField,
  }),
  z.strictObject({
    operation: z.literal("close"),
    invite: inviteSchema,
    mode: modeField,
  }),
  z.strictObject({
    operation: z.literal("select"),
    invite: inviteSchema,
    characterId: characterIdSchema,
    mode: modeField,
  }),
  z.strictObject({
    operation: z.literal("arena"),
    invite: inviteSchema,
    arena: arenaChoiceSchema,
    mode: modeField,
  }),
  z.strictObject({
    operation: z.literal("ready"),
    invite: inviteSchema,
    ready: z.boolean(),
    mode: modeField,
  }),
  z.strictObject({
    operation: z.literal("assets"),
    matchId: z.uuid().optional(),
    invite: inviteSchema,
    mode: modeField,
  }),
  z.strictObject({
    operation: z.literal("move"),
    matchId: z.uuid().optional(),
    invite: inviteSchema,
    round: z.number().int().min(1).max(20),
    move: moveSchema,
    mode: modeField,
  }),
  z.strictObject({
    operation: z.literal("rematch"),
    invite: inviteSchema,
    mode: modeField,
  }),
  z.strictObject({
    operation: z.literal("setup"),
    invite: inviteSchema,
    mode: modeField,
  }),
  z.strictObject({
    operation: z.literal("continue"),
    matchId: z.uuid().optional(),
    invite: inviteSchema,
    mode: modeField,
  }),
  z.strictObject({
    operation: z.literal("surrender"),
    invite: inviteSchema,
    mode: modeField,
  }),
]);

function grantFrom(authority: OfficialAuthority) {
  return {
    identity: authority.identity,
    generation: authority.generation,
    owner: authority.ownership.owner,
  };
}

/**
 * An official grant the ownership layer refused: the sessions behind it no
 * longer match fresh chain evidence. Reads and writes that fail this way get
 * one unauthenticated verification attempt (fresh RPC evidence, no session)
 * so a confirmed transfer still ends the series instead of hanging it.
 */
class RevokedGrantError extends ServiceError {
  constructor() {
    super(
      403,
      "Current-owner grant unavailable or revoked. Sign in again after any ownership change.",
    );
  }
}

function guestActor(request: NextRequest) {
  const parsed = z.uuid().safeParse(request.cookies.get("chog_guest")?.value);
  return parsed.success ? parsed.data : null;
}

function rememberGuest(
  request: NextRequest,
  reply: NextResponse,
  actor: string | null,
  origin: string,
) {
  if (!actor || walletPlay(request)) return reply;
  reply.cookies.set("chog_guest", actor, guestCookieOptions(request, origin));
  return reply;
}

export function createPvpHandlers(
  store: Store,
  origin: string,
  auth: AuthService,
  verifier: PrivyVerifier,
  holdings?: import("../access/reader").HoldingReader,
) {
  const timers = timersFromEnv(process.env);
  const service = createOwnedPvpService(store, auth, timers);
  const access = new AccessBoundary(store, origin, auth, verifier, holdings);
  async function actorId(request: NextRequest) {
    const player = await access.player(request);
    if (player) return player.actor;
    const id = guestActor(request);
    if (id) protectWalletActor(store, id);
    return id;
  }
  if (
    process.env.VITEST !== "true" &&
    (timers.moveMs !== PVP_TIMERS.moveMs ||
      timers.presentMs !== PVP_TIMERS.presentMs ||
      timers.loadingMs !== PVP_TIMERS.loadingMs)
  ) {
    console.warn(
      "Private battles are using shortened test timers on a loopback origin. Hosted play must unset CHOG_PVP_TIMERS.",
    );
  }
  async function identity(
    request: NextRequest,
    mode: "guest" | "official",
    write: boolean,
  ): Promise<
    SeatActor & {
      holderGrant: ReturnType<typeof grantFrom> | null;
    }
  > {
    if (mode === "official") {
      const secret = walletSecret(request);
      const session = matchSession(
        auth,
        secret,
        await privyFor(request, verifier),
      );
      store.rateLimit(
        write ? session.actor : `read:${session.actor}`,
        Date.now(),
        write ? 60 : READS_PER_MINUTE,
      );
      // Every official action re-authorizes against fresh chain evidence.
      // The old retained-seat window is gone: a confirmed ownership change
      // ends the series as no contest instead of letting the old owner play.
      let authority: OfficialAuthority;
      try {
        authority = (await auth.authorize(secret)).authority;
      } catch (error) {
        if (error instanceof ServiceError && error.status === 403)
          throw new RevokedGrantError();
        throw error;
      }
      reconcileParticipation(store, authority, Date.now());
      return {
        actor: session.actor,
        mode,
        holderGrant: grantFrom(authority),
        cosmetic: access.entitlements.equipped(session.actor),
      };
    }
    const actor = await actorId(request);
    if (!actor)
      throw new ServiceError(
        401,
        "Open Challenge a friend to take a guest seat.",
      );
    store.rateLimit(
      write ? actor : `read:${actor}`,
      Date.now(),
      write ? 60 : READS_PER_MINUTE,
    );
    return {
      actor,
      mode: "guest",
      holderGrant: null,
      ...(walletPlay(request)
        ? {
            access: access.entitlements.stored(actor) ?? undefined,
            cosmetic: access.entitlements.equipped(actor),
          }
        : {}),
    };
  }
  function walletListed(request: NextRequest) {
    const secret = request.cookies.get("chog_wallet")?.value;
    return !!secret && /^[0-9a-f]{64}$/.test(secret);
  }
  /** Actor of a wallet session that lost official authority, if provable. */
  async function formerActor(request: NextRequest): Promise<string | null> {
    try {
      return matchSession(
        auth,
        walletSecret(request),
        await privyFor(request, verifier),
      ).actor;
    } catch {
      return null;
    }
  }
  /**
   * A former owner keeps their own completed history on session reads after
   * revocation: no live room, no moves, no current-token authority.
   */
  async function formerOwnerHistory(request: NextRequest): Promise<{
    activeInvite: null;
    activePhase: null;
    history: unknown;
  } | null> {
    const actorId = await formerActor(request);
    if (!actorId) return null;
    return {
      activeInvite: null,
      activePhase: null,
      history: service.historyFor(actorId),
    };
  }
  /**
   * Present a voided room to the acting player: their own view when seated,
   * the lobby preview otherwise. The voided battle is already discarded, so
   * no hidden move can leak through either shape.
   */
  function voidedView(room: PvpRoom, actor: string, now: number) {
    if (seatOf(room, actor)) return presentRoom(room, actor, now);
    return previewRoom(room, now);
  }
  /**
   * After a revoked grant, run one unauthenticated verification over the
   * room's stamped seats. Returns the voided room on a confirmed change, or
   * null when nothing disagrees (the original error then stands).
   */
  async function voidOnRevoked(
    invite: string,
    now: number,
  ): Promise<PvpRoom | null> {
    try {
      const room = service.records.byInvite(invite);
      if (
        !hasOfficialSeats(room) ||
        room.closedAt !== null ||
        room.series?.phase === "complete"
      )
        return null;
      const changed = await service.verifyOtherSeats(room, null);
      if (!changed.length) return null;
      return service.voidOnTransfer(invite, now, changed, room.revision);
    } catch {
      return null;
    }
  }
  /**
   * Status reads. A poll is not side-effect free: it commits deadlines that
   * already passed (forfeits, resolved rounds, the next holder battle) before
   * shaping the response. Clients should treat every payload revision as
   * authoritative.
   */
  async function get(request: NextRequest): Promise<NextResponse> {
    let openingRevision: number | undefined;
    try {
      const modeParam = request.nextUrl.searchParams.get("mode");
      const explicit =
        modeParam === null
          ? undefined
          : parseInput(battleModeSchema, modeParam);
      const inviteParam = request.nextUrl.searchParams.get("invite");
      const invite =
        inviteParam === null ? null : parseInput(inviteSchema, inviteParam);
      if (invite) openingRevision = service.records.byInvite(invite).revision;
      const guestId = await actorId(request);
      const guestStored =
        invite && guestId ? service.seatMode(guestId, invite) : null;
      const requested = requestedSeatMode(
        guestStored,
        explicit ?? (walletPlay(request) ? "guest" : undefined),
        walletListed(request),
      );
      let actor: SeatActor & {
        holderGrant: ReturnType<typeof grantFrom> | null;
      };
      if (requested === "guest") {
        const existing = await actorId(request);
        const id = existing ?? randomUUID();
        store.rateLimit(
          existing ? `read:${existing}` : "read:anonymous-guest",
          Date.now(),
          existing ? READS_PER_MINUTE : ANONYMOUS_SESSIONS_PER_MINUTE,
        );
        actor = {
          actor: id,
          mode: "guest",
          holderGrant: null,
        };
      } else {
        actor = await identity(request, "official", false);
      }
      const now = Date.now();
      if (!invite && request.nextUrl.searchParams.get("history") === "1")
        return response({
          activeInvite: null,
          activePhase: null,
          history: service.historyFor(actor.actor),
        });
      const presented = actor.mode === "official" ? actor.holderGrant : null;
      const payload = invite
        ? await service.pollRoomChecked(actor.actor, invite, now, presented)
        : await service.pollSessionChecked(actor.actor, now, presented);
      return rememberGuest(
        request,
        response(payload),
        requested === "guest" ? actor.actor : null,
        origin,
      );
    } catch (error) {
      if (!(error instanceof RevokedGrantError)) {
        if (error instanceof ServiceError && error.status === 503) {
          const invite = request.nextUrl.searchParams.get("invite");
          const actor = await formerActor(request);
          if (invite && actor && service.seatMode(actor, invite)) {
            try {
              return response(
                voidedView(
                  service.noteStallOrTerminate(
                    invite,
                    Date.now(),
                    openingRevision,
                  ),
                  actor,
                  Date.now(),
                ),
              );
            } catch (unavailable) {
              return failure(unavailable);
            }
          }
        }
        return failure(error);
      }
      const inviteParam = request.nextUrl.searchParams.get("invite");
      if (inviteParam) {
        const voided = await voidOnRevoked(
          parseInput(inviteSchema, inviteParam),
          Date.now(),
        );
        if (voided) {
          const actorId = await formerActor(request);
          return response(voidedView(voided, actorId ?? "", Date.now()));
        }
        return failure(error);
      }
      const former = await formerOwnerHistory(request);
      if (former) return response(former);
      return failure(error);
    }
  }
  async function refreshReadyRoomAdmission(invite: string, actor: string) {
    const before = service.records.byInvite(invite);
    if (before.match) return;
    const grants = await access.refreshRoom(before);
    store.transaction(() => {
      const current = service.records.byInvite(invite);
      if (admissionState(current, actor) !== admissionState(before, actor))
        throw new ServiceError(
          409,
          "The room changed during eligibility verification. Try again.",
        );
      for (const sitting of Object.values(current.seats))
        if (sitting) {
          if (grants.has(sitting.actor))
            sitting.access = grants.get(sitting.actor)!;
          sitting.cosmetic = access.entitlements.equipped(sitting.actor);
        }
      current.revision++;
      service.records.save(current);
    });
  }
  async function verifyHistoricalReopen(opening: PvpRoom) {
    if (
      seatIds.some(
        (id) =>
          opening.seats[id]?.mode === "official" &&
          !opening.seats[id]?.holderGrant,
      )
    )
      throw new ServiceError(
        503,
        "This historical room has no verifiable ownership binding. Open a fresh invitation.",
      );
    if ((await checkSeatOwnership(auth, opening)).length)
      throw new ServiceError(
        403,
        "Ownership changed since this series. Open a fresh invitation.",
      );
  }
  async function post(request: NextRequest): Promise<NextResponse> {
    let invite: string | null = null;
    let openingRevision: number | undefined;
    try {
      requireJsonOrigin(request, origin);
      const input = parseInput(inputSchema, await body(request));
      const guestId = await actorId(request);
      invite = "invite" in input ? input.invite : null;
      if (invite) openingRevision = service.records.byInvite(invite).revision;
      const guestStored =
        invite && guestId ? service.seatMode(guestId, invite) : null;
      const requested = requestedSeatMode(
        guestStored,
        input.mode ?? (walletPlay(request) ? "guest" : undefined),
        walletListed(request),
      );
      const actor: SeatActor & {
        holderGrant: ReturnType<typeof grantFrom> | null;
      } =
        requested === "guest" && !guestId && input.operation === "create"
          ? { actor: randomUUID(), mode: "guest" as const, holderGrant: null }
          : await identity(request, requested, true);
      if (requested === "guest" && !guestId) store.rateLimit(actor.actor);
      const mode = actor.mode;
      const now = Date.now();
      const freshEntry =
        input.operation === "create" ||
        input.operation === "join" ||
        input.operation === "select";
      try {
        if (freshEntry) {
          requireAdmissionsOpen();
          if (mode === "guest")
            actor.access = await access.admit(await access.player(request));
        }
        if (invite && input.operation === "ready" && input.ready)
          await refreshReadyRoomAdmission(invite, actor.actor);
      } catch (admissionError) {
        return failure(admissionError);
      }
      let payload: unknown;
      if (invite) {
        const opening = service.records.byInvite(invite);
        const seat = seatOf(opening, actor.actor);
        const reopening =
          (input.operation === "setup" || input.operation === "rematch") &&
          hasOfficialSeats(opening);
        if (reopening) await verifyHistoricalReopen(opening);
        const voided = await service.guardOfficialRoom(
          invite,
          {
            seat,
            grant: actor.mode === "official" ? actor.holderGrant : null,
          },
          now,
        );
        if (
          !voided &&
          reopening &&
          service.records.byInvite(invite).revision !== opening.revision
        )
          throw new ServiceError(
            409,
            "The room changed during ownership verification. Retry.",
            "revision-conflict",
          );
        payload = voided
          ? voidedView(voided, actor.actor, now)
          : await dispatch(service, actor, input, now);
      } else {
        payload = await dispatch(service, actor, input, now);
      }
      return rememberGuest(
        request,
        response(payload),
        mode === "guest" ? actor.actor : null,
        origin,
      );
    } catch (error) {
      if (error instanceof ServiceError && error.status === 503 && invite) {
        const actor = await formerActor(request);
        if (actor && service.seatMode(actor, invite)) {
          try {
            return response(
              voidedView(
                service.noteStallOrTerminate(
                  invite,
                  Date.now(),
                  openingRevision,
                ),
                actor,
                Date.now(),
              ),
            );
          } catch (unavailable) {
            return failure(unavailable);
          }
        }
      }
      if (error instanceof RevokedGrantError && invite) {
        const voided = await voidOnRevoked(invite, Date.now());
        if (voided) {
          const actorId = await formerActor(request);
          return response(voidedView(voided, actorId ?? "", Date.now()));
        }
      }
      return failure(error);
    }
  }
  return { get, post };
}

function dispatch(
  service: PvpService,
  actor: SeatActor & { holderGrant: ReturnType<typeof grantFrom> | null },
  input: z.infer<typeof inputSchema>,
  now: number,
) {
  if ("invite" in input && actor.mode === "official") {
    const room = service.records.byInvite(input.invite);
    const seat = seatOf(room, actor.actor);
    const bound = seat ? room.seats[seat]?.holderGrant : null;
    const fresh = actor.holderGrant;
    if (
      bound &&
      (!fresh ||
        tokenKey(bound.identity) !== tokenKey(fresh.identity) ||
        bound.generation !== fresh.generation ||
        bound.owner !== fresh.owner)
    )
      throw new ServiceError(
        403,
        "This historical seat belongs to an earlier token grant. Open a fresh encounter.",
      );
  }
  if (
    "matchId" in input &&
    input.matchId &&
    service.records.byInvite(input.invite).match?.id !== input.matchId
  )
    throw new ServiceError(
      409,
      "That action belongs to an earlier battle. Refresh the room.",
      "stale-battle",
    );
  switch (input.operation) {
    case "create":
      return service.create(actor, now, actor.holderGrant);
    case "join":
      return service.join(actor, input.invite, now, actor.holderGrant);
    case "leave":
      return service.leave(actor.actor, input.invite, now);
    case "close":
      return service.close(actor.actor, input.invite, now);
    case "select":
      return service.select(
        actor.actor,
        input.invite,
        input.characterId,
        now,
        actor.holderGrant,
      );
    case "arena":
      return service.arena(actor.actor, input.invite, input.arena, now);
    case "ready":
      return service.confirmReady(
        actor.actor,
        input.invite,
        input.ready,
        now,
        actor.holderGrant,
      );
    case "assets":
      return service.assets(actor.actor, input.invite, now);
    case "move":
      return service.move(
        actor.actor,
        input.invite,
        input.round,
        input.move,
        now,
      );
    case "rematch":
      return service.rematch(actor.actor, input.invite, now);
    case "setup":
      return service.setup(actor.actor, input.invite, now);
    case "continue":
      return service.continueSeries(actor.actor, input.invite, now);
    case "surrender":
      return service.surrender(actor.actor, input.invite, now);
    default: {
      const unreachable: never = input;
      return unreachable;
    }
  }
}

let handlers: ReturnType<typeof createPvpHandlers> | undefined;
export function getPvp(request: NextRequest) {
  return configured().get(request);
}
export function postPvp(request: NextRequest) {
  return configured().post(request);
}
function configured() {
  if (!handlers) {
    const { store, origin, auth, verifier } = identityRuntime();
    handlers = createPvpHandlers(store, origin, auth, verifier);
  }
  return handlers;
}
