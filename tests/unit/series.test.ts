import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  chooseArena,
  confirmIntermission,
  joinRoom,
  requestRematch,
  selectFighter,
  setReady,
  submitMove,
  surrender,
} from "../../src/domain/pvp/actions";
import { advanceRoom } from "../../src/domain/pvp/advance";
import { pvpSnapshot } from "../../src/domain/combat/definitions";
import { initialCombat } from "../../src/domain/combat/engine";
import { derivedId, freshSeries } from "../../src/domain/pvp/series";
import { PVP_TIMERS } from "../../src/domain/pvp/timers";
import { pvpRoomSchema, type PvpRoom } from "../../src/domain/pvp/types";
import { presentRoom } from "../../src/domain/pvp/view";
import { Store } from "../../src/server/persistence";
import { PvpStore } from "../../src/server/pvp/persistence";
import { PvpService } from "../../src/server/pvp/service";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const NOW = 1_700_000_000_000;
const SERIES = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function seriesRoom() {
  const room: PvpRoom = {
    version: "pvp-room/1",
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    invite: "invitetoken0123456789abcdefghij",
    revision: 1,
    createdAt: NOW,
    expiresAt: NOW + PVP_TIMERS.lobbyMs,
    closedAt: null,
    arenaChoice: "grove",
    rematchOf: null,
    seats: { a: null, b: null },
    match: null,
    completed: [],
    timers: PVP_TIMERS,
    series: freshSeries(SERIES),
    roster: "private",
    ownershipStallSince: null,
  };
  joinRoom(room, { actor: A, mode: "guest" }, NOW, "Amber Finch");
  joinRoom(room, { actor: B, mode: "guest" }, NOW, "Brass Wren");
  chooseArena(room, A, "grove");
  selectFighter(room, A, "pip");
  selectFighter(room, B, "bolt");
  const ids = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    tie: 0 as const,
    arenaRoll: () => "grove" as const,
  };
  setReady(room, A, true, NOW, ids);
  setReady(room, B, true, NOW, ids);
  return room;
}

function finish(room: PvpRoom, winner: "a" | "b", now: number) {
  const match = room.match!;
  match.phase = "choose";
  match.deadlineAt = now + PVP_TIMERS.moveMs;
  match.state.player.energy = 4;
  match.state.opponent.energy = 4;
  match.state.player.health = winner === "a" ? 80 : 1;
  match.state.opponent.health = winner === "a" ? 1 : 80;
  const round = match.state.round;
  submitMove(room, A, round, "basic", now);
  submitMove(room, B, round, "basic", now);
}

function draw(room: PvpRoom, now: number) {
  const match = room.match!;
  match.phase = "choose";
  match.deadlineAt = now + PVP_TIMERS.moveMs;
  match.state.round = 20;
  match.state.player.energy = 4;
  match.state.opponent.energy = 4;
  match.state.player.health = 40;
  match.state.opponent.health = 40;
  submitMove(room, A, 20, "guard", now);
  submitMove(room, B, 20, "guard", now);
}

function continueBoth(room: PvpRoom, now: number) {
  confirmIntermission(room, A, now);
  confirmIntermission(room, B, now);
}

