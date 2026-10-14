# Animated Sanctuary and battle readiness

October 14, 2026. This milestone keeps the approved Déjà Vu identity, original sculpted rendered fighter/companion artwork, four environments and authoritative combat. No changes to combat balance, difficulty policies, ownership/authentication, persisted record formats or public/private history. The editable Blender pilot remains available. Testing uses the existing isolated SQLite/RPC/signed-fixture harness; the user's saved battles are untouched. No dependencies, paid services, commits, pushes or deployments were added.

## Hero delivery

A ten-second 24 fps locked-camera loop uses the approved Sanctuary painting. Clouds drift inside a feathered sky mask; chasm mist, isolated hanging flower tips, fourteen sparse motes and soft sunlight move independently. Stone architecture and the camera stay fixed. This is layered rendered artwork, not a 3D environment simulation. The restrained movement preserves the painting; it does not invent new views behind it.

- [Desktop H.264 MP4](../public/hero/sanctuary-desktop.mp4), 1280×720, 460,371 bytes.
- [Portrait H.264 MP4](../public/hero/sanctuary-mobile.mp4), 540×844, 208,212 bytes.
- Both: yuv420p, fast-start metadata, ten seconds, **no audio stream**. Broadly supported MP4 with the original static WebP as fallback.
- Immediate posters remain [desktop 1672×941 / 485,850 bytes](../public/combat/arenas/sanctuary-desktop.webp) and [portrait 602×941 / 156,234 bytes](../public/combat/arenas/sanctuary-portrait.webp), unchanged. Estimated decoded RGBA: 6,293,408 and 2,265,928 bytes. Video frame buffers/decoder memory are additional and browser-dependent, not measured heap estimates.
- [Editable HTML/WAAPI source and reproduction instructions](../assets/hero-loop/README.md), [brief](../assets/hero-loop/BRIEF.md), [design](../assets/hero-loop/design.md), [export script](../scripts/render-hero.mjs), [dimensions/bytes/hashes/streams](evidence/cinematic-readiness/hero-manifest.json).

The HTML initially contains no video URL. Enhancement waits until page load plus 1.5 seconds, so immediate content/navigation are independent. One viewport variant is chosen at mount and remains selected on resize, avoiding a second download. Video opacity changes only after successful playback and a presented-frame callback (decoded-frame fallback on older browsers). Loading, autoplay rejection and decode/network errors retain the poster without covering the page with controls. Reduced motion and data saver default to static; normal playback starts automatically without an Animate scene prompt. Per the latest user direction, there are no visible scene controls. Hidden/offscreen scenes pause, internal navigation clears the source and pending frame callbacks are invalidated; unmount releases listeners, timer, observer and decoder source.

This is a deliberate 1.5-second enhancement delay, not a first-content delay. Deferred video bytes are **additional**, not eliminated. The byte and timing sections below distinguish initial resources, deferred movie transfer and the full journey.

## Measured diagnosis and changes

Fresh production baselines were captured **before changing the loading path**, with three independent cold browser contexts per target. Downloads were already limited to the chosen battlefield and two fighters/two companions, in parallel. The largest avoidable problems were:

