// Plays the exact upload zip in Chromium against an instrumented stand-in for YouTube's ytgame SDK and checks the
// Playables integration rules a script can observe: SDK call order, pause/resume, cloud saves, score, no browser
// storage, vibration, Page Visibility API or navigator.language, no network beyond the SDK, no page errors.
//   node tools/playables-check.mjs [zip]   (needs Playwright; set PLAYWRIGHT to its module path if not installed here)
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {initialData} from '../../source/session.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT??'playwright');
const here=path.dirname(fileURLToPath(import.meta.url));
const zipPath=path.resolve(process.argv[2]??path.join(here,'../../releases/youtube-playables/shape-shifting-vehicle-race-playables.zip'));
// Serves straight from the zip, so what is checked is byte for byte what gets uploaded.
const served=new Map();{const z=fs.readFileSync(zipPath);let o=0;
  while(z.readUInt32LE(o)===0x04034b50){const method=z.readUInt16LE(o+8),size=z.readUInt32LE(o+18),n=z.readUInt16LE(o+26),x=z.readUInt16LE(o+28);
    const name=z.toString('utf8',o+30,o+30+n),data=z.subarray(o+30+n+x,o+30+n+x+size);served.set(name,method===8?zlib.inflateRawSync(data):data);o+=30+n+x+size;}}
// A returning player's save at level 38 (past the teaching levels, so interstitials and every offer are in play).
const save38=JSON.stringify({...initialData(),frontier:38});
const server=http.createServer((q,r)=>{const name=q.url==='/'?'index.html':q.url.slice(1).split('?')[0];
  if(!served.has(name)){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':name.endsWith('.js')?'text/javascript':'text/html'});r.end(served.get(name));}).listen(8195);
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const results=[];const check=(name,ok,detail='')=>{results.push({name,ok,detail});console.log(`${ok?'PASS':'FAIL'}  ${name}${detail?'  ('+detail+')':''}`);};
async function open(store){
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});const page=await ctx.newPage();
  const requests=[],errors=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    window.probe={storage:[],vibrate:0,visibility:0,language:0,calls:[]};
    for(const m of ['getItem','setItem','removeItem','clear'])
      {const f=Storage.prototype[m];Storage.prototype[m]=function(...a){probe.storage.push(m+':'+a[0]);return f.apply(this,a);};}
    navigator.vibrate=()=>{probe.vibrate++;return true;};
    for(const target of [EventTarget.prototype]){const f=target.addEventListener;target.addEventListener=function(t,...a){if(t==='visibilitychange')probe.visibility++;return f.call(this,t,...a);};}
    for(const k of ['language','languages']){const d=Object.getOwnPropertyDescriptor(Navigator.prototype,k);Object.defineProperty(Navigator.prototype,k,{get(){probe.language++;return d.get.call(this);}});}
    Object.defineProperty(document,'hidden',{get(){probe.visibility++;return false;}});
  });
  await page.route('https://www.youtube.com/game_api/v1',r=>r.fulfill({contentType:'text/javascript',body:`
    let store=${JSON.stringify(store)},loaded=false;const log=(...a)=>probe.calls.push(a.join(':'));
    window.yt={};
    window.ytgame={IN_PLAYABLES_ENV:true,
      game:{firstFrameReady(){log('firstFrameReady')},gameReady(){log('gameReady',document.getElementById('play').disabled?'play-disabled':'play-enabled')},
        loadData(){log('loadData');loaded=true;return Promise.resolve(store)},
        saveData(v){log('saveData',loaded?'after-load':'before-load',v.length);store=v;return Promise.resolve()}},
      system:{onPause(f){yt.pause=f},onResume(f){yt.resume=f},isAudioEnabled(){return true},onAudioEnabledChange(f){yt.audio=f}},
      engagement:{sendScore(s){log('sendScore',s.value);return Promise.resolve()}},health:{logError(){log('logError')}},
      ads:{requestInterstitialAd(){log('interstitial');return new Promise(r=>setTimeout(r,200))},
           requestRewardedAd(id){log('rewarded',id);return new Promise(r=>setTimeout(()=>r(true),200))}}};`}));
  await page.goto('http://127.0.0.1:8195/');return {page,ctx,requests,errors};
}
const st=p=>p.evaluate(()=>({result:!document.getElementById('result').hidden,racing:!document.getElementById('hud').hidden,paused:!document.getElementById('paused').hidden,
  hint:[0,1,2].findIndex(i=>document.getElementById('slot'+i).classList.contains('hint')),pressed:[0,1,2].findIndex(i=>document.getElementById('slot'+i).getAttribute('aria-pressed')==='true'),
  usable:[0,1,2].map(i=>!document.getElementById('slot'+i).classList.contains('unusable'))}));
