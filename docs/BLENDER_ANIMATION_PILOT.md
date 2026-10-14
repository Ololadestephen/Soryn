# Aegis/armadillo playable animation pilot — October 13, 2026

**Current visual direction — October 13, 2026:** the approved sculpted rendered artwork is restored as the default across all twelve fighters and companions. The simplified Blender pilot is not the approved visual direction. Editable Blender sources/scripts remain preserved. See [restoration, sharpness evidence and limits](ART_RESTORATION.md).

The local arena now renders actual Blender-authored skeletal samples for Aegis and its armadillo. Blender MCP was verified and used for modelling, rigging, action authoring and pose inspection; isolated local Blender Python reproduces and renders the assets. This supersedes the earlier missing-tool limitation in [the fallback milestone](BLENDER_PILOT.md).

The user requested continuation after the neutral model previews. Only this pair is converted. Other eleven fighters retain their existing artwork. Engine stats/rules, difficulty versions, authentication, fresh ownership/generation checks, private records and adventure/museum URLs remain unchanged. The browser consumes authoritative presentation events; it never calculates damage or outcomes.

## Editable source and export

- [Rigged source project](../assets/combat/blender/animation-pilot/aegis-armadillo-rigged.blend): Aegis 26 bones, armadillo seven, 282 bound mesh parts including baked editable trim, 40 continuous curl shape keys. Source actions are saved explicitly, including inactive actions, and the file opens on the pilot scene.
- [Neutral model source and five review views](BLENDER_MODEL_REVIEW.md). Geometry/materials were authored here from the approved original Aegis/armadillo references; no third-party models, NFT artwork or paid generators were used. Original model-review sources remain separately editable.
- Aegis actions: idle, basic, special, guard/hold, guard recovery, counter, hit, guarded hit, knockout, guarded knockout and defeated hold. Armadillo: idle, coordinated special/curl/roll/recovery, settled hold. Planted stance uses limb IK. The roll uses actual skeleton rotation and continuous curl geometry, not rotation of one static pose picture.
- 233 genuine transparent RGBA rendered samples, packed into 14 WebP atlases. Original PNG samples remain in `assets/combat/blender/frames/`; runtime images are in `public/combat/blender/`. [Manifest and exact measurements](evidence/blender-animation/manifest.json).

