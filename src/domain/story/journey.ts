import { z } from "zod";
import type { CharacterId } from "../characters/definitions";
import { accessGrantSchema, type AccessGrant } from "../access/policy";
export const JOURNEY_POLICY = "sanctuary-journey/2" as const;
export const journeySchema = z.strictObject({
  policy: z.literal(JOURNEY_POLICY),
  runId: z.uuid(),
  stage: z.enum([
    "intro",
    "shrine",
    "battle",
    "crossroads",
    "tracks",
    "bridge",
    "vow",
    "seal",
    "ending",
    "side",
  ]),
  visited: z.array(z.string()).max(16),
  viewed: z.array(z.string()).max(16),
  clues: z.array(z.string()).max(8),
  vow: z.enum(["restore", "preserve"]).nullable(),
  sideComplete: z.boolean(),
  interaction: z
    .strictObject({
      id: z.uuid(),
      expiresAt: z.number(),
      access: accessGrantSchema.nullable(),
    })
    .nullable(),
  feedback: z.string().max(350),
});
export type Journey = z.infer<typeof journeySchema>;
export type JourneyStage = Journey["stage"];
export function freshJourney(id: string): Journey {
  return {
    policy: JOURNEY_POLICY,
    runId: id,
    stage: "intro",
    visited: [],
    viewed: [],
    clues: [],
    vow: null,
    sideComplete: false,
    interaction: null,
    feedback: "",
  };
}
export const COMPANION_CONTRIBUTION: Record<CharacterId, string> = {
  pip: "Owl circles once and spots the missing link in the pattern.",
  bolt: "Cheetah follows the safe line, then returns to guide you.",
  patch: "Mechanical beetle traces the joints and taps the stable ones.",
  moss: "Tortoise tests the ground patiently and marks the firm route.",
  aegis: "Armadillo braces the loose stone so you can study it safely.",
  nyx: "Panther slips along the edge and finds the undisturbed marks.",
  echo: "Fox follows the returning sound and finds its source.",
  prism: "Peacock turns toward the light, revealing the faded pattern.",
  atlas: "Bear steadies the broken support while you examine the crossing.",
  flux: "Electric eel lights the old channels without disturbing their order.",
  ember: "Phoenix lifts a gentle light above the weathered markings.",
  mneme: "Raven repeats the pattern it saw at the entrance.",
};
export interface InteractionOption {
  id: string;
  label: string;
}
export interface InteractionSpec {
  title: string;
  prompt: string;
  inspections: InteractionOption[];
  answers: InteractionOption[];
  clue: string;
  answer: string;
}
export function interactionSpec(
  stage: JourneyStage,
  vow: Journey["vow"],
): InteractionSpec | null {
  if (stage === "shrine")
    return {
      title: "The broken listening shrine",
      prompt:
        "The outer ring has slipped. Find two clues before choosing how to repair it.",
      inspections: [
        { id: "runes", label: "Inspect the ring markings" },
        { id: "companion", label: "Ask your companion to investigate" },
      ],
      answers: [
        { id: "align", label: "Align the broken ring with the returning echo" },
        { id: "force", label: "Push both halves straight together" },
      ],
      clue: "The markings curve back toward the entrance. The returning echo completes the circle.",
      answer: "align",
    };
  if (stage === "tracks")
    return {
      title: "Tracks through Echo Grove",
      prompt:
        "A small companion crossed here. Find the safe route to its shelter.",
      inspections: [
        { id: "prints", label: "Compare the tracks beside the water" },
        { id: "companion", label: "Ask your companion to scout" },
      ],
      answers: [
        { id: "bank", label: "Follow the shallow riverbank" },
        { id: "ridge", label: "Climb the exposed ridge" },
      ],
      clue: "Small, unhurried prints continue beside the shallow water. The ridge marks are old and wind-worn.",
      answer: "bank",
    };
  if (stage === "bridge")
    return {
      title: "The foundry crossing",
      prompt:
        "Bolt has crossed ahead. The bridge will carry you if its supports share the weight.",
      inspections: [
        { id: "ropes", label: "Inspect the two support ropes" },
        { id: "companion", label: "Ask your companion to test the supports" },
      ],
      answers: [
        { id: "brace", label: "Brace both ropes and use the supported planks" },
        { id: "leap", label: "Use the broken centre plank" },
      ],
      clue: "The outer ropes remain sound. The centre plank has no support beneath it.",
      answer: "brace",
    };
  if (stage === "seal")
    return {
      title: "The high gate",
      prompt:
        vow === "restore"
          ? "The restored shrine sends a soft echo up the steps. Let it reach the seal."
          : "The seed you kept can light the unresponsive seal. Its light will be spent here.",
      inspections: [
        { id: "companion", label: "Ask your companion to read the seal" },
      ],
      answers: [
        { id: "echo", label: "Guide the restored shrine's echo" },
        { id: "lantern", label: "Light the seal with the saved seed" },
      ],
      clue:
        vow === "restore"
          ? "A living connection already reaches the gate; it needs no new flame."
          : "Without a restored connection, the seed's light is the safe way through.",
      answer: vow === "restore" ? "echo" : "lantern",
    };
  if (stage === "side")
    return {
      title: "Optional · the echo nook",
      prompt:
        "One small bell never answered the others. Help your companion give it a voice.",
      inspections: [
        { id: "listen", label: "Listen for the missing note" },
        { id: "companion", label: "Invite your companion into the duet" },
      ],
      answers: [
        { id: "return", label: "Return the quiet note after your companion" },
        { id: "drown", label: "Ring every bell at once" },
      ],
      clue: "The quiet bell answers after the others. Leave a space for it.",
      answer: "return",
    };
  return null;
}
export function enterJourney(
  journey: Journey,
  stage: JourneyStage,
  completed?: string,
) {
  if (completed && !journey.visited.includes(completed))
    journey.visited.push(completed);
  journey.stage = stage;
  journey.clues = [];
  journey.interaction = null;
  journey.feedback = "";
}
export class JourneyActionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "JourneyActionError";
  }
}

