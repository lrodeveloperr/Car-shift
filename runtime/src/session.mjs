import {FAMILIES,hash,clone,within,bestSlot} from './rules.mjs';
import {expand,signature} from './content.mjs';
import {Race,validateRaceSnapshot} from './race.mjs';

export class ProtectedSaveError extends Error{}
export class MemoryStorage{
  constructor(value=null){this.value=value;this.reads=0;this.writes=0;this.fail=false;}
  async load(){this.reads++;return this.value;}
  async save(value){this.writes++;if(this.fail)throw new Error('test storage failure');this.value=value;}
}
export class Catalog{
  constructor(recipes,foundations=[]){
    this.recipes=recipes;this.map=new Map([...recipes,...foundations].map(r=>[r[0],r]));this.foundations=foundations;
    this.families=FAMILIES.map((_,f)=>recipes.filter(r=>r[1]===f));
    this.keys=new Map([...this.map].map(([id,r])=>[id,JSON.stringify(r.slice(1,6))]));
    this.signatures=new Map([...this.map].map(([id,r])=>[id,signature(expand(r))]));
  }
  course(id){const r=this.map.get(id);if(!r)throw new ProtectedSaveError('unknown course version');return expand(r);}
  pick(family,cursor=0,history=[],{forks=null,signatures=[],strict=false}={}){
    const list=this.families[family];if(!list?.length)throw new Error('empty validated family');
    const exact=new Set(history.map(id=>this.keys.get(id))),structures=new Set(signatures);
    for(let i=0;i<list.length;i++){
      const r=list[(cursor+i)%list.length];
      if((forks===null||r[5].length===forks)&&!exact.has(this.keys.get(r[0]))&&!structures.has(this.signatures.get(r[0])))return r[0];
    }
    if(strict)return null;
    // Reward choice is optional: keep exact-layout history when relaxing structural preference.
    for(let i=0;i<list.length;i++){const r=list[(cursor+i)%list.length];if(!exact.has(this.keys.get(r[0])))return r[0];}
    return list[cursor%list.length][0];
  }
}
function shuffle(values,seed){const out=[...values];for(let i=out.length-1;i>0;i--){const j=hash(`${seed}:${i}`)%(i+1);[out[i],out[j]]=[out[j],out[i]];}return out;}
export function initialData(){return {schema:1,revision:0,frontier:1,nextSerial:1,lastCreditedSerial:0,queue:[],history:[],signatures:[],familyCursor:[0,0,0,0,0,0],familyBag:[],bagRound:0,forkBag:[],forkRound:0,records:[],foundationRecords:{},run:null,
  pacing:{firstAttempted:false,firstFinishes:0,initialActive:0,finishesSinceAd:0,activeSinceAd:0,hadReservation:false,consumed:[]},adPending:null,claim:null};}
