import type { CharacterId } from "../../characters/definitions";
import type { Move } from "../contracts";

export interface MoveTreatment {
  key: string;
  delivery: "melee" | "ranged" | "heal" | "guard";
  shape:
    | "stone"
    | "lens"
    | "fist"
    | "parcel"
    | "tool"
    | "gear"
    | "leaf"
    | "bloom"
    | "shield"
    | "slash"
    | "needle"
    | "orb"
    | "mask"
    | "dart"
    | "spectrum"
    | "spark"
    | "circuit"
    | "flame"
    | "memory";
  anticipation: "aim" | "wind" | "crouch" | "prepare";
}
function kit(
  id: CharacterId,
  basic: Omit<MoveTreatment, "key">,
  special: Omit<MoveTreatment, "key">,
): Record<Move, MoveTreatment> {
  return {
    basic: { ...basic, key: `${id}-basic` },
    special: { ...special, key: `${id}-special` },
    guard: {
      key: `${id}-guard`,
      delivery: "guard",
      shape: id === "nyx" ? "slash" : id === "echo" ? "mask" : "shield",
      anticipation: "prepare",
    },
  };
}
function ranged(shape: MoveTreatment["shape"]): Omit<MoveTreatment, "key"> {
  return { delivery: "ranged", shape, anticipation: "aim" };
}
function melee(
  shape: MoveTreatment["shape"],
  anticipation: MoveTreatment["anticipation"] = "wind",
): Omit<MoveTreatment, "key"> {
  return { delivery: "melee", shape, anticipation };
}
export const moveTreatments: Record<
  CharacterId,
  Record<Move, MoveTreatment>
> = {
  pip: kit("pip", ranged("stone"), ranged("lens")),
  bolt: kit("bolt", melee("fist", "crouch"), melee("parcel", "crouch")),
  patch: kit("patch", ranged("tool"), {
    delivery: "heal",
    shape: "gear",
    anticipation: "prepare",
  }),
  moss: kit("moss", ranged("leaf"), ranged("bloom")),
  aegis: kit("aegis", melee("fist"), melee("shield")),
  nyx: kit("nyx", melee("slash", "crouch"), melee("needle", "crouch")),
  echo: kit("echo", ranged("orb"), ranged("mask")),
  prism: kit("prism", ranged("dart"), ranged("spectrum")),
  atlas: kit("atlas", melee("fist"), melee("parcel")),
  flux: kit("flux", ranged("spark"), ranged("circuit")),
  ember: kit("ember", melee("fist", "crouch"), melee("flame")),
  mneme: kit("mneme", ranged("orb"), ranged("memory")),
};
