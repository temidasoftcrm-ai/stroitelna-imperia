// services.js — 🏛️ обществените услуги в градовете (част D на задачата от 2026-10-19; зад feature('city-services')).
// Тук е само регистърът и сметките (без 3D): кои услуги има един град според размера си, колко сгради от всяка, какъв
// капацитет дават, какво покриват и какво още трябва. Разполагането по парцелите и 3D — services3d.js (по плана на 55).
// Логиката на поръчките за разширяване (D2) е при dimiter-f1: той вика needs() и builds(), а резултата пише в S.svc.
//
// Размер на града (tier): 's' малък (sz 1) · 'm' среден (sz 2) · 'l' голям (sz 3) · 'x' мегаполис (MEGAPOLIS).
// Запис (S.svc[cityId]): { [k]: [{ lvl: 's'|'m'|'l', lot?: id, built: денят, prog?: 0–1 }] } — построените сгради на града.
// Населението (pop) идва от играта (deps на извикващия); капацитетът е „колко жители обслужва“ една сграда от ниво lvl.

export const TIERS = ['s', 'm', 'l', 'x'];
export const TIER_NM = { s: 'малък', m: 'среден', l: 'голям', x: 'мегаполис' };
// модели: civic2 (размери s/m/l) и civic; регионалните варианти — по региона на града (eu, us, ru, asia, me, af, la)
const C2 = 'assets/heavy/civic2/', C1 = 'assets/heavy/civic/';
// k → { ico, nm, cat, road: 'main' (директен излаз към основна улица) | 'street', lot: [w, d] в метри по ниво, cap по ниво, models по ниво,
//       base: брой по tier (основата, която всеки град има), district: дали в големите градове има районни (запазени места) }
export const SERVICES = {
  hall: { ico: '🏛️', nm: 'Кметство и площад', cat: 'admin', road: 'main', lot: { s: [30, 30], m: [36, 34], l: [44, 40] }, cap: { s: 60e3, m: 250e3, l: 1.2e6 },
    models: { s: [C1 + 'cityhall.glb'], m: [C1 + 'cityhall.glb'], l: [C1 + 'cityhall.glb', C1 + 'court.glb'] }, plaza: true, base: { s: 1, m: 1, l: 1, x: 1 }, district: { l: 2, x: 5 }, dnm: 'Районна администрация' },
  hosp: { ico: '🏥', nm: 'Болница', cat: 'health', road: 'main', lot: { s: [26, 22], m: [34, 28], l: [44, 36] }, cap: { s: 50e3, m: 180e3, l: 600e3 },
    models: { s: [C2 + 'hosp-s1.glb', C2 + 'hosp-s2.glb'], m: [C2 + 'hosp-m1.glb', C2 + 'hosp-m2.glb'], l: [C2 + 'hosp-l1.glb', C2 + 'hosp-l2.glb', 'assets/heavy/hospital/hospital.glb'] }, base: { s: 1, m: 1, l: 1, x: 1 }, district: { l: 2, x: 6 }, dnm: 'Районна болница', cars: 'ambulance' },
  fire: { ico: '🚒', nm: 'Пожарна', cat: 'safety', road: 'main', lot: { s: [22, 20], m: [28, 24], l: [34, 28] }, cap: { s: 60e3, m: 200e3, l: 500e3 },
    models: { s: [C2 + 'fire-s1.glb', C2 + 'fire-s2.glb'], m: [C2 + 'fire-m1.glb', C1 + 'fire.glb'], l: [C2 + 'fire-l1.glb'] }, base: { s: 1, m: 1, l: 2, x: 3 }, district: { l: 2, x: 6 }, dnm: 'Районна пожарна', cars: 'fire' },
  police: { ico: '🚓', nm: 'Полиция', cat: 'safety', road: 'street', lot: { s: [20, 18], m: [26, 22], l: [34, 28] }, cap: { s: 60e3, m: 220e3, l: 700e3 },
    models: { s: [C2 + 'police-s1.glb', C2 + 'police-s2.glb'], m: [C2 + 'police-m1.glb', C1 + 'police.glb'], l: [C2 + 'police-l1.glb', C2 + 'police-l2.glb'] }, base: { s: 1, m: 1, l: 1, x: 1 }, district: { l: 2, x: 6 }, dnm: 'Районен участък', cars: 'police' },
  school: { ico: '🏫', nm: 'Училище', cat: 'edu', road: 'street', lot: { s: [26, 24], m: [30, 26], l: [34, 30] }, cap: { s: 35e3, m: 90e3, l: 260e3 },
    models: { s: [C1 + 'school.glb'], m: [C1 + 'school.glb'], l: [C1 + 'school.glb'] }, base: { s: 1, m: 2, l: 4, x: 6 }, district: { l: 3, x: 8 } },
  kinder: { ico: '🧸', nm: 'Детска градина', cat: 'edu', road: 'street', lot: { s: [18, 16], m: [20, 18], l: [22, 20] }, cap: { s: 30e3, m: 70e3, l: 220e3 }, proc: 'kinder', base: { s: 1, m: 2, l: 3, x: 5 } },
  voc: { ico: '🛠️', nm: 'Професионална гимназия', cat: 'edu', road: 'street', lot: { m: [30, 26], l: [34, 30] }, cap: { m: 150e3, l: 400e3 }, models: { m: [C1 + 'school.glb'], l: [C1 + 'school.glb'] }, base: { m: 1, l: 1, x: 2 }, perk: 'кадри за бригадите' },
  uni: { ico: '🎓', nm: 'Университет', cat: 'edu', road: 'main', lot: { l: [56, 44] }, cap: { l: 1.5e6 }, tender: 'university', base: { l: 1, x: 2 }, perk: 'специалисти и подобрения' },
  park: { ico: '🌳', nm: 'Парк', cat: 'leisure', road: 'street', lot: { s: [24, 24], m: [40, 34], l: [60, 50] }, cap: { s: 40e3, m: 150e3, l: 500e3 }, proc: 'park', base: { s: 1, m: 1, l: 1, x: 2 }, district: { l: 2, x: 6 }, dnm: 'Районен парк', perk: 'по-скъпи имоти наоколо' },
  sport: { ico: '🏟️', nm: 'Спортна зала / стадион', cat: 'leisure', road: 'main', lot: { m: [36, 30], l: [80, 64] }, cap: { m: 200e3, l: 1e6 }, proc: 'gym', tender: { l: 'stadium' }, base: { m: 1, l: 1, x: 1 }, perk: 'наплив към транспорта и хотелите' },
  bus: { ico: '🚌', nm: 'Автогара и депо', cat: 'transit', road: 'main', lot: { m: [30, 24], l: [40, 30] }, cap: { m: 250e3, l: 800e3 }, proc: 'bus', base: { m: 1, l: 1, x: 2 } },
  util: { ico: '🛠️', nm: 'Комунална база', cat: 'util', road: 'street', lot: { s: [22, 18], m: [30, 24], l: [36, 28] }, cap: { s: 80e3, m: 250e3, l: 700e3 }, proc: 'depot', base: { s: 1, m: 1, l: 2, x: 3 }, perk: 'бригади и техника' },
  recycle: { ico: '♻️', nm: 'Рециклиращ център', cat: 'util', road: 'street', lot: { l: [36, 30] }, cap: { l: 1e6 }, proc: 'recycle', base: { l: 1, x: 2 }, perk: 'отпадъци → материал' },
};
// нивото на сградата според размера на града: малкият строи s, средният m, големите — l (районните — m)
export const LVL = { s: 's', m: 'm', l: 'l', x: 'l' };
export const tierOf = (sz, mega) => mega ? 'x' : sz >= 3 ? 'l' : sz >= 2 ? 'm' : 's';
const has = (S0, t) => !!(S0.base[t] || (S0.district && S0.district[t]));

