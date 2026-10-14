import { createHash } from "node:crypto";
import { z } from "zod";
import {
  addressSchema,
  blockSchema,
  CHAIN_ID,
  COLLECTION,
  type BlockReference,
} from "../../domain/identity";
import { ServiceError } from "../errors";

const CODE_SHA256 =
  "9c40522d5866b6d4fbc3774c37b66a45c2d1bca4ef0b6ccfe36b3789d255d1da";
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const hexSchema = z.string().regex(/^0x(?:[0-9a-fA-F]{2})*$/);
const wordSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const logSchema = z.object({
  address: addressSchema,
  topics: z.tuple([wordSchema, wordSchema, wordSchema, wordSchema]),
  data: z.literal("0x"),
  blockNumber: z.string().regex(/^0x[0-9a-f]+$/),
  blockHash: wordSchema,
  removed: z.literal(false),
});
const MAX_BLOCK_AGE_SECONDS = 30;
const OBSERVATION_TIMEOUT_MS = 12_000;
const LOG_WINDOW_BLOCKS = 100n;
const MAX_CONTINUITY_BLOCKS = 4_500n;

export interface ChainObservation {
  owner: string;
  block: BlockReference;
  changed: boolean;
  pendingTransfer: boolean;
  checkedAt: number;
}
export interface OwnershipReader {
  observe(
    tokenId: string,
    anchor: BlockReference | null,
  ): Promise<ChainObservation>;
  isContract(address: string): Promise<boolean>;
}
export type RpcCall = (method: string, params: unknown[]) => Promise<unknown>;

export function publicRpc(
  url = process.env.MONAD_RPC_URL ?? "https://rpc.monad.xyz",
): RpcCall {
  const endpoint = new URL(url);
  if (endpoint.protocol !== "https:") throw new Error("RPC must use HTTPS.");
  return async (method, params) => {
    try {
      const reply = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(5_000),
        cache: "no-store",
      });
      if (!reply.ok) throw new Error("RPC HTTP failure");
      const data = z
        .object({
          jsonrpc: z.literal("2.0"),
          id: z.literal(1),
          result: z.unknown(),
          error: z.unknown().optional(),
        })
        .parse(await reply.json());
      if (data.error !== undefined || data.result === undefined)
        throw new Error("RPC method failed");
      return data.result;
    } catch {
      throw new ServiceError(
        503,
        "Monad ownership evidence unavailable. No official write was authorized.",
      );
    }
  };
}

export class MonadReader implements OwnershipReader {
  constructor(
    private rpc: RpcCall = publicRpc(),
    private now = Date.now,
  ) {}
  async isContract(address: string): Promise<boolean> {
    return (
      hexSchema.parse(await this.rpc("eth_getCode", [address, "latest"])) !==
      "0x"
    );
  }
  private async block(tag: string): Promise<BlockReference> {
    return blockSchema.parse(
      await this.rpc("eth_getBlockByNumber", [tag, false]),
    );
  }
  private async call(data: string, block: BlockReference): Promise<string> {
    return wordSchema
      .parse(
        await this.rpc("eth_call", [{ to: COLLECTION, data }, block.number]),
      )
      .toLowerCase();
  }
  async observe(
    tokenId: string,
    anchor: BlockReference | null,
  ): Promise<ChainObservation> {
    const started = this.now();
    try {
      if ((await this.rpc("eth_chainId", [])) !== `0x${CHAIN_ID.toString(16)}`)
        throw new Error("Wrong chain");
      const finalized = await this.block("finalized");
      const latest = await this.block("latest");
      for (const block of [finalized, latest]) {
        const age = this.now() / 1000 - Number(BigInt(block.timestamp));
        if (age > MAX_BLOCK_AGE_SECONDS || age < -5)
          throw new Error("Stale block");
      }
      if (BigInt(finalized.number) > BigInt(latest.number))
        throw new Error("Inconsistent blocks");
      const code = hexSchema.parse(
        await this.rpc("eth_getCode", [COLLECTION, finalized.number]),
      );
      if (
        createHash("sha256")
          .update(Buffer.from(code.slice(2), "hex"))
          .digest("hex") !== CODE_SHA256
      )
        throw new Error("Allowlisted code changed");
      for (const [id, supported] of [
        ["01ffc9a7", true],
        ["80ac58cd", true],
        ["ffffffff", false],
      ] as const) {
        const value = await this.call(
          `0x01ffc9a7${id.padEnd(64, "0")}`,
          finalized,
        );
        if (BigInt(value) !== (supported ? 1n : 0n))
          throw new Error("Unsupported contract");
      }
      const data = `0x6352211e${BigInt(tokenId).toString(16).padStart(64, "0")}`;
      const ownerWord = await this.call(data, finalized);
      if (ownerWord.slice(2, 26) !== "0".repeat(24))
        throw new Error("Invalid owner encoding");
      const owner = addressSchema.parse(`0x${ownerWord.slice(26)}`);
      if (owner === `0x${"0".repeat(40)}`) throw new Error("No owner");
      const currentOwner = await this.call(data, latest);
      let changed = false;
      let from = BigInt(finalized.number) + 1n;
      if (anchor) {
        const distance = BigInt(finalized.number) - BigInt(anchor.number);
        if (distance < 0n || distance > MAX_CONTINUITY_BLOCKS) changed = true;
        else {
          const canonical = await this.block(anchor.number);
          changed = canonical.hash !== anchor.hash;
          if (!changed) from = BigInt(anchor.number) + 1n;
        }
      }
      const tokenTopic = `0x${BigInt(tokenId).toString(16).padStart(64, "0")}`;
      let pendingTransfer = currentOwner !== ownerWord;
      for (
        let start = from;
        start <= BigInt(latest.number);
        start += LOG_WINDOW_BLOCKS
      ) {
        if (this.now() - started > OBSERVATION_TIMEOUT_MS)
          throw new Error("Observation timed out");
        const end =
          start + LOG_WINDOW_BLOCKS - 1n < BigInt(latest.number)
            ? start + LOG_WINDOW_BLOCKS - 1n
            : BigInt(latest.number);
        const logs = z
          .array(logSchema)
          .max(1000)
          .parse(
            await this.rpc("eth_getLogs", [
              {
                address: COLLECTION,
                fromBlock: `0x${start.toString(16)}`,
                toBlock: `0x${end.toString(16)}`,
                topics: [TRANSFER_TOPIC, null, null, tokenTopic],
              },
            ]),
          );
        for (const log of logs) {
          const n = BigInt(log.blockNumber);
          if (
            log.address !== COLLECTION ||
            log.topics[0] !== TRANSFER_TOPIC ||
            log.topics[3] !== tokenTopic ||
            n < start ||
            n > end
          )
            throw new Error("Invalid transfer evidence");
          changed = true;
          if (n > BigInt(finalized.number)) pendingTransfer = true;
        }
      }
      for (const block of [finalized, latest]) {
        if ((await this.block(block.number)).hash !== block.hash)
          throw new Error("Snapshot changed during check");
      }
      if (this.now() - started > OBSERVATION_TIMEOUT_MS)
        throw new Error("Evidence exceeded freshness budget");
      return {
        owner,
        block: finalized,
        changed,
        pendingTransfer,
        checkedAt: this.now(),
      };
    } catch {
      throw new ServiceError(
        503,
        "Fresh, consistent Monad ownership evidence unavailable. Retry; guest play remains available.",
      );
    }
  }
}
