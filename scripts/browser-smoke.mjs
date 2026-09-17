// Optional real-browser smoke test. A new disposable Edge profile is mandatory.
// Pass a locally installed Playwright index.mjs path as the first argument.
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const {chromium}=process.argv[2]?await import(pathToFileURL(resolve(process.argv[2])).href):await import('playwright');
const root=process.cwd(),profile=await mkdtemp(join(tmpdir(),'cookiekeep-qa-'));
const executable=join(process.env['ProgramFiles(x86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe');
let context;
try{
 context=await chromium.launchPersistentContext(profile,{executablePath:executable,headless:true,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 let [worker]=context.serviceWorkers();if(!worker)worker=await context.waitForEvent('serviceworker',{timeout:10000});
 const id=new URL(worker.url()).hostname,page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`chrome-extension://${id}/src/options/index.html`);
 const send=async message=>{const r=await page.evaluate(m=>chrome.runtime.sendMessage(m),message);assert.equal(r.ok,true);return r.data;};
 const set=details=>page.evaluate(d=>chrome.cookies.set({...d,value:'SYNTHETIC_QA_ONLY'}),details);
 const get=domain=>page.evaluate(d=>chrome.cookies.getAll({domain:d,partitionKey:{}}),domain);
 const base={name:'ck_qa_sid',path:'/',secure:false,sameSite:'lax'};
 await set({...base,url:'http://protected.test/'});await set({...base,url:'http://tracker.test/'});await send({type:'toggle',host:'protected.test'});
 const p=await send({type:'preview',host:'tracker.test'});assert.equal(p.remove,1);
 await set({...base,name:'ck_qa_new',url:'http://tracker.test/'});
 const result=await send({type:'clean',host:'tracker.test',token:p.token});assert.equal(result.deleted,1);assert.ok((await get('protected.test')).some(c=>c.name==='ck_qa_sid'));assert.deepEqual((await get('tracker.test')).map(c=>c.name),['ck_qa_new']);
 await set({...base,url:'http://example.test/',domain:'.example.test'});await set({...base,url:'http://sub.example.test/'});await send({type:'toggle',host:'example.test'});
 assert.equal((await send({type:'preview',host:'sub.example.test'})).remove,0);
 await set({...base,name:'ck_qa_path',url:'https://paths.test/account',path:'/account',secure:true});
 const pathPreview=await send({type:'preview',host:'paths.test'});await set({...base,name:'ck_qa_path',url:'https://paths.test/',secure:true});
 assert.equal((await send({type:'clean',host:'paths.test',token:pathPreview.token})).deleted,0);
 await set({url:'https://chips.test/',name:'ck_qa_chips',secure:true,sameSite:'no_restriction',partitionKey:{topLevelSite:'https://top.test',hasCrossSiteAncestor:true}});
 await send({type:'toggle',host:'top.test'});assert.equal((await send({type:'preview',host:'chips.test'})).remove,0);
 await send({type:'toggle',host:'top.test'});const cp=await send({type:'preview',host:'chips.test'});assert.equal(cp.remove,1);assert.equal((await send({type:'clean',host:'chips.test',token:cp.token})).deleted,1);
 const status=await send({type:'status'});assert.equal(status.state,'completed');
 // Start a longer real job, destroy the initiating UI, and inspect it from a
 // new popup. Only this temporary profile contains these synthetic targets.
 for(let offset=0;offset<1000;offset+=8)await Promise.all(Array.from({length:Math.min(8,1000-offset)},(_,i)=>set({url:`https://qa${offset+i}.test/`,name:`ck_qa_bulk_${offset+i}`,secure:true,sameSite:'lax'})));
 const bulk=await send({type:'preview'});await page.evaluate(token=>{chrome.runtime.sendMessage({type:'clean',host:null,token}).catch(()=>{});},bulk.token);
 let active;for(let attempt=0;attempt<20;attempt++){active=await send({type:'status'});if(active.state==='running')break;}assert.equal(active.state,'running');
 await page.close();const reopened=await context.newPage();await reopened.goto(`chrome-extension://${id}/src/popup/index.html`);await reopened.waitForFunction(()=>document.querySelector('#cleanup-progress-label').textContent==='Eliminando cookies…');assert.ok(await reopened.locator('#delete').isDisabled());
 const recovered=await reopened.evaluate(()=>chrome.runtime.sendMessage({type:'status'}));assert.equal(recovered.data.state,'running');
 await reopened.click('#cancel-cleanup');await reopened.waitForFunction(()=>document.querySelector('#cleanup-progress').hidden && document.querySelector('#notice').textContent.includes('resumen parcial'),{},{timeout:10000});
 await reopened.reload();assert.ok(await reopened.locator('#cleanup-progress').isHidden());
 const dashboard=await context.newPage();await dashboard.goto(`chrome-extension://${id}/src/options/index.html`);assert.ok(await dashboard.locator('#cleanup-progress').isHidden());await dashboard.reload();assert.ok(await dashboard.locator('#cleanup-progress').isHidden());
 const partial=await reopened.evaluate(()=>chrome.runtime.sendMessage({type:'status'}));assert.equal(partial.data.cancelled,true);assert.ok(partial.data.deleted<partial.data.total);
 const finishPreview=await dashboard.evaluate(()=>chrome.runtime.sendMessage({type:'preview'}));
 await dashboard.evaluate(token=>{chrome.runtime.sendMessage({type:'clean',host:null,token}).catch(()=>{});},finishPreview.data.token);
 await dashboard.waitForFunction(()=>!document.querySelector('#cleanup-progress').hidden);
 await reopened.waitForFunction(()=>!document.querySelector('#cleanup-progress').hidden);
 await dashboard.waitForFunction(()=>document.querySelector('#cleanup-progress').hidden,{},{timeout:30000});
 await reopened.waitForFunction(()=>document.querySelector('#cleanup-progress').hidden,{},{timeout:30000});
 for(const view of [dashboard,reopened])assert.equal(await view.locator('#cleanup-progress').evaluate(el=>el.getBoundingClientRect().height),0);
 await reopened.reload();await reopened.waitForFunction(()=>document.querySelector('#version').textContent.startsWith('v'));assert.ok(await reopened.locator('#cleanup-progress').isHidden());
 await dashboard.reload();assert.ok(await dashboard.locator('#cleanup-progress').isHidden());
 const manifest=JSON.parse(await readFile('manifest.json','utf8'));assert.equal(await reopened.locator('#version').textContent(),`v${manifest.version}`);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({browser:'Real headless Edge extension',version:manifest.version,profile:'disposable temporary profile',checks:['unrelated name collision','manual A+B intersection','Domain parent collateral','new same-name path collateral','CHIPS protection/removal','progress after closing initiating UI','real cancellation partial result','completion hides progress in both open pages with zero layout height','terminal reload stays hidden','native CSP/manifest loading'],passed:true}));
}finally{await context?.close();}
