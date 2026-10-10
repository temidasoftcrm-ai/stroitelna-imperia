// rivals.js — конкурентни строителни фирми. Част от поръчките на таблото имат конкурент с краен срок:
// ако не приемеш поръчката до деня, той я взема, а на парцела след няколко дни никне неговата сграда.
// Записът е в S.rivals = { firms: { id: { won, lost } }, sites: [{ lot, firm, ready, type }] } (общ за фирмата).
// deps: S(), toast, fmt, onBuilt(lotId, type) — game.js поставя сградата, когато конкурентът е готов
export const FIRMS = [
  { id: 'glavbild', nm: '„Главболгарстрой“', ico: '🟥', power: 1.0 },
  { id: 'trakia', nm: '„Тракия Билд“', ico: '🟦', power: 0.8 },
  { id: 'vitosha', nm: '„Витоша Строй“', ico: '🟩', power: 0.9 },
  { id: 'dunav', nm: '„Дунав Инженеринг“', ico: '🟨', power: 0.7 },
];
// местни фирми в чужбина (по знамето на града); в България — FIRMS. Имената са измислени.
export const LOCAL_FIRMS = {
  '🇹🇷': [{ id: 'anadolu', nm: '„Анадолу Иншаат“', ico: '🟥', power: 1.0 }, { id: 'bogazici', nm: '„Боазичи Япъ“', ico: '🟦', power: 0.9 }, { id: 'marmara', nm: '„Мармара Билд“', ico: '🟩', power: 0.85 }, { id: 'kapadokya', nm: '„Кападокия Холдинг“', ico: '🟨', power: 0.75 }],
  '🇷🇴': [{ id: 'carpati', nm: '„Карпаци Констракт“', ico: '🟥', power: 0.9 }, { id: 'dunarea', nm: '„Дунъря Билд“', ico: '🟦', power: 0.8 }, { id: 'valahia', nm: '„Валахия Имо“', ico: '🟨', power: 0.75 }],
  '🇬🇷': [{ id: 'aigaio', nm: '„Егейска Техники“', ico: '🟦', power: 0.9 }, { id: 'olympos', nm: '„Олимп Строй“', ico: '🟥', power: 0.85 }, { id: 'akropoli', nm: '„Акропол Билд“', ico: '🟨', power: 0.75 }],
  '🇷🇸': [{ id: 'morava', nm: '„Морава Градня“', ico: '🟥', power: 0.85 }, { id: 'sava', nm: '„Сава Инженеринг“', ico: '🟦', power: 0.8 }],
  '🇲🇰': [{ id: 'vardar', nm: '„Вардар Градба“', ico: '🟥', power: 0.8 }, { id: 'ohrid', nm: '„Охрид Билд“', ico: '🟦', power: 0.7 }],
  '🇩🇪': [{ id: 'rheinbau', nm: '„Райнбау“', ico: '⬛', power: 1.0 }, { id: 'alpenhoch', nm: '„Алпенхох Бау“', ico: '🟥', power: 0.95 }],
  '🇫🇷': [{ id: 'seine', nm: '„Сен Конструксион“', ico: '🟦', power: 1.0 }, { id: 'loire', nm: '„Луара Бати“', ico: '🟥', power: 0.9 }],
  '🇬🇧': [{ id: 'thames', nm: '„Темза Билдърс“', ico: '🟥', power: 1.0 }, { id: 'albion', nm: '„Албион Констракшън“', ico: '🟦', power: 0.9 }],
  '🇮🇹': [{ id: 'tevere', nm: '„Тевере Костручони“', ico: '🟩', power: 0.95 }, { id: 'appennino', nm: '„Апенини Едиле“', ico: '🟥', power: 0.85 }],
  '🇪🇸': [{ id: 'iberia', nm: '„Иберия Конструкта“', ico: '🟨', power: 0.95 }, { id: 'tajo', nm: '„Тахо Обрас“', ico: '🟥', power: 0.85 }],
  '🇳🇱': [{ id: 'polder', nm: '„Полдер Бау“', ico: '🟧', power: 0.95 }, { id: 'delta', nm: '„Делта Бау“', ico: '🟦', power: 0.85 }],
  '🇺🇸': [{ id: 'liberty', nm: '„Либърти Билдърс“', ico: '🟦', power: 1.0 }, { id: 'goldengate', nm: '„Голдън Гейт Констракшън“', ico: '🟥', power: 0.95 }, { id: 'hudson', nm: '„Хъдсън Тауърс“', ico: '⬛', power: 0.9 }],
  '🇨🇳': [{ id: 'longcheng', nm: '„Лунчен Строй“', ico: '🟥', power: 1.0 }, { id: 'huanghe', nm: '„Хуанхъ Билд“', ico: '🟨', power: 0.95 }],
  '🇯🇵': [{ id: 'sakura', nm: '„Сакура Кенсецу“', ico: '🟥', power: 1.0 }, { id: 'fuji', nm: '„Фуджи Билд“', ico: '⬜', power: 0.9 }],
};
export const ALL_FIRMS = [...FIRMS, ...Object.values(LOCAL_FIRMS).flat()];
// фирмите, които се борят за поръчки в даден град (по знамето на града; без местни — българските)
export const firmsFor = cc => (cc && LOCAL_FIRMS[cc]) || FIRMS;
const firmById = id => ALL_FIRMS.find(f => f.id === id) || FIRMS[0];

