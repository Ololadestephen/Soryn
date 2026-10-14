import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Store } from "../../src/server/persistence";
import { RunService } from "../../src/server/runs";
import { GuestJournal } from "../../src/server/journal";
import type { Action } from "../../src/domain/game/contracts";

describe("guest journal and selected races", () => {
  let folder: string, store: Store, runs: RunService, journal: GuestJournal;
  const actor = randomUUID(),
    stranger = randomUUID();
  const winning: Action[] = [
    "arch",
    "gadget",
    "sneak",
    "inspect",
    "swap",
    "exit",
  ];
  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), "chog-journal-"));
    store = new Store(join(folder, "test.sqlite"));
    runs = new RunService(store);
    journal = new GuestJournal(store, runs);
  });
  afterEach(() => {
    store.close();
    rmSync(folder, { recursive: true, force: true });
  });
  function finish(id: string, actions: Action[], who = actor) {
    actions.forEach((action, index) => runs.step(who, id, index, action));
    return runs.view(store.getRun(id, who));
  }
  function completeDoorFailure(who = actor) {
    const run = runs.start(who, randomUUID(), null);
    return finish(run.id, ["door"], who);
  }
  it("lists only completed private guest summaries and reopening does not replace the active run", () => {
    const old = completeDoorFailure();
    const recent = completeDoorFailure();
    const draft = runs.start(actor, randomUUID(), null);
    const before = store.getRun(draft.id, actor);
    expect(journal.read(actor).chapters.map((chapter) => chapter.id)).toEqual([
      recent.id,
      old.id,
    ]);
    const text = JSON.stringify(journal.read(actor));
    for (const hidden of [
      actor,
      "trainingIds",
      "scenario",
      "profile",
      "actions",
      draft.id,
    ])
      expect(text).not.toContain(hidden);
    expect(journal.chapter(actor, old.id).replay).toEqual(old.replay);
    expect(runs.session(actor).run?.id).toBe(draft.id);
    expect(store.getRun(draft.id, actor)).toEqual(before);
    expect(journal.read(stranger)).toEqual({ chapters: [], challenges: [] });
    expect(() => journal.chapter(stranger, old.id)).toThrow("unavailable");
    expect(() => journal.chapter(actor, draft.id)).toThrow(
      "Completed guest chapter unavailable",
    );
    expect(() => journal.race(actor, randomUUID(), old.id)).toThrow(
      "Finish your current",
    );
  });
  it("races an older selected version on its original scenario and persists its selection", () => {
    const old = completeDoorFailure();
    const newRun = runs.start(actor, randomUUID(), null);
    const recent = finish(newRun.id, winning);
    expect(recent.ghost?.version).not.toBe(old.ghost?.version);
    const id = randomUUID();
    const selected = journal.race(actor, id, old.id);
    expect(selected.rival?.version).toBe(old.ghost?.version);
    expect(selected.rival?.replay).toBeNull();
    expect(selected.exhibitId).toBeNull();
    expect(selected.cohort).toBe("informed-retry");
    expect(store.getRun(id, actor).scenario).toEqual(old.replay?.scenario);
    expect(store.getRun(id, actor).ghostOf).toBe(old.id);
    expect(journal.race(actor, id, old.id)).toEqual(selected);
    expect(() => journal.race(actor, id, recent.id)).toThrow("Race ID");
    expect(() => runs.start(actor, id, null)).toThrow("Start ID");
    store.close();
    store = new Store(join(folder, "test.sqlite"));
    runs = new RunService(store);
    journal = new GuestJournal(store, runs);
    expect(journal.race(actor, id, old.id)).toEqual(selected);
    const completed = finish(id, winning);
    expect(completed.rival?.replay?.actions).toEqual(["door"]);
    expect(completed.rival?.replay?.comparison).toBe("better");
    expect(completed.ghost?.profile.runs).toBe(3);
    expect(journal.chapter(actor, old.id).ghost?.version).toBe(
      old.ghost?.version,
    );
  });
  it("separates museum rematches from selecting a personal chapter ghost", () => {
    const original = completeDoorFailure();
    const exhibit = runs.publish(
      actor,
      original.id,
      "Painted",
      "Curator",
      true,
    );
    const first = runs.start(stranger, randomUUID(), exhibit.id);
    finish(first.id, ["door"], stranger);
    const retry = runs.start(stranger, randomUUID(), exhibit.id, first.id);
    finish(retry.id, ["door"], stranger);
    const improved = runs.start(stranger, randomUUID(), exhibit.id, retry.id);
    const win = finish(improved.id, winning, stranger);
    const progress = journal.read(stranger).challenges[0];
    expect(
      progress.cohorts.map(({ cohort, attempts, improvement }) => ({
        cohort,
        attempts,
        improvement,
      })),
    ).toEqual([
      { cohort: "first-recorded", attempts: 1, improvement: "tied" },
      { cohort: "informed-retry", attempts: 2, improvement: "better" },
    ]);
    expect(progress.cohorts[1].best.comparison).toEqual({
      original: "better",
      ghost: "better",
    });
    const personal = journal.race(stranger, randomUUID(), win.id);
    expect(personal.exhibitId).toBeNull();
    expect(personal.rival?.source).toBe("previous-run");
    expect(personal.rival?.version).toBe(win.ghost?.version);
    expect(store.getRun(personal.id, stranger).scenario).toEqual(
      store.exhibit(exhibit.id).scenario,
    );
    runs.withdraw(actor, original.id);
    const withdrawn = journal.read(stranger).challenges[0];
    expect(withdrawn.challenge).toEqual({
      id: exhibit.id,
      title: "Withdrawn exhibit",
      available: false,
    });
    expect(
      withdrawn.cohorts.every(({ best }) => best.comparison === null),
    ).toBe(true);
    expect(journal.chapter(stranger, win.id).rival).toBeNull();
  });
  it("rejects cross-session races, chosen-ID collisions and chapters without a frozen version", () => {
    const source = completeDoorFailure();
    const other = completeDoorFailure(stranger);
    expect(() => journal.race(stranger, randomUUID(), source.id)).toThrow(
      "unavailable",
    );
    const before = store.getRun(other.id, stranger);
    expect(() => journal.race(actor, other.id, source.id)).toThrow(
      "ID unavailable",
    );
    expect(store.getRun(other.id, stranger)).toEqual(before);
    store.saveRun({ ...store.getRun(source.id, actor), ghost: null });
    expect(journal.read(actor).chapters[0].ghostVersion).toBeNull();
    expect(() => journal.race(actor, randomUUID(), source.id)).toThrow(
      "no frozen ghost",
    );
  });
  it("loads pre-selection records without reconstructing a fictitious selected race", () => {
    const old = completeDoorFailure();
    const { ghostOf, ...legacy } = store.getRun(old.id, actor);
    expect(ghostOf).toBeNull();
    store.db
      .prepare("UPDATE runs SET record=? WHERE id=?")
      .run(JSON.stringify(legacy), old.id);
    expect(store.getRun(old.id, actor).ghostOf).toBeNull();
    expect(journal.chapter(actor, old.id)).toEqual(old);
  });
  it("bounds the journal to recent records and fails closed on invalid stored data", () => {
    for (let index = 0; index < 101; index++) completeDoorFailure();
    expect(journal.read(actor).chapters).toHaveLength(100);
    const oldest = store.db
      .prepare("SELECT id FROM runs ORDER BY rowid LIMIT 1")
      .get();
    expect(
      journal.read(actor).chapters.some((chapter) => chapter.id === oldest?.id),
    ).toBe(false);
    store.db
      .prepare("UPDATE runs SET record='{}' WHERE id=?")
      .run(journal.read(actor).chapters[0].id);
    expect(() => journal.read(actor)).toThrow("failed validation");
  });
});
