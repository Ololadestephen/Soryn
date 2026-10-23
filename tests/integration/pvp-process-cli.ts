import { submitMove } from "../../src/domain/pvp/actions";
import { PVP_TIMERS } from "../../src/domain/pvp/timers";
import { Store } from "../../src/server/persistence";
import { PvpStore } from "../../src/server/pvp/persistence";
import { PvpService } from "../../src/server/pvp/service";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const NOW = 1_700_000_000_000;
const [command, path, invite = "", actor = "", at = ""] = process.argv.slice(2);
const service = new PvpService(new PvpStore(new Store(path)), PVP_TIMERS);

async function run() {
  if (command === "seed") {
    const created = service.create({ actor: A, mode: "guest" }, NOW);
    service.join({ actor: B, mode: "guest" }, created.invite, NOW);
    service.select(A, created.invite, "pip", NOW);
    service.select(B, created.invite, "bolt", NOW);
    await service.confirmReady(A, created.invite, true, NOW);
    await service.confirmReady(B, created.invite, true, NOW);
    service.assets(A, created.invite, NOW);
    service.assets(B, created.invite, NOW);
    service.move(A, created.invite, 1, "special", NOW + 25);
    process.stdout.write(
      JSON.stringify({
        invite: created.invite,
        deadline: NOW + PVP_TIMERS.moveMs,
      }),
    );
  } else if (command === "peek") {
    process.stdout.write(
      JSON.stringify(service.pollRoom(actor, invite, Number(at))),
    );
  } else if (command === "series-seed") {
    const created = service.create({ actor: A, mode: "guest" }, NOW);
    service.join({ actor: B, mode: "guest" }, created.invite, NOW);
    service.select(A, created.invite, "pip", NOW);
    service.select(B, created.invite, "bolt", NOW);
    await service.confirmReady(A, created.invite, true, NOW);
    await service.confirmReady(B, created.invite, true, NOW);
    const room = service.records.byInvite(created.invite);
    const match = room.match!;
    match.phase = "choose";
    match.deadlineAt = NOW + PVP_TIMERS.moveMs;
    match.state.player.health = 80;
    match.state.opponent.health = 1;
    match.state.player.energy = 4;
    match.state.opponent.energy = 4;
    submitMove(room, A, match.state.round, "basic", NOW + 10);
    submitMove(room, B, match.state.round, "basic", NOW + 10);
    service.records.save(room);
    process.stdout.write(
      JSON.stringify({
        invite: created.invite,
        phase: room.series?.phase,
        wins: room.series?.wins,
        deadline: room.series?.deadlineAt,
      }),
    );
  } else if (command === "series-peek") {
    const room = service.records.byInvite(invite);
    process.stdout.write(
      JSON.stringify({
        invite,
        phase: room.series?.phase,
        wins: room.series?.wins,
        deadline: room.series?.deadlineAt,
      }),
    );
  } else if (command === "finish") {
    const view = service.move(B, invite, 1, "guard", Number(at));
    process.stdout.write(
      JSON.stringify({ rounds: view.battle?.rounds.length ?? 0 }),
    );
  } else {
    process.stderr.write("Unknown command.");
    process.exitCode = 2;
  }
  service.records.store.close();
}
void run();
