import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
fs.mkdirSync(path.join(root,'runtime/src'),{recursive:true});
for(const name of fs.readdirSync(path.join(root,'source')).filter(x=>x.endsWith('.mjs')))fs.copyFileSync(path.join(root,'source',name),path.join(root,'runtime/src',name));
console.log('Copied presentation-independent modules into standalone QA runtime. No production SDK/ads enabled.');
