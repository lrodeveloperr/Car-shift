# Shape Shifting: Vehicle Race: YouTube Playables submission kit

Everything needed for the YouTube Playables Developer Portal upload, which Mediacube files for the channel.

| File | What it is |
|---|---|
| `shape-shifting-vehicle-race-playables.zip` | **The game.** Upload this as the bundle. Entry point: `index.html`, at the zip root. 2 files, 366,613 bytes. SHA-256 `398da8ba6d0d47e57ba798b03db2ea108fb3d89ac21658e68fe336e55b79f4d2`. |
| `thumbnails/` | Store thumbnails in six aspect ratios (16:9, 1:1, 9:16, 4:3, 3:4, 2:3), PNG, all under 500 KB. Upload the ratios the portal asks for. |
| `screenshots/` | Eight real in-game screenshots (six portrait 1080×1920, two landscape 1920×1080), in case Mediacube or the portal asks for them. |
| `package-report.json` | Bundle rule checks, file sizes and hashes. |
| `playables-check.json` | Results of playing the zip in Chromium against a stand-in for YouTube's SDK. |

## 1. Details

**Title:** Shape Shifting: Vehicle Race

**Description** (English):

> Race by changing vehicles! Tap to switch between car, boat and helicopter as the track turns from road to water to sky. The right vehicle at the right moment wins. Unlock 14 vehicles, from dirt bikes and trains to submarines, hovercraft, drills, gliders and rockets, across thousands of levels. Beat two rivals to first place to clear each level. One-tap controls, no reading needed.

**Genre:** Racing (if a second genre is offered: Casual).

**Publisher / developer:** fill in the names Mediacube uses for this channel. The title, description and thumbnails must not carry any logo or branding.

**Language of title and description:** English. The game itself has no text at all, so it works for every language. Translations of the title and description are optional.

**Thumbnails:** one per ratio the portal asks for, from `thumbnails/`. They are built from the game's own 3D models, so they show the real game:
- The orange racer leaps off the road as a car.
- A gold burst marks where it shifts into a boat, which lands with a splash.
- The helicopter bursts through a flight ring above.
- The blue and pink rivals are right behind.

They carry no text, logos or branding.

**Monetization:** leave all three on.

| Ad | Where | Limits |
|---|---|---|
| Pre-roll | YouTube, before the game | YouTube's own |
| Interstitial | Only when the player taps Next after winning a level: a natural break between two races, never during play and never after a loss | None before level 6, never right before a new vehicle's first race, at most one every 2 races and 2 minutes, none within 2 minutes of a rewarded video |
| Rewarded | Opt-in button on the medal screen, marked with a film-clapper icon. After a loss it skips the level; after a win it gives a one-race trial of the next vehicle or a new paint colour | The player can always continue without it: Retry is free after a loss, Next is free after a win. A video closed early gives nothing; if no ad is available the reward is given anyway |

There are no in-app purchases and no ads from any other service. Rewards only exist inside the game.

**Accessibility (optional):** pick only the portal's options that match these facts. Misrepresenting features is not allowed.
- No reading is needed anywhere: every control is an icon.
- The whole game is played with single taps or clicks: no holds, swipes or timing combos.
- The keys 1, 2, 3 and the arrow keys also work.
- It can be played with the sound off: every sound cue also has a visual one.
- Not suitable to claim: the colour-only position medals (gold, silver, bronze) have no non-colour alternative.

## 2. Test (portal preview link)

Open the preview link on desktop Chrome, the YouTube app on Android, and the YouTube app on iOS, and run the Playables Test Suite. Check:

1. The game loads to the title screen with an orange Play button in a few seconds. Play starts a race.
2. Mute and unmute with YouTube's control: the game falls silent and comes back. There is no separate in-game mute button inside YouTube.
3. Leave the app mid-race, then return: the game is paused and shows a Resume button.
4. Win a level, close the game, reopen it: the level number top left has kept its value. Progress lives in YouTube's cloud save.
5. Lose a race:
   - The big button plays a video to skip the level.
   - The small button retries the level for free.
   - Watch the video to the end: the next level starts.
   - Close it early: nothing is given.
6. From level 6, win two races over at least two minutes and tap Next: an interstitial may play before the next race.
7. Rotate the phone, and resize the desktop window from very tall to very wide: the game adapts without restarting.

## 3. Age rating (IARC questionnaire)

Contact email: the channel's contact. It is shared with IARC and the rating authorities.

