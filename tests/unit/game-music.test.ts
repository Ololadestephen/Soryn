import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GameMusic } from "../../src/components/combat/audio/runtime";
let saved: string | null;
beforeEach(() => {
  saved = null;
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", { visibilityState: "visible" });
  vi.stubGlobal("localStorage", {
    getItem: () => saved,
    setItem: (_: string, value: string) => {
      saved = value;
    },
  });
});
afterEach(() => vi.unstubAllGlobals());
function element() {
  const media = {
    paused: true,
    volume: 1,
    currentTime: 42,
    play: vi.fn(async () => {
      media.paused = false;
    }),
    pause: vi.fn(() => {
      media.paused = true;
    }),
  };
  return media;
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
it("waits for activation, shares one playback and keeps position through mute/resume", async () => {
  const music = new GameMusic(),
    media = element();
  const dispose = music.bind(media as unknown as HTMLAudioElement);
  music.resume();
  expect(media.play).not.toHaveBeenCalled();
  music.activate();
  music.activate();
  await settle();
  expect(media.play).toHaveBeenCalledTimes(1);
  music.set(false, 0.15);
  expect(media.paused).toBe(true);
  music.set(true);
  music.activate();
  await settle();
  expect(media.play).toHaveBeenCalledTimes(2);
  expect(media.currentTime).toBe(42);
  expect(media.volume).toBe(0.15);
  expect(JSON.parse(saved!)).toEqual({ enabled: true, volume: 0.15 });
  dispose();
  expect(media.paused).toBe(true);
});
it("honours stored mute, bounds volume and survives denied storage", async () => {
  saved = JSON.stringify({ enabled: false, volume: 9 });
  const music = new GameMusic(),
    media = element();
  music.bind(media as unknown as HTMLAudioElement);
  music.activate();
  expect(media.play).not.toHaveBeenCalled();
  expect(media.volume).toBe(1);
  vi.stubGlobal("localStorage", {
    setItem: () => {
      throw Error("denied");
    },
  });
  expect(() => music.set(true, -2)).not.toThrow();
  expect(media.volume).toBe(0);
  music.set(true, NaN);
  expect(media.volume).toBe(0);
});
it("pauses while hidden and resumes only previously activated music", async () => {
  const music = new GameMusic(),
    media = element();
  music.bind(media as unknown as HTMLAudioElement);
  music.activate();
  await settle();
  vi.stubGlobal("document", { visibilityState: "hidden" });
  music.suspend();
  music.resume();
  expect(media.paused).toBe(true);
  expect(media.play).toHaveBeenCalledTimes(1);
  vi.stubGlobal("document", { visibilityState: "visible" });
  music.resume();
  await settle();
  expect(media.play).toHaveBeenCalledTimes(2);
});
it("contains playback failure without retry loops and permits a later gesture to retry", async () => {
  const music = new GameMusic(),
    media = element();
  media.play.mockRejectedValueOnce(Error("unavailable"));
  music.bind(media as unknown as HTMLAudioElement);
  music.activate();
  await settle();
  expect(media.play).toHaveBeenCalledTimes(1);
  await settle();
  expect(media.play).toHaveBeenCalledTimes(1);
  music.activate();
  await settle();
  expect(media.play).toHaveBeenCalledTimes(2);
});
it("a late play response cannot unmute or revive an unbound player", async () => {
  let finish!: () => void;
  const music = new GameMusic(),
    media = element();
  media.play.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = () => {
          media.paused = false;
          resolve();
        };
      }),
  );
  const dispose = music.bind(media as unknown as HTMLAudioElement);
  music.activate();
  music.set(false);
  dispose();
  finish();
  await settle();
  expect(media.paused).toBe(true);
});
