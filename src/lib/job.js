export const PROGRESS_CHECKPOINT_MS=200;
const ACTIVE=new Set(['running','cancelling']);
export function createJob(api,run){
  let current={state:'idle',total:0,processed:0,deleted:0,failed:0,skipped:0,skippedProtected:0,percent:0,startedAt:null,duration:0},controller,lastWrite=0;
  const session=api.storage.session;
  const persist=async(force=false)=>{if(!session || (!force&&Date.now()-lastWrite<PROGRESS_CHECKPOINT_MS))return;lastWrite=Date.now();await session.set({cleanupProgress:current});};
  const ready=(async()=>{
    if(!session)return;
    const {cleanupProgress:saved}=await session.get('cleanupProgress');
    if(saved){current=saved;if(ACTIVE.has(current.state)){current={...current,state:'failed',incomplete:true,interrupted:true,duration:Date.now()-current.startedAt};await persist(true);}}
  })();
  const status=async()=>{await ready;return {...current,duration:ACTIVE.has(current.state)?Date.now()-current.startedAt:current.duration};};
  return {
    status,
    async cancel(){await ready;if(!ACTIVE.has(current.state))return status();controller?.abort();current={...current,state:'cancelling'};await persist(true);return status();},
    async start(host,source,authorized){
      await ready;
      if(ACTIVE.has(current.state))throw new Error('Ya hay una limpieza en curso');
      controller=new AbortController();
      current={state:'running',total:authorized?.size??0,processed:0,deleted:0,failed:0,skipped:0,skippedProtected:0,percent:0,startedAt:Date.now(),duration:0};
      try{
        await persist(true);
        const result=await run(host,source,{authorized,signal:controller.signal,onProgress:async progress=>{current={...current,...progress,state:controller.signal.aborted?'cancelling':'running'};await persist();}});
        current={...current,...result,state:'completed',duration:Date.now()-current.startedAt,percent:current.total?Math.floor(current.processed*100/current.total):100};
        await persist(true);return result;
      }catch(error){current={...current,state:'failed',incomplete:true,duration:Date.now()-current.startedAt};await persist(true);throw error;}
      finally{controller=null;}
    }
  };
}
