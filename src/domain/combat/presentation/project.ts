import { combatBonuses } from "../bonuses";
import { initialCombat } from "../engine";
import type {
  BattleView,
  CombatEvent,
  CombatState,
  Side,
  ResolvedRound,
} from "../contracts";
import { moveTreatments, type MoveTreatment } from "./moves";
import { eventCue, type EventCue } from "./cues";
export interface CombatPresentation {
  event: CombatEvent;
  previous: CombatState;
  approach: Side | null;
  guarding: Side[];
  id?: string;
  phase?: "anticipation" | "action" | "impact" | "recovery" | "information";
  cue?: EventCue;
  treatment?: MoveTreatment;
  hit?: number;
  sourceIndex?: number;
  round?: number;
  bonuses?: { label: string; power: number }[];
}
interface Projection {
  battle: BattleView;
  round: ResolvedRound;
  before: CombatState;
  displayBefore: CombatState;
  approach: Side | null;
  guarding: Side[];
  launched: Partial<Record<Side, CombatState>>;
  shield: Record<Side, number>;
  hits: Record<Side, number>;
  frames: CombatPresentation[];
}
function append(
  c: Projection,
  event: CombatEvent,
  index: number,
  phase: NonNullable<CombatPresentation["phase"]>,
  cue: EventCue,
  treatment?: MoveTreatment,
) {
  const attackBonus =
    phase === "impact" &&
    event.side &&
    event.move &&
    ["hit", "block", "decoy"].includes(cue.type);
  c.frames.push({
    event,
    previous: c.displayBefore,
    approach: c.approach,
    guarding: [...c.guarding],
    id: `${c.battle.id}:${c.round.round}:${index}:${phase}`,
    phase,
    cue,
    treatment,
    hit: event.side ? c.hits[event.side] : 0,
    sourceIndex: index,
    round: c.round.round,
    bonuses: attackBonus
      ? combatBonuses(
          c.battle.snapshot,
          c.launched[event.side!] ?? c.before,
          event.side!,
          event.move!,
          c.round[event.side === "player" ? "opponent" : "player"],
        )
      : [],
  });
  c.displayBefore = event.state;
}
function updateDefence(c: Projection, event: CombatEvent, cue: EventCue) {
  if (event.kind === "return" || event.kind === "cancel") c.approach = null;
  const prepared =
    event.kind === "prepare" &&
    event.side &&
    (event.move === "guard" ||
      (event.move === "special" &&
        ["patch", "aegis"].includes(c.battle.snapshot[event.side].id)));
  if (prepared) {
    c.guarding.push(event.side!);
    c.shield[event.side!] = Number(
      event.message.match(/(\d+) shield prepared/)?.[1] ?? 0,
    );
  }
  if (cue.target && cue.shield) {
    c.shield[cue.target] = Math.max(0, c.shield[cue.target] - cue.shield);
    if (c.shield[cue.target] === 0)
      c.guarding = c.guarding.filter((side) => side !== cue.target);
  }
  if (event.kind === "recovery" || event.kind === "result") c.guarding = [];
}
function leadImpact(
  c: Projection,
  event: CombatEvent,
  index: number,
  cue: EventCue,
  treatment?: MoveTreatment,
) {
  if (["hit", "block", "dodge", "decoy"].includes(cue.type) && event.side) {
    c.hits[event.side]++;
    if (c.hits[event.side] > 1) {
      if (treatment?.delivery === "melee") c.approach = event.side;
      append(
        c,
        {
          ...event,
          state: c.before,
          message: `${c.battle.snapshot[event.side].moves[event.move!].name} · hit ${c.hits[event.side]}`,
        },
        index,
        "action",
        { ...cue, amount: 0, label: `Hit ${c.hits[event.side]}` },
        treatment,
      );
    }
  }
  if (event.kind === "counter") {
    c.approach = event.side;
    append(
      c,
      { ...event, state: c.before, message: "Counter responding" },
      index,
      "action",
      { ...cue, amount: 0 },
      treatment,
    );
  }
}
function projectEvent(c: Projection, event: CombatEvent, index: number) {
  let treatment =
    event.side && event.move
      ? moveTreatments[c.battle.snapshot[event.side].id][event.move]
      : undefined;
  const cue = eventCue(event, c.before);
  if (event.kind === "heal" && treatment)
    treatment = { ...treatment, delivery: "heal" };
  if (event.kind === "melee" || event.kind === "ranged") {
    if (event.side) c.launched[event.side] = event.state;
    append(c, event, index, "anticipation", cue, treatment);
    if (event.kind === "melee") c.approach = event.side;
    append(c, event, index, "action", cue, treatment);
  } else {
    if (event.kind === "heal" && event.move === "special") {
      const lead = { ...event, state: c.before };
      append(c, lead, index, "anticipation", { ...cue, amount: 0 }, treatment);
      append(c, lead, index, "action", { ...cue, amount: 0 }, treatment);
    }
    updateDefence(c, event, cue);
    leadImpact(c, event, index, cue, treatment);
    const phase =
      event.kind === "return" || event.kind === "recovery"
        ? "recovery"
        : ["impact", "heal", "counter"].includes(event.kind)
          ? "impact"
          : "information";
    append(c, event, index, phase, cue, treatment);
    if (event.kind === "counter") {
      c.approach = null;
      append(
        c,
        { ...event, kind: "return" },
        index,
        "recovery",
        { ...cue, type: "none", amount: 0 },
        treatment,
      );
    }
  }
  c.before = event.state;
}
export function presentationFrames(
  battle: BattleView,
  previous: BattleView | null,
): CombatPresentation[] {
  const round = battle.rounds.at(-1);
  if (
    !round ||
    (previous?.id === battle.id &&
      (battle.rounds.length <= previous.rounds.length ||
        battle.rounds.length > previous.rounds.length + 1))
  )
    return [];
  const before =
    previous?.id === battle.id
      ? previous.state
      : battle.rounds.length > 1
        ? battle.rounds.at(-2)!.events.at(-1)!.state
        : initialCombat(battle.snapshot);
  const c: Projection = {
    battle,
    round,
    before,
    displayBefore: before,
    approach: null,
    guarding: [],
    launched: {},
    shield: { player: 0, opponent: 0 },
    hits: { player: 0, opponent: 0 },
    frames: [],
  };
  round.events.forEach((event, index) => projectEvent(c, event, index));
  return c.frames;
}
export const frameDuration = {
  anticipation: 160,
  action: 260,
  impact: 500,
  recovery: 180,
  information: 200,
} as const;
