"use client";

import { useEffect, useState } from "react";
import { remainingSeconds } from "../../domain/pvp/updates";
import type { PvpView } from "../../domain/pvp/view";

export function useTurnClock(view: PvpView | null) {
  const [seconds, setSeconds] = useState<number | null>(null);
  const choosing =
    !!view && view.phase === "choose" && view.deadlineAt !== null;
  const serverNow = view?.serverNow;
  const deadlineAt = view?.deadlineAt;
  useEffect(() => {
    if (!choosing || serverNow === undefined || deadlineAt == null) return;
    const tick = () =>
      setSeconds(remainingSeconds(serverNow, deadlineAt, Date.now()));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [choosing, serverNow, deadlineAt]);
  return choosing ? seconds : null;
}
