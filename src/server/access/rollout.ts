/** Fail closed until an operator explicitly approves this rollout. */
export function holderAccessEnabled() {
  return process.env.SORYN_HOLDER_ACCESS === "enabled";
}
export const HOLDER_ACCESS_PAUSED =
  "Holder access is paused. Practice and existing records remain available.";
