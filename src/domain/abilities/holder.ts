import { tacticsFor } from "../game/tactical/contracts";
import type { SkillAction } from "../characters/definitions";
import type { GameState } from "../game/contracts";
import { observe as legacyObserve } from "../game/legacy";
import { mechanismClues } from "../game/tactical/clues";
function passGuard(state: GameState, message: string) {
  state.room = 2;
  state.inspected = false;
  state.distracted = false;
  state.turns--;
  state.message = message;
}
export function applyHolder(state: GameState, action: SkillAction): void {
  const t = tacticsFor(state);
  switch (action) {
    case "skill-bubble":
      t.effects.bubble = true;
      state.message =
        "Safety Bubble armed for one painted-door impact or caught patrol in this room. Closing time and other alarms still count.";
      break;
    case "skill-trail":
      t.effects.trail = 2;
      state.message =
        "False Trail: the guard follows an imaginary curator for the next two spent guard turns. Your decoy stays in your pocket.";
      break;
    case "skill-shadow":
      passGuard(
        state,
        "Shadow Step: one patrol crossed, no alarm. Even your shadow refuses to fill out forms.",
      );
      break;
    case "skill-lens":
      state.inspected = true;
      t.mechanismKnown = true;
      state.message = `Truth Lens: ${legacyObserve(state).clue} ${mechanismClues[state.room]}`;
      break;
    case "skill-steady":
      t.effects.steady = true;
      state.message =
        "Steady Hands ready. Grab the sandwich separately; the plate will stay quiet.";
      break;
    case "skill-reroute":
      t.effects.reroute = true;
      state.message =
        "Reroute: the current mechanism is disabled for your next ordinary action. Crossing or grabbing still takes a turn.";
      break;
    case "skill-breakthrough":
      state.alarm++;
      passGuard(
        state,
        "Breakthrough: the discovered delivery hatch opens. One turn and +1 alarm. Subtlety has left the building.",
      );
      break;
    case "skill-second-thought":
      t.pending = null;
      state.message =
        "Second Thought: committed choice cancelled before resolution. The charge and commitment remain in your history; no outcome was undone.";
      break;
    default:
      throw new Error("Unsupported ability.");
  }
}
