// corp.js — следващата фаза на холдинга: 🏆 класацията на най-големите компании в света, 🤝 придобивания и 📈 световната борса.
//   • Класация: твоят холдинг срещу 10 световни конгломерата (измислени). Стойността ти = нетна стойност + 8 години печалба + дяловете ти.
//     Да станеш №1 е крайната цел на играта.
//   • Придобивания: купуваш дялове от световните конгломерати (по 10%) — носят дивидент; с 50%+ ги поглъщаш.
//     И местните конкуренти (rivals.js) — изкупена фирма спира да ти взема поръчките, а пазарът ѝ става твой.
//   • Борса: листваш холдинга, продаваш до 49% на транши за капитал; дивидентите държат акционерите доволни (цената расте).
// Записът: S.corp = { gl: { [id]: { w, stake, merged } }, loc: { [firmId]: ден }, ipo: { out, mood, div, hist }, best, top1, seq }.
export const GLOBAL = [
  { id: 'meridian', nm: 'Меридиан Холдингс', flag: '🇺🇸', ico: '🏦', w: 280e9, sec: 'финанси и строителство' },
  { id: 'dragon', nm: 'Дракон Индъстрийс', flag: '🇨🇳', ico: '🐉', w: 240e9, sec: 'инфраструктура' },
  { id: 'oasis', nm: 'Оазис Петролиум', flag: '🇦🇪', ico: '🛢️', w: 180e9, sec: 'петрол и газ' },
  { id: 'nordstern', nm: 'Нордщерн Груп', flag: '🇩🇪', ico: '⭐', w: 150e9, sec: 'железници и машини' },
  { id: 'sakura', nm: 'Сакура Корпорейшън', flag: '🇯🇵', ico: '🌸', w: 130e9, sec: 'кораби и електроника' },
  { id: 'aurora', nm: 'Аврора Глобал', flag: '🇬🇧', ico: '🌌', w: 110e9, sec: 'авиация и хотели' },
  { id: 'ganga', nm: 'Ганг Инфраструктура', flag: '🇮🇳', ico: '🏗️', w: 75e9, sec: 'пътища и пристанища' },
  { id: 'cruzeiro', nm: 'Круцейро Холдинг', flag: '🇧🇷', ico: '⚓', w: 60e9, sec: 'добив и транспорт' },
  { id: 'tasman', nm: 'Тасман Енерджи', flag: '🇦🇺', ico: '⚡', w: 45e9, sec: 'енергетика' },
  { id: 'kalahari', nm: 'Калахари Ресурсиз', flag: '🇿🇦', ico: '💎', w: 35e9, sec: 'мини' },
];
const PE = 8, TRANCHE = 0.10, PREMIUM = 1.15, STAKE_DIV = 0.00012, MERGED_INC = 0.0002, LOC_INC = 0.0006, IPO_MAX = 0.49, SHARES = 1e9;

