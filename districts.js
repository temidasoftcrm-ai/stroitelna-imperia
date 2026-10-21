// districts.js — 🏡 кварталите с дворове и паркове (Лабораторията → districts-look): градовете с плана v2.
// 1) Анализ на земята (растер 2 м): улици с тротоарите, отключени парцели, резерв (парцелите на следващите квартали), големите места,
//    вода и отпечатъците на сградите — останалото е свободна земя; диагностиката я показва в цвят (diag).
// 2) Около всяка готова сграда — двор по истинския ѝ размер: къща — ограда, дървета, навес с кола; блок — общ двор с пейки,
//    площадка, паркинг, жив плет; офис — павиран площад, лехи, стойки за колела, кратък достъп за коли.
// 3) Голямата свободна земя вътре в квартала — парк с две пресичащи се алеи (и пътека до тротоара), детска площадка и игрище;
//    малките остатъци — ниски храсти. Появяват се постепенно: паркът — когато наоколо има готови сгради, площадката и игрището — при повече.
//    Резервът, улиците (и разширението им) и входовете остават свободни. Без симулация — само се прерисува, когато се смени застрояването.
// Всичко — InstancedMesh и слети мешове; дребните неща се крият отдалеч (update).
import * as THREE from 'three';

const CELL = 2, FREE = 0, ROAD = 1, WATER = 2, LOT = 3, RES = 4, BIG = 5, BLD = 6, OUT = 7;
const PARK_MIN = 1200, PARK_DT = 6;   // м²; м — най-малкият парк (площ и „дебелина“: половината от най-тясното място)
const inPoly = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
const hash = n => ((Math.imul(n | 0, 2654435761) >>> 0) / 4294967296);

// рамката на парцела: f — към улицата (lot.rot), u — по улицата; точка = парцел + f·t + u·s
export const lotFrame = l => { const r = l.rot || 0, fx = Math.sin(r), fz = Math.cos(r); return { r, fx, fz, ux: fz, uz: -fx, at: (t, s) => [l.x + fx * t + fz * s, l.z + fz * t - fx * s] }; };
// отпечатъкът на сградата в рамката на парцела (както пътеките lot-paths): t0…t1 към улицата, s0…s1 по улицата
export function footprint(l, o) {
  const F = lotFrame(l), r0 = o.rotation.y; o.rotation.y = r0 - F.r; o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o); o.rotation.y = r0; o.updateMatrixWorld(true);
  const ox = o.position.x - l.x, oz = o.position.z - l.z, off = ox * F.fx + oz * F.fz, offU = ox * F.ux + oz * F.uz;
  return { t0: b.min.z - o.position.z + off, t1: b.max.z - o.position.z + off, s0: b.min.x - o.position.x + offU, s1: b.max.x - o.position.x + offU, h: b.max.y - b.min.y };
}

// ---- анализът: растерът на града (неизменната част — улици, вода, парцели — се пази за плана и броя отключени парцели)
const baseCache = new WeakMap();
export function analyze(P, lots) {
  const B = P.boundary, p2 = P.p2, [ox, oz] = P.offset; let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  for (const [x, z] of B) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const NX = Math.ceil((x1 - x0) / CELL), NZ = Math.ceil((z1 - z0) / CELL), bc = baseCache.get(P), base = bc && bc.n === lots.length ? bc.g : null, g = base ? base.slice() : new Uint8Array(NX * NZ);
  const cx = i => x0 + (i + 0.5) * CELL, cz = j => z0 + (j + 0.5) * CELL;
  if (!base) for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const x = cx(i), z = cz(j); g[j * NX + i] = !inPoly(x, z, B) ? OUT : P.waterAt && P.waterAt(x, z) ? WATER : FREE; }
  const box = (xa, za, xb, zb, fn) => { const i0 = Math.max(0, Math.floor((xa - x0) / CELL)), i1 = Math.min(NX - 1, Math.floor((xb - x0) / CELL)), j0 = Math.max(0, Math.floor((za - z0) / CELL)), j1 = Math.min(NZ - 1, Math.floor((zb - z0) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(j * NX + i, cx(i), cz(j)); };
  const seg = (ax, az, bx, bz, r, code) => { const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    box(Math.min(ax, bx) - r, Math.min(az, bz) - r, Math.max(ax, bx) + r, Math.max(az, bz) + r, (k, x, z) => { if (g[k] === OUT) return; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)); if (Math.hypot(x - ax - dx * t, z - az - dz * t) <= r) g[k] = code; }); };
  const rect = (L, code, ok = null) => { const F = lotFrame(L), R = Math.hypot(L.w, L.d) / 2;
    box(L.x - R, L.z - R, L.x + R, L.z + R, (k, x, z) => { if (g[k] === OUT || (ok && !ok(g[k]))) return; const dx = x - L.x, dz = z - L.z; if (Math.abs(dx * F.fx + dz * F.fz) <= L.d / 2 && Math.abs(dx * F.ux + dz * F.uz) <= L.w / 2) g[k] = code; }); };
  // улиците с тротоарите и ивицата до парцелите (1,2 м) — там е и бъдещото разширение
  if (!base) for (const rd of p2.roads) { const r = rd.w / 2 + (rd.walk || 0) + 1.2; for (let k = 1; k < rd.pts.length; k++) seg(rd.pts[k - 1][0] + ox, rd.pts[k - 1][1] + oz, rd.pts[k][0] + ox, rd.pts[k][1] + oz, r, ROAD); }
  if (!base) for (const rr of p2.rounds || []) { const r = (rr.outer || rr.r || 10) + 1.5; box(rr.x + ox - r, rr.z + oz - r, rr.x + ox + r, rr.z + oz + r, (k, x, z) => { if (g[k] !== OUT && Math.hypot(x - rr.x - ox, z - rr.z - oz) <= r) g[k] = ROAD; }); }
  const byP2 = new Map(lots.filter(l => l.p2 != null).map(l => [l.p2, l]));
  if (!base) { for (const L of p2.lots) rect({ ...L, x: L.x + ox, z: L.z + oz }, L.big || L.lm ? BIG : byP2.has(L.id) ? LOT : RES, c => c !== ROAD); baseCache.set(P, { n: lots.length, g: g.slice() }); }
  // отпечатъците на готовите сгради
  const fps = new Map();
  for (const l of lots) if (l.obj && l.built && l.plan) { const f = footprint(l, l.obj); fps.set(l.id, f); const F = lotFrame(l), [x, z] = F.at((f.t0 + f.t1) / 2, (f.s0 + f.s1) / 2); rect({ x, z, w: f.s1 - f.s0, d: f.t1 - f.t0, rot: F.r }, BLD, c => c !== ROAD); }
  // свободната земя: свързани области (4 съседа) и разстоянието до края (chamfer, м)
  const N = NX * NZ, dt = new Float32Array(N), comp = new Int32Array(N).fill(-1), comps = [];
  for (let k = 0; k < N; k++) dt[k] = g[k] === FREE ? 1e9 : 0;
  const D1 = CELL, D2 = CELL * Math.SQRT2;
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const k = j * NX + i; if (!dt[k]) continue; let d = dt[k];
    if (i > 0) d = Math.min(d, dt[k - 1] + D1); if (j > 0) { d = Math.min(d, dt[k - NX] + D1); if (i > 0) d = Math.min(d, dt[k - NX - 1] + D2); if (i < NX - 1) d = Math.min(d, dt[k - NX + 1] + D2); } if (i === 0 || j === 0 || i === NX - 1 || j === NZ - 1) d = Math.min(d, D1); dt[k] = d; }
  for (let j = NZ - 1; j >= 0; j--) for (let i = NX - 1; i >= 0; i--) { const k = j * NX + i; if (!dt[k]) continue; let d = dt[k];
    if (i < NX - 1) d = Math.min(d, dt[k + 1] + D1); if (j < NZ - 1) { d = Math.min(d, dt[k + NX] + D1); if (i < NX - 1) d = Math.min(d, dt[k + NX + 1] + D2); if (i > 0) d = Math.min(d, dt[k + NX - 1] + D2); } dt[k] = d; }
  const st = [];
  for (let k0 = 0; k0 < N; k0++) { if (g[k0] !== FREE || comp[k0] >= 0) continue; const id = comps.length, cells = []; let sx = 0, sz = 0, mx = 0, road = 0; comp[k0] = id; st.push(k0);
    while (st.length) { const k = st.pop(), i = k % NX, j = (k - i) / NX; cells.push(k); sx += cx(i); sz += cz(j); if (dt[k] > mx) mx = dt[k];
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= NX || b >= NZ) continue; const q = b * NX + a; if (g[q] === ROAD) road = 1; if (g[q] === FREE && comp[q] < 0) { comp[q] = id; st.push(q); } } }
    comps.push({ id, cells, area: cells.length * CELL * CELL, x: sx / cells.length, z: sz / cells.length, maxDt: mx, road }); }
  // статистиката (м²)
  const area = {}; for (let k = 0; k < N; k++) area[g[k]] = (area[g[k]] || 0) + CELL * CELL;
  return { NX, NZ, x0, z0, g, dt, comp, comps, area, fps, cx, cz, at: (x, z) => { const i = Math.floor((x - x0) / CELL), j = Math.floor((z - z0) / CELL); return i < 0 || j < 0 || i >= NX || j >= NZ ? -1 : j * NX + i; } };
}

