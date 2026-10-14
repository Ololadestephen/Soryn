import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixtureHolder } from "../browser-support/holder";

test("Pip and Patch have real scene actions, persistent charges and selectable original silhouettes", async ({
  page,
}) => {
  await page.goto("/play");
  await page.getByRole("button", { name: "Start guest adventure" }).click();
  await page.getByRole("button", { name: "Use Peek", exact: true }).click();
  await expect(page.locator(".ability-status")).toContainText(
    "0 / 1 charges left",
  );
  await expect(page.locator(".stats")).toContainText("10");
  await page.reload();
  await expect(page.locator(".ability-status")).toContainText(
    "0 / 1 charges left",
  );
  await page
    .getByRole("button", { name: "Test painted door", exact: true })
    .click();
  await page
    .getByText("Change character · Pip / Scout", { exact: true })
    .click();
  await expect(page.locator(".character-card")).toHaveCount(12);
  await expect(page.locator(".locked-label")).toHaveCount(8);
  await page.screenshot({
    path: "test-results/character-roster.png",
    fullPage: true,
  });
  const rosterAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(rosterAudit.violations).toEqual([]);
  await page
    .getByRole("radio", { name: "Patch / Tinkerer", exact: true })
    .check();
  await page.getByRole("button", { name: "Start a new adventure" }).click();
  await page
    .getByRole("button", { name: "Enter archway", exact: true })
    .click();
  await page.getByRole("button", { name: "Deploy paperwork decoy" }).click();
  await page
    .getByRole("button", { name: "Use Spare Parts", exact: true })
    .click();
  await expect(page.locator(".stats")).toContainText("1");
  await page.getByRole("button", { name: "Sneak past the guard" }).click();
  await page
    .getByRole("button", { name: "Replace it with your decoy" })
    .click();
  await page.getByRole("button", { name: "Take the emergency exit" }).click();
  await expect(
    page.getByRole("heading", { name: "Lunch. Against all odds." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Race my new ghost" }).click();
  await expect(page.locator(".race-opponent")).toContainText(
    "Your previous ghost",
  );
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
});

test("synthetic verified holder abilities and challenge-only borrowing obey real server boundaries", async ({
  page,
}) => {
  await page.goto("/play");
  const actor = page.request;
  const official = await fixtureHolder(actor);
  const id = randomUUID();
  expect(
    (
      await official({
        operation: "start",
        id,
        retryOf: null,
        characterId: "aegis",
      })
    ).ok(),
  ).toBe(true);
  for (const [step, action] of ["skill-bubble", "door", "leave"].entries())
    expect((await official({ operation: "step", id, step, action })).ok()).toBe(
      true,
    );
  const publication = await official({
    operation: "publish",
    id,
    title: "Fixture shielded bonk",
    alias: "Synthetic holder fixture",
    consent: true,
    museum: true,
  });
  expect(publication.ok()).toBe(true);
  const data = await publication.json();
  const challenge = data.run.publication.id;
  await page.goto(`/play?challenge=${challenge}`);
  await expect(page.locator(".ability-status")).toContainText(
    "Aegis / Guardian",
  );
  await expect(page.locator(".stage-top")).toContainText("Guest practice");
  await page
    .getByRole("button", { name: "Use Safety Bubble", exact: true })
    .click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator(".stage-top")).toBeInViewport();
  await page.screenshot({
    path: "test-results/borrowed-aegis.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Rush the heroic door" }).click();
  await expect(page.locator(".stage-caption")).toContainText(
    "Safety Bubble absorbed",
  );
  await expect(page.locator(".ability-status")).toContainText(
    "1 / 2 charges left",
  );
  const forged = await actor.post("/api/game", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: {
      operation: "start",
      id: randomUUID(),
      mode: "guest",
      exhibitId: null,
      retryOf: null,
      characterId: "aegis",
    },
  });
  expect(forged.status()).toBe(403);
  await page
    .getByRole("button", { name: "Abandon the sandwich mission" })
    .click();
  const run = (await (await actor.get("/api/game")).json()).run;
  await expect(
    page.getByRole("region", { name: "Frozen ghost race" }),
  ).toBeVisible();
  await page.goto("/journal");
  await page.getByRole("button", { name: "Open chapter" }).click();
  await expect(
    page.getByRole("heading", { name: "Saved chapter replay" }),
  ).toBeVisible();
  expect((await official({ operation: "withdraw", id })).ok()).toBe(true);
  const rerace = await actor.post("/api/game", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: { operation: "race", id: randomUUID(), chapterId: run.id },
  });
  expect(rerace.status()).toBe(403);
  const nextId = randomUUID();
  expect(
    (
      await official({
        operation: "start",
        id: nextId,
        retryOf: null,
        characterId: "echo",
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await official({ operation: "step", id: nextId, step: 0, action: "arch" })
    ).ok(),
  ).toBe(true);
  const trail = await official({
    operation: "step",
    id: nextId,
    step: 1,
    action: "skill-trail",
  });
  expect(trail.ok()).toBe(true);
  expect((await trail.json()).run.observation.distracted).toBe(true);
  await actor.post("https://127.0.0.1:3200/control", {
    data: { operation: "awayBack" },
  });
  expect(
    (
      await official({
        operation: "step",
        id: nextId,
        step: 2,
        action: "sneak",
      })
    ).status(),
  ).toBe(403);
});

const remainingBrowserCases = [
  {
    id: "bolt",
    name: "Bolt",
    actions: ["arch", "inspect", "skill-shortcut", "gadget", "exit"],
  },
  {
    id: "moss",
    name: "Moss",
    actions: [
      "arch",
      "sneak",
      "skill-calm",
      "sneak",
      "inspect",
      "swap",
      "exit",
    ],
  },
  {
    id: "nyx",
    name: "Nyx",
    actions: ["arch", "skill-shadow", "gadget", "exit"],
  },
  {
    id: "prism",
    name: "Prism",
    actions: ["arch", "skill-lens", "vent", "skill-lens", "swap", "exit"],
  },
  {
    id: "atlas",
    name: "Atlas",
    actions: ["arch", "gadget", "sneak", "skill-steady", "take", "exit"],
  },
  {
    id: "flux",
    name: "Flux",
    actions: [
      "arch",
      "inspect-mechanism",
      "wait",
      "skill-reroute",
      "sneak",
      "inspect-mechanism",
      "skill-reroute",
      "take",
      "exit",
    ],
  },
  {
    id: "ember",
    name: "Ember",
    actions: [
      "arch",
      "inspect-mechanism",
      "skill-breakthrough",
      "gadget",
      "exit",
    ],
  },
  {
    id: "mneme",
    name: "Mneme",
    actions: [
      "arch",
      "inspect",
      "vent",
      "commit-take",
      "skill-second-thought",
      "inspect",
      "swap",
      "exit",
    ],
  },
] as const;
for (const entry of remainingBrowserCases)
  test(`${entry.name}'s complete loadout works through a synthetic-holder publication and real guest challenge`, async ({
    page,
  }) => {
    const official = await fixtureHolder(page.request);
    const id = randomUUID();
    expect(
      (
        await official({
          operation: "start",
          id,
          retryOf: null,
          characterId: entry.id,
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await official({ operation: "step", id, step: 0, action: "leave" })
      ).ok(),
    ).toBe(true);
    const published = await official({
      operation: "publish",
      id,
      title: `${entry.name} fixture challenge`,
      alias: "Synthetic holder fixture",
      consent: true,
      museum: true,
    });
    expect(published.ok()).toBe(true);
    const data = await published.json();
    const challenge = data.run.publication.id;
    await page.goto(`/play?challenge=${challenge}`);
    await expect(page.locator(".ability-status")).toContainText(
      `${entry.name} /`,
    );
    // Read only the permitted current observation, then activate its real authored control.
    for (const action of entry.actions) {
      const response = await page.request.get("/api/game");
      const current = (await response.json()).run;
      if (
        entry.id === "moss" &&
        action === "sneak" &&
        current.observation.room === 1 &&
        current.observation.alarm === 0 &&
        current.observation.patrol === "reading"
      ) {
        const waiting = page.waitForResponse(
          (reply) =>
            reply.url().endsWith("/api/game") &&
            reply.request().method() === "POST",
        );
        await page
          .getByRole("button", {
            name: "Wait for the next patrol phase",
            exact: true,
          })
          .click();
        expect((await waiting).ok()).toBe(true);
      }
      const choice = current.observation.choices.find(
        (candidate: { action: string; label: string }) =>
          candidate.action === action,
      );
      expect(choice, `Legal ${entry.name} action ${action}`).toBeTruthy();
      const acted = page.waitForResponse(
        (reply) =>
          reply.url().endsWith("/api/game") &&
          reply.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: choice.label, exact: true })
        .click();
      expect((await acted).ok()).toBe(true);
      if (action === "commit-take") {
        await page.reload();
        await expect(page.locator(".ability-status")).toContainText(
          "Committed take; outcome unresolved",
        );
        const retained = (await (await page.request.get("/api/game")).json())
          .run;
        expect(retained.observation.sandwich).toBe(false);
        expect(retained.observation.tactics.pending).toBe("take");
      }
    }
    await expect(
      page.getByRole("heading", { name: "Lunch. Against all odds." }),
    ).toBeVisible();
    const completed = (await (await page.request.get("/api/game")).json()).run;
    expect(completed.observation.tactics.charges).toBeLessThan(
      completed.observation.tactics.loadout.charges,
    );
    const race = page.getByRole("region", { name: "Frozen ghost race" });
    await expect(race).toBeVisible();
    await race.getByRole("button", { name: "Show finish" }).click();
    await page.goto("/journal");
    await page.getByRole("button", { name: "Open chapter" }).click();
    await expect(
      page.getByRole("heading", { name: "Saved chapter replay" }),
    ).toBeVisible();
  });

test("synthetic owner/RPC failures grant no holder power and leave starter play available", async ({
  page,
}) => {
  const nonowner = await fixtureHolder(page.request, 1);
  expect(
    (
      await nonowner({
        operation: "start",
        id: randomUUID(),
        retryOf: null,
        characterId: "nyx",
      })
    ).status(),
  ).toBe(403);
  const owner = await fixtureHolder(page.request, 0);
  await page.request.post("https://127.0.0.1:3200/control", {
    data: { operation: "outage", enabled: true },
  });
  expect(
    (
      await owner({
        operation: "start",
        id: randomUUID(),
        retryOf: null,
        characterId: "nyx",
      })
    ).status(),
  ).toBe(503);
  await page.goto("/play");
  await page.getByRole("button", { name: "Start guest adventure" }).click();
  await page.getByRole("button", { name: "Use Peek", exact: true }).click();
  await expect(page.locator(".ability-status")).toContainText(
    "0 / 1 charges left",
  );
  await page.request.post("https://127.0.0.1:3200/control", {
    data: { operation: "outage", enabled: false },
  });
});
