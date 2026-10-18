"use client";
import { officialSessionSchema } from "../../domain/adventure/responses";
import { ignoreResponse } from "../request";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { OfficialSessionView } from "../../domain/officialViews";
import { request } from "../request";
import { useWalletAdapter } from "../auth/WalletAdapter";

export type SignInChallenge = {
  nonce: string;
  message: string;
  owner: boolean;
};
export const emptyWalletSession: OfficialSessionView = {
  account: null,
  run: null,
  chapters: [],
  publication: null,
  withdrawals: [],
};

export function useWalletSession() {
  const adapter = useWalletAdapter();
  const [session, setSession] = useState(emptyWalletSession);
  const wallet = adapter.authenticated ? adapter.address : "";
  const [challenge, setChallenge] = useState<SignInChallenge | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const revision = useRef(0);
  const headersForSession = useEffectEvent(() => adapter.headers());
  useEffect(() => {
    if (!adapter.ready) return;
    const abort = new AbortController();
    const activeRevision = ++revision.current;
    async function load() {
      try {
        const headers = adapter.authenticated ? await headersForSession() : {};
        const data = await request(
          "/api/identity",
          officialSessionSchema.parse,
          undefined,
          abort.signal,
          headers,
        );
        if (abort.signal.aborted) return;
        if (data.account && data.account.wallet !== adapter.address) {
          await request(
            "/api/identity",
            ignoreResponse,
            { operation: "logout" },
            abort.signal,
          );
          setError("Wallet changed. Authorize the selected Chog again.");
        } else setSession(data);
      } catch (problem) {
        if (!abort.signal.aborted)
          setError(
            problem instanceof Error
              ? problem.message
              : "Privy session unavailable.",
          );
      } finally {
        if (!abort.signal.aborted) setBusy(false);
      }
    }
    void load();
    return () => {
      revision.current = activeRevision + 1;
      abort.abort();
    };
  }, [adapter.ready, adapter.authenticated, adapter.address]);
  return {
    session,
    setSession,
    wallet,
    challenge,
    setChallenge,
    busy,
    setBusy,
    error,
    setError,
    pending,
    setPending,
    revision,
  };
}
