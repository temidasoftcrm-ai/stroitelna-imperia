// corridors.js — Фаза 9: аутобани (международни коридори през Европа).
// Участъците са двойки съседни градове; общ участък на два коридора се строи веднъж и носи тол и на двата.
// game.js ползва: AUTOBAHNS, abSegs(), abSegId(a, b), AB_STAGES_DEF (ако autobahn.js още не е зареден), AB_UNLOCK.
export const AUTOBAHNS = [
  { id: 'E1', nm: 'Париж — Истанбул', cities: ['paris', 'munich', 'vienna', 'budapest', 'belgrade', 'nis', 'sofia', 'plovdiv', 'edirne', 'istanbul'] },
  { id: 'E2', nm: 'Лондон — Атина', cities: ['london', 'brussels', 'luxembourg', 'zurich', 'munich', 'vienna', 'budapest', 'belgrade', 'nis', 'skopje', 'thessaloniki', 'athens'] },
  { id: 'E3', nm: 'Мадрид — Варна', cities: ['madrid', 'barcelona', 'milan', 'vienna', 'budapest', 'bucharest', 'varna'] },
];
// отключване: ниво 8 (Европа) и поне 3 изцяло завършени български магистрали
export const AB_UNLOCK = { lv: 8, bgFull: 3 };
// истински трасета между градове, които по права линия минават през море/планина (жп и аутобани):
// ключ — двата града по азбучен ред; точките са [lon, lat] от първия към втория
export const ROUTE_VIA = {
  'barcelona|milan': [[2.90, 42.70], [3.88, 43.61], [5.37, 43.30], [7.27, 43.70], [8.93, 44.41]],   // Перпинян, Монпелие, Марсилия, Ница, Генуа
  'athens|thessaloniki': [[22.43, 38.90], [22.42, 39.64]],                                           // Ламия, Лариса
  'brussels|london': [[3.06, 50.63], [1.86, 50.95], [1.17, 51.08]],                                  // Лил, Кале, (тунел) Фолкстоун
};
export const viaOf = (a, b) => { const k = [a, b].sort().join('|'), v = ROUTE_VIA[k]; return !v ? null : a <= b ? v : [...v].reverse(); };
export const abSegId = (a, b) => 'ab:' + [a, b].sort().join('-');
// всички участъци без повторение; hw е първият коридор, в който участъкът се среща
export function abSegs() {
  const seen = new Map();
  for (const c of AUTOBAHNS) for (let i = 1; i < c.cities.length; i++) {
    const a = c.cities[i - 1], b = c.cities[i], id = abSegId(a, b);
    if (!seen.has(id)) seen.set(id, { id, hw: c, a, b, ab: true });
  }
  return [...seen.values()];
}
export const corridorSegIds = c => c.cities.slice(1).map((b, i) => abSegId(c.cities[i], b));
// резервни етапи — autobahn.js (AB_STAGES) ги замества, щом се зареди
export const AB_STAGES_DEF = [
  { nm: 'Земни работи', ico: '🚜', need: { bulldozer: 2, grader: 1, truck: 3, crew: 2 } },
  { nm: 'Мостове и тунели', ico: '🌉', need: { crane: 2, truck: 2, crew: 3 } },
  { nm: 'Пътна основа', ico: '🪨', need: { grader: 2, roller: 2, truck: 3, crew: 2 } },
  { nm: 'Асфалт', ico: '🛣️', need: { paver: 2, roller: 3, truck: 2, crew: 3 } },
  { nm: 'Мантинели и табели', ico: '🚧', need: { marker: 2, crane: 1, crew: 2 } },
];
