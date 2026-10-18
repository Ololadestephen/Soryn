import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pvpSnapshot } from "../../src/domain/combat/definitions";
import { initialCombat, resolveRound } from "../../src/domain/combat/engine";
import { eventCue } from "../../src/domain/combat/presentation/cues";
import { chooseOpponent } from "../../src/domain/combat/policy";
import {
  chooseArena,
  closeRoom,
  joinRoom,
  markAssets,
  requestRematch,
  selectFighter,
  setReady,
  submitMove,
} from "../../src/domain/pvp/actions";
import { advanceRoom } from "../../src/domain/pvp/advance";
import { mirrorBattle, mirrorMessage } from "../../src/domain/pvp/mirror";
import { guestName } from "../../src/domain/pvp/names";
import { identityFor } from "../../src/domain/identity";
import { PVP_TIMERS, timersFromEnv } from "../../src/domain/pvp/timers";
import { pvpRoomSchema, type PvpRoom } from "../../src/domain/pvp/types";
import { ServiceError } from "../../src/server/errors";
import { nextRoomState, remainingSeconds } from "../../src/domain/pvp/updates";
import { presentRoom } from "../../src/domain/pvp/view";
import { Store } from "../../src/server/persistence";
import { PvpStore } from "../../src/server/pvp/persistence";
import { PvpService } from "../../src/server/pvp/service";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const NOW = 1_700_000_000_000;

function emptyRoom(): PvpRoom {
  return {
    version: "pvp-room/1",
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    invite: "invitetoken0123456789abcdefghij",
    revision: 1,
    createdAt: NOW,
    expiresAt: NOW + PVP_TIMERS.lobbyMs,
    closedAt: null,
    arenaChoice: "sanctuary",
    rematchOf: null,
    seats: { a: null, b: null },
    match: null,
    completed: [],
    timers: PVP_TIMERS,
    series: null,
    roster: "private",
    ownershipStallSince: null,
  };
}

function seated() {
  const room = emptyRoom();
  joinRoom(room, { actor: A, mode: "guest" }, NOW, "Amber Finch");
  joinRoom(room, { actor: B, mode: "guest" }, NOW, "Brass Wren");
  return room;
}

function readyRoom(arena: "grove" | "sanctuary" = "grove") {
  const room = seated();
  if (arena !== "sanctuary") chooseArena(room, A, arena);
  selectFighter(room, A, "pip");
  selectFighter(room, B, "bolt");
  setReady(room, A, true, NOW, {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    tie: 0,
    arenaRoll: () => "grove",
  });
  setReady(room, B, true, NOW, {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    tie: 0,
    arenaRoll: () => "grove",
  });
  return room;
}

function lockPairs(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  if ("move" in value && "round" in value) return ["lock"];
  return Object.values(value).flatMap(lockPairs);
}

describe("guest display names", () => {
  it("stays stable and only suffixes a name the other seat already has", () => {
    const first = guestName(A);
    expect(guestName(A)).toBe(first);
    expect(first).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    expect(guestName(A, [first])).toBe(`${first} 2`);
    expect(guestName(A)).not.toContain(A);
  });
});