1. Setup immediately downloaded twelve near-lossless idle previews, about 1.5 MB, even though most were below the fold. Those requests competed with the battle POST and selected pose atlases. Setup cards now use the existing lazy 128×128 catalogue thumbnails; they display at 42–55 CSS px. The selected large portrait retains its full-quality idle export. Nothing preloads the full battle roster or all four full environments.
2. Guest pose atlases cost 1,986,036 bytes; Aegis/Ember cost 3,954,566. Full-resolution quality-94 WebP RGB exports reduce these to 1,007,536 and 1,799,652 bytes. **Every atlas dimension, pose cell, transparent alpha value, logical canvas, offset and ground pivot is unchanged.** The new encoding is lossy RGB, not an increase in source detail. Original near-lossless and legacy files remain fallback tiers.
3. Stable setup choices now prepare only the selected pair and selected viewport arena after 600 ms. Changing selections cancels abandoned image work; random arena selection waits for the authoritative resolved choice. Shared work is reference-counted. Successful decoded Image objects remain reusable for rematches, with a 48 MiB estimate-based retention budget. The budget controls our references, not the browser's independent cache/GPU memory.
4. Optional audio starts after visual preparation and is not awaited by the artwork gate. Sound preference and event synchronization remain intact. Required actor failure keeps moves disabled and offers Retry artwork against the **same saved battle**, without another start or write. A successful retry remounts the failed artwork view. Environment failure uses the existing clear background fallback. All six fighter poses and all three companion poses must decode (or have a valid full fallback) before moves unlock; no staged animation skipping.

The traces show image decoding in tens of milliseconds, versus many seconds of shared-bandwidth transfer. API time and long JavaScript tasks are recorded, but are not the dominant cold path. No animation duration was shortened. Each first move still resolves through the real engine and completes the normal event presentation.

## Comparable production measurements

Chrome 155.0.8059.41, Apple M3 / 8 GiB host, 390×844 CSS pixels at DPR 3, 6× CPU throttle, 1.6 Mbps down / 750 kbps up, 150 ms latency, browser cache disabled, already-running Node production server. This is browser emulation, not a physical low-end phone. Sound is consistently disabled in these comparable samples; audible behavior is covered separately. The heavier pair uses valid disposable signed-holder test transport and synthetic ownership RPC, never the user's wallet.

Raw samples: [before](evidence/cinematic-readiness/before/), [after](evidence/cinematic-readiness/after/), [summary and stage breakdown](evidence/cinematic-readiness/performance-summary.json). The instrumentation records Play, setup, selection, Start, image requests, explicit decode calls, battlefield/move readiness and first animation completion. Resource Timing includes individual API duration and time to first byte. It does not isolate pure server computation from transport; no server-only latency claim is made. Long-task totals cover the observed journey, not just initial hydration. Screenshot time between move-enabled and move-click is separately recorded.

| Measurement | Before samples (ms) | Before median | After samples (ms) | After median |
| --- | --- | ---: | --- | ---: |
| Cold landing usable | 2397, 2133, 2161 | 2,161 ms | 2461, 2171, 2190 | 2,190 ms |
| Play → usable setup | 993, 981, 983 | 983 ms | 1098, 1045, 1142 | 1,098 ms |
| Start → usable battle | 18293, 18187, 18258 | 18,258 ms | 6959, 6666, 6853 | 6,853 ms |
| Play → usable battle | 19314, 19190, 19266 | 19,266 ms | 8084, 7737, 8023 | 8,023 ms |
| Cold direct guest resume | 13299, 13281, 13304 | 13,299 ms | 8278, 8444, 8452 | 8,444 ms |
| Cold direct Aegis/Ember resume | 22871, 22932, 22840 | 22,871 ms | 11795, 11909, 11764 | 11,795 ms |
| First move click → animation done | 3389, 3385, 3427 | 3,389 ms | 3436, 3510, 3438 | 3,438 ms |

The five-second cold-battle target remains unmet at this fidelity. The heavier pair alone retains about 1.8 MB before its environment and application resources—roughly nine seconds of payload at the stated 200 KB/s ceiling. The direct guest pair remains about 1 MB before those resources. Faster delivery would require further codec/pose delivery work or accepting more source loss; no such unreviewed change is claimed here. Actual setup dwell overlaps selected preparation, and warm rematch avoids repeated decoded-asset work.

| Viewport | Initial page transfer (CDP wire bytes) | Deferred movie transfer | Movie file bytes |
| --- | ---: | ---: | ---: |
| desktop | 695,755 | 460,705 | 460,371 |
| mobile | 366,139 | 208,546 | 208,212 |

