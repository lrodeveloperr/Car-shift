import {maxSpeed,speed,mod,bestSlot} from './rules.mjs';

// Independent continuous-time reference; the race uses a separate 20 ms integrator.
export function referenceLeg(leg,entry,family,slot=bestSlot(family,leg),factor=1){
  const v=speed(family,slot,leg,factor);if(v<=0)return Infinity;
  let t=entry;
  if(leg.g){
    t+=leg.g.at/v*1000;
    const phase=(Math.round(mod(t+leg.g.phase,4000)*1e6)/1e6)%4000;
    if(phase>=2500)t+=4000-phase;
    t+=(leg.d-leg.g.at)/v*1000;
  }else t+=leg.d/v*1000;
  return t;
}
export function referenceCourse(course,entry=0,locked={}){
  let states=[{time:entry,choices:[],boundaries:[]}];
  for(let b=0;b<course.blocks.length;b++){
    const next=[];
    for(const state of states)for(let o=0;o<course.blocks[b].options.length;o++){
      if(locked[b]!==undefined&&locked[b]!==o)continue;
      const leg=course.blocks[b].options[o];
      const time=referenceLeg(leg,state.time,course.family);
      next.push({time,choices:[...state.choices,o],boundaries:[...state.boundaries,time]});
    }
    states=next;
  }
  return states.sort((a,b)=>a.time-b.time);
}
export function gateTradeoffs(course){
  const out=[];
  for(let b=0;b<course.blocks.length;b++){
    const options=course.blocks[b].options;if(options.length!==2||!options[0].g)continue;
    const wins=new Set();
    for(let t=0;t<4000;t+=20){const a=referenceLeg(options[0],t,course.family);const c=referenceLeg(options[1],t,course.family);if(Math.abs(a-c)>1)wins.add(a<c?0:1);}
    out.push({block:b,bothUseful:wins.size===2});
  }return out;
}
export function estimatedTime(course){return course.blocks.reduce((n,b)=>n+b.options[0].d/maxSpeed(course.family,b.options[0])*1000,0);}
