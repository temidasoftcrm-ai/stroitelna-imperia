// coop.js — 🤝 ПАРТНЬОРСТВО в самостоятелната игра. Всеки играе своята игра (своята карта, време и скорост),
// а двамата партньори си помагат през облака (Supabase, public.coop_* функции — миграция 20261014070000_coop.sql):
//   • пари — подарък или заем (заемът се предлага, партньорът приема; връща се до срока, иначе играта сама го връща);
//   • техника и материали — от твоя град/склад в неговия;
//   • общи големи поръчки — и двамата влагат, след срока всеки получава вложеното + половината от печалбата (ако и двамата са вложили ≥ 20%);
//   • партньорът на картата — градовете му са със син пръстен (оранжев, ако твоята марка е синя) и името му; вижда се дали е онлайн;
//   • холдинг (част 3, миграция 20261014100000_coop3.sql): 40% от печалбата на поръчките, спасяване от фалит на 10-ия ден на минус,
//     дивидент 30% в края на всеки игрален месец, акции на борсата (след одобрение и от двамата). Общите строежи са лилави.
// Сървърът е „пощата“: всяка пратка се записва веднъж (req_id) и се получава веднъж (claim). Изпращачът първо вади
// парите/техниката от своята игра и пази заявката в localStorage, докато сървърът я потвърди — при срив се праща пак
// със същия req_id (без двойно изпращане); при отказ от сървъра се връща обратно.
import { UNIT_TYPES, MATERIALS } from './economy.js';
import { feature } from './lab/feature.js';
import { cleanMega } from './coopmega.js';   // 🤝 coop-mega: общите супер поръчки в снимката — изчистени
import { cleanPres } from './coopres.js';   // 🌐 coop-pres: президентството на партньора в снимката — изчистено
import { centerRender } from './coopcenter.js';   // 🤝 „Център на партньорството“ (feature 'coop-center') — новият прозорец

