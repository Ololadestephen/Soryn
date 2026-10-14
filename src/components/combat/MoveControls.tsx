import type { BattleView, Move } from "../../domain/combat/contracts";
import { useEffect, useRef } from "react";

export function unavailableMove(battle: BattleView, move: Move) {
  if (battle.legal.includes(move)) return "";
  if (move === "special" && battle.state.player.effects.disrupt)
    return "Special sealed";
  if (move === "special" && battle.state.player.cooldown)
    return `Resting ${battle.state.player.cooldown} rounds`;
  return `Need ${battle.snapshot.player.moves[move].cost} energy`;
}
export function MoveControls({
  battle,
  busy,
  step,
}: {
  battle: BattleView;
  busy: boolean;
  step: (move: Move) => unknown;
}) {
  const lastMove = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (busy || battle.state.outcome || !lastMove.current) return;
    const active = document.activeElement;
    if (
      active === document.body ||
      active?.classList.contains("battle-stage")
    ) {
      const target = lastMove.current.disabled
        ? lastMove.current.parentElement?.querySelector<HTMLButtonElement>(
            "button:not(:disabled)",
          )
        : lastMove.current;
      target?.focus({ preventScroll: true });
    }
  }, [busy, battle.state.outcome]);
  return (
    <div className="combat-controls" aria-label="Battle moves">
      {(["basic", "guard", "special"] as const).map((move) => {
        const definition = battle.snapshot.player.moves[move];
        const label =
          move === "basic"
            ? "Attack"
            : move === "guard"
              ? "Defence"
              : "Special";
        const reason = unavailableMove(battle, move);
        return (
          <button
            key={move}
            disabled={busy || !!reason || !!battle.state.outcome}
            onClick={(event) => {
              lastMove.current = event.currentTarget;
              void step(move);
            }}
            aria-label={`${move === "basic" ? "Basic attack" : label} · ${definition.name}`}
            title={`${definition.name}: ${definition.rule}`}
          >
            <span className="move-icon" aria-hidden="true">
              {move === "basic" ? "✊" : move === "guard" ? "⛨" : "✦"}
            </span>
            <span>{label}</span>
            <small>
              {reason ||
                `${definition.cost} energy${move === "special" ? ` · rest ${definition.cooldown}` : ""}`}
            </small>
          </button>
        );
      })}
    </div>
  );
}
