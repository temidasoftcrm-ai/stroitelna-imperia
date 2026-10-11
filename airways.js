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
// 🌍 Африка (africa.js)
Object.assign(WORLD_SMALL, { casablanca: 5, rabat: 2, marrakesh: 4, tangier: 2, fes: 2, algiers: 4, oran: 3, constantine: 2, annaba: 1, setif: 0, tunis: 4, sfax: 1, sousse: 2, kairouan: 0, bizerte: 0,
  dakar: 4, thies: 0, saintlouis: 1, kaolack: 0, ziguinchor: 1, accra: 4, kumasi: 2, tamale: 1, takoradi: 1, capecoast: 0, lagos: 5, abuja: 4, kano: 3, ibadan: 1, portharcourt: 3,
  addisababa: 5, diredawa: 2, mekelle: 2, gondar: 1, bahirdar: 1, nairobi: 5, mombasa: 3, kisumu: 2, nakuru: 0, eldoret: 1, daressalaam: 4, dodoma: 1, arusha: 3, mwanza: 2, zanzibar: 3,
  luanda: 4, huambo: 1, lobito: 0, benguela: 1, lubango: 1, kinshasa: 4, lubumbashi: 3, mbujimayi: 1, kisangani: 1, goma: 1,
  tripoli: 3, nouakchott: 2, abidjan: 4, douala: 3, kampala: 4, khartoum: 3, lusaka: 3, harare: 3 });
// 🗽 Северна Америка (namerica.js)
Object.assign(WORLD_SMALL, { washington: 5, boston: 5, philadelphia: 4, atlanta: 5, houston: 5, dallas: 5, denver: 5, seattle: 5, lasvegas: 4, phoenix: 4, sanantonio: 3, neworleans: 3,
  jacksonville: 3, saltlake: 4, kansascity: 3, elpaso: 2, winnipeg: 3, quebec: 2, halifax: 3, edmonton: 3, tijuana: 3, guatemalacity: 3, quetzaltenango: 1, escuintla: 0, coban: 0, flores: 1,
  sanjose: 4, limon: 1, alajuela: 0, puntarenas: 0, liberiacr: 2, panama: 5, colon: 1, david: 1, santiagopa: 0, chitre: 0, havana: 4, santiagocuba: 2, camaguey: 1, holguin: 2, varadero: 3,
  santodomingo: 4, santiagodr: 2, puntacana: 4, puertoplata: 2, laromana: 2, sansalvador: 3, managua: 2 });
Object.assign(AIRPORT_MAX, { moscow: 5, stpetersburg: 5, nnovgorod: 3, kazan: 4, voronezh: 2, novorossiysk: 1 });   // 🇷🇺 Русия
Object.assign(WORLD_SMALL, { bogota: 5, medellin: 4, cali: 3, barranquilla: 2, cartagena: 3, caracas: 4, maracaibo: 3, valenciave: 2, barquisimeto: 1, maracay: 0, quito: 4, guayaquil: 4, cuenca: 2, manta: 1, ambato: 0,
  lima: 5, arequipa: 3, cusco: 3, trujillo: 2, chiclayo: 2, santiagocl: 5, valparaiso: 0, concepcion: 2, antofagasta: 2, laserena: 2, lapaz: 3, asuncion: 3, montevideo: 4 });   // 🌎 Южна Америка
Object.assign(WORLD_SMALL, { bangkok: 5, chiangmai: 3, phuket: 4, pattaya: 1, hatyai: 2, hanoi: 5, hochiminh: 5, danang: 4, haiphong: 2, nhatrang: 3, kualalumpur: 5, penang: 4, johorbahru: 2, malacca: 1, kotakinabalu: 3,
  jakarta: 5, surabaya: 4, bandung: 2, denpasar: 4, medan: 3, manila: 5, cebu: 4, davao: 3, baguio: 0, iloilo: 2, riyadh: 5, jeddah: 5, mecca: 0, medina: 3, dammam: 4,
  chengdu: 5, chongqing: 4, wuhan: 4, xian: 4, yekaterinburg: 4, novosibirsk: 4, irkutsk: 3, khabarovsk: 3, vladivostok: 3, tehran: 4, tashkent: 4, almaty: 4, karachi: 4, dhaka: 4, yangon: 3 });   // 🌏 Азия
Object.assign(WORLD_SMALL, { canberra: 3, goldcoast: 3, darwin: 3, hobart: 2, cairns: 3, townsville: 2, alicesprings: 1, auckland: 5, wellington: 3, christchurch: 3, queenstown: 2, hamilton: 1, suva: 3, portmoresby: 2 });   // 🦘 Океания
Object.assign(AIRPORT_MAX, { kyiv: 5, kharkiv: 3, odesa: 4, dnipro: 3, lviv: 3 });   // 🇺🇦 Украйна
export const airportMax = id => id in AIRPORT_MAX ? AIRPORT_MAX[id] : id in WORLD_SMALL ? WORLD_SMALL[id] : WORLD_IDS.has(id) ? 5 : 0;
