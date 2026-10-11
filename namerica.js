// namerica.js — Фаза СЕВЕРНА АМЕРИКА (след Африка): отделна карта „🗽 Северна Америка“, нови градове в САЩ и Канада,
// Централна Америка и Карибите (5 нови държави за завладяване), Interstate магистрали и Панамериканската (corridors.js, cont: 'na').
// Отключва се, когато имаш 3 филиала в Африка или една завладяна африканска държава (naOpen).
import { isAfrica, AFRICA_COUNTRIES } from './africa.js';
const c = (id, nm, lat, lon, sz, cc, extra = {}) => ({ id, nm, lat, lon, sz, cc, na: true, ...extra });
export const NAMERICA = [
  // 🇺🇸 още градове в САЩ (ключовите 5 за завладяване си остават: Ню Йорк, Лос Анджелис, Чикаго, Сан Франциско, Маями)
  c('washington', 'Вашингтон', 38.907, -77.037, 3, '🇺🇸', { left: true }), c('boston', 'Бостън', 42.360, -71.059, 3, '🇺🇸'), c('philadelphia', 'Филаделфия', 39.953, -75.165, 3, '🇺🇸', { left: true }),
  c('atlanta', 'Атланта', 33.749, -84.388, 3, '🇺🇸'), c('houston', 'Хюстън', 29.760, -95.370, 3, '🇺🇸'), c('dallas', 'Далас', 32.777, -96.797, 3, '🇺🇸'),
  c('denver', 'Денвър', 39.739, -104.990, 3, '🇺🇸'), c('seattle', 'Сиатъл', 47.606, -122.332, 3, '🇺🇸'), c('lasvegas', 'Лас Вегас', 36.170, -115.140, 3, '🇺🇸'),
  c('phoenix', 'Финикс', 33.448, -112.074, 3, '🇺🇸'), c('sanantonio', 'Сан Антонио', 29.424, -98.494, 3, '🇺🇸', { left: true }), c('neworleans', 'Ню Орлиънс', 29.951, -90.072, 2, '🇺🇸'),
  c('jacksonville', 'Джаксънвил', 30.332, -81.656, 2, '🇺🇸'), c('saltlake', 'Солт Лейк Сити', 40.761, -111.891, 2, '🇺🇸'), c('kansascity', 'Канзас Сити', 39.100, -94.579, 2, '🇺🇸'),
  c('elpaso', 'Ел Пасо', 31.762, -106.485, 2, '🇺🇸'),
  // 🇨🇦 Канада
  c('winnipeg', 'Уинипег', 49.895, -97.138, 2, '🇨🇦'), c('quebec', 'Квебек', 46.813, -71.208, 2, '🇨🇦'), c('halifax', 'Халифакс', 44.649, -63.575, 2, '🇨🇦'), c('edmonton', 'Едмънтън', 53.546, -113.494, 3, '🇨🇦'),
  // 🇲🇽 Мексико
  c('tijuana', 'Тихуана', 32.515, -117.038, 3, '🇲🇽'),
  // 🇬🇹 Гватемала
  c('guatemalacity', 'Гватемала', 14.634, -90.507, 3, '🇬🇹'), c('quetzaltenango', 'Кецалтенанго', 14.835, -91.518, 2, '🇬🇹', { left: true }), c('escuintla', 'Ескуинтла', 14.305, -90.785, 1, '🇬🇹', { left: true }),
  c('coban', 'Кобан', 15.470, -90.371, 1, '🇬🇹'), c('flores', 'Флорес', 16.926, -89.890, 1, '🇬🇹'),
  // 🇨🇷 Коста Рика
  c('sanjose', 'Сан Хосе', 9.928, -84.091, 3, '🇨🇷'), c('limon', 'Лимон', 9.990, -83.036, 2, '🇨🇷'), c('alajuela', 'Алахуела', 10.016, -84.214, 2, '🇨🇷', { left: true }),
  c('puntarenas', 'Пунтаренас', 9.976, -84.833, 1, '🇨🇷', { left: true }), c('liberiacr', 'Либерия', 10.635, -85.437, 1, '🇨🇷', { left: true }),
  // 🇵🇦 Панама
  c('panama', 'Панама', 8.983, -79.517, 3, '🇵🇦'), c('colon', 'Колон', 9.359, -79.901, 2, '🇵🇦', { left: true }), c('david', 'Давид', 8.427, -82.431, 2, '🇵🇦'),
  c('santiagopa', 'Сантяго де Верагуас', 8.100, -80.983, 1, '🇵🇦'), c('chitre', 'Читре', 7.961, -80.430, 1, '🇵🇦'),
  // 🇨🇺 Куба
  c('havana', 'Хавана', 23.113, -82.366, 3, '🇨🇺'), c('santiagocuba', 'Сантяго де Куба', 20.024, -75.821, 2, '🇨🇺'), c('camaguey', 'Камагуей', 21.380, -77.917, 2, '🇨🇺'),
  c('holguin', 'Олгин', 20.887, -76.263, 1, '🇨🇺'), c('varadero', 'Варадеро', 23.154, -81.251, 1, '🇨🇺'),
  // 🇩🇴 Доминиканска република
  c('santodomingo', 'Санто Доминго', 18.486, -69.931, 3, '🇩🇴'), c('santiagodr', 'Сантяго', 19.451, -70.697, 2, '🇩🇴', { left: true }), c('puntacana', 'Пунта Кана', 18.582, -68.405, 2, '🇩🇴'),
  c('puertoplata', 'Пуерто Плата', 19.794, -70.688, 1, '🇩🇴'), c('laromana', 'Ла Романа', 18.427, -68.973, 1, '🇩🇴'),
  // транзит по Панамериканската
  c('sansalvador', 'Сан Салвадор', 13.692, -89.218, 2, '🇸🇻'), c('managua', 'Манагуа', 12.114, -86.236, 2, '🇳🇮'),
];
// градовете, които вече ги имаше в WORLD (САЩ, Канада, Мексико) — и те са част от континента, но остават достъпни по въздуха от ниво 10
export const NA_OLD = ['newyork', 'losangeles', 'chicago', 'sanfrancisco', 'miami', 'toronto', 'montreal', 'vancouver', 'calgary', 'ottawa', 'mexicocity', 'guadalajara', 'monterrey', 'cancun', 'puebla'];
export const NA_NEW = new Set(NAMERICA.map(x => x.id));
export const NA_IDS = new Set([...NA_NEW, ...NA_OLD]);
export const isNA = id => NA_IDS.has(id);
export const NA_COASTAL = ['boston', 'philadelphia', 'houston', 'seattle', 'neworleans', 'jacksonville', 'halifax', 'quebec', 'tijuana', 'limon', 'puntarenas', 'panama', 'colon',
  'havana', 'santiagocuba', 'varadero', 'santodomingo', 'puntacana', 'puertoplata', 'laromana'];
