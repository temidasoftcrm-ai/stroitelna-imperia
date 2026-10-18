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
export const loadSigns = () => P || (P = new Promise(res => new GLTFLoader().load('assets/heavy/signs/signs.glb', g => {
  const root = g.scene.getObjectByName('signs') || g.scene; SRC = {};
  for (const k of [...root.children]) SRC[k.name] = prep(k);
  res(SRC);
}, undefined, () => res(null))));
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
