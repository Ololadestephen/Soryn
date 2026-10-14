"use client";

import { useEffect, useRef } from "react";
import type { RunView } from "../../domain/views";
import { Replay } from "../adventure/Replay";
import { RaceReplay } from "../adventure/RaceReplay";

export function ChapterReview({
  chapter,
  busy,
  race,
  close,
}: {
  chapter: RunView;
  busy: boolean;
  race: (id: string) => void;
  close: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [chapter.id]);
  return (
    <section className="panel chapter-review" aria-label="Saved guest chapter">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            Private guest replay ·{" "}
            {chapter.cohort === "first-recorded"
              ? "First recorded attempt"
              : "Informed retry"}
          </p>
          <h3 ref={heading} tabIndex={-1}>
            Saved chapter replay
          </h3>
        </div>
        <button className="secondary" onClick={close}>
          Close chapter
        </button>
      </div>
      <p>{chapter.observation.message}</p>
      {chapter.replay && <Replay frames={chapter.replay.frames} />}
      {chapter.rival?.replay && chapter.replay && (
        <details>
          <summary>Revisit the frozen opponent race</summary>
          <p>
            Opponent: {chapter.rival.label} · version{" "}
            {chapter.rival.version.slice(0, 12)}. This opponent was frozen
            before the saved attempt.
          </p>
          <RaceReplay
            player={chapter.replay.frames}
            ghost={chapter.rival.replay.frames}
            reasons={chapter.rival.replay.reasons}
            ghostLabel={chapter.rival.label}
          />
        </details>
      )}
      {chapter.ghost && (
        <div className="chapter-ghost">
          <h4>This chapter’s ghost</h4>
          <p>
            Derived from {chapter.ghost.profile.runs} completed guest{" "}
            {chapter.ghost.profile.runs === 1 ? "run" : "runs"}. Created after
            this chapter; it is a separate version from its opponent.
          </p>
          <button disabled={busy} onClick={() => race(chapter.id)}>
            Race this ghost
          </button>
          <p className="muted">
            Same starting scenario, your selected version. This starts an
            informed personal practice race; a museum rematch uses the exhibit
            opponent instead.
          </p>
          <details>
            <summary>Explain this ghost’s decisions</summary>
            <ol>
              {chapter.ghost.race.actions.map((action, index) => (
                <li key={index}>
                  <strong>{action}</strong> —{" "}
                  {chapter.ghost?.race.reasons[index]}
                </li>
              ))}
            </ol>
            <p className="muted">
              Version {chapter.ghost.version.slice(0, 12)}. Policy{" "}
              {chapter.ghost.profile.policy}. The version digest records
              integrity; it does not prove fair play.
            </p>
          </details>
        </div>
      )}
      <p className="muted">
        Reviewing a saved chapter leaves your current adventure intact.
        Publishing remains an explicit choice in the completed adventure view.
      </p>
    </section>
  );
}
