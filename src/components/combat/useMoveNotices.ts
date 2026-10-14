import { useEffect, useState } from "react";
import type { BattleView } from "../../domain/combat/contracts";
import {
  moveNotice,
  noticeDuration,
  updateMoveNotice,
  type MoveNoticeState,
} from "../../domain/combat/presentation/notices";
import type { CombatPresentation } from "./playback";

export function useMoveNotices(
  battle: BattleView,
  frame: CombatPresentation | null,
) {
  const [state, setState] = useState<MoveNoticeState>({
    battleId: battle.id,
    active: null,
    seen: new Set(),
  });
  const ended = !!(frame?.event.state ?? battle.state).outcome;
  const notice = ended ? null : moveNotice(battle, frame);
  // Adjust only for a new event or battle, before committing obsolete content.
  const next = updateMoveNotice(state, battle.id, notice, ended);
  if (next !== state) setState(next);
  const active = state.active;
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(
      () =>
        setState((current) =>
          current.active === active ? { ...current, active: null } : current,
        ),
      noticeDuration,
    );
    return () => clearTimeout(timer);
  }, [active]);
  return !ended && state.battleId === battle.id ? active : null;
}
