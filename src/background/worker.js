import {normalizeHost, pageHost, applies, isProtected} from '../lib/domains.js';
import {estimateBytes, metadata, identity} from '../lib/cookies.js';
import {inventory} from '../lib/compat.js';
import {readState, saveState, createQueue} from '../lib/storage.js';
import {planCleanup} from '../lib/policy.js';
import {cleanup} from '../lib/cleanup.js';
import {createJob} from '../lib/job.js';
const api = chrome, queue = createQueue(), previews = new Map();
const ALARM = 'cookiekeep-clean';
let running = false,activeAuthorization=null;
const job=createJob(api,(host,source,options)=>cleanup(api,queue,host,source,options));
async function ensureAlarm() {
  const state = await readState(api);
  if (!state.interval) { await api.alarms.clear(ALARM); return; }
  const alarm = await api.alarms.get(ALARM);
  if (!alarm || alarm.periodInMinutes !== state.interval) {
    await api.alarms.create(ALARM, {when:Math.max(Date.now()+30000,state.nextRun || Date.now()+state.interval*60000), periodInMinutes:state.interval});
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
  if (message.type === 'toggle') {
    const host = normalizeHost(message.host);
    await queue(async()=>{const state=await readState(api); state.whitelist=state.whitelist.includes(host) ? state.whitelist.filter(h=>h!==host) : [...state.whitelist,host].sort(); await saveState(api,state);});
    await refreshBadges(); return true;
  }
  if (message.type === 'details') return (await inventory(api)).filter(c=>normalizeHost(c.domain)===normalizeHost(message.host)).map(metadata);
  if (message.type === 'preview') {
    const host=message.host ? normalizeHost(message.host) : null;
    const state=await readState(api), plan=planCleanup(await inventory(api),state.whitelist,host);
    const token=crypto.randomUUID(); previews.set(token,{host,at:Date.now(),authorized:new Set(plan.remove.map(identity))});
    for (const [key,p] of previews) if (Date.now()-p.at>600000) previews.delete(key);
    while(previews.size>32)previews.delete(previews.keys().next().value);
    return {token,...plan.summary,rows:plan.rows};
  }
  if (message.type === 'clean' || message.type === 'settings') {
    const preview=previews.get(message.token);
    if (message.type==='clean' || message.interval!==0) {
      if (!preview || Date.now()-preview.at>600000 || (message.type==='settings' && preview.host)) throw new Error('Haz una nueva vista previa antes de continuar');
    }
    if (message.type==='clean') {
      const host=message.host ? normalizeHost(message.host) : null;
      if(host!==preview.host)throw new Error('Scope de preview distinto');
      previews.delete(message.token); return runClean(host,'manual',preview.authorized);
    }
    if (![0,1440,4320,10080].includes(message.interval)) throw new Error('Intervalo inválido');
    await queue(async()=>{const state=await readState(api); state.interval=message.interval; state.nextRun=message.interval ? Date.now()+message.interval*60000 : null; await saveState(api,state); await api.alarms.clear(ALARM); await ensureAlarm();});
    previews.delete(message.token); return true;
  }
  throw new Error('Acción desconocida');
}
api.runtime.onMessage.addListener((message,sender,respond)=>{
  if (sender.id!==api.runtime.id || !sender.url?.startsWith(api.runtime.getURL(''))) return false;
  handle(message).then(data=>respond({ok:true,data}),()=>respond({ok:false,error:'No se pudo completar la operación. Revisa permisos/configuración; vuelve a generar la vista previa si ha caducado. La limpieza se bloquea ante datos inseguros.'})); return true;
});
api.alarms.onAlarm.addListener(alarm=>{if(alarm.name===ALARM) queue(async()=>{const state=await readState(api); if (!state.interval) return false; state.nextRun=Date.now()+state.interval*60000; await saveState(api,state); return true;}).then(enabled=>enabled && runClean(null,'automatic')).catch(()=>{});});
api.runtime.onStartup.addListener(()=>{queue(ensureAlarm).then(refreshBadges).catch(()=>{});});
api.runtime.onInstalled.addListener(()=>{queue(ensureAlarm).then(refreshBadges).catch(()=>{});});
api.tabs.onActivated.addListener(()=>refreshBadges().catch(()=>{}));
api.tabs.onUpdated.addListener((_id,change)=>{if(change.url || change.status==='complete') refreshBadges().catch(()=>{});});
let badgeTimer;
api.cookies.onChanged.addListener(change=>{if(change?.cookie){const id=identity(change.cookie);for(const preview of previews.values())preview.authorized.delete(id);activeAuthorization?.delete(id);}clearTimeout(badgeTimer); badgeTimer=setTimeout(()=>{if(!running)refreshBadges().catch(()=>{});},300);});
queue(ensureAlarm).catch(()=>{});
