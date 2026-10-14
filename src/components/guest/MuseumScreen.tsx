"use client";

import Link from "next/link";
import { Museum } from "../Museum";
import { useGuestSession } from "./GuestProvider";

export function MuseumScreen() {
  const game = useGuestSession();
  if (game.busy && !game.museum.length)
    return <p role="status">Loading the museum…</p>;
  return (
    <>
      <Museum {...game} />
      <p className="museum-journal-link">
        Already tried an exhibit?{" "}
        <Link href="/journal">Your rematches are in My journal.</Link>
      </p>
    </>
  );
}
