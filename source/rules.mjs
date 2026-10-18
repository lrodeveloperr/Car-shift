export const VERSION = 1;
export const TICK = 20;
export const FAMILIES = [
  { id:'coastal', vehicles:['car','boat','helicopter'], ground:'L', unlock:1 },
  { id:'rough', vehicles:['bike','boat','helicopter'], ground:'R', unlock:7 },
  { id:'rail', vehicles:['train','boat','helicopter'], ground:'T', unlock:13 },
  { id:'snow', vehicles:['snowmobile','boat','helicopter'], ground:'S', unlock:19 },
  { id:'deep', vehicles:['car','submarine','helicopter'], ground:'L', unlock:25 },
  { id:'flight', vehicles:['car','boat','plane'], ground:'L', unlock:31 },
];
export const LABELS={ L:'Land', R:'Rough land', W:'Surface water', A:'Air transfer', S:'Snow', U:'Underwater', T:'Rail', F:'Flight corridor' };
export const SPEEDS={
  car:{L:12,R:7.2,W:4,A:0,S:4,U:0,T:4,F:0},
  bike:{L:10,R:12,W:2,A:0,S:4,U:0,T:4,F:0},
  snowmobile:{L:4,R:2.4,W:0,A:0,S:12,U:0,T:0,F:0},
  train:{L:0,R:0,W:0,A:0,S:0,U:0,T:18,F:0},
  boat:{L:4,R:4,W:12,A:0,S:0,U:0,T:0,F:0},
  submarine:{L:0,R:0,W:6,A:0,S:0,U:12,T:0,F:0},
  helicopter:{L:8,R:8,W:8,A:12,S:8,U:0,T:8,F:10},
  plane:{L:0,R:0,W:0,A:0,S:0,U:0,T:0,F:18},
};
export const SUPPORTED = new Set(['L','R','W','S','T']);
export const TRANSFERS = new Set(['A','U','F']);
export const clone = x => structuredClone(x);
export const mod = (x,n) => ((x%n)+n)%n;
export function hash(s){let a=2166136261;for(const c of String(s)){a^=c.charCodeAt(0);a=Math.imul(a,16777619);}return a>>>0;}
export function speed(family,slot,leg,factor=1){
  const vehicle=FAMILIES[family].vehicles[slot];
  let v=SPEEDS[vehicle]?.[leg.t]??0;
  if(leg.m==='current' && ['boat','submarine'].includes(vehicle))v*=leg.dir>0?1.25:0.75;
  if(leg.m==='wind' && ['plane','helicopter'].includes(vehicle))v*=leg.dir>0?1.2:0.65;
  return v*factor;
}
export function bestSlot(family,leg){let b=0;for(let s=1;s<3;s++)if(speed(family,s,leg)>speed(family,b,leg))b=s;return b;}
export function maxSpeed(family,leg){return Math.max(...[0,1,2].map(s=>speed(family,s,leg)));}
export function aiProfile(difficulty,ai,stage=37,seed=0){
  const factors=difficulty==='expert'?[.98,1]:stage<=3?[.78,.86]:stage<=6?[.86,.92]:[.94,.98];
  return {id:ai===0?'A':'B',factor:factors[ai],reaction:(difficulty==='expert'?[140,100]:[220,160])[ai],
    extra:difficulty==='expert'?100:200,extraBlock:seed%10,defaultFork:ai===0&&difficulty!=='expert'&&seed%3===0};
}
export function reactionFor(p,terrain){
  let d=0;
  if(['L','R','S','T'].includes(terrain))d=p.id==='A'?-100:100;
  if(['W','U'].includes(terrain))d=p.id==='A'?100:-100;
  return Math.max(20,p.reaction+d);
}
export const within=(x,a,b)=>Number.isFinite(x)&&x>=a&&x<=b;
