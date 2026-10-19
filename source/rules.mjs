export const VERSION = 1;
export const TICK = 20;
// pattern: the course alphabet (G = the family's ground), the terrain every course must contain, and the
// neighbour that terrain needs on both sides (surface water around a dive, land around a runway corridor).
// Families after the 36 teaching stages unlock one at a time, each introducing a vehicle with its own terrain.
export const FAMILIES = [
  { id:'coastal', vehicles:['car','boat','helicopter'], ground:'L', unlock:1, pattern:{alphabet:'GWA',special:'G'} },
  { id:'rough', vehicles:['bike','boat','helicopter'], ground:'R', unlock:7, pattern:{alphabet:'GWA',special:'G'} },
  { id:'rail', vehicles:['train','boat','helicopter'], ground:'T', unlock:13, pattern:{alphabet:'GWA',special:'G'} },
  { id:'snow', vehicles:['snowmobile','boat','helicopter'], ground:'S', unlock:19, pattern:{alphabet:'GWA',special:'G'} },
  { id:'deep', vehicles:['car','submarine','helicopter'], ground:'L', unlock:25, pattern:{alphabet:'LWU',special:'U',edge:'W'} },
  { id:'flight', vehicles:['car','boat','plane'], ground:'L', unlock:31, pattern:{alphabet:'LWF',special:'F',edge:'L'} },
  { id:'marsh', vehicles:['car','hovercraft','helicopter'], ground:'L', unlock:37, pattern:{alphabet:'GMA',special:'M'} },
  { id:'wreck', vehicles:['monstertruck','boat','helicopter'], ground:'B', unlock:43, pattern:{alphabet:'GWA',special:'G'} },
  { id:'mountain', vehicles:['drill','boat','helicopter'], ground:'L', unlock:49, pattern:{alphabet:'LWD',special:'D'} },
  { id:'rapids', vehicles:['bike','jetski','helicopter'], ground:'R', unlock:55, pattern:{alphabet:'GKA',special:'K'} },
  { id:'canyon', vehicles:['car','boat','glider'], ground:'L', unlock:61, pattern:{alphabet:'LWC',special:'C',edge:'L'} },
  { id:'space', vehicles:['car','hovercraft','rocket'], ground:'L', unlock:67, pattern:{alphabet:'LMO',special:'O',edge:'L'} },
];
export const LABELS={ L:'Land', R:'Rough land', W:'Surface water', A:'Air transfer', S:'Snow', U:'Underwater', T:'Rail', F:'Flight corridor',
  M:'Marsh', B:'Wreck yard', K:'Rapids', D:'Mountain tunnel', C:'Canyon glide', O:'Rocket corridor' };
// Each vehicle is fastest on its own terrain; the original eight keep their original values on the original terrains.
export const SPEEDS={
  car:{L:12,R:7.2,W:4,A:0,S:4,U:0,T:4,F:0,M:3,B:2,K:0,D:0,C:0,O:0},
  bike:{L:10,R:12,W:2,A:0,S:4,U:0,T:4,F:0,M:4,B:5,K:0,D:0,C:0,O:0},
  snowmobile:{L:4,R:2.4,W:0,A:0,S:12,U:0,T:0,F:0,M:5,B:0,K:0,D:0,C:0,O:0},
  train:{L:0,R:0,W:0,A:0,S:0,U:0,T:18,F:0,M:0,B:0,K:0,D:0,C:0,O:0},
  boat:{L:4,R:4,W:12,A:0,S:0,U:0,T:0,F:0,M:5,B:0,K:4,D:0,C:0,O:0},
  submarine:{L:0,R:0,W:6,A:0,S:0,U:12,T:0,F:0,M:0,B:0,K:0,D:0,C:0,O:0},
  helicopter:{L:8,R:8,W:8,A:12,S:8,U:0,T:8,F:10,M:8,B:8,K:8,D:0,C:10,O:0},
  plane:{L:0,R:0,W:0,A:0,S:0,U:0,T:0,F:18,M:0,B:0,K:0,D:0,C:0,O:0},
  hovercraft:{L:7,R:5,W:10,A:0,S:6,U:0,T:0,F:0,M:12,B:0,K:6,D:0,C:0,O:0},
  monstertruck:{L:9,R:9,W:2,A:0,S:5,U:0,T:4,F:0,M:4,B:12,K:0,D:0,C:0,O:0},
  drill:{L:5,R:5,W:0,A:0,S:3,U:0,T:0,F:0,M:0,B:6,K:0,D:12,C:0,O:0},
  jetski:{L:0,R:0,W:10,A:0,S:0,U:0,T:0,F:0,M:3,B:0,K:12,D:0,C:0,O:0},
  glider:{L:0,R:0,W:0,A:9,S:0,U:0,T:0,F:0,M:0,B:0,K:0,D:0,C:16,O:0},
  rocket:{L:0,R:0,W:0,A:0,S:0,U:0,T:0,F:0,M:0,B:0,K:0,D:0,C:0,O:24},
};
export const SUPPORTED = new Set(['L','R','W','S','T','M','B','K','D']);
export const TRANSFERS = new Set(['A','U','F','C','O']);
export const FLIGHT = new Set(['F','C','O']); // corridors only a specialist flyer crosses; land on both ends
export const CURRENT_TERRAINS=['W','U','K'],WIND_TERRAINS=['A','F','C'];
export const clone = x => structuredClone(x);
export const mod = (x,n) => ((x%n)+n)%n;
export function hash(s){let a=2166136261;for(const c of String(s)){a^=c.charCodeAt(0);a=Math.imul(a,16777619);}return a>>>0;}
export function speed(family,slot,leg,factor=1){
  const vehicle=FAMILIES[family].vehicles[slot];
  let v=SPEEDS[vehicle]?.[leg.t]??0;
  if(leg.m==='current' && ['boat','submarine','jetski','hovercraft'].includes(vehicle))v*=leg.dir>0?1.25:0.75;
  if(leg.m==='wind' && ['plane','helicopter','glider'].includes(vehicle))v*=leg.dir>0?1.2:0.65;
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
  if(['L','R','S','T','B','D'].includes(terrain))d=p.id==='A'?-100:100;
  if(['W','U','K','M'].includes(terrain))d=p.id==='A'?100:-100;
  return Math.max(20,p.reaction+d);
}
export const within=(x,a,b)=>Number.isFinite(x)&&x>=a&&x<=b;
