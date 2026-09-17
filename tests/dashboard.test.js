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
get('sort').value='count';get('filter').value='all';get('history-period').value='30';get('page-size').value='50';
let queries=0, fail=false, erased=false;
let dashboardRows=[{domain:'z.test',count:500,bytes:1000,protectedCookies:0},{domain:'a.test',count:1,bytes:100,protectedCookies:0}];
let dashboardWhitelist=[], historyRows=null,historyGranted=true,grantResult=true,permissionRequests=0;
const historyEvents={};
const now=Date.now(), day=86400000;
globalThis.chrome={
  runtime:{getURL:path=>`chrome-extension://test/${path}`,sendMessage:async message=>({ok:true,data:message.type==='preview' ? {token:'preview-token',remove:501,keep:0,affectedDomains:['a.test','z.test'],keptDomains:[],protectedSites:[],approximateBytes:1100,rows:[]} : {rows:dashboardRows,state:{whitelist:dashboardWhitelist,history:[],interval:0},total:501,totalBytes:1100,preview:{remove:501},running:false}})},
  storage:{onChanged:{addListener(){}}},
  permissions:{contains:async()=>historyGranted,request:async()=>{permissionRequests++;historyGranted=grantResult;return grantResult;},onRemoved:{addListener(fn){historyEvents.permissionRemoved=fn;}}},
  history:{search:async()=>{queries++;if(fail)throw new Error('denied');if(historyRows)return historyRows;return erased?[]:[{url:'https://a.test/page'},{url:'https://z.test/page'}];},getVisits:async({url})=>historyRows ? Array.from({length:Number(new URL(url).hostname.slice(4,8))%5+1},(_,i)=>({visitId:`${url}-${i}`,visitTime:now-day,transition:'link'})) : url.includes('a.test')?[{visitId:'1',visitTime:now-day,transition:'link'},{visitId:'2',visitTime:now-15*day,transition:'reload'}]:[{visitId:'3',visitTime:now-day,transition:'link'}],onVisited:{addListener(fn){historyEvents.visited=fn;}},onVisitRemoved:{addListener(fn){historyEvents.removed=fn;}}}
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
  assert.equal(get('rows').children.length,0);assert.equal(get('empty').hidden,false);assert.ok(get('page-status').textContent.startsWith('Mostrando 0–0 de 0'));
  get('search').value='';get('search').dispatch('input');get('page-next').onclick();
  get('sort').value='count';get('sort').dispatch('input');assert.equal(rowDomains()[0],'site204.test');
  get('page-next').onclick();dashboardRows=dashboardRows.slice(0,2);await get('refresh').onclick();
  assert.equal(get('rows').children.length,2);assert.equal(get('page-prev').disabled,true);assert.equal(get('page-next').disabled,true);
});

async function inventoryFixture(count){
  dashboardRows=Array.from({length:count},(_,i)=>({domain:`site${String(i).padStart(4,'0')}.test`,count:i+1,bytes:count-i,protectedCookies:0}));
  dashboardWhitelist=[];historyRows=null;
  for(const [id,value] of [['search',''],['filter','all'],['page-size','50'],['sort','domain']]){get(id).value=value;get(id).dispatch('input');}
  await get('refresh').onclick();
  return [...dashboardRows];
}
for(const count of [0,12,50,51,107,205,1072])test(`pagination inventory ${count}: all sizes and bidirectional page boundaries`,async()=>{
  const fixture=await inventoryFixture(count);
  for(const value of ['50','100','200','all']){
    get('page-size').value=value;get('page-size').dispatch('input');
    const size=value==='all'?Math.max(1,count):Number(value),pages=Math.max(1,Math.ceil(count/size));
    for(let page=1;page<=pages;page++){
      const start=(page-1)*size,expected=fixture.slice(start,start+size).map(r=>r.domain);
      assert.deepEqual(rowDomains(),expected);
      assert.equal(get('page-prev').disabled,page===1);
      assert.equal(get('page-next').disabled,page===pages);
      assert.equal(get('empty').hidden,count>0);
      assert.ok(get('page-status').textContent.includes(`de ${count} sitios`));
      if(value==='all')assert.ok(!get('page-status').textContent.includes('Página'));
      else assert.ok(get('page-status').textContent.includes(`Página ${page} de ${pages}`));
      if(page<pages)get('page-next').onclick();
    }
    for(let page=pages-1;page>=1;page--){get('page-prev').onclick();assert.deepEqual(rowDomains(),fixture.slice((page-1)*size,page*size).map(r=>r.domain));}
  }
});

