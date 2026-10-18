import { expect, it, vi } from "vitest";
import { characters } from "../../src/domain/characters/definitions";
import { randomUUID } from "node:crypto";
import { admissionState } from "../../src/server/pvp/http";
import { Store } from "../../src/server/persistence";
import { PvpStore } from "../../src/server/pvp/persistence";
import { PvpService } from "../../src/server/pvp/service";
import { PVP_TIMERS } from "../../src/domain/pvp/timers";
it("presence polling does not reject Ready while a gameplay edit does", () => {
  const store = new Store(":memory:");
  try {
    const service = new PvpService(new PvpStore(store), PVP_TIMERS);
    const created = service.create(
      { actor: "11111111-1111-4111-8111-111111111111", mode: "guest" },
      Date.now(),
    );
    const room = service.records.byInvite(created.invite);
    service.join(
      { actor: "22222222-2222-4222-8222-222222222222", mode: "guest" },
      created.invite,
      Date.now(),
    );
    const seated = service.records.byInvite(created.invite);
    room.seats.b = seated.seats.b;
    const left = room.seats.a,
      right = room.seats.b;
    if (!left || !right) throw Error("Fixture did not seat both players");
    const initial = admissionState(
      room,
      "11111111-1111-4111-8111-111111111111",
    );
    room.revision++;
    left.lastSeenAt++;
    expect(admissionState(room, "11111111-1111-4111-8111-111111111111")).toBe(
      initial,
    );
    right.ready = true;
    expect(admissionState(room, "11111111-1111-4111-8111-111111111111")).toBe(
      initial,
    );
    left.characterId = "nyx";
    expect(
      admissionState(room, "11111111-1111-4111-8111-111111111111"),
    ).not.toBe(initial);
    const selected = admissionState(
      room,
      "11111111-1111-4111-8111-111111111111",
    );
    left.ready = true;
    expect(
      admissionState(room, "11111111-1111-4111-8111-111111111111"),
    ).not.toBe(selected);
    const ready = admissionState(room, "11111111-1111-4111-8111-111111111111");
    room.closedAt = Date.now();
    expect(
      admissionState(room, "11111111-1111-4111-8111-111111111111"),
    ).not.toBe(ready);
  } finally {
    store.close();
  }
});
it("the public pool stays shared-six even when a wallet's NFT benefit grants all twelve privately", () => {
  vi.stubEnv("SORYN_HOLDER_ACCESS", "enabled");
  const store = new Store(":memory:");
  try {
    const service = new PvpService(new PvpStore(store), PVP_TIMERS),
      now = Date.now();
    const a = "11111111-1111-4111-8111-111111111111",
      b = "22222222-2222-4222-8222-222222222222";
    const grant = (actor: string) => ({
      policy: "soryn-access/1" as const,
      id: randomUUID(),
      actor,
      kind: "nft" as const,
      checkedAt: now,
      admissionUntil: now + 30000,
      fighters: characters.map((c) => c.id),
    });
    const room = service.openMatched(
      { actor: a, mode: "guest", access: grant(a) },
      { actor: b, mode: "guest", access: grant(b) },
      now,
    );
    expect(service.records.byInvite(room.invite).roster).toBe("public-six");
    expect(() => service.select(a, room.invite, "aegis", now)).not.toThrow();
    expect(() => service.select(a, room.invite, "ember", now)).toThrow(
      /shares six/,
    );
    const other = "33333333-3333-4333-8333-333333333333";
    const privateRoom = service.create(
      { actor: other, mode: "guest", access: grant(other) },
      now,
    );
    expect(() =>
      service.select(other, privateRoom.invite, "ember", now),
    ).not.toThrow();
  } finally {
    store.close();
    vi.unstubAllEnvs();
  }
});
