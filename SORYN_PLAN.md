# Current holder-first policy — October 18, 2026

The approved policy is four-starter guest Practice; independent access through at least 500 $CHOG or a verified Chog NFT; one shared six-fighter public queue; the broader eligible NFT roster in private play; and separately authorized NFT-bound competitor records. See docs/SERIES.md and docs/MATCHMAKING.md for the current boundaries. Older four-starter-public/threshold-unapproved text below is historical. Production holder admission remains paused until an explicitly approved rollout; this document is not permission to enable it. No human-operated holder or physical mobile test is established by synthetic fixtures.

# Current continuation — October 16, 2026

**Health queue recovery — October 16, 2026:** all twenty outstanding concrete blind-review findings are fixed, tested and resolved. Normal mechanical scanning now completes: objective 92.3, displayed strict 87.4. Fresh subjective scores remain pending because the blind runner hit its usage limit. See [the queue recovery report](docs/HEALTH_QUEUE_RECOVERY.md) for changes, checks, evidence and the remaining review gate. This does not authorize hosting or real-wallet actions.

The sections below the divider preserve the earlier milestone record. Their counts, scores and “current build” claims describe that earlier evidence, not a fresh measurement of this continuation.

M7b/M7c implementation and release-preparation details are in [docs/M7_RELEASE_REPORT.md](docs/M7_RELEASE_REPORT.md). This continuation preserves the approved rendered presentation, combat balance, one starter queue, saved guest battles and the separate archived adventure.

- M7b: confirmed change/generation invalidation ends official participation without awarding the interrupted battle; outages pause and expire without an opponent win. Fresh checks cover official actions, polls/finalization and publication. SQLite token reservations span queue/private/Story participation. Keeper-private Story progress does not pass to a successor. Completed results retain frozen participants. Rematch identities remain unique after the retained-history cap.
- M7c: My Chog selects a verified token; official links open the shared public starter queue, Story or eligible private play. Results are private first, with explicit per-result alias/consent publication. `/chog/[tokenId]` validates the allowlisted identity and shows dated owner evidence or unavailable, with historical attribution. No NFT metadata or on-chain write occurs.
- Local release: additive schema 3, minimal `/health`, verified online backup and temporary-database production restart/restore harness. Container/nginx templates are prepared; Docker daemon and actual hosted TLS/proxy checks remain pending. See [docs/HOSTED_RELEASE.md](docs/HOSTED_RELEASE.md).
- M9 preparation: [private outreach/data inventory/checklist](docs/HOLDER_PLAYTEST_DRAFT.md), unposted. [Submission draft and 2:50 outline](docs/SUBMISSION_DRAFT.md), not submitted. Host, exact domain, budget, holder participation and any posting/commit/push/deployment need separate authorization.
- Latest unit/integration run: 396 passed, one opt-in live RPC case skipped; that case and eight companion adapter cases also passed in a separate read-only live run. Lint, typecheck, formatting and production build pass. Six focused browser gates pass. Desloppify imported all 20 fresh blind-review batches; its displayed strict 87.3 still includes old mechanical measurements, and a protected rescan remains blocked by 20 queued findings. The report distinguishes source/evidence dates.

No real-holder login, physical-device test, token transaction, deployment, outreach, commit or push occurred. The saved development database was not opened by these tests or the isolated preview.

---

# Soryn plan

Updated October 15, 2026. The product name is Soryn. The folder and the Git remote stay as they are. Nothing in this file was committed or deployed.

## Decisions

