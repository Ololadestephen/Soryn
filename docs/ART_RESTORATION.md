# Approved rendered artwork restoration — October 13, 2026

Current framing/audio/environment work is recorded in [the arena presentation milestone](ARENA_FEEL.md). Source-resolution limits and the approved rendered art direction remain.

The approved sculpted fighter/companion artwork is again the default for all twelve families, including Aegis and the armadillo. These are **rendered artwork pose atlases**, with event-bound SVG/CSS presentation, not realtime sculpted models or skeletal animations. The simplified Blender pilot is not the approved visual direction. Its editable sources, actions, export scripts and tests remain available; no Blender or PNG master was deleted or regenerated.

## Diagnosis and changes

| Finding                                          | Evidence and response                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full atlas size overstated usable detail         | Ten combined masters are 1254×1254, but each source cell is roughly 418×418. Aegis/Ember cells are about 512×512. The armadillo/phoenix have different larger cell regions. Actual silhouette height is often 300–350 pixels, not 1254. [Every cell and alpha bounds](evidence/art-restoration/runtime-manifest.json).                                                                                                                                            |
| Source limit versus display                      | Before: desktop SVGs were 486.39 CSS pixels; Pip's 432-pixel-tall region was enlarged at CSS scale before the additional 2× density. The shared matchup size cap now prevents enlargement beyond native logical cell size at CSS scale while maintaining equal wrapper size for both actors. Portrait is 257.39 CSS pixels at 3× density, so missing physical-pixel detail still cannot be recovered. No pixelated rendering or artificial sharpening is applied. |
| Compression softened edges/colours               | Original PNG versus legacy WebP visible RGB RMSE: Aegis 6.60, Pip 6.28, Prism 9.76. Candidate q95 reduces this to 4.28/4.22/6.37, while near-lossless q85 reduces source-atlas error to 0.82/1.72/1.83. Final packed fighter errors are 0.83/1.40/1.69. [Audit](evidence/art-restoration/source-audit.json), [final packed audit](evidence/art-restoration/runtime-audit.json). This is an alpha-weighted pixel-error measure, not a perceptual sharpness score.  |
| Padding and cell shapes                          | Clear alpha padding wastes decoded memory; it does not destroy existing pixels. Separate fighter and companion atlases share a compact crop across all their poses. Source pixels are copied with integer translations and no resampling. One fixed logical canvas per actor prevents unequal source row/column sizes from changing scale between poses.                                                                                                          |
| Ground/pivot drift                               | Substantial opaque silhouette bottoms are aligned to a consistent 94% canvas baseline; faint particles do not decide foot height. Normalization retains source proportions rather than scaling each crouch to standing height. Pivots use that baseline. Original art still has discrete pose/proportion differences; this is not a rig-based deformation fix.                                                                                                    |
| SVG letterboxing could reveal neighbouring cells | Every actor now has its own unique explicit clip rectangle around its packed cell. The outer SVG permits authored extended effects, while the battlefield clips its presentation region before HUD/controls. The old assets remain separately clipped loading fallbacks. Paired/repeated identities have direct clipping tests.                                                                                                                                   |
| Additional bitmap softening during moves         | Source poses already contain body posture. Redundant Aegis rotations and whole-body guard shrink were replaced with modest anticipation/bracing translation. Transient Nyx opacity/figure filters are removed; the distinct move effects remain separate. Cast drop shadows remain and do not blur the figure itself. Idle DOM measurements confirm opacity 1 and no image filter.                                                                                |
| Fractional responsive scaling                    | Measured desktop placement includes fractional CSS positions and 486.39-pixel size; portrait uses 257.39. Smooth interpolation and moving subpixels remain appropriate for illustrated art. The main losses are source resolution/compression, not evidence of a CSS blur filter. No forced GPU promotion, pixelation or promise of pixel-exact retina rendering is introduced.                                                                                   |

`node scripts/prepare-crisp-atlases.mjs` reproduces all runtime files from preserved approved PNGs and the preserved original cell metadata. It uses installed Sharp: WebP near-lossless quality 85, alpha quality 100, effort 6. Alpha audit found at most 1/255 difference, so this is not represented as mathematically lossless. Cropping disregards only alpha ≤2/255 when determining its common outer bounds; masters remain unchanged.

Selection uses individual full-source-resolution idle crops, so browsing twelve cards does not download six battle poses each. Entering a battle loads the actual fighter and companion atlases. Missing new assets fall back to the previous approved WebP; if both fail, a labelled artwork-unavailable state preserves real gameplay.

## Runtime cost

Legacy fourteen character atlases: **6,073,972 bytes**, **88,063,776 bytes (84.0 MiB)** estimated decoded RGBA. New twenty-four battle atlases: **14,082,532 bytes**, **74,806,032 bytes (71.3 MiB)**. Twelve idle previews add **1,512,134 bytes / 7,831,812 decoded bytes**. Higher compression fidelity costs more download bytes; shared cropping reduces decoded space. These totals are file/RGBA estimates, not measured heap/GPU residency or simultaneous loading. The unchanged environment is 1672×941, 404,030 compressed bytes / 6,293,408 estimated RGBA bytes. Legacy fallback files remain and are additional on-disk/conditional costs.

