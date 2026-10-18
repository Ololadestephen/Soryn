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
import { moveSchema } from "../../domain/combat/contracts";
import { reconcileParticipation } from "../participation";
import { characterIdSchema } from "../../domain/characters/definitions";
import {
  tokenKey,
  tokenStoryActor,
  type OfficialAuthority,
  type TokenIdentity,
} from "../../domain/identity";
import type { AuthService } from "../auth/service";
import type { PrivyVerifier } from "../auth/privy";
import { matchSession, privyFor, walletSecret } from "../auth/request";
import { identityRuntime } from "../auth/runtime";
import { BattleStore } from "../combat/persistence";
import { BattleService } from "../combat/service";
import { ServiceError } from "../errors";
import {
  body,
  failure,
  guestCookieOptions,
  requireJsonOrigin,
  response,
} from "../httpShared";
import type { Store } from "../persistence";
import { StoryService, type StoryOfficialBinding } from "./service";

const modeField = z.enum(["guest", "official"]).optional();
const inputSchema = z.discriminatedUnion("operation", [
  z.strictObject({
    operation: z.literal("choose"),
    fighter: characterIdSchema,
    mode: modeField,
  }),
  z.strictObject({
    operation: z.literal("route"),
    route: z.enum(["grove", "foundry"]),
    mode: modeField,
  }),
  z.strictObject({ operation: z.literal("begin"), mode: modeField }),
  z.strictObject({ operation: z.literal("dialogue"), mode: modeField }),
  z.strictObject({
    operation: z.literal("vow"),
    choice: z.enum(["restore", "preserve"]),
    mode: modeField,
  }),
  z.strictObject({
    operation: z.literal("interact"),
    action: z.string().min(1).max(30),
    mode: modeField,
  }),
  z.strictObject({ operation: z.literal("side"), mode: modeField }),
  z.strictObject({ operation: z.literal("leave-side"), mode: modeField }),
  z.strictObject({
    operation: z.literal("resolve"),
    battleId: z.uuid(),
    mode: modeField,
  }),
  z.strictObject({ operation: z.literal("replay"), mode: modeField }),
  z.strictObject({
    operation: z.literal("cancel"),
    mode: z.literal("official"),
  }),
  z.strictObject({
    operation: z.literal("move"),
    mode: z.literal("official"),
    id: z.uuid(),
    round: z.number().int().min(1).max(20),
    move: moveSchema,
  }),
]);

function guestActor(request: NextRequest) {
  const parsed = z.uuid().safeParse(request.cookies.get("chog_guest")?.value);
  return parsed.success ? parsed.data : null;
}

