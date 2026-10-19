// Builds the playable single-file game: play/index.html.
// Inlines the unmodified engine modules from source/ and the course bank from runtime/data/.
// Optional argument: a path that also receives the page body without the document skeleton.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const order=['rules','solver','content','race','session'];
const engine=order.map(name=>`// --- source/${name}.mjs ---\n`+read(`source/${name}.mjs`)
  .replace(/^import .*;\s*$/gm,'')
  .replace(/^export /gm,'')).join('\n');
const exported='FAMILIES,LABELS,SPEEDS,TICK,speed,bestSlot,mod,hash,expand,advanceEntrant,Race,Session,Catalog';
const minifyJson=p=>JSON.stringify(JSON.parse(read(p)));
const body=read('play/src/shell.html')
  .replace('/*@ENGINE*/',()=>`const ENGINE=(()=>{\n${engine}\nreturn {${exported}};\n})();`)
  .replace('/*@BANK*/',()=>minifyJson('runtime/data/bank.json'))
  .replace('/*@FOUNDATIONS*/',()=>minifyJson('runtime/data/foundations.json'));
const split=body.indexOf('<div id="app">');
const page=`<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${body.slice(0,split)}</head>\n<body>\n${body.slice(split)}\n</body>\n</html>\n`;
fs.mkdirSync(path.join(root,'play'),{recursive:true});
fs.writeFileSync(path.join(root,'play/index.html'),page);
if(process.argv[2])fs.writeFileSync(path.resolve(process.argv[2]),body);
console.log(`play/index.html ${(Buffer.byteLength(page)/1024).toFixed(0)} KB`);
