// Game shell: boots the engine session, drives the fixed 20 ms simulation, draws it with three.js and voices it with Web Audio.
import bank from '../../runtime/data/bank.json';
import foundations from '../../runtime/data/foundations.json';
import {WebGLRenderer} from 'three';
import {Catalog,Session} from '../../source/session.mjs';
import {Race,advanceEntrant} from '../../source/race.mjs';
import {FAMILIES,TICK,speed,bestSlot,clone} from '../../source/rules.mjs';
import {World} from './world.mjs';
import {liveOrder,progress,gateState,hoopDistances} from './track.mjs';
import {Sound} from './audio.mjs';
import {connectHost} from './host.mjs';

const $=id=>document.getElementById(id);
const ROLES=['Ground','Water','Air'],SLOT_BG=['#5d9b3c','#2f8fd8','#6aa9df'],MEDALS=['var(--gold)','var(--silver)','var(--bronze)'];
const SOUND_KEY='shape-shifting-sound',reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const host=connectHost(),root=$('game-root'),canvas=$('game-canvas');
const renderer=new WebGLRenderer({canvas,antialias:(devicePixelRatio||1)<2,powerPreference:'high-performance',stencil:false});
let pixelRatio=Math.min(2,devicePixelRatio||1);renderer.setPixelRatio(pixelRatio);
const world=new World(renderer);
const sound=new Sound({muted:(()=>{try{return localStorage.getItem(SOUND_KEY)==='off';}catch{return false;}})()});
const buzz=pattern=>{try{navigator.vibrate?.(pattern);}catch{}};

let session=null,mode='boot',ghost=null,preview=null,acc=0,last=0,hostPaused=false,finishAt=0,saveAt=0,busy=false,iconFamily=-1,slowFrames=0,cue=null;
const shown={};
const once=(key,value,apply)=>{if(shown[key]!==value){shown[key]=value;apply(value);}};

function resize(){const w=root.clientWidth||innerWidth,h=root.clientHeight||innerHeight;renderer.setSize(w,h,false);world.resize(w,h);}
new ResizeObserver(resize).observe(root);addEventListener('resize',resize);
addEventListener('error',()=>host.logError());addEventListener('unhandledrejection',()=>host.logError());

function show(id,visible){$(id).hidden=!visible;}
function save(){if(session?.loaded&&!hostPaused&&session.unsaved)session.flush().catch(()=>{});}
function syncSoundButtons(){for(const b of document.querySelectorAll('.sound'))b.setAttribute('aria-pressed',String(!sound.muted));}

function prepareCourse(course){
  world.setCourse(course);
  if(iconFamily!==course.family){
    iconFamily=course.family;let icons=[];
    try{icons=world.icons(course.family,SLOT_BG);}catch(e){console.warn('icon render failed',e);}
    FAMILIES[course.family].vehicles.forEach((vehicle,slot)=>{
      const button=$(`slot${slot}`);button.querySelector('img').src=icons[slot]??'';button.setAttribute('aria-label',`${ROLES[slot]}: ${vehicle}`);
    });
  }
}
function showTitle(){
  // A saved unfinished race resumes; otherwise the title previews the next queued course.
  const saved=session.race?.state==='RACING'?session.race:null,course=saved?.course??session.catalog.course(session.data.queue[0]);
  preview=saved??new Race(course,{stage:session.data.frontier});prepareCourse(course);
  $('play').disabled=false;show('title',true);mode='title';
}
// Per-race memory of what the player last heard and saw, so cues fire on changes only.
function freshCue(race){
  const p=race.player,block=race.course.blocks[Math.min(p.block,race.course.blocks.length-1)],leg=block.options[p.choice]??block.options[0];
  return {slot:p.slot,clean:p.clean,block:p.block,medium:medium(FAMILIES[race.course.family].vehicles[p.slot],leg.t,'ground'),
    place:liveOrder(race).indexOf(0),hoops:0,gate:undefined,wait:p.waitMs,stuck:0,warnAt:350,offBest:0};
}
function startRace(race){
  if(!race)return;
  prepareCourse(race.course);race.resume('menu');ghost=null;acc=0;mode='racing';cue=freshCue(race);
  show('title',false);show('result',false);show('paused',false);show('hud',true);
  sound.play('go');
}
async function run(task){
  if(busy)return;busy=true;
  try{startRace(await task());}catch(e){console.error(e);show('title',true);mode='title';}
  finally{busy=false;}
}
const play=()=>run(()=>session.race?.state==='RACING'?session.race:session.race?.state==='RESULT'?session.next():session.start());
const next=replay=>run(()=>session.next({replay}));

