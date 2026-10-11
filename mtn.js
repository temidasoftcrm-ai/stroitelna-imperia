// mtn.js — истински планини (Sketchfab, CC-BY) за курортите, магистралите и жп линиите.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// истински планини от Sketchfab (CC-BY): peak — „Snow Mountain“ (hkp941111), far1/far2 — „Mountain low poly…“ (Mehdi Shahsavan).
// Зареждат се веднъж; докато не са готови, се виждат конусите, после се подменят.
const MTN = {};
let mtnLoad = null;
export function loadMountains() {
  if (!mtnLoad) { const L = new GLTFLoader(); mtnLoad = Promise.all(['peak', 'far1', 'far2'].map(k => new Promise(res => L.load(`assets/heavy/mtn/${k}.glb`, g => { MTN[k] = g.scene; res(); }, undefined, () => res())))); }
  return mtnLoad;
}
// планина с основа w (по-голямата страна) и височина h, център (0,0), основата на y = 0
export function mtnModel(k, w, h, rot = 0) {
  const src = MTN[k]; if (!src) return null;
  const o = src.clone(true), g = new THREE.Group(); g.add(o); o.rotation.y = rot; g.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(o), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
  // моделите са парчета терен с неравни ръбове: „земята“ е височината на ръба (80-и перцентил), не най-ниската точка —
  // иначе ръбовете висят във въздуха. Под нея моделът потъва в тревата.
  const ys = [], v = new THREE.Vector3();
  o.traverse(m => { if (!m.isMesh) return; const P = m.geometry.attributes.position, step = Math.max(1, Math.floor(P.count / 20000));
    for (let i = 0; i < P.count; i += step) { v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); if (Math.abs(v.x - c.x) > sz.x * 0.44 || Math.abs(v.z - c.z) > sz.z * 0.44) ys.push(v.y); } });
  ys.sort((a, b) => a - b);
  const ground = ys.length ? Math.min(bb.min.y + sz.y * 0.45, ys[Math.floor(ys.length * 0.8)]) : bb.min.y;
  const kx = w / Math.max(sz.x, sz.z), ky = h / Math.max(1e-6, bb.max.y - ground);
  g.scale.set(kx, ky, kx); o.position.set(-c.x, -ground, -c.z);
  g.traverse(m => { if (m.isMesh) { m.receiveShadow = true; m.castShadow = false; } });
  return g;
}

// стари каменни мостове над реката (Sketchfab, CC-BY, xplanepilot): stone — „Stone Bridge_3arch“, rail — „Railway Stone Bridge“
const BR = {};
let brLoad = null;
export function loadBridges() {
  if (!brLoad) { const L = new GLTFLoader(); brLoad = Promise.all(['stone', 'rail'].map(k => new Promise(res => L.load(`assets/heavy/bridge/${k}.glb`, g => { BR[k] = g.scene; res(); }, undefined, () => res())))); }
  return brLoad;
}
// мост с дължина len по z (през реката), основата на y = 0
export function bridgeModel(k, len) {
  const src = BR[k]; if (!src) return null;
  const o = src.clone(true), g = new THREE.Group(), inner = new THREE.Group(); inner.add(o); g.add(inner); g.updateMatrixWorld(true);
  let bb = new THREE.Box3().setFromObject(g), sz = bb.getSize(new THREE.Vector3());
  if (sz.x > sz.z) { inner.rotation.y = Math.PI / 2; g.updateMatrixWorld(true); bb = new THREE.Box3().setFromObject(g); sz = bb.getSize(new THREE.Vector3()); }
  inner.scale.setScalar(len / sz.z); g.updateMatrixWorld(true);
  bb = new THREE.Box3().setFromObject(g); const c = bb.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -bb.min.y - 1.2, -c.z);   // леко под водата — краката стъпват в реката
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}
