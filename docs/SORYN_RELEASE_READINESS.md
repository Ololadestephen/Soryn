# Current release-readiness continuation — October 16, 2026

**Health queue recovery — October 16, 2026:** all twenty outstanding concrete blind-review findings are fixed, tested and resolved. Normal mechanical scanning now completes: objective 92.3, displayed strict 87.4. Fresh subjective scores remain pending because the blind runner hit its usage limit. See [the queue recovery report](HEALTH_QUEUE_RECOVERY.md) for changes, checks, evidence and the remaining review gate. This does not authorize hosting or real-wallet actions.

The current report is [M7_RELEASE_REPORT.md](M7_RELEASE_REPORT.md). The original report below is retained as historical evidence. Its scores and test counts are not a fresh scan, and its prior GO language does not approve a hosted holder release.

M7b and M7c now have bounded outage/reservation semantics, private keeper Story progress, selected-token main modes and opt-in public records. See [SERIES.md](SERIES.md) for the implemented policy. Hosting and real-holder participation remain unexecuted gates. No forced scans, queue resets, dependency downgrades, paid services, deployments, commits or pushes were performed.

---

# Soryn release readiness

Updated October 15, 2026. Scope: the repository quality gate and readiness for the controlled hosted
two-device test (M8 in [CHOGATHON_PLAN.md](CHOGATHON_PLAN.md)). Nothing was committed, pushed, hosted,
deployed, or signed. All play evidence is guest-mode against isolated browser fixtures and a disposable
test database; no real holder session exists.

## Verdict

- **GO (conditional)** for the controlled hosted two-device test using the M8 setup and the two-device
  checklist in [SORYN_PLAN.md](../SORYN_PLAN.md) (one Node process, one SQLite file that is not
  `data/local/chog.sqlite`, `APP_ORIGIN` set to the exact public origin, `CHOG_PVP_TIMERS` unset).
- **NO-GO** for any public or real-holder claim, achievement claims, a $CHOG threshold, or any
  anti-cheat, scale, uniqueness, or retention claim. Those gates are unchanged and unmet.

## Verified October 15, 2026

Commands run on this machine against the current working tree:

- `npm run format:check` — pass.
- `npm run lint` — pass.
- `npm run typecheck` — pass.
- `npm run build` — pass; `/match`, `/story`, `/challenge/[invite]`, and the archive routes are present.
- `npx vitest run` — 61 files, 352 passed, 1 skipped.
- `env -u PLAYWRIGHT_BROWSERS_PATH npm run test:e2e -- tests/e2e/release-readiness` — **15 passed**
  (13.0m, one run): navigation (6), public 2–0 series through the queue, public 2–1 series, restart of
  one server across real process restarts during a locked battle, story grove and foundry endings, a
  recorded scout loss, a recorded mid-route grove-guardian loss — each loss persisting through refresh
  and retrying the same encounter with a new battle id — plus the two M7b ownership cases: a fixture
  verification outage that fails official play closed with an explicit 503 and recovers with the room
  unchanged, and a confirmed fixture transfer that voids a live series as a no contest mid-round
  without leaking the locked move, refuses the old owner's writes, and lets the new owner open a
  fresh room.
- Evidence refreshed in `docs/evidence/soryn-readiness/`: landing and Play-menu
  screenshots (desktop and portrait), public series JSON and result screenshots, restart JSON and
  screenshots, story endings and both retries (`story-retry.png`/`story-loss-retry.json` for the
  scout, `story-guardian-retry.png`/`story-guardian-loss-retry.json` for the guardian), and the
  ownership cases (`ownership-outage.json`/`.png`, `ownership-transfer.json`,
  `ownership-transfer-no-contest.png`). Recordings were regenerated from that same run's webm
  captures: `public-2-0-complete.mp4` (80.1s), `public-2-1-complete.mp4` (125.5s),
  `story-grove-complete.mp4` (133.2s), and `story-foundry-complete.mp4` (135.1s).
- `npm audit --omit=dev` — 23 moderate, 0 high, 0 critical, all through the Privy and wallet stack
  (`docs/evidence/soryn-readiness/production-audit.json`). No package was changed. Decision and
  rationale: [WALLET_DEPENDENCY_ASSESSMENT.md](WALLET_DEPENDENCY_ASSESSMENT.md).
- `data/local/chog.sqlite` was not opened (mtime October 14, 22:29).

## Fixed today after review

1. Queue offer expiry now uses the named `isLate` rule (`src/server/pvp/queue.ts:125`); every
   user-visible PvP deadline shares one predicate and one boundary behavior.
