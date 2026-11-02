// xmasshow.js — 🎄 „Коледа в Пловдив“ (feature 'xmas-plovdiv'; потребителят, 02.11: „ефект на камионите — да са в Пловдив по централния
// булевард — сняг отвсякъде и като минават сградите да се осветяват като на рекламата“; „и някоя червена лампа тип гирлянд по сградите,
// само в Пловдив, и когато се случва събитието — без значение къде си — да те пуска в Пловдив да го видиш; да вали много сняг“).
// Одобрено като превю в Blender (02.11). НАШ керван (червените камиони с „Весела Коледа!“ от xmas-convoy) — без чужди марки.
// Шоуто: гъст сняг, 5 камиона по главния булевард през центъра; щом първият мине — прозорците по фасадите светват топло един след друг,
// по корнизите пламват гирлянди (топло-бели и червени), елхите и дърветата покрай пътя — със светлинки, над булеварда — светещи арки.
// Камерата сменя кадри (отпред, отгоре-отзад, отстрани, кран), накрая — „Весела Коледа!“. Музика: коледната песен на автора (AI, assets/music/xmas-show.mp3);
// ако не тръгне — „Jingle Bells“ (Дж. Пиърпонт, 1857 — обществено достояние), синтез със звънчета. Светлините са наш слой (точки + фасадни „прозорци“ в шейдъра) — сградите не се пипат.
// deps: { scene, camera, cityGroup() → THREE.Group, plan() → city.plan, Sound?, setCam(px, py, pz, tx, ty, tz), onEnd(skipped) }
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const N = 5, LEN = 17, GAP = 9, SPEED = 9.5, HALF = 290, LANE = 4;   // камиони; м; м между тях; м/с; ± м от центъра; м вдясно от оста
let proto = null, loading = null;
// xmas-truck2.glb (02.11, потребителят: „ремарке и каросерия отделно — сега са като молив, който завива“): моделът е разделен в Blender на
// влекач (Cab) и ремарке (Trailer); двата възела са с начало в седлото (шкворена). extras: frontAxle/rearAxle (влекача), axle (ремаркето) — по x, кабината към −x.
const load = () => loading || (loading = new Promise(res => new GLTFLoader().load('assets/heavy/xmas/xmas-truck2.glb', g => {
  g.scene.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(g.scene), s = b.getSize(new THREE.Vector3()), k = LEN / s.x;
  const part = nm => { const n = g.scene.getObjectByName(nm); if (!n) return null; const y = (n.position.y - b.min.y) * k; n.position.set(0, 0, 0); n.updateMatrixWorld(true);
    const inner = new THREE.Group(); inner.add(n); inner.scale.setScalar(k); inner.rotation.y = Math.PI / 2; inner.position.y = y;   // +π/2: −x (кабината) → +z
    const G = new THREE.Group(); G.add(inner); G.traverse(o => { if (o.isMesh) { o.castShadow = true; if (o.material) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(0xffffff); o.material.emissiveMap = o.material.map; o.material.emissiveIntensity = 0.32; } } }); return { G, x: n.userData || {} }; };
  const cab = part('Cab'), trl = part('Trailer'); if (!cab || !trl) return res(null);
  proto = { cab: cab.G, trl: trl.G, fa: -(cab.x.frontAxle ?? -0.69) * k, ra: -(cab.x.rearAxle ?? 0) * k, ta: (trl.x.axle ?? 0.88) * k, front: (1 - 0) * k };   // м: предната ос пред седлото, задната на влекача, оста на ремаркето зад седлото
  res(proto); }, undefined, () => res(null))));

