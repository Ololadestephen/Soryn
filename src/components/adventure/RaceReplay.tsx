"use client";

import { useId, useState } from "react";
import type { Observation } from "../../domain/game/contracts";
import { frameAtTurn } from "../../domain/ghosts/timeline";
import { Stage } from "./Stage";

function RaceLane({
  frames,
  turn,
  label,
  ghost = false,
  reasons,
}: {
  frames: Observation[];
  turn: number;
  label: string;
  ghost?: boolean;
  reasons?: string[];
}) {
  const { frame, actionIndex, inTransit } = frameAtTurn(frames, turn);
  const turnsUsed = 10 - frame.turns;
  return (
    <div className="race-lane">
      <h4>{label}</h4>
      <Stage
        tactics={frame.tactics}
        room={frame.room}
        sandwich={frame.sandwich}
        trapped={frame.outcome === "trapped"}
        ghost={ghost}
      />
      <p className="race-stats">
        {frame.outcome ?? `Room ${frame.room + 1}`} · {turnsUsed}{" "}
        {turnsUsed === 1 ? "turn" : "turns"} used · {frame.alarm} alarm
      </p>
      <p>
        {inTransit
          ? "Still in the service vent. This move takes two turns; the next room appears when it finishes."
          : frame.message}
      </p>
      {ghost && (
        <p className="muted">
          {actionIndex === 0
            ? "Same starting scenario. An independent strategy, not a copied replay."
            : reasons?.[actionIndex - 1]}
        </p>
      )}
    </div>
  );
}

export function RaceReplay({
  player,
  ghost,
  reasons,
  playerLabel = "You",
  ghostLabel = "Frozen ghost",
}: {
  player: Observation[];
  ghost: Observation[];
  reasons: string[];
  playerLabel?: string;
  ghostLabel?: string;
}) {
  const [turn, setTurn] = useState(0);
  const id = useId();
  const lastTurn = Math.max(
    player[0].turns - player[player.length - 1].turns,
    ghost[0].turns - ghost[ghost.length - 1].turns,
  );
  return (
    <div className="race-replay">
      <div className="race-clock">
        <label htmlFor={id}>Race timeline</label>
        <p role="status" aria-atomic="true">
          Turn {turn} of {lastTurn}
        </p>
        <input
          id={id}
          type="range"
          min={0}
          max={lastTurn}
          step={1}
          value={turn}
          onChange={(event) => setTurn(Number(event.target.value))}
          aria-valuetext={`Turn ${turn} of ${lastTurn}`}
        />
        <div className="button-row">
          <button
            className="secondary"
            disabled={turn === 0}
            onClick={() => setTurn(turn - 1)}
          >
            Previous race turn
          </button>
          <button
            className="secondary"
            disabled={turn === lastTurn}
            onClick={() => setTurn(turn + 1)}
          >
            Next race turn
          </button>
          <button
            className="secondary"
            disabled={turn === lastTurn}
            onClick={() => setTurn(lastTurn)}
          >
            Show finish
          </button>
        </div>
      </div>
      <div className="race-lanes">
        <RaceLane frames={player} turn={turn} label={playerLabel} />
        <RaceLane
          frames={ghost}
          turn={turn}
          label={ghostLabel}
          ghost
          reasons={reasons}
        />
      </div>
      <p className="muted">
        Both lanes start from the same frozen scenario. Two-turn moves finish on
        their second turn; zero-turn preparations share a clock tick. Exact
        recorded replay keeps every ability and commitment event. Finished lanes
        hold their final state.
      </p>
    </div>
  );
}
