// samerica.js — Фаза ЮЖНА АМЕРИКА (след Северна Америка): отделна карта „🌎 Южна Америка“, 5 нови държави за завладяване,
// транзитни градове, магистрали през Андите и по Атлантическия бряг (corridors.js, cont: 'sa').
// Отключва се, когато имаш 3 филиала в Северна Америка или една завладяна северноамериканска държава (saOpen).
import { isNA, NA_COUNTRIES } from './namerica.js';
const c = (id, nm, lat, lon, sz, cc, extra = {}) => ({ id, nm, lat, lon, sz, cc, sa: true, ...extra });
export const SAMERICA = [
  // 🇨🇴 Колумбия
  c('bogota', 'Богота', 4.711, -74.072, 3, '🇨🇴'), c('medellin', 'Меделин', 6.244, -75.581, 3, '🇨🇴', { left: true }), c('cali', 'Кали', 3.452, -76.532, 3, '🇨🇴', { left: true }),
  c('barranquilla', 'Баранкия', 10.964, -74.796, 2, '🇨🇴'), c('cartagena', 'Картахена', 10.391, -75.479, 2, '🇨🇴', { left: true }),
  // 🇻🇪 Венецуела
  c('caracas', 'Каракас', 10.481, -66.904, 3, '🇻🇪'), c('maracaibo', 'Маракайбо', 10.642, -71.613, 3, '🇻🇪', { left: true }), c('valenciave', 'Валенсия', 10.162, -68.008, 2, '🇻🇪', { left: true }),
  c('barquisimeto', 'Баркисимето', 10.067, -69.347, 2, '🇻🇪', { left: true }), c('maracay', 'Маракай', 10.247, -67.596, 1, '🇻🇪'),
  // 🇪🇨 Еквадор
  c('quito', 'Кито', -0.180, -78.468, 3, '🇪🇨'), c('guayaquil', 'Гуаякил', -2.171, -79.922, 3, '🇪🇨', { left: true }), c('cuenca', 'Куенка', -2.900, -79.005, 2, '🇪🇨'),
  c('manta', 'Манта', -0.967, -80.709, 1, '🇪🇨', { left: true }), c('ambato', 'Амбато', -1.241, -78.627, 1, '🇪🇨'),
  // 🇵🇪 Перу
  c('lima', 'Лима', -12.046, -77.043, 3, '🇵🇪', { left: true }), c('arequipa', 'Арекипа', -16.409, -71.537, 2, '🇵🇪'), c('cusco', 'Куско', -13.532, -71.968, 2, '🇵🇪'),
  c('trujillo', 'Трухильо', -8.112, -79.029, 2, '🇵🇪', { left: true }), c('chiclayo', 'Чиклайо', -6.771, -79.841, 1, '🇵🇪', { left: true }),
  // 🇨🇱 Чили
  c('santiagocl', 'Сантяго', -33.449, -70.669, 3, '🇨🇱'), c('valparaiso', 'Валпараисо', -33.047, -71.613, 2, '🇨🇱', { left: true }), c('concepcion', 'Консепсион', -36.827, -73.050, 2, '🇨🇱', { left: true }),
  c('antofagasta', 'Антофагаста', -23.650, -70.400, 2, '🇨🇱', { left: true }), c('laserena', 'Ла Серена', -29.903, -71.252, 1, '🇨🇱', { left: true }),
  // транзит
  c('lapaz', 'Ла Пас', -16.500, -68.150, 3, '🇧🇴'), c('asuncion', 'Асунсион', -25.264, -57.576, 2, '🇵🇾'), c('montevideo', 'Монтевидео', -34.901, -56.164, 3, '🇺🇾'),
];
// бразилските и аржентинските градове вече ги има в WORLD — и те са част от континента
export const SA_OLD = ['rio', 'saopaulo', 'brasilia', 'salvador', 'fortaleza', 'buenosaires', 'cordoba', 'rosario', 'mendoza', 'mardelplata'];
export const SA_NEW = new Set(SAMERICA.map(x => x.id));
export const SA_IDS = new Set([...SA_NEW, ...SA_OLD]);
export const isSA = id => SA_IDS.has(id);
export const SA_COASTAL = ['barranquilla', 'cartagena', 'caracas', 'maracaibo', 'guayaquil', 'manta', 'lima', 'trujillo', 'valparaiso', 'concepcion', 'antofagasta', 'laserena', 'montevideo'];
export const SA_COUNTRIES = [
  { cc: '🇨🇴', nm: 'Колумбия', iso: 'COL', cities: ['bogota', 'medellin', 'cali', 'barranquilla', 'cartagena'] },
  { cc: '🇻🇪', nm: 'Венецуела', iso: 'VEN', cities: ['caracas', 'maracaibo', 'valenciave', 'barquisimeto', 'maracay'] },
  { cc: '🇪🇨', nm: 'Еквадор', iso: 'ECU', cities: ['quito', 'guayaquil', 'cuenca', 'manta', 'ambato'] },
  { cc: '🇵🇪', nm: 'Перу', iso: 'PER', cities: ['lima', 'arequipa', 'cusco', 'trujillo', 'chiclayo'] },
  { cc: '🇨🇱', nm: 'Чили', iso: 'CHL', cities: ['santiagocl', 'valparaiso', 'concepcion', 'antofagasta', 'laserena'] },
];
// отключване: 3 филиала в Северна Америка или една завладяна северноамериканска държава
const NA_KEYS = [...NA_COUNTRIES.map(k => k.cities), ['newyork', 'losangeles', 'chicago', 'sanfrancisco', 'miami'], ['toronto', 'montreal', 'vancouver', 'calgary', 'ottawa'], ['mexicocity', 'guadalajara', 'monterrey', 'cancun', 'puebla']];
export const SA_NEED = 3;
export const saOpen = (owned, isDone) => owned.filter(isNA).length >= SA_NEED || NA_KEYS.some(cs => cs.every(isDone));
export const saLockTxt = owned => `🔒 Южна Америка се отключва с <b>${SA_NEED} филиала в Северна Америка</b> (сега ${owned.filter(isNA).length}) или с една завладяна северноамериканска държава.`;

