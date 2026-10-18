import { randomBytes } from "node:crypto";
import { getAddress, verifyMessage, type Hex } from "viem";
import { createSiweMessage } from "viem/siwe";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { addressSchema } from "../../domain/identity";
import { IdentityStore } from "../auth/persistence";
import { secretHash, SESSION_MS, type AuthService } from "../auth/service";
import { privyFor, walletSecret } from "../auth/request";
import {
  requireLinkedWallet,
  type PrivyVerifier,
  type PrivyIdentity,
} from "../auth/privy";
import { ServiceError } from "../errors";
import { readStored } from "../storedRecord";
import type { Store } from "../persistence";
import type { WalletPlayer } from "./service";
const challengeSchema = z.strictObject({
  browser: z.uuid(),
  userId: z.string(),
  wallet: addressSchema,
  message: z.string(),
  expires: z.number(),
  sessionExpires: z.number(),
});
const sessionSchema = z.strictObject({
  actor: z.uuid(),
  wallet: addressSchema,
  userId: z.string(),
  expires: z.number(),
});
/** Wallet-play scope shares Privy, accounts, cookie and signature standards with NFT sign-in.
 * It never invents a selected NFT or a current-owner authority. */
export class WalletAccessAuth {
  constructor(
    readonly store: Store,
    private readonly auth: AuthService,
    private readonly verifier: PrivyVerifier,
    private readonly origin: string,
    private readonly now = Date.now,
  ) {
    store.db.exec(
      "CREATE TABLE IF NOT EXISTS wallet_access_challenges (nonce TEXT PRIMARY KEY, record TEXT NOT NULL); CREATE TABLE IF NOT EXISTS wallet_access_sessions (secret_hash TEXT PRIMARY KEY, record TEXT NOT NULL)",
    );
  }
  async proof(request: NextRequest) {
    return privyFor(request, this.verifier);
  }
  async challenge(request: NextRequest, browser: string, walletInput: string) {
    const proof = await this.proof(request),
      wallet = addressSchema.parse(walletInput);
    requireLinkedWallet(proof, wallet);
    const nonce = randomBytes(24).toString("hex"),
      url = new URL(this.origin);
    const sessionExpires = this.now() + SESSION_MS;
    const message = createSiweMessage({
      address: getAddress(wallet),
      chainId: 143,
      domain: url.host,
      scheme: url.protocol.slice(0, -1),
      uri: this.origin,
      version: "1",
      nonce,
      issuedAt: new Date(this.now()),
      expirationTime: new Date(sessionExpires),
      statement:
        "Sign in to Soryn wallet play. No transaction, spending or publication is authorized. New encounters require verified holdings.",
      resources: ["urn:soryn:wallet-play:1"],
    });
    this.store.db
      .prepare(
        "DELETE FROM wallet_access_challenges WHERE json_extract(record,'$.expires') <= ?",
      )
      .run(this.now());
    this.store.db
      .prepare("INSERT INTO wallet_access_challenges VALUES (?,?)")
      .run(
        nonce,
        JSON.stringify({
          browser,
          userId: proof.userId,
          wallet,
          message,
          expires: this.now() + 300_000,
          sessionExpires,
        }),
      );
    return { nonce, message };
  }
  async verify(
    request: NextRequest,
    browser: string,
    nonce: string,
    message: string,
    signature: Hex,
  ) {
    const proof = await this.proof(request);
    const row = this.store.db
      .prepare("SELECT record FROM wallet_access_challenges WHERE nonce=?")
      .get(nonce);
    if (!row) throw new ServiceError(401, "Sign-in expired or already used.");
    const challenge = readStored(challengeSchema, row.record);
    requireLinkedWallet(proof, challenge.wallet);
    this.selected(request, challenge.wallet);
    if (
      challenge.browser !== browser ||
      challenge.userId !== proof.userId ||
      challenge.message !== message ||
      challenge.expires <= this.now()
    )
      throw new ServiceError(401, "Wrong browser, altered or expired sign-in.");
    let valid = false;
    try {
      valid = await verifyMessage({
        address: getAddress(challenge.wallet),
        message,
        signature,
      });
    } catch {
      /* Invalid signatures cannot establish a session. */
    }
    if (!valid) throw new ServiceError(401, "Wallet signature invalid.");
    return this.store.transaction(() => {
      if (
        challenge.expires <= this.now() ||
        !this.store.db
          .prepare("DELETE FROM wallet_access_challenges WHERE nonce=?")
          .run(nonce).changes
      )
        throw new ServiceError(401, "Sign-in expired or already used.");
      const secret = randomBytes(32).toString("hex");
      const actor = new IdentityStore(this.store).account(challenge.wallet);
      this.store.db
        .prepare("INSERT INTO wallet_access_sessions VALUES (?,?)")
        .run(
          secretHash(secret),
          JSON.stringify({
            actor,
            wallet: challenge.wallet,
            userId: proof.userId,
            expires: challenge.sessionExpires,
          }),
        );
      return secret;
    });
  }
  async player(request: NextRequest): Promise<WalletPlayer> {
    const proof = await this.proof(request),
      secret = walletSecret(request);
    const row = this.store.db
      .prepare("SELECT record FROM wallet_access_sessions WHERE secret_hash=?")
      .get(secretHash(secret));
    if (row) {
      const session = readStored(sessionSchema, row.record);
      if (session.expires <= this.now() || session.userId !== proof.userId)
        throw new ServiceError(401, "Wallet session expired. Sign in again.");
      this.selected(request, session.wallet);
      return this.linked(session, proof);
    }
    const session = this.auth.session(secret);
    this.selected(request, session.wallet);
    if (!session.privyUserId || session.privyUserId !== proof.userId)
      throw new ServiceError(401, "Sign in with this Privy account again.");
    return this.linked(
      {
        actor: session.actor,
        wallet: session.wallet,
        userId: session.privyUserId,
      },
      proof,
    );
  }
  private selected(request: NextRequest, wallet: string) {
    const selected = request.headers.get("x-soryn-wallet");
    if (selected && addressSchema.parse(selected) !== wallet)
      throw new ServiceError(
        401,
        "The selected wallet changed. Sign in to that wallet again.",
      );
  }
  private linked(player: WalletPlayer, proof: PrivyIdentity): WalletPlayer {
    requireLinkedWallet(proof, player.wallet);
    return player;
  }
  logout(request: NextRequest) {
    this.auth.logout(walletSecret(request));
    this.store.db
      .prepare("DELETE FROM wallet_access_sessions WHERE secret_hash=?")
      .run(secretHash(walletSecret(request)));
  }
}
export function walletPlay(request: NextRequest) {
  return request.headers.get("x-soryn-play") === "wallet";
}
