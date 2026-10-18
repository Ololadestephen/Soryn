# Sanctuary arena loop

The editable source is `index.html`, using the approved painting in `environment.webp`. It is a ten-second, 24fps, silent composition with paused, deterministic WAAPI animations and the existing HyperFrames `data-no-timeline` contract. The whole world retains the approved periodic glide (±18px horizontally, ±6px vertically, fixed 1.07 scale); mist, light, motes and petals remain inside that world. This is motion over rendered artwork, not a reconstructed 3D scene.

The current **motion-v4** export removes the independently translated/rotated copies of painted clouds and vines. Those clipped copies also included architecture and produced doubled edges. The single complete painting is now the only architectural layer. No extra darkening, blur or masking conceals the repair. Earlier source revisions and v1–v3 runtime exports remain available through existing files/history; the original painting is unchanged.

## Reproduce locally

With the existing Playwright, Sharp and FFmpeg installations:

```sh
node scripts/render-hero.mjs
```

The offline fallback seeks every paused animation to each of 240 exact frame times, captures the composition in Chromium, and pipes the frames to a disposable master in `.cache/hero/`. It verifies the ten-second duration contract. It does not install dependencies or contact a rendering service. This is a local browser capture fallback, not a claim that HyperFrames CLI validation ran.

If a HyperFrames CLI is already installed, the original checked CLI path remains supported:

```sh
node scripts/render-hero.mjs /absolute/path/to/hyperframes/bin/hyperframes.mjs
```

That path runs the CLI's `check` and `render` before the same delivery exports. The previously documented npm-cache CLI path is no longer present on this machine; usage allowance is unknown. No download, paid render or upload is required by the fallback.

Outputs: `public/hero/sanctuary-motion-v4-{desktop,mobile}.mp4` and corresponding `.webp` posters. Desktop remains1280×720; mobile retains the existing460:720 centre crop, exported540×844. Both H.264/yuv420p files have fast-start metadata. Each poster is exported from the first **encoded frame of its own variant**, so it shares the video framing, overscan and colour treatment. Export scaling adds no source detail. Runtime uses matching object-fit/position and swaps variants only across the700px breakpoint.

The app requests video as soon as client preferences can be checked, without a page-load dependency or enhancement timer. Reduced motion and Save-Data do not request video. Slow loading, decode failure and autoplay rejection leave the poster visible; navigation never waits for video. The video becomes visible only after a rendered-frame callback, with a short120ms fade. Original combat arena images, fighters, game rules and saved records are untouched.
