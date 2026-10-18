import { CHOG_MINIMUM } from "../../src/domain/access/policy";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  fixtureReset,
  fixtureSignIn,
  fixtureWalletAccess,
} from "../browser-support/holder";
import { attachSignedHeaders } from "./release-readiness/support";
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
test("guest Practice resumes while new Story and multiplayer admissions remain locked", async ({
  page,
  baseURL,
}) => {
  await page.goto("/arena");
  await expect(
    page.getByRole("button", { name: "Enter guest arena" }),
  ).toBeVisible();
  for (const [path, data] of [
    ["/api/story", { operation: "choose", fighter: "pip" }],
    ["/api/pvp", { operation: "create" }],
    ["/api/match", { operation: "join" }],
  ] as const) {
    const response = await page.request.post(path, {
      headers: { Origin: baseURL! },
      data: { ...data, mode: "guest" },
    });
    expect(response.status()).toBe(403);
  }
  const blocked = await page.request.post("/api/battle", {
    headers: { Origin: baseURL! },
    data: {
      operation: "start",
      mode: "guest",
      id: randomUUID(),
      characterId: "aegis",
      opponent: "bolt",
    },
  });
  expect(blocked.status()).toBe(403);
  await page.getByRole("button", { name: "Enter guest arena" }).click();
  await expect(page.getByRole("button", { name: /^Basic attack/ })).toBeEnabled(
    { timeout: 20000 },
  );
  const before = await (await page.request.get("/api/battle")).json();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /^Basic attack/ }),
  ).toBeVisible();
  const after = await (await page.request.get("/api/battle")).json();
  expect(after.battle.id).toBe(before.battle.id);
});
test("below threshold and unavailable RPC remain distinct; authenticated records need no holdings lookup", async ({
  page,
  baseURL,
}) => {
  await fixtureReset(page.request);
  const session = await fixtureWalletAccess(page.request, 0, baseURL!);
  const control = (data: unknown) =>
    page.request.post("https://127.0.0.1:3200/control", { data });
  await control({ operation: "transfer", owner: 1 });
  await control({
    operation: "balance",
    index: 0,
    units: (CHOG_MINIMUM - 1n).toString(),
  });
  const access = await page.request.post("/api/access", {
    headers: session.headers,
    data: { operation: "refresh" },
  });
  expect((await access.json()).status).toBe("practice-only");
  await control({ operation: "outage", enabled: true });
  const unavailable = await page.request.post("/api/access", {
    headers: session.headers,
    data: { operation: "refresh" },
  });
  expect((await unavailable.json()).status).toBe("unavailable");
  const records = await page.request.get("/api/access?records=1", {
    headers: session.headers,
  });
  expect((await records.json()).authenticated).toBe(true);
  expect(
    (
      await page.request.get("/api/pvp?mode=guest&history=1", {
        headers: session.headers,
      })
    ).ok(),
  ).toBe(true);
  await control({ operation: "outage", enabled: false });
});
test("NFT transfer invalidates a started official encounter without converting it to token play", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(60000);
  await fixtureReset(page.request);
  const nft = await fixtureSignIn(page.request);
  await attachSignedHeaders(page, [`${baseURL}/api/**`], nft.headers);
  const friend = await browser.newContext({ baseURL });
  try {
    const token = await fixtureWalletAccess(friend.request, 1, baseURL!);
    const post = (
      headers: Record<string, string>,
      data: Record<string, unknown>,
      request = page.request,
    ) => request.post("/api/pvp", { headers, data });
    const created = await post(nft.headers, {
      operation: "create",
      mode: "official",
    });
    expect(created.ok(), await created.text()).toBe(true);
    const { invite } = await created.json();
    expect(
      (
        await post(
          token.headers,
          { operation: "join", mode: "guest", invite },
          friend.request,
        )
      ).ok(),
    ).toBe(true);
    expect(
      (
        await post(nft.headers, {
          operation: "select",
          mode: "official",
          invite,
          characterId: "pip",
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await post(
          token.headers,
          { operation: "select", mode: "guest", invite, characterId: "bolt" },
          friend.request,
        )
      ).ok(),
    ).toBe(true);
    expect(
      (
        await post(nft.headers, {
          operation: "ready",
          mode: "official",
          invite,
          ready: true,
        })
      ).ok(),
    ).toBe(true);
    const started = await post(
      token.headers,
      { operation: "ready", mode: "guest", invite, ready: true },
      friend.request,
    );
    expect(started.ok(), await started.text()).toBe(true);
    await page.request.post("https://127.0.0.1:3200/control", {
      data: { operation: "transfer", owner: 1 },
    });
    const ended = await page.request.get(
      `/api/pvp?invite=${invite}&mode=official`,
      { headers: nft.headers },
    );
    expect(ended.ok(), await ended.text()).toBe(true);
    const result = await ended.json();
    expect(result.series.outcome.kind).toBe("no-contest");
    expect(result.you.mode).toBe("official");
  } finally {
    await friend.close();
  }
});
