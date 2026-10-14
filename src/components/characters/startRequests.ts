import type { CharacterId } from "../../domain/characters/definitions";
export function guestStartRequest(
  characterId: CharacterId,
  exhibitId: string | null,
  retryOf: string | null,
) {
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
) {
  return {
    operation: "start",
    id: crypto.randomUUID(),
    retryOf,
    ...(!retryOf ? { characterId } : {}),
  };
}
