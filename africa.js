// africa.js — Фаза АФРИКА (след ниво 10): нов континент с отделна карта „🌍 Африка“.
// Градовете влизат в WORLD (game.js), държавите — в COUNTRIES (завладяване), коридорите — в corridors.js (AUTOBAHNS с af: true).
// В Африка филиал се отваря и по суша: с жп линия или аутобан от твой африкански град (не само по въздуха).
const c = (id, nm, lat, lon, sz, cc, extra = {}) => ({ id, nm, lat, lon, sz, cc, af: true, ...extra });
export const AFRICA = [
  // 🇲🇦 Мароко
  c('casablanca', 'Казабланка', 33.573, -7.589, 3, '🇲🇦'), c('rabat', 'Рабат', 34.020, -6.841, 2, '🇲🇦'), c('marrakesh', 'Маракеш', 31.629, -7.981, 3, '🇲🇦'),
  c('tangier', 'Танжер', 35.759, -5.834, 2, '🇲🇦'), c('fes', 'Фес', 34.033, -5.000, 2, '🇲🇦'),
  // 🇩🇿 Алжир
  c('algiers', 'Алжир', 36.754, 3.059, 3, '🇩🇿'), c('oran', 'Оран', 35.697, -0.633, 3, '🇩🇿'), c('constantine', 'Константин', 36.365, 6.615, 2, '🇩🇿'),
  c('annaba', 'Анаба', 36.900, 7.767, 2, '🇩🇿'), c('setif', 'Сетиф', 36.190, 5.414, 1, '🇩🇿', { left: true }),
  // 🇹🇳 Тунис
  c('tunis', 'Тунис', 36.806, 10.181, 3, '🇹🇳'), c('sfax', 'Сфакс', 34.740, 10.760, 2, '🇹🇳'), c('sousse', 'Сус', 35.826, 10.637, 2, '🇹🇳'),
  c('kairouan', 'Кайруан', 35.678, 10.096, 1, '🇹🇳', { left: true }), c('bizerte', 'Бизерта', 37.274, 9.874, 1, '🇹🇳', { left: true }),
  // 🇸🇳 Сенегал
  c('dakar', 'Дакар', 14.716, -17.467, 3, '🇸🇳', { left: true }), c('thies', 'Тиес', 14.791, -16.926, 2, '🇸🇳'), c('saintlouis', 'Сен Луи', 16.018, -16.489, 1, '🇸🇳'),
  c('kaolack', 'Каолак', 14.152, -16.073, 1, '🇸🇳'), c('ziguinchor', 'Зигиншор', 12.583, -16.272, 1, '🇸🇳'),
  // 🇬🇭 Гана
  c('accra', 'Акра', 5.604, -0.187, 3, '🇬🇭'), c('kumasi', 'Кумаси', 6.688, -1.624, 2, '🇬🇭', { left: true }), c('tamale', 'Тамале', 9.401, -0.839, 1, '🇬🇭'),
  c('takoradi', 'Такоради', 4.898, -1.760, 1, '🇬🇭', { left: true }), c('capecoast', 'Кейп Коуст', 5.105, -1.247, 1, '🇬🇭'),
  // 🇳🇬 Нигерия
  c('lagos', 'Лагос', 6.524, 3.379, 3, '🇳🇬'), c('abuja', 'Абуджа', 9.077, 7.399, 3, '🇳🇬'), c('kano', 'Кано', 12.002, 8.592, 3, '🇳🇬'),
  c('ibadan', 'Ибадан', 7.378, 3.947, 3, '🇳🇬', { left: true }), c('portharcourt', 'Порт Харкорт', 4.815, 7.050, 2, '🇳🇬'),
  // 🇪🇹 Етиопия
  c('addisababa', 'Адис Абеба', 9.030, 38.740, 3, '🇪🇹'), c('diredawa', 'Дире Дауа', 9.600, 41.850, 2, '🇪🇹'), c('mekelle', 'Мекеле', 13.497, 39.475, 2, '🇪🇹'),
  c('gondar', 'Гондар', 12.600, 37.467, 1, '🇪🇹', { left: true }), c('bahirdar', 'Бахир Дар', 11.594, 37.390, 1, '🇪🇹', { left: true }),
  // 🇰🇪 Кения
  c('nairobi', 'Найроби', -1.286, 36.817, 3, '🇰🇪'), c('mombasa', 'Момбаса', -4.043, 39.668, 3, '🇰🇪'), c('kisumu', 'Кисуму', -0.092, 34.768, 2, '🇰🇪', { left: true }),
  c('nakuru', 'Накуру', -0.303, 36.080, 2, '🇰🇪', { left: true }), c('eldoret', 'Елдорет', 0.514, 35.270, 1, '🇰🇪'),
  // 🇹🇿 Танзания
  c('daressalaam', 'Дар ес Салам', -6.792, 39.208, 3, '🇹🇿'), c('dodoma', 'Додома', -6.163, 35.752, 2, '🇹🇿', { left: true }), c('arusha', 'Аруша', -3.387, 36.683, 2, '🇹🇿'),
  c('mwanza', 'Мванза', -2.517, 32.900, 2, '🇹🇿', { left: true }), c('zanzibar', 'Занзибар', -6.165, 39.199, 1, '🇹🇿'),
  // 🇦🇴 Ангола
  c('luanda', 'Луанда', -8.839, 13.289, 3, '🇦🇴'), c('huambo', 'Уамбо', -12.776, 15.739, 2, '🇦🇴'), c('lobito', 'Лобиту', -12.348, 13.546, 1, '🇦🇴', { left: true }),
  c('benguela', 'Бенгела', -12.578, 13.405, 1, '🇦🇴', { left: true }), c('lubango', 'Лубанго', -14.917, 13.493, 1, '🇦🇴'),
  // 🇨🇩 ДР Конго
  c('kinshasa', 'Киншаса', -4.441, 15.266, 3, '🇨🇩'), c('lubumbashi', 'Лубумбаши', -11.665, 27.479, 2, '🇨🇩'), c('mbujimayi', 'Мбужи Май', -6.136, 23.590, 2, '🇨🇩'),
  c('kisangani', 'Кисангани', 0.515, 25.191, 2, '🇨🇩'), c('goma', 'Гома', -1.679, 29.222, 1, '🇨🇩', { left: true }),
  // транзитни градове по коридорите (без завладяване)
  c('tripoli', 'Триполи', 32.887, 13.191, 3, '🇱🇾'), c('nouakchott', 'Нуакшот', 18.079, -15.965, 2, '🇲🇷'), c('abidjan', 'Абиджан', 5.360, -4.008, 3, '🇨🇮'),
  c('douala', 'Дуала', 4.051, 9.768, 3, '🇨🇲'), c('kampala', 'Кампала', 0.348, 32.582, 3, '🇺🇬', { left: true }), c('khartoum', 'Хартум', 15.501, 32.560, 3, '🇸🇩'),
  c('lusaka', 'Лусака', -15.387, 28.322, 3, '🇿🇲'), c('harare', 'Хараре', -17.829, 31.052, 3, '🇿🇼'),
];
// египетските и южноафриканските градове вече ги има в WORLD — и те са част от Африка
export const AFRICA_OLD = ['cairo', 'alexandria', 'giza', 'luxor', 'aswan', 'capetown', 'johannesburg', 'durban', 'pretoria', 'portelizabeth'];
export const AFRICA_IDS = new Set([...AFRICA.map(x => x.id), ...AFRICA_OLD]);
export const isAfrica = id => AFRICA_IDS.has(id);
export const AFRICA_COASTAL = ['casablanca', 'rabat', 'tangier', 'algiers', 'oran', 'annaba', 'tunis', 'sfax', 'sousse', 'bizerte', 'dakar', 'saintlouis', 'ziguinchor',
  'accra', 'takoradi', 'capecoast', 'lagos', 'portharcourt', 'mombasa', 'daressalaam', 'zanzibar', 'luanda', 'lobito', 'benguela', 'tripoli', 'nouakchott', 'abidjan', 'douala'];

