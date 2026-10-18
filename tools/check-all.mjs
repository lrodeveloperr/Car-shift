import {execFileSync} from 'node:child_process';
const run=(cmd,args)=>execFileSync(cmd,args,{stdio:'inherit'});
for(const script of ['audit','foundations'])run(process.execPath,[`tools/${script}.mjs`]);
run(process.execPath,['--test','--test-reporter=tap','tests/race.test.mjs','tests/session.test.mjs','tests/boundaries.test.mjs']);
for(const script of ['end-to-end','stress','safety','count','rebuild'])run(process.execPath,[`tools/${script}.mjs`]);
run(process.execPath,['--expose-gc','tools/dom.mjs',...(process.argv.includes('--soak')?['--soak','--final']:[])]);
run(process.execPath,['tools/performance.mjs']);run('python3',['tools/package.py']);
console.log('Implemented standalone checks passed. Native layout/browser/device/host and human enjoyment remain UNVERIFIED; this is not release certification.');
