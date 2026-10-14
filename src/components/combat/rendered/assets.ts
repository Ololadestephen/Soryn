import atlasData from "./atlas-data.json";

export type RenderPose =
  "idle" | "windup" | "strike" | "guard" | "hit" | "defeated";
export const poseCells: Record<RenderPose, number> = {
  idle: 0,
  windup: 1,
  strike: 2,
  guard: 3,
  hit: 4,
  defeated: 5,
};
export { companions, renderedFighters, type AtlasKey } from "./catalogue";
export const atlases = atlasData;
