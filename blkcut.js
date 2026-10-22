// blkcut.js — по-къси секции на дългите панелни блокове (Лабораторията → real-sizes, задачи №9/№12):
// моделът се реже с равнина напречно на дългата ос и запазената част (с челната стена) се огражда огледално —
// така блокът с 4 входа става точков блок с 1–2 входа, в истински етажи, и влиза в парцела без смаляване до играчка.
//   import { cutMirror } from './blkcut.js';
//   A['sf-blk-panel12-s1'] = { scene: cutMirror(A['sf-blk-panel12'].scene, 'x', 0.2) };   // по две оси — cutMirror(cutMirror(r, 'x', -0.3), 'z', -0.3)
// Материалите са същите обекти (нощните прозорци от prepNightFloors остават); всеки меш остава в своята локална система.
import * as THREE from 'three';

// триъгълниците отрязани с равнината (локално: n·p ≤ c остава); всички атрибути се интерполират
function clipGeo(geo, n, c) {
  const g = geo.index ? geo.toNonIndexed() : geo, names = Object.keys(g.attributes), P = g.attributes.position, out = names.map(() => []);
  const d = i => n.x * P.getX(i) + n.y * P.getY(i) + n.z * P.getZ(i) - c;
  const vert = (i, j, t) => names.forEach((nm, a) => { const A = g.attributes[nm]; for (let k = 0; k < A.itemSize; k++) { const x = A.getComponent(i, k); out[a].push(j == null ? x : x + (A.getComponent(j, k) - x) * t); } });
  for (let f = 0; f < P.count; f += 3) {
    const poly = [];   // [i, j, t] — върхът i или точката между i и j
    for (let e = 0; e < 3; e++) { const i = f + e, j = f + (e + 1) % 3, di = d(i), dj = d(j);
      if (di <= 0) poly.push([i, null, 0]);
      if ((di < 0 && dj > 0) || (di > 0 && dj < 0)) poly.push([i, j, di / (di - dj)]); }
    for (let k = 1; k + 1 < poly.length; k++) for (const q of [poly[0], poly[k], poly[k + 1]]) vert(...q);
  }
  const r = new THREE.BufferGeometry();
  names.forEach((nm, a) => { const A = g.attributes[nm]; r.setAttribute(nm, new THREE.Float32BufferAttribute(out[a], A.itemSize, A.normalized)); });
  return r;
}

// root — сцената на модела; axis — оста на рязането ('x' или 'z' в системата на root); f — каква част от дължината да остане
// (от min-края; f < 0 — |f| от max-края, напр. лицето към улицата +z)
export function cutMirror(root, axis = 'x', f = 0.25) {
  const o = root.clone(true); o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(o), sg = f < 0 ? -1 : 1, cut = f < 0 ? bb.max[axis] + f * (bb.max[axis] - bb.min[axis]) : bb.min[axis] + f * (bb.max[axis] - bb.min[axis]);
  const N = new THREE.Vector3(axis === 'x' ? sg : 0, 0, axis === 'z' ? sg : 0), plane = new THREE.Plane(N.clone(), -sg * cut);
  const R = new THREE.Matrix4().makeScale(axis === 'x' ? -1 : 1, 1, axis === 'z' ? -1 : 1).premultiply(new THREE.Matrix4().makeTranslation(axis === 'x' ? 2 * cut : 0, 0, axis === 'z' ? 2 * cut : 0));   // огледало спрямо равнината
  const meshes = []; o.traverse(m => { if (m.isMesh) meshes.push(m); });
  for (const m of meshes) {
    const inv = new THREE.Matrix4().copy(m.matrixWorld).invert(), lp = plane.clone().applyMatrix4(inv);   // равнината в локалната система на меша
    const geo = clipGeo(m.geometry, lp.normal, -lp.constant);
    if (!geo.attributes.position.count) { m.removeFromParent(); continue; }
    m.geometry = geo; geo.computeBoundingBox(); geo.computeBoundingSphere();
    const L = new THREE.Matrix4().copy(inv).multiply(R).multiply(m.matrixWorld), g2 = geo.clone().applyMatrix4(L), ix = [];   // огледалото — в същата локална система
    for (let i = 0; i < g2.attributes.position.count; i += 3) ix.push(i, i + 2, i + 1);   // обърнати триъгълници (огледалото обръща лицата)
    g2.setIndex(ix); const m2 = new THREE.Mesh(g2, m.material); m2.name = m.name + '-mirror'; m2.castShadow = m.castShadow; m2.receiveShadow = m.receiveShadow;
    m2.position.copy(m.position); m2.quaternion.copy(m.quaternion); m2.scale.copy(m.scale); m.parent.add(m2);
  }
  return o;
}
