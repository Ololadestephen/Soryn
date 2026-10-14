import {
  other,
  type CombatEvent,
  type CombatState,
  type Side,
} from "../contracts";
export interface EventCue {
  type:
    | "hit"
    | "block"
    | "dodge"
    | "decoy"
    | "counter"
    | "heal"
    | "recoil"
    | "burn"
    | "status"
    | "expiry"
    | "cancel"
    | "knockout"
    | "prepare"
    | "none";
  target: Side | null;
  amount: number;
  shield: number;
  decoy: number;
  label: string;
}
export function eventCue(event: CombatEvent, previous: CombatState): EventCue {
  const cue: EventCue = {
    type: "none",
    target: event.side,
    amount: 0,
    shield: 0,
    decoy: 0,
    label: event.message,
  };
  if (event.kind === "heal" && event.side)
    return {
      ...cue,
      type: "heal",
      amount: event.state[event.side].health - previous[event.side].health,
    };
  if (event.kind === "counter" && event.side) {
    const target = other(event.side);
    return {
      ...cue,
      type: "counter",
      target,
      amount: previous[target].health - event.state[target].health,
    };
  }
  if (event.kind === "impact" && event.side)
    return impactCue(event, previous, cue, event.side);
  if (event.kind === "status") {
    const changed = (["player", "opponent"] as const).find((side) =>
      (["exposed", "disrupt", "burn"] as const).some(
        (status) =>
          event.state[side].effects[status] !== previous[side].effects[status],
      ),
    );
    return { ...cue, type: "status", target: changed ?? event.side };
  }
  if (["cancel", "knockout", "prepare"].includes(event.kind))
    return {
      ...cue,
      type: event.kind as "status" | "cancel" | "knockout" | "prepare",
    };
  if (event.kind === "recovery") {
    const expired = (["player", "opponent"] as const).flatMap((side) =>
      (["exposed", "disrupt", "burn"] as const)
        .filter(
          (status) =>
            previous[side].effects[status] > 0 &&
            event.state[side].effects[status] === 0,
        )
        .map((status) => `${side} ${status} expired`),
    );
    if (expired.length)
      return { ...cue, type: "expiry", label: expired.join(" · ") };
  }
  return cue;
}

function impactCue(
  event: CombatEvent,
  previous: CombatState,
  cue: EventCue,
  side: Side,
): EventCue {
  if (event.message.includes("end-of-round burn"))
    return {
      ...cue,
      type: "burn",
      amount: previous[side].health - event.state[side].health,
    };
  if (event.message.includes("recoil:"))
    return {
      ...cue,
      type: "recoil",
      amount: previous[side].health - event.state[side].health,
    };
  const target = other(side),
    amount = previous[target].health - event.state[target].health;
  if (event.message.includes("dodges the basic hit"))
    return { ...cue, type: "dodge", target, label: "Dodge · 0 damage" };
  // Frozen rules/1 emits this exact mitigation grammar; it is replay-validated server text.
  const match = event.message.match(
    /: (\d+) damage; shield (\d+), decoy (\d+)\.$/,
  );
  const shield = match ? Number(match[2]) : 0,
    decoy = match ? Number(match[3]) : 0;
  return {
    ...cue,
    type: amount ? "hit" : decoy ? "decoy" : "block",
    target,
    amount,
    shield,
    decoy,
    label: amount
      ? `−${amount} HP${shield ? ` · shield ${shield}` : ""}${decoy ? ` · decoy ${decoy}` : ""}`
      : `Blocked · 0 HP${shield ? ` · shield ${shield}` : ""}${decoy ? ` · decoy ${decoy}` : ""}`,
  };
}
