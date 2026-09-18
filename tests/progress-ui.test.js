import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {startCleanupProgress,isCleanupActive} from '../src/lib/progress-ui.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(page='popup',initial={state:'idle'}){
 const ids=['notice','cleanup-progress','cleanup-progress-label','cleanup-progress-bar','cleanup-progress-stats','cancel-cleanup',page==='popup'?'delete':'clean','dry','settings','dialog-actions'];
 const elements=new Map(ids.map(id=>[id,{hidden:false,disabled:false,textContent:'',children:[]}]));
 globalThis.document={getElementById:id=>elements.get(id)};
 let status=initial;const listeners=new Set(),calls=[],timers=new Map();let next=0;
 const originalSet=globalThis.setTimeout,originalClear=globalThis.clearTimeout;
 globalThis.setTimeout=(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;};globalThis.clearTimeout=id=>timers.delete(id);
 globalThis.chrome={storage:{onChanged:{addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn)}},runtime:{sendMessage:async m=>{calls.push(m.type);return {ok:true,data:m.type==='cancel'?{...status,state:'cancelling'}:status};}}};
 const changes=[],ui=startCleanupProgress(active=>{changes.push(active);elements.get(page==='popup'?'delete':'clean').disabled=active;});
 return {elements,ui,changes,calls,timers,listeners,setStatus:p=>{status=p;},emit:p=>{status=p;for(const fn of listeners)fn({cleanupProgress:{newValue:p}},'session');},restore(){ui.stop();globalThis.setTimeout=originalSet;globalThis.clearTimeout=originalClear;}};
}
for(const state of ['running','cancelling','completed','failed','cancelled','idle'])test(`${state}: only active cleanup states occupy progress space`,async()=>{
 const f=fixture('popup',{state,total:100,processed:52,deleted:50,percent:52});try{await tick();const active=['running','cancelling'].includes(state);assert.equal(isCleanupActive(state),active);assert.equal(f.elements.get('cleanup-progress').hidden,!active);assert.equal(f.elements.get('cancel-cleanup').hidden,!active);assert.equal(f.timers.size,active?1:0);if(active){assert.equal(f.elements.get('delete').disabled,true);assert.equal(f.elements.get('cleanup-progress-bar').value,52);assert.match(f.elements.get('cleanup-progress-stats').textContent,/50 \/ 100 eliminadas/);}else{assert.equal(f.elements.get('cleanup-progress-stats').textContent,'');assert.equal(f.elements.get('cleanup-progress-bar').value,0);}}finally{f.restore();}
});
for(const page of ['popup','dashboard'])test(`${page}: polling completion hides immediately, stops timer, reopens hidden and detects future cleanup`,async()=>{
 let f=fixture(page);try{
 await tick();f.emit({state:'running',total:100,processed:0,percent:0});assert.equal(f.elements.get('cleanup-progress').hidden,false);assert.equal(f.timers.size,1);
 f.setStatus({state:'completed',total:100,processed:100,deleted:100,percent:100});const [id,timer]=[...f.timers][0];f.timers.delete(id);assert.equal(timer.ms,250);await timer.fn();
 assert.equal(f.elements.get('cleanup-progress').hidden,true);assert.equal(f.timers.size,0);assert.equal(f.elements.get(page==='popup'?'delete':'clean').disabled,false);assert.deepEqual(f.changes,[true,false]);
 f.emit({state:'running',total:1});assert.equal(f.elements.get('cleanup-progress').hidden,false);f.emit({state:'completed'});assert.equal(f.timers.size,0);
 f.ui.stop();assert.equal(f.listeners.size,0);assert.equal(f.timers.size,0);
 }finally{f.restore();}
 f=fixture(page,{state:'completed',total:100,percent:100});try{await tick();assert.equal(f.elements.get('cleanup-progress').hidden,true);assert.equal(f.timers.size,0);}finally{f.restore();}
});
test('failure and cancellation keep necessary notice without progress; cancellation stays active until terminal',async()=>{
 const f=fixture();try{await tick();f.emit({state:'running',total:100});await f.elements.get('cancel-cleanup').onclick();assert.equal(f.elements.get('cleanup-progress').hidden,false);assert.equal(f.elements.get('cleanup-progress-label').textContent,'Cancelando limpieza…');f.emit({state:'completed',cancelled:true,incomplete:true,deleted:26,failed:1});assert.equal(f.elements.get('cleanup-progress').hidden,true);assert.match(f.elements.get('notice').textContent,/resumen parcial: 26 eliminadas/);f.emit({state:'failed',interrupted:true});assert.match(f.elements.get('notice').textContent,/reiniciar el servicio/);f.emit({state:'failed',source:'automatic'});assert.equal(f.elements.get('notice').textContent,'No se pudo completar la limpieza automática.');f.emit({state:'failed',source:'automatic',interrupted:true});assert.ok(!f.elements.get('notice').textContent.includes('vista previa'));assert.equal(f.timers.size,0);}finally{f.restore();}
});
test('both pages share progress component and hidden container removes layout space',()=>{
 const css=readFileSync('src/shared.css','utf8');assert.match(css,/\.cleanup-progress\[hidden\]\{display:none\}/);
 for(const page of ['popup','options']){assert.match(readFileSync(`src/${page}/${page==='popup'?'popup':'options'}.js`,'utf8'),/startCleanupProgress/);assert.match(readFileSync(`src/${page}/index.html`,'utf8'),/id="cleanup-progress"[^>]*hidden/);}
});
