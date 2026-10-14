# Cinematic landing page — design and implementation record

**Current identity — October 14, 2026:** [the complete game rebrand](REBRAND.md) and [shared design system](GAME_IDENTITY.md) supersede earlier palette, typography, hero copy and decoration described here. Approved rendered artwork and existing functionality remain preserved.

**Current direction:** the [arena-only refinement](ARENA_ONLY_LANDING.md) supersedes the character/portal hero and arrow controls described below. The previous milestone and its evidence remain historical.

## Design committed before implementation

An original gateway into the existing lavender-stone world: warm ivory display type, purple stone, aged gold rules and ember highlights. The opening is a full-height sanctuary scene with separate Aegis/Ember, armadillo/phoenix and atmospheric layers. Text occupies a calm dark region and never moves with the pointer. Two narrow decorative stone edges part during the first short scroll interval; the world and both actions are already visible. Desktop pointer movement is capped at a few pixels. No pinned scroll, curtains, custom cursor, mandatory animation or autoplay sound.

The page continues into a fighter dossier: large approved fighter/companion artwork, twelve compact named selections and explicit previous/next buttons. Actual combat definitions supply specials, resources and passives; character definitions supply access/roles/descriptions. A deliberate special preview reuses the selected approved poses and shared effects without simulating damage, outcomes or a match. Four environment selections lead to validated `/arena?arena=<id>` setup suggestions. Existing active battles retain precedence and are never overwritten. Holder identity and preserved adventures/journal/museum follow; the closing invites actual play.

