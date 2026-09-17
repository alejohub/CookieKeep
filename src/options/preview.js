import {$,bytes,date,request,node,button,perform,previewText} from '../lib/ui.js';

let generation=0, cookieTimer;
async function refresh() {
  const current=++generation;
  const preview=await request('preview');
  if (current!==generation) return;
  $('notice').textContent='';
  // Summary and rows are returned by the same planCleanup invocation.
  $('summary').textContent=previewText(preview);
  $('calculated').textContent=`Calculado: ${date(Date.now())}. Protege un sitio y se recalculará la vista.`;
  $('rows').replaceChildren();
  $('empty').hidden=preview.rows.length>0;
  for (const row of preview.rows) {
    const tr=node('tr'), actions=node('td');
    actions.append(button('Proteger sitio',async()=>{
      await request('toggle',{host:row.domain});
      await refresh();
    }));
    tr.append(node('td',row.domain),node('td',String(row.count)),node('td',bytes(row.approximateBytes)),actions);
    $('rows').append(tr);
  }
}
$('refresh').onclick=()=>perform(refresh,$('refresh'));
chrome.storage.onChanged.addListener((_changes,area)=>{if(area==='local')perform(refresh);});
chrome.cookies.onChanged.addListener(()=>{
  clearTimeout(cookieTimer);
  cookieTimer=setTimeout(()=>perform(refresh),300);
});
perform(refresh);