export const NA_COUNTRIES = [
  { cc: '🇬🇹', nm: 'Гватемала', iso: 'GTM', cities: ['guatemalacity', 'quetzaltenango', 'escuintla', 'coban', 'flores'] },
  { cc: '🇨🇷', nm: 'Коста Рика', iso: 'CRI', cities: ['sanjose', 'limon', 'alajuela', 'puntarenas', 'liberiacr'] },
  { cc: '🇵🇦', nm: 'Панама', iso: 'PAN', cities: ['panama', 'colon', 'david', 'santiagopa', 'chitre'] },
  { cc: '🇨🇺', nm: 'Куба', iso: 'CUB', cities: ['havana', 'santiagocuba', 'camaguey', 'holguin', 'varadero'] },
  { cc: '🇩🇴', nm: 'Доминиканска република', iso: 'DOM', cities: ['santodomingo', 'santiagodr', 'puntacana', 'puertoplata', 'laromana'] },
];
// отключване: 3 филиала в Африка или една завладяна африканска държава (owned — твоите градове, isDone — завършен ли е градът)
export const NA_NEED = 3;
export const naOpen = (owned, isDone) => owned.filter(isAfrica).length >= NA_NEED || AFRICA_COUNTRIES.some(k => k.cities.every(isDone));
export const naLockTxt = (owned) => `🔒 Северна Америка се отключва с <b>${NA_NEED} филиала в Африка</b> (сега ${owned.filter(isAfrica).length}) или с една завладяна африканска държава.`;

