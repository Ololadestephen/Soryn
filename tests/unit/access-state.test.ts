import { afterEach, expect, it, vi } from "vitest";
import { readAccessState } from "../../src/components/auth/readAccessState";
afterEach(() => vi.unstubAllGlobals());
const view = {
  status: "paused",
  authenticated: true,
  message: "Paused",
  fighters: [],
  checkedAt: null,
};
it.each([
  "/story",
  "/arena",
  "/challenge/fixture-room",
  "/match/fixture-series",
])(
  "retains frozen encounter resume at %s using the same verified proof",
  async (path) => {
    const proof = { Authorization: "Bearer labelled-read-fixture" };
    const fetcher = vi.fn<typeof fetch>(
      async (url) =>
        new Response(
          JSON.stringify(
            url === "/api/access" ? view : { battleId: "saved-fixture" },
          ),
        ),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(await readAccessState(path, false, proof)).toEqual({
      view,
      saved: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      headers: { ...proof, "x-soryn-play": "wallet" },
    });
  },
);
it("record-only profile reads do not invent an encounter or trigger an eligibility refresh", async () => {
  const fetcher = vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify(view)),
  );
  vi.stubGlobal("fetch", fetcher);
  expect(await readAccessState("/character", true, {})).toEqual({
    view,
    saved: false,
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe("/api/access?records=1");
});
it("failed saved-encounter reads grant no gameplay, surface lookupError, and cannot erase confirmed authentication", async () => {
  const fetcher = vi.fn<typeof fetch>(async (url) =>
    url === "/api/access"
      ? new Response(JSON.stringify(view))
      : new Response("{}", { status: 503 }),
  );
  vi.stubGlobal("fetch", fetcher);
  expect(await readAccessState("/story", false, {})).toEqual({
    view,
    saved: false,
    lookupError: "Try again.",
  });
});
it("uncreated room invite 404 reports saved=false without a lookup error", async () => {
  const fetcher = vi.fn<typeof fetch>(async (url) =>
    url === "/api/access"
      ? new Response(JSON.stringify(view))
      : new Response(JSON.stringify({ error: "Invitation not found." }), {
          status: 404,
        }),
  );
  vi.stubGlobal("fetch", fetcher);
  expect(await readAccessState("/challenge/uncreated-room", false, {})).toEqual(
    {
      view,
      saved: false,
    },
  );
});
