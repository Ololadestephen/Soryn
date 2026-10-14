import { afterEach, expect, it, vi } from "vitest";
import { prepareImage } from "../../src/components/combat/imagePreparation";
afterEach(() => vi.unstubAllGlobals());
it("shares decoded work, retains successful images and cancels only after the final consumer leaves", async () => {
  const images: {
    src: string;
    onload: null | (() => void);
    onerror: null | (() => void);
    decode: ReturnType<typeof vi.fn>;
  }[] = [];
  vi.stubGlobal(
    "Image",
    class {
      naturalWidth = 10;
      naturalHeight = 10;
      src = "";
      onload = null;
      onerror = null;
      decode = vi.fn(async () => {});
      constructor() {
        images.push(this);
      }
    },
  );
  const a = new AbortController(),
    b = new AbortController();
  const first = prepareImage("/same.webp", a.signal),
    second = prepareImage("/same.webp", b.signal);
  expect(images).toHaveLength(1);
  a.abort();
  expect(images[0].src).toBe("/same.webp");
  images[0].onload?.();
  expect(await first).toBe(true);
  expect(await second).toBe(true);
  expect(await prepareImage("/same.webp")).toBe(true);
  expect(images).toHaveLength(1);
  const abandoned = new AbortController();
  const cancelled = prepareImage("/cancel.webp", abandoned.signal);
  abandoned.abort();
  expect(await cancelled).toBe(false);
  expect(images[1].src).toBe("");
  const retry = prepareImage("/cancel.webp");
  expect(images).toHaveLength(3);
  images[2].onload?.();
  expect(await retry).toBe(true);
});
it("a failed image can actually be retried", async () => {
  const images: {
    onerror: null | (() => void);
    onload: null | (() => void);
  }[] = [];
  vi.stubGlobal(
    "Image",
    class {
      naturalWidth = 10;
      naturalHeight = 10;
      src = "";
      onload = null;
      onerror = null;
      decode = () => Promise.resolve();
      constructor() {
        images.push(this);
      }
    },
  );
  const failed = prepareImage("/retry.webp");
  images[0].onerror?.();
  expect(await failed).toBe(false);
  const retry = prepareImage("/retry.webp");
  images[1].onload?.();
  expect(await retry).toBe(true);
});