export function createRivals(deps) {
  const st = () => { const S = deps.S(); S.rivals = S.rivals || { firms: {}, sites: [] }; return S.rivals; };
  // при нова оферта: с някакъв шанс конкурент също я иска (по-често за по-големите и при по-висока репутация на пазара)
  function attach(o) {
    const S = deps.S(), big = { house: 0.25, shop: 0.4, office: 0.5, tower: 0.6 }[o.type] ?? 0.3;
    if (Math.random() > big * (0.6 + 0.1 * Math.min(4, S.day / 60))) return o;
    const list = firmsFor(deps.cc && deps.cc()), f = list[(Math.random() * list.length) | 0];
    o.rival = { firm: f.id, nm: f.nm, ico: f.ico, day: S.day + 1 + ((Math.random() * 2) | 0), bid: Math.round(o.reward * (0.88 + Math.random() * 0.08) / 500) * 500 };
    return o;
  }
  // всеки ден: конкурентите вземат офертите, чийто срок е изтекъл; връща взетите (game.js ги маха от таблото)
  function dailyTick(offers) {
    const S = deps.S(), s = st(), taken = [];
    for (const o of offers) {
      if (!o.rival || S.day < o.rival.day) continue;
      taken.push(o);
      const f = firmById(o.rival.firm);
      s.firms[f.id] = s.firms[f.id] || { won: 0 }; s.firms[f.id].won++;
      s.sites.push({ city: S.cityId, lot: o.lot, firm: f.id, type: o.type, ready: S.day + Math.round({ house: 6, shop: 9, office: 14, tower: 22 }[o.type] / f.power) });
      deps.toast(`${f.ico} ${f.nm} взе поръчката „${o.client}“ (${deps.fmt(o.rival.bid)} €) — изпревари те!`, 'bad');
    }
    for (const site of [...s.sites]) if (S.day >= site.ready && (site.city || S.cityId) === S.cityId) { s.sites.splice(s.sites.indexOf(site), 1); deps.onBuilt(site.lot, site.type, firmById(site.firm)); }
    return taken;
  }
  const busyLots = () => st().sites.filter(x => (x.city || deps.S().cityId) === deps.S().cityId).map(x => x.lot);
  // делът на пазара (за таба „Поръчки“)
  function marketHtml() {
    const s = st(), mine = deps.S().done || 0;
    const rows = firmsFor(deps.cc && deps.cc()).map(f => ({ f, n: (s.firms[f.id] || {}).won || 0 })).filter(r => r.n);
    if (!rows.length) return '';
    const total = mine + rows.reduce((a, r) => a + r.n, 0) || 1;
    return `<div class="card" style="padding:9px 11px"><b>🏁 Конкуренция</b><div class="meta">Твоят дял: <b style="color:var(--ok)">${Math.round(mine / total * 100)}%</b> · ${rows.map(r => `${r.f.ico} ${r.f.nm} ${Math.round(r.n / total * 100)}%`).join(' · ')}</div></div>`;
  }
  // ред в картичката на офертата
  function offerLine(o) {
    if (!o.rival) return '';
    const left = o.rival.day - deps.S().day;
    return `<div class="meta" style="color:#ffb46b">${o.rival.ico} ${o.rival.nm} също иска тази поръчка — ще я вземе ${left <= 0 ? 'днес' : left === 1 ? 'утре' : `след ${left} дни`}, ако не я приемеш.</div>`;
  }
  // твоят дял от пазара (0..1) — за „Завърши града“
  function share() {
    const s = st(), mine = deps.S().done || 0, theirs = firmsFor(deps.cc && deps.cc()).reduce((a, f) => a + ((s.firms[f.id] || {}).won || 0), 0);
    return mine + theirs ? mine / (mine + theirs) : 1;
  }
  return { attach, dailyTick, busyLots, marketHtml, offerLine, share, firms: FIRMS };
}
