"use client";
import Link from "next/link";
import Image from "next/image";
import assets from "../site/landing/assets.json";
import { PUBLIC_FIGHTERS } from "../../domain/access/policy";
import { character } from "../../domain/characters/definitions";
import type { QueueView } from "../../domain/pvp/queue";
const titles: Record<QueueView["status"], string> = {
  idle: "Ready when you are",
  waiting: "Finding your opponent",
  offered: "Opponent found",
  matched: "Your match is ready",
  blocked: "Queue unavailable",
};
function MatchFormat() {
  return (
    <aside className="match-format" aria-label="Match format">
      <h2>One arena. Equal footing.</h2>
      <p>
        Unranked battles. First to two wins. The same six-fighter pool for every
        player.
      </p>
      <ul className="match-roster">
        {PUBLIC_FIGHTERS.map((id) => (
          <li key={id}>
            <Image
              unoptimized
              src={assets[id].thumbnail}
              width={64}
              height={64}
              alt=""
            />
            <span>{character(id).name}</span>
          </li>
        ))}
      </ul>
      <ol className="match-steps">
        <li>Join the queue</li>
        <li>Accept your opponent</li>
        <li>Choose a fighter & ready up</li>
      </ol>
    </aside>
  );
}
export function MatchPanel({
  queue,
  busy,
  error,
  mode,
  walletPlay,
  onAction,
}: {
  queue: QueueView | null;
  busy: boolean;
  error: string;
  mode: "guest" | "official";
  walletPlay: boolean;
  onAction: (
    operation: "join" | "cancel" | "accept" | "decline",
  ) => Promise<void>;
}) {
  const seconds =
    queue?.deadlineAt && queue.serverNow
      ? Math.max(0, Math.ceil((queue.deadlineAt - queue.serverNow) / 1000))
      : null;
  return (
    <section className="match-screen" aria-label="Public matchmaking">
      <header className="match-heading">
        <p className="eyebrow">Unranked · shared six-fighter pool</p>
        <h1>Find a Match</h1>

        <p className="muted">
          {mode === "official"
            ? `Chog entry · Token ${queue?.tokenId ?? "verification pending"}`
            : walletPlay
              ? "Wallet player · holder access"
              : "Saved guest records"}
        </p>
      </header>
      <div className="match-layout">
        <section
          className={`match-status-card${queue?.status === "offered" ? " is-offered" : ""}`}
          aria-label="Queue status"
        >
          <div className="match-status-top">
            <span className="match-emblem" aria-hidden="true">
              VS
            </span>
            <span className="match-state-label">
              {queue?.status === "waiting"
                ? "Searching"
                : queue?.status === "offered"
                  ? "Match offer"
                  : "Public arena"}
            </span>
          </div>
          <h2>
            {queue?.status === "offered" && queue.accepted
              ? "Offer accepted"
              : queue
                ? titles[queue.status]
                : "Opening matchmaking"}
          </h2>
          <p className="match-message">
            {queue?.message ?? "Checking the queue…"}
          </p>
          {seconds !== null && (
            <p className="match-deadline" role="status">
              {queue?.accepted ? "Offer expires in" : "Accept within"}{" "}
              <strong>{seconds}s</strong>.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="match-actions">
            {queue?.status !== "offered" && queue?.status !== "matched" && (
              <button
                disabled={
                  busy ||
                  !queue ||
                  queue.status === "blocked" ||
                  queue.status === "waiting"
                }
                onClick={() => void onAction("join")}
              >
                {queue?.status === "waiting" ? "Still looking" : "Find a match"}
              </button>
            )}
            {queue?.status === "waiting" && (
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void onAction("cancel")}
              >
                Leave queue
              </button>
            )}
            {queue?.status === "offered" && !queue.accepted && (
              <>
                <button disabled={busy} onClick={() => void onAction("accept")}>
                  Accept opponent
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => void onAction("decline")}
                >
                  Decline
                </button>
              </>
            )}
          </div>
        </section>
        <MatchFormat />
      </div>
      {queue?.status === "waiting" && queue.othersWaiting === 0 && (
        <div className="button-row">
          <Link href="/arena">Practice</Link>
          <Link href="/story">Story</Link>
        </div>
      )}
      <details className="match-help">
        <summary>How it works</summary>
        <p>
          Unranked, first to two battle wins. The queue pairs people who are
          waiting. It never adds a computer opponent. Practice and Story are
          separate modes.
        </p>
        <p>
          Guest progress belongs to this browser session. Verified Chog entry
          requires current ownership. <Link href="/character">My Chog</Link>
        </p>
      </details>
    </section>
  );
}
