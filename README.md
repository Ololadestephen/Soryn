# Soryn

**Soryn — October 15, 2026:** a browser tactical creature battler. Find a public match, challenge a friend, play The Fractured Sanctuary, or practice. Status and the decisions still open are in [SORYN_PLAN.md](SORYN_PLAN.md).

**Private friend battles — October 14, 2026:** a friend can join a private invitation and play the same battle on a second browser. Practice, the twelve fighters and saved adventure records stay. [Contract, checks and hosting limits](docs/PRIVATE_PVP.md).

**Whole-world landing motion — October 14, 2026:** the current requested camera glide moves the complete buildings, floating cliffs and arena floor together behind fixed branding. Earlier locked-camera direction is superseded; original artwork and previous loops remain preserved. [Recordings, architecture tracking, export costs and checks](docs/WORLD_HERO_MOTION.md).

**Visible landing motion — October 14, 2026:** stronger portrait-aware mist, staggered gold motes and falling petals make the existing loop easier to see through the landing shade. Automatic playback has no scene controls; versioned media avoids the old cached export. [Actual page recordings, pixel comparisons, costs and checks](docs/VISIBLE_HERO_MOTION.md).

**Hero playback repair — October 14, 2026:** same-page home links no longer stop the background permanently. Desktop/portrait navigation regressions and all six hero lifecycle cases pass, plus 226 app tests and static/build checks. [Reproduction, fix and evidence](docs/HERO_PLAYBACK_FIX.md).

**Animated Sanctuary + faster battle entry — October 14, 2026:** the approved arena now autoplays as a silent ten-second desktop/mobile loop, with no scene buttons. Selected-match preparation, smaller full-resolution pose encodings and lazy setup thumbnails reduce median Play→battle from 19.27s to 8.02s under the documented cold-mobile profile. Approved rendered artwork, combat rules, saves and ownership remain intact. 226 app tests and 47 production browser cases pass across full/focused runs, plus format/lint/type/build. The five-second target and unassessed Desloppify review remain open. [Evidence, editable source, recordings and measured limits](docs/CINEMATIC_READINESS.md).

**Complete experience rebrand — October 14, 2026:** original Déjà Vu vector branding, shared midnight/gold game interface, an arena-only identity hero and on-demand real gameplay now cover landing, setup/combat/results/history, My Chog and all secondary routes. Approved artwork, saves, ownership and consent remain intact. 222 app tests and 49 distinct browser flows pass across full/focused runs, plus format/lint/type/build. [Route coverage, desktop/mobile evidence, recordings, loading comparison and remaining quality gates](docs/REBRAND.md).

**Historical arena-only landing refinement — October 14, 2026:** the approved arena now introduces the world; all twelve fighters and previews remain in the roster. Hero characters, panels, parallax and landing arrows are removed. 218 app tests and 14 focused browser flows pass across runs, plus format/lint/type/build. Under the same cold mobile profile, initial transfer fell from 824KB to 360KB and controls were ready in ~2.2s. [Before/after views, recording, measurements and limits](docs/ARENA_ONLY_LANDING.md).

**Historical cinematic landing — October 14, 2026:** approved Aegis/Ember opening, all twelve interactive dossiers and silent companion previews, four validated arena handoffs and preserved active battles are implemented. 218 app tests and 13 focused browser flows pass, including a complete battle/rematch, static checks and production build. Cold mobile content paints in ~1s, controls are ready in ~4.8s, with 824KB initial transfer. [Visuals, recording, costs and limits](docs/CINEMATIC_LANDING.md).

**Arena presentation — October 13, 2026:** four cosmetic environments, a compact source-capped portrait field, authoritative contact feedback, original event-timed audio with remembered controls and selected-match asset preparation are implemented. 206 app tests and 57 distinct browser flows pass across full/focused runs; static checks and the production build pass. Verification and review evidence are in [the arena presentation report](docs/ARENA_FEEL.md). The approved rendered artwork, Blender sources, saved records and combat rules remain preserved.

Approved rendered artwork restoration, **October 13, 2026**: all twelve families use the approved sculpted PNG designs, compact aligned near-lossless WebP pose exports, native CSS-size caps, isolated cells and small idle-only selection exports. Attack contact/terminal presentation and current notices remain authoritative. **200 app tests and 49 distinct browser flows pass across full/focused runs**, plus static checks/build; all twelve 3× portrait roster checks pass and are recorded in [the restoration report](docs/ART_RESTORATION.md). The simplified Blender pilot remains editable but is not the default or approved direction. Saved battles, rules, identity/privacy, adventures and museum remain preserved; free movement is documentation only.

