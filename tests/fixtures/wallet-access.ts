import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { NextRequest } from "next/server";
import { expect } from "vitest";
import { officialCombatFixture, origin } from "./official-combat";
import { createAccessHandlers } from "../../src/server/access/http";
import type { HoldingReader } from "../../src/server/access/reader";
export async function walletAccessFixture(
  reader: HoldingReader,
  existing?: Awaited<ReturnType<typeof officialCombatFixture>>,
) {
  const ctx = existing ?? (await officialCombatFixture());
  const account = privateKeyToAccount(generatePrivateKey());
  const proof = await ctx.proof(account.address);
  const handlers = createAccessHandlers(
    ctx.store,
    origin,
    ctx.auth,
    ctx.verifier,
    reader,
  );
  const post = (data: unknown, cookie = "", headers = proof) =>
    handlers.post(
      new NextRequest(`${origin}/api/access`, {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
          cookie,
          ...headers,
        },
        body: JSON.stringify(data),
      }),
    );
  const challengeReply = await post({
    operation: "challenge",
    wallet: account.address.toLowerCase(),
  });
  expect(challengeReply.status).toBe(200);
  const browser = challengeReply.headers.get("set-cookie")!.split(";")[0];
  const challenge = await challengeReply.json();
  const signature = await account.signMessage({ message: challenge.message });
  const verification = { operation: "verify", ...challenge, signature };
  const verified = await post(verification, browser);
  expect(verified.status).toBe(200);
  const cookie = `${ctx.guest}; ${browser}; ${verified.headers.get("set-cookie")!.split(";")[0]}`;
  const headers = { ...proof, "x-soryn-play": "wallet" };
  return {
    ctx,
    handlers,
    post,
    account,
    headers,
    cookie,
    browser,
    challenge,
    verification,
  };
}
/** Deterministic qualifying fungible evidence, independent of the NFT ownership fixture. */
export const qualifyingHoldings: HoldingReader = {
  token: async () => ({
    qualifies: true,
    checkedAt: Date.now(),
    block: "0x100",
  }),
  nft: async () => ({
    qualifies: false,
    checkedAt: Date.now(),
    block: "0x100",
  }),
};
