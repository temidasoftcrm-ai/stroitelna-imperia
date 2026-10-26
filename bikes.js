// bikes.js — 🚲 bikes (f9): велосипедисти и тротинетки по велоалеите в европейските градове (плана v2).
// Велоалея: червена ивица 0,9 м до бордюра на булевардите, околовръстните и кейовете (в Амстердам и Копенхаген — и по улиците),
// в посоката на движението (дясно/ляво според P.drive). Колоездачите карат по нея, на кръстовището завиват по друга алея
// (плавна дъга през възела), в задънена улица — обратно. Само близо до камерата (R м); нощем по-малко и с фарче/стоп; в дъжд — по-малко.
// Евтино: по една InstancedMesh на част (колело, рамка, торс, глава, крака/ръце — „кости“ с IK на педалите, тротинетка).
// const b = createBikes({ parent, plan() → { P, ox, oz } | null, many() → 0…1, hour(), wet(), night(), on() });  b.update(dt, target);  b.clear()
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { feature } from './lab/feature.js';
import { gfxLevel } from './gfxpresets.js';   // bikes-real: на „Ниско“/„Много ниско“ — процедурните части (без GLB)

const R = 420, MAX = 46, LANE_CLS = new Set(['blvd', 'ring', 'quay']);
const TOPS = [0x2b5fa8, 0xd23b3b, 0xf2b630, 0x2f7d4f, 0xeeeeee, 0x333333, 0xe56b1f, 0x8e44ad, 0x5bc0de], FRAMES = [0x1d1d1d, 0x1d1d1d, 0x1d1d1d, 0x8a1c1c, 0x24489c, 0x2f6f4f, 0xd8d2c4];
const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const bone = (w, d) => new THREE.BoxGeometry(w, 1, d).translate(0, 0.5, 0);   // по +y от началото — мащабът по y = дължината
function frameGeo() {   // рамката на колелото: тръби между точките (напред +z, нагоре y)
  const P = { rh: [0, 0.33, -0.52], fh: [0, 0.33, 0.52], bb: [0, 0.3, 0], st: [0, 0.86, -0.18], hd: [0, 0.92, 0.38], hb: [0, 1.04, 0.36] }, G = [];
  const tube = (a, b, r = 0.025) => { const A = new THREE.Vector3(...P[a]), B = new THREE.Vector3(...P[b]), d = B.clone().sub(A), g = new THREE.CylinderGeometry(r, r, d.length(), 5).translate(0, d.length() / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate(A.x, A.y, A.z); G.push(g); };
  tube('rh', 'bb'); tube('rh', 'st'); tube('bb', 'st'); tube('bb', 'hd'); tube('st', 'hd'); tube('hd', 'fh'); tube('hd', 'hb');
  G.push(new THREE.BoxGeometry(0.5, 0.03, 0.03).translate(0, 1.04, 0.36), new THREE.BoxGeometry(0.12, 0.04, 0.24).translate(0, 0.9, -0.2));   // кормило, седалка
  G.push(new THREE.BoxGeometry(0.16, 0.03, 0.42).translate(0, 0.62, -0.42));   // багажник отзад
  return mergeGeometries(G.map(g => g.toNonIndexed ? g.toNonIndexed() : g));
}
function scooterGeo() {
  const G = [new THREE.BoxGeometry(0.16, 0.05, 0.78).translate(0, 0.12, 0), new THREE.CylinderGeometry(0.022, 0.022, 0.98, 6).translate(0, 0.49, 0).rotateX(-0.18).translate(0, 0.1, 0.36), new THREE.BoxGeometry(0.46, 0.03, 0.03).translate(0, 1.06, 0.53)];
  return mergeGeometries(G.map(g => g.toNonIndexed()));
}

// ---- bikes-real (T1): градско колело с истински пропорции (спици, курбели с плочата, калници, багажник) и колоездач от заоблени „кости“
// (бедро/подбедрица/рамо/предмишница, обувки, длани, каска или коса), наведен напред, с ръце на кормилото; накланя се в завоя.
// Всяка част е една InstancedMesh, както досега; цвят на върха (тъмни гуми/седалка, метал) × цвят на инстанцията. realGeo() — точката за частите от GLB.
const RP = { rh: [0, 0.34, -0.52], fh: [0, 0.34, 0.54], bb: [0, 0.3, 0], st: [0, 0.82, -0.16], sd: [0, 0.95, -0.21], hd: [0, 0.86, 0.39], hb: [0, 1.06, 0.31] };
const PANTS = [0x26303d, 0x1d1d1d, 0x3b4a63, 0x8a7a5c, 0x4b5320, 0x5a5a5a], HAIR = [0x2a1a10, 0x4a2f1b, 0x111111, 0x8a6a3a, 0xc9a25a, 0x777777];
const HELMET = [0xeeeeee, 0x1d1d1d, 0xd23b3b, 0x2b5fa8, 0xf2b630, 0x2f7d4f], SHOE = [0x1d1d1d, 0xeeeeee, 0x5a4636, 0x2b5fa8];
const tint = (g, hex) => { const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const merged = G => mergeGeometries(G.map(g => { g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); return g; }));
function tube(a, b, r, hex = 0xffffff, seg = 6) { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), g = new THREE.CylinderGeometry(r, r, d.length(), seg, 1, true).translate(0, d.length() / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate(A.x, A.y, A.z); return tint(g, hex); }
function realGeo() {
  const P = RP, DK = 0x161616, MET = 0xb8bcc2;
  // колело: ос по x, в равнината y–z, център в 0 (въртим го като инстанция)
  const W = [tint(new THREE.TorusGeometry(0.34, 0.024, 6, 28).rotateY(Math.PI / 2), DK), tint(new THREE.TorusGeometry(0.312, 0.011, 4, 28).rotateY(Math.PI / 2), MET), tint(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 8).rotateZ(Math.PI / 2), MET)];
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; W.push(tube([i % 2 ? 0.03 : -0.03, 0, 0], [0, Math.sin(a) * 0.31, Math.cos(a) * 0.31], 0.0035, MET, 3)); }
  // рамка (бял цвят на върха → оцветява се от инстанцията), вилка, кормило, седалка, калници, багажник, фар, верига
  const F = [tube(P.rh, P.bb, 0.016), tube(P.rh, P.st, 0.014), tube(P.bb, P.st, 0.02), tube(P.bb, P.hd, 0.024), tube(P.st, P.hd, 0.02), tube(P.hd, [0, 0.95, 0.37], 0.022)];
  for (const x of [-0.05, 0.05]) F.push(tube([x, 0.86, 0.39], [x, 0.34, 0.54], 0.012, MET));
  F.push(tube(P.st, P.sd, 0.013, MET), tube([0, 0.95, 0.37], [0, 1.06, 0.33], 0.016, MET), tube([-0.3, 1.06, 0.31], [0.3, 1.06, 0.31], 0.012, MET));
  for (const x of [-1, 1]) F.push(tube([x * 0.22, 1.06, 0.31], [x * 0.33, 1.06, 0.31], 0.019, DK));   // ръкохватките
  F.push(tint(new THREE.BoxGeometry(0.15, 0.05, 0.27).translate(0, 0.96, -0.22), DK), tint(new THREE.BoxGeometry(0.08, 0.04, 0.1).translate(0, 0.965, -0.06), DK));   // седалката с носа
  const fender = (z, a0, a1) => tint(new THREE.TorusGeometry(0.375, 0.03, 4, 10, a1 - a0).rotateZ(a0).rotateY(Math.PI / 2).translate(0, 0.34, z), 0xffffff);   // ъгъл 0 — назад, π/2 — горе
  F.push(fender(-0.52, 0.25, 2.0), fender(0.54, 1.1, 2.8), tint(new THREE.BoxGeometry(0.17, 0.018, 0.4).translate(0, 0.72, -0.5), MET));
  for (const x of [-0.07, 0.07]) F.push(tube([x, 0.72, -0.32], [x, 0.34, -0.52], 0.007, MET, 3));
  F.push(tint(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 8).rotateX(Math.PI / 2).translate(0, 0.98, 0.42), DK), tube([0.07, 0.4, 0], [0.07, 0.38, -0.52], 0.006, DK, 3), tube([0.07, 0.2, 0], [0.07, 0.3, -0.52], 0.006, DK, 3));
  // курбели с плочата и педалите: център в 0 (на каретката), лявата ръка нагоре (+y), дясната надолу — въртим като инстанция около x
  const C = [tint(new THREE.TorusGeometry(0.1, 0.008, 3, 20).rotateY(Math.PI / 2).translate(0.07, 0, 0), MET), tube([0.09, 0, 0], [0.09, -0.17, 0], 0.012, MET, 4), tube([-0.09, 0, 0], [-0.09, 0.17, 0], 0.012, MET, 4)];
  for (const s of [-1, 1]) C.push(tint(new THREE.BoxGeometry(0.1, 0.02, 0.08).translate(-s * 0.14, s * 0.17, 0), DK));
  const cap = new THREE.CapsuleGeometry(0.5, 1, 3, 8).scale(1, 0.5, 1).translate(0, 0.5, 0);   // заоблена „кост“ от y=0 до 1 → мащаб (ширина, дължина, дълбочина)
  const helmet = merged([tint(new THREE.SphereGeometry(0.135, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.52).scale(0.95, 0.85, 1.2), 0xffffff), tint(new THREE.BoxGeometry(0.2, 0.014, 0.07).translate(0, 0.005, 0.16), 0x333333)]);
  return { wheel: merged(W), frame: merged(F), crank: merged(C), limb: cap, head: new THREE.SphereGeometry(0.105, 12, 8).scale(0.92, 1.08, 1), cap: helmet };
}

