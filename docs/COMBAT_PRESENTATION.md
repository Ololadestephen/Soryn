# Combat presentation and difficulty — October 12, 2026

Current framing/audio/environment work is recorded in [the arena presentation milestone](ARENA_FEEL.md). Source-resolution limits and the approved rendered art direction remain.

**Current visual direction — October 13, 2026:** the approved sculpted rendered artwork is restored as the default across all twelve fighters and companions. The simplified Blender pilot is not the approved visual direction. Editable Blender sources/scripts remain preserved. See [restoration, sharpness evidence and limits](ART_RESTORATION.md).

**Current October 13 update:** [BLENDER_PILOT.md](BLENDER_PILOT.md) records the missing Blender/MCP prerequisite and verified current-move notice, portrait-ground and cooldown fixes. [ARENA_3D.md](ARENA_3D.md) records the twelve rendered families and earlier artwork milestone. Historical queued-notice descriptions below are superseded; gameplay versions and identity protections remain unchanged.

This extends the working combat app. Combat rules/fighter/move stats remain `/1`; old `combat-opponent/1` battles retain their original policy and have no invented difficulty. New first-party starts explicitly freeze easy/medium/hard under `combat-opponent/2`. Adventures, ghosts, journal, consent/withdrawal, Privy, current-owner/generation checks and actor-scoped private records remain.

## Implemented presentation

All twelve fighters have distinct original torso, limb, head and stance geometry in `components/combat/art/anatomy.ts`, with asymmetric three-quarter faces looking toward the enemy. Equipment remains original project artwork. Fighters are larger, with a dedicated combat zone below the flowing status panel. Normal and enlarged text cannot push the status panel into fighter geometry. No NFT or Kuroro art/branding was copied.

The typed fighter × move mapping gives all 24 basic/special moves different treatments:

| Fighter | Basic                 | Special                                                              |
| ------- | --------------------- | -------------------------------------------------------------------- |
| Pip     | Small precision stone | Survey lens/reticle and exposure                                     |
| Bolt    | Quick fist/jab        | Two deliveries with separate effect/body keys and hit positions      |
| Patch   | Spinning spanner      | Gear/repair anticipation, action and actual numeric healing          |
| Moss    | Seed/leaf shot        | Bloom, recovery/cleanse and distinct flower delivery                 |
| Aegis   | Ordinary strike       | Shield drive/bash, with bounded responding guard counter             |
| Nyx     | Short cutting slash   | Narrow shadow/needle strike; basic-only dodge is explicit            |
| Echo    | Orb                   | Two theatrical mask deliveries, with a separate visible finite decoy |
| Prism   | Angular dart          | Spectrum treatment with exposure marker                              |
| Atlas   | Heavy fist            | Large parcel/stomp with slower weighted pose                         |
| Flux    | Spark                 | Circuit/disruption treatment                                         |
| Ember   | Normal punch          | Flame burst, actual burn application and recoil                      |
| Mneme   | Recall orb            | Memory/book treatment; observed-repeat power shown only when applied |

A pure versioned presentation projection consumes replay-validated server events without changing damage/outcomes. Battle/round/ordinal/phase IDs identify each beat; sibling effect keys add distinct delivery/number/flash namespaces. The original rules/1 mitigation message grammar supplies shield/decoy absorption; HP/heal/recoil/burn/status facts come from authoritative state deltas. Shared pure bonus rules supply only real raw-power benefits, never invented damage or successful dodges.

Anticipation → delivery → impact → recovery includes each multi-hit impact, full block/zero HP, dodge, decoy interception, counter response, healing, status application/expiry, recoil, burn, cancellation, knockout and result. Controls remain locked through acknowledgement/playback. Health, announcements and log revelation advance with the corresponding frame. Repeated/rerendered frames are claimed once; reconnect restores final state and does not replay damage. A stale acknowledgement spanning multiple unseen rounds restores final state rather than animating an incorrect predecessor. Cancelled actions produce no delivery motion/projectile.

Normal beats: anticipation160ms, delivery260ms, impact500ms, recovery180ms, information200ms. Reduced motion uses static/short treatments (impact200ms, other beats100ms), keeps ordering/logs and uses identical final states. These are actual move beats, with no artificial computer-thinking delay. CSS timing never calculates combat results. Exact rules/logs remain expandable; unavailable-move reasons name energy, cooldown or disruption. Difficulty uses native keyboard-friendly radio controls.

## Frozen difficulty policies

All modes use identical fighter definitions, initial HP/energy, legal moves and `combat-rules/1`; no hidden stat boosts or silent mode changes. Server input validates the enum. Start-idempotency includes difficulty; rematch retains fighter/opponent/difficulty. Change setup opens selection. Missing difficulty in an old/compatibility request selects the explicitly labelled **Legacy policy**, never relabelled Medium. Stored pending choices stay private until reveal and survive refresh.

