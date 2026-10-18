import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { battleSessionSchema } from "../../src/domain/combat/responses";
import { describe, it, expect } from "vitest";
import {
  officialCombatFixture as setup,
  origin,
} from "../fixtures/official-combat";
describe("combat HTTP current-owner and input boundaries", () => {
  it("hides pending choices and rejects client damage/loadouts, cross-session reads and duplicate conflicts", async () => {
    const ctx = await setup();
    try {
      const id = randomUUID(),
        start = {
          operation: "start",
          mode: "guest",
          id,
          characterId: "pip",
          opponent: "bolt",
        };
      expect((await ctx.post({ ...start, health: 999 })).status).toBe(400);
      expect((await ctx.post({ ...start, characterId: "aegis" })).status).toBe(
        403,
      );
      const opened = await ctx.post(start);
      expect(opened.status).toBe(200);
      const data = await opened.json();
      expect(battleSessionSchema.safeParse(data).success).toBe(true);
      expect(data.battle.pending).toBeUndefined();
      expect(data.battle.authority).toBeUndefined();
      const step = {
        operation: "step",
        mode: "guest",
        id,
        round: 1,
        move: "special",
      };
      const played = await (await ctx.post(step)).json();
      expect(await (await ctx.post(step)).json()).toEqual(played);
      expect((await ctx.post({ ...step, move: "basic" })).status).toBe(409);
      expect((await ctx.post({ ...step, round: 3 })).status).toBe(409);
      expect(
        (await ctx.post({ ...step, round: 2, move: "teleport" })).status,
      ).toBe(400);
      expect(
        (await ctx.post(step, "", { origin: "https://other.example" })).status,
      ).toBe(403);
      expect(
        (
          await ctx.battles.get(
            new NextRequest(`${origin}/api/battle?id=${id}`),
          )
        ).status,
      ).toBe(404);
    } finally {
      ctx.store.close();
    }
  });
  it("requires signed provider, wallet grant and fresh ownership even for an idempotent replay", async () => {
    const ctx = await setup();
    try {
      const owner = await ctx.login(),
        id = randomUUID(),
        start = {
          operation: "start",
          mode: "official",
          id,
          characterId: "aegis",
          opponent: "pip",
        };
      expect((await ctx.post(start, owner.cookie)).status).toBe(401);
      expect((await ctx.post(start, owner.cookie, owner.headers)).status).toBe(
        200,
      );
      const step = {
        operation: "step",
        mode: "official",
        id,
        round: 1,
        move: "special",
      };
      const accepted = await ctx.post(step, owner.cookie, owner.headers);
      expect(accepted.status).toBe(200);
      ctx.outage();
      expect(
        (
          await ctx.post(
            { ...step, round: 2, move: "basic" },
            owner.cookie,
            owner.headers,
          )
        ).status,
      ).toBe(503);
      expect(
        (
          await ctx.post({
            operation: "start",
            mode: "guest",
            id: randomUUID(),
            characterId: "moss",
            opponent: "bolt",
          })
        ).status,
      ).toBe(200);
      ctx.recover();
      ctx.awayBack();
      expect((await ctx.post(step, owner.cookie, owner.headers)).status).toBe(
        403,
      );
      const restored = await ctx.battles.get(
        new NextRequest(`${origin}/api/battle?mode=official&id=${id}`, {
          headers: { cookie: owner.cookie, ...owner.headers },
        }),
      );
      expect(restored.status).toBe(403);
      const wrong = await ctx.proof(ctx.outsider.address, "did:privy:other");
      expect((await ctx.post(start, owner.cookie, wrong)).status).toBe(401);
    } finally {
      ctx.store.close();
    }
  });
  it("non-owner authentication cannot select an official starter or holder fighter", async () => {
    const ctx = await setup();
    try {
      const outsider = await ctx.login(ctx.outsider);
      for (const characterId of ["pip", "nyx"])
        expect(
          (
            await ctx.post(
              {
                operation: "start",
                mode: "official",
                id: randomUUID(),
                characterId,
                opponent: "pip",
              },
              outsider.cookie,
              outsider.headers,
            )
          ).status,
        ).toBe(403);
    } finally {
      ctx.store.close();
    }
  });
});

it("battle reads have their own quota and anonymous reads share a bounded bucket", async () => {
  const ctx = await setup();
  try {
    const id = randomUUID(),
      actor = randomUUID(),
      cookie = `chog_guest=${actor}`;
    for (let index = 0; index < 90; index++)
      expect(
        (
          await ctx.battles.get(
            new NextRequest(`${origin}/api/battle`, { headers: { cookie } }),
          )
        ).status,
      ).toBe(200);
    expect(
      (
        await ctx.battles.get(
          new NextRequest(`${origin}/api/battle`, { headers: { cookie } }),
        )
      ).status,
    ).toBe(429);
    expect(
      (
        await ctx.post(
          {
            operation: "start",
            mode: "guest",
            id,
            characterId: "pip",
            opponent: "bolt",
          },
          cookie,
        )
      ).status,
    ).toBe(200);
    const previousAnonymousReads = Number(
      ctx.store.db
        .prepare("SELECT count FROM rate_limits WHERE actor=?")
        .get("read:anonymous-guest")?.count ?? 0,
    );
    for (let index = previousAnonymousReads; index < 120; index++)
      expect(
        (await ctx.battles.get(new NextRequest(`${origin}/api/battle`))).status,
      ).toBe(200);
    expect(
      (await ctx.battles.get(new NextRequest(`${origin}/api/battle`))).status,
    ).toBe(429);
  } finally {
    ctx.store.close();
  }
});
