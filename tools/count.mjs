import fs from 'node:fs';import {expand} from '../source/content.mjs';
const b=JSON.parse(fs.readFileSync('runtime/data/bank.json')).recipes,f=JSON.parse(fs.readFileSync('runtime/data/foundations.json')).recipes;
const exact=r=>JSON.stringify(r.slice(1,6));
// Conservative decision identity: family, ordered supports, branch supports, gates and modifier kind.
// Distances, phase, modifier sign, ID, colour and seed do not manufacture a new structure.
const structure=r=>JSON.stringify({family:r[1],blocks:expand(r).blocks.map(b=>b.options.map(o=>[o.t,!!o.g,o.m??null]))});
const bExact=new Set(b.map(exact)),bStructures=new Set(b.map(structure));
const report={ordinaryAuditedCourses:b.length,ordinaryDistinctStructures:new Set(b.map(structure)).size,teachingStages:f.length,teachingExactCopiesOfBank:f.filter(r=>bExact.has(exact(r))).map(r=>r[0]),teachingNewStructures:f.filter(r=>!bStructures.has(structure(r))).map(r=>r[0]),distinctLayouts:new Set([...b,...f].map(exact)).size,distinctDecisionStructures:new Set([...b,...f].map(structure)).size,headline:'3989 ordinary courses; 4001 distinct decision structures including teaching',qualification:'passed implemented automated logic/integration gates; human enjoyment, final graphics, native browsers/devices and host release certification NOT established',structureDefinition:'family + ordered support/branch support + gate presence + modifier kind; excludes distance/phase/seed/colour/sign variants',infiniteNovelty:false};
fs.writeFileSync('qa/product-count.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
