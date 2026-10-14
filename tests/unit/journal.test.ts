import { describe, expect, it } from "vitest";
import {
  challengeProgress,
  type JournalChapter,
} from "../../src/domain/journal";

const challenge = { id: "exhibit-a", title: "Painted", available: true };
function chapter(
  id: string,
  cohort: JournalChapter["cohort"],
  outcome: JournalChapter["outcome"],
  turnsUsed: number,
  alarm = 0,
): JournalChapter {
  return {
    id,
    cohort,
    outcome,
    turnsUsed,
    alarm,
    challenge,
    ghostVersion: null,
    trainingRuns: 0,
    comparison: null,
  };
}
describe("private challenge progress", () => {
  it("never merges first-recorded results with informed improvements", () => {
    const first = chapter("first", "first-recorded", "trapped", 1);
    const informed = chapter("informed", "informed-retry", "trapped", 1);
    const win = chapter("win", "informed-retry", "escaped", 6);
    const progress = challengeProgress([win, informed, first]);
    expect(progress[0].cohorts).toEqual([
      {
        cohort: "first-recorded",
        attempts: 1,
        first,
        best: first,
        improvement: "tied",
      },
      {
        cohort: "informed-retry",
        attempts: 2,
        first: informed,
        best: win,
        improvement: "better",
      },
    ]);
  });
  it("uses goal, then turns, then alarm and preserves the earlier best on ties", () => {
    const empty = chapter("empty", "informed-retry", "empty-handed", 1);
    const slow = chapter("slow", "informed-retry", "escaped", 6);
    const fast = chapter("fast", "informed-retry", "escaped", 5, 2);
    const quiet = chapter("quiet", "informed-retry", "escaped", 5);
    const tied = chapter("tied", "informed-retry", "escaped", 5);
    const snapshot = structuredClone([tied, quiet, fast, slow, empty]);
    const cohort = challengeProgress(snapshot)[0].cohorts[0];
    expect(cohort.first.id).toBe("empty");
    expect(cohort.best.id).toBe("quiet");
    expect(cohort.attempts).toBe(5);
    expect(snapshot).toEqual([tied, quiet, fast, slow, empty]);
  });
  it("separates exhibits and omits personal practice", () => {
    const a = chapter("a", "informed-retry", "trapped", 1);
    const b = {
      ...chapter("b", "first-recorded", "escaped", 6),
      challenge: { ...challenge, id: "exhibit-b" },
    };
    const personal = { ...b, id: "personal", challenge: null };
    expect(
      challengeProgress([personal, b, a]).map((group) => group.challenge.id),
    ).toEqual(["exhibit-b", "exhibit-a"]);
    expect(challengeProgress([])).toEqual([]);
  });
});
