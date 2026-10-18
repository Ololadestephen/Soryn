# M7b/M7c and local release preparation

**Health queue recovery — October 16, 2026:** all twenty outstanding concrete blind-review findings are fixed, tested and resolved. Normal mechanical scanning now completes: objective 92.3, displayed strict 87.4. Fresh subjective scores remain pending because the blind runner hit its usage limit. See [the queue recovery report](HEALTH_QUEUE_RECOVERY.md) for changes, checks, evidence and the remaining review gate. This does not authorize hosting or real-wallet actions.

Updated October 16, 2026. Worktree remains uncommitted on `main` at the original `fb398e8`. User changes were preserved. This report covers the continuation from the supplied M7a/M7b work, not authorship of all files currently shown by Git.

## Implemented ownership and deadline behavior

Confirmed transfer and generation invalidation end open official series without a series winner or a new win for the interrupted battle. Finished battles keep frozen participating grants. Reasons distinguish `ownership-changed`, same-owner `generation-invalidated`, `verification-unavailable` and `reservation-expired`. Setup lobbies close before a competitive battle opens. Old grants and interrupted battles do not revive after transfer/back. Previously earned Story checkpoints remain with the original keeper; the successor gets a fresh private run and published accomplishments only.

Fresh evidence gates official player actions, ready, clock/timeout polls, intermission, surrender/finalization, reopening and publication. A renewed generation cannot use a historical seat to rematch. All stamped PvP seats are observed together, with the provider result/freshness checks reapplied. Only concurrent in-flight observations are shared; completed evidence is not an authorization cache. Late provider results after the 12-second observation timeout cannot commit authority. Unstamped legacy official encounters fail closed; legacy guest standalone rooms remain playable.

Outage handling is observed and persisted, not an invented transfer: HTTP 503 initially, current battle/intermission clocks rebased by the observed pause once on recovery before the bound, and at least one hour unavailable ends as abandoned with no winner. Recovery after that bound does not revive the encounter. Story also has a one-hour outage bound. Absolute reservations are three minutes for queue waiting, 24 hours for a series, and two hours per Story encounter. Rejoining does not renew the encounter bound. Expiry/terminal cleanup names its owning reservation and cannot release a newer lock. Story cancellation clears only the encounter, without progress/reward. Lazy cleanup needs an access; there is no background scheduler claim.

SQLite's unique token primary key and immediate transactions cover public queue, private room and Story reservations. Accepted queue reservations hand over atomically to unique series IDs. IDs now derive from the previous series ID, so trimming retained battle history cannot repeat result sources or reservation identities. A cross-process race test proves one of two competing reservations succeeds and stale cleanup fails. The deployment remains one supported Node process.

Generation policy uses a server UUID and trusted provider evidence, not a transfer counter. Finalized/latest snapshots, canonical checkpoint hashes and bounded token Transfer logs establish continuity. Long gaps or checkpoint invalidation revoke continuity without asserting a sale; stale/malformed/inconsistent/unavailable evidence fails closed. `ownerOf` alone cannot identify an unseen transfer-away-and-back. A transfer after the final read can race an off-chain commit. Transferring can avoid a loss; there is no automatic loss penalty, ranking, permanent public deterrent or anti-cheat guarantee. Full details: [SERIES.md](SERIES.md).

## Persistent competitor and privacy

My Chog retains manual exact-token-ID selection and current ownership authorization; it offers resume or official entry links for the single public starter queue, Story and eligible private play. Soryn classes/companions are chosen game loadouts, not claimed NFT traits. Public play stays four starters for guests and holders; guest history is preserved and cannot create official records. Explicit guest mode does not initialize identity/RPC calls. Official pages defer the Privy SDK to that mode. No hero actions were added.

`token_record` distinguishes battle, series, Story encounter, chapter and interruption. Writes bind source, rules and participating owner/generation and are idempotent. All rows start private, including legacy rows. Publication requires explicit alias + consent, fresh current ownership and the participating generation. A successor cannot publish someone else's private result. The original contributor can withdraw their own consent after transfer with a valid signed session and fresh evidence. Withdrawal does not erase recipient copies, backups or private gameplay. No general deletion/retention automation is claimed.

