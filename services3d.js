// services3d.js — 🏛️ обществените сгради в 3D (част D; регистърът — services.js). Всяка услуга се строи на свой парцел
// с лице към улицата: локално x — ширината, z — дълбочината, улицата е откъм +z (лицето). Сградата стои назад, отпред —
// площад / алея за линейки / площадка за пожарните / паркинг / двор. Моделите: civic2 (s/m/l) и civic (GLB), останалите
// (парк, детска градина, зала, депа, рециклиране) — процедурни. Регионален вариант — по региона (цветове и настилки) и seed.
// buildService(k, lvl, lot { w, d }, { seed, region }) → { group, ready: Promise, setNight(on), dispose() }.
// demoServices(tier) — Лабораторията: всички услуги на града от този размер, на мостра от парцели край улица.
import * as THREE from 'three';
import { canvasTex } from './texdata.js';   // fac-data (T1): статичните платна → собствени данни (не се губят)
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SERVICES, baseFor, districtFor, modelOf, TIER_NM } from './services.js';
import { emergCar } from './vehmodels.js';
import { prepNightFloors } from './nightfloors.js';
import { feature } from './lab/feature.js';
import { pickPart } from './blkcut.js';

const cache = {}, loader = new GLTFLoader(), SHARED = new WeakSet();
const load = p => cache[p] || (cache[p] = loader.loadAsync(p).then(g => { prepNightFloors(g.scene, 'svc-' + p.split('/').pop().replace('.glb', ''));   /* нощем — прозорците (nightfloors.js, флаг night-civic) */ g.scene.traverse(o => { if (o.geometry) SHARED.add(o.geometry); for (const m of o.material ? [].concat(o.material) : []) SHARED.add(m); }); return g; }).catch(() => null));
// регионални палитри: настилка на площада, покриви/фасади на процедурните, цвят на пейки/огради
const REG = {
  eu: { pave: '#cbc3b2', wall: 0xe8e0d0, roof: 0x8a4b3a, trim: 0x3f5a3a }, us: { pave: '#c9c9c4', wall: 0xd8d6d0, roof: 0x4f5b66, trim: 0x2e3f5a },
  ru: { pave: '#b9b5ad', wall: 0xe9dcc4, roof: 0x3f6b4a, trim: 0x6b2f2f }, asia: { pave: '#d4cbbb', wall: 0xf0ece4, roof: 0x7a2f2a, trim: 0x2f5a5a },
  me: { pave: '#e0d2b4', wall: 0xeadbbd, roof: 0xc9b48c, trim: 0x2f6b8a }, af: { pave: '#d8c4a0', wall: 0xe6d2b0, roof: 0x9a6a3a, trim: 0x3a6b3a }, la: { pave: '#d6c8b0', wall: 0xf2e6cc, roof: 0xb0553a, trim: 0x2f7a5a },
};
const fit = (o, w, d, h) => { o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  let k = Math.min(w / s.x, d / s.z); if (h && s.y * k > h) k = h / s.y; const g = new THREE.Group(); o.position.set(-c.x, -b.min.y, -c.z); g.add(o); g.scale.setScalar(k); const out = new THREE.Group(); out.add(g); out.userData.sz = [s.x * k, s.y * k, s.z * k]; return out; };