function finish(now){
  const race=session.race,rank=race.result.rank;mode='finishing';finishAt=now;acc=0;
  ghost={course:race.course,entrants:clone(race.entrants),ms:race.ms,end:race.ms+30000};
  sound.engine(FAMILIES[race.course.family].vehicles[race.player.slot],0,false);sound.play('finish',rank);buzz([20,40,30]);
  if(rank===1)world.confetti(0);else world.sparkle(0,0xffffff);
  setHint(-1);
  session.flush().then(()=>host.sendScore(session.data.frontier-1)).catch(()=>{});
}
function showResult(){
  const r=session.race.result;
  $('medal').style.setProperty('--medal',r.genuine?MEDALS[r.rank-1]:'var(--none)');
  show('result',true);show('hud',false);mode='result';$('next').focus({preventScroll:true});
  if(r.genuine)sound.play('medal',r.rank);
}
function pause(){
  const race=session?.race;if(mode!=='racing'||!race||race.pauses.has('menu'))return;
  race.pause('menu');show('paused',true);$('resume').focus({preventScroll:true});save();
}
function resume(){const race=session?.race;if(!race?.pauses.has('menu'))return;race.resume('menu');acc=0;show('paused',false);}

host.onPause(()=>{
  if(hostPaused||!session)return;hostPaused=true;session.pauseHost();sound.suspend();session.flush({final:true}).catch(()=>{});
},async()=>{
  if(!hostPaused||!session)return;hostPaused=false;last=0;sound.resume();await session.resumeHost();
  if(mode==='racing')pause();
});
sound.setHostEnabled(host.audioEnabled());host.onAudioChange(enabled=>sound.setHostEnabled(enabled!==false));

// Input: slot taps commit on release within 12 CSS px; horizontal swipes pick fork routes.
function command(slot){
  const race=session?.race;if(mode!=='racing'||!race||race.pauses.size)return;
  if(!race.commandSlot(slot)){
    const b=$(`slot${slot}`);b.classList.remove('nope');void b.offsetWidth;b.classList.add('nope');sound.play('nope');buzz(15);
  }
}
function branch(choice){
  const race=session?.race;if(mode!=='racing'||!race)return;
  const b=race.course.blocks.findIndex((x,i)=>i>race.player.block&&x.options.length===2);
  if(b>=0&&race.chooseBranch(b,choice))sound.play('tap');
}
let pointer=null;
root.addEventListener('pointerdown',e=>{
  sound.unlock();
  if(pointer||e.button>0||e.isPrimary===false)return;
  const slot=e.target.closest('[data-slot]');
  if(slot&&slot.disabled)return;
  if(!slot&&e.target.closest('button'))return;
  pointer={id:e.pointerId,x:e.clientX,y:e.clientY,slot};
  if(slot)slot.setPointerCapture?.(e.pointerId);
});
root.addEventListener('pointerup',e=>{
  if(!pointer||pointer.id!==e.pointerId)return;const p=pointer;pointer=null;
  const dx=e.clientX-p.x,dy=e.clientY-p.y;
  if(p.slot){const r=p.slot.getBoundingClientRect();if(Math.hypot(dx,dy)<=12&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom)command(Number(p.slot.dataset.slot));}
  else if(Math.abs(dx)>=24&&Math.abs(dx)>Math.abs(dy))branch(dx<0?0:1);
});
for(const type of ['pointercancel','lostpointercapture'])root.addEventListener(type,e=>{if(pointer?.id===e.pointerId)pointer=null;});
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.dataset.slot!==undefined){if(e.detail===0)command(Number(b.dataset.slot));return;}
  if(b.dataset.branch!==undefined)return branch(Number(b.dataset.branch));
  if(b.classList.contains('sound')){
    sound.setMuted(!sound.muted);try{localStorage.setItem(SOUND_KEY,sound.muted?'off':'on');}catch{}
    syncSoundButtons();sound.play('tap');return;
  }
  sound.play('tap');
  ({play,next:()=>next(false),replay:()=>next(true),pause,resume})[b.id]?.();
});
document.addEventListener('keydown',e=>{
  sound.unlock();
  if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
  if(['1','2','3'].includes(e.key)){command(Number(e.key)-1);e.preventDefault();}
  else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){branch(e.key==='ArrowLeft'?0:1);e.preventDefault();}
  else if(e.key==='Escape'){if(mode==='racing')session.race.pauses.has('menu')?resume():pause();}
  else if((e.key==='Enter'||e.key===' ')&&!e.target.closest?.('button')){
    if(mode==='title')play();else if(mode==='result')next(false);else if(mode==='racing'&&session.race.pauses.has('menu'))resume();else return;
    e.preventDefault();
  }
});

