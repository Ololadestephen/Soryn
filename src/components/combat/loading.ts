import type { BattleView } from "../../domain/combat/contracts";
import type { CharacterId } from "../../domain/characters/definitions";
import type { ArenaId } from "../../domain/combat/arenas";
import { atlases, renderedFighters } from "./rendered/assets";
import { deliveryPath } from "./rendered/delivery";
import { combatAudio } from "./audio/runtime";
import { prepareImage } from "./imagePreparation";
export const portraitQuery = "(max-width: 700px) and (min-height: 501px)";
export async function prepareSelectedAssets(
  player: CharacterId,
  opponent: CharacterId,
  arena: ArenaId,
  progress?: (done: number, total: number) => void,
  signal?: AbortSignal,
) {
  const portrait = window.matchMedia(portraitQuery).matches;
  const chosen = `/combat/arenas/${arena}-${portrait ? "portrait" : "desktop"}.webp`;
  const actors = [...new Set([player, opponent])].flatMap((id) => {
    const family = renderedFighters[id];
    return [atlases[family.fighter], atlases[family.companion]];
  });
  const sources = [
    ...new Set([chosen, ...actors.map((a) => deliveryPath(a.path))]),
  ];
  let done = 0;
  const failures: string[] = [];
  const unavailable: string[] = [];
  await Promise.all(
    sources.map(async (path) => {
      if (!(await prepareImage(path, signal)) && !signal?.aborted) {
        failures.push(path);
        const asset = actors.find((a) => deliveryPath(a.path) === path);
        const recovered =
          asset &&
          ((await prepareImage(asset.path, signal)) ||
            (!signal?.aborted &&
              (await prepareImage(asset.fallback.path, signal))));
        if (!recovered && path !== chosen) unavailable.push(path);
      }
      if (!signal?.aborted) progress?.(++done, sources.length);
    }),
  );
  return { failures, unavailable };
}
export async function prepareBattleAssets(
  battle: BattleView,
  progress?: (done: number, total: number) => void,
  signal?: AbortSignal,
) {
  const result = await prepareSelectedAssets(
    battle.snapshot.player.id,
    battle.snapshot.opponent.id,
    battle.arena ?? "sanctuary",
    progress,
    signal,
  );
  // Start optional sound after visual downloads; never hold the artwork gate.
  if (!signal?.aborted) void combatAudio.prepare(battle);
  return result;
}