test('pagination: protected/unprotected filters plus search operate on full inventory',async()=>{
  await inventoryFixture(1072);
  dashboardRows.forEach((row,i)=>{row.protectedCookies=i%3===0?1:0;});
  dashboardWhitelist=dashboardRows.filter((_,i)=>i%5===0).map(r=>r.domain);
  await get('refresh').onclick();
  for(const filter of ['protected','unprotected']){
    get('page-next').onclick();get('filter').value=filter;get('filter').dispatch('input');
    const expected=dashboardRows.filter(r=>(dashboardWhitelist.includes(r.domain)||r.protectedCookies>0)===(filter==='protected'));
    assert.deepEqual(rowDomains(),expected.slice(0,50).map(r=>r.domain));assert.equal(get('page-prev').disabled,true);
    get('page-next').onclick();assert.deepEqual(rowDomains(),expected.slice(50,100).map(r=>r.domain));
    get('search').value='site00';get('search').dispatch('input');
    const searched=expected.filter(r=>r.domain.includes('site00'));
    assert.deepEqual(rowDomains(),searched.slice(0,50).map(r=>r.domain));assert.equal(get('page-prev').disabled,true);
    get('page-size').value='all';get('page-size').dispatch('input');assert.deepEqual(rowDomains(),searched.map(r=>r.domain));
    get('page-size').value='50';get('page-size').dispatch('input');get('search').value='';get('search').dispatch('input');
  }
});

test('pagination: global count, size, A-Z and local visits sorting before slicing',async()=>{
  const fixture=await inventoryFixture(205);
  for(const sort of ['count','bytes','domain','visits']){
    if(sort==='visits')historyRows=fixture.map(row=>({url:`https://${row.domain}/synthetic`}));
    get('page-next').onclick();get('sort').value=sort;get('sort').dispatch('input');
    if(sort==='visits')await until(()=>get('ranking-status').textContent.includes('Datos consultados'));
    const visitCount=row=>Number(row.domain.slice(4,8))%5+1;
    const expected=[...fixture].sort((a,b)=>sort==='domain'?a.domain.localeCompare(b.domain):sort==='visits'?visitCount(b)-visitCount(a)||a.domain.localeCompare(b.domain):b[sort]-a[sort]||a.domain.localeCompare(b.domain));
    assert.deepEqual(rowDomains(),expected.slice(0,50).map(r=>r.domain));assert.equal(get('page-prev').disabled,true);
    get('page-next').onclick();assert.deepEqual(rowDomains(),expected.slice(50,100).map(r=>r.domain));
    if(sort==='visits'){
      assert.deepEqual(rowVisits(),expected.slice(50,100).map(r=>`${visitCount(r)} visitas`));
      get('search').value='site00';get('search').dispatch('input');
      assert.deepEqual(rowDomains(),expected.filter(r=>r.domain.includes('site00')).slice(0,50).map(r=>r.domain));
      get('search').value='';get('search').dispatch('input');
    }
  }
});

test('optional history: refusal, retry, grant and revocation keep pagination/cleanup usable',async()=>{
  await inventoryFixture(107);historyGranted=false;grantResult=false;
  get('sort').value='visits';get('sort').dispatch('input');
  await until(()=>get('ranking-status').textContent.includes('El historial es opcional'));
  assert.equal(get('history-permission').hidden,false);assert.equal(get('rows').children.length,50);assert.ok(permissionRequests>0);
  get('page-next').onclick();assert.equal(get('rows').children.length,50);
  grantResult=true;get('history-permission').onclick();await until(()=>get('ranking-status').textContent.includes('Datos consultados'));
  assert.equal(get('history-permission').hidden,true);
  historyGranted=false;historyEvents.permissionRemoved({permissions:['history']});assert.ok(get('ranking-status').textContent.includes('El historial es opcional'));assert.equal(get('history-permission').hidden,false);
  const beforeQueries=queries;get('refresh').onclick();await until(()=>get('ranking-status').textContent.includes('El historial es opcional'));assert.equal(queries,beforeQueries);
  get('sort').value='count';get('sort').dispatch('input');assert.equal(get('history-permission').hidden,true);assert.equal(get('rows').children.length,50);
});
