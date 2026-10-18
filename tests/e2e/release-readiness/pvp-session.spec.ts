import { expect, test } from "@playwright/test";

test("first invitation waits for one guest initialization and keeps its creator after refresh", async ({
  page,
  context,
}) => {
  let release!: () => void;
  let captured!: () => void;
  const pending = new Promise<void>((resolve) => (release = resolve));
  const started = new Promise<void>((resolve) => (captured = resolve));
  let reads = 0;
  let writes = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/pvp") {
      if (request.method() === "GET") reads++;
      else writes++;
    }
  });
  await page.route("**/api/pvp?mode=guest", async (route) => {
    captured();
    await pending;
    await route.continue();
  });
  try {
    await page.goto("/challenge");
    await started;
    const create = page.getByRole("button", { name: "Create invitation" });
    await expect(create).toBeDisabled();
    // A slow initial read must not spawn another cookieless poll.
    await page.waitForTimeout(4200);
    expect(reads).toBe(1);
    expect(writes).toBe(0);
    release();
    await expect(create).toBeEnabled({ timeout: 10000 });
    const guest = (await context.cookies()).find(
      (c) => c.name === "chog_guest",
    );
    expect(guest).toBeDefined();
    await create.click();
    await expect(page).toHaveURL(/\/challenge\/[A-Za-z0-9_-]{20,}/);
    const invite = new URL(page.url()).pathname.split("/").at(-1);
    const readRoom = async () => {
      const reply = await page.request.get(`/api/pvp?invite=${invite}`);
      expect(reply.ok()).toBe(true);
      return (await reply.json()) as {
        seated: boolean;
        you: { name: string };
      };
    };
    const created = await readRoom();
    expect(created.seated).toBe(true);
    await page.reload();
    expect(await readRoom()).toMatchObject({
      seated: true,
      you: { name: created.you.name },
    });
    expect(
      (await context.cookies()).find((c) => c.name === "chog_guest")?.value ===
        guest?.value,
    ).toBe(true);
    expect(writes).toBe(1);
  } finally {
    release();
  }
});

test("failed session initialization keeps invitation writes closed until a real read succeeds", async ({
  page,
}) => {
  await page.route(
    "**/api/pvp?mode=guest",
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Session temporarily unavailable." }),
      }),
    { times: 1 },
  );
  await page.goto("/challenge");
  const alert = page
    .getByRole("region", { name: "Challenge a friend" })
    .getByRole("alert");
  await expect(alert).toHaveText("Session temporarily unavailable.");
  const create = page.getByRole("button", { name: "Create invitation" });
  await expect(create).toBeDisabled();
  await expect(create).toBeEnabled({ timeout: 10000 });
  await expect(alert).toHaveCount(0);
  await create.click();
  await expect(page).toHaveURL(/\/challenge\/[A-Za-z0-9_-]{20,}/);
  const invite = new URL(page.url()).pathname.split("/").at(-1);
  expect(
    (await (await page.request.get(`/api/pvp?invite=${invite}`)).json()).seated,
  ).toBe(true);
});