// основата: какво трябва да има градът от размер t (без районните) — [{ k, lvl, n }]
export function baseFor(t) { const out = []; for (const [k, S0] of Object.entries(SERVICES)) { const n = S0.base[t] || 0; if (!n) continue; const lvl = S0.lot[LVL[t]] ? LVL[t] : Object.keys(S0.lot).pop(); out.push({ k, lvl, n }); } return out; }
// запазени места за районни услуги (големите градове) — [{ k, lvl: 'm', n }]
export function districtFor(t) { const out = []; for (const [k, S0] of Object.entries(SERVICES)) { const n = (S0.district && S0.district[t]) || 0; if (n) out.push({ k, lvl: S0.lot.m ? 'm' : LVL[t], n }); } return out; }
// в игрови единици: една сграда = обобщение (кампус, комплекс); в мегаполиса сградите са двойно по-големи
const capOf = (k, lvl, t) => { const c = SERVICES[k].cap; return (c[lvl] ?? Object.values(c).pop()) * (t === 'x' ? 2 : 1); };

// 📋 услугите на град: { k, ico, nm, built: N, lvls, cap (жители), demand (= pop), cover (0–1+), need: колко още сгради, slots (районни места) }
// rec — S.svc[cityId] (или {}); pop — жителите; t — tier
export function cityServices(rec, pop, t) {
  const out = [];
  for (const [k, S0] of Object.entries(SERVICES)) { if (!has(S0, t)) continue;
    const list = (rec && rec[k]) || [], done = list.filter(b => b.built != null && !(b.prog < 1)), cap = done.reduce((a, b) => a + capOf(k, b.lvl, t), 0);
    const base = S0.base[t] || 0, lvl = S0.lot[LVL[t]] ? LVL[t] : Object.keys(S0.lot).pop(), per = capOf(k, lvl, t);
    const need = Math.max(base - done.length, Math.ceil(Math.max(0, pop - cap) / per), 0);
    out.push({ k, ico: S0.ico, nm: S0.nm, cat: S0.cat, built: done.length, building: list.length - done.length, lvl, cap, demand: pop, cover: pop ? cap / pop : 1, need, slots: (S0.district && S0.district[t]) || 0, perk: S0.perk || null, road: S0.road });
  }
  return out;
}
// 🧾 какво да се поръча (за D2): услугите с недостиг, най-спешните първо (покритие, после основа) — [{ k, lvl, n, why, cost, days }]
export function needs(rec, pop, t) {
  return cityServices(rec, pop, t).filter(s => s.need > 0 && s.building === 0).sort((a, b) => a.cover - b.cover)
    .map(s => ({ k: s.k, lvl: s.lvl, n: s.need, why: s.built ? `покритие ${Math.round(s.cover * 100)}% — ${s.ico} ${s.nm} не стига за ${Math.round(s.demand / 1000)} хил. жители` : `градът няма ${s.nm.toLowerCase()}`, cost: costOf(s.k, s.lvl), days: daysOf(s.k, s.lvl) }));
}
// цена и срок на строеж (ориентир за поръчките; D2 може да ги мащабира по държава)
const BASE_COST = { hall: 8e6, hosp: 14e6, fire: 4e6, police: 3.5e6, school: 4e6, kinder: 1.5e6, voc: 5e6, uni: 40e6, park: 1.2e6, sport: 12e6, bus: 6e6, util: 3e6, recycle: 9e6 };
const LVL_K = { s: 1, m: 2.2, l: 4.5 };
export const costOf = (k, lvl) => Math.round((BASE_COST[k] || 3e6) * (LVL_K[lvl] || 1) / 1e5) * 1e5;
export const daysOf = (k, lvl) => Math.round(({ s: 40, m: 70, l: 110 }[lvl] || 60) * (k === 'uni' || k === 'sport' ? 1.6 : k === 'park' ? 0.5 : 1));
// ✅ отбелязва построена сграда (D2 вика при завършена поръчка) — rec се променя на място
export function builds(rec, k, lvl, day, lot = null) { (rec[k] = rec[k] || []).push({ lvl, built: day, lot }); return rec; }
// при старт на града: основата, ако записът е празен (старите градове получават базовите услуги веднъж — без прегенериране)
export function seedBase(rec, t, day = 0) { for (const { k, lvl, n } of baseFor(t)) { const have = (rec[k] || []).length; for (let i = have; i < n; i++) builds(rec, k, lvl, day); } return rec; }
// регионален вариант на модела: един и същ град → един и същ модел (без разбъркване при презареждане)
export function modelOf(k, lvl, seed = 0) { const L = SERVICES[k].models?.[lvl] || SERVICES[k].models?.m || SERVICES[k].models?.s; return L ? L[Math.abs(seed) % L.length] : null; }
// 👥 оценка на населението (в играта няма поле „жители“ на град): по размера и развитието — построени сгради и квартали.
// малък 40 хил. → 120 хил., среден 200 хил. → 600 хил., голям 1,2 млн. → 3 млн., мегаполис 6 млн. → 12 млн. при завършен град.
// Империал Сити — с истинското население (imperial.stats().pop), не с това.
const POP = { s: [40e3, 120e3], m: [200e3, 600e3], l: [1.2e6, 3e6], x: [6e6, 12e6] };
export function popOf(sz, mega, built = 0, ext = 0, extMax = 1) {
  const t = tierOf(sz, mega), [a, b] = POP[t], p = Math.min(1, Math.max(0, (extMax ? ext / extMax : 0) * 0.7 + Math.min(1, built / 200) * 0.3));
  return Math.round((a + (b - a) * p) / 1e3) * 1e3;
}
