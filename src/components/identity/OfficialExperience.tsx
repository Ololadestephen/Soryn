"use client";
import { CharacterSelection } from "../characters/Selection";
import { IdentityIntro } from "./IdentityIntro";
import { WalletSignIn } from "./WalletSignIn";
import { useOfficialGame } from "./useOfficialGame";
import { Adventure } from "../adventure/Adventure";
import { OfficialPublication } from "./OfficialPublication";
import { PublicChapters, PublicChapterLookup } from "./PublicChapters";
import { OfficialCombat } from "../combat/Official";
import { TokenPicker } from "./TokenPicker";

export function OfficialExperience({
  onMuseumChanged,
}: {
  onMuseumChanged: () => Promise<void>;
}) {
  const game = useOfficialGame(onMuseumChanged);
  return (
    <section
      id="character"
      className="official-identity"
      aria-labelledby="identity-title"
    >
      <div className="identity">
        <IdentityIntro />
        <WalletSignIn game={game} />
      </div>
      {game.account?.grant && (
        <>
          <OfficialCombat
            key={`${game.account.wallet}:${game.account.identity.tokenId}`}
          />
          <TokenPicker
            key={`tokens:${game.account.wallet}:${game.account.identity.tokenId}`}
            onChangeToken={() => void game.changeToken()}
          />
          <details className="combat-history">
            <summary>Official sandwich adventures and ghost chapters</summary>
            {(!game.run || game.run.observation.outcome) && (
              <CharacterSelection
                holder
                selected={game.selectedCharacter}
                onSelect={game.setSelectedCharacter}
                disabled={game.busy}
              />
            )}
            <Adventure
              official
              run={game.run}
              busy={game.busy}
              error=""
              pending={game.pending}
              mutate={game.mutate}
              start={game.start}
            />
            {game.error && game.pending && (
              <button
                disabled={game.busy}
                onClick={() => {
                  if (game.pending) void game.mutate(game.pending);
                }}
              >
                Retry official request
              </button>
            )}
            <OfficialPublication key={game.run?.id ?? "empty"} game={game} />
          </details>
        </>
      )}
      {game.account && (
        <PublicChapters
          tokenId={game.account.identity.tokenId}
          chapters={game.chapters}
        />
      )}
      {!!game.withdrawals.length && (
        <div className="panel">
          <h3>Your publication consent</h3>
          <p>
            You can withdraw your own published chapters after transfer. This
            removes public access; it does not authorize new token history.
          </p>
          {game.withdrawals.map((chapter) => (
            <p key={chapter.runId}>
              Token {chapter.identity.tokenId}: {chapter.title}{" "}
              <button
                className="secondary"
                disabled={game.busy}
                onClick={() =>
                  void game.mutate({ operation: "withdraw", id: chapter.runId })
                }
              >
                Withdraw this consent
              </button>
            </p>
          ))}
        </div>
      )}
      {!game.account && <PublicChapterLookup />}
    </section>
  );
}
