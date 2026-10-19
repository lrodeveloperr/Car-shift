import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {Catalog,Session,MemoryStorage,initialData} from '../source/session.mjs';
import {Race} from '../source/race.mjs';
import {FAMILIES,bestSlot} from '../source/rules.mjs';
import {dailyRecipe,DAILY_FROM} from '../source/daily.mjs';
const recipes=JSON.parse(fs.readFileSync(new URL('../runtime/data/bank.json',import.meta.url))).recipes;
const catalog=new Catalog(recipes);
const setup=async(options={})=>{const data=initialData();data.frontier=37;const storage=new MemoryStorage(JSON.stringify(data));const s=new Session(catalog,storage,options);assert.equal(await s.load(),true);return {s,storage};};
const finish=async(s,{latency=0}={})=>{await s.start({latency});while(!s.race.result&&s.race.ms<180000)s.step(20);assert.ok(s.race.result);await s.flush();};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

test('shared load exactly once and no writes before successful load',async()=>{const storage=new MemoryStorage();const s=new Session(catalog,storage);await assert.rejects(s.flush());await Promise.all([s.load(),s.load(),s.load()]);assert.equal(storage.reads,1);assert.equal(storage.writes,0);});
test('nonempty malformed, future, unknown, oversized and hostile saves are protected',async()=>{
 const bad=['broken','{"schema":2}','{"x":1}','x'.repeat(65536)];const d=initialData();d.frontier=-1;bad.push(JSON.stringify(d));
 for(const value of bad){const storage=new MemoryStorage(value);const s=new Session(catalog,storage);assert.equal(await s.load(),false);await assert.rejects(s.start());assert.equal(storage.value,value);assert.equal(storage.writes,0);}
});
test('empty SDK forms recognized; valid decoded object also accepted',async()=>{for(const value of [null,undefined,'','null','{}','[]',{},[],initialData()]){const s=new Session(catalog,new MemoryStorage(value));assert.equal(await s.load(),true,String(value));}});
test('genuine finish advances once, Bronze also advances, rematch does not duplicate',async()=>{
 const {s}=await setup();await finish(s,{latency:700});assert.equal(s.data.frontier,38);const before=s.data.pacing.firstFinishes;for(let i=0;i<10;i++)s.finalize();assert.equal(s.data.frontier,38);assert.equal(s.data.pacing.firstFinishes,before);
 if(s.race.checkpoints.length){const again=s.race.rematch();again.player.auto=true;again.player.latency=0;s.race=again;while(!s.race.result)s.step(20);assert.equal(s.data.frontier,38);assert.equal(s.data.pacing.firstFinishes,before);}
});
test('mid-race acknowledged reload restores exact race, queue and pacing',async()=>{
 const {s,storage}=await setup();await s.start({latency:0});for(let i=0;i<500;i++)s.step(20);await s.flush();const expected=JSON.stringify(s.snapshot());const next=new Session(catalog,storage);assert.equal(await next.load(),true);assert.equal(JSON.stringify(next.snapshot()),expected);
});
test('historical Replay survives reload without incrementing frontier',async()=>{
 const {s,storage}=await setup();await finish(s);const frontier=s.data.frontier;await s.next({replay:true,latency:0});for(let i=0;i<300;i++)s.step(20);await s.flush();
 const next=new Session(catalog,storage);assert.equal(await next.load(),true);while(!next.race.result)next.step(20);assert.equal(next.data.frontier,frontier);
});
test('dirty progress created after a pending acknowledgement stays dirty',async()=>{
 const {s,storage}=await setup();await s.start({latency:0});const gate=deferred();storage.save=async value=>{await gate.promise;storage.value=value;};
 const pending=s.flush();s.step(20);gate.resolve();await pending;assert.equal(s.unsaved,true);
});
test('pre-ad save failure suppresses the ad request and keeps free continuation',async()=>{
 let calls=0;const {s,storage}=await setup({enableAdFixtures:true,ads:{request:async()=>{calls++;return true;}}});await finish(s);
 s.data.pacing.firstFinishes=2;s.data.pacing.initialActive=120000;storage.fail=true;assert.equal(await s.requestAd('interstitial'),false);assert.equal(calls,0);storage.fail=false;await s.next({latency:0});assert.equal(s.race.state,'RACING');
});
test('interstitial first/later timing, AND conditions and failed-ad cooldown',async()=>{
 const {s}=await setup({enableAdFixtures:true,ads:{request:async()=>{throw new Error('no fill');}}});await finish(s);
 const p=s.data.pacing;p.firstFinishes=1;p.initialActive=120000;assert.equal(s.interstitialEligible(),false);p.firstFinishes=2;p.initialActive=119999;assert.equal(s.interstitialEligible(),false);p.initialActive=120000;assert.equal(s.interstitialEligible(),true);
 await s.requestAd('interstitial');assert.equal(p.firstAttempted,true);assert.equal(p.activeSinceAd,0);assert.equal(p.finishesSinceAd,0);assert.equal(s.interstitialEligible(),false);
});
test('reward strict true, single in-flight request, chosen queue replaces once',async()=>{
 for(const result of [true,false,undefined]){
  let calls=0;const gate=deferred();const {s}=await setup({enableAdFixtures:true,ads:{request:()=>{calls++;return gate.promise;}}});await finish(s);
  const before=[...s.data.queue],family=(catalog.map.get(before[0])[1]+1)%6,offer=s.setOffer(family);assert.ok(offer);
  const pending=s.requestAd('set',offer);await new Promise(r=>setTimeout(r,0));assert.equal(await s.requestAd('set',offer),false);gate.resolve(result);await pending;assert.equal(calls,1);
  if(result===true){assert.equal(s.data.claim.kind,'set');await s.consumeClaim();assert.equal(s.data.queue[0],offer.id);assert.deepEqual(s.data.queue.slice(1),before.slice(1));assert.equal(await s.consumeClaim(),false);}
  else{assert.equal(s.data.claim,null);assert.deepEqual(s.data.queue,before);}
 }
});
test('reward settlement during host pause defers writes and does not release host',async()=>{
 const gate=deferred();const {s,storage}=await setup({enableAdFixtures:true,ads:{request:()=>gate.promise}});await finish(s);
 const offer=s.setOffer((catalog.map.get(s.data.queue[0])[1]+1)%6);const pending=s.requestAd('set',offer);await new Promise(r=>setTimeout(r,0));s.pauseHost();const writes=storage.writes;gate.resolve(true);assert.equal(await pending,'deferred');assert.equal(storage.writes,writes);assert.equal(s.data.claim,null);assert.ok(s.race.pauses.has('host'));await s.resumeHost();assert.equal(s.data.claim.kind,'set');
});
test('late reward cannot rewind a newer started race',async()=>{
 const gate=deferred();const {s}=await setup({enableAdFixtures:true,ads:{request:()=>gate.promise}});await finish(s);
 const offer=s.setOffer((catalog.map.get(s.data.queue[0])[1]+1)%6);const pending=s.requestAd('set',offer);await new Promise(r=>setTimeout(r,0));assert.equal(s.keepPlaying(),false);s.advanceAdWait(10000);assert.equal(s.keepPlaying(),true);await s.next({latency:0});const serial=s.race.serial;gate.resolve(true);await pending;assert.equal(s.race.serial,serial);assert.equal(s.race.state,'RACING');assert.equal(s.data.claim.kind,'set');assert.equal(await s.consumeClaim(),false);
});
test('host pause before bootstrap defers initial storage read',async()=>{
 const storage=new MemoryStorage(),s=new Session(catalog,storage);s.pauseHost();const boot=s.load();await new Promise(r=>setTimeout(r,0));assert.equal(storage.reads,0);await s.resumeHost();assert.equal(await boot,true);assert.equal(storage.reads,1);
});

