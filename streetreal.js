// streetreal.js — истински улични лампи и светофари (Лабораторията → street-real; #42.4, #42.5, #42.6).
// Моделите (CC-BY, assets/heavy/CREDITS.txt), смалени в assets/heavy/street/:
//   lamps-pack.glb — 8 лампи една до друга по x (~5 единици високи): класическа с рамо и фенер, фенер на стълб, двоен фенер, двоен диск,
//                    тройна, глобус, модерна LED „кобра“ с едно рамо, модерна с две рамена (за разделителната ивица); абажурът — материал „light“
//   lamp-classic.glb — висока орнаментирана класическа (за старите центрове и кейовете), ~48,8 единици → 6 м
//   tlight.glb — светофар на конзола (глава с 3 секции над платното) + отделен пешеходен сигнал (~3,5 м → ×1,4 ≈ 4,9 м, главата ~4,5 м)
// Всичко е инстанцирано (2 draw call-а на вид лампа) — в града има стотици лампи.
// Посоки (след подготовката): лампата стои в (0, 0, 0), рамото/главата сочи към +z (към платното); yaw завърта +z към (sin yaw, cos yaw).
// Светофарът: стълбът в (0, 0, 0) на бордюра, конзолата — към +z над платното, лещите гледат към +x (към идващите коли).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { pickPart } from './blkcut.js';

// видовете от пакета: [x0, x1] в координатите на модела, височина в метри, модерна ли е (студена LED светлина, сив стълб)
const PACK = { arm: [1.99, 4.03, 5, 0], post: [5.61, 6.32, 4.5, 0], double: [7.97, 9.78, 4.8, 0], disc2: [10.69, 13.03, 5, 0], triple: [13.55, 15.33, 5, 0], globe: [16.61, 17.08, 4.5, 0], cobra: [18.56, 18.9, 9, 1], cobra2: [20.62, 20.96, 9, 1] };
export const CLASSIC = ['arm', 'post', 'double', 'globe'];   // старите центрове, парковете, кейовете
const TL_K = 1.4, PED_K = 1;   // светофарът: 3,5 → 4,9 м; пешеходният сигнал — както е (2,8 м)
const TL_LENS = [[0.29, 3.225, 3.2], [0.29, 3.225, 2.5], [0.29, 3.225, 1.8]], TL_R = 0.19;   // червена (в края на конзолата), жълта, зелена — в модела; лицата към +x
const PED_AT = [-1.5, -0.5], PED_LENS = [[0.27, 2.57], [0.27, 2.15]], PED_W = [0.3, 0.34];   // пешеходният сигнал: на тротоара към пешеходната пътека (−x), лице през платното (+z); „върви“ (горе) и „чакай“

let P = null, SR = null;
const mats = {
  modern: new THREE.MeshStandardMaterial({ color: 0x7c8187, roughness: 0.45, metalness: 0.3 }),
  classic: new THREE.MeshStandardMaterial({ color: 0x2c302d, roughness: 0.5, metalness: 0.2 }),
  led: new THREE.MeshStandardMaterial({ color: 0xe9ecef, emissive: 0xf4f6ff, emissiveIntensity: 0, roughness: 0.25 }),   // LED — студено бяло
  warm: new THREE.MeshStandardMaterial({ color: 0xf1e6cc, emissive: 0xffc878, emissiveIntensity: 0, roughness: 0.3 }),   // класическите — топло жълто
};
mats.led.userData.winK = 2.4; mats.warm.userData.winK = 2.2;   // daynight.js: emissiveIntensity = нощ × winK
// квантованите атрибути (Int16/Uint16 с normalized) → Float32, за да може геометрията да се трансформира
const toF = g0 => { const g = new THREE.BufferGeometry(), get = ['getX', 'getY', 'getZ', 'getW']; if (g0.index) g.setIndex(g0.index.clone()); for (const [n, A] of Object.entries(g0.attributes)) { const a = new Float32Array(A.count * A.itemSize); for (let i = 0; i < A.count; i++) for (let j = 0; j < A.itemSize; j++) a[i * A.itemSize + j] = A[get[j]](i); g.setAttribute(n, new THREE.BufferAttribute(a, A.itemSize)); } return g; };
const load = u => new Promise(res => new GLTFLoader().load(u, g => res(g.scene), undefined, () => res(null)));

