import {TICK,FAMILIES,SUPPORTED,speed,bestSlot,aiProfile,reactionFor,mod,clone,within} from './rules.mjs';
import {referenceLeg} from './solver.mjs';

function makeEntrant(course,kind,{difficulty='standard',stage=37,latency=0,choices=null,mistakeMs=0}={}){
  const p=kind==='player'?null:aiProfile(difficulty,kind==='A'?0:1,stage,course.seed);
  const transitions=course.blocks.map((b,i)=>i>0&&bestSlot(course.family,b.options[0])!==bestSlot(course.family,course.blocks[i-1].options[0])?i:-1).filter(i=>i>=0);
  if(p){p.extraBlock=transitions.length?transitions[course.seed%transitions.length]:-1;const forks=course.blocks.map((b,i)=>b.options.length===2?i:-1).filter(i=>i>=0);p.defaultAt=forks.length?forks[course.seed%forks.length]:-1;}
  return {kind,profile:p,latency,auto:kind!=='player'||latency!==null,locked:choices,planned:{},block:0,pos:0,choice:0,slot:bestSlot(course.family,course.blocks[0].options[0]),
    entered:false,reaction:0,target:null,finish:null,validTransforms:0,clean:0,cleanSeen:[],changes:0,extraSpent:false,mistakeMs,mistakeSpent:false,waitMs:0,events:[]};
}
function chosenOption(e,course,time){
  const options=course.blocks[e.block].options;
  if(options.length===1)return 0;
  if(e.locked?.[e.block]!==undefined)return e.locked[e.block];
  if(e.kind==='player'&&e.planned[e.block]!==undefined)return e.planned[e.block];
  if(e.kind==='player'&&!e.auto)return e.planned[e.block]??0;
  if(e.profile?.defaultFork&&e.profile.defaultAt===e.block)return 0;
  let best=0;for(let i=1;i<options.length;i++)if(referenceLeg(options[i],time,course.family,undefined,e.profile?.factor??1)<referenceLeg(options[best],time,course.family,undefined,e.profile?.factor??1))best=i;
  return best;
}
function enter(e,course,time,trace){
  e.choice=chosenOption(e,course,time);e.entered=true;e.pos=0;
  const leg=course.blocks[e.block].options[e.choice],target=bestSlot(course.family,leg);
  e.arrival=time;
  if(e.block>0&&target===e.slot&&!e.cleanSeen.includes(e.block)){e.clean++;e.cleanSeen.push(e.block);}
  if(target!==e.slot&&e.auto){
    e.target=target;
    e.reaction=e.profile?reactionFor(e.profile,leg.t):Math.max(20,e.latency);
    if(e.profile?.id==='B'&&e.block===e.profile.extraBlock&&!e.extraSpent){e.reaction+=e.profile.extra;e.extraSpent=true;}
    if(e.kind==='player'&&e.mistakeMs&&!e.mistakeSpent&&e.block>=Math.floor(course.blocks.length/2)){e.reaction+=e.mistakeMs;e.mistakeSpent=true;}
  }else{e.target=null;e.reaction=0;}
  if(trace)e.events.push({type:'enter',block:e.block,option:e.choice,t:time,slot:e.slot});
}
function applySlot(e,course,slot,time,trace){
  if(!Number.isInteger(slot)||slot<0||slot>2||e.finish!==null)return false;
  const leg=course.blocks[e.block].options[e.choice];
  if(speed(course.family,slot,leg)<=0)return false;
  if(slot===e.slot)return true;
  e.slot=slot;e.validTransforms++;e.changes++;
  if(time-e.arrival<=250&&!e.cleanSeen.includes(e.block)){e.clean++;e.cleanSeen.push(e.block);}
  if(trace)e.events.push({type:'switch',block:e.block,slot,t:time});
  return true;
}
export function advanceEntrant(e,course,start,dt=TICK,trace=false){
  if(e.finish!==null)return;
  let left=dt,time=start,guard=0;
  while(left>1e-7&&e.finish===null){
    if(++guard>60)throw new Error('non-progressing integrator');
    if(!e.entered)enter(e,course,time,trace);
    const leg=course.blocks[e.block].options[e.choice];
    if(e.target!==null&&e.reaction<=1e-7){applySlot(e,course,e.target,time,trace);e.target=null;}
    let budget=left;
    if(e.target!==null)budget=Math.min(budget,e.reaction);
    const v=speed(course.family,e.slot,leg,e.profile?.factor??1);
    if(v<=0){
      const use=budget;e.waitMs+=use;left-=use;time+=use;if(e.target!==null)e.reaction-=use;
      if(use<=1e-7)throw new Error('zero-time wait');
      continue;
    }
    if(leg.g&&Math.abs(e.pos-leg.g.at)<1e-7){
      const phase=(Math.round(mod(time+leg.g.phase,4000)*1e6)/1e6)%4000;
      if(phase>=2500){
        const use=Math.min(budget,4000-phase);
        e.waitMs+=use;left-=use;time+=use;if(e.target!==null)e.reaction-=use;
        if(use<=1e-7)throw new Error('zero-time gate');
        continue;
      }
    }
    const target=leg.g&&e.pos<leg.g.at-1e-7?leg.g.at:leg.d;
    const use=Math.min(budget,(target-e.pos)/v*1000);
    e.pos+=v*use/1000;left-=use;time+=use;if(e.target!==null)e.reaction-=use;
    if(Math.abs(e.pos-leg.d)<1e-7){
      e.pos=leg.d;e.block++;e.entered=false;
      if(e.block===course.blocks.length){e.finish=time;if(trace)e.events.push({type:'finish',t:time});}
      else enter(e,course,time,trace);
    }else if(use<=1e-7)throw new Error('zero-time traversal');
  }
}
export function simulateEntrant(course,kind,options={}){
  const e=makeEntrant(course,kind,options);let t=0;const limit=options.limitMs??180000;
  while(e.finish===null&&t<limit){advanceEntrant(e,course,t,TICK,!!options.trace);t+=TICK;}
  return e;
}
export class Race{
  constructor(course,{difficulty='standard',stage=37,serial=1,latency=null,trace=false}={}){
    this.course=clone(course);this.difficulty=difficulty;this.stage=stage;this.serial=serial;this.trace=trace;
    this.entrants=[makeEntrant(course,'player',{difficulty,stage,latency}),makeEntrant(course,'A',{difficulty,stage}),makeEntrant(course,'B',{difficulty,stage})];
    this.ms=0;this.stopwatch=0;this.accumulator=0;this.pauses=new Set();this.pendingSlot=null;this.result=null;this.checkpoints=[];this.state='RACING';this.assisted=false;this.originalResult=null;this.origin='journey';this.assistedCommitted=false;
    for(const e of this.entrants)enter(e,this.course,0,trace);
  }
  get player(){return this.entrants[0];}
  commandSlot(slot){
    if(this.pauses.size||this.state!=='RACING'||!Number.isInteger(slot)||slot<0||slot>2)return false;
    const leg=this.course.blocks[this.player.block]?.options[this.player.choice];
    if(!leg||speed(this.course.family,slot,leg)<=0)return false;
    this.pendingSlot=slot;return true;
  }
  chooseBranch(block,choice){
    if(this.pauses.size||this.state!=='RACING'||!Number.isInteger(block)||!Number.isInteger(choice))return false;
    const options=this.course.blocks[block]?.options;
    if(!options||choice<0||choice>=options.length||block<=this.player.block)return false;
    this.player.planned[block]=choice;return true;
  }
  pause(owner){this.pauses.add(owner);this.pendingSlot=null;this.accumulator=0;}
  resume(owner){this.pauses.delete(owner);this.accumulator=0;}
  frame(delta){
    if(!within(delta,0,60000))throw new Error('invalid frame delta');
    if(this.pauses.size||this.state!=='RACING')return 0;
    this.stopwatch+=delta;this.accumulator+=delta;
    const ticks=Math.min(5,Math.floor(this.accumulator/TICK));
    this.accumulator-=Math.floor(this.accumulator/TICK)*TICK;
    let actual=0;for(let i=0;i<ticks&&this.state==='RACING';i++){this.tick(false);actual++;}return actual*TICK;
  }
  tick(addStopwatch=true){
    if(this.pauses.size||this.state!=='RACING')return false;
    const before=this.player.block;
    if(this.pendingSlot!==null){applySlot(this.player,this.course,this.pendingSlot,this.ms,this.trace);this.pendingSlot=null;}
    for(const e of this.entrants)advanceEntrant(e,this.course,this.ms,TICK,this.trace);
    this.ms+=TICK;if(addStopwatch)this.stopwatch+=TICK;
    if(this.player.block!==before&&this.course.checkpoints.includes(this.player.block)&&this.player.finish===null){
      const leg=this.course.blocks[this.player.block].options[this.player.choice];
      if(SUPPORTED.has(leg.t)){
        const snap=this.snapshot(false);snap.checkpoints=[];this.checkpoints.push(snap);if(this.checkpoints.length>2)this.checkpoints.shift();
      }
    }
    if(this.player.finish!==null){
      const rank=1+this.entrants.slice(1).filter(e=>e.finish!==null&&e.finish<this.player.finish-1e-7).length;
      this.result={rank,medal:['Gold','Silver','Bronze'][rank-1],time:this.player.finish,stopwatch:this.stopwatch,genuine:this.player.validTransforms>0,meaningful:this.player.validTransforms>0&&this.ms>=15000,serial:this.serial,assisted:this.assisted,clean:this.player.clean};
      this.state='RESULT';
    }return true;
  }
  snapshot(includeCheckpoints=true){
    return clone({course:this.course,difficulty:this.difficulty,stage:this.stage,serial:this.serial,entrants:this.entrants,ms:this.ms,stopwatch:this.stopwatch,accumulator:0,
      pendingSlot:null,result:this.result,state:this.state,assisted:this.assisted,originalResult:this.originalResult,origin:this.origin,assistedCommitted:this.assistedCommitted,checkpoints:includeCheckpoints?this.checkpoints:[]});
  }
  static restore(snapshot){
    validateRaceSnapshot(snapshot);
    const race=Object.create(Race.prototype);Object.assign(race,clone(snapshot));race.pauses=new Set();race.trace=false;race.pendingSlot=null;race.accumulator=0;return race;
  }
  rematch(){
    if(this.state!=='RESULT'||!this.checkpoints.length||this.assisted)return null;
    const race=Race.restore(this.checkpoints.at(-1));race.originalResult=clone(this.result);race.assisted=true;race.state='RACING';race.result=null;race.checkpoints=[];return race;
  }
}
export function validateRaceSnapshot(s,depth=0){
  const bad=message=>{throw new Error(`invalid race ${message}`);};
  if(depth>1||!s||!within(s.ms,0,86400000)||!within(s.stopwatch,0,86400000)||!Number.isSafeInteger(s.serial)||s.serial<1||!Number.isSafeInteger(s.stage)||s.stage<1)bad('clocks/serial');
  if(!['standard','expert'].includes(s.difficulty)||!['journey','replay','rematch'].includes(s.origin)||typeof s.assisted!=='boolean'||typeof s.assistedCommitted!=='boolean')bad('identity');
  const c=s.course;
  if(!c||!Number.isInteger(c.family)||c.family<0||c.family>5||!Number.isSafeInteger(c.seed)||!Array.isArray(c.blocks)||c.blocks.length<3||c.blocks.length>10||!Array.isArray(s.entrants)||s.entrants.length!==3)bad('shape');
  if(!['RACING','RESULT'].includes(s.state)||!Array.isArray(s.checkpoints)||s.checkpoints.length>2)bad('state');
  for(const b of c.blocks){
    if(!b||!Array.isArray(b.options)||b.options.length<1||b.options.length>2)bad('options');
    for(const leg of b.options){
      if(!leg||!Object.hasOwn(SPEED_TERRAINS,leg.t)||!within(leg.d,18,600)||![0,1,2].some(slot=>speed(c.family,slot,leg)>0))bad('leg');
      if(leg.g&&(!within(leg.g.at,0,leg.d)||!within(leg.g.phase,0,3999)))bad('gate');
    }
  }
  for(let i=0;i<3;i++){
    const e=s.entrants[i],n=c.blocks.length;
    if(!e||e.kind!==['player','A','B'][i]||!Number.isInteger(e.block)||!within(e.block,0,n)||!Number.isInteger(e.slot)||!within(e.slot,0,2)||!Number.isInteger(e.choice))bad('entrant');
    const block=c.blocks[Math.min(e.block,n-1)],leg=block.options[e.choice];
    if(!leg||!within(e.pos,0,leg.d+1e-6)||!within(e.reaction,0,60000)||!within(e.arrival,0,s.ms)||!within(e.waitMs,0,86400000))bad('position');
    if((e.finish!==null)!==(e.block===n)||e.finish!==null&&!within(e.finish,0,s.ms))bad('finish');
    if(e.target!==null&&(!Number.isInteger(e.target)||!within(e.target,0,2)))bad('target');
    if(e.latency!==null&&!within(e.latency,0,60000)||!within(e.mistakeMs,0,60000))bad('reaction');
    for(const k of ['auto','entered','extraSpent','mistakeSpent'])if(typeof e[k]!=='boolean')bad('flags');
    for(const k of ['validTransforms','clean','changes'])if(!Number.isSafeInteger(e[k])||e[k]<0||e[k]>1000000)bad('counters');
    if(!Array.isArray(e.cleanSeen)||e.cleanSeen.length>n||e.cleanSeen.some(x=>!Number.isInteger(x)||x<0||x>=n)||!Array.isArray(e.events)||e.events.length>10000)bad('bounded lists');
    for(const choices of [e.planned,e.locked])if(choices!==null){
      if(!choices||typeof choices!=='object'||Array.isArray(choices)||Object.keys(choices).length>n)bad('choices');
      for(const [key,value]of Object.entries(choices))if(!/^\d+$/.test(key)||!c.blocks[Number(key)]?.options[value]||!Number.isInteger(value))bad('choice bounds');
    }
    const expected=makeEntrant(c,e.kind,{difficulty:s.difficulty,stage:s.stage,latency:e.latency}).profile;
    if(JSON.stringify(expected)!==JSON.stringify(e.profile))bad('fixed opponent profile');
  }
  if((s.state==='RESULT')!==!!s.result||(s.result&&(!Number.isInteger(s.result.rank)||!within(s.result.rank,1,3)||!within(s.result.time,0,s.ms)||s.result.serial!==s.serial)))bad('result');
  for(const cp of s.checkpoints){if(cp.serial!==s.serial||cp.course.id!==c.id||cp.ms>s.ms||cp.checkpoints.length)bad('checkpoint');validateRaceSnapshot(cp,depth+1);}
  return true;
}
const SPEED_TERRAINS={L:1,R:1,W:1,A:1,S:1,U:1,T:1,F:1};
