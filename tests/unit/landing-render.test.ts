import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { SiteFooter } from "../../src/components/site/SiteFooter";
import { HeroFilm } from "../../src/components/site/landing/HeroFilm";
import { Hero } from "../../src/components/site/landing/Hero";
import { Roster } from "../../src/components/site/landing/Roster";
import { ArenaGallery } from "../../src/components/site/landing/ArenaGallery";
import { FighterDossier } from "../../src/components/site/landing/FighterDossier";
import {
  HolderInvite,
  Closing,
  SecondaryExperiences,
} from "../../src/components/site/landing/LandingSections";
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
  expect(html).toContain("Play now");
  expect(html).toContain("Déjà Vu");
  for (const c of characters) expect(html).toContain(`tile-name">${c.name}`);
  expect(html).toContain("Ability preview · silent");
  expect(html).toContain('href="/arena?arena=sanctuary"');
  expect(html).not.toMatch(/src="[^" ]*\/combat\/(audio|blender)\//);
  const largeImages = [
    ...html.matchAll(/src="([^" ]*\/combat\/crisp\/[^" ]+)"/g),
  ].map((m) => m[1]);
  expect(largeImages).toHaveLength(0);
  expect(html).not.toMatch(/[←-⇿▷]/);
  expect(renderToStaticMarkup(createElement(SiteFooter))).toContain(
    "/brand/wordmark.svg",
  );
  const hero = renderToStaticMarkup(createElement(Hero));
  expect(hero).toContain("Turn-based creature battles.");
  expect(hero).not.toMatch(
    /gateway-(duel|stone|actor|pet|scroll)|Aegis|Ember|[←-⇿▷]/,
  );
  expect(hero).toContain("sanctuary-portrait.webp");
  expect(hero).toContain("sanctuary-desktop.webp");
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
      c.access === "starter" ? "no wallet required" : "verified Chog required",
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

it("the static narrative preserves private records, real routes and immediate closing play", () => {
  const html = renderToStaticMarkup(
    createElement(
      Fragment,
      null,

      createElement(HolderInvite),
      createElement(SecondaryExperiences),
      createElement(Closing),
    ),
  );
  for (const route of ["/arena", "/character", "/challenge", "/archive"])
    expect(html).toContain(`href="${route}"`);
  expect(html).toContain("Private records stay");
  expect(html).toContain("private");
  expect(html).toContain("Your first battle");
  expect(html).toContain("one move away.");
  expect(html).not.toContain("one arena");
  expect(html).toContain("no public matchmaking");
  expect(html).not.toContain("Play as guest");
});

it("hero media is decorative and has no initial network source, without an opt-in animation prompt", () => {
  const html = renderToStaticMarkup(createElement(HeroFilm));
  expect(html).toContain('preload="none"');
  expect(html).not.toContain("Animate scene");
  expect(html).not.toContain("<button");
  expect(html).toContain('aria-hidden="true"');
  expect(html).not.toContain("src=");
});
