import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page, type Route } from "@playwright/test";
import { fixtureHolder, fixtureSignIn } from "../../browser-support/holder";
import { choose, evidence, room } from "./support";

test.describe.configure({ mode: "serial" });

const origin = "http://127.0.0.1:3100";

type Fixture = Awaited<ReturnType<typeof fixtureSignIn>>;

async function control(page: Page, operation: Record<string, unknown>) {
  const reply = await page.request.post("https://127.0.0.1:3200/control", {
    data: operation,
  });
  expect(reply.ok()).toBe(true);
  return reply.json();
}

/**
 * The fixture signs in over real endpoints but has no Privy SDK in the page,
 * so page-originated /api/pvp calls get the signed headers attached the same
 * way visualHolder does for battles.
 */
async function attachFixtureHeaders(page: Page, headers: Fixture["headers"]) {
  const attach = async (route: Route) => {
    const request = route.request();
    const response = await route.fetch({
      url: request.url(),
      headers: { ...request.headers(), ...headers },
    });
    await route.fulfill({ response });
  };
  await page.route("**/api/pvp*", attach);
  return attach;
}

async function hostRead(host: Page, signed: Fixture, path: string) {
  const reply = await host.request.get(`/api/pvp${path}`, {
    headers: signed.headers,
  });
  expect(reply.ok()).toBe(true);
  return reply.json();
}

async function createRoom(host: Page) {
  await host.getByRole("button", { name: "Create invitation" }).click();
  await host.waitForURL(/\/challenge\/[A-Za-z0-9_-]{20,}/);
  return new URL(host.url()).pathname.split("/").at(-1)!;
}

async function takeSeat(friend: Page, invite: string) {
  await friend.goto(`${origin}/challenge/${invite}`);
  await friend.getByRole("button", { name: "Take the open seat" }).click();
  await expect(friend.getByText(/Opponent is choosing/)).toBeVisible({
    timeout: 10_000,
  });
}

async function pick(page: Page, name: string) {
  const radio = page.getByRole("radio", { name });
  await radio.click();
  await expect(radio).toBeChecked({ timeout: 10_000 });
}

async function readyUp(page: Page) {
  const ready = page.getByRole("button", { name: "Ready up" });
  await expect(ready).toBeEnabled();
  await ready.click();
}

