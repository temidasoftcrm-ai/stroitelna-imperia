// countries.js — „завладяване“ на държави: завършиш ли ключовите градове на една държава (5, за България 6),
// тя светва в зелено на картата и дава бонуси: +10% приход от завършените ѝ градове и −10% за материалите от заводите ѝ.
// Тук са и допълнителните градове, нужни за по 5 на държава (game.js ги добавя към FOREIGN / EUROPE / WORLD).
export const WON_INCOME = 0.10, WON_MATERIALS = 0.10;

const c = (id, nm, lat, lon, sz, cc, extra = {}) => ({ id, nm, lat, lon, sz, cc, ...extra });
// Балкани (ниво 5 — като останалите съседни)
export const EXTRA_BALKAN = [
  c('izmir', 'Измир', 38.423, 27.143, 3, '🇹🇷'), c('bursa', 'Бурса', 40.188, 29.061, 2, '🇹🇷'),
  c('cluj', 'Клуж', 46.771, 23.624, 2, '🇷🇴'), c('timisoara', 'Тимишоара', 45.749, 21.208, 2, '🇷🇴'), c('iasi', 'Яш', 47.159, 27.587, 2, '🇷🇴'),
  c('novisad', 'Нови Сад', 45.267, 19.833, 2, '🇷🇸'), c('kragujevac', 'Крагуевац', 44.012, 20.911, 1, '🇷🇸'), c('subotica', 'Суботица', 46.100, 19.667, 1, '🇷🇸'),
  c('bitola', 'Битоля', 41.031, 21.335, 1, '🇲🇰'), c('ohrid', 'Охрид', 41.117, 20.802, 1, '🇲🇰'), c('kumanovo', 'Куманово', 42.132, 21.714, 1, '🇲🇰', { left: true }), c('prilep', 'Прилеп', 41.346, 21.555, 1, '🇲🇰'),
  // Западните Балкани — по един-два града там, където картата беше празна
  c('zagreb', 'Загреб', 45.815, 15.982, 3, '🇭🇷'), c('split', 'Сплит', 43.508, 16.440, 2, '🇭🇷', { left: true }), c('ljubljana', 'Любляна', 46.056, 14.506, 2, '🇸🇮', { left: true }),
  c('sarajevo', 'Сараево', 43.856, 18.413, 2, '🇧🇦'), c('podgorica', 'Подгорица', 42.441, 19.263, 1, '🇲🇪'), c('tirana', 'Тирана', 41.328, 19.818, 2, '🇦🇱', { left: true }), c('pristina', 'Прищина', 42.663, 21.166, 1, '🇽🇰'),
  c('patras', 'Патра', 38.246, 21.735, 2, '🇬🇷'), c('heraklion', 'Ираклион', 35.339, 25.144, 2, '🇬🇷'), c('larissa', 'Лариса', 39.639, 22.419, 1, '🇬🇷'),
];
// Европа (ниво 8)
export const EXTRA_EUROPE = [
  c('marseille', 'Марсилия', 43.296, 5.370, 3, '🇫🇷'), c('lyon', 'Лион', 45.764, 4.836, 3, '🇫🇷'), c('toulouse', 'Тулуза', 43.605, 1.444, 2, '🇫🇷'), c('nice', 'Ница', 43.710, 7.262, 2, '🇫🇷'),
  c('manchester', 'Манчестър', 53.481, -2.243, 3, '🇬🇧'), c('birmingham', 'Бирмингам', 52.486, -1.890, 3, '🇬🇧'), c('liverpool', 'Ливърпул', 53.408, -2.991, 2, '🇬🇧', { left: true }), c('edinburgh', 'Единбург', 55.953, -3.188, 2, '🇬🇧'),
  c('utrecht', 'Утрехт', 52.091, 5.122, 2, '🇳🇱'), c('eindhoven', 'Айндховен', 51.441, 5.470, 2, '🇳🇱'),
  c('antwerp', 'Антверпен', 51.219, 4.402, 2, '🇧🇪'), c('ghent', 'Гент', 51.054, 3.717, 2, '🇧🇪', { left: true }), c('liege', 'Лиеж', 50.633, 5.567, 2, '🇧🇪'), c('bruges', 'Брюж', 51.209, 3.225, 1, '🇧🇪', { left: true }),
  c('hamburg', 'Хамбург', 53.551, 9.993, 3, '🇩🇪'), c('frankfurt', 'Франкфурт', 50.110, 8.682, 3, '🇩🇪'), c('cologne', 'Кьолн', 50.938, 6.960, 3, '🇩🇪'),
  c('brno', 'Бърно', 49.195, 16.607, 2, '🇨🇿'), c('ostrava', 'Острава', 49.821, 18.262, 2, '🇨🇿'), c('plzen', 'Пилзен', 49.738, 13.373, 1, '🇨🇿'), c('olomouc', 'Оломоуц', 49.594, 17.251, 1, '🇨🇿'),
  c('graz', 'Грац', 47.071, 15.439, 2, '🇦🇹'), c('linz', 'Линц', 48.306, 14.286, 2, '🇦🇹'), c('salzburg', 'Залцбург', 47.809, 13.055, 2, '🇦🇹'), c('innsbruck', 'Инсбрук', 47.269, 11.404, 1, '🇦🇹'),
  c('debrecen', 'Дебрецен', 47.532, 21.627, 2, '🇭🇺'), c('szeged', 'Сегед', 46.253, 20.141, 2, '🇭🇺'), c('pecs', 'Печ', 46.073, 18.233, 1, '🇭🇺'), c('gyor', 'Дьор', 47.687, 17.650, 1, '🇭🇺'),
  c('krakow', 'Краков', 50.065, 19.945, 3, '🇵🇱'), c('gdansk', 'Гданск', 54.352, 18.646, 2, '🇵🇱'), c('wroclaw', 'Вроцлав', 51.108, 17.039, 2, '🇵🇱'), c('poznan', 'Познан', 52.406, 16.925, 2, '🇵🇱'),
  c('naples', 'Неапол', 40.852, 14.268, 3, '🇮🇹'), c('turin', 'Торино', 45.070, 7.687, 3, '🇮🇹', { left: true }), c('florence', 'Флоренция', 43.770, 11.256, 2, '🇮🇹'),
  c('valencia', 'Валенсия', 39.470, -0.376, 3, '🇪🇸'), c('seville', 'Севиля', 37.389, -5.984, 2, '🇪🇸'), c('bilbao', 'Билбао', 43.263, -2.935, 2, '🇪🇸'),
  c('geneva', 'Женева', 46.204, 6.143, 2, '🇨🇭', { left: true }), c('basel', 'Базел', 47.560, 7.589, 2, '🇨🇭'), c('bern', 'Берн', 46.948, 7.447, 2, '🇨🇭'), c('lausanne', 'Лозана', 46.520, 6.633, 1, '🇨🇭'),
];
// Светът (ниво 10)
export const EXTRA_WORLD = [
  c('sanfrancisco', 'Сан Франциско', 37.775, -122.419, 3, '🇺🇸'), c('miami', 'Маями', 25.762, -80.192, 3, '🇺🇸'),
  c('montreal', 'Монреал', 45.502, -73.567, 3, '🇨🇦'), c('vancouver', 'Ванкувър', 49.283, -123.121, 3, '🇨🇦'), c('calgary', 'Калгари', 51.045, -114.072, 2, '🇨🇦'), c('ottawa', 'Отава', 45.421, -75.697, 2, '🇨🇦', { left: true }),
  c('guadalajara', 'Гуадалахара', 20.659, -103.349, 3, '🇲🇽'), c('monterrey', 'Монтерей', 25.686, -100.316, 3, '🇲🇽'), c('cancun', 'Канкун', 21.161, -86.851, 2, '🇲🇽'), c('puebla', 'Пуебла', 19.041, -98.206, 2, '🇲🇽'),
  c('brasilia', 'Бразилия', -15.794, -47.882, 3, '🇧🇷'), c('salvador', 'Салвадор', -12.977, -38.501, 3, '🇧🇷'), c('fortaleza', 'Форталеза', -3.732, -38.527, 3, '🇧🇷'),
  c('cordoba', 'Кордоба', -31.420, -64.188, 3, '🇦🇷'), c('rosario', 'Росарио', -32.945, -60.651, 2, '🇦🇷'), c('mendoza', 'Мендоса', -32.890, -68.845, 2, '🇦🇷'), c('mardelplata', 'Мар дел Плата', -38.002, -57.556, 2, '🇦🇷'),
  // Гиза е отместена на югозапад (към платото), за да не се застъпва с Кайро на картата
  c('alexandria', 'Александрия', 31.200, 29.919, 3, '🇪🇬'), c('giza', 'Гиза', 29.700, 30.700, 3, '🇪🇬', { left: true }), c('luxor', 'Луксор', 25.687, 32.640, 2, '🇪🇬'), c('aswan', 'Асуан', 24.089, 32.899, 2, '🇪🇬'),
  c('johannesburg', 'Йоханесбург', -26.204, 28.047, 3, '🇿🇦'), c('durban', 'Дърбан', -29.858, 31.022, 3, '🇿🇦'), c('pretoria', 'Претория', -25.747, 28.229, 2, '🇿🇦', { left: true }), c('portelizabeth', 'Порт Елизабет', -33.960, 25.602, 2, '🇿🇦'),
  c('abudhabi', 'Абу Даби', 24.453, 54.377, 3, '🇦🇪', { left: true }), c('sharjah', 'Шарджа', 25.346, 55.421, 2, '🇦🇪'), c('ajman', 'Аджман', 25.405, 55.513, 1, '🇦🇪'), c('alain', 'Ал Айн', 24.207, 55.745, 2, '🇦🇪'),
  c('delhi', 'Делхи', 28.614, 77.209, 3, '🇮🇳'), c('bangalore', 'Бангалор', 12.972, 77.594, 3, '🇮🇳'), c('chennai', 'Ченай', 13.083, 80.270, 3, '🇮🇳'), c('kolkata', 'Колката', 22.573, 88.364, 3, '🇮🇳'),
  c('guangzhou', 'Гуанджоу', 23.129, 113.264, 3, '🇨🇳', { left: true }), c('shenzhen', 'Шънджън', 22.543, 114.058, 3, '🇨🇳'),
  c('busan', 'Пусан', 35.180, 129.076, 3, '🇰🇷'), c('incheon', 'Инчон', 37.456, 126.705, 3, '🇰🇷', { left: true }), c('daegu', 'Тегу', 35.871, 128.602, 2, '🇰🇷'), c('daejeon', 'Теджон', 36.351, 127.385, 2, '🇰🇷'),
  c('osaka', 'Осака', 34.694, 135.502, 3, '🇯🇵'), c('kyoto', 'Киото', 35.012, 135.768, 2, '🇯🇵', { left: true }), c('yokohama', 'Йокохама', 35.444, 139.638, 3, '🇯🇵'), c('sapporo', 'Сапоро', 43.062, 141.354, 2, '🇯🇵'),
  c('melbourne', 'Мелбърн', -37.814, 144.963, 3, '🇦🇺'), c('brisbane', 'Бризбейн', -27.470, 153.026, 3, '🇦🇺'), c('perth', 'Пърт', -31.951, 115.861, 3, '🇦🇺'), c('adelaide', 'Аделаида', -34.929, 138.601, 2, '🇦🇺'),
];
export const EXTRA_COASTAL = ['split', 'izmir', 'patras', 'heraklion', 'marseille', 'nice', 'liverpool', 'gdansk', 'naples', 'valencia', 'sanfrancisco', 'miami', 'vancouver', 'cancun', 'salvador', 'fortaleza', 'mardelplata',
  'alexandria', 'durban', 'portelizabeth', 'abudhabi', 'sharjah', 'chennai', 'busan', 'incheon', 'osaka', 'yokohama', 'melbourne', 'brisbane', 'perth', 'adelaide', 'antwerp'];

