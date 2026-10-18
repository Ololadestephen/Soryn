import type { PvpPreview, PvpView } from "../../domain/pvp/view";

const SESSION_MS = 4000;
const IDLE_MS = 2000;
const WAITING_MS = 500;

/**
 * Session reads stay slow so a first visit cannot mint two guest cookies.
 * A seated room polls quickly only while the opponent, the presentation
 * clock, the artwork gate, or the intermission can change the screen.
 */
export function pollDelayMs(
  invite: string | undefined,
  room: PvpView | PvpPreview | null,
): number {
  if (!invite) return SESSION_MS;
  if (!room?.seated) return IDLE_MS;
  if (room.phase === "choose" && room.you.move) return WAITING_MS;
  if (
    room.phase === "present" ||
    room.phase === "loading" ||
    room.phase === "intermission"
  )
    return WAITING_MS;
  return IDLE_MS;
}
