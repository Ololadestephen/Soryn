# Game specification

**Current direction — October 11, 2026:** Combat is now primary, explicitly superseding adventure-first requirements. The adventure contracts and milestones below remain preserved secondary functionality, not combat rules. Read [combat rules and build sequence](COMBAT_RULES.md) for the new versioned contract. Combat implementation status is recorded separately; prior test results do not establish combat functionality.

The primary combat contract is COMBAT_RULES.md. This document preserves the secondary adventure design. The guest sandwich adventure, exact replay, deterministic ghost and consented exhibit loop are implemented; EOA authentication, ownership generations and consented token succession are now implemented as described in docs/IDENTITY.md. Metadata traits and artwork rights remain separately gated. See README.md and docs/PROGRESS.md for current behavior. Tune authored room content through real consenting human testing while preserving deterministic results and the core loop.

## Adventure: The Great Sandwich Incident

Your Chog wants to steal a legendary sandwich from a ridiculous museum and escape. The mission has three rooms, one short turn sequence and immediate comic consequences. Target roughly 60–90 seconds through interaction, not an artificial wait timer. Prefer animated turn-based choices to real-time physics for scope and replay reliability.

### Room 1 — The Hall of Extremely Helpful Signs

Visible clues hint that one exit is painted on a wall. Inspecting consumes a turn but reveals an actionable clue; rushing saves time when valid but raises a deterministic risk in an unsafe state. The famous failure is 'The Door Was Painted.' Clues must permit a rational solution, not arbitrary punishment.

### Room 2 — The Guard Who Loves Paperwork

The guard reacts to a clearly specified distraction rule. A player may use a limited gadget, wait for an observed patrol phase or take a clue-supported alternate route. Different choices affect time, gadget stock and alarm; later consequences make the trade-off matter.

### Room 3 — Sandwich Extraction

The sandwich and exit require a short sequence. A gadget saved earlier may help, but a player who used it can still have a clue-supported alternative. At least two viable paths; no rarity-based pay-to-win shortcuts.

## State and actions

Use a finite typed action set: inspect, advance through a named route, use a named gadget, wait. Each room exposes legal actions and visible observations. The engine rejects unknown actions, wrong phase, unavailable items and actions after a terminal state.

State contains room/phase, remaining turns, alarm, inventory, discovered facts, goal possession and terminal outcome. Mechanics use bounded integers. Rule tables define exact effects; do not leave randomness or narrative interpretation to an LLM.

If random variation is used, specify a versioned deterministic PRNG and seed, generate scenario state before play, and test it with reference vectors. Keep future hidden state out of observations and ghost input. Fixed fixtures for tests are labelled and are not live user runs.

## Outcomes and scoring

First use an understandable outcome: escaped with sandwich, escaped without goal or trapped. Proposed ranking tuple: goal completion first, then fewer turns, then lower alarm. Freeze and publish exact tie rules before leaderboard launch; equal results can share rank.

Wall-clock speed is a UI statistic, not a verified skill score in the MVP. No claims of honest blind attempts: track exposure that this application observes, distinguish first recorded attempt from known replay, and disclose external knowledge and alternate-wallet limitations.

## Character access and bounded holder advantages

Accepted October 11, 2026: the user superseded equal-power character access with four starter classes (one charge) and eight verified-holder classes (two charges). All have ten turns, inventory cap one, and viable starter solutions. Rarity and number of NFTs never stack power. Classes are original app definitions, not collection traits or new NFTs. Exact activation, access, legacy and ghost contracts are in CHARACTER_RULES.md; the twelve-class implementation and verification are in CHARACTERS.md. Token identity still seeds the official scenario, controls official history and preserves consented succession. Artwork/metadata rights remain unverified.

## Explainable strategy ghost

Two separate features:

- Exact replay ghost: playback of recorded valid actions in their original scenario.
- Strategy ghost: a policy derived from action choices, evaluated against the scenario's permitted observations.

Profile dimensions can include inspecting before committing, gadget-use timing and route preference. Record observation support counts; seed priors prevent one run from being described as conclusive personality learning. Do not equate every failure with recklessness.

Use bounded feature weights and deterministic action ranking with a documented tie-breaker. Freeze policy version, training run references, profile inputs and fallback rules. A profile must never learn from future outcomes in the challenge it is currently playing. An unseen room/state falls back to an explicit baseline rule, not omniscient knowledge.

Regression requirement: two different supported histories must produce demonstrably different decisions in at least one appropriate scenario; no invalid action may be selected. Display reasons such as '2 of 3 supported observations favored inspecting before entry.' Only claim values generated by actual records.

Player and ghost run independently from the same frozen initial state. A ghost does not consume resources in the player's environment. Race compares outcome/turn timeline, not multiplayer interaction.

Implemented guest race: before starting, copy the completed prior chapter's ghost for a same-scenario retry, or the latest completed guest ghost for a new scenario. A museum challenge uses only the consented exhibit ghost. The attempt's actions never train its opponent; completion creates a separate next profile/version. Active views disclose the opponent label/version but omit its profile, decisions and replay until completion. Existing saved records without an opponent remain valid and do not acquire an invented prior race. Historical guest-race milestone: official pre-attempt rivals were outside that slice. V2 official starts now freeze the current keeper’s own matching prior ghost, as documented in CHARACTERS.md; old saved runs remain unchanged.

The visual race clock uses spent turns rather than action count. Hold the previous state while the two-turn service vent is in transit, and hold terminal states after their lanes finish. Exact recorded replay remains separately labelled. Museum withdrawal removes opponent revelation and scoring for an in-progress challenge, which can still finish privately.

## Exhibit contract

An opt-in exhibit freezes scenario seed/content/rules versions, token profile snapshot, original validated actions/outcome, creator attribution and selected ghost version. It has an editable bounded title, explicit publication consent and a share link.

Default do not publish account details, IP/device data, private drafts or training histories not covered by consent. An exhibit is appended history, not immutable personal-data storage. Moderation/removal policy must state what can be withdrawn and how references remain valid or become unavailable.

Challenge attempts use the frozen scenario, not a regenerated 'similar' room. Compare on equivalent starting state and disclose which mode knows the solution. Hidden runtime state is not given to the player-facing client before authorized revelation; replay mode intentionally reveals history and changes cohort eligibility.

## Ownership succession

The next keeper can challenge the previously consented ghost and author a new version. They cannot rewrite the prior contributor's record or access their private drafts. The former keeper retains authorship credit and normal privacy/removal rights but loses authority to author new official token history.

Local/test transfer demonstrations must have visible labels. Do not pretend a fixture ownership toggle is a real mainnet transfer.

## Demo sequence

1. Play one real run with a comic, deterministic failure.
2. Show the replay and explanation.
3. Publish an exhibit with consent.
4. Another browser challenges the same scenario and its ghost.
5. Show the original keeper improving and creating a new ghost version.
6. Briefly show owner/non-owner behavior and labelled transfer test if real transfer is not available.

Hook: 'Your Chog remembers your worst decisions.' Closing: 'Most NFTs preserve a picture. This one preserves a character's history—and gives you something to do with it.'