describe("private match contract", () => {
  it("keeps an invitation from taking a seated player's place", () => {
    const room = seated();
    expect(() =>
      joinRoom(room, { actor: C, mode: "guest" }, NOW, "Other"),
    ).toThrow("full");
    expect(room.seats.a?.actor).toBe(A);
    expect(room.seats.b?.actor).toBe(B);
    closeRoom(room, A, NOW);
    const expired = emptyRoom();
    expired.expiresAt = NOW - 1;
    expect(() =>
      joinRoom(expired, { actor: C, mode: "guest" }, NOW, "Late"),
    ).toThrow("expired");
  });

  it("clears readiness when a fighter or arena changes and locks holder fighters", () => {
    const room = seated();
    selectFighter(room, A, "pip");
    selectFighter(room, B, "bolt");
    setReady(room, A, true, NOW, {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tie: 0,
      arenaRoll: () => "grove",
    });
    expect(room.seats.a?.ready).toBe(true);
    selectFighter(room, B, "moss");
    expect(room.seats.a?.ready).toBe(false);
    setReady(room, A, true, NOW, {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      tie: 0,
      arenaRoll: () => "grove",
    });
    chooseArena(room, A, "sky");
    expect(room.seats.a?.ready).toBe(false);
    expect(() => selectFighter(room, A, "aegis")).toThrow("ownership");
  });

  it("freezes the arena, fighters and rules when both players are ready", () => {
    const room = readyRoom();
    expect(room.match?.phase).toBe("loading");
    expect(room.match?.snapshot.policy).toBe("combat-pvp/1");
    expect(room.match?.snapshot.rules).toBe("combat-rules/1");
    expect(room.match?.snapshot.player.id).toBe("pip");
    expect(room.match?.snapshot.opponent.id).toBe("bolt");
    expect(room.match?.arena).toBe("grove");
    expect(room.match?.deadlineAt).toBe(NOW + PVP_TIMERS.loadingMs);
  });

  it("starts the first turn after both clients are ready, or when loading time runs out", () => {
    const waiting = readyRoom();
    markAssets(waiting, A, NOW + 1000);
    expect(waiting.match?.phase).toBe("loading");
    markAssets(waiting, B, NOW + 1000);
    expect(waiting.match?.phase).toBe("choose");
    expect(waiting.match?.deadlineAt).toBe(NOW + 1000 + PVP_TIMERS.moveMs);
    const timed = readyRoom();
    const due = timed.match!.deadlineAt;
    const started = advanceRoom(timed, due);
    expect(started.match?.phase).toBe("choose");
    expect(started.match?.deadlineAt).toBe(due + PVP_TIMERS.moveMs);
  });

  it("hides the opponent's locked move and resolves the round once", () => {
    const room = readyRoom();
    room.match!.phase = "choose";
    room.match!.deadlineAt = NOW + PVP_TIMERS.moveMs;
    submitMove(room, A, 1, "special", NOW + 10);
    const hidden = presentRoom(room, B, NOW + 10);
    expect(hidden.opponent?.locked).toBe(true);
    expect(hidden.you.move).toBeNull();
    expect(hidden.battle?.rounds).toHaveLength(0);
    expect(lockPairs(hidden)).toEqual([]);
    expect(JSON.stringify(hidden)).not.toContain(A);
    submitMove(room, A, 1, "special", NOW + 11);
    expect(() => submitMove(room, A, 1, "basic", NOW + 12)).toThrow(
      "already locked",
    );
    submitMove(room, B, 1, "guard", NOW + 13);
    expect(room.match?.rounds).toHaveLength(1);
    expect(room.match?.rounds[0].player).toBe("special");
    expect(room.match?.rounds[0].opponent).toBe("guard");
    submitMove(room, A, 1, "special", NOW + 14);
    expect(room.match?.rounds).toHaveLength(1);
    expect(() => submitMove(room, B, 2, "basic", NOW + 15)).toThrow(
      "next turn",
    );
  });

  it("mirrors damage, labels and the winner without reversing the fighters", () => {
    const snapshot = pvpSnapshot("pip", "bolt", 0);
    const resolved = resolveRound(
      snapshot,
      initialCombat(snapshot),
      "basic",
      "guard",
      "Both moves were locked.",
    );
    const canonical = {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      arena: "grove" as const,
      mode: "guest" as const,
      tokenId: null,
      snapshot,
      state: resolved.state,
      rounds: [resolved.round],
      legal: [],
    };
    const mirrored = mirrorBattle(canonical);
    const restored = mirrorBattle(mirrored);
    expect(mirrored.snapshot.player.id).toBe("bolt");
    expect(mirrored.state.player.health).toBe(resolved.state.opponent.health);
    expect(mirrored.state.opponent.health).toBe(resolved.state.player.health);
    expect(restored.state).toEqual(resolved.state);
    const cue = eventCue(
      resolved.round.events[2],
      resolved.round.events[1].state,
    );
    const mirroredCue = eventCue(
      mirrored.rounds[0].events[2],
      mirrored.rounds[0].events[1].state,
    );
    expect(mirroredCue.amount).toBe(cue.amount);
    expect(mirrorMessage("Battle victory.")).toBe("Battle defeat.");
    expect(mirrorMessage("Your fighter acting")).toBe("Opponent acting");
  });

  it("uses Guard for one miss, forfeits the second, and abandons a shared forfeit", () => {
    const room = readyRoom();
    room.match!.phase = "choose";
    room.match!.deadlineAt = NOW;
    submitMove(room, A, 1, "basic", NOW - 1);
    const guarded = advanceRoom(room, NOW);
    expect(guarded.match?.rounds[0].opponent).toBe("guard");
    expect(guarded.seats.b?.misses).toBe(1);
    expect(guarded.match?.phase).toBe("present");
    const next = advanceRoom(guarded, guarded.match!.deadlineAt);
    expect(next.match?.phase).toBe("choose");
    const forfeited = advanceRoom(next, next.match!.deadlineAt + 1);
    expect(forfeited.match?.result?.kind).toBe("forfeit");
    expect(forfeited.match?.result?.winner).toBe("a");
    expect(forfeited.match?.rounds).toHaveLength(1);
    const both = readyRoom();
    both.match!.phase = "choose";
    both.match!.deadlineAt = NOW;
    const first = advanceRoom(both, NOW);
    expect(first.match?.rounds[0].player).toBe("guard");
    expect(first.match?.rounds[0].opponent).toBe("guard");
    const secondChoose = advanceRoom(first, first.match!.deadlineAt);
    const abandoned = advanceRoom(secondChoose, secondChoose.match!.deadlineAt);
    expect(abandoned.match?.result).toMatchObject({
      kind: "abandoned",
      winner: null,
    });
    expect(abandoned.match?.state.outcome).toBeNull();
  });

  it("does not extend a deadline because a player disconnected", () => {
    const room = readyRoom();
    room.match!.phase = "choose";
    room.match!.deadlineAt = NOW + PVP_TIMERS.moveMs;
    room.seats.b!.lastSeenAt = NOW - PVP_TIMERS.disconnectMs - 1;
    const view = presentRoom(room, A, NOW);
    expect(view.opponent?.connected).toBe(false);
    expect(view.deadlineAt).toBe(NOW + PVP_TIMERS.moveMs);
    const untouched = advanceRoom(room, NOW + 1000);
    expect(untouched.match?.deadlineAt).toBe(room.match?.deadlineAt);
  });

  it("catches up elapsed turns from stored deadlines and keeps event order", () => {
    const room = readyRoom();
    room.match!.phase = "choose";
    room.match!.deadlineAt = NOW;
    const caught = advanceRoom(
      room,
      NOW + PVP_TIMERS.moveMs + PVP_TIMERS.presentMs + PVP_TIMERS.moveMs,
    );
    expect(caught.match?.result?.kind).toBe("abandoned");
    expect(caught.match?.eventSeq).toBe(
      caught.match?.rounds.reduce(
        (total, round) => total + round.events.length,
        0,
      ),
    );
    expect(caught.match?.eventSeq).toBeGreaterThan(0);
  });

  it("rejects an illegal move and a round that is no longer current", () => {
    const room = readyRoom();
    room.match!.phase = "choose";
    room.match!.deadlineAt = NOW + PVP_TIMERS.moveMs;
    room.match!.state.player.energy = 0;
    expect(() => submitMove(room, A, 1, "basic", NOW)).toThrow(
      "isn't available",
    );
    room.match!.state.player.energy = 4;
    expect(() => submitMove(room, A, 2, "guard", NOW)).toThrow("moved on");
    expect(() =>
      chooseOpponent(room.match!.snapshot, room.match!.state),
    ).toThrow("two submitted moves");
  });

  it("forfeits a fighter who cannot Guard and abandons when neither can", () => {
    const one = readyRoom();
    one.match!.phase = "choose";
    one.match!.deadlineAt = NOW;
    one.match!.snapshot.player.moves.guard.cost = 99;
    one.match!.state.player.energy = 0;
    expect(advanceRoom(one, NOW).match?.result).toMatchObject({
      kind: "forfeit",
      winner: "b",
      explanation:
        "A turn expired and Guard was not legal, so that fighter forfeited.",
    });
    const both = readyRoom();
    both.match!.phase = "choose";
    both.match!.deadlineAt = NOW;
    for (const side of ["player", "opponent"] as const) {
      both.match!.snapshot[side].moves.guard.cost = 99;
      both.match!.state[side].energy = 0;
    }
    expect(advanceRoom(both, NOW).match?.result).toMatchObject({
      kind: "abandoned",
      winner: null,
    });
  });

  it("creates the rematch only after both accept and rechecks fighter access", () => {
    const room = readyRoom();
    room.match!.phase = "complete";
    room.match!.result = {
      kind: "knockout",
      winner: "a",
      explanation: "A fighter was knocked out.",
    };
    room.match!.state = { ...room.match!.state, outcome: "victory" };
    requestRematch(room, A);
    expect(room.match?.phase).toBe("complete");
    room.seats.a!.mode = "guest";
    room.seats.a!.characterId = "aegis";
    requestRematch(room, B);
    expect(room.match).toBeNull();
    expect(room.completed).toHaveLength(1);
    expect(room.rematchOf).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(room.seats.a?.characterId).toBeNull();
    expect(room.seats.a?.notice).toMatch(/ownership/);
  });
});

