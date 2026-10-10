// tender3d.js — 3D за държавните поръчки (tenders.js): уникални сгради, които растат по етапи според напредъка.
//   buildUniversity — Софийски университет: неокласическа сграда с колонада, фронтон и меден купол, площад с фонтан.
//   buildPortTerminal — нов контейнерен терминал до пристанището (seaside.js): кей, портални кранове, контейнери.
// Двете връщат { group, setProg(p 0…1), update(t, night) }; докато p < 1 се виждат скеле, кран и строителна техника.
import * as THREE from 'three';

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
  const sign = deps.label ? deps.label('🎓 СОФИЙСКИ УНИВЕРСИТЕТ', '#ffe9a8', 16) : null;
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
  const cranes = [];
  for (let k = 0; k < 3; k++) {
    const s = stage(g, 0.4 + k * 0.1, 0.55 + k * 0.1); stages.push(s); s.position.set(-35 + k * 35, 1.2, -D + 10);
    for (const [sx, sz] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) box(1, 30, 1, orange, sx, 15, sz, s);
    box(14, 2, 10, orange, 0, 30, 0, s); box(1.6, 1.6, 64, white, 0, 32, -18, s); box(4, 3, 4, white, 0, 28, -6, s);
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
  box(16, 8, 10, mat(0xdfe5ea, 0.5, 0.2), W / 2 - 12, 4, -8, s9); box(16.4, 0.6, 10.4, mat(0x1f5fbf, 0.6), W / 2 - 12, 8.3, -8, s9);
  // контейнеровоз на кея, когато е готово
  let ship = null;
  if (deps.A && deps.model && deps.A['ship-cargo-b']) { ship = deps.model('ship-cargo-b', 7.5); ship.rotation.y = Math.PI / 2; ship.position.set(0, 0, -D - 16); g.add(ship); }
  else { ship = new THREE.Group(); box(90, 7, 16, mat(0x1f3a5f, 0.6), 0, 1, 0, ship); box(14, 10, 14, white, 36, 9, 0, ship); for (let c = 0; c < 8; c++) box(8, 5, 12, mat(cols[c % cols.length], 0.7), -34 + c * 9, 7, 0, ship); ship.position.set(0, 0, -D - 16); g.add(ship); }
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
    kit.visible = p < 1; ship.visible = p >= 1;
    barge.position.set(-20, 0, -D * Math.max(0.15, k) - 10); fc.position.set(30, 0, -D * Math.max(0.15, k) - 12);
    if (sign) sign.visible = p > 0;
  }
  function update(t, night = 0) {
    if (prog < 1) { hammer.position.y = 10 + Math.abs(Math.sin(t * 2.2)) * 7; boom.rotation.y = Math.sin(t * 0.3) * 0.8; barge.position.y = fc.position.y = Math.sin(t) * 0.15; }
    else { ship.position.y = Math.sin(t * 0.7) * 0.15; cranes.forEach((c, i) => { c.position.x = -35 + i * 35 + Math.sin(t * 0.15 + i) * 3; }); }
  }
  setProg(opts.prog ?? 0);
  return { group: g, setProg, update, dispose: () => group.remove(g) };
}
