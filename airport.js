// airport.js — 3D летище в града (Фаза WORLD, ниво 9): писта по z източно от града, рулежна пътека, перон,
// терминал с ръкави, контролна кула, хангари и карго зона. Нивата 1–5 добавят ръкави/самолети на перона.
// Самолетите: истински модели от Sketchfab (loadAirModels), иначе процедурни — регионален, A320, широкофюзелажен и карго.
// Един самолет каца (подход от юг над магистралата → пробег → излиза на рулежката), друг излита на север над морето.
import * as THREE from 'three';
import { canvasTex } from './texdata.js';   // fac-data (T1): статичните платна → собствени данни (не се губят)
import { feature } from './lab/feature.js';

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
const AIR_CFG = { regional: { f: 'regional', yaw: 0.26 }, a320: { f: 'a320', yaw: Math.PI / 2 }, wide: { f: 'wide', yaw: 0 }, cargo: { f: 'cargo', yaw: -0.28, tint: 0xe8e2d4 }, tower: { f: 'tower' }, ...(feature('lm-atc5') ? { atc5: { f: 'atc5' } } : {}), ...(feature('air-hangar2') ? { hangar2: { f: 'hangar2' } } : {}),   /* air-hangar2 (T2): хангарът на потребителя (Meshy) */   /* lm-atc5 (T2): кулата на потребителя (Meshy) — от ниво 5 */
  // терминалите по нива: малко летище (1–2), регионално (3), международно (4–5)
  term_s: { f: 'term-s' }, term_m: { f: 'term-m' }, term_l: { f: 'term-l' },
  // plane-wizz (T1): A320neo на Wizz Air (Meshy AI, Темидасофт) — нос към +z, колесникът (gear_*) и светлините (nav_/strobe_/beacon_) — отделни възли
  ...(feature('plane-wizz') ? { wizz: { f: 'wizz-a320', yaw: 0 } } : {}) };
// plane-wizz: колко от A320-ите са на Wizz Air — в Европа често, другаде рядко (buildAirport → opts.eu)
let WIZZ_P = 0.15;
const AIR = {};
// прозорците на самолетите: тъмни денем, топло светят нощем (update → winM.emissiveIntensity)
const winTex = (() => { const c = document.createElement('canvas'); c.width = 32; c.height = 16; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 32, 16); x.fillStyle = '#fff'; x.beginPath(); x.roundRect ? x.roundRect(9, 3, 14, 10, 4) : x.rect(9, 3, 14, 10); x.fill(); const t = canvasTex(c); t.wrapS = THREE.RepeatWrapping; return t; })();
const winM = new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.25, metalness: 0.2, emissive: 0xffd48a, emissiveIntensity: 0, emissiveMap: winTex, alphaMap: winTex, transparent: true, depthWrite: false });
// фюзелажът на истинския модел: горният ръб и полуширината в средата (веднъж на вид)
function fusOf(o, L, K) {
  o.updateMatrixWorld(true); const v = new THREE.Vector3(), pts = [];
  o.traverse(m => { if (!m.isMesh) return; const a = m.geometry.attributes.position, st = Math.max(1, Math.floor(a.count / 4000));
    for (let i = 0; i < a.count; i += st) { v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld); if (Math.abs(v.z) < L * 0.12) pts.push(v.clone()); } });
  if (pts.length < 20) return { top: K.r * 1.25, half: K.r * 1.25, xc: 0 };
  const xs = pts.map(p => p.x).sort((a, b) => a - b), xc = xs[xs.length >> 1];   // оста на фюзелажа (медианата — крилата са симетрични)
  let top = -1e9; for (const p of pts) if (Math.abs(p.x - xc) < 0.5) top = Math.max(top, p.y);
  if (top < -1e8) return { top: K.r * 1.25, half: K.r * 1.25, xc: 0 };
  // радиусът — от сечението близо до горния ръб (там няма крила): точка на ширина w и дълбочина h → R = (w² + h²) / 2h
  const R0 = K.r * 1.25; let R = 0;
  for (const p of pts) { const h = top - p.y; if (h > R0 * 0.25 && h < R0 * 0.6) { const w = Math.abs(p.x - xc); R = Math.max(R, (w * w + h * h) / (2 * h)); } }
  R = Math.min(Math.max(R || R0, R0 * 0.7), R0 * 1.5);
  return { top, half: R, xc };
}
// редица прозорци от двете страни на фюзелажа (InstancedMesh — един draw call)
function addWindows(o, fus, L) {
  const r = fus.half, y = fus.top - r * 0.45, n = Math.floor(L * 0.62 / 0.95), len = n * 0.95, g = new THREE.PlaneGeometry(len, 0.5), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * n);   // n прозореца по дължината (текстурата се повтаря)
  for (const sd of [-1, 1]) { const m = new THREE.Mesh(g, winM); m.rotation.y = sd * Math.PI / 2; m.position.set((fus.xc || 0) + sd * (Math.sqrt(r * r - (r * 0.55) ** 2) + 0.05), y, -L * 0.3 + len / 2); m.renderOrder = 1; o.add(m); }
}
// кулата нощем: фасадата е осветена с прожектори (emissive по текстурата), кабината свети
const towerMats = new Set();
// размахът (по x) и дължината (по z) на самолета — носът към +z, преди завъртането
function planeDims(p) { const r = p.rotation.y; p.rotation.y = 0; p.updateMatrixWorld(true); const s = new THREE.Box3().setFromObject(p).getSize(new THREE.Vector3()); p.rotation.y = r; return { span: s.x, len: s.z }; }
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
  return Promise.all(Object.entries(AIR_CFG).filter(([k]) => !k.startsWith('term')).map(([k, c]) => load(base + c.f + '.glb').then(gl => {
    const sc = gl.scene;
    sc.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true;
      if (m.material.isMeshBasicMaterial) m.material = new THREE.MeshStandardMaterial({ map: m.material.map, color: m.material.color, roughness: 0.45, metalness: 0.15 });   // KHR_materials_unlit (a320) светеше бяло нощем
      if (c.tint) { m.material = m.material.clone(); m.material.color.setHex(c.tint); } } });
    AIR[k] = k === 'tower' || k === 'atc5' || k === 'hangar2' || k.startsWith('term') ? sc : normPlane(sc, PLANE_KINDS[k] || PLANE_KINDS.a320, c.yaw);
  }).catch(e => console.warn('airmodels', k, e))));
}

