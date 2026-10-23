"use client";
import Link from "next/link";
import Image from "next/image";
import assets from "../combat/rendered/assets.json";
import { PUBLIC_FIGHTERS } from "../../domain/access/policy";
import { character } from "../../domain/characters/definitions";
import type { QueueView } from "../../domain/pvp/queue";
const titles: Record<QueueView["status"], string> = {
  idle: "Join matchmaking",
  waiting: "Finding your opponent",
  offered: "Opponent found",
  matched: "Your match is ready",
  blocked: "Queue unavailable",
};
function MatchFormat() {
  return (
    <aside className="match-format" aria-label="Match format">
      <h2>Fighters</h2>
      <p>Unranked · Best of three</p>
      <ul className="match-roster" aria-label="Eligible fighters">
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
    </aside>
  );
}
export function MatchPanel({
  queue,
  busy,
  error,
  onAction,
}: {
  queue: QueueView | null;
  busy: boolean;
  error: string;
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
        <h1>Find a Match</h1>
      </header>
      <div className="match-layout">
        <section
          className={`match-status-card${queue?.status === "offered" ? " is-offered" : ""}`}
          aria-label="Queue status"
        >
          <h2>
            {queue?.status === "offered" && queue.accepted
              ? "Offer accepted"
              : queue
                ? titles[queue.status]
                : "Opening matchmaking"}
          </h2>
          {queue && queue.status !== "idle" && (
            <p className="match-message">{queue.message}</p>
          )}
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
      <p className="match-help">
        <Link href="/help#modes-matches">Match rules</Link>
      </p>
    </section>
  );
}
