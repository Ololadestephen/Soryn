import { walletPlay } from "../access/auth";
import { AccessBoundary, protectWalletActor } from "../access/boundary";
import type { AccessGrant } from "../../domain/access/policy";
import { parseInput } from "../httpShared";
import { NextRequest, type NextResponse } from "next/server";
import { z } from "zod";
import { characterIdSchema } from "../../domain/characters/definitions";
import {
  moveSchema,
  difficultySchema,
  battleModeSchema as modeSchema,
} from "../../domain/combat/contracts";
import { Store } from "../persistence";
import { AuthService } from "../auth/service";
import { type PrivyVerifier } from "../auth/privy";
import { identityRuntime } from "../auth/runtime";
import { matchSession, privyFor, walletSecret } from "../auth/request";
import {
  body,
  failure,
  response,
  requireJsonOrigin,
  guestCookieOptions,
} from "../httpShared";
import { ServiceError } from "../errors";
import { BattleStore } from "./persistence";
import { BattleService } from "./service";
import { battleReader, readBattleView } from "./reader";
import { arenaChoiceSchema } from "../../domain/combat/arenas";

const GUEST_COOKIE_SECONDS = 7 * 24 * 60 * 60;
const inputSchema = z.discriminatedUnion("operation", [
  z.strictObject({
    operation: z.literal("start"),
    mode: modeSchema,
    id: z.uuid(),
    characterId: characterIdSchema,
    opponent: characterIdSchema,
    difficulty: difficultySchema.optional(),
    arena: arenaChoiceSchema.optional(),
  }),
  z.strictObject({
    operation: z.literal("step"),
    mode: modeSchema,
    id: z.uuid(),
    round: z.number().int().min(1).max(20),
    move: moveSchema,
  }),
]);
export function createBattleHandlers(
  store: Store,
  origin: string,
  auth: AuthService,
  verifier: PrivyVerifier,
) {
  const service = new BattleService(new BattleStore(store));
  const access = new AccessBoundary(store, origin, auth, verifier);
  async function get(request: NextRequest): Promise<NextResponse> {
    try {
      const reader = await battleReader(request, auth, verifier, store);
      const { mode, actor } = reader;
      store.rateLimit(
        mode === "official" || reader.existingGuest
          ? `read:${actor}`
          : "read:anonymous-guest",
        Date.now(),
        mode === "official" || reader.existingGuest ? 90 : 120,
      );
      const result = readBattleView(request, service, reader);
      const reply = response(result);
      if (mode === "guest" && !walletPlay(request))
        reply.cookies.set("chog_guest", actor, {
          ...guestCookieOptions(request, origin),
          maxAge: GUEST_COOKIE_SECONDS,
        });
      return reply;
    } catch (error) {
      return failure(error);
    }
  }
  async function post(request: NextRequest): Promise<NextResponse> {
    try {
      requireJsonOrigin(request, origin);
      const input = parseInput(inputSchema, await body(request));
      let actor: string;
      let authority = null;
      let admission: AccessGrant | undefined;
      const player = await access.player(request);
      if (input.mode === "official") {
        const secret = walletSecret(request);
        const session = matchSession(
          auth,
          secret,
          await privyFor(request, verifier),
        );
        store.rateLimit(session.actor);
        const grant = await auth.authorize(secret);
        auth.ownership.assertFresh(grant.authority.ownership);
        actor = grant.session.actor;
        authority = grant.authority;
      } else if (player) {
        actor = player.actor;
        store.rateLimit(actor);
        if (input.operation === "start") admission = await access.admit(player);
      } else {
        const cookie = z
          .uuid()
          .safeParse(request.cookies.get("chog_guest")?.value);
        if (!cookie.success)
          throw new ServiceError(
            401,
            "Open the arena to establish guest practice.",
          );
        actor = cookie.data;
        protectWalletActor(store, actor);
        store.rateLimit(actor);
      }
      const battle =
        input.operation === "start"
          ? service.start({
              actor: actor,
              id: input.id,
              player: input.characterId,
              opponent: input.opponent,
              authority: authority,
              access: admission,
              cosmetic: access.entitlements.equipped(actor),
              difficulty: input.difficulty,
              arenaChoice: input.arena,
            })
          : service.step(actor, input.id, input.round, input.move, authority);
      return response({
        battle,
        history: service.session(actor, input.mode).history,
      });
    } catch (error) {
      return failure(error);
    }
  }
  return { get, post };
}
let handlers: ReturnType<typeof createBattleHandlers> | undefined;
function configured() {
  if (!handlers) {
    const { store, origin, auth, verifier } = identityRuntime();
    handlers = createBattleHandlers(store, origin, auth, verifier);
  }
  return handlers;
}
export function getBattle(request: NextRequest) {
  return configured().get(request);
}
export function postBattle(request: NextRequest) {
  return configured().post(request);
}
