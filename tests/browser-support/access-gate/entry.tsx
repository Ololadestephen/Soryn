import { useState } from "react";
import { createRoot } from "react-dom/client";
import { useAccessController } from "../../../src/components/auth/useAccessController";
import { AccessGate } from "../../../src/components/auth/AccessGate";
import {
  WalletAdapterContext,
  type WalletAdapter,
} from "../../../src/components/auth/WalletAdapter";

import type { AccessFixtureDriver } from "./types";
let rejectPending: ((error: Error) => void) | null = null;
let finishSignature: (() => void) | null = null;
const driver: AccessFixtureDriver = {
  releaseSignature() {
    if (!finishSignature) throw Error("No fixture signature is pending");
    finishSignature();
    finishSignature = null;
  },
  rejectSignature() {
    if (!rejectPending) throw Error("No fixture signature is pending");
    rejectPending(new Error("Signature rejected by fixture user"));
    rejectPending = null;
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
  await new Promise<void>((resolve, reject) => {
    finishSignature = resolve;
    rejectPending = reject;
  });
  return "0xcomponent-fixture-signature";
}
function ControllerProbe() {
  const state = useAccessController(false);
  return (
    <>
      <button
        onClick={() => {
          void state.signIn();
          void state.signIn();
        }}
      >
        Start concurrent sign-in
      </button>
      <output>{state.phase}</output>
      <output>
        {state.view?.authenticated ? "authenticated" : "anonymous"}
      </output>
    </>
  );
}
function Fixture() {
  const [visible, setVisible] = useState(true);
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
      <button onClick={() => setVisible(false)}>Unmount sign-in view</button>
      {visible &&
        (new URLSearchParams(window.location.search).has("controller") ? (
          <ControllerProbe />
        ) : (
          <AccessGate
            profile={new URLSearchParams(window.location.search).has("profile")}
          >
            <output data-testid="private-progress">
              Private fixture progress
            </output>
          </AccessGate>
        ))}
    </WalletAdapterContext>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
