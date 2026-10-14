"use client";

import { useState } from "react";
import type { GuestJournalView } from "../../domain/journal";
import type { RunView } from "../../domain/views";
import { request } from "../request";
import type { GuestRequestGate } from "./requestGate";

export function useGuestJournal(gate: GuestRequestGate) {
  const [journal, setJournal] = useState<GuestJournalView>({
    chapters: [],
    challenges: [],
  });
  const [selection, setSelection] = useState<{
    chapter: RunView | null;
    error: string;
    requestedId: string | null;
  }>({ chapter: null, error: "", requestedId: null });

  async function openChapter(id: string) {
    if (!gate.begin()) return;
    setSelection((previous) => ({ ...previous, error: "", requestedId: id }));
    try {
      const data = await request<{ chapter: RunView }>(
        `/api/game?chapter=${id}`,
      );
      if (gate.isMounted())
        setSelection((previous) => ({ ...previous, chapter: data.chapter }));
    } catch (problem) {
      if (gate.isMounted())
        setSelection((previous) => ({
          ...previous,
          error:
            problem instanceof Error
              ? problem.message
              : "Saved chapter unavailable.",
        }));
    } finally {
      gate.end();
    }
  }
  return {
    journal,
    setJournal,
    chapter: selection.chapter,
    chapterError: selection.error,
    setChapter: (chapter: RunView | null) =>
      setSelection({ chapter, error: "", requestedId: null }),
    openChapter,
    retryChapter: () => {
      if (selection.requestedId) void openChapter(selection.requestedId);
    },
  };
}
