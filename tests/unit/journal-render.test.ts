import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Journal } from "../../src/components/guest/Journal";
import { ChallengeLog } from "../../src/components/guest/ChallengeLog";
import { ChapterReview } from "../../src/components/guest/ChapterReview";
import { scenarioFor } from "../../src/domain/game/contracts";
import { observe, replay } from "../../src/domain/game/engine";
import type { RunView } from "../../src/domain/views";
import { deriveProfile, raceGhost } from "../../src/domain/ghosts/policy";
import {
  challengeProgress,
  type JournalChapter,
} from "../../src/domain/journal";

const scenario = scenarioFor(0);
const frames = replay(scenario, ["door"]).map(observe);
const profile = deriveProfile([{ scenario, actions: ["door"] }]);
const run: RunView = {
  id: "saved",
  mode: "guest",
  exhibitId: null,
  step: 1,
  cohort: "first-recorded",
  observation: frames[1],
  replay: { scenario, actions: ["door"], frames },
  ghost: {
    version: "a".repeat(64),
    profile,
    race: raceGhost(profile, scenario),
  },
  rival: null,
  comparison: null,
  publication: null,
};
const saved: JournalChapter = {
  id: run.id,
  outcome: "trapped",
  turnsUsed: 1,
  alarm: 0,
  cohort: "first-recorded",
  ghostVersion: run.ghost?.version ?? null,
  trainingRuns: 1,
  challenge: {
    id: "exhibit",
    title: "<script>not an element</script>",
    available: false,
  },
  comparison: null,
};
describe("journal presentation boundaries", () => {
  it("allows inspection but blocks rematches while the active adventure is unfinished", () => {
    const html = renderToStaticMarkup(
      createElement(Journal, {
        run: { ...run, observation: frames[0], ghost: null, replay: null },
        journal: { chapters: [saved], challenges: challengeProgress([saved]) },
        chapter: null,
        busy: false,
        chapterError: "",
        retryChapter: () => {},
        openChapter: async () => {},
        setChapter: () => {},
        raceChapter: () => {},
        start: () => {},
      }),
    );
    expect(html).toContain("Finish it before starting a rematch");
    expect(html).toContain('disabled="">Race this ghost');
    expect(html).not.toContain('disabled="">Open chapter');
    expect(html).toContain("Unavailable for rematch");
    expect(html).not.toContain("<script>");
  });
  it("renders separate cohorts and never offers a withdrawn exhibit as a rematch", () => {
    const html = renderToStaticMarkup(
      createElement(ChallengeLog, {
        challenges: challengeProgress([
          { ...saved, id: "informed", cohort: "informed-retry" },
          saved,
        ]),
        busy: false,
        start: () => {},
      }),
    );
    expect(html).toContain("First recorded attempts");
    expect(html).toContain("Informed retries");
    expect(html).not.toContain(">Rematch challenge</button>");
    expect(html).not.toContain("ahead of the original");
  });
  it("labels a historical ghost as created after its chapter, separate from a race opponent", () => {
    const html = renderToStaticMarkup(
      createElement(ChapterReview, {
        chapter: run,
        busy: false,
        race: () => {},
        close: () => {},
      }),
    );
    expect(html).toContain("Created after this chapter");
    expect(html).toContain("informed personal practice race");
    expect(html).toContain("Close chapter");
    expect(html).not.toContain("Revisit the frozen opponent race");
  });
});