function setHint(slot){once('hint',slot,v=>{for(let i=0;i<3;i++)$(`slot${i}`).classList.toggle('hint',i===v);});}
function medium(type,t,previous){
  if(type==='helicopter'||type==='plane'&&t==='F')return 'air';
  if(type==='submarine'&&t==='U')return 'under';
  if(t==='W'||t==='U')return 'water';
  return t==='A'||t==='F'?previous:'ground';
}
const ENTER={water:'splash',under:'dive',air:'whoosh',ground:'land'};
// Sounds, haptics and the tutorial hint, all driven by changes in engine state.
function cues(race,dt){
  const p=race.player,course=race.course,n=course.blocks.length,b=Math.min(p.block,n-1),block=course.blocks[b];
  const leg=block.options[p.choice]??block.options[0],type=FAMILIES[course.family].vehicles[p.slot],racing=p.finish===null;
  if(p.slot!==cue.slot){cue.slot=p.slot;sound.play('switch',p.slot);buzz(8);}
  if(p.clean>cue.clean){cue.clean=p.clean;sound.play('perfect');world.sparkle(0);}
  if(p.block!==cue.block){cue.block=p.block;cue.hoops=0;if(course.checkpoints.includes(p.block))sound.play('checkpoint');}
  const m=medium(type,leg.t,cue.medium);if(m!==cue.medium){cue.medium=m;if(racing)sound.play(ENTER[m]);}
  if(leg.t==='F'){
    const passed=hoopDistances(block.options[0].d).filter(d=>d<=p.pos).length;
    if(type==='plane')while(cue.hoops<passed){sound.play('hoop',cue.hoops++);world.sparkle(0);}else cue.hoops=passed;
  }
  const place=liveOrder(race).indexOf(0);if(place<cue.place&&racing){sound.play('overtake');buzz(6);}cue.place=place;
  const fork=course.blocks.findIndex((x,i)=>i>=p.block&&x.options.length===2&&x.options[0].g);
  let gateNear=false;
  if(fork>=0){
    const g=course.blocks[fork].options[0].g,direct=fork===p.block?p.choice===0:(p.planned[fork]??0)===0;
    const distance=fork===p.block?g.at-p.pos:fork===p.block+1?leg.d-p.pos+g.at:Infinity;
    gateNear=direct&&distance>0&&distance<45;
    if(gateNear){const open=gateState(g,race.ms).open;if(cue.gate!==undefined&&open!==cue.gate)sound.play(open?'gateOpen':'gateClose');cue.gate=open;}
  }
  if(!gateNear)cue.gate=undefined;
  const waiting=p.waitMs>cue.wait;cue.wait=p.waitMs;
  sound.engine(type,waiting?0:speed(course.family,p.slot,leg)/18,racing);
  const best=bestSlot(course.family,leg),stuck=racing&&speed(course.family,p.slot,leg)<=0;
  cue.stuck=stuck?cue.stuck+dt:0;
  if(stuck&&cue.stuck>=cue.warnAt){sound.play('warn');cue.warnAt+=900;}else if(!stuck)cue.warnAt=350;
  cue.offBest=racing&&p.slot!==best?cue.offBest+dt:0;
  setHint(cue.stuck>350||cue.offBest>(race.stage<=3?600:2500)?best:-1);
}
function updateHud(race){
  const course=race.course,n=course.blocks.length,player=race.player,place=liveOrder(race).indexOf(0);
  once('place',place,v=>{$('place').style.setProperty('--medal',MEDALS[v]);$('place').setAttribute('aria-label',`Position ${v+1}`);});
  race.entrants.forEach((e,i)=>once(`dot${i}`,`${(progress(course,e)/n*100).toFixed(1)}%`,v=>$(`dot${i}`).style.left=v));
  const b=Math.min(player.block,n-1),leg=course.blocks[b].options[player.choice]??course.blocks[b].options[0];
  for(let slot=0;slot<3;slot++){
    once(`p${slot}`,player.slot===slot,v=>$(`slot${slot}`).setAttribute('aria-pressed',String(v)));
    once(`u${slot}`,speed(course.family,slot,leg)>0,v=>$(`slot${slot}`).classList.toggle('unusable',!v));
  }
  const fork=course.blocks.findIndex((x,i)=>i>player.block&&x.options.length===2);
  once('fork',fork>=0,v=>show('fork',v));
  if(fork>=0){
    const plan=player.planned[fork]??0,gate=course.blocks[fork].options[0].g;
    once('plan',plan,v=>{for(const btn of document.querySelectorAll('[data-branch]'))btn.setAttribute('aria-pressed',String(Number(btn.dataset.branch)===v));});
    once('lamp',gate?gateState(gate,race.ms).open:null,v=>{$('lamp').hidden=v===null;$('lamp').classList.toggle('open',!!v);});
  }
}

