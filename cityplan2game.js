// cityplan2game.js — планът v2 по истинската карта (Рим) във вида, който game.js ползва за градовете с план (както cityplangame.js):
// улици и възли за маршрутите (cityplanroute.js), парцели във формата на planLots, площад, котви (гара, летище, магистрала), вода.
// Всичко е изместено в рамката на играта (западният и северният край — на EDGE, както при старите планове); 3D изгледът
// (cityplan2-3d.js) се строи в рамката на плана и се измества с offset. Само за НОВИ игри (флаг rome-osm) — старите записи не се пипат.
import { plan2, plan2Load } from './cityplan2.js';
import { OSM2 } from './cityplan2-osm.js';
import { LOT_KINDS } from './cityplan.js';

const EDGE = -108;   // както в cityplangame.js
const SQUARE = { rome: [41.8960, 12.4826], paris: [48.8566, 2.3522], istanbul: [41.0082, 28.9784], london: [51.5007, -0.1263], newyork: [40.7536, -73.9832], moscow: [55.7558, 37.6150], washington: [38.8958, -77.0310] };   /* Вашингтон: Фрийдъм Плаза на Пенсилвания авеню */   // … · Брайънт Парк   // площадът на централата: Пиаца Венеция · Отел дьо Вил   // площадът на централата: Пиаца Венеция
const cache = new Map();
const cumLen = pts => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return L; };

// данните — assets/plans/<id>.json (готов план); зарежда се веднъж
export async function loadPlan2(cityId) {
  if (cache.has(cityId)) return cache.get(cityId);
  const osm = OSM2[cityId]; if (!osm) return null;
  const data = await fetch(`assets/plans/${cityId}.json`).then(r => r.ok ? r.json() : null).catch(() => null); if (!data) return null;
  const P = plan2Load(data, osm); P.osmData = osm;
  cache.set(cityId, P); return P;
}

// gamePlan2(P, { tier }) — tier: до кое ниво на кварталите са отключени парцелите (1…5); P — от loadPlan2
export function gamePlan2(P, o = {}) {
  const osm = P.osmData, B = P.boundary, x0 = Math.min(...B.map(p => p[0])), z0 = Math.min(...B.map(p => p[1]));
  const ox = EDGE - x0, oz = EDGE - z0, sh = ([x, z]) => [x + ox, z + oz];
  // улиците: [улица] = път от плана (същите индекси); възел 0 — площадът (cityplanroute.js го свързва с центъра)
  const streets = P.roads.map(r => { const pts = r.pts.map(sh); return { id: r.id, cls: r.cls, w: r.w, pts, L: cumLen(pts), noCars: !!r.noCars, oneway: !!r.oneway, name: r.nm || '' }; });
  const K = osm?.k, toXZ = (la, lo) => [(lo - osm.center[1]) * Math.cos(osm.center[0] * Math.PI / 180) * 111320 * K, -(la - osm.center[0]) * 110540 * K];
  const sq0 = osm && SQUARE[P.cityId] ? toXZ(...SQUARE[P.cityId]) : [P.center.x, P.center.z], [sqx, sqz] = sh(sq0);
  const nodes = [{ x: sqx, z: sqz, square: true, deg: 0 }, ...P.nodes.map(n => ({ x: n.x + ox, z: n.z + oz, deg: n.arms.length }))];
  const edges = P.roads.map(r => ({ a: r.from + 1, b: r.to + 1, st: r.id, s0: 0, s1: r.L[r.L.length - 1], len: r.L[r.L.length - 1] }));
  // парцелите: без забележителностите и големите места; по ниво на квартала, после по стария id — така новите квартали
  // се добавят в края и id-тата на вече отключените не се местят
  const tier = o.tier ?? 1;
  let src = P.lots.filter(L => !L.big && !L.lm && (L.tier || 1) <= tier).sort((a, b) => (a.tier || 1) - (b.tier || 1) || a.id - b.id);
  if (o.count != null) src = src.slice(0, o.count);   // генерираните градове: първите count (по разстояние от центъра) — купените квартали се добавят в края
  const lots = src.map((L, i) => { const [x, z] = sh([L.x, L.z]), zone = L.zone === 'outer' ? 'outer' : L.zone;
    return { id: i, x, z, rot: L.rot, w: L.w, d: L.d, zone, kinds: LOT_KINDS[zone] || LOT_KINDS.mid, street: L.front ? L.front.road : 0,
      fresh: false, built: null, obj: null, busy: null, mega: false, plan: true, district: L.district, tier: L.tier || 1, reno: L.reserved === 'reno', under: L.under || null, p2: L.id }; });   // under — под късна забележителност (Св. Патрик): заето
  // централата: най-близкият до площада парцел за строеж (не реставрация) от първото ниво — не се мести при отключване
  let hqLot = 0, bd = 1e18; lots.forEach((L, i) => { if (L.reno || L.tier > 1) return; const d = (L.x - sqx) ** 2 + (L.z - sqz) ** 2; if (d < bd) { bd = d; hqLot = i; } });
  const shA = a => a && { ...a, x: a.x + ox, z: a.z + oz, ...(a.road ? { road: { ...a.road, x: a.road.x + ox, z: a.road.z + oz } } : {}) };
  const anchors = P.anchors ? { station: shA(P.anchors.station), airport: shA(P.anchors.airport), highway: shA(P.anchors.highway) } : {};
  // пътищата до летището и магистралата (за маршрутите на ТИР-овете, както P.links в game.js)
  const links = ['airport', 'highway'].map(k => anchors[k]).filter(a => a && a.road).map(a => { const pts = [[a.road.x, a.road.z], [a.x, a.z]]; return { pts, L: cumLen(pts), w: 12, cls: 'road' }; });
  const landmarks = P.lots.filter(L => L.lm).map(L => ({ k: L.lm, x: L.x + ox, z: L.z + oz, w: L.w, d: L.d, guard: L.guard || 0, rot: L.rot || 0, vrot: L.vrot }));   // vrot — истинското завъртане на модела (Манхатън: −0,506)   // rot — завъртените (мрежата на Манхатън)
  const bnd = B.map(sh), x1 = Math.max(...bnd.map(p => p[0])), z1 = Math.max(...bnd.map(p => p[1]));
  const waterAt = (x, z) => P.waterAt(x - ox, z - oz);
  return {
    v: 2, osm: !!osm, cityId: P.cityId, tpl: osm ? 'osm2' : 'plan2:' + P.fam + ':' + P.size, mega: !!o.mega, bigZone: null, totalLots: P.lots.filter(L => !L.big && !L.lm).length,
    bigs: P.lots.filter(L => L.big && !L.lm).map(L => ({ kind: L.big, x: L.x + ox, z: L.z + oz, w: L.w, d: L.d, rot: L.rot, p2: L.id })),   // запазените големи места (болница, гара, парк, стадион, пристанище…)
    streets, nodes, edges, links, lots, hqLot, square: { x: sqx, z: sqz, r: 14 }, anchors, landmarks, districts: P.districts,
    boundary: bnd, ext: { x1, z1 }, offset: [ox, oz],
    waterAt, heightAt: () => 0, buildable: (x, z) => !waterAt(x, z),
    p2: P,   // планът v2 (за cityplan2-3d.js — buildPlan2View(gp.p2, { osm: gp.p2.osmData, offset: gp.offset, fillLot }) — и за трафика planNetwork(gp.p2))
    toPlan: (x, z) => [x - ox, z - oz], toGame: (x, z) => [x + ox, z + oz],
  };
}

