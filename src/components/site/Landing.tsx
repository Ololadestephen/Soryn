import Link from "next/link";
import { SiteFooter } from "./SiteFooter";
import { LegacySections } from "./LegacySections";
import { Hero } from "./landing/Hero";
import { Roster } from "./landing/Roster";
import { ArenaGallery } from "./landing/ArenaGallery";
import { Brand } from "./Brand";
import { GameplayShowcase } from "./landing/GameplayShowcase";
import {
  HolderInvite,
  Closing,
  SecondaryExperiences,
} from "./landing/LandingSections";

export function Landing() {
  return (
    <div className="cinematic-landing">
      <a className="skip-link" href="#welcome">
        Skip to content
      </a>
      <header className="landing-nav">
        <Link
          prefetch={false}
          href="/"
          className="landing-brand"
          aria-label="Chog Déjà Vu home"
        >
          <Brand />
        </Link>
        <nav aria-label="Main navigation">
          <Link prefetch={false} href="/challenge">
            Challenge
          </Link>
          <Link prefetch={false} href="/arena">
            Practice
          </Link>
          <a href="#fighters">Fighters</a>
          <Link prefetch={false} href="/character">
            My Chog
          </Link>
          <Link prefetch={false} href="/history">
            Battle history
          </Link>
        </nav>
      </header>
      <main id="welcome" tabIndex={-1}>
        <Hero />
        <GameplayShowcase />
        <Roster />
        <ArenaGallery />
        <HolderInvite />
        <SecondaryExperiences />
        <Closing />
      </main>
      <SiteFooter />
      <LegacySections />
    </div>
  );
}
