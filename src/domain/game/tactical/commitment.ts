import { tacticsFor } from "./contracts";
import type { Action, Choice, GameState } from "../contracts";
import type { CommittedAction } from "./contracts";
const dangerous = ["door", "sneak", "take"] as const;
export function commitmentChoices(
  state: GameState,
  choices: Choice[],
): Choice[] {
  const t = tacticsFor(state);
  if (t.pending)
    return [
      {
        action: "resolve-choice",
        label: "Confirm committed choice",
        hint: `Resolve ${t.pending} now · 1 turn · cannot cancel after resolution`,
      },
    ];
  if (t.loadout.characterId !== "mneme") return choices;
  return choices.map((choice) =>
    dangerous.includes(choice.action as CommittedAction)
      ? {
          ...choice,
          action: `commit-${choice.action}` as Action,
          label: `Commit: ${choice.label}`,
          hint: "0 turns · outcome unresolved until Confirm · Second Thought can cancel",
        }
      : choice,
  );
}
export function commit(state: GameState, action: Action): boolean {
  if (!action.startsWith("commit-")) return false;
  const t = tacticsFor(state);
  t.pending = action.slice(7) as CommittedAction;
  state.message = `Committed ${t.pending}. No outcome has resolved. Confirm it, or spend Second Thought to cancel.`;
  return true;
}
