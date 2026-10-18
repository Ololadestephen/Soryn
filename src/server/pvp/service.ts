import { randomBytes, randomInt, randomUUID } from "node:crypto";
import {
  character,
  type CharacterId,
} from "../../domain/characters/definitions";
import type { ArenaChoice } from "../../domain/combat/arenas";
import type { Move } from "../../domain/combat/contracts";
import {
  advanceRoom,
  holderIntermission,
  openNextBattle,
} from "../../domain/pvp/advance";
import { isLate } from "../../domain/pvp/deadline";
import {
  closeRoomForTransfer,
  endSeriesNoContest,
  seriesReservation,
  hasOfficialSeats,
  OWNERSHIP_STALL_TERMINATE_MS,
  stallTerminatedExplanation,
  TOKEN_LOCK_TTL_MS,
  transferExplanation,
  unavailableExplanation,
  verifiableSeats,
  type OwnershipInterruption,
} from "../../domain/pvp/ownership";
import {
  arenaRoll,
  chooseArena,
  closeRoom,
  joinRoom,
  leaveSeat,
  confirmIntermission,
  markAssets,
  requestRematch,
  returnToSetup,
  surrender as surrenderMatch,
  selectFighter,
  setReady,
  submitMove,
  type SeatActor,
} from "../../domain/pvp/actions";
import { PvpError } from "../../domain/pvp/errors";
import { guestName } from "../../domain/pvp/names";
import { freshSeries, PUBLIC_SELECT_MS } from "../../domain/pvp/series";
import type { PvpTimers } from "../../domain/pvp/timers";
import {
  invitationExpired,
  roomOrigin,
  roomFinished,
  roomTerminal,
  otherSeat,
  seatIds,
  seatOf,
  type PvpMatch,
  type PvpRoom,
  type PvpSeat,
  type SeatId,
} from "../../domain/pvp/types";
import {
  presentRoom,
  previewRoom,
  historyForActor,
  type PvpHistoryRow,
} from "../../domain/pvp/view";
import { arenas } from "../../domain/combat/arenas";
import { tokenKey } from "../../domain/identity";
import { ServiceError } from "../errors";
import { TokenRecords } from "../records/tokenRecords";
import { PvpStore } from "./persistence";
import { TokenLocks } from "./locks";

function raise(error: unknown): never {
  if (error instanceof PvpError)
    throw new ServiceError(error.status, error.message);
  throw error;
}

type HolderGrant = NonNullable<PvpSeat["holderGrant"]>;

/** A stamped seat whose fresh ownership observation disagrees. */
export interface SeatOwnershipChange {
  seat: SeatId;
  token: string;
  owner: string;
  generation: string;
}

function lockTokenKey(grant: HolderGrant): string {
  return tokenKey(grant.identity);
}

function holderChosen(seat: PvpSeat | null | undefined) {
  return (
    !!seat?.characterId &&
    seat.mode === "official" &&
    character(seat.characterId).access === "holder"
  );
}

function battleHeadline(match: PvpMatch, seat: SeatId): string {
  if (!match.result || match.result.kind === "abandoned") return "No contest";
  if (!match.result.winner) return "Draw";
  return match.result.winner === seat ? "Victory" : "Defeat";
}

/**
 * Public-queue seats display their token when they carry a verified grant,
 * so the room and public history show which Chog entered. Guests keep names.
 */
function matchedSeatName(
  actor: SeatActor,
  grant: HolderGrant | null,
  taken: string[] = [],
) {
  if (grant) return `Chog #${grant.identity.tokenId}`;
  return guestName(actor.actor, taken);
}

function opensHolderMatch(room: PvpRoom, actor: string, ready: boolean) {
  if (!ready || room.match || room.closedAt) return false;
  const seat = seatOf(room, actor);
  const sitting = seat ? room.seats[seat] : null;
  if (!seat || !sitting || sitting.ready) return false;
  const next = structuredClone(room);
  next.seats[seat]!.ready = true;
  const left = next.seats.a;
  const right = next.seats.b;
  if (!left?.ready || !right?.ready || !left.characterId || !right.characterId)
    return false;
  return seatIds.some((id) => holderChosen(next.seats[id]));
}

function sameGrant(left: HolderGrant | null, right: HolderGrant) {
  if (!left) return false;
  return (
    left.generation === right.generation &&
    left.owner === right.owner &&
    left.identity.chainId === right.identity.chainId &&
    left.identity.collection === right.identity.collection &&
    left.identity.tokenId === right.identity.tokenId
  );
}

