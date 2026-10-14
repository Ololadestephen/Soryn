import type { PvpPreview, PvpView } from "./view";

export interface RoomCursor {
  revision: number;
  serverNow: number;
  stamp: number;
}

function seated(value: PvpView | PvpPreview): value is PvpView {
  return value.seated;
}

/**
 * Ignore a response that started earlier than one already shown, a lower
 * revision, or an older clock for the same revision. A lobby poll must not
 * replace a seat the player already holds.
 */
export function nextRoomState(
  cursor: RoomCursor,
  next: PvpView | PvpPreview,
  stamp: number,
  source: "poll" | "action",
): { cursor: RoomCursor; room: PvpView | PvpPreview } | null {
  if (stamp < cursor.stamp) return null;
  if (!seated(next)) {
    if (source === "poll" && cursor.revision > 0) return null;
    return {
      cursor: { revision: 0, serverNow: 0, stamp },
      room: next,
    };
  }
  if (next.revision < cursor.revision) return null;
  if (next.revision === cursor.revision && next.serverNow < cursor.serverNow)
    return null;
  return {
    cursor: { revision: next.revision, serverNow: next.serverNow, stamp },
    room: next,
  };
}

const MILLISECONDS_PER_SECOND = 1000;

/** Display seconds left. The client clock cancels out of the server offset. */
export function remainingSeconds(
  serverNow: number,
  deadlineAt: number,
  clientNow: number,
) {
  const offset = serverNow - clientNow;
  return Math.max(
    0,
    Math.ceil((deadlineAt - (clientNow + offset)) / MILLISECONDS_PER_SECOND),
  );
}
