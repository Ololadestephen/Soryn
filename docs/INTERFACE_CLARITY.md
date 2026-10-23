# Interface clarity — October 22, 2026

The main player screens now use direct titles, semantic controls and grouped actions instead of repeated promotional copy. The policy is recorded in AGENTS.md for future work.

- Landing: remove the companion tagline; name sections Gameplay and Arenas. Battle rules are available on demand. Retain the game genre, actual fighter abilities and recorded-footage provenance.
- Play: four mode links, actual resume states, free Practice and one shared holdings requirement. Remove mode numbering and repeated descriptions/access captions.
- Matchmaking: one queue state, its available actions, eligible roster and match format. Remove repeated identity/state captions and the prose checklist; link to the existing Help rules. Keep offer deadlines, pending actions, authoritative waiting/blocked messages and errors.
- Friend rooms: separate Invite and Join panels, stacked on mobile. Retain the labelled invitation input, validation and current-room return link.
- My Chog: one heading and wallet action; remove the repeated collection summary and duplicate connection heading. Keep progress, cooldown, session/error states, signature safety and access status.
- Story: retain narrative, meaningful choices and gameplay state. Remove repeated wallet subtitles and the instruction that choices remain yours.
- History: use Wallet history or Battle history as the heading rather than a heading followed by the same privacy explanation. Identity boundaries and authorization behavior remain unchanged.

DX/AX: remove unused mode-description fields, redundant MatchPanel props and styles belonging to removed elements. Retain accessible names and form labels. Browser tests locate the wallet summary by its control rather than an incidental sentence. No new UI abstraction, dependency, persistence mechanism or authentication behavior.

Evidence remains local and ignored in `.cache/copy-pass/`; screenshots of labelled wallet fixtures are not real-wallet verification. Full unit suite: 495 passed, 1 existing skipped. Lint and typecheck pass. The first selected browser run passed 23 tests, including complete grove/foundry Story journeys, access recovery, private-history access and matchmaking through selection. Final focused browser results are recorded with the local artifacts.

The final production build exited successfully. The earlier build attempt exited on the existing Next.js security-advisory reminder. A successful retry does not fix that advisory; dependency security work remains separate. No deployment, commits or pushes were performed. Saved data and the existing mobile-size adjustment are preserved. The demo composition/recordings were not edited.

Desloppify status/next were reviewed. The existing subjective review queue remains unfinished; its workflow prohibits a mid-queue rescan. No review was marked complete, no finding was suppressed, and no fresh score is claimed for this presentation pass.

Final verification: 40 browser scenarios passed in the final main run; its private-room scenario was corrected to scope its alert lookup to the challenge region rather than Next.js's separate route announcer. That scenario and all three access/history viewport checks then passed (4/4), for 44 passing final browser scenarios across the two runs. Invitation validation was exercised by keyboard, followed by creating and joining through the new form. Both full Story routes also passed in the earlier focused run. A race integration test hit its 5-second timeout while compilation competed for resources; the unchanged full suite passed serially (495 passed, 1 existing skipped). No timeout was increased or assertion removed to mask that failure.

The anonymous-gate browser test now accepts either the visible Connect wallet action or the provider-pending action, and explicitly requires the latter to stay disabled. Practice remains available and protected gameplay controls remain absent. Full sign-in and recovery are verified separately with the labelled adapter fixtures; this is not a claim that the external Privy service completed a real-wallet login during these tests.

## Equal Play cards — October 23, 2026

The Play mode grid uses equal flexible row tracks so all four cards have the same dimensions, including cards with Free or saved-progress labels. Desktop remains two columns; portrait remains one column. Browser measurements: all four cards were 500 × 166.78 CSS px at 1440 px viewport width and 354 × 125.19 CSS px at 390 px width (3× density). Screenshots are local under `.cache/equal-cards-1440.png` and `.cache/equal-cards-390.png`. No gameplay or saved-data changes.

Release validation: all 499 unit/integration tests pass, with one optional live-RPC test skipped; formatting, ESLint, typecheck and production build pass. The release also includes the pending code-quality changes. Migration changes centralize existing table creation and add nullable queue columns; existing saved rows remain preserved. An isolated Linux candidate and verified pre-release backup gate the production switch. Next.js still reports an existing dependency security advisory; this release does not upgrade dependencies.
