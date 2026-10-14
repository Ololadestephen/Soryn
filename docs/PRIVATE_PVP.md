# Private friend battles

Status: local two-browser implementation. This is not an internet or physical-device test. Déjà Vu remains the product name. The midnight and gold identity and the current fighter artwork stay in place.

## Architecture

Private battles use the existing Next.js Node process and the existing SQLite file. The browser polls `GET /api/pvp` about every two seconds while a room is open, and about every four seconds on the home and history screens. There is no WebSocket, Durable Object, Redis, or second server.

That transport fits this application. The playable server is one long-lived `next start` process with a durable SQLite file. A turn lasts many seconds, so a poll is enough to show the same state on both screens. The authoritative clock is an absolute timestamp stored in the room. The next request applies every deadline that has already passed. Nothing important waits on `setTimeout` or on one browser staying connected.

Server authority stays in `src/domain/pvp` and `src/server/pvp`. The browser renders the view it is given. It does not resolve combat.

Practice battles stay in the existing `battles` table and still replay through the computer policy. Friend battles are not written there. They use two new tables, created only if missing:

- `pvp_rooms`: room id, unique invitation, and the full room record
- `pvp_members`: which actor may see which room

No adventure table is dropped and no saved row is deleted.

## Room and match states

A room starts in the lobby. An invitation is 24 random bytes, encoded so it can sit in a URL. The invitation finds the room. It does not own a seat.

Lobby:

- `waiting`: one seat is filled
- `joined`: both seats are filled and at least one fighter is still being chosen
- `ready`: one player is ready and the other is not

The invitation expires 30 minutes after creation only when no match has started and no match has been archived. Closing the invitation is explicit. After a match exists, that lobby timer no longer ends the room, so a finished battle can still be rematched. Finished rooms are kept. They are not deleted automatically.

A match inside the room moves through:

- `loading`: fighters, arena, rules, and eligibility are frozen; the first turn has not started
- `choose`: both players may lock a move before `deadlineAt`
- `present`: the round is already resolved and both clients have a bounded window to show it
- `complete`: knockout, round limit, forfeit, or no contest

`revision` increases when membership, setup, locks, or results change. A poll that only refreshes presence does not increase it. `eventSeq` is the number of stored combat events and must match the events in the stored rounds. Clients ignore a seated view whose revision is older than the one they already applied. Each response is the full current view, not a delta.

## Seats and authentication

There are two seats. Seat A is the combat engine's `player`. Seat B is the engine's `opponent`. One actor can hold only one seat. An occupied seat is never given to someone else.

Guest seats use the existing `chog_guest` cookie. Opening Challenge a friend creates that cookie if it is missing. Guest starter matches do not ask for a wallet. Holder fighters stay locked for a guest, in the roster and on the server.

Official seats use the existing Privy and SIWE wallet session. An official write rechecks that player's current ownership and stores the grant on the seat. The ready that would open a match rechecks every official holder seat. An RPC failure or a pending transfer does not start the match and does not clear the fighter. A changed or missing owner clears that seat's holder choice and ready flag. An already started match keeps its frozen snapshot. The primary screens are guest matches. The official path is available to the same room API for a later My Chog entry; this milestone does not add a second battle screen for it.

A room code or URL lets a new actor request an empty seat. Repeating the request for an actor who already sits there changes nothing. A full, expired, closed, or already started room rejects the join. Leaving is allowed only before the match starts and clears the other player's ready state. After a player leaves, that cookie no longer controls the seat.

The same cookie in two tabs is the same seat. The first legal lock wins. A different move for that same round is rejected.

Display names are stable word pairs derived from the actor id. They are not wallets, token ids, or proof of a unique person. A collision with the other seat gets a visible " 2" suffix.

## Messages

`POST /api/pvp` accepts one JSON operation: `create`, `join`, `leave`, `close`, `select`, `arena`, `ready`, `assets`, `move`, `rematch`, or `setup`. Guest `create` may mint a cookie. Every other guest write requires the cookie. Requests are same-origin JSON and count toward the existing limit of 60 requests a minute for each actor.

A seated response includes the caller's name, fighter, ready flag, and own locked move when the current turn is still open. The other seat is a name, fighter, ready flag, connection flag, and whether a move is locked. It does not include the move. Battle snapshots include the public rules for both fighters. That is not the hidden choice.

