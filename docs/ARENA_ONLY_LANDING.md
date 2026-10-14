# Arena-only landing refinement — October 14, 2026

**Current identity — October 14, 2026:** [the complete game rebrand](REBRAND.md) and [shared design system](GAME_IDENTITY.md) supersede earlier palette, typography, hero copy and decoration described here. Approved rendered artwork and existing functionality remain preserved.

Implemented locally at http://127.0.0.1:3000/. This supersedes the character/portal hero in [the earlier cinematic milestone](CINEMATIC_LANDING.md). The original rendered fighters, companions and ability presentations remain in the roster and combat.

## Presentation and scope

The approved Ruined Sanctuary environment is the full-bleed hero. Aegis, Ember, their companions, their name caption, edge rails, panels, scroll hints, motes, breathing, pointer parallax and scroll-driven reveal were removed from this hero. Obsolete hero/arrow CSS and listeners were removed rather than hidden. The exact new supporting copy is “Turn-based creature battles. Twelve fighters. Powerful companions. Your move.” The headline, guest note, real Play link and roster anchor remain readable in initial HTML.

Only the environment has a 360ms entrance fade, from 86% to full opacity. Text and buttons stay still and are never gated by it. Reduced motion disables the fade; visibility/media listeners and an intersection observer pause it offscreen or hidden and release on unmount. No animation loops, lateral transitions, scene zoom, scroll locking, automatic carousel or new dependency were added.

Landing links use descriptive text. Previous/next arrow buttons were removed; all twelve named fighter selectors remain in a wrapping grid. Tab/Enter/Space and the existing Left/Right/Home/End keyboard navigation remain available. The four arenas retain named thumbnail buttons. The preview play glyph and other ornamental link marks were removed as well. The shared footer defaults to its original symbol on game pages; the landing explicitly opts out. No meaningful controls elsewhere were stripped.

Mobile has 36px top padding, a 36–44px heading and a responsive portrait crop. The open arena fills the remaining scene. Safe-area-aware side/bottom padding protects the hero and header. No new copy/cards/stats were added to fill the removed fighter layer. Environment image dimensions and compression are unchanged; no regeneration, sharpening, blur or pixelated rendering was used.

Combat rules, balance, policies, renderer, sound preferences, Privy/ownership, APIs/persistence and arena-handoff validation were not changed. Shared character/companion exports and Blender work remain available. Navigation does not create a match: a validated arena suggestion still opens setup, and an existing active battle keeps its ID/state/arena and offers Resume saved battle.

## Before and after

Captured at the same viewport and character-free/character-present hero scroll position (top of page), using the production builds. Desktop is 1280×800 at DPR1; portrait is 390×844 at DPR3 (1170×2532 image pixels).

| View | Before | After |
| --- | --- | --- |
| Desktop | [Original hero](evidence/arena-only-landing/before/desktop-hero.png) | [Arena-only hero](evidence/arena-only-landing/after/desktop-hero.png) |
| High-density portrait | [Original hero](evidence/arena-only-landing/before/mobile-hero.png) | [Arena-only hero](evidence/arena-only-landing/after/mobile-hero.png) |

[Desktop roster](evidence/arena-only-landing/after/desktop-roster.png), [portrait roster](evidence/arena-only-landing/after/mobile-roster.png), [portrait arena selection](evidence/arena-only-landing/after/mobile-arena.png).

[Actual browser recording, H.264 MP4](evidence/arena-only-landing/after/browser-tour.mp4) · [original WebM](evidence/arena-only-landing/after/browser-tour.webm). The silent 15.64s recording shows the arena-only hero, named Aegis/Ember selections and special previews, four environment choices and Sky Temple setup. It uses a fixed 1280×800 viewport with no promotional overlay, fabricated match, damage or result.

## Measured loading difference

Fresh before/after samples use installed Chrome 155.0.8059.40 on Apple M3/8GiB, 390×844/DPR3, 6× CPU slowdown, 1.6Mbps down, 750kbps up, 150ms latency and disabled cache. The server is already running: “cold” means a cold browser load, not server/process startup. This repeats the previous report's profile.

| Metric | Before | After |
| --- | ---: | ---: |
| Initial transferred bytes | 824,450 | 359,911 |
| Initial hero image count | 5 | 1 |
| Initial hero image bytes | 617,250 | 156,234 |
| First contentful paint | 0.912s | 0.740s |
| Enhanced roster controls ready | 4.303s | 2.173s |
| All hero artwork complete | 4.470s | 2.209s |
| Largest contentful paint | 4.376s | 2.148s |
| CLS | 0 | 0 |

Initial transfer fell **56.3%** (464,539 bytes); initial image payload fell **74.7%** (461,016 bytes). Enhanced controls were ready about 2.13s earlier in these samples. Raw resource logs explicitly show **zero** initial `/combat/crisp/` or `/landing/` image requests afterward, no all-roster preload, no other full arena, no battle audio, Blender or API session. Both samples subsequently confirm a real Bolt selection. Selection wall time is not compared because the before capture saves a screenshot before clicking.

