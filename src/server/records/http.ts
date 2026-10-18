import { parseInput } from "../httpShared";
import { NextRequest } from "next/server";
import { z } from "zod";
import {
  identitySchema,
  tokenKey,
  CHAIN_ID,
  COLLECTION,
} from "../../domain/identity";
import type { CompetitorView } from "../../domain/competitor";
import type { AuthService } from "../auth/service";
import type { PrivyVerifier } from "../auth/privy";
import { matchSession, privyFor, walletSecret } from "../auth/request";
import { identityRuntime } from "../auth/runtime";
import type { Store } from "../persistence";
import { TokenLocks } from "../pvp/locks";
import { PvpStore } from "../pvp/persistence";
import { body, failure, requireJsonOrigin, response } from "../httpShared";
import { reconcileParticipation } from "../participation";
import { TokenRecords } from "./tokenRecords";
import { TokenProfileService } from "./profile";
import { ServiceError } from "../errors";

const actionSchema = z.discriminatedUnion("operation", [
  z.strictObject({
    operation: z.literal("publish"),
    id: z.uuid(),
    alias: z.string().trim().min(1).max(32),
    consent: z.literal(true),
  }),
  z.strictObject({ operation: z.literal("withdraw"), id: z.uuid() }),
]);
export function profileIdentity(tokenId: string, query: URLSearchParams) {
  if (
    query.getAll("chainId").length > 1 ||
    query.getAll("collection").length > 1
  )
    throw new ServiceError(400, "Provide one collection and chain identity.");
  const identity = { chainId: CHAIN_ID, collection: COLLECTION, tokenId };
  return parseInput(identitySchema, {
    ...identity,
    chainId: query.has("chainId")
      ? Number(query.get("chainId"))
      : identity.chainId,
    collection: query.get("collection") ?? identity.collection,
  });
}
export function limitPublicProfile(store: Store) {
  store.rateLimit("public:token-profile", Date.now(), 30);
}
export function createRecordHandlers(
  store: Store,
  origin: string,
  auth: AuthService,
  verifier: PrivyVerifier,
) {
  const records = new TokenRecords(store);
  async function signed(request: NextRequest) {
    const secret = walletSecret(request);
    const session = matchSession(
      auth,
      secret,
      await privyFor(request, verifier),
    );
    store.rateLimit(`competitor:${session.actor}`, Date.now(), 90);
    return { secret, session };
  }
  async function get(request: NextRequest) {
    try {
      const { secret, session } = await signed(request);
      const historical = request.nextUrl.searchParams.get("history") === "1";
      const authority = historical
        ? null
        : (await auth.authorize(secret)).authority;
      if (authority) reconcileParticipation(store, authority, Date.now());
      const held = authority
        ? new TokenLocks(store).get(tokenKey(authority.identity), Date.now())
        : null;
      const room =
        held?.kind === "series"
          ? new PvpStore(store).byReservation(held.encounter)
          : null;
      const view: CompetitorView = {
        identity: session.identity,
        verifiedAt: authority?.ownership.checkedAt ?? null,
        active:
          held && (held.kind !== "series" || room)
            ? {
                kind: held.kind,
                href:
                  held.kind === "story"
                    ? "/story?as=chog"
                    : held.kind === "queue"
                      ? "/match?as=chog"
                      : `/challenge/${room?.invite ?? ""}?as=chog`,
              }
            : null,
        entries: records
          .forKeeper(session.wallet)
          .filter((entry) => entry.token === tokenKey(session.identity))
          .map((entry) => ({
            id: entry.id,
            headline: entry.headline,
            kind: entry.kind,
            fighter: entry.fighter,
            recordedAt: entry.recordedAt,
            canPublish:
              !!authority &&
              entry.owner === authority.ownership.owner &&
              entry.generation === authority.generation &&
              !!entry.eligibleForPublication &&
              !!entry.rules &&
              !entry.publication,
            publication: entry.publication?.status ?? "private",
          })),
      };
      return response(view);
    } catch (error) {
      return failure(error);
    }
  }
  async function post(request: NextRequest) {
    try {
      requireJsonOrigin(request, origin);
      const input = parseInput(actionSchema, await body(request));
      const { secret, session } = await signed(request);
      if (input.operation === "withdraw") {
        const observed = await auth.ownership.fresh(session.identity);
        auth.ownership.assertFresh(observed);
        records.withdraw(input.id, session.wallet);
        return response({ withdrawn: true });
      }
      const { authority } = await auth.authorize(secret);
      auth.ownership.assertFresh(authority.ownership);
      return response(
        records.publish(input.id, authority, input.alias, Date.now()),
      );
    } catch (error) {
      return failure(error);
    }
  }
  async function profile(request: NextRequest, tokenId: string) {
    try {
      const identity = profileIdentity(tokenId, request.nextUrl.searchParams);
      limitPublicProfile(store);
      return response(
        await new TokenProfileService(records, auth.ownership).profile(
          identity,
        ),
      );
    } catch (error) {
      return failure(error);
    }
  }
  return { get, post, profile };
}
function configured() {
  const { store, origin, auth, verifier } = identityRuntime();
  return createRecordHandlers(store, origin, auth, verifier);
}
export function getCompetitor(request: NextRequest) {
  return configured().get(request);
}
export function postCompetitor(request: NextRequest) {
  return configured().post(request);
}
export function getProfile(request: NextRequest, tokenId: string) {
  return configured().profile(request, tokenId);
}