Reference reviewed: [Superdesign’s portal hero](https://superdesign.dev/library?selected=animated-landing-page-portal-hero-that-parts-to-uncover-a-full-bleed-image&category=style) and its live prototype. Its panel reveal/catalogue interaction are inspiration only; no branding, code, photographs, testimonial or catalogue claims are reused. The Sites presentation-led design guidance is applied locally; no Site registration, publication or new dependencies.

## Initial budget

Before building, set the initial image budget to **650 KiB for 390×844 portrait / 1 MiB for desktop**. Initial HTML must contain readable headline, copy and real Play links without JavaScript. At the arena report’s cold-cache profile (6× CPU, 1.6 Mbps down / 750 kbps up, 150 ms latency, DPR 3), target text/Play usability within 3 seconds and enhanced controls within 8 seconds. Report actual measurements rather than treating targets as achieved.

Initial imagery: one responsive sanctuary environment, two approved idle fighters and two efficiently cropped idle companions. No full battle atlas, audio, Blender file, all-roster image preload or four full environments. Roster/arena media defer until their sections are near view; only the selected full artwork/environment mounts. Lightweight roster/arena thumbnails support catalogue browsing. A special preview downloads only its selected fighter/companion atlases after activation. Original masters/full-fidelity idle artwork remain preserved; smaller thumbnails do not replace large images. Native CSS/source caps remain.

## Delivered — October 14, 2026

The local production preview is http://127.0.0.1:3000/. The opening uses the approved Aegis/Ember rendered fighters and armadillo/phoenix; stone edges part over 240px of ordinary scroll. Pointer offsets are bounded to ±6px horizontally/±4px vertically on suitable devices. The copy stays still. Breathing/motes stop offscreen and immediately when hidden; reduced motion removes parallax, breathing, lunges and effect travel. These are rendered poses with CSS presentation, not skeletal animation or free movement.

The 12-fighter dossier reads existing character/combat definitions and the shared companion catalogue. No copied stat table or combat-engine simulation is used. Selected idle artwork and small thumbnails mount when the section approaches view; only a deliberate Preview special imports the pose renderer and selected fighter/pet atlases. The preview supports defined one/two-hit presentations, bracing for Field Repair, anticipation/action/recovery, replay, immediate overlap locking, cancellation on selection/unmount/hidden tab, decoding failure and a 10-second image timeout. A failed image cancels its partner loader. Previews are explicitly **silent**, never touch remembered battle sound preferences, and display no invented damage or result.

Four arena buttons mount only the selected full responsive background and existing small thumbnails. Battle here sends a catalogue-validated suggestion to setup. Unknown, random, repeated or malformed query values are ignored. No navigation creates a match. An existing active battle retains its actual arena/ID/rounds; setup disables another start and offers Resume saved battle. A normal /arena visit preserves its existing resume behavior. Challenge redirects, legacy bookmarks and secondary routes remain intact. Holder links enter established /character authentication on user action; guest/official write policies and records are unchanged.

The first verification exposed lost pre-hydration button clicks, missed pre-hydration image failures and low-contrast tiny labels. Enhanced buttons now remain disabled until their handlers are ready; ordinary Play links work in initial HTML. Native image subscriptions observe existing complete/naturalWidth state as well as later load/error events, retaining a readable failure state without extra successful image downloads. The mobile hero artwork follows the copy in normal flow so enlarged text does not collide with it. Original masters, full battle artwork, Blender sources, saved battles and unrelated experiences are preserved.

## Asset costs and source limits

The export script uses existing approved fighter idles unchanged, proportionally scales companion idle crops to a maximum 512px at WebP quality 92/alpha 100, and makes 128×128 catalogue thumbnails. It keeps proportional canvas offsets rather than cropping away pivots. Full-fidelity battle companions remain available on deliberate preview. The first oversized pet exports totalled 590,932 bytes; the sized landing pair totals 127,682 bytes. The large runtime fighters were not recompressed or regenerated. No NFT artwork is reused, and OpenSea metadata is not treated as an artwork license.

| Hero asset | Runtime dimensions | Compressed bytes | RGBA decoded bytes |
| --- | ---: | ---: | ---: |
| Aegis fighter | 502×438 | 162,970 | 879,504 |
| Aegis companion | 512×315 | 59,876 | 645,120 |
| Ember fighter | 516×426 | 170,364 | 879,264 |
| Ember companion | 512×405 | 67,806 | 829,440 |
| Sanctuary portrait | 602×941 | 156,234 | 2,265,928 |
| Sanctuary desktop | 1672×941 | 485,850 | 6,293,408 |

Portrait initial imagery: **617,250 bytes / 602.8 KiB**, decoded RGBA estimate **5,499,256 bytes / 5.24 MiB**. Desktop initial imagery: **946,866 bytes / 924.7 KiB**, decoded RGBA estimate **9,526,736 bytes / 9.09 MiB**. Both remain within the budgets set before implementation. Twelve deferred roster thumbnails total 106,808 compressed bytes and 786,432 decoded bytes. Arena thumbnails are 240×160, 8.7–11.6KB each. All 36 roster exports, paths and dimensions are in [the asset ledger](evidence/cinematic-landing/assets.json); totals are in [the budget record](evidence/cinematic-landing/asset-budget.json).

These decoded estimates are width×height×4, not measured process memory: browser caches, compositing surfaces and DPR paint buffers add memory. The native 418–512px fighter canvases do not gain missing detail on a 3× display. Large fighters stay within useful CSS source limits; native master softness remains visible under heavy zoom. Small thumbnails do not replace the large fighter exports. No pixelated rendering, sharpening filter or invented higher-resolution detail is claimed. The 512px landing pets trade some of the larger source detail for initial download cost; the approved full battle crops remain unchanged.

## Cold loading measurement

Final production build, installed Chrome 155.0.8059.40 on Apple M3/8GiB. Same arena-report profile: 390×844, DPR3, 6× CPU, 1.6Mbps down, 750kbps up, 150ms latency, disabled cache. This is browser emulation, not a physical low-end phone.

| Metric | Final sample |
| --- | ---: |
| First contentful paint | 0.988s |
| Play link visible (test polling) | 0.691s |
| Enhanced roster controls ready | 4.835s |
| All five hero images complete | 4.890s |
| Real Bolt selection confirmed | 5.190s |
| Largest contentful paint | 4.416s |
| Layout shift (CLS) | 0 |
| Initial document/resources transferred | 824,450 bytes / 805.1 KiB |

[Raw resource timings](evidence/cinematic-landing/mobile-profile.json) are captured **after all five initial images complete and before scrolling/selection loads dossier media**. The deliberate selection then verifies real handler readiness. Transfer sizes are PerformanceResourceTiming measurements, not packet-level wire traffic. Initial downloads contain no full combat atlas, other three full backgrounds, battle audio, Blender file, wallet bundle or API session. Text/Play and enhanced controls meet the pre-set 3s/8s targets in this sample; hero art and LCP take longer than text. The page does not wait for the arena's full battle preparation. Later ability previews still have a separate selected-atlas cost and may take several seconds on slow connections; failed loading remains bounded and retryable.

## Checks and review evidence

- `npm run test`: **218 passed, one optional live-RPC check skipped**; 41 files. Includes URL input validation, asset budget/availability, readable server HTML, correct authority links, actual heal/strike poses, image decoding/error/timeout/abort, ordered two-hit previews, replay and hidden/reduced-motion listener cleanup.
- `npm run format:check`, manual Prettier check of `scripts/prepare-landing-assets.mjs`, `npm run lint`, `npm run typecheck`, `npm run build`: pass. Existing Privy optional Farcaster-Solana resolution and viem dynamic-import build warnings remain; no dependency was added. They do not load on the landing page.
- `CHOG_E2E_BROWSER_CHANNEL=chrome PLAYWRIGHT_BROWSERS_PATH=/tmp/chog-installed-browser-tools npm run test:e2e -- cinematic-landing.spec.ts pages.spec.ts landing-recording.spec.ts combat.spec.ts --grep 'immediate readable|all twelve dossiers|all four arena|asset failure|desktop and enlarged|touch selection|cold landing|landing introduces|dedicated pages|legacy bookmarks|lost turn response|actual browser tour|Pip battle'`: **13 passed**, including all 12 selections and specials, replay/cancellation, unchanged muted preference, four arena handoffs, no automatic match writes, saved active battle, invalid suggestion, challenge/legacy routes, guest/holder entry, back/forward/refresh, missing/slow images, touch, 320px/390px portrait, 844×390 landscape, 1280×800 desktop, enlarged text, reduced motion and WCAG axe audits with no violations. The complete Pip battle exercises attack/defence/special/result/persisted rematch after entering from home.
- Independently inspected the actual local page through the in-app browser on desktop and portrait, including Aegis selection/special and Sky Temple selection. Browser regressions use the isolated test database and synthetic identity/RPC fixtures; they never mutate the user's saved battles or operate a real wallet.

Evidence: [desktop hero](evidence/cinematic-landing/desktop-hero.png), [desktop roster](evidence/cinematic-landing/desktop-roster.png), [3× portrait hero](evidence/cinematic-landing/mobile-hero.png), [portrait roster](evidence/cinematic-landing/mobile-roster.png), [portrait arena](evidence/cinematic-landing/mobile-arena.png), [actual silent browser recording](evidence/cinematic-landing/browser-tour.mp4), [original WebM](evidence/cinematic-landing/browser-tour.webm). The fixed-viewport recording shows real roster selection, Aegis/Ember companion special previews, four arenas and a Sky Temple setup handoff. It is not a scripted fake match or promotional film. Command logs and any earlier failed verification remain alongside the final passing evidence.

## Desloppify

Project-scoped `scan --path .`, `status`, `next` ran before implementation and after final code. Dependencies, caches/build output, worktrees, test artifacts and local data use the existing explicit exclusions; authored engine, API, UI and tests remain included. `.desloppify/` stays ignored. No score exclusions, suppressions, wontfix decisions or invented subjective ratings were added.

| Score | Before | Final |
| --- | ---: | ---: |
| Overall | 22.5 | 22.6 |
| Objective | 89.9 | 90.3 |
| Strict | 21.4 | 21.5 |
| Verified | 89.9 | 90.3 |

Final status reports **191 open findings**, compared with 174 before: 98 import-linked test warnings, 61 smells, 20 subjective review requests, five naming suggestions, three single-use suggestions, two flat-directory findings, one configuration orphan and one signature finding. New large roster/landing functions were separated into cohesive components; decoding/timing boundaries and DOM listener lifecycle now have meaningful direct tests. The scanner still reports transitive-only coverage for some hooks/art/preview wrappers, despite browser exercises, and nested resource-cleanup callbacks. The retained empty subscription is the standard stable server/client hydration snapshot pattern, not an unfinished feature. A carried `finish` signature finding names SpecialScene, which no longer contains that function; it remains visible rather than being suppressed. There are no open new security or duplicate-function findings. The initial subjective review remains the `next` gate and all 20 dimensions are unassessed; the 85 target is not achieved. [Scan](evidence/cinematic-landing/after-scan.txt), [status](evidence/cinematic-landing/after-status.txt), [next](evidence/cinematic-landing/after-next.txt).

## Remaining gates

User visual review and human usability feedback, physical-device/Safari testing, and user-operated real-holder login/gameplay remain useful gates. Chrome automation and read-only provenance are not proof of a real-holder session. No new artwork permission is inferred. No combat rules, ownership contracts, free movement, PvP or progression were added. No commit, push, deployment, purchase, transfer or wallet signature was performed.
