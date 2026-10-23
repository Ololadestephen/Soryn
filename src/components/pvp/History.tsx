"use client";
import { battleSessionSchema } from "../../domain/combat/responses";

import { useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import type { BattleSession } from "../../domain/combat/contracts";
import { request } from "../request";
import { usePlayIdentity } from "../auth/PlayIdentity";
import { usePvp } from "./usePvp";

export function BattleHistoryPage() {
  const identity = usePlayIdentity();
  const headers = useEffectEvent(() => identity.headers());
  const pvp = usePvp(undefined, true);
  const [practice, setPractice] = useState<BattleSession["history"]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    void (async () =>
      request(
        "/api/battle?mode=guest",
        battleSessionSchema.parse,
        undefined,
        abort.signal,
        await headers(),
      ))()
      .then((session) => setPractice(session.history))
      .catch((problem: unknown) => {
        if (!abort.signal.aborted)
          setError(problem instanceof Error ? problem.message : "Try again.");
      });
    return () => abort.abort();
  }, [identity.walletPlay]);
  return (
    <section className="pvp-history" aria-label="Battle history">
      <h1>{identity.walletPlay ? "Wallet history" : "Battle history"}</h1>
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
