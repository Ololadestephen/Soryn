import { character } from "../../domain/characters/definitions";
import {
  sides,
  type BattleView,
  type CombatState,
  type Side,
} from "../../domain/combat/contracts";
import { type CombatPresentation } from "./playback";
import { difficultyLabel } from "../../domain/combat/difficulty/contracts";
import { MoveEffect } from "./MoveEffect";
import { eventCue } from "../../domain/combat/presentation/cues";
import { Fragment } from "react";
import { RenderedArt, CompanionArt } from "./rendered/RenderedArt";
import { fighterPose } from "./rendered/pose";
import { atlases, renderedFighters } from "./rendered/assets";
import type { CSSProperties } from "react";
import { ArenaBackdrop } from "./ArenaBackdrop";
import { ImpactFeedback } from "./ImpactFeedback";

const effectHelp: Record<string, { name: string; rule: string }> = {
  exposed: { name: "Exposed", rule: "Armour −3; prepared shield −4." },
  disrupt: {
    name: "Special sealed",
    rule: "Cannot select special while active.",
  },
  burn: { name: "Burn", rule: "3 HP at each remaining round end." },
  decoy: { name: "Decoy", rule: "Remaining hit absorption; not health." },
  focus: { name: "Prepared", rule: "Bonus power on the next basic." },
};

