"use client";

import { OfficialIdentity } from "./identity/OfficialIdentity";
import { useGuestSession } from "./guest/GuestProvider";

export function CharacterScreen() {
  const game = useGuestSession();
  return <OfficialIdentity onMuseumChanged={game.refreshMuseum} />;
}
