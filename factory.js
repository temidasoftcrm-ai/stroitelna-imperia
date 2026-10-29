// factory.js — 🏭 ind-factory (f6, модел на потребителя — Meshy, Темидасофт): заводът в индустриалната зона в края на града.
// Хале ~65 × 64 м, два червено-бели комина по 52 м (Blender: Body, Smoke_<i> — върховете на комините, Beacon_<i> — червените лампи).
// Мястото: извън границата на града (не се пипат парцелите — старите записи остават същите), на сушата, далеч от улиците и жп линията;
// 1 завод в малките и средните градове, 2 — в големите; лицето — към центъра. Нощем: прозорците (тъмносиньото стъкло) светят топло,
// лампите на комините мигат червено; от комините винаги излиза дим. Около завода — двор (бетон), площадка за камионите пред рампата, паркинг
// за служителите, ограда с бариера на входа и път (2 ленти, лампи) до най-близката улица (като airport-access); 2 камиона на рампата и един,
// който от време на време кара по пътя до града и обратно. Само изглед — графът на движението и парцелите не се пипат.
//   game.js: placeFactories({ THREE, P, model, group, tier, railX, addWin, roads, lots, truck, poolMat, spin, extra: { model(key), worker(key, clip) → { obj, mixer } } }) → { update(dt, night), clear() }
import { nearestOn, hitsLot } from './airportaccess.js';
const FW = 66, APR = 34, YM = 7, RW = 7.5;   // м: страната на завода; дълбочината на площадката отпред; дворът около него; ширината на пътя

