import {inventory} from './compat.js';
import {readState, saveState} from './storage.js';
import {planCleanup} from './policy.js';
import {isProtected,applies} from './domains.js';
import {identity, removalDetails, estimateBytes, inRemovalPartition} from './cookies.js';
export const DELETE_CONCURRENCY = 8;
export const PROGRESS_INTERVAL_MS = 200;
const MAX_DURATION_MS = 180000;

export async function cleanup(api, queue, host = null, source = 'manual', options = {}) {
  if(source==='manual' && !(options.authorized instanceof Set))throw new Error('Preview manual requerida');
  const concurrency=options.concurrency ?? DELETE_CONCURRENCY;
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>DELETE_CONCURRENCY)throw new Error('Concurrencia inválida');
  const startedAt=Date.now(),deadline=startedAt+MAX_DURATION_MS;
  const result={at:startedAt,source,deleted:0,affectedDomains:0,approximateBytes:0,skipped:0,skippedProtected:0,failed:0,incomplete:false,cancelled:false};
  const domains=new Set(),processed=new Set(),deleted=new Set();
  let lastReport=-Infinity,total=0;
  const report=async(force=false)=>{
    if(!force && Date.now()-lastReport<PROGRESS_INTERVAL_MS)return;
    lastReport=Date.now();
    await options.onProgress?.({state:'running',total,processed:processed.size,deleted:result.deleted,failed:result.failed,skipped:result.skipped,skippedProtected:result.skippedProtected,percent:total?Math.floor(processed.size*100/total):100,startedAt,duration:Date.now()-startedAt});
  };
  const initial=await readState(api),cookies=await inventory(api);
  const safe=planCleanup(cookies,initial.whitelist,host).remove;
  const authorized=options.authorized;
  const ids=authorized ? [...authorized] : safe.map(identity);
  const idsSet=new Set(ids);
  const byId=new Map(cookies.map(c=>[identity(c),c]));
  const safeIds=new Set(safe.map(identity)),pending=[];
  total=ids.length;
  for(const id of ids){
    if(safeIds.has(id))pending.push({id,cookie:byId.get(id)});
    else {processed.add(id);result.skipped++;if(byId.has(id)&&isProtected(byId.get(id),initial.whitelist))result.skippedProtected++;}
  }
  await report(true);
  for(let offset=0;offset<pending.length;offset+=concurrency){
    if(options.signal?.aborted || Date.now()>deadline){result.incomplete=true;result.cancelled=!!options.signal?.aborted;break;}
    const batch=pending.slice(offset,offset+concurrency);
    // Protection changes use this same queue. Only these at-most-eight operations
    // hold the lock; a queued protection is saved before the next batch begins.
    await queue(async()=>{
      const state=await readState(api);
      const claimed=new Set();
      const finish=(id,kind)=>{if(processed.has(id))return;processed.add(id);if(kind==='protected'){result.skipped++;result.skippedProtected++;}else if(kind==='failed')result.failed++;else if(kind==='skipped')result.skipped++;};
      await Promise.all(batch.map(async({id,cookie})=>{
        if(processed.has(id))return;
        if(authorized && !authorized.has(id)){finish(id,'skipped');return;}
        if(options.signal?.aborted){result.incomplete=true;result.cancelled=true;return;}
        try {
          // All partitions with this name: inspect only the selector's possible
          // collateral, including unpartitioned cookies, rather than global scans.
          const query={storeId:cookie.storeId,name:cookie.name,partitionKey:{}};
          const live=await api.cookies.getAll(query);
          const current=live.find(c=>identity(c)===id);
          if(!current){finish(id,'skipped');return;}
          if(isProtected(current,state.whitelist)){finish(id,'protected');return;}
          if(host&&!applies(current,host)){finish(id,'skipped');return;}
          const details=removalDetails(current);
          const selected=await api.cookies.get(details);
          if(!selected||identity(selected)!==id){finish(id,'skipped');return;}
          const scopeQuery={...query,url:details.url};
          const latest=await api.cookies.getAll(scopeQuery);
          if(!latest.some(c=>identity(c)===id)){finish(id,'skipped');return;}
          const impacted=latest.filter(c=>inRemovalPartition(c,current));
          if(impacted.some(c=>isProtected(c,state.whitelist))){finish(id,'protected');return;}
          if(impacted.some(c=>!(authorized??idsSet).has(identity(c)))){finish(id,'skipped');return;}
          if(options.signal?.aborted){result.incomplete=true;result.cancelled=true;return;}
          const impactIds=impacted.map(identity);
          // Avoid overlapping remove selectors within a concurrent batch. The
          // overlapping candidate is left untouched rather than guessed at.
          if(impactIds.some(key=>claimed.has(key))){finish(id,'skipped');return;}
          for(const key of impactIds)claimed.add(key);
          const removed=await api.cookies.remove(details);
          if(!removed){finish(id,'skipped');return;}
          const after=await api.cookies.getAll(scopeQuery),remaining=new Set(after.map(identity));
          for(const c of impacted){const key=identity(c);if(!remaining.has(key)&&!deleted.has(key)){
            deleted.add(key);result.deleted++;result.approximateBytes+=estimateBytes(c);domains.add(c.domain);
            if(idsSet.has(key))processed.add(key);
          }}
          finish(id,remaining.has(id)?'failed':null);
        }catch{finish(id,'failed');}
      }));
    });
    await report();
  }
  result.affectedDomains=domains.size;
  if(options.signal?.aborted){result.cancelled=true;result.incomplete=true;}
  await queue(async()=>{const state=await readState(api);state.history=[result,...state.history].slice(0,30);await saveState(api,state);});
  await report(true);
  return result;
}
