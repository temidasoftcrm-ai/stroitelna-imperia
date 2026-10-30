// coopriv.js — ⚖️ флаг 'coop-riv-core': режимът „Конкуренти“ в партньорството, ЧАСТ 1 (дизайнът на собственика: coop-rivals-plan).
// Двамата партньори избират ЗАЕДНО как играят: 🤝 Съюзници, ⚖️ Конкуренти (част 1 — само той се избира) или ⚔️ Съперници (скоро —
// само ако и двамата разрешат враждебен режим). Сървърът е единственият източник: таблица coop.rivalry (миграция coop6_rivals),
// RPC coop_riv_mode (propose | accept | decline) и coop_riv_status — пита се в coop.js tick заедно с другите coop_status* (без отделни заявки).
// Три отношения 0–100 (Доверие, Икономическа свързаност, Напрежение) — само се показват (в част 2–3 ще ги движат сделките и кризите).
// Държавният бюджет (S.pres.res) и парите на фирмата са отделни и не се смесват — картата „🏛️ / 🏢“ го показва.
// ЧАСТ 2 (флаг 'coop-riv-deals'): сделки с до 3 насрещни — 🔌 енергийният коридор (8 млрд. €: дялове, приход, срок; вноските са ОБЕЩАНИЯ —
// всеки вади своя дял от държавния бюджет у себе си, сървърът проверява спрямо pres.res в снимката) и 🔁 размяна на показатели (без пари).
// Таймерите са на сървъра и текат само докато отговарящият е онлайн („⏸ паузирано“). Натиск у дома (доверието в своята държава) — „Обясни“
// го намалява наполовина, „Поискай компенсация“ попълва насрещно. „🕊️ Върни се на масата“ при напрежение над 60. Ефектите у мен — веднъж
// на сделка (S.pres.rivD).
// ЧАСТ 3 (флаг 'coop-riv-world'): сървърът пуска събития (най-много едно на 6 ч онлайн време): 🏗️ търг в трета държава (цена / срок /
// качество или обща оферта; точките смята сървърът — и отношенията на държавата с теб от снимката) и 🌊 криза (земетресение затваря
// пристанище: общи кораби — по-голям ефект и доверие, сам — видимост и „възстановяване“, но + напрежение). Парите — само у мен, от
// S.pres.res (печалбата от търга, разходът за корабите), веднъж на събитие (S.pres.rivE). Без флага — нищо (празен обект).
// Демото: фалшив партньор (window.__coopShared.riv) и фалшиво rpc в паметта — само когато няма истинско партньорство.
// deps: { S(), pres, coop() → обектът от coop.js, coopPres() → coopres.js, money() → парите на фирмата, toast(text, kind), save(), fmt(n) }
import { feature } from './lab/feature.js';
import { t as tr } from './i18n.js';
import { POL } from './worldpol.js';

const ON = feature('coop-riv-core'), DEALS = feature('coop-riv-deals'), WORLD = feature('coop-riv-world');
const CNM = { SGP: 'Сингапур', NLD: 'Нидерландия' }, cnm = iso => POL[iso]?.nm || CNM[iso] || iso;
const PROJ = { port: '⚓ пристанище', rail: '🚆 железница', grid: '⚡ енергийна мрежа', water: '💧 водопровод' };
const IND = { econ: ['📈', 'Икономика'], services: ['🏥', 'Услуги'], energy: ['⚡', 'Енергия'], security: ['🛡️', 'Сигурност'], trust: ['🤝', 'Доверие'] };
const PCT = Array.from({ length: 17 }, (_, i) => 10 + i * 5);   // 10, 15 … 90 — и предложенията за компенсация (±10) винаги имат стойност в списъка
const MEGA_COST = 8e9, MEGA_GAIN = 1.5, DAY_S = 60;   // приходът на коридора = цената × 1,5 при изпълнение; 1 ден от срока = 60 s онлайн време на сървъра
const MODES = { none: ['⚪', 'Без режим'], allies: ['🤝', 'Съюзници'], comp: ['⚖️', 'Конкуренти'], rival: ['⚔️', 'Съперници'] };
const MODE_HOW = {
  none: 'Партньорството работи както досега.',
  allies: 'Общи цели, помагате си без условия.',
  comp: 'Всеки гради своята империя; сделки, търгове и кризи — с правила и с отношения, които се помнят.',
  rival: 'Враждебен режим — само ако и двамата го разрешите.',
};
const SELECTABLE = new Set(['comp', 'none']);   // част 1: само „Конкуренти“ (и връщане без режим)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cl = v => Math.max(0, Math.min(100, Math.round(+v || 0)));

