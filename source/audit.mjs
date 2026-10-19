import {simulateEntrant} from './race.mjs';
import {referenceCourse} from './solver.mjs';

// Simulation gates every course passes before a player can see it. Offline authoring and the on-device
// daily course share them; pass a counters object to tally the simulations run.
export function simulationAudit(c,counters={}){
  const count=(key,n=1)=>{counters[key]=(counters[key]??0)+n;};
  const failures=[];const paths=referenceCourse(c);count('referencePaths',paths.length);
  const perfect=simulateEntrant(c,'player',{latency:0});count('fullRaceSimulations');
  if(perfect.finish===null||perfect.validTransforms<2)failures.push('perfect_cannot_finish');
  if(perfect.finish+1<paths[0].time||perfect.finish-paths[0].time>1800)failures.push('reference_integrator_disagreement');
  const allAI={};let standardLead=0,expertLead=0;
  for(const difficulty of ['standard','expert']){
    const opponents=['A','B'].map(id=>{count('fullRaceSimulations');return simulateEntrant(c,id,{difficulty});});
    if(opponents.some(e=>e.finish===null))failures.push('opponent_stuck');
    const fastest=Math.min(...opponents.map(e=>e.finish??Infinity));
    if(fastest<perfect.finish-1e-6)failures.push(`perfect_cannot_gold_${difficulty}`);
    if(difficulty==='standard')standardLead=fastest-perfect.finish;else expertLead=fastest-perfect.finish;
    allAI[difficulty]=opponents.map(e=>e.finish);
  }
  if(standardLead>4500||expertLead>3000)failures.push('weak_race_pressure_proxy');
  for(const route of paths){
    const e=simulateEntrant(c,'player',{latency:0,choices:Object.fromEntries(route.choices.map((x,i)=>[i,x]))});count('routeSimulations');
    if(e.finish===null||e.finish>65000||e.validTransforms<1)failures.push('unplayable_alternate_route');
  }
  const competent=simulateEntrant(c,'player',{latency:250});
  const novice=simulateEntrant(c,'player',{latency:450,mistakeMs:700});count('fullRaceSimulations',2);
  if(novice.finish===null||novice.finish>90000)failures.push('novice_recovery_stuck');
  const rank=time=>1+allAI.standard.filter(x=>x<time-1e-6).length;
  return {ok:failures.length===0,failures:[...new Set(failures)],perfectMs:perfect.finish,competentMs:competent.finish,noviceMs:novice.finish,standardAI:allAI.standard,expertAI:allAI.expert,standardLead,expertLead,competentRank:rank(competent.finish),noviceRank:rank(novice.finish),routes:paths.length};
}
