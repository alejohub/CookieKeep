import {bytes,request,node,button} from './ui.js';
import {identity} from './cookies.js';
const FIELDS=['name','domain','path','expirationDate','hostOnly','httpOnly','secure','session','sameSite','storeId','partitionKey','approximateBytes'];
export function cookieDetails(cookie){
  return Object.fromEntries(FIELDS.filter(key=>cookie[key]!==undefined).map(key=>[key,cookie[key]]));
}
export function createCookieList(host,onChange=async()=>{},isBusy=()=>false){
  const element=node('section',undefined,'cookie-list');
  const summary=node('p',undefined,'muted'),notice=node('p',undefined,'notice');notice.setAttribute?.('role','status');
  const rows=node('div',undefined,'cookie-list-rows');element.append(summary,notice,rows);
  let cookies=[],deleting=false;
  function render(){
    summary.textContent=`${cookies.length} cookies · ${bytes(cookies.reduce((n,c)=>n+(c.approximateBytes||0),0))} · Valores ocultos`;
    rows.replaceChildren();
    if(!cookies.length){rows.append(node('p','Este dominio no tiene cookies.'));return;}
    for(const c of [...cookies].sort((a,b)=>a.name.localeCompare(b.name)||a.path.localeCompare(b.path)||a.storeId.localeCompare(b.storeId))){
      const row=node('section',undefined,'cookie-row'),line=node('div',undefined,'cookie-row-line');
      const name=node('strong',c.name||'(nombre vacío)'),path=node('span',c.path,'cookie-path'),kind=node('span',c.session?'Sesión':'Persistente','muted'),size=node('span',bytes(c.approximateBytes),'muted');
      const detail=node('pre',undefined,'cookie-detail');detail.hidden=true;
      const view=button('Ver',()=>{detail.hidden=!detail.hidden;view.textContent=detail.hidden?'Ver':'Ocultar';if(!detail.hidden)detail.textContent=JSON.stringify(cookieDetails(c),null,2);},'secondary');
      view.setAttribute?.('aria-expanded','false');const toggle=view.onclick;view.onclick=async()=>{await toggle();view.setAttribute?.('aria-expanded',String(!detail.hidden));};
      const remove=button('Borrar',async()=>{
        if(c.protected){notice.textContent='Esta cookie pertenece a un sitio protegido. Quita su protección antes de borrarla.';return;}
        if(deleting||isBusy()){notice.textContent='Ya hay una limpieza en curso.';return;}
        if(!confirm(`¿Borrar esta cookie?\n\nCookie: ${c.name||'(nombre vacío)'}\nDominio: ${c.domain}\nPath: ${c.path}\n\nLa whitelist tiene prioridad. No se borrarán otras cookies.`))return;
        deleting=true;render();
        try{
          const result=await request('delete-cookie',{host,id:identity(c)});
          if(result.deleted===1){cookies=cookies.filter(cookie=>identity(cookie)!==identity(c));render();notice.textContent='Cookie borrada.';}
          else notice.textContent=result.missing?'La cookie ya no existe.':result.failed?'No se pudo borrar la cookie.':'No se borró la cookie: está protegida, cambió o el selector podría afectar a otras cookies.';
          await onChange();await load();
        }catch{notice.textContent='No se pudo borrar la cookie. Vuelve a intentarlo tras actualizar.';}
        finally{deleting=false;render();}
      },'danger');
      remove.disabled=!!c.protected||deleting||isBusy();if(c.protected)remove.title='Cookie protegida por la whitelist';
      const actions=node('div',undefined,'actions');actions.append(view,remove);line.append(name,path,kind,size,actions);row.append(line,detail);rows.append(row);
    }
  }
  async function load(){cookies=await request('details',{host});render();}
  return {element,load};
}
