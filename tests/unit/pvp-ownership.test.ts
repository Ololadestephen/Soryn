import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  identityFor,
  tokenKey,
  tokenStoryActor,
} from "../../src/domain/identity";
import { tokenActorUuid } from "../../src/server/tokenActors";
import { PVP_TIMERS } from "../../src/domain/pvp/timers";
import {
  OWNERSHIP_STALL_TERMINATE_MS,
  TOKEN_LOCK_TTL_MS,
  closeRoomForTransfer,
  endSeriesNoContest,
  hasOfficialSeats,
  verifiableSeats,
} from "../../src/domain/pvp/ownership";
import type { PvpRoom } from "../../src/domain/pvp/types";
import { ServiceError } from "../../src/server/errors";
import { Store } from "../../src/server/persistence";
import { PvpStore } from "../../src/server/pvp/persistence";
import {
  PvpService,
  type SeatOwnershipChange,
} from "../../src/server/pvp/service";
import { TokenLocks } from "../../src/server/pvp/locks";
import { QueueService } from "../../src/server/pvp/queue";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const NOW = 1_700_000_000_000;
const OWNER_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OWNER_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const GEN1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GEN2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TOKEN = tokenKey(identityFor("276"));
const GRANT_A = {
  identity: identityFor("276"),
  owner: OWNER_A,
  generation: GEN1,
};
const GRANT_B = {
  identity: identityFor("276"),
  owner: OWNER_B,
  generation: GEN2,
};
const TIMERS = {
  ...PVP_TIMERS,
  moveMs: 1000,
  loadingMs: 1000,
  intermissionMs: 2000,
};

function checkStub(
  changes: SeatOwnershipChange[] = [],
  calls: { count: number } = { count: 0 },
  error: unknown = null,
) {
  return {
    calls,
    checkSeats: async () => {
      calls.count += 1;
      if (error) throw error;
      return changes;
    },
  };
}

function serviceWith(
  stub: ReturnType<typeof checkStub> = checkStub(),
  store = new Store(":memory:"),
) {
  const service = new PvpService(
    new PvpStore(store),
    TIMERS,
    undefined,
    undefined,
    undefined,
    stub.checkSeats,
  );
  return { service, store, stub };
}

async function openOfficialBattle(
  service: PvpService,
  now: number,
): Promise<string> {
  const created = service.create({ actor: A, mode: "official" }, now, GRANT_A);
  service.join({ actor: B, mode: "guest" }, created.invite, now);
  service.select(A, created.invite, "pip", now, GRANT_A);
  service.select(B, created.invite, "bolt", now);
  await service.confirmReady(A, created.invite, true, now, GRANT_A);
  await service.confirmReady(B, created.invite, true, now);
  service.assets(A, created.invite, now);
  service.assets(B, created.invite, now);
  return created.invite;
}

async function openOfficialBattleBoth(
  service: PvpService,
  now: number,
): Promise<string> {
  const created = service.create({ actor: A, mode: "official" }, now, GRANT_A);
  service.join({ actor: B, mode: "official" }, created.invite, now, GRANT_A);
  service.select(A, created.invite, "pip", now, GRANT_A);
  service.select(B, created.invite, "bolt", now, GRANT_A);
  await service.confirmReady(A, created.invite, true, now, GRANT_A);
  await service.confirmReady(B, created.invite, true, now, GRANT_A);
  service.assets(A, created.invite, now);
  service.assets(B, created.invite, now);
  return created.invite;
}

function finishBattle(service: PvpService, invite: string, now: number) {
  let t = now;
  for (let n = 0; n < 60; n += 1) {
    const room = service.records.byInvite(invite);
    if (!room.match || room.match.phase === "complete") return room;
    if (room.match.phase !== "choose") {
      t = room.match.deadlineAt + 1;
      service.pollRoom(A, invite, t);
      continue;
    }
    const round = room.match.state.round;
    service.move(A, invite, round, "basic", t);
    service.move(B, invite, round, "basic", t);
  }
  throw new Error("Battle did not finish");
}

