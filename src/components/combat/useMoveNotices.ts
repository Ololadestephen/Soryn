import { useEffect, useState } from "react";
import type { BattleView } from "../../domain/combat/contracts";
import {
  moveNotice,
  noticeDuration,
  updateMoveNotice,
  type MoveNotice,
  type MoveNoticeState,
} from "../../domain/combat/presentation/notices";
import type { CombatPresentation } from "./playback";

export function scheduleMoveNoticeExpiry(
  active: MoveNotice | null,
  onExpire: (expired: MoveNotice) => void,
): (() => void) | undefined {
  if (!active) return undefined;
  const timer = setTimeout(() => onExpire(active), noticeDuration);
  return () => clearTimeout(timer);
}

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
  useEffect(
    () =>
      scheduleMoveNoticeExpiry(active, (expired) =>
        setState((current) =>
          current.active === expired ? { ...current, active: null } : current,
        ),
      ),
    [active],
  );
  return !ended && state.battleId === battle.id ? active : null;
}
