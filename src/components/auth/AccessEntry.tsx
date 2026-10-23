"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CHOG_REQUIREMENT } from "../../domain/access/policy";
import type { useAccessController } from "./useAccessController";
import { accessProgress } from "./walletSignIn";
import { loginStage } from "./accessTelemetry";

export function AccessEntry({
  controller: c,
  usable,
}: {
  controller: ReturnType<typeof useAccessController>;
  usable: boolean;
}) {
  const path = usePathname() ?? "";
  const title = path.startsWith("/match")
    ? "Find a Match"
    : path.startsWith("/challenge")
      ? "Challenge a Friend"
      : path === "/story"
        ? "Story"
        : "Wallet play";
  const signedIn = !!c.view?.authenticated;
  const recovering = !c.wallet.ready;
  return (
    <div className="access-entry">
      <header className="access-entry-heading">
        <div>
          <h1>{title}</h1>
        </div>
        {c.wallet.authenticated && (
          <button
            className="access-quiet"
            disabled={c.busy}
            onClick={() => void c.signOut()}
          >
            Sign out
          </button>
        )}
      </header>
      <p className="access-requirement">
        {CHOG_REQUIREMENT}. No tokens are spent.
      </p>
      {!recovering &&
        !c.busy &&
        c.view?.message &&
        c.view.message !== "Connect wallet" && (
          <p className="access-notice" role="status">
            {c.view.message}
          </p>
        )}
      <div className="access-primary">
        <button
          disabled={
            recovering ||
            c.busy ||
            (c.wallet.authenticated && !c.wallet.address)
          }
          onClick={() => {
            if (!c.wallet.authenticated) {
              loginStage("connect-click");
              c.wallet.login();
            } else if (!signedIn) void c.signIn();
            else void c.recheck();
          }}
        >
          {accessProgress(c.phase) ||
            (recovering
              ? "Checking your session…"
              : !c.wallet.authenticated
                ? "Connect wallet"
                : !signedIn
                  ? "Sign in to wallet play"
                  : "Check holdings again")}
        </button>
        <Link href="/arena">Play Practice</Link>
      </div>
      {c.cooldown > 0 ? (
        <p className="access-notice" role="alert">
          Too many requests. Try again in {c.cooldown} seconds.
        </p>
      ) : (
        c.error && (
          <p className="access-notice" role="alert">
            {c.error}
          </p>
        )
      )}
      <details className="access-options">
        <summary>Account & saved progress</summary>
        {c.wallet.authenticated && c.wallet.wallets.length > 1 && (
          <label>
            Connected wallet
            <select
              value={c.wallet.address}
              disabled={c.busy}
              onChange={(e) => c.wallet.selectWallet(e.target.value)}
            >
              {c.wallet.wallets.map((w) => (
                <option key={w.address} value={w.address}>
                  {w.label} · {w.address.slice(0, 6)}…{w.address.slice(-4)}
                </option>
              ))}
            </select>
          </label>
        )}
        <nav aria-label="Wallet records">
          <Link href="/history">Existing browser history</Link>
          <Link href="/character">My Chog & NFT competitors</Link>
          <Link href="/help#access-wallets">How access works</Link>
        </nav>
        {!usable && (
          <button className="secondary" onClick={() => c.setReadRecords(true)}>
            View existing saved progress
          </button>
        )}
      </details>
    </div>
  );
}