// ---- набор: кутии (InstancedMesh по цвят), плоски настилки (слети), дървета, храсти, коли (части на моделите — InstancedMesh)
const FLAT = { plaza: [0xcfc8bb, 0.03], pavers: [0xb59f86, 0.032], asphalt: [0x4a4d52, 0.034], gravel: [0xd9cdb0, 0.036], rubber: [0xb5523b, 0.04], turf: [0x4f9a45, 0.04], line: [0xf2f2f2, 0.05], sand: [0xe6d29a, 0.052], soil: [0x5b4330, 0.05], walk: [0xbdb6a8, 0.045], drive: [0x55585e, 0.045] };
const partCache = new WeakMap();
function protoParts(src, norm) {
  const key = src, c = partCache.get(key); if (c && c.norm === norm) return c.parts;
  src.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(src), k = norm === 'h' ? 1 / ((b.max.y - b.min.y) || 1) : norm === 'w' ? 1 / (Math.max(b.max.x - b.min.x, b.max.z - b.min.z) || 1) : 1, parts = [];
  src.traverse(o => { if (!o.isMesh || !o.visible) return; const ms = [].concat(o.material); if (norm == null && ms.some(m => m.transparent || (m.emissive && m.emissive.getHex() && m.emissiveIntensity > 0.5))) return;   // колите (norm null) — без фаровете и лъчите; листата на дърветата и храстите са прозрачни — остават
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld); g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); g.scale(k, k, k); parts.push([g, o.material]); });
  partCache.set(key, { norm, parts }); return parts;
}
function Kit() {
  const boxes = new Map(), flats = new Map(), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const K = { trees: [], bushes: [], cars: [],
    box(col, x, y, z, sx, sy, sz, yaw = 0, pitch = 0, small = true) { const key = col + (small ? 's' : 'b'); if (!boxes.has(key)) boxes.set(key, { col, small, m: [] }); boxes.get(key).m.push(M.compose(v.set(x, y, z), q.setFromEuler(e.set(pitch, yaw, 0, 'YXZ')), s.set(sx, sy, sz)).clone()); },
    flat(kind, pts) { if (!flats.has(kind)) flats.set(kind, []); flats.get(kind).push(pts); },
    // в рамката на парцела: кутия с център (t, s), размери lt (към улицата) × ls (по улицата) × h
    obox(F, col, t, s, y, lt, ls, h, small = true) { const [x, z] = F.at(t, s); K.box(col, x, y, z, ls, h, lt, F.r, 0, small); },
    orect(F, kind, ta, tb, sa, sb) { if (tb - ta < 0.2 || sb - sa < 0.2) return; K.flat(kind, [F.at(ta, sa), F.at(ta, sb), F.at(tb, sb), F.at(tb, sa)]); },
    build(o) { const G = new THREE.Group(), small = new THREE.Group(); G.add(small); G.userData.small = small; const geoms = [];
      const unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); geoms.push(unit);
      for (const { col, small: sm, m } of boxes.values()) { const I = new THREE.InstancedMesh(unit, new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 }), m.length); m.forEach((x, i) => I.setMatrixAt(i, x)); I.castShadow = !sm; I.receiveShadow = true; I.frustumCulled = false; (sm ? small : G).add(I); }
      for (const [kind, list] of flats) { const [col, y] = FLAT[kind], pos = new Float32Array(list.length * 12), idx = [];
        list.forEach((p, i) => { p.forEach(([x, z], j) => pos.set([x, y, z], i * 12 + j * 3)); const b = i * 4; idx.push(b, b + 2, b + 1, b, b + 3, b + 2); });
        const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.BufferAttribute(pos, 3)); ge.setIndex(idx); ge.computeVertexNormals(); geoms.push(ge);
        const m = new THREE.Mesh(ge, new THREE.MeshStandardMaterial({ color: col, roughness: 0.95, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })); m.receiveShadow = true; m.matrixAutoUpdate = false; G.add(m); }
      const inst = (parts, list, mat, grp) => { if (!list.length) return; for (const [ge, mt] of parts) { const I = new THREE.InstancedMesh(ge, mt, list.length); list.forEach((it, i) => I.setMatrixAt(i, mat(it, i))); I.castShadow = grp === G; I.receiveShadow = true; I.frustumCulled = false; grp.add(I); } };
      const sc = new THREE.Vector3();
      // дървета: истинските (o.treeProtos — височина h) или кълбо на ствол
      const tp = (o.treeProtos || []).map(p => protoParts(p, 'h')).filter(p => p.length);
      if (tp.length) tp.forEach((parts, vi) => inst(parts, K.trees.filter((_, i) => i % tp.length === vi), ([x, z, h], i) => M.compose(v.set(x, 0, z), q.setFromAxisAngle(v.clone().set(0, 1, 0), hash(i + vi * 97) * 6.28), sc.set(h, h, h)).clone(), G));
      else if (K.trees.length) { const tg = new THREE.CylinderGeometry(0.2, 0.3, 1, 6).translate(0, 0.5, 0), cg = new THREE.IcosahedronGeometry(1, 0); geoms.push(tg, cg);
        inst([[tg, new THREE.MeshStandardMaterial({ color: 0x6b4a2e })]], K.trees, ([x, z, h]) => M.compose(v.set(x, 0, z), q.identity(), sc.set(1, h * 0.4, 1)).clone(), G);
        inst([[cg, new THREE.MeshStandardMaterial({ color: 0x5d8a3e, flatShading: true })]], K.trees, ([x, z, h]) => M.compose(v.set(x, h * 0.62, z), q.identity(), sc.set(h * 0.33, h * 0.3, h * 0.33)).clone(), G); }
      // храсти: истинските (o.bushProtos — най-широката страна s) или зелено кълбо
      const bp = (o.bushProtos || []).map(p => protoParts(p, 'w')).filter(p => p.length);
      if (bp.length) bp.forEach((parts, vi) => inst(parts, K.bushes.filter((_, i) => i % bp.length === vi), ([x, z, s2], i) => M.compose(v.set(x, 0, z), q.setFromAxisAngle(v.clone().set(0, 1, 0), hash(i * 3 + vi) * 6.28), sc.set(s2, s2, s2)).clone(), small));
      else if (K.bushes.length) { const bg = new THREE.IcosahedronGeometry(0.5, 0).translate(0, 0.4, 0); geoms.push(bg); inst([[bg, new THREE.MeshStandardMaterial({ color: 0x4f7f35, flatShading: true })]], K.bushes, ([x, z, s2]) => M.compose(v.set(x, 0, z), q.identity(), sc.set(s2, s2 * 0.8, s2)).clone(), small); }
      // паркираните коли — истинските модели (o.cars: [име, обект]), в истински размер
      const cp = (o.cars || []).map(([n, p]) => [n, protoParts(p, null)]).filter(([, p]) => p.length);
      if (cp.length) cp.forEach(([, parts], vi) => inst(parts, K.cars.filter((_, i) => i % cp.length === vi), ([x, z, yaw]) => M.compose(v.set(x, 0, z), q.setFromAxisAngle(v.clone().set(0, 1, 0), yaw), sc.set(1, 1, 1)).clone(), small));
      G.userData.dispose = () => geoms.forEach(x => x.dispose());
      return G; } };
  return K;
}

