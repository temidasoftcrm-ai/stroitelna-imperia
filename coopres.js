// coopres.js — 🌐 флаг 'coop-pres': президентството в партньорство (за v4.0.0; дизайнът — одобрен от собственика).
// 1) ИЗБОРЪТ: държавата (САЩ/Русия) се избира веднъж (imperial.js choose); в партньорство първият, който е избрал, „заема“ държавата —
//    другият вижда „🇷🇺 Русия е избрана от партньора <име>“ и може да избере само другата. Партньорът научава избора от снимката (coop.js snapshot → pres).
//    Ако и двамата са избрали една и съща държава (едновременно, преди снимките да се разменят): НИКОЙ не сменя — държавата е част от града
//    и кампанията (смяната би счупила записа). И двамата я запазват; на „Срещата на върха“ стои предупреждение, а по-ниският номер на акаунта е „домакинът“.
//    Всичко общо (мир, договори) работи и тогава — отношенията САЩ–Русия просто се четат от гледната точка на всеки.
// 2) „🌐 Срещата на върха“ — общ екран (бутон в президентския прозорец, когато и партньорът е президент): двата флага с петте показателя,
//    отношенията САЩ–Русия (средното от двете гледни точки), мирните процеси (стъпката на всеки и общата „заедно“), помощта на двамата, чатът.
// 3) ОБЩ МИР: ако партньорът е стигнал по-напред в даден конфликт, твоят процес върви с +1 стъпка (веднъж за всяка негова стъпка — S.pres.jp).
// 4) ОБЩИ ДОГОВОРИ: единият предлага (примирие в конфликт или обща програма за помощ на държава), другият приема/отказва. Предложенията и
//    отговорите пътуват в снимката (coop_joint на сървъра е само за магистрали/жп); всеки дава СВОЯ бонус локално, когато види и двете „да“.
//    Бонусът: +отношения САЩ–Русия, +доверие, при примирие — +1 мирна стъпка, при помощ — +отношения и стабилност на държавата. БЕЗ пари.
//    Всеки договор е с id (S.pres.treaties) — бонусът се дава веднъж; един и същ договор (вид + цел) се приема само веднъж.
// Данните на партньора идват от чужд клиент (сървърът не ги проверява): cleanPres ги чисти, а от тях зависят само стъпки/отношения у теб — никога пари.
// deps: { S(), pres, coop() → обектът от coop.js, toast(text, kind), save() }
import { feature } from './lab/feature.js';
import { POL, AID, CONFLICTS, PEACE } from './worldpol.js';
import { t as tr } from './i18n.js';

const ON = feature('coop-pres');
const IND_K = ['econ', 'services', 'energy', 'security', 'trust'];
const IND_N = { econ: ['📈', 'Икономика'], services: ['🏥', 'Услуги'], energy: ['⚡', 'Енергия'], security: ['🛡️', 'Сигурност'], trust: ['🤝', 'Доверие'] };
const KEYS = ['UKR', 'ISR', 'SAU', 'CHN', 'IND', 'TUR', 'IRN', 'DEU'];   // ключовите отношения в снимката (освен САЩ–Русия)
const FLAG = { US: '🇺🇸', RU: '🇷🇺' }, CNM = { US: 'САЩ', RU: 'Русия' };
const MAX_T = 30;   // най-много записани договори
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cl = v => Math.max(0, Math.min(100, v));
const nm = iso => POL[iso]?.nm || iso;
const tOk = t => t && typeof t === 'object' && typeof t.id === 'string' && /^[\w-]{1,24}$/.test(t.id) && (t.k === 'cease' ? CONFLICTS.some(c => c.k === t.ref) : t.k === 'aid' ? !!POL[t.ref] && t.ref !== 'USA' && t.ref !== 'RUS' : false);
const tTitle = t => t.k === 'cease' ? `🕊️ Примирие: ${CONFLICTS.find(c => c.k === t.ref)?.nm || t.ref}` : `📦 Обща програма за помощ: ${nm(t.ref)}`;

