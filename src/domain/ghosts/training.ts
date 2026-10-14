import { replay } from "../game/engine";
import type { Action, GameState } from "../game/contracts";
import type { TrainingRun } from "./contracts";
export function visitTraining(
  run: TrainingRun,
  visit: (state: GameState, action: Action, firstEntry: boolean) => void,
) {
  const states = replay(run.scenario, run.actions);
  if (!states.at(-1)?.outcome)
    throw new Error("Ghost training requires completed validated runs.");
  const visited = new Set<number>();
  run.actions.forEach((action, index) => {
    const state = states[index],
      first = !visited.has(state.room);
    visited.add(state.room);
    visit(state, action, first);
  });
}
