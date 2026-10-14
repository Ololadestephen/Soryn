import type { Page, Route } from "@playwright/test";
import { fixtureHolder } from "./holder";
import type { BattleView } from "../../src/domain/combat/contracts";

type SignedFixture = Awaited<ReturnType<typeof fixtureHolder>>;

class SignedVisualHolder {
  private nextRequest = 0;
  readonly headers: SignedFixture["headers"];
  constructor(
    private page: Page,
    private signed: SignedFixture,
    private interval: number,
  ) {
    this.headers = signed.headers;
  }
  private async pace() {
    const wait = Math.max(0, this.nextRequest - Date.now());
    this.nextRequest = Math.max(Date.now(), this.nextRequest) + this.interval;
    if (wait) await this.page.waitForTimeout(wait);
  }
  async post(input: Record<string, unknown>) {
    await this.pace();
    return this.signed(input);
  }
  async read() {
    await this.pace();
    return this.page.request.get("/api/battle?mode=official", {
      headers: this.headers,
    });
  }
  async finish() {
    let response = await this.read();
    for (let n = 0; n < 50; n++) {
      if (!response.ok())
        throw new Error(`Fixture battle request failed: ${response.status()}`);
      const { battle }: { battle: BattleView } = await response.json();
      if (battle.state.outcome) return;
      response = await this.post({
        operation: "step",
        mode: "official",
        id: battle.id,
        round: battle.state.round,
        move: battle.legal.includes("special")
          ? "special"
          : battle.legal.includes("basic")
            ? "basic"
            : "guard",
      });
    }
    throw new Error("Fixture battle did not finish within 50 rounds");
  }
  async route(route: Route) {
    const request = route.request();
    if (request.method() === "GET") await this.pace();
    const response =
      request.method() === "POST"
        ? await this.post({ ...request.postDataJSON(), mode: "official" })
        : await route.fetch({
            url: request.url().replace("mode=guest", "mode=official"),
            headers: { ...request.headers(), ...this.headers },
          });
    await route.fulfill({ response });
  }
}

/** Test-only signed transport; preserves real access, active-match and rate gates. */
export async function visualHolder(page: Page, interval = 0) {
  const signed = await fixtureHolder(page.request, 0, "/api/battle");
  const client = new SignedVisualHolder(page, signed, interval);
  await page.route("**/api/battle*", client.route.bind(client));
  return Object.assign(client.post.bind(client), {
    headers: client.headers,
    read: client.read.bind(client),
    finish: client.finish.bind(client),
  });
}
