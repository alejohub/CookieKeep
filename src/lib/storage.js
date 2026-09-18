import {validateWhitelist} from './policy.js';
import {scheduleOf} from './schedule.js';
export const DEFAULT = {whitelist: [], cleanupSchedule:{mode:'disabled'}, nextRun: null, history: []};
export async function readState(api) {
  const {state} = await api.storage.local.get('state');
  if (state === undefined) return structuredClone(DEFAULT);
  if (!state || (!state.cleanupSchedule && ![0,1440,4320,10080].includes(state.interval)) || !Array.isArray(state.history)) throw new Error('Configuración dañada: limpieza bloqueada');
  const {interval,...rest}=state;
  const cleanupSchedule=scheduleOf(state);
  return {...rest,cleanupSchedule,nextRun:cleanupSchedule.mode==='interval'?state.nextRun:null,whitelist:validateWhitelist(state.whitelist),history:state.history.slice(0,30)};
}
export async function saveState(api, state) {const {interval,...rest}=state;await api.storage.local.set({state:{...rest,cleanupSchedule:scheduleOf(state)}});}
export function createQueue() {
  let tail = Promise.resolve();
  return operation => { const result = tail.then(operation); tail = result.catch(() => {}); return result; };
}
