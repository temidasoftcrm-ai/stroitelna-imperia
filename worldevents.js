// worldevents.js — големите световни събития по график (като в истинския свят): Световно първенство по футбол на 4 години,
// Летни олимпийски игри, Европейско първенство, EXPO, Световно по плуване, Евровизия. За всяко издание се избира град домакин
// (по-често град, в който имаш филиал) и държавата обявява търг за обекта: стадион, олимпийски стадион, изложбен център, басейн, зала.
// Строи се като обикновена държавна поръчка (tenders.js), но срокът е до откриването — а ако обектът е твой и е готов навреме,
// при откриването получаваш дял от билетите и репутация. Ид на търга: ev-<ключ>-<издание>-<град>; записът — S.wev = { [ключ]: издание }.
import { wcStadium } from './stadiums.js';   // световното по футбол — известният стадион на домакина (Лабораторията → st-*)
const Y = 365;
export const WORLD_EVENTS = [
  { key: 'wc', ico: '⚽', nm: 'Световно първенство по футбол', every: 4 * Y, off: 3 * Y, kind: 'stadium', size: [3, 4], budget: 160e6, days: 130, dev: 12, rep: 4.5, share: 0.18,
    need: { crew: 8, crane: 4, loader: 4, truck: 6 }, sign: '⚽ FIFA WORLD CUP', what: 'стадион за 80 000 зрители за финала', hosts: ['istanbul', 'madrid', 'london', 'paris', 'berlin', 'rome', 'rio', 'buenosaires', 'mexicocity', 'newyork', 'losangeles', 'tokyo', 'seoul', 'casablanca', 'cairo', 'sydney'] },
  { key: 'oly', ico: '🏅', nm: 'Летни олимпийски игри', every: 4 * Y, off: 5 * Y, kind: 'stadium', variant: 'olympia', size: [3, 3], budget: 180e6, days: 140, dev: 14, rep: 4.5, share: 0.2,
    need: { crew: 8, crane: 4, loader: 4, truck: 7 }, sign: '🏅 OLYMPIC STADIUM', what: 'олимпийски стадион с писта и олимпийски огън', hosts: ['paris', 'london', 'athens', 'rome', 'madrid', 'berlin', 'istanbul', 'losangeles', 'rio', 'tokyo', 'beijing', 'sydney', 'budapest', 'mumbai', 'capetown'] },
  { key: 'euro', ico: '🏆', nm: 'Европейско първенство по футбол', every: 4 * Y, off: 5 * Y + 180, kind: 'stadium', size: [3, 3], budget: 95e6, days: 110, dev: 10, rep: 4, share: 0.15,
    need: { crew: 6, crane: 3, loader: 3, truck: 5 }, sign: '🏆 UEFA EURO', what: 'национален стадион за 60 000 зрители', hosts: ['istanbul', 'athens', 'budapest', 'warsaw', 'prague', 'vienna', 'munich', 'barcelona', 'amsterdam', 'rome', 'london', 'paris', 'sofia', 'bucharest', 'belgrade'] },
  { key: 'expo', ico: '🌐', nm: 'Световно изложение EXPO', every: 5 * Y, off: 4 * Y, kind: 'congress', size: [2, 2], budget: 85e6, days: 100, dev: 11, rep: 4, share: 0.25,
    need: { crew: 5, crane: 3, loader: 2, truck: 4 }, sign: '🌐 WORLD EXPO', what: 'изложбен павилион от стъкло за милиони посетители', hosts: ['dubai', 'shanghai', 'milan', 'osaka', 'paris', 'singapore', 'istanbul', 'rotterdam', 'berlin', 'chicago', 'seoul', 'riyadh'] },
  { key: 'swim', ico: '🏊', nm: 'Световно първенство по плуване', every: 2 * Y, off: 2 * Y + 90, kind: 'pool', size: [2, 2], budget: 45e6, days: 80, dev: 9, rep: 3.5, share: 0.12,
    need: { crew: 3, crane: 1, loader: 1, truck: 2 }, sign: '🏊 WORLD AQUATICS', what: 'олимпийски басейн под стъклен покрив', hosts: ['budapest', 'barcelona', 'rome', 'singapore', 'doha', 'fukuoka', 'kazan', 'melbourne', 'gwangju', 'shanghai', 'athens', 'istanbul'] },
  { key: 'eurovision', ico: '🎤', nm: 'Евровизия', every: Y, off: Y + 120, kind: 'congress', size: [2, 2], budget: 28e6, days: 60, dev: 8, rep: 3.5, share: 0.1,
    need: { crew: 3, crane: 1, loader: 1, truck: 2 }, sign: '🎤 EUROVISION', what: 'концертна арена за 15 000 зрители и сцена с милион светлини', hosts: ['sofia', 'athens', 'belgrade', 'bucharest', 'istanbul', 'vienna', 'stockholm', 'london', 'amsterdam', 'kyiv', 'turin', 'liverpool', 'malmo', 'basel', 'prague'] },
];
export const EV_OPEN = 7, EV_GAP = 30;   // търгът е отворен 7 дни; откриването — 30 дни след крайния срок на строежа
const byKey = k => WORLD_EVENTS.find(e => e.key === k);
const yearOf = day => 2026 + Math.floor(day / Y);

// търгът за едно издание (и при зареждане на запис — по ид)
export function evTender(id, cityName = c => c) {
  const m = /^ev-([a-z]+)-(\d+)-([a-z]+)$/.exec(id); if (!m) return null;
  const E = byKey(m[1]); if (!E) return null;
  const ed = +m[2], city = m[3], at = E.off + ed * E.every, open = at + EV_OPEN + E.days + EV_GAP;   // at — денят на обявяването
  const mul = 0.85 + (city.length % 5) * 0.08;
  return { id, city, kind: E.kind, variant: E.variant || (E.key === 'wc' ? wcStadium(city) : undefined), size: E.size, ico: E.ico, ev: E.key, evDay: open, share: E.share,
    nm: `${E.nm} ${yearOf(open)} — ${cityName(city)}`, budget: Math.round(E.budget * mul / 1e6) * 1e6, days: E.days, rep: E.rep, dev: E.dev, need: E.need, matShare: 0.55, sign: E.sign,
    ds: `${E.ico} ${cityName(city)} е домакин на ${E.nm.replace(/^./, c => c.toLowerCase())} ${yearOf(open)}! Трябва ${E.what} — откриването е на ден ${open} и не може да се отложи. Ако обектът е твой и е готов навреме, получаваш ${Math.round(E.share * 100)}% от бюджета от билетите и +0.5 ★.` };
}

// кое издание е дошло днес: [{ E, ed }] (по едно на събитие; пропуснатите заради стар запис не се наваксват)
export function dueEditions(S) {
  const day = S.day || 0, done = S.wev = S.wev || {}, out = [];
  for (const E of WORLD_EVENTS) {
    if (day < E.off) continue;
    const ed = Math.floor((day - E.off) / E.every);
    if (done[E.key] == null) { done[E.key] = ed - (day - E.off - ed * E.every < 20 ? 1 : 0); }   // стар запис: текущото издание — само ако е току-що
    if (ed > done[E.key]) { done[E.key] = ed; out.push({ E, ed }); }
  }
  return out;
}
// домакинът: по-често град, в който имаш филиал (3×), но само сред градовете, които съществуват в играта
export function pickHost(E, owns, exists) {
  const list = E.hosts.filter(exists); if (!list.length) return null;
  const w = list.map(c => owns(c) ? 3 : 1);
  let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0; while ((r -= w[i]) > 0 && i < list.length - 1) i++;
  return list[i];
}
