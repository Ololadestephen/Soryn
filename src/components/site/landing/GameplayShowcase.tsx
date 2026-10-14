"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useReveal } from "./useReveal";

export function bindVideoVisibility(element: HTMLVideoElement) {
  const pauseWhenHidden = () => {
    if (document.hidden) element.pause();
  };
  const observer =
    typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(([entry]) => {
          if (!entry.isIntersecting) element.pause();
        });
  observer?.observe(element);
  document.addEventListener("visibilitychange", pauseWhenHidden);
  return () => {
    observer?.disconnect();
    document.removeEventListener("visibilitychange", pauseWhenHidden);
  };
}

export function GameplayShowcase() {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const { root, revealed } = useReveal("-80px");
  function close() {
    restoreFocus.current = true;
    setPlaying(false);
    setLoading(false);
    setFailed(false);
  }
  useEffect(() => {
    if (!playing && restoreFocus.current) {
      restoreFocus.current = false;
      trigger.current?.focus({ preventScroll: true });
    }
    const element = video.current;
    if (!element) return;
    return bindVideoVisibility(element);
  }, [playing]);
  return (
    <section
      id="gameplay"
      className="gameplay-showcase landing-section"
      ref={root}
      aria-labelledby="gameplay-title"
    >
      <div className="section-heading">
        <div>
          <p className="world-kicker">Inside the arena</p>
          <h2 id="gameplay-title">
            Pick a move.
            <br />
            Make it count.
          </h2>
        </div>
        <p>
          Both choices lock. Defences prepare first.
          <br />
          Then watch the round unfold.
        </p>
      </div>
      <div className="gameplay-frame">
        {playing ? (
          <video
            ref={video}
            controls
            autoPlay
            muted
            playsInline
            preload="none"
            aria-label="Recorded guest battle: Pip versus Bolt"
            aria-describedby="gameplay-captions"
            src="/gameplay/pip-v-bolt.mp4"
            onLoadStart={() => setLoading(true)}
            onCanPlay={() => setLoading(false)}
            onError={() => {
              setFailed(true);
              setLoading(false);
            }}
          />
        ) : (
          <>
            {revealed && (
              <Image
                unoptimized
                src="/gameplay/pip-v-bolt-poster.webp"
                alt="Pip and Bolt in the Ruined Sanctuary with health, energy and move controls visible"
                width={1280}
                height={800}
                loading="lazy"
              />
            )}
            <button
              ref={trigger}
              className="gameplay-play"
              onClick={() => {
                setFailed(false);
                setPlaying(true);
              }}
            >
              Play gameplay
            </button>
          </>
        )}
        {loading && !failed && (
          <p className="media-status" role="status">
            Loading gameplay…
          </p>
        )}
        {failed && (
          <div className="media-error" role="alert">
            <p>Gameplay video unavailable. You can still play a battle.</p>
            <button onClick={close}>Try video again</button>
            <a href="/arena">Play now</a>
          </div>
        )}
      </div>
      {playing && (
        <button className="secondary gameplay-close" onClick={close}>
          Close gameplay
        </button>
      )}
      <ol id="gameplay-captions" className="gameplay-captions">
        <li>
          <strong>01 / Choose</strong>
          <span>Attack, defend or call your companion.</span>
        </li>
        <li>
          <strong>02 / Resolve</strong>
          <span>Defence prepares. Initiative sets attack order.</span>
        </li>
        <li>
          <strong>03 / Adapt</strong>
          <span>Read health, energy and cooldowns. Choose again.</span>
        </li>
      </ol>
      <p className="gameplay-source">
        Recorded guest practice · Pip & Owl versus computer Bolt & Cheetah ·
        silent
      </p>
      <a className="text-link" href="#fighters">
        Meet the fighters
      </a>
    </section>
  );
}
