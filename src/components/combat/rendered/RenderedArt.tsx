import { deliveryPath } from "./delivery";
import type { CharacterId } from "../../../domain/characters/definitions";
import { useId, useState } from "react";
import {
  atlases,
  companions,
  poseCells,
  renderedFighters,
  type AtlasKey,
  type RenderPose,
} from "./assets";

function AtlasViewport({
  atlas,
  cell,
  label,
  className,
  pose,
  hit,
  settled,
  preview,
}: {
  atlas: AtlasKey;
  cell: number;
  label: string;
  className: string;
  pose: string;
  hit?: number;
  settled?: boolean;
  preview?: boolean;
}) {
  const asset = atlases[atlas];
  const [failed, setFailed] = useState(0);
  const clipId = useId();
  const still = !failed && preview && "preview" in asset;
  const source =
    failed > 1
      ? asset.fallback
      : still
        ? asset.preview
        : failed
          ? asset
          : { ...asset, path: deliveryPath(asset.path) };
  const [x, y, width, height] = source.cells[still ? 0 : cell];
  const offset = failed > 1 ? [0, 0] : asset.offset;
  const canvas = failed > 1 ? [width, height] : asset.canvas;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${canvas[0]} ${canvas[1]}`}
      preserveAspectRatio="xMidYMax meet"
      className={className}
      data-pose={pose}
      data-hit={hit}
      data-facing="three-quarter-right"
      data-settled={settled || undefined}
      data-art-source={
        failed > 2 ? "unavailable" : failed > 1 ? "legacy-fallback" : "rendered"
      }
      style={{ overflow: "visible" }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={offset[0]} y={offset[1]} width={width} height={height} />
        </clipPath>
      </defs>
      {failed > 2 ? (
        <text
          x={canvas[0] / 2}
          y={canvas[1] / 2}
          textAnchor="middle"
          fill="#fff4e6"
          fontSize={canvas[0] / 18}
        >
          Artwork unavailable
        </text>
      ) : (
        <g clipPath={`url(#${clipId})`}>
          <image
            href={source.path}
            x={offset[0] - x}
            y={offset[1] - y}
            width={source.width}
            height={source.height}
            onError={() => setFailed((n) => Math.min(3, n + 1))}
          />
        </g>
      )}
    </svg>
  );
}
export function RenderedArt({
  id,
  pose = "idle",
  preview = false,
}: {
  id: CharacterId;
  pose?: RenderPose;
  preview?: boolean;
}) {
  return (
    <AtlasViewport
      atlas={renderedFighters[id].fighter}
      cell={poseCells[pose]}
      label={`${id} original full-body fighter${pose === "defeated" ? ", knocked out" : ""}`}
      className={`rendered-art combat-art art-${id}`}
      pose={pose}
      preview={preview}
    />
  );
}
export function CompanionArt({
  id,
  phase = "idle",
  hit = 0,
  settled = false,
}: {
  id: CharacterId;
  phase?: "idle" | "anticipation" | "action" | "impact" | "recovery";
  hit?: number;
  settled?: boolean;
}) {
  const family = renderedFighters[id];
  const cell = settled
    ? 2
    : phase === "action" || phase === "impact"
      ? 1
      : phase === "recovery"
        ? 2
        : 0;
  return (
    <AtlasViewport
      atlas={family.companion}
      cell={family.companionStart + cell}
      label={`${companions[id]} companion`}
      className={`companion companion-${id} companion-${phase}`}
      pose={settled ? "settled" : phase}
      hit={hit}
      settled={settled}
    />
  );
}
