// industry.js — истинските заводи, складове, водни кули, вятърни турбини и соларни панели вместо детските на Kenney
// (Лабораторията → ind-real). Моделите са от Sketchfab (CC-BY, авторите в CREDITS.txt), в assets/heavy/industry:
//   sf-indset — „Industrial Buildings Set“ (30 сгради в един файл — разделят се по имената на мешовете: Industrial_<Сграда>_<N>_…),
//   sf-warehouses, sf-oldwarehouse, sf-indbuilding — складове и тухлена промишлена сграда, sf-watertower — 4 водни кули,
//   sf-windturbine — турбина (перките се въртят), sf-solar — соларен панел (нарежда се на редици).
// Всяка истинска застава в кутията на детския модел при мащаб 1 (KID) — game.js ги слага като досега: model('ind-…', мащаб).
import * as THREE from 'three';
import { feature } from './lab/feature.js';

const BASE = 'assets/heavy/industry/';
// детският модел при мащаб 1: [ширина x, височина y, дължина z, център x, основа y, център z]
const KID = {
  'building-a': [2.084, 1.47, 1.242, 0, 0, 0], 'building-b': [2.084, 1.47, 1.262, 0, 0, -0.008], 'building-c': [1.876, 1.25, 2.108, 0.096, 0, 0.143],
  'building-d': [0.884, 1.415, 1.42, 0, 0, -0.09], 'building-e': [1.684, 1.65, 1.29, 0, 0, 0.249], 'building-f': [1.79, 1.925, 1.28, -0.453, 0, 0.254],
  'building-g': [1.678, 1.28, 1.284, 0, 0, 0], 'building-h': [1.322, 0.734, 1.31, -0.581, 0, 0.279], 'building-i': [1.028, 0.734, 1.3, -0.434, 0, 0.274],
  'building-j': [1.027, 0.861, 1.3, -0.435, 0, 0.274], 'building-k': [1.303, 0.773, 0.914, 0, 0, -0.007], 'building-l': [2.084, 1.925, 1.87, -0.422, 0, 0.224],
  'water-tower': [0.852, 2.142, 0.832, 0, 0, 0], windmill: [0.605, 2.314, 1.127, -0.013, 0, -0.003],
  'solar-panel-landscape-group': [1.513, 0.262, 0.895, 0, 0, 0], 'solar-panel-portrait-group': [0.918, 0.41, 1.249, 0, 0, 0],
};
// кой детски завод с коя истинска сграда (от комплекта — по името; иначе отделен файл)
const FACT = { 'building-a': 'FactoryPlant_1', 'building-b': 'Powerplant_1', 'building-c': 'sf-indbuilding', 'building-d': 'Building_10', 'building-e': 'FactoryPlant_2',
  'building-f': 'sf-oldwarehouse', 'building-g': 'Hangar_2', 'building-h': 'Warehouse_5', 'building-i': 'sf-warehouses', 'building-j': 'Building_1',
  'building-k': 'Warehouse_3', 'building-l': 'LogisticTerminal_1' };

const box = o => { o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o); };
// в кутията на детския: дългата ос по същата посока, същата дължина (кулите и турбината — същата височина), основата на земята
function fitTo(obj, kid, byHeight = false) {
  const [kx, ky, kz, cx, by, cz] = KID[kid], w = new THREE.Group(), inner = new THREE.Group(); inner.add(obj); w.add(inner);
  let s = box(inner).getSize(new THREE.Vector3());
  if ((kx > kz) !== (s.x > s.z) && !byHeight) { inner.rotation.y = Math.PI / 2; s = box(inner).getSize(new THREE.Vector3()); }
  inner.scale.multiplyScalar(byHeight ? ky / s.y : Math.max(kx, kz) / Math.max(s.x, s.z));
  const b = box(inner), c = b.getCenter(new THREE.Vector3());
  inner.position.add(new THREE.Vector3(cx - c.x, by - b.min.y, cz - c.z));
  w.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; const mt = m.material; if (mt && mt.metalness > 0.5) { m.material = mt.clone(); m.material.metalness = 0.3; m.material.roughness = Math.max(mt.roughness ?? 0.5, 0.55); } } });   // без огледална среда металът излиза черен
  return w;
}
// мешовете на сцена → отделни групи (в световните координати на файла)
function partOf(meshes) { const g = new THREE.Group(); for (const m of meshes) { const c = m.clone(); c.matrixAutoUpdate = false; c.matrix.copy(m.matrixWorld); g.add(c); } return g; }

