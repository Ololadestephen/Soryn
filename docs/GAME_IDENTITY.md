# Déjà Vu — game identity

October 14, 2026. Current shared visual system, superseding the earlier cream/editorial landing. [Implementation, route coverage and verification](REBRAND.md).

## Direction

A turn-based creature arena with second chances. The original arena environment, rendered fighters and companions are the world; navigation, selection, combat and the secondary sandwich adventure belong to it. The landing introduces the game, shows actual guest gameplay, offers twelve named fighters, then four arenas, holder access and secondary experiences. No invented rewards, multiplayer or progression.

Inspected references: [Cat Town](https://cat.town/) for a consistent world/interface identity; [Parallel](https://parallel.life/game) for a prominent identity, genre, clear Play/Watch hierarchy and real gameplay presentation; [Illuvium](https://illuvium.io/) for atmosphere and creature emphasis; [Big Time](https://www.bigtime.gg/) for immediate game branding and play access; [Axie Infinity](https://axieinfinity.com/) for creature/game catalog structure. Four sites were visually inspected in the browser; Axie’s browser page stopped at security verification, so its publicly retrieved page content was inspected without bypassing the check. Some reference videos/images were unavailable locally. These are design principles, not copied artwork, logos, fonts, mechanics or financial features.

Applied installed Sites presentation/local-preview guidance and the narrowly read [better-accessibility guidance](https://www.ui-skills.com/skills/jakubkrehel/better-accessibility). No global skill installation, framework, animation package, external font or paid design service. The web-perf skill was inspected, but its required Chrome DevTools MCP is unavailable: no such audit is claimed. Existing Playwright/CDP profiling measures both entry points separately. HyperFrames’ entry guidance was read; these deliverables are direct browser recordings, without an authored promotional composition or added animation dependency.

## Shared tokens

Source of truth: `src/app/globals.css`; layout/brand rules in `src/app/layout.css`. Surface-specific CSS retains its existing responsibility, including independently measured full-screen battle geometry.

| Token | Value | Meaning |
| --- | --- | --- |
| Night | `#100d18` | Full application background |
| Surface | `#1b1627` | Inputs, dialogs, reading surfaces |
| Raised | `#261f34` | Secondary controls and selected navigation |
| Ivory | `#f6eddf` | Primary text |
| Muted | `#c0b4cc` | Secondary text, never a disabled-status substitute |
| Gold | `#e7bc72` | Primary action, selection boundary and emphasis |
| Gold ink | `#241a13` | Text on gold controls |
| Violet | `#cfb4f6` | Identity/ghost secondary emphasis |
| Line | `#80708c` | Input/panel boundary against dark surfaces |
| Focus | `#f4d395` | Three-pixel keyboard outline, offset four pixels |
| Success / warning / danger | `#a9d7b1` / `#f4ca85` / `#ffb8aa` | Labelled feedback; health/status text remains explicit |

Measured token pairs: gold/gold-ink 9.60:1; muted/raised 8.01:1; line/raised 3.47:1. Focus is offset onto the surrounding dark surface. Translucent HUD, scene text and selected states also receive browser/axe checks; the token ratios alone do not establish whole-page compliance.

Display: local `Avenir Next Condensed`, `Arial Black`, `Trebuchet MS`, sans-serif, heavy upright headings with compact spacing. UI: local `Avenir Next`, `Trebuchet MS`, Arial, sans-serif. Body 16px; supporting copy generally 13–15px; combat retains its measured compact HUD sizes. Actual available system fonts vary by platform. The vector wordmark does not depend on font availability. No large editorial italics or remote font request.

Panels use a quiet midnight-purple gradient, thin stone/metal boundary, eight-pixel base radius and restrained inset highlight. More rounded native selection groups remain where they serve touch use. Gold buttons carry the primary action; secondary actions use dark surfaces. Selection combines a border, native checked/pressed state and text. Errors remain visible until recovery; no timer dismisses an error. Disclosures retain native markers and keyboard operation. Fields have visible labels and native validation.

Spacing uses 8/12/16/24/32px steps, with 48–80px landing section spacing. Touch actions aim for at least 44px. Navigation wraps on game pages. The landing keeps a compact mobile Play entry; named section/access links are also present within the page. No new hover-only interaction.

Motion is optional: the background alone has a 360ms entrance fade that pauses offscreen/hidden; text/buttons remain still. Combat keeps the existing authoritative anticipation/contact/recovery and three-second replacing move notice. Reduced motion preserves static state and order. Gameplay video is silent, mounts only after explicit Play, has native playback controls and Close/retry, and pauses offscreen or when the document is hidden.

## Original brand and asset provenance

`public/brand/wordmark.svg` is original hand-authored vector lettering, including É and À, with a nested offset memory seal. `public/brand/emblem.svg` is an original nested hexagonal seal with a central choice mark. `Brand.tsx` reuses them in the hero and compact navigation/footer. The small mark suggests a repeated impression/second chance without introducing another mascot. PNG icon sizes 180, 192 and 512 are deterministic Sharp raster exports of this SVG. They are favicon/application artwork; no installable PWA is claimed.

No third-party logo, font, artwork or texture was downloaded. Interface texture is CSS only. Existing approved arena/fighter/companion files are unchanged: [restoration provenance and source limits](ART_RESTORATION.md), [environment/audio sources](ARENA_FEEL.md). All are accurately described as rendered artwork, not live rigged models. Blender sources and legacy fallbacks remain preserved. No Chog NFT artwork permission is inferred from metadata.

`public/gameplay/pip-v-bolt.mp4` comes from the real local guest battle captured by `tests/e2e/rebrand/rebrand-recording.spec.ts`, in the isolated browser-test database. It shows defence, basic attack, companion special, resource changes and a terminal result at original speed. `pip-v-bolt-poster.webp` is a downsampled still of the same real scene. H.264 transcoding and WebP compression add no fabricated HUD, damage, outcome, voiceover or sound. The test battle record and original WebM are retained in the evidence directory. Captions beside the player explain choices and resolution; the recording is explicitly guest practice against a computer.
