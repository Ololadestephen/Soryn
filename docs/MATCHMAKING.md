# Public queue

One shared unranked queue with the same six-fighter pool for every eligible entrant: Pip, Bolt, Patch, Moss, Aegis and Nyx. Authenticated wallets qualify with at least 500 $CHOG or a verified Chog NFT, independently, while the operator gate is open. The broader NFT roster remains eligible in private rooms. Guests keep Practice and private history; they cannot enter new public matches. The queue does not add a computer opponent.

Transport is the existing Node process and SQLite table `pvp_queue`, read by HTTP polling. There is no Redis or WebSocket. The process is still single-process: two Node servers would each pair their own rows.

## Clocks

- A queue entry expires 180 seconds after `joined_at`.
- Both players have 20 seconds to accept an offer. The deadline is stored. The browser clock does not accept or expire the offer.
- After both accept, fighter selection uses a 90 second room lifetime. Friend invitations keep the 30 minute lobby.

## Pairing and limits

- One row per authenticated actor for new holder admissions. Historical guest rows are preserved/expired under the existing cleanup policy.
- A player is not paired with that same cookie.
- A second join from the same cookie returns the existing row.
- The two oldest waiting rows are paired.
- If one player declines or the offer expires, the player who accepted returns to the queue with the original `joined_at`. The other player is removed. Three declines or missed offers pause that cookie for 60 seconds.
- Cancelling a waiting row removes only that row.
- The queue response has no private invite until both have accepted, and it never includes a hidden move.

The `chog_guest` browser identity remains separate from authenticated wallet play and official NFT competitor identity. A client-supplied guest cookie cannot impersonate a wallet account. Sign-in is not proof of a unique person; this is not anti-Sybil protection.

Official queue seats (holder entry) additionally hold a token reservation in the persistent
`token_locks` table while waiting, so one token cannot play a private series, a story encounter,
and the public queue at once. The reservation releases on cancel, expiry, or match.

An active public series blocks a second public seat until that series is complete or closed.
