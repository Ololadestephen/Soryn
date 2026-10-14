import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { getGame, postGame } from "../../src/server/http";
import { database } from "../../src/server/database";

const directory = mkdtempSync(join(tmpdir(), "chog-http-"));
process.env.CHOG_DB_PATH = join(directory, "test.sqlite");
afterAll(() => rmSync(directory, { recursive: true, force: true }));
const origin = "http://localhost:3000";
async function session() {
  const response = await getGame(new NextRequest(`${origin}/api/game`));
  return response.headers.get("set-cookie")!.split(";")[0];
}
function post(
  input: unknown,
  cookie: string,
  extraHeaders: Record<string, string> = {},
) {
  return postGame(
    new NextRequest(`${origin}/api/game`, {
      method: "POST",
      headers: {
        origin,
        cookie,
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      body: JSON.stringify(input),
    }),
  );
}
const start = () => ({
  operation: "start",
  id: randomUUID(),
  mode: "guest",
  exhibitId: null,
  retryOf: null,
});

describe("HTTP boundaries", () => {
  it("validates class access, legal skill targets and idempotent charge spends at the HTTP boundary", async () => {
    const cookie = await session();
    const forged = await post({ ...start(), characterId: "aegis" }, cookie);
    expect(forged.status).toBe(403);
    expect(
      (await post({ ...start(), characterId: "pip", charges: 2 }, cookie))
        .status,
    ).toBe(400);
    expect(
      (await post({ ...start(), characterId: "pip", holder: true }, cookie))
        .status,
    ).toBe(400);
    const input = { ...start(), characterId: "pip" };
    expect((await post(input, cookie)).status).toBe(200);
    const skill = {
      operation: "step",
      id: input.id,
      step: 0,
      action: "skill-peek",
    };
    const first = await post(skill, cookie);
    expect(first.status).toBe(200);
    const original = await first.json();
    expect(original.run.observation.tactics.charges).toBe(0);
    expect(await (await post(skill, cookie)).json()).toEqual(original);
    expect(
      (await post({ ...skill, step: 1, action: "skill-peek" }, cookie)).status,
    ).toBe(422);
    expect(
      (await post({ ...skill, step: 1, action: "skill-shadow" }, cookie))
        .status,
    ).toBe(422);
    const read = await getGame(
      new NextRequest(`${origin}/api/game`, { headers: { cookie } }),
    );
    const current = await read.json();
    expect(current.run.step).toBe(1);
    expect(current.run.observation.turns).toBe(10);
    expect(current.run.observation.tactics.events).toHaveLength(1);
  });
  it("rolls back a turn when its journal projection cannot be validated", async () => {
    const cookie = await session();
    const actor = cookie.split("=")[1];
    const prior = start();
    await post(prior, cookie);
    await post(
      { operation: "step", id: prior.id, step: 0, action: "door" },
      cookie,
    );
    const active = start();
    await post(active, cookie);
    const store = database();
    const backup = store.getRun(prior.id, actor);
    store.db.prepare("UPDATE runs SET record='{}' WHERE id=?").run(prior.id);
    try {
      const failed = await post(
        { operation: "step", id: active.id, step: 0, action: "inspect" },
        cookie,
      );
      expect(failed.status).toBe(503);
      expect(store.getRun(active.id, actor).actions).toEqual([]);
    } finally {
      store.db
        .prepare("UPDATE runs SET record=? WHERE id=?")
        .run(JSON.stringify(backup), prior.id);
    }
  });
  it("scopes private chapter reads and selected ghost races to the guest cookie", async () => {
    const cookie = await session();
    const other = await session();
    const input = start();
    const active = await (await post(input, cookie)).json();
    expect(active.journal.chapters).toEqual([]);
    const getChapter = (sessionCookie: string, id: string = input.id) =>
      getGame(
        new NextRequest(`${origin}/api/game?chapter=${id}`, {
          headers: { cookie: sessionCookie },
        }),
      );
    expect(getChapter(cookie).status).toBe(404);
    const completed = await (
      await post(
        { operation: "step", id: input.id, step: 0, action: "door" },
        cookie,
      )
    ).json();
    expect(completed.journal.chapters[0].id).toBe(input.id);
    const privateReplay = getChapter(cookie);
    expect(privateReplay.headers.get("Cache-Control")).toBe("no-store");
    expect((await privateReplay.json()).chapter.replay).toEqual(
      completed.run.replay,
    );
    expect(getChapter(other).status).toBe(404);
    expect(getChapter("").status).toBe(404);
    expect(getChapter(cookie, "not-a-uuid").status).toBe(400);
    expect(
      getGame(
        new NextRequest(
          `${origin}/api/game?chapter=${input.id}&replay=${randomUUID()}`,
          { headers: { cookie } },
        ),
      ).status,
    ).toBe(400);
    const race = { operation: "race", id: randomUUID(), chapterId: input.id };
    expect((await post(race, other)).status).toBe(404);
    expect(
      (await post({ ...race, wallet: "pretend-owner" }, cookie)).status,
    ).toBe(400);
    const selected = await (await post(race, cookie)).json();
    expect(selected.run.rival.version).toBe(completed.run.ghost.version);
    expect(selected.run.rival.replay).toBeNull();
    expect(selected.run.cohort).toBe("informed-retry");
    expect(await (await post(race, cookie)).json()).toEqual(selected);
  });
  it("rejects official writes and extra fields without a configured adapter", async () => {
    const cookie = await session();
    expect((await post({ ...start(), mode: "official" }, cookie)).status).toBe(
      400,
    );
    expect(
      (await post({ ...start(), wallet: "pretend-owner", score: 999 }, cookie))
        .status,
    ).toBe(400);
  });
  it("requires same-origin, established session and JSON, with bounded body", async () => {
    const cookie = await session();
    expect(
      (await post(start(), cookie, { origin: "https://attacker.example" }))
        .status,
    ).toBe(403);
    expect((await post(start(), "")).status).toBe(401);
    expect(
      (await post(start(), cookie, { "Content-Type": "text/plain" })).status,
    ).toBe(415);
    expect((await post({ padding: "a".repeat(5000) }, cookie)).status).toBe(
      413,
    );
    const malformed = new NextRequest(`${origin}/api/game`, {
      method: "POST",
      headers: { cookie, origin, "Content-Type": "application/json" },
      body: "{",
    });
    expect((await postGame(malformed)).status).toBe(400);
  });
  it("handles parallel duplicate steps and publication as one durable mutation", async () => {
    const cookie = await session();
    const input = start();
    await post(input, cookie);
    const step = { operation: "step", id: input.id, step: 0, action: "door" };
    const responses = await Promise.all([
      post(step, cookie),
      post(step, cookie),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const states = await Promise.all(
      responses.map((response) => response.json()),
    );
    expect(states[0]).toEqual(states[1]);
    expect(states[0].run.step).toBe(1);
    expect((await post({ ...step, step: 1 }, cookie)).status).toBe(422);
    const publication = {
      operation: "publish",
      id: input.id,
      title: "The Door Was Painted",
      alias: "Test curator",
      consent: true,
    };
    expect(
      (await post({ ...publication, consent: false }, cookie)).status,
    ).toBe(400);
    const publishes = await Promise.all([
      post(publication, cookie),
      post(publication, cookie),
    ]);
    const exhibits = await Promise.all(
      publishes.map((response) => response.json()),
    );
    expect(exhibits[0]).toEqual(exhibits[1]);
  });
});
