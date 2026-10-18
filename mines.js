// mines.js — Азия: собствен добив и производство на материали.
// В азиатските си градове купуваш кариери, мини и заводи. Те произвеждат всеки ден в собствен склад на обекта (до 30 дни).
// Заводите преработват суровина от твоите мини (железна руда → стомана; пясък + камък → бетон; пясък → стъкло), ако са свързани.
// Продукцията стига до склада на фирмата (econ.s.stock), когато градът е свързан с Европа: по жп — всеки ден, по море — веднъж седмично.
// Иначе я продаваш на място (70% от пазарната цена). Записът: S.mines = { sites: [{ id, city, kind, lv, store, ore, since }] }.
export const MINE_KINDS = {
  // 🛢️ петролната ера (първата стъпка на Азия): концесия → добив → рафинерия → износ
  oilwell:   { nm: 'Петролно находище',    ico: '🛢️', out: 'crude',    perDay: 500, cost: 30e6, upkeep: 9000,  size: [2, 2], oil: true },
  refinery:  { nm: 'Рафинерия',            ico: '🏭', out: 'fuel',     perDay: 60,  cost: 60e6, upkeep: 20000, size: [2, 2], oil: true, needs: { crude: 7 } },
  terminal:  { nm: 'Петролен терминал',    ico: '⚓', out: null,       perDay: 0,   cost: 45e6, upkeep: 12000, size: [2, 2], oil: true, coast: true },
  sandpit:   { nm: 'Пясъчна кариера',      ico: '🏜️', out: 'sand',     perDay: 900, cost: 8e6,  upkeep: 6000,  size: [2, 2] },
  quarry:    { nm: 'Каменна кариера',      ico: '⛰️', out: 'gravel',   perDay: 800, cost: 9e6,  upkeep: 6500,  size: [2, 2] },
  ironmine:  { nm: 'Железорудна мина',     ico: '⛏️', out: 'ore',      perDay: 120, cost: 16e6, upkeep: 9000,  size: [2, 2] },
  sawmill:   { nm: 'Дъскорезница',         ico: '🪵', out: 'wood',     perDay: 110, cost: 10e6, upkeep: 6000,  size: [2, 2] },
  steelmill: { nm: 'Стоманодобивен завод', ico: '🏭', out: 'steel',    perDay: 60,  cost: 40e6, upkeep: 18000, size: [2, 2], needs: { ore: 1.6 } },
  cement:    { nm: 'Циментов завод',       ico: '🏗️', out: 'concrete', perDay: 380, cost: 25e6, upkeep: 12000, size: [2, 2], needs: { sand: 0.8, gravel: 1.2 } },
  glass:     { nm: 'Стъкларна',            ico: '🪟', out: 'glass',    perDay: 900, cost: 20e6, upkeep: 9000,  size: [2, 2], needs: { sand: 0.5 } },
  // ⚡ Австралия и Океания: енергийната империя — централите произвеждат ток всеки ден, подстанцията ги връзва към националната мрежа
  grid:      { nm: 'Подстанция и далекопровод', ico: '⚡', out: null,  perDay: 0,   cost: 25e6, upkeep: 4000,  size: [2, 2], energy: true, region: 'oc' },
  solar:     { nm: 'Соларен парк',         ico: '☀️', out: 'power',    perDay: 800, cost: 40e6, upkeep: 6000,  size: [2, 2], energy: true, region: 'oc' },
  wind:      { nm: 'Вятърен парк',         ico: '🌬️', out: 'power',    perDay: 700, cost: 36e6, upkeep: 7000,  size: [2, 2], energy: true, region: 'oc' },
  battery:   { nm: 'Батерийна ферма',      ico: '🔋', out: null,       perDay: 0,   cost: 30e6, upkeep: 5000,  size: [2, 2], energy: true, region: 'oc' },
};
export const ORE = { nm: 'Желязна руда', ico: '🪨', unit: 'т', buyPrice: 260 };   // само за стоманодобивните заводи
export const CRUDE = { nm: 'Суров петрол', ico: '🛢️', unit: 'бар.', buyPrice: 55 };
export const FUEL = { nm: 'Гориво', ico: '⛽', unit: 'хил. л', buyPrice: 1300 };
export const POWER = { nm: 'Електроенергия', ico: '⚡', unit: 'MWh', buyPrice: 85 };
const EXTRA = { ore: ORE, crude: CRUDE, fuel: FUEL, power: POWER };
// енергията: колко ток гълтат мините и заводите (MWh/ден на ниво); захранени от твоята мрежа, работят +25%
const PW_NEED = { oilwell: 120, refinery: 300, terminal: 60, sandpit: 80, quarry: 100, ironmine: 150, sawmill: 60, steelmill: 350, cement: 250, glass: 200 };
export const GRID_NEED = { cities: 5, mwh: 3000 };   // „Национална енергийна мрежа“: подстанции в 5 града и 3000 MWh/ден → автоматизация
const LOCAL_K = 0.5, BATT_K = 1.3, CABLE_CITY = 'darwin';   // без подстанция — токът се продава на място за 50%; Sun Cable тръгва от Дарвин
// петролът е само в Персийския залив: Саудитска Арабия — находищата, ОАЕ — преработка и износ
const OIL_CC = ['🇸🇦', '🇦🇪', '🇶🇦', '🇰🇼'];
// какво „дава“ природата на всеки регион: +50% добив
export const RICH = {
  '🇨🇳': ['ironmine', 'steelmill', 'cement'], '🇮🇳': ['ironmine', 'cement'], '🇸🇦': ['oilwell', 'sandpit', 'glass'], '🇦🇪': ['refinery', 'terminal', 'sandpit', 'glass'],
  '🇮🇩': ['sawmill'], '🇲🇾': ['sawmill'], '🇹🇭': ['sawmill', 'quarry'], '🇻🇳': ['quarry', 'cement'], '🇵🇭': ['sawmill'],
  '🇦🇺': ['solar', 'battery'], '🇳🇿': ['wind'], '🇫🇯': ['solar'], '🇵🇬': ['solar'],
  '🇯🇵': ['steelmill'], '🇰🇷': ['steelmill', 'glass'], '🇰🇿': ['ironmine'], '🇺🇿': ['quarry'], '🇷🇺': ['ironmine', 'sawmill'],
};
const MAX_PER_CITY = 4, STORE_DAYS = 30, SELL_K = 0.7, SEA_EVERY = 7, LV_MAX = 3;

