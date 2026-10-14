"use client";
import { useRef } from "react";
import Link from "next/link";
import {
  character,
  characters,
  type CharacterId,
} from "../../domain/characters/definitions";
import { Portrait } from "./Portrait";
export function CharacterSelection({
  selected,
  onSelect,
  holder = false,
  disabled = false,
}: {
  selected: CharacterId;
  onSelect: (id: CharacterId) => void;
  holder?: boolean;
  disabled?: boolean;
}) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const chosen = character(selected);
  return (
    <details ref={disclosure} className="roster-disclosure">
      <summary>
        Change character · {chosen.name} / {chosen.role}
      </summary>
      <section
        className="character-selection"
        aria-labelledby={
          holder ? "official-roster-title" : "guest-roster-title"
        }
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Choose your approach to bad decisions</p>
            <h2 id={holder ? "official-roster-title" : "guest-roster-title"}>
              Meet the adventurers.
            </h2>
          </div>
          <span className="small-label">
            Four starters · eight holder classes
          </span>
        </div>
        <p>
          Original application classes, not NFT traits. Everyone gets ten turns
          and one basic decoy. Starter skills have one charge; holder classes
          have two.
        </p>
        <fieldset disabled={disabled}>
          <legend>
            Character for your next{" "}
            {holder ? "official chapter" : "guest adventure"}
          </legend>
          <div className="character-grid">
            {characters.map((entry) => {
              const locked = entry.access === "holder" && !holder;
              return (
                <label
                  key={entry.id}
                  className={`character-card ${selected === entry.id ? "selected" : ""} ${locked ? "locked" : ""}`}
                >
                  <Portrait id={entry.id} />
                  <div className="character-card-copy">
                    <span className="small-label">
                      {entry.access === "starter"
                        ? "Starter · 1 charge"
                        : "Chog holder · 2 charges"}
                    </span>
                    <h3>
                      {entry.name} <span>/ {entry.role}</span>
                    </h3>
                    <p>{entry.personality}</p>
                    <strong>{entry.ability}</strong>
                    <p>{entry.rule}</p>
                    {locked ? (
                      <span className="locked-label">
                        Locked · verify current Chog ownership in My Chog
                      </span>
                    ) : (
                      <span className="character-pick">
                        <input
                          type="radio"
                          name={
                            holder ? "official-character" : "guest-character"
                          }
                          aria-label={`${entry.name} / ${entry.role}`}
                          value={entry.id}
                          checked={selected === entry.id}
                          onChange={() => {
                            onSelect(entry.id);
                            if (disclosure.current) {
                              disclosure.current.open = false;
                              disclosure.current
                                .querySelector("summary")
                                ?.focus();
                            }
                          }}
                        />{" "}
                        {selected === entry.id
                          ? "Selected"
                          : "Choose character"}
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>
        {!holder && (
          <p className="muted">
            <Link href="/character">Verify your Chog in My Chog</Link> to select
            holder classes for official chapters. Public challenges may lend
            their exact class for that challenge only.
          </p>
        )}
        {holder && (
          <p className="muted">
            Current ownership and your grant are rechecked before every official
            action. Selecting a card does not itself authorize play.
          </p>
        )}
      </section>
    </details>
  );
}
