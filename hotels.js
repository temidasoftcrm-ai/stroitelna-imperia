// hotels.js — 🏨 хотелската верига на холдинга („Титан Хотелс“): по един хотел в твоите градове по света, с нива 3★ → 4★ → 5★ → Гранд.
// Заетостта зависи от големината на града, летището, мегаполисите, сезона и от марката (колкото повече хотели — толкова по-позната).
// Всеки ден: стаи × заетост × цена на нощувка − поддръжка. Записът: S.hotels = { [cityId]: { t: 0..3, since } }.
// Хотелите са в офисите: щом офисът в един град стигне ниво 10 („Империя“), кулата може да се преобразува в хотел 4★ (CONVERT €), после до 5★ и Гранд.
export const TIERS = [
  { k: 's3', nm: 'Сити хотел', st: '3★', rooms: 120, adr: 300, cost: 5e6, up: 5000 },
  { k: 's4', nm: 'Бизнес хотел', st: '4★', rooms: 220, adr: 560, cost: 15e6, up: 12000 },
  // 5★ и Гранд — в мащаба на милиардите (холдинга): по-скъпи, но и много по-големи (изплащат се за ~1–1.5 години, като 4★)
  { k: 's5', nm: 'Луксозен хотел', st: '5★', rooms: 800, adr: 1800, cost: 300e6, up: 120000 },
  { k: 'grand', nm: 'Гранд хотел', st: '👑', rooms: 2000, adr: 2800, cost: 1.5e9, up: 400000, big: true },   // само в мегаполисите и столиците
];

