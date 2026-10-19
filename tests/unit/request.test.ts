import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  request,
  RequestError,
  ignoreResponse,
} from "../../src/components/request";

afterEach(() => vi.unstubAllGlobals());

function stub(reply: { ok: boolean; data: unknown }) {
  const fetchMock = vi.fn(async () => ({
    ok: reply.ok,
    status: reply.ok ? 200 : 409,
    json: async () => reply.data,
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("request helper", () => {
  it("retains the HTTP status for callers handling a bounded revision retry", async () => {
    stub({
      ok: false,
      data: {
        error: "Updated human-readable wording.",
        code: "revision-conflict",
      },
    });
    const problem = await request("/api/pvp", ignoreResponse, {}).catch(
      (error) => error,
    );
    expect(problem).toBeInstanceOf(RequestError);
    expect(problem).toMatchObject({ status: 409, code: "revision-conflict" });
  });
  it.each([200, 502])(
    "contains non-JSON proxy responses (%s)",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response("<html>internal proxy detail</html>", { status }),
        ),
      );
      await expect(request("/api/pvp", ignoreResponse)).rejects.toThrow(
        status === 200 ? /Reload or retry/ : /Request unavailable \(502\)/,
      );
    },
  );
  it("posts JSON with the caller's headers and signal", async () => {
    const fetchMock = stub({ ok: true, data: { value: 1 } });
    const signal = new AbortController().signal;
    const data = await request(
      "/api/thing",
      z.object({ value: z.number() }).parse,
      { operation: "join" },
      signal,
      { "x-csrf": "token" },
    );
    expect(data).toEqual({ value: 1 });
    expect(fetchMock).toHaveBeenCalledWith("/api/thing", {
      method: "POST",
      headers: { "x-csrf": "token", "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "join" }),
      signal,
    });
  });

  it("reads without a body and bypasses the cache", async () => {
    const fetchMock = stub({ ok: true, data: [] });
    await request("/api/list", ignoreResponse, undefined, undefined, {
      "x-mode": "guest",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/list", {
      cache: "no-store",
      signal: undefined,
      headers: { "x-mode": "guest" },
    });
  });

  it("throws the server's message on a failed reply", async () => {
    stub({ ok: false, data: { error: "Move already locked." } });
    await expect(request("/api/pvp", ignoreResponse, {})).rejects.toThrow(
      "Move already locked.",
    );
  });

  it("falls back to a retry message when no error field is present", async () => {
    stub({ ok: false, data: {} });
    await expect(request("/api/pvp", ignoreResponse, {})).rejects.toThrow(
      "Try again.",
    );
  });
});

it("rejects malformed successful payloads before they reach client state", async () => {
  stub({ ok: true, data: { value: "private malformed body" } });
  await expect(
    request("/api/thing", z.object({ value: z.number() }).parse),
  ).rejects.toMatchObject({
    status: 200,
    message:
      "The server response was invalid. Reload or retry the saved request.",
  });
});

it.each([
  ["3", 3],
  [null, 60],
  ["invalid", 60],
])(
  "retains Retry-After for 429 JSON and proxy responses: %s",
  async (header, seconds) => {
    for (const json of [true, false]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(
              json
                ? JSON.stringify({ error: "Rate limited" })
                : "<html>Limited</html>",
              { status: 429, headers: header ? { "Retry-After": header } : {} },
            ),
        ),
      );
      await expect(
        request("/api/access", ignoreResponse),
      ).rejects.toMatchObject({ status: 429, retryAfterSeconds: seconds });
    }
  },
);
it("understands an HTTP-date Retry-After without retrying automatically", async () => {
  const now = Date.now();
  vi.spyOn(Date, "now").mockReturnValue(now);
  const date = new Date(Math.ceil(now / 1000) * 1000 + 4000).toUTCString();
  const fetchMock = vi.fn(
    async () =>
      new Response("{}", { status: 429, headers: { "Retry-After": date } }),
  );
  vi.stubGlobal("fetch", fetchMock);
  await expect(request("/api/access", ignoreResponse)).rejects.toMatchObject({
    status: 429,
    retryAfterSeconds: Math.ceil((Date.parse(date) - now) / 1000),
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  vi.restoreAllMocks();
});
