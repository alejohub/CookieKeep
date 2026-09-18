import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const markup=await readFile(new URL('../src/popup/index.html',import.meta.url),'utf8');
class Element {constructor(){this.textContent='';this.disabled=false;}}

assert.match(markup,/<span class="muted popup-tagline">Protege lo importante\. Limpia el resto\.<\/span>/);
assert.ok(!/Só?lo en tu navegador/.test(markup));

test('popup reads version from the runtime manifest without changing snapshot or dashboard actions',async()=>{
  for(const version of ['9.8.7','2.3.4.5']){
    const elements=new Map([...markup.matchAll(/id="([^"]+)"/g)].map(match=>[match[1],new Element()]));
    globalThis.document={getElementById:id=>elements.get(id)};
    let manifestReads=0, dashboardOpened=0;
    globalThis.chrome={runtime:{
      getManifest(){manifestReads++;return {version};},
      openOptionsPage(){dashboardOpened++;},
      sendMessage:async()=>({ok:true,data:{host:'example.test',siteCount:12,siteBytes:2000,state:{whitelist:[]},nextRun:null,running:false}})
    }};
    await import(`../src/popup/popup.js?version-test=${version}`);
    assert.equal(elements.get('version').textContent,`v${version}`);
    assert.equal(manifestReads,1);
    // Allow the asynchronous snapshot response to render.
    for(let i=0;i<20 && elements.get('count').textContent!==12;i++)await new Promise(resolve=>setImmediate(resolve));
    assert.equal(elements.get('count').textContent,12);
    assert.equal(elements.get('host').textContent,'example.test');
    assert.equal(elements.get('protect').disabled,false);
    assert.equal(elements.get('delete').disabled,false);
    elements.get('dashboard').onclick();assert.equal(dashboardOpened,1);
  }
});
