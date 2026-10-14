"use client";
import { useEffect, useRef, useState } from "react";
import { type BattleView } from "../../domain/combat/contracts";
import { type CombatPresentation, presentationFrames } from "./playback";
import { feelDuration } from "../../domain/combat/presentation/feel";

export function usePlayback() {
  const [presentation, setPresentation] = useState<CombatPresentation | null>(
    null,
  );
  const mounted = useRef(true),
    cancelWait = useRef<(() => void) | null>(null),
    played = useRef(new Set<string>()),
    currentBattle = useRef<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelWait.current?.();
    };
  }, []);
  async function playRound(battle: BattleView, previous: BattleView | null) {
    if (currentBattle.current !== battle.id) {
      played.current.clear();
      currentBattle.current = battle.id;
    }
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    for (const frame of presentationFrames(battle, previous)) {
      if (!mounted.current) return;
      if (frame.id && played.current.has(frame.id)) continue;
      if (frame.id) played.current.add(frame.id);
      setPresentation(frame);
      const beat = playbackBeat(feelDuration(frame, reduced));
      cancelWait.current = beat.cancel;
      await beat.finished;
    }
    cancelWait.current = null;
    if (mounted.current) setPresentation(null);
  }
  return { presentation, playRound, clear: () => setPresentation(null) };
}

function playbackBeat(duration: number) {
  const completion: { finish?: () => void } = {};
  const finished = new Promise<void>((resolve) => {
    completion.finish = resolve;
  });
  const timer = setTimeout(() => completion.finish?.(), duration);
  return {
    finished,
    cancel: () => {
      clearTimeout(timer);
      completion.finish?.();
    },
  };
}