// ── главният булевард: от възела до центъра — двата най-прави клона, продължени по най-правия булевард нататък ──
export function boulevard(P) {
  const Q = P && (P.p2 || P), tg = (P && P.toGame) || ((x, z) => [x, z]); if (!Q || !Q.roads) return null;
  const R = Q.roads.filter(r => r.cls === 'blvd' && r.pts && r.pts.length > 1), c = Q.center || { x: 0, z: 0 }; if (!R.length) return null;
  const end = (r, n) => n === r.from ? r.pts[0] : r.pts[r.pts.length - 1];
  const dirOut = (r, n) => { const p = r.pts, a = n === r.from ? p[0] : p[p.length - 1], b = n === r.from ? p[Math.min(p.length - 1, 6)] : p[Math.max(0, p.length - 7)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  const nodes = new Map(); for (const r of R) for (const n of [r.from, r.to]) { const p = end(r, n); (nodes.get(n) || nodes.set(n, { p, rs: [] }).get(n)).rs.push(r); }
  let n0 = null, bd = 1e18; for (const [id, v] of nodes) { if (v.rs.length < 2) continue; const d = Math.hypot(v.p[0] - c.x, v.p[1] - c.z); if (d < bd) { bd = d; n0 = id; } } if (n0 == null) return null;
  const rs = nodes.get(n0).rs; let pair = null, best = 2; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = dirOut(rs[i], n0), b = dirOut(rs[j], n0), dt = a[0] * b[0] + a[1] * b[1]; if (dt < best) { best = dt; pair = [rs[i], rs[j]]; } }
  if (!pair) return null; const used = new Set(pair);
  const walk = (r, n) => { const out = []; let cur = r, at = n; for (let k = 0; k < 40 && cur; k++) { const fwd = at === cur.from, pts = fwd ? cur.pts : cur.pts.slice().reverse(); out.push(...(out.length ? pts.slice(1) : pts)); const nx = fwd ? cur.to : cur.from, d0 = (() => { const q = pts, a = q[Math.max(0, q.length - 7)], b = q[q.length - 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; })();
      let nb = null, bs = Math.cos(40 * Math.PI / 180); for (const r2 of (nodes.get(nx) || { rs: [] }).rs) { if (used.has(r2)) continue; const o = dirOut(r2, nx), dt = o[0] * d0[0] + o[1] * d0[1]; if (dt > bs) { bs = dt; nb = r2; } }
      if (nb) used.add(nb); cur = nb; at = nx; } return out; };
  const A = walk(pair[0], n0).reverse(), B = walk(pair[1], n0), pts = [...A, ...B.slice(1)].map(p => tg(p[0], p[1]));
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const s0 = L[A.length - 1], lo = Math.max(0, s0 - HALF), hi = Math.min(L[L.length - 1], s0 + HALF), out = [];
  for (let i = 0; i < pts.length; i++) if (L[i] >= lo && L[i] <= hi && (!out.length || Math.hypot(pts[i][0] - out[out.length - 1][0], pts[i][1] - out[out.length - 1][1]) > 2)) out.push(pts[i]);
  return out.length > 3 ? { pts: out, w: pair[0].w || 16 } : null;
}

// ── шейдъри ──
const BULB_VS = `attribute vec3 color; attribute float aS; attribute float aPh; attribute float aSz; uniform float uLead, uT, uPx; varying vec3 vC; varying float vA;
void main() { float vis = clamp((uLead - aS + 3.0) / 5.0, 0.0, 1.0); float tw = 0.62 + 0.38 * sin(uT * 2.6 + aPh * 6.2832); vC = color * tw; vA = vis;
  vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = max(1.5, aSz * uPx / max(1.0, -mv.z)) * (0.5 + 0.5 * vis) * (vis > 0.0 ? 1.0 : 0.0); }`;
const BULB_FS = `varying vec3 vC; varying float vA; void main() { float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0 || vA <= 0.0) discard; float core = smoothstep(0.55, 0.0, d), halo = smoothstep(1.0, 0.25, d) * 0.4;
  float a = (core + halo) * vA; gl_FragColor = vec4(vC * a * 1.7 + vec3(core * 0.5 * vA), a); }`;
const WIN_VS = `attribute vec2 aUV; attribute float aS; attribute float aSeed; varying vec2 vUV; varying float vS, vSeed; void main() { vUV = aUV; vS = aS; vSeed = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const WIN_FS = `uniform float uLead; varying vec2 vUV; varying float vS, vSeed; float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + vSeed * 17.3) * 43758.5453); }
void main() { vec2 cell = vec2(3.2, 3.1), id = floor(vUV / cell), f = fract(vUV / cell); float h = h1(id); float vis = clamp((uLead - vS - h * 7.0 + 1.0) / 1.6, 0.0, 1.0); if (vis <= 0.0) discard;
  float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.26, f.y) * step(f.y, 0.78) * step(0.2, h); if (vUV.y < 3.3) win = step(0.06, f.x) * step(f.x, 0.94) * step(0.12, vUV.y / 3.3) * step(vUV.y / 3.3, 0.86);
  vec3 col = mix(vec3(1.0, 0.55, 0.2), vec3(1.0, 0.78, 0.45), fract(h * 7.3)); if (fract(h * 13.1) > 0.9) col = vec3(1.0, 0.25, 0.2);
  float a = (win * 0.92 + 0.05) * vis; gl_FragColor = vec4(col * a, a); }`;
const SNOW_VS = `attribute float aV; uniform vec3 uCam; uniform float uT, uPx; varying float vA; const float B = 170.0, H = 80.0;
void main() { vec3 p = position * vec3(B, H, B); p.y = mod(p.y - uT * aV, H); p.x += sin(uT * 0.6 + position.z * 40.0) * 1.6 + uT * 1.1; p.z += cos(uT * 0.5 + position.x * 40.0) * 1.2;
  vec3 o = uCam - vec3(B * 0.5, 0.0, B * 0.5); p.x = o.x + mod(p.x - o.x, B); p.z = o.z + mod(p.z - o.z, B);
  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; float d = -mv.z; vA = clamp(d / 3.0, 0.0, 1.0) * clamp((150.0 - d) / 60.0, 0.0, 1.0); gl_PointSize = max(1.4, 0.24 * uPx / max(1.0, d)); }`;
const SNOW_FS = `varying float vA; void main() { float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard; float a = smoothstep(1.0, 0.2, d) * 0.9 * vA; gl_FragColor = vec4(vec3(0.95, 0.97, 1.0), a); }`;

export function createXmasShow(deps) {
  let cur = null;
  const bulbMat = () => new THREE.ShaderMaterial({ vertexShader: BULB_VS, fragmentShader: BULB_FS, uniforms: { uLead: { value: -1e9 }, uT: { value: 0 }, uPx: { value: 600 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  let glowTex = null; const gTex = () => glowTex || (glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.45, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })());   // меко петно (без ръбове)
  const truckLights = (cab, trl) => {   // гирлянди по ремаркето (както в xmas-convoy): 3 цвята на смени; петната — по снега
    const geo = new THREE.SphereGeometry(0.16, 6, 4), out = [];
    [0xfff2c8, 0xff3030, 0x30ff60].forEach((c, ci) => { const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), pts = [];
      for (const side of [-1, 1]) for (const y of [1.25, 4.15]) for (let z = -9.3; z < 1.4; z += 0.9) pts.push([side * 1.32, y, z]);
      const mine = pts.filter((_, k) => k % 3 === ci), im = new THREE.InstancedMesh(geo, m, mine.length), dm = new THREE.Object3D();
      mine.forEach((p, k) => { dm.position.set(...p); dm.updateMatrix(); im.setMatrixAt(k, dm.matrix); }); im.frustumCulled = false; trl.add(im); out.push(im); });
    const glow = new THREE.Mesh(new THREE.CircleGeometry(7, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff7040, map: gTex(), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.set(0, 0.08, -4); glow.scale.set(0.7, 1, 1.3); trl.add(glow);   // топлото петно по снега под ремаркето
    const hl = new THREE.Mesh(new THREE.CircleGeometry(5, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff2d0, map: gTex(), transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
    hl.position.set(0, 0.09, proto.fa + 7); hl.scale.set(0.8, 1, 1.6); cab.add(hl);   // фаровете по пътя
    return out;
  };

  // ── фасадите, елхите и арките покрай булеварда ──
  function build(route) {
    const pts = route.pts, L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const tot = L[L.length - 1], half = route.w / 2;
    const near = (x, z) => { let bd = 1e18, bs = 0, bx = 0, bz = 0; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)), px = a[0] + dx * t, pz = a[1] + dz * t, d = (x - px) ** 2 + (z - pz) ** 2;
      if (d < bd) { bd = d; bs = L[i - 1] + Math.sqrt(l2) * t; bx = px; bz = pz; } } return { d: Math.sqrt(bd), s: bs, x: bx, z: bz }; };
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    const PAD = 60; x0 -= PAD; x1 += PAD; z0 -= PAD; z1 += PAD;
    // кутиите: всяка мрежа/инстанция — в собствените си оси (u, v) → истинските стени, не раздутата световна кутия
    const boxes = [], M = new THREE.Matrix4(), IM = new THREE.Matrix4(), cs = [], V = new THREE.Vector3();
    const addBox = (geo, mw) => { const bb = geo.boundingBox; cs.length = 0;
      for (const [x, y, z] of [[bb.min.x, bb.min.y, bb.min.z], [bb.max.x, bb.min.y, bb.min.z], [bb.min.x, bb.min.y, bb.max.z], [bb.min.x, bb.max.y, bb.min.z]]) cs.push(V.set(x, y, z).applyMatrix4(mw).clone());
      const o = cs[0], eu = cs[1].clone().sub(o), ev = cs[2].clone().sub(o), ey = cs[3].clone().sub(o), hu = Math.hypot(eu.x, eu.z), hv = Math.hypot(ev.x, ev.z), h = ey.y + o.y;
      if (Math.abs(ey.x) + Math.abs(ey.z) > 0.3 * Math.abs(ey.y) + 0.5) return;   // наклонени — не сгради
      const cx = o.x + (eu.x + ev.x) / 2, cz = o.z + (eu.z + ev.z) / 2; if (cx < x0 || cx > x1 || cz < z0 || cz > z1) return;
      boxes.push({ cx, cz, u: [eu.x / (hu || 1), eu.z / (hu || 1)], v: [ev.x / (hv || 1), ev.z / (hv || 1)], hu: hu / 2, hv: hv / 2, h, y0: o.y, vol: hu * hv * Math.max(1, ey.y), geo, mw: mw.clone() }); };
    const root = deps.cityGroup(); root.updateMatrixWorld(true);
    root.traverse(o => { if (!o.isMesh || !o.visible || !o.geometry || o.userData.xmasShow) return; const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); if (!g.boundingBox || !isFinite(g.boundingBox.min.x)) return;
      if (o.isInstancedMesh) { const n = Math.min(o.count, 20000); for (let i = 0; i < n; i++) { o.getMatrixAt(i, IM); M.multiplyMatrices(o.matrixWorld, IM); addBox(g, M); } } else addBox(g, o.matrixWorld); });
    // сгради (по-големите първо; частите на вече приета сграда се пропускат) и дървета покрай пътя
    const inside = (B, x, z, pad) => { const dx = x - B.cx, dz = z - B.cz; return Math.abs(dx * B.u[0] + dz * B.u[1]) < B.hu + pad && Math.abs(dx * B.v[0] + dz * B.v[1]) < B.hv + pad; };
    const blds = [], trees = []; boxes.sort((a, b) => b.vol - a.vol);
    for (const B of boxes) { const mn = Math.min(B.hu, B.hv) * 2, mx = Math.max(B.hu, B.hv) * 2, ht = B.h - Math.max(0, B.y0), q = near(B.cx, B.cz);
      if (mn >= 4 && mx <= 140 && ht >= 5 && B.y0 < 2 && q.d < 75 && q.d > half + 2) { if (!blds.some(A => inside(A, B.cx, B.cz, 1))) blds.push(B); continue; }
      if (ht >= 3 && ht <= 18 && mn >= 1.2 && mx <= 9 && B.y0 < 1.5 && q.d < half + 14 && q.d > half - 1 && trees.length < 220 && !trees.some(T => Math.hypot(T.cx - B.cx, T.cz - B.cz) < 2.5) && !blds.some(A => inside(A, B.cx, B.cz, 0.5))) trees.push(B); }
    // фасадата към пътя: от 4-те стени — тази, която гледа към най-близката точка на булеварда
    const bP = [], bC = [], bS = [], bPh = [], bSz = [], wP = [], wUV = [], wS = [], wSeed = [], wI = []; let nf = 0;
    const WARM = [1, 0.78, 0.42], RED = [1, 0.12, 0.08], GOLD = [1, 0.62, 0.18], GREEN = [0.25, 1, 0.35];
    const bulb = (x, y, z, c, s, sz = 0.5) => { bP.push(x, y, z); bC.push(...c); bS.push(s); bPh.push(Math.random()); bSz.push(sz); };
    // проверка: лъчи от улицата към фасадата трябва да ударят плътна стена на същия обект (иначе — короните на дърветата, декорът)
    const rc = new THREE.Raycaster(), tm = new THREE.Mesh(undefined, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })), O = new THREE.Vector3(), Dv = new THREE.Vector3(); let nRej = 0;
    const solid = (B, n, t, fx, fz, hd, top) => { tm.geometry = B.geo; tm.matrixWorld.copy(B.mw); if (!B.geo.boundingSphere) B.geo.computeBoundingSphere(); let hit = 0, tries = 0;
      for (const f of [-0.5, 0, 0.5]) for (const y of [2.2, Math.max(2.6, top * 0.6)]) { tries++; O.set(fx + n[0] * 6 + t[0] * hd * f, y, fz + n[1] * 6 + t[1] * hd * f); Dv.set(-n[0], 0, -n[1]); rc.set(O, Dv); rc.far = 10;
        const r = tm.raycast ? (() => { const a = []; tm.raycast(rc, a); return a; })() : []; if (r.some(q => q.distance > 2.5 && q.distance < 9.5)) hit++; }
      return hit >= tries / 2 && hit >= 1 + (tries > 4 ? 2 : 0); };
    for (const B of blds) { let best = null;
      for (const [n, hw, hd, t] of [[B.u, B.hu, B.hv, B.v], [[-B.u[0], -B.u[1]], B.hu, B.hv, B.v], [B.v, B.hv, B.hu, B.u], [[-B.v[0], -B.v[1]], B.hv, B.hu, B.u]]) {
        const fx = B.cx + n[0] * hw, fz = B.cz + n[1] * hw, q = near(fx, fz), rx = q.x - fx, rz = q.z - fz, rl = Math.hypot(rx, rz) || 1, f = (n[0] * rx + n[1] * rz) / rl;
        if (f > 0.55 && q.d < 48 && q.d > half && (!best || q.d < best.q.d)) best = { n, hw, hd, t, fx, fz, q }; }
      if (!best) continue; { const ht0 = B.h, top0 = ht0 > 16 ? ht0 - 0.5 : Math.max(4.5, ht0 * 0.7); if (!solid(B, best.n, best.t, best.fx, best.fz, best.hd, top0)) { nRej++; continue; } }
      if (!best) continue; const { n, hd, t, fx, fz, q } = best, ht = B.h, top = ht > 16 ? ht - 0.5 : Math.max(4.5, ht * 0.7), W = hd * 2, off = 0.14, seed = Math.random() * 100;
      const ax = fx + n[0] * off - t[0] * hd, az = fz + n[1] * off - t[1] * hd, bx = fx + n[0] * off + t[0] * hd, bz = fz + n[1] * off + t[1] * hd, sA = near(ax, az).s, sB = near(bx, bz).s;
      // прозорците — квадрат по фасадата (0,3 м … под корниза)
      const i0 = wP.length / 3; wP.push(ax, 0.3, az, bx, 0.3, bz, bx, top, bz, ax, top, az); wUV.push(0, 0.3, W, 0.3, W, top, 0, top); wS.push(sA, sB, sB, sA); for (let k = 0; k < 4; k++) wSeed.push(seed); wI.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); nf++;
      // гирлянди: по корниза (леко провиснали между „куките“) и над партера; топло-бели и червени
      const red = Math.random() < 0.45, step = 0.85, cnt = Math.max(2, Math.round(W / step));
      for (const [yy, sag, pal] of [[top - 0.35, 0.45, red ? [RED, WARM] : [WARM, GOLD]], [3.6, 0.3, red ? [WARM, WARM] : [RED, WARM]]]) { if (yy > top + 0.1) continue;
        for (let k = 0; k <= cnt; k++) { const f = k / cnt, seg = (f * W / 3.4) % 1, y = yy - sag * 4 * seg * (1 - seg); bulb(ax + (bx - ax) * f, y, az + (bz - az) * f, pal[k % 2], sA + (sB - sA) * f, 0.42); } }
      if (ht > 9) for (const [cx2, cz2] of [[ax, az], [bx, bz]]) for (let y = 0.8; y < top - 0.3; y += 0.8) bulb(cx2, y, cz2, red ? RED : GOLD, near(cx2, cz2).s + y * 0.15, 0.4);   // по ъглите — вертикални нишки
    }
    // елхите/дърветата: спирала от светлинки; редом — червени и топли
    for (const T of trees) { const q = near(T.cx, T.cz), r0 = Math.min(T.hu, T.hv) * 0.95 + 0.25, h = T.h, n = Math.round(10 + h * 2.2), mix = Math.random() < 0.5;
      for (let k = 0; k < n; k++) { const f = k / n, y = 1.2 + f * (h - 1.6), r = r0 * (1 - f * 0.75), a = f * Math.PI * 2 * (h / 2.2); bulb(T.cx + Math.cos(a) * r, y, T.cz + Math.sin(a) * r, mix ? [GOLD, RED, GREEN][k % 3] : [WARM, RED][k % 2], q.s + f * 1.5, 0.38); } }
    // арки над булеварда — на ~48 м, по цялата ширина
    const at = s => { let i = 1; while (i < L.length - 1 && L[i] < s) i++; const a = pts[i - 1], b = pts[i], l = (L[i] - L[i - 1]) || 1, f = (s - L[i - 1]) / l; return { x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, tx: (b[0] - a[0]) / l, tz: (b[1] - a[1]) / l }; };
    let arches = 0; for (let s = 40; s < tot - 20; s += 48) { const p = at(s), rx = -p.tz, rz = p.tx, wd = half + 1.5, cnt = Math.round(wd * 2 / 0.55); arches++;
      for (let k = 0; k <= cnt; k++) { const f = k / cnt, xo = (f - 0.5) * 2 * wd, y = 6.6 + 1.6 * (1 - (2 * f - 1) ** 2); bulb(p.x + rx * xo, y, p.z + rz * xo, k % 2 ? RED : WARM, s + Math.abs(xo) * 0.15, 0.5);
        if (k % 4 === 2) for (let d = 1; d <= 5; d++) bulb(p.x + rx * xo, y - d * 0.45, p.z + rz * xo, k % 8 === 2 ? GOLD : WARM, s + Math.abs(xo) * 0.15 + d * 0.1, 0.4); }
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, rr = k % 2 ? 0.6 : 1.4; bulb(p.x + rx * Math.sin(a) * rr, 9.6 + Math.cos(a) * rr, p.z + rz * Math.sin(a) * rr, GOLD, s, 0.6); } }   // звезда в средата
    const G = new THREE.Group(); G.userData.xmasShow = 1;
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bP, 3)); bg.setAttribute('color', new THREE.Float32BufferAttribute(bC, 3)); bg.setAttribute('aS', new THREE.Float32BufferAttribute(bS, 1)); bg.setAttribute('aPh', new THREE.Float32BufferAttribute(bPh, 1)); bg.setAttribute('aSz', new THREE.Float32BufferAttribute(bSz, 1));
    const bm = bulbMat(), bulbs = new THREE.Points(bg, bm); bulbs.frustumCulled = false; bulbs.renderOrder = 5; G.add(bulbs);
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wP, 3)); wg.setAttribute('aUV', new THREE.Float32BufferAttribute(wUV, 2)); wg.setAttribute('aS', new THREE.Float32BufferAttribute(wS, 1)); wg.setAttribute('aSeed', new THREE.Float32BufferAttribute(wSeed, 1)); wg.setIndex(wI);
    const wm = new THREE.ShaderMaterial({ vertexShader: WIN_VS, fragmentShader: WIN_FS, uniforms: { uLead: bm.uniforms.uLead }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const wins = new THREE.Mesh(wg, wm); wins.frustumCulled = false; wins.renderOrder = 4; G.add(wins);
    return { G, bm, wm, L, tot, at, info: { facades: nf, rejected: nRej, trees: trees.length, arches, bulbs: bS.length, boxes: boxes.length } };
  }

  function snowLayer() {   // гъстият сняг около камерата (над времето „сняг“ на играта)
    const n = 26000, p = new Float32Array(n * 3), v = new Float32Array(n); for (let i = 0; i < n; i++) { p[i * 3] = Math.random(); p[i * 3 + 1] = Math.random(); p[i * 3 + 2] = Math.random(); v[i] = 1.4 + Math.random() * 1.8; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aV', new THREE.BufferAttribute(v, 1));
    const m = new THREE.ShaderMaterial({ vertexShader: SNOW_VS, fragmentShader: SNOW_FS, uniforms: { uCam: { value: new THREE.Vector3() }, uT: { value: 0 }, uPx: { value: 600 } }, transparent: true, depthWrite: false });
    const o = new THREE.Points(g, m); o.frustumCulled = false; o.renderOrder = 6; o.userData.xmasShow = 1; return o;
  }

  // ── музиката: „Jingle Bells“ (обществено достояние) — звънчета + бас, и шейкър като шейна ──
  function music(S) {
    if (deps.song && !(S && S.muted)) { const au = new Audio(deps.song); au.loop = true; au.volume = 0.8; let off = false; const fb = () => { if (!off) { off = true; stopSyn = synth(S); } }; let stopSyn = () => {};   // записана песен (deps.song), ако я има; иначе — синтезът
      au.play().catch(fb); au.onerror = fb; return () => { stopSyn(); const v0 = au.volume; let k = 0; const iv = setInterval(() => { k++; au.volume = Math.max(0, v0 * (1 - k / 20)); if (k >= 20) { clearInterval(iv); au.pause(); } }, 60); }; }   // песента — плавно затихва
    return synth(S);
  }
  function synth(S) {
    if (!S || !S.ctx || S.muted || !S.bell) return () => {};
    const E = 659, D = 587, C = 523, G = 784, F = 698, A = 440, B = 494, b = 0.3, mel = [
      [E, 1], [E, 1], [E, 2], [E, 1], [E, 1], [E, 2], [E, 1], [G, 1], [C, 1.5], [D, 0.5], [E, 4], [F, 1], [F, 1], [F, 1.5], [F, 0.5], [F, 1], [E, 1], [E, 1], [E, 0.5], [E, 0.5], [E, 1], [D, 1], [D, 1], [E, 1], [D, 2], [G, 2],
      [E, 1], [E, 1], [E, 2], [E, 1], [E, 1], [E, 2], [E, 1], [G, 1], [C, 1.5], [D, 0.5], [E, 4], [F, 1], [F, 1], [F, 1.5], [F, 0.5], [F, 1], [E, 1], [E, 1], [E, 0.5], [E, 0.5], [G, 1], [G, 1], [F, 1], [D, 1], [C, 4]];
    const bass = [C, G / 2, C, G / 2, C, G / 2, C, G / 2, F / 2, C, F / 2, C, G / 2, D / 2, G / 2, B / 2]; let stop = false, tm = [];
    const play = () => { if (stop) return; let t = 0.05; for (const [f, d] of mel) { S.bell(f, t, 0.07); t += d * b; } const bars = Math.round(t / (4 * b));
      for (let k = 0; k < bars; k++) { const f = bass[k % bass.length] / 2; S.tone && S.tone(f, 4 * b * 0.9, 0.05, 'triangle', null, 0.05 + k * 4 * b); }
      for (let k = 0; k < Math.round(t / b); k++) S.hit && S.hit(7000, 0.05, k % 2 ? 0.02 : 0.035, 0.5, 0.05 + k * b);   // звънчетата на шейната
      tm.push(setTimeout(play, t * 1000 + 400)); };
    try { play(); } catch (e) { }
    return () => { stop = true; tm.forEach(clearTimeout); };
  }

  // ── надписите и бутонът „Пропусни“ ──
  function ui(on) {
    let el = document.getElementById('xmasShowUi');
    if (!on) { if (el) { el.style.opacity = 0; setTimeout(() => el.remove(), 700); } return null; }
    if (!document.getElementById('xmasShowCss')) { const s = document.createElement('style'); s.id = 'xmasShowCss'; s.textContent = `#xmasShowUi{position:fixed;inset:0;z-index:450;pointer-events:auto;transition:opacity .7s}
