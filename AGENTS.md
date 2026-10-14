# Chog Déjà Vu — project instructions

## Product lock

Current user direction, October 11, 2026: build Déjà Vu primarily as a turn-based creature battle game. Choose fighter → arena → paired choices → sequential resolution → result → rematch. Preserve adventures, recorded ghosts, journal, Museum of Bad Decisions, consent and their existing URLs as secondary experiences. Token ownership controls new official fighter history; private drafts stay private and consented public adventure history still follows the token. This explicitly supersedes the previous adventure-first product lock.

Read START_HERE.md, README.md, PLAN.md, docs/GAME_SPEC.md, docs/ARCHITECTURE.md and docs/EVENT_AND_SUBMISSION.md before implementation. These documents are project direction, not evidence of implemented functionality. Current user instructions and verified live event rules take precedence; document conflicts and ask before materially changing scope.

## Do not drift

- Start combat with one complete starter-versus-computer encounter, then four starters, then eight distinct holder fighters. Preserve the three-room adventure and museum without forcing players through them.
- Ship authoritative playable combat, visible resolution and persisted rematches; never represent selection cards as finished fighters.
- NFT identity, current-owner authority, token-bound history and ownership-transfer behavior are load-bearing.
- Guest mode is a separate, labelled experience; it cannot write official NFT history.
- First-attempt and informed-retry cohorts remain separate. A new wallet is not proof of a new person or absence of prior knowledge.
- No borrowing from Recourse, Reviso, Nigemichi or unrelated repositories unless reuse is explicitly approved and disclosed.
- No custody, transfers, staking, swaps, bets, financial rewards or speculative $CHOG mechanics.
- Never promise uniqueness, perfect anti-cheat, true machine learning, trustless scoring or guaranteed retention without evidence.

## Coding quality — mandatory Desloppify policy

Apply the user's global quality policy to every code change. Use the project's own directory as the coherent boundary, never the Desktop or brainstorming parent.

Before writing code:

1. Inspect current files and user changes; preserve unrelated work.
2. Check `desloppify` availability and read the installed skill/workflow when invoked. `.desloppify/` must be ignored before scanning.
3. Exclude obvious dependencies, caches, generated/build output and worktrees. Ask before excluding questionable directories; do not exclude authored engine, API, tests or game content to improve scores.
4. This initial documentation-only handoff does not need a scan. For the empty project, design the first coherent slice, then scan once meaningful code exists.
5. Before subsequent non-trivial changes run `desloppify scan --path .`, `desloppify status`, and `desloppify next` in this project. Use findings to avoid introducing debt without expanding every task into unrelated cleanup.

While writing code:

- Use typed boundaries, runtime validation, deterministic pure rules and explicit error states.
- Keep gameplay, ghost policy, persistence, ownership verification and UI separate.
- Test actual behavior and failure boundaries. Do not replace assertions with snapshots of mocked success.
- Fix debt introduced or directly exposed by the requested work.
- Do not game scores with exclusions, suppressions, unjustified wontfix decisions or fixture manipulation.

After writing code:

- Run formatting, type/static checks, relevant tests and production build.
- Rescan the same boundary and review status/next. Resolve regressions before calling the milestone complete; report remaining relevant findings.
- Explicit health campaigns use the full scan -> plan -> execute -> rescan workflow, following its queue honestly.

Desloppify execution is skipped for documentation-only work; explain that exception. Installing missing tools/dependencies follows user authorization and environment permissions.

## Authority and security

- Do not create branches, commit, push, deploy, register applications, post messages or accept agreements without authorization for the action.
- Do not sign wallet messages or transactions on the user's behalf without explicit authorization. Never request private keys or seed phrases.
- Use read-only collection verification first. Do not purchase an NFT because a demo requires one.
- Keep credentials outside source control, client bundles, screenshots and logs. Public RPC configuration is not a signing key; identify differences explicitly.
- No paid AI, RPC/indexer service or deployment without a stated budget and approval.
- Do not spawn subagents unless explicitly requested by the user or later applicable instructions. 'AGENTS.md' is a project policy file, not permission to launch agents.

## Data and ownership honesty

- Verify official chain and collection address from primary sources before allowlisting.
- Server checks current ownership before each official write; missing/stale RPC evidence fails closed.
- Bind authentication signatures to domain, chain, wallet, nonce and expiration. Old session ownership caches do not authorize writes after transfer.
- Revoke old write grants on detected ownership change. Reorgs and transfer-away/transfer-back require an explicit ownership-generation policy; do not rely solely on the current address matching an old grant.
- Do not claim existing NFT metadata is modified. Application history and optional anchors are separate.
- Public published history transfers with character identity; private drafts, account identifiers and private sessions do not. Preserve author attribution and consent policy.
- Server validation is trusted-service evidence. Hashes establish integrity, not source truth, honest play or blockchain consensus over a score.

## Completion discipline

Update docs and status after each meaningful milestone with commands, test results, limitations and next gate. No fake demo outputs, usage, metrics or testimonials. Judge-friendly evidence must distinguish guest/test fixtures from verified collection data and actual gameplay.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
