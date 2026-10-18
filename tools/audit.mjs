import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {patterns,buildRecipe,expand,quality,repetitive,signature} from '../source/content.mjs';
import {simulateEntrant,Race} from '../source/race.mjs';
import {referenceCourse} from '../source/solver.mjs';
import {FAMILIES} from '../source/rules.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
fs.mkdirSync(path.join(root,'qa'),{recursive:true});fs.mkdirSync(path.join(root,'runtime/data'),{recursive:true});
const began=performance.now(),accepted=[],rejections=[],metrics=[];
const counters={rawCandidates:0,geometryAttempts:0,fullRaceSimulations:0,routeSimulations:0,referencePaths:0,accepted:0,rejected:0};
const reasons={};const familyCounts=Object.fromEntries(FAMILIES.map(f=>[f.id,{candidates:0,accepted:0,rejected:0}]));
const exact=new Set(),structural=new Set();

function simulationAudit(c){
  const failures=[];const paths=referenceCourse(c);counters.referencePaths+=paths.length;
  const perfect=simulateEntrant(c,'player',{latency:0});counters.fullRaceSimulations++;
  if(perfect.finish===null||perfect.validTransforms<2)failures.push('perfect_cannot_finish');
  if(perfect.finish+1<paths[0].time||perfect.finish-paths[0].time>1800)failures.push('reference_integrator_disagreement');
  const allAI={};let standardLead=0,expertLead=0;
  for(const difficulty of ['standard','expert']){
    const opponents=['A','B'].map(id=>{counters.fullRaceSimulations++;return simulateEntrant(c,id,{difficulty});});
    if(opponents.some(e=>e.finish===null))failures.push('opponent_stuck');
    const fastest=Math.min(...opponents.map(e=>e.finish??Infinity));
    if(fastest<perfect.finish-1e-6)failures.push(`perfect_cannot_gold_${difficulty}`);
    if(difficulty==='standard')standardLead=fastest-perfect.finish;else expertLead=fastest-perfect.finish;
    allAI[difficulty]=opponents.map(e=>e.finish);
  }
  if(standardLead>4500||expertLead>3000)failures.push('weak_race_pressure_proxy');
  for(const route of paths){
    const e=simulateEntrant(c,'player',{latency:0,choices:Object.fromEntries(route.choices.map((x,i)=>[i,x]))});counters.routeSimulations++;
    if(e.finish===null||e.finish>65000||e.validTransforms<1)failures.push('unplayable_alternate_route');
  }
  const competent=simulateEntrant(c,'player',{latency:250});
  const novice=simulateEntrant(c,'player',{latency:450,mistakeMs:700});counters.fullRaceSimulations+=2;
  if(novice.finish===null||novice.finish>90000)failures.push('novice_recovery_stuck');
  const rank=time=>1+allAI.standard.filter(x=>x<time-1e-6).length;
  return {ok:failures.length===0,failures:[...new Set(failures)],perfectMs:perfect.finish,competentMs:competent.finish,noviceMs:novice.finish,standardAI:allAI.standard,expertAI:allAI.expert,standardLead,expertLead,competentRank:rank(competent.finish),noviceRank:rank(novice.finish),routes:paths.length};
}

for(const p of patterns()){
  counters.rawCandidates++;const family=familyCounts[FAMILIES[p.family].id];family.candidates++;
  let selected=null,lastReasons=[],attempts=0;
  if(repetitive(p.sequence))lastReasons=['repeated_motif'];
  else for(let variant=0;variant<16;variant++){
    attempts++;counters.geometryAttempts++;
    const recipe=buildRecipe(p,variant),course=expand(recipe),q=quality(course);
    if(!q.ok){lastReasons=q.reasons;continue;}
    const a=simulationAudit(course);if(!a.ok){lastReasons=a.failures;continue;}
    const contentKey=JSON.stringify(recipe.slice(1,6));
    if(exact.has(contentKey)){lastReasons=['exact_duplicate'];continue;}
    exact.add(contentKey);structural.add(signature(course));
    selected={recipe,quality:q,audit:a};break;
  }
  if(selected){
    accepted.push(selected.recipe);metrics.push({id:selected.recipe[0],family:FAMILIES[p.family].id,...selected.quality,...selected.audit});counters.accepted++;family.accepted++;
  }else{
    counters.rejected++;family.rejected++;
    rejections.push({id:`C${String(p.ordinal).padStart(5,'0')}`,family:FAMILIES[p.family].id,sequence:p.sequence,attempts,reasons:lastReasons});
    for(const r of lastReasons)reasons[r]=(reasons[r]??0)+1;
  }
  if(counters.rawCandidates%1000===0)process.stdout.write(JSON.stringify({progress:counters.rawCandidates,accepted:counters.accepted,rejected:counters.rejected,seconds:Math.round((performance.now()-began)/1000)})+'\n');
}
const bank={schema:1,scope:'prevalidated course recipes; production graphics/host/human enjoyment pending',recipes:accepted};
const bankText=JSON.stringify(bank);
fs.writeFileSync(path.join(root,'runtime/data/bank.json'),bankText);
const sorted=key=>metrics.map(x=>x[key]).sort((a,b)=>a-b);
const stat=key=>{const a=sorted(key);return {min:a[0],median:a[Math.floor(a.length/2)],p95:a[Math.floor(a.length*.95)],max:a.at(-1)};};
const report={schema:1,generatedAt:new Date().toISOString(),durationSeconds:(performance.now()-began)/1000,
  scope:'Executable content and simulation audit; not human enjoyment, final presentation, physical devices or YouTube-host certification',
  gates:{ordinaryLegs:'4–10',ordinaryOptimalMs:'30000–60000',units:'360–600',cueMs:2500,maxDecisionGapMs:12000,maxOneSlotTimeShare:.65,
    motif:'reject any 2/3-symbol motif repeated three consecutive times',fairness:'lawful perfect Gold on Standard and Expert; fastest-AI gap <=4500/3000 ms',novice:'450 ms switches + one 700 ms mistake must finish <=90000 ms',checkpoint:'supported next section at 25–40% reference completion; optional second at 60–75%, >=10000 ms apart',branches:'both gate routes advantageous for some arrival phase'},
  counts:counters,byFamily:familyCounts,rejectionReasons:reasons,meaningfulSignatures:structural.size,
  stats:{perfectMs:stat('perfectMs'),competentMs:stat('competentMs'),noviceMs:stat('noviceMs'),standardLead:stat('standardLead'),expertLead:stat('expertLead')},
  syntheticRanks:{competent:[1,2,3].map(r=>metrics.filter(x=>x.competentRank===r).length),novice:[1,2,3].map(r=>metrics.filter(x=>x.noviceRank===r).length)},
  bytes:{compactBank:Buffer.byteLength(bankText)},sha256:crypto.createHash('sha256').update(bankText).digest('hex'),
  humanEnjoyment:'NOT RUN',comparativeUserPreference:'NOT RUN',physicalDevice:'NOT RUN',youtubeHost:'NOT RUN'};
fs.writeFileSync(path.join(root,'qa/course-audit.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(root,'qa/course-metrics.json'),JSON.stringify(metrics)+'\n');
fs.writeFileSync(path.join(root,'qa/rejected-candidates.json'),JSON.stringify(rejections,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
