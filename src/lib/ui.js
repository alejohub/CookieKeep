export const $ = id => document.getElementById(id);
export const bytes = n => n < 1024 ? `${n} B aprox.` : `${(n/1024).toFixed(1)} KB aprox.`;
export const date = n => n ? new Date(n).toLocaleString('es') : 'Desactivada';
export async function request(type, data={}) {
  const result=await chrome.runtime.sendMessage({type,...data});
  if (!result?.ok) throw new Error(result?.error || 'No se pudo contactar con CookieKeep');
  return result.data;
}
export function node(tag,text,className) { const el=document.createElement(tag); if(text!==undefined) el.textContent=text; if(className) el.className=className; return el; }
export function button(label,action,className='secondary') {
  const el=node('button',label,className); el.type='button'; el.onclick=()=>perform(action,el); return el;
}
export async function perform(action,el) {
  if(el) el.disabled=true;
  try { await action(); } catch(error) { $('notice').textContent=error.message; } finally { if(el) el.disabled=false; }
}
export function previewText(p) { return `${p.affectedDomains.length} sitios que se eliminarían · ${p.remove} cookies que se eliminarían · ${p.keptDomains.length} sitios conservados (${p.protectedSites.length} en whitelist) · ${p.keep} cookies conservadas. Tamaño eliminable: ${bytes(p.approximateBytes)}.`; }
export async function clean(host,refresh) {
  const p=await request('preview',{host});
  if(!confirm(`${previewText(p)}\n\nLa whitelist siempre tiene prioridad. La limpieza puede cerrar sesiones de sitios no protegidos. ¿Limpiar ahora?`)) return;
  const r=await request('clean',{token:p.token,host});
  await refresh();
  $('notice').textContent=`Eliminadas: ${r.deleted}. Omitidas: ${r.skipped}. Fallidas: ${r.failed}.${r.incomplete ? ' Tiempo límite alcanzado; puedes repetir la limpieza.' : ''}`;
}