// ---- bikes-real с моделите (T2): assets/vehicles/bicycle.glb („Low poly bicycle“, Khsuzan) и assets/people/cyclist.glb („Bearded man“, Agor_), CC BY 4.0.
// Колелото: рамка / колело / курбели (с педалите) — по една InstancedMesh, въртят се около оста си. Човекът: твърди части (торс с главата, бедро, подбедрица с ходилото,
// рамо, предмишница с дланта) с начало в ставата и по +y; поставят се с IK като процедурните. Дрехите, кожата, косата и брадата се оцветяват за всеки колоездач:
// текстурата е изпечена в цвят на върха по триъгълници + маска (0 — както е, 1 — горнище, 2 — панталон, 3 — кожа, 4 — коса, 5 — брада: цвят на косата или на кожата = обръснат).
// Ако GLB не се зареди — остават процедурните части от realGeo().
const BK = 1.06, RK = 0.92;   // колелото — малко по-голямо (седалката на 0,87 м), човекът (1,78 м) — малко по-нисък, за да стигне педалите без силно свити колене
const BCOL = { 'Material.005': -1, 'Material.006': 0x2a2a2a, 'Material.007': 0x1e2530, 'Material.008': 0xc8c8c8, 'material_0': 0x333333, 'Material.001': 0x1c1c1c, 'Material.002': 0xb0b4b8, 'Material.003': 0xc0c4c8, 'Material.009': 0x9a9ea4 };
let glbP = null;
function loadBikeGlb() {
  return glbP || (glbP = (async () => {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'), L = new GLTFLoader();
    const [b, c] = await Promise.all([L.loadAsync('assets/vehicles/bicycle.glb'), L.loadAsync('assets/people/cyclist.glb')]);
    b.scene.updateMatrixWorld(true); c.scene.updateMatrixWorld(true);
    // част от колелото в собствената си ос (с подчастите — педалите към курбела), цветовете на материалите — в цвят на върха (-1 = боята на рамката → цвят на инстанцията)
    const bpart = (name, paint) => { const n = b.scene.getObjectByName(name), inv = n.matrixWorld.clone().invert(), G = [];
      n.traverse(o => { if (!o.isMesh) return; const g = o.geometry.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)), k = BCOL[o.material.name] ?? 0x888888; G.push(tint(g, k < 0 ? paint : k)); });
      return { geo: merged(G).scale(BK, BK, BK), at: n.getWorldPosition(new THREE.Vector3()).multiplyScalar(BK) }; };
    const frame = bpart('frame', 0xffffff), wheel = bpart('wheel_front', 0x9aa0a6), crank = bpart('crank', 0x9aa0a6);
    // човекът: цветовете на текстурата по триъгълници
    const cn = n => c.scene.getObjectByName(n), mesh = n => { let m = null; cn(n).traverse(o => { if (o.isMesh && !m) m = o; }); return m; }, img = mesh('torso').material.map.image;
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0); const px = cx.getImageData(0, 0, img.width, img.height).data;
    const tris = g => { g = g.index ? g.toNonIndexed() : g.clone(); const uv = g.attributes.uv, p = g.attributes.position, out = [];
      for (let i = 0; i < p.count; i += 3) { const u = (uv.getX(i) + uv.getX(i + 1) + uv.getX(i + 2)) / 3, w = (uv.getY(i) + uv.getY(i + 1) + uv.getY(i + 2)) / 3;
        const x = Math.min(img.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * img.width))), y = Math.min(img.height - 1, Math.max(0, Math.floor((w - Math.floor(w)) * img.height))), o = (y * img.width + x) * 4;
        out.push({ c: [px[o] / 255, px[o + 1] / 255, px[o + 2] / 255], y: (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, z: (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3 }); }
      return { g, T: out }; };
    const mode = (T, f = () => true) => { const h = new Map(); for (const t of T) if (f(t)) { const k = t.c.map(v => Math.round(v * 12)).join(); let e = h.get(k); if (!e) h.set(k, e = { n: 0, c: t.c }); e.n++; } let best = null; for (const v of h.values()) if (!best || v.n > best.n) best = v; return best ? best.c : [1, 0, 1]; };
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), lum = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    const P = { torso: tris(mesh('torso').geometry), head: tris(mesh('head').geometry), thigh: tris(mesh('thigh_L').geometry), shin: tris(mesh('shin_L').geometry), upper: tris(mesh('upperarm_L').geometry), fore: tris(mesh('forearm_L').geometry) };
    const SH = mode(P.torso.T), PA = mode(P.thigh.T), SK = mode(P.fore.T, t => t.y > 0.33), HR = mode(P.head.T, t => t.y > 0.22);
    const bake = ({ g, T }, kinds, head = false) => { const n = g.attributes.position.count, col = new Float32Array(n * 3), mk = new Float32Array(n), cc = new THREE.Color();
      // най-близкият от еталоните (тоновете на ризата/панталона/кожата/косата в текстурата са по няколко нюанса); маскираните пазят само светлината на нюанса
      const refs = [[1, SH], [2, PA], [3, SK], [4, HR]].filter(([k]) => kinds.includes(k) || k === 3 || (head && k === 4));
      T.forEach((t, i) => { let m = 0, best = 0.45, ref = null; for (const [k, c] of refs) { const d = dist(t.c, c); if (d < best) { best = d; m = k; ref = c; } }
        if (head) {   // косата и брадата са в много нюанси (изпечена светлина — до почти черно): по тон и яркост, не по един еталон; кожата — светлите топли
          const [r0, g0, b0] = t.c, mx = Math.max(r0, g0, b0), mn = Math.min(r0, g0, b0), hue = mx === mn ? 0 : mx === r0 ? 60 * (((g0 - b0) / (mx - mn) + 6) % 6) : mx === g0 ? 60 * ((b0 - r0) / (mx - mn) + 2) : 60 * ((r0 - g0) / (mx - mn) + 4), warm = hue < 50 || hue > 340;
          if (m !== 3 && warm && mx > 0.62 && (mx - mn) / mx < 0.62) { m = 3; ref = SK; } else if (m !== 3 && (mx < 0.2 || (warm && mx < 0.62))) { m = 4; ref = HR; } }
        if (m === 4 && t.y < 0.12 && t.z > 0) m = 5;
        if (m) { const f = Math.max(m >= 4 ? 0.45 : 0.6, Math.min(1.35, lum(t.c) / Math.max(0.05, lum(ref)))); cc.setRGB(f, f, f); } else cc.setRGB(t.c[0], t.c[1], t.c[2], THREE.SRGBColorSpace);
        for (let j = 0; j < 3; j++) { cc.toArray(col, (i * 3 + j) * 3); mk[i * 3 + j] = m; } });
      g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('tintMask', new THREE.BufferAttribute(mk, 1)); g.deleteAttribute('uv'); return g; };
    // главата — в торса (относителното положение от позата в GLB); дланта — свита до юмрук около ръкохватката (не плоска като в T-позата)
    const tN = cn('torso'), headL = tN.matrix.clone().invert().multiply(cn('head').matrix);
    const torso = mergeGeometries([bake(P.torso, [1, 2]), bake(P.head, [], true).applyMatrix4(headL)]);
    const fore = bake(P.fore, [1]), fp = fore.attributes.position;
    for (let i = 0; i < fp.count; i++) { const y = fp.getY(i); if (y > 0.29) fp.setXYZ(i, fp.getX(i) * 0.8, 0.29 + (y - 0.29) * 0.42, 0.02 + (fp.getZ(i) - 0.02) * 0.8); }
    fore.computeVertexNormals();
    const hipL = cn('thigh_L').position.clone().applyMatrix4(tN.matrix.clone().invert());   // тазобедрената става в торса
    return { frame: frame.geo, wheel: wheel.geo, crank: crank.geo, wF: b.scene.getObjectByName('wheel_front').position.clone().multiplyScalar(BK), wR: b.scene.getObjectByName('wheel_rear').position.clone().multiplyScalar(BK), bb: crank.at,
      pedR: b.scene.getObjectByName('pedal_R').position.clone().multiplyScalar(BK), torso, thigh: bake(P.thigh, [2]), shin: bake(P.shin, [2]), upper: bake(P.upper, [1]), fore, headL, hip: hipL,
      helmetL: headL.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.16, -0.01)).multiply(new THREE.Matrix4().makeScale(1.12, 1.12, 1.12)) };
  })().catch(e => { console.warn('bikes-real: GLB', e); return null; }));
}
function riderMat() {   // MeshStandardMaterial + маската: цвят на върха, горнище (цвят на инстанцията), панталон/кожа/коса/брада (атрибути на инстанцията)
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, vertexColors: true });
  m.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float tintMask;\nattribute vec3 aPants;\nattribute vec3 aSkin;\nattribute vec3 aHair;\nattribute vec3 aBeard;')
    .replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\n  vColor = color.xyz * (tintMask < 0.5 ? vec3(1.0) : tintMask < 1.5 ? instanceColor.xyz : tintMask < 2.5 ? aPants : tintMask < 3.5 ? aSkin : tintMask < 4.5 ? aHair : aBeard);\n#endif'); };
  m.customProgramCacheKey = () => 'bikes-real-rider';
  return m;
}

