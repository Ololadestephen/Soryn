import {
  invitationExpired,
  pvpRoomSchema,
  type PvpRoom,
} from "../../domain/pvp/types";
import { ServiceError } from "../errors";
import { Store } from "../persistence";
import { readStored } from "../storedRecord";
import { seriesReservation } from "../../domain/pvp/ownership";

export class PvpStore {
  constructor(readonly store: Store) {}
  byInvite(invite: string): PvpRoom {
    const row = this.store.db
      .prepare("SELECT record FROM pvp_rooms WHERE invite=?")
      .get(invite) as { record: string } | undefined;
    if (!row) throw new ServiceError(404, "Invitation not found.");
    return readStored(pvpRoomSchema, row.record);
  }
  byReservation(encounter: string): PvpRoom | null {
    const row = this.store.db
      .prepare(
        "SELECT record FROM pvp_rooms WHERE invite=? OR json_extract(record, '$.series.id')=? LIMIT 1",
      )
      .get(encounter, encounter);
    return row ? readStored(pvpRoomSchema, row.record) : null;
  }
  save(room: PvpRoom) {
    const record = JSON.stringify(pvpRoomSchema.parse(room));
    this.store.db
      .prepare(
        "INSERT INTO pvp_rooms (id, invite, record) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET invite=excluded.invite, record=excluded.record",
      )
      .run(room.id, room.invite, record);
  }
  joinMember(actor: string, roomId: string) {
    this.store.db
      .prepare(
        "INSERT OR IGNORE INTO pvp_members (actor, room_id) VALUES (?, ?)",
      )
      .run(actor, roomId);
  }
  leaveMember(actor: string, roomId: string) {
    this.store.db
      .prepare("DELETE FROM pvp_members WHERE actor=? AND room_id=?")
      .run(actor, roomId);
  }
  /** Clear only this room's matched association, never a newer queue entry. */
  releaseMatched(invite: string) {
    this.store.db
      .prepare("DELETE FROM pvp_queue WHERE status='matched' AND room_invite=?")
      .run(invite);
  }
  /** Drop expired unused lobbies. Completed matches and open battles stay. */
  purgeExpiredLobbies(now: number, limit = 40): string[] {
    const purged: string[] = [];
    const rows = this.store.db
      .prepare("SELECT id, record FROM pvp_rooms ORDER BY rowid ASC LIMIT ?")
      .all(limit) as { id: string; record: string }[];
    for (const row of rows) {
      let room: PvpRoom;
      try {
        room = readStored(pvpRoomSchema, row.record);
      } catch {
        continue;
      }
      if (!invitationExpired(room, now)) continue;
      this.store.db
        .prepare("DELETE FROM pvp_members WHERE room_id=?")
        .run(room.id);
      this.store.db.prepare("DELETE FROM pvp_rooms WHERE id=?").run(room.id);
      purged.push(seriesReservation(room));
    }
    return purged;
  }
  roomsFor(actor: string): PvpRoom[] {
    return (
      this.store.db
        .prepare(
          `SELECT pvp_rooms.record AS record
           FROM pvp_members JOIN pvp_rooms ON pvp_rooms.id = pvp_members.room_id
           WHERE pvp_members.actor=?
           ORDER BY pvp_rooms.rowid DESC LIMIT 30`,
        )
        .all(actor) as { record: string }[]
    ).map((row) => readStored(pvpRoomSchema, row.record));
  }
}
