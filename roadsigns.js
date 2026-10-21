// roadsigns.js — пътни знаци в градовете (Лабораторията → road-signs): „Стоп“ и „Пропусни“ на кръстовищата без светофар,
// „50 км/ч“ и „край на ограничението“ по входящите улици, „Кръгово движение“ около площада, „Забранено влизането“ и стрелки
// по някои пресечки. Моделите — „Road pack“ (drcrazzie, CC-BY, Sketchfab), извадени и смалени в assets/heavy/signs/signs.glb:
// stop, yield, twoway, noentry, speed, speedend, roundabout, left, right, barrier, barrier2, railing (лицето на знака гледа към +z след prep).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let SRC = null, P = null;
// лицето на знаците в пакета е към −x — обръщаме го към +z; основата — в (0, 0, 0)
function prep(k) {
  const w = new THREE.Group(); w.name = k.name;
  const inner = new THREE.Group(); inner.add(k); w.add(inner);
  k.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(k), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
  k.position.sub(new THREE.Vector3(c.x, b.min.y, c.z));
  if (s.x < s.z) inner.rotation.y = Math.PI / 2;
  w.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return w;
}
export const loadSigns = () => P || (P = Promise.all([new Promise(res => new GLTFLoader().load('assets/heavy/signs/signs.glb', g => {
  const root = g.scene.getObjectByName('signs') || g.scene; SRC = {};
  for (const k of [...root.children]) SRC[k.name] = prep(k);
  res(SRC);
}, undefined, () => res(null))), loadTL()]).then(r => r[0]));

