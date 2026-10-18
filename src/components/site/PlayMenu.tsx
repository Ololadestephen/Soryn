"use client";
import { playMenuSchema } from "../../domain/responses";
import { useEffect, useState } from "react";
import Link from "next/link";
import { playModes, type PlayMenuState } from "../../domain/navigation";
import { request } from "../request";
export function PlayMenu() {
  const [saved, setSaved] = useState<PlayMenuState | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void request(
      "/api/menu",
      playMenuSchema.parse,
      undefined,
      controller.signal,
    )
      .then(setSaved)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, []);
  return (
    <section className="play-menu" aria-labelledby="play-title">
      <h1 id="play-title">Play</h1>
      {saved?.matchInvite && (
        <Link
          prefetch={false}
          className="play-resume"
          href={`/challenge/${saved.matchInvite}`}
        >
          Resume match
        </Link>
      )}
      <div className="play-modes">
        {playModes.map((mode, index) => (
          <Link
            prefetch={false}
            className="play-mode"
            key={mode.kind}
            href={mode.href}
          >
            <span className="play-mode-number" aria-hidden="true">
              0{index + 1}
            </span>
            <h2>{mode.name}</h2>
            <p>{mode.description}</p>
            <span className="play-mode-state">
              {mode.kind === "practice" ? "Free" : "Holder access"}
            </span>
            {mode.kind === "story" && saved && (
              <span className="play-mode-state">
                {saved.story === "begin"
                  ? "Begin Story"
                  : saved.story === "ending"
                    ? "View your ending"
                    : "Continue Story"}
              </span>
            )}
            {mode.kind === "practice" && saved?.practice && (
              <span className="play-mode-state">Resume saved practice</span>
            )}
          </Link>
        ))}
      </div>
      {error && (
        <p role="status">
          Saved progress is unavailable right now. You can still choose a mode.
        </p>
      )}
      <p className="muted">
        Story and player battles require 50 $CHOG or a Chog NFT. No tokens are
        spent.
      </p>
      <p>
        <Link href="/arena?as=holder">Holder Practice</Link> ·{" "}
        <Link href="/history?as=holder">Wallet history</Link>
      </p>
    </section>
  );
}
