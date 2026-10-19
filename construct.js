// construct.js — истинските модели на строежите вместо детските на Kenney/Majadroid (assets/construction, изтрити):
// кулокран, офис контейнери, химическа тоалетна, дъски, тухли на палет, контейнер за отпадъци, варел, самосвали, бетоновоз.
// Моделите — Sketchfab (CC-BY, авторите в CREDITS.txt), assets/heavy/construct; офис контейнерите — контейнерът от пристанището
// (assets/heavy/boats/sf-container, боядисан), самосвалите — истинският самосвал на техниката (assets/heavy/gear/dump).
// Всеки застава под старото име в кутията на детския модел при мащаб 1 (KID) — кодът навсякъде остава model('crane-tower', k) и т.н.
// Кулокранът: мачтата му — там, където беше мачтата на детския (game.js го върти около нея).
import * as THREE from 'three';
import { feature } from './lab/feature.js';

// детският модел при мащаб 1: [ширина x, височина y, дължина z, център x, основа y, център z]
const KID = {
  'crane-tower': [24.476, 54.076, 41.607, 0, 0, 0], 'container-office-green': [3, 2.6, 7, 0, 0, 0], 'container-office-red': [3, 2.6, 7, 0, 0, 0],
  'toilet-portable': [1.26, 2.396, 1.26, 0, 0, 0], 'planks-wood-a': [1.5, 0.6, 4.651, 0, 0, 0], 'box-stack-brown': [1.169, 1.038, 1.996, 0, 0, 0],
  'container-rubble-red': [1.65, 1.778, 4, 0, 0, 0], barrel: [1, 1.2, 1, 0, 0, 0], 'truck-dump-red': [3.13, 3.198, 7.002, 0, 0, 0],
  'truck-dump-green': [3.13, 3.198, 7.002, 0, 0, 0], 'truck-concrete-red': [3.13, 3.815, 7.181, 0, 0, 0],
};
const MAST = [5.91, -10.85];   // мачтата на детския кулокран (x, z) при мащаб 1
// [файл, кои мешове (по името; без — всички), по височина?, боя]
const SRC = {
  'crane-tower': ['heavy/construct/sf-towercrane', null, true], 'toilet-portable': ['heavy/construct/sf-toilet', null, true],
  'planks-wood-a': ['heavy/construct/sf-sitepack', /^Planks/], 'box-stack-brown': ['heavy/construct/sf-bricks', /^Extrude/],
  'container-rubble-red': ['heavy/construct/sf-skip'], barrel: ['heavy/construct/sf-drums', /^Red_/, true],
  'truck-concrete-red': ['heavy/construct/sf-mixer'], 'truck-dump-red': ['heavy/gear/dump'], 'truck-dump-green': ['heavy/gear/dump'],
  'container-office-green': ['heavy/boats/sf-container', null, false, 0x5f8f5a], 'container-office-red': ['heavy/boats/sf-container', null, false, 0xb85a48],
};
export const CONSTRUCT_NAMES = Object.keys(SRC);

const box = o => { o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o); };
function partOf(scene, re) { const g = new THREE.Group(); scene.updateMatrixWorld(true); scene.traverse(m => { if (m.isMesh && (!re || re.test(m.name))) { const c = m.clone(); c.matrixAutoUpdate = false; c.matrix.copy(m.matrixWorld); g.add(c); } }); return g; }
function fitTo(obj, kid, byHeight, tint) {
  const [kx, ky, kz, cx, by, cz] = KID[kid], w = new THREE.Group(), inner = new THREE.Group(); inner.add(obj); w.add(inner);
  let s = box(inner).getSize(new THREE.Vector3());
  if ((kx > kz) !== (s.x > s.z)) { inner.rotation.y = Math.PI / 2; s = box(inner).getSize(new THREE.Vector3()); }
  inner.scale.multiplyScalar(byHeight ? ky / s.y : Math.max(kx, kz) / Math.max(s.x, s.z));
  const b = box(inner), c = b.getCenter(new THREE.Vector3());
  inner.position.add(new THREE.Vector3(cx - c.x, by - b.min.y, cz - c.z));
  if (kid === 'crane-tower') {   // мачтата — долните 4% от височината: центърът им отива в MAST
    const v = new THREE.Vector3(), lo = []; inner.updateMatrixWorld(true);
    inner.traverse(m => { if (!m.isMesh) return; const P = m.geometry.attributes.position; for (let i = 0; i < P.count; i += 7) { v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); if (v.y < by + ky * 0.04) lo.push(v.clone()); } });
    if (lo.length) { const mb = new THREE.Box3().setFromPoints(lo), mc = mb.getCenter(new THREE.Vector3()); inner.position.x += MAST[0] - mc.x; inner.position.z += MAST[1] - mc.z; }
  }
  w.traverse(m => {
    if (!m.isMesh) return; m.castShadow = true; m.receiveShadow = true; const mt = m.material; if (!mt) return;
    if (tint || mt.metalness > 0.5) { m.material = mt.clone(); m.material.metalness = Math.min(mt.metalness, 0.3); m.material.roughness = Math.max(mt.roughness ?? 0.5, 0.6); }   // без огледална среда металът излиза черен
    if (tint) { m.material.map = null; m.material.metalnessMap = null; m.material.metalness = 0.15; m.material.color.set(tint); }   // боядисаният контейнер — ребрата (релефът) остават
  });
  return w;
}
// load(url) → Promise<gltf>; A — моделите. asScene: online3d.js пази A[n] = сцена (не gltf)
export function loadConstruct(load, A, asScene = false) {
  if (!feature('cs-real')) return Promise.resolve();   // Лабораторията → cs-real (докато не е одобрено — детските)
  const files = [...new Set(Object.values(SRC).map(s => s[0]))], G = {};
  return Promise.all(files.map(f => load(`assets/${f}.glb`).then(g => { G[f] = g.scene || g; }).catch(e => console.warn('construct', f, e)))).then(() => {
    for (const [n, [f, re, byH, tint]] of Object.entries(SRC)) {
      if (!G[f]) continue; const sc = fitTo(partOf(G[f], re), n, byH, tint);
      A[n] = asScene ? sc : { scene: sc };
    }
  });
}
