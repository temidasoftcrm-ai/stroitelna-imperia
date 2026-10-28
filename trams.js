// trams.js — 🚋 trams (T1): трамваите по трамвайните линии на истинската карта (D.metro, kind 'tram' — Истанбул, Москва).
// Отсечките от OSM се съединяват в непрекъснати линии (краищата на ≤ 6 м, завой ≤ 50°), завоите се заглаждат (Чайкин). По всяка линия — двоен
// коловоз (±1,6 м от оста), спирки на ~400 м (кратък престой), трамваи в двете посоки; в края — обръщане. Съчленени: две секции по 14 м
// (модел tram-silver, Meshy — Темидасофт), всяка със своя ъгъл по точките на талигите — плавно по завоите. Пантограф, нощем — прозорците и фаровете.
// Трафикът: секциите са „машини“ за колите (movers — спират пред тях); трамваят спира пред кола в същата посока отпред (≤ 6 с — после има предимство).
// const T = createTrams({ THREE, parent, segs: [[[x, z], …]], off: [ox, oz], cut: [x0, x1] | null, proto: { A, B }, cars: () => [{ x, z, yaw }], seed });
//   T.update(dt, night); T.movers() → [{ x, z, l, w }]; T.info(); T.dispose()
const SEC = 14.0, GAP = 0.35, STOP = 400, VMAX = 12, ACC = 1.0, DEC = 1.3, ALAT = 0.9;

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function chain(segs, snap = 6) {   // отсечките → линии
  const nodes = [], nodeOf = p => { for (const n of nodes) if (d2(n.p, p) < snap) return n; const n = { p, e: [] }; nodes.push(n); return n; };
  const E = segs.filter(s => s.length > 1).map((pts, i) => { const e = { i, pts, a: null, b: null, used: false }; e.a = nodeOf(pts[0]); e.b = nodeOf(pts[pts.length - 1]); e.a.e.push(e); e.b.e.push(e); return e; });
  const dirAt = (pts, end) => { const n = pts.length, p = end ? pts[n - 1] : pts[0]; let q = p; for (let k = 1; k < n; k++) { q = end ? pts[n - 1 - k] : pts[k]; if (d2(p, q) > 8) break; } return [p[0] - q[0], p[1] - q[1]]; };   // навън от края
  const out = [];
  for (const e0 of E) { if (e0.used) continue; e0.used = true; let line = e0.pts.slice();
    for (const fwd of [true, false]) { let node = fwd ? e0.b : e0.a;
      for (;;) { const tip = fwd ? line : line.slice().reverse(), dIn = dirAt(tip, true), L0 = Math.hypot(...dIn) || 1;
        let best = null, ba = 0.88;   // ≤ ~50°
        for (const e of node.e) { if (e.used) continue; const atA = e.a === node, pts = atA ? e.pts : e.pts.slice().reverse(), dOut = dirAt(pts, false), L1 = Math.hypot(...dOut) || 1, c = -(dIn[0] * dOut[0] + dIn[1] * dOut[1]) / (L0 * L1);
          if (c > ba) { ba = c; best = { e, pts, next: atA ? e.b : e.a }; } }
        if (!best) break; best.e.used = true; if (fwd) line = line.concat(best.pts.slice(1)); else line = best.pts.slice().reverse().concat(line.slice(1)); node = best.next; } }
    out.push(line); }
  return out;
}
const resample = (pts, step) => { const out = [pts[0]]; let carry = 0; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], L = d2(a, b); let s = step - carry; while (s <= L) { out.push([a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L]); s += step; } carry = L - (s - step); } const last = pts[pts.length - 1]; if (d2(out[out.length - 1], last) > 0.3) out.push(last); return out; };
const chaikin = pts => { const o = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } o.push(pts[pts.length - 1]); return o; };
const lenOf = pts => { let L = 0; for (let i = 1; i < pts.length; i++) L += d2(pts[i - 1], pts[i]); return L; };
function cutBand(pts, cut) { if (!cut) return [pts]; const out = []; let cur = []; for (const p of resample(pts, 2)) { if (p[0] > cut[0] && p[0] < cut[1]) { if (cur.length > 1) out.push(cur); cur = []; } else cur.push(p); } if (cur.length > 1) out.push(cur); return out; }
function lane(pts, off) {   // (off > 0 — вдясно; лявото движение — с обратен знак от createTrams)   // успоредна линия (дясно от посоката при off > 0), с дължините
  const P = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; return [p[0] - dz / L * off, p[1] + dx / L * off]; });
  const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + d2(P[i - 1], P[i]));
  const vc = P.map((p, i) => { if (i < 3 || i > P.length - 4) return VMAX; const a = P[i - 3], b = P[i + 3], h1 = Math.atan2(p[1] - a[1], p[0] - a[0]), h2 = Math.atan2(b[1] - p[1], b[0] - p[0]); let dh = Math.abs(h2 - h1); if (dh > Math.PI) dh = 2 * Math.PI - dh; const R = (d2(a, p) + d2(p, b)) / Math.max(1e-3, dh); return Math.min(VMAX, Math.max(3, Math.sqrt(ALAT * R))); });
  return { P, L, T: L[L.length - 1], vc };
}
const at = (ln, s) => { s = Math.max(0, Math.min(ln.T, s)); let lo = 0, hi = ln.L.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ln.L[m] <= s) lo = m; else hi = m; } const a = ln.P[lo], b = ln.P[hi], t = (s - ln.L[lo]) / ((ln.L[hi] - ln.L[lo]) || 1); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
const vAt = (ln, s) => { let lo = 0, hi = ln.L.length - 1; s = Math.max(0, Math.min(ln.T, s)); while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ln.L[m] <= s) lo = m; else hi = m; } return ln.vc[lo]; };

