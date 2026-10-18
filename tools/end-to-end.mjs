import fs from 'node:fs';import assert from 'node:assert/strict';import {performance} from 'node:perf_hooks';
import {Catalog,Session,MemoryStorage,initialData} from '../source/session.mjs';import {Race} from '../source/race.mjs';import {bestSlot} from '../source/rules.mjs';import {referenceLeg,referenceCourse} from '../source/solver.mjs';
const bank=JSON.parse(fs.readFileSync('runtime/data/bank.json')).recipes,foundations=JSON.parse(fs.readFileSync('runtime/data/foundations.json')).recipes,catalog=new Catalog(bank,foundations),began=performance.now();
const data=initialData();data.frontier=37;const storage=new MemoryStorage(JSON.stringify(data));let s=new Session(catalog,storage);assert.ok(await s.load());
const report={scope:'actual Session -> legal commandSlot/chooseBranch -> simultaneous Race -> acknowledged save/reload -> result; algorithmic controls, not native touch/human play',runs:0,midRaceReloads:0,lawfulCommands:0,firstPlace:0,allRoutesThroughCommandAPI:0,maxSaveBytes:0,failures:[],byDifficulty:{standard:0,expert:0}};
function act(r){
 const e=r.player,b=r.course.blocks[e.block],leg=b.options[e.choice],slot=bestSlot(r.course.family,leg);if(e.slot!==slot){assert.equal(r.commandSlot(slot),true);report.lawfulCommands++;}
 const next=r.course.blocks[e.block+1];if(next?.options.length===2&&r.ms-e.arrival>=820&&!Object.hasOwn(e.planned,e.block+1)){
  const remainder={...leg,d:leg.d-e.pos,g:leg.g&&e.pos<=leg.g.at+1e-7?{...leg.g,at:Math.max(0,leg.g.at-e.pos)}:undefined};
  const arrival=referenceLeg(remainder,r.ms,r.course.family,slot);const times=next.options.map(o=>referenceLeg(o,arrival,r.course.family));
  assert.equal(r.chooseBranch(e.block+1,times[1]<times[0]?1:0),true);
 }
}
for(const recipe of [...bank,...foundations])for(const difficulty of ['standard','expert']){
 await s.start({id:recipe[0],replay:true,difficulty});let reloaded=false;
 while(!s.race.result&&s.race.ms<90000){
  act(s.race);s.step(20);
  if(!reloaded&&s.race.ms>=10000&&!s.race.result){await s.flush();const expected=JSON.stringify(s.snapshot());s=new Session(catalog,storage);assert.equal(await s.load(),true,s.error);assert.equal(JSON.stringify(s.snapshot()),expected);reloaded=true;report.midRaceReloads++;}
 }
 if(s.race.result?.rank!==1||!s.race.result?.genuine)report.failures.push({id:recipe[0],difficulty,result:s.race.result});else report.firstPlace++;
 await s.flush();report.maxSaveBytes=Math.max(report.maxSaveBytes,Buffer.byteLength(storage.value));report.runs++;report.byDifficulty[difficulty]++;
 if(report.runs%1000===0)console.log(JSON.stringify({runs:report.runs,failures:report.failures.length,seconds:Math.round((performance.now()-began)/1000)}));
}
for(const recipe of [...bank,...foundations]){const c=catalog.course(recipe[0]);for(const route of referenceCourse(c)){
 const r=new Race(c);while(!r.result&&r.ms<90000){const e=r.player,leg=c.blocks[e.block].options[e.choice],slot=bestSlot(c.family,leg);if(e.slot!==slot)assert.ok(r.commandSlot(slot));const next=e.block+1;if(c.blocks[next]?.options.length===2&&r.ms-e.arrival>=820&&!Object.hasOwn(e.planned,next))assert.ok(r.chooseBranch(next,route.choices[next]));r.tick();}assert.ok(r.result?.genuine,recipe[0]);report.allRoutesThroughCommandAPI++;
}}
fs.writeFileSync('qa/end-to-end-report.json',JSON.stringify(report,null,2)+'\n');assert.equal(report.failures.length,0);report.durationSeconds=(performance.now()-began)/1000;report.passed=true;fs.writeFileSync('qa/end-to-end-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