Public `/chog/[tokenId]` and `/api/chog/[tokenId]` validate token/collection/chain before RPC; duplicate identity parameters reject. Profiles show consented history with original aliases/date/rules, and an ISO-dated owner observation or owner-unavailable with no stale address. Public DTOs exclude encounter/source IDs, owner attribution fields, generations, account/session data, hidden moves and private opponent names. The separately dated current owner address is public chain data. Public lookup has an aggregate 30/minute application budget, with proxy limits prepared for hosting. This bounds small-playtest reads; it is not large-scale scraping protection.

Mobile profile overflow from long collection/owner/rules strings was fixed with smooth text wrapping. Combat keeps approved rendered assets. The turn clock now counts elapsed time between polls using a monotonic receipt clock; the server remains authoritative. Action errors survive successful background polls. One automatic retry is allowed only for a recognized 409 revision conflict that happens before dispatch; locked moves, old battle IDs, revocations and outages are not silently retried.

## Verification record

Final command results, browser outcomes and code-health status are appended below after their runs finish. Raw evidence is kept under `docs/evidence/soryn-readiness/`; temporary signing and ownership fixtures are labelled and never represent a real holder or transfer.

The earlier M7a full matrix remains historical evidence. In this continuation, the representative guest public 2–0 series and full grove clear completed on October 15, producing `public-2-0.json`/result screenshot and `story-grove.json`/ending screenshot. A new 2–1/foundry/loss/restart full browser matrix was not needlessly repeated; engine/integration regressions still run in the unit suite. Focused final holder/Story/outage/transfer browser checks use isolated temporary databases and the real application endpoints.

## Migration, deployment and human gates

Schema 3 is additive and transactional, with a migration marker, persistent reservations/records/Story rows and nullable queue token columns. Stored JSON additions have compatibility defaults; no guest rows or archived adventure records are deleted. A future unknown schema is refused. Failed migration rolls back. Consistent online backup is mode 0600, integrity checked and restored into a new directory; rollback uses the previous immutable image plus a pre-migration backup, not a down migration. Restoring a backup can lose newer writes. The temporary-database production harness checks migration, real process restart, active reservation/private checkpoint preservation and restored readiness/build identifiers with test timers unset.

[HOSTED_RELEASE.md](HOSTED_RELEASE.md) contains the prepared single-VPS/container/nginx path, exact origin/secret/public-config separation, proxy address limits, Secure cookie expectations, backup retention proposal and rollout/rollback commands. Docker's daemon was unavailable; the image/proxy/TLS setup has not been exercised. Host/provider/region, exact domain, budget, backup destination/operator and real HTTPS origin checks are still required. No resources, DNS or services were provisioned.

[HOLDER_PLAYTEST_DRAFT.md](HOLDER_PLAYTEST_DRAFT.md) is an unposted private outreach draft with a verified data inventory and human-operated checklist. No real holder operated Privy, signed, played, gave feedback or consented to recording in this continuation. The agent did not sign or transact. Native Privy SDK login/account-change and My Chog consent-form usability need that controlled human check; fixture headers exercise application authority, not provider login UX.

[SUBMISSION_DRAFT.md](SUBMISSION_DRAFT.md) contains truthful copy and a 2:50 outline. No submission or polished final recording was made. The official event page could not be reopened on October 15, so the previously recorded cutoff is not freshly verified. Founder must confirm the actual dashboard rules, team handles and links before submitting.

## Release decision

**NO-GO for a hosted holder playtest yet.** Local fixture verification is useful evidence, but does not replace the outstanding code-health review/gate, dependency risk decision, container/proxy/HTTPS checks, host/domain/budget authorization and human-operated Privy/holder check. No new substantive authorization bypass is knowingly left open in an exercised HTTP route; medium architecture/test-coverage findings remain honestly tracked. This is not a scaled or adversarial-use assurance.


## Final functional checks — October 16

