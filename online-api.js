// online-api.js — връзката с „Онлайн империя“ (Supabase). Клиентът само ИЗПРАЩА НАМЕРЕНИЯ: всяко действие е
// public.ol_* функция на сървъра, която проверява правата, парите и сроковете и сама пише резултата.
// Всяко действие носи req_id: ако връзката прекъсне, повтаряме със СЪЩИЯ req_id — сървърът връща същия резултат,
// без втори разход или втора награда. Входът е общ с облачните записи (същият storageKey).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const URL_ = 'https://lpzjscttqieqnqozscpk.supabase.co';
const KEY = 'sb_publishable_3Gats6iSx7BoyFUh63N1vQ__pHCBrul';   // публичен ключ — таблиците на онлайн режима са недостъпни, само ol_* функциите
export const sb = createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'stroi-auth' } });

// ── състояние на връзката: 'ok' | 'retry' | 'offline' ──
let conn = 'ok';
const listeners = new Set();
export const onConn = f => (listeners.add(f), f(conn));
const setConn = c => { if (c !== conn) { conn = c; listeners.forEach(f => f(c)); } };
export const connState = () => conn;
addEventListener('online', () => setConn('ok'));
addEventListener('offline', () => setConn('offline'));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const netErr = e => !e || /fetch|network|timeout|Failed|ECONN|503|502|504/i.test(e.message || e.code || String(e));

export class OnlineError extends Error { constructor(code, msg) { super(msg || code); this.code = code; } }

// Извиква ol_* функция. Мрежовите грешки се повтарят (до ~30 s) със същите аргументи — включително req_id.
async function call(fn, args = {}) {
  let wait = 600;
  for (let i = 0; ; i++) {
    let res;
    try { res = await sb.rpc(fn, args); } catch (e) { res = { error: e }; }
    if (!res.error) { setConn('ok'); return res.data; }
    const e = res.error;
    if (netErr(e) && i < 8) { setConn(navigator.onLine === false ? 'offline' : 'retry'); await sleep(wait); wait = Math.min(5000, wait * 1.7); continue; }
    if (netErr(e)) setConn('offline');
    const m = e.message || '';
    if (/rate_limited/.test(m)) throw new OnlineError('rate_limited', 'Твърде много заявки — изчакай малко.');
    if (/not_authenticated|JWT/i.test(m)) throw new OnlineError('auth', 'Входът изтече — влез отново.');
    throw new OnlineError('server', m || 'Грешка на сървъра.');
  }
}
// действие (намерение): нов req_id за всяко натискане; повторенията в call() пазят същия
export async function act(fn, args = {}) {
  const r = await call(fn, { p_req: crypto.randomUUID(), ...args });
  if (r && r.ok === false) throw new OnlineError(r.err, r.msg || r.err);
  return r;
}
export const read = (fn, args) => call(fn, args);

export const api = {
  worlds: () => read('ol_worlds'),
  state: world => read('ol_state', { p_world: world }),
  join: code => act('ol_join', { p_code: code }),
  createCompany: (world, name, brand, city) => act('ol_create_company', { p_world: world, p_name: name, p_brand: brand, p_city: city }),
  notesSeen: (world, upto) => read('ol_notes_seen', { p_world: world, p_upto: upto }),
  buyUnit: (world, type, qty = 1) => act('ol_buy_unit', { p_world: world, p_type: type, p_qty: qty }),
  sellUnit: (world, type) => act('ol_sell_unit', { p_world: world, p_type: type }),
  startBuild: (world, offer) => act('ol_start_build', { p_world: world, p_offer: offer }),
  tenders: world => read('ol_tenders', { p_world: world }),
  bid: (world, tender, cents) => act('ol_bid', { p_world: world, p_tender: tender, p_price: cents }),
  withdraw: (world, tender) => act('ol_withdraw', { p_world: world, p_tender: tender }),
  startContract: (world, contract) => act('ol_start_contract', { p_world: world, p_contract: contract }),
};
