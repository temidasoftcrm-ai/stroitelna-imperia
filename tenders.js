// tenders.js — държавни поръчки (обществени търгове): големи уникални обекти — контейнерни терминали в морските
// градове, нов корпус на Софийския университет и др. Държавата обявява търг, ти и конкурентите подавате оферти
// (запечатани, като процент от бюджета) и печели най-ниската, като репутацията дава малко предимство.
// Печалбата е голяма, но зависи от офертата: материалите струват matShare от бюджета, независимо колко си поискал.
// Строи се с техника в същия град; плащане: аванс 20% при подписването, останалото при предаване; закъснение — неустойка.
// Записът е в S.tenders = { [id]: { st, closes, my, bids, price, prog, start, due, paidAdv, spent } }.
//   st: 'open' (приема оферти) | 'building' | 'done' | 'lost'
import { FIRMS, firmsFor } from './rivals.js';

export const TENDERS = [
  { id: 'su-sofia', city: 'sofia', kind: 'university', ico: '🎓', nm: 'Нов корпус на Софийския университет', budget: 14000000, days: 45, rep: 3, dev: 3,
    need: { crew: 4, crane: 1, loader: 1, truck: 2 }, matShare: 0.5, ds: 'Неокласическа сграда с колонада и купол в центъра на София.' },
  { id: 'port-varna', city: 'varna', kind: 'port', ico: '⚓', nm: 'Контейнерен терминал — пристанище Варна', budget: 18000000, days: 55, rep: 3, dev: 4,
    need: { crew: 3, crane: 2, loader: 2, truck: 3 }, matShare: 0.55, ds: 'Нов кей, портални кранове и контейнерна площадка.' },
  { id: 'port-burgas', city: 'burgas', kind: 'port', ico: '⚓', nm: 'Контейнерен терминал — пристанище Бургас', budget: 15000000, days: 50, rep: 3, dev: 4,
    need: { crew: 3, crane: 2, loader: 2, truck: 3 }, matShare: 0.55, ds: 'Нов кей, портални кранове и контейнерна площадка.' },
  { id: 'port-constanta', city: 'constanta', kind: 'port', ico: '⚓', nm: 'Терминал „Черно море“ — Констанца', budget: 26000000, days: 60, rep: 3.5, dev: 6,
    need: { crew: 4, crane: 2, loader: 2, truck: 4 }, matShare: 0.55, ds: 'Най-голямото пристанище на Черно море получава нов терминал.' },
  { id: 'port-thessaloniki', city: 'thessaloniki', kind: 'port', ico: '⚓', nm: 'Пристанище Солун — нов кей', budget: 24000000, days: 60, rep: 3.5, dev: 6,
    need: { crew: 4, crane: 2, loader: 2, truck: 4 }, matShare: 0.55, ds: 'Изход на Балканите към Средиземно море.' },
  { id: 'port-istanbul', city: 'istanbul', kind: 'port', ico: '⚓', nm: 'Терминал Босфор — Истанбул', budget: 42000000, days: 70, rep: 4, dev: 7,
    need: { crew: 5, crane: 3, loader: 3, truck: 5 }, matShare: 0.55, ds: 'Огромен терминал между Европа и Азия.' },
  { id: 'port-rotterdam', city: 'rotterdam', kind: 'port', ico: '⚓', nm: 'Maasvlakte 3 — Ротердам', budget: 70000000, days: 80, rep: 4.5, dev: 8,
    need: { crew: 6, crane: 4, loader: 3, truck: 6 }, matShare: 0.55, ds: 'Най-голямото пристанище в Европа се разширява.' },
];
export const BID_MS = [0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.05];
export const ADVANCE = 0.2, LATE_PEN = 0.005, OPEN_DAYS = 7;
// гаранция за участие: 20% от бюджета се блокира при подаване на оферта; връща се на загубилите при отварянето
// на офертите, а на спечелилия — при предаването на обекта. Закъснение над BOND_LOST дни — гаранцията се губи.
export const BOND = 0.2, BOND_LOST = 30;
export const bondOf = t => Math.round(t.budget * BOND / 10000) * 10000;
const T = id => TENDERS.find(t => t.id === id);

