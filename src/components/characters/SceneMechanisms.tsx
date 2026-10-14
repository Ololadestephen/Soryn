import type { TacticalState } from "../../domain/game/tactical/contracts";
export function SceneMechanisms({
  room,
  tactics,
}: {
  room: number;
  tactics: TacticalState;
}) {
  if (room === 1)
    return (
      <g stroke="var(--ink)" strokeWidth="2">
        <rect
          x="106"
          y="76"
          width="101"
          height="72"
          rx="6"
          fill={tactics.mechanismKnown ? "var(--yellow)" : "var(--gallery)"}
        />
        <path d="M115 99h82M115 122h82" stroke="var(--line)" />
        <text
          x="156"
          y="62"
          textAnchor="middle"
          fontSize="13"
          stroke="none"
          fill="var(--ink)"
        >
          Delivery hatch
        </text>
        <path
          d="M310 214v-73m-18 30h36m-18-18v36"
          stroke={tactics.effects.reroute ? "var(--purple)" : "var(--ink)"}
          strokeWidth="5"
        />
        <text
          x="308"
          y="236"
          textAnchor="middle"
          fontSize="12"
          stroke="none"
          fill="var(--ink)"
        >
          {tactics.effects.reroute ? "Gate disabled" : "Patrol gate"}
        </text>
      </g>
    );
  if (room === 2)
    return (
      <g stroke="var(--ink)" strokeWidth="2">
        <rect
          x="392"
          y="211"
          width="91"
          height="13"
          rx="3"
          fill={
            tactics.effects.reroute || tactics.effects.steady
              ? "var(--yellow)"
              : "var(--gallery)"
          }
        />
        <text
          x="438"
          y="246"
          textAnchor="middle"
          fontSize="12"
          stroke="none"
          fill="var(--ink)"
        >
          Pressure plate
        </text>
      </g>
    );
  return null;
}
