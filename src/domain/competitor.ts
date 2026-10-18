import type { TokenIdentity } from "./identity";

export interface CompetitorView {
  identity: TokenIdentity;
  verifiedAt: number | null;
  active: { kind: "series" | "queue" | "story"; href: string } | null;
  entries: {
    id: string;
    headline: string;
    kind: string;
    fighter: string | null;
    recordedAt: number;
    canPublish: boolean;
    publication: "private" | "published" | "withdrawn";
  }[];
}
