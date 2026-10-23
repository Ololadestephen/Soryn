import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi, afterEach } from "vitest";
import { MonadReader, publicRpc, type RpcCall } from "../../src/server/nft/rpc";
import { COLLECTION, type BlockReference } from "../../src/domain/identity";

const code = readFileSync(
  new URL("../fixtures/chog-bytecode.txt", import.meta.url),
  "utf8",
).trim();
const owner = "0x1111111111111111111111111111111111111111";
const topic =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const tokenTopic = `0x${(276).toString(16).padStart(64, "0")}`;
const now = Date.now();
const word = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;
function block(n: number): BlockReference {
  return {
    number: `0x${n.toString(16)}`,
    hash: word(n),
    timestamp: `0x${Math.floor(now / 1000).toString(16)}`,
  };
}
function transfer(n: number) {
  return {
    address: COLLECTION,
    topics: [topic, word(1), word(2), tokenTopic],
    data: "0x",
    blockNumber: block(n).number,
    blockHash: block(n).hash,
    removed: false,
  };
}
function fixture(
  overrides: Partial<Record<string, (params: unknown[]) => unknown>> = {},
) {
  const calls: { method: string; params: unknown[] }[] = [];
  const rpc: RpcCall = async (method, params) => {
    calls.push({ method, params });
    if (overrides[method]) return overrides[method](params);
    if (method === "eth_chainId") return "0x8f";
    if (method === "eth_getBlockByNumber")
      return params[0] === "finalized"
        ? block(100)
        : params[0] === "latest"
          ? block(110)
          : block(Number(BigInt(String(params[0]))));
    if (method === "eth_getCode") return params[0] === COLLECTION ? code : "0x";
    if (method === "eth_getLogs") return [];
    if (method === "eth_call") {
      const data = (params[0] as { data: string }).data;
      if (data.startsWith("0x01ffc9a7"))
        return data.slice(10, 18) === "ffffffff" ? word(0) : word(1);
      return `0x${owner.slice(2).padStart(64, "0")}`;
    }
    throw new Error(`Unexpected RPC method ${method}`);
  };
  return { reader: new MonadReader(rpc, () => now), calls };
}
afterEach(() => vi.unstubAllGlobals());

