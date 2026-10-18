# Start here — Soryn

**Health queue recovery — October 16, 2026:** all twenty outstanding concrete blind-review findings are fixed, tested and resolved. Normal mechanical scanning now completes: objective 92.3, displayed strict 87.4. Fresh subjective scores remain pending because the blind runner hit its usage limit. See [the queue recovery report](docs/HEALTH_QUEUE_RECOVERY.md) for changes, checks, evidence and the remaining review gate. This does not authorize hosting or real-wallet actions.

**Soryn — October 15, 2026:** the battle game is now Soryn. Find a Match, Challenge a Friend, Story, and Practice are the primary actions. The series rules are in [docs/SERIES.md](docs/SERIES.md). The public starter queue is in [docs/MATCHMAKING.md](docs/MATCHMAKING.md). What is finished, and what is still blocked, is in [SORYN_PLAN.md](SORYN_PLAN.md). The folder name and the saved database keys are unchanged. The older adventure remains on its old URLs and is not the story chapter.

**Private friend battles — October 14, 2026:** Challenge a friend sits beside practice. Two seats share an invitation, the existing combat engine resolves both hidden moves, and deadlines live in SQLite so a refresh or process restart can continue the same round. The sandwich adventure, journal, museum and adventure ghosts leave the main navigation and remain on `/play`, `/journal`, `/museum` and `/archive`. Public matchmaking, rankings, rewards and combat ghosts are not in this slice. Local checks are in [private friend battles](docs/PRIVATE_PVP.md). The quality and security remediation, including what is still unverified, is in [the PvP review](docs/PVP_QUALITY_SECURITY_REVIEW.md). This is not an internet or physical-device test.

**Whole-world landing motion — October 14, 2026:** the current requested camera glide moves the complete buildings, floating cliffs and arena floor together behind fixed branding. Earlier locked-camera direction is superseded; original artwork and previous loops remain preserved. [Recordings, architecture tracking, export costs and checks](docs/WORLD_HERO_MOTION.md).

**Visible landing motion — October 14, 2026:** stronger portrait-aware mist, staggered gold motes and falling petals make the existing loop easier to see through the landing shade. Automatic playback has no scene controls; versioned media avoids the old cached export. [Actual page recordings, pixel comparisons, costs and checks](docs/VISIBLE_HERO_MOTION.md).

**Hero playback repair — October 14, 2026:** same-page home links no longer stop the background permanently. Desktop/portrait navigation regressions and all six hero lifecycle cases pass, plus 226 app tests and static/build checks. [Reproduction, fix and evidence](docs/HERO_PLAYBACK_FIX.md).

**Animated Sanctuary + faster battle entry — October 14, 2026:** the approved arena now autoplays as a silent ten-second desktop/mobile loop, with no scene buttons. Selected-match preparation, smaller full-resolution pose encodings and lazy setup thumbnails reduce median Play→battle from 19.27s to 8.02s under the documented cold-mobile profile. Approved rendered artwork, combat rules, saves and ownership remain intact. 226 app tests and 47 production browser cases pass across full/focused runs, plus format/lint/type/build. The five-second target and unassessed Desloppify review remain open. [Evidence, editable source, recordings and measured limits](docs/CINEMATIC_READINESS.md).

**Complete experience rebrand — October 14, 2026:** original Déjà Vu vector branding, shared midnight/gold game interface, an arena-only identity hero and on-demand real gameplay now cover landing, setup/combat/results/history, My Chog and all secondary routes. Approved artwork, saves, ownership and consent remain intact. 222 app tests and 49 distinct browser flows pass across full/focused runs, plus format/lint/type/build. [Route coverage, desktop/mobile evidence, recordings, loading comparison and remaining quality gates](docs/REBRAND.md).