// deps: { S, econ, MATERIALS, cityName, cityCc, isAsia, ownedCities, linkEU(id) → 'rail' | 'sea' | null, linked(a, b), coastal(id), toast, fmt, save, sound, onChange }
export function createMines(deps) {
  const st = () => { const S = deps.S(); S.mines = S.mines || { sites: [], seq: 0 }; return S.mines; };
  const mat = k => EXTRA[k] || deps.MATERIALS[k];
  const rich = s => (RICH[deps.cityCc(s.city)] || []).includes(s.kind);
  const rate = s => Math.round(MINE_KINDS[s.kind].perDay * (1 + 0.5 * ((s.lv || 1) - 1)) * (rich(s) ? 1.5 : 1) * (s.pw ? 1.25 : 1));
  const cap = s => rate(s) * STORE_DAYS;
  const upkeep = s => Math.round(MINE_KINDS[s.kind].upkeep * (1 + 0.4 * ((s.lv || 1) - 1)));
  const upCost = s => Math.round(MINE_KINDS[s.kind].cost * 0.6 * (s.lv || 1) / 1e5) * 1e5;
  const sitesIn = id => st().sites.filter(s => s.city === id);
  const oilAge = () => st().sites.some(s => s.kind === 'refinery');   // кариерите и заводите — след първата рафинерия
  const whyNot = (id, kind) => { const K = MINE_KINDS[kind];
    if (K.energy) { if (kind === 'battery' && !sitesIn(id).some(s => MINE_KINDS[s.kind].out === 'power')) return 'първо соларен или вятърен парк в града'; return null; }
    if (K.oil && kind === 'oilwell' && !OIL_CC.includes(deps.cityCc(id))) return 'петрол има само в Залива (Саудитска Арабия, ОАЕ)';
    if (K.coast && !deps.coastal(id)) return 'нужен е крайморски град';
    if (!K.oil && !K.energy && !oilAge()) return 'след първата рафинерия';
    return null; };
  const inRegion = (id, kind) => MINE_KINDS[kind].region === 'oc' ? !!deps.isOceania?.(id) : deps.isAsia(id);
  const canBuild = (id, kind) => inRegion(id, kind) && deps.ownedCities().includes(id) && sitesIn(id).length < MAX_PER_CITY && !sitesIn(id).some(s => s.kind === kind) && !whyNot(id, kind);

  function buy(id, kind) {
    const K = MINE_KINDS[kind]; if (!K || !canBuild(id, kind)) return false;
    const e = deps.econ(); if (!e.canAfford(K.cost)) { deps.toast(`Нямаш ${deps.fmt(K.cost)} € за ${K.nm.toLowerCase()}.`, 'bad'); return false; }
    e.spend(K.cost, 'покупка', `${K.nm} в ${deps.cityName(id)}`);
    const m = st(); m.seq = (m.seq || 0) + 1;
    m.sites.push({ id: m.seq, city: id, kind, lv: 1, store: 0, since: deps.S().day });
    deps.toast(`${K.ico} ${K.nm} в ${deps.cityName(id)} е твоя!${K.out ? ` Произвежда ~${deps.fmt(rate(m.sites[m.sites.length - 1]))} ${mat(K.out).unit}/ден.` : kind === 'grid' ? ' Градът е в националната мрежа.' : kind === 'battery' ? ' Пази тока от обяд за вечерния пик (+30% цена).' : ' Танкерите ще изнасят петрола и горивото всяка седмица.'}`, 'good');
    deps.sound && deps.sound('buy'); deps.save(); deps.onChange && deps.onChange(id); return true;
  }
  function upgrade(sid) {
    const s = st().sites.find(x => x.id === sid); if (!s || (s.lv || 1) >= LV_MAX) return;
    const c = upCost(s), e = deps.econ(); if (!e.canAfford(c)) { deps.toast(`Нямаш ${deps.fmt(c)} €.`, 'bad'); return; }
    e.spend(c, 'покупка', `Разширение: ${MINE_KINDS[s.kind].nm} в ${deps.cityName(s.city)}`); s.lv = (s.lv || 1) + 1;
    deps.toast(`⬆️ ${MINE_KINDS[s.kind].nm} в ${deps.cityName(s.city)} — ниво ${s.lv}, добив ~${deps.fmt(rate(s))}/ден.`, 'good'); deps.sound && deps.sound('upgrade'); deps.save(); deps.onChange && deps.onChange(s.city);
  }
  function sell(sid) {   // продава склада на обекта на място
    const s = st().sites.find(x => x.id === sid); if (!s || !s.store || !MINE_KINDS[s.kind].out || MINE_KINDS[s.kind].energy) return;
    const M = mat(MINE_KINDS[s.kind].out), got = Math.round(s.store * M.buyPrice * SELL_K);
    deps.econ().earn(got, 'обект', `Продажба: ${Math.round(s.store)} ${M.unit} ${M.nm.toLowerCase()} от ${deps.cityName(s.city)}`);
    deps.toast(`💰 Продаде ${deps.fmt(Math.round(s.store))} ${M.unit} ${M.nm.toLowerCase()} за ${deps.fmt(got)} €.`, 'good'); s.store = 0; deps.sound && deps.sound('cash'); deps.save();
  }
  function demolish(sid) { const m = st(); const s = m.sites.find(x => x.id === sid); if (!s) return; m.sites.splice(m.sites.indexOf(s), 1); deps.econ().earn(Math.round(MINE_KINDS[s.kind].cost * 0.4), 'покупка', `Продаден обект: ${MINE_KINDS[s.kind].nm}`); deps.save(); deps.onChange && deps.onChange(s.city); }

  // суровините за заводите: от мините, свързани със завода (същият град или по жп/път)
  function pull(s, need, linked = deps.linked) {
    const src = st().sites.filter(x => MINE_KINDS[x.kind].out === need && x.store > 0 && (x.city === s.city || linked(x.city, s.city)));
    return src;
  }
  // ⚡ ток: производство (времето мени слънцето и вятъра; батерията изглажда), първо захранва мините и заводите ти, остатъкът се продава
  const plants = () => st().sites.filter(s => MINE_KINDS[s.kind].out === 'power');
  const hasIn = (id, kind) => st().sites.some(s => s.city === id && s.kind === kind);
  const onGrid = id => hasIn(id, 'grid');
  const gridCities = () => [...new Set(st().sites.filter(s => s.kind === 'grid').map(s => s.city))];
  const cable = () => onGrid(CABLE_CITY);   // Sun Cable: Дарвин — Сингапур, токът стига до Азия
  const wx = (s, day, bat = hasIn(s.city, 'battery')) => { const r = Math.abs(Math.sin((day + 1) * 12.9898 + s.id * 78.233) * 43758.5453) % 1;
    const f = s.kind === 'solar' ? 0.7 + 0.45 * r : 0.5 + 0.9 * r; return bat ? Math.max(0.9, f) : f; };
  const gridMax = () => plants().filter(s => onGrid(s.city)).reduce((a, s) => a + rate(s), 0);
  const nationalGrid = () => gridCities().length >= GRID_NEED.cities && gridMax() >= GRID_NEED.mwh;
  function power(day) {
    const sites = st().sites, grid = new Set(), batteries = new Set(), P = [];
    for (const s of sites) {
      if (s.kind === 'grid') grid.add(s.city);
      if (s.kind === 'battery') batteries.add(s.city);
      if (MINE_KINDS[s.kind].out === 'power') P.push(s);
    }
    const cableOn = grid.has(CABLE_CITY);
    let mwh = 0, local = 0, cash = 0, sold = 0;
    for (const s of P) { const q = Math.round(rate(s) * wx(s, day, batteries.has(s.city))); s.store = q;
      if (grid.has(s.city)) mwh += q; else { local += q; const c = Math.round(q * POWER.buyPrice * LOCAL_K); cash += c; sold += q; } }
    // захранване на мините и заводите (в Океания — веднага; в Азия — само по Sun Cable от Дарвин)
    const users = sites.filter(s => !MINE_KINDS[s.kind].energy && (deps.isOceania?.(s.city) || cableOn));
    let left = mwh, used = 0;
    for (const s of sites) if (!MINE_KINDS[s.kind].energy) s.pw = false;
    for (const s of users) { const n = (PW_NEED[s.kind] || 100) * (s.lv || 1); if (left >= n) { left -= n; used += n; s.pw = true; } }
    // остатъкът — в мрежата; с батерия в някой свързан град — вечерен пик (+30%)
    const bat = [...grid].some(id => batteries.has(id));
    if (left > 0) { cash += Math.round(left * POWER.buyPrice * (bat ? BATT_K : 1)); sold += left; }
    return { mwh, local, used, sold, cash, bat, grid: grid.size };
  }
  const powerNeed = () => st().sites.filter(s => !MINE_KINDS[s.kind].energy).reduce((a, s) => a + (PW_NEED[s.kind] || 100) * (s.lv || 1), 0);
  let lastReport = { day: 0, made: {}, sent: {}, sold: 0 }, lastFuel = 0;
  function dailyTick() {
    const S = deps.S(); if (!S) return; const m = st(); if (!m.sites.length) return;
    const e = deps.econ(), day = S.day, made = {}, sent = {};
    const linkMemo = new Map(), linkedDay = (a, b) => {
      if (a === b) return true;
      let row = linkMemo.get(a); if (row?.has(b)) return row.get(b);
      const linked = deps.linked(a, b);
      if (!row) linkMemo.set(a, row = new Map()); row.set(b, linked);
      let reverse = linkMemo.get(b); if (!reverse) linkMemo.set(b, reverse = new Map()); reverse.set(a, linked);
      return linked;
    };
    const viaByCity = new Map(), linkEU = id => {
      if (!viaByCity.has(id)) viaByCity.set(id, deps.linkEU(id));
      return viaByCity.get(id);
    };
    let upk = 0;
    // 1) мините и кариерите
    const pw = power(day);
    for (const s of m.sites) { const K = MINE_KINDS[s.kind]; upk += upkeep(s); if (K.needs || !K.out || K.energy) continue; s.store = Math.min(cap(s), (s.store || 0) + rate(s)); made[K.out] = (made[K.out] || 0) + rate(s); }
    // 2) заводите: колкото позволяват суровините
    for (const s of m.sites) {
      const K = MINE_KINDS[s.kind]; if (!K.needs) continue;
      let can = rate(s);
      for (const [r, k] of Object.entries(K.needs)) { const have = pull(s, r, linkedDay).reduce((a, x) => a + x.store, 0); can = Math.min(can, Math.floor(have / k)); }
      s.starved = can < rate(s) * 0.5;
      if (can <= 0) continue;
      for (const [r, k] of Object.entries(K.needs)) { let need = can * k; for (const x of pull(s, r, linkedDay)) { const t = Math.min(x.store, need); x.store -= t; need -= t; if (need <= 0) break; } }
      s.store = Math.min(cap(s), (s.store || 0) + can); made[K.out] = (made[K.out] || 0) + can;
    }
    // 3) доставка до склада на фирмата (Европа): жп — всеки ден, море — веднъж седмично
    for (const s of m.sites) {
      const K = MINE_KINDS[s.kind]; if (!K.out || ['ore', 'crude', 'fuel', 'power'].includes(K.out) || !s.store) continue;   // петролът и горивото — за износ или за собствените машини
      const via = linkEU(s.city); s.via = via;
      if (!via || (via === 'sea' && day % SEA_EVERY)) continue;
      const q = Math.floor(s.store); e.s.stock[K.out] = (e.s.stock[K.out] || 0) + q; s.store -= q; sent[K.out] = (sent[K.out] || 0) + q;
    }
    // 4) износ през петролния терминал: веднъж седмично суровият петрол (и горивото, ако не отива към склада) — с премия 25%
    let exp = 0;
    const terms = m.sites.filter(s => s.kind === 'terminal');
    // 🛢️ петролната империя (oil.js): терминалът не продава сам — всеки ден петролът и горивото отиват в танковата ферма
    if (terms.length && deps.oilIntake) for (const s of m.sites) {
      const K = MINE_KINDS[s.kind]; if (!['crude', 'fuel'].includes(K.out) || !s.store || (K.out === 'fuel' && s.keep)) continue;
      if (!terms.some(t => t.city === s.city || linkedDay(t.city, s.city))) continue;
      deps.oilIntake(K.out, Math.floor(s.store)); s.store -= Math.floor(s.store);
    }
    else if (terms.length && day % 7 === 0) for (const s of m.sites) {
      const K = MINE_KINDS[s.kind]; if (!['crude', 'fuel'].includes(K.out) || !s.store) continue;
      if (K.out === 'fuel' && s.keep) continue;   // „запази за собствените машини“
      if (!terms.some(t => t.city === s.city || linkedDay(t.city, s.city))) continue;
      exp += Math.round(s.store * mat(K.out).buyPrice * 1.25); s.store = 0;
    }
    if (exp) { e.earn(exp, 'обект', 'Износ на петрол и гориво (терминал)'); deps.toast(`🛳️ Танкерите отплаваха: износ на петрол и гориво +${deps.fmt(exp)} €.`, 'good'); }
    // 5) собственото гориво покрива разхода за гориво на техниката, влаковете и корабите (по себестойност ~40% от пазарната)
    const fuelSite = m.sites.filter(s => s.kind === 'refinery' && s.keep && s.store > 0);
    if (fuelSite.length && deps.fuelBill) { const bill = deps.fuelBill(); if (bill > 0) { let need = bill / FUEL.buyPrice; let used = 0; for (const s of fuelSite) { const t = Math.min(s.store, need); s.store -= t; need -= t; used += t; if (need <= 0) break; } const back = Math.round(used * FUEL.buyPrice * 0.6); if (back) { e.earn(back, 'гориво', `Собствено гориво (${deps.fmt(Math.round(used))} хил. л)`); lastFuel = back; } } }
    if (pw.cash) e.earn(pw.cash, 'обект', `Електроенергия: ${deps.fmt(pw.sold)} MWh в мрежата`);
    if (upk) e.spend(upk, 'заплати', `Поддръжка на добива и енергетиката (${m.sites.length})`);
    lastReport = { day, made, sent, upk, pw };
    if (day % 7 === 0 && Object.keys(sent).length) deps.toast(`⛏️ Добив тази седмица: ${Object.entries(sent).map(([k, q]) => `${mat(k).ico} ${deps.fmt(q)} ${mat(k).unit}`).join(' · ')} → в склада (спести ~${deps.fmt(Object.entries(sent).reduce((a, [k, q]) => a + q * mat(k).buyPrice, 0))} €).`, 'good');
  }
  // стойност на дневната продукция по пазарни цени (за таблото)
  const dailyValue = (pred = () => true) => st().sites.filter(pred).reduce((a, s) => a + (!MINE_KINDS[s.kind].out || MINE_KINDS[s.kind].out === 'ore' ? 0 : rate(s) * mat(MINE_KINDS[s.kind].out).buyPrice), 0);
  const totalUpkeep = (pred = () => true) => st().sites.filter(pred).reduce((a, s) => a + upkeep(s), 0);
  const toggleKeep = sid => { const s = st().sites.find(x => x.id === sid); if (s) { s.keep = !s.keep; deps.save(); } };
  return { state: st, toggleKeep, whyNot, oilAge, fuelSaved: () => lastFuel, buy, upgrade, sell, demolish, dailyTick, rate, cap, upkeep, upCost, rich, sitesIn, canBuild, mat, dailyValue, totalUpkeep, report: () => lastReport, onGrid, gridCities, gridMax, nationalGrid, cable, powerNeed, PW_NEED, GRID_NEED, CABLE_CITY, LV_MAX, MAX_PER_CITY, SELL_K };
}
