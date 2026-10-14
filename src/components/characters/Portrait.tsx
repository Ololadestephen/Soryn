import type { CharacterId } from "../../domain/characters/definitions";
import { character } from "../../domain/characters/definitions";

function Equipment({ id }: { id: CharacterId }) {
  switch (id) {
    case "pip":
      return (
        <>
          <path d="M-44 23l-23 49 32-9M44 23l20 48-31-9" fill="var(--purple)" />
          <path d="M-39-25q35-31 78 0l-4 11h-67Z" fill="var(--yellow)" />
          <circle cx="47" cy="28" r="15" fill="var(--paper)" />
          <path d="M55 40l13 18" strokeWidth="6" />
        </>
      );
    case "bolt":
      return (
        <>
          <path
            d="M-25-19l-7-43 17 5 4 35M22-19l8-46 17 12-12 36"
            fill="var(--yellow)"
          />
          <path
            d="M-48 67l-26-12 6 17-9 5 28 10M37 67l24-12-6 17 10 5-28 10"
            fill="var(--purple)"
          />
          <path d="M-27 38l53 9-26 9Z" fill="var(--yellow)" />
        </>
      );
    case "patch":
      return (
        <>
          <rect
            x="-60"
            y="2"
            width="25"
            height="60"
            rx="6"
            fill="var(--yellow)"
          />
          <rect
            x="-35"
            y="-2"
            width="70"
            height="24"
            rx="10"
            fill="var(--ink)"
          />
          <circle cx="-17" cy="10" r="10" fill="var(--paper)" />
          <circle cx="17" cy="10" r="10" fill="var(--paper)" />
          <path d="M46 61l16-36m-7-6 14 4-3 12-13-2Z" fill="var(--paper)" />
        </>
      );
    case "moss":
      return (
        <>
          <path
            d="M-43-15q-18-30 10-30Q0-67 12-37q26-29 38 0l-7 29Z"
            fill="var(--purple)"
          />
          <path
            d="M-42 8q-24 23-9 57l19-18M42 8q23 23 9 57l-20-18"
            fill="var(--yellow)"
          />
          <path d="M-6-45q-4 18 5 28M3-40l21-7" fill="none" />
          <path d="M-16 48h31l-4 18h-23Z" fill="var(--paper)" />
        </>
      );
    case "aegis":
      return (
        <>
          <path
            d="M-46 12l-16 18 9 28 29-8M46 12l16 18-9 28-29-8"
            fill="var(--purple)"
          />
          <path
            d="M-42-11q0-51 43-45 44-4 43 45l-17 6-53-1Z"
            fill="var(--paper)"
          />
          <path d="M-25-35h50v22h-50Z" fill="var(--ink)" />
          <path d="M31 34l36 9-7 43-28-17Z" fill="var(--yellow)" />
          <path d="M44 47l7 21" />
        </>
      );
    case "nyx":
      return (
        <>
          <path
            d="M-51 23q-3-42 51-76 55 34 51 76l-17-14Q0-9-34 9Z"
            fill="var(--ink)"
          />
          <path d="M-37 27h73l-12 18h-52Z" fill="var(--purple)" />
          <path d="M-43 49l-14 37 56-13 55 13-15-37" fill="var(--ink)" />
          <path d="M45 40l24-10-7 19" fill="var(--yellow)" />
        </>
      );
    case "echo":
      return (
        <>
          <path
            d="M-38-17q-7-24-30-30l7 26 24 15M38-17q8-24 30-30l-7 26-24 15"
            fill="var(--yellow)"
          />
          <path
            d="M-39 4l28-9 12 12 12-12 26 9-8 23H-30Z"
            fill="var(--purple)"
          />
          <circle cx="-18" cy="12" r="7" fill="var(--paper)" />
          <circle cx="18" cy="12" r="7" fill="var(--paper)" />
          <path
            d="M-48 49q-34 12-27 28 9 11 19-6"
            fill="none"
            strokeWidth="9"
          />
          <path d="M-21 50l20 13 21-13" fill="var(--yellow)" />
        </>
      );
    case "prism":
      return (
        <>
          <path d="M-65-8l40-55 30 8 29 47Z" fill="var(--purple)" />
          <path d="M-72-9h127v13H-72Z" fill="var(--yellow)" />
          <path d="M37 36l24-8 18 29-26 17Z" fill="var(--paper)" />
          <path d="M46 39l16 6-8 20Z" fill="var(--purple)" />
          <path d="M-20 50l18-10 15 10-15 15Z" fill="var(--yellow)" />
        </>
      );
    case "atlas":
      return (
        <>
          <path d="M-49 7l-19 56 30 7M49 7l19 56-30 7" fill="var(--purple)" />
          <path d="M-22-27v33M22-27v33" strokeWidth="12" />
          <path d="M-44 52h87v23h-87Z" fill="var(--yellow)" />
          <path d="M-34 4l17 65M34 4L17 69" strokeWidth="7" />
          <rect x="-13" y="50" width="26" height="22" fill="var(--paper)" />
        </>
      );
    case "flux":
      return (
        <>
          <path d="M-46-12q1-47 46-43 45-4 46 43Z" fill="var(--yellow)" />
          <path d="M-53-13h108v13H-53Z" fill="var(--yellow)" />
          <path d="M-6-48v36" strokeWidth="9" />
          <path d="M-25 42h49l12 32h-72Z" fill="var(--purple)" />
          <path
            d="M43 62l20-28m-2-20 17 4-1 20-12 8-15-10 2-11Z"
            fill="var(--paper)"
          />
        </>
      );
    case "ember":
      return (
        <>
          <path
            d="M-28-22q-12-25 0-44l9 17 14-37 16 34 13-15q16 24 4 45Z"
            fill="var(--yellow)"
          />
          <path d="M-32 7h63l-9 20h-43Z" fill="var(--ink)" />
          <path
            d="M-39 44l-16 24 22 10M39 44l17 24-23 10"
            fill="var(--yellow)"
          />
          <path d="M-9 42l16 2-13 20 2-13-14-1Z" fill="var(--paper)" />
        </>
      );
    case "mneme":
      return (
        <>
          <path
            d="M-41-6q-21-8-27-30 23-8 30 11M41-6q21-8 27-30-23-8-30 11"
            fill="var(--paper)"
          />
          <path d="M-9-26q-22-24 5-26 32 0 10 14" fill="none" strokeWidth="5" />
          <path d="M-33 39l33 8 34-8v36l-34 7-33-7Z" fill="var(--yellow)" />
          <path d="M0 48v31M-24 49l16 4m18 0 16-4" fill="none" />
        </>
      );
  }
}
export function CharacterFigure({ id }: { id: CharacterId }) {
  const wide = id === "atlas" ? 1.16 : id === "nyx" ? 0.84 : 1;
  return (
    <g
      transform={`scale(${wide} 1)`}
      stroke="var(--ink)"
      strokeWidth="2.5"
      strokeLinejoin="round"
    >
      <path
        d="M-41-3Q-62-35-34-24L-17-12Q0-21 18-12L37-26Q58-31 42 1Q60 25 44 59Q0 81-44 59Q-60 25-41-3Z"
        fill="var(--mascot, #dcb1db)"
      />
      <path
        d="M-29 61l-8 18h22l7-16M17 63l7 16h22l-11-19"
        fill="var(--purple)"
      />
      <ellipse cx="-16" cy="18" rx="5" ry="8" fill="var(--ink)" />
      <ellipse cx="17" cy="18" rx="5" ry="8" fill="var(--ink)" />
      <path d="M-10 42q11 11 22 0M-4 32l6 6 5-6Z" fill="var(--ink)" />
      <Equipment id={id} />
    </g>
  );
}
export function Portrait({ id }: { id: CharacterId }) {
  return (
    <svg
      className={`character-portrait portrait-${id}`}
      viewBox="0 0 180 175"
      role="img"
      aria-label={`${character(id).name}, original ${character(id).role.toLowerCase()} adventurer illustration`}
    >
      <g transform="translate(90 83)">
        <CharacterFigure id={id} />
      </g>
    </svg>
  );
}
