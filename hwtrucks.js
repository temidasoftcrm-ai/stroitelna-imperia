// hwtrucks.js — 🚚 собствени ТИР-ове по магистралите. Купуваш ТИР (таб „Техника“) и той сам си избира курсовете (като влаковете):
// от града, в който е, до друг твой град по ГОТОВИ магистрали и аутобани (твои или на партньора), с товар — цимент, контейнери,
// автомобили или храни. Доход на курс = км × тарифа × товара × (износване) × (задръстване); по чужди участъци (на партньора) — тол.
// Поддръжка 100 €/ден (шофьор и гориво); износва се (обслужването го връща на 100%). По един участък — най-много TRUCK.cap ТИР-а
// (пълните участъци се заобикалят), над TRUCK.free доходът пада. Ако в крайния град имаш склад, ТИР-ът носи и твоите материали
// там — без такса за доставка. Камионите са на фирмата (не на града) — карат и докато си в друг град, както влаковете.
// Записът: S.trucks = [{ id, nm, at, a, b, path:[градове], segs:[{ id, a, b, km, own }], km, total, cond, since, cargo, trips, earned, wait }]
// deps: { S(), econ(), toast, modal, fmt, save, cityName(id), owned(), here(), route(a, b) → { path, segs } | null (само готови участъци),
//         hasWh(id), redraw(), renderPanel(), pop?(key, cap, sub) }
import { feature } from './lab/feature.js';
export const TRUCK = { cost: 25000, upkeep: 100, speed: 260, rate: 1.6, toll: 0.25, cap: 6, free: 3, wearDay: 0.12, minCond: 30, service: 0.2, sell: 0.5, minKm: 60 };
const CARGO = [['цимент', '⚪', 1.0], ['контейнери', '📦', 1.15], ['автомобили', '🚗', 1.35], ['храни', '🥫', 1.1]];

