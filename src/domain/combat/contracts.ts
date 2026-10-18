import { z } from "zod";
import { characterIdSchema } from "../characters/definitions";
import type { ArenaId } from "./arenas";

export const moveSchema = z.enum(["basic", "special", "guard"]);
export const battleModeSchema = z.enum(["guest", "official"]);
export type Move = z.infer<typeof moveSchema>;
export type Side = "player" | "opponent";
export const sides: readonly Side[] = ["player", "opponent"];
export function other(side: Side): Side {
  return side === "player" ? "opponent" : "player";
}
const moveDefinitionSchema = z.strictObject({
  name: z.string().max(48),
  cost: z.number().int().min(0).max(4),
  damage: z.number().int().min(0).max(28),
  hits: z.number().int().min(1).max(2),
  initiative: z.number().int().min(-1).max(2),
  cooldown: z.number().int().min(0).max(3),
  treatment: z.enum(["melee", "ranged", "heal", "guard"]),
  rule: z.string().max(400),
});
export const fighterSchema = z.strictObject({
  id: characterIdSchema,
  health: z.number().int().min(1).max(112),
  armour: z.number().int().min(0).max(3),
  speed: z.number().int().min(1).max(9),
  shield: z.number().int().min(4).max(12),
  passive: z.string().max(200),
  moves: z.strictObject({
    basic: moveDefinitionSchema,
    special: moveDefinitionSchema,
    guard: moveDefinitionSchema,
  }),
});
export type Fighter = z.infer<typeof fighterSchema>;
export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof difficultySchema>;
const snapshotFields = {
  definitions: z.literal("combat-fighters/1"),
  moves: z.literal("combat-moves/1"),
  rules: z.literal("combat-rules/1"),
  tie: z.union([z.literal(0), z.literal(1)]),
  player: fighterSchema,
  opponent: fighterSchema,
};
export const snapshotSchema = z.discriminatedUnion("policy", [
  z.strictObject({ ...snapshotFields, policy: z.literal("combat-opponent/1") }),
  z.strictObject({
    ...snapshotFields,
    policy: z.literal("combat-opponent/2"),
    difficulty: difficultySchema,
  }),
  z.strictObject({ ...snapshotFields, policy: z.literal("combat-pvp/1") }),
]);
export type CombatSnapshot = z.infer<typeof snapshotSchema>;
export const effectsSchema = z.strictObject({
  exposed: z.number().int().min(0).max(2),
  disrupt: z.number().int().min(0).max(1),
  burn: z.number().int().min(0).max(2),
  decoy: z.number().int().min(0).max(6),
  focus: z.number().int().min(0).max(4),
});
const fighterStateSchema = z.strictObject({
  health: z.number().int().min(0).max(112),
  energy: z.number().int().min(0).max(6),
  cooldown: z.number().int().min(0).max(3),
  effects: effectsSchema,
  lastMove: moveSchema.nullable(),
});
export type FighterState = z.infer<typeof fighterStateSchema>;
export const stateSchema = z.strictObject({
  round: z.number().int().min(1).max(21),
  player: fighterStateSchema,
  opponent: fighterStateSchema,
  outcome: z.enum(["victory", "defeat", "draw"]).nullable(),
});
export type CombatState = z.infer<typeof stateSchema>;
export const eventSchema = z.strictObject({
  kind: z.enum([
    "prepare",
    "melee",
    "ranged",
    "impact",
    "return",
    "heal",
    "status",
    "counter",
    "cancel",
    "knockout",
    "recovery",
    "result",
  ]),
  side: z.enum(["player", "opponent"]).nullable(),
  move: moveSchema.nullable(),
  message: z.string().max(400),
  state: stateSchema,
  /** New events carry presentation facts; absent only in frozen legacy rounds. */
  detail: z
    .discriminatedUnion("type", [
      z.strictObject({
        type: z.literal("prepare"),
        shield: z.number().int().nonnegative(),
      }),
      z.strictObject({
        type: z.literal("attack"),
        shield: z.number().int().nonnegative(),
        decoy: z.number().int().nonnegative(),
        dodged: z.boolean(),
      }),
      z.strictObject({ type: z.enum(["burn", "recoil"]) }),
    ])
    .optional(),
});
export type CombatEvent = z.infer<typeof eventSchema>;
export const roundSchema = z
  .strictObject({
    eventFormat: z.literal(2).optional(),
    round: z.number().int().min(1).max(20),
    player: moveSchema,
    opponent: moveSchema,
    reason: z.string().max(240),
    events: z.array(eventSchema).min(1).max(36),
  })
  .refine(
    (round) =>
      round.eventFormat !== 2 ||
      round.events.every((event) =>
        event.kind === "prepare"
          ? event.detail?.type === "prepare"
          : event.kind === "impact"
            ? !!event.detail &&
              ["attack", "burn", "recoil"].includes(event.detail.type)
            : true,
      ),
    "Structured rounds require preparation and impact details.",
  );
export type ResolvedRound = z.infer<typeof roundSchema>;
export interface BattleView {
  accessKind?: "token" | "nft" | "both";
  cosmetic?: boolean;
  arena?: ArenaId;
  id: string;
  mode: "guest" | "official";
  tokenId: string | null;
  snapshot: CombatSnapshot;
  state: CombatState;
  rounds: ResolvedRound[];
  legal: Move[];
}
export interface BattleSession {
  battle: BattleView | null;
  history: {
    id: string;
    fighter: string;
    outcome: string;
    rounds: number;
    difficulty?: Difficulty | "legacy";
    arena?: ArenaId;
  }[];
}
