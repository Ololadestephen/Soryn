export interface PlayMenuState {
  story: "begin" | "continue" | "ending";
  matchInvite: string | null;
  practice: boolean;
}
export const playModes = [
  {
    href: "/match",
    name: "Find a Match",
    description: "Play a best-of-three series against another player.",
    kind: "public",
  },
  {
    href: "/challenge",
    name: "Challenge a Friend",
    description: "Create or join a private room.",
    kind: "friend",
  },
  {
    href: "/story",
    name: "Story",
    description: "Begin or continue The Fractured Sanctuary.",
    kind: "story",
  },
  {
    href: "/arena",
    name: "Practice",
    description: "Battle the computer at your chosen difficulty.",
    kind: "practice",
  },
] as const;
