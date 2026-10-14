import { SceneMechanisms } from "../characters/SceneMechanisms";
import type { TacticalState } from "../../domain/game/tactical/contracts";
import { CharacterFigure } from "../characters/Portrait";
import { character } from "../../domain/characters/definitions";
import { useId } from "react";

interface StageProps {
  room: number;
  sandwich: boolean;
  trapped: boolean;
  ghost?: boolean;
  tactics?: TacticalState;
}

export function Mascot({
  x,
  y,
  ghost = false,
}: {
  x: number;
  y: number;
  ghost?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={ghost ? 0.35 : 1}>
      <ellipse cx="0" cy="79" rx="55" ry="10" fill="#281a3f" opacity=".15" />
      <path
        d="M-44 2 Q-65-40-35-25 L-18-13 Q0-22 19-13 L38-29 Q61-34 43 3 Q62 25 46 59 Q0 84-46 59 Q-62 26-44 2"
        fill={ghost ? "#9a84d4" : "#dcb1db"}
        stroke="#372747"
        strokeWidth="3"
      />
      <path
        d="M-29 59 L-36 78 L-17 78 L-11 64 M16 65 L21 78 L40 78 L32 60"
        fill="#b58bb9"
        stroke="#372747"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <ellipse cx="-17" cy="18" rx="6" ry="9" fill="#372747" />
      <ellipse cx="18" cy="18" rx="6" ry="9" fill="#372747" />
      <ellipse cx="1" cy="37" rx="14" ry="10" fill="#f4d6df" />
      <path d="M-5 33 Q1 27 7 33 L1 38 Z M-9 44 Q1 51 11 44" fill="#372747" />
      <path
        d="M-40 37 l-20 13 M40 37 l20-4"
        stroke="#372747"
        strokeWidth="8"
        strokeLinecap="round"
      />
      {!ghost && (
        <path
          d="M-28-8 Q0-30 27-8 L26-2 L-31-2Z"
          fill="#7d64a4"
          stroke="#372747"
          strokeWidth="3"
        />
      )}
    </g>
  );
}

