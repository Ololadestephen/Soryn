"use client";
import { battleSessionSchema } from "../../domain/combat/responses";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  type BattleSession,
  type BattleView,
  type Move,
  type Difficulty,
} from "../../domain/combat/contracts";
import { type CharacterId } from "../../domain/characters/definitions";
import { request } from "../request";
import { usePlayback } from "./usePlayback";
import type { ArenaChoice } from "../../domain/combat/arenas";
import { prepareBattleAssets } from "./loading";
import { gameMusic } from "./audio/runtime";
type PlaySession = BattleSession & {
  authorized?: boolean;
  interruption?: string | null;
};

export function useCombat(
  mode: "guest" | "official",
  headers?: () => Promise<Record<string, string>>,
  officialStory = false,
  skipInitialLoad = false,
) {
  const endpoint = officialStory ? "/api/story" : "/api/battle";
  const [session, setSession] = useState<PlaySession>({
    battle: null,
    history: [],
  });
  const { presentation, playRound, clear } = usePlayback();
  const [busy, setBusy] = useState(!skipInitialLoad),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(skipInitialLoad);
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const lock = useRef(false),
    mounted = useRef(true);
  const getHeaders = useEffectEvent(async () => (headers ? headers() : {}));
  useEffect(() => {
    mounted.current = true;
    if (skipInitialLoad) {
      return () => {
        mounted.current = false;
      };
    }
    const abort = new AbortController();
    async function load() {
      try {
        const data = await request(
          `${endpoint}?mode=${mode}`,
          battleSessionSchema.parse,
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
  }, [mode, endpoint, skipInitialLoad]);
  async function perform(input?: Record<string, unknown>, id?: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    if (input) setPending(input);
    try {
      const path = input
        ? endpoint
        : `${endpoint}?mode=${mode}${id ? `&id=${id}` : ""}`;
      const next = await request(
        path,
        battleSessionSchema.parse,
        input && officialStory && input.operation === "step"
          ? { ...input, operation: "move" }
          : input,
        undefined,
        headers ? await headers() : {},
      );
      if (!mounted.current) return;
      const previous = session.battle;
      setSession(next);
      if (next.authorized === false)
        setError(
          "This official encounter ended without completion. Verify your Chog again before continuing.",
        );
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
      gameMusic.activate();
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
      gameMusic.activate();
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
    hydrate: async (battle: BattleView | null, authorized?: boolean) => {
      clear();
      setSession((current) => ({
        ...current,
        battle,
        ...(authorized !== undefined ? { authorized } : {}),
      }));
      if (battle) await prepareBattleAssets(battle);
    },
  };
}
