"use client";
import { Fragment, useEffect, useState, useRef } from "react";
import { usePrivy, useWallets, useIdentityToken } from "@privy-io/react-auth";
import { loginStage } from "./accessTelemetry";
import { WalletAdapterContext, type WalletAdapter } from "./WalletAdapter";

export function PrivyWalletBridge({ children }: { children: React.ReactNode }) {
  const privy = usePrivy();
  const connected = useWallets();
  const { identityToken } = useIdentityToken();
  const identity = useRef(identityToken);
  useEffect(() => {
    identity.current = identityToken;
  }, [identityToken]);
  const [selection, setSelection] = useState("");
  const wallets = connected.wallets.filter(
    (wallet) => wallet.linked && wallet.type === "ethereum",
  );
  const selected =
    wallets.find((wallet) => wallet.address.toLowerCase() === selection) ??
    wallets[0];
  const address = privy.authenticated
    ? (selected?.address.toLowerCase() ?? "")
    : "";
  useEffect(() => {
    if (privy.isModalOpen) loginStage("chooser-visible");
  }, [privy.isModalOpen]);
  const activeAddress = selected?.address;
  useEffect(() => {
    if (activeAddress && privy.authenticated) loginStage("wallet-selected");
  }, [activeAddress, privy.authenticated]);
  const adapter: WalletAdapter = {
    ready:
      privy.ready &&
      connected.ready &&
      (!privy.authenticated || !!identityToken),
    authenticated: privy.authenticated,
    address,
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
      // getIdentityToken() forces /users/me in this SDK. Reading its subscribed
      // token avoids refreshing Privy for every app request (and after signing).
      const proof = identity.current;
      if (!privy.authenticated || !access || !proof)
        throw new Error(
          "Privy session or identity token unavailable. Sign in again; identity tokens must be enabled for this app.",
        );
      return {
        Authorization: `Bearer ${access}`,
        "privy-id-token": proof,
        ...(selected
          ? { "x-soryn-wallet": selected.address.toLowerCase() }
          : {}),
      };
    },
  };
  return (
    <WalletAdapterContext value={adapter}>
      <Fragment key={`${privy.user?.id ?? "anonymous"}:${address}`}>
        {children}
      </Fragment>
    </WalletAdapterContext>
  );
}