/** Returns solved only after explicit inspection/answer; wrong answers never punish input speed. */
export function interactJourney(
  journey: Journey,
  fighter: CharacterId,
  action: string,
): boolean {
  const spec = interactionSpec(journey.stage, journey.vow);
  if (!spec)
    throw new JourneyActionError("This location is not an interaction.");
  if (spec.inspections.some((option) => option.id === action)) {
    if (!journey.clues.includes(action)) journey.clues.push(action);
    journey.feedback =
      action === "companion" ? COMPANION_CONTRIBUTION[fighter] : spec.clue;
    return false;
  }
  if (!spec.answers.some((option) => option.id === action))
    throw new JourneyActionError("That action is not available here.");
  if (!spec.inspections.every((option) => journey.clues.includes(option.id))) {
    journey.feedback = "Look for the clues first. Your companion can help.";
    return false;
  }
  if (action !== spec.answer) {
    journey.feedback = `That does not fit the clues. ${spec.clue}`;
    return false;
  }
  journey.feedback = "The path answers. Your pair can continue.";
  return true;
}
export function endingMemory(
  route: "grove" | "foundry" | null,
  vow: Journey["vow"],
) {
  return `${route === "grove" ? "You found the stranded companion before pursuing Bolt. Moss remembers the shelter you chose to protect." : "You caught up with Bolt through the foundry. He learned that moving first still means making a safe path for those behind."} ${vow === "restore" ? "You restored the listening shrine. Its living echo opened the high gate, and the sanctuary's bonds can grow again." : "You kept the seed, then spent its light at the high gate. The sanctuary is safe tonight; restoring its living connection is work for another dawn."}`;
}
export function journeyDialogue(
  journey: Pick<Journey, "stage" | "vow">,
  step: string,
  route: string | null,
): { speaker: string; lines: string[] } {
  const stage = journey.stage;
  if (stage === "intro" || stage === "shrine")
    return {
      speaker: "Moss · guide",
      lines: [
        "A bond is a conversation. Listen before you try to mend it.",
        "Bolt wants to reach the inner court first. I want everyone to reach it together.",
      ],
    };
  if (stage === "crossroads")
    return {
      speaker: "Bolt · rival",
      lines: [
        "The guardian is ahead. Every moment we wait gives it another chance to close the court.",
        "Moss heard a companion calling in the grove. I am taking the foundry crossing. You choose who needs you first.",
      ],
    };
  if (stage === "vow" || stage === "seal")
    return {
      speaker: "Moss · guide",
      lines: [
        "This seed can restore the shrine's living connection, or stay with you as a light for the gate.",
        journey.vow === "restore"
          ? "The shrine is listening again. Follow its echo."
          : journey.vow === "preserve"
            ? "You kept the light. Use it carefully; there will be no living echo to open the gate."
            : "The choice changes how we cross the high gate, and what remains after the guardian falls.",
      ],
    };
  if (stage === "ending")
    return {
      speaker: "Moss and Bolt",
      lines: [
        endingMemory(route === "grove" ? "grove" : "foundry", journey.vow),
        route === "grove"
          ? "Bolt: I thought we had to race. You brought someone home."
          : "Bolt: I reached the court first. You made reaching it mean something.",
      ],
    };
  if (stage === "side")
    return {
      speaker: "Moss · guide",
      lines: [
        "The chapter is safe. This last quiet bell is optional. Shall we listen together?",
      ],
    };
  return {
    speaker: step === "boss" ? "Bolt · rival" : "Moss · guide",
    lines: [
      step === "boss"
        ? "I will hold the door. You and your companion finish this together."
        : route === "grove"
          ? "The rescued companion is safe. The grove keeper will test your patience."
          : "The crossing is steady. The foundry keeper will test your resolve.",
    ],
  };
}
export const interactionGrantLifetime = 5 * 60_000;
export function bindInteraction(
  journey: Journey,
  access: AccessGrant | null,
  now: number,
  id: string,
) {
  journey.interaction = {
    id,
    access,
    expiresAt: now + interactionGrantLifetime,
  };
}
