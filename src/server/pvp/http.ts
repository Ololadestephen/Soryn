import { randomUUID } from "node:crypto";
import { NextRequest, type NextResponse } from "next/server";
import { z } from "zod";
import {
  character,
  characterIdSchema,
} from "../../domain/characters/definitions";
import type { OfficialAuthority } from "../../domain/identity";
import { seatIds, type PvpRoom, type SeatId } from "../../domain/pvp/types";
import { arenaChoiceSchema } from "../../domain/combat/arenas";
import { battleModeSchema, moveSchema } from "../../domain/combat/contracts";
import { PVP_TIMERS, timersFromEnv } from "../../domain/pvp/timers";
import type { SeatActor } from "../../domain/pvp/actions";
import { AuthService } from "../auth/service";
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
import { PvpStore } from "./persistence";
import { PvpService } from "./service";

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
    invite: inviteSchema,
    mode: modeField,
  }),
  z.strictObject({
    operation: z.literal("move"),
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
]);

function grantFrom(authority: OfficialAuthority) {
  return {
    identity: authority.identity,
    generation: authority.generation,
    owner: authority.ownership.owner,
  };
}

async function confirmedHolders(
  auth: AuthService,
  room: PvpRoom,
): Promise<SeatId[]> {
  const bad: SeatId[] = [];
  for (const id of seatIds) {
    const sitting = room.seats[id];
    if (
      !sitting?.characterId ||
      character(sitting.characterId).access !== "holder"
    )
      continue;
    const grant = sitting.holderGrant;
    if (sitting.mode !== "official" || !grant) {
      bad.push(id);
      continue;
    }
    try {
      const observed = await auth.ownership.fresh(grant.identity);
      auth.ownership.assertFresh(observed);
      if (
        observed.owner !== grant.owner ||
        observed.generation !== grant.generation
      )
        bad.push(id);
    } catch (error) {
      if (
        error instanceof ServiceError &&
        (error.status === 409 || error.status === 503)
      )
        throw error;
      bad.push(id);
    }
  }
  return bad;
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
  if (!actor) return reply;
  reply.cookies.set("chog_guest", actor, guestCookieOptions(request, origin));
  return reply;
}

export function createPvpHandlers(
  store: Store,
  origin: string,
  auth: AuthService,
  verifier: PrivyVerifier,
) {
  const timers = timersFromEnv(process.env);
  const service = new PvpService(
    new PvpStore(store),
    timers,
    undefined,
    (room) => confirmedHolders(auth, room),
  );
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
  ): Promise<SeatActor & { holderGrant: ReturnType<typeof grantFrom> | null }> {
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
      const authority = write ? await auth.authorize(secret) : null;
      return {
        actor: session.actor,
        mode,
        holderGrant: authority ? grantFrom(authority.authority) : null,
      };
    }
    const actor = guestActor(request);
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
    return { actor, mode: "guest", holderGrant: null };
  }
  async function get(request: NextRequest): Promise<NextResponse> {
    try {
      const requested = battleModeSchema.parse(
        request.nextUrl.searchParams.get("mode") ?? "guest",
      );
      let actor: SeatActor & { holderGrant: null };
      if (requested === "guest") {
        const existing = guestActor(request);
        const id = existing ?? randomUUID();
        store.rateLimit(
          existing ? `read:${existing}` : "read:anonymous-guest",
          Date.now(),
          existing ? READS_PER_MINUTE : ANONYMOUS_SESSIONS_PER_MINUTE,
        );
        actor = { actor: id, mode: "guest", holderGrant: null };
      } else {
        const official = await identity(request, "official", false);
        actor = { ...official, holderGrant: null };
      }
      const invite = request.nextUrl.searchParams.get("invite");
      const now = Date.now();
      const payload = invite
        ? service.preview(inviteSchema.parse(invite), actor.actor, now)
        : service.session(actor.actor, now);
      return rememberGuest(
        request,
        response(payload),
        requested === "guest" ? actor.actor : null,
        origin,
      );
    } catch (error) {
      return failure(error);
    }
  }
  async function post(request: NextRequest): Promise<NextResponse> {
    try {
      requireJsonOrigin(request, origin);
      const input = inputSchema.parse(await body(request));
      const mode = input.mode ?? "guest";
      let actor: Awaited<ReturnType<typeof identity>>;
      if (
        mode === "guest" &&
        !guestActor(request) &&
        input.operation === "create"
      ) {
        actor = { actor: randomUUID(), mode: "guest", holderGrant: null };
        store.rateLimit(actor.actor);
      } else actor = await identity(request, mode, true);
      const now = Date.now();
      const payload = await dispatch(service, actor, input, now);
      return rememberGuest(
        request,
        response(payload),
        mode === "guest" ? actor.actor : null,
        origin,
      );
    } catch (error) {
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
  switch (input.operation) {
    case "create":
      return service.create(actor, now);
    case "join":
      return service.join(actor, input.invite, now);
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
