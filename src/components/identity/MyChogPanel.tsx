"use client";
import Link from "next/link";
import { HolderCosmeticToggle } from "../auth/HolderCosmeticToggle";
import type { AccessView } from "../../domain/access/policy";
import type { WalletAdapter } from "../auth/WalletAdapter";
import { accessProgress, type AccessPhase } from "../auth/walletSignIn";

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

function MyChogHeading() {
  return (
    <header className="mychog-heading">
      <h1 id="mychog-title">My Chog</h1>
      <p>Fighters, progress and private records.</p>
    </header>
  );
}
function MyChogNotice({
  message,
  error = "",
  cooldown = 0,
}: {
  message?: string;
  error?: string;
  cooldown?: number;
}) {
  if (cooldown > 0)
    return (
      <p className="mychog-notice is-error" role="alert">
        Too many requests. Try again in {cooldown} seconds.
      </p>
    );
  if (error)
    return (
      <p className="mychog-notice is-error" role="alert">
        {error}
      </p>
    );
  return message ? (
    <p className="mychog-notice" role="status">
      {message}
    </p>
  ) : null;
}
export function MyChogEntry({
  ready,
  connect,
  message,
  error,
  cooldown,
}: {
  ready: boolean;
  connect?: () => void;
  message?: string;
  error?: string;
  cooldown?: number;
}) {
  return (
    <>
      <MyChogHeading />
      <section className="mychog-entry panel" aria-labelledby="connect-title">
        <h2 id="connect-title">Connect your wallet</h2>
        <p>Open your collection and see what’s available to you.</p>
        <button onClick={connect} disabled={!ready}>
          Connect wallet
        </button>
        <p className="mychog-signing-note">
          Sign-in only. No transaction or spending approval.
        </p>
        <MyChogNotice message={message} error={error} cooldown={cooldown} />
      </section>
      <MyChogLinks />
    </>
  );
}

export function MyChogPanel({
  wallet,
  view,
  busy,
  phase,
  error,
  cooldown,
  signIn,
  recheck,
  signOut,
  equip,
  children,
}: {
  wallet: WalletAdapter;
  view: AccessView | null;
  busy: boolean;
  phase: AccessPhase;
  error: string;
  cooldown: number;
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
    accessProgress(phase) ||
    (!wallet.ready
      ? "Loading wallet sign-in…"
      : !view
        ? "Checking your session…"
        : "");
  if (!wallet.authenticated)
    return (
      <div className="mychog-page is-entry">
        <MyChogEntry
          ready={wallet.ready && !busy}
          connect={wallet.login}
          error={error}
          cooldown={cooldown}
          message={
            loading || (view?.status === "paused" ? view.message : undefined)
          }
        />
      </div>
    );
  return (
    <div
      className={`mychog-page${view?.authenticated ? " is-dashboard" : " is-entry"}`}
    >
      <MyChogHeading />
      <section
        className={`mychog-account panel${view?.authenticated ? " is-authenticated" : ""}`}
        aria-label="Wallet and access"
      >
        <div className="mychog-account-heading">
          <div className="mychog-wallet">
            <span className="mychog-wallet-label">Connected wallet</span>
            <span className="mychog-wallet-address">
              {wallet.address
                ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`
                : "Not selected"}
            </span>
          </div>
          <button
            className="mychog-signout"
            disabled={busy}
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
        {wallet.wallets.length > 1 && (
          <label className="mychog-wallet-select">
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
        <div className="mychog-account-main">
          <div className="mychog-account-copy">
            {view?.authenticated ? (
              <p className="mychog-access-status" role="status">
                Signed in.{" "}
                {qualified
                  ? `Holder access unlocked · ${view.status === "token" ? "$CHOG verified" : view.status === "nft" ? "Chog NFT verified" : "$CHOG + Chog NFT"}`
                  : view.message}
              </p>
            ) : (
              <>
                <h2>Finish signing in</h2>
                <p>Sign a message to open your fighters and private records.</p>
              </>
            )}
          </div>
          <div className="mychog-account-actions">
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
          </div>
          {!view?.authenticated && (
            <p className="mychog-signing-note">
              Sign-in only. No transaction or spending approval.
            </p>
          )}
        </div>
        <MyChogNotice message={loading} error={error} cooldown={cooldown} />
      </section>
      <MyChogLinks />
      {view?.authenticated && (
        <>
          {children}
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
        </>
      )}
    </div>
  );
}
