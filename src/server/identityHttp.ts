import { AdventureStore } from "./adventure/persistence";
import { parseInput } from "./httpShared";
import { characterIdSchema } from "../domain/characters/definitions";
import { randomUUID } from "node:crypto";
import { NextRequest, type NextResponse } from "next/server";
import { z } from "zod";
import {
  stepRequestSchema,
  publicationRequestSchema,
  withdrawalRequestSchema,
} from "../domain/requests";
import { addressSchema, identitySchema, identityFor } from "../domain/identity";
import { AuthService } from "./auth/service";
import { IdentityStore } from "./auth/persistence";
import { OfficialService } from "./adventure/official";
import { TokenRecords } from "./records/tokenRecords";
import {
  response,
  failure,
  body,
  requireJsonOrigin,
  guestCookieOptions,
} from "./httpShared";
import { ServiceError } from "./errors";
import {
  privyFor,
  matchSession,
  walletSecret as secretFor,
} from "./auth/request";
import { identityRuntime } from "./auth/runtime";
import {
  requireLinkedWallet,
  type PrivyVerifier,
  type PrivyIdentity,
} from "./auth/privy";

const browserCookie = "chog_auth_browser";
const sessionCookie = "chog_wallet";
const nonceSchema = z.string().regex(/^[0-9a-f]{48}$/);
const signatureSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{130}$/)
  .transform((value) => value as `0x${string}`);
const requestSchema = z.discriminatedUnion("operation", [
  z.strictObject({
    operation: z.literal("challenge"),
    wallet: addressSchema,
    identity: identitySchema,
  }),
  z.strictObject({
    operation: z.literal("verify"),
    nonce: nonceSchema,
    message: z.string().max(2000),
    signature: signatureSchema,
  }),
  z.strictObject({
    operation: z.literal("start"),
    id: z.uuid(),
    retryOf: z.uuid().nullable(),
    characterId: characterIdSchema.optional(),
  }),
  stepRequestSchema,
  publicationRequestSchema.extend({ museum: z.boolean() }),
  withdrawalRequestSchema,
  z.strictObject({ operation: z.literal("tokens") }),
  z.strictObject({ operation: z.literal("logout") }),
]);
function browserFor(request: NextRequest): string | null {
  const parsed = z.uuid().safeParse(request.cookies.get(browserCookie)?.value);
  return parsed.success ? parsed.data : null;
}
function setCookie(
  reply: NextResponse,
  request: NextRequest,
  name: string,
  value: string,
  seconds: number,
  origin: string,
) {
  reply.cookies.set(name, value, {
    ...guestCookieOptions(request, origin),
    maxAge: seconds,
  });
}

export function createIdentityHandlers(
  records: IdentityStore,
  auth: AuthService,
  origin: string,
  verifier: PrivyVerifier,
) {
  const official = new OfficialService(records);
  async function get(request: NextRequest): Promise<NextResponse> {
    try {
      const browser = browserFor(request) ?? randomUUID();
      records.store.rateLimit(browser);
      const tokenId = request.nextUrl.searchParams.get("tokenId");
      const data =
        tokenId !== null
          ? publicHistory(request, tokenId, records, auth)
          : await privateSession(request, official, auth, verifier);
      const reply = response(data);
      setCookie(reply, request, browserCookie, browser, 86400, origin);
      return reply;
    } catch (error) {
      return failure(error);
    }
  }
  async function post(request: NextRequest): Promise<NextResponse> {
    try {
      requireJsonOrigin(request, origin);
      const browser = browserFor(request);
      if (!browser)
        throw new ServiceError(
          401,
          "Open My Chog to establish a browser session.",
        );
      records.store.rateLimit(browser);
      const input = parseInput(requestSchema, await body(request));
      if (input.operation === "logout") {
        const secret = request.cookies.get(sessionCookie)?.value;
        if (secret && /^[0-9a-f]{64}$/.test(secret)) auth.logout(secret);
        const reply = response({ loggedOut: true });
        setCookie(reply, request, sessionCookie, "", 0, origin);
        return reply;
      }
      const proof = await privyFor(request, verifier);
      if (input.operation === "challenge") {
        requireLinkedWallet(proof, input.wallet);
        return response(
          await auth.challenge(
            browser,
            input.wallet,
            input.identity,
            proof.userId,
          ),
        );
      }
      if (input.operation === "verify")
        return await verifySignIn(
          request,
          browser,
          input,
          records,
          auth,
          official,
          proof,
          origin,
        );
      const secret = secretFor(request);
      matchSession(auth, secret, proof);
      if (input.operation === "tokens")
        return response(await pickerTokens(secret, auth, records));
      if (input.operation === "withdraw") {
        const session = auth.session(secret);
        const observed = await auth.ownership.fresh(session.identity);
        auth.ownership.assertFresh(observed);
        official.withdraw(session, input.id);
        return response(official.session(auth.session(secret)));
      }
      return await mutateOfficial(input, secret, auth, official);
    } catch (error) {
      return failure(error);
    }
  }
  return { get, post };
}

