// russia.js — Русия в Европа (ниво 8): Москва (мегаполис) и още 5 града, държава за завладяване, местни фирми и пътища.
const c = (id, nm, lat, lon, sz, extra = {}) => ({ id, nm, lat, lon, sz, cc: '🇷🇺', ...extra });
export const RUSSIA = [
  c('moscow', 'Москва', 55.756, 37.617, 3),
  c('stpetersburg', 'Санкт Петербург', 59.939, 30.316, 3),
  c('nnovgorod', 'Нижни Новгород', 56.327, 44.006, 3),
  c('kazan', 'Казан', 55.796, 49.106, 3),
  c('voronezh', 'Воронеж', 51.672, 39.184, 2),
  c('novorossiysk', 'Новоросийск', 44.724, 37.769, 2),
];
export const RUSSIA_COUNTRY = { cc: '🇷🇺', nm: 'Русия', iso: 'RUS', cities: RUSSIA.map(x => x.id) };
export const RUSSIA_COASTAL = ['stpetersburg', 'novorossiysk'];
// аутобани (corridors.js ги взима оттук)
export const RUSSIA_AB = [
  { id: 'M11', nm: 'Москва — Санкт Петербург', cities: ['moscow', 'stpetersburg'] },
  { id: 'E30', nm: 'Варшава — Москва', cities: ['warsaw', 'moscow'] },
  { id: 'M7', nm: 'Москва — Казан', cities: ['moscow', 'nnovgorod', 'kazan'] },
  { id: 'M4', nm: 'Москва — Новоросийск', cities: ['moscow', 'voronezh', 'novorossiysk'] },
];
