import { holderAccessEnabled } from "../access/rollout";
import { readStored } from "../storedRecord";
import {
  accessGrantSchema,
  type AccessGrant,
} from "../../domain/access/policy";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { isLate } from "../../domain/pvp/deadline";
import { identityFor } from "../../domain/identity";
import {
  QUEUE_ACCEPT_MS,
  QUEUE_DECLINE_LIMIT,
  QUEUE_LOCK_MS,
  QUEUE_WAIT_MS,
} from "../../domain/pvp/series";
import { ServiceError } from "../errors";
import type { Store } from "../persistence";
import type { SeatActor } from "../../domain/pvp/actions";
import type { PvpService } from "./service";
import { TokenLocks } from "./locks";

import type { QueueView } from "../../domain/pvp/queue";
export type { QueueView } from "../../domain/pvp/queue";

interface QueueRow {
  actor: string;
  joined_at: number;
  status: string;
  offer_id: string | null;
  accepted: number;
  deadline_at: number | null;
  declines: number;
  locked_until: number;
  room_invite: string | null;
  token_key: string | null;
  token_owner: string | null;
  token_generation: string | null;
  token_encounter: string | null;
  access_grant: string | null;
  cosmetic: number | string | null;
}

/** Fresh ownership binding for an official queue seat. Guests pass nothing. */
export interface QueueToken {
  key: string;
  owner: string;
  generation: string;
}

/** The stamped grant an official queue seat carries into its room. */
export interface QueueGrant {
  key: string;
  owner: string;
  generation: string;
}

const queueRowSchema = z.strictObject({
  actor: z.string(),
  joined_at: z.number(),
  status: z.string(),
  offer_id: z.string().nullable(),
  accepted: z.number(),
  deadline_at: z.number().nullable(),
  declines: z.number(),
  locked_until: z.number(),
  room_invite: z.string().nullable(),
  token_key: z.string().nullable().default(null),
  token_owner: z.string().nullable().default(null),
  token_generation: z.string().nullable().default(null),
  token_encounter: z.string().nullable().default(null),
  access_grant: z.string().nullable().default(null),
  cosmetic: z.union([z.number(), z.string()]).nullable().default(0),
});

function parseQueueRow(value: unknown): QueueRow | null {
  const parsed = queueRowSchema.safeParse(value);
  if (!parsed.success) return null;
  return parsed.data;
}

/**
 * One unranked starter queue in the existing SQLite file.
 * Pairing, acceptance and cancellation commit in one transaction.
 */
