# Shape Shifting: Vehicle Race — executable course QA

This is a presentation-independent engine and prebuilt content bank, with a diagnostic HTML surface. It is not a production game or a certified YouTube/Playgama release. Graphics remain unspecified. No real ads, SDK, accounts, external analytics or network calls run in the diagnostic.

The reproducible count is 3,989 ordinary courses, from 5,580 restricted support-sequence candidates. The 36 teaching stages reuse 21 exact bank layouts. Across teaching and ordinary content there are 4,004 geometric layouts but only **4,001 distinct decision structures** when distance, phase, modifier sign and seed changes do not create novelty. See `qa/product-count.json` and `docs/QA-RESULTS.md`.

Course families equip exactly three stable Ground / Water / Air slots and cover eight vehicles. A fixed 20 ms engine runs two clearly identified computer opponents. Ordinary progression selects prevalidated recipes with six-family bags, a 3/5/2 fork bag, recent-12 structural and recent-64 exact guards. Lookahead prevents incompatible bag combinations. There is no designed last journey stage, and there is no claim of infinite unique content.

## Reproduce

Use Node 24 and Python 3. The original test environment used Node v24.19.0 and JSDOM 26.1.0. Core simulation tests require no installed packages. DOM integration uses a locked development dependency:

```sh
npm ci --prefix .qa-deps --ignore-scripts --no-audit --no-fund
node tools/check-all.mjs
node --expose-gc tools/dom.mjs --soak --final
```

The last command takes ten elapsed minutes. It is synthetic DOM/event/RAF integration, not a native browser, physical touch or human-enjoyment test. Fixed button rectangles and pointer-capture stubs are disclosed in its report. The optional `--soak` flag on `check-all.mjs` includes the same run.

`python3 tools/package.py` creates a deterministic **diagnostic** ZIP with byte-identical repeated output. Extracted `runtime/index.html` contains the bank and original modules inline. Runtime data/source copies are also included for inspection. Source and QA dependencies are not shipped in the runtime ZIP. See `qa/package-report.json` for its file hashes.

## Evidence and limits

Primary evidence: `qa/course-audit.json`, `foundation-audit.json`, `unit-results.tap`, `end-to-end-report.json`, `stress-report.json`, `safety-report.json`, `dom-soak-final-report.json`, `performance-report.json`, `package-report.json`, and `product-count.json`.

Native browser downloads were unavailable, and browser security denied opening the local file. No alternative browser route was attempted after the rejection. Layout, native browser/device/YouTube-host operation, human enjoyment, comparative superiority, retention and revenue remain unverified. All 75 contract cases are assessed in `qa/acceptance-matrix.json`; partial model evidence does not become a native/host PASS. Do not submit the diagnostic ZIP as the game.

Live monetization proposal D is unapproved and disabled. Fixtures test optional rematch and next-family credits, timing, strict grants, failed saves, delayed callbacks and host-pause ordering. Production integration must use actual platform APIs and measured publisher data.

## Repository handoff

Added to Car-shift on 18 October 2026. The contract is `docs/PRODUCT-CONTRACT.txt` revision 5.0. The full result is in `docs/QA-RESULTS.md`. The repository contains the engine, course bank, authoring tools, tests and actual evidence. Diagnostic archive generation and report exports write to the local `artifacts/` directory; they do not publish or call a live ad service.

The earlier local-framework release check intentionally failed unresolved production gates; its recorded paths identify the original test workspace. The standalone commands above reproduce the implemented checks without that external framework. Native browser/device/YouTube-host and human enjoyment acceptance remain unverified.