let PCOL = '#2f8cff';   // цветът на партньора: син, а ако твоята марка е синя — оранжев (pickCol)
const JCOL = '#b45cff';   // общ строеж — лилав
const ORDER_SHARE = 0.4, PROFIT_OF = 0.67;   // 40% от печалбата на поръчката (≈ сумата без материалите, ~⅓) → холдинга
const hueOf = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null; const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn; if (c < 0.15) return null; const h = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4; return (h * 60 + 360) % 360; };
const PEND = 'stroi-coop-pending', NAME = 'stroi-coop-name', POLL = 10000, SNAP_EVERY = 20000;
const AUTOTEST = /[?&]autotest/.test(location.search);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// данните от партньора (coop_snap, coop_status2) идват от чужд клиент — сървърът не ги проверява (вж. бележката SERVER-VALIDATION долу):
// текстът — без HTML знаци, числата — числа, id-тата — само [\w.-], цветът — #hex; така нищо не стига до innerHTML/SVG сурово
const txt = (s, n = 40) => String(s ?? '').replace(/[<>&"'`\\]/g, '').slice(0, n);
const num = x => Number.isFinite(+x) ? +x : 0;
const idOk = x => typeof x === 'number' ? Number.isFinite(x) : typeof x === 'string' && /^[\w.-]{1,48}$/.test(x);
const refOk = x => typeof x === 'string' && /^[\w.-]{1,48}\|[\w.-]{1,48}$/.test(x);
export const colOk = c => typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : null;
const arrOf = (a, ok, n) => Array.isArray(a) ? a.filter(ok).slice(0, n) : [];
function cleanSnap(P) {
  if (!P || typeof P !== 'object') return null;
  const obj = o => o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  return { ...P, name: txt(P.name, 24) || 'Партньор', brand: idOk(P.brand) ? P.brand : null, ico: txt(P.ico, 8), col: colOk(P.col),
    money: num(P.money), worth: num(P.worth), loan: num(P.loan), day: num(P.day) | 0, rep: Math.max(0, Math.min(5, num(P.rep))), office: num(P.office) | 0,
    hq: idOk(P.hq) ? P.hq : null, here: idOk(P.here) ? P.here : null, cities: arrOf(P.cities, idOk, 80),
    sites: Object.fromEntries(Object.entries(obj(P.sites)).filter(([k]) => idOk(k)).map(([k, L]) => [k, arrOf(L, x => x && typeof x === 'object', 120).map(x => ({ x: num(x.x), z: num(x.z), k: x.k === 'p' ? 'p' : 'b', t: idOk(x.t) ? x.t : undefined }))])),
    stats: Object.fromEntries(Object.entries(obj(P.stats)).map(([k, v]) => [txt(k, 20), num(v)])),
    hwDone: arrOf(P.hwDone, idOk, 200), hwJobs: arrOf(P.hwJobs, idOk, 200), rails: arrOf(P.rails, refOk, 200),
    railKm: Object.fromEntries(Object.entries(obj(P.railKm)).filter(([k]) => refOk(k)).slice(0, 200).map(([k, v]) => [k, num(v)])),
    infra: Object.fromEntries(Object.entries(obj(P.infra)).filter(([k, a]) => idOk(k) && Array.isArray(a)).map(([k, a]) => [k, a.slice(0, 3).map(num)])),
    fin: arrOf(P.fin, idOk, 300), wonC: arrOf(P.wonC, x => typeof x === 'string' && /^[A-Z]{3}$/.test(x), 100), hwWonC: arrOf(P.hwWonC, x => typeof x === 'string' && /^[\w.-]{1,40}$/.test(x), 300), railsHs: arrOf(P.railsHs, refOk, 200),
    lv: P.lv == null ? null : num(P.lv), pres: cleanPres(P.pres), mega: cleanMega(P.mega), fleet: arrOf(P.fleet, x => x && typeof x === 'object', 300).map(x => ({ ...x, ref: txt(x.ref, 100), cost: num(x.cost), nm: txt(x.nm) })) };
}
// coop_status2: общите строежи, наемите, изненадите, задачите — полетата, които партньорът задава сам
function cleanSt2(r) {
  if (!r || typeof r !== 'object') return r;
  const L = a => Array.isArray(a) ? a : [];
  return { ...r, joints: L(r.joints).map(j => ({ ...j, kind: j.kind === 'rail' ? 'rail' : 'hw', ref: txt(j.ref, 100), title: txt(j.title, 80), km: num(j.km) })),
    rentals: L(r.rentals).map(x => ({ ...x, type: UNIT_TYPES[x.type] ? x.type : '', price: Math.max(0, Math.round(num(x.price))), hours: num(x.hours) | 0 })).filter(x => x.type),
    surprises_mine: L(r.surprises_mine).map(x => ({ ...x, city: idOk(x.city) ? x.city : '', text: txt(x.text, 60), amount: num(x.amount) })),
    quests: L(r.quests).map(q => ({ ...q, nm: txt(q.nm, 80), progress: num(q.progress), target: num(q.target) || 1, reward: num(q.reward) })) };
}
// данните на пратка (coop_claim / история): типът — само от UNIT_TYPES, материалът — само от MATERIALS
const cleanD = D => { D = D && typeof D === 'object' ? D : {}; return { ...D, type: UNIT_TYPES[D.type] ? D.type : '', mat: MATERIALS[D.mat] ? D.mat : '', n: Math.max(1, Math.min(50, num(D.n) | 0 || 1)), qty: Math.max(0, num(D.qty)),
  amount: num(D.amount), owed: num(D.owed), hours: num(D.hours) | 0, nm: txt(D.nm, 60) }; };
// SERVER-VALIDATION (бележка за по-късно — миграция, сега НЕ): клиентът по-горе пази само себе си; сървърът (Supabase RPC) приема
// каквото му пратят. Да се добави в SQL: coop_snap — p_data: name ≤24 знака без <>&"'`, col ~ '^#[0-9a-f]{3,8}$', числата numeric, cities/hwDone/rails
// масиви от [\w.-] (≤80/200), размер на jsonb ≤ 64 KB; coop_send / coop_rent_* — type ∈ UNIT_TYPES, mat ∈ MATERIALS, qty/amount/price ≥ 0 и с горна граница,
// hours ∈ (2,6,12,24,48,72); coop_say — text ≤300; coop_joint — title ≤80, kind ∈ (hw, rail); surprises — text ≤60. Presence (stroi-online, cloud.js)
// не минава през база — там остава само проверката при показване.
const uid = () => crypto.randomUUID();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ago = iso => { const s = (Date.now() - Date.parse(iso)) / 1000; return s < 90 ? 'току-що' : s < 3600 ? `преди ${Math.round(s / 60)} мин` : s < 86400 ? `преди ${Math.round(s / 3600)} ч` : `преди ${Math.round(s / 86400)} дни`; };
const left = iso => { const s = (Date.parse(iso) - Date.now()) / 1000; return s <= 0 ? 'сега' : s < 3600 ? `${Math.ceil(s / 60)} мин` : `${Math.floor(s / 3600)} ч ${Math.round((s % 3600) / 60)} мин`; };

export function createCoop(d) {
  // облакът се зарежда отделно: ако няма интернет, самостоятелната игра работи както винаги
  let cloud = { user: () => null, sb: null }, sb = null;
  import('./cloud.js').then(m => { cloud = m.cloud; sb = cloud.sb; sb.auth.onAuthStateChange(() => setTimeout(tick, 300)); tick(); }).catch(() => {});
  let fetchedAt = 0, st4 = null, stRiv = null;   // stRiv — ⚖️ coop-riv-core (coop_riv_status); кога за последно дойдоха данните на партньора (горната лента на центъра)
  let st3 = null, st2 = null, tab = 'help', lastMarks = 0, st = null, open = false, busy = false, lastSnap = 0, user = null, applying = false;
  const E = () => d.econ(), f = n => d.fmt(n);
  const pend = () => { try { return JSON.parse(localStorage.getItem(PEND)) || []; } catch { return []; } };
  const setPend = a => { try { localStorage.setItem(PEND, JSON.stringify(a)); } catch {} };

  // извикване на сървъра; мрежовите грешки се повтарят със същите аргументи (и същия req_id)
  async function rpc(fn, args = {}, tries = 6) {
    let wait = 700; const t0 = Date.now();
    for (let i = 0; ; i++) {
      if (!sb) { rlog(fn, args, t0, i, null, 'Няма връзка с облака.'); throw new Error('Няма връзка с облака.'); }
      let r; try { r = await sb.rpc(fn, args); } catch (e) { r = { error: e }; }
      if (!r.error) { rlog(fn, args, t0, i, r.data, null); return r.data; }
      if (i >= tries || /not_authenticated|JWT|permission|PGRST202|Could not find the function|coop_limit/i.test((r.error.message || '') + (r.error.code || ''))) { rlog(fn, args, t0, i, null, r.error.message || r.error.code || String(r.error)); throw r.error; }   // coop_limit — тавана на сървъра (миграция coop_guard): не се повтаря
      await sleep(wait); wait = Math.min(6000, wait * 1.8);
    }
  }
  // 🤝 Дневник на партньорството (T2, Лабораторията → lab/coop-log.html): последните 200 извиквания — функция, кратко за аргументите, резултат или грешка,
  // време и опити; window.__coopLog (и sessionStorage — да остане след презареждане). Без лични данни: снимката (p_data) — само ключовете и размерът
  const RLOG_K = 'stroi-cooplog', RLOG = globalThis.__coopLog = (() => { try { return JSON.parse(sessionStorage.getItem(RLOG_K)) || []; } catch { return []; } })();
  const shortVal = v => { if (v == null) return String(v); if (typeof v === 'string') return v.length > 40 ? v.slice(0, 40) + '…' : v; if (typeof v !== 'object') return String(v); const j = JSON.stringify(v); return j.length > 60 ? `{${Object.keys(v).slice(0, 6).join(',')}${Object.keys(v).length > 6 ? ',…' : ''}} ${Math.round(j.length / 1024 * 10) / 10} KB` : j; };
  const sumArgs = a => Object.entries(a || {}).filter(([k]) => k !== 'p_req').map(([k, v]) => `${k.replace(/^p_/, '')}=${shortVal(v)}`).join(' ');
  function rlog(fn, args, t0, tries, data, err) {
    const POLL = /^coop_(status\d?|snap)$/; if (POLL.test(fn) && !err) { for (let k = RLOG.length - 1; k >= Math.max(0, RLOG.length - 8); k--) { const e = RLOG[k]; if (!POLL.test(e.fn) || e.err) break; if (e.fn === fn) { e.n = (e.n || 1) + 1; e.at = Date.now(); e.ms = Date.now() - t0; return; } } }   // опресняването на 20 с (status 1–4, snap) — по един ред „×N“
    RLOG.push({ at: Date.now(), fn, args: sumArgs(args), ms: Date.now() - t0, tries: tries + 1, ok: !err, err: err ? String(err).slice(0, 200) : null, res: err ? null : shortVal(data && typeof data === 'object' && 'ok' in data ? { ok: data.ok, ...(data.err ? { err: data.err } : {}), ...(data.msg ? { msg: data.msg } : {}) } : data) });
    if (RLOG.length > 200) RLOG.splice(0, RLOG.length - 200);
    try { sessionStorage.setItem(RLOG_K, JSON.stringify(RLOG)); } catch { }
  }

  // ── моето име за партньора ──
  const myName = () => { try { const n = localStorage.getItem(NAME); if (n) return n; } catch {} const b = d.brand(); return b ? b.nm : 'Партньор'; };

  // ── снимка на моята игра (партньорът я вижда в панела и на картата си) ──
  function snapshot() {
    const S = d.S(), e = E(), b = d.brand();
    return { name: myName(), brand: b?.k || null, ico: b?.ico || '🏗️', col: b?.col || '#ffb300', money: Math.round(e.money), worth: Math.round(d.netWorth()),
      loan: Math.round(e.s.loan || 0), day: S.day, rep: Math.round((S.rep || 0) * 10) / 10, office: S.officeLevel || 1, hq: S.hqCity || S.cityId, here: S.cityId,
      cities: d.ownedCities().filter(Boolean).slice(0, 80), sites: sites(), stats: d.stats(),
      hwDone: d.hwInfo().done.slice(0, 200), hwJobs: d.hwInfo().jobs.map(j => j.seg), rails: d.rails().map(r => r.ref).slice(0, 200),
      railKm: Object.fromEntries(d.rails().slice(0, 200).map(r => [r.ref, r.km])),
      infra: d.infra ? d.infra() : {},   // { град: [гара, летище, пристанище] } — партньорът ги развива заедно с теб
      lv: d.lv ? d.lv() : null,
      // 🤝 coop-countries: завършените ми градове (общото завладяване на държави) и държавите, чийто +10% доход съм поел аз (wonC — да не се плаща двойно)
      ...(feature('coop-countries') ? { fin: Object.keys(e.s.finished || {}).slice(0, 300), wonC: Object.keys(S.coopWon || {}).slice(0, 100) } : {}),
      // 🤝 coop-infra: куестите за обща магистрала/жп, чиято награда съм поел аз (hwWonC — да не се плаща двойно), и моите ⚡ модернизирани линии (Ориент Експрес)
      ...(feature('coop-infra') ? { hwWonC: Object.keys(S.coopHwWon || {}).slice(0, 300), railsHs: d.rails().filter(r => r.hs).map(r => r.ref).slice(0, 200) } : {}),
      // 🌐 coop-pres (coopres.js): { pres: { cc, lv, ind, rel, conf, aid, stab, tq } } — без флага е {}
      ...(d.presSnap ? d.presSnap() : {}),
      // 🤝 coop-mega (coopmega.js): { mega: { c, rh, w } } — без флага е {}
      ...(d.megaSnap ? d.megaSnap() : {}),
      ...(feature('coop-split') ? { railJobs: d.railJobs ? d.railJobs().slice(0, 100) : [], splitC: d.splitSnap ? d.splitSnap() : {} } : {}),   // 🤝 coop-split: жп линиите в строеж и изборът „Разделяне на трасето“
      fleet: d.fleet ? d.fleet().slice(0, 300) : [] };   // влаковете, корабите и самолетите [{ ref, cost, nm }] — общият флот (флаг coop-fleet)   // нивото на фирмата (неограничено) — общото ниво (флаг coop-lv, devlevel.js)
  }
  // къде строя по градове: текущият град се чете от играта, другите — от последното посещение (localStorage)
  const SITES = 'stroi-coop-sites';
  function sites() {
    let all = {}; try { all = JSON.parse(localStorage.getItem(SITES)) || {}; } catch {}
    const id = d.cityId(); if (id && d.ready()) all[id] = d.sitesHere().slice(0, 120);
    for (const k of Object.keys(all)) if (!d.ownedCities().includes(k)) delete all[k];
    try { localStorage.setItem(SITES, JSON.stringify(all)); } catch {}
    return all;
  }
  function pickCol() { const h = hueOf(d.brand()?.col); PCOL = h != null && h >= 185 && h <= 265 ? '#ff8a1f' : '#2f8cff'; window.__coopCol = PCOL; }
  // партньорът в моя 3D град: ако строи в същия град — пръстени в неговия цвят и табелки на парцелите му
  function markPartner() {
    if (!d.ready()) return;
    const P = st?.partner?.snap, id = d.cityId();
    const gifts = (st2?.surprises_for_me || []).filter(s => s.city === id).map(s => ({ x: +s.x, z: +s.z, k: 'g', text: s.text }));
    lastMarks = d.mark([...(P && P.sites && P.sites[id] || []), ...gifts], P ? P.name : '', PCOL) || 0;
  }

  // ── опашката от неизпратени пратки (оцелява при презареждане) ──
  // op: { fn, args, refund: { money } | { unit } | { mat, qty }, what }
  async function runOp(op) {
    let r;
    try { r = await rpc(op.fn, op.args); } catch (e) {
      if (/coop_limit/.test(e?.message || '')) r = { ok: false, msg: String(e.message).replace(/^.*?coop_limit:\s*/, '') + ' Парите се връщат.' };   // coop_guard (сървърът): над тавана → връщане
      else if (!/PGRST202|Could not find the function/i.test((e?.message || '') + (e?.code || ''))) {   // остава в опашката — ще опита пак, но не безкрайно (28.10: coop_send/coop_vault2 → 400 на всеки ~80 ms)
        op.tries = (op.tries || 0) + 1; if (op.tries < 3) { setPend(pend().map(x => x.args.p_req === op.args.p_req ? { ...x, tries: op.tries } : x)); return false; }
        console.warn('coop op', op.fn, e?.message || e); r = { ok: false, msg: 'Сървърът не прие операцията (' + String(e?.message || e?.code || 'грешка').slice(0, 80) + ') — парите се връщат.' }; }
      else r = { ok: false, msg: 'Сървърът още не поддържа това — парите се връщат.' };   // старият сървър (без новата функция) → връщане, не вечно чакане
    }
    setPend(pend().filter(x => x.args.p_req !== op.args.p_req));
    if (r && r.ok === false) { refund(op.refund, r.msg); return r; }
    return r;
  }
  function refund(rf, why) {
    if (!rf) return;
    if (rf.money) { E().earn(rf.money, 'партньор', 'Върнато — пратката не мина'); }
    if (rf.unit) for (let i = 0; i < (rf.n || 1); i++) if (d.giveUnit(rf.unit) !== 'ok') E().earn(UNIT_TYPES[rf.unit]?.cost || 0, 'партньор', 'Върната техника (няма място — стойността)');   // n — няколко машини наведнъж (центърът, v2)
    if (rf.mat) E().s.stock[rf.mat] = (E().s.stock[rf.mat] || 0) + rf.qty;
    d.save(); d.renderPanel();
    d.toast(`↩️ ${why || 'Пратката не мина'} — върнато обратно.`, 'bad');
  }
  async function queue(op) {
    setPend([...pend(), op]);
    d.save();   // извадените пари/техника са записани заедно с опашката
    const r = await runOp(op);
    if (r === false) d.toast('📶 Няма връзка — пратката ще тръгне сама, щом се появи интернет.', 'bad');
    return r;
  }

  // ── получаване на пратките (всяка точно веднъж) ──
  async function receive() {
    if (!st?.inbox?.length || !d.ready() || applying) return;
    applying = true;
    try {
      for (const x of st.inbox) {
        // техника „за град X“ (центърът, v2): чака в пощата, докато влезеш в този твой град
        if (feature('coop-center2') && x.kind === 'unit' && x.data?.city && x.data.city !== d.cityId() && d.ownedCities().includes(x.data.city)) continue;
        let r; try { r = await rpc('coop_claim', { p_id: x.id }, 2); } catch { break; }
        if (!r?.ok) continue;
        const D = cleanD(r.data), pn = partnerName();
        if (r.kind === 'unit') {
          const t = UNIT_TYPES[D.type]; if (!t) continue;
          for (let i = 0; i < (D.n || 1); i++) {
            const g = d.giveUnit(D.type);
            if (g !== 'ok') { E().earn(t.cost, 'партньор', `${t.nm} от ${pn} — ${g === 'office' ? 'офисът' : 'гаражът'} е пълен, получи стойността`); d.toast(`${t.ico} ${pn} ти прати ${t.nm.toLowerCase()}, но ${g === 'office' ? 'офисът' : 'гаражът'} е пълен — получи ${f(t.cost)} €.`, 'good'); }
            else d.toast(D.rental ? `🏢 ${t.ico} ${t.nm} под наем от ${pn} — връща се сам след срока.` : r.note === 'Върната от наем' || /Върната/.test(r.note || '') ? `🚚 ${t.ico} ${t.nm} се върна при теб.` : `🤝 ${pn} ти прати ${t.ico} ${t.nm.toLowerCase()}!`, 'good');
          }
        } else if (r.kind === 'mat') {
          const m = MATERIALS[D.mat]; if (!m) continue;
          E().s.stock[D.mat] = (E().s.stock[D.mat] || 0) + +D.qty;
          d.toast(`🤝 ${pn} ти прати ${m.ico} ${D.qty} ${m.unit} ${m.nm.toLowerCase()}.`, 'good');
        } else if (+D.amount > 0) {
          const amt = Math.round(+D.amount);
          if (r.kind === 'vault' && /Дивидент/i.test(r.note || '') && +D.amount > 0) d.modal('🏦 Холдингът разпредели печалбата', `Твоят дял от месечния дивидент: <b>+${f(Math.round(+D.amount))} €</b>.<br>${esc(r.note || '')}`, [['Супер! 💰', null]]);
        const why = D.fleet === 'buy' ? `🚆 ${pn} плати половината от ${D.nm || 'превозното средство'} (общ флот)` : D.fleet === 'income' ? `🚆 Половината от печалбата на общия флот на ${pn}` : { gift: `🎁 Подарък от ${pn}`, loan: `💸 Заем от ${pn} — върни ${f(D.owed)} € до ${D.hours} ч`, repay: `💸 ${pn} върна по заема`, refund: r.note || 'Върнати пари', mega: 'Обща поръчка', rent: `🏢 ${pn} плати наем за ${UNIT_TYPES[D.type]?.nm.toLowerCase() || 'техника'}`, vault: r.note || '🏦 От общата касичка' }[r.kind] || 'Партньор';
          E().earn(amt, 'партньор', why.replace(/^[^\wА-я]+\s*/, ''));
          d.toast(`${why}: +${f(amt)} €`, 'good');
        }
        d.save(); d.renderPanel();
      }
    } finally { applying = false; }
  }

  // ── заем с изтекъл срок: играта сама връща, колкото има ──
  async function autoRepay() {
    if (!st?.loans || !d.ready()) return;
    for (const l of st.loans) {
      if (l.out || l.status !== 'open' || !l.due_at || Date.parse(l.due_at) > Date.now()) continue;
      const need = l.owed - l.repaid, can = Math.min(need, Math.floor(E().money));
      if (can <= 0) continue;
      E().spend(can, 'партньор', `Връщане на заем към ${partnerName()} (срокът изтече)`);
      await queue({ fn: 'coop_repay', args: { p_req: uid(), p_loan: l.id, p_amount: can }, refund: { money: can } });
      d.toast(`⏰ Срокът на заема изтече — върнати ${f(can)} € на ${partnerName()}.`, 'bad');
    }
  }

  const partnerName = () => txt(st?.partner?.snap?.name) || 'партньора';

  // 🗺️ обща карта: магистралите, жп линиите и градовете на партньора стават част от твоята карта (game.js: hwAll, railEdges, coopCity)
  let shareSig = '';
  function shareMap() {
    const P = st?.pair?.status === 'active' ? st?.partner?.snap : null;
    if (!P) { if (window.__coopShared) { window.__coopShared = null; shareSig = ''; } return; }
    const hw = (P.hwDone || []).filter(x => typeof x === 'string' || typeof x === 'number'),
      rails = (P.rails || []).map(r => String(r).split('|')).filter(x => x.length === 2 && x[0] && x[1]),
      cities = (P.cities || []).filter(x => typeof x === 'string'), infra = P.infra && typeof P.infra === 'object' ? P.infra : {}, sig = JSON.stringify([P.name, hw, rails, cities, infra, P.col || null]);
    // 🤝 coop-countries: завършените градове на партньора — САМО познати id-та (cityName връща самото id за непознат град). Списъкът идва от чуждия клиент (сървърът не го проверява):
    // ползва се само козметично (картата, таблото, попъпа) и за XP; парите (+10% доход, куестите) се дават само на единия — game.js coopLead
    const known = x => { const n = d.cityName(x); return !!n && n !== x; }, coopC = feature('coop-countries'),
      fin = coopC ? (P.fin || []).filter(x => typeof x === 'string' && known(x)).slice(0, 300) : [], wonC = coopC ? (P.wonC || []).slice(0, 100) : [];
    // 🤝 coop-infra: наградите за общите магистрали/жп, поети от партньора (hwWonC), и неговите ⚡ модернизирани линии (railsHs)
    const coopI = feature('coop-infra'), hwWonC = coopI ? (P.hwWonC || []).slice(0, 300) : [], railsHs = coopI ? (P.railsHs || []).slice(0, 200) : [];
    // 🤝 coop-split: участъците и линиите, които партньорът строи сега, и изборите му при едновременен строеж
    const coopS = feature('coop-split'), hwJ = coopS ? (P.hwJobs || []).filter(x => typeof x === 'string' || typeof x === 'number').slice(0, 100) : [], railJ = coopS ? (P.railJobs || []).filter(x => typeof x === 'string' && /^[\w-]+\|[\w-]+$/.test(x)).slice(0, 100) : [],
      splitC = coopS && P.splitC && typeof P.splitC === 'object' && !Array.isArray(P.splitC) ? Object.fromEntries(Object.entries(P.splitC).filter(([k, v]) => /^(hw|rail):[\w|-]{1,60}$/.test(k) && (v === 'split' || v === 'cancel')).slice(0, 50)) : {};
    const sig2 = sig + JSON.stringify([fin, wonC, coopC ? user?.id || null : null, coopC ? st?.partner?.id || null : null]) + (coopI ? JSON.stringify([hwWonC, railsHs, user?.id || null, st?.partner?.id || null]) : '') + (coopS ? JSON.stringify([hwJ, railJ, splitC, st?.partner?.id || null]) : '');
    if (sig2 === shareSig) return;
    shareSig = sig2;
    window.__coopShared = { v: (window.__coopShared?.v || 0) + 1, name: txt(P.name) || 'партньора', hw, rails, cities, infra, col: colOk(P.col), ...(coopC ? { fin, wonC, me: String(user?.id || ''), pid: String(st?.partner?.id || '') } : {}), ...(coopI ? { hwWonC, railsHs, me: String(user?.id || ''), pid: String(st?.partner?.id || '') } : {}), ...(coopS ? { hwJ, railJ, splitC, pid: String(st?.partner?.id || '') } : {}) };   // col — цветът на марката му (линиите на картата, флаг coop-col)
    try { d.infraSync && d.infraSync(infra, P.name || 'партньора'); } catch (e) { console.warn('coop infra', e); }
  }
  async function tick() {
    if (AUTOTEST) return;
    user = sb && cloud.user && cloud.user(); if (user && user.is_anonymous) user = null;   // 👤 guest-cloud: гостът — без партньорство (нужен е акаунт)
    if (!user) { st = null; mount(); return; }
    for (const op of pend()) await runOp(op);   // недоизпратените от миналия път
    try {
      if (d.ready() && Date.now() - lastSnap > SNAP_EVERY) { lastSnap = Date.now(); await rpc('coop_snap', { p_data: snapshot() }, 1); }
      const r = await rpc('coop_status', {}, 1);
      pickCol();
      const before = JSON.stringify([st?.partner?.snap?.cities || [], st2?.joints || [], window.__coopShared?.v, PCOL]);
      if (r && r.ok && r.partner) r.partner = { ...r.partner, snap: cleanSnap(r.partner.snap) };   // чуждите данни — изчистени веднъж тук
      st = r && r.ok ? r : st; if (r && r.ok) fetchedAt = Date.now();
      const r2 = st?.pair?.status === 'active' ? await rpc('coop_status2', {}, 1) : null;
      st2 = r2 && r2.ok && r2.active ? cleanSt2(r2) : null;
      if (r && r.ok && !st2 && st?.pair?.status !== 'active') batchRefund();   // 📦 партньорството го няма — натрупаното се връща
      const r3 = st2 ? await rpc('coop_status3', {}, 1).catch(() => null) : null;
      st3 = r3 && r3.ok && r3.active ? r3 : null;
      const r4 = st2 && feature('coop-center2') ? await rpc('coop_status4', {}, 1).catch(() => null) : null;   // правилата на общата каса (миграция coop4 — без нея няма карта)
      st4 = r4 && r4.ok && r4.active ? r4 : null;
      const r5 = st2 && feature('coop-riv-core') ? await rpc('coop_riv_status', {}, 1).catch(() => null) : null;   // ⚖️ coop-riv-core: режимът и отношенията (миграция coop6 — без нея няма данни)
      stRiv = r5 && r5.ok && r5.active ? r5 : null;
      shareMap();
      if (feature('coop-split') && d.splitTick) d.splitTick();   // 🤝 coop-split: известията и „Разделяне на трасето“
      const J = (st2?.joints || []).filter(j => j.status === 'active');
      window.__coopJoint = st2 ? { hw: new Set(J.filter(j => j.kind === 'hw').map(j => j.ref)), rail: new Set(J.filter(j => j.kind === 'rail').map(j => j.ref)) } : null;
      if (JSON.stringify([st?.partner?.snap?.cities || [], st2?.joints || [], window.__coopShared?.v, PCOL]) !== before) d.drawMap();
    } catch { }
    await receive();
    await autoRepay();
    await partTwo();
    markPartner();
    mount();
    const f0 = document.activeElement;   // не прерисува, докато пишеш в поле
    if (open && !(f0 && f0.closest && f0.closest('#coopBox') && /INPUT|SELECT|TEXTAREA/.test(f0.tagName))) render();
  }

  // ── част 2: чат, бонуси от общи обекти, връщане на наета техника, изненади ──
  const LS = (k, v) => { try { if (v === undefined) return +localStorage.getItem(k) || 0; localStorage.setItem(k, v); } catch { return 0; } };
  const unread = () => (st2?.messages || []).filter(m => !m.me && m.id > LS('stroi-coop-read')).length;
  const seenGift = {}, warnedRent = {};
  async function partTwo() {
    if (!st2) return;
    // нови съобщения от партньора → известие (🆘 — червено)
    const last = LS('stroi-coop-msg');
    for (const m of st2.messages) if (!m.me && m.id > last) d.toast(`${m.sos ? '🆘' : '💬'} ${partnerName()}: ${m.text}`, m.sos ? 'bad' : 'good', () => { tab = 'chat'; open = true; render(); });
    const mx = Math.max(last, ...st2.messages.map(m => m.id)); if (mx > last) LS('stroi-coop-msg', mx);
    if (!d.ready()) return;
    // общ участък/линия, завършен (от единия — картата е обща) → еднократен бонус за всеки
    for (const j of st2.joints) if (j.status === 'active' && j.done && !j.bonus_claimed) {
      const r = await rpc('coop_joint_bonus', { p_id: j.id }, 1).catch(() => null);
      if (r?.ok) { E().earn(r.amount, 'партньор', `🤝 Общ обект: ${r.title}`); if (feature('xp-km')) d.addXp?.(500); d.save(); d.renderPanel(); d.toast(`🤝 ${r.title} е готов и при двама ви! Бонус +${f(r.amount)} €, а всеки ден — още доход.`, 'good'); }
    }
    // наета техника: срокът изтече → връща се сама (щом е свободна)
    for (const r of st2.rentals) if (!r.out && r.status === 'active' && r.until && Date.parse(r.until) <= Date.now()) {
      if (!d.takeUnit(r.type)) { if (!warnedRent[r.id]) { warnedRent[r.id] = 1; d.toast(`⏰ Наемът на ${UNIT_TYPES[r.type]?.nm.toLowerCase()} изтече — ще се върне при ${partnerName()}, щом се освободи от обекта.`, 'bad'); } continue; }
      await queue({ fn: 'coop_rent_act', args: { p_req: uid(), p_id: r.id, p_action: 'return' }, refund: { unit: r.type } });
      d.toast(`🚚 ${UNIT_TYPES[r.type]?.ico} ${UNIT_TYPES[r.type]?.nm} се върна при ${partnerName()} (наемът изтече).`);
    }
    // изненади в града, в който си: виждаш кутията няколко секунди, после я „отваряш“
    for (const s of st2.surprises_for_me) {
      if (s.city !== d.cityId()) continue;
      seenGift[s.id] = seenGift[s.id] || Date.now();
      if (Date.now() - seenGift[s.id] < 6000) continue;
      const r = await rpc('coop_surprise_find', { p_id: s.id }, 1).catch(() => null);
      if (r?.ok) { if (r.amount > 0) E().earn(r.amount, 'партньор', `🎁 Изненада от ${partnerName()}`); d.save(); d.renderPanel();
        d.modal(`🎁 Изненада от ${esc(partnerName())}!`, `„${esc(r.text)}“${r.amount > 0 ? `<br><br>+${f(r.amount)} €` : ''}`, [['Благодаря! 💖', null]]); }
    }
  }
  const activeJoints = kind => (st2?.joints || []).filter(j => j.status === 'active' && j.kind === kind);
  // общ участък: докато и партньорът го строи (или вече го е построил) — твоят върви 30% по-бързо
  window.__coopHwMul = seg => { const P = st?.partner?.snap; return activeJoints('hw').some(j => j.ref === seg) && P && ((P.hwJobs || []).includes(seg) || (P.hwDone || []).includes(seg)) ? 1.3 : 1; };
  // всеки игрален ден: доход от завършените общи обекти (магистрала 3 €/км, влак 8 €/км)
  window.__coopDay = () => {
    const sum = [...activeJoints('hw'), ...activeJoints('rail')].filter(j => j.done).reduce((a, j) => a + j.km * (j.kind === 'hw' ? 3 : 8), 0);
    if (sum > 0) E().earn(sum, 'партньор', `🤝 Общи магистрали и влакове с ${partnerName()}`);
    holdDay(); fleetDay(); batchTick();
  };
  // 🚆✈️🚢 общият флот (флаг coop-fleet; потребителят: „каквото е купил единият — самолети, кораби или влакове — да ги разделя на двамата“):
  // всяко превозно средство, купено докато сте партньори, е 50/50 — партньорът връща половината от цената (щом има пари),
  // а половината от дневната печалба на тези превозни средства отива при него. Старите (отпреди партньорството) остават само на собственика.
  function fleetDay() {
    const S = d.S(), P = st?.partner?.snap; if (!feature('coop-fleet') || !S || !st2 || !P || !d.fleet) return;
    let F = S.coopFleet; if (!F || F.who !== P.name) F = S.coopFleet = { who: P.name, baseMine: null, basePartner: null, mine: {}, paid: {} };   // нов партньор — отначало
    const mine = d.fleet(), pf = Array.isArray(P.fleet) ? P.fleet : null;
    if (!F.baseMine) F.baseMine = Object.fromEntries(mine.map(v => [v.ref, 1]));   // каквото имаш при свързването — само твое
    for (const v of mine) if (!F.baseMine[v.ref] && !F.mine[v.ref]) F.mine[v.ref] = v.cost;
    if (pf && !F.basePartner) F.basePartner = Object.fromEntries(pf.map(v => [v.ref, 1]));
    for (const v of pf && F.basePartner ? pf : []) {   // новите на партньора: плащаш половината
      if (F.basePartner[v.ref] || F.paid[v.ref]) continue;
      const half = Math.round((+v.cost || 0) / 2); if (half <= 0) { F.paid[v.ref] = 1; continue; } if (E().money < half) break;   // нямаш пари — утре пак
      F.paid[v.ref] = half; E().spend(half, 'партньор', `🤝 Половината от ${v.nm || 'превозно средство'} на ${partnerName()} (общ флот)`);
      fleetSend({ fn: 'coop_send', args: { p_req: uid(), p_kind: 'gift', p_data: { amount: half, fleet: 'buy', nm: v.nm || '' } }, refund: { money: half } });
    }
    const tot = mine.reduce((a, v) => a + v.cost, 0), sh = mine.filter(v => F.mine[v.ref]).reduce((a, v) => a + v.cost, 0), net = d.fleetNet ? d.fleetNet() : 0;
    const send = Math.round(net * 0.5 * (tot > 0 ? sh / tot : 0));   // половината от печалбата на общите — по дела им в целия флот
    if (send > 0) { E().spend(send, 'партньор', `🤝 Половината от печалбата на общия флот → ${partnerName()}`); batchAdd('fleet', send); }   // пратката — веднъж на BATCH_DAYS дни (batchFlush)
    d.save();
  }
  let fleetSend = op => queue(op);
  // 📦 пакетиране (T2, 4.0.x — сървърните тавани броят за реални 24 ч, а игралният ден е 24 s): автоматичните дневни преводи — половината от печалбата
  // на общия флот (подарък) и 40% от завършените градове (касата) — се трупат в записа (S.coopBatch) и тръгват като една сума на BATCH_DAYS игрални дни;
  // парите излизат от играта всеки ден (както досега), пратката — веднъж. Прекратяване на партньорството — първо се изпраща натрупаното;
  // ако партньорството вече го няма (партньорът го е прекратил) — натрупаното се връща в играта.
  const BATCH_DAYS = 10; let vaultSend = op => queue(op);
  const batch = () => { const S = d.S(); if (!S) return null; return S.coopBatch || (S.coopBatch = { fleet: 0, fin: 0, at: S.day }); };
  function batchAdd(k, amt) { const B = batch(); if (!B || !(amt > 0)) return; B[k] = (B[k] || 0) + amt; }
  function batchTick() { const B = batch(), S = d.S(); if (B && S && (B.fleet > 0 || B.fin > 0) && S.day - B.at >= BATCH_DAYS) batchFlush(); }
  async function batchFlush(only = null) {
    const B = batch(), S = d.S(); if (!B) return; const f = only === 'fin' ? 0 : Math.round(B.fleet || 0), c = only === 'fleet' ? 0 : Math.round(B.fin || 0);
    const days = Math.max(1, S.day - (B.sentAt ?? B.at));   // за колко игрални дни е сумата
    if (only !== 'fin') B.fleet = 0; if (only !== 'fleet') B.fin = 0; if (!only) { B.at = S.day; B.sentAt = S.day; }
    const ps = [];
    if (f > 0) ps.push(fleetSend({ fn: 'coop_send', args: { p_req: uid(), p_kind: 'gift', p_data: { amount: f, fleet: 'income', days } }, refund: { money: f } }));
    if (c > 0) ps.push(vaultSend({ fn: 'coop_vault2', args: { p_req: uid(), p_amount: c, p_kind: 'order' }, refund: { money: c } }));
    d.save(); await Promise.all(ps.map(p => Promise.resolve(p).catch(() => null)));
  }
  // Лабораторията: N игрални дни с измислени суми (без сървъра) → кои пратки биха тръгнали и какво остава натрупано
  window.__coopBatchTest = (days = 25, fleet = 1000, fin = 500) => { const s0 = st, s20 = st2, sent = [], fs0 = fleetSend, vs0 = vaultSend, S = d.S(); st = { pair: { status: 'active' } }; st2 = st2 || {};
    fleetSend = op => { sent.push({ day: S.day, ...op.args.p_data }); return Promise.resolve({ ok: true }); }; vaultSend = op => { sent.push({ day: S.day, vault: op.args.p_amount }); return Promise.resolve({ ok: true }); };
    try { for (let k = 0; k < days; k++) { S.day++; batchAdd('fleet', fleet); batchAdd('fin', fin); batchTick(); } return { sent, left: { ...S.coopBatch } }; } finally { st = s0; st2 = s20; fleetSend = fs0; vaultSend = vs0; } };
  function batchRefund() {   // партньорството приключи (от другия) — натрупаното се връща
    const B = d.S() && d.S().coopBatch, n = B ? Math.round((B.fleet || 0) + (B.fin || 0)) : 0; if (!n) return;
    B.fleet = 0; B.fin = 0; E().earn(n, 'партньор', '↩️ Натрупаното за партньора се връща (партньорството приключи)'); d.toast(`↩️ ${f(n)} € от общия флот и завършените градове се върнаха при теб — партньорството приключи.`, ''); d.save();
  }
  // тест (без сървъра): фалшив партньор P, пратките — само се записват; връща S.coopFleet и пратките
  window.__coopFleetTest = P => { const s0 = st, s20 = st2, sent = []; st = { pair: { status: 'active' }, partner: { snap: P } }; st2 = st2 || {}; fleetSend = op => { sent.push(op.args.p_data); return Promise.resolve({ ok: true }); };
    try { fleetDay(); batchFlush('fleet'); } finally { st = s0; st2 = s20; fleetSend = op => queue(op); } return { F: d.S().coopFleet, sent }; };
  // 🏦 холдингът всеки игрален ден: спасяване от фалит (10-ия ден на минус) и дивидент в края на месеца
  function holdDay() {
    const S = d.S(), b = S?.bust; if (!S || !st2) return;
    if (b && b.red === 0) delete b.coopBail;
    if (b && b.red >= 10 && E().money < 0 && !b.coopBail) {
      b.coopBail = true; const debt = Math.ceil(-E().money);
      rpc('coop_vault2', { p_req: uid(), p_amount: -debt, p_kind: 'bailout' }, 2).then(r => {
        if (r?.ok) d.toast(`🏦 Холдингът покрива дълга ти: ${f(-r.amount)} € — идват след миг. ${partnerName()} е уведомен.`, 'good');
        else { b.coopBail = false; if (r?.err === 'no_money') d.toast('🏦 Холдингът е празен — не може да покрие дълга. Помоли партньора (🆘).', 'bad'); }
      }).catch(() => { b.coopBail = false; });
    }
    if (S.day % 30 === 0) rpc('coop_dividend', {}, 1).then(r => {
      if (r?.ok && r.paid > 0) d.toast(`🏦 Месечен дивидент: холдингът раздаде ${f(r.paid)} € (30% от печалбата) — по ${f(r.each)} € на двамата${r.investors ? `, ${f(r.investors)} € на акционерите` : ''}.`, 'good');
      // dividend-once: прозорецът излиза само веднъж — когато дялът пристигне (vault „Дивидент“ по-горе); тук остава само съобщението
    }).catch(() => {});
  }
  // 🏁 завършените градове (economy.js payFinished): 40% от дневния им приход → общия холдинг
  window.__coopFinished = amount => {
    if (!st2 || !(amount > 0)) return;
    const share = Math.round(amount * ORDER_SHARE);
    if (share <= 0) return;
    E().spend(share, 'партньор', `🏦 40% от завършените градове → холдинга`);
    batchAdd('fin', share);   // вноската — веднъж на BATCH_DAYS дни (batchFlush)
  };
  // 💼 поръчка, платена в моята игра → 40% от печалбата отиват в общия холдинг (вика го game.js при прибирането на парите)
  window.__coopOrder = (amount, title) => {
    if (!st2 || !(amount > 0)) return;
    const share = Math.round(amount * PROFIT_OF * ORDER_SHARE);
    if (share <= 0) return;
    E().spend(share, 'партньор', `🏦 40% от печалбата → холдинга: ${title}`);
    queue({ fn: 'coop_vault2', args: { p_req: uid(), p_amount: share, p_kind: 'order' }, refund: { money: share } })
      .then(r => { if (r?.ok) d.toast(`🏦 ${f(share)} € (40% от печалбата) → общия холдинг`, ''); });
  };

  // ── партньорът на картата: пръстен в неговия цвят около градовете му, звезда и име при централата ──
  window.__coopMap = (proj, k, cityById) => {
    const P = st?.partner?.snap; if (!P || !P.cities) return '';
    let h = '<g class="coop-map" style="pointer-events:none">';
    const segs = d.segs();
    for (const j of st2?.joints || []) {   // общите участъци/линии: лилава линия (пунктир, докато не са готови)
      const [ia, ib] = j.kind === 'hw' ? (() => { const s = segs.find(q => q.id === j.ref); return s ? [s.a, s.b] : []; })() : j.ref.split('|');
      const ca = ia && cityById(ia), cb = ib && cityById(ib); if (!ca || !cb) continue;
      const [x1, y1] = proj(ca.lon, ca.lat), [x2, y2] = proj(cb.lon, cb.lat);
      h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${JCOL}" stroke-width="${(j.done ? 3 : 2.2) * k}" stroke-dasharray="${j.done ? '' : `${5 * k} ${4 * k}`}" stroke-linecap="round" opacity="${j.status === 'active' ? 0.9 : 0.5}"/>`;
    }
    for (const id of P.cities) {
      const c = cityById(id); if (!c) continue;
      const [x, y] = proj(c.lon, c.lat), r = 6 * k, hq = id === P.hq;
      h += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${PCOL}" stroke-width="${2.6 * k}" stroke-dasharray="${hq ? '' : `${3 * k} ${2 * k}`}" opacity=".95"/>`;
      if (hq) h += `<text x="${x}" y="${feature('map-clean') ? y + r + 13 * k : y - r - 4 * k}" text-anchor="middle" font-size="${11 * k}" font-weight="800" fill="${PCOL}" stroke="#0008" stroke-width="${2.4 * k}" paint-order="stroke">🤝 ${esc(P.name)}${st.partner.online ? ' 🟢' : ''}</text>`;
    }
    return h + '</g>';
  };

  // ── бутон в горната лента ──
  function mount() {
    if (AUTOTEST) return;
    const top = document.getElementById('top'); if (!top) return;
    let b = document.getElementById('coopBtn');
    if (!b) {
      b = document.createElement('button'); b.id = 'coopBtn'; b.className = 'btn2'; b.onclick = () => { open = true; render(); tick(); };
      top.insertBefore(b, document.getElementById('onlineBtn') || document.getElementById('cloudBtn') || top.querySelector('.sp'));
    }
    const P = st?.partner, n = (st?.inbox?.length || 0) + unread();
    b.innerHTML = P ? `🤝 <span style="color:${PCOL}">${esc(P.snap?.name || 'Партньор')}</span>${P.online ? ' 🟢' : ''}${n ? ` <b style="color:var(--acc)">+${n}</b>` : ''}` : '🤝 Партньор';
    b.title = P ? `Партньор: ${P.snap?.name || '—'} (${P.online ? 'онлайн сега' : P.at ? 'последно ' + ago(P.at) : 'още не е влизал'})` : 'Свържи се с приятел и си помагайте';
  }

  // ── панелът ──
  function box() {
    let el = document.getElementById('coopBox');
    if (!el) {
      el = document.createElement('div'); el.id = 'coopBox';
      el.innerHTML = `<style>
        #coopBox { position:fixed; inset:0; z-index:60; background:#0008; display:flex; align-items:flex-start; justify-content:center; padding:62px 12px 12px; }
        #coopBox .in { width:min(560px, 100%); max-height:calc(100vh - 80px); overflow:auto; background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:14px 16px; color:var(--txt); backdrop-filter:blur(6px); }
        #coopBox h2 { font-size:19px; margin:0 0 6px; color:${PCOL}; } #coopBox h3 { font-size:15px; margin:14px 0 6px; }
        #coopBox .mut { color:var(--mut); font-size:13px; line-height:1.5; } #coopBox .row { display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin:6px 0; }
        #coopBox input, #coopBox select { background:#0006; color:var(--txt); border:1px solid var(--line); border-radius:8px; padding:7px 9px; font:inherit; font-size:14px; }
        #coopBox input { width:130px; } #coopBox .btn { background:var(--acc); color:#1a1200; border:0; border-radius:9px; padding:7px 12px; font-weight:800; cursor:pointer; }
        #coopBox .btn2 { cursor:pointer; color:var(--txt); } #coopBox .card { border:1px solid var(--line); border-radius:11px; padding:10px 12px; margin:8px 0; background:#ffffff08; }
        #coopBox .led { display:flex; justify-content:space-between; gap:8px; font-size:13px; padding:4px 0; border-bottom:1px solid #ffffff0d; align-items:center; flex-wrap:wrap; }
        #coopBox .bar { height:8px; background:#ffffff14; border-radius:5px; overflow:hidden; display:flex; } #coopBox .bar i { display:block; height:100%; }
        #coopBox .x { float:right; background:none; border:0; color:var(--mut); font-size:22px; cursor:pointer; line-height:1; }
        #coopBox .ok { color:var(--ok); } #coopBox .bad { color:var(--bad); }
      </style><div class="in"></div>`;
      el.onclick = e => { if (e.target === el) { open = false; el.remove(); } };
      document.body.appendChild(el);
    }
    return el.querySelector('.in');
  }

  function render() {
    if (!open) return;
    const el = box(), S = d.S();
    let h = `<button class="x" data-c="close">×</button><h2>🤝 Партньор</h2>`;
    if (!cloud.user || !cloud.user() || cloud.user().is_anonymous) {
      if (cloud.user && cloud.user()?.is_anonymous) h += `<p class="mut">👤 Играеш като гост — за партньорство е нужен акаунт (⚙️ Настройки → 🆕 Създай акаунт; записите ти остават).</p><div class="row"><button class="btn" data-c="login">🆕 Създай акаунт</button></div>`;
      else h += `<p class="mut">Партньорството минава през облака. Влез с имейла си от бутона ☁️ горе (същият вход като за записите в облака), после се върни тук.</p><div class="row"><button class="btn" data-c="login">☁️ Вход</button></div>`;
      el.innerHTML = h; bind(el); return;
    }
    if (!S || !d.ready()) { h += '<p class="mut">Първо основи фирмата си и влез в града.</p>'; el.innerHTML = h; bind(el); return; }
    if (!st) { h += '<p class="mut">Зареждам…</p>'; el.innerHTML = h; bind(el); return; }
    if (feature('coop-center') && st.pair?.status === 'active') { centerRender(el, centerCtx()); bind(el); return; }
    el.classList.remove('cc');
    const P = st.partner;
    if (!st.pair) {
      h += `<p class="mut">Всеки играе своята игра — своята карта и своето темпо. Партньорите си помагат: пари (подарък или заем), техника, материали и общи големи поръчки. Градовете на партньора се виждат на картата ти в <b style="color:${PCOL}">синьо</b>.</p>
        <div class="card"><b>Имаш код от приятел?</b><div class="row"><input id="cpCode" maxlength="6" placeholder="КОД" style="text-transform:uppercase;width:110px"><button class="btn" data-c="join">Свържи се</button></div></div>
        <div class="card"><b>Или създай код и го дай на приятеля си</b><div class="row"><button class="btn2" data-c="create">🔑 Създай код</button></div></div>`;
    } else if (st.pair.status === 'waiting') {
      h += `<div class="card"><div class="mut">Дай този код на приятеля си. Той натиска „🤝 Партньор“ в своята игра и го въвежда.</div>
        <div style="font-size:34px;font-weight:900;letter-spacing:.2em;color:${PCOL};margin:8px 0">${esc(st.pair.code)}</div><div class="mut">Чакам партньора…</div></div>
        <div class="row"><button class="btn2" data-c="leave">Откажи кода</button></div>`;
    } else {
      const s = P?.snap;
      h += `<div class="card" style="border-color:${PCOL}">`;
      h += s ? `<div style="font-size:16px;font-weight:800"><span style="color:${PCOL}">${esc(s.ico)} ${esc(s.name)}</span> ${P.online ? '<span class="ok" style="font-size:13px">🟢 онлайн</span>' : `<span class="mut">⚪ ${P.at ? ago(P.at) : ''}</span>`}</div>
        <div class="mut">Ден ${s.day} · ${'★'.repeat(Math.round(s.rep))}${'☆'.repeat(5 - Math.round(s.rep))} · офис ниво ${s.office} · пари ${f(s.money)} € · стойност ${f(s.worth)} €${s.loan ? ` · кредит ${f(s.loan)} €` : ''}<br>
        Градове (${s.cities.length}): ${s.cities.slice(0, 12).map(id => esc(d.cityName(id)) + (id === s.hq ? ' ★' : '')).join(', ')}${s.cities.length > 12 ? '…' : ''} — <span style="color:${PCOL}">в този цвят на картата ти</span>${(() => { const both = s.cities.filter(id => d.ownedCities().includes(id)); return both.length ? `<br>🏙️ Строите заедно в: <b>${both.map(id => esc(d.cityName(id))).join(', ')}</b> — в 3D града неговите обекти са с пръстен в неговия цвят.` : ''; })()}</div>`
        : '<div class="mut">Партньорът още не е отворил играта след свързването.</div>';
      h += `</div><div class="row"><span class="mut">Името ти за партньора:</span><input id="cpName" value="${esc(myName())}" maxlength="24"><button class="btn2" data-c="name">Запази</button></div>`;
      const nU = unread();
      h += `<div class="row" style="margin:10px 0 4px">${[['help', '💶 Помощ'], ['build', '🛣️ Строим заедно'], ['quest', '🏆 Задачи'], ['hold', '🏦 Холдинг'], ['chat', `💬 Чат${nU ? ` <b style="color:var(--acc)">${nU}</b>` : ''}`]]
        .map(([k, nm]) => `<button class="${tab === k ? 'btn' : 'btn2'}" data-c="tab:${k}">${nm}</button>`).join('')}</div>`;
      if (tab === 'help') {
      // пари
        h += `<h3>💶 Пари <span class="mut">(имаш ${f(E().money)} €)</span></h3><div class="row"><input id="cpAmt" inputmode="numeric" placeholder="сума в €"><button class="btn" data-c="gift">🎁 Подари</button></div>
          <div class="row"><select id="cpH">${[6, 12, 24, 48, 72, 168].map(x => `<option value="${x}"${x === 24 ? ' selected' : ''}>връщане до ${x < 48 ? x + ' ч' : x / 24 + ' дни'}</option>`).join('')}</select>
          <select id="cpR">${[0, 2, 5, 10].map(x => `<option value="${x}"${x === 0 ? ' selected' : ''}>лихва ${x}%</option>`).join('')}</select><button class="btn2" data-c="loan">💸 Предложи заем</button></div>
          <div class="mut">Заемът тръгва, когато партньорът го приеме (дотогава парите се пазят — при отказ се връщат). Срокът е в реално време; ако не го върне навреме, неговата игра сама връща, колкото има.</div>`;
        // заеми
        const L = st.loans.filter(l => ['offered', 'open'].includes(l.status) || l.status === 'repaid');
        if (L.length) h += `<div class="card">${L.map(l => { const who = l.out ? `→ ${esc(partnerName())}` : `← ${esc(partnerName())}`, rest = l.owed - l.repaid;
          let b = '';
          if (l.status === 'offered') b = l.out ? `<button class="btn2" data-c="lact:${l.id}:cancel">Оттегли</button>` : `<button class="btn" data-c="lact:${l.id}:accept">✅ Приеми</button><button class="btn2" data-c="lact:${l.id}:decline">Откажи</button>`;
          if (l.status === 'open') b = l.out ? `<button class="btn2" data-c="lact:${l.id}:forgive">Опрости</button>` : `<button class="btn" data-c="repay:${l.id}:${rest}">Върни ${f(rest)} €</button>`;
          return `<div class="led"><span>💸 Заем ${who} · ${f(l.amount)} € · ${l.rate_pct}% · ${l.status === 'offered' ? '⏳ чака отговор' : l.status === 'open' ? `остават <b>${f(rest)} €</b> · срок ${left(l.due_at)}` : '✅ изплатен'}</span><span class="row" style="margin:0">${b}</span></div>`; }).join('')}</div>`;
        // техника
        const here = d.unitsHere(), cnt = {}; here.forEach(t => cnt[t] = (cnt[t] || 0) + 1);
        h += `<h3>🚜 Техника <span class="mut">(свободна в ${esc(d.cityName(S.cityId))})</span></h3>` + (Object.keys(cnt).length ? `<div class="card">${Object.entries(cnt).map(([t, n]) => `<div class="led"><span>${UNIT_TYPES[t]?.ico} ${UNIT_TYPES[t]?.nm} ×${n}</span><button class="btn2" data-c="unit:${t}">Изпрати 1</button></div>`).join('')}</div>` : '<div class="mut">Няма свободна техника в този град (заетата на обект не може да се праща).</div>');
        // материали
        const stock = Object.entries(E().s.stock || {}).filter(([k, q]) => q > 0 && MATERIALS[k]);
        h += `<h3>📦 Материали</h3>` + (stock.length ? `<div class="card">${stock.map(([k, q]) => `<div class="led"><span>${MATERIALS[k].ico} ${MATERIALS[k].nm} · ${Math.round(q * 100) / 100} ${MATERIALS[k].unit}</span><span class="row" style="margin:0"><input data-mq="${k}" inputmode="decimal" value="${Math.round(q * 100) / 100}" style="width:80px"><button class="btn2" data-c="mat:${k}">Изпрати</button></span></div>`).join('')}</div>` : '<div class="mut">Складът е празен.</div>');
      // история
        const KN = { gift: '🎁 подарък', loan: '💸 заем', repay: '💸 връщане', refund: '↩️ върнато', unit: '🚜 техника', mat: '📦 материали', mega: '🏗️ поръчка' };
        if (st.history.length) h += `<h3>📜 История</h3><div class="card">${st.history.map(x => { const D = cleanD(x.data);
          const what = x.kind === 'unit' ? `${UNIT_TYPES[D.type]?.ico || ''} ${UNIT_TYPES[D.type]?.nm || ''}` : x.kind === 'mat' ? `${MATERIALS[D.mat]?.ico || ''} ${D.qty} ${MATERIALS[D.mat]?.unit || ''} ${MATERIALS[D.mat]?.nm || ''}` : `${f(D.amount || 0)} €`;
          return `<div class="led"><span>${x.out ? '→' : '←'} ${KN[x.kind] || esc(x.kind)} · ${what}</span><span class="mut">${ago(x.at)}${x.status === 'sent' ? ' · ⏳' : ''}</span></div>`; }).join('')}</div>`;
      } else if (tab === 'build') h += buildHtml();
      else if (tab === 'quest') h += questHtml();
      else if (tab === 'hold') h += holdHtml();
      else if (tab === 'chat') { h += chatHtml(); const mx = Math.max(0, ...(st2?.messages || []).map(m => m.id)); if (mx) LS('stroi-coop-read', mx); }
      h += `<div class="row" style="margin-top:12px"><button class="btn2" data-c="leave">Прекрати партньорството</button></div>`;
    }
    el.innerHTML = h; bind(el);
  }

  // ── раздел „Строим заедно“: общи участъци/линии, наем, изненада, общи поръчки ──
  function buildHtml() {
    const S = d.S(), P = st.partner?.snap || {}, pn = esc(partnerName());
    let h = `<div class="mut">Изберете участък от магистрала или жп линия и го строите <b>заедно</b> — картата ви е обща. Докато и двамата работите по участъка, всеки строи <b>30% по-бързо</b>; щом единият го завърши, готов е и при другия. Тогава всеки получава еднократен бонус (магистрала 1 500 €/км, влак 800 €/км) и всеки ден допълнителен доход (3 €/км и 8 €/км). На картата е с лилава линия.</div>`;
    const J = st2?.joints || [];
    if (J.length) h += `<div class="card">${J.map(j => { const ico = j.kind === 'hw' ? '🛣️' : '🚆';
      let b = '';
      if (j.status === 'proposed') b = j.mine ? `<button class="btn2" data-c="jact:${j.id}:end">Оттегли</button>` : `<button class="btn" data-c="jact:${j.id}:accept">✅ Приеми</button><button class="btn2" data-c="jact:${j.id}:decline">Откажи</button>`;
      else b = `<button class="btn2" data-c="jact:${j.id}:end">Прекрати</button>`;
      const st_ = j.status === 'proposed' ? (j.mine ? '⏳ чака партньора' : `📨 ${pn} предлага`) : j.done ? '<b class="ok">✅ готово — общо за двамата</b>' : `ти: ${j.me_done ? '✅' : '🏗️'} · ${pn}: ${j.they_done ? '✅' : '🏗️'}`;
      return `<div class="led"><span>${ico} <b>${esc(j.title)}</b> · ${j.km} км<br><span class="mut">${st_}</span></span><span class="row" style="margin:0">${b}</span></div>`; }).join('')}</div>`;
    const done = d.hwInfo().done, segs = d.segs().filter(s => !J.some(j => j.kind === 'hw' && j.ref === s.id));
    h += `<div class="row"><select id="cpSeg" style="max-width:100%">${segs.map(s => `<option value="${s.id}">${esc(s.nm)}: ${esc(d.cityName(s.a))} — ${esc(d.cityName(s.b))} · ${s.km} км${done.includes(s.id) ? ' ✅' : ''}${(P.hwDone || []).includes(s.id) ? ' (той ✅)' : ''}</option>`).join('')}</select><button class="btn2" data-c="jhw">🛣️ Предложи обща магистрала</button></div>`;
    const myR = d.rails(), rail = new Map(myR.map(r => [r.ref, r.km]));
    for (const [ref, km] of Object.entries(P.railKm || {})) if (!rail.has(ref)) rail.set(ref, km);
    const rOpts = [...rail].filter(([ref]) => !J.some(j => j.kind === 'rail' && j.ref === ref));
    h += rOpts.length ? `<div class="row"><select id="cpRail">${rOpts.map(([ref, km]) => { const [a, b] = ref.split('|'); return `<option value="${ref}|${km}">${esc(d.cityName(a))} — ${esc(d.cityName(b))} · ${km} км${myR.some(r => r.ref === ref) ? ' (твоя ✅)' : ''}${(P.rails || []).includes(ref) ? ' (негова ✅)' : ''}</option>`; }).join('')}</select><button class="btn2" data-c="jrail">🚆 Предложи общ влак</button></div>`
      : '<div class="mut">🚆 Общ влак: когато някой от вас построи жп линия, тя ще се появи тук.</div>';
    // наем на техника
    const cnt = {}; d.unitsHere().forEach(x => cnt[x] = (cnt[x] || 0) + 1);
    h += `<h3>🏢 Наем на техника</h3><div class="mut">Даваш машина или бригада под наем за определено време (реално) — партньорът плаща наема наведнъж и после тя се връща сама. Цена 0 = <b>помощна бригада/машина</b>.</div>`;
    h += Object.keys(cnt).length ? `<div class="row"><select id="cpRT">${Object.entries(cnt).map(([x, n]) => `<option value="${x}">${UNIT_TYPES[x]?.ico} ${UNIT_TYPES[x]?.nm} (свободни ${n})</option>`).join('')}</select>
      <select id="cpRH">${[2, 6, 12, 24, 48, 72].map(x => `<option value="${x}"${x === 12 ? ' selected' : ''}>за ${x} ч</option>`).join('')}</select><input id="cpRP" inputmode="numeric" placeholder="наем € (0 = помощ)" style="width:150px"><button class="btn2" data-c="rent">📤 Предложи</button></div>` : '<div class="mut">Няма свободна техника в този град.</div>';
    const R = (st2?.rentals || []).filter(r => r.status !== 'declined');
    if (R.length) h += `<div class="card">${R.map(r => { const u = UNIT_TYPES[r.type] || {}; let b = '';
      if (r.status === 'offered') b = r.out ? `<button class="btn2" data-c="ract:${r.id}:cancel">Оттегли</button>` : `<button class="btn" data-c="rpay:${r.id}:${r.price}">✅ Наеми${r.price ? ` за ${f(r.price)} €` : ' (безплатно)'}</button><button class="btn2" data-c="ract:${r.id}:decline">Откажи</button>`;
      if (r.status === 'active' && !r.out) b = `<button class="btn2" data-c="rback:${r.id}:${r.type}">Върни сега</button>`;
      const s_ = r.status === 'offered' ? (r.out ? '⏳ чака отговор' : `📨 ${pn} предлага`) : r.status === 'active' ? `при ${r.out ? pn : 'теб'} още ${left(r.until)}` : '✅ върната';
      return `<div class="led"><span>${u.ico || ''} ${u.nm || ''} ${r.out ? '→' : '←'} · ${r.hours} ч · ${r.price ? f(r.price) + ' €' : 'помощ'}<br><span class="mut">${s_}</span></span><span class="row" style="margin:0">${b}</span></div>`; }).join('')}</div>`;
    // изненада в общ град
    const shared = (P.cities || []).includes(S.cityId);
    h += `<h3>🎁 Изненада в общ град</h3>` + (shared ? `<div class="mut">Остави табела (и подарък, ако искаш) на парцел в ${esc(d.cityName(S.cityId))} — ${pn} ще види кутия-подарък, когато влезе в града, и ще я отвори.</div>
      <div class="row"><input id="cpST" maxlength="60" placeholder="Текст на табелата" style="width:200px"><input id="cpSA" inputmode="numeric" placeholder="подарък € (по желание)" style="width:150px"><button class="btn2" data-c="surp">🎁 Остави тук</button></div>`
      : `<div class="mut">Отиди в град, в който и ${pn} има фирма${(P.cities || []).length ? ` (${(P.cities || []).slice(0, 5).map(id => esc(d.cityName(id))).join(', ')})` : ''}, за да оставиш изненада.</div>`);
    const SM = st2?.surprises_mine || [];
    if (SM.length) h += `<div class="card">${SM.map(s => `<div class="led"><span>🎁 ${esc(d.cityName(s.city))} · „${esc(s.text)}“${s.amount ? ` · ${f(s.amount)} €` : ''}</span><span class="mut">${s.status === 'found' ? '✅ намерена' : '⏳ чака'}</span></div>`).join('')}</div>`;
    return h + megaHtml();
  }
  function questHtml() {
    const Q = st2?.quests || [];
    let h = `<div class="mut">Общи задачи — напредъкът е сборът от двете игри. Всеки от вас взема наградата. Изпълните ли една, идва нова (и по-трудна).</div>`;
    h += Q.map(q => { const pc = Math.min(100, Math.round(q.progress / q.target * 100));
      return `<div class="card"><div style="font-weight:800">🏆 ${esc(q.nm)}</div><div class="bar" style="margin:6px 0"><i style="width:${pc}%;background:${q.status === 'done' ? 'var(--ok)' : PCOL}"></i></div>
        <div class="led" style="border:0"><span class="mut">${q.key === 'money' ? f(q.progress) + ' / ' + f(q.target) + ' €' : q.progress + ' / ' + q.target} · награда <b>${f(q.reward)} €</b> за всеки</span>${q.status === 'done' && !q.claimed ? `<button class="btn" data-c="qclaim:${q.id}">🏆 Вземи</button>` : q.claimed ? '<span class="ok">✅ взета</span>' : ''}</div></div>`; }).join('') || '<div class="mut">Зареждам задачите…</div>';
    return h;
  }
  function holdHtml() {
    const V = st2?.vault || { balance: 0, log: [] }, T = st2?.tandems || [];
    let h = `<div class="card" style="border-color:${PCOL}"><div style="font-weight:800;font-size:16px">🏦 ${esc(V.name || 'Вашият холдинг')}</div>
      <div class="mut">Обща касичка — внасяте и двамата, тегли всеки при нужда. Стойността ѝ се брои в класацията на тандемите.</div>
      <div style="font-size:24px;font-weight:900;color:var(--acc);margin:6px 0">${f(V.balance)} €</div>
      <div class="row"><input id="cpV" inputmode="numeric" placeholder="сума в €"><button class="btn" data-c="vput">⬆️ Внеси</button><button class="btn2" data-c="vtake">⬇️ Изтегли</button></div>
      <div class="row"><input id="cpVN" maxlength="40" placeholder="Име на холдинга" value="${esc(V.name || '')}" style="width:200px"><button class="btn2" data-c="vname">Запази името</button></div>
      ${holdInfo()}
      ${(st3?.log || V.log || []).map(l => `<div class="led"><span>${logTxt(l)}</span><span class="${l.amount > 0 ? 'ok' : 'bad'}">${l.amount > 0 ? '+' : ''}${f(l.amount)} € · ${ago(l.at)}</span></div>`).join('')}</div>`;
    h += `<h3>🏆 Най-силен тандем</h3><div class="mut">Стойността на двете фирми + касичката.</div><div class="card">${T.map((x, i) => `<div class="led" style="${x.me ? `color:${PCOL};font-weight:800` : ''}"><span>${['🥇', '🥈', '🥉'][i] || (i + 1) + '.'} ${esc(x.name)}${x.me ? ' (вие)' : ''}</span><b>${f(x.worth)} €</b></div>`).join('') || '<div class="mut">Още няма тандеми.</div>'}</div>`;
    return h;
  }
  const KIND_TXT = { order: '40% от поръчка', ipo: 'от акциите на борсата', dividend: 'дивидент (30%)', bailout: 'покри дълг' };
  const logTxt = l => { const who = l.kind === 'ipo' ? '📈 Инвеститори' : l.me ? 'Ти' : esc(partnerName());
    return l.kind === 'dividend' ? '🏦 Дивидент за двамата' : l.kind === 'bailout' ? `🛟 Холдингът спаси ${l.me ? 'теб' : esc(partnerName())}` : `${who} · ${l.kind && KIND_TXT[l.kind] ? KIND_TXT[l.kind] : l.amount > 0 ? 'внесе' : 'изтегли'}`; };
  function holdInfo() {
    if (!st3) return '';
    const I = st3.ipo, pp = st3.public_pct || 0;
    let h = `<div class="mut" style="margin:4px 0">💼 От всяка поръчка на двама ви 40% от печалбата идват тук · 🛟 на 10-ия ден на минус холдингът покрива дълга · 📅 в края на всеки игрален месец раздава 30% от печалбата (сега за месеца: <b>${f(st3.month_profit)} €</b>)${pp ? ` · 📈 ${pp}% от холдинга е на борсата` : ''}.</div>`;
    if (!d.stocksOpen?.()) return h + '<div class="mut">📈 Акции на борсата — щом отключиш борсата (ниво 7).</div>';
    if (I && I.status === 'proposed') h += `<div class="card">📈 ${I.mine ? 'Предложи' : `${esc(partnerName())} предлага`} холдингът да пусне <b>${I.pct}%</b> акции за <b>${I.hours / 24} д.</b>
      <div class="row">${I.mine ? '<button class="btn2" data-c="ipo:cancel">Оттегли</button>' : '<button class="btn" data-c="ipo:accept">✅ Одобри</button><button class="btn2" data-c="ipo:decline">Откажи</button>'}</div></div>`;
    else if (I && I.status === 'active') h += `<div class="card">📈 Акциите се продават: <b>${I.pct}%</b> · събрани ${f(I.raised)} от ~${f(I.target)} € · остават ${left(I.ends_at)}<div class="bar" style="margin-top:6px"><i style="width:${Math.min(100, I.raised / Math.max(1, I.target) * 100)}%;background:var(--acc)"></i></div></div>`;
    else if (pp < 49) h += `<div class="card">📈 <b>Пусни акции на борсата</b> — инвеститорите плащат постепенно през срока дял × касичката × 1.5. Партньорът трябва да одобри. Акционерите после получават своя дял от дивидента.
      <div class="row"><select id="cpIP">${[5, 10, 20, 30].filter(x => pp + x <= 49).map(x => `<option value="${x}">${x}%</option>`).join('')}</select><select id="cpIH"><option value="24">за 1 ден</option><option value="72">за 3 дни</option><option value="168">за 7 дни</option></select><button class="btn" data-c="ipo:propose">📈 Предложи</button></div></div>`;
    return h;
  }
  const QUICK = ['Трябва ми кран! 🏗️', 'Може ли малко пари? 💶', 'Да строим заедно? 🛣️', 'Благодаря! 💖'];
  // контекстът за coopcenter.js: данните, форматирането и същите действия (act/bind остават тук)
  const centerCtx = () => ({ st, st2, st3, st4, v2: feature('coop-center2'), d, E, f, esc, ago, left, PCOL, JCOL, partnerName, myName, unread, UNIT_TYPES, MATERIALS, logTxt, holdInfo, QUICK, fetchedAt, partnerLv: partnerLv(),
    fleet: feature('coop-fleet') && d.fleet ? { mine: d.fleet(), partner: st?.partner?.snap?.fleet || [], F: d.S()?.coopFleet || null } : null,
    markRead: () => { const mx = Math.max(0, ...(st2?.messages || []).map(m => m.id)); if (mx) LS('stroi-coop-read', mx); }, act: (c, a, x, el) => act(c, a, x, el), render, tick });
  function chatHtml() {
    const M = st2?.messages || [];
    let h = `<div class="card" id="cpChat" style="max-height:300px;overflow:auto">${M.map(m => `<div style="display:flex;justify-content:${m.me ? 'flex-end' : 'flex-start'};margin:4px 0"><div style="max-width:80%;padding:7px 11px;border-radius:12px;background:${m.sos ? '#ff6b6b33' : m.me ? '#ffb30022' : PCOL + '22'};border:1px solid ${m.sos ? 'var(--bad)' : 'var(--line)'}">${m.sos ? '🆘 ' : ''}${esc(m.text)}<div class="mut" style="font-size:11px">${m.me ? 'ти' : esc(partnerName())} · ${ago(m.at)}</div></div></div>`).join('') || '<div class="mut">Още няма съобщения. Кажи здрасти! 👋</div>'}</div>`;
    h += `<div class="row"><input id="cpMsg" maxlength="300" placeholder="Съобщение…" style="flex:1;min-width:160px"><button class="btn" data-c="say">Изпрати</button></div>
      <div class="row">${QUICK.map((q, i) => `<button class="btn2" data-c="quick:${i}" style="font-size:12px">${q}</button>`).join('')}</div>
      <div class="row"><button class="btn2" data-c="sos" style="border-color:var(--bad);color:#ffb3b3">🆘 Трябва ми помощ</button><span class="mut">— праща сигнал с парите ти (${f(E().money)} €)</span></div>`;
    return h;
  }
  function megaHtml() {
    let h = '';
      h += `<h3>🏗️ Общи големи поръчки</h3><div class="mut">Започва единият, влагат и двамата. Щом се събере сумата, строежът трае определено време (реално), после всеки получава вложеното + половината от печалбата (сумата × множителя − сумата). Бонусът важи, ако и двамата са вложили поне 20%.</div>`;
      const busyKeys = new Set(st.megas.filter(m => m.status !== 'done').map(m => m.key));
      for (const m of st.megas) {
        const t = st.mega_types.find(x => x.key === m.key); if (!t) continue;
        const pm = Math.round(m.mine / t.cost * 100), pt = Math.round(m.theirs / t.cost * 100);
        h += `<div class="card"><div style="font-weight:800">${t.ico} ${esc(t.nm)} <span class="mut">· ×${t.mult}</span></div>
          <div class="bar" style="margin:6px 0"><i style="width:${pm}%;background:var(--acc)"></i><i style="width:${pt}%;background:${PCOL}"></i></div>
          <div class="mut">Ти: ${f(m.mine)} € (${pm}%) · ${esc(partnerName())}: ${f(m.theirs)} € (${pt}%) · събрани ${f(m.total)} от ${f(t.cost)} €</div>
          ${m.status === 'forming' ? `<div class="row"><input data-mp="${m.id}" inputmode="numeric" placeholder="сума в €"><button class="btn" data-c="put:${m.id}">Вложи</button></div>`
            : m.status === 'building' ? `<div class="mut" style="margin-top:4px">🏗️ Строи се — готово след <b>${left(m.ends_at)}</b>. Награда за теб: ~${f(m.mine >= t.cost * 0.2 && m.theirs >= t.cost * 0.2 ? m.mine + Math.floor(m.total * (t.mult - 1) / 2) : m.mine)} €</div>`
            : `<div class="row"><button class="btn" data-c="claim:${m.id}">🏆 Вземи наградата</button></div>`}</div>`;
      }
      for (const m of (st3?.megas_done || []).filter(m => m.claimed)) h += `<div class="card" style="border-color:var(--ok)"><div style="font-weight:800">✅ Изпълнена поръчка: ${m.ico} ${esc(m.nm)}</div>
        <div class="mut">Обща сума ${f(m.total)} € · ти получи <b class="ok">${f(m.mine)} €</b> · ${esc(partnerName())} — <b>${f(m.theirs)} €</b> (вложеното + по равно от печалбата)</div></div>`;
      h += `<div class="card">${st.mega_types.map(t => `<div class="led"><span>${t.ico} <b>${esc(t.nm)}</b> · ${f(t.cost)} € · ${t.minutes < 60 ? t.minutes + ' мин' : t.minutes / 60 + ' ч'} · ×${t.mult}<br><span class="mut">${esc(t.descr)}</span></span>${busyKeys.has(t.key) ? '<span class="mut">в ход</span>' : `<button class="btn2" data-c="mega:${t.key}">Започни</button>`}</div>`).join('')}</div>`;
    return h;
  }
  const num = v => +String(v || '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '');
  function bind(el) {
    el.querySelectorAll('[data-c]').forEach(b => b.onclick = async () => {
      if (busy) return;
      const [c, a, x] = b.dataset.c.split(':');
      if (c === 'close') { open = false; document.getElementById('coopBox')?.remove(); return; }
      if (c === 'login') { open = false; document.getElementById('coopBox')?.remove(); document.getElementById('cloudBtn')?.click(); return; }
      busy = true; b.disabled = true;
      try { await act(c, a, x, el); } catch (e) { d.toast('📶 ' + (e?.message || 'Грешка при връзката.'), 'bad'); }
      busy = false; await tick();
    });
  }

  async function act(c, a, x, el) {
    const amtIn = () => Math.round(num(el.querySelector('#cpAmt')?.value));
    const money = n => { if (!(n > 0)) { d.toast('Въведи сума.', 'bad'); return false; } if (E().money < n) { d.toast(`Нямаш ${f(n)} €.`, 'bad'); return false; } return true; };
    const say = r => { if (r && r.ok === false) d.toast(r.msg, 'bad'); return r && r.ok !== false; };
    if (c === 'create') return say(await rpc('coop_create'));
    if (c === 'tab') { tab = a; render(); setTimeout(() => { const ch = document.getElementById('cpChat'); if (ch) ch.scrollTop = 1e6; }, 0); return; }
    if (c === 'jhw') { const id = el.querySelector('#cpSeg').value, s = d.segs().find(q => q.id === id); if (!s) return;
      if (say(await rpc('coop_joint', { p_kind: 'hw', p_ref: id, p_title: `АМ „${s.nm}“: ${d.cityName(s.a)} — ${d.cityName(s.b)}`, p_km: s.km }))) d.toast('🛣️ Предложението е изпратено — партньорът трябва да го приеме.', 'good'); return; }
    if (c === 'jrail') { const v = el.querySelector('#cpRail').value.split('|'), ref = v[0] + '|' + v[1];
      if (say(await rpc('coop_joint', { p_kind: 'rail', p_ref: ref, p_title: `Влак ${d.cityName(v[0])} — ${d.cityName(v[1])}`, p_km: +v[2] || 100 }))) d.toast('🚆 Предложението е изпратено.', 'good'); return; }
    if (c === 'jact') { if (say(await rpc('coop_joint_act', { p_id: +a, p_action: x }))) d.toast({ accept: '🤝 Строите заедно! Започни участъка от „🛣️ Магистрали“ (или линията от „ЖП“).', decline: 'Отказано.', end: 'Общият обект е прекратен.' }[x], 'good'); return; }
    if (c === 'rent') { const ty = el.querySelector('#cpRT').value, hrs = +el.querySelector('#cpRH').value, pr = Math.round(num(el.querySelector('#cpRP').value) || 0);
      if (!d.takeUnit(ty)) return d.toast('Няма свободна такава техника тук.', 'bad');
      const r = await queue({ fn: 'coop_rent_offer', args: { p_req: uid(), p_type: ty, p_hours: hrs, p_price: pr }, refund: { unit: ty } });
      if (r?.ok) d.toast(`📤 ${UNIT_TYPES[ty]?.nm} е предложен${pr ? ` под наем за ${f(pr)} €` : ' като помощ'} — чака ${partnerName()}.`, 'good'); return; }
    if (c === 'rpay') { const pr = +x; if (pr > 0 && !money(pr)) return; if (pr > 0) E().spend(pr, 'партньор', `Наем на техника от ${partnerName()}`);
      const r = await queue({ fn: 'coop_rent_act', args: { p_req: uid(), p_id: +a, p_action: 'accept' }, refund: pr > 0 ? { money: pr } : null });
      if (r?.ok) d.toast('🚚 Машината идва при теб.', 'good'); d.renderPanel(); return; }
    if (c === 'ract') { const r = await queue({ fn: 'coop_rent_act', args: { p_req: uid(), p_id: +a, p_action: x }, refund: null }); if (r?.ok) d.toast(x === 'cancel' ? 'Оттеглено — машината се връща при теб.' : 'Отказано.', 'good'); return; }
    if (c === 'rback') { if (!d.takeUnit(x)) return d.toast('Машината е заета на обект — освободи я първо.', 'bad');
      const r = await queue({ fn: 'coop_rent_act', args: { p_req: uid(), p_id: +a, p_action: 'return' }, refund: { unit: x } }); if (r?.ok) d.toast('🚚 Върна машината.', 'good'); return; }
    if (c === 'surp') { const txt = el.querySelector('#cpST').value.trim() || '🎁', amt = Math.round(num(el.querySelector('#cpSA').value) || 0);
      if (amt > 0 && !money(amt)) return; const spots = d.sitesHere(), sp = spots.length ? spots[Math.floor(Math.random() * spots.length)] : { x: 0, z: 0 };
      if (amt > 0) E().spend(amt, 'партньор', `🎁 Изненада за ${partnerName()}`);
      const r = await queue({ fn: 'coop_surprise', args: { p_req: uid(), p_city: d.cityId(), p_x: sp.x, p_z: sp.z, p_text: txt, p_amount: amt }, refund: amt > 0 ? { money: amt } : null });
      if (r?.ok) d.toast(`🎁 Изненадата е оставена в ${d.cityName(d.cityId())}.`, 'good'); d.renderPanel(); return; }
    if (c === 'qclaim') { const r = await rpc('coop_quest_claim', { p_id: +a }); if (!say(r)) return; E().earn(r.reward, 'партньор', '🏆 Обща задача'); if (feature('xp-km')) d.addXp?.(300); d.save(); d.renderPanel(); d.toast(`🏆 Обща задача: +${f(r.reward)} €`, 'good'); return; }
    if (c === 'vput') { const n = Math.round(num(el.querySelector('#cpV').value)); if (!money(n)) return; E().spend(n, 'партньор', '🏦 Вноска в общата касичка');
      const r = await queue({ fn: 'coop_vault', args: { p_req: uid(), p_amount: n }, refund: { money: n } }); if (r?.ok) d.toast(`🏦 Внесе ${f(n)} €.`, 'good'); d.renderPanel(); return; }
    if (c === 'vtake') { const n = Math.round(num(el.querySelector('#cpV').value)); if (!(n > 0)) return d.toast('Въведи сума.', 'bad');
      const r = await rpc('coop_vault', { p_req: uid(), p_amount: -n }); if (r?.err === 'need_approval') return d.toast(`🏦 ${r.msg} Натисни „🙋 Поискай одобрение“.`, 'bad');
      if (say(r)) d.toast(`🏦 Изтегли ${f(n)} € — идват след миг.`, 'good'); return; }
    // ── центърът, v2: техника с количество, структурирано 🆘, правила на касата и заявки над лимита ──
    if (c === 'unitn' || c === 'rentn') { const want = Math.max(1, Math.round(num(el.querySelector('#ccQty')?.value) || 1)), city = el.querySelector('#ccDest')?.value || null, hrs = +(el.querySelector('#cpRH')?.value || 12), pr = Math.round(num(el.querySelector('#cpRP')?.value) || 0);
      let got = 0; if (c === 'unitn') { for (let i = 0; i < want; i++) { if (!d.takeUnit(a)) break; got++; } if (!got) return d.toast('Няма свободна такава техника тук.', 'bad');
        const r = await queue({ fn: 'coop_send', args: { p_req: uid(), p_kind: 'unit', p_data: { type: a, n: got, city } }, refund: { unit: a, n: got } });
        if (r?.ok) d.toast(`🚚 ${got} × ${UNIT_TYPES[a].ico} ${UNIT_TYPES[a].nm} пътуват към ${partnerName()}${city ? ` (за ${d.cityName(city)})` : ''}.`, 'good'); return; }
      for (let i = 0; i < want; i++) { if (!d.takeUnit(a)) break; const r = await queue({ fn: 'coop_rent_offer', args: { p_req: uid(), p_type: a, p_hours: hrs, p_price: pr }, refund: { unit: a } }); if (r?.ok) got++; }
      if (got) d.toast(`📤 ${got} × ${UNIT_TYPES[a]?.nm} — предложени ${pr ? `под наем за ${f(pr)} € всяка` : 'като помощ'} за ${hrs} ч. Чака ${partnerName()}.`, 'good'); else d.toast('Няма свободна такава техника тук.', 'bad'); return; }
    if (c === 'sosx') { const t = (el.querySelector('#ccSosTxt')?.value || '').slice(0, 280); if (!t) return; if (say(await rpc('coop_say', { p_text: t, p_sos: true }))) d.toast('🆘 Молбата е изпратена.', 'good'); return; }
    if (c === 'helped') { const m = (st2?.messages || []).find(q => q.id === +a); if (say(await rpc('coop_say', { p_text: `✅ Помогнах: ${(m?.text || '').slice(0, 200)}` }))) d.toast('✅ Отбелязано — партньорът вижда, че е помогнато.', 'good'); return; }
    if (c === 'rulesp') { const lim = id => { const v = String(el.querySelector(id)?.value || '').trim(); return v === '' ? null : Math.round(num(v)); };
      if (say(await rpc('coop_rules_propose', { p_self: lim('#ccSelf'), p_rescue: lim('#ccRescue') }))) d.toast('📜 Правилата са предложени — важат, щом партньорът ги приеме.', 'good'); return; }
    if (c === 'rulesact') { if (say(await rpc('coop_rules_act', { p_action: a }))) d.toast({ accept: '📜 Правилата на касата важат от сега.', decline: 'Отказано.', cancel: 'Оттеглено.' }[a] || 'Готово.', 'good'); return; }
    if (c === 'wreq') { const n = Math.round(num(el.querySelector('#cpV')?.value)); if (!(n > 0)) return d.toast('Въведи сумата горе (в полето на холдинга).', 'bad');
      if (say(await rpc('coop_withdraw_request', { p_req: uid(), p_amount: n, p_reason: el.querySelector('#ccReason')?.value || '' }))) d.toast(`🙋 Заявката за ${f(n)} € е пратена на ${partnerName()}.`, 'good'); return; }
    if (c === 'wact') { const r = await rpc('coop_withdraw_act', { p_id: +a, p_action: x }); if (say(r)) d.toast({ approve: `✅ Одобри тегленето — ${f(r.amount || 0)} € тръгват към ${partnerName()}.`, decline: 'Отказано.', cancel: 'Оттеглено.' }[x] || 'Готово.', 'good'); return; }
    if (c === 'ipo') { const r = await rpc('coop_ipo', a === 'propose' ? { p_action: 'propose', p_pct: +el.querySelector('#cpIP').value, p_hours: +el.querySelector('#cpIH').value } : { p_action: a });
      if (say(r)) d.toast({ propose: '📈 Предложението е пратено — партньорът трябва да го одобри.', accept: '📈 Акциите на холдинга тръгнаха на борсата!', decline: 'Отказано.', cancel: 'Оттеглено.' }[a] || 'Готово.', 'good'); return; }
    if (c === 'vname') { if (say(await rpc('coop_vault_name', { p_name: el.querySelector('#cpVN').value }))) d.toast('Името е запазено.'); return; }
    if (c === 'say' || c === 'quick') { const txt = c === 'quick' ? QUICK[+a] : el.querySelector('#cpMsg').value; if (!txt) return; if (say(await rpc('coop_say', { p_text: txt }))) tab = 'chat'; return; }
    if (c === 'sos') { say(await rpc('coop_say', { p_text: `Трябва ми помощ! Имам ${f(E().money)} €${E().money < 0 ? ' (на минус!)' : ''}.`, p_sos: true })); d.toast('🆘 Сигналът е изпратен.', 'good'); return; }
    if (c === 'join') { const r = await rpc('coop_join', { p_code: el.querySelector('#cpCode').value }); if (say(r)) d.toast('🤝 Свързани сте! Градовете на партньора ще се появят на картата ти в синьо.', 'good'); return; }
    if (c === 'leave') { d.modal('Прекрати партньорството?', 'Пратките, които вече са тръгнали, ще пристигнат. После ще можете да се свържете отново с нов код.', [['Не', null], ['Прекрати', async () => { await batchFlush(); await rpc('coop_leave'); await tick(); }]]); return; }
    if (c === 'name') { try { localStorage.setItem(NAME, el.querySelector('#cpName').value.trim().slice(0, 24)); } catch {} lastSnap = 0; d.toast('Името е запазено.'); return; }
    if (c === 'gift') { const n = amtIn(); if (!money(n)) return; E().spend(n, 'партньор', `🎁 Подарък за ${partnerName()}`);
      const r = await queue({ fn: 'coop_send', args: { p_req: uid(), p_kind: 'gift', p_data: { amount: n } }, refund: { money: n } }); if (r?.ok) d.toast(`🎁 Изпрати ${f(n)} € на ${partnerName()}.`, 'good'); d.renderPanel(); return; }
    if (c === 'loan') { const n = amtIn(); if (!money(n)) return; E().spend(n, 'партньор', `💸 Заем за ${partnerName()} (чака приемане)`);
      const r = await queue({ fn: 'coop_loan', args: { p_req: uid(), p_amount: n, p_hours: +el.querySelector('#cpH').value, p_rate_pct: +el.querySelector('#cpR').value }, refund: { money: n } });
      if (r?.ok) d.toast(`💸 Предложи заем ${f(n)} € — парите тръгват, когато ${partnerName()} приеме.`, 'good'); d.renderPanel(); return; }
    if (c === 'lact') { const r = await rpc('coop_loan_act', { p_loan: +a, p_action: x }); if (say(r)) d.toast({ accept: '💸 Заемът е приет — парите идват.', decline: 'Заемът е отказан — парите се връщат на партньора.', cancel: 'Заемът е оттеглен — парите се връщат.', forgive: '🎁 Опрости заема.' }[x], 'good'); return; }
    if (c === 'repay') { const n = Math.min(+x, Math.floor(E().money)); if (!money(n)) return; E().spend(n, 'партньор', `Връщане на заем към ${partnerName()}`);
      const r = await queue({ fn: 'coop_repay', args: { p_req: uid(), p_loan: +a, p_amount: n }, refund: { money: n } }); if (r?.ok) d.toast(`💸 Върна ${f(r.paid)} €.`, 'good'); d.renderPanel(); return; }
    if (c === 'unit') { if (!d.takeUnit(a)) return d.toast('Няма свободна такава техника тук.', 'bad');
      const r = await queue({ fn: 'coop_send', args: { p_req: uid(), p_kind: 'unit', p_data: { type: a, n: 1 } }, refund: { unit: a } }); if (r?.ok) d.toast(`🚚 ${UNIT_TYPES[a].ico} ${UNIT_TYPES[a].nm} пътува към ${partnerName()}.`, 'good'); return; }
    if (c === 'mat') { const have = E().s.stock[a] || 0, q = Math.min(have, Math.round(num(el.querySelector(`[data-mq="${a}"]`)?.value) * 100) / 100);
      if (!(q > 0)) return d.toast('Въведи количество.', 'bad');
      E().s.stock[a] = Math.round((have - q) * 100) / 100;
      const r = await queue({ fn: 'coop_send', args: { p_req: uid(), p_kind: 'mat', p_data: { mat: a, qty: q } }, refund: { mat: a, qty: q } }); if (r?.ok) d.toast(`📦 ${MATERIALS[a].nm}: ${q} ${MATERIALS[a].unit} → ${partnerName()}.`, 'good'); d.renderPanel(); return; }
    if (c === 'mega') { const r = await rpc('coop_mega_start', { p_key: a }); if (say(r)) d.toast('🏗️ Поръчката е започната — вложи пари и кажи на партньора.', 'good'); return; }
    if (c === 'put') { const n = Math.round(num(el.querySelector(`[data-mp="${a}"]`)?.value)); if (!money(n)) return; E().spend(n, 'партньор', 'Вноска в обща поръчка');
      const r = await queue({ fn: 'coop_mega_put', args: { p_req: uid(), p_mega: +a, p_amount: n }, refund: { money: n } });
      if (r?.ok) d.toast(r.building ? '🏗️ Сумата е събрана — строежът започна!' : `Вложи ${f(r.put)} €.`, 'good'); d.renderPanel(); return; }
    if (c === 'claim') { const r = await rpc('coop_mega_claim', { p_mega: +a }); if (!say(r)) return;
      E().earn(r.reward, 'партньор', `${r.nm} — обща поръчка`); if (feature('xp-km')) d.addXp?.(3000); d.save(); d.renderPanel();
      d.toast(`✅ Изпълнена поръчка: ${r.ico} ${r.nm}! +${f(r.reward)} €${r.fair ? ' (вложеното + половината от печалбата)' : ' (без печалба — единият е вложил под 20%)'}`, 'good'); return; }
  }

  if (!AUTOTEST) {
    setTimeout(() => { mount(); tick(); }, 1500);
    setInterval(() => { if (document.visibilityState === 'visible') tick(); }, POLL);
  }
  window.__coopDbg = () => ({ partner: st?.partner?.snap?.name, sites: st?.partner?.snap?.sites, marks: lastMarks, here: d.ready() && d.cityId() });
  // нивото на партньора (активно партньорство) — devlevel.js чака него (coop-lv)
  const partnerLv = () => { const P = st?.pair?.status === 'active' ? st?.partner?.snap : null; return P && Number.isFinite(P.lv) ? P.lv : null; };
  // 🌐 coop-pres (coopres.js): моят id, съобщенията и изпращането през съществуващия чат (coop_say)
  return { tick, state: () => st, riv: () => stRiv, rivRpc: (fn, args) => rpc(fn, args, 1), partnerLv, me: () => user?.id || null, msgs: () => st2?.messages || [], say: text => rpc('coop_say', { p_text: String(text || '').slice(0, 280) }) };
}
