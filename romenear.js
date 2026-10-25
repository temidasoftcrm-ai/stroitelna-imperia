// romenear.js — 🇮🇹 rome-bld (f9): Рим отблизо — истинските италиански сгради на местата на фоновите квартали (romeBlocks в cityplan2-3d.js).
// Отдалеч остават фасадите с покривите; около камерата (до R м) всяка фасада се сменя с модел, вписан в нейната рамка (по улицата × в дълбочина,
// лицето — към улицата), така че не излиза на улицата. Моделите са инстанции (по една на част), нощем прозорците светят (изпечената night_ карта).
// it-bld: и в другите италиански градове (генерираните, фоновите сгради на bg-fill) — само кооперациите и само част от тях, сред обикновените.
// Моделите: assets/heavy/rome (Sketchfab CC-BY 4.0 и Quaternius CC0 — CREDITS.txt там) и Sf House (blocks2/pp-sfhouse.glb, CC-BY) — като в lab/plan2-3d.html.
import * as THREE from 'three';

export const ROME_FILES = { 'it-sf-hotel': 'rome/it-sf-hotel.glb', 'it-sf-store': 'rome/it-sf-store.glb', 'it-sf-medkit': 'rome/it-sf-medkit.glb', 'it-sf-palazzo3': 'rome/it-sf-palazzo3.glb',
  'it-townhouse-terracotta': 'rome/it-townhouse-terracotta.glb', 'it-palazzo-small': 'rome/it-palazzo-small.glb', 'pp-sfhouse': 'blocks2/pp-sfhouse.glb' };
export const IT_FILES = { ...ROME_FILES, 'it-corner-shop': 'rome/it-corner-shop.glb', 'it-palazzo-big': 'rome/it-palazzo-big.glb' };   // it-bld: и двете от Quaternius
const IT_COL = [0xd9a066, 0xc8794e, 0xe7c77e];   // римските оттенъци за моделите на Quaternius (светлите стени → охра, теракота, жълто)
// Рим: най-вече истинските италиански (повторенията — по-често); малко от Quaternius за разнообразие
export const ROME_PICK = ['it-sf-hotel', 'it-sf-store', 'it-sf-medkit', 'it-sf-hotel', 'it-sf-palazzo3', 'pp-sfhouse', 'it-sf-medkit', 'pp-sfhouse', 'it-townhouse-terracotta#0', 'it-palazzo-small#0', 'it-townhouse-terracotta#2', 'it-palazzo-small#2'];
// другите италиански градове: ъгловият магазин и големият палацо — най-често (в трите оттенъка), и останалите
export const IT_PICK = ['it-corner-shop#0', 'it-palazzo-big#0', 'it-corner-shop#1', 'it-palazzo-big#2', 'it-corner-shop#2', 'it-palazzo-big#1', 'it-sf-hotel', 'it-sf-palazzo3', 'it-sf-medkit', 'pp-sfhouse', 'it-townhouse-terracotta#1', 'it-palazzo-small#2'];

// подготовка (веднъж): поправки и оттенъци; win(материал) — нощем светва (dayNight.winMats): изпечената карта night_ в GLB
// (Blender: топлите прозорци на случаен принцип ~50 %, партерът — по-често и по-силно; основната текстура — непипната)
const nightOf = (o, win) => o.traverse(m => { if (m.isMesh) for (const mt of [].concat(m.material)) if (mt.emissiveMap) { mt.emissive.setRGB(1, 1, 1); mt.emissiveIntensity = 0; mt.userData.winK = 1.6; win(mt); } });
export function romePrep(M, win) {
  const V = {};
  for (const k of ['it-sf-hotel', 'it-sf-store', 'it-sf-medkit', 'it-sf-palazzo3', 'pp-sfhouse']) { const o = M[k]; if (!o) continue;
    o.traverse(m => { const c = m.isMesh && !m.material.map && m.material.color; if (c && c.r > 0.8 && c.g < 0.25 && c.b < 0.25) m.material.color.setHex(0xd9a066); });   // червеният „заместител“ без текстура → охра
    nightOf(o, win); V[k] = o; }
  for (const k of ['it-townhouse-terracotta', 'it-palazzo-small', 'it-corner-shop', 'it-palazzo-big']) { const src = M[k]; if (!src) continue;
    for (const i of [0, 1, 2]) { const o = src.clone(true); o.traverse(m => { if (!m.isMesh) return; m.material = m.material.clone(); const col = m.material.color, l = col.r * 0.3 + col.g * 0.59 + col.b * 0.11; if (l > 0.55 && !(col.r > col.g * 1.4)) col.lerp(new THREE.Color(IT_COL[i]), 0.75); });
      nightOf(o, win); V[k + '#' + i] = o; } }
  return V;
}

