// asia.js — Фаза АЗИЯ (след Южна Америка): отделна карта „🌏 Азия“, 6 нови държави за завладяване, още градове в Китай,
// транзитни градове по Пътя на коприната и магистрали (corridors.js, cont: 'as'). Азия е свързана с Европа по суша (жп линии през Истанбул).
// Отключва се, когато имаш 3 филиала в Южна Америка или една завладяна южноамериканска държава (asOpen).
import { isSA, SA_COUNTRIES } from './samerica.js';
const c = (id, nm, lat, lon, sz, cc, extra = {}) => ({ id, nm, lat, lon, sz, cc, as: true, ...extra });
export const ASIA = [
  // 🇹🇭 Тайланд
  c('bangkok', 'Банкок', 13.756, 100.502, 3, '🇹🇭'), c('chiangmai', 'Чианг Май', 18.788, 98.985, 2, '🇹🇭'), c('phuket', 'Пукет', 7.880, 98.392, 2, '🇹🇭', { left: true }),
  c('pattaya', 'Патая', 12.927, 100.877, 2, '🇹🇭'), c('hatyai', 'Хат Яй', 7.009, 100.475, 1, '🇹🇭'),
  // 🇻🇳 Виетнам
  c('hanoi', 'Ханой', 21.028, 105.854, 3, '🇻🇳', { left: true }), c('hochiminh', 'Хошимин', 10.823, 106.630, 3, '🇻🇳'), c('danang', 'Дананг', 16.054, 108.202, 2, '🇻🇳'),
  c('haiphong', 'Хайфон', 20.845, 106.688, 2, '🇻🇳'), c('nhatrang', 'Нячанг', 12.238, 109.197, 1, '🇻🇳'),
  // 🇲🇾 Малайзия
  c('kualalumpur', 'Куала Лумпур', 3.139, 101.687, 3, '🇲🇾', { left: true }), c('penang', 'Пенанг', 5.414, 100.329, 2, '🇲🇾', { left: true }), c('johorbahru', 'Джохор Бару', 1.493, 103.741, 2, '🇲🇾', { left: true }),
  c('malacca', 'Малака', 2.189, 102.250, 1, '🇲🇾', { left: true }), c('kotakinabalu', 'Кота Кинабалу', 5.980, 116.073, 1, '🇲🇾'),
  // 🇮🇩 Индонезия
  c('jakarta', 'Джакарта', -6.208, 106.846, 3, '🇮🇩', { left: true }), c('surabaya', 'Сурабая', -7.257, 112.752, 3, '🇮🇩'), c('bandung', 'Бандунг', -6.917, 107.619, 2, '🇮🇩'),
  c('denpasar', 'Бали', -8.650, 115.216, 2, '🇮🇩'), c('medan', 'Медан', 3.595, 98.672, 2, '🇮🇩', { left: true }),
  // 🇵🇭 Филипини
  c('manila', 'Манила', 14.600, 120.984, 3, '🇵🇭', { left: true }), c('cebu', 'Себу', 10.316, 123.886, 2, '🇵🇭'), c('davao', 'Давао', 7.191, 125.455, 2, '🇵🇭'),
  c('baguio', 'Багио', 16.402, 120.596, 1, '🇵🇭'), c('iloilo', 'Илоило', 10.720, 122.562, 1, '🇵🇭', { left: true }),
  // 🇸🇦 Саудитска Арабия
  c('riyadh', 'Рияд', 24.713, 46.675, 3, '🇸🇦'), c('jeddah', 'Джеда', 21.543, 39.173, 3, '🇸🇦', { left: true }), c('mecca', 'Мека', 21.389, 39.858, 2, '🇸🇦'),
  c('medina', 'Медина', 24.524, 39.569, 2, '🇸🇦'), c('dammam', 'Дамам', 26.392, 49.977, 2, '🇸🇦', { left: true }),
  // 🇨🇳 още градове в Китай (ключовите 5 за завладяване си остават)
  c('chengdu', 'Чънду', 30.573, 104.066, 3, '🇨🇳', { left: true }), c('chongqing', 'Чунцин', 29.563, 106.551, 3, '🇨🇳'), c('wuhan', 'Ухан', 30.593, 114.305, 3, '🇨🇳'), c('xian', 'Сиан', 34.341, 108.940, 3, '🇨🇳'),
  // транзит — Пътят на коприната и Южна Азия
  c('tehran', 'Техеран', 35.689, 51.389, 3, '🇮🇷'), c('tashkent', 'Ташкент', 41.299, 69.240, 3, '🇺🇿'), c('almaty', 'Алмати', 43.222, 76.851, 3, '🇰🇿'),
  c('yekaterinburg', 'Екатеринбург', 56.838, 60.597, 3, '🇷🇺'), c('novosibirsk', 'Новосибирск', 55.008, 82.935, 3, '🇷🇺'), c('irkutsk', 'Иркутск', 52.287, 104.305, 2, '🇷🇺'),
  c('khabarovsk', 'Хабаровск', 48.480, 135.080, 2, '🇷🇺', { left: true }), c('vladivostok', 'Владивосток', 43.115, 131.886, 2, '🇷🇺'),
  c('karachi', 'Карачи', 24.861, 67.010, 3, '🇵🇰', { left: true }), c('dhaka', 'Дака', 23.810, 90.413, 3, '🇧🇩'), c('yangon', 'Янгон', 16.840, 96.173, 3, '🇲🇲', { left: true }),
];
// градовете, които вече ги има в WORLD — и те са част от Азия
export const AS_OLD = ['dubai', 'abudhabi', 'sharjah', 'ajman', 'alain', 'mumbai', 'delhi', 'bangalore', 'chennai', 'kolkata', 'singapore', 'hongkong', 'shanghai', 'beijing', 'guangzhou', 'shenzhen',
  'seoul', 'busan', 'incheon', 'daegu', 'daejeon', 'tokyo', 'osaka', 'kyoto', 'yokohama', 'sapporo'];
