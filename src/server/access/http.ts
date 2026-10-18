import { holderAccessEnabled, HOLDER_ACCESS_PAUSED } from "./rollout";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { addressSchema } from "../../domain/identity";
import { identityRuntime } from "../auth/runtime";
import {
  parseInput,
  body,
  failure,
  guestCookieOptions,
  requireJsonOrigin,
  response,
} from "../httpShared";
import { Entitlements } from "./service";
import { WalletAccessAuth } from "./auth";
import type { Store } from "../persistence";
import type { AuthService } from "../auth/service";
import type { PrivyVerifier } from "../auth/privy";
import type { HoldingReader } from "./reader";
import { ServiceError } from "../errors";
const inputSchema = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("challenge"), wallet: addressSchema }),
  z.strictObject({
    operation: z.literal("verify"),
    nonce: z.string().regex(/^[a-f0-9]{48}$/),
    message: z.string().max(4000),
    signature: z.templateLiteral(["0x", z.string()]),
  }),
  z.strictObject({ operation: z.literal("equip"), equipped: z.boolean() }),
  z.strictObject({ operation: z.literal("refresh") }),
  z.strictObject({ operation: z.literal("logout") }),
]);
export function createAccessHandlers(
  store: Store,
  origin: string,
  auth: AuthService,
  verifier: PrivyVerifier,
  reader?: HoldingReader,
) {
  const login = new WalletAccessAuth(store, auth, verifier, origin),
    entitlements = new Entitlements(store, reader);
  async function get(request: NextRequest) {
    try {
      const player = await login.player(request);
      store.rateLimit(`access:${player.actor}`, Date.now(), 40);
      if (request.nextUrl.searchParams.get("records") === "1")
        return response({
          status: "practice-only",
          message: "Private wallet records",
          fighters: [],
          checkedAt: null,
          authenticated: true,
        });
      return response(await entitlements.view(player));
    } catch (error) {
      if (error instanceof ServiceError && error.status === 401)
        return response({
          status: holderAccessEnabled() ? "signed-out" : "paused",
          message: holderAccessEnabled()
            ? "Connect wallet"
            : HOLDER_ACCESS_PAUSED,
          authenticated: false,
          fighters: ["pip", "bolt", "patch", "moss"],
          checkedAt: null,
        });
      return failure(error);
    }
  }
  async function post(request: NextRequest) {
    try {
      requireJsonOrigin(request, origin);
      const input = parseInput(inputSchema, await body(request));
      const cookie = z
        .uuid()
        .safeParse(request.cookies.get("soryn_access_browser")?.value);
      if (input.operation === "challenge") {
        const browser = cookie.success ? cookie.data : randomUUID();
        store.rateLimit("access:challenge", Date.now(), 60);
        const reply = response(
          await login.challenge(request, browser, input.wallet),
        );
        reply.cookies.set("soryn_access_browser", browser, {
          ...guestCookieOptions(request, origin),
          maxAge: 300,
        });
        return reply;
      }
      if (input.operation === "verify") {
        if (!cookie.success)
          throw new ServiceError(401, "Open wallet sign-in first.");
        const secret = await login.verify(
          request,
          cookie.data,
          input.nonce,
          input.message,
          input.signature as `0x${string}`,
        );
        const reply = response({ signedIn: true });
        reply.cookies.set("chog_wallet", secret, {
          ...guestCookieOptions(request, origin),
          maxAge: 900,
        });
        return reply;
      }
      // Origin-checked, cookie-scoped revocation must also work after Privy expires.
      // It can only revoke this browser's presented session, never establish authority.
      if (input.operation === "logout") {
        login.logout(request);
        const reply = response({ signedOut: true });
        reply.cookies.set("chog_wallet", "", {
          ...guestCookieOptions(request, origin),
          maxAge: 0,
        });
        return reply;
      }
      const player = await login.player(request);
      store.rateLimit(`access-write:${player.actor}`, Date.now(), 30);
      if (input.operation === "equip")
        return response(await entitlements.equip(player, input.equipped));
      return response(await entitlements.view(player, true));
    } catch (error) {
      return failure(error);
    }
  }
  return { get, post };
}
let handlers: ReturnType<typeof createAccessHandlers> | undefined;
function configured() {
  const r = identityRuntime();
  return (handlers ??= createAccessHandlers(
    r.store,
    r.origin,
    r.auth,
    r.verifier,
  ));
}
export function getAccess(request: NextRequest) {
  return configured().get(request);
}
export function postAccess(request: NextRequest) {
  return configured().post(request);
}
