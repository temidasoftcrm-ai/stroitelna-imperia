// vanlogo.js — бусът на бригадата: истински модел (assets/heavy/vans, Sketchfab CC BY) в истински размер и логото на фирмата
// отстрани (двете страни). Логото — платно: иконата и името в цвета на марката (BRANDS от group.js, името на играча).
//   import { crewVan } from './vanlogo.js';
//   const van = crewVan(gltf.scene, { brand: { nm, col, ico }, len: 5.9 }) → THREE.Group (дължината по z, предницата към +z, колелата на y = 0)
import * as THREE from 'three';
import { canvasTex } from './texdata.js';   // fac-data (T1): статичните платна → собствени данни (не се губят)

export const VANS = {   // [файл, истинска дължина в м]
  sprinter: ['assets/heavy/vans/van-sprinter.glb', 5.9],
  ducato: ['assets/heavy/vans/van-ducato.glb', 5.4],
  mb207: ['assets/heavy/vans/van-mb207.glb', 5.3],
  transit: ['assets/heavy/vans/van-transit.glb', 5.2],
};
const texCache = new Map();
export function brandTex(b) {
  const key = b.nm + b.col + b.ico; if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d');
  g.clearRect(0, 0, 1024, 256);
  g.font = '120px "Noto Color Emoji", system-ui, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(b.ico, 40, 132);
  g.font = '900 104px system-ui, sans-serif'; g.lineWidth = 12; g.strokeStyle = 'rgba(20,24,32,0.85)'; g.strokeText(b.nm.toUpperCase(), 200, 128); g.fillStyle = b.col; g.fillText(b.nm.toUpperCase(), 200, 128);   // само логото: иконата и името в цвета на марката (потребителят: без лента и надпис)
  const t = canvasTex(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texCache.set(key, t); return t;
}
export function crewVan(src, o = {}) {
  const obj = src.clone(true), inner = new THREE.Group(), g = new THREE.Group(); inner.add(obj); g.add(inner);
  let b = new THREE.Box3().setFromObject(inner), s = b.getSize(new THREE.Vector3());
  if (s.x > s.z) { inner.rotation.y = Math.PI / 2; b = new THREE.Box3().setFromObject(inner); s = b.getSize(new THREE.Vector3()); }   // дължината — по z
  const k = (o.len || 5.9) / s.z; inner.scale.setScalar(k); b = new THREE.Box3().setFromObject(inner); const c = b.getCenter(new THREE.Vector3()); inner.position.set(-c.x, -b.min.y, -c.z);
  if (o.flip) inner.rotation.y += Math.PI;
  b = new THREE.Box3().setFromObject(g); s = b.getSize(new THREE.Vector3());
  obj.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  if (o.brand) {   // логото — на задните 60 % от товарния отсек, на ~55 % от височината, леко отделено от ламарината
    const t = brandTex(o.brand), lw = s.z * 0.45, lh = lw / 4, mat = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.05, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), mat); p.rotation.y = sd * Math.PI / 2; p.position.set(sd * (s.x / 2 + 0.02), s.y * 0.55, -s.z * 0.12); g.add(p); }
  }
  g.userData.size = { len: s.z, w: s.x, h: s.y };
  return g;
}

// ---- зареждане за играта: 4-те буса (вместо УАЗ) — A['sf-van-<k>'] (в мащаба на колите, дължина по z); A['sf-car-Van'] — четирите като варианти
// (трафикът и бригадата ги редуват). VAN_CLIPS[k] — анимациите (спринтерът: отварят се предните и задните врати, 2,9 s)
export const VAN_CLIPS = {};
export function loadVans(load, A, mPer = 1) {
  return Promise.all(Object.entries(VANS).map(([k, [f, len]]) => load(f).then(g => { const v = crewVan(g.scene, { len: len * mPer }); v.userData.van = k; if (g.animations && g.animations.length) VAN_CLIPS[k] = g.animations; A['sf-van-' + k] = { scene: v }; return v; }).catch(e => { console.warn('van', k, e); return null; })))
    .then(list => { list = list.filter(Boolean); if (list.length) A['sf-car-Van'] = { scene: list[0], variants: list }; return list; });
}
// логото на фирмата върху вече поставен бус (клонинг от model()): двете страни
export function addVanLogo(van, brand) {
  if (!van || !brand || van.userData.logo) return; const s = van.userData.size; if (!s) return;
  const t = brandTex(brand), lw = s.len * 0.45, lh = lw / 4, mat = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.05, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), mat); p.rotation.y = sd * Math.PI / 2; p.position.set(sd * (s.w / 2 + 0.02), s.h * 0.55, -s.len * 0.12); van.add(p); }
  van.userData.logo = 1;
}
// вратите на спринтера: open(true/false) — пуска анимацията напред/назад; mixer.update(dt) — от играта
export function vanDoors(van) {
  const clips = VAN_CLIPS[van.userData.van]; if (!clips) return null; const mixer = new THREE.AnimationMixer(van), act = mixer.clipAction(clips[0]); act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true;
  return { mixer, open(on) { act.paused = false; act.timeScale = on ? 1 : -1; if (!act.isRunning()) { if (!on) act.time = act.getClip().duration; act.play(); } } };
}