const own = c => [c.S().hqCity || c.S().cityId, ...(c.S().branches || [])];
const fin = c => Object.keys((c.econ().s.finished) || {});
const naHw = c => (c.S().hwDone || []).filter(id => String(id).startsWith('ab:') && String(id).slice(3).split('-').some(isNA)).length;
const railKm = (S, a, b) => {   // свързани ли са a и b с готови релси (обхождане по графа)
  const R = (S.rails || []).filter(r => r.built), seen = new Set([a]), q = [a];
  while (q.length) { const x = q.shift(); if (x === b) return true; for (const r of R) for (const [p, n] of [[r.a, r.b], [r.b, r.a], [r.a, r.c], [r.c, r.a]]) if (p === x && n && !seen.has(n)) { seen.add(n); q.push(n); } }
  return false;
};
export const NA_CHAPTER = { id: 'c14', nm: 'Северна Америка', ico: '🗽', pic: 'unlock-namerica', picTxt: 'Нов континент: Interstate магистрали, Трансконтиненталната жп линия, Централна Америка и Карибите. Отвори „🗽 Северна Америка“ на картата.',
  openIf: c => c.devBest() >= 10 && naOpen(own(c), id => fin(c).includes(id)), lockTxt: `Отключва се с ${NA_NEED} филиала в Африка или една завладяна африканска държава.`, quests: [
    { id: 'na_br1', ico: '🗽', nm: 'Американска мечта', ds: 'Отвори филиал в Северна Америка.', goal: c => [own(c).filter(isNA).length, 1], money: 20000000 },
    { id: 'na_dc', ico: '🏛️', nm: 'Вашингтон', ds: 'Отвори филиал във Вашингтон.', goal: c => [own(c).includes('washington') ? 1 : 0, 1], money: 20000000 },
    { id: 'na_tx', ico: '🤠', nm: 'Тексас', ds: 'Имай филиали в Хюстън и Далас.', goal: c => [['houston', 'dallas'].filter(id => own(c).includes(id)).length, 2], money: 30000000 },
    { id: 'na_hw1', ico: '🛣️', nm: 'Interstate', ds: 'Завърши участък от американска магистрала.', goal: c => [naHw(c), 1], money: 25000000 },
    { id: 'na_rail', ico: '🚂', nm: 'Трансконтиненталната', ds: 'Свържи Ню Йорк и Сан Франциско с жп линии (може и през други градове).', goal: c => [railKm(c.S(), 'newyork', 'sanfrancisco') ? 1 : 0, 1], money: 80000000 },
    { id: 'na_carib', ico: '🏝️', nm: 'Карибите', ds: 'Отвори филиал в Хавана, Санто Доминго или Пунта Кана.', goal: c => [['havana', 'santodomingo', 'puntacana'].filter(id => own(c).includes(id)).length, 1], money: 25000000 },
    { id: 'na_canal', ico: '⚓', nm: 'Панамският канал', ds: 'Отвори филиал в Панама.', goal: c => [own(c).includes('panama') ? 1 : 0, 1], money: 30000000 },
    { id: 'na_hw8', ico: '🚛', nm: 'Осем участъка', ds: 'Завърши 8 участъка от американските магистрали.', goal: c => [naHw(c), 8], money: 60000000 },
    { id: 'na_br8', ico: '🗺️', nm: 'От брега до брега', ds: 'Имай филиали в 8 северноамерикански града.', goal: c => [own(c).filter(isNA).length, 8], money: 70000000 },
    { id: 'na_won', ico: '🟩', nm: 'Американска държава', ds: 'Завладей държава в Северна Америка.', goal: c => [[...NA_COUNTRIES, { cities: ['newyork', 'losangeles', 'chicago', 'sanfrancisco', 'miami'] }, { cities: ['toronto', 'montreal', 'vancouver', 'calgary', 'ottawa'] }, { cities: ['mexicocity', 'guadalajara', 'monterrey', 'cancun', 'puebla'] }].filter(k => k.cities.every(id => fin(c).includes(id))).length, 1], money: 120000000 },
  ] };
