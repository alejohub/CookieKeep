import {$,request,perform} from './ui.js';
export const isCleanupActive=status=>status==='running'||status==='cancelling';
export function startCleanupProgress(onBusyChange=()=>{}){
  let busy=false,timer,stopped=false,revision=0;
  function render(progress){
    if(stopped)return;
    revision++;
    clearTimeout(timer);timer=undefined;
    const active=isCleanupActive(progress?.state);
    $('cleanup-progress').hidden=!active;
    if(active){
      $('cleanup-progress-label').textContent=progress.state==='cancelling'?'Cancelando limpieza…':'Eliminando cookies…';
      $('cleanup-progress-bar').value=progress.percent??0;
      $('cleanup-progress-stats').textContent=`${progress.processed??0} / ${progress.total??0} procesadas · ${progress.percent??0} % · ${progress.deleted??0} / ${progress.total??0} eliminadas · ${progress.failed??0} fallidas · ${progress.skippedProtected??0} omitidas por protección`;
    }else{
      $('cleanup-progress-label').textContent='';
      $('cleanup-progress-bar').value=0;
      $('cleanup-progress-stats').textContent='';
      if(progress?.state==='failed')$('notice').textContent=progress.interrupted?(progress.source==='automatic'?'Limpieza automática interrumpida al reiniciar el servicio.':'Limpieza manual interrumpida al reiniciar el servicio. Genera una nueva vista previa.'):progress.source==='automatic'?'No se pudo completar la limpieza automática.':'No se pudo completar la limpieza manual.';
      else if(progress?.cancelled || progress?.state==='cancelled')$('notice').textContent=`Limpieza cancelada · resumen parcial: ${progress.deleted??0} eliminadas · ${progress.skipped??0} omitidas · ${progress.failed??0} fallidas.`;
    }
    $('cancel-cleanup').hidden=!active;
    $('cancel-cleanup').disabled=progress?.state==='cancelling';
    const clean=$('clean')||$('delete');if(active&&clean)clean.disabled=true;
    if($('dry'))$('dry').disabled=active;
    if($('settings'))$('settings').disabled=active;
    if(active&&$('dialog-actions'))for(const action of $('dialog-actions').children)if(action.textContent==='Confirmar activación')action.disabled=true;
    if(active!==busy){busy=active;onBusyChange(active);}
    if(active){timer=setTimeout(poll,250);timer.unref?.();}
  }
  async function poll(){
    const before=revision;
    try{const p=await request('status');if(!stopped&&before===revision)render(typeof p?.state==='string'?p:null);}
    catch{if(!stopped&&busy&&before===revision){timer=setTimeout(poll,250);timer.unref?.();}}
  }
  // Session checkpoints also wake an idle UI for manual or automatic jobs.
  // No polling timer remains after a terminal state.
  const changed=(changes,area)=>{if(area==='session'&&changes.cleanupProgress)render(changes.cleanupProgress.newValue);};
  chrome.storage?.onChanged?.addListener(changed);
  function stop(){stopped=true;revision++;clearTimeout(timer);chrome.storage?.onChanged?.removeListener?.(changed);globalThis.removeEventListener?.('pagehide',stop);}
  globalThis.addEventListener?.('pagehide',stop,{once:true});
  $('cancel-cleanup').onclick=()=>perform(async()=>render(await request('cancel')),$('cancel-cleanup'));
  poll();
  return {render,stop};
}
