# Verification and slice decisions — 2026-10-10

## Phase 0 evidence

- Registration: founder confirmed “I have registered already” in this chat on October 10. No application ID or dashboard receipt was inspected. No registration action was performed by the agent.
- Public event: read [official Chogathon](https://chogathon.chog.xyz/) as HTML using read-only curl. It advertises two weeks to build, essential NFT usage, optional $CHOG, and a video up to three minutes. Registration note says October 10, 19:00 UTC (20:00 WAT).
- Deadline unresolved: source countdown computes a later build end, but other source comments use “project submissions” for the extended registration window. These conflicting words and a countdown do not establish a definitive submission deadline. Ask organizer/dashboard for an explicit cutoff and submission mechanism.
- [Official Chog site](https://www.chog.xyz/) exposes a $CHOG token contract. That is not authority to configure an NFT collection. At that first-slice gate, collection/chain/standard were unverified. The later identity milestone independently verifies and allowlists Chog Genesis on Monad 143; see IDENTITY.md. Stable traits, artwork rights and actual holder signing/play remain unverified. No NFT artwork is copied.
- Also read the public HTML of the [official portal](https://portal.chog.xyz/); it did not expose a usable collection address or chain/standard in that response. No authenticated portal flow or wallet interaction was attempted.
- No wallet connection, message signing, NFT purchase, deployment, external posting or submission was performed.

## Local implementation choices

The first slice uses the recommended Next.js/React/TypeScript stack, a pure engine, strict Zod request contracts and SQLite via Node's built-in driver. Node 24 LTS is the supported local runtime; the host's Node 25 is outside Vitest 5's supported versions. Dependencies are pinned in the lockfile. A single persistent Node server with a writable local database is the current execution target. Hosting selection remains pending approval; local SQLite cannot be deployed to ephemeral serverless storage.

Scenario generator `seed-parity/1` has no PRNG: a uint32 seed fixes the guard's initial phase (even = watching, odd = reading). All other content is authored and fixed. Ten turns, one decoy, three-alarm capture; service vent costs two turns. An escape using the tenth turn succeeds; without a terminal escape, zero turns means capture. Resources are equal for all guests. No rarity or fabricated token traits.

Guest records have server-created session identities and a separate namespace. They cannot write token history. The subsequent identity milestone implements a separate official path with fresh ownership authorization; see IDENTITY.md. First recorded attempt is scoped conservatively to authored adventure content/rules. Any observed play or exhibit replay makes later patrol variants informed retries for that cookie. It means only what this installation observes; other browsers, prior knowledge and cookie resets cannot be detected reliably.

## Provenance

All game code, dialogue, CSS and geometric mascot/stage artwork are authored in this project with AI assistance. The geometric guest mascot is a placeholder, not verified collection artwork. No source was borrowed from the prohibited repositories. Planning predates the build and must be disclosed in submission. Libraries are used under their respective licenses; dependency details and limitations belong in the milestone report.


## Real identity milestone decisions — October 10

The verified profile -> Linktree -> collection provenance and deployed ERC-721 read checks justify allowlisting only Chog Genesis on Monad 143. Actual token IDs are canonical uint256 values, independent of names/metadata filenames. ownerOf(276) and tokenURI(276) support the supplied CHOG #1737 example without implying art rights. The identity-only scenario seed uses the token key, and chapter/ghost history lives in this application rather than changing NFT metadata.

Use viem 2.57.4 (MIT) for standard EOA message formatting/recovery. Contract wallets and WalletConnect remain unsupported. The read-only adapter pins deployed bytecode and validates fresh finalized/latest ownership, canonical checkpoints and token-specific Transfer logs. RPC logs are paged to 100 blocks after real endpoint limit checks. Reorgs, long continuity gaps, self-transfers and away/back rotate grants; failures authorize no official mutation. Use the existing durable Node/SQLite boundary, with nested transaction savepoints for atomic chapter plus museum publication. Store explicit public projections rather than exposing private run records. Retain authors' consent withdrawal rights without granting new token-writing authority after transfer.

Test-only HTTPS RPC scaffolding, bytecode fixture and disposable signature keys are disclosed in IDENTITY.md. The local real game has no fixture fallback. OpenSea metadata is not treated as an artwork license; the founder directed work to continue without supplying rights, so the original illustration remains. No NFT purchase/transfer, deployment, repository initialization, commit or push was performed.
