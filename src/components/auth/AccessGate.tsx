"use client";
import { createContext, useContext } from "react";
import Link from "next/link";
import Image from "next/image";
import { CHOG_REQUIREMENT, type AccessView } from "../../domain/access/policy";
import { HolderCosmeticToggle } from "./HolderCosmeticToggle";
import { MyChogPanel } from "../identity/MyChogPanel";

import { useAccessController } from "./useAccessController";
import { loginStage } from "./accessTelemetry";
import { accessProgress } from "./walletSignIn";

const WalletPlay = createContext(false);
const AccessState = createContext<AccessView | null>(null);
export function useWalletPlay() {
  return useContext(WalletPlay);
}
export function useAccessState() {
  return useContext(AccessState);
}
export function AccessGate({
  children,
  recordsOnly = false,
  profile = false,
}: {
  children: React.ReactNode;
  recordsOnly?: boolean;
  profile?: boolean;
}) {
  const {
    wallet,
    view,
    phase,
    error,
    busy,
    cooldown,
    saved,
    readRecords,
    setReadRecords,
    signIn,
    recheck,
    equip,
    signOut,
  } = useAccessController(recordsOnly);
  const qualified =
    view?.status === "token" ||
    view?.status === "nft" ||
    view?.status === "both";
  const signedIn = !!view?.authenticated;
  const usable = qualified || saved || (recordsOnly && signedIn) || readRecords;
  if (profile)
    return (
      <AccessState value={view}>
        <WalletPlay value={signedIn}>
          <MyChogPanel
            wallet={wallet}
            view={view}
            busy={busy}
            phase={phase}
            error={error}
            cooldown={cooldown}
            signIn={signIn}
            recheck={recheck}
            signOut={signOut}
            equip={equip}
          >
            {children}
          </MyChogPanel>
        </WalletPlay>
      </AccessState>
    );
  return (
    <AccessState value={view}>
      <WalletPlay value={signedIn}>
        <section
          className={`holder-access${usable ? " is-compact" : ""}`}
          aria-label="Soryn access"
        >
          {(busy || !view) && (
            <p role="status">
              {accessProgress(phase) ||
                (!wallet.ready
                  ? "Loading wallet sign-in…"
                  : "Checking your session…")}
            </p>
          )}
          {qualified ? (
            <details>
              <summary>
                Holder access unlocked ·{" "}
                {view.status === "token"
                  ? "$CHOG"
                  : view.status === "nft"
                    ? "Chog NFT"
                    : "$CHOG + Chog NFT"}
              </summary>
              {view.equipped && (
                <div className="holder-profile-frame">
                  <Image
                    src="/brand/soryn-icon.svg"
                    width={48}
                    height={48}
                    alt=""
                  />
                  <div>
                    <strong>Soryn player</strong>
                    <span className="holder-badge">
                      {view.status === "token"
                        ? "$CHOG holder"
                        : view.status === "nft"
                          ? "Chog NFT holder"
                          : "$CHOG + NFT holder"}
                    </span>
                    <small>Private profile · cosmetic frame</small>
                  </div>
                </div>
              )}
              <p>
                Wallet play keeps player records. For token-bound competitor
                history,{" "}
                <Link href="/character">select your Chog in My Chog</Link>.
              </p>
              <HolderCosmeticToggle
                equipped={!!view.equipped}
                busy={busy}
                equip={equip}
              />
              <p>
                Applied to your presentation. This does not publish your
                profile, wallet or results.
              </p>
            </details>
          ) : (
            <>
              <h2>Holder access</h2>
              {view?.message && view.message !== "Connect wallet" && (
                <p>{view.message}</p>
              )}
              <p>
                When holder access is open, {CHOG_REQUIREMENT} unlocks Story and
                player battles. No tokens are spent.
              </p>
              <div className="button-row">
                <Link className="button" href="/arena">
                  Play Practice
                </Link>
                {!wallet.authenticated ? (
                  <button
                    disabled={!wallet.ready || busy}
                    onClick={() => {
                      loginStage("connect-click");
                      wallet.login();
                    }}
                  >
                    Connect wallet
                  </button>
                ) : !signedIn ? (
                  <button
                    disabled={!wallet.address || busy}
                    onClick={() => void signIn()}
                  >
                    Sign in to wallet play
                  </button>
                ) : (
                  <button disabled={busy} onClick={() => void recheck()}>
                    Check holdings again
                  </button>
                )}
                <Link href="/history">Existing browser history</Link>
                <Link href="/character">Use an NFT competitor</Link>
              </div>
              {wallet.authenticated && wallet.wallets.length > 1 && (
                <label>
                  Connected wallet
                  <select
                    value={wallet.address}
                    disabled={busy}
                    onChange={(event) =>
                      wallet.selectWallet(event.target.value)
                    }
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
              {!usable && (
                <button
                  className="secondary"
                  onClick={() => setReadRecords(true)}
                >
                  View existing saved progress
                </button>
              )}
            </>
          )}
          {saved && !qualified && (
            <p role="status">
              This saved encounter can finish. New encounters require verified
              holdings.
            </p>
          )}
          {readRecords && !qualified && (
            <p>Saved records are readable. New gameplay remains locked.</p>
          )}
          {wallet.authenticated && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void signOut()}
            >
              Sign out
            </button>
          )}
          {cooldown > 0 && (
            <p role="status">
              Too many requests. Try again in {cooldown} seconds.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
        </section>
        {usable && children}
      </WalletPlay>
    </AccessState>
  );
}
