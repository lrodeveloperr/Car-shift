# 18 November 2026: YouTube Playables submission kit

**Upload.** `npm run package` (in `game/`) builds the upload zip. It holds `index.html` and `game.js` at the root, and rebuilding gives a byte-identical zip. Before writing the zip it checks the Playables bundle rules:
- file names and count
- size limits
- relative paths
- the SDK loads before the game code
- no network APIs
- preview-only code compiled out

`npm run check:playables` plays that exact zip in Chromium against a stand-in for YouTube's SDK. All 19 checks pass:
- SDK call order
- pause and resume stop rendering and input
- cloud-save order and size
- `sendScore`
- heap size (16 MB after a race)
- no browser storage, vibration, Page Visibility or language APIs
- no network calls beyond the SDK
- no page errors

All nine Playables aspect ratios (9:32 to 32:9) were checked: no control is off-screen or overlapping on the title, race or medal screens.

**Compliance changes.**
- Inside YouTube, the in-game sound buttons are removed: Playables should rely on YouTube's mute, and must not show look-alike icons near YouTube's controls. The sound setting is no longer read from browser storage there.
- Vibration is gone everywhere: Playables that vibrate must offer an on/off switch.
- While YouTube has the game paused, taps and keys are ignored and interface animations freeze, as well as the loop, rendering and sound.

**Store assets.**
- `tools/thumbnails.mjs` renders marketing thumbnails in six aspect ratios from the game's own models, with no text or logos. The orange racer leaps off the road as a car and shifts, in a gold burst, into a boat that lands with a splash. The helicopter bursts through a ring above, and the rivals are on its tail.
- `tools/screenshots.mjs` captures eight real in-game screenshots.
- `releases/youtube-playables/SUBMISSION.md` has the listing text, monetization settings, IARC facts, a device test plan and a requirement-by-requirement checklist.

**Rewarded button first.** Whenever a video is on offer (skip after a loss, trial or paint after a win), it is the big pulsing orange button and takes focus. Next or Retry becomes a small glass button on its left. The video button ignores taps for its first 600 ms. The level pill:
- shrinks long numbers (five digits and up), so the position disc and track always fit after it
- stays hidden until the save loads

An unreadable save no longer leaves a Play spinner turning.

# 18 November 2026 — failed saves no longer block play

The shareable preview could not start a race when the browser blocked storage (for example inside a sandboxed viewer): the first save failed and Play did nothing. Outside Playables, progress now falls back to memory when storage is blocked. In every build, a race whose first save fails still starts, and the periodic save retries.

# 18 November 2026 — levels, competitive opponents and vehicle variety

**Levels.** Only first place clears a level; finishes still count for ad pacing. A new `skip` claim clears a lost level through a rewarded video. `rewardOffer()` now offers a skip after a loss and a trial or paint after a win (no more paid retry; retrying is free). Interstitials only come after wins.

**Opponents.** Standard opponents strengthened: 0.952/0.982 speed and 205/152 ms reactions after level 6, and slightly stronger in levels 1–6.

**Vehicle variety.**
- Families unlock every three levels (1, 3 … 33).
- `tools/foundations.mjs` rebuilds the teaching levels: a fixed debut course for every family on its unlock level, and least-recently-raced rotation in between. The fork, current and wind lessons moved to levels 16, 22, 28, 34 and 35.
- The re-audited bank keeps 9,577 courses; 3 changed, because the stronger opponents let an earlier layout pass the pressure gate.

**Daily course.** It is now the day's first level after the teaching levels: its family is that level's, and a win or skip clears the level.

**Game screens.** A level number sits top left on all screens and bumps on a clear. The pause button is gone. After a loss the big button is a free retry, and the offer shows a skip arrow.

**Verification.**
- Engine tests 49/49.
- Stress: 10,000 levels, 5,134 of them cleared through the rewarded skip.
- End-to-end: all courses won by optimal play.
- A mocked-SDK browser run covered a win, a loss, a free retry and an earned skip.

# 18 November 2026 — ads

Wired YouTube interstitial and rewarded ads into the game through the engine's existing reservation, pacing and claim logic. The engine gained a single `rewardOffer()` per result: retry from the checkpoint (rematch) or from the start after a loss, and after a win a one-race trial of the next locked family alternating by stage with a new paint. It also gained new claim kinds (`replay`, `trial`, `paint`), a `trial` race origin that never moves the journey, and the player's paint in the save. Journey credit is now explicitly limited to `journey` races. Interstitials are blocked before stage 6 and right before a vehicle debut. Rewarded offers lost their cooldown. In the game, the medal screen's Replay button became the offer button (reward face plus a video mark: a generic gold film clapper, not YouTube's logo). Paint recolours the player's vehicles, marker, progress dot and icons. Audio is held during ads. A rewarded video that is unavailable grants the reward; one closed early grants nothing. Engine tests 49/49, including new offer, claim, gate and save-validation tests. A browser run against a mocked `ytgame.ads` covered interstitial-on-Next and rewarded earned, skipped and unavailable.

# 19 October 2026 — daily course made invisible

At the user's direction (players just want to press Play and race), removed every daily-specific detail. The sun badge on Play and Next, the sun beside the position disc, the streak dots and the daily bell and streak chime are gone. The daily course still runs as the first race of each day from stage 4 and still records its streak in the save.

# 19 October 2026 — daily course

Added a daily course with no new screen: from stage 4, Play starts the day's course first. A spinning gold sun on Play marks it, a sun sits beside the position disc during the race, and seven streak dots show on the result. The course is generated on the device from the date (`source/daily.mjs`) from families the player has unlocked, using geometry variants the bank never uses. It must pass the same simulation gates as the bank. Those gates moved from `tools/audit.mjs` to `source/audit.mjs` so authoring and the daily share one copy; the regenerated bank is byte-identical. Dailies never change the journey frontier, queue, history or records, and are excluded from saves' record lists. Restart keeps a daily a daily. Saves without the daily field migrate. Fixed SVG visibility toggling in the game shell, which had also kept the unreadable-save warning icon hidden. Bundle is about 364 KB gzipped.

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
