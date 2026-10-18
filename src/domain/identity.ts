import { z } from "zod";

export const COLLECTION = "0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763";
export const CHAIN_ID = 143;
export const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .transform((value) => value.toLowerCase());
export const tokenIdSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,77})$/)
  .pipe(
    z
      .string()
      .refine(
        (value) => BigInt(value) < 2n ** 256n,
        "Token ID exceeds uint256.",
      ),
  );
export const identitySchema = z.strictObject({
  chainId: z.literal(CHAIN_ID),
  collection: z.literal(COLLECTION),
  tokenId: tokenIdSchema,
});
export type TokenIdentity = z.infer<typeof identitySchema>;
export function identityFor(tokenId: string): TokenIdentity {
  return identitySchema.parse({
    chainId: CHAIN_ID,
    collection: COLLECTION,
    tokenId,
  });
}
export function tokenKey(identity: TokenIdentity): string {
  return `${identity.chainId}:${identity.collection}:${identity.tokenId}`;
}
/** Story progress row key for official play. Guest rows stay plain UUIDs. */
export function tokenStoryActor(
  identity: TokenIdentity,
  owner?: string,
): string {
  return `token:${tokenKey(identity)}${owner ? `:keeper:${addressSchema.parse(owner)}` : ""}`;
}
export const blockSchema = z.object({
  number: z.string().regex(/^0x[0-9a-f]+$/),
  hash: z.string().regex(/^0x[0-9a-f]{64}$/),
  timestamp: z.string().regex(/^0x[0-9a-f]+$/),
});
export type BlockReference = z.infer<typeof blockSchema>;
export const ownershipSchema = z.strictObject({
  identity: identitySchema,
  generation: z.uuid(),
  owner: addressSchema,
  block: blockSchema,
  checkedAt: z.number().int(),
});
export type Ownership = z.infer<typeof ownershipSchema>;
export const officialAuthoritySchema = z
  .strictObject({
    identity: identitySchema,
    generation: z.uuid(),
    ownership: ownershipSchema,
  })
  .refine(
    (authority) =>
      authority.generation === authority.ownership.generation &&
      tokenKey(authority.identity) === tokenKey(authority.ownership.identity),
    "Authority and ownership observation must match.",
  );
export type OfficialAuthority = z.infer<typeof officialAuthoritySchema>;
