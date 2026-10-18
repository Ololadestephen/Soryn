import { describe, expect, it } from "vitest";
import { authorizeSanctuaryClaim } from "../../src/domain/chain/achievement";
import {
  CHOG_TOKEN,
  supporterStanding,
} from "../../src/domain/chain/chogToken";
import { CHAIN_ID, COLLECTION } from "../../src/domain/identity";

const claim = {
  actor: "11111111-1111-4111-8111-111111111111",
  progressActor: "11111111-1111-4111-8111-111111111111",
  completed: true,
  completionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  recipient: "0x1111111111111111111111111111111111111111",
  chainId: 143,
  claimId: "claim-1",
  usedClaimIds: new Set<string>(),
};
const contract = "0x2222222222222222222222222222222222222222";

describe("chain references", () => {
  it("keeps the Genesis collection and uses the approved 50-token threshold", () => {
    expect(CHAIN_ID).toBe(143);
    expect(COLLECTION).toBe("0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763");
    expect(CHOG_TOKEN.address).toBe(
      "0x350035555E10d9AfAF1566AaebfCeD5BA6C27777",
    );
    expect(CHOG_TOKEN.decimals).toBe(18);
    expect(CHOG_TOKEN.threshold).toBe(50n * 10n ** 18n);
    expect(supporterStanding(10n ** 18n, null)).toBe("unconfigured");
    expect(supporterStanding(2n, 1n)).toBe("supporter");
    expect(supporterStanding(1n, 2n)).toBe("below");
  });

  it("rejects the wrong session, chain and a repeated claim, and stays hidden without a contract", () => {
    expect(authorizeSanctuaryClaim(claim).status).toBe("unavailable");
    expect(
      authorizeSanctuaryClaim(
        { ...claim, progressActor: "22222222-2222-4222-8222-222222222222" },
        contract,
      ).status,
    ).toBe("rejected");
    expect(
      authorizeSanctuaryClaim({ ...claim, chainId: 1 }, contract).status,
    ).toBe("rejected");
    const first = authorizeSanctuaryClaim(claim, contract);
    expect(first.status).toBe("authorized");
    if (first.status !== "authorized") return;
    expect(first.authorization.achievement).toBe(
      "fractured-sanctuary-complete",
    );
    expect(
      authorizeSanctuaryClaim(
        { ...claim, usedClaimIds: new Set([claim.claimId]) },
        contract,
      ).status,
    ).toBe("rejected");
  });
});
