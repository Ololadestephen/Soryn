"use client";
import {
  pvpActionSchema,
  pvpRoomResponseSchema,
  pvpSessionSchema,
  type PvpSession,
} from "../../domain/pvp/responses";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CharacterId } from "../../domain/characters/definitions";
import type { ArenaChoice } from "../../domain/combat/arenas";
import type { Move } from "../../domain/combat/contracts";
import type { PvpPreview, PvpView } from "../../domain/pvp/view";
import { nextRoomState, type RoomCursor } from "../../domain/pvp/updates";
import { request, RequestError } from "../request";
import { usePlayIdentity } from "../auth/PlayIdentity";
import { pollDelayMs } from "./pollDelay";

function isSeated(value: PvpView | PvpPreview): value is PvpView {
  return value.seated;
}

export function usePvp(invite?: string, historyOnly = false) {
  const identity = usePlayIdentity();
  const headers = identity.headers;
  const [room, setRoom] = useState<PvpView | PvpPreview | null>(null);
  const [session, setSession] = useState<PvpSession | null>(null);
  const [error, setError] = useState("");
  const [pollError, setPollError] = useState("");
  const [busy, setBusy] = useState(false);
  const cursor = useRef<RoomCursor>({ revision: 0, serverNow: 0, stamp: 0 });
  const latest = useRef(0);
  const mounted = useRef(true);
  const loadingRecheck = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomRef = useRef<PvpView | PvpPreview | null>(null);
  const reschedule = useRef<() => void>(() => {});
  const appliedDelay = useRef<number | null>(null);
  const consider = useCallback(
    (next: PvpView | PvpPreview, stamp: number, source: "poll" | "action") => {
      const accepted = nextRoomState(cursor.current, next, stamp, source);
      if (!accepted) return;
      cursor.current = accepted.cursor;
      setRoom(accepted.room);
    },
    [],
  );
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const stamp = ++latest.current;
      const path = invite
        ? `/api/pvp?invite=${encodeURIComponent(invite)}&mode=${identity.mode}`
        : `/api/pvp?mode=${identity.mode}${historyOnly ? "&history=1" : ""}`;
      const proof = await headers();
      const data = invite
        ? await request(
            path,
            pvpRoomResponseSchema.parse,
            undefined,
            signal,
            proof,
          )
        : await request(path, pvpSessionSchema.parse, undefined, signal, proof);
      if (!mounted.current || signal?.aborted) return data;
      if ("seated" in data) consider(data, stamp, "poll");
      else setSession(data);
      return data;
    },
    [consider, invite, identity.mode, headers, historyOnly],
  );
  useEffect(() => {
    mounted.current = true;
    let stop = false;
    let reading = false;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      // The next read waits until this one finishes, so two cookieless
      // session reads cannot mint two guests.
      if (stop || reading) return;
      timer = setTimeout(
        () => void load(),
        pollDelayMs(invite, roomRef.current),
      );
    };
    async function load() {
      if (reading) return;
      reading = true;
      try {
        await refresh(abort.signal);
        if (!stop) setPollError("");
      } catch (problem) {
        if (!stop)
          setPollError(
            problem instanceof Error ? problem.message : "Try again.",
          );
      } finally {
        reading = false;
        schedule();
      }
    }
    reschedule.current = schedule;
    void load();
    return () => {
      stop = true;
      mounted.current = false;
      reschedule.current = () => {};
      abort.abort();
      clearTimeout(timer);
      if (loadingRecheck.current) clearTimeout(loadingRecheck.current);
    };
  }, [invite, refresh]);
  useEffect(() => {
    roomRef.current = room;
    const next = pollDelayMs(invite, room);
    const previous = appliedDelay.current;
    appliedDelay.current = next;
    if (previous !== null && next < previous) reschedule.current();
  }, [invite, room]);
  async function perform(
    input: Record<string, unknown>,
    quiet: readonly string[] = [],
  ) {
    const stamp = ++latest.current;
    setBusy(true);
    setError("");
    try {
      if (!room && !session)
        throw new Error("Your session is still opening. Please try again.");
      const submit = async () =>
        request(
          "/api/pvp",
          pvpActionSchema.parse,
          { ...input, mode: identity.mode },
          undefined,
          await identity.headers(),
        );
      let next;
      try {
        next = await submit();
      } catch (problem) {
        // These conflicts occur before dispatch. Retry once with fresh proof;
        // never retry an already-locked move, stale battle, revocation or outage.
        if (
          !mounted.current ||
          !(problem instanceof RequestError) ||
          problem.status !== 409 ||
          problem.code !== "revision-conflict"
        )
          throw problem;
        next = await submit();
      }
      if (!mounted.current) return next;
      if ("seated" in next) consider(next, stamp, "action");
      return next;
    } catch (problem) {
      const quietCode =
        problem instanceof RequestError &&
        problem.code !== undefined &&
        quiet.includes(problem.code);
      if (quietCode) {
        // The battle moved on. Show the current room instead of the stale error.
        if (mounted.current) setError("");
        void refresh();
        return null;
      }
      if (mounted.current)
        setError(problem instanceof Error ? problem.message : "Try again.");
      throw problem;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const seated = room && isSeated(room) ? room : null;
  const currentBattleId = seated?.battle?.id;
  return {
    room: seated,
    preview: room && !isSeated(room) ? room : null,
    session,
    error: error || pollError,
    busy: busy || (!room && !session),
    refresh,
    /** Fire-and-forget UI actions still report every failure in the room. */
    run: async (action: () => unknown) => {
      try {
        return await action();
      } catch (problem) {
        if (mounted.current)
          setError(problem instanceof Error ? problem.message : "Try again.");
        return null;
      }
    },
    create: () => perform({ operation: "create" }),
    join: () => invite && perform({ operation: "join", invite }),
    leave: () => invite && perform({ operation: "leave", invite }),
    close: () => invite && perform({ operation: "close", invite }),
    select: (characterId: CharacterId) =>
      invite && perform({ operation: "select", invite, characterId }),
    arena: (arena: ArenaChoice) =>
      invite && perform({ operation: "arena", invite, arena }),
    ready: (ready: boolean) =>
      invite && perform({ operation: "ready", invite, ready }),
    assets: async () => {
      if (!invite) return false;
      const matchId = currentBattleId;
      try {
        const next = await perform(
          {
            operation: "assets",
            invite,
            ...(matchId ? { matchId } : {}),
          },
          ["stale-battle"],
        );
        if (
          next &&
          "phase" in next &&
          next.phase === "loading" &&
          mounted.current
        ) {
          if (loadingRecheck.current) clearTimeout(loadingRecheck.current);
          loadingRecheck.current = setTimeout(() => {
            loadingRecheck.current = null;
            void refresh();
          }, 400);
        }
        return next != null;
      } catch {
        return false;
      }
    },
    move: (round: number, move: Move) => {
      const matchId = currentBattleId;
      return (
        invite &&
        perform({
          operation: "move",
          invite,
          round,
          move,
          ...(matchId ? { matchId } : {}),
        })
      );
    },
    rematch: () => invite && perform({ operation: "rematch", invite }),
    continueSeries: () => {
      const matchId = currentBattleId;
      return (
        invite &&
        perform(
          {
            operation: "continue",
            invite,
            ...(matchId ? { matchId } : {}),
          },
          ["stale-battle"],
        )
      );
    },
    surrender: () => invite && perform({ operation: "surrender", invite }),
    setup: () => invite && perform({ operation: "setup", invite }),
  };
}
