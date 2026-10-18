"use client";
import { PrivyProvider } from "@privy-io/react-auth";
import { defineChain } from "viem";
const monad = defineChain({
  id: 143,
  name: "Monad Mainnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.monad.xyz"] } },
  blockExplorers: {
    default: { name: "MonadVision", url: "https://monadvision.com" },
  },
});
import { PrivyWalletBridge } from "./PrivyWalletBridge";

export default function PrivyIdentity({
  appId,
  onMuseumChanged,
  children,
}: {
  appId: string;
  onMuseumChanged?: () => Promise<void>;
  children?: React.ReactNode;
}) {
  return (
    <PrivyProvider
      appId={appId}
      clientId={process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID || undefined}
      config={{
        loginMethods: ["wallet"],
        defaultChain: monad,
        supportedChains: [monad],
        embeddedWallets: { ethereum: { createOnLogin: "off" } },
        appearance: {
          theme: "dark",
          accentColor: "#e7bc72",
          walletChainType: "ethereum-only",
          landingHeader: "Sign in to Soryn",
        },
      }}
    >
      <PrivyWalletBridge onMuseumChanged={onMuseumChanged}>
        {children}
      </PrivyWalletBridge>
    </PrivyProvider>
  );
}
