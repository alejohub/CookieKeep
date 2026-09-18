import {scheduleFromValue,scheduleValue,scheduleText} from '../lib/schedule.js';
import {$,bytes,date,request,node,button,perform,clean,previewText} from '../lib/ui.js';
import {createHistoryCache, sortByVisits} from '../lib/history.js';
import {startCleanupProgress} from '../lib/progress-ui.js';
import {createCookieList} from '../lib/cookie-list.js';
let snapshot;
let visibleDomains=[],bulkBusy=false;
const progress=startCleanupProgress(active=>{if(snapshot){snapshot.running=active;renderRows();}perform(refresh);});
let page = 1;
const historyCache = createHistoryCache({search:args=>chrome.history.search(args),getVisits:args=>chrome.history.getVisits(args)});
let historyListening=false;
let ranking = {phase: 'idle'}, rankingRequest = 0, historyTimer;
const historyPeriod = () => $('history-period').value === 'all' ? 'all' : Number($('history-period').value);
function rankingControls() {
  const active = $('sort').value === 'visits';
  $('history-period').hidden = !active;
  $('visits-heading').hidden = !active;
  $('ranking-status').hidden = !active;
  const label = historyPeriod() === 'all' ? 'Visitas · todo el historial disponible' : `Visitas últimos ${historyPeriod()} días`;
  $('visits-heading').textContent = label;
  let text = `${label}: consultando historial local…`;
  $('history-permission').hidden = !active || ranking.phase!=='permission';
  if(ranking.phase==='permission')text='El historial es opcional. Para ordenar por visitas, pulsa Permitir historial. Puedes seguir usando el dashboard y la limpieza sin concederlo.';
  if (ranking.phase === 'error') text = 'No se pudo consultar el historial. Comprueba el permiso de historial y pulsa Actualizar para reintentar. Se muestra orden A–Z y visitas no disponibles; no se usa el número de cookies.';
  if (ranking.phase === 'ready') {
    const result = ranking.result;
    text = `${label}. Registros de navegación disponibles, incluidos recargas y registros sincronizados; se excluyen subframes. Incluye subdominios. Sin datos = 0. Datos consultados: ${date(result.window.endTime)}.`;
    if (result.truncated || result.missingTimes) text += ' Recuento parcial (≥): se alcanzó el límite de resultados o existen visitas sin fecha. Los valores son mínimos conocidos y el orden puede ser incompleto.';
  }
  $('ranking-status').textContent = text;
}
async function loadRanking() {
  if (!snapshot || $('sort').value !== 'visits') return;
  const currentRequest = ++rankingRequest;
  ranking = {phase: 'loading'};
  renderRows();
  try {
    const granted=await chrome.permissions.contains({permissions:['history']});
    if(currentRequest!==rankingRequest || $('sort').value!=='visits')return;
    if(!granted){ranking={phase:'permission'};renderRows();return;}
    attachHistoryListeners();
    const result = await historyCache.get(snapshot.rows.map(row => row.domain), historyPeriod());
    if (currentRequest !== rankingRequest || $('sort').value !== 'visits') return;
    ranking = {phase: 'ready', result};
  } catch {
    if (currentRequest !== rankingRequest || $('sort').value !== 'visits') return;
    ranking = {phase: 'error'};
  }
  renderRows();
}
function showDialog(title,body,actions=[],closeLabel='Cerrar'){$('dialog-title').textContent=title; $('dialog-body').replaceChildren(...body); $('dialog-actions').replaceChildren(...actions,button(closeLabel,()=> $('dialog').close())); $('dialog').showModal();}
async function preview(){const p=await request('preview'); showDialog('Vista previa de limpieza',[node('p',previewText(p)),node('h3','Dominios afectados'),node('p',p.affectedDomains.join(', ') || 'Ninguno'),node('h3','Sitios en whitelist'),node('p',p.protectedSites.join(', ') || 'Ninguno'),node('h3','Dominios conservados'),node('p',p.keptDomains.join(', ') || 'Ninguno')]);}
async function details(host){
  const list=createCookieList(host,refresh,()=>snapshot?.running);
  await list.load();
  showDialog(host,[list.element]);
}
function renderRows() {
  rankingControls();
  const search = $('search').value.toLowerCase(), filter = $('filter').value, sort = $('sort').value;
  const protectedRow = row => snapshot.state.whitelist.includes(row.domain) || row.protectedCookies > 0;
  let rows = snapshot.rows.filter(row => row.domain.includes(search) && (filter === 'all' || (filter === 'protected') === protectedRow(row)));
  if (sort === 'visits') {
    rows = ranking.phase === 'ready' ? sortByVisits(rows, ranking.result.byHostname) : rows.sort((a,b) => a.domain.localeCompare(b.domain));
  } else {
    rows.sort((a,b) => sort === 'domain' ? a.domain.localeCompare(b.domain) : b[sort]-a[sort] || a.domain.localeCompare(b.domain));
  }
  $('rows').replaceChildren();
  $('empty').hidden = rows.length > 0;
  const size = Number($('page-size').value) || 50;
  const all = $('page-size').value === 'all';
  const pages = all ? 1 : Math.max(1, Math.ceil(rows.length / size));
  page = Math.max(1, Math.min(page, pages));
  const start = all ? 0 : (page - 1) * size;
  const visible = all ? rows : rows.slice(start, start + size);
  visibleDomains=visible.map(row=>row.domain);
  $('protect-list').disabled=bulkBusy||!visibleDomains.length;
  $('page-status').textContent = `Mostrando ${rows.length ? start + 1 : 0}–${start + visible.length} de ${rows.length} sitios${all ? '' : ` · Página ${page} de ${pages}`}`;
  $('page-prev').disabled = page === 1;
  $('page-next').disabled = page === pages;
  for (const row of visible) {
    const explicit = snapshot.state.whitelist.includes(row.domain), tr = node('tr'), domain = node('td');
    domain.append(button(row.domain, () => details(row.domain), 'link'));
    const status = node('td');
    status.append(node('span', explicit ? 'Protegido' : row.protectedCookies ? `${row.protectedCookies} cookies conservadas` : 'No protegido', `status${protectedRow(row) ? ' good' : ''}`));
    const actions = node('td'), wrap = node('div', undefined, 'actions');
    wrap.append(button(explicit ? 'Quitar protección' : 'Proteger', async () => { await request('toggle', {host:row.domain}); await refresh(); }));
    const remove = button('Borrar', () => clean(row.domain, refresh), 'danger');
    remove.disabled = explicit || !row.count || snapshot.running;
    wrap.append(remove); actions.append(wrap);
    tr.append(domain, node('td', String(row.count)), node('td', bytes(row.bytes)));
    if (sort === 'visits') {
      const partial = ranking.phase === 'ready' && (ranking.result.truncated || ranking.result.missingTimes);
      tr.append(node('td', ranking.phase === 'ready' ? `${partial ? '≥ ' : ''}${row.visits} visitas` : '—'));
    }
    tr.append(status, actions); $('rows').append(tr);
  }
}
async function refresh(){snapshot=await request('snapshot'); $('metrics').replaceChildren();for(const [label,value] of [['Cookies',snapshot.total],['Dominios con cookies',snapshot.rows.filter(r=>r.count).length],['Tamaño total estimado',bytes(snapshot.totalBytes)],['Sitios protegidos',snapshot.state.whitelist.length],['Cookies eliminables',snapshot.preview.remove]]){const card=node('div',undefined,'card');card.append(node('span',label,'muted'),node('div',String(value),'metric'));$('metrics').append(card);}$('interval').value=scheduleValue(snapshot.state); $('next').textContent=scheduleText(snapshot.state,snapshot.nextRun); $('clean').disabled=snapshot.running; $('history').replaceChildren(...snapshot.state.history.map(r=>node('li',`${date(r.at)} · ${r.source==='automatic'?'Automática':'Manual'} · ${r.deleted} cookies · ${r.affectedDomains} dominios · ${bytes(r.approximateBytes)} · ${r.skipped} omitidas · ${r.failed} fallidas${r.incomplete?' · Incompleta':''}`)));if(!snapshot.state.history.length)$('history').append(node('li','Todavía no hay limpiezas.'));renderRows();if(snapshot.progress)progress.render(snapshot.progress);await loadRanking();}
$('protect-list').onclick=()=>{
  const hosts=[...visibleDomains];if(bulkBusy||!hosts.length)return;
  showDialog(hosts.length===1?'¿Proteger este sitio?':`¿Proteger los ${hosts.length} sitios visibles actualmente?`,[
    node('p','Se añadirán a la lista de sitios protegidos todos los dominios que aparecen en esta página con los filtros actuales.')
  ],[button('Proteger sitios',async()=>{
    if(bulkBusy)return;bulkBusy=true;renderRows();
    try{const result=await request('protect-list',{hosts});$('dialog').close();await refresh();$('notice').textContent=`${result.added} sitios añadidos · ${result.alreadyProtected} ya estaban protegidos.`;}
    finally{bulkBusy=false;renderRows();}
  })],'Cancelar');
};
async function loadDashboardPreferences(){
  if(!$('sort').value)$('sort').value='visits';if(!$('history-period').value)$('history-period').value='7';
  let saved;try{saved=(await chrome.storage.local?.get?.('dashboardPreferences'))?.dashboardPreferences;}catch{return;}
  if(saved){if(['count','bytes','domain','visits'].includes(saved.sort))$('sort').value=saved.sort;if(['7','30','90','all'].includes(String(saved.historyRange)))$('history-period').value=String(saved.historyRange);}
}
function saveDashboardPreferences(){
  const preferences={sort:$('sort').value,historyRange:$('history-period').value};
  perform(async()=>{await chrome.storage.local?.set?.({dashboardPreferences:preferences});});
}
$('refresh').onclick=()=>perform(async()=>{historyCache.clear();await refresh();},$('refresh'));$('dry').onclick=()=>perform(preview,$('dry'));$('clean').onclick=()=>perform(()=>clean(null,refresh),$('clean'));
$('settings').onclick=()=>perform(async()=>{
  await request('settings',{schedule:scheduleFromValue($('interval').value)});await refresh();
},$('settings'));
for(const id of ['search','filter','page-size']) $(id).addEventListener('input',()=>{page=1;if(snapshot)renderRows();});
$('page-prev').onclick=()=>{page--;renderRows();};
$('page-next').onclick=()=>{page++;renderRows();};
$('sort').addEventListener('input',()=>{saveDashboardPreferences();if (!snapshot) return; page=1;rankingRequest++; renderRows(); if ($('sort').value==='visits') requestRankingPermission();});
$('history-period').addEventListener('input',()=>{saveDashboardPreferences();perform(loadRanking);});
function invalidateHistory() {
  historyCache.clear(); rankingRequest++; ranking={phase:'loading'};
  if (snapshot) renderRows();
  clearTimeout(historyTimer);
  historyTimer=setTimeout(()=>perform(loadRanking),350);
}
function attachHistoryListeners(){if(historyListening)return;chrome.history?.onVisited?.addListener(invalidateHistory);chrome.history?.onVisitRemoved?.addListener(invalidateHistory);historyListening=true;}
function requestRankingPermission(){
  // Invoke request synchronously from the user's input/click gesture. Chrome
  // does not prompt again when the optional permission is already granted.
  const currentRequest=++rankingRequest;ranking={phase:'loading'};renderRows();
  const grant=chrome.permissions.request({permissions:['history']});
  perform(async()=>{const allowed=await grant;if(currentRequest!==rankingRequest || $('sort').value!=='visits')return;if(allowed){await loadRanking();}else{ranking={phase:'permission'};renderRows();}});
}
$('history-permission').onclick=requestRankingPermission;
chrome.permissions.onRemoved.addListener(removed=>{if(!removed.permissions?.includes('history'))return;historyCache.clear();rankingRequest++;ranking={phase:'permission'};if(snapshot)renderRows();});
chrome.storage.onChanged.addListener((_change,area)=>{if(area==='local'){perform(refresh);}});
perform(async()=>{await loadDashboardPreferences();await refresh();});