describe("no-contest domain rules", () => {
  it("voids an open series, discards the live battle, keeps completed history", async () => {
    const { service } = serviceWith();
    const invite = await openOfficialBattle(service, NOW);
    const before = service.records.byInvite(invite);
    expect(before.series?.phase).toBe("battle");
    endSeriesNoContest(before, NOW, {
      kind: "no-contest",
      changedSeat: "a",
      observedOwner: OWNER_B,
      observedGeneration: GEN2,
      explanation: "Ownership changed.",
    });
    expect(before.match).toBeNull();
    expect(before.series?.phase).toBe("complete");
    expect(before.series?.outcome).toMatchObject({
      kind: "no-contest",
      winner: null,
    });
    expect(before.ownershipStallSince).toBeNull();
  });

  it("archives a completed battle when voiding at intermission", async () => {
    const { service } = serviceWith();
    const invite = await openOfficialBattle(service, NOW);
    finishBattle(service, invite, NOW);
    const intermission = service.records.byInvite(invite);
    expect(intermission.series?.phase).toBe("intermission");
    expect(intermission.match?.phase).toBe("complete");
    const voided = service.voidOnTransfer(invite, NOW, [
      { seat: "a", token: TOKEN, owner: OWNER_B, generation: GEN2 },
    ]);
    expect(voided.series?.outcome).toMatchObject({
      kind: "no-contest",
      winner: null,
    });
    expect(voided.match).toBeNull();
    expect(voided.completed.length).toBe(1);
    expect(voided.completed[0].result).toBeTruthy();
    expect(voided.series?.wins).toMatchObject({ a: 1, b: 0 });
  });

  it("closes a setup room instead of scoring a no contest", () => {
    const { service } = serviceWith();
    const created = service.create(
      { actor: A, mode: "official" },
      NOW,
      GRANT_A,
    );
    const room = service.records.byInvite(created.invite);
    closeRoomForTransfer(
      room,
      NOW,
      "Ownership changed before the first battle.",
    );
    expect(room.closedAt).toBe(NOW);
    expect(room.match).toBeNull();
    expect(room.series?.phase).toBe("setup");
    expect(room.seats.a?.notice).toContain("Ownership changed");
  });

  it("marks outage terminations abandoned, never no-contest", async () => {
    const { service } = serviceWith();
    const invite = await openOfficialBattle(service, NOW);
    const room = service.records.byInvite(invite);
    endSeriesNoContest(room, NOW, {
      kind: "unavailable",
      changedSeat: null,
      observedOwner: null,
      observedGeneration: null,
      explanation: "Verification stayed unavailable past its bound.",
    });
    expect(room.series?.outcome).toMatchObject({
      kind: "abandoned",
      winner: null,
    });
  });

  it("closeRoomForTransfer is idempotent on closed rooms", () => {
    const { service } = serviceWith();
    const created = service.create(
      { actor: A, mode: "official" },
      NOW,
      GRANT_A,
    );
    const room = service.records.byInvite(created.invite);
    closeRoomForTransfer(room, NOW, "First.");
    const revision = room.revision;
    closeRoomForTransfer(room, NOW + 1, "Second.");
    expect(room.revision).toBe(revision);
  });

  it("verifiableSeats only lists stamped official seats", () => {
    const { service } = serviceWith();
    const created = service.create(
      { actor: A, mode: "official" },
      NOW,
      GRANT_A,
    );
    service.join({ actor: B, mode: "guest" }, created.invite, NOW);
    const room = service.records.byInvite(created.invite);
    expect(hasOfficialSeats(room)).toBe(true);
    expect(verifiableSeats(room)).toEqual(["a"]);
  });

  it("bounds stalls and locks with documented constants", () => {
    expect(OWNERSHIP_STALL_TERMINATE_MS).toBe(3_600_000);
    expect(TOKEN_LOCK_TTL_MS).toBe(24 * 3_600_000);
  });
});
describe("token actor derivation", () => {
  it("derives a stable UUID actor per token, distinct from guest ids", () => {
    const first = tokenActorUuid(identityFor("276"));
    expect(first).toBe(tokenActorUuid(identityFor("276")));
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(tokenActorUuid(identityFor("277"))).not.toBe(first);
    expect(tokenStoryActor(identityFor("276"))).toBe(`token:${TOKEN}`);
  });
});