Before resolution, stored locks stay in the room record and out of the other player's response. After resolution, both players receive the same ordered events. Seat B's battle is mirrored: fighters, state, event sides, move labels, and victory or defeat are swapped so the local player stays on the left. Legal moves are calculated again after the swap. Damage follows the fighter, because health and side move together. Mirroring a view twice restores the canonical battle. Clients must not resolve the round themselves.

`tokenId` is null on a friend battle. Actor ids, wallet sessions, and ownership records are not part of the public view. History shows the opponent's display name and the shared explanation, not the other person's practice battles or sign-in details.

## Resolution

The match freezes `combat-rules/1`, `combat-fighters/1`, `combat-moves/1`, and policy `combat-pvp/1` when both players ready with legal fighters. The arena is the chosen arena, or one roll of the four arenas when the choice is random. The initiative tie bit is rolled once and stored. Computer difficulty is not used. `chooseOpponent` refuses this policy.

Each turn, the server accepts a move only when the match is in `choose`, the round number matches, the seat owns the actor, and the move is legal for that fighter's health, energy, cooldown, and effects. The acknowledgement repeats the caller's own move. The same move submitted again is a success and does not add a round. A different move for that round is rejected. A stale or future round is rejected.

When both locks exist for the current round, the server resolves that round once. The deadline catch-up is committed in its own transaction before the submitted action is validated. A rejected or duplicate action therefore cannot roll back a forfeit, a Guard timeout, or a round that already resolved. SQLite `BEGIN IMMEDIATE` serializes the two writers. The deterministic `resolveRound` function receives seat A's move as the player move and seat B's move as the opponent move.

## Timeouts, disconnects, and reconnects

The stored policy is `pvp-timeout/1`:

- 30 seconds to choose a move
- 8 seconds to present a resolved round
- 20 seconds to load essential battle art
- 30 minutes for an unused lobby
- a seat looks disconnected after 8 seconds without a poll
- two consecutive missed turns forfeit

The first turn starts when both clients report that essential art is ready, or when the 20 second loading deadline passes. A client that never reports ready cannot hold the room open. Reporting ready early starts the 30 second turn from that moment. If the loading deadline is what starts the turn, the deadline is the old loading deadline plus 30 seconds, not a fresh 30 seconds measured from whenever the server woke up.

A missed turn selects Guard when Guard is legal. Guard costs nothing in `combat-fighters/1`, so it is legal whenever that fighter is alive and the match is not over. A submitted move clears that seat's missed-turn count. The automatic Guard is resolved once, then the presentation window runs.

A request is late when its server time is greater than or equal to `deadlineAt`. The server applies that deadline before it looks at the move in the same request, and it saves the Guard, forfeit, or no contest before it rejects a move that can no longer be used. Arriving on the exact millisecond does not replace the timeout. Arriving one millisecond earlier still counts as the player's choice.

A second consecutive miss does not invent a combat round. If one seat reaches two misses, the other seat wins by forfeit. If both seats reach two misses on the same deadline, the result is abandoned: no winner, the engine outcome stays unset, and both players see "No contest". The explanation text is the same on both screens. The headline is local.

If a future rules version makes Guard illegal, that seat forfeits on the first expired turn instead of receiving a different move. If neither seat can Guard, the match is a no contest. The current roster does not reach that case.

Disconnecting does not move `deadlineAt`. Rejoining shows the same round and the time remaining until that stored deadline. The on-screen countdown is only a display. It is corrected from `serverNow` and `deadlineAt` on each poll.

If the process was stopped across more than one deadline, the next request walks the stored deadlines in order, up to 48 steps. Presentation and the next turn are dated from the deadline that expired, so downtime does not grant a new 30 seconds. If the room is still behind after 48 steps, the match is abandoned as timed out while catching up.

The presentation window is eight seconds for everyone. Reduced motion changes the local animation, not the shared deadline. A client that misses more than one resolved round snaps to the current state instead of replaying the gap. A refresh does not replay earlier rounds.

`CHOG_PVP_TIMERS=test` may shorten the move, presentation, and loading clocks for the local browser suite. It takes effect only when `APP_ORIGIN` is `http://127.0.0.1` or `http://localhost`. A public origin keeps the 30 second policy even if the flag is present. The shortened values cannot exceed the real policy and cannot go below one second, 200 milliseconds, and one second. Hosted play must leave the flag unset. Rooms keep the numbers they stored at creation. The server logs a warning when a loopback process is actually using the short clocks.

