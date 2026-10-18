// Game shell: boots the engine session, drives the fixed 20 ms simulation and draws it with three.js.
import bank from '../../runtime/data/bank.json';
import foundations from '../../runtime/data/foundations.json';
import {WebGLRenderer} from 'three';
import {Catalog,Session} from '../../source/session.mjs';
import {Race,advanceEntrant} from '../../source/race.mjs';
import {FAMILIES,LABELS,TICK,speed,clone} from '../../source/rules.mjs';
import {World} from './world.mjs';
import {liveOrder,progress,gateState} from './track.mjs';
import {connectHost} from './host.mjs';

const $=id=>document.getElementById(id);
const ROLES=['Ground','Water','Air'],SLOT_BG=['#5d9b3c','#2f8fd8','#6aa9df'],PLACES=['1st','2nd','3rd'],MEDALS=['🥇','🥈','🥉'];
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const host=connectHost(),root=$('game-root'),canvas=$('game-canvas');
const renderer=new WebGLRenderer({canvas,antialias:(devicePixelRatio||1)<2,powerPreference:'high-performance',stencil:false});
let pixelRatio=Math.min(2,devicePixelRatio||1);renderer.setPixelRatio(pixelRatio);
const world=new World(renderer);

let session=null,mode='boot',ghost=null,preview=null,acc=0,last=0,hostPaused=false,finishAt=0,saveAt=0,busy=false,iconFamily=-1,slowFrames=0;
const hudCache={};
const setText=(el,key,value)=>{if(hudCache[key]!==value){hudCache[key]=value;el.textContent=value;}};

function resize(){const w=root.clientWidth||innerWidth,h=root.clientHeight||innerHeight;renderer.setSize(w,h,false);world.resize(w,h);}
new ResizeObserver(resize).observe(root);addEventListener('resize',resize);
addEventListener('error',()=>host.logError());addEventListener('unhandledrejection',()=>host.logError());

function show(id,visible){$(id).hidden=!visible;}
function save(){if(session?.loaded&&!hostPaused&&session.unsaved)session.flush().catch(()=>{});}
function stageLabel(course){return `Stage ${session.data.frontier} · ${FAMILIES[course.family].id[0].toUpperCase()+FAMILIES[course.family].id.slice(1)}`;}

function prepareCourse(course){
  world.setCourse(course);
  if(iconFamily!==course.family){
    iconFamily=course.family;let icons=[];
    try{icons=world.icons(course.family,SLOT_BG);}catch(e){console.warn('icon render failed',e);}
    FAMILIES[course.family].vehicles.forEach((vehicle,slot)=>{
      const button=document.querySelector(`[data-slot="${slot}"]`);button.querySelector('img').src=icons[slot]??'';
      button.querySelector('b').textContent=vehicle[0].toUpperCase()+vehicle.slice(1);button.setAttribute('aria-label',`${ROLES[slot]}: ${vehicle}`);
    });
  }
}
function showTitle(){
  // A saved unfinished race resumes; otherwise the title previews the next queued course.
  const saved=session.race?.state==='RACING'?session.race:null,course=saved?.course??session.catalog.course(session.data.queue[0]);
  preview=saved??new Race(course,{stage:session.data.frontier});prepareCourse(course);
  $('stage').textContent=saved?`Continue · ${stageLabel(course)}`:stageLabel(course);
  $('play').disabled=false;show('title',true);mode='title';
}
function startRace(race){
  if(!race)return;
  prepareCourse(race.course);race.resume('menu');ghost=null;acc=0;mode='racing';
  show('title',false);show('result',false);show('paused',false);show('hud',true);
  const go=$('go');go.hidden=false;go.classList.remove('flash');void go.offsetWidth;go.classList.add('flash');
}
async function run(task){
  if(busy)return;busy=true;
  try{startRace(await task());}catch(e){console.error(e);$('stage').textContent=String(e.message);show('title',true);mode='title';}
  finally{busy=false;}
}
const play=()=>run(()=>session.race?.state==='RACING'?session.race:session.race?.state==='RESULT'?session.next():session.start());
const next=replay=>run(()=>session.next({replay}));

function finish(now){
  const race=session.race;mode='finishing';finishAt=now;acc=0;
  ghost={course:race.course,entrants:clone(race.entrants),ms:race.ms,end:race.ms+30000};
  session.flush().then(()=>host.sendScore(session.data.frontier-1)).catch(()=>{});
}
function showResult(){
  const race=session.race,r=race.result,record=session.data.records.find(x=>x.id===race.course.id&&x.difficulty===race.difficulty&&x.assisted===race.assisted);
  $('medal').textContent=MEDALS[r.rank-1];$('place').textContent=`${PLACES[r.rank-1]} place`;
  $('time').textContent=r.genuine?`${(r.time/1000).toFixed(2)} s${record&&record.time<r.time?` · best ${(record.time/1000).toFixed(2)} s`:''}`:'Switch vehicles at least once to clear the stage';
  show('result',true);show('hud',false);mode='result';$('next').focus({preventScroll:true});
}
function pause(){const race=session?.race;if(mode!=='racing'||!race||race.pauses.has('menu'))return;race.pause('menu');show('paused',true);$('resume').focus({preventScroll:true});save();}
function resume(){const race=session?.race;if(!race?.pauses.has('menu'))return;race.resume('menu');acc=0;show('paused',false);}

