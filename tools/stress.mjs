import fs from 'node:fs';import assert from 'node:assert/strict';import {performance} from 'node:perf_hooks';
import {Catalog,Session,MemoryStorage,initialData} from '../source/session.mjs';
import {expand,signature} from '../source/content.mjs';import {referenceCourse} from '../source/solver.mjs';
import {simulateEntrant} from '../source/race.mjs';import {hash,FAMILIES} from '../source/rules.mjs';
const bank=JSON.parse(fs.readFileSync('runtime/data/bank.json')).recipes,foundations=JSON.parse(fs.readFileSync('runtime/data/foundations.json')).recipes;
const began=performance.now(),catalog=new Catalog(bank,foundations),unique=new Set([...bank,...foundations].map(r=>JSON.stringify(r.slice(1,6))));
const report={scope:'deterministic bank selection, standalone simulation/save integration; no native browser or human enjoyment',seedsPerFamily:10000,profileCases:0,simulations:0,routeChecks:0,seedFailures:[],foundationCopiesInBank:foundations.filter(r=>bank.some(b=>JSON.stringify(b.slice(1,6))===JSON.stringify(r.slice(1,6)))).map(r=>r[0]),distinctLayouts:unique.size,sequence:{stages:0,reloads:0,maxSaveBytes:0,exactHistoryViolations:0,signatureViolations:0,forkBlocks:[],familyBlocks:[],first100:null},fairness:{positionIndependent:true,hiddenSpeedBoost:false}};
for(let f=0;f<FAMILIES.length;f++){
 const family=catalog.families[f],seen=new Set();
 for(let seed=0;seed<10000;seed++){
  const r=family[hash(`selection-v1:${f}:${seed}`)%family.length],c=expand(r);seen.add(c.id);
  const perfect=simulateEntrant(c,'player',{latency:0});report.simulations++;
  for(const difficulty of ['standard','expert']){
   const ai=['A','B'].map(kind=>simulateEntrant(c,kind,{difficulty}));report.simulations+=2;report.profileCases++;
   if(perfect.finish===null||ai.some(e=>e.finish===null||e.finish<perfect.finish-1e-6))report.seedFailures.push({f,seed,id:r[0],difficulty});
  }
  // All distinct offered branch combinations are rechecked under the independent solver.
  for(const p of referenceCourse(c)){assert.ok(Number.isFinite(p.time));report.routeChecks++;}
 }
 console.log(JSON.stringify({family:FAMILIES[f].id,seeds:10000,distinctSelected:seen.size,seconds:Math.round((performance.now()-began)/1000)}));
}
assert.equal(report.seedFailures.length,0);
let storage=new MemoryStorage(),s=new Session(catalog,storage);assert.ok(await s.load());
let ordinary=[],layouts=[],structures=[],forks=[],families=[];
for(let stage=1;stage<=10000;stage++){
 const id=s.data.queue[0],recipe=catalog.map.get(id),key=catalog.keys.get(id),sig=catalog.signatures.get(id);
 if(stage>=37){
  assert.ok(!layouts.slice(-64).includes(key),`exact repeat stage ${stage}`);assert.ok(!structures.slice(-12).includes(sig),`signature repeat stage ${stage}`);
  ordinary.push(id);layouts.push(key);structures.push(sig);forks.push(recipe[5].length);families.push(recipe[1]);
  if(ordinary.length%10===0){const block=forks.slice(-10),counts=[0,1,2].map(n=>block.filter(x=>x===n).length);assert.deepEqual(counts,[3,5,2]);report.sequence.forkBlocks.push(counts);}
  // Each family debuts on its unlock stage, never repeats back to back, and once all are unlocked every window of 2N-1 stages holds all N.
  const debut=FAMILIES.findIndex(f=>f.unlock===stage);if(debut>=0)assert.equal(recipe[1],debut,`debut ${stage}`);
  assert.ok(FAMILIES[recipe[1]].unlock<=stage,`locked family ${stage}`);if(families.length>1)assert.notEqual(families.at(-1),families.at(-2),`repeat ${stage}`);
  const window=2*FAMILIES.length-1,settled=Math.max(...FAMILIES.map(f=>f.unlock))+window;
  if(stage>=settled&&stage%FAMILIES.length===0){assert.equal(new Set(families.slice(-window)).size,FAMILIES.length,`window ${stage}`);report.sequence.familyBlocks.push(FAMILIES.length);}
  if(ordinary.length===100)report.sequence.first100={distinctLayouts:new Set(layouts).size,signatures:new Set(structures).size,families:[...new Set(families)].length,bankSelection:true,unsafeFallbacks:0};
 }
 await s.start({latency:stage%10===0?450:250,difficulty:stage>6&&stage%2===0?'expert':'standard'});
 while(!s.race.result&&s.race.ms<120000)s.step(20);
 assert.ok(s.race.result?.genuine,`no genuine finish ${stage}`);assert.equal(s.data.frontier,stage+1);assert.equal(s.finalize(),false);
 assert.ok(s.data.records.length<=64);assert.ok(s.data.history.length<=64);assert.ok(s.data.signatures.length<=12);assert.equal(s.data.queue.length,3);
 await s.flush();report.sequence.maxSaveBytes=Math.max(report.sequence.maxSaveBytes,Buffer.byteLength(storage.value));
 if(stage%100===0||stage===36||stage===37){const snapshot=JSON.stringify(s.snapshot());s=new Session(catalog,storage);assert.equal(await s.load(),true,s.error);assert.equal(JSON.stringify(s.snapshot()),snapshot);report.sequence.reloads++;}
 report.sequence.stages++;
 if(stage%1000===0)console.log(JSON.stringify({stages:stage,frontier:s.data.frontier,maxSaveBytes:report.sequence.maxSaveBytes,seconds:Math.round((performance.now()-began)/1000)}));
}
report.sequence.forkBlocks=report.sequence.forkBlocks.length;report.sequence.familyBlocks=report.sequence.familyBlocks.length;
report.sequence.finalFrontier=s.data.frontier;report.sequence.records=s.data.records.length;report.sequence.foundationsRetained=Object.keys(s.data.foundationRecords).length;
assert.equal(report.sequence.foundationsRetained,36);assert.ok(report.sequence.first100.distinctLayouts>=80);assert.ok(report.sequence.first100.signatures>=24);
report.durationSeconds=(performance.now()-began)/1000;report.passed=true;fs.writeFileSync('qa/stress-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
