// Pure course -> track-space mapping for the presentation layer. No three.js, so Node tests import it directly.
// Track space: s = forward distance in course units, x = lateral offset (+x is screen-right). World is (x, y, -s).
import {mod} from '../../source/rules.mjs';

export const LANE_GAP=8.5;           // lateral distance between entrant lanes
export const LANE_X=[0,-LANE_GAP,LANE_GAP]; // player centre, computer A left, computer B right
export const SPLIT=1.6;              // fork sub-road offset from the lane centre
export const ROAD=2.2;               // drawn road width per lane (narrower on forks)
export const AMAX=2.4;               // largest bypass wiggle, keeps sub-roads clear of neighbour lanes
export const SLAB_HALF=LANE_GAP+SPLIT+AMAX+ROAD/2+1.4;
const RAMP=.16;

const smooth=t=>{t=Math.min(1,Math.max(0,t));return t*t*(3-2*t);};
const ramp=u=>u<RAMP?smooth(u/RAMP):u>1-RAMP?smooth((1-u)/RAMP):1;

function sample(length,lateral,n){
  const s=new Float64Array(n+1),x=new Float64Array(n+1),cum=new Float64Array(n+1);
  for(let i=0;i<=n;i++){const u=i/n;s[i]=u*length;x[i]=lateral(u);if(i)cum[i]=cum[i-1]+Math.hypot(s[i]-s[i-1],x[i]-x[i-1]);}
  return {s,x,cum,length:cum[n]};
}
export function straightPath(length){return {s:Float64Array.of(0,length),x:Float64Array.of(0,0),cum:Float64Array.of(0,length),length};}
export function directPath(length){return sample(length,u=>-SPLIT*ramp(u),48);}
// The bypass wiggles outward so its drawn length matches the engine's longer leg: equal speeds look equal.
export function bypassPath(length,target){
  const v=u=>(u-RAMP)/(1-2*RAMP);
  const lateral=(a,m)=>u=>SPLIT*ramp(u)+(u>RAMP&&u<1-RAMP?a*(.5-.5*Math.cos(2*Math.PI*m*v(u)))*Math.sin(Math.PI*v(u)):0);
  const n=Math.max(96,Math.ceil(length*2)),probe=(a,m)=>sample(length,lateral(a,m),Math.max(64,m*16)).length;
  const base=sample(length,lateral(0,1),n);
  if(base.length>=target)return {...base,amplitude:0,waves:0,error:base.length/target-1};
  let best=null;
  for(let m=Math.max(1,Math.round(length/40));m<=40;m++){
    if(probe(AMAX,m)<target){best={a:AMAX,m};continue;}
    let lo=0,hi=AMAX;
    for(let i=0;i<16;i++){const mid=(lo+hi)/2;if(probe(mid,m)<target)lo=mid;else hi=mid;}
    best={a:(lo+hi)/2,m};break;
  }
  const path=sample(length,lateral(best.a,best.m),n);
  return {...path,amplitude:best.a,waves:best.m,error:path.length/target-1};
}

export function buildLayout(course){
  let s=0;
  const blocks=course.blocks.map(block=>{
    const length=block.options[0].d,fork=block.options.length>1;
    const options=block.options.map((leg,k)=>({t:leg.t,d:leg.d,m:leg.m??null,dir:leg.dir??0,g:leg.g??null,
      path:!fork?straightPath(length):k===0?directPath(length):bypassPath(length,leg.d)}));
    const out={s,length,fork,options};s+=length;return out;
  });
  return {total:s,blocks};
}

export function pointAt(path,frac){
  const target=Math.min(1,Math.max(0,frac))*path.length,{cum,s,x}=path;
  let lo=0,hi=cum.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(cum[mid]<=target)lo=mid;else hi=mid;}
  const span=cum[hi]-cum[lo]||1,k=(target-cum[lo])/span,ds=s[hi]-s[lo],dx=x[hi]-x[lo],len=Math.hypot(ds,dx)||1;
  return {s:s[lo]+ds*k,x:x[lo]+dx*k,ds:ds/len,dx:dx/len};
}

const COAST_V=9,COAST_T=900;
// Lane-local track position of an entrant. After the finish, entrants coast to a stop past the line.
export function entrantTrack(layout,e,ms){
  const n=layout.blocks.length;
  if(e.block>=n){const t=Math.max(0,ms-(e.finish??ms));return {s:layout.total+COAST_V*COAST_T/1000*(1-Math.exp(-t/COAST_T)),x:0,ds:1,dx:0};}
  const block=layout.blocks[e.block],option=block.options[e.choice]??block.options[0];
  const p=pointAt(option.path,e.pos/option.d);
  return {s:block.s+p.s,x:p.x,ds:p.ds,dx:p.dx};
}

// Flight hoops along a flight corridor (distances into the block); shared by the scene and the hoop chime.
export function hoopDistances(length){const out=[];for(let d=10;d<length-8;d+=16)out.push(d);return out;}

export function gateState(gate,ms){
  const phase=mod(ms+gate.phase,4000);
  return phase<2500?{open:true,remaining:2500-phase}:{open:false,remaining:4000-phase};
}

export function progress(course,e){
  const n=course.blocks.length;if(e.block>=n)return n;
  const leg=course.blocks[e.block].options[e.choice]??course.blocks[e.block].options[0];
  return e.block+Math.min(1,e.pos/leg.d);
}
// Live order for the HUD: finished entrants by finish time, then by course progress.
export function liveOrder(race){
  return race.entrants.map((e,i)=>({i,f:e.finish,p:progress(race.course,e)}))
    .sort((a,b)=>a.f!==null&&b.f!==null?a.f-b.f:a.f!==null?-1:b.f!==null?1:b.p-a.p).map(x=>x.i);
}