**Historical arena-only landing refinement — October 14, 2026:** the approved arena now introduces the world; all twelve fighters and previews remain in the roster. Hero characters, panels, parallax and landing arrows are removed. 218 app tests and 14 focused browser flows pass across runs, plus format/lint/type/build. Under the same cold mobile profile, initial transfer fell from 824KB to 360KB and controls were ready in ~2.2s. [Before/after views, recording, measurements and limits](docs/ARENA_ONLY_LANDING.md).

**Historical cinematic landing — October 14, 2026:** approved Aegis/Ember opening, all twelve interactive dossiers and silent companion previews, four validated arena handoffs and preserved active battles are implemented. 218 app tests and 13 focused browser flows pass, including a complete battle/rematch, static checks and production build. Cold mobile content paints in ~1s, controls are ready in ~4.8s, with 824KB initial transfer. [Visuals, recording, costs and limits](docs/CINEMATIC_LANDING.md).

**Arena presentation — October 13, 2026:** four cosmetic environments, a compact source-capped portrait field, authoritative contact feedback, original event-timed audio with remembered controls and selected-match asset preparation are implemented. 206 app tests and 57 distinct browser flows pass across full/focused runs; static checks and the production build pass. Verification and review evidence are in [the arena presentation report](docs/ARENA_FEEL.md). The approved rendered artwork, Blender sources, saved records and combat rules remain preserved.

**Current direction — October 11, 2026:** Combat is now primary, explicitly superseding adventure-first requirements. The adventure contracts and milestones below remain preserved secondary functionality, not combat rules. Read [combat rules and build sequence](docs/COMBAT_RULES.md) for the new versioned contract. Combat implementation status is recorded separately; prior test results do not establish combat functionality.

Prepared 2026-10-10 for `/Users/apple/Desktop/chogsnft`.

## Read in this order

1. AGENTS.md — binding project scope and safety/quality rules.
2. README.md — product identity, pitch and current status.
3. PLAN.md — build sequence, gates, acceptance criteria and cut order.
4. docs/GAME_SPEC.md — the playable experience and ghost mechanics.
5. docs/ARCHITECTURE.md — technical boundaries, schemas and ownership behavior.
6. docs/COMBAT_RULES.md and docs/COMBAT.md — primary combat contract, tested progress and real-holder steps. Read docs/COMBAT_PRESENTATION.md for the current difficulty/presentation milestone. Read docs/PRIVATE_PVP.md for friend battles.
7. docs/EVENT_AND_SUBMISSION.md — verified event facts and submission checklist.

## Current state

Approved rendered artwork restoration, **October 13, 2026**: all twelve families use the approved sculpted PNG designs, compact aligned near-lossless WebP pose exports, native CSS-size caps, isolated cells and small idle-only selection exports. Attack contact/terminal presentation and current notices remain authoritative. **200 app tests and 49 distinct browser flows pass across full/focused runs**, plus static checks/build; all twelve 3× portrait roster checks pass and are recorded in [the restoration report](docs/ART_RESTORATION.md). The simplified Blender pilot remains editable but is not the default or approved direction. Saved battles, rules, identity/privacy, adventures and museum remain preserved; free movement is documentation only.

Historical playable Blender pilot, **October 13, 2026**: real editable Aegis/armadillo rigs/actions, transparent sampled clips and event-driven arena integration are implemented for this pair only, with original assets as loading fallback. **198 unit/integration tests, eight model checks, five rig checks and 46 distinct browser flows pass across full/focused runs**, plus static checks/build. [Source, reproduction, recordings, measurements and limits](docs/BLENDER_ANIMATION_PILOT.md). Other eleven fighters, frozen rules/policies, ownership and private history remain intact. Model detail still differs from the approved artwork; further roster conversion requires visual/art/performance review.

