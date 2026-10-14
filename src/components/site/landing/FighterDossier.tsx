import Link from "next/link";
import {
  character,
  type CharacterId,
} from "../../../domain/characters/definitions";
import { fighter } from "../../../domain/combat/definitions";
import { companions } from "../../combat/rendered/catalogue";
import { fighterPlaystyles } from "../../combat/fighterCopy";
export function FighterDossier({ id }: { id: CharacterId }) {
  const identity = character(id),
    definition = fighter(id),
    special = definition.moves.special;
  return (
    <div className="fighter-dossier" aria-live="polite" aria-atomic="true">
      <p className={`access-label access-${identity.access}`}>
        {identity.access === "starter"
          ? "Guest starter · no wallet required"
          : "Holder access · verified Chog required"}
      </p>
      <div className="dossier-title">
        <h3>{identity.name}</h3>
        <span>{identity.role}</span>
      </div>
      <p className="fighter-personality">{fighterPlaystyles[id]}</p>
      <p className="companion-name">Paired with {companions[id]}</p>
      <div className="special-dossier">
        <p className="world-kicker">Companion special</p>
        <h4>{special.name}</h4>
        <details key={id}>
          <summary>Ability details</summary>
          <p>{special.rule}</p>
          <p className="special-resource">
            {special.cost} energy · {special.cooldown} following rounds of
            cooldown · {special.hits === 2 ? "Two hits" : "One action"}
          </p>
          <p className="dossier-passive">
            <strong>Passive</strong> {definition.passive}
          </p>
          <p className="dossier-stats">
            {definition.health} health / {definition.armour} armour /{" "}
            {definition.speed} speed
          </p>
        </details>
      </div>
      <Link
        prefetch={false}
        className="text-link"
        href={identity.access === "starter" ? "/arena" : "/character"}
      >
        {identity.access === "starter"
          ? "Choose a starter in setup"
          : "Explore holder access"}{" "}
      </Link>
    </div>
  );
}
