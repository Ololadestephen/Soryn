"use client";

import { character } from "../domain/characters/definitions";
import { Portrait } from "./characters/Portrait";
import Link from "next/link";
import type { useGuestGame } from "./guest/useGuestGame";
import { Replay } from "./adventure/Replay";
import { RaceReplay } from "./adventure/RaceReplay";

type Props = Pick<
  ReturnType<typeof useGuestGame>,
  | "museum"
  | "busy"
  | "start"
  | "openReplay"
  | "publicReplay"
  | "setPublicReplay"
>;

export function Museum({
  museum,
  busy,
  start,
  openReplay,
  publicReplay,
  setPublicReplay,
}: Props) {
  return (
    <section id="museum" className="museum">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Bad decisions. Excellent exhibits.</p>
          <h2>The museum</h2>
        </div>
        <span className="small-label">
          Consented failures · local installation
        </span>
      </div>
      {museum.length === 0 ? (
        <div className="empty-museum">
          <span aria-hidden="true">↺</span>
          <h3>No disasters on display. Yet.</h3>
          <p>
            Complete a failed run and choose to publish it.
            <br />
            Someone else can play the same frozen scenario and try doing better.
          </p>
          <Link className="action-link" href="/play">
            Play a guest adventure
          </Link>
        </div>
      ) : (
        <div className="exhibit-grid">
          {museum.map((exhibit, index) => (
            <article className="exhibit" key={exhibit.id}>
              <p className="eyebrow">
                {exhibit.identity
                  ? `Official token ${exhibit.identity.tokenId}`
                  : "Guest"}{" "}
                exhibit {String(index + 1).padStart(3, "0")}
              </p>
              <span className="exhibit-icon" aria-hidden="true">
                {exhibit.title.includes("Door") ? "▥" : "↺"}
              </span>
              {exhibit.loadout && (
                <div className="exhibit-loadout">
                  <Portrait id={exhibit.loadout.characterId} />
                  <p>
                    {character(exhibit.loadout.characterId).name} /{" "}
                    {character(exhibit.loadout.characterId).role} ·{" "}
                    {exhibit.loadout.charges} signature charge(s)
                    <br />
                    <small>Challenge uses this exact frozen loadout.</small>
                  </p>
                </div>
              )}
              <h3>{exhibit.title}</h3>
              <p>
                By {exhibit.alias} · {exhibit.outcome}
                <br />
                {exhibit.turnsUsed} turns used in the original run.
              </p>
              <div className="button-row">
                <button disabled={busy} onClick={() => start(exhibit.id)}>
                  Challenge
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => void openReplay(exhibit.id)}
                >
                  View replay
                </button>
              </div>
              <a href={`/play?challenge=${exhibit.id}`}>Challenge link</a>
            </article>
          ))}
        </div>
      )}
      {publicReplay && (
        <div className="panel">
          <div className="section-heading">
            <h3>Exhibit replay: {publicReplay.exhibit.title}</h3>
            <button className="secondary" onClick={() => setPublicReplay(null)}>
              Close replay
            </button>
          </div>
          <p className="muted">
            Viewing this solution marks subsequent attempts as informed retries
            for this guest session.
          </p>
          <RaceReplay
            key={publicReplay.exhibit.id}
            player={publicReplay.frames}
            ghost={publicReplay.ghost.frames}
            reasons={publicReplay.ghost.reasons}
            playerLabel="Original recorded failure"
            ghostLabel="Exhibit strategy ghost"
          />
          <details>
            <summary>Original actions only</summary>
            <Replay
              key={publicReplay.exhibit.id}
              frames={publicReplay.frames}
            />
          </details>
        </div>
      )}
    </section>
  );
}
