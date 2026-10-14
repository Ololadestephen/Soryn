import { randomUUID } from "node:crypto";
import {
  tokenKey,
  type Ownership,
  type TokenIdentity,
} from "../../domain/identity";
import { ServiceError } from "../errors";
import { type OwnershipReader } from "../nft/rpc";
import { IdentityStore } from "./persistence";

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
  async fresh(identity: TokenIdentity): Promise<Ownership> {
    const previous = this.records.ownership(identity);
    const observation = await this.chain.observe(
      identity.tokenId,
      previous?.block ?? null,
    );
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
