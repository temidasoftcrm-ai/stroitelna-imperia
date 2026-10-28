// factory.js — 🏭 ind-factory (f6, модел на потребителя — Meshy, Темидасофт): заводът в индустриалната зона в края на града.
// Хале ~65 × 64 м, два червено-бели комина по 52 м (Blender: Body, Smoke_<i> — върховете на комините, Beacon_<i> — червените лампи).
// Мястото: извън границата на града (не се пипат парцелите — старите записи остават същите), на сушата, далеч от улиците и жп линията;
// 1 завод в малките и средните градове, 2 — в големите; лицето — към центъра. Нощем: прозорците (тъмносиньото стъкло) светят топло,
// лампите на комините мигат червено; от комините винаги излиза дим. Около завода — двор (бетон), площадка за камионите пред рампата, паркинг
// за служителите, ограда с бариера на входа и път (2 ленти, лампи) до най-близката улица (като airport-access); 2 камиона на рампата и един,
// който от време на време кара по пътя до града и обратно. Само изглед — графът на движението и парцелите не се пипат.
//   game.js: placeFactories({ THREE, P, model, group, tier, railX, addWin, roads, lots, truck, poolMat, spin }) → { update(dt, night), clear() }
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
    const site = yard(THREE, o, M, c, ry, c.route); group.add(site.g); out.push(site.g); if (site.drive) drives.push(site.drive); }
  if (!out.length) return null;
  return { grid: G, list: out, at: pick.map(c => ({ x: Math.round(c.x), z: Math.round(c.z), under: !!c.route.under, road: Math.round(c.len), end: c.route[c.route.length - 1].map(Math.round) })),
    update(dt, night) { const t = performance.now() / 1000; for (const b of beacons) b.opacity = t % 1.6 < 0.35 ? 0.12 + 0.88 * night : 0.04 * night;   /* денем — едва */ for (const s of smokes) s(dt, night); for (const d of drives) d(dt); },
    clear() { for (const m of out) m.parent && m.parent.remove(m); } };
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
