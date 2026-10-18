import { character } from "../../domain/characters/definitions";
import { tokenKey } from "../../domain/identity";
import { seatIds, type PvpRoom, type SeatId } from "../../domain/pvp/types";
import type { PvpTimers } from "../../domain/pvp/timers";
import type { AuthService } from "../auth/service";
import type { Store } from "../persistence";
import { PvpStore } from "./persistence";
import { PvpService, type SeatOwnershipChange } from "./service";
import { TokenLocks } from "./locks";

async function confirmedHolders(
  auth: AuthService,
  room: PvpRoom,
): Promise<SeatId[]> {
  const bad: SeatId[] = [];
  for (const id of seatIds) {
    const sitting = room.seats[id];
    if (
      !sitting?.characterId ||
      (sitting.mode !== "official" && !!sitting.access) ||
      character(sitting.characterId).access !== "holder"
    )
      continue;
    const grant = sitting.holderGrant;
    if (sitting.mode !== "official" || !grant) {
      bad.push(id);
      continue;
    }
    const observed = await auth.ownership.fresh(grant.identity);
    auth.ownership.assertFresh(observed);
    if (
      observed.owner !== grant.owner ||
      observed.generation !== grant.generation
    )
      bad.push(id);
  }
  return bad;
}

export async function checkSeatOwnership(
  auth: AuthService,
  room: PvpRoom,
): Promise<SeatOwnershipChange[]> {
  const out: SeatOwnershipChange[] = [];
  const checks = await Promise.all(
    seatIds.map(async (id) => {
      const sitting = room.seats[id];
      const grant = sitting?.mode === "official" ? sitting.holderGrant : null;
      if (!grant) return null;
      const observed = await auth.ownership.fresh(grant.identity);
      return { id, grant, observed };
    }),
  );
  for (const check of checks) {
    if (!check) continue;
    const { id, grant, observed } = check;
    auth.ownership.assertFresh(observed);
    if (
      observed.owner !== grant.owner ||
      observed.generation !== grant.generation
    )
      out.push({
        seat: id,
        token: tokenKey(grant.identity),
        owner: observed.owner,
        generation: observed.generation,
      });
  }
  return out;
}

/** Queue recovery and room actions must use identical fresh-ownership gates. */
export function createOwnedPvpService(
  store: Store,
  auth: AuthService,
  timers: PvpTimers,
) {
  return new PvpService(
    new PvpStore(store),
    timers,
    undefined,
    (room) => confirmedHolders(auth, room),
    new TokenLocks(store),
    (room) => checkSeatOwnership(auth, room),
  );
}
