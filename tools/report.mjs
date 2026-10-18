import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const read=name=>JSON.parse(fs.readFileSync(`qa/${name}.json`));const a=read('course-audit'),f=read('foundation-audit'),e=read('end-to-end-report'),s=read('stress-report'),safe=read('safety-report'),count=read('product-count'),pack=read('package-report'),dom=read('dom-soak-final-report'),accept=read('acceptance-matrix');
if(!a.counts.accepted||!e.passed||!s.passed||!safe.passed||!dom.passed||!dom.soak?.complete)throw new Error('An asserted primary test has not completed/passed');
const fmt=n=>n.toLocaleString('en-US'),seconds=n=>(n/1000).toFixed(2);const units=fs.readFileSync('qa/unit-results.tap','utf8');if(!/# fail 0\n/.test(units))throw new Error('Unit failure');const unitCount=Number(units.match(/# tests (\d+)/)[1]);
const harnessHash=crypto.createHash('sha256').update(fs.readFileSync('runtime/index.html')).digest('hex');if(dom.harnessSha256!==harnessHash)throw new Error('Soak used a different harness');
const heap=dom.nodeHeapSamples.map(x=>x.postGcHeap);const report=`# Shape Shifting: Vehicle Race — tested product count

18 October 2026. Scope: executable course/engine and standalone diagnostic QA. This is **not a production release or a proven 10/10 experience**.

**${fmt(count.ordinaryAuditedCourses)} ordinary race courses pass the implemented automated gates. Including teaching, the conservative total is ${fmt(count.distinctDecisionStructures)} distinct decision structures.**

The36-stage teaching journey contains12 structures additional to the ordinary bank. Twenty-one teaching stages reuse exact bank layouts; three other teaching layouts differ only in timing/length under this conservative count. The raw geometric total4004 is not the headline. No seed, color, distance, phase or modifier-sign change alone creates a new decision structure. The restricted authoring grammar is not a mathematical upper limit on all possible game levels.

## What passed

| Check | Actual result |
|---|---|
| Offline authoring | ${fmt(a.counts.rawCandidates)} restricted sequence candidates; ${fmt(a.counts.accepted)} admitted, ${fmt(a.counts.rejected)} rejected; <=16 geometries tried per non-motif candidate |
| Ordinary race audit | ${fmt(a.counts.fullRaceSimulations)} entrant simulations plus ${fmt(a.counts.routeSimulations)} alternate-route simulations; all admitted branches finish |
| Teaching | ${f.count} stages; all intended introductions have a useful switch within five simulated seconds; all perfect controllers can win |
| Unit/session/boundary tests | ${unitCount}/${unitCount} pass |
| Command-level integrated races | ${fmt(e.runs)} full races across both difficulties, each with exact mid-race acknowledged reload; ${fmt(e.firstPlace)} lawful Gold finishes |
| Actual legal command API, all branches | ${fmt(e.allRoutesThroughCommandAPI)} route completions; poorer routes may lose |
| Selection-seed stress |10,000 seeds per family; ${fmt(s.profileCases)} difficulty-profile cases, ${fmt(s.simulations)} entrant simulations and ${fmt(s.routeChecks)} independent selected-path checks; zero seed failures |
| Saved progression | ${fmt(s.sequence.stages)} stages -> frontier${fmt(s.sequence.finalFrontier)}, ${s.sequence.reloads} exact reloads,64-record eviction, all36 teaching records retained |
| Variety | First100 ordinary stages: ${s.sequence.first100.distinctLayouts} distinct layouts/structures and all six families; recent12 structure/recent64 layout guards hold |
| Scheduling | ${s.sequence.familyBlocks} full six-family blocks and ${s.sequence.forkBlocks} full3/5/2 fork blocks hold; no scheduling dead end |
| Complete-state save fixture | ${fmt(safe.completeSaveBytes)} UTF-8 bytes /32768budget:64 records,36 teaching records, history64, signatures12, queue3, two checkpoints and one typed rematch |
| Read/save/ad faults |20 failed read retries -> zero writes to unread source; pre-ad ack/failure, strict earned results, single-flight requests, pause ordering and late claims tested |
| Synthetic DOM input | ${dom.cases.length} handler/flow cases passed with disclosed capture/rectangle adapters |
| Ten-minute synthetic DOM RAF soak | ${(dom.soak.wallMs/1000).toFixed(1)} elapsed seconds, ${dom.soak.transitions} race transitions, ${dom.soak.errors} errors |
| Node heap during soak | Post-GC samples ${(Math.min(...heap)/1048576).toFixed(2)}–${(Math.max(...heap)/1048576).toFixed(2)} MiB; final${(heap.at(-1)/1048576).toFixed(2)} MiB; bounded diagnostic run, not a browser/device memory claim |
| Deterministic diagnostic ZIP | Two byte-identical builds; ${fmt(pack.archiveBytes)} archive bytes and ${fmt(pack.expandedRuntimeBytes)} expanded bytes; both below5,000,000 |

The ten-minute run uses real elapsed wall time and JSDOM RAF callbacks with a4x synthetic controller. Its fixed rectangle/pointer-capture adapters do not measure native gestures, CSS geometry, accessibility, rendering or human play. It includes no actual ad impressions. Only this final harness-hash-matched run is current evidence; earlier attempt logs are historical.

## Course mix and fairness

| Family | Ordinary courses | Equipped Ground / Water / Air |
|---|---:|---|
| Coastal |986|Car / Boat / Helicopter|
| Rough |984|Dirt bike / Boat / Helicopter|
| Rail |932|Train / Boat / Helicopter|
| Snow |986|Snowmobile / Boat / Helicopter|
| Deep water |50|Car / Submarine / Helicopter|
| Flight |51|Car / Boat / Plane|

Exactly three stable one-finger controls are active in each race. All eight transport types have actual rules. Plane courses have legal runway connections and >=72-unit corridors; underwater courses enter/exit through surface water. All ordinary paths pass maximum-speed cue, safe checkpoint, length, wait and finish-support rules. Courses have4–10legs and at most two forks. Teaching1/2/3/6 explicitly use shorter20–26-second exceptions. Introductory terrain-choice forks are teaching/recovery tradeoffs; they are not included in the ordinary phase-dependent gate-pair claim.

Both computer opponents use the same course, gate and compatibility rules. Standard post-foundation speed factors are0.94/0.98; optional Expert is0.98/1.00, with fixed reactions and seeded mistakes. Their profiles do not depend on player position or ads. A lawful best run can win; bad branches need not win. Losing still permits a genuine finish, medal and free ordinary continuation.

Median ordinary perfect completion is${seconds(a.stats.perfectMs.median)}simulated seconds; the range is${seconds(a.stats.perfectMs.min)}–${seconds(a.stats.perfectMs.max)}seconds. Synthetic250ms switches produce Standard ranks${a.syntheticRanks.competent.join('/')} (Gold/Silver/Bronze); synthetic450ms switches plus one700ms mistake produce${a.syntheticRanks.novice.join('/')}. These are controller assumptions, not human skill distributions or retention measurements.

## What “enjoyable” means here

The checks reject mechanical failure modes: repeated2/3-symbol motifs, long decision gaps, one form dominating travel, unsupported specialty connections, invalid checkpoint placement, unusable branches, unreachable routes and impossible Gold. They establish plausible, coherent race content under the declared rules.

**No automated test establishes enjoyment, engagement, comparative superiority or monetization.** Final presentation and real play could still reveal confusing specialty slots, repetitive rhythms, weak perceived competition or unsatisfying feedback. The planned adult novice/comparator preference gate in the contract has NOT RUN. No acquisition, retention, served-ad, eCPM or developer-net revenue result exists for this candidate.

## Remaining acceptance

Native browser engines could not be installed: the official download returned an unavailable HTML page. Browser security rejected opening the local QA file. No alternate browser route was attempted after that rejection. Consequently native Chromium/Firefox/WebKit/Edge, CSS/viewport/layout, physical Android/iOS, genuine YouTube SDK/cloud/ads/mute and host certification remain BLOCKED or NOT RUN. Graphics remain unspecified; the semantic diagnostic is not the game's final presentation. Ten production locales/accessibility/comparator tests are not certified.

All75 contract cases are assessed: ${accept.statusCounts.PASS} PASS in their stated standalone sub-scope, ${accept.statusCounts['NOT RUN']} NOT RUN for their complete required method, and${accept.statusCounts['N/A']} inapplicable to this diagnostic revision. A standalone PASS is not production acceptance. The local-framework release check is expected to retain these blockers. There is no publish/promote action.

Proposal D remains disabled by default and fixture-only. It tests first/later2finishes AND 120 active-second guards and optional rematch/next-family credits. There are no real SDK or ad calls, no account/backend, no personal data or external analytics. A crash between an unreceipted host completion and durable reward acknowledgement can lose that reward; host receipt/reconciliation cannot be promised by these fixtures.

## Reproduce and inspect

See README.md and tools/check-all.mjs. The source package contains all original modules, bank/teaching recipes, offline authoring, independent solver, fixtures, locked DOM development dependencies, test commands and machine-readable evidence. Runtime files contain no external dependencies or requests.

Diagnostic ZIP SHA-256: ${pack.sha256}
Bank SHA-256: ${a.sha256}
Final soak harness SHA-256: ${dom.harnessSha256}

These hashes identify the diagnostic artifacts, not a submitted game. The source archive includes a separate hash manifest. The canonical contract is revision5.0.
`;
const readable=report.split('\n').map(line=>line.includes('SHA-256:')?line:line.replace(/([a-z])(\d)/g,'$1 $2').replace(/(\d)([A-Za-z])/g,'$1 $2')).join('\n');fs.writeFileSync('docs/QA-RESULTS.md',readable);fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync(path.join('artifacts','shape-shifting-vehicle-race-qa-report.md'),readable);console.log(JSON.stringify({ordinary:count.ordinaryAuditedCourses,decisionStructures:count.distinctDecisionStructures,unitTests:unitCount,soak:dom.soak.transitions,bytes:Buffer.byteLength(report)}));
