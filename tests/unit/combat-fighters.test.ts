import { describe, it, expect } from "vitest";
import { fighters, combatSnapshot } from "../../src/domain/combat/definitions";
import { initialCombat, resolveRound } from "../../src/domain/combat/engine";
import { legalMoves, initiative } from "../../src/domain/combat/moves";
import { chooseOpponent } from "../../src/domain/combat/policy";

describe("all twelve completed combat kits", () => {
  for (const fighter of fighters) {
    it(`${fighter.id}: basic, special and guard execute with bounded resources and legal presentation`, () => {
      const snapshot = combatSnapshot(fighter.id, "pip");
      const start = initialCombat(snapshot);
      start.player.energy = 6;
      start.player.health = 40;
      const basic = resolveRound(snapshot, start, "basic", "basic");
      expect(basic.state.opponent.health).toBeLessThan(84);
      expect(
        basic.round.events.some(
          (event) =>
            event.side === "player" && ["melee", "ranged"].includes(event.kind),
        ),
      ).toBe(true);
      const special = resolveRound(snapshot, start, "special", "guard");
      expect(special.state.player.cooldown).toBe(
        fighter.moves.special.cooldown,
      );
      if (fighter.id === "patch") expect(special.state.player.health).toBe(54);
      else if (fighter.id === "moss")
        expect(special.state.player.health).toBe(46);
      else expect(special.state.opponent.health).toBeLessThan(84);
      const defended = resolveRound(snapshot, start, "guard", "basic");
      expect(defended.state.player.health).toBeGreaterThanOrEqual(
        basic.state.player.health,
      );
      expect(
        defended.round.events.filter(
          (event) =>
            event.side === "player" && ["melee", "ranged"].includes(event.kind),
        ),
      ).toEqual([]);
      for (const result of [basic, special, defended]) {
        for (const side of ["player", "opponent"] as const) {
          expect(result.state[side].health).toBeGreaterThanOrEqual(0);
          expect(result.state[side].health).toBeLessThanOrEqual(
            snapshot[side].health,
          );
          expect(result.state[side].energy).toBeGreaterThanOrEqual(0);
          expect(result.state[side].energy).toBeLessThanOrEqual(6);
        }
        expect(
          resolveRound(
            snapshot,
            start,
            result.round.player,
            result.round.opponent,
          ),
        ).toEqual(result);
      }
    });
  }
  it("Pip/Prism expose actual defence; both passives use only public resources/effects", () => {
    for (const id of ["pip", "prism"] as const) {
      const snapshot = combatSnapshot(id, "atlas"),
        start = initialCombat(snapshot);
      let state = resolveRound(snapshot, start, "special", "basic").state;
      expect(state.opponent.effects.exposed).toBe(2);
      const next = resolveRound(snapshot, state, "basic", "guard");
      expect(
        next.round.events.find(
          (event) => event.kind === "impact" && event.side === "player",
        )?.message,
      ).toContain(id === "prism" ? "7 damage" : "4 damage");
      state = resolveRound(snapshot, state, "guard", "guard").state;
      expect(state.opponent.effects.exposed).toBe(1);
      state = resolveRound(snapshot, state, "guard", "guard").state;
      expect(state.opponent.effects.exposed).toBe(0);
    }
    const pip = combatSnapshot("pip", "pip"),
      start = initialCombat(pip);
    start.opponent.energy = 2;
    expect(
      resolveRound(pip, start, "basic", "basic").state.opponent.health,
    ).toBe(70);
  });
  it("Bolt's two hits consume one shared shield and gain guard energy", () => {
    const snapshot = combatSnapshot("bolt", "pip"),
      start = initialCombat(snapshot);
    const result = resolveRound(snapshot, start, "special", "guard");
    expect(result.state.opponent.health).toBe(78);
    expect(
      result.round.events.filter(
        (event) => event.kind === "impact" && event.side === "player",
      ),
    ).toHaveLength(2);
    start.player.energy = 0;
    expect(
      resolveRound(snapshot, start, "guard", "guard").state.player.energy,
    ).toBe(3);
  });
  it("Patch repairs within cap, has energy armour and consumes prepared equipment once", () => {
    const snapshot = combatSnapshot("patch", "pip"),
      start = initialCombat(snapshot);
    start.player.health = 85;
    expect(
      resolveRound(snapshot, start, "special", "guard").state.player.health,
    ).toBe(90);
    const armour = resolveRound(snapshot, start, "guard", "basic");
    expect(armour.state.player.health).toBe(84); // 12 - 3 armour - 8 shield
    expect(armour.state.player.effects.focus).toBe(3);
    const attack = resolveRound(snapshot, armour.state, "basic", "guard");
    expect(attack.state.opponent.health).toBe(79);
    expect(attack.state.player.effects.focus).toBe(0);
  });
  it("Moss heals on guard and cleanses a faster newly-applied Flux interruption", () => {
    const snapshot = combatSnapshot("moss", "flux"),
      start = initialCombat(snapshot);
    start.player.health = 40;
    const guard = resolveRound(snapshot, start, "guard", "basic");
    expect(guard.state.player.health).toBe(39); // 12-1-8 then +2
    const cleaned = resolveRound(snapshot, start, "special", "special");
    expect(cleaned.state.player.effects.disrupt).toBe(0);
    expect(
      cleaned.round.events.some((event) =>
        event.message.includes("removes old"),
      ),
    ).toBe(true);
  });
  it("Aegis counters once, armour bounds retaliation, and shield special still attacks", () => {
    const snapshot = combatSnapshot("aegis", "atlas"),
      start = initialCombat(snapshot);
    const guard = resolveRound(snapshot, start, "guard", "special");
    expect(guard.state.player.health).toBe(89);
    expect(guard.state.opponent.health).toBe(111);
    expect(
      guard.round.events.filter((event) => event.kind === "counter"),
    ).toHaveLength(1);
    expect(
      resolveRound(snapshot, start, "special", "special").state.opponent.health,
    ).toBe(99);
  });
  it("Nyx dodges one basic but a special lands; pierce and first-round speed work", () => {
    const snapshot = combatSnapshot("nyx", "atlas"),
      start = initialCombat(snapshot);
    expect(
      resolveRound(snapshot, start, "guard", "basic").state.player.health,
    ).toBe(84);
    expect(
      resolveRound(snapshot, start, "guard", "special").state.player.health,
    ).toBe(62);
    const strike = resolveRound(snapshot, start, "special", "guard");
    expect(strike.state.opponent.health).toBe(105);
    const tie = combatSnapshot("nyx", "nyx"),
      same = initialCombat(tie);
    expect(initiative(tie, same, "player", "basic")).toBe(11);
    same.round = 2;
    expect(initiative(tie, same, "player", "basic")).toBe(9);
    expect(
      resolveRound(tie, same, "basic", "basic").round.events.some(
        (event) => event.kind === "melee",
      ),
    ).toBe(true);
  });
  it("Echo decoy is finite; a volley consumes it across hits and guard decoy expires", () => {
    const snapshot = combatSnapshot("echo", "bolt"),
      start = initialCombat(snapshot);
    const volley = resolveRound(snapshot, start, "guard", "special");
    expect(volley.state.player.health).toBe(82); // 16 - decoy6 - shield4
    expect(volley.state.player.effects.decoy).toBe(0);
    expect(
      resolveRound(snapshot, start, "basic", "basic").state.player.health,
    ).toBe(84);
  });
  it("Atlas commits heavy damage slowly and spends guard preparation once", () => {
    const snapshot = combatSnapshot("atlas", "pip"),
      start = initialCombat(snapshot);
    const guarded = resolveRound(snapshot, start, "guard", "guard").state;
    expect(guarded.player.effects.focus).toBe(4);
    const strike = resolveRound(snapshot, guarded, "basic", "guard");
    expect(strike.state.opponent.health).toBe(75);
    expect(strike.state.player.effects.focus).toBe(0);
    expect(
      strike.round.events.find(
        (event) => event.kind === "melee" || event.kind === "ranged",
      )?.side,
    ).toBe("player");
  });
  it("Flux disrupts only next selection; a slower already-locked special still happens", () => {
    const snapshot = combatSnapshot("flux", "moss"),
      start = initialCombat(snapshot);
    const strike = resolveRound(snapshot, start, "special", "basic");
    expect(strike.state.opponent.effects.disrupt).toBe(1);
    expect(legalMoves(snapshot, strike.state, "opponent")).not.toContain(
      "special",
    );
    const next = resolveRound(snapshot, strike.state, "basic", "guard");
    expect(next.state.opponent.effects.disrupt).toBe(0);
    expect(
      next.round.events.find(
        (event) => event.side === "player" && event.kind === "impact",
      )?.message,
    ).toContain("6 damage");
  });
  it("Ember trades recoil for real burst and burn; burn cannot stack or run indefinitely", () => {
    const snapshot = combatSnapshot("ember", "atlas"),
      start = initialCombat(snapshot);
    let state = resolveRound(snapshot, start, "special", "guard").state;
    expect(state.player.health).toBe(89);
    expect(state.opponent.health).toBe(96); // 28 - armour3 - shield12 + burn3
    expect(state.opponent.effects.burn).toBe(2);
    for (let n = 0; n < 2; n++)
      state = resolveRound(snapshot, state, "guard", "guard").state;
    expect(state.opponent.effects.burn).toBe(0);
    start.player.health = 48;
    expect(
      resolveRound(snapshot, start, "basic", "guard").state.opponent.health,
    ).toBe(110);
  });
  it("Mneme benefits only from an actually completed repeated move", () => {
    const snapshot = combatSnapshot("mneme", "pip"),
      start = initialCombat(snapshot);
    expect(
      resolveRound(snapshot, start, "special", "guard").state.opponent.health,
    ).toBe(76);
    start.opponent.lastMove = "guard";
    expect(
      resolveRound(snapshot, start, "special", "guard").state.opponent.health,
    ).toBe(70);
    expect(
      resolveRound(snapshot, start, "basic", "guard").state.opponent.health,
    ).toBe(79);
    expect(
      resolveRound(snapshot, start, "special", "basic").state.opponent.health,
    ).toBe(66);
  });
});

