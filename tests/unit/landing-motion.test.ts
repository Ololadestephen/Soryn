import { afterEach, expect, it, vi } from "vitest";
import { bindSceneMotion } from "../../src/components/site/landing/useSceneMotion";
import { bindVideoVisibility } from "../../src/components/site/landing/GameplayShowcase";
afterEach(() => vi.unstubAllGlobals());
it("the brief fade pauses offscreen, hidden and reduced; cleanup releases its listeners", () => {
  const document = Object.assign(new EventTarget(), { hidden: false });
  const reduced = Object.assign(new EventTarget(), { matches: false });
  const root = { dataset: { motion: "" } };
  let intersect: (visible: boolean) => void = () => {
    throw new Error("Observer not attached");
  };
  const disconnect = vi.fn();
  vi.stubGlobal("document", document);
  vi.stubGlobal("matchMedia", () => reduced);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        intersect = (visible) => callback([{ isIntersecting: visible }]);
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  const release = bindSceneMotion(root as unknown as HTMLElement);
  expect(root.dataset.motion).toBe("on");
  intersect(false);
  expect(root.dataset.motion).toBe("off");
  intersect(true);
  expect(root.dataset.motion).toBe("on");
  document.hidden = true;
  document.dispatchEvent(new Event("visibilitychange"));
  expect(root.dataset.motion).toBe("off");
  document.hidden = false;
  document.dispatchEvent(new Event("visibilitychange"));
  expect(root.dataset.motion).toBe("on");
  reduced.matches = true;
  reduced.dispatchEvent(new Event("change"));
  expect(root.dataset.motion).toBe("off");
  release();
  expect(disconnect).toHaveBeenCalledOnce();
  reduced.matches = false;
  reduced.dispatchEvent(new Event("change"));
  document.dispatchEvent(new Event("visibilitychange"));
  expect(root.dataset.motion).toBe("off");
});

it("explicit video playback pauses offscreen/hidden without resuming itself, and releases listeners", () => {
  const document = Object.assign(new EventTarget(), { hidden: false });
  const video = { pause: vi.fn() };
  let intersect: (visible: boolean) => void = () => {
    throw new Error("Observer not attached");
  };
  const disconnect = vi.fn();
  vi.stubGlobal("document", document);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        intersect = (visible) => callback([{ isIntersecting: visible }]);
      }
      observe = vi.fn();
      disconnect = disconnect;
    },
  );
  const release = bindVideoVisibility(video as unknown as HTMLVideoElement);
  intersect(true);
  expect(video.pause).not.toHaveBeenCalled();
  intersect(false);
  expect(video.pause).toHaveBeenCalledOnce();
  document.hidden = true;
  document.dispatchEvent(new Event("visibilitychange"));
  expect(video.pause).toHaveBeenCalledTimes(2);
  document.hidden = false;
  document.dispatchEvent(new Event("visibilitychange"));
  expect(video.pause).toHaveBeenCalledTimes(2);
  release();
  expect(disconnect).toHaveBeenCalledOnce();
  document.hidden = true;
  document.dispatchEvent(new Event("visibilitychange"));
  expect(video.pause).toHaveBeenCalledTimes(2);
});