These separate transfer observations use disabled cache without throttling and no scrolling; CDP counts HTTP overhead, so they differ slightly from the throttled Resource Timing table. Only one hero variant is requested. Portrait landscape rotation retains that chosen variant. [Desktop details](evidence/cinematic-readiness/after/transfer-desktop.json), [mobile details](evidence/cinematic-readiness/after/transfer-mobile.json).

| Atlas scope | Original compressed | New compressed | Decoded RGBA estimate, unchanged |
| --- | ---: | ---: | ---: |
| Pip/Bolt and companions | 1,986,036 B | 1,007,536 B | 12,246,732 B |
| Aegis/Ember and companions | 3,954,566 B | 1,799,652 B | 23,412,960 B |
| Full roster on disk, never preloaded together | 14,082,532 B | 6,792,072 B | 74,806,032 B |

The selected arena adds 156,234 compressed / 2,265,928 RGBA bytes in portrait, or 485,850 / 6,293,408 on desktop. Decoded estimates are width × height × 4, excluding browser/GPU overhead and retained originals. The smaller files save transfer, not decoded resolution or memory. Opaque RGB PSNR ranges from 30.46–37.88 dB across the 24 exports; native-view comparisons remain the acceptance evidence.

## Fidelity evidence

[All 24 atlas byte/dimension records](evidence/cinematic-readiness/atlas-candidates.json) and [all 24 alpha/RGB measurements](evidence/cinematic-readiness/encoding-quality.json) cover the whole roster. No image was resized, sharpened, pixelated or regenerated. Alpha changes are zero; RGB is a high-quality compression tradeoff. Opaque RGB PSNR is a diagnostic rather than a perceptual guarantee. Native original/encoded side-by-side files include [Aegis](evidence/cinematic-readiness/aegis-native-comparison.png), [Ember](evidence/cinematic-readiness/ember-native-comparison.png), [armadillo](evidence/cinematic-readiness/armadillo-pet-native-comparison.png), [phoenix](evidence/cinematic-readiness/phoenix-pet-native-comparison.png), [Pip](evidence/cinematic-readiness/pip-native-comparison.png) and [Bolt](evidence/cinematic-readiness/bolt-native-comparison.png).

The source canvases remain around 418–512 pixels. A DPR-3 screen cannot receive source detail that those paintings never contained. The near-lossless originals remain available when maximum pixel fidelity matters. Battle scale, ground contact, clip rectangles, full-screen HUD/controls and event-controlled animation are preserved. Matched screenshots freeze idle animation and switch only the delivered encoding within the same disposable saved battle:

| View | Original encoding | Delivery encoding |
| --- | --- | --- |
| Desktop DPR2 | [Full](evidence/cinematic-readiness/after/quality-desktop-original.png) · [face/armour](evidence/cinematic-readiness/after/quality-desktop-original-player.png) | [Full](evidence/cinematic-readiness/after/quality-desktop-delivery.png) · [face/armour](evidence/cinematic-readiness/after/quality-desktop-delivery-player.png) |
| Portrait DPR3 | [Full](evidence/cinematic-readiness/after/quality-portrait-original.png) · [face/armour](evidence/cinematic-readiness/after/quality-portrait-original-player.png) | [Full](evidence/cinematic-readiness/after/quality-portrait-delivery.png) · [face/armour](evidence/cinematic-readiness/after/quality-portrait-delivery-player.png) |

[All twelve portrait fighters and measured ground contact](evidence/cinematic-readiness/after/portrait-roster/measurements.json). Catalogue thumbnails explicitly contain their original proportions within the 42–55px selection boxes.

## Verification and review

