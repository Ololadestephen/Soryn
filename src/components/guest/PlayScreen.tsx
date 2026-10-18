"use client";

import { useEffect, useRef } from "react";
import { CharacterSelection } from "../characters/Selection";
import { Adventure } from "../adventure/Adventure";
import { ArchivedNotice } from "../site/ArchivedNotice";
import { useGuestSession } from "./GuestProvider";

export function PlayScreen({ challenge }: { challenge: string | null }) {
  const game = useGuestSession();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!challenge) {
      handled.current = null;
      return;
    }
    if (game.busy || game.error || handled.current === challenge) return;
    handled.current = challenge;
    if (game.run?.exhibitId !== challenge) game.start(challenge);
  }, [challenge, game]);
  return (
    <>
      <ArchivedNotice />
      {!challenge && (!game.run || game.run.observation.outcome) && (
        <CharacterSelection
          selected={game.selectedCharacter}
          onSelect={game.setSelectedCharacter}
          disabled={game.busy}
        />
      )}
      <Adventure {...game} />
    </>
  );
}
