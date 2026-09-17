import test from 'node:test';
import assert from 'node:assert/strict';
import {planCleanup} from '../src/lib/policy.js';
import {identity,inRemovalScope,removalDetails} from '../src/lib/cookies.js';
import {cookie,fixture} from './fixtures.mjs';
const parent=cookie({domain:'.example.com',hostOnly:false,name:'sid'});
const child=cookie({domain:'sub.example.com',name:'sid'});
const part=site=>({topLevelSite:`https://${site}.test`,hasCrossSiteAncestor:true});
for(const [label,protectedCookie,target,blocked] of [
  ['unrelated same name',cookie({domain:'protected.test',name:'sid'}),cookie({domain:'tracker.test',name:'sid'}),false],
  ['Domain parent in child URL',parent,child,true],
  ['hostOnly parent outside child URL',{...parent,hostOnly:true,domain:'example.com'},child,false],
  ['path parent boundary',{...parent,path:'/account'}, {...child,path:'/account/settings'},true],
  ['different paths',{...parent,path:'/admin'}, {...child,path:'/account'},false],
  ['path lookalike',{...parent,path:'/acc'}, {...child,path:'/account'},false],
  ['secure cookie outside ordinary HTTP',parent,{...child,secure:false},false],
  ['nonsecure cookie inside HTTPS',{...parent,secure:false},child,true],
  ['different store',parent,{...child,storeId:'1'},false],
  ['same CHIPS partition',{...parent,partitionKey:part('top')},{...child,partitionKey:part('top')},true],
  ['different CHIPS partition',{...parent,partitionKey:part('other')},{...child,partitionKey:part('top')},false],
  ['partitioned deletion unpartitioned collateral',parent,{...child,partitionKey:part('top')},true],
  ['unpartitioned deletion excludes CHIPS',{...parent,partitionKey:part('top')},child,false],
  ['evil label boundary',parent,{...child,domain:'evil-example.com'},false],
  ['suffix lookalike',parent,{...child,domain:'example.com.evil.test'},false],
  ['child outside parent URL',{...parent,domain:'.sub.example.com'},cookie({domain:'example.com',name:'sid'}),false]
])test(`H1 selector: ${label}`,()=>{
  assert.equal(inRemovalScope(protectedCookie,target,removalDetails(target)),blocked);
});
test('H1 policy: unrelated collision removable but real protected collateral blocks',()=>{
  const p=cookie({domain:'protected.test',name:'sid'}),t=cookie({domain:'tracker.test',name:'sid'});
  assert.deepEqual(planCleanup([p,t],['protected.test']).remove,[t]);
  assert.deepEqual(planCleanup([parent,child],['example.com']).remove,[]);
  assert.deepEqual(planCleanup([{...parent,path:'/admin'},child],['example.com']).remove,[child]);
});
test('H2 identity distinguishes target attributes, never includes value',()=>{
  const a=cookie();assert.equal(identity(a),identity({...a,value:'DIFFERENT_SYNTHETIC'}));
  for(const changes of [{hostOnly:false},{secure:false},{path:'/new'},{httpOnly:false},{sameSite:'strict'},{session:false,expirationDate:123},{partitionKey:part('x')},{storeId:'1'}])assert.notEqual(identity(a),identity({...a,...changes}));
  assert.ok(!identity(a).includes('SYNTHETIC'));
});
const f=fixture();globalThis.chrome=f.api;await import('../src/background/worker.js');
const send=message=>new Promise(resolve=>f.api.runtime.onMessage.listeners[0](message,{id:'test',url:'chrome-extension://test/src/options/index.html'},resolve));
const preview=async host=>(await send({type:'preview',host})).data;
test('H2 manual confirmation A plus new B deletes only A',async()=>{
  f.setWhitelist([]);f.setCookies([cookie()]);const p=await preview();f.add(cookie({domain:'after.test',name:'new'}));
  const result=await send({type:'clean',token:p.token,host:null});assert.equal(result.ok,true);assert.equal(result.data.deleted,1);assert.deepEqual(f.cookies.map(c=>c.domain),['after.test']);
});
test('H2 new same-name URL collateral blocks the whole removal operation',async()=>{
  f.setCookies([cookie({path:'/account'})]);const p=await preview();f.add(cookie({path:'/'}));
  const result=await send({type:'clean',token:p.token,host:null});assert.equal(result.data.deleted,0);assert.equal(f.cookies.length,2);
});
test('H2 protection added after preview always wins',async()=>{
  f.setCookies([cookie()]);f.setWhitelist([]);const p=await preview();await send({type:'toggle',host:'before.test'});
  const result=await send({type:'clean',token:p.token,host:null});assert.equal(result.data.deleted,0);assert.equal(f.cookies.length,1);f.setWhitelist([]);
});
test('H2 disappearance and metadata replacement fail safe',async()=>{
  for(const list of [[],[cookie({secure:false})],[cookie({path:'/new'})]]){
    f.setCookies([cookie()]);const p=await preview();f.setCookies(list);const result=await send({type:'clean',token:p.token,host:null});assert.equal(result.data.deleted,0);assert.equal(f.cookies.length,list.length);
  }
});
test('H2 overwrite event invalidates even a value-only replacement',async()=>{
  f.setCookies([cookie()]);const p=await preview();f.api.cookies.onChanged.emit({cookie:cookie(),removed:true,cause:'overwrite'});f.setCookies([cookie({value:'REPLACED_SYNTHETIC'})]);
  const result=await send({type:'clean',token:p.token,host:null});assert.equal(result.data.deleted,0);assert.equal(f.cookies.length,1);
});
test('H2 invalid, expired, reused and different-scope tokens rejected',async()=>{
  f.setCookies([cookie()]);assert.equal((await send({type:'clean',token:'invalid',host:null})).ok,false);
  const scoped=await preview('before.test');assert.equal((await send({type:'clean',token:scoped.token,host:'after.test'})).ok,false);assert.equal((await send({type:'clean',token:scoped.token,host:null})).ok,false);
  const p=await preview();const realNow=Date.now;Date.now=()=>realNow()+600001;
  try{assert.equal((await send({type:'clean',token:p.token,host:null})).ok,false);}finally{Date.now=realNow;}
  const fresh=await preview();assert.equal((await send({type:'clean',token:fresh.token,host:null})).ok,true);assert.equal((await send({type:'clean',token:fresh.token,host:null})).ok,false);
});
