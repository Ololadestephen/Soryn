"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CharacterId } from "../../domain/characters/definitions";
import type { ArenaChoice } from "../../domain/combat/arenas";
import type { Move } from "../../domain/combat/contracts";
import type { PvpHistoryRow, PvpPreview, PvpView } from "../../domain/pvp/view";
import { nextRoomState, type RoomCursor } from "../../domain/pvp/updates";
import { request } from "../request";

export interface PvpSession {
  activeInvite: string | null;
  activePhase: string | null;
  history: PvpHistoryRow[];
}

function isSeated(value: PvpView | PvpPreview): value is PvpView {
  return value.seated;
}

export function usePvp(invite?: string) {
  const [room, setRoom] = useState<PvpView | PvpPreview | null>(null);
  const [session, setSession] = useState<PvpSession | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const cursor = useRef<RoomCursor>({ revision: 0, serverNow: 0, stamp: 0 });
  const latest = useRef(0);
  const mounted = useRef(true);
  const consider = useCallback(
    (next: PvpView | PvpPreview, stamp: number, source: "poll" | "action") => {
      const accepted = nextRoomState(cursor.current, next, stamp, source);
      if (!accepted) return;
      cursor.current = accepted.cursor;
      setRoom(accepted.room);
    },
    [],
  );
  const refresh = useCallback(async () => {
    const stamp = ++latest.current;
    const path = invite
      ? `/api/pvp?invite=${encodeURIComponent(invite)}`
      : "/api/pvp";
    const data = await request<PvpView | PvpPreview | PvpSession>(path);
    if (!mounted.current) return data;
    if (invite) consider(data as PvpView | PvpPreview, stamp, "poll");
    else setSession(data as PvpSession);
    return data;
  }, [consider, invite]);
  useEffect(() => {
    mounted.current = true;
    let stop = false;
    async function load() {
      try {
        await refresh();
        if (!stop) setError("");
      } catch (problem) {
        if (!stop)
          setError(problem instanceof Error ? problem.message : "Try again.");
      }
    }
    void load();
    const timer = setInterval(() => void load(), invite ? 2000 : 4000);
    return () => {
      stop = true;
      mounted.current = false;
      clearInterval(timer);
    };
  }, [invite, refresh]);
  async function perform(input: Record<string, unknown>) {
    const stamp = ++latest.current;
    setBusy(true);
    setError("");
    try {
      const next = await request<PvpView | PvpPreview | PvpSession>(
        "/api/pvp",
        input,
      );
      if (!mounted.current) return next;
      if ("seated" in next) consider(next, stamp, "action");
      return next;
    } catch (problem) {
      if (mounted.current)
        setError(problem instanceof Error ? problem.message : "Try again.");
      throw problem;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const seated = room && isSeated(room) ? room : null;
  return {
    room: seated,
    preview: room && !isSeated(room) ? room : null,
    session,
    error,
    busy,
    refresh,
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
    assets: () => invite && perform({ operation: "assets", invite }),
    move: (round: number, move: Move) =>
      invite && perform({ operation: "move", invite, round, move }),
    rematch: () => invite && perform({ operation: "rematch", invite }),
    setup: () => invite && perform({ operation: "setup", invite }),
  };
}
