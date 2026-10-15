// economy.js — парите на фирмата: покупки, заплати, гориво, кредити, плащания за обекти.
// ИНТЕРФЕЙС: game.js вика само експортираните неща по-долу. Вътрешността може да се развива свободно.
// Всички суми са в евро.

// Видове техника/хора, които фирмата може да купи
export const UNIT_TYPES = {
  crew:    { nm: 'Бригада',  ico: '👷', cost: 9000,  upkeep: 250, desc: 'Бус с 4 работници. Нужна е на всеки етап.' },
  loader:  { nm: 'Багер',    ico: '🚜', cost: 22000, upkeep: 120, desc: 'Изкопи и земни работи.' },
  truck:   { nm: 'Самосвал', ico: '🚚', cost: 15000, upkeep: 90,  desc: 'Извозва пръст и докарва бетон за основите.' },
  tractor: { nm: 'Трактор',  ico: '🚜', cost: 8000,  upkeep: 50,  desc: 'Подравняване и озеленяване накрая.' },
  crane:   { nm: 'Кран',     ico: '🏗️', cost: 45000, upkeep: 220, desc: 'Кула-кран за конструкцията на големи сгради.' },
  // пътна техника за магистралите (road: true — живее в гаража, работи по участъците)
  grader:  { nm: 'Грейдер',            ico: '🚜', cost: 38000, upkeep: 160, road: true, desc: 'Подравнява земното легло на магистралата.' },
  bulldozer: { nm: 'Булдозер',         ico: '🚜', cost: 42000, upkeep: 170, road: true, desc: 'Тежки земни работи и насипи по трасето.' },
  paver:   { nm: 'Асфалтополагач',     ico: '🛣️', cost: 85000, upkeep: 300, road: true, desc: 'Полага асфалта на платната.' },
  roller:  { nm: 'Валяк',              ico: '🛞', cost: 30000, upkeep: 120, road: true, desc: 'Уплътнява основата и пресния асфалт.' },
  marker:  { nm: 'Маркировъчна машина', ico: '〰️', cost: 22000, upkeep: 90, road: true, desc: 'Боядисва маркировката и слага мантинели.' },
};

export const START = { money: 20000, units: ['crew', 'loader', 'truck'] };
export const FUEL_PER_M = 0.04;            // € на метър път
export const LOAN_STEP = 50000;
export const LOAN_DAILY_RATE = 0.003;      // 0.3% на ден
// инвестиционен кредит (за покупки: филиали, пристанища, летища, кораби…): до 60% от нетната стойност,
// 10% лихва за целия срок, изплаща се сам на равни дневни вноски за INV_DAYS дни; може да се погаси предсрочно без лихвата за остатъка
export const INV_LTV = 0.6, INV_RATE = 0.10, INV_DAYS = 120;
// по-голям кредит = по-голяма лихва: делът на целия дълг спрямо нетната стойност → [лихва за срока, дни]
export const INV_TIERS = [[0.6, 0.10, 120], [1.2, 0.20, 150], [2.5, 0.35, 180]];
export const OVERDRAFT_DAILY_RATE = 0.01;  // 1% на ден върху отрицателна наличност
export const SELL_FACTOR = 0.5;            // техниката се продава за половин цена
export const BANKRUPT_AT = -30000;

// ориентировъчни цени на поръчките (game.js може да ги ползва чрез quoteReward)
export const PROJECT_PRICES = {
  house:  { base: 28000,  days: 6,  rep: 0.3 },
  shop:   { base: 75000,  days: 10, rep: 0.5 },
  office: { base: 150000, days: 16, rep: 0.8 },
  tower:  { base: 320000, days: 26, rep: 1.2 },
};
// цена на поръчка: ±15% случайно, +4% за всяка звезда репутация, закръглено до 500 €
export function quoteReward(kind, rep = 0, rnd = Math.random) {
  const p = PROJECT_PRICES[kind];
  if (!p) return 0;
  return Math.round(p.base * (0.85 + 0.3 * rnd()) * (1 + 0.04 * rep) / 500) * 500;
}

// ============================================================ Фаза 2–3: материали, заводи, филиали
// Материали: buyPrice е местната пазарна цена (скъпа) за единица — с нея се купува във Фаза 2.
export const MATERIALS = {
  sand:     { nm: 'Пясък',            ico: '🟨', unit: 'т',        buyPrice: 25 },
  gravel:   { nm: 'Чакъл',            ico: '🪨', unit: 'т',        buyPrice: 30 },
  concrete: { nm: 'Бетон',            ico: '⚪', unit: 'м³',       buyPrice: 110 },
  bricks:   { nm: 'Тухли',            ico: '🧱', unit: 'хил. бр.', buyPrice: 400 },
  steel:    { nm: 'Стомана',          ico: '🔩', unit: 'т',        buyPrice: 900 },
  wood:     { nm: 'Дървен материал',  ico: '🪵', unit: 'м³',       buyPrice: 280 },
  glass:    { nm: 'Стъкло',           ico: '🪟', unit: 'м²',       buyPrice: 45 },
  // внос от съседните страни — на местния пазар е скъп
  furniture: { nm: 'Обзавеждане',     ico: '🛋️', unit: 'к-т',      buyPrice: 350 },
  marble:   { nm: 'Мрамор',           ico: '🏛️', unit: 'м²',       buyPrice: 120 },
};
export const DELIVERY_FEE = { base: 80, rate: 0.03 };   // местна доставка с камион: 80 € + 3% от стойността
// Отстъпка от цената, когато има готова връзка от града на доставчика до обекта (целият път — само жп или само магистрала).
// Не се събират: печели по-добрата. С жп или магистрала няма такса за доставка с камион.
export const RAIL_DISCOUNT = 0.40, ROAD_DISCOUNT = 0.25, AB_DISCOUNT = 0.30;   // баланс: жп линия се изплаща за ~15–20 обекта
// Депозит в банката: 1% на месец (30 дни). Лихвата се натрупва всеки ден и в края на месеца става за взимане.
export const DEPOSIT_MONTHLY = 0.01, DEPOSIT_MONTH_DAYS = 30;   // DEPOSIT_MONTHLY — остаряло, лихвата идва от DEP_TIERS
// Лихвата е по стъпала (като данъчни скоби): първият 1 млн. носи 5% на месец, от 1 до 10 млн. — 3%, над 10 млн. — 2%.
export const DEP_TIERS = [[1000000, 0.05], [10000000, 0.03], [Infinity, 0.02]];
export const depInterest = amt => { let r = 0, lo = 0; for (const [hi, p] of DEP_TIERS) { if (amt <= lo) break; r += (Math.min(amt, hi) - lo) * p; lo = hi; } return r; };
// Борса: измислени български фирми. Цената се движи всеки ден (случайно + тенденция); vol = дневна волатилност,
// drift = средно поскъпване на ден, div = месечен дивидент като дял от цената.
export const COMPANIES = [
  { id: 'bulstroy',  nm: '„Булстрой“ АД',            ico: '🏗️', sector: 'строителство', price: 42,  vol: 0.022, drift: 0.0008, div: 0.004, shares: 120000, subDaily: 9000,  gets: '3 бригади, кран, 2 самосвала и 2 офис сгради' },
  { id: 'dunav',     nm: '„Дунав Логистик“ АД',      ico: '🚢', sector: 'транспорт',    price: 18,  vol: 0.018, drift: 0.0005, div: 0.005, shares: 250000, subDaily: 7000,  gets: 'пълен склад с материали, 3 самосвала и 2 търговски сгради' },
  { id: 'energy',    nm: '„Черноморска енергия“ АД', ico: '⚡', sector: 'енергетика',   price: 65,  vol: 0.012, drift: 0.0004, div: 0.007, shares: 90000,  subDaily: 16000, gets: 'соларни паркове (голям дневен приход) и офис сграда' },
  { id: 'agro',      nm: '„Тракия Агро“ АД',         ico: '🌾', sector: 'земеделие',    price: 12,  vol: 0.025, drift: 0.0003, div: 0.003, shares: 300000, subDaily: 5000,  gets: '6 къщи под наем, 4 празни парцела и трактор' },
  { id: 'tech',      nm: '„Балкан Тех“ АД',          ico: '💻', sector: 'технологии',   price: 95,  vol: 0.035, drift: 0.0012, div: 0,     shares: 60000,  subDaily: 11000, gets: 'офис кула и 2 офис сгради' },
  { id: 'rhodope',   nm: '„Родопа Туризъм“ АД',      ico: '🏔️', sector: 'туризъм',      price: 27,  vol: 0.02,  drift: 0.0006, div: 0.004, shares: 600000, subDaily: 6000,  gets: 'курорт с вилно селище и хотел + 2 туристически агенции' },
];
// Фалит: фирма, чиято акция падне под BUST.below от началната цена, може да фалира (и рядко — изненадващо).
// Тогава цената се срива и BUST.days дни можеш да я изкупиш цялата: взимаш сградите и имуществото ѝ и тя става твоя дъщерна фирма.
export const BUST = { below: 0.45, chanceLow: 0.03, chanceAny: 0.0012, crash: 0.22, days: 30, recover: 0.4 };
export const IPO = { minWorth: 1000000, share: 0.2, premium: 1.5 };   // фирмата ти на борсата: продаваш 20% на 1.5× нетната стойност   // 1% — да не е по-изгодно от строежите
export const RAIL_FEE = 0, ROAD_FEE = 0;   // остарели (вече не се ползват за цената); оставени за съвместимост