- Public play and friend play use series policy `series/1`. A round is one pair of choices. A battle is one fight. A series is first to two battle wins. Rules: [docs/SERIES.md](docs/SERIES.md).
- Rooms saved with no series still end after one battle.
- The public queue is one unranked starter queue in SQLite, polled over HTTP. Rules and clocks: [docs/MATCHMAKING.md](docs/MATCHMAKING.md). No Redis, WebSockets, or second database.
- The app remains one Node process. Two processes would pair separate queues.
- Story progress is `story/fractured-sanctuary/1` in `story_progress`. It does not read adventure runs.
- Guest identity for the queue and the story is the `chog_guest` cookie. Clearing it creates another guest. That is not anti-Sybil protection.
- Chog Genesis stays chain 143, collection `0xc96d31f8626c6d03fae5dcd3d61e3fb9f4a73763`.
- The CHOG token address published at https://chog.xyz/ is `0x350035555E10d9AfAF1566AaebfCeD5BA6C27777` on chain 143. MonadScan and DexPaprika list 18 decimals for that contract. The balance threshold is unset. No live balance check runs.
- Achievement claims are not on the player path. `SANCTUARY_ACHIEVEMENT.contract` is null. No contract was deployed and no wallet transaction was sent.
- The SIWE statement still says “Sign in to Chog Deja Vu”. Cookies `chog_guest` and `chog_wallet` are unchanged.
- Combat math, damage, and the initiative tie were not changed.

## Completed

1. **Rename and focus.** The wordmark is Soryn in the existing gold, on the existing emblem. Navigation, titles, the landing actions, and Open Graph copy use Soryn. Find a Match, Challenge a Friend, Story, and Practice are the primary actions. The adventure, journal, and museum stay on their old URLs with an archive notice. Their records are not story progress.
2. **Security gaps that were still open.** Official battle reads and the private My Chog session call `authorize()`, so a transferred token fails closed. An omitted PvP `mode` does not turn an official seat into a guest seat: a seated player keeps the stored mode, and a wallet cookie without an explicit guest mode is official. `npm audit --omit=dev` is 23 moderate, 0 high, 0 critical, through the Privy and wallet stack. `src/` does not import `uuid` or `decode-uri-component`. The suggested Privy change is still a downgrade. No package was changed. The single-process limit stays.
3. **Best of three.** Friend rooms created now carry a series. Health and energy reset each battle. The score does not. A forfeit or surrender ends the series. Two draws in a row end it as a draw. Completion is idempotent. The next battle id is derived. A process exit during intermission keeps the score and the deadline. Unit tests cover 2–0, 2–1, draw replay, forfeit, no contest, duplicate completion, reopen, and a mutual rematch into a new series. A browser test played a series to a mutual rematch.
4. **Public matchmaking.** Two guest sessions can be paired without an invitation. Accept, decline, timeout, cancellation, and a third decline pause are covered in unit tests. The browser test pairs two contexts, accepts, and lands both in a starter room. An empty queue says nobody is waiting and offers Practice and Story. No bot is substituted.
5. **The Fractured Sanctuary.** One guest chapter: choose a starter, scout, grove or foundry, guardian, boss, ending. The routes use different opponents, arenas, and objectives. Loss stays on the same encounter. Refresh reloads the row. Completion is stored once. Replay keeps that completion id and starts again at the meeting. Unit tests play both branches through the combat engine. The browser test opens the chapter, starts the scout, and resumes it after reload.
6. **Release-readiness browser suite and recordings.** `tests/e2e/release-readiness/` passes 15 cases: navigation (6), a public 2–0 series from the first queue click to the result, a public 2–1 series, one server recovering a locked battle across real process restarts, a full grove clear, a full foundry clear, a recorded scout loss, a recorded mid-route grove-guardian loss, and two ownership cases (verification outage fails official play closed then recovers; a confirmed fixture transfer voids the live series and locks the old owner out), each loss retrying the same encounter with a new battle. M7a is done on this evidence: both required cases pass against the current build. Recordings live in `docs/evidence/soryn-readiness/`: public 2–0 (80.1s), public 2–1 (125.5s), grove (133.2s), foundry (135.1s), plus screenshots, JSON, and the restart log. The queue `isLate` rule, the single invite parse, the shared origin/JSON guard in the legacy POST, the commit-on-poll docs, and the retained-window docs plus test shipped with it. Decision record: [docs/SORYN_RELEASE_READINESS.md](docs/SORYN_RELEASE_READINESS.md).
7. **Ownership changes end official play as no contest (M7b).** A confirmed transfer or reorg generation change ends an open official series as a no contest with no win awarded and the interrupted battle discarded; completed battles keep their record and attribution. Outages fail closed with an explicit verification-unavailable response, and a series left unverifiable past its bound is terminated rather than held open. One SQLite token lock per chain/collection/tokenId serialises public, private, and story play and survives restarts; a former owner keeps only their session history and every official write is refused. Policy: [docs/SERIES.md](docs/SERIES.md). Gates: 30 + 8 unit tests, 12 integration cases, and the 2 labelled browser cases with evidence `ownership-outage.json`, `ownership-transfer.json`, and `ownership-transfer-no-contest.png`.

