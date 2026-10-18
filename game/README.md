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

The initial bundle is about 960 KB raw and **about 243 KB gzipped**. That includes three.js, the engine and all 4,025 courses. There are no models, textures or fonts to fetch, and no network calls other than the YouTube SDK script.

## Layout

| File | Role |
|---|---|
| `src/track.mjs` | Pure math, no three.js: maps an engine `block/choice/pos` to lane coordinates. Fork bypasses wiggle so their drawn length matches the engine leg to within 0.3%, so equal speeds look equal on screen. |
| `src/world.mjs` | Scene: terrain slabs, low-poly animated water, roads, rails, gates, flight hoops, scenery, particles and the chase camera. One merged mesh draws the track; props are instanced. |
| `src/vehicles.mjs` | The eight vehicles, built from primitives. Geometry is baked once and shared by all three entrants. |
| `src/main.mjs` | Boot, the fixed-tick loop with render interpolation, HUD, input, pause and dynamic resolution. |
| `src/host.mjs` | `ytgame` adapter: `firstFrameReady`, `gameReady`, `loadData`/`saveData`, `onPause`/`onResume`, `sendScore`, `health.logError`. Outside Playables it falls back to `localStorage` and page visibility. |

## Behaviour notes

- Boot order: first frame, then `firstFrameReady()`, then the save loads, then the title screen becomes interactive, then `gameReady()`.
- Input follows the brief:
  - Slot taps commit on release within 12 CSS px.
  - A horizontal swipe of 24 px or more picks a fork route.
  - Keys: `1`/`2`/`3` switch slots, arrows pick a route, `Enter`/`Space` triggers the primary action, `Escape` pauses.
- A host pause stops simulation and rendering, then saves. On resume the game shows the pause menu instead of dropping the player back into a moving race.
- After the player finishes, the opponents keep driving on a presentation-only copy of the race, so the result screen isn't a frozen frame. Credit and rank come only from the engine result.
- Ads are not wired. The engine's ad fixtures stay disabled (`enableAdFixtures: false`).

## Not yet verified

The build has only been tested in headless Chromium with SwiftShader:
- races in all six families, portrait and landscape
- the save round trip
- the SDK call order against a mocked `ytgame`

Still untested:
- real devices and frame rates
- the YouTube Playables Test Suite
- audio (there isn't any yet)
- human playtesting
