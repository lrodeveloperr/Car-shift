import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Race,simulateEntrant} from '../source/race.mjs';
import {expand,quality,patterns,buildRecipe,repetitive} from '../source/content.mjs';
import {referenceCourse,referenceLeg,gateTradeoffs} from '../source/solver.mjs';
import {speed,bestSlot,FAMILIES,SPEEDS} from '../source/rules.mjs';
const recipes=JSON.parse(fs.readFileSync(new URL('../runtime/data/bank.json',import.meta.url))).recipes;
const c=()=>expand(recipes.find(r=>r[2].length>=6&&r[5].length));
const straight=(family,ts,ds)=>expand(['FIXTURE',family,ts,ds,[],[],19,0]);
test('12843 restricted structural candidates (5580 for the original six families), not multiplied length/seed copies',()=>{const all=[...patterns()];assert.equal(all.length,12843);assert.equal(all.filter(p=>p.family<6).length,5580);});
test('known 20-second traversal agrees with independently derived switch cost',()=>{
 const level=straight(0,'GWG',[60,120,60]),reference=referenceCourse(level)[0].time;
 assert.equal(reference,20000);const e=simulateEntrant(level,'player',{latency:0});
 assert.ok(Math.abs(e.finish-(20000+2*20*(1-4/12)))<.0001);assert.equal(e.validTransforms,2);
});
test('every shipped course is unique and passes static content gates',()=>{const keys=new Set();for(const r of recipes){const x=expand(r);assert.ok(quality(x).ok,r[0]);const key=JSON.stringify(r.slice(1,6));assert.ok(!keys.has(key));keys.add(key);}});
test('speed matrix key boundary cases and specialized transport identities',()=>{
 assert.equal(speed(0,0,{t:'A'}),0);assert.equal(speed(2,0,{t:'T'}),18);assert.equal(speed(2,0,{t:'L'}),0);
 assert.equal(speed(5,2,{t:'F'}),18);assert.equal(speed(5,2,{t:'A'}),0);assert.equal(speed(5,2,{t:'F',m:'wind',dir:1}),21.599999999999998);
 assert.equal(speed(4,1,{t:'U'}),12);assert.equal(speed(4,2,{t:'U'}),0);assert.equal(speed(1,0,{t:'R'}),12);
 assert.equal(new Set(FAMILIES.flatMap(f=>f.vehicles)).size,14);
});
test('invalid airborne/submerged transforms keep safe vehicle, never buffer',()=>{
 for(const [f,ts,ds,special]of [[0,'GAG',[36,72,36],'A'],[4,'WUW',[36,96,36],'U'],[5,'LFL',[36,72,36],'F']]){
  const r=new Race(straight(f,ts,ds),{latency:0});while(r.course.blocks[r.player.block]?.options[0].t!==special||r.player.pos<1)r.tick();
  const selected=r.player.slot;for(let slot=0;slot<3;slot++)if(speed(f,slot,{t:special})===0)assert.equal(r.commandSlot(slot),false);
  assert.equal(r.player.slot,selected);assert.equal(r.pendingSlot,null);while(!r.result)r.tick();assert.equal(r.result.rank,1);
 }
});
test('unsupported train at non-rail support cannot be selected',()=>{const r=new Race(straight(2,'WTAW',[60,108,72,60]));assert.equal(r.commandSlot(0),false);assert.equal(r.player.slot,1);});
test('fixed simultaneous clocks, slow-frame record penalty and overlapping pause',()=>{
 const r=new Race(c());r.frame(1000);assert.equal(r.ms,100);assert.equal(r.stopwatch,1000);
 r.pause('host');r.pause('menu');const before=JSON.stringify(r.snapshot());r.frame(30000);assert.equal(JSON.stringify(r.snapshot()),before);
 r.resume('menu');r.frame(1000);assert.equal(r.ms,100);assert.equal(r.commandSlot(1),false);r.resume('host');r.frame(20);assert.equal(r.ms,120);
});
test('AI trace is independent of player actions and interruptions to player choices',()=>{
 const slow=new Race(c()),fast=new Race(c(),{latency:0});
 for(let i=0;i<1000;i++){slow.tick();fast.tick();}
 assert.deepEqual(slow.entrants.slice(1),fast.entrants.slice(1));
});
test('safe checkpoints restore every entrant and do not recursively grow',()=>{
 const r=new Race(c(),{latency:0});while(!r.result)r.tick();assert.ok(r.checkpoints.length);
 for(const cp of r.checkpoints){assert.deepEqual(cp.checkpoints,[]);const a=Race.restore(cp),b=Race.restore(cp);for(let i=0;i<100;i++){a.tick();b.tick();}assert.deepEqual(a.snapshot(),b.snapshot());}
});
test('player finishes even when both rivals already crossed; Bronze is settled',()=>{
 const r=new Race(c(),{latency:1500});while(!r.result&&r.ms<120000)r.tick();assert.ok(r.result);assert.equal(r.result.rank,3);assert.equal(r.result.genuine,true);
 const snap=JSON.stringify(r.snapshot());for(let i=0;i<20;i++)r.tick();assert.equal(JSON.stringify(r.snapshot()),snap);
});
test('future forks accept one choice; committed and past forks do not change',()=>{
 const level=c(),r=new Race(level);const index=level.blocks.findIndex(b=>b.options.length===2);assert.ok(index>0);
 assert.equal(r.chooseBranch(index,1),true);assert.equal(r.chooseBranch(index,2),false);
 r.player.auto=true;r.player.latency=0;while(r.player.block<index)r.tick();assert.equal(r.player.choice,1);assert.equal(r.chooseBranch(index,0),false);
});
test('all gate bypasses have a real phase-dependent time advantage',()=>{for(const r of recipes){for(const g of gateTradeoffs(expand(r)))assert.equal(g.bothUseful,true,r[0]);}});
test('motif filter rejects long repeats while preserving legitimate short two-form races',()=>{assert.equal(repetitive('GWGWGW'),true);assert.equal(repetitive('GWAGWAGWA'),true);assert.equal(repetitive('GWGW'),false);});
test('serialized race keeps replay origin and once-only assisted commit',()=>{
 const r=new Race(c());r.origin='replay';r.assistedCommitted=true;const restored=Race.restore(JSON.parse(JSON.stringify(r.snapshot())));
 assert.equal(restored.origin,'replay');assert.equal(restored.assistedCommitted,true);
});