// Доставчици: заводи в реални български градове (фиксирани).
export const FACTORIES = [
  { cityId: 'pleven',  cityNm: 'Плевен',       materialId: 'bricks',   nm: 'Тухларна „Плевен“' },
  { cityId: 'varna',   cityNm: 'Варна',        materialId: 'steel',    nm: 'Стоманодобивен завод „Варна“' },
  { cityId: 'stz',     cityNm: 'Стара Загора', materialId: 'concrete', nm: 'Циментов завод „Стара Загора“' },
  { cityId: 'blg',     cityNm: 'Благоевград',  materialId: 'wood',     nm: 'Дъскорезница „Благоевград“' },
  { cityId: 'gabrovo', cityNm: 'Габрово',      materialId: 'wood',     nm: 'Дървопреработване „Габрово“' },
  { cityId: 'ruse',    cityNm: 'Русе',         materialId: 'sand',     nm: 'Дунавски кариери „Русе“ (пясък)' },
  { cityId: 'ruse',    cityNm: 'Русе',         materialId: 'gravel',   nm: 'Дунавски кариери „Русе“ (чакъл)' },
  { cityId: 'shumen',  cityNm: 'Шумен',        materialId: 'glass',    nm: 'Стъкларски завод „Шумен“' },
  // чужбина (градовете са в game.js; жп/магистрала до тях дават отстъпка като у нас)
  { cityId: 'istanbul',     cityNm: 'Истанбул',    materialId: 'furniture', nm: 'Мебелна фабрика „Истанбул“' },
  { cityId: 'athens',       cityNm: 'Атина',       materialId: 'marble',    nm: 'Мраморни кариери „Атина“' },
  { cityId: 'thessaloniki', cityNm: 'Солун',       materialId: 'marble',    nm: 'Мраморни кариери „Солун“' },
  { cityId: 'bucharest',    cityNm: 'Букурещ',     materialId: 'steel',     nm: 'Стоманодобивен комбинат „Букурещ“' },
  { cityId: 'belgrade',     cityNm: 'Белград',     materialId: 'wood',      nm: 'Дървообработване „Белград“' },
  { cityId: 'constanta',    cityNm: 'Констанца',   materialId: 'sand',      nm: 'Пристанищни кариери „Констанца“' },
  // големите градове по света (отключват се с нивото на развитие)
  { cityId: 'milan', cityNm: 'Милано', materialId: 'furniture', nm: 'Мебелна фабрика „Брианца“ — Милано' },
  { cityId: 'warsaw', cityNm: 'Варшава', materialId: 'furniture', nm: 'Мебелна фабрика „Варшава“' },
  { cityId: 'shanghai', cityNm: 'Шанхай', materialId: 'furniture', nm: 'Мебелен комбинат „Шанхай“' },
  { cityId: 'florence', cityNm: 'Флоренция', materialId: 'marble', nm: 'Карарски мраморни кариери' },
  { cityId: 'izmir', cityNm: 'Измир', materialId: 'marble', nm: 'Мраморни кариери „Измир“' },
  { cityId: 'prague', cityNm: 'Прага', materialId: 'glass', nm: 'Бохемско стъкло „Прага“' },
  { cityId: 'guangzhou', cityNm: 'Гуанджоу', materialId: 'glass', nm: 'Стъкларски завод „Гуанджоу“' },
  { cityId: 'dnipro', cityNm: 'Днипро', materialId: 'steel', nm: 'Металургичен комбинат „Днипро“' },
  { cityId: 'yekaterinburg', cityNm: 'Екатеринбург', materialId: 'steel', nm: 'Уралска стомана „Екатеринбург“' },
  { cityId: 'chicago', cityNm: 'Чикаго', materialId: 'steel', nm: 'Стоманени заводи „Чикаго“' },
  { cityId: 'mumbai', cityNm: 'Мумбай', materialId: 'steel', nm: 'Стоманодобивен завод „Мумбай“' },
  { cityId: 'busan', cityNm: 'Пусан', materialId: 'steel', nm: 'Стоманен комбинат „Пусан“' },
  { cityId: 'novosibirsk', cityNm: 'Новосибирск', materialId: 'wood', nm: 'Сибирски дървен материал „Новосибирск“' },
  { cityId: 'vancouver', cityNm: 'Ванкувър', materialId: 'wood', nm: 'Дъскорезници „Ванкувър“' },
  { cityId: 'stpetersburg', cityNm: 'Санкт Петербург', materialId: 'wood', nm: 'Карелски дървен материал „Санкт Петербург“' },
  { cityId: 'monterrey', cityNm: 'Монтерей', materialId: 'concrete', nm: 'Циментов завод „Монтерей“' },
  { cityId: 'beijing', cityNm: 'Пекин', materialId: 'concrete', nm: 'Циментов завод „Пекин“' },
  { cityId: 'moscow', cityNm: 'Москва', materialId: 'bricks', nm: 'Тухларна „Москва“' },
  { cityId: 'hamburg', cityNm: 'Хамбург', materialId: 'sand', nm: 'Пясъчни кариери на Елба „Хамбург“' },
  { cityId: 'alexandria', cityNm: 'Александрия', materialId: 'sand', nm: 'Пясък от делтата на Нил „Александрия“' },
  { cityId: 'innsbruck', cityNm: 'Инсбрук', materialId: 'gravel', nm: 'Алпийски кариери „Инсбрук“' },
  { cityId: 'calgary', cityNm: 'Калгари', materialId: 'gravel', nm: 'Кариери в Скалистите планини „Калгари“' },
  { cityId: 'lagos', cityNm: 'Лагос', materialId: 'concrete', nm: 'Циментов завод „Лагос“' },
  { cityId: 'cairo', cityNm: 'Кайро', materialId: 'concrete', nm: 'Циментов завод „Кайро“' },
  { cityId: 'delhi', cityNm: 'Делхи', materialId: 'concrete', nm: 'Циментов завод „Делхи“' },
  { cityId: 'dhaka', cityNm: 'Дака', materialId: 'bricks', nm: 'Тухларни „Дака“' },
  { cityId: 'manchester', cityNm: 'Манчестър', materialId: 'bricks', nm: 'Тухларна „Манчестър“ (червени тухли)' },
  { cityId: 'osaka', cityNm: 'Осака', materialId: 'steel', nm: 'Стоманени заводи „Осака“' },
  { cityId: 'johannesburg', cityNm: 'Йоханесбург', materialId: 'steel', nm: 'Стоманодобивен комбинат „Йоханесбург“' },
  { cityId: 'saopaulo', cityNm: 'Сао Пауло', materialId: 'steel', nm: 'Стоманодобивен завод „Сао Пауло“' },
  { cityId: 'kotakinabalu', cityNm: 'Кота Кинабалу', materialId: 'wood', nm: 'Тропически дървен материал „Борнео“' },
  { cityId: 'kinshasa', cityNm: 'Киншаса', materialId: 'wood', nm: 'Дървен материал от Конго „Киншаса“' },
  { cityId: 'hobart', cityNm: 'Хобарт', materialId: 'wood', nm: 'Тасманийски дървен материал „Хобарт“' },
  { cityId: 'lviv', cityNm: 'Лвов', materialId: 'wood', nm: 'Карпатски дървен материал „Лвов“' },
  { cityId: 'brno', cityNm: 'Бърно', materialId: 'glass', nm: 'Чешко стъкло „Бърно“' },
  { cityId: 'istanbul', cityNm: 'Истанбул', materialId: 'glass', nm: 'Стъкларски завод „Истанбул“' },
  { cityId: 'rome', cityNm: 'Рим', materialId: 'marble', nm: 'Травертинови кариери „Рим“' },
  { cityId: 'guadalajara', cityNm: 'Гуадалахара', materialId: 'furniture', nm: 'Мебелна фабрика „Гуадалахара“' },
  { cityId: 'hochiminh', cityNm: 'Хошимин', materialId: 'furniture', nm: 'Мебелна фабрика „Хошимин“' },
  { cityId: 'kualalumpur', cityNm: 'Куала Лумпур', materialId: 'furniture', nm: 'Мебелна фабрика „Куала Лумпур“' },
];
// само за показване (вече не влиза в цената)
for (const f of FACTORIES) f.factoryPrice = MATERIALS[f.materialId].buyPrice;
const round2 = n => Math.round(n * 100) / 100;

// заводът за материала в един от дадените градове (първият), или null
export function factoryFor(matId, connectedCityIds = []) {
  return FACTORIES.find(f => f.materialId === matId && connectedCityIds.includes(f.cityId)) || null;
}
// отстъпката за материала: { pct: 0 | 0.05 | 0.1, via: 'rail' | 'road' | null, cityId }
// connected = градове с готова жп връзка, opts.roadCityIds = с готова магистрала (и двете — BFS от текущия град)
export function transportDiscount(matId, connectedCityIds = [], opts = {}) {
  const rail = factoryFor(matId, connectedCityIds);
  if (rail) return { pct: RAIL_DISCOUNT, via: 'rail', cityId: rail.cityId };
  // аутобан (Фаза 9): по-добра от магистрала, но под жп; opts.abCityIds = градове с готов аутобан до текущия
  const ab = factoryFor(matId, opts.abCityIds || []);
  if (ab) return { pct: AB_DISCOUNT, via: 'road', cityId: ab.cityId, ab: true };
  const road = factoryFor(matId, opts.roadCityIds || []);
  if (road) return { pct: ROAD_DISCOUNT, via: 'road', cityId: road.cityId };
  const any = FACTORIES.find(f => f.materialId === matId);
  return { pct: 0, via: null, cityId: any ? any.cityId : null };
}
// доставчикът, който дава най-добра отстъпка при тези връзки (или първият за материала): { cityId, nm, cityNm }
export function supplierOf(matId, connectedCityIds = [], opts = {}) {
  const d = transportDiscount(matId, connectedCityIds, opts), f = FACTORIES.find(x => x.materialId === matId && x.cityId === d.cityId);
  return f ? { cityId: f.cityId, nm: f.nm, cityNm: f.cityNm } : null;
}
// как идва материалът: 'rail', 'road' или 'market' (местен пазар с доставка)
export function supplyOf(matId, connectedCityIds = [], opts = {}) {
  return transportDiscount(matId, connectedCityIds, opts).via || 'market';
}
// временни промени в цените (от събитията): { matId: { mul, until } } — сочи към econ.s.priceMods на активната игра
let PRICE_MODS = {};
export const priceMul = matId => (PRICE_MODS[matId] && PRICE_MODS[matId].mul) || 1;
// цена за единица: пазарната (× събитие, ако има) минус отстъпката за транспорт
export const WON_MAT_DISC = 0.10;   // −10% за материалите от заводите в завладяна държава (countries.js)
export function materialPrice(matId, connectedCityIds = [], opts = {}) {
  const d = transportDiscount(matId, connectedCityIds, opts), won = d.cityId && (opts.wonCityIds || []).includes(d.cityId) ? WON_MAT_DISC : 0;
  return round2(MATERIALS[matId].buyPrice * priceMul(matId) * (1 - d.pct) * (1 - won));
}

// Нужди по етапи [Изкоп, Основи, Конструкция, Довършване]. Къщата е ~33% от наградата в материали (по пазарна цена);
// по-големите сгради са кратни на нея, с повече стомана, бетон и стъкло.
const HOUSE_STAGES = [
  {},
  { concrete: 25, gravel: 15, sand: 10 },
  { bricks: 6, steel: 1, concrete: 5 },
  { wood: 3, sand: 8, glass: 20 },
];
const scaleStages = (k, extra = {}, glass = 0) => HOUSE_STAGES.map((st, i) => {
  const o = {};
  for (const [m, q] of Object.entries(st)) o[m] = Math.round(q * k);
  if (i === 2) for (const [m, q] of Object.entries(extra)) o[m] = (o[m] || 0) + q;
  if (i === 3 && glass) o.glass += glass;
  return o;
});
// вносни материали в довършването (етап 3) на по-големите сгради
const finish = (stages, extra) => { stages[3] = { ...stages[3], ...extra }; return stages; };
export const STAGE_MATERIALS = {
  house:  HOUSE_STAGES,                                                                  // ~9 240 € от 28 000 €    (≈33%)
  shop:   finish(scaleStages(2.6), { furniture: 4, marble: 8 }),                         // ~26 965 € от 75 000 €   (≈36%)
  office: finish(scaleStages(5, { steel: 4 }, 30), { furniture: 4, marble: 10 }),        // ~53 750 € от 150 000 €  (≈36%)
  tower:  finish(scaleStages(10, { steel: 12 }, 100), { furniture: 12, marble: 25 }),    // ~114 900 € от 320 000 € (≈36%)
};

// Филиал в друг град: 150 000 € за първия, ×1.5 за всеки следващ; големите градове са по-скъпи
export const BRANCH_UPKEEP = 600;   // € на ден за всеки филиал
const CITY_FACTOR = { sofia: 1.4, plovdiv: 1.2, varna: 1.2, burgas: 1.1, 'софия': 1.4, 'пловдив': 1.2, 'варна': 1.2, 'бургас': 1.1 };
// градове в съседните страни: филиал там е 2.5 пъти по-скъп
export const FOREIGN_CITIES = ['istanbul', 'edirne', 'ankara', 'bucharest', 'constanta', 'belgrade', 'nis', 'athens', 'thessaloniki', 'skopje'];
const FOREIGN = new Set(FOREIGN_CITIES);
export function BRANCH_COST(cityId, nOwned = 0) {
  const id = String(cityId).toLowerCase(), f = FOREIGN.has(id) ? 2.5 : CITY_FACTOR[id] || 1;
  // първите 6 филиала поскъпват ×1.4 всеки, после само +10% на филиал (иначе с 15+ филиала стават стотици милиони)
  const grow = Math.pow(1.4, Math.min(nOwned, 6)) * (1 + 0.1 * Math.max(0, nOwned - 6));
  return Math.round(150000 * grow * f / 5000) * 5000;
}

// категории в счетоводната книга
export const CATS = {
  'обект':    { ico: '🏠', nm: 'Обекти' },
  'покупка':  { ico: '🛒', nm: 'Покупки' },
  'продажба': { ico: '🏷️', nm: 'Продажби' },
  'заплати':  { ico: '👷', nm: 'Заплати и поддръжка' },
  'гориво':   { ico: '⛽', nm: 'Гориво' },
  'лихва':    { ico: '🏦', nm: 'Лихви' },
  'кредит':   { ico: '💳', nm: 'Кредит' },
  'депозит':  { ico: '🏦', nm: 'Депозит' },
  'лихва+':   { ico: '💰', nm: 'Лихва по депозит' },
  'акции':    { ico: '📈', nm: 'Акции (покупка/продажба)' },
  'дивиденти': { ico: '💵', nm: 'Дивиденти' },
  'дъщерни':  { ico: '🏢', nm: 'Дъщерни фирми' },
  'полети':   { ico: '✈️', nm: 'Полети' },
  'гаранция': { ico: '🔐', nm: 'Гаранции за търгове' },
  'кораби':   { ico: '🚢', nm: 'Кораби' },
  'борса':    { ico: '🔔', nm: 'Борса (IPO)' },
  'глоба':    { ico: '⚠️', nm: 'Глоби' },
  'материали':   { ico: '🧱', nm: 'Материали' },
  'филиали':  { ico: '🏢', nm: 'Филиали' },
  'курорти':  { ico: '🏔️', nm: 'Курорти' },
  'градове':  { ico: '🏁', nm: 'Завършени градове' },
  'филиал±':  { ico: '🏢', nm: 'Продажба на филиал' },
  'превози':  { ico: '🚚', nm: 'Превози (влакове, ТИР-ове)' },
  'тол':      { ico: '🛣️', nm: 'Тол такси' },
  'наеми':    { ico: '🔑', nm: 'Наеми от имоти' },
  'петрол':   { ico: '🛢️', nm: 'Петрол' },
  'придобивания': { ico: '🏢', nm: 'Придобити фирми' },
  'друго':    { ico: '📄', nm: 'Друго' },
};
// кредитът не е нито приход, нито разход — в отчета за печалбата не влиза
const NOT_PNL = new Set(['кредит', 'депозит', 'акции', 'борса']);   // местене на пари, не печалба/загуба
const HISTORY_DAYS = 60, LEDGER_MAX = 300;

