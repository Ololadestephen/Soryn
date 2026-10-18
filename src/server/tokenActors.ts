import { createHash } from "node:crypto";
import { tokenKey, type TokenIdentity } from "../domain/identity";

/**
 * Stable battle actor for one token: a UUIDv5-style SHA-1 derivation of the
 * token key. Battle records require UUID actors, while story progress rows
 * stay human-readable under `token:<key>`; both derive from the same key so
 * one token always maps to one official story slot and one battle actor.
 * Wallets never appear here: two tokens of one wallet map to two actors.
 */
const TOKEN_ACTOR_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
export function tokenActorUuid(
  identity: TokenIdentity,
  owner?: string,
): string {
  const namespace = Buffer.from(TOKEN_ACTOR_NAMESPACE.replace(/-/g, ""), "hex");
  const digest = createHash("sha1")
    .update(namespace)
    .update(
      `${tokenKey(identity)}${owner ? `:keeper:${owner.toLowerCase()}` : ""}`,
    )
    .digest();
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString("hex");
  return (
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-` +
    `${hex.slice(16, 20)}-${hex.slice(20, 32)}`
  );
}
