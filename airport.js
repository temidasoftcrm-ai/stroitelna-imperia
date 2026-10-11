// airport.js — 3D летище в града (Фаза WORLD, ниво 9): писта по z източно от града, рулежна пътека, перон,
// терминал с ръкави, контролна кула, хангари и карго зона. Нивата 1–5 добавят ръкави/самолети на перона.
// Самолетите: истински модели от Sketchfab (loadAirModels), иначе процедурни — регионален, A320, широкофюзелажен и карго.
// Един самолет каца (подход от юг над магистралата → пробег → излиза на рулежката), друг излита на север над морето.
import * as THREE from 'three';

const mat = (c, r = 0.8, m = 0, e) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...(e ? { emissive: e, emissiveIntensity: 0 } : {}) });
const box = (w, h, d, m, x, y, z, g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
const flat = (w, d, m, x, y, z, g) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); o.rotation.x = -Math.PI / 2; o.position.set(x, y, z); o.receiveShadow = true; g.add(o); return o; };

// геометрия на летището (локални координати; групата стои в (x, z) от opts)
const RW = { x: 46, z0: -100, z1: 110, w: 14 };   // пистата
const TW = { x: 26 };                              // рулежката
const TERM = { x: -6 };                            // терминалът (фасадата гледа към +x)
export const AIRPORT_SIZE = { w: 90, d: 230 };     // заема по x от −30 до +60, по z от −105 до +115

const LIVERY = [0xd62828, 0x1f5fbf, 0x2d8f4e, 0xffb300, 0x7b2cbf, 0x0a9396];
export const PLANE_KINDS = {
  regional: { len: 18, wing: 18, r: 1.1, eng: 2, tail: 3.2 },
  a320:     { len: 26, wing: 24, r: 1.5, eng: 2, tail: 4.2 },
  wide:     { len: 38, wing: 36, r: 2.2, eng: 2, tail: 6 },
  cargo:    { len: 34, wing: 34, r: 2.1, eng: 4, tail: 5.6, color: 0xe8e2d4 },
};

// ---- истински модели от Sketchfab (CC-BY, авторите са в CREDITS.txt и „📜 Автори“): самолетите по вид и контролна кула.
// Зареждат се с другите модели на играта (loadAirModels в game.js); ако липсват — процедурните.
//   yaw — завъртане около y, след което носът е към +z (моделите са завъртени различно)
const AIR_CFG = { regional: { f: 'regional', yaw: 0.26 }, a320: { f: 'a320', yaw: Math.PI / 2 }, wide: { f: 'wide', yaw: 0 }, cargo: { f: 'cargo', yaw: -0.28, tint: 0xe8e2d4 }, tower: { f: 'tower' } };
const AIR = {};
function normPlane(scene, K, yaw) {
  const g = new THREE.Group(), inner = new THREE.Group(); inner.add(scene); g.add(inner);
  inner.rotation.y = yaw; g.updateMatrixWorld(true);
  let bb = new THREE.Box3().setFromObject(g), sz = bb.getSize(new THREE.Vector3());
  inner.scale.setScalar(K.len * 1.25 / sz.z); g.updateMatrixWorld(true);
  bb = new THREE.Box3().setFromObject(g); sz = bb.getSize(new THREE.Vector3()); const c = bb.getCenter(new THREE.Vector3());
  const gearY = K.r + K.r * 0.8;
  inner.position.set(-c.x, -bb.min.y - gearY, -c.z);
  g.userData.span = sz.x;
  return g;
}
export function loadAirModels(load, base = 'assets/heavy/air/') {
  return Promise.all(Object.entries(AIR_CFG).map(([k, c]) => load(base + c.f + '.glb').then(gl => {
    const sc = gl.scene;
    sc.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; if (c.tint) { m.material = m.material.clone(); m.material.color.setHex(c.tint); } } });
    AIR[k] = k === 'tower' ? sc : normPlane(sc, PLANE_KINDS[k], c.yaw);
  }).catch(e => console.warn('airmodels', k, e))));
}

