import {validateWhitelist} from './policy.js';
export const DEFAULT = {whitelist: [], interval: 0, nextRun: null, history: []};
export async function readState(api) {
  const {state} = await api.storage.local.get('state');
  if (state === undefined) return structuredClone(DEFAULT);
  if (!state || ![0,1440,4320,10080].includes(state.interval) || !Array.isArray(state.history)) throw new Error('Configuración dañada: limpieza bloqueada');
  return {...state, whitelist: validateWhitelist(state.whitelist), history: state.history.slice(0,30)};
}
export async function saveState(api, state) { await api.storage.local.set({state}); }
export function createQueue() {
  let tail = Promise.resolve();
  return operation => { const result = tail.then(operation); tail = result.catch(() => {}); return result; };
}
