import {FAMILIES,VERSION,hash} from './rules.mjs';
import {buildRecipe,expand,quality,repetitive,sequenceAllowed} from './content.mjs';
import {simulationAudit} from './audit.mjs';

// Daily course: generated on the device from the date, so everyone on the same day and progress tier gets the
// same race without a download. It must pass the same gates as the prevalidated bank, or there is no daily.
export const DAILY_FROM=4; // offered once the first three teaching stages are done
export const DAILY_ID=/^D(\d{4}-\d{2}-\d{2})\.(\d{1,2})$/;
export const dailyId=(day,family)=>`D${day}.${family}`;
const rng=seed=>{let a=seed>>>0;return ()=>{a=a+0x6D2B79F5>>>0;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};};

// The day's family comes from those the player has unlocked, so a daily never needs a vehicle they lack.
export function dailyFamily(day,frontier){
  const open=FAMILIES.map((f,i)=>f.unlock<=frontier?i:-1).filter(i=>i>=0);
  return open[hash(`daily-family:${day}`)%open.length];
}
export function previousDay(day){const d=new Date(`${day}T00:00:00Z`);d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);}
export function dailyRecipe(day,family){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!FAMILIES[family])return null;
  const random=rng(hash(`daily:${VERSION}:${day}:${family}`)),{alphabet,special,edge}=FAMILIES[family].pattern;
  for(let attempt=0;attempt<60;attempt++){
    // Random walk that respects the edge rule as it goes: a special terrain only follows its edge and is followed by it.
    const n=5+Math.floor(random()*4);let s='';
    while(s.length<n){
      if(edge&&s.at(-1)===special){s+=edge;continue;}
      const options=[...alphabet].filter(c=>c!==s.at(-1)&&!(edge&&c===special&&(s.at(-1)!==edge||s.length>n-2)));
      s+=options[Math.floor(random()*options.length)];
    }
    if(!sequenceAllowed(family,s)||repetitive(s))continue;
    // The bank keeps the first passing geometry among variants 0–15; variants from 16 up are new layouts in nearly every case.
    for(let v=0;v<4;v++){
      const recipe=buildRecipe({family,sequence:s,ordinal:0},16+Math.floor(random()*100000));recipe[0]=dailyId(day,family);
      if(quality(expand(recipe)).ok&&simulationAudit(expand(recipe)).ok)return recipe;
    }
  }
  return null;
}
