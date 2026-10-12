// group.js — корпоративната група: при старта избираш една от 5 фирми; с всеки нов бизнес се основава дъщерно дружество
// („Титан Рейл“, „Титан Скай Еър“…). Старите дъщерни продължават да печелят — фирмата расте в цял холдинг.
// Записът: S.brand = 'titan', S.group = { [sub]: денят на основаването }.
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
  { k: 'sea', ico: '🚢', suf: 'Сийлайнс', what: 'кораби и пристанища', how: 'първото пристанище', open: c => c.portN() > 0, inc: c => c.flow('sea') },
  { k: 'air', ico: '✈️', suf: 'Скай Еър', what: 'авиация', how: 'първото летище', open: c => c.airN() > 0, inc: c => c.flow('air') },
  { k: 'oil', ico: '🛢️', suf: 'Петролиум', what: 'петрол и гориво', how: 'първото петролно находище (Азия)', open: c => c.oilN() > 0, inc: c => c.oilDaily() },
  { k: 'glob', ico: '🌍', suf: 'Глобъл Ризортс & Констръкшън', what: 'световна империя', how: 'ниво 20 — Световна империя', open: c => c.empire(), inc: () => 0, final: true },
];
export const brandOf = S => BRANDS.find(b => b.k === S?.brand) || null;
export const subName = (S, k) => { const b = brandOf(S), s = SUBS.find(x => x.k === k); return b && s ? `${b.nm} ${s.suf}` : ''; };
// името на групата горе: една фирма — „Титан Констръкшън“; повече — „Титан Груп“; накрая — „Титан Глобъл“
export function groupName(S) {
  const b = brandOf(S); if (!b) return '';
  const g = S.group || {}; if (g.glob) return `${b.nm} Глобъл`;
  return Object.keys(g).length > 1 ? `${b.nm} Груп` : `${b.nm} Констръкшън`;
}

// deps: { S, fmt, pop(key, cap, sub), toast, save, sound, …броячите от SUBS (hwN, railN, portN, airN, oilN, empire, toll, flow, finDaily, oilDaily) }
export function createGroup(deps) {
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
  function winHtml() {
    const S = deps.S(), b = brandOf(S), g = S.group || {}, f = deps.fmt;
    if (!b) return '<div class="card"><div class="meta" style="margin:0">Още нямаш избрана фирма.</div></div>';
    const open = SUBS.filter(s => g[s.k]), tot = open.reduce((a, s) => a + (s.inc(deps) || 0), 0);
    let h = `<div class="bw-stats"><div><b style="color:${b.col}">${b.ico} ${groupName(S)}</b><span>корпоративна група</span></div><div><b>${open.length} / ${SUBS.length}</b><span>дружества</span></div><div><b style="color:var(--ok)">+${f(tot)} €</b><span>приход на ден от дружествата</span></div></div>`;
    h += SUBS.map(s => {
      const on = g[s.k], inc = on ? s.inc(deps) || 0 : 0;
      return `<div class="card" style="${on ? `border-left:4px solid ${b.col}` : 'opacity:.5'}"><div class="row" style="margin:0;align-items:center;gap:10px"><span style="font-size:24px">${s.ico}</span><span class="meta" style="margin:0;flex:1"><b style="color:var(--txt);font-size:15px">${b.nm} ${s.suf}</b><br>${s.what}${on ? ` · основана на ден ${on}` : ` · 🔒 ${s.how}`}</span>${on && !s.final ? `<b style="color:${inc ? 'var(--ok)' : 'var(--mut, #9aa)'}">${inc ? `+${f(inc)} €/ден` : '—'}</b>` : ''}</div></div>`;
    }).join('');
    return h;
  }
  return { check, winHtml };
}