- **Easy:** basic when affordable; guard every fourth round; use a useful legal special every fifth; guard when basic is unaffordable. It does not exploit player history or deliberately lose. It can defeat poor fixed play. Every starter has a tested winning strategy against introductory Easy Bolt.
- **Medium:** preserves fighter preferences from the original policy, with public resource/recovery checks and completed-pattern guards. Low energy guards; Patch does not waste repair at full health; Moss can prioritize cleansing public burn when legal. Guard cadence is three rounds for Aegis/Atlas/Moss, five for the others, conditional on the foe's completed move. There is no current-intent input.
- **Hard:** evaluates at most 3 legal computer choices × 3 legal possible player replies using the same pure resolver. Prior reply weights are basic.5/special.3/guard.2, normalized over legal replies. After at least three completed observations, blend half that prior with half Laplace-smoothed counts over the last six completed player choices (one pseudocount per move). The actual current choice and future/private information are never supplied.

Hard maximizes weighted expected tactical value, with deterministic basic → special → guard ties. Score after a full simulated round: own HP change ×1.4 + foe HP lost ×1; computer win +140, loss −180, draw −8; own energy change ×1.5, cooldown −.8; foe exposure/disruption/burn ×3.5/4/3 minus the same own effects; own prepared-power/decoy changes ×.6/.8. This considers real mitigation, initiative, survival, recovery and status opportunities, not an omniscient response. It is a provisional bounded heuristic, not machine learning or proof of universal difficulty ordering.

## Reproducible benchmark

Command: `npm test -- tests/unit/combat-benchmark.test.ts`. [Raw cases](evidence/combat-difficulty-benchmark.json).

192 deterministic cases: four starters × Bolt/Aegis/Prism/Echo opponents × basic-only/special-when-useful/alternate-guard/guard-only scripts × three modes. Fixed tie identity0, unchanged stats/rules, one outcome per case. Running twice reproduces the same report; repeat execution does not double sample size.

| Mode   | Cases | Player wins | Computer wins | Draws | Mean rounds |
| ------ | ----: | ----------: | ------------: | ----: | ----------: |
| Easy   |    64 |          16 |            35 |    13 |       12.44 |
| Medium |    64 |          12 |            42 |    10 |       10.86 |
| Hard   |    64 |           9 |            38 |    17 |       12.48 |

These are fixed-strategy simulations, **not human win rates**. Hard reduced player wins but produced more draws and fewer computer wins than Medium in this sample. No rules/fixtures were manipulated to enforce ranking. Some policies/matchups may feel more defensive or exploitable; broader matchup balance and enjoyment require consenting human feedback.

## Verification and recorded evidence

Baseline:165 tests passed, one opt-in live test skipped. Final unit/integration run: **187 passed in 29 suites, one opt-in live test skipped**. The full production browser suite passed **38 flows**. After browser review exposed terminal copy displaying a pending-choice prompt/next round after completion, the arena now displays resolved-round count and finished-match guidance; the focused normal/reduced-motion/full-battle/refresh regression passed again. This repeat is one existing flow, not a 39th scenario.

| Command                                                                                                                   | Result / saved output                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `npm run format:check`                                                                                                    | [Pass](evidence/chog-presentation-format.txt)                                                          |
| `npm run lint`                                                                                                            | [Pass](evidence/chog-presentation-lint.txt)                                                            |
| `npm run build`                                                                                                           | [Pass; existing optional Farcaster/Ox Tempo dependency warnings](evidence/chog-presentation-build.txt) |
| `npm run typecheck` (after build)                                                                                         | [Pass](evidence/chog-presentation-types.txt)                                                           |
| `npm test`                                                                                                                | [187 pass, one live opt-in skipped](evidence/chog-presentation-tests.txt)                              |
| `CHOG_E2E_BROWSER_CHANNEL=chrome PLAYWRIGHT_BROWSERS_PATH=/tmp/chog-installed-browser-tools npm run test:e2e`             | [38 pass](evidence/chog-presentation-all-browser.txt)                                                  |
| Same browser environment; `npm run test:e2e -- tests/e2e/combat-presentation.spec.ts --grep combat-normal-versus-reduced` | [Focused terminal correction: pass](evidence/chog-presentation-terminal-browser.txt)                   |

Static checks/build/unit tests were repeated after that focused correction; unchanged unrelated browser flows were not needlessly rerun. All authority/transfer/privacy/museum/adventure regressions are in the saved full-suite result. Automated Axe checks report zero exercised A/AA violations, not a complete native screen-reader audit.

Final project-only [Desloppify scan](evidence/chog-presentation-desloppify-scan.txt), [status](evidence/chog-presentation-desloppify-status.txt) and [next](evidence/chog-presentation-desloppify-next.txt): **objective89.4, overall22.3, strict21.2**, target85 unmet. 153 open findings: 79 coverage, 47 smells, 20 unassessed subjective dimensions, three single-use, two naming, one orphan and one signature finding. Security/duplication/structural scan phases reported no new findings. The signature detector still carries a `finish` finding attributed to combat engine despite the named function having moved/changed; it was not suppressed or marked resolved to improve the score. Direct hook/presentation coverage and broader existing error/complexity concerns remain; passing behavior suites do not eliminate those findings. The next gate is the initial subjective review. No scored reviews, suppressions, fixture changes, questionable exclusions or new accepted-debt decisions were used. The finishing documentation-only changes need no additional code scan under project policy. No dependency/browser installation: existing Chrome and Homebrew FFmpeg are reused through a temporary Playwright executable lookup symlink. TLS verification remains enabled for disposable synthetic RPC/provider fixtures. User wallet keys/signatures are never used.