async function tap(p,sel){const b=await p.locator(sel).boundingBox();await p.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);}
async function drive(p,ms){const t=Date.now();while(Date.now()-t<ms){const s=await st(p);if(s.result||s.paused)return s;
  if(s.hint>=0)await tap(p,'#slot'+s.hint);else if(!s.usable[s.pressed]){const u=s.usable.indexOf(true);if(u>=0)await tap(p,'#slot'+u);}await p.waitForTimeout(150);}return st(p);}

// A returning player at level 38.
let {page,ctx,requests,errors}=await open(save38);
await page.waitForSelector('#play:not([disabled])',{timeout:60000});await page.waitForTimeout(500);
let probe=await page.evaluate(()=>probe);
const first=probe.calls.indexOf('firstFrameReady'),ready=probe.calls.findIndex(c=>c.startsWith('gameReady'));
check('SDK: firstFrameReady, then gameReady once Play is tappable',first>=0&&ready>first&&probe.calls[ready]==='gameReady:play-enabled',probe.calls.slice(0,4).join(' > '));
check('No in-game mute button inside YouTube',await page.locator('.sound').count()===0);
await tap(page,'#play');let s=await drive(page,6000);
check('Race starts on tap',s.racing);
const shotA=await page.screenshot();await page.evaluate(()=>yt.pause());await page.waitForTimeout(300);
const frozen1=await page.screenshot();await page.waitForTimeout(900);const frozen2=await page.screenshot();
const before=(await st(page)).pressed;const other=[0,1,2].find(i=>i!==before&&(s.usable[i]));if(other!==undefined)await tap(page,'#slot'+other);await page.waitForTimeout(200);
check('onPause stops rendering',Buffer.compare(frozen1,frozen2)===0);
check('onPause ignores input',(await st(page)).pressed===before);
probe=await page.evaluate(()=>probe);check('onPause saves progress',probe.calls.filter(c=>c.startsWith('saveData')).length>0);
await page.evaluate(()=>yt.resume());await page.waitForTimeout(400);s=await st(page);
check('onResume shows the resume button instead of jumping back into the race',s.paused);
await tap(page,'#resume');s=await drive(page,240000);
check('Race finishes',s.result);
await page.waitForTimeout(1500);probe=await page.evaluate(()=>probe);
check('Level progress is saved through saveData, only after loadData',probe.calls.some(c=>c.startsWith('saveData:after-load'))&&!probe.calls.some(c=>c.startsWith('saveData:before-load')));
const sizes=probe.calls.filter(c=>c.startsWith('saveData')).map(c=>Number(c.split(':')[2]));
check('Save stays under 64 KiB (best-effort exit save limit)',Math.max(...sizes)<65536,`${Math.max(...sizes)} bytes`);
const heap=await page.evaluate(()=>performance.memory?.usedJSHeapSize??0);
check('JS heap under 512 MB after a full race',heap>0&&heap<512*1024*1024,`${(heap/1048576).toFixed(0)} MB`);
check('sendScore reports cleared levels',probe.calls.some(c=>c.startsWith('sendScore')),probe.calls.filter(c=>c.startsWith('sendScore')).join(' '));
await ctx.close();
const all={storage:probe.storage,vibrate:probe.vibrate,visibility:probe.visibility,language:probe.language};

// A brand-new player (no cloud save yet).
({page,ctx,requests:requests,errors:errors}=await open(''));const reqs2=requests,errs2=errors;
await page.waitForSelector('#play:not([disabled])',{timeout:60000});await tap(page,'#play');s=await drive(page,240000);
check('New player: first race plays to the end',s.result);await page.waitForTimeout(1200);
await page.evaluate(()=>{const b=document.getElementById('offer');if(!b.hidden)b.click();});await page.waitForTimeout(400);
probe=await page.evaluate(()=>probe);
for(const k of ['storage','vibrate','visibility','language'])all[k]=Array.isArray(all[k])?[...all[k],...probe[k]]:all[k]+probe[k];
check('No browser storage used (localStorage/sessionStorage)',all.storage.length===0,all.storage.join(','));
check('No vibration',all.vibrate===0);
check('No Page Visibility API',all.visibility===0);
check('No navigator.language(s)',all.language===0);
const outside=[...new Set([...requests,...reqs2])].filter(u=>!u.startsWith('http://127.0.0.1:8195/')&&u!=='https://www.youtube.com/game_api/v1');
check('No network requests except the game files and the SDK',outside.length===0,outside.join(' '));
check('No page errors',errors.length+errs2.length===0,[...errors,...errs2].join(' | '));
await ctx.close();await browser.close();server.close();
const failed=results.filter(r=>!r.ok);console.log(`\n${results.length-failed.length}/${results.length} passed`);
fs.writeFileSync(path.join(path.dirname(zipPath),'playables-check.json'),JSON.stringify({zip:path.basename(zipPath),passed:results.length-failed.length,total:results.length,results},null,2)+'\n');
process.exit(failed.length?1:0);