describe("best of three", () => {
  it("allows non-consecutive draw replays without stranding a valid deciding battle", () => {
    const room = seriesRoom();
    for (const win of ["a", "b", "a"] as const) {
      draw(room, NOW);
      continueBoth(room, NOW);
      finish(room, win, NOW);
      if (room.series?.phase === "intermission") continueBoth(room, NOW);
    }
    expect(room.series).toMatchObject({
      battleNumber: 6,
      phase: "complete",
      wins: { a: 2, b: 1 },
    });
    expect(room.series?.recorded).toHaveLength(6);
    expect(() => pvpRoomSchema.parse(room)).not.toThrow();
  });

  it("never opens a later holder battle from clocks alone; fresh verification can end or open it", async () => {
    for (const eligible of [false, true]) {
      const store = new Store(":memory:");
      const room = seriesRoom();
      room.match!.snapshot = pvpSnapshot("aegis", "bolt", 0);
      room.match!.state = initialCombat(room.match!.snapshot);
      room.seats.a!.characterId = "aegis";
      room.seats.a!.mode = "official";
      room.seats.a!.holderGrant = {
        identity: {
          chainId: 143,
          collection: "0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763",
          tokenId: "276",
        },
        owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        generation: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      };
      finish(room, "a", NOW);
      const prior = room.match!.id;
      continueBoth(room, NOW);
      expect(room.match!.id).toBe(prior);
      const after = advanceRoom(room, NOW + PVP_TIMERS.intermissionMs);
      expect(after.match!.id).toBe(prior);
      const service = new PvpService(
        new PvpStore(store),
        PVP_TIMERS,
        undefined,
        async () => [],
        undefined,
        async () =>
          eligible
            ? []
            : [
                {
                  seat: "a",
                  token: "143:0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763:276",
                  owner: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                  generation: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                },
              ],
      );
      service.locks.acquire({
        token: "143:0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763:276",
        encounter: room.invite,
        kind: "series",
        owner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        generation: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        openedAt: NOW,
        expiresAt: NOW + 86400000,
      });
      service.records.save(after);
      await service.confirmNextBattle(
        room.invite,
        NOW + PVP_TIMERS.intermissionMs,
      );
      const checked = service.records.byInvite(room.invite);
      expect(checked.series?.phase).toBe(eligible ? "battle" : "complete");
      expect(checked.match?.id === prior).toBe(false);
      if (!eligible)
        expect(checked.series?.outcome).toMatchObject({
          kind: "no-contest",
          winner: null,
        });
      store.close();
    }
  });
  it("resets every battle state and presentation counter, preserving only the locked series", () => {
    const room = seriesRoom();
    finish(room, "a", NOW);
    const previous = room.match!.id;
    for (const side of ["player", "opponent"] as const) {
      const fighter = room.match!.state[side];
      fighter.energy = 0;
      fighter.cooldown = 3;
      fighter.effects = { exposed: 2, disrupt: 1, burn: 2, decoy: 4, focus: 3 };
      fighter.lastMove = "special";
    }
    for (const id of ["a", "b"] as const)
      Object.assign(room.seats[id]!, {
        misses: 1,
        assetsReady: true,
        rematch: true,
        notice: "Old battle notice",
      });
    continueBoth(room, NOW + 1);
    const next = room.match!;
    expect(next.id).not.toBe(previous);
    expect(next.phase).toBe("loading");
    expect(next.state).toEqual({
      round: 1,
      outcome: null,
      player: {
        health: 84,
        energy: 4,
        cooldown: 0,
        effects: { exposed: 0, disrupt: 0, burn: 0, decoy: 0, focus: 0 },
        lastMove: null,
      },
      opponent: {
        health: 80,
        energy: 4,
        cooldown: 0,
        effects: { exposed: 0, disrupt: 0, burn: 0, decoy: 0, focus: 0 },
        lastMove: null,
      },
    });
    expect(next.rounds).toEqual([]);
    expect(next.locks).toEqual({ a: null, b: null });
    expect(next.eventSeq).toBe(0);
    expect(next.result).toBeNull();
    for (const id of ["a", "b"] as const)
      expect(room.seats[id]).toMatchObject({
        misses: 0,
        assetsReady: false,
        rematch: false,
        notice: null,
      });
    expect(room.series).toMatchObject({
      id: SERIES,
      battleNumber: 2,
      wins: { a: 1, b: 0 },
    });
    expect(room.seats.a?.characterId).toBe("pip");
    expect(room.seats.b?.characterId).toBe("bolt");
    expect(next.arena).toBe("grove");
  });
  it("accepts the derived battle id as a uuid", () => {
    expect(derivedId("series-seed")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("ends 2–0 without opening a third battle", () => {
    const room = seriesRoom();
    finish(room, "a", NOW);
    expect(room.series).toMatchObject({
      phase: "intermission",
      wins: { a: 1, b: 0 },
      battleNumber: 1,
    });
    continueBoth(room, NOW + 1000);
    expect(room.series?.battleNumber).toBe(2);
    expect(room.match?.state.opponent.health).toBe(80);
    expect(room.match?.state.player.health).toBe(84);
    const second = room.match!.id;
    finish(room, "a", NOW + 2000);
    expect(room.series).toMatchObject({
      phase: "complete",
      wins: { a: 2, b: 0 },
      outcome: { kind: "win", winner: "a" },
    });
    const after = advanceRoom(room, NOW + 999_999);
    expect(after.match?.id).toBe(second);
    expect(after.series?.battleNumber).toBe(2);
  });

  it("plays the decider on 2–1 and then stops", () => {
    const room = seriesRoom();
    finish(room, "a", NOW);
    continueBoth(room, NOW + 1);
    finish(room, "b", NOW + 2);
    expect(room.series?.wins).toEqual({ a: 1, b: 1 });
    continueBoth(room, NOW + 3);
    expect(room.series?.battleNumber).toBe(3);
    finish(room, "a", NOW + 4);
    expect(room.series).toMatchObject({
      phase: "complete",
      wins: { a: 2, b: 1 },
    });
    expect(room.series?.recorded).toHaveLength(3);
    expect(() => continueBoth(room, NOW + 5)).toThrow(/not ready/);
  });

  it("replays one draw and ends the series on the second", () => {
    const room = seriesRoom();
    draw(room, NOW);
    expect(room.match?.result?.winner).toBeNull();
    expect(room.series).toMatchObject({
      phase: "intermission",
      consecutiveDraws: 1,
      wins: { a: 0, b: 0 },
    });
    const first = room.match!.id;
    continueBoth(room, NOW + 1);
    expect(room.match?.id).not.toBe(first);
    draw(room, NOW + 2);
    expect(room.series).toMatchObject({
      phase: "complete",
      outcome: { kind: "draw", winner: null },
    });
    expect(room.series?.recorded).toHaveLength(2);
  });

  it("ends the series when a battle is forfeited or abandoned", () => {
    const forfeited = seriesRoom();
    forfeited.match!.phase = "choose";
    forfeited.match!.deadlineAt = NOW;
    forfeited.match!.snapshot.player.moves.guard.cost = 99;
    forfeited.match!.state.player.energy = 0;
    const ended = advanceRoom(forfeited, NOW);
    expect(ended.series?.outcome).toMatchObject({
      kind: "forfeit",
      winner: "b",
    });
    const surrendered = seriesRoom();
    surrender(surrendered, A, NOW);
    expect(surrendered.series?.outcome).toMatchObject({
      kind: "forfeit",
      winner: "b",
    });
    const abandoned = seriesRoom();
    abandoned.match!.phase = "choose";
    abandoned.match!.deadlineAt = NOW;
    for (const side of ["player", "opponent"] as const) {
      abandoned.match!.snapshot[side].moves.guard.cost = 99;
      abandoned.match!.state[side].energy = 0;
    }
    expect(advanceRoom(abandoned, NOW).series?.outcome?.kind).toBe("abandoned");
  });

  it("records one win when completion is delivered twice", () => {
    const room = seriesRoom();
    finish(room, "a", NOW);
    expect(room.series?.wins.a).toBe(1);
    expect(room.series?.recorded).toHaveLength(1);
    const again = advanceRoom(room, NOW);
    expect(again.series?.wins.a).toBe(1);
    expect(again.series?.recorded).toHaveLength(1);
  });

  it("keeps the intermission deadline across a reopened database", async () => {
    const folder = mkdtempSync(join(tmpdir(), "chog-series-"));
    const path = join(folder, "series.sqlite");
    const first = new PvpService(new PvpStore(new Store(path)), PVP_TIMERS);
    const created = first.create({ actor: A, mode: "guest" }, NOW);
    first.join({ actor: B, mode: "guest" }, created.invite, NOW);
    first.select(A, created.invite, "pip", NOW);
    first.select(B, created.invite, "bolt", NOW);
    await first.confirmReady(A, created.invite, true, NOW);
    await first.confirmReady(B, created.invite, true, NOW);
    const room = first.records.byInvite(created.invite);
    finish(room, "a", NOW + 10);
    first.records.save(room);
    const deadline = room.series?.deadlineAt;
    first.records.store.close();
    const second = new PvpService(new PvpStore(new Store(path)), PVP_TIMERS);
    const restored = second.records.byInvite(created.invite);
    expect(restored.series?.phase).toBe("intermission");
    expect(restored.series?.deadlineAt).toBe(deadline);
    expect(restored.series?.wins).toEqual({ a: 1, b: 0 });
    const opened = advanceRoom(restored, deadline ?? NOW);
    expect(opened.series?.battleNumber).toBe(2);
    second.records.save(opened);
    const view = second.pollRoom(B, created.invite, (deadline ?? NOW) + 1);
    expect(view.seated && view.series?.battle).toBe(2);
    const live = second.records.byInvite(created.invite);
    finish(live, "a", (deadline ?? NOW) + 2);
    second.records.save(live);
    const finalView = second.pollRoom(A, created.invite, (deadline ?? NOW) + 3);
    expect(finalView.seated && finalView.series?.phase).toBe("complete");
    expect(() =>
      second.rematch(A, created.invite, (deadline ?? NOW) + 4),
    ).toThrow(/archived/);
    const again = second.create(
      { actor: A, mode: "guest" },
      (deadline ?? NOW) + 4,
    );
    expect(again.invite).not.toBe(created.invite);
    expect(again.series).toMatchObject({ you: 0, opponent: 0, phase: "setup" });
    expect(second.records.byInvite(created.invite).series?.id).toBe(
      restored.series?.id,
    );
    expect(second.records.byInvite(created.invite).series?.wins).toEqual({
      a: 2,
      b: 0,
    });
    second.records.store.close();
  });

  it("shows the series score and keeps old rooms readable", () => {
    const room = seriesRoom();
    finish(room, "a", NOW);
    const view = presentRoom(room, A, NOW);
    expect(view.phase).toBe("intermission");
    expect(view.series).toMatchObject({ you: 1, opponent: 0 });
    const legacy = seriesRoom();
    legacy.series = null;
    const parsed = pvpRoomSchema.parse({
      ...legacy,
      series: undefined,
      roster: undefined,
    });
    expect(parsed.series).toBeNull();
    expect(parsed.roster).toBe("private");
    legacy.match!.phase = "complete";
    legacy.match!.result = {
      kind: "knockout",
      winner: "a",
      explanation: "A fighter was knocked out.",
    };
    requestRematch(legacy, A);
    requestRematch(legacy, B);
    expect(legacy.match).toBeNull();
    expect(legacy.series).toBeNull();
  });
});

describe("series identity at the retained history boundary", () => {
  it("never reuses a series ID when rematching past forty retained battles", () => {
    const room = seriesRoom();
    const seen = new Set([room.series!.id]);
    for (let i = 0; i < 45; i++) {
      surrender(room, A, NOW + i);
      requestRematch(room, A);
      requestRematch(room, B);
      expect(seen.has(room.series!.id)).toBe(false);
      seen.add(room.series!.id);
      expect(room.completed.length).toBeLessThanOrEqual(40);
      selectFighter(room, A, "pip");
      selectFighter(room, B, "bolt");
      const ids = {
        id: derivedId(`unit-rematch-${i}`),
        tie: 0 as const,
        arenaRoll: () => "grove" as const,
      };
      setReady(room, A, true, NOW + i, ids);
      setReady(room, B, true, NOW + i, ids);
    }
    expect(seen.size).toBe(46);
  });
});