// ---- пейка (кутии): седалка, облегалка, крака — гледа към yaw
function bench(K, x, z, yaw) { const c = Math.cos(yaw), s = Math.sin(yaw), P = (a, b) => [x + c * a + s * b, z - s * a + c * b];   // a — по пейката, b — напред
  { const [px, pz] = P(0, 0); K.box(0x8a5a32, px, 0.42, pz, 1.6, 0.06, 0.42, yaw); } { const [px, pz] = P(0, -0.22); K.box(0x8a5a32, px, 0.5, pz, 1.6, 0.4, 0.05, yaw); }
  for (const a of [-0.7, 0.7]) { const [px, pz] = P(a, 0); K.box(0x2e3136, px, 0, pz, 0.06, 0.42, 0.4, yaw); } }
// детска площадка w × d (по осите a, b): гумена настилка, пързалка, люлка, пясъчник, ниска ограда
function playground(K, cx, cz, ang, w, d) { const ca = Math.cos(ang), sa = Math.sin(ang), P = (a, b) => [cx + ca * a - sa * b, cz + sa * a + ca * b], yaw = -ang;   // yaw: локалното +x на кутията — по оста a
  K.flat('rubber', [P(-w / 2, -d / 2), P(w / 2, -d / 2), P(w / 2, d / 2), P(-w / 2, d / 2)]);
  const bx = (col, a, b, y, la, lb, h) => { const [x, z] = P(a, b); K.box(col, x, y, z, la, h, lb, yaw); };
  // пързалка: кула 1,2 × 1,2 и наклонен улей
  bx(0x3a78c2, -w / 4, -d / 4, 0, 1.2, 1.2, 1.5); bx(0xe8c13a, -w / 4, -d / 4, 1.5, 1.4, 1.4, 0.12); { const [x, z] = P(-w / 4 + 2.05, -d / 4); K.box(0xd8463a, x, 0.7, z, 0.6, 0.05, 3.2, Math.atan2(ca, sa), 0.45); }   // улеят: дългата страна по a, високият край — към кулата
  // люлка: две стойки и греда, две седалки
  for (const a of [w / 4 - 1.6, w / 4 + 1.6]) bx(0x6a6f76, a, d / 4, 0, 0.1, 0.1, 2.2); bx(0x6a6f76, w / 4, d / 4, 2.2, 3.4, 0.12, 0.12);
  for (const a of [w / 4 - 0.7, w / 4 + 0.7]) { bx(0x2a2a2a, a, d / 4, 0.45, 0.45, 0.2, 0.05); bx(0x9aa0a6, a, d / 4, 0.5, 0.03, 0.03, 1.7); }
  // пясъчник
  { for (const [a, b, la, lb] of [[0, -1.3, 2.8, 0.15], [0, 1.3, 2.8, 0.15], [-1.3, 0, 0.15, 2.8], [1.3, 0, 0.15, 2.8]]) bx(0x9a6a3a, w / 4 + a, -d / 4 + b, 0, la, lb, 0.3); K.flat('sand', [P(w / 4 - 1.25, -d / 4 - 1.25), P(w / 4 + 1.25, -d / 4 - 1.25), P(w / 4 + 1.25, -d / 4 + 1.25), P(w / 4 - 1.25, -d / 4 + 1.25)]); }
  // ниска ограда (стълбчета и перила) с отвор отпред
  const rail = (a0, b0, a1, b1) => { const L = Math.hypot(a1 - a0, b1 - b0), n = Math.max(1, Math.round(L / 2)); for (let k = 0; k <= n; k++) bx(0x2f7a4a, a0 + (a1 - a0) * k / n, b0 + (b1 - b0) * k / n, 0, 0.08, 0.08, 0.9); const [x, z] = P((a0 + a1) / 2, (b0 + b1) / 2), [xa, za] = P(a0, b0), [xb, zb] = P(a1, b1); K.box(0x2f7a4a, x, 0.82, z, 0.06, 0.08, L, Math.atan2(xb - xa, zb - za)); };
  rail(-w / 2, -d / 2, w / 2, -d / 2); rail(-w / 2, d / 2, -1, d / 2); rail(1, d / 2, w / 2, d / 2); rail(-w / 2, -d / 2, -w / 2, d / 2); rail(w / 2, -d / 2, w / 2, d / 2);
}
// малко игрище w × d: изкуствена трева, бели линии, две врати, висока мрежа (стълбове)
function pitch(K, cx, cz, ang, w, d) { const ca = Math.cos(ang), sa = Math.sin(ang), P = (a, b) => [cx + ca * a - sa * b, cz + sa * a + ca * b];
  const R = (kind, a0, b0, a1, b1) => K.flat(kind, [P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)]);
  R('turf', -w / 2, -d / 2, w / 2, d / 2); const lw = 0.1, iw = w / 2 - 1, id = d / 2 - 1;
  R('line', -iw, -id, iw, -id + lw); R('line', -iw, id - lw, iw, id); R('line', -iw, -id, -iw + lw, id); R('line', iw - lw, -id, iw, id); R('line', -lw / 2, -id, lw / 2, id);
  for (const sg of [-1, 1]) { for (const b of [-1.5, 1.5]) { const [x, z] = P(sg * iw, b); K.box(0xffffff, x, 0, z, 0.1, 2, 0.1); } const [x, z] = P(sg * iw, 0); K.box(0xffffff, x, 2, z, 0.1, 0.1, 3.1, Math.atan2(-sa, ca)); }   // гредата — по оста b
  for (const [a0, b0, a1, b1] of [[-w / 2, -d / 2, w / 2, -d / 2], [-w / 2, d / 2, w / 2, d / 2], [-w / 2, -d / 2, -w / 2, d / 2], [w / 2, -d / 2, w / 2, d / 2]]) { const L = Math.hypot(a1 - a0, b1 - b0), n = Math.max(1, Math.round(L / 3)); for (let k = 0; k <= n; k++) { const [x, z] = P(a0 + (a1 - a0) * k / n, b0 + (b1 - b0) * k / n); K.box(0x3a3f45, x, 0, z, 0.08, 3, 0.08); } }
}