const emptyDay = () => ({ in: 0, out: 0, cats: {} });
export function newEconState() {
  return { money: START.money, loan: 0, day: 1, ledger: [], today: emptyDay(), history: [], fuelAcc: 0, totals: { in: 0, out: 0 }, stock: {}, transit: [], orderSeq: 1, deposit: 0, depAccrued: 0, depReady: 0, depDays: 0, market: null, shares: {}, worthHist: [], topProjects: [] };
}

const newMarket = () => ({ mood: 0, shock: null, c: Object.fromEntries(COMPANIES.map(c => [c.id, { price: c.price, hist: [c.price] }])) });

export class Economy {
  // s: състоянието (сериализира се в записа), hooks: { toast(text, kind) }
  constructor(s, hooks = {}) {
    // стари записи: допълваме липсващите полета
    const d = newEconState();
    for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
    if (!s.today.cats) s.today.cats = {};
    if (!s.stock) s.stock = {};
    if (!s.transit) s.transit = [];
    if (!s.orderSeq) s.orderSeq = 1;
    for (const k of ['deposit', 'depAccrued', 'depReady', 'depDays']) if (s[k] == null) s[k] = 0;
    if (!s.shares) s.shares = {};
    if (!s.worthHist) s.worthHist = [];
    if (!s.topProjects) s.topProjects = [];
    if (!s.market) s.market = newMarket();
    if (!s.priceMods) s.priceMods = {};
    if (!s.cityEarn) s.cityEarn = {};   // { cityId: { ден: сума } } — оборот от обекти по градове (последните 60 дни)
    if (!s.finished) s.finished = {};   // { cityId: { share, daily, day, stats } } — завършени градове на автоматичен приход
    PRICE_MODS = s.priceMods;
    for (const c of COMPANIES) if (!s.market.c[c.id]) s.market.c[c.id] = { price: c.price, hist: [c.price] };
    this.s = s; this.hooks = hooks;
    if (typeof document !== 'undefined') setTimeout(() => depositButton(this), 0);   // готова лихва от записа
  }
  get money() { return this.s.money; }
  get loan() { return this.s.loan; }
  canAfford(n) { return this.s.money >= n; }

  // amount > 0 е приход, < 0 разход
  _log(amount, cat, note) {
    amount = Math.round(amount);
    if (!amount) return;
    this.s.ledger.push({ day: this.s.day, amount, cat, note });
    if (this.s.ledger.length > LEDGER_MAX) this.s.ledger.splice(0, this.s.ledger.length - LEDGER_MAX);
    if (NOT_PNL.has(cat)) return;
    const t = this.s.today;
    if (amount >= 0) { t.in += amount; this.s.totals.in += amount; } else { t.out -= amount; this.s.totals.out -= amount; }
    t.cats[cat] = (t.cats[cat] || 0) + amount;
  }
  spend(n, cat = 'друго', note = '') { this.s.money -= n; this._log(-n, cat, note); return true; }
  // opts.city: истински обект в града — само той влиза в оборота на града и в най-печелившите (тол, наеми, превози и мегапроекти — не)
  earn(n, cat = 'друго', note = '', opts = {}) {
    this.s.money += n; this._log(n, cat, note);
    if (cat === 'обект' && n > 0 && opts.city && this.cityId) {   // оборот по градове (за автоматичния приход след завършване)
      const ce = this.s.cityEarn[this.cityId] || (this.s.cityEarn[this.cityId] = {});
      ce[this.s.day] = (ce[this.s.day] || 0) + Math.round(n);
      for (const d of Object.keys(ce)) if (+d < this.s.day - 60) delete ce[d];
    }
    if (cat === 'обект' && n > 0 && opts.city) {   // най-печелившите обекти (за статистиката)
      const tp = this.s.topProjects; tp.push({ note, amount: Math.round(n), day: this.s.day });
      tp.sort((a, b) => b.amount - a.amount); if (tp.length > 10) tp.length = 10;
    }
  }

  buyUnit(type) {
    const t = UNIT_TYPES[type];
    if (!t || !this.canAfford(t.cost)) return false;
    this.spend(t.cost, 'покупка', t.nm);
    return true;
  }
  sellPrice(type) { return Math.round(UNIT_TYPES[type].cost * SELL_FACTOR); }
  // game.js маха единицата от парка; тук само плащаме
  sellUnit(type) {
    const p = this.sellPrice(type);
    this.earn(p, 'продажба', UNIT_TYPES[type].nm);
    return p;
  }

  // горивото се плаща веднага, а в книгата влиза като един ред на ден
  addFuel(meters) {
    const c = meters * FUEL_PER_M;
    this.s.money -= c;
    this.s.fuelAcc += c;
  }

  // в края на всеки ден: заплати/поддръжка, гориво, лихви. unitTypes: масив от типове ('crew', ...)
  // opts (по желание): { branches: брой филиали } — тяхната поддръжка
  dailyTick(day, unitTypes = [], opts = {}) {
    this.s.day = day;
    let upkeep = 0;
    for (const t of unitTypes) upkeep += UNIT_TYPES[t] ? UNIT_TYPES[t].upkeep : 0;
    if (upkeep) this.spend(upkeep, 'заплати', `Заплати и поддръжка (${unitTypes.length} бр.)`);
    const br = (opts.branches || 0) * BRANCH_UPKEEP;
    if (br) this.spend(br, 'филиали', `Филиали (${opts.branches} бр.)`);
    upkeep += br;
    const fuel = Math.round(this.s.fuelAcc);
    if (fuel) { this.s.money += this.s.fuelAcc; this.spend(fuel, 'гориво', 'Гориво за деня'); }   // вече е платено — само го записваме
    this.s.fuelAcc = 0;
    const interest = Math.round(this.s.loan * LOAN_DAILY_RATE);
    if (interest) this.spend(interest, 'лихва', 'Лихва по кредита');
    this.invTick(); this.liqTick();
    const over = this.s.money < 0 ? Math.round(-this.s.money * OVERDRAFT_DAILY_RATE) : 0;
    if (over) this.spend(over, 'лихва', 'Лихва за овърдрафт');

    // депозит: лихвата расте всеки ден; на всеки 30 дни се прехвърля в „за взимане“
    // завършените градове носят автоматичен приход (opts.activeCity = градът, в който си)
    if (opts.activeCity !== undefined || this.cityId) this.payFinished(opts.activeCity ?? this.cityId);
    // временните цени от събитията изтичат
    for (const [m, x] of Object.entries(this.s.priceMods)) if (x.until <= day) delete this.s.priceMods[m];
    // борса: цените се движат, а веднъж месечно се плащат дивиденти
    this.marketTick(day);
    // нетна стойност във времето (за графиката)
    this.s.worthHist.push([day, this.netWorth(unitTypes)]);
    if (this.s.worthHist.length > 400) this.s.worthHist.splice(0, this.s.worthHist.length - 400);

    // лихвата по депозита се трупа всеки ден направо в „готова“ — взима се когато поискаш
    if (this.s.deposit > 0 || this.s.depAccrued > 0) {
      this.s.depAccrued += depInterest(this.s.deposit) / DEPOSIT_MONTH_DAYS;
      const whole = Math.floor(this.s.depAccrued);
      if (whole > 0) { this.s.depReady += whole; this.s.depAccrued -= whole; }
      this.s.depDays = 0;
      depositButton(this);
    }

    const t = this.s.today;
    const sum = { day, in: t.in, out: t.out, net: t.in - t.out, money: Math.round(this.s.money), loan: this.s.loan, cats: t.cats, upkeep, fuel, interest: interest + over };
    this.s.history.push(sum);
    if (this.s.history.length > HISTORY_DAYS) this.s.history.shift();
    this.s.today = emptyDay();
    this.s.day = day + 1;

    // минусът и фалитът — bankrupt.js (предупреждения, несъстоятелност, синдик)
    return sum;
  }

