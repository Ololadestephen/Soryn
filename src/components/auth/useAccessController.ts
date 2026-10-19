"use client";
import { useEffect, useCallback, useState, useRef } from "react";
import { z } from "zod";
import { accessViewSchema, type AccessView } from "../../domain/access/policy";
import { useWalletAdapter } from "./WalletAdapter";
import { request } from "../request";
import { loginStage } from "./accessTelemetry";
import { signInToWallet } from "./walletSignIn";
import { useAccessOperation } from "./useAccessOperation";
import { readAccessState } from "./readAccessState";
export function useAccessController(recordsOnly: boolean) {
  const wallet = useWalletAdapter();
  const [view, setView] = useState<AccessView | null>(null);
  const refreshGeneration = useRef(0);
  const [saved, setSaved] = useState(false),
    [readRecords, setReadRecords] = useState(false);
  const onStart = useCallback(() => {
    ++refreshGeneration.current;
  }, []);
  const onUnauthorized = useCallback(() => {
    setView({
      status: "signed-out",
      message: "Sign in to your wallet again.",
      fighters: [],
      checkedAt: null,
      authenticated: false,
    });
    setSaved(false);
  }, []);
  const {
    busy,
    phase,
    error,
    cooldown,
    perform,
    setPhase,
    showError,
    isPending,
  } = useAccessOperation(onStart, onUnauthorized);
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
  const refresh = useCallback(
    async (provided?: Record<string, string>, signal?: AbortSignal) => {
      const proof = provided ?? (await headers());
      return readAccessState(
        window.location.pathname,
        recordsOnly,
        proof,
        signal,
      );
    },
    [headers, recordsOnly],
  );
  useEffect(() => {
    if (
      isPending() ||
      (wallet.authenticated && (!wallet.ready || !wallet.address))
    )
      return;
    let alive = true;
    const generation = ++refreshGeneration.current;
    void refresh()
      .then((next) => {
        if (alive && generation === refreshGeneration.current) {
          setView(next.view);
          setSaved(next.saved);
        }
      })
      .catch((problem: unknown) => {
        if (alive && generation === refreshGeneration.current)
          showError(problem);
      });
    return () => {
      alive = false;
    };
  }, [
    refresh,
    wallet.ready,
    wallet.authenticated,
    wallet.address,
    showError,
    isPending,
  ]);
  async function signIn() {
    await perform("session", async (signal) => {
      const { session, proof } = await signInToWallet(wallet, setPhase, signal);
      if (signal.aborted) return;
      setView(session);
      setPhase("holdings");
      loginStage("eligibility-start");
      const next = await refresh(proof, signal);
      if (signal.aborted) return;
      if (!next.view.authenticated) {
        setView(next.view);
        setSaved(false);
        throw new Error(
          "Your server session is unavailable. Check sign-in again.",
        );
      }
      setView(next.view);
      setSaved(next.saved);
    });
  }
  async function update(
    input: { operation: "refresh" } | { operation: "equip"; equipped: boolean },
  ) {
    await perform("holdings", async (signal) => {
      loginStage("eligibility-start");
      const next = await request(
        "/api/access",
        accessViewSchema.parse,
        input,
        signal,
        await headers(),
      );
      if (signal.aborted) return;
      loginStage("eligibility-ready", next.status);
      setView(next);
    });
  }
  const recheck = () => update({ operation: "refresh" });
  const equip = (equipped: boolean) => update({ operation: "equip", equipped });
  async function signOut() {
    await perform("sign-out", async (signal) => {
      await request(
        "/api/access",
        (value) => z.object({ signedOut: z.literal(true) }).parse(value),
        { operation: "logout" },
        signal,
      );
      if (signal.aborted) return;
      setView({
        status: "signed-out",
        message: "Connect wallet",
        fighters: [],
        checkedAt: null,
        authenticated: false,
      });
      setSaved(false);
      setReadRecords(false);
      await wallet.logout();
    });
  }
  return {
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
  };
}