Run from the project root, using a fresh output directory for source reproduction:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background assets/combat/blender/review-v05/aegis-armadillo-model-review.blend --python-exit-code 1 --python scripts/blender/build_pilot.py -- --output test-results/my-rig
/Applications/Blender.app/Contents/MacOS/Blender --background test-results/my-rig/aegis-armadillo-rigged.blend --python-exit-code 1 --python scripts/blender/finalize_review.py
/Applications/Blender.app/Contents/MacOS/Blender --background test-results/my-rig/aegis-armadillo-rigged.blend --python-exit-code 1 --python scripts/blender/test_animation.py
/Applications/Blender.app/Contents/MacOS/Blender --background test-results/my-rig/aegis-armadillo-rigged.blend --python-exit-code 1 --python scripts/blender/export_frames.py
node scripts/prepare-blender-sprites.mjs
```

The exporter defaults to regenerating the project's PNG samples; use `-- --output <directory>` for an isolated export. The atlas packer intentionally regenerates runtime images and renderer metadata from those samples. Blender 5.2.2 LTS was tested. No Blender software/addon or project dependencies were installed by the agent.

## Browser integration

Pure presentation selection maps real wind-up/action/impact/recovery, guard, responding counter, damage and knockout to the appropriate sampled phases. Prepared special shields transition into the coordinated attack. Cancelled attacks create no executed attack animation. Stable knockout identities retain defeated hold across later events/results; refresh opens directly on hold and never replays the death. Rematches reset visual state. Reduced motion uses representative static poses.

Aegis-specific anticipation/delivery/recovery and knockout presentation durations allow its clips to complete while inputs remain locked. Combat rules and persisted choices/results are unaffected. Numeric health changes remain on authoritative impact frames. Existing notice replacement/expiry/deduplication, keyboard focus, compact HUD/result and optional history are preserved. Portrait ground alignment and explicit cooldown labels remain verified.

Each sprite has an explicit unique frame clip, so a square viewport cannot reveal neighbouring cells through letterboxing. One fixed crop per actor across every clip preserves framing and pivots. CSS pose rotations are disabled for this pair, while existing arena travel still moves the actors. Asset-load failures retain the original artwork and actual playable combat. No realtime 3D engine or renderer migration was introduced.

## Tested evidence

| Check                                                | Result                                                                                                                                                                                                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                           | [198 passed, 33 suites, one optional live check skipped](evidence/blender-animation/tests.txt)                                                                                                                                                     |
| App formatter/lint/typecheck/build                   | [Format](evidence/blender-animation/format.txt), [lint](evidence/blender-animation/lint.txt), [types](evidence/blender-animation/types.txt), [build](evidence/blender-animation/build.txt) pass; existing optional provider/Tempo warnings remain  |
| Real Blender tests                                   | [Eight model checks](evidence/blender-animation/model-tests.txt), [five rig/action checks](evidence/blender-animation/rig-tests.txt) pass                                                                                                          |
| Independent rig reproduction                         | [Rebuild](evidence/blender-animation/reproduction.txt), [same five checks](evidence/blender-animation/reproduced-rig-tests.txt) pass                                                                                                               |
| Python/packer static checks                          | [Ruff](evidence/blender-animation/python-lint.txt), [Python format](evidence/blender-animation/python-format.txt), [packer lint](evidence/blender-animation/packing-lint.txt), [packer format](evidence/blender-animation/packing-format.txt) pass |
| Full production browser run                          | [45 passed; one observer raced the asynchronous start](evidence/blender-animation/browser.txt)                                                                                                                                                     |
| Corrected observer, notice, portrait and performance | [Both passed after waiting for the actual dialog/notice region](evidence/blender-animation/browser-observer-final.txt)                                                                                                                             |
| Complete victory/defeat and asset failure            | [All three focused flows passed](evidence/blender-animation/browser-pilot-final.txt)                                                                                                                                                               |

**46 distinct browser flows passed across the full/focused runs**, not a single fully green 46-case run. The observer correction changes test readiness, not app behavior; unchanged flows were not needlessly rerun afterwards. Coverage includes real basic/guard/special/counter/hit, full outcomes, input locks, focus, normal/reduced motion, refresh/rematch, desktop/portrait bounds, cancelled and multi-hit behavior, unavailable assets, ownership/RPC/revoked grants, inherited public history/private isolation, museum consent and the secondary adventure.

Eight model checks and five rig checks are distinct. The repeated checks on reproduced files do not increase that count. Rig tests inspect saved bones/action slots, weighted vertices, evaluated foot positions, continuous curl/recovery and equal knockout/defeated hold. Contact is measured across each complete foot; raised claws are not falsely required to touch the floor. These tests do not establish perfect collision-free deformation or anatomical realism.

An initial browser inspection exposed neighbouring atlas leakage, which was fixed with explicit frame clips and a paired-Aegis clipping regression. Curl inspection exposed overlapping shell surfaces and untucked paws/hinges; layer thickness and skeletal tuck were corrected. A proposed Medium test sequence legitimately drew. Victory coverage uses the normal Easy policy; no stats or outcome fixtures were altered.

## Footage, measurement and assessment

- [Complete Easy victory MP4](evidence/blender-animation/aegis-victory.mp4) / [WebM](evidence/blender-animation/aegis-victory.webm): normal motion, basic/guard/special/counter, full result, refresh and reduced rematch.
- [Complete Medium defeat MP4](evidence/blender-animation/aegis-defeat.mp4) / [WebM](evidence/blender-animation/aegis-defeat.webm): specials, defence/counter, knockout, result/refresh and optional history. First five rounds normal motion, later rounds reduced motion.
- [Before](evidence/blender-animation/before.webm) versus the Medium defeat after recording: comparable framing and moves. Both end in nine-round defeat. No footage was retimed or manufactured. The watermark identifies signed synthetic-holder/RPC QA, not a live holder session.
- [Actual idle](evidence/blender-animation/idle.png), [victory](evidence/blender-animation/victory.png), [portrait](evidence/animation-pilot/portrait-idle.png), [source rig roll](evidence/blender-model-review/rig-roll-contact.png).

Runtime files total **2,264,426 bytes**. Full-atlas 8-bit RGBA estimates total **73,646,596 bytes (70.2 MiB)**, down from the first packing's 132,808,704 bytes (126.7 MiB) by removing shared empty margins. The old pair's static atlases were 603,412 bytes and approximately 12 MiB RGBA, so this pilot increases download/decode costs. Clips load as needed, but the all-atlases estimate is reported rather than assuming ideal cache eviction. These figures are not measured heap or GPU residency. Source rigs/PNG samples are not served to the browser.

[Local browser observations](evidence/blender-animation/browser-observations.json): Apple M3, 8 GiB RAM, macOS 27.0.1 arm64, installed Chrome 155.0.8059.40, 390×844, 381 animation-frame samples; median 16.7 ms, p95 16.8 ms, maximum 66.7 ms callback gap. QA recording/DOM observation add overhead. Resource timing includes selection art and used pilot clips; HTTP decoded-body size is not decoded pixel memory. No throttled-device, low-end-phone, heap/GPU or cross-browser claim is made.

The pilot establishes real editable motion, planted stance and a coordinated 3D roll. **It does not justify converting the remaining roster yet.** The model is simpler and less ornamented than the approved rendered artwork, with noticeably different material/facial detail; root arena travel and braced source steps are a presentation approximation, not a physical locomotion simulation. Some transitions can still read mechanically. Human visual review, art-fidelity refinement and broader mobile performance remain the next gate. No human balance/enjoyment/retention evidence or observed real-holder signing/gameplay is claimed.

Code-health scores, unresolved findings and raw command evidence are recorded in the adjacent scan/status/next files. Targets remain unmet; no authored source exclusions, suppressions, accepted-debt decisions or manufactured subjective ratings were used. No purchases, transfers, deployments, commits, pushes, outreach or real user-wallet signatures occurred.

## Desloppify report

Project TypeScript scan/status/next ran within this repository; the Python authoring tool was separately scanned within `scripts/blender`. These are distinct coherent boundaries, not a scan of the Desktop. Existing dependency/build/cache/database exclusions were retained. `.desloppify`, Python caches and Blender backup files are ignored; authored source remains included.

| Boundary       | Overall | Objective | Strict | Verified | Open |
| -------------- | ------: | --------: | -----: | -------: | ---: |
| App TypeScript |    22.4 |      89.6 |   21.3 |     89.6 |  161 |
| Blender Python |    17.6 |      70.6 |   17.4 |     70.6 |   38 |

The strict target 85 is not achieved. Baseline app objective/strict was 89.5/21.3; initial Python objective/strict was 59.1/14.8. Subjective dimensions remain unassessed, represented as zero by the tool rather than invented ratings.

| Dimension         | App health / strict | Python health / strict |
| ----------------- | ------------------: | ---------------------: |
| Code quality      |         98.3 / 96.4 |            98.8 / 92.5 |
| Security          |        100.0 / 98.4 |          100.0 / 100.0 |
| File health       |       100.0 / 100.0 |           100.0 / 93.6 |
| Duplication       |        100.0 / 99.9 |          100.0 / 100.0 |
| Test health       |         44.6 / 24.4 |            26.9 / 30.1 |
| Abstraction fit   |           0.0 / 0.0 |              0.0 / 0.0 |
| AI generated debt |           0.0 / 0.0 |              0.0 / 0.0 |
| API coherence     |           0.0 / 0.0 |              0.0 / 0.0 |
| Auth consistency  |           0.0 / 0.0 |              0.0 / 0.0 |
| Contracts         |           0.0 / 0.0 |              0.0 / 0.0 |
| Convention drift  |           0.0 / 0.0 |              0.0 / 0.0 |
| Cross-module arch |           0.0 / 0.0 |              0.0 / 0.0 |
| Dep health        |           0.0 / 0.0 |              0.0 / 0.0 |
| Design coherence  |           0.0 / 0.0 |              0.0 / 0.0 |
| Error consistency |           0.0 / 0.0 |              0.0 / 0.0 |
| High elegance     |           0.0 / 0.0 |              0.0 / 0.0 |
| Stale migration   |           0.0 / 0.0 |              0.0 / 0.0 |
| Init coupling     |           0.0 / 0.0 |              0.0 / 0.0 |
| Logic clarity     |           0.0 / 0.0 |              0.0 / 0.0 |
| Low elegance      |           0.0 / 0.0 |              0.0 / 0.0 |
| Mid elegance      |           0.0 / 0.0 |              0.0 / 0.0 |
| Naming quality    |           0.0 / 0.0 |              0.0 / 0.0 |
| Structure nav     |           0.0 / 0.0 |              0.0 / 0.0 |
| Test strategy     |           0.0 / 0.0 |              0.0 / 0.0 |
| Type safety       |           0.0 / 0.0 |              0.0 / 0.0 |

All twenty subjective rows above are unassessed. Raw [app scan](evidence/blender-animation/scan.txt), [status](evidence/blender-animation/status.txt), [next](evidence/blender-animation/next.txt) and [Python scan](evidence/blender-animation/python-scan.txt), [status](evidence/blender-animation/python-status.txt), [next](evidence/blender-animation/python-next.txt) retain findings and detector limits.

Remaining app findings are primarily import-linked coverage and existing smells/structural/naming warnings. Python coverage warnings remain despite actual Blender round-trip tests. Delayed imports at standalone CLI execution boundaries are retained to make the package importable without mutating `sys.path` on library import; they are not hidden circular dependencies. New renderer clipping, terminal-state, source-action retention, curl-thickness and atomic-write issues were corrected. No health campaign, branches, commits, pushes or upstream reports were authorized or performed.
