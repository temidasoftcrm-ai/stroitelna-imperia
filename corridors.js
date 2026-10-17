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
  'naples|rome': [],   // права линия (сушата на картата е груба и иначе прави чупка навътре)
  'barcelona|milan': [[2.17, 42.13], [5.42, 45.38]],   // по сушата (поправено автоматично по картата) — беше: Перпинян, Монпелие, Марсилия, Ница, Генуа
  'athens|thessaloniki': [[22.94, 38.98], [22.94, 39.48], [22.44, 40.23]],   // по сушата (поправено автоматично по картата) — беше: Ламия, Лариса
  'alexandria|tripoli': [[28.94, 30.7], [19.94, 30.7], [18.94, 30.2], [15.69, 31.2], [14.44, 32.45]],   // по сушата (поправено автоматично по картата) — беше: Тобрук, Бенгази, Аждабия, Сирт, Мисрата
  'constanta|odesa': [[28.71, 44.90], [28.46, 45.27], [28.30, 45.46], [28.95, 45.75], [29.42, 45.99], [30.05, 46.08], [30.46, 46.08]],   // Бабадаг, Исакча, Рени (Дунав), Болград, Арциз, Сарата, Затока — около лиманите
  'marrakesh|nouakchott': [[-9.46, 30.08], [-9.46, 29.83], [-15.96, 23.33]],   // по сушата (поправено автоматично по картата) — беше: по брега около Сахара: Агадир, Ел Аюн, Дахла, Нуадибу
  'douala|portharcourt': [[8.32, 4.95]],                              // Калабар (Порт Харкорт → Дуала)
  'kampala|kisumu': [[33.20, 0.45], [34.18, 0.69]],                                                  // Джинджа, Тороро — покрай езерото Виктория
  'toronto|winnipeg': [[-81.00, 46.49], [-89.25, 48.38]],                                           // Съдбъри, Тъндър Бей — покрай Горното езеро
  'halifax|quebec': [[-65.46, 46.65]],   // по сушата (поправено автоматично по картата) — беше: от Халифакс: Монктън, Фредериктън, Едмъндстън (бяха наобратно → три линии на зигзаг)
  'boston|newyork': [[-72.68, 41.76]],                                                              // Хартфорд
  'buenosaires|montevideo': [[-59.03, -34.10], [-58.52, -33.01], [-58.30, -33.12], [-58.03, -33.25], [-57.40, -34.30]],   // около Рио де ла Плата: Сарате, Гуалегуайчу, Фрай Бентос
  'dhaka|yangon': [[96.16, 18.09]],   // по сушата (поправено автоматично по картата) — беше: Читагонг, Ситуе — по сушата покрай Бенгалския залив
  'adelaide|perth': [[138.11, -34.43], [138.11, -33.43], [137.61, -32.93], [134.61, -32.93], [133.86, -32.18], [133.36, -32.18], [133.11, -31.93], [132.36, -31.93], [131.61, -31.43], [129.36, -31.43], [129.11, -31.68], [128.36, -31.68], [128.11, -31.93]],   // по сушата (поправено автоматично по картата) — беше: по Наларбор: Порт Огъста, Седуна, Юкла, Норсман
  'medellin|panama': [[-78.27, 8.99]],   // по сушата (поправено автоматично по картата) — беше: Турбо, Явиса (Дариен), Чепо — от Меделин към Панама
  'brussels|london': [[3.06, 50.63], [1.86, 50.95], [1.17, 51.08]],                                  // Лил, Кале, (тунел) Фолкстоун
  'novorossiysk|voronezh': [[37.77, 45.72], [39.27, 47.22]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'sfax|tripoli': [[10.26, 34.64], [10.01, 34.39], [10.01, 34.14], [10.51, 33.64], [10.76, 33.64], [11.51, 32.89], [12.26, 32.89], [12.51, 32.64]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'accra|lagos': [[0.81, 6.6]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'jacksonville|washington': [[-81.66, 34.33]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'jacksonville|neworleans': [[-89.57, 30.45]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'seattle|vancouver': [[-122.37, 48.61]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'losangeles|tijuana': [[-116.99, 32.77]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'managua|sansalvador': [[-87.72, 13.61]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'guayaquil|trujillo': [[-79.67, -2.36], [-79.67, -7.36]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'antofagasta|arequipa': [[-70.04, -23.4], [-70.04, -19.15], [-70.29, -18.9], [-70.29, -18.4], [-71.54, -17.15]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'antofagasta|laserena': [[-70.25, -28.9]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'rio|salvador': [[-39.92, -19.66], [-39.67, -18.16], [-39.17, -17.16], [-39.17, -13.91], [-38.92, -13.66], [-38.92, -13.16]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'bangkok|yangon': [[97.17, 17.01]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'bangkok|hatyai': [[98.97, 12.26], [98.97, 9.26]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'chennai|kolkata': [[80.02, 13.33], [80.02, 15.58], [87.02, 22.58]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'danang|hanoi': [[107.1, 16.8], [105.6, 18.8], [105.6, 20.8]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'dammam|dubai': [[49.98, 25.7], [50.48, 25.2], [50.48, 24.95], [50.73, 24.7], [51.23, 24.7], [51.98, 23.95], [53.98, 23.95]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'cairns|townsville': [[145.77, -18.51]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'hamilton|wellington': [[175.28, -40.79]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'lagos|portharcourt': [[5.38, 6.57]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
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
