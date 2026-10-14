import { z } from "zod";
import { characterIdSchema } from "../characters/definitions";
import { addressSchema, identitySchema } from "../identity";
import {
  moveSchema,
  roundSchema,
  snapshotSchema,
  stateSchema,
} from "../combat/contracts";
import { arenaChoiceSchema, arenaSchema } from "../combat/arenas";
import { PVP_TIMEOUT_VERSION } from "./timers";

export const seatIds = ["a", "b"] as const;
export const seatIdSchema = z.enum(seatIds);
export type SeatId = z.infer<typeof seatIdSchema>;

/** Last official ownership grant stamped onto this seat. Absent on older rooms. */
export const holderGrantSchema = z
  .strictObject({
    identity: identitySchema,
    generation: z.uuid(),
    owner: addressSchema,
  })
  .nullable()
  .default(null);

const seatSchema = z.strictObject({
  actor: z.uuid(),
  mode: z.enum(["guest", "official"]),
  name: z.string().min(3).max(40),
  joinedAt: z.number().int(),
  lastSeenAt: z.number().int(),
  characterId: characterIdSchema.nullable(),
  ready: z.boolean(),
  assetsReady: z.boolean(),
  rematch: z.boolean(),
  misses: z.number().int().min(0).max(2),
  notice: z.string().max(160).nullable(),
  holderGrant: holderGrantSchema,
});
export type PvpSeat = z.infer<typeof seatSchema>;

const lockSchema = z
  .strictObject({
    round: z.number().int().min(1).max(20),
    move: moveSchema,
  })
  .nullable();

const resultSchema = z.strictObject({
  kind: z.enum(["knockout", "time", "forfeit", "abandoned"]),
  winner: seatIdSchema.nullable(),
  explanation: z.string().min(1).max(200),
});
export type PvpResult = z.infer<typeof resultSchema>;

const timersSchema = z.strictObject({
  version: z.literal(PVP_TIMEOUT_VERSION),
  moveMs: z.number().int().min(1000).max(120_000),
  presentMs: z.number().int().min(200).max(30_000),
  loadingMs: z.number().int().min(1000).max(120_000),
  lobbyMs: z.number().int().min(60_000).max(86_400_000),
  disconnectMs: z.number().int().min(2000).max(60_000),
  missedTurns: z.literal(2),
});

const matchSchema = z
  .strictObject({
    id: z.uuid(),
    rematchOf: z.uuid().nullable(),
    createdAt: z.number().int(),
    arena: arenaSchema,
    snapshot: snapshotSchema,
    state: stateSchema,
    rounds: z.array(roundSchema).max(20),
    eventSeq: z.number().int().nonnegative(),
    locks: z.strictObject({ a: lockSchema, b: lockSchema }),
    phase: z.enum(["loading", "choose", "present", "complete"]),
    deadlineAt: z.number().int(),
    result: resultSchema.nullable(),
  })
  .refine(
    (match) => match.snapshot.policy === "combat-pvp/1",
    "Private matches freeze the pvp rules snapshot.",
  )
  .refine(
    (match) =>
      match.eventSeq ===
      match.rounds.reduce((total, round) => total + round.events.length, 0),
    "Event sequence does not match stored rounds.",
  );
export type PvpMatch = z.infer<typeof matchSchema>;

export const pvpRoomSchema = z
  .strictObject({
    version: z.literal("pvp-room/1"),
    id: z.uuid(),
    invite: z.string().regex(/^[A-Za-z0-9_-]{20,80}$/),
    revision: z.number().int().nonnegative(),
    createdAt: z.number().int(),
    expiresAt: z.number().int(),
    closedAt: z.number().int().nullable(),
    arenaChoice: arenaChoiceSchema,
    rematchOf: z.uuid().nullable(),
    seats: z.strictObject({
      a: seatSchema.nullable(),
      b: seatSchema.nullable(),
    }),
    match: matchSchema.nullable(),
    completed: z.array(matchSchema).max(40),
    timers: timersSchema,
  })
  .refine((room) => {
    const actors = [room.seats.a?.actor, room.seats.b?.actor].filter(Boolean);
    return new Set(actors).size === actors.length;
  }, "One browser seat per battle.");
export type PvpRoom = z.infer<typeof pvpRoomSchema>;

export function seatOf(room: PvpRoom, actor: string): SeatId | null {
  if (room.seats.a?.actor === actor) return "a";
  if (room.seats.b?.actor === actor) return "b";
  return null;
}

export function otherSeat(seat: SeatId): SeatId {
  return seat === "a" ? "b" : "a";
}

export function invitationExpired(room: PvpRoom, now: number) {
  return (
    room.closedAt === null &&
    room.match === null &&
    room.completed.length === 0 &&
    now >= room.expiresAt
  );
}
