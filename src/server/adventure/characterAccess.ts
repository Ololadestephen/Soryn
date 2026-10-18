import {
  character,
  type CharacterId,
  loadoutKey,
} from "../../domain/characters/definitions";
import {
  tacticalScenarioFor,
  type Scenario,
} from "../../domain/game/contracts";
import type { OfficialAuthority } from "../../domain/identity";
import { ServiceError } from "../errors";

export function selectScenario(
  seed: number,
  selection: CharacterId | undefined,
  authority: OfficialAuthority | null,
  frozen: Scenario | null,
): Scenario | null {
  if (frozen) {
    if (
      selection &&
      (frozen.rules !== "sandwich-rules/2" ||
        frozen.loadout.characterId !== selection)
    )
      throw new ServiceError(
        403,
        "A rematch must use its frozen character and charge budget.",
      );
    return frozen;
  }
  if (!selection) return null; // Explicit compatibility for existing v1 clients.
  if (character(selection).access === "holder" && !authority)
    throw new ServiceError(
      403,
      "This character requires a verified Chog owner, or its specific published museum challenge.",
    );
  return tacticalScenarioFor(seed, selection);
}
export function sameLoadout(a: Scenario, b: Scenario): boolean {
  return (
    a.rules === b.rules &&
    a.content === b.content &&
    a.generator === b.generator &&
    loadoutKey(a.rules === "sandwich-rules/2" ? a.loadout : undefined) ===
      loadoutKey(b.rules === "sandwich-rules/2" ? b.loadout : undefined)
  );
}
export function holderLoadout(scenario: Scenario): boolean {
  return (
    scenario.rules === "sandwich-rules/2" &&
    character(scenario.loadout.characterId).access === "holder"
  );
}