| Command/check | Result |
| --- | --- |
| `npm test` (Node 24) | 396 passed, one default opt-in live case skipped; 71 files |
| `MONAD_LIVE_READ=1 npm test -- tests/integration/rpc.test.ts` | 9 passed, including the actual read-only Monad adapter probe; no signing/transactions |
| `npm run lint`, `npm run typecheck`, `npm run format:check` | Passed |
| `npm run build` | Passed; existing Ox/viem optional-export warnings remain in the build log |
| Focused production Playwright: `holder.spec.ts`, `ownership.spec.ts`, `competitor-story.spec.ts` | 6 passed in 2.0 minutes; Chrome, disposable SQLite, fixture ownership/provider signatures, 30-second test move clock |
| `node scripts/release/verify-local.mjs` | Passed native production migration, process restart and backup restore; shortened timers unset |
| `npm audit --omit=dev --json` | 23 moderate package findings, 0 high, 0 critical; no package change |

The six browser cases cover holder 2–0 series and three new private results → explicit API publication → profile, owner-unavailable/recovery, first-party outage/recovery, transfer with a hidden move and former-owner rejection/new-owner fresh room, official Story moves/refresh/consent/profile on portrait reduced motion, and guest startup without identity calls plus keyboard skip-to-profile navigation. Axe WCAG A/AA reports zero violations on the tested mobile public profile. They do not simulate a real Privy login or native My Chog publication-form interaction; those are human/provider gates, not inferred from fixture headers.

Earlier browser failures were retained in the working logs during diagnosis: race-conflict errors were cleared by polls, simultaneous Ready calls could safely reject one client action, long public identity strings overflowed portrait width, and new tests incorrectly assumed a shared fixture wallet had no preceding history. Code fixes preserve action errors, retry only one recognized pre-dispatch conflict and wrap profile text. Test fixes compare against existing fixture history instead of clearing it, and wait for saved selections. Final six-case run passes; no assertion or fixture was weakened to hide a product error.

Evidence: `official-story-ui.json`, `official-story-mobile-profile.png`, `holder-entry.json`, `holder-profile.png`, `ownership-outage.json`/PNG, `ownership-transfer.json`, `ownership-transfer-no-contest.png`, and `local-release.json`. Raw functional logs and current source/evidence hashes are captured beside this report's evidence manifest. The preview is at http://127.0.0.1:3001/start using `.cache/m7-local-preview.sqlite`, not the saved database. Preview public lookup uses the real default read-only RPC; the evidence screenshots are clearly synthetic ownership fixtures. The saved database's metadata remains October 14, 21:29:05 UTC, 425,984 bytes; no test opens it.

## Security/privacy limits retained

- Wallet SDK advisories remain installed. [Dependency assessment](WALLET_DEPENDENCY_ASSESSMENT.md) records the two underlying advisory families, actual distributed-runtime/source-map inspection and incompatible forced-upgrade constraints. No direct vulnerable decoder call was found in inspected connector runtimes, and mapped UUID calls use v4; that is bounded static reachability evidence, not blanket safety. No dependency override/downgrade was made. A controlled-host operator still needs to accept or remediate this documented risk.
- RPC and Privy are trusted external services. The provider snapshot/off-chain commit race and unseen-transfer log-continuity limit are intentional constraints. Reauthentication may be required after inactivity or conservative invalidation.
- Public records require consent. Transfer-interrupted entries cannot be newly published under a revoked participating generation. Private rows remain private. The public profile returns the latest 200 consented rows with all-time consented summary counts; the private keeper picker is bounded to its latest 100 records. No pagination or account-deletion service was added.
- Application-wide public-profile limiting can make all profiles temporarily unavailable during a scrape. Nginx per-address limits are prepared but untested on a host. Guest cookies can be replaced; no person-uniqueness or anti-Sybil guarantee is made.
- Only the HTTP checked service paths are exposed; raw deterministic/service helpers remain internal implementation/test seams. Architecture findings about these paired interfaces remain for cleanup; the actual route boundary was reviewed and exercised. This is not a formal security audit.
- No physical high-density-device or hosted two-network test ran in this continuation. Portrait/reduced-motion evidence is browser emulation, and real provider/wallet account lifecycle still needs human validation.