226 app tests and 47 production browser cases pass across full/focused runs (including the three samples per timing target and the whole-roster check); one optional live-RPC test is skipped. Formatting, ESLint, TypeScript and production build pass. Three-run cold production profiles cover landing, the complete Play/Start/action path and guest/heavy direct resume. Whole-roster DPR-3 checks pass for all twelve families. Focused production tests cover legacy/original fallbacks, same-save retry, selection cancellation, all four arena choices, refresh/rematch, slow/failed hero requests, rejected autoplay, static preferences, complete guard/basic/special/knockout and normal/reduced-motion outcome equivalence. No scene play/pause controls remain, following the latest user instruction.

The final control-free build passes 18 focused production cases, including three-loop desktop/portrait playback, failures, same-save recovery, matched art, transfers, real gameplay and all shared media/accessibility checks. Earlier complete production runs retain the repeated timing samples and whole-roster/presentation cases.

The normal/reduced-motion regression now waits for usable moves before selecting its first action, so a loading-disabled Special is not mistaken for an illegal move. A transient recorded-gameplay playback assertion passed on rerun and in the visible local browser; final production media checks are retained with the rest of the evidence. Screenshots are cropped from full-resolution captures using measured actor bounds, avoiding the browser's incorrect direct SVG element screenshot crop. Warm rematch took 1033 ms in one unthrottled observation ([record](evidence/cinematic-readiness/after/warm-rematch.json)); it is not a three-run median.

[Desktop hero](evidence/cinematic-readiness/after/hero-desktop-loop-3.png), [portrait hero](evidence/cinematic-readiness/after/hero-portrait-loop-3.png), [actual hero → setup → complete battle → rematch recording](evidence/cinematic-readiness/after/journey.mp4), [actual battle record](evidence/cinematic-readiness/after/complete-battle.json). The guest recording shows guard, basic, companion special and knockout. It is real local gameplay, not invented footage. Three consecutive hero cycles at each viewport have captured review frames; a [three-cycle movie](evidence/cinematic-readiness/hero-three-cycles.mp4) and [start/midpoint/seam contact sheet](evidence/cinematic-readiness/hero-loop-review.jpg) support frame inspection; the source endpoints are periodic and stone structures remain stationary. Physical-device decoding, native assistive-technology testing and real-holder signing remain unverified.

Reproduction:

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
CHOG_READINESS_STAGE=before CHOG_E2E_BROWSER_CHANNEL=chrome npm run test:e2e -- tests/e2e/cinematic-readiness/performance.spec.ts
CHOG_READINESS_STAGE=after CHOG_E2E_BROWSER_CHANNEL=chrome npm run test:e2e -- tests/e2e/cinematic-readiness
node scripts/report-readiness.mjs
```

The `before` flag names the output directory; it must be run against the original production implementation to reproduce a baseline. It does not revert code. The checked-in before evidence is from the actual original build, retained independently. Use `CHOG_EVIDENCE_DIR=docs/evidence/cinematic-readiness/after` for the existing roster/media tests to preserve historical milestone artifacts.

## Desloppify

Before and after use the same repository boundary and existing generated/vendor/cache exclusions. [Scan/status/next evidence](evidence/cinematic-readiness/quality/) includes the unassessed subjective queue and reduced legacy Next-lint detector coverage. Direct ESLint and TypeScript are run separately. New lifecycle complexity and nested image-work closures exposed during scanning were replaced with explicit state owners; a direct server-rendered hero test verifies no initial source and no opt-in controls. No findings were suppressed, excluded or marked wontfix to improve scores. Existing naming heuristics, the named memory-budget constant, and a stale generic `result` signature report are retained honestly. No branches, commits or subagents were created from the scanner's suggestions.

| Quality measure | Before | After |
| --- | ---: | ---: |
| Overall | 22.7 | 22.8 |
| Objective | 90.7 | 91.1 |
| Strict | 21.5 | 21.6 |
| Verified | 90.7 | 91.1 |
| Open findings | 192 | 191 |

The strict target of 85 remains unmet. Twenty subjective dimensions remain unassessed; this milestone does not claim a clean codebase or completed subjective health campaign.