export const AS_NEW = new Set(ASIA.map(x => x.id));
export const AS_IDS = new Set([...AS_NEW, ...AS_OLD]);
export const isAsia = id => AS_IDS.has(id);
export const AS_COASTAL = ['bangkok', 'phuket', 'pattaya', 'hochiminh', 'danang', 'haiphong', 'nhatrang', 'penang', 'johorbahru', 'malacca', 'kotakinabalu', 'jakarta', 'surabaya', 'denpasar', 'medan',
  'manila', 'cebu', 'davao', 'iloilo', 'jeddah', 'dammam', 'karachi', 'yangon'];
export const AS_COUNTRIES = [
  { cc: '🇹🇭', nm: 'Тайланд', iso: 'THA', cities: ['bangkok', 'chiangmai', 'phuket', 'pattaya', 'hatyai'] },
  { cc: '🇻🇳', nm: 'Виетнам', iso: 'VNM', cities: ['hanoi', 'hochiminh', 'danang', 'haiphong', 'nhatrang'] },
  { cc: '🇲🇾', nm: 'Малайзия', iso: 'MYS', cities: ['kualalumpur', 'penang', 'johorbahru', 'malacca', 'kotakinabalu'] },
  { cc: '🇮🇩', nm: 'Индонезия', iso: 'IDN', cities: ['jakarta', 'surabaya', 'bandung', 'denpasar', 'medan'] },
  { cc: '🇵🇭', nm: 'Филипини', iso: 'PHL', cities: ['manila', 'cebu', 'davao', 'baguio', 'iloilo'] },
  { cc: '🇸🇦', nm: 'Саудитска Арабия', iso: 'SAU', cities: ['riyadh', 'jeddah', 'mecca', 'medina', 'dammam'] },
];
// отключване: 3 филиала в Южна Америка или една завладяна южноамериканска държава
const SA_KEYS = [...SA_COUNTRIES.map(k => k.cities), ['saopaulo', 'rio', 'brasilia', 'salvador', 'fortaleza'], ['buenosaires', 'cordoba', 'rosario', 'mendoza', 'mardelplata']];
export const AS_NEED = 3;
export const asOpen = (owned, isDone) => owned.filter(isSA).length >= AS_NEED || SA_KEYS.some(cs => cs.every(isDone));
export const asLockTxt = owned => `🔒 Азия се отключва с <b>${AS_NEED} филиала в Южна Америка</b> (сега ${owned.filter(isSA).length}) или с една завладяна южноамериканска държава.`;