## Persistence and restart

The room record stores membership, the frozen match, locks, deadlines, events, results, and rematch linkage. Locks are removed from the other player's view by the presenter, not by omitting them from the database. The opponent's "move locked" flag is intentional. The move itself is not in that response, in an error, or in battle history before the round resolves.

There is no in-memory room list. Stopping the Node process and starting a new one on the same SQLite file restores the open round, the hidden lock, and the deadline. Reopening the connection inside the same process is a weaker check and is not the restart proof. The next read applies any deadline that passed while the process was down.

Expired lobbies that never started a match are removed when someone creates a room, at most forty oldest rows at a time. Finished matches are not part of that cleanup. A room keeps the newest forty completed matches so rematches cannot grow one record without a bound. New rooms are limited to sixty per minute for the whole process, separately from each player's sixty writes per minute. Polling uses a separate budget of ninety reads per minute so two open tabs do not consume the write budget. A request that omits the guest cookie shares one process-wide budget of 120 new sessions a minute, so dropping the cookie cannot mint a fresh unlimited counter. The public proxy should still rate-limit by address.

The guest cookie is HTTP-only, SameSite strict, and lasts seven days. It is marked Secure when the request is HTTPS or when `APP_ORIGIN` is HTTPS, so a TLS-terminating proxy that forwards HTTP to Node still sets a Secure cookie. Writes require the configured origin and JSON. The invitation is 24 random bytes. It lets a new player take an empty seat. It does not authorize a move, a ready change, or a return to setup.

Clients discard a response that started before one they already applied, a lower revision, or an older `serverNow` for the same revision. A lobby poll does not replace a seat the player has already taken. The on-screen countdown is `deadlineAt - serverNow`. A wrong device clock does not add time. Rejoining shows the same round and the time remaining until the stored deadline.

A rematch is a flag on each seat. The completed match is archived only after both players ask for one. The new match id is created later, when both are ready again, and it records `rematchOf`. Either player can return to setup without creating that match. Fighter eligibility is checked again when both players are ready, including a rematch. An illegal holder choice is cleared, with a visible note, before the next match opens. The completed match stays in the room.

## Hosting still required

Local two-browser play does not prove a public two-device match. A later test needs all of the following:

- one long-lived Node process, not a serverless or multi-instance deployment
- one durable disk for the SQLite file, surviving process restarts
- HTTPS on the public origin
- `APP_ORIGIN` set to that exact origin
- `CHOG_PVP_TIMERS` unset, so the 30 second policy is the one being tested
- the same invitation URL opened on two physical devices or two separate browsers that are not local Playwright contexts
- guest cookies accepted by that host
- the server clock treated as the only deadline authority

Do not point more than one server process at the same SQLite file. Do not put the database on an ephemeral disk.

## Balance

These matches use the current combat rules unchanged. Running them between two people is not evidence that the roster is fair. The rules were written with a computer opponent. When initiative is tied, `(round + tie) % 2 === 0` gives the first action to seat A; otherwise seat B goes first. The tie bit is chosen once per match, so one seat wins every tied odd round and the other wins every tied even round. Across matches that assignment is split evenly. It is sticky inside one match, and short matches feel that on round 1. Passives that depend on fighter id, including Nyx's first-round speed, now answer a human. Pip and Bolt do not have the same health. A separate versioned balance pass has to measure that. This milestone does not change numbers or claim a fair ladder.

## Not in this milestone

No public matchmaking, rankings, rewards, wagers, progression, combat ghosts, or CHOG-token benefits are implemented, and the interface does not contain placeholders for them. See [future token-associated progression](TOKEN_PROGRESSION_FUTURE.md).

## Retired from the main path

The main navigation and landing promotion now lead to Challenge a friend, Practice, Fighters, My Chog, and Battle history.

These addresses still open the saved experience:

- `/play` — archived sandwich adventure
- `/journal` — private adventure journal for the guest session
- `/museum` — Museum of Bad Decisions, including chapters already published
- `/archive` — explains the retirement and links to those three

The adventure implementation remains because its session, journal, and museum behavior is still reachable and is not part of the combat engine. No adventure record was deleted.
