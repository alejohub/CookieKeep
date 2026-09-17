import test from 'node:test';import assert from 'node:assert/strict';
import {startCleanupProgress} from '../src/lib/progress-ui.js';
const ids=['notice','cleanup-progress','cleanup-progress-label','cleanup-progress-bar','cleanup-progress-stats','cancel-cleanup','clean','dry','settings','dialog-actions'];
test('progress UI displays aggregates, blocks duplicate cleaning and handles cancellation/completion',async()=>{
 const elements=new Map(ids.map(id=>[id,{hidden:false,disabled:false,textContent:'',children:[]}]));
 globalThis.document={getElementById:id=>elements.get(id)};
 const calls=[];globalThis.chrome={runtime:{sendMessage:async m=>{calls.push(m.type);return {ok:true,data:m.type==='cancel'?{state:'cancelling',total:100,processed:52,deleted:50,percent:52}:{state:'idle'}};}}};
 const changes=[],ui=startCleanupProgress(active=>changes.push(active));await new Promise(resolve=>setImmediate(resolve));
 ui.render({state:'running',total:100,processed:52,deleted:50,failed:1,skippedProtected:1,percent:52});
 assert.equal(elements.get('cleanup-progress').hidden,false);assert.equal(elements.get('cleanup-progress-bar').value,52);assert.ok(elements.get('cleanup-progress-stats').textContent.includes('52 / 100'));assert.ok(elements.get('cleanup-progress-stats').textContent.includes('50 / 100 eliminadas'));assert.equal(elements.get('clean').disabled,true);assert.equal(elements.get('dry').disabled,true);assert.equal(elements.get('cancel-cleanup').hidden,false);
 await elements.get('cancel-cleanup').onclick();assert.ok(calls.includes('cancel'));assert.equal(elements.get('cleanup-progress-label').textContent,'Cancelando limpieza…');
 ui.render({state:'completed',cancelled:true,incomplete:true,total:100,processed:52,deleted:50,percent:52});assert.ok(elements.get('cleanup-progress-label').textContent.includes('resumen parcial'));assert.equal(elements.get('cancel-cleanup').hidden,true);assert.deepEqual(changes,[true,false]);
 ui.render({state:'failed',interrupted:true});assert.ok(elements.get('cleanup-progress-label').textContent.includes('reiniciar'));ui.stop();
});
