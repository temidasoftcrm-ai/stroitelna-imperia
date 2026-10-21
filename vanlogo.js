// vanlogo.js — бусът на бригадата: истински модел (assets/heavy/vans, Sketchfab CC BY) в истински размер и логото на фирмата
// отстрани (двете страни). Логото — платно: цветната лента на марката, иконата и името (BRANDS от group.js, името на играча).
//   import { crewVan } from './vanlogo.js';
//   const van = crewVan(gltf.scene, { brand: { nm, col, ico }, len: 5.9 }) → THREE.Group (дължината по z, предницата към +z, колелата на y = 0)
import * as THREE from 'three';

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
  g.fillStyle = b.col; g.fillRect(0, 196, 1024, 30); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 226, 1024, 6);   // цветната лента по долния край
  g.font = '120px "Noto Color Emoji", system-ui, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(b.ico, 40, 105);
  g.font = '900 104px system-ui, sans-serif'; g.lineWidth = 10; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.strokeText(b.nm.toUpperCase(), 200, 100); g.fillStyle = '#1b2230'; g.fillText(b.nm.toUpperCase(), 200, 100);
  g.font = '700 40px system-ui, sans-serif'; g.fillStyle = '#1b2230'; g.fillText('СТРОИТЕЛНА ФИРМА', 206, 168);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texCache.set(key, t); return t;
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
    const t = brandTex(o.brand), lw = s.z * 0.55, lh = lw / 4, mat = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.05, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const sd of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), mat); p.rotation.y = sd * Math.PI / 2; p.position.set(sd * (s.x / 2 + 0.02), s.y * 0.55, -s.z * 0.12); g.add(p); }
  }
  g.userData.size = { len: s.z, w: s.x, h: s.y };
  return g;
}
