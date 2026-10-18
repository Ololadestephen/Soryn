import { beginStoryBattle } from "../fixtures/story-journey";
import { describe, expect, it } from "vitest";
import { legalMoves } from "../../src/domain/combat/moves";
import {
  identityFor,
  tokenKey,
  tokenStoryActor,
} from "../../src/domain/identity";
import type { OfficialAuthority } from "../../src/domain/identity";
import type { Move } from "../../src/domain/combat/contracts";
import { tokenActorUuid } from "../../src/server/tokenActors";
import { BattleStore } from "../../src/server/combat/persistence";
import { BattleService } from "../../src/server/combat/service";
import { Store } from "../../src/server/persistence";
import { TokenRecords } from "../../src/server/records/tokenRecords";
import { StoryService } from "../../src/server/story/service";

const NOW = 1_700_000_000_000;
const OWNER_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const GEN1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TOKEN = identityFor("276");
const ROW = tokenStoryActor(TOKEN);
const BATTLE_ACTOR = tokenActorUuid(TOKEN, OWNER_A);
const BLOCK = {
  number: "0x64",
  hash: `0x${"ab".repeat(32)}`,
  timestamp: "0x64",
};

function authority(): OfficialAuthority {
  return {
    identity: TOKEN,
    generation: GEN1,
    ownership: {
      identity: TOKEN,
      owner: OWNER_A,
      generation: GEN1,
      block: BLOCK,
      checkedAt: NOW,
    },
  };
}

function setup() {
  const store = new Store(":memory:");
  const battles = new BattleService(new BattleStore(store));
  const story = new StoryService(store, battles);
  return { store, battles, story, records: new TokenRecords(store) };
}

function winBattle(
  battles: BattleService,
  battleActor: string,
  id: string,
  auth: OfficialAuthority | null = authority(),
) {
  for (let n = 0; n < 30; n += 1) {
    const record = battles.records.get(id, battleActor);
    if (record.state.outcome) return record;
    const legal = legalMoves(record.snapshot, record.state, "player");
    const move: Move = legal.includes("special") ? "special" : "basic";
    battles.step(battleActor, id, record.state.round, move, auth);
  }
  throw new Error("Story battle did not finish");
}

function completeOfficialChapter(story: StoryService, battles: BattleService) {
  const auth = authority();
  const binding = {
    identity: TOKEN,
    owner: OWNER_A,
    generation: GEN1,
  };
  const begin = () =>
    beginStoryBattle(story, ROW, NOW, {
      token: tokenKey(TOKEN),
      binding,
      authority: auth,
    });
  story.choose(ROW, "pip");
  let begun = begin();
  winBattle(battles, BATTLE_ACTOR, begun.battleId);
  story.resolve(ROW, begun.battleId, tokenKey(TOKEN), NOW + 1);
  story.route(ROW, "grove");
  for (const step of ["path", "guardian", "boss"] as const) {
    begun = begin();
    winBattle(battles, BATTLE_ACTOR, begun.battleId);
    story.resolve(ROW, begun.battleId, tokenKey(TOKEN), NOW + 2);
    expect(story.state(ROW).step).not.toBe(step);
  }
  const progress = story.state(ROW);
  expect(progress.completed).toBe(true);
  return progress;
}

describe("official story chapters land in the token record", () => {
  it("writes one story row per completion, idempotently", () => {
    const { store, battles, story, records } = setup();
    try {
      const progress = completeOfficialChapter(story, battles);
      const rows = records.list(TOKEN);
      expect(rows.filter((row) => row.kind === "story")).toHaveLength(1);
      expect(rows.filter((row) => row.kind === "story-encounter")).toHaveLength(
        4,
      );
      expect(rows.find((row) => row.kind === "story")).toMatchObject({
        kind: "story",
        source: progress.completionId,
        headline: "Chapter complete",
        fighter: "Pip",
        route: "grove",
        owner: OWNER_A,
        generation: GEN1,
        recordedAt: NOW + 2,
      });
      expect(records.summary(TOKEN).story).toBe(1);
      // Replayed reads and stale resolves never duplicate the completion.
      story.replay(ROW, tokenKey(TOKEN));
      story.resolve(ROW, progress.battleId ?? BATTLE_ACTOR, tokenKey(TOKEN));
      story.state(ROW);
      expect(records.list(TOKEN)).toHaveLength(5);
    } finally {
      store.close();
    }
  });

  it("never records a guest chapter", () => {
    const { store, battles, story } = setup();
    try {
      const guest = "99999999-9999-4999-8999-999999999999";
      story.choose(guest, "pip");
      const begun = beginStoryBattle(story, guest, NOW);
      winBattle(battles, guest, begun.battleId, null);
      const resolved = story.resolve(guest, begun.battleId);
      expect(resolved).toMatchObject({ step: "route", completed: false });
      const count = store.db
        .prepare("SELECT COUNT(*) AS n FROM token_record")
        .get() as { n: number };
      expect(count.n).toBe(0);
    } finally {
      store.close();
    }
  });

  it("records a retry loss as nothing and keeps the row count stable", () => {
    const { store, battles, story, records } = setup();
    try {
      story.choose(ROW, "pip");
      const auth = authority();
      const begun = beginStoryBattle(story, ROW, NOW, {
        token: tokenKey(TOKEN),
        binding: { identity: TOKEN, owner: OWNER_A, generation: GEN1 },
        authority: auth,
      });
      // Drive the battle to a defeat by guarding every round.
      const record = battles.records.get(begun.battleId, BATTLE_ACTOR);
      expect(record).toBeTruthy();
      for (let n = 0; n < 60; n += 1) {
        const current = battles.records.get(begun.battleId, BATTLE_ACTOR);
        if (current.state.outcome) break;
        battles.step(
          BATTLE_ACTOR,
          begun.battleId,
          current.state.round,
          "guard",
          auth,
        );
      }
      const lost = story.resolve(ROW, begun.battleId, tokenKey(TOKEN));
      expect(lost).toMatchObject({ lost: true, battleId: null });
      expect(records.list(TOKEN)).toHaveLength(0);
    } finally {
      store.close();
    }
  });
});
