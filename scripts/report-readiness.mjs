import { readFileSync, writeFileSync } from "node:fs";
const dir = "docs/evidence/cinematic-readiness";
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const summary = [];
for (const target of ["landing", "journey", "guest", "heavy"]) {
  const stages = {};
  for (const stage of ["before", "after"]) {
    const samples = [];
    for (let i = 1; i <= 3; i++) {
      const d = JSON.parse(
        readFileSync(`${dir}/${stage}/${target}-${i}.json`, "utf8"),
      );
      const m = d.marks,
        resources = d.resources;
      const actor = resources.filter(
        (r) =>
          /\/combat\/(crisp|delivery)\/.+\.webp/.test(r.path) &&
          !r.path.includes("-idle"),
      );
      const decode = d.decode.filter((r) => /combat\//.test(r.path) && r.end);
      const api = resources.filter((r) => r.path === "/api/battle");
      samples.push({
        sample: i,
        landingUsable: m.landingUsable,
        playToSetup: m.setupUsable - m.playClick,
        playToBattle: m.battleUsable - m.playClick,
        startToBattle: m.battleUsable - m.startClick,
        ready: m.battleUsable ?? m.landingUsable,
        animation: m.animationComplete - m.moveClick,
        observedTransfer:
          d.navigationBytes +
          resources
            .filter((r) => !r.path.includes("/hero/"))
            .reduce((n, r) => n + r.transfer, 0),
        actorBytes: actor.reduce((n, r) => n + r.body, 0),
        actorDownloadWindow: actor.length
          ? Math.max(...actor.map((r) => r.end)) -
            Math.min(...actor.map((r) => r.start))
          : 0,
        decodeTotal: decode.reduce((n, r) => n + r.end - r.start, 0),
        decodeMax: Math.max(0, ...decode.map((r) => r.end - r.start)),
        api: api.map((r) => ({
          start: r.start,
          duration: r.duration,
          ttfb: r.ttfb,
          body: r.body,
        })),
        longTaskTotal: (d.longTasks ?? []).reduce((n, r) => n + r, 0),
      });
    }
    stages[stage] = {
      samples,
      medians: Object.fromEntries(
        [
          "landingUsable",
          "playToSetup",
          "playToBattle",
          "startToBattle",
          "ready",
          "animation",
          "observedTransfer",
          "actorBytes",
          "actorDownloadWindow",
          "decodeTotal",
          "decodeMax",
          "longTaskTotal",
        ].map((key) => [
          key,
          median(samples.map((s) => s[key]).filter(Number.isFinite)),
        ]),
      ),
    };
  }
  summary.push({ target, ...stages });
}
writeFileSync(
  `${dir}/performance-summary.json`,
  JSON.stringify(summary, null, 2) + "\n",
);
console.log(
  summary.map((s) => ({
    target: s.target,
    before: s.before.medians,
    after: s.after.medians,
  })),
);
