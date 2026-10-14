import type { CombatSnapshot, CombatState } from "./contracts";
import { choosePublicMove } from "./legacyPolicy";
import { easyChoice } from "./difficulty/easy";
import { mediumChoice } from "./difficulty/medium";
import { hardChoice } from "./difficulty/hard";
import type { CompletedChoices, OpponentChoice } from "./difficulty/contracts";
export { choosePublicMove } from "./legacyPolicy";
export function chooseOpponent(
  snapshot: CombatSnapshot,
  state: CombatState,
  completed: readonly CompletedChoices[] = [],
): OpponentChoice {
  if (snapshot.policy === "combat-opponent/1")
    return choosePublicMove(snapshot, state, "opponent");
  if (snapshot.policy === "combat-pvp/1")
    throw new Error("Private matches resolve two submitted moves.");
  switch (snapshot.difficulty) {
    case "easy":
      return easyChoice(snapshot, state);
    case "medium":
      return mediumChoice(snapshot, state);
    case "hard":
      return hardChoice(snapshot, state, completed);
  }
}
export { difficultyLabel } from "./difficulty/contracts";
