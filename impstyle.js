// impstyle.js — обликът на Империал Сити според държавата (imperial.js избира 'US' или 'RU' при основаването; game.js го връзва).
// 🇺🇸 САЩ: делови център с небостъргачи, предградия с къщи, широки булеварди. 🇷🇺 Русия: монументален център (сталински високи сгради),
// панелни жилищни блокове, модерни бизнес кули. pickModel връща име на модел от A (каквото game.js вече зарежда) + 'imp-stalin' (IMP_MODELS).
// decor(group, cc, city, opt) — земята и растителността около града вместо пустинята; в Русия през зимата — сняг.
import * as THREE from 'three';
import { feature } from './lab/feature.js';

// новите модели, които game.js трябва да зареди в A (ключ → файл) и истинската им височина в метри (за realH)
export const IMP_MODELS = { 'imp-stalin': 'assets/heavy/blocks/stalin.glb' };
export const IMP_H = { 'imp-stalin': 95 };

// кандидатите по държава и вид; '@N' — етажите на небостъргачите (както в game.js)
const POOL = {
  US: {
    house: ['h2-greyporch', 'h2-porch', 'h2-blue', 'h2-pink', 'h2-townhouse', 'building-type-a', 'building-type-b'],   // предградия
    shop: ['building-a', 'building-b', 'building-c', 'building-d', 'building-e', 'sf-blk-brick', 'sf-blk-dbrick', 'sf-blk-richmond', 'sf-blk-modoffice'],
    sky: ['sf-sky-usb', 'sf-sky-night', 'sf-sky-blue', 'building-skyscraper-d@30', 'building-skyscraper-e@40', 'building-skyscraper-d@25', 'building-skyscraper-e@30'],
  },
  RU: {
    house: ['sf-blk-soviet', 'sf-blk-panel12', 'sf-blk-soviet', 'sf-blk-panel12', 'h2-lodge', 'h2-swedish'],   // панелни блокове (+ няколко къщи — вили)
    shop: ['sf-blk-oldbld', 'sf-blk-dbrick', 'sf-blk-soviet', 'b2-pp-townhouse', 'b2-office2', 'b2-hirise'],
    sky: ['imp-stalin', 'sf-sky-rand', 'sf-sky-sing', 'building-skyscraper-d@30', 'imp-stalin', 'building-skyscraper-e@40'],   // сталински + модерни кули
  },
};
const FALLBACK = { house: ['building-type-a'], shop: ['building-a'], sky: ['building-skyscraper-a@20'] };

// cc: 'US' | 'RU'; kind: 'house' | 'shop' | 'sky' | 'mix'; rnd() → [0, 1); has(name) → дали моделът е зареден (по желание)
export function pickModel(cc, kind, rnd = Math.random, has = () => true) {
  if (kind === 'mix') kind = rnd() < 0.5 ? 'sky' : 'shop';
  const L = ((POOL[cc] || POOL.US)[kind] || FALLBACK[kind] || FALLBACK.shop).filter(has);
  return L.length ? L[Math.floor(rnd() * L.length)] : (FALLBACK[kind] || FALLBACK.shop)[0];
}

