import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
class Element{constructor(){this.children=[];this.listeners={};this.textContent='';this.value='';}append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}showModal(){this.open=true;}close(){this.open=false;}}
const all=el=>[el,...el.children.flatMap(all)];const tick=()=>new Promise(resolve=>setImmediate(resolve));
for(const page of ['popup','options'])test(`${page}: visible mode persists and reflects shared configuration changes immediately`,async()=>{
 const html=readFileSync(`src/${page}/index.html`,'utf8');assert.match(html,/<option value="lastWindowClosed">Al cerrar todas las ventanas<\/option>/);
 const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));const get=id=>elements.get(id);globalThis.document={getElementById:get,createElement:()=>new Element()};globalThis.confirm=()=>true;
 for(const [id,value] of [['sort','count'],['filter','all'],['page-size','50'],['history-period','30']])if(get(id))get(id).value=value;
 const listeners=[],calls=[];let state={whitelist:[],history:[],cleanupSchedule:{mode:'disabled'}};
 const send=async m=>{calls.push(m);let data;if(m.type==='status')data={state:'idle'};else if(m.type==='preview')data={token:'qa',remove:0,keep:0,affectedDomains:[],keptDomains:[],protectedSites:[],approximateBytes:0};else if(m.type==='settings'){state={...state,cleanupSchedule:m.schedule};for(const fn of listeners)fn({state:{newValue:state}},'local');data=true;}else data={host:'before.test',siteCount:1,siteBytes:100,state,total:1,totalBytes:100,rows:[],preview:{remove:1},running:false,nextRun:123456};return {ok:true,data};};
 globalThis.chrome={runtime:{getURL:p=>`chrome-extension://test/${p}`,getManifest:()=>({version:'1.1.5'}),sendMessage:send},storage:{onChanged:{addListener:fn=>listeners.push(fn),removeListener:()=>{}}},permissions:{onRemoved:{addListener(){}}}};
 await import(`../src/${page}/${page==='popup'?'popup':'options'}.js?schedule-test=${page}`);await tick();get('interval').value='lastWindowClosed';
 if(page==='popup')await get('interval').onchange();else await get('settings').onclick();
 await tick();assert.deepEqual(state.cleanupSchedule,{mode:'lastWindowClosed'});assert.equal(get('interval').value,'lastWindowClosed');assert.equal(get('next').textContent,'Próxima limpieza: al cerrar todas las ventanas');assert.ok(calls.some(c=>c.type==='settings'&&!c.token));assert.ok(!calls.some(c=>c.type==='preview'||c.type==='clean'));
 // A save from the other surface uses the same state/event, never a second flag.
 await send({type:'settings',schedule:{mode:'interval',interval:4320},token:'qa'});await tick();assert.equal(get('interval').value,'4320');assert.match(get('next').textContent,/Próxima limpieza:/);
 await send({type:'settings',schedule:{mode:'lastWindowClosed'},token:'qa'});await tick();assert.equal(get('interval').value,'lastWindowClosed');assert.equal(get('next').textContent,'Próxima limpieza: al cerrar todas las ventanas');
});