Presentation regressions exposed and fixed: duplicate React sibling keys could leave old numeric badges; the glyph layer also duplicated visor/goggle eyes; native select keyboard automation was unreliable, so difficulty now uses accessible native radios; enlarged-text intrinsic widths/old status offsets were corrected; per-hit effect identities reset motion and impact cues. Focused cleanup checks require no leftover move effects, impact stars or numeric cues once a round finishes. No combat stat/rule rebalance occurred.

Representative screenshots and actual WebM/MP4 screen recordings come from real production-build gameplay on an isolated database, not concept animation. Complete normal/reduced-motion battles compare exact final state and choices. Counter, repair, multi-hit/dodge/burn/recoil, knockout, desktop/mobile, keyboard and enlarged-text sequences are exercised. Manual live inspection uses a separate `/tmp` guest database, preserving the user's game. Synthetic holder tests retain clear labels; no live holder login/gameplay is claimed.

### Recorded gameplay and screenshots

Browser review watched production recording playback of defence/shield use, Aegis responding counter, Patch's attack then actual +14 HP repair, Bolt's two impacts, burn/recoil and a complete Pip victory/knockout. Impact timing and final cleanup were checked against the test assertions. This is developer visual review, not human feedback. Close fighter overlap during a melee impact is intentional; native cross-browser/screen-reader and broader visual preference testing remain open.

- [Block, shield bash and responding counter — MP4](evidence/recordings/combat-counter.mp4) / [original WebM](evidence/recordings/combat-counter.webm)
- [Attack versus repair — MP4](evidence/recordings/combat-repair.mp4) / [original WebM](evidence/recordings/combat-repair.webm)
- [Separate deliveries, dodge, burn and recoil — MP4](evidence/recordings/combat-multi-hit.mp4) / [original WebM](evidence/recordings/combat-multi-hit.webm)
- [Complete normal battle and knockout — MP4](evidence/recordings/combat-normal-versus-reduced.mp4) / [original WebM](evidence/recordings/combat-normal-versus-reduced.webm). The test separately plays reduced motion in a second context and asserts exact equality; this primary recording is the normal context, not a split-screen comparison.
- [320px enlarged-text keyboard sequence](evidence/recordings/combat-mobile.webm)
- [Easy setup/refresh/rematch](evidence/recordings/difficulty-easy.webm), [Medium](evidence/recordings/difficulty-medium.webm), [Hard](evidence/recordings/difficulty-hard.webm)
- Screenshots: [counter](evidence/presentation-counter.png), [repair](evidence/presentation-repair.png), [mobile/enlarged text](evidence/presentation-mobile.png), [updated finished battle](evidence/presentation-knockout.png).

MP4s are conversions of the actual captured WebMs using existing Homebrew FFmpeg, without retiming or manufactured gameplay. Earlier recordings retain pre-correction terminal text if a finished match is reached; the complete-knockout clip/screenshot were recaptured after the terminal correction.

## Playtest and remaining gates

[Human playtest guide and minimal non-identifying feedback template](HUMAN_PLAYTEST.md). No participants, feedback, retention or human win rates have been invented; no one was contacted. Real-holder login/signature/gameplay remains user-operated. My Chog uses the existing actual-token-ID grant: sign through Privy yourself, verify an actually owned Monad143 Chog, choose a holder fighter/mode, play/refresh/rematch and compare unchanged stats across modes. The example CHOG #1737 is token276, not1737. No NFT purchase/transfer is needed.

Current NFT combat utility is verified holder access and private token-associated records. Persistent fighter progression, configurable combat loadouts and combat ghost training are **not implemented**. [Future progression design note](TOKEN_PROGRESSION_FUTURE.md) is explicitly unimplemented and adds no automatic victories or NFT-count power stacking. Consented adventure history and private-data boundaries remain.

At 320px with 200% text, controls remain operable without horizontal overflow or fighter/status overlap, but long cooldown text wraps awkwardly; further typography polish is still useful. Balance, cross-browser/native screen-reader testing and actual consenting human observations remain provisional gates. The app remains a trusted local service with SQLite/durable Node hosting requirements. No deployment, commit, push, dependency/subagent installation, purchases, transfers, user-wallet signing, outreach or paid services occurred; those actions still require their applicable authorization.

## Changed boundaries

New presentation move/cue/projection modules, shared pure bonus facts, twelve-body anatomy, move effects and playback identity handling; new typed difficulty contracts/distribution/easy/medium/hard plus preserved legacy policy; snapshot/API/service difficulty validation/history/rematches; focused arena/setup/control/style updates; new unit/integration/benchmark/browser tests and recordings. Existing auth/ownership logic and adventure schemas were preserved. Documentation/provenance and playtest/future notes are updated separately.