function encodeRace(snapshot){
  if(!snapshot)return null;
  const {course,checkpoints,...rest}=snapshot;
  return {...clone(rest),courseId:course.id,courseHash:hash(JSON.stringify(course)),checkpoints:checkpoints.map(encodeRace)};
}
function decodeRace(snapshot,catalog,depth=0){
  if(!snapshot)return null;
  if(depth>1||!Array.isArray(snapshot.checkpoints)||snapshot.checkpoints.length>2)throw new ProtectedSaveError('bad checkpoint nesting');
  const {courseId,courseHash,checkpoints,...rest}=snapshot;
  const course=catalog.course(courseId);
  if(hash(JSON.stringify(course))!==courseHash)throw new ProtectedSaveError('changed course requires migration');
  const full={...rest,course,checkpoints:checkpoints.map(x=>decodeRace(x,catalog,depth+1))};validateRaceSnapshot(full);return full;
}
function validateData(d,catalog){
  if(!d||d.schema!==1)throw new ProtectedSaveError('unknown save schema');
  // Schema 1 was diagnostic-only; absent scheduling fields migrate without touching the source.
  d.forkBag??=[];d.forkRound??=0;
  for(const k of ['revision','frontier','nextSerial','lastCreditedSerial','bagRound','forkRound'])if(!Number.isSafeInteger(d[k])||d[k]<0||(['frontier','nextSerial'].includes(k)&&d[k]<1))throw new ProtectedSaveError(`bad ${k}`);
  for(const [k,max]of [['queue',3],['history',64],['signatures',12],['familyCursor',6],['familyBag',6],['records',64],['forkBag',10]])if(!Array.isArray(d[k])||d[k].length>max)throw new ProtectedSaveError(`bad ${k}`);
  if(d.familyCursor.length!==6||d.familyCursor.some(x=>!Number.isSafeInteger(x)||x<0)||d.familyBag.some(x=>!Number.isInteger(x)||x<0||x>5))throw new ProtectedSaveError('bad family scheduling');
  if(d.forkBag.some(x=>!Number.isInteger(x)||x<0||x>2)||new Set(d.familyBag).size!==d.familyBag.length||d.lastCreditedSerial>=d.nextSerial)throw new ProtectedSaveError('bad scheduling/serial order');
  if(d.signatures.some(x=>typeof x!=='string'||x.length>256))throw new ProtectedSaveError('bad signatures');
  for(const id of [...d.queue,...d.history])if(typeof id!=='string'||id.length>96||!catalog.map.has(id))throw new ProtectedSaveError('bad course reference');
  if(!d.pacing||!Array.isArray(d.pacing.consumed)||d.pacing.consumed.length>8)throw new ProtectedSaveError('bad pacing');
  for(const k of ['firstFinishes','finishesSinceAd'])if(!Number.isInteger(d.pacing[k])||!within(d.pacing[k],0,2))throw new ProtectedSaveError('bad finish pacing');
  for(const k of ['initialActive','activeSinceAd'])if(!within(d.pacing[k],0,120000))throw new ProtectedSaveError('bad active pacing');
  if(d.run){if(d.run.serial>=d.nextSerial)throw new ProtectedSaveError('bad run serial');decodeRace(d.run,catalog);}
  if(d.claim&&!['rematch','set'].includes(d.claim.kind))throw new ProtectedSaveError('bad reward type');
  if(d.claim?.kind==='rematch')decodeRace(d.claim.snapshot,catalog);
  if(d.claim?.kind==='set'&&!catalog.map.has(d.claim.id))throw new ProtectedSaveError('bad selected course');
  if(!d.foundationRecords||Array.isArray(d.foundationRecords)||Object.keys(d.foundationRecords).length>36||Object.entries(d.foundationRecords).some(([id,r])=>!/^F(?:0[1-9]|[12][0-9]|3[0-6])$/.test(id)||!r||!Number.isInteger(r.rank)||!within(r.rank,1,3)||!within(r.time,0,86400000)))throw new ProtectedSaveError('bad foundation records');
  if(d.records.some(r=>!catalog.map.has(r.id)||!['standard','expert'].includes(r.difficulty)||!within(r.time,0,86400000)||!Number.isInteger(r.rank)||!within(r.rank,1,3)||typeof r.assisted!=='boolean'||!Number.isInteger(r.clean)||!within(r.clean,0,10)))throw new ProtectedSaveError('bad record');
  for(const k of ['firstAttempted','hadReservation'])if(typeof d.pacing[k]!=='boolean')throw new ProtectedSaveError('bad pacing flags');
  if(d.pacing.consumed.some(x=>!Number.isSafeInteger(x)||x<1||x>=d.nextSerial))throw new ProtectedSaveError('bad consumed reservation');
  if(d.claim){if(!Number.isSafeInteger(d.claim.serial)||d.claim.serial<1||d.claim.serial>=d.nextSerial||typeof d.claim.token!=='string'||d.claim.token.length>96)throw new ProtectedSaveError('bad claim');}
  if(d.adPending&&(!['interstitial','set','rematch'].includes(d.adPending.kind)||typeof d.adPending.token!=='string'||d.adPending.token.length>96))throw new ProtectedSaveError('bad ad reservation');
  return true;
}
export class Session{
  constructor(catalog,storage,{ads=null,enableAdFixtures=false}={}){
    this.catalog=catalog;this.storage=storage;this.ads=ads;this.enableAdFixtures=enableAdFixtures;this.data=initialData();this.race=null;this.loaded=false;this.protected=false;this.unsaved=false;this.ack=0;this.chain=Promise.resolve();this.inFlight=null;this.deferred=null;this.hostPaused=false;this.epoch=0;this.loadPromise=null;this.disposed=false;
  }
  async load(){
    if(this.hostPaused){if(!this.bootWait)this.bootWait=new Promise(resolve=>{this.bootResolve=resolve;});return this.bootWait;}
    if(this.loadPromise)return this.loadPromise;
    const epoch=++this.epoch;
    this.loadPromise=(async()=>{
      try{
        const raw=await this.storage.load();if(epoch!==this.epoch||this.disposed)return false;
        let d;
        if(raw===null||raw===undefined||raw===''||raw==='null')d=initialData();
        else if(typeof raw==='string'){
          if(new TextEncoder().encode(raw).length>=65536)throw new ProtectedSaveError('oversized save');
          try{d=JSON.parse(raw);}catch{throw new ProtectedSaveError('malformed nonempty save');}
          if(d&&typeof d==='object'&&Object.keys(d).length===0)d=initialData();
        }else if(raw&&typeof raw==='object'&&Object.keys(raw).length===0)d=initialData();else d=clone(raw);
        validateData(d,this.catalog);this.data=d;this.loaded=true;this.protected=false;this.ack=d.revision;
        if(d.adPending){d.adPending=null;this.dirty();} // unknown reservation is spent, never rewarded/re-requested
        if(d.run)this.race=Race.restore(decodeRace(d.run,this.catalog));
        if(this.hostPaused)this.race?.pause('host');this.fillQueue();return true;
      }catch(e){this.protected=true;this.loaded=false;this.error=String(e.message);return false;}
    })();return this.loadPromise;
  }
  async retryLoad(){if(this.loaded)return true;this.loadPromise=null;return this.load();}
  dirty(){if(this.data.revision>=Number.MAX_SAFE_INTEGER)throw new Error('revision migration required');this.data.revision++;this.unsaved=true;}
  fillQueue(){
    if(!this.loaded)return;
    while(this.data.queue.length<3){
      const stage=this.data.frontier+this.data.queue.length;
      if(stage<=this.catalog.foundations.length){this.data.queue.push(this.catalog.foundations[stage-1][0]);continue;}
      if(!this.data.familyBag.length){this.data.familyBag=shuffle([0,1,2,3,4,5],++this.data.bagRound);const last=this.data.queue.length?this.catalog.map.get(this.data.queue.at(-1))[1]:this.data.history.length?this.catalog.map.get(this.data.history.at(-1))[1]:-1;
        if(this.data.familyBag[0]===last)[this.data.familyBag[0],this.data.familyBag[1]]=[this.data.familyBag[1],this.data.familyBag[0]];}
      if(!this.data.forkBag.length)this.data.forkBag=shuffle([0,0,0,1,1,1,1,1,2,2],++this.data.forkRound);
      const f=this.data.familyBag.shift(),avoid=[...this.data.history,...this.data.queue];
      const signatures=[...this.data.signatures,...this.data.queue.map(id=>this.catalog.signatures.get(id))];
      // Reserve feasible fork counts for the remaining family positions in this ten-stage bag.
      // Independent greedy bags can otherwise strand a flight family with an unavailable two-fork layout.
      const forecast=[];let familyRest=[...this.data.familyBag],round=this.data.bagRound,last=f;
      for(let n=1;n<this.data.forkBag.length;n++){
        if(!familyRest.length){familyRest=shuffle([0,1,2,3,4,5],++round);if(familyRest[0]===last)[familyRest[0],familyRest[1]]=[familyRest[1],familyRest[0]];}
        last=familyRest.shift();forecast.push(last);
      }
      const feasible=(counts,available,i=0,memo=new Map())=>{
        if(i===available.length)return counts.every(n=>n===0);
        const key=`${i}:${counts.join(',')}`;if(memo.has(key))return memo.get(key);
        for(let forks=0;forks<3;forks++)if(counts[forks]&&available[i][forks]){const next=[...counts];next[forks]--;if(feasible(next,available,i+1,memo)){memo.set(key,true);return true;}}
        memo.set(key,false);return false;
      };
      let id=null,bagIndex=-1;
      const tried=new Set();
      for(let i=0;i<this.data.forkBag.length;i++){
        const forks=this.data.forkBag[i];if(tried.has(forks))continue;tried.add(forks);
        const candidate=this.catalog.pick(f,this.data.familyCursor[f],avoid,{forks,signatures,strict:true});if(!candidate)continue;
        const counts=[0,1,2].map(n=>this.data.forkBag.filter(x=>x===n).length);counts[forks]--;
        const available=forecast.map(nextFamily=>[0,1,2].map(n=>!!this.catalog.pick(nextFamily,this.data.familyCursor[nextFamily],[...avoid,candidate],{forks:n,signatures:[...signatures,this.catalog.signatures.get(candidate)],strict:true})));
        if(feasible(counts,available)){id=candidate;bagIndex=i;break;}
      }
      if(!id)throw new Error('validated bank exhausted under variety constraints');
      this.data.forkBag.splice(bagIndex,1);this.data.familyCursor[f]++;
      this.data.queue.push(id);
    }
  }
  snapshot(){this.data.run=this.race?encodeRace(this.race.snapshot()):null;return clone(this.data);}
  flush({final=false}={}){
    if(!this.loaded||this.protected||this.disposed||this.hostPaused&&!final)return Promise.reject(new Error('save not allowed'));
    const frozen=this.snapshot(),revision=frozen.revision,text=JSON.stringify(frozen);
    if(new TextEncoder().encode(text).length>32768)return Promise.reject(new Error('save budget exceeded'));
    const job=this.chain.catch(()=>{}).then(async()=>{await this.storage.save(text);this.ack=Math.max(this.ack,revision);if(this.data.revision===revision)this.unsaved=false;return revision;});
    this.chain=job;return job.catch(e=>{this.unsaved=true;throw e;});
  }
  start(options={}){if(this.startPromise)return this.startPromise;this.startPromise=this.startRun(options).finally(()=>{this.startPromise=null;});return this.startPromise;}
  async startRun({id=null,difficulty='standard',replay=false,latency=null}={}){
    if(!this.loaded||this.protected||this.hostPaused)throw new Error('not playable');
    if(!['standard','expert'].includes(difficulty)||difficulty==='expert'&&this.data.frontier<=6)throw new Error('difficulty locked');
    if(this.data.nextSerial>=Number.MAX_SAFE_INTEGER||this.data.frontier>=Number.MAX_SAFE_INTEGER)throw new Error('progress migration required');
    this.fillQueue();const target=id??this.data.queue[0];
    this.race=new Race(this.catalog.course(target),{difficulty,stage:this.data.frontier,serial:this.data.nextSerial++,latency});this.origin=replay?'replay':'journey';this.race.origin=this.origin;
    this.dirty();await this.flush();return this.race;
  }
  step(delta=20){
    if(!this.race||this.hostPaused)return 0;
    const dt=this.race.frame(delta);
    if(dt){const p=this.data.pacing;p.initialActive=Math.min(120000,p.initialActive+dt);p.activeSinceAd=Math.min(120000,p.activeSinceAd+dt);this.dirty();}
    if(this.race.result)this.finalize();return dt;
  }
  finalize(){
    const r=this.race?.result;if(!r||!r.genuine)return false;
    if(r.assisted){
      if(this.race.assistedCommitted)return false;this.race.assistedCommitted=true;this.record(r);this.dirty();return true;
    }
    if(r.serial<=this.data.lastCreditedSerial)return false;
    this.data.lastCreditedSerial=r.serial;
    if(r.meaningful){const p=this.data.pacing;p.firstFinishes=Math.min(2,p.firstFinishes+1);p.finishesSinceAd=Math.min(2,p.finishesSinceAd+1);}
    if(this.race.origin!=='replay'&&this.race.stage===this.data.frontier){
      this.data.history.push(this.race.course.id);if(this.data.history.length>64)this.data.history.shift();
      this.data.signatures.push(signature(this.race.course));if(this.data.signatures.length>12)this.data.signatures.shift();
      this.data.frontier++;this.data.queue.shift();this.fillQueue();
    }
    this.record(r);this.dirty();return true;
  }
  record(r){
    const item={id:this.race.course.id,difficulty:this.race.difficulty,time:r.time,rank:r.rank,assisted:r.assisted,clean:r.clean};
    const index=this.data.records.findIndex(x=>x.id===item.id&&x.difficulty===item.difficulty&&x.assisted===item.assisted);
    if(index>=0){const old=this.data.records.splice(index,1)[0];item.time=Math.min(old.time,item.time);item.rank=Math.min(old.rank,item.rank);item.clean=Math.max(old.clean,item.clean);}
    this.data.records.push(item);if(this.data.records.length>64)this.data.records.shift();
    if(item.id.startsWith('F')){const old=this.data.foundationRecords[item.id];this.data.foundationRecords[item.id]={rank:Math.min(old?.rank??3,item.rank),time:Math.min(old?.time??Infinity,item.time)};}
  }
  interstitialEligible(){const r=this.race?.result,p=this.data.pacing;if(!this.enableAdFixtures||!r?.meaningful||this.hostPaused||this.inFlight||p.consumed.includes(r.serial))return false;
    return p.firstAttempted?p.finishesSinceAd>=2&&p.activeSinceAd>=120000:p.firstFinishes>=2&&p.initialActive>=120000&&(!p.hadReservation||p.activeSinceAd>=120000);
  }
  next(options={}){if(this.nextPromise)return this.nextPromise;this.nextPromise=this.nextRun(options).finally(()=>{this.nextPromise=null;});return this.nextPromise;}
  async nextRun({replay=false,latency=null}={}){
    if(this.race?.state!=='RESULT')throw new Error('result required');
    const oldId=this.race.course.id,difficulty=this.race.difficulty;
    if(this.interstitialEligible())await this.requestAd('interstitial');
    if(this.hostPaused)return false;
    return this.start({id:replay?oldId:null,difficulty,replay,latency});
  }
  async restart({latency=null}={}){if(!this.race||this.hostPaused)throw new Error('not restartable');return this.start({id:this.race.course.id,difficulty:this.race.difficulty,replay:this.race.origin==='replay',latency});}
  rematchOffer(){
    const r=this.race?.result,p=this.data.pacing;
    if(!this.enableAdFixtures||!r?.meaningful||r.rank===1||this.race.ms<20000||this.race.assisted||!this.race.checkpoints.length||this.data.claim||this.inFlight||this.hostPaused||p.consumed.includes(r.serial)||p.hadReservation&&p.activeSinceAd<120000)return null;
    const cp=this.race.checkpoints.at(-1);const probe=Race.restore(cp);probe.player.auto=true;probe.player.latency=20;
    const leg=probe.course.blocks[probe.player.block].options[probe.player.choice];probe.commandSlot(bestSlot(probe.course.family,leg));
    while(!probe.result&&probe.ms<180000)probe.tick();
    if(probe.result?.rank!==1||probe.result.time-cp.ms<10000)return null;
    return {kind:'rematch',snapshot:encodeRace(cp),original:clone(r),serial:r.serial};
  }
  setOffer(family){
    const r=this.race?.result,p=this.data.pacing;
    if(!this.enableAdFixtures||!r?.meaningful||this.race.ms<20000||this.data.frontier<37||this.rematchOffer()||this.data.claim||this.inFlight||this.hostPaused||p.consumed.includes(r.serial)||p.hadReservation&&p.activeSinceAd<120000)return null;
    if(!Number.isInteger(family)||family<0||family>5||this.catalog.map.get(this.data.queue[0])[1]===family)return null;
    const id=this.catalog.pick(family,hash(`choice:${r.serial}:${family}`),[...this.data.history,...this.data.queue]);
    return {kind:'set',id,family,serial:r.serial};
  }
  declineReward(){if(!this.race?.result)return;this.consumeTransition(this.race.serial);this.dirty();}
  consumeTransition(serial){if(!this.data.pacing.consumed.includes(serial))this.data.pacing.consumed.push(serial);if(this.data.pacing.consumed.length>8)this.data.pacing.consumed.shift();}
  async requestAd(kind,offer=null){
    if(!this.ads||!this.enableAdFixtures||this.inFlight||this.hostPaused||!this.race?.result)return false;
    if(kind==='interstitial'&&!this.interstitialEligible())return false;
    if(kind!=='interstitial'){
      if(!['set','rematch'].includes(kind)||!offer)return false;
      const expected=kind==='set'?this.setOffer(offer.family):this.rematchOffer();
      if(!expected||JSON.stringify(expected)!==JSON.stringify(offer))return false;
    }
    const token=`${this.epoch}:${this.race.serial}:${kind}`,p=this.data.pacing;
    this.inFlight={token,kind,offer:clone(offer),epoch:this.epoch,waitMs:0};this.race.pause('ad');
    this.consumeTransition(this.race.serial);p.hadReservation=true;p.finishesSinceAd=0;p.activeSinceAd=0;if(kind==='interstitial')p.firstAttempted=true;
    this.data.adPending=clone(this.inFlight);this.dirty();
    try{await this.flush();}catch{this.data.adPending=null;this.inFlight=null;this.race.resume('ad');return false;}
    let outcome=false;try{outcome=await this.ads.request(kind,token);}catch{}
    if(this.disposed||this.inFlight?.token!==token||this.inFlight.epoch!==this.epoch)return false;
    if(this.hostPaused){this.deferred={token,outcome};return 'deferred';}
    return this.settle(token,outcome);
  }
  async settle(token,outcome){
    if(this.inFlight?.token!==token)return false;
    const pending=this.inFlight;this.inFlight=null;this.data.adPending=null;
    if(pending.kind!=='interstitial'&&outcome===true&&!this.data.claim)this.data.claim={...pending.offer,token};
    this.race?.resume('ad');this.dirty();try{await this.flush();}catch{}
    return outcome===true;
  }
  advanceAdWait(delta){if(!within(delta,0,60000))throw new Error('invalid ad wait');if(this.inFlight&&!this.hostPaused)this.inFlight.waitMs=Math.min(10000,this.inFlight.waitMs+delta);}
  keepPlaying(){if(!this.inFlight||this.inFlight.waitMs<10000)return false;this.race?.resume('ad');return true;}
  async consumeClaim(){
    if(!this.data.claim||this.hostPaused||this.race?.state==='RACING')return false;
    const claim=this.data.claim;
    if(claim.kind==='rematch'){
      const race=Race.restore(decodeRace(claim.snapshot,this.catalog));race.assisted=true;race.originalResult=clone(claim.original);race.state='RACING';race.result=null;race.checkpoints=[];race.origin='rematch';this.race=race;
    }else this.data.queue[0]=claim.id;
    this.data.claim=null;this.dirty();try{await this.flush();}catch{}return true;
  }
  pauseHost(){this.hostPaused=true;this.race?.pause('host');}
  async resumeHost(){this.hostPaused=false;this.race?.resume('host');if(this.bootResolve){const resolve=this.bootResolve;this.bootResolve=null;resolve(await this.load());}if(this.deferred){const d=this.deferred;this.deferred=null;await this.settle(d.token,d.outcome);}}
  dispose(){this.disposed=true;this.epoch++;this.race?.pause('disposed');this.inFlight=null;this.deferred=null;}
}
