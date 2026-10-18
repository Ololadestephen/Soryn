import { beginStoryBattle } from "../fixtures/story-journey";
import { describe, expect, it } from "vitest";
import { legalMoves } from "../../src/domain/combat/moves";
import {
  identityFor,
  tokenKey,
  tokenStoryActor,
} from "../../src/domain/identity";
import { tokenActorUuid } from "../../src/server/tokenActors";
import type { OfficialAuthority } from "../../src/domain/identity";
import type { Move } from "../../src/domain/combat/contracts";
import { PVP_TIMERS } from "../../src/domain/pvp/timers";
import { BattleStore } from "../../src/server/combat/persistence";
import { BattleService } from "../../src/server/combat/service";
import { Store } from "../../src/server/persistence";
import { PvpStore } from "../../src/server/pvp/persistence";
import { PvpService } from "../../src/server/pvp/service";
import { StoryService } from "../../src/server/story/service";

const NOW = 1_700_000_000_000;
const OWNER_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OWNER_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const GEN1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GEN2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TOKEN = tokenKey(identityFor("276"));
const BLOCK = {
  number: "0x64",
  hash: `0x${"ab".repeat(32)}`,
  timestamp: "0x64",
};

function authorityFor(owner: string, generation: string): OfficialAuthority {
  const identity = identityFor("276");
  return {
    identity,
    generation,
    ownership: { identity, owner, generation, block: BLOCK, checkedAt: NOW },
  };
}
const AUTHORITY_A = authorityFor(OWNER_A, GEN1);
const AUTHORITY_B = authorityFor(OWNER_B, GEN2);
const BINDING_A = {
  identity: identityFor("276"),
  owner: OWNER_A,
  generation: GEN1,
};
const BINDING_B = {
  identity: identityFor("276"),
  owner: OWNER_B,
  generation: GEN2,
};
const ROW = tokenStoryActor(identityFor("276"));
const BATTLE_ACTOR = tokenActorUuid(identityFor("276"), OWNER_A);

function setup() {
  const store = new Store(":memory:");
  const battles = new BattleService(new BattleStore(store));
  const story = new StoryService(store, battles);
  return { store, battles, story };
}

function officialBegin(
  story: StoryService,
  authority: OfficialAuthority,
  now = NOW,
) {
  const binding = {
    identity: authority.identity,
    owner: authority.ownership.owner,
    generation: authority.generation,
  };
  return beginStoryBattle(story, tokenStoryActor(authority.identity), now, {
    token: tokenKey(authority.identity),
    binding,
    authority,
  });
}

function winBattle(
  battles: BattleService,
  battleActor: string,
  id: string,
  authority: OfficialAuthority | null,
) {
  for (let n = 0; n < 30; n += 1) {
    const record = battles.records.get(id, battleActor);
    if (record.state.outcome) return record;
    const legal = legalMoves(record.snapshot, record.state, "player");
    const move: Move = legal.includes("special") ? "special" : "basic";
    battles.step(battleActor, id, record.state.round, move, authority);
  }
  throw new Error("Story battle did not finish");
}

function completeChapter(story: StoryService, battles: BattleService) {
  story.choose(ROW, "pip");
  let begun = officialBegin(story, AUTHORITY_A);
  winBattle(battles, BATTLE_ACTOR, begun.battleId, AUTHORITY_A);
  story.resolve(ROW, begun.battleId, TOKEN);
  story.route(ROW, "grove");
  for (const step of ["path", "guardian", "boss"] as const) {
    begun = officialBegin(story, AUTHORITY_A);
    winBattle(battles, BATTLE_ACTOR, begun.battleId, AUTHORITY_A);
    const resolved = story.resolve(ROW, begun.battleId, TOKEN);
    expect(resolved.step).not.toBe(step);
  }
  expect(story.state(ROW).completed).toBe(true);
}