// терминалите се зареждат чак когато има летище (тежки са) — веднъж
let termP = null;
export function loadTerminals(load, base = 'assets/heavy/air/') {
  return termP || (termP = Promise.all(['term_s', 'term_m', 'term_l'].map(k => load(base + AIR_CFG[k].f + '.glb').then(gl => { AIR[k] = gl.scene; }).catch(e => console.warn('terminal', k, e)))));
}
// истинската контролна кула (Sketchfab), ако е заредена — за държавната поръчка „терминал“ (tender3d.js)
export const airTowerModel = () => AIR.tower ? AIR.tower.clone(true) : null;
// процедурен самолет: нос към +z
export function makePlane(kind = 'a320', livery = 0) {
  const K = PLANE_KINDS[kind] || PLANE_KINDS.a320, g = new THREE.Group();
  if (kind === 'a320' && AIR.wizz && ((livery * 2654435761) >>> 0) % 1000 < WIZZ_P * 1000) {   // plane-wizz: светлините са в модела (навигационни, строби, маяци) — мигат нощем като nav
    const o = AIR.wizz.clone(true), nav = []; o.traverse(m => { if (m.isMesh && /^(nav|strobe|beacon)_/.test(m.name)) { m.castShadow = false; nav.push(m); } });
    o.userData = { kind, gearY: K.r + K.r * 0.8, nav, len: K.len, span: AIR.wizz.userData.span, wizz: true };
    AIR.wizz.userData.fus ??= fusOf(AIR.wizz, K.len * 1.25, K); addWindows(o, AIR.wizz.userData.fus, K.len * 1.25 * 0.92);
    return o;
  }
  if (AIR[kind]) {   // истинският модел + навигационните светлини на върховете на крилата
    const o = AIR[kind].clone(true), half = AIR[kind].userData.span / 2;
    const navR = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), mat(0xff2020, 0.5, 0, 0xff2020)), navG = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), mat(0x20ff40, 0.5, 0, 0x20ff40));
    navR.position.set(-half, -K.r * 0.3, -K.len * 0.05); navG.position.set(half, -K.r * 0.3, -K.len * 0.05); o.add(navR, navG);
    o.userData = { kind, gearY: K.r + K.r * 0.8, nav: [navR, navG], len: K.len, span: half * 2 };
    if (kind !== 'cargo') { const L = K.len * 1.25; AIR[kind].userData.fus ??= fusOf(AIR[kind], L, K); addWindows(o, AIR[kind].userData.fus, L * 0.92); }
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
  if (kind !== 'cargo') addWindows(g, { top: K.r, half: K.r }, K.len);
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

