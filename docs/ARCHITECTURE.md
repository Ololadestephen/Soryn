# Soryn architecture

**Current visual direction — October 13, 2026:** the approved sculpted rendered artwork is restored as the default across all twelve fighters and companions. The simplified Blender pilot is not the approved visual direction. Editable Blender sources/scripts remain preserved. See [restoration, sharpness evidence and limits](ART_RESTORATION.md).

The current combat UI uses a native viewport-filling dialog and separate HUD/control sizing, rendered atlas viewports, companion layers, stable event projection and independent current-move notice replacement. Detailed private history is opt-in after completion or from setup. These presentation boundaries add no gameplay/ownership/persistence fields. See [ARENA_3D.md](ARENA_3D.md) for the verified October 13 milestone.

**Current direction — October 11, 2026:** Combat is now primary, explicitly superseding adventure-first requirements. The adventure contracts and milestones below remain preserved secondary functionality, not combat rules. Read [combat rules and build sequence](COMBAT_RULES.md) for the new versioned contract. Combat implementation status is recorded separately; prior test results do not establish combat functionality.

Status: one local Next.js Node application with pure game/ghost modules, strict HTTP handlers, separate guest and official orchestration, Privy wallet login plus a separate local EOA SIWE chapter grant, a read-only Monad adapter, durable ownership generations and SQLite. See [IDENTITY.md](IDENTITY.md) for implemented contracts, checks and limitations. Metadata traits, artwork reuse, contract wallets, optional anchors remain outside the identity slice. Production hosting is documented separately in the deployment runbook.

## Current ownership map — October 22, 2026

Soryn runs as one Next.js Node process with SQLite behind nginx. HTTP handlers validate requests and access; domain modules own deterministic rules; capability services orchestrate changes within the shared Store transactions.

| Capability          | Rules and server ownership                                                                                                   | UI ownership                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Practice/combat     | `domain/combat`; `server/combat` service and BattleStore                                                                     | `components/combat`; rendered pose atlases and event-timed playback                |
| Story               | `domain/story`; `server/story` service coordinates encounters, reservations and progress; StoryLedger stores rewards/archive | `components/story`                                                                 |
| Private series      | `domain/pvp`; `server/pvp` service and PvpStore                                                                              | `components/pvp`                                                                   |
| Public queue        | `server/match/http.ts` handles requests; `server/pvp/queue.ts` owns SQLite queue admission and PvP handoff                                                            | `components/match`                                                                 |
| Wallet access       | `server/access` AccessBoundary and auth/holdings verification; NFT generation authority remains separate                     | Shared PlayIdentity and AccessGate; Privy provider persists across game navigation |
| Participation       | `server/participation.ts` coordinates reservations across modes                                                                 | Mode-specific resume and interruption states                                       |
| Preserved adventure | `domain/game`, ghost and exhibit rules; `server/adventure` persistence and orchestration                                     | Adventure, journal, museum and archive routes                                      |

Story currently owns its progress SQL inside its service and accesses combat records for interruptions. These are tracked review findings, not proposed architecture to copy. SQLite transaction ownership must remain shared when these boundaries are refined. Connected-wallet state alone never authorizes an action; authenticated private records and fresh eligibility/current-owner checks have different purposes.

The remaining sections include dated implementation history. Their proposals do not override this map or the current product/access rules in README.md and SORYN_PLAN.md.

## Combat-first extension

`domain/combat` owns frozen definitions, eligibility, pure sequential resolution, bounded effects and public-state opponent policy. `server/combat` owns separate actor/mode-scoped SQLite battles, replay verification, pending computer choices and HTTP boundaries. `components/combat` renders approved fighter/companion artwork through isolated pose-atlas viewports and server event frames; playback cannot change outcomes. `/arena` is independent of guest adventure hydration or Privy availability. Official combat consumes shared PlayIdentity/AccessGate state and validated server grants. Shared verified-provider/session and same-origin request helpers are reused by both APIs. Old adventure tables and contracts are unchanged. Snapshots now discriminate original `combat-opponent/1` (no difficulty, labelled Legacy policy) from `combat-opponent/2` (required easy/medium/hard). Friend battles add `combat-pvp/1` and poll the same Node process; see [private friend battles](PRIVATE_PVP.md). Independent pending choices persist before each player intent; replay uses only completed prefixes. Typed presentation projection separates event truth from anticipation/action/impact/recovery, with battle/round/source/phase IDs and per-battle playback de-duplication. See COMBAT_RULES.md, COMBAT.md and COMBAT_PRESENTATION.md for precise ordering and current evidence.

## Preserved tactical adventure character extension

