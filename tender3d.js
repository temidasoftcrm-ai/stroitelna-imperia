// tender3d.js — 3D за държавните поръчки (tenders.js): уникални сгради, които растат по етапи според напредъка.
//   buildUniversity — Софийски университет: неокласическа сграда с колонада, фронтон и меден купол, площад с фонтан.
//   buildHospital — национална болница: модел „Low Poly Hospital“ (AlessioPassera, Sketchfab, CC-BY) с хеликоптерна площадка.
//   buildStadium — национален стадион („Ekana Stadium Low Poly“, mshayan02, CC-BY); buildMetro — вход на метрото
//     („Subway Entrance [Street Assets Vol. 01]“, whisper.alt, CC-BY) на площад с голямо „M“.
//   buildAirTerminal — нов международен терминал: стъклена сграда с вълнообразен покрив, ръкави, кула и самолети на перона.
//   buildPortTerminal — нов контейнерен терминал до пристанището (seaside.js): кей, портални кранове, контейнери.
// Двете връщат { group, setProg(p 0…1), update(t, night) }; докато p < 1 се виждат скеле, кран и строителна техника.
import * as THREE from 'three';
import { createPortLights } from './portlights.js';
import { loadShipModels, hasShipModel, shipModel } from './shipmodels.js';
import { STADIUMS, STADIUM_MAX_M } from './stadiums.js';   // известните стадиони на световното
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makePlane, airTowerModel } from './airport.js';

const mat = (c, r = 0.8, m = 0, e) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...(e ? { emissive: e, emissiveIntensity: 0 } : {}) });
const box = (w, h, d, m, x, y, z, g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
const cyl = (r1, r2, h, m, x, y, z, g, seg = 16) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };

// етап: група, която „расте“ отдолу нагоре в прозореца [a, b] от напредъка
function stage(g, a, b) { const s = new THREE.Group(); g.add(s); s.userData.win = [a, b]; return s; }
function applyStages(stages, p) {
  for (const s of stages) {
    const [a, b] = s.userData.win, k = Math.max(0, Math.min(1, (p - a) / (b - a)));
    s.visible = k > 0; s.scale.y = Math.max(0.001, k);
  }
}
// строителен кран (кула + стрела) и скеле около обем w×h×d
function siteKit(g, w, h, d) {
  const kit = new THREE.Group(); g.add(kit);
  const y = mat(0xf2b705, 0.6, 0.3), sc = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, wireframe: true });
  const crane = new THREE.Group(); crane.position.set(w / 2 + 4, 0, -d / 2 - 2); kit.add(crane);
  box(1.2, h + 12, 1.2, y, 0, (h + 12) / 2, 0, crane);
  const jib = new THREE.Group(); jib.position.y = h + 12; crane.add(jib);
  box(w + 10, 0.8, 0.8, y, -(w + 10) / 2 + 4, 0, 0, jib); box(2, 1.6, 1.6, mat(0x666666), 4, -0.4, 0, jib);
  const scaf = new THREE.Mesh(new THREE.BoxGeometry(w + 2, h, d + 2, 6, 4, 6), sc); scaf.position.y = h / 2; kit.add(scaf);
  return { kit, jib, scaf };
}

