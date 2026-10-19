# 19 October 2026 — six more vehicles

Added hovercraft, monster truck, drill, jet ski, glider and rocket. Each owns a new terrain: marsh, wreck yard, mountain tunnel, rapids, canyon glide and rocket corridor. Six new families unlock one every six stages from 37 to 67, and each debuts on its unlock stage. The authoring grammar, quality gates, AI reaction groups and save validation were generalized from six families to twelve. Six-family saves migrate. The regenerated bank keeps the original 3,989 courses byte-identical and adds 5,588 (9,577 total). The 36 teaching stages are unchanged. Every QA gate was rerun on the larger bank: engine tests (42), end-to-end with reloads (19,226 runs), 10,000-stage stress and selection seeds for all 12 families, save safety, DOM integration and packaging. The safety fixture's pacing check was narrowed to credit fields; it failed on the previous code too in this environment, because active play time legitimately accrues while a rematch is raced. The game gained six procedural 3D models, six terrain styles and themes, an engine voice per vehicle, and new entry sounds (crush, tunnel, launch, soar). The bundle is now about 360 KB gzipped.

# 19 October 2026 — textless UI and procedural sound

Made the game textless and minimal. Every control is now an icon or a colour; position is shown as medal colours and progress dots. Added a wordless tap-ripple hint for the best vehicle. Added Web Audio sound synthesized in code: effects tied to engine events (switch, clean transition, splash/dive/take-off/landing, flight hoops, overtakes, checkpoints, gates, finish fanfare), a speed-following engine hum and a light music loop. Audio respects YouTube's audio switch and host pauses. The bundle grew by about 5 KB gzipped. No real-device listening test has been done.

# 18 October 2026 — three.js presentation

Added `game/`, a three.js renderer and game shell for the YouTube Playables target. It uses the existing engine modules and bank without changing them. It includes procedural low-poly vehicles and terrain, fork bypasses drawn at the engine's leg length, gates driven by the engine's gate cycle, render interpolation over the fixed 20 ms tick, the portrait and landscape HUD, and the `ytgame` boot, save and pause hooks with a local fallback. Tested in headless Chromium only. Device, Playables Test Suite and human acceptance remain unverified. No ads are enabled.

# 18 October 2026 — course/engine QA candidate

Implemented the eight-vehicle/six-family independent engine, 36 teaching stages, prevalidated ordinary bank, legal controller, saved endless bank progression and optional ad fixtures. Added exhaustive restricted-sequence audit, all-route and both-profile command integration, 10,000-stage/60,000-selection stress testing, save/ad fault fixtures, synthetic DOM integration/soak and deterministic byte auditing.

Tests found and fixed replay-origin loss after reload, dirty-acknowledgement loss, branch-entry state reuse, independent family/fork scheduling dead ends, exact-checkpoint snapshot rejection, gate floating-point boundary disagreement, unbounded/hostile save fields, record recency/best-result handling, duplicate run transactions, unrelated-pointer cancellation and already-correct clean-transition credit. Teaching counts were deduplicated against the main bank.

Native browser/device/host and human/comparator acceptance remain unverified. Graphics are unspecified. No production release, live ad change or publication occurred.
