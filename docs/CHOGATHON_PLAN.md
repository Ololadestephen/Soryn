# Current continuation status — October 15, 2026

This plan's original rules notes below are historical. A fresh attempt to open the official event site on October 15 failed in the browsing tool; recheck the dashboard rules and cutoff before submission. The previously recorded October 23, 15:00 UTC cutoff is not newly confirmed here.

M7a evidence exists; current representative regressions and M7b/M7c gates are recorded in [M7_RELEASE_REPORT.md](M7_RELEASE_REPORT.md). M7b now uses bounded outage pauses and keeper-private Story succession; the retained-seat and inherited-private-run descriptions are superseded. M7c has selected-token official entry, one shared public starter queue, private consented results and public profiles. Guest entry stays wallet-free. Publication is opt-in per result; no retroactive publication.

M8 is **local preparation**, with a tested temporary-database Node restart/backup/migration harness and unprovisioned container/proxy templates. Docker daemon, hosted HTTPS/proxy checks, domain, host and budget remain gates. M9 has a private outreach draft and data inventory in [HOLDER_PLAYTEST_DRAFT.md](HOLDER_PLAYTEST_DRAFT.md); no outreach or real-holder test occurred. Submission copy and a sub-three-minute outline are in [SUBMISSION_DRAFT.md](SUBMISSION_DRAFT.md). No M10–M11 bonuses are approved by this continuation.

---

# Chogathon submission plan

Written October 15, 2026, revised the same day after review. Submissions close October 23, 15:00 UTC. That is eight days. This file is a plan, not a status report. Nothing under a milestone is done until SORYN_PLAN.md says so with commands and results.

## What the judges score

From https://chogathon.chog.xyz/ read on October 15:

- Gate: the Chog NFT must be essential. Projects that fail the gate are not scored.
- Novelty 30, Fun 20, Retention 20, Clarity 15, Execution 15. Each scored 1–5, weighted to 100.
- $CHOG use is an optional bonus.
- Tie-breakers: novelty, then retention.
- Judges review the description (up to 8,000 characters), a demo video of up to three minutes, and the links. They do not run a local checkout.
- Deliverables: team and handles, what was built, why Chog matters, working demo plus video plus testing instructions, repository and stack and pre-existing work, user feedback and next steps.

## Where Soryn stands against that

Strong: a working authoritative battler, a two-player series, a public queue, a complete story chapter, restart-safe persistence, 277 unit and integration tests, browser recordings.

Weak: the gate. Today a guest can Find a Match, play Story, and Practice without a token. The token unlocks eight extra fighters and an official history row. Removing the NFT leaves the game intact. That is the question on the judging page, and the honest answer is currently "yes, it still works." The work below exists to change that answer.

Also missing: a hosted demo, any real holder session, any $CHOG benefit, any user feedback, and browser coverage of a full public series and a full story clear.

## The pitch

Your Chog is your persistent competitor. Before a battle you choose its fighter-and-companion loadout. Its official record, series history, and story completions are stored by Soryn against the token's chain, collection, and id, not against your wallet. When the token changes hands the public record goes with it: the new owner inherits the competitor's past and the previous owner loses official authority over it. Guests play the same game with four starters and keep their own practice history, but nothing a guest does becomes part of any Chog's record.

This is the strongest answer Soryn has to the NFT-essentiality requirement. Acceptance and placement remain the judges' decision. The identity and succession code already exists (docs/IDENTITY.md). The work is to put it on the main path and make it visible.

What this does not claim: no NFT metadata is modified, nothing is written on-chain, and the record is issuer-trusted Soryn data with integrity hashes, not a blockchain fact.

## Milestones in order

Each one is cut if the previous one is not done.

### M7a. Browser coverage before touching the series and story code

- A Playwright case that plays a public series from the first queue click to a 2–0 or 2–1 result.
- A Playwright case that clears The Fractured Sanctuary on one route and resumes a loss on the other.
- Tests only. Recordings are made at the freeze (M13) after the screens stop changing.

Done when: both cases pass against the current build, so M7b regressions are caught.

### M7b. Transfer policy and the token-level series lock

This is specified before any identity UI is written. Current behavior in `src/server/pvp/http.ts`: a seated official player whose ownership generation still matches the room keeps the seat through `retainsSeat` and skips `authorize()`. That means a player who sells the token mid-series can finish, and the result would land in the token's record under the new owner. The policy below replaces that. The full text lives in docs/SERIES.md under "Ownership during a series".

- Only one active official series per token, enforced by the server with a row keyed by chain, collection, and token id. A second sign-in on the same wallet, or the same token on another device, is told the token is already in a series and is offered to resume it, not to open another.
- Before each official action the server re-checks ownership. The seat is not frozen for the series.
- If the token's owner changes while a series is open, the series ends as no contest at that moment. Neither player receives a win. The battle in progress is discarded. The record stores a no-contest entry with the reason "ownership changed" and the generation that ended it.
- The previous owner is told the series ended because the token moved. The new owner can start a new series after their first authorized sign-in; there is no cooldown and no inherited open series.
- Story encounters follow the same rule: an in-progress encounter is discarded on transfer, saved checkpoints remain private to the participating keeper; the new owner starts a fresh private run and inherits published accomplishments only.
- The old owner's private drafts and private session stay with the wallet. Public record entries stay with the token. Author attribution and consent stay as docs/IDENTITY.md describes.
- Reorg or a transfer-away-and-back within a series still ends it. A fresh generation is a fresh competitor session.

Done when: unit tests cover a transfer before the first battle, during a battle, during the intermission, and after the result but before the rematch; an integration test shows the second device offered a resume rather than a new room; the guest path is unchanged.

### M7c. The token is the competitor