// ---------------------------------------------------------------- Софийски университет
// opts: { x, z, rot } — центърът на парцела (около 26×26)
export function buildUniversity(group, deps, opts = {}) {
  const g = new THREE.Group(); g.position.set(opts.x || 0, 0, opts.z || 0); g.rotation.y = opts.rot || 0; g.scale.setScalar(opts.scale || 1); group.add(g);
  const stone = mat(0xe9dfc6, 0.85), trim = mat(0xf6f1e4, 0.7), roofM = mat(0x8c6b52, 0.8), copper = mat(0x6fa58c, 0.45, 0.4), gold = mat(0xd8b44a, 0.3, 0.8);
  const win = mat(0x2b3440, 0.3, 0.2, 0xffd890), stages = [], windows = [win];
  // площад и стълби (винаги)
  box(26, 0.12, 26, mat(0xcfc8b8, 0.95), 0, 0.06, 0, g);
  // 0–0.15 основа
  const s0 = stage(g, 0, 0.15); stages.push(s0); box(24, 1.2, 15, trim, 0, 0.6, -2, s0);
  for (let k = 0; k < 4; k++) box(10 - k * 0.6, 0.3, 1.2, trim, 0, 0.15 + k * 0.3, 6.2 + (3 - k) * 0.6 - 0.6, s0);
  // 0.15–0.55 стени: главен корпус и крила
  const s1 = stage(g, 0.15, 0.55); stages.push(s1); s1.position.y = 1.2;
  box(16, 9, 11, stone, 0, 4.5, -2, s1);
  for (const sd of [-1, 1]) { box(5, 8, 15, stone, sd * 9.5, 4, -2, s1); box(5.4, 0.6, 15.4, trim, sd * 9.5, 8.2, -2, s1); }
  box(16.4, 0.7, 11.4, trim, 0, 9.2, -2, s1);
  for (let r = 0; r < 2; r++) for (let c = -3; c <= 3; c++) if (Math.abs(c) > 1 || r === 1) box(1, 1.8, 0.1, win, c * 2, 2.8 + r * 3.4, 3.55, s1);
  for (const sd of [-1, 1]) for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) box(1, 1.8, 0.1, win, sd * 9.5 + (c - 0.5) * 2.2, 2.6 + r * 3.2, 5.55, s1);
  // 0.5–0.7 колонада
  const s2 = stage(g, 0.5, 0.7); stages.push(s2); s2.position.y = 1.2;
  for (let k = 0; k < 6; k++) { cyl(0.42, 0.48, 7, trim, -5 + k * 2, 3.5, 5.6, s2, 12); box(1.1, 0.4, 1.1, trim, -5 + k * 2, 0.2, 5.6, s2); }
  // 0.65–0.8 антаблемент и фронтон
  const s3 = stage(g, 0.65, 0.8); stages.push(s3); s3.position.y = 8.2;
  box(12.6, 1.1, 2.2, trim, 0, 0.55, 5.6, s3);
  const tri = new THREE.Shape(); tri.moveTo(-6.4, 0); tri.lineTo(6.4, 0); tri.lineTo(0, 2.8); tri.closePath();
  const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 2, bevelEnabled: false }), trim); ped.position.set(0, 1.1, 4.6); ped.castShadow = true; s3.add(ped);
  const roofTri = new THREE.Shape(); roofTri.moveTo(-8.2, 0); roofTri.lineTo(8.2, 0); roofTri.lineTo(0, 2.6); roofTri.closePath();
  const rf = new THREE.Mesh(new THREE.ExtrudeGeometry(roofTri, { depth: 11, bevelEnabled: false }), roofM); rf.position.set(0, 1.1, -7.5); rf.castShadow = true; s3.add(rf);
  // 0.75–0.88 барабан, 0.85–1 купол с фенер и флаг
  const s4 = stage(g, 0.75, 0.88); stages.push(s4); s4.position.y = 12.2;
  cyl(3.4, 3.4, 2.6, stone, 0, 1.3, -2, s4, 24); cyl(3.6, 3.6, 0.4, trim, 0, 2.6, -2, s4, 24);
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; box(0.5, 1.4, 0.1, win, Math.sin(a) * 3.42, 1.3, -2 + Math.cos(a) * 3.42, s4).rotation.y = a; }
  const s5 = stage(g, 0.85, 1); stages.push(s5); s5.position.y = 15;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), copper); dome.position.set(0, 0, -2); dome.castShadow = true; s5.add(dome);
  cyl(0.6, 0.7, 1.4, trim, 0, 4.1, -2, s5, 10); const ball = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), gold); ball.position.set(0, 5.1, -2); s5.add(ball);
  cyl(0.06, 0.06, 3, mat(0xdddddd), 0, 6.5, -2, s5, 6);
  const flag = new THREE.Group(); flag.position.set(0, 7.6, -2); s5.add(flag);
  [0xffffff, 0x00966e, 0xd62612].forEach((c, i) => box(2, 0.4, 0.05, new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide }), 1, -i * 0.4, 0, flag));
  // площад отпред: фонтан, статуи, дървета (появяват се накрая)
  const s6 = stage(g, 0.92, 1); stages.push(s6);
  cyl(2.4, 2.4, 0.6, trim, 0, 0.3, 10, s6, 20); const water = cyl(2.1, 2.1, 0.1, mat(0x4aa3d8, 0.1, 0.2), 0, 0.62, 10, s6, 20);
  cyl(0.3, 0.4, 1.6, trim, 0, 1.2, 10, s6, 8);
  for (const sd of [-1, 1]) { box(1.2, 1.4, 1.2, trim, sd * 6.5, 0.7, 8.5, s6); cyl(0.35, 0.35, 1.8, mat(0x5b6e5a, 0.4, 0.6), sd * 6.5, 2.3, 8.5, s6, 8); }
  for (const [x, z] of [[-11, 10], [11, 10], [-11, -10], [11, -10], [-11, 0], [11, 0]]) { cyl(0.25, 0.3, 2, mat(0x6b4a2b), x, 1, z, s6, 6); const c = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), mat(0x3f8f3a)); c.position.set(x, 3, z); c.castShadow = true; s6.add(c); }
  const sign = deps.label ? deps.label(opts.sign || '🎓 СОФИЙСКИ УНИВЕРСИТЕТ', '#ffe9a8', 16) : null;
  if (sign) { sign.position.set(0, 26, 0); g.add(sign); }
  const kit = siteKit(g, 24, 16, 16);

  let prog = -1;
  function setProg(p) {
    p = Math.max(0, Math.min(1, p)); if (p === prog) return; prog = p;
    applyStages(stages, p);
    kit.kit.visible = p < 1; kit.scaf.scale.y = Math.max(0.05, Math.min(1, p * 1.15)); kit.scaf.position.y = 8 * kit.scaf.scale.y;
    if (sign) sign.visible = p >= 1;
  }
  function update(t, night = 0) {
    for (const w of windows) w.emissiveIntensity = 0.05 + 1.4 * night;
    if (prog < 1) kit.jib.rotation.y = Math.sin(t * 0.25) * 1.2;
    flag.rotation.y = Math.sin(t * 1.3) * 0.25; water.position.y = 0.62 + Math.sin(t * 2) * 0.02;
  }
  setProg(opts.prog ?? 0);
  return { group: g, setProg, update, dispose: () => group.remove(g) };
}

// строителна площадка: кал и ограда (видими, докато p < 1)
function fencedDirt(g, ext = [26, 26]) {
  const [W, D] = ext, hw = W / 2, hd = D / 2;
  const dirt = box(W, 0.1, D, mat(0x7a5c3e, 1), 0, 0.05, 0, g), fence = new THREE.Group(); g.add(fence);
  // жълта рамка около целия парцел — вижда се отдалеч, че тук е държавната поръчка
  const yel = mat(0xffc400, 0.6, 0, 0xffb000), blk = mat(0x1d1d1d, 0.8);
  for (const [w, d, x, z] of [[W, 1, 0, -hd + 0.5], [W, 1, 0, hd - 0.5], [1, D - 2, -hw + 0.5, 0], [1, D - 2, hw - 0.5, 0]]) box(w, 0.06, d, yel, x, 0.12, z, fence);
  // ограда на жълти и черни ивици
  for (const [w, d, x, z] of [[W, 0.15, 0, -hd + 0.1], [W, 0.15, 0, hd - 0.1], [0.15, D, -hw + 0.1, 0], [0.15, D, hw - 0.1, 0]]) {
    const len = Math.max(w, d), n = Math.max(5, Math.round(len / 2));
    for (let i = 0; i < n; i++) { const o = -len / 2 + (i + 0.5) * len / n; box(w > 1 ? len / n : 0.15, 1.4, d > 1 ? len / n : 0.15, i % 2 ? blk : yel, x + (w > 1 ? o : 0), 0.8, z + (d > 1 ? o : 0), fence); }
  }
  for (const [x, z] of [[-hw + 0.1, -hd + 0.1], [hw - 0.1, -hd + 0.1], [-hw + 0.1, hd - 0.1], [hw - 0.1, hd - 0.1]]) { box(0.3, 3, 0.3, blk, x, 1.5, z, fence); box(1.4, 0.8, 0.05, yel, x + 0.7, 2.6, z, fence); }
  return { show: v => { dirt.visible = fence.visible = v; }, glow: k => { yel.emissiveIntensity = k; } };
}
// GLB модел, вписан в квадрат side×side, основата на y = 0 (или произходът на модела, ако keepY)
function placeGlb(url, parent, side, { keepY = false, skip = null, alive = () => true, each = null } = {}) {
  loadGlb(url).then(src => {
    if (!src || !alive()) return;
    const o = src.clone(true), drop = [];
    o.traverse(m => { if (!m.isMesh) return; if (skip && skip.test(m.material.name)) { drop.push(m); return; } m.castShadow = m.receiveShadow = true; each && each(m); });
    drop.forEach(m => m.parent.remove(m));
    let bb = new THREE.Box3().setFromObject(o);
    if (keepY) {   // мери само надземната част (подземните ескалатори/тунели не влизат в размера)
      const v = new THREE.Vector3(), up = new THREE.Box3(); o.updateMatrixWorld(true);
      o.traverse(m => { if (!m.isMesh) return; const P = m.geometry.attributes.position; for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); if (v.y > 0.05) up.expandByPoint(v); } });
      if (!up.isEmpty()) bb = up;
    }
    const sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    const w = new THREE.Group(); w.add(o); o.position.set(-c.x, keepY ? 0 : -bb.min.y, -c.z); w.scale.setScalar(side / Math.max(sz.x, sz.z)); parent.add(w);
  });
}

