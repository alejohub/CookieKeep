import test from 'node:test';import assert from 'node:assert/strict';
import {cleanup,DELETE_CONCURRENCY} from '../src/lib/cleanup.js';
import {createQueue} from '../src/lib/storage.js';import {identity} from '../src/lib/cookies.js';
import {createJob} from '../src/lib/job.js';import {cookie,fixture} from './fixtures.mjs';
const inventory=n=>Array.from({length:n},(_,i)=>cookie({domain:`site${i}.test`,name:`cookie${i}`}));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
for(const count of [0,1,100,1200])test(`bounded deletion/progress for ${count} candidates`,async()=>{
 const f=fixture(inventory(count)),original=f.api.cookies.remove,updates=[];
 f.api.cookies.remove=async d=>{f.metrics.active++;f.metrics.maxActive=Math.max(f.metrics.maxActive,f.metrics.active);await tick();try{return await original(d);}finally{f.metrics.active--;}};
 const result=await cleanup(f.api,createQueue(),null,'automatic',{onProgress:p=>updates.push(p)});
 assert.equal(result.deleted,count);assert.equal(result.failed,0);assert.equal(f.cookies.length,0);assert.ok(f.metrics.maxActive<=DELETE_CONCURRENCY);if(count>=8)assert.equal(f.metrics.maxActive,8);
 assert.equal(f.metrics.writes,1);assert.ok(f.metrics.reads<=Math.ceil(count/8)+2);
 assert.equal(updates.at(-1).processed,count);assert.equal(updates.at(-1).percent,100);
 for(let i=1;i<updates.length;i++){assert.ok(updates[i].processed>=updates[i-1].processed);assert.ok(updates[i].percent>=updates[i-1].percent);}
});
test('queued protection is saved before the next batch; no future protected remove',async()=>{
 const f=fixture(inventory(40)),q=createQueue(),original=f.api.cookies.remove;let protection;
 f.api.cookies.remove=async d=>{if(!protection)protection=q(async()=>{f.setWhitelist(['site8.test','site15.test','site39.test']);});await tick();return original(d);};
 const r=await cleanup(f.api,q,null,'automatic');await protection;
 assert.equal(r.deleted,37);assert.equal(r.skippedProtected,3);assert.ok(!f.calls.some(d=>['site8.test','site15.test','site39.test'].includes(new URL(d.url).hostname)));
});
test('cancellation finishes in-flight calls, starts no future batch, persists partial summary',async()=>{
 const f=fixture(inventory(100)),controller=new AbortController(),original=f.api.cookies.remove;
 f.api.cookies.remove=async d=>{controller.abort();await tick();return original(d);};
 const r=await cleanup(f.api,createQueue(),null,'automatic',{signal:controller.signal});assert.equal(r.cancelled,true);assert.equal(r.incomplete,true);assert.ok(r.deleted>=1&&r.deleted<=8);assert.equal(f.state.history.length,1);assert.equal(f.state.history[0].cancelled,true);
});
test('partial API errors are counted; no unbounded retries',async()=>{
 const f=fixture(inventory(100)),original=f.api.cookies.remove;
 f.api.cookies.remove=async d=>{if(Number(d.name.slice(6))%10===0)throw Error('synthetic failure');return original(d);};
 const r=await cleanup(f.api,createQueue(),null,'automatic');assert.equal(r.deleted,90);assert.equal(r.failed,10);assert.equal(f.cookies.length,10);
});
test('manual without authorization rejected, arbitrary concurrency rejected',async()=>{
 const f=fixture(inventory(1));await assert.rejects(cleanup(f.api,createQueue()));await assert.rejects(cleanup(f.api,createQueue(),null,'automatic',{concurrency:3500}));
});
test('new collateral in same selector is not deleted by a manual batch',async()=>{
 const a=cookie({path:'/account'}),f=fixture([a]),original=f.api.cookies.get;
 f.api.cookies.get=async d=>{f.add(cookie({domain:'independent.test',name:'brand-new'}));return original(d);};
 const r=await cleanup(f.api,createQueue(),null,'manual',{authorized:new Set([identity(a)])});assert.equal(r.deleted,1);assert.equal(f.cookies.length,1);
});
test('job state recoverable without UI; session contains aggregates only',async()=>{
 let saved;const f=fixture(inventory(1));f.api.storage.session={get:async()=>({cleanupProgress:saved}),set:async data=>{saved=structuredClone(data.cleanupProgress);}};
 const job=createJob(f.api,(host,source,options)=>cleanup(f.api,createQueue(),host,source,options));await job.start(null,'automatic');assert.equal((await job.status()).state,'completed');assert.equal(saved.deleted,1);assert.ok(!JSON.stringify(saved).includes('SYNTHETIC'));assert.ok(!JSON.stringify(saved).includes('site0'));
 const reopened=createJob(f.api,()=>{});assert.equal((await reopened.status()).deleted,1);
 saved={...saved,state:'running'};const restarted=createJob(f.api,()=>{});assert.equal((await restarted.status()).state,'failed');assert.equal(saved.interrupted,true);
});
test('job refuses overlapping starts and exposes cancellation',async()=>{
 const f=fixture();let finish;const job=createJob(f.api,(_h,_s,options)=>new Promise(resolve=>{finish=()=>resolve({cancelled:options.signal.aborted,incomplete:true});}));
 const start=job.start(null,'automatic');while(!finish)await tick();await assert.rejects(job.start(null,'automatic'));assert.equal((await job.cancel()).state,'cancelling');finish();await start;assert.equal((await job.status()).cancelled,true);
});

test('same-selector new cookie created between get and remove is detected',async()=>{
 const a=cookie({path:'/account'}),f=fixture([a]),original=f.api.cookies.get;
 f.api.cookies.get=async d=>{f.add(cookie({path:'/'}));return original(d);};
 const r=await cleanup(f.api,createQueue(),null,'manual',{authorized:new Set([identity(a)])});assert.equal(r.deleted,0);assert.equal(f.cookies.length,2);
});
test('protection change while query is pending cannot pass the queue barrier',async()=>{
 const f=fixture(inventory(20)),q=createQueue(),original=f.api.cookies.getAll;let queued;
 f.api.cookies.getAll=async d=>{if(d.name&&!queued)queued=q(()=>f.setWhitelist(['site8.test']));await tick();return original(d);};
 const r=await cleanup(f.api,q,null,'automatic');await queued;assert.equal(r.deleted,19);assert.ok(!f.calls.some(d=>d.name==='cookie8'));
});
test('progress callbacks are throttled rather than sent per cookie',async()=>{
 const f=fixture(inventory(1000)),updates=[];
 const realNow=Date.now;let virtualTime=100000;Date.now=()=>virtualTime;
 const original=f.api.cookies.remove;f.api.cookies.remove=async d=>{virtualTime++;return original(d);};
 try{await cleanup(f.api,createQueue(),null,'automatic',{onProgress:p=>updates.push(p)});}finally{Date.now=realNow;}
 assert.ok(updates.length<=8);assert.equal(updates.at(-1).processed,1000);for(let i=1;i<updates.length-1;i++)assert.ok(updates[i].duration-updates[i-1].duration>=200);
});
