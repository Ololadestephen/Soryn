import { createRemoteJWKSet, importSPKI, jwtVerify } from "jose";
import { z } from "zod";
import { addressSchema } from "../../domain/identity";
import { ServiceError } from "../errors";

const MAX_TOKEN_LENGTH = 24_000;
const MAX_LINKED_ACCOUNT_CHARS = 16_000;
const JWKS_CACHE_MS = 60 * 60_000;
const JWKS_TIMEOUT_MS = 5_000;
const JWKS_COOLDOWN_MS = 30_000;
const subjectSchema = z
  .string()
  .regex(/^did:privy:[a-zA-Z0-9_-]+$/)
  .max(256);
const claimsSchema = z.object({
  sub: subjectSchema,
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
});
export interface PrivyIdentity {
  userId: string;
  sessionId: string;
  wallets: string[];
  selectedWallet?: string;
}
export interface PrivyVerifier {
  verify(accessToken: string, identityToken: string): Promise<PrivyIdentity>;
}

export class PrivyTokenVerifier implements PrivyVerifier {
  private key: ReturnType<typeof importSPKI> | undefined;
  private keySet: ReturnType<typeof createRemoteJWKSet> | undefined;
  constructor(
    private appId: string,
    private verificationKey: string,
    private now = Date.now,
    private mode: "pem" | "jwks" = "pem",
  ) {}
  async verify(
    accessToken: string,
    identityToken: string,
  ): Promise<PrivyIdentity> {
    if (!this.appId || (this.mode === "pem" && !this.verificationKey))
      throw new ServiceError(
        503,
        "Privy sign-in configuration is incomplete. Guest play remains available.",
      );
    if (
      !accessToken ||
      !identityToken ||
      accessToken.length > MAX_TOKEN_LENGTH ||
      identityToken.length > MAX_TOKEN_LENGTH
    )
      throw new ServiceError(
        401,
        "Valid Privy access and identity tokens are required.",
      );
    let key:
      | Awaited<ReturnType<typeof importSPKI>>
      | ReturnType<typeof createRemoteJWKSet>;
    if (this.mode === "jwks") {
      this.keySet ??= createRemoteJWKSet(
        new URL(
          `https://api.privy.io/v1/apps/${encodeURIComponent(this.appId)}/jwks.json`,
        ),
        {
          cacheMaxAge: JWKS_CACHE_MS,
          timeoutDuration: JWKS_TIMEOUT_MS,
          cooldownDuration: JWKS_COOLDOWN_MS,
        },
      );
      key = this.keySet;
    } else {
      try {
        const escapedNewline = String.fromCharCode(92) + "n";
        this.key ??= importSPKI(
          this.verificationKey
            .split(escapedNewline)
            .join(String.fromCharCode(10)),
          "ES256",
        );
        key = await this.key;
      } catch (error) {
        this.key = undefined;
        throw new ServiceError(
          503,
          "Privy verification key configuration is invalid. Guest play remains available.",
          undefined,
          { cause: error },
        );
      }
    }
    try {
      const options = {
        algorithms: ["ES256"],
        issuer: "privy.io",
        audience: this.appId,
        requiredClaims: ["sub", "iat", "exp"],
        currentDate: new Date(this.now()),
      };
      const access = await jwtVerify(accessToken, key, options);
      const identity = await jwtVerify(identityToken, key, options);
      const claims = claimsSchema
        .extend({ sid: z.string().min(1).max(256) })
        .parse(access.payload);
      const user = claimsSchema
        .extend({ linked_accounts: z.string().max(MAX_LINKED_ACCOUNT_CHARS) })
        .parse(identity.payload);
      const seconds = this.now() / 1000;
      if (
        claims.sub !== user.sub ||
        claims.iat > seconds + 5 ||
        user.iat > seconds + 5 ||
        claims.exp <= claims.iat ||
        user.exp <= user.iat
      )
        throw new Error("Invalid subject or times");
      const accounts = z
        .array(
          z.object({
            type: z.string(),
            chain_type: z.string().optional(),
            chainType: z.string().optional(),
            address: z.string().optional(),
          }),
        )
        .max(100)
        .parse(JSON.parse(user.linked_accounts));
      const wallets = accounts
        .filter(
          (account) =>
            account.type === "wallet" &&
            (account.chain_type ?? account.chainType) === "ethereum",
        )
        .map((account) => addressSchema.parse(account.address));
      return {
        userId: claims.sub,
        sessionId: claims.sid,
        wallets: [...new Set(wallets)],
      };
    } catch (error) {
      if (
        this.mode === "jwks" &&
        (error instanceof TypeError ||
          (error instanceof Error &&
            "code" in error &&
            [
              "ERR_JWKS_TIMEOUT",
              "ERR_JWKS_INVALID",
              "ERR_JOSE_GENERIC",
            ].includes(String(error.code))))
      )
        throw new ServiceError(
          503,
          "Privy signing-key evidence unavailable. No protected request was authorized.",
          undefined,
          { cause: error },
        );
      throw new ServiceError(
        401,
        "Privy session invalid or expired. Sign in again.",
        undefined,
        { cause: error },
      );
    }
  }
}
export function requireLinkedWallet(
  identity: PrivyIdentity,
  wallet: string,
): void {
  if (!identity.wallets.includes(addressSchema.parse(wallet)))
    throw new ServiceError(
      403,
      "The selected wallet is not linked to this verified Privy account.",
    );
}