test("a fixture verification outage fails official play closed, then recovers", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const signed = await fixtureHolder(page.request, 0);
  await attachFixtureHeaders(page, signed.headers);
  await page.goto("/challenge?as=chog");
  const invite = await createRoom(page);
  await pick(page, "Pip / Scout");
  await control(page, { operation: "outage", enabled: true });
  await readyUp(page);
  // The outage message comes from either the RPC reader (holder actions) or
  // the ownership layer (guest-triggered guards); both are explicit and 503.
  const alert = page.getByRole("alert").filter({ hasText: /unavailable/i });
  await expect(alert).toBeVisible({ timeout: 15_000 });
  // During the outage every read of the official room fails closed with the
  // explicit verification-unavailable response instead of recording anything.
  const blockedReply = await page.request.get(`/api/pvp?invite=${invite}`, {
    headers: signed.headers,
  });
  expect(blockedReply.status()).toBe(503);
  const blocked = await blockedReply.json();
  expect(blocked.error).toMatch(/unavailable/i);
  await control(page, { operation: "outage", enabled: false });
  await readyUp(page);
  await expect(
    page.getByRole("button", { name: "Not ready", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  const recovered = await hostRead(page, signed, `?invite=${invite}`);
  expect(recovered.series).toMatchObject({
    phase: "setup",
    outcome: null,
    you: 0,
    opponent: 0,
  });
  const closed = await page.request.post("/api/pvp", {
    headers: { ...signed.headers, Origin: origin },
    data: { operation: "close", invite },
  });
  expect(closed.ok()).toBe(true);
  mkdirSync(evidence, { recursive: true });
  writeFileSync(
    `${evidence}/ownership-outage.json`,
    JSON.stringify(
      {
        source:
          "Isolated fixture wallets and a loopback RPC fixture; the outage is fixture control, not a real provider.",
        invite,
        outageMessage: blocked.error,
        blockedStatus: blockedReply.status(),
        afterRecovery: recovered.series,
      },
      null,
      2,
    ),
  );
  await page.screenshot({ path: `${evidence}/ownership-outage.png` });
});

test("a confirmed fixture transfer voids the live series and locks the old owner out", async ({
  browser,
  request,
}) => {
  test.setTimeout(180_000);
  const hostContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: {
      dir: ".cache/readiness-recordings",
      size: { width: 1280, height: 800 },
    },
  });
  const friendContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const host = await hostContext.newPage();
  const friend = await friendContext.newPage();
  try {
    const signed = await fixtureHolder(host.request, 0);
    const previousHistory = (await hostRead(host, signed, "")).history;
    await attachFixtureHeaders(host, signed.headers);
    await host.goto("/challenge?as=chog");
    const invite = await createRoom(host);
    await takeSeat(friend, invite);
    await pick(host, "Pip / Scout");
    await pick(friend, "Bolt / Courier");
    await readyUp(host);
    await readyUp(friend);
    for (const page of [host, friend])
      await expect(
        page.getByRole("button", { name: /^Basic attack/ }),
      ).toBeEnabled({ timeout: 20_000 });
    // The holder locks a hidden first-round move; the opponent never sees it.
    const locked = await choose(host, "basic");
    expect(locked.you.move).toBe("basic");
    const hidden = await room(friend, invite);
    expect(hidden.opponent?.locked).toBe(true);
    expect(hidden.opponent && "move" in hidden.opponent).toBe(false);

    // Fixture wallet transfer; polls are held so the guest's reply is the
    // request that observes the change and voids the series.
    await control(host, { operation: "transfer", owner: 1 });
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const hostRoute = async (route: Route) => {
      const request = route.request();
      if (request.method() === "GET") await held;
      const response = await route.fetch({
        url: request.url(),
        headers: { ...request.headers(), ...signed.headers },
      });
      await route.fulfill({ response });
    };
    const holdFriendReads = async (route: Route) => {
      if (route.request().method() === "GET") await held;
      await route.continue();
    };
    await host.route("**/api/pvp*", hostRoute);
    await friend.route("**/api/pvp*", holdFriendReads);
    const voided = await choose(friend, "basic");
    expect(voided.battle).toBeNull();
    expect(voided.result).toBeNull();
    expect(voided.history).toEqual([]);
    expect(voided.series?.outcome).toMatchObject({
      kind: "no-contest",
      winner: null,
    });
    expect(voided.series?.outcome?.explanation).toMatch(/no contest/i);
    // The locked move never surfaces in the voided payload.
    expect(JSON.stringify(voided)).not.toContain('"basic"');
    await expect(
      friend.getByRole("heading", { name: "No contest" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(friend.getByText(/series ends as no contest/i)).toBeVisible();
    release();

    // The old owner keeps only session history and fails closed everywhere.
    const session = await hostRead(host, signed, "");
    expect(session).toMatchObject({
      activeInvite: null,
      activePhase: null,
      history: previousHistory,
    });
    const refused = await host.request.post("/api/pvp", {
      headers: { ...signed.headers, Origin: origin },
      data: { operation: "create" },
    });
    expect(refused.status()).toBe(403);
    // A fresh look at the challenge home still signs the old owner in, but
    // every official write is refused.
    await host.goto("/challenge?as=chog");
    await host.getByRole("button", { name: "Create invitation" }).click();
    await expect(
      host.getByRole("alert").filter({ hasText: /revoked/i }),
    ).toBeVisible({ timeout: 15_000 });

    // The new owner inherits published history only and opens a fresh room.
    const outsider = await fixtureSignIn(request, 1);
    const opened = await request.post("/api/pvp", {
      headers: { ...outsider.headers, Origin: origin },
      data: { operation: "create", mode: "official" },
    });
    expect(opened.status()).toBe(200);
    const roomView = await opened.json();
    expect(roomView.invite).not.toBe(invite);
    expect(roomView.series).toMatchObject({ phase: "setup", outcome: null });

    // The guest cannot continue the voided series either.
    const closed = await friend.request.post("/api/pvp", {
      headers: { Origin: origin },
      data: { operation: "close", invite },
    });
    expect(closed.status()).toBe(200);
    mkdirSync(evidence, { recursive: true });
    writeFileSync(
      `${evidence}/ownership-transfer.json`,
      JSON.stringify(
        {
          source:
            "Isolated fixture wallets and a loopback RPC fixture; the transfer is fixture control, not a real token sale. Polls held so the observing request is deterministic.",
          invite,
          voided,
          hiddenSeat: hidden.opponent,
          oldOwnerSession: session,
          oldOwnerCreate: refused.status(),
          newOwnerInvite: roomView.invite,
        },
        null,
        2,
      ),
    );
    await friend.screenshot({
      path: `${evidence}/ownership-transfer-no-contest.png`,
    });
  } finally {
    const video = host.video();
    await hostContext.close();
    await friendContext.close();
    await video?.saveAs(".cache/readiness-recordings/ownership-transfer.webm");
  }
});