// group: групата на града; deps: { A, model, label(text, color, w) }; opts: { lv (1–7), x, z, seed }
export function buildAirport(group, deps, opts = {}) {
  if (opts.eu != null) WIZZ_P = opts.eu ? 0.45 : 0.08;   // plane-wizz: Европа — често, другаде — рядко
  const g = new THREE.Group(); group.add(g);
  g.position.set(opts.x || 0, 0, opts.z || 0);
  const lights = [], beacons = [], windows = [], towerGlows = [], smalls = [];
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
  // ---- пътна мрежа откъм града: входен път (продължава улицата на града, z = ROAD_Z), булевард покрай летището (x = −42),
  // отбивки към терминала, автобусна спирка и коли, които се движат
  const ROAD_Z = opts.roadZ ?? -12, BX = -42, asph = mat(0x3d4045, 0.95), curb = mat(0xb9bcc0, 0.8), dash = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
  const road = (x1, z1, x2, z2, w = 8) => {
    const len = Math.hypot(x2 - x1, z2 - z1), ax = Math.abs(x2 - x1) > Math.abs(z2 - z1), cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    flat(ax ? len : w, ax ? w : len, asph, cx, 0.045, cz, g);
    for (const sd of [-1, 1]) box(ax ? len : 0.4, 0.18, ax ? 0.4 : len, curb, ax ? cx : cx + sd * (w / 2 + 0.2), 0.09, ax ? cz + sd * (w / 2 + 0.2) : cz, g);
    for (let d = -len / 2 + 3; d < len / 2 - 2; d += 7) flat(ax ? 3 : 0.25, ax ? 0.25 : 3, dash, ax ? cx + d : cx, 0.06, ax ? cz : cz + d, g);
  };
  const xCity = opts.cityGap != null ? -opts.cityGap : -70;
  road(xCity, ROAD_Z, BX, ROAD_Z);                  // входен път от града
  road(BX, -100, BX, 112);                          // булевард покрай летището
  // кръгово кръстовище и табела
  { const rb = new THREE.Mesh(new THREE.CircleGeometry(6, 24), asph); rb.rotation.x = -Math.PI / 2; rb.position.set(BX, 0.05, ROAD_Z); g.add(rb);
    const isl = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.4, 20), mat(0x6f9a4e, 1)); isl.position.set(BX, 0.2, ROAD_Z); g.add(isl);
    const pole = box(0.3, 5, 0.3, mat(0x666a70), BX - 9, 2.5, ROAD_Z - 7, g), sgn = box(0.2, 2.2, 6, mat(0x1f5fbf, 0.5), BX - 9, 5.2, ROAD_Z - 7, g);
    const wsg = box(0.25, 0.6, 3.5, new THREE.MeshBasicMaterial({ color: 0xffffff }), BX - 9.1, 5.4, ROAD_Z - 7, g); }
  // улични лампи покрай булеварда
  const lampM = mat(0xfff2c0, 0.4, 0, 0xffd890); lights.push(lampM);
  for (let z = -95; z <= 105; z += 20) { box(0.2, 6, 0.2, mat(0x555a60), BX - 5, 3, z, g); box(1.6, 0.3, 0.5, lampM, BX - 4.3, 6, z, g); }
  // движещи се коли: по входния път и по булеварда (затворени маршрути)
  const traffic = [], carCols = [0xd62828, 0xf2f2f2, 0x1f5fbf, 0x2b2d31, 0xffb300, 0x2d8f4e];
  const mkCar = (k, bus) => { if (!bus && deps.model) { try { const nm = ['sf-car-Taxi', 'sf-car-Sedan', 'sf-car-SUV', 'sf-car-Hatchback', 'sf-car-Van'][k % 5]; if (deps.A && deps.A[nm]) return deps.model(nm, 1);   /* sf-car-* вече са в истински метри (беше ×1.6 → 6–10 м) */ } catch (e) { /* без модел */ } }
    const c = new THREE.Group(); box(bus ? 2.6 : 1.9, bus ? 3 : 1.3, bus ? 11 : 4, mat(bus ? 0x1f8f5f : carCols[k % carCols.length], 0.5, 0.3), 0, bus ? 1.7 : 0.8, 0, c); return c; };
  const routes = [
    { pts: [[xCity, ROAD_Z - 2], [BX + 2, ROAD_Z - 2], [BX + 2, 105], [BX - 2, 105], [BX - 2, ROAD_Z + 2], [xCity, ROAD_Z + 2]], n: 5 },
    { pts: [[BX + 2, -95], [BX + 2, 105], [BX - 2, 105], [BX - 2, -95]], n: 4 },
  ];
  for (const R of routes) {
    let L = 0; R.seg = R.pts.map((p, i) => { const q = R.pts[(i + 1) % R.pts.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); const s0 = L; L += l; return { p, q, l, s0 }; }); R.L = L;
    for (let k = 0; k < R.n; k++) { const c = mkCar(k, R === routes[1] && k === 0); g.add(c); traffic.push({ c, R, s: k * L / R.n, v: 9 + (k % 3) * 2 }); }
  }
  const moveTraffic = dt => { for (const t of traffic) { t.s = (t.s + t.v * dt) % t.R.L; const sg = t.R.seg.find(q => t.s >= q.s0 && t.s < q.s0 + q.l) || t.R.seg[0], f = (t.s - sg.s0) / sg.l;
    t.c.position.set(sg.p[0] + (sg.q[0] - sg.p[0]) * f, 0.06, sg.p[1] + (sg.q[1] - sg.p[1]) * f); t.c.rotation.y = Math.atan2(sg.q[0] - sg.p[0], sg.q[1] - sg.p[1]); } };
  let lastT = null;
  const parked = [];
  let lv = 0;
  function setLevel(n) {
    n = Math.max(1, Math.min(7, n | 0)); if (n === lv) return; lv = n;
    const big = n; n = Math.min(5, n);   // ниво 6–7 (мега/световен хъб): терминалът е като на 5, плюс още хангари и самолети
    lvG.clear(); parked.length = 0; windows.length = 0; towerGlows.length = 0; smalls.length = 0;
    const tLen = Math.min(40 + n * 22, 112), tz = -tLen / 2 + 20;   // до 112 — кулата в северния край остава на сушата (не над морето)
    // писти колкото е нивото: ниво 3 — 3 писти, ниво 7 — 7 (успоредни на изток, през 26 м)
    { const extra = big - 1, wm = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }), asph = mat(0x2b2d31, 0.95), tw = mat(0x3a3d42, 0.95), em = mat(0xfff4c0, 0.4, 0, 0xffe080);
      for (let k = 1; k <= extra; k++) {
        const x = RW.x + k * 26, z0 = RW.z0 + 10 * k, z1 = RW.z1 - 10 * k;
        flat(RW.w + 14, z1 - z0 + 20, mat(0x6f8f4e, 1), x, 0.016, (z0 + z1) / 2, lvG);   // трева под пистата (земята на летището е до x≈60)
        flat(RW.w, z1 - z0, asph, x, 0.04, (z0 + z1) / 2, lvG);
        for (let z = z0 + 22; z < z1 - 22; z += 12) flat(0.6, 6, wm, x, 0.06, z, lvG);
        for (const zz of [z0 + 4, z1 - 4]) for (let q = -5; q <= 5; q += 2) if (q) flat(0.8, 7, wm, x + q * 0.6, 0.06, zz, lvG);
        for (const sd of [-1, 1]) flat(0.3, z1 - z0, wm, x + sd * (RW.w / 2 - 0.6), 0.06, (z0 + z1) / 2, lvG);
        for (let z = z0; z <= z1; z += 14) for (const sd of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), em); l.position.set(x + sd * (RW.w / 2 + 0.6), 0.15, z); lvG.add(l); }
        lights.push(em);
        for (const z of [z0 + 14, -10, z1 - 14]) flat(26, 8, tw, x - 13, 0.036, z, lvG);   // връзки към предишната писта
        // номер на пистата (09L/09R…) — бяла табела в края
        box(4, 0.06, 2.4, wm, x, 0.07, z1 - 10, lvG);
        // по-малък самолет (регионален) каца и излита по тази писта — с отместване във времето (до 4 писти, за да не тежи)
        if (k <= 4) { const sp = makePlane(k % 2 ? 'regional' : 'a320', 10 + k); sp.userData.rw = { x, z0, z1, ph: k * 0.23 }; lvG.add(sp); smalls.push(sp); }
      }
    }
    const wall = mat(0xd9dde2, 0.6, 0.1), glassM = mat(0x5f8fb8, 0.2, 0.3, 0xffd890), roof = mat(0x9aa3ad, 0.5, 0.5);
    const tk = n <= 2 ? 'term_s' : n === 3 ? 'term_m' : 'term_l';
    if (AIR[tk]) {   // истинският терминал (Sketchfab), вписан в мястото на процедурния: дългата страна по z, ширина до ~24
      const o = AIR[tk].clone(true), inner = new THREE.Group(), w = new THREE.Group(); inner.add(o); w.add(inner); w.updateMatrixWorld(true);
      let bb = new THREE.Box3().setFromObject(w), sz = bb.getSize(new THREE.Vector3());
      if (sz.x > sz.z) { inner.rotation.y = Math.PI / 2; w.updateMatrixWorld(true); bb = new THREE.Box3().setFromObject(w); sz = bb.getSize(new THREE.Vector3()); }
      if (tk === 'term_l') { inner.rotation.y += Math.PI; w.updateMatrixWorld(true); }   // ръкавите — към перона (+x)
      const k = Math.min(tLen / sz.z, (n <= 2 ? 22 : tk === 'term_l' ? 34 : 26) / sz.x); inner.scale.setScalar(k); w.updateMatrixWorld(true);
      bb = new THREE.Box3().setFromObject(w); const cc = bb.getCenter(new THREE.Vector3());
      inner.position.set(-cc.x, -bb.min.y, -cc.z); w.position.set(TERM.x - (tk === 'term_l' ? 4 : 6), 0.05, tz);
      w.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; for (const x of [].concat(m.material)) if (x.metalness > 0.5) x.metalness = 0.3; } });
      lvG.add(w);
    } else {
    box(18, 9, tLen, wall, TERM.x - 6, 4.5, tz, lvG);
    box(0.4, 6, tLen - 4, glassM, TERM.x + 3.2, 4.6, tz, lvG); windows.push(glassM);
    box(21, 0.8, tLen + 3, roof, TERM.x - 5, 9.4, tz, lvG);   // покрив с козирка към перона
    box(12, 1.6, tLen - 6, roof, TERM.x - 7, 10.6, tz, lvG);
    }
    // ръкави (един на ниво) и самолет до всеки
    const kinds = ['regional', 'a320', 'a320', 'wide', 'wide'];
    let zg = AIR.hangar2 && n >= 5 ? 19 : 21;   // air-hangar2 (T2): ръкавите — по истинския размах (5 м между върховете на крилата); които не се побират до края на терминала — няма ги (широките в ъгъла се пресичаха)
    for (let k = 0; k < n; k++) {
      const p = makePlane(kinds[k], k + (opts.seed || 0)); const K = PLANE_KINDS[kinds[k]], sp = AIR.hangar2 ? planeDims(p).span : 22;
      if (AIR.hangar2 && zg - sp < tz - tLen / 2 + 2) break;
      const z = AIR.hangar2 ? zg - sp / 2 : 10 - k * 22; zg -= sp + 5;
      box(10, 2.6, 2.6, wall, TERM.x + 8, 4.6, z, lvG); box(2.6, 4.2, 2.6, wall, TERM.x + 13, 3, z, lvG);
      p.position.set(TERM.x + 15 + K.r, p.userData.gearY, z); p.rotation.y = -Math.PI / 2; lvG.add(p); parked.push(p);
    }
    // контролна кула до северния край на терминала
    const tw = new THREE.Group(); tw.position.set(TERM.x - 4, 0, tz - tLen / 2 - 10); lvG.add(tw);
    const A5 = big >= 5 && AIR.atc5;   // lm-atc5 (T2): от ниво 5 — голямата кула на потребителя (~65 м), с въртящ се радар и мигаща червена светлина
    if (A5) { const o = AIR.atc5.clone(true), w = new THREE.Group(); w.add(o); w.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(w), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3()), H = 60, k = H / sz.y;
      o.position.set(-c.x, -bb.min.y, -c.z); w.scale.setScalar(k); tw.add(w); tw.position.set(TERM.x - 15, 0, tz - tLen / 2 - 9);   /* северно от терминала, основата (~33 м) — изцяло на тревата (z ≥ −114 от −120), далеч от хангарите на юг */   
      o.traverse(m => { if (m.isMesh) for (const x of [].concat(m.material)) if (!towerMats.has(x)) { x.emissive = new THREE.Color(0xfff0d8); x.emissiveMap = x.map || null; x.emissiveIntensity = 0; x.needsUpdate = true; towerMats.add(x); } });
      const cab = new THREE.Sprite(glowM.clone()); cab.position.y = H * 0.8; cab.scale.set(H * 0.3, H * 0.18, 1); cab.userData.towerGlow = 1; tw.add(cab); towerGlows.push(cab);
      const rad = new THREE.Group(); rad.position.y = H + 0.6; const rm = mat(0xd9dde2, 0.5, 0.4); rad.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.2, 8).translate(0, 0.6, 0), rm)); const dish = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.9, 0.25), rm); dish.position.y = 1.4; rad.add(dish); tw.add(rad);
      rad.onBeforeRender = () => { rad.rotation.y = performance.now() / 1000 * 1.2; }; dish.onBeforeRender = rad.onBeforeRender;
      const rb = mat(0xff2a1a, 0.4, 0, 0xff2a1a); const r0 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), rb); r0.position.y = H + 2.6; tw.add(r0); beacons.length = 0; beacons.push(rb);
    } else if (AIR.tower) {   // истинската кула, висока колкото процедурната
      const o = AIR.tower.clone(true), w = new THREE.Group(); w.add(o); w.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(w), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3()), k = (27 + n * 2) / sz.y;
      o.position.set(-c.x, -bb.min.y, -c.z); w.scale.setScalar(k); tw.add(w);
      o.traverse(m => { if (m.isMesh) for (const x of [].concat(m.material)) if (!towerMats.has(x)) { x.emissive = new THREE.Color(0xfff0d8); x.emissiveMap = x.map || null; x.emissiveIntensity = 0; x.needsUpdate = true; towerMats.add(x); } });
      const H = 27 + n * 2, cab = new THREE.Sprite(glowM.clone()); cab.position.y = H * 0.9; cab.scale.set(H * 0.45, H * 0.3, 1); cab.userData.towerGlow = 1; tw.add(cab); towerGlows.push(cab);
    } else {
    box(4, 22 + n * 2, 4, wall, 0, (22 + n * 2) / 2, 0, tw);
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 3.4, 4, 8), glassM); cab.position.y = 24 + n * 2; tw.add(cab); windows.push(glassM);
    box(9, 0.6, 9, roof, 0, 26.3 + n * 2, 0, tw);
    }
    if (!A5) { const bm = mat(0x40ff60, 0.4, 0, 0x40ff60); const b = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), bm); b.position.y = 27.2 + n * 2; tw.add(b); beacons.length = 0; beacons.push(bm); }
    // паркинг пред терминала
    flat(20, tLen * 0.7, mat(0x3a3d42, 0.95), TERM.x - 26, 0.03, tz, lvG);
    // отбивки от булеварда към паркинга и терминала (в двата края на паркинга) и автобусна спирка
    for (const zz of [tz - tLen * 0.35 - 4, tz + tLen * 0.35 + 4]) { flat(BX - (TERM.x - 16) < 0 ? 0 : (TERM.x - 16) - BX, 7, asph, (BX + TERM.x - 16) / 2, 0.046, zz, lvG); }
    flat(7, tLen * 0.7 + 15, asph, TERM.x - 19.5, 0.046, tz, lvG);   // алея пред входа на терминала (спиране за слизане)
    { const st = new THREE.Group(); st.position.set(TERM.x - 23.5, 0, tz - tLen * 0.2); lvG.add(st); box(0.2, 2.6, 0.2, mat(0x666a70), -1.5, 1.3, 0, st); box(0.2, 2.6, 0.2, mat(0x666a70), 1.5, 1.3, 0, st); box(3.6, 0.2, 1.6, mat(0x1f8f5f, 0.5), 0, 2.7, 0, st); box(3.2, 1.8, 0.1, mat(0x9fd8ff, 0.2, 0.2), 0, 1.3, -0.7, st); }
    const rows = Math.floor(tLen * 0.7 / 5);
    for (let k = 0; k < rows * 2; k++) if (Math.random() < 0.6) box(2, 1.3, 4, mat(LIVERY[k % LIVERY.length], 0.5, 0.3), TERM.x - 26 + (k % 2 ? 4 : -4), 0.65, tz - tLen * 0.35 + 2.5 + Math.floor(k / 2) * 5, lvG);
    // хангари (ниво 3+): полуцилиндри южно от терминала, отворени към рулежката
    const HG = AIR.hangar2 ? [40, 22].slice(0, Math.max(0, Math.min(2, big - 2))) : null; const CG = HG && n >= 5; let hz0 = CG ? 73 : 40;   // air-hangar2: голям (40 м — за A320) и малък (22 м); повече не се побират до края на земята; с карго зона (5+) карго самолетът е на перона пред тях, а малкият — на запад, пред носа му
    for (let k = 0; k < (HG ? HG.length : big - 2); k++) {
      if (HG) {   // air-hangar2 (T2): истинският хангар, вратата — към рулежката (+x); ролетна врата полуотворена, светлина отвътре нощем
        const o = AIR.hangar2.clone(true), w = new THREE.Group(); w.add(o); w.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(w), sz = bb.getSize(new THREE.Vector3()), Lh = HG[k], kk = Lh / Math.max(sz.x, sz.z), Wh = Math.min(sz.x, sz.z) * kk, west = CG && k === 1, hx = west ? TERM.x - 17.5 : TERM.x + 6, zc = west ? 26 + Wh / 2 : hz0 + Wh / 2; if (!west) hz0 += Wh + 4;
        w.scale.setScalar(kk); w.rotation.y = Math.PI / 2; w.position.set(hx, 0, zc); o.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; if (!m.userData.hm) { m.userData.hm = 1; m.material = m.material.clone(); m.material.metalness = 0.1; m.material.roughness = 0.6; m.material.metalnessMap = null; m.material.aoMap = null; m.material.emissive = new THREE.Color(0xffffff); m.material.emissiveMap = m.material.map; m.material.emissiveIntensity = 0.22; m.material.needsUpdate = true; } } }); lvG.add(w);   /* без отражения металът излизаше черен */
        const L = Lh / 2, f = Lh / 22, dw = 8.9 * f, dh = 5.6 * f, glowM = mat(0x1a1d22, 0.8, 0, 0xffd9a0); glowM.emissiveIntensity = 0; windows.push(glowM);
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), glowM); gl.rotation.y = Math.PI / 2; gl.position.set(hx + L - 0.4, dh / 2, zc); lvG.add(gl); if (west) flat(TERM.x + 4 - (hx + L), Wh, mat(0x8a8d92, 0.9), (hx + L + TERM.x + 4) / 2, 0.03, zc, lvG);
        const door = box(0.18, dh, dw, mat(0x9aa0a6, 0.55, 0.3), hx + L + 0.15, 0, zc, lvG), ph = k * 2.3;
        door.onBeforeRender = () => { const u = 0.5 + 0.5 * Math.sin(performance.now() / 9000 + ph); door.position.y = dh / 2 + dh * 0.5 * u; };   // бавно се вдига до половината и пак се спуска
      } else {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 22, 18).rotateZ(Math.PI / 2), mat(0xb8bec6, 0.5, 0.5));
      h.position.set(TERM.x + 2, 0, 42 + k * 24); h.castShadow = h.receiveShadow = true; lvG.add(h);
      box(0.3, 8, 16, mat(0x2a3038, 0.6), TERM.x + 13.1, 3.5, 42 + k * 24, lvG);
      }
    }
    if (AIR.hangar2 && tz - tLen / 2 - 8 < -85) flat(TW.x - TERM.x - 4, -85 - (tz - tLen / 2 - 8), mat(0x8a8d92, 0.9), (TW.x + TERM.x + 4) / 2, 0.03, (-85 + tz - tLen / 2 - 8) / 2, lvG);   // air-hangar2: и на север — под последния ръкав (самолетът беше на тревата)
    if (HG && HG.length && hz0 - 4 > 85) flat(TW.x - TERM.x - 4, hz0 - 4 - 85, mat(0x8a8d92, 0.9), (TW.x + TERM.x + 4) / 2, 0.03, (85 + hz0 - 4) / 2, lvG);   // air-hangar2: перонът стига до вратите на хангарите (беше трева)
    // карго зона (ниво 5): склад, контейнери и товарен самолет
    if (n >= 5) {
      if (AIR.hangar2) {   // air-hangar2: карго терминалът — гофрирана облицовка, рампи с ролетни врати откъм сушата, надпис CARGO (вместо оранжевата кутия)
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const x = cv.getContext('2d'); x.fillStyle = '#c9ccd0'; x.fillRect(0, 0, 256, 64); for (let i = 0; i < 256; i += 6) { x.fillStyle = i % 12 ? '#b3b7bc' : '#dadde0'; x.fillRect(i, 0, 3, 64); } x.fillStyle = '#d35400'; x.fillRect(0, 0, 256, 7);
        const tex = canvasTex(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(3, 1); const clad = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.1 });
        box(14, 8, 30, clad, TERM.x - 24, 4, 70, lvG); box(14.6, 0.4, 30.6, mat(0x6b7178, 0.6), TERM.x - 24, 8.2, 70, lvG);   /* 2 м от булеварда (беше 1 м върху него) */
        for (let q = 0; q < 4; q++) { box(0.2, 3.6, 4, mat(0x4a4f56, 0.6), TERM.x - 31.1, 1.8, 58 + q * 8, lvG); box(1.6, 1.1, 4.6, mat(0x55585e, 0.9), TERM.x - 31.9, 0.55, 58 + q * 8, lvG); }   // рампите
        const sc2 = document.createElement('canvas'); sc2.width = 256; sc2.height = 64; const y2 = sc2.getContext('2d'); y2.fillStyle = '#1f3f6e'; y2.fillRect(0, 0, 256, 64); y2.fillStyle = '#fff'; y2.font = 'bold 44px sans-serif'; y2.textAlign = 'center'; y2.fillText('CARGO', 128, 48);
        const st = canvasTex(sc2); st.colorSpace = THREE.SRGBColorSpace; const sm = mat(0xffffff, 0.5, 0, 0xffffff); sm.map = st; sm.emissiveMap = st; windows.push(sm);
        for (const sd of [-1, 1]) { const sg = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), sm); sg.position.set(TERM.x - 24 + sd * 7.06, 6.4, 70); sg.rotation.y = sd * Math.PI / 2; lvG.add(sg); }
        for (let k = 0; k < 8; k++) box(2.4, 2.4, 6, mat(LIVERY[k % LIVERY.length], 0.6), TERM.x - 30 + (k % 2) * 3, 1.2, 92 + Math.floor(k / 2) * 7, lvG);   // контейнерите — южно от склада, не върху хангарите
      } else {
      box(14, 7, 30, mat(0xc98a3b, 0.7), TERM.x - 26, 3.5, 70, lvG);
      for (let k = 0; k < 8; k++) box(2.4, 2.4, 6, mat(LIVERY[k % LIVERY.length], 0.6), TERM.x - 16 + (k % 2) * 3, 1.2, 58 + Math.floor(k / 2) * 7, lvG);
      }
      const c = makePlane('cargo', 1); c.position.set(AIR.hangar2 ? (TW.x + TERM.x + 4) / 2 + 2 : TW.x - 4, c.userData.gearY, AIR.hangar2 ? 46 : 104);   /* air-hangar2: на перона между ръкавите и хангарите (беше на тревата, с крило през малкия хангар) */ c.rotation.y = -Math.PI / 2; lvG.add(c); parked.push(c);
    }
    // мега/световен хъб: още широкофюзелажни самолети на отделния перон до хангарите
    if (AIR.hangar2) { let zr = 114; for (let k = 0; k < big - 5; k++) {   // air-hangar2: отделният перон на мега хъба — колона на югозапад от хангарите (на изток от x≈26 е коридорът за кацане), земята — продължена на юг
        const p = makePlane('wide', 7 + k), d = planeDims(p); p.position.set(18 - d.len / 2, p.userData.gearY, zr + d.span / 2); p.rotation.y = -Math.PI / 2; lvG.add(p); parked.push(p); zr += d.span + 5; }
      if (big > 5) { flat(70, zr - 105, mat(0x6f8f4e, 1), -5, 0.015, (105 + zr + 5) / 2, lvG); flat(56, zr - 108, mat(0x8a8d92, 0.9), -5, 0.03, (108 + zr) / 2, lvG); flat(8, 12, mat(0x3a3d42, 0.95), TW.x - 6, 0.035, 108, lvG); } }
    else for (let k = 0; k < big - 5; k++) { const p = makePlane('wide', 7 + k); p.position.set(TW.x - 4, p.userData.gearY, 140 + k * 40); p.rotation.y = -Math.PI / 2; lvG.add(p); parked.push(p); }
    if (sign) { sign.position.set(TERM.x - 6, 16, tz); }
  }
  // нощно осветление: прожекторни мачти на перона (сияние + светло петно), стробове на подхода, фарове на самолетите
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 1, 32, 32, 31); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.25, 'rgba(255,220,150,0.55)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return canvasTex(c); })();
  const glowM = new THREE.SpriteMaterial({ map: glowTex, color: 0xffe2a8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const poolM = new THREE.MeshBasicMaterial({ color: 0xffd890, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const strobeM = new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const nightG = new THREE.Group(); g.add(nightG);
  for (const z of [-80, -40, 0, 40, 80]) {   // мачти между терминала и рулежката
    const x = TERM.x + 20;
    box(0.5, 18, 0.5, mat(0x666a70, 0.6, 0.4), x, 9, z, nightG); box(3, 0.6, 1, mat(0xdddddd, 0.4, 0, 0xfff0c0), x, 18, z, nightG);
    const s = new THREE.Sprite(glowM); s.position.set(x, 18.2, z); s.scale.set(9, 9, 1); nightG.add(s);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(16, 24).rotateX(-Math.PI / 2), poolM); pool.position.set(x + 4, 0.08, z); nightG.add(pool);
  }
  const strobes = [];
  for (let k = 0; k < 8; k++) for (const end of [-1, 1]) {   // подходните светлини пред двата края на пистата
    const z = end < 0 ? RW.z0 - 12 - k * 10 : RW.z1 + 12 + k * 10, s = new THREE.Sprite(strobeM.clone()); s.position.set(RW.x, 0.8, z); s.scale.set(4, 4, 1); s.userData.k = k; nightG.add(s); strobes.push(s);
  }
  const lamp = () => { const s = new THREE.Sprite(glowM.clone()); s.scale.set(7, 7, 1); return s; };
  const sign = deps.label ? deps.label('✈️ ЛЕТИЩЕ', '#ffffff', 12) : null;
  if (sign) g.add(sign);
  setLevel(opts.lv || 1);

  // движещи се самолети: кацащ и излитащ, по график с период T секунди
  const T = 70, gy = k => PLANE_KINDS[k].r + PLANE_KINDS[k].r * 0.8;
  const land = makePlane('a320', 2), take = makePlane('wide', 4); g.add(land, take);
  const fars = [land, take].map(p => { const s = lamp(); s.position.set(0, -0.2, (p.userData.len || 26) * 0.55); p.add(s); return s; });   // фарът на носа
  const LAND = [   // [t, x, y, z, yaw, pitch]
    [0, RW.x, 90, RW.z1 + 700, Math.PI, -0.06], [16, RW.x, gy('a320'), RW.z1 - 6, Math.PI, -0.03], [17, RW.x, gy('a320'), RW.z1 - 14, Math.PI, 0],
    [27, RW.x, gy('a320'), RW.z0 + 20, Math.PI, 0], [31, (RW.x + TW.x) / 2, gy('a320'), RW.z0 + 14, Math.PI * 1.5, 0], [34, TW.x, gy('a320'), RW.z0 + 14, 0, 0],
    [52, TW.x, gy('a320'), RW.z1 - 20, 0, 0], [56, TERM.x + 15, gy('a320'), RW.z1 - 20, -Math.PI / 2, 0], [57, TERM.x + 15, gy('a320'), RW.z1 - 20, -Math.PI / 2, 0, 1], [T, TERM.x + 15, gy('a320'), RW.z1 - 20, -Math.PI / 2, 0, 1],
  ];
  const TAKE = [
    [0, TERM.x + 15, gy('wide'), RW.z1 - 14, Math.PI / 2, 0, 1], [27, TERM.x + 15, gy('wide'), RW.z1 - 14, Math.PI / 2, 0, 1], [27.01, TERM.x + 15, gy('wide'), RW.z1 - 14, Math.PI / 2, 0], [31, TW.x, gy('wide'), RW.z1 - 14, Math.PI / 2, 0],
    [35, RW.x, gy('wide'), RW.z1 - 14, Math.PI * 0.5, 0], [38, RW.x, gy('wide'), RW.z1 - 18, Math.PI, 0],
    [50, RW.x, gy('wide'), RW.z0 + 40, Math.PI, 0], [54, RW.x, 10, RW.z0 - 20, Math.PI, 0.16], [T, RW.x, 160, RW.z0 - 800, Math.PI, 0.12],
  ];
  const fly = (p, keys, t) => {
    const [, x, y, z, yaw, pitch] = sample(keys, t % T), tt = t % T;
    let k = 0; while (k < keys.length - 1 && keys[k + 1][0] <= tt) k++;
    p.visible = !keys[k][6];   // скрит (в хангара/зад терминала) — без да потъва под земята
    p.position.set(x, y, z); p.rotation.set(0, 0, 0); p.rotateY(yaw); p.rotateX(-pitch);
  };

  function update(t, night = 0) {
    { const dt = lastT == null ? 0 : Math.min(0.2, Math.max(0, t - lastT)); lastT = t; moveTraffic(dt); }
    fly(land, LAND, t); fly(take, TAKE, t + T * 0.5);
    // малките самолети по другите писти: подход от юг → пробег → излитане на север (цикъл T2 s)
    for (const sp of smalls) { const { x, z0, z1, ph } = sp.userData.rw, T2 = 46, u = ((t / T2 + ph) % 1), gy = sp.userData.gearY;
      let y, z, pitch;
      if (u < 0.3) { const k = u / 0.3; z = z1 + 520 * (1 - k); y = gy + 70 * (1 - k) ** 1.6; pitch = -0.07; }
      else if (u < 0.65) { const k = (u - 0.3) / 0.35; z = z1 - (z1 - z0 - 30) * k; y = gy; pitch = 0; }
      else { const k = (u - 0.65) / 0.35; z = z0 + 30 - 600 * k; y = gy + 110 * k ** 1.5; pitch = 0.13 * Math.min(1, k * 4); }
      sp.position.set(x, y, z); sp.rotation.set(0, 0, 0); sp.rotateY(Math.PI); sp.rotateX(-pitch); sp.visible = u < 0.98;
      for (const n of sp.userData.nav) n.material.emissiveIntensity = night * (Math.sin(t * 4) > 0.6 ? 1.5 : 0.5); }
    for (const m of lights) m.emissiveIntensity = 0.2 + 2.2 * night;
    for (const m of windows) m.emissiveIntensity = 0.05 + 1.8 * night;
    winM.emissiveIntensity = 1.6 * night;
    for (const m of towerMats) m.emissiveIntensity = 0.55 * night;
    for (const s of towerGlows) s.material.opacity = 0.7 * night;
    const blink = Math.sin(t * 4) > 0.6 ? 1 : 0;
    for (const m of beacons) m.emissiveIntensity = 0.3 + 2 * blink;
    for (const p of [land, take, ...parked]) for (const n of p.userData.nav) n.material.emissiveIntensity = night * (0.5 + blink);
    glowM.opacity = night * 0.95; poolM.opacity = night * 0.16;
    for (const f of fars) f.material.opacity = night;
    const seq = (t * 8) % 12;   // „бягащата“ светлина към пистата
    for (const s of strobes) s.material.opacity = night * (Math.abs(seq - (7 - s.userData.k)) < 0.6 ? 1 : 0.15);
  }
  function setPos(x, z) { g.position.set(x, 0, z); }
  function dispose() { group.remove(g); }
  // за клик: дали точка (световни координати) е върху летището
  const hit = (px, pz) => px > g.position.x - 30 && px < g.position.x + 60 + Math.max(0, lv - 1) * 26 && pz > g.position.z - 115 && pz < g.position.z + 120;
  const refresh = () => { const n = lv; lv = 0; setLevel(n); };   // след като се заредят терминалите
  return { group: g, update, setLevel, setPos, dispose, hit, refresh, get level() { return lv; } };
}
