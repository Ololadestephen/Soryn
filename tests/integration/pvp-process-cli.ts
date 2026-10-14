import { PVP_TIMERS } from "../../src/domain/pvp/timers";
import { Store } from "../../src/server/persistence";
import { PvpStore } from "../../src/server/pvp/persistence";
import { PvpService } from "../../src/server/pvp/service";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const NOW = 1_700_000_000_000;
const [command, path, invite = "", actor = "", at = ""] = process.argv.slice(2);
const service = new PvpService(new PvpStore(new Store(path)), PVP_TIMERS);

if (command === "seed") {
  const created = service.create({ actor: A, mode: "guest" }, NOW);
  service.join({ actor: B, mode: "guest" }, created.invite, NOW);
  service.select(A, created.invite, "pip", NOW);
  service.select(B, created.invite, "bolt", NOW);
  service.ready(A, created.invite, true, NOW);
  service.ready(B, created.invite, true, NOW);
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
    JSON.stringify(service.preview(invite, actor, Number(at))),
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
