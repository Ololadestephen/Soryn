import { useEffect, useRef } from "react";
import type { BattleView } from "../../../domain/combat/contracts";
import { frameSounds } from "../../../domain/combat/presentation/feel";
import type { CombatPresentation } from "../playback";
import { combatAudio } from "./runtime";

export function usePresentationAudio(
  battle: BattleView,
  frame: CombatPresentation | null,
  complete: boolean,
) {
  const played = useRef(new Set<string>()),
    sawPlayback = useRef(false);
  useEffect(() => {
    if (!frame?.id || played.current.has(frame.id)) return;
    played.current.add(frame.id);
    sawPlayback.current = true;
    for (const cue of frameSounds(battle, frame)) {
      const key = cue.startsWith("special-")
        ? `${battle.id}:${frame.round}:${frame.event.side}:special`
        : `${frame.id}:${cue}`;
      if (played.current.has(key)) continue;
      played.current.add(key);
      combatAudio.play(cue);
    }
  }, [battle, frame]);
  useEffect(() => {
    const key = `${battle.id}:result`;
    if (
      !complete ||
      !sawPlayback.current ||
      played.current.has(key) ||
      !battle.state.outcome
    )
      return;
    played.current.add(key);
    combatAudio.play(battle.state.outcome);
  }, [battle, complete]);
}
