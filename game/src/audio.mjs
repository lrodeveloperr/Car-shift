// Procedural sound: every effect, engine hum and the music loop is synthesized with Web Audio, so nothing is downloaded.
const midi=n=>440*2**((n-69)/12);
const PENTA=[0,2,4,7,9,12,14,16,19,21,24];
// Music: I–vi–IV–V, one bar each, sixteen 16th-note steps per bar.
const BPM=112,STEP=60/BPM/4,CHORDS=[[48,[60,64,67]],[45,[57,60,64]],[41,[53,57,60]],[43,[55,59,62]]];
// The hum sits under the music so it never tires the ear.
const ENGINE_LEVEL=.38;
const ENGINE={
  car:{wave:'sawtooth',lo:52,hi:120,cut:[450,1500],sub:.5,noise:0,nf:800,chop:0,rate:[1,1],gain:.06},
  bike:{wave:'sawtooth',lo:75,hi:190,cut:[600,2200],sub:.3,noise:0,nf:800,chop:.15,rate:[18,40],gain:.05},
  snowmobile:{wave:'square',lo:62,hi:150,cut:[450,1400],sub:.4,noise:.05,nf:3500,chop:.1,rate:[20,35],gain:.04},
  train:{wave:'sawtooth',lo:36,hi:58,cut:[250,600],sub:.6,noise:.12,nf:1400,chop:.45,rate:[2,6],gain:.06},
  boat:{wave:'sawtooth',lo:58,hi:125,cut:[380,1100],sub:.4,noise:.08,nf:700,chop:.08,rate:[12,20],gain:.05},
  submarine:{wave:'sine',lo:42,hi:66,cut:[300,600],sub:.8,noise:.05,nf:350,chop:.2,rate:[1.5,3],gain:.045},
  helicopter:{wave:'sawtooth',lo:44,hi:62,cut:[260,700],sub:.5,noise:.14,nf:600,chop:.48,rate:[10,15],gain:.06},
  plane:{wave:'sawtooth',lo:90,hi:160,cut:[800,2400],sub:.2,noise:.03,nf:2200,chop:.12,rate:[25,45],gain:.045},
};