// ---------------------------------------------------------------- национален стадион
export function buildStadium(group, deps, opts = {}) {
  const g = new THREE.Group(); g.position.set(opts.x || 0, 0, opts.z || 0); g.rotation.y = opts.rot || 0; g.scale.setScalar(opts.scale || 1); group.add(g);
  const ext = opts.ext || [26, 26], site = fencedDirt(g, ext);
  const done = new THREE.Group(); g.add(done);
  box(ext[0], 0.1, ext[1], mat(0x6fae4f, 0.95), 0, 0.05, 0, done);
  // голям стадион: паркинги с маркировка и коли в излишъка на парцела (по z), фен зона с флагове
  for (const sd of [-1, 1]) {
    const depth = (ext[1] - 26) / 2 - 1; if (depth < 3) continue;
    const zc = sd * (13 + depth / 2 + 0.5), w = ext[0] - 3;
    box(w, 0.12, depth, mat(0x3d4247, 0.9), 0, 0.08, zc, done);
    const line = mat(0xf2f2f2, 0.6), rows = Math.max(1, Math.floor(depth / 4.2));
    for (let r = 0; r < rows; r++) for (let c = 0; c < Math.floor(w / 1.8); c++) {
      const xx = -w / 2 + 0.9 + c * 1.8, zz = zc - depth / 2 + 2.1 + r * 4.2;
      box(0.12, 0.02, 2.6, line, xx - 0.9, 0.15, zz, done);
      if (deps.model && ((c * 7 + r * 3) % 5) < 3) { try { const o = deps.model(['sf-car-Sedan', 'sf-car-SUV', 'sf-car-Hatchback', 'sf-car-Taxi', 'sf-car-Van', 'sf-car-Pickup'][(c + r) % 6], 1 / (opts.scale || 1)); if (o) { o.position.set(xx, 0.14, zz); o.rotation.y = r % 2 ? Math.PI : 0; done.add(o); } } catch (e) { /* няма модел */ } }
    }
    for (let f = 0; f < 6; f++) { const fx = -w / 2 + 2 + f * (w - 4) / 5, fz = sd * 13.6; box(0.15, 4, 0.15, mat(0xdddddd, 0.4, 0.6), fx, 2, fz, done); box(1.6, 1, 0.05, mat([0xd62828, 0xffffff, 0x1f4fbf][f % 3], 0.6), fx + 0.8, 3.4, fz, done); }
  }
  // модели: обикновеният национален стадион и известните (opts.variant)
  const SV = Object.fromEntries(Object.entries(STADIUMS).map(([k, st]) => [k, { url: st.url, side: (Math.min(ext[0], ext[1]) - 0.6) * st.m[0] / STADIUM_MAX_M }]));   // известните: в истинските пропорции един спрямо друг
  const V = { ...SV, ekana: { url: 'assets/heavy/stadium/stadium.glb', side: 25.5 }, campnou: { url: 'assets/heavy/stadium/campnou.glb', side: 25 }, olympia: { url: 'assets/heavy/stadium/olympia.glb', side: Math.min(ext[0], ext[1]) - 0.6 } }[opts.variant || 'ekana'];
  const lamps = [], lampM = mat(0xffffff, 0.4, 0, 0xfff4d0);
  if (!opts.variant) for (const [x, z] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) { const q = box(1.4, 0.5, 0.4, lampM, x, 8.2, z, done); q.lookAt(0, 0, 0); lamps.push(q); }
  const body = new THREE.Group(); g.add(body);
  let alive = true;
  placeGlb(V.url, body, V.side, { alive: () => alive });
  const sign = deps.label ? deps.label(opts.sign || '🏟️ НАЦИОНАЛЕН СТАДИОН', '#ffe9a8', 16) : null;
  if (sign) { sign.position.set(0, 13, 0); g.add(sign); }
  const kit = siteKit(g, 22, 6, 22);
  let prog = -1;
  function setProg(p) {
    p = Math.max(0, Math.min(1, p)); if (p === prog) return; prog = p;
    const k = Math.max(0, Math.min(1, (p - 0.1) / 0.85)); body.visible = k > 0; body.scale.y = Math.max(0.001, k);
    kit.kit.visible = p < 1; kit.scaf.scale.y = Math.max(0.05, Math.min(1, p * 1.15)); kit.scaf.position.y = 3 * kit.scaf.scale.y;
    if (sign) sign.visible = p >= 1; done.visible = p >= 1; site.show(p < 1);
  }
  function update(t, night = 0) { site.glow(0.05 + 0.5 * night); lampM.emissiveIntensity = 0.1 + 1.6 * night; if (prog < 1) kit.jib.rotation.y = Math.sin(t * 0.25) * 1.2; }
  setProg(opts.prog ?? 0);
  return { group: g, setProg, update, dispose: () => { alive = false; group.remove(g); } };
}