const own = c => [c.S().hqCity || c.S().cityId, ...(c.S().branches || [])];
const fin = c => Object.keys((c.econ().s.finished) || {});
const saHw = c => (c.S().hwDone || []).filter(id => String(id).startsWith('ab:') && String(id).slice(3).split('-').some(isSA)).length;
export const SA_CHAPTER = { id: 'c15', nm: 'Южна Америка', ico: '🌎', pic: 'unlock-samerica', picTxt: 'Нов континент: Андите, Амазония и Огнена земя. Панамериканската магистрала до Сантяго и Трансандийската до Буенос Айрес. Отвори „🌎 Южна Америка“ на картата.',
  openIf: c => c.devBest() >= 10 && saOpen(own(c), id => fin(c).includes(id)), lockTxt: `Отключва се с ${SA_NEED} филиала в Северна Америка или една завладяна северноамериканска държава.`, quests: [
    { id: 'sa_br1', ico: '🌎', nm: 'Южно от екватора', ds: 'Отвори филиал в Южна Америка.', goal: c => [own(c).filter(isSA).length, 1], money: 30000000 },
    { id: 'sa_rio', ico: '🏖️', nm: 'Рио де Жанейро', ds: 'Отвори филиал в Рио.', goal: c => [own(c).includes('rio') ? 1 : 0, 1], money: 30000000 },
    { id: 'sa_andes', ico: '🏔️', nm: 'Андите', ds: 'Имай филиали в Богота, Кито и Лима.', goal: c => [['bogota', 'quito', 'lima'].filter(id => own(c).includes(id)).length, 3], money: 60000000 },
    { id: 'sa_hw1', ico: '🛣️', nm: 'Панамерикана', ds: 'Завърши участък от южноамериканска магистрала.', goal: c => [saHw(c), 1], money: 35000000 },
    { id: 'sa_cusco', ico: '🦙', nm: 'Пътят на инките', ds: 'Отвори филиал в Куско.', goal: c => [own(c).includes('cusco') ? 1 : 0, 1], money: 40000000 },
    { id: 'sa_trans', ico: '🚛', nm: 'През Андите', ds: 'Завърши 6 участъка от южноамериканските магистрали.', goal: c => [saHw(c), 6], money: 90000000 },
    { id: 'sa_br8', ico: '🗺️', nm: 'От Карибите до Огнена земя', ds: 'Имай филиали в 8 южноамерикански града.', goal: c => [own(c).filter(isSA).length, 8], money: 100000000 },
    { id: 'sa_won', ico: '🟩', nm: 'Южноамериканска държава', ds: 'Завладей държава в Южна Америка.', goal: c => [[...SA_COUNTRIES.map(k => k.cities), ['saopaulo', 'rio', 'brasilia', 'salvador', 'fortaleza'], ['buenosaires', 'cordoba', 'rosario', 'mendoza', 'mardelplata']].filter(cs => cs.every(id => fin(c).includes(id))).length, 1], money: 150000000 },
  ] };
