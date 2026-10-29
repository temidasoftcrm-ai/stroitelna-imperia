// citycull.js — ⚡ флаг perf-cliff (f1: „Империал Сити забива — над ~3000 draw calls GPU процесът на Chrome пада от ръба“):
//   1) детайлите на града (userData.detail: светофари, лампи, дървета, градинки, бензиностанции) — видими само до ~130 м от целта на камерата
//      (по-далеч при отдалечена камера), с хистерезис, проверка на ~0,5 s;
//   2) хората (минувачи и групички) — до ~80 м;
//   3) статичните модели с много части (стълбовете на светофарите — 21 части, сградите, декорът) — сливат се по материал
//      (mergeGeometries) на порции, за да няма едно дълго спиране. Подвижното (скелети, инстанции, userData.keep) не се пипа.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const DECO = new Set(['markets', 'billboards', 'flagsSquare', 'statues']);   // украсата — изключва се изцяло на слабите нива (gfx deco)
const _v = new THREE.Vector3(), _box = new THREE.Box3(), _inv = new THREE.Matrix4(), _m = new THREE.Matrix4();
// центърът и радиусът на обекта (веднъж; градът не мърда)
function sphereOf(o) {
  let s = o.userData.cull; if (s) return s;
  _box.setFromObject(o); if (_box.isEmpty()) { s = { x: o.position.x, z: o.position.z, r: 0 }; }
  else { _box.getCenter(_v); s = { x: _v.x, z: _v.z, r: Math.max(_box.max.x - _box.min.x, _box.max.z - _box.min.z) / 2 }; }
  return (o.userData.cull = s);
}

// сливане на частите на един статичен обект по материал (в локалните му координати); връща колко мрежи са махнати
export function mergeKids(o, minMeshes = 6) {
  if (o.userData.merged) return 0; o.userData.merged = true;
  const parts = []; let bad = false;
  // обхождане без скритите и без поддърветата с userData.keep (подвижното: трафик, перки…) — те остават както са
  const walk = (n, top) => { for (const m of n.children) { if (!m.visible || m.userData.keep) continue;
    if (m.isSkinnedMesh || m.isInstancedMesh) { if (top) bad = true; continue; }
    if (m.isSprite || m.isPoints || m.isLine || m.morphTargetInfluences) continue;
    if (m.isMesh && !Array.isArray(m.material) && m.geometry) parts.push(m); walk(m, top); } };
  walk(o, !o.userData.mergeWhen);   // голямата група (mergeWhen) може да има инстанции вътре — просто ги прескачаме
  if (bad || parts.length < minMeshes) return 0;
  o.updateMatrixWorld(true); _inv.copy(o.matrixWorld).invert();
  const groups = new Map();
  for (const m of parts) {
    const g = m.geometry, at = Object.keys(g.attributes).sort().map(n => { const a = g.attributes[n]; return `${n}:${a.itemSize}:${(a.array || a.data?.array)?.constructor.name}:${!!a.normalized}`; }).join(',') + (g.index ? '#i' : '#n'), k = m.material.uuid + '|' + at + '|' + m.castShadow + m.receiveShadow;   // пълният подпис — иначе mergeGeometries пише грешки
    (groups.get(k) || groups.set(k, []).get(k)).push(m);
  }
  let removed = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map(m => { _m.multiplyMatrices(_inv, m.matrixWorld); const g = m.geometry.clone(); for (const n of Object.keys(g.morphAttributes || {})) delete g.morphAttributes[n];
      for (const n of Object.keys(g.attributes)) { const a = g.attributes[n];   /* GLB/meshopt: interleaved → обикновени Float32 по-долу (не clone() — three пише предупреждение за всяко) */
        if (a.isInterleavedBufferAttribute || a.normalized || !(a.array instanceof Float32Array)) { const f = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent ? a.getComponent(i, c) : [a.getX, a.getY, a.getZ, a.getW][c].call(a, i); g.setAttribute(n, new THREE.BufferAttribute(f, a.itemSize)); } }   // квантизираните (KHR_mesh_quantization: Int16 normalized) — към Float32, иначе applyMatrix4 ги реже до ±1
      g.applyMatrix4(_m); return g; });
    let mg = null; try { mg = mergeGeometries(geos, false); } catch (e) { mg = null; }
    for (const g of geos) g.dispose();
    if (!mg) continue;
    const mesh = new THREE.Mesh(mg, list[0].material); mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow; mesh.userData.mergedOf = list.length;
    mesh.matrixAutoUpdate = false; o.add(mesh); mesh.updateMatrix();
    for (const m of list) { m.parent && m.parent.remove(m); removed++; }
  }
  return removed - 0;
}

