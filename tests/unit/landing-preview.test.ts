import { afterEach, expect, it, vi } from "vitest";
import {
  loadPreviewImage,
  previewSequence,
} from "../../src/components/site/landing/preview-media";
class Picture {
  static latest: Picture;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  constructor() {
    Picture.latest = this;
  }
  decode() {
    return Promise.resolve();
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("preview waits for actual decoding, then releases handlers", async () => {
  vi.stubGlobal("Image", Picture);
  const result = loadPreviewImage("/art.webp", new AbortController().signal);
  expect(Picture.latest.src).toBe("/art.webp");
  Picture.latest.onload?.();
  await result;
  expect(Picture.latest.onload).toBeNull();
  expect(Picture.latest.onerror).toBeNull();
});
it("network failure and cancellation reject and release artwork", async () => {
  vi.stubGlobal("Image", Picture);
  const failed = loadPreviewImage(
    "/missing.webp",
    new AbortController().signal,
  );
  const assertion = expect(failed).rejects.toThrow("unavailable");
  Picture.latest.onerror?.();
  await assertion;
  const controller = new AbortController();
  const aborted = loadPreviewImage("/slow.webp", controller.signal);
  const abortAssertion = expect(aborted).rejects.toThrow("cancelled");
  controller.abort();
  await abortAssertion;
  expect(Picture.latest.onload).toBeNull();
  expect(Picture.latest.src).toBe("");
});
it("slow artwork times out and cannot leave a loading request alive", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("Image", Picture);
  const result = loadPreviewImage("/slow.webp", new AbortController().signal);
  const assertion = expect(result).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(10000);
  await assertion;
  expect(Picture.latest.onerror).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});
it("two-hit specials retain ordered phases, reduced motion and fresh replay", async () => {
  vi.useFakeTimers();
  const frames: string[] = [];
  const run = () =>
    previewSequence("bolt", true, new AbortController().signal, (phase, hit) =>
      frames.push(`${phase}:${hit}`),
    );
  const first = run();
  await vi.runAllTimersAsync();
  await first;
  expect(frames).toEqual([
    "anticipation:1",
    "action:1",
    "recovery:1",
    "anticipation:2",
    "action:2",
    "recovery:2",
  ]);
  const replay = run();
  await vi.runAllTimersAsync();
  await replay;
  expect(frames).toHaveLength(12);
  expect(vi.getTimerCount()).toBe(0);
});
it("cancelling a sequence prevents all later poses", async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const frames: string[] = [];
  const result = previewSequence("ember", false, controller.signal, (phase) =>
    frames.push(phase),
  );
  const assertion = expect(result).rejects.toThrow("Cancelled");
  controller.abort();
  await assertion;
  await vi.runAllTimersAsync();
  expect(frames).toEqual(["anticipation"]);
  expect(vi.getTimerCount()).toBe(0);
});
