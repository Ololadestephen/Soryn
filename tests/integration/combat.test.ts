import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect } from "vitest";
import { Store } from "../../src/server/persistence";
import { BattleStore } from "../../src/server/combat/persistence";
import { BattleService } from "../../src/server/combat/service";
import { RunService } from "../../src/server/runs";
import { fighters } from "../../src/domain/combat/definitions";
import { character } from "../../src/domain/characters/definitions";
import { identityFor, type OfficialAuthority } from "../../src/domain/identity";

function authority(): OfficialAuthority {
  const generation = randomUUID(),
    identity = identityFor("276");
  return {
    generation,
    identity,
    ownership: {
      generation,
      identity,
      owner: `0x${"1".repeat(40)}`,
      checkedAt: Date.now(),
      block: { number: "0x64", hash: `0x${"1".repeat(64)}`, timestamp: "0x1" },
    },
  };
}
describe("separate durable combat records", () => {
  it("freezes pending computer before player input and persists exact replay without duplicate damage", () => {
    const directory = mkdtempSync(join(tmpdir(), "chog-combat-")),
      path = join(directory, "game.sqlite");
    let store = new Store(path);
    const actor = randomUUID(),
      id = randomUUID();
    try {
      let service = new BattleService(new BattleStore(store));
      const start = service.start(actor, id, "pip", "bolt");
      expect(service.start(actor, id, "pip", "bolt")).toEqual(start);
      const pending = service.records.get(id, actor).pending;
      expect(JSON.stringify(start)).not.toContain("reason");
      const first = service.step(actor, id, 1, "special");
      expect(first.rounds[0].opponent).toBe(pending?.move);
      expect(service.step(actor, id, 1, "special")).toEqual(first);
      expect(() => service.step(actor, id, 1, "basic")).toThrow("another move");
      expect(() => service.step(actor, id, 3, "basic")).toThrow(
        "Stale or future",
      );
      expect(() => service.start(actor, id, "moss", "bolt")).toThrow(
        "another loadout",
      );
      const nextPending = service.records.get(id, actor).pending;
      store.close();
      store = new Store(path);
      service = new BattleService(new BattleStore(store));
      expect(service.session(actor, "guest").battle).toEqual(first);
      expect(service.records.get(id, actor).pending).toEqual(nextPending);
      let current = first;
      while (!current.state.outcome)
        current = service.step(
          actor,
          id,
          current.state.round,
          current.legal.includes("special") ? "special" : "basic",
        );
      expect(current.state.outcome).toBe("victory");
      expect(() =>
        service.step(actor, id, current.state.round, "basic"),
      ).toThrow("finished");
      expect(service.session(randomUUID(), "guest").battle).toBeNull();
    } finally {
      store.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("rejects corrupted resources, pending policy and unsupported frozen versions", () => {
    const store = new Store(":memory:");
    try {
      const service = new BattleService(new BattleStore(store)),
        actor = randomUUID(),
        id = randomUUID();
      service.start(actor, id, "pip", "bolt");
      const record = service.records.get(id, actor);
      record.state.player.health = 1;
      service.records.save(record);
      expect(() => service.view(service.records.get(id, actor))).toThrow(
        "state or pending",
      );
      record.state.player.health = 84;
      record.pending!.move = "guard";
      service.records.save(record);
      expect(() => service.view(service.records.get(id, actor))).toThrow(
        "state or pending",
      );
      store.db
        .prepare(
          "UPDATE battles SET record=json_set(record,'$.snapshot.rules','combat-rules/999') WHERE id=?",
        )
        .run(id);
      expect(() => service.records.get(id, actor)).toThrow(
        "Stored game data failed validation",
      );
    } finally {
      store.close();
    }
  });
  it("all starter and holder kits start with combat resources; guest can face but cannot select holders", () => {
    const store = new Store(":memory:");
    try {
      const service = new BattleService(new BattleStore(store)),
        grant = authority();
      for (const fighter of fighters) {
        const actor = randomUUID();
        const view = service.start(
          actor,
          randomUUID(),
          fighter.id,
          "bolt",
          grant,
        );
        expect(view.state.player.energy).toBe(4);
        expect(view.snapshot.player).not.toHaveProperty("charges");
        expect(
          service.step(actor, view.id, 1, "special", grant).rounds,
        ).toHaveLength(1);
        if (character(fighter.id).access === "holder")
          expect(() =>
            service.start(randomUUID(), randomUUID(), fighter.id, "pip"),
          ).toThrow("verified ownership");
        expect(
          service.start(randomUUID(), randomUUID(), "pip", fighter.id).snapshot
            .opponent.id,
        ).toBe(fighter.id);
      }
    } finally {
      store.close();
    }
  });
  it("official token scope/generation and private author history never become guest records", () => {
    const store = new Store(":memory:");
    try {
      const service = new BattleService(new BattleStore(store)),
        actor = randomUUID(),
        grant = authority(),
        id = randomUUID();
      service.start(actor, id, "aegis", "pip", grant);
      expect(service.session(actor, "guest").battle).toBeNull();
      expect(
        service.session(actor, "official", {
          identity: grant.identity,
          generation: randomUUID(),
        }).battle,
      ).toBeNull();
      expect(() => service.step(actor, id, 1, "basic")).toThrow(
        "ownership-generation",
      );
      expect(() => service.step(actor, id, 1, "basic", authority())).toThrow(
        "ownership-generation",
      );
      expect(() => service.records.get(id, randomUUID())).toThrow(
        "unavailable",
      );
      const newGrant = authority();
      const current = service.start(
        actor,
        randomUUID(),
        "nyx",
        "pip",
        newGrant,
      );
      expect(current.id).not.toBe(id);
      expect(service.records.get(id, actor).rounds).toHaveLength(0);
    } finally {
      store.close();
    }
  });
  it("does not rewrite legacy adventure chapters or consented museum snapshots", () => {
    const store = new Store(":memory:");
    try {
      const actor = randomUUID(),
        id = randomUUID(),
        runs = new RunService(store);
      runs.start(actor, id, null, null);
      runs.step(actor, id, 0, "door");
      runs.publish(actor, id, "Legacy bonk", "Fixture", true);
      const saved = store.db
        .prepare("SELECT record FROM runs WHERE id=?")
        .get(id)?.record;
      const exhibits = JSON.stringify(store.museum());
      const battles = new BattleService(new BattleStore(store));
      battles.start(actor, randomUUID(), "pip", "bolt");
      expect(
        store.db.prepare("SELECT record FROM runs WHERE id=?").get(id)?.record,
      ).toBe(saved);
      expect(JSON.stringify(store.museum())).toBe(exhibits);
      expect(runs.session(actor).run?.observation.outcome).toBe("trapped");
      expect(store.getRun(id, actor).tactics).toBeNull();
    } finally {
      store.close();
    }
  });
});