export class QueueService {
  constructor(
    private readonly store: Store,
    private readonly matches: PvpService,
    readonly locks: TokenLocks = new TokenLocks(store),
  ) {}
  pollState(actor: string, now: number): QueueView {
    return this.store.transaction(() => {
      this.sweep(now);
      return this.view(this.row(actor), actor, now);
    });
  }
  offerSeats(actor: string): {
    offerId: string;
    seats: { actor: string; access: AccessGrant }[];
  } | null {
    const current = this.row(actor);
    if (!current || current.status !== "offered" || !current.offer_id)
      return null;
    const rows = this.store.db
      .prepare("SELECT actor, access_grant FROM pvp_queue WHERE offer_id=?")
      .all(current.offer_id) as {
      actor: string;
      access_grant: string | null;
    }[];
    const seats: { actor: string; access: AccessGrant }[] = [];
    for (const row of rows) {
      if (!row.access_grant) continue;
      seats.push({
        actor: String(row.actor),
        access: readStored(accessGrantSchema, row.access_grant),
      });
    }
    return { offerId: current.offer_id, seats };
  }
  updateOfferGrant(offerId: string, actor: string, grant: AccessGrant): void {
    const updated = this.store.db
      .prepare(
        "UPDATE pvp_queue SET access_grant=? WHERE actor=? AND offer_id=? AND status='offered'",
      )
      .run(JSON.stringify(grant), actor, offerId);
    if (updated.changes !== 1)
      throw new ServiceError(
        409,
        "The opponent offer changed during verification. Retry.",
      );
  }
  join(
    actor: SeatActor,
    now: number,
    token: QueueToken | null = null,
  ): QueueView {
    return this.store.transaction(() => {
      this.store.rateLimit(`queue:${actor.actor}`, now, 30);
      this.sweep(now);
      const current = this.row(actor.actor);
      if (current?.status === "blocked" && current.locked_until > now)
        throw new ServiceError(
          429,
          "Repeated declines paused matchmaking. Try again when the pause ends.",
        );
      if (
        current &&
        (current.status === "waiting" ||
          current.status === "offered" ||
          current.status === "matched")
      ) {
        if (current.token_key)
          this.locks.refresh(
            current.token_key,
            actor.actor,
            now,
            QUEUE_WAIT_MS,
          );
        return this.view(current, actor.actor, now);
      }
      if (token)
        this.locks.acquire({
          token: token.key,
          encounter: actor.actor,
          kind: "queue",
          owner: token.owner,
          generation: token.generation,
          openedAt: now,
          expiresAt: now + QUEUE_WAIT_MS,
        });
      else if (current?.token_key)
        this.locks.release(current.token_key, actor.actor);
      this.store.db
        .prepare(
          `INSERT INTO pvp_queue
           (actor, joined_at, status, offer_id, accepted, deadline_at, declines, locked_until, room_invite, token_key, token_owner, token_generation, token_encounter, access_grant, cosmetic)
           VALUES (?, ?, 'waiting', NULL, 0, NULL, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(actor) DO UPDATE SET
             joined_at=excluded.joined_at,
             status='waiting',
             offer_id=NULL,
             accepted=0,
             deadline_at=NULL,
             room_invite=NULL,
             token_key=excluded.token_key,
             token_owner=excluded.token_owner,
             token_generation=excluded.token_generation,
             token_encounter=excluded.token_encounter,
             access_grant=excluded.access_grant,
             cosmetic=excluded.cosmetic`,
        )
        .run(
          actor.actor,
          now,
          current?.declines ?? 0,
          current?.locked_until ?? 0,
          token?.key ?? null,
          token?.owner ?? null,
          token?.generation ?? null,
          token ? actor.actor : null,
          actor.access ? JSON.stringify(actor.access) : null,
          actor.cosmetic ? 1 : 0,
        );
      this.pair(now);
      return this.view(this.row(actor.actor), actor.actor, now);
    });
  }
  cancel(actor: string, now: number): QueueView {
    return this.store.transaction(() => {
      this.sweep(now);
      const current = this.row(actor);
      if (!current || current.status === "blocked" || current.status === "out")
        return this.view(current, actor, now);
      if (current.status === "matched")
        throw new ServiceError(409, "Leave the battle from the match itself.");
      if (current.status === "offered") return this.declineRow(current, now);
      if (current.token_key) this.locks.release(current.token_key, actor);
      this.store.db.prepare("DELETE FROM pvp_queue WHERE actor=?").run(actor);
      return this.view(null, actor, now);
    });
  }
  accept(
    actor: string,
    now: number,
    expectedOfferId: string | null = null,
  ): QueueView {
    return this.store.transaction(() => {
      this.sweep(now);
      const current = this.row(actor);
      if (current?.token_key)
        this.locks.refresh(current.token_key, actor, now, QUEUE_WAIT_MS);
      if (!current || current.status !== "offered" || !current.offer_id)
        throw new ServiceError(409, "There is no opponent offer to accept.");
      if (expectedOfferId !== null && current.offer_id !== expectedOfferId)
        throw new ServiceError(
          409,
          "The opponent offer changed during verification. Retry.",
        );
      if (current.deadline_at !== null && isLate(now, current.deadline_at))
        throw new ServiceError(409, "That offer expired.");
      this.store.db
        .prepare("UPDATE pvp_queue SET accepted=1 WHERE actor=?")
        .run(actor);
      this.seal(current.offer_id, now);
      return this.view(this.row(actor), actor, now);
    });
  }
  decline(actor: string, now: number): QueueView {
    return this.store.transaction(() => {
      this.sweep(now);
      const current = this.row(actor);
      if (!current || current.status !== "offered")
        throw new ServiceError(409, "There is no opponent offer to decline.");
      return this.declineRow(current, now);
    });
  }
  private declineRow(current: QueueRow, now: number): QueueView {
    const offer = current.offer_id;
    const peers = offer
      ? (this.store.db
          .prepare("SELECT * FROM pvp_queue WHERE offer_id=? AND actor<>?")
          .all(offer, current.actor) as unknown as QueueRow[])
      : [];
    this.penalize(current, now);
    for (const peer of peers) this.restore(peer);
    this.pair(now);
    return this.view(this.row(current.actor), current.actor, now);
  }
  private seal(offerId: string, now: number) {
    const seats = this.store.db
      .prepare(
        "SELECT * FROM pvp_queue WHERE offer_id=? ORDER BY joined_at ASC, actor ASC",
      )
      .all(offerId) as unknown as QueueRow[];
    if (seats.length !== 2 || seats.some((seat) => !seat.accepted)) return;
    if (seats[0].room_invite) return;
    const grants = [this.grantFor(seats[0]), this.grantFor(seats[1])];
    // Hand the token reservations over to the room: the room stamps its own
    // series locks when the seats open, so the queue-encounter locks are
    // released first. One transaction, so a failed seal rolls both back.
    for (const seat of seats)
      if (seat.token_key) this.locks.release(seat.token_key, seat.actor);
    const room = this.matches.openMatched(
      {
        actor: seats[0].actor,
        mode: grants[0] ? "official" : "guest",
        ...(seats[0].access_grant
          ? {
              access: readStored(accessGrantSchema, seats[0].access_grant),
            }
          : {}),
        ...(seats[0].cosmetic === 1 || seats[0].cosmetic === "1"
          ? { cosmetic: true }
          : {}),
      },
      {
        actor: seats[1].actor,
        mode: grants[1] ? "official" : "guest",
        ...(seats[1].access_grant
          ? {
              access: readStored(accessGrantSchema, seats[1].access_grant),
            }
          : {}),
        ...(seats[1].cosmetic === 1 || seats[1].cosmetic === "1"
          ? { cosmetic: true }
          : {}),
      },
      now,
      { left: grants[0], right: grants[1] },
    );
    this.store.db
      .prepare(
        `UPDATE pvp_queue
         SET status='matched', room_invite=?, offer_id=NULL, deadline_at=NULL
         WHERE offer_id=?`,
      )
      .run(room.invite, offerId);
  }
  /** The stamped identity an official queue seat carries into its room. */
  assertToken(actor: string, token: QueueToken | null) {
    const row = this.row(actor);
    if (!row || !["waiting", "offered", "matched"].includes(row.status)) return;
    if (
      row.token_key &&
      (!token ||
        row.token_key !== token.key ||
        row.token_owner !== token.owner ||
        row.token_generation !== token.generation)
    )
      throw new ServiceError(
        409,
        "This queue entry belongs to another selected Chog. Resume or cancel it with its verified token.",
      );
    if (!row.token_key && token)
      throw new ServiceError(
        409,
        "Finish your guest queue entry before entering as a Chog.",
      );
  }
  private grantFor(row: QueueRow) {
    if (!row.token_key || !row.token_owner || !row.token_generation)
      return null;
    const key = row.token_key;
    const tokenId = key.slice(key.lastIndexOf(":") + 1);
    const identity = identityFor(tokenId);
    if (
      key !== `${identity.chainId}:${identity.collection}:${identity.tokenId}`
    )
      throw new ServiceError(503, "Stored queue identity is unavailable.");
    return {
      identity,
      owner: row.token_owner,
      generation: row.token_generation,
    };
  }
  private pair(now: number) {
    const waiting = this.store.db
      .prepare(
        `SELECT actor FROM pvp_queue
         WHERE status='waiting'
         ORDER BY joined_at ASC, actor ASC`,
      )
      .all() as { actor: string }[];
    if (waiting.length < 2) return;
    const offer = randomUUID();
    const deadline = now + QUEUE_ACCEPT_MS;
    for (const seat of waiting.slice(0, 2)) {
      this.store.db
        .prepare(
          `UPDATE pvp_queue
           SET status='offered', offer_id=?, accepted=0, deadline_at=?, room_invite=NULL
           WHERE actor=? AND status='waiting'`,
        )
        .run(offer, deadline, seat.actor);
    }
  }
  private sweep(now: number) {
    if (holderAccessEnabled()) {
      // Waiting legacy guests are not started encounters; preserve matched rooms.
      this.store.db
        .prepare(
          "DELETE FROM pvp_queue WHERE status IN ('waiting','offered') AND token_key IS NULL AND access_grant IS NULL",
        )
        .run();
      this.store.db
        .prepare(
          "UPDATE pvp_queue SET status='waiting',offer_id=NULL,accepted=0,deadline_at=NULL WHERE status='offered' AND offer_id IN (SELECT offer_id FROM pvp_queue WHERE status='offered' GROUP BY offer_id HAVING COUNT(*)=1)",
        )
        .run();
    }
    this.locks.purge(now);
    const stale = this.store.db
      .prepare(
        `SELECT * FROM pvp_queue
         WHERE status='offered' AND deadline_at IS NOT NULL AND deadline_at <= ?`,
      )
      .all(now) as unknown as QueueRow[];
    const groups = new Map<string, QueueRow[]>();
    for (const row of stale) {
      const key = row.offer_id ?? row.actor;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    for (const group of groups.values()) {
      const accepted = group.filter((row) => row.accepted);
      if (accepted.length === group.length && group.length === 2) {
        this.seal(group[0].offer_id ?? "", now);
        continue;
      }
      for (const row of group) {
        if (row.accepted) this.restore(row);
        else this.penalize(row, now);
      }
    }
    const expired = this.store.db
      .prepare(
        "SELECT actor, token_key FROM pvp_queue WHERE status='waiting' AND joined_at <= ?",
      )
      .all(now - QUEUE_WAIT_MS) as {
      actor: string;
      token_key: string | null;
    }[];
    for (const row of expired)
      if (row.token_key) this.locks.release(row.token_key, row.actor);
    this.store.db
      .prepare(
        "DELETE FROM pvp_queue WHERE status='waiting' AND joined_at <= ?",
      )
      .run(now - QUEUE_WAIT_MS);
    const matched = this.store.db
      .prepare(
        "SELECT actor, room_invite, token_key FROM pvp_queue WHERE status='matched'",
      )
      .all() as {
      actor: string;
      room_invite: string | null;
      token_key: string | null;
    }[];
    for (const row of matched) {
      if (
        !row.room_invite ||
        this.matches.publicProgress(row.room_invite, now) !== "open"
      ) {
        if (row.token_key) this.locks.release(row.token_key, row.actor);
        this.store.db
          .prepare("DELETE FROM pvp_queue WHERE actor=?")
          .run(row.actor);
      }
    }
  }
  private restore(row: QueueRow) {
    this.store.db
      .prepare(
        `UPDATE pvp_queue
         SET status='waiting', offer_id=NULL, accepted=0, deadline_at=NULL, room_invite=NULL
         WHERE actor=?`,
      )
      .run(row.actor);
  }
  private penalize(row: QueueRow, now: number) {
    const declines = row.declines + 1;
    this.store.db
      .prepare(
        `UPDATE pvp_queue
         SET status=?, declines=?, locked_until=?, offer_id=NULL,
             accepted=0, deadline_at=NULL, room_invite=NULL
         WHERE actor=?`,
      )
      .run(
        declines >= QUEUE_DECLINE_LIMIT ? "blocked" : "out",
        declines,
        declines >= QUEUE_DECLINE_LIMIT
          ? now + QUEUE_LOCK_MS
          : row.locked_until,
        row.actor,
      );
  }
  private row(actor: string) {
    return (
      parseQueueRow(
        this.store.db
          .prepare("SELECT * FROM pvp_queue WHERE actor=?")
          .get(actor),
      ) ?? null
    );
  }
  private view(row: QueueRow | null, actor: string, now: number): QueueView {
    const others = Number(
      (
        this.store.db
          .prepare(
            "SELECT COUNT(*) AS count FROM pvp_queue WHERE status='waiting' AND actor<>?",
          )
          .get(actor) as { count: number }
      ).count,
    );
    if (
      !row ||
      row.status === "out" ||
      (row.status === "blocked" && row.locked_until <= now)
    )
      return {
        status: "idle",
        othersWaiting: others,
        accepted: false,
        deadlineAt: null,
        serverNow: now,
        invite: null,
        lockedUntil: null,
        message:
          "Find a match when you are ready. Practice and Story stay open.",
      };
    if (row.status === "blocked")
      return {
        status: "blocked",
        othersWaiting: others,
        accepted: false,
        deadlineAt: null,
        serverNow: now,
        invite: null,
        lockedUntil: row.locked_until,
        message: "Matchmaking is paused after repeated declines.",
      };
    if (row.status === "offered")
      return {
        status: "offered",
        othersWaiting: others,
        accepted: row.accepted === 1,
        deadlineAt: row.deadline_at,
        serverNow: now,
        invite: null,
        lockedUntil: null,
        message: row.accepted
          ? "Waiting for your opponent to accept."
          : "An opponent is available. Accept to choose fighters.",
      };
    if (row.status === "matched" && row.room_invite)
      return {
        status: "matched",
        othersWaiting: others,
        accepted: true,
        deadlineAt: null,
        serverNow: now,
        invite: row.room_invite,
        lockedUntil: null,
        message: "Opponent found. Choose a starter and ready up.",
      };
    return {
      status: "waiting",
      othersWaiting: others,
      accepted: false,
      deadlineAt: null,
      serverNow: now,
      invite: null,
      lockedUntil: null,
      message:
        others > 0
          ? "Waiting for the next open opponent."
          : "Nobody else is waiting. Practice or Story can start now.",
    };
  }
}
