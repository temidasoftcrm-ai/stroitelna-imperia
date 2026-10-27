// mine3d.js — 3D площадките на добива и производството (Азия, mines.js): по една на 2×2 парцела.
// 🛢️ нефтено находище (люлеещи се помпи, резервоари, факел), рафинерия (модел от Sketchfab + колони, факел, дим),
// петролен терминал (резервоари, кей и акостирал танкер), кариери, железорудна мина, дъскорезница, стоманодобивен,
// циментов и стъкларски завод. Всичко е процедурно (нисколигонно, като Kenney), освен рафинерията и резервоарите.
// buildSite3D(group, deps, { kind, lv, x, z, scale, ext }) → { group, update(t, night), dispose }
import * as THREE from 'three';
import { canvasTex } from './texdata.js';   // fac-data (T1): статичните платна → собствени данни (не се губят)
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { feature } from './lab/feature.js';

const mat = (c, r = 0.8, m = 0, e) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...(e ? { emissive: e, emissiveIntensity: 1 } : {}) });
const box = (w, h, d, m, x, y, z, g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
const cyl = (r1, r2, h, m, x, y, z, g, seg = 16) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
const M = {
  sand: mat(0xd9c08a, 1), dirt: mat(0x9a7b55, 1), gravel: mat(0x8d8a84, 1), conc: mat(0xb9b6ae, 0.95), asph: mat(0x3c3f44, 0.95),
  steel: mat(0x8f99a3, 0.5, 0.4), dark: mat(0x2d3136, 0.7, 0.3), white: mat(0xeef0f0, 0.6, 0.1), red: mat(0xc0392b, 0.7), yellow: mat(0xf2b705, 0.6),
  rust: mat(0x8a4b2a, 0.8), oil: mat(0x141414, 0.3), water: mat(0x2f6f9f, 0.25, 0.1), wood: mat(0x9b6b3d, 0.9), log: mat(0x7a5230, 0.9), plank: mat(0xd8b27a, 0.9),
  brick: mat(0x9c4a35, 0.9), roofB: mat(0x3d5a73, 0.7), roofG: mat(0x7d8b7a, 0.8), ore: mat(0x7a3f2c, 1), stone: mat(0x9d9a92, 1), glass: mat(0x9fd3e6, 0.15, 0.2),
  glow: mat(0xff7a1a, 0.5, 0, 0xff6a00), flame: new THREE.MeshBasicMaterial({ color: 0xffa21f, transparent: true, opacity: 0.9 }),
};
// дим: малки спрайтове, които се издигат, растат и избледняват
let smokeTex = null;
function smokeTexture() {
  if (smokeTex) return smokeTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return (smokeTex = canvasTex(c));
}
function smoke(g, x, y, z, { n = 8, col = 0x9a9a9a, h = 10, w = 3 } = {}) {
  const ps = [];
  for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture(), color: col, transparent: true, depthWrite: false, opacity: 0 })); g.add(s); ps.push({ s, t: i / n }); }
  return dt => { for (const p of ps) { p.t = (p.t + dt * 0.12) % 1; const k = p.t; p.s.position.set(x + Math.sin(k * 5 + p.s.id) * 0.6 + k * 2, y + k * h, z); p.s.scale.setScalar(1 + k * w); p.s.material.opacity = 0.55 * (1 - k) * Math.min(1, k * 6); } };
}
// факел: тънка кула с трептящ пламък
function flare(g, x, z, h = 12) {
  cyl(0.25, 0.35, h, M.steel, x, h / 2, z, g, 8);
  const f = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.6, 8), M.flame); f.position.set(x, h + 1.2, z); g.add(f);
  const light = new THREE.PointLight(0xff8a2a, 0, 30); light.position.set(x, h + 1.5, z); g.add(light);
  const sm = smoke(g, x, h + 2.2, z, { n: 6, col: 0x555555, h: 8 });
  return (dt, t, night) => { const k = 0.8 + Math.sin(t * 17) * 0.12 + Math.sin(t * 7.3) * 0.1; f.scale.set(k, k * (1 + Math.sin(t * 11) * 0.15), k); light.intensity = night ? 40 * k : 0; sm(dt); };
}
// тръбопровод между две точки на земята
function pipe(g, a, b, y = 0.5, r = 0.18, m = M.steel) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), o = cyl(r, r, L, m, (a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, g, 6);
  o.rotation.z = Math.PI / 2; o.rotation.y = -Math.atan2(dz, dx); return o;
}
function tank(g, x, z, r = 2.2, h = 3, m = M.white) { cyl(r, r, h, m, x, h / 2, z, g, 20); cyl(r * 0.98, r * 0.6, 0.5, m, x, h + 0.25, z, g, 20); const st = box(0.2, h, 0.6, M.dark, x + r, h / 2, z, g); st.rotation.y = 0.3; }
// помпа „люлка“ (pumpjack): A-рамка, люлеещо се рамо с „конска глава“ и въртящ се противотежест
function pumpjack(g, x, z, rot = 0, ph = 0) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = rot; g.add(p);
  box(5.2, 0.3, 1.6, M.conc, 0, 0.15, 0, p);
  for (const s of [-0.5, 0.5]) { const a = box(0.2, 3.4, 0.2, M.yellow, 0, 1.9, s, p); a.rotation.x = -s * 0.25; }   // A-рамка
  const beam = new THREE.Group(); beam.position.set(0, 3.5, 0); p.add(beam);
  box(5.4, 0.35, 0.35, M.yellow, 0.3, 0, 0, beam);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.5, 12, 1, false, 0, Math.PI), M.yellow); head.rotation.x = Math.PI / 2; head.rotation.z = -Math.PI / 2; head.position.set(3.1, -0.1, 0); beam.add(head);
  const rod = box(0.08, 3.2, 0.08, M.dark, 3.9, -1.7, 0, beam);
  cyl(0.35, 0.45, 0.8, M.dark, 4 - 0.1, 0.4, 0, p, 8);   // устие на сондажа
  box(1.2, 1.1, 1.2, M.dark, -2.1, 0.85, 0, p);   // мотор/редуктор
  const crank = new THREE.Group(); crank.position.set(-2.1, 1.5, 0); p.add(crank);
  for (const s of [-0.75, 0.75]) box(1.8, 0.7, 0.18, M.red, 0.5, 0, s, crank);
  for (const s of [-0.7, 0.7]) { const pit = box(0.12, 2, 0.12, M.dark, -2.2, 2.5, s, p); pit.rotation.z = 0.15; }   // мотовилки
  return (dt, t) => { const a = t * 1.8 + ph; beam.rotation.z = Math.sin(a) * 0.32; crank.rotation.z = -a; rod.position.y = -1.7 - Math.sin(a) * 0.05; };
}
// камион, който обикаля по правоъгълник — истинският самосвал (assets/heavy/gear/dump.glb, като на строежите);
// докато се зареди — процедурният; гледа накъдето кара
let DUMP = null, dumpP = null;
const loadDump = () => dumpP || (dumpP = new GLTFLoader().loadAsync('assets/heavy/gear/dump.glb').then(gl => {
  const g = new THREE.Group(), inner = new THREE.Group(); inner.add(gl.scene); g.add(inner); g.updateMatrixWorld(true);
  let bb = new THREE.Box3().setFromObject(g), sz = bb.getSize(new THREE.Vector3()); inner.scale.setScalar(1 / sz.z); g.updateMatrixWorld(true);
  bb = new THREE.Box3().setFromObject(g); const c = bb.getCenter(new THREE.Vector3()); inner.position.set(-c.x, -bb.min.y, -c.z);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  DUMP = g; return g;
}).catch(() => null));
function truck(g, pts, col = 0xd35400, speed = 4, y = 0) {
  const t = new THREE.Group(); g.add(t);
  const body = new THREE.Group(); t.add(body);   // процедурният — носът към +z (като истинския)
  const proc = () => { box(1.5, 1.2, 1.4, mat(col, 0.6), 0, 0.9, 1.3, body); box(1.6, 1.1, 2.4, M.dark, 0, 0.85, -0.6, body); for (const [a, b] of [[0.8, -1.2], [-0.8, -1.2], [0.8, 1.3], [-0.8, 1.3]]) { const w = cyl(0.35, 0.35, 0.3, M.dark, a, 0.35, b, body, 10); w.rotation.z = Math.PI / 2; } };
  const real = () => { body.clear(); const m = DUMP.clone(true); m.scale.setScalar(3.8); m.userData.mineDump = true; body.add(m); };
  if (DUMP) real(); else { proc(); loadDump().then(d => { if (d) real(); }); }
  let L = 0; const seg = pts.map((p, i) => { const q = pts[(i + 1) % pts.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); const s0 = L; L += l; return { p, q, l, s0 }; });
  let s = Math.random() * L;
  return dt => { s = (s + dt * speed) % L; const sg = seg.find(q => s >= q.s0 && s < q.s0 + q.l) || seg[0], f = (s - sg.s0) / sg.l; t.position.set(sg.p[0] + (sg.q[0] - sg.p[0]) * f, y, sg.p[1] + (sg.q[1] - sg.p[1]) * f); t.rotation.y = Math.atan2(sg.q[0] - sg.p[0], sg.q[1] - sg.p[1]); };
}
// процедурен петролен танкер (за терминала)
function tanker(g, x, z, L = 20) {
  const s = new THREE.Group(); s.position.set(x, 0, z); g.add(s);
  const hull = box(L, 2, 3.4, M.red, 0, 0.6, 0, s); hull.material = mat(0x7a1f1f, 0.7);
  box(L, 0.6, 3.4, M.dark, 0, 1.9, 0, s);
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 2.6, 3, 1), mat(0x7a1f1f, 0.7)); bow.rotation.y = Math.PI / 6; bow.position.set(L / 2, 1, 0); bow.scale.set(1.3, 1, 1); s.add(bow);
  box(L * 0.85, 0.15, 3.2, mat(0x5d6d5a, 0.8), -0.5, 2.25, 0, s);
  pipe(s, [-L * 0.4, 0], [L * 0.4, 0], 2.55, 0.12, M.steel);
  for (let i = -3; i <= 3; i++) cyl(0.12, 0.12, 0.6, M.steel, i * 2.4, 2.6, 0.8, s, 6);
  box(2.6, 3, 3, M.white, -L / 2 + 2, 3.8, 0, s); box(2.8, 0.4, 3.4, M.white, -L / 2 + 2, 5.4, 0, s);
  cyl(0.4, 0.5, 2, M.red, -L / 2 + 0.8, 6, 0, s, 10);
  return (dt, t) => { s.position.y = Math.sin(t * 0.9) * 0.08; s.rotation.x = Math.sin(t * 0.7) * 0.01; };
}
// сгради-халета
function hall(g, x, z, w, d, h, wall = M.conc, roof = M.roofB) { box(w, h, d, wall, x, h / 2, z, g); const r = box(w + 0.4, 0.4, d + 0.4, roof, x, h + 0.2, z, g); return r; }
function fence(g, ex, ez) {
  const pm = M.steel, n = 10;
  for (const [sx, sz] of [[1, 0], [0, 1]]) for (const s of [-1, 1]) { const len = sx ? ex : ez; const b = box(sx ? len : 0.08, 1.1, sx ? 0.08 : len, mat(0x6b7480, 0.6, 0.3, null), sx ? 0 : s * ex / 2, 0.6, sx ? s * ez / 2 : 0, g); b.material.transparent = true; b.material.opacity = 0.55; for (let i = 0; i <= n; i++) box(0.12, 1.3, 0.12, pm, sx ? -len / 2 + i * len / n : s * ex / 2, 0.65, sx ? s * ez / 2 : -len / 2 + i * len / n, g); }
}
const glbCache = {};
function loadGlb(url) { return glbCache[url] || (glbCache[url] = new GLTFLoader().loadAsync(url).then(gl => gl.scene).catch(() => null)); }
function placeGlb(url, parent, side, x, z, alive, rot = 0) {
  loadGlb(url).then(src => {
    if (!src || !alive()) return;
    const o = src.clone(true); o.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; if (m.material?.metalness > 0.4) m.material.metalness = 0.3; } });
    const bb = new THREE.Box3().setFromObject(o), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    const w = new THREE.Group(); w.add(o); o.position.set(-c.x, -bb.min.y, -c.z); w.scale.setScalar(side / Math.max(sz.x, sz.z)); w.position.set(x, 0.05, z); w.rotation.y = rot; parent.add(w);
  });
}

