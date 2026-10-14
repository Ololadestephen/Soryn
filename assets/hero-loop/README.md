# Sanctuary atmospheric loop

Editable source: `index.html`, using only the approved environment in `environment.webp` (copied unchanged from `public/combat/arenas/sanctuary-desktop.webp`). `design.md` preserves the art direction. HyperFrames 0.8.115, WAAPI adapter, 24 fps, ten seconds, no audio. Current user direction replaces the earlier locked camera with a slow glide across the complete world. All animation endpoints match; the final encoded frame is 1/24 second before the next identical cycle start.

The current **motion-v3** export moves the complete painted world on one smooth periodic camera path: ±18px horizontally, ±6px vertically, at a constant 1.07 scale. Buildings, ground and floating cliffs retain their proportions and shift together. Fixed overscan covers all travel; branding stays outside the video. Clouds move inside a feathered sky region, flower tips rotate in isolated polygons, three mist layers drift across the chasm/foreground, 24 deterministic gold motes rise and fade, seven sparse petals fall, and sunlight softly returns. Particle phases are staggered, so motion is present at the loop start. This is layered rendered artwork with camera motion, not simulated 3D or AI-generated motion. Existing painted clouds remain beneath the small moving region; do not claim volumetric weather, independently animated cliffs or fully rigged vegetation.

Reproduce from the repository root with the already-installed HyperFrames executable:

```sh
PATH="/opt/homebrew/bin:$PATH" node scripts/render-hero.mjs /absolute/path/to/hyperframes/bin/hyperframes.mjs
```

No application dependency was added. The installed CLI is currently cached at `/Users/apple/.npm/_npx/702923228c2ce1e6/node_modules/hyperframes/bin/hyperframes.mjs`. Installing the published version elsewhere is an explicit dependency operation. The script checks, renders a disposable master under `.cache/hero/`, and compresses the two silent H.264/yuv420p/fast-start exports. Mobile crops the same approved centre, then scales to 540×844; scaling does not create more source detail. Existing desktop/portrait WebP arena files are the immediate posters and remain unchanged.

Outputs are `public/hero/sanctuary-motion-v3-desktop.mp4` (1280×720, 2,119,766 bytes) and `sanctuary-motion-v3-mobile.mp4` (540×844, 787,207 bytes). Previous exports remain available for comparison. The app requests versioned paths to avoid reusing the earlier stationary-world loop. [Whole-world motion evidence and limitations](../../docs/WORLD_HERO_MOTION.md), [previous atmospheric pass](../../docs/VISIBLE_HERO_MOTION.md).

To edit visually, run the installed CLI `preview assets/hero-loop --background --port 3017` and open its printed Studio project URL. `check assets/hero-loop` passes lint/runtime/layout/contrast checks; WAAPI-only source declares `data-no-timeline` and no empty GSAP timeline is used. Both public exports contain video only. External usage/freshness services were unavailable; local usage allowance was unknown. All production was local; no paid generation or upload was used.