// deps: { S(), econ(), toast, modal(title, html, buttons), fmt, save, sound(n), rep(), devBest(), owns(cityId), cityName(id),
//         fleetIn(cityId) → { type: count } (техниката в този град), emit?(ev), onProgress?(id, prog) — 3D, onDone?(id) }
export function createTenders(deps) {
  const st = () => { const S = deps.S(); S.tenders = S.tenders || {}; return S.tenders; };
  const day = () => deps.S().day;
  const ul = k => deps.unitLabel ? deps.unitLabel(k) : k;
  const refund = (t, s, why) => { if (!s.bond) return; deps.econ().earn(s.bond, 'гаранция', `Върната гаранция: ${t.nm}`); if (why) deps.toast(`🔐 ${why}: върнаха ти гаранцията ${deps.fmt(s.bond)} €.`, 'good'); s.bond = 0; };
  // наличност за гаранцията: сметката + депозитът в банката (недостигът се взима от депозита)
  const avail = () => { const e = deps.econ(); return Math.max(0, e.s.money) + (e.s.deposit || 0); };
  const eligible = t => deps.devBest() >= t.dev && deps.rep() >= t.rep - 1 && (!deps.canTender || deps.canTender(t));   // canTender — напр. само в държави, където имаш град
  const profitAt = (t, m) => Math.round(t.budget * (m - t.matShare) - Object.entries(t.need).reduce((a, [, n]) => a + n, 0) * 600 * t.days);   // грубо: минус заплати/гориво
  // ефективна оценка на офертата: по-ниска е по-добра; всяка звезда репутация = 1% по-изгодна за държавата
  const score = (m, rep) => m * (1 - 0.01 * rep);

  function announce(t) {
    const pool = (firmsFor && deps.ccOf ? firmsFor(deps.ccOf(t.city)) : null) || FIRMS;   // местни фирми в чужбина
    const rv = [...(pool.length >= 3 ? pool : [...pool, ...FIRMS])].sort(() => Math.random() - 0.5).slice(0, 3);
    st()[t.id] = { st: 'open', closes: day() + OPEN_DAYS, my: null, bids: rv.map(f => ({ nm: f.nm, ico: f.ico, m: Math.round((0.78 + Math.random() * 0.2 + (1 - f.power) * 0.05) * 100) / 100, rep: 2 + f.power * 2 })) };
    deps.toast(`🏛️ Държавна поръчка: ${t.nm} — бюджет ${deps.fmt(t.budget)} €. Офертите се приемат до ден ${day() + OPEN_DAYS}.`, 'good');
    if (deps.sound) deps.sound('offer');
  }
  function close(t) {
    const s = st()[t.id];
    const all = [...s.bids.map(b => ({ ...b, sc: score(b.m, b.rep) })), ...(s.my ? [{ me: true, nm: 'Твоята фирма', m: s.my, sc: score(s.my, deps.rep()) }] : [])].sort((a, b) => a.sc - b.sc);
    const w = all[0];
    if (w.me) {
      const price = Math.round(t.budget * s.my / 10000) * 10000, adv = Math.round(price * ADVANCE);
      Object.assign(s, { st: 'building', price, prog: 0, start: day(), due: day() + t.days, paidAdv: adv, spent: 0, result: all.map(x => [x.nm, x.m]) });
      deps.econ().earn(adv, 'обект', `Аванс: ${t.nm}`);
      deps.toast(`🏆 Спечели търга „${t.nm}“ за ${deps.fmt(price)} €! Аванс ${deps.fmt(adv)} €. Срок: ${t.days} дни.`, 'good');
      if (deps.sound) deps.sound('done');
      if (deps.emit) deps.emit('tenderWon');
    } else {
      Object.assign(s, { st: 'lost', lostDay: day(), winner: w.nm, winM: w.m, result: all.map(x => [x.nm, x.m]) });
      refund(t, s);
      if (s.my) deps.toast(`🏛️ Търгът „${t.nm}“ го спечели ${w.nm} с ${Math.round(w.m * 100)}% от бюджета (ти: ${Math.round(s.my * 100)}%). Гаранцията ти се връща.`, 'bad');
    }
  }
  // колко от нужната техника има в града: 0…1 (най-слабото звено)
  const fleetRatio = t => { const f = deps.fleetIn(t.city) || {}; return Math.min(1, ...Object.entries(t.need).map(([k, n]) => (f[k] || 0) / n)); };
  const missing = t => { const f = deps.fleetIn(t.city) || {}; return Object.entries(t.need).filter(([k, n]) => (f[k] || 0) < n).map(([k, n]) => [k, n - (f[k] || 0)]); };

  function dailyTick() {
    const S = deps.S(); if (!S) return;
    const all = st();
    // нов търг: най-много един отворен наведнъж
    if (!Object.values(all).some(s => s.st === 'open') && Math.random() < 0.05) {
      const cand = TENDERS.filter(t => eligible(t) && (!all[t.id] || (all[t.id].st === 'lost' && day() - all[t.id].lostDay > 120)));
      if (cand.length) announce(cand[(Math.random() * cand.length) | 0]);
    }
    for (const t of TENDERS) {
      const s = all[t.id]; if (!s) continue;
      if (s.st === 'open' && day() >= s.closes) close(t);
      else if (s.st === 'building') {
        if (s.bond && day() > s.due + BOND_LOST) { deps.toast(`🔐 ${t.nm} закъснява над ${BOND_LOST} дни — държавата задържа гаранцията ти ${deps.fmt(s.bond)} €.`, 'bad'); s.bondLost = s.bond; s.bond = 0; }
        const r = fleetRatio(t); if (r <= 0) continue;
        const dp = Math.min(1 - s.prog, r / t.days);
        s.prog += dp;
        const mat = Math.round(t.budget * t.matShare * dp);   // материалите се плащат според напредъка
        deps.econ().spend(mat, 'материали', `Материали: ${t.nm}`); s.spent += mat;
        if (deps.onProgress) deps.onProgress(t.id, s.prog);
        if (s.prog >= 1 - 1e-6) {
          const late = Math.max(0, day() - s.due), pen = Math.round(s.price * LATE_PEN * late), rest = s.price - s.paidAdv - pen;
          deps.econ().earn(rest, 'обект', `Предаден: ${t.nm}${pen ? ` (неустойка −${deps.fmt(pen)})` : ''}`);
          Object.assign(s, { st: 'done', doneDay: day(), profit: s.price - pen - s.spent - (s.bondLost || 0) });
          refund(t, s, `${t.nm} е предаден`);
          S.rep = Math.min(5, (S.rep || 0) + 0.5);
          deps.toast(`🏛️ ${t.ico} ${t.nm} е готов! Получи ${deps.fmt(rest)} €${pen ? ` (неустойка за ${late} дни закъснение: −${deps.fmt(pen)} €)` : ''}. +0.5 ★`, 'good');
          if (deps.sound) deps.sound('done');
          if (deps.emit) deps.emit('tenderDone');
          if (deps.onDone) deps.onDone(t.id);
          if (deps.onComplete) deps.onComplete(t.id, t);
        }
      }
    }
  }

  function bid(id, m) {
    const t = T(id), s = st()[id]; if (!s || s.st !== 'open') return;
    if (!deps.owns(t.city)) { deps.toast(`Трябва ти филиал в ${deps.cityName(t.city)}, за да участваш.`, 'bad'); return; }
    if (!s.bond) {
      const b = bondOf(t);
      const e = deps.econ(), fromDep = Math.max(0, b - Math.max(0, e.s.money));
      if (avail() < b) { deps.toast(`🔐 За участие е нужна гаранция ${deps.fmt(b)} € (${BOND * 100}% от бюджета) — нямаш толкова в сметката и депозита.`, 'bad'); return; }
      if (fromDep > 0) { e.depositOut(fromDep); deps.toast(`🏦 ${deps.fmt(fromDep)} € от гаранцията са взети от депозита.`, 'good'); }
      e.spend(b, 'гаранция', `Гаранция за участие: ${t.nm}`); s.bond = b;
    }
    s.my = m; deps.toast(`📨 Подаде оферта за „${t.nm}“: ${deps.fmt(Math.round(t.budget * m / 10000) * 10000)} € (${Math.round(m * 100)}%). Резултатът — на ден ${s.closes}.`, 'good');
    deps.save();
  }

  // ---- UI: карти за таба „Поръчки“ и прозорец за офертата
  function cardsHtml() {
    const out = [];
    for (const t of TENDERS) {
      const s = st()[t.id]; if (!s || s.st === 'lost' && day() - s.lostDay > 3) continue;
      if (s.st === 'done' && day() - s.doneDay > 3) continue;
      const own = deps.owns(t.city);
      let body = '';
      if (s.st === 'open') body = `<div class="meta">Бюджет <b style="color:var(--txt)">${deps.fmt(t.budget)} €</b> · срок ${t.days} дни · оферти до ден ${s.closes} (${s.closes - day()} д.)</div>
        <div class="meta">${s.my ? `📨 Твоята оферта: <b style="color:var(--acc)">${Math.round(s.my * 100)}%</b> = ${deps.fmt(Math.round(t.budget * s.my / 10000) * 10000)} €` : own ? 'Още не си подал оферта.' : `🔒 Трябва ти филиал в ${deps.cityName(t.city)}.`}</div>
        <div class="meta">🔐 Гаранция за участие: <b style="color:var(--txt)">${deps.fmt(bondOf(t))} €</b> (${BOND * 100}% от бюджета)${s.bond ? ' · <span style="color:var(--ok)">внесена</span>' : avail() < bondOf(t) ? ' · <span class="late">нямаш толкова в сметката и депозита</span>' : deps.econ().s.money < bondOf(t) ? ' · <span style="color:var(--acc)">ще се вземе и от депозита</span>' : ' · блокира се до края на търга'}</div>
        <div class="row" style="justify-content:flex-end;gap:6px">${deps.showCity ? `<button class="btn2" data-tshow="${t.city}">📍 Покажи</button>` : ''}<button class="btn" data-tender="${t.id}" ${own && (s.bond || avail() >= bondOf(t)) ? '' : 'disabled'}>${s.my ? 'Смени офертата' : '📨 Участвай'}</button></div>`;
      else if (s.st === 'building') { const miss = missing(t); body = `<div class="meta">Договор: <b style="color:var(--txt)">${deps.fmt(s.price)} €</b> · ${Math.round(s.prog * 100)}% · срок до ден ${s.due}${day() > s.due ? ' <span class="late">— закъснява!</span>' : ''}</div>
        <div class="bar"><i style="width:${(s.prog * 100).toFixed(1)}%"></i></div>
        ${s.bond ? `<div class="meta">🔐 Гаранция ${deps.fmt(s.bond)} € — връща се при предаването</div>` : s.bondLost ? `<div class="meta late">🔐 Гаранцията (${deps.fmt(s.bondLost)} €) е задържана заради закъснението</div>` : ''}
        ${miss.length ? `<div class="meta late">⏸ Трябва техника в ${deps.cityName(t.city)}: ${miss.map(([k, n]) => `${ul(k)} ×${n}`).join(', ')}</div>` : ''}`; }
      else if (s.st === 'done') body = `<div class="meta" style="color:var(--ok)">✅ Предаден · печалба ${deps.fmt(s.profit)} €</div>`;
      else body = `<div class="meta late">Спечели ${s.winner} (${Math.round(s.winM * 100)}%).</div>`;
      out.push(`<div class="card tender-card"><h3><span class="ico">🏛️</span>${t.ico} ${t.nm}</h3><div class="meta">Държавна поръчка · ${deps.cityName(t.city)} · ${t.ds}</div>${body}</div>`);
    }
    return out.join('');
  }
  function bind(el) { el.querySelectorAll('[data-tender]').forEach(b => b.onclick = () => openBid(b.dataset.tender)); el.querySelectorAll('[data-tshow]').forEach(b => b.onclick = () => deps.showCity(b.dataset.tshow)); }
  function openBid(id) {
    const t = T(id), s = st()[id]; if (!s || s.st !== 'open') return;
    const rep = deps.rep(), lo = Math.min(...s.bids.map(b => b.m)), hi = Math.max(...s.bids.map(b => b.m));
    const rows = BID_MS.map(m => { const p = profitAt(t, m); return `<tr><td><b>${Math.round(m * 100)}%</b></td><td>${deps.fmt(Math.round(t.budget * m / 10000) * 10000)} €</td><td style="color:${p >= 0 ? 'var(--ok)' : 'var(--bad)'}">${p >= 0 ? '+' : ''}${deps.fmt(p)} €</td></tr>`; }).join('');
    deps.modal(`🏛️ ${t.nm}`, `${t.ds}<br><br>Бюджет на държавата: <b>${deps.fmt(t.budget)} €</b> · срок ${t.days} дни · аванс ${ADVANCE * 100}%.<br>
      🔐 <b>Гаранция за участие ${deps.fmt(bondOf(t))} €</b> (${BOND * 100}% от бюджета) — ${s.bond ? 'вече е внесена' : 'взима се при подаване на офертата'}. Ако загубиш, се връща веднага; ако спечелиш — при предаването на обекта (при закъснение над ${BOND_LOST} дни я губиш).<br>
      Материалите струват ~${Math.round(t.matShare * 100)}% от бюджета, независимо от цената ти. Нужна техника в ${deps.cityName(t.city)}: ${Object.entries(t.need).map(([k, n]) => `${ul(k)} ×${n}`).join(', ')}.<br>
      Участват още ${s.bids.length} фирми (${s.bids.map(b => b.ico + ' ' + b.nm).join(', ')}). По слухове офертите им са между <b>${Math.round((lo - 0.04) * 100)}%</b> и <b>${Math.round((hi + 0.03) * 100)}%</b>. Печели най-ниската; твоите ${rep.toFixed(1)} ★ я правят с ${rep.toFixed(1)}% по-изгодна.
      <table style="width:100%;margin-top:8px;font-size:13px"><tr style="color:var(--mut)"><td>Оферта</td><td>Цена</td><td>Печалба (прибл.)</td></tr>${rows}</table>`,
      [['Отказ', null], ...BID_MS.map(m => [`${Math.round(m * 100)}%`, () => { bid(id, m); if (deps.redraw) deps.redraw(); }])]);
  }
  const state = id => st()[id] || null;
  const progOf = id => { const s = st()[id]; return !s ? null : s.st === 'done' ? 1 : s.st === 'building' ? s.prog : null; };
  return { dailyTick, cardsHtml, bind, openBid, state, progOf, announce: id => announce(T(id)), close: id => close(T(id)) };
}
