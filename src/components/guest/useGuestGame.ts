"use client";
import { guestSessionSchema } from "../../domain/adventure/responses";
import { guestMutationSchema } from "../../domain/adventure/responses";

import { guestStartRequest } from "../characters/startRequests";

import type { CharacterId } from "../../domain/characters/definitions";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ExhibitSummary, RunView } from "../../domain/views";

import { request } from "../request";
import { useGuestJournal } from "./useGuestJournal";
import { usePublicReplay } from "./usePublicReplay";

export function useGuestGame() {
  const router = useRouter();
  const [selectedCharacter, setSelectedCharacter] =
    useState<CharacterId>("pip");
  const [run, setRun] = useState<RunView | null>(null);
  const [museum, setMuseum] = useState<ExhibitSummary[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const locked = useRef(false);
  const mounted = useRef(false);
  const gate = {
    begin: () => {
      if (locked.current) return false;
      locked.current = true;
      setBusy(true);
      return true;
    },
    end: () => {
      locked.current = false;
      if (mounted.current) setBusy(false);
    },
    isMounted: () => mounted.current,
  };
  const journal = useGuestJournal(gate);
  const { setJournal, setChapter } = journal;
  const museumReplay = usePublicReplay(gate, setError);
  const { setPublicReplay } = museumReplay;

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    async function load() {
      try {
        const data = await request(
          "/api/game",
          guestSessionSchema.parse,
          undefined,
          controller.signal,
        );
        setMuseum(data.museum);
        setJournal(data.journal);
        setRun(data.run);
      } catch (problem) {
        if (!controller.signal.aborted)
          setError(
            problem instanceof Error
              ? problem.message
              : "Could not load your guest session.",
          );
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }
    void load();
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, [setJournal]);

  async function mutate(input: Record<string, unknown>) {
    if (!gate.begin()) return;
    setError("");
    setPending(input);
    try {
      const data = await request("/api/game", guestMutationSchema.parse, input);
      if (!mounted.current) return;
      if (data.run) setRun(data.run);
      else {
        const session = await request("/api/game", guestSessionSchema.parse);
        setRun(session.run);
        setMuseum(session.museum);
      }
      setJournal(data.journal);
      if (input.operation === "start" || input.operation === "race") {
        setPublicReplay(null);
        setChapter(null);
        router.push(
          input.exhibitId
            ? `/play?challenge=${encodeURIComponent(String(input.exhibitId))}#adventure`
            : "/play#adventure",
        );
        document.getElementById("adventure")?.focus();
      }
      setPending(null);
    } catch (problem) {
      if (mounted.current)
        setError(
          problem instanceof Error
            ? problem.message
            : "Action failed. Retry the saved operation.",
        );
    } finally {
      gate.end();
    }
  }
  function start(
    exhibitId: string | null = null,
    retryOf: string | null = null,
  ) {
    void mutate(guestStartRequest(selectedCharacter, exhibitId, retryOf));
  }

  return {
    run,
    selectedCharacter,
    setSelectedCharacter,
    museum,
    ...journal,
    ...museumReplay,
    raceChapter: (chapterId: string): void =>
      void mutate({ operation: "race", id: crypto.randomUUID(), chapterId }),
    busy,
    error,
    pending,
    mutate,
    start,
    refreshMuseum: async () => {
      const session = await request("/api/game", guestSessionSchema.parse);
      setMuseum(session.museum);
      setJournal(session.journal);
    },
  };
}
