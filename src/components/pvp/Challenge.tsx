"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  character,
  characters,
  type CharacterId,
} from "../../domain/characters/definitions";
import type { ArenaChoice } from "../../domain/combat/arenas";
import { BattleStage } from "../combat/BattleStage";
import { ArenaPicker } from "../combat/ArenaPicker";
import { AudioControls } from "../combat/audio/AudioControls";
import { usePlayback } from "../combat/usePlayback";
import { IdleArt } from "../site/landing/IdleArt";
import { companions } from "../combat/rendered/catalogue";
import landingAssets from "../site/landing/assets.json";
import Image from "next/image";
import { usePvp } from "./usePvp";
import { useTurnClock } from "./useTurnClock";

export function ChallengeHome() {
  const game = usePvp();
  const router = useRouter();
  const [error, setError] = useState("");
  async function create() {
    setError("");
    try {
      const room = await game.create();
      if (room && "invite" in room) router.push(`/challenge/${room.invite}`);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Try again.");
    }
  }
  return (
    <section className="pvp-home" aria-label="Challenge a friend">
      <p className="eyebrow">Private battle · two seats</p>
      <h1>Challenge a friend.</h1>
      <p>
        Create an invitation, send the link, and battle when you are both ready.
        Four starters need no wallet. The invitation lets a friend sit down. It
        does not control your seat.
      </p>
      {game.session?.activeInvite && (
        <p>
          <Link href={`/challenge/${game.session.activeInvite}`}>
            Return to your current room
          </Link>
        </p>
      )}
      <button disabled={game.busy} onClick={() => void create()}>
        Create invitation
      </button>
      {(error || game.error) && <p role="alert">{error || game.error}</p>}
      <p>
        <Link href="/arena">Practice against the computer</Link>
      </p>
    </section>
  );
}

export function ChallengeRoom({ token }: { token: string }) {
  const game = usePvp(token);
  const clock = useTurnClock(game.room);
  const router = useRouter();
  const { presentation, playRound } = usePlayback();
  const room = game.room;
  const battle = room?.battle ?? null;
  const [copied, setCopied] = useState(false);
  const previous = useRef<typeof battle>(null);
  useEffect(() => {
    const current = battle;
    if (!current) {
      previous.current = null;
      return;
    }
    const prior = previous.current;
    previous.current = current;
    if (
      prior &&
      prior.id === current.id &&
      current.rounds.length === prior.rounds.length + 1
    )
      void playRound(current, prior);
  }, [battle, playRound]);
  const link =
    typeof window === "undefined"
      ? `/challenge/${token}`
      : window.location.href;
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  if (!room && !game.preview && !game.error)
    return <p role="status">Opening the room…</p>;
  if (game.preview) return <JoinPanel game={game} />;
  if (
    !room ||
    !battle ||
    room.phase === "waiting" ||
    room.phase === "joined" ||
    room.phase === "ready" ||
    room.phase === "expired" ||
    room.phase === "closed"
  )
    return (
      <Lobby
        token={token}
        link={link}
        copied={copied}
        copy={copy}
        game={game}
        leave={() => {
          void (async () => {
            try {
              await game.leave();
              router.push("/challenge");
            } catch {
              /* The room already shows the reason. */
            }
          })();
        }}
      />
    );
  const rematchNote = room.rematch.you
    ? "Waiting for your friend to accept the rematch."
    : room.rematch.opponent
      ? "Your friend wants a rematch."
      : undefined;
  return (
    <BattleStage
      battle={battle}
      busy={game.busy}
      presentation={presentation}
      mode={battle.mode}
      rival={room.opponent?.name ?? "Friend"}
      step={(move) => void game.move(battle.state.round, move)}
      rematch={() => void game.rematch()}
      exit={() => void game.setup()}
      error={game.error}
      pending={false}
      retry={() => void game.refresh()}
      recover={() => void game.refresh()}
      onAssetsReady={() => void game.assets()}
      pvp={{
        prompt: room.prompt,
        detail: room.detail,
        connected: room.opponent?.connected ?? false,
        seconds: clock,
        input: room.phase === "choose" && !room.you.move ? "open" : "closed",
        headline: room.result?.headline,
        explanation: room.result?.explanation,
        rematchNote,
        rematchRequested: room.rematch.you,
      }}
    />
  );
}

