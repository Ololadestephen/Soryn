"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { RequestError } from "../request";
import type { AccessPhase } from "./walletSignIn";
/** One mutation at a time, cancellable on principal teardown. Timers update UI only. */
export function useAccessOperation(
  onStart: () => void,
  onUnauthorized: () => void,
) {
  const [phase, setPhase] = useState<AccessPhase>(null),
    [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const retryUntil = useRef(0);
  const operation = useRef<AbortController | null>(null);
  const busy = phase !== null || cooldown > 0;
  useEffect(
    () => () => {
      operation.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!cooldown) return;
    const timer = setInterval(
      () =>
        setCooldown(
          Math.max(0, Math.ceil((retryUntil.current - Date.now()) / 1000)),
        ),
      1000,
    );
    return () => clearInterval(timer);
  }, [cooldown]);
  const showError = useCallback(
    (problem: unknown) => {
      if (problem instanceof RequestError && problem.status === 401)
        onUnauthorized();
      const limited =
        problem instanceof RequestError
          ? problem.status === 429
          : !!problem &&
            typeof problem === "object" &&
            "status" in problem &&
            problem.status === 429;
      if (limited) {
        const delay =
          problem instanceof RequestError
            ? (problem.retryAfterSeconds ?? 60)
            : 60;
        retryUntil.current = Date.now() + delay * 1000;
        setCooldown(delay);
      }
      setError(
        problem instanceof Error
          ? problem.message
          : "Sign-in unavailable. Try again.",
      );
    },
    [onUnauthorized],
  );
  async function perform(
    initial: AccessPhase,
    work: (signal: AbortSignal) => Promise<void>,
  ) {
    if (operation.current || retryUntil.current > Date.now()) return;
    const controller = new AbortController();
    operation.current = controller;
    onStart();
    setPhase(initial);
    setError("");
    try {
      await work(controller.signal);
    } catch (problem) {
      if (!controller.signal.aborted) showError(problem);
    } finally {
      if (!controller.signal.aborted) setPhase(null);
      operation.current = null;
    }
  }
  const isPending = useCallback(() => operation.current !== null, []);
  return {
    busy,
    phase,
    error,
    cooldown,
    perform,
    setPhase,
    showError,
    isPending,
  };
}
