import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Store } from "../../src/server/persistence";
import { StoryService } from "../../src/server/story/service";
import { BattleService } from "../../src/server/combat/service";
import { BattleStore } from "../../src/server/combat/persistence";
import {
  COMPANION_CONTRIBUTION,
  endingMemory,
  freshJourney,
  interactJourney,
  interactionSpec,
} from "../../src/domain/story/journey";
import { characters } from "../../src/domain/characters/definitions";
import { legalMoves } from "../../src/domain/combat/moves";
import { prepareStoryBattle } from "../fixtures/story-journey";
import { storyStateSchema } from "../../src/domain/story/responses";
const actor = "11111111-1111-4111-8111-111111111111";
const now = 1700000000000;
function context(store = new Store(":memory:")) {
  const battles = new BattleService(new BattleStore(store));
  return { store, battles, story: new StoryService(store, battles) };
}
function win(ctx: ReturnType<typeof context>, id: string) {
  for (let n = 0; n < 20; n++) {
    const battle = ctx.battles.records.get(id, actor);
    if (battle.state.outcome) {
      expect(battle.state.outcome).toBe("victory");
      return;
    }
    const moves = legalMoves(battle.snapshot, battle.state, "player");
    ctx.battles.step(
      actor,
      id,
      battle.state.round,
      moves.includes("special") ? "special" : "basic",
    );
  }
  throw Error("Fixture battle did not finish");
}
it("all twelve companions contribute without a holder-only puzzle solution", () => {
  for (const entry of characters) {
    const journey = freshJourney(randomUUID());
    journey.stage = "shrine";
    expect(interactJourney(journey, entry.id, "align")).toBe(false);
    interactJourney(journey, entry.id, "runes");
    interactJourney(journey, entry.id, "companion");
    expect(journey.feedback).toBe(COMPANION_CONTRIBUTION[entry.id]);
    expect(interactJourney(journey, entry.id, "force")).toBe(false);
    expect(interactJourney(journey, entry.id, "align")).toBe(true);
  }
});
for (const [route, vow] of [
  ["grove", "restore"],
  ["foundry", "preserve"],
] as const)
  it(`plays the real ${route}/${vow} journey, optional side, immutable replay history and idempotent rewards`, () => {
    const ctx = context();
    try {
      let state = ctx.story.choose(actor, "pip");
      expect(state.journey?.stage).toBe("shrine");
      ctx.story.dialogue(actor);
      expect(ctx.story.state(actor).journey?.stage).toBe("shrine");
      expect(() => ctx.story.begin(actor, now)).toThrow(/interaction/);
      prepareStoryBattle(ctx.story, actor, now);
      for (const step of ["scout", "path", "guardian", "boss"]) {
        if (step === "path") {
          ctx.story.route(actor, route);
          expect(ctx.story.state(actor).journey?.stage).toBe(
            route === "grove" ? "tracks" : "bridge",
          );
          prepareStoryBattle(ctx.story, actor, now);
        }
        if (step === "guardian") {
          ctx.story.dialogue(actor);
          expect(ctx.story.state(actor).journey?.vow).toBeNull();
          ctx.story.vow(actor, vow);
          const j = ctx.story.state(actor).journey!;
          expect(interactionSpec(j.stage, j.vow)?.answer).toBe(
            vow === "restore" ? "echo" : "lantern",
          );
          prepareStoryBattle(ctx.story, actor, now);
        }
        const begun = ctx.story.begin(actor, now);
        win(ctx, begun.battleId!);
        state = ctx.story.resolve(actor, begun.battleId!, null, now);
        expect(ctx.story.resolve(actor, begun.battleId!, null, now).step).toBe(
          state.step,
        );
      }
      expect(state.step).toBe("ending");
      expect(state.journey?.vow).toBe(vow);
      expect(endingMemory(route, vow)).toContain(
        vow === "restore" ? "restored" : "spent",
      );
      const first = state.journey!.runId;
      expect(ctx.story.runs(actor)).toHaveLength(1);
      expect(ctx.story.rewards(actor)).toHaveLength(1);
      ctx.story.side(actor);
      ctx.story.leaveSide(actor);
      expect(ctx.story.state(actor).journey?.stage).toBe("ending");
      expect(ctx.story.rewards(actor)).toHaveLength(1);
      ctx.story.side(actor);
      ctx.story.interact(actor, "listen", now);
      ctx.story.interact(actor, "companion", now);
      ctx.story.interact(actor, "return", now);
      expect(ctx.story.rewards(actor).map((r) => r.title)).toContain(
        "Keeper of the Echo",
      );
      expect(() => ctx.story.interact(actor, "return", now)).toThrow();
      expect(ctx.story.rewards(actor)).toHaveLength(2);
      expect(ctx.story.runs(actor)).toMatchObject([
        { runId: first, sideComplete: true },
      ]);
      const view = {
        ...ctx.story.state(actor),
        runs: ctx.story.runs(actor),
        rewards: ctx.story.rewards(actor),
      };
      expect(storyStateSchema.safeParse(view).success).toBe(true);
      ctx.story.replay(actor);
      expect(ctx.story.state(actor).journey?.runId).not.toBe(first);
      expect(ctx.story.runs(actor)).toHaveLength(1);
      expect(ctx.story.rewards(actor)).toHaveLength(2);
      ctx.story.choose(actor, "pip");
      for (const step of ["scout", "path", "guardian", "boss"]) {
        if (step === "path") ctx.story.route(actor, route);
        if (step === "guardian") ctx.story.vow(actor, vow);
        prepareStoryBattle(ctx.story, actor, now);
        const begun = ctx.story.begin(actor, now);
        win(ctx, begun.battleId!);
        ctx.story.resolve(actor, begun.battleId!, null, now);
      }
      expect(ctx.story.runs(actor)).toHaveLength(2);
      expect(
        ctx.story.runs(actor).find((run) => run.runId === first)?.sideComplete,
      ).toBe(true);
      expect(ctx.story.rewards(actor)).toHaveLength(2);
    } finally {
      ctx.store.close();
    }
  });
it("reads a real legacy save without resetting its checkpoint and upgrades only on replay", () => {
  const ctx = context();
  try {
    ctx.store.db.prepare("INSERT INTO story_progress VALUES (?,?)").run(
      actor,
      JSON.stringify({
        policy: "story/fractured-sanctuary/1",
        fighter: "pip",
        step: "ending",
        route: "grove",
        battleId: null,
        completed: true,
        completionId: randomUUID(),
        official: null,
        retry: false,
        interruption: null,
        unavailableSince: null,
      }),
    );
    const old = ctx.story.state(actor);
    expect(old.journey).toBeNull();
    expect(old.step).toBe("ending");
    ctx.story.replay(actor);
    expect(ctx.story.state(actor).completionId).toBe(old.completionId);
    expect(ctx.story.state(actor).journey?.policy).toBe("sanctuary-journey/2");
  } finally {
    ctx.store.close();
  }
});