## Not shipped

- **CHOG supporter benefits.** The threshold is not approved. `supporterStanding` returns `unconfigured` until a threshold exists. There is no badge, cosmetic, or community gate in the UI.
- **Monad achievement claims.** Local authorisation tests cover the wrong session, the wrong chain, a repeated claim id, and a missing contract. The UI does not offer a claim. Blocker: no approved deploy, no contract address, and no signing key. Server results would still be issuer-trusted after a contract exists. On-chain recording would not make them trustless.
- **Twelve-fighter public queue.** Deferred until a balance pass. Holders still use those fighters in Practice and private rooms.
- **Hosted two-device play.** Not run. The readiness verdict and conditions are in [docs/SORYN_RELEASE_READINESS.md](docs/SORYN_RELEASE_READINESS.md).

## Verification

- `npx tsc --noEmit` passed.
- `npm run lint` (ESLint) passed. `next lint` is gone in Next 16. Desloppify still reports that detector as unavailable. This repo did not add a fake `next lint`.
- `npm run format:check` passed.
- `npx vitest run`: 352 passed, 1 skipped (61 files).
- `npx next build --webpack` passed. `/match` and `/story` are in the route list.
- `env -u PLAYWRIGHT_BROWSERS_PATH npm run test:e2e -- tests/e2e/release-readiness`: 15 passed (13.0m), including the two new ownership cases — the outage case fails official play closed with a 503 verification-unavailable response and recovers, and the transfer case voids a live series as a no contest mid-round without leaking the locked move. Evidence and recordings refreshed in `docs/evidence/soryn-readiness/`.
- Desloppify after the fixes: strict 84.0 (plan start 82.2), objective 91.7, subjective 82.8, target 85. Five dimensions re-reviewed with fresh evidence after fixes (Auth consistency 86, Contracts 86, Convention drift 86, Logic clarity 85, Low elegance 85); the tool's exact-85 gaming warning on the authorization score was answered with a forced careful rerun. Five review items were resolved with code or doc evidence; 14 remain open and are listed in the readiness doc. No exclusions were added. `data/local/chog.sqlite` was not opened (mtime October 14, 22:29).

## Version control

This directory is a Git checkout, not an empty folder. Remote: `https://github.com/Ololadestephen/Soryn.git`, branch `main`, HEAD `fb398e8`. This work is uncommitted. It was not pushed.

## Hosted two-device checklist

1. One public origin, one Node process, `CHOG_PVP_TIMERS` unset, and a copy of the database that is not `data/local/chog.sqlite`.
2. Two phones or browsers. Leave the queue empty and confirm the waiting message. Then both tap Find a Match, accept, pick starters, and play until 2–0 or 2–1.
3. Decline once and confirm the other person is still waiting. Let an offer expire.
4. Refresh during a battle, during the intermission, and after the series result. Restart the process once during a battle and once during the intermission. Confirm the deadline does not move.
5. Open Story on one device, win or lose the scout, refresh, and confirm the same step.
6. Do not turn on achievement claims. Do not set a CHOG balance threshold in that environment.
