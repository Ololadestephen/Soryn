import { useState } from "react";
import { createRoot } from "react-dom/client";
import { PrivyWalletBridge } from "../../../src/components/auth/PrivyWalletBridge";
import { useWalletAdapter } from "../../../src/components/auth/WalletAdapter";
import {
  FixtureContext,
  setIdentityToken,
  identityRefreshCount,
  limitIdentityRefresh,
  type FixtureState,
} from "./mock";
function Consumer() {
  const adapter = useWalletAdapter();
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState("");
  async function run(action: "provider" | "headers") {
    try {
      setResult(JSON.stringify(await adapter[action]()));
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Unexpected failure");
    }
  }
  return (
    <>
      <output data-testid="address">{adapter.address}</output>
      <output data-testid="wallets">{JSON.stringify(adapter.wallets)}</output>
      <label htmlFor="fixture-wallet">Wallet</label>
      <select
        id="fixture-wallet"
        value={adapter.address}
        onChange={(event) => adapter.selectWallet(event.target.value)}
      >
        {adapter.wallets.map((wallet) => (
          <option key={wallet.address} value={wallet.address}>
            {wallet.label}
          </option>
        ))}
      </select>
      <label>
        Private draft
        <input value={draft} onChange={(e) => setDraft(e.target.value)} />
      </label>
      <button onClick={() => void run("provider")}>Get provider</button>
      <button onClick={() => void run("headers")}>Get headers</button>
      <output data-testid="result">{result}</output>
      <output data-testid="identity-refreshes">{identityRefreshCount()}</output>
    </>
  );
}
function Fixture() {
  const [state, setState] = useState<FixtureState>({
    authenticated: true,
    user: "one",
    access: "access-fixture",
    identity: "identity-fixture",
  });
  return (
    <FixtureContext value={state}>
      <button
        onClick={() =>
          setState({ ...state, authenticated: !state.authenticated })
        }
      >
        Toggle sign-in
      </button>
      <button
        onClick={() =>
          setState({ ...state, user: state.user === "one" ? "two" : "one" })
        }
      >
        Change user
      </button>
      <button onClick={() => setState({ ...state, access: null })}>
        Remove access token
      </button>
      <button
        onClick={() => {
          setIdentityToken(null);
          setState({ ...state, identity: null });
        }}
      >
        Remove identity token
      </button>
      <button onClick={limitIdentityRefresh}>Limit identity refresh</button>
      <PrivyWalletBridge>
        <Consumer />
      </PrivyWalletBridge>
    </FixtureContext>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
