import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { BattleView, Move } from "../../domain/combat/contracts";
import type { CombatPresentation } from "./playback";
import { Arena } from "./Arena";
import { MoveControls } from "./MoveControls";
import { ModalPanel } from "./ModalPanel";
import { BattleLog } from "./BattleHistory";
import { useMoveNotices } from "./useMoveNotices";
import { difficultyLabel } from "../../domain/combat/difficulty/contracts";
import { useArenaLayout } from "./useArenaLayout";
import { useMatchAssets } from "./useMatchAssets";
import { AudioControls } from "./audio/AudioControls";
import { arenas } from "../../domain/combat/arenas";

/** A hung download must not hold both players until the server loading deadline. */
const ASSET_ACK_BOUND_MS = 2500;

export function BattleStage({
  battle,
  busy,
  presentation,
  mode,
  step,
  rematch,
  exit,
  error,
  pending,
  retry,
  recover,
  rival = "Computer",
  pvp,
  onAssetsReady,
}: {
  battle: BattleView;
  busy: boolean;
  presentation: CombatPresentation | null;
  mode: "guest" | "official";
  step: (move: Move) => unknown;
  rematch: () => unknown;
  exit: () => void;
  error: string;
  pending: boolean;
  retry: () => unknown;
  recover: () => unknown;
  rival?: string;
  pvp?: {
    origin?: "public" | "private";
    finished?: boolean;
    prompt: string;
    detail: string | null;
    connected: boolean;
    seconds: number | null;
    input: "open" | "closed";
    headline?: string;
    explanation?: string;
    rematchNote?: string;
    rematchRequested?: boolean;
    score?: string;
    nextLabel?: string;
    exitLabel?: string;
  };
  onAssetsReady?: () => void | Promise<unknown>;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    result = useRef<HTMLHeadingElement>(null);
  const [panel, setPanel] = useState<"settings" | "history" | null>(null);
  const notice = useMoveNotices(battle, presentation);
  useArenaLayout(dialog);
  const complete = !busy && (!!battle.state.outcome || !!pvp?.headline);
  const assets = useMatchAssets(battle);
  const reported = useRef("");
  const sending = useRef("");
  const [ackDue, setAckDue] = useState(false);
  const [ackAttempt, setAckAttempt] = useState(0);
  const turnOpen = pvp?.input === "open";
  const matchLabel =
    pvp?.origin === "public"
      ? "Public match"
      : pvp
        ? "Friend match"
        : undefined;
  useEffect(() => {
    const timer = setTimeout(() => setAckDue(true), ASSET_ACK_BOUND_MS);
    return () => clearTimeout(timer);
  }, [battle.id]);
  useEffect(() => {
    const notify = onAssetsReady;
    if (!notify) return;
    if (ackAttempt > 3) return;
    if (reported.current === battle.id || sending.current === battle.id) return;
    // Unavailable artwork still releases the opponent. A download that never
    // settles does too, once the bound passes.
    if (assets.loading && !assets.unavailable && !ackDue) return;
    sending.current = battle.id;
    const id = battle.id;
    let cancel = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    void Promise.resolve(notify()).then(
      (result) => {
        if (cancel) return;
        if (result === false) {
          sending.current = "";
          retry = setTimeout(() => setAckAttempt((n) => n + 1), 300);
        } else reported.current = id;
      },
      () => {
        if (cancel) return;
        sending.current = "";
        retry = setTimeout(() => setAckAttempt((n) => n + 1), 300);
      },
    );
    return () => {
      cancel = true;
      clearTimeout(retry);
    };
  }, [
    ackAttempt,
    ackDue,
    assets.loading,
    assets.unavailable,
    battle.id,
    onAssetsReady,
  ]);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => {
    if (complete) result.current?.focus({ preventScroll: true });
  }, [complete, battle.id]);
  return (
    <dialog
      ref={dialog}
      className={`battle-stage${battle.cosmetic ? " holder-scene" : ""}${battle.cosmetic && complete && battle.state.outcome === "victory" ? " holder-victory" : ""}`}
      data-preparing={assets.loading || undefined}
      aria-label={`${battle.accessKind ? "Wallet player" : mode === "guest" ? "Guest" : "NFT competitor"} battle`}
      onCancel={(event) => {
        event.preventDefault();
        setPanel("settings");
      }}
    >
      <Arena
        key={assets.revision}
        battle={battle}
        state={presentation?.event.state ?? battle.state}
        presentation={presentation}
        rival={rival}
        matchLabel={matchLabel}
      />
      <button
        className="battle-settings"
        aria-label="Battle settings"
        onClick={() => setPanel("settings")}
      >
        ⚙
      </button>
      <div
        className="move-notice-region"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {notice && (
          <div
            key={notice.id}
            className="move-notice"
            data-notice-id={notice.id}
          >
            {notice.label}
          </div>
        )}
      </div>
      <span className="arena-name">
        {arenas[battle.arena ?? "sanctuary"].name}
      </span>
      {assets.loading && !assets.unavailable && (
        <div className="arena-preparing" role="status">
          Preparing {arenas[battle.arena ?? "sanctuary"].name} · {assets.done}/
          {assets.total} artwork files
        </div>
      )}
      {assets.unavailable && (
        <div className="arena-preparing" role="alert">
          Required fighter artwork could not load. Your battle is saved.{" "}
          <button onClick={assets.retry}>Retry artwork</button>
        </div>
      )}
      {assets.failed && !assets.loading && (
        <p className="asset-warning">
          Some artwork uses the original fallback · gameplay remains available
        </p>
      )}
      {!complete && (
        <p className="turn-readiness" role="status">
          {pvp?.prompt ??
            (assets.loading
              ? "Preparing arena…"
              : busy
                ? "Resolving both choices…"
                : "Choose your next move")}
          {pvp && (
            <small>
              {rival} · {pvp.connected ? "Connected" : "Disconnected"}
              {pvp.seconds !== null ? ` · ${pvp.seconds}s` : ""}
              {pvp.score ? ` · ${pvp.score}` : ""}
              {pvp.detail ? ` · ${pvp.detail}` : ""}
            </small>
          )}
        </p>
      )}
      <MoveControls
        battle={battle}
        busy={busy || (assets.loading && !turnOpen) || pvp?.input === "closed"}
        step={step}
      />
      {error && (
        <div className="battle-error">
          <p role="alert">{error}</p>
          {pending && (
            <button disabled={busy} onClick={() => void retry()}>
              Retry same battle request
            </button>
          )}
          <button disabled={busy} onClick={() => void recover()}>
            {pvp ? "Refresh this battle" : "Recover saved battle"}
          </button>
        </div>
      )}
      {complete && (
        <div className="combat-result" role="region" aria-label="Battle result">
          <h2 ref={result} tabIndex={-1}>
            {pvp?.headline ??
              (battle.state.outcome === "victory"
                ? "Victory"
                : battle.state.outcome === "defeat"
                  ? "Defeat"
                  : "Draw")}
          </h2>
          {pvp?.finished && (
            <p className="eyebrow">Series complete · {pvp.score}</p>
          )}
          <p>
            {matchLabel ?? difficultyLabel(battle.snapshot)} ·{" "}
            {battle.rounds.length} rounds
            {" · "}
            {arenas[battle.arena ?? "sanctuary"].name}
          </p>
          {pvp?.explanation && <p>{pvp.explanation}</p>}
          {pvp?.rematchNote && <p>{pvp.rematchNote}</p>}
          <div className="button-row">
            {pvp?.finished ? (
              <>
                <Link
                  className="button"
                  href={`${pvp.origin === "public" ? "/match" : "/challenge"}${mode === "official" ? "?as=chog" : battle.accessKind ? "?as=holder" : ""}`}
                >
                  {pvp.origin === "public"
                    ? "Find another match"
                    : "Challenge a friend"}
                </Link>
                <Link href="/start">Back to modes</Link>
              </>
            ) : (
              <>
                <button
                  disabled={!!pvp?.rematchRequested}
                  onClick={() => void rematch()}
                >
                  {pvp?.nextLabel
                    ? pvp.nextLabel
                    : pvp?.rematchRequested
                      ? "Rematch requested"
                      : pvp
                        ? "Request rematch"
                        : "Rematch"}
                </button>
                <button onClick={exit}>
                  {pvp?.exitLabel ?? (pvp ? "Return to setup" : "Change setup")}
                </button>
              </>
            )}
            <button onClick={() => setPanel("history")}>
              View battle history
            </button>
          </div>
        </div>
      )}
      {panel === "settings" && (
        <ModalPanel title="Battle settings" onClose={() => setPanel(null)}>
          <AudioControls />
          <p>
            {pvp
              ? `${matchLabel}. The turn keeps its deadline while this menu is open.`
              : `${mode === "guest" ? "Guest practice" : "Official token battle"}. A round continues while this menu is open. Your battle is saved as you play.`}
          </p>
          <p>
            Attack, defend or use your companion special. Both choices lock
            before actions resolve. Reduced motion follows your device setting.
          </p>
          <details>
            <summary>Move instructions</summary>
            {(["basic", "guard", "special"] as const).map((move) => (
              <p key={move}>
                <strong>{battle.snapshot.player.moves[move].name}</strong>:{" "}
                {battle.snapshot.player.moves[move].rule}
              </p>
            ))}
          </details>
          <button onClick={() => setPanel(null)}>Return to battle</button>
          <button
            disabled={busy}
            onClick={() => {
              setPanel(null);
              exit();
            }}
          >
            {pvp
              ? pvp.finished
                ? "Back to modes"
                : "Surrender series"
              : "Exit to setup"}
          </button>
        </ModalPanel>
      )}
      {panel === "history" && complete && (
        <ModalPanel title="Battle history" onClose={() => setPanel(null)}>
          <BattleLog battle={battle} />
        </ModalPanel>
      )}
    </dialog>
  );
}