| Actor atlas   | Runtime dimensions | Compressed bytes | Decoded RGBA bytes |
| ------------- | ------------------ | ---------------: | -----------------: |
| aegis         | 1506×876           |        1,030,922 |          5,277,024 |
| ember         | 1548×852           |        1,021,030 |          5,275,584 |
| armadillo-pet | 2412×494           |          768,324 |          4,766,112 |
| phoenix-pet   | 2772×730           |        1,134,290 |          8,094,240 |
| pip           | 1245×806           |          657,328 |          4,013,880 |
| pip-pet       | 1251×407           |          300,768 |          2,036,628 |
| bolt          | 1332×836           |          752,332 |          4,454,208 |
| bolt-pet      | 1266×344           |          275,608 |          1,742,016 |
| patch         | 1122×854           |          707,440 |          3,832,752 |
| patch-pet     | 1029×332           |          257,196 |          1,366,512 |
| moss          | 1176×722           |          741,056 |          3,396,288 |
| moss-pet      | 990×303            |          270,050 |          1,199,880 |
| nyx           | 1152×702           |          650,190 |          3,234,816 |
| nyx-pet       | 1266×300           |          267,448 |          1,519,200 |
| echo          | 1290×724           |          718,390 |          3,735,840 |
| echo-pet      | 1263×319           |          229,652 |          1,611,588 |
| prism         | 1266×800           |          821,320 |          4,051,200 |
| prism-pet     | 1266×299           |          351,690 |          1,514,136 |
| atlas         | 1056×666           |          678,018 |          2,813,184 |
| atlas-pet     | 1068×272           |          264,066 |          1,161,984 |
| flux          | 1158×818           |          676,082 |          3,788,976 |
| flux-pet      | 987×296            |          289,666 |          1,168,608 |
| mneme         | 1146×680           |          809,450 |          3,117,120 |
| mneme-pet     | 1164×351           |          410,216 |          1,634,256 |

## Visual review evidence

- [Actual prior Blender default](evidence/art-restoration/before/desktop-pilot.png), [approved legacy desktop](evidence/art-restoration/before/desktop-aegis-ember.png), [restored desktop](evidence/art-restoration/after/desktop-aegis-ember.png).
- [Matched earlier WebP desktop](evidence/art-restoration/matched-legacy/desktop-aegis-ember.png) / [new desktop](evidence/art-restoration/after/desktop-aegis-ember.png): 1280×800, 2× density. [Face](evidence/art-restoration/desktop-face-comparison.png), [armour](evidence/art-restoration/desktop-armour-comparison.png).
- [Matched earlier WebP portrait](evidence/art-restoration/matched-legacy/portrait-aegis-ember.png) / [new portrait](evidence/art-restoration/after/portrait-aegis-ember.png): 390×844, 3× density. [Face](evidence/art-restoration/portrait-face-comparison.png), [armour](evidence/art-restoration/portrait-armour-comparison.png).
- Matched comparisons deliberately use the actual legacy asset fallback at the final layout size; tests assert identical viewport, density and actor dimensions. The initial old-build shots are preserved separately. Pip/Prism desktop now uses the native-size cap (432 versus earlier 486.39 CSS pixels), so that size change is not misrepresented as compression-only improvement. Ground positions change with baseline correction.
- Native-pixel source comparison, **left approved PNG / middle previous WebP / right final packed WebP**: [Aegis face](evidence/art-restoration/native-aegis-face-master-old-new.png), [armour](evidence/art-restoration/native-aegis-armour-master-old-new.png). All twelve have `native-<id>-master-old-new.png` and isolated `master-<id>-idle.png` alongside these files. Screenshot close-ups crop actual device pixels without upscaling them.
- [Complete restored battle MP4](evidence/art-restoration/aegis-victory.mp4) / [original WebM](evidence/art-restoration/aegis-victory.webm): actual Easy Aegis/Ember play, basic attacks, defence/counter, companion specials, opponent knockout, victory, refresh and reduced rematch. Watermarked signed disposable-holder/synthetic-RPC QA; not a consenting live-holder session. No retiming or fabricated outcomes.

- [All twelve 3× portrait captures and measurements](evidence/art-restoration/portrait-roster/measurements.json): files named `<id>.png` beside the measurements. Maximum measured fighter-ground difference is 0.315 CSS pixels.

## Presentation preserved and polished

Current-move replacement, three-second independent expiry, full-screen dialog, cooldown wording, ground alignment, focus, settings and opt-in history remain. Attacks hold their existing pose through real contact instead of returning to idle on the damage frame. Actual damage controls hurt reactions; guard/counter and coordinated companion specials consume the existing authoritative projection. Defeated actors retain the defeated pose through later events, result and refresh; companions settle rather than continuing idle hover. Rematch starts a new persisted match. Existing lunges and returns remain, with no rules/stat/policy/schema changes.

