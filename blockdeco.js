// 🌳 blockdeco.js — block-deco (T2; координаторът по снимките design2/07 и 10: „голите морави между блоковете“): животът в двора на всеки парцел,
// около сградата — според вида на града и сградата:
//   'panel' — панелните блокове (България, Балканите, Източна Европа): диагонална пътека през най-голямата морава, пейка + кошче (+ лампа) на 25–30 м,
//             по една детска площадка ИЛИ рамка за тупане на килими на парцел, липи (~1 обект на 150 м²);
//   'west'  — къщите (предградията): жив плет отпред, 1–2 дървета, пощенска кутия до алеята;
//   'old'   — старите европейски центрове (сградите, не къщите): павиран вътрешен двор зад сградата, 2 дървета, пейка, сандъчета с цветя.
//   'plaza' — (само клетки, block-deco-osm) площадчетата между небостъргачите: павета, дървета в сандъци, пейки, кошчета, лампи.
// Един InstancedMesh на вид за целия град (~12 рисувания), разположението — по хеша на парцела (едно и също при всяко зареждане).
//   buildBlockDeco(items, { trees, half, lamps, night }) → THREE.Group;  items: [{ l, style, x, z, rot, w, d, b: { t0, t1, u0, u1 }, uc }]
//   (рамката на парцела: t — към улицата, u — встрани; b — правоъгълникът на сградата в нея, uc — средата на входната алея)
import * as THREE from 'three';

const hash = n => { n = Math.imul(n ^ (n >>> 16), 2246822507); n = Math.imul(n ^ (n >>> 13), 3266489909); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const rng = seed => { let s = seed >>> 0 || 1; return () => (s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 >>> 0, hash(s)); };
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
// геометриите (основата на y = 0, „напред“ = +z)
function benchGeo() { const g = [new THREE.BoxGeometry(1.7, 0.08, 0.45).translate(0, 0.45, 0), new THREE.BoxGeometry(1.7, 0.4, 0.06).translate(0, 0.72, -0.2),
  new THREE.BoxGeometry(0.06, 0.45, 0.4).translate(-0.75, 0.22, 0), new THREE.BoxGeometry(0.06, 0.45, 0.4).translate(0.75, 0.22, 0)]; return merge(g); }
function frameGeo() { const g = [new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6).translate(-1.3, 0.9, 0), new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6).translate(1.3, 0.9, 0),
  new THREE.CylinderGeometry(0.035, 0.035, 2.6, 6).rotateZ(Math.PI / 2).translate(0, 1.75, 0), new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6).rotateZ(Math.PI / 2).translate(0, 1.2, 0)]; return merge(g); }
function swingGeo() { const g = []; for (const s of [-1, 1]) for (const f of [-1, 1]) g.push(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6).rotateX(f * 0.28).translate(s * 1.4, 1.2, f * 0.35));
  g.push(new THREE.CylinderGeometry(0.05, 0.05, 2.9, 6).rotateZ(Math.PI / 2).translate(0, 2.35, 0));
  for (const s of [-0.5, 0.5]) { g.push(new THREE.BoxGeometry(0.45, 0.05, 0.2).translate(s, 0.5, 0)); g.push(new THREE.CylinderGeometry(0.01, 0.01, 1.8, 4).translate(s - 0.2, 1.42, 0), new THREE.CylinderGeometry(0.01, 0.01, 1.8, 4).translate(s + 0.2, 1.42, 0)); }
  return merge(g); }
function mailGeo() { return merge([new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6).translate(0, 0.55, 0), new THREE.BoxGeometry(0.22, 0.24, 0.45).translate(0, 1.2, 0)]); }
function merge(gs) { let n = 0; for (const g of gs) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), idx = []; let o = 0;
  for (const g of gs) { const P = g.attributes.position, N = g.attributes.normal; pos.set(P.array, o * 3); nor.set(N.array, o * 3); const I = g.index ? g.index.array : [...Array(P.count).keys()]; for (const i of I) idx.push(i + o); o += P.count; g.dispose(); }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setIndex(idx); return m; }

