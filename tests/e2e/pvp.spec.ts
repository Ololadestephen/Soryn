import {
  publicBattle,
  continueBattle,
  room,
  holdPoll,
} from "./release-readiness/support";
import { copyFile } from "node:fs/promises";
import { expect, test, type Browser, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function contexts(browser: Browser, record: boolean) {
  const video = record
    ? {
        recordVideo: {
          dir: ".cache/pvp-regression",
          size: { width: 1280, height: 800 },
        },
      }
    : {};
  const hostContext = await browser.newContext({
    ...video,
    baseURL: test.info().project.use.baseURL,
    permissions: ["clipboard-read", "clipboard-write"],
    viewport: { width: 1280, height: 800 },
  });
  const friendContext = await browser.newContext({
    ...video,
    baseURL: test.info().project.use.baseURL,
    permissions: ["clipboard-read", "clipboard-write"],
    viewport: { width: 1280, height: 800 },
  });
  return {
    hostContext,
    friendContext,
    host: await hostContext.newPage(),
    friend: await friendContext.newPage(),
  };
}

async function invite(host: Page, friend: Page) {
  await host.goto("/challenge");
  await host.getByRole("button", { name: "Create invitation" }).click();
  await host.waitForURL(/\/challenge\/[A-Za-z0-9_-]{20,}/);
  const url = host.url();
  await expect(host.getByText(/Room code:/)).toHaveCount(0);
  await expect(
    host.getByRole("textbox", { name: "Invitation link" }),
  ).toHaveValue(url);
  await friend.goto(url);
  await friend.getByRole("button", { name: "Take the open seat" }).click();
  await expect(host.getByText(/Opponent is choosing/)).toBeVisible({
    timeout: 10_000,
  });
  await expect(friend.getByText(/Opponent is choosing/)).toBeVisible();
  return url;
}

async function pick(page: Page, name: string) {
  const radio = page.getByRole("radio", { name });
  await radio.click();
  await expect(radio).toBeChecked({ timeout: 10_000 });
}

async function ready(host: Page, friend: Page) {
  await pick(host, "Pip / Scout");
  await pick(friend, "Bolt / Courier");
  await expect(host.getByRole("button", { name: "Ready up" })).toBeEnabled();
  await expect(friend.getByRole("button", { name: "Ready up" })).toBeEnabled();
  await host.getByRole("button", { name: "Ready up" }).click();
  await friend.getByRole("button", { name: "Ready up" }).click();
  await expect(host.getByText("Choose your move")).toBeVisible({
    timeout: 20_000,
  });
  await expect(friend.getByText("Choose your move")).toBeVisible({
    timeout: 20_000,
  });
}

function outcome(page: Page) {
  return page.getByRole("heading", {
    name: /^(Victory|Defeat|Draw|No contest)$/,
  });
}

async function submit(page: Page, move: RegExp) {
  await expect(page.getByText("Choose your move")).toBeVisible({
    timeout: 20_000,
  });
  const posted = page.waitForResponse(
    (response) =>
      response.url().includes("/api/pvp") &&
      response.request().method() === "POST" &&
      (response.request().postData()?.includes('"operation":"move"') ?? false),
  );
  await page.getByRole("button", { name: move }).click();
  return JSON.parse(await (await posted).text()) as {
    prompt: string;
    you: { move: string | null };
    battle: { rounds: { player: string; opponent: string }[] } | null;
  };
}

test("private series stays archived and play again uses a fresh shared invitation", async ({
  browser,
}) => {
  test.setTimeout(240000);
  const { hostContext, friendContext, host, friend } = await contexts(
    browser,
    true,
  );
  try {
    const original = await invite(host, friend);
    await host.getByText("Invite a friend", { exact: true }).click();
    await host.getByRole("button", { name: "Copy invitation" }).click();
    expect(await host.evaluate(() => navigator.clipboard.readText())).toBe(
      original,
    );
    await ready(host, friend);
    const token = new URL(original).pathname.split("/").at(-1)!;
    let result = await publicBattle(host, friend, token, "a");
    for (let i = 0; result.series?.phase !== "complete" && i < 3; i++) {
      await continueBattle(host, friend);
      result = await publicBattle(host, friend, token, "a");
    }
    expect(result.series?.phase).toBe("complete");
    await host.reload({ waitUntil: "domcontentloaded" });
    await expect(outcome(host)).toBeVisible();
    await expect(
      host.getByRole("button", { name: "Request rematch" }),
    ).toHaveCount(0);
    await host
      .getByRole("link", { name: "Challenge a friend", exact: true })
      .click();
    await expect(host).toHaveURL(/\/challenge$/);
    const next = await invite(host, friend);
    expect(next).not.toBe(original);
    expect((await room(host, token)).series).toEqual(result.series);
    await ready(host, friend);
    await expect(
      host.getByRole("button", { name: /^Basic attack/ }),
    ).toBeEnabled({ timeout: 20000 });
  } finally {
    await hostContext.close();
    await friendContext.close();
  }
});

test("a refresh keeps one locked move and a second tab cannot replace it", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const hostContext = await browser.newContext();
  const friendContext = await browser.newContext();
  const host = await hostContext.newPage();
  const friend = await friendContext.newPage();
  const extra = await hostContext.newPage();
  let releasePoll: (() => Promise<void>) | null = null;
  try {
    const url = await invite(host, friend);
    // Open the second client before the move clock starts; asset navigation
    // must not consume the intentionally shortened test turn.
    await extra.goto(url);
    await expect(extra.getByText("Opponent is choosing")).toBeVisible();
    await ready(host, friend);
    await expect(extra.getByText("Choose your move")).toBeVisible({
      timeout: 15_000,
    });
    await expect(extra.getByRole("button", { name: /Special/ })).toBeEnabled();
    releasePoll = await holdPoll(
      extra,
      new URL(url).pathname.split("/").at(-1)!,
    );
    const locked = await submit(host, /Basic attack/);
    expect(locked.you.move).toBe("basic");
    await extra.getByRole("button", { name: /Special/ }).click();
    await expect(extra.getByText("Move already locked.")).toBeVisible();
    await releasePoll();
    releasePoll = null;
    await friend.reload({ waitUntil: "domcontentloaded" });
    // Read the authenticated refreshed session, not a pre-navigation CDP body
    // that Chromium may discard as the old document is replaced.
    const hidden = await (
      await friend.request.get(
        `/api/pvp?invite=${new URL(url).pathname.split("/").at(-1)!}`,
      )
    ).text();
    expect(hidden).not.toMatch(/"move"\s*:\s*"basic"/);
    expect(hidden).toContain('"locked":true');
    await host.reload();
    await expect(host.getByText("Move locked")).toBeVisible({
      timeout: 15_000,
    });
    const answered = await submit(friend, /Defence/);
    expect(answered.battle?.rounds).toHaveLength(1);
    expect(answered.battle?.rounds[0]).toMatchObject({
      player: "guard",
      opponent: "basic",
    });
  } finally {
    await releasePoll?.();
    await hostContext.close();
    await friendContext.close();
  }
});

