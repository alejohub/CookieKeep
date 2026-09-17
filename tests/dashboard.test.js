import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Small DOM adapter exercises real dashboard handlers without adding a dependency.
class Element {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.textContent='';this.value='';this.hidden=false;this.listeners={};}
  append(...elements){this.children.push(...elements);}
  replaceChildren(...elements){this.children=[...elements];}
  addEventListener(event,listener){(this.listeners[event]??=[]).push(listener);}
  dispatch(event){for(const listener of this.listeners[event]??=[])listener();}
  showModal(){this.open=true;}
  close(){this.open=false;}
}
const markup=await readFile(new URL('../src/options/index.html',import.meta.url),'utf8');
const elements=new Map([...markup.matchAll(/id="([^"]+)"/g)].map(match=>[match[1],new Element()]));
const get=id=>{if(!elements.has(id))throw new Error(`Elemento no encontrado: ${id}`);return elements.get(id);};
globalThis.document={getElementById:get,createElement:tag=>new Element(tag)};
get('sort').value='count';get('filter').value='all';get('history-period').value='30';
let queries=0, fail=false, erased=false;
let dashboardRows=[{domain:'z.test',count:500,bytes:1000,protectedCookies:0},{domain:'a.test',count:1,bytes:100,protectedCookies:0}];
const historyEvents={};
const now=Date.now(), day=86400000;
globalThis.chrome={
  runtime:{getURL:path=>`chrome-extension://test/${path}`,sendMessage:async message=>({ok:true,data:message.type==='preview' ? {token:'preview-token',remove:501,keep:0,affectedDomains:['a.test','z.test'],keptDomains:[],protectedSites:[],approximateBytes:1100,rows:[]} : {rows:dashboardRows,state:{whitelist:[],history:[],interval:0},total:501,totalBytes:1100,preview:{remove:501},running:false}})},
  storage:{onChanged:{addListener(){}}},
  history:{search:async()=>{queries++;if(fail)throw new Error('denied');return erased?[]:[{url:'https://a.test/page'},{url:'https://z.test/page'}];},getVisits:async({url})=>url.includes('a.test')?[{visitId:'1',visitTime:now-day,transition:'link'},{visitId:'2',visitTime:now-15*day,transition:'reload'}]:[{visitId:'3',visitTime:now-day,transition:'link'}],onVisited:{addListener(fn){historyEvents.visited=fn;}},onVisitRemoved:{addListener(fn){historyEvents.removed=fn;}}}
};
await import('../src/options/options.js');
async function until(condition){for(let i=0;i<100;i++){if(condition())return;await new Promise(resolve=>setTimeout(resolve,10));}assert.fail('Dashboard no alcanzó el estado esperado');}
const rowDomains=()=>get('rows').children.map(row=>row.children[0].children[0].textContent);
const rowVisits=()=>get('rows').children.map(row=>row.children[3].textContent);

test('dashboard: periodo default, columna condicional, caché, cambio de periodo, error y borrado de historial',async()=>{
  await until(()=>get('rows').children.length===2);
  assert.deepEqual(rowDomains(),['z.test','a.test']);assert.equal(queries,0);assert.equal(get('history-period').hidden,true);
  get('sort').value='visits';get('sort').dispatch('input');
  await until(()=>get('ranking-status').textContent.includes('Datos consultados'));
  assert.deepEqual(rowDomains(),['a.test','z.test']);assert.deepEqual(rowVisits(),['2 visitas','1 visitas']);assert.equal(get('visits-heading').hidden,false);assert.equal(get('history-period').value,'30');assert.equal(queries,1);
  get('sort').value='domain';get('sort').dispatch('input');assert.equal(get('visits-heading').hidden,true);
  get('sort').value='visits';get('sort').dispatch('input');await until(()=>get('ranking-status').textContent.includes('Datos consultados'));assert.equal(queries,1);
  get('history-period').value='7';get('history-period').dispatch('input');await until(()=>get('ranking-status').textContent.includes('Datos consultados')&&queries===2);assert.deepEqual(rowVisits(),['1 visitas','1 visitas']);
  fail=true;get('refresh').onclick();await until(()=>get('ranking-status').textContent.includes('No se pudo consultar'));
  assert.deepEqual(rowDomains(),['a.test','z.test']);assert.deepEqual(rowVisits(),['—','—']);assert.equal(get('metrics').children[0].children[1].textContent,'501');assert.ok(get('rows').children[0].children[5].children[0].children.length===2,'acciones existentes siguen disponibles');
  fail=false;erased=true;historyEvents.removed({allHistory:true});
  await until(()=>get('ranking-status').textContent.includes('Datos consultados'));
  assert.deepEqual(rowVisits(),['0 visitas','0 visitas']);
});
test('activación automática muestra solo agregados y link a pestaña separada',async()=>{
  get('interval').value='4320';get('settings').onclick();
  await until(()=>get('dialog').open===true);
  const body=get('dialog-body').children;
  assert.equal(body.length,2);assert.ok(body[0].textContent.includes('501 cookies'));
  assert.ok(!body[0].textContent.includes('a.test'));assert.ok(!body[0].textContent.includes('z.test'));
  assert.equal(body[1].tagName,'a');assert.equal(body[1].textContent,'Ver qué se eliminará');
  assert.equal(body[1].target,'_blank');assert.equal(body[1].href,'chrome-extension://test/src/options/preview.html');
});

test('dashboard pagination: sizes, boundaries, filtering, sorting and shrinking inventory',async()=>{
  dashboardRows=Array.from({length:205},(_,i)=>({domain:`site${String(i).padStart(3,'0')}.test`,count:i+1,bytes:i,protectedCookies:0}));
  get('sort').value='domain';get('sort').dispatch('input');
  await get('refresh').onclick();
  assert.equal(get('rows').children.length,50);
  assert.equal(get('page-prev').disabled,true);
  get('page-next').onclick();
  assert.equal(rowDomains()[0],'site050.test');
  for(let i=0;i<3;i++)get('page-next').onclick();
  assert.equal(get('rows').children.length,5);assert.equal(get('page-next').disabled,true);
  for(const [size,count] of [['100',100],['200',200],['all',205]]){
    get('page-size').value=size;get('page-size').dispatch('input');
    assert.equal(get('rows').children.length,count);assert.equal(get('page-prev').disabled,true);
  }
  assert.equal(get('page-next').disabled,true);
  get('page-size').value='50';get('page-size').dispatch('input');get('page-next').onclick();
  get('search').value='site200';get('search').dispatch('input');
  assert.deepEqual(rowDomains(),['site200.test']);assert.equal(get('page-prev').disabled,true);
  get('search').value='missing';get('search').dispatch('input');
  assert.equal(get('rows').children.length,0);assert.equal(get('empty').hidden,false);assert.ok(get('page-status').textContent.startsWith('0–0 de 0'));
  get('search').value='';get('search').dispatch('input');get('page-next').onclick();
  get('sort').value='count';get('sort').dispatch('input');assert.equal(rowDomains()[0],'site204.test');
  get('page-next').onclick();dashboardRows=dashboardRows.slice(0,2);await get('refresh').onclick();
  assert.equal(get('rows').children.length,2);assert.equal(get('page-prev').disabled,true);assert.equal(get('page-next').disabled,true);
});
