import type { CharacterId } from "../../domain/characters/definitions";

/** Player-facing summaries of the existing kits; exact rules stay in details. */
export const fighterPlaystyles: Record<CharacterId, string> = {
  pip: "Keep your distance. Expose the opponent, then punish low energy with precise shots.",
  bolt: "Strike first. Pair quick jabs with a two-hit delivery, then guard to recharge.",
  patch:
    "Prepare, repair, retaliate. Guard builds your next shot; your beetle helps you stay in the fight.",
  moss: "Outlast the rush. Heal while guarding and clear harmful effects with your companion.",
  aegis:
    "Hold your ground. Absorb pressure, counter through your guard and bash with your armadillo.",
  nyx: "Get the first cut. Dodge a basic attack with your guard and pierce armour with your panther.",
  echo: "Make them hit the decoy. Follow up with your fox’s two-hit volley.",
  prism:
    "Find a weakness. Expose armour with your peacock, then follow with glass darts.",
  atlas:
    "Take the hit. Guard to build power and commit to a slow, heavy companion strike.",
  flux: "Interrupt the plan. Seal the next special, then deal extra damage to a disrupted foe.",
  ember:
    "Trade safety for pressure. Your phoenix burns hard, but the attack costs your own health.",
  mneme:
    "Read their habits. Repeated moves strengthen your next attack and your raven’s special.",
};
