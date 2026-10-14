import { expect, type APIRequestContext } from "@playwright/test";
import { identityFor } from "../../src/domain/identity";
export async function fixtureHolder(
  request: APIRequestContext,
  index = 0,
  path = "/api/identity",
) {
  const control = await request.post("https://127.0.0.1:3200/control", {
    data: { operation: "reset" },
  });
  expect(control.ok()).toBe(true);
  const signed = await request.post("https://127.0.0.1:3200/privy", {
    data: { index },
  });
  const proof = await signed.json();
  expect(proof.fixture).toBe(true);
  const headers = {
    Origin: "http://127.0.0.1:3100",
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
    { headers },
  );
}
