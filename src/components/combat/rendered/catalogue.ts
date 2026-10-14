import type { CharacterId } from "../../../domain/characters/definitions";
import type atlasData from "./atlas-data.json";
export type AtlasKey = keyof typeof atlasData;
export const companions: Record<CharacterId, string> = {
  pip: "Owl",
  bolt: "Cheetah",
  patch: "Mechanical beetle",
  moss: "Tortoise",
  aegis: "Armadillo",
  nyx: "Panther",
  echo: "Fox",
  prism: "Peacock",
  atlas: "Bear",
  flux: "Electric eel",
  ember: "Phoenix",
  mneme: "Raven",
};
export const renderedFighters: Record<
  CharacterId,
  { fighter: AtlasKey; companion: AtlasKey; companionStart: number }
> = {
  pip: { fighter: "pip", companion: "pip-pet", companionStart: 0 },
  bolt: { fighter: "bolt", companion: "bolt-pet", companionStart: 0 },
  patch: { fighter: "patch", companion: "patch-pet", companionStart: 0 },
  moss: { fighter: "moss", companion: "moss-pet", companionStart: 0 },
  aegis: { fighter: "aegis", companion: "armadillo-pet", companionStart: 0 },
  nyx: { fighter: "nyx", companion: "nyx-pet", companionStart: 0 },
  echo: { fighter: "echo", companion: "echo-pet", companionStart: 0 },
  prism: { fighter: "prism", companion: "prism-pet", companionStart: 0 },
  atlas: { fighter: "atlas", companion: "atlas-pet", companionStart: 0 },
  flux: { fighter: "flux", companion: "flux-pet", companionStart: 0 },
  ember: { fighter: "ember", companion: "phoenix-pet", companionStart: 0 },
  mneme: { fighter: "mneme", companion: "mneme-pet", companionStart: 0 },
};
