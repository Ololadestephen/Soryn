import { mkdirSync, writeFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { combatBenchmark } from "../benchmarks/combat";
describe("reproducible public-state difficulty benchmark", () => {
  it("records unmodified deterministic outcomes, draws and round counts for 192 fixed strategies", () => {
    const report = combatBenchmark();
    expect(report.samples).toBe(192);
    for (const row of report.cases) expect(row.rounds).toBeLessThanOrEqual(20);
    expect(combatBenchmark()).toEqual(report);
    mkdirSync("docs/evidence", { recursive: true });
    writeFileSync(
      "docs/evidence/combat-difficulty-benchmark.json",
      JSON.stringify(report, null, 2) + "\n",
    );
  });
});