export class Sound{
  constructor({muted=false}={}){this.ctx=null;this.muted=muted;this.hostEnabled=true;this.suspended=false;this.musicOn=false;this.seq=null;this.log=null;}
  get on(){return !!this.ctx&&!this.muted&&this.hostEnabled&&!this.suspended;}
  // Browsers only start audio from a user gesture; call this from input handlers.
  unlock(){
    if(!this.ctx){const AC=globalThis.AudioContext??globalThis.webkitAudioContext;if(!AC)return;try{this.ctx=new AC();}catch{return;}this.build();}
    if(this.ctx.state==='suspended'&&!this.suspended&&this.hostEnabled&&!this.muted)this.ctx.resume().catch(()=>{});
    this.sync();
  }
  build(){
    const c=this.ctx;
    this.master=c.createGain();this.master.gain.value=0;
    const comp=c.createDynamicsCompressor();comp.threshold.value=-16;comp.knee.value=10;comp.ratio.value=4;comp.attack.value=.003;comp.release.value=.18;
    comp.connect(this.master);this.master.connect(c.destination);
    this.sfx=c.createGain();this.sfx.connect(comp);
    this.musicBus=c.createGain();this.musicBus.gain.value=0;this.musicBus.connect(comp);
    this.verb=c.createConvolver();this.verb.buffer=this.impulse(1.6,2.6);const wet=c.createGain();wet.gain.value=.32;this.verb.connect(wet);wet.connect(comp);
    const n=c.sampleRate;this.noiseBuf=c.createBuffer(1,n,n);const d=this.noiseBuf.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
  }
  impulse(seconds,decay){
    const c=this.ctx,n=Math.floor(c.sampleRate*seconds),b=c.createBuffer(2,n,c.sampleRate);
    for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n)**decay;}
    return b;
  }
  sync(){
    if(!this.ctx)return;const t=this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.on?1.4:0,t,.04);
    if(this.on&&this.musicOn&&!this.seq){this.nextTime=t+.06;this.step=0;this.seq=setInterval(()=>this.schedule(),25);}
    if((!this.on||!this.musicOn)&&this.seq){clearInterval(this.seq);this.seq=null;}
  }
  setMuted(muted){this.muted=muted;if(!muted)this.unlock();this.sync();}
  setHostEnabled(enabled){this.hostEnabled=enabled;this.sync();}
  suspend(){this.suspended=true;this.sync();this.ctx?.suspend().catch(()=>{});}
  resume(){this.suspended=false;if(this.ctx&&this.hostEnabled&&!this.muted)this.ctx.resume().catch(()=>{});this.sync();}

  voice(type,freq,{t=0,dur=.2,attack=.005,gain=.2,to=0,glide=dur,filter=0,cutTo=0,q=1,send=0,bus=this.sfx}={}){
    const c=this.ctx,at=c.currentTime+t,o=c.createOscillator(),g=c.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,at);if(to)o.frequency.exponentialRampToValueAtTime(to,at+glide);
    g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(gain,at+attack);g.gain.exponentialRampToValueAtTime(.0001,at+dur);
    let node=o;
    if(filter){const f=c.createBiquadFilter();f.frequency.setValueAtTime(filter,at);if(cutTo)f.frequency.exponentialRampToValueAtTime(cutTo,at+dur);f.Q.value=q;o.connect(f);node=f;}
    node.connect(g);g.connect(bus);
    if(send){const s=c.createGain();s.gain.value=send;g.connect(s);s.connect(this.verb);}
    o.onended=()=>g.disconnect();o.start(at);o.stop(at+dur+.05);
  }
  noise({t=0,dur=.3,attack=.005,gain=.2,type='bandpass',freq=1000,to=0,q=1,send=0,bus=this.sfx}={}){
    const c=this.ctx,at=c.currentTime+t,src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
    src.buffer=this.noiseBuf;src.loop=true;f.type=type;f.frequency.setValueAtTime(freq,at);if(to)f.frequency.exponentialRampToValueAtTime(to,at+dur);f.Q.value=q;
    g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(gain,at+attack);g.gain.exponentialRampToValueAtTime(.0001,at+dur);
    src.connect(f);f.connect(g);g.connect(bus);
    if(send){const s=c.createGain();s.gain.value=send;g.connect(s);s.connect(this.verb);}
    src.onended=()=>g.disconnect();src.start(at,Math.random()*.9);src.stop(at+dur+.05);
  }

  play(name,arg){
    this.log?.push(name);
    if(!this.on)return;
    try{this[`sfx_${name}`]?.(arg);}catch(e){console.warn(e);}
  }
  sfx_tap(){this.voice('sine',1100,{to:640,dur:.08,gain:.14});this.noise({dur:.03,type:'highpass',freq:3500,gain:.05});}
  // Shape-shift: rising whoosh, a pitched pop per slot and a bright sparkle tail.
  sfx_switch(slot=0){
    const k=[0,4,7][slot];
    this.noise({dur:.24,attack:.03,type:'bandpass',freq:500,to:4200,q:1.3,gain:.2});
    this.voice('sine',midi(45+k),{to:midi(64+k),glide:.07,dur:.2,gain:.34});
    this.voice('triangle',midi(76+k),{t:.04,dur:.28,gain:.1,send:.45});
    this.voice('triangle',midi(83+k),{t:.08,dur:.32,gain:.08,send:.55});
    this.voice('sine',midi(88+k),{t:.12,dur:.4,gain:.06,send:.65});
  }
  sfx_perfect(){[0,4,7,12].forEach((n,i)=>this.voice('sine',midi(84+n),{t:.05+i*.045,dur:.45,gain:.08,send:.7}));this.noise({t:.05,dur:.35,type:'highpass',freq:6000,gain:.05,send:.5});}
  sfx_nope(){this.voice('square',150,{to:92,dur:.15,gain:.11,filter:700});this.voice('square',118,{t:.1,to:74,dur:.16,gain:.1,filter:600});}
  sfx_splash(){
    this.noise({dur:.55,type:'lowpass',freq:2800,to:260,gain:.32});this.voice('sine',320,{to:70,dur:.2,gain:.26});
    for(let i=0;i<4;i++)this.voice('sine',500+Math.random()*700,{t:.08+i*.06,to:1400+Math.random()*600,glide:.05,dur:.07,gain:.05});
  }
  sfx_dive(){this.noise({dur:.7,type:'lowpass',freq:1000,to:160,gain:.3});this.voice('sine',220,{to:55,dur:.5,gain:.24});
    for(let i=0;i<6;i++)this.voice('sine',380+Math.random()*500,{t:.1+i*.07,to:900+Math.random()*500,glide:.05,dur:.06,gain:.045});}
  sfx_land(){this.voice('sine',130,{to:42,dur:.2,gain:.38});this.noise({dur:.14,type:'lowpass',freq:700,gain:.16});}
  sfx_whoosh(){this.noise({dur:.5,attack:.14,type:'bandpass',freq:380,to:2600,q:.8,gain:.22});this.voice('sine',midi(67),{t:.12,to:midi(79),glide:.25,dur:.3,gain:.05,send:.4});}
  // Flight hoops climb the pentatonic scale, so a clean run of rings plays a rising melody.
  sfx_hoop(n=0){const m=72+PENTA[Math.min(n,PENTA.length-1)];
    this.voice('sine',midi(m),{dur:.65,gain:.16,send:.6});this.voice('triangle',midi(m+12),{dur:.3,gain:.05,send:.6});this.noise({dur:.18,type:'highpass',freq:7000,gain:.04,send:.4});}
  sfx_checkpoint(){this.voice('triangle',midi(79),{dur:.3,gain:.1,send:.5});this.voice('triangle',midi(84),{t:.09,dur:.45,gain:.1,send:.5});}
  sfx_overtake(){[67,71,74,79].forEach((n,i)=>this.voice('square',midi(n),{t:i*.05,dur:.14,gain:.05,filter:2600,send:.3}));this.noise({dur:.3,attack:.08,type:'bandpass',freq:900,to:3000,gain:.08});}
  sfx_gateOpen(){this.voice('triangle',midi(74),{dur:.12,gain:.07});this.voice('triangle',midi(81),{t:.07,dur:.16,gain:.07});}
  sfx_gateClose(){this.voice('square',700,{to:240,dur:.08,gain:.12,filter:2000});this.noise({dur:.07,type:'highpass',freq:2500,gain:.14});}
  sfx_go(){this.voice('square',midi(72),{dur:.12,gain:.07,filter:3000});this.voice('square',midi(79),{t:.1,dur:.12,gain:.07,filter:3000});
    this.voice('square',midi(84),{t:.2,dur:.4,gain:.08,filter:3500,send:.4});this.noise({t:.15,dur:.45,attack:.1,type:'bandpass',freq:500,to:3000,gain:.12});}
  sfx_warn(){this.voice('triangle',midi(57),{dur:.11,gain:.09});this.voice('triangle',midi(57),{t:.14,dur:.11,gain:.09});}
  sfx_finish(rank=1){
    const notes=[[72,76,79,84,88],[72,76,79,84],[72,76,79]][rank-1]??[72,76,79];
    notes.forEach((n,i)=>{this.voice('triangle',midi(n),{t:i*.075,dur:.5,gain:.11,send:.5});this.voice('sine',midi(n+12),{t:i*.075,dur:.3,gain:.04,send:.5});});
    const t=notes.length*.075;[60,64,67,72].slice(0,rank===1?4:3).forEach(n=>this.voice('sawtooth',midi(n),{t,dur:1.3,attack:.04,gain:.035,filter:1800,cutTo:700,send:.5}));
    this.noise({dur:1.5,attack:.25,type:'bandpass',freq:1300,q:.5,gain:rank===1?.12:.07});
    this.duck(1.8);
  }
  sfx_medal(rank=1){
    for(let i=0;i<(rank===1?7:rank===2?5:3);i++)this.voice('sine',midi(84+PENTA[(i*2)%PENTA.length]),{t:i*.06,dur:.5,gain:.05,send:.75});
    this.voice('sine',midi(rank===1?96:91),{t:.1,dur:1.1,gain:.08,send:.8});
  }

  // Continuous hum for the player's vehicle; pitch and brightness follow its real speed.
  engine(type,frac,active){
    if(!this.ctx)return;
    if(!this.eng){
      const c=this.ctx,e={osc:c.createOscillator(),sub:c.createOscillator(),subGain:c.createGain(),filter:c.createBiquadFilter(),chop:c.createGain(),
        lfo:c.createOscillator(),depth:c.createGain(),src:c.createBufferSource(),nf:c.createBiquadFilter(),ng:c.createGain(),out:c.createGain()};
      e.osc.connect(e.filter);e.sub.connect(e.subGain);e.subGain.connect(e.filter);e.filter.connect(e.chop);
      e.src.buffer=this.noiseBuf;e.src.loop=true;e.nf.type='bandpass';e.src.connect(e.nf);e.nf.connect(e.ng);e.ng.connect(e.chop);
      e.lfo.connect(e.depth);e.depth.connect(e.chop.gain);e.chop.connect(e.out);e.out.connect(this.sfx);e.out.gain.value=0;
      e.sub.type='square';for(const o of [e.osc,e.sub,e.lfo,e.src])o.start();this.eng=e;
    }
    const e=this.eng,p=ENGINE[type]??ENGINE.car,t=this.ctx.currentTime,k=Math.max(0,Math.min(1,frac)),set=(param,v)=>param.setTargetAtTime(v,t,.09);
    if(e.type!==type){e.osc.type=p.wave;e.type=type;}
    const f=p.lo+(p.hi-p.lo)*k;
    set(e.osc.frequency,f);set(e.sub.frequency,f/2);set(e.subGain.gain,p.sub*.6);set(e.filter.frequency,p.cut[0]+(p.cut[1]-p.cut[0])*k);
    set(e.nf.frequency,p.nf);set(e.ng.gain,p.noise*4);set(e.lfo.frequency,p.rate[0]+(p.rate[1]-p.rate[0])*k);
    set(e.depth.gain,p.chop);set(e.chop.gain,1-p.chop);set(e.out.gain,active?p.gain*ENGINE_LEVEL*(.55+.45*k):0);
  }

  music(on,level=.38){this.musicOn=on;this.musicLevel=level;if(this.ctx)this.musicBus.gain.setTargetAtTime(on?level:0,this.ctx.currentTime,.3);this.sync();}
  duck(seconds){if(!this.ctx||!this.musicOn)return;const t=this.ctx.currentTime,g=this.musicBus.gain;g.cancelScheduledValues(t);g.setTargetAtTime(this.musicLevel*.25,t,.05);g.setTargetAtTime(this.musicLevel,t+seconds,.4);}
  schedule(){
    const now=this.ctx.currentTime;if(this.nextTime<now-.05)this.nextTime=now+.05;
    while(this.nextTime<now+.12){this.beat(this.step,this.nextTime-now);this.nextTime+=STEP;this.step=(this.step+1)%64;}
  }
  beat(step,t){
    const [root,tones]=CHORDS[step>>4],s=step%16,bus=this.musicBus;
    if(s===0||s===8)this.voice('sine',140,{t,to:44,glide:.12,dur:.2,gain:.42,bus});
    if(s===4||s===12)this.noise({t,dur:.12,type:'bandpass',freq:1800,q:.7,gain:.09,send:.15,bus});
    if(s%4===2)this.noise({t,dur:.04,type:'highpass',freq:7500,gain:.05,bus});
    if([0,3,8,11,14].includes(s))this.voice('triangle',midi(root-12+(s===14?7:0)),{t,dur:.24,gain:.16,filter:600,bus});
    if(s%2===0)this.voice('triangle',midi(tones[[0,1,2,1,0,2,1,2][s>>1]]+12),{t,dur:.2,gain:.045,filter:3200,send:.25,bus});
    if(step%32===30)this.voice('sine',midi(tones[2]+24),{t,dur:.5,gain:.03,send:.6,bus});
  }
}
