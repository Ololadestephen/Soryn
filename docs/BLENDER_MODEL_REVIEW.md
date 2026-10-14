# Aegis and armadillo model review — October 13, 2026

**Current visual direction — October 13, 2026:** the approved sculpted rendered artwork is restored as the default across all twelve fighters and companions. The simplified Blender pilot is not the approved visual direction. Editable Blender sources/scripts remain preserved. See [restoration, sharpness evidence and limits](ART_RESTORATION.md).

**Current animation update:** [BLENDER_ANIMATION_PILOT.md](BLENDER_ANIMATION_PILOT.md) records the real rig/actions, transparent exports and playable pair. Earlier model/tooling descriptions below are historical; other eleven families remain on their existing assets.

Blender MCP is verified: Blender 5.2.2 LTS, addon 1.8/protocol 13, current, telemetry off. Asset libraries and paid generators are disabled and were not used. The local executable is `/Applications/Blender.app/Contents/MacOS/Blender` and fresh-process Python reproduction works. This supersedes the earlier missing-tool audit.

The editable model draft follows the original purple guardian, cream muzzle/mane, ivory/gold armour, scarf/tabard, tall spiral kite shield and small armadillo with segmented shell, gold hinges, pointed ears, claws and banded tail. Shapes and materials are simplified relative to the approved rendered artwork; these are actual meshes/curves, not textured planes pretending to be models. User continuation after the neutral renders starts the rigging stage; it is not a claim of human playtesting or final art acceptance.

Source: [editable v05 Blender project](../assets/combat/blender/review-v05/aegis-armadillo-model-review.blend). Neutral [pair](../assets/combat/blender/review-v05/neutral-pair.png), [front](../assets/combat/blender/review-v05/neutral-front.png), [profile](../assets/combat/blender/review-v05/neutral-profile.png), [companion](../assets/combat/blender/review-v05/neutral-pet.png), [companion side/tail](../assets/combat/blender/review-v05/neutral-pet-profile.png). These renders are 1600×1200 RGB studio previews, not transparent game exports.

The model scene has 227 mesh parts, 75,668 source vertices and 77,781 source polygons, plus editable trim curves. Aegis is 4.542 units tall; armadillo is 0.862 units tall. Feet are on the shared zero ground plane. Body pieces, armour and head features remain separately editable. Packed references are hidden from rendering. The saved file opens directly on `Chog_Aegis_ModelReview_v05` with the pair camera active. The user's original default scene was preserved during authoring.

The draft source has zero armatures and zero animated objects. It is not rig-ready certification: joint topology, deformation, facial/armour fidelity and action contact still require the next stage and visual verification. The existing arena artwork, other eleven fighters, engine, rules, ownership and saved records remain unchanged.

## Reproduce in isolated Blender

Run from the project root, with a fresh output directory. The builder rejects accidental overwrite or duplicate live scenes. Building creates an isolated scene library to preserve unrelated live work; finalizing in a separate background process turns it into a normal project that opens on the correct scene.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 --python scripts/blender/build_review.py -- --output test-results/my-model-review --render
/Applications/Blender.app/Contents/MacOS/Blender --background test-results/my-model-review/aegis-armadillo-model-review.blend --python-exit-code 1 --python scripts/blender/finalize_review.py
/Applications/Blender.app/Contents/MacOS/Blender --background test-results/my-model-review/aegis-armadillo-model-review.blend --python-exit-code 1 --python scripts/blender/test_model_review.py
```

Authoring modules are under `scripts/blender/`: geometry/material helpers, anatomy, Aegis, companion, scene construction, execution-only CLI bootstrap, finalization and actual Blender tests. Blender enum choices are checked at runtime. Dynamic OCIO defaults are retained because RNA under-reports available view transforms; the tested renderer uses AgX/EEVEE.

## Tested progress

- [Eight saved-model checks pass](evidence/blender-model-review/saved-model-tests.txt): geometry, startup scene, ground/proportions, shield-emblem fit, sampled armour clearances, shell/limbs, materials/packed references, cameras and no animation/export claim.
- [Independent rebuild/render](evidence/blender-model-review/reproduction-final.txt) and [the same eight checks on its saved file](evidence/blender-model-review/reproduced-model-tests.txt) pass. Reported geometry/bounds match the MCP-authored source. Eight distinct checks were run twice, not sixteen distinct cases.
- [194 app tests pass, one optional live check skipped](evidence/blender-model-review/app-tests.txt), plus [format](evidence/blender-model-review/app-format.txt), [lint](evidence/blender-model-review/app-lint.txt), [types](evidence/blender-model-review/app-types.txt), [production build](evidence/blender-model-review/app-build.txt). Existing optional provider/Tempo build warnings remain. Runtime/browser code was not changed by model authoring; the earlier 44 browser flows are historical evidence, not rerun in this stage.
- [Python Ruff](evidence/blender-model-review/python-lint.txt) and [format](evidence/blender-model-review/python-format.txt) pass using an already installed cached executable, with no dependency install. Blender's source file was reopened in a separate process, not merely checked for existence.

Visual checks corrected cropped framing, oversized eyes, an oval shield, uneven intersecting armour, a floating shield emblem, and visible body intrusion through the breastplate. The sampled clearance regression does not prove every angle or future deformation is collision-free. Neutral renders are for visual review; no motion quality, runtime download/decode budget or low-end performance gain is established yet.

## Provenance and next work

Original procedural geometry/materials authored here with AI assistance. Design references are the approved original `assets/combat/rendered/aegis.png` and `armadillo.png`, with earlier generation provenance in [the original manifest](evidence/arena-3d/asset-manifest.json). No NFT/Kuroro art, third-party models, purchases, paid generators, deployment, wallet signatures, commits or pushes were used.

Next: real rigs/actions; planted idle, basic, guard/hold, hit, coordinated curl/roll special, recovery and knockout; transparent samples; measured compression and decoded pixel budgets; integration through authoritative presentation frames with fallback and reduced motion; complete Aegis/Ember battles and before/after footage. Keep the scope to this pair and report any art-fidelity or motion limitations before considering the remaining roster.