// ---------------------------------------------------------------- метро: площад с вход и голямо „M“
export function buildMetro(group, deps, opts = {}) {
  const g = new THREE.Group(); g.position.set(opts.x || 0, 0, opts.z || 0); g.rotation.y = opts.rot || 0; g.scale.setScalar(opts.scale || 1); group.add(g);
  const site = fencedDirt(g);
  // докато се строи: шахта и тунелна машина (TBM), купчини пръст
  const work = new THREE.Group(); g.add(work);
  box(12, 0.14, 8, mat(0x1b1b1b, 1), -2, 0.11, -3, work);
  const tbm = new THREE.Group(); tbm.position.set(-2, 1.6, -3); tbm.rotation.z = Math.PI / 2; work.add(tbm);
  cyl(1.7, 1.7, 7, mat(0xf2b705, 0.5, 0.4), 0, 0, 0, tbm, 20); const head = cyl(1.9, 1.9, 0.6, mat(0x555a60, 0.4, 0.8), 0, 3.8, 0, tbm, 20);
  for (const [x, z, r] of [[7, 6, 2.2], [9, 2, 1.6], [4, 9, 1.8]]) { const h = new THREE.Mesh(new THREE.ConeGeometry(r, r * 0.9, 9), mat(0x6b4f33, 1)); h.position.set(x, r * 0.45, z); h.castShadow = true; work.add(h); }
  // накрая: павиран площад, пейки, дървета, пилон „M“
  const done = new THREE.Group(); g.add(done);
  box(26, 0.1, 26, mat(0xbfb6a6, 0.95), 0, 0.05, 0, done);
  const tile = mat(0xa79e8f, 0.95);
  for (let i = -2; i <= 2; i++) { box(26, 0.02, 0.15, tile, 0, 0.11, i * 5, done); box(0.15, 0.02, 26, tile, i * 5, 0.11, 0, done); }
  const red = mat(0xd62828, 0.5, 0, 0xff3030), white = mat(0xffffff, 0.5, 0, 0xffffff), pole = mat(0x3a3f45, 0.5, 0.6);
  const pylon = (x, z, h) => { box(0.35, h, 0.35, pole, x, h / 2, z, done); const m = new THREE.Group(); m.position.set(x, h + 1, z); done.add(m);
    box(2.2, 2.2, 0.3, red, 0, 0, 0, m); const L = box(0.3, 1.4, 0.34, white, -0.55, 0, 0, m), R = box(0.3, 1.4, 0.34, white, 0.55, 0, 0, m);
    const a = box(0.28, 0.9, 0.34, white, -0.24, 0.25, 0, m), b = box(0.28, 0.9, 0.34, white, 0.24, 0.25, 0, m); a.rotation.z = 0.6; b.rotation.z = -0.6; return m; };
  const signs = [pylon(8.5, 8.5, 5), pylon(-9, -9, 3.5)];
  for (const [x, z, r] of [[-10, 5, 0], [-10, 9, 0], [5, -10, Math.PI / 2]]) { const bn = new THREE.Group(); bn.position.set(x, 0, z); bn.rotation.y = r; done.add(bn); box(2.4, 0.15, 0.7, mat(0x8a6a48, 0.8), 0, 0.55, 0, bn); box(0.15, 0.5, 0.6, pole, -1, 0.25, 0, bn); box(0.15, 0.5, 0.6, pole, 1, 0.25, 0, bn); }
  for (const [x, z] of [[-11, -2], [11, -2], [2, 11], [-4, 11], [11, -11]]) { cyl(0.22, 0.28, 1.6, mat(0x6b4a2b), x, 0.8, z, done, 6); const c = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8), mat(0x3f8f3a)); c.position.set(x, 2.6, z); c.castShadow = true; done.add(c); }
  const body = new THREE.Group(); body.position.set(0, 0.1, -1); done.add(body);
  let alive = true;
  placeGlb('assets/heavy/metro/entrance.glb', body, 10, { keepY: true, skip: /^Ground/, alive: () => alive });
  const sign = deps.label ? deps.label(opts.sign || '🚇 МЕТРО', '#ffe9a8', 16) : null;
  if (sign) { sign.position.set(0, 12, 0); g.add(sign); }
  let prog = -1;
  function setProg(p) {
    p = Math.max(0, Math.min(1, p)); if (p === prog) return; prog = p;
    if (sign) sign.visible = p >= 1; done.visible = p >= 1; site.show(p < 1); work.visible = p < 1;
    tbm.position.x = -2 + Math.min(1, p) * 3;   // машината „влиза“ в тунела
  }
  function update(t, night = 0) { site.glow(0.05 + 0.5 * night); red.emissiveIntensity = 0.15 + 0.9 * night; white.emissiveIntensity = 0.1 + 0.9 * night; if (prog < 1) head.rotation.y = t * 1.5; }
  setProg(opts.prog ?? 0);
  return { group: g, setProg, update, dispose: () => { alive = false; group.remove(g); } };
}