**Current direction — October 11, 2026:** Combat is now primary, explicitly superseding adventure-first requirements. The adventure contracts and milestones below remain preserved secondary functionality, not combat rules. Read [combat rules and build sequence](docs/COMBAT_RULES.md) for the new versioned contract. Combat implementation status is recorded separately; prior test results do not establish combat functionality.

**Your Chog remembers your worst decisions. Then everyone gets to try doing better.**

## One-line pitch

A turn-based creature battle game: challenge a friend or practice against the computer, watch the impacts and rematch.

## The experience

Primary loop: choose fighter → arena → attack/defence/special → sequential resolution → victory/defeat/draw → rematch. A private friend battle uses the same resolution with a second person's hidden move. Four guest starters and eight verified-holder fighters have distinct versioned combat kits. Computers may use any class as game content. Against the computer, the opponent selects from public pre-round state before the player submits their move.

The sandwich adventure, explainable asynchronous ghosts, private adventure journal and consented Museum of Bad Decisions remain accessible on their original routes as secondary experiences. Their records and rules are preserved. Combat records use a separate private history and never retrofit adventure chapters.

## Why the Chog NFT matters

The NFT identifies a persistent character, not just a picture. Its verified token identity scopes official history. No unverified traits or NFT artwork are mapped to combat power. Authorized play evolves an application-layer history keyed by chain, collection address and token ID. Only the current owner can add official chapters or publish that token's new ghost versions. Ownership transfer changes control while preserving consented public history and former-contributor attribution.

Remove the NFT and the independently transferable identity, common token-derived character seed, ownership authority and successive-keeper history cease to function. Guest play demonstrates the game but does not create an official Chog history.

This does not assume write access to the existing collection's contract or metadata. History lives in our application; no NFT custody or transfer transaction is required to play. Stable metadata and artwork use remain subject to official verification.

## Primary combat release

- Twelve original full-body fighters with basic, special, defence and passive mechanics.
- Paired choices; defence prepares first, attacks follow initiative, knockout cancels pending attacks.
- Frozen computer choices, deterministic event replay, persisted resources and bounded 20-round battles.
- Four free starters; fresh current-owner and generation checks for all official writes.
- Tall layered vector fighters, authoritative impact frames, readable controls and reduced motion.
- Existing adventures, ghosts, journal, museum and withdrawal remain secondary routes.

## Current status

Latest playable Blender pilot, **October 13, 2026**: real editable Aegis/armadillo rigs/actions, transparent sampled clips and event-driven arena integration are implemented for this pair only, with original assets as loading fallback. **198 unit/integration tests, eight model checks, five rig checks and 46 distinct browser flows pass across full/focused runs**, plus static checks/build. [Source, reproduction, recordings, measurements and limits](docs/BLENDER_ANIMATION_PILOT.md). Other eleven fighters, frozen rules/policies, ownership and private history remain intact. Model detail still differs from the approved artwork; further roster conversion requires visual/art/performance review.

Historical Latest combat presentation milestone, **October 12, 2026**: all twelve fighters now have distinct full-body anatomy, three-quarter combat faces and 24 different basic/special treatments. Easy/Medium/Hard freeze `combat-opponent/2` decision policies without changing `/1` combat stats/rules; old battles retain the labelled Legacy policy. **187 unit/integration tests and 38 production browser flows pass**, plus format/lint/type/build; the terminal-display correction also has a focused normal/reduced-motion/refresh regression. Actual gameplay recordings, the 192-case benchmark and limits are in [combat presentation evidence](docs/COMBAT_PRESENTATION.md). Human playtesting, user-operated real-holder combat and unassessed Desloppify design review remain gates. Progression, configurable combat loadouts and combat ghost training remain unimplemented.

