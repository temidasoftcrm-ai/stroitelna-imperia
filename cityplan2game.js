// cityplan2game.js — планът v2 по истинската карта (Рим) във вида, който game.js ползва за градовете с план (както cityplangame.js):
// улици и възли за маршрутите (cityplanroute.js), парцели във формата на planLots, площад, котви (гара, летище, магистрала), вода.
// Всичко е изместено в рамката на играта (западният и северният край — на EDGE, както при старите планове); 3D изгледът
// (cityplan2-3d.js) се строи в рамката на плана и се измества с offset. Само за НОВИ игри (флаг rome-osm) — старите записи не се пипат.
import { plan2Load } from './cityplan2.js';
import { OSM2 } from './cityplan2-osm.js';
import { LOT_KINDS } from './cityplan.js';

const EDGE = -108;   // както в cityplangame.js
const SQUARE = { rome: [41.8960, 12.4826] };   // площадът на централата: Пиаца Венеция
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
  const K = osm.k, toXZ = (la, lo) => [(lo - osm.center[1]) * Math.cos(osm.center[0] * Math.PI / 180) * 111320 * K, -(la - osm.center[0]) * 110540 * K];
  const sq0 = SQUARE[P.cityId] ? toXZ(...SQUARE[P.cityId]) : [P.center.x, P.center.z], [sqx, sqz] = sh(sq0);
  const nodes = [{ x: sqx, z: sqz, square: true, deg: 0 }, ...P.nodes.map(n => ({ x: n.x + ox, z: n.z + oz, deg: n.arms.length }))];
  const edges = P.roads.map(r => ({ a: r.from + 1, b: r.to + 1, st: r.id, s0: 0, s1: r.L[r.L.length - 1], len: r.L[r.L.length - 1] }));
  // парцелите: без забележителностите и големите места; по ниво на квартала, после по стария id — така новите квартали
  // се добавят в края и id-тата на вече отключените не се местят
  const tier = o.tier ?? 1;
  const src = P.lots.filter(L => !L.big && !L.lm && (L.tier || 1) <= tier).sort((a, b) => (a.tier || 1) - (b.tier || 1) || a.id - b.id);
  const lots = src.map((L, i) => { const [x, z] = sh([L.x, L.z]), zone = L.zone === 'outer' ? 'outer' : L.zone;
    return { id: i, x, z, rot: L.rot, w: L.w, d: L.d, zone, kinds: LOT_KINDS[zone] || LOT_KINDS.mid, street: L.front ? L.front.road : 0,
      fresh: false, built: null, obj: null, busy: null, mega: false, plan: true, district: L.district, tier: L.tier || 1, reno: L.reserved === 'reno', p2: L.id }; });
  // централата: най-близкият до площада парцел за строеж (не реставрация) от първото ниво — не се мести при отключване
  let hqLot = 0, bd = 1e18; lots.forEach((L, i) => { if (L.reno || L.tier > 1) return; const d = (L.x - sqx) ** 2 + (L.z - sqz) ** 2; if (d < bd) { bd = d; hqLot = i; } });
  const shA = a => a && { ...a, x: a.x + ox, z: a.z + oz, ...(a.road ? { road: { ...a.road, x: a.road.x + ox, z: a.road.z + oz } } : {}) };
  const anchors = P.anchors ? { station: shA(P.anchors.station), airport: shA(P.anchors.airport), highway: shA(P.anchors.highway) } : {};
  // пътищата до летището и магистралата (за маршрутите на ТИР-овете, както P.links в game.js)
  const links = ['airport', 'highway'].map(k => anchors[k]).filter(a => a && a.road).map(a => { const pts = [[a.road.x, a.road.z], [a.x, a.z]]; return { pts, L: cumLen(pts), w: 12, cls: 'road' }; });
  const landmarks = P.lots.filter(L => L.lm).map(L => ({ k: L.lm, x: L.x + ox, z: L.z + oz, w: L.w, d: L.d, guard: L.guard || 0 }));
  const bnd = B.map(sh), x1 = Math.max(...bnd.map(p => p[0])), z1 = Math.max(...bnd.map(p => p[1]));
  const waterAt = (x, z) => P.waterAt(x - ox, z - oz);
  return {
    v: 2, osm: true, cityId: P.cityId, tpl: 'osm2', mega: false, bigZone: null,
    streets, nodes, edges, links, lots, hqLot, square: { x: sqx, z: sqz, r: 14 }, anchors, landmarks, districts: P.districts,
    boundary: bnd, ext: { x1, z1 }, offset: [ox, oz],
    waterAt, heightAt: () => 0, buildable: (x, z) => !waterAt(x, z),
    p2: P,   // планът v2 (за cityplan2-3d.js — buildPlan2View(gp.p2, { osm: gp.p2.osmData, offset: gp.offset, fillLot }) — и за трафика planNetwork(gp.p2))
    toPlan: (x, z) => [x - ox, z - oz], toGame: (x, z) => [x + ox, z + oz],
  };
}