// ---- дворовете
const isOffice = n => /skyscraper|^sf-sky|^building-[a-h](@|$)|office|^sf-blk-(modoffice|jade)/.test(n);
function yard(K, l, f, kind, o) {
  const F = lotFrame(l), W = l.w / 2, D = l.d / 2, t0 = Math.max(-D, f.t0), t1 = Math.min(D, f.t1), s0 = Math.max(-W, f.s0), s1 = Math.min(W, f.s1), uc = (s0 + s1) / 2;
  const front = D - t1, back = t0 + D, left = s0 + W, right = W - s1, h = hash(l.id * 13 + 5), walkEnd = D + 2.3;   // walkEnd — до тротоара (1,5 м + 0,8, както lot-paths)
  const gaps = [];   // отворите в оградата отпред: [s0, s1]
  const entry = (kd, hw) => { gaps.push([uc - hw - 0.3, uc + hw + 0.3]); if (!o.lotPaths) K.orect(F, kd, t1 - 0.3, walkEnd, uc - hw, uc + hw); };
  const fence = (col, hgt, sa, sb, t, along) => {   // по улицата (along) или по дълбочината
    const L = Math.abs(sb - sa); if (L < 0.5) return; const n = Math.max(1, Math.round(L / 2.4));
    for (let k = 0; k <= n; k++) { const s = sa + (sb - sa) * k / n; along ? K.obox(F, col, t, s, 0, 0.1, 0.1, hgt) : K.obox(F, col, s, t, 0, 0.1, 0.1, hgt); }
    for (const y of hgt > 1.2 ? [hgt - 0.1] : [0.3, hgt - 0.12]) along ? K.obox(F, col, t, (sa + sb) / 2, y, 0.05, L, 0.07) : K.obox(F, col, (sa + sb) / 2, t, y, L, 0.05, 0.07); };
  const frontFence = (col, hgt) => { let a = -W + 0.15; for (const [g0, g1] of gaps.sort((p, q) => p[0] - q[0])) { fence(col, hgt, a, g0, D - 0.15, true); a = g1; } fence(col, hgt, a, W - 0.15, D - 0.15, true); };
  const hedge = (sa, sb, t, along) => { const L = Math.abs(sb - sa); if (L < 0.8) return; along ? K.obox(F, 0x3f6b2e, t, (sa + sb) / 2, 0, 0.7, L, 0.95) : K.obox(F, 0x3f6b2e, (sa + sb) / 2, t, 0, L, 0.7, 0.95); };
  const tree = (t, s, hh) => { const [x, z] = F.at(t, s); K.trees.push([x, z, hh]); };
  const car = (t, s, toStreet = true) => { const [x, z] = F.at(t, s); K.cars.push([x, z, toStreet ? F.r : F.r + Math.PI]); };
  if (kind === 'house') {
    entry('drive', 1.3);
    // навес с кола отстрани (по-широката страна), иначе колата — на алеята пред къщата
    const side = right >= left ? 1 : -1, sg = side > 0 ? right : left;
    if (sg >= 3.2) { const sw = Math.min(sg - 0.5, 3.4), sc = side > 0 ? W - 0.3 - sw / 2 : -W + 0.3 + sw / 2, te = D - 1.2, ts = Math.max(-D + 0.5, te - 5.6);
      for (const [tt, ss] of [[ts + 0.2, sc - sw / 2 + 0.15], [ts + 0.2, sc + sw / 2 - 0.15], [te - 0.2, sc - sw / 2 + 0.15], [te - 0.2, sc + sw / 2 - 0.15]]) K.obox(F, 0x6e5a48, tt, ss, 0, 0.12, 0.12, 2.4);
      K.obox(F, 0x5d6168, (ts + te) / 2, sc, 2.4, te - ts + 0.3, sw + 0.3, 0.12);
      K.orect(F, 'drive', ts, walkEnd, sc - 1.3, sc + 1.3); gaps.push([sc - 1.6, sc + 1.6]);
      if (sw >= 2.2 && te - ts >= 4.6) car((ts + te) / 2, sc); }
    else if (front >= 5.6) car(t1 + front / 2, uc);
    frontFence(0xf2efe8, 1.0); fence(0xf2efe8, 1.0, -D + 0.15, D - 0.15, -W + 0.15, false); fence(0xf2efe8, 1.0, -D + 0.15, D - 0.15, W - 0.15, false); fence(0xf2efe8, 1.0, -W + 0.15, W - 0.15, -D + 0.15, true);
    // дървета в задния двор (или отстрани), храсти покрай оградата отпред
    if (back >= 3) { for (const s of [-W + 2, W - 2]) if (back >= 4.5 || s < s0 - 1.5 || s > s1 + 1.5) tree(-D + Math.min(back / 2, 3), s, 6 + h * 3); }
    else if (Math.max(left, right) >= 3) tree(0, right >= left ? W - 1.6 : -W + 1.6, 5 + h * 2);
    for (let s = -W + 1; s <= W - 1; s += 1.7) if (!gaps.some(([a, b]) => s > a - 0.6 && s < b + 0.6)) { const [x, z] = F.at(D - 0.7, s); K.bushes.push([x, z, 0.7 + hash(l.id * 7 + Math.round(s * 3)) * 0.35]); }
    return;
  }
  if (kind === 'office') {
    entry('walk', 1.1);
    // павиран площад във всички отстояния, лехи отпред, дървета в редица, стойка за колела до входа
    K.orect(F, 'plaza', t1, D, -W, W); K.orect(F, 'plaza', -D, t0, -W, W); K.orect(F, 'plaza', t0, t1, -W, s0); K.orect(F, 'plaza', t0, t1, s1, W);
    if (front >= 3.5) for (const sg of [-1, 1]) { const s = uc + sg * Math.min(W - 2, (s1 - s0) / 2 + 0.5); if (Math.abs(s - uc) < 2.6) continue;
      K.obox(F, 0x8e8a82, t1 + front / 2, s, 0, 1.6, 2.6, 0.45); K.orect(F, 'soil', t1 + front / 2 - 0.7, t1 + front / 2 + 0.7, s - 1.2, s + 1.2);
      for (const ds of [-0.7, 0.7]) { const [x, z] = F.at(t1 + front / 2, s + ds); K.bushes.push([x, z, 0.9]); } }
    if (front >= 6) for (let s = -W + 2.5; s <= W - 2.5; s += 7) if (Math.abs(s - uc) > 3) tree(D - 1.6, s, 7 + hash(l.id + s) * 2);
    if (front >= 2.2) { const s = uc + (uc + 3.2 < W - 1 ? 2.6 : -2.6); for (let k = 0; k < 5; k++) { const ss = s + (k - 2) * 0.75; K.obox(F, 0x30343a, t1 + 1.1, ss, 0, 0.6, 0.05, 0.8); } }
    // кратък достъп за коли отстрани: асфалт до тротоара и две места отзад
    const side = right >= left ? 1 : -1, sg = side > 0 ? right : left;
    if (sg >= 3.5) { const sc = side > 0 ? s1 + sg / 2 : s0 - sg / 2; K.orect(F, 'asphalt', -D + 0.5, walkEnd, sc - Math.min(1.6, sg / 2 - 0.2), sc + Math.min(1.6, sg / 2 - 0.2)); gaps.push([sc - 1.8, sc + 1.8]);
      if (D * 2 > 12) { car(-D + 3, sc, false); if (t1 - t0 > 11) car(-D + 9, sc, false); } }
    return;
  }
  // блок: пешеходна алея към входа, ивица настилка около сградата, жив плет отзад и отстрани, паркинг, общ двор
  entry('walk', 1.1);
  K.orect(F, 'pavers', t0 - 1.4, t0, s0 - 1.4, s1 + 1.4); K.orect(F, 'pavers', t1, t1 + Math.min(1.4, front), s0 - 1.4, s1 + 1.4); K.orect(F, 'pavers', t0, t1, s0 - 1.4, s0); K.orect(F, 'pavers', t0, t1, s1, s1 + 1.4);
  hedge(-W + 0.4, W - 0.4, -D + 0.4, true); hedge(-D + 0.4, D - 1.5, -W + 0.4, false); hedge(-D + 0.4, D - 1.5, W - 0.4, false);
  const side = right >= left ? 1 : -1, sg = side > 0 ? right : left;
  if (sg >= 5.2) { const sc = side > 0 ? s1 + sg / 2 : s0 - sg / 2; K.orect(F, 'asphalt', -D + 1.2, walkEnd, sc - 2.4, sc + 2.4);
    for (let t = D - 4; t > -D + 3.5; t -= 5.6) car(t, sc + side * 1.0, hash(l.id + t) > 0.5); }
  else if (front >= 6.5) { for (const sg2 of [-1, 1]) { const sa = sg2 < 0 ? -W + 0.6 : uc + 1.8, sb = sg2 < 0 ? uc - 1.8 : W - 0.6; if (sb - sa < 2.6) continue; K.orect(F, 'asphalt', D - 5.4, D, sa, sb); for (let s = sa + 1.3; s + 1.2 < sb; s += 2.6) car(D - 2.7, s, false); } }
  if (back >= 6) { const tc = -D + back / 2, wide = s1 - s0 > 9;
    K.orect(F, 'pavers', -D + 1.2, t0 - 1.4, s0, s1);
    for (const sg2 of [-1, 1]) { const [x, z] = F.at(tc, uc + sg2 * (wide ? (s1 - s0) / 2 - 1.5 : 2.5)); bench(K, x, z, F.r - sg2 * Math.PI / 2); }
    if (back >= 8 && wide) { const [x, z] = F.at(tc, uc); playground(K, x, z, -F.r, Math.min(10, s1 - s0 - 4), Math.min(7, back - 2.5)); }
    for (const s of [-W + 2, W - 2]) tree(-D + 2, s, 7 + h * 2); }
  else if (front >= 3) for (const sg2 of [-1, 1]) { const [x, z] = F.at(t1 + 1.6, uc + sg2 * 2.4); bench(K, x, z, F.r - sg2 * Math.PI / 2); }
}

