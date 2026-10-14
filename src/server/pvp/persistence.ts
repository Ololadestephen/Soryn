import {
  invitationExpired,
  pvpRoomSchema,
  type PvpRoom,
} from "../../domain/pvp/types";
import { ServiceError } from "../errors";
import { Store } from "../persistence";
import { readStored } from "../storedRecord";

export class PvpStore {
  constructor(readonly store: Store) {
    store.db.exec(`
      CREATE TABLE IF NOT EXISTS pvp_rooms (
        id TEXT PRIMARY KEY,
        invite TEXT UNIQUE NOT NULL,
        record TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pvp_members (
        actor TEXT NOT NULL,
        room_id TEXT NOT NULL,
        PRIMARY KEY (actor, room_id)
      );
    `);
  }
  byInvite(invite: string): PvpRoom {
    const row = this.store.db
      .prepare("SELECT record FROM pvp_rooms WHERE invite=?")
      .get(invite) as { record: string } | undefined;
    if (!row) throw new ServiceError(404, "Invitation not found.");
    return readStored(pvpRoomSchema, row.record);
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
  /** Drop expired unused lobbies. Completed matches and open battles stay. */
  purgeExpiredLobbies(now: number, limit = 40) {
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
    }
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
