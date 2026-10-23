export interface PlayMenuState {
  story: "begin" | "continue" | "ending";
  matchInvite: string | null;
  practice: boolean;
}
export const playModes = [
  {
    href: "/match",
    name: "Find a Match",
    kind: "public",
  },
  {
    href: "/challenge",
    name: "Challenge a Friend",
    kind: "friend",
  },
  {
    href: "/story",
    name: "Story",
    kind: "story",
  },
  {
    href: "/arena",
    name: "Practice",
    kind: "practice",
  },
] as const;
