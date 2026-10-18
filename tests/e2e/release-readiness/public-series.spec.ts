import {
  fixtureReset,
  fixtureWalletAccess,
} from "../../browser-support/holder";
import { attachSignedHeaders } from "./support";
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  pair,
  publicPair,
  publicBattle,
  room,
  continueBattle,
  savePair,
  evidence,
} from "./support";
for (const deciding of [false, true])
  test(`complete public ${deciding ? "2–1" : "2–0"} series from queue to result`, async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(480000);
    const players = await pair(
      browser,
      baseURL!,
      deciding ? "public-2-1" : "public-2-0",
    );
    const { a, b } = players;
    const proofs = new Map<Page, Record<string, string>>();
    try {
      await fixtureReset(a.request);
      for (const [page, index] of [
        [a, 0],
        [b, 1],
      ] as const) {
        const session = await fixtureWalletAccess(
          page.request,
          index + (deciding ? 4 : 2),
          baseURL!,
        );
        proofs.set(page, session.headers);
        await attachSignedHeaders(page, [`${baseURL}/api/**`], session.headers);
      }
      const invite = await publicPair(a, b);
      const first = await publicBattle(a, b, invite, "a", true);
      expect(first.series).toMatchObject({
        you: 1,
        opponent: 0,
        phase: "intermission",
      });
      const deadline = first.series?.deadlineAt;
      const completedBattle = first.battle!.id;
      await a.reload({ waitUntil: "domcontentloaded" });
      await b.reload({ waitUntil: "domcontentloaded" });
      const resumed = await room(a, invite);
      expect(resumed.seated).toBe(true);
      expect(resumed.battle?.id).toBe(completedBattle);
      expect(resumed.series?.deadlineAt).toBe(deadline);
      expect((await room(b, invite)).series).toMatchObject({
        you: 0,
        opponent: 1,
      });
      await expect(
        a.getByRole("button", { name: "Continue", exact: true }),
      ).toBeVisible({ timeout: 15000 });
      await continueBattle(a, b);
      const nextBattle = await room(a, invite);
      expect(nextBattle.battle?.id).not.toBe(completedBattle);
      expect(nextBattle.battle?.state.round).toBe(1);
      expect(nextBattle.you.move).toBeNull();
      expect(nextBattle.series).toMatchObject({
        you: 1,
        opponent: 0,
        battle: 2,
        phase: "battle",
      });
      expect((await room(b, invite)).battle?.id).toBe(nextBattle.battle?.id);
      let final = await publicBattle(a, b, invite, deciding ? "b" : "a");
      if (deciding) {
        expect(final.series).toMatchObject({ you: 1, opponent: 1 });
        await continueBattle(a, b);
        final = await publicBattle(a, b, invite, "a");
      }
      expect(final.series).toMatchObject({
        you: 2,
        opponent: deciding ? 1 : 0,
        phase: "complete",
        battle: deciding ? 3 : 2,
      });
      const matchId = final.battle!.id;
      const repeated = await room(a, invite);
      expect(repeated.battle!.id).toBe(matchId);
      expect(repeated.series).toEqual(final.series);
      const other = await room(b, invite);
      expect(other.series).toMatchObject({
        you: deciding ? 1 : 0,
        opponent: 2,
        phase: "complete",
      });
      await expect(
        a.getByRole("button", { name: "Continue", exact: true }),
      ).toHaveCount(0);
      mkdirSync(evidence, { recursive: true });
      writeFileSync(
        `${evidence}/public-${deciding ? "2-1" : "2-0"}.json`,
        JSON.stringify(
          {
            source:
              "Two disposable browser contexts; real public queue and moves; no state injection",
            a: final,
            b: other,
          },
          null,
          2,
        ),
      );
      await a.screenshot({
        path: `${evidence}/public-${deciding ? "2-1" : "2-0"}-result.png`,
      });
      await a.reload({ waitUntil: "domcontentloaded" });
      await b.reload({ waitUntil: "domcontentloaded" });
      expect((await room(a, invite)).series).toEqual(final.series);
      for (const page of [a, b]) {
        await expect(
          page.getByRole("link", { name: "Find another match", exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", {
            name: /Copy invitation|Close invitation|Request rematch/,
          }),
        ).toHaveCount(0);
        await page
          .getByRole("link", { name: "Find another match", exact: true })
          .click();
        await expect(page).toHaveURL(/\/match(?:\?as=holder)?$/);
      }
      const nextInvite = await publicPair(a, b);
      expect(nextInvite).not.toBe(invite);
      expect((await room(a, invite)).series).toEqual(final.series);
      for (const page of [a, b]) {
        await expect(
          page.getByRole("button", {
            name: /Copy invitation|Close invitation/,
          }),
        ).toHaveCount(0);
        await expect(
          page.getByText(/Room code:|Waiting for your friend|Private battle/),
        ).toHaveCount(0);
      }
    } finally {
      if (test.info().status !== test.info().expectedStatus) {
        mkdirSync(evidence, { recursive: true });
        for (const [label, page] of [
          ["a", a],
          ["b", b],
        ] as const) {
          await page
            .screenshot({
              path: `${evidence}/public-${deciding ? "2-1" : "2-0"}-failure-${label}.png`,
            })
            .catch(() => {});
          writeFileSync(
            `${evidence}/public-${deciding ? "2-1" : "2-0"}-failure-${label}.txt`,
            await page
              .locator("main")
              .innerText()
              .catch(() => "Page unavailable"),
          );
        }
      }
      // Wallet principals persist between cases; retire only their fixture selection rooms.
      for (const page of [a, b]) {
        const headers = proofs.get(page);
        if (headers) {
          const state = await page.request.get("/api/pvp?mode=guest", {
            headers,
          });
          if (state.ok()) {
            const session = await state.json();
            if (session.activeInvite)
              await page.request.post("/api/pvp", {
                headers,
                data: {
                  operation: "leave",
                  mode: "guest",
                  invite: session.activeInvite,
                },
              });
          }
        }
        await page.unrouteAll({ behavior: "ignoreErrors" });
      }
      await savePair(players);
    }
  });
