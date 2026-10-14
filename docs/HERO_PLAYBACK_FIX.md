# Hero playback navigation repair

October 14, 2026. The local landing had a reproducible playback defect: clicking the home logo while already at `/` triggered the generic navigation cleanup. It cleared the video, latched `navigating=true`, and left the poster visible indefinitely because Next retained the same page/component. This was reproduced in the in-app browser before editing: playback changed from running to paused/time zero/data-ready false after the home link.

The controller now stops media only for an ordinary current-tab internal link to a different pathname. Same-page home/hash/query links, modifier clicks, download links and other targets do not latch the shutdown state. Actual arena navigation still releases the hero media. Source video, approved artwork, animation strength, gameplay, saved battles, owner/auth policy and the absence of scene controls are unchanged.

The fixed local preview was checked through the same home-logo interaction: the video remained unpaused and advanced from 5.35 to 5.76 seconds across the click. [Desktop regression playback samples](evidence/hero-playback-fix/desktop-playback.json) and [portrait samples](evidence/hero-playback-fix/portrait-playback.json) verify continued clock progress after repeated home clicks, pausing offscreen, automatic return into view, no scene controls and transition to usable battle setup. [Desktop screenshot](evidence/hero-playback-fix/desktop.png), [portrait screenshot](evidence/hero-playback-fix/portrait.png).

Verification on the production build:

- 226 app tests pass across 44 files; one optional live RPC test skipped.
- Eight focused browser cases pass: two new navigation regressions and the six existing hero lifecycle/media checks, including three consecutive loops on desktop/portrait, reduced-motion/data-saver static behavior, autoplay rejection, failed/slow media and battle navigation.
- Formatting, ESLint, TypeScript and production build pass.
- Desloppify same-boundary scan/status/next before and after completed. Overall22.8/strict21.6; objective/verified91.2→91.1 and open190→191. No new finding is attached to the changed controller or new regression file; existing detector classifications remain. Twenty subjective dimensions remain unassessed; strict85 is unmet. No exclusions, suppressions or wontfix decisions were added.
- [Commands and complete outputs](evidence/hero-playback-fix/quality/). No dependencies, paid services, commits, pushes or deployments.

Run locally with `npm start -- --port 3000` after `npm run build`. Focused verification: `CHOG_E2E_BROWSER_CHANNEL=chrome npm run test:e2e -- tests/e2e/cinematic-readiness/playback-navigation.spec.ts tests/e2e/cinematic-readiness/hero.spec.ts`.

Reduced-motion/data-saving preferences still intentionally select the poster. Autoplay/decoder failure also keeps the poster, so this fix is not a guarantee that every device permits background video. Motion remains the approved restrained environmental loop.