export class PvpService {
  constructor(
    readonly records: PvpStore,
    readonly timers: PvpTimers,
    private readonly ids = {
      room: () => randomUUID(),
      match: () => randomUUID(),
      invite: () => randomBytes(24).toString("base64url"),
      tie: (): 0 | 1 => (randomInt(2) === 0 ? 0 : 1),
      arena: () => arenaRoll(() => randomInt(1_000_000) / 1_000_000),
    },
    private readonly holderSeats: (
      room: PvpRoom,
    ) => Promise<readonly SeatId[]> = async (room) =>
      seatIds.filter((id) => holderChosen(room.seats[id])),
    readonly locks: TokenLocks = new TokenLocks(records.store),
    /**
     * Fresh ownership observations for stamped official seats. Receives the
     * room and returns one entry per verifiable seat; throws 503 when
     * evidence is unavailable and 409 on observation races. Rooms without
     * official seats never reach it.
     */
    private readonly checkSeats: (
      room: PvpRoom,
    ) => Promise<SeatOwnershipChange[]> = async () => [],
  ) {
    this.tokenRecords = new TokenRecords(records.store);
  }
  private readonly tokenRecords: TokenRecords;
  /**
   * Persist finished official results to the public token record: one row
   * per finished battle the room still holds, plus one series row once the
   * series itself is complete. Seats without a verified grant are skipped,
   * so guest-only rooms never write here. Every write is idempotent on
   * (token, kind, source), so restarts, polls and rematches cannot
   * double-record; intermediate battles were written when they finished,
   * before the next battle replaced them.
   */
  private captureOfficialRecords(after: PvpRoom, now: number) {
    const series = after.series;
    if (!series) return;
    const outcome = series.phase === "complete" ? series.outcome : null;
    const battles = [
      ...after.completed,
      ...(after.match ? [after.match] : []),
    ].filter((match) => match.phase === "complete" && !!match.result);
    for (const seat of seatIds) {
      const sitting = after.seats[seat];
      const grant = series.participants?.[seat] ?? null;
      if (!sitting || !grant) continue;
      const foe = otherSeat(seat);
      const foeSeat = after.seats[foe];
      if (outcome) {
        const noContest =
          outcome.kind === "no-contest" || outcome.kind === "abandoned";
        const headline = noContest
          ? "No contest"
          : outcome.winner === null
            ? "Draw"
            : outcome.winner === seat
              ? "Victory"
              : "Defeat";
        const finalArena =
          after.match?.arena ?? after.completed.at(-1)?.arena ?? null;
        this.tokenRecords.write({
          token: lockTokenKey(grant),
          kind: noContest ? "no-contest" : "series",
          rules: `${series.policy}+combat-pvp/1`,
          reason: after.interruption?.reason ?? null,
          eligibleForPublication: true,
          source: series.id,
          headline,
          explanation: outcome.explanation,
          fighter: sitting.characterId
            ? character(sitting.characterId).name
            : null,
          opponent: foeSeat?.name ?? null,
          opponentFighter: foeSeat?.characterId
            ? character(foeSeat.characterId).name
            : null,
          arena: finalArena ? arenas[finalArena].name : null,
          rounds: null,
          score: `${series.wins[seat]}–${series.wins[foe]}`,
          route: null,
          owner: grant.owner,
          generation: grant.generation,
          recordedAt: now,
        });
      }
      const seen = new Set<string>();
      for (const match of battles) {
        const participant = match.participants?.[seat];
        if (!participant || seen.has(match.id) || !match.result) continue;
        seen.add(match.id);
        this.tokenRecords.write({
          token: lockTokenKey(participant),
          kind: "battle",
          rules: match.snapshot.policy,
          eligibleForPublication: true,
          source: match.id,
          headline: battleHeadline(match, seat),
          explanation: match.result.explanation,
          fighter: character(
            (seat === "a" ? match.snapshot.player : match.snapshot.opponent).id,
          ).name,
          opponent: foeSeat?.name ?? null,
          opponentFighter: character(
            (seat === "a" ? match.snapshot.opponent : match.snapshot.player).id,
          ).name,
          arena: arenas[match.arena].name,
          rounds: match.rounds.length,
          score: null,
          route: null,
          owner: participant.owner,
          generation: participant.generation,
          recordedAt: now,
        });
      }
    }
  }
  /**
   * Commit deadline catch-up before the caller's action.
   * A rejected action must not roll back a forfeit or resolved round.
   */
  private settle(invite: string, actor: string | null, now: number) {
    this.records.store.transaction(() => {
      const loaded = this.records.byInvite(invite);
      let room = advanceRoom(loaded, now);
      if (actor) room = this.seen(room, actor, now);
      if (room !== loaded) this.captureOfficialRecords(room, now);
      if (room !== loaded || roomTerminal(room, now)) this.saveRoom(room, now);
    });
  }
  private rememberGrant(
    room: PvpRoom,
    actor: string,
    grant: HolderGrant | null,
  ) {
    if (!grant) return room;
    const seat = seatOf(room, actor);
    const sitting = seat ? room.seats[seat] : null;
    if (
      sitting?.holderGrant &&
      tokenKey(sitting.holderGrant.identity) !== tokenKey(grant.identity)
    )
      throw new ServiceError(
        409,
        "This room keeps its selected Chog. Finish or cancel it before choosing another token.",
      );
    if (
      !seat ||
      !sitting ||
      sitting.mode !== "official" ||
      sameGrant(sitting.holderGrant, grant)
    )
      return room;
    const next = structuredClone(room);
    next.seats[seat]!.holderGrant = grant;
    next.revision += 1;
    return next;
  }
  private mutate(
    invite: string,
    actor: string,
    now: number,
    change: (room: PvpRoom) => void,
    grant: HolderGrant | null = null,
  ) {
    try {
      this.settle(invite, actor, now);
      return this.records.store.transaction(() => {
        const loaded = this.records.byInvite(invite);
        let room = advanceRoom(loaded, now);
        room = this.seen(room, actor, now);
        room = this.rememberGrant(room, actor, grant);
        change(room);
        room = advanceRoom(room, now);
        this.captureOfficialRecords(room, now);
        this.saveRoom(room, now);
        return presentRoom(room, actor, now);
      });
    } catch (error) {
      raise(error);
    }
  }
  /** Archive results and release only this encounter's associations atomically. */
  private saveRoom(room: PvpRoom, now: number): void {
    this.records.store.transaction(() => {
      if (roomTerminal(room, now)) {
        if (room.closedAt === null) {
          room.closedAt = now;
          room.revision += 1;
        }
        this.locks.releaseEncounter(seriesReservation(room));
        this.records.releaseMatched(room.invite);
      }
      this.records.save(room);
    });
  }
  /**
   * Compare a presented fresh grant against the seat's stamped grant.
   * Returns the confirmed change, or null when nothing disagrees. Seats
   * without a stamped grant are adopted by the calling operation, never
   * voided here: legacy rooms bind their owner on first contact.
   */
  compareSeatGrant(
    room: PvpRoom,
    seat: SeatId,
    presented: HolderGrant | null,
  ): SeatOwnershipChange | null {
    const sitting = room.seats[seat];
    if (!sitting || sitting.mode !== "official") return null;
    if (!sitting.holderGrant || !presented) return null;
    if (sameGrant(sitting.holderGrant, presented)) return null;
    return {
      seat,
      token: lockTokenKey(sitting.holderGrant),
      owner: presented.owner,
      generation: presented.generation,
    };
  }
  /**
   * Fresh observations for stamped official seats other than the acting one.
   * Throws 503 when evidence is unavailable and 409 on observation races;
   * anything else propagates untouched so bugs never read as transfers.
   */
  async verifyOtherSeats(
    room: PvpRoom,
    exclude: SeatId | null,
  ): Promise<SeatOwnershipChange[]> {
    if (!verifiableSeats(room).some((seat) => seat !== exclude)) return [];
    const changed = await this.checkSeats(room);
    // Only stamped official seats can void a room. Anything else is a
    // checker contract violation and must not end a series.
    return changed.filter(
      (check) =>
        check.seat !== exclude &&
        room.seats[check.seat]?.mode === "official" &&
        !!room.seats[check.seat]?.holderGrant,
    );
  }
  /**
   * Guard an official room before a state-changing operation or a completion.
   * Returns null when the operation may proceed, or the voided room (already
   * saved) that the caller must present instead of the requested action.
   * Throws 503 with an explicit verification-unavailable message when fresh
   * evidence cannot be established; nothing competitive is written then.
   */
  async guardOfficialRoom(
    invite: string,
    acting: { seat: SeatId | null; grant: HolderGrant | null },
    now: number,
  ): Promise<PvpRoom | null> {
    const room = this.records.byInvite(invite);
    if (
      !hasOfficialSeats(room) ||
      room.closedAt !== null ||
      room.series?.phase === "complete"
    )
      return null;
    if (
      room.ownershipStallSince !== null &&
      now >= room.ownershipStallSince + OWNERSHIP_STALL_TERMINATE_MS
    )
      return this.noteStallOrTerminate(invite, now, room.revision);
    if (
      room.match &&
      seatIds.some(
        (id) =>
          room.seats[id]?.mode === "official" && !room.seats[id]?.holderGrant,
      )
    )
      return this.noteStallOrTerminate(invite, now);
    // Expiry revokes the encounter, not just its row. An old request cannot
    // resume after another encounter acquired the token.
    for (const id of verifiableSeats(room)) {
      const grant = room.seats[id]!.holderGrant!;
      let held = this.locks.get(lockTokenKey(grant), now);
      if (held?.encounter === room.invite && room.series) {
        this.locks.rekey(
          lockTokenKey(grant),
          room.invite,
          seriesReservation(room),
        );
        held = this.locks.get(lockTokenKey(grant), now);
      }
      if (
        !held ||
        held.encounter !== seriesReservation(room) ||
        held.owner !== grant.owner ||
        held.generation !== grant.generation
      )
        return this.applyInterruption(invite, now, {
          kind: "expired",
          changedSeat: id,
          observedOwner: null,
          observedGeneration: null,
          explanation:
            "The official participation reservation expired. This encounter ends without a winner; start a new encounter after verification.",
        });
    }
    const ownSeat = acting.seat ? room.seats[acting.seat] : null;
    const ownGrant = ownSeat?.holderGrant;
    // Selecting another token is not evidence that the token stamped on an
    // older room transferred. In that case verify the stored token itself.
    const presentedMatches =
      !!ownGrant &&
      !!acting.grant &&
      lockTokenKey(ownGrant) === lockTokenKey(acting.grant);
    if (acting.seat && presentedMatches) {
      const changed = this.compareSeatGrant(room, acting.seat, acting.grant);
      if (changed)
        return this.applyInterruption(invite, now, {
          kind: "no-contest",
          changedSeat: changed.seat,
          observedOwner: changed.owner,
          observedGeneration: changed.generation,
          explanation: transferExplanation(),
        });
    }
    let changed: SeatOwnershipChange[];
    try {
      // Recheck all stamped seats together. The acting authentication read
      // may have aged while another seat's provider response was pending.
      changed = await this.verifyOtherSeats(room, null);
    } catch (error) {
      if (error instanceof ServiceError && error.status === 503)
        return this.noteStallOrTerminate(invite, now, room.revision);
      throw error;
    }
    if (changed.length)
      return this.applyInterruption(
        invite,
        now,
        {
          kind: "no-contest",
          changedSeat: changed[0].seat,
          observedOwner: changed[0].owner,
          observedGeneration: changed[0].generation,
          explanation: transferExplanation(),
        },
        room.revision,
      );
    this.records.store.transaction(() => {
      const current = this.records.byInvite(invite);
      if (current.revision !== room.revision)
        throw new ServiceError(
          409,
          "The room changed during ownership verification. Retry.",
          "revision-conflict",
        );
      for (const id of verifiableSeats(current)) {
        const grant = current.seats[id]!.holderGrant!;
        const held = this.locks.get(lockTokenKey(grant), now);
        if (
          !held ||
          held.encounter !== seriesReservation(current) ||
          held.generation !== grant.generation ||
          held.owner !== grant.owner
        )
          throw new ServiceError(
            409,
            "This token no longer reserves this encounter. Refresh.",
          );
      }
      if (current.ownershipStallSince !== null) {
        const paused = Math.max(0, now - current.ownershipStallSince);
        if (current.match && current.match.phase !== "complete")
          current.match.deadlineAt += paused;
        if (
          current.series?.deadlineAt !== null &&
          current.series?.deadlineAt !== undefined
        )
          current.series.deadlineAt += paused;
        current.ownershipStallSince = null;
        current.revision += 1;
        this.saveRoom(current, now);
      }
    });
    return null;
  }
  /**
   * Void a room over already-established seat changes (for example after a
   * revoked grant triggered an unauthenticated verification). Saved once,
   * idempotent on terminal rooms.
   */
  voidOnTransfer(
    invite: string,
    now: number,
    changed: SeatOwnershipChange[],
    revision?: number,
  ): PvpRoom {
    if (!changed.length) return this.records.byInvite(invite);
    const first = changed[0];
    return this.applyInterruption(
      invite,
      now,
      {
        kind: "no-contest",
        changedSeat: first.seat,
        observedOwner: first.owner,
        observedGeneration: first.generation,
        explanation: transferExplanation(),
      },
      revision,
    );
  }
  /**
   * Apply an interruption atomically: void or close, release every official
   * token lock for the room, and save once. Idempotent on terminal rooms.
   */
  private applyInterruption(
    invite: string,
    now: number,
    interruption: OwnershipInterruption,
    revision?: number,
  ): PvpRoom {
    return this.records.store.transaction(() => {
      const room = this.records.byInvite(invite);
      if (revision !== undefined && room.revision !== revision)
        throw new ServiceError(
          409,
          "The series changed during ownership verification. Retry.",
          "revision-conflict",
        );
      if (room.closedAt !== null || room.series?.phase === "complete")
        return room;
      room.interruption = {
        reason:
          interruption.kind === "no-contest"
            ? interruption.changedSeat &&
              interruption.observedOwner ===
                room.seats[interruption.changedSeat]?.holderGrant?.owner
              ? "generation-invalidated"
              : "ownership-changed"
            : interruption.kind === "expired"
              ? "reservation-expired"
              : "verification-unavailable",
        at: now,
        openingGeneration: interruption.changedSeat
          ? (room.seats[interruption.changedSeat]?.holderGrant?.generation ??
            null)
          : null,
        observedGeneration: interruption.observedGeneration,
      };
      if (!room.series || room.series.phase === "setup")
        closeRoomForTransfer(room, now, interruption.explanation);
      else endSeriesNoContest(room, now, interruption);
      this.captureOfficialRecords(room, now);
      this.releaseRoomLocks(room);
      this.saveRoom(room, now);
      return room;
    });
  }
  private releaseRoomLocks(room: PvpRoom): void {
    this.locks.releaseEncounter(seriesReservation(room));
  }
  /** Stamp an official seat's fresh grant and reserve its token. */
  private seatOfficial(
    room: PvpRoom,
    actor: string,
    grant: HolderGrant | null,
    now: number,
  ): void {
    if (!grant) return;
    const seat = seatOf(room, actor);
    const sitting = seat ? room.seats[seat] : null;
    if (!seat || !sitting || sitting.mode !== "official") return;
    sitting.holderGrant = grant;
    room.revision += 1;
    this.locks.ensure({
      token: lockTokenKey(grant),
      encounter: seriesReservation(room),
      kind: "series",
      owner: grant.owner,
      generation: grant.generation,
      openedAt: now,
      expiresAt: now + TOKEN_LOCK_TTL_MS,
    });
  }
  /**
   * Record an outage stall, or terminate the series when the stall outlives
   * its bound. Termination is stored as abandoned without a winner so it is
   * distinguishable from a confirmed-transfer no contest. Returns the saved
   * room on termination; otherwise throws 503 and saves only the stall mark.
   */
  noteStallOrTerminate(
    invite: string,
    now: number,
    revision?: number,
  ): PvpRoom {
    const stalled = this.records.store.transaction(() => {
      const room = this.records.byInvite(invite);
      if (revision !== undefined && room.revision !== revision)
        throw new ServiceError(
          409,
          "The encounter changed during verification. Retry.",
          "revision-conflict",
        );
      if (
        room.closedAt !== null ||
        room.series?.phase === "complete" ||
        !hasOfficialSeats(room)
      )
        throw new ServiceError(503, unavailableExplanation());
      if (
        room.ownershipStallSince !== null &&
        isLate(now, room.ownershipStallSince + OWNERSHIP_STALL_TERMINATE_MS)
      ) {
        endSeriesNoContest(room, now, {
          kind: "unavailable",
          changedSeat: null,
          observedOwner: null,
          observedGeneration: null,
          explanation: stallTerminatedExplanation(),
        });
        room.interruption = {
          reason: "verification-unavailable",
          at: now,
          openingGeneration: null,
          observedGeneration: null,
        };
        this.captureOfficialRecords(room, now);
        this.releaseRoomLocks(room);
        this.saveRoom(room, now);
        return room;
      }
      if (room.ownershipStallSince === null) {
        room.ownershipStallSince = now;
        room.revision += 1;
        this.saveRoom(room, now);
      }
      return null;
    });
    if (stalled) return stalled;
    throw new ServiceError(503, unavailableExplanation());
  }
  private seen(room: PvpRoom, actor: string, now: number) {
    const seat = seatOf(room, actor);
    if (
      roomTerminal(room, now) ||
      !seat ||
      room.seats[seat]?.lastSeenAt === now
    )
      return room;
    const next = structuredClone(room);
    next.seats[seat]!.lastSeenAt = now;
    return next;
  }
  create(actor: SeatActor, now: number, grant: HolderGrant | null = null) {
    return this.records.store.transaction(() => {
      for (const invite of this.records.purgeExpiredLobbies(now))
        this.locks.releaseEncounter(invite);
      this.locks.purge(now);
      const rooms = this.records.roomsFor(actor.actor);
      const playing = rooms.find(
        (room) =>
          seatOf(room, actor.actor) &&
          !roomTerminal(room, now) &&
          (room.match !== null || roomOrigin(room) === "public"),
      );
      if (playing)
        throw new ServiceError(409, "Finish your current battle first.");
      const existing = rooms.find(
        (room) =>
          !room.closedAt &&
          !room.match &&
          !invitationExpired(room, now) &&
          seatOf(room, actor.actor),
      );
      if (existing) {
        const room = this.seen(existing, actor.actor, now);
        if (room !== existing) this.saveRoom(room, now);
        return presentRoom(room, actor.actor, now);
      }
      this.records.store.rateLimit("pvp-room-create", now);
      const room: PvpRoom = {
        version: "pvp-room/1",
        id: this.ids.room(),
        invite: this.ids.invite(),
        revision: 1,
        createdAt: now,
        expiresAt: now + this.timers.lobbyMs,
        closedAt: null,
        arenaChoice: "sanctuary",
        rematchOf: null,
        seats: { a: null, b: null },
        match: null,
        completed: [],
        timers: this.timers,
        series: freshSeries(this.ids.match()),
        roster: "private",
        origin: "private",
        ownershipStallSince: null,
      };
      try {
        joinRoom(room, actor, now, guestName(actor.actor));
      } catch (error) {
        raise(error);
      }
      this.seatOfficial(room, actor.actor, grant, now);
      this.saveRoom(room, now);
      this.records.joinMember(actor.actor, room.id);
      return presentRoom(room, actor.actor, now);
    });
  }
  /** Open one starter series for two different people. The caller supplies both seats. */
  openMatched(
    left: SeatActor,
    right: SeatActor,
    now: number,
    grants: { left: HolderGrant | null; right: HolderGrant | null } = {
      left: null,
      right: null,
    },
  ) {
    if (left.actor === right.actor)
      throw new ServiceError(409, "You cannot match your own session.");
    return this.records.store.transaction(() => {
      this.records.store.rateLimit("pvp-room-create", now);
      const room: PvpRoom = {
        version: "pvp-room/1",
        id: this.ids.room(),
        invite: this.ids.invite(),
        revision: 1,
        createdAt: now,
        expiresAt: now + PUBLIC_SELECT_MS,
        closedAt: null,
        arenaChoice: "sanctuary",
        rematchOf: null,
        seats: { a: null, b: null },
        match: null,
        completed: [],
        timers: this.timers,
        series: freshSeries(this.ids.match()),
        roster:
          process.env.SORYN_HOLDER_ACCESS === "enabled"
            ? "public-six"
            : "starters",
        origin: "public",
        ownershipStallSince: null,
      };
      joinRoom(room, left, now, matchedSeatName(left, grants.left));
      joinRoom(
        room,
        right,
        now,
        matchedSeatName(right, grants.right, [room.seats.a!.name]),
      );
      this.seatOfficial(room, left.actor, grants.left, now);
      this.seatOfficial(room, right.actor, grants.right, now);
      this.saveRoom(room, now);
      this.records.joinMember(left.actor, room.id);
      this.records.joinMember(right.actor, room.id);
      return room;
    });
  }
  publicProgress(invite: string, now: number): "open" | "done" | "missing" {
    try {
      const room = this.records.byInvite(invite);
      if (roomTerminal(room, now)) {
        // Unfinished official lobbies require their ownership-checked path,
        // even when another queue reader observes their selection deadline.
        if (
          hasOfficialSeats(room) &&
          room.closedAt === null &&
          !roomFinished(room)
        )
          return "open";
        this.saveRoom(room, now);
        return "done";
      }
      return "open";
    } catch (error) {
      if (error instanceof ServiceError && error.status === 404)
        return "missing";
      throw error;
    }
  }
  /** Stored seat access. Missing rooms and empty seats return null. */
  seatMode(invite: string, actor: string): "guest" | "official" | null {
    try {
      const room = this.records.byInvite(invite);
      const seat = seatOf(room, actor);
      return seat ? room.seats[seat]!.mode : null;
    } catch (error) {
      if (error instanceof ServiceError && error.status === 404) return null;
      throw error;
    }
  }
  /**
   * Room status for a seated actor. Commits any deadline that already passed
   * (settle) before shaping the view, so this read can finalize a battle.
   */
  preview(invite: string, actor: string | null, now: number) {
    try {
      this.settle(invite, actor, now);
      return this.records.store.transaction(() => {
        const loaded = this.records.byInvite(invite);
        let room = advanceRoom(loaded, now);
        if (actor && seatOf(room, actor)) {
          room = this.seen(room, actor, now);
          if (room !== loaded) {
            this.captureOfficialRecords(room, now);
            this.saveRoom(room, now);
          }
          return presentRoom(room, actor, now);
        }
        if (room.match) throw new ServiceError(403, "This battle is private.");
        if (room !== loaded) {
          this.captureOfficialRecords(room, now);
          this.saveRoom(room, now);
        }
        return previewRoom(room, now);
      });
    } catch (error) {
      raise(error);
    }
  }
  join(
    actor: SeatActor,
    invite: string,
    now: number,
    grant: HolderGrant | null = null,
  ) {
    try {
      this.settle(invite, actor.actor, now);
      return this.records.store.transaction(() => {
        let room = advanceRoom(this.records.byInvite(invite), now);
        if (roomOrigin(room) === "public" && !seatOf(room, actor.actor))
          throw new ServiceError(
            403,
            "This match belongs to its paired players.",
          );
        const names = [room.seats.a?.name, room.seats.b?.name].filter(
          (name): name is string => !!name,
        );
        joinRoom(room, actor, now, guestName(actor.actor, names));
        this.seatOfficial(room, actor.actor, grant, now);
        room = advanceRoom(room, now);
        this.saveRoom(room, now);
        this.records.joinMember(actor.actor, room.id);
        return presentRoom(room, actor.actor, now);
      });
    } catch (error) {
      raise(error);
    }
  }
  leave(actor: string, invite: string, now: number) {
    try {
      this.settle(invite, actor, now);
      return this.records.store.transaction(() => {
        const room = advanceRoom(this.records.byInvite(invite), now);
        const seat = seatOf(room, actor);
        if (!seat) return previewRoom(room, now);
        const publicPair = roomOrigin(room) === "public";
        if (publicPair) closeRoom(room, actor, now);
        const grant =
          seat && room.seats[seat]?.mode === "official"
            ? room.seats[seat]!.holderGrant
            : null;
        leaveSeat(room, actor);
        const remaining = room.seats[otherSeat(seat)];
        if (remaining) remaining.notice = "Opponent left before the battle.";
        if (!room.seats.a && !room.seats.b && room.closedAt === null)
          room.closedAt = now;
        this.records.leaveMember(actor, room.id);
        if (grant)
          this.locks.release(lockTokenKey(grant), seriesReservation(room));
        const settled = advanceRoom(room, now);
        this.saveRoom(settled, now);
        return previewRoom(settled, now);
      });
    } catch (error) {
      raise(error);
    }
  }
  close(actor: string, invite: string, now: number) {
    const reservation = seriesReservation(this.records.byInvite(invite));
    try {
      const closed = this.mutate(invite, actor, now, (room) =>
        closeRoom(room, actor, now),
      );
      this.locks.releaseEncounter(reservation);
      return closed;
    } catch (error) {
      raise(error);
    }
  }
  select(
    actor: string,
    invite: string,
    id: CharacterId,
    now: number,
    grant: HolderGrant | null = null,
  ) {
    return this.mutate(
      invite,
      actor,
      now,
      (room) => selectFighter(room, actor, id),
      grant,
    );
  }
  arena(actor: string, invite: string, choice: ArenaChoice, now: number) {
    return this.mutate(invite, actor, now, (room) =>
      chooseArena(room, actor, choice),
    );
  }
  ready(
    actor: string,
    invite: string,
    ready: boolean,
    now: number,
    grant: HolderGrant | null = null,
    holdersCleared = false,
  ) {
    return this.mutate(
      invite,
      actor,
      now,
      (room) => {
        if (!holdersCleared && opensHolderMatch(room, actor, ready))
          throw new ServiceError(
            403,
            "Holder ownership must be rechecked before the match starts.",
          );
        setReady(room, actor, ready, now, {
          id: this.ids.match(),
          tie: this.ids.tie(),
          arenaRoll: this.ids.arena,
        });
      },
      grant,
    );
  }
  /**
   * Recheck every official holder seat before the ready that would open a match.
   * An RPC failure is rethrown and does not start the match or clear a fighter.
   */
  async confirmReady(
    actor: string,
    invite: string,
    ready: boolean,
    now: number,
    grant: HolderGrant | null = null,
  ) {
    if (!ready) return this.ready(actor, invite, false, now, grant);
    this.settle(invite, actor, now);
    const loaded = this.records.byInvite(invite);
    const staged = this.rememberGrant(structuredClone(loaded), actor, grant);
    const seat = seatOf(staged, actor);
    if (seat && staged.seats[seat]) staged.seats[seat]!.ready = true;
    if (!opensHolderMatch(loaded, actor, true))
      return this.ready(actor, invite, true, now, grant);
    let ineligible: readonly SeatId[];
    try {
      ineligible = await this.holderSeats(staged);
    } catch (error) {
      raise(error);
    }
    if (ineligible.length) {
      const changes = await this.verifyOtherSeats(loaded, null);
      if (changes.length)
        return presentRoom(
          this.voidOnTransfer(invite, now, changes, loaded.revision),
          actor,
          now,
        );
      return presentRoom(
        this.noteStallOrTerminate(invite, now, loaded.revision),
        actor,
        now,
      );
    }
    if (this.records.byInvite(invite).revision !== loaded.revision)
      throw new ServiceError(
        409,
        "The lobby changed during ownership verification. Retry.",
        "revision-conflict",
      );
    return this.ready(actor, invite, true, now, grant, true);
  }
  assets(actor: string, invite: string, now: number) {
    return this.mutate(invite, actor, now, (room) =>
      markAssets(room, actor, now),
    );
  }
  move(actor: string, invite: string, round: number, move: Move, now: number) {
    return this.mutate(invite, actor, now, (room) =>
      submitMove(room, actor, round, move, now),
    );
  }
  rematch(actor: string, invite: string, now: number) {
    const seriesId = this.records.byInvite(invite).series?.id ?? null;
    return this.mutate(invite, actor, now, (room) => {
      requestRematch(room, actor);
      if (room.series && room.series.id !== seriesId)
        this.acquireRoomSeriesLocks(room, now);
    });
  }
  async continueSeries(actor: string, invite: string, now: number) {
    const view = this.mutate(invite, actor, now, (room) =>
      confirmIntermission(room, actor, now),
    );
    await this.confirmNextBattle(invite, now);
    return holderIntermission(this.records.byInvite(invite))
      ? view
      : this.preview(invite, actor, now);
  }
  /** Automatic and explicit intermissions share the same ownership/lock gate. */
  async confirmNextBattle(invite: string, now: number) {
    const loaded = this.records.byInvite(invite);
    if (!holderIntermission(loaded)) return;
    const interrupted = await this.guardOfficialRoom(
      invite,
      { seat: null, grant: null },
      now,
    );
    if (interrupted) return;
    const before = this.records.byInvite(invite);
    if (!holderIntermission(before)) return;
    const due = before.series!.deadlineAt!;
    if (!isLate(now, due) && !(before.seats.a?.ready && before.seats.b?.ready))
      return;
    this.records.store.transaction(() => {
      const room = this.records.byInvite(invite);
      if (room.revision !== before.revision)
        throw new ServiceError(
          409,
          "The series changed during ownership verification. Retry.",
          "revision-conflict",
        );
      openNextBattle(room, isLate(now, due) ? due : now, true);
      this.saveRoom(room, now);
    });
  }
  surrender(actor: string, invite: string, now: number) {
    return this.mutate(invite, actor, now, (room) =>
      surrenderMatch(room, actor, now),
    );
  }
  setup(actor: string, invite: string, now: number) {
    const seriesId = this.records.byInvite(invite).series?.id ?? null;
    return this.mutate(invite, actor, now, (room) => {
      returnToSetup(room, actor);
      if (room.series && room.series.id !== seriesId)
        this.acquireRoomSeriesLocks(room, now);
    });
  }
  /**
   * Reserve the token lock for a newly opened series in this room. Runs
   * inside the creating transaction, so a busy token rolls the series back
   * with a 409 instead of overlapping another encounter.
   */
  private acquireRoomSeriesLocks(room: PvpRoom, now: number): void {
    for (const seat of seatIds) {
      const sitting = room.seats[seat];
      if (sitting?.mode !== "official" || !sitting.holderGrant) continue;
      this.locks.ensure({
        token: lockTokenKey(sitting.holderGrant),
        encounter: seriesReservation(room),
        kind: "series",
        owner: sitting.holderGrant.owner,
        generation: sitting.holderGrant.generation,
        openedAt: now,
        expiresAt: now + TOKEN_LOCK_TTL_MS,
      });
    }
  }
  /**
   * Session summary across rooms. Settles open matches first, so it shares
   * the commit-on-poll rule with preview().
   */
  session(actor: string, now: number) {
    for (const room of this.records.roomsFor(actor))
      this.settle(room.invite, actor, now);
    return this.summarize(actor, this.records.roomsFor(actor), now);
  }
  private summarize(actor: string, rooms: PvpRoom[], now: number) {
    const active = rooms.find(
      (room) => seatOf(room, actor) && !roomTerminal(room, now),
    );
    const history: PvpHistoryRow[] = [];
    for (const room of rooms) {
      const seat = seatOf(room, actor);
      if (!seat) continue;
      const view = presentRoom(room, actor, now);
      history.push(...view.history);
    }
    return {
      activeInvite: active?.invite ?? null,
      activePhase:
        active && seatOf(active, actor)
          ? presentRoom(active, actor, now).phase
          : null,
      history: history.slice(0, 50),
    };
  }
  /**
   * Completed battles for one seated actor. No live match, lock, deadline,
   * or room state is included, so a former owner keeps their own history
   * without gaining any current-token authority.
   */
  historyFor(actor: string): PvpHistoryRow[] {
    const history: PvpHistoryRow[] = [];
    for (const room of this.records.roomsFor(actor))
      history.push(...historyForActor(room, actor));
    return history.slice(0, 50);
  }
  /** All official polls guard ownership and reservations before ANY clock progression. */
  async previewChecked(
    invite: string,
    actor: string | null,
    now: number,
    presented: HolderGrant | null = null,
  ) {
    const room = this.records.byInvite(invite);
    const seat = actor ? seatOf(room, actor) : null;
    if (!seat) {
      if (room.match) throw new ServiceError(403, "This battle is private.");
      return previewRoom(room, now);
    }
    const interrupted = await this.guardOfficialRoom(
      invite,
      { seat, grant: presented },
      now,
    );
    if (interrupted)
      return seat && actor
        ? presentRoom(interrupted, actor, now)
        : previewRoom(interrupted, now);
    await this.confirmNextBattle(invite, now);
    return this.preview(invite, actor, now);
  }
  /** Own historical rows remain private; each open room gets the same ownership gate. */
  async sessionChecked(
    actor: string,
    now: number,
    presented: HolderGrant | null = null,
  ) {
    for (const room of this.records.roomsFor(actor)) {
      if (room.closedAt !== null || roomFinished(room)) {
        this.settle(room.invite, actor, now);
        continue;
      }
      await this.previewChecked(room.invite, actor, now, presented);
    }
    return this.summarize(actor, this.records.roomsFor(actor), now);
  }
}
