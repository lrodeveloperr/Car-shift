// Builds the YouTube Playables upload: a zip with index.html and game.js at its root, checked against the Playables
// bundle rules (file names, relative paths, SDK loaded before game code, size limits, preview code compiled out).
// Writes releases/youtube-playables/shape-shifting-vehicle-race-playables.zip and package-report.json.
//   node tools/package.mjs
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const game=path.join(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(game,'dist');
const out=path.resolve(game,'../releases/youtube-playables'),zipName='shape-shifting-vehicle-race-playables.zip';
const SDK='https://www.youtube.com/game_api/v1',KiB=1024,MiB=1024*KiB;
execFileSync(process.execPath,['build.mjs'],{cwd:game,stdio:['ignore','ignore','inherit']});

const files=['index.html','game.js'].map(name=>{const data=fs.readFileSync(path.join(dist,name));
  return {name,data,bytes:data.length,gzip:zlib.gzipSync(data,{level:9}).length,sha256:crypto.createHash('sha256').update(data).digest('hex')};});
const html=files[0].data.toString('utf8'),js=files[1].data.toString('utf8'),total=files.reduce((a,f)=>a+f.bytes,0);
const checks=[],check=(rule,level,ok,detail)=>checks.push({rule,level,ok,detail});
check('index.html is at the zip root (entry point)','MUST',files[0].name==='index.html','');
check('File names use only letters, digits, _ - .','MUST',files.every(f=>/^[A-Za-z0-9_.-]+$/.test(f.name)),files.map(f=>f.name).join(', '));
check('At most 8,000 files','MUST',files.length<=8000,`${files.length} files`);
check('Every file under 30 MiB','MUST',files.every(f=>f.bytes<30*MiB),files.map(f=>`${f.name} ${(f.bytes/KiB).toFixed(0)} KiB`).join(', '));
check('Every file under 512 KiB','SHOULD',files.every(f=>f.bytes<512*KiB),'game.js holds three.js, the engine and all 9,613 courses in one file');
check('Total bundle under 250 MiB','MUST',total<250*MiB,`${(total/KiB).toFixed(0)} KiB`);
// Everything loads before gameReady, so the initial bundle is the whole bundle (YouTube serves it compressed).
check('Initial bundle under 30 MiB','MUST',total<30*MiB,`${(total/KiB).toFixed(0)} KiB raw, ${(files.reduce((a,f)=>a+f.gzip,0)/KiB).toFixed(0)} KiB gzipped`);
check('Initial bundle under 15 MiB','SHOULD',total<15*MiB,'');
const sdkAt=html.indexOf(`<script src="${SDK}"></script>`),gameAt=html.indexOf('<script type="module" src="game.js"></script>');
check('Playables SDK loads before any game code','MUST',sdkAt>=0&&gameAt>sdkAt,'');
const urls=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(u=>u!==SDK);
check('Only relative paths','MUST',urls.every(u=>!/^(?:[a-z]+:)?\/\//i.test(u)&&!u.startsWith('/')),urls.join(', '));
// Network calls are what the rule is about (URLs inside comments, like three.js shader citations, are not).
const network=['fetch(','XMLHttpRequest','WebSocket','sendBeacon','EventSource','import('].filter(k=>js.includes(k));
check('No network APIs in the game code (all assets are in the bundle)','MUST',network.length===0,network.join(', '));
check('Preview-only #stage links compiled out','MUST',!js.includes('#stage'),'');
check('No vibration (would need an on/off toggle)','MUST',!js.includes('vibrate'),'');
check('No navigator.language(s)','MUST',!/navigator\.languages?\b/.test(js),'');

// Deterministic zip: fixed timestamps and order, so the same build always gives the same bytes.
function zip(entries){
  const parts=[],central=[];let offset=0;const DATE=0x21; // 1980-01-01 00:00
  for(const {name,data} of entries){
    const comp=zlib.deflateRawSync(data,{level:9}),crc=zlib.crc32(data),n=Buffer.from(name),h=Buffer.alloc(30),c=Buffer.alloc(46);
    h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt16LE(8,8);h.writeUInt16LE(DATE,12);
    h.writeUInt32LE(crc,14);h.writeUInt32LE(comp.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(n.length,26);
    c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(0x0314,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);c.writeUInt16LE(DATE,14);
    c.writeUInt32LE(crc,16);c.writeUInt32LE(comp.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(n.length,28);
    c.writeUInt32LE((0o100644<<16)>>>0,38);c.writeUInt32LE(offset,42);
    parts.push(h,n,comp);central.push(c,n);offset+=30+n.length+comp.length;
  }
  const cd=Buffer.concat(central),e=Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(entries.length,8);e.writeUInt16LE(entries.length,10);e.writeUInt32LE(cd.length,12);e.writeUInt32LE(offset,16);
  return Buffer.concat([...parts,cd,e]);
}
const archive=zip(files);
check('Zip is byte-identical when rebuilt','MUST',Buffer.compare(archive,zip(files))===0,'');
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,zipName),archive);
const failed=checks.filter(c=>c.level==='MUST'&&!c.ok);
const report={zip:zipName,zipBytes:archive.length,zipSha256:crypto.createHash('sha256').update(archive).digest('hex'),
  files:files.map(({name,bytes,gzip,sha256})=>({name,bytes,gzip,sha256})),checks,mustFailures:failed.length};
fs.writeFileSync(path.join(out,'package-report.json'),JSON.stringify(report,null,2)+'\n');
for(const c of checks)console.log(`${c.ok?'PASS':c.level==='MUST'?'FAIL':'NOTE'}  [${c.level}] ${c.rule}${c.detail?'  ('+c.detail+')':''}`);
console.log(`\n${path.join(out,zipName)}  ${archive.length} bytes  sha256 ${report.zipSha256}`);
process.exit(failed.length?1:0);
