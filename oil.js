// oil.js — 🛢️ Петролната империя (Петролиум, ерата на холдинга): петролът и горивото от находищата и рафинериите (mines.js)
// не се продават направо, а влизат в танкова ферма. Оттам:
//   • продаваш на световния пазар — цената се мени всеки ден (ОПЕК, кризи, студени зими); можеш да чакаш по-добра цена;
//   • изпълняваш договори за доставка — фиксирана цена, количество и срок; карат го твоите танкери (⚓ Кораби → Танкер);
//   • зареждаш своите бензиностанции в градовете — продават гориво на дребно всеки ден.
// Записът: S.oil = { px, fpx, hist: [[px, fpx]], ev, stock: { crude, fuel }, auto, contracts: [], offers: [], stations: { [id]: lv }, seq, earned }.
export const CRUDE_P = 55, FUEL_P = 1300;   // базовите цени (€/бар. и €/хил. л) — като в mines.js
export const TANK_CAP = { crude: 400000, fuel: 40000 };   // танкова ферма: максимум на склад
export const TANKER_CAP = { crude: 9000, fuel: 1100 };    // един танкер за седмица
const STATION = { cost: 3e6, perDay: 6, retail: 1.45, upCost: 2e6, lvMax: 3 };   // хил. л на ден на ниво; цена на дребно ×1.45 от пазарната
// твоите цени: retail — цената на дребно в бензиностанциите (× пазарната; по-скъпо → по-малко клиенти), minPx — под каква пазарна цена
// автоматичната продажба чака (0 = продава на всяка цена; 1.15 = само ако барелът е поне 15% над нормалното)
const RETAIL_OPTS = [1.2, 1.35, 1.45, 1.6, 1.8], MINPX_OPTS = [0, 1, 1.15, 1.3];
const demandOf = r => Math.min(1.6, Math.pow(STATION.retail / r, 2));   // ×1.2 → ~1.46 пъти повече клиенти, ×1.8 → ~0.65
const EVENTS = [
  { k: 'opec', nm: 'ОПЕК намали добива', ico: '🛢️', mul: 1.35, days: 45 },
  { k: 'crisis', nm: 'Световна икономическа криза', ico: '📉', mul: 0.7, days: 50 },
  { k: 'winter', nm: 'Студена зима — горивото поскъпва', ico: '❄️', mul: 1.2, fuel: 1.25, days: 35 },
  { k: 'war', nm: 'Напрежение в Залива — танкерите плават по-дълго', ico: '⚠️', mul: 1.5, days: 25 },
  { k: 'glut', nm: 'Пренасищане на пазара', ico: '🛳️', mul: 0.8, days: 40 },
];
const DESTS = ['rotterdam', 'hamburg', 'marseille', 'naples', 'athens', 'istanbul', 'varna', 'mumbai', 'singapore', 'shanghai', 'tokyo', 'newyork', 'houston'];

