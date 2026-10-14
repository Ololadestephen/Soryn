import { afterEach, expect, it, vi } from "vitest";
import { bindHeroPlayback } from "../../src/components/site/landing/heroPlayback";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("defers media, stops offscreen/hidden, resumes visible media, and releases resources", async () => {
  vi.useFakeTimers();
  const document = Object.assign(new EventTarget(), {
    readyState: "complete",
    hidden: false,
  });
  const window = new EventTarget();
  const reduced = Object.assign(new EventTarget(), { matches: false });
  const connection = Object.assign(new EventTarget(), { saveData: false });
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", window);
  vi.stubGlobal("navigator", { connection });
  vi.stubGlobal("matchMedia", (query: string) =>
    query.includes("reduced") ? reduced : { matches: false },
  );
  let intersect: (visible: boolean) => void = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: (e: { isIntersecting: boolean }[]) => void) {
        intersect = (v) => callback([{ isIntersecting: v }]);
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  const video = Object.assign(new EventTarget(), {
    src: "",
    paused: true,
    readyState: 4,
    play: vi.fn(async () => {
      video.paused = false;
    }),
    pause: vi.fn(() => {
      video.paused = true;
    }),
    load: vi.fn(),
    getAttribute: () => video.src || null,
    removeAttribute: () => {
      video.src = "";
    },
    requestVideoFrameCallback: (callback: () => void) => callback(),
  });
  const report = vi.fn();
  const binding = bindHeroPlayback(
    video as unknown as HTMLVideoElement,
    {} as HTMLElement,
    report,
  );
  expect(video.src).toBe("");
  await vi.advanceTimersByTimeAsync(1499);
  expect(video.play).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(video.src).toContain("desktop.mp4");
  expect(report).toHaveBeenLastCalledWith({
    ready: true,
    playing: true,
    failed: false,
  });
  intersect(false);
  expect(video.paused).toBe(true);
  intersect(true);
  await Promise.resolve();
  expect(video.paused).toBe(false);
  document.hidden = true;
  document.dispatchEvent(new Event("visibilitychange"));
  expect(video.paused).toBe(true);
  document.hidden = false;
  document.dispatchEvent(new Event("visibilitychange"));
  await Promise.resolve();
  expect(video.paused).toBe(false);
  reduced.matches = true;
  reduced.dispatchEvent(new Event("change"));
  expect(video.src).toBe("");
  expect(video.paused).toBe(true);
  binding.dispose();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(video.src).toBe("");
});