// една част → { geos: [[geometry, 'metal' | 'light']], head: [x, y, z] (центърът на абажура), h }
function prepPart(obj, H, rotFix = true) {
  obj.updateMatrixWorld(true);
  const parts = []; obj.traverse(m => { if (!m.isMesh) return; const g = toF(m.geometry).applyMatrix4(m.matrixWorld); parts.push([g, /light/i.test(m.material.name || m.name) ? 'light' : 'metal']); });
  // основата на стълба (триъгълниците под 0,3 м) → в (0, 0); височината → H
  const all = new THREE.Box3(); for (const [g] of parts) { g.computeBoundingBox(); all.union(g.boundingBox); }
  const k = H / (all.max.y - all.min.y), base = new THREE.Box3(), v = new THREE.Vector3();
  for (const [g] of parts) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (v.y < all.min.y + 0.3 / k) base.expandByPoint(v); } }
  const bc = base.isEmpty() ? all.getCenter(new THREE.Vector3()) : base.getCenter(new THREE.Vector3());
  for (const [g] of parts) g.translate(-bc.x, -all.min.y, -bc.z).scale(k, k, k);
  // абажурът встрани от стълба → завърта се към +z
  const lb = new THREE.Box3(); for (const [g, t] of parts) if (t === 'light') { g.computeBoundingBox(); lb.union(g.boundingBox); }
  const lc = lb.isEmpty() ? new THREE.Vector3(0, H, 0) : lb.getCenter(new THREE.Vector3());
  if (rotFix && Math.hypot(lc.x, lc.z) > 0.3) { const a = Math.atan2(-lc.x, lc.z); for (const [g] of parts) g.rotateY(a); lc.applyAxisAngle(new THREE.Vector3(0, 1, 0), a); }
  for (const [g] of parts) g.computeBoundingSphere();
  return { geos: parts, head: [lc.x, lc.y, lc.z], h: H };
}

export const loadStreetReal = () => P || (P = Promise.all(['lamps-pack', 'lamp-classic', 'tlight'].map(f => load(new URL('assets/heavy/street/' + f + '.glb', import.meta.url).href))).then(([pack, orn, tl]) => {
  if (!pack || !tl) return null;
  const L = {};
  for (const [k, [x0, x1, H]] of Object.entries(PACK)) L[k] = prepPart(pickPart(pack, x0 - 0.05, x1 + 0.05, -3, 3), H);
  if (orn) { orn.traverse(m => { if (m.isMesh && m.material.map) { m.material = m.material.clone(); m.material.metalness = 0; m.material.roughness = 0.6; } }); L.ornate = prepPart(orn, 6); L.ornate.tex = []; orn.traverse(m => { if (m.isMesh && !/light/i.test(m.material.name)) L.ornate.tex.push(m.material); }); }
  // светофарът: металът и текстурата (без вградената светлина — иначе свети целият денем и нощем); конзолата и пешеходният сигнал поотделно
  tl.updateMatrixWorld(true); const T = { veh: [], ped: [] };
  tl.traverse(m => { if (!m.isMesh) return; const mt = m.material.clone(); mt.metalness = 0; mt.roughness = 0.65; mt.emissiveMap = null; mt.emissive.setHex(0); const g = toF(m.geometry).applyMatrix4(m.matrixWorld);
    if (/Pedestrian/.test(m.name)) { g.computeBoundingBox(); const b = g.boundingBox; g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2).scale(PED_K, PED_K, PED_K).rotateY(-Math.PI / 2).translate(PED_AT[0], 0, PED_AT[1]); T.ped.push([g, mt]); }   // лицето: +x → +z (през платното)
    else { g.scale(TL_K, TL_K, TL_K); T.veh.push([g, mt]); } });
  SR = { L, T }; return SR;
}));
export const streetReal = () => SR;

