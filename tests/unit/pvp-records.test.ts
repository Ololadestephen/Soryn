import { describe, expect, it } from "vitest";
import { character } from "../../src/domain/characters/definitions";
import { identityFor, tokenKey } from "../../src/domain/identity";
import { PVP_TIMERS } from "../../src/domain/pvp/timers";
import { Store } from "../../src/server/persistence";
import { PvpStore } from "../../src/server/pvp/persistence";
import { PvpService } from "../../src/server/pvp/service";
import { TokenRecords } from "../../src/server/records/tokenRecords";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const NOW = 1_700_000_000_000;
const OWNER_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OWNER_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const GEN1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GEN2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TOKEN = identityFor("276");
const GRANT_A = { identity: TOKEN, owner: OWNER_A, generation: GEN1 };
const TIMERS = {
  ...PVP_TIMERS,
  moveMs: 1000,
  loadingMs: 1000,
  intermissionMs: 2000,
};

function setup() {
  const store = new Store(":memory:");
  const service = new PvpService(new PvpStore(store), TIMERS);
  return { store, service, records: new TokenRecords(store) };
}

/** A's seat carries the verified token; B plays as a guest. */
async function openOfficialBattle(service: PvpService, now: number) {
  const created = service.create({ actor: A, mode: "official" }, now, GRANT_A);
  service.join({ actor: B, mode: "guest" }, created.invite, now);
  service.select(A, created.invite, "pip", now, GRANT_A);
  service.select(B, created.invite, "bolt", now);
  await service.confirmReady(A, created.invite, true, now, GRANT_A);
  await service.confirmReady(B, created.invite, true, now);
  service.assets(A, created.invite, now + 1);
  service.assets(B, created.invite, now + 1);
  return created.invite;
}

function playBattle(
  service: PvpService,
  invite: string,
  winner: "a" | "b",
  start: number,
) {
  let now = start;
  for (let turn = 0; turn < 40; turn += 1) {
    const battle = service.records.byInvite(invite).match;
    if (!battle || battle.phase === "complete") return now;
    if (battle.phase !== "choose") {
      service.pollRoom(A, invite, battle.deadlineAt + 1);
      now = battle.deadlineAt + 1;
      continue;
    }
    const canSpecial = (side: "player" | "opponent") =>
      battle.state[side].cooldown === 0 &&
      battle.state[side].energy >= battle.snapshot[side].moves.special.cost;
    const round = battle.state.round;
    service.move(
      A,
      invite,
      round,
      winner === "a" && canSpecial("player") ? "special" : "basic",
      now++,
    );
    service.move(
      B,
      invite,
      round,
      winner === "b" && canSpecial("opponent") ? "special" : "basic",
      now++,
    );
    const after = service.records.byInvite(invite).match;
    if (!after || after.phase === "complete") return now;
    service.pollRoom(A, invite, after.deadlineAt + 1);
    now = after.deadlineAt + 1;
  }
  throw new Error("Battle did not finish");
}

async function playSeries(service: PvpService, winners: ("a" | "b")[]) {
  let now = NOW;
  const invite = await openOfficialBattle(service, now);
  now += 2;
  for (const winner of winners) {
    now = playBattle(service, invite, winner, now);
    const room = service.records.byInvite(invite);
    if (room.series?.phase === "complete") break;
    expect(room.series?.phase).toBe("intermission");
    await service.continueSeries(A, invite, now);
    await service.continueSeries(B, invite, now);
    now += 1;
    service.assets(A, invite, now);
    service.assets(B, invite, now);
    now += 1;
  }
  return { invite, now };
}

