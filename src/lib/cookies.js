import {normalizeHost, applies} from './domains.js';
const encoder = new TextEncoder();
export function estimateBytes(cookie) {
  return encoder.encode(JSON.stringify(cookie)).byteLength;
}
export function identity(cookie) {
  const p = cookie.partitionKey;
  return JSON.stringify([cookie.storeId, cookie.name, cookie.domain, cookie.path, p ? [p.topLevelSite, p.hasCrossSiteAncestor] : null]);
}
export function sameRemovalGroup(a, b) {
  const partition = c => JSON.stringify(c.partitionKey ? [c.partitionKey.topLevelSite, c.partitionKey.hasCrossSiteAncestor] : null);
  return a.name === b.name && a.storeId === b.storeId && partition(a) === partition(b);
}
export function inRemovalScope(cookie, target, details) {
  const url = new URL(details.url);
  const path = cookie.path;
  const pathMatches = url.pathname === path || (url.pathname.startsWith(path) && (path.endsWith('/') || url.pathname[path.length] === '/'));
  return sameRemovalGroup(cookie,target) && applies(cookie,url.hostname) && pathMatches && (!cookie.secure || url.protocol === 'https:');
}
export function removalDetails(cookie) {
  const host = normalizeHost(cookie.domain);
  if (typeof cookie.path !== 'string' || !cookie.path.startsWith('/')) throw new Error('Path inválido');
  const url = `${cookie.secure ? 'https' : 'http'}://${host}${cookie.path}`;
  const parsed = new URL(url);
  // URL normalization would otherwise change paths containing ?/#, dot segments or escapes.
  if (parsed.hostname !== host || parsed.pathname !== cookie.path || parsed.search || parsed.hash) throw new Error('URL ambigua');
  const details = {url, name: cookie.name, storeId: cookie.storeId};
  if (cookie.partitionKey) {
    if (!cookie.partitionKey.topLevelSite || typeof cookie.partitionKey.hasCrossSiteAncestor !== 'boolean') throw new Error('Partición ambigua');
    details.partitionKey = {...cookie.partitionKey};
  }
  return details;
}
export function metadata(cookie) {
  const {value, ...rest} = cookie;
  return {...rest, approximateBytes: estimateBytes(cookie)};
}
