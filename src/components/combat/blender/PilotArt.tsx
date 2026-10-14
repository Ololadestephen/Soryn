import { useId, useState, type ReactNode } from "react";
import type { BattleView, Side } from "../../../domain/combat/contracts";
import type { CombatPresentation } from "../playback";
import {
  petSelection,
  pilotSelection,
  type PilotMemory,
  type PilotSelection,
} from "../../../domain/combat/presentation/blender";
import { RenderedArt, CompanionArt } from "../rendered/RenderedArt";
import { fighterPose } from "../rendered/pose";
import atlases from "./atlases.json";

interface Atlas {
  path: string;
  width: number;
  height: number;
  columns: number;
  count: number;
  frameWidth: number;
  frameHeight: number;
}
function position(asset: Atlas, frame: number) {
  return `translate(${-((frame % asset.columns) * asset.frameWidth)}px, ${-Math.floor(frame / asset.columns) * asset.frameHeight}px)`;
}

function PilotViewport({
  actor,
  selection,
  label,
  className,
  pose,
  fallback,
}: {
  actor: "aegis" | "armadillo";
  selection: PilotSelection;
  label: string;
  className: string;
  pose: string;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const clipId = useId().replace(/:/g, "");
  const [loaded, setLoaded] = useState<string[]>([]);
  const clips: Record<string, Atlas> = atlases[actor].clips;
  const asset = clips[selection.clip];
  if (failed || !asset) return fallback;
  const ready = loaded.includes(asset.path);
  const count = selection.last - selection.first + 1;
  const name = `pilot-${actor}-${selection.clip}-${selection.first}-${selection.last}`;
  const frames = Array.from(
    { length: count },
    (_, n) =>
      `${(n * 100) / count}%{transform:${position(asset, selection.first + n)}}`,
  ).join("");
  const css = `@keyframes ${name}{${frames}100%{transform:${position(asset, selection.last)}}}`;
  const representative =
    selection.clip === "idle"
      ? selection.first
      : selection.clip === "hit" || selection.clip === "guard-hit"
        ? Math.floor((selection.first + selection.last) / 2)
        : selection.last;
  return (
    <svg
      role="img"
      aria-label={label}
      className={className}
      viewBox={`0 0 ${asset.frameWidth} ${asset.frameHeight}`}
      preserveAspectRatio="xMidYMax meet"
      style={{ overflow: "hidden" }}
      data-pose={pose}
      data-facing="three-quarter-right"
      data-blender-pilot={ready ? actor : undefined}
      data-clip={selection.clip}
      data-cycle={selection.key}
    >
      <defs>
        <clipPath id={clipId}>
          <rect width={asset.frameWidth} height={asset.frameHeight} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {!ready && <g aria-hidden="true">{fallback}</g>}
        <style>{css}</style>
        <image
          key={selection.key}
          href={asset.path}
          width={asset.width}
          height={asset.height}
          className="pilot-sprite-image"
          visibility={ready ? "visible" : "hidden"}
          onLoad={() =>
            setLoaded((current) =>
              current.includes(asset.path) ? current : [...current, asset.path],
            )
          }
          onError={() => setFailed(true)}
          style={{
            transform: position(asset, representative),
            animation:
              count > 1
                ? `${name} ${selection.duration}ms steps(1,end) ${selection.loop ? "infinite" : "forwards"}`
                : "none",
          }}
        />
      </g>
    </svg>
  );
}

export function PilotFighter({
  battle,
  frame,
  side,
}: {
  battle: BattleView;
  frame: CombatPresentation | null;
  side: Side;
}) {
  const [memory, setMemory] = useState<PilotMemory>(() =>
    pilotSelection(null, battle, frame, side),
  );
  const next = pilotSelection(memory, battle, frame, side);
  if (next !== memory) setMemory(next);
  const pose = fighterPose(frame?.event.state ?? battle.state, frame, side);
  return (
    <PilotViewport
      actor="aegis"
      selection={next.selection}
      label={`aegis original full-body fighter${pose === "defeated" ? ", knocked out" : ""}`}
      className="rendered-art combat-art art-aegis"
      pose={pose}
      fallback={<RenderedArt id="aegis" pose={pose} />}
    />
  );
}

export function PilotCompanion({
  battle,
  frame,
  side,
  phase,
  hit,
}: {
  battle: BattleView;
  frame: CombatPresentation | null;
  side: Side;
  phase: "idle" | "anticipation" | "action" | "impact" | "recovery";
  hit?: number;
}) {
  return (
    <PilotViewport
      actor="armadillo"
      selection={petSelection(battle, frame, side)}
      label="Armadillo companion"
      className={`companion companion-aegis companion-${phase}`}
      pose={phase}
      fallback={<CompanionArt id="aegis" phase={phase} hit={hit} />}
    />
  );
}
