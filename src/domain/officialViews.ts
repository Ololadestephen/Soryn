import type { TokenIdentity } from "./identity";
import type { RunView } from "./views";
import type { Action, Scenario } from "./game/contracts";
import type { GhostProfile } from "./ghosts/policy";

export interface PublicChapter {
  id: string;
  identity: TokenIdentity;
  title: string;
  alias: string;
  scenario: Scenario;
  actions: Action[];
  ghost: { version: string; profile: GhostProfile };
  publishedAt: number;
  status: "published" | "withdrawn";
}

export interface OfficialSessionView {
  account: {
    wallet: string;
    identity: TokenIdentity;
    expires: number;
    grant: boolean;
  } | null;
  run: RunView | null;
  chapters: PublicChapter[];
  publication: PublicChapter | null;
  withdrawals: { runId: string; title: string; identity: TokenIdentity }[];
}