// 🧼 президентството на партньора от снимката (coop.js cleanSnap): cc само US|RU, числата — в граници, обектите — с таван
export function cleanPres(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const n = (x, a, b) => Number.isFinite(+x) ? Math.max(a, Math.min(b, +x)) : a, cc = v => v === 'US' || v === 'RU' ? v : null, o = x => x && typeof x === 'object' && !Array.isArray(x) ? x : {};
  const ind = {}; for (const k of IND_K) ind[k] = Math.round(n(o(p.ind)[k], 0, 100));
  const rel = { x: Math.round(n(o(p.rel).x, 0, 100)) }; for (const k of KEYS) if (o(p.rel)[k] != null) rel[k] = Math.round(n(o(p.rel)[k], 0, 100));
  const conf = {}; for (const c of CONFLICTS) conf[c.k] = n(o(p.conf)[c.k], 0, 6) | 0;
  const aidL = (Array.isArray(p.aidL) ? p.aidL : []).filter(a => Array.isArray(a) && POL[a[0]] && AID[a[1]]).slice(0, 12).map(a => [a[0], a[1], !!a[2]]);
  const tq = (Array.isArray(p.tq) ? p.tq : []).filter(tOk).slice(0, 12).map(t => ({ id: t.id, k: t.k, ref: t.ref, mine: !!t.mine, st: ['prop', 'acc', 'dec'].includes(t.st) ? t.st : 'dec' }));
  const pw = p.pw && typeof p.pw === 'object' && !Array.isArray(p.pw) ? { g: (Array.isArray(p.pw.g) ? p.pw.g : []).slice(0, 6).map(x => !!x), m: n(p.pw.m, 0, 12) | 0, won: !!p.pw.won } : null;   /* 🕊️ peace-win: целите на партньора — само за показване */
  return { cc: cc(p.cc), icc: cc(p.icc), on: !!p.on && !!cc(p.cc), lv: n(p.lv, 0, 40) | 0, res: n(p.res, 0, 1e13),   /* ⚖️ coop-riv-deals: държавният бюджет (сървърът проверява обещанията спрямо него) */ ind, rel, conf, aid: n(p.aid, 0, 999) | 0, aidL, stab: Math.round(n(p.stab, 0, 100)), tq, pw };
}

