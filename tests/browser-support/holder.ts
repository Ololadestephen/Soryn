import { expect, type APIRequestContext } from "@playwright/test";
import { identityFor } from "../../src/domain/identity";
export async function fixtureReset(request: APIRequestContext) {
  const control = await request.post("https://127.0.0.1:3200/control", {
    data: { operation: "reset" },
  });
  expect(control.ok()).toBe(true);
}
/**
 * Sign in a fixture wallet over the real challenge/verify endpoints. The
 * fixture RPC decides ownership, so index 1 only works after a fixture
 * transfer moved the token there.
 */
export async function fixtureSignIn(
  request: APIRequestContext,
  index = 0,
  path = "/api/identity",
) {
  const signed = await request.post("https://127.0.0.1:3200/privy", {
    data: { index },
  });
  const proof = await signed.json();
  expect(proof.fixture).toBe(true);
  const appOrigin = new URL((await request.get("/health")).url()).origin;
  const headers = {
    Origin: appOrigin,
    Authorization: `Bearer ${proof.access}`,
    "privy-id-token": proof.identity,
  };
  const bootstrap = await request.get("/api/identity");
  expect(bootstrap.ok()).toBe(true);
  const challenge = await request.post("/api/identity", {
    headers,
    data: {
      operation: "challenge",
      wallet: proof.wallet,
      identity: identityFor("276"),
    },
  });
  expect(challenge.ok(), await challenge.text()).toBe(true);
  const message = await challenge.json();
  const signature = await request.post("https://127.0.0.1:3200/sign", {
    data: { index, message: message.message },
  });
  const verify = await request.post("/api/identity", {
    headers,
    data: {
      operation: "verify",
      nonce: message.nonce,
      message: message.message,
      signature: (await signature.json()).signature,
    },
  });
  expect(verify.ok()).toBe(true);
  return Object.assign(
    async (input: Record<string, unknown>) =>
      request.post(path, { headers, data: input }),
    { headers, wallet: proof.wallet as string },
  );
}
export async function fixtureHolder(
  request: APIRequestContext,
  index = 0,
  path = "/api/identity",
) {
  await fixtureReset(request);
  return fixtureSignIn(request, index, path);
}
/** Synthetic wallet-play session; no selected NFT and no real wallet signature. */
export async function fixtureWalletAccess(
  request: APIRequestContext,
  index = 0,
  appOrigin = "http://127.0.0.1:3100",
) {
  const signed = await request.post("https://127.0.0.1:3200/privy", {
    data: { index },
  });
  const proof = await signed.json();
  expect(proof.fixture).toBe(true);
  const headers = {
    Origin: appOrigin,
    Authorization: `Bearer ${proof.access}`,
    "privy-id-token": proof.identity,
    "x-soryn-play": "wallet",
    "x-soryn-wallet": proof.wallet as string,
  };
  const challenge = await request.post("/api/access", {
    headers,
    data: { operation: "challenge", wallet: proof.wallet },
  });
  expect(challenge.ok(), await challenge.text()).toBe(true);
  const message = await challenge.json();
  const sign = await request.post("https://127.0.0.1:3200/sign", {
    data: { index, message: message.message },
  });
  const verification = await request.post("/api/access", {
    headers,
    data: {
      operation: "verify",
      ...message,
      signature: (await sign.json()).signature,
    },
  });
  expect(verification.ok(), await verification.text()).toBe(true);
  return { headers, wallet: proof.wallet as string };
}
