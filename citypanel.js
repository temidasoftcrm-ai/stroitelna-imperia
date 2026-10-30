// citypanel.js — „🏙️ Градове“: всички твои градове на едно място, без да влизаш във всеки.
//   • за всеки град: ниво на развитие (и какво отключва следващото — напр. летищата на ниво 9), обектите в строеж,
//     чакащите оферти, техниката, парите по покривите и колко е запълнен градът;
//   • 🤖 Автопилот: докато не си там, градът сам приема поръчки и ги строи със своята техника и материали
//     (същите правила като в града: етапи, RATE, нужна техника). Парите отиват направо в банката, опитът — в нивото на града;
//   • бутони „Влез“ и „🏁 Завърши града“ (влиза в града и отваря картата за завършване).
// Градът, в който си, се показва със същите данни, но автопилотът му не работи (там играеш ти).
// Записът: S.autoCity = { [id]: true }; в града: c.freeLots = [[lotId, zone], …] (пази се при напускане, за новите поръчки).
import { migrateDevRecord } from './devlevel.js';
import { feature } from './lab/feature.js';
// 📦 wh-auto-default (T1): автоматичното пълнене е включено по подразбиране във всеки град със склад ниво 2+ (както прави и autoFill() в града);
// старите записи на другите градове (on: false) се включват веднъж тук — без „🔄 Включи“ във всяка карта; изключване — само в раздел „Склад“ на града
const WHAD = feature('wh-auto-default'), UIC = feature('ui-cleanup');
// 🤖 auto-gear (T2, координаторът: „Атина, техника 7, а пише липсва техника“): заетата техника (има я, но работи по друг обект) — „⏳ чака свободна техника“, не „липсва“;
// наистина липсващия вид автопилотът купува сам (deps.gearAutoBuy: остават поне 50% от парите и 50 000 €, има място в гаража/офиса); бутоните — само ако не е могъл
const AG = feature('auto-gear');
const whAutoFix = c => { if (WHAD && c && (c.whLevel || 0) >= 2 && !(c.autoFill && c.autoFill.on)) c.autoFill = { budget: 50000, spent: 0, day: 0, ...(c.autoFill || {}), on: true }; return c; };
// 🏁 fin-fix (бъгфикс, винаги): зоните — по „пръстен“ като freeLots() в game.js (lot-zones): плановете v2 дават center / business / residential / industrial / periphery,
// старите — center / mid / outer. Преди тук бяха само старите имена → в градовете по истинската карта жилищните/бизнес парцелите не получаваха поръчки („строят се 0/4, свободни 20“)
const RING = { center: 0, business: 1, mid: 1, residential: 2, outer: 2, low: 2, periphery: 3 }, RING_PREF = { house: [2, 3, 1], shop: [1, 2, 0], office: [0, 1, 2], tower: [0, 1] };
const ringRank = (type, zone) => { const P = RING_PREF[type] || [1, 0, 2], i = P.indexOf(RING[zone] ?? 2); return i < 0 ? P.length : i; };   // извън предпочитаните — най-накрая, но пак може (иначе последните парцели оставаха празни)
const lotFits = (type, x) => !(x[2] && x[2].length) || x[2].includes(type);   // x = [id, zone, kinds?] — видовете, които парцелът допуска (план v2)

