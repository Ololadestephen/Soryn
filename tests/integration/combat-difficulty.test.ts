import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import { Store } from "../../src/server/persistence";
import { BattleStore } from "../../src/server/combat/persistence";
import { BattleService } from "../../src/server/combat/service";
import { difficultyLabel } from "../../src/domain/combat/difficulty/contracts";
import { chooseOpponent } from "../../src/domain/combat/policy";
import { initialCombat } from "../../src/domain/combat/engine";

describe("difficulty-bound battle records", () => {
  for (const mode of ["easy", "medium", "hard"] as const)
    it(`${mode} persists pending choice, exact replay, result and rematch budget`, () => {
      const store = new Store(":memory:");
      try {
        const actor = randomUUID(),
          id = randomUUID(),
          service = new BattleService(new BattleStore(store));
        let view = service.start({
          actor: actor,
          id: id,
          player: "pip",
          opponent: "bolt",
          authority: null,
          difficulty: mode,
        });
        const pending = service.records.get(id, actor).pending;
        expect(
          service.start({
            actor: actor,
            id: id,
            player: "pip",
            opponent: "bolt",
            authority: null,
            difficulty: mode,
          }),
        ).toEqual(view);
        expect(() =>
          service.start({
            actor: actor,
            id: id,
            player: "pip",
            opponent: "bolt",
            authority: null,
            difficulty: mode === "easy" ? "hard" : "easy",
          }),
        ).toThrow("another loadout");
        expect(service.session(actor, "guest").battle?.snapshot).toEqual(
          view.snapshot,
        );
        view = service.step(actor, id, 1, "special");
        expect(view.rounds[0].opponent).toBe(pending?.move);
        expect(service.step(actor, id, 1, "special")).toEqual(view);
        while (!view.state.outcome)
          view = service.step(
            actor,
            id,
            view.state.round,
            view.legal.includes("special") ? "special" : "basic",
          );
        expect(service.session(actor, "guest").history[0].difficulty).toBe(
          mode,
        );
        const rematch = service.start({
          actor: actor,
          id: randomUUID(),
          player: "pip",
          opponent: "bolt",
          authority: null,
          difficulty: mode,
        });
        expect(rematch.snapshot).toEqual(view.snapshot);
        expect(rematch.state.player.health).toBe(84);
        expect(rematch.rounds).toHaveLength(0);
      } finally {
        store.close();
      }
    });
  it("a stored legacy match has no invented difficulty and retains its original computer choices", () => {
    const store = new Store(":memory:");
    try {
      const actor = randomUUID(),
        id = randomUUID(),
        service = new BattleService(new BattleStore(store));
      const legacy = service.start({
        actor: actor,
        id: id,
        player: "pip",
        opponent: "bolt",
      });
      const raw = String(
        store.db.prepare("SELECT record FROM battles WHERE id=?").get(id)
          ?.record,
      );
      expect(raw).not.toContain('"difficulty"');
      const pending = service.records.get(id, actor).pending;
      expect(pending).toEqual(
        chooseOpponent(legacy.snapshot, initialCombat(legacy.snapshot)),
      );
      expect(pending?.move).toBe("special");
      expect(difficultyLabel(legacy.snapshot)).toBe("Legacy policy");
      expect(() =>
        service.start({
          actor: actor,
          id: id,
          player: "pip",
          opponent: "bolt",
          authority: null,
          difficulty: "medium",
        }),
      ).toThrow("another loadout");
      expect(
        store.db.prepare("SELECT record FROM battles WHERE id=?").get(id)
          ?.record,
      ).toBe(raw);
      expect(service.step(actor, id, 1, "guard").rounds[0].opponent).toBe(
        "special",
      );
    } finally {
      store.close();
    }
  });
});
