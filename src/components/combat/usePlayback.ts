"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const generation = useRef(0);
  const clear = useCallback(() => {
    generation.current += 1;
    cancelWait.current?.();
    cancelWait.current = null;
    played.current.clear();
    currentBattle.current = null;
    setPresentation(null);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      cancelWait.current?.();
    };
  }, []);
  async function playRound(battle: BattleView, previous: BattleView | null) {
    const active = ++generation.current;
    cancelWait.current?.();
    if (currentBattle.current !== battle.id) {
      played.current.clear();
      currentBattle.current = battle.id;
    }
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    for (const frame of presentationFrames(battle, previous)) {
      if (!mounted.current || active !== generation.current) return;
      if (frame.id && played.current.has(frame.id)) continue;
      if (frame.id) played.current.add(frame.id);
      setPresentation(frame);
      const beat = playbackBeat(feelDuration(frame, reduced));
      cancelWait.current = beat.cancel;
      await beat.finished;
    }
    if (active === generation.current) {
      cancelWait.current = null;
      if (mounted.current) setPresentation(null);
    }
  }
  return { presentation, playRound, clear };
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
