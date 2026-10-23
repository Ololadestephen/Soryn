"use client";
import { useEffect, useRef } from "react";
import { gameMusic } from "./runtime";
export function GameSoundtrack() {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const unbind = gameMusic.bind(ref.current);
    const gesture = (event: Event) => {
      if (
        event.target instanceof Element &&
        event.target.closest(".sound-controls")
      )
        return;
      if (
        event instanceof KeyboardEvent &&
        event.key !== "Enter" &&
        event.key !== " "
      )
        return;
      gameMusic.activate();
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") gameMusic.suspend();
      else gameMusic.resume();
    };
    document.addEventListener("click", gesture);
    document.addEventListener("keydown", gesture);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("click", gesture);
      document.removeEventListener("keydown", gesture);
      document.removeEventListener("visibilitychange", visibility);
      unbind();
    };
  }, []);
  return (
    <audio
      ref={ref}
      data-game-soundtrack
      src="/music/legionnaire.m4a"
      preload="none"
      loop
    />
  );
}
