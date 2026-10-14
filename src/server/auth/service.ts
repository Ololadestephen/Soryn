import { createHash, randomBytes } from "node:crypto";
import { getAddress, verifyMessage, type Hex } from "viem";
import { createSiweMessage } from "viem/siwe";
import {
  addressSchema,
  type TokenIdentity,
  type OfficialAuthority,
} from "../../domain/identity";
import { ServiceError } from "../errors";
import { type OwnershipReader } from "../nft/rpc";
import { IdentityStore, type WalletSession } from "./persistence";
import { OwnershipService } from "./ownership";

const CHALLENGE_MS = 5 * 60_000;
export const SESSION_MS = 15 * 60_000;
export function secretHash(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export class AuthService {
  readonly ownership: OwnershipService;
  constructor(
    private records: IdentityStore,
    private chain: OwnershipReader,
    private origin: string,
    private now = Date.now,
  ) {
    this.ownership = new OwnershipService(records, chain, now);
  }
  async challenge(
    browser: string,
    walletInput: string,
    identity: TokenIdentity,
    privyUserId: string | null = null,
  ) {
    const wallet = addressSchema.parse(walletInput);
    if (await this.chain.isContract(wallet))
      throw new ServiceError(
        422,
        "This slice supports EOA wallets. Contract wallets are not supported yet.",
      );
    const observed = await this.ownership.fresh(identity);
    this.ownership.assertFresh(observed);
    const nonce = randomBytes(24).toString("hex");
    const sessionExpires = this.now() + SESSION_MS;
    const url = new URL(this.origin);
    const message = createSiweMessage({
      address: getAddress(wallet),
      chainId: identity.chainId,
      domain: url.host,
      scheme: url.protocol.slice(0, -1),
      uri: this.origin,
      version: "1",
      nonce,
      issuedAt: new Date(this.now()),
      expirationTime: new Date(sessionExpires),
      statement:
        "Sign in to Chog Deja Vu. This message does not authorize transactions or publication. Official writes require fresh token ownership.",
      resources: [
        `urn:chog:${identity.chainId}:${identity.collection}:${identity.tokenId}`,
        `urn:chog:ownership:${observed.generation}`,
      ],
    });
    this.records.saveChallenge(
      {
        privyUserId,
        nonce,
        browser,
        wallet,
        identity,
        generation: observed.generation,
        message,
        expires: this.now() + CHALLENGE_MS,
        sessionExpires,
      },
      this.now(),
    );
    return {
      nonce,
      message,
      expires: this.now() + CHALLENGE_MS,
      owner: observed.owner === wallet,
    };
  }
  async verify(
    browser: string,
    nonce: string,
    message: string,
    signature: Hex,
    privyUserId: string | null = null,
  ) {
    const challenge = this.records.challenge(nonce);
    if (challenge.privyUserId !== privyUserId)
      throw new ServiceError(
        401,
        "Sign-in challenge belongs to another Privy account.",
      );
    if (
      challenge.browser !== browser ||
      challenge.message !== message ||
      challenge.expires <= this.now()
    )
      throw new ServiceError(
        401,
        "Wrong browser, altered or expired sign-in challenge.",
      );
    let valid = false;
    try {
      valid = await verifyMessage({
        address: getAddress(challenge.wallet),
        message,
        signature,
      });
    } catch {
      /* Invalid signature is an authentication error. */
    }
    if (!valid) throw new ServiceError(401, "Wallet signature invalid.");
    if (await this.chain.isContract(challenge.wallet))
      throw new ServiceError(
        422,
        "Contract wallet authentication unsupported.",
      );
    const observed = await this.ownership.fresh(challenge.identity);
    this.ownership.assertFresh(observed);
    if (observed.generation !== challenge.generation)
      throw new ServiceError(
        401,
        "Ownership changed while signing. Request a new message.",
      );
    return this.records.store.transaction(() => {
      const current = this.records.challenge(nonce);
      if (current.expires <= this.now() || current.sessionExpires <= this.now())
        throw new ServiceError(401, "Sign-in expired.");
      this.ownership.assertFresh(observed);
      this.records.consume(nonce);
      const secret = randomBytes(32).toString("hex");
      const session: WalletSession = {
        privyUserId,
        actor: this.records.account(challenge.wallet),
        wallet: challenge.wallet,
        identity: challenge.identity,
        generation:
          observed.owner === challenge.wallet ? observed.generation : null,
        expires: challenge.sessionExpires,
        revoked: false,
      };
      this.records.saveSession(secretHash(secret), session);
      return { secret, session };
    });
  }
  session(secret: string): WalletSession {
    const session = this.records.session(secretHash(secret));
    if (session.expires <= this.now())
      throw new ServiceError(401, "Wallet session expired. Sign in again.");
    return session;
  }
  async authorize(
    secret: string,
  ): Promise<{ session: WalletSession; authority: OfficialAuthority }> {
    const session = this.session(secret);
    const observed = await this.ownership.fresh(session.identity);
    this.ownership.assertFresh(observed);
    const current = this.session(secret);
    if (
      current.revoked ||
      current.generation !== observed.generation ||
      observed.owner !== current.wallet
    )
      throw new ServiceError(
        403,
        "Current-owner grant unavailable or revoked. Sign in again after any ownership change.",
      );
    return {
      session,
      authority: {
        identity: session.identity,
        generation: observed.generation,
        ownership: observed,
      },
    };
  }
  logout(secret: string): void {
    this.records.logout(secretHash(secret));
  }
}
