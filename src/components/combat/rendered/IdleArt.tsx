"use client";
import Image from "next/image";
import { useImageFailure } from "./useImageFailure";
import {
  character,
  type CharacterId,
} from "../../../domain/characters/definitions";
import { companions } from "./catalogue";
import assets from "./assets.json";

export function IdleArt({
  id,
  companion = false,
  loading = "eager",
}: {
  id: CharacterId;
  companion?: boolean;
  loading?: "lazy" | "eager";
}) {
  const { ref, failed } = useImageFailure();
  const a = assets[id][companion ? "companion" : "fighter"];
  const label = companion
    ? `${companions[id]} companion`
    : `${character(id).name} rendered fighter`;
  return (
    <svg
      className="landing-idle-art"
      role="img"
      aria-label={label}
      viewBox={`0 0 ${a.canvas[0]} ${a.canvas[1]}`}
      preserveAspectRatio="xMidYMax meet"
      data-art-source={failed ? "unavailable" : "approved-idle"}
    >
      {failed && (
        <text
          x={a.canvas[0] / 2}
          y={a.canvas[1] / 2}
          textAnchor="middle"
          fontSize={a.canvas[0] / 20}
          fill="currentColor"
        >
          Artwork unavailable
        </text>
      )}
      <foreignObject
        x={a.offset[0]}
        y={a.offset[1]}
        width={a.width}
        height={a.height}
        visibility={failed ? "hidden" : "visible"}
      >
        <Image
          unoptimized
          loading={loading}
          ref={ref}
          src={a.path}
          alt=""
          width={a.width}
          height={a.height}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </foreignObject>
    </svg>
  );
}
