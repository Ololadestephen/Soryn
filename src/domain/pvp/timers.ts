/** Versioned private-match clock. Defaults are the hosted policy. */
export const PVP_TIMEOUT_VERSION = "pvp-timeout/1" as const;

export interface PvpTimers {
  version: typeof PVP_TIMEOUT_VERSION;
  moveMs: number;
  presentMs: number;
  loadingMs: number;
  lobbyMs: number;
  disconnectMs: number;
  missedTurns: 2;
}

export const PVP_TIMERS: PvpTimers = {
  version: PVP_TIMEOUT_VERSION,
  moveMs: 30_000,
  presentMs: 8_000,
  loadingMs: 20_000,
  lobbyMs: 1_800_000,
  disconnectMs: 8_000,
  missedTurns: 2,
};

function bounded(value: string | undefined, fallback: number, min: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > fallback)
    return fallback;
  return parsed;
}

function loopbackOrigin(origin: string | undefined) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost")
    );
  } catch {
    return false;
  }
}

/**
 * Short clocks apply only when CHOG_PVP_TIMERS=test and APP_ORIGIN is loopback HTTP.
 * A public origin keeps the 30 second policy even if the test flag is copied into its environment.
 */
export function timersFromEnv(
  env: Record<string, string | undefined>,
): PvpTimers {
  if (env.CHOG_PVP_TIMERS !== "test" || !loopbackOrigin(env.APP_ORIGIN))
    return PVP_TIMERS;
  return {
    ...PVP_TIMERS,
    moveMs: bounded(env.CHOG_PVP_MOVE_MS, PVP_TIMERS.moveMs, 1000),
    presentMs: bounded(env.CHOG_PVP_PRESENT_MS, PVP_TIMERS.presentMs, 200),
    loadingMs: bounded(env.CHOG_PVP_LOADING_MS, PVP_TIMERS.loadingMs, 1000),
  };
}
