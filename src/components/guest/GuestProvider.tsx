"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useGuestGame } from "./useGuestGame";

const GuestContext = createContext<ReturnType<typeof useGuestGame> | null>(
  null,
);

export function GuestProvider({ children }: { children: ReactNode }) {
  const game = useGuestGame();
  return <GuestContext value={game}>{children}</GuestContext>;
}

export function useGuestSession() {
  const game = useContext(GuestContext);
  if (!game) throw new Error("Guest pages require the shared guest session.");
  return game;
}
