import { describe, it, expect } from "vitest";
import {
  combatSnapshot,
  difficultySnapshot,
  fighters,
} from "../../src/domain/combat/definitions";
import { initialCombat, resolveRound } from "../../src/domain/combat/engine";
import { chooseOpponent } from "../../src/domain/combat/policy";
import { legalMoves } from "../../src/domain/combat/moves";
import {
  snapshotSchema,
  type Difficulty,
} from "../../src/domain/combat/contracts";
import { playerDistribution } from "../../src/domain/combat/difficulty/distribution";

describe("versioned computer difficulty without stat changes", () => {
  it("all modes freeze identical fighter/rule stats and reject missing/invalid difficulty", () => {
    const legacy = combatSnapshot("pip", "bolt");
    expect(legacy).not.toHaveProperty("difficulty");
    for (const mode of ["easy", "medium", "hard"] as const) {
      const snapshot = difficultySnapshot("pip", "bolt", mode);
      expect(snapshot.player).toEqual(legacy.player);
      expect(snapshot.opponent).toEqual(legacy.opponent);
      expect(snapshot.rules).toBe(legacy.rules);
    }
    expect(() =>
      snapshotSchema.parse({ ...legacy, policy: "combat-opponent/2" }),
    ).toThrow();
    expect(() =>
      snapshotSchema.parse({ ...legacy, difficulty: "easy" }),
    ).toThrow();
    expect(() =>
      difficultySnapshot("pip", "bolt", "expert" as Difficulty),
    ).toThrow();
  });
  it("public fixtures demonstrate real decisions, not labels", () => {
    const modes = ["easy", "medium", "hard"] as const;
    const choices = modes.map((mode) => {
      const snap = difficultySnapshot("pip", "bolt", mode);
      return chooseOpponent(snap, initialCombat(snap)).move;
    });
    expect(choices[0]).toBe("basic");
    expect(choices[1]).toBe("special");
    const snap = difficultySnapshot("pip", "aegis", "hard"),
      state = initialCombat(snap);
    state.opponent.health = 5;
    state.opponent.energy = 2;
    state.round = 2;
    expect(chooseOpponent(snap, state).move).toBe("guard");
    expect(
      chooseOpponent(difficultySnapshot("pip", "aegis", "medium"), state).move,
    ).toBe("basic");
  });
  it("medium conserves recovery at full health and hard can exploit a public exposed opening", () => {
    const medium = difficultySnapshot("pip", "patch", "medium");
    expect(chooseOpponent(medium, initialCombat(medium)).move).toBe("basic");
    const hard = difficultySnapshot("pip", "prism", "hard"),
      state = initialCombat(hard);
    state.player.health = 8;
    state.player.effects.exposed = 2;
    state.opponent.cooldown = 2;
    expect(chooseOpponent(hard, state).move).toBe("basic");
  });
  it("limited completed evidence adjusts a declared legal reply distribution", () => {
    const snap = difficultySnapshot("pip", "bolt", "hard"),
      state = initialCombat(snap);
    const repeated = Array.from({ length: 6 }, () => ({
      player: "guard" as const,
      opponent: "basic" as const,
    }));
    expect(
      playerDistribution(snap, state, repeated).find((x) => x.move === "guard")!
        .weight,
    ).toBeGreaterThan(0.2);
    expect(playerDistribution(snap, state, repeated.slice(0, 2))).toEqual(
      playerDistribution(snap, state, []),
    );
  });
  for (const mode of ["easy", "medium", "hard"] as const)
    it(`${mode}: legal, deterministic and independent of current intent across every fighter`, () => {
      for (const f of fighters) {
        const snap = difficultySnapshot("pip", f.id, mode);
        let state = initialCombat(snap);
        const history: {
          player: "basic" | "special" | "guard";
          opponent: "basic" | "special" | "guard";
        }[] = [];
        while (!state.outcome) {
          const pending = chooseOpponent(snap, state, history);
          expect(legalMoves(snap, state, "opponent")).toContain(pending.move);
          const original = structuredClone(state);
          for (const intended of legalMoves(snap, state, "player")) {
            resolveRound(snap, state, intended, pending.move);
            expect(chooseOpponent(snap, state, history)).toEqual(pending);
          }
          expect(state).toEqual(original);
          const player = legalMoves(snap, state, "player").includes("special")
            ? "special"
            : "basic";
          history.push({ player, opponent: pending.move });
          state = resolveRound(snap, state, player, pending.move).state;
        }
      }
    });
  for (const id of ["pip", "bolt", "patch", "moss"] as const)
    it(`${id} wins the introductory Easy Bolt encounter`, () => {
      const snap = difficultySnapshot(id, "bolt", "easy");
      let state = initialCombat(snap);
      while (!state.outcome) {
        const legal = legalMoves(snap, state, "player");
        const move =
          legal.includes("special") &&
          (id !== "patch" || state.player.health <= 76)
            ? "special"
            : "basic";
        state = resolveRound(
          snap,
          state,
          move,
          chooseOpponent(snap, state).move,
        ).state;
      }
      expect(state.outcome).toBe("victory");
    });
  it("Easy is a real opponent and can defeat poor fixed play", () => {
    const snap = difficultySnapshot("pip", "prism", "easy");
    let state = initialCombat(snap);
    while (!state.outcome)
      state = resolveRound(
        snap,
        state,
        "basic",
        chooseOpponent(snap, state).move,
      ).state;
    expect(state.outcome).toBe("defeat");
  });
});
