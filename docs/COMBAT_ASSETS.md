# Combat artwork and presentation provenance

**Current visual direction — October 13, 2026:** the approved sculpted rendered artwork is restored as the default across all twelve fighters and companions. The simplified Blender pilot is not the approved visual direction. Editable Blender sources/scripts remain preserved. See [restoration, sharpness evidence and limits](ART_RESTORATION.md).

**Current October 13 update:** [BLENDER_PILOT.md](BLENDER_PILOT.md) records the missing Blender/MCP prerequisite and verified current-move notice, portrait-ground and cooldown fixes. [ARENA_3D.md](ARENA_3D.md) records the twelve rendered families and earlier artwork milestone. Historical queued-notice descriptions below are superseded; gameplay versions and identity protections remain unchanged.

**October 12 current artwork:** `src/components/combat/art/anatomy.ts` now gives all twelve unique torso/limb/head/ear/stance geometry and asymmetric three-quarter faces oriented toward their opponent. Pip is compact/alert; Bolt long-limbed/forward; Patch asymmetrical/practical; Moss rounded/grounded; Aegis broad/shield-forward; Nyx low/agile; Echo theatrical with a separate decoy; Prism angular/precise; Atlas heavy/weight-bearing; Flux articulated; Ember aggressive/flame-crested; Mneme deliberate/book-bearing. `MoveEffect.tsx` and `domain/combat/presentation/moves.ts` provide 24 typed move-specific shapes. No external artwork/assets/fonts were downloaded. The following equipment provenance remains valid.

Current screenshots: `docs/evidence/presentation-{counter,repair,mobile,knockout}.png`. Actual isolated guest gameplay videos: `docs/evidence/recordings/`, including counter, repair, separate delivery hits/dodge/burn/recoil and full knockout. [Current treatment table, recording links and verification](COMBAT_PRESENTATION.md). These are working battles, not NFT ownership evidence or human playtest feedback.

October 11, 2026. These are twelve original application-defined adventurer classes, not new NFTs, verified NFT traits or Kuroro characters. No official NFT artwork is used; artwork permission remains unconfirmed separately.

`src/components/combat/FighterArt.tsx` and `Equipment.tsx` contain original layered SVG paths authored with Codex assistance for this project. View box 180 × 300: separate head, torso, jointed arms, legs, boots and equipment. This is a newly drawn tall full-body model, rather than an enlarged version of the adventure portrait. The existing lilac/ink/yellow visual identity remains. System Trebuchet MS/Arial fonts are retained; no font/art files or dependencies were downloaded.

| Fighter | Full-body identity                                                               |
| ------- | -------------------------------------------------------------------------------- |
| Pip     | Scout cap, long cape/scarf, magnifying instrument and fitted tunic               |
| Bolt    | Tall ears, courier scarf, winged boots and forward attack lean                   |
| Patch   | Goggles with visible eyes, apron/tool pockets and long spanner                   |
| Moss    | Leaf hood, long coat, planting staff and green recovery effects                  |
| Aegis   | Visored helmet with readable eyes, shoulder armour and broad shield              |
| Nyx     | Tall pointed hood, cloak, paired blades, shadowed lunge and dashed dodge defence |
| Echo    | Jester crown/collar, curved tail, orb and finite decoy marker                    |
| Prism   | Tall triangular hat, crystal staff, diamond projectile and exposure marker       |
| Atlas   | Broad torso, carrying harness, parcel and heavy forward stance                   |
| Flux    | Hard hat, overalls, wrench and electrical disruption marker                      |
| Ember   | Flame crest, running stance, heated attack silhouette and recoil/burn effects    |
| Mneme   | Curled ears, memory spiral, open book and purple recall orb                      |

The geometry test removes names and colours before checking all twelve models remain distinct. Hit and attack mouth expressions, visible pupils through goggles/visor and crossed-eye knockout poses are rendered from event state. CSS transforms move physical attackers toward the opponent and hold them through impact before return. Ranged projectiles cross the measured arena gap. Prepared defence stays visible through the enemy attack; healing, exposure, disruption, decoys and burn have explicit visible treatments and public numeric effects. Two-hit moves have two authoritative health-impact frames. Cancelled attacks have no lunge or projectile.

These are event-driven SVG/CSS treatments, not a skeletal animation rig, pre-rendered sprites or static concept art claimed as animation. Server events already contain every health/resource change; client timing cannot alter outcomes. Reduced motion removes the movement transitions and shortens event frames while retaining final state and a readable log.

The installed Sites skill and its local-preview/presentation-led design guidance were read. The installed Next 16 server/client and route-handler guides were read for the framework changes. No additional UI skill package or dependencies were installed, no subagents were launched, and no bitmap image generation was used. The imagegen skill was therefore not invoked.

Screenshots in `docs/evidence/combat-*.png` are actual automated local gameplay using the production build and isolated test database. Guest images establish real guest combat, not NFT ownership. Holder authorization tests separately use labelled disposable ES256 provider keys, disposable wallets and a synthetic RPC; no live holder gameplay is implied.
