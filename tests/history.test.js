import test from 'node:test';
import assert from 'node:assert/strict';
import {historyWindow,aggregateVisits,visitsForDomain,sortByVisits,collectHistory,createHistoryCache} from '../src/lib/history.js';
import {isProtected} from '../src/lib/domains.js';
const DAY=86400000, NOW=100*DAY;
const visit=(id,days=1,changes={})=>({visitId:String(id),visitTime:NOW-days*DAY,transition:'link',...changes});
const plain = object => Object.fromEntries(Object.entries(object));

test('agrega visitas por hostname normalizado, no visitCount acumulado',()=>{
  const result=aggregateVisits([{url:'https://EXAMPLE.com./a',visits:[visit(1),visit(2)]},{url:'http://example.com/b',visits:[visit(3)]}],historyWindow(30,NOW));
  assert.deepEqual(plain(result.byHostname),{'example.com':3});
});
test('normalización de IDN y www conserva hostnames separados',()=>{
  const result=aggregateVisits([{url:'https://münich.de/a',visits:[visit(1)]},{url:'https://WWW.Example.com',visits:[visit(2)]}],historyWindow(30,NOW));
  assert.deepEqual(plain(result.byHostname),{'xn--mnich-kva.de':1,'www.example.com':1});
});
test('subdominios se agregan a fila padre por límite de etiqueta',()=>{
  const counts={'example.com':1,'www.example.com':2,'sub.example.com':3,'evil-example.com':40,'example.com.evil.test':50};
  assert.equal(visitsForDomain(counts,'.example.com'),6);
  assert.equal(visitsForDomain(counts,'www.example.com'),2);
  assert.equal(visitsForDomain(counts,'missing.test'),0);
});
test('ignora URLs inválidas/no HTTP y páginas internas',()=>{
  const urls=['garbage','https://','chrome://history','edge://history','chrome-extension://id','file:///a','about:blank',undefined];
  assert.deepEqual(plain(aggregateVisits(urls.map((url,i)=>({url,visits:[visit(i)]})),historyWindow(30,NOW)).byHostname),{});
});
test('solo cuenta fechas dentro del periodo; excluye subframes, incluye reload y synced',()=>{
  const result=aggregateVisits([{url:'https://example.com',visits:[visit(1,2),visit(2,40),visit(3,-1),visit(4,2,{transition:'auto_subframe'}),visit(5,2,{transition:'manual_subframe'}),visit(6,2,{transition:'reload'}),visit(7,2,{isLocal:false}),visit(8,2,{visitTime:undefined})]}],historyWindow(30,NOW));
  assert.equal(result.byHostname['example.com'],3);assert.equal(result.missingTimes,1);
});
test('deduplica visitId sin eliminar visitas distintas a misma URL',()=>{
  const result=aggregateVisits([{url:'https://example.com',visits:[visit(1),visit(1),visit(2)]}],historyWindow(30,NOW));assert.equal(result.byHostname['example.com'],2);
});
test('orden descendente por visitas; empate y ceros por A–Z, sin fallback cookies',()=>{
  const rows=[{domain:'z.test',count:999},{domain:'b.test',count:40},{domain:'a.test',count:1},{domain:'zero.test',count:1000}];
  const result=sortByVisits(rows,{'a.test':4,'b.test':4,'z.test':8});
  assert.deepEqual(result.map(r=>r.domain),['z.test','a.test','b.test','zero.test']);assert.equal(result[3].visits,0);assert.equal(rows[0].visits,undefined);
});
test('periodos 7/30/90/all son ventanas móviles verificables',()=>{
  const records=[{url:'https://example.com',visits:[visit(1,2),visit(2,15),visit(3,60),visit(4,95)]}];
  for(const [period,count] of [[7,1],[30,2],[90,3],['all',4]])assert.equal(aggregateVisits(records,historyWindow(period,NOW)).byHostname['example.com'],count);
  assert.equal(historyWindow(undefined,NOW).startTime,NOW-30*DAY);assert.throws(()=>historyWindow(14,NOW));
});
test('consulta única de search y getVisits solo para URLs relevantes únicas',async()=>{
  const searches=[], urls=[];
  const history={search:async query=>{searches.push(query);return [{url:'https://www.example.com/a',visitCount:200},{url:'https://www.example.com/a'},{url:'https://evil-example.com'},{url:'https://other.test'},{url:'chrome://history'}];},getVisits:async({url})=>{urls.push(url);return [visit(1),visit(2,80)];}};
  const result=await collectHistory(history,['example.com','www.example.com'],30,{now:NOW});
  assert.equal(searches.length,1);assert.equal(searches[0].maxResults,100000);assert.equal(searches[0].startTime,NOW-30*DAY);assert.deepEqual(urls,['https://www.example.com/a']);assert.equal(visitsForDomain(result.byHostname,'example.com'),1);
});
test('historial vacío/borrado retorna ceros, nunca número de cookies',async()=>{
  const history={search:async()=>[],getVisits:async()=>{throw new Error('No debe llamarse');}};
  const result=await collectHistory(history,['example.com']);assert.equal(visitsForDomain(result.byHostname,'example.com'),0);
});
test('sin dominios del dashboard no consulta historial',async()=>{
  let calls=0;const result=await collectHistory({search:async()=>{calls++;return [];},getVisits:async()=>[]},[]);assert.equal(calls,0);assert.deepEqual(plain(result.byHostname),{});
});
test('resultado truncado se señala explícitamente',async()=>{
  const history={search:async()=>[{url:'https://a.test'},{url:'https://b.test'}],getVisits:async()=>[]};
  assert.equal((await collectHistory(history,['a.test'],30,{maxResults:2})).truncated,true);
});
test('errores de search/getVisits o API ausente no se convierten en ceros',async()=>{
  await assert.rejects(collectHistory(undefined,['a.test']));
  await assert.rejects(collectHistory({search:async()=>{throw new Error('denied');},getVisits:async()=>[]},['a.test']));
  await assert.rejects(collectHistory({search:async()=>[{url:'https://a.test'}],getVisits:async()=>{throw new Error('failed');}},['a.test']));
});
test('getVisits vacío tras borrado reciente produce cero',async()=>{
  const result=await collectHistory({search:async()=>[{url:'https://a.test'}],getVisits:async()=>[]},['a.test']);assert.equal(visitsForDomain(result.byHostname,'a.test'),0);
});
test('limita concurrencia de getVisits',async()=>{
  let active=0, peak=0;
  const history={search:async()=>Array.from({length:15},(_,i)=>({url:`https://a.test/${i}`})),getVisits:async()=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setImmediate(resolve));active--;return [];}};
  await collectHistory(history,['a.test'],30,{concurrency:3});assert.equal(peak,3);
});
test('caché en memoria reutiliza datos por periodo/dominios e invalida al refrescar',async()=>{
  let calls=0;
  const cache=createHistoryCache({search:async()=>{calls++;return [{url:'https://a.test/path?private=1'}];},getVisits:async()=>[visit(1)]},{now:NOW});
  const first=await cache.get(['a.test'],30),second=await cache.get(['a.test'],30);assert.equal(first,second);assert.equal(calls,1);
  await cache.get(['a.test'],7);assert.equal(calls,2);cache.clear();await cache.get(['a.test'],30);assert.equal(calls,3);assert.ok(!JSON.stringify(first).includes('private'));assert.ok(!JSON.stringify(first).includes('path'));
});
test('caché no conserva errores y permite reintentar',async()=>{
  let calls=0;const cache=createHistoryCache({search:async()=>{if(++calls===1)throw new Error('denied');return [];},getVisits:async()=>[]});
  await assert.rejects(cache.get(['a.test']));await cache.get(['a.test']);assert.equal(calls,2);
});
test('borrar historial invalida consultas en curso y no reutiliza datos obsoletos',async()=>{
  let complete;
  const cache=createHistoryCache({search:()=>new Promise(resolve=>{complete=resolve;}),getVisits:async()=>[visit(1)]},{now:NOW});
  const pending=cache.get(['a.test']);cache.clear();complete([{url:'https://a.test'}]);await assert.rejects(pending,{name:'AbortError'});
});
test('agregación de historial no cambia matching de whitelist',()=>{
  const cookie={domain:'sub.example.com',hostOnly:true};
  const before=isProtected(cookie,['example.com']);assert.equal(before,false);
  assert.equal(visitsForDomain({'sub.example.com':5},'example.com'),5);assert.equal(isProtected(cookie,['example.com']),before);
});
