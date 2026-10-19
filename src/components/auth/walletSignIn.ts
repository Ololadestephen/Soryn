import { z } from "zod";
import { accessViewSchema } from "../../domain/access/policy";
import { request, RequestError } from "../request";
import { hexMessage, selectedWallet } from "../identity/wallet";
import type { WalletAdapter } from "./WalletAdapter";
import { loginStage } from "./accessTelemetry";

export type AccessPhase =
  "session" | "signature" | "completing" | "holdings" | "sign-out" | null;
export function accessProgress(phase: AccessPhase): string {
  switch (phase) {
    case "session":
      return "Checking your session…";
    case "signature":
      return "Waiting for signature…";
    case "completing":
      return "Completing sign-in…";
    case "holdings":
      return "Verifying holdings…";
    case "sign-out":
      return "Signing out…";
    default:
      return "";
  }
}

/** Reads authentication independently of RPC evidence or the admission switch. */
export function readWalletSession(
  proof: Record<string, string>,
  signal?: AbortSignal,
) {
  return request(
    "/api/access?records=1",
    accessViewSchema.parse,
    undefined,
    signal,
    proof,
  );
}

/** One human signature at most. Never retries a nonce or a verification POST. */
export async function signInToWallet(
  wallet: WalletAdapter,
  phase: (value: AccessPhase) => void,
  signal: AbortSignal,
) {
  phase("session");
  const proof = await wallet.headers();
  signal.throwIfAborted();
  const existing = await readWalletSession(proof, signal);
  if (existing.authenticated) return { session: existing, proof };
  const provider = await wallet.provider();
  const address = await selectedWallet(provider, wallet.address);
  signal.throwIfAborted();
  loginStage("handoff-start");
  const challenge = await request(
    "/api/access",
    (value) =>
      z.object({ nonce: z.string(), message: z.string() }).parse(value),
    { operation: "challenge", wallet: address },
    signal,
    proof,
  );
  phase("signature");
  loginStage("signature-request");
  const signature = await provider.request({
    method: "personal_sign",
    params: [hexMessage(challenge.message), address],
  });
  signal.throwIfAborted();
  loginStage("signature-returned");
  phase("completing");
  try {
    await request(
      "/api/access",
      (value) => z.object({ signedIn: z.literal(true) }).parse(value),
      { operation: "verify", ...challenge, signature },
      signal,
      proof,
    );
  } catch (error) {
    // A lost acknowledgement may still have delivered Set-Cookie. Only read back;
    // a 429 or explicit verification rejection is never retried behind the user's back.
    const uncertain =
      error instanceof TypeError ||
      (error instanceof RequestError &&
        (error.status >= 500 || error.status === 200));
    if (!uncertain || signal.aborted) throw error;
    const recovered = await readWalletSession(proof, signal);
    if (!recovered.authenticated) throw error;
    loginStage("session-ready");
    return { session: recovered, proof };
  }
  const session = await readWalletSession(proof, signal);
  if (!session.authenticated)
    throw new Error(
      "The server session could not be confirmed. Check sign-in again; an existing session will be recovered before requesting another signature.",
    );
  loginStage("session-ready");
  return { session, proof };
}
