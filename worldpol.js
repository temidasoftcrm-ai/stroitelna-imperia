// worldpol.js — 🌍 световната политическа карта на президента (етап 3): само държавите, столиците, отношенията, нуждите и глобалните конфликти —
// без жп, магистрали и градове. Данните са игров сценарий (алтернативна хронология), не реални позиции. Рисува се като SVG от assets/globe/countries.json.
// Логиката (отношения, помощ, преговори) е в president.js; тук са сценарият и картата.

// държавите в сценария: столица, регион, нужди (ток, вода, здраве, храна, транспорт, жилища, възстановяване) и начална стабилност
export const POL = {
  USA: { nm: 'САЩ', cap: 'Вашингтон', lat: 38.9, lon: -77.04, stab: 72 }, RUS: { nm: 'Русия', cap: 'Москва', lat: 55.75, lon: 37.62, stab: 64 },
  CHN: { nm: 'Китай', cap: 'Пекин', lat: 39.9, lon: 116.4, stab: 70 }, GBR: { nm: 'Великобритания', cap: 'Лондон', lat: 51.5, lon: -0.13, stab: 74 },
  FRA: { nm: 'Франция', cap: 'Париж', lat: 48.86, lon: 2.35, stab: 70 }, DEU: { nm: 'Германия', cap: 'Берлин', lat: 52.52, lon: 13.4, stab: 75 },
  POL: { nm: 'Полша', cap: 'Варшава', lat: 52.23, lon: 21.01, stab: 72 }, BGR: { nm: 'България', cap: 'София', lat: 42.7, lon: 23.32, stab: 66 },
  TUR: { nm: 'Турция', cap: 'Анкара', lat: 39.93, lon: 32.86, stab: 62 }, UKR: { nm: 'Украйна', cap: 'Киев', lat: 50.45, lon: 30.52, stab: 35, need: ['rebuild', 'energy'] },
  KAZ: { nm: 'Казахстан', cap: 'Астана', lat: 51.17, lon: 71.45, stab: 64 }, IND: { nm: 'Индия', cap: 'Ню Делхи', lat: 28.61, lon: 77.21, stab: 66, need: ['water'] },
  PAK: { nm: 'Пакистан', cap: 'Исламабад', lat: 33.69, lon: 73.05, stab: 48, need: ['water', 'health'] }, AFG: { nm: 'Афганистан', cap: 'Кабул', lat: 34.53, lon: 69.17, stab: 30, need: ['food', 'health'] },
  IRN: { nm: 'Иран', cap: 'Техеран', lat: 35.69, lon: 51.39, stab: 52 }, SAU: { nm: 'Саудитска Арабия', cap: 'Рияд', lat: 24.71, lon: 46.68, stab: 66 },
  ISR: { nm: 'Израел', cap: 'Йерусалим', lat: 31.77, lon: 35.21, stab: 55 }, PSX: { nm: 'Палестина', cap: 'Рамала', lat: 31.9, lon: 35.2, stab: 22, need: ['housing', 'water', 'health'] },
  SYR: { nm: 'Сирия', cap: 'Дамаск', lat: 33.51, lon: 36.29, stab: 30, need: ['rebuild', 'health'] }, YEM: { nm: 'Йемен', cap: 'Сана', lat: 15.37, lon: 44.19, stab: 20, need: ['health', 'water', 'food'] },
  EGY: { nm: 'Египет', cap: 'Кайро', lat: 30.04, lon: 31.24, stab: 58, need: ['water'] }, SDN: { nm: 'Судан', cap: 'Хартум', lat: 15.5, lon: 32.56, stab: 18, need: ['food', 'health'] },
  ETH: { nm: 'Етиопия', cap: 'Адис Абеба', lat: 9.03, lon: 38.74, stab: 44, need: ['water', 'transport'] }, SOM: { nm: 'Сомалия', cap: 'Могадишу', lat: 2.05, lon: 45.32, stab: 25, need: ['water', 'food'] },
  NGA: { nm: 'Нигерия', cap: 'Абуджа', lat: 9.08, lon: 7.4, stab: 46, need: ['energy'] }, MLI: { nm: 'Мали', cap: 'Бамако', lat: 12.64, lon: -8, stab: 28, need: ['food', 'transport'] },
  NER: { nm: 'Нигер', cap: 'Ниамей', lat: 13.51, lon: 2.11, stab: 30, need: ['water', 'food'] }, COD: { nm: 'ДР Конго', cap: 'Киншаса', lat: -4.32, lon: 15.31, stab: 30, need: ['health', 'transport'] },
  RWA: { nm: 'Руанда', cap: 'Кигали', lat: -1.95, lon: 30.06, stab: 58 }, ZAF: { nm: 'ЮАР', cap: 'Претория', lat: -25.75, lon: 28.19, stab: 56, need: ['energy'] },
  BRA: { nm: 'Бразилия', cap: 'Бразилия', lat: -15.79, lon: -47.88, stab: 60, need: ['housing'] }, MEX: { nm: 'Мексико', cap: 'Мексико', lat: 19.43, lon: -99.13, stab: 55 },
  VEN: { nm: 'Венецуела', cap: 'Каракас', lat: 10.48, lon: -66.9, stab: 34, need: ['food', 'health'] }, HTI: { nm: 'Хаити', cap: 'Порт о Пренс', lat: 18.59, lon: -72.31, stab: 20, need: ['housing', 'health'] },
  JPN: { nm: 'Япония', cap: 'Токио', lat: 35.68, lon: 139.69, stab: 78 }, KOR: { nm: 'Южна Корея', cap: 'Сеул', lat: 37.57, lon: 126.98, stab: 72 },
  PRK: { nm: 'Северна Корея', cap: 'Пхенян', lat: 39.04, lon: 125.76, stab: 40 }, IDN: { nm: 'Индонезия', cap: 'Джакарта', lat: -6.2, lon: 106.85, stab: 62 },
};
export const NEED = { energy: ['⚡', 'ток'], water: ['💧', 'вода'], health: ['🏥', 'здравеопазване'], food: ['🌾', 'храна'], transport: ['🛣️', 'транспорт'], housing: ['🏠', 'жилища'], rebuild: ['🏗️', 'възстановяване'] };
// кой министър води помощта по вид нужда (и какво прави), освен финансите (Борис) и координацията (Десислава)
export const AID = {
  energy: { dir: 'energy', nm: 'Електроснабдяване', cost: 6e9, days: 120, up: 2e8 }, water: { dir: 'reg', nm: 'Водоснабдяване', cost: 3e9, days: 90, up: 1e8 },
  health: { dir: 'reg', nm: 'Болници и лекарства', cost: 4e9, days: 100, up: 1.5e8 }, food: { dir: 'sea', nm: 'Доставки на храна', cost: 2e9, days: 45, up: 1.2e8 },
  transport: { dir: 'roads', nm: 'Пътища и жп', cost: 5e9, days: 150, up: 1e8 }, housing: { dir: 'reg', nm: 'Жилища', cost: 5e9, days: 140, up: 8e7 },
  rebuild: { dir: 'reg', nm: 'Възстановяване на основни услуги', cost: 1.2e10, days: 200, up: 3e8 },
};
// етапите на помощта: финансиране → доставка → строеж → местен персонал и издръжка (всеки с министъра си)
export const AID_STAGES = [['fin', '💰 Финансиране'], ['sea', '🚢 Доставка'], ['build', '🏗️ Строеж'], ['pm', '👥 Местен персонал и пускане']];
// глобалните конфликти в игровата хронология; parties — страните, region — къде се води
export const CONFLICTS = [
  { k: 'east', ico: '⚔️', nm: 'Войната в Украйна', parties: ['UKR', 'RUS'], region: 'UKR', lat: 48.5, lon: 37.5, int: 85, note: 'алтернативна игрова хронология' },
  { k: 'sudan', ico: '🔥', nm: 'Гражданската война в Судан', parties: ['SDN'], region: 'SDN', lat: 13.5, lon: 28, int: 80 },
  { k: 'mideast', ico: '⚠️', nm: 'Близкоизточният конфликт', parties: ['ISR', 'PSX'], region: 'PSX', lat: 31.4, lon: 34.4, int: 75 },
  { k: 'yemen', ico: '🔥', nm: 'Войната в Йемен', parties: ['YEM', 'SAU'], region: 'YEM', lat: 15, lon: 46, int: 60 },
  { k: 'sahel', ico: '🔥', nm: 'Бунтовете в Сахел', parties: ['MLI', 'NER'], region: 'MLI', lat: 15, lon: -2, int: 55 },
  { k: 'congo', ico: '🔥', nm: 'Източно Конго', parties: ['COD', 'RWA'], region: 'COD', lat: -1.5, lon: 28.8, int: 60 },
];
// стъпките на мира (всяка може да бъде отказана; след 3 примирието трябва да се поддържа)
export const PEACE = [
  { nm: 'Дипломатически контакт', ico: '📞' }, { nm: 'Хуманитарен достъп', ico: '🚚' }, { nm: 'Ограничено прекратяване на огъня', ico: '🕊️' },
  { nm: 'Наблюдение и проверка', ico: '🔍' }, { nm: 'Широко споразумение', ico: '📃' }, { nm: 'Гаранции и възстановяване', ico: '🤝' },
];
// началните отношения според твоята държава (0–100)
export function baseRel(cc, iso) {
  const US = { GBR: 82, FRA: 76, DEU: 78, POL: 80, BGR: 74, JPN: 80, KOR: 78, ISR: 72, UKR: 72, SAU: 62, TUR: 58, IND: 62, MEX: 64, BRA: 58, RUS: 22, CHN: 32, IRN: 12, PRK: 8, VEN: 22, SYR: 18 };
  const RU = { CHN: 70, KAZ: 74, IRN: 64, SYR: 66, IND: 62, TUR: 52, VEN: 64, PRK: 50, BRA: 56, ZAF: 58, USA: 22, UKR: 8, GBR: 26, POL: 20, DEU: 36, FRA: 34, JPN: 30, KOR: 34, BGR: 38, ISR: 44 };
  if (iso === (cc === 'RU' ? 'RUS' : 'USA')) return 100;
  return (cc === 'RU' ? RU : US)[iso] ?? 50;
}