The remaining portrait environment is **602×941, 156,234 compressed bytes**, with a width×height×4 decoded estimate of **2,265,928 bytes (2.16MiB)**. Before, all five initial images totalled 5,499,256 decoded bytes (5.24MiB). Desktop uses the unchanged **1672×941 / 485,850-byte** environment (6,293,408 decoded bytes); desktop initial image payload falls from 946,866 to 485,850 bytes. These are image estimates, not measured process/GPU memory. The smaller initial image budgets are 200KiB portrait / 512KiB desktop; both pass. Full-quality roster and selected-preview assets remain available on demand.

[Before resource/timing sample](evidence/arena-only-landing/before/mobile-profile.json) · [After resource/timing sample](evidence/arena-only-landing/after/mobile-profile.json). Transfer uses PerformanceResourceTiming, not packet-level wire bytes. Timings are single local emulated samples, not a field-performance guarantee or Lighthouse score. **No inference is made about arena startup: its asset preparation was not changed or reprofiled.**

## Verification

- **218 app tests pass**, with one existing optional live-RPC test skipped; 41 test files. Updated tests cover the arena-only readable server markup, scoped footer decoration, retained full roster/assets, URL-validation boundaries and visibility/reduced-motion cleanup. Preview decode/timeout/abort, hit ordering and replay tests remain intact.
- **14 distinct production browser flows pass across the full/focused runs**: no hero actors/rails/arrows or unwanted downloads; immediate Play and script-free entry; all twelve selections/actual specials; all twelve reached with keyboard focus; replay/cancellation and unchanged muted preference; all four arena handoffs and invalid query; saved active-battle preservation/resume; guest/holder and secondary/challenge/legacy paths; back/forward/refresh; missing imagery; stalled hero download; reduced motion; 320×568, 320×800, 390×844 portrait, 844×390 landscape and desktop; enlarged text and horizontal button bounds; WCAG axe audits without violations. A complete Pip attack/defence/special/result/rematch regression also passes.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build` pass. Existing optional Privy/Farcaster-Solana resolution and viem dynamic-import build warnings remain outside this landing change.
- Browser command: `CHOG_E2E_BROWSER_CHANNEL=chrome PLAYWRIGHT_BROWSERS_PATH=/tmp/chog-installed-browser-tools npm run test:e2e -- cinematic-landing.spec.ts pages.spec.ts landing-recording.spec.ts combat.spec.ts --grep 'immediate readable|all twelve dossiers|all four arena|asset failure|desktop and enlarged|touch selection|cold landing|landing introduces|dedicated pages|legacy bookmarks|lost turn response|actual browser tour|Pip battle|Play works while'`. The first run passed 13 cases and found a missing temporary FFmpeg executable for recording. Reusing the already installed `/opt/homebrew/bin/ffmpeg` through a temporary Playwright path fixed that tooling prerequisite; `--grep 'desktop and enlarged|actual browser tour'` then passed 2/2, including the expanded small-screen/bounds assertions. No app dependency or downloaded binary was added. [Full log](evidence/arena-only-landing/browser-tests.txt), [focused passing log](evidence/arena-only-landing/browser-focused.txt).
- Browser tests use the existing isolated SQLite/RPC/auth fixtures. They do not operate a real wallet or overwrite the user's saved battles. The actual desktop/portrait local page was also inspected through the in-app browser.

## Instructions, quality and remaining limits

Read AGENTS.md, required project direction, the installed Next client-boundary guide, Sites presentation/local-preview guidance and Desloppify workflow. Applied the existing local stack and relevant installed design guidance. The optional web-perf skill was inspected; its required Chrome DevTools MCP is unavailable, so that audit was not run or claimed. The existing Playwright/CDP measurement was sufficient; no skill collection, Superdesign service or dependency was installed.

Project-scoped Desloppify scan/status/next ran before and after. Existing generated/dependency/cache/worktree/test-output/local-data exclusions and ignored `.desloppify/` were retained; no exclusions, suppressions, invented ratings or wontfix resolutions were added. Scores remain **overall 22.6, objective 90.5, strict 21.5, verified 90.5**, with **190 open findings** as before. `next` still requests the initial subjective assessment; all twenty subjective dimensions remain unassessed and the 85 target is not achieved. Existing import-linked coverage/resource-closure and carried signature warnings remain visible. No new security/duplication or functional regression was found. [Before status](evidence/arena-only-landing/before-status.txt), [after scan](evidence/arena-only-landing/after-scan.txt), [after status](evidence/arena-only-landing/after-status.txt), [next](evidence/arena-only-landing/after-next.txt).

The approved arena files retain their existing native detail; high-DPR display/zoom cannot manufacture missing source detail. Physical iOS/notch/Safari behavior and human usability feedback remain unverified; safe-area CSS and emulated layouts are not physical-device evidence. Previews remain intentionally silent. User visual review is the next gate. No commit, push, deployment, external-service change, wallet signature or asset transaction was performed.
