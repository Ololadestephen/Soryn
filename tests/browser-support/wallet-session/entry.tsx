import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  WalletSession,
  WalletBoundary,
} from "../../../src/components/auth/WalletSession";
import { useWalletAdapter } from "../../../src/components/auth/WalletAdapter";
import { useAccessController } from "../../../src/components/auth/useAccessController";
import { providerMountCount } from "../privy-bridge/mock";

function Screen({ route }: { route: string }) {
  const adapter = useWalletAdapter();
  const access = useAccessController(route === "history");
  return (
    <>
      <h1>{route}</h1>
      <output data-testid="provider-mounts">{providerMountCount()}</output>
      <output data-testid="selected-wallet">{adapter.address}</output>
      <output data-testid="session">
        {access.view?.authenticated ? "Signed in" : "Recovering"}
      </output>
      <output data-testid="failure">{access.error}</output>
      <button onClick={() => adapter.selectWallet("0xbbbb")}>
        Select second fixture wallet
      </button>
    </>
  );
}
function Fixture() {
  const [route, setRoute] = useState("practice");
  return (
    <WalletSession>
      <nav>
        {[
          "character",
          "challenge",
          "match",
          "story",
          "history",
          "practice",
        ].map((r) => (
          <button key={r} onClick={() => setRoute(r)}>
            {r}
          </button>
        ))}
      </nav>
      {route === "practice" ? (
        <h1>Guest Practice</h1>
      ) : (
        <WalletBoundary>
          <Screen key={route} route={route} />
        </WalletBoundary>
      )}
    </WalletSession>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
