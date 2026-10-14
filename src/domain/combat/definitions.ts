import { character, type CharacterId } from "../characters/definitions";
import {
  fighterSchema,
  snapshotSchema,
  type Fighter,
  type CombatSnapshot,
  type Move,
} from "./contracts";

function move(
  name: string,
  damage: number,
  treatment: Fighter["moves"][Move]["treatment"],
  rule: string,
  cost = 1,
  cooldown = 0,
  hits = 1,
  initiative = 0,
) {
  return { name, damage, treatment, rule, cost, cooldown, hits, initiative };
}
function define(
  id: CharacterId,
  health: number,
  armour: number,
  speed: number,
  shield: number,
  basic: Fighter["moves"][Move],
  special: Fighter["moves"][Move],
  passive: string,
): Fighter {
  return fighterSchema.parse({
    id,
    health,
    armour,
    speed,
    shield,
    passive,
    moves: {
      basic,
      special,
      guard: move(
        `${character(id).name}'s guard`,
        0,
        "guard",
        `Prepare ${shield} shield before either attack. ${passive}`,
        0,
      ),
    },
  });
}
export const fighters: readonly Fighter[] = [
  define(
    "pip",
    84,
    0,
    5,
    10,
    move(
      "Pebble precision",
      12,
      "ranged",
      "12 damage. +2 against a foe with ≤2 energy after lock.",
    ),
    move(
      "Survey Shot",
      16,
      "ranged",
      "16 damage; expose for 2 future rounds on health damage. Reveal already-public armour/cooldown.",
      3,
      2,
    ),
    "Basic gains 2 damage against low-energy foes.",
  ),
  define(
    "bolt",
    80,
    0,
    8,
    6,
    move("Quick jab", 10, "melee", "10 damage. +2 initiative.", 1, 0, 1, 2),
    move(
      "Express Delivery",
      8,
      "melee",
      "Two 8-damage hits. +2 initiative.",
      3,
      2,
      2,
      2,
    ),
    "Fast basic. Guard recovers 1 extra energy.",
  ),
  define(
    "patch",
    90,
    1,
    3,
    8,
    move(
      "Spanner shot",
      12,
      "ranged",
      "12 damage; consumes prepared +3 bonus.",
    ),
    move(
      "Field Repair",
      0,
      "heal",
      "Heal 14 at initiative; prepare 4 shield before attacks. No resurrection.",
      3,
      3,
    ),
    "+2 armour with ≥4 energy after lock. Guard prepares +3 next basic.",
  ),
  define(
    "moss",
    94,
    1,
    2,
    8,
    move("Seed toss", 11, "ranged", "11 damage."),
    move(
      "Spring Clean",
      10,
      "ranged",
      "10 damage; heal 6 and cleanse old exposed/disrupt/burn at initiative.",
      3,
      2,
    ),
    "Surviving guard heals 2, capped at full health.",
  ),
  define(
    "aegis",
    100,
    3,
    4,
    12,
    move("Shield tap", 13, "melee", "13 damage."),
    move(
      "Shield Bash",
      16,
      "melee",
      "16 damage; prepare 10 shield before attacks.",
      4,
      3,
    ),
    "Guard counters one health-damaging hit for 4 raw damage through armour. No counter chains.",
  ),
  define(
    "nyx",
    84,
    0,
    9,
    4,
    move("Quiet cut", 12, "melee", "12 damage."),
    move("Needle Night", 20, "melee", "20 damage, pierce 2 armour.", 3, 2),
    "+2 initiative in round 1. Guard dodges one basic hit only; special still lands.",
  ),
  define(
    "echo",
    88,
    0,
    6,
    4,
    move("Echo orb", 12, "ranged", "12 damage."),
    move(
      "Double Take",
      9,
      "ranged",
      "Two 9-damage hits. A decoy can absorb only part of the volley.",
      3,
      2,
      2,
    ),
    "Begin with one decoy absorbing 6. Guard refreshes one decoy for this round.",
  ),
  define(
    "prism",
    90,
    1,
    5,
    8,
    move("Glass dart", 12, "ranged", "12 damage; +3 against exposed foes."),
    move(
      "Spectrum Break",
      18,
      "ranged",
      "18 damage; expose for 2 future rounds on health damage.",
      3,
      2,
    ),
    "Basic gains 3 damage against exposed foes; exposed reduces armour 3 and prepared shield 4.",
  ),
  define(
    "atlas",
    112,
    3,
    1,
    12,
    move("Heavy hand", 15, "melee", "15 damage; consumes prepared +4 bonus."),
    move(
      "Heavy Parcel",
      26,
      "melee",
      "26 damage, −1 initiative. Slow and costly.",
      4,
      3,
      1,
      -1,
    ),
    "Guard prepares +4 next basic; heavy armour, slow initiative.",
  ),
  define(
    "flux",
    94,
    1,
    4,
    9,
    move("Spark bolt", 12, "ranged", "12 damage; +3 against disrupted foes."),
    move(
      "Short Circuit",
      15,
      "ranged",
      "15 damage; disrupt special selection next round on health damage. Already locked special still resolves.",
      3,
      2,
    ),
    "Basic gains 3 damage against disrupted foes.",
  ),
  define(
    "ember",
    96,
    0,
    6,
    6,
    move("Hot punch", 14, "melee", "14 damage; +3 at half health or lower."),
    move(
      "Flash Burn",
      28,
      "melee",
      "28 damage, burn 3 now and for 2 future ends on health damage; lose 7 HP after attack.",
      4,
      3,
    ),
    "Attacks gain 3 damage at half health or lower. Weak guard, no armour.",
  ),
  define(
    "mneme",
    96,
    1,
    5,
    9,
    move(
      "Recall orb",
      12,
      "ranged",
      "12 damage; +3 if foe repeats its previous completed move.",
    ),
    move(
      "Familiar Feeling",
      18,
      "ranged",
      "18 damage; +6 if revealed foe move repeats its previous completed move. No undo.",
      3,
      2,
    ),
    "Uses completed-round move memory, never an unsubmitted choice.",
  ),
];
export function fighter(id: CharacterId): Fighter {
  const found = fighters.find((entry) => entry.id === id);
  if (!found) throw new Error("Unsupported fighter.");
  return found;
}
export function combatSnapshot(
  player: CharacterId,
  opponent: CharacterId = "bolt",
  tie: 0 | 1 = 0,
): CombatSnapshot {
  return snapshotSchema.parse({
    definitions: "combat-fighters/1",
    moves: "combat-moves/1",
    rules: "combat-rules/1",
    policy: "combat-opponent/1",
    player: fighter(player),
    opponent: fighter(opponent),
    tie,
  });
}

export function pvpSnapshot(
  player: CharacterId,
  opponent: CharacterId,
  tie: 0 | 1 = 0,
): CombatSnapshot {
  return snapshotSchema.parse({
    definitions: "combat-fighters/1",
    moves: "combat-moves/1",
    rules: "combat-rules/1",
    policy: "combat-pvp/1",
    player: fighter(player),
    opponent: fighter(opponent),
    tie,
  });
}

export function difficultySnapshot(
  player: CharacterId,
  opponent: CharacterId,
  difficulty: import("./contracts").Difficulty,
  tie: 0 | 1 = 0,
): CombatSnapshot {
  return snapshotSchema.parse({
    ...combatSnapshot(player, opponent, tie),
    policy: "combat-opponent/2",
    difficulty,
  });
}