describe("official story participation", () => {
  it("opens a token-bound encounter, holds the lock, and releases on resolve", () => {
    const { store, battles, story } = setup();
    try {
      story.choose(ROW, "pip");
      const begun = officialBegin(story, AUTHORITY_A);
      expect(begun.battleId).toBeTruthy();
      expect(story.locks.get(TOKEN, NOW)?.kind).toBe("story");
      const battle = battles.records.get(begun.battleId, BATTLE_ACTOR);
      expect(battle.mode).toBe("official");
      expect(battle.authority?.generation).toBe(GEN1);
      winBattle(battles, BATTLE_ACTOR, begun.battleId, AUTHORITY_A);
      const resolved = story.resolve(ROW, begun.battleId, TOKEN);
      expect(resolved).toMatchObject({ step: "route", completed: false });
      expect(story.locks.get(TOKEN, NOW)).toBeNull();
    } finally {
      store.close();
    }
  });

  it("adopts the binding on first contact and matches it afterwards", () => {
    const { store, story } = setup();
    try {
      expect(story.bindOrCheckOfficialOwnership(ROW, BINDING_A)).toEqual({
        status: "ok",
      });
      expect(story.bindOrCheckOfficialOwnership(ROW, BINDING_A)).toEqual({
        status: "ok",
      });
      expect(story.bindOrCheckOfficialOwnership(ROW, BINDING_B)).toMatchObject({
        status: "changed",
      });
    } finally {
      store.close();
    }
  });

  it("discards the open encounter on transfer and preserves saved progress", () => {
    const { store, battles, story } = setup();
    try {
      story.choose(ROW, "pip");
      const scout = officialBegin(story, AUTHORITY_A);
      winBattle(battles, BATTLE_ACTOR, scout.battleId, AUTHORITY_A);
      const scouted = story.resolve(ROW, scout.battleId, TOKEN);
      expect(scouted).toMatchObject({ step: "route" });
      story.route(ROW, "grove");
      const begun = officialBegin(story, AUTHORITY_A);
      winBattle(battles, BATTLE_ACTOR, begun.battleId, AUTHORITY_A);
      story.resolve(ROW, begun.battleId, TOKEN);
      const guardian = officialBegin(story, AUTHORITY_A);
      battles.step(BATTLE_ACTOR, guardian.battleId, 1, "basic", AUTHORITY_A);
      // Ownership moves mid-encounter: the next official check disagrees.
      expect(story.bindOrCheckOfficialOwnership(ROW, BINDING_B)).toMatchObject({
        status: "changed",
      });
      const discarded = story.discardEncounter(ROW, BINDING_B);
      expect(discarded).toMatchObject({
        step: "guardian",
        battleId: null,
        completed: false,
      });
      expect(discarded.lost).toBeFalsy();
      story.locks.release(TOKEN, guardian.battleId);
      expect(story.locks.get(TOKEN, NOW)).toBeNull();
    } finally {
      store.close();
    }
  });

  it("never resumes an unfinished battle from a previous generation", () => {
    const { store, battles, story } = setup();
    try {
      story.choose(ROW, "pip");
      const first = officialBegin(story, AUTHORITY_A);
      battles.step(BATTLE_ACTOR, first.battleId, 1, "basic", AUTHORITY_A);
      // New owner, same token: verify, discard and rebind, then begin anew.
      expect(story.bindOrCheckOfficialOwnership(ROW, BINDING_B)).toMatchObject({
        status: "changed",
      });
      const discarded = story.discardEncounter(ROW, BINDING_B);
      expect(discarded).toMatchObject({ step: "scout", battleId: null });
      story.locks.release(TOKEN, first.battleId);
      const second = beginStoryBattle(story, ROW, NOW, {
        token: TOKEN,
        binding: BINDING_B,
        authority: AUTHORITY_B,
      });
      expect(second.battleId).not.toBe(first.battleId);
      const orphan = battles.records.get(first.battleId, BATTLE_ACTOR);
      expect(orphan.state.outcome).toBeNull();
      // The orphaned battle rejects the new generation outright.
      expect(() =>
        battles.step(
          BATTLE_ACTOR,
          first.battleId,
          orphan.state.round,
          "basic",
          AUTHORITY_B,
        ),
      ).toThrow(/current ownership-generation grant/);
    } finally {
      store.close();
    }
  });

  it("competes with private series for one token lock", () => {
    const { store, story } = setup();
    try {
      const pvp = new PvpService(new PvpStore(store), PVP_TIMERS);
      story.choose(ROW, "pip");
      officialBegin(story, AUTHORITY_A);
      expect(story.locks.get(TOKEN, NOW)?.kind).toBe("story");
      expect(() =>
        pvp.create(
          {
            actor: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            mode: "official",
          },
          NOW,
          {
            identity: identityFor("276"),
            owner: OWNER_A,
            generation: GEN1,
          },
        ),
      ).toThrow(/already in an official story/);
    } finally {
      store.close();
    }
  });

  it("releases the lock on replay past an open battle", () => {
    const { store, battles, story } = setup();
    try {
      completeChapter(story, battles);
      story.replay(ROW, TOKEN);
      story.choose(ROW, "pip");
      const begun = officialBegin(story, AUTHORITY_A);
      expect(story.locks.get(TOKEN, NOW)?.kind).toBe("story");
      const replayed = story.replay(ROW, TOKEN);
      expect(replayed.battleId).toBeNull();
      expect(story.locks.get(TOKEN, NOW)).toBeNull();
      expect(replayed.completed).toBe(true);
      expect(begun.battleId).toBeTruthy();
    } finally {
      store.close();
    }
  });

  it("leaves guest chapters exactly alone", () => {
    const { store, battles, story } = setup();
    try {
      const guest = "99999999-9999-4999-8999-999999999999";
      story.choose(guest, "pip");
      const begun = beginStoryBattle(story, guest, NOW);
      expect(begun.battleId).toBeTruthy();
      expect(story.locks.get(TOKEN, NOW)).toBeNull();
      winBattle(battles, guest, begun.battleId, null);
      const resolved = story.resolve(guest, begun.battleId);
      expect(resolved).toMatchObject({ step: "route", lost: false });
    } finally {
      store.close();
    }
  });
});

describe("story lock expiry", () => {
  it("an expired reservation never revives its unfinished battle", () => {
    const { store, story } = setup();
    try {
      story.choose(ROW, "pip");
      const first = officialBegin(story, AUTHORITY_A);
      expect(story.locks.get(TOKEN, NOW + 3 * 3_600_000)).toBeNull();
      expect(() =>
        officialBegin(story, AUTHORITY_A, NOW + 3 * 3_600_000),
      ).toThrow(/reservation expired/);
      const interrupted = story.interrupt(
        ROW,
        "reservation-expired",
        NOW + 3 * 3_600_000,
      );
      expect(interrupted).toMatchObject({
        step: "scout",
        battleId: null,
        completed: false,
      });
      const next = officialBegin(story, AUTHORITY_A, NOW + 3 * 3_600_000);
      expect(next.battleId).not.toBe(first.battleId);
    } finally {
      store.close();
    }
  });
});
