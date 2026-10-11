// resorts.js — Фаза 5: курорти. Зимни (Боровец, Пампорово, Банско), летни (Приморско, Слънчев бряг) и балнео (Велинград).
// Купуваш земя, строиш вилно селище, после го продаваш с голяма печалба или го държиш за сезонен приход.
// Сезоните идват от деня в играта: 30 дни = 1 месец, ден 1 е 1 април.

export const RESORTS = [
  { id: 'borovets', nm: 'Боровец', kind: 'winter', ico: '⛷️', lat: 42.36, lon: 23.58, lab: [0, -13, 'middle'], land: 1000000, build: 2000000, days: 20, sell: 5000000, month: 30000 },   // точката е малко над истинското място, за да не закрива „Пазарджик“
  { id: 'pamporovo', nm: 'Пампорово', kind: 'winter', ico: '🏂', lat: 41.648, lon: 24.690, lab: [0, 21, 'middle'], land: 900000, build: 1800000, days: 18, sell: 4500000, month: 26000 },
  { id: 'primorsko', nm: 'Приморско', kind: 'summer', ico: '🏖️', lat: 42.268, lon: 27.756, lab: [-12, 4, 'end'], land: 1000000, build: 2000000, days: 20, sell: 5000000, month: 30000 },
  { id: 'bansko', nm: 'Банско', kind: 'winter', ico: '🎿', lat: 41.74, lon: 23.62, lab: [12, 4, 'start'], land: 1400000, build: 2600000, days: 24, sell: 6800000, month: 42000 },
  { id: 'sunnybeach', nm: 'Слънчев бряг', kind: 'summer', ico: '🌴', lat: 42.73, lon: 27.72, lab: [0, -13, 'middle'], land: 1600000, build: 2800000, days: 24, sell: 7200000, month: 46000 },
  { id: 'velingrad', nm: 'Велинград', kind: 'spa', ico: '♨️', lat: 41.93, lon: 24.08, lab: [12, 4, 'start'], land: 700000, build: 1500000, days: 16, sell: 3600000, month: 14000 },
  // 🇹🇷 Турция (ниво 6 — чужбина) и 🏔️ Алпите (ниво 8 — Европа): ~3× по-скъпи от българските, но и с ~3× наем
  { id: 'antalya', nm: 'Анталия', cc: '🇹🇷', dev: 6, kind: 'summer', ico: '🏖️', lat: 36.88, lon: 30.70, lab: [0, 21, 'middle'], land: 3000000, build: 6000000, days: 26, sell: 15000000, month: 90000 },
  { id: 'bodrum', nm: 'Бодрум', cc: '🇹🇷', dev: 6, kind: 'summer', ico: '⛵', lat: 37.03, lon: 27.43, lab: [-12, 4, 'end'], land: 3600000, build: 6600000, days: 28, sell: 16800000, month: 105000 },
  { id: 'marmaris', nm: 'Мармарис', cc: '🇹🇷', dev: 6, kind: 'summer', ico: '🌴', lat: 36.85, lon: 28.27, lab: [12, 14, 'start'], land: 3000000, build: 5700000, days: 25, sell: 14400000, month: 85000 },
  { id: 'uludag', nm: 'Улудаг', cc: '🇹🇷', dev: 6, kind: 'winter', ico: '⛷️', lat: 40.10, lon: 29.12, lab: [12, 4, 'start'], land: 2700000, build: 5400000, days: 24, sell: 13500000, month: 78000 },
  { id: 'chamonix', nm: 'Шамони', cc: '🇫🇷', dev: 8, kind: 'winter', ico: '🏔️', lat: 45.92, lon: 6.87, lab: [-12, 4, 'end'], land: 4800000, build: 8400000, days: 30, sell: 21600000, month: 138000 },
  { id: 'zermatt', nm: 'Церматт', cc: '🇨🇭', dev: 8, kind: 'winter', ico: '🗻', lat: 46.02, lon: 7.75, lab: [0, 21, 'middle'], land: 5400000, build: 9000000, days: 32, sell: 24000000, month: 150000 },
  { id: 'stanton', nm: 'Санкт Антон', cc: '🇦🇹', dev: 8, kind: 'winter', ico: '🎿', lat: 47.13, lon: 10.27, lab: [12, 4, 'start'], land: 4200000, build: 7800000, days: 28, sell: 19500000, month: 126000 },
  { id: 'cortina', nm: 'Кортина д’Ампецо', cc: '🇮🇹', dev: 8, kind: 'winter', ico: '🏂', lat: 46.54, lon: 12.14, lab: [12, 4, 'start'], land: 4500000, build: 8100000, days: 29, sell: 20400000, month: 132000 },
  // Френската ривиера (Лазурният бряг) — най-скъпите летни курорти, ~5× българските
  { id: 'cannes', nm: 'Кан', cc: '🇫🇷', reg: 'Ривиера', dev: 8, kind: 'summer', ico: '🎬', lat: 43.55, lon: 7.02, lab: [-12, 4, 'end'], land: 6000000, build: 10500000, days: 32, sell: 27000000, month: 175000 },
  { id: 'sttropez', nm: 'Сен Тропе', cc: '🇫🇷', reg: 'Ривиера', dev: 8, kind: 'summer', ico: '🛥️', lat: 43.27, lon: 6.64, lab: [0, 21, 'middle'], land: 6600000, build: 11400000, days: 34, sell: 30000000, month: 195000 },
  { id: 'antibes', nm: 'Антиб', cc: '🇫🇷', reg: 'Ривиера', dev: 8, kind: 'summer', ico: '⛵', lat: 43.58, lon: 7.12, lab: [12, 14, 'start'], land: 5400000, build: 9600000, days: 30, sell: 24000000, month: 155000 },
  { id: 'monaco', nm: 'Монте Карло', cc: '🇲🇨', reg: 'Ривиера', dev: 9, kind: 'summer', ico: '🎰', lat: 43.74, lon: 7.42, lab: [12, 4, 'start'], land: 9000000, build: 15000000, days: 38, sell: 40000000, month: 260000 },
  // Средиземноморието (ниво 8): гръцките острови, Хърватия, Майорка, Амалфи
  { id: 'santorini', nm: 'Санторини', cc: '🇬🇷', reg: 'Средиземно море', dev: 8, kind: 'summer', ico: '🏝️', lat: 36.39, lon: 25.46, lab: [12, 4, 'start'], land: 4200000, build: 7800000, days: 28, sell: 19500000, month: 125000 },
  { id: 'mykonos', nm: 'Миконос', cc: '🇬🇷', reg: 'Средиземно море', dev: 8, kind: 'summer', ico: '🌅', lat: 37.45, lon: 25.33, lab: [12, 4, 'start'], land: 4500000, build: 8100000, days: 29, sell: 20400000, month: 132000 },
  { id: 'dubrovnik', nm: 'Дубровник', cc: '🇭🇷', reg: 'Средиземно море', dev: 8, kind: 'summer', ico: '🏰', lat: 42.65, lon: 18.09, lab: [12, 4, 'start'], land: 3900000, build: 7200000, days: 27, sell: 18000000, month: 115000 },
  { id: 'mallorca', nm: 'Майорка', cc: '🇪🇸', reg: 'Средиземно море', dev: 8, kind: 'summer', ico: '🌴', lat: 39.57, lon: 2.65, lab: [12, 4, 'start'], land: 4200000, build: 7800000, days: 28, sell: 19500000, month: 125000 },
  { id: 'amalfi', nm: 'Амалфи', cc: '🇮🇹', reg: 'Средиземно море', dev: 8, kind: 'summer', ico: '🍋', lat: 40.63, lon: 14.60, lab: [12, 4, 'start'], land: 4800000, build: 8400000, days: 30, sell: 21600000, month: 138000 },
  // Алпите — още ски курорти
  { id: 'stmoritz', nm: 'Санкт Мориц', cc: '🇨🇭', dev: 8, kind: 'winter', ico: '💎', lat: 46.50, lon: 9.84, lab: [12, 4, 'start'], land: 5400000, build: 9000000, days: 32, sell: 24000000, month: 150000 },
  { id: 'courchevel', nm: 'Куршевел', cc: '🇫🇷', dev: 8, kind: 'winter', ico: '🏔️', lat: 45.41, lon: 6.63, lab: [-12, 4, 'end'], land: 5100000, build: 8700000, days: 31, sell: 22800000, month: 144000 },
  // Балнео курорти в Европа (целогодишни)
  { id: 'karlovyvary', nm: 'Карлови Вари', cc: '🇨🇿', reg: 'Балнео Европа', dev: 8, kind: 'spa', ico: '♨️', lat: 50.23, lon: 12.87, lab: [12, 4, 'start'], land: 3000000, build: 5400000, days: 22, sell: 14000000, month: 42000 },
  { id: 'badenbaden', nm: 'Баден-Баден', cc: '🇩🇪', reg: 'Балнео Европа', dev: 8, kind: 'spa', ico: '🛁', lat: 48.76, lon: 8.24, lab: [12, 4, 'start'], land: 3300000, build: 6000000, days: 24, sell: 15600000, month: 46000 },
  { id: 'heviz', nm: 'Хевиз', cc: '🇭🇺', reg: 'Балнео Европа', dev: 8, kind: 'spa', ico: '🌊', lat: 46.79, lon: 17.19, lab: [12, 4, 'start'], land: 2400000, build: 4500000, days: 20, sell: 11500000, month: 34000 },
  // 🌍 Африка — отключват се, когато имаш поне need.n филиала/града в държавата (need.cities)
  { id: 'hurghada', nm: 'Хургада', cc: '🇪🇬', reg: 'Африка', cont: 'af', need: { n: 2, cities: ['cairo', 'alexandria', 'giza', 'luxor', 'aswan'] }, kind: 'summer', ico: '🐠', lat: 27.26, lon: 33.81, lab: [12, 4, 'start'], land: 3600000, build: 6600000, days: 26, sell: 17000000, month: 110000 },
  { id: 'sharm', nm: 'Шарм ел Шейх', cc: '🇪🇬', reg: 'Африка', cont: 'af', need: { n: 3, cities: ['cairo', 'alexandria', 'giza', 'luxor', 'aswan'] }, kind: 'summer', ico: '🤿', lat: 27.91, lon: 34.33, lab: [12, 4, 'start'], land: 4200000, build: 7500000, days: 28, sell: 19500000, month: 125000 },
  { id: 'hammamet', nm: 'Хамамет', cc: '🇹🇳', reg: 'Африка', cont: 'af', need: { n: 2, cities: ['tunis', 'sfax', 'sousse', 'kairouan', 'bizerte'] }, kind: 'summer', ico: '🏖️', lat: 36.40, lon: 10.62, lab: [12, 4, 'start'], land: 3000000, build: 5700000, days: 24, sell: 14400000, month: 88000 },
  { id: 'djerba', nm: 'Джерба', cc: '🇹🇳', reg: 'Африка', cont: 'af', need: { n: 3, cities: ['tunis', 'sfax', 'sousse', 'kairouan', 'bizerte'] }, kind: 'summer', ico: '🏝️', lat: 33.81, lon: 10.86, lab: [12, 4, 'start'], land: 3300000, build: 6000000, days: 25, sell: 15600000, month: 95000 },
  { id: 'agadir', nm: 'Агадир', cc: '🇲🇦', reg: 'Африка', cont: 'af', need: { n: 2, cities: ['casablanca', 'rabat', 'marrakesh', 'tangier', 'fes'] }, kind: 'summer', ico: '🌴', lat: 30.42, lon: -9.60, lab: [12, 4, 'start'], land: 3300000, build: 6000000, days: 25, sell: 15600000, month: 95000 },
  { id: 'palmeraie', nm: 'Маракеш — Палмераие', cc: '🇲🇦', reg: 'Африка', cont: 'af', need: { n: 3, cities: ['casablanca', 'rabat', 'marrakesh', 'tangier', 'fes'] }, kind: 'spa', ico: '🕌', lat: 31.68, lon: -7.95, lab: [12, 4, 'start'], land: 3000000, build: 5700000, days: 24, sell: 15000000, month: 44000 },
  { id: 'malindi', nm: 'Малинди', cc: '🇰🇪', reg: 'Африка', cont: 'af', need: { n: 2, cities: ['nairobi', 'mombasa', 'kisumu', 'nakuru', 'eldoret'] }, kind: 'summer', ico: '🐚', lat: -3.22, lon: 40.12, lab: [12, 4, 'start'], land: 3000000, build: 5700000, days: 24, sell: 14400000, month: 88000 },
  { id: 'nungwi', nm: 'Нунгви (Занзибар)', cc: '🇹🇿', reg: 'Африка', cont: 'af', need: { n: 2, cities: ['daressalaam', 'dodoma', 'arusha', 'mwanza', 'zanzibar'] }, kind: 'summer', ico: '🏝️', lat: -5.73, lon: 39.30, lab: [12, 4, 'start'], land: 3900000, build: 7200000, days: 27, sell: 18000000, month: 115000 },
  { id: 'campsbay', nm: 'Кампс Бей', cc: '🇿🇦', reg: 'Африка', cont: 'af', need: { n: 2, cities: ['capetown', 'johannesburg', 'durban', 'pretoria', 'portelizabeth'] }, kind: 'summer', ico: '🌊', lat: -33.95, lon: 18.38, lab: [12, 14, 'start'], land: 4500000, build: 8100000, days: 29, sell: 20400000, month: 130000 },
];
// разширения след вилното селище: строят се за дни и вдигат наема (mul) и цената при продажба (sellAdd)
export const EXTRAS = {
  hotel:    { nm: 'Хотел', ico: '🏨', cost: 1500000, days: 15, mul: 0.5, sellAdd: 2500000, kinds: ['winter', 'summer', 'spa'] },
  lift:     { nm: 'Собствен лифт', ico: '🚡', cost: 800000, days: 10, mul: 0.3, sellAdd: 1200000, kinds: ['winter'] },
  aquapark: { nm: 'Аквапарк', ico: '🛝', cost: 900000, days: 12, mul: 0.35, sellAdd: 1300000, kinds: ['summer'] },
  spa:      { nm: 'СПА център', ico: '🧖', cost: 700000, days: 10, mul: 0.4, sellAdd: 1100000, kinds: ['spa'] },
  baths:    { nm: 'Минерални бани', ico: '♨️', cost: 650000, days: 9, mul: 0.3, sellAdd: 1000000, kinds: ['spa', 'winter'] },
  snow:     { nm: 'Оръдия за сняг', ico: '❄️', cost: 500000, days: 6, mul: 0.25, sellAdd: 700000, kinds: ['winter'] },
  skischool:{ nm: 'Ски училище', ico: '⛷️', cost: 350000, days: 6, mul: 0.15, sellAdd: 500000, kinds: ['winter'] },
  marina:   { nm: 'Яхтено пристанище', ico: '⛵', cost: 1100000, days: 14, mul: 0.4, sellAdd: 1600000, kinds: ['summer'] },
  golf:     { nm: 'Голф игрище', ico: '⛳', cost: 900000, days: 12, mul: 0.3, sellAdd: 1300000, kinds: ['summer', 'spa'] },
  restaurant:{ nm: 'Ресторант', ico: '🍽️', cost: 300000, days: 5, mul: 0.15, sellAdd: 450000, kinds: ['winter', 'summer', 'spa'] },
};
// разширенията в скъпите курорти (Турция, Алпите, Ривиера…) струват пропорционално повече — колкото е по-скъпа земята
export const extCost = (r, x) => Math.round(x.cost * Math.max(1, r.land / 1000000) / 10000) * 10000;
// кога се отключва фазата
export const UNLOCK = { rep: 4, done: 25 };
const MONTHS = ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'];
const SEASON = { winter: [11, 0, 1, 2], summer: [5, 6, 7, 8] };   // дек–мар / юни–сеп
export const DAYS_PER_MONTH = 30;
export const monthOf = day => (3 + Math.floor((day - 1) / DAYS_PER_MONTH)) % 12;
export const monthName = day => MONTHS[monthOf(day)];
export const seasonOf = day => SEASON.winter.includes(monthOf(day)) ? 'winter' : SEASON.summer.includes(monthOf(day)) ? 'summer' : 'off';
const SEASON_TXT = { winter: '❄️ зимен сезон', summer: '☀️ летен сезон', off: '🍂 извън сезона' };

