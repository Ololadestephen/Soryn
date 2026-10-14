"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { arenas, arenaIds, type ArenaId } from "../../../domain/combat/arenas";
import { Environment } from "./Environment";
import { useReveal } from "./useReveal";
export function ArenaGallery() {
  const [selected, setSelected] = useState<ArenaId>("sanctuary");
  const { root, revealed, ready, reveal } = useReveal();
  return (
    <section
      className="landing-arenas"
      id="arenas"
      ref={root}
      aria-labelledby="arenas-title"
    >
      <div className="arena-landscape" aria-hidden="true">
        {revealed && <Environment key={selected} id={selected} />}
      </div>
      <div className="arena-gallery-shade" />
      <div className="arena-gallery-content">
        <p className="world-kicker">Choose your ground</p>
        <h2 id="arenas-title">
          Four arenas.
          <br />
          <em>Set the scene.</em>
        </h2>
        <div className="arena-description" aria-live="polite">
          <h3>{arenas[selected].name}</h3>
          <p>{arenas[selected].description}</p>
        </div>
        <Link
          prefetch={false}
          className="world-button"
          href={`/arena?arena=${selected}`}
        >
          Battle here
        </Link>
        <p className="arena-handoff-note">
          Choose your fighter next. Your saved battle stays safe.
        </p>
        <div
          className="arena-gallery-options"
          role="group"
          aria-label="Explore four arenas"
        >
          {arenaIds.map((id) => (
            <button
              key={id}
              aria-pressed={selected === id}
              disabled={!ready}
              onClick={() => {
                reveal();
                setSelected(id);
              }}
            >
              {revealed && (
                <Image
                  unoptimized
                  src={`/combat/arenas/${id}-preview.webp`}
                  width="240"
                  height="160"
                  alt=""
                />
              )}
              <span>{arenas[id].name}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