test("one idle fighter forfeits and two idle fighters abandon", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const first = await contexts(browser, false);
  try {
    await invite(first.host, first.friend);
    await ready(first.host, first.friend);
    const locked = await submit(first.host, /Basic attack/);
    expect(locked.you.move).toBe("basic");
    await expect(
      first.host.getByRole("heading", { name: "Victory" }),
    ).toBeVisible({
      timeout: 35_000,
    });
    await expect(
      first.friend.getByRole("heading", { name: "Defeat" }),
    ).toBeVisible();
    const reason = "Two missed turns in a row forfeited the match.";
    await expect(first.host.getByText(reason)).toBeVisible();
    await expect(first.friend.getByText(reason)).toBeVisible();
  } finally {
    await first.hostContext.close();
    await first.friendContext.close();
  }
  const second = await contexts(browser, false);
  try {
    await invite(second.host, second.friend);
    await ready(second.host, second.friend);
    const reason =
      "Both fighters missed two turns in a row, so the match is a no contest.";
    await expect(
      second.host.getByRole("heading", { name: "No contest" }),
    ).toBeVisible({
      timeout: 35_000,
    });
    await expect(
      second.friend.getByRole("heading", { name: "No contest" }),
    ).toBeVisible();
    await expect(second.host.getByText(reason)).toBeVisible();
    await expect(second.friend.getByText(reason)).toBeVisible();
  } finally {
    await second.hostContext.close();
    await second.friendContext.close();
  }
});

