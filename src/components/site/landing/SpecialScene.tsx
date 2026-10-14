"use client";
import type { CharacterId } from "../../../domain/characters/definitions";
import { moveTreatments } from "../../../domain/combat/presentation/moves";
import { RenderedArt, CompanionArt } from "../../combat/rendered/RenderedArt";
import { MoveEffect } from "../../combat/MoveEffect";

export type PreviewPhase = "anticipation" | "action" | "recovery";
export default function SpecialScene({
  id,
  phase,
  hit,
}: {
  id: CharacterId;
  phase: PreviewPhase;
  hit: number;
}) {
  const treatment = moveTreatments[id].special;
  const pose =
    phase === "anticipation"
      ? "windup"
      : phase === "action"
        ? treatment.delivery === "heal"
          ? "guard"
          : "strike"
        : "idle";
  return (
    <div
      className={`ability-scene ability-${phase} delivery-${treatment.delivery}`}
      data-preview-phase={phase}
    >
      <div className="dossier-fighter">
        <RenderedArt id={id} pose={pose} />
      </div>
      <div className="dossier-companion">
        <CompanionArt id={id} phase={phase} hit={hit} />
      </div>
      {phase === "action" && <MoveEffect treatment={treatment} hit={hit} />}
    </div>
  );
}
