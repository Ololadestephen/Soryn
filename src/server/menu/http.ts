import { protectWalletActor } from "../access/boundary";
import { NextRequest } from "next/server";
import { z } from "zod";
import type { PlayMenuState } from "../../domain/navigation";
import { invitationExpired, seatOf } from "../../domain/pvp/types";
import { identityRuntime } from "../auth/runtime";
import { BattleStore } from "../combat/persistence";
import { BattleService } from "../combat/service";
import { failure, response } from "../httpShared";
import type { Store } from "../persistence";
import { PvpStore } from "../pvp/persistence";
import { StoryService } from "../story/service";
/** A stored-state summary: never settles clocks, queues players or creates battles. */
export function menuState(
  store: Store,
  actor: string | null,
  now: number,
): PlayMenuState {
  if (!actor) return { story: "begin", matchInvite: null, practice: false };
  const battles = new BattleStore(store);
  const story = new StoryService(store, new BattleService(battles)).state(
    actor,
  );
  const room = new PvpStore(store).roomsFor(actor).find((room) => {
    const seat = seatOf(room, actor);
    return (
      !!seat &&
      room.seats[seat]?.mode === "guest" &&
      !room.closedAt &&
      !invitationExpired(room, now) &&
      room.series?.phase !== "complete"
    );
  });
  return {
    story:
      story.step === "ending"
        ? "ending"
        : story.step === "meet"
          ? "begin"
          : "continue",
    matchInvite: room?.invite ?? null,
    practice: battles
      .history(actor, "guest")
      .some(
        (battle) =>
          !battle.state.outcome &&
          battle.origin !== "story" &&
          battle.id !== story.battleId,
      ),
  };
}
export function getMenu(request: NextRequest) {
  try {
    const { store } = identityRuntime();
    const guest = z.uuid().safeParse(request.cookies.get("chog_guest")?.value);
    const actor = guest.success ? guest.data : null;
    if (actor) protectWalletActor(store, actor);
    store.rateLimit(
      actor ? `read:${actor}` : "read:anonymous-guest",
      Date.now(),
      actor ? 90 : 120,
    );
    return response(menuState(store, actor, Date.now()));
  } catch (error) {
    return failure(error);
  }
}
