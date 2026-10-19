"use client";
import { queueViewSchema } from "../../domain/pvp/responses";
import { useEffect, useEffectEvent, useState } from "react";
import { MatchPanel } from "./MatchPanel";
import { useRouter } from "next/navigation";
import { request } from "../request";
import type { QueueView } from "../../domain/pvp/queue";
import { usePlayIdentity } from "../auth/PlayIdentity";

export function MatchScreen() {
  const router = useRouter();
  const identity = usePlayIdentity();
  const getHeaders = useEffectEvent(() => identity.headers());
  const [queue, setQueue] = useState<QueueView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let stop = false;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const next = await request(
          "/api/match?mode=" + identity.mode,
          queueViewSchema.parse,
          undefined,
          abort.signal,
          await getHeaders(),
        );
        if (!stop) {
          setQueue(next);
          if (next.invite)
            router.push(
              `/match/${next.invite}${identity.mode === "official" ? "?as=chog" : identity.walletPlay ? "?as=holder" : ""}`,
            );
        }
      } catch (problem) {
        if (!stop)
          setError(
            problem instanceof Error ? problem.message : "Queue unavailable.",
          );
      } finally {
        if (!stop) timer = setTimeout(() => void load(), 2000);
      }
    }
    void load();
    return () => {
      stop = true;
      abort.abort();
      clearTimeout(timer);
    };
  }, [router, identity.mode, identity.walletPlay]);
  async function send(operation: "join" | "cancel" | "accept" | "decline") {
    setBusy(true);
    setError("");
    try {
      const next = await request(
        "/api/match",
        queueViewSchema.parse,
        { operation, mode: identity.mode },
        undefined,
        await identity.headers(),
      );
      setQueue(next);
      if (next.invite)
        router.push(
          `/match/${next.invite}${identity.mode === "official" ? "?as=chog" : identity.walletPlay ? "?as=holder" : ""}`,
        );
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : "Queue unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <MatchPanel
      queue={queue}
      busy={busy}
      error={error}
      mode={identity.mode}
      walletPlay={identity.walletPlay}
      onAction={send}
    />
  );
}
