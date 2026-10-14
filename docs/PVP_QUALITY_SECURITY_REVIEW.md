# Private PvP quality and security review

Reviewed October 14, 2026, against the tree in `/Users/apple/Desktop/chogsnft`. This is a remediation record, not a certification. Tests passing and the scanner score rising do not make the game secure, and no physical device or public host was used.

## Verdict

**GO for a controlled hosted two-device test, only with the deployment checklist below. NO-GO for public play, a second server process, or any claim that ownership, anti-cheat, or hosting have been proven.**

The local friend match, hidden moves, refresh, forfeit, no-contest, rematch, and unauthorized-seat checks passed. A separate Node process, not a reopened connection, kept a hidden lock and resolved it once. Those results still leave the hosted clock, TLS proxy, and real wallets unobserved.

## Reported state, checked

| Claim | What the tree showed |
| --- | --- |
| HTTP polling, one Node process, SQLite | Matches `src/server/pvp` and `docs/PRIVATE_PVP.md`. Deadlines are absolute timestamps applied on the next request. |
| Production turn is 30 seconds | `PVP_TIMERS.moveMs` is 30000. One miss uses Guard when legal. Two consecutive misses forfeit. Both missing together is a no contest. |
| 244 tests | The suite is now **258 passed, 1 skipped**. The extra cases cover the defects below. |
| Desloppify objective 91.8, strict 21.8, 206 open, test health 52.7, 20 dimensions unassessed | The final mechanical scan is objective **91.8**, strict **21.8** before the review import, **208** open, test health **52.5** (strict 30.9). The 20 dimensions are now assessed. See the score split below. |
| `next lint` unavailable | Confirmed. The detector runs `npx --no-install next lint`. Next.js 16 has no `next lint`. The repository lint is `eslint` via `npm run lint`, and that command passed. |
| Hosted and physical-device play unverified | Still unverified. |

`data/local/chog.sqlite` was not opened by these checks. Its timestamp is 22:29 local, before this review's commands. Tests used temporary files and `test-results/e2e.sqlite`. There is no `.git` directory, so history could not be scanned. `.gitignore` already excludes `.env`, `.env.*`, `data/local/`, `*.sqlite`, and `.desloppify/`. No private-key header was found under `src/` or `docs/`.

## Deadline rule

A request is late when server time is **greater than or equal to** `deadlineAt`. Catch-up runs before the submitted move is considered. A move at the exact deadline does not replace the timeout. A move one millisecond earlier still counts. Disconnects do not move `deadlineAt`. The client countdown is `deadlineAt - serverNow`, so a wrong device clock does not add time.

If several deadlines have passed, one request applies at most 48 steps and then abandons the match. It does not reset the deadline or loop without a bound. Repeated polls of an already resolved round do not create another result.

## Findings

### High — a rejected action could erase a committed timeout

`advanceRoom` and the later action shared one transaction. A late move that then threw, including "the match is over", rolled the forfeit or Guard round back.

**Fix.** `PvpService.settle()` commits catch-up in its own transaction. The action runs in a second transaction. A rejected move, join, or leave cannot undo that catch-up.

**Check.** Unit tests lock a move, reach the exact deadline, reject the late move, and still see the Guard round and a later both-miss abandon.

### High — an invitation could operate a seat it did not occupy

`returnToSetup` did not require a seated actor. Anyone with the invite could clear ready flags or archive a finished match.

**Fix.** `returnToSetup` calls `mustSeat`. An active match still rejects setup. Join, move, select, ready, close, rematch, and leave already required a seat.

**Check.** An unseated setup throws. The HTTP test posts setup as a stranger and gets 403; the host still has Pip selected.

### High — shortened test timers could become the hosted policy

`CHOG_PVP_TIMERS=test` used to shorten clocks from the environment alone.

