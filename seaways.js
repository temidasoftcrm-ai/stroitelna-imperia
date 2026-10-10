// seaways.js — фаза „Пристанища“: пристанища в крайморските градове, кораби и морски линии (от ниво 6).
// Само данни и чисти сметки; game.js държи записа:
//   S.ports = { cityId: { lv, build: { target, prog } | null } }   — пристанище в твой крайморски град
//   S.seaRoutes = [{ a, b, km }]                                   — морска линия: a е твое пристанище, b — всяко отключено пристанище
//   S.ships = [{ id, kind, nm, at, path: [a, b] | null, km, total, pay }] — корабите плават сами по случайни линии
export const PORT_LEVELS = [
  { nm: 'Пристан', berths: 1, cost: 3000000, days: 25 },
  { nm: 'Пристанище с 2 кея', berths: 2, cost: 4000000, days: 25 },
  { nm: 'Товарно пристанище', berths: 4, cost: 8000000, days: 30 },
  { nm: 'Голямо пристанище', berths: 6, cost: 14000000, days: 35 },
  { nm: 'Световно пристанище', berths: 10, cost: 25000000, days: 40 },
];
// реални пристанища и до какво ниво могат да стигнат
export const PORT_MAX = {
  varna: 5, burgas: 4, constanta: 5, istanbul: 5, thessaloniki: 4, athens: 5,
  barcelona: 5, amsterdam: 4, rotterdam: 5,
  newyork: 5, losangeles: 5, rio: 4, buenosaires: 4, capetown: 4, dubai: 5, mumbai: 4,
  singapore: 5, hongkong: 5, shanghai: 5, tokyo: 5, sydney: 4,
  // новите крайморски градове (countries.js)
  izmir: 4, patras: 3, heraklion: 2, marseille: 5, nice: 2, liverpool: 4, gdansk: 4, naples: 4, valencia: 5, antwerp: 5,
  sanfrancisco: 4, miami: 4, vancouver: 4, cancun: 2, salvador: 3, fortaleza: 3, mardelplata: 2, alexandria: 4, durban: 4, portelizabeth: 3,
  abudhabi: 4, sharjah: 3, chennai: 4, busan: 5, incheon: 4, osaka: 5, yokohama: 5, melbourne: 4, brisbane: 4, perth: 3, adelaide: 3,
};
export const portMax = id => PORT_MAX[id] || 0;
// приход и разход на км; speed — км на игрален ден (корабите са бавни, но носят много)
export const SHIPS = {
  boat: { nm: 'Товарна лодка', ico: '🚤', cargo: 'малки пратки', gross: 9, fuel: 2, speed: 500, range: 1500, cost: 800000, upkeep: 400 },
  coaster: { nm: 'Малък кораб', ico: '🛥️', cargo: 'стоки по крайбрежието', gross: 24, fuel: 6, speed: 600, range: 5000, cost: 3000000, upkeep: 1500 },
  bulk: { nm: 'Насипен кораб', ico: '⛴️', cargo: 'пясък, чакъл, стомана', gross: 55, fuel: 15, speed: 650, cost: 12000000, upkeep: 5000 },
  container: { nm: 'Контейнеровоз', ico: '🚢', cargo: 'контейнери', gross: 95, fuel: 25, speed: 700, cost: 20000000, upkeep: 8000 },
  tanker: { nm: 'Танкер', ico: '🛢️', cargo: 'нефт и гориво', gross: 130, fuel: 30, speed: 620, cost: 30000000, upkeep: 11000 },
  cruise: { nm: 'Круизен кораб', ico: '🛳️', cargo: 'туристи', gross: 160, fuel: 40, speed: 600, cost: 45000000, upkeep: 14000 },
};
export const shipRange = kind => SHIPS[kind].range || Infinity;   // малките съдове плават само на къси линии
// морският път е по-дълъг от правата (заобикаля сушата)
export const seaKm = (A, B) => seaPath(A, B).km;   // по морските пътища (виж seaPath по-долу)
export const SEA_ROUTE_COST = km => Math.round((500000 + km * 80) / 10000) * 10000;
export const voyagePay = (kind, km) => { const S = SHIPS[kind]; return { gross: Math.round(S.gross * km / 10) * 10, fuel: Math.round(S.fuel * km / 10) * 10 }; };
// нетно на ден при непрекъснато плаване (за магазина)
export const shipDaily = kind => { const S = SHIPS[kind]; return Math.round((S.gross - S.fuel) * S.speed - S.upkeep); };
export const SEA_LV = 6;   // ниво на развитие за пристанищата
// ---- морски пътища: граф от точки в морето (проливи, канали, носове). Корабите плават по най-краткия път по графа,
// а не по права линия през сушата. lon извън ±180 не се ползва — Тихият океан се пресича между pac (180) и pac_e (−150).
export const SEA_NODES = {
  bs_w: [29.6, 43.0], bosph: [29.05, 41.15], marmara: [28.0, 40.75], dardan: [26.3, 40.05], aegean_n: [24.8, 39.6], aegean_s: [24.8, 37.2],
  med_ion: [19.0, 37.3], sicily: [12.0, 37.4], med_w: [5.0, 39.5], gibraltar: [-5.6, 35.95], atl_iberia: [-10.5, 40.0], biscay: [-6.5, 46.5],
  channel_w: [-5.0, 49.2], channel: [1.6, 50.9], north_sea: [3.6, 52.6], atl_n: [-40.0, 41.0], ny_off: [-72.5, 40.2], carib: [-74.0, 15.5],
  panama: [-79.7, 9.2], pac_cam: [-100.0, 14.0], la_off: [-119.0, 33.3], pac_e: [-150.0, 33.0], pac: [180.0, 35.0], japan_s: [140.5, 34.3],
  ecs: [126.0, 29.5], ecs_sh: [122.8, 31.0], hk: [114.5, 21.9], scs: [112.0, 13.0], sing: [104.2, 1.2], malacca: [97.0, 5.5],
  india_s: [80.0, 5.0], mumbai_off: [71.8, 18.8], arabian: [62.0, 16.0], hormuz: [56.6, 26.4], bab: [43.4, 12.5], red_sea: [38.5, 20.0],
  suez_s: [32.6, 29.7], suez_n: [32.4, 31.5], af_w: [-18.0, 14.0], af_sw: [6.0, -12.0], cape: [18.2, -34.6], ind_sw: [50.0, -28.0],
  atl_s_br: [-34.0, -8.0], rio_off: [-42.5, -23.6], plate: [-56.5, -35.6], java: [110.0, -6.5], torres: [142.0, -10.0], coral: [154.0, -26.0],
  irish: [-4.8, 53.3], skagerrak: [9.5, 57.8], baltic: [18.8, 54.9], tyrrhen: [13.0, 40.3], florida: [-79.6, 25.3], gulf_mx: [-86.3, 21.6],
  sf_off: [-123.2, 37.6], van_off: [-125.5, 48.6], natal: [32.0, -30.5], bengal: [81.5, 13.0], korea: [129.5, 34.6], yellow: [124.8, 36.8],
  au_w: [114.0, -32.5], au_s: [132.0, -37.5], bass: [146.0, -39.8],
};
const E = [
  ['bs_w', 'bosph'], ['bosph', 'marmara'], ['marmara', 'dardan'], ['dardan', 'aegean_n'], ['aegean_n', 'aegean_s'], ['aegean_s', 'med_ion'], ['aegean_s', 'suez_n'],
  ['med_ion', 'sicily'], ['med_ion', 'suez_n'], ['sicily', 'med_w'], ['med_w', 'gibraltar'], ['gibraltar', 'atl_iberia'], ['gibraltar', 'af_w'],
  ['atl_iberia', 'biscay'], ['biscay', 'channel_w'], ['channel_w', 'channel'], ['channel', 'north_sea'], ['channel_w', 'atl_n'], ['atl_iberia', 'atl_n'],
  ['atl_n', 'ny_off'], ['ny_off', 'carib'], ['atl_n', 'carib'], ['carib', 'panama'], ['panama', 'pac_cam'], ['pac_cam', 'la_off'], ['la_off', 'pac_e'],
  ['pac_e', 'pac'], ['pac', 'japan_s'], ['japan_s', 'ecs'], ['ecs', 'ecs_sh'], ['ecs', 'hk'], ['hk', 'scs'], ['scs', 'sing'], ['sing', 'malacca'],
  ['malacca', 'india_s'], ['india_s', 'mumbai_off'], ['india_s', 'arabian'], ['mumbai_off', 'arabian'], ['arabian', 'hormuz'], ['arabian', 'bab'],
  ['bab', 'red_sea'], ['red_sea', 'suez_s'], ['suez_s', 'suez_n'], ['af_w', 'af_sw'], ['af_sw', 'cape'], ['af_w', 'atl_s_br'], ['atl_s_br', 'rio_off'],
  ['rio_off', 'plate'], ['plate', 'cape'], ['cape', 'ind_sw'], ['ind_sw', 'india_s'], ['ind_sw', 'arabian'], ['sing', 'java'], ['java', 'torres'], ['torres', 'coral'],
  ['af_w', 'atl_n'], ['atl_s_br', 'carib'],
  ['irish', 'channel_w'], ['north_sea', 'skagerrak'], ['skagerrak', 'baltic'], ['tyrrhen', 'sicily'], ['tyrrhen', 'med_w'], ['florida', 'carib'], ['florida', 'ny_off'],
  ['gulf_mx', 'carib'], ['sf_off', 'la_off'], ['sf_off', 'pac_e'], ['van_off', 'sf_off'], ['van_off', 'pac_e'], ['natal', 'cape'], ['natal', 'ind_sw'],
  ['bengal', 'india_s'], ['bengal', 'malacca'], ['korea', 'ecs'], ['korea', 'japan_s'], ['yellow', 'ecs'], ['yellow', 'korea'],
  ['au_w', 'java'], ['au_w', 'au_s'], ['au_s', 'bass'], ['bass', 'coral'],
];
export const PORT_NODE = {
  varna: 'bs_w', burgas: 'bs_w', constanta: 'bs_w', istanbul: 'bosph', thessaloniki: 'aegean_n', athens: 'aegean_s', barcelona: 'med_w',
  amsterdam: 'north_sea', rotterdam: 'north_sea', newyork: 'ny_off', losangeles: 'la_off', rio: 'rio_off', buenosaires: 'plate', capetown: 'cape',
  dubai: 'hormuz', mumbai: 'mumbai_off', singapore: 'sing', hongkong: 'hk', shanghai: 'ecs_sh', tokyo: 'japan_s', sydney: 'coral',
  izmir: 'aegean_s', patras: 'med_ion', heraklion: 'aegean_s', marseille: 'med_w', nice: 'med_w', liverpool: 'irish', gdansk: 'baltic', naples: 'tyrrhen',
  valencia: 'med_w', antwerp: 'north_sea', sanfrancisco: 'sf_off', miami: 'florida', vancouver: 'van_off', cancun: 'gulf_mx', salvador: 'atl_s_br',
  fortaleza: 'atl_s_br', mardelplata: 'plate', alexandria: 'suez_n', durban: 'natal', portelizabeth: 'natal', abudhabi: 'hormuz', sharjah: 'hormuz',
  chennai: 'bengal', busan: 'korea', incheon: 'yellow', osaka: 'japan_s', yokohama: 'japan_s', melbourne: 'bass', brisbane: 'coral', perth: 'au_w', adelaide: 'au_s',
};
const hav = ([lo1, la1], [lo2, la2]) => { const r = Math.PI / 180, h = Math.sin((la2 - la1) * r / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2; return 6371 * 2 * Math.asin(Math.sqrt(h)); };
const ADJ = {};
for (const [a, b] of E) { const d = hav(SEA_NODES[a], SEA_NODES[b]); (ADJ[a] = ADJ[a] || []).push([b, d]); (ADJ[b] = ADJ[b] || []).push([a, d]); }
const cache = {};
// морският път между два пристанищни града: { pts: [[lon, lat]…], km } (Дейкстра по графа)
export function seaPath(A, B) {
  const key = A.id + '>' + B.id; if (cache[key]) return cache[key];
  const s = PORT_NODE[A.id], t = PORT_NODE[B.id];
  let nodes = [];
  if (s && t && s !== t) {
    const dist = { [s]: 0 }, prev = {}, todo = new Set(Object.keys(SEA_NODES));
    while (todo.size) {
      let u = null; for (const n of todo) if (dist[n] != null && (u == null || dist[n] < dist[u])) u = n;
      if (u == null || u === t) break; todo.delete(u);
      for (const [v, d] of ADJ[u] || []) if (dist[u] + d < (dist[v] ?? Infinity)) { dist[v] = dist[u] + d; prev[v] = u; }
    }
    for (let n = t; n; n = prev[n]) { nodes.unshift(n); if (n === s) break; }
    if (nodes[0] !== s) nodes = [];
  } else if (s) nodes = [s];
  const pts = [[A.lon, A.lat], ...nodes.map(n => SEA_NODES[n]), [B.lon, B.lat]];
  let km = 0; for (let i = 1; i < pts.length; i++) km += hav(pts[i - 1], pts[i]);
  return (cache[key] = { pts, km: Math.round(km * 1.05) });
}
