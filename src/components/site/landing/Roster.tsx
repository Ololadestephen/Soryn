"use client";
import { useState } from "react";
import Image from "next/image";
import {
  characters,
  type CharacterId,
} from "../../../domain/characters/definitions";
import assets from "./assets.json";
import { useReveal } from "./useReveal";
import { FighterDossier } from "./FighterDossier";
import { SpecialPreview } from "./SpecialPreview";

export function Roster() {
  const [selected, setSelected] = useState<CharacterId>("pip");
  const { root, revealed, ready, reveal } = useReveal();
  const index = characters.findIndex((c) => c.id === selected);
  function choose(id: CharacterId) {
    reveal();
    setSelected(id);
  }
  return (
    <section
      className="landing-roster landing-section"
      id="fighters"
      ref={root}
      data-ready={ready}
      aria-labelledby="roster-title"
    >
      <div className="section-heading">
        <div>
          <p className="world-kicker">Choose your fighter</p>
          <h2 id="roster-title">
            Twelve fighters.
            <br />
            <em>Find your fighting style.</em>
          </h2>
        </div>
        <p>
          Twelve fighters. Twelve companions.
          <br />
          Find the pair that feels like you.
        </p>
      </div>
      <div className="roster-body">
        <div className="roster-art-panel">
          <SpecialPreview
            key={selected}
            id={selected}
            revealed={revealed}
            ready={ready}
          />
        </div>
        <FighterDossier id={selected} />
      </div>
      <div className="roster-index">
        <p>
          Meet the twelve <span>{String(index + 1).padStart(2, "0")} / 12</span>
        </p>
      </div>
      <div
        className="landing-fighter-list"
        role="group"
        aria-label="Meet the fighters"
      >
        {characters.map((c, i) => (
          <button
            key={c.id}
            className="fighter-tile"
            disabled={!ready}
            aria-pressed={selected === c.id}
            onClick={() => choose(c.id)}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowRight"
                  ? (i + 1) % 12
                  : event.key === "ArrowLeft"
                    ? (i + 11) % 12
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 11
                        : undefined;
              if (next === undefined) return;
              event.preventDefault();
              choose(characters[next].id);
              (
                event.currentTarget.parentElement?.children[
                  next
                ] as HTMLButtonElement
              )?.focus();
            }}
          >
            <span className="tile-art">
              {revealed && (
                <Image
                  unoptimized
                  src={assets[c.id].thumbnail}
                  alt=""
                  width="128"
                  height="128"
                />
              )}
            </span>
            <span className="tile-name">{c.name}</span>
            <span className="tile-access">
              {c.access === "starter" ? "Starter" : "Holder"}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
