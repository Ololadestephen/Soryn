import Link from "next/link";
import { useState } from "react";
import { ArenaPicker } from "../combat/ArenaPicker";
import { AudioControls } from "../combat/audio/AudioControls";
import { FighterPicker } from "./FighterPicker";
import type { usePvp } from "./usePvp";

export function RoomLobby({
  game,
  leave,
}: {
  game: ReturnType<typeof usePvp>;
  leave: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const room = game.room;
  if (!room)
    return (
      <>
        <p role="status">Opening the room…</p>
        {game.error && <p role="alert">{game.error}</p>}
      </>
    );
  const publicMatch = room.origin === "public";
  const official =
    room.you.mode === "official"
      ? "?as=chog"
      : room.you.accessKind
        ? "?as=holder"
        : "";
  const ended =
    room.phase === "expired" ||
    room.phase === "closed" ||
    room.phase === "complete";
  if (ended)
    return (
      <section className="pvp-lobby" aria-label="Match result">
        <p className="eyebrow">
          {publicMatch ? "Public match" : "Friend match"}
        </p>
        <h1>
          {room.series?.phase === "complete" ? room.prompt : "Match ended"}
        </h1>
        <p>{room.notice ?? room.detail ?? "This room is no longer active."}</p>
        {game.error && <p role="alert">{game.error}</p>}
        <Link
          className="button"
          href={`${publicMatch ? "/match" : "/challenge"}${official}`}
        >
          {publicMatch ? "Find another match" : "Challenge a friend"}
        </Link>
        <Link href="/start">Back to modes</Link>
      </section>
    );
  const path = `/challenge/${room.invite}${official}`;
  const link =
    typeof window === "undefined"
      ? path
      : new URL(path, window.location.origin).href;
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setCopyError("");
    } catch {
      setCopyError("Copy unavailable. Select and copy the invitation link.");
    }
  }
  return (
    <section
      className="pvp-lobby"
      aria-label={publicMatch ? "Public match setup" : "Private battle setup"}
    >
      <header className="pvp-room-heading">
        <p className="eyebrow">
          {publicMatch ? "Public match" : "Friend match"} ·{" "}
          {room.you.mode === "official"
            ? "NFT competitor"
            : room.you.accessKind
              ? "Wallet player"
              : "Guest"}
        </p>
        <h1>{room.you.ready ? "Ready" : "Choose your fighter"}</h1>
        <p className="pvp-opponent" role="status">
          {room.opponent ? (
            <>
              <strong>{room.opponent.name}</strong>
              <span>
                {room.opponent.connected
                  ? room.opponent.ready
                    ? "Ready"
                    : "Opponent is choosing"
                  : "Reconnecting…"}
              </span>
            </>
          ) : (
            "Waiting for an opponent"
          )}
        </p>
        {publicMatch && (
          <small className="muted">
            {Math.max(0, Math.ceil((room.expiresAt - room.serverNow) / 1000))}s
            to ready
          </small>
        )}
      </header>
      <div className="pvp-room-feedback">
        {room.notice && (
          <p role="status" className="pvp-room-notice">
            {room.notice}
          </p>
        )}
        {game.error && <p role="alert">{game.error}</p>}
      </div>
      <div
        className="pvp-room-content"
        role="region"
        aria-label="Fighter selection and options"
        tabIndex={0}
      >
        {!publicMatch && (
          <details className="pvp-sharing" open={!room.opponent}>
            <summary>Invite a friend</summary>
            <div className="pvp-share">
              <label>
                Invitation link
                <input
                  readOnly
                  value={link}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </label>
              <button onClick={() => void copy()}>
                {copied ? "Copied" : "Copy invitation"}
              </button>
              {copyError && <p role="alert">{copyError}</p>}
            </div>
          </details>
        )}
        <FighterPicker
          selected={room.you.characterId}
          disabled={game.busy || room.you.ready}
          startersOnly={room.roster !== "private"}
          publicSix={room.roster === "public-six"}
          allowed={room.you.fighters}
          holder={room.you.mode === "official"}
          onSelect={(id) => void game.run(() => game.select(id))}
        />
        <div className="pvp-room-options">
          <details>
            <summary>Battle options</summary>
            <ArenaPicker
              value={room.arenaChoice}
              disabled={game.busy || room.you.ready}
              onChange={(choice) => void game.run(() => game.arena(choice))}
            />
            <AudioControls />
          </details>
          <details>
            <summary>How it works</summary>
            <p>
              First to two battle wins. A draw replays the battle; two
              consecutive draws end the series. Two missed turns forfeit the
              series. Refreshing or reconnecting keeps the same game and
              deadline.
            </p>
            <p>
              Leaving after combat starts surrenders the series. Finished
              results stay in your private history.{" "}
              {publicMatch
                ? "The queue pairs waiting players; Practice is the separate computer mode."
                : "An invitation opens a seat; it never controls an occupied one."}
            </p>
          </details>
        </div>
      </div>
      <div className="pvp-ready-bar" role="group" aria-label="Match actions">
        <div>
          <button
            disabled={game.busy || !room.you.characterId || room.you.ready}
            onClick={() => void game.run(() => game.ready(true))}
          >
            {room.you.ready ? "Ready" : "Ready up"}
          </button>
          {room.you.ready && (
            <button
              className="secondary"
              disabled={game.busy}
              onClick={() => void game.run(() => game.ready(false))}
            >
              Not ready
            </button>
          )}
        </div>
        <button
          className="pvp-leave secondary"
          disabled={game.busy}
          onClick={leave}
        >
          Leave match
        </button>
      </div>
    </section>
  );
}
