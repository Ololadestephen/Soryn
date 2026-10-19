"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { WalletAdapterContext } from "./WalletAdapter";

const SessionScope = createContext<(() => void) | null>(null);
const Provider = dynamic(() => import("./PrivyIdentity"), {
  ssr: false,
  loading: () => <p role="status">Loading wallet sign-in…</p>,
});

/** Activated by wallet pages, then retained by the root layout across navigation. */
export function WalletSession({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const activate = useCallback(() => setActive(true), []);
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  return (
    <SessionScope value={activate}>
      {active && appId ? (
        <Provider appId={appId}>{children}</Provider>
      ) : (
        children
      )}
    </SessionScope>
  );
}

/** Guest-only entry never activates Privy. A connection alone never grants access. */
export function WalletBoundary({ children }: { children: React.ReactNode }) {
  const activate = useContext(SessionScope);
  const wallet = useContext(WalletAdapterContext);
  useEffect(() => {
    if (!wallet) activate?.();
  }, [activate, wallet]);
  return wallet ? children : <p role="status">Loading wallet sign-in…</p>;
}
