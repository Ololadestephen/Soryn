"use client";
import { createContext, useContext } from "react";
import type { WalletProvider } from "../identity/wallet";

export interface WalletAdapter {
  ready: boolean;
  authenticated: boolean;
  address: string;
  wallets: { address: string; label: string }[];
  selectWallet(address: string): void;
  login(): void;
  logout(): Promise<void>;
  provider(): Promise<WalletProvider>;
  headers(): Promise<Record<string, string>>;
}
export const WalletAdapterContext = createContext<WalletAdapter | null>(null);
export function useWalletAdapter(): WalletAdapter {
  const adapter = useContext(WalletAdapterContext);
  if (!adapter) throw new Error("Privy wallet context unavailable.");
  return adapter;
}
