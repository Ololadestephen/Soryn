import { CHAIN_ID } from "../../domain/identity";

export interface WalletProvider {
  request(input: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: () => void): void;
  removeListener?(event: string, listener: () => void): void;
}
export async function selectedWallet(
  wallet: WalletProvider,
  expectedAddress: string,
): Promise<string> {
  if (
    (await wallet.request({ method: "eth_chainId" })) !==
    `0x${CHAIN_ID.toString(16)}`
  )
    throw new Error(
      "Select Monad Mainnet (chain 143) in your wallet, then try again.",
    );
  const accounts = await wallet.request({ method: "eth_accounts" });
  if (
    !Array.isArray(accounts) ||
    !accounts.some(
      (account) =>
        typeof account === "string" &&
        account.toLowerCase() === expectedAddress.toLowerCase(),
    )
  )
    throw new Error(
      "The selected Privy wallet is disconnected or changed. Sign in again.",
    );
  return expectedAddress.toLowerCase();
}
export function hexMessage(message: string): string {
  return `0x${Array.from(new TextEncoder().encode(message), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
