// airportaccess.js — ✈️ airport-access (T1): булевард от летището до най-близката улица на града, паркинг пред терминала (расте с нивото)
// и обръщало за слизане; нощем — лампи по булеварда и над паркинга. Само изглед (парцелите и графът на движението не се пипат).
// Летището (airport.js) стои в групата си без завъртане: терминалът гледа към пистата (+x), откъм града (−x) е паркингът.
// const a = buildAirportAccess({ parent, at: [x, z], lv, roads: [[[x, z], …], …] (в света), lots: [{ x, z, w, d, rot }], lampMat, poolMat });  a.dispose()
import * as THREE from 'three';

const W = 11, MED = 1.4;   // ширината на булеварда (2 × 2 ленти) и зелената ивица по средата
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function nearestOn(p, roads) {   // най-близките точки по улиците (по една на улица), подредени по разстояние; dir — посоката на улицата там, i — коя
  const out = [];
  roads.forEach((pts, ri) => { let best = null;
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)), q = [a[0] + dx * t, a[1] + dz * t], d = dist(p, q);
      if (!best || d < best.d) best = { q, d, dir: Math.atan2(dz, dx), i: ri }; }
    if (best) out.push(best); });
  return out.sort((a, b) => a.d - b.d);
}
const segDist = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)); return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t); };
export function hitsLot(a, b, lots) {   // отсечката a→b минава ли през парцел (проба през 4 м, с марж)
  const n = Math.max(2, Math.ceil(dist(a, b) / 4));
  for (let k = 1; k < n - 2; k++) { const p = [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n];
    for (const L of lots) { const c = Math.cos(L.rot || 0), s = Math.sin(L.rot || 0), dx = p[0] - L.x, dz = p[1] - L.z;
      if (Math.abs(dx * c - dz * s) <= L.w / 2 + 3 && Math.abs(dx * s + dz * c) <= L.d / 2 + 3) return true; } }
  return false;
}
export function buildAirportAccess(o) {
  const g = new THREE.Group(); g.name = 'airportAccess'; o.parent.add(g);
  const [ax, az] = o.at, lv = Math.max(1, o.lv || 1), J = o.road || o.junction, start = J ? [ax - 70, az - 12] : [ax - 20, az];   // air-junction: от началото на входния път на летището (airport.js: x −70, z −12) — паркингът и кръговото са негови
  const roads = o.roads || [], hwOf = i => ((o.roadsW || [])[i] || 8) / 2;
  const segs = []; roads.forEach((pts, i) => { for (let k = 1; k < pts.length; k++) segs.push([pts[k - 1], pts[k], hwOf(i) + 2.5]); });
  let end;
  if (o.road) { end = null; for (let k = 1; k < o.road.pts.length; k++) segs.push([o.road.pts[k - 1], o.road.pts[k], o.road.hw]); }   // air-junction: пътят е в графа на плана — рисува го планът (с кръстовището)
  else if (o.junction) {   // air-junction без граф: до РЪБА на улицата, под ъгъл ≥ ~50° към нея (не успоредно, не върху нея)
    const C = nearestOn(start, roads).slice(0, 10), ok = c => { const L = Math.max(c.d, 1e-3), u = [(start[0] - c.q[0]) / L, (start[1] - c.q[1]) / L]; return c.d < 900 && Math.abs(u[0] * Math.cos(c.dir) + u[1] * Math.sin(c.dir)) < 0.65 && !hitsLot(start, c.q, o.lots || []); };
    const pick = C.find(ok) || C[0];
    if (pick && pick.d < 900) { const hw = hwOf(pick.i) + 0.3, L = Math.max(pick.d, 1e-3); end = pick.d > hw + 2 ? [pick.q[0] + (start[0] - pick.q[0]) / L * hw, pick.q[1] + (start[1] - pick.q[1]) / L * hw] : null; }   // улицата минава до самото летище — без булевард
    else end = [start[0] - 60, start[1]];
  } else {
  // целта: най-близката улица, до която правият път не минава през парцел (до 8 кандидата); иначе — направо на запад
  const s0 = [ax - 31, az], C = nearestOn(s0, roads).slice(0, 8), pick = C.find(c => c.d > 6 && c.d < 900 && !hitsLot(s0, c.q, o.lots || [])) || C[0];
  end = pick && pick.d < 900 ? pick.q : [s0[0] - 60, s0[1]]; start[0] = s0[0]; }
  const asph = new THREE.MeshStandardMaterial({ color: 0x4a4e55, roughness: 0.95 }), green = new THREE.MeshStandardMaterial({ color: 0x5f9a45, roughness: 1 }), white = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
  const strip = (a, b, w, y, m) => { const L = dist(a, b); if (L < 0.5) return null; const s = new THREE.Mesh(new THREE.PlaneGeometry(L, w), m); s.rotation.x = -Math.PI / 2; s.rotation.z = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    s.position.set((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2); s.receiveShadow = true; g.add(s); return s; };
  // булевардът: асфалт, зелена ивица, прекъснати линии
  if (end) { strip(start, end, W, 0.07, asph); strip(start, end, MED, 0.09, green); segs.push([start, end, W / 2 + 1]); }
  if (end) { const L = dist(start, end), ux = (end[0] - start[0]) / L, uz = (end[1] - start[1]) / L, nx = -uz, nz = ux;
    for (let d = 4; d < L - 4; d += 9) for (const off of [-2.9, 2.9]) { const c = [start[0] + ux * d + nx * off, start[1] + uz * d + nz * off]; strip([c[0] - ux * 1.5, c[1] - uz * 1.5], [c[0] + ux * 1.5, c[1] + uz * 1.5], 0.15, 0.1, white); }
    // лампите: през ~26 м от двете страни
    const post = new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.5, metalness: 0.4 }), pg = new THREE.CylinderGeometry(0.1, 0.12, 8, 6).translate(0, 4, 0), hg = new THREE.BoxGeometry(1.2, 0.2, 0.45);
    const lamp = (x, z, ry) => { const p = new THREE.Mesh(pg, post); p.position.set(x, 0, z); g.add(p); const h = new THREE.Mesh(hg, o.lampMat); h.position.set(x, 8, z); h.rotation.y = ry; g.add(h);
      if (o.poolMat) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), o.poolMat); pl.rotation.x = -Math.PI / 2; pl.position.set(x, 0.12, z); pl.renderOrder = 2; g.add(pl); } };
    for (let d = 10, k = 0; d < L - 6; d += 26, k++) { const sd = k % 2 ? 1 : -1, x = start[0] + ux * d + nx * sd * (W / 2 + 1), z = start[1] + uz * d + nz * sd * (W / 2 + 1); lamp(x, z, -Math.atan2(uz, ux)); } }
  // паркингът пред терминала (−x страната на летището) — повече места с нивото; обръщалото пред входа
  let rows = Math.min(6, 1 + lv), pw = 18, pd = 6 + rows * 5.2, px = ax - 22, pzc = az;
  if (J) rows = 0;   // air-junction: летището (airport.js) има свой паркинг, кръгово и булевард покрай терминала — тук само пътят до града
  const pz0 = pzc - pd / 2;
  if (rows) { const lot = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), asph); lot.rotation.x = -Math.PI / 2; lot.position.set(px, 0.08, pzc); lot.receiveShadow = true; g.add(lot); }
  for (let r = 0; r < rows; r++) for (let k = 0; k <= 6; k++) { const z = pz0 + 4 + r * 5.2, x = px - pw / 2 + 2 + k * 2.4; strip([x, z - 2.2], [x, z + 2.2], 0.12, 0.1, white); }
  if (!J) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 8, 28), asph); ring.rotation.x = -Math.PI / 2; ring.position.set(ax - 12, 0.085, az); g.add(ring);
  const isl = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24), green); isl.rotation.x = -Math.PI / 2; isl.position.set(ax - 12, 0.1, az); g.add(isl); }
  return { group: g, end: end || (o.road ? o.road.pts[0] : start), len: end ? Math.round(dist(start, end)) : 0, park: rows ? { x: px, z: pzc, w: pw, d: pd } : null, graph: !!o.road, dispose() { o.parent.remove(g); } };
}
