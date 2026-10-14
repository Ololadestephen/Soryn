import type { CombatState, Side } from "../../../domain/combat/contracts";
import type { CombatPresentation } from "../playback";
import type { RenderPose } from "./assets";

export function fighterPose(
  state: CombatState,
  frame: CombatPresentation | null,
  side: Side,
): RenderPose {
  if (state[side].health === 0) return "defeated";
  if (!frame) return "idle";
  if (state[side].health < frame.previous[side].health) return "hit";
  if (frame.event.side === side) {
    if (frame.phase === "anticipation") return "windup";
    if (frame.event.kind === "heal") return "windup";
    if (["action", "impact"].includes(frame.phase ?? "")) {
      if (frame.event.move === "basic") return "windup";
      if (frame.treatment) return "strike";
    }
  }
  return frame.guarding.includes(side) ? "guard" : "idle";
}