describe("private match persistence", () => {
  it("reopens an active round after the database connection is replaced", () => {
    const folder = mkdtempSync(join(tmpdir(), "chog-pvp-"));
    const path = join(folder, "pvp.sqlite");
    let count = 0;
    const ids = {
      room: () =>
        `10000000-0000-4000-8000-${String(++count).padStart(12, "0")}` as const,
      match: () =>
        `20000000-0000-4000-8000-${String(count).padStart(12, "0")}` as const,
      invite: () => `invite${String(count).padStart(26, "x")}`,
      tie: (): 0 | 1 => 0,
      arena: () => "sanctuary" as const,
    };
    const first = new PvpService(
      new PvpStore(new Store(path)),
      PVP_TIMERS,
      ids,
    );
    const created = first.create({ actor: A, mode: "guest" }, NOW);
    first.join({ actor: B, mode: "guest" }, created.invite, NOW);
    first.select(A, created.invite, "pip", NOW);
    first.select(B, created.invite, "bolt", NOW);
    first.ready(A, created.invite, true, NOW);
    first.ready(B, created.invite, true, NOW);
    first.assets(A, created.invite, NOW);
    first.assets(B, created.invite, NOW);
    first.move(A, created.invite, 1, "basic", NOW + 20);
    first.records.store.close();
    const second = new PvpService(
      new PvpStore(new Store(path)),
      PVP_TIMERS,
      ids,
    );
    const hidden = second.preview(created.invite, B, NOW + 20);
    expect(hidden.seated).toBe(true);
    if (!hidden.seated) return;
    expect(hidden.opponent?.locked).toBe(true);
    expect(hidden.you.move).toBeNull();
    expect(lockPairs(hidden)).toEqual([]);
    const resolved = second.preview(created.invite, A, NOW + PVP_TIMERS.moveMs);
    expect(resolved.seated).toBe(true);
    if (!resolved.seated) return;
    expect(resolved.battle?.rounds).toHaveLength(1);
    expect(resolved.battle?.rounds[0].player).toBe("basic");
    second.records.store.close();
  });

  it("keeps the timeout when a move arriving at the deadline is rejected", () => {
    const folder = mkdtempSync(join(tmpdir(), "chog-pvp-deadline-"));
    const path = join(folder, "pvp.sqlite");
    const service = new PvpService(new PvpStore(new Store(path)), PVP_TIMERS);
    const created = service.create({ actor: A, mode: "guest" }, NOW);
    service.join({ actor: B, mode: "guest" }, created.invite, NOW);
    service.select(A, created.invite, "pip", NOW);
    service.select(B, created.invite, "bolt", NOW);
    service.ready(A, created.invite, true, NOW);
    service.ready(B, created.invite, true, NOW);
    service.assets(A, created.invite, NOW);
    service.assets(B, created.invite, NOW);
    const deadline = NOW + PVP_TIMERS.moveMs;
    expect(() =>
      service.move(A, created.invite, 1, "special", deadline),
    ).toThrow(/another move|over/);
    const caught = service.preview(created.invite, B, deadline);
    expect(caught.seated && caught.battle?.rounds).toHaveLength(1);
    expect(caught.seated && caught.battle?.rounds[0]).toMatchObject({
      player: "guard",
      opponent: "guard",
    });
    const presentUntil = caught.seated ? caught.deadlineAt : null;
    const nextChoose = service.preview(
      created.invite,
      A,
      presentUntil ?? deadline,
    );
    const second = nextChoose.seated ? nextChoose.deadlineAt : null;
    expect(second).not.toBeNull();
    expect(() =>
      service.move(A, created.invite, 2, "basic", second ?? deadline),
    ).toThrow(/over|another move|moved on/);
    const abandoned = service.preview(created.invite, B, second ?? deadline);
    expect(abandoned.seated && abandoned.result?.kind).toBe("abandoned");
    expect(abandoned.seated && abandoned.battle?.rounds).toHaveLength(1);
    service.records.store.close();
  });

  it("uses a locked move when only the other player reaches the deadline", () => {
    const service = new PvpService(
      new PvpStore(new Store(":memory:")),
      PVP_TIMERS,
    );
    const created = service.create({ actor: A, mode: "guest" }, NOW);
    service.join({ actor: B, mode: "guest" }, created.invite, NOW);
    service.select(A, created.invite, "pip", NOW);
    service.select(B, created.invite, "bolt", NOW);
    service.ready(A, created.invite, true, NOW);
    service.ready(B, created.invite, true, NOW);
    service.assets(A, created.invite, NOW);
    service.assets(B, created.invite, NOW);
    service.move(A, created.invite, 1, "special", NOW + 10);
    const deadline = NOW + PVP_TIMERS.moveMs;
    expect(() => service.move(B, created.invite, 1, "basic", deadline)).toThrow(
      /another move/,
    );
    const view = service.preview(created.invite, A, deadline);
    expect(view.seated && view.battle?.rounds).toHaveLength(1);
    expect(view.seated && view.battle?.rounds[0]).toMatchObject({
      player: "special",
      opponent: "guard",
    });
    service.records.store.close();
  });

  it("refuses an unseated player with the invitation from changing setup", () => {
    const service = new PvpService(
      new PvpStore(new Store(":memory:")),
      PVP_TIMERS,
    );
    const created = service.create({ actor: A, mode: "guest" }, NOW);
    service.join({ actor: B, mode: "guest" }, created.invite, NOW);
    service.select(A, created.invite, "pip", NOW);
    service.ready(A, created.invite, true, NOW);
    expect(() => service.setup(C, created.invite, NOW)).toThrow(/not seated/);
    const host = service.preview(created.invite, A, NOW);
    expect(host.seated && host.you.ready).toBe(true);
    expect(host.seated && host.you.characterId).toBe("pip");
    service.records.store.close();
  });

  it("drops an expired empty lobby and keeps the newest forty matches", () => {
    const service = new PvpService(
      new PvpStore(new Store(":memory:")),
      PVP_TIMERS,
    );
    const stale = service.create({ actor: A, mode: "guest" }, NOW);
    service.create({ actor: B, mode: "guest" }, NOW + PVP_TIMERS.lobbyMs);
    expect(() =>
      service.preview(stale.invite, A, NOW + PVP_TIMERS.lobbyMs),
    ).toThrow(/not found/);
    const room = readyRoom();
    room.match!.phase = "complete";
    room.match!.result = {
      kind: "knockout",
      winner: "a",
      explanation: "A fighter was knocked out.",
    };
    for (let index = 0; index < 40; index += 1)
      room.completed.push(structuredClone(room.match!));
    requestRematch(room, A);
    requestRematch(room, B);
    expect(room.completed).toHaveLength(40);
    service.records.save(room);
    service.records.store.close();
  });
});

