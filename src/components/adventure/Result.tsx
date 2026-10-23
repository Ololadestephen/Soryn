"use client";

import { useState } from "react";
import type {
  PublicationRequest,
  WithdrawalRequest,
} from "../../domain/requests";
import type { RunView } from "../../domain/views";
import { Replay } from "./Replay";
import { RaceReplay } from "./RaceReplay";

export function Result({
  run,
  busy,
  mutate,
  start,
}: {
  run: RunView;
  busy: boolean;
  mutate: (input: PublicationRequest | WithdrawalRequest) => Promise<void>;
  start: (exhibitId?: string | null, retryOf?: string | null) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [title, setTitle] = useState(
    run.observation.message.startsWith("The Door")
      ? "The Door Was Painted"
      : "An Overnight Residency",
  );
  const [alias, setAlias] = useState("Anonymous curator");
  const ghost = run.ghost;
  const rival = run.rival;
  const race = rival?.replay;
  return (
    <section className="results" aria-label="Run result">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            Chapter complete ·{" "}
            {run.mode === "official"
              ? `official token ${run.identity?.tokenId}`
              : "guest practice"}
          </p>
          <h2>
            {run.observation.outcome === "escaped"
              ? "Lunch. Against all odds."
              : "A spectacular addition to the collection."}
          </h2>
        </div>
        <button disabled={busy} onClick={() => start(run.exhibitId, run.id)}>
          {run.mode === "guest" && !run.exhibitId
            ? "Race my new ghost"
            : "Retry this scenario"}
        </button>
      </div>
      <p>{run.observation.message}</p>
      {run.comparison && (
        <p className="comparison">
          You finished{" "}
          {run.comparison.original === "better"
            ? "ahead of"
            : run.comparison.original === "tied"
              ? "tied with"
              : "behind"}{" "}
          the original failure and{" "}
          {run.comparison.ghost === "better"
            ? "ahead of"
            : run.comparison.ghost === "tied"
              ? "tied with"
              : "behind"}{" "}
          its frozen strategy ghost. Ranking: escape with goal, fewer turns,
          lower alarm. Equal tuples tie.
        </p>
      )}
      {rival && race && run.replay && (
        <section className="race-result" aria-label="Frozen ghost race">
          <p className="eyebrow">
            {rival.source === "museum"
              ? "Museum ghost challenge"
              : "Race your past self"}
          </p>
          <h3>
            {race.comparison === "better"
              ? "You beat the frozen ghost."
              : race.comparison === "tied"
                ? "A dead heat. History repeats."
                : "Your ghost got the better of you."}
          </h3>
          <p>
            Opponent: {rival.label}. Frozen before this attempt; this chapter
            did not change its choices.
          </p>
          <p className="muted">
            Ranking: escape with lunch first, then fewer turns, then lower
            alarm. Equal results tie. First recorded attempts and informed
            retries stay separate.
          </p>
          <RaceReplay
            player={run.replay.frames}
            ghost={race.frames}
            reasons={race.reasons}
            ghostLabel={rival.label}
          />
          <details>
            <summary>Opponent version and decisions</summary>
            <p className="muted">
              Frozen version {rival.version.slice(0, 12)} ·{" "}
              {run.ghost?.profile.policy ?? "legacy policy"}. This is a
              deterministic habit policy. Its digest records integrity, not fair
              play.
            </p>
            <ol>
              {race.actions.map((action, index) => (
                <li key={index}>
                  <strong>{action}</strong> — {race.reasons[index]}
                </li>
              ))}
            </ol>
          </details>
        </section>
      )}
      {run.borrowed && (
        <p className="muted">
          This borrowed holder class is bound to its original exhibit. Your
          chapter stays in your private journal; it cannot become a reusable
          holder-class publication.
        </p>
      )}
      <div className="result-grid">
        <div className="panel">
          <h3>Your decisions, frame by frame</h3>
          {run.replay && <Replay frames={run.replay.frames} />}
        </div>
        <div className="panel">
          <p className="eyebrow">
            {run.mode === "guest"
              ? "Your next ghost version"
              : "Your strategy ghost"}
          </p>
          <h3>Your habits have company.</h3>
          {ghost && (
            <>
              {run.mode === "guest" && (
                <p>
                  This version was created after your chapter.{" "}
                  {run.exhibitId
                    ? "It records your habits; the museum opponent keeps its original version."
                    : "Race it on your next attempt of this scenario."}
                </p>
              )}
              <p>
                Derived from {ghost.profile.runs} completed{" "}
                {run.mode === "official" ? "official" : "guest"}{" "}
                {ghost.profile.runs === 1 ? "run" : "runs"}{" "}
                {run.mode === "official" ? "for your Chog" : "in this session"}
                (latest 100 records). It follows your recorded habits, with a
                fallback for rooms you haven’t seen.
              </p>
              <p className="ghost-score">
                Ghost: {ghost.race.result.outcome} ·{" "}
                {10 - ghost.race.result.turns}{" "}
                {ghost.race.result.turns === 9 ? "turn" : "turns"} ·{" "}
                {ghost.race.result.alarm} alarm
              </p>
              <details>
                <summary>How the ghost chose</summary>
                <p className="muted">
                  Frozen version {ghost.version.slice(0, 12)}. Policy
                  {ghost.profile.policy}. The digest records integrity; it does
                  not prove fair play.
                </p>
                <ol>
                  {ghost.race.actions.map((action, index) => (
                    <li key={index}>
                      <strong>{action}</strong> — {ghost.race.reasons[index]}
                    </li>
                  ))}
                </ol>
              </details>
              <p className="muted">
                Evaluated independently from your frozen starting state. A new
                completed run creates a new derived profile; published ghosts
                remain frozen.
              </p>
            </>
          )}
        </div>
      </div>
      {run.mode === "guest" &&
        !run.borrowed &&
        run.observation.outcome !== "escaped" && (
          <div className="panel publish">
            <p className="eyebrow">Museum of Bad Decisions</p>
            <h3>Make your mistake someone else’s mission.</h3>
            {run.publication ? (
              <>
                <p>Published as “{run.publication.title}”.</p>
                <a
                  className="share-link"
                  href={`/play?challenge=${run.publication.id}`}
                >
                  Open shareable challenge
                </a>
                <p className="muted">
                  Share this link with another browser connected to this local
                  server.
                </p>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    void mutate({ operation: "withdraw", id: run.id })
                  }
                >
                  Withdraw exhibit
                </button>
              </>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!consent) return;
                  void mutate({
                    operation: "publish",
                    id: run.id,
                    title,
                    alias,
                    consent: true,
                  });
                }}
              >
                <div className="fields">
                  <label>
                    Exhibit title
                    <input
                      name="exhibit-title"
                      type="text"
                      autoComplete="off"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      maxLength={72}
                      minLength={1}
                      required
                    />
                  </label>
                  <label>
                    Public author alias
                    <input
                      name="public-alias"
                      type="text"
                      autoComplete="off"
                      value={alias}
                      onChange={(event) => setAlias(event.target.value)}
                      maxLength={32}
                      minLength={1}
                      required
                    />
                  </label>
                </div>
                <label className="consent">
                  <input
                    name="publication-consent"
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    required
                  />{" "}
                  I consent to publishing this run’s actions, outcome, alias and
                  ghost profile as a replayable guest exhibit.
                </label>
                <p className="muted">
                  The exhibit ghost uses this run alone. Other private runs and
                  session identifiers are excluded. You can withdraw it while
                  you retain this guest cookie; challenge links then become
                  unavailable. The local database retains a withdrawn record.
                  Operator removal is available if the cookie is lost.
                </p>
                <button disabled={busy}>Publish my failure</button>
              </form>
            )}
          </div>
        )}
    </section>
  );
}
