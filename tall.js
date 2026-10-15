// tall.js — по-високи небостъргачи: един етаж от модела (лента между y1 и y2) се повтаря, докато сградата
// стане с нужния брой етажи. Долните етажи и покривът остават същите, а триъгълниците, които минават
// през лентата (ъглови колони, ребра), се разтягат. Геометрията се променя веднъж, при зареждане.
import * as THREE from 'three';
import { feature } from './lab/feature.js';

// Kenney City Kit (commercial): етажите са през ~0.35 единици; лентата е от долния ръб на един ред прозорци до следващия
export const SKY_BANDS = {
  'building-skyscraper-a': { y1: 1.07, y2: 1.42, floors: 6 },
  'building-skyscraper-b': { y1: 1.07, y2: 1.42, floors: 10 },
  'building-skyscraper-c': { y1: 1.62, y2: 1.98, floors: 8 },
};
// новите небостъргачи от poly.pizza (Лабораторията → „Ново“): същите имена, своя лента; в играта — след „✓ OK“
const NEW_BANDS = {
  'building-skyscraper-a': ['com-sky-a', { y1: 1.099, y2: 1.395, floors: 8 }],    // Distant Building 03: прозорците през 0.296
  'building-skyscraper-b': ['com-sky-b', { y1: 1.730, y2: 1.870, floors: 12 }],   // ар деко: горната шахта
  'building-skyscraper-c': ['com-sky-c', { y1: 2.938, y2: 3.114, floors: 8 }],    // бели ребра: разтяга се средата
};
for (const [n, [id, band]] of Object.entries(NEW_BANDS)) if (feature(id)) SKY_BANDS[n] = band;

// модерни стъклени небостъргачи от Commercial 2.1 (assets/commercial2) — за най-големите градове
export const SKY_BANDS_MODERN = {
  'building-skyscraper-d': { y1: 1.62, y2: 1.98, floors: 12 },
  'building-skyscraper-e': { y1: 1.54, y2: 1.93, floors: 8 },
};

// geometry: BufferGeometry (може и индексирана); extra: колко етажа да се добавят
export function stretchFloors(geometry, y1, y2, extra) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const P = y2 - y1, D = extra * P, eps = 1e-3;
  const names = Object.keys(g.attributes), src = names.map(n => g.attributes[n]);
  const pos = g.attributes.position, nTri = pos.count / 3;
  const out = names.map(() => []);
  const push = (i, dy) => {
    names.forEach((n, a) => {
      const at = src[a];
      for (let c = 0; c < at.itemSize; c++) {
        let v = at.array[i * at.itemSize + c];
        if (n === 'position' && c === 1) v += dy(v);
        out[a].push(v);
      }
    });
  };
  for (let t = 0; t < nTri; t++) {
    const ys = [0, 1, 2].map(k => pos.getY(t * 3 + k));
    const lo = Math.min(...ys), hi = Math.max(...ys);
    if (hi <= y1 + eps) for (let k = 0; k < 3; k++) push(t * 3 + k, () => 0);                 // под лентата
    else if (lo >= y2 - eps) for (let k = 0; k < 3; k++) push(t * 3 + k, () => D);           // над лентата: вдига се
    else if (lo >= y1 - eps && hi <= y2 + eps) {                                               // в лентата: повтаря се
      for (let r = 0; r <= extra; r++) for (let k = 0; k < 3; k++) push(t * 3 + k, () => r * P);
    } else for (let k = 0; k < 3; k++) push(t * 3 + k, y => y >= y2 ? D : y <= y1 ? 0 : D * (y - y1) / P);   // минава през лентата: разтяга се
  }
  const ng = new THREE.BufferGeometry();
  names.forEach((n, a) => ng.setAttribute(n, new THREE.Float32BufferAttribute(out[a], src[a].itemSize, src[a].normalized)));
  ng.computeBoundingBox(); ng.computeBoundingSphere();
  return ng;
}

// прави сцената на модела висока floors етажа (на място, веднъж); връща броя добавени етажи
export function makeTall(scene, band, floors = 20) {
  const extra = Math.max(0, floors - band.floors);
  if (!extra || scene.userData.tall) return 0;
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    if (!o.isMesh) return;
    // лентата е в координатите на модела; ако мешът е изместен/мащабиран, я превръщаме в неговите
    const inv = new THREE.Matrix4().copy(o.matrixWorld).invert(), v = new THREE.Vector3();
    const ly1 = v.set(0, band.y1, 0).applyMatrix4(inv).y, ly2 = v.set(0, band.y2, 0).applyMatrix4(inv).y;
    o.geometry = stretchFloors(o.geometry, ly1, ly2, extra);
  });
  scene.userData.tall = floors;
  return extra;
}

// копие на модела с дадения брой етажи (оригиналът не се пипа) — за небостъргачи с различна височина
export function makeTallCopy(scene, band, floors) {
  const c = scene.clone(true), extra = Math.max(0, floors - band.floors);
  if (!extra) return c;
  c.updateMatrixWorld(true);
  c.traverse(o => {
    if (!o.isMesh) return;
    const inv = new THREE.Matrix4().copy(o.matrixWorld).invert(), v = new THREE.Vector3();
    const ly1 = v.set(0, band.y1, 0).applyMatrix4(inv).y, ly2 = v.set(0, band.y2, 0).applyMatrix4(inv).y;
    o.geometry = stretchFloors(o.geometry, ly1, ly2, extra);
  });
  c.userData.tall = floors;
  return c;
}
