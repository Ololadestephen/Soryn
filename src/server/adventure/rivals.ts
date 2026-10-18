import { AdventureStore } from "./persistence";
import { createHash } from "node:crypto";
import { tokenKey, type OfficialAuthority } from "../../domain/identity";
import type { Scenario } from "../../domain/game/contracts";
import { sameLoadout } from "./characterAccess";
import { Store } from "../persistence";
import { RunRecord, ExhibitRecord } from "./persistence";
export function frozenRival(
  store: Store,
  actor: string,
  scenario: Scenario,
  authority: OfficialAuthority | null,
  prior: RunRecord | null,
  exhibit: ExhibitRecord | null,
): RunRecord["rival"] {
  if (exhibit)
    return {
      source: "museum",
      label: exhibit.title,
      profile: exhibit.ghost,
      version: createHash("sha256")
        .update(JSON.stringify(exhibit.ghost))
        .digest("hex"),
    };
  if (authority && scenario.rules !== "sandwich-rules/2") return null;
  const mode = authority ? "official" : "guest";
  const previous =
    prior ??
    new AdventureStore(store)
      .history(actor)
      .find(
        (record) =>
          record.mode === mode &&
          record.ghost &&
          sameLoadout(record.scenario, scenario) &&
          (!authority ||
            (record.authority?.generation === authority.generation &&
              tokenKey(record.authority.identity) ===
                tokenKey(authority.identity))),
      );
  return previous?.ghost
    ? {
        source: "previous-run",
        label: "Your previous ghost",
        version: previous.ghost.version,
        profile: previous.ghost.profile,
      }
    : null;
}
