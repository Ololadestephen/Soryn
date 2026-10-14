import { describe, it, expect } from "vitest";
import { combatSnapshot } from "../../src/domain/combat/definitions";
import { initialCombat, resolveRound } from "../../src/domain/combat/engine";
import { chooseOpponent } from "../../src/domain/combat/policy";
import { legalMoves, initiativeOrder } from "../../src/domain/combat/moves";

describe("first complete Pip/Bolt combat rules", () => {
  it("prepares slow defence before a fast opponent attack and resolves costs/recovery", () => {
    const snapshot = combatSnapshot("pip");
    const state = initialCombat(snapshot);
    const resolved = resolveRound(snapshot, state, "guard", "special");
    expect(
      resolved.round.events
        .slice(0, 2)
        .every((event) => event.kind === "prepare"),
    ).toBe(true);
    expect(resolved.state.player.health).toBe(78); // 16 minus the prepared 10 shield
    expect(resolved.state.opponent.energy).toBe(3);
    expect(resolved.state.player.energy).toBe(6);
    expect(state.player.health).toBe(84);
    expect(resolveRound(snapshot, state, "guard", "special")).toEqual(resolved);
  });
  it("has a tested Pip winning strategy against the independent computer Bolt", () => {
    const snapshot = combatSnapshot("pip");
    let state = initialCombat(snapshot);
    while (!state.outcome) {
      const choice = chooseOpponent(snapshot, state);
      const move = legalMoves(snapshot, state, "player").includes("special")
        ? "special"
        : "basic";
      state = resolveRound(
        snapshot,
        state,
        move,
        choice.move,
        choice.reason,
      ).state;
    }
    expect(state.outcome).toBe("victory");
    expect(state.round).toBeLessThan(21);
  });
  it("retains special cooldown for two full following rounds and rejects exhausted/terminal moves", () => {
    const snapshot = combatSnapshot("pip", "moss");
    let state = resolveRound(
      snapshot,
      initialCombat(snapshot),
      "special",
      "guard",
    ).state;
    expect(state.player.cooldown).toBe(2);
    expect(legalMoves(snapshot, state, "player")).not.toContain("special");
    state = resolveRound(snapshot, state, "guard", "guard").state;
    expect(state.player.cooldown).toBe(1);
    state = resolveRound(snapshot, state, "guard", "guard").state;
    expect(legalMoves(snapshot, state, "player")).toContain("special");
    state.player.energy = 0;
    expect(() => resolveRound(snapshot, state, "basic", "guard")).toThrow(
      "Illegal",
    );
    state.outcome = "draw";
    expect(() => resolveRound(snapshot, state, "guard", "guard")).toThrow();
  });
  it("uses reproducible alternating initiative ties", () => {
    const snapshot = combatSnapshot("pip", "pip", 0),
      state = initialCombat(snapshot);
    expect(
      initiativeOrder(snapshot, state, { player: "basic", opponent: "basic" }),
    ).toEqual(["opponent", "player"]);
    state.round = 2;
    expect(
      initiativeOrder(snapshot, state, { player: "basic", opponent: "basic" }),
    ).toEqual(["player", "opponent"]);
  });
});