host.onPause(()=>{
  if(hostPaused||!session)return;hostPaused=true;session.pauseHost();session.flush({final:true}).catch(()=>{});
},async()=>{
  if(!hostPaused||!session)return;hostPaused=false;last=0;await session.resumeHost();
  if(mode==='racing')pause();
});

// Input: slot taps commit on release within 12 CSS px; horizontal swipes pick fork routes.
function command(slot){
  const race=session?.race;if(mode!=='racing'||!race||race.pauses.size)return;
  if(!race.commandSlot(slot)){const b=document.querySelector(`[data-slot="${slot}"]`);b.classList.remove('nope');void b.offsetWidth;b.classList.add('nope');}
}
function branch(choice){
  const race=session?.race;if(mode!=='racing'||!race)return;
  const b=race.course.blocks.findIndex((x,i)=>i>race.player.block&&x.options.length===2);if(b>=0)race.chooseBranch(b,choice);
}
let pointer=null;
root.addEventListener('pointerdown',e=>{
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
  ({play,next:()=>next(false),replay:()=>next(true),pause,resume})[b.id]?.();
});
document.addEventListener('keydown',e=>{
  if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
  if(['1','2','3'].includes(e.key)){command(Number(e.key)-1);e.preventDefault();}
  else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){branch(e.key==='ArrowLeft'?0:1);e.preventDefault();}
  else if(e.key==='Escape'){if(mode==='racing')session.race.pauses.has('menu')?resume():pause();}
  else if((e.key==='Enter'||e.key===' ')&&!e.target.closest?.('button')){
    if(mode==='title')play();else if(mode==='result')next(false);else if(mode==='racing'&&session.race.pauses.has('menu'))resume();else return;
    e.preventDefault();
  }
});

function updateHud(race,entrants){
  const course=race.course,n=course.blocks.length,player=entrants[0];
  setText($('rank'),'rank',PLACES[liveOrder({course,entrants}).indexOf(0)]);
  entrants.forEach((e,i)=>{const left=`${(progress(course,e)/n*100).toFixed(1)}%`;if(hudCache[`dot${i}`]!==left){hudCache[`dot${i}`]=left;$(`dot${i}`).style.left=left;}});
  setText($('clock'),'clock',(race.stopwatch/1000).toFixed(1));
  const b=Math.min(player.block,n-1),leg=course.blocks[b].options[player.choice]??course.blocks[b].options[0],after=course.blocks[b+1]?.options[0];
  setText($('terrain'),'terrain',`${LABELS[leg.t]}${after?` → ${LABELS[after.t]}`:' → Finish'}`);
  for(let slot=0;slot<3;slot++){
    const button=$(`slot${slot}`),pressed=String(player.slot===slot),usable=speed(course.family,slot,leg)>0;
    if(hudCache[`p${slot}`]!==pressed){hudCache[`p${slot}`]=pressed;button.setAttribute('aria-pressed',pressed);}
    if(hudCache[`u${slot}`]!==usable){hudCache[`u${slot}`]=usable;button.classList.toggle('unusable',!usable);}
  }
  const fork=course.blocks.findIndex((x,i)=>i>player.block&&x.options.length===2);
  if(hudCache.fork!==fork){hudCache.fork=fork;show('fork',fork>=0);}
  if(fork>=0){
    const plan=player.planned[fork]??0,gate=course.blocks[fork].options[0].g;
    for(const btn of document.querySelectorAll('[data-branch]'))btn.setAttribute('aria-pressed',String(Number(btn.dataset.branch)===plan));
    setText($('gate'),'gate',gate?(gateState(gate,race.ms).open?'gate open':'gate closed'):'');
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
    }
    entrants=race.entrants;ms=race.ms;
    if(race.state==='RESULT')finish(now);else if(now-saveAt>5000){saveAt=now;save();}
    if(mode==='racing')updateHud(race,entrants);
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
  resize();world.render();host.firstFrameReady();
  await new Promise(requestAnimationFrame);
  session=new Session(new Catalog(bank.recipes,foundations.recipes),host.storage);
  if(!await session.load()){$('stage').textContent=`Saved progress could not be read (${session.error}). It has been left untouched.`;return;}
  showTitle();world.update(preview.entrants,0,1,0,reducedMotion);world.render();
  host.gameReady();requestAnimationFrame(loop);
}
boot();