describe("token locks", () => {
  it("acquires, refreshes, releases by owning encounter, and purges", () => {
    const store = new Store(":memory:");
    try {
      const locks = new TokenLocks(store);
      const lock = {
        token: TOKEN,
        encounter: "invite-one",
        kind: "series" as const,
        owner: OWNER_A,
        generation: GEN1,
        openedAt: NOW,
        expiresAt: NOW + TOKEN_LOCK_TTL_MS,
      };
      locks.acquire(lock);
      expect(locks.get(TOKEN, NOW)?.encounter).toBe("invite-one");
      expect(locks.release(TOKEN, "invite-other")).toBe(false);
      expect(locks.get(TOKEN, NOW)?.encounter).toBe("invite-one");
      locks.refresh(TOKEN, "invite-one", NOW + 10, TOKEN_LOCK_TTL_MS);
      expect(locks.get(TOKEN, NOW + 10)?.expiresAt).toBe(
        NOW + 10 + TOKEN_LOCK_TTL_MS,
      );
      locks.ensure({ ...lock, openedAt: NOW + 10, expiresAt: NOW + 10 + 1000 });
      expect(locks.get(TOKEN, NOW + 10)?.encounter).toBe("invite-one");
      expect(locks.release(TOKEN, "invite-one")).toBe(true);
      expect(locks.get(TOKEN, NOW)).toBeNull();
      expect(locks.releaseEncounter("invite-one")).toBe(0);
    } finally {
      store.close();
    }
  });

  it("rejects a second encounter with the holding encounter for resume", () => {
    const store = new Store(":memory:");
    try {
      const locks = new TokenLocks(store);
      locks.acquire({
        token: TOKEN,
        encounter: "invite-one",
        kind: "series",
        owner: OWNER_A,
        generation: GEN1,
        openedAt: NOW,
        expiresAt: NOW + TOKEN_LOCK_TTL_MS,
      });
      expect(() =>
        locks.acquire({
          token: TOKEN,
          encounter: "invite-two",
          kind: "story",
          owner: OWNER_A,
          generation: GEN1,
          openedAt: NOW,
          expiresAt: NOW + 1000,
        }),
      ).toThrow(/invite-one/);
      expect(locks.releaseEncounter("invite-one")).toBe(1);
      locks.acquire({
        token: TOKEN,
        encounter: "invite-two",
        kind: "story",
        owner: OWNER_A,
        generation: GEN1,
        openedAt: NOW,
        expiresAt: NOW + 1000,
      });
      expect(locks.get(TOKEN, NOW)?.encounter).toBe("invite-two");
    } finally {
      store.close();
    }
  });

  it("lets expired locks go and survives process restarts", () => {
    const directory = mkdtempSync(join(tmpdir(), "chog-locks-"));
    const path = join(directory, "locks.sqlite");
    const first = new Store(path);
    try {
      new TokenLocks(first).acquire({
        token: TOKEN,
        encounter: "invite-one",
        kind: "series",
        owner: OWNER_A,
        generation: GEN1,
        openedAt: NOW,
        expiresAt: NOW + 1000,
      });
    } finally {
      first.close();
    }
    const second = new Store(path);
    try {
      const locks = new TokenLocks(second);
      expect(locks.get(TOKEN, NOW + 500)?.encounter).toBe("invite-one");
      expect(locks.get(TOKEN, NOW + 2000)).toBeNull();
      expect(locks.purge(NOW + 2000)).toBe(1);
      locks.acquire({
        token: TOKEN,
        encounter: "invite-two",
        kind: "series",
        owner: OWNER_B,
        generation: GEN2,
        openedAt: NOW + 2000,
        expiresAt: NOW + 2000 + TOKEN_LOCK_TTL_MS,
      });
      expect(locks.get(TOKEN, NOW + 2000)?.owner).toBe(OWNER_B);
    } finally {
      second.close();
    }
  });
});

