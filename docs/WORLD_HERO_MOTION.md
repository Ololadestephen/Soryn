# Whole-world landing motion

October 14, 2026. Current user direction: make the whole building and cliffs move neatly, beyond mist and falling particles. This supersedes the earlier locked-camera brief. The approved painting remains the source of the buildings, floating cliffs, ground and vegetation.

The complete world now follows a slow periodic camera glide. A single wrapper moves every scene layer together, so stone columns, distant cliffs and the arena floor retain their shape and alignment. Travel is ±18px horizontally and ±6px vertically at 1280×720. A constant 1.07 scale provides 26.8px horizontal and 19.2px vertical coverage margin at the maximum offsets; the camera never exposes the image boundary. The ten-second path has matching positions and velocities at its endpoints. There is no changing scale, geometry bending or newly cut-out building layer. Mist, motes, petals and light retain their local motion within that world. Text, branding, buttons and navigation remain fixed outside it.

This is camera motion over rendered artwork, not independently animated cliff models or a reconstructed 3D scene. Portrait keeps the existing central crop; it cannot show the complete wide environment simultaneously. Original masters, v1/v2 exports and editable animation source remain intact. Gameplay, saved battles, ownership and identity are unchanged. Automatic playback has no scene controls; reduced-motion/data saving and media-failure poster fallback remain available.

## Review evidence

- Actual page recordings: [desktop](evidence/world-hero-motion/desktop-actual-page.mp4), [3× portrait screenshot test / portrait recording](evidence/world-hero-motion/portrait-actual-page.mp4). The portrait recorder outputs 390×844 video; page screenshots use device scale 3. Both record automatic playback for more than one loop, refresh and entry to usable arena setup.
- Natural playback frames three seconds apart: [desktop A](evidence/world-hero-motion/desktop-a.png), [desktop B](evidence/world-hero-motion/desktop-b.png), [portrait A](evidence/world-hero-motion/portrait-a.png), [portrait B](evidence/world-hero-motion/portrait-b.png). Pixel comparison runs after the poster crossfade. The same test asserts the copy's bounding box stays fixed. [Desktop measurements](evidence/world-hero-motion/desktop-visible-motion.json), [portrait measurements](evidence/world-hero-motion/portrait-visible-motion.json).
- [Architecture tracking](evidence/world-hero-motion/architecture-drift.json): matching encoded-frame details at 0s and 5s in a stone column, floating cliff and ground ring all locate the same **36px rightward / 0px vertical** displacement. This verifies that the scene itself moves coherently, beyond changing mist.
- [Loop transition measurements](evidence/world-hero-motion/loop-transition.json) include adjacent frames and frame239→frame0. Encoded frame differences include subpixel resampling and H.264 compression; matching source endpoints does not mean the final encoded frame is pixel-identical to the next cycle's first frame.
- Previous atmosphere-only page recordings remain in [the prior report](VISIBLE_HERO_MOTION.md), with the same desktop and portrait viewports.

## Export cost and reproduction

The silent H.264/yuv420p exports remain ten seconds at 24fps with fast-start: desktop 1280×720, 2,119,766 bytes; portrait 540×844, 787,207 bytes. They replace v2's 592,457 / 321,905 bytes. Moving the full textured painting costs more encoded data than isolated mist/particles. These remain deferred requests; cold initial-transfer and battle-entry benchmarks were not repeated for this visual correction.

Per-frame decoded estimates are unchanged: YUV420 1.32MiB desktop / 0.65MiB portrait, RGBA 3.52 / 1.74MiB. Decoder queues/textures hold multiple frames; these are not total process-memory figures. [Media dimensions, bytes, coverage and frame estimates](evidence/world-hero-motion/media-sizes.json). Source artwork resolution is unchanged; the fixed overscan and portrait export scaling do not create additional source detail.

Editable source and reproduction are in [the animation README](../assets/hero-loop/README.md). The render script checks the composition, renders a disposable master and exports versioned `sanctuary-motion-v3-{desktop,mobile}.mp4` files. The controller uses those new URLs. HyperFrames 0.8.115 runs locally with WAAPI, screenshot capture and hardware GPU. No dependencies were installed and no paid service or upload was used. The usage check initially returned `unknown` and responded with known status on the final check; no allowance was assumed during production.

## Verification

Formatting, ESLint, TypeScript, 226 app tests (one optional live RPC skip), production build and HyperFrames lint/runtime/nine layout samples pass. Ten focused production browser cases pass: desktop/portrait repeat playback, fixed copy with moving page pixels, refresh, home links, offscreen resume, reduced motion/data saving, autoplay rejection, failed/slow media and usable Play navigation. Across three seconds of naturally playing page screenshots, channels differing by more than 8/255 cover 37.57% on desktop and 18.51% on portrait; these measure visible page changes, not human perception. [Command outputs](evidence/world-hero-motion/quality/).

Desloppify scan/status/next run before and after on this project only. Overall 22.8 and strict 21.6 remain unchanged; objective/verified 91.1→91.2 and open 191→190 reflect the existing tactical coverage classification's scan variability. No new open finding targets the changed controller or motion test. No score-gaming exclusions or suppressions were added. Twenty subjective dimensions remain unassessed and strict 85 remains unmet. The scanner's legacy `next lint` detector remains unavailable on Next16; direct ESLint passes.

Local preview runs at `http://127.0.0.1:3000/`. No commits, pushes or deployments.
