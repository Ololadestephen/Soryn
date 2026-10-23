import { prepareStoryHttp } from "../fixtures/story-journey";
import { NextRequest } from "next/server";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  identityFor,
  tokenKey,
  tokenStoryActor,
} from "../../src/domain/identity";
import { PVP_TIMERS } from "../../src/domain/pvp/timers";
import {
  OWNERSHIP_STALL_TERMINATE_MS,
  TOKEN_LOCK_TTL_MS,
} from "../../src/domain/pvp/ownership";
import { Store } from "../../src/server/persistence";
import { PvpStore } from "../../src/server/pvp/persistence";
import { PvpService } from "../../src/server/pvp/service";
import { ServiceError } from "../../src/server/errors";
import { createStoryHandlers } from "../../src/server/story/http";
import { createPvpHandlers } from "../../src/server/pvp/http";
import { officialCombatFixture, origin } from "../fixtures/official-combat";
import { TokenRecords } from "../../src/server/records/tokenRecords";
import { createRecordHandlers } from "../../src/server/records/http";

const identity = identityFor("276");
const token = tokenKey(identity);
const owner = `0x${"a".repeat(40)}`;
const generation = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const now = 1_700_000_000_000;
async function publicRoom(service: PvpService) {
  const created = service.create({ actor: A, mode: "official" }, now, {
    identity,
    owner,
    generation,
  });
  service.join({ actor: B, mode: "guest" }, created.invite, now);
  service.select(A, created.invite, "pip", now);
  service.select(B, created.invite, "bolt", now);
  await service.confirmReady(A, created.invite, true, now);
  await service.confirmReady(B, created.invite, true, now);
  service.assets(A, created.invite, now);
  service.assets(B, created.invite, now);
  return created.invite;
}
describe("M7b bounded interruption", () => {
  it("does not revive a stalled series when verification returns after the one-hour bound", async () => {
    const store = new Store(":memory:");
    let available = false;
    const service = new PvpService(
      new PvpStore(store),
      PVP_TIMERS,
      undefined,
      undefined,
      undefined,
      async () => {
        if (!available) throw new ServiceError(503, "Fixture outage");
        return [];
      },
    );
    try {
      const invite = await publicRoom(service);
      await expect(service.pollRoomChecked(B, invite, now)).rejects.toThrow(
        /unavailable/,
      );
      available = true;
      const ended = await service.pollRoomChecked(
        B,
        invite,
        now + OWNERSHIP_STALL_TERMINATE_MS,
      );
      expect(ended.seated && ended.series?.outcome).toMatchObject({
        kind: "abandoned",
        winner: null,
      });
      expect(service.records.byInvite(invite).interruption?.reason).toBe(
        "verification-unavailable",
      );
      expect(
        service.locks.get(token, now + OWNERSHIP_STALL_TERMINATE_MS),
      ).toBeNull();
    } finally {
      store.close();
    }
  });
  it("pauses official clocks during an outage and rebases once on recovery without a timeout win", async () => {
    const store = new Store(":memory:");
    let outage = true;
    const service = new PvpService(
      new PvpStore(store),
      PVP_TIMERS,
      undefined,
      undefined,
      undefined,
      async () => {
        if (outage)
          throw new ServiceError(503, "Fixture verification unavailable");
        return [];
      },
    );
    try {
      const invite = await publicRoom(service);
      const before = service.records.byInvite(invite);
      await expect(
        service.pollRoomChecked(B, invite, now + 100),
      ).rejects.toThrow(/unavailable/);
      expect(service.records.byInvite(invite).match?.rounds).toHaveLength(0);
      outage = false;
      const recoveredAt = now + 90_100;
      await service.pollRoomChecked(B, invite, recoveredAt);
      const recovered = service.records.byInvite(invite);
      expect(recovered.match!.deadlineAt).toBe(
        before.match!.deadlineAt + 90_000,
      );
      expect(recovered.match!.rounds).toHaveLength(0);
      expect(recovered.series!.wins).toEqual({ a: 0, b: 0 });
      await service.pollRoomChecked(B, invite, recoveredAt + 1);
      expect(service.records.byInvite(invite).match!.deadlineAt).toBe(
        recovered.match!.deadlineAt,
      );
    } finally {
      store.close();
    }
  });
  it("terminates at the outage bound without a win and frees only its own reservation", async () => {
    const store = new Store(":memory:");
    const service = new PvpService(
      new PvpStore(store),
      PVP_TIMERS,
      undefined,
      undefined,
      undefined,
      async () => {
        throw new ServiceError(503, "Fixture outage");
      },
    );
    try {
      const invite = await publicRoom(service);
      await expect(service.pollRoomChecked(B, invite, now)).rejects.toThrow(
        /unavailable/,
      );
      const ended = await service.pollRoomChecked(
        B,
        invite,
        now + OWNERSHIP_STALL_TERMINATE_MS,
      );
      expect(ended.seated && ended.series?.outcome).toMatchObject({
        kind: "abandoned",
        winner: null,
      });
      expect(service.records.byInvite(invite).interruption?.reason).toBe(
        "verification-unavailable",
      );
      expect(
        service.locks.get(token, now + OWNERSHIP_STALL_TERMINATE_MS),
      ).toBeNull();
    } finally {
      store.close();
    }
  });
  it("an expired encounter cannot resume or release a newer lock", async () => {
    const store = new Store(":memory:");
    const service = new PvpService(new PvpStore(store), PVP_TIMERS);
    try {
      const invite = await publicRoom(service);
      const old = service.records.byInvite(invite).series!.id;
      const later = now + TOKEN_LOCK_TTL_MS;
      service.locks.acquire({
        token,
        encounter: "new-story",
        kind: "story",
        owner,
        generation,
        openedAt: later,
        expiresAt: later + 1000,
      });
      const ended = await service.pollRoomChecked(A, invite, later, {
        identity,
        owner,
        generation,
      });
      expect(ended.seated && ended.series?.outcome?.winner).toBeNull();
      expect(service.records.byInvite(invite).interruption?.reason).toBe(
        "reservation-expired",
      );
      expect(service.locks.release(token, old)).toBe(false);
      expect(service.locks.get(token, later)?.encounter).toBe("new-story");
    } finally {
      store.close();
    }
  });
});