export function createCityPanel(deps) {
  const S = () => deps.S(), f = n => deps.fmt(n);
  const rec = id => whAutoFix(id === S().cityId ? S() : (S().cities || {})[id] || null);   // wh-auto-default
  const auto = id => !!(S().autoCity || {})[id];
  const lvOf = xp => { let l = 1; deps.THRESH.forEach((t, i) => { if (xp >= t) l = i + 1; }); return l; };
  const devOf = c => c.dev = migrateDevRecord(c.dev);
  const projsOf = (id, c) => [...(id === S().cityId ? deps.projects() : c.projects || []), ...(c.autoJobs || [])].filter(p => !p.own && !p.maint && !p.park && !p.reno && !p.invest && !p.remodel);
  const unitsOf = (id, c) => id === S().cityId ? deps.unitTypes() : c.units || [];
  const cap = c => deps.officeLv(c.officeLevel || 1);

  // ---- XP и ниво на града (като devlevel.add, но за запис, в който не си)
  function addXp(id, c, n) {
    const d = c.dev = migrateDevRecord(c.dev), f0 = deps.firmLv ? deps.firmLv() : Infinity;   // нивото на фирмата преди опита
    d.xp += n;
    const nl = lvOf(d.xp);
    while (d.lv < nl) {
      d.lv++;
      deps.toast(`🏅 ${deps.cityName(id)} стана ниво ${d.lv}! ${deps.unlockText(d.lv)}`, 'good', () => deps.openWin());
      if (d.lv > f0 && deps.firmUp) deps.firmUp(d.lv); else deps.sound && deps.sound('levelup');   // този град вдигна фирмата → картинката на нивото
    }
  }
  // ---- нова поръчка за град, в който не си: свободен парцел от запомнения списък
  function newOrder(id, c) {
    const rep = S().rep || 0, tier = deps.cityTier(id);
    if (!c.freeLots && deps.virtFill) deps.virtFill(id, c);   // не си бил тук — свободните парцели се изчисляват без влизане (game.js)
    const fl0 = c.freeLots;
    const avail = deps.offerTypes().filter(([k, t]) => rep >= t.rep && !(tier === 's' && (k === 'tower' || (k === 'office' && rep < 4))) && !(k === 'tower' && deps.noTower && deps.noTower(id)));
    if (!avail.length || (fl0 && !fl0.length)) return null;
    { const fit = fl0 ? avail.filter(([k]) => fl0.some(x => ringRank(k, x[1]) < (RING_PREF[k] || [1, 0, 2]).length && lotFits(k, x))) : avail; if (fit.length) avail.splice(0, avail.length, ...fit); }   // първо видовете с подходящ парцел; няма ли — всеки вид (на най-близкия по пръстен)
    const w = avail.map((_, i) => avail.length - i * 0.6);
    let r = Math.random() * w.reduce((a, b) => a + b, 0), type = avail[0][0];
    for (let i = 0; i < avail.length; i++) if ((r -= w[i]) <= 0) { type = avail[i][0]; break; }
    // парцел: от запомнените/изчислените свободни; иначе (мегаполис, в който не си бил) обектът е „на хартия“ (c.autoJobs) — плаща и дава опит,
    // но сградата не се появява на картата на града
    const fl = c.freeLots;
    let lot = null;
    if (fl) {
      const k = fl.map((x, i) => [i, ringRank(type, x[1]) + (lotFits(type, x) ? 0 : 10) + (Math.random() - 0.5) * 0.9]).sort((a, b) => a[1] - b[1])[0];
      if (!k) return null;
      lot = fl.splice(k[0], 1)[0][0];
      c.freeAll = c.freeV ? fl.length : Math.max(fl.length, (c.freeAll ?? 0) - 1);   // fin-fix: „% застроен“ и remFree() вървят с автопилота (преди freeAll оставаше от деня на напускане)
    }
    const bt = deps.BTYPES[type], lv = devOf(c).lv;
    let reward = deps.ECON.quoteReward(type, rep) * ((c.staff || {}).architect ? 1.1 : 1) * (1 + 0.02 * (lv - 1)), days = bt.days, floors;
    if (type === 'tower') { const fs = deps.towerFloors(id); floors = fs[Math.floor(Math.random() * fs.length)] || 10; const m = deps.towerMul(floors); reward *= m; days = Math.round(days * (0.6 + 0.4 * m)); }
    reward = Math.round(reward * (deps.regionMul ? deps.regionMul(id) : 1) / 500) * 500;
    const cl = deps.clients(type, id), day = S().day;
    return { id: S().seq++, type, lot, client: cl, title: `${bt.nm}${floors ? ` (${floors} ет.)` : ''} — ${cl}`, reward, repGain: bt.repGain, startDay: day, deadlineDay: day + days, stage: 0, prog: 0, floors, model: deps.buildingFor(type, floors), auto: true };
  }
  // ---- един ден работа в град, в който не си (само при включен автопилот)
  function workDay(id, c) {
    const s = S(), econ = deps.econ(), day = s.day;
    c.projects = c.projects || []; c.offers = c.offers || [];
    // 1) чакащите оферти: приема ги, докато офисът има място (без наддаване — на цената от офертата)
    const busy = () => projsOf(id, c).length;
    c.offers = c.offers.filter(o => o.expires >= day);
    while (c.offers.length && busy() < cap(c).proj) {
      const o = c.offers.shift(), bt = deps.BTYPES[o.type];
      c.projects.push({ id: o.id, type: o.type, lot: o.lot, client: o.client, title: `${bt.nm}${o.floors ? ` (${o.floors} ет.)` : ''} — ${o.client}`, reward: o.reward, repGain: bt.repGain,
        startDay: day, deadlineDay: day + o.days, stage: 0, prog: 0, floors: o.floors, model: deps.buildingFor(o.type, o.floors), auto: true });
    }
    // 2) нови поръчки до капацитета на офиса
    let guard = 4;
    while (busy() < cap(c).proj && guard-- > 0) { const p = newOrder(id, c); if (!p) break; if (p.lot == null) (c.autoJobs = c.autoJobs || []).push(p); else c.projects.push(p); }
    // 3) строеж: техниката на града се дели между обектите по реда на приемане
    const have = {}; for (const t of c.units || []) have[t] = (have[t] || 0) + 1;
    const own = { ...have };   // auto-gear: колко има градът (have — колко са свободни днес)
    c.gearAdded = {};
    const eng = (c.staff || {}).engineer ? 1.15 : 1;
    for (const p of [...c.projects, ...(c.autoJobs || [])]) {
      if (p.own || p.maint || p.park || p.reno || p.invest || p.remodel) continue;
      if (p.demo) { p.demo.prog = Math.min(1, p.demo.prog + 1 / p.demo.days); if (p.demo.prog >= 1) delete p.demo; continue; }
      let left = 1;
      while (left > 0) {
        const st = deps.BTYPES[p.type].stages[p.stage]; if (!st) break;
        { let miss = Object.keys(st.need).filter(r => (have[r] || 0) < 1);
          if (AG && miss.length) {
            for (const r of miss) if (!(own[r] > 0) && deps.gearAutoBuy && deps.gearAutoBuy(r, id)) { own[r] = 1; have[r] = (have[r] || 0) + 1; c.gearAdded[r] = (c.gearAdded[r] || 0) + 1; }
            miss = Object.keys(st.need).filter(r => (have[r] || 0) < 1);
            const lack = miss.filter(r => !(own[r] > 0));
            if (miss.length) { p.waitGear = lack.length > 0; p.waitNeed = lack; p.waitBusy = !lack.length; break; }
          } else if (miss.length) { p.waitGear = true; p.waitNeed = miss; break; } }
        p.waitGear = false; p.waitBusy = false;
        p.mat = p.mat || {};
        if (!p.mat[p.stage]) {
          const cost = econ.materialCost(p.type, p.stage, [], {});
          if (cost && !econ.canAfford(cost)) { p.waitMoney = true; break; }
          if (cost) econ.spend(cost, 'материали', `${deps.cityName(id)}: материали за „${p.title}“`);
          p.mat[p.stage] = true; p.waitMoney = false;
        }
        const n = Object.entries(st.need).reduce((a, [r, k]) => a + Math.min(k, have[r] || 0), 0);
        const rate = deps.RATE * n * eng / (st.work * deps.workMul(p)), need = (1 - p.prog) / rate;
        if (need <= left) { left -= need; p.prog = 0; p.stage++; }
        else { p.prog += rate * left; left = 0; }
        if (!deps.BTYPES[p.type].stages[p.stage]) { finish(id, c, p); break; }
      }
      for (const [r, k] of Object.entries((deps.BTYPES[p.type].stages[p.stage] || { need: {} }).need)) have[r] = Math.max(0, (have[r] || 0) - k);   // заетата техника
    }
    // 🤖 auto-gear (флот, потребителят: „да купува бригади и багери сам според гаража … да не ги купуваме постоянно“): само когато обект стои заради вид,
    // който градът няма (не зает другаде), веднъж на ~10 дни, ако флотът е под 80% от гаража/офиса — допълва до нуждата на текущите етапи (до 4 покупки);
    // съществуващите (заети, на път, в ремонт) се броят като налични; бюджетът — както при auto-gear (deps.gearAutoBuy)
    if (AG && deps.gearAutoBuy && deps.gearCaps) {
      const blocked = [...c.projects, ...(c.autoJobs || [])].some(p => p.waitGear && (p.waitNeed || []).length) || Object.keys(c.gearAdded).length > 0,   /* или днес е купен липсващ вид — тогава веднъж и за успоредната работа */ C2 = deps.gearCaps(id), owned = deps.gearOwned ? deps.gearOwned(id) : (c.units || []);
      if (blocked && day - (c.agLast ?? -99) >= 10 && owned.length < 0.8 * (C2.crews + C2.mach)) {
        const cnt = {}; for (const t of owned) cnt[t] = (cnt[t] || 0) + 1;
        const dem = {}; for (const p of [...c.projects, ...(c.autoJobs || [])]) { if (p.own || p.maint || p.park || p.reno || p.invest || p.remodel || p.demo) continue; const st = deps.BTYPES[p.type]?.stages[p.stage]; if (st) for (const [r, k] of Object.entries(st.need)) dem[r] = (dem[r] || 0) + k; }
        const want = Object.entries(dem).map(([t, k]) => [t, k - (cnt[t] || 0)]).filter(([, w]) => w > 0).sort((a, b) => (cnt[a[0]] ? 1 : 0) - (cnt[b[0]] ? 1 : 0) || b[1] - a[1]);   // първо липсващите изцяло
        let n = 0; for (const [t, w] of want) for (let i = 0; i < w && n < 4; i++) { if (!deps.gearAutoBuy(t, id)) break; n++; c.gearAdded[t] = (c.gearAdded[t] || 0) + 1; }
        if (n) c.agLast = day;
      }
    }
    // 4) пачките по покривите (от времето, когато беше там) — направо в банката
    if ((c.cash || []).length) { const sum = c.cash.reduce((a, x) => a + (x.amount || 0), 0); if (sum) econ.earn(sum, 'обект', `${deps.cityName(id)}: пари от покривите`); c.cash = []; }
    c.left = deps.nowDays();   // fastForward при влизане не брои тези дни втори път
  }
  function finish(id, c, p) {
    const econ = deps.econ(), s = S();
    const res = econ.completionPayout(p, s.day);   // плаща направо (без пачки по покривите)
    s.rep = Math.max(0, Math.min(5, (s.rep || 0) + res.repDelta * (res.repDelta > 0 && (c.staff || {}).architect ? 1.25 : 1)));
    if (p.lot == null) c.autoJobs.splice(c.autoJobs.indexOf(p), 1);
    else { c.projects.splice(c.projects.indexOf(p), 1); c.built = c.built || []; c.built.push({ lot: p.lot, model: p.model }); }
    s.done = (s.done || 0) + 1;
    addXp(id, c, deps.XP[p.type] || 0);
    c.autoLog = [{ d: s.day, t: p.title, a: res.amount }, ...(c.autoLog || [])].slice(0, 5);
    deps.onComplete && deps.onComplete(p);
  }
  function dailyTick() {
    const s = S(); if (!s) return;
    let n = 0, money = 0; const bought = [];
    for (const id of deps.ownedCities()) {
      if (id === s.cityId || !auto(id) || deps.isFinished(id)) continue;
      const c = rec(id); if (!c) continue;
      const m0 = deps.econ().s.money; workDay(id, c); money += deps.econ().s.money - m0; n++;
      if (AG) { const b = Object.entries(c.gearAdded || {}).filter(([t, k]) => k > 0 && deps.ECON.UNIT_TYPES[t]); if (b.length) bought.push(`${deps.cityName(id)}: купи ${b.map(([t, k]) => `${k} × ${deps.ECON.UNIT_TYPES[t].ico} ${deps.ECON.UNIT_TYPES[t].nm.toLowerCase()}`).join(', ')}`); }   // auto-gear: само в дните с покупка
    }
    if (!n) return;
    s.autoWeek = (s.autoWeek || 0) + money;
    if (bought.length) deps.toast(`🤖 ${bought.join(' · ')}`, 'good', () => deps.openWin());
    if (s.day % 7 === 0) { deps.toast(`🤖 Автопилот (${n} град${n > 1 ? 'а' : ''}): тази седмица ${s.autoWeek >= 0 ? '+' : ''}${f(Math.round(s.autoWeek))} €. Подробности в „🏙️ Градове“.`, 'good', () => deps.openWin()); s.autoWeek = 0; }
  }
  // при напускане на град: свободните парцели за автопилота
  // и празните парцели на купените квартали (fresh) — иначе градът изглежда „готов за завършване“ отвън, а вътре има десетки свободни (freeV: 2 = новото броене)
  function stash(c, lots) { c.freeLots = lots.filter(l => !l.built && !l.busy).map(l => l.kinds && l.kinds.length ? [l.id, l.zone, l.kinds] : [l.id, l.zone]); c.freeV = 2; }

  // ---- прозорецът
  // „👋 Остави града“: завършеният град изчезва от списъка (продължава да носи пари); S.cpHide = { [id]: денят }
  const hid = id => !!(S().cpHide || {})[id];
  const visible = id => { const s = S(); return (!deps.inScope || deps.inScope(id)) && (s.cpShowFin || (!deps.isFinished(id) || id === s.cityId) && !hid(id)); };
  function cityCard(id) {
    const s = S(), c = rec(id); if (!c) return '';
    const here = id === s.cityId, fin = deps.isFinished(id), d = devOf(c), lv = d.lv;
    if (!here && !c.freeLots && deps.virtFill) deps.virtFill(id, c);
    const a = deps.THRESH[lv - 1], b = deps.THRESH[lv], k = b == null ? 1 : Math.max(0, Math.min(1, (d.xp - a) / (b - a)));
    const ps = projsOf(id, c), offers = (here ? s.offers : c.offers || []).length, units = unitsOf(id, c).length, C = cap(c);
    const roof = (c.cash || []).reduce((x, y) => x + (y.amount || 0), 0);
    const next = b == null ? '<span style="color:var(--ok)">максимално ниво</span>' : `до ниво ${lv + 1}: ${f(Math.round(b - d.xp))} XP · ${deps.devBest && deps.devBest() >= lv + 1 ? `<span style="color:var(--ok)">💶 +2% към наградите в ${deps.cityName(id)}</span>` : `<span style="color:#ffd54a">🔓 ${deps.unlockText(lv + 1)}</span>`}`;
    let h = `<div class="card" style="${here ? 'border:1px solid var(--acc)' : ''}"><h3 style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${deps.cityFlag(id)} ${deps.cityName(id)}${here ? ' <span class="meta" style="margin:0">📍 тук си</span>' : ''}
      <span style="margin-left:auto;display:flex;gap:6px;align-items:center">${fin ? '<span class="meta" style="margin:0;color:var(--ok)">🏁 завършен</span>' : ''}<b>🏅 Ниво ${lv}</b></span></h3>
      <div class="bar" style="margin:4px 0"><i style="width:${(k * 100).toFixed(0)}%;background:linear-gradient(90deg,#c9a14a,#ffd54a)"></i></div>
      <div class="meta" style="margin:0 0 6px">${next}</div>`;
    if (fin) return h + `<div class="row" style="gap:8px;align-items:center;margin:0"><span class="meta" style="margin:0;flex:1">Градът е завършен и носи приход всеки ден.</span>${hid(id) ? '<span class="meta" style="margin:0">👋 оставен</span>' : `<button class="btn2" data-cphide="${id}" title="Градът продължава да носи пари, но изчезва от списъка">👋 Остави града</button>`}</div></div>`;
    h += `<div class="meta" style="margin:0">🏗️ Строят се <b style="color:var(--txt)">${ps.length}/${C.proj}</b> · 📨 оферти ${offers} · 🚜 техника ${units}${roof ? ` · 💶 по покривите ${f(roof)} €` : ''}${!here && c.freeLots ? ` · 🟩 свободни парцели ${c.freeLots.length}` : ''}</div>${!here && !c.freeLots && auto(id) ? '<div class="meta" style="margin:2px 0 0">ℹ️ Още не си влизал тук — новите обекти се строят „на хартия“ (плащат и дават опит). Влез веднъж, за да се появяват и в града.</div>' : ''}`;
    { // 🔑 имотите в града с икони (без влизане): 🏠×2 🏪 🌆 · 🟩 земя
      const E = c.estate || {}, own = E.owned || [], land = (E.land || []).length, by = {};
      for (const o of own) by[o.kind] = (by[o.kind] || 0) + 1;
      const order = ['house', 'shop', 'office', 'tower'], ks = Object.keys(by).sort((a, b) => (order.indexOf(a) + 1 || 9) - (order.indexOf(b) + 1 || 9));
      h += `<div class="meta" style="margin:2px 0 0">🔑 Имоти <b style="color:var(--txt)">${own.length}</b>${own.length ? ': ' + ks.map(k => `<span title="${deps.BTYPES[k]?.nm || k}" style="font-size:15px">${deps.BTYPES[k]?.ico || '🏢'}</span>${by[k] > 1 ? `<b style="color:var(--txt)">×${by[k]}</b>` : ''}`).join(' ') : ' — още нямаш'}${land ? ` · 🟩 земя ${land}` : ''}</div>`;
    }
    for (const p of ps.slice(0, 6)) {
      const st = deps.BTYPES[p.type].stages[p.stage], pct = Math.round(((p.stage + Math.min(1, p.prog || 0)) / deps.BTYPES[p.type].stages.length) * 100);
      const why = p.demo ? ' · 🧱 събаряне' : p.waitGear ? ' · <span class="late">⏸ липсва техника</span>' : AG && p.waitBusy ? ' · <span style="color:var(--mut)">⏳ чака свободна техника</span>' : p.waitMoney ? ' · <span class="late">⏸ няма пари за материали</span>' : '';
      h += `<div class="row" style="margin:3px 0;gap:8px"><span class="meta" style="margin:0;flex:1">${deps.BTYPES[p.type].ico} ${p.title} · ${st ? st.nm : 'готово'}${why}</span><span class="meta" style="margin:0;min-width:40px;text-align:right">${pct}%</span></div>
        <div class="bar" style="height:4px;margin:0 0 2px"><i style="width:${pct}%"></i></div>`;
    }
    if (ps.length > 6) h += `<div class="meta">… и още ${ps.length - 6}</div>`;
    // липсващата техника: изпрати от най-близкия град със свободна или купи направо за града
    if (!here) {
      const miss = {}; for (const p of ps) if (p.waitGear) for (const t of p.waitNeed || []) miss[t] = (miss[t] || 0) + 1;
      for (const [t, n] of Object.entries(c.gearAdded || {})) if (miss[t]) miss[t] -= n;   // току-що купени или пратени
      const ts = Object.keys(miss).filter(t => miss[t] > 0 && deps.ECON.UNIT_TYPES[t]);
      if (ts.length) h += `<div class="row" style="margin:6px 0;gap:6px;flex-wrap:wrap;align-items:center"><span class="meta" style="margin:0"><span class="late">🚜 Липсва техника:</span>${AG && auto(id) ? ' <span style="color:var(--mut)">(автопилотът не можа да я купи — гаражът/офисът е пълен или парите се пазят)</span>' : ''}</span>${ts.map(t => {
        const T = deps.ECON.UNIT_TYPES[t], src = deps.gearSrc(t, id), on = deps.gearComing(t, id);
        if (on) return `<span class="meta" style="margin:0;color:#7dd3ff">🚚 ${T.ico} ${T.nm} на път (ден ${on})</span>`;
        return `${src ? `<button class="btn2" data-cpsend="${t}|${id}|${src}" title="Транспорт 10% от цената">🚚 ${T.ico} ${T.nm} от ${deps.cityName(src)}</button>` : ''}<button class="btn" data-cpbuy="${t}|${id}" ${deps.econ().canAfford(T.cost) ? '' : 'disabled'}>🛒 ${T.ico} ${T.nm} · ${f(T.cost)} €</button>`;
      }).join('')}</div>`;
    }
    if (!here && (c.autoLog || []).length) h += `<div class="meta" style="margin-top:4px">✅ Последно: ${c.autoLog.slice(0, 3).map(x => `${x.t} (+${f(x.a)} €)`).join(' · ')}</div>`;
    // „🏁 Завърши града“ — само когато градът е готов (квартали, свободни парцели ≤ 1, при важните градове 0, пазарен дял ≥ 60%)
    const fs = deps.finishState(id), bp = fs.built;
    if (bp != null && !fin) h += `<div class="row" style="margin:6px 0 2px;gap:8px;align-items:center"><span class="meta" style="margin:0;white-space:nowrap">🏙️ Застроен <b style="color:var(--txt)">${bp}%</b></span><div class="bar" style="flex:1;height:6px;margin:0"><i style="width:${bp}%;background:linear-gradient(90deg,#3fae5a,#7dffa8)"></i></div></div>`;
    const okExt = fs.ext >= fs.need, okFree = fs.free != null && fs.free <= (fs.freeMax ?? 1), okSh = fs.share >= 0.6;
    const canFin = here ? deps.canFinishHere() : okExt && okFree && okSh && fs.air !== false;
    const ck = ok => ok ? '✅' : '⬜';
    if (!canFin) h += `<div class="meta" style="margin:6px 0 0">🏁 За завършване: ${ck(okExt)} квартали ${fs.ext}/${fs.need} · ${ck(okFree)} свободни парцели ${fs.free == null ? '? (влез веднъж в града)' : `${fs.free} (най-много ${fs.freeMax ?? 1})`} · ${ck(okSh)} пазарен дял ${Math.round(fs.share * 100)}% (поне 60%)${fs.airNeed ? ` · ${ck(fs.air)} ✈️ летище` : ''}</div>`;
    if (!canFin && fs.airNeed && !fs.air) h += `<div class="row" style="margin:4px 0 0;gap:6px;align-items:center"><span class="meta" style="margin:0;flex:1">✈️ За завършване на ${deps.cityName(id)} трябва летище — строи се оттук, без да влизаш в града.</span>${fs.airBuild ? `<span class="meta" style="margin:0;color:var(--acc)">🏗️ Летището се строи…</span>` : `<button class="btn" data-airport="${id}">✈️ Строй летище</button>`}</div>`;   /* собственикът (30.10): след натискане — „се строи“, не бутонът */   // data-airport — общият бутон в големите прозорци (game.js buildAirport)
    // 📦 складът: автоматичното пълнене се включва и оттук (всеки град има свое — c.autoFill)
    if (!WHAD && !(c.autoFill && c.autoFill.on)) h += `<div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap;align-items:center"><span class="meta" style="margin:0 auto 0 0">📦 Склад: <span class="late">автоматичното пълнене е изключено</span></span><button class="btn2" data-cpaf="${id}" title="Складът сам поръчва ТИР-ове с материали (до 50 000 € на ден)">🔄 Включи</button></div>`;
    // 🏘️ нови квартали — купуват се и оттук, без да влизаш в града
    const dq = deps.district && !deps.isFinished(id) ? deps.district(id) : null;
    if (dq && dq.ext < dq.max) h += `<div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap;align-items:center"><span class="meta" style="margin:0 auto 0 0">🏘️ Квартали <b style="color:var(--txt)">${dq.ext}/${dq.max}</b>${dq.ext < fs.need ? ` · за завършване ${fs.need}` : ''}</span>
      <button class="btn" data-cpdist="${id}|0" ${deps.econ().canAfford(dq.cost) ? '' : 'disabled'}>🏘️ Купи квартал · ${f(dq.cost)} €</button>
      ${dq.max - dq.ext > 1 ? `<button class="btn2" data-cpdist="${id}|1" ${deps.econ().canAfford(dq.all) ? '' : 'disabled'}>Всички ${dq.max - dq.ext} · ${f(dq.all)} €</button>` : ''}</div>`;
    h += `<div class="row" style="justify-content:flex-end;gap:6px;margin-top:6px;flex-wrap:wrap">
      ${here ? '' : `<button class="btn2" data-cpgo="${id}">➡️ Влез</button>`}
      ${canFin ? `<button class="btn" data-cpfin="${id}" title="Завършва града направо оттук" style="background:linear-gradient(180deg,#5fe08f,#2fae5c);color:#05230f;border-color:#2fae5c">🏁 Завърши града</button>` : ''}</div></div>`;
    return h;
  }
  // завършените градове (🏁) не се показват — само ред с броя им и бутон да се покажат
  // целият обхват (България, Европа…) е завършен — вместо дългия списък: едно обобщение с приход, поддръжка и печалба на ден
  function doneSummary(order) {
    const s = S(), ids = order.filter(id => !deps.inScope || deps.inScope(id)); if (!ids.length || !ids.every(id => deps.isFinished(id)) || !deps.finStat) return '';
    const st = ids.map(id => deps.finStat(id)), inc = st.reduce((a, x) => a + x.daily, 0), up = st.reduce((a, x) => a + x.upkeep, 0), nm = deps.scopeLabel ? deps.scopeLabel() : '';
    return `<div class="card" style="text-align:center;padding:18px 14px"><div style="font-size:38px;line-height:1">🏁</div>
      <h3 style="margin:8px 0 4px;color:var(--ok)">${nm ? `${nm} е завършена!` : 'Всичко тук е завършено!'}</h3>
      <div class="meta" style="margin:0 0 10px">${ids.length} ${ids.length === 1 ? 'град работи' : 'града работят'} сами и носят пари всеки ден.</div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">${[[f(inc) + ' €', 'приход на ден', 'var(--acc)'], ['−' + f(up) + ' €', 'поддръжка на ден', 'var(--bad)'], ['+' + f(inc - up) + ' €', 'печелиш на ден', 'var(--ok)']].map(([v, t, c]) => `<div style="flex:1 1 140px;padding:10px;border-radius:10px;background:rgba(255,255,255,.05)"><b style="font-size:20px;color:${c}">${v}</b><div class="meta" style="margin:2px 0 0">${t}</div></div>`).join('')}</div>
      <button class="btn2" data-cpfinshow="1" style="margin-top:10px">${s.cpShowFin ? '▾ Скрий градовете' : `▸ Покажи градовете (${ids.length})`}</button></div>`;
  }
  function finNote(order) {
    const s = S(), n = order.filter(id => (!deps.inScope || deps.inScope(id)) && deps.isFinished(id) && (id !== s.cityId || hid(id))).length;
    return n ? `<div class="card"><div class="row" style="align-items:center;gap:8px"><span class="meta" style="margin:0;flex:1">🏁 ${n} завършени града ${s.cpShowFin ? 'са показани' : 'са скрити — работят сами и носят пари'}.</span><button class="btn2" data-cpfinshow="1">${s.cpShowFin ? 'Скрий ги' : 'Покажи ги'}</button></div></div>` : '';
  }
  // 🏘️ от ниво 14: всички квартали на всичките ти градове наведнъж (до максимума)
  function distAll() {
    const out = []; if (!deps.district) return out;
    for (const id of deps.ownedCities()) { if (deps.isFinished(id)) continue; const q = deps.district(id); if (q && q.ext < q.max) out.push([id, q]); }
    return out;
  }
  function distRow() {
    const L = distAll(); if (!L.length) return `<div class="row" style="gap:6px;margin-top:6px;align-items:center"><span class="meta" style="margin:0;color:var(--ok)">🏘️ Всички градове са с максимум квартали</span></div>`;
    const n = L.reduce((a, [, q]) => a + q.max - q.ext, 0), cost = L.reduce((a, [, q]) => a + q.all, 0), e = deps.econ();
    return `<div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap;align-items:center"><span class="meta" style="margin:0 auto 0 0">🏘️ Липсват <b style="color:var(--txt)">${n}</b> квартала в ${L.length} града · всички за <b style="color:var(--txt)">${f(cost)} €</b></span>
      <button class="btn" data-cpdistall="1" ${e.canAfford(Math.min(...L.map(([, q]) => q.all))) ? '' : 'disabled'} title="Купува всички квартали до максимума във всеки град (докъдето стигнат парите — първо най-евтините)">🏘️ Купи всички квартали · ${f(cost)} €</button></div>`;
  }
  function winHtml() {
    const s = S(), own = deps.ownedCities();
    const order = [...own].sort((a, b) => (b === s.cityId) - (a === s.cityId) || deps.isFinished(a) - deps.isFinished(b) || devOf(rec(b) || {}).lv - devOf(rec(a) || {}).lv);
    { const sum = doneSummary(order); if (sum) return sum + (s.cpShowFin ? order.filter(id => !deps.inScope || deps.inScope(id)).map(cityCard).join('') : ''); }   // целият обхват е завършен — само обобщението
    const on = own.filter(id => id !== s.cityId && auto(id) && !deps.isFinished(id)).length, open = own.filter(id => !deps.isFinished(id) && id !== s.cityId);
    const lv14 = deps.devBest && deps.devBest() >= 14 && deps.gearShort;
    // от ниво 14: вместо автопилота (той е включен навсякъде с холдинга) — „купи всичко липсващо“ и „включи всички складове“
    if (lv14) {
      const g = deps.gearShort(), afOff = own.filter(id => !deps.isFinished(id) && !(rec(id)?.autoFill?.on)).length;
      let h = `<div class="card"><div class="meta" style="margin:0">Управляваш империята наведнъж: един бутон праща свободната техника от другите градове и купува останалото, което липсва (бригади, багери, кранове…), а складовете си поръчват материалите сами.</div>
        <div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap;align-items:center"><span class="meta" style="margin:0 auto 0 0">🚜 Липсват <b style="color:${g.total ? 'var(--bad)' : 'var(--ok)'}">${g.total}</b>${g.moveN ? ` · ${g.moveN} идват от другите градове` : ''}${g.buy.length ? ` · за купуване ${g.buy.reduce((a, b) => a + b[2], 0)}` : ''}</span>
          ${g.total ? `${g.moveN ? `<button class="btn2" data-cpbuyall="1" title="Евтино, но техниката пътува няколко дни">🚚 Изпрати ${g.moveN}${g.cost ? ` + купи · ${f(g.cost)} €` : ''}</button>` : ''}<button class="btn" data-cpbuynow="1" ${deps.econ().canAfford(Math.min(...g.now.map(([, t]) => deps.ECON.UNIT_TYPES[t].cost))) ? '' : 'disabled'} title="Купува всичко липсващо веднага във всеки град">🛒 Купи всичко необходимо · ${f(g.costNow)} €</button>` : '<span class="meta" style="margin:0;color:var(--ok)">✅ Нищо не липсва</span>'}</div>
        <div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap;align-items:center"><span class="meta" style="margin:0 auto 0 0">📦 Складове с автоматично пълнене: <b style="color:var(--txt)">${own.length - afOff - own.filter(id => deps.isFinished(id)).length}</b> от ${own.filter(id => !deps.isFinished(id)).length}</span>
          ${afOff && !WHAD ? '<button class="btn" data-cpafall="1">📦 Включи всички</button>' : '<span class="meta" style="margin:0;color:var(--ok)">✅ Автоматично</span>'}</div>${distRow()}</div>`;
      const shown = order.filter(visible);
      for (const id of shown) h += cityCard(id);
      h += finNote(order);
      if (!shown.length) h += '<div class="card"><div class="meta" style="margin:0">Нямаш градове в този обхват.</div></div>';
      return h;
    }
    let h = `<div class="card"><div class="meta" style="margin:0">Тук управляваш всички градове, без да влизаш във всеки. С <b>🤖 Автопилот</b> градът сам приема поръчки и ги строи със своята техника, а парите и опитът идват всеки ден. Нивото на всеки град расте от обектите в него; летищата се отключват, щом <b>един</b> град стигне ниво 9.</div>
      ${UIC ? `<div class="meta" style="margin:6px 0 0">🤖 Градовете работят сами с автопилот (в ${on} от ${open.length}); изключва се в картата на града.</div></div>` : `<div class="row" style="justify-content:flex-end;gap:6px;margin-top:6px"><span class="meta" style="margin:0 auto 0 0">🤖 включен в ${on} от ${open.length} града</span>
      <button class="btn2" data-cpall="1">🤖 Включи всички</button><button class="btn2" data-cpall="0">Изключи всички</button></div></div>`}`;   // ui-cleanup (T1): без „Включи/Изключи всички“
    const shown = order.filter(visible);   // обхватът горе: България · Балкани · Европа · …; завършените и оставените — скрити
    for (const id of shown) h += cityCard(id);
    h += finNote(order);
    if (!shown.length) h += '<div class="card"><div class="meta" style="margin:0">Нямаш градове в този обхват.</div></div>';
    return h;
  }
  function bind(body, redraw) {
    body.querySelectorAll('[data-cpfinshow]').forEach(b => b.onclick = () => { const s = S(); s.cpShowFin = !s.cpShowFin; redraw(); });
    const mark = (id, t) => { const c = S().cities[id]; if (c) { c.gearAdded = c.gearAdded || {}; c.gearAdded[t] = (c.gearAdded[t] || 0) + 1; } };
    body.querySelectorAll('[data-cpauto]').forEach(b => b.onchange = () => { const s = S(); s.autoCity = { ...(s.autoCity || {}), [b.dataset.cpauto]: b.checked }; deps.save(); redraw(); });
    body.querySelectorAll('[data-cpall]').forEach(b => b.onclick = () => { const s = S(), v = b.dataset.cpall === '1'; s.autoCity = Object.fromEntries(deps.ownedCities().filter(id => id !== s.cityId).map(id => [id, v])); deps.save(); redraw(); });
    body.querySelectorAll('[data-cpsend]').forEach(b => b.onclick = () => { const [t, id, from] = b.dataset.cpsend.split('|'); if (deps.gearSend(t, from, id)) mark(id, t); redraw(); });
    body.querySelectorAll('[data-cpbuy]').forEach(b => b.onclick = () => { const [t, id] = b.dataset.cpbuy.split('|'); const n0 = deps.unitCount(id); deps.gearBuy(t, id); if (deps.unitCount(id) > n0) mark(id, t); redraw(); });
    body.querySelectorAll('[data-cpdist]').forEach(b => b.onclick = () => { const [id, all] = b.dataset.cpdist.split('|'); deps.buyDistrict(id, all === '1'); redraw(); });
    body.querySelectorAll('[data-cphide]').forEach(b => b.onclick = () => { const s = S(); s.cpHide = { ...(s.cpHide || {}), [b.dataset.cphide]: s.day }; deps.toast(`👋 ${deps.cityName(b.dataset.cphide)} е оставен — продължава да носи пари, но вече не е в списъка (виж „Покажи ги“).`, 'good'); deps.save(); redraw(); });
    body.querySelectorAll('[data-cpdistall]').forEach(b => b.onclick = () => { let n = 0, sum = 0; const e = deps.econ();
      for (const [id, q] of distAll().sort((a, b) => a[1].all - b[1].all)) { if (!e.canAfford(q.all)) continue; const m0 = e.s.money; deps.buyDistrict(id, true); if (e.s.money < m0) { n += q.max - q.ext; sum += m0 - e.s.money; } }
      deps.toast(n ? `🏘️ Купи ${n} квартала за ${f(Math.round(sum))} €.` : 'Нямаш достатъчно пари за кварталите на нито един град.', n ? 'good' : 'bad'); deps.save(); redraw(); });
    body.querySelectorAll('[data-cpbuyall]').forEach(b => b.onclick = () => { deps.gearBuyAll(); deps.save(); redraw(); });
    body.querySelectorAll('[data-cpbuynow]').forEach(b => b.onclick = () => { deps.gearBuyNow(); deps.save(); redraw(); });
    body.querySelectorAll('[data-cpafall]').forEach(b => b.onclick = () => { let n = 0; for (const id of deps.ownedCities()) { const c = rec(id); if (!c || deps.isFinished(id) || c.autoFill?.on) continue; c.autoFill = { budget: 50000, spent: 0, day: S().day, ...(c.autoFill || {}), on: true }; n++; } if (n) deps.toast(`📦 Включи автоматичното пълнене на складовете в ${n} града.`, 'good'); deps.save(); redraw(); });
    body.querySelectorAll('[data-cpaf]').forEach(b => b.onclick = () => { const c = rec(b.dataset.cpaf); if (c) { c.autoFill = { budget: 50000, spent: 0, day: S().day, ...(c.autoFill || {}), on: true }; deps.save(); } redraw(); });
    body.querySelectorAll('[data-cpgo]').forEach(b => b.onclick = () => deps.goCity(b.dataset.cpgo, null));
    body.querySelectorAll('[data-cpfin]').forEach(b => b.onclick = () => { if (b.dataset.cpfin === S().cityId || !deps.finishRemote) deps.goCity(b.dataset.cpfin, 'hq'); else { deps.finishRemote(b.dataset.cpfin); redraw(); } });
  }
  return { winHtml, bind, dailyTick, stash, workDay, addXp };
}
