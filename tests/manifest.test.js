import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const manifest=JSON.parse(await readFile(new URL('../manifest.json',import.meta.url),'utf8'));
test('core permissions exclude history, optional history declared',()=>{assert.deepEqual(manifest.permissions,['cookies','storage','alarms']);assert.deepEqual(manifest.optional_permissions,['history']);});
test('CSP allows packaged resources and blocks connections, embedding, forms and base overrides',()=>{
 const expected={"default-src":"'self'","script-src":"'self'","style-src":"'self'","img-src":"'self'","object-src":"'none'","connect-src":"'none'","base-uri":"'none'","form-action":"'none'","frame-src":"'none'"};
 const directives=Object.fromEntries(manifest.content_security_policy.extension_pages.split(';').map(s=>s.trim()).filter(Boolean).map(s=>{const [name,...value]=s.split(/\s+/);return [name,value.join(' ')];}));assert.deepEqual(directives,expected);
});