function loop(now){
  requestAnimationFrame(loop);
  const dt=last?Math.min(.25,(now-last)/1000):0;last=now;
  if(hostPaused||!session)return;
  const race=session.race;let entrants=preview?.entrants,ms=0;
  if(mode==='racing'&&race){
    if(!race.pauses.size){
      acc+=dt*1000;let steps=0;
      while(acc>=TICK&&steps<10&&race.state==='RACING'){world.capture(race.entrants,race.ms);session.step(TICK);acc-=TICK;steps++;}
      if(steps===10)acc=0;
      cues(race,dt*1000);
    }else sound.engine(FAMILIES[race.course.family].vehicles[race.player.slot],0,false);
    entrants=race.entrants;ms=race.ms;
    if(race.state==='RESULT')finish(now);else if(now-saveAt>5000){saveAt=now;save();}
    if(mode==='racing')updateHud(race);
  }
  if((mode==='finishing'||mode==='result')&&ghost){
    // Presentation only: opponents keep racing past the result so the finish does not freeze. No effect on credit.
    acc+=dt*1000;let steps=0;
    while(acc>=TICK&&steps<10&&ghost.ms<ghost.end){world.capture(ghost.entrants,ghost.ms);for(const e of ghost.entrants)advanceEntrant(e,ghost.course,ghost.ms);ghost.ms+=TICK;acc-=TICK;steps++;}
    if(steps===10)acc=0;
    entrants=ghost.entrants;ms=ghost.ms;
    if(mode==='finishing'&&now-finishAt>1300)showResult();
  }
  if(!entrants)return;
  world.update(entrants,ms,mode==='title'?1:Math.min(1,acc/TICK),dt,reducedMotion);world.render();
  // Dynamic resolution: drop pixel ratio while frames stay slow during a race.
  if(mode==='racing'&&dt>0){slowFrames=dt>1/40?slowFrames+1:Math.max(0,slowFrames-1);
    if(slowFrames>90&&pixelRatio>1){pixelRatio=Math.max(1,pixelRatio-.25);renderer.setPixelRatio(pixelRatio);resize();slowFrames=0;}}
}

async function boot(){
  resize();world.render();host.firstFrameReady();syncSoundButtons();sound.music(true,.34);
  await new Promise(requestAnimationFrame);
  session=new Session(new Catalog(bank.recipes,foundations.recipes),host.storage);
  if(!await session.load()){console.warn('save unreadable',session.error);show('problem',true);return;}
  showTitle();world.update(preview.entrants,0,1,0,reducedMotion);world.render();
  host.gameReady();requestAnimationFrame(loop);
}
boot();