// ---------------------------------------------------------------- международен терминал на летище
// opts.ext = [W, D] (локални мерки): по z отзад е сградата (страна към града), отпред — перонът със самолетите
export function buildAirTerminal(group, deps, opts = {}) {
  const g = new THREE.Group(); g.position.set(opts.x || 0, 0, opts.z || 0); g.rotation.y = opts.rot || 0; g.scale.setScalar(opts.scale || 1); group.add(g);
  const ext = opts.ext || [26, 34], [W, D] = ext, k0 = 1 / (opts.scale || 1), site = fencedDirt(g, ext);
  const done = new THREE.Group(); g.add(done);
  // перон (бетон) и паркинг/алея откъм града
  const zT = -D / 2 + 7;   // фасадата на терминала откъм перона
  box(W, 0.1, D - 12, mat(0x8f9297, 0.9), 0, 0.06, zT + (D - 12) / 2 - 1, done);
  box(W, 0.1, 6, mat(0x3d4247, 0.9), 0, 0.06, -D / 2 + 3, done);
  const yl = mat(0xf2c200, 0.6);
  const body = new THREE.Group(); g.add(body);
  // терминалът: стъклена кутия + вълнообразен бял покрив
  const glassM = mat(0x5f8fb8, 0.15, 0.4, 0xffe7b0), win = [glassM], TW2 = W - 4, TD = 7, TH = 4.2;
  box(TW2, TH, TD, glassM, 0, TH / 2, zT - TD / 2, body);
  for (let i = 0; i <= 12; i++) box(0.18, TH, TD + 0.1, mat(0xe8ecef, 0.5, 0.3), -TW2 / 2 + i * TW2 / 12, TH / 2, zT - TD / 2, body);   // колони по фасадата
  { const rg = new THREE.PlaneGeometry(TW2 + 3, TD + 4, 40, 4).rotateX(-Math.PI / 2), P = rg.attributes.position;
    for (let i = 0; i < P.count; i++) P.setY(i, Math.sin(P.getX(i) / (TW2 + 3) * Math.PI * 3) * 0.6 + 0.4 * (1 - Math.abs(P.getZ(i)) / ((TD + 4) / 2)));
    rg.computeVertexNormals(); const roof = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide })); roof.position.set(0, TH + 0.3, zT - TD / 2); roof.castShadow = true; body.add(roof); }
  // ръкави към самолетите
  const nG = Math.max(3, Math.min(6, Math.floor(TW2 / 7))), gx = i => -TW2 / 2 + (i + 0.5) * TW2 / nG;
  for (let i = 0; i < nG; i++) { const jb = box(1.2, 1.2, 5, mat(0xd8dde2, 0.5, 0.3), gx(i) + 1.6, 2.4, zT + 2.5, body); const leg = box(0.3, 2.2, 0.3, mat(0x666a70), gx(i) + 1.6, 1.1, zT + 4.6, body); }
  // контролна кула в ъгъла
  const tower = new THREE.Group(); tower.position.set(W / 2 - 3, 0, -D / 2 + 5); body.add(tower);
  const tm = airTowerModel();
  if (tm) { const w = new THREE.Group(); w.add(tm); const bb = new THREE.Box3().setFromObject(w), s3 = bb.getSize(new THREE.Vector3()); w.scale.setScalar(13 / s3.y); w.updateMatrixWorld(true); const b2 = new THREE.Box3().setFromObject(w), c = b2.getCenter(new THREE.Vector3()); w.position.set(-c.x, -b2.min.y, -c.z); tower.add(w); }
  else { cyl(0.9, 1.2, 11, mat(0xe8ecef, 0.6), 0, 5.5, 0, tower, 12); cyl(2, 1.6, 2, glassM, 0, 12, 0, tower, 12); cyl(2.2, 2.2, 0.4, mat(0x444a50), 0, 13.2, 0, tower, 12); }
  // перон: жълти линии към ръкавите и самолетите (истинските модели от летищата, ако са заредени)
  const planes = new THREE.Group(); done.add(planes);
  for (let i = 0; i < nG; i++) {
    box(0.2, 0.02, D - 22, yl, gx(i) + 1.6, 0.13, zT + (D - 22) / 2 + 5, done);
    if (i % 2 === 0 || nG <= 4) { const kind = ['a320', 'wide', 'a320', 'regional', 'wide', 'a320'][i % 6], p = makePlane(kind, i); p.scale.multiplyScalar(k0 * 0.42); p.rotation.y = Math.PI; p.position.set(gx(i) + 1.6, (p.userData.gearY || 2) * k0 * 0.42, zT + 5.5 + (p.userData.len || 26) * k0 * 0.42 / 2); planes.add(p); }
  }
  const sign = deps.label ? deps.label(opts.sign || '✈️ НОВ ТЕРМИНАЛ', '#ffe9a8', 16) : null;
  if (sign) { sign.position.set(0, 14, zT - TD / 2); g.add(sign); }
  const kit = siteKit(g, TW2, TH + 2, TD + 4); kit.kit.position.z = zT - TD / 2;
  let prog = -1;
  function setProg(p) {
    p = Math.max(0, Math.min(1, p)); if (p === prog) return; prog = p;
    const k = Math.max(0, Math.min(1, (p - 0.1) / 0.85)); body.visible = k > 0; body.scale.y = Math.max(0.001, k);
    kit.kit.visible = p < 1; kit.scaf.scale.y = Math.max(0.05, Math.min(1, p * 1.15)); kit.scaf.position.y = (TH + 2) / 2 * kit.scaf.scale.y;
    if (sign) sign.visible = p >= 1; done.visible = p >= 1; site.show(p < 1);
  }
  function update(t, night = 0) { site.glow(0.05 + 0.5 * night); for (const m of win) m.emissiveIntensity = prog >= 1 ? 0.05 + 0.9 * night : 0; if (prog < 1) kit.jib.rotation.y = Math.sin(t * 0.25) * 1.2; }
  setProg(opts.prog ?? 0);
  return { group: g, setProg, update, dispose: () => group.remove(g) };
}

