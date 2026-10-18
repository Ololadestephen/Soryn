"use client";
import { Fragment, useEffect, useState } from "react";
import { usePrivy, useWallets, getIdentityToken } from "@privy-io/react-auth";
import { loginStage } from "./accessTelemetry";
import { WalletAdapterContext, type WalletAdapter } from "./WalletAdapter";
import { OfficialExperience } from "../identity/OfficialExperience";

export function PrivyWalletBridge({
  onMuseumChanged,
  children,
}: {
  onMuseumChanged?: () => Promise<void>;
  children?: React.ReactNode;
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
  useEffect(() => {
    if (privy.isModalOpen) loginStage("chooser-visible");
  }, [privy.isModalOpen]);
  const activeAddress = selected?.address;
  useEffect(() => {
    if (activeAddress && privy.authenticated) loginStage("wallet-selected");
  }, [activeAddress, privy.authenticated]);
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
      return {
        Authorization: `Bearer ${access}`,
        "privy-id-token": identity,
        ...(selected
          ? { "x-soryn-wallet": selected.address.toLowerCase() }
          : {}),
      };
    },
  };
  return (
    <WalletAdapterContext value={adapter}>
      <Fragment key={`${privy.user?.id ?? "anonymous"}:${adapter.address}`}>
        {children ?? (
          <OfficialExperience
            key={`${privy.user?.id ?? "anonymous"}:${adapter.address}`}
            onMuseumChanged={onMuseumChanged ?? (async () => {})}
          />
        )}
      </Fragment>
    </WalletAdapterContext>
  );
}
