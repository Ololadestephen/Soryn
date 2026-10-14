import { describe, it, expect } from "vitest";
import { combatSnapshot } from "../../src/domain/combat/definitions";
import { initialCombat, resolveRound } from "../../src/domain/combat/engine";
import { presentationFrames } from "../../src/domain/combat/presentation/project";
import {
  pilotSelection,
  petSelection,
  presentationDuration,
} from "../../src/domain/combat/presentation/blender";
import type { BattleView, Move } from "../../src/domain/combat/contracts";

function encounter(move: Move, reply: Move, weak = false) {
  const snapshot = combatSnapshot("aegis", "ember");
  const state = initialCombat(snapshot);
  if (weak) state.player.health = 1;
  const previous: BattleView = {
    id: "pilot-fixture",
    mode: "guest",
    tokenId: null,
    snapshot,
    state,
    rounds: [],
    legal: [],
  };
  const resolved = resolveRound(snapshot, state, move, reply);
  const battle: BattleView = {
    ...previous,
    state: resolved.state,
    rounds: [resolved.round],
  };
  return { battle, previous, frames: presentationFrames(battle, previous) };
}
describe("Blender presentation follows authoritative events", () => {
  it("prepares the shield, reacts to actual damage and coordinates the real special phases", () => {
    const { battle, frames } = encounter("special", "special");
    let memory = null;
    const selected = [];
    for (const frame of frames) {
      memory = pilotSelection(memory, battle, frame, "player");
      selected.push({ frame, selection: memory.selection });
    }
    expect(
      selected.find((s) => s.frame.event.kind === "prepare")?.selection.clip,
    ).toBe("guard");
    const windup = selected.find(
      (s) =>
        s.frame.event.side === "player" && s.frame.phase === "anticipation",
    );
    expect(windup?.selection).toMatchObject({
      clip: "special",
      first: 0,
      last: 5,
      duration: 240,
    });
    const delivery = selected.find(
      (s) => s.frame.event.side === "player" && s.frame.phase === "action",
    );
    expect(delivery?.selection).toMatchObject({
      clip: "special",
      first: 6,
      last: 17,
      duration: 480,
    });
    if (!delivery) throw new Error("Missing actual special delivery");
    expect(petSelection(battle, delivery.frame, "player")).toMatchObject({
      clip: "special",
      first: 6,
      last: 17,
    });
    expect(selected.some((s) => s.selection.clip === "guard-hit")).toBe(true);
    expect(pilotSelection(memory, battle, null, "player").selection.clip).toBe(
      "idle",
    );
  });
  it("keeps knockout stable, rejects cancelled attacks and refreshes to defeated hold", () => {
    const { battle, frames } = encounter("special", "special", true);
    expect(frames.some((f) => f.event.kind === "cancel")).toBe(true);
    let memory = null;
    let key: string | null = null;
    for (const frame of frames) {
      memory = pilotSelection(memory, battle, frame, "player");
      if (frame.event.state.player.health === 0) {
        expect(memory.selection.clip).toMatch(/knockout$/);
        if (key) expect(memory.selection.key).toBe(key);
        key = memory.selection.key;
        expect(petSelection(battle, frame, "player").clip).toBe("defeated");
      }
      if (frame.event.kind === "cancel")
        expect(memory.selection.clip).not.toBe("special");
    }
    expect(pilotSelection(memory, battle, null, "player").selection.key).toBe(
      key,
    );
    expect(pilotSelection(null, battle, null, "player").selection.clip).toBe(
      "defeated",
    );
    const knockout = frames.find(
      (f) => f.event.kind === "knockout" && f.event.side === "player",
    );
    if (!knockout) throw new Error("Missing real knockout event");
    expect(presentationDuration(battle, knockout)).toBe(900);
  });
  it("does not replay duplicate frames, clears rematches and respects terminal recovery without playback", () => {
    const { battle, previous, frames } = encounter("basic", "basic");
    const frame = frames.find(
      (f) => f.event.side === "player" && f.phase === "action",
    );
    if (!frame) throw new Error("No executed basic attack");
    const memory = pilotSelection(null, battle, frame, "player");
    expect(pilotSelection(memory, battle, frame, "player")).toBe(memory);
    const rematch = { ...previous, id: "rematch" };
    expect(
      pilotSelection(memory, rematch, frame, "player").selection.clip,
    ).toBe("idle");
    const idle = pilotSelection(null, previous, null, "player");
    const terminal = structuredClone(previous);
    terminal.state.player.health = 0;
    expect(pilotSelection(idle, terminal, null, "player").selection.clip).toBe(
      "defeated",
    );
  });
});