// 🧼 отговорът на сървъра (или на фалшивото rpc): само познати режими, числата — в граници
export function cleanRiv(r) {
  if (!r || typeof r !== 'object' || !r.ok || !r.active) return null;
  const m = v => (MODES[v] ? v : 'none'), P = r.pending && typeof r.pending === 'object' && MODES[r.pending.mode] ? { mode: r.pending.mode, mine: !!r.pending.mine } : null;
  const n = (x, a, b) => Number.isFinite(+x) ? Math.max(a, Math.min(b, +x)) : a, ST = ['prop', 'counter', 'acc', 'dec', 'active', 'done', 'broken', 'expired'];
  const terms = (k, t) => { t = t && typeof t === 'object' ? t : {}; return k === 'mega' ? { cost: MEGA_COST, mine: n(t.mine, 10, 90) | 0, rev: n(t.rev, 10, 90) | 0, days: n(t.days, 10, 60) | 0 }
    : { give: IND[t.give] ? t.give : 'econ', get: IND[t.get] ? t.get : 'services', pts: n(t.pts, 1, 10) | 0, days: n(t.days, 10, 90) | 0 }; };
  const deals = (Array.isArray(r.deals) ? r.deals : []).filter(d => d && (d.kind === 'mega' || d.kind === 'trade') && Number.isFinite(+d.id)).slice(0, 20).map(d => ({ id: +d.id, kind: d.kind, terms: terms(d.kind, d.terms), round: n(d.round, 0, 3) | 0,
    status: ST.includes(d.status) ? d.status : 'expired', byMe: !!d.by_me, ownerMe: !!d.owner_me, myTurn: !!d.my_turn, resp: n(d.resp_left_s, 0, 1e6) | 0, due: n(d.due_left_s, 0, 1e7) | 0, paused: !!d.paused,
    breaking: !!d.breaking, breakMe: !!d.break_me, breakLeft: n(d.break_left_s, 0, 1e5) | 0, pledge: n(d.my_pledge, 0, MEGA_COST) }));
  const events = (Array.isArray(r.events) ? r.events : []).filter(e => e && (e.kind === 'tender' || e.kind === 'crisis') && Number.isFinite(+e.id)).slice(0, 6).map(e => { const dt = e.data && typeof e.data === 'object' ? e.data : {}, R = e.result && typeof e.result === 'object' ? e.result : null, mb = e.my_bid && typeof e.my_bid === 'object' ? e.my_bid : null, tb = e.their_bid && typeof e.their_bid === 'object' ? e.their_bid : null;
    return { id: +e.id, kind: e.kind, iso: /^[A-Z]{3}$/.test(e.iso) ? e.iso : 'XXX', budget: n(dt.budget, 0, 1e11), proj: PROJ[dt.proj] ? dt.proj : 'rail', port: String(dt.port || '').slice(0, 30), sev: n(dt.sev, 1, 5) | 0, open: e.status === 'open', left: n(e.left_s, 0, 1e5) | 0,
      my: mb && { price: n(mb.price, 60, 140) | 0, days: n(mb.days, 20, 180) | 0, q: n(mb.q, 1, 5) | 0, joint: !!mb.joint, mode: ['pool', 'solo', 'skip'].includes(mb.mode) ? mb.mode : null, ships: n(mb.ships, 0, 50) | 0 }, theirIn: !!e.their_in,
      their: tb && { price: n(tb.price, 60, 140) | 0, joint: !!tb.joint, mode: ['pool', 'solo', 'skip'].includes(tb.mode) ? tb.mode : null },
      res: R && { meWon: !!R.me_won, joint: !!R.joint, none: R.winner === null && !R.outcome, outcome: ['pool', 'solo', 'none'].includes(R.outcome) ? R.outcome : null, iActed: !!R.i_acted, effect: n(R.effect, 0, 100) | 0, ships: Number.isFinite(+R.ships) ? +R.ships | 0 : null },
      qCap: n(e.q_cap, 1, 5) | 0, shipsMax: n(e.ships_max, 0, 500) | 0 }; });
  const C = r.contrib && typeof r.contrib === 'object' ? r.contrib : {}, contrib = { dipMe: n(C.dip_me, 0, 1e6) | 0, dipThem: n(C.dip_them, 0, 1e6) | 0, rebMe: n(C.reb_me, 0, 1e6) | 0, rebThem: n(C.reb_them, 0, 1e6) | 0 };
  return { events, contrib, mode: m(r.mode), pending: P, hostileMe: !!r.hostile_me, hostileThem: !!r.hostile_them, trust: cl(r.trust ?? 50), interdep: cl(r.interdep ?? 20), tension: cl(r.tension ?? 10), deals, partnerOnline: r.partner_online !== false, calmOk: r.calm_ok !== false };
}

