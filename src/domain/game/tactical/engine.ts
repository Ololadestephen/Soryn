import { enforceBudget } from "../budget";
import type {
  Action,
  BasicAction,
  Choice,
  GameState,
  Observation,
  TacticalScenario,
} from "../contracts";
import { basicActionSchema } from "../contracts";
import * as legacy from "../legacy";
import { scenarioFor } from "../contracts";
import { character, skillActions } from "../../characters/definitions";
import { skillEligible } from "../../abilities/eligibility";
import { applySkill } from "../../abilities/apply";

import { tacticsFor } from "./contracts";
import { protections, advanceEffects, eventKind } from "./effects";
import { mechanismClues } from "./clues";
import { commitmentChoices, commit } from "./commitment";
export function initial(scenario: TacticalScenario): GameState {
  const state = legacy.initialState(scenarioFor(scenario.seed));
  return {
    ...state,
    tactics: {
      loadout: structuredClone(scenario.loadout),
      charges: scenario.loadout.charges,
      consumed: 0,
      mechanismKnown: false,
      effects: { bubble: false, trail: 0, steady: false, reroute: false },
      pending: null,
      events: [],
    },
  };
}
export function observation(state: GameState): Observation {
  const t = state.tactics;
  if (!t) throw new Error("Missing tactical state.");
  const result = legacy.observe({
    ...state,
    distracted: state.distracted || t.effects.trail > 0,
  });
  const choices: Choice[] = [...result.choices];
  if (!state.outcome && !t.mechanismKnown && !t.pending)
    choices.push({
      action: "inspect-mechanism",
      label: "Inspect the mechanism",
      hint: "1 turn · discover this room's compatible interactions",
    });
  const resolvedChoices = state.outcome
    ? choices
    : commitmentChoices(state, choices);
  const definition = character(t.loadout.characterId);
  if (skillEligible(state, definition.skill))
    resolvedChoices.unshift({
      action: definition.skill,
      label: `Use ${definition.ability}`,
      hint: `${t.charges} charge${t.charges === 1 ? "" : "s"} left · ${definition.rule.split(". ")[0]}. Exact targets and duration are in Ability rules.`,
    });
  return {
    ...result,
    choices: resolvedChoices,
    clue: [result.clue, t.mechanismKnown ? mechanismClues[state.room] : ""]
      .filter(Boolean)
      .join(" "),
  };
}
function enforce(state: GameState) {
  state.alarm = Math.max(0, Math.min(3, state.alarm));
  enforceBudget(state);
}
function ordinary(state: GameState, action: BasicAction): GameState {
  const t = tacticsFor(state);
  const next = legacy.transition(
    {
      ...state,
      distracted:
        state.distracted ||
        t.effects.trail > 0 ||
        (state.room === 1 && t.effects.reroute),
    },
    action,
  );
  if (state.room === next.room && action !== "gadget")
    next.distracted = state.distracted;
  if (action === "gadget") t.consumed++;
  protections(state, next, action);
  return next;
}
function applyAction(state: GameState, action: Action): GameState {
  const t = tacticsFor(state);
  if (commit(state, action)) return state;
  if (action === "resolve-choice") {
    const pending = t.pending;
    if (!pending) throw new Error("No committed choice.");
    t.pending = null;
    return ordinary(state, pending);
  }
  if (skillActions.includes(action as (typeof skillActions)[number])) {
    applySkill(state, action as (typeof skillActions)[number]);
    return state;
  }
  if (action === "inspect-mechanism") {
    t.mechanismKnown = true;
    state.turns--;
    state.message = mechanismClues[state.room];
    if (state.room === 1)
      state.patrol = state.patrol === "watching" ? "reading" : "watching";
    return state;
  }
  return ordinary(state, basicActionSchema.parse(action));
}
export function advance(previous: GameState, action: Action): GameState {
  if (!observation(previous).choices.some((choice) => choice.action === action))
    throw new Error("Action unavailable in this state.");
  const state = applyAction(structuredClone(previous), action);
  const t = tacticsFor(state);
  const cost = previous.turns - state.turns;
  advanceEffects(previous, state, action, cost);
  enforce(state);
  t.events.push({
    action,
    kind: eventKind(previous, state, action),
    from: previous.room,
    to: state.room,
    cost,
    alarmDelta: state.alarm - previous.alarm,
    gadgetDelta: state.gadgets - previous.gadgets,
    message: state.message,
  });
  return state;
}
