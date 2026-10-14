"use client";

import { useState } from "react";
import type { Observation } from "../../domain/game/contracts";
import { Stage } from "./Stage";

export function Replay({ frames }: { frames: Observation[] }) {
  const [index, setIndex] = useState(0);
  const frame = frames[index];
  return (
    <div className="replay">
      <p className="eyebrow">
        Exact recorded replay · {index} / {frames.length - 1} actions
      </p>
      <Stage
        tactics={frame.tactics}
        room={frame.room}
        sandwich={frame.sandwich}
        trapped={frame.outcome === "trapped"}
      />
      <p>{frame.message}</p>
      <p className="muted">
        Room {frame.room + 1} · {frame.turns} turns left · alarm {frame.alarm}
      </p>
      <div className="button-row">
        <button
          className="secondary"
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
        >
          Previous turn
        </button>
        <button
          className="secondary"
          disabled={index === frames.length - 1}
          onClick={() => setIndex(index + 1)}
        >
          Next turn
        </button>
      </div>
    </div>
  );
}
