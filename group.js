// group.js — корпоративната група: при старта играчът сам дава името на фирмата (и избира цвят/знак от 5-те стила);
// с всеки нов бизнес се основава дъщерно дружество („… Толроуд“, „… Рейл“, „… Оушън Експрес“, „… Флайеър“…). Старите продължават да печелят.
// Записът: S.brand = 'titan' (стилът), S.brandNm = 'Име' (по желание — иначе името на стила), S.group = { [sub]: денят на основаването }.
export const BRANDS = [
  { k: 'industrial', nm: 'Индустриал', col: '#ff9a2e', ico: '⚙️' },
  { k: 'titan', nm: 'Титан', col: '#4fc3f7', ico: '🗿' },
  { k: 'atlas', nm: 'Атлас', col: '#7dffa8', ico: '🌐' },
  { k: 'horizon', nm: 'Хоризон', col: '#ffd54a', ico: '🌅' },
  { k: 'imperial', nm: 'Империал', col: '#e57cff', ico: '👑' },
];
// дъщерните дружества по реда на отключване; open(c) → кога се основава, inc(c) → приход на ден, how — какво трябва
export const SUBS = [
  { k: 'con', ico: '🏗️', suf: 'Констръкшън', what: 'строителство', how: 'от началото', open: () => true, inc: c => c.finDaily() },
  { k: 'hw', ico: '🛣️', suf: 'Толроуд', what: 'магистрали и тол', how: 'първата готова магистрала', open: c => c.hwN() > 0, inc: c => c.toll() },
  { k: 'rail', ico: '🚆', suf: 'Рейл', what: 'железници', how: 'първата готова жп линия', open: c => c.railN() > 0, inc: c => c.flow('rail') },
  { k: 'sea', ico: '🚢', suf: 'Оушън Експрес', what: 'кораби и пристанища', how: 'първото пристанище', open: c => c.portN() > 0, inc: c => c.flow('sea') },
  { k: 'air', ico: '✈️', suf: 'Флайеър', what: 'авиация', how: 'първото летище', open: c => c.airN() > 0, inc: c => c.flow('air') },
  { k: 'oil', ico: '🛢️', suf: 'Петролиум', what: 'петрол и гориво', how: 'първото петролно находище (Азия)', open: c => c.oilN() > 0, inc: c => c.oilDaily() },
  { k: 'hotel', ico: '🏨', suf: 'Хотелс', what: 'хотели по света', how: 'офис ниво 10 в някой град (ерата на холдинга)', open: c => (c.hotelN ? c.hotelN() : 0) > 0, inc: c => c.hotelDaily ? c.hotelDaily() : 0 },
  { k: 'bank', ico: '🏦', suf: 'Банк', what: 'банка и кредити', how: 'основи банката (ерата на холдинга)', open: c => !!(c.bankOn && c.bankOn()), inc: c => c.bankDaily ? c.bankDaily() : 0 },
  { k: 'glob', ico: '🌍', suf: 'Глобъл Ризортс & Констръкшън', what: 'световна империя', how: 'ниво 20 — Световна империя', open: c => c.empire(), inc: () => 0, final: true },
];
export const brandOf = S => { const b = BRANDS.find(x => x.k === S?.brand); return b ? (S.brandNm ? { ...b, nm: S.brandNm } : b) : null; };
// името, което играчът пише: без знаци за HTML, до 24 знака, с главна буква
export const cleanBrand = s => { const t = String(s || '').replace(/[<>"'&`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24); return t ? t[0].toUpperCase() + t.slice(1) : ''; };
export const subName = (S, k) => { const b = brandOf(S), s = SUBS.find(x => x.k === k); return b && s ? `${b.nm} ${s.suf}` : ''; };
// името на групата горе: една фирма — „Титан Констръкшън“; повече — „Титан Груп“; накрая — „Титан Глобъл“
export function groupName(S) {
  const b = brandOf(S); if (!b) return '';
  const g = S.group || {}; if (g.glob) return `${b.nm} Глобъл`;
  return Object.keys(g).length > 1 ? `${b.nm} Груп` : `${b.nm} Констръкшън`;
}

// 🏛️ Ерата на холдинга (ниво 15): всяко дружество има ниво на развитие (+10% от прихода му на ниво, до 5) и директор (+15%).
// Бонусът се изплаща всеки ден като приход на холдинга. Записът: S.hold = { lv: { [sub]: n }, dir: { [sub]: 'име' } }.
export const HOLD_LV_MAX = 5, HOLD_LV_K = 0.10, HOLD_DIR_K = 0.15;
const DIRECTORS = ['Ивайло Петров', 'Мария Стоянова', 'Георги Николов', 'Елена Димитрова', 'Стефан Колев', 'Надя Иванова', 'Борис Тодоров', 'Вера Ангелова', 'Калин Маринов', 'Десислава Илиева'];

// deps: { S, econ, fmt, pop(key, cap, sub), toast, save, sound, …броячите от SUBS (hwN, railN, portN, airN, oilN, empire, toll, flow, finDaily, oilDaily) }
export function createGroup(deps) {
  const hold = () => { const S = deps.S(); S.hold = S.hold || { lv: {}, dir: {} }; return S.hold; };
  const subBy = k => SUBS.find(x => x.k === k);
  const bonusK = k => (hold().lv[k] || 0) * HOLD_LV_K + (hold().dir[k] ? HOLD_DIR_K : 0);
  const upCost = k => { const inc = subBy(k).inc(deps) || 0, L = hold().lv[k] || 0; return Math.round(Math.max(5e6, inc * 40) * (L + 1) / 1e5) * 1e5; };
  const dirCost = k => Math.round(Math.max(4e6, (subBy(k).inc(deps) || 0) * 45) / 1e5) * 1e5;
  const canManage = k => { const S = deps.S(); return !!(S.holding && (S.group || {})[k] && !subBy(k).final); };
  function upgrade(k) {
    if (!canManage(k) || (hold().lv[k] || 0) >= HOLD_LV_MAX) return; const c = upCost(k), e = deps.econ();
    if (!e.canAfford(c)) { deps.toast(`Нямаш ${deps.fmt(c)} €.`, 'bad'); return; }
    e.spend(c, 'покупка', `Холдинг: развитие на ${subName(deps.S(), k)}`); hold().lv[k] = (hold().lv[k] || 0) + 1;
    deps.toast(`🏛️ ${subName(deps.S(), k)} — ниво ${hold().lv[k]}: +${Math.round(bonusK(k) * 100)}% от прихода ѝ всеки ден.`, 'good'); deps.sound && deps.sound('upgrade'); deps.save();
  }
  function hire(k) {
    if (!canManage(k) || hold().dir[k]) return; const c = dirCost(k), e = deps.econ();
    if (!e.canAfford(c)) { deps.toast(`Нямаш ${deps.fmt(c)} €.`, 'bad'); return; }
    const used = new Set(Object.values(hold().dir)), nm = DIRECTORS.find(n => !used.has(n)) || DIRECTORS[0];
    e.spend(c, 'заплати', `Холдинг: директор на ${subName(deps.S(), k)}`); hold().dir[k] = nm;
    deps.toast(`👔 ${nm} е новият директор на ${subName(deps.S(), k)} (+${Math.round(HOLD_DIR_K * 100)}%).`, 'good'); deps.sound && deps.sound('buy'); deps.save();
  }
  // дневният бонус на холдинга от развитието и директорите
  const bonusOf = k => Math.round((subBy(k).inc(deps) || 0) * bonusK(k));
  const dailyBonus = () => { const S = deps.S(); if (!S?.holding) return 0; return SUBS.filter(s => (S.group || {})[s.k] && !s.final).reduce((a, s) => a + bonusOf(s.k), 0); };
  function dailyTick() { const b = dailyBonus(); if (b > 0) deps.econ().earn(b, 'холдинг', 'Холдинг: бонус от развитието и директорите'); return b; }
  function check(quiet = false) {
    const S = deps.S(); if (!S || !S.brand) return;
    const g = S.group = S.group || {}, b = brandOf(S);
    for (const s of SUBS) {
      if (g[s.k] || !s.open(deps)) continue;
      g[s.k] = S.day || 1;
      if (quiet || s.k === 'con') continue;
      if (s.final) deps.pop('empire', `👑 ${b.nm} Глобъл`, `От първия строеж до световна империя. Добре дошли в ${b.nm} Глобъл!`);
      else deps.pop('new-branch', `${s.ico} Нова дъщерна фирма: ${b.nm} ${s.suf}`, `${b.nm} ${s.suf} поема ${s.what}. Старите дружества в групата продължават да печелят.`);
      deps.sound && deps.sound('levelup');
    }
    deps.save();
  }
  function winHtml(extra = '') {
    const S = deps.S(), b = brandOf(S), g = S.group || {}, f = deps.fmt, H = S.holding;
    if (!b) return '<div class="card"><div class="meta" style="margin:0">Още нямаш избрана фирма.</div></div>';
    const open = SUBS.filter(s => g[s.k]), tot = open.reduce((a, s) => a + (s.inc(deps) || 0), 0), bon = dailyBonus();
    let h = `<div class="bw-stats"><div><b style="color:${b.col}">${b.ico} ${groupName(S)}</b><span>${H ? 'холдинг' : 'корпоративна група'}</span></div><div><b>${open.length} / ${SUBS.length}</b><span>дружества</span></div><div><b style="color:var(--ok)">+${f(tot)} €</b><span>приход на ден от дружествата</span></div>${H ? `<div><b style="color:#ffd54a">+${f(bon)} €</b><span>бонус на холдинга на ден</span></div>` : ''}</div>`;
    h += H ? `<div class="meta" style="margin:8px 0">🏛️ <b>Ерата на холдинга</b> (от ден ${H}): градовете, поръчките, линиите и флотите вървят сами. Ти управляваш дружествата: <b>⬆️ развитие</b> дава +${Math.round(HOLD_LV_K * 100)}% от прихода им на ниво (до ${HOLD_LV_MAX}), а <b>👔 директорът</b> още +${Math.round(HOLD_DIR_K * 100)}%.</div>`
      : `<div class="meta" style="margin:8px 0">🔒 От <b>ниво 15</b> идва <b>🏛️ Ерата на холдинга</b>: всичко досегашно минава на автопилот, а ти управляваш дружествата.</div>`;
    h += extra;
    h += SUBS.map(s => {
      const on = g[s.k], inc = on ? s.inc(deps) || 0 : 0, L = hold().lv[s.k] || 0, dir = hold().dir[s.k], man = H && on && !s.final && inc > 0;   // без приход — няма какво да се умножава
      const ctl = man ? `<div class="row" style="margin:6px 0 0;gap:6px;flex-wrap:wrap;align-items:center"><span class="meta" style="margin:0;flex:1">${'★'.repeat(L)}${'☆'.repeat(HOLD_LV_MAX - L)} ниво ${L}${dir ? ` · 👔 ${dir}` : ''}${bonusK(s.k) ? ` · <b style="color:#ffd54a">+${f(bonusOf(s.k))} €/ден</b> (+${Math.round(bonusK(s.k) * 100)}%)` : ''}</span>${L < HOLD_LV_MAX ? `<button class="btn2" data-hup="${s.k}" ${deps.econ().canAfford(upCost(s.k)) ? '' : 'disabled'}>⬆️ Развий · ${f(upCost(s.k))} €</button>` : ''}${dir ? '' : `<button class="btn2" data-hdir="${s.k}" ${deps.econ().canAfford(dirCost(s.k)) ? '' : 'disabled'}>👔 Директор · ${f(dirCost(s.k))} €</button>`}</div>` : '';
      return `<div class="card" style="${on ? `border-left:4px solid ${b.col}` : 'opacity:.5'}"><div class="row" style="margin:0;align-items:center;gap:10px"><span style="font-size:24px">${s.ico}</span><span class="meta" style="margin:0;flex:1"><b style="color:var(--txt);font-size:15px">${b.nm} ${s.suf}</b><br>${s.what}${on ? ` · основана на ден ${on}` : ` · 🔒 ${s.how}`}</span>${on && !s.final ? `<b style="color:${inc ? 'var(--ok)' : 'var(--mut, #9aa)'}">${inc ? `+${f(inc)} €/ден` : '—'}</b>` : ''}</div>${ctl}${s.k === 'oil' && on ? '<div class="row" style="justify-content:flex-end;margin:6px 0 0"><button class="btn" data-hoil="1">🛢️ Петролната империя →</button></div>' : ''}</div>`;
    }).join('');
    return h;
  }
  function bind(box, rerender) {
    box.querySelectorAll('[data-hup]').forEach(b => b.onclick = () => { upgrade(b.dataset.hup); rerender(); });
    box.querySelectorAll('[data-hdir]').forEach(b => b.onclick = () => { hire(b.dataset.hdir); rerender(); });
  }
  return { check, winHtml, bind, dailyTick, dailyBonus, upgrade, hire };
}