// истински светофар („Traffic light“, Ronata-Venya, CC-BY; assets/heavy/signs/tlight.glb): стълб 6,5 м с глава встрани и пешеходен сигнал.
// Началото е оста на стълба. Лещите на модела са тъмни — светят кръгчетата на game.js (buildSignals), поставени върху тях.
const TL_H = 6.5, TL_LENS = [[1.312, 8.468, -0.104], [1.312, 7.931, -0.104], [1.312, 7.384, -0.104]];   // червена, жълта, зелена — в оригиналния модел (10 м)
let TL = null;
function loadTL() {
  return new Promise(res => new GLTFLoader().load('assets/heavy/signs/tlight.glb', g => {
    const o = g.scene; o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o), k = TL_H / (b.max.y - b.min.y);
    const w = new THREE.Group(); w.add(o); o.scale.multiplyScalar(k); o.position.y -= b.min.y * k;
    o.traverse(m => { if (!m.isMesh) return; m.castShadow = true; if (/Emissive/.test(m.material?.name || '')) { m.material = m.material.clone(); m.material.emissiveIntensity = 0.05; m.material.color.multiplyScalar(0.25); } });
    TL = { src: w, k }; res(TL);
  }, undefined, () => res(null)));
}
export const hasTrafficLight = () => !!TL;
// нов светофар: { obj, lens: { ns: [[x,y,z]×3], ew: [[x,y,z]×3] } } — ew е втората глава (копие, завъртяно на 90° около стълба)
export function trafficLight() {
  if (!TL) return null;
  const o = TL.src.clone(true), head = o.getObjectByName('Trafic_Light_Up');
  if (head) { o.updateMatrixWorld(true); const h2 = head.clone(true); head.parent.add(h2); const piv = new THREE.Group(); o.add(piv); o.updateMatrixWorld(true); piv.attach(h2); piv.rotation.y = Math.PI / 2; }   // в координатите на стълба (моделът от FBX има завъртени възли)
  o.traverse(m => { if (m.isMesh) m.castShadow = true; });
  const k = TL.k, ns = TL_LENS.map(([x, y, z]) => [x * k, y * k, z * k]), ew = ns.map(([x, y, z]) => [z, y, -x]);
  o.userData.detail = true;
  return { obj: o, lens: { ns, ew } };
}
// един знак: x, z — мястото, yaw — накъде гледа лицето (0 = към +z)
export function sign(kind, x, z, yaw = 0, k = 1) {
  if (!SRC || !SRC[kind]) return null;
  const o = SRC[kind].clone(true); o.position.set(x, 0, z); o.rotation.y = yaw; o.scale.setScalar(k);
  o.userData.detail = true; o.userData.roadSign = kind;
  return o;
}
// стабилен „случаен“ избор по кръстовище (знаците не се разместват при всяко влизане)
const hash = (a, b) => { let h = (a * 73856093) ^ (b * 19349663); h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// grid: { tx, TILE, NBI, NBJ, isRoad(i, j), hasSignal(i, j), center: [ci, cj] | null }
// Знаците стоят на тротоара вдясно преди кръстовището (дясно движение), с лице към идващите коли.
export function citySigns(g, grid) {
  if (!SRC) return 0;
  const { tx, TILE, NBI, NBJ, isRoad, hasSignal } = grid, off = TILE * 0.55;
  let n = 0;
  const put = (kind, x, z, yaw, tile) => { if (!isRoad(tile[0], tile[1])) return; const o = sign(kind, x, z, yaw); if (!o) return; o.userData.tile = tile; g.add(o); n++; };   // не на улица, станала площад
  // подход към кръстовище (i, j) от посока d: [dx, dz] — откъдето идва колата; знакът е вдясно от нея
  const approach = (kind, i, j, dx, dz) => {
    const x = tx(i), z = tx(j);
    // идва от −z (кара към +z): дясно е −x, лицето — към −z (yaw = π); от +z: дясно +x, лице +z; от −x: дясно +z, лице −x; от +x: дясно −z, лице +x
    if (dz < 0) put(kind, x - off, z - off, Math.PI, [i, j - 1]);
    else if (dz > 0) put(kind, x + off, z + off, 0, [i, j + 1]);
    else if (dx < 0) put(kind, x - off, z + off, -Math.PI / 2, [i - 1, j]);
    else put(kind, x + off, z - off, Math.PI / 2, [i + 1, j]);
  };
  for (let bi = 1; bi < NBI; bi++) for (let bj = 1; bj < NBJ; bj++) {
    const i = 3 * bi, j = 3 * bj; if (!isRoad(i, j) || hasSignal(i, j)) continue;
    const r = hash(bi, bj); if (r > 0.55) continue;   // не на всяко кръстовище — иначе е гора от знаци
    const ns = isRoad(i, j - 1) && isRoad(i, j + 1), ew = isRoad(i - 1, j) && isRoad(i + 1, j); if (!ns || !ew) continue;
    // главната посока — по-дългата улица; второстепенната получава „Стоп“ (по-рядко) или „Пропусни“
    const minor = r < 0.27 ? 'ns' : 'ew', kind = r < 0.12 || (r > 0.27 && r < 0.36) ? 'stop' : 'yield';
    if (minor === 'ns') { approach(kind, i, j, 0, -1); approach(kind, i, j, 0, 1); }
    else { approach(kind, i, j, -1, 0); approach(kind, i, j, 1, 0); }
  }
  // входовете в града: „50“ на влизане (по външните улици), „край“ на излизане от другата страна
  for (let bi = 1; bi < NBI; bi += 2) { const i = 3 * bi; if (isRoad(i, 1)) put('speed', tx(i) - off, tx(0) + TILE * 0.3, Math.PI, [i, 1]); if (isRoad(i, 3 * NBJ - 1)) put('speed', tx(i) + off, tx(3 * NBJ) - TILE * 0.3, 0, [i, 3 * NBJ - 1]); }
  for (let bj = 1; bj < NBJ; bj += 2) { const j = 3 * bj; if (isRoad(1, j)) put('speed', tx(0) + TILE * 0.3, tx(j) + off, -Math.PI / 2, [1, j]); if (isRoad(3 * NBI - 1, j)) put('speed', tx(3 * NBI) - TILE * 0.3, tx(j) - off, Math.PI / 2, [3 * NBI - 1, j]); }
  // около площада в центъра: „Кръгово движение“ по четирите подхода
  if (grid.center) { const [ci, cj] = grid.center; for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { const i = ci + dx * 3, j = cj + dz * 3; if (isRoad(i, j)) approach('roundabout', i, j, dx, dz); } }
  return n;
}

// ---- градовете с плана v2 (генерираните и по истинската карта): знаците от плана — инстанции по части на модела (малко draw calls)
// „Стоп“ на второстепенните клонове при предимство; „Пропусни“ + „Кръгово движение“ на всеки вход на кръгово; „50“ / „край“ на входовете
// на града; „Забранено влизането“ в края на еднопосочна улица, откъдето колите не бива да влизат. Знакът е вдясно от колата, лице към нея.
// P — планът (cityplan2.js); връща { group, n } в координатите на плана (game.js го мести с offset)
export function plan2Signs(P) {
  if (!SRC) return null;
  const place = { stop: [], yield: [], roundabout: [], speed: [], speedend: [], noentry: [] }, ST = P.STOP || 4.6;
  const U = a => [Math.cos(a.angle), Math.sin(a.angle)];
  // към възела (посоката −u): вдясно е (uz, −ux); навън (посоката +u): вдясно е (−uz, ux)
  const inR = u => [u[1], -u[0]], outR = u => [-u[1], u[0]], faceOut = u => Math.atan2(u[0], u[1]), faceIn = u => Math.atan2(-u[0], -u[1]);
  for (const n of P.nodes) {
    if (n.ctrl === 'yield' && n.kind !== 'round') for (const a of n.arms) { if (a.prio || P.roads[a.road].noCars) continue; const rd = P.roads[a.road], u = U(a), r = inR(u), d = (a.t || n.r || 6) + ST + 0.6, hw = rd.w / 2 + 0.9;
      if (rd.oneway && !a.stop) continue; place.stop.push([n.x + u[0] * d + r[0] * hw, n.z + u[1] * d + r[1] * hw, faceOut(u)]); }
    if (n.endKind === 'exit' && n.arms.length === 1) { const a = n.arms[0], rd = P.roads[a.road], u = U(a), hw = rd.w / 2 + 0.9, ro = outR(u), ri = inR(u);
      place.speed.push([n.x + u[0] * 30 + ro[0] * hw, n.z + u[1] * 30 + ro[1] * hw, faceIn(u)]); place.speedend.push([n.x + u[0] * 24 + ri[0] * hw, n.z + u[1] * 24 + ri[1] * hw, faceOut(u)]); }
  }
  for (const R of P.rounds || []) { const n = P.nodes[R.node]; for (const a of n.arms) { const rd = P.roads[a.road]; if (rd.noCars) continue; const u = U(a), r = inR(u), hw = rd.w / 2 + 0.9, d = R.outer + 5;
    place.yield.push([n.x + u[0] * d + r[0] * hw, n.z + u[1] * d + r[1] * hw, faceOut(u)]); place.roundabout.push([n.x + u[0] * (d + 1.4) + r[0] * hw, n.z + u[1] * (d + 1.4) + r[1] * hw, faceOut(u)]); } }
  // еднопосочна: lanes = [напред, назад] по pts; колите излизат при края с нулевите ленти назад → там е „забранено“ за влизащите
  const OW = new Map(); for (const rd of P.roads) if (rd.oneway && !rd.noCars) { const fw = rd.lanes[0] > 0 ? 1 : -1; for (let i = 1; i < rd.pts.length; i++) { const a = rd.pts[i - 1], b = rd.pts[i], k = Math.floor((a[0] + b[0]) / 40) + ',' + Math.floor((a[1] + b[1]) / 40), L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; (OW.get(k) || OW.set(k, []).get(k)).push([rd.id, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, fw * (b[0] - a[0]) / L, fw * (b[1] - a[1]) / L]); } }
  const paired = (rd, x, z, ux, uz) => { const gx = Math.floor(x / 20), gz = Math.floor(z / 20); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of OW.get((gx + i) + ',' + (gz + j)) || []) if (q[0] !== rd.id && Math.hypot(q[1] - x, q[2] - z) < rd.w / 2 + 14 && q[3] * ux + q[4] * uz > 0.8) return true; return false; };   // второто платно (движи се навън) до нас → двойно платно, не еднопосочна улица
  for (const rd of P.roads) { if (!rd.oneway || rd.noCars) continue; const fwd = rd.lanes[0] > 0, nid = fwd ? rd.to : rd.from, n = P.nodes[nid], a = n && n.arms.find(q => q.road === rd.id && q.end === (fwd ? 1 : 0)); if (!a) continue;
    if (n.arms.length < 3 || rd.cls !== 'street') continue;   /* булевардите с две еднопосочни платна не са „еднопосочна улица“ */ // само на истинско кръстовище (по веригата от сегменти на една улица — не)
    const u = U(a), r = outR(u), d = (a.t || n.r || 4) + 2.5, hw = rd.w / 2 + 0.9, x = n.x + u[0] * d + r[0] * hw, z = n.z + u[1] * d + r[1] * hw;
    if (paired(rd, n.x + u[0] * (d + 6), n.z + u[1] * (d + 6), u[0], u[1])) continue;
    if (place.noentry.some(q => Math.hypot(q[0] - x, q[1] - z) < 25)) continue;   // не по-гъсто от 25 м
    place.noentry.push([x, z, faceIn(u)]); }
  const g = new THREE.Group(), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1); let total = 0;
  for (const [k, list] of Object.entries(place)) { if (!list.length || !SRC[k]) continue; const proto = SRC[k]; proto.updateMatrixWorld(true); total += list.length;
    proto.traverse(m => { if (!m.isMesh) return; const local = m.matrixWorld.clone(), im = new THREE.InstancedMesh(m.geometry, m.material, list.length);
      list.forEach(([x, z, yaw], i) => { M.compose(V.set(x, 0, z), Q.setFromAxisAngle(Y, yaw), S1).multiply(local); im.setMatrixAt(i, M); });
      im.castShadow = true; im.computeBoundingSphere(); im.userData.roadSign = k; g.add(im); }); }
  g.name = 'plan2Signs'; g.userData.keep = true;
  return { group: g, n: total, counts: Object.fromEntries(Object.entries(place).map(([k, l]) => [k, l.length])) };
}
