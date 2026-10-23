import { expect, it } from "vitest";
import { Store } from "../../src/server/persistence";
import { PvpService } from "../../src/server/pvp/service";
import { PvpStore } from "../../src/server/pvp/persistence";
import { PVP_TIMERS } from "../../src/domain/pvp/timers";
import { menuState } from "../../src/server/menu/http";
import { StoryService } from "../../src/server/story/service";
import { BattleStore } from "../../src/server/combat/persistence";
import { BattleService } from "../../src/server/combat/service";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
it("shows stored guest progress without creating sessions, queue rows or battles, or settling expired clocks", async () => {
  const store = new Store(":memory:");
  try {
    expect(menuState(store, null, 1)).toEqual({
      story: "begin",
      matchInvite: null,
      practice: false,
    });
    const battles = new BattleService(new BattleStore(store));
    const story = new StoryService(store, battles);
    const pvp = new PvpService(new PvpStore(store), PVP_TIMERS);
    story.choose(A, "pip");
    const room = pvp.create({ actor: A, mode: "guest" }, 10);
    pvp.join({ actor: B, mode: "guest" }, room.invite, 10);
    pvp.select(A, room.invite, "pip", 10);
    pvp.select(B, room.invite, "bolt", 10);
    await pvp.confirmReady(A, room.invite, true, 10);
    await pvp.confirmReady(B, room.invite, true, 10);
    const before = JSON.stringify(pvp.records.byInvite(room.invite));
    expect(menuState(store, A, 999999)).toMatchObject({
      story: "continue",
      matchInvite: room.invite,
      practice: false,
    });
    expect(JSON.stringify(pvp.records.byInvite(room.invite))).toBe(before);
    expect(
      menuState(store, "33333333-3333-4333-8333-333333333333", 11),
    ).toEqual({ story: "begin", matchInvite: null, practice: false });
    expect(store.db.prepare("SELECT count(*) AS n FROM battles").get()?.n).toBe(
      0,
    );
    expect(
      store.db.prepare("SELECT count(*) AS n FROM story_progress").get()?.n,
    ).toBe(1);
  } finally {
    store.close();
  }
});
