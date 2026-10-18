export const SANCTUARY_ACHIEVEMENT = {
  id: "fractured-sanctuary-complete",
  title: "Completed The Fractured Sanctuary",
  chainId: 143,
  contract: null as string | null,
} as const;

export interface ClaimAuthorization {
  recipient: string;
  achievement: typeof SANCTUARY_ACHIEVEMENT.id;
  chainId: 143;
  contract: string;
  claimId: string;
  completionId: string;
}

export type ClaimDecision =
  | { status: "unavailable"; reason: string }
  | { status: "rejected"; reason: string }
  | { status: "authorized"; authorization: ClaimAuthorization };

const ADDRESS = /^0x[0-9a-f]{40}$/;

/**
 * Local authorisation only. A null contract means claims are not offered.
 * The signature does not make the server's battle result trustless.
 */
export function authorizeSanctuaryClaim(
  input: {
    actor: string;
    progressActor: string;
    completed: boolean;
    completionId: string | null;
    recipient: string;
    chainId: number;
    claimId: string;
    usedClaimIds: ReadonlySet<string>;
  },
  deployedContract: string | null = SANCTUARY_ACHIEVEMENT.contract,
): ClaimDecision {
  if (!deployedContract)
    return {
      status: "unavailable",
      reason: "No achievement contract is deployed.",
    };
  if (input.actor !== input.progressActor)
    return {
      status: "rejected",
      reason: "Guest progress cannot be claimed by another session.",
    };
  if (!input.completed || !input.completionId)
    return { status: "rejected", reason: "The chapter is not complete." };
  if (input.chainId !== SANCTUARY_ACHIEVEMENT.chainId)
    return { status: "rejected", reason: "Wrong chain." };
  if (!ADDRESS.test(input.recipient) || !ADDRESS.test(deployedContract))
    return {
      status: "rejected",
      reason: "Recipient or contract is not an address.",
    };
  if (input.usedClaimIds.has(input.claimId))
    return { status: "rejected", reason: "This claim was already used." };
  return {
    status: "authorized",
    authorization: {
      recipient: input.recipient,
      achievement: SANCTUARY_ACHIEVEMENT.id,
      chainId: SANCTUARY_ACHIEVEMENT.chainId,
      contract: deployedContract,
      claimId: input.claimId,
      completionId: input.completionId,
    },
  };
}