// deps: { S, econ, fmt, toast, save, sound, pop(key, cap, sub), cityName(id), cityOk(id), ownedCities(), tankers() → брой, oilSites() → mines сайтове, terminalCity() → id | null, isAm(id) }
export function createOil(deps) {
  const st = () => { const S = deps.S(); S.oil = S.oil || { px: 1, fpx: 1, hist: [], stock: { crude: 0, fuel: 0 }, auto: true, contracts: [], offers: [], stations: {}, seq: 0, earned: 0 }; return S.oil; };
  const active = () => !!deps.terminalCity();   // империята почва с първия петролен терминал
  const crudeP = () => Math.round(CRUDE_P * st().px * 10) / 10, fuelP = () => Math.round(FUEL_P * st().px * (st().fpx || 1));
  const priceOf = (m, q) => Math.round(q * (m === 'crude' ? crudeP() : fuelP()) * (deps.priceMul ? deps.priceMul() : 1));   // 🛢️ петролопроводът — +10%
  const unit = m => m === 'crude' ? 'бар.' : 'хил. л', nm = m => m === 'crude' ? '🛢️ суров петрол' : '⛽ гориво';
  const capWeek = m => deps.tankers() * TANKER_CAP[m];

  // склад: какво идва от mines.js (терминалът вече не продава сам — влиза тук)
  function intake(m, q) { const o = st(); o.stock[m] = Math.min(TANK_CAP[m], (o.stock[m] || 0) + q); o.inToday = o.inToday || { crude: 0, fuel: 0 }; o.inToday[m] += q; }
  // колко влиза на ден средно (последните 14 дни) — по това се мерят договорите
  const rateOf = m => { const h = (st().inRate || []).map(x => x[m] || 0); return h.length ? h.reduce((a, v) => a + v, 0) / h.length : 0; };
  const reserved = m => st().contracts.filter(c => c.m === m).reduce((a, c) => a + c.q - c.sent, 0);
  function sell(m, q = null) {
    const o = st(); q = Math.floor(q == null ? o.stock[m] : Math.min(q, o.stock[m])); if (q <= 0) return 0;
    const got = priceOf(m, q); o.stock[m] -= q; deps.econ().earn(got, 'петрол', `Продажба на пазара: ${deps.fmt(q)} ${unit(m)} ${nm(m).slice(3)}`); o.earned += got; o.dayIn = (o.dayIn || 0) + got; return got;
  }

  // пазарът: цената върви към целта (1.0, или целта на събитието), с малък шум
  function market(day) {
    const o = st();
    if (o.ev && day >= o.ev.until) { o.ev = null; deps.toast('🛢️ Пазарът на петрола се успокои.', ''); }
    if (!o.ev && Math.random() < 1 / 60) { const e = EVENTS[Math.floor(Math.random() * EVENTS.length)]; o.ev = { k: e.k, nm: e.nm, ico: e.ico, mul: e.mul, fuel: e.fuel || 1, until: day + e.days };
      deps.pop && deps.pop('ship-cargo', `${e.ico} ${e.nm}`, `Петролът ${e.mul > 1 ? 'поскъпва' : 'поевтинява'} за около ${e.days} дни. ${e.mul > 1 ? 'Добро време да продаваш от склада.' : 'По-добре пази петрола в танковете.'}`); }
    const tgt = o.ev ? o.ev.mul : 1, ftgt = o.ev ? o.ev.fuel : 1;
    o.px = Math.max(0.45, Math.min(2.2, o.px + (tgt - o.px) * 0.06 + (Math.random() - 0.5) * 0.05));
    o.fpx = Math.max(0.8, Math.min(1.4, (o.fpx || 1) + (ftgt - (o.fpx || 1)) * 0.08 + (Math.random() - 0.5) * 0.02));
    o.hist = [...(o.hist || []), [Math.round(o.px * 1000) / 1000, Math.round(o.fpx * 1000) / 1000]].slice(-90);
  }

  // договори: оферта → приемаш → седмично танкерите карат от склада → при пълно количество — плащане; закъснението — неустойка
  function makeOffer(day) {
    const o = st(), dests = DESTS.filter(id => deps.cityOk(id)); if (!dests.length || o.offers.length >= 3) return;
    const m = Math.random() < 0.55 ? 'crude' : 'fuel', to = dests[Math.floor(Math.random() * dests.length)];
    const r = Math.max(rateOf(m), m === 'crude' ? 300 : 40), days0 = 60 + Math.round(Math.random() * 60);   // по силите ти: 40–80% от добива за срока
    const q = Math.max(m === 'crude' ? 2000 : 200, Math.round(r * days0 * (0.4 + Math.random() * 0.4) / 100) * 100);
    const prem = 1.12 + Math.random() * 0.2, unitP = (m === 'crude' ? CRUDE_P : FUEL_P) * Math.max(1, o.px) * prem, days = days0;
    o.offers.push({ id: ++o.seq, m, to, q, price: Math.round(q * unitP), days, exp: day + 10 });
  }
  function accept(id) {
    const o = st(), f = o.offers.find(x => x.id === id); if (!f) return;
    if (!deps.tankers()) { deps.toast('⚓ Нямаш танкер — купи от „⚓ Кораби“ (Танкер), за да изпълняваш договори.', 'bad'); return; }
    o.offers = o.offers.filter(x => x !== f); o.contracts.push({ ...f, sent: 0, due: deps.S().day + f.days, trips: 0 });
    deps.toast(`🤝 Договор: ${deps.fmt(f.q)} ${unit(f.m)} ${nm(f.m).slice(3)} до ${deps.cityName(f.to)} за ${deps.fmt(f.price)} € — срок ${f.days} дни.`, 'good'); deps.sound && deps.sound('buy'); deps.save();
  }
  const decline = id => { const o = st(); o.offers = o.offers.filter(x => x.id !== id); deps.save(); };
  function deliver(day) {
    const o = st(); let capC = capWeek('crude'), capF = capWeek('fuel');
    for (const c of [...o.contracts]) {
      const cap = c.m === 'crude' ? capC : capF, q = Math.min(cap, c.q - c.sent, Math.floor(o.stock[c.m] || 0));
      if (q > 0) { o.stock[c.m] -= q; c.sent += q; c.trips++; c.last = day; if (c.m === 'crude') capC -= q; else capF -= q; }
      if (c.sent >= c.q) { const late = Math.max(0, day - c.due), pay = Math.round(c.price * (late ? Math.max(0.6, 1 - late * 0.02) : 1));
        deps.econ().earn(pay, 'петрол', `Договор за ${nm(c.m).slice(3)} до ${deps.cityName(c.to)}`); o.earned += pay; o.dayIn = (o.dayIn || 0) + pay;
        o.contracts = o.contracts.filter(x => x !== c); o.done = (o.done || 0) + 1;
        deps.pop && deps.pop('ship-cargo', `🛳️ Доставено: ${deps.cityName(c.to)}`, `${deps.fmt(c.q)} ${unit(c.m)} ${nm(c.m).slice(3)} · +${deps.fmt(pay)} €${late ? ` (закъснение ${late} д. — неустойка)` : ''}`); deps.sound && deps.sound('cash'); }
      else if (day > c.due + 30) { const pen = Math.round(c.price * 0.2); deps.econ().spend(pen, 'петрол', `Неустойка: неизпълнен договор до ${deps.cityName(c.to)}`); o.contracts = o.contracts.filter(x => x !== c);
        deps.toast(`❌ Договорът до ${deps.cityName(c.to)} е развален — неустойка ${deps.fmt(pen)} €.`, 'bad'); }
    }
  }

  // бензиностанции: всеки ден продават гориво на дребно от склада (без гориво — стоят)
  const stationCost = id => Math.round(STATION.cost * (deps.isAm(id) ? 2 : 1));
  function buyStation(id) {
    const o = st(); if (o.stations[id]) return; const c = stationCost(id), e = deps.econ();
    if (!e.canAfford(c)) { deps.toast(`Нямаш ${deps.fmt(c)} €.`, 'bad'); return; }
    e.spend(c, 'покупка', `⛽ Бензиностанции в ${deps.cityName(id)}`); deps.xp && deps.xp(300); o.stations[id] = 1; deps.toast(`⛽ Веригата бензиностанции в ${deps.cityName(id)} е отворена.`, 'good'); deps.sound && deps.sound('buy'); deps.save();
  }
  function upStation(id) {
    const o = st(), L = o.stations[id]; if (!L || L >= STATION.lvMax) return; const c = STATION.upCost * L * (deps.isAm(id) ? 2 : 1), e = deps.econ();
    if (!e.canAfford(c)) { deps.toast(`Нямаш ${deps.fmt(c)} €.`, 'bad'); return; }
    e.spend(c, 'покупка', `⛽ Още бензиностанции в ${deps.cityName(id)}`); deps.xp && deps.xp(150); o.stations[id] = L + 1; deps.sound && deps.sound('upgrade'); deps.save();
  }
  function stationsDay() {
    const o = st(); let sold = 0, got = 0;
    const r = o.retail || STATION.retail, dem = demandOf(r);
    for (const [id, L] of Object.entries(o.stations || {})) { const q = Math.min(Math.round(STATION.perDay * L * dem), Math.floor(o.stock.fuel || 0)); if (q <= 0) continue; o.stock.fuel -= q; sold += q; got += Math.round(q * fuelP() * r); }
    if (got) { deps.econ().earn(got, 'петрол', `⛽ Бензиностанции: ${deps.fmt(sold)} хил. л`); o.earned += got; o.dayIn = (o.dayIn || 0) + got; }
    o.stSold = sold; return got;
  }

  function dailyTick() {
    const S = deps.S(); if (!S || !active()) return; const o = st(), day = S.day;
    o.dayIn = 0; market(day);
    if (day % 4 === 0) makeOffer(day);
    o.offers = o.offers.filter(f => f.exp >= day);
    stationsDay();
    if (day % 7 === 0) { deliver(day); if (o.auto && !(o.ev && o.ev.mul < 1) && o.px >= (o.minPx || 0)) { sell('crude', Math.max(0, o.stock.crude - reserved('crude'))); sell('fuel', Math.max(0, o.stock.fuel - reserved('fuel') - stationsNeed() * 7)); } }   // договорите и бензиностанциите — с предимство
    o.inRate = [...(o.inRate || []), o.inToday || { crude: 0, fuel: 0 }].slice(-14); o.inToday = { crude: 0, fuel: 0 };
    o.inHist = [...(o.inHist || []), o.dayIn].slice(-14);
  }
  const stationsNeed = () => Object.values(st().stations || {}).reduce((a, L) => a + STATION.perDay * L, 0) * demandOf(st().retail || STATION.retail);
  const dailyAvg = () => { const h = st().inHist || []; return h.length ? Math.round(h.reduce((a, v) => a + v, 0) / h.length) : 0; };

  // 📈 графика на цената (последните 90 дни)
  function chart() {
    const h = st().hist || []; if (h.length < 2) return '';
    const W = 560, H = 90, mx = Math.max(1.6, ...h.map(x => x[0])), mn = Math.min(0.5, ...h.map(x => x[0]));
    const pts = h.map((x, i) => `${(i / (h.length - 1) * W).toFixed(1)},${(H - (x[0] - mn) / (mx - mn) * H).toFixed(1)}`).join(' '), y1 = (H - (1 - mn) / (mx - mn) * H).toFixed(1);
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:90px;display:block"><line x1="0" y1="${y1}" x2="${W}" y2="${y1}" stroke="rgba(255,255,255,.2)" stroke-dasharray="4 4"/><polyline points="${pts}" fill="none" stroke="#ffb300" stroke-width="2.5"/></svg>`;
  }

  function winHtml() {
    const o = st(), f = deps.fmt, S = deps.S(), term = deps.terminalCity();
    if (!term) return `<div class="card"><div class="meta" style="margin:0">🔒 <b>Петролната империя</b> почва с първия <b>⚓ петролен терминал</b> (⛏️ Добив → Азия). Тогава петролът и горивото влизат в твоята танкова ферма, а ти решаваш кога и на кого да ги продадеш.</div></div>`;
    const tk = deps.tankers(), dp = Math.round((o.px - 1) * 100);
    let h = `<div class="bw-stats"><div><b style="color:${dp >= 0 ? 'var(--ok)' : 'var(--bad)'}">${f(crudeP())} €</b><span>🛢️ барел (${dp >= 0 ? '+' : ''}${dp}%)</span></div><div><b>${f(fuelP())} €</b><span>⛽ хил. л гориво</span></div><div><b>${f(Math.floor(o.stock.crude))} / ${f(TANK_CAP.crude)}</b><span>бар. в танковете</span></div><div><b>${f(Math.floor(o.stock.fuel))} / ${f(TANK_CAP.fuel)}</b><span>хил. л гориво</span></div><div><b style="color:var(--ok)">+${f(dailyAvg())} €</b><span>приход на ден</span></div></div>`;
    h += `<div class="card"><div class="row" style="margin:0 0 4px;align-items:center"><b style="flex:1">📈 Цена на петрола — 90 дни</b>${o.ev ? `<span class="meta" style="margin:0;color:#ffd54a">${o.ev.ico} ${o.ev.nm} · още ${o.ev.until - S.day} д.</span>` : '<span class="meta" style="margin:0">пазарът е спокоен</span>'}</div>${chart() || '<div class="meta">Графиката се появява след няколко дни.</div>'}
      <div class="row" style="margin:8px 0 0;gap:6px;flex-wrap:wrap;align-items:center"><label class="meta" style="margin:0;flex:1;display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" data-oilauto ${o.auto ? 'checked' : ''}> Продавай сам всяка седмица (без кризите)</label>
      </div>
      <div class="row" style="margin:8px 0 0;gap:6px;flex-wrap:wrap;align-items:center"><span class="meta" style="margin:0;flex:1 1 220px">🎯 <b style="color:var(--txt)">Автоматично продавай само над</b> — иначе петролът чака в танковете за по-добра цена</span>${MINPX_OPTS.map(k => `<button class="${(o.minPx || 0) === k ? 'btn' : 'btn2'}" data-oilmin="${k}">${k ? `${f(Math.round(CRUDE_P * k))} €/бар.` : 'всяка цена'}</button>`).join('')}</div>
      ${o.auto && o.px < (o.minPx || 0) ? `<div class="meta" style="margin:4px 0 0;color:#ffd54a">⏳ Барелът е ${f(crudeP())} € — под твоите ${f(Math.round(CRUDE_P * o.minPx))} €; автоматичната продажба чака.</div>` : ''}
      <div class="row" style="margin:8px 0 0;gap:6px;flex-wrap:wrap;align-items:center"><span class="meta" style="margin:0 auto 0 0">Продай сега на пазарната цена:</span>
      <button class="btn2" data-oilsell="crude" ${o.stock.crude >= 1 ? '' : 'disabled'}>💰 Продай петрола · ${f(priceOf('crude', Math.floor(o.stock.crude)))} €</button><button class="btn2" data-oilsell="fuel" ${o.stock.fuel >= 1 ? '' : 'disabled'}>💰 Продай горивото · ${f(priceOf('fuel', Math.floor(o.stock.fuel)))} €</button></div></div>`;
    { const P = S.mw && S.mw.pipeline; if (P && !P.done) { const n = Object.values(P.tr || {}).filter(x => x.signed).length;   // 🛢️ петролопроводът (megaworld.js)
      h += `<div class="card"><div class="meta" style="margin:0">🛢️ <b style="color:var(--txt)">Петролопровод „Залив — Европа“</b>: ${P.ph || P.run ? `строи се — етап ${(P.ph || 0) + (P.run ? 1 : 0)} от 4` : `държавни договори ${n}/4 — подпиши с Саудитска Арабия, Ирак, Турция и България (Холдинг → 🌍 Мегапроекти)`}. Готовият носи +10% към цената на петрола и горивото.</div></div>`; } }
    // договори
    const un = deps.unlinked ? [...new Set(deps.unlinked())] : [];
    if (un.length) h = `<div class="card" style="border:1px solid #ffb300"><div class="meta" style="margin:0">⚠️ <b style="color:var(--txt)">${un.map(deps.cityName).join(', ')}</b> не е свързан с терминала в ${deps.cityName(term)} — петролът оттам не стига до танковете. Прокарай жп линия или магистрала.</div></div>` + h;
    let c = `<div class="meta" style="margin:0 0 6px">🛳️ Танкери: <b>${tk}</b> → за седмица карат до ${f(capWeek('crude'))} бар. или ${f(capWeek('fuel'))} хил. л. ${tk ? '' : '<span class="late">Купи танкер от „⚓ Кораби“.</span>'} Терминал: ${deps.cityName(term)}.</div>`;
    c += o.contracts.map(x => `<div class="meta" style="margin:4px 0">🛳️ <b style="color:var(--txt)">${deps.cityName(x.to)}</b> · ${nm(x.m)} ${f(x.sent)} / ${f(x.q)} ${unit(x.m)} · ${f(x.price)} € · <span class="${S.day > x.due ? 'late' : ''}">срок ден ${x.due}</span><div class="bar" style="height:5px;margin:3px 0 0"><i style="width:${Math.round(x.sent / x.q * 100)}%"></i></div></div>`).join('');
    c += o.offers.map(x => { const mk = priceOf(x.m, x.q); return `<div class="row" style="margin:6px 0;align-items:center;gap:6px;flex-wrap:wrap"><span class="meta" style="margin:0;flex:1">📜 <b style="color:var(--txt)">${deps.cityName(x.to)}</b> иска ${nm(x.m)} ${f(x.q)} ${unit(x.m)} за ${x.days} дни · <b style="color:var(--ok)">${f(x.price)} €</b> <span style="color:${x.price >= mk ? 'var(--ok)' : 'var(--bad)'}">(${x.price >= mk ? '+' : ''}${Math.round((x.price / mk - 1) * 100)}% спрямо пазара)</span> · важи до ден ${x.exp}</span><button class="btn2" data-oildec="${x.id}">Откажи</button><button class="btn" data-oilacc="${x.id}">🤝 Приеми</button></div>`; }).join('');
    if (!o.contracts.length && !o.offers.length) c += '<div class="meta" style="margin:0">Нови запитвания идват на всеки няколко дни.</div>';
    h += `<div class="card"><h3 style="margin:0 0 6px">🤝 Договори за доставка${o.done ? ` <span class="meta" style="margin:0 0 0 auto">изпълнени: ${o.done}</span>` : ''}</h3>${c}</div>`;
    // бензиностанции
    const own = deps.ownedCities();
    const rt = o.retail || STATION.retail;
    let s = `<div class="row" style="margin:0 0 6px;gap:6px;flex-wrap:wrap;align-items:center"><span class="meta" style="margin:0;flex:1 1 240px">🏷️ <b style="color:var(--txt)">Твоята цена на дребно</b>: ${f(Math.round(fuelP() * rt))} €/хил. л (×${rt} от пазарната) · клиенти ${Math.round(demandOf(rt) * 100)}% — по-евтино = повече продажби, по-скъпо = повече печалба на литър</span>${RETAIL_OPTS.map(r => `<button class="${rt === r ? 'btn' : 'btn2'}" data-oilret="${r}" title="${Math.round(demandOf(r) * 100)}% клиенти">×${r}</button>`).join('')}</div>
      <div class="meta" style="margin:0 0 6px">Всяка верига продава до ${STATION.perDay} хил. л гориво на ден на ниво (при ×${STATION.retail}) от танковете. Нужни сега: ${f(stationsNeed())} хил. л/ден${o.stSold != null ? ` · вчера продадени ${f(o.stSold)}` : ''}.</div>`;
    // първо — където още можеш да отвориш (купуваш отгоре), после купените — те слизат надолу, най-новите най-отгоре
    const can = own.filter(id => !o.stations[id]).slice(0, 12);
    if (can.length) s += `<div class="meta" style="margin:4px 0 2px">🛒 Отвори нова верига:</div><div class="row" style="margin:0 0 8px;gap:6px;flex-wrap:wrap">${can.map(id => `<button class="btn2" data-oilst="${id}" ${deps.econ().canAfford(stationCost(id)) ? '' : 'disabled'}>⛽ ${deps.cityName(id)} · ${f(stationCost(id))} €</button>`).join('')}</div>`;
    const mine = Object.entries(o.stations).reverse();
    if (mine.length) s += `<div class="meta" style="margin:4px 0 2px">✅ Твоите вериги (${mine.length}):</div>` + mine.map(([id, L]) => `<div class="row" style="margin:4px 0;align-items:center;gap:6px"><span class="meta" style="margin:0;flex:1">⛽ <b style="color:var(--txt)">${deps.cityName(id)}</b> · ниво ${L} · ${STATION.perDay * L} хил. л/ден</span>${L < STATION.lvMax ? `<button class="btn2" data-oilsup="${id}">⬆️ ${f(STATION.upCost * L * (deps.isAm(id) ? 2 : 1))} €</button>` : ''}</div>`).join('');
    h += `<div class="card"><h3 style="margin:0 0 6px">⛽ Бензиностанции (${Object.keys(o.stations).length})</h3>${s}</div>`;
    return h;
  }
  function bind(box, rerender) {
    const on = (sel, fn) => box.querySelectorAll(sel).forEach(b => b.onclick = () => { fn(b); deps.save(); rerender(); });
    on('[data-oilsell]', b => { const m = b.dataset.oilsell, got = sell(m); if (got) { deps.toast(`💰 Продаде ${nm(m)} за ${deps.fmt(got)} €.`, 'good'); deps.sound && deps.sound('cash'); } });
    on('[data-oilacc]', b => accept(+b.dataset.oilacc)); on('[data-oildec]', b => decline(+b.dataset.oildec));
    on('[data-oilst]', b => buyStation(b.dataset.oilst)); on('[data-oilsup]', b => upStation(b.dataset.oilsup));
    on('[data-oilmin]', b => { st().minPx = +b.dataset.oilmin; }); on('[data-oilret]', b => { st().retail = +b.dataset.oilret; });
    box.querySelectorAll('[data-oilauto]').forEach(b => b.onchange = () => { st().auto = b.checked; deps.save(); });
  }
  return { buyStation, upStation, stationCost, STATION, state: st, active, intake, sell, dailyTick, dailyAvg, winHtml, bind, accept, crudeP, fuelP, market, makeOffer, deliver };
}