test('concurrent Next and Restart have one run transaction',async()=>{
 const {s}=await setup();await finish(s);const serial=s.data.nextSerial;
 await Promise.all([s.next({latency:0}),s.next({latency:0}),s.next({latency:0})]);assert.equal(s.race.serial,serial);assert.equal(s.data.nextSerial,serial+1);
 const before=s.data.nextSerial;await Promise.all([s.restart({latency:0}),s.restart({latency:0})]);assert.equal(s.data.nextSerial,before+1);
});
test('ad wait excludes host pause and typed offers cannot be forged',async()=>{
 let calls=0;const gate=deferred();const {s}=await setup({enableAdFixtures:true,ads:{request:()=>{calls++;return gate.promise;}}});await finish(s);
 const offer=s.setOffer((catalog.map.get(s.data.queue[0])[1]+1)%6);assert.ok(offer);
 assert.equal(await s.requestAd('set',{...offer,id:'C00000'}),false);assert.equal(calls,0);
 const pending=s.requestAd('set',offer);await new Promise(r=>setTimeout(r,0));s.pauseHost();s.advanceAdWait(60000);assert.equal(s.keepPlaying(),false);await s.resumeHost();s.advanceAdWait(9999);assert.equal(s.keepPlaying(),false);s.advanceAdWait(1);assert.equal(s.keepPlaying(),true);gate.resolve(false);await pending;
});
test('best foundation record survives a slower replay and record history uses LRU',async()=>{
 const {s}=await setup();await finish(s);const first={...s.data.records[0]};s.data.records.push({...first,id:recipes[20][0]});s.record({...s.race.result,time:first.time+1000});assert.equal(s.data.records.at(-1).id,first.id);assert.equal(s.data.records.at(-1).time,first.time);
});
test('hostile entrant profiles, positions, choices, nested checkpoints and record arrays stay protected',async()=>{
 const {s}=await setup();await s.start({latency:0});for(let i=0;i<1000;i++)s.step(20);const base=s.snapshot();
 const mutations=[d=>d.run.entrants[1].profile.factor=2,d=>d.run.entrants[0].pos=599,d=>d.run.entrants[0].choice=8,d=>d.run.entrants[0].planned={'999':0},d=>d.run.entrants[0].reaction=-1,d=>d.run.checkpoints=[{...structuredClone(d.run),checkpoints:[structuredClone(d.run)]}],d=>d.foundationRecords=Object.fromEntries(Array.from({length:40},(_,i)=>['F'+i,{rank:1,time:2}])),d=>d.pacing.consumed=[-1]];
 for(const mutate of mutations){const d=structuredClone(base);mutate(d);const raw=JSON.stringify(d),storage=new MemoryStorage(raw),next=new Session(catalog,storage);assert.equal(await next.load(),false);assert.equal(storage.writes,0);assert.equal(storage.value,raw);}
});

