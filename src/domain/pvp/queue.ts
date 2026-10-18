export interface QueueView {
  mode?: "guest" | "official";
  tokenId?: string | null;
  status: "idle" | "waiting" | "offered" | "matched" | "blocked";
  othersWaiting: number;
  accepted: boolean;
  deadlineAt: number | null;
  serverNow: number;
  invite: string | null;
  lockedUntil: number | null;
  message: string;
}