// deps: { S, econ, fmt, toast, save, sound, pop, brandName(), netWorth(), dailyNet() (средна дневна печалба), localFirms() → [{ f, cc, cnm, tier }], cityShareBoost? }
export function createCorp(deps) {
  const st = () => { const S = deps.S(); const c = S.corp = S.corp || { gl: {}, loc: {}, ipo: null, best: 99, seq: 0 }; for (const g of GLOBAL) c.gl[g.id] = c.gl[g.id] || { w: g.w, stake: 0 }; return c; };
  const f = n => deps.fmt(n), B = n => n >= 1e9 ? `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млрд. €` : `${f(Math.round(n / 1e6))} млн. €`;
  const locValue = x => Math.round(x.f.power * 40e6 * x.tier / 1e5) * 1e5;
  // стойността на твоя холдинг (за класацията и борсата)
  function myValue() {
    const c = st(), nw = Math.max(0, deps.netWorth()) * 0.5, earn = Math.max(0, deps.dailyNet()) * 365 * PE, net = deps.network ? deps.network() : 0, conc = (c.conc || []).reduce((a, x) => a + x.price * 1.2, 0);   // натрупаните пари тежат наполовина — броят печалбата, мрежите и активите
    const stakes = GLOBAL.reduce((a, g) => a + (c.gl[g.id].merged ? c.gl[g.id].w : c.gl[g.id].w * c.gl[g.id].stake), 0);
    const loc = Object.keys(c.loc).length ? deps.localFirms().filter(x => c.loc[x.f.id]).reduce((a, x) => a + locValue(x), 0) : 0;
    return Math.round(nw + earn + net + conc + stakes + loc + (deps.extraValue ? deps.extraValue() : 0));   // + мегапроектите (megaworld.js)
  }
  function ranking() {
    const c = st(), me = { me: true, nm: deps.brandName(), flag: '🇧🇬', ico: '🏛️', w: myValue() };
    return [me, ...GLOBAL.filter(g => !c.gl[g.id].merged).map(g => ({ ...g, w: c.gl[g.id].w, stake: c.gl[g.id].stake }))].sort((a, b) => b.w - a.w);
  }
  const myRank = () => ranking().findIndex(x => x.me) + 1;

  // 🤝 световни дялове
  const trancheCost = id => Math.round(st().gl[id].w * TRANCHE * PREMIUM / 1e6) * 1e6;
  function buyStake(id) {
    if (!deps.empire()) return;
    const c = st(), g = GLOBAL.find(x => x.id === id), r = c.gl[id]; if (!g || r.merged) return;
    const cost = trancheCost(id), e = deps.econ(); if (!e.canAfford(cost)) { deps.toast(`Нямаш ${B(cost)} за 10% от ${g.nm}.`, 'bad'); return; }
    e.spend(cost, 'придобивания', `10% от ${g.nm}`); r.stake = Math.round((r.stake + TRANCHE) * 100) / 100;
    if (r.stake >= 0.5) { r.merged = deps.S().day; deps.pop && deps.pop('empire', `🤝 ${g.nm} е твоя!`, `${deps.brandName()} притежава ${Math.round(r.stake * 100)}% и поглъща ${g.flag} ${g.nm} (${g.sec}). Тя излиза от класацията, а стойността ѝ вече е в твоя холдинг.`); deps.sound && deps.sound('levelup'); }
    else { deps.toast(`🤝 Вече имаш ${Math.round(r.stake * 100)}% от ${g.nm} — носи дивидент всеки ден.${r.stake >= 0.4 ? ' Още 10% и я поглъщаш!' : ''}`, 'good'); deps.sound && deps.sound('buy'); }
    deps.save();
  }
  // 🏢 местни конкуренти
  function buyLocal(id) {
    if (!deps.empire()) return;   // придобиванията се отварят на ниво 20
    const c = st(), x = deps.localFirms().find(q => q.f.id === id); if (!x || c.loc[id]) return;
    const cost = locValue(x), e = deps.econ(); if (!e.canAfford(cost)) { deps.toast(`Нямаш ${B(cost)}.`, 'bad'); return; }
    e.spend(cost, 'придобивания', `Изкупуване на ${x.f.nm}`); c.loc[id] = deps.S().day;
    deps.toast(`🤝 ${x.f.nm} (${x.cc} ${x.cnm}) е твоя — вече не ти взема поръчки, а пазарът ѝ е твой.`, 'good'); deps.sound && deps.sound('buy'); deps.save();
  }
  // 📈 борса
  const sharePrice = () => { const c = st(); return Math.round(myValue() * (c.ipo ? c.ipo.mood : 1) / SHARES * 100) / 100; };
  function sellTranche() {
    const c = st(); c.ipo = c.ipo || { out: 0, mood: 1, div: 0.3, hist: [], day: deps.S().day };
    if (c.ipo.out + TRANCHE > IPO_MAX + 1e-9) { deps.toast('Над 49% не продаваш — ще изгубиш контрола над холдинга.', 'bad'); return; }
    const cash = Math.round(myValue() * c.ipo.mood * TRANCHE * 0.95 / 1e6) * 1e6, first = !c.ipo.out;
    c.ipo.out = Math.round((c.ipo.out + TRANCHE) * 100) / 100; c.ipo.raised = (c.ipo.raised || 0) + cash; deps.econ().earn(cash, 'борса', `Холдинг: продадени 10% на световната борса`);
    if (first) deps.pop && deps.pop('empire', `🔔 ${deps.brandName()} на световната борса!`, `Продаде първите 10% за ${B(cash)}. Дивидентите държат акционерите доволни — тогава цената на акцията расте.`);
    else deps.toast(`📈 Продаде още 10% за ${B(cash)} — външните акционери имат ${Math.round(c.ipo.out * 100)}%.`, 'good');
    deps.sound && deps.sound('cash'); deps.save();
  }
  function buyBack() {
    const c = st(); if (!c.ipo || c.ipo.out < TRANCHE - 1e-9) return;
    const cost = Math.round(myValue() * c.ipo.mood * TRANCHE * 1.05 / 1e6) * 1e6, e = deps.econ(); if (!e.canAfford(cost)) { deps.toast(`Нямаш ${B(cost)}.`, 'bad'); return; }
    e.spend(cost, 'борса', 'Холдинг: обратно изкупуване на 10%'); c.ipo.out = Math.round((c.ipo.out - TRANCHE) * 100) / 100; c.ipo.spent = (c.ipo.spent || 0) + cost; deps.toast(`🔁 Изкупи обратно 10% — външните имат ${Math.round(c.ipo.out * 100)}%.`, 'good'); deps.save();
  }
  const setDiv = d => { const c = st(); if (c.ipo) { c.ipo.div = d; deps.save(); } };

  // 🌐 световни концесии (ниво 20): отваря се търг, ти и 2 конгломерата наддавате тайно; печелиш ли — приход за десетилетия
  // [икона, име, цена, приход на ден, картинка при победа (EVENT_PICS в game.js; без нея — 'empire')]
  const CONC = [
    ['🛫', 'Летище „Хийтроу“ — Лондон', 18e9, 9e6], ['⚓', 'Пристанище Ротердам', 12e9, 6e6], ['🚄', 'Скоростна линия Мадрид — Барселона', 9e9, 4.5e6], ['🛣️', 'Аутобан А7 — Германия', 7e9, 3.5e6],
    ['🛢️', 'Находище в Северно море', 20e9, 10e6], ['🌉', 'Трети мост над Босфора', 6e9, 3e6], ['🚇', 'Метрото на Рияд', 11e9, 5.4e6], ['⚡', 'Офшорен вятърен парк — Балтика', 8e9, 4e6],
    ['🛳️', 'Канал „Истанбул“', 25e9, 12e6], ['🏟️', 'Олимпийският парк — Лос Анджелис', 5e9, 2.4e6, 'conc-sport'], ['🛫', 'Летище Джуел — Сингапур', 15e9, 7.5e6], ['🚆', 'Жп коридор Лагос — Абиджан', 6e9, 3e6]];
  function concOpen(day) {
    const c = st(); if (c.tender || !deps.empire()) return; const free = CONC.filter(x => !(c.conc || []).some(o => o.nm === x[1]));
    if (!free.length) return; const t = free[Math.floor(Math.random() * free.length)], riv = GLOBAL.filter(g => !c.gl[g.id].merged).sort(() => Math.random() - 0.5).slice(0, 2);
    c.tender = { ico: t[0], nm: t[1], price: t[2], inc: t[3], pic: t[4], due: day + 7, my: 0, riv: riv.map(g => ({ id: g.id, bid: Math.round(t[2] * (0.95 + Math.random() * 0.4) / 1e8) * 1e8 })) };
    deps.toast(`🌐 Нов световен търг: ${t[0]} ${t[1]} — наддаването трае 7 дни (Холдинг → Концесии).`, 'good');
  }
  function concBid(k) { const c = st(); if (!c.tender) return; c.tender.my = Math.round(c.tender.price * k / 1e8) * 1e8; deps.toast(`🌐 Твоята оферта: ${B(c.tender.my)}.`, ''); deps.save(); }
  function concResolve() {
    const c = st(), t = c.tender; c.tender = null; const best = [...t.riv].sort((a, b) => b.bid - a.bid)[0], e = deps.econ();
    if (t.my && t.my > best.bid && e.canAfford(t.my)) { e.spend(t.my, 'придобивания', `Концесия: ${t.nm}`); c.conc = [...(c.conc || []), { ico: t.ico, nm: t.nm, price: t.my, inc: t.inc, day: deps.S().day }];
      deps.pop && deps.pop(t.pic || CONC.find(x => x[1] === t.nm)?.[4] || 'empire', `🌐 Спечели концесията!`, `${t.ico} ${t.nm} е твоя за ${B(t.my)} — ~${deps.fmt(t.inc)} €/ден за десетилетия.`); deps.sound && deps.sound('levelup'); }
    else { const g = GLOBAL.find(x => x.id === best.id); c.gl[best.id].w += t.price * 1.2;
      deps.toast(`🌐 ${g.flag} ${g.nm} спечели „${t.nm}“ с ${B(best.bid)}${t.my ? ` (твоята оферта: ${B(t.my)}${t.my > best.bid ? ' — но нямаше пари' : ''})` : ''} — тя расте в класацията.`, 'bad'); }
  }
  function dailyTick() {
    const S = deps.S(); if (!S || !S.holding) return; const c = st(), e = deps.econ();
    if (c.tender && S.day >= c.tender.due) concResolve();
    if (!c.tender && deps.empire() && S.day % 20 === 0) concOpen(S.day);
    for (const g of GLOBAL) { const r = c.gl[g.id]; r.w = Math.max(g.w * 0.4, r.w * (1 + 0.00028 + (Math.random() - 0.5) * 0.006)); }
    let inc = 0;
    for (const g of GLOBAL) { const r = c.gl[g.id]; inc += r.merged ? r.w * MERGED_INC : r.w * r.stake * STAKE_DIV; }
    const loc = deps.localFirms().filter(x => c.loc[x.f.id]); inc += loc.reduce((a, x) => a + locValue(x) * LOC_INC, 0); inc += (c.conc || []).reduce((a, x) => a + x.inc, 0);
    if (inc >= 1) e.earn(Math.round(inc), 'придобивания', 'Холдинг: дивиденти и печалба от придобитите фирми');
    c.incDay = Math.round(inc);
    if (c.ipo && c.ipo.out > 0) {   // дивидентите към външните акционери и тяхното настроение
      const pay = Math.round(Math.max(0, deps.dailyNet()) * Math.max(0.3, c.ipo.div) * c.ipo.out);   // акционерите имат право поне на 30% от печалбата си
      if (pay > 0) { e.spend(pay, 'борса', `Дивидент към акционерите (${Math.round(c.ipo.div * 100)}%)`); c.ipo.paid = (c.ipo.paid || 0) + pay; }
      const tgt = 0.6 + c.ipo.div * 0.8 + (deps.dailyNet() > 0 ? 0.1 : -0.2);
      c.ipo.mood = Math.max(0.5, Math.min(1.8, c.ipo.mood + (tgt - c.ipo.mood) * 0.03 + (Math.random() - 0.5) * 0.02)); c.ipo.divDay = pay;
    }
    if (c.ipo) c.ipo.hist = [...(c.ipo.hist || []), sharePrice()].slice(-90);
    const r = myRank();
    if (r < c.best) { const was = c.best; c.best = r;
      if (r === 1 && !c.top1) { c.top1 = S.day; deps.pop && deps.pop('empire', '🏆 Най-голямата компания в света!', `${deps.brandName()} е №1 в света с ${B(myValue())}. От първата къща до върха — поздравления!`); deps.sound && deps.sound('levelup'); }
      else if (was < 99) deps.toast(`🏆 ${deps.brandName()} се изкачи на №${r} в световната класация!`, 'good'); }
  }

  // ---- изгледи (подтабове в „🏛️ Холдинг“)
  const spark = h => { if (!h || h.length < 2) return ''; const W = 560, H = 70, mx = Math.max(...h), mn = Math.min(...h), d = mx - mn || 1; return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:70px;display:block"><polyline points="${h.map((v, i) => `${(i / (h.length - 1) * W).toFixed(1)},${(H - (v - mn) / d * H).toFixed(1)}`).join(' ')}" fill="none" stroke="#7dffa8" stroke-width="2.5"/></svg>`; };
  function rankHtml() {
    const R = ranking(), mx = R[0].w, r = myRank(), c = st();
    let h = `<div class="bw-stats"><div><b style="color:#ffd54a">№${r}</b><span>в света</span></div><div><b>${B(myValue())}</b><span>стойност на холдинга</span></div><div><b>${r > 1 ? B(R[r - 2].w - myValue()) : '👑'}</b><span>${r > 1 ? `до №${r - 1}` : 'ти си първи'}</span></div></div>`;
    h += `<div class="meta" style="margin:8px 0">🏆 Стойността = ${PE} години печалба + развитието на мрежите (жп, магистрали, пристанища, летища, завършени градове, завладени държави) + дружествата, концесиите и мегапроектите + половината от натрупаните пари. Целта: <b>№1 в света</b>${c.top1 ? ` — постигната на ден ${c.top1} 👑` : ''}.</div>`;
    h += R.map((x, i) => `<div class="card" style="padding:8px 12px;${x.me ? 'border:1px solid #ffd54a;background:rgba(255,213,74,.08)' : ''}"><div class="row" style="margin:0;align-items:center;gap:10px"><b style="width:30px;color:${i < 3 ? '#ffd54a' : 'var(--mut,#9aa)'}">${i + 1}.</b><span style="font-size:20px">${x.ico}</span><span class="meta" style="margin:0;flex:1"><b style="color:var(--txt)">${x.flag} ${x.nm}</b>${x.me ? ' · ти' : ` · ${x.sec}${x.stake ? ` · <span style="color:var(--ok)">твои ${Math.round(x.stake * 100)}%</span>` : ''}`}</span><b>${B(x.w)}</b></div><div class="bar" style="height:4px;margin:6px 0 0"><i style="width:${Math.round(x.w / mx * 100)}%;${x.me ? 'background:#ffd54a' : ''}"></i></div></div>`).join('');
    return h;
  }
  // до ниво 20 придобиванията се виждат само замъглени (80%) — като изненада, какво идва
  function acqHtml() {
    if (deps.empire()) return acqBody();
    return `<div style="position:relative"><div style="filter:blur(6px) saturate(.6);opacity:.2;pointer-events:none;user-select:none" aria-hidden="true">${acqBody(true)}</div>
      <div style="position:absolute;inset:0;display:flex;align-items:flex-start;justify-content:center;padding-top:40px"><div class="card" style="max-width:440px;text-align:center;border:1px solid #ffd54a"><div style="font-size:34px">🔒</div><b>🤝 Придобиванията се отварят на ниво 20 — Световна империя</b><div class="meta" style="margin:6px 0 0">Тогава изкупуваш местните конкуренти (спират да ти вземат поръчките), купуваш дялове от световните конгломерати и ги поглъщаш.</div></div></div></div>`;
  }
  function acqBody(preview = false) {
    const c = st(), e = deps.econ();
    let h = `<div class="bw-stats"><div><b style="color:var(--ok)">+${f(c.incDay || 0)} €</b><span>дивиденти и печалба на ден</span></div><div><b>${GLOBAL.filter(g => c.gl[g.id].merged).length}</b><span>погълнати конгломерата</span></div><div><b>${Object.keys(c.loc).length}</b><span>изкупени местни фирми</span></div></div>`;
    const gl = deps.empire() || preview;
    h += `<div class="sect" style="margin:10px 0 4px">🌍 Световни конгломерати — по 10% (+${Math.round((PREMIUM - 1) * 100)}% премия); от 50% нагоре ги поглъщаш${gl ? '' : ' · 🔒 ниво 20'}</div>`;
    if (!gl) h += `<div class="card"><div class="meta" style="margin:0">🔒 На <b>ниво 20 — Световна империя</b> купуваш дялове от световните конгломерати и ги поглъщаш, и наддаваш за световни концесии. Дотогава — изкупувай местните конкуренти.</div></div>`;
    else h += GLOBAL.map(g => { const r = c.gl[g.id], cost = trancheCost(g.id);
      return `<div class="card" style="padding:8px 12px;${r.merged ? 'opacity:.75;border-left:4px solid #ffd54a' : ''}"><div class="row" style="margin:0;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:20px">${g.ico}</span><span class="meta" style="margin:0;flex:1"><b style="color:var(--txt)">${g.flag} ${g.nm}</b> · ${g.sec} · ${B(r.w)}<br>${r.merged ? `👑 погълната на ден ${r.merged} · носи ~${f(Math.round(r.w * MERGED_INC))} €/ден` : r.stake ? `твои <b style="color:var(--ok)">${Math.round(r.stake * 100)}%</b> · дивидент ~${f(Math.round(r.w * r.stake * STAKE_DIV))} €/ден` : 'нямаш дял'}</span>${r.merged ? '' : `<button class="${r.stake >= 0.4 ? 'btn' : 'btn2'}" data-cstake="${g.id}" ${e.canAfford(cost) ? '' : 'disabled'}>${r.stake >= 0.4 ? '👑 Погълни' : '🤝 +10%'} · ${B(cost)}</button>`}</div></div>`; }).join('');
    const L = deps.localFirms();
    h += `<div class="sect" style="margin:12px 0 4px">🏢 Местни конкуренти в държавите, където си — изкупената фирма спира да ти взема поръчки</div>`;
    { const own = L.filter(x => c.loc[x.f.id]).sort((a, b) => c.loc[b.f.id] - c.loc[a.f.id]), rest = L.filter(x => !c.loc[x.f.id]);
      const L0 = L; const show = [...rest, ...own.slice(0, 10)];   // изкупените — само последните 10 (иначе прозорецът става огромен)
      { const L = show;
        h += L.length ? L.map(x => { const own = c.loc[x.f.id], cost = locValue(x); return `<div class="row" style="margin:4px 0;align-items:center;gap:8px"><span class="meta" style="margin:0;flex:1">${x.f.ico} <b style="color:var(--txt)">${x.f.nm}</b> · ${x.cc} ${x.cnm}${own ? ` · <span style="color:var(--ok)">твоя от ден ${own}</span>` : ''}</span>${own ? '' : `<button class="btn2" data-cloc="${x.f.id}" ${e.canAfford(cost) ? '' : 'disabled'}>🤝 ${B(cost)}</button>`}</div>`; }).join('') : '<div class="meta">Няма конкуренти.</div>';
      }
      if (own.length > 10) h += `<details style="margin:4px 0"><summary class="meta" style="cursor:pointer">▾ още ${own.length - 10} изкупени по-рано (общо ${own.length} от ${L0.length})</summary>${own.slice(10).map(x => `<div class="meta" style="margin:2px 0 2px 10px">${x.f.ico} ${x.f.nm} · ${x.cc} ${x.cnm} · от ден ${c.loc[x.f.id]}</div>`).join('')}</details>`;
    }
    return h;
  }
  // борсата — нагледно: лента 0–100% (твои / чужди акции), какво печелиш и какво губиш на ден, какво носи всеки бутон и за колко се изплаща
  function ipoHtml() {
    const c = st(), I = c.ipo, v = myValue(), mood = I ? I.mood : 1, cap = v * mood, out = I ? I.out : 0, mine = 1 - out, net = Math.max(0, deps.dailyNet());
    const divK = I ? Math.max(0.3, I.div) : 0.3, divDay = Math.round(net * divK * out), keep = net - divDay;
    const trSell = Math.round(cap * TRANCHE * 0.95 / 1e6) * 1e6, trBuy = Math.round(cap * TRANCHE * 1.05 / 1e6) * 1e6, perTr = Math.round(net * divK * TRANCHE);
    const pct = x => `${Math.round(x * 100)}%`, sh = x => f(Math.round(SHARES * x)), dur = d => d > 3650 ? 'никога (над 10 г.)' : d > 730 ? `~${Math.round(d / 365)} г.` : `~${f(d)} дни`;
    let h = `<div class="bw-stats"><div><b>${f(sharePrice())} €</b><span>цена на 1 акция</span></div><div><b>${B(cap)}</b><span>стойност на целия холдинг</span></div><div><b style="color:var(--ok)">${B(cap * mine)}</b><span>стойност на твоите акции</span></div>${I ? `<div><b style="color:${mood >= 1 ? 'var(--ok)' : 'var(--bad)'}">${mood >= 1.1 ? '😀' : mood >= 0.9 ? '🙂' : '😟'} ${Math.round(mood * 100)}%</b><span>настроение на пазара</span></div>` : ''}</div>`;
    // лентата: 100 акции = целият холдинг
    h += `<div class="card"><b>🥧 Кой притежава холдинга (от ${f(SHARES)} акции)</b>
      <div style="display:flex;height:30px;border-radius:8px;overflow:hidden;margin:8px 0 4px;border:1px solid var(--line)">
        <div style="width:${mine * 100}%;background:linear-gradient(90deg,#2e7d32,#43a047);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px">ТИ · ${pct(mine)}</div>
        ${out > 0 ? `<div style="width:${out * 100}%;background:linear-gradient(90deg,#c62828,#e53935);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px">ЧУЖДИ · ${pct(out)}</div>` : ''}</div>
      <div style="position:relative;height:14px;font-size:11px;color:var(--mut)">${[0, 25, 51, 75, 100].map(x => `<span style="position:absolute;left:${x}%;transform:translateX(-${x === 100 ? 100 : x ? 50 : 0}%)">${x === 51 ? '51% · контрол' : x + '%'}</span>`).join('')}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
        <div style="flex:1 1 220px;padding:8px 10px;border-radius:10px;background:rgba(67,160,71,.12)"><b style="color:var(--ok)">🟩 Твоите ${sh(mine)} акции</b><div class="meta" style="margin:4px 0 0">Стойност <b style="color:var(--txt)">${B(cap * mine)}</b><br>Печалба за теб: <b style="color:var(--ok)">+${f(keep)} €/ден</b>${out ? `<br>Получени от продажби: <b style="color:var(--txt)">${B(I.raised || 0)}</b>` : ''}</div></div>
        <div style="flex:1 1 220px;padding:8px 10px;border-radius:10px;background:rgba(229,57,53,.12)"><b style="color:var(--bad)">🟥 Чуждите ${sh(out)} акции</b><div class="meta" style="margin:4px 0 0">${out ? `Стойност <b style="color:var(--txt)">${B(cap * out)}</b><br>Губиш (дивидент): <b style="color:var(--bad)">−${f(divDay)} €/ден</b><br>Изплатено досега: <b style="color:var(--txt)">${(I.paid || 0) >= 1e6 ? B(I.paid) : f(I.paid || 0) + ' €'}</b>` : 'Още няма — холдингът е изцяло твой.'}</div></div>
      </div></div>`;
    if (I && I.hist && I.hist.length > 1) { const mx = Math.max(...I.hist), mn = Math.min(...I.hist), last = I.hist[I.hist.length - 1], first = I.hist[0];
      h += `<div class="card"><div class="row" style="margin:0;align-items:center"><b style="flex:1">📈 Цена на акцията · последните ${I.hist.length} дни</b><span class="meta" style="margin:0;color:${last >= first ? 'var(--ok)' : 'var(--bad)'}">${last >= first ? '▲' : '▼'} ${Math.round((last / first - 1) * 100)}%</span></div>${spark(I.hist)}<div class="meta" style="margin:2px 0 0;display:flex;justify-content:space-between"><span>мин ${f(mn)} €</span><span>сега <b style="color:var(--txt)">${f(last)} €</b></span><span>макс ${f(mx)} €</span></div></div>`; }
    // какво прави всеки бутон — с числата
    h += `<div class="card"><b>🧮 Какво става, ако…</b>
      ${out < IPO_MAX - 1e-9 ? `<div class="row" style="margin:8px 0 0;gap:8px;flex-wrap:wrap;align-items:center"><span class="meta" style="margin:0;flex:1 1 300px">🔔 <b style="color:var(--txt)">Продадеш още 10%</b>: получаваш <b style="color:var(--ok)">${B(trSell)}</b> веднага, но всеки ден даваш още ~<b style="color:var(--bad)">${f(perTr)} €</b> дивидент${perTr ? ` (изплаща се за ${dur(Math.round(trSell / perTr))})` : ''}. Стоиш ${pct(mine - TRANCHE)} собственик.</span><button class="btn" data-cipo="1">🔔 Продай 10% · ${B(trSell)}</button></div>` : `<div class="meta" style="margin:8px 0 0">🔒 Продал си максимума (${pct(IPO_MAX)}) — над него губиш контрола.</div>`}
      ${out >= TRANCHE - 1e-9 ? `<div class="row" style="margin:8px 0 0;gap:8px;flex-wrap:wrap;align-items:center"><span class="meta" style="margin:0;flex:1 1 300px">🔁 <b style="color:var(--txt)">Изкупиш 10%</b>: плащаш <b style="color:var(--bad)">${B(trBuy)}</b>, а всеки ден спестяваш ~<b style="color:var(--ok)">${f(perTr)} €</b> дивидент${perTr ? ` (изплаща се за ${dur(Math.round(trBuy / perTr))})` : ''}.</span><button class="btn2" data-cbuyb="1">🔁 Изкупи 10% · ${B(trBuy)}</button></div>` : ''}
      ${I && out ? `<div class="row" style="margin:10px 0 0;gap:6px;flex-wrap:wrap;align-items:center"><span class="meta" style="margin:0;flex:1 1 300px">💸 <b style="color:var(--txt)">Дивидент</b> — колко от печалбата на чуждите акции им плащаш. По-голям = по-доволни акционери → по-висока цена на акцията (и на следващата продажба), но по-малко пари за теб.</span>${[0.3, 0.4, 0.5, 0.6].map(d => `<button class="${I.div === d ? 'btn' : 'btn2'}" data-cdiv="${d}" title="~${f(Math.round(net * d * out))} €/ден">${Math.round(d * 100)}%</button>`).join('')}</div>` : ''}
      ${!I ? `<div class="meta" style="margin:8px 0 0">Холдингът още не е на борсата. Първата продажба го листва — получаваш капитал за придобивания и мегапроекти, а контролът (над 51%) остава твой.</div>` : ''}</div>`;
    return h;
  }
  function concHtml() {
    const c = st(), S = deps.S(), e = deps.econ(), t = c.tender, f2 = n => deps.fmt(n);
    if (!deps.empire()) return `<div class="card"><div class="meta" style="margin:0">🔒 Световните концесии са на <b>ниво 20</b>.</div></div>`;
    let h = `<div class="bw-stats"><div><b>${(c.conc || []).length}</b><span>концесии</span></div><div><b style="color:var(--ok)">+${f2((c.conc || []).reduce((a, x) => a + x.inc, 0))} €</b><span>приход на ден</span></div></div>`;
    h += `<div class="meta" style="margin:8px 0">🌐 На всеки ~20 дни се отваря световен търг. Ти и два конгломерата наддавате тайно 7 дни — печели най-високата оферта (плащаш само ако спечелиш). Загубиш ли, конкурентът расте в класацията.</div>`;
    if (t) { const stars = b => '★'.repeat(Math.max(1, Math.min(5, Math.round((b / t.price - 0.9) * 10))));
      h += `<div class="card" style="border:1px solid #ffd54a"><h3 style="margin:0 0 6px">${t.ico} ${t.nm}</h3><div class="meta" style="margin:0 0 6px">Начална цена ${B(t.price)} · приход ~${f2(t.inc)} €/ден · край на ден ${t.due} (още ${t.due - S.day} д.)<br>Срещу теб: ${t.riv.map(r => { const g = GLOBAL.find(x => x.id === r.id); return `${g.flag} ${g.nm} (интерес ${stars(r.bid)})`; }).join(' · ')}${t.my ? `<br>Твоята оферта: <b>${B(t.my)}</b>` : ''}</div>
        <div class="row" style="margin:0;gap:6px;flex-wrap:wrap;justify-content:flex-end">${[1, 1.15, 1.3, 1.45].map(k => `<button class="${t.my === Math.round(t.price * k / 1e8) * 1e8 ? 'btn' : 'btn2'}" data-cbid="${k}" ${e.canAfford(t.price * k) ? '' : 'disabled'}>${B(Math.round(t.price * k / 1e8) * 1e8)}</button>`).join('')}</div></div>`; }
    else h += `<div class="card"><div class="meta" style="margin:0">Няма отворен търг — следващият идва скоро.</div></div>`;
    if ((c.conc || []).length) h += `<div class="card"><h3 style="margin:0 0 6px">📜 Твоите концесии</h3>${c.conc.map(x => `<div class="meta" style="margin:3px 0">${x.ico} <b style="color:var(--txt)">${x.nm}</b> · платено ${B(x.price)} · +${f2(x.inc)} €/ден · от ден ${x.day}</div>`).join('')}</div>`;
    return h;
  }
  function bind(box, rerender) {
    const on = (sel, fn) => box.querySelectorAll(sel).forEach(b => b.onclick = () => { fn(b); rerender(); });
    on('[data-cbid]', b => concBid(+b.dataset.cbid));
    on('[data-cstake]', b => buyStake(b.dataset.cstake)); on('[data-cloc]', b => buyLocal(b.dataset.cloc));
    on('[data-cipo]', () => sellTranche()); on('[data-cbuyb]', () => buyBack()); on('[data-cdiv]', b => setDiv(+b.dataset.cdiv));
  }
  const acquired = id => !!(deps.S()?.corp?.loc || {})[id];
  return { state: st, concHtml, concOpen, concResolve, myValue, ranking, myRank, dailyTick, rankHtml, acqHtml, ipoHtml, bind, acquired, buyStake, buyLocal, sellTranche };
}
