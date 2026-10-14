import type { CharacterId } from "../../../domain/characters/definitions";
import { fighter } from "../../../domain/combat/definitions";
import type { PreviewPhase } from "./SpecialScene";

export function loadPreviewImage(path: string, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const picture = new Image();
    let settled = false;
    const timer = setTimeout(
      () => completeImage(new Error("Preview artwork timed out.")),
      10000,
    );
    function completeImage(error?: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      picture.onload = null;
      picture.onerror = null;
      if (error) {
        picture.src = "";
        reject(error);
      } else resolve();
    }
    function abort() {
      completeImage(new DOMException("Preview cancelled.", "AbortError"));
    }
    picture.onload = () => {
      void picture.decode().then(
        () => completeImage(),
        () => completeImage(new Error("Preview artwork could not be decoded.")),
      );
    };
    picture.onerror = () =>
      completeImage(new Error("Preview artwork unavailable."));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    else picture.src = path;
  });
}
export async function prepareSpecial(id: CharacterId, signal: AbortSignal) {
  const { atlases, renderedFighters } =
    await import("../../combat/rendered/assets");
  const family = renderedFighters[id];
  const group = new AbortController();
  const cancel = () => group.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  try {
    await Promise.all(
      [family.fighter, family.companion].map((key) =>
        loadPreviewImage(atlases[key].path, group.signal),
      ),
    );
  } finally {
    group.abort();
    signal.removeEventListener("abort", cancel);
  }
}
function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    function abort() {
      clearTimeout(timer);
      reject(new DOMException("Cancelled", "AbortError"));
    }
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}
/** Presentation only: honours defined hit count, no combat state or outcome writes. */
export async function previewSequence(
  id: CharacterId,
  reduced: boolean,
  signal: AbortSignal,
  onStep: (phase: PreviewPhase, hit: number) => void,
) {
  for (let hit = 1; hit <= fighter(id).moves.special.hits; hit++) {
    for (const phase of ["anticipation", "action", "recovery"] as const) {
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      onStep(phase, hit);
      await delay(
        reduced
          ? phase === "action"
            ? 180
            : 60
          : phase === "action"
            ? 520
            : phase === "anticipation"
              ? 240
              : 280,
        signal,
      );
    }
  }
}
