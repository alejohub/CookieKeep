import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {planCleanup} from '../src/lib/policy.js';
import {previewText} from '../src/lib/ui.js';
class Element {
  constructor(){this.children=[];this.textContent='';this.listeners={};}
  append(...elements){this.children.push(...elements);}
  replaceChildren(...elements){this.children=[...elements];}
}
const markup=await readFile(new URL('../src/options/preview.html',import.meta.url),'utf8');
const elements=new Map([...markup.matchAll(/id="([^"]+)"/g)].map(match=>[match[1],new Element()]));
const get=id=>elements.get(id);
globalThis.document={getElementById:get,createElement:()=>new Element()};
const cookie=(domain,name)=>({domain,name,value:'SECRET',hostOnly:false,path:'/',secure:true,storeId:'0'});
const cookies=[cookie('.a.test','one'),cookie('.a.test','two'),cookie('b.test','three')];
let whitelist=[], cookieChange;
globalThis.chrome={runtime:{sendMessage:async message=>{
  if(message.type==='toggle'){whitelist.push(message.host);return {ok:true,data:true};}
  const plan=planCleanup(cookies,whitelist);return {ok:true,data:{...plan.summary,rows:plan.rows}};
}},storage:{onChanged:{addListener(){}}},cookies:{onChanged:{addListener(fn){cookieChange=fn;}}}};
await import('../src/options/preview.js');
async function until(condition){for(let i=0;i<100;i++){if(condition())return;await new Promise(resolve=>setTimeout(resolve,10));}assert.fail('La vista previa no se actualizó');}
test('vista detallada usa mismo plan para resumen/filas y recalcula tras proteger',async()=>{
  await until(()=>get('rows').children.length===2);
  assert.equal(get('summary').textContent,previewText(planCleanup(cookies,[]).summary));
  assert.equal(get('rows').children[0].children[1].textContent,'2');
  const protect=get('rows').children[0].children[3].children[0];protect.onclick();
  await until(()=>get('rows').children.length===1);
  assert.equal(get('rows').children[0].children[0].textContent,'b.test');
  assert.equal(get('summary').textContent,previewText(planCleanup(cookies,whitelist).summary));
  assert.ok(!get('summary').textContent.includes('SECRET'));
  get('refresh').onclick();await until(()=>get('rows').children.length===1);
  cookies.push(cookie('new.test','new'));cookieChange();await until(()=>get('rows').children.length===2);
  assert.equal(get('summary').textContent,previewText(planCleanup(cookies,whitelist).summary));
});