test('ad fixture cannot be called until reservation save is acknowledged',async()=>{let calls=0;const {s,storage}=await setup({enableAdFixtures:true,ads:{request:async()=>{calls++;return false;}}});await finish(s);s.data.pacing.firstFinishes=2;s.data.pacing.initialActive=120000;const ack=deferred();storage.save=async value=>{await ack.promise;storage.value=value;};const pending=s.requestAd('interstitial');await new Promise(r=>setTimeout(r,0));assert.equal(calls,0);assert.ok(s.data.adPending);ack.resolve();await pending;assert.equal(calls,1);});

test('later vehicle families debut on their unlock stage and six-family saves migrate',async()=>{
 const data=initialData();data.frontier=37;data.familyCursor=[0,0,0,0,0,0];const s=new Session(catalog,new MemoryStorage(JSON.stringify(data)));assert.equal(await s.load(),true,s.error);
 assert.equal(s.data.familyCursor.length,FAMILIES.length);
 const seen=[];
 while(s.data.frontier<=68){
  const family=catalog.map.get(s.data.queue[0])[1],debut=FAMILIES.findIndex(f=>f.unlock===s.data.frontier);
  if(debut>=0)assert.equal(family,debut,`stage ${s.data.frontier}`);
  assert.ok(FAMILIES[family].unlock<=s.data.frontier,`locked family at ${s.data.frontier}`);seen.push(family);
  await finish(s);
 }
 for(let i=1;i<seen.length;i++)assert.notEqual(seen[i],seen[i-1]);
 assert.equal(new Set(seen).size,FAMILIES.length);
 const locked=s.setOffer(FAMILIES.length);assert.equal(locked,null);
});