Facts for the answers:
- **Violence:** none against any character; there are no people or creatures. A monster truck drives over junked cars in a wreck yard, a stylised cartoon of objects being crushed.
- **Fear, horror, sex, nudity, drugs, alcohol, tobacco, gambling:** none.
- **Language and crude humour:** none (there is no text).
- **Users interacting** (chat, user content, multiplayer): none. The rivals are computer-controlled.
- **Location sharing:** none.
- **Purchases:** none.
- **Ads:** yes, YouTube's own: pre-roll, interstitial and rewarded.
- **Personal data:** nothing is collected. The only saved data is game progress, through YouTube's cloud save.
- **Audience:** general, not made for kids.

## 4. YouTube Playables requirements

Checked against Google's certification requirements as published in November 2026.

| Requirement | Status | How |
|---|---|---|
| SDK loads before any game code | Pass | First script in `index.html` |
| `firstFrameReady` while a loading screen shows; `gameReady` only once interactive | Pass | The title screen shows a spinner on Play until loaded; `gameReady` fires once Play is tappable |
| Cloud save only, after `loadData`; old saves load | Pass | No browser storage inside YouTube; the save stays under 16 KB even after 10,000 levels; saves from earlier versions migrate |
| `sendScore` matches the save | Pass | Score = levels cleared |
| Respect YouTube mute (`isAudioEnabled`, `onAudioEnabledChange`) | Pass | No sound while muted |
| Should not show its own overall mute button | Pass | Hidden inside YouTube |
| Pause everything on `onPause`; no Page Visibility API | Pass | Loop, rendering, sound, animations and input stop; progress saves |
| All aspect ratios 9:32 to 32:9; no orientation lock; state kept on resize | Pass | Checked at all 9 ratios: no control off-screen or overlapping |
| Touch and mouse for everything; Esc not blocked | Pass | Keyboard also supported |
| Haptics need an on/off toggle | Pass | The game does not vibrate |
| No sharing prompts, external links, exit button or extra user agreement | Pass | None |
| No look-alike YouTube icons near YouTube's controls | Pass | The in-game sound icon is removed inside YouTube |
| English; no `navigator.language` | Pass | Textless; language APIs unused |
| Initial bundle under 30 MiB; files under 30 MiB; at most 8,000 files; relative paths; safe file names | Pass | 1.41 MiB raw, 358 KiB gzipped, 2 files |
| Heap under 512 MB; works in Chrome, Edge, Firefox and the YouTube apps | Pass in Chromium | Heap measured after a full race (see `playables-check.json`); real-device and other-browser runs are part of the portal test step |
| Rewarded ads opt-in, never automatic, never blocking progress | Pass | Free Retry or Next is always offered |
| Interstitials only at natural breaks, never during play | Pass | Only on Next after a win |
| No off-platform ads or purchases | Pass | None |
| Clearly communicate when content runs out | Not applicable | Levels never run out: 9,613 built-in courses recycle, plus a daily course |
| Thumbnails without logos; content not deceptive | Pass | Built from in-game models; no text or logos |

**Recommendations not yet met:**
- **File size:** each file *should* be under 512 KiB. `game.js` is 1.40 MiB, because it holds three.js, the engine and all 9,613 courses in one file. It downloads as 358 KiB compressed, well inside the hard limits.
- **WCAG AA:** a best effort. The race position is shown by colour alone.

**Reviewer notes:**
- The rewarded button is marked with an icon, not words, because the whole game is textless. If review asks for an explicit label, that is a one-line change.
- The rewarded button ignores taps for 0.6 s after it appears, on purpose, so a tap left over from the race cannot start a video by accident.

## 5. Evidence

- `playables-check.json` (19/19 pass) comes from `node tools/playables-check.mjs` in `game/`. It plays this zip in Chromium against a stand-in for YouTube's SDK. It covered:
  - SDK call order
  - pause and resume: rendering and input stop
  - cloud save order and size
  - `sendScore`
  - JS heap size after a full race
  - no browser storage, vibration, Page Visibility or language APIs
  - no network calls beyond the SDK
  - no page errors
- `package-report.json` comes from `node tools/package.mjs`, which builds and checks the zip. Rebuilding gives a byte-identical zip.
- The thumbnails come from `node tools/thumbnails.mjs`; the screenshots from `node build.mjs --preview && node tools/screenshots.mjs`.
- These were not run here, because they need YouTube itself:
  - real devices
  - the real SDK and ads
  - the Playables Test Suite
  - the IARC questionnaire

  They happen in the portal's test step.
