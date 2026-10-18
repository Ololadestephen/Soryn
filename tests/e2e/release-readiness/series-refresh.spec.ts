import { expect, test, type Page } from "@playwright/test";
import { choose, room } from "./support";
import type { Move } from "../../../src/domain/combat/contracts";

test("stalled artwork after an intermission refresh still opens the next battle", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const left = await browser.newContext();
  const right = await browser.newContext();
  const a = await left.newPage();
  const b = await right.newPage();
  let stalled = 0;
  const failArtwork = async (page: Page) => {
    const client = await page.context().newCDPSession(page);
    await client.send("Network.enable");
    await client.send("Network.setCacheDisabled", { cacheDisabled: true });
    await page.route("**/combat/**", (route) => {
      stalled += 1;
      return route.abort("failed");
    });
  };
  try {
    await a.goto("/challenge");
    await a.getByRole("button", { name: "Create invitation" }).click();
    await expect(a).toHaveURL(/\/challenge\/[A-Za-z0-9_-]{20,}/);
    const invite = new URL(a.url()).pathname.split("/").at(-1)!;
    await b.goto(a.url());
    await b.getByRole("button", { name: "Take the open seat" }).click();
    await a.getByRole("radio", { name: "Pip / Scout" }).click();
    await b.getByRole("radio", { name: "Bolt / Courier" }).click();
    await a.getByRole("button", { name: "Ready up" }).click();
    await b.getByRole("button", { name: "Ready up" }).click();
    for (
      let round = 0;
      round < 20 && (await room(a, invite)).series?.phase !== "intermission";
      round += 1
    ) {
      const special = a.getByRole("button", { name: /^Special/ });
      const move: Move = (await special.isEnabled()) ? "special" : "basic";
      await choose(a, move);
      await choose(b, "basic");
    }
    expect((await room(a, invite)).series?.phase).toBe("intermission");
    await failArtwork(a);
    await failArtwork(b);
    await a.reload({ waitUntil: "domcontentloaded" });
    await b.reload({ waitUntil: "domcontentloaded" });
    await expect(
      a.getByRole("button", { name: "Continue", exact: true }),
    ).toBeVisible();
    await expect(
      b.getByRole("button", { name: "Continue", exact: true }),
    ).toBeVisible();
    expect(stalled).toBeGreaterThan(0);
    const started = Date.now();
    await a.getByRole("button", { name: "Continue", exact: true }).click();
    await b.getByRole("button", { name: "Continue", exact: true }).click();
    // The loading fallback is 4s in this harness. Opening before that means
    // both clients acknowledged the new battle instead of waiting it out.
    for (const page of [a, b])
      await expect(
        page.getByRole("button", { name: /^Basic attack/ }),
      ).toBeEnabled({ timeout: 3900 });
    expect(Date.now() - started).toBeLessThan(3900);
    expect((await room(a, invite)).phase).toBe("choose");
    expect((await room(b, invite)).battle?.id).toBe(
      (await room(a, invite)).battle?.id,
    );
  } finally {
    await left.close();
    await right.close();
  }
});
