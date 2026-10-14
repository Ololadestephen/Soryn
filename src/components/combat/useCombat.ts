"use client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  type BattleSession,
  type Move,
  type Difficulty,
} from "../../domain/combat/contracts";
import { type CharacterId } from "../../domain/characters/definitions";
import { request } from "../request";
import { usePlayback } from "./usePlayback";
import type { ArenaChoice } from "../../domain/combat/arenas";
import { prepareBattleAssets } from "./loading";
import { combatAudio } from "./audio/runtime";

export function useCombat(
  mode: "guest" | "official",
  headers?: () => Promise<Record<string, string>>,
) {
  const [session, setSession] = useState<BattleSession>({
    battle: null,
    history: [],
  });
  const { presentation, playRound, clear } = usePlayback();
  const [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const lock = useRef(false),
    mounted = useRef(true);
  const getHeaders = useEffectEvent(async () => (headers ? headers() : {}));
  useEffect(() => {
    mounted.current = true;
    const abort = new AbortController();
    async function load() {
      try {
        const data = await request<BattleSession>(
          `/api/battle?mode=${mode}`,
          undefined,
          abort.signal,
          await getHeaders(),
        );
        if (!abort.signal.aborted) setSession(data);
      } catch (problem) {
        if (!abort.signal.aborted)
          setError(
            problem instanceof Error ? problem.message : "Battle unavailable.",
          );
      } finally {
        if (!abort.signal.aborted) {
          setBusy(false);
          setLoaded(true);
        }
      }
    }
    void load();
    return () => {
      mounted.current = false;
      abort.abort();
    };
  }, [mode]);
  async function perform(input?: Record<string, unknown>, id?: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    if (input) setPending(input);
    try {
      const path = input
        ? "/api/battle"
        : `/api/battle?mode=${mode}${id ? `&id=${id}` : ""}`;
      const next = await request<BattleSession>(
        path,
        input,
        undefined,
        headers ? await headers() : {},
      );
      if (!mounted.current) return;
      const previous = session.battle;
      setSession(next);
      setPending(null);
      if (next.battle && input) await prepareBattleAssets(next.battle);
      if (input?.operation === "step" && next.battle)
        await playRound(next.battle, previous);
      else clear();
    } catch (problem) {
      if (mounted.current)
        setError(
          problem instanceof Error
            ? problem.message
            : "Battle unavailable; retry or recover saved state.",
        );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return {
    ...session,
    busy,
    loaded,
    error,
    pending,
    presentation,
    displayState: presentation?.event.state ?? session.battle?.state,
    start: (
      fighter: CharacterId,
      opponent: CharacterId,
      difficulty?: Difficulty,
      arena: ArenaChoice = "sanctuary",
    ) => {
      combatAudio.ui("confirm");
      return perform({
        operation: "start",
        mode,
        id: crypto.randomUUID(),
        characterId: fighter,
        opponent,
        arena,
        ...(difficulty ? { difficulty } : {}),
      });
    },
    step: (move: Move) => {
      combatAudio.ui("confirm");
      return (
        session.battle &&
        perform({
          operation: "step",
          mode,
          id: session.battle.id,
          round: session.battle.state.round,
          move,
        })
      );
    },
    retry: () => pending && perform(pending),
    reload: (id?: string) => perform(undefined, id),
  };
}
