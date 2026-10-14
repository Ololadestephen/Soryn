import { randomBytes, randomInt, randomUUID } from "node:crypto";
import {
  character,
  type CharacterId,
} from "../../domain/characters/definitions";
import type { ArenaChoice } from "../../domain/combat/arenas";
import type { Move } from "../../domain/combat/contracts";
import { advanceRoom } from "../../domain/pvp/advance";
import {
  arenaRoll,
  chooseArena,
  closeRoom,
  joinRoom,
  leaveSeat,
  markAssets,
  requestRematch,
  returnToSetup,
  selectFighter,
  setReady,
  submitMove,
  type SeatActor,
} from "../../domain/pvp/actions";
import { PvpError } from "../../domain/pvp/errors";
import { guestName } from "../../domain/pvp/names";
import type { PvpTimers } from "../../domain/pvp/timers";
import {
  invitationExpired,
  seatIds,
  seatOf,
  type PvpRoom,
  type PvpSeat,
  type SeatId,
} from "../../domain/pvp/types";
import {
  presentRoom,
  previewRoom,
  type PvpHistoryRow,
} from "../../domain/pvp/view";
import { ServiceError } from "../errors";
import { PvpStore } from "./persistence";

function raise(error: unknown): never {
  if (error instanceof PvpError)
    throw new ServiceError(error.status, error.message);
  throw error;
}

type HolderGrant = NonNullable<PvpSeat["holderGrant"]>;

function holderChosen(seat: PvpSeat | null | undefined) {
  return !!seat?.characterId && character(seat.characterId).access === "holder";
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
  ) {}
  /**
   * Commit deadline catch-up before the caller's action.
   * A rejected action must not roll back a forfeit or resolved round.
   */
  private settle(invite: string, actor: string | null, now: number) {
    this.records.store.transaction(() => {
      const loaded = this.records.byInvite(invite);
      let room = advanceRoom(loaded, now);
      if (actor) room = this.seen(room, actor, now);
      if (room !== loaded) this.records.save(room);
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
        let room = advanceRoom(this.records.byInvite(invite), now);
        room = this.seen(room, actor, now);
        room = this.rememberGrant(room, actor, grant);
        change(room);
        room = advanceRoom(room, now);
        this.records.save(room);
        return presentRoom(room, actor, now);
      });
    } catch (error) {
      raise(error);
    }
  }
  private seen(room: PvpRoom, actor: string, now: number) {
    const seat = seatOf(room, actor);
    if (!seat || room.seats[seat]?.lastSeenAt === now) return room;
    const next = structuredClone(room);
    next.seats[seat]!.lastSeenAt = now;
    return next;
  }
  create(actor: SeatActor, now: number) {
    this.records.store.transaction(() => this.records.purgeExpiredLobbies(now));
    return this.records.store.transaction(() => {
      const rooms = this.records.roomsFor(actor.actor);
      const playing = rooms.find(
        (room) =>
          seatOf(room, actor.actor) &&
          room.match &&
          room.match.phase !== "complete",
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
        if (room !== existing) this.records.save(room);
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
      };
      try {
        joinRoom(room, actor, now, guestName(actor.actor));
      } catch (error) {
        raise(error);
      }
      this.records.save(room);
      this.records.joinMember(actor.actor, room.id);
      return presentRoom(room, actor.actor, now);
    });
  }
  preview(invite: string, actor: string | null, now: number) {
    try {
      this.settle(invite, actor, now);
      return this.records.store.transaction(() => {
        const loaded = this.records.byInvite(invite);
        let room = advanceRoom(loaded, now);
        if (actor && seatOf(room, actor)) {
          room = this.seen(room, actor, now);
          if (room !== loaded) this.records.save(room);
          return presentRoom(room, actor, now);
        }
        if (room.match) throw new ServiceError(403, "This battle is private.");
        if (room !== loaded) this.records.save(room);
        return previewRoom(room, now);
      });
    } catch (error) {
      raise(error);
    }
  }
  join(actor: SeatActor, invite: string, now: number) {
    try {
      this.settle(invite, actor.actor, now);
      return this.records.store.transaction(() => {
        let room = advanceRoom(this.records.byInvite(invite), now);
        const names = [room.seats.a?.name, room.seats.b?.name].filter(
          (name): name is string => !!name,
        );
        joinRoom(room, actor, now, guestName(actor.actor, names));
        room = advanceRoom(room, now);
        this.records.save(room);
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
        leaveSeat(room, actor);
        this.records.leaveMember(actor, room.id);
        const settled = advanceRoom(room, now);
        this.records.save(settled);
        return previewRoom(settled, now);
      });
    } catch (error) {
      raise(error);
    }
  }
  close(actor: string, invite: string, now: number) {
    return this.mutate(invite, actor, now, (room) =>
      closeRoom(room, actor, now),
    );
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
      this.clearHolders(invite, ineligible);
      throw new ServiceError(
        403,
        "A holder fighter lost its verified owner, so the match did not start.",
      );
    }
    return this.ready(actor, invite, true, now, grant, true);
  }
  private clearHolders(invite: string, seats: readonly SeatId[]) {
    this.records.store.transaction(() => {
      const room = this.records.byInvite(invite);
      let changed = false;
      for (const seat of seats) {
        const sitting = room.seats[seat];
        if (!sitting) continue;
        sitting.ready = false;
        if (holderChosen(sitting)) {
          sitting.characterId = null;
          sitting.notice =
            "That fighter needs verified ownership, so the choice was cleared.";
        }
        changed = true;
      }
      if (!changed) return;
      room.revision += 1;
      this.records.save(room);
    });
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
    return this.mutate(invite, actor, now, (room) =>
      requestRematch(room, actor),
    );
  }
  setup(actor: string, invite: string, now: number) {
    return this.mutate(invite, actor, now, (room) =>
      returnToSetup(room, actor),
    );
  }
  session(actor: string, now: number) {
    for (const room of this.records.roomsFor(actor)) {
      if (room.match && room.match.phase !== "complete")
        this.settle(room.invite, actor, now);
    }
    const rooms = this.records.roomsFor(actor);
    const active = rooms.find(
      (room) =>
        seatOf(room, actor) && !room.closedAt && !invitationExpired(room, now),
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
}
