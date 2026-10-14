"use client";

import { Journal } from "./Journal";
import { useGuestSession } from "./GuestProvider";

export function JournalScreen() {
  const game = useGuestSession();
  if (game.busy && !game.journal.chapters.length)
    return <p role="status">Loading your guest journal…</p>;
  return <Journal {...game} />;
}