## Changed-file scope

The current Git diff includes extensive inherited user changes and earlier evidence. It is **not** a list of changes authored solely in this continuation. The implementation files touched here are listed below; the final source/evidence manifest captures exact file hashes without including environment files or private databases.

| Boundary | Files |
| --- | --- |
| Identity and transport | `src/domain/identity.ts`, `src/domain/competitor.ts`, `src/server/auth/ownership.ts`, `src/server/auth/persistence.ts`, `src/server/identityHttp.ts`, `src/server/httpShared.ts`, `src/server/errors.ts`, `src/components/request.ts` |
| Participation and persistence | `src/server/participation.ts`, `src/server/migrations.ts`, `src/server/persistence.ts`, `src/server/tokenActors.ts`, `src/server/pvp/locks.ts` |
| PvP rules/HTTP/client | `src/domain/pvp/actions.ts`, `src/domain/pvp/types.ts`, `src/domain/pvp/ownership.ts`, `src/domain/pvp/queue.ts`, `src/domain/pvp/updates.ts`, `src/server/pvp/http.ts`, `src/server/pvp/seatMode.ts`, `src/server/pvp/service.ts`, `src/server/pvp/persistence.ts`, `src/server/pvp/queue.ts`, `src/components/pvp/Challenge.tsx`, `src/components/pvp/usePvp.ts`, `src/components/pvp/useTurnClock.ts` |
| Queue and Story | `src/server/match/http.ts`, `src/components/match/MatchScreen.tsx`, `src/server/story/http.ts`, `src/server/story/service.ts`, `src/components/story/StoryScreen.tsx`, `src/components/combat/useCombat.ts` |
| Battle provenance/failure boundaries | `src/server/combat/http.ts`, `src/server/combat/persistence.ts`, `src/server/combat/reader.ts`, `src/server/combat/service.ts`, `src/server/nft/rpc.ts` |
| Official entry and consent UI | `src/components/auth/PlayIdentity.tsx`, `src/components/auth/PrivyIdentity.tsx`, `src/components/auth/PrivyWalletBridge.tsx`, `src/components/identity/TokenPicker.tsx`, `src/components/identity/OfficialExperience.tsx`, `src/components/identity/IdentityIntro.tsx`, `src/components/identity/useOfficialGame.ts` |
| Records, routes and layout | `src/server/records/tokenRecords.ts`, `src/server/records/profile.ts`, `src/server/records/http.ts`, `src/server/readiness.ts`, `src/app/api/competitor/route.ts`, `src/app/api/chog/[tokenId]/route.ts`, `src/app/health/route.ts`, `src/app/chog/[tokenId]/page.tsx`, `src/app/match/page.tsx`, `src/app/story/page.tsx`, `src/app/challenge/page.tsx`, `src/app/challenge/[token]/page.tsx`, `src/app/combat.css` |
| Local release preparation | `.dockerignore`, `ops/Dockerfile`, `ops/compose.yml`, `ops/nginx.conf.example`, `ops/soryn-proxy.conf`, `scripts/release/backup.mjs`, `scripts/release/verify-local.mjs` |
| New focused tests | `tests/integration/m7b-boundaries.test.ts`, `tests/integration/record-consent-http.test.ts`, `tests/integration/release-storage.test.ts`, `tests/integration/story-cancellation.test.ts`, `tests/integration/token-lock-concurrency.test.ts`, `tests/integration/token-lock-process-cli.ts`, `tests/unit/ownership.test.ts`, `tests/unit/request.test.ts`, `tests/unit/pvp-seat-mode.test.ts`, `tests/e2e/release-readiness/competitor-story.spec.ts` |
| Updated regression fixtures/tests | `tests/e2e/release-readiness/holder.spec.ts`, `tests/e2e/release-readiness/ownership.spec.ts`, `tests/e2e/release-readiness/support.ts`, `tests/integration/m7c-records.test.ts`, `tests/integration/rpc.test.ts`, `tests/integration/pvp-ownership-transfer.test.ts`, `tests/integration/pvp-holder-scope.test.ts`, `tests/integration/story-match-http.test.ts`, `tests/unit/series.test.ts`, `tests/unit/pvp.test.ts`, `tests/unit/pvp-ownership.test.ts`, `tests/unit/story-ownership.test.ts`, `tests/unit/story-records.test.ts`, `tests/unit/token-records.test.ts`, `tests/unit/rebrand-states.test.ts` |
| Plans and disclosure | `SORYN_PLAN.md`, `docs/CHOGATHON_PLAN.md`, `docs/SERIES.md`, `docs/IDENTITY.md`, `docs/SORYN_RELEASE_READINESS.md`, `docs/WALLET_DEPENDENCY_ASSESSMENT.md`, this report, `docs/HOSTED_RELEASE.md`, `docs/HOLDER_PLAYTEST_DRAFT.md`, `docs/SUBMISSION_DRAFT.md` and labelled evidence in `docs/evidence/soryn-readiness/` |

