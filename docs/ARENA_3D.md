# Sculpted arena milestone — verified October 13, 2026

**Current visual direction — October 13, 2026:** the approved sculpted rendered artwork is restored as the default across all twelve fighters and companions. The simplified Blender pilot is not the approved visual direction. Editable Blender sources/scripts remain preserved. See [restoration, sharpness evidence and limits](ART_RESTORATION.md).

**Current animation update:** [BLENDER_ANIMATION_PILOT.md](BLENDER_ANIMATION_PILOT.md) records the real rig/actions, transparent exports and playable pair. Earlier model/tooling descriptions below are historical; other eleven families remain on their existing assets.

**Later October 13 update:** [BLENDER_PILOT.md](BLENDER_PILOT.md) supersedes the FIFO notice policy, portrait opponent elevation and abbreviated cooldown labels described here. The current build uses newest-move replacement and a shared ground baseline. Blender model/rig/export work is blocked by missing tools; the rendered asset milestone below remains historical evidence.

The approved October 12 direction is implemented across all twelve fighter families. Active battles fill the dynamic viewport, with separate rendered fighters, animal companions and environment. Rules/stats remain `/1`, explicit Easy/Medium/Hard remain frozen `combat-opponent/2`, and old records retain their original Legacy `/1` policy. Auth/ownership/generation checks, idempotency, private records and secondary adventures/ghosts/museum are preserved.

## Implemented experience

A native viewport-filling battle dialog removes ordinary navigation/header/footer, introduction, credits, adventure links, detailed rules and history from active combat. It requires no browser-fullscreen permission. Compact health/energy/CD/effects, round/difficulty, three moves and settings stay available. Real HUD/control dimensions reserve the battlefield, including safe areas and enlarged text. Tested sizes: 1280×800 desktop, 390×844 and 320×640 portrait, 844×390 landscape, and 320px/200% text. This establishes those exercised Chrome layouts, not every device/browser.

Settings/instructions and exit use a separate focus-trapped dialog; opening settings does not pause or mutate authoritative combat. Move focus is restored when controls become available, unless a menu has focus. A compact result offers Rematch, Change setup and View battle history. Details open only on request. Older private records are reachable from setup's private-history view. Rematch retains fighter/opponent/difficulty; ordinary page chrome returns outside combat.

Executed moves produce compact top-right notices: short drop/fade, three seconds total, then exit. FIFO prevents stacking; the timer never controls round resolution. Stable battle/round/side IDs claim one notice per executed move, including defence and real repair. Second impacts and responding counters are not new moves; cancelled specials never announce execution. Refresh has no replay notices. Reduced motion uses fade, without drop; only the notice text is an accessible live announcement, rather than every presentation frame. Rapid reduced-motion play can build a notice backlog; those notices never slow the match.

Animation consumes the existing validated event projection. Basic and special treatments differ, with wind-up, delivery, authoritative impact/react, return, block/dodge/decoy/counter, healing/status/expiry/burn/recoil/cancel and knockout. Companions only participate in existing special presentation; they add no HP, damage, turns, progression or loadouts. No balance changes were made.

## Rendering and completed roster

**Rendered pose atlases and layered SVG viewports/CSS motion, not rigged models.** Each fighter has six source poses (idle, wind-up, special, guard, hurt, defeated); each companion has idle/action/return. Basic actions use a different pose/effect treatment from specials. Healing keeps a recovery/tool pose, without showing an offensive special pose. Total: 72 fighter poses, 36 companion poses and one empty environment.