// ---------------------------------------------------------------- Суецкият канал: нов паралелен ръкав
// opts.ext = [W, D]: каналът върви по z през целия парцел; по време на строежа — изкоп, водата идва накрая; после минават кораби
export function buildCanal(group, deps, opts = {}) {
  const g = new THREE.Group(); g.position.set(opts.x || 0, 0, opts.z || 0); g.rotation.y = opts.rot || 0; g.scale.setScalar(opts.scale || 1); group.add(g);
  const ext = opts.ext || [26, 34], [W, D] = ext, CW = W * 0.42, site = fencedDirt(g, ext);
  const sand = mat(0xe2c98f, 1), stone = mat(0xbfae8a, 0.9), dark = mat(0x7a5c3e, 1);
  // пясъчни брегове и каменни откоси (винаги — изкопът ги разкрива)
  const banks = new THREE.Group(); g.add(banks);
  for (const sd of [-1, 1]) {
    box((W - CW) / 2 - 0.5, 0.35, D, sand, sd * (CW / 2 + (W - CW) / 4 + 0.25), 0.17, 0, banks);
    const slope = box(1.4, 0.9, D, stone, sd * (CW / 2 + 0.3), 0.15, 0, banks); slope.rotation.z = sd * 0.5;
  }
  const bed = box(CW, 0.3, D, dark, 0, 0.12, 0, g);
  // водата — пълни се отпред назад в края на строежа
  const waterM = new THREE.MeshStandardMaterial({ color: 0x2f86c8, roughness: 0.15, metalness: 0.15 });
  const water = new THREE.Mesh(new THREE.BoxGeometry(CW + 0.6, 0.3, D), waterM); water.position.y = 0.2; g.add(water);
  // мостът „Мубарак“ (вантов): два пилона и висока пътна плоча над канала
  const done = new THREE.Group(); g.add(done);
  const bz = -D * 0.18, pyl = mat(0xe8e2d4, 0.6), cab = new THREE.LineBasicMaterial({ color: 0xdddddd });
  box(W, 0.5, 2.2, mat(0x9a9ea3, 0.8), 0, 5.2, bz, done);
  for (const sd of [-1, 1]) { box(0.8, 11, 0.8, pyl, sd * (CW / 2 + 1.2), 5.5, bz, done); for (let k = 1; k <= 4; k++) for (const dd of [-1, 1]) {
    const P = [new THREE.Vector3(sd * (CW / 2 + 1.2), 10.5, bz), new THREE.Vector3(sd * (CW / 2 + 1.2) - sd * k * 1.6 * (dd > 0 ? 1 : -1) * (dd > 0 ? 1 : -1) * dd, 5.4, bz)];
    done.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(P), cab)); } }
  // фар и сграда на канала (Порт Саид) в далечния край
  const lh = new THREE.Group(); lh.position.set(CW / 2 + 3, 0, D / 2 - 3); done.add(lh);
  cyl(0.9, 1.2, 9, mat(0xf4f1e8, 0.6), 0, 4.5, 0, lh, 10); for (let k = 0; k < 3; k++) cyl(1.21, 1.21, 0.8, mat(0x1d1d1d, 0.7), 0, 2 + k * 2.5, 0, lh, 10);
  const lamp = mat(0xfff2c0, 0.4, 0, 0xffe080); cyl(0.7, 0.7, 1, lamp, 0, 9.5, 0, lh, 8);
  const hq = new THREE.Group(); hq.position.set(-CW / 2 - 4, 0, D / 2 - 5); done.add(hq);
  box(5, 3.5, 4, mat(0xf2eadb, 0.7), 0, 1.75, 0, hq); for (const dx of [-1.6, 0, 1.6]) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x3f8f6a, 0.5, 0.3)); d.position.set(dx, 3.5, 0); hq.add(d); }
  for (const [x, z] of [[-W / 2 + 1.5, -D / 2 + 3], [W / 2 - 1.5, -D / 2 + 6], [-W / 2 + 1.5, 4], [W / 2 - 1.5, -2]]) { cyl(0.15, 0.2, 3, mat(0x7a5a3a), x, 1.5, z, done, 6); const fr = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.8, 7), mat(0x3f7f3a)); fr.position.set(x, 3.1, z); done.add(fr); }
  // корабите, които минават (контейнеровоз от моделите на пристанищата, иначе кутия)
  const ships = [];
  const mkShip = (k, dir) => { const s0 = new THREE.Group(); box(CW * 0.42, 1.4, D * 0.22, mat(0xb03a2e, 0.6), 0, 0.7, 0, s0); for (let i = 0; i < 6; i++) box(CW * 0.36, 0.9, D * 0.025, mat([0xd62828, 0x1f5fbf, 0x2d8f4e, 0xffb300][i % 4], 0.6), 0, 1.85, -D * 0.08 + i * D * 0.03, s0); box(CW * 0.34, 1.6, D * 0.03, mat(0xf2f2f2, 0.6), 0, 2.2, -D * 0.1, s0);
    s0.position.set(dir * CW * 0.18, 0.15, 0); s0.rotation.y = dir > 0 ? 0 : Math.PI; done.add(s0); ships.push({ o: s0, dir, ph: k }); return s0; };
  mkShip(0, 1); mkShip(0.5, -1);
  loadShipModels().then(() => { if (!hasShipModel('container')) return;
    for (const sh of ships) { const o = shipModel('container'); o.updateMatrixWorld(true); let bb = new THREE.Box3().setFromObject(o), sz = bb.getSize(new THREE.Vector3());
      const w = new THREE.Group(); w.add(o); if (sz.x > sz.z) { o.rotation.y = Math.PI / 2; } w.updateMatrixWorld(true); bb = new THREE.Box3().setFromObject(w); sz = bb.getSize(new THREE.Vector3());
      w.scale.setScalar(D * 0.26 / sz.z); w.updateMatrixWorld(true); bb = new THREE.Box3().setFromObject(w); const c = bb.getCenter(new THREE.Vector3()); o.position.x -= c.x / w.scale.x; o.position.z -= c.z / w.scale.x;
      const holder = new THREE.Group(); holder.add(w); w.position.y = -bb.min.y - (bb.max.y - bb.min.y) * 0.12; holder.position.copy(sh.o.position); holder.rotation.y = sh.o.rotation.y; done.remove(sh.o); done.add(holder); sh.o = holder; } });
  const sign = deps.label ? deps.label(opts.sign || '⚓ СУЕЦКИ КАНАЛ', '#ffe9a8', 16) : null;
  if (sign) { sign.position.set(0, 14, bz); g.add(sign); }
  const kit = siteKit(g, CW, 3, D * 0.5);
  let prog = -1;
  function setProg(p) {
    p = Math.max(0, Math.min(1, p)); if (p === prog) return; prog = p;
    const dig = Math.min(1, p / 0.7); bed.scale.z = Math.max(0.02, dig); bed.position.z = -D / 2 * (1 - dig);
    const fill = Math.max(0, (p - 0.7) / 0.3); water.visible = fill > 0 || p >= 1; water.scale.z = Math.max(0.02, p >= 1 ? 1 : fill); water.position.z = -D / 2 * (1 - water.scale.z);
    kit.kit.visible = p < 1; kit.scaf.visible = false; banks.visible = true;
    if (sign) sign.visible = p >= 1; done.visible = p >= 1; site.show(p < 1);
  }
  function update(t, night = 0) {
    site.glow(0.05 + 0.5 * night); lamp.emissiveIntensity = 0.2 + 2 * night;
    if (prog < 1) { kit.jib.rotation.y = Math.sin(t * 0.25) * 1.2; return; }
    for (const sh of ships) { const u = ((t * 0.02 + sh.ph) % 1); sh.o.position.z = sh.dir * (-D / 2 - D * 0.15 + u * (D * 1.3)); sh.o.visible = Math.abs(sh.o.position.z) < D / 2 + D * 0.1; }
  }
  setProg(opts.prog ?? 0);
  return { group: g, setProg, update, dispose: () => group.remove(g) };
}