describe("read-only Monad adapter", () => {
  it("checks contract/interface, actual token encoding, canonical blocks and paged Transfer logs", async () => {
    const ctx = fixture();
    const result = await ctx.reader.observe("276", block(1));
    expect(result.owner).toBe(owner);
    expect(result.changed).toBe(false);
    expect(ctx.calls.some((call) => call.method.startsWith("eth_send"))).toBe(
      false,
    );
    const ownerCalls = ctx.calls.filter(
      (call) =>
        call.method === "eth_call" &&
        JSON.stringify(call.params).includes("6352211e"),
    );
    expect(
      ownerCalls.every((call) =>
        (call.params[0] as { data: string }).data.endsWith(tokenTopic.slice(2)),
      ),
    ).toBe(true);
    const ranges = ctx.calls
      .filter((call) => call.method === "eth_getLogs")
      .map(
        (call) =>
          call.params[0] as {
            fromBlock: string;
            toBlock: string;
            topics: unknown[];
          },
      );
    expect(ranges.length).toBe(2);
    for (const range of ranges) {
      expect(BigInt(range.toBlock) - BigInt(range.fromBlock)).toBeLessThan(
        100n,
      );
      expect(range.topics[3]).toBe(tokenTopic);
    }
  });
  it("detects away/back and self-transfers even when ownerOf matches the prior wallet", async () => {
    const ctx = fixture({ eth_getLogs: () => [transfer(96), transfer(98)] });
    const result = await ctx.reader.observe("276", block(90));
    expect(result.owner).toBe(owner);
    expect(result.changed).toBe(true);
    expect(result.pendingTransfer).toBe(false);
  });
  it("detects canonical checkpoint replacement and uncertain backward/long gaps", async () => {
    const ctx = fixture();
    expect(
      (await ctx.reader.observe("276", { ...block(90), hash: word(999) }))
        .changed,
    ).toBe(true);
    expect((await ctx.reader.observe("276", block(111))).changed).toBe(true);
    const long = fixture({
      eth_getBlockByNumber: (params) =>
        params[0] === "finalized"
          ? block(10_000)
          : params[0] === "latest"
            ? block(10_001)
            : block(Number(BigInt(String(params[0])))),
    });
    expect((await long.reader.observe("276", block(1))).changed).toBe(true);
    expect(
      long.calls.filter((call) => call.method === "eth_getLogs"),
    ).toHaveLength(1);
  });
  it("marks unfinalized logs and differing latest ownership as unsettled", async () => {
    expect(
      (
        await fixture({ eth_getLogs: () => [transfer(108)] }).reader.observe(
          "276",
          block(90),
        )
      ).pendingTransfer,
    ).toBe(true);
    const ctx = fixture({
      eth_call: (params) => {
        const data = (params[0] as { data: string }).data;
        if (data.startsWith("0x01ffc9a7"))
          return data.slice(10, 18) === "ffffffff" ? word(0) : word(1);
        return params[1] === block(100).number
          ? `0x${owner.slice(2).padStart(64, "0")}`
          : `0x${"2".repeat(40).padStart(64, "0")}`;
      },
    });
    expect((await ctx.reader.observe("276", block(90))).pendingTransfer).toBe(
      true,
    );
  });
  it("fails closed on wrong chain/code/interface, stale blocks, invalid owners/logs and RPC errors", async () => {
    const variants = [
      { eth_chainId: () => "0x1" },
      { eth_getCode: () => "0x6000" },
      { eth_call: () => word(0) },
      { eth_call: () => word(1) },
      { eth_getBlockByNumber: () => ({ ...block(100), timestamp: "0x1" }) },
      { eth_getLogs: () => [{ ...transfer(96), removed: true }] },
      {
        eth_getLogs: () => [
          { ...transfer(96), topics: [topic, word(1), word(2), word(1737)] },
        ],
      },
      {
        eth_getLogs: () => [
          { ...transfer(96), blockNumber: block(500).number },
        ],
      },
      {
        eth_getLogs: () => {
          throw new Error("RPC limit exceeded");
        },
      },
    ];
    for (const overrides of variants)
      await expect(
        fixture(overrides).reader.observe("276", block(90)),
      ).rejects.toMatchObject({ status: 503 });
  });
  it("rejects a block replacement during an in-flight observation", async () => {
    const ctx = fixture({
      eth_getBlockByNumber: (params) =>
        params[0] === "finalized"
          ? block(100)
          : params[0] === "latest"
            ? block(110)
            : { ...block(Number(BigInt(String(params[0])))), hash: word(999) },
    });
    await expect(ctx.reader.observe("276", null)).rejects.toMatchObject({
      status: 503,
    });
  });
  it("maps public RPC HTTP, JSON-RPC and transport errors to unavailable evidence", async () => {
    expect(() => publicRpc("http://unsafe.example")).toThrow("HTTPS");
    for (const reply of [
      new Response("{}", { status: 413 }),
      Response.json({ jsonrpc: "2.0", id: 1, error: { code: -1 } }),
      Response.json({ jsonrpc: "2.0", id: 2, result: "0x8f" }),
    ]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => reply),
      );
      await expect(publicRpc()("eth_chainId", [])).rejects.toMatchObject({
        status: 503,
      });
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await expect(publicRpc()("eth_chainId", [])).rejects.toMatchObject({
      status: 503,
    });
  });
  it.skipIf(process.env.MONAD_LIVE_READ !== "1")(
    "independently verifies the implemented adapter against real Monad read-only RPC",
    async () => {
      const reader = new MonadReader();
      const observation = await reader.observe("276", null);
      expect(observation.owner).toMatch(/^0x[0-9a-f]{40}$/);
      expect(observation.pendingTransfer).toBe(false);
      const again = await reader.observe("276", observation.block);
      expect(again.owner).toBe(observation.owner);
      mkdirSync("docs/evidence", { recursive: true });
      writeFileSync(
        "docs/evidence/identity-adapter-live.json",
        JSON.stringify(
          {
            checkedAt: new Date().toISOString(),
            endpoint: "https://rpc.monad.xyz",
            tokenId: "276",
            observations: [observation, again],
            readOnly: true,
          },
          null,
          2,
        ) + "\n",
      );
    },
    45_000,
  );
});

describe("wallet-code provider failure boundary", () => {
  it("classifies malformed provider code as unavailable, never invalid client input", async () => {
    const reader = new MonadReader(async () => "malformed-code");
    await expect(reader.isContract(owner)).rejects.toMatchObject({
      status: 503,
    });
  });
});