Twelve original classes and bounded holder advantages are implemented; CHARACTER_RULES.md is the current product contract and CHARACTERS.md contains tested evidence. Actions and low-level tactical contracts are acyclic shared boundaries. Character definitions, target predicates, starter/holder effects, commitment state and engine transitions are separated under domain/. V1 transition/decision modules remain selected by their original versions; a shared closing-budget and completed-training visitor preserve equivalent behavior without duplicate race simulators.

V2 scenarios freeze the class/definition/ability version and initial budgets. Run JSON stores current tactical state and validated events beside actions, checked against replay. Profile policy habit-abilities/2 adds room-specific timing/route/commitment support and a frozen loadout. Training and rivals filter rules/loadouts; official rivals additionally filter token/generation. Museum snapshots carry the same scenario/loadout; guest borrowing of a holder class stays exhibit-bound and cannot be republished into reusable access. V1 data hydrates with null tactical state, never invented resources. Familiarity carries across the same authored v1/v2 mission.

Adventure presentation is grouped in components/adventure/, with roster/portrait/ability/interaction views in components/characters/. Only authoritative events change room imagery, movement and effects. The original Privy proof, nonce/session/generation and fresh-owner write path is retained. Optional CHOG_PRIVY_SERVER_APP_ID supplies a server-runtime app audience, defaulting to the built public App ID; live configuration must match the frontend. Isolated tests use an independent App ID and disposable pinned public key, never a live credential. No database rewrite, on-chain deployment or NFT metadata mutation was introduced.

## Recommended default stack

Presentation routes: `/` is a server-rendered landing page; `(game)` shares a GuestProvider/AppShell layout across `/play`, `/museum`, `/journal` and `/character`. Server page modules supply metadata and the Play challenge query; client view adapters consume one guest context. Successful starts navigate with the Next router. Root challenge queries redirect to Play; a small client compatibility component maps old section hashes. The current shared PlayIdentity provider also serves combat, Story and multiplayer; the Character-only provider description belongs to the original routing milestone. API/engine/storage/ownership contracts are unchanged. See PAGES_AND_LANDING.md.

Guest journal extension: cookie-scoped completed chapter projection, pure exhibit/cohort grouping and selected-profile races live in `domain/journal.ts` and `server/journal.ts`. `ghostOf` defaults to null for old saves; personal selection detaches exhibit comparison while retaining the source scenario. Guest mutation and journal serialization share an outer transaction. The guest UI/read hooks are grouped in `components/guest/`, with a shared request gate and separate private/public readers. See GUEST_JOURNAL.md for tested privacy, legacy, rollback and persistence boundaries.

Guest race extension: `RunRecord.rival` stores a copied profile, source, label and version at creation; legacy records default to null. `RunView.rival` omits profile and private training references and reveals independent ghost replay/comparison only after the player finishes. Official starts retain null rivals in this milestone. `domain/ghosts/timeline.ts` selects frames by spent turns; `RaceReplay` supplies a manual keyboard-accessible clock. Each SVG illustration uses a unique React ID so simultaneous lanes resolve their own paint references. Published replay includes only the consented chapter and its derived ghost frames; withdrawal hides museum opponents even from previously started runs.

- TypeScript throughout, strict mode and runtime schema validation (e.g. Zod).
- Next.js App Router + React for UI and Node-backed API routes.
- viem for verified EVM reads/signature verification; a compatible wallet-connection library if needed after the chain gate.
- SQLite for a single persistent Node deployment/local work, using a supported current driver. For serverless hosting choose a verified managed persistent database instead; do not deploy local SQLite into an ephemeral filesystem.
- Vitest for pure-engine/unit tests and Playwright for browser flows; use current official tooling documentation.
- CSS-first animation with reduced-motion support. Add a game-rendering library only if a clear need appears.
- No LLM required. Optional narration may explain existing results; gameplay stays deterministic.

Next.js/React/TypeScript/Zod, viem 2.57.4, SQLite, Vitest and Playwright are installed; the remaining hosting choices are recommendations. Pin dependencies/lockfile and disclose their licenses. Don't select paid services implicitly.

## Historical proposed layout (superseded by capability modules)

```text
src/
  app/                  # pages and thin validated API handlers
  components/           # UI, game stage and accessible controls
  domain/
    game/               # pure transition engine, scenarios, seeded generation
    ghosts/             # profile derivation, immutable versioned policies
    exhibits/           # frozen challenges, cohorts and comparisons
  server/
    auth/               # nonce/signature sessions and ownership generations
    nft/                # allowlisted chain adapter and metadata normalization
    runs/               # authoritative orchestration and step validation
    persistence/        # migrations and repositories
    publication/        # consent, moderation and idempotent writes
tests/
  unit/
  integration/
  e2e/
docs/
```

Do not generate empty scaffolding or wrappers for every potential abstraction. The final layout may be simpler if responsibilities remain clear.

