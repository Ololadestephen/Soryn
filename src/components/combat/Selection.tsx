import { useEffect, useState } from "react";
import Link from "next/link";
import {
  character,
  type CharacterId,
} from "../../domain/characters/definitions";
import { fighter, fighters } from "../../domain/combat/definitions";
import { RenderedArt } from "./rendered/RenderedArt";
import type { Difficulty } from "../../domain/combat/contracts";
import { ArenaPicker } from "./ArenaPicker";
import type { ArenaChoice } from "../../domain/combat/arenas";
import { AudioControls } from "./audio/AudioControls";
import { combatAudio } from "./audio/runtime";
import { IdleArt } from "./rendered/IdleArt";
import { companions } from "./rendered/catalogue";
import { prepareSelectedAssets } from "./loading";
import landingAssets from "./rendered/assets.json";
import Image from "next/image";
import { fighterPlaystyles } from "./fighterCopy";

const difficultyDescriptions: Record<Difficulty, string> = {
  easy: "A steady rhythm: mostly basic attacks, with occasional guards and specials.",
  medium: "Adapts to public energy, effects and your completed moves.",
  hard: "Weighs legal replies and recent move patterns. No hidden stat boosts.",
};

export function FighterSelection({
  holder = false,
  allowed,
  busy,
  onStart,
  initialArena,
}: {
  holder?: boolean;
  allowed?: CharacterId[];
  busy: boolean;
  initialArena?: ArenaChoice;
  onStart: (
    id: CharacterId,
    opponent: CharacterId,
    difficulty: Difficulty,
    arena: ArenaChoice,
  ) => void;
}) {
  const [selected, setSelected] = useState<CharacterId>("pip"),
    [opponent, setOpponent] = useState<CharacterId>("bolt"),
    [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [arena, setArena] = useState<ArenaChoice>(initialArena ?? "sanctuary");
  useEffect(() => {
    if (busy || arena === "random") return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      void prepareSelectedAssets(
        selected,
        opponent,
        arena,
        undefined,
        abort.signal,
      );
    }, 600);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [selected, opponent, arena, busy]);
  const definition = fighter(selected),
    identity = character(selected);
  return (
    <div className="combat-selection">
      <div className="fighter-focus">
        <div className="setup-pair">
          <RenderedArt id={selected} preview />
          <div className="setup-companion">
            <IdleArt key={selected} id={selected} companion />
          </div>
          <p>
            {identity.name} & {companions[selected]}
          </p>
        </div>
        <div>
          <h2>
            {identity.name} / {identity.role}
          </h2>
          <p>{fighterPlaystyles[selected]}</p>
          <details key={selected} className="setup-abilities">
            <summary>Fighter & ability details</summary>
            <p className="fighter-stats">
              {definition.health} health · {definition.armour} armour ·{" "}
              {definition.speed} speed · 6 energy cap
            </p>
            <p>
              <strong>{definition.moves.special.name}</strong> ·{" "}
              {definition.moves.special.rule} Costs{" "}
              {definition.moves.special.cost} energy; rests{" "}
              {definition.moves.special.cooldown} following rounds.
            </p>
            <p className="muted">Passive: {definition.passive}</p>
          </details>
          <label className="opponent-select">
            Computer opponent
            <select
              value={opponent}
              disabled={busy}
              onChange={(event) =>
                setOpponent(event.target.value as CharacterId)
              }
            >
              {fighters.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {character(entry.id).name} / {character(entry.id).role}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="difficulty-picker" disabled={busy}>
            <legend>Difficulty</legend>
            {(["easy", "medium", "hard"] as const).map((mode) => (
              <label
                key={mode}
                className={mode === difficulty ? "difficulty-selected" : ""}
              >
                <input
                  type="radio"
                  name="difficulty"
                  value={mode}
                  checked={difficulty === mode}
                  onChange={() => {
                    setDifficulty(mode);
                    combatAudio.ui("select");
                  }}
                />
                <span>{mode[0].toUpperCase() + mode.slice(1)}</span>
              </label>
            ))}
          </fieldset>
          <p className="muted">{difficultyDescriptions[difficulty]}</p>
          <button
            disabled={busy}
            onClick={() => onStart(selected, opponent, difficulty, arena)}
          >
            {holder ? "Start official battle" : "Enter guest arena"}
          </button>
        </div>
      </div>
      <ArenaPicker
        value={arena}
        disabled={busy}
        onChange={(choice) => {
          setArena(choice);
          combatAudio.ui("select");
        }}
      />
      <AudioControls />
      <fieldset className="fighter-roster" disabled={busy}>
        <legend>Choose your fighter</legend>
        {fighters.map((entry) => {
          const identity = character(entry.id),
            locked = allowed
              ? !allowed.includes(entry.id)
              : identity.access === "holder" && !holder;
          return (
            <label
              key={entry.id}
              className={`fighter-option${locked ? " fighter-locked" : ""}${selected === entry.id ? " fighter-selected" : ""}`}
            >
              <Image
                className="combat-art"
                unoptimized
                loading="lazy"
                src={landingAssets[entry.id].thumbnail}
                alt=""
                width={128}
                height={128}
              />
              <span>
                <strong>{identity.name}</strong>
                <span>{identity.role}</span>
                <span>{locked ? "Holder only" : "Available"}</span>
              </span>
              <input
                type="radio"
                name="combat-fighter"
                value={entry.id}
                checked={selected === entry.id}
                disabled={locked}
                onChange={() => {
                  setSelected(entry.id);
                  combatAudio.ui("select");
                }}
                aria-label={`${identity.name} / ${identity.role}`}
              />
            </label>
          );
        })}
      </fieldset>
      {!holder && !allowed && (
        <p className="muted">
          Chog Genesis ownership unlocks the locked fighters in{" "}
          <Link href="/character">My Chog</Link>. Any fighter can be a computer
          opponent.
        </p>
      )}
    </div>
  );
}