export function createHwTrucks(d) {
  const L = () => { const S = d.S(); return S ? (S.trucks = S.trucks || []) : []; };
  const E = () => d.econ(), f = n => d.fmt(n);
  const segLoad = (id, skip) => L().filter(t => t !== skip && t.segs?.some(s => s.id === id)).length;
  const jam = t => Math.min(1, ...(t.segs || []).map(s => { const n = segLoad(s.id); return n <= TRUCK.free ? 1 : TRUCK.free / n; }));
  const wear = t => 0.5 + (t.cond ?? 100) / 200;   // 100% → ×1, 30% → ×0.65
  const cargoOf = t => CARGO.find(x => x[0] === t.cargo) || CARGO[0];
  const legPay = t => Math.round(t.total * TRUCK.rate * cargoOf(t)[2] * wear(t) * jam(t) / 10) * 10;
  const legToll = t => Math.round((t.segs || []).filter(s => !s.own).reduce((a, s) => a + s.km, 0) * TRUCK.toll);
  const name = id => d.cityName(id);

  // ⚡ маршрутите между два града — веднъж на игрален ден (и наново при нов участък): иначе всеки чакащ ТИР търсеше път до всеки град (perf-report)
  let rc = new Map(), rcKey = '';
  const route = (a, b) => { if (!feature('perf-fix2')) return d.route(a, b); const S = d.S(), k = `${S?.day}|${(S?.hwDone || []).length}|${(S?.abDone || []).length}`; if (k !== rcKey) { rcKey = k; rc = new Map(); } const key = a + '>' + b; if (!rc.has(key)) rc.set(key, d.route(a, b)); return rc.get(key); };
  // сам избира следващия курс: до твой град по готови участъци, без задръстените; по-далечните — по-често
  function autoTrip(t) {
    const from = t.at || d.here(); t.at = from;
    const opts = [], ck = feature('tir-cont') && d.contOf ? (t.cont = t.cont || d.contOf(from)) : null;   // tir-cont: ТИР-ът кара само по своя континент
    for (const id of d.owned()) {
      if (!id || id === from) continue;
      if (ck && d.contOf(id) !== ck) continue;
      const r = route(from, id); if (!r || !r.segs.length) continue;
      if (r.segs.some(s => segLoad(s.id, t) >= TRUCK.cap)) continue;
      const km = r.segs.reduce((a, s) => a + s.km, 0); if (km < TRUCK.minKm) continue;
      opts.push({ id, r, km });
    }
    if (!opts.length) { t.path = null; t.segs = []; t.total = 0; return false; }
    let x = Math.random() * opts.reduce((a, o) => a + Math.sqrt(o.km), 0), o = opts[0];
    for (const q of opts) { x -= Math.sqrt(q.km); if (x <= 0) { o = q; break; } }
    Object.assign(t, { a: from, b: o.id, path: o.r.path, segs: o.r.segs, km: 0, total: o.km, cargo: CARGO[Math.floor(Math.random() * CARGO.length)][0] });
    return true;
  }
  function buy(k) {
    const p = feature('tir-cont') && d.tirPick ? d.tirPick(k) : null;   // tir-cont: таван по континенти (game.js tirPick) — k е континентът от раздела, без него — сам избира
    if (p && p.why) { d.toast(p.why, 'bad'); return; }
    const cap = p ? Infinity : d.cap ? d.cap() : Infinity;   // лимит: 2 на участък магистрала, 4 на участък аутобан (game.js fleetCap)
    if (L().length >= cap) { d.toast(`🚚 Имаш ${L().length}/${cap} ТИР-а — всеки готов участък магистрала дава място за 2, аутобанът — за 4. Построй още пътища.`, 'bad'); return; }
    if (!E().canAfford(TRUCK.cost)) { d.toast(`ТИР струва ${f(TRUCK.cost)} € — нямаш достатъчно.`, 'bad'); return; }
    E().spend(TRUCK.cost, 'покупка', 'ТИР');
    const S = d.S(), t = { id: (S.seq = (S.seq || 1) + 1), nm: `🚚 ТИР №${L().length + 1}`, at: d.here(), path: null, segs: [], km: 0, total: 0, cond: 100, since: S.day, cargo: 'цимент', trips: 0, earned: 0 };
    if (p) { t.at = p.start; t.cont = p.k; }
    L().push(t); d.sound?.('truckBuy'); d.onBuy?.(t);
    const ok = autoTrip(t); d.save(); d.redraw(); d.renderPanel();
    if (!d.pop || !d.pop('tir-bought', '🚚 Закупихте ТИР!', ok ? `${t.nm} тръгва: ${name(t.a)} → ${name(t.b)} с ${t.cargo}.` : 'Чака готова магистрала до друг твой град.'))
      d.toast(ok ? `🚚 Купи ${t.nm}! Тръгва: ${name(t.a)} → ${name(t.b)}.` : `🚚 Купи ${t.nm}. Ще тръгне, щом има готова магистрала до друг твой град.`, 'good');
  }
  // движение (вика се всеки кадър с игралните дни)
  function update(dt) {
    for (const t of L()) {
      if (!t.path || !t.total) { t.wait = (t.wait || 0) + dt; if (t.wait >= 0.5) { t.wait = 0; autoTrip(t); } continue; }
      t.km += TRUCK.speed * dt;
      if (t.km < t.total) continue;
      const pay = legPay(t), toll = legToll(t), S = d.S(), to = t.path[t.path.length - 1];
      E().earn(pay, 'превози', `${t.nm}: ${t.cargo} ${name(t.path[0])} → ${name(to)}`);
      if (toll) E().spend(toll, 'тол', `${t.nm}: тол по чужди участъци`);
      t.trips++; t.earned += pay - toll; t.at = to;
      autoTrip(t);
      if (S && S.day !== t.lastSave) { t.lastSave = S.day; d.save(); }
    }
  }
  // всеки ден: поддръжка и износване
  function day() {
    const n = L().length; if (!n) return;
    E().spend(n * TRUCK.upkeep, 'заплати', `Ден ${d.S().day}: ТИР-ове (${n})`);
    for (const t of L()) t.cond = Math.max(TRUCK.minCond, (t.cond ?? 100) - TRUCK.wearDay);
  }
  // складът в краен град: твоите материали идват с ТИР-а — без такса за доставка
  const noFee = id => d.hasWh(id) && L().some(t => t.path && (t.a === id || t.b === id));

  // позиция на картата: по линията на участъка (със същото изместване като магистралата)
  function xy(t, proj, cityLL) {
    let left = Math.min(t.km, t.total);
    for (let i = 0; i < t.segs.length; i++) {
      const s = t.segs[i], A = cityLL(t.path[i]), B = cityLL(t.path[i + 1]); if (!A || !B) return null;
      if (left <= s.km || i === t.segs.length - 1) {
        const k = Math.min(1, left / Math.max(1, s.km)), [x1, y1] = proj(...A), [x2, y2] = proj(...B);
        let ox = 0, oy = 0;
        if (!String(s.id).startsWith('ab:')) { const [px, py] = proj(...cityLL(s.a)), [qx, qy] = proj(...cityLL(s.b)), nx = -(qy - py), ny = qx - px, l = Math.hypot(nx, ny) || 1; ox = nx / l * 3; oy = ny / l * 3; }
        return [x1 + (x2 - x1) * k + ox, y1 + (y2 - y1) * k + oy, Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI];
      }
      left -= s.km;
    }
    return null;
  }
  // слой на картата (вътре в пътния слой — отметката 🛣️ го скрива); отдалеч — по-малко и по-малки
  function draw(g, { proj, cityLL, k, near, inView }) {
    if (!g) return;
    const list = L().filter(t => t.path && inView(t.path)).slice(0, near ? 60 : 20);
    g.innerHTML = list.map(t => { const p = xy(t, proj, cityLL); if (!p) return '';
      const [x, y, ang] = p, l = (near ? 13 : 8) * k, w = l * 0.264;   // картинката е 360×95 — гледа надясно
      return `<image href="assets/ui/tir-top.webp" x="${(-l / 2).toFixed(2)}" y="${(-w / 2).toFixed(2)}" width="${l.toFixed(2)}" height="${w.toFixed(2)}" transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${ang.toFixed(1)})" style="pointer-events:none;filter:drop-shadow(0 0 ${(1.2 * k).toFixed(1)}px rgba(0,0,0,.5))"/>`; }).join('');
  }
  // карта в таб „Техника“
  const svcOf = t => Math.round(TRUCK.cost * TRUCK.service * (100 - (t.cond ?? 100)) / 70 / 100) * 100;
  function html() {
    const T = L();
    let h = `<div class="sect">🚚 ТИР-ове по магистралите${T.length ? ` (${T.length})` : ''}</div><div class="card" style="padding:9px 11px">
      <div class="row" style="margin:0;align-items:center;gap:10px"><img src="assets/ui/tir-top.webp" alt="" style="width:110px;height:auto"><span class="meta" style="margin:0">Собствен ТИР за ${f(TRUCK.cost)} € сам кара товари между твоите градове по готовите магистрали и аутобани — по-евтин от влака и върви навсякъде, където има магистрала. Поддръжка ${f(TRUCK.upkeep)} €/ден. По участъците на партньора плаща тол. Ако в крайния град имаш склад, носи и твоите материали без такса за доставка.</span></div>`;
    { const need = T.map(t => [t, svcOf(t)]).filter(([, c]) => c > 0), sum = need.reduce((a, [, c]) => a + c, 0), lock = d.svcAll && !d.svcAll();   // „Обслужи всички“ — от ниво 6 (d.svcAll)
      // два бутона един до друг: „Купи ТИР“ и „Обслужи всички“
      const svc = lock ? `<button class="btn2" style="flex:1" disabled title="От ниво 6 на развитие">🔒 Обслужи всички · ниво 6</button>`
        : need.length ? `<button class="btn2" data-trk="svcall:0:${sum}" style="flex:1" ${E().canAfford(sum) ? '' : 'disabled'}>🔧 Обслужи всички (${need.length}) · ${f(sum)} €</button>`
        : `<button class="btn2" style="flex:1" disabled>🔧 Обслужи всички · няма нужда</button>`;
      const v = feature('tir-cont') && d.tirView ? d.tirView() : null;   // tir-cont: таванът на континента от раздела („Всички“ — общо срещу сбора)
      if (v) h += `<div style="display:flex;gap:6px;margin-top:6px"><button class="btn" data-trk="buy:${v.k}" style="flex:1" ${E().canAfford(TRUCK.cost) && !v.why ? '' : 'disabled'} title="${v.why || 'Таван по континенти: Европа 60, Африка 50, Америка 60, Азия 50, Австралия 40 — и 2 ТИР-а на участък магистрала, 4 на аутобан там'}">${v.label ? `🚚 Купи ТИР · ${f(TRUCK.cost)} € · ${v.n}/${v.cap} (${v.label})` : `🚚 Купи ТИР · ${f(TRUCK.cost)} € · ${v.n}/${v.cap}`}</button>${svc}</div>${v.why ? `<div class="meta late" style="margin:4px 0 0">${v.why}</div>` : ''}</div>`;
      else h += `<div style="display:flex;gap:6px;margin-top:6px"><button class="btn" data-trk="buy" style="flex:1" ${E().canAfford(TRUCK.cost) && L().length < (d.cap ? d.cap() : Infinity) ? '' : 'disabled'} title="Лимит: 2 ТИР-а на участък магистрала, 4 на аутобан">🚚 Купи ТИР · ${f(TRUCK.cost)} €${d.cap ? ` · ${L().length}/${d.cap()}` : ''}</button>${svc}</div></div>`; }
    for (const t of T) {
      const svc = svcOf(t), j = t.path ? jam(t) : 1, sell = Math.round(TRUCK.cost * TRUCK.sell * (t.cond ?? 100) / 100);
      h += `<div class="card" style="padding:9px 11px"><b>${t.nm}</b> <span class="meta" style="margin:0">${t.path ? `${cargoOf(t)[1]} ${name(t.path[0])} → ${name(t.path[t.path.length - 1])} · ${Math.round(t.km)}/${Math.round(t.total)} км · ~${f(legPay(t))} €${legToll(t) ? ` − тол ${f(legToll(t))} €` : ''}` : `⏸ чака в ${name(t.at)} — няма готова магистрала до друг твой град`}</span><br>
        <span class="meta" style="margin:0">курсове ${t.trips} · спечелил ${f(t.earned)} € · 🔧 ${Math.round(t.cond ?? 100)}%${j < 1 ? ` · <span class="late">🚦 задръстване −${Math.round((1 - j) * 100)}%</span>` : ''}</span>
        <div class="row" style="justify-content:flex-end;gap:6px;margin-top:4px;flex-wrap:wrap">${svc > 0 ? `<button class="btn2" data-trk="svc:${t.id}:${svc}" ${E().canAfford(svc) ? '' : 'disabled'}>🔧 Обслужи · ${f(svc)} €</button>` : ''}<button class="btn2" data-trk="sell:${t.id}:${sell}">Продай · ${f(sell)} €</button></div></div>`;
    }
    return h;
  }
  function bind(el) {
    el.querySelectorAll('[data-trk]').forEach(b => b.onclick = () => {
      const [c, id, x] = b.dataset.trk.split(':'), t = L().find(q => q.id === +id);
      if (c === 'buy') return buy(id || undefined);
      if (c === 'svcall') { const need = L().filter(q => svcOf(q) > 0), sum = need.reduce((a, q) => a + svcOf(q), 0); if (!E().canAfford(sum)) return;
        E().spend(sum, 'заплати', `ТИР-ове: обслужване на ${need.length}`); for (const q of need) q.cond = 100; d.save(); d.renderPanel(); d.toast(`🔧 ${need.length} ТИР-а са като нови.`, 'good'); return; }
      if (!t) return;
      if (c === 'svc') { if (!E().canAfford(+x)) return; E().spend(+x, 'заплати', `${t.nm}: обслужване`); t.cond = 100; d.save(); d.renderPanel(); d.toast(`🔧 ${t.nm} е като нов.`, 'good'); return; }
      if (c === 'sell') d.modal(`Продай ${t.nm}?`, `Получаваш ${f(+x)} €.`, [['Отказ', null], ['Продай', () => {
        E().earn(+x, 'продажба', `Продаден ${t.nm}`); d.S().trucks = L().filter(q => q !== t); d.save(); d.redraw(); d.renderPanel(); }]]);
    });
  }
  return { buy, update, day, noFee, draw, html, bind, list: L, TRUCK,
    audit: () => L().filter(t => t.path && (!t.segs?.length || t.path.length !== t.segs.length + 1)).map(t => `${t.nm}: развален маршрут`) };
}
