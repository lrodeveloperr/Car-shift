import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {expand} from '../../source/content.mjs';
import {Race} from '../../source/race.mjs';
import {bestSlot,SPEEDS} from '../../source/rules.mjs';
import {buildLayout,entrantTrack,pointAt,gateState,liveOrder,SPLIT,AMAX,LANE_GAP,ROAD} from '../src/track.mjs';

const bank=JSON.parse(fs.readFileSync(new URL('../../runtime/data/bank.json',import.meta.url)));
const foundations=JSON.parse(fs.readFileSync(new URL('../../runtime/data/foundations.json',import.meta.url)));
const courses=[...foundations.recipes,...bank.recipes].map(expand);
// Fastest possible movement per second: the quickest vehicle with the strongest assisting modifier.
const FASTEST=Math.max(...Object.values(SPEEDS).flatMap(Object.values))*1.25;

test('every fork bypass is drawn at the engine leg length and stays inside its lane',()=>{
  let forks=0;
  for(const course of courses){
    const layout=buildLayout(course);
    assert.equal(layout.total,course.blocks.reduce((a,b)=>a+b.options[0].d,0));
    for(const block of layout.blocks)if(block.fork){
      forks++;const bypass=block.options[1].path;
      assert.ok(Math.abs(bypass.error)<.005,`${course.id} bypass length error ${bypass.error}`);
      assert.ok(Math.max(...bypass.x)<=SPLIT+AMAX+1e-9&&Math.min(...bypass.x)>=-1e-9);
      assert.ok(Math.max(...bypass.x)+ROAD/2<LANE_GAP-SPLIT-ROAD/2,'bypass road clears the neighbouring lane');
    }
  }
  assert.ok(forks>3000);
});

test('paths start and end on the lane centre so block changes do not jump',()=>{
  for(const course of courses.slice(0,400))for(const block of buildLayout(course).blocks)for(const o of block.options){
    const a=pointAt(o.path,0),b=pointAt(o.path,1);
    assert.ok(Math.abs(a.x)<1e-9&&Math.abs(b.x)<1e-9);assert.ok(Math.abs(a.s)<1e-9&&Math.abs(b.s-block.length)<1e-9);
  }
});

test('entrant track position is continuous and forward through a full simulated race',()=>{
  for(const course of courses.filter((c,i)=>i%97===0)){
    const race=new Race(course,{latency:250}),layout=buildLayout(course);
    race.player.auto=true;
    let previous=race.entrants.map(e=>entrantTrack(layout,e,race.ms));
    while(race.state==='RACING'&&race.ms<180000){
      race.tick();
      race.entrants.forEach((e,i)=>{
        const now=entrantTrack(layout,e,race.ms),step=Math.hypot(now.s-previous[i].s,now.x-previous[i].x);
        assert.ok(now.s>=previous[i].s-1e-9,`${course.id} entrant ${i} moved backwards`);
        assert.ok(step<=FASTEST*.02+1e-6,`${course.id} entrant ${i} jumped ${step}`);
        previous[i]=now;
      });
    }
    assert.equal(race.state,'RESULT');
  }
});

test('gate state mirrors the engine cycle: open [0,2500), closed [2500,4000)',()=>{
  assert.deepEqual(gateState({phase:0},0),{open:true,remaining:2500});
  assert.deepEqual(gateState({phase:0},2500),{open:false,remaining:1500});
  assert.deepEqual(gateState({phase:1000},3500),{open:true,remaining:2000});
});

test('live order ranks finished entrants by time, then by progress',()=>{
  const course=courses[0];
  const e=(block,pos,finish=null)=>({block,pos,choice:0,finish});
  const n=course.blocks.length;
  assert.deepEqual(liveOrder({course,entrants:[e(1,5),e(2,0),e(0,0)]}),[1,0,2]);
  assert.deepEqual(liveOrder({course,entrants:[e(n,0,30000),e(n,0,29000),e(n-1,1)]}),[1,0,2]);
  assert.equal(bestSlot(course.family,course.blocks[0].options[0]),0);
});
