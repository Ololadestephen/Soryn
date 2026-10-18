import { SiteFooter } from "./SiteFooter";
import { LegacySections } from "./LegacySections";
import { Hero } from "./landing/Hero";
import { Roster } from "./landing/Roster";
import { ArenaGallery } from "./landing/ArenaGallery";
import { SiteHeader } from "./SiteHeader";
import { GameplayShowcase } from "./landing/GameplayShowcase";
import { HolderInvite } from "./landing/LandingSections";

export function Landing() {
  return (
    <div className="cinematic-landing">
      <a className="skip-link" href="#welcome">
        Skip to content
      </a>
      <SiteHeader cinematic />
      <main id="welcome" tabIndex={-1}>
        <Hero />
        <GameplayShowcase />
        <Roster />
        <ArenaGallery />
        <HolderInvite />
      </main>
      <SiteFooter />
      <LegacySections />
    </div>
  );
}
