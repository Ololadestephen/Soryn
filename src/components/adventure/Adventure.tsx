"use client";

import type { useGuestGame } from "../guest/useGuestGame";
import { RoomInteractions } from "../characters/RoomInteractions";
import { Stage } from "./Stage";
import { Result } from "./Result";
import { Controls } from "./Controls";
import { GuestRequestError } from "../guest/GuestRequestError";

type Props = Pick<
  ReturnType<typeof useGuestGame>,
  "run" | "busy" | "error" | "pending" | "mutate" | "start"
> & { official?: boolean };

export function Adventure({
  run,
  busy,
  error,
  pending,
  mutate,
  start,
  official = false,
}: Props) {
  const observation = run?.observation;
  return (
    <section
      id={official ? "official-adventure" : "adventure"}
      className="adventure"
      tabIndex={-1}
      aria-labelledby={
        official ? "official-adventure-title" : "adventure-title"
      }
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Your next questionable idea</p>
          <h2 id={official ? "official-adventure-title" : "adventure-title"}>
            The Great Sandwich Incident
          </h2>
        </div>
        <span className="small-label">Three rooms. One legendary lunch.</span>
      </div>
      <ol className="room-progress" aria-label="Adventure rooms">
        {["Helpful signs", "Paperwork guard", "Sandwich extraction"].map(
          (name, room) => (
            <li
              key={name}
              aria-current={
                observation && observation.room === room ? "step" : undefined
              }
              className={
                observation && observation.room > room ? "completed" : ""
              }
            >
              <span aria-hidden="true">{room + 1}</span>
              {name}
            </li>
          ),
        )}
      </ol>
      <div
        className={`play-grid${observation?.tactics ? " tactical-play" : ""}`}
      >
        <div className="stage">
          <div className="stage-top">
            <span>
              {observation
                ? `Room ${observation.room + 1} of 3`
                : "The museum is open"}
            </span>
            <span>
              {official
                ? `Official Chog${run?.identity ? ` · token ${run.identity.tokenId}` : ""}`
                : run?.borrowed
                  ? "Guest practice · borrowed challenge class"
                  : "Guest practice"}
            </span>
          </div>
          <Stage
            tactics={observation?.tactics}
            room={observation?.room ?? 0}
            sandwich={observation?.sandwich ?? false}
            trapped={observation?.outcome === "trapped"}
          />
          {run && <RoomInteractions run={run} busy={busy} mutate={mutate} />}
          <div className="stage-caption">
            <span className="live-dot" aria-hidden="true" />
            <p role="status">
              {observation?.message ??
                "Meet your guest. Their qualifications: curiosity, a decoy, and no lunch."}
            </p>
          </div>
        </div>
        <Controls
          run={run}
          busy={busy}
          mutate={mutate}
          start={start}
          official={official}
        />
      </div>
      <GuestRequestError
        error={error}
        pending={pending}
        busy={busy}
        mutate={mutate}
      />
      {run?.observation.outcome && (
        <Result
          key={run.id}
          run={run}
          busy={busy}
          mutate={mutate}
          start={start}
        />
      )}
    </section>
  );
}
