import type { GameState } from "../game/contracts";
import type { SkillAction } from "../characters/definitions";
import { skillEligible } from "./eligibility";
import { applyStarter } from "./starter";
import { applyHolder } from "./holder";
export function applySkill(state: GameState, action: SkillAction): void {
  if (!state.tactics || !skillEligible(state, action))
    throw new Error(
      "Ability unavailable for this character, target or charge budget.",
    );
  state.tactics.charges--;
  if (!applyStarter(state, action)) applyHolder(state, action);
}
