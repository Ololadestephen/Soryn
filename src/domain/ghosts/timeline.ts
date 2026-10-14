import type { Observation } from "../game/contracts";

/** Resolve a lane by spent turns, not action count (the vent costs two turns). */
export function frameAtTurn(frames: readonly Observation[], turn: number) {
  if (!frames.length || !Number.isInteger(turn) || turn < 0)
    throw new Error("A replay needs frames and a nonnegative integer turn.");
  const initialTurns = frames[0].turns;
  let actionIndex = 0;
  while (
    actionIndex + 1 < frames.length &&
    initialTurns - frames[actionIndex + 1].turns <= turn
  )
    actionIndex++;
  const frame = frames[actionIndex];
  const inTransit =
    actionIndex + 1 < frames.length && initialTurns - frame.turns < turn;
  return { frame, actionIndex, inTransit };
}
