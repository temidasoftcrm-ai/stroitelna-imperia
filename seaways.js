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
  casablanca: 5, rabat: 2, tangier: 5, algiers: 4, oran: 3, annaba: 3, tunis: 4, sfax: 3, sousse: 2, bizerte: 2, dakar: 4, saintlouis: 1, ziguinchor: 1,
  accra: 4, takoradi: 3, capecoast: 1, lagos: 5, portharcourt: 4, mombasa: 5, daressalaam: 5, zanzibar: 2, luanda: 4, lobito: 4, benguela: 2, tripoli: 4, nouakchott: 2, abidjan: 5, douala: 4,
  boston: 4, philadelphia: 3, houston: 5, seattle: 5, neworleans: 4, jacksonville: 3, halifax: 4, quebec: 2, tijuana: 2, limon: 3, puntarenas: 2, panama: 5, colon: 5,
  havana: 4, santiagocuba: 3, varadero: 1, santodomingo: 4, puntacana: 2, puertoplata: 2, laromana: 2,
  stpetersburg: 5, novorossiysk: 5, odesa: 5,
  goldcoast: 2, darwin: 4, hobart: 3, cairns: 3, townsville: 3, auckland: 5, wellington: 4, christchurch: 3, suva: 3, portmoresby: 3,
  bangkok: 4, phuket: 3, pattaya: 2, hochiminh: 5, danang: 4, haiphong: 5, nhatrang: 2, penang: 4, johorbahru: 4, malacca: 2, kotakinabalu: 3, jakarta: 5, surabaya: 5, denpasar: 2, medan: 3,
  manila: 5, cebu: 4, davao: 3, iloilo: 2, jeddah: 5, dammam: 4, karachi: 5, yangon: 3,
  barranquilla: 3, cartagena: 5, caracas: 4, maracaibo: 3, guayaquil: 5, manta: 3, lima: 5, trujillo: 2, valparaiso: 5, concepcion: 3, antofagasta: 4, laserena: 2, montevideo: 5,
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
  med_ion: [19.0, 37.3], sicily: [12.0, 37.4], med_w: [5.0, 39.5], gibraltar: [-5.6, 35.95], cape_sv: [-9.5, 36.6], galicia: [-10.2, 43.4], atl_iberia: [-10.5, 40.0], biscay: [-6.5, 46.5],
  channel_w: [-5.0, 49.2], channel: [1.6, 50.9], north_sea: [3.6, 52.6], atl_n: [-40.0, 41.0], ny_off: [-72.5, 40.2], carib: [-74.0, 15.5],
  panama: [-79.7, 9.2], pac_cam: [-100.0, 14.0], la_off: [-119.0, 33.3], pac_e: [-150.0, 33.0], pac: [180.0, 35.0], japan_s: [140.5, 34.3],
  ecs: [126.0, 29.5], ecs_sh: [122.8, 31.0], hk: [114.5, 21.9], scs: [112.0, 13.0], sing: [104.2, 1.2], malacca: [97.0, 5.5],
  india_s: [80.0, 5.0], mumbai_off: [71.8, 18.8], arabian: [62.0, 16.0], hormuz: [56.6, 26.4], bab: [43.4, 12.5], red_sea: [38.5, 20.0],
  suez_s: [32.6, 29.7], suez_n: [32.4, 31.5], af_w: [-18.0, 14.0], af_sw: [6.0, -12.0], cape: [18.2, -34.6], ind_sw: [50.0, -28.0],
  atl_s_br: [-34.0, -8.0], rio_off: [-42.5, -23.6], plate: [-56.5, -35.6], java: [110.0, -6.5], torres: [142.0, -10.0], coral: [154.0, -26.0],
  irish: [-4.8, 53.3], skagerrak: [9.5, 57.8], baltic: [18.8, 54.9], tyrrhen: [13.0, 40.3], florida: [-79.6, 25.3], gulf_mx: [-86.3, 21.6],
  sf_off: [-123.2, 37.6], van_off: [-125.5, 48.6], natal: [32.0, -30.5], bengal: [81.5, 13.0], korea: [129.5, 34.6], yellow: [124.8, 36.8],
  au_w: [114.0, -32.5], au_s: [132.0, -37.5], bass: [146.0, -39.8],
  finland_g: [26.5, 59.8], bs_e: [37.0, 44.0],
  timor: [128.0, -11.0], gbr: [148.0, -17.0], tasman_n: [175.5, -35.0], cook: [174.6, -41.6], tasman: [160.0, -40.0], canterbury: [173.6, -43.8], fiji: [178.0, -19.0],   // 🦘 Океания
  gulf_th: [101.0, 11.5], andaman: [96.5, 9.0], tonkin: [107.6, 19.5], manila_off: [119.8, 14.3], gulf_p: [51.5, 26.8], karachi_off: [66.5, 24.3],   // 🌏 Азия
  pac_ec: [-82.0, -2.0], pac_pe: [-79.0, -12.5], pac_cl: [-73.0, -32.0], cape_horn: [-67.0, -57.5], carib_s: [-70.0, 12.8],   // 🌎 Южна Америка   // 🇷🇺 Финският залив, източното Черно море
  // 🌍 Африка
  morocco: [-9.0, 34.0], alboran: [-1.0, 36.2], alg_off: [4.5, 37.3], tunis_off: [11.3, 36.0], sidra: [16.0, 33.5], guinea: [-3.0, 3.5], benin: [3.0, 5.5], biafra: [8.3, 3.2],
  angola_off: [11.5, -10.0], horn: [52.0, 11.5], swahili: [41.0, -5.5], mozam: [41.5, -16.5],
  // 🗽 Северна Америка
  boston_off: [-69.5, 42.0], halifax_off: [-63.0, 43.8], stlawrence: [-64.0, 49.5], jax_off: [-80.2, 30.3], gulf_n: [-90.0, 27.5], cuba_s: [-78.0, 19.2], mona: [-68.0, 17.8], pac_cr: [-85.5, 8.5],
};
const E = [
  ['bs_w', 'bosph'], ['bosph', 'marmara'], ['marmara', 'dardan'], ['dardan', 'aegean_n'], ['aegean_n', 'aegean_s'], ['aegean_s', 'med_ion'], ['aegean_s', 'suez_n'],
  ['med_ion', 'sicily'], ['med_ion', 'suez_n'], ['sicily', 'med_w'], ['med_w', 'gibraltar'], ['gibraltar', 'cape_sv'], ['cape_sv', 'atl_iberia'], ['gibraltar', 'af_w'],
  ['atl_iberia', 'galicia'], ['galicia', 'biscay'], ['biscay', 'channel_w'], ['channel_w', 'channel'], ['channel', 'north_sea'], ['channel_w', 'atl_n'], ['atl_iberia', 'atl_n'],
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
  ['timor', 'torres'], ['timor', 'java'], ['gbr', 'coral'], ['gbr', 'torres'], ['tasman_n', 'coral'], ['tasman_n', 'cook'], ['cook', 'tasman'], ['tasman', 'bass'], ['cook', 'canterbury'], ['fiji', 'coral'], ['fiji', 'tasman_n'],
  ['gulf_th', 'scs'], ['gulf_th', 'sing'], ['andaman', 'malacca'], ['andaman', 'bengal'], ['tonkin', 'hk'], ['tonkin', 'scs'], ['manila_off', 'scs'], ['manila_off', 'hk'], ['gulf_p', 'hormuz'], ['karachi_off', 'arabian'], ['karachi_off', 'mumbai_off'],
  ['pac_ec', 'pac_cr'], ['pac_ec', 'pac_pe'], ['pac_pe', 'pac_cl'], ['pac_cl', 'cape_horn'], ['cape_horn', 'plate'], ['carib_s', 'carib'], ['carib_s', 'panama'],
  ['finland_g', 'baltic'], ['bs_e', 'bs_w'], ['bs_e', 'bosph'],
  ['morocco', 'gibraltar'], ['morocco', 'af_w'], ['morocco', 'atl_iberia'], ['alboran', 'gibraltar'], ['alboran', 'med_w'], ['alg_off', 'med_w'], ['alg_off', 'tunis_off'], ['alg_off', 'tyrrhen'],
  ['tunis_off', 'sicily'], ['tunis_off', 'sidra'], ['sidra', 'med_ion'], ['sidra', 'suez_n'], ['guinea', 'af_w'], ['guinea', 'benin'], ['benin', 'biafra'], ['biafra', 'af_sw'], ['guinea', 'atl_s_br'],
  ['boston_off', 'ny_off'], ['boston_off', 'atl_n'], ['halifax_off', 'boston_off'], ['halifax_off', 'atl_n'], ['stlawrence', 'halifax_off'], ['jax_off', 'florida'], ['jax_off', 'ny_off'],
  ['gulf_n', 'gulf_mx'], ['cuba_s', 'carib'], ['cuba_s', 'gulf_mx'], ['mona', 'carib'], ['mona', 'atl_n'], ['pac_cr', 'panama'], ['pac_cr', 'pac_cam'],
  ['angola_off', 'af_sw'], ['angola_off', 'cape'], ['horn', 'bab'], ['horn', 'arabian'], ['horn', 'swahili'], ['swahili', 'mozam'], ['mozam', 'natal'], ['swahili', 'ind_sw'],
];
export const PORT_NODE = {
  varna: 'bs_w', burgas: 'bs_w', constanta: 'bs_w', istanbul: 'bosph', thessaloniki: 'aegean_n', athens: 'aegean_s', barcelona: 'med_w',
  amsterdam: 'north_sea', rotterdam: 'north_sea', newyork: 'ny_off', losangeles: 'la_off', rio: 'rio_off', buenosaires: 'plate', capetown: 'cape',
  dubai: 'hormuz', mumbai: 'mumbai_off', singapore: 'sing', hongkong: 'hk', shanghai: 'ecs_sh', tokyo: 'japan_s', sydney: 'coral',
  izmir: 'aegean_s', patras: 'med_ion', heraklion: 'aegean_s', marseille: 'med_w', nice: 'med_w', liverpool: 'irish', gdansk: 'baltic', naples: 'tyrrhen',
  valencia: 'med_w', antwerp: 'north_sea', sanfrancisco: 'sf_off', miami: 'florida', vancouver: 'van_off', cancun: 'gulf_mx', salvador: 'atl_s_br',
  fortaleza: 'atl_s_br', mardelplata: 'plate', alexandria: 'suez_n', durban: 'natal', portelizabeth: 'natal', abudhabi: 'hormuz', sharjah: 'hormuz',
  casablanca: 'morocco', rabat: 'morocco', tangier: 'gibraltar', oran: 'alboran', algiers: 'alg_off', annaba: 'alg_off', tunis: 'tunis_off', bizerte: 'tunis_off', sousse: 'tunis_off', sfax: 'sidra',
  tripoli: 'sidra', dakar: 'af_w', saintlouis: 'af_w', nouakchott: 'af_w', ziguinchor: 'af_w', abidjan: 'guinea', takoradi: 'guinea', capecoast: 'guinea', accra: 'benin', lagos: 'benin',
  portharcourt: 'biafra', douala: 'biafra', luanda: 'angola_off', lobito: 'angola_off', benguela: 'angola_off', mombasa: 'swahili', daressalaam: 'swahili', zanzibar: 'swahili',
  boston: 'boston_off', philadelphia: 'ny_off', houston: 'gulf_n', neworleans: 'gulf_n', jacksonville: 'jax_off', seattle: 'van_off', halifax: 'halifax_off', quebec: 'stlawrence', tijuana: 'la_off',
  limon: 'carib', puntarenas: 'pac_cr', panama: 'panama', colon: 'carib', havana: 'florida', varadero: 'florida', santiagocuba: 'cuba_s', santodomingo: 'mona', laromana: 'mona', puntacana: 'mona', puertoplata: 'mona',
  stpetersburg: 'finland_g', novorossiysk: 'bs_e', odesa: 'bs_w',
  goldcoast: 'coral', darwin: 'timor', hobart: 'bass', cairns: 'gbr', townsville: 'gbr', auckland: 'tasman_n', wellington: 'cook', christchurch: 'canterbury', suva: 'fiji', portmoresby: 'torres',
  bangkok: 'gulf_th', pattaya: 'gulf_th', phuket: 'andaman', yangon: 'andaman', hochiminh: 'scs', nhatrang: 'scs', danang: 'scs', haiphong: 'tonkin', penang: 'malacca', malacca: 'malacca', medan: 'malacca',
  johorbahru: 'sing', kotakinabalu: 'scs', jakarta: 'java', surabaya: 'java', denpasar: 'java', manila: 'manila_off', cebu: 'manila_off', davao: 'manila_off', iloilo: 'manila_off', jeddah: 'red_sea', dammam: 'gulf_p', karachi: 'karachi_off',
  barranquilla: 'carib_s', cartagena: 'carib_s', caracas: 'carib_s', maracaibo: 'carib_s', guayaquil: 'pac_ec', manta: 'pac_ec', lima: 'pac_pe', trujillo: 'pac_pe', valparaiso: 'pac_cl', concepcion: 'pac_cl', antofagasta: 'pac_cl', laserena: 'pac_cl', montevideo: 'plate',
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