- After sign-in a holder picks one token. That token is the competitor for Find a Match, Story, and Practice until they pick another or the series lock says otherwise. The picker shows the record next to each token.
- The public queue stays one starter queue for everyone. A holder in it fights as their Chog with a starter loadout, and the result binds to the token. Guests pair with holders as today. There is no holder lane. The twelve-fighter roster stays in private rooms, where it already works.
- A `token_record` table keyed by chain, collection, and token id stores battle results, series results, story completions, and no-contest entries. Guest results are written to the existing guest history and never to `token_record`.
- Public profile at `/chog/[tokenId]`: loadouts used, record, series history, story completions, current owner read from chain, previous owners' consented public entries. No private data. Readable without sign-in.
- Succession made visible: the new owner sees the inherited record on first sign-in; the old owner sees the token leave their picker. Both tested against the isolated RPC fixture already in the suite.
- Guest copy: "You are playing as a guest with four starters. Your practice history is yours. Sign in with a Chog to fight as your Chog and build its record."

Done when: a holder fixture plays a public series and a story encounter, the profile shows both, a transfer in the test RPC moves "current owner" and removes the old owner's write access, a guest run writes nothing to `token_record`, and guest history still works exactly as before. Unit, integration, and Playwright.

### M8. Hosted deploy and two-device run

- One Node process, one SQLite file that is not `data/local/chog.sqlite`, `APP_ORIGIN` set to the exact public origin, `CHOG_PVP_TIMERS` unset. A VPS or single-container host. No serverless: the queue and series clocks live in one process.
- Public Monad RPC configured read-only. No signing key on the host.
- `/health` returns readiness and a build identifier only. No paths, no environment values.
- Run the hosted two-device checklist in SORYN_PLAN.md and record it to `docs/evidence/hosted/`.

Done when: two devices on different networks complete a series through Find a Match, a restart during intermission keeps the deadline, and the recording exists.

Needs from the founder: a host and a domain, with the budget stated before anything is provisioned.

### M9. One real holder session

Private preparation is authorized. Posting and real-holder participation need separate human approval.

- Ask in the Chog Discord for one holder willing to test. Do not buy a token. Do not sign anything for the holder.
- Minimum evidence: one real holder signs in on the hosted origin, completes a token-bound story encounter, sees the profile update, and opens the public profile link.
- If two consenting holders are available, record a holder-versus-holder private series with the twelve-fighter roster. If not, that evidence stays fixture-based and is labelled as such.
- Record with permission. Collect feedback with permission. Quote only what was actually said. If none is collected, the submission says so.

### M10. $CHOG supporter standing

Deferred; requires separate explicit implementation approval as well as a founder-defined threshold. `supporterStanding` returns `unconfigured` until then.

- Cosmetic only: a supporter frame on the profile and the arena nameplate, and a tag in series history. No damage, health, initiative, roster, or queue changes.
- Balance read from the public RPC at sign-in, cached for the session. A failed read shows nothing.
- Done when: a fixture over the threshold shows the frame, one under it does not, an RPC failure shows nothing, and the description states exactly what $CHOG does and does not do.

### M11. Shareable profile challenge, if time remains

- A "Fight my Chog" link on the profile that opens a private room against that token's current owner when they are online and shows the record when they are not.
- Only after M7, M8, and the M9 ask are done.

### M12. Freeze, record, submit

- Freeze features on October 21.
- Recordings for the M7a cases and the hosted run, made after the freeze.
- Three-minute video from real screens: token picker, a public series as a Chog, the profile updating, a transfer in the test RPC moving the record, then the story. Every fixture labelled on screen. No metrics that were not measured.
- Description under 8,000 characters. Sections match the deliverables list. "Why Chog matters" is the pitch above, revised to what actually shipped.
- Testing instructions: hosted URL, two-browser steps, a guest path, a holder path. Say what needs a token and what does not.
- Pre-existing work: this repository's history before the event, every library, and AI assistance. Nothing borrowed from unrelated repositories.
- Repository: commit and push only with the founder's approval. Scan history for keys and local databases first.
- Next steps: whatever did not ship, written as not shipped.

## Deferred out of required scope

Testnet achievement recording (needs a signing architecture and key custody; not in the last week), spectating, daily rival, community voting, a holder queue lane.

## Day plan

| Day | Date | Work |
| --- | --- | --- |
| 1 | Oct 15 | M7a tests. M7b policy text and lock. Holder ask posted with approval. |
| 2–3 | Oct 16–17 | M7b tests. M7c. |
| 4 | Oct 18 | M8 deploy and checklist run. |
| 5–6 | Oct 19–20 | M9 session. M10 if a threshold is set. M11 if time remains. |
| 7 | Oct 21 | Freeze. Recordings. Video. Description. |
| 8 | Oct 22 | Final hosted check. Push with approval. Submit. One day of slack before the close. |

## Decisions only the founder can make

1. Approval to post the holder ask in the Chog Discord.
2. Host, domain, and budget for M8.
3. The $CHOG threshold for M10, or a decision to leave it out.
4. Team handles for the submission form.
5. Approval to commit and push.

## Rules that do not move

- Token balance never changes damage, health, initiative, roster, or queue order.
- No custody, transfers, staking, swaps, bets, or financial rewards.
- Guest mode stays separate and labelled, keeps its own history, and never writes a token record.
- Server ownership check before every official write; stale RPC fails closed.
- One Node process, SQLite, HTTP polling. No Redis, WebSockets, or second database.
- The sandwich adventure, journal, museum, and ghosts stay reachable and untouched.
- No claims of anti-Sybil protection, trustless scoring, on-chain records, or retention that was not measured.
- `data/local/chog.sqlite` is not opened by tests or the hosted deploy.
