import { expect, it } from "vitest";
import { combatSnapshot } from "../../src/domain/combat/definitions";
import { initialCombat, resolveRound } from "../../src/domain/combat/engine";
import { roundSchema } from "../../src/domain/combat/contracts";
import {
  eventCue,
  preparedShield,
} from "../../src/domain/combat/presentation/cues";
import { presentationFrames } from "../../src/domain/combat/presentation/project";
import { randomUUID } from "node:crypto";
import { Store } from "../../src/server/persistence";
import { BattleStore } from "../../src/server/combat/persistence";
import { BattleService } from "../../src/server/combat/service";
import { chooseOpponent } from "../../src/domain/combat/policy";
it("new typed cues and shields are independent of explanatory wording", () => {
  for (const [player, opponent, move, foe] of [
    ["pip", "aegis", "basic", "guard"],
    ["pip", "nyx", "basic", "guard"],
    ["ember", "pip", "special", "guard"],
  ] as const) {
    const snapshot = combatSnapshot(player, opponent),
      initial = initialCombat(snapshot);
    const result = resolveRound(snapshot, initial, move, foe);
    expect(result.round.eventFormat).toBe(2);
    roundSchema.parse(result.round);
    let previous = initial;
    for (const event of result.round.events) {
      const cue = eventCue(event, previous),
        rewritten = { ...event, message: "Narration changed completely." };
      expect({ ...eventCue(rewritten, previous), label: "" }).toEqual({
        ...cue,
        label: "",
      });
      if (event.kind === "prepare")
        expect(preparedShield(rewritten)).toBe(preparedShield(event));
      previous = event.state;
    }
  }
});
it("old rounds replay byte-for-byte and retain their presentation adapter alongside new rounds", () => {
  const store = new Store(":memory:");
  try {
    const service = new BattleService(new BattleStore(store)),
      actor = randomUUID(),
      id = randomUUID();
    service.start({ actor, id, player: "pip", opponent: "bolt" });
    const record = service.records.get(id, actor),
      pending = record.pending!;
    const legacy = resolveRound(
      record.snapshot,
      record.state,
      "guard",
      pending.move,
      pending.reason,
      1,
    );
    expect(legacy.round.eventFormat).toBeUndefined();
    expect(
      legacy.round.events.every((event) => event.detail === undefined),
    ).toBe(true);
    record.state = legacy.state;
    record.rounds = [legacy.round];
    record.pending = chooseOpponent(
      record.snapshot,
      legacy.state,
      record.rounds,
    );
    service.records.save(record);
    const restored = service.view(service.records.get(id, actor));
    expect(
      presentationFrames(restored, null).some((frame) =>
        frame.guarding.includes("player"),
      ),
    ).toBe(true);
    const next = service.step(actor, id, 2, "basic");
    expect(next.rounds[0]).toEqual(legacy.round);
    expect(next.rounds[1].eventFormat).toBe(2);
    expect(service.view(service.records.get(id, actor))).toEqual(next);
    const invalid = structuredClone(next.rounds[1]);
    delete invalid.events.find((event) => event.kind === "impact")!.detail;
    expect(roundSchema.safeParse(invalid).success).toBe(false);
  } finally {
    store.close();
  }
});