Historical adventure milestone: **all twelve tactical adventurer classes are implemented**. Four guest starters have one signature charge; eight current-owner classes have two, without rarity/count stacking. Scene actions, charge/effect persistence, pre-resolution cancellation, same-loadout ability ghosts, frozen museum borrowing and legacy replay are working. Verification: 119 unit/integration tests and 24 production browser flows, plus format/lint/type/build. See [character evidence, limitations and real-holder steps](docs/CHARACTERS.md) and [exact rules](docs/CHARACTER_RULES.md). These are original app classes, not NFT traits or new NFTs. A real user-operated holder flow remains unobserved.

Latest presentation milestone: a new landing page and dedicated Play, Museum, My journal and My Chog routes. Shared app navigation preserves guest play; old bookmarks and challenge links remain supported. Verification: 77 unit/integration tests and 13 production browser flows pass, plus formatting, lint, typecheck and build. See [pages and landing evidence](docs/PAGES_AND_LANDING.md).

Journal milestone: **My journal** reopens private guest chapters and races any selected past ghost on its original scenario. The museum rematch log separates first-recorded attempts and informed retries. See [journal behavior and evidence](docs/GUEST_JOURNAL.md). That milestone’s verification: 77 unit/integration tests and nine production browser flows; formatting, lint, typecheck and build pass.

Ghost-race milestone: guest rematches freeze your previous ghost before play, then reveal a visual race on a shared turn clock. Museum challenges freeze the exhibit opponent instead. Your completed chapter creates a separate next version. See [tested race behavior](docs/GHOST_RACES.md). Wallet work is paused while the main game develops; existing identity features remain available.

Latest identity milestone: wallet login now uses Privy, with independently verified access/identity tokens and a separate explicit token chapter grant. Read [Privy configuration and verification](docs/PRIVY.md). The real Chog identity slice preserves fresh Monad ownership checks, transfer-safe grants, private official runs and consented token-bound public chapters with frozen ghost versions. See [identity verification and tested behavior](docs/IDENTITY.md). The lilac/ink/yellow museum design and labelled guest experience are preserved.

The playable three-room adventure, exact replay, frozen habit ghosts, consented failure museum, guest challenges, comparisons, retries and withdrawal persist in SQLite. Official characters use an identity-derived scenario seed; metadata traits and NFT artwork remain unused until separately verified.

Collection provenance and the live read-only adapter are verified. Current evidence includes 77 passing unit/integration tests and 13 production browser regressions for guest play, ghost races, journal/rematches, public history and configured-provider initialization/unavailability behavior. The earlier identity milestone retains its seven synthetic-wallet browser flows and live read-only adapter evidence as historical results. The configured Privy wallet selector opens on the normal local origin. A user-operated wallet login and holder chapter signature have not yet been observed. A real holder's wallet sign-in/gameplay has **not** been observed. The server supports EOA signatures. Privy supplies Ethereum wallet connections; contract wallets and live connector behavior remain unverified. Automatic embedded-wallet creation is disabled. Artwork rights, human feedback, the exact event submission cutoff and deployment remain open. This milestone alone does not establish a completed event entry.

## Run locally

Use **Node 24 LTS** (tested with 24.19.0; `.nvmrc` included) and npm. Node 25 is outside the test runner's supported range. Node 26+ is allowed but not tested here.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. The server binds to loopback. Records are stored in ignored `data/local/chog.sqlite`; retain this folder to preserve the local museum. Optional `APP_ORIGIN` and `CHOG_DB_PATH` are shown in `.env.example`. The browser's HTTP-only guest cookie authorizes its private records; losing it loses access to those drafts and withdrawal controls. Guest cookies are not wallets or proof of unique people.

For production locally: `npm run build`, then `npm start`. Deployment needs a persistent Node server and durable disk, or a database migration to supported managed storage, plus authorization. Do not use this local database on ephemeral serverless hosting.

## Play an official chapter

Configure `NEXT_PUBLIC_PRIVY_APP_ID` and `PRIVY_VERIFICATION_MODE=jwks` (or an explicitly pinned server-side public PEM key), enable wallet login/identity tokens and allow the local origin in your existing Privy dashboard (see docs/PRIVY.md). No app secret is required. Without configuration, My Chog labels setup pending and refuses protected writes; guest play remains usable.

Open **My Chog** and choose **Sign in with Privy**. Sign in with an Ethereum wallet and select Monad Mainnet (143). Enter the actual ERC-721 token ID, prepare a chapter grant, review its message and explicitly authorize it in your wallet. No transaction or spending approval is requested. Authentication alone does not establish ownership: the server checks the current owner before every official game/publication mutation.

