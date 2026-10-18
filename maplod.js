// maplod.js — степени на детайлност на картата (feature 'map-lod'): 🌍 свят → континент → държава → 🏙️ област.
// Степента идва от ширината на показаната част (не от изгледа), с хистерезис — на границата не трепти.
//   свят:      континентите с общия напредък и обобщени връзки между тях; градове — само централата, текущият и избраният
//   континент: до 8 важни града на континент, обобщени коридори между държавите
//   държава:   до 5 важни града на държава, истинските трасета; подвижните знаци (влакове, кораби…)
//   област:    всички градове в показаната част
// Изборът на градове не зависи от камерата (само от игровите данни) — маркерите не се разместват при местене.
// Тук са само чисти функции; game.js им подава данните (deps) и рисува.

export const LOD = { WORLD: 0, CONT: 1, COUNTRY: 2, REGION: 3 };
export const LOD_NM = ['свят', 'континент', 'държава', 'област'];
// ширина на показаната част в единици на проекцията (≈100 на градус дължина): над EDGE[0] — свят, над EDGE[1] — континент…
const EDGE = [12000, 4200, 1500], HYST = 0.12;
export function lodOf(w, prev = null) {
  let l = EDGE.findIndex(e => w > e); if (l < 0) l = LOD.REGION;
  if (prev != null && Math.abs(l - prev) === 1) { const e = EDGE[Math.min(l, prev)]; if (Math.abs(w - e) < e * HYST) return prev; }   // близо до границата — остава предишната
  return l;
}

// етикетите на континентите (дължина, ширина) за световния изглед
export const CONT_AT = { eu: [15, 51], af: [19, 4], na: [-100, 44], sa: [-60, -14], as: [92, 42], oc: [137, -25] };
export const CONT_NM = { eu: 'Европа', af: 'Африка', na: 'Северна Америка', sa: 'Южна Америка', as: 'Азия', oc: 'Австралия и Океания' };

// важност на град за картата; deps: here(id), hq(id), owned(id), finished(id), busy(id), hub(id), key(id), sz(id)
export function cityScore(id, d) {
  return (d.here(id) ? 1000 : 0) + (d.hq(id) ? 900 : 0) + (d.busy(id) ? 300 : 0) + (d.owned(id) && !d.finished(id) ? 150 : d.owned(id) ? 60 : 0)
    + (d.hub(id) ? 80 : 0) + (d.key(id) ? 40 : 0) + (d.sz(id) || 0) * 10;
}
// най-важните n града във всяка група (континент или държава): Map група → Set(id); ids — подредени стабилно (по id при равни точки)
export function topPerGroup(ids, groupOf, n, d) {
  const by = new Map();
  for (const id of ids) { const g = groupOf(id); if (g == null) continue; (by.get(g) || by.set(g, []).get(g)).push([cityScore(id, d), id]); }
  const out = new Set();
  for (const arr of by.values()) arr.sort((a, b) => b[0] - a[0] || (a[1] < b[1] ? -1 : 1)).slice(0, n).forEach(([, id]) => out.add(id));
  return out;
}
// обобщени връзки: links [{ a, b }] → по една линия между групите (континенти или държави) с броя на връзките;
// pos(id) → [x, y]; групата е в средата на своите свързани градове
export function corridors(links, groupOf, pos) {
  const pairs = new Map(), pts = new Map();
  const add = (g, p) => { const q = pts.get(g) || pts.set(g, [0, 0, 0]).get(g); q[0] += p[0]; q[1] += p[1]; q[2]++; };
  for (const { a, b } of links) {
    const ga = groupOf(a), gb = groupOf(b); if (ga == null || gb == null || ga === gb) continue;
    const pa = pos(a), pb = pos(b); if (!pa || !pb) continue;
    add(ga, pa); add(gb, pb);
    const k = ga < gb ? ga + '|' + gb : gb + '|' + ga; pairs.set(k, (pairs.get(k) || 0) + 1);
  }
  const ctr = g => { const q = pts.get(g); return [q[0] / q[2], q[1] / q[2]]; };
  return [...pairs].map(([k, n]) => { const [ga, gb] = k.split('|'); return { ga, gb, n, a: ctr(ga), b: ctr(gb) }; });
}
// търсене на град по име (без значение от главни/малки букви; първо тези, които започват с текста)
export function searchCities(list, q, n = 8) {
  q = (q || '').trim().toLowerCase(); if (!q) return [];
  const st = [], inc = [];
  for (const c of list) { const nm = (c.nm || '').toLowerCase(); if (nm.startsWith(q)) st.push(c); else if (nm.includes(q) || c.id.includes(q)) inc.push(c); }
  return [...st, ...inc].slice(0, n);
}
