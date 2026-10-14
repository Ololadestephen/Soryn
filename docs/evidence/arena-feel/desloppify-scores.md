# Desloppify results — arena presentation

Scans use the project TypeScript root and the new `scripts/audio` Python tool boundary. Existing generated/dependency exclusions are unchanged. No ratings, suppressions or decisions were invented.

## typescript

| Overall | Objective | Strict | Verified | Open |
| ------: | --------: | -----: | -------: | ---: |
|    22.4 |      89.7 |   21.4 |     89.7 |  175 |

| Dimension         | Health | Strict | State                    |
| ----------------- | -----: | -----: | ------------------------ |
| Code quality      |   98.2 |   96.2 | Mechanical               |
| Security          |  100.0 |   98.5 | Mechanical               |
| File health       |  100.0 |  100.0 | Mechanical               |
| Duplication       |  100.0 |   99.9 | Mechanical               |
| Test health       |   44.0 |   24.5 | Mechanical               |
| Abstraction fit   |    0.0 |    0.0 | Unassessed, scanner zero |
| AI generated debt |    0.0 |    0.0 | Unassessed, scanner zero |
| API coherence     |    0.0 |    0.0 | Unassessed, scanner zero |
| Auth consistency  |    0.0 |    0.0 | Unassessed, scanner zero |
| Contracts         |    0.0 |    0.0 | Unassessed, scanner zero |
| Convention drift  |    0.0 |    0.0 | Unassessed, scanner zero |
| Cross-module arch |    0.0 |    0.0 | Unassessed, scanner zero |
| Dep health        |    0.0 |    0.0 | Unassessed, scanner zero |
| Design coherence  |    0.0 |    0.0 | Unassessed, scanner zero |
| Error consistency |    0.0 |    0.0 | Unassessed, scanner zero |
| High elegance     |    0.0 |    0.0 | Unassessed, scanner zero |
| Stale migration   |    0.0 |    0.0 | Unassessed, scanner zero |
| Init coupling     |    0.0 |    0.0 | Unassessed, scanner zero |
| Logic clarity     |    0.0 |    0.0 | Unassessed, scanner zero |
| Low elegance      |    0.0 |    0.0 | Unassessed, scanner zero |
| Mid elegance      |    0.0 |    0.0 | Unassessed, scanner zero |
| Naming quality    |    0.0 |    0.0 | Unassessed, scanner zero |
| Structure nav     |    0.0 |    0.0 | Unassessed, scanner zero |
| Test strategy     |    0.0 |    0.0 | Unassessed, scanner zero |
| Type safety       |    0.0 |    0.0 | Unassessed, scanner zero |

## python

| Overall | Objective | Strict | Verified | Open |
| ------: | --------: | -----: | -------: | ---: |
|    13.5 |      53.8 |   13.9 |     53.8 |   21 |

| Dimension         | Health | Strict | State                      |
| ----------------- | -----: | -----: | -------------------------- |
| Code quality      |  100.0 |   96.2 | Mechanical                 |
| Security          |   85.0 |   85.0 | Mechanical                 |
| File health       |  100.0 |  100.0 | Mechanical                 |
| Abstraction fit   |    0.0 |    0.0 | Unassessed, scanner zero   |
| AI generated debt |    0.0 |    0.0 | Unassessed, scanner zero   |
| API coherence     |    0.0 |    0.0 | Unassessed, scanner zero   |
| Auth consistency  |    0.0 |    0.0 | Unassessed, scanner zero   |
| Contracts         |    0.0 |    0.0 | Unassessed, scanner zero   |
| Convention drift  |    0.0 |    0.0 | Unassessed, scanner zero   |
| Cross-module arch |    0.0 |    0.0 | Unassessed, scanner zero   |
| Dep health        |    0.0 |    0.0 | Unassessed, scanner zero   |
| Design coherence  |    0.0 |    0.0 | Unassessed, scanner zero   |
| Error consistency |    0.0 |    0.0 | Unassessed, scanner zero   |
| High elegance     |    0.0 |    0.0 | Unassessed, scanner zero   |
| Stale migration   |    0.0 |    0.0 | Unassessed, scanner zero   |
| Init coupling     |    0.0 |    0.0 | Unassessed, scanner zero   |
| Logic clarity     |    0.0 |    0.0 | Unassessed, scanner zero   |
| Low elegance      |    0.0 |    0.0 | Unassessed, scanner zero   |
| Mid elegance      |    0.0 |    0.0 | Unassessed, scanner zero   |
| Naming quality    |    0.0 |    0.0 | Unassessed, scanner zero   |
| Structure nav     |    0.0 |    0.0 | Unassessed, scanner zero   |
| Test strategy     |    0.0 |    0.0 | Unassessed, scanner zero   |
| Type safety       |    0.0 |    0.0 | Unassessed, scanner zero   |
| Duplication       |  100.0 |  100.0 | Carried forward by scanner |
| Test health       |   26.9 |   30.1 | Carried forward by scanner |

The strict target of 85 is unmet. TypeScript baseline strict 21.3 is now 21.4; the objective score is 89.7. New presentation modules still receive scanner coverage warnings despite actual browser behavior coverage, and local async lifecycle/test-capture closures are flagged for nesting. Naming conventions and broader pre-existing coverage debt remain. The sound synthesis tool receives B311 for seeded pseudo-random noise: it generates sound samples, not credentials or security evidence. This finding stays visible. Python carried-forward coverage scores are not evidence about this one-file tool alone; its output WAVs have format, bounds and distinctness checks in the app suite. No unrelated Blender tools were scanned or changed.
