import { tacticsFor } from "../game/tactical/contracts";
import type { SkillAction } from "../characters/definitions";
import type { GameState } from "../game/contracts";
import { observe as legacyObserve } from "../game/legacy";
export function applyStarter(state: GameState, action: SkillAction): boolean {
  const t = tacticsFor(state);
  switch (action) {
    case "skill-peek":
      state.inspected = true;
      state.message = `Peek: ${legacyObserve(state).clue}`;
      return true;
    case "skill-spare":
      state.gadgets++;
      t.consumed--;
      state.message =
        "Spare Parts: one used decoy is back in service. Inventory: one.";
      return true;
    case "skill-shortcut":
      state.room = 2;
      state.inspected = false;
      state.distracted = false;
      state.turns--;
      state.message =
        "Shortcut: the discovered vent takes one turn. Your knees will file a complaint.";
      return true;
    case "skill-calm":
      state.alarm--;
      state.message =
        "Calm Down: one alarm level settles. The museum agrees to use its indoor voice.";
      return true;
    default:
      return false;
  }
}
