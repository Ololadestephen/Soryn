import type { CharacterId } from "../../characters/definitions";
import type { BattleView } from "../contracts";
import { frameDuration, type CombatPresentation } from "./project";

export type SoundCue =
  | "select"
  | "confirm"
  | "impact"
  | "block"
  | "brace"
  | "counter"
  | "heal"
  | "energy"
  | "knockout"
  | "victory"
  | "defeat"
  | "draw"
  | `special-${CharacterId}`;
function contactSounds(
  cue: NonNullable<CombatPresentation["cue"]>,
): SoundCue[] {
  if (cue.type === "heal") return cue.amount > 0 ? ["heal"] : [];
  if (cue.type === "counter") return ["counter"];
  if (!["hit", "block", "decoy"].includes(cue.type)) return [];
  const sounds: SoundCue[] = [];
  if (cue.shield > 0 || cue.decoy > 0) sounds.push("block");
  if (cue.amount > 0) sounds.push("impact");
  return sounds;
}
export function frameSounds(
  battle: BattleView,
  frame: CombatPresentation,
): SoundCue[] {
  const cue = frame.cue;
  if (frame.event.kind === "prepare") return ["brace"];
  if (frame.event.kind === "knockout") return ["knockout"];
  if (
    frame.event.kind === "recovery" &&
    ["player", "opponent"].some((side) => {
      const key = side as "player" | "opponent";
      return frame.event.state[key].energy > frame.previous[key].energy;
    })
  )
    return ["energy"];
  if (frame.phase !== "impact" || !cue) return [];
  const sounds = contactSounds(cue);
  if (
    sounds.length &&
    frame.event.move === "special" &&
    frame.event.side &&
    (frame.hit ?? 1) <= 1
  )
    sounds.push(`special-${battle.snapshot[frame.event.side].id}`);
  return sounds;
}
export function impactFeel(frame: CombatPresentation | null) {
  const cue = frame?.cue;
  const contact =
    frame?.phase === "impact" &&
    cue &&
    ["hit", "block", "counter", "decoy"].includes(cue.type);
  const strong = !!contact && frame?.event.move === "special";
  return {
    contact: !!contact,
    strong,
    stopMs: contact ? (strong ? 65 : 40) : 0,
    shakePx: contact && cue.amount > 0 ? (strong ? 3 : 1.5) : 0,
  };
}
export function feelDuration(frame: CombatPresentation, reduced: boolean) {
  if (reduced) return frame.phase === "impact" ? 200 : 100;
  if (frame.event.kind === "knockout") return 600;
  if (frame.phase === "anticipation")
    return frame.event.move === "special" ? 220 : 180;
  if (frame.phase === "action")
    return frame.event.move === "special" ? 320 : 260;
  if (frame.phase === "impact")
    return frame.event.kind === "counter"
      ? 360
      : frame.event.move === "special"
        ? 520
        : 420;
  if (frame.phase === "recovery") return 220;
  return frameDuration[frame.phase ?? "information"];
}
