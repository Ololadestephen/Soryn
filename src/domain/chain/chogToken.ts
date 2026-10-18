/**
 * Official-site address for the CHOG token.
 * https://chog.xyz/ publishes 0x350035555E10d9AfAF1566AaebfCeD5BA6C27777 on Monad.
 * Decimals 18 independently verified by read-only Monad RPC on 18 October 2026.
 * User-approved threshold: 500 tokens. The server rollout remains fail-closed.
 */
const qualifyingTokens = 500;
const verifiedDecimals = 18;
export const CHOG_TOKEN = {
  chainId: 143,
  address: "0x350035555E10d9AfAF1566AaebfCeD5BA6C27777",
  decimals: verifiedDecimals,
  minimumTokens: qualifyingTokens,
  threshold: BigInt(qualifyingTokens) * 10n ** BigInt(verifiedDecimals),
  addressSource: "https://chog.xyz/",
  decimalsSource:
    "Read-only decimals() on Monad 143, verified 18 October 2026; https://www.chog.xyz/ publishes the address.",
} as const;

export function supporterStanding(balance: bigint, threshold: bigint | null) {
  if (threshold === null) return "unconfigured" as const;
  return balance >= threshold ? ("supporter" as const) : ("below" as const);
}
