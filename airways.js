// airways.js — Фаза WORLD: летища (ниво 9) и авиолинии до целия свят (ниво 10).
// Само данни и чисти сметки; game.js държи записа (S.airports, S.airRoutes, S.planes) и рисува.
//   S.airports = { cityId: { lv, build: { target, prog } | null } }   — летище в твой град (общо за фирмата)
//   S.airRoutes = [{ a, b, km }]                                      — авиолиния: a е твое летище, b — всеки отключен град
//   S.planes = [{ id, kind, nm, at, path: [a, b] | null, km, total }] — самолетите летят сами по случайни линии
export const AIRPORT_LEVELS = [
  { nm: 'Летище', gates: 1, cost: 4000000, days: 20 },
  { nm: 'Летище с 2 гейта', gates: 2, cost: 3000000, days: 14 },
  { nm: 'Регионално летище', gates: 4, cost: 6000000, days: 18 },
  { nm: 'Международно летище', gates: 6, cost: 10000000, days: 24 },
  { nm: 'Международен хъб', gates: 10, cost: 18000000, days: 30 },
];
// seats × заетост × fare = приход на км; fuel — разход на км; speed — км на игрален ден
export const PLANES = {
  regional: { nm: 'Регионален (ATR 72)', ico: '🛩️', seats: 70, fare: 0.14, fuel: 3, range: 1500, speed: 1800, cost: 2500000, upkeep: 1500 },
  narrow: { nm: 'Пътнически (A320)', ico: '✈️', seats: 180, fare: 0.12, fuel: 6, range: 5500, speed: 2200, cost: 6000000, upkeep: 3500 },
  wide: { nm: 'Далекомагистрален (B787)', ico: '✈️', seats: 300, fare: 0.11, fuel: 10, range: 14000, speed: 2600, cost: 14000000, upkeep: 7000 },
  cargo: { nm: 'Товарен (B747F)', ico: '📦', cargo: true, tons: 110, fare: 0.2, fuel: 11, range: 8000, speed: 2300, cost: 11000000, upkeep: 6000 },
};
export const LOAD = 0.8;   // средна заетост на седалките
// права за авиолиния: основа + на км
export const ROUTE_COST = km => Math.round((300000 + km * 150) / 10000) * 10000;
// разстояние по права (голям кръг), км
export function airKm(A, B) {
  const r = Math.PI / 180, h = Math.sin((B.lat - A.lat) * r / 2) ** 2 + Math.cos(A.lat * r) * Math.cos(B.lat * r) * Math.sin((B.lon - A.lon) * r / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)));
}
// приход и разход за един полет
export function flightPay(kind, km) {
  const P = PLANES[kind];
  const gross = P.cargo ? P.tons * P.fare * km : P.seats * LOAD * P.fare * km;
  return { gross: Math.round(gross / 10) * 10, fuel: Math.round(P.fuel * km / 10) * 10 };
}
// нетно на ден при непрекъснати полети (за магазина)
export const planeDaily = kind => { const P = PLANES[kind], f = flightPay(kind, 1000); return Math.round((f.gross - f.fuel) / 1000 * P.speed - P.upkeep); };
// ✈️ големите градове по света (ниво 10)
export const WORLD = [
  { id: 'newyork', nm: 'Ню Йорк', lat: 40.713, lon: -74.006, sz: 3, cc: '🇺🇸' },
  { id: 'chicago', nm: 'Чикаго', lat: 41.878, lon: -87.630, sz: 3, cc: '🇺🇸', left: true },
  { id: 'losangeles', nm: 'Лос Анджелис', lat: 34.052, lon: -118.244, sz: 3, cc: '🇺🇸' },
  { id: 'toronto', nm: 'Торонто', lat: 43.653, lon: -79.383, sz: 3, cc: '🇨🇦', left: true },
  { id: 'mexicocity', nm: 'Мексико', lat: 19.433, lon: -99.133, sz: 3, cc: '🇲🇽' },
  { id: 'rio', nm: 'Рио де Жанейро', lat: -22.907, lon: -43.173, sz: 3, cc: '🇧🇷' },
  { id: 'saopaulo', nm: 'Сао Пауло', lat: -23.551, lon: -46.633, sz: 3, cc: '🇧🇷', left: true },
  { id: 'buenosaires', nm: 'Буенос Айрес', lat: -34.604, lon: -58.382, sz: 3, cc: '🇦🇷' },
  { id: 'cairo', nm: 'Кайро', lat: 30.044, lon: 31.236, sz: 3, cc: '🇪🇬' },
  { id: 'capetown', nm: 'Кейптаун', lat: -33.925, lon: 18.424, sz: 3, cc: '🇿🇦' },
  { id: 'dubai', nm: 'Дубай', lat: 25.205, lon: 55.271, sz: 3, cc: '🇦🇪' },
  { id: 'mumbai', nm: 'Мумбай', lat: 19.076, lon: 72.878, sz: 3, cc: '🇮🇳' },
  { id: 'singapore', nm: 'Сингапур', lat: 1.352, lon: 103.820, sz: 3, cc: '🇸🇬' },
  { id: 'hongkong', nm: 'Хонконг', lat: 22.320, lon: 114.169, sz: 3, cc: '🇭🇰' },
  { id: 'shanghai', nm: 'Шанхай', lat: 31.230, lon: 121.474, sz: 3, cc: '🇨🇳' },
  { id: 'beijing', nm: 'Пекин', lat: 39.904, lon: 116.407, sz: 3, cc: '🇨🇳', left: true },
  { id: 'seoul', nm: 'Сеул', lat: 37.567, lon: 126.978, sz: 3, cc: '🇰🇷' },
  { id: 'tokyo', nm: 'Токио', lat: 35.676, lon: 139.650, sz: 3, cc: '🇯🇵' },
  { id: 'sydney', nm: 'Сидни', lat: -33.869, lon: 151.209, sz: 3, cc: '🇦🇺' },
];
export const WORLD_IDS = new Set(WORLD.map(c => c.id));
// реални летища: в кои градове може да има летище и до какво ниво (останалите — без летище)
export const AIRPORT_MAX = {
  sofia: 5, varna: 4, burgas: 4, plovdiv: 3, vt: 2 /* Горна Оряховица */, ruse: 2, stz: 1,
  istanbul: 5, athens: 5, bucharest: 4, belgrade: 4, ankara: 4, thessaloniki: 3, skopje: 3, constanta: 2, nis: 2,
  london: 5, paris: 5, amsterdam: 5, munich: 5, madrid: 5, rome: 5,
  rotterdam: 2, hague: 0, // RTM
  berlin: 4, vienna: 4, zurich: 4, brussels: 4, milan: 4, barcelona: 4, prague: 4, warsaw: 4, budapest: 4, luxembourg: 2,
  // новите градове (countries.js) с реални летища
  izmir: 4, bursa: 1, cluj: 2, timisoara: 2, iasi: 2, novisad: 0, kragujevac: 0, subotica: 0, bitola: 0, ohrid: 1, kumanovo: 0, prilep: 0,
  patras: 1, heraklion: 3, larissa: 0, marseille: 4, lyon: 4, toulouse: 3, nice: 4, manchester: 4, birmingham: 3, liverpool: 2, edinburgh: 3,
  utrecht: 0, eindhoven: 2, antwerp: 1, ghent: 0, liege: 1, bruges: 0, hamburg: 4, frankfurt: 5, cologne: 3, brno: 1, ostrava: 1, plzen: 0,
  olomouc: 0, graz: 2, linz: 1, salzburg: 2, innsbruck: 2, debrecen: 1, szeged: 0, pecs: 0, gyor: 0, krakow: 3, gdansk: 3, wroclaw: 2,
  poznan: 2, naples: 3, turin: 3, florence: 2, valencia: 3, seville: 3, bilbao: 2, geneva: 4, basel: 3, bern: 1, lausanne: 0,
};
// по-малките градове по света (без истинско голямо летище)
export const WORLD_SMALL = { ajman: 0, luxor: 2, aswan: 2, mardelplata: 2, cancun: 3, portelizabeth: 2, sharjah: 3, salvador: 3, fortaleza: 3, adelaide: 3, perth: 4, heraklion: 3, patras: 1, nice: 4 };
export const airportMax = id => id in AIRPORT_MAX ? AIRPORT_MAX[id] : id in WORLD_SMALL ? WORLD_SMALL[id] : WORLD_IDS.has(id) ? 5 : 0;
