import { z } from "zod";
import { createHash } from "node:crypto";
import { CHOG_TOKEN } from "../../domain/chain/chogToken";
import { CHAIN_ID, COLLECTION, addressSchema } from "../../domain/identity";
import { CHOG_MINIMUM } from "../../domain/access/policy";
import { ServiceError } from "../errors";
import { publicRpc, type RpcCall } from "../nft/rpc";

const MAX_BLOCK_AGE_MS = 30_000;
const MAX_CLOCK_SKEW_MS = 5_000;
const HOLDINGS_TIMEOUT_MS = 8_000;
const word = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
export interface HoldingEvidence {
  qualifies: boolean;
  block: string;
  checkedAt: number;
}
export interface HoldingReader {
  token(wallet: string): Promise<HoldingEvidence>;
  nft(wallet: string): Promise<HoldingEvidence>;
}
/** Read-only, integer-only evidence. The two qualification routes fail independently. */
export class MonadHoldings implements HoldingReader {
  constructor(
    private readonly rpc: RpcCall = publicRpc(),
    private readonly now = Date.now,
  ) {}
  private async observe(
    wallet: string,
    token: boolean,
    deadline: number,
  ): Promise<HoldingEvidence> {
    const rpc: RpcCall = async (method, params) => {
      if (Date.now() >= deadline)
        throw new ServiceError(503, "Holdings verification timed out.");
      const result = await this.rpc(method, params);
      if (Date.now() >= deadline)
        throw new ServiceError(503, "Holdings verification timed out.");
      return result;
    };
    const owner = addressSchema.parse(wallet);
    if (
      Number(BigInt(z.string().parse(await rpc("eth_chainId", [])))) !==
      CHAIN_ID
    )
      throw new ServiceError(503, "Holdings provider is on the wrong network.");
    const address = token ? CHOG_TOKEN.address : COLLECTION;
    if (
      token &&
      (CHOG_TOKEN.chainId !== CHAIN_ID || CHOG_TOKEN.decimals !== 18)
    )
      throw new ServiceError(
        503,
        "CHOG verification configuration is invalid.",
      );
    const head = z
      .object({
        number: z.string().regex(/^0x[0-9a-f]+$/),
        timestamp: z.string().regex(/^0x[0-9a-f]+$/),
      })
      .parse(await rpc("eth_getBlockByNumber", ["latest", false]));
    const age = this.now() - Number(BigInt(head.timestamp)) * 1000;
    if (age < -MAX_CLOCK_SKEW_MS || age > MAX_BLOCK_AGE_MS)
      throw new ServiceError(503, "Holdings block evidence is stale.");
    const block = head.number;
    const code = z
      .string()
      .regex(/^0x(?:[0-9a-fA-F]{2})+$/)
      .parse(await rpc("eth_getCode", [address, block]));
    if (
      !token &&
      createHash("sha256")
        .update(Buffer.from(code.slice(2), "hex"))
        .digest("hex") !==
        "9c40522d5866b6d4fbc3774c37b66a45c2d1bca4ef0b6ccfe36b3789d255d1da"
    )
      throw new ServiceError(
        503,
        "Collection bytecode does not match the verified allowlist.",
      );
    if (code.length <= 2)
      throw new ServiceError(503, "Holdings contract is unavailable.");
    if (token) {
      const decimals = word.parse(
        await rpc("eth_call", [{ to: address, data: "0x313ce567" }, block]),
      );
      if (BigInt(decimals) !== 18n)
        throw new ServiceError(503, "CHOG decimals changed or are invalid.");
    }
    const data = `0x70a08231${owner.slice(2).padStart(64, "0")}`;
    const balance = BigInt(
      word.parse(await rpc("eth_call", [{ to: address, data }, block])),
    );
    if (this.now() - Number(BigInt(head.timestamp)) * 1000 > MAX_BLOCK_AGE_MS)
      throw new ServiceError(
        503,
        "Holdings block evidence expired during verification.",
      );
    return {
      qualifies: balance >= (token ? CHOG_MINIMUM : 1n),
      block,
      checkedAt: this.now(),
    };
  }
  private async bounded(wallet: string, token: boolean) {
    const deadline = Date.now() + HOLDINGS_TIMEOUT_MS;
    // Two attempts share one hard deadline. A timed-out task cannot mint a grant.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        (async () => {
          try {
            return await this.observe(wallet, token, deadline);
          } catch {
            return this.observe(wallet, token, deadline);
          }
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new ServiceError(503, "Couldn't verify holdings. Try again."),
              ),
            HOLDINGS_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  token(wallet: string) {
    return this.bounded(wallet, true);
  }
  nft(wallet: string) {
    return this.bounded(wallet, false);
  }
}
