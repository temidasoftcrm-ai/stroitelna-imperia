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
  // междинни точки, за да не минават линиите през суша и острови (генерирани по assets/data/*.json)
  bosph_marmara1: [28.78, 40.83], aegean_n_aegean_s1: [25.58, 37.48], aegean_n_aegean_s2: [25.38, 37.28], aegean_s_med_ion1: [24.48, 36.98],
  aegean_s_med_ion2: [23.03, 36.03], aegean_s_suez_n1: [25.12, 36.88], aegean_s_suez_n2: [25.38, 36.88], aegean_s_suez_n3: [30.08, 32.58],
  med_ion_sicily1: [14.98, 36.53], med_ion_suez_n1: [28.28, 32.93], med_w_gibraltar1: [-3.07, 36.18], gibraltar_af_w1: [-5.92, 35.88],
  gibraltar_af_w2: [-8.67, 33.33], gibraltar_af_w3: [-9.62, 32.38], gibraltar_af_w4: [-14.62, 26.18], gibraltar_af_w5: [-16.17, 23.62],
  gibraltar_af_w6: [-17.12, 21.83], ny_off_carib1: [-74.17, 18.98], ny_off_carib2: [-74.52, 18.62], ny_off_carib3: [-74.57, 18.28],
  atl_n_carib1: [-69.22, 17.68], panama_pac_cam1: [-79.62, 8.58], panama_pac_cam2: [-79.88, 7.58], panama_pac_cam3: [-80.07, 7.38],
  panama_pac_cam4: [-80.42, 7.12], panama_pac_cam5: [-81.27, 7.08], pac_cam_la_off1: [-110.08, 22.73], pac_cam_la_off2: [-112.22, 24.68],
  pac_cam_la_off3: [-117.53, 30.12], japan_s_ecs1: [127.93, 29.98], ecs_hk1: [116.07, 22.62], sing_malacca1: [103.68, 1.12],
  sing_malacca2: [103.48, 1.12], sing_malacca3: [97.48, 5.38], malacca_india_s1: [94.98, 5.62], india_s_mumbai_off1: [75.62, 9.78],
  arabian_hormuz1: [59.93, 22.53], arabian_bab1: [44.62, 12.53], arabian_bab2: [43.88, 12.48], red_sea_suez_s1: [33.08, 28.48],
  red_sea_suez_s2: [32.78, 29.08], af_w_af_sw1: [-16.62, 12.03], af_w_af_sw2: [-16.27, 11.58], af_w_af_sw3: [-13.02, 7.73],
  atl_s_br_rio_off1: [-39.67, -19.67], atl_s_br_rio_off2: [-40.82, -21.92], rio_off_plate1: [-53.88, -34.57], rio_off_plate2: [-54.92, -35.07],
  cape_ind_sw1: [19.62, -34.92], cape_ind_sw2: [36.78, -34.02], java_torres1: [110.88, -6.32], java_torres2: [141.83, -9.88],
  torres_coral1: [151.38, -20.12], atl_s_br_carib1: [-35.07, -5.52], atl_s_br_carib2: [-41.22, 0.62], atl_s_br_carib3: [-61.02, 11.03],
  irish_channel_w1: [-5.38, 51.97], irish_channel_w2: [-5.88, 50.18], north_sea_skagerrak1: [8.83, 57.53], skagerrak_baltic1: [10.88, 57.78],
  skagerrak_baltic2: [12.73, 55.93], skagerrak_baltic3: [12.88, 55.43], skagerrak_baltic4: [12.98, 55.33], skagerrak_baltic5: [15.38, 54.93],
  tyrrhen_med_w1: [8.83, 38.78], florida_carib1: [-74.77, 20.73], florida_carib2: [-74.72, 20.73], florida_carib3: [-74.27, 20.48],
  florida_carib4: [-74.07, 20.28], florida_carib5: [-74.57, 18.38], florida_ny_off1: [-79.07, 26.88], sf_off_la_off1: [-120.72, 34.62],
  sf_off_la_off2: [-119.78, 33.68], van_off_sf_off1: [-124.53, 40.33], natal_cape1: [25.33, -34.77], natal_cape2: [19.08, -34.92],
  bengal_india_s1: [79.98, 9.73], bengal_india_s2: [79.57, 8.23], bengal_india_s3: [79.88, 5.33], korea_japan_s1: [129.28, 33.28],
  korea_japan_s2: [130.08, 31.43], korea_japan_s3: [130.33, 31.18], korea_japan_s4: [130.58, 30.98], korea_japan_s5: [130.73, 30.93],
  yellow_korea1: [126.32, 34.48], yellow_korea2: [126.53, 34.28], yellow_korea3: [129.33, 34.48], au_w_java1: [113.23, -26.07],
  au_w_java2: [113.82, -10.38], au_w_java3: [115.82, -8.38], au_w_java4: [115.68, -8.22], au_w_java5: [114.68, -7.72], au_w_java6: [112.48, -6.77],
  au_w_java7: [110.73, -6.32], au_w_au_s1: [114.93, -34.17], au_w_au_s2: [115.12, -34.38], au_w_au_s3: [120.28, -37.07], bass_coral1: [149.83, -37.67],
  bass_coral2: [149.98, -37.57], bass_coral3: [151.08, -36.42], bass_coral4: [153.08, -31.47], bass_coral5: [153.23, -30.88],
  bass_coral6: [153.68, -28.77], timor_java1: [123.48, -10.47], timor_java2: [119.88, -9.22], timor_java3: [116.62, -9.17],
  timor_java4: [115.68, -8.22], timor_java5: [114.68, -7.72], timor_java6: [112.48, -6.77], timor_java7: [110.73, -6.32],
  tasman_n_cook1: [178.53, -37.62], tasman_n_cook2: [178.62, -37.72], tasman_n_cook3: [178.58, -38.02], tasman_n_cook4: [178.38, -38.62],
  tasman_n_cook5: [178.12, -39.12], tasman_n_cook6: [176.18, -41.22], tasman_n_cook7: [175.93, -41.47], tasman_n_cook8: [175.33, -41.77],
  tasman_n_cook9: [174.68, -41.67], cook_tasman1: [174.18, -41.02], cook_tasman2: [173.98, -40.82], cook_tasman3: [172.73, -40.38],
  fiji_coral1: [164.18, -23.33], gulf_th_scs1: [105.18, 8.48], gulf_th_sing1: [104.38, 2.53], gulf_th_sing2: [104.38, 1.58],
  gulf_th_sing3: [104.32, 1.53], tonkin_hk1: [108.68, 18.38], tonkin_hk2: [109.48, 18.08], tonkin_hk3: [110.23, 18.48], tonkin_hk4: [110.32, 18.53],
  gulf_p_hormuz1: [54.73, 26.38], pac_ec_pac_pe1: [-81.38, -6.17], pac_cl_cape_horn1: [-75.72, -46.72], pac_cl_cape_horn2: [-75.72, -49.12],
  pac_cl_cape_horn3: [-75.62, -50.38], pac_cl_cape_horn4: [-75.38, -51.67], pac_cl_cape_horn5: [-75.12, -52.17], pac_cl_cape_horn6: [-74.72, -52.88],
  pac_cl_cape_horn7: [-72.72, -54.88], cape_horn_plate1: [-62.57, -51.57], cape_horn_plate2: [-56.67, -36.92], cape_horn_plate3: [-56.62, -36.57],
  carib_s_panama1: [-72.72, 12.43], carib_s_panama2: [-79.32, 9.73], carib_s_panama3: [-79.38, 9.68], finland_g_baltic1: [24.88, 59.72],
  finland_g_baltic2: [22.62, 59.22], finland_g_baltic3: [22.12, 59.08], finland_g_baltic4: [19.43, 56.28], morocco_af_w1: [-14.62, 26.18],
  morocco_af_w2: [-16.17, 23.62], morocco_af_w3: [-17.12, 21.83], alg_off_tunis_off1: [9.62, 37.48], alg_off_tunis_off2: [11.03, 37.23],
  alg_off_tunis_off3: [11.18, 37.08], alg_off_tunis_off4: [11.23, 36.83], sidra_suez_n1: [31.38, 32.03], guinea_af_w1: [-7.97, 4.23],
  guinea_af_w2: [-8.97, 4.68], guinea_af_w3: [-12.42, 7.12], guinea_af_w4: [-16.88, 11.58], boston_off_ny_off1: [-70.17, 41.33],
  stlawrence_halifax_off1: [-60.52, 47.12], stlawrence_halifax_off2: [-60.38, 46.97], stlawrence_halifax_off3: [-59.67, 45.93],
  stlawrence_halifax_off4: [-60.82, 44.83], jax_off_ny_off1: [-73.47, 37.93], cuba_s_carib1: [-76.42, 18.33], cuba_s_carib2: [-74.22, 16.12],
  pac_cr_panama1: [-80.88, 7.08], pac_cr_panama2: [-80.42, 7.12], pac_cr_panama3: [-80.07, 7.38], pac_cr_panama4: [-79.88, 7.58],
  pac_cr_panama5: [-79.62, 8.62], angola_off_cape1: [11.53, -19.97], horn_bab1: [51.08, 12.12], horn_swahili1: [49.53, 6.68],
  horn_swahili2: [48.73, 5.33], swahili_ind_sw1: [49.18, -11.92], swahili_ind_sw2: [49.53, -12.27], swahili_ind_sw3: [49.88, -12.77],
  swahili_ind_sw4: [50.08, -13.22], swahili_ind_sw5: [50.23, -13.67], swahili_ind_sw6: [50.62, -15.27], marmara_dardan1: [26.75, 40.42],
  marmara_dardan2: [26.4, 40.14],
  // излази от пристанищата към открито море (пристанище → *_off → възел)
  thessaloniki_off1: [23.03, 40.12], thessaloniki_off2: [23.33, 39.83], athens_off1: [24.38, 37.83], athens_off2: [24.73, 37.48],
  barcelona_off1: [4.38, 40.08], amsterdam_off1: [4.43, 52.53], amsterdam_off2: [4.38, 52.58], buenosaires_off1: [-57.88, -34.72],
  buenosaires_off2: [-56.57, -35.52], dubai_off1: [55.53, 25.62], dubai_off2: [56.12, 26.28], dubai_off3: [56.38, 26.53],
  shanghai_off1: [121.82, 30.88], shanghai_off2: [121.88, 30.83], sydney_off1: [151.58, -33.52], sydney_off2: [151.62, -33.47],
  sydney_off3: [152.62, -32.47], sydney_off4: [153.03, -31.62], sydney_off5: [154.03, -27.77], liverpool_off1: [-3.52, 53.58],
  liverpool_off2: [-4.57, 53.62], liverpool_off3: [-4.82, 53.38], naples_off1: [13.08, 40.33], valencia_off1: [3.28, 39.18],
  vancouver_off1: [-123.47, 48.53], vancouver_off2: [-123.53, 48.47], vancouver_off3: [-124.07, 48.33], salvador_off1: [-38.03, -12.72],
  salvador_off2: [-33.97, -8.52], fortaleza_off1: [-35.57, -5.02], fortaleza_off2: [-35.07, -5.52], mardelplata_off1: [-57.07, -37.47],
  mardelplata_off2: [-56.67, -36.92], mardelplata_off3: [-56.62, -36.57], alexandria_off1: [30.28, 31.58], alexandria_off2: [30.33, 31.62],
  alexandria_off3: [30.98, 31.68], portelizabeth_off1: [27.83, -33.32], abudhabi_off1: [54.62, 24.88], abudhabi_off2: [56.38, 26.53],
  sharjah_off1: [55.68, 25.78], sharjah_off2: [56.08, 26.23], sharjah_off3: [56.38, 26.53], annaba_off1: [7.33, 37.23], tunis_off1: [10.78, 37.12],
  tunis_off2: [11.03, 37.23], tunis_off3: [11.18, 37.08], tunis_off4: [11.23, 36.83], bizerte_off1: [11.03, 37.23], bizerte_off2: [11.18, 37.08],
  bizerte_off3: [11.23, 36.83], saintlouis_off1: [-17.72, 14.73], nouakchott_off1: [-16.27, 17.73], nouakchott_off2: [-16.32, 17.68],
  nouakchott_off3: [-17.72, 14.73], ziguinchor_off1: [-16.72, 12.38], ziguinchor_off2: [-16.77, 12.33], ziguinchor_off3: [-17.22, 12.88],
  capecoast_off1: [-1.62, 4.68], portharcourt_off1: [7.28, 4.38], portharcourt_off2: [7.33, 4.33], douala_off1: [9.23, 3.62],
  luanda_off1: [12.83, -9.02], luanda_off2: [12.78, -9.07], seattle_off1: [-123.12, 48.08], seattle_off2: [-124.42, 48.38],
  quebec_off1: [-68.97, 48.08], quebec_off2: [-68.67, 48.33], quebec_off3: [-65.77, 49.47], puertoplata_off1: [-69.97, 19.78],
  puertoplata_off2: [-68.92, 19.28], puertoplata_off3: [-68.38, 18.78], puertoplata_off4: [-68.22, 18.62], hobart_off1: [147.88, -43.32],
  hobart_off2: [148.03, -43.17], hobart_off3: [148.48, -42.02], hobart_off4: [148.48, -41.47], hobart_off5: [148.43, -40.92],
  hobart_off6: [148.23, -40.72], yangon_off1: [96.32, 16.38], yangon_off2: [96.38, 16.33], danang_off1: [109.88, 14.93], malacca_off1: [99.98, 3.12],
  malacca_off2: [97.48, 5.38], medan_off1: [98.68, 4.12], medan_off2: [97.82, 5.03], medan_off3: [97.48, 5.38], johorbahru_off1: [104.12, 1.23],
  jakarta_off1: [107.23, -5.82], surabaya_off1: [112.53, -6.82], surabaya_off2: [112.48, -6.77], surabaya_off3: [110.73, -6.32],
  denpasar_off1: [115.73, -8.47], denpasar_off2: [115.82, -8.38], denpasar_off3: [115.68, -8.22], denpasar_off4: [114.68, -7.72],
  denpasar_off5: [112.48, -6.77], denpasar_off6: [110.73, -6.32], manila_off1: [120.53, 14.43], manila_off2: [120.48, 14.38],
  cebu_off1: [123.62, 10.78], cebu_off2: [123.62, 10.93], cebu_off3: [123.23, 11.58], cebu_off4: [122.73, 12.08], cebu_off5: [121.23, 12.12],
  cebu_off6: [120.48, 12.88], davao_off1: [126.03, 6.38], davao_off2: [126.12, 6.28], davao_off3: [126.18, 6.23], davao_off4: [126.23, 6.23],
  davao_off5: [126.38, 6.38], davao_off6: [126.68, 7.23], davao_off7: [126.53, 8.43], davao_off8: [126.38, 9.23], davao_off9: [125.57, 10.03],
  davao_off10: [124.82, 10.03], davao_off11: [124.18, 10.68], davao_off12: [124.18, 11.12], davao_off13: [123.12, 12.12], davao_off14: [121.23, 12.12],
  davao_off15: [120.48, 12.88], iloilo_off1: [122.18, 10.38], iloilo_off2: [122.03, 10.33], iloilo_off3: [121.73, 10.62], iloilo_off4: [120.07, 13.73],
  barranquilla_off1: [-74.17, 11.43], barranquilla_off2: [-71.72, 12.58], cartagena_off1: [-75.32, 10.88], cartagena_off2: [-75.22, 10.98],
  cartagena_off3: [-74.97, 11.18], cartagena_off4: [-71.72, 12.58], maracaibo_off1: [-71.38, 11.12], guayaquil_off1: [-80.17, -2.62],
  guayaquil_off2: [-80.38, -2.82], osaka_off1: [135.08, 34.38], osaka_off2: [135.08, 33.88], osaka_off3: [135.18, 33.78], osaka_off4: [135.78, 33.43],
  yokohama_off1: [140.48, 34.38], melbourne_off1: [144.78, -38.32], melbourne_off2: [144.78, -38.42],
  hochiminh_off1: [107.1, 10.25], hochiminh_off2: [108.6, 9.9], philadelphia_off1: [-75.05, 38.75], izmir_off1: [26.45, 38.7], izmir_off2: [25.7, 38.75], izmir_off3: [25.58, 37.48], izmir_off4: [25.38, 37.28], antwerp_off1: [3.75, 51.42], antwerp_off2: [3.2, 51.55], neworleans_off1: [-89.1, 28.85], houston_off1: [-94.75, 29.3], houston_off2: [-94.4, 28.95], tokyo_off1: [139.85, 34.92], patras_off1: [21.05, 38.27], patras_off2: [21.05, 37.95], patras_off3: [21.0, 37.6], stpetersburg_off1: [28.9, 60.0],
};
const E = [
  ['bs_w', 'bosph'], ['bosph', 'bosph_marmara1'], ['bosph_marmara1', 'marmara'], ['marmara', 'marmara_dardan1'], ['marmara_dardan1', 'marmara_dardan2'], ['marmara_dardan2', 'dardan'], ['dardan', 'aegean_n'], ['aegean_n', 'aegean_n_aegean_s1'], ['aegean_n_aegean_s1', 'aegean_n_aegean_s2'], ['aegean_n_aegean_s2', 'aegean_s'], ['aegean_s', 'aegean_s_med_ion1'], ['aegean_s_med_ion1', 'aegean_s_med_ion2'], ['aegean_s_med_ion2', 'med_ion'], ['aegean_s', 'aegean_s_suez_n1'], ['aegean_s_suez_n1', 'aegean_s_suez_n2'], ['aegean_s_suez_n2', 'aegean_s_suez_n3'], ['aegean_s_suez_n3', 'suez_n'],
  ['med_ion', 'med_ion_sicily1'], ['med_ion_sicily1', 'sicily'], ['med_ion', 'med_ion_suez_n1'], ['med_ion_suez_n1', 'suez_n'], ['sicily', 'med_w'], ['med_w', 'med_w_gibraltar1'], ['med_w_gibraltar1', 'gibraltar'], ['gibraltar', 'cape_sv'], ['cape_sv', 'atl_iberia'], ['gibraltar', 'gibraltar_af_w1'], ['gibraltar_af_w1', 'gibraltar_af_w2'], ['gibraltar_af_w2', 'gibraltar_af_w3'], ['gibraltar_af_w3', 'gibraltar_af_w4'], ['gibraltar_af_w4', 'gibraltar_af_w5'], ['gibraltar_af_w5', 'gibraltar_af_w6'], ['gibraltar_af_w6', 'af_w'],
  ['atl_iberia', 'galicia'], ['galicia', 'biscay'], ['biscay', 'channel_w'], ['channel_w', 'channel'], ['channel', 'north_sea'], ['channel_w', 'atl_n'], ['atl_iberia', 'atl_n'],
  ['atl_n', 'ny_off'], ['ny_off', 'ny_off_carib1'], ['ny_off_carib1', 'ny_off_carib2'], ['ny_off_carib2', 'ny_off_carib3'], ['ny_off_carib3', 'carib'], ['atl_n', 'atl_n_carib1'], ['atl_n_carib1', 'carib'], ['carib', 'panama'], ['panama', 'panama_pac_cam1'], ['panama_pac_cam1', 'panama_pac_cam2'], ['panama_pac_cam2', 'panama_pac_cam3'], ['panama_pac_cam3', 'panama_pac_cam4'], ['panama_pac_cam4', 'panama_pac_cam5'], ['panama_pac_cam5', 'pac_cam'], ['pac_cam', 'pac_cam_la_off1'], ['pac_cam_la_off1', 'pac_cam_la_off2'], ['pac_cam_la_off2', 'pac_cam_la_off3'], ['pac_cam_la_off3', 'la_off'], ['la_off', 'pac_e'],
  ['pac_e', 'pac'], ['pac', 'japan_s'], ['japan_s', 'japan_s_ecs1'], ['japan_s_ecs1', 'ecs'], ['ecs', 'ecs_sh'], ['ecs', 'ecs_hk1'], ['ecs_hk1', 'hk'], ['hk', 'scs'], ['scs', 'sing'], ['sing', 'sing_malacca1'], ['sing_malacca1', 'sing_malacca2'], ['sing_malacca2', 'sing_malacca3'], ['sing_malacca3', 'malacca'],
  ['malacca', 'malacca_india_s1'], ['malacca_india_s1', 'india_s'], ['india_s', 'india_s_mumbai_off1'], ['india_s_mumbai_off1', 'mumbai_off'], ['india_s', 'arabian'], ['mumbai_off', 'arabian'], ['arabian', 'arabian_hormuz1'], ['arabian_hormuz1', 'hormuz'], ['arabian', 'arabian_bab1'], ['arabian_bab1', 'arabian_bab2'], ['arabian_bab2', 'bab'],
  ['bab', 'red_sea'], ['red_sea', 'red_sea_suez_s1'], ['red_sea_suez_s1', 'red_sea_suez_s2'], ['red_sea_suez_s2', 'suez_s'], ['suez_s', 'suez_n'], ['af_w', 'af_w_af_sw1'], ['af_w_af_sw1', 'af_w_af_sw2'], ['af_w_af_sw2', 'af_w_af_sw3'], ['af_w_af_sw3', 'af_sw'], ['af_sw', 'cape'], ['af_w', 'atl_s_br'], ['atl_s_br', 'atl_s_br_rio_off1'], ['atl_s_br_rio_off1', 'atl_s_br_rio_off2'], ['atl_s_br_rio_off2', 'rio_off'],
  ['rio_off', 'rio_off_plate1'], ['rio_off_plate1', 'rio_off_plate2'], ['rio_off_plate2', 'plate'], ['plate', 'cape'], ['cape', 'cape_ind_sw1'], ['cape_ind_sw1', 'cape_ind_sw2'], ['cape_ind_sw2', 'ind_sw'], ['ind_sw', 'india_s'], ['ind_sw', 'arabian'], ['sing', 'java'], ['java', 'java_torres1'], ['java_torres1', 'java_torres2'], ['java_torres2', 'torres'], ['torres', 'torres_coral1'], ['torres_coral1', 'coral'],
  ['af_w', 'atl_n'], ['atl_s_br', 'atl_s_br_carib1'], ['atl_s_br_carib1', 'atl_s_br_carib2'], ['atl_s_br_carib2', 'atl_s_br_carib3'], ['atl_s_br_carib3', 'carib'],
  ['irish', 'irish_channel_w1'], ['irish_channel_w1', 'irish_channel_w2'], ['irish_channel_w2', 'channel_w'], ['north_sea', 'north_sea_skagerrak1'], ['north_sea_skagerrak1', 'skagerrak'], ['skagerrak', 'skagerrak_baltic1'], ['skagerrak_baltic1', 'skagerrak_baltic2'], ['skagerrak_baltic2', 'skagerrak_baltic3'], ['skagerrak_baltic3', 'skagerrak_baltic4'], ['skagerrak_baltic4', 'skagerrak_baltic5'], ['skagerrak_baltic5', 'baltic'], ['tyrrhen', 'sicily'], ['tyrrhen', 'tyrrhen_med_w1'], ['tyrrhen_med_w1', 'med_w'], ['florida', 'florida_carib1'], ['florida_carib1', 'florida_carib2'], ['florida_carib2', 'florida_carib3'], ['florida_carib3', 'florida_carib4'], ['florida_carib4', 'florida_carib5'], ['florida_carib5', 'carib'], ['florida', 'florida_ny_off1'], ['florida_ny_off1', 'ny_off'],
  ['gulf_mx', 'carib'], ['sf_off', 'sf_off_la_off1'], ['sf_off_la_off1', 'sf_off_la_off2'], ['sf_off_la_off2', 'la_off'], ['sf_off', 'pac_e'], ['van_off', 'van_off_sf_off1'], ['van_off_sf_off1', 'sf_off'], ['van_off', 'pac_e'], ['natal', 'natal_cape1'], ['natal_cape1', 'natal_cape2'], ['natal_cape2', 'cape'], ['natal', 'ind_sw'],
  ['bengal', 'bengal_india_s1'], ['bengal_india_s1', 'bengal_india_s2'], ['bengal_india_s2', 'bengal_india_s3'], ['bengal_india_s3', 'india_s'], ['bengal', 'malacca'], ['korea', 'ecs'], ['korea', 'korea_japan_s1'], ['korea_japan_s1', 'korea_japan_s2'], ['korea_japan_s2', 'korea_japan_s3'], ['korea_japan_s3', 'korea_japan_s4'], ['korea_japan_s4', 'korea_japan_s5'], ['korea_japan_s5', 'japan_s'], ['yellow', 'ecs'], ['yellow', 'yellow_korea1'], ['yellow_korea1', 'yellow_korea2'], ['yellow_korea2', 'yellow_korea3'], ['yellow_korea3', 'korea'],
  ['au_w', 'au_w_java1'], ['au_w_java1', 'au_w_java2'], ['au_w_java2', 'au_w_java3'], ['au_w_java3', 'au_w_java4'], ['au_w_java4', 'au_w_java5'], ['au_w_java5', 'au_w_java6'], ['au_w_java6', 'au_w_java7'], ['au_w_java7', 'java'], ['au_w', 'au_w_au_s1'], ['au_w_au_s1', 'au_w_au_s2'], ['au_w_au_s2', 'au_w_au_s3'], ['au_w_au_s3', 'au_s'], ['au_s', 'bass'], ['bass', 'bass_coral1'], ['bass_coral1', 'bass_coral2'], ['bass_coral2', 'bass_coral3'], ['bass_coral3', 'bass_coral4'], ['bass_coral4', 'bass_coral5'], ['bass_coral5', 'bass_coral6'], ['bass_coral6', 'coral'],
  ['timor', 'torres'], ['timor', 'timor_java1'], ['timor_java1', 'timor_java2'], ['timor_java2', 'timor_java3'], ['timor_java3', 'timor_java4'], ['timor_java4', 'timor_java5'], ['timor_java5', 'timor_java6'], ['timor_java6', 'timor_java7'], ['timor_java7', 'java'], ['gbr', 'coral'], ['gbr', 'torres'], ['tasman_n', 'coral'], ['tasman_n', 'tasman_n_cook1'], ['tasman_n_cook1', 'tasman_n_cook2'], ['tasman_n_cook2', 'tasman_n_cook3'], ['tasman_n_cook3', 'tasman_n_cook4'], ['tasman_n_cook4', 'tasman_n_cook5'], ['tasman_n_cook5', 'tasman_n_cook6'], ['tasman_n_cook6', 'tasman_n_cook7'], ['tasman_n_cook7', 'tasman_n_cook8'], ['tasman_n_cook8', 'tasman_n_cook9'], ['tasman_n_cook9', 'cook'], ['cook', 'cook_tasman1'], ['cook_tasman1', 'cook_tasman2'], ['cook_tasman2', 'cook_tasman3'], ['cook_tasman3', 'tasman'], ['tasman', 'bass'], ['cook', 'canterbury'], ['fiji', 'fiji_coral1'], ['fiji_coral1', 'coral'], ['fiji', 'tasman_n'],
  ['gulf_th', 'gulf_th_scs1'], ['gulf_th_scs1', 'scs'], ['gulf_th', 'gulf_th_sing1'], ['gulf_th_sing1', 'gulf_th_sing2'], ['gulf_th_sing2', 'gulf_th_sing3'], ['gulf_th_sing3', 'sing'], ['andaman', 'malacca'], ['andaman', 'bengal'], ['tonkin', 'tonkin_hk1'], ['tonkin_hk1', 'tonkin_hk2'], ['tonkin_hk2', 'tonkin_hk3'], ['tonkin_hk3', 'tonkin_hk4'], ['tonkin_hk4', 'hk'], ['tonkin', 'scs'], ['manila_off', 'scs'], ['manila_off', 'hk'], ['gulf_p', 'gulf_p_hormuz1'], ['gulf_p_hormuz1', 'hormuz'], ['karachi_off', 'arabian'], ['karachi_off', 'mumbai_off'],
  ['pac_ec', 'pac_cr'], ['pac_ec', 'pac_ec_pac_pe1'], ['pac_ec_pac_pe1', 'pac_pe'], ['pac_pe', 'pac_cl'], ['pac_cl', 'pac_cl_cape_horn1'], ['pac_cl_cape_horn1', 'pac_cl_cape_horn2'], ['pac_cl_cape_horn2', 'pac_cl_cape_horn3'], ['pac_cl_cape_horn3', 'pac_cl_cape_horn4'], ['pac_cl_cape_horn4', 'pac_cl_cape_horn5'], ['pac_cl_cape_horn5', 'pac_cl_cape_horn6'], ['pac_cl_cape_horn6', 'pac_cl_cape_horn7'], ['pac_cl_cape_horn7', 'cape_horn'], ['cape_horn', 'cape_horn_plate1'], ['cape_horn_plate1', 'cape_horn_plate2'], ['cape_horn_plate2', 'cape_horn_plate3'], ['cape_horn_plate3', 'plate'], ['carib_s', 'carib'], ['carib_s', 'carib_s_panama1'], ['carib_s_panama1', 'carib_s_panama2'], ['carib_s_panama2', 'carib_s_panama3'], ['carib_s_panama3', 'panama'],
  ['finland_g', 'finland_g_baltic1'], ['finland_g_baltic1', 'finland_g_baltic2'], ['finland_g_baltic2', 'finland_g_baltic3'], ['finland_g_baltic3', 'finland_g_baltic4'], ['finland_g_baltic4', 'baltic'], ['bs_e', 'bs_w'], ['bs_e', 'bosph'],
  ['morocco', 'gibraltar'], ['morocco', 'morocco_af_w1'], ['morocco_af_w1', 'morocco_af_w2'], ['morocco_af_w2', 'morocco_af_w3'], ['morocco_af_w3', 'af_w'], ['morocco', 'atl_iberia'], ['alboran', 'gibraltar'], ['alboran', 'med_w'], ['alg_off', 'med_w'], ['alg_off', 'alg_off_tunis_off1'], ['alg_off_tunis_off1', 'alg_off_tunis_off2'], ['alg_off_tunis_off2', 'alg_off_tunis_off3'], ['alg_off_tunis_off3', 'alg_off_tunis_off4'], ['alg_off_tunis_off4', 'tunis_off'], ['alg_off', 'tyrrhen'],
  ['tunis_off', 'sicily'], ['tunis_off', 'sidra'], ['sidra', 'med_ion'], ['sidra', 'sidra_suez_n1'], ['sidra_suez_n1', 'suez_n'], ['guinea', 'guinea_af_w1'], ['guinea_af_w1', 'guinea_af_w2'], ['guinea_af_w2', 'guinea_af_w3'], ['guinea_af_w3', 'guinea_af_w4'], ['guinea_af_w4', 'af_w'], ['guinea', 'benin'], ['benin', 'biafra'], ['biafra', 'af_sw'], ['guinea', 'atl_s_br'],
  ['boston_off', 'boston_off_ny_off1'], ['boston_off_ny_off1', 'ny_off'], ['boston_off', 'atl_n'], ['halifax_off', 'boston_off'], ['halifax_off', 'atl_n'], ['stlawrence', 'stlawrence_halifax_off1'], ['stlawrence_halifax_off1', 'stlawrence_halifax_off2'], ['stlawrence_halifax_off2', 'stlawrence_halifax_off3'], ['stlawrence_halifax_off3', 'stlawrence_halifax_off4'], ['stlawrence_halifax_off4', 'halifax_off'], ['jax_off', 'florida'], ['jax_off', 'jax_off_ny_off1'], ['jax_off_ny_off1', 'ny_off'],
  ['gulf_n', 'gulf_mx'], ['cuba_s', 'cuba_s_carib1'], ['cuba_s_carib1', 'cuba_s_carib2'], ['cuba_s_carib2', 'carib'], ['cuba_s', 'gulf_mx'], ['mona', 'carib'], ['mona', 'atl_n'], ['pac_cr', 'pac_cr_panama1'], ['pac_cr_panama1', 'pac_cr_panama2'], ['pac_cr_panama2', 'pac_cr_panama3'], ['pac_cr_panama3', 'pac_cr_panama4'], ['pac_cr_panama4', 'pac_cr_panama5'], ['pac_cr_panama5', 'panama'], ['pac_cr', 'pac_cam'],
  ['angola_off', 'af_sw'], ['angola_off', 'angola_off_cape1'], ['angola_off_cape1', 'cape'], ['horn', 'horn_bab1'], ['horn_bab1', 'bab'], ['horn', 'arabian'], ['horn', 'horn_swahili1'], ['horn_swahili1', 'horn_swahili2'], ['horn_swahili2', 'swahili'], ['swahili', 'mozam'], ['mozam', 'natal'], ['swahili', 'swahili_ind_sw1'], ['swahili_ind_sw1', 'swahili_ind_sw2'], ['swahili_ind_sw2', 'swahili_ind_sw3'], ['swahili_ind_sw3', 'swahili_ind_sw4'], ['swahili_ind_sw4', 'swahili_ind_sw5'], ['swahili_ind_sw5', 'swahili_ind_sw6'], ['swahili_ind_sw6', 'ind_sw'],
  ['thessaloniki_off1', 'thessaloniki_off2'], ['thessaloniki_off2', 'aegean_n'], ['athens_off1', 'athens_off2'], ['athens_off2', 'aegean_s'],
  ['barcelona_off1', 'med_w'], ['amsterdam_off1', 'amsterdam_off2'], ['amsterdam_off2', 'north_sea'], ['buenosaires_off1', 'buenosaires_off2'],
  ['buenosaires_off2', 'plate'], ['dubai_off1', 'dubai_off2'], ['dubai_off2', 'dubai_off3'], ['dubai_off3', 'hormuz'], ['shanghai_off1', 'shanghai_off2'],
  ['shanghai_off2', 'ecs_sh'], ['sydney_off1', 'sydney_off2'], ['sydney_off2', 'sydney_off3'], ['sydney_off3', 'sydney_off4'], ['sydney_off4', 'sydney_off5'],
  ['sydney_off5', 'coral'], ['liverpool_off1', 'liverpool_off2'], ['liverpool_off2', 'liverpool_off3'], ['liverpool_off3', 'irish'], ['naples_off1', 'tyrrhen'],
  ['valencia_off1', 'med_w'], ['vancouver_off1', 'vancouver_off2'], ['vancouver_off2', 'vancouver_off3'], ['vancouver_off3', 'van_off'],
  ['salvador_off1', 'salvador_off2'], ['salvador_off2', 'atl_s_br'], ['fortaleza_off1', 'fortaleza_off2'], ['fortaleza_off2', 'atl_s_br'],
  ['mardelplata_off1', 'mardelplata_off2'], ['mardelplata_off2', 'mardelplata_off3'], ['mardelplata_off3', 'plate'], ['alexandria_off1', 'alexandria_off2'],
  ['alexandria_off2', 'alexandria_off3'], ['alexandria_off3', 'suez_n'], ['portelizabeth_off1', 'natal'], ['abudhabi_off1', 'abudhabi_off2'],
  ['abudhabi_off2', 'hormuz'], ['sharjah_off1', 'sharjah_off2'], ['sharjah_off2', 'sharjah_off3'], ['sharjah_off3', 'hormuz'], ['annaba_off1', 'alg_off'],
  ['tunis_off1', 'tunis_off2'], ['tunis_off2', 'tunis_off3'], ['tunis_off3', 'tunis_off4'], ['tunis_off4', 'tunis_off'], ['bizerte_off1', 'bizerte_off2'],
  ['bizerte_off2', 'bizerte_off3'], ['bizerte_off3', 'tunis_off'], ['saintlouis_off1', 'af_w'], ['nouakchott_off1', 'nouakchott_off2'],
  ['nouakchott_off2', 'nouakchott_off3'], ['nouakchott_off3', 'af_w'], ['ziguinchor_off1', 'ziguinchor_off2'], ['ziguinchor_off2', 'ziguinchor_off3'],
  ['ziguinchor_off3', 'af_w'], ['capecoast_off1', 'guinea'], ['portharcourt_off1', 'portharcourt_off2'], ['portharcourt_off2', 'biafra'],
  ['douala_off1', 'biafra'], ['luanda_off1', 'luanda_off2'], ['luanda_off2', 'angola_off'], ['seattle_off1', 'seattle_off2'], ['seattle_off2', 'van_off'],
  ['quebec_off1', 'quebec_off2'], ['quebec_off2', 'quebec_off3'], ['quebec_off3', 'stlawrence'], ['puertoplata_off1', 'puertoplata_off2'],
  ['puertoplata_off2', 'puertoplata_off3'], ['puertoplata_off3', 'puertoplata_off4'], ['puertoplata_off4', 'mona'], ['hobart_off1', 'hobart_off2'],
  ['hobart_off2', 'hobart_off3'], ['hobart_off3', 'hobart_off4'], ['hobart_off4', 'hobart_off5'], ['hobart_off5', 'hobart_off6'], ['hobart_off6', 'bass'],
  ['yangon_off1', 'yangon_off2'], ['yangon_off2', 'andaman'], ['danang_off1', 'scs'], ['malacca_off1', 'malacca_off2'], ['malacca_off2', 'malacca'],
  ['medan_off1', 'medan_off2'], ['medan_off2', 'medan_off3'], ['medan_off3', 'malacca'], ['johorbahru_off1', 'sing'], ['jakarta_off1', 'java'],
  ['surabaya_off1', 'surabaya_off2'], ['surabaya_off2', 'surabaya_off3'], ['surabaya_off3', 'java'], ['denpasar_off1', 'denpasar_off2'],
  ['denpasar_off2', 'denpasar_off3'], ['denpasar_off3', 'denpasar_off4'], ['denpasar_off4', 'denpasar_off5'], ['denpasar_off5', 'denpasar_off6'],
  ['denpasar_off6', 'java'], ['manila_off1', 'manila_off2'], ['manila_off2', 'manila_off'], ['cebu_off1', 'cebu_off2'], ['cebu_off2', 'cebu_off3'],
  ['cebu_off3', 'cebu_off4'], ['cebu_off4', 'cebu_off5'], ['cebu_off5', 'cebu_off6'], ['cebu_off6', 'manila_off'], ['davao_off1', 'davao_off2'],
  ['davao_off2', 'davao_off3'], ['davao_off3', 'davao_off4'], ['davao_off4', 'davao_off5'], ['davao_off5', 'davao_off6'], ['davao_off6', 'davao_off7'],
  ['davao_off7', 'davao_off8'], ['davao_off8', 'davao_off9'], ['davao_off9', 'davao_off10'], ['davao_off10', 'davao_off11'], ['davao_off11', 'davao_off12'],
  ['davao_off12', 'davao_off13'], ['davao_off13', 'davao_off14'], ['davao_off14', 'davao_off15'], ['davao_off15', 'manila_off'], ['iloilo_off1', 'iloilo_off2'],
  ['iloilo_off2', 'iloilo_off3'], ['iloilo_off3', 'iloilo_off4'], ['iloilo_off4', 'manila_off'], ['barranquilla_off1', 'barranquilla_off2'],
  ['barranquilla_off2', 'carib_s'], ['cartagena_off1', 'cartagena_off2'], ['cartagena_off2', 'cartagena_off3'], ['cartagena_off3', 'cartagena_off4'],
  ['cartagena_off4', 'carib_s'], ['maracaibo_off1', 'carib_s'], ['guayaquil_off1', 'guayaquil_off2'], ['guayaquil_off2', 'pac_ec'], ['osaka_off1', 'osaka_off2'],
  ['osaka_off2', 'osaka_off3'], ['osaka_off3', 'osaka_off4'], ['osaka_off4', 'japan_s'], ['yokohama_off1', 'japan_s'], ['melbourne_off1', 'melbourne_off2'],
  ['melbourne_off2', 'bass'],
  ['hochiminh_off1', 'hochiminh_off2'], ['hochiminh_off2', 'scs'], ['philadelphia_off1', 'ny_off'], ['izmir_off1', 'izmir_off2'], ['izmir_off2', 'izmir_off3'], ['izmir_off3', 'izmir_off4'], ['izmir_off4', 'aegean_s'], ['antwerp_off1', 'antwerp_off2'], ['antwerp_off2', 'north_sea'], ['neworleans_off1', 'gulf_n'], ['houston_off1', 'houston_off2'], ['houston_off2', 'gulf_n'], ['tokyo_off1', 'japan_s'], ['patras_off1', 'patras_off2'], ['patras_off2', 'patras_off3'], ['patras_off3', 'med_ion'], ['stpetersburg_off1', 'finland_g'],
];
export const PORT_NODE = {
  varna: 'bs_w', burgas: 'bs_w', constanta: 'bs_w', istanbul: 'bosph', thessaloniki: 'thessaloniki_off1', athens: 'athens_off1', barcelona: 'barcelona_off1',
  amsterdam: 'amsterdam_off1', rotterdam: 'north_sea', newyork: 'ny_off', losangeles: 'la_off', rio: 'rio_off', buenosaires: 'buenosaires_off1', capetown: 'cape',
  dubai: 'dubai_off1', mumbai: 'mumbai_off', singapore: 'sing', hongkong: 'hk', shanghai: 'shanghai_off1', tokyo: 'tokyo_off1', sydney: 'sydney_off1',
  izmir: 'izmir_off1', patras: 'patras_off1', heraklion: 'aegean_s', marseille: 'med_w', nice: 'med_w', liverpool: 'liverpool_off1', gdansk: 'baltic', naples: 'naples_off1',
  valencia: 'valencia_off1', antwerp: 'antwerp_off1', sanfrancisco: 'sf_off', miami: 'florida', vancouver: 'vancouver_off1', cancun: 'gulf_mx', salvador: 'salvador_off1',
  fortaleza: 'fortaleza_off1', mardelplata: 'mardelplata_off1', alexandria: 'alexandria_off1', durban: 'natal', portelizabeth: 'portelizabeth_off1', abudhabi: 'abudhabi_off1', sharjah: 'sharjah_off1',
  casablanca: 'morocco', rabat: 'morocco', tangier: 'gibraltar', oran: 'alboran', algiers: 'alg_off', annaba: 'annaba_off1', tunis: 'tunis_off1', bizerte: 'bizerte_off1', sousse: 'tunis_off', sfax: 'sidra',
  tripoli: 'sidra', dakar: 'af_w', saintlouis: 'saintlouis_off1', nouakchott: 'nouakchott_off1', ziguinchor: 'ziguinchor_off1', abidjan: 'guinea', takoradi: 'guinea', capecoast: 'capecoast_off1', accra: 'benin', lagos: 'benin',
  portharcourt: 'portharcourt_off1', douala: 'douala_off1', luanda: 'luanda_off1', lobito: 'angola_off', benguela: 'angola_off', mombasa: 'swahili', daressalaam: 'swahili', zanzibar: 'swahili',
  boston: 'boston_off', philadelphia: 'philadelphia_off1', houston: 'houston_off1', neworleans: 'neworleans_off1', jacksonville: 'jax_off', seattle: 'seattle_off1', halifax: 'halifax_off', quebec: 'quebec_off1', tijuana: 'la_off',
  limon: 'carib', puntarenas: 'pac_cr', panama: 'panama', colon: 'carib', havana: 'florida', varadero: 'florida', santiagocuba: 'cuba_s', santodomingo: 'mona', laromana: 'mona', puntacana: 'mona', puertoplata: 'puertoplata_off1',
  stpetersburg: 'stpetersburg_off1', novorossiysk: 'bs_e', odesa: 'bs_w',
  goldcoast: 'coral', darwin: 'timor', hobart: 'hobart_off1', cairns: 'gbr', townsville: 'gbr', auckland: 'tasman_n', wellington: 'cook', christchurch: 'canterbury', suva: 'fiji', portmoresby: 'torres',
  bangkok: 'gulf_th', pattaya: 'gulf_th', phuket: 'andaman', yangon: 'yangon_off1', hochiminh: 'hochiminh_off1', nhatrang: 'scs', danang: 'danang_off1', haiphong: 'tonkin', penang: 'malacca', malacca: 'malacca_off1', medan: 'medan_off1',
  johorbahru: 'johorbahru_off1', kotakinabalu: 'scs', jakarta: 'jakarta_off1', surabaya: 'surabaya_off1', denpasar: 'denpasar_off1', manila: 'manila_off1', cebu: 'cebu_off1', davao: 'davao_off1', iloilo: 'iloilo_off1', jeddah: 'red_sea', dammam: 'gulf_p', karachi: 'karachi_off',
  barranquilla: 'barranquilla_off1', cartagena: 'cartagena_off1', caracas: 'carib_s', maracaibo: 'maracaibo_off1', guayaquil: 'guayaquil_off1', manta: 'pac_ec', lima: 'pac_pe', trujillo: 'pac_pe', valparaiso: 'pac_cl', concepcion: 'pac_cl', antofagasta: 'pac_cl', laserena: 'pac_cl', montevideo: 'plate',
  chennai: 'bengal', busan: 'korea', incheon: 'yellow', osaka: 'osaka_off1', yokohama: 'yokohama_off1', melbourne: 'melbourne_off1', brisbane: 'coral', perth: 'au_w', adelaide: 'au_s',
};
const hav = ([lo1, la1], [lo2, la2]) => { const r = Math.PI / 180, h = Math.sin((la2 - la1) * r / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2; return 6371 * 2 * Math.asin(Math.sqrt(h)); };
const ADJ = {};
for (const [a, b] of E) { const d = hav(SEA_NODES[a], SEA_NODES[b]); (ADJ[a] = ADJ[a] || []).push([b, d]); (ADJ[b] = ADJ[b] || []).push([a, d]); }
const cache = {}, trees = {};
// всички най-къси пътища от възел s (Дейкстра веднъж на пристанище, а не на всяка линия — картата с хиляди морски линии замръзваше)
function treeFrom(s) {
  if (trees[s]) return trees[s];
  const dist = { [s]: 0 }, prev = {}, todo = new Set(Object.keys(SEA_NODES));
  while (todo.size) {
    let u = null; for (const n of todo) if (dist[n] != null && (u == null || dist[n] < dist[u])) u = n;
    if (u == null) break; todo.delete(u);
    for (const [v, d] of ADJ[u] || []) if (dist[u] + d < (dist[v] ?? Infinity)) { dist[v] = dist[u] + d; prev[v] = u; }
  }
  return (trees[s] = prev);
}
// морският път между два пристанищни града: { pts: [[lon, lat]…], km } (Дейкстра по графа)
export function seaPath(A, B) {
  const key = A.id + '>' + B.id; if (cache[key]) return cache[key];
  const s = PORT_NODE[A.id], t = PORT_NODE[B.id];
  let nodes = [];
  if (s && t && s !== t) {
    const prev = treeFrom(s);
    for (let n = t; n; n = prev[n]) { nodes.unshift(n); if (n === s) break; }
    if (nodes[0] !== s) nodes = [];
  } else if (s) nodes = [s];
  const pts = [[A.lon, A.lat], ...nodes.map(n => SEA_NODES[n]), [B.lon, B.lat]];
  let km = 0; for (let i = 1; i < pts.length; i++) km += hav(pts[i - 1], pts[i]);
  return (cache[key] = { pts, km: Math.round(km * 1.05) });
}