| Fighter | Companion         | Coordinated special presentation                                 |
| ------- | ----------------- | ---------------------------------------------------------------- |
| Pip     | Owl               | Lens/wing survey with actual exposure                            |
| Bolt    | Cheetah           | Dash supporting two separately keyed deliveries                  |
| Patch   | Mechanical beetle | Repair tool deployment and actual healing                        |
| Moss    | Tortoise          | Flowering shell, recovery/cleanse and bloom                      |
| Aegis   | Armadillo         | Curled shell roll beside shield bash                             |
| Nyx     | Panther           | Low shadow pounce with needle strike                             |
| Echo    | Fox               | Leaping misdirection, two impacts and finite decoy               |
| Prism   | Peacock           | Open spectrum fan and exposure treatment                         |
| Atlas   | Bear              | Heavy braced charge/stomp                                        |
| Flux    | Electric eel      | Energized circuit sweep/disruption                               |
| Ember   | Phoenix           | Fiery sweep, actual burn and recoil                              |
| Mneme   | Raven             | Memory wing/afterimage treatment and only actual repeat benefits |

All twelve are integrated; none uses a vector placeholder in the battle/selection renderer. Original vector adventure/landing art remains outside this combat milestone. Discrete pose changes and baked lighting are visible; these are not skeletal animation, realtime lighting or a physics simulation. Main art, companion art and transient effects are independent layers over the empty environment.

## Provenance and assets

Built-in image generation used the user's approved original arena-concept.png, companion-specials.png and art-direction notes; references were preserved. No Kuroro or NFT artwork was copied. Exact prompts, output filenames, master/runtime paths and display regions: [asset manifest](evidence/arena-3d/asset-manifest.json).

PNG masters are in `assets/combat/rendered/`; WebP runtime assets are in `public/combat/rendered/`. Already installed Sharp performs format conversion preserving alpha; alpha analysis records transparent gutters for SVG viewports without altering source pixels. `scripts/prepare-combat-atlases.mjs` reproduces viewport metadata; format its output with the normal project formatter. Explicit viewport clipping prevents legacy SVG overflow from displaying neighboring poses.

There are 15 runtime images (four separate first-pair atlases, ten combined fighter/companion atlases, one environment), approximately **6.2 MB** together; masters are about 35 MB and are kept outside public serving. No browser/dependency downloads, model imports, paid external services or subagents were used. Warm/cool shading is baked; enemy mirroring changes the baked light direction. Memory/decode cost and low-end mobile frame rate need dedicated profiling. No FPS/Core Web Vitals claim is made.

## Verification

Baseline: 187 unit/integration tests passed before implementation; project-only Desloppify scan/status/next reviewed. Final verification:

