// vanlogo.js — бусът на бригадата: истински модел (assets/heavy/vans, Sketchfab CC BY) в истински размер и логото на фирмата
// отстрани (двете страни). Логото — платно: иконата и името в цвета на марката (BRANDS от group.js, името на играча).
//   import { crewVan } from './vanlogo.js';
//   const van = crewVan(gltf.scene, { brand: { nm, col, ico }, len: 5.9 }) → THREE.Group (дължината по z, предницата към +z, колелата на y = 0)
import * as THREE from 'three';
import { canvasTex } from './texdata.js';   // fac-data (T1): статичните платна → собствени данни (не се губят)
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { feature } from './lab/feature.js';
const GETC = ['getX', 'getY', 'getZ', 'getW'];   // three r160: BufferAttribute няма getComponent (от r161)

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
  const sh = feature('van-shut') ? shutDoors(van, clips[0]) : null; let open = false;
  if (sh) { const up = mixer.update.bind(mixer); mixer.update = dt => { const r = up(dt); if (!open && sh.out && (!act.isRunning() || act.time <= 0)) sh.show(false); return r; }; }
  return { mixer, open(on) { open = on; if (on && sh) sh.show(true); act.paused = false; act.timeScale = on ? 1 : -1; if (!act.isRunning()) { if (!on) act.time = act.getClip().duration; act.play(); } } };
}
// ⚡ van-shut: докато вратите са затворени (по пътя — почти винаги), частите им са слети по материал в позата „затворено“: бусът ~45 → ~33 рисувания.
// open(true) → истинските врати (анимацията); затворят ли се докрай → пак слетите.
function shutDoors(van, clip) {
  const names = new Set(clip.tracks.map(t => THREE.PropertyBinding.parseTrackName(t.name).nodeName)), doors = [];
  van.traverse(o => { if (names.has(o.name) || names.has(THREE.PropertyBinding.sanitizeNodeName(o.name || ''))) doors.push(o); });
  const top = doors.filter(d => !doors.some(e => e !== d && isAnc(e, d))); if (!top.length) return null;
  van.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(van.matrixWorld).invert(), M = new THREE.Matrix4(), by = new Map();
  for (const d of top) d.traverse(m => { if (!m.isMesh || m.isSkinnedMesh || Array.isArray(m.material) || !m.visible || m.children.length) return;
    M.multiplyMatrices(inv, m.matrixWorld); if (M.determinant() <= 0) return; const g = m.geometry.clone(); for (const n of Object.keys(g.attributes)) { const a = g.attributes[n];
      if (a.isInterleavedBufferAttribute || a.normalized || !(a.array instanceof Float32Array)) { const f = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a[GETC[c]](i); g.setAttribute(n, new THREE.BufferAttribute(f, a.itemSize)); } }
    g.morphAttributes = {}; g.clearGroups(); g.applyMatrix4(M); const k = m.material.uuid + '|' + Object.keys(g.attributes).sort().join(',') + (g.index ? 'i' : 'n') + m.castShadow + m.receiveShadow;
    (by.get(k) || by.set(k, []).get(k)).push([g, m]); });
  const shut = new THREE.Group(); shut.name = 'doorsShut';
  for (const list of by.values()) { let mg = null; try { mg = mergeGeometries(list.map(x => x[0]), false); } catch (e) { mg = null; } list.forEach(x => x[0].dispose()); if (!mg) return null;
    const a = list[0][1], me = new THREE.Mesh(mg, a.material); me.castShadow = a.castShadow; me.receiveShadow = a.receiveShadow; me.userData.mergedOf = list.length; shut.add(me); }
  van.add(shut); const S = { out: false, show(on) { S.out = on; shut.visible = !on; for (const d of top) d.visible = on; } }; S.show(false); return S;
}
const isAnc = (a, b) => { for (let q = b.parent; q; q = q.parent) if (q === a) return true; return false; };
