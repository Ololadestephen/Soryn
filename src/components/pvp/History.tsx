"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BattleSession } from "../../domain/combat/contracts";
import { request } from "../request";
import { usePvp } from "./usePvp";

export function BattleHistoryPage() {
  const pvp = usePvp();
  const [practice, setPractice] = useState<BattleSession["history"]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    request<BattleSession>("/api/battle?mode=guest", undefined, abort.signal)
      .then((session) => setPractice(session.history))
      .catch((problem: unknown) => {
        if (!abort.signal.aborted)
          setError(problem instanceof Error ? problem.message : "Try again.");
      });
    return () => abort.abort();
  }, []);
  return (
    <section className="pvp-history" aria-label="Battle history">
      <p className="eyebrow">Your battles only</p>
      <h1>Battle history</h1>
      <p>Practice and private friend battles for this browser stay separate.</p>
      {error && <p role="alert">{error}</p>}
      <h2>Practice</h2>
      {practice.length === 0 ? (
        <p>
          No saved practice battles. <Link href="/arena">Enter the arena</Link>
        </p>
      ) : (
        <ul>
          {practice.map((battle) => (
            <li key={battle.id}>
              {battle.fighter} · {battle.outcome} · {battle.rounds} rounds
            </li>
          ))}
        </ul>
      )}
      <h2>Friend battles</h2>
      {!pvp.session?.history.length ? (
        <p>
          No private battles yet.{" "}
          <Link href="/challenge">Challenge a friend</Link>
        </p>
      ) : (
        <ul>
          {pvp.session.history.map((battle) => (
            <li key={battle.matchId}>
              {battle.headline}: {battle.fighter} vs {battle.opponent} ·{" "}
              {battle.rounds} rounds · {battle.arena}. {battle.explanation}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
