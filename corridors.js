// corridors.js — Фаза 9: аутобани (международни коридори през Европа).
// Участъците са двойки съседни градове; общ участък на два коридора се строи веднъж и носи тол и на двата.
// game.js ползва: AUTOBAHNS, abSegs(), abSegId(a, b), AB_STAGES_DEF (ако autobahn.js още не е зареден), AB_UNLOCK.
import { RUSSIA_AB } from './russia.js';
import { UKRAINE_AB } from './ukraine.js';
export const AUTOBAHNS = [
  { id: 'E1', nm: 'Париж — Истанбул', cities: ['paris', 'munich', 'vienna', 'budapest', 'belgrade', 'nis', 'sofia', 'plovdiv', 'edirne', 'istanbul'] },
  { id: 'E2', nm: 'Лондон — Атина', cities: ['london', 'brussels', 'luxembourg', 'zurich', 'munich', 'vienna', 'budapest', 'belgrade', 'nis', 'skopje', 'thessaloniki', 'athens'] },
  { id: 'E3', nm: 'Мадрид — Варна', cities: ['madrid', 'barcelona', 'milan', 'vienna', 'budapest', 'bucharest', 'varna'] },
  ...RUSSIA_AB,   // 🇷🇺 Русия
  { id: 'E67', nm: 'Мюнхен — Прага — Москва', cities: ['munich', 'plzen', 'prague', 'wroclaw', 'warsaw', 'moscow'] },   // последният участък е общ с E30
  ...UKRAINE_AB,  // 🇺🇦 Украйна
  // 🌍 трансафрикански магистрали (africa.js; отключват се с Африка — ниво 10)
  { id: 'TAH1', nm: 'Кайро — Дакар', af: true, cont: 'af', cities: ['cairo', 'alexandria', 'tripoli', 'sfax', 'sousse', 'tunis', 'annaba', 'constantine', 'setif', 'algiers', 'oran', 'fes', 'rabat', 'casablanca', 'marrakesh', 'nouakchott', 'saintlouis', 'thies', 'dakar'] },
  { id: 'TAH4', nm: 'Кайро — Кейптаун', af: true, cont: 'af', cities: ['cairo', 'luxor', 'aswan', 'khartoum', 'gondar', 'bahirdar', 'addisababa', 'nairobi', 'arusha', 'dodoma', 'lusaka', 'harare', 'pretoria', 'johannesburg', 'capetown'] },
  { id: 'TAH7', nm: 'Дакар — Лагос', af: true, cont: 'af', cities: ['dakar', 'kaolack', 'ziguinchor', 'abidjan', 'takoradi', 'capecoast', 'accra', 'lagos'] },
  // 🗽 Северна Америка (namerica.js; отключват се с континента)
  { id: 'I-95', nm: 'Маями — Бостън', cont: 'na', cities: ['miami', 'jacksonville', 'washington', 'philadelphia', 'newyork', 'boston'] },
  { id: 'I-10', nm: 'Лос Анджелис — Джаксънвил', cont: 'na', cities: ['losangeles', 'phoenix', 'elpaso', 'sanantonio', 'houston', 'neworleans', 'jacksonville'] },
  { id: 'I-80', nm: 'Сан Франциско — Ню Йорк', cont: 'na', cities: ['sanfrancisco', 'saltlake', 'denver', 'kansascity', 'chicago', 'newyork'] },
  { id: 'I-5', nm: 'Ванкувър — Тихуана', cont: 'na', cities: ['vancouver', 'seattle', 'sanfrancisco', 'losangeles', 'tijuana'] },
  { id: 'US-66', nm: 'Route 66', cont: 'na', cities: ['chicago', 'kansascity', 'dallas', 'elpaso', 'phoenix', 'losangeles'] },   // специалната поръчка (route66.js)
  { id: 'TCH', nm: 'Трансканадска', cont: 'na', cities: ['vancouver', 'calgary', 'winnipeg', 'toronto', 'ottawa', 'montreal', 'quebec', 'halifax'] },
  { id: 'PAN', nm: 'Панамериканска', cont: 'na', cities: ['dallas', 'sanantonio', 'monterrey', 'mexicocity', 'puebla', 'guatemalacity', 'sansalvador', 'managua', 'sanjose', 'david', 'panama'] },
  // 🌎 Южна Америка (samerica.js)
  { id: 'PAN-S', nm: 'Панамерикана: Картахена — Сантяго', cont: 'sa', cities: ['cartagena', 'medellin', 'cali', 'quito', 'guayaquil', 'trujillo', 'lima', 'arequipa', 'antofagasta', 'laserena', 'santiagocl'] },
  { id: 'DARIEN', nm: 'Дариенският пролом: Панама — Меделин', cont: 'sa', cities: ['panama', 'medellin'] },
  { id: 'BOL', nm: 'Боливарианска: Каракас — Кали', cont: 'sa', cities: ['caracas', 'maracay', 'valenciave', 'barquisimeto', 'bogota', 'cali'] },
  { id: 'TRA', nm: 'Трансандийска: Сантяго — Буенос Айрес', cont: 'sa', cities: ['santiagocl', 'mendoza', 'cordoba', 'rosario', 'buenosaires'] },
  { id: 'BR-116', nm: 'Атлантическа: Форталеза — Монтевидео', cont: 'sa', cities: ['fortaleza', 'salvador', 'rio', 'saopaulo', 'montevideo', 'buenosaires'] },
  { id: 'INCA', nm: 'Пътят на инките: Куско — Сао Пауло', cont: 'sa', cities: ['lima', 'cusco', 'lapaz', 'asuncion', 'saopaulo'] },
  // 🌏 Азия (asia.js)
  { id: 'SILK', nm: 'Пътят на коприната: Истанбул — Пекин', cont: 'as', cities: ['istanbul', 'ankara', 'tehran', 'tashkent', 'almaty', 'xian', 'beijing'] },
  { id: 'G4', nm: 'Пекин — Хонконг', cont: 'as', cities: ['beijing', 'wuhan', 'guangzhou', 'shenzhen', 'hongkong'] },
  { id: 'G42', nm: 'Шанхай — Чънду', cont: 'as', cities: ['shanghai', 'wuhan', 'chongqing', 'chengdu'] },
  { id: 'AH2', nm: 'Карачи — Сингапур', cont: 'as', cities: ['karachi', 'delhi', 'kolkata', 'dhaka', 'yangon', 'bangkok', 'hatyai', 'penang', 'kualalumpur', 'malacca', 'johorbahru', 'singapore'] },
  { id: 'GQ', nm: 'Златният четириъгълник на Индия', cont: 'as', cities: ['delhi', 'mumbai', 'bangalore', 'chennai', 'kolkata'] },
  { id: 'AH1', nm: 'Банкок — Ханой', cont: 'as', cities: ['bangkok', 'hochiminh', 'nhatrang', 'danang', 'hanoi'] },
  { id: 'GCC', nm: 'Дубай — Джеда', cont: 'as', cities: ['dubai', 'dammam', 'riyadh', 'mecca', 'jeddah'] },
  // 🦘 Австралия и Океания (oceania.js)
  { id: 'A1', nm: 'Магистрала 1: Пърт — Кернс', cont: 'oc', cities: ['perth', 'adelaide', 'melbourne', 'canberra', 'sydney', 'goldcoast', 'brisbane', 'townsville', 'cairns'] },
  { id: 'STUART', nm: 'Стюарт: Аделаида — Дарвин', cont: 'oc', cities: ['adelaide', 'alicesprings', 'darwin'] },
  { id: 'NZ1', nm: 'Окланд — Уелингтън', cont: 'oc', cities: ['auckland', 'hamilton', 'wellington'] },
  { id: 'NZ6', nm: 'Крайстчърч — Куинстаун', cont: 'oc', cities: ['christchurch', 'queenstown'] },
  { id: 'TAH8', nm: 'Лагос — Момбаса', af: true, cont: 'af', cities: ['lagos', 'portharcourt', 'douala', 'kisangani', 'kampala', 'kisumu', 'nakuru', 'nairobi', 'mombasa'] },
];
// отключване: ниво 8 (Европа) и поне 3 изцяло завършени български магистрали
export const AB_UNLOCK = { lv: 8, bgFull: 3 };
// истински трасета между градове, които по права линия минават през море/планина (жп и аутобани):
// ключ — двата града по азбучен ред; точките са [lon, lat] от първия към втория
export const ROUTE_VIA = {
  'barcelona|milan': [[2.90, 42.70], [3.88, 43.61], [5.37, 43.30], [7.27, 43.70], [8.93, 44.41]],   // Перпинян, Монпелие, Марсилия, Ница, Генуа
  'athens|thessaloniki': [[22.43, 38.90], [22.42, 39.64]],                                           // Ламия, Лариса
  'alexandria|tripoli': [[23.96, 32.08], [20.07, 32.12], [20.22, 30.76], [16.59, 31.20], [15.09, 32.38]],   // Тобрук, Бенгази, Аждабия, Сирт, Мисрата
  'douala|portharcourt': [[8.32, 4.95]],                              // Калабар (Порт Харкорт → Дуала)
  'kampala|kisumu': [[33.20, 0.45], [34.18, 0.69]],                                                  // Джинджа, Тороро — покрай езерото Виктория
  'toronto|winnipeg': [[-81.00, 46.49], [-89.25, 48.38]],                                           // Съдбъри, Тъндър Бей — покрай Горното езеро
  'halifax|quebec': [[-68.52, 47.38], [-66.65, 45.96], [-64.80, 45.50]],                            // Едмъндстън, Фредериктън, Монктън
  'boston|newyork': [[-72.68, 41.76]],                                                              // Хартфорд
  'buenosaires|montevideo': [[-59.03, -34.10], [-58.52, -33.01], [-58.30, -33.12], [-58.03, -33.25], [-57.40, -34.30]],   // около Рио де ла Плата: Сарате, Гуалегуайчу, Фрай Бентос
  'dhaka|yangon': [[91.80, 22.34], [92.90, 20.15], [94.70, 19.00]],   // Читагонг, Ситуе — по сушата покрай Бенгалския залив
  'adelaide|perth': [[137.77, -32.49], [133.68, -32.13], [128.88, -31.68], [121.78, -32.20]],   // по Наларбор: Порт Огъста, Седуна, Юкла, Норсман
  'medellin|panama': [[-76.73, 8.09], [-77.69, 8.16], [-78.40, 8.70]],   // Турбо, Явиса (Дариен), Чепо — от Меделин към Панама
  'brussels|london': [[3.06, 50.63], [1.86, 50.95], [1.17, 51.08]],                                  // Лил, Кале, (тунел) Фолкстоун
};
export const viaOf = (a, b) => { const k = [a, b].sort().join('|'), v = ROUTE_VIA[k]; return !v ? null : a <= b ? v : [...v].reverse(); };
export const abSegId = (a, b) => 'ab:' + [a, b].sort().join('-');
// всички участъци без повторение; hw е първият коридор, в който участъкът се среща
export function abSegs() {
  const seen = new Map();
  for (const c of AUTOBAHNS) for (let i = 1; i < c.cities.length; i++) {
    const a = c.cities[i - 1], b = c.cities[i], id = abSegId(a, b);
    if (!seen.has(id)) seen.set(id, { id, hw: c, a, b, ab: true, af: !!c.af, cont: c.cont || null });
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
