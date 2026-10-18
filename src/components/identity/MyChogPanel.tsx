"use client";
import Link from "next/link";
import { HolderCosmeticToggle } from "../auth/HolderCosmeticToggle";
import type { AccessView } from "../../domain/access/policy";
import type { WalletAdapter } from "../auth/WalletAdapter";

export function MyChogLinks() {
  return (
    <nav className="mychog-links" aria-label="Chog information">
      <Link prefetch={false} href="/help#access-wallets">
        How access works
      </Link>
      <Link prefetch={false} href="/explore">
        Explore Chogs
      </Link>
    </nav>
  );
}

export function MyChogEntry({
  ready,
  connect,
  message,
}: {
  ready: boolean;
  connect?: () => void;
  message?: string;
}) {
  return (
    <section className="mychog-entry panel" aria-labelledby="mychog-title">
      <h1 id="mychog-title">My Chog</h1>
      <p>Connect your wallet to view your fighters and holder perks.</p>
      <button disabled={!ready} onClick={connect}>
        Connect wallet
      </button>
      <p className="mychog-signing-note">
        Sign-in only. No transaction or spending approval.
      </p>
      {message && <p role="status">{message}</p>}
      <MyChogLinks />
    </section>
  );
}

export function MyChogPanel({
  wallet,
  view,
  busy,
  phase,
  error,
  signIn,
  recheck,
  signOut,
  equip,
  children,
}: {
  wallet: WalletAdapter;
  view: AccessView | null;
  busy: boolean;
  phase: "sign-in" | "holdings" | "sign-out" | null;
  error: string;
  signIn: () => Promise<void>;
  recheck: () => Promise<void>;
  signOut: () => Promise<void>;
  equip: (enabled: boolean) => Promise<void>;
  children?: React.ReactNode;
}) {
  const qualified =
    view?.status === "token" ||
    view?.status === "nft" ||
    view?.status === "both";
  const loading =
    phase === "sign-in"
      ? "Signing in to your wallet…"
      : phase === "holdings"
        ? "Verifying holdings…"
        : phase === "sign-out"
          ? "Signing out…"
          : !wallet.ready
            ? "Loading wallet sign-in…"
            : !view
              ? "Checking your session…"
              : "";
  if (!wallet.authenticated)
    return (
      <div className="mychog-page">
        <MyChogEntry
          ready={wallet.ready && !busy}
          connect={wallet.login}
          message={
            loading || (view?.status === "paused" ? view.message : undefined)
          }
        />
        {error && <p role="alert">{error}</p>}
      </div>
    );
  return (
    <div className="mychog-page">
      <section className="mychog-account panel" aria-labelledby="mychog-title">
        <div className="mychog-account-heading">
          <h1 id="mychog-title">My Chog</h1>
          <span className="mychog-wallet">
            Wallet{" "}
            {wallet.address
              ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`
              : "not selected"}
          </span>
        </div>
        {loading && <p role="status">{loading}</p>}
        {view?.authenticated ? (
          <p role="status">
            {qualified
              ? `Holder access unlocked · ${view.status === "token" ? "$CHOG verified" : view.status === "nft" ? "Chog NFT verified" : "$CHOG + Chog NFT"}`
              : view.message}
          </p>
        ) : (
          <p>Sign in to verify holdings and open your private records.</p>
        )}
        {wallet.wallets.length > 1 && (
          <label>
            Connected wallet
            <select
              value={wallet.address}
              onChange={(event) => wallet.selectWallet(event.target.value)}
              disabled={busy}
            >
              {wallet.wallets.map((entry) => (
                <option key={entry.address} value={entry.address}>
                  {entry.label} · {entry.address.slice(0, 6)}…
                  {entry.address.slice(-4)}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="button-row">
          {!view?.authenticated ? (
            <button
              disabled={busy || !wallet.address}
              onClick={() => void signIn()}
            >
              Sign in to wallet play
            </button>
          ) : (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void recheck()}
            >
              Refresh holdings
            </button>
          )}
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
        <MyChogLinks />
      </section>
      {view?.authenticated && (
        <>
          {qualified && (
            <section
              className="mychog-cosmetics panel"
              id="holder-cosmetics"
              aria-labelledby="cosmetics-title"
            >
              <h2 id="cosmetics-title">Your presentation</h2>
              {view.equipped && (
                <div className="holder-profile-frame">
                  <strong>Soryn player</strong>
                  <small>Private profile · holder frame equipped</small>
                </div>
              )}
              <HolderCosmeticToggle
                equipped={!!view.equipped}
                busy={busy}
                equip={equip}
              />
              <p>Cosmetic only. Your wallet and records stay private.</p>
            </section>
          )}
          {children}
        </>
      )}
    </div>
  );
}
