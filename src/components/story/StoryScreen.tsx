"use client";
import {
  storyStateSchema,
  type StoryState,
} from "../../domain/story/responses";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { character } from "../../domain/characters/definitions";
import { STORY_COPY, STORY_STARTERS } from "../../domain/story/sanctuary";
import { arenas } from "../../domain/combat/arenas";
import { BattleStage } from "../combat/BattleStage";
import { useCombat } from "../combat/useCombat";
import { request } from "../request";
import { usePlayIdentity } from "../auth/PlayIdentity";
import Link from "next/link";
import { StoryJourney } from "./StoryJourney";

const LINES: Record<StoryState["step"], readonly string[]> = {
  meet: STORY_COPY.meet,
  scout: STORY_COPY.scout,
  route: STORY_COPY.route,
  path: [],
  guardian: STORY_COPY.guardian,
  boss: STORY_COPY.boss,
  ending: [],
};

export function StoryScreen() {
  const identity = usePlayIdentity();
  const combat = useCombat(
    identity.mode,
    identity.headers,
    identity.mode === "official",
  );
  const getHeaders = useEffectEvent(() => identity.headers());
  const [story, setStory] = useState<StoryState | null>(null);
  const [error, setError] = useState("");
  const [skipped, setSkipped] = useState(false);
  const [storyBusy, setStoryBusy] = useState(false);
  const sending = useRef(false);
  const resolved = useRef("");
  useEffect(() => {
    let stop = false;
    void (async () =>
      request(
        "/api/story?mode=" + identity.mode,
        storyStateSchema.parse,
        undefined,
        undefined,
        await getHeaders(),
      ))()
      .then((next) => {
        if (!stop) setStory(next);
      })
      .catch((problem: unknown) => {
        if (!stop)
          setError(
            problem instanceof Error ? problem.message : "Story unavailable.",
          );
      });
    return () => {
      stop = true;
    };
  }, [identity.mode]);
  const battle = combat.battle;
  const matchingBattle =
    story?.battleId && battle?.id === story.battleId ? battle : null;
  const completedBattle = matchingBattle?.state.outcome ? matchingBattle : null;
  const playingResolution = combat.busy || !!combat.presentation;
  const readyToResolve = !!completedBattle && !playingResolution;
  const fighting =
    !!matchingBattle &&
    (!completedBattle || playingResolution) &&
    story?.step !== "ending";
  const encounterLabel = completedBattle
    ? "Saving chapter…"
    : story?.battleId
      ? "Resume battle"
      : story?.lost
        ? "Retry battle"
        : "Start battle";
  useEffect(() => {
    if (
      !readyToResolve ||
      !completedBattle ||
      resolved.current === completedBattle.id
    )
      return;
    const battle = completedBattle;
    resolved.current = battle.id;
    void (async () =>
      request(
        "/api/story",
        storyStateSchema.parse,
        {
          operation: "resolve",
          mode: identity.mode,
          battleId: battle.id,
        },
        undefined,
        await getHeaders(),
      ))()
      .then((next) => setStory(next))
      .catch((problem: unknown) => {
        resolved.current = "";
        setError(
          problem instanceof Error
            ? problem.message
            : "Could not save the chapter.",
        );
      });
  }, [completedBattle, readyToResolve, identity.mode]);
  async function send(input: Record<string, unknown>) {
    if (sending.current) return;
    sending.current = true;
    setStoryBusy(true);
    setError("");
    try {
      const next = await request(
        "/api/story",
        storyStateSchema.parse,
        { ...input, mode: identity.mode },
        undefined,
        await identity.headers(),
      );
      setSkipped(false);
      setStory(next);
      if (input.operation === "begin" && next.battleId)
        await combat.reload(next.battleId);
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : "Story unavailable.",
      );
    } finally {
      sending.current = false;
      setStoryBusy(false);
    }
  }
  if (fighting && battle)
    return (
      <BattleStage
        key={battle.id}
        battle={battle}
        mode={identity.mode}
        busy={combat.busy}
        presentation={combat.presentation}
        step={combat.step}
        error={combat.error}
        pending={!!combat.pending}
        retry={combat.retry}
        recover={() => combat.reload(battle.id)}
        exit={() =>
          identity.mode === "official"
            ? void send({ operation: "cancel" })
            : void combat.reload(battle.id)
        }
        rematch={() => void send({ operation: "begin" })}
      />
    );
  if (story?.journey)
    return (
      <StoryJourney
        story={story}
        send={send}
        busy={storyBusy}
        error={error || combat.error}
        official={identity.mode === "official"}
        saving={!!completedBattle}
      />
    );
  const lines = story ? LINES[story.step] : [];
  const ending =
    story?.step === "ending"
      ? story.route === "foundry"
        ? STORY_COPY.ending.foundry
        : STORY_COPY.ending.grove
      : null;
  return (
    <section className="combat-screen" aria-label="Story chapter">
      <p className="eyebrow">{STORY_COPY.fiction}</p>
      <h1>{STORY_COPY.title}</h1>
      <p className="muted">
        {identity.mode === "official"
          ? "Official Chog Story · token " +
            (story?.tokenId ?? "verification pending")
          : "Guest Story · four starters · private guest progress"}
      </p>
      {story?.interruption && (
        <p role="status">
          This encounter ended without a completion:{" "}
          {story.interruption.replaceAll("-", " ")}. Saved checkpoints remain
          private to their keeper.
        </p>
      )}
      <p>{STORY_COPY.premise}</p>
      {error && <p role="alert">{error}</p>}
      {combat.error && <p role="alert">{combat.error}</p>}
      {identity.mode === "official" && (
        <p>
          <Link href="/character">Verify or change your Chog</Link>
        </p>
      )}
      <fieldset
        disabled={
          story?.authorized === false || combat.authorized === false || !story
        }
        className="story-actions"
      >
        {error && completedBattle && (
          <button
            onClick={() =>
              void send({ operation: "resolve", battleId: completedBattle.id })
            }
          >
            Retry saving chapter
          </button>
        )}
        {story?.lost && <p role="status">{STORY_COPY.loss}</p>}
        {!skipped && lines.map((line) => <p key={line}>{line}</p>)}
        {lines.length > 0 && !skipped && (
          <button onClick={() => setSkipped(true)}>Skip dialogue</button>
        )}
        {story?.step === "meet" && (
          <div className="button-row">
            {STORY_STARTERS.map((id) => (
              <button
                key={id}
                onClick={() => void send({ operation: "choose", fighter: id })}
              >
                {character(id).name}
              </button>
            ))}
          </div>
        )}
        {story?.encounter && story.step !== "ending" && (
          <>
            <p>
              {character(story.encounter.opponent).name} ·{" "}
              {story.encounter.difficulty} ·{" "}
              {arenas[story.encounter.arena].name}
            </p>
            <p>{story.encounter.objective}</p>
            <button
              disabled={combat.busy || !!completedBattle}
              onClick={() => void send({ operation: "begin" })}
            >
              {encounterLabel}
            </button>
          </>
        )}
        {story?.step === "route" && (
          <div className="button-row">
            <button
              onClick={() => void send({ operation: "route", route: "grove" })}
            >
              Take the grove
            </button>
            <button
              onClick={() =>
                void send({ operation: "route", route: "foundry" })
              }
            >
              Take the foundry
            </button>
          </div>
        )}
        {ending && (
          <>
            <p>{ending}</p>
            <p>
              Chapter complete. This does not change Practice or public battle
              stats.
            </p>
            {story?.completed && (
              <button onClick={() => void send({ operation: "replay" })}>
                Replay chapter
              </button>
            )}
            {story?.completed && <p>{STORY_COPY.replay}</p>}
          </>
        )}
      </fieldset>
    </section>
  );
}
