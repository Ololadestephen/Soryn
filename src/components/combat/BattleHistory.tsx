import type { BattleSession, BattleView } from "../../domain/combat/contracts";
import { difficultyLabel } from "../../domain/combat/difficulty/contracts";
import { arenas } from "../../domain/combat/arenas";

export function BattleLog({ battle }: { battle: BattleView }) {
  return (
    <div className="combat-log">
      <p>{arenas[battle.arena ?? "sanctuary"].name} · cosmetic arena</p>
      <h3>
        {difficultyLabel(battle.snapshot)} · {battle.rounds.length} resolved
        rounds
      </h3>
      {battle.rounds
        .slice()
        .reverse()
        .map((round) => (
          <article key={round.round}>
            <h3>
              Round {round.round}:{" "}
              {battle.snapshot.player.moves[round.player].name} /{" "}
              {battle.snapshot.opponent.moves[round.opponent].name}
            </h3>
            <p>
              {battle.snapshot.policy === "combat-pvp/1"
                ? "Round note"
                : "Computer explanation"}
              : {round.reason}
            </p>
            <ol>
              {round.events.map((event, index) => (
                <li key={index}>{event.message}</li>
              ))}
            </ol>
          </article>
        ))}
    </div>
  );
}
export function BattleHistory({
  history,
  busy,
  mode,
  review,
}: {
  history: BattleSession["history"];
  busy: boolean;
  mode: "guest" | "official";
  review: (id: string) => void;
}) {
  return (
    <div className="combat-history">
      <h3>Your private {mode} battle history</h3>
      <ul>
        {history.map((entry) => (
          <li key={entry.id}>
            {entry.fighter} · {entry.difficulty ?? "Legacy policy"} ·{" "}
            {entry.outcome} · {entry.rounds} rounds ·{" "}
            {arenas[entry.arena ?? "sanctuary"].name}{" "}
            <button disabled={busy} onClick={() => review(entry.id)}>
              Review battle
            </button>
          </li>
        ))}
      </ul>
      <p>
        Private by default. Guest battles never write official token history.
        Adventure records remain separate.
      </p>
    </div>
  );
}
