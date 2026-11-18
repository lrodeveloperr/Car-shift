import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {clone,hash,FAMILIES,bestSlot} from '../source/rules.mjs';
import {expand} from '../source/content.mjs';import {Race,simulateEntrant} from '../source/race.mjs';import {referenceCourse} from '../source/solver.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bank=JSON.parse(fs.readFileSync(path.join(root,'runtime/data/bank.json'))).recipes;
const foundations=[],used=new Set(),results=[];
// Teaching stages 1–36. Every family debuts on its unlock stage with a short fixed course whose first useful switch
// comes within five seconds. Stages 1–2 teach the basics and stage 4 a terrain-choice fork. Every other stage races
// the least recently raced unlocked family (never the previous stage's), for the most vehicle variety per level.
const DEBUTS={rough:['WGWG',[42,108,120,120]],rail:['WGWG',[42,144,144,144]],snow:['WGWG',[42,108,120,120]],deep:['WUWLW',[36,96,72,96,72]],
  flight:['LFLW',[42,108,120,144]],marsh:['GMGA',[42,108,120,72]],wreck:['WGWG',[42,108,120,120]],mountain:['WDWL',[42,96,96,72]],
  rapids:['GKAK',[42,108,72,108]],canyon:['LCLW',[42,108,120,144]],space:['LOLM',[42,144,120,120]]};
const fixed={1:[0,'GWG',[40,120,80]],2:[0,'GAGW',[60,72,60,108]],4:[0,'GWGAG',[72,72,72,72,72],[[1,0,6,'L','terrain']]]};
FAMILIES.forEach((f,i)=>{if(DEBUTS[f.id])fixed[f.unlock]=[i,...DEBUTS[f.id]];});
// Feature lessons: forks, water currents and wind each start on a stage with a chosen family.
const FORKS_FROM=16,CURRENT_FROM=22,WIND_FROM=34,LESSON={16:2,22:0,28:4,34:0,35:5};
const lastRaced=new Map();let previous=-1;
for(let stage=1;stage<=36;stage++){
 let recipe;
 if(fixed[stage]){const [f,s,d,forks=[]]=fixed[stage];recipe=[`F${String(stage).padStart(2,'0')}`,f,s,d,[],forks,hash(`foundation:${stage}`),0];}
 else{
  const allowed=FAMILIES.map((f,i)=>f.unlock<=stage?i:-1).filter(i=>i>=0);
  let f=allowed.filter(i=>i!==previous||allowed.length===1).sort((a,b)=>(lastRaced.get(a)??0)-(lastRaced.get(b)??0)||a-b)[0];
  if(LESSON[stage]!==undefined)f=LESSON[stage];
  const possibilities=bank.filter(r=>r[1]===f&&!used.has(`${f}:${r[2]}`)&&(stage>=FORKS_FROM||!r[5].length)&&(stage>=CURRENT_FROM||!r[4].some(m=>m[1]==='current'))&&(stage>=WIND_FROM||!r[4].some(m=>m[1]==='wind')));
  recipe=clone(possibilities[stage%possibilities.length]);recipe[0]=`F${String(stage).padStart(2,'0')}`;
  if(stage===FORKS_FROM&&!recipe[5].length){const i=[...recipe[2]].findIndex((t,i)=>i>0&&['G','W','L'].includes(t));if(i>0)recipe[5]=[[i,1000,6]];}
  if(stage===CURRENT_FROM||stage===28){const i=recipe[2].indexOf(stage===28?'U':'W');if(i>=0)recipe[4]=[[i,'current',-1]];}
  if(stage===WIND_FROM||stage===35){const i=recipe[2].indexOf(stage===35?'F':'A');if(i>=0)recipe[4]=[[i,'wind',-1]];}
 }
 lastRaced.set(recipe[1],stage);previous=recipe[1];
 const c=expand(recipe);c.stage=stage;used.add(`${recipe[1]}:${recipe[2]}`);
 const player=simulateEntrant(c,'player',{latency:0,stage});const ais=['A','B'].map(id=>simulateEntrant(c,id,{stage}));
 const paths=referenceCourse(c);
 for(const p of paths){const e=simulateEntrant(c,'player',{latency:450,stage,choices:Object.fromEntries(p.choices.map((v,i)=>[i,v]))});if(e.finish===null)throw new Error(`foundation route stuck ${stage}`);}
 const r=new Race(c,{latency:0,stage});while(!r.result&&r.ms<120000)r.tick();
 if(!r.result?.genuine||r.result.rank!==1||Math.min(...ais.map(a=>a.finish))<player.finish-1e-6)throw new Error(`foundation fairness ${stage}`);
 const out={stage,id:recipe[0],family:FAMILIES[recipe[1]].id,perfectMs:player.finish,aiMs:ais.map(x=>x.finish),routes:paths.length,checkpoints:r.checkpoints.length};
 if(FAMILIES.some(f=>f.unlock===stage)){
  const trace=simulateEntrant(c,'player',{latency:0,stage,trace:true});out.firstUsefulSwitchMs=trace.events.find(x=>x.type==='switch')?.t;if(out.firstUsefulSwitchMs>5000)throw new Error(`late first action ${stage}`);
 }
 foundations.push(recipe);results.push(out);
}
fs.writeFileSync(path.join(root,'runtime/data/foundations.json'),JSON.stringify({schema:1,recipes:foundations}));
fs.writeFileSync(path.join(root,'qa/foundation-audit.json'),JSON.stringify({scope:'scripted foundation simulation; human teaching comprehension NOT RUN',count:foundations.length,results},null,2)+'\n');
console.log(JSON.stringify({foundations:foundations.length,allRoutesFinish:true,allPerfectGold:true,firstActionsWithinFiveSeconds:true}));
