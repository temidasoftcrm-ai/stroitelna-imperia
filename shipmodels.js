// shipmodels.js — истински 3D кораби от Sketchfab (CC-BY, авторите са в CREDITS.txt и „📜 Автори“):
//   container — „Small Cargo Ship“ (Styx) · tanker — „Tanker“ (3DDomino) · cruise — „Viking Cruise Ship“ (jfactory)
// Зареждат се асинхронно; докато не са готови (или ако не се заредят), seaside.js ползва корабите на Kenney.
// Всеки кораб: носът е към +z, център в началото, ватерлинията на y = 0 (корпусът е малко под водата).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// дължина в света на играта, накъде гледа носът в модела (завъртане около y) и газене (част от височината под водата)
const CFG = {
  container: { f: 'container.glb', len: 64, yaw: 0, draft: 0.18 },
  tanker: { f: 'tanker.glb', len: 66, yaw: 0, draft: 0.3 },
  cruise: { f: 'cruise.glb', len: 74, yaw: 0, draft: 0.12 },
};
const P = {};
let loading = null;

function normalize(obj, c) {
  const g = new THREE.Group(), inner = new THREE.Group(); inner.add(obj); g.add(inner);
  g.updateMatrixWorld(true);
  let bb = new THREE.Box3().setFromObject(g), s = bb.getSize(new THREE.Vector3());
  if (s.x > s.z) inner.rotation.y = Math.PI / 2;   // дългата ос — по z
  inner.rotation.y += c.yaw;
  g.updateMatrixWorld(true); bb = new THREE.Box3().setFromObject(g); s = bb.getSize(new THREE.Vector3());
  inner.scale.setScalar(c.len / s.z); g.updateMatrixWorld(true);
  bb = new THREE.Box3().setFromObject(g); s = bb.getSize(new THREE.Vector3());
  const ctr = bb.getCenter(new THREE.Vector3());
  inner.position.set(-ctr.x, -bb.min.y - s.y * c.draft, -ctr.z);
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; for (const mt of [].concat(m.material)) if (mt && mt.metalness > 0.5) mt.metalness = 0.4; } });
  return g;
}
export function loadShipModels(base = 'assets/heavy/ships/') {
  if (loading) return loading;
  const L = new GLTFLoader();
  loading = Promise.all(Object.entries(CFG).map(([k, c]) => new Promise(res => L.load(base + c.f, g => { try { P[k] = normalize(g.scene, c); } catch (e) { console.warn('shipmodels', k, e); } res(); }, undefined, e => { console.warn('shipmodels', k, e); res(); }))));
  return loading;
}
export const hasShipModel = k => !!P[k];
export const shipModel = k => (P[k] ? P[k].clone(true) : null);