export function Stage({
  room,
  sandwich,
  trapped,
  ghost = false,
  tactics,
}: StageProps) {
  const event = tactics?.events.at(-1);
  const positions: Record<string, number> = {
    door: 330,
    arch: 475,
    sneak: 440,
    vent: 580,
    take: 405,
    swap: 315,
    exit: 560,
    leave: 130,
    inspect: 245,
    "skill-peek": 245,
    "skill-spare": 190,
    "skill-bubble": 190,
    "skill-trail": 300,
    "skill-lens": 300,
    "skill-steady": 360,
    "skill-reroute": 380,
    "skill-second-thought": 190,
    "commit-door": 330,
    "commit-sneak": 440,
    "commit-take": 405,
    "inspect-mechanism": 300,
  };
  const x =
    event && event.from === event.to
      ? (positions[event.action] ?? 205)
      : event && room === 1
        ? 230
        : 170;
  const floorId = useId();
  return (
    <svg
      className="stage-art"
      viewBox="0 0 720 340"
      role="img"
      aria-label={`${tactics ? `${character(tactics.loadout.characterId).name}${ghost ? " strategy ghost" : " adventurer"}` : ghost ? "Strategy ghost" : "Original guest mascot"} ${trapped ? "becomes a museum exhibit" : `in room ${room + 1} of the sandwich museum`}`}
    >
      <defs>
        <pattern
          id={floorId}
          width="90"
          height="50"
          patternUnits="userSpaceOnUse"
        >
          <path d="M0 0H90V50H0Z" fill="#e9d4c4" stroke="#ccb7ad" />
        </pattern>
      </defs>
      <rect width="720" height="340" fill="#e8ded4" />
      <path d="M0 0H720V230H0Z" fill="#eee7dd" />
      <path d="M0 231H720V340H0Z" fill={`url(#${floorId})`} />
      <path d="M0 228H720" stroke="#bcb0b3" strokeWidth="5" />
      {[50, 640].map((x) => (
        <g key={x}>
          <rect x={x} y="35" width="35" height="193" fill="#d8cad0" />
          <path
            d={`M${x - 7} 35h49v15h-49 M${x - 7} 210h49v18h-49`}
            fill="#baa9bb"
          />
        </g>
      ))}
      {room === 0 && (
        <g>
          <rect
            x="320"
            y="47"
            width="116"
            height="182"
            rx="4"
            fill="#b68a92"
            stroke="#6d536a"
            strokeWidth="6"
          />
          <path
            d="M340 67H416V142H340Z M340 155H416V210H340Z"
            fill="none"
            stroke="#dab3b1"
            strokeWidth="3"
          />
          <circle cx="416" cy="146" r="5" fill="#ebd986" />
          <path
            d="M347 67l66 8 M340 162l76-8 M328 208l102-13"
            stroke="#83697b"
            strokeWidth="4"
            opacity=".45"
          />
          <path
            d="M494 229V105a51 51 0 01102 0V229Z"
            fill="#8a7a9a"
            stroke="#b6a2b7"
            strokeWidth="10"
          />
          <path d="M508 229V110a37 37 0 0174 0V229Z" fill="#44344f" />
          <rect
            x="143"
            y="57"
            width="146"
            height="73"
            rx="2"
            fill="#ffedbc"
            stroke="#937d7a"
            strokeWidth="2"
          />
          <text
            x="216"
            y="83"
            textAnchor="middle"
            fill="#534357"
            fontSize="13"
            fontFamily="monospace"
          >
            OUR DOORS ARE
          </text>
          <text
            x="216"
            y="104"
            textAnchor="middle"
            fill="#534357"
            fontSize="13"
            fontFamily="monospace"
          >
            WORKS OF ART.
          </text>
          <path
            d="M472 263l25-10 m3-8l25-10 m3-8l25-10"
            stroke="#a0889a"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </g>
      )}
      {room === 1 && (
        <g>
          <rect x="356" y="166" width="186" height="16" fill="#8c637e" />
          <path d="M367 182v70m164-70v70" stroke="#8c637e" strokeWidth="14" />
          <path
            d="M420 157v-62q30-20 59 0v62"
            fill="#8298a0"
            stroke="#4a5267"
            strokeWidth="3"
          />
          <circle
            cx="450"
            cy="77"
            r="25"
            fill="#efcbb1"
            stroke="#4a5267"
            strokeWidth="3"
          />
          <path d="M420 57q30-31 60 0v8h-60Z" fill="#4a5267" />
          <path
            d="M398 149l30-32 41 14 28-20"
            fill="none"
            stroke="#efcbb1"
            strokeWidth="13"
          />
          <path
            d="M398 132l47 9-8 34-46-9Z M459 113l39 8-7 31-39-8Z"
            fill="#fffaec"
            stroke="#a18b97"
            strokeWidth="2"
          />
          <rect x="564" y="154" width="51" height="72" fill="#776c81" />
          {[575, 586, 597, 608].map((x) => (
            <path key={x} d={`M${x} 166v50`} stroke="#b6a9b9" strokeWidth="4" />
          ))}
          <text
            x="445"
            y="37"
            textAnchor="middle"
            fill="#705b79"
            fontSize="15"
            fontFamily="monospace"
          >
            DEPARTMENT OF UNNECESSARY FORMS
          </text>
        </g>
      )}
      {room === 2 && (
        <g>
          <path d="M376 175h123l-17 55h-89Z" fill="#a599b7" />
          <ellipse cx="437" cy="176" rx="62" ry="13" fill="#c6b8ce" />
          <path
            d="M399 174V91q38-48 76 0v83"
            fill="#fff"
            opacity=".22"
            stroke="#7b7288"
            strokeWidth="3"
          />
          {!sandwich && (
            <g transform="translate(420 136)">
              <path
                d="M0 0q19-23 40 0Z"
                fill="#e9b373"
                stroke="#805968"
                strokeWidth="2"
              />
              <path d="M-3 4h46 M0 10h40" stroke="#739779" strokeWidth="5" />
              <path d="M0 16h40" stroke="#e4ba78" strokeWidth="8" />
            </g>
          )}
          <path d="M548 229V78h66v151" fill="#768d87" />
          <text
            x="581"
            y="60"
            textAnchor="middle"
            fill="#547868"
            fontSize="18"
            fontFamily="monospace"
          >
            EXIT
          </text>
          <rect x="552" y="143" width="57" height="6" fill="#d7ddc4" />
          <rect x="283" y="151" width="43" height="10" fill="#ae8a70" />
          <path d="M293 151l3-16h16l4 16Z" fill="#b9a05b" />
        </g>
      )}
      {tactics && <SceneMechanisms room={room} tactics={tactics} />}
      {tactics ? (
        <g
          className="stage-character"
          style={{ transform: `translate(${x}px, 165px)` }}
          opacity={ghost ? 0.45 : 1}
        >
          {tactics.effects.bubble && (
            <ellipse
              cx="0"
              cy="15"
              rx="72"
              ry="83"
              fill="var(--gallery)"
              fillOpacity=".3"
              stroke="var(--purple)"
              strokeWidth="4"
            />
          )}
          <CharacterFigure id={tactics.loadout.characterId} />
          {sandwich && (
            <g transform="translate(40 34)">
              <path
                d="M0 0q14-17 30 0Z"
                fill="var(--yellow)"
                stroke="var(--ink)"
              />
              <path d="M-2 5h34" stroke="var(--purple)" strokeWidth="5" />
              <path d="M0 11h30" stroke="var(--yellow)" strokeWidth="7" />
            </g>
          )}
          {tactics.effects.steady && (
            <path d="M-35 32h70" stroke="var(--yellow)" strokeWidth="8" />
          )}
        </g>
      ) : (
        <Mascot x={190} y={169} ghost={ghost} />
      )}
      {!!tactics?.effects.trail && (
        <g transform="translate(410 80)">
          <rect
            width="85"
            height="50"
            rx="7"
            fill="var(--yellow)"
            stroke="var(--ink)"
          />
          <text
            x="42"
            y="30"
            textAnchor="middle"
            fontSize="13"
            fill="var(--ink)"
          >
            False trail
          </text>
        </g>
      )}
      {tactics?.effects.reroute && (
        <path
          d="M350 205h160"
          stroke="var(--purple)"
          strokeWidth="8"
          strokeDasharray="12 8"
        />
      )}
      {trapped && (
        <g>
          <path d="M119 274h146v28H119Z" fill="#b199b7" />
          <text
            x="192"
            y="292"
            textAnchor="middle"
            fill="#392b4d"
            fontSize="12"
            fontFamily="monospace"
          >
            NEW ACQUISITION
          </text>
        </g>
      )}
      <text
        x="698"
        y="322"
        textAnchor="end"
        fill="#746778"
        fontSize="10"
        fontFamily="monospace"
      >
        THE GREAT SANDWICH INCIDENT
      </text>
    </svg>
  );
}
