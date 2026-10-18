import {execFileSync} from 'node:child_process';for(const script of ['build.mjs','harness.mjs'])execFileSync(process.execPath,[`tools/${script}`],{stdio:'inherit'});