// ---------------------------------------------------------------- национална болница
const glbs = {};
const loadGlb = url => glbs[url] || (glbs[url] = new Promise(res => new GLTFLoader().load(url, g => res(g.scene), undefined, () => res(null))));
const loadHospital = () => loadGlb('assets/heavy/hospital/hospital.glb');
// opts: { x, z, rot, scale, prog, sign } — същият парцел като университета (около 26×26 преди мащаба)
export function buildHospital(group, deps, opts = {}) {
  const g = new THREE.Group(); g.position.set(opts.x || 0, 0, opts.z || 0); g.rotation.y = opts.rot || 0; g.scale.setScalar(opts.scale || 1); group.add(g);
  // терен: докато се строи — кал и ограда; накрая — морава, паркинг с линейки, площадка за спешните
  const site = fencedDirt(g);
  const done = new THREE.Group(); g.add(done);
  box(26, 0.1, 26, mat(0x6fae4f, 0.95), 0, 0.05, 0, done);   // морава
  box(17, 0.12, 9, mat(0x3d4247, 0.9), 3.5, 0.08, 8, done);   // паркинг отпред
  const line = mat(0xf2f2f2, 0.6);
  for (let i = 0; i < 7; i++) { box(0.18, 0.02, 3.2, line, -3.4 + i * 2.3, 0.15, 5.6, done); box(0.18, 0.02, 3.2, line, -3.4 + i * 2.3, 0.15, 10.4, done); }
  box(6.5, 0.12, 9, mat(0xc9ccd0, 0.9), -8.6, 0.08, 8, done);   // площадка за линейките
  const red = mat(0xd62828, 0.6), white = mat(0xffffff, 0.5, 0, 0xffffff);
  box(5.6, 0.02, 0.3, red, -8.6, 0.15, 4.2, done); box(5.6, 0.02, 0.3, red, -8.6, 0.15, 11.8, done);
  // пилон с червен кръст
  box(0.4, 5, 0.4, mat(0x9aa0a6, 0.5, 0.5), 11, 2.5, 11, done);
  const cross = new THREE.Group(); cross.position.set(11, 5.6, 11); done.add(cross);
  box(2.4, 2.4, 0.3, white, 0, 0, 0, cross); box(1.7, 0.55, 0.36, red, 0, 0, 0, cross); box(0.55, 1.7, 0.36, red, 0, 0, 0, cross);
  for (const [x, z] of [[-11.5, -11.5], [11.5, -11.5], [-11.5, -2], [11.5, -2], [11.5, 4]]) {
    cyl(0.22, 0.28, 1.6, mat(0x6b4a2b), x, 0.8, z, done, 6); const c = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8), mat(0x3f8f3a)); c.position.set(x, 2.6, z); c.castShadow = true; done.add(c);
  }
  const k0 = 1 / (opts.scale || 1);   // колите са в мащаба на града
  if (deps.model) {
    const put = (n, x, z, ry) => { try { const o = deps.model(n, k0); o.position.set(x, 0.14, z); o.rotation.y = ry; done.add(o); } catch (e) { /* няма модел */ } };
    put('sf-car-Ambulance', -10, 8, 0); put('sf-car-Ambulance', -7.2, 8, 0);
    for (const [i, row, n] of [[0, 5.6, 'sf-car-Sedan'], [2, 5.6, 'sf-car-SUV'], [3, 10.4, 'sf-car-Hatchback'], [5, 10.4, 'sf-car-Taxi'], [4, 5.6, 'sf-car-Van']]) put(n, -2.25 + i * 2.3, row, 0);
  }
  const body = new THREE.Group(); body.position.z = -4; g.add(body);   // моделът „расте“ отдолу нагоре
  const glass = [];
  let alive = true;
  loadHospital().then(src => {
    if (!src || !alive) return;
    const o = src.clone(true);
    o.traverse(m => { if (!m.isMesh) return; m.castShadow = m.receiveShadow = true;
      if (/^Vetro/.test(m.material.name)) { m.material = m.material.clone(); m.material.emissive = new THREE.Color(0xffe2a8); m.material.emissiveIntensity = 0; glass.push(m.material); } });
    const bb = new THREE.Box3().setFromObject(o), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    const k = 17 / Math.max(sz.x, sz.z), w = new THREE.Group(); w.add(o); o.position.set(-c.x, -bb.min.y, -c.z); w.scale.setScalar(k); body.add(w);
  });
  const sign = deps.label ? deps.label(opts.sign || '🏥 БОЛНИЦА', '#ffe9a8', 16) : null;
  if (sign) { sign.position.set(0, 17, -4); g.add(sign); }
  const kit = siteKit(g, 18, 10, 18); kit.kit.position.z = -4;
  g.userData.mergeWhen = () => prog >= 1 && body.children.length > 0;   // ⚡ perf-cliff (citycull.js): готовата болница е статична — сливане по материал (линейките на паркинга — също)
  let prog = -1;
  function setProg(p) {
    p = Math.max(0, Math.min(1, p)); if (p === prog) return; prog = p;
    const k = Math.max(0, Math.min(1, (p - 0.1) / 0.85)); body.visible = k > 0; body.scale.y = Math.max(0.001, k);
    kit.kit.visible = p < 1; kit.scaf.scale.y = Math.max(0.05, Math.min(1, p * 1.15)); kit.scaf.position.y = 5 * kit.scaf.scale.y;
    if (sign) sign.visible = p >= 1;
    done.visible = p >= 1; site.show(p < 1);
  }
  function update(t, night = 0) {
    site.glow(0.05 + 0.5 * night);
    cross.children[0].material.emissiveIntensity = 0.1 + 0.8 * night;
    for (const m of glass) m.emissiveIntensity = prog >= 1 ? 0.05 + 0.9 * night : 0;
    if (prog < 1) kit.jib.rotation.y = Math.sin(t * 0.25) * 1.2;
  }
  setProg(opts.prog ?? 0);
  return { group: g, setProg, update, dispose: () => { alive = false; group.remove(g); } };
}

