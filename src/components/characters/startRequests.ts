import type { CharacterId } from "../../domain/characters/definitions";
import type {
  GuestStartRequest,
  OfficialStartRequest,
} from "../../domain/requests";
export function guestStartRequest(
  characterId: CharacterId,
  exhibitId: string | null,
  retryOf: string | null,
): GuestStartRequest {
  return {
    operation: "start",
    id: crypto.randomUUID(),
    mode: "guest",
    exhibitId,
    retryOf,
    ...(!exhibitId && !retryOf ? { characterId } : {}),
  };
}
export function officialStartRequest(
  characterId: CharacterId,
  retryOf: string | null,
): OfficialStartRequest {
  return {
    operation: "start",
    id: crypto.randomUUID(),
    retryOf,
    ...(!retryOf ? { characterId } : {}),
  };
}