test('snapshot at the exact checkpoint tick restores without rejecting its equal timestamp',()=>{const r=new Race(c(),{latency:0});while(!r.checkpoints.length)r.tick();assert.equal(r.ms,r.checkpoints[0].ms);assert.deepEqual(Race.restore(r.snapshot()).snapshot(),r.snapshot());});

test('gate is open just before 2500 ms, closed at 2500, and open again at 4000',()=>{const leg={t:'W',d:24,g:{at:12,phase:0}};assert.ok(Math.abs(referenceLeg(leg,1499.999,0)-3499.999)<1e-6);assert.equal(referenceLeg(leg,1500,0),5000);assert.ok(Math.abs(referenceLeg(leg,1499.99999999999,0)-5000)<1e-6);assert.equal(referenceLeg(leg,3000,0),5000);});

test('already-matching submarine earns one clean transition into underwater',()=>{const r=new Race(straight(4,'WUWLW',[36,96,72,96,72]));r.commandSlot(1);r.tick();while(r.player.block<1)r.tick();assert.equal(r.player.slot,1);assert.ok(r.player.cleanSeen.includes(1));const before=r.player.clean;r.commandSlot(1);r.tick();assert.equal(r.player.clean,before);});

test('all 144 equipped-form/base-support pairs match the written product table',()=>{
 const supports=['L','R','W','A','S','U','T','F'];const expected={car:[12,7.2,4,0,4,0,4,0],bike:[10,12,2,0,4,0,4,0],snowmobile:[4,2.4,0,0,12,0,0,0],train:[0,0,0,0,0,0,18,0],boat:[4,4,12,0,0,0,0,0],submarine:[0,0,6,0,0,12,0,0],helicopter:[8,8,8,12,8,0,8,10],plane:[0,0,0,0,0,0,0,18]};
 for(let f=0;f<6;f++)for(let slot=0;slot<3;slot++)for(let t=0;t<supports.length;t++)assert.equal(speed(f,slot,{t:supports[t]}),expected[FAMILIES[f].vehicles[slot]][t]);
 for(const [f,slot,t,m,dir,want]of [[0,1,'W','current',-1,9],[0,1,'W','current',1,15],[4,1,'W','current',-1,4.5],[4,1,'U','current',1,15],[0,2,'L','wind',-1,5.2],[0,2,'A','wind',1,14.4],[5,2,'F','wind',-1,11.7],[5,0,'L','current',1,12],[5,2,'F','current',1,18],[0,1,'W','wind',1,12]])assert.ok(Math.abs(speed(f,slot,{t,m,dir})-want)<1e-9);
});

test('each later vehicle is the only fastest choice on its own terrain and its family unlocks after the teaching stages',()=>{
 const owners={hovercraft:'M',monstertruck:'B',drill:'D',jetski:'K',glider:'C',rocket:'O'};
 for(const [vehicle,terrain] of Object.entries(owners)){
  const f=FAMILIES.findIndex(x=>x.vehicles.includes(vehicle)&&(x.pattern.special===terrain||x.ground===terrain));assert.ok(f>=6,vehicle);
  const slot=FAMILIES[f].vehicles.indexOf(vehicle);assert.equal(bestSlot(f,{t:terrain}),slot);
  for(let other=0;other<3;other++)if(other!==slot)assert.ok(speed(f,other,{t:terrain})<speed(f,slot,{t:terrain}),`${vehicle} ${other}`);
  assert.ok(FAMILIES[f].unlock>36);
 }
 assert.deepEqual(FAMILIES.slice(6).map(f=>f.unlock),[37,43,49,55,61,67]);
 for(const vehicle of Object.keys(SPEEDS))assert.equal(Object.keys(SPEEDS[vehicle]).length,14);
});
test('every later family has prevalidated courses with each fork count available',()=>{
 for(let f=6;f<FAMILIES.length;f++){const mine=recipes.filter(r=>r[1]===f);assert.ok(mine.length>=40,FAMILIES[f].id);
  for(const forks of [0,1,2])assert.ok(mine.some(r=>r[5].length===forks),`${FAMILIES[f].id} forks ${forks}`);}
});
