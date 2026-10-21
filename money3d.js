// money3d.js — истинските пари (Лабораторията → money-real; Sketchfab CC BY, assets/heavy/money, авторите в CREDITS.txt):
//  • пачка с бандерол (money-bundle) и златно кюлче (gold-bar) — по една геометрия и един материал, за InstancedMesh в трезора
//    (vault3d.js сменя геометрията/материала на своите InstancedMesh-ове — местата и броят им остават);
//  • купчина пачки и рула (money-stacks) — бонусът на директора на масата (1–5 купчини, плъзгат се по масата към него).
//   const R = await loadMoney(load);  R.cashGeo({ w, h, d }) — центрирана; R.barGeo({ w, h, d }) — основа на y = 0
//   const b = bonusStacks(R, n, { x, z, y, ry, from }) → { group, update(dt) → true, докато се движи }
import * as THREE from 'three';

const one = (scene) => {   // всички мешове на сцената → една геометрия (позиция, нормали, uv) в координатите на сцената; материалът — на първия
  scene.updateMatrixWorld(true); const parts = []; let mat = null;
  scene.traverse(m => { if (!m.isMesh) return; const g = m.geometry.clone().applyMatrix4(m.matrixWorld); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]); parts.push(g); mat = mat || m.material; });
  if (parts.length === 1) return { geo: parts[0], mat };
  let nv = 0; for (const p of parts) nv += p.attributes.position.count; const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = []; let o = 0;
  for (const p of parts) { pos.set(p.attributes.position.array, o * 3); if (p.attributes.normal) nor.set(p.attributes.normal.array, o * 3); if (p.attributes.uv) uv.set(p.attributes.uv.array, o * 2); for (const i of p.index.array) idx.push(i + o); o += p.attributes.position.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); return { geo: g, mat };
};
// геометрията — в кутия w × h × d: дългата страна по x, височината по y (еднакъв мащаб не се пази — пачката е пачка; но отношенията на модела са близки)
const fitGeo = (geo, { w, h, d }, base) => {
  const g = geo.clone(); g.computeBoundingBox(); let b = g.boundingBox, s = b.getSize(new THREE.Vector3());
  if (s.z > s.x) { g.rotateY(Math.PI / 2); g.computeBoundingBox(); b = g.boundingBox; s = b.getSize(new THREE.Vector3()); }
  if (s.y > Math.min(s.x, s.z) * 1.5) { g.rotateX(Math.PI / 2); g.computeBoundingBox(); b = g.boundingBox; s = b.getSize(new THREE.Vector3()); }   // лежи плоско
  const c = b.getCenter(new THREE.Vector3()); g.translate(-c.x, base ? -b.min.y : -c.y, -c.z); g.scale(w / s.x, h / s.y, d / s.z); g.computeVertexNormals(); return g;
};
let P = null;
export function loadMoney(load) {
  return P || (P = Promise.all(['money-bundle', 'gold-bar', 'money-stacks'].map(n => load(`assets/heavy/money/${n}.glb`).then(g => g.scene || g).catch(() => null))).then(([cash, gold, stacks]) => {
    const C = cash && one(cash), G = gold && one(gold);
    if (G && G.mat) { G.mat = G.mat.clone(); G.mat.metalness = 1; G.mat.roughness = Math.min(G.mat.roughness ?? 0.3, 0.3); if (!('emissive' in G.mat)) G.mat = new THREE.MeshStandardMaterial({ map: G.mat.map, color: 0xf2c14e, metalness: 1, roughness: 0.25 }); }
    return {
      cashMat: C && C.mat, barMat: G && G.mat, stacks,
      cashGeo: sz => C ? fitGeo(C.geo, sz, false) : null,
      barGeo: sz => G ? fitGeo(G.geo, sz, true) : null,
    };
  }));
}
// бонусът на масата: n купчини (1–5) една до друга пред директора; плъзгат се от from (центъра на масата) за ~0,8 s
export function bonusStacks(R, n, at) {
  const g = new THREE.Group(); if (!R || !R.stacks) return { group: g, update: () => false };
  const src = R.stacks, b = new THREE.Box3().setFromObject(src), s = b.getSize(new THREE.Vector3()), k = 0.26 / Math.max(s.x, s.z), c = b.getCenter(new THREE.Vector3());
  const N = Math.max(1, Math.min(5, n | 0)), items = [];
  for (let i = 0; i < N; i++) { const w = new THREE.Group(), o = src.clone(true); o.scale.setScalar(k); o.position.set(-c.x * k, -b.min.y * k, -c.z * k); o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); w.add(o);
    const off = (i - (N - 1) / 2) * 0.24; w.userData.to = new THREE.Vector3(off, 0, 0); w.rotation.y = (i * 1.7) % 0.5 - 0.25; g.add(w); items.push(w); }
  g.position.set(at.x, at.y || 0, at.z); g.rotation.y = at.ry || 0;
  const from = at.from ? g.worldToLocal(new THREE.Vector3(...at.from)) : new THREE.Vector3(0, 0, -1.2); let t = 0;
  items.forEach(w => w.position.copy(from));
  return { group: g, update(dt) { if (t >= 1) return false; t = Math.min(1, t + dt / 0.8); const e = 1 - Math.pow(1 - t, 3); items.forEach((w, i) => { const ti = Math.min(1, Math.max(0, (t - i * 0.08) / (1 - i * 0.08 || 1))), ei = 1 - Math.pow(1 - ti, 3); w.position.lerpVectors(from, w.userData.to, ei); }); return t < 1; } };
}
