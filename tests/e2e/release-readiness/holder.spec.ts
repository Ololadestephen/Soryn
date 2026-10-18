import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { fixtureHolder } from "../../browser-support/holder";
import type { PvpView } from "../../../src/domain/pvp/view";
import {
  attachSignedHeaders,
  choose,
  continueBattle,
  evidence,
  pair,
  savePair,
} from "./support";

test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 15000 });

async function control(page: Page, operation: Record<string, unknown>) {
  const reply = await page.request.post("https://127.0.0.1:3200/control", {
    data: operation,
  });
  expect(reply.ok()).toBe(true);
  return reply.json();
}

test("a verified holder joins the public queue as their Chog and the record lands on its profile", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(480_000);
  const players = await pair(browser, baseURL!, "holder-entry");
  const { a, b } = players;
  try {
    const signed = await fixtureHolder(a.request, 0);
    const initialPrivate = await (
      await a.request.get("/api/competitor", { headers: signed.headers })
    ).json();
    const priorIds = new Set(
      initialPrivate.entries.map((entry: { id: string }) => entry.id),
    );
    const initialPublic = await (await a.request.get("/api/chog/276")).json();
    // The fixture signs in over real endpoints but has no Privy SDK in the
    // page, so page-originated queue and battle calls get the signed headers.
    await attachSignedHeaders(
      a,
      ["**/api/match*", "**/api/pvp*"],
      signed.headers,
    );
    await a.goto("/match?as=chog");
    await a.getByRole("button", { name: "Find a match", exact: true }).click();
    await expect(a.getByText(/Nobody else is waiting/)).toBeVisible();
    await b.goto("/match");
    await b.getByRole("button", { name: "Find a match", exact: true }).click();
    await expect(
      a.getByRole("button", { name: "Accept opponent" }),
    ).toBeVisible({ timeout: 15_000 });
    await a.getByRole("button", { name: "Accept opponent" }).click();
    await b.getByRole("button", { name: "Accept opponent" }).click();
    await expect(a).toHaveURL(/\/challenge\/[A-Za-z0-9_-]{20,}/);
    await expect(b).toHaveURL(a.url().replace("?as=chog", ""));
    const invite = new URL(a.url()).pathname.split("/").at(-1)!;
    const hostRoom = async () => {
      const reply = await a.request.get(`/api/pvp?invite=${invite}`, {
        headers: signed.headers,
      });
      expect(reply.ok()).toBe(true);
      return (await reply.json()) as PvpView;
    };
    const seated = await hostRoom();
    expect(seated.you.name).toBe("Chog #276");
    expect(seated.roster).toBe("starters");
    expect(seated.opponent?.name ?? "").not.toMatch(/^Chog #/);
    await expect(a.getByText("You are Chog #276")).toBeVisible({
      timeout: 15_000,
    });
    // The guest seat sees the named holder across the table.
    await expect(b.getByText(/Chog #276/)).toBeVisible({ timeout: 15_000 });

    await expect(a.getByRole("radio", { name: /Aegis/ })).toHaveCount(0);
    await a.getByRole("radio", { name: "Pip / Scout" }).click();
    await expect(a.getByRole("radio", { name: "Pip / Scout" })).toBeChecked({
      timeout: 15000,
    });
    await b.getByRole("radio", { name: "Bolt / Courier" }).click();
    await expect(b.getByRole("radio", { name: "Bolt / Courier" })).toBeChecked({
      timeout: 15000,
    });
    await expect(a.getByRole("button", { name: "Ready up" })).toBeEnabled({
      timeout: 15000,
    });
    await a.getByRole("button", { name: "Ready up" }).click();
    await b.getByRole("button", { name: "Ready up" }).click();
    await expect(a.getByRole("button", { name: /^Basic attack/ })).toBeEnabled({
      timeout: 20_000,
    });
    await expect(b.getByRole("button", { name: /^Basic attack/ })).toBeEnabled({
      timeout: 20_000,
    });

    async function playBattle() {
      let view = await hostRoom();
      for (let n = 0; n < 20 && !view.result; n++) {
        await expect(
          a.getByRole("button", { name: /^Basic attack/ }),
        ).toBeEnabled({ timeout: 20_000 });
        const special = a.getByRole("button", { name: /^Special/ });
        await choose(a, (await special.isEnabled()) ? "special" : "basic");
        await expect(
          b.getByRole("button", { name: /^Basic attack/ }),
        ).toBeEnabled({ timeout: 20_000 });
        await choose(b, n === 0 ? "guard" : "basic");
        view = await hostRoom();
      }
      expect(view.result?.headline).toBe("Victory");
      await expect(a.getByRole("heading", { name: "Victory" })).toBeVisible({
        timeout: 20_000,
      });
      await expect(b.getByRole("heading", { name: "Defeat" })).toBeVisible({
        timeout: 20_000,
      });
      return view;
    }

    const first = await playBattle();
    expect(first.series).toMatchObject({
      you: 1,
      opponent: 0,
      phase: "intermission",
    });
    await continueBattle(a, b);
    const final = await playBattle();
    expect(final.series).toMatchObject({
      you: 2,
      opponent: 0,
      phase: "complete",
    });

    // Results are private until explicit publication consent through the real API.
    const privateReply = await a.request.get("/api/competitor", {
      headers: signed.headers,
    });
    expect(privateReply.ok()).toBe(true);
    const privateResults = await privateReply.json();
    const newEntries = privateResults.entries.filter(
      (entry: { id: string }) => !priorIds.has(entry.id),
    );
    expect(newEntries).toHaveLength(3);
    const before = await a.request.get("/api/chog/276");
    expect((await before.json()).records).toEqual(initialPublic.records);
    for (const entry of newEntries) {
      const published = await a.request.post("/api/competitor", {
        headers: { ...signed.headers, Origin: baseURL! },
        data: {
          operation: "publish",
          id: entry.id,
          alias: "Fixture keeper",
          consent: true,
        },
      });
      expect(published.ok()).toBe(true);
    }
    await a.goto("/chog/276");
    await expect(
      a.getByRole("heading", { name: "Chog · token 276" }),
    ).toBeVisible();
    await expect(a.getByText(/Ownership verified at/)).toBeVisible();
    await expect(
      a.getByText(/Series 1 · 1 wins, 0 losses, 0 draws/),
    ).toBeVisible();
    await expect(
      a.getByRole("heading", { name: "Victory · Series", exact: true }),
    ).toBeVisible();
    await expect(
      a.getByRole("heading", { name: "Victory · Battle", exact: true }),
    ).toHaveCount(2);
    await expect(a.getByText(/Series score 2–0/)).toBeVisible();
    await expect(a.getByText(/2 battles recorded/)).toBeVisible();
    await expect(
      a.getByText(/not written to the NFT or the chain/),
    ).toBeVisible();
    mkdirSync(evidence, { recursive: true });
    writeFileSync(
      `${evidence}/holder-entry.json`,
      JSON.stringify(
        {
          source:
            "One fixture-signed holder context and one disposable guest context; real queue, real moves, no state injection",
          invite,
          seat: seated.you,
          opponent: seated.opponent,
          firstSeries: first.series,
          finalSeries: final.series,
        },
        null,
        2,
      ),
    );
    await a.screenshot({ path: `${evidence}/holder-profile.png` });
  } finally {
    await savePair(players);
  }
});

test("the public profile labels ownership unavailable during a fixture outage", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await control(page, { operation: "outage", enabled: true });
  await page.goto("/chog/276");
  await expect(
    page.getByRole("heading", { name: "Chog · token 276" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    /Ownership verification is unavailable right now/,
  );
  await control(page, { operation: "outage", enabled: false });
  await page.reload();
  await expect(page.getByText(/Ownership verified at/)).toBeVisible();
});
