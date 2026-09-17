import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT} from '../src/lib/storage.js';
import {applies} from '../src/lib/domains.js';
import {identity} from '../src/lib/cookies.js';
const event=()=>({listeners:[],addListener(fn){this.listeners.push(fn);}});
const cookie=(domain,name)=>({domain,name,value:'PRIVATE',hostOnly:false,path:'/',secure:true,httpOnly:true,sameSite:'lax',session:true,storeId:'0'});
let state={...structuredClone(DEFAULT),whitelist:['old.test']},alarm,messageListener;
let cookies=[cookie('.old.test','old'),cookie('.later.test','later'),cookie('other.test','other')];
const removed=[];
const select=details=>cookies.find(c=>c.name===details.name && c.storeId===details.storeId && applies(c,new URL(details.url).hostname));
globalThis.chrome={
  runtime:{id:'test',getURL:path=>`chrome-extension://test/${path}`,onMessage:{addListener(fn){messageListener=fn;}},onStartup:event(),onInstalled:event()},
  storage:{local:{get:async()=>({state:structuredClone(state)}),set:async data=>{state=structuredClone(data.state);}}},
  cookies:{getAllCookieStores:async()=>[{id:'0'}],getAll:async()=>[...cookies],get:async details=>select(details),remove:async details=>{const current=select(details);removed.push(current);cookies=cookies.filter(c=>identity(c)!==identity(current));return details;},onChanged:event()},
  alarms:{get:async()=>alarm,clear:async()=>{alarm=undefined;},create:async(name,data)=>{alarm={name,...data,scheduledTime:data.when};},onAlarm:event()},
  tabs:{query:async()=>[],onActivated:event(),onUpdated:event()},
  action:{setBadgeBackgroundColor:async()=>{},setBadgeText:async()=>{},setTitle:async()=>{}}
};
await import('../src/background/worker.js');
const send=message=>new Promise(resolve=>messageListener(message,{id:'test',url:'chrome-extension://test/src/options/index.html'},resolve));
async function until(condition){for(let i=0;i<100;i++){if(condition())return;await new Promise(resolve=>setImmediate(resolve));}assert.fail('La alarma no completó la limpieza');}

test('alarma a 3 días usa cookies/whitelist actuales y preserva sitio protegido tras configurar',async()=>{
  const before=(await send({type:'preview'})).data;
  assert.equal(before.remove,2);assert.ok(before.affectedDomains.includes('later.test'));
  assert.equal((await send({type:'settings',interval:4320,token:before.token})).ok,true);
  assert.equal(alarm.periodInMinutes,4320);
  assert.equal((await send({type:'toggle',host:'www.later.test'})).ok,true);
  cookies.push(cookie('.later.test','created-after-scheduling'));
  cookies.push(cookie('new-unprotected.test','new-unprotected'));
  const current=(await send({type:'preview'})).data;
  assert.equal(current.keep,3);assert.equal(current.remove,2);
  assert.ok(!current.affectedDomains.includes('later.test'));
  assert.ok(current.affectedDomains.includes('new-unprotected.test'));
  assert.equal(current.rows.reduce((sum,row)=>sum+row.count,0),current.remove);
  assert.equal(current.rows.reduce((sum,row)=>sum+row.approximateBytes,0),current.approximateBytes);
  assert.deepEqual(current.rows.map(row=>row.domain).sort(),current.affectedDomains);
  assert.ok(!JSON.stringify(current).includes('PRIVATE'));
  assert.ok(!JSON.stringify(state).includes('affectedDomains'),'no persiste lista congelada');
  chrome.alarms.onAlarm.listeners[0]({name:'cookiekeep-clean'});
  await until(()=>state.history.length===1);
  assert.equal(state.history[0].source,'automatic');assert.equal(state.history[0].deleted,2);
  assert.deepEqual(cookies.map(c=>c.domain),['.old.test','.later.test','.later.test']);
  assert.ok(removed.every(c=>c.domain!=='.later.test'));
});
