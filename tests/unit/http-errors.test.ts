import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { failure, parseInput } from "../../src/server/httpShared";
import { readStored } from "../../src/server/storedRecord";
import { ServiceError } from "../../src/server/errors";
afterEach(() => vi.restoreAllMocks());
it("distinguishes malformed input from internal schema and JSON failures", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const schema = z.object({ value: z.number() });
  let inputError: unknown;
  try {
    parseInput(schema, { value: "secret" });
  } catch (error) {
    inputError = error;
  }
  expect(failure(inputError).status).toBe(400);
  expect(log).not.toHaveBeenCalled();
  expect(failure(schema.safeParse({ value: "secret" }).error).status).toBe(503);
  expect(failure(new SyntaxError("secret stored JSON")).status).toBe(503);
  expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
});
it("preserves causes and logs safe server categories without exposing underlying data", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  let stored: unknown;
  try {
    readStored(z.number(), "private record");
  } catch (error) {
    stored = error;
  }
  expect(stored).toBeInstanceOf(ServiceError);
  expect((stored as Error).cause).toBeInstanceOf(SyntaxError);
  const reply = failure(stored);
  expect(reply.status).toBe(503);
  expect(JSON.stringify(log.mock.calls)).toContain("MalformedStoredJSON");
  const rpc = new ServiceError(503, "Ownership unavailable.", undefined, {
    cause: new Error("Wrong chain"),
  });
  expect(await failure(rpc).json()).toEqual({
    error: "Ownership unavailable.",
  });
  expect(JSON.stringify(log.mock.calls)).toContain("Wrong chain");
  expect(JSON.stringify(log.mock.calls)).not.toContain("private record");
});