// G — групата на изгледа (координатите на блоковете); BL — romeBlocks ({ list, shown(b), hide(set) }); V — от romePrep
// o: { R — радиус, pick — кои модели, yaws — накъде е лицето спрямо b.rot (Рим: [0]; bg-fill: b.rot е по улицата — [±π/2], по-близката до улица),
//      roads — улиците (за yaws), only(b) — кои сгради, mix — каква част от тях (0…1) }
export function romeNear(G, BL, V, o = {}) {
  const R = o.R || 160, keys = (o.pick || ROME_PICK).filter(k => V[k]), YAW = o.yaws || [0], only = o.only || (() => true), mix = o.mix ?? 1; if (!keys.length) return null;
  const root = new THREE.Group(); root.name = 'romeNear'; root.userData.extShared = true; G.add(root);   // extShared: dispose() на изгледа не пипа общите геометрии
  const P = {};   // по модел: частите (геометрия, материал, матрица в модела) и нормализацията (центърът долу, размерът)
  for (const k of new Set(keys)) { const ob = V[k]; ob.updateMatrixWorld(true); const parts = []; ob.traverse(m => { if (m.isMesh) parts.push({ geo: m.geometry, mat: m.material, local: m.matrixWorld.clone() }); });
    const b = new THREE.Box3().setFromObject(ob), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    P[k] = { key: k, parts, s, base: new THREE.Matrix4().makeTranslation(-c.x, -b.min.y, -c.z), ims: [], cap: 0 }; }
  const ensure = (p, n) => { if (n <= p.cap) return; for (const im of p.ims) { root.remove(im); im.dispose(); }
    p.cap = Math.max(16, Math.ceil(n * 1.5)); p.ims = p.parts.map(q => { const im = new THREE.InstancedMesh(q.geo, q.mat, p.cap); im.castShadow = im.receiveShadow = true; im.frustumCulled = false; im.count = 0; im.userData.local = q.local; im.userData.key = p.key; root.add(im); return im; }); };
  const hash = i => (Math.imul(i + 1, 2654435761) >>> 0);
  // посоката на лицето: от YAW — тази, при която точката пред фасадата е най-близо до улица (мрежа 20 м от точките на улиците; веднъж на сграда)
  const RG = new Map(); if (YAW.length > 1) for (const rd of o.roads || []) for (const p of rd.pts) { const k = Math.floor(p[0] / 20) * 100003 + Math.floor(p[1] / 20); (RG.get(k) || RG.set(k, []).get(k)).push(p[0], p[1]); }
  const roadD = (x, z) => { let m = 1e9; const i = Math.floor(x / 20), j = Math.floor(z / 20); for (let a = i - 2; a <= i + 2; a++) for (let c = j - 2; c <= j + 2; c++) { const q = RG.get(a * 100003 + c); if (q) for (let n = 0; n < q.length; n += 2) m = Math.min(m, (q[n] - x) ** 2 + (q[n + 1] - z) ** 2); } return m; };
  const face = b => { if (b.ry === undefined) { let best = 1e18; b.ry = b.rot + YAW[0]; if (YAW.length > 1) for (const y of YAW) { const r = b.rot + y, d = roadD(b.x + Math.sin(r) * (b.d / 2 + 4), b.z + Math.cos(r) * (b.d / 2 + 4)); if (d < best) { best = d; b.ry = r; } } } return b.ry; };
  const M = new THREE.Matrix4(), W = new THREE.Matrix4(), Q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), S = new THREE.Vector3(), T = new THREE.Vector3(), cam = new THREE.Vector3();
  let at = null, dirty = true;
  const update = camera => {
    cam.copy(camera.position); G.worldToLocal(cam);
    if (!dirty && at && at.distanceTo(cam) < 15) return; at = cam.clone(); dirty = false;
    const near = new Set(), by = {}, R2 = R * R;
    BL.list.forEach((b, i) => { if ((b.x - cam.x) ** 2 + (b.z - cam.z) ** 2 + cam.y * cam.y * 0.25 > R2 || !only(b) || (mix < 1 && (hash(i + 7919) % 1000) / 1000 >= mix) || !BL.shown(b)) return;
      near.add(b); const k = keys[hash(i) % keys.length]; (by[k] ||= []).push(b); });
    for (const k in P) { const p = P[k], L = by[k] || [], out = [];
      // вписан в рамката на фасадата: в дълбочина и до ~1,15 × височината ѝ; тесните (редовите къщи) — по няколко една до друга по улицата,
      // леко разтеглени по ширина (до 1,3 ×), за да запълнят фасадата без празнини; общо — не по-широки от нея (не излизат на улицата)
      for (const b of L) { const sc = Math.min(b.d * 0.96 / p.s.z, b.h * 1.15 / p.s.y, b.w * 0.96 / p.s.x), W1 = p.s.x * sc, n = Math.max(1, Math.floor(b.w * 0.96 / W1)), sx = Math.min(1.3, b.w * 0.96 / (n * W1));
        const ry = face(b), c = Math.cos(ry), s = Math.sin(ry);   // посоката по улицата (локалното +x на модела в света)
        for (let i = 0; i < n; i++) { const u = (i - (n - 1) / 2) * W1 * sx; out.push(W.compose(T.set(b.x + u * c, 0, b.z - u * s), Q.setFromAxisAngle(UP, ry), S.set(sc * sx, sc, sc)).multiply(p.base).clone()); } }   // лицето (+z на модела) — към улицата
      ensure(p, out.length);
      out.forEach((w, j) => { for (const im of p.ims) im.setMatrixAt(j, M.multiplyMatrices(w, im.userData.local)); });
      for (const im of p.ims) { im.count = out.length; im.instanceMatrix.needsUpdate = true; } }
    BL.hide(near);   // фасадите там — скрити
  };
  return { update, dirty() { dirty = true; }, dispose() { for (const k in P) for (const im of P[k].ims) im.dispose(); G.remove(root); } };
}
