# 18 October 2026 — three.js presentation

Added `game/`, a three.js renderer and game shell for the YouTube Playables target. It uses the existing engine modules and bank without changing them. It includes procedural low-poly vehicles and terrain, fork bypasses drawn at the engine's leg length, gates driven by the engine's gate cycle, render interpolation over the fixed 20 ms tick, the portrait and landscape HUD, and the `ytgame` boot, save and pause hooks with a local fallback. Tested in headless Chromium only. Device, Playables Test Suite and human acceptance remain unverified. No ads are enabled.

# 18 October 2026 — course/engine QA candidate

Implemented the eight-vehicle/six-family independent engine, 36 teaching stages, prevalidated ordinary bank, legal controller, saved endless bank progression and optional ad fixtures. Added exhaustive restricted-sequence audit, all-route and both-profile command integration, 10,000-stage/60,000-selection stress testing, save/ad fault fixtures, synthetic DOM integration/soak and deterministic byte auditing.

Tests found and fixed replay-origin loss after reload, dirty-acknowledgement loss, branch-entry state reuse, independent family/fork scheduling dead ends, exact-checkpoint snapshot rejection, gate floating-point boundary disagreement, unbounded/hostile save fields, record recency/best-result handling, duplicate run transactions, unrelated-pointer cancellation and already-correct clean-transition credit. Teaching counts were deduplicated against the main bank.

Native browser/device/host and human/comparator acceptance remain unverified. Graphics are unspecified. No production release, live ad change or publication occurred.