// ---------------------------------------------------------------- контейнерен терминал
// opts: { x, z } — x на центъра на новия кей, z на брега (seaside.port.z); кеят расте към морето (−z)
export function buildPortTerminal(group, deps, opts = {}) {
  const g = new THREE.Group(); g.position.set(opts.x || 0, 0, opts.z || 0); group.add(g);
  const conc = mat(0xb8b4aa, 0.9), dark = mat(0x3a3d42, 0.9), white = mat(0xf2f2f2, 0.6, 0.2), orange = mat(0xff7a1a, 0.6, 0.3), stages = [];
  const W = 120, D = 70;
  // 0–0.4 кеят се насипва от брега навън
  const pier = new THREE.Group(); g.add(pier);
  const slab = box(W, 1.6, D, conc, 0, 0.4, -D / 2, pier);
  box(W, 0.2, 3, mat(0xd8d200, 0.6), 0, 1.3, -D + 1.5, pier);   // жълтата линия на ръба
  for (let x = -W / 2 + 4; x < W / 2; x += 10) cyl(0.5, 0.6, 0.8, dark, x, 1.6, -D + 0.8, pier, 8);   // кнехти
  box(W, 0.05, 12, dark, 0, 1.23, -D + 10, pier);   // път за кранове
  // 0.4–0.75 портални кранове (STS) — по-големи от старите
  const cranes = [], PL = createPortLights(), lightsG = new THREE.Group(); g.add(lightsG);   // осветлението идва, щом кеят е насипан
  for (const [mx, mz] of [[-56, -3], [-18, -3], [18, -3], [56, -3], [-56, -D + 3], [0, -D + 3], [56, -D + 3]]) PL.mast(lightsG, mx, mz, { h: 22, r: 28 });
  for (let k = 0; k < 3; k++) {
    const s = stage(g, 0.4 + k * 0.1, 0.55 + k * 0.1); stages.push(s); s.position.set(-35 + k * 35, 1.2, -D + 10);
    for (const [sx, sz] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) box(1, 30, 1, orange, sx, 15, sz, s);
    box(14, 2, 10, orange, 0, 30, 0, s); box(1.6, 1.6, 64, white, 0, 32, -18, s); box(4, 3, 4, white, 0, 28, -6, s); PL.beaconAt(s, 0, 31.6, 0, 0.7); PL.beaconAt(s, 0, 33.2, -49.5, 0.6);
    cranes.push(s);
  }
  // 0.7–1 контейнерни редове
  const cols = [0xd62828, 0x1f5fbf, 0x2d8f4e, 0xffb300, 0x7b2cbf, 0x0a9396, 0xe8e2d4];
  for (let row = 0; row < 4; row++) {
    const s = stage(g, 0.7 + row * 0.07, 0.8 + row * 0.07); stages.push(s); s.position.set(0, 1.2, -18 - row * 9);
    for (let c = 0; c < 12; c++) for (let lv = 0; lv < 1 + ((c * 7 + row * 3) % 3); lv++) box(8.6, 2.6, 2.6, mat(cols[(c * 3 + row + lv) % cols.length], 0.7), -48 + c * 8.8, 1.3 + lv * 2.6, 0, s);
  }
  // сграда на терминала и порта (в края)
  const s9 = stage(g, 0.9, 1); stages.push(s9); s9.position.y = 1.2;
  box(16, 8, 10, mat(0xdfe5ea, 0.5, 0.2), W / 2 - 12, 4, -8, s9); box(14, 2.2, 10.2, PL.glow(mat(0x9fd3ff, 0.3, 0.2, 0xffd890), 1.6), W / 2 - 12, 5, -8, s9); box(16.4, 0.6, 10.4, mat(0x1f5fbf, 0.6), W / 2 - 12, 8.3, -8, s9);
  // контейнеровоз на кея, когато е готово
  let ship = null;
  { ship = new THREE.Group();   // временният (докато истинският се зареди — по-долу); детският ship-cargo-b е изтрит
    box(90, 7, 16, mat(0x1f3a5f, 0.6), 0, 1, 0, ship); box(14, 10, 14, white, 36, 9, 0, ship); for (let c = 0; c < 8; c++) box(8, 5, 12, mat(cols[c % cols.length], 0.7), -34 + c * 9, 7, 0, ship); ship.position.set(0, 0, -D - 16); g.add(ship); }
  // истински контейнеровоз (shipmodels.js), щом се зареди
  loadShipModels().then(() => { if (!hasShipModel('container')) return; const o = shipModel('container'); o.rotation.y = Math.PI / 2; o.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(o); o.position.set(ship.position.x, ship.position.y, -D - (bb.max.z - bb.min.z) / 2 - 3); o.visible = ship.visible; g.remove(ship); g.add(o); ship = o; });
  // строителна техника в морето: шлеп с пилоботна установка и плаващ кран
  const kit = new THREE.Group(); g.add(kit);
  const barge = new THREE.Group(); box(24, 2, 12, mat(0x55585e, 0.8), 0, 0.6, 0, barge); box(1.2, 22, 1.2, mat(0xf2b705, 0.6), -6, 12, 0, barge); box(3, 2, 3, mat(0x333333), -6, 20, 0, barge);
  const hammer = box(2, 3, 2, mat(0x222222, 0.5, 0.6), -6, 10, 0, barge); kit.add(barge);
  const fc = new THREE.Group(); box(20, 2, 14, mat(0x7a1f1f, 0.8), 0, 0.6, 0, fc); const boom = new THREE.Group(); boom.position.set(0, 2, 0); fc.add(boom); box(1, 1, 34, mat(0xf2b705, 0.6), 0, 10, -12, boom).rotation.x = 0.6; kit.add(fc);
  const sign = deps.label ? deps.label('⚓ НОВ ТЕРМИНАЛ', '#ffffff', 12) : null;
  if (sign) { sign.position.set(0, 40, -D / 2); g.add(sign); }

  let prog = -1;
  function setProg(p) {
    p = Math.max(0, Math.min(1, p)); if (p === prog) return; prog = p;
    const k = Math.min(1, p / 0.4);   // кеят: дълбочина k × D
    pier.visible = k > 0.01; pier.scale.z = Math.max(0.01, k);
    applyStages(stages, p);
    kit.visible = p < 1; ship.visible = p >= 1; lightsG.visible = k >= 1;
    barge.position.set(-20, 0, -D * Math.max(0.15, k) - 10); fc.position.set(30, 0, -D * Math.max(0.15, k) - 12);
    if (sign) sign.visible = p > 0;
  }
  function update(t, night = 0) {
    PL.setNight(night, t);
    if (prog < 1) { hammer.position.y = 10 + Math.abs(Math.sin(t * 2.2)) * 7; boom.rotation.y = Math.sin(t * 0.3) * 0.8; barge.position.y = fc.position.y = Math.sin(t) * 0.15; }
    else { ship.position.y = Math.sin(t * 0.7) * 0.15; cranes.forEach((c, i) => { c.position.x = -35 + i * 35 + Math.sin(t * 0.15 + i) * 3; }); }
  }
  setProg(opts.prog ?? 0);
  return { group: g, setProg, update, dispose: () => group.remove(g) };
}