Source PNGs, database files, private/official ownership protections and secondary URLs remain. Free movement is **documentation only** in [the future approach](ARENA_MOVEMENT_FUTURE.md). No unused movement interfaces, controls or dependencies were added.

## Verification and remaining gates

`npm test`: **200 passed, 34 suites, one optional live test skipped**. Formatter, lint, pipeline lint/format, typecheck and production build pass. Full production browser run: **48 passed**. On the final build, **all five focused flows passed**, including the new all-twelve 3×-density portrait check, matched comparisons, complete battle and both asset-failure paths. **49 distinct browser flows pass across the full/focused runs**, not a single 49-case run. Existing optional provider/Ox Tempo build warnings remain. Browser checks use installed Chrome and isolated SQLite/RPC/disposable signing fixtures, preserving the user's local database. Native screen-reader, cross-browser, low-end/GPU memory and human balance/enjoyment tests are not claimed.

Evidence commands/results: [unit tests](evidence/art-restoration/tests.txt), [format](evidence/art-restoration/format.txt), [lint](evidence/art-restoration/lint.txt), [types](evidence/art-restoration/types.txt), [build](evidence/art-restoration/build.txt), [full browser](evidence/art-restoration/browser.txt), [initial focused checks](evidence/art-restoration/browser-focused.txt), [final five focused checks](evidence/art-restoration/browser-final-focused.txt). The final focused run uses the rebuilt source after an equivalent pose-selector simplification; unchanged unrelated flows were not rerun. A test-only Node JSON-import incompatibility was corrected before those five flows passed. A TypeScript check briefly overlapped a build replacing generated types; the final check ran after the build and passed. A retained pilot clipping test was corrected to count its newly clipped original-art fallback as well as the pilot frames; its actual 208×391 pilot clipping assertions remain.

Desloppify ran before/after in this repository, with existing generated/dependency/cache exclusions and ignored state. No authored source was excluded and no suppressions/accepted-debt decisions or invented ratings were used. A newly exposed pose-selector complexity warning was resolved by making terminal, missing-frame, damage and attack-phase branches explicit. Raw [before scan/status/next](evidence/art-restoration/before-scan.txt), [final scan](evidence/art-restoration/scan.txt), [status](evidence/art-restoration/status.txt), [next](evidence/art-restoration/next.txt) retain results. Unassessed subjective review and pre-existing coverage/security/structural findings remain; the strict target 85 is unmet. This focused visual restoration is not an unrelated repository-wide health campaign.

Remaining resolution limit: most approved cells contain only 300–430 useful character pixels, with small faces and fine fur/metal detail. Several effects reach existing source cell edges; packing cannot recreate missing source pixels. Larger genuinely faithful source renders would be needed for fully detailed retina-sized figures or new smooth animation. No higher-resolution regeneration is made default, and no source design changes are introduced. User visual acceptance is the next art gate; Blender conversion to additional fighters remains off the current direction. No commits, pushes, deployments, purchases, transfers, paid services or real user-wallet signatures occurred.

## Final Desloppify dimensions

Overall 22.5, objective 90.0, strict 21.3, verified 90.0; 159 open at this scan. Initial objective/strict was 89.6/21.3. No strict improvement or target achievement is claimed. The newly added comparison test follows the existing snakecase test-file convention; a post-rename discovery check still lists all 49 cases.

| Dimension         | Health | Strict |
| ----------------- | -----: | -----: |
| Code quality      |   98.4 |   96.3 |
| Security          |  100.0 |   98.4 |
| File health       |  100.0 |  100.0 |
| Duplication       |  100.0 |   99.9 |
| Test health       |   46.5 |   24.5 |
| Abstraction fit   |    0.0 |    0.0 |
| AI generated debt |    0.0 |    0.0 |
| API coherence     |    0.0 |    0.0 |
| Auth consistency  |    0.0 |    0.0 |
| Contracts         |    0.0 |    0.0 |
| Convention drift  |    0.0 |    0.0 |
| Cross-module arch |    0.0 |    0.0 |
| Dep health        |    0.0 |    0.0 |
| Design coherence  |    0.0 |    0.0 |
| Error consistency |    0.0 |    0.0 |
| High elegance     |    0.0 |    0.0 |
| Stale migration   |    0.0 |    0.0 |
| Init coupling     |    0.0 |    0.0 |
| Logic clarity     |    0.0 |    0.0 |
| Low elegance      |    0.0 |    0.0 |
| Mid elegance      |    0.0 |    0.0 |
| Naming quality    |    0.0 |    0.0 |
| Structure nav     |    0.0 |    0.0 |
| Test strategy     |    0.0 |    0.0 |
| Type safety       |    0.0 |    0.0 |

All twenty subjective dimensions remain unassessed; their zero values are scanner state, not design-review judgments. Direct renderer clipping/contact tests resolve a relevant previous coverage warning. Existing hook/import-linked coverage findings and broader debt remain; browser coverage does not imply every file has a direct unit test.