describe("private match clocks and stale views", () => {
  it("keeps production clocks unless the test flag is on loopback", () => {
    expect(
      timersFromEnv({
        CHOG_PVP_TIMERS: "test",
        CHOG_PVP_MOVE_MS: "1000",
        APP_ORIGIN: "https://play.example",
      }).moveMs,
    ).toBe(30_000);
    expect(
      timersFromEnv({
        CHOG_PVP_MOVE_MS: "1000",
        APP_ORIGIN: "http://127.0.0.1:3000",
      }).moveMs,
    ).toBe(30_000);
    expect(
      timersFromEnv({
        CHOG_PVP_TIMERS: "test",
        CHOG_PVP_MOVE_MS: "8000",
        APP_ORIGIN: "http://127.0.0.1:3100",
      }).moveMs,
    ).toBe(8000);
  });

  it("ignores a late poll that would rewind the turn clock or the seat", () => {
    const cursor = { revision: 4, serverNow: 2_000, stamp: 2 };
    const older = nextRoomState(
      cursor,
      {
        seated: true,
        revision: 4,
        serverNow: 1_000,
      } as never,
      3,
      "poll",
    );
    expect(older).toBeNull();
    const lobby = nextRoomState(
      cursor,
      {
        seated: false,
        origin: "private",
        status: "open",
        names: [],
        openSeats: 1,
      },
      3,
      "poll",
    );
    expect(lobby).toBeNull();
    const leave = nextRoomState(
      cursor,
      {
        seated: false,
        origin: "private",
        status: "open",
        names: [],
        openSeats: 1,
      },
      4,
      "action",
    );
    expect(leave?.room.seated).toBe(false);
    expect(remainingSeconds(1_000, 31_000, 9_000_000, 9_000_000)).toBe(30);
  });
});

