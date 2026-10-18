// Standalone QA surface. No ytgame, production SDK, network analytics or real ads.
const ui=id=>document.getElementById(id);
const qaStorageKey='shape-shifting-level-audit-preview-v1';
const qaStorage={reads:0,writes:0,async load(){this.reads++;return localStorage.getItem(qaStorageKey);},async save(value){this.writes++;localStorage.setItem(qaStorageKey,value);}};
const qaCatalog=new Catalog(QA_BANK.recipes,QA_FOUNDATIONS.recipes);
let qaSession=new Session(qaCatalog,qaStorage),qaBusy=false,qaLive=false,qaAuto=false,qaLast=0,qaPointer=null,qaMessage='Loading standalone diagnostic…',qaSoak=null;
const qaEvidence={scope:'standalone diagnostic; no production graphics/host',errors:[],nativeActions:0,transitions:0,soak:null};
window.addEventListener('error',e=>{qaEvidence.errors.push(String(e.message));qaRender();});
window.addEventListener('unhandledrejection',e=>{qaEvidence.errors.push(String(e.reason));qaRender();});
function qaRemember(){ui('evidence').textContent=JSON.stringify({...qaEvidence,reads:qaStorage.reads,writes:qaStorage.writes,frontier:qaSession.data.frontier,serial:qaSession.race?.serial,saveBytes:localStorage.getItem(qaStorageKey)?.length??0},null,2);}
function qaRender(){
 const race=qaSession.race;ui('status').textContent=qaMessage;
 ui('progress').textContent=`Journey stage ${qaSession.data.frontier} · ${QA_BANK.recipes.length} audited bank courses + ${QA_FOUNDATIONS.recipes.length} teaching courses`;
 ui('clock').textContent=race?`${race.state} · ${(race.ms/1000).toFixed(2)} active s · ${(race.stopwatch/1000).toFixed(2)} record s`:'Ready';
 ui('play').disabled=qaBusy||!qaSession.loaded;ui('next').disabled=qaBusy||race?.state!=='RESULT';ui('replay').disabled=ui('next').disabled;
 ui('pause').textContent=race?.pauses.has('menu')?'Resume':'Pause';
 for(let slot=0;slot<3;slot++){
  const button=ui(`slot${slot}`),vehicle=race?FAMILIES[race.course.family].vehicles[slot]:['car','boat','helicopter'][slot];
  button.textContent=`${['Ground','Water','Air'][slot]}: ${vehicle}`;button.setAttribute('aria-label',`${['Ground','Water','Air'][slot]}: ${vehicle}`);button.setAttribute('aria-pressed',String(race?.player.slot===slot));button.disabled=qaBusy||race?.state!=='RACING'||!!race.pauses.size;
 }
 if(race){
  const leg=race.course.blocks[race.player.block]?.options[race.player.choice];
  ui('terrain').textContent=race.result?`${race.result.medal} · Rank ${race.result.rank} · ${(race.result.time/1000).toFixed(3)} s`:`Section ${race.player.block+1}/${race.course.blocks.length}: ${LABELS[leg.t]} · selected ${FAMILIES[race.course.family].vehicles[race.player.slot]}`;
  ui('plan').textContent=race.course.blocks.map((b,i)=>`${i+1}: ${LABELS[b.options[0].t]} ${b.options[0].d}u${b.options.length>1?' (route choice)':''}`).join(' → ');
  const fork=race.course.blocks.findIndex((b,i)=>i>race.player.block&&b.options.length>1);ui('fork').hidden=fork<0;
  if(fork>=0)ui('forkLabel').textContent=`Choose route for section ${fork+1}`;
  for(let i=0;i<3;i++){const e=race.entrants[i];ui(`entrant${i}`).value=e.finish!==null?100:(e.block+e.pos/(race.course.blocks[e.block]?.options[e.choice]?.d??1))/race.course.blocks.length*100;}
 }else{ui('terrain').textContent='Choose a course or start the saved journey.';ui('plan').textContent='Ground / Water / Air remain in the same positions.';ui('fork').hidden=true;}
 ui('saveState').textContent=qaSession.protected?`Protected save: ${qaSession.error}`:qaSession.unsaved?'Unsaved changes':'Acknowledged preview save';qaRemember();
}
async function qaAction(name,value){
 if(qaBusy&& !['slot','branch'].includes(name))return;
 qaEvidence.nativeActions++;
 try{
  if(name==='slot'){qaMessage=qaSession.race?.commandSlot(Number(value))?'Switch committed for next tick.':'That vehicle is incompatible here; current vehicle retained.';}
  else if(name==='branch'){
   const r=qaSession.race,b=r?.course.blocks.findIndex((x,i)=>i>r.player.block&&x.options.length===2);qaMessage=b>=0&&r.chooseBranch(b,Number(value))?'Route chosen.':'No available upcoming fork.';
  }else if(name==='decision'){
   const r=qaSession.race;if(r?.state==='RACING'&&!r.pauses.size){const b=r.player.block;let guard=0;do{qaSession.step(20);}while(r.state==='RACING'&&r.player.block===b&&++guard<4000);await qaSession.flush();}
  }else if(name==='step'){for(let i=0;i<50;i++)qaSession.step(20);await qaSession.flush();}
  else if(name==='pause'){const r=qaSession.race;if(r){r.pauses.has('menu')?r.resume('menu'):r.pause('menu');qaPointer=null;qaMessage=r.pauses.size?'Race paused.':'Race resumed.';}}
  else if(name==='save'){qaBusy=true;await qaSession.flush();qaMessage='Preview progress acknowledged.';}
  else if(name==='play'){
   qaBusy=true;const selected=ui('family').value;
   if(selected==='journey')await qaSession.start();else await qaSession.start({id:qaCatalog.pick(Number(selected),0,[]),replay:true});qaEvidence.transitions++;qaMessage='Race started. Tap a vehicle, then Advance to next decision.';
  }else if(name==='next'||name==='replay'){qaBusy=true;await qaSession.next({replay:name==='replay'});qaEvidence.transitions++;qaMessage='Next race ready.';}
  else if(name==='reset'){
   qaBusy=true;qaLive=false;qaSession.dispose();const d=initialData();d.frontier=Number(value);await qaStorage.save(JSON.stringify(d));qaSession=new Session(qaCatalog,qaStorage);await qaSession.load();qaMessage='Disposable preview progress reset.';
  }else if(name==='live'){qaLive=!qaLive;qaLast=0;qaMessage=qaLive?'Real-time diagnostic clock enabled.':'Manual diagnostic clock enabled.';}
  else if(name==='auto'){qaAuto=!qaAuto;if(qaSession.race){qaSession.race.player.auto=qaAuto;qaSession.race.player.latency=250;}qaMessage=qaAuto?'Synthetic 250 ms controller enabled (not a human test).':'Manual player control enabled.';}
  else if(name==='soak'){
   qaBusy=true;qaSoak={start:performance.now(),startTransitions:qaEvidence.transitions,initialHeap:performance.memory?.usedJSHeapSize??null,lastSave:0};qaAuto=true;qaLive=true;qaLast=0;
   if(!qaSession.race||qaSession.race.state==='RESULT'){await qaSession.start({latency:250});qaEvidence.transitions++;}
   else{qaSession.race.player.auto=true;qaSession.race.player.latency=250;}
   qaMessage='10-minute accelerated diagnostic stability run: synthetic controls, not human enjoyment.';
  }else if(name==='hostpause'){qaSession.pauseHost();qaPointer=null;qaMessage='Simulated host pause.';}
  else if(name==='hostresume'){await qaSession.resumeHost();qaMessage='Simulated host resumed.';}
 }catch(e){qaMessage=String(e.message);qaEvidence.errors.push(qaMessage);}
 finally{qaBusy=false;qaRender();}
}
function qaCancel(e){if(e?.pointerId!==undefined&&qaPointer?.id!==e.pointerId)return;qaPointer=null;}
document.addEventListener('pointerdown',e=>{
 const button=e.target.closest('button[data-action="slot"]');if(!button||button.disabled||qaPointer||e.button>0||e.isPrimary===false)return;
 qaPointer={id:e.pointerId,button,x:e.clientX,y:e.clientY};button.setPointerCapture(e.pointerId);
});
document.addEventListener('pointerup',e=>{
 if(!qaPointer||qaPointer.id!==e.pointerId)return;const p=qaPointer;qaPointer=null;const r=p.button.getBoundingClientRect();
 if(Math.hypot(e.clientX-p.x,e.clientY-p.y)<=12&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom)qaAction('slot',p.button.dataset.value);
});
document.addEventListener('pointercancel',qaCancel);document.addEventListener('lostpointercapture',qaCancel);window.addEventListener('resize',qaCancel);
document.addEventListener('click',e=>{const button=e.target.closest('button[data-action]');if(!button||button.disabled)return;if(button.dataset.action==='slot'&&e.detail>0)return;qaAction(button.dataset.action,button.dataset.value);});
document.addEventListener('keydown',e=>{
 if(e.repeat)return;if(['1','2','3'].includes(e.key)){qaAction('slot',Number(e.key)-1);e.preventDefault();}
 else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){qaAction('branch',e.key==='ArrowLeft'?0:1);e.preventDefault();}
 else if(e.key==='Escape')qaAction('pause');
});
let qaRendering=false,qaSaved=0;
async function qaFrame(now){
 if(qaLive&&!qaRendering){
  qaRendering=true;
  const delta=qaLast?Math.min(1000,now-qaLast):0;qaLast=now;
  const r=qaSession.race;
  if(r?.state==='RACING'){
   if(qaAuto){r.player.auto=true;r.player.latency=250;}
   qaSession.step(delta*(qaSoak?4:1));
  }
  if(r?.state==='RESULT'&&qaSoak){await qaSession.next({latency:250});qaEvidence.transitions++;}
  if(now-qaSaved>5000&&qaSession.loaded&&!qaSession.hostPaused){try{await qaSession.flush();}catch(e){qaEvidence.errors.push(String(e.message));}qaSaved=now;}
  if(qaSoak){const elapsed=now-qaSoak.start;qaEvidence.soak={wallMs:Math.round(elapsed),transitions:qaEvidence.transitions-qaSoak.startTransitions,errors:qaEvidence.errors.length,heap:performance.memory?.usedJSHeapSize??null};
   if(elapsed>=600000){qaLive=false;qaEvidence.soak.complete=true;qaEvidence.soak.initialHeap=qaSoak.initialHeap;qaSoak=null;qaMessage='10-minute accelerated diagnostic soak completed.';await qaSession.flush();}
  }
  qaRender();qaRendering=false;
 }
 requestAnimationFrame(qaFrame);
}
await qaSession.load();qaMessage=qaSession.loaded?'Standalone QA ready. No production graphics or host services enabled.':`Recovery: ${qaSession.error}`;qaRender();requestAnimationFrame(qaFrame);