// ---- паркът в голямата свободна земя
function park(K, A, c, built, o) {
  const { g, dt, comp, cx, cz, NX } = A, cells = c.cells, inC = k => k >= 0 && comp[k] === c.id;
  // главната ос (PCA) и „сърцето“ — най-дебелото място близо до средата
  let sxx = 0, szz = 0, sxz = 0; for (const k of cells) { const i = k % NX, j = (k - i) / NX, dx = cx(i) - c.x, dz = cz(j) - c.z; sxx += dx * dx; szz += dz * dz; sxz += dx * dz; }
  const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz), ax = Math.cos(ang), az = Math.sin(ang);
  let hk = cells[0], hs = -1e9; for (const k of cells) { const i = k % NX, j = (k - i) / NX, sc = dt[k] - 0.08 * Math.hypot(cx(i) - c.x, cz(j) - c.z); if (sc > hs) { hs = sc; hk = k; } }
  const hi = hk % NX, hx = cx(hi), hz = cz((hk - hi) / NX), used = new Uint8Array(g.length);
  const mark = (x, z, r) => { for (let dz = -r; dz <= r; dz += 1) for (let dx = -r; dx <= r; dx += 1) { const k = A.at(x + dx, z + dz); if (k >= 0) used[k] = 1; } };
  const free = (x, z) => { const k = A.at(x, z); return inC(k) && !used[k] && dt[k] >= 1.5; };
  // двете алеи през сърцето (по осите), до края на свободната земя; после — пътека до тротоара
  const ends = [];
  for (const [ux, uz] of [[ax, az], [-az, ax]]) { let a = 0, b = 0; while (a < 200 && inC(A.at(hx + ux * (a + 1), hz + uz * (a + 1))) && dt[A.at(hx + ux * (a + 1), hz + uz * (a + 1))] >= 1) a++; while (b < 200 && inC(A.at(hx - ux * (b + 1), hz - uz * (b + 1))) && dt[A.at(hx - ux * (b + 1), hz - uz * (b + 1))] >= 1) b++;
    if (a + b < 10) continue; const p0 = [hx - ux * b, hz - uz * b], p1 = [hx + ux * a, hz + uz * a], nx = -uz * 1.5, nz = ux * 1.5;
    K.flat('gravel', [[p0[0] + nx, p0[1] + nz], [p1[0] + nx, p1[1] + nz], [p1[0] - nx, p1[1] - nz], [p0[0] - nx, p0[1] - nz]]);
    for (let s = -b; s <= a; s += 1) mark(hx + ux * s, hz + uz * s, 2);
    ends.push(p0, p1);
    // пейки и дървета покрай алеята (не наслуки — в ред)
    for (let s = -b + 6; s < a - 4; s += 16) if (Math.abs(s) > 5) { const sd = (Math.round(s) & 16) ? 1 : -1, x = hx + ux * s - uz * 2.4 * sd, z = hz + uz * s + ux * 2.4 * sd; if (inC(A.at(x, z))) bench(K, x, z, Math.atan2(uz * sd, -ux * sd)); }   // с лице към алеята
    for (let s = -b + 3; s < a - 2; s += 11) for (const sd of [-1, 1]) { const x = hx + ux * s - uz * 3.6 * sd, z = hz + uz * s + ux * 3.6 * sd; if (free(x, z) && dt[A.at(x, z)] >= 2.5) { K.trees.push([x, z, 7 + hash(Math.round(x * 7 + z)) * 3]); mark(x, z, 1); } } }
  // пътека до тротоара: BFS по свободната земя от клетките до улицата; от най-близките два края — по най-късия път
  { const N = g.length, dist = new Int32Array(N).fill(-1), q = []; for (const k of cells) { const i = k % NX; if ([1, -1, NX, -NX].some(d => g[k + d] === ROAD && (d !== 1 || i < NX - 1) && (d !== -1 || i > 0))) { dist[k] = 0; q.push(k); } }
    for (let h = 0; h < q.length; h++) { const k = q[h], i = k % NX; for (const d of [1, -1, NX, -NX]) { if ((d === 1 && i === NX - 1) || (d === -1 && i === 0)) continue; const n = k + d; if (inC(n) && dist[n] < 0) { dist[n] = dist[k] + 1; q.push(n); } } }
    const cand = ends.map(p => [p, A.at(p[0], p[1])]).filter(([, k]) => inC(k) && dist[k] >= 0 && dist[k] < 30).sort((a, b) => dist[a[1]] - dist[b[1]]).slice(0, 2);
    for (const [, k0] of cand) { let k = k0; const pts = []; while (dist[k] > 0) { const i = k % NX; pts.push([cx(i), cz((k - i) / NX)]); let nb = k; for (const d of [1, -1, NX, -NX]) { const n = k + d; if (n >= 0 && n < N && dist[n] >= 0 && dist[n] < dist[nb]) nb = n; } if (nb === k) break; k = nb; }
      { const i = k % NX; pts.push([cx(i), cz((k - i) / NX)]); }
      for (let m = 1; m < pts.length; m++) { const [x0, z0] = pts[m - 1], [x1, z1] = pts[m], L = Math.hypot(x1 - x0, z1 - z0) || 1, nx = -(z1 - z0) / L * 1.1, nz = (x1 - x0) / L * 1.1, ex = (x1 - x0) / L * 1.1, ez = (z1 - z0) / L * 1.1;
        K.flat('gravel', [[x0 - ex + nx, z0 - ez + nz], [x1 + ex + nx, z1 + ez + nz], [x1 + ex - nx, z1 + ez - nz], [x0 - ex - nx, z0 - ez - nz]]); mark(x0, z0, 2); } } }
  // площадката и игрището — при повече готови сгради наоколо; място, където се побират изцяло
  const fit = (w, d, mg) => { let best = null, bs = 1e9; for (let n = 0; n < cells.length; n += 3) { const k = cells[n], i = k % NX, x = cx(i), z = cz((k - i) / NX); if (dt[k] < Math.min(w, d) / 2) continue;
      let ok = true; for (let a = -w / 2 - mg; ok && a <= w / 2 + mg; a += 1.5) for (let b = -d / 2 - mg; ok && b <= d / 2 + mg; b += 1.5) if (!free(x + ax * a - az * b, z + az * a + ax * b)) ok = false;
      if (!ok) continue; const sc = Math.hypot(x - hx, z - hz); if (sc < bs) { bs = sc; best = [x, z]; } } return best; };
  if (built >= 10 && c.area >= 2600) { const p = fit(24, 14, 1); if (p) { pitch(K, p[0], p[1], ang, 24, 14); mark(p[0], p[1], 14); } }
  if (built >= 6) { const p = fit(12, 9, 1); if (p) { playground(K, p[0], p[1], ang, 12, 9); mark(p[0], p[1], 8); for (const sd of [-1, 1]) bench(K, p[0] - az * sd * 6.2, p[1] + ax * sd * 6.2, Math.atan2(az * sd, -ax * sd)); } }
  // дървета по края на парка (в пръстен 3–5 м навътре), на разстояние ≥ 9 м
  const taken = []; const cap = Math.min(60, Math.floor(c.area / 140));
  for (let n = 0; n < cells.length && taken.length < cap; n++) { const k = cells[(n * 7919) % cells.length], i = k % NX, x = cx(i), z = cz((k - i) / NX); if (dt[k] < 3 || dt[k] > 5 || used[k]) continue;
    if (taken.some(([a, b]) => Math.hypot(a - x, b - z) < 9)) continue; taken.push([x, z]); K.trees.push([x, z, 6 + hash(k) * 4]); }
}
// малките остатъци — ниски храсти (по най-широката им част), когато наоколо вече има застрояване
function pocket(K, A, c) { const { dt, cx, cz, NX } = A, out = []; const cap = Math.min(10, Math.floor(c.area / 40));
  for (let n = 0; n < c.cells.length && out.length < cap; n++) { const k = c.cells[(n * 7919) % c.cells.length]; if (dt[k] < 2) continue; const i = k % NX, x = cx(i), z = cz((k - i) / NX); if (out.some(([a, b]) => Math.hypot(a - x, b - z) < 4)) continue; out.push([x, z]); K.bushes.push([x, z, 0.8 + hash(k) * 0.5]); } }

