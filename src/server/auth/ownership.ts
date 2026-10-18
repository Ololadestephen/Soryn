import { randomUUID } from "node:crypto";
import {
  tokenKey,
  type Ownership,
  type TokenIdentity,
} from "../../domain/identity";
import { ServiceError } from "../errors";
import { type OwnershipReader } from "../nft/rpc";
import { IdentityStore } from "./persistence";
import type { Store } from "../persistence";

// Share only an in-progress observation in this single-process installation.
// Completed results are never reused as fresh authorization evidence.
const observations = new WeakMap<Store, Map<string, Promise<Ownership>>>();
export const OWNERSHIP_REQUEST_MS = 12_000;

function sameObservation(
  left: Ownership | null,
  right: Ownership | null,
): boolean {
  if (!left || !right) return left === right;
  return (
    tokenKey(left.identity) === tokenKey(right.identity) &&
    left.generation === right.generation &&
    left.owner === right.owner &&
    left.checkedAt === right.checkedAt &&
    left.block.number === right.block.number &&
    left.block.hash === right.block.hash &&
    left.block.timestamp === right.block.timestamp
  );
}

export class OwnershipService {
  constructor(
    private records: IdentityStore,
    private chain: OwnershipReader,
    private now = Date.now,
  ) {}
  fresh(identity: TokenIdentity): Promise<Ownership> {
    let pending = observations.get(this.records.store);
    if (!pending) {
      pending = new Map();
      observations.set(this.records.store, pending);
    }
    const key = tokenKey(identity);
    const existing = pending.get(key);
    if (existing) return existing;
    const request = this.observeFresh(identity).finally(() => {
      if (pending.get(key) === request) pending.delete(key);
    });
    pending.set(key, request);
    return request;
  }
  private async observeFresh(identity: TokenIdentity): Promise<Ownership> {
    const previous = this.records.ownership(identity);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new ServiceError(
              503,
              "Ownership verification is unavailable: the observation timed out.",
            ),
          ),
        OWNERSHIP_REQUEST_MS,
      );
    });
    const observation = await Promise.race([
      this.chain.observe(identity.tokenId, previous?.block ?? null),
      timeout,
    ]).finally(() => clearTimeout(timer));
    return this.records.store.transaction(() => {
      const current = this.records.ownership(identity);
      if (!sameObservation(current, previous))
        throw new ServiceError(
          409,
          "Ownership check raced another request. Retry.",
        );
      const changed =
        observation.changed ||
        (!!previous && observation.owner !== previous.owner);
      const record: Ownership = {
        identity,
        owner: observation.owner,
        generation: !previous || changed ? randomUUID() : previous.generation,
        block: observation.block,
        checkedAt: observation.checkedAt,
      };
      this.records.saveOwnership(record);
      if (changed) this.records.revoke(identity);
      if (observation.pendingTransfer) {
        // Commit revocation before reporting an unsettled transfer; throwing here would roll it back.
        return { ...record, checkedAt: 0 };
      }
      return record;
    });
  }
  assertFresh(record: Ownership): void {
    const current = this.records.ownership(record.identity);
    if (
      record.checkedAt === 0 ||
      this.now() - record.checkedAt > 5_000 ||
      this.now() < record.checkedAt ||
      !sameObservation(current, record)
    )
      throw new ServiceError(
        503,
        "Ownership evidence changed, expired or has a pending transfer. Retry after finality.",
      );
  }
}
