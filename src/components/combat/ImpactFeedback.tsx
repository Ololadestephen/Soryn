import { useEffect, useRef } from "react";
import { impactFeel } from "../../domain/combat/presentation/feel";
import type { CombatPresentation } from "./playback";
export function ImpactFeedback({
  frame,
}: {
  frame: CombatPresentation | null;
}) {
  const root = useRef<HTMLDivElement>(null);
  const feel = impactFeel(frame);
  useEffect(() => {
    if (
      !feel.contact ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const field = root.current?.closest<HTMLElement>(".combat-field");
    if (!field) return;
    const paused = field
      .getAnimations({ subtree: true })
      .filter((animation) => animation.playState === "running");
    paused.forEach((animation) => animation.pause());
    let shake: Animation | undefined;
    const timer = setTimeout(() => {
      paused.forEach((animation) => animation.play());
      if (feel.shakePx)
        shake = field.animate(
          [
            { translate: "0 0" },
            { translate: `${feel.shakePx}px 0` },
            { translate: `${-feel.shakePx}px 0` },
            { translate: "0 0" },
          ],
          { duration: feel.strong ? 150 : 100 },
        );
    }, feel.stopMs);
    return () => {
      clearTimeout(timer);
      paused.forEach((animation) => animation.play());
      shake?.cancel();
    };
  }, [frame?.id, feel.contact, feel.shakePx, feel.stopMs, feel.strong]);
  if (!feel.contact) return null;
  return (
    <div
      ref={root}
      className={`impact-feedback ${feel.strong ? "impact-special" : "impact-basic"} feedback-${frame?.cue?.type} contact-${frame?.cue?.target}`}
      aria-hidden="true"
    >
      <span className="contact-ring" />
      {feel.strong &&
        [0, 1, 2, 3].map((i) => (
          <i key={i} style={{ "--particle": i } as React.CSSProperties} />
        ))}
    </div>
  );
}
