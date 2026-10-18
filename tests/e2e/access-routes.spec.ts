import { expect, test } from "@playwright/test";
import { fixtureReset, fixtureWalletAccess } from "../browser-support/holder";
import { attachSignedHeaders } from "./release-readiness/support";

for (const route of ["nft", "token"] as const) {
  test(`labelled ${route}-only wallet enters Story, private and public modes while the other route is unavailable`, async ({
    page,
    baseURL,
  }) => {
    await fixtureReset(page.request);
    const control = (data: unknown) =>
      page.request.post("https://127.0.0.1:3200/control", { data });
    try {
      if (route === "nft")
        await control({ operation: "balance", index: 0, units: "0" });
      await control({
        operation: "route-outage",
        route: route === "nft" ? "token" : "nft",
        enabled: true,
      });
      const session = await fixtureWalletAccess(
        page.request,
        route === "nft" ? 0 : 1,
        baseURL!,
      );
      await attachSignedHeaders(page, [`${baseURL}/api/**`], session.headers);
      const view = await (
        await page.request.get("/api/access", { headers: session.headers })
      ).json();
      expect(view.status).toBe(route);
      expect(view.fighters).toHaveLength(route === "nft" ? 12 : 6);
      await page.goto("/story");
      await expect(
        page.getByRole("button", { name: /Enter Sanctuary as Pip/ }),
      ).toBeVisible();
      const room = await page.request.post("/api/pvp", {
        headers: session.headers,
        data: { operation: "create", mode: "guest" },
      });
      expect(room.ok(), await room.text()).toBe(true);
      const { invite } = await room.json();
      await page.goto(`/challenge/${invite}`);
      await expect(
        page.getByRole("radio", { name: "Aegis / Guardian" }),
      ).toBeEnabled();
      if (route === "nft")
        await expect(
          page.getByRole("radio", { name: "Ember / Daredevil" }),
        ).toBeEnabled();
      expect(
        (
          await page.request.post("/api/pvp", {
            headers: session.headers,
            data: { operation: "close", mode: "guest", invite },
          })
        ).ok(),
      ).toBe(true);
      expect(
        (
          await page.request.post("/api/match", {
            headers: session.headers,
            data: { operation: "join", mode: "guest" },
          })
        ).ok(),
      ).toBe(true);
      expect(
        (
          await page.request.post("/api/match", {
            headers: session.headers,
            data: { operation: "cancel", mode: "guest" },
          })
        ).ok(),
      ).toBe(true);
    } finally {
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await control({
        operation: "route-outage",
        route: "token",
        enabled: false,
      });
      await control({
        operation: "route-outage",
        route: "nft",
        enabled: false,
      });
    }
  });
}

test("NFT-only and token-only identities share one six-fighter queue and release matched associations on close", async ({
  page,
  browser,
  baseURL,
}) => {
  await fixtureReset(page.request);
  await page.request.post("https://127.0.0.1:3200/control", {
    data: { operation: "balance", index: 0, units: "0" },
  });
  const nft = await fixtureWalletAccess(page.request, 0, baseURL!),
    context = await browser.newContext({ baseURL });
  try {
    const token = await fixtureWalletAccess(context.request, 1, baseURL!);
    const post = (who: typeof nft, operation: string, request = page.request) =>
      request.post("/api/match", {
        headers: who.headers,
        data: { operation, mode: "guest" },
      });
    expect((await post(nft, "join")).ok()).toBe(true);
    expect((await post(token, "join", context.request)).ok()).toBe(true);
    expect((await post(nft, "accept")).ok()).toBe(true);
    const sealed = await post(token, "accept", context.request);
    expect(sealed.ok(), await sealed.text()).toBe(true);
    const state = await sealed.json();
    expect(state.status).toBe("matched");
    const invite = state.invite;
    expect(typeof invite).toBe("string");
    for (const [who, request] of [
      [nft, page.request],
      [token, context.request],
    ] as const) {
      const room = await (
        await request.get(`/api/pvp?invite=${invite}&mode=guest`, {
          headers: who.headers,
        })
      ).json();
      expect(room.roster).toBe("public-six");
      const select = await request.post("/api/pvp", {
        headers: who.headers,
        data: {
          operation: "select",
          mode: "guest",
          invite,
          characterId: "ember",
        },
      });
      expect(select.status()).toBe(403);
    }
    expect(
      (
        await page.request.post("/api/pvp", {
          headers: nft.headers,
          data: { operation: "close", mode: "guest", invite },
        })
      ).ok(),
    ).toBe(true);
    for (const [who, request] of [
      [nft, page.request],
      [token, context.request],
    ] as const) {
      const queue = await (
        await request.get("/api/match?mode=guest", { headers: who.headers })
      ).json();
      expect(queue.status).not.toBe("matched");
      expect(queue.invite ?? null).toBeNull();
    }
  } finally {
    await context.close();
  }
});
