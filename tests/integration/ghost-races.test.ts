import { AdventureStore } from "../../src/server/adventure/persistence";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Store } from "../../src/server/persistence";
import { RunService } from "../../src/server/adventure/runs";
import type { Action } from "../../src/domain/game/contracts";

describe("frozen guest opponents", () => {
  let store: Store, service: RunService;
  const actor = randomUUID(),
    stranger = randomUUID();
  beforeEach(() => {
    store = new Store(":memory:");
    service = new RunService(store);
  });
  afterEach(() => store.close());
  function finish(id: string, actions: Action[], who = actor) {
    actions.forEach((action, step) => service.step(who, id, step, action));
    return service.view(new AdventureStore(store).getRun(id, who));
  }
  function failure() {
    const id = randomUUID();
    service.start(actor, id, null);
    return finish(id, ["door"]);
  }
  it("races a previous frozen version without exposing the future before completion", () => {
    const original = failure();
    expect(original.rival).toBeNull();
    const id = randomUUID();
    const started = service.start(actor, id, null, original.id);
    expect(started.rival?.version).toBe(original.ghost?.version);
    expect(started.rival?.source).toBe("previous-run");
    expect(started.rival?.replay).toBeNull();
    expect(started.rival).not.toHaveProperty("profile");
    expect(started).not.toHaveProperty("scenario");
    expect(JSON.stringify(started)).not.toContain(original.id);
    expect(service.start(actor, id, null, original.id)).toEqual(started);
    const completed = finish(id, [
      "arch",
      "gadget",
      "sneak",
      "inspect",
      "swap",
      "exit",
    ]);
    expect(completed.rival?.version).toBe(original.ghost?.version);
    expect(completed.rival?.replay?.actions).toEqual(["door"]);
    expect(completed.rival?.replay?.comparison).toBe("better");
    expect(completed.ghost?.profile.runs).toBe(2);
    expect(completed.ghost?.version).not.toBe(completed.rival?.version);
    expect(completed.cohort).toBe("informed-retry");
    const rematch = service.start(actor, randomUUID(), null, id);
    expect(rematch.rival?.version).toBe(completed.ghost?.version);
    expect(rematch.rival?.replay).toBeNull();
    expect(rematch.observation.turns).toBe(10);
    expect(
      new AdventureStore(store).getRun(rematch.id, actor).scenario,
    ).toEqual(completed.replay?.scenario);
  });
  it("ignores unfinished chapters and preserves an opponent across later training", () => {
    const original = failure();
    const draft = service.start(actor, randomUUID(), null);
    service.step(actor, draft.id, 0, "inspect");
    const pendingRace = service.start(actor, randomUUID(), null);
    expect(pendingRace.rival?.version).toBe(original.ghost?.version);
    const later = service.start(actor, randomUUID(), null);
    finish(later.id, [
      "inspect",
      "arch",
      "gadget",
      "sneak",
      "inspect",
      "swap",
      "exit",
    ]);
    expect(
      service.view(new AdventureStore(store).getRun(pendingRace.id, actor))
        .rival,
    ).toEqual(pendingRace.rival);
    expect(finish(pendingRace.id, ["door"]).rival?.replay?.comparison).toBe(
      "tied",
    );
    expect(service.start(stranger, randomUUID(), null).rival).toBeNull();
  });
  it("museum opponents contain only the consented chapter, not private training", () => {
    const privateRun = failure();
    const publishedRun = failure();
    expect(publishedRun.ghost?.profile.runs).toBe(2);
    const exhibit = service.publish(
      actor,
      publishedRun.id,
      "Painted",
      "Curator",
      true,
    );
    const challenge = service.start(stranger, randomUUID(), exhibit.id);
    expect(challenge.rival?.source).toBe("museum");
    expect(challenge.rival?.label).toBe("Painted");
    expect(challenge.rival?.replay).toBeNull();
    expect(
      new AdventureStore(store).getRun(challenge.id, stranger).rival?.profile
        .runs,
    ).toBe(1);
    const publicData = service.publicReplay(stranger, exhibit.id);
    const serialized = JSON.stringify(publicData);
    for (const privateId of [actor, privateRun.id, publishedRun.id])
      expect(serialized).not.toContain(privateId);
    expect(serialized).not.toContain("trainingIds");
    expect(publicData.ghost.frames.at(-1)?.outcome).toBe("trapped");
    const completed = finish(challenge.id, ["door"], stranger);
    expect(completed.rival?.replay?.comparison).toBe("tied");
    expect(completed.rival?.replay?.frames).toEqual(publicData.ghost.frames);
  });
  it("withdrawal hides the opponent while a private attempt can finish", () => {
    const original = failure();
    const exhibit = service.publish(
      actor,
      original.id,
      "Painted",
      "Curator",
      true,
    );
    const challenge = service.start(stranger, randomUUID(), exhibit.id);
    service.withdraw(actor, original.id);
    expect(
      service.view(new AdventureStore(store).getRun(challenge.id, stranger))
        .rival,
    ).toBeNull();
    const finished = finish(challenge.id, ["door"], stranger);
    expect(finished.rival).toBeNull();
    expect(finished.comparison).toBeNull();
    expect(() => service.publicReplay(stranger, exhibit.id)).toThrow(
      "withdrawn",
    );
    expect(() => service.start(stranger, randomUUID(), exhibit.id)).toThrow(
      "withdrawn",
    );
  });
  it("legacy records load without inventing a pre-run opponent", () => {
    const original = failure();
    const legacy = { ...new AdventureStore(store).getRun(original.id, actor) };
    const { rival, ...oldRecord } = legacy;
    expect(rival).toBeNull();
    store.db
      .prepare("UPDATE runs SET record=? WHERE id=?")
      .run(JSON.stringify(oldRecord), original.id);
    expect(service.session(actor).run?.rival).toBeNull();
    expect(service.session(actor).run?.ghost).toEqual(original.ghost);
  });
});