const Y = new THREE.Vector3(0, 1, 0), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
// лампите: list — [[x, z, yaw, kind]] → { group, heads: [{ x, y, z }] (абажурите — за светлите петна и ореолите), mats: [материалите на абажурите] }
export function lampField(list, o = {}) {
  const G = new THREE.Group(); G.name = 'streetLamps'; G.userData.extShared = true;   // общите геометрии и материали — не се освобождават с изгледа на града
  const heads = [], by = {};
  if (!SR) return { group: G, heads, mats: [] };
  for (const it of list) { const k = SR.L[it[3]] ? it[3] : 'cobra'; (by[k] || (by[k] = [])).push(it); }
  for (const [k, L] of Object.entries(by)) { const D = SR.L[k], modern = PACK[k] && PACK[k][3];
    for (const [g, t] of D.geos) { const mat = t === 'light' ? (modern ? mats.led : mats.warm) : k === 'ornate' ? (D.tex[0] || mats.classic) : modern ? mats.modern : mats.classic;
      const im = new THREE.InstancedMesh(g, mat, L.length); L.forEach(([x, z, yaw], i) => im.setMatrixAt(i, _m.compose(_v.set(x, 0, z), _q.setFromAxisAngle(Y, yaw || 0), _s)));
      im.castShadow = t !== 'light' && o.shadow !== false; im.frustumCulled = false; im.userData.lampKind = k; if (t === 'light') im.userData.lamp = 1; G.add(im); }
    for (const [x, z, yaw] of L) { const c = Math.cos(yaw || 0), s = Math.sin(yaw || 0), [hx, hy, hz] = D.head; heads.push({ x: x + hx * c + hz * s, y: hy, z: z - hx * s + hz * c }); } }
  return { group: G, heads, mats: [mats.led, mats.warm] };
}
export const lampMats = () => [mats.led, mats.warm];
export const lampHeight = k => SR && SR.L[k] ? SR.L[k].h : 0;

// светофарите: list — [[x, z, yaw]] (стълбът на бордюра; yaw завърта +x на модела към идващите коли: yaw = atan2(−uz, ux), u — посоката, откъдето идват)
// → { group, lens: [[[x, y, z] × 3] (червена, жълта, зелена)], ped: [[[x, y, z] × 2] („върви“, „чакай“)], yaw: [..] }
export function tlightField(list, o = {}) {
  const G = new THREE.Group(); G.name = 'streetTlights'; G.userData.extShared = true;
  if (!SR || !list.length) return { group: G, lens: [], ped: [] };
  for (const [g, mt] of [...SR.T.veh, ...(o.ped === false ? [] : SR.T.ped)]) { const im = new THREE.InstancedMesh(g, mt, list.length); list.forEach(([x, z, yaw], i) => im.setMatrixAt(i, _m.compose(_v.set(x, 0, z), _q.setFromAxisAngle(Y, yaw), _s))); im.castShadow = true; im.frustumCulled = false; G.add(im); }
  return { group: G, ...tlightLens(list) };
}
// само позициите на лещите (без мешовете): { lens: [[червена, жълта, зелена]], ped: [[„върви“, „чакай“]] } — [x, y, z] в света
export function tlightLens(list) {
  const lens = [], ped = [], rot = (x, z, yaw, lx, ly, lz) => { const c = Math.cos(yaw), s = Math.sin(yaw); return [x + lx * c + lz * s, ly, z - lx * s + lz * c]; };
  for (const [x, z, yaw] of list) { lens.push(TL_LENS.map(([lx, ly, lz]) => rot(x, z, yaw, lx * TL_K, ly * TL_K, lz * TL_K))); ped.push(PED_LENS.map(([f, ly]) => rot(x, z, yaw, PED_AT[0], ly * PED_K, PED_AT[1] + f * PED_K))); }
  return { lens, ped };
}
// кръгла леща (лице към +x на светофара) и правоъгълно поле на пешеходния сигнал (лице към +z) — за светлините на фазите
export const lensGeo = () => new THREE.CircleGeometry(TL_R * TL_K, 14).rotateY(Math.PI / 2);
export const pedGeo = () => new THREE.PlaneGeometry(PED_W[0] * PED_K, PED_W[1] * PED_K * 0.55);
// матрица за леща/поле: на позицията p, завъртяна като светофара
export const lensMatrix = (p, yaw, m = new THREE.Matrix4()) => m.compose(_v.set(p[0], p[1], p[2]), _q.setFromAxisAngle(Y, yaw), _s);