test('daily course: same recipe for the same day and family, fresh geometry, passes every gate',()=>{
 const a=dailyRecipe('2026-10-19',3),b=dailyRecipe('2026-10-19',3),c=dailyRecipe('2026-10-20',3);
 assert.deepEqual(a,b);assert.notDeepEqual(a.slice(1),c.slice(1));assert.equal(a[0],'D2026-10-19.3');assert.ok(a[7]>=16);
 assert.equal(dailyRecipe('not-a-day',0),null);assert.equal(dailyRecipe('2026-10-19',99),null);
});
// Steers with the fastest legal vehicle, like the end-to-end tool, so restored races finish from any point.
const drive=sess=>{while(!sess.race.result&&sess.race.ms<180000){const r=sess.race,e=r.player,leg=r.course.blocks[e.block]?.options[e.choice];if(leg&&e.slot!==bestSlot(r.course.family,leg))r.commandSlot(bestSlot(r.course.family,leg));sess.step(20);}assert.ok(sess.race.result);};
test('daily course is offered once per day from stage 4, never moves the journey, and builds a streak',async()=>{
 const early=initialData();early.frontier=DAILY_FROM-1;const e=new Session(catalog,new MemoryStorage(JSON.stringify(early)));await e.load();assert.equal(e.dailyAvailable('2026-10-19'),null);
 const {s,storage}=await setup();const queue=[...s.data.queue],frontier=s.data.frontier,history=[...s.data.history],records=s.data.records.length;
 const id=s.dailyAvailable('2026-10-19');assert.match(id,/^D2026-10-19\.\d+$/);assert.ok(FAMILIES[Number(id.split('.')[1])].unlock<=frontier);
 await s.startDaily('2026-10-19');assert.equal(s.race.origin,'daily');for(let i=0;i<600;i++)s.step(20);await s.flush();
 const reloaded=new Session(catalog,storage);assert.equal(await reloaded.load(),true,reloaded.error);assert.equal(reloaded.race.course.id,id);
 drive(reloaded);await reloaded.flush();
 assert.equal(reloaded.data.frontier,frontier);assert.deepEqual(reloaded.data.queue,queue);assert.deepEqual(reloaded.data.history,history);assert.equal(reloaded.data.records.length,records);
 assert.deepEqual({last:reloaded.data.daily.last,streak:reloaded.data.daily.streak},{last:'2026-10-19',streak:1});assert.equal(reloaded.dailyAvailable('2026-10-19'),null);
 await reloaded.next({latency:0,day:'2026-10-19'});assert.equal(reloaded.race.origin,'journey');assert.equal(reloaded.race.course.id,queue[0]);
 drive(reloaded);
 await reloaded.next({latency:0,day:'2026-10-20'});assert.equal(reloaded.race.origin,'daily');drive(reloaded);
 assert.equal(reloaded.data.daily.streak,2);
 await reloaded.next({latency:0,day:'2026-10-22'});drive(reloaded);assert.equal(reloaded.data.daily.streak,1);
 await reloaded.restart({latency:0});assert.equal(reloaded.race.origin,'daily');
 const next=new Session(catalog,new MemoryStorage((()=>{const d=JSON.parse(storage.value);delete d.daily;return JSON.stringify(d);})()));assert.equal(await next.load(),true,next.error);assert.equal(next.data.daily.streak,0);
});
