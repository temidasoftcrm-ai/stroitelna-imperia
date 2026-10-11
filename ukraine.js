// ukraine.js — Украйна в Европа (ниво 8): Киев и още 4 града, държава за завладяване, местни фирми и пътища.
const c = (id, nm, lat, lon, sz, extra = {}) => ({ id, nm, lat, lon, sz, cc: '🇺🇦', ...extra });
export const UKRAINE = [
  c('kyiv', 'Киев', 50.450, 30.523, 3),
  c('kharkiv', 'Харков', 49.994, 36.230, 3),
  c('odesa', 'Одеса', 46.482, 30.723, 3),
  c('dnipro', 'Днипро', 48.465, 35.046, 3),
  c('lviv', 'Лвов', 49.840, 24.030, 2),
];
export const UKRAINE_COUNTRY = { cc: '🇺🇦', nm: 'Украйна', iso: 'UKR', cities: UKRAINE.map(x => x.id) };
export const UKRAINE_COASTAL = ['odesa'];
// аутобани (corridors.js ги взима оттук)
export const UKRAINE_AB = [
  { id: 'E40', nm: 'Краков — Харков', cities: ['krakow', 'lviv', 'kyiv', 'kharkiv'] },
  { id: 'M05', nm: 'Киев — Одеса', cities: ['kyiv', 'odesa'] },
  { id: 'E50', nm: 'Днипро — Одеса', cities: ['kharkiv', 'dnipro', 'odesa'] },
  { id: 'E58', nm: 'Одеса — Яш', cities: ['odesa', 'iasi'] },
];
