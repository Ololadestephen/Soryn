import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { it, expect } from "vitest";
const SAMPLE_RATE = 44100;
const PCM_PEAK = 32767;

it("preserved original cue masters are distinct playable mono PCM with finite headroom and click-free boundaries", () => {
  const paths = readdirSync("public/combat/audio").filter((path) =>
    path.endsWith(".wav"),
  );
  expect(paths).toHaveLength(24);
  const identities = new Set<string>();
  for (const path of paths) {
    const file = readFileSync(`public/combat/audio/${path}`);
    expect(file.subarray(0, 4).toString()).toBe("RIFF");
    expect(file.subarray(8, 12).toString()).toBe("WAVE");
    expect(file.readUInt16LE(20)).toBe(1);
    expect(file.readUInt16LE(22)).toBe(1);
    expect(file.readUInt32LE(24)).toBe(SAMPLE_RATE);
    expect(file.readUInt16LE(34)).toBe(16);
    const samples = [];
    for (let index = 44; index < file.length; index += 2)
      samples.push(file.readInt16LE(index) / PCM_PEAK);
    expect(samples.length / SAMPLE_RATE).toBeGreaterThan(0.04);
    expect(samples.length / SAMPLE_RATE).toBeLessThanOrEqual(0.51);
    expect(Math.max(...samples.map(Math.abs))).toBeGreaterThan(0.1);
    expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(0.81);
    expect(Math.abs(samples[0])).toBeLessThan(0.001);
    expect(Math.abs(samples.at(-1) ?? 1)).toBeLessThan(0.001);
    identities.add(createHash("sha256").update(file).digest("hex"));
  }
  expect(identities.size).toBe(paths.length);
});

it("ships the licensed demo soundtrack as a bounded streaming MPEG-4 asset", () => {
  const file = readFileSync("public/music/legionnaire.m4a");
  expect(file.subarray(4, 8).toString()).toBe("ftyp");
  expect(file.length).toBeGreaterThan(1024 * 1024);
  expect(file.length).toBeLessThan(4 * 1024 * 1024);
  const credits = readFileSync("public/music/CREDITS.txt", "utf8");
  expect(credits).toContain("Scott Buckley");
  expect(credits).toContain("https://creativecommons.org/licenses/by/4.0/");
  expect(credits).toContain("126-second excerpt");
});
