// boatsreal.js — истинските лодки, шамандури, контейнери и товарни кораби вместо детските на Kenney (изтрити от assets/watercraft):
// платноходка, моторна яхта, рибарска лодка, рибарски кораб (вместо галеона), шамандура, контейнер (Sketchfab, CC-BY — assets/heavy/boats,
// авторите в CREDITS.txt); товарните — истинските контейнеровоз и танкер от флота (shipmodels.js). Всеки застава в кутията на някогашния
// детски модел (размерите му са в KID) — подредбата на пристанището, залива и курортите остава същата. game.js ги зарежда с моделите
// на курортите (resortview.js RESORT_MODELS → A['sf-…']).
import * as THREE from 'three';
import { hasShipModel, shipModel } from './shipmodels.js';

export const BOAT_FILES = ['sf-sailboat', 'sf-yacht', 'sf-fisherboat', 'sf-fishship', 'sf-buoy', 'sf-container'];
const REAL = { 'boat-sail-a': 'sf-sailboat', 'boat-sail-b': 'sf-sailboat', 'boat-speed-a': 'sf-yacht', 'boat-speed-c': 'sf-yacht', 'boat-fishing-small': 'sf-fisherboat',
  'ship-small': 'sf-fishship', buoy: 'sf-buoy', 'cargo-container-a': 'sf-container', 'cargo-container-b': 'sf-container', 'cargo-container-c': 'sf-container' };
const SHIPS = { 'ship-cargo-a': 'container', 'ship-cargo-b': 'tanker' };
const TINT = { 'cargo-container-a': 0xd8584a, 'cargo-container-b': 0x5a86d8, 'cargo-container-c': 0x5fae6e };
// детският модел при мащаб 1: [ширина x, височина y, дължина z, център x, основа y, център z]
const KID = {
  'ship-cargo-a': [3.917, 3.380, 10.549, 0, 0, 0], 'ship-cargo-b': [3.917, 3.301, 10.549, 0, 0, 0], 'ship-small': [4.8, 9.964, 10.6, 0, 0, 0],
  'boat-sail-a': [1.785, 4.739, 3.77, 0, 0, 0.1], 'boat-sail-b': [1.785, 4.481, 4.07, 0, 0, 0.25], 'boat-speed-a': [1.785, 1.5, 3.37, 0, 0, 0],
  'boat-speed-c': [1.785, 1.3, 3.17, 0, 0, 0], 'boat-fishing-small': [1.785, 2.6, 3.87, 0, 0, 0], buoy: [0.928, 1.844, 0.928, 0, -0.3, 0],
  'cargo-container-a': [1.38, 1.104, 2.76, 0, 0, 0], 'cargo-container-b': [1.38, 1.104, 2.76, 0, 0, 0], 'cargo-container-c': [1.38, 1.104, 2.76, 0, 0, 0],
};
export const isRealBoat = n => !!(REAL[n] || SHIPS[n]);
export const isRealShip = n => !!SHIPS[n];
// истинският модел вместо детския n при мащаб s; null — ако още не е зареден (товарните идват малко след града — вж. swapPendingShips)
export function realBoat(A, model, n, s) {
  if (SHIPS[n]) return hasShipModel(SHIPS[n]) ? fitTo(shipModel(SHIPS[n]), n, s) : null;
  return REAL[n] && A[REAL[n]] ? fitTo(model(REAL[n], 1), n, s) : null;
}
// място за товарен кораб, който още се зарежда; swapPendingShips(root, ships) го сменя (ships — люлеенето на вълните: [{ o }])
export function pendingShip(n, s) { const g = new THREE.Group(); g.userData.pendingShip = n; g.userData.pendingS = s; return g; }
export function swapPendingShips(root, ships = []) {
  const L = []; root.traverse(o => { if (o.userData.pendingShip && hasShipModel(SHIPS[o.userData.pendingShip])) L.push(o); });
  for (const o of L) { const w = fitTo(shipModel(SHIPS[o.userData.pendingShip]), o.userData.pendingShip, o.userData.pendingS); w.position.copy(o.position); w.rotation.copy(o.rotation); w.visible = o.visible; o.parent.add(w); o.parent.remove(o); for (const sh of ships) if (sh.o === o) sh.o = w; }
}
// в кутията на детския: същата дължина (шамандурата — същата височина), дългата ос по същата посока, основата на същото ниво; лодките газят
function fitTo(real, n, s) {
  const box = o => { o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o); };
  const [kx, ky, kz, cx, by, cz] = KID[n].map((v, i) => v * s), w = new THREE.Group(), inner = new THREE.Group(); inner.add(real); w.add(inner);
  { const S = box(real).getSize(new THREE.Vector3()), big = Math.max(S.x, S.y, S.z), drop = [];   // плоските мешове (вградена вода около модела — шамандурата) — вън
    real.traverse(m => { if (m.isMesh) { const q = box(m).getSize(new THREE.Vector3()); if (q.y < big * 0.02 && Math.max(q.x, q.z) > big * 0.3) drop.push(m); } }); for (const m of drop) m.parent.remove(m); }
  let rs = box(inner).getSize(new THREE.Vector3());
  if ((kx > kz) !== (rs.x > rs.z)) { inner.rotation.y = Math.PI / 2; rs = box(inner).getSize(new THREE.Vector3()); }
  inner.scale.multiplyScalar(n === 'buoy' ? ky / rs.y : Math.max(kx, kz) / Math.max(rs.x, rs.z));
  const rb = box(inner), rc = rb.getCenter(new THREE.Vector3());
  const draft = /^(boat-|ship-)/.test(n) ? (rb.max.y - rb.min.y) * 0.16 : n === 'buoy' ? (rb.max.y - rb.min.y) * 0.12 : 0;
  inner.position.add(new THREE.Vector3(cx - rc.x, by - rb.min.y - draft, cz - rc.z));
  real.traverse(m => {
    if (!m.isMesh) return; m.castShadow = true; m.receiveShadow = true;
    const mt = m.material; if (!mt) return;
    if (TINT[n] || mt.metalness > 0.5) { m.material = mt.clone(); m.material.metalness = Math.min(mt.metalness, 0.3); m.material.roughness = Math.max(mt.roughness ?? 0.5, 0.6); }   // без огледална среда металът излиза черен
    if (TINT[n]) { m.material.map = null; m.material.metalnessMap = null; m.material.metalness = 0.15; m.material.roughness = 0.75; m.material.color.set(TINT[n]); }   // контейнерът: текстурата е ръждясала и тъмна — боядисан, ребрата остават
  });
  return w;
}
