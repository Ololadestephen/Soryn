import { z } from "zod";
import { accessViewSchema } from "../../domain/access/policy";
import { RequestError, request } from "../request";
import { loginStage } from "./accessTelemetry";
/** Eligibility and frozen-encounter reads share one proof, independently of signing. */
export async function readAccessState(
  path: string,
  recordsOnly: boolean,
  proof: Record<string, string>,
  signal?: AbortSignal,
) {
  const next = await request(
    `/api/access${recordsOnly ? "?records=1" : ""}`,
    accessViewSchema.parse,
    undefined,
    signal,
    proof,
  );
  if (next.authenticated && !recordsOnly)
    loginStage("eligibility-ready", next.status);
  // Legacy encounters and already-frozen wallet encounters can finish even after balance loss.
  const intent = next.authenticated
    ? { ...proof, "x-soryn-play": "wallet" }
    : {};
  let savedEncounter = false;
  let lookupError: string | undefined;

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
        signal,
        intent,
      );
      savedEncounter =
        !!state.battleId ||
        !!state.battle ||
        state.phase === "complete" ||
        state.phase === "closed";
    } catch (error) {
      savedEncounter = false;
      if (!(error instanceof RequestError && error.status === 404))
        lookupError =
          error instanceof Error
            ? error.message
            : "Saved encounter check unavailable. Try again.";
    }
  }
  return {
    view: next,
    saved: savedEncounter,
    ...(lookupError ? { lookupError } : {}),
  };
}
