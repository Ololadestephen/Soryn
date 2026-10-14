import { character, type CharacterId } from "../characters/definitions";
import type { BattleView } from "../combat/contracts";
import { legalMoves } from "../combat/moves";
import { arenas } from "../combat/arenas";
import { PvpError } from "./errors";
import { mirrorBattle } from "./mirror";
import {
  invitationExpired,
  otherSeat,
  seatIds,
  seatOf,
  type PvpMatch,
  type PvpResult,
  type PvpRoom,
  type PvpSeat,
  type SeatId,
} from "./types";

export type ViewPhase =
  | "waiting"
  | "joined"
  | "ready"
  | "loading"
  | "choose"
  | "present"
  | "complete"
  | "expired"
  | "closed";

export interface PvpHistoryRow {
  matchId: string;
  headline: "Victory" | "Defeat" | "Draw" | "No contest";
  explanation: string;
  rounds: number;
  fighter: string;
  opponent: string;
  arena: string;
}

export interface PvpView {
  seated: true;
  revision: number;
  serverNow: number;
  invite: string;
  phase: ViewPhase;
  prompt: string;
  detail: string | null;
  you: {
    name: string;
    characterId: CharacterId | null;
    ready: boolean;
    connected: boolean;
    move: "basic" | "special" | "guard" | null;
  };
  opponent: {
    name: string;
    characterId: CharacterId | null;
    ready: boolean;
    connected: boolean;
    locked: boolean;
    joined: true;
  } | null;
  arenaChoice: PvpRoom["arenaChoice"];
  arenaName: string | null;
  deadlineAt: number | null;
  expiresAt: number;
  battle: BattleView | null;
  result: {
    headline: PvpHistoryRow["headline"];
    explanation: string;
    kind: PvpResult["kind"];
  } | null;
  rematch: { you: boolean; opponent: boolean };
  latestSeq: number;
  notice: string | null;
  history: PvpHistoryRow[];
}

function headline(result: PvpResult, you: SeatId): PvpHistoryRow["headline"] {
  if (result.kind === "abandoned") return "No contest";
  if (!result.winner) return "Draw";
  return result.winner === you ? "Victory" : "Defeat";
}

function battleFor(match: PvpMatch, you: SeatId, mode: "guest" | "official") {
  const battle: BattleView = {
    id: match.id,
    arena: match.arena,
    mode,
    tokenId: null,
    snapshot: match.snapshot,
    state: match.state,
    rounds: match.rounds,
    legal: legalMoves(match.snapshot, match.state, "player"),
  };
  return you === "a" ? battle : mirrorBattle(battle);
}

function row(
  match: PvpMatch,
  you: SeatId,
  foeName: string,
): PvpHistoryRow | null {
  if (!match.result) return null;
  const yours =
    you === "a" ? match.snapshot.player.id : match.snapshot.opponent.id;
  const theirs =
    you === "a" ? match.snapshot.opponent.id : match.snapshot.player.id;
  return {
    matchId: match.id,
    headline: headline(match.result, you),
    explanation: match.result.explanation,
    rounds: match.rounds.length,
    fighter: character(yours).name,
    opponent: `${foeName} · ${character(theirs).name}`,
    arena: arenas[match.arena].name,
  };
}

function lobbyPhase(self: PvpSeat, other: PvpSeat | null) {
  if (!other)
    return {
      phase: "waiting" as const,
      prompt: "Waiting for your friend",
      detail: null,
    };
  if (self.ready && !other.ready)
    return {
      phase: "ready" as const,
      prompt: "Waiting for your friend to ready",
      detail: null,
    };
  if (!self.ready && other.ready)
    return {
      phase: "joined" as const,
      prompt: "Your friend is ready",
      detail: null,
    };
  return {
    phase: "joined" as const,
    prompt: self.characterId
      ? "Ready up when you are set"
      : "Choose your fighter",
    detail: null,
  };
}

