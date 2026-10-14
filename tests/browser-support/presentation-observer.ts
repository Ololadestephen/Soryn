import type { Page } from "@playwright/test";
export interface NoticeObservation {
  id: string;
  text: string;
  at: number;
  removed?: number;
}

const frameSamplingDurationMs = 12000;
function installPresentationObserver(durationMs: number) {
  const stage = document.querySelector<HTMLElement>(".battle-stage");
  const region = document.querySelector<HTMLElement>(".move-notice-region");
  if (!stage || !region) throw new Error("Battle presentation missing");
  const records: {
    id: string;
    text: string;
    at: number;
    removed?: number;
  }[] = [];
  let previous: string | null = null;
  const recordNoticeChange = () => {
    const node = region.querySelector<HTMLElement>(".move-notice");
    const id = node?.dataset.noticeId ?? null;
    if (id !== previous) {
      const last = records.at(-1);
      if (last) last.removed = performance.now();
      if (id)
        records.push({
          id,
          text: node?.textContent ?? "",
          at: performance.now(),
        });
      previous = id;
      region.dataset.noticeTrace = JSON.stringify(records);
    }
  };
  new MutationObserver(recordNoticeChange).observe(region, {
    childList: true,
    subtree: true,
  });
  recordNoticeChange();
  const gaps: number[] = [];
  let before = performance.now();
  const end = before + durationMs;
  const tick = (now: number) => {
    gaps.push(now - before);
    before = now;
    stage.dataset.frameTrace = JSON.stringify(gaps);
    if (now < end && stage.isConnected) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
export async function observePresentation(page: Page) {
  await page.locator(".battle-stage").waitFor({ state: "visible" });
  await page.locator(".move-notice-region").waitFor({ state: "attached" });
  await page.evaluate(installPresentationObserver, frameSamplingDurationMs);
}
export async function noticeObservations(
  page: Page,
): Promise<NoticeObservation[]> {
  return JSON.parse(
    (await page
      .locator(".move-notice-region")
      .getAttribute("data-notice-trace")) ?? "[]",
  );
}