2. The PvP GET handler parses the invite once and reuses it (`src/server/pvp/http.ts:264-266`).
3. The legacy game POST uses the shared `requireJsonOrigin` guard (`src/server/http.ts:74`).
4. The commit-on-poll rule is documented on `PvpService.preview`/`session` and the GET handler.
5. The retained mid-battle seat window is documented (`docs/PRIVATE_PVP.md:116`, `retainsSeat`
   docstring) and pinned by `tests/integration/pvp-holder-scope.test.ts` (move after transfer 200,
   new-battle privileges 403, different Privy subject 401, revoked session 401).
6. The restart e2e harness now refuses a stale port, cleans up with SIGKILL, and no longer hangs on
   an already-exited child (`tests/e2e/release-readiness/restart.spec.ts`).
7. M7a's missing mid-route case now exists: a grove-guardian loss that persists through refresh and
   retries the same encounter with a new battle, then wins it and advances to the boss
   (`tests/e2e/release-readiness/story-branches.spec.ts:147`). While building it, the scout battle
   was found unwinnable with Bolt under the test helper's default policy, so the case leads with
   Pip (a matchup observation about the helper, not a product change).
8. M7b shipped: a confirmed ownership change (or reorg generation change) ends an open official
   series as a no contest, discards only the interrupted battle, keeps completed records, and locks
   the old owner out of every official write while leaving session history. Outages fail closed with
   an explicit verification-unavailable response and a bounded stall termination. One SQLite token
   lock per chain/collection/tokenId serialises public, private, and story official play and
   survives restarts. `tokenActorUuid` moved to `src/server/tokenActors.ts` after the client build
   failed on `node:crypto` reaching a client component through `src/domain/identity.ts`, and the
   story HTTP channel now runs the same interrupted path as PvP.

All nine were re-verified with the static checks, the unit suite, the production build, and the full
browser suite above.

## Desloppify score, honestly

- **Strict 84.0 / target 85.0** (plan start 82.2, +1.8). Mechanical (objective) 91.7; subjective 82.8.
  Strict will not move until the review queue is cleared and a scan runs; it was not forced.
- Five dimensions were re-reviewed after today's fixes with fresh evidence in each rationale:
  Auth consistency 86.0, Contracts 86.0, Convention drift 86.0, Logic clarity 85.0, Low-level elegance
  85.0. The tool flagged the authorization score as matching the target as a gaming risk; it was
  re-run through a forced careful review with a documented rationale, not adjusted to fit the target.
- Security detector clean. Exclusions are only dependencies, caches, and build/test output; no
  authored engine, API, tests, or game content was excluded.
- Test health reads 53.4% with 109 mechanical items; it is a coverage detector signal that needs its
  own investigation pass before anything is "fixed" to satisfy it.

## Open review items (not release blockers for the controlled guest test)

Not resolved, to keep the score honest:

1. `actor_resolution_precedence_implicit` — extract one documented seat-resolution chain with table tests.
2. `optional_mode_defaults_to_guest` — wallet-carrying writes with omitted mode resolve through the
   ladder; verification showed the premise is partially inverted, so it waits for item 1.
3. `settle_scaffold_repetition` — extract one `withRoom` helper for mutate/preview/join/leave.
4. `queue_view_type_crosses_layers` — move the `QueueView` type into the domain folder.
5. `holder_eligibility_split_layers` — consolidate holder eligibility between the service and the auth callback.
6. `queue_bypasses_pvp_store` — route queue access through the PvpStore boundary.
7. `queue_rows_double_cast` — replace the raw queue row casts with a validated mapper.
8. `client_assumes_json_errors` — the client request helper assumes JSON error bodies.
9. `ready_versus_confirm_ready` — name the verified ready path distinctly.
10. `play_route_name_collision` — `/start` versus the archive `/play` naming.
11. `origin_env_read_two_ways` — `APP_ORIGIN` is read per request in one place and frozen at first
    request in another.
12. `auth_vs_identity_client_folders` — wallet client components are split across two folders.
13. `evidence_freshness_unchecked` — recorded evidence can silently disagree with later code.
14. `privy_transitive_moderate_advisories` — keep pinned, re-run the audit each release.

## Decisions that are still the founder's

- M7b is now implemented and gated: policy in `docs/SERIES.md`, code in `src/domain/pvp/ownership.ts`
  plus the PvP/story services and locks, and evidence from 30+8 unit tests, 12 integration cases, and
  2 labelled browser cases. What remains the founder's call is the wider scope: M7c (one public
  starter-only queue with verified Chog entrants and the public token profile), host/domain/budget
  for M8, approval for the holder ask (M9), a $CHOG threshold decision (M10), and commit/push
  approval.

## What this document does not claim

No hosted or physical-device test has run. No real holder signed or played. No wallet transaction or
signing occurred. No NFT metadata is modified; Soryn history is issuer-trusted application data.
Recordings are guest fixtures and are labelled as such. Correctness against adversarial or scaled use
is not established.