#xmasShowUi .bar{position:absolute;left:0;right:0;height:9vh;background:#000}#xmasShowUi .bar.t{top:0}#xmasShowUi .bar.b{bottom:0}
#xmasShowUi .cap{position:absolute;left:0;right:0;top:36%;text-align:center;font:800 clamp(34px,7vw,92px)/1.1 Georgia,'Times New Roman',serif;color:#fff3d6;letter-spacing:1px;text-shadow:0 0 18px #ff4a2a,0 0 42px #ffb347,0 3px 4px #000;opacity:0;transform:scale(.92);transition:opacity 1.2s,transform 1.6s}
#xmasShowUi .cap small{display:block;font:600 clamp(15px,2.1vw,26px)/1.4 system-ui,sans-serif;color:#ffe9c2;text-shadow:0 0 10px #ff6a3a,0 2px 3px #000;margin-top:10px}
#xmasShowUi .cap.on{opacity:1;transform:none}#xmasShowUi .tag{position:absolute;left:4vw;bottom:11vh;font:700 clamp(14px,1.8vw,22px) system-ui,sans-serif;color:#fff;text-shadow:0 2px 4px #000;opacity:0;transition:opacity 1s}#xmasShowUi .tag.on{opacity:.95}
#xmasShowUi .skip{position:absolute;right:3vw;bottom:11.5vh;pointer-events:auto;cursor:pointer;background:rgba(0,0,0,.45);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:18px;padding:6px 14px;font:600 14px system-ui}`; document.head.appendChild(s); }
    el = document.createElement('div'); el.id = 'xmasShowUi'; el.innerHTML = `<div class="bar t"></div><div class="bar b"></div><div class="tag">🎄 Пловдив · Коледната нощ</div><div class="cap">🎄 Весела Коледа! 🎄<small>Честити празници от Строителна империя</small></div><button class="skip">Пропусни ⏭</button>`;
    document.body.appendChild(el); el.querySelector('.skip').onclick = () => stop(true); setTimeout(() => el.querySelector('.tag')?.classList.add('on'), 600); setTimeout(() => el.querySelector('.tag')?.classList.remove('on'), 7000);
    return el;
  }

  async function start() {
    if (cur) return false; await load(); if (!proto) return false;
    const route = boulevard(deps.plan()); if (!route) return false;
    const B = build(route), trucks = [], g0 = new THREE.Group(); g0.userData.xmasShow = 1;
    for (let i = 0; i < N; i++) { const cl = o => { const q = o.clone(true); q.traverse(m => { if (m.isMesh) m.material = m.material.clone(); }); q.userData.xmasShow = 1; return q; }, cab = cl(proto.cab), trl = cl(proto.trl), lt = truckLights(cab, trl);
      g0.add(cab, trl); trucks.push({ cab, trl, lt, s: 30 - i * (LEN + GAP), R: null }); }
    const snow = snowLayer(); deps.scene.add(B.G, g0, snow);
    cur = { B, trucks, g0, snow, t: 0, shot: -1, st: 0, cam: null, tgt: null, end: 0, el: ui(true), mus: music(deps.Sound) };
    return B.info;
  }
  function stop(skipped = false) {
    if (!cur) return; const c = cur; cur = null;
    deps.scene.remove(c.B.G, c.g0, c.snow); c.B.G.traverse(o => { o.geometry?.dispose(); }); c.snow.geometry.dispose(); c.snow.material.dispose(); c.B.bm.dispose(); c.B.wm.dispose();
    c.g0.traverse(o => { if (o.isMesh || o.isInstancedMesh) { o.material?.dispose && o.material.dispose(); } }); c.mus(); ui(false); deps.onEnd && deps.onEnd(skipped);
  }
  const P = {}, Q2 = {}, at = (s, out) => { const c = cur.B, p = c.at(Math.max(0, Math.min(c.tot - 0.01, s))); out.x = p.x - p.tz * LANE; out.z = p.z + p.tx * LANE; out.tx = p.tx; out.tz = p.tz; out.cx = p.x; out.cz = p.z; return out; };
  const tmp = new THREE.Vector3(), Q = {}, R2 = {};
  // кадрите: [продължителност s, функция(lead, last, f) → [камера x y z, цел x y z]]
  const SHOTS = [
    [10, (l, z, f) => { at(l + 34 - f * 6, Q); at(l, R2); return [Q.cx + Q.tz * 3.5, 3.4, Q.cz - Q.tx * 3.5, R2.x, 2.6, R2.z]; }],                                   // отпред, ниско: камионът идва към нас
    [11, (l, z, f) => { at(z - 40, Q); at(l + 45, R2); return [Q.cx, 30 - f * 8, Q.cz, R2.cx, 2, R2.cz]; }],                                                           // отзад-отгоре: светлата диря и тъмното напред
    [10, (l, z, f, c) => { if (!c.fix) { at(l + 70, Q); c.fix = [Q.cx + Q.tz * 6, 2.2, Q.cz - Q.tx * 6]; } at(l, R2); return [...c.fix, R2.x, 3, R2.z]; }],           // отстрани, на място: колоната минава покрай нас
    [12, (l, z, f) => { at(l - 10, Q); at(l + 10, R2); const r = 26 + f * 40; return [Q.cx + Q.tz * r * 0.6, 10 + f * 48, Q.cz - Q.tx * r * 0.6, R2.cx, 0, R2.cz]; }],  // кран: издига се над булеварда
  ];
  function update(dt, camera) {
    if (!cur) return; const c = cur; c.t += dt; const tt = performance.now() / 1000, B = c.B;
    let alive = 0, lead = -1e9, last = 1e9;
    for (const T of c.trucks) { T.s += SPEED * dt; const vis = T.s > 0 && T.s < B.tot - 1; T.cab.visible = T.trl.visible = vis; if (T.s < B.tot - 1) alive++; lead = Math.max(lead, T.s); last = Math.min(last, T.s); if (!vis) continue;
      // влекачът: предната ос — по пътя (s), задната — по пътя назад; ремаркето: оста му се влачи след седлото (трактриса) — завива по-навътре
      const pf = proto, F = at(T.s, P), fx = F.x, fz = F.z, Rr = at(T.s - (pf.fa - pf.ra), Q2), hx = fx - Rr.x, hz = fz - Rr.z, hl = Math.hypot(hx, hz) || 1, ux = hx / hl, uz = hz / hl;
      const kx = Rr.x + ux * pf.ra, kz = Rr.z + uz * pf.ra; T.cab.position.set(kx, 0.05, kz); T.cab.rotation.y = Math.atan2(ux, uz);
      if (!T.R) T.R = { x: kx - ux * pf.ta, z: kz - uz * pf.ta }; let dx = kx - T.R.x, dz = kz - T.R.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl; T.R.x = kx - dx * pf.ta; T.R.z = kz - dz * pf.ta;
      T.trl.position.set(kx, 0.05, kz); T.trl.rotation.y = Math.atan2(dx, dz); T.lt.forEach((im, k) => { im.material.opacity = (Math.floor(tt * 2.5) + k) % 3 === 0 ? 1 : 0.3; }); }
    B.bm.uniforms.uLead.value = Math.min(lead, B.tot + 50); B.bm.uniforms.uT.value = tt;
    const px = window.innerHeight * Math.min(2, window.devicePixelRatio || 1) / (2 * Math.tan((camera.fov || 50) * Math.PI / 360)); B.bm.uniforms.uPx.value = px;
    c.snow.material.uniforms.uT.value = c.t; c.snow.material.uniforms.uPx.value = px; c.snow.material.uniforms.uCam.value.copy(camera.position);
    // камерата
    let want;
    if (!alive || last > B.tot - 25) { if (!c.end) { c.end = c.t; c.el?.querySelector('.cap')?.classList.add('on'); } const f = Math.min(1, (c.t - c.end) / 9), m = B.at(B.tot * 0.5);   // финалът: целият булевард свети
      want = [m.x - m.tz * (90 + f * 30), 60 + f * 25, m.z + m.tx * (90 + f * 30), m.x, 4, m.z]; if (c.t - c.end > 8) { stop(false); return; } }
    else { let k = 0, acc = 0, tl = c.t; for (;;) { const d = SHOTS[k % SHOTS.length][0]; if (tl < acc + d) break; acc += d; k++; } if (k !== c.shot) { c.shot = k; c.st = acc; c.ctx = {}; c.snap = true; }
      const [d, fn] = SHOTS[k % SHOTS.length]; want = fn(Math.max(lead, 0), last, (c.t - c.st) / d, c.ctx); }
    if (!c.cam || c.snap) { c.cam = new THREE.Vector3(want[0], want[1], want[2]); c.tgt = new THREE.Vector3(want[3], want[4], want[5]); c.snap = false; }
    else { const k = 1 - Math.exp(-dt * 2.5); c.cam.lerp(tmp.set(want[0], want[1], want[2]), k); c.tgt.lerp(tmp.set(want[3], want[4], want[5]), k); }
    deps.setCam(c.cam.x, c.cam.y, c.cam.z, c.tgt.x, c.tgt.y, c.tgt.z);
  }
  const seek = (t, camera) => { for (let k = 0; cur && cur.t < t && k < 3000; k++) update(0.1, camera); };   // Лабораторията: превъртане
  return { start, stop, update, seek, get busy() { return !!cur; }, info: () => cur && { ...cur.B.info, tot: Math.round(cur.B.tot), t: +cur.t.toFixed(1), lead: Math.round(cur.B.bm.uniforms.uLead.value) } };
}
