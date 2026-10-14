# Future arena movement — documentation only

Free movement is not implemented or part of this milestone. Existing event-bound attack lunges, contact holds and returns remain. The current presentation uses rendered artwork: six fighter poses and three companion poses, not walk cycles or faithful realtime models.

## Missing artwork and animation

Every family needs a consistent locomotion set: idle-to-walk, walk loop, walk-to-idle, run start/loop/deceleration, turning in place, direction changes, braking and planted stops. Multiple facing directions would require corresponding views rather than simply mirroring baked light. Companions need their own matching ground/flying gait, follow/stop/turn and special-to-locomotion transitions. Existing wind-up/special/guard/hurt/defeated poses do not supply intermediate limb motion, stride or weight transfer. Contact, hit reactions and knockout transitions would need animation compatible with those cycles.

## Keep position separate from combat truth

A future design should represent arena position, facing and locomotion state separately from frozen fighter definitions, health, resources, choices and resolved combat events. Do not retrofit positions into existing saved outcomes or make a presentation timer calculate damage. First decide whether positioning is cosmetic or a real tactical rule; tactical reach, collision or dodge would require an explicitly versioned rules change and authoritative validation. No such rule, schema, API, controls or dependencies are added now.

## Coexistence with turn selection

For cosmetic movement, players could reposition only during an eligible selection phase. Lock or smoothly settle both actors before resolving the paired choices; save their origins for readable attack travel and returns. Event playback must retain input locks, authoritative impact timing, cancelled-attack rejection and terminal holds. Refresh should recover a stable stance without replaying hits or replacing a saved battle. Reduced motion should retain locations and clear state while omitting travel interpolation. A later multiplayer design would need its own ownership, latency and reconciliation policy; the current opponent remains the persisted computer.

## Faithful rigs versus pose atlases

Faithful rigged models would be useful for arbitrary turning, coherent walk/run transitions and reusable skeletal blending. They must match the approved sculpted faces, fur, armour, shields and companion proportions, with a human visual acceptance gate before becoming default. The preserved Aegis/armadillo Blender pilot is an editable technical experiment; its simplified look is not the approved direction. It may be refined or replaced while retaining provenance. A rig alone does not guarantee good deformation, planted feet or performance.

Alternatively, faithful prerendered multi-direction gait cycles could extend the artwork pipeline. That incurs substantially more source frames, downloads and decoded memory. The current atlas pipeline can isolate cells and hold consistent pivots, but discrete static poses cannot create missing walk anatomy, perspective or facial detail. Scaling/rotating a static sprite cannot substitute for a gait, and enlarging it cannot recover missing source resolution. Choose the smallest visually accepted approach after motion, art and device review; do not prebuild speculative movement abstractions.
