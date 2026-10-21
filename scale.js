// scale.js — една истинска мярка за всички 3D модели: 1 единица = 1 м (Лабораторията → real-scale).
// Каталог: за всеки модел — категория и по какво се мащабира: превозните средства — по дължина, хората — по ръст,
// сградите — по височината до стряхата (етажи × височина на етаж), без покрива, комините и антените. Мащабът е еднакъв по трите оси.
//   import { SCALE, scaleFor, measure } from './scale.js';
//   const k = scaleFor('car-uaz452', gltf.scene); obj.scale.setScalar(k);
// measure(obj) → { w, d, h, len, eave } в единиците на модела (len — по-дългата хоризонтална страна; eave — височината до стряхата)
import * as THREE from 'three';

export const STOREY = 3, GROUND = 3.6;   // м: етаж; партер на търговска сграда
// by: 'len' — дължина (м), 'h' — височина до най-горната точка (м), 'eave' — до стряхата (м; покривът е отгоре)
export const SCALE = {
  // хора
  'ped-adam': { cat: 'person', by: 'h', m: 1.75, f: 'assets/heavy/people/peds/ped-adam.glb' },
  // превозни средства
  'car-polo': { cat: 'car', by: 'len', m: 4.5, f: 'assets/heavy/cars/car-polo.glb' },
  'car-uaz452': { cat: 'jeep', by: 'len', m: 4.4, f: 'assets/heavy/cars/car-uaz452.glb', note: 'УАЗ-452: 4,36 × 1,94 × 2,10 м' },
  'car-renegade': { cat: 'jeep', by: 'len', m: 4.25, f: 'assets/heavy/cars/car-renegade.glb' },
  'gear-dump': { cat: 'dumptruck', by: 'len', m: 8, f: 'assets/heavy/gear/dump.glb', note: 'самосвал 8 × 2,5 × 3,3 м' },
  'bus-citaro': { cat: 'bus', by: 'len', m: 12, f: 'assets/heavy/cars/bus-citaro.glb' },
  'trk-scania': { cat: 'tractor-unit', by: 'len', m: 6, f: 'assets/heavy/trucks/scania.glb', note: 'влекач 6 м + ремарке 13,6 м − 3,1 м застъпване = 16,5 м' },
  // сгради: eave — етажи × 3 м (+ цокъл 0,3 м)
  'h2-lodge': { cat: 'house', by: 'eave', m: 1 * STOREY + 0.3, floors: 1, f: 'assets/heavy/houses2/h2-lodge.glb' },
  'h2-townhouse': { cat: 'house', by: 'eave', m: 3 * STOREY + 0.3, floors: 3, f: 'assets/heavy/houses2/h2-townhouse.glb' },
};
export const TRAILER = 13.6, SEMI = 16.5;

// размери в собствените единици на модела (след матриците на възлите); eave — най-високият „пълен“ хоризонтален срез:
// срезовете по височина; стената покрива ≥ 85 % от основата по двете оси, покривът се стеснява (комините и антените са тесни — не се броят)
export function measure(obj) {
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj), s = b.getSize(new THREE.Vector3()), N = 40, sx = new Float32Array(N * 2).fill(Infinity), sz = new Float32Array(N * 2).fill(Infinity);
  for (let i = 0; i < N; i++) { sx[i * 2 + 1] = sz[i * 2 + 1] = -Infinity; }
  const v = new THREE.Vector3();
  obj.traverse(o => { if (!o.isMesh || !o.geometry.attributes.position) return; const p = o.geometry.attributes.position, step = Math.max(1, Math.floor(p.count / 20000));
    for (let i = 0; i < p.count; i += step) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); const k = Math.min(N - 1, Math.max(0, Math.floor((v.y - b.min.y) / (s.y || 1) * N)));
      if (v.x < sx[k * 2]) sx[k * 2] = v.x; if (v.x > sx[k * 2 + 1]) sx[k * 2 + 1] = v.x; if (v.z < sz[k * 2]) sz[k * 2] = v.z; if (v.z > sz[k * 2 + 1]) sz[k * 2 + 1] = v.z; } });
  let eave = s.y;
  for (let k = N - 1; k >= 0; k--) { const wx = sx[k * 2 + 1] - sx[k * 2], wz = sz[k * 2 + 1] - sz[k * 2]; if (wx >= s.x * 0.85 && wz >= s.z * 0.85) { eave = (k + 1) / N * s.y; break; } }
  return { w: s.x, d: s.z, h: s.y, len: Math.max(s.x, s.z), eave, box: b };
}
// еднаквият мащаб (по трите оси) за модела key от каталога
export function scaleFor(key, obj, m = null) {
  const c = SCALE[key]; if (!c) return 1; const q = measure(obj), val = c.by === 'len' ? q.len : c.by === 'eave' ? q.eave : q.h;
  return (m ?? c.m) / (val || 1);
}
