import {DEFAULT} from '../src/lib/storage.js';
import {identity,inRemovalScope} from '../src/lib/cookies.js';
export const cookie=(changes={})=>({domain:'before.test',name:'old',value:'SYNTHETIC',hostOnly:true,path:'/',secure:true,httpOnly:true,sameSite:'lax',session:true,storeId:'0',...changes});
export const event=()=>({listeners:[],addListener(fn){this.listeners.push(fn);},emit(data){for(const fn of this.listeners)fn(data);}});
export function fixture(initial=[],whitelist=[]){
  let cookies=structuredClone(initial),state={...structuredClone(DEFAULT),whitelist},alarm;
  const calls=[],metrics={getAll:0,reads:0,writes:0,active:0,maxActive:0},changes=event();
  const matches=d=>cookies.filter(c=>inRemovalScope(c,{name:d.name,storeId:d.storeId,partitionKey:d.partitionKey},d));
  const api={
    runtime:{id:'test',getURL:p=>`chrome-extension://test/${p}`,onMessage:event(),onStartup:event(),onInstalled:event(),sendMessage:async()=>{}},
    storage:{local:{get:async()=>{metrics.reads++;return {state:structuredClone(state)};},set:async data=>{metrics.writes++;if(data.state)state=structuredClone(data.state);}},onChanged:event()},
    cookies:{onChanged:changes,getAllCookieStores:async()=>[{id:'0'},{id:'1'}],getAll:async d=>{metrics.getAll++;return cookies.filter(c=>c.storeId===d.storeId && (!d.name || c.name===d.name) && (!d.url || inRemovalScope(c,c,{url:d.url})));},get:async d=>matches(d).sort((a,b)=>b.path.length-a.path.length)[0],remove:async d=>{calls.push(d);const impacted=matches(d);for(const c of impacted){cookies=cookies.filter(x=>identity(x)!==identity(c));changes.emit({removed:true,cookie:c,cause:'explicit'});}return d;}},
    alarms:{get:async()=>alarm,clear:async()=>{alarm=undefined;},create:async(name,data)=>{alarm={name,...data};},onAlarm:event()},
    tabs:{query:async()=>[],onActivated:event(),onUpdated:event()},action:{setBadgeBackgroundColor:async()=>{},setBadgeText:async()=>{},setTitle:async()=>{}}
  };
  return {api,calls,metrics,get cookies(){return cookies;},get state(){return state;},setWhitelist:list=>{state.whitelist=list;},setCookies:list=>{cookies=structuredClone(list);},add:c=>{cookies.push(c);changes.emit({removed:false,cookie:c,cause:'explicit'});}};
}
