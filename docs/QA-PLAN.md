# QA scope and methods

Run all implemented standalone checks through `node tools/check-all.mjs`; the ten-minute synthetic DOM soak is available with `--soak`. Preserve the exact runtime ZIP and source hashes. `qa/product-count.json` defines conservative novelty counting. Actual outcomes are in `QA-RESULTS.md` and the JSON/TAP evidence.

Authoring enumerates the restricted 5,580 support sequences and tries at most 16 deterministic geometries per sequence. Reject repeated motifs, unsupported routes, dominant single-form courses, long idle stretches, too-short cues, invalid checkpoints, overlong routes and branches without phase-dependent use. The independent continuous-time solver and separate fixed-tick engine check every admitted ordinary course and all branches. Teaching exceptions are explicit.

Integration sends legal slot/route commands through Session and Race, saves/reloads in the middle of every course on both difficulties, and checks all branch routes. Long-run testing covers 10,000 deterministic selections per family across both difficulties, saved 10,000-stage progression, bounded history/records, family/fork bags, exact/structural variety and no difficulty creep. Fault fixtures cover unknown/corrupt saves, operational load errors, delayed acknowledgements, typed rewards, reservation crashes and overlapping pause owners.

JSDOM tests the actual diagnostic handlers with disclosed adapters. It cannot verify native touch, capture, keyboard behavior, CSS geometry, rendering, assistive technology or human enjoyment. Native browser acquisition and local-file navigation were blocked; these observations are in `qa/browser-blockers.json`. Remaining production checks have explicit NOT RUN/BLOCKED status and are never waived by a simulation count.

## Approved ad schedule — 19 October 2026; implementation pending

Section 7 of PRODUCT-CONTRACT.txt now specifies unchanged pre-roll, interstitials every five completed new races on Next without a 120-second gate, and rewarded retries 3/6/9/12... on the same course. Runtime source, test fixtures and diagnostic artifacts still implement historical D. Existing QA results remain historical; no new-cadence pass is claimed.

Required new acceptance (all NOT RUN): ADS531 five-race boundary and result-before-Next; ADS532 shared retry ordinals/reset/reload; ADS533 meaningful attempts and duplicate inputs; ADS534 reward/interstitial suppression and five fresh races after reward; ADS535 strict grants, unavailable fallback, saves/late callbacks/host pause; ADS536 exact source/runtime/package and authorized-host agreement. See the contract for exact stimuli and expectations.

This documentation change requires document/JSON consistency review only. Implement and run affected domain/native/host checks when the new cadence is implemented; do not relabel historical D passes as current behavior.
