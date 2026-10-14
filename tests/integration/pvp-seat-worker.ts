import { parentPort, workerData } from "node:worker_threads";
import { PVP_TIMERS } from "../../src/domain/pvp/timers";
import { Store } from "../../src/server/persistence";
import { PvpStore } from "../../src/server/pvp/persistence";
import { PvpService } from "../../src/server/pvp/service";

const data = workerData as {
  path: string;
  actor: string;
  invite: string;
  move: "basic" | "special" | "guard";
  now: number;
};

const service = new PvpService(new PvpStore(new Store(data.path)), PVP_TIMERS);
try {
  const view = service.move(data.actor, data.invite, 1, data.move, data.now);
  parentPort?.postMessage({
    ok: true,
    rounds: view.battle?.rounds.length ?? 0,
    seq: view.latestSeq,
    move: view.you.move,
  });
} catch (error) {
  parentPort?.postMessage({
    ok: false,
    rounds: 0,
    seq: 0,
    move: null,
    message: error instanceof Error ? error.message : "Move failed.",
  });
} finally {
  service.records.store.close();
}