  // кредитна линия: расте с репутацията (rep = звезди 0–5)
  // ---- инвестиционни кредити: s.inv = [{ note, amount, left (главница), daily (вноска), interest (за вноска) }]
  invDebt() { return Math.round((this.s.inv || []).reduce((a, l) => a + l.left, 0)); }
  invMax(unitTypes = []) { return Math.max(0, Math.round((this.netWorth(unitTypes) * INV_TIERS[INV_TIERS.length - 1][0] - this.invDebt()) / 10000) * 10000); }
  // условията за нов кредит от amount: според общия дълг след него спрямо нетната стойност
  invTerms(amount, unitTypes = []) { const nw = Math.max(1, this.netWorth(unitTypes)), r = (this.invDebt() + amount) / nw; const t = INV_TIERS.find(x => r <= x[0]); return t ? { rate: t[1], days: t[2], ratio: r } : null; }
  invTake(amount, note = 'покупка', rate = INV_RATE, days = INV_DAYS) {
    amount = Math.ceil(amount / 10000) * 10000;
    const l = { note, amount, left: amount, daily: Math.ceil(amount / days), interest: Math.ceil(amount * rate / days), rate, day: this.s.day };
    (this.s.inv = this.s.inv || []).push(l);
    this.earn(amount, 'кредит', `Инвестиционен кредит: ${note}`);
    return amount;
  }
  invTick() {
    for (const l of [...(this.s.inv || [])]) {
      const p = Math.min(l.left, l.daily);
      this.spend(p, 'кредит', `Вноска по кредит: ${l.note}`); this.spend(l.interest, 'лихва', `Лихва по кредит: ${l.note}`);
      l.left -= p;
      if (l.left <= 0) { this.s.inv.splice(this.s.inv.indexOf(l), 1); if (this.hooks.toast) this.hooks.toast(`🏦 Изплати кредита за „${l.note}“!`, 'good'); }
    }
  }
  invRepay(i) { const l = (this.s.inv || [])[i]; if (!l || !this.canAfford(l.left)) return 0; this.spend(l.left, 'кредит', `Предсрочно погасяване: ${l.note}`); this.s.inv.splice(i, 1); return l.left; }
  // лимит за кредит: расте с репутацията и с нетната стойност — от 1× (0 ★) до 2× нетната стойност (5 ★); най-малко старият лимит
  maxLoan(rep = 0) {
    const h = this.s.worthHist, nw = h && h.length ? Math.max(0, h[h.length - 1][1]) : 0;
    return Math.max(LOAN_STEP * (2 + Math.floor(rep)), Math.round(nw * (1 + Math.min(5, Math.max(0, rep)) / 5) / 100000) * 100000);
  }
  // стъпката на бутоните: кръгло число (1/2/5 × 10ⁿ) около 5% от лимита
  loanStep(rep = 0) { const x = this.maxLoan(rep) / 20, p = 10 ** Math.floor(Math.log10(Math.max(1, x))), m = x / p; return Math.max(LOAN_STEP, (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p); }
  loanRoom(rep = 0) { return Math.max(0, this.maxLoan(rep) - this.s.loan); }
  canTakeLoan(rep, amt) { amt = amt ?? this.loanStep(rep); return amt > 0 && this.s.loan + amt <= this.maxLoan(rep); }   // и на минус — кредитът е начинът да се спасиш от фалит
  takeLoan(rep, amt) {
    amt = amt ?? this.loanStep(rep);
    if (!this.canTakeLoan(rep, amt)) return 0;
    this.s.loan += amt; this.earn(amt, 'кредит', 'Банков кредит');
    return amt;
  }
  canRepay(amt) { amt = Math.min(amt ?? LOAN_STEP, this.s.loan); return this.s.loan > 0 && this.canAfford(amt); }
  repayLoan(amt) {
    const n = Math.min(amt ?? LOAN_STEP, this.s.loan);
    if (!this.canRepay(n)) return 0;
    this.s.loan -= n; this.spend(n, 'кредит', 'Погасяване на кредит');
    return n;
  }

  // плащане при завършен обект: бонус за предсрочно, глоба за закъснение
  completionPayout(project, day) {
    const late = day - project.deadlineDay;
    let amount = project.reward, repDelta, note;
    if (late > 0) { amount = Math.round(project.reward * Math.max(0.5, 1 - 0.1 * late)); repDelta = -Math.round(Math.min(0.3, 0.03 * late + (project.reward >= 150000 ? 0.1 : 0.05)) * 100) / 100; note = `закъснение ${late} дни`; }   // по-малко наказание: според закъснението и големината (макс. −0.3)
    else if (late <= -2) { amount = Math.round(project.reward * 1.1); repDelta = project.repGain * 1.5; note = 'предсрочно (+10%)'; }
    else { repDelta = project.repGain; note = 'навреме'; }
    this.earn(amount, 'обект', `${project.title} — ${note}`);
    return { amount, repDelta, note };
  }

  // последните n дни; днешният (още незавършен) е последен и е с partial: true
  lastDays(n = 7) {
    const h = this.s.history.slice(-(n - 1));
    const t = this.s.today;
    h.push({ day: this.s.day, in: t.in, out: t.out, net: t.in - t.out, cats: t.cats, partial: true });
    return h;
  }
  // нетно по категории за последните n дни
  byCategory(n = 7) {
    const acc = {};
    for (const d of this.lastDays(n)) for (const [c, v] of Object.entries(d.cats || {})) acc[c] = (acc[c] || 0) + v;
    return acc;
  }
  // нетна стойност: пари − кредит + техниката на половин цена + склада по пазарна цена
  netWorth(unitTypes = []) {
    let fleet = 0;
    for (const t of unitTypes) if (UNIT_TYPES[t]) fleet += this.sellPrice(t);
    return Math.round(this.s.money - this.s.loan - this.invDebt() + fleet + this.stockValue() + this.s.deposit + this.s.depReady + this.portfolioValue() - this.ipoDebt());
  }

  // ---------------------------------------------------------- склад
  stock(matId) { return this.s.stock[matId] || 0; }
  // цена без да купува: { unit, value, fee, total, rail, road } — rail/road: идва от завод с влак / по магистрала
  // opts (по желание): { roadCityIds } — градове с готова магистрала до централата
  quoteMaterial(matId, qty, connectedCityIds = [], opts = {}) {
    const how = supplyOf(matId, connectedCityIds, opts), unit = materialPrice(matId, connectedCityIds, opts), value = unit * qty;
    const fee = qty > 0 && how === 'market' && !opts.noFee ? DELIVERY_FEE.base + value * DELIVERY_FEE.rate : 0;   // opts.noFee — свой ТИР до склада (hwtrucks.js)
    return { unit, value: Math.round(value), fee: Math.round(fee), total: Math.round(value + fee), rail: how === 'rail', road: how === 'road' };
  }
  // купува и слага в склада; връща { ok, cost, rail, road } (ok: false, ако няма пари)
  buyMaterial(matId, qty, connectedCityIds = [], opts = {}) {
    if (!MATERIALS[matId] || qty <= 0) return { ok: false, cost: 0, rail: false, road: false };
    const q = this.quoteMaterial(matId, qty, connectedCityIds, opts);
    if (!this.canAfford(q.total)) return { ok: false, cost: q.total, rail: q.rail, road: q.road };
    const m = MATERIALS[matId];
    this.spend(q.total, 'материали', `${m.nm}: ${qty} ${m.unit}${q.rail ? ' (влак от завода)' : q.road ? ' (камион по магистралата)' : ''}`);
    this.s.stock[matId] = this.stock(matId) + qty;
    return { ok: true, cost: q.total, rail: q.rail, road: q.road };
  }
  // поръчка за склада: плаща се сега, но стоката влиза в склада чак при receive(id) (когато ТИР-ът/влакът стигне)
  // връща { ok, cost, rail, road, order } — order = { id, matId, qty, cost, rail, road }
  orderMaterial(matId, qty, connectedCityIds = [], opts = {}) {
    if (!MATERIALS[matId] || qty <= 0) return { ok: false, cost: 0, rail: false, road: false, order: null };
    const q = this.quoteMaterial(matId, qty, connectedCityIds, opts);
    if (!this.canAfford(q.total)) return { ok: false, cost: q.total, rail: q.rail, road: q.road, order: null };
    const m = MATERIALS[matId];
    this.spend(q.total, 'материали', `${m.nm}: ${qty} ${m.unit} — поръчка${q.rail ? ' (влак)' : q.road ? ' (ТИР по магистралата)' : ' (ТИР)'}`);
    const order = { id: this.s.orderSeq++, matId, qty, cost: q.total, rail: q.rail, road: q.road };
    this.s.transit.push(order);
    return { ok: true, cost: q.total, rail: q.rail, road: q.road, order };
  }
  // ---------- складът е на града: при смяна на града game.js скрива стоката на стария и зарежда тази на новия
  // връща { stock, transit } на текущия град и изпразва склада
  stashStock() {
    const out = { stock: this.s.stock, transit: this.s.transit };
    this.s.stock = {}; this.s.transit = [];
    return out;
  }
  // зарежда склада на града (или празен, ако градът още няма)
  loadStock(obj) {
    this.s.stock = (obj && obj.stock) || {};
    this.s.transit = (obj && obj.transit) || [];
  }
  // поръчката пристига: стоката влиза в склада; връща поръчката или null
  receive(orderId) {
    const i = this.s.transit.findIndex(o => o.id === orderId);
    if (i < 0) return null;
    const o = this.s.transit.splice(i, 1)[0];
    this.s.stock[o.matId] = this.stock(o.matId) + o.qty;
    return o;
  }
  // колко от материала е на път
  inTransit(matId) { return this.s.transit.reduce((a, o) => a + (o.matId === matId ? o.qty : 0), 0); }
  // всичко или нищо
  consume(matId, qty) {
    if (this.stock(matId) < qty) return false;
    this.s.stock[matId] -= qty;
    return true;
  }
  // нуждите на етап: { материал: количество }
  stageNeeds(kind, stage) { return (STAGE_MATERIALS[kind] && STAGE_MATERIALS[kind][stage]) || {}; }
  // стойност на нуждите на етапа без доставка: по пазарна цена или, с connectedCityIds, по най-добрата достъпна
  materialCost(kind, stage, connectedCityIds = [], opts = {}) {
    let v = 0;
    for (const [m, q] of Object.entries(this.stageNeeds(kind, stage))) v += materialPrice(m, connectedCityIds, opts) * q;
    return Math.round(v);
  }
  // какво липсва в склада за етапа: { материал: количество }
  missing(kind, stage) {
    const o = {};
    for (const [m, q] of Object.entries(this.stageNeeds(kind, stage))) if (this.stock(m) < q) o[m] = q - this.stock(m);
    return o;
  }
  // купува липсващото за етапа (отделна доставка за всеки материал); { ok, cost, rail, road }
  buyMissing(kind, stage, connectedCityIds = [], opts = {}) {
    const miss = this.missing(kind, stage);
    let total = 0, rail = false, road = false;
    for (const [m, q] of Object.entries(miss)) { const qt = this.quoteMaterial(m, q, connectedCityIds, opts); total += qt.total; rail ||= qt.rail; road ||= qt.road; }
    if (!this.canAfford(total)) return { ok: false, cost: total, rail, road };
    for (const [m, q] of Object.entries(miss)) this.buyMaterial(m, q, connectedCityIds, opts);
    return { ok: true, cost: total, rail, road };
  }
  // изразходва всички материали на етапа наведнъж; false (и не пипа нищо), ако нещо липсва
  consumeStage(kind, stage) {
    const need = this.stageNeeds(kind, stage);
    for (const [m, q] of Object.entries(need)) if (this.stock(m) < q) return false;
    for (const [m, q] of Object.entries(need)) this.s.stock[m] -= q;
    return true;
  }
  // филиал: плаща BRANCH_COST; true при успех
  openBranch(cityId, nOwned, cityName = cityId) {
    const c = BRANCH_COST(cityId, nOwned);
    if (!this.canAfford(c)) return false;
    this.spend(c, 'филиали', `Нов филиал: ${cityName}`);
    return true;
  }
  stockValue() {
    let v = 0;
    for (const [m, q] of Object.entries(this.s.stock)) if (MATERIALS[m]) v += q * MATERIALS[m].buyPrice;
    return Math.round(v);
  }

  // ---------------------------------------------------------- борса
  price(id) { return this.s.market.c[id].price; }
  // дневно движение: случайно (≈ нормално) × волатилност + тенденция; marketMood идва от събитията (+ или −)
  marketTick(day) {
    const m = this.s.market, mood = m.mood || 0;
    for (const c of COMPANIES) {
      const q = m.c[c.id];
      if ((this.s.subs || {})[c.id]) continue;   // дъщерна фирма — вече не е на борсата
      if (q.bust) { q.price = Math.max(0.5, Math.round(q.price * (1 + (Math.random() - 0.55) * 0.03) * 100) / 100); q.hist.push(q.price); if (q.hist.length > 90) q.hist.shift(); continue; }
      const z = (Math.random() + Math.random() + Math.random() - 1.5) * 2;   // ~N(0,1)
      const shock = (m.shock && (m.shock.sector === c.sector || m.shock.sector === '*')) ? m.shock.pct : 0;
      q.price = Math.max(0.5, Math.round(q.price * (1 + c.drift + mood + shock + z * c.vol) * 100) / 100);
      q.hist.push(q.price); if (q.hist.length > 90) q.hist.shift();
    }
    m.shock = null; m.mood = mood * 0.8;   // ефектът от събитията отшумява
    this.bustTick(day);
    if (day % DEPOSIT_MONTH_DAYS === 0) {   // дивиденти веднъж месечно
      let d = 0;
      for (const c of COMPANIES) if (c.div && this.s.shares[c.id]) d += this.s.shares[c.id].qty * m.c[c.id].price * c.div;
      d = Math.round(d);
      if (d) { this.earn(d, 'дивиденти', 'Дивиденти от акции'); if (this.hooks.toast) this.hooks.toast(`💵 Дивиденти от акциите: +${fmt(d)}`, 'good'); }
      if (this.s.ipo) {   // твоята фирма: цената следва нетната стойност
        this.s.ipo.price = Math.max(1, Math.round(this.netWorth([]) * IPO.premium / this.s.ipo.totalShares * 100) / 100);
        this.s.ipo.hist.push(this.s.ipo.price); if (this.s.ipo.hist.length > 40) this.s.ipo.hist.shift();
      }
    }
  }
  // ---- фалити и изкупуване на цели фирми
  bustTick(day) {
    const m = this.s.market, subs = this.s.subs || (this.s.subs = {}), t = this.hooks.toast;
    let inc = 0;
    for (const c of COMPANIES) {
      const q = m.c[c.id];
      if (subs[c.id]) { inc += c.subDaily; continue; }
      if (q.bust) {
        if (day >= q.bust.until) {   // никой не я изкупи — преструктурира се и пак е на борсата
          delete q.bust; q.price = Math.round(c.price * BUST.recover * 100) / 100;
          if (t) t(`${c.ico} ${c.nm} се преструктурира и пак е на борсата (${q.price.toFixed(2)} €).`, 'info');
        }
        continue;
      }
      if (day < 60 || Object.values(m.c).some(x => x.bust) || (this.hooks.stocksOpen && !this.hooks.stocksOpen())) continue;   // не в началото и не две наведнъж
      if (this.hooks.stockVisible && !this.hooks.stockVisible(c) && !this.s.shares[c.id]) continue;   // чужда фирма от държава, където нямаш филиал
      const low = q.price < c.price * BUST.below;
      if (Math.random() < (low ? BUST.chanceLow : BUST.chanceAny)) this.goBust(c.id, day);
    }
    if (inc) this.earn(inc, 'дъщерни', `Ден ${day}: дъщерни фирми`);
  }
  goBust(id, day = this.s.day) {
    const c = COMPANIES.find(x => x.id === id), q = this.s.market.c[id];
    if (!c || q.bust || (this.s.subs || {})[id]) return false;
    q.price = Math.max(0.5, Math.round(q.price * BUST.crash * 100) / 100); q.hist.push(q.price);
    q.bust = { day, until: day + BUST.days };
    if (this.hooks.toast) this.hooks.toast(`💥 ${c.nm} фалира! ${BUST.days} дни можеш да я изкупиш цялата за ${fmt(this.takeoverPrice(id))} и да вземеш ${c.gets}. Банка → Борса.`, 'bad');
    return true;
  }
  // цената на цялата фирма: всички акции по сегашната цена; твоите акции се приспадат
  takeoverPrice(id) {
    const c = COMPANIES.find(x => x.id === id), q = this.s.market.c[id], mine = (this.s.shares[id] || {}).qty || 0;
    return Math.round(q.price * Math.max(0, c.shares - mine) / 1000) * 1000;
  }
  takeover(id) {
    const c = COMPANIES.find(x => x.id === id), q = this.s.market.c[id];
    if (!c || !q.bust) return 0;
    const cost = this.takeoverPrice(id);
    if (!this.canAfford(cost)) return 0;
    this.spend(cost, 'акции', `Изкупи ${c.nm} (фалит)`);
    delete this.s.shares[id]; delete q.bust;
    (this.s.subs || (this.s.subs = {}))[id] = { day: this.s.day, paid: cost };
    if (this.hooks.takeover) this.hooks.takeover(id, c);
    return cost;
  }
  // ---- разпродажба: бърза (веднага, total) или бавна (s.liq: за days дни на равни части); дъщерната фирма се закрива
  liquidate(id, total, days = 0, label = '') {
    const c = COMPANIES.find(x => x.id === id), sub = (this.s.subs || {})[id], paid = sub ? sub.paid : 0;
    if (this.s.subs) delete this.s.subs[id];
    if (!days) { this.earn(total, 'дъщерни', `Разпродажба: ${c.nm}`); this.liqDone(c, total, paid); return total; }
    (this.s.liq = this.s.liq || []).push({ id, total, left: total, per: Math.ceil(total / days), paid, label });
    if (this.hooks.toast) this.hooks.toast(`💰 Разпродажбата на ${c.nm} започна — ${fmt(total)} за ${days} дни.`, 'good');
    return 0;
  }
  liqDone(c, total, paid) {
    const pr = total - paid;
    if (this.hooks.toast) this.hooks.toast(`💰 Разпродажба на ${c.nm}: +${fmt(total)} (${pr >= 0 ? 'печалба' : 'загуба'} ${fmt(Math.abs(pr))} спрямо цената)`, pr >= 0 ? 'good' : 'bad');
    if (this.hooks.liquidated) this.hooks.liquidated(c, total, pr);
  }
  liqTick() {
    for (const l of [...(this.s.liq || [])]) {
      const n = Math.min(l.left, l.per); l.left -= n;
      this.earn(n, 'дъщерни', `Разпродажба: ${COMPANIES.find(x => x.id === l.id).nm}`);
      if (l.left <= 0) { this.s.liq.splice(this.s.liq.indexOf(l), 1); this.liqDone(COMPANIES.find(x => x.id === l.id), l.total, l.paid); }
    }
  }
  subsDaily() { return COMPANIES.reduce((a, c) => a + ((this.s.subs || {})[c.id] ? c.subDaily : 0), 0); }
  // събитията на играта: shock за сектор (еднократно), mood за целия пазар (отшумява)
  marketShock(sector, pct) { this.s.market.shock = { sector, pct }; }
  marketMood(pct) { this.s.market.mood = (this.s.market.mood || 0) + pct; }
  // събитие: материалът е mul пъти по-скъп/евтин за days дни
  setPriceMod(matId, mul, days) { this.s.priceMods[matId] = { mul, until: this.s.day + days }; }
  buyShares(id, qty) {
    const cost = Math.round(this.price(id) * qty);
    if (qty <= 0 || !this.canAfford(cost)) return 0;
    this.s.money -= cost; this._log(-cost, 'акции', `Купи ${qty} акции ${COMPANIES.find(c => c.id === id).nm}`);
    const h = this.s.shares[id] || (this.s.shares[id] = { qty: 0, cost: 0 });
    h.qty += qty; h.cost += cost;
    return cost;
  }
  sellShares(id, qty = Infinity) {
    const h = this.s.shares[id]; if (!h || !h.qty) return 0;
    qty = Math.min(qty, h.qty);
    const got = Math.round(this.price(id) * qty), basis = h.cost * qty / h.qty;
    h.qty -= qty; h.cost -= basis;
    if (!h.qty) delete this.s.shares[id];
    this.s.money += got; this._log(got, 'акции', `Продаде ${qty} акции ${COMPANIES.find(c => c.id === id).nm} (${got - basis >= 0 ? 'печалба' : 'загуба'} ${fmt(Math.abs(got - basis))})`);
    return got;
  }
  portfolioValue() { let v = 0; for (const [id, h] of Object.entries(this.s.shares || {})) if (this.s.market.c[id]) v += h.qty * this.s.market.c[id].price; return Math.round(v); }
  portfolioCost() { let v = 0; for (const h of Object.values(this.s.shares || {})) v += h.cost; return Math.round(v); }
  // IPO: продаваш 20% от фирмата на борсата; после можеш да ги изкупиш обратно по текущата цена
  canIPO(unitTypes) { return !this.s.ipo && this.netWorth(unitTypes) >= IPO.minWorth; }
  doIPO(unitTypes) {
    if (!this.canIPO(unitTypes)) return 0;
    const val = this.netWorth(unitTypes) * IPO.premium, totalShares = 1000000, cash = Math.round(val * IPO.share);
    this.s.ipo = { day: this.s.day, totalShares, outside: totalShares * IPO.share, price: Math.round(val / totalShares * 100) / 100, hist: [] };
    this.s.ipo.hist.push(this.s.ipo.price);
    this.s.money += cash; this._log(cash, 'борса', 'Първично публично предлагане (IPO): продадени 20% от фирмата');
    return cash;
  }
  ipoDebt() { return this.s.ipo && this.s.ipo.outside ? Math.round(this.s.ipo.outside * this.s.ipo.price) : 0; }   // дела на външните акционери
  buyBack() {
    const cost = this.ipoDebt();
    if (!cost || !this.canAfford(cost)) return 0;
    this.s.money -= cost; this._log(-cost, 'борса', 'Обратно изкупуване на акциите — фирмата отново е изцяло твоя');
    this.s.ipo.outside = 0;
    return cost;
  }

  // ---------------------------------------------------------- градове: завършване, автоматичен приход, продажба
  // game.js казва в кой град си (за оборота по градове)
  setCity(id) { this.cityId = id; }
  // среден дневен оборот от обекти в града за последните days дни
  cityAvgDaily(id, days = 30) {
    const ce = this.s.cityEarn[id] || {}; let sum = 0;
    for (const [d, v] of Object.entries(ce)) if (+d > this.s.day - days) sum += v;
    return Math.round(sum / days);
  }
  // завършва града: оттук нататък носи share × средния оборот на ден (минимум minDaily); stats — за равносметката
  finishCity(id, share, stats = {}, minDaily = 3000) {
    const daily = Math.max(minDaily, Math.round(this.cityAvgDaily(id) * share));
    this.s.finished[id] = { share, daily, day: this.s.day, stats, earned: 0 };
    return this.s.finished[id];
  }
  isFinished(id) { return !!this.s.finished[id]; }
  // техниката, която остава в завършения град за поддръжка (масив от типове); game.js я подава при завършване/смяна на града
  setFinishedFleet(id, types = []) { const f = this.s.finished[id]; if (f) f.fleet = [...types]; }
  // поддръжката: всяка единица дава +3% (до +30%) и пази дела от конкурентите; без техника приходът е 70% и делът бавно пада
  maintOf(f) { const n = (f.fleet || []).length; return n ? Math.min(1.3, 1 + 0.03 * n) : 0.7; }
  // плаща се в dailyTick; active = градът, в който си в момента (там плащането е от обектите)
  payFinished(active) {
    let tot = 0, upkeep = 0, restN = 0, restSum = 0;
    const parts = [];
    for (const [id, f] of Object.entries(this.s.finished)) {
      if (id === active) continue;
      if (!(f.fleet || []).length) f.share = Math.max(0.35, f.share - 0.001);   // без поддръжка конкурентите взимат дял
      for (const t of f.fleet || []) upkeep += UNIT_TYPES[t] ? UNIT_TYPES[t].upkeep : 0;
      const n = Math.round(f.daily * f.share / (f.share0 || (f.share0 = f.share)) * this.maintOf(f) * (this.hooks.incomeMul ? this.hooks.incomeMul(id) : 1));
      f.earned += n; tot += n;
      // в известието поименно само столиците; останалите — сбор накрая
      if (!this.hooks.isCapital || this.hooks.isCapital(id)) parts.push(`${(this.hooks.cityName && this.hooks.cityName(id)) || id} +${fmt(n)}`);
      else { restN++; restSum += n; }
    }
    if (restN) parts.push(`още ${restN} ${restN === 1 ? 'град' : 'града'} +${fmt(restSum)}`);
    // известие веднъж на ден: колко донесоха завършените градове
    if (tot && this.hooks.toast) this.hooks.toast(`🏁 Завършени градове: +${fmt(tot - upkeep)} днес (${parts.join(', ')}${upkeep ? `, поддръжка −${fmt(upkeep)}` : ''})`, 'good');
    if (tot) this.earn(tot, 'градове', `Автоматичен приход от ${Object.keys(this.s.finished).filter(i => i !== active).length} завършени града`);
    if (upkeep) this.spend(upkeep, 'заплати', 'Поддръжка на техниката в завършените градове');
    return tot;
  }
  // цена при продажба на филиал: активите (по половин цена — техника, сгради) + 1 година печалба × 0.5
  branchSalePrice({ assets = 0, dailyProfit = 0 } = {}) { return Math.round((assets + Math.max(0, dailyProfit) * 365 * 0.5) / 1000) * 1000; }
  sellBranch(id, price, name = id) {
    this.earn(price, 'филиал±', `Продаден филиал: ${name}`);
    delete this.s.finished[id]; delete this.s.cityEarn[id];
    return price;
  }

  // ---------------------------------------------------------- депозит
  depositIn(n) {
    n = Math.floor(Math.min(n, this.s.money));
    if (n <= 0) return 0;
    this.s.money -= n; this.s.deposit += n;
    this._log(-n, 'депозит', 'Внесен депозит');
    return n;
  }
  depositOut(n = Infinity) {
    n = Math.floor(Math.min(n, this.s.deposit));
    if (n <= 0) return 0;
    this.s.deposit -= n; this.s.money += n;
    this._log(n, 'депозит', 'Изтеглен депозит');
    return n;
  }
  // взима натрупаната (готова) лихва; връща сумата
  collectInterest() {
    const n = Math.round(this.s.depReady);
    if (n <= 0) return 0;
    this.s.depReady = 0;
    this.earn(n, 'лихва+', 'Лихва по депозит');
    depositButton(this);
    return n;
  }
  depositInfo() {
    const s = this.s;
    return { amount: s.deposit, ready: Math.round(s.depReady), accrued: Math.round(s.depAccrued), daysLeft: s.deposit > 0 || s.depAccrued > 0 ? DEPOSIT_MONTH_DAYS - s.depDays : DEPOSIT_MONTH_DAYS,
      monthly: Math.round(depInterest(s.deposit)) };
  }

  isBankrupt() { return this.s.money < BANKRUPT_AT; }
}

// ---- съвет на трейдъра: сигнал за всяка фирма от графиката (средна за 30 дни, посока за 5 дни), риска от фалит и печалбата ти
// най-добрата продажба сега (за нотификацията на трейдъра): акция с печалба над 15% и цена над средната за месец
export function bestSale(econ) {
  let best = null;
  for (const [id, h] of Object.entries(econ.s.shares || {})) {
    const q = econ.s.market.c[id], c = COMPANIES.find(x => x.id === id); if (!q || !c || !h.qty || q.bust || (econ.s.subs || {})[id]) continue;
    const a = tradeAdvice(econ, id), value = Math.round(q.price * h.qty), profit = value - Math.round(h.cost), gain = h.cost ? value / h.cost - 1 : 0;
    if (a.sig !== 'sell' || profit <= 0 || gain < 0.15) continue;
    if (!best || profit > best.profit) best = { id, nm: c.nm, ico: c.ico, qty: h.qty, value, profit, gain };
  }
  return best;
}
export function tradeAdvice(econ, id) {
  const c = COMPANIES.find(x => x.id === id), q = econ.s.market.c[id], h = econ.s.shares[id];
  const hist = q.hist.slice(-30), avg = hist.reduce((a, v) => a + v, 0) / hist.length, p = q.price;
  const dev = p / avg - 1, mom = p / (q.hist[q.hist.length - 6] || p) - 1, ratio = p / c.price;
  const gain = h && h.qty ? p / (h.cost / h.qty) - 1 : null, pct = v => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(0)}%`;
  if (q.bust) return { sig: 'take', ico: '💥', txt: 'Фалит — изкупи цялата фирма или стой настрана' };
  if (gain != null && ratio < BUST.below + 0.08) return { sig: 'sell', ico: '🔴', txt: `Продавай — цената е ${Math.round(ratio * 100)}% от началната, риск от фалит` };
  if (gain != null && gain > 0.15 && dev > 0.04) return { sig: 'sell', ico: '🔴', txt: `Продавай — печалба ${pct(gain)} и цената е над средната (${pct(dev)})` };
  if (gain != null && gain < -0.2 && mom < -0.03) return { sig: 'sell', ico: '🟠', txt: `Ограничи загубата — ${pct(gain)} и продължава да пада` };
  if (ratio < BUST.below + 0.08) return { sig: 'risk', ico: '⚠️', txt: 'Не купувай — близо до фалит (но може да стане изгодно за изкупуване)' };
  if (dev < -0.06 && mom > -0.015) return { sig: 'buy', ico: '🟢', txt: `Купувай — ${Math.abs(Math.round(dev * 100))}% под средната за месец и спира да пада` };
  if (dev < -0.06) return { sig: 'wait', ico: '🟡', txt: `Евтина (${Math.abs(Math.round(dev * 100))}% под средната), но още пада — изчакай да спре` };
  if (dev > 0.08) return { sig: 'wait', ico: '🟡', txt: `Скъпа — ${Math.round(dev * 100)}% над средната, изчакай спад` };
  if (c.div && dev < -0.02 && mom > -0.015) return { sig: 'buy', ico: '🟢', txt: `Леко под средната и носи дивидент ${(c.div * 100).toFixed(1)}%/мес. — добра за държане` };
  return { sig: 'hold', ico: '⚪', txt: gain != null ? `Задръж (${pct(gain)} спрямо покупката)` : 'Нормална цена — няма ясен сигнал' };
}

// бутон „Продай фирмата“ за съществуваща дъщерна (цена = 150 дни от приходa ѝ; имуществото, вече дадено, остава твое)
const SUB_SELL_DAYS = 150;
export const subSellPrice = c => c.subDaily * SUB_SELL_DAYS;
const this_liqBtn = (econ, c) => `<button class="btn2" data-stk="subsell:${c.id}" title="Фирмата се закрива; сградите и техниката, които ти даде, остават твои">💰 Продай · ${fmt(subSellPrice(c))}</button>`;
// ============================================================ таб „Банка / Финанси“
// плъзгач за депозита: от 0 до наличните пари (внасяне) или до сумата в депозита (теглене); стойността се помни между пречертаванията
const depPick = { in: 0, out: 0 };
function depSlider(kind, max, cur) {
  const v = Math.min(depPick[kind], max), step = max > 2e6 ? 10000 : 1000, inn = kind === 'in';
  const after = inn ? cur + v : cur - v;
  return `<div class="dep-sl" data-depk="${kind}" data-cur="${cur}" style="margin-top:10px">
    <div class="fin-kv">${inn ? '➕ Внеси' : '➖ Изтегли'} <b class="dep-v" style="color:var(--txt)">${fmt(v)}</b></div>
    <input type="range" min="0" max="${max}" step="${step}" value="${v}" ${max > 0 ? '' : 'disabled'} style="width:100%;accent-color:${inn ? '#ffc93c' : '#7dd3ff'}">
    <div style="display:flex;gap:6px;margin:4px 0">${[25, 50, 75, 100].map(p => `<button class="btn2" data-deppct="${p}" style="flex:1;padding:4px 0;font-size:12px" ${max > 0 ? '' : 'disabled'}>${p === 100 ? (inn ? 'Всичко' : 'Всичко') : p + '%'}</button>`).join('')}</div>
    <div class="meta dep-after" style="margin:0 0 4px">След това: депозит ${fmt(after)} · лихва ~${fmt(depInterest(after))}/мес.</div>
    <div class="fin-btns" style="margin-top:4px"><button class="${inn ? 'btn' : 'btn2'}" data-depgo="${kind}" ${v > 0 ? '' : 'disabled'}>${inn ? '🏦 Внеси' : '💶 Изтегли'} ${fmt(v)}</button></div>
  </div>`;
}
export const fmt = n => `${Math.round(n).toLocaleString('bg-BG')} €`;
const sign = n => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// бутон горе вляво (като „Купи за обектите“), докато има готова лихва по депозита
function depositButton(econ) {
  if (typeof document === 'undefined') return;
  ensureStyle();
  let b = document.getElementById('quickDep');
  const n = Math.round(econ.s.depReady || 0), month = depInterest(econ.s.deposit || 0);
  // плаващият бутон излиза, когато се е натрупала поне месечна лихва (иначе — само в картата на депозита)
  if (n <= 0 || n < month * 0.999) { if (b) b.remove(); document.body.classList.remove('qd'); return; }
  document.body.classList.add('qd');   // съобщенията слизат надолу, за да не се застъпват с бутона
  if (!b) {
    b = document.createElement('button');
    b.id = 'quickDep';
    b.onclick = () => {
      const got = econ.collectInterest();
      if (got && econ.hooks.toast) econ.hooks.toast(`💰 Изтегли лихва по депозита: +${fmt(got)}`, 'good');
      if (econ.hooks.changed) econ.hooks.changed();
    };
    document.body.appendChild(b);
  }
  b.innerHTML = `💰 Изтегли лихвата по депозита <b>+${fmt(n)}</b>`;
}

// стиловете на таба живеят тук, за да не пипаме index.html
function ensureStyle() {
  if (document.getElementById('finStyle')) return;
  const st = document.createElement('style');
  st.id = 'finStyle';
  st.textContent = `
  .fin-big { font-size:26px; font-weight:900; margin-top:4px; }
  .fin-big.neg { color:var(--bad); }
  .fin-kv { display:flex; justify-content:space-between; gap:8px; font-size:13px; color:var(--mut); margin-top:5px; }
  .fin-kv b { color:var(--txt); white-space:nowrap; }
  .fin-btns { display:flex; gap:8px; margin-top:10px; }
  .fin-btns button { flex:1; }
  .fin-btns button:disabled { opacity:.4; cursor:default; }
  #quickDep { position:fixed; top:62px; left:14px; z-index:7; border:0; border-radius:12px; padding:10px 14px; font-weight:800; font-size:14px; color:#062a12;
    background:linear-gradient(180deg,#9dffb8,#3fd46a); box-shadow:0 4px 14px rgba(0,0,0,.35); cursor:pointer; animation:qdPulse 1.6s ease-in-out infinite; }
  body.qb #quickDep { top:calc(var(--topH, 52px) + 64px); }
  body.qd #toasts { top:calc(var(--topH, 52px) + 66px); }   /* под бутона, не върху него */
  body.qb.qd #toasts { top:calc(var(--topH, 52px) + 120px); }
  @keyframes qdPulse { 50% { box-shadow:0 4px 22px rgba(76,208,125,.8); } }
  .fin-chart { width:100%; height:120px; display:block; margin-top:8px; }
  .fin-chart text { font-size:10px; fill:var(--mut); }
  .fin-leg { display:flex; gap:12px; font-size:12px; color:var(--mut); margin-top:4px; }
  .fin-leg i { display:inline-block; width:10px; height:10px; border-radius:3px; margin-right:4px; vertical-align:-1px; }
  .fin-row { display:flex; align-items:center; gap:8px; font-size:13px; padding:5px 0; border-top:1px solid var(--line); }
  .fin-row:first-child { border-top:0; }
  .fin-row .d { color:var(--mut); width:42px; flex:none; }
  .fin-row .n { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .fin-row .a { font-weight:800; white-space:nowrap; }
  .fin-pos { color:var(--ok); } .fin-neg { color:var(--bad); }
  .fin-cat { display:flex; align-items:center; gap:8px; font-size:13px; margin-top:6px; }
  .fin-cat .n { width:140px; flex:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .fin-cat .b { flex:1; height:7px; border-radius:4px; background:rgba(255,255,255,.08); overflow:hidden; }
  .fin-cat .b i { display:block; height:100%; }
  .fin-cat .a { width:84px; text-align:right; font-weight:700; white-space:nowrap; }`;
  document.head.appendChild(st);
}

// малка линия (sparkline) от поредица числа
function spark(vals, w = 90, h = 26, col = 'var(--acc)') {
  if (!vals || vals.length < 2) return '';
  const mn = Math.min(...vals), mx = Math.max(...vals), sp = mx - mn || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(h - 2 - (v - mn) / sp * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.6"/></svg>`;
}
// стълбчета приход/разход по дни
function chartSvg(days) {
  const W = 320, H = 120, pad = 18, slot = (W - 4) / Math.max(days.length, 1);
  const max = Math.max(1, ...days.map(d => Math.max(d.in, d.out)));
  const h = v => (H - pad - 6) * v / max;
  let g = '';
  days.forEach((d, k) => {
    const x = 2 + k * slot, bw = Math.min(16, slot * 0.32), op = d.partial ? 0.5 : 1;
    const hi = h(d.in), ho = h(d.out);
    g += `<rect x="${x + slot / 2 - bw - 1}" y="${H - pad - hi}" width="${bw}" height="${hi}" rx="2" fill="var(--ok)" opacity="${op}"><title>Ден ${d.day}: приход ${fmt(d.in)}</title></rect>`;
    g += `<rect x="${x + slot / 2 + 1}" y="${H - pad - ho}" width="${bw}" height="${ho}" rx="2" fill="var(--bad)" opacity="${op}"><title>Ден ${d.day}: разход ${fmt(d.out)}</title></rect>`;
    g += `<text x="${x + slot / 2}" y="${H - 4}" text-anchor="middle">${d.partial ? 'днес' : 'д' + d.day}</text>`;
  });
  return `<svg class="fin-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <line x1="0" x2="${W}" y1="${H - pad}" y2="${H - pad}" stroke="rgba(255,255,255,.15)"/>${g}</svg>`;
}

// Рисува таба „Банка“ в el. rerender() се вика след всяко действие (кредит), за да се обнови панелът.
// unitTypes (по желание): масив от типовете в парка — за дневните разходи и нетната стойност.
// opts (по желание): { connectedCityIds, roadCityIds } — градовете с жп връзка / магистрала, за заводските цени в „Склад“
export function renderFinance(el, econ, rep = 0, rerender = () => {}, unitTypes = null, opts = {}) {
  // видимите на борсата: родните, чуждите от държави с твой филиал (econ.hooks.stockVisible) и тези, в които имаш акции/дъщерна
  const visCo = c => !econ.hooks.stockVisible || econ.hooks.stockVisible(c) || (econ.s.shares || {})[c.id] || (econ.s.subs || {})[c.id];
  ensureStyle();
  const s = econ.s, max = econ.maxLoan(rep), step = econ.loanStep(rep), room = econ.loanRoom(rep);
  const interest = Math.round(s.loan * LOAN_DAILY_RATE);
  const days = econ.lastDays(7);
  const wk = days.reduce((a, d) => ({ in: a.in + d.in, out: a.out + d.out }), { in: 0, out: 0 });

  let html = `<div class="card">
    <h3><span class="ico">💶</span>Сметка</h3>
    <div class="fin-big ${s.money < 0 ? 'neg' : ''}">${fmt(s.money)}</div>
    ${econ.hooks.bustHtml ? econ.hooks.bustHtml() : s.money < 0 ? `<div class="meta late">На минус: 1% лихва на ден.</div>` : ''}`;
  if (unitTypes) {
    const upkeep = unitTypes.reduce((a, t) => a + (UNIT_TYPES[t] ? UNIT_TYPES[t].upkeep : 0), 0);
    html += `<div class="fin-kv">Заплати и поддръжка на ден <b>${fmt(upkeep)}</b></div>
    <div class="fin-kv">Нетна стойност на фирмата <b>${fmt(econ.netWorth(unitTypes))}</b></div>`;
  }
  html += `</div>`;

  html += `<div class="card">
    <h3><span class="ico">🏦</span>Кредит</h3>
    <div class="fin-kv">Дълг <b>${fmt(s.loan)}</b></div>
    <div class="fin-kv">Лимит (репутация и нетна стойност: до 2× при 5 ★) <b>${fmt(max)}</b></div>
    <div class="bar"><i style="width:${Math.min(100, s.loan / max * 100)}%"></i></div>
    <div class="fin-kv">Лихва ${(LOAN_DAILY_RATE * 100).toFixed(1)}% на ден <b>${fmt(interest)} / ден</b></div>
    ${(s.inv || []).length ? `<div class="sect" style="margin-top:6px">Инвестиционни кредити · ${fmt(econ.invDebt())}</div>` + s.inv.map((l, i) => `<div class="fin-row" style="flex-wrap:wrap"><span class="n">${esc(l.note)}<br><span style="color:var(--mut)">остават ${fmt(l.left)} · вноска ${fmt(l.daily + l.interest)}/ден · ~${Math.ceil(l.left / l.daily)} дни</span></span><button class="btn2" data-inv="${i}" ${econ.canAfford(l.left) ? '' : 'disabled'}>Погаси</button></div>`).join('') : ''}
    <div class="meta">🏗️ Инвестиционен кредит за покупки (филиали, пристанища, летища, кораби…): до 60% от нетната стойност — 10% лихва за 120 дни; до 120% — 20% за 150 дни; до 250% — 35% за 180 дни. Предлага се сам, когато нещо не ти стига пари.</div>
    <div class="fin-btns">
      <button class="btn" data-fin="take" ${econ.canTakeLoan(rep, step) ? '' : 'disabled'}>Вземи ${fmt(step)}</button>
      <button class="btn" data-fin="takeall" ${room > 0 && econ.canTakeLoan(rep, room) ? '' : 'disabled'}>Вземи всичко · ${fmt(room)}</button>
      <button class="btn2" data-fin="repay" ${econ.canRepay(step) ? '' : 'disabled'}>Погаси ${fmt(Math.min(step, s.loan || step))}</button>
      <button class="btn2" data-fin="repayall" ${s.loan > 0 && econ.canAfford(s.loan) ? '' : 'disabled'}>Погаси всичко${s.loan ? ' · ' + fmt(s.loan) : ''}</button>
    </div>
  </div>`;

  // блокирани пари: гаранции за участие в държавни поръчки (opts.blocked = [{ nm, amount, why }])
  const blk = (opts.blocked || []).filter(b => b.amount > 0);
  if (blk.length) html += `<div class="card" style="border-color:#ffb46b"><h3><span class="ico">🔐</span>Блокирани пари · ${fmt(blk.reduce((a, b) => a + b.amount, 0))}</h3>
    ${blk.map(b => `<div class="fin-kv"><span>${esc(b.nm)}<br><span style="color:var(--mut);font-size:12px">${esc(b.why || '')}</span></span><b>${fmt(b.amount)}</b></div>`).join('')}
    <div class="meta">Гаранциите за участие в търгове не са твои пари, докато не ги върнат: загубилите търга си ги получават при отварянето на офертите, спечелилият — при предаването на обекта.</div></div>`;
  // депозит
  const dep = econ.depositInfo(), canIn = n => s.money >= n;
  html += `<div class="card">
    <h3><span class="ico">🏦</span>Депозит · до ${(DEP_TIERS[0][1] * 100).toFixed(0)}% на месец</h3>
    <div class="fin-big" style="font-size:22px">${fmt(dep.amount)}</div>
    <div class="fin-kv">Лихва на месец <b class="fin-pos">${fmt(dep.monthly)}${dep.amount ? ` <span style="color:var(--mut);font-weight:400">(${(dep.monthly / dep.amount * 100).toFixed(1)}%)</span>` : ''}</b></div>
    <div class="meta" style="margin:2px 0 6px">${DEP_TIERS.map(([hi, p], i) => { const lo = i ? DEP_TIERS[i - 1][0] : 0, on = dep.amount > lo; return `<span style="${on ? 'color:var(--ok);font-weight:700' : ''}">${hi === Infinity ? `над ${fmt(lo)}` : `${lo ? `${fmt(lo)}–` : 'до '}${fmt(hi)}`}: ${(p * 100).toFixed(0)}%</span>`; }).join(' · ')}</div>
    <div class="fin-kv">Натрупана лихва (+${fmt(dep.monthly / DEPOSIT_MONTH_DAYS)} на ден) <b class="fin-pos">${fmt(dep.ready)}</b></div>
    <div class="fin-btns"><button class="btn" data-dep="collect" ${dep.ready > 0 ? '' : 'disabled'}>💰 Вземи лихвата${dep.ready > 0 ? ` · +${fmt(dep.ready)}` : ''}</button></div>
    ${depSlider('in', Math.floor(s.money), dep.amount)}
    ${depSlider('out', dep.amount, dep.amount)}
    <div class="meta">Парите в депозита са на сигурно място, но не можеш да ги харчиш, докато не ги изтеглиш. Лихвата се трупа всеки ден и я взимаш, когато поискаш.</div>
  </div>`;

  // ---- борса (отключва се на ниво на развитие opts.stocksLevel, по подразбиране 7; opts.stocksOpen идва от game.js)
  const mk = s.market, pv = econ.portfolioValue(), pc = econ.portfolioCost();
  if (opts.stocksOpen === false) html += `<div class="card" style="opacity:.8"><h3><span class="ico">🔒</span>Борса</h3>
    <div class="meta">Стоковата борса се отключва на ниво ${opts.stocksLevel || 7} на развитие${opts.devLevel != null ? ` (сега: ниво ${opts.devLevel})` : ''}.</div>
    ${pv ? `<div class="fin-kv">Акции, купени по-рано <b>${fmt(pv)}</b></div><div class="meta">Дивидентите от тях продължават да идват.</div>` : ''}</div>`;
  else {
  html += `<div class="card"><h3><span class="ico">📈</span>Борса</h3>
    <div class="fin-kv">Портфейл <b>${fmt(pv)}</b></div>
    ${pc ? `<div class="fin-kv">Печалба/загуба <b class="${pv - pc >= 0 ? 'fin-pos' : 'fin-neg'}">${sign(pv - pc)}</b></div>` : ''}` +
    (() => {   // общ съвет: настроението на пазара и най-добрата покупка
      const mood = mk.mood || 0, adv = COMPANIES.filter(c => !(s.subs || {})[c.id] && visCo(c)).map(c => ({ c, a: tradeAdvice(econ, c.id), dev: mk.c[c.id].price / (mk.c[c.id].hist.slice(-30).reduce((x, v) => x + v, 0) / mk.c[c.id].hist.slice(-30).length) - 1 }));
      const best = adv.filter(x => x.a.sig === 'buy').sort((a, b) => a.dev - b.dev)[0], sells = adv.filter(x => x.a.sig === 'sell');
      return `<div class="meta" style="margin:6px 0;padding:8px;border-radius:8px;background:rgba(255,179,0,.08);border:1px solid rgba(255,179,0,.3)">🧑‍💼 <b style="color:var(--txt)">Трейдърът съветва:</b>
        ${mood > 0.004 ? '📈 Пазарът е оптимистичен — цените растат, добре е да продаваш на печалба.' : mood < -0.004 ? '📉 Пазарът е песимистичен — цените падат; евтините качествени акции са възможност.' : '⚖️ Пазарът е спокоен.'}
        ${best ? `<br>🟢 Най-добра покупка: <b style="color:var(--txt)">${esc(best.c.nm)}</b> (${Math.round(best.dev * 100)}% спрямо средната).` : '<br>Няма явно изгодна покупка — изчакай спад.'}
        ${sells.length ? `<br>🔴 Помисли да продадеш: ${sells.map(x => esc(x.c.nm)).join(', ')}.` : ''}
        <br><span style="opacity:.75">Правило: купувай под средната за месец, продавай над нея с печалба; съветът не е гаранция.</span></div>`;
    })() +
    COMPANIES.filter(visCo).map(c => {
      const q = mk.c[c.id], prev = q.hist[q.hist.length - 2] || q.price, ch = (q.price / prev - 1) * 100, h = s.shares[c.id];
      if ((s.subs || {})[c.id]) return `<div class="fin-row"><span>${c.ico}</span><span class="n">${esc(c.nm)}<br><span style="color:var(--ok)">✅ твоя дъщерна фирма от ден ${s.subs[c.id].day}</span></span><span class="a fin-pos">+${fmt(c.subDaily)}/ден</span>${this_liqBtn(econ, c)}</div>`;
      if (q.bust) { const tp = econ.takeoverPrice(c.id); return `<div class="fin-row" style="flex-wrap:wrap;border:1px solid var(--bad);border-radius:8px;padding:6px"><span>${c.ico}</span><span class="n">${esc(c.nm)}<br><span style="color:var(--bad);font-weight:700">💥 ФАЛИТ · още ${q.bust.until - s.day} дни</span></span>
        <span class="a" style="text-align:right">${q.price.toFixed(2)} €</span>
        <div class="meta" style="width:100%">Изкупи цялата фирма и вземи: <b style="color:var(--txt)">${c.gets}</b>. После носи <b class="fin-pos">+${fmt(c.subDaily)}/ден</b>.${h ? ` Твоите ${h.qty} акции се приспадат.` : ''}</div>
        <div class="fin-btns" style="width:100%"><button class="btn" data-stk="take:${c.id}" ${econ.canAfford(tp) ? '' : 'disabled'}>🏢 Изкупи цялата · ${fmt(tp)}</button></div></div>`; }
      return `<div class="fin-row" style="flex-wrap:wrap"><span>${c.ico}</span><span class="n">${esc(c.nm)}<br><span style="color:var(--mut)">${c.sector}${c.div ? ` · дивидент ${(c.div * 100).toFixed(1)}%/мес.` : ''}${h ? ` · имаш <b style="color:var(--txt)">${h.qty}</b>` : ''}</span></span>
        ${spark(q.hist.slice(-30), 70, 24, ch >= 0 ? 'var(--ok)' : 'var(--bad)')}
        <span class="a" style="text-align:right">${q.price.toFixed(2)} €<br><span class="${ch >= 0 ? 'fin-pos' : 'fin-neg'}" style="font-size:11px">${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(1)}%</span></span>
        ${(() => { const a = tradeAdvice(econ, c.id); return `<div class="meta" style="width:100%;margin:3px 0 0;color:${a.sig === 'buy' ? 'var(--ok)' : a.sig === 'sell' || a.sig === 'risk' ? 'var(--bad)' : a.sig === 'wait' ? 'var(--acc)' : 'var(--mut)'}">${a.ico} ${a.txt}</div>`; })()}
        <div class="fin-btns" style="width:100%;margin-top:4px">
          <button class="btn2" data-stk="buy:${c.id}:100" ${econ.canAfford(q.price * 100) ? '' : 'disabled'}>Купи 100 · ${fmt(q.price * 100)}</button>
          <button class="btn2" data-stk="buy:${c.id}:1000" ${econ.canAfford(q.price * 1000) ? '' : 'disabled'}>Купи 1000</button>
          <button class="btn2" data-stk="sell:${c.id}" ${h ? '' : 'disabled'}>Продай всички</button>
        </div></div>`;
    }).join('');
  // твоята фирма на борсата
  const worth = unitTypes ? econ.netWorth(unitTypes) : null;
  if (s.ipo) html += `<div class="sect" style="margin-top:8px">🏗️ Твоята фирма на борсата</div>
    <div class="fin-kv">Цена на акция <b>${s.ipo.price.toFixed(2)} €</b></div>${spark(s.ipo.hist, 280, 30)}
    <div class="fin-kv">Външни акционери ${s.ipo.outside ? `(${(IPO.share * 100).toFixed(0)}%)` : ''} <b>${s.ipo.outside ? fmt(econ.ipoDebt()) : 'няма — фирмата е изцяло твоя'}</b></div>
    ${s.ipo.outside ? `<div class="fin-btns"><button class="btn2" data-stk="buyback" ${econ.canAfford(econ.ipoDebt()) ? '' : 'disabled'}>Изкупи обратно · ${fmt(econ.ipoDebt())}</button></div>` : ''}`;
  else html += `<div class="sect" style="margin-top:8px">🔔 Пусни фирмата на борсата (IPO)</div>
    <div class="meta">Продаваш ${(IPO.share * 100).toFixed(0)}% от фирмата на ${IPO.premium}× нетната ѝ стойност и взимаш парите веднага. Нужна е нетна стойност поне ${fmt(IPO.minWorth)}${worth != null ? ` (сега: ${fmt(worth)})` : ''}.</div>
    <div class="fin-btns"><button class="btn" data-stk="ipo" ${unitTypes && econ.canIPO(unitTypes) ? '' : 'disabled'}>Пусни на борсата${worth != null ? ` · +${fmt(worth * IPO.premium * IPO.share)}` : ''}</button></div>`;
  html += `</div>`;
  }

  // ---- статистика: приход/разход по месеци, нетна стойност във времето, най-печеливши обекти
  const months = [];
  for (const d of s.history) { const k = Math.floor((d.day - 1) / DEPOSIT_MONTH_DAYS); (months[k] = months[k] || { k, in: 0, out: 0 }); months[k].in += d.in; months[k].out += d.out; }
  const ml = months.filter(Boolean).slice(-6), mmax = Math.max(1, ...ml.map(m => Math.max(m.in, m.out)));
  const wh = (s.worthHist || []).map(x => x[1]);
  html += `<div class="card"><h3><span class="ico">📊</span>Статистика</h3>
    <div class="sect">Нетна стойност на фирмата</div>${spark(wh.slice(-200), 300, 50, 'var(--acc)')}
    <div class="fin-kv">${wh.length ? `От ${fmt(wh[0])} до <b>${fmt(wh[wh.length - 1])}</b>` : 'Още няма данни — идват в края на деня.'}</div>
    <div class="sect" style="margin-top:8px">Приход и разход по месеци</div>
    <svg class="fin-chart" viewBox="0 0 320 110" preserveAspectRatio="none">${ml.map((m, i) => {
      const slot = 320 / Math.max(ml.length, 1), x = i * slot, bw = Math.min(22, slot * 0.32), hi = 80 * m.in / mmax, ho = 80 * m.out / mmax;
      return `<rect x="${x + slot / 2 - bw - 1}" y="${90 - hi}" width="${bw}" height="${hi}" rx="2" fill="var(--ok)"><title>Месец ${m.k + 1}: приход ${fmt(m.in)}</title></rect>
        <rect x="${x + slot / 2 + 1}" y="${90 - ho}" width="${bw}" height="${ho}" rx="2" fill="var(--bad)"><title>Месец ${m.k + 1}: разход ${fmt(m.out)}</title></rect>
        <text x="${x + slot / 2}" y="104" text-anchor="middle">м.${m.k + 1}</text>`; }).join('')}</svg>
    ${ml.length ? ml.slice(-3).map(m => `<div class="fin-kv">Месец ${m.k + 1} <b class="${m.in - m.out >= 0 ? 'fin-pos' : 'fin-neg'}">${sign(m.in - m.out)}</b></div>`).join('') : ''}
    <div class="sect" style="margin-top:8px">Най-печеливши обекти</div>
    ${(s.topProjects || []).slice(0, 5).map((t, i) => `<div class="fin-row"><span class="d">${i + 1}.</span><span class="n" title="${esc(t.note)}">${esc(t.note)}</span><span class="a fin-pos">${fmt(t.amount)}</span></div>`).join('') || '<div class="meta">Още няма завършени обекти.</div>'}
  </div>`;

  html += `<div class="card">
    <h3><span class="ico">📊</span>Последните 7 дни</h3>
    ${chartSvg(days)}
    <div class="fin-leg"><span><i style="background:var(--ok)"></i>приход</span><span><i style="background:var(--bad)"></i>разход</span></div>
    <div class="fin-kv">Приход <b class="fin-pos">${fmt(wk.in)}</b></div>
    <div class="fin-kv">Разход <b class="fin-neg">${fmt(wk.out)}</b></div>
    <div class="fin-kv">Печалба <b class="${wk.in - wk.out >= 0 ? 'fin-pos' : 'fin-neg'}">${sign(wk.in - wk.out)}</b></div>
  </div>`;

  const cats = Object.entries(econ.byCategory(7)).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  if (cats.length) {
    const cmax = Math.max(...cats.map(c => Math.abs(c[1])));
    html += `<div class="card"><h3><span class="ico">🧾</span>По категории (7 дни)</h3>` + cats.map(([c, v]) => {
      const ci = CATS[c] || CATS['друго'];
      return `<div class="fin-cat"><span class="n">${ci.ico} ${ci.nm}</span><span class="b"><i style="width:${Math.abs(v) / cmax * 100}%;background:${v >= 0 ? 'var(--ok)' : 'var(--bad)'}"></i></span><span class="a ${v >= 0 ? 'fin-pos' : 'fin-neg'}">${sign(v)}</span></div>`;
    }).join('') + `</div>`;
  }

  // склад: наличност, пазарна цена и заводската (с влак), ако има връзка до завода
  const conn = opts.connectedCityIds || [], ropts = { roadCityIds: opts.roadCityIds || [] };
  html += `<div class="card"><h3><span class="ico">📦</span>Склад</h3>
    <div class="fin-kv">Стойност на склада (пазарна) <b>${fmt(econ.stockValue())}</b></div>` + Object.entries(MATERIALS).map(([id, m]) => {
    const d = transportDiscount(id, conn, ropts), sup = supplierOf(id, conn, ropts), price = materialPrice(id, conn, ropts);
    const via = d.via === 'rail' ? `🚆 Жп връзка · спестявате ${d.pct * 100}%` : d.via === 'road' ? `🛣️ Магистрала · спестявате ${d.pct * 100}%` : 'без връзка до доставчика';
    return `<div class="fin-row"><span title="${esc(m.nm)}">${m.ico}</span><span class="n">${m.nm} · <b>${econ.stock(id)}</b> ${m.unit}${sup ? `<br><span style="color:var(--mut)">Доставчик: ${esc(sup.cityNm)} — ${via}</span>` : ''}</span>
      <span class="a ${d.pct ? 'fin-pos' : ''}">${d.pct ? `<s style="color:var(--mut);font-weight:400">${fmt(m.buyPrice)}</s> ` : ''}${fmt(price)} / ${m.unit}</span></div>`;
  }).join('') + `<div class="meta">Без връзка: пазарна цена + доставка ${fmt(DELIVERY_FEE.base)} и ${DELIVERY_FEE.rate * 100}%. Готова магистрала до доставчика: −${ROAD_DISCOUNT * 100}%, жп връзка: −${RAIL_DISCOUNT * 100}% (без такса за доставка).</div></div>`;

  const led = s.ledger.slice(-30).reverse();
  html += `<div class="sect">Счетоводна книга</div><div class="card">` + (led.length ? led.map(e => {
    const ci = CATS[e.cat] || CATS['друго'];
    return `<div class="fin-row"><span class="d">Д ${e.day || '–'}</span><span title="${esc(ci.nm)}">${ci.ico}</span><span class="n" title="${esc(e.note)}">${esc(e.note || ci.nm)}</span><span class="a ${e.amount >= 0 ? 'fin-pos' : 'fin-neg'}">${sign(e.amount)}</span></div>`;
  }).join('') : `<div class="empty">Още няма движения по сметката.</div>`) + `</div>`;

  el.innerHTML = html;
  el.querySelectorAll('[data-stk]').forEach(b => b.onclick = () => {
    const [act, id, q] = b.dataset.stk.split(':'), t = econ.hooks.toast || (() => {});
    if (act === 'buy') { const c = econ.buyShares(id, +q); if (c) t(`📈 Купи ${q} акции за ${fmt(c)}`, 'good'); }
    else if (act === 'sell') { const g = econ.sellShares(id); if (g) t(`📉 Продаде акциите за ${fmt(g)}`, 'good'); }
    else if (act === 'ipo') { const g = econ.doIPO(unitTypes || []); if (g) t(`🔔 Фирмата е на борсата! Получи ${fmt(g)} за ${(IPO.share * 100).toFixed(0)}% от акциите.`, 'good'); }
    else if (act === 'subsell') { const c = COMPANIES.find(x => x.id === id); econ.liquidate(id, subSellPrice(c)); }
    else if (act === 'take') { const c = econ.takeover(id); if (c) t(`🏢 Изкупи ${COMPANIES.find(x => x.id === id).nm} за ${fmt(c)} — сградите и имуществото ѝ са твои!`, 'good'); }
    else if (act === 'buyback') { const c = econ.buyBack(); if (c) t(`🏗️ Изкупи обратно акциите за ${fmt(c)} — фирмата е изцяло твоя.`, 'good'); }
    rerender();
  });
  el.querySelectorAll('[data-dep]').forEach(b => b.onclick = () => {
    const [act, arg] = b.dataset.dep.split(':'), t = econ.hooks.toast || (() => {});
    if (act === 'collect') { const n = econ.collectInterest(); if (n) t(`💰 Взе лихва по депозита: +${fmt(n)}`, 'good'); }
    else if (act === 'in') { const n = econ.depositIn(+arg); if (n) t(`🏦 Внесе ${fmt(n)} в депозит.`, 'good'); }
    else { const n = econ.depositOut(arg === 'all' ? Infinity : +arg); if (n) t(`🏦 Изтегли ${fmt(n)} от депозита.`, 'good'); }
    rerender();
  });
  el.querySelectorAll('.dep-sl').forEach(box => {
    const k = box.dataset.depk, r = box.querySelector('input'), go = box.querySelector('[data-depgo]'), cur = +box.dataset.cur;
    const show = () => { const v = +r.value; depPick[k] = v; box.querySelector('.dep-v').textContent = fmt(v); go.textContent = `${k === 'in' ? '🏦 Внеси' : '💶 Изтегли'} ${fmt(v)}`; go.disabled = !v;
      const a = k === 'in' ? cur + v : cur - v; box.querySelector('.dep-after').textContent = `След това: депозит ${fmt(a)} · лихва ~${fmt(depInterest(a))}/мес.`; };
    r.oninput = show;
    box.querySelectorAll('[data-deppct]').forEach(b => b.onclick = () => { const p = +b.dataset.deppct; r.value = p === 100 ? r.max : Math.round(+r.max * p / 100 / +r.step) * +r.step; show(); });
    go.onclick = () => { const v = +r.value, t = econ.hooks.toast || (() => {}); if (!v) return;
      const n = k === 'in' ? econ.depositIn(v) : econ.depositOut(v >= cur ? Infinity : v);
      if (n) t(k === 'in' ? `🏦 Внесе ${fmt(n)} в депозит.` : `🏦 Изтегли ${fmt(n)} от депозита.`, 'good');
      depPick[k] = 0; rerender(); };
  });
  el.querySelectorAll('[data-inv]').forEach(b => b.onclick = () => { const n = econ.invRepay(+b.dataset.inv), t = econ.hooks.toast || (() => {}); if (n) t(`🏦 Погаси предсрочно ${fmt(n)}.`, 'good'); rerender(); });
  el.querySelectorAll('[data-fin]').forEach(b => b.onclick = () => {
    const k = b.dataset.fin, take = k.startsWith('take'), step = econ.loanStep(rep);
    const ok = k === 'take' ? econ.takeLoan(rep, step) : k === 'takeall' ? econ.takeLoan(rep, econ.loanRoom(rep)) : econ.repayLoan(k === 'repayall' ? econ.s.loan : step);
    if (ok && econ.hooks.toast) econ.hooks.toast(take ? `🏦 Кредит: +${fmt(ok)}` : `🏦 Погаси ${fmt(ok)} от кредита${econ.s.loan ? '' : ' — вече нямаш дълг!'}`, 'good');
    rerender();
  });
}