// load(url) → Promise<gltf>; A — моделите на играта. Без ✓ OK в Лабораторията — нищо (остават детските)
export function loadIndustry(load, A) {
  if (!feature('ind-real')) return Promise.resolve();
  const F = ['sf-indset', 'sf-warehouses', 'sf-oldwarehouse', 'sf-indbuilding', 'sf-watertower', 'sf-windturbine', 'sf-solar'], G = {};
  return Promise.all(F.map(f => load(BASE + f + '.glb').then(g => { g.scene.updateMatrixWorld(true); G[f] = g.scene; }).catch(e => console.warn('industry', f, e)))).then(() => {
    // комплектът — по сгради
    const SET = {};
    G['sf-indset']?.traverse(m => { if (!m.isMesh) return; const k = (m.name.match(/^Industrial_([A-Za-z]+_\d+)/) || [])[1]; if (k) (SET[k] = SET[k] || []).push(m); });
    const real = k => k.startsWith('sf-') ? (G[k] ? partOf((() => { const L = []; G[k].traverse(m => { if (m.isMesh) L.push(m); }); return L; })()) : null) : SET[k] ? partOf(SET[k]) : null;
    for (const [kid, k] of Object.entries(FACT)) { const o = real(k); if (o) A['ind-' + kid] = { scene: fitTo(o, kid) }; }
    // водните кули: 4 варианта (по x) — model() ги редува
    if (G['sf-watertower']) {
      const by = {}; G['sf-watertower'].traverse(m => { if (!m.isMesh) return; const x = Math.round(box(m).getCenter(new THREE.Vector3()).x / 20); (by[x] = by[x] || []).push(m); });
      const V = Object.keys(by).sort((a, b) => a - b).map(x => fitTo(partOf(by[x]), 'water-tower', true));
      if (V.length) A['ind-water-tower'] = { scene: V[0], variants: V };
    }
    // турбината: перките се въртят около главината (оста — най-тънката страна на перките)
    if (G['sf-windturbine']) {
      let blades = null; const L = []; G['sf-windturbine'].traverse(m => { if (m.isMesh) { L.push(m); if (/blade/i.test(m.name)) blades = m; } });
      const t = fitTo(partOf(L), 'windmill', true);
      const bl = blades && t.getObjectByProperty('name', blades.name);
      if (bl) {
        const bb = box(bl), c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3()), ax = s.x < s.y && s.x < s.z ? 'x' : s.y < s.z ? 'y' : 'z';
        const piv = new THREE.Group(); piv.position.copy(bl.parent.worldToLocal(c.clone())); bl.parent.add(piv); piv.updateMatrixWorld(true); piv.attach(bl);
        piv.userData.spinAx = ax;
        bl.onBeforeRender = function () { const p = this.parent; if (p) p.rotation[p.userData.spinAx] = performance.now() * 0.0011; };
      }
      A['ind-windmill'] = { scene: t };
    }
    // соларните панели: редица от истинския панел в кутията на детската група
    if (G['sf-solar']) {
      const L = []; G['sf-solar'].traverse(m => { if (m.isMesh) L.push(m); });
      for (const [kid, nx, nz] of [['solar-panel-landscape-group', 3, 2], ['solar-panel-portrait-group', 2, 3]]) {
        const [kx, , kz] = KID[kid], row = new THREE.Group();
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const p = fitTo(partOf(L), kid); p.scale.setScalar(Math.min(1 / nx, 1 / nz) * 0.94); p.position.set((i - (nx - 1) / 2) * kx / nx, 0, (j - (nz - 1) / 2) * kz / nz); row.add(p); }
        A['ind-' + kid] = { scene: row };
      }
    }
  });
}