test("leaving frees the seat and a changed fighter clears ready", async ({
  browser,
}) => {
  test.setTimeout(40_000);
  const { hostContext, friendContext, host, friend } = await contexts(
    browser,
    false,
  );
  try {
    const url = await invite(host, friend);
    await pick(host, "Pip / Scout");
    await host.getByRole("button", { name: "Ready up" }).click();
    await expect(host.getByRole("button", { name: "Not ready" })).toBeVisible();
    await host.getByRole("button", { name: "Not ready", exact: true }).click();
    await pick(host, "Moss / Caretaker");
    await expect(host.getByRole("button", { name: "Not ready" })).toHaveCount(
      0,
    );
    await host.getByRole("button", { name: "Leave match" }).click();
    await host.waitForURL(/\/challenge$/);
    await expect(
      friend.getByText("Waiting for an opponent", { exact: true }),
    ).toBeVisible({
      timeout: 10_000,
    });
    await host.goto(url);
    await expect(
      host.getByRole("button", { name: "Take the open seat" }),
    ).toBeVisible();
    await expect(host.getByRole("button", { name: "Ready up" })).toHaveCount(0);
  } finally {
    await hostContext.close();
    await friendContext.close();
  }
});

test("two guests are paired from the public queue without an invitation", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const video = {
    recordVideo: {
      dir: ".cache/pvp-regression",
      size: { width: 1280, height: 800 },
    },
  };
  const hostContext = await browser.newContext({
    ...video,
    baseURL: test.info().project.use.baseURL,
    permissions: ["clipboard-read", "clipboard-write"],
    viewport: { width: 1280, height: 800 },
  });
  const friendContext = await browser.newContext({
    ...video,
    baseURL: test.info().project.use.baseURL,
    permissions: ["clipboard-read", "clipboard-write"],
    viewport: { width: 1280, height: 800 },
  });
  const host = await hostContext.newPage();
  const friend = await friendContext.newPage();
  try {
    await host.goto("/match");
    await host.getByRole("button", { name: "Find a match" }).click();
    await expect(host.getByText(/Nobody else is waiting/)).toBeVisible();
    await expect(
      host
        .getByRole("region", { name: "Public matchmaking" })
        .getByRole("link", { name: "Practice" }),
    ).toBeVisible();
    await friend.goto("/match");
    await friend.getByRole("button", { name: "Find a match" }).click();
    await expect(
      host.getByRole("button", { name: "Accept opponent" }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await host.getByRole("button", { name: "Accept opponent" }).click();
    await friend.getByRole("button", { name: "Accept opponent" }).click();
    await expect(host).toHaveURL(/\/match\/[A-Za-z0-9_-]{20,}/, {
      timeout: 15_000,
    });
    await expect(friend).toHaveURL(/\/match\/[A-Za-z0-9_-]{20,}/);
    await expect(host.getByRole("radio", { name: /Aegis/ })).toHaveCount(0);
    await expect(
      host.getByRole("radio", { name: "Pip / Scout" }),
    ).toBeVisible();
  } finally {
    const hostVideo = host.video();
    const friendVideo = friend.video();
    await hostContext.close();
    await friendContext.close();
    const hostPath = await hostVideo?.path();
    const friendPath = await friendVideo?.path();
    if (hostPath)
      await copyFile(hostPath, ".cache/pvp-regression/queue-host.webm");
    if (friendPath)
      await copyFile(friendPath, ".cache/pvp-regression/queue-friend.webm");
  }
});
