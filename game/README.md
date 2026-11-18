# Three.js presentation (YouTube Playables target)

A low-poly 3D front end for the existing engine. It imports `source/*.mjs` and the prevalidated `runtime/data` bank unchanged. The renderer only reads race state. All rules, AI, timing and saves stay in the engine's fixed 20 ms simulation.

## Build

```sh
cd game
npm ci
npm run build      # dist/index.html + dist/game.js — zip dist/ for upload
npm run dev        # rebuilds on change, serves http://localhost:8080
npm test           # track-geometry tests against every bank course
node build.mjs --preview   # also writes dist/preview.html (single file, no YouTube SDK tag)
```

The preview build, and only the preview build, accepts a `#stage37`-style link that opens a throwaway journey at that stage. Later vehicles can then be tried without the 36 teaching stages, and the real save is never touched. The upload build compiles this out (`__PREVIEW__` is `false`).

The initial bundle is about 1.46 MB raw and **about 360 KB gzipped**. That includes three.js, the engine, all 9,613 courses (9,577 ordinary plus 36 teaching) and every sound. There are no models, textures, audio files or fonts to fetch, and no network calls other than the YouTube SDK script.

## Layout

| File | Role |
|---|---|
| `src/track.mjs` | Pure math, no three.js: maps an engine `block/choice/pos` to lane coordinates. Fork bypasses wiggle so their drawn length matches the engine leg to within 0.3%, so equal speeds look equal on screen. |
| `src/world.mjs` | Scene: terrain slabs, low-poly animated water (calm, marsh and rapids), roads, rails, wreck yards, mountain tunnels, gates, flight rings (gold for planes, teal for gliders, cyan for rockets), scenery, a starry sky for the space family, particle trails and the chase camera. One merged mesh draws the track; props are instanced. |
| `src/vehicles.mjs` | All fourteen vehicles, built from primitives: car, dirt bike, snowmobile, train, boat, submarine, helicopter, plane, hovercraft, monster truck, drill, jet ski, glider and rocket. Geometry is baked once and shared by all three entrants. |
| `src/main.mjs` | Boot, the fixed-tick loop with render interpolation, HUD, input, pause, dynamic resolution, and the sound, haptic and hint cues driven by engine state changes. |
| `src/audio.mjs` | Web Audio synthesis: every effect, a per-vehicle engine hum that follows real speed, and a light music loop. Has a compressor and reverb send; no audio files. |
| `src/host.mjs` | `ytgame` adapter: `firstFrameReady`, `gameReady`, `loadData`/`saveData`, `onPause`/`onResume`, `isAudioEnabled`/`onAudioEnabledChange`, `sendScore`, `health.logError`. Outside Playables it falls back to `localStorage` and page visibility. |

## Textless UI

No words or numbers are shown; text exists only as `aria-label`s for screen readers.

- **Position:** a gold, silver or bronze disc, plus three racer dots on a thin progress bar that ends in a checkered flag.
- **Vehicles:** three coloured tiles (green ground, blue water, sky air) showing the vehicle models. A tile dims when that vehicle can't move on the current terrain.
- **Forks:** a left chevron with a red/green gate lamp, and a wavy line with a right chevron for the bypass.
- **Screens:** a play button, a medal, and replay, next and sound icons. A grey medal means the race earned no credit because the player never switched vehicle.
- **Tutorial:** a pulsing tap ripple marks the best vehicle. It appears after 0.6 s in a slower vehicle on stages 1–3, after 2.5 s on later stages, and at once when the current vehicle can't move.

## Daily course

From stage 4, the first race of each day is that day's course. It has no marker, badge or special sound: to the player it is simply the next level after Play or Next. The course is generated on the device (`source/daily.mjs`), uses only unlocked vehicles, passes the same gates as the built-in levels, and never changes the journey. The engine still records a daily streak in the save, but nothing displays it.

## Sound

Every sound is tied to a real engine event, so the audio also teaches the game.

