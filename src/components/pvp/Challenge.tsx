"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BattleStage } from "../combat/BattleStage";
import { usePlayback } from "../combat/usePlayback";
import { prepareSelectedAssets } from "../combat/loading";
import { usePvp } from "./usePvp";
import { RoomLobby } from "./RoomLobby";
import { ModalPanel } from "../combat/ModalPanel";
import { useTurnClock } from "./useTurnClock";
import { usePlayIdentity } from "../auth/PlayIdentity";

export function ChallengeHome() {
  const identity = usePlayIdentity();
  const game = usePvp();
  const router = useRouter();
  const [error, setError] = useState("");
  const [invitation, setInvitation] = useState("");
  function joinInvitation() {
    setError("");
    const raw = invitation.trim();
    if (/^[A-Za-z0-9_-]{20,80}$/.test(raw)) {
      router.push(
        `/challenge/${raw}${identity.mode === "official" ? "?as=chog" : identity.walletPlay ? "?as=holder" : ""}`,
      );
      return;
    }
    try {
      const link = new URL(raw, window.location.origin);
      if (
        link.origin !== window.location.origin ||
        !/^\/challenge\/[A-Za-z0-9_-]{20,80}$/.test(link.pathname)
      )
        throw new Error("Invalid invitation.");
      router.push(
        link.pathname +
          (identity.mode === "official"
            ? "?as=chog"
            : identity.walletPlay
              ? "?as=holder"
              : ""),
      );
    } catch {
      setError("Paste a Soryn invitation from this site or its room code.");
    }
  }
  async function create() {
    setError("");
    try {
      const room = await game.create();
      if (room && "invite" in room)
        router.push(
          `/challenge/${room.invite}${identity.mode === "official" ? "?as=chog" : identity.walletPlay ? "?as=holder" : ""}`,
        );
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Try again.");
    }
  }
  return (
    <section className="pvp-home" aria-label="Challenge a friend">
      <p className="eyebrow">Private battle · two seats</p>
      <h1>Challenge a friend.</h1>
      <p>
        Share an invitation to battle a friend. The link opens a seat; it never
        controls an occupied one.
      </p>
      {game.session?.activeInvite && (
        <p>
          <Link
            href={`/challenge/${game.session.activeInvite}${identity.mode === "official" ? "?as=chog" : identity.walletPlay ? "?as=holder" : ""}`}
          >
            Return to your current room
          </Link>
        </p>
      )}
      <button disabled={game.busy} onClick={() => void create()}>
        Create invitation
      </button>
      <form
        className="friend-join"
        onSubmit={(event) => {
          event.preventDefault();
          joinInvitation();
        }}
      >
        <label htmlFor="friend-invitation">Invitation link or room code</label>
        <input
          id="friend-invitation"
          value={invitation}
          onChange={(event) => setInvitation(event.target.value)}
          autoComplete="off"
          maxLength={300}
        />
        <button disabled={!invitation.trim()}>Join a room</button>
      </form>
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
  const { presentation, playRound, clear } = usePlayback();
  const room = game.room;
  const battle = room?.battle ?? null;
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  const previous = useRef<typeof battle>(null);
  useEffect(() => {
    if (
      room?.phase === "choose" ||
      room?.phase === "loading" ||
      room?.phase === "intermission"
    )
      clear();
  }, [room?.phase, clear]);
  const nextPlayer = battle?.snapshot.player.id;
  const nextOpponent = battle?.snapshot.opponent.id;
  const nextArena = battle?.arena;
  useEffect(() => {
    if (room?.phase !== "intermission" || !nextPlayer || !nextOpponent) return;
    void prepareSelectedAssets(
      nextPlayer,
      nextOpponent,
      nextArena ?? "sanctuary",
    );
  }, [room?.phase, nextPlayer, nextOpponent, nextArena]);
  useEffect(() => {
    const current = battle;
    if (!current) {
      previous.current = null;
      clear();
      return;
    }
    const prior = previous.current;
    previous.current = current;
    if (prior?.id !== current.id) {
      clear();
      return;
    }
    if (
      prior &&
      prior.id === current.id &&
      current.rounds.length === prior.rounds.length + 1
    )
      void playRound(current, prior);
  }, [battle, playRound, clear]);
  useEffect(() => {
    if (!room) return;
    const path = `${room.origin === "public" ? "/match" : "/challenge"}/${token}`;
    if (window.location.pathname !== path)
      router.replace(
        path +
          (room.you.mode === "official"
            ? "?as=chog"
            : room.you.accessKind
              ? "?as=holder"
              : ""),
      );
  }, [room?.origin, room?.you.mode, token, router, room]);
  if (!room && !game.preview && !game.error)
    return <p role="status">Opening the room…</p>;
  if (game.preview) return <JoinPanel game={game} />;
  if (
    !room ||
    !battle ||
    ["waiting", "joined", "ready", "expired", "closed"].includes(room.phase)
  )
    return (
      <RoomLobby
        game={game}
        leave={() => {
          void game.run(async () => {
            await game.leave();
            router.push(
              (room?.origin === "public" ? "/match" : "/challenge") +
                (room?.you.mode === "official"
                  ? "?as=chog"
                  : room?.you.accessKind
                    ? "?as=holder"
                    : ""),
            );
          });
        }}
      />
    );
  const between = room.phase === "intermission";
  const finished = room.series
    ? room.series.phase === "complete"
    : room.phase === "complete";
  const score = room.series
    ? `Series ${room.series.you}–${room.series.opponent}`
    : undefined;
  return (
    <>
      <BattleStage
        key={battle.id}
        battle={battle}
        busy={game.busy || !!presentation}
        presentation={presentation}
        mode={battle.mode}
        rival={room.opponent?.name ?? "Opponent"}
        step={(move) => {
          void game.run(() => game.move(battle.state.round, move));
        }}
        rematch={() => {
          void game.run(() => game.continueSeries());
        }}
        exit={() =>
          finished ? router.push("/start") : setConfirmSurrender(true)
        }
        error={game.error}
        pending={false}
        retry={() => void game.refresh()}
        recover={() => void game.refresh()}
        onAssetsReady={() => game.assets()}
        pvp={{
          origin: room.origin,
          finished,
          prompt: room.prompt,
          detail: room.detail,
          connected: room.opponent?.connected ?? false,
          seconds: clock,
          input: room.phase === "choose" && !room.you.move ? "open" : "closed",
          headline: room.result?.headline,
          explanation: room.result?.explanation,
          rematchNote: between
            ? "Continue when ready. The next battle also starts when the intermission ends."
            : undefined,
          score,
          nextLabel: between ? "Continue" : undefined,
          exitLabel: "Surrender series",
        }}
      />
      {confirmSurrender && (
        <ModalPanel
          title="Surrender this series?"
          onClose={() => setConfirmSurrender(false)}
        >
          <p>
            Surrender ends this series and awards your opponent a forfeit. Your
            completed battles remain in history.
          </p>
          {game.error && <p role="alert">{game.error}</p>}
          <button
            disabled={game.busy}
            onClick={() => {
              void game.run(async () => {
                await game.surrender();
                setConfirmSurrender(false);
              });
            }}
          >
            Surrender series
          </button>
          <button
            className="secondary"
            onClick={() => setConfirmSurrender(false)}
          >
            Keep playing
          </button>
        </ModalPanel>
      )}
    </>
  );
}

function JoinPanel({ game }: { game: ReturnType<typeof usePvp> }) {
  const preview = game.preview;
  if (preview?.origin === "public")
    return (
      <section className="pvp-home" aria-label="Public match">
        <h1>This match is unavailable.</h1>
        <p>Only the paired players can enter this match.</p>
        <Link href="/match">Find a match</Link>
      </section>
    );
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
        <button
          disabled={game.busy}
          onClick={() => void game.run(() => game.join())}
        >
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