// ---- създаването: { city, P (city.plan), isHouse(n), skip: Set на парцелите без двор (централа, гараж, склад), treeProtos, bushProtos, cars, lotPaths }
export function createDistricts(o) {
  const { city, P } = o; let G = null, D = null, A = null, hud = null;
  const doneLot = l => l.built && l.obj && !l.busy;
  function rebuild() {
    if (G) { G.parent && G.parent.remove(G); G.userData.dispose(); G = null; }
    const T0 = performance.now(); A = analyze(P, city.lots); A.msA = performance.now() - T0; const K = Kit(), skip = o.skip ? o.skip() : new Set();
    for (const l of city.lots) { if (!doneLot(l) || !l.plan || skip.has(l.id)) continue; const f = A.fps.get(l.id); if (!f) continue;
      try { yard(K, l, f, o.isHouse(String(l.built)) ? 'house' : isOffice(String(l.built)) ? 'office' : 'block', o); } catch (e) { console.warn('districts yard', l.id, e); } }
    const done = city.lots.filter(doneLot), near = (x, z, r) => done.filter(l => Math.hypot(l.x - x, l.z - z) < r).length;
    for (const c of A.comps) {
      if (c.area >= PARK_MIN && c.maxDt >= PARK_DT) { const n = near(c.x, c.z, 150); c.built = n; if (n >= 3) try { park(K, A, c, n, o); c.park = true; } catch (e) { console.warn('districts park', e); } }
      else if (c.area >= 60 && c.maxDt >= 2 && near(c.x, c.z, 60) >= 1) pocket(K, A, c);
    }
    G = K.build(o); G.name = 'districts'; city.group.add(G); A.ms = performance.now() - T0; let dc = 0; G.traverse(m => { if (m.isMesh) dc++; }); A.draws = dc;
    if (D) diag(true);
    return stats();
  }
  function stats() {
    if (!A) return null; const a = A.area, L = city.lots, built = L.filter(doneLot).length, busy = L.filter(l => l.busy).length, freeL = L.filter(l => !l.built && !l.busy).length;
    const ratios = L.filter(l => A.fps.has(l.id)).map(l => { const f = A.fps.get(l.id); return Math.min(1, ((f.t1 - f.t0) * (f.s1 - f.s0)) / (l.w * l.d)); }).sort((x, y) => x - y);
    const big = A.comps.filter(c => c.area >= PARK_MIN && c.maxDt >= PARK_DT);
    const tot = Object.entries(a).filter(([k]) => +k !== OUT).reduce((s, [, v]) => s + v, 0);
    return { city: Math.round(tot), road: a[ROAD] | 0, water: a[WATER] | 0, lots: a[LOT] | 0, reserve: a[RES] | 0, bigs: a[BIG] | 0, buildings: a[BLD] | 0, free: a[FREE] | 0,
      lotCount: L.length, lotsBuilt: built, lotsBusy: busy, lotsFree: freeL, reserveLots: P.p2.lots.filter(x => !x.big && !x.lm).length - L.length,
      fpMed: ratios.length ? +ratios[ratios.length >> 1].toFixed(2) : 0, parkAreas: big.length, parkArea: big.reduce((s, c) => s + c.area, 0), parkInner: big.filter(c => !c.road).length, parks: A.comps.filter(c => c.park).length, ms: Math.round(A.ms || 0), msAnalyze: Math.round(A.msA || 0), draws: A.draws || 0 };
  }
  // диагностиката: растерът като полупрозрачна текстура над града и табло с числата
  const COL = { [FREE]: [255, 60, 200, 150], [ROAD]: [70, 70, 80, 110], [WATER]: [40, 110, 230, 120], [LOT]: [120, 230, 120, 140], [RES]: [150, 110, 230, 140], [BIG]: [40, 200, 220, 140], [BLD]: [230, 50, 40, 200], [OUT]: [0, 0, 0, 0] };
  function diag(on) {
    if (D) { D.parent && D.parent.remove(D); D.geometry.dispose(); D.material.map.dispose(); D.material.dispose(); D = null; } if (hud) { hud.remove(); hud = null; }
    if (!on) return null; if (!A) rebuild();
    const { NX, NZ, g, comp, comps } = A, data = new Uint8Array(NX * NZ * 4);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const k = j * NX + i, c = COL[g[k]]; let col = c;
      if (g[k] === FREE) { const cc = comps[comp[k]]; col = cc && cc.area >= PARK_MIN && cc.maxDt >= PARK_DT ? [255, 40, 190, 170] : [255, 170, 230, 110]; }
      data.set(col, k * 4); }
    // парцелите по състояние: застроени — жълто, в строеж — оранжево, свободни — зелено
    for (const l of city.lots) { if (!l.plan) continue; const col = doneLot(l) ? [240, 210, 60, 150] : l.busy ? [250, 140, 40, 160] : [120, 230, 120, 140], F = lotFrame(l), R = Math.hypot(l.w, l.d) / 2;
      for (let z = l.z - R; z <= l.z + R; z += CELL) for (let x = l.x - R; x <= l.x + R; x += CELL) { const k = A.at(x, z); if (k < 0 || g[k] !== LOT) continue; const i = k % NX, j = (k - i) / NX, dx = A.cx(i) - l.x, dz = A.cz(j) - l.z; if (Math.abs(dx * F.fx + dz * F.fz) <= l.d / 2 && Math.abs(dx * F.ux + dz * F.uz) <= l.w / 2) data.set(col, k * 4); } }
    const tex = new THREE.DataTexture(data, NX, NZ); tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
    const ge = new THREE.PlaneGeometry(NX * CELL, NZ * CELL).rotateX(Math.PI / 2);   // +π/2: v расте с z — редът j на текстурата е редът j на растера
    D = new THREE.Mesh(ge, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide })); D.position.set(A.x0 + NX * CELL / 2, 0.35, A.z0 + NZ * CELL / 2); D.renderOrder = 5; city.group.add(D);
    const s = stats(), pc = v => (v / s.city * 100).toFixed(1) + ' %', ha = v => (v / 1e4).toFixed(1) + ' ха';
    hud = document.createElement('div'); Object.assign(hud.style, { position: 'fixed', left: '12px', top: '70px', zIndex: 30, background: 'rgba(20,22,27,.9)', color: '#e8e8ea', font: '12px/1.5 system-ui,sans-serif', padding: '8px 12px', borderRadius: '8px', maxWidth: '330px', pointerEvents: 'none' });
    const sw = c => `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:rgba(${c.slice(0, 3)},1);margin-right:6px"></span>`;
    hud.innerHTML = `<b>🏡 Земята на града (${ha(s.city)})</b><br>${sw(COL[ROAD])}улици с тротоарите: ${pc(s.road)}<br>${sw([240, 210, 60])}отключени парцели: ${pc(s.lots)} — ${s.lotCount} бр. (${s.lotsBuilt} готови, ${s.lotsBusy} заети, ${s.lotsFree} свободни)<br>${sw(COL[BLD])}сградите: ${pc(s.buildings)}; сградата заема ~${Math.round(s.fpMed * 100)} % от парцела<br>${sw(COL[RES])}резерв (следващите квартали): ${pc(s.reserve)} — ${s.reserveLots} парцела<br>${sw(COL[BIG])}големите места: ${pc(s.bigs)}<br>${sw(COL[WATER])}вода: ${pc(s.water)}<br>${sw([255, 40, 190])}<b>свободна земя: ${pc(s.free)}</b> — ${s.parkAreas} големи площи (${ha(s.parkArea)}), от тях ${s.parkInner} изцяло вътре в квартала (без излаз на улица); ${s.parks} вече са паркове<br><span style="color:#9aa0aa">Парцелите са само една редица покрай улиците (20 × 24 м); вътрешността на кварталите и ъглите никога не са били парцели. „Почти застроен“ брои само отключените парцели — резервът се отключва с нов квартал от таб „Офис“.</span>`;
    document.body.appendChild(hud); return s;
  }
  // най-голямата свободна площ с най-много готови сгради наоколо — за снимките „преди/след“
  function focus() { if (!A) rebuild(); const done = city.lots.filter(doneLot); let best = null, bs = -1; for (const c of A.comps) { if (c.area < PARK_MIN || c.maxDt < PARK_DT) continue; const n = done.filter(l => Math.hypot(l.x - c.x, l.z - c.z) < 150).length * 1e5 + c.area; if (n > bs) { bs = n; best = c; } } return best && { x: best.x, z: best.z, area: best.area }; }
  function update(camera, target) { if (!G) return; const far = camera.position.distanceTo(target) > 420; G.userData.small.visible = !far; }
  function dispose() { diag(false); if (G) { G.parent && G.parent.remove(G); G.userData.dispose(); G = null; } }
  return { rebuild, diag, stats, focus, update, dispose, get analysis() { return A; } };
}
