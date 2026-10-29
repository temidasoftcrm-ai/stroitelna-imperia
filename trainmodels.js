// trainmodels.js — истински 3D модели на влакове от Sketchfab (CC-BY, авторите са в CREDITS.txt и „📜 Автори“):
//   • „Low Poly EMD GP38“ от TheOminousDuck — дизелов локомотив + вагон-бункер + платформа с контейнер (в един файл;
//     тук се разделят на три отделни вагона по дължината);
//   • „AVEENG“ от dannzjs — скоростен влак (челен вагон) за „Стрела“; опашката е същият вагон, обърнат назад.
// Зареждат се асинхронно; докато не са готови (или ако не се заредят), играта ползва старите модели на Kenney.
// Всеки вагон е THREE.Group с предница към +z, център в началото, колела на y = 0 и userData.len — дължината му.
import * as THREE from 'three';
import { canvasTex } from './texdata.js';   // fac-data (T1): статичните платна → собствени данни (не се губят)
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { feature } from './lab/feature.js';
import { NF_MATS } from './nightfloors.js';   // нощем daynight.js вдига emissiveIntensity на тези материали

const W = 2.8;
const OE_BLUE = 0x27407a, OE_YAW = { loco: Math.PI, car: 0 };   // цветът на вагоните на Ориент Експрес; завъртане на моделите (предницата към +z)   // ширина на вагона в света на играта (колкото коловоза на Kenney)
const P = {};    // прототипи: loco, hopper, flat, ave
let ready = false, loading = null;
const CONT_COLS = [0xd62828, 0x1f5fbf, 0x2d8f4e, 0xffb300, 0x0a9396, 0xe8e2d4, 0x7b2cbf];

// нормализира обект: върти го (yaw), мащабира така, че ширината (по x след въртенето) да е W, сваля колелата на y = 0
function normalize(obj, yaw) {
  const g = new THREE.Group(), inner = new THREE.Group(); inner.add(obj); inner.rotation.y = yaw; g.add(inner);
  g.updateMatrixWorld(true);
  let bb = new THREE.Box3().setFromObject(g), s = bb.getSize(new THREE.Vector3());
  if (s.x > s.z) { inner.rotation.y += Math.PI / 2; g.updateMatrixWorld(true); bb = new THREE.Box3().setFromObject(g); s = bb.getSize(new THREE.Vector3()); }   // дългата ос — по z
  const k = W / s.x; inner.scale.setScalar(k); g.updateMatrixWorld(true);
  bb = new THREE.Box3().setFromObject(g); const c = bb.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -bb.min.y, -c.z); g.updateMatrixWorld(true);
  bb = new THREE.Box3().setFromObject(g);
  g.userData.len = bb.max.z - bb.min.z;
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}
// разделя всички мешове на сцена (в собствените им координати след matrixWorld) по x на части: cuts — граници (нарастващи)
function splitByX(scene, cuts) {
  scene.updateMatrixWorld(true);
  const parts = cuts.map(() => new THREE.Group()).concat([new THREE.Group()]);
  scene.traverse(m => {
    if (!m.isMesh) return;
    // квантизирани модели (KHR_mesh_quantization: Int16/Int8 с normalized) — първо в Float32, иначе applyMatrix4 и копирането ги развалят
    const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const [name, at] of Object.entries(src.attributes)) {
      if (at.array instanceof Float32Array && !at.isInterleavedBufferAttribute) continue;
      const f = new Float32Array(at.count * at.itemSize);
      for (let i = 0; i < at.count; i++) for (let c = 0; c < at.itemSize; c++) f[i * at.itemSize + c] = at.getComponent ? at.getComponent(i, c) : [at.getX(i), at.getY(i), at.getZ(i), at.getW(i)][c];
      src.setAttribute(name, new THREE.BufferAttribute(f, at.itemSize));
    }
    const geo = src.applyMatrix4(m.matrixWorld);
    const pos = geo.attributes.position, n = pos.count / 3, bins = parts.map(() => []);
    for (let t = 0; t < n; t++) {
      const cx = (pos.getX(t * 3) + pos.getX(t * 3 + 1) + pos.getX(t * 3 + 2)) / 3;
      let b = 0; while (b < cuts.length && cx > cuts[b]) b++;
      bins[b].push(t);
    }
    bins.forEach((tris, b) => {
      if (!tris.length) return;
      const out = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(geo.attributes)) {
        const sz = attr.itemSize, arr = new attr.array.constructor(tris.length * 3 * sz);
        tris.forEach((t, i) => { for (let v = 0; v < 3; v++) for (let c = 0; c < sz; c++) arr[(i * 3 + v) * sz + c] = attr.array[(t * 3 + v) * sz + c]; });
        out.setAttribute(name, new THREE.BufferAttribute(arr, sz));
      }
      if (!out.attributes.normal) out.computeVertexNormals();
      parts[b].add(new THREE.Mesh(out, m.material));
    });
  });
  return parts;
}
// по-малко метал (без карта на околната среда металът изглежда черен)
function tame(obj) { obj.traverse(m => { if (m.isMesh && m.material) for (const mt of [].concat(m.material)) { if (mt.metalness > 0.4) mt.metalness = 0.35; if (mt.roughness < 0.3) mt.roughness = 0.35; } }); }