| Event | Sound |
|---|---|
| Vehicle switch | Whoosh, pop and sparkle, pitched per slot. Also a light vibration where supported. |
| Clean transition (engine `clean` credit) | Bright four-note "perfect" chime with a gold sparkle |
| Entering water, diving, taking off, landing | Splash, dive bubbles, whoosh, thud |
| A specialist reaching its own terrain | Monster truck crush, drill tunnel bore, rocket launch roar, glider soar |
| Plane, glider or rocket through its rings | Chime that climbs a pentatonic scale with each ring in a row |
| Overtake | Rising arpeggio |
| Checkpoint | Two-note chime |
| Gate ahead opens or closes | Blip or clack |
| Stuck in a vehicle that can't move | Repeating soft warning, with the hint ripple |
| Invalid tap | Low double bonk and a button shake |
| Race start, finish, medal reveal | "Go" sting, a fanfare sized to the place (confetti for gold), shimmer |

The engine hum runs under the music, and the music ducks under the fanfare. All levels were measured offline; peaks stay below −6 dB.

Audio starts on the first tap, as browsers require. It follows YouTube's audio switch, stops during a host pause, and has its own mute toggle on the title and pause screens.

## Ads

YouTube runs the pre-roll by itself. The game adds interstitials and one rewarded offer, using the engine's reservation, pacing and claim logic (`source/session.mjs`).

- **Interstitial** (`ytgame.ads.requestInterstitialAd`): only when the player taps Next after the medal. Never in stages 1–5, never right before a new vehicle's first race. The first one comes after 2 counted races and 2 minutes of racing; after that, at most one every 2 races and 2 minutes, and never within 2 minutes of any rewarded video.
- **Rewarded** (`ytgame.ads.requestRewardedAd`): one button on the medal screen. Its face shows the reward, with a red video mark.
  - After silver or bronze: retry, from the last checkpoint when gold is still reachable there (the engine's rematch), otherwise from the start. Retrying is only available through this button.
  - After gold: a one-race trial of the next locked vehicle family (the button shows that vehicle), alternating by stage with a new paint for the player's vehicles (the button shows the swatch). After all families unlock, only paint.
  - Nothing after a trial race, or after a race that earned no credit. Next is always free.
- **Outcomes:** an earned video grants the reward. A video closed early (`false`) grants nothing and spends the offer. If no ad is available (the call rejects, or there is no SDK, as in the preview), the reward is granted free, so retry always works. The engine saves the reservation before the ad and grants a reward only once.
- Game audio is held while any ad plays, separately from host pauses.
- YouTube marks its ads API as a public preview that may change. Confirm in the Playables Test Suite how it reports "no ad available" (this build assumes the promise rejects).

## Behaviour notes

- Boot order: first frame, then `firstFrameReady()`, then the save loads, then the title screen becomes interactive, then `gameReady()`.
- Input follows the brief:
  - Slot taps commit on release within 12 CSS px.
  - A horizontal swipe of 24 px or more picks a fork route.
  - Keys: `1`/`2`/`3` switch slots, arrows pick a route, `Enter`/`Space` triggers the primary action, `Escape` pauses.
- A host pause stops simulation and rendering, then saves. On resume the game shows the pause menu instead of dropping the player back into a moving race.
- After the player finishes, the opponents keep driving on a presentation-only copy of the race, so the result screen isn't a frozen frame. Credit and rank come only from the engine result.
- Ads are wired to YouTube's SDK; see **Ads** below.

## Not yet verified

The build has only been tested in headless Chromium with SwiftShader:
- races in all six families, portrait and landscape
- the save round trip
- the SDK call order and audio switch against a mocked `ytgame`
- interstitial on Next, and rewarded videos earned, skipped and unavailable, against a mocked `ytgame.ads`
- offline renders of every sound, measured for level and clipping

Still untested:
- real devices and frame rates
- the YouTube Playables Test Suite
- how the sounds feel on real phone speakers
- human playtesting