The actual token ID for the example named CHOG #1737 is **276**. Never use a display name or metadata filename as an ID. A non-owner can authenticate for their own consent controls but cannot start, advance or publish official token chapters. A transfer, including away/back, revokes old write grants; sign in again for a new generation. Guest runs remain a separate labelled experience. Known guest play or public replay exposure makes official attempts informed retries in the same observed browser/wallet context.

Completed official runs are private until explicit consent. Publish a chapter, optionally making a failure a museum challenge. Public history and its frozen chapter ghost follow the token; private drafts, wallet IDs and private training do not. The original contributor can withdraw their own publication consent after transfer; the next keeper cannot edit attribution or access those drafts. No original NFT metadata is modified. Public history is readable by actual token ID without a wallet.

## Test the secondary adventure loop

1. Start guest adventure and rush the heroic door. Observe the painted-door failure.
2. Step through the exact replay and inspect the new habit ghost's decision reasons.
   Choose **Race my new ghost** to replay the same scenario against that frozen version. Finish, then scrub **Race timeline** to compare both independent lanes. The vent takes two turns; finished lanes stay at their final state. The ghost created after this rematch is a new version, not the opponent you just raced.
3. Choose a bounded title and alias, explicitly consent, then publish the failure.
4. Open its challenge link in a separate browser/private context on the same local server.
5. Take the archway, deploy the decoy, sneak, inspect extraction, swap in the paperweight, then exit. Compare against the frozen original and ghost.
6. Retry the same scenario: it is labelled an informed retry. Refresh to recover your saved run.
7. The publishing session can withdraw its exhibit; its public replay and new challenge links then become unavailable. A run already in progress can finish without the withdrawn comparison.

Another winning path is archway → inspect guard → service vent → decoy replacement → exit. Patrol timing provides a third path. All new adventures start with ten turns and one basic decoy (cap one); class abilities can restore a previously used decoy or provide other bounded advantages. Scores compare goal completion, then fewer turns, then lower alarm; equal tuples tie. There is no public leaderboard yet.

Open **My journal** to review completed guest chapters without replacing your current adventure. Finish active play before choosing **Race this ghost** from an older chapter. It starts informed personal practice against that selected version on its original scenario. **Your museum rematches** instead keeps the exhibit opponent and shows progress separately for first-recorded attempts and informed retries, within the recent saved window.

## Checks

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run format` applies formatting. Browser tests launch the production build at port 3100 and an isolated read-only HTTPS RPC fixture on loopback port 3200, with a separate ignored test database. The harness needs OpenSSL, creates temporary TLS material, keeps certificate validation enabled, and uses disposable test wallets. It never signs through a user wallet or sends blockchain transactions. Chromium is a test dependency; install it before the first browser run. Clear only `test-results/e2e.sqlite*` if you want a fresh automated-test museum; do not clear the development database unintentionally.

Desloppify scope and exclusions:

```sh
PATH="$PWD/node_modules/.bin:$PATH" desloppify --lang typescript --exclude node_modules --exclude .next --exclude coverage --exclude test-results --exclude playwright-report --exclude data/local scan --path . --no-badge
desloppify status
desloppify next
```

See [verification decisions](docs/DECISIONS.md) and [tested milestone evidence](docs/PROGRESS.md) for results, tool coverage limitations and outstanding gates. The directory has no Git repository; none was initialized, committed or pushed.

## Documents

- [Start here](START_HERE.md)
- [Build plan](PLAN.md)
- [Agent instructions](AGENTS.md)
- [Game specification](docs/GAME_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Identity milestone](docs/IDENTITY.md)
- [Privy setup and tested limits](docs/PRIVY.md)
- [Event and submission](docs/EVENT_AND_SUBMISSION.md)

## Scope exclusions

No custody, staking, trading, financial prizes, NFT transfers, forced token spending, broad multiplayer world, distributed AI training or generic governance/trading dashboards. Optional AI narration and optional on-chain history anchoring are not required for the core slice.

## Provenance

Concept developed in the founder's hackathon brainstorming chat with AI assistance; concept work predates the current handoff. Original idea saved October 8, 2026. Disclose this planning work and all reused code/resources in the final submission. Chog assets and collection data need appropriate permission and attribution; do not infer rights from public availability.