export function placeFactories(o) {
  const { THREE, P, group } = o, out = [], sq = P.square || P.center || { x: 0, z: 0 }, tg = P.toGame || ((x, z) => [x, z]);
  const B = (P.p2 && P.p2.boundary || []).map(p => tg(p[0], p[1])); if (B.length < 3) return null;
  const R = FW / 2 + YM + APR, G = blockGrid(THREE, o, P), U = FW / 2 + YM + 4, V0 = -FW / 2 - YM - 4, V1 = FW / 2 + APR + 4;
  // отпечатъкът (заводът + дворът + оградата + 4 м) — свободен ли е: без улици, магистрала, жп, летищния път, вода, парцели, други заводи
  const fits = (x, z, ry) => { const cs = Math.cos(ry), sn = Math.sin(ry); for (let u = -U; u <= U; u += 4) for (let v = V0; v <= V1; v += 4) { const px = x + u * cs + v * sn, pz = z - u * sn + v * cs; if (G.hard(px, pz) || G.road(px, pz)) return false; } return true; };
  const n = o.tier === 'l' || o.tier === 'xl' ? 2 : 1, pick = [], step = Math.max(1, Math.floor(B.length / 72)), cand = [];
  for (let i = 0; i < B.length; i += step) { const [bx, bz] = B[i], dx = bx - sq.x, dz = bz - sq.z, l = Math.hypot(dx, dz) || 1, a = Math.atan2(dx, dz), ry = a + Math.PI;
    for (let d = R + 14; d < R + 330; d += 12) { const x = bx + dx / l * d, z = bz + dz / l * d; if (!fits(x, z, ry)) continue;   // първото свободно — най-близо до града (зад магистралата, ако тя е по-близо)
      const gate = [x + (-FW / 2 * 0.35) * Math.cos(ry) + (FW / 2 + APR) * Math.sin(ry), z - (-FW / 2 * 0.35) * Math.sin(ry) + (FW / 2 + APR) * Math.cos(ry)], route = G.route(gate);
      if (route) { cand.push({ x, z, a, d, route, len: route.reduce((s, p, k) => s + (k ? Math.hypot(p[0] - route[k - 1][0], p[1] - route[k - 1][1]) : 0), 0) }); break; } } }
  cand.sort((a, b) => (a.d + a.len * 0.5) - (b.d + b.len * 0.5));
  for (const c of cand) { if (pick.length >= n) break; if (pick.every(p => Math.hypot(p.x - c.x, p.z - c.z) > 2 * R + 40) && pick.every(p => !p.route.some(q => Math.hypot(q[0] - c.x, q[1] - c.z) < R))) pick.push(c); }
  const beacons = [], smokes = [], drives = [], tex = smokeTex(THREE), M = mats(THREE, o);
  for (const c of pick) { const m = o.model(); if (!m) break; const ry = c.a + Math.PI; m.position.set(c.x, 0, c.z); m.rotation.y = ry;   // лицето (+z) — към центъра
    m.traverse(q => { if (q.isMesh && /^Beacon/.test(q.name)) { q.material = new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); q.scale.setScalar(1.3); beacons.push(q.material); } });
    group.add(m); out.push(m); m.updateMatrixWorld(true);
    m.traverse(q => { if (/^Smoke_/.test(q.name)) { const w = q.getWorldPosition(new THREE.Vector3()); smokes.push(plume(THREE, group, tex, w, out)); } });
    const site = yard(THREE, o, M, c, ry, c.route); group.add(site.g); out.push(site.g); if (site.drive) drives.push(site.drive);
    if (o.zone2) { const sd = siding(THREE, o, G, c, ry); if (sd) { group.add(sd); out.push(sd); c.siding = 1; } const v = visitors(THREE, o, c, ry, c.route); if (v) { group.add(v.g); out.push(v.g); drives.push(v.drive); } }   // 🏭 ind-streets2
    if (o.extra) extras(THREE, o, G, c, ry, out, drives); }
  if (!out.length) return null;
  return { grid: G, list: out, sdWhy: () => o._sdWhy, railX: o.railX, at: pick.map(c => ({ x: Math.round(c.x), z: Math.round(c.z), under: !!c.route.under, siding: !!c.siding, road: Math.round(c.len), end: c.route[c.route.length - 1].map(Math.round) })),
    update(dt, night) { const t = performance.now() / 1000; for (const b of beacons) b.opacity = t % 1.6 < 0.35 ? 0.12 + 0.88 * night : 0.04 * night;   /* денем — едва */ for (const s of smokes) s(dt, night); for (const d of drives) d(dt); },
    clear() { for (const m of out) m.parent && m.parent.remove(m); } };
}
// 🏭 ind-streets2 (T2, координаторът: „жп отклонение до зоната, ако линията е наблизо; камиони и бусове, които завиват от улицата“) — само изглед, без traffic.js:
// siding — коловоз от линията на града (o.railX, ако дворът е на 20–320 м): отклонение под ъгъл, после направо до рампа за товарене със стоп-буфер,
//   баласт, траверси (инстанции), две релси и 3 вагона (o.wagon); не минава през парцели и през повече от 2 клетки улица — иначе няма отклонение;
// visitors — 2–3 камиона/буса идват от улицата по пътя на завода (в дясната си лента), спират на рампата и си отиват; далеч от камерата (o.near) — скрити и спрени
function siding(THREE, o, G, c, ry) {
  if (o.railX == null) return null;
  const cs = Math.cos(ry), sn = Math.sin(ry), W = (u, v) => [c.x + u * cs + v * sn, c.z - u * sn + v * cs], U = FW / 2 + YM + 10, V0 = -FW / 2 - YM - 10, V1 = FW / 2 + APR;
  let best = null; const tryP = (u, v) => { const [x, z] = W(u, v), d = Math.abs(x - o.railX); if (!best || d < best.d) best = { d, x, z }; };
  for (let u = -U; u <= U; u += 6) tryP(u, V0); for (let v = V0; v <= V1 - 10; v += 6) { tryP(-U, v); tryP(U, v); }
  if (!best || best.d > 320 || best.d < 20) { o._sdWhy = 'dist ' + (best && Math.round(best.d)); return null; }
  const sg = Math.sign(best.x - o.railX), x0 = o.railX + sg * (o.railOff ?? 0), dz = best.z > c.z ? -1 : 1, X1 = x0 + sg * 14, E = [best.x - sg * 2, best.z], R = Math.max(10, Math.min(40, (Math.abs(E[0] - X1) - 12) / 2));
  const A = [x0, best.z + dz * (R + 100)], D = [X1, best.z + dz * (R + 40)], pts = [A, D];   // стрелката: от коловоза под малък ъгъл, после успоредно, после дъга R към рампата
  for (let k = 0; k <= 10; k++) { const t = k / 10 * Math.PI / 2; pts.push([X1 + sg * R - sg * R * Math.cos(t), best.z + dz * R - dz * R * Math.sin(t)]); }
  pts.push(E); let roadN = 0;
  for (let i = 1; i < pts.length; i++) { const [a, b] = [pts[i - 1], pts[i]], L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0; s <= L; s += 4) { const x = a[0] + (b[0] - a[0]) * s / L, z = a[1] + (b[1] - a[1]) * s / L; if (Math.abs(x - o.railX) < 31) continue; if (G.hard(x, z)) { o._sdWhy = 'hard ' + Math.round(x) + ',' + Math.round(z); return null; } if (G.road(x, z)) roadN++; } }
  if (roadN > 2) { o._sdWhy = 'roads ' + roadN; return null; }
  const g = new THREE.Group(); g.name = 'indSiding';
  const ball = new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 1 }), wood = new THREE.MeshStandardMaterial({ color: 0xb1aca2, roughness: 0.95 }), steel = new THREE.MeshStandardMaterial({ color: 0x6d6a66, roughness: 0.4, metalness: 0.7 }),
    conc = new THREE.MeshStandardMaterial({ color: 0x9a978f, roughness: 0.95 }), red = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.6 }), sl = [];
  for (let i = 1; i < pts.length; i++) { const [a, b] = [pts[i - 1], pts[i]], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.5) continue; const ang = Math.atan2(b[0] - a[0], b[1] - a[1]), mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    const bl = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, L + 2), ball); bl.position.set(mx, 0.06, mz); bl.rotation.y = ang; bl.receiveShadow = true; g.add(bl);
    for (const off of [-0.72, 0.72]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, L + 0.8), steel); r.position.set(mx + Math.cos(ang) * off, 0.27, mz - Math.sin(ang) * off); r.rotation.y = ang; g.add(r); }
    for (let s = 0.4; s < L; s += 0.75) sl.push([a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L, ang]); }
  { const im = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 0.12, 0.25), wood, sl.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    sl.forEach(([x, z, a], i) => im.setMatrixAt(i, m4.compose(new THREE.Vector3(x, 0.16, z), q.setFromAxisAngle(up, a), one))); im.receiveShadow = true; g.add(im); }
  const F = pts[pts.length - 2], L3 = Math.hypot(E[0] - F[0], E[1] - F[1]), ux = (E[0] - F[0]) / (L3 || 1), uz = (E[1] - F[1]) / (L3 || 1), ang3 = Math.atan2(ux, uz), pl = Math.min(34, L3 - 4), side = dz;   // рампата — от страната на завода
  if (pl > 8) { const b = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.1, pl), conc); b.position.set(E[0] - ux * (pl / 2 + 2) - uz * 3.4 * side, 0.55, E[1] - uz * (pl / 2 + 2) + ux * 3.4 * side); b.rotation.y = ang3; b.castShadow = b.receiveShadow = true; g.add(b); }
  { const bs = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 0.6), red); bs.position.set(E[0], 0.7, E[1]); bs.rotation.y = ang3; g.add(bs); }   // стоп-буферът
  if (o.wagon) { let s = 3; for (let k = 0; k < 3; k++) { const w = o.wagon(k); if (!w) break; const len = w.userData.len || 14; if (s + len > L3 - 2) break; w.position.set(E[0] - ux * (s + len / 2), 0.28, E[1] - uz * (s + len / 2)); w.rotation.y = ang3; w.traverse(m => { if (m.isMesh) m.castShadow = true; }); g.add(w); s += len + 0.8; } }
  return g;
}
function visitors(THREE, o, c, ry, rt) {
  if (!o.visitor || !rt || rt.length < 2) return null;
  const cs = Math.cos(ry), sn = Math.sin(ry), W = (u, v) => [c.x + u * cs + v * sn, c.z - u * sn + v * cs], H = FW / 2, gu = -H * 0.35;
  const path = [W(gu + 3, H + 14), ...rt], segL = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1])), tot = segL.reduce((a, b) => a + b, 0); if (tot < 20) return null;
  const g = new THREE.Group(); g.name = 'indVisitors'; const V = []; g.userData.V = V;
  for (let k = 0; k < 3; k++) { const m = o.visitor(k); if (!m) break; m.visible = false; g.add(m); V.push({ m, s: tot, dir: -1, wait: 15 + k * 22, k }); }   // тръгват от улицата (края на пътя) към рампата
  if (!V.length) return null;
  const put = v => { let q = v.s, i = 0; while (i < segL.length - 1 && q > segL[i]) { q -= segL[i]; i++; } const a = path[i], b = path[i + 1], f = Math.min(1, q / (segL[i] || 1)), dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, d = v.dir < 0 ? -1 : 1, lane = 1.9;
    v.m.position.set(a[0] + dx * f + (dz / l) * lane * d, 0, a[1] + dz * f - (dx / l) * lane * d); v.m.rotation.y = Math.atan2(dx * d, dz * d); };   // дясната лента спрямо посоката
  let far = false, chk = 0;
  const drive = dt => {
    if ((chk -= dt) <= 0) { chk = 0.5; const f2 = o.near ? !o.near(c.x, c.z) : false; if (f2 !== far) { far = f2; for (const v of V) if (far) v.m.visible = false; } }
    if (far) return;
    V.forEach(v => { if (v.wait > 0) { v.wait -= dt; return; }
      const ahead = V.some(w => w !== v && w.m.visible && w.dir === v.dir && (w.s - v.s) * v.dir > 0 && (w.s - v.s) * v.dir < 16);   // не се качва върху предния
      if (!ahead) v.s += v.dir * 6 * dt;
      if (v.s <= 0) { v.s = 0; v.dir = 1; v.wait = 30 + v.k * 6; }   // на рампата — товари
      else if (v.s >= tot) { v.s = tot; v.dir = -1; v.wait = 25 + Math.random() * 40; v.m.visible = false; return; }   // отиде в града
      v.m.visible = true; put(v); if (o.spin) o.spin(v.m); });
  };
  return { g, drive };
}
// растер 4 м на заетото: hard — магистралата (мешовете на изгледа, без трафика), летищният път, групите в o.block, вода, жп ивицата, парцелите;
// road — улиците на плана (с ширината им). route(gate) — пътят от входа до най-близката улица: направо, ако не минава през hard;
// иначе — успоредно до прохода под магистралата (o.hwCross: изходът към града, там тя е вдигната), под нея и до улицата
const CELL = 4;
function blockGrid(THREE, o, P) {
  const H = new Set(), Rd = new Set(), key = (x, z) => Math.floor(x / CELL) + ',' + Math.floor(z / CELL), mark = (S, x, z) => S.add(key(x, z));
  const tri = (S, a, b, c) => { const x0 = Math.min(a.x, b.x, c.x), x1 = Math.max(a.x, b.x, c.x), z0 = Math.min(a.z, b.z, c.z), z1 = Math.max(a.z, b.z, c.z);
    if (x1 - x0 <= CELL * 2 && z1 - z0 <= CELL * 2) { for (let x = x0; x <= x1 + CELL; x += CELL) for (let z = z0; z <= z1 + CELL; z += CELL) mark(S, Math.min(x, x1), Math.min(z, z1)); return; }
    const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z); if (Math.abs(d) < 1e-6) return;
    for (let x = Math.floor(x0 / CELL) * CELL; x <= x1; x += CELL) for (let z = Math.floor(z0 / CELL) * CELL; z <= z1; z += CELL) { let hit = false;
      for (const [px, pz] of [[x + 2, z + 2], [x, z], [x + 4, z], [x, z + 4], [x + 4, z + 4]]) { const l1 = ((b.z - c.z) * (px - c.x) + (c.x - b.x) * (pz - c.z)) / d, l2 = ((c.z - a.z) * (px - c.x) + (a.x - c.x) * (pz - c.z)) / d; if (l1 >= -0.02 && l2 >= -0.02 && 1 - l1 - l2 >= -0.02) { hit = true; break; } }
      if (hit) mark(S, x + 2, z + 2); } };
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  for (const grp of (o.block ? o.block() : []).filter(Boolean)) { grp.updateMatrixWorld(true); grp.traverse(m => { if (!m.isMesh || m.isSprite || !m.geometry || !m.geometry.attributes.position) return; for (let p = m; p; p = p.parent) if (p.userData && p.userData.traffic) return;   // трафикът — не (колите се движат)
      const pos = m.geometry.attributes.position, ix = m.geometry.index, n = ix ? ix.count : pos.count, inst = m.isInstancedMesh ? m.count : 1, IM = new THREE.Matrix4(), WM = new THREE.Matrix4();
      for (let k = 0; k < inst; k++) { if (m.isInstancedMesh) { m.getMatrixAt(k, IM); WM.multiplyMatrices(m.matrixWorld, IM); } else WM.copy(m.matrixWorld);
        for (let t = 0; t + 2 < n; t += 3) { const i0 = ix ? ix.getX(t) : t, i1 = ix ? ix.getX(t + 1) : t + 1, i2 = ix ? ix.getX(t + 2) : t + 2; va.fromBufferAttribute(pos, i0).applyMatrix4(WM); vb.fromBufferAttribute(pos, i1).applyMatrix4(WM); vc.fromBufferAttribute(pos, i2).applyMatrix4(WM);
          if (Math.min(va.y, vb.y, vc.y) > 14) continue; tri(H, va, vb, vc); } } }); }
  for (const r of o.roadsW || []) { const w = (r.w || 8) / 2 + 3; for (let i = 1; i < r.pts.length; i++) { const a = r.pts[i - 1], b = r.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 2)), ux = (b[1] - a[1]) / (L || 1), uz = -(b[0] - a[0]) / (L || 1);
    for (let k = 0; k <= n; k++) for (let q = -w; q <= w; q += 2) mark(Rd, a[0] + (b[0] - a[0]) * k / n + ux * q, a[1] + (b[1] - a[1]) * k / n + uz * q); } }
  for (const L of o.lots || []) { const c = Math.cos(L.rot || 0), s = Math.sin(L.rot || 0); for (let u = -L.w / 2 - 2; u <= L.w / 2 + 2; u += 2) for (let v = -L.d / 2 - 2; v <= L.d / 2 + 2; v += 2) mark(H, L.x + u * c + v * s, L.z - u * s + v * c); }
  const hard = (x, z) => H.has(key(x, z)) || (o.railX != null && Math.abs(x - o.railX) < 30) || !!(P.waterAt && P.waterAt(x, z)), road = (x, z) => Rd.has(key(x, z));
  const clear = (a, b, skipEnd = 10) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / 2); for (let k = 0; k <= n; k++) { const d = L * k / n; if (d > L - skipEnd) break; const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n; for (const q of [-3, 0, 3]) if (hard(x + (b[1] - a[1]) / L * q, z - (b[0] - a[0]) / L * q)) return false; } return true; };
  const toRoad = from => { for (const c of nearestOn(from, (o.linkW || o.roadsW || []).map(r => r.pts)).slice(0, 10)) if (c.d < 700 && clear(from, c.q)) return [from, c.q]; return null; };
  const route = gate => { const r = toRoad(gate); if (r) return r; const X = o.hwCross; if (!X) return null;
    const side = Math.sign(gate[1] - X.z) || 1, A = [X.x, X.z + side * (X.half + 8)], Bp = [X.x, X.z - side * (X.half + 8)];   // проходът под магистралата
    const mid = [X.x, gate[1]]; if (!clear(gate, mid, 0) || !clear(mid, A, 0)) return null; const tail = toRoad(Bp); if (!tail) return null;
    const rt = [gate, mid, A, ...tail]; rt.under = 3; return rt; };
  return { hard, road, route };
}
// 🏭 ind-zone2 (f6): около завода — индустриалната зона: старата фабрика (шахтова кула, ind-heritage) и изоставеното хале (ind-decay) от двете страни
// на двора (където е свободно), жълтият кран на колела (crane-yellow) в предния ъгъл на площадката — бавно се върти, куката се вдига и спуска;
// работници (worker-build / worker-hivis, Темидасофт): удрят с чук, носят, вървят между рампата и камиона. Нощем прозорците на фабриките светят.
function extras(THREE, o, G, c, ry, out, drives) {
  const E = o.extra, cs = Math.cos(ry), sn = Math.sin(ry), W = (u, v) => [c.x + u * cs + v * sn, c.z - u * sn + v * cs], H = FW / 2, U = H + YM + 4, g = new THREE.Group(); g.name = 'indZone'; o.group.add(g); out.push(g);
  const freeRect = (x, z, w, d) => { for (let u = -w / 2; u <= w / 2; u += 4) for (let v = -d / 2; v <= d / 2; v += 4) { const px = x + u * cs + v * sn, pz = z - u * sn + v * cs; if (G.hard(px, pz) || G.road(px, pz)) return false; } return true; };
  const conc = new THREE.MeshStandardMaterial({ color: 0x8f8d86, roughness: 0.95 });
  const put = (key, w, d, side) => { const m = E.model(key); if (!m) return null; const u = side * (U + 6 + w / 2), [x, z] = W(u, 0); if (!freeRect(x, z, w + 8, d + 8)) return null;
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(w + 8, d + 8), conc); pad.rotation.set(-Math.PI / 2, 0, ry); pad.position.set(x, 0.05, z); pad.receiveShadow = true; g.add(pad);
    m.position.set(x, 0, z); m.rotation.y = ry; g.add(m); m.userData.side = side; m.userData.uw = [u, w, d]; return m; };
  const ht = put('ind-heritage', 62, 26, -1) || put('ind-heritage', 62, 26, 1); const dc = put('ind-decay', 36, 31, 1) || put('ind-decay', 36, 31, -1);
  const cr = E.model('crane-yellow'); let slew = null, hook = null, h0 = 0;
  const cside = dc ? dc.userData.side : 1, cu = cside * (U + 6 + (dc ? 36 + 8 : 0) + 14);   // кранът — до халето (на свободното), не върху камионите
  let crU = null; if (cr && freeRect(...W(cu, 0), 24, 24)) { crU = cu; const [x, z] = W(cu, 0); const pad = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), conc); pad.rotation.set(-Math.PI / 2, 0, ry); pad.position.set(x, 0.05, z); g.add(pad); cr.position.set(x, 0, z); cr.rotation.y = ry + Math.PI / 2; g.add(cr); slew = cr.getObjectByName('Slew'); hook = cr.getObjectByName('Hook'); if (hook) h0 = hook.position.y; }
  const ws = [], ph = (c.x * 0.37) % 6.28;
  // работниците — само на свободния асфалт: правоъгълниците (в рамката на двора) на всичко над 0,6 м в двора — камионите, будката, бариерата, оградата, лампите — +1,5 м;
  // пътят на подвижния камион (u = gu) — също зает. Местата — най-близката свободна клетка (през 1 м) до желаното; носачът — свободна отсечка от 12 м
  const yard = out.find(q => q.name === 'factoryYard' && !q.userData.used); if (yard) yard.userData.used = 1;
  const R = [], inv = (x, z) => { const dx = x - c.x, dz = z - c.z; return [dx * cs - dz * sn, dx * sn + dz * cs]; };
  if (yard) { yard.updateMatrixWorld(true); yard.traverse(m => { if (!m.isMesh || !m.geometry || m.geometry.type === 'PlaneGeometry') return; if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox; let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9, top = -1e9; const V = new THREE.Vector3();
    for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z]) { V.set(X, Y, Z).applyMatrix4(m.matrixWorld); const [uu, vv] = inv(V.x, V.z); u0 = Math.min(u0, uu); u1 = Math.max(u1, uu); v0 = Math.min(v0, vv); v1 = Math.max(v1, vv); top = Math.max(top, V.y); }
    if (top > 0.6 && u1 - u0 < 40 && v1 - v0 < 40) R.push([u0 - 1.5, u1 + 1.5, v0 - 1.5, v1 + 1.5]); }); }
  const gu = -H * 0.35; R.push([gu - 4, gu + 4, H + 14, H + APR + 6]);   // пътят на подвижния камион
  const okAt = (u, v) => u > -H + 1 && u < H * 0.25 && v > H + 1 && v < H + APR + 2 && !R.some(([a, b, p, q]) => u > a && u < b && v > p && v < q);
  const spot = (u, v) => { for (let r = 0; r < 30; r++) for (let a = 0; a < (r ? 8 * r : 1); a++) { const t = a / (8 * r || 1) * Math.PI * 2, uu = u + Math.cos(t) * r, vv = v + Math.sin(t) * r; if (okAt(uu, vv)) return [uu, vv]; } return null; };
  const path = (u, v) => { for (let r = 0; r < 30; r++) for (let a = 0; a < (r ? 8 * r : 1); a++) { const t = a / (8 * r || 1) * Math.PI * 2, uu = u + Math.cos(t) * r, vv = v + Math.sin(t) * r; let ok = true; for (let f = 0; f <= 12; f += 0.5) if (!okAt(uu, vv + f)) { ok = false; break; } if (ok) return [uu, vv]; } return null; };
  const taken = []; for (const [k, u, v, clip, rot] of [['worker-build', -H + 6, H + 24, 'work', 0.6], ['worker-hivis', -H + 9, H + 27, 'idle', -2.2], ['worker-build', -H + 2, H + 18, 'carry', 0], ['worker-hivis', 0, H + 23, 'idle', 2.4]]) {
    if (!E.worker) break; const p = clip === 'carry' ? path(u, v) : spot(u, v); if (!p) continue; R.push([p[0] - 1.2, p[0] + 1.2, p[1] - 1.2, p[1] + (clip === 'carry' ? 13.2 : 1.2)]);   // и един в друг — не
    const w = E.worker(k, clip); if (!w) continue; const [x, z] = W(p[0], p[1]); w.obj.position.set(x, 0, z); w.obj.rotation.y = ry + rot; g.add(w.obj); ws.push({ ...w, x, z, u: p[0], v: p[1], clip, t: Math.random() * 10 }); taken.push(p.map(Math.round)); }
  g.userData.workers = taken;
  drives.push(dt => { const t = performance.now() / 1000; if (slew) slew.rotation.y = Math.sin(t * 0.07 + ph) * 0.9; if (hook) hook.position.y = h0 + (Math.sin(t * 0.21 + ph) * 0.5 + 0.5) * 6;
    for (const w of ws) { w.mixer.update(dt); if (w.clip === 'carry') { w.t += dt; const s = (w.t * 0.72) % 24, f = s < 12 ? s : 24 - s;   /* по свободната отсечка (path) */ const [x, z] = W(w.u, w.v + f); w.obj.position.set(x, 0, z); w.obj.rotation.y = ry + (s < 12 ? Math.PI : 0);   /* моделите гледат към −z */ } } });
  if (o.streets) indStreets(THREE, o, G, c, ry, g, drives, [ht, dc].filter(Boolean).map(m => m.userData.uw), crU);
}
// 🛣️ ind-streets (f6, потребителят: „индустриалната зона — с улици и връзки между заводите“): пред завода и съседните фабрики — промишлена улица
// (2 широки ленти, бордюри, маркировка, лампи — само светещи материали, без PointLight), от нея — входове с портал към всяка фабрика, бетонни дворове
// с рампи и паркинг, огради; между завода и старата фабрика — тръбопровод на естакада; трошен камък под цялата зона вместо голата трева;
// камион обикаля завод → улицата → фабриките и обратно. Улицата се свързва с пътя на завода до града (той пресича улицата при входа).
function indStreets(THREE, o, G, c, ry, g, drives, B, crU) {
  const cs = Math.cos(ry), sn = Math.sin(ry), W = (u, v) => [c.x + u * cs + v * sn, c.z - u * sn + v * cs], H = FW / 2, VS = H + APR + 14, RW2 = 11;
  const M = { asph: new THREE.MeshStandardMaterial({ color: 0x45484e, roughness: 0.95 }), kerb: new THREE.MeshStandardMaterial({ color: 0xb7b4ac, roughness: 0.9 }), conc: new THREE.MeshStandardMaterial({ color: 0x9a978f, roughness: 0.95 }),
    grav: new THREE.MeshStandardMaterial({ color: 0x7d776c, roughness: 1 }), white: new THREE.MeshBasicMaterial({ color: 0xeeeeee }), yel: new THREE.MeshBasicMaterial({ color: 0xf2c230 }),
    post: new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.5, metalness: 0.4 }), pipe: new THREE.MeshStandardMaterial({ color: 0x9aa3a8, roughness: 0.45, metalness: 0.6 }),
    mesh: new THREE.MeshStandardMaterial({ color: 0x6f7a72, roughness: 0.8, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }) };
  const lampM = new THREE.MeshStandardMaterial({ color: 0x3a3a30, emissive: 0xffe0a0, emissiveIntensity: 0 }); lampM.userData.winK = 2.4; if (o.addWin) o.addWin(lampM);
  const rect = (u0, u1, v0, v1, y, m) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(u1 - u0, v1 - v0), m); p.rotation.set(-Math.PI / 2, 0, ry); const [x, z] = W((u0 + u1) / 2, (v0 + v1) / 2); p.position.set(x, y, z); p.receiveShadow = true; g.add(p); return p; };
  const box = (u, v, y, w, h, d, m, rot = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); const [x, z] = W(u, v); b.position.set(x, y, z); b.rotation.y = ry + rot; g.add(b); return b; };
  const freeAt = (u, v) => { const [x, z] = W(u, v); return !G.hard(x, z) && !G.road(x, z); };
  // докъде стига улицата: от най-лявата до най-дясната фабрика (+ крана), но само докато е свободно
  let u0 = -H - YM - 4, u1 = H + YM + 4; for (const [u, w] of B) { u0 = Math.min(u0, u - w / 2 - 6); u1 = Math.max(u1, u + w / 2 + 6); } if (crU != null) { u0 = Math.min(u0, crU - 16); u1 = Math.max(u1, crU + 16); }
  while (u0 < -H && !freeAt(u0, VS)) u0 += 4; while (u1 > H && !freeAt(u1, VS)) u1 -= 4;
  // трошен камък под цялата зона (вместо голата трева)
  rect(u0 - 6, u1 + 6, -H - YM - 14, VS + RW2 / 2 + 6, 0.02, M.grav);
  // улицата: асфалт, бордюри, осева линия, лампи
  rect(u0, u1, VS - RW2 / 2, VS + RW2 / 2, 0.08, M.asph);
  for (const dv of [-RW2 / 2 - 0.3, RW2 / 2 + 0.3]) box((u0 + u1) / 2, VS + dv, 0.12, u1 - u0, 0.24, 0.5, M.kerb);
  for (let u = u0 + 2; u < u1 - 3; u += 9) rect(u, u + 4.5, VS - 0.1, VS + 0.1, 0.1, M.white);
  const pg = new THREE.CylinderGeometry(0.1, 0.12, 8, 6).translate(0, 4, 0), hg = new THREE.BoxGeometry(1.2, 0.22, 0.45);
  for (let u = u0 + 8, k = 0; u < u1 - 4; u += 26, k++) { const v = VS + (k % 2 ? 1 : -1) * (RW2 / 2 + 1.2), [x, z] = W(u, v); const p = new THREE.Mesh(pg, M.post); p.position.set(x, 0, z); g.add(p); const h = new THREE.Mesh(hg, lampM); h.position.set(x, 8, z); h.rotation.y = ry + Math.PI / 2; g.add(h);
    if (o.poolMat) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), o.poolMat); pl.rotation.x = -Math.PI / 2; pl.position.set(x, 0.13, z); pl.renderOrder = 2; g.add(pl); } }
  // всяка съседна фабрика: двор до улицата, вход с портал, рампи, паркинг, ограда
  const docks = [];
  for (const [u, w, d] of B) { const yv0 = -d / 2 - 6, yv1 = VS - RW2 / 2 - 1, ua = u - w / 2 - 6, ub = u + w / 2 + 6;
    rect(ua, ub, yv0, yv1, 0.06, M.conc);   // бетонният двор
    const gu = u + w * 0.2; rect(gu - 4, gu + 4, yv1 - 1, VS - RW2 / 2 + 0.2, 0.085, M.asph);   // входът от улицата
    box(gu - 4.6, yv1, 0.6, 0.6, 1.2, 0.6, M.post); box(gu + 4.6, yv1, 0.6, 0.6, 1.2, 0.6, M.post);   // порталът
    const arm = box(gu, yv1, 1.05, 8, 0.14, 0.14, M.yel); arm.rotation.z = 0;
    for (let k = 0; k < 4; k++) { box(u - w / 2 + 6 + k * 7, d / 2 + 1.2, 0.6, 5, 1.2, 2.4, M.kerb); rect(u - w / 2 + 3.6 + k * 7, u - w / 2 + 3.8 + k * 7, d / 2 + 2.4, d / 2 + 14, 0.09, M.yel); }   // рампите и местата на камионите
    const pu0 = gu + 6, pu1 = Math.min(ub - 2, pu0 + 20); if (pu1 - pu0 > 8) { rect(pu0, pu1, yv1 - 13, yv1 - 2, 0.07, M.asph); for (let x = pu0 + 1.5; x <= pu1 - 1; x += 2.6) rect(x - 0.06, x + 0.06, yv1 - 12, yv1 - 7.5, 0.09, M.white); }   // паркингът
    const fence = (a, b2) => { const L = Math.hypot(b2[0] - a[0], b2[1] - a[1]); if (L < 1) return; const k = Math.ceil(L / 5); for (let i = 0; i <= k; i++) box(a[0] + (b2[0] - a[0]) * i / k, a[1] + (b2[1] - a[1]) * i / k, 1.1, 0.12, 2.2, 0.12, M.post); const p = box((a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2, 1.1, L, 2, 0.04, M.mesh, -Math.atan2(b2[1] - a[1], b2[0] - a[0])); p.castShadow = false; };
    fence([ua, yv0], [ub, yv0]); fence([ua, yv0], [ua, yv1]); fence([ub, yv0], [ub, yv1]); fence([ua, yv1], [gu - 5, yv1]); fence([gu + 5, yv1], [ub, yv1]);
    docks.push([gu, u - w / 2 + 6 + 7, d / 2 + 8]); }
  // тръбопровод на естакада: завод ↔ първата фабрика (суровини/пара)
  if (B[0]) { const [u, w] = B[0], side = Math.sign(u), ua = side * (H + YM + 2), ub = u - side * (w / 2 + 2), vp = -H * 0.4, L = Math.abs(ub - ua);
    for (let k = 0; k <= Math.ceil(L / 8); k++) { const uu = ua + (ub - ua) * k / Math.ceil(L / 8); box(uu, vp, 3, 0.4, 6, 0.4, M.post); box(uu, vp, 6.05, 0.3, 0.2, 2.6, M.post); }
    for (const dv of [-0.6, 0.6]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, L, 10), M.pipe); p.rotation.z = Math.PI / 2; p.rotation.y = ry; const [x, z] = W((ua + ub) / 2, vp + dv); p.position.set(x, 6.55, z); g.add(p); } }
  // камион: от рампата на завода → входа → по улицата → във всяка фабрика → обратно
  const T = o.truck && o.truck(); if (T && docks.length) { g.add(T); const gate = [-H * 0.35, H + APR + 4], pts = [[-H * 0.35, H + 20], gate, [gate[0], VS]];
    for (const [gu, du, dv] of docks) pts.push([gu, VS], [gu, VS - RW2 / 2 - 4], [du, dv], [gu, VS - RW2 / 2 - 4], [gu, VS]);
    pts.push([gate[0], VS], gate, [-H * 0.35, H + 20]);
    const P = pts.map(([u, v]) => W(u, v)), segL = P.slice(1).map((p, i) => Math.hypot(p[0] - P[i][0], p[1] - P[i][1])), tot = segL.reduce((a, b) => a + b, 0); let s = 0, wait = 8;
    drives.push(dt => { if (wait > 0) { wait -= dt; return; } s += 5.5 * dt; if (s >= tot) { s = 0; wait = 20; } let q = s, i = 0; while (i < segL.length - 1 && q > segL[i]) { q -= segL[i]; i++; } const a = P[i], b = P[i + 1], f = Math.min(1, q / (segL[i] || 1)), dx = b[0] - a[0], dz = b[1] - a[1];
      T.position.set(a[0] + dx * f, 0, a[1] + dz * f); if (Math.hypot(dx, dz) > 0.1) T.rotation.y = Math.atan2(dx, dz); if (o.spin) o.spin(T); }); }
}
function mats(THREE, o) {
  const lamp = new THREE.MeshStandardMaterial({ color: 0x3a3a30, emissive: 0xffe0a0, emissiveIntensity: 0 }); lamp.userData.winK = 2.4; if (o.addWin) o.addWin(lamp);
  return { lamp, conc: new THREE.MeshStandardMaterial({ color: 0x9a9890, roughness: 0.95 }), asph: new THREE.MeshStandardMaterial({ color: 0x4a4e55, roughness: 0.95 }), white: new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }), yel: new THREE.MeshBasicMaterial({ color: 0xf2c230 }),
    post: new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.5, metalness: 0.4 }), mesh: new THREE.MeshStandardMaterial({ color: 0x6f7a72, roughness: 0.8, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
    red: new THREE.MeshStandardMaterial({ color: 0xd8302a, roughness: 0.6 }), wh: new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.6 }) };
}
// дворът в рамката на завода (u — надясно, v — напред, към града), после пътят до най-близката улица
function yard(THREE, o, M, c, ry, route) {
  const g = new THREE.Group(); g.name = 'factoryYard'; const cs = Math.cos(ry), sn = Math.sin(ry), W = (u, v) => [c.x + u * cs + v * sn, c.z - u * sn + v * cs];
  const flat = (u0, u1, v0, v1, y, m) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(u1 - u0, v1 - v0), m); p.rotation.set(-Math.PI / 2, 0, ry); const [x, z] = W((u0 + u1) / 2, (v0 + v1) / 2); p.position.set(x, y, z); p.receiveShadow = true; g.add(p); return p; };
  const box = (u, v, y, w, h, d, m, rot = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); const [x, z] = W(u, v); b.position.set(x, y, z); b.rotation.y = ry + rot; b.castShadow = true; g.add(b); return b; };
  const H = FW / 2, U = H + YM, V0 = -H - YM, V1 = H + APR;
  flat(-U, U, V0, V1, 0.05, M.conc);   // бетонният двор
  flat(-H, H * 0.25, H, V1 - 2, 0.07, M.asph);   // площадката за камионите пред рампата
  for (let u = -H + 4; u < H * 0.2; u += 6) flat(u - 0.08, u + 0.08, H + 1, H + 16, 0.08, M.yel);   // жълтите линии на местата при рампата
  const p0 = H * 0.35, p1 = U - 2; flat(p0, p1, H + 4, V1 - 4, 0.07, M.asph);   // паркингът на служителите
  for (let u = p0 + 1.5; u <= p1 - 1; u += 2.6) for (const v of [H + 9, V1 - 9]) flat(u - 0.06, u + 0.06, v - 2.4, v + 2.4, 0.08, M.white);
  // оградата по периметъра на двора (стълбове през 4 м и мрежа), отвор на входа (u = gu) с бариера
  const gu = -H * 0.35, gw = 11, fence = (a, b) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) return; const k = Math.ceil(L / 4);
      for (let i = 0; i <= k; i++) box(a[0] + (b[0] - a[0]) * i / k, a[1] + (b[1] - a[1]) * i / k, 1.1, 0.12, 2.2, 0.12, M.post);
      const pnl = box((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 1.1, L, 2, 0.04, M.mesh, -Math.atan2(b[1] - a[1], b[0] - a[0])); pnl.castShadow = false; };
  fence([-U, V0], [U, V0]); fence([-U, V0], [-U, V1]); fence([U, V0], [U, V1]); fence([-U, V1], [gu - gw / 2, V1]); fence([gu + gw / 2, V1], [U, V1]);
  box(gu - gw / 2 - 0.3, V1, 0.6, 0.6, 1.2, 0.6, M.post); box(gu - gw / 2 - 1.6, V1 - 1.5, 1.4, 2.2, 2.8, 2.6, M.wh);   // стълбът на бариерата и будката
  const arm = new THREE.Group(); { const [x, z] = W(gu - gw / 2, V1); arm.position.set(x, 1.05, z); arm.rotation.y = ry; g.add(arm); for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(gw / 5, 0.14, 0.14), i % 2 ? M.wh : M.red); s.position.x = gw / 10 + i * gw / 5; arm.add(s); } }
  // пътят: от входа до най-близката улица, до която правата не минава през парцел
  const gate = W(gu, V1), rt = route && route.length > 1 ? route : null;
  let drive = null;
  if (rt) { const strip = (a, b, w, y, m) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 0.3) return; const s = new THREE.Mesh(new THREE.PlaneGeometry(l, w), m); s.rotation.x = -Math.PI / 2; s.rotation.z = -Math.atan2(b[1] - a[1], b[0] - a[0]); s.position.set((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2); s.receiveShadow = true; g.add(s); };
    const pg = new THREE.CylinderGeometry(0.1, 0.12, 7, 6).translate(0, 3.5, 0), hg = new THREE.BoxGeometry(1.1, 0.2, 0.4); let k = 0;
    for (let i = 1; i < rt.length; i++) { const a = rt[i - 1], b = rt[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.5) continue; const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = -uz, nz = ux, under = rt.under && i === rt.under;
      strip([a[0] - ux * RW / 2, a[1] - uz * RW / 2], [b[0] + ux * RW / 2, b[1] + uz * RW / 2], RW, 0.075 + (i % 2) * 0.004, M.asph);   // + половин ширина в ъглите
      for (let d = 3; d < L - 3; d += 9) strip([a[0] + ux * d, a[1] + uz * d], [a[0] + ux * (d + 3), a[1] + uz * (d + 3)], 0.15, 0.09, M.white);   // прекъснатата линия по средата
      if (under) continue;   // под магистралата — без лампи (лампите на нея светят)
      for (let d = 8; d < L - 4; d += 28, k++) { const sd = k % 2 ? 1 : -1, x = a[0] + ux * d + nx * sd * (RW / 2 + 1), z = a[1] + uz * d + nz * sd * (RW / 2 + 1); const p = new THREE.Mesh(pg, M.post); p.position.set(x, 0, z); g.add(p);
        const h = new THREE.Mesh(hg, M.lamp); h.position.set(x, 7, z); h.rotation.y = -Math.atan2(uz, ux); g.add(h); if (o.poolMat) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), o.poolMat); pl.rotation.x = -Math.PI / 2; pl.position.set(x, 0.12, z); pl.renderOrder = 2; g.add(pl); } } }
    for (const [u, v] of [[-H + 6, H + 3], [H * 0.2 - 6, H + 3]]) { const lp = new THREE.Mesh(pg, M.post); const [x, z] = W(u, v); lp.position.set(x, 0, z); g.add(lp); const h = new THREE.Mesh(hg, M.lamp); h.position.set(x, 7, z); g.add(h); if (o.poolMat) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), o.poolMat); pl.rotation.x = -Math.PI / 2; pl.position.set(x, 0.12, z); pl.renderOrder = 2; g.add(pl); } }   // лампите над площадката
    // камионите: 2 на рампата (на заден, кабината към града) и един, който кара: рампа → вход → пътя → улицата, почивка, обратно
    const T = o.truck; if (T) { for (const u of [-H + 7, -H + 19]) { const t = T(); if (!t) break; const [x, z] = W(u, H + 8); t.position.set(x, 0, z); t.rotation.y = ry; g.add(t); }
      const t = T(); if (t) { g.add(t); const path = [W(gu, H + 20), ...rt], segL = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1])), tot = segL.reduce((a, b) => a + b, 0), gs = segL[0]; let s = 0, dir = 1, wait = 25 + (Math.abs(c.x) % 20);
        const put = () => { let q = s, i = 0; while (i < segL.length - 1 && q > segL[i]) { q -= segL[i]; i++; } const a = path[i], b = path[i + 1], f = Math.min(1, q / (segL[i] || 1)), dx = b[0] - a[0], dz = b[1] - a[1]; t.position.set(a[0] + dx * f, 0, a[1] + dz * f); t.rotation.y = Math.atan2(dx * dir, dz * dir); };
        put(); drive = dt => { arm.rotation.z = Math.abs(s - gs) < 14 ? 1.3 : 0;   /* бариерата се вдига, щом камионът наближи входа */
          if (wait > 0) { wait -= dt; return; } s += dir * 6 * dt;
          if (s >= tot) { s = tot; dir = -1; wait = 40; t.visible = false; } else if (s <= 0) { s = 0; dir = 1; wait = 50; } else t.visible = true;   /* на улицата — отива в града, после се връща */
          put(); if (o.spin) o.spin(t); }; } } }
  return { g, drive };
}
// нощем: тъмносиньото стъкло на прозорците (синьото преобладава, тъмно) по стените — топла светлина; addWin — dayNight.winMats
export function factoryNight(root, THREE, addWin) {
  root.traverse(o => { if (!o.isMesh || /^Beacon/.test(o.name) || !o.material || !o.material.map) return; const mt = o.material = o.material.clone();
    mt.emissive = new THREE.Color(0xffffff); mt.emissiveMap = mt.map; mt.emissiveIntensity = 0; mt.userData.winK = 1.5; mt.flatShading = true;   /* flat — нормалата от геометрията (олекотеният Meshy има обърнати стени — денем бяха тъмни) */
    mt.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { vec3 tx = texture2D(emissiveMap, vEmissiveMapUv).rgb; vec3 wN = inverseTransformDirection(normal, viewMatrix); float lum = dot(tx, vec3(0.333));
        float m = step(abs(wN.y), 0.5) * step(tx.r * 2.5 + 0.01, tx.b) * step(tx.g * 1.5, tx.b) * (1.0 - smoothstep(0.03, 0.06, lum));   /* само най-тъмното синьо стъкло */
        totalEmissiveRadiance = (vec3(1.0, 0.74, 0.42) * m + tx * vec3(1.0, 0.85, 0.65) * 0.3) * emissive.r; }`); };   /* + меки прожектори по фасадата (иначе нощем е черна маса) */
    mt.customProgramCacheKey = () => 'factory-night'; addWin(mt); });
}
let SMOKE = null;
function smokeTex(THREE) {
  if (SMOKE) return SMOKE; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.5, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const d = x.getImageData(0, 0, 64, 64), t = new THREE.DataTexture(new Uint8Array(d.data), 64, 64); t.needsUpdate = true; t.colorSpace = THREE.SRGBColorSpace; return (SMOKE = t);   // DataTexture — не платно (черните текстури, v3.2.1)
}
// димът от комина: спрайтове, които се издигат ~45 м, растат и избледняват, леко отнесени от вятъра; нощем — по-тъмни
function plume(THREE, group, tex, p, out) {
  const ps = [], N = 14, g = new THREE.Group(); group.add(g); out.push(g);
  for (let i = 0; i < N; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xd8d8d8, transparent: true, depthWrite: false, opacity: 0 })); g.add(s); ps.push({ s, t: i / N, j: Math.random() * 6 }); }
  return (dt, night) => { const c = 0.85 - 0.55 * night; for (const q of ps) { q.t = (q.t + dt * 0.05) % 1; const k = q.t; q.s.position.set(p.x + k * 14 + Math.sin(k * 4 + q.j) * 1.5, p.y + 1 + k * 45, p.z + k * 5); q.s.scale.setScalar(3 + k * 16); q.s.material.color.setScalar(c); q.s.material.opacity = 0.6 * (1 - k) * Math.min(1, k * 8); } };
}