function battlePhase(match: PvpMatch, you: SeatId) {
  if (match.phase === "loading")
    return {
      phase: "loading" as const,
      prompt: "Preparing the battle",
      detail: null,
    };
  if (match.phase === "present")
    return {
      phase: "present" as const,
      prompt: "Watching this round",
      detail: null,
    };
  if (match.phase === "complete")
    return {
      phase: "complete" as const,
      prompt: match.result?.explanation ?? "Battle complete",
      detail: null,
    };
  const locked = match.locks[you]?.round === match.state.round;
  const waiting = match.locks[otherSeat(you)]?.round === match.state.round;
  if (locked)
    return {
      phase: "choose" as const,
      prompt: "Move locked",
      detail: waiting ? null : "Waiting for opponent",
    };
  return { phase: "choose" as const, prompt: "Choose your move", detail: null };
}

function phaseOf(room: PvpRoom, you: SeatId, now: number) {
  if (room.closedAt)
    return {
      phase: "closed" as const,
      prompt: "This room is closed.",
      detail: null,
    };
  if (invitationExpired(room, now))
    return {
      phase: "expired" as const,
      prompt: "This invitation has expired.",
      detail: null,
    };
  const self = room.seats[you];
  if (!self) throw new PvpError(409, "This battle is missing a seat.");
  if (!room.match) return lobbyPhase(self, room.seats[otherSeat(you)]);
  return battlePhase(room.match, you);
}

function ownMove(match: PvpMatch | null, you: SeatId) {
  if (!match || match.phase !== "choose") return null;
  const lock = match.locks[you];
  if (!lock || lock.round !== match.state.round) return null;
  return lock.move;
}

export function presentRoom(
  room: PvpRoom,
  actor: string,
  now: number,
): PvpView {
  const you = seatOf(room, actor);
  if (!you) throw new PvpError(403, "You are not seated in this battle.");
  const self = room.seats[you]!;
  const otherId = otherSeat(you);
  const other = room.seats[otherId];
  const described = phaseOf(room, you, now);
  const match = room.match;
  const connected = (seen: number) => now - seen <= room.timers.disconnectMs;
  const foeName = other?.name ?? "Friend";
  const history = room.completed
    .map((entry) => row(entry, you, foeName))
    .filter((entry): entry is PvpHistoryRow => !!entry);
  const current = match ? row(match, you, foeName) : null;
  if (current) history.push(current);
  const yourLock = ownMove(match, you);
  const otherLocked =
    !!match &&
    match.phase === "choose" &&
    match.locks[otherId]?.round === match.state.round;
  return {
    seated: true,
    revision: room.revision,
    serverNow: now,
    invite: room.invite,
    phase: described.phase,
    prompt: described.prompt,
    detail: described.detail,
    you: {
      name: self.name,
      characterId: self.characterId,
      ready: self.ready,
      connected: connected(self.lastSeenAt),
      move: yourLock,
    },
    opponent: other
      ? {
          name: other.name,
          characterId: other.characterId,
          ready: other.ready,
          connected: connected(other.lastSeenAt),
          locked: otherLocked,
          joined: true,
        }
      : null,
    arenaChoice: room.arenaChoice,
    arenaName: match ? arenas[match.arena].name : null,
    deadlineAt: match && match.phase !== "complete" ? match.deadlineAt : null,
    expiresAt: room.expiresAt,
    battle: match ? battleFor(match, you, self.mode) : null,
    result: match?.result
      ? {
          headline: headline(match.result, you),
          explanation: match.result.explanation,
          kind: match.result.kind,
        }
      : null,
    rematch: { you: self.rematch, opponent: !!other?.rematch },
    latestSeq: match?.eventSeq ?? 0,
    notice: self.notice,
    history,
  };
}

export interface PvpPreview {
  seated: false;
  status: "open" | "full" | "expired" | "closed";
  names: string[];
  openSeats: number;
}

export function previewRoom(room: PvpRoom, now: number): PvpPreview {
  if (room.match) throw new PvpError(403, "This battle is private.");
  const names = [room.seats.a?.name, room.seats.b?.name].filter(
    (name): name is string => !!name,
  );
  const openSeats = seatIds.filter((seat) => !room.seats[seat]).length;
  const status = room.closedAt
    ? "closed"
    : invitationExpired(room, now)
      ? "expired"
      : openSeats === 0
        ? "full"
        : "open";
  return { seated: false, status, names, openSeats };
}
