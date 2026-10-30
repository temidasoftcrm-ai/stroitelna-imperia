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
  // 🇪🇺 истински магистрали до градовете, които нямаха нито един участък (Линц, Бърно, Амстердам, Берлин, Рим…)
  { id: 'A1-AT', nm: 'Западна: Мюнхен — Залцбург — Линц — Виена', cities: ['munich', 'salzburg', 'linz', 'vienna'] },   // A8 + A1 Westautobahn
  { id: 'A9-AT', nm: 'Пирн: Линц — Грац', cities: ['linz', 'graz'] },
  { id: 'E59', nm: 'Южна: Виена — Грац — Загреб', cities: ['vienna', 'graz', 'zagreb'] },   // A2 + A9 (Марибор) + A2 HR
  { id: 'E45-AT', nm: 'Бренер: Мюнхен — Инсбрук — Милано', cities: ['munich', 'innsbruck', 'milan'] },   // A12/A13 + A22 (Верона) + A4
  { id: 'D1', nm: 'D1: Прага — Бърно — Острава — Краков', cities: ['prague', 'brno', 'olomouc', 'ostrava', 'krakow'] },   // D1 + A1/A4 PL
  { id: 'E461', nm: 'Бърно — Виена', cities: ['brno', 'vienna'] },   // D52 + A5
  { id: 'E60-HU', nm: 'M1: Виена — Дьор — Будапеща', cities: ['vienna', 'gyor', 'budapest'] },
  { id: 'E75-N', nm: 'M5: Будапеща — Сегед — Нови Сад — Белград', cities: ['budapest', 'szeged', 'subotica', 'novisad', 'belgrade'] },
  { id: 'M35', nm: 'Будапеща — Дебрецен — Клуж', cities: ['budapest', 'debrecen', 'cluj'] },   // M3/M35 + A3 RO (Орадя)
  { id: 'A1-RO', nm: 'Сегед — Тимишоара — Букурещ', cities: ['szeged', 'timisoara', 'bucharest'] },   // M43 + A1 RO
  { id: 'E73', nm: 'Коридор Vc: Будапеща — Печ — Сараево — Сплит', cities: ['budapest', 'pecs', 'sarajevo', 'split'] },   // M6 + A1 BiH (Мостар, Плоче)
  { id: 'E70', nm: 'Торино — Милано — Любляна — Загреб — Белград', cities: ['turin', 'milan', 'ljubljana', 'zagreb', 'belgrade'] },   // A4 IT + A1 SI + A3 HR/SRB
  { id: 'A1-HR', nm: 'Далматина: Загреб — Сплит', cities: ['zagreb', 'split'] },
  { id: 'A1-SRB', nm: 'Белград — Крагуевац', cities: ['belgrade', 'kragujevac'] },
  { id: 'A1-MNE', nm: 'Бар — Боляре: Подгорица — Белград', cities: ['podgorica', 'belgrade'] },
  { id: 'R7', nm: 'Пътят на нацията: Тирана — Прищина — Скопие', cities: ['tirana', 'pristina', 'skopje'] },
  { id: 'VIII', nm: 'Коридор 8: Тирана — Охрид — Скопие — Куманово', cities: ['tirana', 'ohrid', 'skopje', 'kumanovo'] },
  { id: 'A3-MK', nm: 'Скопие — Прилеп — Битоля', cities: ['skopje', 'prilep', 'bitola'] },
  { id: 'A8-GR', nm: 'Олимпия Одос: Атина — Патра', cities: ['athens', 'patras'] },
  { id: 'O-5', nm: 'Истанбул — Бурса — Измир', cities: ['istanbul', 'bursa', 'izmir'] },   // мостът Осман Гази
  { id: 'E35', nm: 'Амстердам — Кьолн — Франкфурт — Базел — Милано — Рим — Неапол', cities: ['amsterdam', 'utrecht', 'cologne', 'frankfurt', 'basel', 'milan', 'florence', 'rome', 'naples'] },   // + A1 Autostrada del Sole
  { id: 'E19', nm: 'Брюксел — Антверпен — Ротердам — Амстердам', cities: ['brussels', 'antwerp', 'rotterdam', 'hague', 'amsterdam'] },
  { id: 'E40-W', nm: 'Брюж — Гент — Брюксел — Лиеж — Кьолн', cities: ['bruges', 'ghent', 'brussels', 'liege', 'cologne'] },
  { id: 'E25', nm: 'Утрехт — Айндховен — Лиеж — Люксембург', cities: ['utrecht', 'eindhoven', 'liege', 'luxembourg'] },   // A2 NL + E25
  { id: 'A1-DE', nm: 'Хамбург — Кьолн — Франкфурт — Мюнхен', cities: ['hamburg', 'cologne', 'frankfurt', 'munich'] },   // A1 + A3 + A9
  { id: 'A24', nm: 'Берлин — Хамбург', cities: ['berlin', 'hamburg'] },
  { id: 'A9-DE', nm: 'Берлин — Мюнхен', cities: ['berlin', 'munich'] },
  { id: 'E30-W', nm: 'Берлин — Познан — Варшава', cities: ['berlin', 'poznan', 'warsaw'] },   // A2 PL
  { id: 'E55', nm: 'Берлин — Прага', cities: ['berlin', 'prague'] },   // A13 + D8 (Дрезден)
  { id: 'S7', nm: 'Гданск — Варшава — Краков', cities: ['gdansk', 'warsaw', 'krakow'] },
  { id: 'A4-PL', nm: 'Вроцлав — Краков', cities: ['wroclaw', 'krakow'] },
  { id: 'A6-FR', nm: 'Слънчевата: Париж — Лион — Марсилия', cities: ['paris', 'lyon', 'marseille'] },   // A6 + A7
  { id: 'E80-FR', nm: 'Ница — Марсилия — Тулуза', cities: ['nice', 'marseille', 'toulouse'] },   // A8 + A54/A9 + A61
  { id: 'A10-IT', nm: 'Ница — Торино', cities: ['nice', 'turin'] },   // A10 (Вентимиля) + A6
  { id: 'A61', nm: 'Тулуза — Барселона', cities: ['toulouse', 'barcelona'] },   // A61 + A9 + AP-7
  { id: 'A1-CH', nm: 'Лион — Женева — Лозана — Берн — Цюрих', cities: ['lyon', 'geneva', 'lausanne', 'bern', 'zurich'] },   // A40/A41 + A1 CH
  { id: 'A3-CH', nm: 'Базел — Цюрих', cities: ['basel', 'zurich'] },
  { id: 'AP-7', nm: 'Средиземноморска: Барселона — Валенсия — Мадрид', cities: ['barcelona', 'valencia', 'madrid'] },   // AP-7 + A-3
  { id: 'E5', nm: 'Париж — Билбао — Мадрид — Севиля', cities: ['paris', 'bilbao', 'madrid', 'seville'] },   // A10/A63 + AP-8/AP-1 + A-1 + A-4
  { id: 'M6', nm: 'Лондон — Бирмингам — Манчестър — Единбург', cities: ['london', 'birmingham', 'manchester', 'edinburgh'] },   // M1/M6 + M74/M8
  { id: 'M62', nm: 'Манчестър — Ливърпул', cities: ['manchester', 'liverpool'] },
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
  'alexandria|tripoli': [[29.44, 30.45], [19.94, 30.45], [18.94, 29.7], [17.69, 30.45], [15.94, 30.7], [14.69, 31.95]],   // навътре в сушата (бреговата линия на картата е груба — по брега пунктирът влизаше в морето)
  'constanta|odesa': [[28.71, 44.90], [28.46, 45.27], [28.30, 45.46], [28.95, 45.75], [29.42, 45.99], [30.05, 46.08], [30.46, 46.08]],   // Бабадаг, Исакча, Рени (Дунав), Болград, Арциз, Сарата, Затока — около лиманите
  'marrakesh|nouakchott': [[-9.46, 30.08], [-9.46, 29.83], [-15.96, 23.33]],   // по сушата (поправено автоматично по картата) — беше: по брега около Сахара: Агадир, Ел Аюн, Дахла, Нуадибу
  'douala|portharcourt': [[8.32, 4.95]],                              // Калабар (Порт Харкорт → Дуала)
  'kampala|kisumu': [[33.20, 0.45], [34.18, 0.69]],                                                  // Джинджа, Тороро — покрай езерото Виктория
  'toronto|winnipeg': [[-81.00, 46.49], [-89.25, 48.38]],                                           // Съдбъри, Тъндър Бей — покрай Горното езеро
  'halifax|quebec': [[-65.46, 46.65]],   // по сушата (поправено автоматично по картата) — беше: от Халифакс: Монктън, Фредериктън, Едмъндстън (бяха наобратно → три линии на зигзаг)
  'boston|newyork': [[-72.68, 41.76]],                                                              // Хартфорд
  'buenosaires|montevideo': [[-59.03, -34.10], [-58.52, -33.01], [-58.30, -33.12], [-58.03, -33.25], [-57.40, -34.30]],   // около Рио де ла Плата: Сарате, Гуалегуайчу, Фрай Бентос
  'dhaka|yangon': [[96.16, 18.09]],   // по сушата (поправено автоматично по картата) — беше: Читагонг, Ситуе — по сушата покрай Бенгалския залив
  'adelaide|perth': [[138.11, -32.93], [137.61, -32.68], [134.86, -32.68], [134.11, -31.93], [133.11, -31.43], [132.11, -31.43], [131.36, -30.93], [129.86, -30.93], [127.61, -31.68]],   // навътре в сушата (по брега пунктирът влизаше в морето)
  'medellin|panama': [[-78.27, 8.99]],   // по сушата (поправено автоматично по картата) — беше: Турбо, Явиса (Дариен), Чепо — от Меделин към Панама
  'brussels|london': [[3.06, 50.63], [1.86, 50.95], [1.17, 51.08]],                                  // Лил, Кале, (тунел) Фолкстоун
  'novorossiysk|voronezh': [[37.77, 45.72], [39.27, 47.22]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'sfax|tripoli': [[10.10, 33.90], [10.50, 33.35], [11.22, 33.14], [12.08, 32.93]],   // T2: Габес, Меденин, Бен Гардан, Зуара — истинската магистрала, на юг без връщане (беше: на запад и обратно на изток)
  // старото: [[10.26, 34.64], [10.01, 34.39], [10.01, 34.14], [10.51, 33.64], [10.76, 33.64], [11.51, 32.89], [12.26, 32.89], [12.51, 32.64]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
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
  'dammam|dubai': [[49.48, 25.95], [49.98, 25.2], [51.98, 23.45], [52.23, 23.7], [54.23, 23.7]],   // навътре в сушата (по брега пунктирът влизаше в морето)
  'cairns|townsville': [[145.77, -18.51]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'hamilton|wellington': [[175.28, -40.79]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'lagos|portharcourt': [[5.38, 6.57]],   // по сушата — иначе пунктирът минаваше през морето (автоматично по картата)
  'lagos|luanda': [[5.38, 6.57], [7.0, 5.0], [9.7, 4.6], [11.5, 3.9], [11.9, 1.2], [13.2, -1.2], [14.6, -3.6], [15.2, -4.6], [14.6, -6.6]],   // жп по сушата: Нигерия → Камерун → Габон → Конго → Ангола (беше направо през Гвинейския залив)
  // жп линии по сушата (автоматично по картата — иначе правата линия минаваше над залив)
  'larissa|plovdiv': [[22.17, 40.14], [24.17, 42.14]],
  'odesa|varna': [[27.66, 43.96]],
  'larissa|stz': [[22.17, 40.14], [24.42, 42.39]],
  'istanbul|shumen': [[28.17, 41.51]],
  'dobrich|odesa': [[27.83, 44.32]],
  'haskovo|larissa': [[23.92, 41.89], [22.17, 40.14]],
  'kardzhali|larissa': [[23.67, 41.64], [22.17, 40.14]],
  'gabrovo|larissa': [[24.92, 42.89], [22.17, 40.14]],
  'larissa|pazardzhik': [[22.17, 40.14]],
  'edirne|larissa': [[23.67, 41.64], [22.17, 40.14]],
  'patras|thessaloniki': [[21.73, 39.75]],
  'ohrid|split': [[17.94, 43.87]],
  'florence|zagreb': [[11.26, 44.52], [12.76, 46.02], [15.76, 46.02]],
  'florence|split': [[11.26, 44.76], [12.76, 46.26], [14.01, 46.26]],
  'florence|ljubljana': [[11.26, 44.52], [12.76, 46.02]],
  'marseille|toulouse': [[5.44, 43.8], [1.69, 43.8]],
  'edinburgh|liverpool': [[-2.44, 55.16], [-2.44, 53.91]],
  'annaba|bizerte': [[8.27, 36.4]],
  'dakar|ziguinchor': [[-16.22, 14.08]],
  'nouakchott|thies': [[-16.18, 16.79], [-16.18, 15.79]],
  'lobito|luanda': [[14.04, -12.1], [14.04, -10.6]],
  'benguela|luanda': [[14.04, -12.08], [14.04, -10.58]],
  'boston|philadelphia': [[-72.67, 42.45]],
  'limon|santiagopa': [[-82.04, 8.6]],
  'chitre|panama': [[-80.93, 8.21]],
  'laserena|valparaiso': [[-70.86, -29.8], [-70.86, -32.8]],
  // новите европейски аутобани — по сушата, където правата линия минава над море/езеро
  'athens|patras': [[22.99, 37.92], [22.72, 37.99], [22.58, 38.05], [22.07, 38.23]],   // Коринт, Кято, Ксилокастро, Егио — по южния бряг на Коринтския залив
  'bursa|istanbul': [[29.31, 40.49], [29.51, 40.70], [29.43, 40.80]],   // Орхангази, мостът Осман Гази, Гебзе (от Бурса към Истанбул)
  'barcelona|valencia': [[1.2, 41.15], [0.45, 40.6], [-0.1, 40.0]],   // Тарагона, Винарос, Кастельон
  'bilbao|paris': [[-2.0, 43.25], [-1.40, 43.45], [-0.58, 44.84]],   // Сан Себастиан, Байон, Бордо (от Билбао към Париж)
  'geneva|lausanne': [[6.24, 46.40], [6.50, 46.52]],   // Нион, Морж — по северния бряг на Женевското езеро
};
// map-balk-fix (T2): ръчното трасе е истинският път — грубият бряг на световната карта го смята за море (Габес) и автоматичното трасе по сушата правеше примка
export const VIA_FIXED = new Set(['sfax|tripoli']);
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
