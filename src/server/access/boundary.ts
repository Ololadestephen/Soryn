import { holderAccessEnabled, HOLDER_ACCESS_PAUSED } from "./rollout";
import { readStored } from "../storedRecord";
import type { NextRequest } from "next/server";
import type { AuthService } from "../auth/service";
import type { PrivyVerifier } from "../auth/privy";
import type { Store } from "../persistence";
import { ServiceError } from "../errors";
import { Entitlements, type WalletPlayer } from "./service";
import { WalletAccessAuth, walletPlay } from "./auth";
import type { HoldingReader } from "./reader";
import type { PvpRoom } from "../../domain/pvp/types";
import {
  accessGrantSchema,
  HOLDER_QUALIFICATION_MESSAGE,
  type AccessGrant,
} from "../../domain/access/policy";

export function requireAdmissionsOpen() {
  if (!holderAccessEnabled()) throw new ServiceError(503, HOLDER_ACCESS_PAUSED);
}
/** A client-selected guest UUID must never impersonate an authenticated wallet account. */
export function protectWalletActor(store: Store, actor: string) {
  const exists = store.db
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='wallet_accounts'",
    )
    .get();
  if (
    exists &&
    store.db.prepare("SELECT 1 FROM wallet_accounts WHERE actor=?").get(actor)
  )
    throw new ServiceError(
      401,
      "This history requires its authenticated wallet session.",
    );
}
export class AccessBoundary {
  readonly entitlements: Entitlements;
  private readonly login: WalletAccessAuth | null;
  constructor(
    readonly store: Store,
    origin: string,
    auth?: AuthService,
    verifier?: PrivyVerifier,
    reader?: HoldingReader,
  ) {
    this.entitlements = new Entitlements(store, reader);
    this.login =
      auth && verifier
        ? new WalletAccessAuth(store, auth, verifier, origin)
        : null;
  }
  async player(request: NextRequest): Promise<WalletPlayer | null> {
    if (!walletPlay(request)) return null;
    if (!this.login)
      throw new ServiceError(503, "Wallet access is not configured.");
    return this.login.player(request);
  }
  async admit(player: WalletPlayer | null): Promise<AccessGrant> {
    requireAdmissionsOpen();
    if (!player)
      throw new ServiceError(
        403,
        `${HOLDER_QUALIFICATION_MESSAGE} Practice remains available.`,
      );
    return this.entitlements.resolve(player, true);
  }
  /** Refresh only at the first start. Intermissions retain the encounter grant. */
  async refreshRoom(room: PvpRoom): Promise<Map<string, AccessGrant>> {
    const grants = new Map<string, AccessGrant>();
    if (room.match || room.series?.phase === "intermission") return grants;
    requireAdmissionsOpen();
    for (const seat of Object.values(room.seats)) {
      if (!seat) continue;
      if (seat.mode === "official") continue; // Existing fresh generation gate remains authoritative.
      if (!seat.access)
        throw new ServiceError(
          403,
          "Both players need holder access before starting. Saved results remain available.",
        );
      grants.set(seat.actor, await this.entitlements.refreshActor(seat.actor));
    }
    return grants;
  }
  /** Offer acceptance is a new admission, unlike a poll of an already started series. */
  async refreshOffer(actor: string) {
    const row = this.store.db
      .prepare("SELECT offer_id FROM pvp_queue WHERE actor=?")
      .get(actor);
    if (!row?.offer_id) return;
    const rows = this.store.db
      .prepare("SELECT actor,access_grant FROM pvp_queue WHERE offer_id=?")
      .all(row.offer_id);
    for (const seat of rows) {
      if (!seat.access_grant) continue;
      readStored(accessGrantSchema, seat.access_grant);
      const grant = await this.entitlements.refreshActor(String(seat.actor));
      this.store.db
        .prepare(
          "UPDATE pvp_queue SET access_grant=? WHERE actor=? AND offer_id=?",
        )
        .run(JSON.stringify(grant), seat.actor, row.offer_id);
    }
  }
}
