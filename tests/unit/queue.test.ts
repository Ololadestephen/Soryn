import { describe, expect, it } from "vitest";
import {
  QUEUE_ACCEPT_MS,
  QUEUE_LOCK_MS,
  QUEUE_WAIT_MS,
} from "../../src/domain/pvp/series";
import { PVP_TIMERS } from "../../src/domain/pvp/timers";
import { Store } from "../../src/server/persistence";
import { PvpStore } from "../../src/server/pvp/persistence";
import { QueueService } from "../../src/server/pvp/queue";
import { PvpService } from "../../src/server/pvp/service";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const NOW = 1_700_000_000_000;

function queue() {
  const store = new Store(":memory:");
  const matches = new PvpService(new PvpStore(store), PVP_TIMERS);
  return { store, queue: new QueueService(store, matches), matches };
}

describe("public starter queue", () => {
  it("pairs two different guests and keeps one seat for duplicate joins", () => {
    const { store, queue: rows, matches } = queue();
    const alone = rows.join({ actor: A, mode: "guest" }, NOW);
    expect(alone.status).toBe("waiting");
    expect(alone.invite).toBeNull();
    expect(alone.message).toMatch(/Nobody else/);
    expect(rows.join({ actor: A, mode: "guest" }, NOW + 5).status).toBe(
      "waiting",
    );
    const found = rows.join({ actor: B, mode: "guest" }, NOW + 10);
    expect(found.status).toBe("offered");
    expect(found.invite).toBeNull();
    expect(JSON.stringify(found)).not.toContain(A);
    const accepted = rows.accept(A, NOW + 11);
    expect(accepted.invite).toBeNull();
    expect(accepted.accepted).toBe(true);
    const matched = rows.accept(B, NOW + 12);
    expect(matched.status).toBe("matched");
    expect(matched.invite).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    const again = rows.state(A, NOW + 13);
    expect(again.invite).toBe(matched.invite);
    const count = store.db
      .prepare("SELECT COUNT(*) AS count FROM pvp_rooms")
      .get() as { count: number };
    expect(count.count).toBe(1);
    const room = matches.records.byInvite(matched.invite!);
    expect(room.roster).toBe("starters");
    expect(room.series?.phase).toBe("setup");
    expect(room.seats.a?.actor).not.toBe(room.seats.b?.actor);
    store.close();
  });

  it("returns the accepter to the original queue time and pauses repeated declines", () => {
    const { store, queue: rows } = queue();
    rows.join({ actor: A, mode: "guest" }, NOW);
    rows.join({ actor: B, mode: "guest" }, NOW + 10);
    rows.accept(A, NOW + 11);
    rows.decline(B, NOW + 12);
    const restored = store.db
      .prepare("SELECT joined_at, status FROM pvp_queue WHERE actor=?")
      .get(A) as { joined_at: number; status: string };
    expect(restored).toEqual({ joined_at: NOW, status: "waiting" });
    rows.join({ actor: B, mode: "guest" }, NOW + 20);
    rows.decline(B, NOW + 21);
    rows.join({ actor: B, mode: "guest" }, NOW + 30);
    rows.decline(B, NOW + 31);
    expect(() => rows.join({ actor: B, mode: "guest" }, NOW + 32)).toThrow(
      /paused/,
    );
    const blocked = rows.state(B, NOW + 32);
    expect(blocked.status).toBe("blocked");
    expect(blocked.lockedUntil).toBe(NOW + 31 + QUEUE_LOCK_MS);
    store.close();
  });

  it("expires an unanswered offer and an abandoned queue entry", () => {
    const { store, queue: rows } = queue();
    rows.join({ actor: A, mode: "guest" }, NOW);
    rows.join({ actor: B, mode: "guest" }, NOW + 1);
    rows.accept(A, NOW + 2);
    const expired = rows.state(A, NOW + 2 + QUEUE_ACCEPT_MS);
    expect(expired.status).toBe("waiting");
    expect(rows.state(B, NOW + 2 + QUEUE_ACCEPT_MS).status).not.toBe("offered");
    rows.join({ actor: B, mode: "guest" }, NOW);
    const left = rows.state(B, NOW + QUEUE_WAIT_MS + 1);
    expect(left.status).toBe("idle");
    store.close();
  });

  it("cancels one waiting player without dropping the other", () => {
    const { store, queue: rows } = queue();
    rows.join({ actor: A, mode: "guest" }, NOW);
    rows.join({ actor: B, mode: "guest" }, NOW + 1);
    expect(rows.cancel(A, NOW + 2).status).toBe("idle");
    expect(rows.state(B, NOW + 2).status).toBe("waiting");
    expect(rows.cancel(A, NOW + 3).status).toBe("idle");
    store.close();
  });
});
