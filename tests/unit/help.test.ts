import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import HelpPage from "../../src/app/help/page";
import { helpSections } from "../../src/app/help/content";
import { CHAIN_ID, COLLECTION } from "../../src/domain/identity";
import {
  CHOG_MINIMUM,
  STARTERS,
  TOKEN_UNLOCKS,
} from "../../src/domain/access/policy";
import { character } from "../../src/domain/characters/definitions";

it("keeps public access guidance consistent with the actual policy and collection", () => {
  const answers = helpSections
    .flatMap((s) => s.questions.map((q) => q.answer))
    .join(" ");
  const threshold = Number(CHOG_MINIMUM / 10n ** 18n);
  expect(answers).toContain(`at least ${threshold} $CHOG`);
  expect(answers).toContain(`chain ID ${CHAIN_ID}`);
  expect(answers).toContain(COLLECTION);
  for (const id of [...STARTERS, ...TOKEN_UNLOCKS])
    expect(answers).toContain(character(id).name);
  // Holdings qualify access; the guide must also preserve service and privacy limits.
  expect(answers).toContain("checked, not spent");
  expect(answers).toContain("does not override a paused service");
  expect(answers).toContain(
    "Private drafts, wallet/account identifiers, sessions and keeper-private progress do not transfer",
  );
});

it("serves complete help without client data and gives every topic a valid unique target", () => {
  const html = renderToStaticMarkup(createElement(HelpPage));
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  expect(new Set(ids).size).toBe(ids.length);
  for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g))
    expect(ids).toContain(anchor);
  const questions = helpSections.flatMap((s) => s.questions);
  expect(new Set(questions.map((q) => q.question)).size).toBe(questions.length);
  for (const { question, answer } of questions) {
    expect(answer.trim().length).toBeGreaterThan(0);
    expect(html).toContain(
      renderToStaticMarkup(createElement("summary", null, question)),
    );
    expect(html).toContain(
      renderToStaticMarkup(createElement("p", null, answer)),
    );
  }
  expect(html).toContain('href="/history?as=holder"');
  expect(html).toContain('href="/archive"');
});
