import { type CharacterId } from "../../domain/characters/definitions";
import { Equipment } from "./Equipment";
import { anatomy } from "./art/anatomy";

const colours: Record<CharacterId, string> = {
  pip: "#dcc36a",
  bolt: "#d78c62",
  patch: "#719baf",
  moss: "#84ad83",
  aegis: "#9187bc",
  nyx: "#6b6087",
  echo: "#c08ab4",
  prism: "#7eb7b5",
  atlas: "#bc9471",
  flux: "#a6a97e",
  ember: "#dc8366",
  mneme: "#a58abd",
};
export function FighterArt({
  id,
  defeated = false,
  reaction = "idle",
}: {
  id: CharacterId;
  defeated?: boolean;
  reaction?: "idle" | "hit" | "attack" | "heal";
}) {
  const body = anatomy[id],
    colour = colours[id];
  return (
    <svg
      viewBox="0 0 180 300"
      role="img"
      aria-label={`${id} original full-body fighter${defeated ? ", knocked out" : ""}`}
      className={`combat-art art-${id}`}
      data-facing="three-quarter-right"
    >
      <g
        stroke="#292137"
        strokeWidth="3.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <ellipse
          cx="90"
          cy="287"
          rx="64"
          ry="8"
          fill="#292137"
          opacity=".18"
          stroke="none"
        />
        <g className="combat-body">
          <g transform={body.stance}>
            <path data-anatomy="legs" d={body.legs} fill="#c9a3df" />
            <path data-anatomy="torso" d={body.torso} fill={colour} />
            <path
              data-anatomy="back-arm"
              className="combat-arm arm-back"
              d={body.backArm}
              fill="#c9a3df"
            />
            <path
              data-anatomy="front-arm"
              className="combat-arm arm-front"
              d={body.frontArm}
              fill="#c9a3df"
            />
            <path data-anatomy="ears" d={body.ears} fill="#c9a3df" />
            <path data-anatomy="head" d={body.head} fill="#c9a3df" />
            <Equipment id={id} defeated={defeated} />
            <g
              className="combat-face"
              transform={id === "nyx" ? "translate(1 0)" : "translate(0 0)"}
            >
              {defeated ? (
                <path
                  d="M88 78L98 89M98 78L88 89M111 76L123 87M123 76L111 87"
                  fill="none"
                  stroke={id === "aegis" ? "#fff4ca" : "#292137"}
                />
              ) : (
                <>
                  <ellipse
                    cx="94"
                    cy="82"
                    rx="2.5"
                    ry="6"
                    fill={id === "aegis" ? "#fff4ca" : "#292137"}
                  />
                  <ellipse
                    cx="118"
                    cy="81"
                    rx="4"
                    ry="7"
                    fill={id === "aegis" ? "#fff4ca" : "#292137"}
                  />
                </>
              )}
              {id !== "nyx" && (
                <>
                  <path d="M126 94L138 96L129 104Z" fill="#292137" />
                  <path
                    d={
                      defeated
                        ? "M103 112Q113 103 125 109"
                        : reaction === "hit"
                          ? "M106 107Q115 99 123 108Q116 119 106 107Z"
                          : reaction === "attack"
                            ? "M104 110L125 106"
                            : "M105 108Q116 117 127 105"
                    }
                    fill="none"
                  />
                </>
              )}
              {reaction === "attack" && (
                <path d="M87 71L97 75M110 74L122 69" fill="none" />
              )}
            </g>
            {id === "flux" && (
              <g fill="#f7db65">
                <circle cx="48" cy="153" r="7" />
                <circle cx="139" cy="160" r="7" />
                <circle cx="139" cy="180" r="5" />
              </g>
            )}
          </g>
        </g>
      </g>
    </svg>
  );
}
