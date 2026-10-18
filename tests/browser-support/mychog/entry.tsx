import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MyChog } from "../../../src/components/identity/MyChog";
import {
  WalletAdapterContext,
  type WalletAdapter,
} from "../../../src/components/auth/WalletAdapter";
import type { MyChogFixture } from "./types";
const fixture: MyChogFixture = window.mychogFixture;
function Fixture() {
  const [connected, setConnected] = useState(fixture.connected ?? true);
  const adapter: WalletAdapter = {
    ready: true,
    authenticated: connected,
    address: connected ? fixture.wallet : "",
    wallets: [{ address: fixture.wallet, label: "Disposable fixture wallet" }],
    selectWallet() {
      throw Error("This fixture has one wallet");
    },
    login() {
      fixture.events.push("privy-login");
      setConnected(true);
    },
    logout() {
      fixture.events.push("privy-logout");
      setConnected(false);
      return Promise.resolve();
    },
    headers: () => Promise.resolve(fixture.headers),
    provider: () =>
      Promise.reject(
        Error("Real signatures are forbidden in this labelled UI fixture"),
      ),
  };
  return (
    <WalletAdapterContext value={adapter}>
      <p className="muted">
        Isolated wallet fixture · not a real holder session
      </p>
      <MyChog onMuseumChanged={() => Promise.resolve()} />
    </WalletAdapterContext>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
