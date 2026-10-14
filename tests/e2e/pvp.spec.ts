import { copyFile } from "node:fs/promises";
import { expect, test, type Browser, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function contexts(browser: Browser, record: boolean) {
  const video = record
    ? {
        recordVideo: {
          dir: "docs/evidence/pvp",
          size: { width: 1280, height: 800 },
        },
      }
    : {};
  const hostContext = await browser.newContext({
    ...video,
    viewport: { width: 1280, height: 800 },
  });
  const friendContext = await browser.newContext({
    ...video,
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
  await expect(host.getByText(/Room code:/)).toBeVisible();
  await expect(host.getByRole("textbox", { name: "Invitation" })).toHaveValue(
    url,
  );
  await friend.goto(url);
  await friend.getByRole("button", { name: "Take the open seat" }).click();
  await expect(host.getByText(/Connected/)).toBeVisible({ timeout: 10_000 });
  await expect(friend.getByText(/Connected/)).toBeVisible();
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

async function caughtUp(page: Page) {
  await expect(
    page.getByText("Choose your move").or(outcome(page)),
  ).toBeVisible({
    timeout: 20_000,
  });
}

test("two friends play one match and both accept a rematch", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const { hostContext, friendContext, host, friend } = await contexts(
    browser,
    true,
  );
  try {
    await invite(host, friend);
    await host.getByRole("button", { name: "Copy invitation" }).click();
    await ready(host, friend);
    let usedSpecial = false;
    let usedDefence = false;
    for (let round = 0; round < 16; round += 1) {
      if (await outcome(host).isVisible()) break;
      if (!usedSpecial) {
        const locked = await submit(host, /Special/);
        expect(locked.you.move).toBe("special");
        expect(locked.battle?.rounds ?? []).toEqual([]);
        await expect(host.getByText("Move locked")).toBeVisible();
        let hidden = "";
        for (let attempt = 0; attempt < 4; attempt += 1) {
          hidden = await (
            await friend.waitForResponse(
              (response) =>
                response.url().includes("/api/pvp") &&
                response.request().method() === "GET",
              { timeout: 8_000 },
            )
          ).text();
          expect(hidden).not.toMatch(/"move"\s*:\s*"special"/);
          if (hidden.includes('"locked":true')) break;
        }
        expect(hidden).toContain('"locked":true');
        usedSpecial = true;
      } else {
        const locked = await submit(host, /Basic attack/);
        expect(locked.you.move).toBe("basic");
      }
      if (await outcome(host).isVisible()) break;
      const answered = await submit(friend, usedDefence ? /Basic attack/ : /Defence/);
      if (!usedDefence) {
        expect(answered.battle?.rounds[0]).toMatchObject({
          player: "guard",
          opponent: "special",
        });
        usedDefence = true;
      }
      await caughtUp(host);
      await caughtUp(friend);
    }
    await expect(outcome(host)).toBeVisible();
    await expect(outcome(friend)).toBeVisible();
    const hostHeadline = (await outcome(host).innerText()).trim();
    const friendHeadline = (await outcome(friend).innerText()).trim();
    if (hostHeadline === "Victory" || hostHeadline === "Defeat")
      expect(friendHeadline).not.toBe(hostHeadline);
    const explanation = host.getByText(
      /knocked out|round limit ended in a draw/,
    );
    await expect(explanation).toBeVisible();
    await expect(friend.getByText(await explanation.innerText())).toBeVisible();
    await host.waitForTimeout(800);
    await host.getByRole("button", { name: "Request rematch" }).click();
    await expect(
      host.getByText("Waiting for your friend to accept the rematch."),
    ).toBeVisible();
    await friend.getByRole("button", { name: "Request rematch" }).click();
    await expect(host.getByRole("button", { name: "Ready up" })).toBeVisible({
      timeout: 10_000,
    });
    await host.getByRole("button", { name: "Ready up" }).click();
    await friend.getByRole("button", { name: "Ready up" }).click();
    await expect(host.getByText("Choose your move")).toBeVisible({
      timeout: 20_000,
    });
    await expect(friend.getByText("Choose your move")).toBeVisible();
  } finally {
    const hostVideo = host.video();
    const friendVideo = friend.video();
    await hostContext.close();
    await friendContext.close();
    const hostPath = await hostVideo?.path();
    const friendPath = await friendVideo?.path();
    if (hostPath) await copyFile(hostPath, "docs/evidence/pvp/host-match.webm");
    if (friendPath)
      await copyFile(friendPath, "docs/evidence/pvp/friend-match.webm");
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
  try {
    const url = await invite(host, friend);
    await ready(host, friend);
    await extra.goto(url);
    await expect(extra.getByText("Choose your move")).toBeVisible({
      timeout: 15_000,
    });
    await extra.route("**/api/pvp**", async (route) => {
      if (route.request().method() === "GET")
        await new Promise((resolve) => setTimeout(resolve, 8_000));
      await route.continue();
    });
    const locked = await submit(host, /Basic attack/);
    expect(locked.you.move).toBe("basic");
    const before = friend.waitForResponse(
      (response) =>
        response.url().includes("/api/pvp") &&
        response.request().method() === "GET",
    );
    await friend.reload();
    const hidden = await (await before).text();
    expect(hidden).not.toMatch(/"move"\s*:\s*"basic"/);
    expect(hidden).toContain('"locked":true');
    await host.reload();
    await expect(host.getByText("Move locked")).toBeVisible({
      timeout: 15_000,
    });
    await extra.getByRole("button", { name: /Special/ }).click();
    await expect(extra.getByText("Move already locked.")).toBeVisible();
    const answered = await submit(friend, /Defence/);
    expect(answered.battle?.rounds).toHaveLength(1);
    expect(answered.battle?.rounds[0]).toMatchObject({
      player: "guard",
      opponent: "basic",
    });
  } finally {
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
    await pick(host, "Moss / Caretaker");
    await expect(host.getByRole("button", { name: "Not ready" })).toHaveCount(
      0,
    );
    await host.getByRole("button", { name: "Leave room" }).click();
    await host.waitForURL(/\/challenge$/);
    await expect(
      friend.getByRole("heading", { name: "Waiting for your friend" }),
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
