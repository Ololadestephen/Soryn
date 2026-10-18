"use client";
import { publicReplaySchema } from "../../domain/adventure/responses";

import { useState } from "react";
import type { PublicReplayView } from "../../domain/views";
import { request } from "../request";
import type { GuestRequestGate } from "./requestGate";

export function usePublicReplay(
  gate: GuestRequestGate,
  setError: (message: string) => void,
) {
  const [publicReplay, setPublicReplay] = useState<PublicReplayView | null>(
    null,
  );
  async function openReplay(id: string) {
    if (!gate.begin()) return;
    setError("");
    try {
      const replay = await request(
        `/api/game?replay=${id}`,
        publicReplaySchema.parse,
      );
      if (gate.isMounted()) setPublicReplay(replay);
    } catch (problem) {
      if (gate.isMounted())
        setError(
          problem instanceof Error ? problem.message : "Replay unavailable.",
        );
    } finally {
      gate.end();
    }
  }
  return { publicReplay, setPublicReplay, openReplay };
}
