// cityplan3d.js — 3D изглед на плана от cityplan.js: естествен терен (без квадратна плоча), вода, извити улици,
// кръстовища, площад, парцели и поставяне на сгради спрямо парцела.
// Паметта: всичко е в няколко слети геометрии с общи материали (без текстури); дървета и лампи — InstancedMesh;
// подробностите (лампи, зебри, очертания на парцелите) се показват само отблизо.
import * as THREE from 'three';
import { pointAt, rectCorners, rectHas } from './cityplan.js';

const MAT = {};   // общи материали за всички градове
function mats() {
  if (MAT.asph) return MAT;
  const m = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...o });
  Object.assign(MAT, {
    terrain: m(0xffffff, { vertexColors: true }),
    water: m(0x3d7fa6, { roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.9 }),
    asph: m(0x3a3d42, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    walk: m(0xb9b4a8, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    paint: m(0xf2f2ea, { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    plaza: m(0xcfc6b2, { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    lot: m(0xffffff, { vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    bridge: m(0x9c968a), pole: m(0x50555c), lamp: m(0xfff3c4, { emissive: 0x5a4a20 }),
    trunk: m(0x6b4a2e), leaf: m(0x4f7d3a), pine: m(0x3d6a3a), stone: m(0xd8d2c4), fountain: m(0x6fb4d6, { roughness: 0.2 }),
    edge: new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
  });
  return MAT;
}
// лента по линия: pts [[x,z]], ширина, височина по точка
function ribbon(pts, w, yOf, pos, idx) {
  const base = pos.length / 3;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const y = yOf(i);
    pos.push(pts[i][0] - dz * w / 2, y, pts[i][1] + dx * w / 2, pts[i][0] + dz * w / 2, y, pts[i][1] - dx * w / 2);
    if (i) { const k = base + 2 * i; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  }
}
function disc(x, z, rad, y, pos, idx, seg = 20) {
  const base = pos.length / 3; pos.push(x, y, z);
  for (let k = 0; k <= seg; k++) { const a = k / seg * Math.PI * 2; pos.push(x + Math.cos(a) * rad, y, z + Math.sin(a) * rad); if (k) idx.push(base, base + k + 1, base + k); }
}
function mesh(pos, idx, mat, col) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const o = new THREE.Mesh(g, mat); o.receiveShadow = true; return o;
}

export function buildPlanView(P0, opts = {}) {
  const M = mats(), g = new THREE.Group(), detail = new THREE.Group(); g.add(detail);
  // opts.seaZ — морето на играта (seaside.js) на север: там теренът слиза под водата
  const sea = opts.seaZ, P = sea == null ? P0 : { ...P0, waterAt: (x, z) => z < sea || P0.waterAt(x, z), heightAt: (x, z) => z < sea ? -3 : P0.heightAt(x, z) };
  g.userData.plan = P;
  // --- терен: голяма мрежа с релеф и цветове по вершини (без текстури)
  const S = opts.size || 1400, seg = opts.seg || 150;
  const tg = new THREE.PlaneGeometry(S, S, seg, seg); tg.rotateX(-Math.PI / 2);
  const pa = tg.attributes.position, col = new Float32Array(pa.count * 3), c = new THREE.Color();
  const grass = new THREE.Color(0x86ad62), park = new THREE.Color(0x93b86b), sand = new THREE.Color(0xdcc994), rock = new THREE.Color(0x8d8576), snow = new THREE.Color(0xf1f1ee), bed = new THREE.Color(0x6f8f86), field = new THREE.Color(0xa6b46a);
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), z = pa.getZ(i), h = P.heightAt(x, z), w = P.waterAt(x, z);
    pa.setY(i, w ? -3 : h);
    if (w) c.copy(bed);
    else {
      c.copy(grass);
      const f = Math.sin(x / 61) * Math.cos(z / 47) + Math.sin((x + z) / 29) * 0.5;   // ниви и поляни извън града
      if (P.parkAt && P.parkAt(x, z)) c.setHex(0x5f9a45);   // парк от картата (Южен парк, Докторска градина…)
      else if (!P.buildable(x, z)) c.lerp(field, Math.max(0, f) * 0.6); else c.lerp(park, 0.4);
      if (h > 8) c.lerp(rock, Math.min(1, (h - 8) / 25)); if (h > 45) c.lerp(snow, Math.min(1, (h - 45) / 15));
      if (P.waterAt(x + 9, z) || P.waterAt(x - 9, z) || P.waterAt(x, z + 9) || P.waterAt(x, z - 9)) c.copy(sand);   // бряг
    }
    col[3 * i] = c.r; col[3 * i + 1] = c.g; col[3 * i + 2] = c.b;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3)); tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, M.terrain); g.userData.groundMat = M.terrain; terrain.receiveShadow = true; terrain.name = 'terrain'; g.add(terrain);
  if (P.tpl === 'coastal' || P.tpl === 'river' || P.tpl === 'island' || P.coastZ) {   // coastZ: и заливът на Амстердам, морето на Барселона
    const wg = new THREE.PlaneGeometry(S, S); wg.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(wg, M.water); water.position.y = -0.6; water.name = 'water'; g.add(water);
  }
  if (P.canals) for (const rc of P.canals.rings) {   // каналите (8 м) са по-тесни от клетката на терена — отделни ивици вода (полукръг на юг от центъра)
    const r = new THREE.Mesh(new THREE.RingGeometry(rc - 4, rc + 4, 72, 1, Math.PI, Math.PI).rotateX(-Math.PI / 2), M.water);
    r.position.set(P.canals.c[0], -0.3, P.canals.c[1]); r.name = 'canal'; g.add(r);
  }
  // --- улици: тротоар (по-широк) + асфалт; мост над водата; маркировка на булевардите
  const walk = [[], []], asph = [[], []], paint = [[], []], br = [[], []];
  for (const st of P.streets) {
    const wet = st.pts.map(p => P.waterAt(p[0], p[1]));
    const yb = st.pts.map((p, i) => { let m = 0; for (let k = -8; k <= 8; k++) if (wet[i + k]) m = Math.max(m, 1 - Math.abs(k) / 9); return m * 2.2; });   // рампа към моста
    const gh = st.pts.map((p, i) => wet[i] ? 0 : Math.max(0, P.heightAt(p[0], p[1])));   // извън града пътят следва релефа
    for (let i = 0; i < yb.length; i++) yb[i] += gh[i];
    ribbon(st.pts, st.w + 3.4, i => 0.03 + yb[i], ...walk);
    ribbon(st.pts, st.w, i => 0.06 + yb[i], ...asph);
    if (wet.some(Boolean)) {   // парапетите и плочата на моста
      let run = []; const flush = () => { if (run.length > 1) { const ps = run.map(i => st.pts[i]); ribbon(ps, st.w + 4, j => yb[run[j]] - 0.6, ...br); } run = []; };
      wet.forEach((w, i) => { if (yb[i] > 0.5) run.push(i); else flush(); }); flush();
    }
    if (st.w >= 10) {   // прекъсната средна линия — не в кръстовищата
      const L = st.L.at(-1), nodes = P.nodes.filter(n => !n.square);
      for (let s = 3; s < L - 3; s += 6) {
        const a = pointAt(st, s), b = pointAt(st, s + 3);
        if (nodes.some(n => Math.hypot(n.x - a.x, n.z - a.z) < st.w)) continue;
        const i0 = Math.round(s / 2);
        ribbon([[a.x, a.z], [b.x, b.z]], 0.25, () => 0.09 + (yb[i0] || 0), ...paint);
      }
    }
  }
  // кръстовища: асфалтов кръг (крие застъпването на лентите) и зебри на всеки изход
  const zebra = [[], []];
  for (const n of P.nodes) {
    if (n.square || n.deg < 3) continue;
    const ny = Math.max(0, P.heightAt(n.x, n.z));
    const ws = P.edges.filter(e => e.a === P.nodes.indexOf(n) || e.b === P.nodes.indexOf(n)).map(e => P.streets[e.st].w);
    const rad = Math.max(...ws, 7) / 2 + 0.6;
    disc(n.x, n.z, rad + 1.7, 0.035 + ny, ...walk); disc(n.x, n.z, rad, 0.07 + ny, ...asph);
  }
  // зебри и светофари — само на истинските кръстовища: поне един булевард/пръстен, без съседно кръстовище по-близо от 22 м
  // (извитите улици дават много близки възли — там зебрите се застъпваха); зебра само на изход, по-дълъг от 16 м
  const major = [];
  P.nodes.forEach((n, ni) => {
    if (n.square || n.deg < 3 || P.heightAt(n.x, n.z) > 0.3) return;
    const es = P.edges.filter(e => e.a === ni || e.b === ni);
    if (!es.some(e => P.streets[e.st].w >= 10)) return;
    if (major.some(m => Math.hypot(m.n.x - n.x, m.n.z - n.z) < 22)) return;
    major.push({ n, ni, es });
  });
  const sig = [];   // [x, z, ос (ъгъл на улицата)] — светофар на десния ъгъл на всеки изход
  for (const { ni, es } of major) for (const e of es) {
    if (Math.abs(e.s1 - e.s0) < 16) continue;
    const st = P.streets[e.st], s = e.a === ni ? e.s0 : e.s1, dir = e.a === ni ? 1 : -1, rad = st.w / 2 + 4.5;
    const p = pointAt(st, s + dir * rad);
    for (let k = -st.w / 2 + 0.8; k < st.w / 2 - 0.5; k += 1.3) {
      const cx = p.x - p.tz * k, cz = p.z + p.tx * k;
      ribbon([[cx - p.tx * 1.4, cz - p.tz * 1.4], [cx + p.tx * 1.4, cz + p.tz * 1.4]], 0.6, () => 0.1, ...zebra);
    }
    const o = st.w / 2 + 1.0, q = pointAt(st, s + dir * (rad + 2.2));
    sig.push([q.x - q.tz * o * dir, q.z + q.tx * o * dir, Math.atan2(q.tx, q.tz), Math.abs(q.tx) > Math.abs(q.tz) ? 0 : 1]);
  }
  g.add(mesh(...walk, M.walk), mesh(...asph, M.asph), mesh(...paint, M.paint));
  if (br[0].length) g.add(mesh(...br, M.bridge));
  const zm = mesh(...zebra, M.paint); detail.add(zm);
  // --- площад: павета, фонтан, кръг от дървета
  const sq = P.square, pl = [[], []]; disc(sq.x, sq.z, sq.r + 1, 0.08, ...pl, 32);
  g.add(mesh(...pl, M.plaza));
  if (!opts.noFountain) { const f = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 0.8, 24), M.stone); f.position.set(sq.x, 0.4, sq.z); g.add(f);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 0.1, 24), M.fountain); w.position.set(sq.x, 0.82, sq.z); g.add(w);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 4, 10), M.stone); s.position.set(sq.x, 2.2, sq.z); g.add(s); }
  // --- парцели: светли площадки (цвят по зона), очертания отблизо
  const lp = [[], [], []], le = [], zc = { center: new THREE.Color(0xc9c1ad), mid: new THREE.Color(0xb7bd98), outer: new THREE.Color(0xa3b97f) };
  for (const L of P.lots.slice(0, opts.lotCount ?? P.lots.length)) {   // в играта — само купените (ядро + кварталите)
    const cs = rectCorners(L.x, L.z, L.w / 2, L.d / 2, L.rot), b = lp[0].length / 3, cc = zc[L.zone];
    for (const p of cs) { lp[0].push(p[0], 0.04, p[1]); lp[2].push(cc.r, cc.g, cc.b); }
    lp[1].push(b, b + 2, b + 1, b, b + 3, b + 2);
    for (let k = 0; k < 4; k++) { const p = cs[k], q = cs[(k + 1) % 4]; le.push(p[0], 0.12, p[1], q[0], 0.12, q[1]); }
  }
  g.add(mesh(lp[0], lp[1], M.lot, lp[2]));
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(le, 3));
  const edges = new THREE.LineSegments(eg, M.edge); edges.name = 'lotEdges'; detail.add(edges);
  // --- лампи по булевардите (InstancedMesh: стълб + глава)
  const lampAt = [];
  for (const st of P.streets) if (st.w >= 10) for (let s = 8; s < st.L.at(-1) - 4; s += 22) for (const side of [1, -1]) {
    const p = pointAt(st, s), o = st.w / 2 + 1.1; if (P.waterAt(p.x, p.z) || !P.buildable(p.x, p.z) && P.heightAt(p.x, p.z) > 0.3) continue;
    lampAt.push([p.x - p.tz * o * side, p.z + p.tx * o * side]);
  }
  const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), M.pole, lampAt.length);
  const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 8, 6), M.lamp, lampAt.length), m4 = new THREE.Matrix4();
  lampAt.forEach(([x, z], i) => { pole.setMatrixAt(i, m4.makeTranslation(x, 3, z)); head.setMatrixAt(i, m4.makeTranslation(x, 6.1, z)); });
  detail.add(pole, head);
  // --- светофари на големите кръстовища: стълб + кутия + червена/зелена светлина; двете оси се редуват (g.userData.update)
  if (sig.length) {
    const sp = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.12, 4.2, 6), M.pole, sig.length);
    const bx = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 1.3, 0.45), new THREE.MeshStandardMaterial({ color: 0x1d2126, roughness: 0.6 }), sig.length);
    const red = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b30 }), sig.length);
    const grn = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 8, 6), new THREE.MeshBasicMaterial({ color: 0x34e05a }), sig.length);
    const q = new THREE.Quaternion(), e3 = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), off = new THREE.Vector3();
    const put = (im, i, x, y, z, a, fwd) => { off.set(0, 0, fwd).applyEuler(e3.set(0, a, 0)); im.setMatrixAt(i, m4.compose(v.set(x + off.x, y, z + off.z), q.setFromEuler(e3.set(0, a, 0)), one)); };
    sig.forEach(([x, z, a], i) => { put(sp, i, x, 0, z, a, 0); sp.setMatrixAt(i, m4.makeTranslation(x, 2.1, z)); put(bx, i, x, 4.3, z, a, 0); put(red, i, x, 4.7, z, a, -0.24); put(grn, i, x, 3.9, z, a, -0.24); });
    detail.add(sp, bx, red, grn);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0), mR = [], mG = [];
    for (let i = 0; i < sig.length; i++) { red.getMatrixAt(i, m4); mR.push(m4.clone()); grn.getMatrixAt(i, m4); mG.push(m4.clone()); }
    let ph = -1;
    g.userData.update = t => {   // 8 s зелено за едната ос, 8 s за другата (жълтото — пропуснато, за простота)
      const p2 = Math.floor(t / 8) % 2; if (p2 === ph) return; ph = p2;
      sig.forEach((s0, i) => { const go = s0[3] === p2; red.setMatrixAt(i, go ? zero : mR[i]); grn.setMatrixAt(i, go ? mG[i] : zero); });
      red.instanceMatrix.needsUpdate = grn.instanceMatrix.needsUpdate = true;
    };
    g.userData.update(0);
  }
  g.userData.lamps = lampAt.filter((_, i) => i % Math.ceil(lampAt.length / 160) === 0).map(([x, z]) => ({ x, y: 6.1, z }));   // светлините нощем (daynight.js) — до 160
  // --- дървета: в града (около площада, празните кътчета) и гори по хълмовете — общи инстанции
  const trees = [], rnd = (() => { let s = 1234567; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  for (let k = 0; k < (opts.noFountain ? 16 : 10); k++) { const a = k / (opts.noFountain ? 16 : 10) * Math.PI * 2; trees.push([sq.x + Math.cos(a) * (sq.r - 2.5), sq.z + Math.sin(a) * (sq.r - 2.5), 0.9, 0]); }
  const roadNear = (x, z, pad) => P.streets.some(st => st.pts.some((p, i) => i % 2 === 0 && Math.abs(p[0] - x) < st.w / 2 + pad && Math.abs(p[1] - z) < st.w / 2 + pad));
  const lotNear = (x, z) => P.lots.slice(0, opts.lotCount ?? P.lots.length).some(L => Math.abs(L.x - x) < 14 && Math.abs(L.z - z) < 14);
  for (let k = 0; k < (opts.trees || 2200); k++) {
    const x = (rnd() - 0.5) * S * 0.8, z = (rnd() - 0.5) * S * 0.8, h = P.heightAt(x, z);
    if (P.waterAt(x, z) || h > 55) continue;
    const inTown = P.buildable(x, z);
    if (inTown && (rnd() < 0.55 || lotNear(x, z))) continue;
    const inPark = P.parkAt && P.parkAt(x, z);
    if (!inTown && !inPark && h < 4 && rnd() < 0.72) continue;   // равното извън града — ниви, рядко дърво
    if (roadNear(x, z, 3)) continue;
    if (P.bigZone && rectHas(P.bigZone, [x, z], 4)) continue;   // мястото на голямата забележителност
    trees.push([x, z, 0.7 + rnd() * 0.7, h > 6 ? 1 : 0]);
  }
  // парковете от картата — гъста гора от дървета (до 1600), без да стъпват на улица
  for (const q of P.parks || []) {
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of q.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const n = Math.min(500, ((x1 - x0) * (z1 - z0)) / 70);
    for (let k = 0; k < n && trees.length < 2600; k++) {
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
      if (!P.parkAt(x, z) || roadNear(x, z, 2)) continue;
      trees.push([x, z, 0.75 + rnd() * 0.6, rnd() < 0.25 ? 1 : 0]);
    }
  }
  const cone = new THREE.ConeGeometry(2.2, 6, 7), ball = new THREE.IcosahedronGeometry(2.6, 0), stem = new THREE.CylinderGeometry(0.28, 0.36, 2.4, 5);
  const N = [trees.filter(t => !t[3]).length, trees.filter(t => t[3]).length];
  const tr = new THREE.InstancedMesh(stem, M.trunk, trees.length), lb = new THREE.InstancedMesh(ball, M.leaf, N[0]), lc = new THREE.InstancedMesh(cone, M.pine, N[1]);
  const q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(); let i0 = 0, i1 = 0;
  trees.forEach(([x, z, s, pine], i) => {
    const y = P.heightAt(x, z);
    tr.setMatrixAt(i, m4.compose(v.set(x, y + 1.2 * s, z), q, sc.set(s, s, s)));
    if (pine) lc.setMatrixAt(i1++, m4.compose(v.set(x, y + (2.4 + 3) * s, z), q, sc.set(s, s, s)));
    else lb.setMatrixAt(i0++, m4.compose(v.set(x, y + (2.4 + 2) * s, z), q, sc.set(s, s * 1.15, s)));
  });
  for (const o of [tr, lb, lc]) { o.castShadow = true; g.add(o); }
  // --- подробности само отблизо
  g.userData.lod = cam => { const d = cam.position.distanceTo(opts.target || new THREE.Vector3()); detail.visible = d < (opts.detailDist || 420); };
  return g;
}

// сграда върху парцел: завърта се с лицето към улицата, вписва се в парцела (с отстъп), центрира се по рамката
const box = new THREE.Box3(), sz = new THREE.Vector3();
export function placeOnLot(obj, L, { margin = 2.5, extraRot = 0 } = {}) {
  obj.rotation.set(0, 0, 0); obj.scale.setScalar(1); obj.position.set(0, 0, 0); obj.updateMatrixWorld(true);
  box.setFromObject(obj); box.getSize(sz);
  const k = Math.min((L.w - 2 * margin) / sz.x, (L.d - 2 * margin) / sz.z);   // локалното x на модела е по улицата, z — към нея
  obj.scale.setScalar(k);
  const cx = (box.min.x + box.max.x) / 2 * k, cz = (box.min.z + box.max.z) / 2 * k, rot = L.rot + extraRot, c = Math.cos(rot), s = Math.sin(rot);
  obj.rotation.y = rot;
  obj.position.set(L.x - (cx * c + cz * s), -box.min.y * k, L.z - (-cx * s + cz * c));
  return obj;
}
