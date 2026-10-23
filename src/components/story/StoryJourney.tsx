"use client";
import { useState } from "react";
import Link from "next/link";
import type { CharacterId } from "../../domain/characters/definitions";
import { character } from "../../domain/characters/definitions";
import type { StoryState } from "../../domain/story/responses";
import {
  journeyDialogue,
  interactionSpec,
  endingMemory,
} from "../../domain/story/journey";
import { arenas } from "../../domain/combat/arenas";
import { useAccessState } from "../auth/AccessGate";
import { FighterPicker } from "../pvp/FighterPicker";
import { IdleArt } from "../combat/rendered/IdleArt";
import { companions } from "../combat/rendered/catalogue";
const ALL = [
  "pip",
  "bolt",
  "patch",
  "moss",
  "aegis",
  "nyx",
  "echo",
  "prism",
  "atlas",
  "flux",
  "ember",
  "mneme",
] as const;
export function StoryJourney({
  story,
  send,
  busy,
  error,
  official,
  saving,
}: {
  story: StoryState;
  send: (input: Record<string, unknown>) => Promise<void>;
  busy: boolean;
  error: string;
  official: boolean;
  saving: boolean;
}) {
  const journey = story.journey!;
  const access = useAccessState();
  const [selected, setSelected] = useState<CharacterId>("pip");
  const [showDialogue, setShowDialogue] = useState(false);
  const key = `${journey.stage}:${story.step}`;
  const dialogue = journeyDialogue(journey, story.step, story.route);
  const spec = interactionSpec(journey.stage, journey.vow);
  const viewed = journey.viewed.includes(key);
  const finished = story.step === "ending";
  const fighter = story.fighter ?? selected;
  const nowLocation =
    journey.stage === "intro"
      ? "intro"
      : journey.stage === "shrine"
        ? "shrine"
        : story.step === "scout"
          ? "scout"
          : story.step === "route"
            ? "crossroads"
            : story.step === "path"
              ? "path"
              : story.step === "guardian"
                ? "guardian"
                : story.step === "boss"
                  ? "boss"
                  : "ending";
  const places = [
    {
      id: "intro",
      name: "Sanctuary threshold",
      done: journey.visited.includes("intro"),
    },
    {
      id: "shrine",
      name: "Listening shrine",
      done: journey.visited.includes("shrine"),
    },
    {
      id: "scout",
      name: "First court",
      done: journey.visited.includes("scout"),
    },
    {
      id: "crossroads",
      name: "The crossroads",
      done: journey.visited.includes("crossroads"),
    },
    {
      id: "path",
      name:
        story.route === "grove"
          ? `${arenas.grove.name} · shelter path`
          : story.route === "foundry"
            ? `${arenas.foundry.name} · crossing path`
            : "Two paths ahead",
      done: journey.visited.includes("path"),
    },
    {
      id: "guardian",
      name: "The high gate",
      done: journey.visited.includes("guardian"),
    },
    {
      id: "boss",
      name:
        journey.visited.includes("guardian") || finished
          ? "Inner court"
          : "Beyond the gate",
      done: journey.visited.includes("boss"),
    },
    { id: "ending", name: "Homeward", done: finished },
  ];
  const index = places.findIndex((entry) => entry.id === nowLocation);
  async function skip() {
    await send({ operation: "dialogue" });
    setShowDialogue(false);
  }
  return (
    <section className="story-journey" aria-label="The Fractured Sanctuary">
      <header className="story-title">
        <h1>The Fractured Sanctuary</h1>
      </header>
      <nav aria-label="Journey map">
        <ol className="journey-map">
          {places.map((place, i) => (
            <li
              key={place.id}
              className={`${place.done ? "is-complete" : ""}${place.id === nowLocation ? " is-current" : ""}`}
              aria-current={place.id === nowLocation ? "step" : undefined}
            >
              <span aria-hidden="true">
                {place.done ? "✓" : String(i + 1).padStart(2, "0")}
              </span>
              <strong>{place.name}</strong>
              <small>
                {place.done
                  ? "Completed"
                  : place.id === nowLocation
                    ? "You are here"
                    : i < index
                      ? "Visited"
                      : "Locked"}
              </small>
            </li>
          ))}
        </ol>
      </nav>
      {error && (
        <p role="alert" className="story-feedback">
          {error}
        </p>
      )}
      {story.interruption && (
        <p role="status">
          The last encounter ended without a reward:{" "}
          {story.interruption.replaceAll("-", " ")}. Your checkpoint remains
          saved.
        </p>
      )}
      <fieldset
        disabled={busy || saving || story.authorized === false}
        className="journey-actions"
      >
        {!viewed || showDialogue ? (
          <section className="story-dialogue" aria-label="Dialogue">
            <div className="story-portrait">
              <IdleArt
                id={dialogue.speaker.startsWith("Bolt") ? "bolt" : "moss"}
              />
            </div>
            <div>
              <h2>{dialogue.speaker}</h2>
              {dialogue.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <button className="secondary" onClick={() => void skip()}>
                Skip dialogue
              </button>
            </div>
          </section>
        ) : (
          <button
            className="story-recall secondary"
            onClick={() => setShowDialogue(true)}
          >
            Recall dialogue
          </button>
        )}
        {journey.stage === "intro" && (
          <>
            <FighterPicker
              selected={selected}
              disabled={busy}
              holder={official}
              startersOnly={false}
              allowed={official ? [...ALL] : access?.fighters}
              onSelect={setSelected}
            />
            <button
              onClick={() =>
                void send({ operation: "choose", fighter: selected })
              }
            >
              Enter Sanctuary as {character(selected).name}
            </button>
          </>
        )}
        {journey.stage === "crossroads" && (
          <section className="story-choice" aria-label="Choose your route">
            <h2>Who needs you first?</h2>
            <p>This choice changes the path, interaction and next opponent.</p>
            <div className="story-branches">
              <button
                onClick={() =>
                  void send({ operation: "route", route: "grove" })
                }
              >
                <strong>Help the stranded companion</strong>
                <span>Search Echo Grove with Moss.</span>
              </button>
              <button
                onClick={() =>
                  void send({ operation: "route", route: "foundry" })
                }
              >
                <strong>Pursue Bolt</strong>
                <span>
                  Make a safe crossing through the Foundry of First Light.
                </span>
              </button>
            </div>
          </section>
        )}
        {journey.stage === "vow" && (
          <section
            className="story-choice"
            aria-label="Choose the seed's purpose"
          >
            <h2>What will you leave behind?</h2>
            <p>
              A living echo can open the high gate. Keeping the seed gives you a
              different way through.
            </p>
            <div className="story-branches">
              <button
                onClick={() =>
                  void send({ operation: "vow", choice: "restore" })
                }
              >
                <strong>Restore the listening shrine</strong>
                <span>Reconnect it to the gate.</span>
              </button>
              <button
                onClick={() =>
                  void send({ operation: "vow", choice: "preserve" })
                }
              >
                <strong>Keep the seed&apos;s light</strong>
                <span>Carry a light to the silent gate.</span>
              </button>
            </div>
          </section>
        )}
        {spec && (
          <section className="story-interaction" aria-label={spec.title}>
            <div className="story-companion">
              <IdleArt id={fighter} companion />
              <span>{companions[fighter]}</span>
            </div>
            <div>
              <h2>{spec.title}</h2>
              <p>{spec.prompt}</p>
              <div className="story-inspections">
                {spec.inspections.map((option) => (
                  <button
                    className="secondary"
                    key={option.id}
                    aria-pressed={journey.clues.includes(option.id)}
                    onClick={() =>
                      void send({ operation: "interact", action: option.id })
                    }
                  >
                    {journey.clues.includes(option.id) ? "✓ " : ""}
                    {option.label}
                  </button>
                ))}
              </div>
              <p role="status" className="story-feedback">
                {journey.feedback || "Investigate, then choose a way forward."}
              </p>
              <div className="story-solutions">
                {spec.answers.map((option) => (
                  <button
                    key={option.id}
                    disabled={
                      !spec.inspections.every((clue) =>
                        journey.clues.includes(clue.id),
                      )
                    }
                    onClick={() =>
                      void send({ operation: "interact", action: option.id })
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {journey.stage === "side" && (
                <button
                  className="secondary"
                  onClick={() => void send({ operation: "leave-side" })}
                >
                  Return to the ending
                </button>
              )}
            </div>
          </section>
        )}
        {journey.stage === "battle" && story.encounter && (
          <section className="story-encounter" aria-label="Combat encounter">
            <p className="eyebrow">
              Combat · {arenas[story.encounter.arena].name}
            </p>
            <h2>
              {story.lost
                ? "A second chance"
                : `${character(story.encounter.opponent).name} holds the court`}
            </h2>
            <p>{story.encounter.objective}</p>
            {story.lost && (
              <p>
                Your route and decisions remain saved. Retry this encounter with
                a fresh battle.
              </p>
            )}
            <button onClick={() => void send({ operation: "begin" })}>
              {saving
                ? "Saving encounter…"
                : story.battleId
                  ? "Resume battle"
                  : story.lost
                    ? "Retry battle"
                    : "Start battle"}
            </button>
          </section>
        )}
        {journey.stage === "ending" && (
          <section className="story-ending" aria-label="Chapter ending">
            <p className="eyebrow">Chapter complete</p>
            <h2>The sanctuary remembers</h2>
            <p>{endingMemory(story.route, journey.vow)}</p>
            <ul>
              <li>
                {story.route === "grove"
                  ? "Shelter path and stranded companion"
                  : "Foundry crossing and rival's trust"}
              </li>
              <li>
                {journey.vow === "restore"
                  ? "Living shrine restored · gate opened by echo"
                  : "Seed carried · its light spent at the gate"}
              </li>
              <li>
                {journey.sideComplete
                  ? "The quiet bell has a voice"
                  : "The optional echo nook is still waiting"}
              </li>
            </ul>
            <h3>Earned titles</h3>
            <ul>
              {story.rewards?.map((reward) => (
                <li key={reward.key}>
                  {reward.title}
                  <small>
                    {" "}
                    · earned accomplishment, not proof of current holdings
                  </small>
                </li>
              ))}
            </ul>
            <div className="button-row">
              {!journey.sideComplete && (
                <button onClick={() => void send({ operation: "side" })}>
                  Visit the echo nook · optional
                </button>
              )}
              <button
                className="secondary"
                onClick={() => void send({ operation: "replay" })}
              >
                Replay chapter
              </button>
              <Link href="/start">Back to modes</Link>
            </div>
            <p>
              Next time, try the {story.route === "grove" ? "foundry" : "grove"}{" "}
              route and a different choice for the seed. Your completed runs
              stay saved.
            </p>
          </section>
        )}
      </fieldset>
      {!!story.runs?.length && (
        <details className="story-run-history">
          <summary>Completed journeys · {story.runs.length}</summary>
          <ul>
            {story.runs.map((run) => (
              <li key={run.runId}>
                {run.route === "grove" ? "Shelter path" : "Foundry crossing"} ·{" "}
                {run.vow === "restore" ? "Restored shrine" : "Carried light"}
                {run.sideComplete ? " · Echo nook complete" : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
