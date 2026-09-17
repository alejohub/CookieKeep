import {isProtected, normalizeHost, applies} from './domains.js';
import {sameRemovalGroup, removalDetails, estimateBytes} from './cookies.js';
export function planCleanup(cookies, whitelist, host = null) {
  const protectedCookies = cookies.filter(c => isProtected(c, whitelist));
  const remove = [], keep = [];
  for (const c of cookies) {
    let safe = !isProtected(c, whitelist) && (!host || applies(c, host));
    if (safe && protectedCookies.some(p => sameRemovalGroup(c, p))) safe = false;
    try { removalDetails(c); } catch { safe = false; }
    (safe ? remove : keep).push(c);
  }
  const domains = list => [...new Set(list.map(c => normalizeHost(c.domain)))].sort();
  const groups = new Map();
  for (const cookie of remove) {
    const domain = normalizeHost(cookie.domain);
    if (!groups.has(domain)) groups.set(domain, {domain, count:0, approximateBytes:0});
    const row = groups.get(domain);
    row.count++; row.approximateBytes += estimateBytes(cookie);
  }
  const rows = [...groups.values()].sort((a,b) => a.domain.localeCompare(b.domain));
  return {remove, keep, rows, summary: {remove: remove.length, keep: keep.length, affectedDomains: domains(remove), keptDomains: domains(keep), protectedSites: whitelist, approximateBytes: rows.reduce((n,row) => n + row.approximateBytes,0)}};
}
export function validateWhitelist(list) {
  if (!Array.isArray(list) || list.some(h => typeof h !== 'string' || normalizeHost(h) !== h)) throw new Error('Whitelist dañada: limpieza bloqueada');
  return [...new Set(list)].sort();
}