export function createStoryHandlers(
  store: Store,
  origin: string,
  auth?: AuthService,
  verifier?: PrivyVerifier,
  holdings?: import("../access/reader").HoldingReader,
) {
  const story = new StoryService(
    store,
    new BattleService(new BattleStore(store)),
  );
  const access = new AccessBoundary(store, origin, auth, verifier, holdings);
  function enrich(actor: string, state: unknown) {
    return {
      ...(state as Record<string, unknown>),
      rewards: story.rewards(actor),
      runs: story.runs(actor),
    };
  }
  async function official(
    request: NextRequest,
    write: boolean,
  ): Promise<
    | {
        actor: string;
        accountActor: string;
        token: string;
        binding: StoryOfficialBinding;
        authority: OfficialAuthority;
      }
    | { interrupted: unknown }
  > {
    if (!auth || !verifier)
      throw new ServiceError(503, "Official story is not configured.");
    const secret = walletSecret(request);
    const session = matchSession(
      auth,
      secret,
      await privyFor(request, verifier),
    );
    store.rateLimit(
      write ? session.actor : `read:story:${session.actor}`,
      Date.now(),
      write ? 60 : 90,
    );
    try {
      const authority = (await auth.authorize(secret)).authority;
      const binding: StoryOfficialBinding = {
        identity: authority.identity,
        owner: authority.ownership.owner,
        generation: authority.generation,
      };
      reconcileParticipation(store, authority, Date.now());
      const actor = story.reconcileOfficialProgressAndGetActor(
        authority,
        Date.now(),
      );
      return {
        actor,
        accountActor: session.actor,
        token: tokenKey(authority.identity),
        binding,
        authority,
      };
    } catch (error) {
      if (error instanceof ServiceError && error.status === 503)
        return {
          interrupted: {
            ...story.unavailable(
              tokenStoryActor(session.identity, session.wallet),
              Date.now(),
            ),
            authorized: false,
            battle: null,
            history: [],
          },
        };
      if (!(error instanceof ServiceError) || error.status !== 403) throw error;
      return {
        interrupted: await interruptOnRevoked(session.identity, session.wallet),
      };
    }
  }
  /**
   * After a revoked grant, verify the row's token with fresh RPC evidence
   * (no session needed) so a confirmed transfer still interrupts the open
   * encounter instead of hanging it. Anything else rethrows: an outage
   * surfaces as verification-unavailable, never as a transfer.
   */
  async function interruptOnRevoked(identity: TokenIdentity, wallet: string) {
    if (!auth) throw new ServiceError(503, "Official story is not configured.");
    const actor = tokenStoryActor(identity, wallet);
    const observed = await auth.ownership.fresh(identity);
    auth.ownership.assertFresh(observed);
    const presented: StoryOfficialBinding = {
      identity,
      owner: observed.owner,
      generation: observed.generation,
    };
    if (observed.owner === wallet) {
      const checked = story.bindOrCheckOfficialOwnership(actor, presented);
      if (checked.status === "ok")
        throw new ServiceError(
          403,
          "Current-owner grant unavailable or revoked. Sign in again.",
        );
    }
    return {
      ...story.interrupt(
        actor,
        observed.owner === wallet
          ? "generation-invalidated"
          : "ownership-changed",
        Date.now(),
      ),
      authorized: false,
      battle: null,
      history: [],
    };
  }

  async function get(request: NextRequest): Promise<NextResponse> {
    try {
      const mode = parseInput(
        z.enum(["guest", "official"]),
        request.nextUrl.searchParams.get("mode") ?? "guest",
      );
      if (mode === "official") {
        const resolved = await official(request, false);
        if ("interrupted" in resolved) return response(resolved.interrupted);
        const battle = story.officialBattle(
          resolved.actor,
          resolved.authority,
          Date.now(),
          request.nextUrl.searchParams.get("id") ?? undefined,
        );
        return response({
          ...enrich(resolved.actor, story.state(resolved.actor)),
          battle,
          history: [],
          authorized: true,
          tokenId: resolved.authority.identity.tokenId,
        });
      }
      const player = await access.player(request);
      const existing = player?.actor ?? guestActor(request);
      if (existing && !player) protectWalletActor(store, existing);
      const id = existing ?? randomUUID();
      store.rateLimit(
        existing ? `read:${id}` : "read:anonymous-guest",
        Date.now(),
        existing ? 90 : 120,
      );
      const reply = response(enrich(id, story.state(id)));
      if (!existing && !walletPlay(request))
        reply.cookies.set(
          "chog_guest",
          id,
          guestCookieOptions(request, origin),
        );
      return reply;
    } catch (error) {
      return failure(error);
    }
  }
  async function post(request: NextRequest): Promise<NextResponse> {
    try {
      requireJsonOrigin(request, origin);
      const input = parseInput(inputSchema, await body(request));
      if (input.mode === "official") {
        const resolved = await official(request, true);
        if ("interrupted" in resolved) return response(resolved.interrupted);
        if (input.operation === "move") {
          const battle = story.move(
            resolved.actor,
            resolved.authority,
            input.id,
            input.round,
            input.move,
            Date.now(),
          );
          return response({
            ...story.state(resolved.actor),
            battle,
            history: [],
            authorized: true,
            tokenId: resolved.authority.identity.tokenId,
          });
        }
        if (
          input.operation !== "resolve" &&
          input.operation !== "cancel" &&
          input.operation !== "dialogue" &&
          input.operation !== "leave-side" &&
          !(input.operation === "begin" && story.state(resolved.actor).battleId)
        )
          requireAdmissionsOpen();
        let extra: unknown = null;
        if (input.operation === "dialogue")
          extra = story.dialogue(resolved.actor);
        if (input.operation === "vow")
          extra = story.vow(resolved.actor, input.choice);
        if (input.operation === "interact")
          extra = story.interact(resolved.actor, input.action, Date.now());
        if (input.operation === "side") extra = story.side(resolved.actor);
        if (input.operation === "leave-side")
          extra = story.leaveSide(resolved.actor);
        if (extra)
          return response({
            ...enrich(resolved.actor, extra),
            authorized: true,
            tokenId: resolved.authority.identity.tokenId,
          });
        const payload =
          input.operation === "choose"
            ? story.choose(resolved.actor, input.fighter, undefined, true)
            : input.operation === "route"
              ? story.route(resolved.actor, input.route)
              : input.operation === "begin"
                ? story.begin(
                    resolved.actor,
                    Date.now(),
                    {
                      token: resolved.token,
                      binding: resolved.binding,
                      authority: resolved.authority,
                    },
                    undefined,
                    access.entitlements.equipped(resolved.accountActor),
                  )
                : input.operation === "resolve"
                  ? story.resolve(
                      resolved.actor,
                      input.battleId,
                      resolved.token,
                      Date.now(),
                    )
                  : input.operation === "cancel"
                    ? story.interrupt(resolved.actor, "cancelled", Date.now())
                    : story.replay(resolved.actor, resolved.token);
        return response({
          ...enrich(resolved.actor, payload),
          authorized: true,
          tokenId: resolved.authority.identity.tokenId,
        });
      }
      const player = await access.player(request);
      const existing = player?.actor ?? guestActor(request);
      if (!existing)
        throw new ServiceError(401, "Open wallet access to continue Story.");
      if (!player) protectWalletActor(store, existing);
      store.rateLimit(existing);
      let admission;
      const active = story.state(existing);
      const canFinish =
        input.operation === "resolve" && active.battleId === input.battleId;
      const canResume = input.operation === "begin" && !!active.battleId;
      const insideInteraction =
        input.operation === "interact" &&
        story.interactionOpen(existing, Date.now());
      if (
        !canFinish &&
        !canResume &&
        !insideInteraction &&
        input.operation !== "dialogue" &&
        input.operation !== "leave-side"
      )
        admission = await access.admit(player);
      if (
        input.operation === "dialogue" &&
        !player &&
        !active.journey &&
        active.step === "meet"
      )
        throw new ServiceError(
          403,
          "Connect wallet to unlock Story. Practice remains available.",
        );
      const payload =
        input.operation === "choose"
          ? story.choose(existing, input.fighter, admission)
          : input.operation === "route"
            ? story.route(existing, input.route, admission)
            : input.operation === "vow"
              ? story.vow(existing, input.choice, admission)
              : input.operation === "interact"
                ? story.interact(
                    existing,
                    input.action,
                    Date.now(),
                    admission ?? story.interactionAccess(existing, Date.now()),
                  )
                : input.operation === "leave-side"
                  ? story.leaveSide(existing)
                  : input.operation === "side"
                    ? story.side(existing, admission)
                    : input.operation === "dialogue"
                      ? story.dialogue(existing)
                      : input.operation === "begin"
                        ? story.begin(
                            existing,
                            Date.now(),
                            null,
                            admission,
                            player
                              ? access.entitlements.equipped(player.actor)
                              : false,
                          )
                        : input.operation === "resolve"
                          ? story.resolve(existing, input.battleId)
                          : story.replay(existing);
      return response(enrich(existing, payload));
    } catch (error) {
      return failure(error);
    }
  }
  return { get, post };
}

let handlers: ReturnType<typeof createStoryHandlers> | undefined;
export function getStory(request: NextRequest) {
  return configured().get(request);
}
export function postStory(request: NextRequest) {
  return configured().post(request);
}
function configured() {
  if (!handlers) {
    const { store, origin, auth, verifier } = identityRuntime();
    handlers = createStoryHandlers(store, origin, auth, verifier);
  }
  return handlers;
}
