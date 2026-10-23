"use client";
import { useEffect, useRef, useState, type ComponentType } from "react";
import type { CharacterId } from "../../../domain/characters/definitions";
import { prepareSpecial, previewSequence } from "./preview-media";
import type { PreviewPhase } from "./SpecialScene";
import { IdleArt } from "../../combat/rendered/IdleArt";

type SceneProps = { id: CharacterId; phase: PreviewPhase; hit: number };
export function SpecialPreview({
  id,
  revealed,
  ready,
}: {
  id: CharacterId;
  revealed: boolean;
  ready: boolean;
}) {
  const controller = useRef<AbortController | null>(null);
  const [scene, setScene] = useState<{
    Component: ComponentType<SceneProps>;
    phase: PreviewPhase;
    hit: number;
  } | null>(null);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  useEffect(() => () => controller.current?.abort(), []);
  async function play() {
    if (controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setStatus("loading");
    setMessage("");
    const cancel = () => {
      if (document.hidden) request.abort();
    };
    document.addEventListener("visibilitychange", cancel);
    try {
      const presentation = await import("./SpecialScene");
      await prepareSpecial(id, request.signal);
      if (request.signal.aborted) throw request.signal.reason;
      setStatus("playing");
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      await previewSequence(id, reduced, request.signal, (phase, hit) => {
        setScene({ Component: presentation.default, phase, hit });
      });
      setStatus("complete");
      setMessage("Preview complete. Ready to replay.");
    } catch (error) {
      if (request.signal.aborted) {
        setStatus("idle");
        setMessage("Preview stopped. Ready to replay.");
      } else {
        setStatus("unavailable");
        setMessage(
          error instanceof Error ? error.message : "Preview unavailable.",
        );
      }
    } finally {
      document.removeEventListener("visibilitychange", cancel);
      setScene(null);
      if (controller.current === request) controller.current = null;
    }
  }
  return (
    <>
      <div
        className="dossier-stage"
        aria-label="Rendered fighter and companion"
        data-preview-status={status}
      >
        <span className="dossier-halo" aria-hidden="true" />
        {scene ? (
          <scene.Component id={id} phase={scene.phase} hit={scene.hit} />
        ) : revealed ? (
          <>
            <div className="dossier-fighter">
              <IdleArt key={id} id={id} />
            </div>
            <div className="dossier-companion">
              <IdleArt key={`${id}-pet`} id={id} companion />
            </div>
          </>
        ) : (
          <p className="art-placeholder">Fighter & companion</p>
        )}
        <span className="stage-ground" aria-hidden="true" />
      </div>
      <div className="preview-controls">
        <button
          className="world-button outline"
          disabled={!ready || status === "loading" || status === "playing"}
          onClick={() => void play()}
        >
          {status === "loading"
            ? "Preparing preview…"
            : status === "playing"
              ? "Preview playing…"
              : status === "idle"
                ? "Preview special"
                : "Replay special"}
        </button>
        <p>
          Ability preview · silent
          <br />
          <span>
            Try their signature move. Battle outcomes depend on both choices.
          </span>
        </p>
      </div>
      <p className="preview-status" role="status">
        {message}
      </p>
    </>
  );
}