export function createCoopRival(deps) {
  const NO = { ok: () => false, state: () => null, html: () => '', bind() { }, badge: () => false, dailyTick() { } };
  if (!ON) return NO;
  const S = () => deps.S();
  const told = new Set();
  let busy = false;

  // 🎭 фалшивият партньор (Лабораторията): window.__coopShared.riv; rpc — в паметта, партньорът отговаря след ~2 s
  const fake = () => { let c = null; try { c = deps.coop?.()?.state?.(); } catch { } return !(c?.pair?.status === 'active') && !!window.__coopShared?.riv; };
  function fakeRpc(fn, a) {
    const R = window.__coopShared.riv; R.ok = true; R.active = true;
    if (fn === 'coop_riv_mode') {
      if (a.p_action === 'propose') { if (a.p_mode === R.mode) return { ok: false, msg: 'Този режим вече е избран.' }; if (a.p_mode === 'rival') return { ok: false, msg: 'Съперници — само ако и двамата са разрешили враждебен режим.' };
        R.pending = { mode: a.p_mode, mine: true }; if (R.autoAccept !== false) setTimeout(() => { if (R.pending?.mine) { R.mode = R.pending.mode; R.pending = null; deps.toast(`⚖️ ${pname()} прие: ${label(R.mode)}`, 'good'); refresh(); } }, 2000); }
      else if (a.p_action === 'accept') { if (!R.pending || R.pending.mine) return { ok: false, msg: 'Няма предложение от партньора.' }; R.mode = R.pending.mode; R.pending = null; }
      else if (a.p_action === 'decline') R.pending = null;
    }
    if (fn === 'coop_riv_propose' || fn === 'coop_riv_act') fakeDeal(R, fn, a);
    if (fn === 'coop_riv_bid') { const er = fakeBid(R, a); if (er) return er; }
    return { ...R, partner_online: R.partnerOnline !== false, deals: (R.deals || []).map(d => ({ ...d, paused: (d.status === 'prop' || d.status === 'counter') && d.by_me && R.partnerOnline === false })) };
  }
  const pname = () => { let c = null; try { c = deps.coop?.()?.state?.(); } catch { } return esc((c?.partner?.snap?.name || window.__coopShared?.name || 'партньора')).slice(0, 24); };
  const label = m => `${MODES[m][0]} ${tr(MODES[m][1])}`;

  // 📡 състоянието: истинското идва с coop.js tick (coop_riv_status); във фалшивото — от паметта
  function state() {
    if (fake()) return cleanRiv(fakeRpc('coop_riv_status', {}));
    try { return cleanRiv(deps.coop?.()?.riv?.()); } catch { return null; }
  }
  const ok = () => !!state();
  async function call(fn, args) {
    if (fake()) return fakeRpc(fn, args);
    const c = deps.coop?.(); if (!c?.rivRpc) return { ok: false, msg: 'Партньорството не е свързано.' };
    try { return await c.rivRpc(fn, args); } catch (e) { return { ok: false, msg: String(e?.message || e) }; }
  }
  // след действие — веднага ново състояние (истинското: coop.tick), после прерисуване на екрана
  function refresh() { try { if (!fake()) deps.coop?.()?.tick?.(); } catch { } setTimeout(() => { try { deps.coopPres?.()?.isOpen?.() && deps.coopPres().open(); } catch { } }, fake() ? 0 : 1500); }
  async function act(action, mode) {
    if (busy) return; busy = true;
    try {
      const r = await call('coop_riv_mode', { p_action: action, p_mode: mode || null });
      if (!r || r.ok === false) { deps.toast(`⚖️ ${r?.msg || 'Не стана — опитай пак.'}`, 'bad'); return; }
      deps.toast(action === 'propose' ? `📨 Предложи на ${pname()}: ${label(mode)} — режимът се сменя, щом приеме.` : action === 'accept' ? `⚖️ Режимът е сменен: ${label(cleanRiv({ ...r, ok: true, active: true })?.mode || 'none')}` : '✖ Предложението е отказано.', action === 'decline' ? '' : 'good');
    } finally { busy = false; refresh(); }
  }

  // 📅 веднъж на ден (и при tick): ново предложение от партньора → тост (веднъж)
  function dailyTick() {
    const r = state(); if (DEALS && r) try { dealEffects(r); } catch (e) { console.warn('coop-riv-deals', e); }
    if (WORLD && r) try { worldEffects(r); } catch (e) { console.warn('coop-riv-world', e); }
    if (!r?.pending || r.pending.mine) return; const k = r.pending.mode;
    if (told.has(k)) return; told.add(k); deps.toast(`⚖️ ${pname()} предлага режим: ${label(k)} — виж „Срещата на върха“ → „⚖️ Конкуренти“`, 'good', () => { try { deps.coopPres().open('riv'); } catch { } });
  }
  const badge = () => { const r = state(); return !!(r?.pending && !r.pending.mine) || !!(DEALS && r?.deals?.some(d => d.myTurn || (d.breaking && !d.breakMe))) || !!(WORLD && r?.events?.some(e => e.open && !e.my)); };

  // ---- ⚖️ табът на екрана „Срещата на върха“ (coopres.js render)
  const barC = { trust: '#3fae6b', interdep: '#4fc3f7', tension: '#ff6b6b' };
  const bar = (v, col) => `<div class="bar"><i style="width:${cl(v)}%;background:${col}"></i></div>`;
  function html() {
    const r = state(), s = S(); const f = n => deps.fmt ? deps.fmt(Math.round(n || 0)) : Math.round(n || 0);
    if (!r) return `<div class="cd w">${tr('⚖️ Режимите се появяват, щом партньорството е свързано със сървъра (миграция coop6).')}</div>`;
    const pn = pname();
    let h = `<div class="cd w"><b>⚖️ ${tr('Режим на партньорството')}</b> <span class="m">— ${tr('сменя се само ако и двамата сте съгласни')}</span>`
      + `<div style="font-size:20px;font-weight:800;margin:6px 0 2px">${label(r.mode)}</div><div class="m">${tr(MODE_HOW[r.mode])}</div>`;
    if (r.pending && !r.pending.mine) h += `<div class="row" style="border:1px solid #ffd54a;border-radius:9px;padding:6px"><span style="flex:1">📨 ${pn} ${tr('предлага')}: <b>${label(r.pending.mode)}</b></span><button class="y" data-rvacc="1">✓ ${tr('Приеми')}</button><button data-rvdec="1">✖ ${tr('Отказвам')}</button></div>`;
    if (r.pending && r.pending.mine) h += `<div class="row"><span class="m" style="flex:1">⏳ ${tr('Чака отговор от')} ${pn}: ${label(r.pending.mode)}</span><button data-rvdec="1">↩ ${tr('Оттегли')}</button></div>`;
    h += `<div class="row">` + Object.keys(MODES).filter(k => k !== r.mode).map(k => {
      const can = SELECTABLE.has(k) && !r.pending, soon = !SELECTABLE.has(k);
      return `<button ${can ? `class="y" data-rvprop="${k}"` : 'disabled style="opacity:.5;cursor:default"'}>${label(k)}${soon ? ` · ${tr('скоро')}` : ''}</button>`;
    }).join('') + `</div><div class="m" style="margin-top:6px">⚔️ ${tr('Съперници — само ако и двамата разрешите враждебен режим (скоро). Винаги има път назад.')}</div></div>`;
    // три отношения
    const rows = [['trust', '🤝', 'Доверие', 'расте със спазени обещания'], ['interdep', '🔗', 'Икономическа свързаност', 'общи сделки и вериги'], ['tension', '⚡', 'Напрежение', 'спорове и нарушени договори']];
    h += `<div class="cd"><b>📊 ${tr('Отношенията с')} ${pn}</b>` + rows.map(([k, ico, n, why]) => `<div class="m">${ico} ${tr(n)}: <b style="color:#e6edf6">${r[k]}</b> <span>· ${tr(why)}</span></div>${bar(r[k], barC[k])}`).join('')
      + `<div class="m">${tr('Отношенията се пазят на сървъра — еднакви и за двамата.')}</div></div>`;
    // държавата и фирмата — отделни пари
    const res = s?.pres?.res, cash = deps.money ? deps.money() : 0;
    h += `<div class="cd"><b>💶 ${tr('Две отделни каси')}</b><div class="row" style="align-items:stretch">`
      + `<div style="flex:1;min-width:140px;border:1px solid #2d3f60;border-radius:9px;padding:8px"><div class="m">🏛️ ${tr('Държавен бюджет')}</div><div style="font-size:18px;font-weight:800">${res == null ? '—' : f(res) + ' €'}</div><div class="m">${tr('само за държавата: помощ, договори, кризи')}</div></div>`
      + `<div style="flex:1;min-width:140px;border:1px solid #2d3f60;border-radius:9px;padding:8px"><div class="m">🏢 ${tr('Фирма')}</div><div style="font-size:18px;font-weight:800">${f(cash)} €</div><div class="m">${tr('строежи, техника, холдинг')}</div></div></div>`
      + `<div class="m" style="margin-top:6px">${tr('Двете каси никога не се смесват — договорите между държавите не местят пари.')}</div></div>`;
    if (DEALS) { try { dealEffects(r); } catch (e) { console.warn('coop-riv-deals', e); } h += dealsHtml(r); }
    if (WORLD) { try { worldEffects(r); } catch (e) { console.warn('coop-riv-world', e); } h += worldHtml(r); }
    return h;
  }
  function bind(el) {
    el.querySelectorAll('[data-rvprop]').forEach(b => b.onclick = () => act('propose', b.dataset.rvprop));
    el.querySelectorAll('[data-rvacc]').forEach(b => b.onclick = () => act('accept'));
    el.querySelectorAll('[data-rvdec]').forEach(b => b.onclick = () => act('decline'));
    if (DEALS) bindDeals(el);
    if (WORLD) bindWorld(el);
  }

  // ---- 🤝 ЧАСТ 2: сделките (coop-riv-deals)
  const mySide = d => d.kind === 'mega' ? { share: d.byMe ? d.terms.mine : 100 - d.terms.mine, rev: d.byMe ? d.terms.rev : 100 - d.terms.rev } : null;
  const gainOf = d => d.byMe ? { up: d.terms.get, down: d.terms.give } : { up: d.terms.give, down: d.terms.get };   // кой показател расте/пада у мен
  function home(d) {   // 🏠 натискът у дома: промяна в доверието на моята държава, ако сделката се приеме
    if (d.kind === 'mega') { const sh = mySide(d).share; return sh > 50 ? -Math.ceil((sh - 50) / 10) : 1; }
    return ['security', 'energy'].includes(gainOf(d).down) ? -2 : -1;
  }
  const D = () => { const p = S()?.pres; if (!p) return null; p.rivD = p.rivD || {}; return p.rivD; };
  const termsTxt = d => d.kind === 'mega'
    ? `🔌 ${tr('Енергиен коридор')} · ${f(MEGA_COST)} € · ${tr('ти плащаш')} ${mySide(d).share}% (${f(MEGA_COST * mySide(d).share / 100)} €) · ${tr('твоят приход')} ${mySide(d).rev}% · ${d.terms.days} ${tr('дни')}`
    : `🔁 ${tr('Размяна')}: ${tr('даваш')} ${IND[gainOf(d).down][0]} ${tr(IND[gainOf(d).down][1])}, ${tr('получаваш')} ${IND[gainOf(d).up][0]} ${tr(IND[gainOf(d).up][1])} +${d.terms.pts} · ${d.terms.days} ${tr('дни')}`;
  const f = n => deps.fmt ? deps.fmt(Math.round(n || 0)) : Math.round(n || 0);
  const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16)));
  // условията от формата → от моята гледна точка (аз съм „by“)
  function formTerms(el, pre) {
    const v = id => el.querySelector(`#${pre}${id}`)?.value; const k = v('k');
    return k === 'mega' ? { k, t: { mine: +v('sh'), rev: +v('rv'), days: +v('dy') } } : { k, t: { give: v('gv'), get: v('gt'), pts: +v('pt'), days: +v('dy') } };
  }
  async function dealCall(fn, args, ok) {
    if (busy) return; busy = true;
    try { const r = await call(fn, args); if (!r || r.ok === false) { deps.toast(`⚖️ ${r?.msg || 'Не стана — опитай пак.'}`, 'bad'); return; } if (ok) deps.toast(ok, 'good'); }
    finally { busy = false; refresh(); }
  }
  const propose = (k, t) => dealCall('coop_riv_propose', { p_req: uid(), p_kind: k, p_terms: t }, `📨 ${tr('Предложението е изпратено на')} ${pname()}.`);
  const dealAct = (id, action, t) => dealCall('coop_riv_act', { p_deal: id, p_action: action, p_terms: t || null },
    { accept: `🤝 ${tr('Сделката е в сила.')}`, counter: `📨 ${tr('Насрещното предложение е изпратено.')}`, decline: `✖ ${tr('Отказа.')}`, withdraw: `↩ ${tr('Оттегли предложението.')}`, break: `⚠️ ${tr('Разваляне след 10 мин — партньорът е уведомен; можеш да се откажеш.')}`, unbreak: `✓ ${tr('Сделката остава.')}`, calm: `🕊️ ${tr('Върнахте се на масата: −15 напрежение, +2 доверие.')}` }[action]);

  // 📅 ефектите у мен — веднъж на сделка: при влизане в сила, при изпълнение и при разваляне
  function dealEffects(r) {
    const p = S()?.pres, M = D(); if (!p || !M || !r) return false; let ch = false;
    for (const d of r.deals) {
      const m = M[d.id] = M[d.id] || {};
      if (['active', 'done', 'broken'].includes(d.status) && !m.a) {   // влезе в сила
        m.a = 1; ch = true; const hd = home(d) * (m.ex ? 0.5 : 1); p.ind.trust = cl(p.ind.trust + hd);
        if (d.kind === 'mega') { p.res = Math.max(0, (p.res || 0) - d.pledge); deps.toast(`🔌 ${tr('Коридорът започна')}: −${f(d.pledge)} € ${tr('от държавния бюджет')} (${tr('обещанието ти')})`, 'good'); }
        else { const g = gainOf(d); p.ind[g.up] = cl(p.ind[g.up] + d.terms.pts); p.ind[g.down] = cl(p.ind[g.down] - Math.ceil(d.terms.pts / 2)); deps.toast(`🔁 ${tr('Размяната е в сила')}: ${IND[g.up][0]} +${d.terms.pts}, ${IND[g.down][0]} −${Math.ceil(d.terms.pts / 2)}`, 'good'); }
      }
      if (d.status === 'done' && !m.z) { m.z = 1; ch = true; if (d.kind === 'mega') { const g = MEGA_COST * MEGA_GAIN * mySide(d).rev / 100; p.res = (p.res || 0) + g; deps.toast(`🔌 ${tr('Коридорът е готов')}: +${f(g)} € ${tr('приход за държавата')}`, 'good'); } else deps.toast(`✅ ${tr('Размяната е изпълнена')}`, 'good'); }
      if (d.status === 'broken' && !m.z) { m.z = 1; ch = true;
        if (d.breakMe) { if (d.kind === 'trade') { const g = gainOf(d); p.ind[g.up] = cl(p.ind[g.up] - d.terms.pts); } deps.toast(`💔 ${tr('Ти развали сделката — доверието пада.')}`, 'bad'); }
        else { if (d.kind === 'mega') p.res = (p.res || 0) + d.pledge; deps.toast(`💔 ${pname()} ${tr('развали сделката')}${d.kind === 'mega' ? ` — ${tr('обещанието ти се връща')}: +${f(d.pledge)} €` : ''}`, 'bad'); } }
      if (d.status === 'active' && d.kind === 'trade' && m.day !== S()?.day) { m.day = S()?.day; const g = gainOf(d); p.ind[g.up] = cl(p.ind[g.up] + 0.3); }   // активната размяна „плаща“ всеки ден
      if (d.myTurn && !m.told) { m.told = 1; deps.toast(`⚖️ ${pname()}: ${d.round ? tr('насрещно предложение') : tr('ново предложение')} — ${termsTxt(d)}`, 'good', () => { try { deps.coopPres().open('riv'); } catch { } }); }
      if (d.breaking && !d.breakMe && !m.wb) { m.wb = 1; deps.toast(`⚠️ ${pname()} ${tr('разваля сделка — след 10 мин')}: ${termsTxt(d)}`, 'bad'); }
    }
    const ids = new Set(r.deals.map(d => d.id)); for (const k of Object.keys(M)) if (!ids.has(+k) && M[k].z) delete M[k];   // само последните 20
    if (ch) deps.save(); return ch;
  }

  // 🎭 фалшивият партньор: сделките в паметта (насрещно на първото мега предложение, после приема)
  function fakeDeal(R, fn, a) {
    R.deals = R.deals || []; const mk = (k, t, byMe, round, st) => ({ id: (R.nid = (R.nid || 100) + 1), kind: k, terms: t, round, status: st, by_me: byMe, owner_me: byMe, my_turn: !byMe && (st === 'prop' || st === 'counter'), resp_left_s: 900, due_left_s: 0, my_pledge: 0 });
    const pl = d => d.kind === 'mega' ? MEGA_COST * (d.by_me ? d.terms.mine : 100 - d.terms.mine) / 100 : 0;
    if (fn === 'coop_riv_propose') { const d = mk(a.p_kind, { ...(a.p_kind === 'mega' ? { cost: MEGA_COST } : {}), ...a.p_terms }, true, 0, 'prop'); R.deals.unshift(d);
      if (R.autoAccept !== false) setTimeout(() => { if (d.status !== 'prop') return;
        if (d.kind === 'mega') { d.terms = { ...d.terms, mine: Math.max(10, (100 - d.terms.mine) - 10), rev: Math.min(90, (100 - d.terms.rev) + 10) };   /* партньорът (вече „by“) иска да плаща по-малко и да взема повече */ d.by_me = false; d.round = 1; d.status = 'counter'; d.my_turn = true; deps.toast(`📨 ${pname()} ${tr('прати насрещно предложение')}`, 'good'); }
        else { d.status = 'active'; d.due_left_s = d.terms.days * DAY_S; d.my_pledge = pl(d); R.trust = Math.min(100, (R.trust || 50) + 2); deps.toast(`🤝 ${pname()} ${tr('прие сделката')}`, 'good'); }
        refresh(); }, 2000); }
    else if (fn === 'coop_riv_act') { const d = R.deals.find(x => x.id === a.p_deal);
      if (a.p_action === 'calm') { R.tension = Math.max(0, R.tension - 15); R.trust = Math.min(100, R.trust + 2); R.calm_ok = false; return; }
      if (!d) return;
      if (a.p_action === 'accept') { d.status = 'active'; d.my_turn = false; d.due_left_s = d.terms.days * DAY_S; d.my_pledge = pl(d); R.trust = Math.min(100, R.trust + 2); }
      if (a.p_action === 'decline' || a.p_action === 'withdraw') { if (a.p_action === 'decline' && d.round > 0) R.tension = Math.min(100, R.tension + 6); d.status = 'dec'; d.my_turn = false; }
      if (a.p_action === 'counter') { d.terms = { ...d.terms, ...a.p_terms }; d.by_me = true; d.round++; d.status = 'counter'; d.my_turn = false;
        if (R.autoAccept !== false) setTimeout(() => { if (d.status === 'counter' && d.by_me) { d.status = 'active'; d.due_left_s = d.terms.days * DAY_S; d.my_pledge = pl(d); R.trust = Math.min(100, R.trust + 2); deps.toast(`🤝 ${pname()} ${tr('прие насрещното')}`, 'good'); refresh(); } }, 2000); }
      if (a.p_action === 'break') { d.breaking = true; d.break_me = true; d.break_left_s = 600; }
      if (a.p_action === 'unbreak') { d.breaking = false; d.break_me = false; }
    }
  }

  const ST_NM = { prop: '📨 предложение', counter: '↔️ насрещно', acc: '✅ приета', dec: '✖ отказана', active: '🟢 в сила', done: '✅ изпълнена', broken: '💔 развалена', expired: '⌛ изтекла' };
  function dealsHtml(r) {
    const M = D() || {}, opt = (sel, keys) => keys.map(k => `<option value="${k}"${k === sel ? ' selected' : ''}>${IND[k][0]} ${tr(IND[k][1])}</option>`).join('');
    const form = (pre, kind, v = {}, fixed = false) => `<div class="row"><select id="${pre}k"${fixed ? ' disabled' : ''}><option value="mega"${kind === 'mega' ? ' selected' : ''}>🔌 ${tr('Енергиен коридор (8 млрд. €)')}</option><option value="trade"${kind === 'trade' ? ' selected' : ''}>🔁 ${tr('Размяна на показатели')}</option></select></div>`
      + (kind === 'mega' ? `<div class="row"><span class="m">${tr('Ти плащаш')}</span><select id="${pre}sh">${PCT.map(x => `<option${x === (v.sh ?? 50) ? ' selected' : ''}>${x}</option>`).join('')}</select>% <span class="m">${tr('твоят приход')}</span><select id="${pre}rv">${PCT.map(x => `<option${x === (v.rv ?? 50) ? ' selected' : ''}>${x}</option>`).join('')}</select>% <span class="m">${tr('срок')}</span><select id="${pre}dy">${[10, 20, 30, 45, 60].map(x => `<option${x === (v.dy ?? 30) ? ' selected' : ''}>${x}</option>`).join('')}</select> ${tr('дни')}</div>`
        : `<div class="row"><span class="m">${tr('Даваш')}</span><select id="${pre}gv">${opt(v.gv || 'energy', Object.keys(IND))}</select><span class="m">${tr('получаваш')}</span><select id="${pre}gt">${opt(v.gt || 'services', Object.keys(IND))}</select><span class="m">+</span><select id="${pre}pt">${[1, 2, 3, 5, 8, 10].map(x => `<option${x === (v.pt ?? 3) ? ' selected' : ''}>${x}</option>`).join('')}</select><span class="m">${tr('срок')}</span><select id="${pre}dy">${[10, 30, 60, 90].map(x => `<option${x === (v.dy ?? 30) ? ' selected' : ''}>${x}</option>`).join('')}</select> ${tr('дни')}</div>`);
    let h = `<div class="cd w"><b>🤝 ${tr('Сделки с')} ${pname()}</b> <span class="m">— ${tr('до 3 насрещни предложения; таймерите текат само докато отговарящият е онлайн')}${r.partnerOnline ? '' : ` · <b style="color:#ffb347">${tr('партньорът е офлайн')}</b>`}</span>`;
    if (r.tension > 60) h += `<div class="row" style="border:1px solid #4fc3f7;border-radius:9px;padding:6px"><span style="flex:1">⚡ ${tr('Напрежението е високо')} (${r.tension})</span><button class="y" data-rvcalm="1"${r.calmOk ? '' : ' disabled'}>🕊️ ${tr('Върни се на масата')}</button></div>`;
    if (r.mode !== 'comp' && r.mode !== 'rival') return h + `<div class="m">${tr('Сделките са в режим „⚖️ Конкуренти“ — изберете го заедно горе.')}</div></div>`;
    for (const d of r.deals.slice(0, 8)) {
      const m = M[d.id] || {}, hd = home(d), open = d.status === 'prop' || d.status === 'counter';
      h += `<div style="border:1px solid ${d.myTurn ? '#ffd54a' : '#2d3f60'};border-radius:9px;padding:7px;margin-top:6px"><div><b>${termsTxt(d)}</b></div><div class="m">${tr(ST_NM[d.status])}${d.round ? ` · ${tr('кръг')} ${d.round}/3` : ''}${d.byMe && open ? ` · ${tr('чака')} ${pname()}` : ''}`
        + (open ? ` · ⏱ ${mmss(d.resp)}${d.paused ? ` · <b style="color:#ffb347">⏸ ${tr('паузирано — партньорът е офлайн')}</b>` : ''}` : '')
        + (d.status === 'active' ? ` · ${tr('остават')} ${Math.ceil(d.due / DAY_S)} ${tr('дни')}` : '') + (d.breaking ? ` · <b style="color:#ff6b6b">⚠️ ${tr('разваляне след')} ${mmss(d.breakLeft)}</b>` : '') + `</div>`;
      if (open && d.myTurn) {
        h += `<div class="m">🏠 ${tr('Натиск у дома')}: ${tr('доверие')} ${hd > 0 ? '+' : ''}${m.ex ? hd / 2 : hd}${m.ex ? ` (${tr('обяснено')})` : ''}</div><div class="row"><button class="y" data-rvd="accept" data-id="${d.id}">✓ ${tr('Приеми')}</button>`
          + (d.round < 3 ? `<button data-rvd="cform" data-id="${d.id}">↔️ ${tr('Насрещно')}</button><button data-rvd="comp" data-id="${d.id}">💬 ${tr('Поискай компенсация')}</button>` : '') + (hd < 0 && !m.ex ? `<button data-rvd="explain" data-id="${d.id}">🗣️ ${tr('Обясни')}</button>` : '') + `<button data-rvd="decline" data-id="${d.id}">✖ ${tr('Отказвам')}</button></div>`;
        if (cform === d.id) { const s0 = mySide(d) || {}; const pre = comp === d.id ? (d.kind === 'mega' ? { sh: Math.max(10, s0.share - 10), rv: Math.min(90, s0.rev + 10), dy: d.terms.days } : { gv: gainOf(d).down, gt: gainOf(d).up, pt: Math.min(10, d.terms.pts + 2), dy: d.terms.days }) : (d.kind === 'mega' ? { sh: s0.share, rv: s0.rev, dy: d.terms.days } : { gv: gainOf(d).down, gt: gainOf(d).up, pt: d.terms.pts, dy: d.terms.days });
          h += form(`rc${d.id}`, d.kind, pre, true) + `<div class="row"><button class="y" data-rvd="counter" data-id="${d.id}">📨 ${tr('Прати насрещно')}</button></div>`; }
      } else if (open && d.byMe) h += `<div class="row"><button data-rvd="withdraw" data-id="${d.id}">↩ ${tr('Оттегли')}</button></div>`;
      else if (d.status === 'active') h += d.breakMe ? `<div class="row"><button class="y" data-rvd="unbreak" data-id="${d.id}">✓ ${tr('Не я разваляй')}</button></div>` : !d.breaking ? `<div class="row"><button data-rvd="break" data-id="${d.id}">💔 ${tr('Развали')}</button><span class="m">${tr('доверие −12, напрежение +15 (след 10 мин)')}</span></div>` : '';
      h += `</div>`;
    }
    if (!r.deals.length) h += `<div class="m">${tr('Още няма сделки.')}</div>`;
    h += `<div style="border-top:1px solid #22304a;margin-top:8px;padding-top:6px"><b>➕ ${tr('Ново предложение')}</b>` + form('rn', nkind) + `<div class="row"><button class="y" data-rvd="propose">📨 ${tr('Предложи')}</button><span class="m">${tr('най-много 3 отворени и веднъж на час')}</span></div></div></div>`;
    return h;
  }
  let cform = null, comp = null, nkind = 'mega';
  function bindDeals(el) {
    const r = state(); if (!r) return; const nk = el.querySelector('#rnk'); if (nk) nk.onchange = () => { nkind = nk.value; refresh(); };
    el.querySelectorAll('[data-rvcalm]').forEach(b => b.onclick = () => dealAct(null, 'calm'));
    el.querySelectorAll('[data-rvd]').forEach(b => b.onclick = () => { const a = b.dataset.rvd, id = +b.dataset.id, d = r.deals.find(x => x.id === id);
      if (a === 'propose') { const { k, t } = formTerms(el, 'rn'); if (k === 'trade' && t.give === t.get) return deps.toast(tr('Избери два различни показателя.'), 'bad'); return propose(k, t); }
      if (a === 'cform' || a === 'comp') { cform = id; comp = a === 'comp' ? id : null; return refresh(); }
      if (a === 'explain') { const M = D(); if (M) { (M[id] = M[id] || {}).ex = 1; deps.save(); } deps.toast(`🗣️ ${tr('Обясни сделката у дома — натискът е наполовина.')}`, 'good'); return refresh(); }
      if (a === 'counter') { const { t } = formTerms(el, `rc${id}`); if (d?.kind === 'trade' && t.give === t.get) return deps.toast(tr('Избери два различни показателя.'), 'bad'); cform = null; comp = null; return dealAct(id, 'counter', t); }
      dealAct(id, a); });
  }

  // ---- 🌍 ЧАСТ 3: светът (coop-riv-world)
  const E = () => { const p = S()?.pres; if (!p) return null; p.rivE = p.rivE || {}; return p.rivE; };
  const evTitle = e => e.kind === 'tender' ? `🏗️ ${tr('Търг')}: ${tr(cnm(e.iso))} — ${tr(PROJ[e.proj])} · ${tr('бюджет')} ${f(e.budget)} €` : `🌊 ${tr('Земетресение')}: ${tr(e.port || cnm(e.iso))} ${tr('е затворено')} (${tr('сила')} ${e.sev})`;
  const SHIP_COST = 30e6, TENDER_MARGIN = 0.2;   // разходът за кораб в операцията и печалбата от спечелен търг (дял от офертата) — само у мен
  function worldEffects(r) {
    const p = S()?.pres, M = E(); if (!p || !M || !r) return false; let ch = false;
    for (const e of r.events) {
      const m = M[e.id] = M[e.id] || {};
      if (e.open && !m.told) { m.told = 1; ch = true; deps.toast(`🌍 ${tr('Ново събитие')}: ${evTitle(e)} — ${tr('виж „⚖️ Конкуренти“')}`, 'good', () => { try { deps.coopPres().open('riv'); } catch { } }); }
      if (!e.open && e.res && !m.z) { m.z = 1; ch = true;
        if (e.kind === 'tender') {
          if (e.res.meWon || e.res.joint) { const price = e.my?.price || 100, g = e.budget * price / 100 * TENDER_MARGIN * (e.res.joint ? 0.5 : 1); p.res = (p.res || 0) + g; p.ind.econ = cl(p.ind.econ + 2);
            deps.toast(`🏆 ${e.res.joint ? tr('Общата оферта спечели') : tr('Спечели търга')}: ${tr(cnm(e.iso))} · +${f(g)} € ${tr('за държавата')}`, 'good'); }
          else if (e.my) deps.toast(`✖ ${tr('Търгът в')} ${tr(cnm(e.iso))} ${tr('не е твой')}`, ''); }
        else if (e.res.iActed || e.res.outcome === 'pool' && e.my?.mode === 'pool') { const ships = Math.min(e.my?.ships || 0, e.shipsMax || 0), cost = ships * SHIP_COST; p.res = Math.max(0, (p.res || 0) - cost);
          p.ind.security = cl(p.ind.security + e.res.effect / 20); if (e.res.outcome === 'pool') p.ind.econ = cl(p.ind.econ + e.res.effect / 15); else p.ind.trust = cl(p.ind.trust + 2);
          deps.toast(`🌊 ${e.res.outcome === 'pool' ? tr('Общата операция отвори пристанището') : tr('Твоята операция помогна')}: ${tr('ефект')} ${e.res.effect}% · −${f(cost)} € ${tr('за корабите')}`, 'good'); }
      }
    }
    const ids = new Set(r.events.map(e => e.id)); for (const k of Object.keys(M)) if (!ids.has(+k) && M[k].z) delete M[k];
    if (ch) deps.save(); return ch;
  }
  // 🎭 фалшивият партньор: офертата му идва след 1 s (без да се вижда до затварянето)
  function fakeBid(R, a) {
    const e = (R.events || []).find(x => x.id === a.p_event); if (!e || e.status !== 'open') return { ok: false, msg: 'Събитието вече е затворено.' };
    e.my_bid = { ...a.p_bid }; if (!e.their_in) setTimeout(() => { e.their_in = true; refresh(); }, 1000); return null;
  }
  function worldHtml(r) {
    const c = r.contrib, opt = (arr, sel) => arr.map(x => `<option${x === sel ? ' selected' : ''}>${x}</option>`).join('');
    let h = `<div class="cd w"><b>🌍 ${tr('Свят')}</b> <span class="m">— ${tr('търгове в трети държави и кризи; сървърът пуска най-много едно събитие на 6 ч онлайн време')}</span>`
      + `<div class="m">🕊️ ${tr('Дипломация')}: ${tr('ти')} <b style="color:#e6edf6">${c.dipMe}</b> · ${pname()} <b style="color:#e6edf6">${c.dipThem}</b> &nbsp; 🏗️ ${tr('Възстановяване')}: ${tr('ти')} <b style="color:#e6edf6">${c.rebMe}</b> · ${pname()} <b style="color:#e6edf6">${c.rebThem}</b></div>`;
    if (r.mode !== 'comp' && r.mode !== 'rival') return h + `<div class="m">${tr('Събитията идват в режим „⚖️ Конкуренти“.')}</div></div>`;
    if (!r.events.length) h += `<div class="m">${tr('Още няма събития — първото идва след ~10 мин онлайн.')}</div>`;
    for (const e of r.events) {
      h += `<div style="border:1px solid ${e.open && !e.my ? '#ffd54a' : '#2d3f60'};border-radius:9px;padding:7px;margin-top:6px"><div><b>${evTitle(e)}</b></div>`;
      if (e.open) {
        h += `<div class="m">⏱ ${mmss(e.left)}${r.partnerOnline ? '' : ` · ${tr('тече, докато поне един е онлайн')}`} · ${e.theirIn ? `✅ ${pname()} ${tr('е подал оферта')}` : `⏳ ${pname()} ${tr('още не е подал')}`}${e.my ? ` · ${tr('твоята оферта е подадена (можеш да я смениш)')}` : ''}</div>`;
        const v = e.my || {}, pre = `rw${e.id}`;
        h += e.kind === 'tender'
          ? `<div class="row"><span class="m">${tr('Цена')}</span><select id="${pre}p">${opt([60, 70, 80, 90, 95, 100, 110, 120, 140], v.price ?? 100)}</select>% <span class="m">${tr('срок')}</span><select id="${pre}d">${opt([20, 40, 60, 90, 120, 180], v.days ?? 60)}</select> ${tr('дни')} <span class="m">${tr('качество')}</span><select id="${pre}q">${opt([1, 2, 3, 4, 5], v.q ?? Math.min(3, e.qCap))}</select><span class="m">(${tr('до')} ${e.qCap} ${tr('се брои')})</span><label class="m"><input type="checkbox" id="${pre}j"${v.joint ? ' checked' : ''}> 🤝 ${tr('обща оферта')}</label><button class="y" data-rwbid="${e.id}">📨 ${tr('Подай')}</button></div><div class="m">${tr('Точки: по-ниска цена, по-кратък срок, качество и отношенията на')} ${tr(cnm(e.iso))} ${tr('с теб. Обща — само ако и двамата я изберете (+10 точки, делите).')}</div>`
          : `<div class="row"><select id="${pre}m"><option value="pool"${v.mode === 'pool' ? ' selected' : ''}>🤝 ${tr('Общи кораби')}</option><option value="solo"${v.mode === 'solo' ? ' selected' : ''}>🚢 ${tr('Сам')}</option><option value="skip"${v.mode === 'skip' ? ' selected' : ''}>✖ ${tr('Не се включвам')}</option></select><span class="m">${tr('кораби')}</span><select id="${pre}s">${opt(Array.from({ length: Math.min(e.shipsMax, 20) + 1 }, (_, i) => i), Math.min(v.ships ?? e.shipsMax, e.shipsMax))}</select><span class="m">(${tr('имаш')} ${e.shipsMax}; ${f(SHIP_COST)} € ${tr('на кораб')})</span><button class="y" data-rwbid="${e.id}">📨 ${tr('Потвърди')}</button></div><div class="m">${tr('Общо — по-голям ефект, + доверие и свързаност; сам — „възстановяване“ за теб, но + напрежение.')}</div>`;
      } else if (e.res) {
        const t = e.kind === 'tender' ? (e.res.joint ? `🤝 ${tr('Общата оферта спечели')}` : e.res.meWon ? `🏆 ${tr('Ти спечели')}` : e.res.none ? `— ${tr('Без оферти')}` : `✖ ${pname()} ${tr('спечели')}`) + (e.their && !e.res.joint ? ` <span class="m">(${tr('неговата цена')} ${e.their.price}%)</span>` : '')
          : e.res.outcome === 'pool' ? `🤝 ${tr('Обща операция')} · ${e.res.ships} ${tr('кораба')} · ${tr('ефект')} ${e.res.effect}%` : e.res.outcome === 'solo' ? `🚢 ${tr('Самостоятелна операция')}${e.res.iActed ? ` (${tr('ти')})` : ''} · ${tr('ефект')} ${e.res.effect}%` : `— ${tr('Никой не помогна (−3 доверие)')}`;
        h += `<div class="m">${t}</div>`;
      }
      h += `</div>`;
    }
    return h + `</div>`;
  }
  function bindWorld(el) {
    el.querySelectorAll('[data-rwbid]').forEach(b => b.onclick = async () => { const id = +b.dataset.rwbid, pre = `rw${id}`, v = x => el.querySelector(`#${pre}${x}`), e = state()?.events.find(x => x.id === id); if (!e) return;
      const bid = e.kind === 'tender' ? { price: +v('p').value, days: +v('d').value, q: +v('q').value, joint: !!v('j').checked } : { mode: v('m').value, ships: +v('s').value };
      if (busy) return; busy = true;
      try { const r = await call('coop_riv_bid', { p_event: id, p_bid: bid, p_req: uid() }); if (!r || r.ok === false) deps.toast(`🌍 ${r?.msg || 'Не стана — опитай пак.'}`, 'bad'); else deps.toast(`📨 ${tr('Офертата е подадена.')}`, 'good'); }
      finally { busy = false; refresh(); } });
  }
  return { ok, state, html, bind, badge, dailyTick };
}
