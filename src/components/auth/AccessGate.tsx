"use client";
import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  useRef,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { z } from "zod";
import { accessViewSchema, type AccessView } from "../../domain/access/policy";
import { useWalletAdapter } from "./WalletAdapter";
import { request } from "../request";
import { hexMessage, selectedWallet } from "../identity/wallet";
import { loginStage } from "./accessTelemetry";

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
}: {
  children: React.ReactNode;
  recordsOnly?: boolean;
}) {
  const wallet = useWalletAdapter();
  const [view, setView] = useState<AccessView | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [saved, setSaved] = useState(false),
    [readRecords, setReadRecords] = useState(false);
  // Provider bookkeeping can rerender without changing the selected principal.
  // Read its latest proof adapter without re-running eligibility on each render.
  const currentWallet = useRef(wallet);
  useEffect(() => {
    currentWallet.current = wallet;
  }, [wallet]);
  const headers = useCallback(async () => {
    const adapter = currentWallet.current;
    return adapter.authenticated ? adapter.headers() : {};
  }, []);
  const refresh = useCallback(async () => {
    const next = await request(
      `/api/access${recordsOnly ? "?records=1" : ""}`,
      accessViewSchema.parse,
      undefined,
      undefined,
      await headers(),
    );
    if (next.authenticated) loginStage("eligibility-ready");
    // Legacy encounters and already-frozen wallet encounters can finish even after balance loss.
    const intent = next.authenticated
      ? { ...(await headers()), "x-soryn-play": "wallet" }
      : {};
    let savedEncounter = false;
    const path = window.location.pathname;
    let url: string | null = null;
    if (path.startsWith("/challenge/") || path.startsWith("/match/"))
      url = `/api/pvp?mode=guest&invite=${path.split("/").at(-1)}`;
    else if (path === "/story") url = "/api/story?mode=guest";
    else if (path === "/arena") url = "/api/battle?mode=guest";
    if (url) {
      try {
        const state = await request(
          url,
          (value) => z.record(z.string(), z.unknown()).parse(value),
          undefined,
          undefined,
          intent,
        );
        savedEncounter =
          !!state.battleId ||
          !!state.battle ||
          state.phase === "complete" ||
          state.phase === "closed";
      } catch {
        savedEncounter = false;
      }
    }
    return { view: next, saved: savedEncounter };
  }, [headers, recordsOnly]);
  useEffect(() => {
    let alive = true;
    void refresh()
      .then((next) => {
        if (alive) {
          setView(next.view);
          setSaved(next.saved);
        }
      })
      .catch((problem: unknown) => {
        if (alive)
          setError(
            problem instanceof Error
              ? problem.message
              : "Couldn't verify holdings. Try again.",
          );
      });
    return () => {
      alive = false;
    };
  }, [refresh, wallet.authenticated, wallet.address]);
  async function signIn() {
    setBusy(true);
    setError("");
    try {
      const proof = await wallet.headers();
      const provider = await wallet.provider();
      loginStage("handoff-start");
      const address = await selectedWallet(provider, wallet.address);
      const challenge = await request(
        "/api/access",
        (value) =>
          z.object({ nonce: z.string(), message: z.string() }).parse(value),
        { operation: "challenge", wallet: address },
        undefined,
        proof,
      );
      loginStage("signature-request");
      const signature = await provider.request({
        method: "personal_sign",
        params: [hexMessage(challenge.message), address],
      });
      loginStage("signature-returned");
      await request(
        "/api/access",
        (value) => z.object({ signedIn: z.literal(true) }).parse(value),
        { operation: "verify", ...challenge, signature },
        undefined,
        proof,
      );
      loginStage("session-ready");
      const next = await refresh();
      setView(next.view);
      setSaved(next.saved);
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Sign-in unavailable. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function recheck() {
    setBusy(true);
    setError("");
    try {
      setView(
        await request(
          "/api/access",
          accessViewSchema.parse,
          { operation: "refresh" },
          undefined,
          await headers(),
        ),
      );
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Couldn't verify holdings. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function equip(equipped: boolean) {
    setBusy(true);
    setError("");
    try {
      setView(
        await request(
          "/api/access",
          accessViewSchema.parse,
          { operation: "equip", equipped },
          undefined,
          await headers(),
        ),
      );
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Could not equip. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const qualified =
    view?.status === "token" ||
    view?.status === "nft" ||
    view?.status === "both";
  const signedIn = !!view?.authenticated;
  const usable = qualified || saved || (recordsOnly && signedIn) || readRecords;
  return (
    <AccessState value={view}>
      <WalletPlay value={signedIn}>
        <section
          className={`holder-access${usable ? " is-compact" : ""}`}
          aria-label="Soryn access"
        >
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
              <label>
                <input
                  type="checkbox"
                  checked={!!view.equipped}
                  disabled={busy}
                  onChange={(event) => void equip(event.target.checked)}
                />
                Equip holder frame, arena light and companion celebration for
                new encounters
              </label>
              <p>
                Applied to your presentation. This does not publish your
                profile, wallet or results.
              </p>
            </details>
          ) : (
            <>
              <h2>{!view || busy ? "Checking holdings…" : "Holder access"}</h2>
              {view?.message && view.message !== "Connect wallet" && (
                <p>{view.message}</p>
              )}
              <p>
                50 $CHOG or a Chog NFT unlocks Story and player battles. No
                tokens are spent.
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
          {error && <p role="alert">{error}</p>}
        </section>
        {usable && children}
      </WalletPlay>
    </AccessState>
  );
}
