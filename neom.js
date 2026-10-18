// neom.js — 🏙️ градът от нулата (финалът на холдинга): в пустинята на Червено море основаваш свой мегаполис — „<марка> Сити“.
// Градът започва като празен пясък. Строиш го на квартали, които финансираш; всеки квартал се появява в 3D (сгради по парцелите)
// и носи приход всеки ден. Накрая — мегаструктурата „Линията“: огледален град-стена през цялата пустиня.
// Записът: S.neom = { founded, d: { [key]: { run, prog, done } }, used: [lotId] }; сградите отиват в built на града (като всички други).
export const NEOM_ID = 'neom';
export const NEOM_CITY = { id: NEOM_ID, nm: 'Сити', lat: 27.95, lon: 35.25, sz: 3, cc: '🇸🇦' };
export const FOUND_COST = 10e9;
export const DISTRICTS = [
  { key: 'res', ico: '🏘️', nm: 'Жилищен квартал „Оазис“', zone: 'outer', n: 14, kind: 'house', cost: 1.5e9, days: 60, inc: 1.2e6 },
  { key: 'res2', ico: '🏘️', nm: 'Жилищен квартал „Дюни“', zone: 'outer', n: 14, kind: 'house', cost: 1.5e9, days: 60, inc: 1.2e6, need: 'res' },
  { key: 'mall', ico: '🛍️', nm: 'Търговски булевард', zone: 'mid', n: 10, kind: 'shop', cost: 2e9, days: 75, inc: 2e6, need: 'res' },
  { key: 'biz', ico: '🏢', nm: 'Бизнес район „Хоризонт“', zone: 'center', n: 8, kind: 'sky', cost: 3e9, days: 90, inc: 3e6, need: 'mall' },
  { key: 'marina', ico: '🏨', nm: 'Марина и курорти', zone: 'mid', n: 6, kind: 'mix', cost: 2.5e9, days: 90, inc: 2.4e6, need: 'mall' },
  { key: 'uni', ico: '🎓', nm: 'Университет и болница', zone: 'outer', n: 6, kind: 'shop', cost: 1.5e9, days: 70, inc: 0.9e6, need: 'res2' },
  { key: 'line', ico: '🪞', nm: '„Линията“ — градът-стена', zone: null, n: 0, kind: 'line', cost: 15e9, days: 360, inc: 15e6, final: true },
];
const NB = 9, C = 4, HQ = C * NB + C + 1;   // ядрото 9×9 (id = bi·9 + bj), офисът е на (4,5)
const zoneOf = id => { const bi = (id / NB) | 0, bj = id % NB, d = Math.max(Math.abs(bi - C), Math.abs(bj - C)); return d <= 1 ? 'center' : d <= 2 ? 'mid' : 'outer'; };
const distOf = id => { const bi = (id / NB) | 0, bj = id % NB; return Math.hypot(bi - C, bj - C); };

