import { randomUUID } from "node:crypto";
import { z } from "zod";
import { characters } from "../../domain/characters/definitions";
import {
  ACCESS_POLICY,
  ACCESS_FRESH_MS,
  STARTERS,
  PUBLIC_FIGHTERS,
  accessGrantSchema,
  type AccessGrant,
  type AccessView,
} from "../../domain/access/policy";
import { CHOG_TOKEN } from "../../domain/chain/chogToken";
import { COLLECTION } from "../../domain/identity";
import { addressSchema } from "../../domain/identity";
import { ServiceError } from "../errors";
import type { Store } from "../persistence";
import { readStored } from "../storedRecord";
import { MonadHoldings, type HoldingReader } from "./reader";

export interface WalletPlayer {
  actor: string;
  wallet: string;
  userId: string;
}
const storedSchema = z.strictObject({
  grant: accessGrantSchema,
  wallet: addressSchema,
});
const pendingByStore = new WeakMap<Store, Map<string, Promise<AccessGrant>>>();
export class Entitlements {
  constructor(
    readonly store: Store,
    private readonly reader: HoldingReader = new MonadHoldings(),
    private readonly now = Date.now,
    private readonly enabled = () =>
      process.env.SORYN_HOLDER_ACCESS === "enabled",
  ) {
    store.db.exec(
      "CREATE TABLE IF NOT EXISTS access_grants (actor TEXT PRIMARY KEY, record TEXT NOT NULL); CREATE TABLE IF NOT EXISTS player_cosmetics (actor TEXT PRIMARY KEY, equipped INTEGER NOT NULL DEFAULT 0)",
    );
  }
  stored(actor: string): AccessGrant | null {
    const row = this.store.db
      .prepare("SELECT record FROM access_grants WHERE actor=?")
      .get(actor);
    return row ? readStored(storedSchema, row.record).grant : null;
  }
  async resolve(player: WalletPlayer, force = false): Promise<AccessGrant> {
    if (!this.enabled())
      throw new ServiceError(
        503,
        "Holder access is paused. Practice and existing records remain available.",
      );
    const wallet = addressSchema.parse(player.wallet);
    const row = this.store.db
      .prepare("SELECT record FROM access_grants WHERE actor=?")
      .get(player.actor);
    const cached = row ? readStored(storedSchema, row.record) : null;
    if (
      !force &&
      cached?.wallet === wallet &&
      cached.grant.checkedAt <= this.now() &&
      cached.grant.admissionUntil > this.now()
    )
      return cached.grant;
    // In-flight deduplication only crosses requests to the same store/wallet.
    const key = `${player.actor}:${wallet}`;
    let pending = pendingByStore.get(this.store);
    if (!pending) {
      pending = new Map();
      pendingByStore.set(this.store, pending);
    }
    const existing = pending.get(key);
    if (existing) return existing;
    const work = this.observe(player, wallet).finally(() =>
      pending.delete(key),
    );
    pending.set(key, work);
    return work;
  }
  private async observe(
    player: WalletPlayer,
    wallet: string,
  ): Promise<AccessGrant> {
    const [token, nft] = await Promise.allSettled([
      this.reader.token(wallet),
      this.reader.nft(wallet),
    ]);
    const hasToken = token.status === "fulfilled" && token.value.qualifies;
    const hasNft = nft.status === "fulfilled" && nft.value.qualifies;
    if (!hasToken && !hasNft) {
      if (token.status === "rejected" || nft.status === "rejected")
        throw new ServiceError(503, "Couldn't verify holdings. Try again.");
      throw new ServiceError(
        403,
        "Hold at least 50 $CHOG or a Chog NFT to unlock.",
      );
    }
    const checkedAt = this.now();
    const grant: AccessGrant = {
      policy: ACCESS_POLICY,
      id: randomUUID(),
      actor: player.actor,
      kind: hasNft ? (hasToken ? "both" : "nft") : "token",
      checkedAt,
      admissionUntil: checkedAt + ACCESS_FRESH_MS,
      fighters: hasNft ? characters.map((c) => c.id) : [...PUBLIC_FIGHTERS],
      provenance: [
        ...(hasToken && token.status === "fulfilled"
          ? [
              {
                kind: "token" as const,
                chainId: 143 as const,
                contract: CHOG_TOKEN.address,
                block: token.value.block,
                checkedAt: token.value.checkedAt,
              },
            ]
          : []),
        ...(hasNft && nft.status === "fulfilled"
          ? [
              {
                kind: "nft" as const,
                chainId: 143 as const,
                contract: COLLECTION,
                block: nft.value.block,
                checkedAt: nft.value.checkedAt,
              },
            ]
          : []),
      ],
    };
    this.store.db
      .prepare(
        "INSERT INTO access_grants VALUES (?,?) ON CONFLICT(actor) DO UPDATE SET record=excluded.record",
      )
      .run(player.actor, JSON.stringify({ grant, wallet }));
    return grant;
  }
  async refreshActor(actor: string): Promise<AccessGrant> {
    const row = this.store.db
      .prepare("SELECT record FROM access_grants WHERE actor=?")
      .get(actor);
    if (!row)
      throw new ServiceError(
        403,
        "Both players need holder access before starting.",
      );
    const stored = readStored(storedSchema, row.record);
    return this.resolve(
      { actor, wallet: stored.wallet, userId: "server-bound" },
      true,
    );
  }
  async view(player: WalletPlayer, force = false): Promise<AccessView> {
    try {
      const grant = await this.resolve(player, force);
      return {
        authenticated: true,
        status: grant.kind,
        message: "Holder access unlocked",
        fighters: grant.fighters,
        checkedAt: grant.checkedAt,
        equipped: this.equipped(player.actor),
      };
    } catch (error) {
      if (!(error instanceof ServiceError)) throw error;
      return {
        authenticated: true,
        status: !this.enabled()
          ? "paused"
          : error.status === 403
            ? "practice-only"
            : "unavailable",
        message: error.message,
        fighters: [...STARTERS],
        checkedAt: null,
        equipped: this.equipped(player.actor),
      };
    }
  }
  equipped(actor: string) {
    return (
      this.store.db
        .prepare("SELECT equipped FROM player_cosmetics WHERE actor=?")
        .get(actor)?.equipped === 1
    );
  }
  async equip(player: WalletPlayer, equipped: boolean) {
    if (equipped) await this.resolve(player, true);
    this.store.db
      .prepare(
        "INSERT INTO player_cosmetics VALUES (?,?) ON CONFLICT(actor) DO UPDATE SET equipped=excluded.equipped",
      )
      .run(player.actor, equipped ? 1 : 0);
    return this.view(player);
  }
}