export function createBikes(deps) {
  let G = null, M = null, net = null, netP = null; const riders = [], REAL = feature('bikes-real');   // bikes-real (T1)
  const CAP = REAL ? (/low/.test(gfxLevel()) ? 40 : 90) : MAX, RR = REAL ? 300 : R;   // bikes-real: повече колоездачи по-близо до камерата (потребителят: „да, по-гъсто“); на „Ниско“ — 40
  let glb = null, MG = false; if (REAL && !/low/.test(gfxLevel())) loadBikeGlb().then(g => { glb = g; });   // докато GLB се зареди (или ако не стане) — процедурните части
  const m4 = new THREE.Matrix4(), m4b = new THREE.Matrix4(), m4c = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0), A = new THREE.Vector3(), B = new THREE.Vector3(), D = new THREE.Vector3();
  // ---- мрежата на алеите: за всяка улица с алея и посока — изместената линия до бордюра и точките на възлите
  function build(Pl) {
    const { P } = Pl, all = !!Pl.all, lanes = new Map(), byNode = new Map(), sgn = P.drive === 'L' ? -1 : 1;
    for (const rd of P.roads) {
      if (rd.noCars || rd.oneway || rd.pts.length < 2 || !(LANE_CLS.has(rd.cls) || (all && rd.cls === 'street'))) continue;
      for (const dir of [1, -1]) {
        const pts = dir > 0 ? rd.pts : rd.pts.slice().reverse(), off = (rd.w / 2 - 0.45) * sgn, line = [];
        for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; line.push([pts[i][0] - (b[1] - a[1]) / l * off, pts[i][1] + (b[0] - a[0]) / l * off]); }
        // срез при възлите: колкото е половината от най-широката улица в тях (иначе алеята влиза в кръстовището)
        const from = dir > 0 ? rd.from : rd.to, to = dir > 0 ? rd.to : rd.from, cutOf = n => { const N = P.nodes[n]; return N && N.arms && N.arms.length > 1 ? Math.max(...N.arms.map(a => P.roads[a.road] ? P.roads[a.road].w / 2 + 1.5 : 6)) : 0; };
        const L = [0]; for (let i = 1; i < line.length; i++) L.push(L[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
        const s0 = cutOf(from), s1 = L[L.length - 1] - cutOf(to); if (s1 - s0 < 8) continue;
        const ln = { rd, dir, line, L, s0, s1, from, to, key: rd.id + ':' + dir }; lanes.set(ln.key, ln);
        if (!byNode.has(from)) byNode.set(from, []); byNode.get(from).push(ln);
      }
    }
    return { lanes: [...lanes.values()], byNode, P, ox: Pl.ox, oz: Pl.oz };
  }
  const at = (ln, s) => { const { line, L } = ln; let i = 1; while (i < L.length - 1 && L[i] < s) i++; const a = line[i - 1], b = line[i], t = Math.max(0, Math.min(1, (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1))); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[0] - a[0], b[1] - a[1])]; };
  // ---- червените ивици (една геометрия за целия град)
  function paint(N) {
    const pos = [], idx = []; let n = 0;
    for (const ln of N.lanes) { const sgn = N.P.drive === 'L' ? -1 : 1;
      for (let s = ln.s0; s < ln.s1; s += 4) { const s2 = Math.min(ln.s1, s + 4); for (const ss of [s, s2]) { const [x, z, h] = at(ln, ss), nx = -Math.cos(h) * sgn, nz = Math.sin(h) * sgn;   // навън към бордюра (линията е изместена по (−dz, dx))
          pos.push(x + N.ox - nx * 0.45, 0.07, z + N.oz - nz * 0.45, x + N.ox + nx * 0.45, 0.07, z + N.oz + nz * 0.45); }
        idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); n += 4; } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x9e3b32, roughness: 0.95, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 })); m.receiveShadow = true; m.name = 'bike-lanes'; return m;
  }
  function meshes() {
    const im = (geo, mat, n, cast = true) => { const o = new THREE.InstancedMesh(geo, mat, n); o.count = 0; o.castShadow = cast; o.frustumCulled = false; G.add(o); return o; };
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.6 }), wh = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
    MG = false;
    if (REAL && glb) { MG = true; const vc = (roughness, metalness = 0) => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness, metalness, vertexColors: true }), rm = riderMat();
      const rim = (geo, n) => { geo = geo.clone(); for (const a of ['aPants', 'aSkin', 'aHair', 'aBeard']) geo.setAttribute(a, new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)); return im(geo, rm, n); };
      return { wheel: im(glb.wheel.clone(), vc(0.55, 0.3), CAP * 2), swheel: im(new THREE.TorusGeometry(0.1, 0.03, 5, 12).rotateY(Math.PI / 2), dark, CAP * 2), frame: im(glb.frame.clone(), vc(0.4, 0.2), CAP), crank: im(glb.crank.clone(), vc(0.4, 0.5), CAP),
        scoot: im(scooterGeo(), wh, CAP), torso: rim(glb.torso, CAP), thigh: rim(glb.thigh, CAP * 2), shin: rim(glb.shin, CAP * 2), upper: rim(glb.upper, CAP * 2), fore: rim(glb.fore, CAP * 2), cap: im(realGeo().cap, vc(0.35), CAP),
        lampF: im(new THREE.SphereGeometry(0.045, 6, 4), new THREE.MeshBasicMaterial({ color: 0xfff6d8, toneMapped: false }), CAP, false), lampR: im(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }), CAP, false) }; }
    if (REAL) { const g = realGeo(), vc = (roughness, metalness = 0) => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness, metalness, vertexColors: true });   // същият брой InstancedMesh като преди (10)
      return { wheel: im(g.wheel, vc(0.55, 0.3), CAP * 2), swheel: im(new THREE.TorusGeometry(0.1, 0.03, 5, 12).rotateY(Math.PI / 2), dark, CAP * 2), frame: im(g.frame, vc(0.35, 0.25), CAP), crank: im(g.crank, vc(0.4, 0.5), CAP),
        scoot: im(scooterGeo(), wh, CAP), limb: im(g.limb, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), CAP * 13), head: im(g.head, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 }), CAP * 4),
        cap: im(g.cap, vc(0.35), CAP), lampF: im(new THREE.SphereGeometry(0.045, 6, 4), new THREE.MeshBasicMaterial({ color: 0xfff6d8, toneMapped: false }), CAP, false), lampR: im(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }), CAP, false) }; }
    return {
      wheel: im(new THREE.TorusGeometry(0.33, 0.028, 5, 18).rotateY(Math.PI / 2), dark, CAP * 2), swheel: im(new THREE.TorusGeometry(0.1, 0.03, 5, 12).rotateY(Math.PI / 2), dark, CAP * 2),
      frame: im(frameGeo(), wh, CAP), scoot: im(scooterGeo(), wh, CAP), torso: im(bone(0.34, 0.2), wh, CAP), head: im(new THREE.SphereGeometry(0.115, 8, 6), wh, CAP),
      leg: im(bone(0.12, 0.13), new THREE.MeshStandardMaterial({ color: 0x2c3440, roughness: 0.85 }), CAP * 4), arm: im(bone(0.08, 0.08), wh, CAP * 2),
      lampF: im(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: 0xfff6d8, toneMapped: false }), CAP, false), lampR: im(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }), CAP, false),
    };
  }
  // кост от точка a до b (в местните координати на колелото) → инстанция
  function seg(o, a, b, c, w = 1, d = w) { D.subVectors(b, a); const l = D.length() || 0.001; q.setFromUnitVectors(UP, D.divideScalar(l)); m4b.compose(a, q, sc.set(w, l, d)); o.setMatrixAt(o.count, m4c.multiplyMatrices(m4, m4b)); if (c != null) o.setColorAt(o.count, col.setHex(c)); o.count++; }
  function put(o, x, y, z, c, s = 1) { m4b.makeTranslation(x, y, z); if (s !== 1) m4b.scale(sc.set(s, s, s)); o.setMatrixAt(o.count, m4c.multiplyMatrices(m4, m4b)); if (c != null) o.setColorAt(o.count, col.setHex(c)); o.count++; }
  const knee = (H, F, len, out) => {   // IK с два еднакви сегмента в равнината y–z; коляното — напред (+z)
    D.subVectors(F, H); const d = Math.min(D.length(), len * 2 - 0.001), h = Math.sqrt(Math.max(0, len * len - d * d / 4)); const vy = D.y / (D.length() || 1), vz = D.z / (D.length() || 1);
    let py = -vz, pz = vy; if (pz < 0) { py = -py; pz = -pz; } out.set(H.x + D.x / 2, H.y + D.y / 2 + py * h, H.z + D.z / 2 + pz * h); return out; };
  function spawn(N, tgt, near) {
    const L = N.lanes.filter(ln => { const [x, z] = at(ln, (ln.s0 + ln.s1) / 2); return Math.hypot(x + N.ox - tgt.x, z + N.oz - tgt.z) < (near ? RR * 0.7 : RR); }); if (!L.length) return null;
    const ln = L[(Math.random() * L.length) | 0], scoot = Math.random() < 0.22;
    const pk = a => a[(Math.random() * a.length) | 0];
    return { ln, s: ln.s0 + Math.random() * (ln.s1 - ln.s0), v: scoot ? 5 + Math.random() * 1.5 : 3.8 + Math.random() * 2.2, scoot, cr: Math.random() * 6.28, top: TOPS[(Math.random() * TOPS.length) | 0], fr: FRAMES[(Math.random() * FRAMES.length) | 0], skin: SKIN[(Math.random() * SKIN.length) | 0], tr: null, x: 0, z: 0, h: 0,
      wa: 0, lean: 0, pants: pk(PANTS), hair: pk(HAIR), shoe: pk(SHOE), helmet: Math.random() < 0.45 ? pk(HELMET) : null, beard: Math.random() < 0.35, shorts: Math.random() < 0.3, sleeve: Math.random() < 0.5, tall: 0.94 + Math.random() * 0.12 };   // bikes-real: облекло и ръст
  }
  function next(N, r) {   // на края на алеята: друга алея от същия възел (не обратно, ако има избор) — дъга през кръстовището
    const n = r.ln.to, opts = (N.byNode.get(n) || []).filter(l => l.rd !== r.ln.rd), back = N.lanes.find(l => l.rd === r.ln.rd && l.dir === -r.ln.dir);
    const nl = opts.length ? opts[(Math.random() * opts.length) | 0] : back; if (!nl) return false;
    const [ax, az] = at(r.ln, r.ln.s1), [bx, bz] = at(nl, nl.s0), Nd = N.P.nodes[n], c = Nd ? [Nd.x, Nd.z] : [(ax + bx) / 2, (az + bz) / 2];
    const cx = nl === back ? (ax + bx) / 2 + (c[0] - (ax + bx) / 2) * 0.5 : c[0] * 0.5 + (ax + bx) / 4, cz = nl === back ? (az + bz) / 2 + (c[1] - (az + bz) / 2) * 0.5 : c[1] * 0.5 + (az + bz) / 4;
    const len = Math.hypot(cx - ax, cz - az) + Math.hypot(bx - cx, bz - cz); r.tr = { a: [ax, az], c: [cx, cz], b: [bx, bz], t: 0, len: Math.max(2, len), nl }; return true;
  }
  function step(N, r, dt) {
    let x, z, h;
    if (r.tr) { const T = r.tr; T.t += r.v * 0.8 * dt / T.len; const t = Math.min(1, T.t), m = 1 - t;
      x = m * m * T.a[0] + 2 * m * t * T.c[0] + t * t * T.b[0]; z = m * m * T.a[1] + 2 * m * t * T.c[1] + t * t * T.b[1];
      const dx = 2 * m * (T.c[0] - T.a[0]) + 2 * t * (T.b[0] - T.c[0]), dz = 2 * m * (T.c[1] - T.a[1]) + 2 * t * (T.b[1] - T.c[1]); h = Math.atan2(dx, dz);
      if (T.t >= 1) { r.ln = T.nl; r.s = T.nl.s0; r.tr = null; } }
    else { r.s += r.v * dt; if (r.s >= r.ln.s1) { r.s = r.ln.s1; if (!next(N, r)) return false; } [x, z, h] = at(r.ln, r.s); }
    r.x = x + N.ox; r.z = z + N.oz; let dh = h - r.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); r.h += dh * Math.min(1, dt * 6); r.cr += r.v * dt / 0.33 / 2.4;
    if (dt > 0) { const w = dh * Math.min(1, dt * 6) / dt, L = Math.max(-0.35, Math.min(0.35, Math.atan(r.v * w / 9.8))); r.lean += (L - r.lean) * Math.min(1, dt * 4); r.wa += r.v * dt / 0.34; }   // наклон в завоя, ъгъл на колелата
    return true;
  }
  const H = new THREE.Vector3(), F = new THREE.Vector3(), K = new THREE.Vector3(), Sh = new THREE.Vector3(), Hb = new THREE.Vector3();
  // bikes-real: двузвенно IK (рамо/лакът, бедро/коляно) — свивката е към pole
  const E = new THREE.Vector3(), Pl1 = new THREE.Vector3(), Ak = new THREE.Vector3(), Hn = new THREE.Vector3(), Hp = new THREE.Vector3(), Td = new THREE.Vector3(), eu = new THREE.Euler();
  const ik2 = (a, t, l1, l2, pole, out) => { D.subVectors(t, a); let d = D.length(); D.divideScalar(d || 1); d = Math.min(d, l1 + l2 - 0.001);
    const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - along * along)); E.copy(pole).addScaledVector(D, -pole.dot(D)).normalize();
    return out.copy(a).addScaledVector(D, along).addScaledVector(E, h); };
  function putR(o, x, y, z, ang, c) { m4b.makeRotationX(ang).setPosition(x, y, z); o.setMatrixAt(o.count, m4c.multiplyMatrices(m4, m4b)); if (c != null) o.setColorAt(o.count, col.setHex(c)); o.count++; }
  function drawReal(r, night) {
    q.setFromEuler(eu.set(0, r.h, -r.lean, 'YXZ')); m4.compose(v.set(r.x, 0.06, r.z), q, sc.set(1, 1, 1));
    const k = r.tall, feet = [];
    if (r.scoot) {
      put(M.scoot, 0, 0, 0, 0x2a2d31); put(M.swheel, 0, 0.1, -0.36); put(M.swheel, 0, 0.1, 0.42);
      Hp.set(0, 0.98 * k, -0.04); Td.set(0, Math.cos(0.1), Math.sin(0.1)); feet.push([-0.08, 0.15, 0.12], [0.08, 0.15, -0.16]); Hn.set(0.21, 1.06, 0.53);
    } else {
      put(M.frame, 0, 0, 0, r.fr); putR(M.wheel, 0, 0.34, -0.52, r.wa); putR(M.wheel, 0, 0.34, 0.54, r.wa); putR(M.crank, 0, 0.3, 0, r.cr);
      Hp.set(0, 0.99, -0.2); Td.set(0, Math.cos(0.68), Math.sin(0.68));   // торсът — ~39° напред
      for (const [sx, ph] of [[-0.14, 0], [0.14, Math.PI]]) { const a = r.cr + ph; feet.push([sx, 0.3 + Math.cos(a) * 0.17, Math.sin(a) * 0.17]); }   // педалите (лявата курбела нагоре при cr=0)
      Hn.set(0.27, 1.06, 0.31);
    }
    // таз, торс, глава
    const thigh = 0.44 * k, shin = 0.44 * k, S = Pl1.copy(Hp).addScaledVector(Td, 0.54 * k);
    A.set(-0.11, Hp.y, Hp.z); B.set(0.11, Hp.y, Hp.z); seg(M.limb, A, B, r.pants, 0.2, 0.2);
    A.copy(Hp).addScaledVector(Td, -0.05); B.copy(S).addScaledVector(Td, 0.06); seg(M.limb, A, B, r.top, 0.36, 0.21);
    const hx = S.x, hy = S.y + 0.19 * k, hz = S.z + (r.scoot ? 0.02 : 0.08); put(M.head, hx, hy, hz, r.skin, k);
    if (r.helmet != null) put(M.cap, hx, hy + 0.035, hz - 0.01, r.helmet, k); else put(M.head, hx, hy + 0.025, hz - 0.022, r.hair, 1.04 * k);
    // крака: глезенът над педала, коляното напред и леко навън
    for (const [fx, fy, fz] of feet) { const sx = Math.sign(fx);
      Ak.set(fx * 0.75, fy + 0.07, fz - 0.04); A.set(sx * 0.1, Hp.y, Hp.z); ik2(A, Ak, thigh, shin, E.set(sx * 0.15, 0.2, 1), K);
      seg(M.limb, A, K, r.pants, 0.15); seg(M.limb, K, Ak, r.shorts ? r.skin : r.pants, 0.11);
      A.set(Ak.x, fy + 0.03, fz - 0.09); B.set(Ak.x, fy + 0.02, fz + 0.12); seg(M.limb, A, B, r.shoe, 0.095, 0.08); }
    // ръце: рамото → кормилото, лактите навън и надолу
    for (const sx of [-1, 1]) { A.set(sx * 0.17, S.y - 0.05, S.z); Hn.x = sx * Math.abs(Hn.x); ik2(A, Hn, 0.29 * k, 0.27 * k, E.set(sx * 0.8, -0.6, -0.4), K);
      seg(M.limb, A, K, r.top, 0.1); seg(M.limb, K, Hn, r.sleeve ? r.top : r.skin, 0.085); put(M.head, Hn.x, Hn.y, Hn.z, r.skin, 0.42); }
    const ls = night > 0.2 ? 1 : 0.001; put(M.lampF, 0, r.scoot ? 0.98 : 0.98, r.scoot ? 0.52 : 0.46, null, ls); put(M.lampR, 0, r.scoot ? 0.16 : 0.74, r.scoot ? -0.42 : -0.71, null, ls);
  }
  // с GLB частите: кост от a към b, „предната“ страна на частта (+z в GLB) — към hint; мащаб s (ръстът). Връща матрицата в m4d (за каската върху главата).
  const m4d = new THREE.Matrix4(), BX = new THREE.Vector3(), BY = new THREE.Vector3(), BZ = new THREE.Vector3(), HINT = new THREE.Vector3(0, 1, 1).normalize(), FWD = new THREE.Vector3(0, 0, 1), Sh2 = new THREE.Vector3(), Hip = new THREE.Vector3(), Pd = new THREE.Vector3();
  function part(o, a, b, hint, s, r) {
    BY.subVectors(b, a).normalize(); BZ.copy(hint).addScaledVector(BY, -hint.dot(BY)).normalize(); BX.crossVectors(BY, BZ);
    m4d.makeBasis(BX, BY, BZ).scale(sc.set(s, s, s)).setPosition(a); o.setMatrixAt(o.count, m4c.multiplyMatrices(m4, m4d)); o.setColorAt(o.count, col.setHex(r.top));
    const at = o.geometry.attributes, i3 = o.count * 3; for (const [k, hex] of [['aPants', r.pants], ['aSkin', r.skin], ['aHair', r.hair], ['aBeard', r.beard ? r.hair : r.skin]]) { col.setHex(hex); at[k].array[i3] = col.r; at[k].array[i3 + 1] = col.g; at[k].array[i3 + 2] = col.b; }
    o.count++; }
  function drawGlb(r, night) {
    q.setFromEuler(eu.set(0, r.h, -r.lean, 'YXZ')); m4.compose(v.set(r.x, 0.06, r.z), q, sc.set(1, 1, 1));
    const s = RK * r.tall, feet = [], grips = [];
    if (r.scoot) {
      put(M.scoot, 0, 0, 0, 0x2a2d31); put(M.swheel, 0, 0.1, -0.36); put(M.swheel, 0, 0.1, 0.42);
      Hp.set(0, 0.24 + 0.86 * s, -0.08); Td.set(0, Math.cos(0.35), Math.sin(0.35)); feet.push([-0.07, 0.15, 0.1], [0.07, 0.15, -0.2]); grips.push([-0.21, 1.06, 0.48], [0.21, 1.06, 0.48]);
    } else {
      put(M.frame, 0, 0, 0, r.fr); putR(M.wheel, glb.wR.x, glb.wR.y, glb.wR.z, r.wa); putR(M.wheel, glb.wF.x, glb.wF.y, glb.wF.z, r.wa); putR(M.crank, glb.bb.x, glb.bb.y, glb.bb.z, r.cr);
      Hp.set(0, 0.97, -0.2); Td.set(0, Math.cos(0.38), Math.sin(0.38));   // тазът на седалката, торсът ~22° напред (градско колело)
      const c = Math.cos(r.cr), sn = Math.sin(r.cr), py = glb.pedR.y, pz = glb.pedR.z;
      for (const sx of [1, -1]) feet.push([glb.pedR.x * sx * 0.9, glb.bb.y + (py * c - pz * sn) * sx, glb.bb.z + (py * sn + pz * c) * sx]);   // педалите — по курбела (дясната, −x, нагоре при cr=0)
      for (const sx of [-1, 1]) grips.push([sx * 0.3 * BK, 1.0 * BK, 0.4 * BK]);
    }
    // торс (с главата): „напред“ = гърдите; раменете — в торса
    B.copy(Hp).add(Td); part(M.torso, Hp, B, FWD, s, r); const T0 = m4d.clone();
    if (r.helmet != null) { m4b.multiplyMatrices(T0, glb.helmetL); M.cap.setMatrixAt(M.cap.count, m4c.multiplyMatrices(m4, m4b)); M.cap.setColorAt(M.cap.count, col.setHex(r.helmet)); M.cap.count++; }
    for (const [fx, fy, fz] of feet) { const sx = Math.sign(fx);
      Hip.set(sx * Math.abs(glb.hip.x), glb.hip.y, glb.hip.z).applyMatrix4(T0); Ak.set(fx, fy + 0.085, fz - 0.07);   // глезенът — над педала и малко назад (педалът под предната част на ходилото)
      ik2(Hip, Ak, 0.456 * s, 0.442 * s, E.set(sx * 0.15, 0.2, 1), K); part(M.thigh, Hip, K, HINT, s, r); part(M.shin, K, Ak, HINT, s, r); }
    for (const [gx, gy, gz] of grips) { const sx = Math.sign(gx);
      Sh2.set(sx * 0.178, 0.385, 0).applyMatrix4(T0); Hn.set(gx, gy + 0.01, gz - 0.06);   // китката — точно зад ръкохватката, юмрукът е около нея
      ik2(Sh2, Hn, 0.275 * s, 0.29 * s, E.set(sx * 0.7, -0.5, -0.6), K); part(M.upper, Sh2, K, HINT, s, r); part(M.fore, K, Hn, HINT, s, r); }
    const ls = night > 0.2 ? 1 : 0.001; if (r.scoot) { put(M.lampF, 0, 0.98, 0.52, null, ls); put(M.lampR, 0, 0.16, -0.42, null, ls); }
    else { put(M.lampF, 0, 0.86 * BK, glb.wF.z - 0.13, null, ls); put(M.lampR, 0, glb.wR.y + 0.26, glb.wR.z - 0.27, null, ls); }   // фарът — на главината под кормилото, стопът — на калника зад задното колело
  }
  function draw(r, night) {
    if (REAL && MG) return drawGlb(r, night);
    if (REAL) return drawReal(r, night);
    m4.compose(v.set(r.x, 0.06, r.z), q.setFromAxisAngle(UP, r.h), sc.set(1, 1, 1));
    if (r.scoot) {
      put(M.scoot, 0, 0, 0, 0x2a2d31); put(M.swheel, 0, 0.1, -0.36); put(M.swheel, 0, 0.1, 0.42);
      H.set(0, 1.0, -0.02); Sh.set(0, 1.5, 0.04); for (const sx of [-0.1, 0.1]) { F.set(sx, 0.15, sx > 0 ? 0.12 : -0.14); A.set(sx, 1.0, -0.02); K.set(sx, 0.57, (F.z + A.z) / 2 + 0.03); seg(M.leg, A, K); seg(M.leg, K, F); }
      Hb.set(0, 1.06, 0.5);
    } else {
      put(M.frame, 0, 0, 0, r.fr); put(M.wheel, 0, 0.33, -0.52); put(M.wheel, 0, 0.33, 0.52);
      H.set(0, 0.9, -0.2); Sh.set(0, 1.42, 0.08);
      for (const [sx, ph] of [[-0.1, 0], [0.1, Math.PI]]) { const a = r.cr + ph; F.set(sx, 0.3 + Math.cos(a) * 0.17, Math.sin(a) * 0.17); A.set(sx, 0.9, -0.2); knee(A, F, 0.43, K); K.x = sx; seg(M.leg, A, K); seg(M.leg, K, F); }
      Hb.set(0, 1.04, 0.34);
    }
    seg(M.torso, H, Sh, r.top); put(M.head, Sh.x, Sh.y + 0.17, Sh.z + 0.03, r.skin);
    for (const sx of [-0.17, 0.17]) { A.set(sx, Sh.y - 0.05, Sh.z); B.set(sx * 1.3, Hb.y, Hb.z); seg(M.arm, A, B, r.top); }
    const ls = night > 0.2 ? 1 : 0.001; put(M.lampF, 0, r.scoot ? 0.98 : 0.95, r.scoot ? 0.52 : 0.42, null, ls); put(M.lampR, 0, r.scoot ? 0.16 : 0.66, r.scoot ? -0.42 : -0.64, null, ls);
  }
  function update(dt, tgt) {
    const Pl = deps.on() ? deps.plan() : null;
    if (!Pl || !tgt) { clear(); return; }
    if (netP !== Pl.P) { clear(); netP = Pl.P; net = build(Pl); G = new THREE.Group(); G.name = 'bikes'; deps.parent().add(G); if (net.lanes.length) G.add(paint(net)); M = meshes(); }
    if (!net.lanes.length) return;
    if (REAL && glb && !MG) { for (const o of Object.values(M)) { G.remove(o); o.geometry.dispose(); } M = meshes(); }   // bikes-real: GLB дойде — сменяме частите
    const h = deps.hour(), tod = h < 6 || h > 23 ? 0.12 : h < 7 || h > 21 ? 0.45 : 1, want = Math.round(CAP * deps.many() * tod * (deps.wet() ? 0.35 : 1));
    const d = Math.min(0.1, dt);
    for (let i = riders.length - 1; i >= 0; i--) { const r = riders[i]; if (!step(net, r, d) || Math.hypot(r.x - tgt.x, r.z - tgt.z) > RR * 1.25 || i >= want) riders.splice(i, 1); }
    if (riders.length < want) { const r = spawn(net, tgt, riders.length > 0); if (r) { step(net, r, 0); r.h = at(r.ln, r.s)[2]; riders.push(r); } }
    if (REAL && riders[0] && riders[0].scoot) { const i = riders.findIndex(r => !r.scoot); if (i > 0) [riders[0], riders[i]] = [riders[i], riders[0]]; }   // демото (bikeLook) гледа първия — нека е колоездач
    for (const o of Object.values(M)) o.count = 0;
    const night = deps.night(); for (const r of riders) draw(r, night);
    for (const o of Object.values(M)) { o.instanceMatrix.needsUpdate = true; if (o.instanceColor) o.instanceColor.needsUpdate = true; if (o.geometry.attributes.aPants) for (const k of ['aPants', 'aSkin', 'aHair', 'aBeard']) o.geometry.attributes[k].needsUpdate = true; }
  }
  function clear() { riders.length = 0; if (G) { G.parent && G.parent.remove(G); G.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } G = null; M = null; net = null; netP = null; }
  return { update, clear, info: () => ({ lanes: net ? net.lanes.length : 0, riders: riders.length, scoot: riders.filter(r => r.scoot).length, at: riders.slice(0, 3).map(r => [Math.round(r.x), Math.round(r.z)]) }), riders: () => riders };
}