describe("holder seats at match start", () => {
  const owner = "0x1111111111111111111111111111111111111111";
  const grantA = {
    identity: identityFor("1"),
    generation: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    owner,
  };
  const grantB = {
    identity: identityFor("2"),
    generation: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    owner,
  };

  function officialRoom(path: string) {
    const service = new PvpService(new PvpStore(new Store(path)), PVP_TIMERS);
    const created = service.create({ actor: A, mode: "official" }, NOW);
    service.join({ actor: B, mode: "official" }, created.invite, NOW);
    service.select(A, created.invite, "aegis", NOW, grantA);
    service.select(B, created.invite, "nyx", NOW, grantB);
    service.ready(A, created.invite, true, NOW, grantA);
    return { service, invite: created.invite };
  }

  it("keeps a holder match closed when eligibility cannot be verified", async () => {
    const path = join(
      mkdtempSync(join(tmpdir(), "chog-pvp-")),
      "holders.sqlite",
    );
    const { service, invite } = officialRoom(path);
    await expect(
      service.confirmReady(B, invite, true, NOW, grantB),
    ).rejects.toThrow(/verification is unavailable/);
    const view = service.preview(invite, B, NOW);
    expect(view.seated && view.battle).toBeFalsy();
    const host = service.preview(invite, A, NOW);
    expect(host.seated && host.you.characterId).toBe("aegis");
    expect(host.seated && host.series?.outcome).toBeNull();
    service.records.store.close();
  });

  it("opens one holder match after both stored grants pass", async () => {
    const path = join(
      mkdtempSync(join(tmpdir(), "chog-pvp-")),
      "holders.sqlite",
    );
    const records = new PvpStore(new Store(path));
    const service = new PvpService(
      records,
      PVP_TIMERS,
      undefined,
      async () => [],
    );
    const created = service.create({ actor: A, mode: "official" }, NOW);
    service.join({ actor: B, mode: "official" }, created.invite, NOW);
    service.select(A, created.invite, "aegis", NOW, grantA);
    service.select(B, created.invite, "nyx", NOW, grantB);
    service.ready(A, created.invite, true, NOW, grantA);
    const opened = await service.confirmReady(
      B,
      created.invite,
      true,
      NOW,
      grantB,
    );
    expect(opened.phase).toBe("loading");
    records.store.close();
  });

  it("still reads a seat saved before holder grants existed", () => {
    const room = seated();
    const saved = pvpRoomSchema.parse(room);
    const legacy = JSON.parse(JSON.stringify(saved)) as {
      seats: { a: { holderGrant?: unknown } };
    };
    delete legacy.seats.a.holderGrant;
    expect(pvpRoomSchema.parse(legacy).seats.a?.holderGrant).toBeNull();
  });

  it("does not treat a direct ready as a completed holder check", () => {
    const path = join(
      mkdtempSync(join(tmpdir(), "chog-pvp-")),
      "holders.sqlite",
    );
    const { service, invite } = officialRoom(path);
    expect(() => service.ready(B, invite, true, NOW, grantB)).toThrow(
      ServiceError,
    );
    const view = service.preview(invite, A, NOW);
    expect(view.seated && view.phase).not.toBe("loading");
    service.records.store.close();
  });
});

describe("turn-clock elapsed display", () => {
  it("counts down between polls independent of the client's absolute clock", () => {
    expect(remainingSeconds(1000, 31000, 9000000, 9005000)).toBe(25);
    expect(remainingSeconds(1000, 31000, 50, 5050)).toBe(25);
    expect(remainingSeconds(1000, 31000, 50, 40050)).toBe(0);
    expect(remainingSeconds(1000, 31000, 50, 40)).toBe(30);
  });
});
