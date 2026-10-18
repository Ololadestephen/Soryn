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
import { tokenKey } from "../../domain/identity";
import { timersFromEnv } from "../../domain/pvp/timers";
import type { PrivyVerifier } from "../auth/privy";
import { matchSession, privyFor, walletSecret } from "../auth/request";
import { identityRuntime } from "../auth/runtime";
import type { AuthService } from "../auth/service";
import { ServiceError } from "../errors";
import {
  body,
  failure,
  guestCookieOptions,
  requireJsonOrigin,
  response,
} from "../httpShared";
import type { Store } from "../persistence";
import { PvpStore } from "../pvp/persistence";
import { PvpService } from "../pvp/service";
import { createOwnedPvpService } from "../pvp/ownedService";
import { QueueService, type QueueToken } from "../pvp/queue";
import { reconcileParticipation } from "../participation";

const inputSchema = z.discriminatedUnion("operation", [
  z.strictObject({
    operation: z.literal("join"),
    mode: z.enum(["guest", "official"]).optional(),
  }),
  z.strictObject({
    operation: z.literal("cancel"),
    mode: z.enum(["guest", "official"]).optional(),
  }),
  z.strictObject({
    operation: z.literal("accept"),
    mode: z.enum(["guest", "official"]).optional(),
  }),
  z.strictObject({
    operation: z.literal("decline"),
    mode: z.enum(["guest", "official"]).optional(),
  }),
]);

function guestActor(request: NextRequest) {
  const parsed = z.uuid().safeParse(request.cookies.get("chog_guest")?.value);
  return parsed.success ? parsed.data : null;
}

export function createMatchHandlers(
  store: Store,
  origin: string,
  auth?: AuthService,
  verifier?: PrivyVerifier,
  holdings?: import("../access/reader").HoldingReader,
) {
  const matches = auth
    ? createOwnedPvpService(store, auth, timersFromEnv(process.env))
    : new PvpService(new PvpStore(store), timersFromEnv(process.env));
  const queue = new QueueService(store, matches);
  const access = new AccessBoundary(store, origin, auth, verifier, holdings);
  async function requestActor(request: NextRequest) {
    const player = await access.player(request);
    const existing = player?.actor ?? guestActor(request);
    if (existing && !player) protectWalletActor(store, existing);
    return existing;
  }
  async function requireGuestActor(request: NextRequest) {
    const existing = await requestActor(request);
    if (!existing)
      throw new ServiceError(401, "Find a match to take a guest seat.");
    return existing;
  }
  /**
   * A verified token seat when the request carries both a wallet session
   * cookie and Privy proof headers. Missing either is a normal guest browse;
   * present-but-invalid proof fails loudly (never silently downgraded), so a
   * stale holder session cannot quietly play as a guest under their own name.
   */
  async function officialSeat(
    request: NextRequest,
    mode?: "guest" | "official",
  ): Promise<{
    actor: string;
    token: QueueToken;
  } | null> {
    if (mode === "guest" || (!mode && walletPlay(request))) return null;
    if (!auth || !verifier) {
      if (mode === "official")
        throw new ServiceError(503, "Official matchmaking is not configured.");
      return null;
    }
    const wallet = request.cookies.get("chog_wallet")?.value;
    const proof =
      request.headers.get("authorization")?.startsWith("Bearer ") ||
      request.headers.get("privy-id-token") ||
      request.cookies.get("privy-id-token")?.value;
    if (!wallet || !/^[0-9a-f]{64}$/.test(wallet) || !proof) {
      if (mode === "official")
        throw new ServiceError(
          401,
          "Sign in through My Chog and authorize your selected token first.",
        );
      return null;
    }
    const secret = walletSecret(request);
    const session = matchSession(
      auth,
      secret,
      await privyFor(request, verifier),
    );
    // Record a verification stall or confirmed interruption through the same
    // gate as room polling before a failed grant can strand a matched seat.
    await matches.sessionChecked(session.actor, Date.now());
    const authority = (await auth.authorize(secret)).authority;
    reconcileParticipation(store, authority, Date.now());
    return {
      actor: session.actor,
      token: {
        key: tokenKey(authority.identity),
        owner: authority.ownership.owner,
        generation: authority.generation,
      },
    };
  }
  async function get(request: NextRequest): Promise<NextResponse> {
    try {
      const mode = parseInput(
        z.enum(["guest", "official"]).optional(),
        request.nextUrl.searchParams.get("mode") ?? undefined,
      );
      const holder = await officialSeat(request, mode);
      if (holder) {
        store.rateLimit(`read:${holder.actor}`, Date.now(), 90);
        const state = queue.state(holder.actor, Date.now());
        queue.assertToken(holder.actor, holder.token);
        return response({
          ...state,
          mode: "official",
          tokenId: holder.token.key.split(":").at(-1),
        });
      }
      const existing = await requestActor(request);
      const id = existing ?? randomUUID();
      store.rateLimit(
        existing ? `read:${id}` : "read:anonymous-guest",
        Date.now(),
        existing ? 90 : 120,
      );
      await matches.sessionChecked(id, Date.now());
      const state = queue.state(id, Date.now());
      queue.assertToken(id, null);
      const reply = response({ ...state, mode: "guest" });
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
      const now = Date.now();
      const holder = await officialSeat(request, input.mode);
      const existing = await requestActor(request);
      const id =
        holder?.actor ??
        (input.operation === "join"
          ? (existing ?? randomUUID())
          : await requireGuestActor(request));
      const mode = holder ? "official" : "guest";
      store.rateLimit(id);
      if (!holder) await matches.sessionChecked(id, now);
      queue.state(id, now);
      queue.assertToken(id, holder?.token ?? null);
      let admission;
      if (input.operation === "join" || input.operation === "accept") {
        requireAdmissionsOpen();
        if (!holder)
          admission = await access.admit(await access.player(request));
        if (input.operation === "accept") await access.refreshOffer(id);
      }
      let payload;
      switch (input.operation) {
        case "join":
          payload = queue.join(
            {
              actor: id,
              mode,
              access: admission,
              cosmetic: access.entitlements.equipped(id),
            },
            now,
            holder?.token,
          );
          break;
        case "cancel":
          payload = queue.cancel(id, now);
          break;
        case "accept":
          payload = queue.accept(id, now);
          break;
        case "decline":
          payload = queue.decline(id, now);
          break;
      }
      const reply = response(
        holder
          ? {
              ...payload,
              mode: "official",
              tokenId: holder.token.key.split(":").at(-1),
            }
          : payload,
      );
      if (
        !holder &&
        !walletPlay(request) &&
        !existing &&
        input.operation === "join"
      )
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
  return { get, post };
}

let handlers: ReturnType<typeof createMatchHandlers> | undefined;
export function getMatch(request: NextRequest) {
  return configured().get(request);
}
export function postMatch(request: NextRequest) {
  return configured().post(request);
}
function configured() {
  if (!handlers) {
    const { store, origin, auth, verifier } = identityRuntime();
    handlers = createMatchHandlers(store, origin, auth, verifier);
  }
  return handlers;
}
