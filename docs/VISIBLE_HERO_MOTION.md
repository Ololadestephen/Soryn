# Visible landing motion

October 14, 2026. The user still perceived a static background after the home-navigation playback repair. Checking `paused=false` and an advancing video clock was insufficient: the original export's motion was faint, the portrait centre crop removed both animated vines, and the dark landing overlay attenuated the remaining mist and tiny motes. This task addresses that visible presentation rather than changing the combat game.

The approved Sanctuary painting, locked camera, stonework, layout and branding remain fixed. The new ten-second silent export strengthens the existing cloud drift and returning light, adds a foreground mist layer, increases the chasm mist's travel, and positions staggered gold motes and seven sparse falling petals inside the portrait crop. Motion is present at time zero rather than all particles fading in together. These are animated layers over rendered artwork; the scene is not a fully animated 3D environment.

The controller now loads versioned `sanctuary-motion-v2-{desktop,mobile}.mp4` files, avoiding reuse of the old media URL. There are no scene play/pause buttons. Existing delayed loading, offscreen pause/resume, reduced-motion/data-saving preferences and poster fallback are preserved. Source painting, earlier exports, editable HTML and render script remain available. No game rules, battles, wallet policy or stored history changed.

## Evidence

- [Actual desktop page recording](evidence/visible-hero-motion/desktop-actual-page.mp4) and [portrait page recording](evidence/visible-hero-motion/portrait-actual-page.mp4): automatic playback, more than one loop, refresh and usable Play navigation. Browser recordings are unthrottled; portrait screenshots use 390×844 at device scale 3, while the recorder outputs 390×844 video.
- Comparable natural-playback screenshots, three seconds apart: [desktop A](evidence/visible-hero-motion/desktop-a.png), [desktop B](evidence/visible-hero-motion/desktop-b.png), [portrait A](evidence/visible-hero-motion/portrait-a.png), [portrait B](evidence/visible-hero-motion/portrait-b.png). [Desktop pixel measurement](evidence/visible-hero-motion/desktop-visible-motion.json), [portrait pixel measurement](evidence/visible-hero-motion/portrait-visible-motion.json). The test waits for the poster crossfade to finish before comparing actual page pixels.
- [Old/new encoded frame measurements](evidence/visible-hero-motion/encoded-motion-comparison.json), comparing the same 0/2.5/5/7.5-second phases. At five seconds, channels changing by more than 8/255 increase from 2.37% to 10.76% across the desktop frame, and from 2.87% to 13.63% in the central portrait crop. This measures frame changes, not a human perception score; the page overlay reduces their apparent strength.

## Media cost

Both exports are H.264/yuv420p, 24 fps, ten seconds, no audio, fast-start. Desktop is 1280×720 and 592,457 bytes (previously 460,371); portrait is 540×844 and 321,905 bytes (previously 208,212). The larger files are deferred video, not an added initial poster request. Initial transfer and cold battle-entry timing were not re-benchmarked in this focused correction.

One decoded frame is approximately 1.32 MiB desktop / 0.65 MiB portrait in YUV420, or 3.52 / 1.74 MiB in RGBA. Browser decoder queues and GPU textures can hold multiple frames; these are per-frame estimates, not total process memory. [Exact dimensions, bytes and estimates](evidence/visible-hero-motion/media-sizes.json).

## Verification

HyperFrames 0.8.115 passes lint, runtime and nine layout samples with zero warnings. Local export used screenshot capture with hardware GPU, one worker; no paid generation or upload. Usage service returned `unknown`; no allowance is assumed. The locally installed CLI remains unchanged.

226 app tests pass across 44 files; one optional live RPC test is skipped. Ten focused production browser cases pass, covering three desktop/portrait loops, repeated home links, scrolling, reduced-motion/data saving, autoplay rejection, failed/slow media, visible pixel changes, refresh and arena entry. The final exported pass also receives a focused desktop/3× portrait recording rerun. Formatting, ESLint, TypeScript and production build pass. [Command outputs](evidence/visible-hero-motion/quality/).

Desloppify scan/status/next run before and after on this project only. The new test's initially hardcoded loopback URL was replaced with Playwright's configured base URL and the finding auto-resolved. Overall22.8/strict21.6 remain unchanged; objective/verified91.2→91.1 and open190→191 reflect the existing tactical engine's repeatedly changing transitive-coverage classification. No open finding targets the new browser test. No suppressions, exclusions or wontfix decisions were added. Twenty subjective dimensions remain unassessed and the strict 85 target remains unmet; this focused presentation fix does not complete a repository health campaign. The scanner's legacy `next lint` detector remains unavailable on Next16; direct ESLint passes.

Local preview: `http://127.0.0.1:3000/`. Reproduce with the existing installed CLI via `node scripts/render-hero.mjs <absolute-cli-path>`, then `npm run build` and `npm start -- --port 3000`. Focused browser verification: `CHOG_E2E_BROWSER_CHANNEL=chrome npm run test:e2e -- tests/e2e/cinematic-readiness/hero.spec.ts tests/e2e/cinematic-readiness/playback-navigation.spec.ts tests/e2e/cinematic-readiness/visible-motion.spec.ts`.