function JoinPanel({ game }: { game: ReturnType<typeof usePvp> }) {
  const preview = game.preview;
  const closed = preview?.status === "closed" || preview?.status === "expired";
  return (
    <section className="pvp-home" aria-label="Join a private battle">
      <h1>
        {preview?.status === "full"
          ? "This room is full."
          : preview?.status === "expired"
            ? "This invitation has expired."
            : preview?.status === "closed"
              ? "This room is closed."
              : "Your friend saved you a seat."}
      </h1>
      {!!preview?.names.length && (
        <p>Already here: {preview.names.join(", ")}</p>
      )}
      {!closed && preview?.status !== "full" && (
        <button disabled={game.busy} onClick={() => void game.join()}>
          Take the open seat
        </button>
      )}
      {game.error && <p role="alert">{game.error}</p>}
      <p>
        <Link href="/challenge">Create your own invitation</Link>
      </p>
    </section>
  );
}

function Lobby({
  token,
  link,
  copied,
  copy,
  game,
  leave,
}: {
  token: string;
  link: string;
  copied: boolean;
  copy: () => Promise<void>;
  game: ReturnType<typeof usePvp>;
  leave: () => void;
}) {
  const room = game.room;
  if (!room) return <p role="status">Opening the room…</p>;
  const fighting =
    room.phase === "loading" ||
    room.phase === "choose" ||
    room.phase === "present" ||
    room.phase === "complete";
  if (fighting) return null;
  return (
    <section
      className="pvp-lobby combat-screen"
      aria-label="Private battle setup"
    >
      <p className="eyebrow">You are {room.you.name}</p>
      <h1>{room.prompt}</h1>
      {room.detail && <p>{room.detail}</p>}
      {room.notice && <p role="status">{room.notice}</p>}
      {game.error && <p role="alert">{game.error}</p>}
      <div className="pvp-share">
        <label>
          Invitation
          <input
            readOnly
            value={link}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
        <button onClick={() => void copy()}>
          {copied ? "Copied" : "Copy invitation"}
        </button>
        <p>Room code: {token}</p>
      </div>
      <p role="status">
        {room.opponent
          ? `${room.opponent.name} · ${room.opponent.connected ? "Connected" : "Disconnected"}${room.opponent.ready ? " · Ready" : ""}`
          : "Waiting for your friend"}
      </p>
      {room.phase !== "expired" && room.phase !== "closed" && (
        <>
          <FighterPicker
            selected={room.you.characterId}
            disabled={game.busy}
            onSelect={(id) => void game.select(id)}
          />
          <ArenaPicker
            value={room.arenaChoice}
            disabled={game.busy}
            onChange={(choice: ArenaChoice) => void game.arena(choice)}
          />
          <AudioControls />
          <div className="button-row">
            <button
              disabled={game.busy || !room.you.characterId || room.you.ready}
              onClick={() => void game.ready(true)}
            >
              {room.you.ready ? "Ready" : "Ready up"}
            </button>
            {room.you.ready && (
              <button
                disabled={game.busy}
                onClick={() => void game.ready(false)}
              >
                Not ready
              </button>
            )}
            <button disabled={game.busy} onClick={leave}>
              Leave room
            </button>
            <button disabled={game.busy} onClick={() => void game.close()}>
              Close invitation
            </button>
          </div>
        </>
      )}
      <p className="muted">
        Holder fighters stay locked until My Chog verifies ownership. This match
        uses the current battle rules and is not a balance claim.
      </p>
    </section>
  );
}

function FighterPicker({
  selected,
  disabled,
  onSelect,
}: {
  selected: CharacterId | null;
  disabled: boolean;
  onSelect: (id: CharacterId) => void;
}) {
  return (
    <fieldset className="fighter-roster" disabled={disabled}>
      <legend>Choose your fighter</legend>
      {selected && (
        <p>
          {character(selected).name} & {companions[selected]}
        </p>
      )}
      {selected && <IdleArt key={selected} id={selected} companion />}
      {characters.map((entry) => {
        const locked = entry.access === "holder";
        return (
          <label
            key={entry.id}
            className={`fighter-option${locked ? " fighter-locked" : ""}${selected === entry.id ? " fighter-selected" : ""}`}
          >
            <Image
              className="combat-art"
              unoptimized
              loading="lazy"
              src={landingAssets[entry.id].thumbnail}
              alt=""
              width={128}
              height={128}
            />
            <span>
              <strong>{entry.name}</strong>
              <span>{entry.role}</span>
              <span>{locked ? "Holder only" : "Available"}</span>
            </span>
            <input
              type="radio"
              name="pvp-fighter"
              value={entry.id}
              checked={selected === entry.id}
              disabled={locked}
              onChange={() => onSelect(entry.id)}
              aria-label={`${entry.name} / ${entry.role}`}
            />
          </label>
        );
      })}
    </fieldset>
  );
}
