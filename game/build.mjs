// Bundles the three.js presentation and the engine into dist/: index.html + game.js (YouTube Playables upload root).
//   node build.mjs           production build with the ytgame SDK tag
//   node build.mjs --serve   rebuild on change and serve dist/ on http://localhost:8080
//   node build.mjs --preview single-file dist/preview.html without the SDK tag, for sharing outside YouTube
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url)),dist=path.join(here,'dist');
const options={entryPoints:[path.join(here,'src/main.mjs')],bundle:true,format:'esm',target:'es2020',minify:true,legalComments:'eof',
  loader:{'.json':'json'},outfile:path.join(dist,'game.js'),logLevel:'warning',define:{__PREVIEW__:'false'}};
const html=fs.readFileSync(path.join(here,'src/index.html'),'utf8');
const withoutSdk=text=>text.replace(/<!--ytgame-->[\s\S]*?<!--\/ytgame-->\n?/,'');
fs.mkdirSync(dist,{recursive:true});

if(process.argv.includes('--serve')){
  fs.writeFileSync(path.join(dist,'index.html'),html);
  const ctx=await esbuild.context({...options,minify:false,sourcemap:true,define:{__PREVIEW__:'true'}});
  await ctx.watch();const {port}=await ctx.serve({servedir:dist,port:8080});
  console.log(`Serving http://localhost:${port}`);
}else{
  await esbuild.build(options);
  fs.writeFileSync(path.join(dist,'index.html'),html);
  const files=['index.html','game.js'].map(name=>{const data=fs.readFileSync(path.join(dist,name));return {name,bytes:data.length,gzip:zlib.gzipSync(data,{level:9}).length};});
  if(process.argv.includes('--preview')){
    // The shareable preview also accepts #stageNN links to jump to later vehicles; the upload build does not.
    const {outputFiles}=await esbuild.build({...options,define:{__PREVIEW__:'true'},write:false});
    const js=outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
    const page=withoutSdk(html).replace('<script type="module" src="game.js"></script>',()=>`<script type="module">${js}</script>`);
    fs.writeFileSync(path.join(dist,'preview.html'),page);files.push({name:'preview.html',bytes:Buffer.byteLength(page),gzip:zlib.gzipSync(page,{level:9}).length});
  }
  const total=files.filter(f=>f.name!=='preview.html').reduce((a,f)=>({bytes:a.bytes+f.bytes,gzip:a.gzip+f.gzip}),{bytes:0,gzip:0});
  console.log(JSON.stringify({files,initialBundle:total},null,2));
}
