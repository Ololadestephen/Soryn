import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AccessGate } from "../../../src/components/auth/AccessGate";
import {
  WalletAdapterContext,
  type WalletAdapter,
} from "../../../src/components/auth/WalletAdapter";

import type { AccessFixtureDriver } from "./types";
let finishSignature: (() => void) | null = null;
const driver: AccessFixtureDriver = {
  releaseSignature() {
    if (!finishSignature) throw Error("No fixture signature is pending");
    finishSignature();
    finishSignature = null;
  },
  events: [],
};
window.accessFixture = driver;
async function fixtureRequest({ method }: { method: string }) {
  if (method === "eth_chainId") return "0x8f";
  if (method === "eth_accounts") return [`0x${"11".repeat(20)}`];
  if (method !== "personal_sign") throw Error("Unexpected fixture method");
  driver.events.push("signature-request");
  await new Promise<void>((resolve) => {
    finishSignature = resolve;
  });
  return "0xcomponent-fixture-signature";
}
function Fixture() {
  const [connected, setConnected] = useState(true);
  const adapter: WalletAdapter = {
    ready: true,
    authenticated: connected,
    address: connected ? `0x${"11".repeat(20)}` : "",
    wallets: [],
    selectWallet: () => {
      throw Error("This fixture exposes only one wallet");
    },
    login: () => setConnected(true),
    logout: async () => {
      window.accessFixture.events.push("provider-logout");
      setConnected(false);
    },
    headers: async () => ({
      Authorization: "Bearer labelled-component-fixture",
    }),
    provider: () => Promise.resolve({ request: fixtureRequest }),
  };
  return (
    <WalletAdapterContext value={adapter}>
      <AccessGate>
        <output data-testid="private-progress">Private fixture progress</output>
      </AccessGate>
    </WalletAdapterContext>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