export function buildBlockDeco(items, opts = {}) {
  const { trees = [], half = false, lamps = true, night = () => 0, cells = [], paths = [] } = opts, G = new THREE.Group(); G.name = 'block-deco';
  const L = { bench: [], bin: [], lamp: [], frame: [], swing: [], sand: [], hedge: [], mail: [], planter: [], tree: [] }, quads = { path: [], pave: [] };
  const keep = half ? 0.5 : 1, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const dbg = { items: items.length, noZone: 0, big: 0, ex: [] };
  for (const it of items) {
    const { l, style, x, z, rot, w, d, b, uc } = it, r = rng((l.id + 1) * 7919), dx = Math.sin(rot), dz = Math.cos(rot), px = dz, pz = -dx;
    const W = (t, u) => [x + dx * t + px * u, z + dz * t + pz * u], ang = a => rot + a;   // от рамката на парцела към света
    const put = (k, t, u, a = 0, s = 1, sy = s) => { if (r() > keep && k !== 'tree') return; const [X, Z] = W(t, u); L[k].push([X, Z, ang(a), s, sy]); };
    const T0 = -d / 2 + 0.8, T1 = d / 2 - 0.8, U0 = -w / 2 + 0.8, U1 = w / 2 - 0.8, m = 1.6;
    // свободните ивици около сградата (отзад, отляво, отдясно, отпред)
    const zones = [{ k: 'back', t0: T0, t1: b.t0 - m, u0: U0, u1: U1 }, { k: 'left', t0: Math.max(T0, b.t0 - m), t1: Math.min(T1, b.t1 + m), u0: U0, u1: b.u0 - m },
      { k: 'right', t0: Math.max(T0, b.t0 - m), t1: Math.min(T1, b.t1 + m), u0: b.u1 + m, u1: U1 }, { k: 'front', t0: b.t1 + m, t1: T1, u0: U0, u1: U1 }]
      .map(zn => ({ ...zn, a: Math.max(0, zn.t1 - zn.t0) * Math.max(0, zn.u1 - zn.u0) })).filter(zn => zn.t1 - zn.t0 > 3 && zn.u1 - zn.u0 > 3).sort((p, q) => q.a - p.a);
    if (dbg.ex.length < 4) dbg.ex.push({ w: Math.round(w), d: Math.round(d), b: [b.t0, b.t1, b.u0, b.u1].map(Math.round), z: zones.map(zn => zn.k + ':' + Math.round(zn.a)) });
    if (!zones.length) { dbg.noZone++; continue; }
    const inPath = (t, u) => t > b.t1 - 0.5 && Math.abs(u - uc) < 2.2;   // входната алея (lot-paths)
    const spot = (zn, pad = 1) => { for (let k = 0; k < 8; k++) { const t = zn.t0 + pad + r() * Math.max(0, zn.t1 - zn.t0 - 2 * pad), u = zn.u0 + pad + r() * Math.max(0, zn.u1 - zn.u0 - 2 * pad); if (!inPath(t, u)) return [t, u]; } return null; };
    const freeA = zones.reduce((a, zn) => a + zn.a, 0);
    if (style === 'panel') {
      const Z = zones[0];
      if (Z.t1 - Z.t0 > 7 && Z.u1 - Z.u0 > 7) {   // диагоналната пътека през най-голямата морава
        const a = [Z.t0, Z.u0], c = [Z.t1, Z.u1], len = Math.hypot(c[0] - a[0], c[1] - a[1]), nt = (c[0] - a[0]) / len, nu = (c[1] - a[1]) / len, hw = 0.9;
        quads.path.push([W(a[0] - nu * hw, a[1] + nt * hw), W(a[0] + nu * hw, a[1] - nt * hw), W(c[0] + nu * hw, c[1] - nt * hw), W(c[0] - nu * hw, c[1] + nt * hw)]);
        const ga = Math.atan2(nu, nt);   // посоката на пътеката (в рамката: t → z, u → x)
        for (let s = 6 + r() * 6, k = 0; s < len - 4; s += 25 + r() * 5, k++) {   // пейка + кошче (+ лампа) на 25–30 м, отстрани на пътеката
          const t = a[0] + nt * s - nu * 1.6, u = a[1] + nu * s + nt * 1.6; if (inPath(t, u)) continue;
          put('bench', t, u, ga + Math.PI / 2); put('bin', t + nt * 1.3, u + nu * 1.3);
          if (lamps && k % 2 === 0) put('lamp', a[0] + nt * s + nu * 1.4, a[1] + nu * s - nt * 1.4);
        }
      }
      const Z2 = zones[1] || zones[0];   // една детска площадка или рамка за тупане на килими
      if (Z2.a > 60) { const p = spot(Z2, 2.5); if (p) { if (r() < 0.6) { put('sand', p[0], p[1], 0, 1); put('swing', p[0], p[1] + 3, Math.PI / 2); put('bench', p[0] - 3, p[1], 0); } else put('frame', p[0], p[1], r() * 3); } }
      const nT = Math.min(10, Math.floor(freeA / 150));   // липи
      for (let k = 0; k < nT; k++) { const zn = zones[k % zones.length], p = spot(zn, 1.5); if (p) put('tree', p[0], p[1], r() * 6.28, 8 + r() * 3); }
    } else if (style === 'west') {
      const F = zones.find(zn => zn.k === 'front');   // жив плет по предния ръб (без алеята), пощенска кутия до нея
      if (F) { const t = T1 - 0.2; for (const [u0, u1] of [[U0, uc - 2.4], [uc + 2.4, U1]]) if (u1 - u0 > 1) { const [X, Z] = W(t, (u0 + u1) / 2); L.hedge.push([X, Z, ang(0), u1 - u0, 1]); }
        put('mail', T1 - 0.6, uc + 2.0, Math.PI); }
      const nT = 1 + (r() < 0.5 ? 1 : 0);
      for (let k = 0; k < nT; k++) { const zn = zones[k % zones.length], p = spot(zn, 1.5); if (p) put('tree', p[0], p[1], r() * 6.28, 7 + r() * 3); }
    } else if (style === 'old') {
      const B = zones.find(zn => zn.k === 'back') || zones[0];   // павираният двор зад сградата
      quads.pave.push([W(B.t0, B.u0), W(B.t0, B.u1), W(B.t1, B.u1), W(B.t1, B.u0)]);
      const ct = (B.t0 + B.t1) / 2, cu = (B.u0 + B.u1) / 2, hu = (B.u1 - B.u0) / 4;
      put('tree', ct, cu - hu, r() * 6.28, 7 + r() * 2); put('tree', ct, cu + hu, r() * 6.28, 7 + r() * 2);
      put('bench', ct, cu, Math.PI / 2); put('planter', B.t0 + 0.8, cu - hu * 1.5); put('planter', B.t0 + 0.8, cu + hu * 1.5); put('planter', B.t1 - 0.8, cu);
    }
  }
  // ---- моравите между парцелите (клетки 4 × 4 м — cells: { x, z, style, lot, int, h }), по хеша на клетката; ~1 обект на 150 м²
  const usedPlay = new Set(), W2 = (e, k, a = 0, s = 1) => { if (k !== 'tree' && hash(Math.round(e.x * 3 + e.z * 5)) > keep) return; L[k].push([e.x, e.z, a, s, s]); };
  for (const c of cells) { const h = c.h, h2 = hash(Math.round(c.x * 11 + c.z * 17) | 0), a = h2 * 6.283;
    if (c.style === 'panel') {
      if (h < 0.075) W2(c, 'tree', a, 8 + h2 * 3);
      else if (h < 0.1) { W2(c, 'bench', a); W2({ x: c.x + Math.cos(a) * 1.4, z: c.z - Math.sin(a) * 1.4 }, 'bin'); }
      else if (h < 0.112 && lamps) W2(c, 'lamp');
      else if (h < 0.125 && c.int && !usedPlay.has(c.lot)) { usedPlay.add(c.lot); if (h2 < 0.6) { W2(c, 'sand'); W2({ x: c.x + 3.2, z: c.z }, 'swing', Math.PI / 2); } else W2(c, 'frame', a); }
    } else if (c.style === 'old') {
      if (c.int && h < 0.55) quads.pave.push([[c.x - 2, c.z - 2], [c.x + 2, c.z - 2], [c.x + 2, c.z + 2], [c.x - 2, c.z + 2]]);
      if (h < 0.05) W2(c, 'tree', a, 7 + h2 * 2); else if (h < 0.075) W2(c, 'bench', a); else if (h < 0.1) W2(c, 'planter', a);
    } else if (c.style === 'west') { if (h < 0.07) W2(c, 'tree', a, 7 + h2 * 3); }
    else if (c.style === 'plaza') {   // block-deco-osm (T3): площадчетата между небостъргачите (Ню Йорк) — павета, дървета в сандъци, пейки, лампи
      if (c.int && h < 0.7) quads.pave.push([[c.x - 2, c.z - 2], [c.x + 2, c.z - 2], [c.x + 2, c.z + 2], [c.x - 2, c.z + 2]]);
      if (h < 0.04) { W2(c, 'planter', a, 1.4); W2(c, 'tree', a, 6 + h2 * 2); } else if (h < 0.075) W2(c, 'bench', a); else if (h < 0.09) W2(c, 'bin', a); else if (h < 0.1 && lamps) W2(c, 'lamp'); }
  }
  // пътеките по моравите (желаните пътеки зад панелните блокове): лента 1,8 м, пейка + кошче (+ лампа) на 25–30 м отстрани
  for (const pa of paths) { const [ax, az] = pa.a, [bx, bz] = pa.b, len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len, nx = -uz * 0.9, nz = ux * 0.9;
    quads.path.push([[ax + nx, az + nz], [ax - nx, az - nz], [bx - nx, bz - nz], [bx + nx, bz + nz]]);
    for (let s = 5, k = 0; s < len - 3; s += 25 + hash(k * 31 + Math.round(ax)) * 5, k++) { const x = ax + ux * s - uz * 1.7, z = az + uz * s + ux * 1.7, ga = Math.atan2(ux, uz) + Math.PI / 2;
      W2({ x, z }, 'bench', ga + Math.PI / 2); W2({ x: x + ux * 1.3, z: z + uz * 1.3 }, 'bin'); if (lamps && k % 2 === 0) W2({ x: ax + ux * s + uz * 1.5, z: az + uz * s - ux * 1.5 }, 'lamp'); } }
  // ---- рисуване: по един InstancedMesh на вид
  const inst = (geo, mat, list, f, shadow = true) => { if (!list.length) { geo.dispose(); return null; } const I = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((e, i) => { f(e); I.setMatrixAt(i, m4.compose(v, q, sc)); }); I.castShadow = shadow; I.receiveShadow = true; I.frustumCulled = false; G.add(I); return I; };
  const std = (e, s = 1) => { v.set(e[0], 0, e[1]); q.setFromAxisAngle(up, e[2]); sc.set(s, s, s); };
  inst(benchGeo(), M(0x7a5232), L.bench, e => std(e));
  inst(new THREE.CylinderGeometry(0.22, 0.2, 0.75, 10).translate(0, 0.375, 0), M(0x2f5a3a, { roughness: 0.6, metalness: 0.2 }), L.bin, e => std(e));
  inst(frameGeo(), M(0x6d7680, { roughness: 0.5, metalness: 0.4 }), L.frame, e => std(e));
  inst(swingGeo(), M(0xd0452f, { roughness: 0.6, metalness: 0.3 }), L.swing, e => std(e));
  inst(new THREE.BoxGeometry(3.2, 0.25, 3.2).translate(0, 0.125, 0), M(0xd9c48f, { roughness: 1 }), L.sand, e => std(e), false);
  inst(new THREE.BoxGeometry(1, 1.1, 0.8).translate(0, 0.55, 0), M(0x3e6b2f, { roughness: 1 }), L.hedge, e => { v.set(e[0], 0, e[1]); q.setFromAxisAngle(up, e[2]); sc.set(e[3], 1, 1); });
  inst(mailGeo(), M(0x2c4a7a, { roughness: 0.5, metalness: 0.3 }), L.mail, e => std(e));
  inst(new THREE.BoxGeometry(1.2, 0.5, 0.6).translate(0, 0.25, 0), M(0x8a6e55, { roughness: 0.9 }), L.planter, e => std(e));
  if (L.lamp.length) {   // лампите: стълб + глава, нощем светят (по night())
    inst(new THREE.CylinderGeometry(0.06, 0.08, 3.6, 6).translate(0, 1.8, 0), M(0x3a3f45, { metalness: 0.5, roughness: 0.5 }), L.lamp, e => std(e));
    const hm = new THREE.MeshStandardMaterial({ color: 0xf3ead2, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.4 });
    const H = inst(new THREE.SphereGeometry(0.22, 10, 8).translate(0, 3.75, 0), hm, L.lamp, e => std(e), false);
    if (H) H.onBeforeRender = () => { hm.emissiveIntensity = 2.2 * night(); };
  }
  // липите/дърветата: моделите на играта (основата 0, височина 1), инстанции по части; със семе за tree-colors (aSeed)
  if (L.tree.length && trees.length) {
    const vars = trees.map(src => { src.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(src), h = (bb.max.y - bb.min.y) || 1, parts = [];
      src.traverse(o => { if (o.isMesh) { const g = o.geometry.clone().applyMatrix4(o.matrixWorld); g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); g.scale(1 / h, 1 / h, 1 / h); parts.push([g, o.material]); } }); return parts; }).filter(p => p.length);
    const by = vars.map(() => []); L.tree.forEach((t, i) => by[i % vars.length].push(t));
    vars.forEach((parts, vi) => { const LL = by[vi]; if (!LL.length) return; for (const [g, mat] of parts) { const tt = mat && mat.__tt && mat.__tt.inst;
      if (tt) g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(Float32Array.from(LL, e => hash(Math.round(e[0] * 13 + e[1] * 7) | 0)), 1));
      const I = inst(g, tt ? mat.__tt.inst() : mat, LL, e => { v.set(e[0], 0, e[1]); q.setFromAxisAngle(up, e[2]); sc.set(e[3], e[3], e[3]); });
      if (I && tt) I.customDepthMaterial = I.material.__tt.depth; } });
  }
  // пътеките и павираните дворове — по един меш (квадрите на парцелите)
  for (const [k, col, y] of [['path', 0xc9bfa8, 0.05], ['pave', 0xb4ab9c, 0.045]]) { const Q = quads[k]; if (!Q.length) continue; const pos = [], idx = [];
    Q.forEach((qd, i) => { for (const [X, Z] of qd) pos.push(X, y, Z); idx.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const me = new THREE.Mesh(g, M(col, { roughness: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); me.receiveShadow = true; G.add(me); }
  G.userData.at = Object.fromEntries(Object.entries(L).filter(([, a]) => a.length).map(([k, a]) => [k, a[Math.floor(a.length / 2)].slice(0, 2)]));   // за камерата в Лабораторията
  G.userData.dbg = dbg;
  G.userData.counts = Object.fromEntries(Object.entries(L).map(([k, a]) => [k, a.length]).concat([['paths', quads.path.length], ['paves', quads.pave.length]]));
  return G;
}
