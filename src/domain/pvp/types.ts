import { z } from "zod";
import { accessGrantSchema } from "../access/policy";
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
const participantsSchema = z.strictObject({
  a: holderGrantSchema,
  b: holderGrantSchema,
});

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
  access: accessGrantSchema.optional(),
  cosmetic: z.boolean().optional(),
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
  intermissionMs: z.number().int().min(2_000).max(120_000).default(10_000),
  missedTurns: z.literal(2),
});

export const SERIES_POLICY = "series/1" as const;
// At most three wins, each preceded by one non-consecutive draw.
export const SERIES_MAX_BATTLES = 6;

const seriesOutcomeSchema = z
  .strictObject({
    kind: z.enum(["win", "draw", "forfeit", "abandoned", "no-contest"]),
    winner: seatIdSchema.nullable(),
    explanation: z.string().min(1).max(200),
  })
  .refine(
    (outcome) => outcome.kind !== "no-contest" || outcome.winner === null,
    "A no-contest series awards no win.",
  );

/** First to two battle wins. Absent on matches played before series/1. */
export const seriesSchema = z
  .strictObject({
    policy: z.literal(SERIES_POLICY),
    id: z.uuid(),
    battleNumber: z.number().int().min(1).max(SERIES_MAX_BATTLES),
    wins: z.strictObject({
      a: z.number().int().min(0).max(2),
      b: z.number().int().min(0).max(2),
    }),
    consecutiveDraws: z.number().int().min(0).max(2),
    phase: z.enum(["setup", "battle", "intermission", "complete"]),
    currentMatchId: z.uuid().nullable(),
    recorded: z.array(z.uuid()).max(SERIES_MAX_BATTLES),
    deadlineAt: z.number().int().nullable(),
    outcome: seriesOutcomeSchema.nullable(),
    participants: participantsSchema.optional(),
  })
  .nullable()
  .default(null);
export type PvpSeries = NonNullable<z.infer<typeof seriesSchema>>;

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
    participants: participantsSchema.optional(),
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
    series: seriesSchema,
    roster: z.enum(["private", "starters", "public-six"]).default("private"),
    origin: z.enum(["public", "private"]).optional(),
    ownershipStallSince: z.number().int().nullable().default(null),
    interruption: z
      .strictObject({
        reason: z.enum([
          "ownership-changed",
          "generation-invalidated",
          "verification-unavailable",
          "reservation-expired",
        ]),
        at: z.number().int(),
        openingGeneration: z.string().nullable(),
        observedGeneration: z.string().nullable(),
      })
      .nullable()
      .optional(),
  })
  .refine((room) => {
    const actors = [room.seats.a?.actor, room.seats.b?.actor].filter(Boolean);
    return new Set(actors).size === actors.length;
  }, "One browser seat per battle.");
export type PvpRoom = z.infer<typeof pvpRoomSchema>;

/** Before origin existed, only openMatched wrote the starters-only room contract. */
export function roomOrigin(room: Pick<PvpRoom, "origin" | "roster">) {
  return room.origin ?? (room.roster === "starters" ? "public" : "private");
}

export function roomFinished(room: PvpRoom) {
  return room.series
    ? room.series.phase === "complete"
    : room.match?.phase === "complete";
}

export function roomTerminal(room: PvpRoom, now: number) {
  return (
    room.closedAt !== null ||
    roomFinished(room) ||
    (room.ownershipStallSince === null && invitationExpired(room, now))
  );
}

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
