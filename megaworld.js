// megaworld.js — 🌍 световните мегапроекти на холдинга (етап 2): ти ги финансираш и строиш на етапи, после носят огромен приход всеки ден.
// Не са държавни поръчки (megaorders.js) — тук ти си инвеститорът. Всеки етап се плаща предварително и се строи сам.
// Записът: S.mw = { [key]: { ph: завършени етапи, prog: 0..1 на текущия, run: true докато се строи, done: ден } }.
export const MW = [
  { key: 'pipeline', ico: '🛢️', nm: 'Петролопровод „Залив — Европа“', route: ['riyadh', 'ankara', 'istanbul', 'burgas'], cost: 40e9, days: 360, inc: 45e6, col: '#ff9a2e',
    what: 'тръба от Саудитска Арабия през Турция до Бургас', effect: 'петролът и горивото на империята се продават с +10%' },
  { key: 'suez', ico: '🚢', nm: 'Разширение на Суецкия канал', point: [32.35, 30.6], city: 'cairo', cost: 25e9, days: 300, inc: 30e6, col: '#4fc3f7',
    what: 'втори канал за най-големите кораби в света', effect: '+10% от прихода на корабите ти' },
  { key: 'gibraltar', ico: '🌉', nm: 'Мост „Гибралтар“', route: ['seville', 'tangier'], cost: 30e9, days: 330, inc: 25e6, col: '#7dffa8',
    what: 'мост между Европа и Африка над протока', effect: 'жп линии между Испания и Мароко' },
  { key: 'hyperloop', ico: '🚄', nm: 'Хиперлуп „Европа“', route: ['paris', 'frankfurt', 'munich', 'vienna', 'budapest'], cost: 60e9, days: 420, inc: 70e6, col: '#e57cff',
    what: 'вакуумна капсула с 1000 км/ч — Париж до Будапеща за 2 часа', effect: 'най-големият приход от билети в света' },
];
const PHASES = 4;

// deps: { S, econ, fmt, toast, save, sound, pop, seaDaily() }
export function createMegaWorld(deps) {
  const st = () => { const S = deps.S(); S.mw = S.mw || {}; for (const m of MW) S.mw[m.key] = S.mw[m.key] || { ph: 0, prog: 0, run: false }; return S.mw; };
  const byKey = k => MW.find(m => m.key === k);
  const done = k => !!(deps.S()?.mw?.[k]?.done);
  const phaseCost = m => Math.round(m.cost / PHASES / 1e8) * 1e8;
  const B = n => `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млрд. €`;
  const pct = k => { const r = st()[k]; return r.done ? 1 : (r.ph + (r.run ? r.prog : 0)) / PHASES; };
  function fund(k) {
    const m = byKey(k), r = st()[k]; if (!m || r.done || r.run) return;
    const c = phaseCost(m), e = deps.econ(); if (!e.canAfford(c)) { deps.toast(`Нямаш ${B(c)} за етап ${r.ph + 1}.`, 'bad'); return; }
    e.spend(c, 'мегапроекти', `${m.nm}: етап ${r.ph + 1}`); r.run = true; r.prog = 0;
    if (!r.ph) deps.pop && deps.pop('hw-open', `${m.ico} ${m.nm} — първа копка!`, `${m.what}. Етап 1 от ${PHASES} тръгна — ${Math.round(m.days / PHASES)} дни.`);
    else deps.toast(`${m.ico} ${m.nm}: етап ${r.ph + 1} от ${PHASES} тръгна.`, 'good');
    deps.sound && deps.sound('buy'); deps.save();
  }
  function dailyTick() {
    const S = deps.S(); if (!S || !S.holding) return; const e = deps.econ(); let inc = 0;
    for (const m of MW) {
      const r = st()[m.key];
      if (r.run) { r.prog += PHASES / m.days;
        if (r.prog >= 1) { r.run = false; r.prog = 0; r.ph++;
          if (r.ph >= PHASES) { r.done = S.day; deps.pop && deps.pop('empire', `${m.ico} ${m.nm} е готов!`, `${m.what}. Носи ~${deps.fmt(m.inc)} €/ден · ${m.effect}.`); deps.sound && deps.sound('levelup'); }
          else deps.toast(`${m.ico} ${m.nm}: етап ${r.ph} от ${PHASES} е готов — финансирай следващия.`, 'good'); } }
      if (r.done) inc += m.inc;
    }
    if (done('suez')) inc += Math.round(Math.max(0, deps.seaDaily()) * 0.1);
    if (inc) e.earn(Math.round(inc), 'мегапроекти', 'Световни мегапроекти: такси, билети и транзит');
    st()._inc = Math.round(inc);
  }
  // стойност за класацията: готовите — 1.3× цената; в строеж — платеното
  const value = () => MW.reduce((a, m) => { const r = st()[m.key]; return a + (r.done ? m.cost * 1.3 : phaseCost(m) * (r.ph + (r.run ? 1 : 0))); }, 0);
  function winHtml() {
    const s = st(), e = deps.econ();
    let h = `<div class="bw-stats"><div><b>${MW.filter(m => s[m.key].done).length} / ${MW.length}</b><span>готови мегапроекта</span></div><div><b style="color:var(--ok)">+${deps.fmt(s._inc || 0)} €</b><span>приход на ден</span></div><div><b>${B(value())}</b><span>стойност в класацията</span></div></div>`;
    h += `<div class="meta" style="margin:8px 0">🌍 Ти си инвеститорът: плащаш всеки от ${PHASES}-те етапа предварително, строи се сам, а готовият проект носи приход завинаги и вдига холдинга в класацията. На картата се вижда трасето.</div>`;
    h += MW.map(m => { const r = s[m.key], p = Math.round(pct(m.key) * 100), c = phaseCost(m);
      return `<div class="card" style="border-left:4px solid ${m.col}"><div class="row" style="margin:0;align-items:center;gap:10px"><span style="font-size:26px">${m.ico}</span><span class="meta" style="margin:0;flex:1"><b style="color:var(--txt);font-size:15px">${m.nm}</b><br>${m.what} · общо ${B(m.cost)} · ${m.days} дни<br>🎁 ~${deps.fmt(m.inc)} €/ден · ${m.effect}</span><b style="color:${r.done ? 'var(--ok)' : m.col}">${r.done ? '✅' : `${p}%`}</b></div>
        <div class="bar" style="height:6px;margin:8px 0 6px"><i style="width:${p}%;background:${m.col}"></i></div>
        <div class="row" style="margin:0;justify-content:flex-end;gap:6px;align-items:center"><span class="meta" style="margin:0;flex:1">${r.done ? `готов на ден ${r.done}` : r.run ? `🚧 етап ${r.ph + 1} от ${PHASES} — ${Math.round(r.prog * 100)}%` : r.ph ? `⏸ етап ${r.ph} е готов — чака финансиране` : 'не е започнат'}</span>${!r.done && !r.run ? `<button class="btn" data-mwfund="${m.key}" ${e.canAfford(c) ? '' : 'disabled'}>${r.ph ? `▶️ Етап ${r.ph + 1}` : '🏗️ Първа копка'} · ${B(c)}</button>` : ''}</div></div>`; }).join('');
    return h;
  }
  const bind = (box, rerender) => box.querySelectorAll('[data-mwfund]').forEach(b => b.onclick = () => { fund(b.dataset.mwfund); rerender(); });
  return { MW, state: st, done, pct, fund, dailyTick, value, winHtml, bind };
}
