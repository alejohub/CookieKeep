import {scheduleFromValue,scheduleValue,scheduleText} from '../lib/schedule.js';
import {$,bytes,date,request,perform,clean,previewText} from '../lib/ui.js';
$('version').textContent = `v${chrome.runtime.getManifest().version}`;
import {startCleanupProgress} from '../lib/progress-ui.js';
let host;
const progress=startCleanupProgress(()=>perform(refresh));
async function refresh(){const s=await request('snapshot'); host=s.host; const protectedSite=s.state.whitelist.includes(host); $('host').textContent=host || 'Página no compatible'; $('status').textContent=host ? (protectedSite ? 'Protegido' : 'No protegido') : 'Solo HTTP / HTTPS'; $('status').className=`status${protectedSite?' good':''}`; $('count').textContent=s.siteCount; $('size').textContent=bytes(s.siteBytes); $('protect').textContent=protectedSite?'Quitar protección':'Proteger sitio'; $('protect').disabled=!host; $('delete').disabled=!host || protectedSite || !s.siteCount || s.running; $('interval').value=scheduleValue(s.state);$('interval').disabled=s.running;$('next').textContent=scheduleText(s.state,s.nextRun);if(s.progress)progress.render(s.progress);}
$('protect').onclick=()=>perform(async()=>{await request('toggle',{host});await refresh();},$('protect'));
$('delete').onclick=()=>perform(()=>clean(host,refresh),$('delete'));
$('dashboard').onclick=()=>chrome.runtime.openOptionsPage();
perform(refresh);

$('interval').onchange=()=>perform(async()=>{
  const schedule=scheduleFromValue($('interval').value);let token;
  if(schedule.mode!=='disabled'){const p=await request('preview');if(!confirm(previewText(p)+'\n\n¿Activar esta limpieza automática?')){await refresh();return;}token=p.token;}
  await request('settings',{schedule,token});await refresh();
},$('interval'));
chrome.storage?.onChanged?.addListener((_changes,area)=>{if(area==='local')perform(refresh);});