| Command                                                                                                       | Result                                                                                   |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `npm test`                                                                                                    | [192 passed in 31 suites; one optional live test skipped](evidence/arena-3d/tests.txt)   |
| `npm run lint` / script ESLint                                                                                | [Pass](evidence/arena-3d/lint.txt), [script pass](evidence/arena-3d/script-lint.txt)     |
| `npm run build`                                                                                               | [Pass; existing optional Farcaster/Ox Tempo warnings](evidence/arena-3d/build.txt)       |
| `npm run typecheck` after build                                                                               | [Pass](evidence/arena-3d/types.txt)                                                      |
| `npm run format:check` / script Prettier                                                                      | [Pass](evidence/arena-3d/format.txt), [script pass](evidence/arena-3d/script-format.txt) |
| `CHOG_E2E_BROWSER_CHANNEL=chrome PLAYWRIGHT_BROWSERS_PATH=/tmp/chog-installed-browser-tools npm run test:e2e` | [41 passed; roster test selector matched Echo's decoy](evidence/arena-3d/browser.txt)    |
| Same environment; `npm run test:e2e -- tests/e2e/arena-3d.spec.ts --grep 'rendered-roster\|aegis-ember'`      | [Both passed after selector correction](evidence/arena-3d/browser-final-focused.txt)     |

**42 distinct browser flows have passed across those runs**, not 44 distinct cases. Unchanged unrelated flows were not rerun after the final test-only selector correction. Roster testing respects the existing active-battle and request-rate gates: it finishes each match via authorized actual server steps and paces its requests at 1300ms. Signed disposable provider/wallet fixtures and synthetic read-only RPC are explicitly test evidence; no production guest unlock flag exists, no real user wallet was signed, and the user's database was preserved.

The complete browser run retains all prior ownership/RPC/transfer-generation/forged-stat/private-history/legacy/adventure/museum/consent regressions and three difficulty setup/refresh/rematch flows. New checks cover the signed Aegis/Ember sequence, twelve real specials/companion returns, viewport bounds, three-second notice lifetime/no focus theft, refresh without notices, settings without state mutation, result/history access and clipping. Existing tests cover multi-hit/cancel/duplicate acknowledgements and exact normal/reduced outcomes. Exercised Axe states have no reported A/AA violations; native screen-reader testing remains a manual gate.

Visual review exposed and corrected neighboring atlas leakage, oversized contact overlap, fixed HUD spacing at enlarged text and disabled-button focus loss. Actual screenshots/recording playback, rather than static concepts, were reviewed in the browser. Pose transitions can still look abrupt; fast queued notices can lag moves, especially in reduced motion. No human enjoyment, balance or retention evidence is claimed.

## Actual gameplay evidence

- [Idle arena](evidence/arena-3d/idle.png), [armadillo special](evidence/arena-3d/armadillo-special.png), [phoenix special](evidence/arena-3d/phoenix-special.png), [counter](evidence/arena-3d/counter.png), [result](evidence/arena-3d/result.png), [history](evidence/arena-3d/history.png).
- [Narrow mobile idle](evidence/arena-3d/mobile-idle.png), [mobile round](evidence/arena-3d/mobile-round.png).
- [Aegis/Ember actual gameplay MP4](evidence/arena-3d/aegis-ember.mp4) / [original WebM](evidence/arena-3d/aegis-ember.webm): both specials, defence/counter, result and opt-in history. First part normal motion; later rounds use reduced motion. Clearly labelled synthetic-holder fixture, not a live holder session.
- [Narrow mobile sequence](evidence/arena-3d/arena-mobile.webm), [desktop/portrait/landscape checks](evidence/arena-3d/arena-viewports.webm), [twelve-fighter roster sequence](evidence/arena-3d/rendered-roster.webm). Roster recording displays each real special; intervening match completion is via actual authorized API steps, not full visible animation of every intervening round.

MP4 conversion uses existing FFmpeg without retiming or manufacturing gameplay. Recordings are developer QA, not playtest participants or usage metrics.

## Code health and remaining gates

Project-only [scan](evidence/arena-3d/desloppify-scan.txt), [status](evidence/arena-3d/desloppify-status.txt), [next](evidence/arena-3d/desloppify-next.txt): objective 89.5, overall 22.4, strict 21.3; target 85 remains unmet. 159 open: 85 coverage, 47 smells, 20 unassessed subjective dimensions, 3 single-use, 2 naming, 1 orphan, 1 signature. Introduced test assertion/nesting findings were corrected; no suppressions, accepted-debt decisions or questionable exclusions were added. The next gate is initial subjective review; direct UI/hook coverage remains a relevant gap despite browser behavior coverage. Documentation-only finishing edits need no additional scan under project policy.

Manual guest steps: select a starter and difficulty, enter, use all three moves, check compact notices and real impacts, open settings, finish, choose View battle history, then rematch/change setup and review older private records. Follow [the human playtest guide](HUMAN_PLAYTEST.md); no participants or feedback have been invented or collected.

Real holders must operate their own Privy login/grant signature and actually owned token ID in My Chog before choosing a holder fighter. Real-holder gameplay remains unobserved. Artwork rights for NFT images remain unconfirmed; none is used. Sound, fighter progression/loadouts and combat ghost training remain unimplemented. Cross-browser/native screen-reader, low-end performance and human balance/readability testing remain gates. No commits, pushes, deployments, purchases, transfers, outreach or real-wallet signatures occurred.
