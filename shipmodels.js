// shipmodels.js — истински 3D кораби от Sketchfab (CC-BY, авторите са в CREDITS.txt и „📜 Автори“):
//   container — „Small Cargo Ship“ (Styx) · tanker — „Tanker“ (3DDomino) · cruise — „Caribbean Legend“ (Meshy AI; олекотен: ~51 хил. триъгълника, текстури 1024 webp)
// Зареждат се асинхронно; докато не са готови (или ако не се заредят), seaside.js ползва корабите на Kenney.
// Всеки кораб: носът е към +z, център в началото, ватерлинията на y = 0 (корпусът е малко под водата).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepNightFloors } from './nightfloors.js';
import { feature } from './lab/feature.js';

// дължина в света на играта, накъде гледа носът в модела (завъртане около y) и газене (част от височината под водата)
// 🚢 ship-scale (потребителят: „круизните кораби — 10 пъти, виж как е до яхта“): истински дължини — круизен ~300 м (новият модел на собственика „Cruise Majesty“), контейнеровоз 260, танкер 250, MSC 300
const SS = feature('ship-scale');
export const SHIP_LEN = k => (CFG[k] || {}).len || 0;
const CFG = {
  container: { f: 'container.glb', len: SS ? 260 : 64, yaw: 0, draft: 0.18 },
  tanker: { f: 'tanker.glb', len: SS ? 250 : 66, yaw: 0, draft: 0.3 },
  cruise: SS ? { f: 'cruise-majesty.glb', len: 300, yaw: 0, draft: 0.1, lights: true } : { f: 'cruise.glb', len: 74, yaw: 0, draft: 0.12, lights: true },   // нощем светят прозорците и палубите
  // 🚢 ship-msc (f6): „MSC Irina“ (Meshy AI, собствен) — най-големият: на пристанище ниво 5 до крановете и като контейнеровоза, който влиза/излиза.
  // Възли (Blender): Hull, Radar (клип „radar“), NavLights (червена / зелена / бели), DeckLights, Wake (клип „wake“); ватерлинията — 23,6 % от височината
  ...(feature('ship-msc') ? { msc: { f: 'msc-irina.glb', len: SS ? 300 : 92, yaw: 0, draft: 0.236, msc: true } } : {}),
};
const P = {}, NIGHT = [];   // NIGHT — материалите, които светят нощем (круизният кораб); копията ги споделят
let loading = null;

function normalize(obj, c) {
  const g = new THREE.Group(), inner = new THREE.Group(); inner.add(obj); g.add(inner);
  const wake = c.msc ? obj.getObjectByName('Wake') : null, wp = wake && wake.parent; if (wake) wp.remove(wake);   // ship-msc: пяната зад кърмата не влиза в размерите
  g.updateMatrixWorld(true);
  let bb = new THREE.Box3().setFromObject(g), s = bb.getSize(new THREE.Vector3());
  if (s.x > s.z) inner.rotation.y = Math.PI / 2;   // дългата ос — по z
  inner.rotation.y += c.yaw;
  g.updateMatrixWorld(true); bb = new THREE.Box3().setFromObject(g); s = bb.getSize(new THREE.Vector3());
  inner.scale.setScalar(c.len / s.z); g.updateMatrixWorld(true);
  bb = new THREE.Box3().setFromObject(g); s = bb.getSize(new THREE.Vector3());
  const ctr = bb.getCenter(new THREE.Vector3());
  inner.position.set(-ctr.x, -bb.min.y - s.y * c.draft, -ctr.z);
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; for (const mt of [].concat(m.material)) { if (mt && mt.metalness > 0.5) mt.metalness = 0.4; if (c.lights && !feature('night-nyextra') && mt && mt.emissive && !NIGHT.includes(mt)) { mt.emissive.set(0xfff0c8); if (mt.map && !mt.emissiveMap) mt.emissiveMap = mt.map; mt.emissiveIntensity = 0; mt.needsUpdate = true; NIGHT.push(mt); } } } });
  if (c.lights) prepNightFloors(g, 'cruise');   // Лабораторията → night-nyextra: кабините светят по палуби (вместо цялата текстура)
  if (wake) { wp.add(wake); mscPrep(g); }
  return g;
}
export function loadShipModels(base = 'assets/heavy/ships/') {
  if (loading) return loading;
  const L = new GLTFLoader();
  loading = Promise.all(Object.entries(CFG).map(([k, c]) => new Promise(res => L.load(base + c.f, g => { try { P[k] = normalize(g.scene, c); } catch (e) { console.warn('shipmodels', k, e); } res(); }, undefined, e => { console.warn('shipmodels', k, e); res(); }))));
  return loading;
}
export const hasShipModel = k => !!P[k];
// нощем: 0…1 — круизният кораб светва като град по вода
export function setShipNight(n) { for (const m of NIGHT) m.emissiveIntensity = 0.85 * n; for (const m of MSC_NAV) m.opacity = 0.25 + 0.75 * n; for (const m of MSC_DECK) m.opacity = n; }
// ship-msc: светлините — общи материали за всички копия (нощем светват); радарът и пяната — mscTick() за всяко копие
const MSC_NAV = [], MSC_DECK = [];
function mscPrep(g) {
  const basic = (mt, list, extra = {}) => { const m = new THREE.MeshBasicMaterial({ color: mt.color.clone(), transparent: true, depthWrite: false, opacity: 0, ...extra }); list && list.push(m); return m; };
  const cache = new Map(), swap = (o, list, extra) => o.traverse(m => { if (!m.isMesh) return; const k = m.material.name || m.material.uuid; if (!cache.has(k)) cache.set(k, basic(m.material, list, extra)); m.material = cache.get(k); m.castShadow = m.receiveShadow = false; });
  swap(g.getObjectByName('NavLights'), MSC_NAV, { blending: THREE.AdditiveBlending });
  swap(g.getObjectByName('DeckLights'), MSC_DECK, { blending: THREE.AdditiveBlending });
  swap(g.getObjectByName('Wake'), null, { opacity: 0.55, color: new THREE.Color(0xeef6ff) });
}
// t — секунди; moving — върви ли (пяната зад кърмата); радарът се върти винаги (оборот за 2,5 с, като клипа)
export function mscTick(o, t, moving) {
  const u = o.userData.msc || (o.userData.msc = { radar: o.getObjectByName('Radar'), wake: o.getObjectByName('Wake') });
  if (u.radar) u.radar.rotation.y = (t / 2.5) * Math.PI * 2;
  if (u.wake) { u.wake.visible = !!moving; if (moving) u.wake.scale.z = 45 * (1.1 + 0.15 * Math.sin(t * 1.7)); }
}
export const shipModel = k => (P[k] ? P[k].clone(true) : null);