## Flow

Browser authenticates -> server verifies current owner -> begin official run with frozen scenario/profile -> submit legal actions with expected step -> server evaluates engine -> finalize and reconcile record -> consented publication -> independent challenge run -> comparison.

Guest mode bypasses wallet auth only for guest records, not official token writes. Public replays never require author permissions; publication does.

## Minimum data contracts

| Record               | Core fields/invariants                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| TokenIdentity        | chain ID, normalized allowlisted collection address, integer token ID; never supplied wallet equals owner by assumption             |
| OwnershipObservation | owner, block number/hash, timestamp, source, freshness/finality outcome, ownership generation                                       |
| Session/Grant        | wallet, domain, nonce, chain, issued/expiry times, scope, generation, revocation; no private key                                    |
| ScenarioVersion      | content/rules/PRNG versions, seed, initial-state reference and observation rules                                                    |
| Run                  | ID, mode guest/official/challenge, identity, scenario/profile snapshots, actor attribution, step, actions, result, validation state |
| GhostVersion         | token identity, profile support, training references, policy version, immutable inputs and current publication status               |
| Exhibit              | original finalized run, frozen scenario/ghost, publication consent, public author alias, moderation status                          |
| ChallengeAttempt     | exhibit, independently verified result, exposure/cohort classification and no-guarantee disclosure                                  |

Final schemas must reject additional unrecognized actions and malformed identity fields at boundaries; limits protect payload, step count, title length and request rate.

## Authoritative runs and replay

Clients request actions rather than submit trusted scores. Server evaluates a pure engine; validates monotonic step numbers, legal transitions and resource accounting; persists operations idempotently. Define stale-step conflicts and transaction boundaries. Completed runs cannot be appended or silently edited.

Persist actions plus exact input versions, allowing independent replay verification. Canonical hashes bind bytes/versions. Do not call hashes a proof of fair play, blockchain settlement or absence of bots. The service remains trusted unless an independently verifiable protocol is actually implemented.

Server retains unrevealed state; client gets the current permitted observation. Entire scenario download before a supposedly blind run undermines anti-cheat. Still disclose that identities, prior exposure and collusion cannot be perfectly controlled.

## Wallet and transfer safety

Allowlisted owner checks use the correct verified standard (ownerOf only if ERC-721 is confirmed). Session challenge includes origin/domain, chain, nonce and expiry; support contract-wallet signature validation where the selected implementation provides it. Don't claim unsupported wallet types.

Official writes require a fresh ownership observation and a still-valid generation grant. Detect transfer events/ownership generations with a documented cursor and reorg handling. Transfer-away/transfer-back must not resurrect an old grant; invalidate uncertain generations. Never use indefinitely cached ownership or permanently trust authentication-time balance.

Authorizing publication at a block does not prove the person owns the NFT forever. Record the checked block and acceptable freshness/finality limits; recheck on mutation and handle unavailable providers explicitly. An off-chain write cannot be perfectly atomic with arbitrary on-chain transfer; state this residual race and selected policy rather than promising instant consensus.

MVP owns no NFTs and modifies no original collection contract. Optional state anchors are a separately approved extension; hashes do not replace correct data validation or permission checks.

## Persistence/security

Durable database stores public records separately from private drafts/sessions. Use database transactions for finalize/publish idempotency and version creation. Separate consent from a generic login signature. Do not require revealing signing keys or signing spending approvals.

Protect cookies/session lifecycle, CSRF/origin checks, rate limits and public identifiers. Avoid arbitrary remote metadata URL fetching: allowlist/validate providers and guard redirects, private networks, oversized content and invalid images to prevent SSRF/resource abuse. Untrusted titles/narration render as text, not HTML. Avoid wallet addresses in public aliases unless user opts in.

## Failure behavior

- RPC error/unknown chain/ownership: official write unavailable, no fake holder fallback.
- Invalid signature or nonce replay: authentication rejected.
- Metadata missing: documented identity-only profile or unsupported token, not invented traits.
- Database failure: no success acknowledgment for an unpersisted official result.
- Duplicate step/publish: idempotent replay or explicit conflict, never duplicate scoring.
- Missing frozen rule version: replay unsupported with explanation, not silent execution under new rules.
- Deleted/moderated exhibit: unavailable/tombstoned behavior documented; private data not re-exposed.

## Required tests

Pure engine determinism/resource bounds; legal/illegal actions; exact replay; ghost support/fallback/no-future observations; mutation/version mismatch; frozen exhibit equality; first-recorded-attempt/retry classification; nonce expiry/replay; wrong owner/chain/collection; transfer-away/back and unavailable RPC; parallel step/finalize/publication; persistent refresh; guest cannot author official history; publication consent; public history/private drafts isolation; reduced motion/mobile/keyboard controls.