// ---- 🗺️ картата (SVG, еквидистантна проекция; Антарктида — без)
let geoP = null;
const geo = () => geoP || (geoP = fetch('assets/globe/countries.json').then(r => r.json()).catch(() => null));
const W = 1000, H = 470, X = lon => (lon + 180) / 360 * W, Y = lat => (84 - lat) / 142 * H;   // от 84° с.ш. до 58° ю.ш.
const relCol = r => r >= 70 ? '#3fae6b' : r >= 55 ? '#7fb36a' : r >= 40 ? '#8a93a6' : r >= 25 ? '#c98a5a' : '#c4504a';
// o: { cc, rel(iso), stab(iso), conf(k) → { step, stab, int }, sel, deal(iso), aid(iso) → [] }
export async function mapSvg(o) {
  const gj = await geo(); if (!gj) return '<div class="meta">Картата не се зареди.</div>';
  const me = o.cc === 'RU' ? 'RUS' : 'USA';
  let paths = '';
  for (const f of gj.features) {
    const a3 = f.properties.a3; if (a3 === 'ATA') continue;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const d = polys.map(p => p.map(r => 'M' + r.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join('L') + 'Z').join('')).join('');
    const known = !!POL[a3], fill = a3 === me ? (o.cc === 'RU' ? '#d52b1e' : '#3c6fd6') : known ? relCol(o.rel(a3)) : '#2a3446';
    paths += `<path d="${d}" fill="${fill}" fill-opacity="${known ? 0.85 : 0.6}" stroke="${o.sel === a3 ? '#ffd54a' : '#0b1220'}" stroke-width="${o.sel === a3 ? 1.6 : 0.4}"${known ? ` data-pol="${a3}" style="cursor:pointer"` : ''}><title>${known ? POL[a3].nm : f.properties.nm}</title></path>`;
  }
  let caps = '';
  for (const [a3, c] of Object.entries(POL)) caps += `<g data-pol="${a3}" style="cursor:pointer"><circle cx="${X(c.lon).toFixed(1)}" cy="${Y(c.lat).toFixed(1)}" r="${a3 === me ? 3.4 : 2.2}" fill="#fff" stroke="#0b1220" stroke-width=".6"/>${o.deal && o.deal(a3) ? `<text x="${X(c.lon) + 3}" y="${Y(c.lat) - 3}" font-size="8">🤝</text>` : ''}${(o.aid ? o.aid(a3) : []).length ? `<text x="${X(c.lon) - 10}" y="${Y(c.lat) - 3}" font-size="8">📦</text>` : ''}</g>`;
  let war = '';
  for (const c of CONFLICTS) { const s = o.conf(c.k); if (s.step >= 6) continue; const peace = s.step >= 3, r = 7 + (peace ? 0 : s.int / 14);
    war += `<g data-conf="${c.k}" style="cursor:pointer"><circle cx="${X(c.lon)}" cy="${Y(c.lat)}" r="${r}" fill="${peace ? '#4fc3f7' : '#ff4d4d'}" fill-opacity=".25" stroke="${peace ? '#4fc3f7' : '#ff4d4d'}" stroke-width="1.2"><animate attributeName="r" values="${r};${r * 1.35};${r}" dur="${peace ? 4 : 1.6}s" repeatCount="indefinite"/></circle><text x="${X(c.lon)}" y="${Y(c.lat) + 4}" font-size="11" text-anchor="middle">${peace ? '🕊️' : c.ico}</text><title>${c.nm}${peace ? ' — примирие' : ''}</title></g>`; }
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;background:#0e1a2e;border-radius:12px">${paths}${war}${caps}</svg>`;
}