describe("official series land in the token record", () => {
  it("records one series row and one row per battle, idempotently", async () => {
    const { store, service, records } = setup();
    try {
      const { invite, now } = await playSeries(service, ["a", "a"]);
      const room = service.records.byInvite(invite);
      expect(room.series).toMatchObject({
        phase: "complete",
        wins: { a: 2, b: 0 },
      });
      const list = records.list(TOKEN);
      expect(list).toHaveLength(3);
      const series = list.find((row) => row.kind === "series")!;
      expect(series.source).toBe(room.series!.id);
      expect(series).toMatchObject({
        headline: "Victory",
        score: "2–0",
        fighter: character("pip").name,
        opponentFighter: character("bolt").name,
        owner: OWNER_A,
        generation: GEN1,
        rounds: null,
      });
      const battles = list.filter((row) => row.kind === "battle");
      const matchIds = room.series!.recorded;
      expect(battles.map((row) => row.source).sort()).toEqual(
        [...matchIds].sort(),
      );
      for (const battle of battles) {
        expect(battle.headline).toBe("Victory");
        expect(battle.owner).toBe(OWNER_A);
        expect(battle.rounds).toBeGreaterThan(0);
        expect(battle.arena).toBeTruthy();
      }
      // Repeated reads and polls never double-record a finished series.
      for (let repeat = 0; repeat < 3; repeat += 1) {
        service.pollRoom(A, invite, now + repeat);
        service.pollRoom(B, invite, now + repeat);
      }
      expect(records.list(TOKEN)).toHaveLength(3);
    } finally {
      store.close();
    }
  });

  it("never records a guest-only series", async () => {
    const { store, service } = setup();
    try {
      const created = service.create({ actor: A, mode: "guest" }, NOW);
      service.join({ actor: B, mode: "guest" }, created.invite, NOW);
      service.select(A, created.invite, "pip", NOW);
      service.select(B, created.invite, "bolt", NOW);
      await service.confirmReady(A, created.invite, true, NOW);
      await service.confirmReady(B, created.invite, true, NOW);
      service.assets(A, created.invite, NOW + 1);
      service.assets(B, created.invite, NOW + 1);
      let now = playBattle(service, created.invite, "a", NOW + 2);
      expect(service.records.byInvite(created.invite).series?.phase).toBe(
        "intermission",
      );
      await service.continueSeries(A, created.invite, now);
      await service.continueSeries(B, created.invite, now);
      now += 1;
      service.assets(A, created.invite, now);
      service.assets(B, created.invite, now);
      playBattle(service, created.invite, "a", now + 1);
      expect(service.records.byInvite(created.invite).series?.phase).toBe(
        "complete",
      );
      const count = store.db
        .prepare("SELECT COUNT(*) AS n FROM token_record")
        .get() as { n: number };
      expect(count.n).toBe(0);
    } finally {
      store.close();
    }
  });

  it("stamps a no contest with the completed battle history intact", async () => {
    const { store, service, records } = setup();
    try {
      let now = NOW;
      const invite = await openOfficialBattle(service, now);
      now = playBattle(service, invite, "a", now + 2);
      const intermission = service.records.byInvite(invite);
      expect(intermission.series?.phase).toBe("intermission");
      expect(intermission.match?.phase).toBe("complete");
      const voided = service.voidOnTransfer(invite, now, [
        { seat: "a", token: tokenKey(TOKEN), owner: OWNER_B, generation: GEN2 },
      ]);
      expect(voided.match).toBeNull();
      expect(voided.completed).toHaveLength(1);
      const list = records.list(TOKEN);
      expect(list).toHaveLength(2);
      const series = list.find((row) => row.kind === "no-contest")!;
      expect(series).toMatchObject({
        headline: "No contest",
        score: "1–0",
        owner: OWNER_A,
        generation: GEN1,
      });
      expect(series.explanation).toMatch(/ownership|transfer/i);
      expect(list.find((row) => row.kind === "battle")?.headline).toBe(
        "Victory",
      );
      expect(records.summary(TOKEN)).toMatchObject({
        series: 0,
        battles: 1,
        noContest: 1,
        wins: 0,
        losses: 0,
        draws: 0,
      });
      // The void is idempotent too: another sweep cannot duplicate it.
      service.voidOnTransfer(invite, now + 1, [
        { seat: "a", token: tokenKey(TOKEN), owner: OWNER_B, generation: GEN2 },
      ]);
      expect(records.list(TOKEN)).toHaveLength(2);
    } finally {
      store.close();
    }
  });
});
