October 16 continuation: the production audit was refreshed without changing package versions. The exact current counts and source/date bounds are in [M7_RELEASE_REPORT.md](M7_RELEASE_REPORT.md); the runtime reachability inspection below remains the October 15 analysis. It does not prove that every future SDK configuration is unreachable.

# Wallet dependency assessment — October 15, 2026

The production audit still reports **23 moderate package findings, zero high and zero critical**. These are two underlying advisories plus dependent-package findings, not 23 distinct exploits. No dependency versions, overrides or lockfile entries were changed in this milestone. A clean audit has not been claimed.

Evidence: [audit JSON](evidence/soryn-readiness/production-audit.json), [complete dependency tree](evidence/soryn-readiness/wallet-dependency-tree.txt), [distributed runtime/source-map inspection](evidence/soryn-readiness/wallet-runtime-inspection.json). Commands: `npm audit --omit=dev --json`, `npm ls uuid decode-uri-component query-string --all`, `npm explain uuid --json`, `npm explain decode-uri-component --json`. Registry metadata and the current primary advisories were checked on October 15. Inspection used the installed distributed files, rather than just searching application imports.

## Decoder: GHSA-vcc3-ghjq-m6fr / CVE-2026-45822

`decode-uri-component@0.2.2` is installed. Malformed percent-encoded input can cause excessive CPU use; the advisory affects versions through 0.4.2 and identifies 0.5.0 as patched. Input-length limits are a workaround when the decoder actually receives untrusted input. [Primary advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr).

Declared chain: Privy 3.48.1 → x402 0.7.3 → wagmi 2.19.5 → @wagmi/connectors 6.2.0 → WalletConnect ethereum-provider 2.21.1 / Reown AppKit 1.7.8 → WalletConnect utils 2.21.0 or 2.21.1 → query-string 7.1.3 → decode-uri-component 0.2.2. The tree records the additional nested universal-provider copies.

Actual installed runtime evidence:

- All four utils locations from `npm explain` were inspected, including nested packages under `@wagmi/connectors`, rather than the unrelated hoisted utils 2.22.4.
- Their distributed ESM/UMD code does not reference query-string or decode-uri-component. Their mapped URI parser and query formatter use native `URLSearchParams`.
- The ESM from the official npm utils 2.21.0 tarball was compared byte-for-byte with the installed file: 86,793 bytes, SHA-256 `6e96a2157058233a7fa3ff4e16bb0ef9a9ee1b0372e69de4d682b5160681d2c1`. This is published runtime behavior, not an unrecorded local patch.
- Privy's distributed payment hook imports `x402/client` only after its wrapped fetch receives HTTP 402. Soryn uses the identity/wallet hooks and does not call that payment wrapper. This is a positive SDK call-path finding, supplemented by application inspection; absence of a direct decoder import alone would not establish reachability.

Conclusion: no decoder call was found along the inspected published connector runtime paths. The vulnerable package remains installed through stale dependency declarations. This is bounded static evidence, not a blanket assertion that every SDK build, dynamic import or future configuration is unreachable.

Compatible fix assessment: query-string's latest 7.x is 7.1.3 and still declares decoder `^0.2.2`. Decoder 0.5.0 is outside that range and changes to ESM, while query-string 7 requires it through CommonJS. A forced override is not a justified compatible fix. The checked Privy 3.49.0 manifest still includes x402 `^0.7.1`; merely upgrading that minor does not remove this chain. Await an upstream dependency cleanup or separately test a deliberate SDK migration.

## UUID: GHSA-w5hq-g745-h8pq / CVE-2026-41907

UUID 8.3.2 and 9.0.1 are installed. The issue concerns missing bounds checks in v3/v5/v6 when callers supply an output buffer/offset; ordinary v4 generation is outside the affected behavior. The listed patch releases include 11.1.1, 12.0.1 and 13.0.1. [Primary advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

Declared chains share Privy → x402 → wagmi → connectors. MetaMask SDK 0.33.1 and its communication layer 0.33.1 use UUID 8.3.2. MetaMask utils 8.5.0, 9.3.0 and 11.12.1 use UUID 9.0.1 through MetaMask providers, Gemini rpc-errors, and the Coinbase 3.9.3 block-tracker/provider chain. See the tree for each nested copy.

Actual installed runtime evidence:

- MetaMask SDK's browser source map identifies UUID imports in `handleUuid.ts` and `sdk.ts`; they generate anonymous/channel identifiers with zero-argument `uuidv4()`.
- The communication layer uses zero-argument v4 in channel creation/disconnection, and `validate` in connection/rejection. These callers do not pass an output buffer or offset to v3/v5/v6.
- All eight installed MetaMask utils paths from `npm explain` were inspected. Their `dist/fs.mjs` uses `uuid.v4()` for temporary directory names. The actual vulnerable buffer-writing APIs were not found in those callers.
- Soryn's server identities and battle IDs use `node:crypto`; authenticated holder requests use verified JWT/SIWE and fresh ownership evidence. That application fact is supplementary to the upstream caller analysis.

Conclusion: the inspected SDK callers do not exercise the advisory's vulnerable function/argument combination. This does not prove all third-party entrypoints safe or replace a real-wallet interoperability test.

Compatible fix assessment: the installed parents require UUID 8.x or 9.x. The latest checked MetaMask utils 11.x still declares UUID 9.x. A patched UUID major is outside those contracts, so no forced replacement was applied. `npm audit fix --force` proposes a Privy downgrade rather than a safe repair of the current SDK. It was not run.

## Release consequence and uncertainty

Guest queue, Story and Practice do not need Privy or a wallet. Their test recordings contain disposable guest sessions. The current sources do not implement x402 payments, purchases or wallet transactions.

The controlled guest two-device test can proceed once the functional/quality gates in [release readiness](SORYN_RELEASE_READINESS.md) pass. Keep real-holder/wallet rollout a separate gate: repeat this inspection on dependency changes, exercise the intended Privy connectors on the hosted HTTPS origin and real devices, and obtain an upstream-compatible cleanup or an explicit documented acceptance of the remaining warnings. No hosted or physical-wallet verification was performed here.

Authentication regression coverage uses actual locally generated JWT and EOA signatures with synthetic ownership/RPC fixtures. It verifies signature expiry/replay, subject/wallet mismatch, transfer generation, RPC fail-closed behavior and narrowly retained existing-battle access. It is not evidence of owning a live collection token or signing with the user's wallet.