// deps: { S, econ, fmt, toast, save, sound, pop, brand(), pickModel(kind, rnd) → име на модел, place(lotId, model, rot) → поставя веднага, ако си в града,
//   cityBuilt() → [lotId] заети в града, found(id) → отваря града като твой, holding() }
export function createNeom(deps) {
  const st = () => deps.S().neom || null;
  const byKey = k => DISTRICTS.find(d => d.key === k);
  const B = n => `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млрд. €`;
  const ds = k => st()?.d?.[k] || {};
  const can = d => !ds(d.key).done && !ds(d.key).run && (!d.need || ds(d.need).done) && (!d.final || DISTRICTS.filter(x => !x.final).every(x => ds(x.key).done));
  function found() {
    const S = deps.S(); if (!deps.holding() || st()) return; const e = deps.econ();
    if (!e.canAfford(FOUND_COST)) { deps.toast(`Нямаш ${B(FOUND_COST)} за основаването на града.`, 'bad'); return; }
    e.spend(FOUND_COST, 'град', `Основаване на ${deps.brand()} Сити: земя, вода, пътища`);
    S.neom = { founded: S.day, d: {}, used: [] }; deps.found(NEOM_ID);
    deps.pop && deps.pop('empire', `🏙️ ${deps.brand()} Сити е основан!`, `В пустинята на Червено море има само пясък, пътища и твоят офис. Строй квартал по квартал — накрая издигни „Линията“.`);
    deps.sound && deps.sound('levelup'); deps.save();
  }
  function start(k) {
    const d = byKey(k); if (!d || !st() || !can(d)) return; const e = deps.econ();
    if (!e.canAfford(d.cost)) { deps.toast(`Нямаш ${B(d.cost)}.`, 'bad'); return; }
    e.spend(d.cost, 'град', `${deps.brand()} Сити: ${d.nm}`); st().d[k] = { run: true, prog: 0 };
    deps.toast(`🏗️ ${d.ico} ${d.nm} — строи се ${d.days} дни.`, 'good'); deps.sound && deps.sound('buy'); deps.save();
  }
  // свободните парцели от зоната на квартала: най-близо до центъра първо, без офиса и вече заетите
  function lotsFor(d) {
    const busy = new Set([HQ, ...(st().used || []), ...deps.cityBuilt()]);
    return [...Array(NB * NB).keys()].filter(id => zoneOf(id) === d.zone && !busy.has(id)).sort((a, b) => distOf(a) - distOf(b) || a - b).slice(0, d.n);
  }
  function complete(d) {
    const r = st().d[d.key]; r.run = false; r.done = deps.S().day;
    if (d.n) { let seed = d.key.length * 977; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (const id of lotsFor(d)) { const kind = d.kind === 'mix' ? (rnd() < 0.5 ? 'sky' : 'shop') : d.kind; st().used.push(id); deps.place(id, deps.pickModel(kind, rnd), Math.floor(rnd() * 4) * Math.PI / 2); } }
    if (d.final) deps.pop && deps.pop('empire', `🪞 „Линията“ е готова!`, `${deps.brand()} Сити има своята мегаструктура — огледален град-стена през пустинята. Градът на бъдещето е твой.`);
    else deps.pop && deps.pop('city-done', `${d.ico} ${d.nm} е готов!`, `${deps.brand()} Сити расте — +${deps.fmt(d.inc)} €/ден.`);
    deps.sound && deps.sound('levelup');
  }
  function dailyTick() {
    const S = deps.S(), n = st(); if (!S || !n) return; let inc = 0;
    for (const d of DISTRICTS) { const r = n.d[d.key]; if (!r) continue; if (r.run) { r.prog += 1 / d.days; if (r.prog >= 1) complete(d); } if (r.done) inc += d.inc; }
    if (inc) deps.econ().earn(Math.round(inc), 'град', `${deps.brand()} Сити: наеми, данъци и туризъм`); n._inc = Math.round(inc);
  }
  const value = () => { const n = st(); if (!n) return 0; return FOUND_COST + DISTRICTS.reduce((a, d) => a + (n.d[d.key]?.done ? d.cost * 1.4 : n.d[d.key]?.run ? d.cost : 0), 0); };
  const lineDone = () => !!ds('line').done;
  function winHtml() {
    const S = deps.S(), n = st(), e = deps.econ();
    if (!deps.holding()) return `<div class="card"><div class="meta" style="margin:0">🔒 Градът от нулата идва с <b>🏛️ Ерата на холдинга</b>.</div></div>`;
    if (!n) return `<div class="card"><h3 style="margin:0 0 6px">🏙️ ${deps.brand()} Сити</h3><div class="meta">Финалът на империята: на брега на Червено море, в пустинята, основаваш <b>свой мегаполис от нулата</b>. Започва като пясък, пътища и твоят офис; строиш го на квартали — жилищни, търговски, бизнес район, марина, университет — и накрая издигаш <b>„Линията“</b>, огледален град-стена през пустинята. Всеки квартал носи приход всеки ден и вдига холдинга в класацията.</div><div class="row" style="justify-content:flex-end;margin:6px 0 0"><button class="btn" data-nmfound="1" ${e.canAfford(FOUND_COST) ? '' : 'disabled'}>🏙️ Основи града · ${B(FOUND_COST)}</button></div></div>`;
    const done = DISTRICTS.filter(d => ds(d.key).done).length;
    let h = `<div class="bw-stats"><div><b>${done} / ${DISTRICTS.length}</b><span>квартала</span></div><div><b style="color:var(--ok)">+${deps.fmt(n._inc || 0)} €</b><span>приход на ден</span></div><div><b>${B(value())}</b><span>стойност в класацията</span></div></div>`;
    h += `<div class="meta" style="margin:8px 0">🏙️ Основан на ден ${n.founded}. Влез в града от картата (🇸🇦 Червено море), за да го видиш как расте. Кварталите се отключват един след друг.</div>`;
    h += DISTRICTS.map(d => { const r = ds(d.key), ok = can(d), p = r.done ? 100 : r.run ? Math.round(r.prog * 100) : 0;
      return `<div class="card" style="${d.final ? 'border:1px solid #9fdfff' : ''}${!r.done && !r.run && !ok ? ';opacity:.55' : ''}"><div class="row" style="margin:0;align-items:center;gap:10px"><span style="font-size:24px">${d.ico}</span><span class="meta" style="margin:0;flex:1"><b style="color:var(--txt)">${d.nm}</b><br>${d.n ? `${d.n} парцела · ` : ''}${B(d.cost)} · ${d.days} дни · 🎁 +${deps.fmt(d.inc)} €/ден${d.need && !ds(d.need).done ? ` · 🔒 след „${byKey(d.need).nm}“` : ''}${d.final && !ok && !r.done && !r.run ? ' · 🔒 след всички квартали' : ''}</span><b>${r.done ? '✅' : r.run ? p + '%' : ''}</b></div>${r.run ? `<div class="bar" style="height:5px;margin:6px 0 0"><i style="width:${p}%"></i></div>` : ''}${ok ? `<div class="row" style="justify-content:flex-end;margin:6px 0 0"><button class="btn" data-nmstart="${d.key}" ${e.canAfford(d.cost) ? '' : 'disabled'}>🏗️ Строй · ${B(d.cost)}</button></div>` : ''}</div>`; }).join('');
    return h;
  }
  function bind(box, rerender) {
    box.querySelectorAll('[data-nmfound]').forEach(b => b.onclick = () => { found(); rerender(); });
    box.querySelectorAll('[data-nmstart]').forEach(b => b.onclick = () => { start(b.dataset.nmstart); rerender(); });
  }
  return { can: k => !!byKey(k) && !!st() && can(byKey(k)), state: st, found, start, dailyTick, value, winHtml, bind, lineDone };
}