// държавите: ключовите градове (5; България — 6; градовете-държави — 1) и кодът на държавата в картата (ISO3)
export const COUNTRIES = [
  { cc: '🇧🇬', nm: 'България', iso: 'BGR', cities: ['sofia', 'plovdiv', 'varna', 'burgas', 'vt', 'blg'] },
  { cc: '🇹🇷', nm: 'Турция', iso: 'TUR', cities: ['istanbul', 'ankara', 'izmir', 'bursa', 'edirne'] },
  { cc: '🇷🇴', nm: 'Румъния', iso: 'ROU', cities: ['bucharest', 'constanta', 'cluj', 'timisoara', 'iasi'] },
  { cc: '🇷🇸', nm: 'Сърбия', iso: 'SRB', cities: ['belgrade', 'nis', 'novisad', 'kragujevac', 'subotica'] },
  { cc: '🇲🇰', nm: 'Северна Македония', iso: 'MKD', cities: ['skopje', 'bitola', 'ohrid', 'kumanovo', 'prilep'] },
  { cc: '🇬🇷', nm: 'Гърция', iso: 'GRC', cities: ['athens', 'thessaloniki', 'patras', 'heraklion', 'larissa'] },
  { cc: '🇫🇷', nm: 'Франция', iso: 'FRA', cities: ['paris', 'marseille', 'lyon', 'toulouse', 'nice'] },
  { cc: '🇬🇧', nm: 'Великобритания', iso: 'GBR', cities: ['london', 'manchester', 'birmingham', 'liverpool', 'edinburgh'] },
  { cc: '🇳🇱', nm: 'Нидерландия', iso: 'NLD', cities: ['amsterdam', 'rotterdam', 'hague', 'utrecht', 'eindhoven'] },
  { cc: '🇧🇪', nm: 'Белгия', iso: 'BEL', cities: ['brussels', 'antwerp', 'ghent', 'liege', 'bruges'] },
  { cc: '🇱🇺', nm: 'Люксембург', iso: 'LUX', cities: ['luxembourg'] },
  { cc: '🇩🇪', nm: 'Германия', iso: 'DEU', cities: ['berlin', 'munich', 'hamburg', 'frankfurt', 'cologne'] },
  { cc: '🇨🇿', nm: 'Чехия', iso: 'CZE', cities: ['prague', 'brno', 'ostrava', 'plzen', 'olomouc'] },
  { cc: '🇦🇹', nm: 'Австрия', iso: 'AUT', cities: ['vienna', 'graz', 'linz', 'salzburg', 'innsbruck'] },
  { cc: '🇭🇺', nm: 'Унгария', iso: 'HUN', cities: ['budapest', 'debrecen', 'szeged', 'pecs', 'gyor'] },
  { cc: '🇵🇱', nm: 'Полша', iso: 'POL', cities: ['warsaw', 'krakow', 'gdansk', 'wroclaw', 'poznan'] },
  { cc: '🇮🇹', nm: 'Италия', iso: 'ITA', cities: ['rome', 'milan', 'naples', 'turin', 'florence'] },
  { cc: '🇪🇸', nm: 'Испания', iso: 'ESP', cities: ['madrid', 'barcelona', 'valencia', 'seville', 'bilbao'] },
  { cc: '🇨🇭', nm: 'Швейцария', iso: 'CHE', cities: ['zurich', 'geneva', 'basel', 'bern', 'lausanne'] },
  { cc: '🇺🇸', nm: 'САЩ', iso: 'USA', cities: ['newyork', 'losangeles', 'chicago', 'sanfrancisco', 'miami'] },
  { cc: '🇨🇦', nm: 'Канада', iso: 'CAN', cities: ['toronto', 'montreal', 'vancouver', 'calgary', 'ottawa'] },
  { cc: '🇲🇽', nm: 'Мексико', iso: 'MEX', cities: ['mexicocity', 'guadalajara', 'monterrey', 'cancun', 'puebla'] },
  { cc: '🇧🇷', nm: 'Бразилия', iso: 'BRA', cities: ['saopaulo', 'rio', 'brasilia', 'salvador', 'fortaleza'] },
  { cc: '🇦🇷', nm: 'Аржентина', iso: 'ARG', cities: ['buenosaires', 'cordoba', 'rosario', 'mendoza', 'mardelplata'] },
  { cc: '🇪🇬', nm: 'Египет', iso: 'EGY', cities: ['cairo', 'alexandria', 'giza', 'luxor', 'aswan'] },
  { cc: '🇿🇦', nm: 'ЮАР', iso: 'ZAF', cities: ['capetown', 'johannesburg', 'durban', 'pretoria', 'portelizabeth'] },
  { cc: '🇦🇪', nm: 'ОАЕ', iso: 'ARE', cities: ['dubai', 'abudhabi', 'sharjah', 'ajman', 'alain'] },
  { cc: '🇮🇳', nm: 'Индия', iso: 'IND', cities: ['mumbai', 'delhi', 'bangalore', 'chennai', 'kolkata'] },
  { cc: '🇸🇬', nm: 'Сингапур', iso: 'SGP', cities: ['singapore'] },
  { cc: '🇨🇳', nm: 'Китай', iso: 'CHN', cities: ['beijing', 'shanghai', 'hongkong', 'guangzhou', 'shenzhen'] },
  { cc: '🇰🇷', nm: 'Южна Корея', iso: 'KOR', cities: ['seoul', 'busan', 'incheon', 'daegu', 'daejeon'] },
  { cc: '🇯🇵', nm: 'Япония', iso: 'JPN', cities: ['tokyo', 'osaka', 'kyoto', 'yokohama', 'sapporo'] },
  { cc: '🇦🇺', nm: 'Австралия', iso: 'AUS', cities: ['sydney', 'melbourne', 'brisbane', 'perth', 'adelaide'] },
];
export const countryOfCity = id => COUNTRIES.find(k => k.cities.includes(id)) || null;
// isDone(cityId) → завършен ли е; връща { done, total, won }
export function countryProgress(k, isDone) { const done = k.cities.filter(isDone).length; return { done, total: k.cities.length, won: done >= k.cities.length }; }
export const wonCountries = isDone => COUNTRIES.filter(k => countryProgress(k, isDone).won);
// бонус към дневния приход на завършен град (1.1, ако държавата му е завладяна)
export const wonIncomeMul = (cityId, isDone) => { const k = countryOfCity(cityId); return k && countryProgress(k, isDone).won ? 1 + WON_INCOME : 1; };
// етикет на държавата на картата: средата на ключовите градове
export function countryLabelLL(k, cityById) { const cs = k.cities.map(cityById).filter(Boolean); return [cs.reduce((a, x) => a + x.lon, 0) / cs.length, cs.reduce((a, x) => a + x.lat, 0) / cs.length]; }
