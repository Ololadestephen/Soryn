import { createHash } from "node:crypto";

const LEFT = [
  "Amber",
  "Brass",
  "Cloudy",
  "Dusky",
  "Gentle",
  "Quiet",
  "Rusty",
  "Silver",
  "Tiny",
  "Velvet",
  "Willow",
  "Young",
] as const;
const RIGHT = [
  "Badger",
  "Cricket",
  "Finch",
  "Heron",
  "Moth",
  "Newt",
  "Otter",
  "Pebble",
  "Quill",
  "Sparrow",
  "Thistle",
  "Wren",
] as const;

/** Stable label for a seat. It is not a wallet, token, or unique-person proof. */
export function guestName(actor: string, taken: readonly string[] = []) {
  const hash = createHash("sha256").update(actor).digest();
  const base = `${LEFT[hash[0] % LEFT.length]} ${RIGHT[hash[1] % RIGHT.length]}`;
  return taken.includes(base) ? `${base} 2` : base;
}
