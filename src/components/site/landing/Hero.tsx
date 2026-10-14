"use client";
import { useRef } from "react";
import Link from "next/link";
import { Environment } from "./Environment";
import { useSceneMotion } from "./useSceneMotion";
import { HeroFilm } from "./HeroFilm";
import { Brand } from "../Brand";

export function Hero() {
  const root = useRef<HTMLElement>(null);
  useSceneMotion(root);
  return (
    <section
      className="gateway-hero"
      ref={root}
      data-motion="off"
      aria-labelledby="welcome-title"
    >
      <div className="gateway-world" aria-hidden="true">
        <Environment id="sanctuary" />
      </div>
      <HeroFilm />
      <div className="gateway-shade" aria-hidden="true" />
      <div className="gateway-copy">
        <h1 id="welcome-title">
          <Brand hero />
        </h1>
        <p className="gateway-genre">Turn-based creature battles.</p>
        <p className="gateway-description">
          Choose your fighter. Time your defence.
          <br />
          Unleash your companion.
        </p>
        <div className="gateway-actions">
          <Link prefetch={false} className="world-button" href="/arena">
            Play now
          </Link>
          <Link
            prefetch={false}
            className="gateway-secondary"
            href="/challenge"
          >
            Challenge a friend
          </Link>
          <a className="gateway-secondary" href="#gameplay">
            Watch gameplay
          </a>
        </div>
        <p className="gateway-note">
          Play in your browser. Four free starters. No wallet required.
        </p>
        <div className="hero-lineup" aria-label="Game features">
          <span>Twelve fighters</span>
          <span>Twelve companions</span>
          <span>Four arenas</span>
        </div>
      </div>
    </section>
  );
}
