"use client";
import { useState } from "react";
import { usePrivy, useWallets, getIdentityToken } from "@privy-io/react-auth";
import { WalletAdapterContext, type WalletAdapter } from "./WalletAdapter";
import { OfficialExperience } from "../identity/OfficialExperience";

export function PrivyWalletBridge({
  onMuseumChanged,
}: {
  onMuseumChanged: () => Promise<void>;
}) {
  const privy = usePrivy();
  const connected = useWallets();
  const [selection, setSelection] = useState("");
  const wallets = connected.wallets.filter(
    (wallet) => wallet.linked && wallet.type === "ethereum",
  );
  const selected =
    wallets.find((wallet) => wallet.address.toLowerCase() === selection) ??
    wallets[0];
  const adapter: WalletAdapter = {
    ready: privy.ready && connected.ready,
    authenticated: privy.authenticated,
    address: privy.authenticated ? (selected?.address.toLowerCase() ?? "") : "",
    wallets: wallets.map((wallet) => ({
      address: wallet.address.toLowerCase(),
      label: wallet.meta.name,
    })),
    selectWallet: setSelection,
    login: () => privy.login({ loginMethods: ["wallet"] }),
    logout: privy.logout,
    provider: async () => {
      if (!privy.authenticated || !selected)
        throw new Error(
          "Sign in with Privy and select a connected Ethereum wallet.",
        );
      return selected.getEthereumProvider();
    },
    headers: async () => {
      const access = await privy.getAccessToken();
      const identity = await getIdentityToken();
      if (!access || !identity)
        throw new Error(
          "Privy session or identity token unavailable. Sign in again; identity tokens must be enabled for this app.",
        );
      return { Authorization: `Bearer ${access}`, "privy-id-token": identity };
    },
  };
  return (
    <WalletAdapterContext value={adapter}>
      <OfficialExperience
        key={`${privy.user?.id ?? "anonymous"}:${adapter.address}`}
        onMuseumChanged={onMuseumChanged}
      />
    </WalletAdapterContext>
  );
}
