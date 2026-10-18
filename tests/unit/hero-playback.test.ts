import { afterEach, expect, it, vi } from "vitest";
import { bindHeroPlayback } from "../../src/components/site/landing/heroPlayback";

afterEach(() => vi.unstubAllGlobals());
function setup({
  reducedMotion = false,
  saveData = false,
  reject = false,
} = {}) {
  const document = Object.assign(new EventTarget(), {
    readyState: "loading",
    hidden: false,
  });
  const reduced = Object.assign(new EventTarget(), { matches: reducedMotion });
  const portrait = Object.assign(new EventTarget(), { matches: false });
  const connection = Object.assign(new EventTarget(), { saveData });
  vi.stubGlobal("document", document);
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("navigator", { connection });
  vi.stubGlobal("matchMedia", (query: string) =>
    query.includes("reduced") ? reduced : portrait,
  );
  let intersect: (visible: boolean) => void = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: (e: { isIntersecting: boolean }[]) => void) {
        intersect = (visible) => callback([{ isIntersecting: visible }]);
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  const frames: (() => void)[] = [];
  const video = Object.assign(new EventTarget(), {
    src: "",
    paused: true,
    readyState: 4,
    play: vi.fn(async () => {
      if (reject)
        throw new DOMException("Autoplay rejected", "NotAllowedError");
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
    requestVideoFrameCallback: (callback: () => void) => {
      frames.push(callback);
    },
  });
  const report = vi.fn();
  const binding = bindHeroPlayback(
    video as unknown as HTMLVideoElement,
    {} as HTMLElement,
    report,
  );
  return {
    document,
    portrait,
    reduced,
    connection,
    video,
    report,
    frames,
    binding,
    disconnect,
    intersect: (v: boolean) => intersect(v),
  };
}
it("starts before window load, but reveals only a decoded video frame", async () => {
  const h = setup();
  expect(h.video.src).toContain("v4-desktop.mp4");
  expect(h.video.play).toHaveBeenCalledOnce();
  expect(h.report).not.toHaveBeenCalledWith(
    expect.objectContaining({ ready: true }),
  );
  await Promise.resolve();
  h.frames.shift()!();
  expect(h.report).toHaveBeenLastCalledWith({
    ready: true,
    playing: true,
    failed: false,
  });
  h.binding.dispose();
});
it.each([{ reducedMotion: true }, { saveData: true }])(
  "does not request video when motion is disallowed: %j",
  (preferences) => {
    const h = setup(preferences);
    expect(h.video.src).toBe("");
    expect(h.video.play).not.toHaveBeenCalled();
    h.binding.dispose();
  },
);
it("stops offscreen and hidden playback, resumes, and releases resources", async () => {
  const h = setup();
  await Promise.resolve();
  h.frames.shift()!();
  h.intersect(false);
  expect(h.video.paused).toBe(true);
  h.intersect(true);
  await Promise.resolve();
  expect(h.video.paused).toBe(false);
  h.document.hidden = true;
  h.document.dispatchEvent(new Event("visibilitychange"));
  expect(h.video.paused).toBe(true);
  h.document.hidden = false;
  h.document.dispatchEvent(new Event("visibilitychange"));
  await Promise.resolve();
  expect(h.video.paused).toBe(false);
  h.binding.dispose();
  expect(h.disconnect).toHaveBeenCalledOnce();
  expect(h.video.src).toBe("");
});
it("a late frame cannot replace the poster after motion preferences change", async () => {
  const h = setup();
  await Promise.resolve();
  const lateFrame = h.frames.shift()!;
  h.reduced.matches = true;
  h.reduced.dispatchEvent(new Event("change"));
  lateFrame();
  expect(h.video.src).toBe("");
  expect(h.report).toHaveBeenLastCalledWith({
    ready: false,
    playing: false,
    failed: false,
  });
  h.reduced.matches = false;
  h.reduced.dispatchEvent(new Event("change"));
  await Promise.resolve();
  h.frames.shift()!();
  expect(h.report).toHaveBeenLastCalledWith({
    ready: true,
    playing: true,
    failed: false,
  });
  h.binding.dispose();
});
it("autoplay rejection and media errors retain the poster", async () => {
  const h = setup({ reject: true });
  await Promise.resolve();
  expect(h.report).toHaveBeenLastCalledWith({
    ready: false,
    playing: false,
    failed: true,
  });
  h.binding.dispose();
  const other = setup();
  await Promise.resolve();
  other.frames.shift()!();
  other.video.dispatchEvent(new Event("error"));
  expect(other.report).toHaveBeenLastCalledWith({
    ready: false,
    playing: false,
    failed: true,
  });
  other.binding.dispose();
});

it("changing orientation selects a matching variant and invalidates the old frame", async () => {
  const h = setup();
  await Promise.resolve();
  const oldFrame = h.frames.shift()!;
  h.portrait.matches = true;
  h.portrait.dispatchEvent(new Event("change"));
  oldFrame();
  expect(h.video.src).toContain("v4-mobile.mp4");
  expect(h.report).not.toHaveBeenCalledWith(
    expect.objectContaining({ ready: true }),
  );
  await Promise.resolve();
  h.frames.shift()!();
  expect(h.report).toHaveBeenLastCalledWith({
    ready: true,
    playing: true,
    failed: false,
  });
  h.binding.dispose();
});