describe("computer fairness, terminal resolution and match bounds", () => {
  it("knockout cancels a queued attack without a projectile or lunge", () => {
    const snapshot = combatSnapshot("bolt", "pip"),
      start = initialCombat(snapshot);
    start.opponent.health = 5;
    const result = resolveRound(snapshot, start, "basic", "special");
    expect(result.state.outcome).toBe("victory");
    expect(
      result.round.events.some(
        (event) => event.side === "opponent" && event.kind === "cancel",
      ),
    ).toBe(true);
    expect(
      result.round.events.filter(
        (event) =>
          event.side === "opponent" && ["ranged", "melee"].includes(event.kind),
      ),
    ).toEqual([]);
    expect(result.state.opponent.energy).toBe(1); // locked cost remains spent
  });
  it("end-of-round burn uses a simultaneous snapshot, yielding a draw", () => {
    const snapshot = combatSnapshot("pip", "pip"),
      start = initialCombat(snapshot);
    start.player.health = 2;
    start.opponent.health = 3;
    start.player.effects.burn = 1;
    start.opponent.effects.burn = 1;
    expect(resolveRound(snapshot, start, "guard", "guard").state.outcome).toBe(
      "draw",
    );
  });
  it("caps healing/guard stalemates at 20 rounds with no resurrection", () => {
    const snapshot = combatSnapshot("patch", "moss");
    let state = initialCombat(snapshot);
    for (let n = 0; n < 20; n++)
      state = resolveRound(snapshot, state, "guard", "guard").state;
    expect(state.outcome).toBe("draw");
    expect(state.player.energy).toBe(6);
    expect(() => resolveRound(snapshot, state, "guard", "guard")).toThrow();
  });
  it("policy input is pre-round public state; selection cannot depend on current player intent", () => {
    const snapshot = combatSnapshot("pip", "bolt"),
      state = initialCombat(snapshot);
    const choice = chooseOpponent(snapshot, state);
    for (const move of legalMoves(snapshot, state, "player")) {
      const result = resolveRound(
        snapshot,
        state,
        move,
        choice.move,
        choice.reason,
      );
      expect(result.round.opponent).toBe(choice.move);
      expect(chooseOpponent(snapshot, state)).toEqual(choice);
    }
    expect(
      chooseOpponent(
        combatSnapshot("pip", "patch"),
        initialCombat(combatSnapshot("pip", "patch")),
      ).move,
    ).toBe("basic");
  });
  for (const id of ["pip", "bolt", "patch", "moss"] as const)
    it(`${id} wins the intended Bolt encounter without holder resources`, () => {
      for (const tie of [0, 1] as const) {
        const snapshot = combatSnapshot(id, "bolt", tie);
        let state = initialCombat(snapshot);
        while (!state.outcome) {
          const legal = legalMoves(snapshot, state, "player");
          const special =
            legal.includes("special") &&
            (id !== "patch" || state.player.health <= 76);
          const player = special
            ? "special"
            : legal.includes("basic")
              ? "basic"
              : "guard";
          const foe = chooseOpponent(snapshot, state);
          state = resolveRound(
            snapshot,
            state,
            player,
            foe.move,
            foe.reason,
          ).state;
        }
        expect(state.outcome).toBe("victory");
      }
    });
});
