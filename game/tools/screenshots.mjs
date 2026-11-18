// Store screenshots from the real game (preview build, which accepts #stageNN links; styled like the YouTube build:
// no in-game sound button). Portrait 1080x1920 and landscape 1920x1080; race frames at a fixed point of race progress.
//   node build.mjs --preview && node tools/screenshots.mjs [outDir]   (needs Playwright; PLAYWRIGHT=module path)
import {fileURLToPath} from 'node:url';import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT??'playwright');
const here=path.dirname(fileURLToPath(import.meta.url));
import http from 'node:http';import fs from 'node:fs';
const OUT=path.resolve(process.argv[2]??path.join(here,'../../releases/youtube-playables/screenshots'));fs.mkdirSync(OUT,{recursive:true});
const game=fs.readFileSync(path.join(here,'../dist/preview.html'));
const server=http.createServer((q,r)=>{r.writeHead(200,{'content-type':'text/html'});r.end(game);}).listen(8198);
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const PORTRAIT={w:360,h:640,s:3},LANDSCAPE={w:960,h:540,s:2};
const jobs=[
  {name:'01-title',stage:1,at:'title',...PORTRAIT},
  {name:'02-race-coast',stage:1,at:.26,...PORTRAIT},
  {name:'03-race-plane',stage:15,at:.36,...PORTRAIT},
  {name:'04-race-rocket',stage:33,at:.34,...PORTRAIT},
  {name:'05-race-drill',stage:24,at:.42,...PORTRAIT},
  {name:'06-win-offer',stage:2,at:'result',...PORTRAIT},
  {name:'07-landscape-race',stage:27,at:.56,...LANDSCAPE},
  {name:'08-landscape-plane',stage:15,at:.38,...LANDSCAPE},
];
async function run(j){
  const ctx=await browser.newContext({viewport:{width:j.w,height:j.h},deviceScaleFactor:j.s});const p=await ctx.newPage();
  await p.goto('http://127.0.0.1:8198/#stage'+j.stage);await p.waitForSelector('#play:not([disabled])',{timeout:60000});
  await p.addStyleTag({content:'.sound{display:none!important}'});
  if(j.at==='title'){await p.waitForTimeout(1500);await p.screenshot({path:`${OUT}/${j.name}.png`});return ctx.close();}
  await p.locator('#play').click({force:true});
  for(let i=0;i<4000;i++){
    const s=await p.evaluate(()=>({res:!document.getElementById('result').hidden,prog:parseFloat(document.getElementById('dot0').style.left)/100,
      hint:[0,1,2].findIndex(i=>document.getElementById('slot'+i).classList.contains('hint'))}));
    if(s.res)break;
    if(typeof j.at==='number'&&s.prog>=j.at){await p.screenshot({path:`${OUT}/${j.name}.png`});return ctx.close();}
    if(s.hint>=0)await p.keyboard.press(String(s.hint+1));await p.waitForTimeout(60);
  }
  await p.waitForTimeout(2200);await p.screenshot({path:`${OUT}/${j.name}.png`});return ctx.close();
}
for(let i=0;i<jobs.length;i+=4)await Promise.all(jobs.slice(i,i+4).map(run));
await browser.close();server.close();
