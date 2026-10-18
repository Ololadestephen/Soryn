import { AdventureStore } from "../../src/server/adventure/persistence";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RunService } from "../../src/server/adventure/runs";
import { Store } from "../../src/server/persistence";
import type { Action } from "../../src/domain/game/contracts";

describe("authoritative persisted guest loop", () => {
  let folder: string, store: Store, service: RunService;
  const actor = randomUUID(),
    stranger = randomUUID();
  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), "chog-tests-"));
    store = new Store(join(folder, "test.sqlite"));
    service = new RunService(store);
  });
  afterEach(() => {
    store.close();
    rmSync(folder, { recursive: true, force: true });
  });
  function complete(actions: Action[], who = actor) {
    const id = randomUUID();
    service.start(who, id, null);
    actions.forEach((action, index) => service.step(who, id, index, action));
    return id;
  }
  it("validates steps, hides private state, and recovers duplicate requests", () => {
    const id = randomUUID();
    const started = service.start(actor, id, null);
    expect(started.replay).toBeNull();
    expect(started.ghost).toBeNull();
    expect(started).not.toHaveProperty("actor");
    expect(started).not.toHaveProperty("scenario");
    expect(service.start(actor, id, null)).toEqual(started);
    const stepped = service.step(actor, id, 0, "arch");
    expect(service.step(actor, id, 0, "arch")).toEqual(stepped);
    expect(() => service.step(actor, id, 0, "door")).toThrow("Stale");
    expect(() => service.step(actor, id, 2, "inspect")).toThrow("Stale");
    expect(() => service.step(actor, id, 1, "take")).toThrow("unavailable");
    expect(service.session(actor).run?.step).toBe(1);
    expect(() => service.step(stranger, id, 1, "inspect")).toThrow(
      "unavailable",
    );
  });
  it("does not let another actor overwrite a chosen run ID", () => {
    const id = complete(["door"]);
    const previous = new AdventureStore(store).getRun(id, actor);
    expect(() => service.start(stranger, id, null)).toThrow("ID unavailable");
    expect(new AdventureStore(store).getRun(id, actor)).toEqual(previous);
    expect(service.session(stranger).run).toBeNull();
  });
  it("publishes only consented terminal failures, idempotently, with no private identifiers", () => {
    const id = randomUUID();
    service.start(actor, id, null);
    expect(() => service.publish(actor, id, "Test", "Curator", true)).toThrow(
      "completed failures",
    );
    service.step(actor, id, 0, "door");
    expect(() => service.publish(actor, id, "Test", "Curator", false)).toThrow(
      "consent",
    );
    expect(() =>
      service.publish(stranger, id, "Test", "Curator", true),
    ).toThrow("unavailable");
    const published = service.publish(
      actor,
      id,
      "The Door Was Painted",
      "Curator",
      true,
    );
    expect(service.publish(actor, id, "Different", "Another", true)).toEqual(
      published,
    );
    expect(service.session(stranger).museum).toEqual([published]);
    const publicData = service.publicReplay(stranger, published.id);
    const publicText = JSON.stringify(publicData);
    expect(publicText).not.toContain(actor);
    expect(publicText).not.toContain(id);
    expect(publicData.frames.at(-1)?.outcome).toBe("trapped");
    const winner = complete([
      "arch",
      "gadget",
      "sneak",
      "inspect",
      "swap",
      "exit",
    ]);
    expect(() =>
      service.publish(actor, winner, "Won", "Curator", true),
    ).toThrow("completed failures");
  });
  it("another session challenges the identical frozen scenario with honest cohorts", () => {
    const id = complete(["door"]);
    const exhibit = service.publish(actor, id, "Painted", "Curator", true);
    const fresh = service.start(stranger, randomUUID(), exhibit.id);
    expect(fresh.cohort).toBe("first-recorded");
    const finished = service.step(stranger, fresh.id, 0, "door");
    expect(finished.replay?.scenario).toEqual(
      new AdventureStore(store).getRun(id, actor).scenario,
    );
    expect(finished.comparison).toEqual({ original: "tied", ghost: "tied" });
    const retry = service.start(stranger, randomUUID(), exhibit.id, fresh.id);
    expect(retry.cohort).toBe("informed-retry");
    const exposed = randomUUID();
    service.publicReplay(exposed, exhibit.id);
    expect(service.start(exposed, randomUUID(), exhibit.id).cohort).toBe(
      "informed-retry",
    );
  });
  it("freezes ghost versions and replays across database reopen", () => {
    const id = complete(["door"]);
    const original = service.view(new AdventureStore(store).getRun(id, actor));
    complete(["inspect", "arch", "gadget", "sneak", "inspect", "swap", "exit"]);
    expect(
      service.view(new AdventureStore(store).getRun(id, actor)).ghost,
    ).toEqual(original.ghost);
    expect(service.session(actor).run?.ghost?.profile.runs).toBe(2);
    expect(service.session(actor).run?.cohort).toBe("informed-retry");
    const published = service.publish(actor, id, "Painted", "Curator", true);
    store.close();
    store = new Store(join(folder, "test.sqlite"));
    service = new RunService(store);
    expect(service.view(new AdventureStore(store).getRun(id, actor))).toEqual({
      ...original,
      publication: published,
    });
    expect(new AdventureStore(store).exhibit(published.id).ghost.runs).toBe(1);
  });
  it("withdrawal preserves private authorship, hides public replay, and blocks new challenges", () => {
    const id = complete(["door"]);
    const exhibit = service.publish(actor, id, "Painted", "Curator", true);
    const currentChallenge = service.start(stranger, randomUUID(), exhibit.id);
    expect(() => service.withdraw(stranger, id)).toThrow();
    service.withdraw(actor, id);
    service.withdraw(actor, id);
    expect(service.session(stranger).museum).toEqual([]);
    expect(() => service.publicReplay(stranger, exhibit.id)).toThrow(
      "withdrawn",
    );
    expect(() => service.start(stranger, randomUUID(), exhibit.id)).toThrow(
      "withdrawn",
    );
    expect(() => service.publish(actor, id, "Again", "Curator", true)).toThrow(
      "withdrawn",
    );
    expect(
      service.step(stranger, currentChallenge.id, 0, "door").comparison,
    ).toBeNull();
  });
  it("rolls back failed writes and enforces request-rate boundaries", () => {
    const id = complete(["door"]);
    const original = new AdventureStore(store).getRun(id, actor);
    expect(() =>
      store.transaction(() => {
        new AdventureStore(store).saveRun({ ...original, actions: ["leave"] });
        throw new Error("Simulated failure after persistence mutation");
      }),
    ).toThrow();
    expect(new AdventureStore(store).getRun(id, actor)).toEqual(original);
    for (let i = 0; i < 60; i++) store.rateLimit(actor, 1000);
    expect(() => store.rateLimit(actor, 1000)).toThrow("Too many");
    expect(() => store.rateLimit(actor, 61000)).not.toThrow();
  });
});
