// depot2.js — 🛤️ depot2 (T1): по-голямо жп депо (разпределителен парк) до линията — N успоредни коловоза, стрелкова „стълба“ (диагонал)
// и изтеглителен коловоз (headshunt) към главната линия. Маневрени локомотиви с по 2–3 вагона се местят от коловоз на коловоз:
// излизат напред по стълбата до изтеглителния, спират, после бутат назад в друг свободен коловоз — плавно (ускорение/спиране).
// Без сблъсъци: преди тръгване всяка композиция заключва гърловината (стълбата + изтеглителния) и целевия коловоз; чака, ако са заети.
// Искри: от колелата по стрелките и при спиране (евтини частици, с adding blend — по-ярки нощем).
// Локални координати: u — отстояние от главната линия (side: +1 на изток, −1 на запад), v — z (на юг е +).
// const d = createDepot2({ THREE, parent, instanced, trainCar, hasTrainModel, side, X, u0, N, za, zb, shed });  d.update(dt, night); d.dispose()
const G = 5, COT = 2.75, FOUL = 12;   // между коловозите; стълбата — под ~20° (2,75 м по v за всеки метър по u); FOUL — след стрелката коловозите се разделят на ≥ 3,5 м

export function createDepot2(o) {
  const { THREE } = o, g = new THREE.Group(); g.name = 'depot2'; o.parent.add(g);
  const side = o.side || 1, X = o.X, N = o.N, wx = u => X + side * u, wz = v => o.flip ? -v : v;   // u → x, v → z на света (flip — паркът е на север от гарата: огледално)
  const uk = k => o.u0 + k * G;
  // разположение по v: изтеглителният [vH, vA], стълбата — от vA до vA + (N−1)·G·COT, телата на коловозите — до vB (буферите)
  const HS = o.hs || 48, vH = o.za, vA = vH + HS, vJ = k => vA + k * G * COT, vB = o.zb;
  // ---- релсите (инстанции на 'track', 4 м)
  const up = new THREE.Vector3(0, 1, 0), mats = [], q = new THREE.Quaternion(), V = new THREE.Vector3(), S4 = new THREE.Vector3(4, 4, 4);
  const rail = (a0, b0) => { const a = [a0[0], wz(a0[1])], b = [b0[0], wz(b0[1])], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); q.setFromAxisAngle(up, Math.atan2(dx, dz)); for (let d = 2; d < L - 0.5; d += 4) mats.push(new THREE.Matrix4().compose(V.set(a[0] + dx * d / L, 0.012, a[1] + dz * d / L), q, S4)); };
  const P = (u, v) => [wx(u), v];   // в рамката на парка (v); в света — през wz (rail, at)
  rail(P(uk(0), vH - 6), P(uk(0), vA));   // изтеглителният
  if (N > 1) rail(P(uk(0), vA), P(uk(N - 1), vJ(N - 1)));   // стълбата
  for (let k = 0; k < N; k++) rail(P(uk(k), k ? vJ(k) : vA), P(uk(k), vB));
  if (o.link) { const [lx, lv] = o.link; rail([lx, lv], P(uk(0), vH - 6)); }   // link: [x, v]   // връзката с главната линия
  g.add(o.instanced('track', mats));
  // баластът под парка и буферите
  const own = [], M = (geo, mat) => { const m = new THREE.Mesh(geo, mat); own.push(geo); g.add(m); return m; };
  { const w = (N - 1) * G + 8, l = vB - vH + 4, b = M(new THREE.PlaneGeometry(w, l), new THREE.MeshStandardMaterial({ color: 0x7a7266, roughness: 1 })); b.rotation.x = -Math.PI / 2; b.position.set(wx(uk(0) + (N - 1) * G / 2), 0.006, wz((vH + vB) / 2)); b.receiveShadow = true; }
  const bufM = new THREE.MeshStandardMaterial({ color: 0xc8302a, roughness: 0.7 }), bufG = new THREE.BoxGeometry(2.8, 1.3, 0.6);
  for (let k = 0; k < N; k++) { const b = M(bufG, bufM); b.position.set(wx(uk(k)), 0.65, wz(vB + 0.6)); b.castShadow = true; }
  // прожекторните мачти (нощем — светли петна), от външната страна на парка
  if (o.lampMat) { const post = new THREE.MeshStandardMaterial({ color: 0x7d8288, roughness: 0.6, metalness: 0.4 }), pg = new THREE.CylinderGeometry(0.18, 0.25, 14, 6).translate(0, 7, 0), hg = new THREE.BoxGeometry(2.4, 0.5, 0.9);
    const uL = uk(N - 1) + 4.5; for (let v = vA - 10; v <= vB - 5; v += 42) { const p = M(pg, post); p.position.set(wx(uL), 0, wz(v)); const h = M(hg, o.lampMat); h.position.set(wx(uL - 0.6), 14, wz(v));
      if (o.poolMat) { const pl = M(new THREE.PlaneGeometry(30, 30), o.poolMat); pl.rotation.x = -Math.PI / 2; pl.position.set(wx(uL - 10), 0.14, wz(v)); pl.renderOrder = 2; } } }
  // ---- маршрутите: A(k) — от буфера на коловоз k до края на изтеглителния (напред, локомотивът отпред на север); B(k) — обратното
  const poly = pts => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, L, T: L[L.length - 1] }; };
  const routeA = k => poly([P(uk(k), vB), ...(k ? [P(uk(k), vJ(k))] : []), P(uk(0), vA), P(uk(0), vH)]);
  const routeB = k => { const a = routeA(k); return poly(a.pts.slice().reverse()); };
  const at = (r, s) => { s = Math.max(0, Math.min(r.T, s)); let i = 1; while (i < r.L.length - 1 && r.L[i] < s) i++; const a = r.pts[i - 1], b = r.pts[i], t = (s - r.L[i - 1]) / ((r.L[i] - r.L[i - 1]) || 1); return [a[0] + (b[0] - a[0]) * t, wz(a[1] + (b[1] - a[1]) * t)]; };
  const sw = []; for (let k = 0; k < N; k++) { const p = P(uk(k), k ? vJ(k) : vA); sw.push([p[0], wz(p[1])]); }   // стрелките (за искрите)
  // ---- композициите
  const pick = l => l.filter(k => o.hasTrainModel(k));
  const LOCOS = pick(['loco040', 'upLoco', 'loco', 'elLoco']), WAG = pick(['tankUssr', 'hopper2', 'boxcar', 'cistern', 'gondola', 'srrCar', 'wmCoal', 'hopX']);
  const mkCut = (kinds, seed, rusty) => kinds.map((k, i) => { const c = o.trainCar(k, seed + i); if (!c) return null; if (rusty) rust(c); c.userData.len = c.userData.len || 6.2; g.add(c); return c; }).filter(Boolean);
  const rust = c => c.traverse(m => { if (m.isMesh && m.material) { m.material = m.material.clone(); if (m.material.color) m.material.color.lerp(new THREE.Color(0x6b4426), 0.4); m.material.roughness = 0.9; m.material.metalness = Math.min(m.material.metalness || 0, 0.2); } });
  const lenOf = cars => cars.reduce((a, c) => a + c.userData.len + 0.6, -0.6);
  // поставяне: cars[0] — на север (най-малко v); head — позицията на северния край по маршрута r; dir: +1 — северът е по-нататък по r (A), −1 — по-назад (B)
  const place = (cars, r, head, dir) => { let s = head; for (const c of cars) { const l = c.userData.len, f = at(r, s), b = at(r, s - dir * l), m = [(f[0] + b[0]) / 2, (f[1] + b[1]) / 2]; c.position.set(m[0], 0.3, m[1]); c.rotation.y = Math.atan2(f[0] - b[0], f[1] - b[1]); s -= dir * (l + 0.6); } };
  const lock = { throat: null, track: new Array(N).fill(null) };
  const units = [], shunters = N >= 4 ? 2 : 1, statics = Math.min(2, N - shunters - 1);   // винаги поне един свободен коловоз
  let seed = ((o.seed || 7) % 2147483646) + 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // неподвижните (старите вагони, парният) — в западните/външните коловози; над последните два — навесът на депото
  for (let k = N - 1, n = 0; n < statics; k--, n++) {
    const cars = mkCut(n === 0 && LOCOS.includes('loco040') ? ['loco040', ...WAG.slice(0, 2)] : [WAG[(n * 3) % WAG.length], WAG[(n * 3 + 1) % WAG.length], WAG[(n * 3 + 2) % WAG.length], WAG[(n * 3) % WAG.length]].filter(Boolean), 40 + n * 5, n > 0);
    while (cars.length > 1 && lenOf(cars) > (o.maxCut || HS - 6)) g.remove(cars.pop());
    if (!cars.length) continue; const r = routeA(k); place(cars, r, 4 + lenOf(cars), 1); lock.track[k] = 'static'; }
  if (o.shed && N >= 3) o.shed(g, wx(uk(N - 1) - side * G / 2), wz(vB - 2), (G + 7), o.flip ? -1 : 1);
  const moving = []; for (let k = 0; k < N; k++) if (!lock.track[k]) moving.push(k);
  for (let n = 0; n < shunters; n++) {
    const k = moving[n * 2] ?? moving[n];   // между тях — свободен коловоз
    const loco = LOCOS[n % LOCOS.length]; if (!loco) break;
    const cars = mkCut([loco, ...[0, 1, 2].slice(0, 2 + (n % 2)).map(i => WAG[(n * 4 + i + 1) % WAG.length])].filter(Boolean), 70 + n * 9, false);
    const MAXC = o.maxCut || HS - 6; while (cars.length > 1 && lenOf(cars) > MAXC) g.remove(cars.pop());   // да се побира в изтеглителния и в коловоза
    const u = { cars, len: lenOf(cars), k, st: 'park', wait: 4 + rnd() * 8 + n * 9, r: routeA(k), s: 0, v: 0, to: null, id: n };
    u.s = 3 + u.len; place(cars, u.r, u.s, 1); lock.track[k] = u; units.push(u);
  }
  // ---- искрите
  const SP = 90, sPos = new Float32Array(SP * 3), sVel = new Float32Array(SP * 3), sLife = new Float32Array(SP); let sNext = 0;
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3)); own.push(sGeo);
  const sMat = new THREE.PointsMaterial({ color: 0xffb347, size: 0.32, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
  const sparks = new THREE.Points(sGeo, sMat); sparks.frustumCulled = false; g.add(sparks);
  for (let i = 0; i < SP; i++) sPos[i * 3 + 1] = -50;
  const spark = (x, z, n, y = 0.35) => { for (let j = 0; j < n; j++) { const i = sNext; sNext = (sNext + 1) % SP; sPos[i * 3] = x + (rnd() - 0.5) * 1.6; sPos[i * 3 + 1] = y; sPos[i * 3 + 2] = z + (rnd() - 0.5) * 1.2;
    sVel[i * 3] = (rnd() - 0.5) * 3; sVel[i * 3 + 1] = 1.5 + rnd() * 3; sVel[i * 3 + 2] = (rnd() - 0.5) * 3; sLife[i] = 0.35 + rnd() * 0.45; } };
  // ---- движението
  const A = 0.45, VM = 4.2;   // м/с², м/с (~15 км/ч)
  const drive = (u, dt, goal) => { const d = goal - u.s, want = Math.min(VM, Math.sqrt(2 * A * Math.max(0, d))); const v0 = u.v; u.v = want > u.v ? Math.min(want, u.v + A * dt) : Math.max(want, u.v - 1.6 * A * dt); u.s = Math.min(goal, u.s + u.v * dt); return { done: goal - u.s < 0.05 && u.v < 0.08, brake: v0 - u.v > 0.4 * A * dt && u.v > 0.8 }; };
  const free = () => { const f = []; for (let k = 0; k < N; k++) if (!lock.track[k]) f.push(k); return f; };
  let sparkT = 0, nightK = 0;
  function update(dt, night) {
    if (!dt) return;
    nightK = night ? 1 : 0; sMat.size = night ? 0.42 : 0.3;
    for (const u of units) {
      if (u.st === 'park') { u.wait -= dt; if (u.wait > 0) continue;
        const f = free(); if (lock.throat || !f.length) { u.wait = 2 + rnd() * 3; continue; }   // гърловината или всички коловози заети — чака
        u.to = f[Math.floor(rnd() * f.length)]; lock.throat = u; lock.track[u.to] = u; u.st = 'out'; u.r = routeA(u.k); u.v = 0; continue; }
      if (u.st === 'out') { const r = drive(u, dt, u.r.T); place(u.cars, u.r, u.s, 1); u.pass = r.brake;
        if (lock.track[u.k] === u && u.s - u.len > u.r.L[1] + FOUL) lock.track[u.k] = null;   // опашката мина стрелката на коловоза (L[1]) и габарита след нея — той е свободен
        if (r.done) { if (lock.track[u.k] === u) lock.track[u.k] = null; u.st = 'rev'; u.wait = 5 + rnd() * 4; } continue; }
      if (u.st === 'rev') { u.wait -= dt; if (u.wait > 0) continue; u.k = u.to; u.r = routeB(u.k); u.s = 0; u.v = 0; u.st = 'in'; continue; }
      if (u.st === 'in') { const goal = u.r.T - 3 - u.len, r = drive(u, dt, goal); place(u.cars, u.r, u.s, -1); u.pass = r.brake;
        if (lock.throat === u && u.s > u.r.L[u.r.L.length - 2] + FOUL) lock.throat = null;   // и северният край мина стрелката и габарита — целият е в коловоза, гърловината е свободна
        if (r.done) { if (lock.throat === u) lock.throat = null; u.st = 'park'; u.r = routeA(u.k); u.s = 3 + u.len; place(u.cars, u.r, u.s, 1); u.wait = 18 + rnd() * 30; } }
    }
    // искри: по стрелките (колелата над точката) и при рязко спиране
    sparkT -= dt;
    for (const u of units) { if (u.st !== 'out' && u.st !== 'in' || u.v < 0.6) continue;
      for (const c of u.cars) for (const p of sw) if (Math.hypot(c.position.x - p[0], c.position.z - p[1]) < c.userData.len / 2 + 0.6 && rnd() < dt * 0.5) spark(p[0], p[1], 3 + Math.floor(rnd() * 4));
      if (u.pass && u.v > 1.5 && rnd() < dt * 0.6) { const c = u.cars[Math.floor(rnd() * u.cars.length)]; spark(c.position.x, c.position.z, 4); } }
    if (sparkT <= 0) { sparkT = 15 + rnd() * 20; const u = units.find(x => x.st === 'out' || x.st === 'in'); if (u && u.v > 1) { const c = u.cars[0]; spark(c.position.x, c.position.z, 10, 4.4); } }   // понякога — и от горе (токоприемника)
    for (let i = 0; i < SP; i++) { if (sLife[i] <= 0) continue; sLife[i] -= dt; if (sLife[i] <= 0) { sPos[i * 3 + 1] = -50; continue; }
      sVel[i * 3 + 1] -= 9.8 * dt; sPos[i * 3] += sVel[i * 3] * dt; sPos[i * 3 + 1] = Math.max(0.05, sPos[i * 3 + 1] + sVel[i * 3 + 1] * dt); sPos[i * 3 + 2] += sVel[i * 3 + 2] * dt; }
    sGeo.attributes.position.needsUpdate = true;
  }
  const info = () => ({ sparks: sLife.reduce((a, l) => a + (l > 0 ? 1 : 0), 0), N, side, vH, vA, vB, throat: lock.throat ? lock.throat.id : null, tracks: lock.track.map(t => t === 'static' ? 'S' : t ? 'u' + t.id : '-').join(''), units: units.map(u => ({ id: u.id, st: u.st, k: u.k, to: u.to, v: +u.v.toFixed(2) })) });
  // проверка за сблъсък (за теста): никои два вагона от различни композиции по-близо от 2 м по средата
  const ends = c => { const h = c.userData.len / 2 - 0.3, dx = Math.sin(c.rotation.y) * h, dz = Math.cos(c.rotation.y) * h; return [[c.position.x - dx, c.position.z - dz], [c.position.x + dx, c.position.z + dz]]; };
  const segSeg = (a, b) => { let m = 1e9; const pd = (p, s0, s1) => { const dx = s1[0] - s0[0], dz = s1[1] - s0[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p[0] - s0[0]) * dx + (p[1] - s0[1]) * dz) / l2)); return Math.hypot(p[0] - s0[0] - dx * t, p[1] - s0[1] - dz * t); };
    for (const p of a) m = Math.min(m, pd(p, b[0], b[1])); for (const p of b) m = Math.min(m, pd(p, a[0], a[1])); return m; };   // осите не се пресичат (успоредни/под ъгъл) — краищата стигат
  const check = () => { const all = []; units.forEach(u => u.cars.forEach(c => all.push([u.id, ends(c)]))); g.children.forEach(c => { if (c.userData.len && !units.some(u => u.cars.includes(c))) all.push(['s', ends(c)]); });
    let min = 1e9; for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (all[i][0] !== all[j][0] && (all[i][0] !== 's' || all[j][0] !== 's')) min = Math.min(min, segSeg(all[i][1], all[j][1]) - 3.1); return min; };   // < 0 — ширините (3,1 м) се застъпват
  return { group: g, update, info, check, units, dispose() { o.parent.remove(g); own.forEach(x => x.dispose()); } };
}
