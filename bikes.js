// bikes.js — 🚲 bikes (f9): велосипедисти и тротинетки по велоалеите в европейските градове (плана v2).
// Велоалея: червена ивица 0,9 м до бордюра на булевардите, околовръстните и кейовете (в Амстердам и Копенхаген — и по улиците),
// в посоката на движението (дясно/ляво според P.drive). Колоездачите карат по нея, на кръстовището завиват по друга алея
// (плавна дъга през възела), в задънена улица — обратно. Само близо до камерата (R м); нощем по-малко и с фарче/стоп; в дъжд — по-малко.
// Евтино: по една InstancedMesh на част (колело, рамка, торс, глава, крака/ръце — „кости“ с IK на педалите, тротинетка).
// const b = createBikes({ parent, plan() → { P, ox, oz } | null, many() → 0…1, hour(), wet(), night(), on() });  b.update(dt, target);  b.clear()
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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

export function createBikes(deps) {
  let G = null, M = null, net = null, netP = null; const riders = [];
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
    return {
      wheel: im(new THREE.TorusGeometry(0.33, 0.028, 5, 18).rotateY(Math.PI / 2), dark, MAX * 2), swheel: im(new THREE.TorusGeometry(0.1, 0.03, 5, 12).rotateY(Math.PI / 2), dark, MAX * 2),
      frame: im(frameGeo(), wh, MAX), scoot: im(scooterGeo(), wh, MAX), torso: im(bone(0.34, 0.2), wh, MAX), head: im(new THREE.SphereGeometry(0.115, 8, 6), wh, MAX),
      leg: im(bone(0.12, 0.13), new THREE.MeshStandardMaterial({ color: 0x2c3440, roughness: 0.85 }), MAX * 4), arm: im(bone(0.08, 0.08), wh, MAX * 2),
      lampF: im(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: 0xfff6d8, toneMapped: false }), MAX, false), lampR: im(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }), MAX, false),
    };
  }
  // кост от точка a до b (в местните координати на колелото) → инстанция
  function seg(o, a, b, c) { D.subVectors(b, a); const l = D.length() || 0.001; q.setFromUnitVectors(UP, D.divideScalar(l)); m4b.compose(a, q, sc.set(1, l, 1)); o.setMatrixAt(o.count, m4c.multiplyMatrices(m4, m4b)); if (c != null) o.setColorAt(o.count, col.setHex(c)); o.count++; }
  function put(o, x, y, z, c, s = 1) { m4b.makeTranslation(x, y, z); if (s !== 1) m4b.scale(sc.set(s, s, s)); o.setMatrixAt(o.count, m4c.multiplyMatrices(m4, m4b)); if (c != null) o.setColorAt(o.count, col.setHex(c)); o.count++; }
  const knee = (H, F, len, out) => {   // IK с два еднакви сегмента в равнината y–z; коляното — напред (+z)
    D.subVectors(F, H); const d = Math.min(D.length(), len * 2 - 0.001), h = Math.sqrt(Math.max(0, len * len - d * d / 4)); const vy = D.y / (D.length() || 1), vz = D.z / (D.length() || 1);
    let py = -vz, pz = vy; if (pz < 0) { py = -py; pz = -pz; } out.set(H.x + D.x / 2, H.y + D.y / 2 + py * h, H.z + D.z / 2 + pz * h); return out; };
  function spawn(N, tgt, near) {
    const L = N.lanes.filter(ln => { const [x, z] = at(ln, (ln.s0 + ln.s1) / 2); return Math.hypot(x + N.ox - tgt.x, z + N.oz - tgt.z) < (near ? R * 0.7 : R); }); if (!L.length) return null;
    const ln = L[(Math.random() * L.length) | 0], scoot = Math.random() < 0.22;
    return { ln, s: ln.s0 + Math.random() * (ln.s1 - ln.s0), v: scoot ? 5 + Math.random() * 1.5 : 3.8 + Math.random() * 2.2, scoot, cr: Math.random() * 6.28, top: TOPS[(Math.random() * TOPS.length) | 0], fr: FRAMES[(Math.random() * FRAMES.length) | 0], skin: SKIN[(Math.random() * SKIN.length) | 0], tr: null, x: 0, z: 0, h: 0 };
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
    r.x = x + N.ox; r.z = z + N.oz; let dh = h - r.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); r.h += dh * Math.min(1, dt * 6); r.cr += r.v * dt / 0.33 / 2.4; return true;
  }
  const H = new THREE.Vector3(), F = new THREE.Vector3(), K = new THREE.Vector3(), Sh = new THREE.Vector3(), Hb = new THREE.Vector3();
  function draw(r, night) {
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
    const h = deps.hour(), tod = h < 6 || h > 23 ? 0.12 : h < 7 || h > 21 ? 0.45 : 1, want = Math.round(MAX * deps.many() * tod * (deps.wet() ? 0.35 : 1));
    const d = Math.min(0.1, dt);
    for (let i = riders.length - 1; i >= 0; i--) { const r = riders[i]; if (!step(net, r, d) || Math.hypot(r.x - tgt.x, r.z - tgt.z) > R * 1.25 || i >= want) riders.splice(i, 1); }
    if (riders.length < want) { const r = spawn(net, tgt, riders.length > 0); if (r) { step(net, r, 0); r.h = at(r.ln, r.s)[2]; riders.push(r); } }
    for (const o of Object.values(M)) o.count = 0;
    const night = deps.night(); for (const r of riders) draw(r, night);
    for (const o of Object.values(M)) { o.instanceMatrix.needsUpdate = true; if (o.instanceColor) o.instanceColor.needsUpdate = true; }
  }
  function clear() { riders.length = 0; if (G) { G.parent && G.parent.remove(G); G.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } G = null; M = null; net = null; netP = null; }
  return { update, clear, info: () => ({ lanes: net ? net.lanes.length : 0, riders: riders.length, scoot: riders.filter(r => r.scoot).length, at: riders.slice(0, 3).map(r => [Math.round(r.x), Math.round(r.z)]) }), riders: () => riders };
}
