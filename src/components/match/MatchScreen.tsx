"use client";
import { queueViewSchema } from "../../domain/pvp/responses";
import { useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { request } from "../request";
import type { QueueView } from "../../domain/pvp/queue";
import { usePlayIdentity } from "../auth/PlayIdentity";

export function MatchScreen() {
  const router = useRouter();
  const identity = usePlayIdentity();
  const getHeaders = useEffectEvent(() => identity.headers());
  const [queue, setQueue] = useState<QueueView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let stop = false;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const next = await request(
          "/api/match?mode=" + identity.mode,
          queueViewSchema.parse,
          undefined,
          abort.signal,
          await getHeaders(),
        );
        if (!stop) {
          setQueue(next);
          if (next.invite)
            router.push(
              `/match/${next.invite}${identity.mode === "official" ? "?as=chog" : identity.walletPlay ? "?as=holder" : ""}`,
            );
        }
      } catch (problem) {
        if (!stop)
          setError(
            problem instanceof Error ? problem.message : "Queue unavailable.",
          );
      } finally {
        if (!stop) timer = setTimeout(() => void load(), 2000);
      }
    }
    void load();
    return () => {
      stop = true;
      abort.abort();
      clearTimeout(timer);
    };
  }, [router, identity.mode, identity.walletPlay]);
  async function send(operation: "join" | "cancel" | "accept" | "decline") {
    setBusy(true);
    setError("");
    try {
      const next = await request(
        "/api/match",
        queueViewSchema.parse,
        { operation, mode: identity.mode },
        undefined,
        await identity.headers(),
      );
      setQueue(next);
      if (next.invite)
        router.push(
          `/match/${next.invite}${identity.mode === "official" ? "?as=chog" : identity.walletPlay ? "?as=holder" : ""}`,
        );
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : "Queue unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  const seconds =
    queue?.deadlineAt && queue.serverNow
      ? Math.max(0, Math.ceil((queue.deadlineAt - queue.serverNow) / 1000))
      : null;
  return (
    <section className="combat-screen" aria-label="Public matchmaking">
      <p className="eyebrow">Unranked · shared six-fighter pool</p>
      <h1>Find a Match</h1>
      <p>{queue?.message ?? "Checking the queue…"}</p>
      <p className="muted">
        {identity.mode === "official"
          ? `Chog entry · Token ${queue?.tokenId ?? "verification pending"}`
          : identity.walletPlay
            ? "Wallet player · holder access"
            : "Saved guest records"}
      </p>
      {queue?.status === "waiting" && queue.othersWaiting === 0 && (
        <div className="button-row">
          <Link href="/arena">Practice</Link>
          <Link href="/story">Story</Link>
        </div>
      )}
      {seconds !== null && <p role="status">Accept within {seconds}s.</p>}
      {error && <p role="alert">{error}</p>}
      <div className="button-row">
        {queue?.status !== "offered" && queue?.status !== "matched" && (
          <button
            disabled={
              busy ||
              !queue ||
              queue.status === "blocked" ||
              queue.status === "waiting"
            }
            onClick={() => void send("join")}
          >
            {queue?.status === "waiting" ? "Still looking" : "Find a match"}
          </button>
        )}
        {queue?.status === "waiting" && (
          <button disabled={busy} onClick={() => void send("cancel")}>
            Leave queue
          </button>
        )}
        {queue?.status === "offered" && !queue.accepted && (
          <>
            <button disabled={busy} onClick={() => void send("accept")}>
              Accept opponent
            </button>
            <button disabled={busy} onClick={() => void send("decline")}>
              Decline
            </button>
          </>
        )}
      </div>
      <details>
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