// deps: { group() → city.group, target() → controls.target, camDist() → разстоянието на камерата, peds() → [обекти], on() → флагът, detailK() → 0…1 (gfx-lite) }
// ⚡ perf3-far: дребните мрежи (радиус < 5 м: коли, хора, реквизит по строежите, бусове) — извън рисуването отдалеч (слой 1, не visible — играта си пипа visible):
//   < 2,5 м — до 260 м от камерата, < 5 м — до 420 м (на „Ниско“ 150/260, „Много ниско“ 110/200 — gfxpresets far3); тежкият декор (< 25 м, > 20 хил. △: кранове,
//   статуи) — на слабите нива до 500/350 м (на „Средно“ — без ограничение); без забележителностите и дворовете (те си имат свое); списъкът — наново на ~3 s
const FAR_L = 1;
function farCull(deps, st, dt) {
  const g = deps.group(); if (!g) return; st.t += dt; st.r += dt;
  if (st.r >= 3 || st.g !== g) { st.r = 0; st.g = g; const skip = deps.skip ? deps.skip() : new Set(), L = [];
    const fw = [];
    const walk = n => { for (const m of n.children) { if (m.userData.fw) fw.push(m); if (skip.has(m)) continue; if (m.isMesh && !m.isInstancedMesh) { const ge = m.geometry; if (ge) { if (!ge.boundingSphere) ge.computeBoundingSphere(); const r = ge.boundingSphere ? ge.boundingSphere.radius * m.matrixWorld.getMaxScaleOnAxis() : 99; if (r < 5) L.push([m, r < 2.5 ? 0 : 1]); else if (r < 25 && (ge.index ? ge.index.count : ge.attributes.position.count) / 3 > 20000) L.push([m, 2]); } } if (m.children.length) walk(m); } };
    walk(g); const X = deps.scene && deps.scene(); if (X) for (const c of X.children) if (c !== g && !c.isCamera && !c.isLight && !skip.has(c)) walk({ children: [c] });   // и колите/агентите направо в сцената (не в city.group)
    st.fw = fw; const now = new Set(L.map(x => x[0])); for (const [m] of st.list) if (!now.has(m) && m.layers.mask === 1 << FAR_L) m.layers.set(0); st.list = L; }
  if (st.t < 0.25) return; st.t = 0; { const jets = !deps.jets || deps.jets(); for (const f of st.fw || []) for (const k of f.children) if (k.renderOrder === 2) k.visible = jets; }   // слабите нива: фонтаните без струите (водата остава)
  const c = deps.cam(), cx = c.x, cy = c.y, cz = c.z, FD = (deps.farD && deps.farD()) || [260, 420, Infinity];   // разстоянията — по нивото на графиката
  for (const [m, k] of st.list) { const D = FD[k]; const e = m.matrixWorld.elements, dx = e[12] - cx, dy = e[13] - cy, dz = e[14] - cz, d2 = dx * dx + dy * dy + dz * dz, far = m.layers.mask === 1 << FAR_L;
    if (!far && d2 > D * D * 1.1) m.layers.set(FAR_L); else if (far && d2 < D * D * 0.9) m.layers.set(0); }
}
export function createCityCull(deps) {
  let t = 0, queue = [], qSig = ''; const fst = { t: 0, r: 99, g: null, list: [] };
  return {
    // всеки кадър (perfTune): на ~0,5 s — видимостта; всеки кадър — по няколко сливания от опашката
    tick(dt, high) {
      if (deps.far && deps.far()) farCull(deps, fst, dt); else if (fst.list.length) { for (const [m] of fst.list) m.layers.set(0); fst.list = []; fst.r = 99; }   // ⚡ perf3-far (изключено в движение — всичко обратно)
      if (!deps.on()) return;
      const g = deps.group(); if (!g) return;
      // опашката за сливане: детайлите и сградите (lot.obj) с много части — новите (донесени по-късно модели) влизат сами
      if (qSig !== g.uuid + ':' + g.children.length) { qSig = g.uuid + ':' + g.children.length; queue = g.children.filter(o => !o.userData.merged && (o.userData.detail || o.userData.bld)); }
      // големите групи (магистралата в града, обществените сгради, гарата): userData.mergeWhen() → true (цялата група) или [обекти] — щом са готови
      if (t + dt >= 0.5) for (const o of g.children) { const w = o.userData.mergeWhen; if (!w || o.userData.merged) continue; let r = false; try { r = w(); } catch (e) { } if (!r) continue;
        if (r === true) try { mergeKids(o, 6); } catch (e) { o.userData.merged = true; } else { for (const x of r) try { mergeKids(x, 6); } catch (e) { } o.userData.merged = true; } }
      let budget = 12; while (budget-- > 0 && queue.length) { const o = queue.shift(); if (o.parent === g) try { mergeKids(o); } catch (e) { o.userData.merged = true; } }
      t += dt; if (t < 0.5) return; t = 0;
      if (high) return;   // отдалечено: perfTune така или иначе крие детайлите
      const K = deps.detailK ? deps.detailK() : 1;   /* gfx-lite: „Детайли“ — част от радиуса (0 — без тях) */
      const tg = deps.target(), cd = deps.camDist(), R0 = 125 + Math.max(0, cd - 150) * 0.5, R = R0 * K, Rp = 80 + Math.max(0, cd - 150) * 0.3;   // ~130 м (f1: над ~140 м се печелят най-много кадри); по-далеч само при отдалечена камера
      for (const o of g.children) {
        if (!o.userData.detail) continue;
        const s = sphereOf(o); if (s.r > R0 * 0.5) { o.visible = true; continue; }   // огромното (напр. площад) — винаги (gfx-lite: и при по-малък радиус)
        if (K <= 0) { o.visible = false; continue; }
        const d = Math.hypot(s.x - tg.x, s.z - tg.z) - s.r;
        if (o.visible && d > R * 1.06) o.visible = false; else if (!o.visible && d < R * 0.94) o.visible = true;
      }
      if (deps.deco) { const on = deps.deco(); for (const o of g.children) if (DECO.has(o.name)) o.visible = on; }   /* графиката: „✨ Украса“ */
      for (const m of deps.peds()) { if (!m) continue; const d = Math.hypot(m.position.x - tg.x, m.position.z - tg.z); m.visible = d < Rp; }
    },
  };
}
