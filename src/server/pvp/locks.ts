import { z } from "zod";
import { ServiceError } from "../errors";
import type { Store } from "../persistence";
import { readStored } from "../storedRecord";

export const tokenLockSchema = z.strictObject({
  /** chain:collection:tokenId — the competitor, never a wallet or session. */
  token: z.string().min(1).max(160),
  /** Resumable handle of the holding encounter: room invite, queue id, or battle id. */
  encounter: z.string().min(1).max(160),
  kind: z.enum(["series", "queue", "story"]),
  owner: z.string().min(1).max(64),
  generation: z.string().min(1).max(128),
  openedAt: z.number().int(),
  expiresAt: z.number().int(),
});
export type TokenLock = z.infer<typeof tokenLockSchema>;

/**
 * One active official encounter per token, enforced by a UNIQUE database
 * constraint — not an in-memory flag. Rows survive process restarts and are
 * bounded by expiry; every release verifies the owning encounter so an old
 * request cannot release a newer lock.
 */
export class TokenLocks {
  constructor(private readonly store: Store) {}
  acquire(lock: TokenLock): void {
    const record = tokenLockSchema.parse(lock);
    this.store.db
      .prepare("DELETE FROM token_locks WHERE expires_at <= ?")
      .run(record.openedAt);
    try {
      this.store.db
        .prepare(
          `INSERT INTO token_locks
           (token, encounter, kind, owner, generation, opened_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          record.token,
          record.encounter,
          record.kind,
          record.owner,
          record.generation,
          record.openedAt,
          record.expiresAt,
        );
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("errcode" in error) ||
        (Number(error.errcode) & 0xff) !== 19
      )
        throw error;
      const holding = this.get(record.token, record.openedAt);
      throw new ServiceError(
        409,
        holding
          ? `This token is already in an official ${holding.kind} (${holding.encounter}). Resume that encounter before opening another.`
          : "This token is already in an official encounter. Resume it before opening another.",
      );
    }
  }
  /**
   * Acquire when free, retain the original expiry for the same encounter,
   * and fail 409 when a different encounter holds it. Rejoins and resumes
   * use this so they never conflict with themselves.
   */
  ensure(lock: TokenLock): void {
    const record = tokenLockSchema.parse(lock);
    const held = this.get(record.token, record.openedAt);
    if (!held) return this.acquire(record);
    if (held.encounter !== record.encounter) return this.acquire(record);
    if (
      held.owner !== record.owner ||
      held.generation !== record.generation ||
      held.kind !== record.kind
    )
      throw new ServiceError(
        409,
        "This encounter belongs to a different ownership generation.",
      );
  }
  /** Release only when the caller names the owning encounter. */
  release(token: string, encounter: string): boolean {
    return (
      Number(
        this.store.db
          .prepare("DELETE FROM token_locks WHERE token=? AND encounter=?")
          .run(token, encounter).changes,
      ) > 0
    );
  }
  /** Additive migration of a legacy room-invite reservation to its series id. */
  rekey(token: string, previous: string, next: string): void {
    this.store.db
      .prepare(
        "UPDATE token_locks SET encounter=? WHERE token=? AND encounter=?",
      )
      .run(next, token, previous);
  }
  /** Release every lock held by one encounter (room close, purge, void). */
  releaseEncounter(encounter: string): number {
    return Number(
      this.store.db
        .prepare("DELETE FROM token_locks WHERE encounter=?")
        .run(encounter).changes,
    );
  }
  refresh(token: string, encounter: string, now: number, ttlMs: number): void {
    this.store.db
      .prepare(
        "UPDATE token_locks SET expires_at=? WHERE token=? AND encounter=?",
      )
      .run(now + ttlMs, token, encounter);
  }
  get(token: string, now: number): TokenLock | null {
    const row = this.store.db
      .prepare("SELECT * FROM token_locks WHERE token=? AND expires_at>?")
      .get(token, now) as
      | {
          token: string;
          encounter: string;
          kind: string;
          owner: string;
          generation: string;
          opened_at: number;
          expires_at: number;
        }
      | undefined;
    if (!row) return null;
    return readStored(
      tokenLockSchema,
      JSON.stringify({
        token: row.token,
        encounter: row.encounter,
        kind: row.kind,
        owner: row.owner,
        generation: row.generation,
        openedAt: row.opened_at,
        expiresAt: row.expires_at,
      }),
    );
  }
  purge(now: number): number {
    return Number(
      this.store.db
        .prepare("DELETE FROM token_locks WHERE expires_at <= ?")
        .run(now).changes,
    );
  }
}