describe("service ownership guard", () => {
  it("skips rooms without official seats and never calls the checker", async () => {
    const stub = checkStub();
    const { service } = serviceWith(stub);
    const created = service.create({ actor: A, mode: "guest" }, NOW);
    service.join({ actor: B, mode: "guest" }, created.invite, NOW);
    expect(
      await service.guardOfficialRoom(
        created.invite,
        { seat: "a", grant: null },
        NOW,
      ),
    ).toBeNull();
    expect(stub.calls.count).toBe(0);
  });

  it("rechecks even a matching presented grant so authentication cannot age across another observation", async () => {
    const stub = checkStub();
    const { service } = serviceWith(stub);
    const created = service.create(
      { actor: A, mode: "official" },
      NOW,
      GRANT_A,
    );
    expect(
      await service.guardOfficialRoom(
        created.invite,
        { seat: "a", grant: GRANT_A },
        NOW,
      ),
    ).toBeNull();
    expect(stub.calls.count).toBe(1);
  });

  it("adopts unstamped legacy seats instead of voiding them", async () => {
    const stub = checkStub();
    const { service, store } = serviceWith(stub);
    void store;
    const created = service.create({ actor: A, mode: "official" }, NOW);
    const room = service.records.byInvite(created.invite);
    expect(room.seats.a?.holderGrant).toBeNull();
    expect(
      await service.guardOfficialRoom(
        created.invite,
        { seat: "a", grant: GRANT_A },
        NOW,
      ),
    ).toBeNull();
  });

  it("voids on a presented mismatch and preserves completed battles", async () => {
    const { service } = serviceWith();
    const invite = await openOfficialBattle(service, NOW);
    finishBattle(service, invite, NOW);
    const before = service.records.byInvite(invite);
    expect(before.series?.phase).toBe("intermission");
    const voided = await service.guardOfficialRoom(
      invite,
      { seat: "a", grant: GRANT_B },
      NOW,
    );
    expect(voided?.series?.outcome).toMatchObject({
      kind: "no-contest",
      winner: null,
    });
    expect(voided?.match).toBeNull();
    expect(voided?.completed.length).toBe(1);
    expect(voided?.series?.wins).toMatchObject({ a: 1, b: 0 });
  });

  it("voids on other-seat changes and clears the token lock", async () => {
    const stub = checkStub([
      { seat: "b", token: TOKEN, owner: OWNER_B, generation: GEN2 },
    ]);
    const { service } = serviceWith(stub);
    const created = service.create(
      { actor: A, mode: "official" },
      NOW,
      GRANT_A,
    );
    service.join({ actor: B, mode: "official" }, created.invite, NOW, GRANT_A);
    const invite = created.invite;
    const voided = await service.guardOfficialRoom(
      invite,
      { seat: "a", grant: GRANT_A },
      NOW,
    );
    // A lobby with no open series closes instead of scoring a contest.
    expect(voided?.closedAt).toBe(NOW);
    expect(voided?.series?.outcome).toBeNull();
    expect(service.locks.get(TOKEN, NOW)).toBeNull();
  });

  it("fails closed on outage without recording, terminates past the bound", async () => {
    const failing = checkStub(
      [],
      { count: 0 },
      new ServiceError(503, "Fixture RPC unavailable."),
    );
    const { service } = serviceWith(failing);
    const invite = await openOfficialBattleBoth(service, NOW);
    await expect(
      service.guardOfficialRoom(invite, { seat: "a", grant: GRANT_A }, NOW),
    ).rejects.toThrow(/verification is unavailable/);
    const stalled = service.records.byInvite(invite);
    expect(stalled.series?.outcome).toBeNull();
    expect(stalled.ownershipStallSince).toBe(NOW);
    const terminated = await service.guardOfficialRoom(
      invite,
      { seat: "a", grant: GRANT_A },
      NOW + OWNERSHIP_STALL_TERMINATE_MS + 1,
    );
    expect(terminated?.series?.outcome).toMatchObject({
      kind: "abandoned",
      winner: null,
    });
    expect(service.locks.get(TOKEN, NOW)).toBeNull();
  });

  it("propagates observation races and unexpected errors untouched", async () => {
    const racing = checkStub(
      [],
      { count: 0 },
      new ServiceError(409, "Ownership check raced another request. Retry."),
    );
    const racingService = serviceWith(racing).service;
    const invite = await openOfficialBattleBoth(racingService, NOW);
    await expect(
      racingService.guardOfficialRoom(
        invite,
        { seat: "a", grant: GRANT_A },
        NOW,
      ),
    ).rejects.toThrow(/raced another request/);
    const broken = checkStub([], { count: 0 }, new Error("boom"));
    const brokenService = serviceWith(broken).service;
    const invite2 = await openOfficialBattleBoth(brokenService, NOW + 1);
    await expect(
      brokenService.guardOfficialRoom(
        invite2,
        { seat: "a", grant: GRANT_A },
        NOW + 1,
      ),
    ).rejects.toThrow("boom");
  });

  it("voiding twice is idempotent with one preserved history", async () => {
    const { service } = serviceWith();
    const invite = await openOfficialBattle(service, NOW);
    finishBattle(service, invite, NOW);
    const first = service.voidOnTransfer(invite, NOW, [
      { seat: "a", token: TOKEN, owner: OWNER_B, generation: GEN2 },
    ]);
    const second = service.voidOnTransfer(invite, NOW, [
      { seat: "a", token: TOKEN, owner: OWNER_B, generation: GEN2 },
    ]);
    expect(first.series?.outcome?.kind).toBe("no-contest");
    expect(second.series?.outcome?.kind).toBe("no-contest");
    expect(second.completed.length).toBe(1);
  });

  it("blocks a second series for one token and frees it at completion", async () => {
    const { service } = serviceWith();
    const created = service.create(
      { actor: A, mode: "official" },
      NOW,
      GRANT_A,
    );
    expect(() =>
      service.create({ actor: C, mode: "official" }, NOW, GRANT_A),
    ).toThrow(/already in an official series/);
    service.join({ actor: B, mode: "guest" }, created.invite, NOW);
    service.select(A, created.invite, "pip", NOW, GRANT_A);
    service.select(B, created.invite, "bolt", NOW);
    await service.confirmReady(A, created.invite, true, NOW, GRANT_A);
    await service.confirmReady(B, created.invite, true, NOW);
    service.surrender(B, created.invite, NOW);
    expect(service.locks.get(TOKEN, NOW)).toBeNull();
    const reopened = service.create(
      { actor: C, mode: "official" },
      NOW,
      GRANT_A,
    );
    expect(reopened.invite).not.toBe(created.invite);
  });
});