// 🌳 декорът: трева (или сняг) около града и дървета в пръстен извън парцелите. city.lots = [{ x, z }]; opt = { winter }
const MONTH_WINTER = m => m === 11 || m === 0 || m === 1;   // декември–февруари (opt.month)
export function decor(group, cc, city, opt = {}) {
  if (!group || !city || !city.lots || !city.lots.length) return null;
  const old = group.getObjectByName('impDecor'); if (old) { disposeTree(old); group.remove(old); }
  const g = new THREE.Group(); g.name = 'impDecor';
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const l of city.lots) { x0 = Math.min(x0, l.x); x1 = Math.max(x1, l.x); z0 = Math.min(z0, l.z); z1 = Math.max(z1, l.z); }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, R = Math.max(x1 - x0, z1 - z0) / 2 + 40;
  const snow = cc === 'RU' && (opt.winter ?? (opt.month != null && MONTH_WINTER(opt.month)));
  // земята: широк кръг трева / сняг под града (под пътищата, за да не ги закрива)
  const ground = new THREE.Mesh(new THREE.CircleGeometry(R + 420, 64), new THREE.MeshStandardMaterial({ color: snow ? 0xeef3f7 : cc === 'RU' ? 0x6f8f4e : 0x8aa356, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(cx, -0.05, cz); ground.receiveShadow = true; g.add(ground);
  // дърветата: инстанции в пръстен R…R+380 (САЩ — широколистни + палми край Тексаския бряг; Русия — брези и ели)
  let seed = 1234 + (cc === 'RU' ? 77 : 0); const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const RT = feature('trees-more') && opt.trees ? (cc === 'RU' ? [opt.trees.leaf, snow && opt.trees.pinesnow && opt.trees.pinesnow.length ? opt.trees.pinesnow : opt.trees.pine] : [opt.trees.leaf, opt.trees.palm]) : null;   // trees-more: истинските модели (по 1 прото на вид — малко draw calls)
  const kinds = RT && RT.every(P => P && P.length) ? RT.map(P => realParts(P[0], 10)) : cc === 'RU' ? [birch(snow), fir(snow)] : [oak(), palm()];
  const N = 420, per = kinds.map(() => []);
  for (let i = 0; i < N; i++) {
    const a = rnd() * Math.PI * 2, r = R + Math.sqrt(rnd()) * 380, k = cc === 'RU' ? (rnd() < 0.55 ? 0 : 1) : (rnd() < 0.8 ? 0 : 1);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28), new THREE.Vector3().setScalar(0.8 + rnd() * 0.6));
    per[k].push(m);
  }
  kinds.forEach((parts, k) => { for (const [geo, mat] of parts) { const im = new THREE.InstancedMesh(geo, mat, per[k].length); per[k].forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.receiveShadow = true; g.add(im); } });
  group.add(g);
  return g;
}
// дърветата (метри): ствол + корона; споделени геометрии
const std = (c, r = 0.9) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
const tr = (geo, y) => { geo.translate(0, y, 0); return geo; };
// истинско дърво → [геометрия, материал] на части, основата на y = 0, височина H м (за InstancedMesh); кеш по модел
const RP = new Map();
function realParts(src, H) {
  const key = src.uuid + ':' + H; if (RP.has(key)) return RP.get(key);
  src.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(src), k = H / ((b.max.y - b.min.y) || 1), parts = [];
  src.traverse(o => { if (!o.isMesh || !o.visible) return; const g = o.geometry.clone();
    for (const [nm, at] of Object.entries(g.attributes)) if (at.normalized || at.isInterleavedBufferAttribute || !(at.array instanceof Float32Array)) { const f = new Float32Array(at.count * at.itemSize), get = [at.getX, at.getY, at.getZ, at.getW]; for (let i = 0; i < at.count; i++) for (let c = 0; c < at.itemSize; c++) f[i * at.itemSize + c] = get[c].call(at, i); g.setAttribute(nm, new THREE.BufferAttribute(f, at.itemSize)); }   // квантизираните (Int16 normalized) — към Float32, иначе applyMatrix4 ги реже до ±1
    g.applyMatrix4(o.matrixWorld); g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); g.scale(k, k, k); parts.push([g, o.material]); });
  RP.set(key, parts); return parts;
}
function oak() { return [[tr(new THREE.CylinderGeometry(0.35, 0.5, 4, 6), 2), std(0x5b4330)], [tr(new THREE.IcosahedronGeometry(3.4, 0), 6.2), std(0x4f7a32)]]; }
function palm() {
  const leaves = new THREE.ConeGeometry(3.2, 1.6, 7); leaves.translate(0, 9.2, 0);
  return [[tr(new THREE.CylinderGeometry(0.25, 0.4, 9, 6), 4.5), std(0x8a6a45)], [leaves, std(0x3f7d3a)]];
}
function birch(snow) { return [[tr(new THREE.CylinderGeometry(0.22, 0.3, 7, 6), 3.5), std(0xe9e6dc)], [tr(new THREE.IcosahedronGeometry(2.4, 0), 7.2), std(snow ? 0xc9d2c4 : 0x7a9a3c)]]; }
function fir(snow) {
  const a = new THREE.ConeGeometry(2.6, 5, 8); a.translate(0, 4.5, 0); const b = new THREE.ConeGeometry(1.9, 4, 8); b.translate(0, 7.5, 0);
  const m = std(snow ? 0x9fb3a8 : 0x2e5a36);
  return [[tr(new THREE.CylinderGeometry(0.25, 0.35, 3, 6), 1.5), std(0x5b4330)], [a, m], [b, m]];
}
function disposeTree(o) { o.traverse(c => { c.geometry && c.geometry.dispose(); if (c.material) [].concat(c.material).forEach(m => m.dispose()); }); }
