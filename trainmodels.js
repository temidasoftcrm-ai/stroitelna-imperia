// trainmodels.js — истински 3D модели на влакове от Sketchfab (CC-BY, авторите са в CREDITS.txt и „📜 Автори“):
//   • „Low Poly EMD GP38“ от TheOminousDuck — дизелов локомотив + вагон-бункер + платформа с контейнер (в един файл;
//     тук се разделят на три отделни вагона по дължината);
//   • „AVEENG“ от dannzjs — скоростен влак (челен вагон) за „Стрела“; опашката е същият вагон, обърнат назад.
// Зареждат се асинхронно; докато не са готови (или ако не се заредят), играта ползва старите модели на Kenney.
// Всеки вагон е THREE.Group с предница към +z, център в началото, колела на y = 0 и userData.len — дължината му.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
    const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld);
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
        out.setAttribute(name, new THREE.BufferAttribute(arr, sz, attr.normalized));
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
  const L = new GLTFLoader(), get = f => new Promise((res, rej) => L.load(base + f, g => res(g.scene), undefined, rej));
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
  ]).then(() => { ready = true; }).catch(e => { console.warn('trainmodels', e); ready = false; });
  return loading;
}
export const trainModelsReady = () => ready;
export const hasTrainModel = k => ready && !!P[k];
// нов вагон: 'loco' | 'hopper' | 'flat' | 'ave' | 'hsw' (среден) | 'aveTail' | 'oeLoco' | 'oeCar' (Ориент Експрес) (обърнат челен вагон); seed — за цвета на контейнера
export function trainCar(kind, seed = 0) {
  const src = P[kind === 'aveTail' ? 'ave' : kind]; if (!src) return null;
  let o = src.clone(true);
  if (kind === 'aveTail') { const w = new THREE.Group(); o.rotation.y = Math.PI; w.add(o); o = w; }
  if (kind === 'flat') {   // контейнерът на платформата — различен цвят на всеки вагон
    const col = CONT_COLS[Math.abs(seed) % CONT_COLS.length];
    o.traverse(m => { if (m.isMesh && /red/i.test(m.material.name)) { m.material = m.material.clone(); m.material.color.setHex(col); } });
  }
  o.userData.len = src.userData.len;
  return o;
}