const own = c => [c.S().hqCity || c.S().cityId, ...(c.S().branches || [])];
const fin = c => Object.keys((c.econ().s.finished) || {});
const asHw = c => (c.S().hwDone || []).filter(id => String(id).startsWith('ab:') && String(id).slice(3).split('-').some(isAsia)).length;
const silk = ['istanbul', 'ankara', 'tehran', 'tashkent', 'almaty', 'xian', 'beijing'];
export const AS_CHAPTER = { id: 'c16', nm: 'Азия', ico: '🌏', pic: 'unlock-asia', picTxt: 'Нов континент: Пътят на коприната от Истанбул до Пекин, тайландските плажове, мегаполисите на Китай и островите на Индонезия. Отвори „🌏 Азия“ на картата.',
  openIf: c => c.devBest() >= 10 && asOpen(own(c), id => fin(c).includes(id)), lockTxt: `Отключва се с ${AS_NEED} филиала в Южна Америка или една завладяна южноамериканска държава.`, quests: [
    { id: 'as_br1', ico: '🌏', nm: 'Към Изтока', ds: 'Отвори филиал в Азия.', goal: c => [own(c).filter(isAsia).length, 1], money: 40000000 },
    { id: 'as_bkk', ico: '🛕', nm: 'Банкок', ds: 'Отвори филиал в Банкок.', goal: c => [own(c).includes('bangkok') ? 1 : 0, 1], money: 40000000 },
    { id: 'as_kl', ico: '🏙️', nm: 'Куала Лумпур', ds: 'Отвори филиал в Куала Лумпур.', goal: c => [own(c).includes('kualalumpur') ? 1 : 0, 1], money: 40000000 },
    { id: 'as_hw1', ico: '🛣️', nm: 'Азиатска магистрала', ds: 'Завърши участък от азиатска магистрала.', goal: c => [asHw(c), 1], money: 45000000 },
    { id: 'as_silk', ico: '🐫', nm: 'Пътят на коприната', ds: 'Завърши целия аутобан Истанбул — Пекин.', goal: c => [silk.slice(1).filter((b, i) => (c.S().hwDone || []).includes(`ab:${[silk[i], b].sort().join('-')}`)).length, silk.length - 1], money: 250000000 },
    { id: 'as_china', ico: '🐉', nm: 'Китайски мегаполиси', ds: 'Имай филиали в 4 китайски града.', goal: c => [own(c).filter(id => ['beijing', 'shanghai', 'hongkong', 'guangzhou', 'shenzhen', 'chengdu', 'chongqing', 'wuhan', 'xian'].includes(id)).length, 4], money: 120000000 },
    { id: 'as_br10', ico: '🗺️', nm: 'Азиатска империя', ds: 'Имай филиали в 10 азиатски града.', goal: c => [own(c).filter(isAsia).length, 10], money: 150000000 },
    { id: 'as_won', ico: '🟩', nm: 'Азиатска държава', ds: 'Завладей държава в Азия.', goal: c => [AS_COUNTRIES.filter(k => k.cities.every(id => fin(c).includes(id))).length, 1], money: 200000000 },
  ] };