describe("completion verification on reads", () => {
  async function timedOutRoom(
    changes: SeatOwnershipChange[] = [],
    error: unknown = null,
  ) {
    const stub = checkStub(changes, { count: 0 }, error);
    const { service } = serviceWith(stub);
    const invite = await openOfficialBattleBoth(service, NOW);
    return { service, stub, invite };
  }

  it("saves timeout completions when ownership still verifies", async () => {
    const { service, stub, invite } = await timedOutRoom();
    const view = await service.pollRoomChecked(
      A,
      invite,
      NOW + 120_000,
      GRANT_A,
    );
    expect(stub.calls.count).toBeGreaterThan(0);
    const room = service.records.byInvite(invite);
    expect(room.series?.outcome !== null || room.match?.result !== null).toBe(
      true,
    );
    expect(view).toBeDefined();
  });

  it("voids instead of awarding a win after a confirmed change", async () => {
    const { service, invite } = await timedOutRoom([
      { seat: "b", token: TOKEN, owner: OWNER_B, generation: GEN2 },
    ]);
    await service.pollRoomChecked(A, invite, NOW + 120_000, GRANT_A);
    const room = service.records.byInvite(invite);
    expect(room.series?.outcome).toMatchObject({
      kind: "no-contest",
      winner: null,
    });
  });

  it("fails closed on outage without saving the completion", async () => {
    const { service, invite } = await timedOutRoom(
      [],
      new ServiceError(503, "Fixture RPC unavailable."),
    );
    await expect(
      service.pollRoomChecked(A, invite, NOW + 120_000, GRANT_A),
    ).rejects.toThrow(/verification is unavailable/);
    const room = service.records.byInvite(invite);
    expect(room.series?.outcome).toBeNull();
    expect(room.match?.result ?? null).toBeNull();
  });

  it("leaves guest rooms exactly alone", async () => {
    const stub = checkStub();
    const { service } = serviceWith(stub);
    const created = service.create({ actor: A, mode: "guest" }, NOW);
    service.join({ actor: B, mode: "guest" }, created.invite, NOW);
    await service.pollRoomChecked(A, created.invite, NOW + 120_000, null);
    await service.pollSessionChecked(A, NOW + 120_000, null);
    expect(stub.calls.count).toBe(0);
  });
});

