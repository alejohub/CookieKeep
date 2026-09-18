import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
for(const surface of ['popup','options'])test(surface+': repository link is explicit, safe and keyboard accessible with runtime version',async()=>{
 const html=await readFile('src/'+surface+'/index.html','utf8'),js=await readFile('src/'+surface+'/'+(surface==='popup'?'popup':'options')+'.js','utf8');
 assert.ok(html.includes('<a href="https://github.com/alejohub/CookieKeep" target="_blank" rel="noopener noreferrer">GitHub</a>'));
 assert.ok(html.includes('class="muted extension-meta'));assert.ok(html.includes('<span id="version"></span>'));assert.ok(js.includes('chrome.runtime.getManifest().version'));
 assert.ok(!/on(?:click|focus)=|tabindex="-1"/.test(html));assert.ok(!/fetch\s*\(|XMLHttpRequest|https:\/\/github.com/.test(js));
});
test('metadata links preserve existing MV3 permissions and connection-blocking CSP',async()=>{
 const m=JSON.parse(await readFile('manifest.json','utf8'));assert.equal(m.manifest_version,3);assert.deepEqual(m.permissions,['cookies','storage','alarms']);assert.deepEqual(m.optional_permissions,['history']);assert.deepEqual(m.host_permissions,['http://*/*','https://*/*']);assert.match(m.content_security_policy.extension_pages,/connect-src 'none'/);
});