**Fix.** The flag applies only when `APP_ORIGIN` is `http://127.0.0.1` or `http://localhost`. A public origin keeps 30 seconds. A stray `CHOG_PVP_MOVE_MS` without the flag stays 30000. The server warns once when a non-test process is actually on the short clocks. Playwright still works because its origin is loopback.

### High — a holder match could open on a stale other seat

The ready that opens a match rechecked the acting wallet only. The other official seat could have transferred the NFT after readying.

**Fix.** Official select and ready store the ownership grant on the seat. `confirmReady` asks the chain for every official holder seat before that match opens. An RPC failure or pending transfer is returned as 503 and does not start the match or clear the fighter. A changed or missing owner clears that seat's holder choice and ready flag, and the match stays closed. `ready()` without that confirmation refuses to open a holder match. An already started match still keeps its frozen snapshot. Guest starters never take this path.

**Check.** Isolated SQLite tests: the default checker does not open the match and clears the ineligible seat; a checker that passes opens one loading match; calling `ready()` directly throws. No real wallet was used. Holder evidence in this review is fixtures and injected checkers. Do not read it as mainnet ownership.

**Remaining.** There is a short gap between the chain read and the transaction that opens the match. A transfer in that gap can still be one request late. Official **reads** still authenticate the session and do not call `authorize()`, so a transferred owner can poll until the next write.

### High — a cookieless poll did not rate-limit

Each GET without `chog_guest` minted a new id and a new counter, so the per-actor limit never fired and each request wrote a rate-limit row.

**Fix.** Those requests share one process key, `read:anonymous-guest`, at 120 new sessions a minute. A browser that already has the cookie keeps its own 90 reads a minute. Writes stay at 60 a minute. New rooms stay at 60 a minute for the whole process. This does not replace an address limit on the proxy. A client that rotates cookies after the first response still has a per-cookie budget.

### Medium — private previews could surface as a storage failure

`previewRoom` threw `Error("Private.")`, and `failure()` maps an unknown error to HTTP 503. `presentRoom` did the same for a missing seat.

**Fix.** A started battle preview is `PvpError` 403, "This battle is private." A missing actor is 403. A seat id with no seat object is 409. The presenter change is in the final typecheck, the 258 tests, and the final production build. The browser run was taken on the build just before that two-line mapping.

### Medium — responses before resolution

`presentRoom` returns the caller's own locked move and `opponent.locked`. It does not return the opponent's move. History rows have a headline, explanation, round count, names, and arena. They do not include moves. Error text for a duplicate or conflicting lock does not include the other move. After resolution, both seats receive the same stored round; seat B sees it through `mirrorBattle`.

**Check.** The process-restart test peeks from a second process: the friend sees `locked: true`, no opponent `move` field, and no "special" in rounds. The host still sees their own special. At the production deadline the same database resolves one round, seat A Guard and seat B special, from the seat-B point of view.

The locked flag is intentional. It is not the move.

### Medium — polling can move state backwards if applied raw

`nextRoomState` drops a response that started earlier, has a lower revision, or has the same revision with an older `serverNow`. An unseated poll does not replace a seated view. A leave action may. The client stamps each request.

### Low — storage bounds

Expired empty lobbies are deleted on the next room create, 40 oldest rows at a time. Completed matches are not part of that delete. A room keeps the newest 40 completed matches; the 41st drops the oldest from that room's JSON, not from the practice `battles` table. Finished rooms are not deleted.

### Not changed, on purpose