function FighterStatus({
  battle,
  state,
  side,
  frame,
  rival,
}: {
  battle: BattleView;
  state: CombatState;
  side: Side;
  frame: CombatPresentation | null;
  rival: string;
}) {
  const self = state[side],
    identity = character(battle.snapshot[side].id);
  const effects = Object.entries(self.effects).filter(
    ([, duration]) => duration > 0,
  );
  return (
    <div className={`combat-status status-${side}`}>
      <h3>
        {identity.name}{" "}
        <small>{side === "player" ? "· You" : `· ${rival}`}</small>
      </h3>
      <div className="health-row">
        <span>Health</span>
        <strong>
          {self.health} / {battle.snapshot[side].health}
        </strong>
      </div>
      <progress
        aria-label={`${side} health`}
        value={self.health}
        max={battle.snapshot[side].health}
      />
      <p
        className={
          frame && self.energy > frame.previous[side].energy
            ? "energy-gained"
            : ""
        }
      >
        Energy {self.energy}/6 ·{" "}
        <span aria-label={`Special cooldown: ${self.cooldown} rounds`}>
          Cooldown {self.cooldown}
        </span>
      </p>
      <ul className="status-list" aria-label={`${side} public effects`}>
        {effects.length ? (
          effects.map(([effect, duration]) => (
            <li key={effect} title={effectHelp[effect].rule}>
              {effectHelp[effect].name}: {duration}
              {effect === "decoy" || effect === "focus" ? " power" : " rounds"}
            </li>
          ))
        ) : (
          <li>No status effects</li>
        )}
      </ul>
    </div>
  );
}
export function Arena({
  battle,
  state,
  presentation,
  rival = "Computer",
  matchLabel,
}: {
  battle: BattleView;
  state: CombatState;
  presentation: CombatPresentation | null;
  rival?: string;
  matchLabel?: string;
}) {
  const event = presentation?.event;
  const sourceLimit = Math.min(
    ...sides.map((side) =>
      Math.max(
        ...atlases[renderedFighters[battle.snapshot[side].id].fighter].canvas,
      ),
    ),
  );
  const cue =
    presentation?.cue ??
    (presentation ? eventCue(presentation.event, presentation.previous) : null);
  return (
    <div
      className="combat-arena"
      style={{ "--fighter-limit": `${sourceLimit}px` } as CSSProperties}
    >
      <ArenaBackdrop arena={battle.arena ?? "sanctuary"} />
      <div className="combat-scoreboard">
        {sides.map((side) => (
          <FighterStatus
            key={side}
            battle={battle}
            state={state}
            side={side}
            frame={presentation}
            rival={rival}
          />
        ))}
      </div>
      <span className="arena-round">
        {matchLabel ?? difficultyLabel(battle.snapshot)} ·{" "}
        {state.outcome && !presentation
          ? `${battle.rounds.length} resolved rounds`
          : `Round ${Math.min(state.round, 20)} / 20`}
      </span>
      <div className="combat-field">
        <ImpactFeedback
          key={presentation?.id ?? "no-contact"}
          frame={presentation}
        />
        <div className="arena-floor" aria-hidden="true" />
        {sides.map((side) => {
          const identity = battle.snapshot[side].id;
          const damaged =
            !!presentation &&
            state[side].health < presentation.previous[side].health;
          const healing =
            event?.kind === "heal" &&
            event.side === side &&
            presentation?.phase === "impact";
          const acting = event?.side === side;
          const attack = acting && presentation?.phase === "action";
          const defending =
            acting &&
            event?.kind === "prepare" &&
            (event.move === "guard" ||
              (event.move === "special" &&
                ["aegis", "patch"].includes(identity)));
          const companionPhase =
            acting &&
            event?.move === "special" &&
            presentation?.phase !== "information"
              ? (presentation?.phase ?? "idle")
              : "idle";
          return (
            <Fragment key={side}>
              <div
                className={`arena-fighter fighter-${side} fighter-style-${identity} phase-${presentation?.phase ?? "idle"} ${acting ? `move-${event.move} visual-${presentation?.treatment?.key ?? "none"}` : ""}${presentation?.approach === side ? " combat-melee" : ""}${attack && presentation?.treatment?.delivery === "ranged" ? " combat-ranged" : ""}${acting && presentation?.phase === "anticipation" ? " combat-anticipate" : ""}${cue?.type === "dodge" && cue.target === side ? " combat-dodge" : ""}${damaged ? " combat-hit" : ""}${healing ? " combat-heal" : ""}${defending ? " combat-defend" : ""}${state[side].health === 0 ? " combat-ko" : ""}`}
              >
                <div className="fighter-facing">
                  <div
                    className="fighter-motion"
                    key={attack ? presentation?.id : "stance"}
                  >
                    <RenderedArt
                      id={identity}
                      pose={fighterPose(state, presentation, side)}
                    />
                  </div>
                </div>
                {presentation?.guarding.includes(side) &&
                  state[side].health > 0 && (
                    <span
                      className={`combat-shield shield-${identity}`}
                      aria-hidden="true"
                    />
                  )}
                {attack && presentation?.treatment && (
                  <MoveEffect
                    key={`${presentation.id}:delivery`}
                    treatment={presentation.treatment}
                    hit={presentation.hit}
                  />
                )}
                {cue?.target === side &&
                  !["none", "prepare"].includes(cue.type) &&
                  presentation?.phase !== "action" &&
                  presentation?.phase !== "anticipation" && (
                    <span
                      key={`${presentation?.id}:number`}
                      className={`combat-number cue-${cue.type}`}
                      data-event-id={presentation?.id}
                      aria-hidden="true"
                    >
                      {cue.type === "heal"
                        ? `+${cue.amount} HP`
                        : cue.type === "counter"
                          ? `Counter −${cue.amount} HP`
                          : cue.type === "burn"
                            ? `Burn −${cue.amount} HP`
                            : cue.type === "recoil"
                              ? `Recoil −${cue.amount} HP`
                              : cue.label}
                    </span>
                  )}
                {damaged && (
                  <span
                    key={
                      presentation?.id ??
                      `${event?.message}:${state[side].health}`
                    }
                    className="combat-impact"
                    aria-hidden="true"
                  >
                    ✦
                  </span>
                )}
                {healing && presentation?.treatment && (
                  <MoveEffect
                    key={`${presentation.id}:heal`}
                    treatment={presentation.treatment}
                  />
                )}
                {!!presentation?.bonuses?.length && acting && (
                  <span className="combat-bonus" aria-hidden="true">
                    {presentation.bonuses
                      .map((bonus) => `${bonus.label} +${bonus.power} power`)
                      .join(" · ")}
                  </span>
                )}
                {healing && (
                  <span className="combat-recovery" aria-hidden="true">
                    +
                  </span>
                )}
                {!!state[side].effects.decoy && (
                  <div className="combat-decoy" aria-hidden="true">
                    <RenderedArt id="echo" />
                    <span>Decoy {state[side].effects.decoy}</span>
                  </div>
                )}
                {!!state[side].effects.exposed && (
                  <span className="combat-mark" aria-hidden="true">
                    ◎
                  </span>
                )}
                {!!state[side].effects.disrupt && (
                  <span className="combat-disrupt" aria-hidden="true">
                    ϟ
                  </span>
                )}
                {!!state[side].effects.burn && (
                  <span className="combat-burn" aria-hidden="true">
                    ♨
                  </span>
                )}
              </div>
              <div
                className={`arena-companion companion-side-${side} pet-phase-${companionPhase}`}
                key={`${side}:${attack ? presentation?.id : "pet"}`}
              >
                <div className="companion-facing">
                  <CompanionArt
                    id={identity}
                    phase={companionPhase}
                    hit={presentation?.hit}
                    settled={state[side].health === 0}
                  />
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