export function loadTrainModels(base = 'assets/heavy/trains/') {
  if (loading) return loading;
  const L = new GLTFLoader(), get = f => new Promise((res, rej) => L.load(base + f, g => { locoLights(g.scene); res(g.scene); }, undefined, rej));
  loading = Promise.all([
    get('gp38.glb').then(sc => {
      // по x: платформа (< −0.885), бункер (−0.885…−0.33), локомотив (> −0.33); предницата на локомотива е към +x
      const [flat, hopper, loco] = splitByX(sc, [-0.885, -0.33]);
      P.loco = normalize(loco, -Math.PI / 2); P.hopper = normalize(hopper, -Math.PI / 2); P.flat = normalize(flat, -Math.PI / 2);
    }),
    get('ave.glb').then(sc => { tame(sc); P.ave = normalize(sc, 0); }),
    get('hsw.glb').then(sc => { tame(sc); P.hsw = normalize(sc, 0); }).catch(() => {}),   // среден вагон на скоростния влак
    // „Ориент Експрес“: парен локомотив BR 01 (без релсите и земята от модела) и тъмносини луксозни вагони
    get('oe-loco.glb').then(sc => { const drop = []; sc.traverse(m => { if (m.isMesh && /holzschiene|eisen|boden/.test(m.material?.name || '')) drop.push(m); }); drop.forEach(m => m.parent.remove(m)); tame(sc); P.oeLoco = normalize(sc, OE_YAW.loco); }).catch(() => {}),
    get('oe-car.glb').then(sc => { sc.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.setHex(OE_BLUE); m.material.roughness = 0.45; } }); P.oeCar = normalize(sc, OE_YAW.car); }).catch(() => {}),
    // истинските влакове (Лабораторията → trains-real): ЧС200 + сини пътнически вагони, ВЛ82 + покрити и въглищни вагони
    ...(feature('trains-real') ? [
      get('chs200.glb').then(sc => { P.paxLoco = normalize(sc, 0); }),
      get('paxcar.glb').then(sc => { tame(sc); sc.traverse(m => { if (m.isMesh && /glass/i.test(m.material?.name || '')) { m.material = m.material.clone(); m.material.emissive = new THREE.Color(0xffd890); m.material.emissiveIntensity = 0; NF_MATS.add(m.material); } }); P.paxCar = normalize(sc, 0); }),
      get('vl82.glb').then(sc => { sc.traverse(m => { if (m.isMesh && !m.material.isMeshStandardMaterial) m.material = new THREE.MeshStandardMaterial({ map: m.material.map, color: m.material.color, roughness: 0.6, metalness: 0.2 }); }); tame(sc); P.vl82 = normalize(sc, 0); }),   // моделът е „unlit“ — нощем светеше бял
      get('boxcar.glb').then(sc => { P.boxcar = normalize(sc, 0); }),
      get('hopper2.glb').then(sc => { P.hopper2 = normalize(sc, 0); }),
    ].map(p => p.catch(e => console.warn('trains-real', e))) : []),
    // 🛤️ rail-depot: старите в депото — парен локомотив 0-4-0 (steve_Emfore, CC BY) и съветска цистерна (KojfDiscord, CC BY)
    ...(TV ? Object.entries(MV).map(([k, [f, L]]) => get(f + '.glb').then(sc => { tame(sc); if (k === 'silverCar' || k === 'nightCar' || k === 'elLoco') winNight(sc);   /* само пътническите */ P[k] = stretchTo(normalize(sc, 0), L); }).catch(e => console.warn('trains-variety', k, e))) : []),
    ...(TV ? [Promise.resolve().then(() => Object.assign(P, procWagons()))] : []),
    ...(feature('rail-depot') ? [
      get('loco040.glb').then(sc => { tame(sc); P.loco040 = normalize(sc, 0); }),
      get('tank-ussr.glb').then(sc => { tame(sc); P.tankUssr = normalize(sc, 0); }),
    ].map(p => p.catch(e => console.warn('rail-depot', e))) : []),
  ]).then(() => { ready = true; }).catch(e => { console.warn('trainmodels', e); ready = false; });
  return loading;
}
// 🚆 trains-variety (T1): влаковете на потребителя (Meshy AI, Темидасофт — заварени, основата на 0, олекотени): пътнически — сребрист вагон,
// мотрисен вагон „нощен влак“, електрически локомотив с пантограф, парен локомотив с тендер; товарни — дизелов локомотив Union Pacific, покрит
// вагон SRR, въглищен (Western Maryland; „NY Central“ е без текстура — не се ползва), изоставен бункер. Ширина W, дължина — истинска (разтягане по z). Процедурни: цистерна,
// платформа с трупи, автовоз, отворен вагон. Нощем прозорците на пътническите светят (тъмното по страните, средната височина).
const TV = feature('trains-variety');
const MV = { silverCar: ['m-silver', 22], nightCar: ['m-night', 22], elLoco: ['m-elloco', 18], steamLoco: ['m-steam', 22], upLoco: ['m-up', 20], gpLoco: ['m-gp', 16], steam2Loco: ['m-steam2', 19],   /* +2 (28.10): дизел-електрически (GP) и парен с тендер */ srrCar: ['m-srr', 15], wmCoal: ['m-wm', 13], hopX: ['m-hopx', 12] };
function stretchTo(g, L) { const k = L / (g.userData.len || L); g.children[0].scale.z *= k; g.children[0].position.z *= k; g.userData.len = L; return g; }
function winNight(obj) {   // прозорците — по тъмните пиксели на текстурата по страните, в средната лента по височина
  obj.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(obj);
  obj.traverse(m => { if (!m.isMesh || !m.material || !m.material.map) return; const mt = m.material = m.material.clone(); mt.emissive = new THREE.Color(0xffd890); mt.emissiveMap = mt.map; mt.emissiveIntensity = 0; mt.userData.nfK = 1.2;
    const inv = new THREE.Matrix4().copy(m.matrixWorld).invert(), y0 = bb.min.clone().applyMatrix4(inv).y, y1 = bb.max.clone().applyMatrix4(inv).y;
    mt.onBeforeCompile = sh => { sh.uniforms.uTvY = { value: new THREE.Vector2(Math.min(y0, y1), Math.abs(y1 - y0) || 1) };
      sh.vertexShader = 'varying vec3 vTvP; varying vec3 vTvN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vTvP = position; vTvN = normal;');
      sh.fragmentShader = 'varying vec3 vTvP; varying vec3 vTvN; uniform vec2 uTvY;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float ek = max(0.0001, dot(emissive, vec3(0.333))), hy = (vTvP.y - uTvY.x) / uTvY.y, lum = dot(totalEmissiveRadiance, vec3(0.333)) / ek;
          vec3 nn = normalize(vTvN); float m = step(0.75, abs(nn.x)) * step(0.45, hy) * step(hy, 0.75) * (1.0 - smoothstep(0.08, 0.16, lum));   /* само страните (не челото и покрива) */
          totalEmissiveRadiance = vec3(1.0, 0.78, 0.45) * m * ek * 0.35; }`); };
    mt.customProgramCacheKey = () => 'tv-win'; NF_MATS.add(mt); });
}
function procWagons() {   // процедурни товарни вагони (основата на y = 0, предницата към +z, ширина W)
  const M = (c, r = 0.7, m = 0.2) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }), dark = M(0x1d1f22, 0.8, 0.3), box = (g, w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  const base = L => { const g = new THREE.Group(), i = new THREE.Group(); g.add(i); box(i, W * 0.92, 0.25, L - 0.4, dark, 0, 1.1, 0); for (const z of [-L / 2 + 2.2, L / 2 - 2.2]) { box(i, W * 0.8, 0.7, 2.6, dark, 0, 0.55, z); for (const x of [-0.75, 0.75]) for (const dz of [-0.8, 0.8]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 12).rotateZ(Math.PI / 2), dark); w.position.set(x, 0.45, z + dz); i.add(w); } } g.userData.len = L; return { g, i }; };
  const cis = (() => { const { g, i } = base(16); const t = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 14.6, 20).rotateX(Math.PI / 2), M(0xffffff, 0.45, 0.4)); t.position.y = 2.55; t.castShadow = true; t.userData.tint = 1; i.add(t);
    for (const z of [-7.3, 7.3]) { const c = new THREE.Mesh(new THREE.SphereGeometry(1.35, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(z > 0 ? Math.PI / 2 : -Math.PI / 2), t.material); c.scale.z = 0.35; c.position.set(0, 2.55, z); i.add(c); }
    box(i, 0.9, 0.35, 0.9, dark, 0, 4, 0); return g; })();
  const timber = (() => { const { g, i } = base(16); const log = M(0x7a5434, 0.95, 0), lg = new THREE.CylinderGeometry(0.28, 0.3, 14.8, 8).rotateX(Math.PI / 2);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4 - (r % 2); k++) { const o = new THREE.Mesh(lg, log); o.position.set(-0.9 + k * 0.6 + (r % 2) * 0.3, 1.55 + r * 0.52, 0); o.castShadow = true; i.add(o); }
    for (const z of [-7.6, -2.6, 2.6, 7.6]) for (const x of [-1.3, 1.3]) box(i, 0.12, 1.8, 0.12, dark, x, 2.1, z); return g; })();
  const autorack = (() => { const { g, i } = base(18); box(i, W * 0.95, 0.15, 17.6, dark, 0, 2.7, 0); for (const z of [-8, -4, 0, 4, 8]) for (const x of [-1.35, 1.35]) box(i, 0.1, 2.6, 0.1, dark, x, 2.1, z);
    const cols = [0xd62828, 0x1f5fbf, 0xeeeeee, 0x222222, 0xffb300, 0x7d8a96]; let k = 0;
    for (const y of [1.25, 2.78]) for (const z of [-6, -1.3, 3.4]) { const c = new THREE.Group(), m = M(cols[k++ % cols.length], 0.4, 0.5); box(c, 1.7, 0.6, 4.2, m, 0, 0.45, 0); box(c, 1.5, 0.5, 2.2, m, 0, 0.95, -0.2); c.position.set(0, y, z); c.userData.rackCar = 1; i.add(c); } return g; })();   // rackCar — rackLoad() ги сменя с истински коли
  const gondola = (() => { const { g, i } = base(15); const w = M(0x6b3e2e, 0.9, 0.2); box(i, W * 0.95, 1.4, 14.6, w, 0, 1.95, 0); const fill = M(0x3a3a3a, 1, 0); box(i, W * 0.85, 0.2, 14.2, fill, 0, 2.55, 0); return g; })();
  return { cistern: cis, timber, autorack, gondola };
}
const TINTS = [0x2b2d31, 0xd9d4c7, 0x1f5fbf, 0xc62828, 0x2d8f4e, 0xe0a020];
// 🚗 автовозът (29.10): вместо кутии — истинските коли от трафика (sf-car-*; game.js ги дава през setRackCars), InstancedMesh по част на модел
// (споделени геометрии и материали), по 2 етажа × 3 коли; отдалеч (> 150 м) — пак кутиите (THREE.LOD). Суровите модели не са в метри — всяка кола ~4,3 м, ≤ 1,35 м висока (под горния етаж)
let rackSrc = () => [], RACK = null;
export const setRackCars = fn => { rackSrc = fn; };
function rackModels() {
  if (RACK) return RACK; const L = rackSrc() || []; if (!L.length) return null;
  RACK = L.map(sc => { sc.updateMatrixWorld(true); const op = [], tr = [], bb = new THREE.Box3();   // рамката и частите — в едни и същи координати (с въртенето на корена)
    sc.traverse(m => { if (!m.isMesh || !m.geometry || m.isSkinnedMesh || !m.visible) return; const mt = [].concat(m.material)[0]; if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const p = { geo: m.geometry, mat: m.material, mtx: m.matrixWorld.clone(), box: m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld) }; if (mt && !mt.transparent && mt.blending !== THREE.AdditiveBlending) { op.push(p); bb.union(p.box); } else if (mt && mt.blending !== THREE.AdditiveBlending) tr.push(p); });
    if (bb.isEmpty()) return [];
    const sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3()), turn = sz.x > sz.z, len = turn ? sz.x : sz.z, wid = turn ? sz.z : sz.x;
    if (sz.y / len < 0.22 || sz.y / len > 0.65 || wid / len < 0.3 || wid / len > 0.6) return [];   // не прилича на кола (сноп/плоскост в рамката) — без този модел
    const big = bb.clone().expandByVector(sz.clone().multiplyScalar(0.15)), parts = op.concat(tr.filter(p => big.containsBox(p.box)));   // прозрачните — само вътре в колата (стъклата); сноповете на фаровете — не
    const k = Math.min(4.3 / len, 1.35 / sz.y), N = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeRotationY(turn ? Math.PI / 2 : 0)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -bb.min.y, -c.z));
    for (const p of parts) p.mtx = N.clone().multiply(p.mtx);
    return parts; }).filter(p => p.length);
  return RACK.length ? RACK : (RACK = null);
}
function rackLoad(o, seed) {
  const M = rackModels(); if (!M) return; const boxes = []; o.traverse(m => { if (m.userData.rackCar) boxes.push(m); }); if (!boxes.length) return;
  const par = boxes[0].parent, near = new THREE.Group(), far = new THREE.Group(), by = new Map();
  boxes.forEach((b, k) => { far.add(b); const mi = (Math.abs(seed) * 7 + k * 5 + (k * k) % 3) % M.length; (by.get(mi) || by.set(mi, []).get(mi)).push(new THREE.Matrix4().makeTranslation(b.position.x, b.position.y + 0.12, b.position.z).multiply(new THREE.Matrix4().makeRotationY(((seed + k) & 1) * Math.PI))); });
  const T = new THREE.Matrix4();
  for (const [mi, slots] of by) for (const pt of M[mi]) { const im = new THREE.InstancedMesh(pt.geo, pt.mat, slots.length); slots.forEach((S, j) => im.setMatrixAt(j, T.multiplyMatrices(S, pt.mtx))); im.computeBoundingSphere(); near.add(im); }
  const lod = new THREE.LOD(); lod.addLevel(near, 0); lod.addLevel(far, 150); par.add(lod);
}
export const trainModelsReady = () => ready;
export const hasTrainModel = k => ready && !!P[k];
// нов вагон: 'loco' | 'hopper' | 'flat' | 'ave' | 'hsw' (среден) | 'aveTail' | 'oeLoco' | 'oeCar' (Ориент Експрес) | 'paxLoco' | 'paxCar' | 'vl82' | 'boxcar' | 'hopper2' (trains-real) (обърнат челен вагон); seed — за цвета на контейнера
export function trainCar(kind, seed = 0) {
  const src = P[kind === 'aveTail' ? 'ave' : kind]; if (!src) return null;
  let o = src.clone(true);
  if (kind === 'aveTail') { const w = new THREE.Group(); o.rotation.y = Math.PI; w.add(o); o = w; }
  if (kind === 'flat') {   // контейнерът на платформата — различен цвят на всеки вагон
    const col = CONT_COLS[Math.abs(seed) % CONT_COLS.length];
    o.traverse(m => { if (m.isMesh && /red/i.test(m.material.name)) { m.material = m.material.clone(); m.material.color.setHex(col); } });
  }
  if (kind === 'paxLoco' || kind === 'vl82') addHeadlights(o, src.userData.len);
  else if (kind === 'elLoco' || kind === 'steamLoco' || kind === 'upLoco' || kind === 'gpLoco' || kind === 'steam2Loco') addHeadlights(o, src.userData.len, { s: 0.7, y: kind === 'steamLoco' || kind === 'steam2Loco' ? 2.6 : 1.7, x: 0.62, beamW: 3, beamL: 12 });   // trains-variety: малки светлини и мек конус
  if (kind === 'autorack') rackLoad(o, seed);
  if (kind === 'cistern') { const col = TINTS[Math.abs(seed) % TINTS.length]; o.traverse(m => { if (m.isMesh && m.userData.tint !== undefined || (m.isMesh && m.material && m.material.color && m.material.color.getHex() === 0xffffff)) { m.material = m.material.clone(); m.material.color.setHex(col); } }); }   // trains-variety: цистерни в различни цветове
  o.userData.len = src.userData.len;
  return o;
}
// 💡 светлините на локомотивите (Blender, 29.10): отделни възли headlight_L/R, headlamp (парните), taillight_L/R (червени, отзад), cabwin_* (кабината — топло),
// firebox_L/R (огнището под кабината на парните); нощем ги пали daynight.js (NF_MATS: emissiveIntensity = нощ × nfK), денем — 0. Старите модели: „emission“ (Ориент Експрес), „Lights“ (GP38)
const LL_K = { headlight: 3.2, headlamp: 3.2, taillight: 2.2, cabwin: 0.07, firebox: 1.8 }, LL_SEEN = new Set();
function locoLights(sc) {
  sc.traverse(m => { if (!m.isMesh || !m.material) return; const k = (m.name.match(/^(headlight|headlamp|taillight|cabwin|firebox)/) || [])[1] || (/^(emission|Lights)$/.test(m.material.name || '') ? 'headlight' : null);
    if (!k || LL_SEEN.has(m.material)) return; const mt = m.material; LL_SEEN.add(mt); if (!mt.emissive || !mt.emissive.getHex()) return; mt.emissiveIntensity = 0; mt.userData.nfK = LL_K[k]; if (k === 'cabwin') mt.color.setHex(0x15171a); NF_MATS.add(mt); });   // кабината денем — тъмно стъкло
}
// къде са фаровете на модела (в координатите на вагона) — ореолите и снопът отиват там
function hlSpots(o) { o.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(o.matrixWorld).invert(), r = []; o.traverse(m => { if (m.isMesh && /^(headlight|headlamp)/.test(m.name)) { m.geometry.computeBoundingBox(); r.push(m.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(m.matrixWorld).applyMatrix4(inv)); } }); return r; }
// фаровете на локомотива: светещи петна на челото (нощем — daynight.js през NF_MATS) и сноп напред
let lightMat = null, beamMat = null;
function addHeadlights(o, len, H = {}) {
  if (!lightMat) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 1, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,250,225,1)'); gr.addColorStop(0.3, 'rgba(255,235,180,0.6)'); gr.addColorStop(1, 'rgba(255,220,150,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const tex = canvasTex(c);
    lightMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xc8bc98, emissiveMap: tex, emissiveIntensity: 0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    beamMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x4a4434, emissiveMap: tex, emissiveIntensity: 0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    NF_MATS.add(lightMat); NF_MATS.add(beamMat);
  }
  const hs = H.s ?? 1.1, hx = H.x ?? 0.7, hy = H.y ?? 1.3, bw = H.beamW ?? 4.5, bl = H.beamL ?? 16, sp = hlSpots(o);   // фаровете от модела (ако ги има) — ореолът точно върху тях
  for (const p of sp.length ? sp : [[-hx, hy], [hx, hy]].map(([x, y]) => new THREE.Vector3(x, y, len / 2))) { const q = new THREE.Mesh(new THREE.PlaneGeometry(hs, hs), lightMat); q.position.set(p.x, p.y, p.z + 0.08); o.add(q); }
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(bw, bl).rotateX(-Math.PI / 2), beamMat); beam.position.set(0, 0.25, len / 2 + bl / 2); o.add(beam);
}
