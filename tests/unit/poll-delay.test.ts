import { describe, expect, it } from "vitest";
import { pollDelayMs } from "../../src/components/pvp/pollDelay";
import type { PvpView } from "../../src/domain/pvp/view";

function seated(
  phase: PvpView["phase"],
  move: PvpView["you"]["move"],
): PvpView {
  return {
    seated: true,
    phase,
    you: { move },
  } as PvpView;
}

describe("PvP poll cadence", () => {
  it("keeps the first guest session read on the slow cadence", () => {
    expect(pollDelayMs(undefined, null)).toBe(4000);
  });

  it("waits two seconds while it is your turn to choose", () => {
    expect(pollDelayMs("invite", seated("choose", null))).toBe(2000);
    expect(pollDelayMs("invite", { seated: false } as never)).toBe(2000);
  });

  it("polls every half second while a locked move or the clocks can change the room", () => {
    expect(pollDelayMs("invite", seated("choose", "basic"))).toBe(500);
    expect(pollDelayMs("invite", seated("present", null))).toBe(500);
    expect(pollDelayMs("invite", seated("loading", null))).toBe(500);
    expect(pollDelayMs("invite", seated("intermission", null))).toBe(500);
  });
});
