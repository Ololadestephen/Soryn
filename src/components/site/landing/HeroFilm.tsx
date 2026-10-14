"use client";
import { useEffect, useRef, useState } from "react";
import { bindHeroPlayback, type HeroPlaybackState } from "./heroPlayback";
export function HeroFilm() {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<HeroPlaybackState>({
    ready: false,
    playing: false,
    failed: false,
  });
  useEffect(() => {
    const element = video.current;
    const root = element?.closest<HTMLElement>(".gateway-hero");
    if (!element || !root) return;
    const binding = bindHeroPlayback(element, root, setState);
    return () => {
      binding.dispose();
    };
  }, []);
  return (
    <video
      ref={video}
      className="hero-film"
      data-ready={state.ready}
      data-failed={state.failed}
      muted
      playsInline
      loop
      preload="none"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
