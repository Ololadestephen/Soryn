"use client";

import { AbilityStatus } from "../characters/AbilityStatus";
import type { StepRequest } from "../../domain/requests";
import type { RunView } from "../../domain/views";

type Props = {
  run: RunView | null;
  busy: boolean;
  mutate: (input: StepRequest) => Promise<void>;
  start: (exhibitId?: string | null, retryOf?: string | null) => void;
  official?: boolean;
};

export function Controls({
  run,
  busy,
  mutate,
  start,
  official = false,
}: Props) {
  const observation = run?.observation;
  return (
    <div className="controls">
      <div className="stats">
        <div>
          <strong>{observation?.turns ?? 10}</strong>
          <span>turns left</span>
        </div>
        <div>
          <strong>
            {observation?.alarm ?? 0}
            <small>/3</small>
          </strong>
          <span>alarm</span>
        </div>
        <div>
          <strong>{observation?.gadgets ?? 1}</strong>
          <span>decoy</span>
        </div>
      </div>
      <p className="eyebrow">
        {run
          ? run.cohort === "informed-retry"
            ? "Informed retry"
            : "First recorded attempt"
          : "Your mission"}
      </p>
      <h3>
        {observation?.outcome
          ? "Chapter complete"
          : (observation?.roomTitle ?? "Steal lunch. Leave a legacy.")}
      </h3>
      <p>
        {observation?.outcome
          ? "Your decisions are saved. Review the replay and your ghost below, or start another adventure with a better plan."
          : (observation?.description ??
            "Retrieve the sandwich and escape before closing. Inspect for clues, time your moves, and spend your one decoy wisely. Every action has a consequence.")}
      </p>
      {run?.mode === "guest" && !observation?.outcome && (
        <div className="race-opponent">
          <h4>
            {run.rival
              ? "Your opponent is ready."
              : "Your first ghost starts here."}
          </h4>
          <p>
            {run.rival
              ? `${run.rival.label} is frozen before this attempt. Finish to reveal the race and compare decisions.`
              : "Finish this chapter to create a habit ghost. Then retry the same scenario to race your past self."}
          </p>
          {run.rival && (
            <details>
              <summary>Opponent record</summary>
              <small>Frozen version {run.rival.version.slice(0, 12)}</small>
            </details>
          )}
        </div>
      )}
      {observation?.room === 1 && !observation.outcome && (
        <p className="patrol">
          Guard is {observation.patrol}
          {observation.distracted ? " · distracted" : ""}. Changes phase each
          turn.
        </p>
      )}
      {observation && <AbilityStatus observation={observation} />}
      {observation?.clue && <p className="clue">↳ {observation.clue}</p>}
      {!run && (
        <button
          className="start-button"
          disabled={busy}
          onClick={() => start()}
        >
          {busy
            ? "Opening the museum…"
            : official
              ? "Start official chapter"
              : "Start guest adventure"}
        </button>
      )}
      {run && !!observation?.choices.length && (
        <div className="choices">
          {observation.choices.map((choice) => (
            <button
              className="choice"
              aria-label={choice.label}
              disabled={busy}
              key={choice.action}
              onClick={() =>
                void mutate({
                  operation: "step",
                  id: run.id,
                  step: run.step,
                  action: choice.action,
                })
              }
            >
              <span>{choice.label}</span>
              <small>{choice.hint}</small>
            </button>
          ))}
        </div>
      )}
      {observation?.outcome && (
        <button disabled={busy} onClick={() => start()}>
          Start a new adventure
        </button>
      )}
      <p className="muted">
        {official
          ? "Your Chog’s chapter stays private until you choose to publish it."
          : "Guest chapters never write official NFT history."}{" "}
        Prior knowledge outside this session cannot be verified.
      </p>
    </div>
  );
}
