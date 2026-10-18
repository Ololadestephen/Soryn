import { beginStoryBattle } from "../fixtures/story-journey";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { storyEncounter } from "../../src/domain/story/sanctuary";
import { BattleStore } from "../../src/server/combat/persistence";
import { BattleService } from "../../src/server/combat/service";
import { Store } from "../../src/server/persistence";
import { StoryService } from "../../src/server/story/service";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function story() {
  const store = new Store(":memory:");
  const battles = new BattleService(new BattleStore(store));
  return { store, battles, story: new StoryService(store, battles) };
}

function win(battles: BattleService, id: string) {
  for (let guard = 0; guard < 20; guard += 1) {
    const record = battles.records.get(id, A);
    if (record.state.outcome === "victory") return;
    if (record.state.outcome)
      throw new Error(`Battle ended ${record.state.outcome}.`);
    const move =
      record.state.player.energy >= 3 && record.state.player.cooldown === 0
        ? "special"
        : "basic";
    battles.step(A, id, record.state.round, move, null);
  }
  throw new Error("Battle did not finish.");
}

function chapter(route: "grove" | "foundry") {
  const ctx = story();
  ctx.story.choose(A, "pip");
  let began = beginStoryBattle(ctx.story, A, 1);
  win(ctx.battles, began.battleId!);
  ctx.story.resolve(A, began.battleId!);
  ctx.story.route(A, route);
  for (const step of ["path", "guardian", "boss"] as const) {
    const state = ctx.story.state(A);
    expect(state.step).toBe(step);
    began = beginStoryBattle(ctx.story, A, 1);
    win(ctx.battles, began.battleId!);
    ctx.story.resolve(A, began.battleId!);
  }
  return ctx;
}

describe("The Fractured Sanctuary", () => {
  it("does not resume a chapter as Practice or label it as a saved Practice battle", () => {
    const { store, battles, story: campaign } = story();
    try {
      campaign.choose(A, "pip");
      const began = beginStoryBattle(campaign, A, 1);
      expect(battles.records.get(began.battleId!, A).origin).toBe("story");
      expect(battles.session(A, "guest").battle).toBeNull();
      expect(campaign.state(A).battleId).toBe(began.battleId);
      expect(() =>
        battles.start({
          actor: A,
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          player: "pip",
          opponent: "bolt",
        }),
      ).toThrow(/Continue Story/);
    } finally {
      store.close();
    }
  });
  it("gives the two routes different opponents", () => {
    const grove = storyEncounter("pip", "path", "grove");
    const foundry = storyEncounter("pip", "path", "foundry");
    expect(grove?.opponent).not.toBe(foundry?.opponent);
    expect(grove?.arena).toBe("grove");
    expect(foundry?.arena).toBe("foundry");
    expect(storyEncounter("pip", "boss", "grove")?.difficulty).toBe("hard");
    expect(storyEncounter("patch", "scout", null)?.opponent).not.toBe("patch");
  });

  it("records one completion for each branch and resumes after reopen", () => {
    for (const route of ["grove", "foundry"] as const) {
      const ctx = chapter(route);
      const done = ctx.story.state(A);
      expect(done.step).toBe("ending");
      expect(done.route).toBe(route);
      expect(done.completed).toBe(true);
      const repeated = ctx.story.resolve(
        A,
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      );
      expect(repeated.completionId).toBe(done.completionId);
      ctx.story.replay(A);
      expect(ctx.story.state(A)).toMatchObject({
        step: "meet",
        completed: true,
        completionId: done.completionId,
      });
      ctx.store.close();
    }
  });

  it("keeps a loss on the same encounter and restores it from disk", () => {
    const folder = mkdtempSync(join(tmpdir(), "chog-story-"));
    const path = join(folder, "story.sqlite");
    const store = new Store(path);
    const battles = new BattleService(new BattleStore(store));
    const chapterService = new StoryService(store, battles);
    chapterService.choose(A, "moss");
    const began = beginStoryBattle(chapterService, A, 5);
    const record = battles.records.get(began.battleId!, A);
    record.state.outcome = "defeat";
    battles.records.save(record);
    const lost = chapterService.resolve(A, began.battleId!);
    expect(lost).toMatchObject({ step: "scout", lost: true, battleId: null });
    store.close();
    const reopened = new Store(path);
    const restored = new StoryService(
      reopened,
      new BattleService(new BattleStore(reopened)),
    );
    expect(restored.state(A).step).toBe("scout");
    const retry = beginStoryBattle(restored, A, 6);
    expect(retry.battleId).not.toBe(began.battleId);
    reopened.close();
  });

  it("does not let another guest resolve the chapter", () => {
    const ctx = story();
    ctx.story.choose(A, "pip");
    const began = beginStoryBattle(ctx.story, A, 1);
    win(ctx.battles, began.battleId!);
    expect(ctx.story.resolve(B, began.battleId!).step).toBe("meet");
    expect(ctx.story.resolve(A, began.battleId!).step).toBe("route");
    ctx.store.close();
  });
});
