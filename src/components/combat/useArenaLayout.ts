import { useEffect, type RefObject } from "react";
import { stageLayout } from "../../domain/combat/presentation/layout";

/** Reserve real HUD/control sizes, including zoomed text and browser safe areas. */
export function useArenaLayout(root: RefObject<HTMLDialogElement | null>) {
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const hud = element.querySelector<HTMLElement>(".combat-scoreboard");
    const controls = element.querySelector<HTMLElement>(".combat-controls");
    const round = element.querySelector<HTMLElement>(".arena-round");
    const readiness = element.querySelector<HTMLElement>(".turn-readiness");
    if (!hud || !controls) return;
    const measure = () => {
      const box = element.getBoundingClientRect();
      element.style.setProperty(
        "--round-clearance",
        `${(round?.getBoundingClientRect().height ?? 32) + 12}px`,
      );
      element.style.setProperty(
        "--hud-bottom",
        `${hud.getBoundingClientRect().bottom - box.top + 8}px`,
      );
      const hudBottom = hud.getBoundingClientRect().bottom - box.top + 8;
      const controlsTop = controls.getBoundingClientRect().top - box.top;
      const arena = element.querySelector(".combat-arena");
      if (!arena) return;
      const sourceLimit =
        Number.parseFloat(
          getComputedStyle(arena).getPropertyValue("--fighter-limit"),
        ) || 418;
      const layout = stageLayout(
        box.width,
        box.height,
        hudBottom,
        controlsTop,
        sourceLimit,
        readiness?.getBoundingClientRect().height ?? 18,
      );
      element.style.setProperty("--field-top", `${layout.fieldTop}px`);
      element.style.setProperty("--field-height", `${layout.fieldHeight}px`);
      element.style.setProperty("--fighter-size", `${layout.fighterSize}px`);
      element.style.setProperty("--fighter-left", `${layout.left}px`);
      element.style.setProperty("--attack-reach", `${layout.reach}px`);
      const ground =
        layout.fieldTop + layout.fieldHeight - layout.fighterSize * 0.06;
      const backdropHeight = box.height;
      element.style.setProperty("--backdrop-height", `${backdropHeight}px`);
      element.style.setProperty(
        "--backdrop-top",
        `${ground - backdropHeight * 0.78}px`,
      );
      element.style.setProperty(
        "--controls-height",
        `${box.bottom - controls.getBoundingClientRect().top + 12}px`,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(hud);
    observer.observe(controls);
    observer.observe(element);
    if (round) observer.observe(round);
    if (readiness) observer.observe(readiness);
    measure();
    return () => observer.disconnect();
  }, [root]);
}