// ---------------------------------------------------------------- видовете площадки
// слънчев панел: тъмносини клетки с тънки сребристи линии
let panelM = null;
function panelMat() {
  if (panelM) return panelM;
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#1b2f5a'; x.fillRect(0, 0, 256, 64); x.strokeStyle = '#8fa6c8'; x.lineWidth = 1.5;
  for (let i = 0; i <= 256; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 64); x.stroke(); }
  for (let j = 0; j <= 64; j += 16) { x.beginPath(); x.moveTo(0, j); x.lineTo(256, j); x.stroke(); }
  const t = canvasTex(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(4, 1); t.colorSpace = THREE.SRGBColorSpace;
  return (panelM = new THREE.MeshStandardMaterial({ map: t, roughness: 0.25, metalness: 0.5 }));
}
const KINDS = {
  oilwell(g, ex, ez, lv, U, alive) {
    box(ex, 0.08, ez, M.sand, 0, 0.04, 0, g);
    for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.CircleGeometry(1 + Math.random() * 1.2, 12), M.oil); s.rotation.x = -Math.PI / 2; s.position.set((Math.random() - 0.5) * ex * 0.8, 0.09, (Math.random() - 0.5) * ez * 0.8); g.add(s); }
    const n = 2 + lv, P = [[-6, -6], [6, -6], [-6, 4], [6, 4], [0, -1]];
    for (let i = 0; i < Math.min(n, P.length); i++) { U.push(pumpjack(g, P[i][0], P[i][1], i * 0.7, i * 1.3)); pipe(g, [P[i][0] + 3, P[i][1]], [P[i][0] + 3, 9], 0.25, 0.12); }
    pipe(g, [-8, 9], [8, 9], 0.25, 0.2);
    tank(g, -8, 10.5, 1.8, 3.2); tank(g, -3.5, 10.5, 1.8, 3.2); if (lv >= 2) tank(g, 1, 10.5, 1.8, 3.2);
    const f = flare(g, 10, 10, 10 + lv * 2); U.push((dt, t, n) => f(dt, t, n));
    U.push(truck(g, [[-ex / 2 + 2, -ez / 2 + 2], [ex / 2 - 2, -ez / 2 + 2], [ex / 2 - 2, ez / 2 - 3], [-ex / 2 + 2, ez / 2 - 3]], 0xe67e22, 3.5));
  },
  refinery(g, ex, ez, lv, U, alive) {
    box(ex, 0.08, ez, M.conc, 0, 0.04, 0, g);
    placeGlb('assets/heavy/mines/refinery.glb', g, 13, -5, -4, alive);
    for (let i = 0; i < 2 + lv; i++) { const x = 4 + (i % 2) * 3.5, z = -8 + Math.floor(i / 2) * 5, h = 11 + (i % 3) * 3; cyl(0.9, 1.1, h, M.white, x, h / 2, z, g, 12); for (let k = 3; k < h; k += 3) cyl(1.3, 1.3, 0.15, M.dark, x, k, z, g, 12); }
    for (let i = 0; i < 4; i++) tank(g, -9 + i * 4.6, 8.5, 1.9, 3);
    pipe(g, [-10, 5.5], [10, 5.5], 1.8, 0.25); pipe(g, [2, -10], [2, 5.5], 1.8, 0.2);
    for (let i = -10; i <= 10; i += 4) box(0.3, 1.8, 0.3, M.dark, i, 0.9, 5.5, g);
    const f = flare(g, 10.5, -10, 14); U.push((dt, t, n) => f(dt, t, n));
    cyl(0.6, 0.8, 12, M.brick, 9.5, 6, -1, g, 10); U.push(smoke(g, 9.5, 12.5, -1, { col: 0xb0b0b0, h: 12 }));
    if (lv >= 2) { cyl(0.5, 0.7, 10, M.brick, 9.5, 5, 2.5, g, 10); U.push(smoke(g, 9.5, 10.5, 2.5, { col: 0xb0b0b0 })); }
    U.push(truck(g, [[-ex / 2 + 2, 11.5], [ex / 2 - 2, 11.5]], 0xbdc3c7, 4));
  },
  terminal(g, ex, ez, lv, U, alive) {
    box(ex, 0.08, ez * 0.55, M.conc, 0, 0.04, -ez * 0.225, g);
    const wz = ez * 0.275, w = new THREE.Mesh(new THREE.PlaneGeometry(ex, ez * 0.45), M.water); w.rotation.x = -Math.PI / 2; w.position.set(0, 0.1, wz); g.add(w);   // басейн пред кея (над терена на града)
    box(ex, 0.9, 0.6, M.conc, 0, 0.45, 0.2, g);   // кейова стена
    box(ex * 0.8, 0.4, 2.2, M.conc, 0, 0.6, 3.2, g); for (let i = -4; i <= 4; i++) box(0.4, 1.4, 0.4, M.dark, i * ex * 0.09, -0.2, 3.2, g);   // кей на стълбове
    for (let i = -2; i <= 2; i += 2) { const a = box(0.25, 3.5, 0.25, M.yellow, i * 2.5, 2.4, 3.4, g); const b = box(0.2, 0.2, 2.2, M.yellow, i * 2.5, 4.1, 4.4, g); }   // товарни рамена
    U.push(tanker(g, 0, 7.6, Math.min(22, ex * 0.85)));
    const n = 3 + lv; for (let i = 0; i < n; i++) tank(g, -9 + (i % 4) * 5.5, -9 + Math.floor(i / 4) * 5.5, 2.3, 3.4);
    placeGlb('assets/heavy/mines/tanks.glb', g, 7, 8, -6, alive);
    pipe(g, [-10, -3], [10, -3], 0.5, 0.25); pipe(g, [0, -3], [0, 3.2], 0.5, 0.25);
  },
  sandpit(g, ex, ez, lv, U) {
    box(ex, 0.08, ez, M.sand, 0, 0.04, 0, g);
    for (let k = 0; k < 3; k++) box(ex * (0.7 - k * 0.15), 0.12, ez * (0.6 - k * 0.13), mat([0xc9a96e, 0xb99659, 0xa3824a][k], 1), -1, 0.1 + k * 0.05, -2, g);   // стъпаловидна яма
    for (const [x, z, r] of [[8, 7, 2.6], [4, 9, 2], [9, 2, 1.8]]) { const c = new THREE.Mesh(new THREE.ConeGeometry(r, r * 1.1, 14), M.sand); c.position.set(x, r * 0.55, z); c.castShadow = true; g.add(c); }
    U.push(truck(g, [[-8, -8], [6, -8], [6, 6], [-8, 6]], 0xf1c40f, 3));
    if (lv >= 2) U.push(truck(g, [[-10, 9], [10, 9]], 0xe67e22, 4));
    hall(g, -8, 9, 5, 3.5, 3, M.conc, M.roofG);
  },
  quarry(g, ex, ez, lv, U, alive) {
    box(ex, 0.08, ez, M.gravel, 0, 0.04, 0, g);
    if (feature('mine-quarry-real')) {   // реалистичната кариера (Tudor Stone Quarry, novusod, CC BY 4.0 — Sketchfab); в играта след „✓ OK“ в Лабораторията
      placeGlb('assets/heavy/mines/quarry.glb', g, Math.min(ex, ez) * 0.92, 0, 0, alive);
      U.push(truck(g, [[-11, 11.5], [11, 11.5], [11, -11.5], [-11, -11.5]], 0xf39c12, 3));
      return;
    }
    for (let k = 0; k < 4; k++) { const r = 9 - k * 2; const o = cyl(r, r, 0.6, mat([0xa6a39b, 0x948f86, 0x847f76, 0x726d65][k], 1), -2, 0.3 + k * 0.6, -1, g, 20); o.scale.z = 0.8; }   // терасовиден хълм
    for (const [x, z, r] of [[9, 8, 2], [6, 10, 1.6]]) { const c = new THREE.Mesh(new THREE.ConeGeometry(r, r, 8), M.stone); c.position.set(x, r / 2, z); c.castShadow = true; g.add(c); }
    hall(g, 8, -8, 4, 4, 5, M.steel, M.roofG); const cv = box(9, 0.3, 0.8, M.dark, 8, 4, -2, g); cv.rotation.z = 0.5; cv.rotation.y = Math.PI / 2;
    U.push(truck(g, [[-11, 10], [11, 10], [11, -11], [-11, -11]], 0xf39c12, 3));
  },
  ironmine(g, ex, ez, lv, U) {
    box(ex, 0.08, ez, M.dirt, 0, 0.04, 0, g);
    const t = new THREE.Group(); t.position.set(-4, 0, -3); g.add(t);   // шахтова кула (копър)
    for (const [a, b] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) { const l = box(0.3, 14, 0.3, M.red, a * 0.7, 7, b * 0.7, t); l.rotation.z = -a * 0.04; l.rotation.x = b * 0.04; }
    for (let y = 3; y < 14; y += 3) box(2.4, 0.2, 2.4, M.red, 0, y, 0, t);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.15, 6, 16), M.dark); wheel.position.set(0, 14.5, 0); t.add(wheel);
    const leg = box(0.3, 13, 0.3, M.red, 4, 6.5, 0, t); leg.rotation.z = 0.32;
    hall(g, 4, -3, 6, 5, 4, M.brick, M.roofB); cyl(0.5, 0.6, 9, M.brick, 7, 4.5, -6, g, 10); U.push(smoke(g, 7, 9.5, -6, { col: 0x777777 }));
    for (const [x, z, r] of [[-8, 8, 2.4], [-3, 9, 2], [2, 9.5, 1.6]]) { const c = new THREE.Mesh(new THREE.ConeGeometry(r, r * 0.9, 10), M.ore); c.position.set(x, r * 0.45, z); c.castShadow = true; g.add(c); }
    U.push((dt, t2) => { wheel.rotation.z = -t2 * 1.5; });
    U.push(truck(g, [[-11, 4], [11, 4]], 0x7f8c8d, 4));
  },
  sawmill(g, ex, ez, lv, U) {
    box(ex, 0.08, ez, M.dirt, 0, 0.04, 0, g);
    hall(g, -2, -5, 12, 6, 4.5, M.wood, M.roofG); box(3, 3, 0.2, M.dark, -2, 1.5, -1.9, g);
    for (let p = 0; p < 3; p++) for (let r = 0; r < 3; r++) for (let i = 0; i < 5 - r; i++) { const l = cyl(0.45, 0.45, 6, M.log, -9 + p * 7 + i * 0.95 + r * 0.47, 0.45 + r * 0.8, 6 + 0, g, 8); l.rotation.x = Math.PI / 2; }
    for (let i = 0; i < 2 + lv; i++) for (let k = 0; k < 4; k++) box(3, 0.25, 1.2, M.plank, 7 + (i % 2) * 3.6, 0.2 + k * 0.28, -9 + Math.floor(i / 2) * 2, g);
    cyl(0.4, 0.5, 8, M.brick, 4, 4, -8, g, 8); U.push(smoke(g, 4, 8.5, -8, { col: 0xc8c8c8, n: 5 }));
    U.push(truck(g, [[-11, 10.5], [11, 10.5]], 0x27ae60, 3.5));
  },
  steelmill(g, ex, ez, lv, U) {
    box(ex, 0.08, ez, M.asph, 0, 0.04, 0, g);
    cyl(1.8, 2.6, 13, M.rust, -6, 6.5, -4, g, 14); cyl(1.2, 1.6, 3, M.dark, -6, 14.5, -4, g, 12);   // доменна пещ
    for (let i = 0; i < 3; i++) cyl(1.3, 1.3, 11, M.steel, -1.5 + i * 3, 5.5, -7, g, 14);   // каупери
    hall(g, 3, 3, 14, 7, 6, M.steel, M.roofB);
    const glow = box(3, 1.2, 0.2, M.glow, 3, 1.2, -0.5, g);
    for (let i = 0; i < 1 + lv; i++) { const x = 8 + i * 2.2; cyl(0.6, 0.8, 16, M.brick, x, 8, -8, g, 10); U.push(smoke(g, x, 16.5, -8, { col: 0x8a8a8a, h: 14, n: 9 })); }
    pipe(g, [-6, -4], [0, -7], 10, 0.4, M.rust);
    U.push((dt, t) => { glow.material.emissiveIntensity = 0.8 + Math.sin(t * 6) * 0.3; });
    U.push(truck(g, [[-11, 10], [11, 10]], 0x34495e, 3.5));
  },
  cement(g, ex, ez, lv, U) {
    box(ex, 0.08, ez, M.conc, 0, 0.04, 0, g);
    for (let i = 0; i < 2 + lv; i++) { cyl(1.6, 1.6, 10, M.white, -9 + i * 3.6, 5, -7, g, 16); const c = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.4, 16), M.white); c.position.set(-9 + i * 3.6, 10.7, -7); g.add(c); }
    box(4, 16, 4, M.conc, 6, 8, -6, g); for (let y = 4; y < 16; y += 4) box(4.6, 0.3, 4.6, M.dark, 6, y, -6, g);   // подгревна кула
    const kiln = cyl(1.1, 1.1, 16, M.steel, 1, 2.6, 2, g, 14); kiln.rotation.z = Math.PI / 2 - 0.06;   // въртяща се пещ
    for (const x of [-5, 1, 7]) box(0.6, 2, 2.4, M.conc, x, 1, 2, g);
    cyl(0.7, 0.9, 18, M.white, 10, 9, -10, g, 12); U.push(smoke(g, 10, 18.5, -10, { col: 0xd8d8d8, h: 12 }));
    U.push((dt, t) => { kiln.rotation.y = t * 0.3; });
    U.push(truck(g, [[-11, 9.5], [11, 9.5]], 0x95a5a6, 3.5));
  },
  glass(g, ex, ez, lv, U) {
    box(ex, 0.08, ez, M.conc, 0, 0.04, 0, g);
    const L = 16; box(L, 5, 8, M.brick, -1, 2.5, -4, g);
    for (let i = 0; i < 6; i++) { const r = box(L / 6, 0.3, 4.6, M.glass, -1 - L / 2 + L / 12 + i * L / 6, 5.9, -4, g); r.rotation.x = 0.5; }   // зъбат покрив със стъкло
    const glow = box(2, 1.4, 0.2, M.glow, -6, 1.2, 0.1, g);
    cyl(0.6, 0.8, 14, M.brick, 9, 7, -6, g, 10); U.push(smoke(g, 9, 14.5, -6, { col: 0xbababa, h: 10 }));
    for (let i = 0; i < 3 + lv; i++) { const p = box(2.4, 1.6, 0.15, M.glass, -9 + i * 3, 0.9, 7, g); p.rotation.x = -0.15; box(2.6, 0.2, 1, M.wood, -9 + i * 3, 0.1, 7.3, g); }
    U.push((dt, t) => { glow.material.emissiveIntensity = 0.7 + Math.sin(t * 4) * 0.3; });
    U.push(truck(g, [[-11, 10.5], [11, 10.5]], 0x2980b9, 3.5));
  },

  // ── енергетика (Австралия) ──
  solar(g, ex, ez, lv, U) {
    box(ex, 0.08, ez, mat(0xc89a62, 1), 0, 0.04, 0, g);   // червеникава австралийска земя
    const pm = panelMat(), rows = 3 + lv * 2, L = ex - 6, dz = (ez - 6) / rows;
    for (let r = 0; r < rows; r++) {
      const z = -ez / 2 + 4 + r * dz;
      const p = box(L, 0.12, 2.2, pm, 0, 1.3, z, g); p.rotation.x = -0.45;   // наклонени към слънцето
      for (let x = -L / 2 + 1; x <= L / 2 - 1; x += 4) box(0.15, 1.1, 0.15, M.steel, x, 0.55, z + 0.4, g);
    }
    hall(g, ex / 2 - 4, ez / 2 - 2.5, 4, 2.6, 2.4, M.white, M.roofG);   // инвертор
    const led = box(0.3, 0.3, 0.05, mat(0x103010, 0.4, 0, 0x2ecc71), ex / 2 - 4, 1.8, ez / 2 - 1.15, g);
    U.push((dt, t) => { led.material.emissiveIntensity = (Math.sin(t * 3) > 0) ? 1.2 : 0.2; });
  },
  wind(g, ex, ez, lv, U) {
    box(ex, 0.08, ez, mat(0xa9b56a, 1), 0, 0.04, 0, g);
    const spots = [[-6, -6], [6, 5], [-7, 7], [7, -7], [0, 0]].slice(0, 2 + lv);
    spots.forEach(([x, z], i) => {
      const H = 17;
      cyl(0.35, 0.65, H, M.white, x, H / 2, z, g, 12);
      box(2, 0.6, 2, M.conc, x, 0.3, z, g);
      const nac = new THREE.Group(); nac.position.set(x, H + 0.4, z); nac.rotation.y = 0.6; g.add(nac);
      box(0.9, 0.9, 2.6, M.white, 0, 0, -0.4, nac);
      const rot = new THREE.Group(); rot.position.set(0, 0, 1.05); nac.add(rot);
      const hub = cyl(0.35, 0.35, 0.7, M.white, 0, 0, 0, rot, 10); hub.rotation.x = Math.PI / 2;
      for (let k = 0; k < 3; k++) { const a = new THREE.Group(); a.rotation.z = k * Math.PI * 2 / 3; rot.add(a); const b = box(0.5, 7, 0.12, M.white, 0, 3.6, 0.1, a); b.scale.x = 0.9; }
      const light = cyl(0.12, 0.12, 0.15, mat(0x300000, 0.5, 0, 0xff2020), 0, 0.55, -1.4, nac, 6);
      const sp = 1.6 + (i % 3) * 0.25, ph = i * 1.3;
      U.push((dt, t, night) => { rot.rotation.z = -t * sp - ph; light.material.emissiveIntensity = night ? (Math.sin(t * 2.5 + ph) > 0.3 ? 2 : 0.1) : 0.3; });
    });
    hall(g, ex / 2 - 3.5, ez / 2 - 2.5, 4, 2.6, 2.4, M.conc, M.roofB);
  },
  battery(g, ex, ez, lv, U) {
    box(ex, 0.08, ez, M.gravel, 0, 0.04, 0, g);
    const cont = mat(0xe9ecef, 0.55, 0.15), rows = 2 + lv, leds = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < 3; c++) {
      const x = -7 + c * 6.5, z = -ez / 2 + 4 + r * 4;
      box(5.6, 2.6, 2.4, cont, x, 1.4, z, g); box(5.8, 0.15, 2.6, M.dark, x, 0.08, z, g);
      for (let v = -2; v <= 2; v += 1) box(0.6, 1.2, 0.05, M.steel, x + v * 1, 1.5, z + 1.22, g);   // решетки за охлаждане
      const l = box(0.18, 0.18, 0.05, mat(0x0a2a10, 0.4, 0, 0x2ecc71), x + 2.4, 2.3, z + 1.23, g); leds.push(l);
    }
    for (let i = 0; i < 2; i++) { hall(g, 8, 4 + i * 3.6, 3, 2.4, 2.2, M.steel, M.dark); }   // инвертори
    box(3, 2.6, 2.4, mat(0x4d5b4a, 0.7, 0.2), 0, 1.3, 8.5, g);   // трансформатор
    for (let k = 0; k < 3; k++) cyl(0.12, 0.12, 1.2, M.white, -0.8 + k * 0.8, 3.2, 8.5, g, 6);
    U.push((dt, t, night) => { leds.forEach((l, i) => { l.material.emissiveIntensity = (Math.sin(t * 2 + i) > -0.2 ? 1 : 0.15) * (night ? 2 : 1); }); });
  },
  grid(g, ex, ez, lv, U) {
    box(ex, 0.08, ez, M.gravel, 0, 0.04, 0, g);
    // подстанция: трансформатори, изолатори, портали
    const tr = mat(0x5e6b5a, 0.7, 0.2);
    for (let i = 0; i < 1 + lv; i++) { const x = -8 + i * 5; box(3, 3, 2.4, tr, x, 1.5, -6, g); for (let f = -1; f <= 1; f++) box(3.2, 2.4, 0.1, M.dark, x, 1.4, -6 + f * 0.5 + 1.3, g); for (let k = 0; k < 3; k++) cyl(0.15, 0.15, 1.6, M.white, x - 0.9 + k * 0.9, 3.8, -6, g, 6); }
    for (const x of [-9, -1, 7]) { box(0.3, 8, 0.3, M.steel, x, 4, -1, g); box(0.3, 8, 0.3, M.steel, x, 4, 3, g); box(0.3, 0.3, 4.3, M.steel, x, 8, 1, g); }
    for (let x = -9; x <= 7; x += 2) for (let k = 0; k < 3; k++) cyl(0.12, 0.12, 2.2, M.white, x, 1.1, 0 + k, g, 6);
    hall(g, 8, -8, 5, 4, 3.5, M.brick, M.roofB);   // командна сграда
    // далекопровод: решетъчни стълбове към края на площадката
    const tops = [];
    const pylon = (x, z, H) => {
      const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = box(0.18, H, 0.18, M.steel, a * 0.8, H / 2, b * 0.8, p); l.rotation.z = a * 0.06; l.rotation.x = -b * 0.06; }
      for (let y = 2; y < H; y += 2.2) { const c = box(1.6 - y * 0.05, 0.08, 0.08, M.steel, 0, y, 0.75 - y * 0.03, p); c.rotation.z = (y % 4.4 < 2.2 ? 0.6 : -0.6); }
      box(0.15, 0.15, 7, M.steel, 0, H - 2, 0, p); box(0.15, 0.15, 5, M.steel, 0, H, 0, p);
      tops.push([[x, H - 2.6, z - 3.3], [x, H - 2.6, z + 3.3], [x, H - 0.6, z - 2.3], [x, H - 0.6, z + 2.3]]);
    };
    const n = 1 + lv; for (let i = 0; i < n; i++) pylon(-ex / 2 + 3 + i * ((ex - 6) / Math.max(1, n - 1 || 1)), 9, 14);
    // жиците — увиснали между стълбовете, и от последния стълб към подстанцията
    const wm = new THREE.LineBasicMaterial({ color: 0x2a2a2a });
    const sag = (a, b) => { const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * 1.2, a[2] + (b[2] - a[2]) * t)); } g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wm)); };
    for (let i = 0; i < tops.length - 1; i++) for (let k = 0; k < 4; k++) sag(tops[i][k], tops[i + 1][k]);
    for (let k = 0; k < 4; k++) { const a = tops[0][k]; sag([a[0] - 12, a[1], a[2]], a); const b = tops[tops.length - 1][k]; sag(b, [b[0] + 12, b[1], b[2]]); }
    const hum = box(0.25, 0.25, 0.05, mat(0x302000, 0.4, 0, 0xffc107), 8, 3.2, -5.98, g);
    U.push((dt, t, night) => { hum.material.emissiveIntensity = night ? 1.5 : 0.6; });
  },
};
export const MINE_3D_KINDS = Object.keys(KINDS);

export function buildSite3D(group, deps, opts = {}) {
  const g = new THREE.Group(); g.position.set(opts.x || 0, 0.06, opts.z || 0); g.scale.setScalar(opts.scale || 1); group.add(g);
  const [ex, ez] = opts.ext || [26, 26], U = []; let alive = true;
  (KINDS[opts.kind] || KINDS.quarry)(g, ex, ez, opts.lv || 1, U, () => alive);
  fence(g, ex, ez);
  if (deps.label && opts.sign) { const s = deps.label(opts.sign, '#ffd54a', 10); if (s) { s.position.set(0, 18, 0); g.add(s); } }
  let last = null;
  return {
    group: g,
    update(t, night) { const dt = last == null ? 0 : Math.min(0.1, t - last); last = t; for (const f of U) f(dt, t, night); },
    dispose() { alive = false; group.remove(g); g.traverse(o => { o.geometry?.dispose?.(); }); },
  };
}
