"use client";
import { useState } from "react";
import type { PublicChapter } from "../../domain/officialViews";
import type { TokenIdentity } from "../../domain/identity";
import { observe, replay } from "../../domain/game/engine";
import { raceGhost } from "../../domain/ghosts/policy";
import { Replay } from "../adventure/Replay";
import { request } from "../request";

export function PublicChapters({
  tokenId,
  chapters,
}: {
  tokenId: string;
  chapters: PublicChapter[];
}) {
  return (
    <div className="public-chapters">
      <h3>Token {tokenId} · public chapters</h3>
      <p>
        Only consented chapters appear here. Aliases and frozen ghosts remain
        attributed to their original contributors. Viewing them makes future
        attempts informed retries for this browser or wallet.
      </p>
      {chapters.length === 0 && (
        <p className="muted">
          No public chapters yet. Private drafts are never inherited.
        </p>
      )}
      {chapters.map((chapter) => (
        <article className="panel" key={chapter.id}>
          <h3>{chapter.title}</h3>
          <p>
            By {chapter.alias} · {chapter.actions.length} decisions
          </p>
          <details>
            <summary>About this chapter’s ghost</summary>
            <p className="muted">
              Frozen policy {chapter.ghost.profile.policy}, version{" "}
              {chapter.ghost.version.slice(0, 12)}. Based on this consented
              chapter alone.
            </p>
          </details>
          <details>
            <summary>Open public replay and ghost race</summary>
            <Replay
              frames={replay(chapter.scenario, chapter.actions).map(observe)}
            />
            <p>
              Public ghost support:{" "}
              {chapter.ghost.profile.rooms
                .map((room) => room.entries)
                .join(" / ")}{" "}
              room entries. Private training is excluded.
            </p>
            <Replay
              frames={replay(
                chapter.scenario,
                raceGhost(chapter.ghost.profile, chapter.scenario).actions,
              ).map(observe)}
            />
          </details>
        </article>
      ))}
    </div>
  );
}
export function PublicChapterLookup() {
  const [tokenId, setTokenId] = useState("");
  const [history, setHistory] = useState<{
    identity: TokenIdentity;
    chapters: PublicChapter[];
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="panel public-chapter-lookup">
      <h3>Read a Chog’s public history.</h3>
      <p>
        No wallet required. History is keyed by the actual token ID; an empty
        history does not verify a token’s existence or ownership.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            setHistory(
              await request(
                `/api/identity?tokenId=${encodeURIComponent(tokenId)}`,
              ),
            );
          } catch (problem) {
            setError(
              problem instanceof Error
                ? problem.message
                : "History unavailable.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Public history token ID
          <input
            name="history-token-id"
            inputMode="numeric"
            pattern="(0|[1-9][0-9]*)"
            maxLength={78}
            value={tokenId}
            onChange={(event) => setTokenId(event.target.value)}
            required
          />
        </label>
        <button disabled={busy}>Read public chapters</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {history && (
        <PublicChapters
          tokenId={history.identity.tokenId}
          chapters={history.chapters}
        />
      )}
    </div>
  );
}
