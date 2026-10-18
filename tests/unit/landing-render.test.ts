import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { SiteFooter } from "../../src/components/site/SiteFooter";
import { HeroFilm } from "../../src/components/site/landing/HeroFilm";
import { Hero } from "../../src/components/site/landing/Hero";
import { Roster } from "../../src/components/site/landing/Roster";
import { ArenaGallery } from "../../src/components/site/landing/ArenaGallery";
import { FighterDossier } from "../../src/components/site/landing/FighterDossier";
import { HolderInvite } from "../../src/components/site/landing/LandingSections";
import SpecialScene from "../../src/components/site/landing/SpecialScene";
import { character, characters } from "../../src/domain/characters/definitions";
import { fighter } from "../../src/domain/combat/definitions";

it("server HTML contains ungated play links, complete readable catalogue and no battle atlases", () => {
  const html = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      createElement(Hero),
      createElement(Roster),
      createElement(ArenaGallery),
      createElement(SiteFooter),
    ),
  );
  expect(html).toContain('href="/arena"');
  expect(html).toContain('href="/start"');
  const heroActions = renderToStaticMarkup(createElement(Hero));
  expect([...heroActions.matchAll(/<a /g)]).toHaveLength(2);
  expect(heroActions).toContain(">Play now</a>");
  expect(heroActions).toContain("Watch gameplay");
  expect(heroActions).not.toContain("Find a Match");
  expect(html).toContain("SORYN");
  for (const c of characters) expect(html).toContain(`tile-name">${c.name}`);
  expect(html).toContain("Ability preview · silent");
  expect(html).toContain('href="/arena?arena=sanctuary"');
  expect(html).not.toMatch(/src="[^" ]*\/combat\/(audio|blender)\//);
  const largeImages = [
    ...html.matchAll(/src="([^" ]*\/combat\/crisp\/[^" ]+)"/g),
  ].map((m) => m[1]);
  expect(largeImages).toHaveLength(0);
  expect(html).not.toMatch(/[←-⇿▷]/);
  expect(renderToStaticMarkup(createElement(SiteFooter))).toContain("SORYN");
  const hero = renderToStaticMarkup(createElement(Hero));
  expect(hero).toContain("Turn-based creature battles.");
  expect(hero).not.toMatch(
    /gateway-(duel|stone|actor|pet|scroll)|Aegis|Ember|[←-⇿▷]/,
  );
  expect(hero).toContain("sanctuary-motion-v4-mobile.webp");
  expect(hero).toContain("sanctuary-motion-v4-desktop.webp");
});
it("each server-rendered dossier keeps actual rules and the correct authority entry", () => {
  for (const c of characters) {
    const html = renderToStaticMarkup(
      createElement(FighterDossier, { id: c.id }),
    );
    expect(html).toContain(fighter(c.id).moves.special.name);
    expect(html).toContain(
      `href="${character(c.id).access === "starter" ? "/arena" : "/character"}"`,
    );
    expect(html).toContain(
      c.access === "starter" ? "Starter" : "Holder fighter",
    );
  }
});
it("a heal preview braces while an attack strikes, without health or result fabrication", () => {
  const heal = renderToStaticMarkup(
    createElement(SpecialScene, { id: "patch", phase: "action", hit: 1 }),
  );
  expect(heal).toContain('data-pose="guard"');
  expect(heal).toContain("effect-gear");
  const strike = renderToStaticMarkup(
    createElement(SpecialScene, { id: "aegis", phase: "action", hit: 1 }),
  );
  expect(strike).toContain('data-pose="strike"');
  expect(strike).toContain("effect-shield");
  expect(strike).not.toMatch(/health|victory|damage-number/);
});

it("holder copy preserves the ownership requirement and private-record boundary", () => {
  const html = renderToStaticMarkup(createElement(HolderInvite));
  expect(html).toContain('href="/character"');
  expect(html).toContain("500 $CHOG or a Chog NFT");
  expect(html).toContain("Requires a Chog NFT");
  expect(html).toContain("publishing each result requires consent");
  expect(html).toContain("Keeper of the Echo");
  expect(html).toContain("Aegis &amp; Armadillo");
  expect(html).not.toMatch(/No wallet required|Guest play is always available/);
});

it("hero media is decorative and has no initial network source, without an opt-in animation prompt", () => {
  const html = renderToStaticMarkup(createElement(HeroFilm));
  expect(html).toContain('preload="none"');
  expect(html).not.toContain("Animate scene");
  expect(html).not.toContain("<button");
  expect(html).toContain('aria-hidden="true"');
  expect(html).not.toContain("src=");
});
