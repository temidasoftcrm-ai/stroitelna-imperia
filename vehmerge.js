// vehmerge.js — ⚡ флаг veh-merge: колите, бусовете, камионите и автобусите — неподвижните им части се сливат по материал.
// Мерене (20.11, Пловдив, „Ниско“, видим прозорец): процесорът подготвя рисуването ~22–25 ms на кадър при ~1 800 рисувания,
// видеокартата е на 11–18 %. Един бус беше 68 рисувания при 8 материала — всяко копие по пътя и на паркинга ги повтаря.
// Сливат се части с един и същ материал в координатите на модела — само ако по пътя до тях няма подвижен възел
// (ремаркето на шарнира, колелата wheel_*, вратите с анимация): той и всичко под него остават както са.
// Не се пипат: фаровете/стоповете (lamp_*, userData.lamp/lampReal — traffic.js им сменя материала), бурканите и лентите (siren*,
// собствени класове с onBeforeRender), колелата, анимираните възли, мешовете с деца, скелетите, инстанциите, огледалните (det < 0).
//   import { mergeVeh } from './vehmerge.js';  mergeVeh(шаблон, { clips: [AnimationClip…] }) — веднъж, преди клонирането
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const GETC = ['getX', 'getY', 'getZ', 'getW'];   // three r160: BufferAttribute няма getComponent (от r161)

const KEEP_RX = /^(wheel_|lamp_|siren|beacon|door|semi|ladder|nav_|strobe)/i;   // ladder — стълбата на пожарната (firesim.js я търси по име)
const plainRender = THREE.Mesh.prototype.onBeforeRender;

// Float32, не interleaved/нормализирани — иначе mergeGeometries отказва (както в citycull.js)
function flat(g) {
  for (const n of Object.keys(g.attributes)) { const a = g.attributes[n];
    if (a.isInterleavedBufferAttribute || a.normalized || !(a.array instanceof Float32Array)) { const f = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a[GETC[c]](i);
      g.setAttribute(n, new THREE.BufferAttribute(f, a.itemSize)); } }
  return g;
}
const sig = g => Object.keys(g.attributes).sort().map(n => { const a = g.attributes[n]; return n + ':' + a.itemSize; }).join(',') + (g.index ? '#i' : '#n');

// → { before, after } — броят мешове, които се рисуват; повторно викане не прави нищо
export function mergeVeh(root, o = {}) {
  if (!root || root.userData.vehMerged) return null;
  Object.defineProperty(root.userData, 'vehMerged', { value: true, enumerable: false });   /* не в JSON на userData — копията не трябва да го наследяват като „готово“ без значение */
  const anim = new Set((o.clips || []).flatMap(c => c.tracks.map(t => THREE.PropertyBinding.parseTrackName(t.name).nodeName)));
  const moving = n => KEEP_RX.test(n.name || '') || anim.has(n.name) || anim.has(THREE.PropertyBinding.sanitizeNodeName(n.name || '')) || n.userData.lamp || n.userData.lampReal || n.userData.carLights || n.userData.wheelR != null || n.userData.keep;
  const parts = []; let before = 0;
  const walk = (n, frozen) => { for (const c of n.children) {
    const mv = frozen || moving(c);
    if (c.isMesh) before++;
    if (!mv && c.isMesh && !c.isSkinnedMesh && !c.isInstancedMesh && !c.morphTargetInfluences && c.children.length === 0 && c.visible
      && !Array.isArray(c.material) && c.material && c.geometry && c.geometry.attributes.position && c.onBeforeRender === plainRender && !c.material.lampSet && c.constructor === THREE.Mesh) {
      parts.push(c);
    }
    walk(c, mv);   /* под подвижен възел — нищо не се слива (вратата, колелото и т.н. с всичко в тях) */
  } };
  walk(root, false);
  let removed = 0, added = 0;
  root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), M = new THREE.Matrix4();
  const groups = new Map();
  for (const m of parts) { M.multiplyMatrices(inv, m.matrixWorld); if (M.determinant() <= 0) continue;   /* огледалните — обърнатата посока на стените не оцелява при сливането */
    const k = m.material.uuid + '|' + sig(m.geometry) + '|' + m.castShadow + m.receiveShadow + '|' + m.renderOrder + '|' + m.layers.mask + '|' + m.frustumCulled;
    (groups.get(k) || groups.set(k, []).get(k)).push([m, M.clone()]); }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map(([m, mx]) => { const g = flat(m.geometry.clone()); g.morphAttributes = {}; g.applyMatrix4(mx); return g; });
    let mg = null; try { mg = mergeGeometries(geos, false); } catch (e) { mg = null; }
    for (const g of geos) g.dispose();
    if (!mg) continue;
    const a = list[0][0], mesh = new THREE.Mesh(mg, a.material);
    mesh.name = 'merged'; mesh.castShadow = a.castShadow; mesh.receiveShadow = a.receiveShadow; mesh.renderOrder = a.renderOrder; mesh.layers.mask = a.layers.mask; mesh.frustumCulled = a.frustumCulled;
    mesh.userData.mergedOf = list.length; root.add(mesh); added++;
    for (const [m] of list) { m.parent.remove(m); removed++; }
  }
  return { before, after: before - removed + added };
}
