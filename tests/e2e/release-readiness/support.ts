import { mkdirSync } from "node:fs";
import {
  expect,
  type Browser,
  type BrowserContext,
  type Page,
  type Route,
} from "@playwright/test";
import type { PvpView } from "../../../src/domain/pvp/view";
import type { BattleView, Move } from "../../../src/domain/combat/contracts";
const signedHeaders = new WeakMap<Page, Record<string, string>>();
export const evidence = ".cache/soryn-readiness";
export async function attachSignedHeaders(
  page: Page,
  patterns: string[],
  headers: Record<string, string>,
) {
  signedHeaders.set(page, headers);
  const attach = async (route: Route) => {
    const request = route.request();
    // Fixture proofs are scoped to this app, even if a caller supplies a broad glob.
    const origin = headers.Origin ?? headers.origin;
    if (!origin || new URL(request.url()).origin !== new URL(origin).origin) {
      await route.continue();
      return;
    }
    const response = await route.fetch({
      url: request.url(),
      headers: { ...request.headers(), ...headers },
    });
    await route.fulfill({ response });
  };
  for (const pattern of patterns) await page.route(pattern, attach);
}
export async function pair(browser: Browser, baseURL: string, label: string) {
  const options = {
    baseURL,
    viewport: { width: 1280, height: 800 },
    recordVideo: {
      dir: ".cache/readiness-recordings",
      size: { width: 1280, height: 800 },
    },
  };
  const left = await browser.newContext(options),
    right = await browser.newContext(options);
  return {
    left,
    right,
    a: await left.newPage(),
    b: await right.newPage(),
    label,
  };
}
export async function savePair(players: Awaited<ReturnType<typeof pair>>) {
  mkdirSync(".cache/readiness-recordings", { recursive: true });
  for (const [label, page, context] of [
    ["a", players.a, players.left],
    ["b", players.b, players.right],
  ] as const) {
    const video = page.video();
    await context.close();
    await video?.saveAs(
      `.cache/readiness-recordings/${players.label}-${label}.webm`,
    );
  }
}
export async function publicPair(a: Page, b: Page) {
  await a.goto("/match");
  await a.getByRole("button", { name: "Find a match", exact: true }).click();
  await expect(a.getByText(/Nobody else is waiting/)).toBeVisible();
  await b.goto("/match");
  await b.getByRole("button", { name: "Find a match", exact: true }).click();
  await expect(a.getByRole("button", { name: "Accept opponent" })).toBeVisible({
    timeout: 15000,
  });
  await a.getByRole("button", { name: "Accept opponent" }).click();
  await b.getByRole("button", { name: "Accept opponent" }).click();
  await expect(a).toHaveURL(/\/match\/[A-Za-z0-9_-]{20,}/);
  await expect(b).toHaveURL(a.url());
  await expect(a.getByRole("radio", { name: /Aegis/ })).toHaveCount(
    signedHeaders.get(a)?.["x-soryn-play"] ? 1 : 0,
  );
  await a.getByRole("radio", { name: "Pip / Scout" }).click();
  await b.getByRole("radio", { name: "Bolt / Courier" }).click();
  await expect(a.getByRole("radio", { name: "Pip / Scout" })).toBeChecked();
  await expect(b.getByRole("radio", { name: "Bolt / Courier" })).toBeChecked();
  await a.getByRole("button", { name: "Ready up" }).click();
  const readyReply = b.waitForResponse(
    (reply) =>
      reply.url().includes("/api/pvp") &&
      reply.request().method() === "POST" &&
      !!reply.request().postData()?.includes('"operation":"ready"'),
  );
  await b.getByRole("button", { name: "Ready up" }).click();
  const acknowledged = await readyReply;
  expect(acknowledged.ok(), await acknowledged.text()).toBe(true);
  await expect(a.getByRole("button", { name: /^Basic attack/ })).toBeEnabled({
    timeout: 20000,
  });
  await expect(b.getByRole("button", { name: /^Basic attack/ })).toBeEnabled({
    timeout: 20000,
  });
  return new URL(a.url()).pathname.split("/").at(-1)!;
}
export async function room(page: Page, invite: string): Promise<PvpView> {
  const reply = await page.request.get(`/api/pvp?invite=${invite}`, {
    headers: signedHeaders.get(page),
  });
  expect(reply.ok(), await reply.text()).toBe(true);
  return reply.json();
}
export async function choose(page: Page, move: Move) {
  const name =
    move === "special"
      ? /^Special/
      : move === "guard"
        ? /^Defence/
        : /^Basic attack/;
  const button = page.getByRole("button", { name });
  await expect(button).toBeEnabled({ timeout: 20000 });
  const posted = page.waitForResponse(
    (r) =>
      r.url().includes("/api/pvp") &&
      r.request().method() === "POST" &&
      (r.request().postData()?.includes('"operation":"move"') ?? false),
  );
  await button.click();
  const reply = await posted;
  expect(reply.ok()).toBe(true);
  return reply.json() as Promise<PvpView>;
}
/** Delay an actual old poll until after an action commits; do not synthesize state. */
export async function holdPoll(page: Page, invite: string) {
  let release!: () => void;
  let captured!: () => void;
  let delivered!: () => void;
  const waiting = new Promise<void>((resolve) => (release = resolve));
  const ready = new Promise<void>((resolve) => (captured = resolve));
  const finished = new Promise<void>((resolve) => (delivered = resolve));
  await page.route(
    `**/api/pvp?invite=${invite}*`,
    async (route) => {
      const response = await route.fetch();
      captured();
      await waiting;
      await route.fulfill({ response });
      delivered();
    },
    { times: 1 },
  );
  await ready;
  return async () => {
    release();
    await finished;
  };
}
export async function publicBattle(
  a: Page,
  b: Page,
  invite: string,
  winner: "a" | "b",
  refreshLock = false,
) {
  let view = await room(a, invite);
  for (let n = 0; n < 20 && !view.result; n++) {
    await expect(a.getByRole("button", { name: /^Basic attack/ })).toBeEnabled({
      timeout: 20000,
    });
    const specialA = a.getByRole("button", { name: /^Special/ });
    const aMove: Move =
      winner === "a" && (await specialA.isEnabled()) ? "special" : "basic";
    const release = refreshLock && n === 0 ? await holdPoll(a, invite) : null;
    const locked = await choose(a, aMove);
    if (release) {
      await release();
      await expect(a.locator(".turn-readiness")).toContainText("Move locked");
      await expect(
        a.getByRole("button", { name: /^Basic attack/ }),
      ).toBeDisabled();
    }
    if (refreshLock && n === 0) {
      const hidden = await room(b, invite);
      expect(hidden.opponent?.locked).toBe(true);
      expect(hidden.opponent && "move" in hidden.opponent).toBe(false);
      await a.reload();
      await expect(a.locator(".turn-readiness")).toContainText("Move locked", {
        timeout: 15000,
      });
      expect((await room(a, invite)).you.move).toBe(aMove);
      expect((await room(a, invite)).battle?.id).toBe(locked.battle?.id);
    }
    await expect(b.getByRole("button", { name: /^Basic attack/ })).toBeEnabled({
      timeout: 20000,
    });
    const bMove: Move =
      winner === "b" &&
      (await b.getByRole("button", { name: /^Special/ }).isEnabled())
        ? "special"
        : winner === "a" && n === 0
          ? "guard"
          : "basic";
    // Observe the UI's normal poll rather than add one probe per turn to its
    // shared read budget. Keep both independently served perspectives checked.
    const rendered = a.waitForResponse(async (reply) => {
      if (
        reply.request().method() !== "GET" ||
        !reply.url().includes(`/api/pvp?invite=${invite}`) ||
        !reply.ok()
      )
        return false;
      const next = (await reply.json()) as PvpView;
      return (
        next.battle?.id === locked.battle?.id &&
        (next.battle?.rounds.length ?? 0) > (locked.battle?.rounds.length ?? 0)
      );
    });
    const answered = await choose(b, bMove);
    view = (await (await rendered).json()) as PvpView;
    expect(view.latestSeq).toBe(answered.latestSeq);
    expect(view.battle?.state.player).toEqual(answered.battle?.state.opponent);
    expect(view.battle?.state.opponent).toEqual(answered.battle?.state.player);
  }
  expect(view.series?.phase).toMatch(/intermission|complete/);
  expect(view.result?.headline).toBe(winner === "a" ? "Victory" : "Defeat");
  for (const page of [a, b]) {
    const result = page.getByRole("heading", { name: /^(Victory|Defeat)$/ });
    await expect(result).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(300);
    await expect(result).toBeVisible({ timeout: 20000 });
  }
  return view;
}
export async function continueBattle(a: Page, b: Page) {
  await a.getByRole("button", { name: "Continue", exact: true }).click();
  await b.getByRole("button", { name: "Continue", exact: true }).click();
  for (const page of [a, b])
    await expect(
      page.getByRole("button", { name: /^Basic attack/ }),
    ).toBeEnabled({ timeout: 20000 });
}
export async function storyBattle(
  page: Page,
  lose = false,
  refresh = false,
): Promise<BattleView> {
  let battle: BattleView | null = null;
  for (let n = 0; n < 20; n++) {
    const basic = page.getByRole("button", { name: /^Basic attack/ });
    await expect(basic).toBeEnabled({ timeout: 20000 });
    const special = page.getByRole("button", { name: /^Special/ });
    const move = !lose && (await special.isEnabled()) ? special : basic;
    const posted = page.waitForResponse(
      (r) => r.url().includes("/api/battle") && r.request().method() === "POST",
    );
    await move.click();
    const reply = await posted;
    expect(reply.ok()).toBe(true);
    battle = (await reply.json()).battle;
    if (battle!.state.outcome) return battle!;
    await expect(basic).toBeEnabled({ timeout: 15000 });
    if (refresh && n === 0) {
      const id = battle!.id;
      await page.reload();
      const resume = page.getByRole("button", {
        name: "Resume battle",
        exact: true,
      });
      await expect(basic.or(resume)).toBeVisible({ timeout: 20000 });
      if (await resume.isVisible()) await resume.click();
      const saved = await (await page.request.get("/api/story")).json();
      expect(saved.battleId).toBe(id);
    }
  }
  throw new Error(`Story battle did not finish: ${battle?.id}`);
}
export async function saveRecording(
  page: Page,
  context: BrowserContext,
  label: string,
) {
  const video = page.video();
  await context.close();
  await video?.saveAs(`.cache/readiness-recordings/${label}.webm`);
}
