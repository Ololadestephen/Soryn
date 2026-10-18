# Series policy `series/1`

A series is first to two battle wins. A round is one pair of combat choices. A battle is one fight that ends in a knockout, a draw, or a forfeit. Rooms saved before this policy have `series: null` and still finish after one battle.

## Rules

- Fighter and companion stay locked from the first ready until the series is complete.
- Health, energy, cooldowns and temporary effects reset at the start of each battle. The score and the two seats do not.
- Intermission is 10 seconds (`intermissionMs`) for rooms created with the current clock. Both players can continue sooner. If the deadline passes, the next battle starts on the stored clock. A refresh does not move that deadline. A room already saved with 20 seconds keeps that stored deadline.
- The next battle id is derived from the series id and the battle number, so a repeated completion cannot open two next battles or add a win twice.
- A 2–0 series stops. A 1–1 series plays a deciding battle. A 2–1 series stops. No battle starts after a player has two wins.
- A drawn battle gives no win and is replayed. Two drawn battles in a row end the series as a draw. There is no health tie-break.
- One missed turn still uses Guard when Guard is legal. Two consecutive misses forfeit that battle and the series. Both players missing ends the battle and the series as a no contest.
- Surrender ends the series as a forfeit.
- A rematch is available only after the series is complete. Both players must accept. That creates a new series, so fighters can change.

The same rules are shown under Match help in a private room.

## Ownership during official play — M7b policy

Confirmed transfer or invalidated authorization generation ends an active series as **no contest**, with no series winner and no new win for the interrupted battle. Already completed battles retain their frozen participants, rules and attribution. Before a battle opens, the lobby closes without a competitive result. A completed series stays final; a renewed generation opens a fresh room instead of reviving its old seat. Transfer can avoid an impending loss. There is no automatic loss penalty, ranking or anti-cheat guarantee.

### Fresh evidence and generations

The server uses Monad chain 143, the allowlisted Genesis bytecode and ERC-165/ERC-721 responses, fresh finalized/latest blocks (at most 30 seconds old), canonical checkpoint hashes and token-specific Transfer logs. Each network request is bounded at five seconds; an observation is bounded at 12 seconds and accepted evidence at five seconds. Concurrent reads of the same token share only the in-flight observation; completed reads are never reused as authorization caches.

A generation is a random UUID, **not** an on-chain transfer count. Owner changes, observed Transfer logs (including self/away-back transfers), a changed canonical checkpoint, backward finalized height or a continuity gap beyond 4,500 blocks invalidate the prior generation and revoke its grants. A long gap is conservative authorization invalidation, not evidence of a sale. `generation-invalidated` distinguishes the same-owner case from `ownership-changed`. An unsettled transfer revokes the old grant but denies fresh writes until finality. Malformed, stale or inconsistent responses and failed log queries return verification-unavailable; they do not establish transfer. A snapshot changing during its own read is inconclusive.

`ownerOf` alone cannot detect an unseen transfer away and back. Continuity depends on complete provider logs within the bounded window. Beyond that window, reauthentication in a new generation is required. Provider correctness is trusted. A transfer after the last read can race an off-chain commit; this is not blockchain consensus over a game result.

Every official action, ready gate, timeout/clock poll, intermission, surrender/finalization and publication requires fresh evidence. All stamped PvP seats are checked together before advancement. Legacy official encounters missing verifiable grants fail closed; standalone guest rooms remain playable. Late move/assets/continue requests with a supplied earlier match ID reject; old clients without this optional field retain legacy compatibility and the current round/phase validation.

### Outage and deadline bounds

The first observed verification failure stores a stall timestamp and returns HTTP 503. Hidden moves remain hidden. No opponent win is awarded for an RPC failure. Recovery before one hour adds the actual observed pause interval to the current battle and intermission deadlines **once**, then clears the marker. If unavailability lasts at least one hour, the encounter terminates as `abandoned`, winner null, stored reason `verification-unavailable`. This differs from confirmed-change no contest. Deadlines before the first observed failure cannot be reconstructed; polling is required to observe and persist stalls.

Official Story uses the same one-hour outage bound and a two-hour absolute encounter reservation. Cancellation or interruption clears the open encounter without completion or reward. Previously earned checkpoints remain private to their original keeper. A successor starts a new private run; **only explicitly published accomplishments** follow the token. Returning keepers can retain their own checkpoint but cannot revive the interrupted battle or old generation.

### Persistent participation reservations

`token_locks.token` is a SQLite primary key over `chain:collection:tokenId`. Reservation and encounter mutations share `BEGIN IMMEDIATE` transactions. Queue entry reserves before pairing; offer acceptance hands that lock atomically to the new series ID. Private room creation/join reserves that seat's token. Each new/rematched series has a unique reservation ID. Story reserves when an encounter begins, not while waiting between encounters.

Queue entries expire after three minutes from joining; offers have their own acceptance deadline. Public/private series reservations have a 24-hour absolute bound from creation; Story encounters have two hours from opening. Rejoin/ensure does not extend the encounter's expiry. Expiry makes the old encounter unplayable even if another encounter has since acquired the token. Expired rows are removed lazily on access; no resident background scheduler is required. Cleanup always names the owning encounter, so an old callback cannot delete a newer reservation.

Completion (including poll-triggered completion), surrender, room close/leave, no contest, cancellation and bounded expiry release the matching reservation. A new verified owner reconciles the previous generation's open encounter before acquiring a fresh one. Two current-owner sessions may resume the same seat, with per-round move locks and revision checks; they cannot create two reservations for the token. Locks and frozen participants survive restart. No lock is a substitute for fresh ownership evidence.

### Results and consent

Official result rows are private initially and idempotent on `(token, kind, source)`. They bind the participating generation and rules version. Public profiles show only explicitly consented rows, with the participating keeper's alias and historical date, never source encounter IDs, generations, private account IDs or hidden moves. Legacy private rows are not retroactively publishable. Original contributors may withdraw their own publication after transfer using a valid signed session and fresh read, without granting them current-token play rights. Published copies cannot be recalled from readers or old backups.

An interruption is retained privately. It is publicly visible only if its participating keeper publishes it under the same consent policy. This does **not** guarantee a public deterrent against transferring to avoid a loss.

Current implementation evidence and limitations: [M7 release report](M7_RELEASE_REPORT.md).
