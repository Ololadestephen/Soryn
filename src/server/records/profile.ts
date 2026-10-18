import { identitySchema, type TokenIdentity } from "../../domain/identity";
import type { OwnershipService } from "../auth/ownership";
import { ServiceError } from "../errors";
import {
  TokenRecords,
  type PublicTokenRecord,
  type TokenRecordSummary,
} from "./tokenRecords";

export interface TokenOwnershipView {
  status: "verified" | "unavailable";
  owner: string | null;
  checkedAt: number | null;
}

export interface TokenProfile {
  identity: TokenIdentity;
  ownership: TokenOwnershipView;
  records: PublicTokenRecord[];
  summary: TokenRecordSummary;
}

export class TokenProfileService {
  constructor(
    private readonly records: TokenRecords,
    private readonly ownership: OwnershipService,
  ) {}
  /**
   * Assemble the public profile for one token. Ownership is checked fresh
   * against the chain on every read; an outage or unsettled transfer shows
   * the ownership-unavailable state instead of a stale claim. Record rows
   * never carry the wallet attribution stored internally.
   */
  async profile(identity: TokenIdentity): Promise<TokenProfile> {
    identitySchema.parse(identity);
    let ownership: TokenOwnershipView = {
      status: "unavailable",
      owner: null,
      checkedAt: null,
    };
    try {
      const observed = await this.ownership.fresh(identity);
      this.ownership.assertFresh(observed);
      ownership = {
        status: "verified",
        owner: observed.owner,
        checkedAt: observed.checkedAt,
      };
    } catch (error) {
      if (!(error instanceof ServiceError)) throw error;
    }
    return {
      identity,
      ownership,
      records: this.records.published(identity),
      summary: this.records.summary(identity, true),
    };
  }
}
