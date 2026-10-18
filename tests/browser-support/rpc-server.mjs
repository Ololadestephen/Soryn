import { CHOG_TOKEN } from "../../src/domain/chain/chogToken.ts";
import { importPKCS8, SignJWT } from "jose";
import { createServer } from "node:https";
import { readFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

// Test-only loopback fixture. These keys are disposable and never used on a real network.
const wallets = [
  privateKeyToAccount(generatePrivateKey()),
  privateKeyToAccount(generatePrivateKey()),
];
const jwtKey = await importPKCS8(
  readFileSync(process.env.CHOG_E2E_JWT_KEY, "utf8"),
  "ES256",
);
let ownerIndex = 0;
let height = 100;
let transfers = [];
let unavailable = false;
let tokenUnavailable = false;
let nftUnavailable = false;
let tokenBalances = [CHOG_TOKEN.threshold, CHOG_TOKEN.threshold];
const tokenContract = "0x350035555e10d9afaf1566aaebfced5ba6c27777";
const collection = "0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763";
const topic =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const tokenTopic = `0x${(276).toString(16).padStart(64, "0")}`;
const word = (n) => `0x${n.toString(16).padStart(64, "0")}`;
const code = readFileSync(
  new URL("../fixtures/chog-bytecode.txt", import.meta.url),
  "utf8",
).trim();
const block = (n) => ({
  number: `0x${n.toString(16)}`,
  hash: word(n),
  timestamp: `0x${Math.floor(Date.now() / 1000).toString(16)}`,
});
function move(index) {
  const from = wallets[ownerIndex].address.toLowerCase();
  ownerIndex = index;
  height++;
  transfers.push({
    address: collection,
    topics: [
      topic,
      `0x${from.slice(2).padStart(64, "0")}`,
      `0x${wallets[index].address.slice(2).toLowerCase().padStart(64, "0")}`,
      tokenTopic,
    ],
    data: "0x",
    blockNumber: block(height).number,
    blockHash: block(height).hash,
    removed: false,
  });
}
const server = createServer(
  {
    cert: readFileSync(process.env.CHOG_E2E_RPC_CERT),
    key: readFileSync(process.env.CHOG_E2E_RPC_KEY),
  },
  async (request, reply) => {
    reply.setHeader("Content-Type", "application/json");
    const send = (data) => reply.end(JSON.stringify(data));
    if (request.url === "/health") return send({ fixture: true });
    let bytes = "";
    for await (const chunk of request) {
      bytes += chunk;
      if (bytes.length > 4096) {
        reply.statusCode = 413;
        return send({ error: "too large" });
      }
    }
    try {
      if (request.url === "/control") {
        const command = JSON.parse(bytes);
        if (command.operation === "reset") {
          ownerIndex = 0;
          height = 100;
          transfers = [];
          unavailable = false;
          tokenUnavailable = false;
          nftUnavailable = false;
          tokenBalances = wallets.map(() => CHOG_TOKEN.threshold);
        }
        if (command.operation === "balance")
          tokenBalances[command.index] = BigInt(command.units);
        if (command.operation === "awayBack") {
          move(1);
          move(0);
        }
        if (command.operation === "transfer") move(command.owner);
        if (command.operation === "outage") unavailable = command.enabled;
        if (command.operation === "route-outage") {
          if (command.route === "token") tokenUnavailable = command.enabled;
          if (command.route === "nft") nftUnavailable = command.enabled;
        }
        return send({
          fixture: true,
          wallets: wallets.map((wallet) => wallet.address.toLowerCase()),
        });
      }
      if (request.url === "/privy") {
        const input = JSON.parse(bytes);
        if (
          !Number.isInteger(input.index) ||
          input.index < 0 ||
          input.index > 31
        )
          throw new Error("Unknown fixture wallet");
        // Independent synthetic principals keep account state isolated between scenarios.
        while (wallets.length <= input.index) {
          wallets.push(privateKeyToAccount(generatePrivateKey()));
          tokenBalances.push(CHOG_TOKEN.threshold);
        }
        const wallet = wallets[input.index];
        const sub = `did:privy:chog-fixture-${input.index}`;
        const signed = (claims) =>
          new SignJWT(claims)
            .setProtectedHeader({ alg: "ES256" })
            .setIssuer("privy.io")
            .setAudience(process.env.CHOG_E2E_APP_ID)
            .setSubject(sub)
            .setIssuedAt()
            .setExpirationTime("15m")
            .sign(jwtKey);
        return send({
          fixture: true,
          wallet: wallet.address.toLowerCase(),
          access: await signed({ sid: `fixture-session-${input.index}` }),
          identity: await signed({
            linked_accounts: JSON.stringify([
              {
                type: "wallet",
                chain_type: "ethereum",
                address: wallet.address,
              },
            ]),
          }),
        });
      }
      if (request.url === "/sign") {
        const input = JSON.parse(bytes);
        return send({
          signature: await wallets[input.index].signMessage({
            message: input.message,
          }),
        });
      }
      const { method, params, id } = JSON.parse(bytes);
      const target =
        method === "eth_getCode"
          ? params[0]
          : method === "eth_call"
            ? params[0]?.to
            : null;
      if (
        unavailable ||
        (tokenUnavailable && target?.toLowerCase() === tokenContract) ||
        (nftUnavailable && target?.toLowerCase() === collection)
      ) {
        reply.statusCode = 503;
        return send({ error: "Fixture outage" });
      }
      let result;
      if (method === "eth_chainId") result = "0x8f";
      else if (method === "eth_getBlockByNumber")
        result = block(
          params[0] === "finalized" || params[0] === "latest"
            ? height
            : Number(BigInt(params[0])),
        );
      else if (method === "eth_getCode")
        result =
          params[0].toLowerCase() === collection
            ? code
            : params[0].toLowerCase() === tokenContract
              ? "0x6000"
              : "0x";
      else if (method === "eth_call") {
        const data = params[0].data;
        if (
          params[0].to.toLowerCase() === tokenContract &&
          data === "0x313ce567"
        )
          result = word(18);
        else if (
          data.startsWith("0x70a08231") &&
          [tokenContract, collection].includes(params[0].to.toLowerCase())
        ) {
          const address = `0x${data.slice(-40)}`.toLowerCase();
          const index = wallets.findIndex(
            (wallet) => wallet.address.toLowerCase() === address,
          );
          result = word(
            params[0].to.toLowerCase() === tokenContract
              ? index < 0
                ? 0n
                : tokenBalances[index]
              : index === ownerIndex
                ? 1
                : 0,
          );
        } else if (data.startsWith("0x01ffc9a7"))
          result = data.slice(10, 18) === "ffffffff" ? word(0) : word(1);
        else if (data === `0x6352211e${tokenTopic.slice(2)}`)
          result = `0x${wallets[ownerIndex].address.slice(2).toLowerCase().padStart(64, "0")}`;
        else throw new Error("Unsupported token or call");
      } else if (method === "eth_getLogs")
        result = transfers.filter(
          (log) =>
            BigInt(log.blockNumber) >= BigInt(params[0].fromBlock) &&
            BigInt(log.blockNumber) <= BigInt(params[0].toBlock),
        );
      else throw new Error("Non-read-only RPC method forbidden");
      send({ jsonrpc: "2.0", id, result });
    } catch {
      send({
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32602, message: "Fixture request rejected" },
      });
    }
  },
);
server.listen(3200, "127.0.0.1", () =>
  process.stdout.write("Synthetic RPC fixture ready on loopback 3200.\n"),
);
