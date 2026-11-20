// skinmerge.js — ⚡ флаг ped-merge: частите на един анимиран човек (тяло, дрехи, обувки, коса, мигли — Mixamo) с общ материал
// се сливат в един SkinnedMesh със същия скелет. Мерене (20.11, Пловдив, „Ниско“): 20 видими минувачи = 118 рисувания
// (~6 части при 2–3 материала) → ~2–3 рисувания на човек. Прави се веднъж върху шаблона, преди клонирането (SkeletonUtils.clone).
// Слива се само група с: един и същ скелет (костите), една и съща bindMatrix и рамка спрямо шаблона, без морфинг, без масиви от материали.
//   import { mergeSkinned } from './skinmerge.js';  mergeSkinned(gltf.scene) → { before, after }
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const GETC = ['getX', 'getY', 'getZ', 'getW'];   // three r160: няма BufferAttribute.getComponent
function plain(g) {   // нормализираните/преплетените атрибути → обикновени (иначе mergeGeometries отказва); skinIndex остава цял
  for (const n of Object.keys(g.attributes)) { const a = g.attributes[n];
    if (n === 'skinIndex' && !a.isInterleavedBufferAttribute) continue;
    if (a.isInterleavedBufferAttribute || a.normalized || !(a.array instanceof Float32Array)) {
      const Ctor = n === 'skinIndex' ? Uint16Array : Float32Array, f = new Ctor(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a[GETC[c]](i);
      g.setAttribute(n, new THREE.BufferAttribute(f, a.itemSize)); } }
  if (g.attributes.skinIndex && !(g.attributes.skinIndex.array instanceof Uint16Array)) { const a = g.attributes.skinIndex, f = new Uint16Array(a.array.length); f.set(a.array); g.setAttribute('skinIndex', new THREE.BufferAttribute(f, a.itemSize)); }
  return g;
}
const sig = g => Object.keys(g.attributes).sort().map(n => n + ':' + g.attributes[n].itemSize).join(',') + (g.index ? '#i' : '#n');
const same = (a, b) => { const x = a.elements, y = b.elements; for (let i = 0; i < 16; i++) if (Math.abs(x[i] - y[i]) > 1e-6) return false; return true; };

export function mergeSkinned(root) {
  if (!root || root.userData.skinMerged) return null;
  Object.defineProperty(root.userData, 'skinMerged', { value: true, enumerable: false });
  root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const list = []; let before = 0;
  root.traverse(m => { if (!m.isSkinnedMesh) return; before++;
    if (Array.isArray(m.material) || !m.material || !m.visible || m.children.length || Object.keys(m.geometry.morphAttributes || {}).length || m.morphTargetInfluences) return;
    list.push(m); });
  const groups = new Map(), rel = new THREE.Matrix4();
  for (const m of list) { const k = m.skeleton.uuid + '|' + m.material.uuid + '|' + m.bindMode + '|' + sig(m.geometry) + '|' + m.castShadow + m.receiveShadow;
    (groups.get(k) || groups.set(k, []).get(k)).push(m); }
  let after = before;
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const a = g[0], ra = new THREE.Matrix4().multiplyMatrices(inv, a.matrixWorld);
    if (!g.every(m => same(m.bindMatrix, a.bindMatrix) && m.skeleton.bones.length === a.skeleton.bones.length && m.skeleton.bones.every((b, i) => b === a.skeleton.bones[i]) && same(rel.multiplyMatrices(inv, m.matrixWorld), ra))) continue;
    let mg = null; try { mg = mergeGeometries(g.map(m => { const x = plain(m.geometry.clone()); x.morphAttributes = {}; x.clearGroups(); return x; }), false); } catch (e) { mg = null; }
    if (!mg) continue;
    const sm = new THREE.SkinnedMesh(mg, a.material); sm.name = a.name + '+' + (g.length - 1); sm.castShadow = a.castShadow; sm.receiveShadow = a.receiveShadow; sm.frustumCulled = a.frustumCulled; sm.renderOrder = a.renderOrder;
    sm.position.copy(a.position); sm.quaternion.copy(a.quaternion); sm.scale.copy(a.scale); sm.bindMode = a.bindMode;
    a.parent.add(sm); sm.updateMatrixWorld(true); sm.bind(a.skeleton, a.bindMatrix); sm.userData.mergedOf = g.length;
    for (const m of g) m.parent.remove(m);
    after -= g.length - 1;
  }
  return { before, after };
}