No rendered-art source/runtime assets, Blender work, combat balance definitions, archived adventure data, credentials, dependency versions, Git branches, commits, pushes or external systems were changed by this continuation.


## Desloppify: fresh review, blocked mechanical rescan

The installed [Desloppify skill](/Users/apple/.codex/skills/desloppify/SKILL.md) requires: **“Don't rescan mid-queue — finish the queue first.”** The user's explicit continuation likewise forbids queue resets or bypassing mid-cycle protection. No forced rescan, plan reset, exclusions, suppression, `wontfix`, manual score or target-anchored assessment was used.

The initial scan was refused by the inherited queue; status and next were read. Directly exposed fixes were resolved with concrete code/test evidence: explicit shared seat-mode resolution, client non-JSON error handling and moving QueueView into the domain. The October 15 single-dimension run correctly refused import for incomplete coverage. Its later full 19/20 run stopped at account usage quota and was not imported as a completed review.

A new first-class blind run on October 16 completed **20/20 batches**, using three runner subprocesses at a time and trusted import: `.desloppify/subagents/runs/20261016_062738`, immutable packet `holistic_packet_20261016_062738.json`. It added 21 review issues and removed stale predecessors. Follow-up scanning was refused because the queue was not empty. Review found a new retry-prose coupling issue; that was fixed using an explicit `revision-conflict` server/JSON/client error code, with wording-independent request coverage. The corresponding finding is resolved; **20 review items remain**. Final status and next were read. A new subjective reassessment of that last small error-code follow-up has not been imported.

The tool now displays strict **87.3**, using trusted new subjective assessments combined with **previous mechanical measurements**. The old strict 84.0/objective 91.7 are historical. The status timestamp advances on review import; it does not prove that a new mechanical scan succeeded. Therefore this report does **not** claim a freshly rescanned 85+ target, mechanical “no regressions,” or a completed repository-wide health campaign. Fresh test/build/lint evidence is separate from scanner evidence.

Remaining findings include service/persistence boundaries (Story succession queries, retained adventure storage), positional battle creation, duplicated matchmaking dispatch, getter expiry side effects, read/write quota consistency, retained error context/internal validation classification, typed client response validation, presentation text parsing and provider-lifecycle/cancellation test coverage. They remain tracked rather than being hidden or folded into an unrelated cleanup campaign. The next queued item is the named battle-start argument contract. These are available for the next coherent cleanup milestone; the controlled hosted holder release remains NO-GO until its chosen quality and human/provider gates are satisfied.


Final build's six-case browser gate also passed after the one-hour recovery-boundary fix. See [source/evidence manifest](evidence/soryn-readiness/m7-evidence-manifest.json), [tests](evidence/soryn-readiness/m7-tests.txt), [browser log](evidence/soryn-readiness/m7-browser-final.txt), [production build](evidence/soryn-readiness/m7-build.txt), [protected scan refusal](evidence/soryn-readiness/m7-scan-final.txt), [status](evidence/soryn-readiness/m7-desloppify-status-final.txt) and [next queued item](evidence/soryn-readiness/m7-desloppify-next-final.txt). The final cutoff/error-code fixes are tested follow-ups to the blind-review snapshot; they do not create a new mechanical scan or new subjective scores.
