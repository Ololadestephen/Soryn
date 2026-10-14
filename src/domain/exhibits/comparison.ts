import { type GameState } from "../game/contracts";
type Score = Pick<GameState, "outcome" | "turns" | "alarm">;

export function compareResults(
  player: Score,
  opponent: Score,
): "better" | "tied" | "behind" {
  if (!player.outcome || !opponent.outcome)
    throw new Error("Comparison requires two terminal results.");
  const rank = (state: Score) => [
    state.outcome === "escaped" ? 1 : 0,
    state.turns,
    -state.alarm,
  ];
  const a = rank(player),
    b = rank(opponent);
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] > b[i] ? "better" : "behind";
  }
  return "tied";
}
