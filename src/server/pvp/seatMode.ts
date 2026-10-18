import { ServiceError } from "../errors";

type Mode = "guest" | "official";
/** A known guest seat retains its mode; otherwise explicit intent wins over cookie inference. */
export function requestedSeatMode(
  storedGuest: Mode | null,
  explicit: Mode | undefined,
  walletListed: boolean,
): Mode {
  if (storedGuest && explicit && explicit !== storedGuest)
    throw new ServiceError(
      409,
      "This seat keeps the access it was opened with.",
    );
  return storedGuest ?? explicit ?? (walletListed ? "official" : "guest");
}