Combat stats, damage, and the initiative tie were not edited. On a tie, `(round + tie) % 2 === 0` gives the first action to seat A (the engine's player side). Otherwise seat B goes first. The tie bit is chosen once per match, so it is sticky for that match and even across matches. Nyx's round-1 speed and Pip's 84 HP versus Bolt's 80 HP are fighter rules, not seat bugs. This is an observation, not a balance pass.

Adventure URLs stay. Guest mode still cannot write official NFT history. No matchmaking, rewards, or token benefits were added.

## Atomicity

| Case | Result |
| --- | --- |
| Both players submit | One `commitRound` when the second lock arrives. Revision increases once. |
| Same move submitted again | Accepted as the existing lock. No second round. |
| A different move after lock | 409, "Move already locked." The first lock remains. |
| Move at `deadlineAt` | Late. Timeout already committed. The move is rejected. |
| Move after the round resolved | 409. The stored round remains one row. |
| Poll and move at the deadline | Settle commits first. The move cannot roll it back. |
| Forfeit racing a move | The forfeit commits in the first transaction. |
| Both accept a rematch | The archive and the new setup happen once, when the second flag is set. The new match id is created later, when both are ready again. |
| Two tabs, one seat | The second tab is the same actor. It cannot replace a locked move with a different one. |

## Process restart

`tests/integration/pvp-process.test.ts` starts a **new** Node process with `spawnSync`, lets it exit, and starts another process on the same temporary SQLite file. Reopening `DatabaseSync` in-process is a different, weaker test and is not this proof.

1. Process A creates a match on production timers, locks seat A's special, and exits. Process B peeks: the lock is hidden from seat B, visible to seat A, and the deadline is unchanged. Process B peeks at the deadline: one round, Guard for the late seat and special for the seat that locked.
2. Process A commits the round and exits. Process B reads exactly one round. It did not perform the commit.

Both tests passed inside the 258. A restart after commit but before the HTTP response is the second case: the commit is durable, and the next process reads it. The browser cannot see a response the dead process never sent; refresh loads the stored round.

## Timers and clients

Controlled clocks cover just before, exactly at, and after the deadline; one miss; both missing; two consecutive misses; a return after one miss; and repeated requests on an expired round. The browser suite, on the loopback test clocks, covers refresh after lock, a second tab, one idle forfeit, two idle abandons, and a rematch. Asset readiness never arriving stays in `loading` until the loading deadline, then the turn opens. One client finishing its animation later does not rewind the other: stale polls are dropped, and the stored round is what both sides eventually show.

`CHOG_PVP_TIMERS=test` cannot silently become the hosted policy unless the public origin is also loopback.

## Authentication and privacy

Guest cookie: `chog_guest`, HTTP-only, SameSite strict, seven days, refreshed on guest responses. `Secure` is set when the request is HTTPS or when `APP_ORIGIN` starts with `https://`, so a TLS proxy that forwards HTTP still gets a Secure cookie. Writes require `Origin` equal to `APP_ORIGIN` and JSON, with a 4 KB body cap. Invite tokens are 24 random bytes, base64url. SQL uses bound parameters. Player names are rendered as text. Unknown failures log an error name, not the body. Response headers include `Referrer-Policy: same-origin`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Cache-Control: no-store`. HSTS is left to the HTTPS proxy. This tree does not set it, because local HTTP must still work.

An invitation does not grant an occupied seat or another player's practice history. Battle history for a seat is taken from rooms where that actor is seated. Retired adventure records stay behind their existing guest and official checks.

Omitted `mode` still defaults to guest. A wallet client that forgets the field sits as a guest instead of failing. The current UI does not send `mode`.

## Ownership

Official writes call `authorize()`, which fails closed on RPC errors, stale evidence, and pending transfers. Guest select of a holder fighter is 403. Rematch setup clears a holder choice the seat's mode is no longer allowed to keep. The new match start rechecks both official holder grants, as above.

The synthetic holder browser test rejects a forged guest start of Aegis (403), an official step that tries to send damage (400), an RPC outage (503), and a revoked generation. That test uses the local fixture server on `127.0.0.1:3200`. **No real wallet was connected.**

## Dependencies and the scanner

`npm audit --omit=dev`: 23 moderate, 0 high, 0 critical. They enter through `@privy-io/react-auth` and the wallet-connect stack (`uuid` bounds check when a buffer is supplied, `decode-uri-component` decoding cost, and the packages that depend on them). `src/` does not import `uuid` or `decode-uri-component`. Guest ids use `node:crypto`. The audit's suggested Privy change is a downgrade from the installed 3.x line. No version was changed.

`next lint` fails because Next.js 16 removed that command. The detector command is fixed inside Desloppify. This repo did not add a fake `next lint` script and did not suppress the detector. `npm run lint` (ESLint) passed.

Test health near 52 is mostly the import graph. Playwright flows do not count as imports of `src/app` routes, so those files look untested. The tactical engine's "transitive only" finding is older than private PvP and has reopened many times. Those were not marked wontfix. `tests/unit/pvp.test.ts` is large because it holds the behavior cases; it was not split to move a structural finding.

The subjective review was imported with `--manual-override`. The reviewer had already seen the target of 85 and the scan, so the scores are **provisional** and the next `desloppify scan` will expire them. They are not a blind review.

### Scores, split

| | Before this review's code | After the mechanical scan | After the provisional review |
| --- | --- | --- | --- |
| Objective | 91.8 | 91.8 | 91.8 |
| Strict | 21.8 | 21.8 | 82.2 |
| Overall | about 23, with subjective at 0 | 22.9 | 83.3 |
| Subjective pool | 0 | 0 | 80.5 |
| Test health | 52.7 | 52.5 (strict 30.9) | unchanged by the import |

The jump from strict 21.8 to 82.2 is the assessment, not a code cleanup. Objective did not improve. Open mechanical findings went from 206 to 208 because new files and branches are visible to the scanner. Strict 82.2 is still under the target of 85. Nineteen review notes stay open on purpose: deadline-function density, the `preview` name, optional `mode`, official reads, the Privy advisories, the single-process deploy, and the adventure URLs. Fixing those by exclusion or by inflating a score would be false.

The seat-error note is already fixed in code. The scanner still lists it because items resolve in queue order, and a rescan would drop the provisional scores.

## Verification

- Prettier on the edited PvP files.
- `npm run lint` (ESLint) passed. The final `view.ts` edit was linted again.
- `tsc --noEmit` passed.
- `npx vitest run`: 47 files, **258 passed, 1 skipped**.
- `npx next build --webpack` succeeded. The known Privy/viem warnings remain. They are not from this change.
- Playwright, with `PLAYWRIGHT_BROWSERS_PATH` unset, against the production server on port 3100 and `test-results/e2e.sqlite`:
  - Practice: visible resolve and rematch, lost-reply retry, leave during an action, narrow keyboard layout. Then the synthetic holder case, after the test waited for the guest cookie. An earlier combined run saw 401 because the forged post raced that cookie. The assertion is still 403.
  - Private PvP, two browser contexts, re-run after the holder-recheck change: one full match and mutual rematch, refresh with one locked move and a second tab, one idle forfeit and two idle abandons, leave and fighter change. **4 passed.**

Not run: a physical phone, a public HTTPS host, a real wallet, or a second browser pass after the final presenter-only build. That build is the one `next build` produced last; the Playwright server had been started from the previous build. The presenter change does not alter a normal seated match.

## Deployment checklist

Do not attach traffic until all of these are true:

1. One long-lived Node process. Not serverless. Not two instances on one SQLite file.
2. The SQLite file is on a durable disk that survives restarts.
3. HTTPS on the public origin. The proxy sets HSTS. `APP_ORIGIN` is that exact origin, so the guest cookie is `Secure`.
4. `CHOG_PVP_TIMERS` is unset. Confirm a created room stores a 30 second move clock.
5. The proxy rate-limits by client address. The process limits are a backstop.
6. Two physical devices, or two browsers that are not the local Playwright contexts, open the same invitation.
7. Guest cookies work on that host. The server clock is the only deadline.

The concrete next step is that hosted two-device test. It is not a deploy of a public matchmaking service, and it is not authorized by this review.
