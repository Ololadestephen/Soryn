import type { CharacterId } from "../characters/definitions";
import type { ArenaId } from "../combat/arenas";
import type { Difficulty } from "../combat/contracts";

export const STORY_POLICY = "story/fractured-sanctuary/1" as const;

export const STORY_STARTERS = ["pip", "bolt", "patch", "moss"] as const;

export type StoryRoute = "grove" | "foundry";
export type StoryStep =
  "meet" | "scout" | "route" | "path" | "guardian" | "boss" | "ending";

export interface StoryEncounter {
  step: "scout" | "path" | "guardian" | "boss";
  opponent: CharacterId;
  difficulty: Difficulty;
  arena: ArenaId;
  objective: string;
}

const STARTER_ORDER: CharacterId[] = ["pip", "bolt", "patch", "moss"];

function pick(fighter: CharacterId, prefer: CharacterId, avoid: CharacterId[]) {
  if (prefer !== fighter && !avoid.includes(prefer)) return prefer;
  const next = STARTER_ORDER.find(
    (id) => id !== fighter && !avoid.includes(id),
  );
  if (!next) throw new Error("Story encounter has no remaining starter.");
  return next;
}

export function storyEncounter(
  fighter: CharacterId,
  step: StoryStep,
  route: StoryRoute | null,
): StoryEncounter | null {
  const scout = pick(fighter, "bolt", []);
  if (step === "scout")
    return {
      step,
      opponent: scout,
      difficulty: "easy",
      arena: "sanctuary",
      objective: "Use an attack, then Defence, and watch the exchange resolve.",
    };
  if (step === "path" && route === "grove") {
    const opponent = pick(fighter, "moss", [scout]);
    return {
      step,
      opponent,
      difficulty: "medium",
      arena: "grove",
      objective:
        "Hold the grove. Defence matters more than rushing the knockout.",
    };
  }
  if (step === "path" && route === "foundry") {
    const opponent = pick(fighter, "patch", [scout]);
    return {
      step,
      opponent,
      difficulty: "medium",
      arena: "foundry",
      objective: "Press the foundry. Spend attacks before the line closes.",
    };
  }
  if (step === "guardian" && route) {
    const path = storyEncounter(fighter, "path", route);
    return {
      step,
      opponent: pick(fighter, "pip", [scout, path?.opponent ?? scout]),
      difficulty: "medium",
      arena: "sky",
      objective:
        "Save energy for the companion special, then spend it when the cooldown is ready.",
    };
  }
  if (step === "boss")
    return {
      step,
      opponent: scout,
      difficulty: "hard",
      arena: "sanctuary",
      objective: "The sanctuary guardian uses the harder battle policy.",
    };
  return null;
}

export const STORY_COPY = {
  fiction: "Soryn fiction. This chapter is not official Monad or Chog canon.",
  title: "The Fractured Sanctuary",
  premise:
    "The bonds between fighters and companions are weakening. Your pair enters the Sanctuary to discover why its guardians have turned against one another.",
  meet: [
    "The sanctuary doors are open. The guardians inside are not waiting to talk.",
    "Choose a starter. Their companion is still with them.",
  ],
  scout: [
    "A scout blocks the first court.",
    "Attack when the line is open. Defence keeps you standing for the reply.",
  ],
  route: [
    "The court splits.",
    "The grove is slower and punishes a rushed exchange.",
    "The foundry is tighter and rewards pressing first.",
  ],
  guardian: [
    "A guardian holds the high air.",
    "Energy refills between rounds. The companion special spends it and then waits out its cooldown.",
  ],
  boss: [
    "The sanctuary’s own guardian has turned around.",
    "Win this battle to finish the chapter.",
  ],
  ending: {
    grove:
      "The grove keeper stands down. The sanctuary remembers that you gave the slow path time.",
    foundry:
      "The foundry keeper stands down. The sanctuary remembers that you forced the tight path open.",
  },
  loss: "The battle is lost. Retry this encounter. The chapter stays where it is.",
  replay:
    "Replaying starts the chapter again. The first completion stays on this guest.",
} as const;
