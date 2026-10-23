import Image from "next/image";
import { PUBLIC_FIGHTERS } from "../../domain/access/policy";
import {
  character,
  characters,
  type CharacterId,
} from "../../domain/characters/definitions";
import { fighter } from "../../domain/combat/definitions";
import { companions } from "../combat/rendered/catalogue";
import { IdleArt } from "../combat/rendered/IdleArt";
import assets from "../combat/rendered/assets.json";

export function FighterPicker({
  selected,
  disabled,
  startersOnly,
  publicSix = false,
  allowed,
  holder,
  onSelect,
}: {
  selected: CharacterId | null;
  disabled: boolean;
  startersOnly: boolean;
  holder: boolean;
  publicSix?: boolean;
  allowed?: CharacterId[];
  onSelect: (id: CharacterId) => void;
}) {
  const shown = selected ?? "pip";
  const definition = character(shown);
  const special = fighter(shown).moves.special;
  const roster = characters.filter(
    (entry) =>
      !startersOnly ||
      (publicSix
        ? (PUBLIC_FIGHTERS as readonly CharacterId[]).includes(entry.id)
        : entry.access === "starter"),
  );
  return (
    <div className="pvp-picker">
      <section className="pvp-selected" aria-label="Selected fighter">
        <div className="pvp-preview-art">
          <IdleArt id={shown} />
          <div className="pvp-preview-companion">
            <IdleArt id={shown} companion />
          </div>
        </div>
        <div className="pvp-fighter-description">
          <p className="eyebrow">
            {selected ? "Selected fighter" : "Fighter preview"} ·{" "}
            {definition.role}
          </p>
          <h2>
            {definition.name} <span>& {companions[shown]}</span>
          </h2>
          <p>
            <strong>{special.name}.</strong> {special.rule}
          </p>
        </div>
      </section>
      <fieldset className="fighter-roster" disabled={disabled}>
        <legend>Choose your fighter</legend>
        {roster.map((entry) => {
          const locked = allowed
            ? !allowed.includes(entry.id)
            : entry.access === "holder" && !holder;
          const chosen = selected === entry.id;
          return (
            <label
              key={entry.id}
              className={`pvp-fighter-tile${chosen ? " is-selected" : ""}${locked ? " is-locked" : ""}`}
            >
              <Image
                unoptimized
                loading="lazy"
                src={assets[entry.id].thumbnail}
                width={96}
                height={96}
                alt=""
              />
              <span>
                <strong>{entry.name}</strong>
                <small>{entry.role}</small>
                <small className="pvp-tile-state">
                  {locked ? "Chog required" : chosen ? "Selected" : "Available"}
                </small>
              </span>
              <input
                type="radio"
                name="pvp-fighter"
                value={entry.id}
                checked={chosen}
                disabled={locked}
                onChange={() => onSelect(entry.id)}
                aria-label={`${entry.name} / ${entry.role}`}
              />
            </label>
          );
        })}
      </fieldset>
      {!startersOnly && !holder && !publicSix && (
        <p className="pvp-access-note">
          Locked fighters require verified Chog Genesis ownership in{" "}
          <a href="/character">My Chog</a>.
        </p>
      )}
    </div>
  );
}
