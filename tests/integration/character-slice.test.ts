import { AdventureStore } from "../../src/server/adventure/persistence";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { Store } from "../../src/server/persistence";
import { RunService } from "../../src/server/adventure/runs";
import { GuestJournal } from "../../src/server/adventure/journal";
import type { Action } from "../../src/domain/game/contracts";
import type { OfficialAuthority } from "../../src/domain/identity";
import { identityFor } from "../../src/domain/identity";
// Internal-service fixture authority; HTTP/JWT/current-owner enforcement is exercised separately.
const generation = randomUUID();
const authority: OfficialAuthority = {
  identity: identityFor("276"),
  generation,
  ownership: {
    owner: `0x${"1".repeat(40)}`,
    generation,
    identity: identityFor("276"),
    checkedAt: Date.now(),
    block: { number: "0x64", hash: `0x${"0".repeat(64)}`, timestamp: "0x1" },
  },
};

function execute(
  runs: RunService,
  actor: string,
  id: string,
  actions: Action[],
  grant: OfficialAuthority | null = null,
) {
  return actions
    .map((action, step) => runs.step(actor, id, step, action, grant))
    .at(-1)!;
}

describe("four-character persisted slice", () => {
  it("persists Pip's free charge spend across restart, retry, ghost and journal without double effect", () => {
    const dir = mkdtempSync(join(tmpdir(), "chog-character-"));
    const path = join(dir, "slice.sqlite");
    const actor = randomUUID(),
      id = randomUUID();
    let store = new Store(path);
    try {
      let runs = new RunService(store);
      runs.start(actor, id, null, null, null, "pip");
      const used = runs.step(actor, id, 0, "skill-peek");
      expect(runs.step(actor, id, 0, "skill-peek")).toEqual(used);
      store.close();
      store = new Store(path);
      runs = new RunService(store);
      expect(runs.session(actor).run?.observation.tactics?.charges).toBe(0);
      expect(runs.session(actor).run?.observation.turns).toBe(10);
      runs.step(actor, id, 1, "door");
      const exhibit = runs.publish(
        actor,
        id,
        "Peek then bonk",
        "Fixture",
        true,
      );
      const challenger = randomUUID(),
        attempt = randomUUID();
      const borrowed = runs.start(challenger, attempt, exhibit.id);
      expect(borrowed.observation.tactics?.loadout.characterId).toBe("pip");
      expect(borrowed.observation.tactics?.charges).toBe(1);
      expect(() =>
        runs.start(challenger, randomUUID(), exhibit.id, null, null, "patch"),
      ).toThrow("frozen character");
      expect(new GuestJournal(store, runs).read(actor).chapters).toHaveLength(
        1,
      );
      expect(runs.publicReplay(challenger, exhibit.id).ghost.actions).toContain(
        "skill-peek",
      );
      runs.withdraw(actor, id);
      expect(() => runs.publicReplay(challenger, exhibit.id)).toThrow(
        "withdrawn",
      );
    } finally {
      store.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("rejects general guest holder classes but lends Echo only inside its published challenge", () => {
    const store = new Store(":memory:"),
      runs = new RunService(store);
    const actor = randomUUID(),
      guest = randomUUID(),
      id = randomUUID();
    try {
      for (const characterId of ["aegis", "echo"] as const)
        expect(() =>
          runs.start(guest, randomUUID(), null, null, null, characterId),
        ).toThrow("verified Chog owner");
      runs.start(actor, id, null, null, authority, "echo");
      execute(runs, actor, id, ["arch", "skill-trail", "leave"], authority);
      const exhibit = runs.publish(
        actor,
        id,
        "Echo left lunch",
        "Fixture",
        true,
        authority,
      );
      const borrowed = runs.start(guest, randomUUID(), exhibit.id);
      expect(borrowed.mode).toBe("guest");
      expect(borrowed.identity).toBeNull();
      expect(borrowed.observation.tactics?.charges).toBe(2);
      execute(runs, guest, borrowed.id, ["arch", "skill-trail", "leave"]);
      expect(() =>
        runs.publish(guest, borrowed.id, "Borrow escape", "Fixture", true),
      ).toThrow("stay private");
      const journal = new GuestJournal(store, runs);
      const raced = journal.race(guest, randomUUID(), borrowed.id);
      expect(raced.exhibitId).toBe(exhibit.id);
      expect(() => runs.start(guest, randomUUID(), null, borrowed.id)).toThrow(
        "retain the original",
      );
      runs.withdraw(actor, id, true);
      expect(() => journal.race(guest, randomUUID(), borrowed.id)).toThrow(
        "published challenge",
      );
      expect(
        runs.view(new AdventureStore(store).getRun(raced.id, guest)).comparison,
      ).toBeNull();
    } finally {
      store.close();
    }
  });
  it("restores Patch's used decoy and validates stored state against replay; old saves get no invented loadout", () => {
    const store = new Store(":memory:"),
      runs = new RunService(store),
      actor = randomUUID(),
      id = randomUUID();
    try {
      runs.start(actor, id, null, null, null, "patch");
      const finished = execute(runs, actor, id, [
        "arch",
        "gadget",
        "skill-spare",
        "sneak",
        "gadget",
        "exit",
      ]);
      expect(finished.observation.outcome).toBe("escaped");
      expect(finished.ghost?.race.actions).toContain("skill-spare");
      const saved = new AdventureStore(store).getRun(id, actor);
      if (!saved.tactics) throw new Error("Fixture tactical state missing.");
      saved.tactics.charges = 1;
      new AdventureStore(store).saveRun(saved);
      expect(() => runs.session(actor)).toThrow("replay validation");
      const legacy = runs.start(actor, randomUUID(), null);
      expect(legacy.observation).not.toHaveProperty("tactics");
    } finally {
      store.close();
    }
  });
});