// deps: { officeLv(id) → нивото на офиса в града (1..10), S, econ, fmt, toast, save, sound, pop, brand() → 'Титан', cities() → твоите градове [id], city(id) → { nm, sz, cc }, big(id) → мегаполис/столица, airLv(id), isAm(id), day() }
export function createHotels(deps) {
  const st = () => { const S = deps.S(); S.hotels = S.hotels || {}; return S.hotels; };
  const T = id => TIERS[st()[id]?.t ?? -1] || null;
  const am = id => deps.isAm(id) ? 1.3 : 1, vegas = id => id === 'lasvegas' ? 1.5 : 1;
  const costOf = (id, t) => Math.round(TIERS[t].cost * (deps.isAm(id) ? 2 : 1) / 1e5) * 1e5;
  const brandK = () => Math.min(0.1, Object.keys(st()).length * 0.005);   // марката: +0.5% заетост на хотел, до +10%
  function occ(id) {
    const c = deps.city(id) || {}, d = deps.day();
    const o = 0.42 + (c.sz || 1) * 0.06 + Math.min(0.15, (deps.airLv(id) || 0) * 0.03) + (deps.big(id) ? 0.1 : 0) + brandK() + Math.sin(d / 365 * Math.PI * 2) * 0.07;
    return Math.max(0.2, Math.min(0.96, o));
  }
  const revOf = id => { const t = T(id); if (!t) return 0; return Math.round(t.rooms * occ(id) * t.adr * am(id) * vegas(id) - t.up); };
  const daily = () => Object.keys(st()).reduce((a, id) => a + revOf(id), 0);
  const value = () => Object.entries(st()).reduce((a, [id, h]) => a + TIERS.slice(0, h.t + 1).reduce((b, _, t) => b + costOf(id, t), 0) * 1.1, 0);
  const nextT = id => { const h = st()[id], t = h ? h.t + 1 : 0; if (t >= TIERS.length) return null; if (TIERS[t].big && !deps.big(id)) return null; return t; };
  function build(id) {
    const t = nextT(id); if (t == null) return; const c = costOf(id, t), e = deps.econ();
    if (!e.canAfford(c)) { deps.toast(`Нямаш ${deps.fmt(c)} €.`, 'bad'); return; }
    const first = !Object.keys(st()).length, nm = deps.city(id)?.nm || id;
    e.spend(c, 'хотели', `${TIERS[t].nm} ${TIERS[t].st} в ${nm}`); deps.xp && deps.xp(1000); st()[id] = { t, since: st()[id]?.since || deps.day() }; deps.changed && deps.changed(id);   /* hotel5 (55): 5★/Гранд — моделът в града */
    const label = t === 3 ? `Гранд хотел „${deps.brand()}“` : `${TIERS[t].nm} ${TIERS[t].st}`;
    if (first) deps.pop && deps.pop('resort-unlock', `🏨 ${deps.brand()} Хотелс — първият хотел!`, `${label} в ${nm}. Всеки нов хотел прави марката по-позната — заетостта расте във всички.`);
    else deps.toast(`🏨 ${label} в ${nm} — ~${deps.fmt(revOf(id))} €/ден.`, 'good');
    deps.sound && deps.sound(t ? 'upgrade' : 'buy'); deps.save();
  }
  const OFFICE_MAX = 10;
  // офисите на ниво 10 се преобразуват в хотели (4★ Бизнес хотел) срещу CONVERT €
  const CONVERT = 50e6;
  const canConvert = id => !st()[id] && deps.officeLv(id) >= OFFICE_MAX;
  function convert(id) {
    if (!canConvert(id)) return; const e = deps.econ(); if (!e.canAfford(CONVERT)) { deps.toast(`Нямаш ${deps.fmt(CONVERT)} € за преобразуването.`, 'bad'); return; }
    e.spend(CONVERT, 'хотели', `Преобразуване на офиса в ${deps.city(id)?.nm} в хотел`); deps.xp && deps.xp(2000);
    const first = !Object.keys(st()).length; st()[id] = { t: 1, since: deps.day(), office: true };
    if (first) deps.pop && deps.pop('resort-unlock', `🏨 ${deps.brand()} Хотелс — първият хотел!`, `Кулата „Империя“ в ${deps.city(id)?.nm} вече е ${TIERS[1].nm.toLowerCase()} ${TIERS[1].st}. Всеки нов хотел прави марката по-позната — заетостта расте във всички.`);
    else deps.toast(`🏨 Офисът в ${deps.city(id)?.nm} стана ${TIERS[1].nm.toLowerCase()} ${TIERS[1].st} — ~${deps.fmt(revOf(id))} €/ден.`, 'good');
    deps.sound && deps.sound('buy'); deps.save();
  }
  function dailyTick() { const S = deps.S(); if (!S || !S.holding) return 0; if (!Object.keys(st()).length) return 0; const r = daily(); if (r) r > 0 ? deps.econ().earn(r, 'хотели', `🏨 ${deps.brand()} Хотелс: нощувки`) : deps.econ().spend(-r, 'хотели', 'Хотели: поддръжка'); return r; }

  function winHtml() {
    const S = deps.S(), f = deps.fmt, e = deps.econ(), H = st(), ids = Object.keys(H);
    if (!S.holding) return `<div class="card"><div class="meta" style="margin:0">🔒 Хотелската верига идва с <b>🏛️ Ерата на холдинга</b> (ниво 15).</div></div>`;
    const rooms = ids.reduce((a, id) => a + (T(id)?.rooms || 0), 0), avgOcc = ids.length ? ids.reduce((a, id) => a + occ(id), 0) / ids.length : 0;
    let h = `<div class="bw-stats"><div><b>${ids.length}</b><span>хотела</span></div><div><b>${f(rooms)}</b><span>стаи</span></div><div><b>${Math.round(avgOcc * 100)}%</b><span>средна заетост</span></div><div><b style="color:var(--ok)">+${f(daily())} €</b><span>чисто на ден</span></div></div>`;
    h += `<div class="meta" style="margin:8px 0">🏨 <b>${deps.brand()} Хотелс</b>: щом офисът в един град стигне <b>ниво 10</b>, преобразуваш кулата в ${TIERS[1].nm.toLowerCase()} ${TIERS[1].st} за ${f(CONVERT)} €. Надграждаш я до 5★, а в мегаполисите и столиците — до 👑 Гранд хотел. Заетостта расте с големината на града, летището, сезона и <b>марката</b> (+0.5% за всеки хотел във веригата, сега +${Math.round(brandK() * 100)}%). В Америка нощувките са +30%, в Лас Вегас — още +50%.</div>`;
    if (ids.length) h += `<div class="card"><h3 style="margin:0 0 6px">🏨 Веригата</h3>${ids.sort((a, b) => revOf(b) - revOf(a)).map(id => { const t = T(id), n = nextT(id), c = deps.city(id) || {};
      return `<div class="row" style="margin:5px 0;align-items:center;gap:8px;flex-wrap:wrap"><span class="meta" style="margin:0;flex:1"><b style="color:var(--txt)">${c.cc || '🇧🇬'} ${c.nm}</b> · ${st()[id].t === 3 ? `👑 Гранд хотел „${deps.brand()}“` : `${t.nm} ${t.st}`} · ${t.rooms} стаи · заетост ${Math.round(occ(id) * 100)}% · <b style="color:var(--ok)">+${f(revOf(id))} €/ден</b></span>${n != null ? `<button class="btn2" data-hotel="${id}" ${e.canAfford(costOf(id, n)) ? '' : 'disabled'}>⬆️ ${TIERS[n].st} ${TIERS[n].nm.split(' ')[0]} · ${f(costOf(id, n))} €</button>` : ''}</div>`; }).join('')}</div>`;
    const ready = deps.cities().filter(canConvert), wait = deps.cities().filter(id => !H[id] && !canConvert(id)).sort((a, b) => deps.officeLv(b) - deps.officeLv(a));
    if (ready.length) h += `<div class="card" style="border:1px solid #ffd54a"><h3 style="margin:0 0 6px">🏢→🏨 Офиси на ниво 10 — готови за хотел (${ready.length})</h3><div class="row" style="margin:0;gap:6px;flex-wrap:wrap">${ready.map(id => `<button class="btn" data-hconv="${id}" ${e.canAfford(CONVERT) ? '' : 'disabled'}>🏨 ${deps.city(id)?.nm} · ${f(CONVERT)} €</button>`).join('')}</div></div>`;
    if (wait.length) h += `<div class="card"><h3 style="margin:0 0 6px">⏳ Офиси под ниво 10 (${wait.length})</h3><div class="meta" style="margin:0">${wait.slice(0, 30).map(id => `${deps.city(id)?.cc || '🇧🇬'} ${deps.city(id)?.nm} <b style="color:var(--txt)">${deps.officeLv(id)}/${OFFICE_MAX}</b>`).join(' · ')}${wait.length > 30 ? ` · и още ${wait.length - 30}` : ''}</div></div>`;
    return h;
  }
  const bind = (box, rerender) => { box.querySelectorAll('[data-hotel]').forEach(b => b.onclick = () => { build(b.dataset.hotel); rerender(); }); box.querySelectorAll('[data-hconv]').forEach(b => b.onclick = () => { convert(b.dataset.hconv); rerender(); }); };
  return { state: st, build, convert, daily, dailyTick, value, winHtml, bind, occ, revOf, canConvert, nextT, costOf, CONVERT };   // canConvert/nextT/costOf — за директора на хотелите (борда)
}