export function createCoopPres(deps) {
  const NO = { snap: () => ({}), taken: () => null, dailyTick() { }, btn: () => '', open() { }, close() { }, ok: () => false, partner: () => null, accept() { }, decline() { }, propose() { }, isOpen: () => false };
  if (!ON) return NO;
  const S = () => deps.S(), P = () => S()?.pres || null, day = () => S()?.day || 0;
  const myCc = () => P()?.cc || S()?.imp?.cc || null;
  const other = cc => cc === 'RU' ? 'USA' : 'RUS';
  let el = null, fakeChat = [], tab = 'sum';   // tab: 'sum' — срещата, 'riv' — ⚖️ Конкуренти (coop-riv-core, coopriv.js)
  const riv = () => { try { return deps.riv?.() || null; } catch { return null; } };
  const told = new Set();   // кои предложения на партньора вече са показани с тост (в паметта; екранът ги показва винаги)

  // 🤝 партньорът: истинското партньорство (coop.js) или фалшивият от Лабораторията (window.__coopShared.pres — само в теста/демото)
  function partner() {
    let c = null; try { c = deps.coop?.()?.state?.(); } catch { }
    if (c?.pair?.status === 'active' && c.partner?.snap) return { name: c.partner.snap.name || 'партньора', id: String(c.partner.id || ''), p: c.partner.snap.pres || null, fake: false };
    const F = window.__coopShared; if (F && F.pres) return { name: String(F.name || 'партньора').replace(/[<>&"'`\\]/g, '').slice(0, 24), id: 'zz-fake', p: cleanPres(F.pres), fake: true };
    return null;
  }
  const myId = () => { try { return String(deps.coop?.()?.me?.() || ''); } catch { return ''; } };
  const ok = () => !!P() && !!partner()?.p?.on;

  // 📸 моята част от снимката за партньора (малка): държавата, показателите, отношенията, стъпките на мира, помощта, договорите
  function snap() {
    const s = S(); if (!s || !(s.pres || s.imp?.cc)) return {};
    const p = s.pres; if (!p) return { pres: { cc: null, icc: s.imp.cc, on: false } };
    const rel = { x: Math.round(deps.pres.rel(other(p.cc))) }; for (const k of KEYS) rel[k] = Math.round(deps.pres.rel(k));
    const conf = {}; for (const c of CONFLICTS) conf[c.k] = p.conf?.[c.k]?.step || 0;
    const ind = {}; for (const k of IND_K) ind[k] = Math.round(p.ind[k]);
    return { pres: { cc: p.cc, icc: s.imp?.cc || p.cc, on: true, lv: p.lv || 0, ...(feature('coop-riv-deals') ? { res: Math.max(0, Math.round(p.res || 0)) } : {}), ind, rel, conf, aid: (p.aid || []).length, aidL: (p.aid || []).slice(-12).map(a => [a.iso, a.need, !!a.done && a.works !== false]),
      stab: Math.round(IND_K.reduce((a, k) => a + p.ind[k], 0) / IND_K.length), tq: Object.values(p.treaties || {}).slice(-12).map(t => ({ id: t.id, k: t.k, ref: t.ref, mine: t.mine, st: t.st })), ...(p.pw?.g ? { pw: { g: p.pw.g, m: Math.floor((p.pw.hold || 0) / 30), won: !!p.pw.won } } : {}) } };   /* 🕊️ peace-win: целите (само с флага има p.pw) */
  }

  // 🗳️ заетата държава (imperial.js choose): { cc, name } — партньорът вече е избрал
  function taken() { const q = partner(); const cc = q?.p?.cc || q?.p?.icc; return cc ? { cc, name: q.name, flag: FLAG[cc], cnm: CNM[cc] } : null; }
  // ⚠️ и двамата с една и съща държава (едновременен избор) — никой не сменя; по-ниският номер е „домакинът“
  function clash() { const q = partner(), cc = myCc(), pc = q?.p?.cc || q?.p?.icc; if (!cc || !pc || cc !== pc) return null; const me = myId(); return { cc, host: !!me && !!q.id && me < q.id }; }

  // 🕊️ мирната стъпка (като president.js decide: 3 — примирие, 4+ — по-стабилно)
  function stepUp(k) { k.step++; if (k.step === 3) { k.stab = 65; k.held = 0; } if (k.step >= 4) k.stab = Math.min(100, (k.stab || 0) + 15); k.int = Math.max(0, (k.int || 0) - 20); }
  const log = t => { const s = P(); s.log = [{ d: day(), t }, ...(s.log || [])].slice(0, 40); };

  // 📅 всеки ден (и при отваряне на екрана): общият мир и договорите
  function dailyTick() {
    const s = P(), q = partner(); if (!s || !q?.p?.on) return; let ch = false;
    s.jp = s.jp || {}; s.treaties = s.treaties || {};
    // 3) общият мир: партньорът е напред с ≥ 1 стъпка → +1 у мен, веднъж за всяка негова стъпка
    for (const c of CONFLICTS) { const k = s.conf[c.k], ps = q.p.conf[c.k] | 0; if (!k || k.step >= 5 || ps - k.step < 1 || ps <= (s.jp[c.k] || 0)) continue;
      s.jp[c.k] = ps; stepUp(k); log(`${c.nm}: обща стъпка с ${q.name} — ${PEACE[k.step - 1].nm}.`); deps.toast(`🌐 ${c.nm}: стъпката на ${q.name} важи и за теб — ${PEACE[k.step - 1].ico} ${PEACE[k.step - 1].nm}`, 'good'); ch = true; }
    // 4) договорите: моите предложения — отговорът на партньора; неговите — нови за мен
    for (const t of q.p.tq) {
      const mine = s.treaties[t.id];
      if (!t.mine && mine?.mine && mine.st === 'prop' && (t.st === 'acc' || t.st === 'dec')) { mine.st = t.st; if (t.st === 'acc') bonus(mine, q.name); else deps.toast(`✖ ${q.name} отказа: ${tTitle(mine)}`, 'bad'); ch = true; }
      if (t.mine && t.st === 'prop' && !mine && !told.has(t.id)) { told.add(t.id); deps.toast(`🌐 ${q.name} предлага договор: ${tTitle(t)} — виж „Срещата на върха“`, 'good', () => open()); }
    }
    if (ch) { prune(s); deps.save(); if (el) render(); }
  }
  // 🎁 бонусът на договора — локален, веднъж за id и веднъж за вид + цел
  function bonus(t, who) {
    const s = P(); if (t.ok || Object.values(s.treaties).some(x => x !== t && x.ok && x.k === t.k && x.ref === t.ref)) return;
    t.ok = day(); const x = other(s.cc); s.rel[x] = cl(deps.pres.rel(x) + 5); s.ind.trust = cl(s.ind.trust + 3);
    if (t.k === 'cease') { const k = s.conf[t.ref]; if (k && k.step < 5) stepUp(k); }
    else { s.rel[t.ref] = cl(deps.pres.rel(t.ref) + 4); s.stab = s.stab || {}; s.stab[t.ref] = cl(deps.pres.stab(t.ref) + 3); }
    log(`🤝 Договор с ${who}: ${tTitle(t)}.`); deps.toast(`🤝 Договорът е подписан с ${who}: ${tTitle(t)} · +5 отношения ${s.cc === 'RU' ? 'със САЩ' : 'с Русия'}, +3 доверие`, 'good');
  }
  function prune(s) { const L = Object.values(s.treaties); if (L.length <= MAX_T) return; for (const t of L.filter(x => x.st !== 'prop').slice(0, L.length - MAX_T)) delete s.treaties[t.id]; }

  function propose(k, ref) {
    const s = P(), q = partner(), t = { id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), k, ref, mine: true, st: 'prop', d: day() };
    if (!s || !q?.p?.on || !tOk(t)) return false; s.treaties = s.treaties || {};
    if (Object.values(s.treaties).some(x => x.k === k && x.ref === ref && (x.ok || x.st === 'prop'))) { deps.toast('Такъв договор вече е предложен или подписан.', 'bad'); return false; }
    s.treaties[t.id] = t; prune(s); deps.save(); deps.toast(`📨 Предложението е изпратено на ${q.name}: ${tTitle(t)} (стига до партньора с обновяването, ~20 с)`, 'good'); return t.id;
  }
  function answer(id, yes) {
    const s = P(), q = partner(); if (!s || !q?.p) return; s.treaties = s.treaties || {};
    const t = q.p.tq.find(x => x.id === id && x.mine && x.st === 'prop'); if (!t || s.treaties[id]) return;
    const r = s.treaties[id] = { id, k: t.k, ref: t.ref, mine: false, st: yes ? 'acc' : 'dec', d: day() };
    if (yes) bonus(r, q.name); else deps.toast(`Отказа: ${tTitle(r)}`, ''); prune(s); deps.save(); if (el) render();
  }

  // 💬 чатът: истинският coop_say (coop.js), а във фалшивото демо — само локално
  const msgs = () => { const q = partner(); if (q?.fake) return fakeChat; try { return deps.coop?.()?.msgs?.() || []; } catch { return []; } };
  async function say(text) {
    text = String(text || '').trim().slice(0, 280); if (!text) return; const q = partner();
    if (q?.fake) { fakeChat = [...fakeChat, { id: fakeChat.length + 1, me: true, text }].slice(-20); render(); return; }
    try { await deps.coop().say(text); deps.toast('💬 Изпратено.', 'good'); } catch (e) { deps.toast('Чатът не е достъпен: ' + (e?.message || e), 'bad'); }
    setTimeout(() => el && render(), 1500);
  }

  // ---- 🌐 екранът „Срещата на върха“
  const CSS = `#coopSummit { position:fixed; inset:0; z-index:9790; background:#0b1220; color:#e6edf6; font:500 14px/1.45 system-ui, sans-serif; display:flex; flex-direction:column; }
#coopSummit .tb { display:flex; align-items:center; gap:8px; padding:10px 14px; border-bottom:1px solid #22304a; } #coopSummit h2 { margin:0 auto 0 0; font-size:18px; }
#coopSummit .bd { flex:1; overflow:auto; padding:12px 14px; display:flex; gap:12px; flex-wrap:wrap; align-content:flex-start; }
#coopSummit .cd { background:#131d30; border:1px solid #22304a; border-radius:12px; padding:10px 12px; flex:1 1 320px; min-width:0; } #coopSummit .w { flex-basis:100%; }
#coopSummit .bar { height:7px; background:#22304a; border-radius:4px; overflow:hidden; margin:3px 0 6px; } #coopSummit .bar i { display:block; height:100%; }
#coopSummit .m { color:#9fb0c8; font-size:13px; } #coopSummit table { width:100%; border-collapse:collapse; font-size:13px; } #coopSummit td, #coopSummit th { padding:4px 6px; border-bottom:1px solid #22304a; text-align:left; }
#coopSummit button, #coopSummit select, #coopSummit input { background:#1d2a42; color:#e6edf6; border:1px solid #2d3f60; border-radius:9px; padding:6px 10px; font:inherit; } #coopSummit button { cursor:pointer; } #coopSummit button.y { background:#ffd54a; color:#111; border-color:#ffd54a; }
#coopSummit .row { display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin-top:6px; } #coopSummit .chat { max-height:180px; overflow:auto; }`;
  const bar = (v, col) => `<div class="bar"><i style="width:${Math.round(cl(v))}%;background:${col || (v >= 60 ? '#3fae6b' : v >= 40 ? '#ffd54a' : '#ff6b6b')}"></i></div>`;
  const stepNm = n => n ? `${PEACE[Math.min(6, n) - 1].ico} ${PEACE[Math.min(6, n) - 1].nm}` : '⚔️ боеве';
  function side(cc, who, lv, ind, aidN) {
    return `<div class="cd"><b style="font-size:16px">${FLAG[cc] || '🏳️'} ${esc(who)}</b> <span class="m">· ${CNM[cc] ? tr(CNM[cc]) : '?'} · ниво ${lv}</span>${IND_K.map(k => `<div class="m">${IND_N[k][0]} ${tr(IND_N[k][1])}: <b style="color:#e6edf6">${Math.round(ind[k])}</b></div>${bar(ind[k])}`).join('')}<div class="m">📦 проекти за помощ: ${aidN}</div></div>`;
  }
  function tabs() {   // ⚖️ coop-riv-core: табовете горе (без флага — няма)
    const R = riv(), on = !!R && R.html !== undefined && feature('coop-riv-core'); const t = el?.querySelector('#cpTabs'); if (!t) return on;
    t.innerHTML = on ? `<button data-cptab="sum"${tab === 'sum' ? ' class="y"' : ''}>🌐 ${tr('Срещата')}</button><button data-cptab="riv"${tab === 'riv' ? ' class="y"' : ''}>⚖️ ${tr('Конкуренти')}${R.badge() ? ' <b style="color:#ffd54a">•</b>' : ''}</button>` : '';
    t.querySelectorAll('[data-cptab]').forEach(b => b.onclick = () => { tab = b.dataset.cptab; render(); }); return on;
  }
  function render() {
    if (!el) return; const s = P(), q = partner();
    if (tabs() && tab === 'riv') { const R = riv(); el.querySelector('.bd').innerHTML = R.html(); R.bind(el); return; }
    if (!s || !q?.p?.on) { el.querySelector('.bd').innerHTML = `<div class="cd w">${s ? `Партньорът още не е президент — „Срещата на върха“ се отваря, когато и двамата сте президенти.` : 'Не си президент.'}</div>`; return; }
    const p = q.p, x = other(s.cc), myX = Math.round(deps.pres.rel(x)), avg = Math.round((myX + p.rel.x) / 2), cx = clash();
    let h = cx ? `<div class="cd w" style="border-color:#ffb347"><b style="color:#ffb347">⚠️ И двамата сте избрали ${FLAG[cx.cc]} ${CNM[cx.cc]}</b><div class="m">Изборът беше едновременен. Никой не сменя държавата (тя е част от града и кампанията); ${cx.host ? 'ти си домакинът на срещата.' : `домакин е ${esc(q.name)}.`} Общият мир и договорите работят.</div></div>` : '';
    h += side(s.cc, 'Ти', s.lv || 0, s.ind, (s.aid || []).length) + side(p.cc, q.name, p.lv, p.ind, p.aid);
    h += `<div class="cd w"><b>🤝 Отношения САЩ — Русия</b> <span class="m">(средното от двете гледни точки)</span><div style="font-size:20px;font-weight:800;margin-top:4px">${avg}</div>${bar(avg, '#4fc3f7')}<div class="m">${FLAG[s.cc]} твоята гледна точка: ${myX} · ${FLAG[p.cc] || ''} на ${esc(q.name)}: ${p.rel.x}</div></div>`;
    h += `<div class="cd w"><b>🕊️ Мирните процеси</b> <span class="m">— стъпката на по-напредналия важи и за другия (+1, веднъж на стъпка)</span><table><tr><th>Конфликт</th><th>${FLAG[s.cc]} ти</th><th>${FLAG[p.cc] || ''} ${esc(q.name)}</th><th>🤝 заедно</th></tr>${CONFLICTS.map(c => { const a = s.conf[c.k]?.step || 0, b = p.conf[c.k] | 0; return `<tr><td>${c.ico} ${c.nm}</td><td>${stepNm(a)}</td><td>${stepNm(b)}</td><td><b>${stepNm(Math.max(a, b))}</b></td></tr>`; }).join('')}</table></div>`;
    const aidRow = (iso, need, done) => `<div class="m">${done ? '✅' : '⏳'} ${AID[need]?.nm || need} — ${nm(iso)}</div>`;
    h += `<div class="cd"><b>📦 Помощта — ${FLAG[s.cc]} ти</b>${(s.aid || []).slice(-12).map(a => aidRow(a.iso, a.need, a.done && a.works !== false)).join('') || '<div class="m">Още няма.</div>'}</div><div class="cd"><b>📦 Помощта — ${FLAG[p.cc] || ''} ${esc(q.name)}</b>${p.aidL.map(a => aidRow(a[0], a[1], a[2])).join('') || '<div class="m">Още няма.</div>'}</div>`;
    // 📜 договорите
    const T = s.treaties || {}, inbox = p.tq.filter(t => t.mine && t.st === 'prop' && !T[t.id]), lst = Object.values(T).slice(-8).reverse();
    const opts = [...CONFLICTS.filter(c => (s.conf[c.k]?.step || 0) < 5).map(c => [`cease|${c.k}`, `🕊️ Примирие: ${c.nm}`]), ...Object.keys(POL).filter(i => POL[i].need?.length && i !== 'USA' && i !== 'RUS').map(i => [`aid|${i}`, `📦 Помощ: ${POL[i].nm}`])];
    h += `<div class="cd"><b>📜 Общи договори</b> <span class="m">— при „да“ и от двамата: +5 отношения ${s.cc === 'RU' ? 'със САЩ' : 'с Русия'}, +3 доверие; примирието — +1 мирна стъпка</span>`
      + inbox.map(t => `<div class="row" style="border:1px solid #ffd54a;border-radius:9px;padding:6px"><span style="flex:1">📨 ${esc(q.name)} предлага: <b>${tTitle(t)}</b></span><button class="y" data-cpacc="${t.id}">✓ Приеми</button><button data-cpdec="${t.id}">✖ Отказвам</button></div>`).join('')
      + `<div class="row"><select id="cpTreaty" style="flex:1;min-width:180px">${opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select><button class="y" data-cpprop="1">📨 Предложи</button></div>`
      + (lst.length ? lst.map(t => `<div class="m">${t.ok ? '✅' : t.st === 'dec' ? '✖' : '⏳'} ${tTitle(t)} <span class="m">· ${t.mine ? 'твое предложение' : `от ${esc(q.name)}`}${t.st === 'prop' ? ' · чака отговор' : t.st === 'dec' ? ' · отказан' : ''}</span></div>`).join('') : '<div class="m" style="margin-top:6px">Още няма договори.</div>') + '</div>';
    // 💬 чатът (coop_say)
    const M = msgs().slice(-6);
    h += `<div class="cd"><b>💬 Разговор</b><div class="chat">${M.map(m => `<div class="m" style="margin:3px 0;${m.me ? 'text-align:right' : ''}"><b style="color:${m.me ? '#ffd54a' : '#4fc3f7'}">${m.me ? 'ти' : esc(q.name)}:</b> ${esc(m.text)}</div>`).join('') || '<div class="m">Още няма съобщения.</div>'}</div><div class="row"><input id="cpSay" maxlength="280" placeholder="Съобщение до ${esc(q.name)}…" style="flex:1;min-width:160px"><button class="y" data-cpsay="1">Изпрати</button></div></div>`;
    el.querySelector('.bd').innerHTML = h;
    el.querySelectorAll('[data-cpacc]').forEach(b => b.onclick = () => answer(b.dataset.cpacc, true));
    el.querySelectorAll('[data-cpdec]').forEach(b => b.onclick = () => answer(b.dataset.cpdec, false));
    el.querySelectorAll('[data-cpprop]').forEach(b => b.onclick = () => { const [k, ref] = (el.querySelector('#cpTreaty')?.value || '').split('|'); if (propose(k, ref)) render(); });
    const inp = el.querySelector('#cpSay'), send = () => { const v = inp.value; inp.value = ''; say(v); };
    el.querySelectorAll('[data-cpsay]').forEach(b => b.onclick = send); if (inp) inp.onkeydown = e => { if (e.key === 'Enter') send(); };
  }
  function open(t) {
    if (!P()) return; if (t === 'riv' || t === 'sum') tab = t; if (!document.getElementById('coopSummitCss')) { const c = document.createElement('style'); c.id = 'coopSummitCss'; c.textContent = CSS; document.head.appendChild(c); }
    try { dailyTick(); } catch (e) { console.warn('coop-pres', e); }
    if (!el) { el = document.createElement('div'); el.id = 'coopSummit'; el.innerHTML = `<div class="tb"><h2>🌐 Срещата на върха</h2><span id="cpTabs" style="display:flex;gap:6px"></span><button data-cpx="1">✕</button></div><div class="bd"></div>`; document.body.appendChild(el); el.querySelector('[data-cpx]').onclick = close; window.__overlay3d = (window.__overlay3d || 0) + 1; }
    render();
  }
  function close() { if (!el) return; el.remove(); el = null; window.__overlay3d = Math.max(0, (window.__overlay3d || 1) - 1); }
  // бутонът в горната лента на президентския прозорец (president.js) — само когато и партньорът е президент
  const btn = () => ok() ? `<button data-psum="1">🌐 Срещата на върха${partner().p.tq.some(t => t.mine && t.st === 'prop' && !(P().treaties || {})[t.id]) || riv()?.badge?.() ? ' <b style="color:#ffd54a">•</b>' : ''}</button>` : '';
  return { snap, taken, clash, dailyTick, btn, open, close, ok, partner, propose, accept: id => answer(id, true), decline: id => answer(id, false), isOpen: () => !!el };
}
