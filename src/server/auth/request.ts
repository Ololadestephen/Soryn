import { NextRequest } from "next/server";
import {
  type PrivyVerifier,
  type PrivyIdentity,
  requireLinkedWallet,
} from "./privy";
import { AuthService } from "./service";
import { ServiceError } from "../errors";

export async function privyFor(
  request: NextRequest,
  verifier: PrivyVerifier,
): Promise<PrivyIdentity> {
  const authorization = request.headers.get("authorization");
  return verifier.verify(
    authorization?.startsWith("Bearer ") ? authorization.slice(7) : "",
    request.headers.get("privy-id-token") ??
      request.cookies.get("privy-id-token")?.value ??
      "",
  );
}
export function matchSession(
  auth: AuthService,
  secret: string,
  proof: PrivyIdentity,
) {
  const session = auth.session(secret);
  if (!session.privyUserId || session.privyUserId !== proof.userId)
    throw new ServiceError(
      401,
      "Sign in through Privy and authorize this token again.",
    );
  requireLinkedWallet(proof, session.wallet);
  return session;
}
export function walletSecret(request: NextRequest) {
  const secret = request.cookies.get("chog_wallet")?.value;
  if (!secret || !/^[0-9a-f]{64}$/.test(secret))
    throw new ServiceError(401, "Connect and sign in to your wallet.");
  return secret;
}