describe("queue token reservations", () => {
  function queueWith() {
    const store = new Store(":memory:");
    const matches = new PvpService(new PvpStore(store), PVP_TIMERS);
    const queue = new QueueService(store, matches);
    return { store, queue };
  }
  const token = { key: TOKEN, owner: OWNER_A, generation: GEN1 };

  it("reserves one token across queue and private rooms", () => {
    const { store, queue } = queueWith();
    try {
      const matches = new PvpService(new PvpStore(store), PVP_TIMERS);
      queue.join({ actor: A, mode: "guest" }, NOW, token);
      expect(queue.locks.get(TOKEN, NOW)?.kind).toBe("queue");
      expect(() =>
        matches.create({ actor: C, mode: "official" }, NOW, GRANT_A),
      ).toThrow(/already in an official queue/);
      queue.cancel(A, NOW);
      expect(queue.locks.get(TOKEN, NOW)).toBeNull();
      const created = matches.create(
        { actor: C, mode: "official" },
        NOW,
        GRANT_A,
      );
      expect(() => queue.join({ actor: A, mode: "guest" }, NOW, token)).toThrow(
        /already in an official series/,
      );
      expect(created.invite).toBeTruthy();
    } finally {
      store.close();
    }
  });

  it("releases reservations when rows expire and hands them to the sealed room", () => {
    const { store, queue } = queueWith();
    try {
      queue.join({ actor: A, mode: "guest" }, NOW, token);
      queue.join({ actor: B, mode: "guest" }, NOW + 1);
      queue.accept(A, NOW + 2);
      queue.accept(B, NOW + 2);
      const room = queue.pollState(A, NOW + 3);
      expect(room.status).toBe("matched");
      expect(room.invite).toBeTruthy();
      const lock = queue.locks.get(TOKEN, NOW + 3);
      expect(lock?.kind).toBe("series");
      expect(lock?.encounter).toBe(
        new PvpStore(store).byInvite(room.invite!).series!.id,
      );
    } finally {
      store.close();
    }
  });

  it("validates stored rows instead of casting them blind", () => {
    const { store, queue } = queueWith();
    try {
      queue.join({ actor: A, mode: "guest" }, NOW, token);
      const view = queue.pollState(A, NOW);
      expect(view.status).toBe("waiting");
      store.db.exec(
        "UPDATE pvp_queue SET token_key=123 WHERE actor='11111111-1111-4111-8111-111111111111'",
      );
      expect(queue.pollState(A, NOW).status).toBe("waiting");
    } finally {
      store.close();
    }
  });
});

describe("legacy and guest preservation", () => {
  it("leaves unstamped official seats verifiable-later and guests untouched", async () => {
    const stub = checkStub();
    const { service } = serviceWith(stub);
    const created = service.create({ actor: A, mode: "official" }, NOW);
    service.join({ actor: B, mode: "guest" }, created.invite, NOW);
    service.select(B, created.invite, "bolt", NOW);
    expect(
      await service.guardOfficialRoom(
        created.invite,
        { seat: null, grant: null },
        NOW,
      ),
    ).toBeNull();
    expect(stub.calls.count).toBe(0);
  });

  it("keeps null-series legacy rooms working without verification", async () => {
    const stub = checkStub([], { count: 0 }, new Error("must not be called"));
    const { service } = serviceWith(stub);
    const created = service.create({ actor: A, mode: "guest" }, NOW);
    const room = service.records.byInvite(created.invite);
    const legacy = { ...room, series: null };
    service.records.save(legacy as PvpRoom);
    service.join({ actor: B, mode: "guest" }, created.invite, NOW);
    service.select(A, created.invite, "pip", NOW);
    service.select(B, created.invite, "bolt", NOW);
    expect(
      await service.guardOfficialRoom(
        created.invite,
        { seat: null, grant: null },
        NOW,
      ),
    ).toBeNull();
  });

  it("returns only completed history for former owners", async () => {
    const { service } = serviceWith();
    const invite = await openOfficialBattle(service, NOW);
    finishBattle(service, invite, NOW);
    const history = service.historyFor(A);
    expect(history.length).toBe(1);
    expect(history[0]).toMatchObject({ rounds: expect.any(Number) });
    expect(service.historyFor("no-such-actor")).toEqual([]);
  });
});
