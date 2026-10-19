import {FAMILIES,VERSION,hash,maxSpeed,bestSlot,SUPPORTED,TRANSFERS,FLIGHT,CURRENT_TERRAINS,WIND_TERRAINS,within} from './rules.mjs';
import {referenceCourse,gateTradeoffs,estimatedTime} from './solver.mjs';

// A family's course grammar: it must contain the family's special terrain, must not start or end in a
// transfer, and the special terrain needs its edge terrain on both sides.
export function sequenceAllowed(f,s){
  const {special,edge}=FAMILIES[f].pattern,transfer=c=>TRANSFERS.has(c==='G'?FAMILIES[f].ground:c);
  if(!s.includes(special)||transfer(s[0])||transfer(s.at(-1)))return false;
  if(edge){for(let i=0;i<s.length;i++)if(s[i]===special&&(s[i-1]!==edge||s[i+1]!==edge))return false;}
  return true;
}
export function* patterns(){
  let ordinal=0;
  for(let f=0;f<FAMILIES.length;f++)for(let n=4;n<=10;n++){
    const {alphabet}=FAMILIES[f].pattern;
    function* visit(s){
      if(s.length===n){if(sequenceAllowed(f,s))yield s;return;}
      for(const c of alphabet)if(c!==s.at(-1))yield* visit(s+c);
    }
    for(const sequence of visit(''))yield {family:f,sequence,ordinal:++ordinal};
  }
}
export function repetitive(sequence){
  for(let width=2;width<=3;width++)for(let i=0;i+width*3<=sequence.length;i++){
    const piece=sequence.slice(i,i+width);
    if(sequence.slice(i,i+width*3)===piece.repeat(3))return true;
  }return false;
}
export function buildRecipe(p,variant=0){
  const seed=hash(`${VERSION}|${p.family}|${p.sequence}|${variant}`);
  const terrains=[...p.sequence].map(t=>t==='G'?FAMILIES[p.family].ground:t);
  const n=terrains.length;
  const mods=[];
  // Transport identity, not a new random-power system. One modifier per section.
  if(seed%4===0){
    const candidates=terrains.map((t,i)=>({t,i})).filter(x=>CURRENT_TERRAINS.includes(x.t)||WIND_TERRAINS.includes(x.t));
    if(candidates.length){const x=candidates[seed%candidates.length];mods.push([x.i,CURRENT_TERRAINS.includes(x.t)?'current':'wind',(seed&8)?1:-1]);}
  }
  const temp=terrains.map((t,i)=>({t,d:0,...(mods.some(m=>m[0]===i)?{m:mods.find(m=>m[0]===i)[1],dir:mods.find(m=>m[0]===i)[2]}:{})}));
  const target=36+(seed%15);
  const weights=temp.map((_,i)=>.9+(hash(`${seed}:${i}`)%21)/100);
  const sum=weights.reduce((a,b)=>a+b,0);
  const distances=temp.map((leg,i)=>Math.ceil(Math.max(FLIGHT.has(leg.t)?72:24,target*weights[i]/sum*maxSpeed(p.family,leg))/6)*6);
  const forks=[];
  if(seed%10>=3){
    const eligible=temp.map((l,i)=>({l,i})).filter(x=>x.i>0&&['L','R','W','T','M','B','K'].includes(x.l.t));
    const count=seed%10>=8?2:1;
    for(const x of eligible){
      if(forks.length>=count)break;
      // Distinct open-direct and closed-direct costs; bypass adds 0.7–1 s.
      const extra=Math.max(6,Math.floor(maxSpeed(p.family,x.l)*.8/6)*6);
      forks.push([x.i,hash(`phase:${seed}:${x.i}`)%200*20,extra]);
    }
  }
  return [`C${String(p.ordinal).padStart(5,'0')}`,p.family,p.sequence,distances,mods,forks,seed,variant];
}
export function expand(recipe){
  const [id,family,sequence,distances,mods,forks,seed,variant]=recipe;
  const blocks=[...sequence].map((t,i)=>{
    t=t==='G'?FAMILIES[family].ground:t;
    const m=mods.find(x=>x[0]===i);
    const primary={t,d:distances[i],...(m?{m:m[1],dir:m[2]}:{})};
    const fork=forks.find(x=>x[0]===i);
    if(fork&&fork[4]!=='terrain')primary.g={at:distances[i]/2,phase:fork[1]};
    const alternate=fork?{...primary,t:fork[3]??primary.t,d:primary.d+fork[2],g:undefined}:null;
    return {options:fork?[primary,alternate]:[primary]};
  });
  const course={version:VERSION,id,family,sequence,seed,variant,blocks,checkpoints:[],stage:37};
  const solution=referenceCourse(course)[0];
  const candidates=solution.boundaries.map((time,i)=>({time,index:i+1,next:blocks[i+1]?.options[0]}))
    .filter(x=>x.next&&SUPPORTED.has(x.next.t));
  const first=candidates.filter(x=>within(x.time/solution.time,.25,.4)).sort((a,b)=>Math.abs(a.time/solution.time-.33)-Math.abs(b.time/solution.time-.33))[0];
  const second=candidates.filter(x=>within(x.time/solution.time,.6,.75)&&first&&x.time-first.time>=10000)
    .sort((a,b)=>Math.abs(a.time/solution.time-.67)-Math.abs(b.time/solution.time-.67))[0];
  if(first)course.checkpoints.push(first.index);
  if(second)course.checkpoints.push(second.index);
  return course;
}
export function quality(course){
  const reasons=[];const n=course.blocks.length;
  if(n<4||n>10)reasons.push('leg_count');
  if(repetitive(course.sequence))reasons.push('repeated_motif');
  if(course.blocks.filter(b=>b.options.length===2).length>2)reasons.push('fork_count');
  if(course.checkpoints.length===0)reasons.push('no_safe_checkpoint_in_window');
  const paths=referenceCourse(course);
  if(paths.some(x=>!Number.isFinite(x.time)))reasons.push('unreachable_route');
  if(paths[0].time<30000||paths.at(-1).time>60000)reasons.push('race_duration');
  const units=course.blocks.reduce((a,b)=>a+b.options[0].d,0);
  if(units<360||units>600)reasons.push('course_length');
  let prev=-1,switches=0;const occupancy=[0,0,0];let maxGap=0;
  for(let b=0;b<n;b++){
    const block=course.blocks[b];
    for(const leg of block.options){
      if(!within(leg.d,18,600)||maxSpeed(course.family,leg)<=0)reasons.push('invalid_traversal');
      if(FLIGHT.has(leg.t)&&leg.d<72)reasons.push('short_flight_corridor');
      if(leg.d/maxSpeed(course.family,leg)*1000<2500)reasons.push('cue_too_short');
      if(leg.t==='U'&&(course.blocks[b-1]?.options[0].t!=='W'||course.blocks[b+1]?.options[0].t!=='W'))reasons.push('unsafe_submarine_connection');
      if(FLIGHT.has(leg.t)&&(course.blocks[b-1]?.options[0].t!=='L'||course.blocks[b+1]?.options[0].t!=='L'))reasons.push('unsafe_runway');
    }
    const leg=block.options[paths[0].choices[b]],slot=bestSlot(course.family,leg),dt=leg.d/maxSpeed(course.family,leg)*1000;
    occupancy[slot]+=dt;maxGap=Math.max(maxGap,dt);
    if(prev>=0&&slot!==prev)switches++;prev=slot;
    if(block.options.length===2){
      const previous=course.blocks[b-1]?.options[0];
      if(!previous||previous.d/maxSpeed(course.family,previous)*1000<3300)reasons.push('fork_transform_conflict');
    }
  }
  if(switches<2)reasons.push('too_few_useful_switches');
  if(maxGap>12000)reasons.push('long_no_decision_interval');
  if(Math.max(...occupancy)/estimatedTime(course)>.65)reasons.push('one_form_dominates');
  if(gateTradeoffs(course).some(x=>!x.bothUseful))reasons.push('dominated_branch');
  return {ok:reasons.length===0,reasons:[...new Set(reasons)],optimalMs:paths[0].time,worstRouteMs:paths.at(-1).time,units,switches,maxGap,paths:paths.length};
}
export function signature(c){return `${c.family}:${c.sequence}:${c.blocks.map(b=>b.options.length).join('')}:${c.blocks.map(b=>b.options[0].m??'-').join(',')}`;}