Historical Latest combat presentation milestone, **October 12, 2026**: all twelve fighters now have distinct full-body anatomy, three-quarter combat faces and 24 different basic/special treatments. Easy/Medium/Hard freeze `combat-opponent/2` decision policies without changing `/1` combat stats/rules; old battles retain the labelled Legacy policy. **187 unit/integration tests and 38 production browser flows pass**, plus format/lint/type/build; the terminal-display correction also has a focused normal/reduced-motion/refresh regression. Actual gameplay recordings, the 192-case benchmark and limits are in [combat presentation evidence](docs/COMBAT_PRESENTATION.md). Human playtesting, user-operated real-holder combat and unassessed Desloppify design review remain gates. Progression, configurable combat loadouts and combat ghost training remain unimplemented.

October 11 character milestone: all twelve classes, four starters/eight current-owner options, exact ability effects, persisted resources, ability ghosts and frozen challenge borrowing are implemented. 119 unit/integration tests and 24 browser flows pass with format/lint/type/build. Read docs/CHARACTERS.md, docs/CHARACTER_RULES.md and docs/CHARACTER_ASSETS.md for current contracts, tested evidence, quality findings and real-holder manual steps. Current instruction supersedes equal-power classes with bounded holder advantages; all starters can complete the mission. Existing saves retain their original rules and lack invented loadouts.

Latest presentation milestone: a new landing page and dedicated Play, Museum, My journal and My Chog routes. Shared app navigation preserves guest play; old bookmarks and challenge links remain supported. See docs/PAGES_AND_LANDING.md.

The guest chapter journal and rematch hub are now implemented: private saved replays, selected past ghost races and cohort-separated museum progress. See docs/GUEST_JOURNAL.md for current checks, quality findings and limits.

Secondary adventure milestone: guest races freeze a previous or consented museum ghost before the attempt and reveal visual comparison afterward. See docs/GHOST_RACES.md for contracts, checks and remaining gates. The existing Privy/ownership stack is retained; the current character milestone adds verified-holder selection without removing any identity gate.

The guest slice, museum design and real identity layer are implemented locally. Read README.md, docs/PRIVY.md, docs/IDENTITY.md and docs/PROGRESS.md for behavior and tested evidence. Wallet login now uses Privy; the local App ID is configured and its wallet selector opens, using official rotating signing keys. User-operated holder login/signing remains unverified. Three rooms, server validation, replay, frozen ghosts, consented museum, EOA chapter grants, fresh ownership checks and token-bound public chapters exist. Chog Genesis on Monad 143 is allowlisted after provenance and read-only RPC verification. There is no Git repository, deployment or modified/deployed NFT contract.

## Next gate

The founder confirmed registration. Obtain the application receipt and exact submission cutoff. Arrange a consenting real holder's wallet sign-in and playtest, verify artwork rights and stable traits separately, then gather human feedback and prepare a judge-friendly evidence package. Automated wallet/succession tests use disposable signatures and a synthetic local RPC; live verification is read-only contract/ownership evidence. Neither is a recorded real-holder gameplay session. See docs/IDENTITY.md for remaining quality findings and limitations. Never perform the holder's signature for them.

The public site inspected on October 10 says registration closes October 10 at 19:00 UTC (20:00 WAT). Do not confuse that with the later build deadline. The founder confirmed registration in chat; the receipt remains uninspected.

## Suggested prompt to continue

> Read START_HERE.md, AGENTS.md, PLAN.md, COMBAT_RULES.md and COMBAT.md. Continue the existing combat-first game. Preserve adventures, ghosts, museum, consent, Privy/current-owner authority and saved histories. Start from tested implementation, run Desloppify and relevant checks, and report actual progress. No dependencies, subagents, signatures, asset transactions, commits, pushes, deployments or paid services without authorization.

## Outcomes that do not count as completion

- A mocked ownership check shown as a real holder integration.
- A static mockup, story video or scoreboard without playable mechanics.
- A ghost that only repeats the exact recorded sequence but is described as adapting to new rooms.
- Fabricated usage, retention, winners, blockchain receipts or AI-learning claims.
- A game account with an NFT image but no token-bound history/control behavior.
