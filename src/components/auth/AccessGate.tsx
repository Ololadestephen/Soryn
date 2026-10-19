"use client";
import { createContext, useContext } from "react";
import Link from "next/link";
import { type AccessView } from "../../domain/access/policy";
import { HolderAccount } from "./HolderAccount";
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
          className={`holder-access${usable ? " is-compact" : ""}${qualified ? " is-account" : ""}`}
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
            <HolderAccount controller={controller} />
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
