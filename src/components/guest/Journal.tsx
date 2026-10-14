"use client";

import { character } from "../../domain/characters/definitions";
import Link from "next/link";
import type { useGuestGame } from "./useGuestGame";
import { ChapterReview } from "./ChapterReview";
import { ChallengeLog } from "./ChallengeLog";

const titles = {
  escaped: "Lunch acquired.",
  "empty-handed": "An escape without lunch.",
  trapped: "A permanent museum residency.",
};
type Props = Pick<
  ReturnType<typeof useGuestGame>,
  | "journal"
  | "chapter"
  | "busy"
  | "openChapter"
  | "setChapter"
  | "raceChapter"
  | "start"
  | "run"
  | "chapterError"
  | "retryChapter"
>;

export function Journal({
  journal,
  chapter,
  busy,
  openChapter,
  setChapter,
  raceChapter,
  start,
  run,
  chapterError,
  retryChapter,
}: Props) {
  const raceBlocked = busy || !!(run && !run.observation.outcome);
  return (
    <section
      id="journal"
      className="journal"
      tabIndex={-1}
      aria-labelledby="journal-title"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Guest journal · private to this session</p>
          <h2 id="journal-title">Your past has unfinished business.</h2>
        </div>
        <span className="small-label">Saved chapters · latest first</span>
      </div>
      <p className="muted">
        Up to 100 recent saved chapters. This journal belongs to your guest
        cookie; it never writes official NFT history. A lost cookie cannot
        recover these private chapters.
      </p>
      {run && !run.observation.outcome && (
        <p className="journal-notice">
          Your current adventure is still in progress. Finish it before starting
          a rematch; you can review saved chapters now.
        </p>
      )}
      {chapterError && (
        <div role="alert" className="error">
          <p>{chapterError}</p>
          <button disabled={busy} onClick={retryChapter}>
            Retry chapter request
          </button>
        </div>
      )}
      {journal.chapters.length === 0 ? (
        <div className="journal-empty">
          <h3>A clean record. Suspicious.</h3>
          <p>
            Finish an adventure to save its replay and ghost here. Your current
            chapter stays in Play.
          </p>
          <Link href="/play">Return to the adventure</Link>
        </div>
      ) : (
        <ol className="chapter-list">
          {journal.chapters.map((saved) => (
            <li className="chapter-row" key={saved.id}>
              <div>
                <p className="eyebrow">
                  {saved.cohort === "first-recorded"
                    ? "First recorded attempt"
                    : "Informed retry"}
                  {saved.challenge
                    ? " · Museum challenge"
                    : " · Personal practice"}
                </p>
                <h3>{titles[saved.outcome]}</h3>
                {saved.loadout && (
                  <p>
                    {character(saved.loadout.characterId).name} /{" "}
                    {character(saved.loadout.characterId).role} ·{" "}
                    {saved.loadout.charges} initial signature charge(s)
                  </p>
                )}
                <p>
                  {saved.turnsUsed} {saved.turnsUsed === 1 ? "turn" : "turns"}{" "}
                  used · {saved.alarm} alarm
                </p>
                {saved.ghostVersion && (
                  <p className="muted">
                    Adventure ghost · {saved.trainingRuns} completed{" "}
                    {saved.trainingRuns === 1 ? "run" : "runs"} in its profile
                  </p>
                )}
                {saved.challenge && (
                  <p className="muted">
                    {saved.challenge.title}
                    {!saved.challenge.available &&
                      " · Public opponent and comparison unavailable"}
                  </p>
                )}
              </div>
              <div className="button-row">
                <button
                  id={`journal-open-${saved.id}`}
                  className="secondary"
                  disabled={busy}
                  onClick={() => void openChapter(saved.id)}
                >
                  Open chapter
                </button>
                <button
                  disabled={raceBlocked || !saved.ghostVersion}
                  onClick={() => raceChapter(saved.id)}
                >
                  Race this ghost
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {chapter && (
        <ChapterReview
          key={chapter.id}
          chapter={chapter}
          busy={raceBlocked}
          race={raceChapter}
          close={() => {
            setChapter(null);
            document.getElementById(`journal-open-${chapter.id}`)?.focus();
          }}
        />
      )}
      <ChallengeLog
        challenges={journal.challenges}
        busy={raceBlocked}
        start={start}
      />
    </section>
  );
}
