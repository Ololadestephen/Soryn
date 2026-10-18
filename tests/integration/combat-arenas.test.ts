import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import { Store } from "../../src/server/persistence";
import { BattleStore } from "../../src/server/combat/persistence";
import { BattleService } from "../../src/server/combat/service";
import { arenaIds, arenaChoiceSchema } from "../../src/domain/combat/arenas";

describe("cosmetic arena persistence", () => {
  it("all four arenas produce identical frozen rules, choices, resource states and complete outcomes", () => {
    const encounters = [];
    for (const arena of arenaIds) {
      const store = new Store(":memory:");
      try {
        const service = new BattleService(new BattleStore(store)),
          actor = randomUUID(),
          id = randomUUID();
        let battle = service.start({
          actor: actor,
          id: id,
          player: "pip",
          opponent: "bolt",
          authority: null,
          difficulty: "hard",
          arenaChoice: arena,
        });
        expect(battle.arena).toBe(arena);
        expect(
          service.start({
            actor: actor,
            id: id,
            player: "pip",
            opponent: "bolt",
            authority: null,
            difficulty: "hard",
            arenaChoice: arena,
          }),
        ).toEqual(battle);
        expect(() =>
          service.start({
            actor: actor,
            id: id,
            player: "pip",
            opponent: "bolt",
            authority: null,
            difficulty: "hard",
            arenaChoice: arena === "sky" ? "grove" : "sky",
          }),
        ).toThrow("another loadout");
        while (!battle.state.outcome)
          battle = service.step(
            actor,
            id,
            battle.state.round,
            battle.legal.includes("special") ? "special" : "basic",
          );
        expect(service.session(actor, "guest").history[0].arena).toBe(arena);
        const restored = new BattleService(new BattleStore(store)).session(
          actor,
          "guest",
        ).battle;
        expect(restored).toEqual(battle);
        encounters.push({
          snapshot: battle.snapshot,
          rounds: battle.rounds,
          state: battle.state,
        });
      } finally {
        store.close();
      }
    }
    for (const encounter of encounters)
      expect(encounter).toEqual(encounters[0]);
  });
  it("random is resolved once, survives reads and idempotent retries, and rematches can retain its actual arena", () => {
    const store = new Store(":memory:");
    try {
      const service = new BattleService(new BattleStore(store)),
        actor = randomUUID(),
        id = randomUUID();
      let battle = service.start({
        actor: actor,
        id: id,
        player: "pip",
        opponent: "bolt",
        authority: null,
        difficulty: "easy",
        arenaChoice: "random",
      });
      const chosen = battle.arena;
      expect(arenaIds).toContain(chosen);
      const raw = service.records.get(id, actor);
      expect(raw.arenaChoice).toBe("random");
      expect(
        service.start({
          actor: actor,
          id: id,
          player: "pip",
          opponent: "bolt",
          authority: null,
          difficulty: "easy",
          arenaChoice: "random",
        }).arena,
      ).toBe(chosen);
      expect(service.session(actor, "guest").battle?.arena).toBe(chosen);
      while (!battle.state.outcome)
        battle = service.step(
          actor,
          id,
          battle.state.round,
          battle.legal.includes("special") ? "special" : "basic",
        );
      expect(
        service.start({
          actor: actor,
          id: randomUUID(),
          player: "pip",
          opponent: "bolt",
          authority: null,
          difficulty: "easy",
          arenaChoice: chosen,
        }).arena,
      ).toBe(chosen);
    } finally {
      store.close();
    }
  });
  it("old records have sanctuary presentation without mutating their stored bytes or frozen snapshot", () => {
    const store = new Store(":memory:");
    try {
      const service = new BattleService(new BattleStore(store)),
        actor = randomUUID(),
        id = randomUUID();
      service.start({ actor: actor, id: id, player: "pip", opponent: "bolt" });
      const legacy = service.records.get(id, actor);
      delete legacy.arena;
      delete legacy.arenaChoice;
      // Construct the pre-arena JSON shape, preserving every frozen combat field.
      const bytes = JSON.stringify(legacy);
      store.db.prepare("UPDATE battles SET record=? WHERE id=?").run(bytes, id);
      expect(service.session(actor, "guest").battle?.arena).toBe("sanctuary");
      expect(
        service.start({ actor: actor, id: id, player: "pip", opponent: "bolt" })
          .snapshot,
      ).toEqual(legacy.snapshot);
      expect(
        store.db.prepare("SELECT record FROM battles WHERE id=?").get(id)
          ?.record,
      ).toBe(bytes);
      expect(arenaChoiceSchema.safeParse("lava-damage").success).toBe(false);
    } finally {
      store.close();
    }
  });
});
