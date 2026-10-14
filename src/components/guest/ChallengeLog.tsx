import type { ChallengeProgress } from "../../domain/journal";

const resultText = { better: "ahead of", tied: "tied with", behind: "behind" };

export function ChallengeLog({
  challenges,
  busy,
  start,
}: {
  challenges: ChallengeProgress[];
  busy: boolean;
  start: (exhibitId: string | null, retryOf: string | null) => void;
}) {
  return (
    <section className="challenge-log" aria-label="Guest challenge progress">
      <h3>Your museum rematches</h3>
      <p className="muted">
        Progress is personal to this cookie, within the recent saved chapters
        shown. First recorded attempts and informed retries are compared
        separately.
      </p>
      {challenges.length === 0 ? (
        <p>Challenge a published failure to start your rematch log.</p>
      ) : (
        challenges.map(({ challenge, cohorts }) => (
          <article className="challenge-entry" key={challenge.id}>
            <div className="section-heading">
              <h4>{challenge.title}</h4>
              {challenge.available ? (
                <button
                  disabled={busy}
                  onClick={() =>
                    start(challenge.id, cohorts[cohorts.length - 1].best.id)
                  }
                >
                  Rematch challenge
                </button>
              ) : (
                <span className="muted">Unavailable for rematch</span>
              )}
            </div>
            <div className="cohort-progress">
              {cohorts.map(({ cohort, attempts, first, best, improvement }) => (
                <div className="cohort-entry" key={cohort}>
                  <h5>
                    {cohort === "first-recorded"
                      ? "First recorded attempts"
                      : "Informed retries"}
                  </h5>
                  <p>
                    {attempts} saved {attempts === 1 ? "attempt" : "attempts"} ·{" "}
                    {improvement === "better"
                      ? "Improved within this cohort"
                      : "Best result unchanged within this cohort"}
                  </p>
                  <p>
                    First shown: {first.outcome} · {first.turnsUsed}{" "}
                    {first.turnsUsed === 1 ? "turn" : "turns"} · {first.alarm}{" "}
                    alarm.
                    <br />
                    Best shown: {best.outcome} · {best.turnsUsed}{" "}
                    {best.turnsUsed === 1 ? "turn" : "turns"} · {best.alarm}{" "}
                    alarm.
                  </p>
                  {best.comparison && (
                    <p className="comparison">
                      Best shown finished {resultText[best.comparison.original]}{" "}
                      the original and {resultText[best.comparison.ghost]} the
                      exhibit ghost.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </article>
        ))
      )}
    </section>
  );
}