export const AFRICA_COUNTRIES = [
  { cc: '🇲🇦', nm: 'Мароко', iso: 'MAR', cities: ['casablanca', 'rabat', 'marrakesh', 'tangier', 'fes'] },
  { cc: '🇩🇿', nm: 'Алжир', iso: 'DZA', cities: ['algiers', 'oran', 'constantine', 'annaba', 'setif'] },
  { cc: '🇹🇳', nm: 'Тунис', iso: 'TUN', cities: ['tunis', 'sfax', 'sousse', 'kairouan', 'bizerte'] },
  { cc: '🇸🇳', nm: 'Сенегал', iso: 'SEN', cities: ['dakar', 'thies', 'saintlouis', 'kaolack', 'ziguinchor'] },
  { cc: '🇬🇭', nm: 'Гана', iso: 'GHA', cities: ['accra', 'kumasi', 'tamale', 'takoradi', 'capecoast'] },
  { cc: '🇳🇬', nm: 'Нигерия', iso: 'NGA', cities: ['lagos', 'abuja', 'kano', 'ibadan', 'portharcourt'] },
  { cc: '🇪🇹', nm: 'Етиопия', iso: 'ETH', cities: ['addisababa', 'diredawa', 'mekelle', 'gondar', 'bahirdar'] },
  { cc: '🇰🇪', nm: 'Кения', iso: 'KEN', cities: ['nairobi', 'mombasa', 'kisumu', 'nakuru', 'eldoret'] },
  { cc: '🇹🇿', nm: 'Танзания', iso: 'TZA', cities: ['daressalaam', 'dodoma', 'arusha', 'mwanza', 'zanzibar'] },
  { cc: '🇦🇴', nm: 'Ангола', iso: 'AGO', cities: ['luanda', 'huambo', 'lobito', 'benguela', 'lubango'] },
  { cc: '🇨🇩', nm: 'ДР Конго', iso: 'COD', cities: ['kinshasa', 'lubumbashi', 'mbujimayi', 'kisangani', 'goma'] },
];
// глава с куести „Африка“ (quests.js я добавя след останалите)
const owned = c => [c.S().hqCity || c.S().cityId, ...(c.S().branches || [])];
const finished = c => Object.keys((c.econ().s.finished) || {});
const tahDone = c => (c.S().hwDone || []).filter(id => String(id).startsWith('ab:') && String(id).slice(3).split('-').some(isAfrica)).length;
const afRails = c => (c.S().rails || []).filter(r => r.built && isAfrica(r.a) && isAfrica(r.b)).length;
export const AFRICA_CHAPTER = { id: 'c13', nm: 'Африка', ico: '🌍', pic: 'unlock-africa', picTxt: 'Нов континент: 11 държави, трансафрикански магистрали и жп линии през саваната. Отвори „🌍 Африка“ на картата.',
  openIf: c => c.devBest() >= 10, lockTxt: 'Отключва се на ниво 10 на развитие.', quests: [
    { id: 'af_br1', ico: '🌍', nm: 'Стъпка в Африка', ds: 'Отвори филиал в африкански град.', goal: c => [owned(c).filter(isAfrica).length, 1], money: 10000000 },
    { id: 'af_lagos', ico: '🇳🇬', nm: 'Лагос', ds: 'Отвори филиал в Лагос — най-големият град на континента.', goal: c => [owned(c).includes('lagos') ? 1 : 0, 1], money: 12000000 },
    { id: 'af_nbo', ico: '🦁', nm: 'Найроби', ds: 'Отвори филиал в Найроби.', goal: c => [owned(c).includes('nairobi') ? 1 : 0, 1], money: 12000000 },
    { id: 'af_rail', ico: '🛤️', nm: 'Жп през саваната', ds: 'Построй жп линия между два африкански града.', goal: c => [afRails(c), 1], money: 8000000 },
    { id: 'af_tah1', ico: '🔴', nm: 'Трансафриканска', ds: 'Завърши участък от трансафриканска магистрала.', goal: c => [tahDone(c), 1], money: 15000000 },
    { id: 'af_br5', ico: '🗺️', nm: 'Пет африкански града', ds: 'Имай филиали в 5 африкански града.', goal: c => [owned(c).filter(isAfrica).length, 5], money: 30000000 },
    { id: 'af_tah5', ico: '🚛', nm: 'Пет участъка', ds: 'Завърши 5 участъка от трансафрикански магистрали.', goal: c => [tahDone(c), 5], money: 40000000 },
    { id: 'af_fin', ico: '🏁', nm: 'Завършен африкански град', ds: 'Завърши град в Африка.', goal: c => [finished(c).filter(isAfrica).length, 1], money: 30000000 },
    { id: 'af_won', ico: '🟩', nm: 'Африканска държава', ds: 'Завладей африканска държава (завърши 5-те ѝ ключови града).', goal: c => [AFRICA_COUNTRIES.filter(k => k.cities.every(id => finished(c).includes(id))).length, 1], money: 80000000 },
  ] };