export function buildService(k, lvl, lot, opt = {}) {
  const S0 = SERVICES[k], R = REG[opt.region] || REG.eu, seed = opt.seed || 0, group = new THREE.Group(), own = [], glows = [];
  const M = (c, ex = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...ex }); own.push(m); return m; };
  const box = (w, h, d, m, x, y, z, par = group) => { const g = new THREE.BoxGeometry(w, h, d); own.push(g); const o = new THREE.Mesh(g, m); o.position.set(x, y + h / 2, z); o.castShadow = o.receiveShadow = true; par.add(o); return o; };
  const cyl = (r, h, m, x, y, z, seg = 12) => { const g = new THREE.CylinderGeometry(r, r, h, seg); own.push(g); const o = new THREE.Mesh(g, m); o.position.set(x, y + h / 2, z); o.castShadow = true; group.add(o); return o; };
  const flat = (w, d, m, x, z, y = 0.02) => { const g = new THREE.PlaneGeometry(w, d); own.push(g); const o = new THREE.Mesh(g, m); o.rotation.x = -Math.PI / 2; o.position.set(x, y, z); o.receiveShadow = true; group.add(o); return o; };
  const tex = (draw, rep) => { const c = document.createElement('canvas'); c.width = c.height = 256; draw(c.getContext('2d'), 256); const t = canvasTex(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); own.push(t); return t; };
  const paving = (w, d) => M(0xffffff, { map: tex((g, n) => { g.fillStyle = R.pave; g.fillRect(0, 0, n, n); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); } }, [w / 6, d / 6]) });
  const asphalt = M(0x3d4045, { roughness: 0.95 }), grass = M(0x6d9a4a), white = M(0xf2f2f2);
  const { w, d } = lot, front = d / 2, back = -d / 2;
  const tasks = [];
  // GLB сграда в задната част на парцела (дълбочина depthK от парцела)
  // opt.fill (градовете по истинската карта): GLB-то заема повече от парцела; opt.minH — най-малката височина спрямо фоновите блокове наоколо
  // (кметство/болница/университет — колкото блок, полиция/пожарна/училище — 0,8, другите — 0,6); по-ниските се изтеглят нагоре (до ×2,5), без да излизат от парцела
  const HK = { hall: 1, hosp: 1, uni: 1, police: 1, fire: 0.8, school: 0.8, voc: 0.8 };
  const glb = (path, depthK = 0.6, wK = 0.9, maxH, gy = false) => tasks.push(load(path).then(g => { if (!g) return; if (opt.fill) { depthK = Math.max(depthK, 0.72); wK = 0.95; } const o = gy ? fit(pickPart(g.scene, -0.76, 0.5, -0.66, 0.66), w * 0.62, d * 0.9, maxH) /* school-fit: само главният корпус (салонът с колоните) — вдясно, по цялата дълбочина */ : fit(g.scene.clone(true), w * wK, d * depthK, maxH), nat = feature('school-fit') && (k === 'school' || k === 'voc');   /* school-fit (55): училището — в естествените пропорции на модела (без разтягане по фасадата и на височина), колкото се побира в парцела */
    if (opt.fill && !nat && o.userData.sz[0] < w * wK * 0.8) { const sx = Math.min(1.8, w * wK / o.userData.sz[0]); o.scale.x *= sx; o.userData.sz[0] *= sx; }   // тесният модел — по-широк по фасадата (болница/училище — дълги сгради)
    const tH = opt.hAbs || (opt.minH || 0) * (HK[k] ?? 0.6); if (tH && !nat && o.userData.sz[1] < tH) { const sy = Math.min(opt.hAbs ? 3.5 : 2.2, tH / o.userData.sz[1]);   /* opt.hAbs — по блоковете наоколо (servicesplace.js), до ×3,5 */ o.scale.y *= sy; o.userData.sz[1] *= sy; } o.position.z = back + o.userData.sz[2] / 2 + 1; if (gy) o.position.x = w / 2 - o.userData.sz[0] / 2 - 1; o.traverse(q => { if (q.isMesh) { q.castShadow = q.receiveShadow = true; } }); group.add(o); return o; }));
  // trees-more: истинско дърво (протото от играта — opt.trees), височина ~8·s м; геометриите са общи (SHARED — dispose() не ги пипа)
  const TP = feature('trees-more') && opt.trees && opt.trees.length ? opt.trees : null;
  const tree = (x, z, s = 1) => { if (TP) { const P = TP[Math.abs(Math.round(x * 7 + z * 13 + (opt.seed || 0))) % TP.length], o = P.clone(true); o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(P), h = (b.max.y - b.min.y) || 1;
      o.scale.multiplyScalar(8 * s / h); o.position.set(x, 0, z); o.rotation.y = (x * 3.1 + z * 1.7) % 6.28; o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; if (m.geometry) SHARED.add(m.geometry); } }); group.add(o); return o; }
 const t = cyl(0.18 * s, 2.2 * s, M(0x6b4a2a), x, 0, z, 6); const cr = new THREE.SphereGeometry(1.5 * s, 10, 8); own.push(cr); const o = new THREE.Mesh(cr, M(0x4f7f3a)); o.position.set(x, 3 * s, z); o.castShadow = true; group.add(o); return t; };
  const bench = (x, z, ry = 0) => { const b = box(1.6, 0.45, 0.5, M(R.trim), x, 0, z); b.rotation.y = ry; };
  const cars = (kind, n, z0) => tasks.push(load({ ambulance: 'assets/heavy/cars/amb-eu.glb', fire: 'assets/heavy/cars/fire-man.glb', police: 'assets/heavy/cars/pol-crownvic.glb' }[kind]).then(g => { if (!g) return; for (let i = 0; i < n; i++) { const c = emergCar(g.scene, kind === 'fire' ? 10.5 : kind === 'ambulance' ? 7 : 5.2, kind, kind === 'ambulance' ? 'amb-eu' : ''); c.position.set(-((n - 1) * 3.6) / 2 + i * 3.6, 0, z0); c.rotation.y = Math.PI; group.add(c); } }));

  // ---- по вид
  if (k === 'hall') {   // кметство отзад, площад отпред (фонтан, знамена, пейки, дървета)
    const pd = d * 0.45; flat(w, pd, paving(w, pd), 0, front - pd / 2, 0.03);
    // hall-gilded: площадът отпред — по-широк (на свободното пред кметството)
    // гранитни плочи 1×1 м с тъмни фуги и рамка — да се различава от земята (в Париж бежовият R.pave се сливаше с пясъка)
    const granite = (w2, d2) => M(0xffffff, { map: tex((g, n) => { const c = n / 8; g.fillStyle = '#77736c'; g.fillRect(0, 0, n, n); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = 168 + Math.floor(Math.random() * 26); g.fillStyle = `rgb(${v},${v - 3},${v - 8})`; g.fillRect(x * c + 1.5, y * c + 1.5, c - 3, c - 3); } }, [w2 / 8, d2 / 8]) });
    if (lvl === 'l' && opt.hallTop) { flat(88, pd * 1.6 + 2, M(0x6f6a62), 0, front - pd * 0.8, 0.04); flat(86, pd * 1.6, granite(86, pd * 1.6), 0, front - pd * 0.8, 0.045); }
    // hall-gilded (T2): в големите европейски градове главното кметство (ниво l) — „Позлатената катедрала“ на потребителя (Meshy); нощем фасадата и куполът светят топло
    if (lvl === 'l' && opt.hallTop) { group.userData.gildHall = true; glb(opt.hallTop, 0.55, 0.92); const i = tasks.length - 1; tasks[i] = tasks[i].then(o => { if (!o) return; o.traverse(m => { if (m.isMesh && m.material && m.material.map && !glows.includes(m.material) && !m.userData.gild) { m.userData.gild = 1; m.material = m.material.clone(); m.material.emissive = new THREE.Color(0x6a5434); m.material.emissiveMap = m.material.map; m.material.emissiveIntensity = group.userData.nightOn ? 1.4 : 0; glows.push(m.material); } });
      // по-голяма от парцела: ~80 м по фасадата (като истинско Hôtel de Ville) — назад, отпред остава площадът
      /* одитът №5: само самият модел (беше group.traverse — хващаше и паважа на площада, и него уголемяваше вместо сградата) */
      const b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3()), kk = 80 / Math.max(sz.x, sz.z, 1); if (kk <= 1) return;
      o.scale.multiplyScalar(kk); o.updateMatrixWorld(true); const b2 = new THREE.Box3().setFromObject(o); o.position.z += (front - pd) - b2.max.z; o.position.y -= b2.min.y; }); }
    else glb(modelOf(k, lvl, seed), 0.5, 0.8);
    const fz = front - pd / 2; cyl(2.4, 0.5, M(0xb8b2a6), 0, 0, fz, 24); const wt = cyl(2.1, 0.06, M(0x6fa8c8, { roughness: 0.15, metalness: 0.2 }), 0, 0.45, fz, 24); cyl(0.25, 1.6, M(0xb8b2a6), 0, 0.5, fz);
    for (const x of [-w * 0.3, w * 0.3]) { cyl(0.06, 9, M(0xdddddd, { metalness: 0.6 }), x, 0, fz - pd * 0.3); box(1.4, 0.9, 0.02, M([0x2e5aa8, 0xc62828, 0xf2f2f2][seed % 3]), x + 0.75, 7.6, fz - pd * 0.3); }
    for (const x of [-w * 0.38, w * 0.38]) { tree(x, front - 2.5); bench(x * 0.6, front - 2.5); }
  } else if (k === 'hosp') {   // болница, алея за линейки до улицата, паркинг; голямата — хеликоптерна площадка
    glb(modelOf(k, lvl, seed), 0.62, 0.92);
    flat(8, d * 0.38, asphalt, w * 0.25, front - d * 0.19, 0.03); flat(w * 0.45, d * 0.25, asphalt, -w * 0.22, front - d * 0.15, 0.03);
    for (let i = 0; i < 6; i++) flat(0.12, 4.6, white, -w * 0.4 + i * 2.6, front - d * 0.15, 0.04);
    cars('ambulance', lvl === 's' ? 1 : 2, front - d * 0.2);
    if (lvl === 'l') { const hp = cyl(4, 0.2, M(0x58606a), -w * 0.32, 0, back + 5, 24); flat(3, 0.5, white, -w * 0.32, back + 5, 0.22); flat(0.5, 3, white, -w * 0.32 - 1, back + 5, 0.22); flat(0.5, 3, white, -w * 0.32 + 1, back + 5, 0.22); }
    const cross = box(1.6, 1.6, 0.1, M(0xd32f2f, { emissive: 0xd32f2f, emissiveIntensity: 0 }), w * 0.42, 5, front - d * 0.42); glows.push(cross.material);
  } else if (k === 'fire') {   // станция и червена площадка пред гаражите — директно към улицата
    glb(modelOf(k, lvl, seed), 0.6, 0.9);
    const apron = M(0x9a3a32, { roughness: 0.9 }); flat(w * 0.7, d * 0.4, apron, 0, front - d * 0.2, 0.03);
    for (let i = 0; i < 5; i++) flat(0.4, d * 0.38, M(0xf2c94c), -w * 0.33 + i * w * 0.165, front - d * 0.2, 0.04);
    cars('fire', lvl === 's' ? 1 : 2, front - d * 0.24);
  } else if (k === 'police') {   // участък и паркинг с патрулки
    const pk = opt.fill ? 0.18 : 0.3;   // на истинската карта: сградата — по-голяма (0,8 от дълбочината), паркингът — по-плитък
    glb(modelOf(k, lvl, seed), opt.fill ? 0.8 : 0.62, 0.9); flat(w * 0.8, d * pk, asphalt, 0, front - d * pk / 2, 0.03);
    for (let i = 0; i < 5; i++) flat(0.12, d * pk * 0.8, white, -w * 0.3 + i * w * 0.15, front - d * pk / 2, 0.04);
    cars('police', lvl === 's' ? 2 : 3, front - d * pk / 2);
  } else if (k === 'school' || k === 'voc') {   // училище, двор с игрище и ограда
    const mp = modelOf(k, lvl, seed), gy = feature('school-fit') && (!mp || /civic\/school\.glb$/.test(mp)), cw = gy ? 0.34 : 0.5, cx = gy ? -0.32 : -0.15;   // school-fit (55): от school.glb — само корпусът (вдясно), игрището — вляво
    glb(mp || 'assets/heavy/civic/school.glb', 0.55, 0.85, undefined, gy);
    const court = M(k === 'voc' ? 0x4a7a9a : 0xb5523a); flat(w * cw, d * 0.28, court, w * cx, front - d * 0.2, 0.03);
    flat(w * cw * 0.8, 0.1, white, w * cx, front - d * 0.2, 0.05); for (const x of [w * (cx - cw * 0.46), w * (cx + cw * 0.46)]) box(0.1, 3, 1.6, white, x, 0, front - d * 0.2);
    for (let x = -w / 2; x <= w / 2; x += 2.5) box(0.06, 1.4, 0.06, M(0x3a3a3a, { metalness: 0.6 }), x, 0, front - 0.3); box(w, 0.06, 0.06, M(0x3a3a3a), 0, 1.35, front - 0.3);
    for (const x of gy ? [-w * 0.42, -w * 0.24] : [w * 0.32, w * 0.42]) tree(x, gy ? back + d * 0.18 : front - d * 0.2, 0.9);
    if (k === 'voc') { const sg = box(6, 1, 0.2, M(0x1d2a38), gy ? w * cx : w * 0.2, 0, front - d * (gy ? 0.04 : 0.35)); }
  } else if (k === 'kinder') {   // ниска сграда с цветни стени, площадка с пързалка и пясъчник
    const wallM = M([0xf2c94c, 0x7fc8a9, 0xf28c8c, 0x9ab8f2][seed % 4]), roofM = M(R.roof);
    box(w * 0.7, 3.6, d * 0.4, wallM, 0, 0, back + d * 0.22); box(w * 0.74, 0.5, d * 0.44, roofM, 0, 3.6, back + d * 0.22);
    for (let i = 0; i < 5; i++) { const g = box(1.3, 1.3, 0.1, M(0x9fd0ef, { emissive: 0xffe2a8, emissiveIntensity: 0 }), -w * 0.28 + i * w * 0.14, 1.2, back + d * 0.43); glows.push(g.material); }
    flat(w * 0.9, d * 0.45, M(0x7fae5a), 0, front - d * 0.26, 0.03); flat(4, 4, M(0xe6d29a), -w * 0.25, front - d * 0.22, 0.05);
    const sl = box(0.8, 0.1, 4, M(0xe53935), w * 0.15, 1, front - d * 0.25); sl.rotation.x = 0.45; box(0.9, 2, 0.9, M(0x1e88e5), w * 0.15, 0, front - d * 0.25 - 1.9);
    for (let x = -w / 2; x <= w / 2; x += 1.6) box(0.05, 1.1, 0.05, M(0xffffff), x, 0, front - 0.3);
  } else if (k === 'park') {   // морава, алеи на кръст, фонтан, дървета, пейки, детска площадка
    flat(w, d, grass, 0, 0, 0.03); const path = M(0xd8cdb4); flat(w, 2.4, path, 0, 0, 0.05); flat(2.4, d, path, 0, 0, 0.05);
    tasks.push(load('assets/heavy/plants/fountain.glb').then(g => { if (!g) return; const o = fit(g.scene.clone(true), 5, 5); group.add(o); }));
    const n = Math.round(w * d / 70); for (let i = 0; i < n; i++) { const x = (Math.random() - 0.5) * (w - 4), z = (Math.random() - 0.5) * (d - 4); if (Math.abs(x) < 2.5 || Math.abs(z) < 2.5) continue; tree(x, z, 0.9 + Math.random() * 0.5); }
    for (const [x, z, r] of [[3, 2, 0], [-3, -2, 0], [2, -3.2, 1.57], [-2, 3.2, 1.57]]) bench(x, z, r);
    if (lvl !== 's') { flat(6, 6, M(0xe6d29a), w * 0.3, -d * 0.3, 0.05); box(0.9, 2, 0.9, M(0x1e88e5), w * 0.3, 0, -d * 0.3); }
  } else if (k === 'sport' && lvl === 'l') { tasks.push(load('assets/heavy/stadium/stadium.glb').then(g => { if (!g) return; const o = fit(g.scene.clone(true), w * 0.95, d * 0.95); group.add(o); }));
  } else if (k === 'sport') {   // спортна зала: полуцилиндричен покрив, паркинг
    const hall = M(R.wall), roof = M(0x9aa4ae, { metalness: 0.4, roughness: 0.4 }); box(w * 0.8, 6, d * 0.55, hall, 0, 0, back + d * 0.3);
    const rg = new THREE.CylinderGeometry(d * 0.29, d * 0.29, w * 0.82, 20, 1, false, 0, Math.PI); own.push(rg); const r = new THREE.Mesh(rg, roof); r.rotation.set(0, 0, Math.PI / 2); r.position.set(0, 6, back + d * 0.3); r.castShadow = true; group.add(r);
    flat(w * 0.8, d * 0.3, asphalt, 0, front - d * 0.16, 0.03);
  } else if (k === 'bus') {   // хале, перони със спирки, автобуси
    box(w * 0.85, 5, d * 0.35, M(R.wall), 0, 0, back + d * 0.2); flat(w * 0.9, d * 0.55, asphalt, 0, front - d * 0.3, 0.03);
    for (let i = 0; i < 3; i++) { box(w * 0.7, 0.2, 1.2, M(0xbdbdbd), 0, 0, front - d * 0.15 - i * 5); box(w * 0.7, 0.1, 1.6, M(0x9fc6dc, { transparent: true, opacity: 0.6 }), 0, 2.8, front - d * 0.15 - i * 5); }
    tasks.push(load('assets/heavy/cars/bus-citaro.glb').then(g => { if (!g) return; for (let i = 0; i < 3; i++) { const o = fit(g.scene.clone(true), 2.6, 12); o.rotation.y = Math.PI / 2; o.position.set(-w * 0.15 + i * 4, 0, front - d * 0.15 - 2.5 - (i % 2) * 5); group.add(o); } }));
  } else if (k === 'util' || k === 'recycle') {   // депо: хале, двор с камиони/контейнери; рециклиране — бункери и ленти
    box(w * 0.6, k === 'recycle' ? 8 : 6, d * 0.45, M(k === 'recycle' ? 0x5f8f5f : 0xb8b2a6), -w * 0.15, 0, back + d * 0.25); flat(w, d * 0.5, M(0x8f8a80), 0, front - d * 0.25, 0.03);
    for (let i = 0; i < 4; i++) box(2.4, 2.2, 5, M([0x2e7d32, 0x1565c0, 0xf9a825, 0x6d4c41][i]), -w * 0.3 + i * 3.2, 0, front - d * 0.25);
    if (k === 'recycle') for (let i = 0; i < 3; i++) cyl(1.6, 7, M(0x9aa4ae, { metalness: 0.5 }), w * 0.32, 0, back + 4 + i * 4.2, 16);
  } else if (k === 'uni') {   // университет: главна сграда отзад, ливада и алея
    flat(w, d * 0.4, grass, 0, front - d * 0.2, 0.03); flat(3, d * 0.4, M(0xd8cdb4), 0, front - d * 0.2, 0.05);
    box(w * 0.7, 14, d * 0.35, M(R.wall), 0, 0, back + d * 0.2); for (let i = 0; i < 8; i++) cyl(0.5, 10, M(0xf2ede2), -w * 0.3 + i * w * 0.085, 0, back + d * 0.39);
    box(w * 0.74, 1.2, d * 0.38, M(R.roof), 0, 14, back + d * 0.2); for (const x of [-w * 0.35, w * 0.35]) tree(x, front - 3);
  }
  // граница на парцела (тънка линия) — за преглед в Лабораторията
  if (opt.outline) { const e = new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, d)); own.push(e); const l = new THREE.LineSegments(e, new THREE.LineBasicMaterial({ color: 0xffd54a })); own.push(l.material); l.rotation.x = -Math.PI / 2; l.position.y = 0.08; group.add(l); }
  return { group, ready: Promise.all(tasks), setNight(on) { group.userData.nightOn = on; for (const m of glows) m.emissiveIntensity = on ? 1.4 : 0; },
    dispose() { group.parent && group.parent.remove(group); for (const x of own) x.dispose && x.dispose(); group.traverse(o => { if (o.geometry && !SHARED.has(o.geometry) && !own.includes(o.geometry)) o.geometry.dispose(); }); } };
}

