// Renders the store thumbnails from tools/thumbnail-scene.mjs at every aspect ratio YouTube's portal may ask for.
//   node tools/thumbnails.mjs [outDir]      (needs Playwright; set PLAYWRIGHT to its module path if not installed here)
import * as esbuild from 'esbuild';
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(process.argv[2]??path.join(here,'../../releases/youtube-playables/thumbnails'));
const {chromium}=await import(process.env.PLAYWRIGHT??'playwright');
export const SIZES={'16x9':[1920,1080],'1x1':[1080,1080],'9x16':[1080,1920],'4x3':[1440,1080],'3x4':[1080,1440],'2x3':[1080,1620]};
const {outputFiles}=await esbuild.build({entryPoints:[path.join(here,'thumbnail-scene.mjs')],bundle:true,format:'esm',minify:true,write:false,logLevel:'warning'});
const page=`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#000}canvas{display:block}</style><script type="module">${outputFiles[0].text}</script>`;
const server=http.createServer((q,r)=>{r.writeHead(200,{'content-type':'text/html'});r.end(page);}).listen(0);
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
fs.mkdirSync(out,{recursive:true});
for(const [name,[w,h]] of Object.entries(SIZES)){
  // Rendered at half size with a device scale of 2, so edges are antialiased at the full pixel size.
  const p=await browser.newPage({viewport:{width:w/2,height:h/2},deviceScaleFactor:2});
  await p.goto(`http://127.0.0.1:${server.address().port}/`);await p.waitForSelector('body[data-ready]');
  await p.evaluate(([w,h])=>window.render(w,h),[w/2,h/2]);
  const file=path.join(out,`thumbnail-${name}-${w}x${h}.png`);await p.screenshot({path:file});await p.close();
  console.log(file);
}
await browser.close();server.close();