// процедурен самолет: нос към +z
export function makePlane(kind = 'a320', livery = 0) {
  const K = PLANE_KINDS[kind] || PLANE_KINDS.a320, g = new THREE.Group();
  if (AIR[kind]) {   // истинският модел + навигационните светлини на върховете на крилата
    const o = AIR[kind].clone(true), half = AIR[kind].userData.span / 2;
    const navR = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), mat(0xff2020, 0.5, 0, 0xff2020)), navG = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), mat(0x20ff40, 0.5, 0, 0x20ff40));
    navR.position.set(-half, -K.r * 0.3, -K.len * 0.05); navG.position.set(half, -K.r * 0.3, -K.len * 0.05); o.add(navR, navG);
    o.userData = { kind, gearY: K.r + K.r * 0.8, nav: [navR, navG], len: K.len, span: half * 2 };
    return o;
  }
  const body = mat(K.color || 0xf4f6f8, 0.45, 0.2), stripe = mat(LIVERY[livery % LIVERY.length], 0.5), dark = mat(0x2a3038, 0.5, 0.4), glass = mat(0x1a2a3a, 0.2, 0.6);
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(K.r, K.r, K.len, 14).rotateX(Math.PI / 2), body); g.add(fus);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(K.r, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), body); nose.scale.z = 1.6; nose.position.z = K.len / 2; g.add(nose);
  const tailc = new THREE.Mesh(new THREE.ConeGeometry(K.r, K.len * 0.22, 14).rotateX(-Math.PI / 2), body); tailc.position.set(0, K.r * 0.25, -K.len / 2 - K.len * 0.11); g.add(tailc);
  const cock = new THREE.Mesh(new THREE.BoxGeometry(K.r * 1.3, K.r * 0.35, K.r * 0.6), glass); cock.position.set(0, K.r * 0.55, K.len / 2 + K.r * 0.7); g.add(cock);
  const line = new THREE.Mesh(new THREE.CylinderGeometry(K.r * 1.01, K.r * 1.01, K.len * 0.9, 14, 1, true, Math.PI * 1.35, Math.PI * 0.3).rotateX(Math.PI / 2), stripe); g.add(line);
  // крила (стреловидни) и хоризонтален стабилизатор
  const wingGeo = (span, root, tip, sweep) => { const s = new THREE.Shape(); s.moveTo(0, root / 2); s.lineTo(span, root / 2 - sweep); s.lineTo(span, root / 2 - sweep - tip); s.lineTo(0, -root / 2); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: false }).rotateX(Math.PI / 2); };
  for (const sd of [1, -1]) {
    const w = new THREE.Mesh(wingGeo(K.wing / 2, K.len * 0.22, K.len * 0.07, K.len * 0.16), body); w.scale.x = sd; w.position.set(0, -K.r * 0.35, K.len * 0.05); g.add(w);
    const h = new THREE.Mesh(wingGeo(K.wing * 0.18, K.len * 0.1, K.len * 0.04, K.len * 0.07), body); h.scale.x = sd; h.position.set(0, K.r * 0.3, -K.len / 2 - K.len * 0.12); g.add(h);
    for (let e = 0; e < K.eng / 2; e++) {
      const en = new THREE.Mesh(new THREE.CylinderGeometry(K.r * 0.42, K.r * 0.36, K.len * 0.13, 12).rotateX(Math.PI / 2), dark);
      en.position.set(sd * K.wing * (0.17 + e * 0.15), -K.r * 0.85, K.len * 0.1 - e * K.len * 0.03); g.add(en);
    }
  }
  const fin = new THREE.Mesh(wingGeo(K.tail, K.len * 0.18, K.len * 0.07, K.len * 0.14), stripe); fin.rotation.z = Math.PI / 2; fin.position.set(0.12, K.r * 0.6, -K.len / 2 - K.len * 0.06); g.add(fin);
  // колесници
  for (const [x, z] of [[0, K.len * 0.38], [K.r * 0.9, -K.len * 0.02], [-K.r * 0.9, -K.len * 0.02]]) box(0.35, K.r * 0.9, 0.35, dark, x, -K.r - K.r * 0.35, z, g);
  // навигационни светлини (светят нощем)
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), mat(0xff2020, 0.5, 0, 0xff2020)), navG = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), mat(0x20ff40, 0.5, 0, 0x20ff40));
  navR.position.set(-K.wing / 2, -K.r * 0.3, -K.len * 0.035); navG.position.set(K.wing / 2, -K.r * 0.3, -K.len * 0.035); g.add(navR, navG);
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; } });
  g.userData = { kind, gearY: K.r + K.r * 0.8, nav: [navR, navG], len: K.len };
  return g;
}

