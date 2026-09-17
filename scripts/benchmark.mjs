// Synthetic benchmark only. Never connects to a browser profile.
import {performance} from 'node:perf_hooks';
import {cleanup} from '../src/lib/cleanup.js';
import {inventory} from '../src/lib/compat.js';
import {readState,saveState,createQueue} from '../src/lib/storage.js';
import {planCleanup} from '../src/lib/policy.js';
import {identity,removalDetails,inRemovalScope} from '../src/lib/cookies.js';
import {cookie,fixture} from '../tests/fixtures.mjs';

// Reproduces the sequential global-inventory pipeline of 1.1.1. Both modes use
// the current selector/policy so the comparison does not optimize unsafe logic.
async function sequential(api,queue){
 const initial=await readState(api),candidates=planCleanup(await inventory(api),initial.whitelist).remove;
 let deleted=0;
 for(const candidate of candidates)await queue(async()=>{
   const state=await readState(api),live=await inventory(api);
   const current=planCleanup(live,state.whitelist).remove.find(c=>identity(c)===identity(candidate));
   if(!current)return;
   const details=removalDetails(current),selected=await api.cookies.get(details);
   if(!selected||identity(selected)!==identity(current))return;
   const impacted=live.filter(c=>inRemovalScope(c,current,details));
   if(!await api.cookies.remove(details))return;
   const remaining=new Set((await inventory(api)).map(identity));deleted+=impacted.filter(c=>!remaining.has(identity(c))).length;
 });
 await queue(async()=>{const state=await readState(api);state.history=[{deleted}];await saveState(api,state);});return {deleted};
}
const count=Number(process.argv[2]||1000),latency=Number(process.argv[3]||1);
if(!Number.isInteger(count)||count<1||count>3500||latency<0||latency>5)throw Error('Use count 1–3500 and synthetic latency 0–5 ms');
for(const [mode,engine] of [['sequential-global',sequential],['bounded-targeted-8',cleanup]]){
 const f=fixture(Array.from({length:count},(_,i)=>cookie({domain:`site${i}.test`,name:`cookie${i}`})));
 let returnedRows=0,fullReads=0,namedReads=0,active=0,maxActive=0,apiCalls=0;
 const delay=()=>latency?new Promise(resolve=>setTimeout(resolve,latency)):Promise.resolve();
 for(const object of [f.api.cookies,f.api.storage.local])for(const key of Object.keys(object)){
   if(typeof object[key]!=='function')continue;
   const original=object[key];object[key]=async(...args)=>{
     apiCalls++;if(key==='remove'){active++;maxActive=Math.max(maxActive,active);}
     await delay();try{const result=await original(...args);if(key==='getAll'){returnedRows+=result.length;if(args[0].name)namedReads++;else fullReads++;}return result;}finally{if(key==='remove')active--;}
   };
 }
 const start=performance.now(),result=await engine(f.api,createQueue(),null,'automatic');
 console.log(JSON.stringify({mode,count,syntheticApiLatencyMs:latency,elapsedMs:Number((performance.now()-start).toFixed(2)),deleted:result.deleted,apiCalls,returnedRows,fullReads,namedReads,storageReads:f.metrics.reads,storageWrites:f.metrics.writes,maxConcurrentRemove:maxActive}));
}