// стилове на хотела (resortview.js рисува модела): първият е по подразбиране; 'kenney' — кулите на Kenney
export const HOTEL_STYLES = {
  summer: [{ key: 'marina', nm: 'Марина с палми' }, { key: 'miami', nm: 'Маями — бяла кула' }, { key: 'hirise', nm: 'Висока кула с басейн' }, { key: 'kenney', nm: 'Класически' }],
  winter: [{ key: 'skihotel', nm: 'Роза Хутор' }, { key: 'villa', nm: 'Планинска вила' }, { key: 'kenney', nm: 'Класически' }],
};
const RESTYLE = 250000;   // смяна на стила на готов хотел
export const hotelStylesOf = kind => HOTEL_STYLES[kind === 'summer' ? 'summer' : 'winter'];
// deps: { S: () => S, econ, toast(text, kind), modal(title, html, buttons), proj(lon, lat) → [x, y], fmt(n), save(), redraw(), sound(name), onUnlock?(), enter?(id) — 3D изглед }
export function createResorts(deps) {
  const st = () => { const S = deps.S(); S.resorts = S.resorts || {}; return S.resorts; };
  const unlocked = () => { const S = deps.S(); return !!S && (S.resortsOpen || S.rep >= UNLOCK.rep || (S.done || 0) >= UNLOCK.done); };
  const R = id => RESORTS.find(r => r.id === id);
  // чуждите курорти се отварят с нивото на развитие (dev); символите на картата растат с мащаба ѝ (symK)
  const haveIn = r => r.need ? r.need.cities.filter(id => (deps.owned ? deps.owned() : []).includes(id)).length : 0;
  const avail = r => r.need ? haveIn(r) >= r.need.n : (!r.dev || (deps.devBest ? deps.devBest() >= r.dev : true));
  const lockTxt = r => r.need ? `${r.need.n} града в ${r.cc} (имаш ${haveIn(r)})` : `ниво ${r.dev}`;
  const RG_TITLE = { 'България': '🇧🇬 България', 'Турция': '🇹🇷 Турция', 'Алпите': '🏔️ Алпите', 'Ривиера': '🌊 Френската ривиера', 'Средиземно море': '🏝️ Средиземно море', 'Балнео Европа': '♨️ Балнео Европа', 'Африка': '🌍 Африка' };
  const REG = { '🇹🇷': 'Турция', '🇫🇷': 'Алпите', '🇨🇭': 'Алпите', '🇦🇹': 'Алпите', '🇮🇹': 'Алпите' };
  const inSeason = (r, day) => r.kind === 'spa' || seasonOf(day) === r.kind;   // балнео курортът работи целогодишно
  const mulOf = s => 1 + Object.keys(s.ext || {}).reduce((a, k) => a + (EXTRAS[k] ? EXTRAS[k].mul : 0), 0);
  const sellOf = (r, s) => r.sell + Object.keys(s.ext || {}).reduce((a, k) => a + (EXTRAS[k] ? EXTRAS[k].sellAdd : 0), 0);
 // приход на година: месечният наем × разширенията × месеците в сезона (4 за ски/море, 12 за балнео)
  const yearOf = (r, s) => Math.round(r.month * (s ? mulOf(s) : 1) * (r.kind === 'spa' ? 12 : 4));
  const seasonWord = r => r.kind === 'winter' ? 'зимата' : r.kind === 'summer' ? 'лятото' : 'целогодишно';

  // символи на картата (SVG); заключените са сиви с катинар
  function svg(cont = null) {   // cont — изгледът на континент ('af'…) или null за Европа/България
    const S = deps.S(); if (!S) return '';
    const open = unlocked();
    const k0 = deps.symK ? deps.symK() : 1;
    return RESORTS.filter(r => (r.cont || null) === cont && (cont || k0 < 2.5 || r.cc)).map(r => {   // на картата на Европа българските курорти се скриват (твърде са нагъсто)
      const [x, y] = deps.proj(r.lon, r.lat), s = st()[r.id], stage = s ? s.stage : null, k = deps.symK ? deps.symK() : 1, ok = open && avail(r);
      const badge = stage === 'built' ? (inSeason(r, S.day) ? '💶' : '💤') : stage === 'building' ? '🔨' : stage === 'land' ? '🟩' : stage === 'sold' ? '✅' : '';
      return `<g class="resort" data-resort="${r.id}" style="cursor:pointer;opacity:${ok ? 1 : 0.55}" transform="translate(${x} ${y}) scale(${k}) translate(${-x} ${-y})">
        <circle cx="${x}" cy="${y}" r="9" fill="${r.kind === 'winter' ? '#dff1ff' : '#fff1c2'}" stroke="${r.kind === 'winter' ? '#3a7bd5' : '#e09a00'}" stroke-width="2"/>
        <text x="${x}" y="${y + 4.5}" text-anchor="middle" style="font-size:11px">${ok ? r.ico : '🔒'}</text>
        <text x="${x + r.lab[0]}" y="${y + r.lab[1]}" text-anchor="${r.lab[2]}" style="font-size:10px;font-weight:700;fill:#1f2a19;paint-order:stroke;stroke:#ffffffcc;stroke-width:3px">${r.cc ? r.cc + ' ' : ''}${r.nm}${badge ? ' ' + badge : ''}</text></g>`;
    }).join('');
  }
  // блок в панела на картата
  function hudHtml() {
    const S = deps.S(); if (!S) return '';
    let h = `<div class="sect">🏔️ Фаза 5 · Курорти · ${monthName(S.day)}, ${SEASON_TXT[seasonOf(S.day)]}</div>`;
    if (!unlocked()) return h + `<div class="meta">🔒 Отключва се при репутация ${UNLOCK.rep} ★ или ${UNLOCK.done} завършени обекта (сега: ${S.rep.toFixed(1)} ★, ${S.done || 0}).</div>`;
    let reg = null;
    for (const r of RESORTS) {
      const s = st()[r.id], rg = r.reg || REG[r.cc] || 'България';
      if (rg !== reg) { reg = rg; if (rg !== 'България') h += `<div class="meta" style="margin:6px 0 0;font-weight:700;color:var(--txt)">${RG_TITLE[rg] || rg} · ~${rg === 'Ривиера' ? 5 : 3}× по-скъпи и по-доходни${avail(r) ? '' : ` · 🔒 ${lockTxt(r)}`}</div>`; }
      if (!avail(r)) continue;
      const txt = !s ? `свободен · земя ${deps.fmt(r.land)} €`
        : s.stage === 'land' ? 'твоя земя — строй вилно селище'
        : s.stage === 'building' ? `строи се ${Math.round(s.prog * 100)}%`
        : s.stage === 'built' ? `~${deps.fmt(yearOf(r, s))} €/год. (${deps.fmt(r.month * mulOf(s))} €/мес. ${seasonWord(r)})${Object.keys(s.ext || {}).map(k => ' ' + EXTRAS[k].ico).join('')}${s.extBuild ? ` · 🔨 ${EXTRAS[s.extBuild.key].nm} ${Math.round(s.extBuild.prog * 100)}%` : ''} · спечелено ${deps.fmt(s.earned || 0)} €`
        : `продаден за ${deps.fmt(s.soldFor)} €`;
      h += `<div class="row" style="margin:0"><span class="meta" style="margin:0">${r.ico} <b style="color:var(--txt)">${r.nm}</b> · ${txt}</span><button class="btn2" data-resort-open="${r.id}">Отвори</button></div>`;
    }
    return h;
  }
  // бутони за разширенията направо в прозореца „Курорти“: едно натискане — строи (по едно наведнъж)
  function extRow(r, s) {
    if (!s || s.stage !== 'built') return '';
    const have = Object.keys(s.ext || {}), econ = deps.econ();
    const opts = Object.entries(EXTRAS).filter(([k, x]) => x.kinds.includes(r.kind) && !have.includes(k));
    if (!opts.length) return '';
    if (s.extBuild) return `<div class="meta" style="margin:0 0 6px 24px">🔨 Строи се ${EXTRAS[s.extBuild.key].ico} ${EXTRAS[s.extBuild.key].nm} — ${Math.round(s.extBuild.prog * 100)}%</div>`;
    return `<div style="display:flex;flex-wrap:wrap;gap:5px;margin:0 0 8px 24px">${opts.map(([k, x]) => { const c = extCost(r, x);
      return `<button class="btn2" data-rext="${r.id}:${k}" style="padding:4px 8px;font-size:12px" ${econ.canAfford(c) ? '' : 'disabled'} title="${x.days} дни · наем +${Math.round(x.mul * 100)}%">${x.ico} ${x.nm} · ${deps.fmt(c)} €</button>`; }).join('')}</div>`;
  }
  function startExt(id, k) {
    const r = R(id), s = st()[id], x = EXTRAS[k], econ = deps.econ();
    if (!r || !s || s.stage !== 'built' || s.extBuild || (s.ext || {})[k] || !x) return false;
    const c = extCost(r, x);
    if (!econ.canAfford(c)) { deps.toast(`Нямаш достатъчно пари за ${x.nm.toLowerCase()}.`, 'bad'); return false; }
    econ.spend(c, 'покупка', `${r.nm}: ${x.nm.toLowerCase()}`);
    s.extBuild = { key: k, prog: 0 };
    deps.sound('buy'); deps.toast(`🔨 ${x.ico} ${x.nm} в ${r.nm} (${x.days} дни).`, 'good'); deps.save(); deps.redraw();
    return true;
  }
  // големият прозорец „🏔️ Курорти“ (бутонът с прихода горе в лентата)
  function winHtml(ok = () => true) {   // ok(r) — филтър по обхват (България/Балкани/Европа…) от game.js
    const S = deps.S(); if (!S) return '';
    if (!unlocked()) return `<div class="card"><div class="meta">🔒 Курортите са Фаза 5 — отключват се при репутация ${UNLOCK.rep} ★ или ${UNLOCK.done} завършени обекта (сега: ${S.rep.toFixed(1)} ★, ${S.done || 0}).</div></div>`;
    const mine = RESORTS.filter(r => st()[r.id]?.stage === 'built'), earned = RESORTS.reduce((a, r) => a + (st()[r.id]?.earned || 0), 0);
    let h = `<div class="bw-stats"><div><b>${deps.fmt(dailyNow(S.day))} €</b><span>днес на ден</span></div><div><b>${deps.fmt(mine.reduce((a, r) => a + yearOf(r, st()[r.id]), 0))} €</b><span>~ на година</span></div><div><b>${mine.length} / ${RESORTS.filter(avail).length}</b><span>твои курорти</span></div><div><b>${deps.fmt(earned)} €</b><span>спечелено общо</span></div></div>
      <div class="meta" style="margin:10px 0 0">${monthName(S.day)} · ${SEASON_TXT[seasonOf(S.day)]}. ❄️ Ски: декември–март · ☀️ Море: юни–септември · ♨️ Балнео: целогодишно.</div>`;
    const groups = {};
    for (const r of RESORTS) if (ok(r)) (groups[r.reg || REG[r.cc] || 'България'] ||= []).push(r);
    if (!Object.keys(groups).length) h += `<div class="card"><div class="meta" style="margin:0">Няма курорти в този обхват.</div></div>`;
    for (const [rg, list] of Object.entries(groups)) {
      const lock = list.find(r => !avail(r));
      const rows = list.map(r => {
        const s = st()[r.id], on = s?.stage === 'built' && inSeason(r, S.day);
        const txt = !avail(r) ? `🔒 ${lockTxt(r)} · земя ${deps.fmt(r.land)} €`
          : !s ? `свободен · земя ${deps.fmt(r.land)} € · ~${deps.fmt(yearOf(r))} €/год. след строеж`
          : s.stage === 'land' ? '🟩 твоя земя — строй вилно селище'
          : s.stage === 'building' ? `🔨 строи се ${Math.round(s.prog * 100)}%`
          : s.stage === 'built' ? `${on ? `<b style="color:var(--ok)">💶 +${deps.fmt(Math.round(r.month * mulOf(s) / DAYS_PER_MONTH))} €/ден</b>` : `💤 извън сезона`} · ~${deps.fmt(yearOf(r, s))} €/год.${Object.keys(s.ext || {}).map(k => ' ' + EXTRAS[k].ico).join('')}${s.extBuild ? ` · 🔨 ${EXTRAS[s.extBuild.key].nm} ${Math.round(s.extBuild.prog * 100)}%` : ''} · спечелено ${deps.fmt(s.earned || 0)} €`
          : `✅ продаден за ${deps.fmt(s.soldFor)} €`;
        return `<div class="row" style="margin:4px 0;align-items:center"><span class="meta" style="margin:0">${r.ico} <b style="color:var(--txt)">${r.nm}</b> <span style="opacity:.7">${r.kind === 'winter' ? '❄️' : r.kind === 'summer' ? '☀️' : '♨️'}</span><br>${txt}</span><button class="btn${s?.stage === 'built' ? '2' : ''}" data-resort-open="${r.id}">Отвори</button></div>${extRow(r, s)}`;
      }).join('');
      h += `<div class="card"><h3>${RG_TITLE[rg] || rg}${rg !== 'България' ? ` <span class="meta" style="margin:0 0 0 auto">~${rg === 'Ривиера' ? 5 : 3}× по-скъпи и по-доходни</span>` : ''}</h3>${rows}</div>`;
    }
    return h;
  }
  // прозорецът на курорта
  function open(id) {
    const S = deps.S(), r = R(id), s = st()[id], econ = deps.econ(), enter = deps.enter ? () => deps.enter(id) : null;
    const season = `${r.kind === 'winter' ? '❄️ Зимен курорт: приход декември–март' : r.kind === 'summer' ? '☀️ Летен курорт: приход юни–септември' : '♨️ Балнео курорт: приход целогодишно'}. Сега е ${monthName(S.day).toLowerCase()} (${SEASON_TXT[seasonOf(S.day)]}).`;
    if (!avail(r) && r.need) return deps.modal(`🔒 ${r.cc} ${r.nm}`, `Курортите в Африка се отключват, когато имаш поне <b>${r.need.n} града</b> в ${r.cc} (сега: ${haveIn(r)}).<br>Купи филиали в: ${r.need.cities.map(id => deps.cityName ? deps.cityName(id) : id).join(', ')}.<br>Земя ${deps.fmt(r.land)} € · вилно селище ${deps.fmt(r.build)} € · продажба ~${deps.fmt(r.sell)} € · наем ${deps.fmt(r.month)} €/мес.<br><br>${season}`, [['Добре', null]]);
    if (!avail(r)) return deps.modal(`🔒 ${r.cc || ''} ${r.nm}`, `${(r.reg || REG[r.cc]) === 'Турция' ? 'Турските курорти' : r.reg === 'Ривиера' ? 'Курортите на Френската ривиера' : 'Курортите в Алпите'} се отключват на <b>ниво ${r.dev} на развитие</b>${deps.devBest ? ` (сега: ${deps.devBest()})` : ''}.<br>Земя ${deps.fmt(r.land)} € · вилно селище ${deps.fmt(r.build)} € · продажба ~${deps.fmt(r.sell)} € · наем ${deps.fmt(r.month)} €/мес.<br><br>${season}`, [['Добре', null]]);
    if (!unlocked()) return deps.modal(`🔒 ${r.nm}`, `Курортите са Фаза 5. Отключват се при репутация ${UNLOCK.rep} ★ или ${UNLOCK.done} завършени обекта.<br><br>${season}`, [['Добре', null]]);
    const plan = `Земя <b>${deps.fmt(r.land)} €</b> → вилно селище <b>${deps.fmt(r.build)} €</b> (${r.days} дни) → продажба за <b>${deps.fmt(r.sell)} €</b> или наем ~<b>${deps.fmt(r.month)} €/месец</b> в сезона — <b>~${deps.fmt(yearOf(r))} €/година</b>.`;
    if (!s) return deps.modal(`${r.ico} ${r.nm}`, `${season}<br><br>${plan}`, [['👁 Влез', enter], ['Затвори', null], [`Купи земята · ${deps.fmt(r.land)} €`, () => {
      if (!econ.canAfford(r.land)) { deps.toast('Нямаш достатъчно пари за земята. Вземи кредит или продай имот.', 'bad'); return; }
      econ.spend(r.land, 'покупка', `${r.nm}: земя за курорт`);
      st()[id] = { stage: 'land', since: S.day };
      deps.sound('buy'); deps.toast(`🟩 Купи земя в ${r.nm}. Сега построй вилно селище.`, 'good'); deps.save(); deps.redraw();
    }]]);
    if (s.stage === 'land') return deps.modal(`${r.ico} ${r.nm} · твоя земя`, `${season}<br><br>Вилното селище струва <b>${deps.fmt(r.build)} €</b> и се строи ${r.days} дни.`, [['👁 Влез', enter], ['Затвори', null], [`Продай земята · ${deps.fmt(Math.round(r.land * 0.9))} €`, () => {
      econ.earn(Math.round(r.land * 0.9), 'продажба', `${r.nm}: земя`); delete st()[id]; deps.save(); deps.redraw();
    }], [`Строй селището · ${deps.fmt(r.build)} €`, () => {
      if (!econ.canAfford(r.build)) { deps.toast('Нямаш достатъчно пари за вилното селище.', 'bad'); return; }
      econ.spend(r.build, 'покупка', `${r.nm}: вилно селище`);
      Object.assign(s, { stage: 'building', prog: 0, start: S.day });
      deps.sound('buy'); deps.toast(`🔨 Започна строежът на вилното селище в ${r.nm} (${r.days} дни).`, 'good'); deps.save(); deps.redraw();
    }]]);
    if (s.stage === 'building') return deps.modal(`${r.ico} ${r.nm} · строи се`, `Вилното селище е готово на ${Math.round(s.prog * 100)}%. Остават ~${Math.ceil((1 - s.prog) * r.days)} дни.<br><br>${season}`, [['👁 Влез', enter], ['Добре', null]]);
    if (s.stage === 'built') {
      const price = sellOf(r, s), have = Object.keys(s.ext || {});
      // разширенията, които още не са построени (по едно наведнъж)
      const opts = Object.entries(EXTRAS).filter(([k, x]) => x.kinds.includes(r.kind) && !have.includes(k));
      const extHtml = s.extBuild ? `<br>🔨 Строи се: <b>${EXTRAS[s.extBuild.key].nm}</b> — ${Math.round(s.extBuild.prog * 100)}%`
        : opts.length ? '<br><br>Разширения (вдигат наема и цената):<br>' + opts.map(([, x]) => `${x.ico} ${x.nm} — ${deps.fmt(extCost(r, x))} €, ${x.days} дни, наем +${Math.round(x.mul * 100)}% (+${deps.fmt(Math.round(r.month * x.mul * (r.kind === 'spa' ? 12 : 4)))} €/год.)`).join('<br>') : '';
      const styles = hotelStylesOf(r.kind), styleNm = () => (styles.find(t => t.key === s.hotelStyle) || styles[0]).nm;
      const pickStyle = (cap, then) => deps.modal(`🏨 ${cap}`, 'Избери как да изглежда хотелът:', [...styles.map(t => [`${t.key === (s.hotelStyle || styles[0].key) ? '✅ ' : ''}${t.nm}`, () => { s.hotelStyle = t.key; then(); }]), ['Отказ', null]]);
      const extBtns = s.extBuild ? [] : opts.map(([k, x]) => [`${x.ico} ${x.nm}`, () => {
        if (k === 'hotel' && !s.styleAsked) return pickStyle(`Хотел в ${r.nm}`, () => { s.styleAsked = true; extBtns.find(b => b[0] === `${x.ico} ${x.nm}`)[1](); });
        s.styleAsked = false;
        if (!econ.canAfford(extCost(r, x))) { deps.toast(`Нямаш достатъчно пари за ${x.nm.toLowerCase()}.`, 'bad'); return; }
        econ.spend(extCost(r, x), 'покупка', `${r.nm}: ${x.nm.toLowerCase()}`);
        s.extBuild = { key: k, prog: 0 };
        deps.sound('buy'); deps.toast(`🔨 Започна строежът: ${x.nm} в ${r.nm} (${x.days} дни).`, 'good'); deps.save(); deps.redraw();
      }]);
      return deps.modal(`${r.ico} ${r.nm} · вилно селище`, `${season}<br><br>Наем: ~<b>${deps.fmt(r.month * mulOf(s))} €/мес.</b> · <b style="color:var(--ok)">~${deps.fmt(yearOf(r, s))} €/година</b>${have.length ? ' (' + have.map(k => EXTRAS[k].ico + ' ' + EXTRAS[k].nm).join(', ') + ')' : ''}<br>Спечелено от наеми: <b>${deps.fmt(s.earned || 0)} €</b>.<br>Купувач предлага <b>${deps.fmt(price)} €</b>.${extHtml}`,
        [['👁 Влез', enter], ...extBtns, ...(have.includes('hotel') ? [[`🏨 Стил: ${styleNm()} · ${deps.fmt(RESTYLE)} €`, () => pickStyle(`Преустройство на хотела в ${r.nm}`, () => { if (!econ.canAfford(RESTYLE)) { deps.toast('Нямаш достатъчно пари за преустройството.', 'bad'); return; } econ.spend(RESTYLE, 'покупка', `${r.nm}: нов стил на хотела`); deps.sound('buy'); deps.toast(`🏨 Хотелът в ${r.nm} вече е „${styleNm()}“.`, 'good'); deps.save(); deps.redraw(); })]] : []), ['Задръж', null], [`Продай · ${deps.fmt(price)} €`, () => {
          econ.earn(price, 'продажба', `${r.nm}: вилно селище`);
          Object.assign(s, { stage: 'sold', soldFor: price, soldDay: S.day });
          deps.sound('cash'); deps.toast(`💰 Продаде вилното селище в ${r.nm} за ${deps.fmt(price)} €!`, 'good'); deps.save(); deps.redraw();
        }]]);
    }
    return deps.modal(`${r.ico} ${r.nm}`, `Продаде селището тук за <b>${deps.fmt(s.soldFor)} €</b> на ден ${s.soldDay}.`, [['👁 Влез', enter], ['Добре', null]]);
  }
  // веднъж на ден (в края на деня): строеж, сезонен наем, отключване на фазата
  function dailyTick(day) {
    const S = deps.S(), econ = deps.econ();
    // африканските курорти: съобщение, когато се отключи нов (достатъчно градове в държавата)
    S.resortNew = S.resortNew || {};
    for (const r of RESORTS) if (r.need && !S.resortNew[r.id] && avail(r)) {
      S.resortNew[r.id] = day;
      if (unlocked()) { deps.sound && deps.sound('offer'); const t = `${r.ico} Нов курорт: ${r.cc} ${r.nm}! Вече имаш ${haveIn(r)} града в държавата — купи земята и строй.`; deps.onNewResort ? deps.onNewResort(r, t) : deps.toast(t, 'good'); }
    }
    if (!S.resortsOpen && unlocked()) {
      S.resortsOpen = true;
      deps.toast('🏔️ Отключи Фаза 5: Курорти! Отвори картата — шест курорта чакат инвестиции: ски, море и балнео.', 'good');
      if (deps.onUnlock) deps.onUnlock();
    }
    const startList = [], week = S.resortWeek && S.resortWeek.parts ? S.resortWeek : { tot: 0, parts: {} };
    for (const r of RESORTS) {
      const s = st()[r.id];
      if (!s) continue;
      if (s.stage === 'building') {
        s.prog = Math.min(1, s.prog + 1 / r.days);
        if (s.prog >= 1) { s.stage = 'built'; s.earned = 0; deps.sound('done'); deps.toast(`🏡 Вилното селище в ${r.nm} е готово! Продай го или го дръж за наем (${seasonWord(r)}).`, 'good'); }
      } else if (s.stage === 'built' && s.extBuild) {
        const x = EXTRAS[s.extBuild.key];
        s.extBuild.prog = Math.min(1, s.extBuild.prog + 1 / x.days);
        if (s.extBuild.prog >= 1) { s.ext = { ...(s.ext || {}), [s.extBuild.key]: true }; delete s.extBuild; deps.onExtDone?.(x.key || Object.keys(EXTRAS).find(k => EXTRAS[k] === x)); deps.sound('done'); deps.toast(`${x.ico} ${x.nm} в ${r.nm} е готов! Наемът се вдига с ${Math.round(x.mul * 100)}%.`, 'good'); }
      }
      const on = s.stage === 'built' && inSeason(r, day), was = s.stage === 'built' && inSeason(r, day - 1);
      if (on && !was && r.kind !== 'spa') { s.season = 0; startList.push(r); }
      if (on) {
        const inc = Math.round(r.month * mulOf(s) / DAYS_PER_MONTH);
        econ.earn(inc, 'курорти', `${r.nm}: наеми (${monthName(day).toLowerCase()})`);
        s.earned = (s.earned || 0) + inc; s.season = (s.season || 0) + inc;
        week.tot += inc; week.parts[r.nm] = (week.parts[r.nm] || 0) + inc;
      }
      // край на сезона (за балнео — всеки месец): голямо съобщение колко е спечелено
      const spaMonth = r.kind === 'spa' && on && day % DAYS_PER_MONTH === 0;
      if ((was && !on || spaMonth) && s.season > 0) {
        const got = s.season; s.season = 0;
        deps.sound('cash');
        const txt = spaMonth ? `♨️ Месец в ${r.nm}: спечели ${deps.fmt(got)} €` : `🏁 Край на сезона в ${r.nm}: спечели ${deps.fmt(got)} €!`;
        deps.toast(`${txt} Общо от курорта: ${deps.fmt(s.earned || 0)} €.`, 'good', () => open(r.id));
        if (deps.onSeasonEnd && !spaMonth) deps.onSeasonEnd(r, got, s.earned || 0);
      }
    }
    // начало на сезона: кои курорти започват да носят пари
    if (startList.length) deps.toast(`${startList[0].kind === 'winter' ? '❄️ Започна ски сезонът' : '☀️ Започна летният сезон'}! ${startList.map(r => r.nm).join(', ')} вече носят наеми — ~${deps.fmt(startList.reduce((a, r) => a + Math.round(r.month * mulOf(st()[r.id]) / DAYS_PER_MONTH), 0))} €/ден.`, 'good');
    // седмичен отчет през сезона
    S.resortWeek = week;
    if (day % 7 === 0 && week.tot > 0) {
      deps.toast(`🏔️ Курортите тази седмица: +${deps.fmt(week.tot)} € (${Object.entries(week.parts).map(([n, v]) => `${n} +${deps.fmt(v)}`).join(', ')})`, 'good');
      S.resortWeek = { tot: 0, parts: {} };
    }
  }
  // приход от курортите днес (за горната лента)
  const dailyNow = day => RESORTS.reduce((a, r) => { const s = st()[r.id]; return a + (s && s.stage === 'built' && inSeason(r, day) ? Math.round(r.month * mulOf(s) / DAYS_PER_MONTH) : 0); }, 0);
  // стойност на курортите (за нетната стойност и статистики)
  const value = () => RESORTS.reduce((a, r) => { const s = st()[r.id]; return a + (!s ? 0 : s.stage === 'land' ? r.land : s.stage === 'building' ? r.land + r.build * s.prog : s.stage === 'built' ? sellOf(r, s) : 0); }, 0);
  // подарък (изкупена фирма): готово вилно селище с разширение в първия свободен курорт от списъка;
  // ако всички са твои — само разширението там, където го няма. Връща името на курорта или null.
  function grant(prefer, ext = 'hotel') {
    const S = deps.S(); S.resortsOpen = true;
    const order = [...prefer, ...RESORTS.map(r => r.id).filter(id => !prefer.includes(id))];
    let r = order.map(R).find(r => { const s = st()[r.id]; return !r.need && (!s || s.stage === 'sold' || s.stage === 'land'); });
    if (r) st()[r.id] = { stage: 'built', since: S.day, earned: 0, ext: EXTRAS[ext].kinds.includes(r.kind) ? { [ext]: true } : {} };
    else { r = order.map(R).find(r => { const s = st()[r.id]; return s.stage === 'built' && !(s.ext || {})[ext] && EXTRAS[ext].kinds.includes(r.kind); }); if (r) st()[r.id].ext = { ...(st()[r.id].ext || {}), [ext]: true }; }
    if (r && deps.onExtDone && ext) deps.onExtDone(ext);
    if (deps.redraw) deps.redraw();
    return r ? r.nm : null;
  }
  return { svg, hudHtml, winHtml, startExt, open, dailyTick, value, unlocked, grant, dailyNow, yearOf: id => { const r = R(id); return yearOf(r, st()[id]); } };
}
