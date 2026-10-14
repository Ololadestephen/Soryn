"use client";
import { useImageFailure } from "./useImageFailure";
import type { ArenaId } from "../../../domain/combat/arenas";
export function Environment({ id }: { id: ArenaId }) {
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
          media="(max-width:700px)"
          srcSet={`/combat/arenas/${id}-portrait.webp`}
        />
        <img
          ref={ref}
          src={`/combat/arenas/${id}-desktop.webp`}
          alt=""
          width={id === "sanctuary" ? 1672 : 1536}
          height={id === "sanctuary" ? 941 : 1024}
        />
      </picture>
    </>
  );
}
