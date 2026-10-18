import { tokenKey, type OfficialAuthority } from "../domain/identity";
import { seatIds } from "../domain/pvp/types";
import { PVP_TIMERS } from "../domain/pvp/timers";
import { BattleService } from "./combat/service";
import { BattleStore } from "./combat/persistence";
import type { Store } from "./persistence";
import { TokenLocks } from "./pvp/locks";
import { PvpStore } from "./pvp/persistence";
import { PvpService } from "./pvp/service";
import { QueueService } from "./pvp/queue";
import { StoryService } from "./story/service";

/** Freshly verified succession ends the previous reservation before a new owner can acquire it. */
export function reconcileParticipation(
  store: Store,
  authority: OfficialAuthority,
  now: number,
) {
  return store.transaction(() => {
    const locks = new TokenLocks(store);
    const token = tokenKey(authority.identity);
    const held = locks.get(token, now);
    if (
      !held ||
      (held.owner === authority.ownership.owner &&
        held.generation === authority.generation)
    )
      return;
    if (held.kind === "series") {
      const pvp = new PvpService(new PvpStore(store), PVP_TIMERS);
      const room = pvp.records.byReservation(held.encounter);
      if (!room) {
        locks.release(token, held.encounter);
        return;
      }
      const changes = seatIds
        .filter((seat) => {
          const grant = room.seats[seat]?.holderGrant;
          return (
            grant &&
            tokenKey(grant.identity) === token &&
            grant.generation === held.generation
          );
        })
        .map((seat) => ({
          seat,
          token,
          owner: authority.ownership.owner,
          generation: authority.generation,
        }));
      pvp.voidOnTransfer(room.invite, now, changes, room.revision);
    } else if (held.kind === "story") {
      const story = new StoryService(
        store,
        new BattleService(new BattleStore(store)),
        locks,
      );
      story.interruptReservation(
        held.encounter,
        held.generation,
        held.owner === authority.ownership.owner
          ? "generation-invalidated"
          : "ownership-changed",
        now,
      );
    } else {
      new QueueService(
        store,
        new PvpService(new PvpStore(store), PVP_TIMERS),
        locks,
      ).cancel(held.encounter, now);
    }
    locks.release(token, held.encounter);
  });
}