describe("M7b Story HTTP authority", () => {
  it("plays real Story moves, preserves the former keeper checkpoint, and gives the successor a fresh private run", async () => {
    const ctx = await officialCombatFixture();
    const signed = await ctx.login();
    const story = createStoryHandlers(
      ctx.store,
      origin,
      ctx.auth,
      ctx.verifier,
    );
    const call = (input: Record<string, unknown>, login = signed) =>
      story.post(
        new NextRequest(`${origin}/api/story`, {
          method: "POST",
          headers: {
            Origin: origin,
            "content-type": "application/json",
            cookie: login.cookie,
            ...login.headers,
          },
          body: JSON.stringify({ ...input, mode: "official" }),
        }),
      );
    try {
      expect((await call({ operation: "choose", fighter: "pip" })).status).toBe(
        200,
      );
      await prepareStoryHttp(call);
      const began = await (await call({ operation: "begin" })).json();
      let battle;
      for (let n = 0; n < 20; n++) {
        const get = await story.get(
          new NextRequest(`${origin}/api/story?mode=official`, {
            headers: { cookie: signed.cookie, ...signed.headers },
          }),
        );
        const current = await get.json();
        const move = current.battle.legal.includes("special")
          ? "special"
          : "basic";
        const reply = await call({
          operation: "move",
          id: began.battleId,
          round: current.battle.state.round,
          move,
        });
        expect(reply.status).toBe(200);
        battle = (await reply.json()).battle;
        if (battle.state.outcome) break;
      }
      expect(battle.state.outcome).toBe("victory");
      expect(
        (
          await (
            await call({ operation: "resolve", battleId: began.battleId })
          ).json()
        ).step,
      ).toBe("route");
      const recordHandlers = createRecordHandlers(
        ctx.store,
        origin,
        ctx.auth,
        ctx.verifier,
      );
      const records = new TokenRecords(ctx.store);
      const accomplishment = records
        .list(identity)
        .find((row) => row.kind === "story-encounter")!;
      const publish = (login = signed) =>
        recordHandlers.post(
          new NextRequest(`${origin}/api/competitor`, {
            method: "POST",
            headers: {
              origin,
              "content-type": "application/json",
              cookie: login.cookie,
              ...login.headers,
            },
            body: JSON.stringify({
              operation: "publish",
              id: accomplishment.id,
              alias: "Original keeper",
              consent: true,
            }),
          }),
        );
      expect((await publish()).status).toBe(200);
      expect((await publish()).status).toBe(200);
      expect(records.published(identity)).toHaveLength(1);
      await call({ operation: "route", route: "grove" });
      for (const action of ["prints", "companion", "bank"])
        await call({ operation: "interact", action });
      const path = await (await call({ operation: "begin" })).json();
      ctx.transferAway();
      const next = await ctx.login(ctx.outsider);
      expect((await publish()).status).toBe(403);
      expect((await publish(next)).status).toBe(403);
      const publicReply = await recordHandlers.profile(
        new NextRequest(`${origin}/api/chog/276`),
        "276",
      );
      const publicView = await publicReply.json();
      expect(publicView.records[0].attribution).toBe("Original keeper");
      expect(publicView.ownership.owner).toBe(
        ctx.outsider.address.toLowerCase(),
      );
      for (const privateField of [
        "generation",
        "source",
        "cookie",
        "session",
        "keeper:",
      ])
        expect(JSON.stringify(publicView)).not.toContain(privateField);
      const profile = await story.get(
        new NextRequest(`${origin}/api/story?mode=official`, {
          headers: { cookie: next.cookie, ...next.headers },
        }),
      );
      expect(await profile.json()).toMatchObject({
        step: "meet",
        fighter: null,
        battleId: null,
      });
      const rows = ctx.store.db
        .prepare("SELECT record FROM story_progress WHERE actor LIKE ?")
        .all(`${tokenStoryActor(identity)}:keeper:%`);
      expect(rows.map((row) => JSON.parse(String(row.record)))).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            step: "path",
            battleId: null,
            interruption: "ownership-changed",
          }),
        ]),
      );
      expect(
        (
          await call(
            { operation: "move", id: path.battleId, round: 1, move: "basic" },
            next,
          )
        ).status,
      ).toBe(409);
      expect(
        new TokenRecords(ctx.store)
          .list(identity)
          .filter((row) => row.kind === "story-encounter"),
      ).toHaveLength(1);
      expect(new TokenRecords(ctx.store).published(identity)).toHaveLength(1);
    } finally {
      ctx.store.close();
    }
  });
  it("records a first-party verification stall instead of allowing an opponent poll to advance a hidden move", async () => {
    const ctx = await officialCombatFixture();
    const signed = await ctx.login();
    const pvp = createPvpHandlers(ctx.store, origin, ctx.auth, ctx.verifier);
    try {
      const create = await pvp.post(
        new NextRequest(`${origin}/api/pvp`, {
          method: "POST",
          headers: {
            Origin: origin,
            "content-type": "application/json",
            cookie: signed.cookie,
            ...signed.headers,
          },
          body: JSON.stringify({ operation: "create", mode: "official" }),
        }),
      );
      const { invite } = await create.json();
      ctx.outage();
      const failed = await pvp.get(
        new NextRequest(`${origin}/api/pvp?invite=${invite}`, {
          headers: { cookie: signed.cookie, ...signed.headers },
        }),
      );
      expect(failed.status).toBe(503);
      expect(
        new PvpStore(ctx.store).byInvite(invite).ownershipStallSince,
      ).toBeTypeOf("number");
      expect(new PvpStore(ctx.store).byInvite(invite).series!.wins).toEqual({
        a: 0,
        b: 0,
      });
    } finally {
      ctx.store.close();
    }
  });
});

// Test the explicitly enabled rollout; missing configuration is covered by access tests.
beforeEach(() => vi.stubEnv("SORYN_HOLDER_ACCESS", "enabled"));
afterEach(() => vi.unstubAllEnvs());
