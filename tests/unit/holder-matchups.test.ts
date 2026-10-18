import { expect, it } from "vitest";
import { PUBLIC_FIGHTERS } from "../../src/domain/access/policy";
import { pvpSnapshot } from "../../src/domain/combat/definitions";
import { initialCombat, resolveRound } from "../../src/domain/combat/engine";
import { legalMoves } from "../../src/domain/combat/moves";
import type {
  CombatState,
  CombatSnapshot,
  Side,
  Move,
} from "../../src/domain/combat/contracts";
import { mkdirSync, writeFileSync } from "node:fs";
function move(
  snapshot: CombatSnapshot,
  state: CombatState,
  side: Side,
  policy: number,
): Move {
  const legal = legalMoves(snapshot, state, side);
  if (policy === 2 && state.round % 3 === 0) return "guard";
  return policy !== 0 && legal.includes("special") ? "special" : "basic";
}
it("all shared-six matchups resolve under both tie orders and three transparent policies", () => {
  const results: Record<
    string,
    { victory: number; defeat: number; draw: number }
  > = {};
  for (const a of PUBLIC_FIGHTERS)
    for (const b of PUBLIC_FIGHTERS) {
      const counts = { victory: 0, defeat: 0, draw: 0 };
      for (const tie of [0, 1] as const)
        for (let pa = 0; pa < 3; pa++)
          for (let pb = 0; pb < 3; pb++) {
            const snapshot = pvpSnapshot(a, b, tie);
            let state = initialCombat(snapshot);
            for (let n = 0; n < 20 && !state.outcome; n++)
              state = resolveRound(
                snapshot,
                state,
                move(snapshot, state, "player", pa),
                move(snapshot, state, "opponent", pb),
              ).state;
            expect(state.outcome).not.toBeNull();
            counts[state.outcome!]++;
          }
      results[`${a}/${b}`] = counts;
    }
  mkdirSync(".cache/holder-story-20261018", { recursive: true });
  writeFileSync(
    ".cache/holder-story-20261018/matchup-simulations.json",
    JSON.stringify(
      {
        fixture: true,
        policies: [
          "basic",
          "special when legal",
          "guard every third turn, otherwise special",
        ],
        results,
      },
      null,
      2,
    ),
  );
});
