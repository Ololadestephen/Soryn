import { loadoutKey, type Loadout } from "./characters/definitions";
import type { Outcome } from "./game/contracts";
import type { RunView, SessionView } from "./views";
import { compareResults } from "./exhibits/comparison";

export interface JournalChapter {
  id: string;
  outcome: Outcome;
  turnsUsed: number;
  alarm: number;
  cohort: RunView["cohort"];
  ghostVersion: string | null;
  loadout?: Loadout;
  trainingRuns: number;
  challenge: { id: string; title: string; available: boolean } | null;
  comparison: RunView["comparison"];
}
export interface ChallengeProgress {
  challenge: NonNullable<JournalChapter["challenge"]>;
  cohorts: {
    cohort: RunView["cohort"];
    attempts: number;
    first: JournalChapter;
    best: JournalChapter;
    improvement: ReturnType<typeof compareResults>;
  }[];
}
export interface GuestJournalView {
  chapters: JournalChapter[];
  challenges: ChallengeProgress[];
}
export interface GuestSessionView extends SessionView {
  journal: GuestJournalView;
}

const score = (chapter: JournalChapter) => ({
  outcome: chapter.outcome,
  turns: 10 - chapter.turnsUsed,
  alarm: chapter.alarm,
});

/** Input is newest first. Comparisons stay inside one exhibit and exposure cohort. */
export function challengeProgress(
  chapters: readonly JournalChapter[],
): ChallengeProgress[] {
  const groups = new Map<string, ChallengeProgress>();
  for (const chapter of [...chapters].reverse()) {
    if (!chapter.challenge) continue;
    const key = `${chapter.challenge.id}:${loadoutKey(chapter.loadout)}`;
    let group = groups.get(key);
    if (!group) {
      group = { challenge: chapter.challenge, cohorts: [] };
      groups.set(key, group);
    }
    let cohort = group.cohorts.find((entry) => entry.cohort === chapter.cohort);
    if (!cohort) {
      cohort = {
        cohort: chapter.cohort,
        attempts: 0,
        first: chapter,
        best: chapter,
        improvement: "tied",
      };
      group.cohorts.push(cohort);
    }
    cohort.attempts++;
    if (compareResults(score(chapter), score(cohort.best)) === "better")
      cohort.best = chapter;
    cohort.improvement = compareResults(
      score(cohort.best),
      score(cohort.first),
    );
  }
  return [...groups.values()].reverse();
}
