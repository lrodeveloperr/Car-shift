import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {clone,hash,FAMILIES,bestSlot} from '../source/rules.mjs';
import {expand} from '../source/content.mjs';import {Race,simulateEntrant} from '../source/race.mjs';import {referenceCourse} from '../source/solver.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bank=JSON.parse(fs.readFileSync(path.join(root,'runtime/data/bank.json'))).recipes;
const foundations=[],used=new Set(),results=[];
const fixed={
  1:[0,'GWG',[40,120,80]],2:[0,'GAGW',[60,72,60,108]],3:[0,'WGAG',[60,60,72,108]],
  4:[0,'GWGAG',[72,72,72,72,72],[[1,0,6,'L','terrain']]],
  5:[0,'GAGWG',[72,72,72,72,72],[[1,0,6,'L','terrain']]],
  6:[0,'WGAWG',[60,60,72,60,60]],7:[1,'WGWG',[42,108,120,120]],
  13:[2,'WGWG',[42,144,144,144]],19:[3,'WGWG',[42,108,120,120]],
  25:[4,'WUWLW',[36,96,72,96,72]],31:[5,'LFLW',[42,108,120,144]],
};
for(let stage=1;stage<=36;stage++){
 let recipe;
 if(fixed[stage]){const [f,s,d,forks=[]]=fixed[stage];recipe=[`F${String(stage).padStart(2,'0')}`,f,s,d,[],forks,hash(`foundation:${stage}`),0];}
 else{
  let allowed=FAMILIES.map((f,i)=>f.unlock<=stage?i:-1).filter(i=>i>=0);
  let f=allowed[(stage-1)%allowed.length];if(stage===15)f=2;if(stage===21)f=0;if(stage===27)f=4;if(stage===33)f=0;if(stage===34)f=5;
  const possibilities=bank.filter(r=>r[1]===f&&!used.has(`${f}:${r[2]}`)&&(stage>=15||!r[5].length)&&(stage>=21||!r[4].some(m=>m[1]==='current'))&&(stage>=33||!r[4].some(m=>m[1]==='wind')));
  recipe=clone(possibilities[stage%possibilities.length]);recipe[0]=`F${String(stage).padStart(2,'0')}`;
  if(stage===15&&!recipe[5].length){const i=[...recipe[2]].findIndex((t,i)=>i>0&&['G','W','L'].includes(t));if(i>0)recipe[5]=[[i,1000,6]];}
  if(stage===21||stage===27){const i=recipe[2].indexOf(stage===27?'U':'W');if(i>=0)recipe[4]=[[i,'current',-1]];}
  if(stage===33||stage===34){const i=recipe[2].indexOf(stage===34?'F':'A');if(i>=0)recipe[4]=[[i,'wind',-1]];}
 }
 const c=expand(recipe);c.stage=stage;used.add(`${recipe[1]}:${recipe[2]}`);
 const player=simulateEntrant(c,'player',{latency:0,stage});const ais=['A','B'].map(id=>simulateEntrant(c,id,{stage}));
 const paths=referenceCourse(c);
 for(const p of paths){const e=simulateEntrant(c,'player',{latency:450,stage,choices:Object.fromEntries(p.choices.map((v,i)=>[i,v]))});if(e.finish===null)throw new Error(`foundation route stuck ${stage}`);}
 const r=new Race(c,{latency:0,stage});while(!r.result&&r.ms<120000)r.tick();
 if(!r.result?.genuine||r.result.rank!==1||Math.min(...ais.map(a=>a.finish))<player.finish-1e-6)throw new Error(`foundation fairness ${stage}`);
 const out={stage,id:recipe[0],family:FAMILIES[recipe[1]].id,perfectMs:player.finish,aiMs:ais.map(x=>x.finish),routes:paths.length,checkpoints:r.checkpoints.length};
 if([1,7,13,19,25,31].includes(stage)){
  const trace=simulateEntrant(c,'player',{latency:0,stage,trace:true});out.firstUsefulSwitchMs=trace.events.find(x=>x.type==='switch')?.t;if(out.firstUsefulSwitchMs>5000)throw new Error(`late first action ${stage}`);
 }
 foundations.push(recipe);results.push(out);
}
fs.writeFileSync(path.join(root,'runtime/data/foundations.json'),JSON.stringify({schema:1,recipes:foundations}));
fs.writeFileSync(path.join(root,'qa/foundation-audit.json'),JSON.stringify({scope:'scripted foundation simulation; human teaching comprehension NOT RUN',count:foundations.length,results},null,2)+'\n');
console.log(JSON.stringify({foundations:foundations.length,allRoutesFinish:true,allPerfectGold:true,firstActionsWithinFiveSeconds:true}));
