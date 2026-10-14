import { describe, it, expect } from "vitest";
import { combatSnapshot } from "../../src/domain/combat/definitions";
import { initialCombat, resolveRound } from "../../src/domain/combat/engine";
import { presentationFrames } from "../../src/domain/combat/presentation/project";
import {
  moveNotice,
  noticeDuration,
  updateMoveNotice,
  type MoveNoticeState,
} from "../../src/domain/combat/presentation/notices";
import { fighterPose } from "../../src/components/combat/rendered/pose";
import type { BattleView, Move } from "../../src/domain/combat/contracts";

function recorded(
  player: BattleView["snapshot"]["player"]["id"],
  foe: BattleView["snapshot"]["opponent"]["id"],
  move: Move,
  reply: Move,
  weak = false,
) {
  const snapshot = combatSnapshot(player, foe);
  const state = initialCombat(snapshot);
  if (weak) state.opponent.health = 1;
  const resolved = resolveRound(snapshot, state, move, reply);
  const before: BattleView = {
    id: "notice-fixture",
    mode: "guest",
    tokenId: null,
    snapshot,
    state,
    rounds: [],
    legal: [],
  };
  const battle: BattleView = {
    ...before,
    state: resolved.state,
    rounds: [resolved.round],
  };
  return { battle, frames: presentationFrames(battle, before) };
}
describe("executed move notices and rendered poses", () => {
  it("replaces the active notice, remembers dismissal and clears terminal or previous-battle notices", () => {
    const initial: MoveNoticeState = {
      battleId: "first",
      active: null,
      seen: new Set(),
    };
    const first = { id: "first:1:player", label: "Shield Bash" };
    const next = { id: "first:1:opponent", label: "Ember Burst" };
    const replaced = updateMoveNotice(
      updateMoveNotice(initial, "first", first, false),
      "first",
      next,
      false,
    );
    expect(replaced.active).toEqual(next);
    expect(updateMoveNotice(replaced, "first", first, false)).toBe(replaced);
    const dismissed = { ...replaced, active: null };
    expect(updateMoveNotice(dismissed, "first", next, false)).toBe(dismissed);
    expect(updateMoveNotice(replaced, "first", next, true).active).toBeNull();
    const rematch = updateMoveNotice(replaced, "second", null, false);
    expect(rematch.active).toBeNull();
    expect(rematch.seen.size).toBe(0);
    const fresh = { ...first, id: "second:1:player" };
    expect(updateMoveNotice(rematch, "second", fresh, false).active).toEqual(
      fresh,
    );
  });
  it("names the new attack during its wind-up before contact, without announcing it again at delivery", () => {
    const { battle, frames } = recorded("aegis", "ember", "special", "basic");
    const windup = frames.find(
      (f) => f.event.side === "player" && f.phase === "anticipation",
    );
    const delivery = frames.find(
      (f) => f.event.side === "player" && f.phase === "action",
    );
    if (!windup || !delivery) throw new Error("Attack projection missing");
    expect(moveNotice(battle, windup)?.label).toBe("Aegis · Shield Bash");
    expect(moveNotice(battle, delivery)).toBeNull();
    expect(moveNotice({ ...battle, id: "rematch" }, windup)).toBeNull();
  });
  it("uses exact executed names with one stable identity per side/round, never per hit", () => {
    const { battle, frames } = recorded("echo", "bolt", "special", "special");
    const notices = frames.flatMap((f) => moveNotice(battle, f) ?? []);
    expect(notices).toHaveLength(2);
    expect(new Set(notices.map((n) => n.id)).size).toBe(2);
    expect(notices[0].label).toContain("Express Delivery");
    expect(notices[1].label).toContain(
      battle.snapshot.player.moves.special.name,
    );
    expect(noticeDuration).toBe(3000);
    expect(moveNotice(battle, null)).toBeNull();
    expect(presentationFrames(battle, battle)).toEqual([]);
  });
  it("announces executed defence and actual repair, but not prepared cancelled specials or counter hits", () => {
    const blocked = recorded("atlas", "aegis", "special", "guard");
    expect(blocked.frames.some((f) => f.event.kind === "counter")).toBe(true);
    expect(
      blocked.frames
        .filter((f) => f.event.kind === "counter")
        .every((f) => moveNotice(blocked.battle, f) === null),
    ).toBe(true);
    expect(
      blocked.frames.flatMap((f) => moveNotice(blocked.battle, f) ?? []),
    ).toHaveLength(2);
    const repair = recorded("patch", "ember", "special", "special");
    expect(
      repair.frames
        .flatMap((f) => moveNotice(repair.battle, f) ?? [])
        .some((n) => n.label === "Patch · Field Repair"),
    ).toBe(true);
    const cancelled = recorded("nyx", "aegis", "special", "special", true);
    expect(cancelled.frames.some((f) => f.event.kind === "cancel")).toBe(true);
    expect(
      cancelled.frames
        .flatMap((f) => moveNotice(cancelled.battle, f) ?? [])
        .some((n) => n.label.startsWith("Aegis")),
    ).toBe(false);
  });
  it("poses follow real health/guard/action frames and knockout overrides pending movement", () => {
    const { battle, frames } = recorded("aegis", "ember", "special", "special");
    const action = frames.find(
      (f) => f.event.side === "player" && f.phase === "action",
    )!;
    expect(fighterPose(action.event.state, action, "player")).toBe("strike");
    const anticipation = frames.find(
      (f) => f.event.side === "player" && f.phase === "anticipation",
    )!;
    expect(fighterPose(anticipation.event.state, anticipation, "player")).toBe(
      "windup",
    );
    const hit = frames.find(
      (f) => f.cue?.target === "player" && f.cue?.amount,
    )!;
    expect(fighterPose(hit.event.state, hit, "player")).toBe("hit");
    const terminal = structuredClone(battle.state);
    terminal.player.health = 0;
    expect(fighterPose(terminal, action, "player")).toBe("defeated");
    const repair = recorded("patch", "ember", "special", "special");
    for (const frame of repair.frames.filter((f) => f.event.kind === "heal"))
      expect(fighterPose(frame.event.state, frame, "player")).not.toBe(
        "strike",
      );
  });
});
