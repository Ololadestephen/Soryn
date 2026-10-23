import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  addressSchema,
  identitySchema,
  ownershipSchema,
  tokenKey,
  type Ownership,
  type TokenIdentity,
} from "../../domain/identity";
import { scenarioSchema, actionSchema } from "../../domain/game/contracts";
import { Store } from "../persistence";
import { profileSchema } from "../adventure/persistence";
import { ServiceError } from "../errors";
import { readStored } from "../storedRecord";
import type { PublicChapter } from "../../domain/officialViews";
export type { PublicChapter } from "../../domain/officialViews";

export const challengeSchema = z.strictObject({
  privyUserId: z.string().nullable().default(null),
  nonce: z.string(),
  browser: z.uuid(),
  wallet: addressSchema,
  message: z.string(),
  identity: identitySchema,
  generation: z.uuid(),
  expires: z.number(),
  sessionExpires: z.number(),
});
export type Challenge = z.infer<typeof challengeSchema>;
export const walletSessionSchema = z.strictObject({
  privyUserId: z.string().nullable().default(null),
  actor: z.uuid(),
  wallet: addressSchema,
  identity: identitySchema,
  generation: z.uuid().nullable(),
  expires: z.number(),
  revoked: z.boolean(),
});
export type WalletSession = z.infer<typeof walletSessionSchema>;
export const chapterSchema = z.strictObject({
  id: z.uuid(),
  runId: z.uuid(),
  identity: identitySchema,
  title: z.string(),
  alias: z.string(),
  scenario: scenarioSchema,
  actions: z.array(actionSchema),
  ghost: z.strictObject({
    version: z.string().length(64),
    profile: profileSchema,
  }),
  publishedAt: z.number(),
  status: z.enum(["published", "withdrawn"]),
});
export type ChapterRecord = z.infer<typeof chapterSchema>;

export class IdentityStore {
  constructor(readonly store: Store) {}
  ownership(identity: TokenIdentity): Ownership | null {
    const row = this.store.db
      .prepare("SELECT record FROM token_ownership WHERE identity=?")
      .get(tokenKey(identity));
    return row ? readStored(ownershipSchema, row.record) : null;
  }
  saveOwnership(record: Ownership): void {
    this.store.db
      .prepare(
        "INSERT INTO token_ownership VALUES (?, ?) ON CONFLICT(identity) DO UPDATE SET record=excluded.record",
      )
      .run(
        tokenKey(record.identity),
        JSON.stringify(ownershipSchema.parse(record)),
      );
  }
  revoke(identity: TokenIdentity): void {
    this.store.db
      .prepare(
        "UPDATE wallet_sessions SET record=json_set(record, '$.revoked', json('true')) WHERE token=?",
      )
      .run(tokenKey(identity));
  }
  account(wallet: string): string {
    this.store.db
      .prepare("INSERT OR IGNORE INTO wallet_accounts VALUES (?, ?)")
      .run(wallet, randomUUID());
    return String(
      this.store.db
        .prepare("SELECT actor FROM wallet_accounts WHERE wallet=?")
        .get(wallet)?.actor,
    );
  }
  saveChallenge(challenge: Challenge, now = Date.now()): void {
    this.store.db
      .prepare(
        "DELETE FROM auth_challenges WHERE json_extract(record, '$.expires') < ?",
      )
      .run(now);
    this.store.db
      .prepare("INSERT INTO auth_challenges VALUES (?, ?)")
      .run(challenge.nonce, JSON.stringify(challengeSchema.parse(challenge)));
  }
  challenge(nonce: string): Challenge {
    const row = this.store.db
      .prepare("SELECT record FROM auth_challenges WHERE nonce=?")
      .get(nonce);
    if (!row)
      throw new ServiceError(401, "Sign-in challenge expired or already used.");
    return readStored(challengeSchema, row.record);
  }
  consume(nonce: string): void {
    if (
      !this.store.db
        .prepare("DELETE FROM auth_challenges WHERE nonce=?")
        .run(nonce).changes
    )
      throw new ServiceError(401, "Sign-in challenge already used.");
  }
  saveSession(hash: string, session: WalletSession): void {
    this.store.db
      .prepare("INSERT INTO wallet_sessions VALUES (?, ?, ?)")
      .run(
        hash,
        tokenKey(session.identity),
        JSON.stringify(walletSessionSchema.parse(session)),
      );
  }
  session(hash: string): WalletSession {
    const row = this.store.db
      .prepare("SELECT record FROM wallet_sessions WHERE secret_hash=?")
      .get(hash);
    if (!row)
      throw new ServiceError(401, "Connect and sign in to your wallet.");
    return readStored(walletSessionSchema, row.record);
  }
  logout(hash: string): void {
    this.store.db
      .prepare("DELETE FROM wallet_sessions WHERE secret_hash=?")
      .run(hash);
  }
  publication(runId: string): ChapterRecord | null {
    const row = this.store.db
      .prepare("SELECT record FROM token_chapters WHERE run_id=?")
      .get(runId);
    return row ? readStored(chapterSchema, row.record) : null;
  }
  publish(chapter: ChapterRecord, actor: string): void {
    this.store.db
      .prepare("INSERT INTO token_chapters VALUES (?, ?, ?, ?, ?)")
      .run(
        chapter.id,
        chapter.runId,
        tokenKey(chapter.identity),
        actor,
        JSON.stringify(chapterSchema.parse(chapter)),
      );
  }
  withdraw(runId: string, actor: string): void {
    this.store.db
      .prepare(
        "UPDATE token_chapters SET record=json_set(record, '$.status', 'withdrawn') WHERE run_id=? AND actor=?",
      )
      .run(runId, actor);
  }
  withdrawals(actor: string) {
    return this.store.db
      .prepare(
        "SELECT record FROM token_chapters WHERE actor=? AND json_extract(record, '$.status')='published' ORDER BY rowid DESC LIMIT 100",
      )
      .all(actor)
      .map((row) => {
        const chapter = readStored(chapterSchema, row.record);
        return {
          runId: chapter.runId,
          title: chapter.title,
          identity: chapter.identity,
        };
      });
  }
  chapters(identity: TokenIdentity): PublicChapter[] {
    return this.store.db
      .prepare(
        "SELECT record FROM token_chapters WHERE token=? AND json_extract(record, '$.status')='published' ORDER BY rowid DESC LIMIT 100",
      )
      .all(tokenKey(identity))
      .map((row) => {
        const chapter = readStored(chapterSchema, row.record);
        return {
          id: chapter.id,
          identity: chapter.identity,
          title: chapter.title,
          alias: chapter.alias,
          scenario: chapter.scenario,
          actions: chapter.actions,
          ghost: chapter.ghost,
          publishedAt: chapter.publishedAt,
          status: chapter.status,
        };
      });
  }
}
