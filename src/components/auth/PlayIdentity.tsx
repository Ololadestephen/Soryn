"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import { WalletBoundary } from "./WalletSession";
import Link from "next/link";
import { AccessGate, useWalletPlay } from "./AccessGate";
import { WalletAdapterContext } from "./WalletAdapter";

const Mode = createContext<"guest" | "official">("guest");
export function PlayIdentity({
  official,
  holder = false,
  recordsOnly = false,
  children,
}: {
  official: boolean;
  holder?: boolean;
  recordsOnly?: boolean;
  children: React.ReactNode;
}) {
  if (!official && !holder) return children;
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId)
    return (
      <section className="panel">
        <h1>Chog access needs configuration</h1>
        <p>
          Practice remains available.{" "}
          <Link href="/start">Choose a guest mode</Link>
        </p>
      </section>
    );
  return (
    <WalletBoundary>
      <Mode value={official ? "official" : "guest"}>
        {holder && !official ? (
          <AccessGate recordsOnly={recordsOnly}>{children}</AccessGate>
        ) : (
          children
        )}
      </Mode>
    </WalletBoundary>
  );
}
export function usePlayIdentity() {
  const mode = useContext(Mode);
  const walletPlay = useWalletPlay();
  const adapter = useContext(WalletAdapterContext);
  const current = useRef(async () =>
    adapter?.authenticated && (mode === "official" || walletPlay)
      ? adapter.headers().then((headers) => ({
          ...headers,
          ...(walletPlay ? { "x-soryn-play": "wallet" } : {}),
        }))
      : {},
  );
  useEffect(() => {
    current.current = async () =>
      adapter?.authenticated && (mode === "official" || walletPlay)
        ? adapter.headers().then((headers) => ({
            ...headers,
            ...(walletPlay ? { "x-soryn-play": "wallet" } : {}),
          }))
        : {};
  }, [adapter, mode, walletPlay]);
  const headers = useCallback(() => current.current(), []);
  return { mode, headers, walletPlay };
}
