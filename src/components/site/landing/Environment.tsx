"use client";
import { useImageFailure } from "./useImageFailure";
import type { ArenaId } from "../../../domain/combat/arenas";
export function Environment({
  id,
  hero = false,
}: {
  id: ArenaId;
  hero?: boolean;
}) {
  const { ref, failed } = useImageFailure();
  return (
    <>
      {failed && (
        <span className="environment-fallback">
          Environment artwork unavailable
        </span>
      )}
      <picture
        className="landing-environment"
        style={{ visibility: failed ? "hidden" : "visible" }}
      >
        <source
          media={
            hero
              ? "(max-width:700px) and (orientation:portrait)"
              : "(max-width:700px)"
          }
          srcSet={
            hero
              ? "/hero/sanctuary-motion-v4-mobile.webp"
              : `/combat/arenas/${id}-portrait.webp`
          }
        />
        <img
          ref={ref}
          src={
            hero
              ? "/hero/sanctuary-motion-v4-desktop.webp"
              : `/combat/arenas/${id}-desktop.webp`
          }
          fetchPriority={hero ? "high" : undefined}
          loading={hero ? "eager" : undefined}
          alt=""
          width={hero ? 1280 : id === "sanctuary" ? 1672 : 1536}
          height={hero ? 720 : id === "sanctuary" ? 941 : 1024}
        />
      </picture>
    </>
  );
}
