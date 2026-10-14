import type { BattleView, Side } from "../contracts";
import { frameDuration, type CombatPresentation } from "./project";

export type PilotClip =
  | "idle"
  | "basic"
  | "special"
  | "guard"
  | "guard-recovery"
  | "counter"
  | "hit"
  | "guard-hit"
  | "knockout"
  | "guard-knockout"
  | "defeated";
export interface PilotSelection {
  clip: PilotClip;
  first: number;
  last: number;
  duration: number;
  loop: boolean;
  key: string;
}
export interface PilotMemory {
  battleId: string;
  frameId: string | null;
  health: number;
  guarded: boolean;
  knockout: PilotSelection | null;
  selection: PilotSelection;
}

export function presentationDuration(
  battle: BattleView,
  frame: CombatPresentation,
): number {
  const side = frame.event.side;
  if (!side || battle.snapshot[side].id !== "aegis")
    return frameDuration[frame.phase ?? "information"];
  if (frame.event.kind === "knockout") return 900;
  if (frame.phase === "anticipation") return 240;
  if (frame.phase === "action")
    return frame.event.move === "special" ? 480 : 320;
  if (frame.phase === "recovery") return 240;
  return frameDuration[frame.phase ?? "information"];
}

function stance(
  battleId: string,
  side: Side,
  guarded: boolean,
): PilotSelection {
  return {
    clip: guarded ? "guard" : "idle",
    first: guarded ? 6 : 0,
    last: guarded ? 6 : 11,
    duration: guarded ? 0 : 1500,
    loop: !guarded,
    key: `${battleId}:${side}:${guarded ? "guard" : "idle"}`,
  };
}

function actionSelection(
  clip: "basic" | "special" | "counter",
  frame: CombatPresentation,
  duration: number,
): Omit<PilotSelection, "key"> {
  const ranges =
    clip === "special"
      ? {
          anticipation: [0, 5],
          action: [6, 17],
          impact: [18, 29],
          recovery: [30, 35],
        }
      : clip === "basic"
        ? {
            anticipation: [0, 5],
            action: [6, 13],
            impact: [14, 25],
            recovery: [26, 31],
          }
        : {
            anticipation: [0, 0],
            action: [0, 7],
            impact: [8, 19],
            recovery: [20, 25],
          };
  const phase =
    frame.phase === "information" || !frame.phase ? "impact" : frame.phase;
  const [first, last] = ranges[phase];
  return { clip, first, last, duration, loop: false };
}

/** A visual state machine only. It never predicts actions, damage or results. */
export function pilotSelection(
  previous: PilotMemory | null,
  battle: BattleView,
  input: CombatPresentation | null,
  side: Side,
): PilotMemory {
  const frame = input?.id?.startsWith(`${battle.id}:`) ? input : null;
  const sameBattle = previous?.battleId === battle.id;
  const state = frame?.event.state ?? battle.state;
  if (
    sameBattle &&
    previous.frameId === (frame?.id ?? null) &&
    previous.health === state[side].health
  )
    return previous;
  let guarded = sameBattle ? previous.guarded : false;
  const key = `${frame?.id ?? battle.id}:${side}`;
  let selection = stance(battle.id, side, guarded);
  let knockout = sameBattle ? previous.knockout : null;
  if (state[side].health === 0) {
    if (!knockout && frame)
      knockout = {
        clip: guarded ? "guard-knockout" : "knockout",
        first: 0,
        last: 19,
        duration: 850,
        loop: false,
        key: `${battle.id}:${side}:${frame.round}:knockout`,
      };
    selection = knockout ?? {
      clip: "defeated",
      first: 0,
      last: 0,
      duration: 0,
      loop: false,
      key: `${battle.id}:${side}:defeated`,
    };
  } else if (!frame) {
    guarded = false;
    selection = stance(battle.id, side, false);
  } else if (state[side].health < frame.previous[side].health) {
    selection = {
      clip: guarded ? "guard-hit" : "hit",
      first: 0,
      last: 11,
      duration: presentationDuration(battle, frame),
      loop: false,
      key,
    };
  } else if (frame.event.kind === "prepare" && frame.event.side === side) {
    guarded = true;
    selection = {
      clip: "guard",
      first: 0,
      last: 5,
      duration: presentationDuration(battle, frame),
      loop: false,
      key,
    };
  } else if (
    frame.event.side === side &&
    ["anticipation", "action", "impact", "recovery"].includes(frame.phase ?? "")
  ) {
    const counter =
      frame.event.kind === "counter" ||
      (frame.event.move === "guard" && frame.treatment);
    const clip = counter
      ? "counter"
      : frame.event.move === "special"
        ? "special"
        : "basic";
    if (counter) guarded = true;
    else if (frame.phase === "action") guarded = false;
    selection = {
      ...actionSelection(clip, frame, presentationDuration(battle, frame)),
      key,
    };
  } else if (frame.event.kind === "recovery" && guarded) {
    guarded = false;
    selection = {
      clip: "guard-recovery",
      first: 0,
      last: 5,
      duration: presentationDuration(battle, frame),
      loop: false,
      key,
    };
  }
  return {
    battleId: battle.id,
    frameId: frame?.id ?? null,
    health: state[side].health,
    guarded,
    knockout,
    selection,
  };
}

export function petSelection(
  battle: BattleView,
  frame: CombatPresentation | null,
  side: Side,
): PilotSelection {
  const state = frame?.event.state ?? battle.state;
  if (state[side].health === 0)
    return {
      clip: "defeated",
      first: 0,
      last: 0,
      duration: 0,
      loop: false,
      key: `${battle.id}:${side}:pet-settled`,
    };
  if (
    frame?.event.side === side &&
    frame.event.move === "special" &&
    frame.phase &&
    frame.phase !== "information"
  )
    return {
      ...actionSelection("special", frame, presentationDuration(battle, frame)),
      key: `${frame.id}:${side}:pet`,
    };
  return {
    ...stance(battle.id, side, false),
    key: `${battle.id}:${side}:pet-idle`,
  };
}
