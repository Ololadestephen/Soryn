import {
  actionSchema,
  scenarioSchema,
  GameActionError,
  type Action,
  type GameState,
  type Scenario,
} from "./contracts";
export { GameActionError };
import * as legacy from "./legacy";
import * as tactical from "./tactical/engine";
export function initialState(scenario: Scenario): GameState {
  const frozen = scenarioSchema.parse(scenario);
  return frozen.rules === "sandwich-rules/2"
    ? tactical.initial(frozen)
    : legacy.initialState(frozen);
}
export function observe(state: GameState) {
  return state.tactics ? tactical.observation(state) : legacy.observe(state);
}
export function transition(state: GameState, input: unknown): GameState {
  const action = actionSchema.parse(input);
  if (state.tactics) return tactical.advance(state, action);
  return legacy.transition(state, input);
}
export function replay(
  scenario: Scenario,
  actions: readonly Action[],
): GameState[] {
  const max = scenario.rules === "sandwich-rules/2" ? 32 : 10;
  if (actions.length > max) throw new Error("Run exceeds event budget.");
  const states = [initialState(scenario)];
  for (const action of actions)
    states.push(transition(states[states.length - 1], action));
  return states;
}