## Implemented ownership and history details

`src/domain/identity.ts` keys identities by chain 143, the allowlisted Chog Genesis address and canonical decimal uint256 token ID. `src/server/nft/rpc.ts` checks the verified deployed bytecode digest and ERC165/ERC721 interface responses, validates fresh finalized/latest blocks, checks both owner responses, rechecks canonical hashes and reads token Transfer logs in windows of at most 100 blocks. Checkpoints persist in SQLite. Any transfer, reorg/backward checkpoint or continuity gap above 4,500 blocks rotates the generation and revokes prior grants. Unfinalized transfers fail closed. Observations expire after 12 seconds of collection; a commit requires evidence at most five seconds old. Blocks more than 30 seconds old fail.

Authentication messages are exact server-issued SIWE strings: scheme/domain, URI, chain, wallet, nonce, expiry and token/generation resources. A browser-bound challenge lasts five minutes; the session lifetime is 15 minutes from message issuance. Nonces are consumed atomically; session secrets are stored as SHA-256 digests. Contract-account bytecode rejects unsupported wallet types. Authentication is distinct from current-owner authorization, and every official action/publication performs new ownership reads.

Official private runs are actor/token/generation scoped, with frozen rules and an identity-derived seed. Public chapters are separate consented snapshots with an alias and a ghost derived only from that chapter, without actor, wallet, session, run ID or private training references. Their ghosts remain frozen after later play and ownership transfer. Atomic nested SQLite savepoints commit chapter and optional museum exhibit together. The original contributor retains authenticated withdrawal of their own consent after transfer; this privacy operation does not authorize new chapters. Public records become unavailable and withdrawn rows are retained. Guest endpoints reject official access, and legacy guest records remain valid.

Public replay/chapter exposure is recorded conservatively for the observed wallet/guest cookie; known guest play is carried into informed official retries on sign-in. Wallet/cookie changes do not prove absence of prior knowledge. RPC/provider consensus is trusted-service evidence, and a blockchain transfer after the last checked snapshot can race an off-chain commit. There is no continuous transfer listener, on-chain scoring, art/trait metadata fetch or anti-cheat guarantee.

## Privy authentication update

PrivyProvider is dynamically loaded only for a configured public App ID in the official identity section. It permits wallet-only Ethereum login on Monad, disables automatic embedded wallet creation, and keeps guest play/public lookup independent. Connected wallet selection and provider access come from Privy; no global `window.ethereum` fallback exists. The user’s explicit local SIWE grant remains bound to origin/chain/token/nonce/expiry/generation.

The server verifies access and identity JWTs with JOSE and the app’s official ES256 JWKS (or explicit PEM pinning), pinned issuer/audience, mandatory times/subject and matching subjects. The selected wallet must be in the signed identity token’s Ethereum linked accounts. That Privy subject binds the local nonce and stored grant. Every protected read/write checks fresh provider tokens and matches the local cookie’s subject/wallet; old signature-only cookies cannot authorize new requests. Wallet/provider changes remount the private experience and invalidate in-flight grants. Logout may revoke the local cookie without a provider token; public token history remains readable without authentication. Owner/generation/RPC/privacy rules are unchanged. See PRIVY.md for activation steps, tests and limitations.

Live local configuration now uses the official Privy JWKS endpoint, independently checked against the Node SDK source. Key-ID selection handles multiple published signing keys; failures authorize no protected request. Existing `.env` is preserved and an ignored mode override is used. Hosted wallet selection has been observed; a real holder’s signature remains pending.

## Cosmetic arena presentation — October 13

Optional `arena` / `arenaChoice` record metadata is additive and sits outside combat snapshots. A separate creation-time cosmetic choice resolves Random once; battle outcomes and opponent randomness never depend on it. Legacy records read as Sanctuary without migration. Views/history expose the actual arena, and rematch forwards it. The four IDs are runtime-validated at the HTTP and persistence boundaries.

Presentation projection remains event-authoritative. `presentation/feel.ts` maps actual phases/cues to display timing and sound; it has no engine mutations. Responsive static geometry measures real HUD/control/round/readiness bounds and retains native source caps. It is not arena movement state. `loading.ts` prepares selected viewport environment and deduplicated matchup atlases, then activated audio. Session recovery precedes setup so a saved match does not load roster previews. `useMatchAssets` observes responsive preparation/cancellation.

The audio runtime lazily opens Web Audio after UI interaction, stores only bounded local sound preferences, fetches common plus selected-family cues and handles unavailable files/context/storage without blocking combat. Frame IDs and semantic special/result guards prevent rerender or refresh replay. No music, external audio library, wallet change or new deployment is added. See [behavior, costs, evidence and limits](ARENA_FEEL.md).
