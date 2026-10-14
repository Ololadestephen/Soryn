import { difficultySnapshot } from "../../src/domain/combat/definitions";
import { initialCombat, resolveRound } from "../../src/domain/combat/engine";
import { legalMoves } from "../../src/domain/combat/moves";
import { chooseOpponent } from "../../src/domain/combat/policy";
import type {
  CombatSnapshot,
  CombatState,
  Move,
} from "../../src/domain/combat/contracts";
const strategies = [
  "basic-only",
  "special-when-useful",
  "alternate-guard",
  "guard-only",
] as const;
type Strategy = (typeof strategies)[number];
function playerMove(
  strategy: Strategy,
  snapshot: CombatSnapshot,
  state: CombatState,
): Move {
  const legal = legalMoves(snapshot, state, "player");
  if (
    strategy === "guard-only" ||
    (strategy === "alternate-guard" && state.round % 2 === 0)
  )
    return "guard";
  if (
    strategy === "special-when-useful" &&
    legal.includes("special") &&
    (snapshot.player.id !== "patch" ||
      state.player.health <= snapshot.player.health - 14)
  )
    return "special";
  return legal.includes("basic") ? "basic" : "guard";
}
export function combatBenchmark() {
  const cases: {
    mode: string;
    player: string;
    opponent: string;
    strategy: string;
    outcome: string;
    rounds: number;
    playerHP: number;
    opponentHP: number;
  }[] = [];
  for (const mode of ["easy", "medium", "hard"] as const)
    for (const player of ["pip", "bolt", "patch", "moss"] as const)
      for (const opponent of ["bolt", "aegis", "prism", "echo"] as const)
        for (const strategy of strategies) {
          const snapshot = difficultySnapshot(player, opponent, mode, 0);
          let state = initialCombat(snapshot);
          const completed: { player: Move; opponent: Move }[] = [];
          while (!state.outcome) {
            const foe = chooseOpponent(snapshot, state, completed),
              intent = playerMove(strategy, snapshot, state);
            completed.push({ player: intent, opponent: foe.move });
            state = resolveRound(snapshot, state, intent, foe.move).state;
          }
          cases.push({
            mode,
            player,
            opponent,
            strategy,
            outcome: state.outcome,
            rounds: state.round - 1,
            playerHP: state.player.health,
            opponentHP: state.opponent.health,
          });
        }
  const summary = ["easy", "medium", "hard"].map((mode) => {
    const rows = cases.filter((row) => row.mode === mode);
    return {
      mode,
      samples: rows.length,
      playerWins: rows.filter((row) => row.outcome === "victory").length,
      computerWins: rows.filter((row) => row.outcome === "defeat").length,
      draws: rows.filter((row) => row.outcome === "draw").length,
      meanRounds: Number(
        (rows.reduce((sum, row) => sum + row.rounds, 0) / rows.length).toFixed(
          2,
        ),
      ),
    };
  });
  return {
    label: "Deterministic fixed-strategy simulations, not human win rates",
    policy: "combat-opponent/2",
    rules: "combat-rules/1",
    tie: 0,
    samples: cases.length,
    summary,
    cases,
  };
}
