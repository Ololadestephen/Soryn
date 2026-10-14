"use client";
import { CombatScreen } from "./Screen";
import { useWalletAdapter } from "../auth/WalletAdapter";

export function OfficialCombat() {
  const adapter = useWalletAdapter();
  return <CombatScreen mode="official" headers={adapter.headers} />;
}
