import { describe, expect, it } from "vitest";
import {
  selectedWallet,
  hexMessage,
  type WalletProvider,
} from "../../src/components/identity/wallet";
const address = `0x${"1".repeat(40)}`;
function provider(chain: string, accounts: unknown): WalletProvider {
  return {
    request: async ({ method }) =>
      method === "eth_chainId" ? chain : accounts,
  };
}

describe("Privy-selected wallet boundary", () => {
  it("checks Monad and accepts only the explicitly selected connected account", async () => {
    expect(
      await selectedWallet(
        provider("0x8f", [`0x${"2".repeat(40)}`, address]),
        address,
      ),
    ).toBe(address);
    await expect(
      selectedWallet(provider("0x1", [address]), address),
    ).rejects.toThrow("Monad");
    await expect(
      selectedWallet(provider("0x8f", [`0x${"2".repeat(40)}`]), address),
    ).rejects.toThrow("disconnected or changed");
    await expect(
      selectedWallet(provider("0x8f", null), address),
    ).rejects.toThrow("disconnected or changed");
  });
  it("encodes the exact UTF-8 grant message without using a global injected provider", () => {
    const message = "Chog Déjà Vu";
    expect(
      Buffer.from(hexMessage(message).slice(2), "hex").toString("utf8"),
    ).toBe(message);
  });
});
