import { character } from "../../characters/definitions";
import type { BattleView } from "../contracts";
import type { CombatPresentation } from "./project";

export interface MoveNotice {
  id: string;
  label: string;
}
export const noticeDuration = 3000;

export interface MoveNoticeState {
  battleId: string;
  active: MoveNotice | null;
  seen: ReadonlySet<string>;
}

/** Preserve dismissal and deduplication until a different battle begins. */
export function updateMoveNotice(
  state: MoveNoticeState,
  battleId: string,
  notice: MoveNotice | null,
  ended: boolean,
): MoveNoticeState {
  if (state.battleId !== battleId) {
    const active = ended ? null : notice;
    return { battleId, active, seen: new Set(active ? [active.id] : []) };
  }
  if (ended) return state.active ? { ...state, active: null } : state;
  if (!notice || state.seen.has(notice.id)) return state;
  return {
    ...state,
    active: notice,
    seen: new Set([...state.seen, notice.id]),
  };
}

/** Executed actions only. A counter and a second hit are not new moves. */
export function moveNotice(
  battle: BattleView,
  frame: CombatPresentation | null,
): MoveNotice | null {
  if (
    !frame?.id ||
    !frame.id.startsWith(`${battle.id}:`) ||
    frame.round === undefined ||
    !frame.event.side ||
    !frame.event.move
  )
    return null;
  const event = frame.event,
    side = frame.event.side,
    move = frame.event.move;
  const defence = event.kind === "prepare" && event.move === "guard";
  const executed =
    frame.phase === "anticipation" &&
    ["melee", "ranged", "heal"].includes(event.kind);
  if ((!defence && !executed) || (frame.hit ?? 0) > 0) return null;
  return {
    id: `${battle.id}:${frame.round}:${event.side}:executed`,
    label: `${character(battle.snapshot[side].id).name} · ${battle.snapshot[side].moves[move].name}`,
  };
}
