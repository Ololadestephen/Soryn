import type { Observation } from "../../domain/game/contracts";
import { character } from "../../domain/characters/definitions";
export function AbilityStatus({ observation }: { observation: Observation }) {
  const t = observation.tactics;
  if (!t) return null;
  const entry = character(t.loadout.characterId);
  const effects = [
    t.effects.bubble ? "Safety bubble armed" : "",
    t.effects.trail ? `False trail: ${t.effects.trail} guard turns left` : "",
    t.effects.steady ? "Steady hands ready" : "",
    t.effects.reroute ? "Mechanism rerouted" : "",
    t.pending ? `Committed ${t.pending}; outcome unresolved` : "",
  ].filter(Boolean);
  return (
    <div className="ability-status">
      <h4>
        {entry.name} / {entry.role}
      </h4>
      <p>
        <strong>{entry.ability}</strong> ·{" "}
        <span>
          {t.charges} / {t.loadout.charges} charges left
        </span>
      </p>
      <details>
        <summary>Ability rules and access</summary>
        <p>{entry.rule}</p>
        <p className="muted">
          {entry.access === "holder"
            ? "Holder-class loadout · two initial charges"
            : "Starter loadout · one initial charge"}
        </p>
      </details>
      {effects.length > 0 && (
        <ul aria-label="Active character effects">
          {effects.map((effect) => (
            <li key={effect}>{effect}</li>
          ))}
        </ul>
      )}
      {!observation.outcome &&
        !observation.choices.some(
          (choice) => choice.action === entry.skill,
        ) && (
          <p className="muted">
            {t.charges
              ? "No eligible target here, or this effect is already active."
              : "Signature skill exhausted for this chapter."}
          </p>
        )}
    </div>
  );
}
