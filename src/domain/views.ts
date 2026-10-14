import type { Loadout } from "./characters/definitions";
import type { Action, Observation, Scenario } from "./game/contracts";
import type { GhostProfile, raceGhost } from "./ghosts/policy";
import type { TokenIdentity } from "./identity";

export interface ExhibitSummary {
  id: string;
  title: string;
  alias: string;
  outcome: string;
  turnsUsed: number;
  identity?: TokenIdentity | null;
  loadout?: Loadout;
}
export interface RunView {
  id: string;
  mode: "guest" | "official";
  borrowed?: boolean;
  identity?: TokenIdentity | null;
  exhibitId: string | null;
  step: number;
  observation: Observation;
  cohort: "first-recorded" | "informed-retry";
  replay: {
    scenario: Scenario;
    actions: Action[];
    frames: Observation[];
  } | null;
  ghost: {
    version: string;
    profile: GhostProfile;
    race: ReturnType<typeof raceGhost>;
  } | null;
  rival: {
    source: "previous-run" | "museum";
    label: string;
    version: string;
    replay: {
      frames: Observation[];
      actions: Action[];
      reasons: string[];
      comparison: "better" | "tied" | "behind";
    } | null;
  } | null;
  comparison: {
    original: "better" | "tied" | "behind";
    ghost: "better" | "tied" | "behind";
  } | null;
  publication: ExhibitSummary | null;
}
export interface PublicReplayView {
  exhibit: ExhibitSummary;
  frames: Observation[];
  ghost: ReturnType<typeof raceGhost> & { frames: Observation[] };
}
export interface SessionView {
  run: RunView | null;
  museum: ExhibitSummary[];
}
