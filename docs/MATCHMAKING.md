# Public queue

One unranked queue. Every player chooses from the same four starters. Holder fighters stay in Practice and in private rooms. The queue does not add a computer opponent.

Transport is the existing Node process and SQLite table `pvp_queue`, read by HTTP polling. There is no Redis or WebSocket. The process is still single-process: two Node servers would each pair their own rows.

## Clocks

- A queue entry expires 180 seconds after `joined_at`.
- Both players have 20 seconds to accept an offer. The deadline is stored. The browser clock does not accept or expire the offer.
- After both accept, fighter selection uses a 90 second room lifetime. Friend invitations keep the 30 minute lobby.

## Pairing and limits

- One row per guest cookie.
- A player is not paired with that same cookie.
- A second join from the same cookie returns the existing row.
- The two oldest waiting rows are paired.
- If one player declines or the offer expires, the player who accepted returns to the queue with the original `joined_at`. The other player is removed. Three declines or missed offers pause that cookie for 60 seconds.
- Cancelling a waiting row removes only that row.
- The queue response has no private invite until both have accepted, and it never includes a hidden move.

Guest identity is the `chog_guest` cookie. Clearing it creates another guest. This is not anti-Sybil protection.

Official queue seats (holder entry) additionally hold a token reservation in the persistent
`token_locks` table while waiting, so one token cannot play a private series, a story encounter,
and the public queue at once. The reservation releases on cancel, expiry, or match.

An active public series blocks a second public seat until that series is complete or closed.