export function createTrams(o) {
  const { THREE } = o, g = new THREE.Group(); g.name = 'trams'; o.parent.add(g);
  let seed = ((o.seed || 5) % 2147483646) + 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const [ox, oz] = o.off || [0, 0], OFF = o.trackOff || 1.6;   // trams-blvd: коловозите — във вътрешните ленти на булеварда (±3,15 м)
  // линиите (в рамката на играта)
  let lines = [];
  for (const L of o.lines || chain(o.segs)) for (const piece of cutBand(L, o.cut)) { if (lenOf(piece) < (o.minLen || 300)) continue; let p = resample(piece, 3); p = chaikin(chaikin(p)); p = resample(p, 1.5).map(([x, z]) => [x + ox, z + oz]); lines.push(p); }
  lines.sort((a, b) => lenOf(b) - lenOf(a));
  { // OSM: всеки коловоз е отделен път — успоредният (≥ 60% от точките на ≤ 9 м от вече взета линия) отпада; взетата линия носи и двата коловоза
    const G = 10, grid = new Set(), key = (x, z) => Math.floor(x / G) + ',' + Math.floor(z / G), near = (x, z) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (grid.has((Math.floor(x / G) + i) + ',' + (Math.floor(z / G) + j))) return true; return false; };
    const keep = []; for (const p of lines) { const sm = p.filter((_, i) => i % 4 === 0), hit = sm.filter(q => near(q[0], q[1])).length; if (hit > sm.length * 0.6) continue; keep.push(p); for (const q of p) grid.add(key(q[0], q[1])); if (keep.length >= (o.maxLines || 12)) break; }
    lines = keep; }
  const own = [];
  // релсите: 2 коловоза × 2 релси, тънки инстанции по 3 м
  { const rails = []; for (const p of lines) for (const off of [OFF - 0.72, OFF + 0.72, -OFF - 0.72, -OFF + 0.72]) { const ln = lane(p, off); for (let s = 0; s < ln.T - 1; s += 3) rails.push([at(ln, s), at(ln, Math.min(ln.T, s + 3))]); }
    const geo = new THREE.BoxGeometry(0.09, 0.05, 1), im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x8d9298, metalness: 0.7, roughness: 0.35 }), rails.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3(); own.push(geo);
    rails.forEach(([a, b], i) => { const L = d2(a, b); q.setFromAxisAngle(up, Math.atan2(b[0] - a[0], b[1] - a[1])); im.setMatrixAt(i, m4.compose(v.set((a[0] + b[0]) / 2, 0.11, (a[1] + b[1]) / 2), q, sc.set(1, 1, L + 0.05))); }); g.add(im); }
  // спирките: по оста на линията на ~400 м — стълб с табела от двете страни
  const stopsOf = T => { const n = Math.max(1, Math.round(T / STOP)), out = []; for (let k = 0; k <= n; k++) out.push(Math.min(T - 20, Math.max(20, T * k / n))); return out; };
  { const pole = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), sign = new THREE.BoxGeometry(0.6, 0.5, 0.06); own.push(pole, sign); const pm = new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.4 }), sm = new THREE.MeshStandardMaterial({ color: 0xf2c230, emissive: 0x332200 });
    if (!o.island) for (const p of lines) { const ax = lane(p, 0); for (const s of stopsOf(ax.T)) for (const sd of [1, -1]) { const c = at(lane(p, sd * (OFF + 2.4)), s); const a = new THREE.Mesh(pole, pm); a.position.set(c[0], 1.3, c[1]); g.add(a); const b = new THREE.Mesh(sign, sm); b.position.set(c[0], 2.4, c[1]); g.add(b); } } }
  // trams-blvd: островни перони между коловозите (в разделителната ивица) на спирките
  if (o.island) { const pg = new THREE.BoxGeometry(2 * OFF - 3.4, 0.32, 30), pm = new THREE.MeshStandardMaterial({ color: 0xbdb6a6, roughness: 0.9 }), cg = new THREE.BoxGeometry(2 * OFF - 3.6, 0.12, 9), cm = new THREE.MeshStandardMaterial({ color: 0x3f6f8f, roughness: 0.5, metalness: 0.3 }), pl = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6); own.push(pg, cg, pl);
    for (const p of lines) { const ax = lane(p, 0); for (const s of stopsOf(ax.T)) { const c = at(ax, s), a = at(ax, s + 5), y = Math.atan2(a[0] - c[0], a[1] - c[1]); const m = new THREE.Mesh(pg, pm); m.position.set(c[0], 0.16, c[1]); m.rotation.y = y; m.receiveShadow = true; g.add(m);
      const roof = new THREE.Mesh(cg, cm); roof.position.set(c[0], 2.9, c[1]); roof.rotation.y = y; g.add(roof); for (const k of [-3.5, 3.5]) { const q = at(ax, s + k), po = new THREE.Mesh(pl, pm); po.position.set(q[0], 1.6, q[1]); g.add(po); } } } }
  // трамваите
  const roofM = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffe2a8, emissiveIntensity: 0.75 }),   /* непрозрачна: прозрачната се губеше зад нощните петна */ nightM = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffe7a8, emissiveIntensity: 1.6 }),   /* emissive — нощното осветяване не ги потъмнява */ headM = new THREE.MeshBasicMaterial({ color: 0xfff6dd }), tailM = new THREE.MeshBasicMaterial({ color: 0xff3020 });
  const pantoM = new THREE.MeshStandardMaterial({ color: 0x30343a, metalness: 0.6, roughness: 0.4 });
  const section = (proto, front) => { const s = new THREE.Group(), m = proto.clone(true); m.traverse(x => { if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; } }); s.add(m);
    const win = []; for (const sd of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(SEC - 3, 0.75), nightM); own.push(w.geometry); w.rotation.y = sd * Math.PI / 2; w.position.set(sd * 1.31, 2.0, 0); s.add(w); win.push(w); }
    { const rg = new THREE.PlaneGeometry(0.9, 1.6); own.push(rg); for (let k = -2; k <= 2; k++) { const r = new THREE.Mesh(rg, roofM); r.rotation.x = -Math.PI / 2; r.position.set(0, 3.92, k * 2.3); s.add(r); win.push(r); } }   // нощем: мека светла ивица отгоре (над покрива) — вижда се от високата камера
    const lt = []; for (const sd of [-0.7, 0.7]) { const h = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), front ? headM : tailM); own.push(h.geometry); h.position.set(sd, 0.9, (front ? 1 : -1) * (SEC / 2 - 0.1)); s.add(h); lt.push(h); }
    if (front) {   // пантографът над средата на първата секция
      const P2 = new THREE.Group(); P2.position.set(0, 3.55, -1.5); const arm = (x0, y0, z0, x1, y1, z1, r = 0.05) => { const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1), L = a.distanceTo(b), mm = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 5), pantoM); own.push(mm.geometry); mm.position.copy(a).add(b).multiplyScalar(0.5); mm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); P2.add(mm); };
      arm(0, 0, -0.9, 0, 0.75, 0.2); arm(0, 0.75, 0.2, 0, 1.45, -0.6); arm(-0.85, 1.45, -0.6, 0.85, 1.45, -0.6, 0.04); arm(-0.5, 0, -1, 0.5, 0, -1, 0.06); s.add(P2); }
    g.add(s); return { s, win, lt }; };
  const trams = [], L2 = [];
  const SD = o.drive === 'L' ? -1 : 1;
  lines.forEach((p, li) => { const fwd = lane(p, SD * OFF), bwd = lane(p.slice().reverse(), SD * OFF), stops = stopsOf(fwd.T);
    const lanes = [{ ln: fwd, stops, list: [] }, { ln: bwd, stops: stops.map(s => fwd.T - s).reverse(), list: [] }]; L2.push(lanes);
    const n = Math.max(1, Math.min(4, Math.round(fwd.T / 900)));
    for (const [k, Ln] of lanes.entries()) for (let i = 0; i < n; i++) { const A = section(o.proto.A, true), B = section(o.proto.B, false), s0 = (Ln.ln.T - 60) * (i + 0.5 * k) / n + 40;
      const t = { li, k, A, B, s: Math.min(Ln.ln.T - 2, s0), v: 0, wait: rnd() * 6, lane: Ln, nextStop: 0, carT: 0 }; t.nextStop = Ln.stops.findIndex(z => z > t.s + 5); Ln.list.push(t); trams.push(t); } });
  L2.forEach(ls => ls.forEach(Ln => Ln.list.sort((a, b) => b.s - a.s)));
  const place = t => { const ln = t.lane.ln, f = s => at(ln, s);
    for (const [S, c] of [[t.A, t.s - SEC / 2], [t.B, t.s - SEC * 1.5 - GAP]]) { const p = f(c), a = f(c + SEC / 2 - 2), b = f(c - SEC / 2 + 2); S.s.position.set(p[0], 0.12, p[1]); S.s.rotation.y = Math.atan2(a[0] - b[0], a[1] - b[1]); } };
  trams.forEach(place);
  const LEN = 2 * SEC + GAP;
  function update(dt, night) {
    if (!dt) return; dt = Math.min(dt, 0.25);
    const CR = o.cars ? o.cars() : [];
    for (const ls of L2) for (const Ln of ls) { Ln.list.sort((a, b) => b.s - a.s);
      Ln.list.forEach((t, i) => {
        if (t.wait > 0) { t.wait -= dt; t.v = 0; if (t.wait <= 0 && t.endT) { t.endT = 0; const other = ls[1 - t.k]; Ln.list.splice(Ln.list.indexOf(t), 1); t.k = 1 - t.k; t.lane = other; t.s = LEN + 2; other.list.push(t); t.nextStop = other.stops.findIndex(z => z > t.s + 5); } return; }   // обръщане в края: на другия коловоз
        const ln = Ln.ln; let goal = ln.T - 2;   // докъдето може да стигне челото
        const st = t.nextStop >= 0 ? Ln.stops[t.nextStop] : null; if (st != null) goal = Math.min(goal, st);
        const ahead = Ln.list[i - 1]; if (ahead) goal = Math.min(goal, ahead.s - LEN - 18);
        // кола отпред в същата посока (≤ 30 м, ≤ 2 м встрани): спира, но най-много 6 с
        let carGap = 1e9; { const p = at(ln, t.s), q = at(ln, t.s + 6), hx = q[0] - p[0], hz = q[1] - p[1], hl = Math.hypot(hx, hz) || 1, ux = hx / hl, uz = hz / hl;
          for (const c of CR) { const dx = c.x - p[0], dz = c.z - p[1], fw = dx * ux + dz * uz; if (fw < 1 || fw > 30) continue; if (Math.abs(dx * uz - dz * ux) > 2.0) continue; if (Math.sin(c.yaw) * ux + Math.cos(c.yaw) * uz < 0.5 && fw > 8) continue; carGap = Math.min(carGap, fw - 4); } }
        if (carGap < 1e9) { t.carT += dt; if (t.carT < 6) goal = Math.min(goal, t.s + carGap); } else t.carT = 0;
        const d = goal - t.s; let want = Math.min(vAt(ln, t.s + 4), vAt(ln, t.s + 20) + 2, Math.sqrt(2 * DEC * Math.max(0, d)));
        t.v = want > t.v ? Math.min(want, t.v + ACC * dt) : Math.max(want, t.v - DEC * 1.6 * dt); t.s = Math.max(t.s, Math.min(goal, t.s + t.v * dt));   // никога назад
        if (st != null && st - t.s < 0.4 && t.v < 0.2) { t.wait = 10 + rnd() * 10; t.nextStop++; if (t.nextStop >= Ln.stops.length) t.nextStop = -1; }
        else if (ln.T - 2 - t.s < 0.4 && t.v < 0.2) { t.wait = 18 + rnd() * 10; t.endT = 1; }
        place(t); }); }
    const nk = night ? 1 : 0; if (nk !== update.nk) { update.nk = nk; for (const t of trams) for (const S of [t.A, t.B]) { S.win.forEach(w => { w.visible = !!nk; }); S.lt.forEach(h => { h.visible = !!nk || S === t.A; }); } }
  }
  const movers = () => { const out = []; for (const t of trams) for (const S of [t.A, t.B]) { const y = S.s.rotation.y, sx = Math.sin(y), cz = Math.cos(y); for (const k of [-4.5, 0, 4.5]) out.push({ x: S.s.position.x + sx * k, z: S.s.position.z + cz * k, l: 5, w: 2.6 }); } return out; };
  const info = () => ({ lines: lines.length, km: +(lines.reduce((a, p) => a + lenOf(p), 0) / 1000).toFixed(1), trams: trams.length, moving: trams.filter(t => t.v > 0.5).length, stops: L2.reduce((a, ls) => a + ls[0].stops.length, 0), first: trams[0] ? { x: Math.round(trams[0].A.s.position.x), z: Math.round(trams[0].A.s.position.z) } : null });
  update(0.01, false);
  return { group: g, update, movers, info, trams, lines, dispose() { o.parent.remove(g); own.forEach(x => x.dispose && x.dispose()); } };
}
