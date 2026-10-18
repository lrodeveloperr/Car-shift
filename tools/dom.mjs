import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {performance} from 'node:perf_hooks';
import {JSDOM,VirtualConsole} from '../.qa-deps/node_modules/jsdom/lib/api.js';
const began=performance.now(),source=fs.readFileSync('runtime/index.html','utf8');
const report={scope:'JSDOM code/event integration ONLY; not a native browser, layout, device, YouTube host or human playtest',adapter:'Wrap the exact standalone module code in an async function; inject clone/encoder, pointer-capture stubs and fixed button rectangles. No external requests.',harnessSha256:crypto.createHash('sha256').update(source).digest('hex'),jsdomVersion:'26.1.0',nodeVersion:process.version,cases:[],errors:[],soak:null,nodeHeapSamples:[]};
const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>report.errors.push(e.message));
const html=source.replace('<script type="module">','<script>(async()=>{').replace('</script>',`;window.__qa={action:qaAction,session:()=>qaSession,evidence:qaEvidence,render:qaRender};})().catch(e=>{window.__fatal=String(e.stack)});</script>`);
const dom=new JSDOM(html,{url:'https://standalone-qa.invalid',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole,beforeParse(w){
 Object.defineProperty(w.performance,'memory',{get:()=>({usedJSHeapSize:process.memoryUsage().heapUsed})});w.structuredClone=structuredClone;w.TextEncoder=TextEncoder;w.Element.prototype.setPointerCapture=function(){};w.Element.prototype.releasePointerCapture=function(){};
 w.Element.prototype.getBoundingClientRect=function(){return {left:0,top:0,right:200,bottom:60,width:200,height:60,x:0,y:0};};
}});
const w=dom.window,d=w.document;const wait=ms=>new Promise(r=>setTimeout(r,ms));
for(let i=0;i<100&&!w.__qa&&!w.__fatal;i++)await wait(10);assert.ok(w.__qa,w.__fatal??'no boot');
const api=w.__qa,check=name=>report.cases.push({name,status:'PASS'}),click=async(selector)=>{d.querySelector(selector).dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:0}));await wait(0);};
function pointer(type,target,id=1,x=10,y=10,extra={}){const e=new w.MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0,...extra});Object.defineProperty(e,'pointerId',{value:id});target.dispatchEvent(e);}
try{
 assert.match(d.getElementById('status').textContent,/ready/);assert.equal(api.session().loaded,true);check('boot -> load before Play; semantic status');
 await click('#play');let s=api.session(),r=s.race;assert.equal(r.state,'RACING');assert.match(d.getElementById('slot0').textContent,/car/);check('DOM Play dispatches a saved Journey race');
 // A press is inert until an in-bounds release; the extra pointer and follow-up native-style click do not duplicate it.
 const water=d.getElementById('slot1');let before=api.evidence.nativeActions;
 pointer('pointerdown',water);assert.equal(r.pendingSlot,null);pointer('pointerdown',d.getElementById('slot2'),2);pointer('pointerup',water,2);assert.equal(r.pendingSlot,null);pointer('pointerup',water);assert.equal(r.pendingSlot,1);
 water.dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:1}));assert.equal(api.evidence.nativeActions,before+1);s.step(20);assert.equal(r.player.slot,1);check('one owner, release-only slot commit and no click duplication');
 for(const type of ['pointercancel','lostpointercapture','resize']){
  r.pendingSlot=null;pointer('pointerdown',water);if(type==='resize')w.dispatchEvent(new w.Event(type));else pointer(type,water);pointer('pointerup',water);assert.equal(r.pendingSlot,null);
 }check('cancel, lost capture and resize cancel an uncommitted gesture');
 r.pendingSlot=null;pointer('pointerdown',water);pointer('pointercancel',water,2);pointer('pointerup',water);assert.equal(r.pendingSlot,1);r.pendingSlot=null;check('unrelated extra-finger cancellation does not cancel the owner');
 pointer('pointerdown',water);pointer('pointerup',water,1,35,10);assert.equal(r.pendingSlot,null);pointer('pointerdown',water);pointer('pointerup',water,1,250,10);assert.equal(r.pendingSlot,null);check('movement over 12 px and release outside cancel');
 pointer('pointerdown',water);await click('#pause');pointer('pointerup',water);assert.equal(r.pendingSlot,null);const frozen=r.ms;s.step(30000);assert.equal(r.ms,frozen);await click('#pause');check('pause cancels the held gesture and freezes the race');
 d.dispatchEvent(new w.KeyboardEvent('keydown',{bubbles:true,key:'1'}));assert.equal(r.pendingSlot,0);r.pendingSlot=null;d.dispatchEvent(new w.KeyboardEvent('keydown',{bubbles:true,key:'2',repeat:true}));assert.equal(r.pendingSlot,null);check('keyboard slot action and repeat suppression');
 r.player.auto=true;r.player.latency=250;while(!r.result)s.step(20);api.render();assert.equal(d.getElementById('next').disabled,false);assert.match(d.getElementById('terrain').textContent,/Gold|Silver|Bronze/);check('genuine finish -> rank/payoff -> enabled Next');
 const frontier=s.data.frontier,serial=s.data.nextSerial;await click('#replay');r=s.race;assert.equal(r.origin,'replay');r.player.auto=true;r.player.latency=250;while(!r.result)s.step(20);api.render();assert.equal(s.data.frontier,frontier);await click('#next');assert.equal(s.data.nextSerial,serial+2);check('DOM Replay does not clear frontier; Next starts one genuine run');
 for(let family=0;family<6;family++){d.getElementById('family').value=String(family);await click('#play');r=s.race;r.player.auto=true;r.player.latency=250;while(!r.result)s.step(20);api.render();assert.match(d.getElementById('terrain').textContent,/Rank/);}
 check('all six families and all eight vehicles complete through DOM-dispatched Play/results');
 for(let i=0;i<50;i++){await api.action('play');await s.restart({latency:250});}check('50 restart transitions without additional document listeners');
 await api.action('save');const raw=w.localStorage.getItem('shape-shifting-level-audit-preview-v1');assert.ok(raw);assert.ok(Buffer.byteLength(raw)<32768);check('DOM save action persists bounded acknowledged state');
 if(process.argv.includes('--soak')){
  await api.action('reset',37);global.gc?.();await api.action('soak');let lastUpdate=performance.now(),lastHeap=performance.now();report.nodeHeapSamples.push({wallMs:0,postGcHeap:process.memoryUsage().heapUsed});
  while(!api.evidence.soak?.complete){await wait(1000);if(performance.now()-lastHeap>=60000){lastHeap=performance.now();global.gc?.();report.nodeHeapSamples.push({wallMs:api.evidence.soak?.wallMs??0,postGcHeap:process.memoryUsage().heapUsed});}if(performance.now()-lastUpdate>=30000){lastUpdate=performance.now();console.log(JSON.stringify({soak:api.evidence.soak}));}if(performance.now()-began>660000)throw new Error('soak timeout');}
  report.soak={...api.evidence.soak,method:'600000 ms elapsed wall time, real JSDOM RAF callbacks, 4x simulated controls; not interactive/native browser',nodeHeap:process.memoryUsage().heapUsed};assert.ok(report.soak.transitions>=50);assert.equal(report.soak.errors,0);check('ten elapsed minutes and >=50 synthetic race transitions under DOM RAF');
 }
 assert.deepEqual([...api.evidence.errors],[]);assert.deepEqual(report.errors,[]);report.passed=true;
} catch(e){report.passed=false;report.failure=String(e.stack);process.exitCode=1;}finally{report.durationSeconds=(performance.now()-began)/1000;dom.window.close();fs.writeFileSync(process.argv.includes('--final')?'qa/dom-soak-final-report.json':'qa/dom-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