// линейна интерполация по ключови кадри [t, x, y, z, yaw, pitch]
function sample(keys, t) {
  if (t <= keys[0][0]) return keys[0];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
    const a = keys[i - 1], b = keys[i], k = (t - a[0]) / (b[0] - a[0]), s = k * k * (3 - 2 * k);
    return a.map((v, j) => j === 0 ? t : v + (b[j] - v) * (j >= 4 ? s : k));
  }
  return keys[keys.length - 1];
}

// group: групата на града; deps: { A, model, label(text, color, w) }; opts: { lv (1–5), x, z, seed }
export function buildAirport(group, deps, opts = {}) {
  const g = new THREE.Group(); group.add(g);
  g.position.set(opts.x || 0, 0, opts.z || 0);
  const lights = [], beacons = [], windows = [];
  // земя, писта, рулежка, перон
  flat(AIRPORT_SIZE.w + 20, AIRPORT_SIZE.d + 20, mat(0x6f8f4e, 1), 15, 0.015, 5, g);
  flat(RW.w, RW.z1 - RW.z0, mat(0x2b2d31, 0.95), RW.x, 0.04, (RW.z0 + RW.z1) / 2, g);
  const white = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
  for (let z = RW.z0 + 22; z < RW.z1 - 22; z += 12) flat(0.6, 6, white, RW.x, 0.06, z, g);   // осева линия
  for (const zz of [RW.z0 + 4, RW.z1 - 4]) for (let k = -5; k <= 5; k += 2) if (k) flat(0.8, 7, white, RW.x + k * 0.6, 0.06, zz, g);   // прагове
  for (const sd of [-1, 1]) flat(0.3, RW.z1 - RW.z0, white, RW.x + sd * (RW.w / 2 - 0.6), 0.06, (RW.z0 + RW.z1) / 2, g);
  flat(8, RW.z1 - RW.z0 - 10, mat(0x3a3d42, 0.95), TW.x, 0.035, (RW.z0 + RW.z1) / 2, g);
  const yellow = new THREE.MeshBasicMaterial({ color: 0xf2c200 });
  flat(0.25, RW.z1 - RW.z0 - 10, yellow, TW.x, 0.05, (RW.z0 + RW.z1) / 2, g);
  for (const z of [RW.z0 + 14, -10, RW.z1 - 14]) { flat(RW.x - TW.x, 8, mat(0x3a3d42, 0.95), (RW.x + TW.x) / 2, 0.036, z, g); }
  flat(TW.x - TERM.x - 4, 170, mat(0x8a8d92, 0.9), (TW.x + TERM.x + 4) / 2, 0.03, 0, g);   // перон
  // светлини по ръба на пистата
  const lm = mat(0xfff4c0, 0.4, 0, 0xffe080);
  for (let z = RW.z0; z <= RW.z1; z += 10) for (const sd of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), lm); l.position.set(RW.x + sd * (RW.w / 2 + 0.6), 0.15, z); g.add(l); }
  lights.push(lm);
  const appr = mat(0xff3030, 0.4, 0, 0xff2020);   // подходни светлини на юг
  for (let k = 1; k <= 5; k++) { const p = box(0.2, 1.5, 0.2, mat(0x888888), RW.x, 0.75, RW.z1 + k * 6, g); const l = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 0.4), appr); l.position.set(RW.x, 1.6, RW.z1 + k * 6); g.add(l); }
  lights.push(appr);

  // терминал, кула, хангари — пресъздават се при смяна на нивото
  const lvG = new THREE.Group(); g.add(lvG);
  const parked = [];
  let lv = 0;
  function setLevel(n) {
    n = Math.max(1, Math.min(5, n | 0)); if (n === lv) return; lv = n;
    lvG.clear(); parked.length = 0; windows.length = 0;
    const tLen = 40 + n * 22, tz = -tLen / 2 + 20;
    const wall = mat(0xd9dde2, 0.6, 0.1), glassM = mat(0x5f8fb8, 0.2, 0.3, 0xffd890), roof = mat(0x9aa3ad, 0.5, 0.5);
    box(18, 9, tLen, wall, TERM.x - 6, 4.5, tz, lvG);
    box(0.4, 6, tLen - 4, glassM, TERM.x + 3.2, 4.6, tz, lvG); windows.push(glassM);
    box(21, 0.8, tLen + 3, roof, TERM.x - 5, 9.4, tz, lvG);   // покрив с козирка към перона
    box(12, 1.6, tLen - 6, roof, TERM.x - 7, 10.6, tz, lvG);
    // ръкави (един на ниво) и самолет до всеки
    const kinds = ['regional', 'a320', 'a320', 'wide', 'wide'];
    for (let k = 0; k < n; k++) {
      const z = 10 - k * 22;
      box(10, 2.6, 2.6, wall, TERM.x + 8, 4.6, z, lvG); box(2.6, 4.2, 2.6, wall, TERM.x + 13, 3, z, lvG);
      const p = makePlane(kinds[k], k + (opts.seed || 0)); const K = PLANE_KINDS[kinds[k]];
      p.position.set(TERM.x + 15 + K.r, p.userData.gearY, z); p.rotation.y = -Math.PI / 2; lvG.add(p); parked.push(p);
    }
    // контролна кула до северния край на терминала
    const tw = new THREE.Group(); tw.position.set(TERM.x - 4, 0, tz - tLen / 2 - 10); lvG.add(tw);
    if (AIR.tower) {   // истинската кула, висока колкото процедурната
      const o = AIR.tower.clone(true), w = new THREE.Group(); w.add(o); w.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(w), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3()), k = (27 + n * 2) / sz.y;
      o.position.set(-c.x, -bb.min.y, -c.z); w.scale.setScalar(k); tw.add(w);
    } else {
    box(4, 22 + n * 2, 4, wall, 0, (22 + n * 2) / 2, 0, tw);
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 3.4, 4, 8), glassM); cab.position.y = 24 + n * 2; tw.add(cab);
    box(9, 0.6, 9, roof, 0, 26.3 + n * 2, 0, tw);
    }
    const bm = mat(0x40ff60, 0.4, 0, 0x40ff60); const b = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), bm); b.position.y = 27.2 + n * 2; tw.add(b); beacons.length = 0; beacons.push(bm);
    // паркинг пред терминала
    flat(20, tLen * 0.7, mat(0x3a3d42, 0.95), TERM.x - 26, 0.03, tz, lvG);
    const rows = Math.floor(tLen * 0.7 / 5);
    for (let k = 0; k < rows * 2; k++) if (Math.random() < 0.6) box(2, 1.3, 4, mat(LIVERY[k % LIVERY.length], 0.5, 0.3), TERM.x - 26 + (k % 2 ? 4 : -4), 0.65, tz - tLen * 0.35 + 2.5 + Math.floor(k / 2) * 5, lvG);
    // хангари (ниво 3+): полуцилиндри южно от терминала, отворени към рулежката
    for (let k = 0; k < n - 2; k++) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 22, 18).rotateZ(Math.PI / 2), mat(0xb8bec6, 0.5, 0.5));
      h.position.set(TERM.x + 2, 0, 42 + k * 24); h.castShadow = h.receiveShadow = true; lvG.add(h);
      box(0.3, 8, 16, mat(0x2a3038, 0.6), TERM.x + 13.1, 3.5, 42 + k * 24, lvG);
    }
    // карго зона (ниво 5): склад, контейнери и товарен самолет
    if (n >= 5) {
      box(14, 7, 30, mat(0xc98a3b, 0.7), TERM.x - 26, 3.5, 70, lvG);
      for (let k = 0; k < 8; k++) box(2.4, 2.4, 6, mat(LIVERY[k % LIVERY.length], 0.6), TERM.x - 16 + (k % 2) * 3, 1.2, 58 + Math.floor(k / 2) * 7, lvG);
      const c = makePlane('cargo', 1); c.position.set(TW.x - 4, c.userData.gearY, 104); c.rotation.y = -Math.PI / 2; lvG.add(c); parked.push(c);
    }
    if (sign) { sign.position.set(TERM.x - 6, 16, tz); }
  }
  const sign = deps.label ? deps.label('✈️ ЛЕТИЩЕ', '#ffffff', 12) : null;
  if (sign) g.add(sign);
  setLevel(opts.lv || 1);

  // движещи се самолети: кацащ и излитащ, по график с период T секунди
  const T = 70, gy = k => PLANE_KINDS[k].r + PLANE_KINDS[k].r * 0.8;
  const land = makePlane('a320', 2), take = makePlane('wide', 4); g.add(land, take);
  const LAND = [   // [t, x, y, z, yaw, pitch]
    [0, RW.x, 90, RW.z1 + 700, Math.PI, -0.06], [16, RW.x, gy('a320'), RW.z1 - 6, Math.PI, -0.03], [17, RW.x, gy('a320'), RW.z1 - 14, Math.PI, 0],
    [27, RW.x, gy('a320'), RW.z0 + 20, Math.PI, 0], [31, (RW.x + TW.x) / 2, gy('a320'), RW.z0 + 14, Math.PI * 1.5, 0], [34, TW.x, gy('a320'), RW.z0 + 14, 0, 0],
    [52, TW.x, gy('a320'), RW.z1 - 20, 0, 0], [53, TW.x, -20, RW.z1 - 20, 0, 0], [T, TW.x, -20, RW.z1 - 20, 0, 0],
  ];
  const TAKE = [
    [0, TW.x, -20, RW.z1 - 14, Math.PI, 0], [30, TW.x, -20, RW.z1 - 14, Math.PI, 0], [31, TW.x, gy('wide'), RW.z1 - 14, Math.PI, 0],
    [35, RW.x, gy('wide'), RW.z1 - 14, Math.PI * 0.5, 0], [38, RW.x, gy('wide'), RW.z1 - 18, Math.PI, 0],
    [50, RW.x, gy('wide'), RW.z0 + 40, Math.PI, 0], [54, RW.x, 10, RW.z0 - 20, Math.PI, 0.16], [T, RW.x, 160, RW.z0 - 800, Math.PI, 0.12],
  ];
  const fly = (p, keys, t) => {
    const [, x, y, z, yaw, pitch] = sample(keys, t % T);
    p.visible = y > -5; p.position.set(x, y, z); p.rotation.set(0, 0, 0); p.rotateY(yaw); p.rotateX(-pitch);
  };

  function update(t, night = 0) {
    fly(land, LAND, t); fly(take, TAKE, t + T * 0.5);
    for (const m of lights) m.emissiveIntensity = 0.2 + 2.2 * night;
    for (const m of windows) m.emissiveIntensity = 0.05 + 1.8 * night;
    const blink = Math.sin(t * 4) > 0.6 ? 1 : 0;
    for (const m of beacons) m.emissiveIntensity = 0.3 + 2 * blink;
    for (const p of [land, take, ...parked]) for (const n of p.userData.nav) n.material.emissiveIntensity = night * (0.5 + blink);
  }
  function setPos(x, z) { g.position.set(x, 0, z); }
  function dispose() { group.remove(g); }
  // за клик: дали точка (световни координати) е върху летището
  const hit = (px, pz) => px > g.position.x - 30 && px < g.position.x + 60 && pz > g.position.z - 115 && pz < g.position.z + 120;
  return { group: g, update, setLevel, setPos, dispose, hit, get level() { return lv; } };
}
