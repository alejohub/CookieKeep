import {inventory} from './compat.js';
import {readState, saveState} from './storage.js';
import {planCleanup} from './policy.js';
import {identity, removalDetails, estimateBytes, inRemovalScope} from './cookies.js';
export async function cleanup(api, queue, host = null, source = 'manual') {
  const initial = await readState(api);
  const candidates = planCleanup(await inventory(api), initial.whitelist, host).remove;
  const result = {at:Date.now(), source, deleted:0, affectedDomains:0, approximateBytes:0, skipped:0, failed:0, incomplete:false};
  const domains = new Set();
  const deadline = Date.now() + 180000;
  for (const candidate of candidates) {
    if (Date.now() > deadline) { result.incomplete = true; break; }
    await queue(async () => {
      const state = await readState(api);
      const live = await inventory(api);
      const current = planCleanup(live, state.whitelist, host).remove.find(c => identity(c) === identity(candidate));
      if (!current) { result.skipped++; return; }
      const details = removalDetails(current);
      const selected = await api.cookies.get(details);
      if (!selected || identity(selected) !== identity(current)) { result.skipped++; return; }
      // Chromium may remove multiple cookies matching the URL/name filter.
      const impacted = live.filter(c => inRemovalScope(c,current,details));
      try {
        const removed = await api.cookies.remove(details);
        if (!removed) { result.skipped++; return; }
        const after = await inventory(api);
        const remaining = new Set(after.map(identity));
        for (const deleted of impacted.filter(c => !remaining.has(identity(c)))) {
          result.deleted++; result.approximateBytes += estimateBytes(deleted); domains.add(deleted.domain);
        }
        if (remaining.has(identity(current))) result.failed++;
      } catch { result.failed++; }
    });
  }
  result.affectedDomains = domains.size;
  await queue(async () => { const state = await readState(api); state.history = [result,...state.history].slice(0,30); await saveState(api,state); });
  return result;
}
