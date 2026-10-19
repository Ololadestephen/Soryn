"use client";
import { createContext, useContext } from "react";
import Link from "next/link";
import Image from "next/image";
import { type AccessView } from "../../domain/access/policy";
import { HolderCosmeticToggle } from "./HolderCosmeticToggle";
import { MyChogPanel } from "../identity/MyChogPanel";

import { useAccessController } from "./useAccessController";
import { accessProgress } from "./walletSignIn";
import { AccessEntry } from "./AccessEntry";

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
  const controller = useAccessController(recordsOnly);
  const {
    wallet,
    view,
    phase,
    error,
    busy,
    cooldown,
    saved,
    readRecords,
    signIn,
    recheck,
    equip,
    signOut,
  } = controller;
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
          ) : recordsOnly && signedIn ? (
            <div className="access-account-row">
              <span>Signed in · Private wallet records</span>
              <Link href="/character">My Chog</Link>
              <button
                className="access-quiet"
                disabled={busy}
                onClick={() => void signOut()}
              >
                Sign out
              </button>
            </div>
          ) : (
            <AccessEntry controller={controller} usable={usable} />
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
          {qualified && wallet.authenticated && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void signOut()}
            >
              Sign out
            </button>
          )}
          {(qualified || recordsOnly) && cooldown > 0 && (
            <p role="status">
              Too many requests. Try again in {cooldown} seconds.
            </p>
          )}
          {(qualified || recordsOnly) && error && <p role="alert">{error}</p>}
        </section>
        {usable && children}
      </WalletPlay>
    </AccessState>
  );
}
