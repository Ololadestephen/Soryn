import { describe, expect, it } from "vitest";
import { Store } from "../../src/server/persistence";
import { PvpStore } from "../../src/server/pvp/persistence";
import { QueueService } from "../../src/server/pvp/queue";
import { PvpService } from "../../src/server/pvp/service";
import { PVP_TIMERS } from "../../src/domain/pvp/timers";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("public queue through authoritative series completion", () => {
  for (const wins of [
    ["a", "a"],
    ["a", "b", "a"],
  ] as const)
    it(`plays ${wins.length === 2 ? "2–0" : "2–1"} without editing combat state`, async () => {
      const store = new Store(":memory:");
      try {
        const service = new PvpService(new PvpStore(store), PVP_TIMERS);
        const queue = new QueueService(store, service);
        let now = 1_700_000_000_000;
        queue.join({ actor: A, mode: "guest" }, now++);
        queue.join({ actor: B, mode: "guest" }, now++);
        queue.accept(A, now++);
        const paired = queue.accept(B, now++);
        const invite = paired.invite!;
        service.select(A, invite, "pip", now++);
        service.select(B, invite, "bolt", now++);
        await service.confirmReady(A, invite, true, now++);
        await service.confirmReady(B, invite, true, now++);
        const ids: string[] = [];
        for (const winner of wins) {
          service.assets(A, invite, now++);
          service.assets(B, invite, now++);
          let view = service.pollRoom(A, invite, now);
          expect(view.seated).toBe(true);
          if (!view.seated) throw new Error("Missing public seat");
          ids.push(view.battle!.id);
          for (let turn = 0; turn < 20 && !view.result; turn++) {
            const battle = service.records.byInvite(invite).match!;
            const canSpecial = (side: "player" | "opponent") =>
              battle.state[side].cooldown === 0 &&
              battle.state[side].energy >=
                battle.snapshot[side].moves.special.cost;
            const round = battle.state.round;
            service.move(
              A,
              invite,
              round,
              winner === "a" && canSpecial("player") ? "special" : "basic",
              now++,
            );
            const hidden = service.pollRoom(B, invite, now);
            expect(hidden.seated && hidden.opponent?.locked).toBe(true);
            if (hidden.seated)
              expect(hidden.opponent).not.toHaveProperty("move");
            service.move(
              B,
              invite,
              round,
              winner === "b" && canSpecial("opponent") ? "special" : "basic",
              now++,
            );
            now += PVP_TIMERS.presentMs + 1;
            const next = service.pollRoom(A, invite, now);
            if (!next.seated) throw new Error("Public seat disappeared");
            view = next;
          }
          expect(view.result?.headline).toBe(
            winner === "a" ? "Victory" : "Defeat",
          );
          const score = view.series;
          for (let repeat = 0; repeat < 3; repeat++) {
            const duplicate = service.pollRoom(A, invite, now++);
            expect(duplicate.seated && duplicate.series).toEqual(score);
          }
          if (view.series?.phase === "intermission") {
            expect(service.records.byInvite(invite).closedAt).toBeNull();
            expect(service.pollSession(A, now).activeInvite).toBe(invite);
            expect(service.pollSession(B, now).activeInvite).toBe(invite);
            expect(
              store.db
                .prepare("SELECT COUNT(*) n FROM pvp_queue WHERE room_invite=?")
                .get(invite)?.n,
            ).toBe(2);
            await service.continueSeries(A, invite, now++);
            await service.continueSeries(B, invite, now++);
          }
        }
        const final = service.records.byInvite(invite);
        expect(final.roster).toBe("starters");
        expect(final.origin).toBe("public");
        expect(final.closedAt).not.toBeNull();
        expect(
          store.db
            .prepare("SELECT COUNT(*) n FROM pvp_queue WHERE room_invite=?")
            .get(invite)?.n,
        ).toBe(0);
        expect(service.pollSession(A, now).activeInvite).toBeNull();
        expect(service.pollSession(B, now).activeInvite).toBeNull();
        expect(final.series).toMatchObject({
          phase: "complete",
          wins: { a: 2, b: wins.length - 2 },
          battleNumber: wins.length,
        });
        expect(new Set(ids).size).toBe(wins.length);
        expect(final.series?.recorded).toHaveLength(wins.length);
        const last = final.match!.id;
        service.pollRoom(A, invite, now + PVP_TIMERS.intermissionMs * 10);
        expect(service.records.byInvite(invite).match!.id).toBe(last);
        expect(queue.pollState(A, now).status).toBe("idle");
        queue.join({ actor: A, mode: "guest" }, now++);
        queue.join({ actor: B, mode: "guest" }, now++);
        queue.accept(A, now++);
        const again = queue.accept(B, now++);
        expect(again.invite).not.toBe(invite);
        service.pollRoom(A, invite, now++);
        expect(queue.pollState(A, now).invite).toBe(again.invite);
        expect(service.records.byInvite(invite).series).toEqual(final.series);
        expect(() => service.setup(A, invite, now)).toThrow(/archived/);
        expect(() => service.rematch(A, invite, now)).toThrow(/archived/);
      } finally {
        store.close();
      }
    });
});