function publicHistory(
  request: NextRequest,
  tokenId: string,
  records: IdentityStore,
  auth: AuthService,
) {
  const identity = identityFor(tokenId);
  const chapters = records.chapters(identity);
  const guest = z.uuid().safeParse(request.cookies.get("chog_guest")?.value);
  const walletSecret = request.cookies.get(sessionCookie)?.value;
  let walletActor: string | null = null;
  if (walletSecret) {
    try {
      walletActor = auth.session(walletSecret).actor;
    } catch (error) {
      if (!(error instanceof ServiceError) || error.status !== 401) throw error;
    }
  }
  for (const chapter of chapters) {
    if (guest.success)
      new AdventureStore(records.store).expose(guest.data, chapter.scenario);
    if (walletActor)
      new AdventureStore(records.store).expose(walletActor, chapter.scenario);
  }
  return { identity, chapters };
}
async function privateSession(
  request: NextRequest,
  official: OfficialService,
  auth: AuthService,
  verifier: PrivyVerifier,
) {
  const secret = request.cookies.get(sessionCookie)?.value;
  if (!(secret && request.headers.has("authorization")))
    return {
      account: null,
      run: null,
      chapters: [],
      publication: null,
      withdrawals: [],
    };
  const session = matchSession(auth, secret, await privyFor(request, verifier));
  await auth.authorize(secret);
  return official.session(session);
}
async function verifySignIn(
  request: NextRequest,
  browser: string,
  input: Extract<z.infer<typeof requestSchema>, { operation: "verify" }>,
  records: IdentityStore,
  auth: AuthService,
  official: OfficialService,
  proof: PrivyIdentity,
  origin: string,
) {
  requireLinkedWallet(proof, records.challenge(input.nonce).wallet);
  const signed = await auth.verify(
    browser,
    input.nonce,
    input.message,
    input.signature,
    proof.userId,
  );
  const guest = z.uuid().safeParse(request.cookies.get("chog_guest")?.value);
  if (guest.success)
    for (const run of new AdventureStore(records.store)
      .history(guest.data)
      .filter((run) => run.mode === "guest"))
      new AdventureStore(records.store).expose(
        signed.session.actor,
        run.scenario,
      );
  const reply = response(official.session(signed.session));
  setCookie(
    reply,
    request,
    sessionCookie,
    signed.secret,
    Math.max(0, Math.floor((signed.session.expires - Date.now()) / 1000)),
    origin,
  );
  return reply;
}
/**
 * The signed-in wallet's verified token picker: the session's bound token
 * appears only while a fresh ownership check passes, so a transferred token
 * drops out for its previous owner immediately. Verification outages stay
 * explicit errors; only a confirmed revoked grant yields an empty picker.
 */
async function pickerTokens(
  secret: string,
  auth: AuthService,
  records: IdentityStore,
) {
  const session = auth.session(secret);
  try {
    await auth.authorize(secret);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 403)
      return { tokens: [] };
    throw error;
  }
  const tokenRecords = new TokenRecords(records.store);
  return {
    tokens: [
      {
        identity: session.identity,
        records: tokenRecords.summary(session.identity),
      },
    ],
  };
}
async function mutateOfficial(
  input: Extract<
    z.infer<typeof requestSchema>,
    { operation: "start" | "step" | "publish" }
  >,
  secret: string,
  auth: AuthService,
  official: OfficialService,
) {
  const { session, authority } = await auth.authorize(secret);
  auth.ownership.assertFresh(authority.ownership);
  switch (input.operation) {
    case "start":
      official.start(
        session,
        authority,
        input.id,
        input.retryOf,
        input.characterId,
      );
      break;
    case "step":
      official.step(session, authority, input.id, input.step, input.action);
      break;
    case "publish":
      official.publish(
        session,
        authority,
        input.id,
        input.title,
        input.alias,
        input.museum,
      );
      break;
    default:
      throw new ServiceError(400, "Unsupported official operation.");
  }
  return response(official.session(auth.session(secret)));
}

let handlers: ReturnType<typeof createIdentityHandlers> | undefined;
function configured() {
  if (!handlers) {
    const { records, auth, origin, verifier } = identityRuntime();
    handlers = createIdentityHandlers(records, auth, origin, verifier);
  }
  return handlers;
}
export function getIdentity(request: NextRequest) {
  return configured().get(request);
}
export function postIdentity(request: NextRequest) {
  return configured().post(request);
}
