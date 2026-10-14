"use client";
import { useState } from "react";
import type { useOfficialGame } from "./useOfficialGame";

export function OfficialPublication({
  game,
}: {
  game: ReturnType<typeof useOfficialGame>;
}) {
  const [title, setTitle] = useState("The Sandwich Chapter");
  const [alias, setAlias] = useState("Anonymous keeper");
  const [museum, setMuseum] = useState(false);
  const run = game.run;
  if (!run?.observation.outcome) return null;
  return (
    <div className="panel official-publication">
      <p className="eyebrow">Your official chapter · private until consent</p>
      <h3>
        {game.publication
          ? "Part of this Chog’s public history."
          : "Let the next keeper read this chapter."}
      </h3>
      {game.publication ? (
        <>
          <p>
            Published as “{game.publication.title}”, by {game.publication.alias}
            . Its public ghost remains frozen.
          </p>
          {run.publication && (
            <a
              className="share-link"
              href={`/play?challenge=${run.publication.id}`}
            >
              Open museum challenge
            </a>
          )}
          <button
            className="secondary"
            disabled={game.busy}
            onClick={() =>
              void game.mutate({ operation: "withdraw", id: run.id })
            }
          >
            Withdraw public chapter
          </button>
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void game.mutate({
              operation: "publish",
              id: run.id,
              title,
              alias,
              consent: true,
              museum,
            });
          }}
        >
          <div className="fields">
            <label>
              Chapter title
              <input
                name="chapter-title"
                value={title}
                required
                minLength={1}
                maxLength={72}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              Keeper’s public alias
              <input
                name="keeper-alias"
                value={alias}
                required
                minLength={1}
                maxLength={32}
                onChange={(event) => setAlias(event.target.value)}
              />
            </label>
          </div>
          {run.observation.outcome !== "escaped" && (
            <label className="consent">
              <input
                type="checkbox"
                checked={museum}
                onChange={(event) => setMuseum(event.target.checked)}
              />
              Also make this failure a playable museum challenge.
            </label>
          )}
          <label className="consent">
            <input name="chapter-consent" type="checkbox" required />I consent
            to publishing these actions, outcome, alias and the ghost derived
            from this chapter alone. Public history follows token{" "}
            {run.identity?.tokenId} across keepers.
          </label>
          <p className="muted">
            Other drafts, wallet addresses, session identifiers and private
            ghost training stay private. This does not modify the NFT’s
            metadata. The original author retains consent withdrawal; a new
            keeper cannot edit their attribution.
          </p>
          <button disabled={game.busy}>Publish official chapter</button>
        </form>
      )}
    </div>
  );
}