// ---- 🧪 Лабораторията: всички услуги на град от размер tier, по парцели край улица (лице към улицата)
let demoEl = null;
export async function demoServices(tier = 'm') {
  demoEl && demoEl.close();
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
  const el = document.createElement('div'); el.id = 'svcDemo3d'; el.style.cssText = 'position:fixed;inset:0;z-index:9790;background:#0b1220;font:600 14px system-ui;color:#fff';
  el.innerHTML = `<div style="position:absolute;left:12px;top:10px;z-index:2;display:flex;gap:6px;align-items:center"><b>🏛️ Обществените сгради — ${TIER_NM[tier]} град</b>${['s', 'm', 'l', 'x'].map(t => `<button data-t="${t}" style="border:0;border-radius:8px;padding:6px 10px;cursor:pointer;background:${t === tier ? '#ffd54a' : '#1d2a42'};color:${t === tier ? '#111' : '#fff'}">${TIER_NM[t]}</button>`).join('')}<button data-x style="border:0;border-radius:8px;padding:6px 10px;cursor:pointer">✕</button></div><div class="lbs"></div>`;
  document.body.appendChild(el); window.__overlay3d = (window.__overlay3d || 0) + 1;
  const r = new THREE.WebGLRenderer({ antialias: true }); r.setPixelRatio(Math.min(devicePixelRatio, 1.75)); r.setSize(innerWidth, innerHeight); r.outputColorSpace = THREE.SRGBColorSpace; r.shadowMap.enabled = true; el.prepend(r.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xb7cde0); scene.add(new THREE.HemisphereLight(0xffffff, 0x666655, 1.1)); const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(-60, 90, 50); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, far: 300 }); scene.add(sun);
  const cam = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 1200); const ctl = new OrbitControls(cam, r.domElement);
  const g0 = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshStandardMaterial({ color: 0x7d8f62 })); g0.rotation.x = -Math.PI / 2; g0.receiveShadow = true; scene.add(g0);
  // улица по X (z = 0); парцелите — от двете страни, с лице към нея
  const list = [...baseFor(tier).flatMap(b => Array(Math.min(b.n, 2)).fill({ k: b.k, lvl: b.lvl })), ...districtFor(tier).map(b => ({ k: b.k, lvl: b.lvl, district: true }))];
  const items = []; let xs = [-8, -8]; const labels = el.querySelector('.lbs');
  list.forEach((it, i) => { const S0 = SERVICES[it.k], [w, d] = S0.lot[it.lvl] || Object.values(S0.lot).pop(), side = S0.road === 'main' ? 0 : i % 2 ? 1 : 0, x = xs[side] + w / 2;
    xs[side] += w + 4; const b = buildService(it.k, it.lvl, { w, d }, { seed: i, region: 'eu', outline: true }); b.group.position.set(x, 0, side ? -(8 + d / 2) : 8 + d / 2); b.group.rotation.y = side ? 0 : Math.PI; scene.add(b.group); items.push(b);
    const lb = document.createElement('div'); lb.style.cssText = 'position:absolute;transform:translate(-50%,-100%);padding:3px 8px;border-radius:999px;background:#000b;font:700 12px system-ui;white-space:nowrap;pointer-events:none'; lb.textContent = `${S0.ico} ${it.district ? S0.dnm || S0.nm : S0.nm} · ${it.lvl}${S0.road === 'main' ? ' · основна улица' : ''}`; labels.appendChild(lb); b.lb = [lb, new THREE.Vector3(x, 14, b.group.position.z)]; });
  const L = Math.max(...xs); const road = new THREE.Mesh(new THREE.PlaneGeometry(L + 40, 12), new THREE.MeshStandardMaterial({ color: 0x3b3e44 })); road.rotation.x = -Math.PI / 2; road.position.set(L / 2 - 10, 0.02, 0); road.receiveShadow = true; scene.add(road);
  ctl.target.set(L / 2 - 10, 0, 0); cam.position.set(L / 2 - 10, Math.max(80, L * 0.45), Math.max(90, L * 0.5)); ctl.update();
  let raf = 0, shut = false; const v = new THREE.Vector3();
  const frame = () => { if (shut) return; raf = requestAnimationFrame(frame); ctl.update(); for (const b of items) { const [lb, p] = b.lb; v.copy(p).project(cam); lb.style.display = v.z > 1 ? 'none' : ''; lb.style.left = `${(v.x + 1) / 2 * innerWidth}px`; lb.style.top = `${(1 - v.y) / 2 * innerHeight}px`; } r.render(scene, cam); };
  frame();
  const close = () => { if (shut) return; shut = true; cancelAnimationFrame(raf); for (const b of items) b.dispose(); ctl.dispose(); r.dispose(); r.forceContextLoss(); el.remove(); window.__overlay3d = Math.max(0, (window.__overlay3d || 1) - 1); demoEl = null; };
  el.querySelector('[data-x]').onclick = close; el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => demoServices(b.dataset.t));
  demoEl = { close }; window.__svcDemo = { scene, renderer: r }; return demoEl;
}
