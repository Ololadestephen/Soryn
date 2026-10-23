import { enforceBudget } from "./budget";
import {
  basicActionSchema as actionSchema,
  legacyScenarioSchema as scenarioSchema,
  GameActionError,
  type BasicAction as Action,
  type Choice,
  type GameState,
  type Observation,
  type LegacyScenario as Scenario,
} from "./contracts";

export function initialState(scenario: Scenario): GameState {
  const frozen = scenarioSchema.parse(scenario);
  return {
    room: 0,
    turns: 10,
    alarm: 0,
    gadgets: 1,
    inspected: false,
    patrol: frozen.seed % 2 === 0 ? "watching" : "reading",
    distracted: false,
    sandwich: false,
    outcome: null,
    message: "One sandwich. Ten turns. A deeply questionable plan.",
  };
}

const choice = (action: Action, label: string, hint: string): Choice => ({
  action,
  label,
  hint,
});
const rooms = [
  {
    roomTitle: "The Hall of Extremely Helpful Signs",
    description:
      "A heroic door. A modest archway. A sign that says: ‘Our doors are works of art.’",
    clue: "The door has brushstrokes and no hinges. The archway has footprints. Use the archway.",
  },
  {
    roomTitle: "The Guard Who Loves Paperwork",
    description:
      "The guard alternates between reading and watching after each turn. Sneak while reading, spend your decoy, or inspect for another route.",
    clue: "An unguarded service vent goes straight to extraction. Taking it costs two turns. Sneaking costs one; the guard must be reading.",
  },
  {
    roomTitle: "Sandwich Extraction",
    description:
      "The sandwich rests on a pressure plate. An emergency exit sits beside it. The guard has filed a form about crumbs.",
    clue: "Use your decoy to replace the sandwich, or swap it with the brass paperweight on the counter. Then take the exit.",
  },
];

function choices(state: GameState): Choice[] {
  if (state.outcome) return [];
  const list: Choice[] = state.inspected
    ? []
    : [
        choice(
          "inspect",
          "Inspect the room",
          "Spend 1 turn to read an actionable clue.",
        ),
      ];
  if (state.room === 0)
    list.push(
      choice(
        "door",
        "Rush the heroic door",
        "1 turn · hinges suspiciously absent",
      ),
      choice(
        "arch",
        "Take the modest archway",
        "1 turn · follow the footprints",
      ),
    );
  else if (state.room === 1) {
    list.push(
      choice(
        "sneak",
        "Sneak past the guard",
        "1 turn · safe while reading or distracted",
      ),
    );
    if (state.inspected && state.turns >= 2)
      list.push(
        choice(
          "vent",
          "Crawl through the service vent",
          "2 turns · guaranteed passage",
        ),
      );
    if (state.gadgets && !state.distracted)
      list.push(
        choice(
          "gadget",
          "Deploy paperwork decoy",
          "1 turn · distract until you pass",
        ),
      );
    list.push(
      choice(
        "wait",
        "Wait for the next patrol phase",
        "1 turn · reading ↔ watching",
      ),
    );
  } else {
    if (!state.sandwich) {
      list.push(
        choice(
          "take",
          "Grab the sandwich",
          "1 turn · pressure plate raises alarm by 2",
        ),
      );
      if (state.gadgets)
        list.push(
          choice(
            "gadget",
            "Replace it with your decoy",
            "1 turn · take sandwich with no alarm",
          ),
        );
      if (state.inspected)
        list.push(
          choice(
            "swap",
            "Swap in the brass paperweight",
            "1 turn · take sandwich with no alarm",
          ),
        );
    }
    list.push(
      choice(
        "exit",
        "Take the emergency exit",
        "1 turn · leave with what you have",
      ),
    );
  }
  list.push(
    choice(
      "leave",
      "Abandon the sandwich mission",
      "1 turn · escape empty-handed",
    ),
  );
  return list;
}

export function observe(state: GameState): Observation {
  const room = rooms[state.room];
  return {
    ...state,
    patrol: state.room === 1 ? state.patrol : null,
    ...room,
    clue: state.inspected ? room.clue : "",
    choices: choices(state),
  };
}

function enter(state: GameState, room: 1 | 2): void {
  state.room = room;
  state.inspected = false;
  state.distracted = false;
}

function guardTurn(state: GameState, action: Action): void {
  switch (action) {
    case "gadget":
      state.gadgets--;
      state.distracted = true;
      state.message =
        "The guard discovers Form 27B. You have become administratively invisible.";
      break;
    case "vent":
      state.turns--;
      enter(state, 2);
      state.message = "Two turns in a vent. Zero forms completed.";
      break;
    case "sneak":
      if (state.patrol === "reading" || state.distracted) {
        enter(state, 2);
        state.message = "You slip past while the guard audits a staple.";
      } else {
        state.alarm += 2;
        state.message =
          "Caught mid-sneak. The guard stamps your forehead: SUSPICIOUS (+2 alarm).";
      }
      break;
    case "wait":
      state.message = "You wait. The guard changes patrol phase.";
      break;
    default:
      throw new GameActionError("Unsupported guard action.");
  }
}

function extractionTurn(state: GameState, action: Action): void {
  switch (action) {
    case "take":
      state.sandwich = true;
      state.alarm += 2;
      state.message =
        "Sandwich acquired. The pressure plate objects loudly (+2 alarm).";
      break;
    case "gadget":
      state.gadgets--;
      state.sandwich = true;
      state.message =
        "A decoy takes the sandwich's desk job. Clean extraction.";
      break;
    case "swap":
      state.sandwich = true;
      state.message =
        "You substitute a paperweight. Museum security cannot tell lunch from office supplies.";
      break;
    case "exit":
      state.outcome = state.sandwich ? "escaped" : "empty-handed";
      state.message = state.sandwich
        ? "You escaped with the legendary sandwich. History tastes like mustard."
        : "You escaped. The sandwich remains tragically employed.";
      break;
    default:
      throw new GameActionError("Unsupported extraction action.");
  }
}

function applyAction(state: GameState, action: Action): void {
  if (action === "leave") {
    state.outcome = "empty-handed";
    state.message =
      "You escape without lunch. Cowardice is technically gluten-free.";
  } else if (action === "inspect") {
    state.inspected = true;
    state.message = rooms[state.room].clue;
  } else if (state.room === 0) {
    if (action === "door") {
      state.outcome = "trapped";
      state.message =
        "The Door Was Painted. You sprinted into a fresco. The museum acquires a new face-print.";
    } else {
      enter(state, 1);
      state.message =
        "The modest archway was, embarrassingly, an actual opening.";
    }
  } else if (state.room === 1) guardTurn(state, action);
  else extractionTurn(state, action);
}

export function transition(previous: GameState, input: unknown): GameState {
  const action = actionSchema.parse(input);
  if (!choices(previous).some((entry) => entry.action === action))
    throw new GameActionError("Action unavailable in this state.");
  const state = { ...previous, turns: previous.turns - 1 };
  applyAction(state, action);
  if (previous.room === 1)
    state.patrol = previous.patrol === "reading" ? "watching" : "reading";
  enforceBudget(state);
  return state;
}

export function replay(
  scenario: Scenario,
  actions: readonly Action[],
): GameState[] {
  if (actions.length > 10) throw new Error("Run exceeds turn budget.");
  const states = [initialState(scenario)];
  for (const action of actions)
    states.push(transition(states[states.length - 1], action));
  return states;
}
