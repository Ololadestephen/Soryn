"use client";
import { usePlayIdentity } from "../auth/PlayIdentity";
import { useAccessState } from "../auth/AccessGate";
import { useState } from "react";
import Link from "next/link";
import { useCombat } from "./useCombat";
import { FighterSelection } from "./Selection";
import { BattleStage } from "./BattleStage";
import { BattleHistory } from "./BattleHistory";
import { ModalPanel } from "./ModalPanel";
import { arenas, type ArenaId } from "../../domain/combat/arenas";

export function CombatScreen({
  mode = "guest",
  headers,
  suggestedArena,
}: {
  mode?: "guest" | "official";
  headers?: () => Promise<Record<string, string>>;
  suggestedArena?: ArenaId;
}) {
  const identity = usePlayIdentity();
  const access = useAccessState();
  const game = useCombat(mode, headers ?? identity.headers);
  const [choosing, setChoosing] = useState(!!suggestedArena),
    [history, setHistory] = useState(false);
  const battle = game.battle;
  if (!game.loaded) return <p role="status">Recovering your saved battle…</p>;
  if (battle && !choosing)
    return (
      <BattleStage
        key={battle.id}
        battle={battle}
        mode={battle.mode}
        busy={game.busy}
        presentation={game.presentation}
        step={game.step}
        error={game.error}
        pending={!!game.pending}
        retry={game.retry}
        recover={game.reload}
        exit={() => setChoosing(true)}
        rematch={() =>
          game.start(
            battle.snapshot.player.id,
            battle.snapshot.opponent.id,
            battle.snapshot.policy === "combat-opponent/2"
              ? battle.snapshot.difficulty
              : undefined,
            battle.arena ?? "sanctuary",
          )
        }
      />
    );
  return (
    <section
      className="combat-screen"
      aria-label={`${mode === "guest" ? "Guest" : "Official"} battle setup`}
    >
      <div className="combat-heading">
        <p className="eyebrow">
          {mode === "guest"
            ? identity.walletPlay
              ? "Wallet Practice"
              : "Guest Practice"
            : "NFT Practice"}
        </p>
        <Link prefetch={false} href="/challenge">
          Challenge a friend
        </Link>
      </div>
      {game.error && <p role="alert">{game.error}</p>}
      {battle && !battle.state.outcome && (
        <div className="saved-battle-resume">
          <p>
            Your saved battle remains in{" "}
            {arenas[battle.arena ?? "sanctuary"].name}. Resume it before
            starting another.
          </p>
          <button onClick={() => setChoosing(false)}>
            Resume saved battle
          </button>
        </div>
      )}
      <FighterSelection
        holder={mode === "official"}
        allowed={identity.walletPlay ? access?.fighters : undefined}
        busy={game.busy || (!!battle && !battle.state.outcome)}
        initialArena={suggestedArena}
        onStart={(id, opponent, difficulty, arena) => {
          setChoosing(false);
          void game.start(id, opponent, difficulty, arena);
        }}
      />
      {!!game.history.length && (
        <button onClick={() => setHistory(true)}>
          Your private {mode} battle history
        </button>
      )}
      {history && (
        <ModalPanel
          title="Private battle history"
          onClose={() => setHistory(false)}
        >
          <BattleHistory
            history={game.history}
            busy={game.busy}
            mode={mode}
            review={(id) => {
              setHistory(false);
              setChoosing(false);
              void game.reload(id);
            }}
          />
        </ModalPanel>
      )}
    </section>
  );
}
