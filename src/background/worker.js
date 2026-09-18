import {createRecentCookies,RECENT_HOURS} from '../lib/recent-cookies.js';
import {validateSchedule} from '../lib/schedule.js';
import {watchLastNormalWindow} from '../lib/last-window.js';
import {normalizeHost, pageHost, applies, isProtected} from '../lib/domains.js';
import {estimateBytes, metadata, identity} from '../lib/cookies.js';
import {inventory} from '../lib/compat.js';
import {readState, saveState, createQueue} from '../lib/storage.js';
import {planCleanup} from '../lib/policy.js';
import {cleanup} from '../lib/cleanup.js';
import {createJob} from '../lib/job.js';
const api = chrome, queue = createQueue(), previews = new Map();
const ALARM = 'cookiekeep-clean';
const recentCookies=createRecentCookies(api);
let running = false,activeAuthorization=null;
const job=createJob(api,(host,source,options)=>cleanup(api,queue,host,source,options));
async function ensureAlarm() {
  const state = await readState(api);
  if (state.cleanupSchedule.mode!=='interval') { await api.alarms.clear(ALARM); return; }
  const alarm = await api.alarms.get(ALARM);
  if (!alarm || alarm.periodInMinutes !== state.cleanupSchedule.interval) {
    await api.alarms.create(ALARM, {when:Math.max(Date.now()+30000,state.nextRun || Date.now()+state.cleanupSchedule.interval*60000), periodInMinutes:state.cleanupSchedule.interval});
  }
}
async function refreshBadges() {
  const [tabs, cookies, state] = await Promise.all([api.tabs.query({}),inventory(api),readState(api)]);
  for (const tab of tabs) {
    const host = pageHost(tab.url), protectedSite = host && state.whitelist.includes(host);
    const count = host ? cookies.filter(c => applies(c,host)).length : 0;
    try {
      await api.action.setBadgeBackgroundColor({tabId:tab.id,color:protectedSite ? '#16805d' : count ? '#c43d4a' : '#737d8b'});
      await api.action.setBadgeText({tabId:tab.id,text:host ? (count ? String(count) : protectedSite ? '✓' : '0') : ''});
      await api.action.setTitle({tabId:tab.id,title:host ? `CookieKeep · ${host} · ${protectedSite ? 'Protegido' : 'No protegido'} · ${count} cookies` : 'CookieKeep · Página no compatible'});
    } catch { /* tab may have closed */ }
  }
}
async function runClean(host, source, authorized = null) {
  if (running) throw new Error('Ya hay una limpieza en curso');
  running = true;activeAuthorization=authorized;
  try { return await job.start(host,source,authorized); }
  finally { activeAuthorization=null;running = false; await refreshBadges().catch(() => {}); }
}
async function handle(message) {
  if (!message || typeof message.type !== 'string') throw new Error('Solicitud inválida');
  if(message.type==='status')return job.status();
  if(message.type==='cancel')return job.cancel();
  if (message.type === 'snapshot') {
    await queue(ensureAlarm);
    const [state,cookies,alarm,tabs] = await Promise.all([readState(api),inventory(api),api.alarms.get(ALARM),api.tabs.query({active:true,currentWindow:true})]);
    const host = pageHost(tabs[0]?.url);
    const groups = new Map();
    for (const c of cookies) {
      const domain = normalizeHost(c.domain);
      if (!groups.has(domain)) groups.set(domain,{domain,count:0,bytes:0,protectedCookies:0});
      const row = groups.get(domain); row.count++; row.bytes += estimateBytes(c); if (isProtected(c,state.whitelist)) row.protectedCookies++;
    }
    for (const domain of state.whitelist) if (!groups.has(domain)) groups.set(domain,{domain,count:0,bytes:0,protectedCookies:0});
    const progress=await job.status();
    const relevant = host ? cookies.filter(c=>applies(c,host)) : [];
    return {state,host,siteCount:relevant.length,siteBytes:relevant.reduce((n,c)=>n+estimateBytes(c),0), rows:[...groups.values()],total:cookies.length,totalBytes:cookies.reduce((n,c)=>n+estimateBytes(c),0), preview:planCleanup(cookies,state.whitelist).summary,nextRun:alarm?.scheduledTime,running:progress.state==='running'||progress.state==='cancelling',progress};
  }
  if(message.type==='protect-list'){
    if(!Array.isArray(message.hosts)||message.hosts.length>100000)throw new Error('Listado inválido');
    const hosts=[...new Set(message.hosts.map(normalizeHost))];
    const result=await queue(async()=>{
      const state=await readState(api),existing=new Set(state.whitelist);
      let added=0;for(const host of hosts)if(!existing.has(host)){existing.add(host);added++;}
      if(added){state.whitelist=[...existing].sort();await saveState(api,state);}
      return {added,alreadyProtected:hosts.length-added,total:hosts.length};
    });
    if(result.added)await refreshBadges().catch(()=>{});
    return result;
  }
  if (message.type === 'toggle') {
    const host = normalizeHost(message.host);
    await queue(async()=>{const state=await readState(api); state.whitelist=state.whitelist.includes(host) ? state.whitelist.filter(h=>h!==host) : [...state.whitelist,host].sort(); await saveState(api,state);});
    await refreshBadges(); return true;
  }
  if (message.type === 'details') {
    const host=normalizeHost(message.host),state=await readState(api);
    return (await inventory(api)).filter(c=>normalizeHost(c.domain)===host).map(c=>({...metadata(c),protected:isProtected(c,state.whitelist)}));
  }
  if(message.type==='delete-cookie'){
    const host=normalizeHost(message.host);
    if(typeof message.id!=='string' || message.id.length>8192)throw new Error('Cookie inválida');
    const current=(await inventory(api)).find(c=>identity(c)===message.id);
    if(!current)return {deleted:0,missing:true};
    if(normalizeHost(current.domain)!==host)throw new Error('Dominio distinto');
    return runClean(host,'manual',new Set([message.id]));
  }
  if (message.type === 'preview') {
    const host=message.host ? normalizeHost(message.host) : null;
    const hours=message.recentHours??null;if(hours!==null&&!RECENT_HOURS.includes(hours))throw new Error('Intervalo temporal inválido');
    const state=await readState(api),cookies=await inventory(api),recent=hours===null?null:await recentCookies.eligible(cookies,hours);
    const plan=planCleanup(cookies,state.whitelist,host,c=>!recent||recent.has(identity(c)));
    const token=crypto.randomUUID(); previews.set(token,{host,recentHours:hours,at:Date.now(),authorized:new Set(plan.remove.map(identity))});
    for (const [key,p] of previews) if (Date.now()-p.at>600000) previews.delete(key);
    while(previews.size>32)previews.delete(previews.keys().next().value);
    return {token,...plan.summary,rows:plan.rows,recentHours:hours,protectedCookies:cookies.filter(c=>isProtected(c,state.whitelist)).length,temporalExcluded:recent?cookies.length-recent.size:0};
  }
  if(message.type==='clean'){
    const preview=previews.get(message.token);
    if(!preview)throw Object.assign(new Error('Preview inválida'),{code:'PREVIEW_INVALID'});
    if(Date.now()-preview.at>600000)throw Object.assign(new Error('Preview caducada'),{code:'PREVIEW_EXPIRED'});
    const host=message.host?normalizeHost(message.host):null;
    if(host!==preview.host || (message.recentHours??null)!==preview.recentHours)throw Object.assign(new Error('Scope distinto'),{code:'PREVIEW_SCOPE'});
    previews.delete(message.token);
    if(preview.recentHours!==null){const eligible=await recentCookies.eligible(await inventory(api),preview.recentHours);for(const id of preview.authorized)if(!eligible.has(id))preview.authorized.delete(id);}
    return runClean(host,'manual',preview.authorized);
  }
  if(message.type==='settings'){
    if(!message.schedule && ![0,1440,4320,10080].includes(message.interval))throw new Error('Intervalo inválido');
    const schedule=validateSchedule(message.schedule??(message.interval?{mode:'interval',interval:message.interval}:{mode:'disabled'}));
    await queue(async()=>{const state=await readState(api);state.cleanupSchedule=schedule;state.nextRun=schedule.mode==='interval'?Date.now()+schedule.interval*60000:null;await saveState(api,state);await api.alarms.clear(ALARM);await ensureAlarm();});
    return true;
  }
  throw new Error('Acción desconocida');
}
api.runtime.onMessage.addListener((message,sender,respond)=>{
  if (sender.id!==api.runtime.id || !sender.url?.startsWith(api.runtime.getURL(''))) return false;
  handle(message).then(data=>respond({ok:true,data}),error=>respond({ok:false,error:message.type==='protect-list'?'No se pudo proteger el listado actual.':message.type==='settings'?'No se pudo guardar la configuración de limpieza automática.':error.code==='PREVIEW_EXPIRED'?'La vista previa ha caducado. Genera una nueva antes de continuar.':error.code==='PREVIEW_INVALID'?'Genera una vista previa válida antes de limpiar manualmente.':error.code==='PREVIEW_SCOPE'?'La vista previa corresponde a otro sitio. Genera una nueva.':message.type==='clean'?'No se pudo completar la limpieza manual.':message.type==='delete-cookie'?'No se pudo borrar la cookie seleccionada.':'No se pudo completar la operación. Revisa permisos y configuración.'})); return true;
});
api.alarms.onAlarm.addListener(alarm=>{if(alarm.name===ALARM) queue(async()=>{const state=await readState(api); if (state.cleanupSchedule.mode!=='interval') return false; state.nextRun=Date.now()+state.cleanupSchedule.interval*60000; await saveState(api,state); return true;}).then(enabled=>enabled && runClean(null,'automatic')).catch(()=>{});});
api.runtime.onStartup.addListener(()=>{queue(ensureAlarm).then(refreshBadges).catch(()=>{});});
api.runtime.onInstalled.addListener(()=>{queue(ensureAlarm).then(refreshBadges).catch(()=>{});});
api.tabs.onActivated.addListener(()=>refreshBadges().catch(()=>{}));
api.tabs.onUpdated.addListener((_id,change)=>{if(change.url || change.status==='complete') refreshBadges().catch(()=>{});});
let badgeTimer;
api.cookies.onChanged.addListener(change=>{recentCookies.observe(change);if(change?.cookie){const id=identity(change.cookie);for(const preview of previews.values())preview.authorized.delete(id);activeAuthorization?.delete(id);}clearTimeout(badgeTimer); badgeTimer=setTimeout(()=>{if(!running)refreshBadges().catch(()=>{});},300);});
queue(ensureAlarm).catch(()=>{});

watchLastNormalWindow(api,async()=>{
  const [state,windows]=await Promise.all([readState(api),api.windows.getAll({windowTypes:['normal']})]);
  if(state.cleanupSchedule.mode==='lastWindowClosed' && !windows.some(w=>w.type==='normal') && !running)await runClean(null,'automatic');
});