// ---- генерираните градове (шаблоните plan2: 4 семейства × 4 размера) — същият вид като gamePlan2
// семейство: крайбрежен → 'coast'; Северна Америка (и мрежите на cityplan.js) → 'us'; звездите (Москва, Пекин, Киев) → 'radial'; другите → 'eu'
// размер по нивото на града: s / m / l / xl (мегаполисите — xl)
const US_IDS = new Set(['newyork', 'chicago', 'toronto', 'philadelphia', 'losangeles', 'buenosaires', 'washington', 'boston', 'miami', 'houston', 'dallas', 'atlanta', 'seattle', 'sanfrancisco', 'lasvegas', 'denver', 'montreal', 'vancouver', 'mexicocity', 'detroit', 'phoenix']);
const RADIAL_IDS = new Set(['moscow', 'beijing', 'kyiv', 'paris', 'madrid']);
export function famSizeOf(cityId, o = {}) {
  const fam = o.coastal ? 'coast' : RADIAL_IDS.has(cityId) ? 'radial' : (US_IDS.has(cityId) || o.region === 'us' || o.region === 'namerica') ? 'us' : 'eu';
  const size = o.mega ? 'xl' : ({ s: 's', m: 'm', l: 'l', xl: 'xl' })[o.tier] || 'm';
  return { fam, size };
}
const strHash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
// gamePlan2Gen(cityId, { fam, size, seed, count, minLots, mega }) — count: колко парцела са отключени (ядро + купените квартали; f1 ги смята)
export function gamePlan2Gen(cityId, o = {}) {
  const fs = o.fam && o.size ? { fam: o.fam, size: o.size } : famSizeOf(cityId, o), seed = o.seed ?? strHash(cityId);
  // minLots: колкото играта ще отключи най-много (ядро + всички квартали) — ако шаблонът е по-малък, радиусът расте (×1,12 до 6 пъти)
  let P, rk = 1; for (let k = 0; k < 7; k++) { P = plan2(cityId, { fam: fs.fam, size: fs.size, seed, rk, roadGeo: !!o.roadGeo, jfix: !!o.jfix });   /* junction-fix (#22) — също само новите игри (S.jfix) */   /* road-geo — само новите игри (S.roadGeo) */ if (!o.minLots || P.lots.filter(L => !L.big && !L.lm).length >= o.minLots) break; rk *= 1.12; }
  if (!P.anchors) {   // котви: гарата — голямото място „station“; магистралата и летището — изходите към другите градове (най-източният и най-далечният от него)
    const st = P.lots.find(L => L.big === 'station'), C = P.center;
    const ex = P.nodes.filter(n => n.endKind === 'exit').map(n => { const a = n.arms[0], rd = P.roads[a.road], q = a.end ? rd.pts[rd.pts.length - 1] : rd.pts[0]; return { x: n.x, z: n.z, dir: Math.atan2(n.x - C.x, n.z - C.z), road: { road: rd.id, end: a.end, x: q[0], z: q[1] } }; });
    const hw = ex.slice().sort((a, b) => b.x - a.x)[0] || null, ap = hw ? ex.filter(e => e !== hw).sort((a, b) => Math.hypot(b.x - hw.x, b.z - hw.z) - Math.hypot(a.x - hw.x, a.z - hw.z))[0] || null : null;
    P.anchors = { station: st ? { x: st.x, z: st.z, w: st.w, d: st.d, lot: st.id, name: 'Гара' } : null, highway: hw ? { ...hw, name: 'Магистрала' } : null, airport: ap ? { ...ap, name: 'Летище' } : null };
  }
  return gamePlan2(P, { count: o.count, mega: o.mega });
}
