import {$,bytes,date,request,perform,clean} from '../lib/ui.js';
let host;
async function refresh(){const s=await request('snapshot'); host=s.host; const protectedSite=s.state.whitelist.includes(host); $('host').textContent=host || 'Página no compatible'; $('status').textContent=host ? (protectedSite ? 'Protegido' : 'No protegido') : 'Solo HTTP / HTTPS'; $('status').className=`status${protectedSite?' good':''}`; $('count').textContent=s.siteCount; $('size').textContent=bytes(s.siteBytes); $('protect').textContent=protectedSite?'Quitar protección':'Proteger sitio'; $('protect').disabled=!host; $('delete').disabled=!host || protectedSite || !s.siteCount || s.running; $('next').textContent=date(s.nextRun);}
$('protect').onclick=()=>perform(async()=>{await request('toggle',{host});await refresh();},$('protect'));
$('delete').onclick=()=>perform(()=>clean(host,refresh),$('delete'));
$('dashboard').onclick=()=>chrome.runtime.openOptionsPage();
perform(refresh);
