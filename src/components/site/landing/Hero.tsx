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
        <Environment id="sanctuary" hero />
      </div>
      <HeroFilm />
      <div className="gateway-shade" aria-hidden="true" />
      <div className="gateway-copy">
        <h1 id="welcome-title">
          <Brand hero />
        </h1>
        <p className="gateway-genre">Turn-based creature battles.</p>
        <div className="gateway-actions">
          <Link prefetch={false} className="world-button" href="/start">
            Play now
          </Link>
          <a className="gateway-secondary" href="#gameplay">
            Watch gameplay
          </a>
        </div>
      </div>
    </section>
  );
}
