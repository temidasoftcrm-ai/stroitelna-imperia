// linkoffers.js — транспортни връзки на град: при влизане в град без магистрала/пристанище/летище идва предложение.
// Два пътя за всяка връзка:
//   🏗️ Твое — купуваш терена (земя) и строиш сам: плащаш повече, после надграждаш и печелиш изцяло.
//   🏛️ Общинско — плащаш такса за участие и ползваш само връзката: без поддръжка и без надграждане,
//      а общината взима дял от всеки рейс/полет (MUNI_SHARE). По-късно можеш да изкупиш общинския дял.
// Само цени и текстове; game.js държи записа (S.ports / S.airports с { muni: true }, S.roadAccess[град]).
export const MUNI_SHARE = 0.15;
const REGION_MUL = { bg: 1, balkan: 1.5, europe: 2.5, world: 3.5 };
const SIZE_MUL = [1, 1, 1.4, 2];
// c — градът ({ sz }); region — 'bg' | 'balkan' | 'europe' | 'world'
export const cityMul = (c, region) => (SIZE_MUL[c.sz || 1] || 1) * (REGION_MUL[region] || 1);

// портL1 / airL1 — цената на първото ниво (PORT_LEVELS[0].cost / AIRPORT_LEVELS[0].cost)
export function linkPrices(c, region, portL1, airL1) {
  const k = cityMul(c, region), r = n => Math.round(n / 10000) * 10000;
  return {
    portLand: r(portL1 * 0.25 * k), portOwn: r(portL1 * (1 + 0.25 * k)), portMuni: r(portL1 * 0.12 * k),
    airLand: r(airL1 * 0.3 * k), airOwn: r(airL1 * (1 + 0.3 * k)), airMuni: r(airL1 * 0.12 * k),
    roadMuni: r(400000 * k), abMuni: r(900000 * k),
  };
}
// изкупуване на общинския дял: земята + 60% от цената на ниво 1 (съоръжението вече е построено)
export const buyoutPrice = (land, l1) => Math.round((land + l1 * 0.6) / 10000) * 10000;
