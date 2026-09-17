import {$,request,perform} from './ui.js';
export function startCleanupProgress(onBusyChange=()=>{}){
  let busy=false,timer;
  function render(progress){
    const active=progress?.state==='running'||progress?.state==='cancelling';
    $('cleanup-progress').hidden=!progress||progress.state==='idle';
    if(progress){
      $('cleanup-progress-label').textContent=progress.state==='failed'?(progress.interrupted?'Limpieza interrumpida al reiniciar el servicio. Genera una nueva vista previa.':'No se pudo completar la limpieza.'):progress.state==='cancelling'?'Cancelando limpieza…':active?'Eliminando cookies…':progress.cancelled?'Limpieza cancelada · resumen parcial':'Limpieza completada';
      $('cleanup-progress-bar').value=progress.percent??0;
      $('cleanup-progress-stats').textContent=`${progress.processed??0} / ${progress.total??0} procesadas · ${progress.percent??0} % · ${progress.deleted??0} / ${progress.total??0} eliminadas · ${progress.failed??0} fallidas · ${progress.skippedProtected??0} omitidas por protección${progress.incomplete?' · Parcial':''}`;
    }
    $('cancel-cleanup').hidden=!active;
    $('cancel-cleanup').disabled=progress?.state==='cancelling';
    const clean=$('clean')||$('delete');if(active&&clean)clean.disabled=true;
    if(active&&$('dry'))$('dry').disabled=true;else if($('dry'))$('dry').disabled=false;
    if(active&&$('settings'))$('settings').disabled=true;else if($('settings'))$('settings').disabled=false;
    if(active&&$('dialog-actions'))for(const action of $('dialog-actions').children)if(action.textContent==='Confirmar activación')action.disabled=true;
    if(active!==busy){busy=active;onBusyChange(active);}
  }
  async function poll(){
    try{const p=await request('status');render(typeof p?.state==='string'?p:null);}catch{ /* Retry a worker restart; status never authorizes deletion. */ }
    timer=setTimeout(poll,busy?250:1000);timer.unref?.();
  }
  $('cancel-cleanup').onclick=()=>perform(async()=>render(await request('cancel')),$('cancel-cleanup'));
  poll();
  return {render,stop:()=>clearTimeout(timer)};
}
