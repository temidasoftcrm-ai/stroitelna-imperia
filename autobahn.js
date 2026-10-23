// autobahn.js — Фаза 9: аутобани (международни коридори). 3D изглед на участък: по 6 платна във всяка посока,
// разделителна ивица, мост над река и тунел в хълма, червено-бели мантинели, портални табели и много движение.
// game.js ползва: AB_STAGES, AB_COST_MUL, AB_TOLL_MUL, AB_FULL_BONUS, AB_MAT_DISC, AB_MODELS, buildAutobahnView(A, opts).
import * as THREE from 'three';
import { loadMountains, mtnModel } from './mtn.js';
import { makeWater } from './water.js';

export const AB_STAGES = [
  { nm: 'Земни работи', ico: '🚜', need: { bulldozer: 2, grader: 1, truck: 3, crew: 2 } },
  { nm: 'Мостове и тунели', ico: '🌉', need: { crane: 2, truck: 2, crew: 3 } },
  { nm: 'Пътна основа', ico: '🪨', need: { grader: 2, roller: 2, truck: 3, crew: 2 } },
  { nm: 'Асфалт', ico: '🛣️', need: { paver: 2, roller: 3, truck: 2, crew: 3 } },
  { nm: 'Мантинели и табели', ico: '🚧', need: { marker: 2, crane: 1, crew: 3 } },
];
export const AB_COST_MUL = 2.5;      // строежът е 2.5 пъти по-скъп от магистрала
export const AB_TOLL_MUL = 3;        // тол таксата е 3 пъти по-висока
export const AB_FULL_BONUS = 0.5;    // +50% тол, когато целият коридор е готов
export const AB_MAT_DISC = 0.30;     // −30% за материали, докарани по готов аутобан
// Модели, които трябва да са заредени в A (колите и камионите вече се зареждат от game.js)
export const AB_MODELS = { vehicles: ['sf-car-Sedan', 'sf-car-SUV', 'sf-car-Taxi', 'sf-car-Van', 'sf-car-Hatchback', 'sf-car-Pickup', 'sf-car-Muscle', 'sf-car-Police_Sedan'],   // истинските коли (vehmodels.js, в метри); детските — само ако истинските липсват
  // техниката — истинските модели от vehmodels.js (sf-excavator, sf-backhoe, sf-grader, sf-dump, sf-mcrane — зарежда ги game.js); ако липсват — процедурните машини по-долу
  heavy: [] };
// [модел, дължина в м, завъртане до „напред = +z“, оцветяване]
const HEAVY = {
  dozerA: ['sf-excavator', 8, 0], dozerB: ['sf-grader', 8, 0], dozerC: ['sf-backhoe', 6, 0],   // земните работи: багер, грейдер, трактор-багер (вместо детските булдозери)
  mine: ['sf-dump', 8, 0], dumpR: ['truck-dump-red', 8, 0], dumpG: ['truck-dump-green', 8, 0], mixer: ['truck-concrete-red', 8.2, 0],   // минният — истинският самосвал (vehmodels.js); червеният/зеленият и бетоновозът — истинските от construct.js
  loader: ['sf-backhoe', 5.5, 0], tower: ['crane-tower', 34, 0], mcrane: ['sf-mcrane', 11, 0],   // багер-товарачът и кулокранът — истинските
};

const LANES = 6, LW = 3.6, CW = LANES * LW, MED = 4, SH = 2.5;   // платна, ширина на платно, разделител, банкет
const W = (CW + SH) * 2 + MED;                                    // цялата ширина ≈ 52 м
const RIVER_W = 30;
const mat = (c, r = 0.9, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const M = { earth: mat(0x7a5a3a, 1), gravel: mat(0x9c968c, 1), concrete: mat(0xc9c6bd, 0.85), dark: mat(0x2a2a2c, 0.8), yel: mat(0xffb300, 0.55), steel: mat(0x9aa0a6, 0.35, 0.7), rock: mat(0x8c8a84, 1) };
const box = (w, h, d, m, x, y, z, g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
const reveal = (list, front) => { for (const o of list) o.visible = o.userData.z <= front; };

// асфалт с маркировка: 6 платна, прекъснати бели линии, плътни ръбове
function laneTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#3a3b3e'; g.fillRect(0, 0, 512, 256);
  for (let k = 0; k < 900; k++) { const v = 50 + Math.random() * 20 | 0; g.fillStyle = `rgb(${v},${v},${v + 2})`; g.fillRect(Math.random() * 512, Math.random() * 256, 2, 2); }
  g.fillStyle = '#f2f2ee';
  g.fillRect(4, 0, 8, 256); g.fillRect(500, 0, 8, 256);
  for (let l = 1; l < LANES; l++) { const x = 8 + l * (496 / LANES); for (let y = 0; y < 256; y += 64) g.fillRect(x - 3, y, 6, 36); }
  const t = new THREE.CanvasTexture(c); t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// червено-бяла мантинела (ивици)
function barrierTex() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 16;
  const g = c.getContext('2d');
  for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#ffffff' : '#d62828'; g.fillRect(k * 16, 0, 16, 16); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// синя портална табела над платната (два реда текст)
function gantrySign(text1, text2) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1e5fbf'; g.fillRect(0, 0, 1024, 256); g.strokeStyle = '#fff'; g.lineWidth = 10; g.strokeRect(10, 10, 1004, 236);
  g.fillStyle = '#d62828'; g.fillRect(30, 40, 150, 80); g.fillStyle = '#fff'; g.font = 'bold 64px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('E', 105, 82);
  g.font = 'bold 76px system-ui'; g.textAlign = 'left'; g.fillText(text1, 210, 84, 790);
  g.font = 'bold 56px system-ui'; g.fillText(text2, 210, 186, 790);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// машини (процедурни): асфалтополагач, валяк, самосвал
function makePaver() {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) box(0.7, 0.9, 4.6, M.dark, sx * 1.4, 0.45, 0, g);
  box(3.2, 1.3, 3.6, M.yel, 0, 1.4, 0.2, g); box(3.6, 0.2, 2, M.yel, 0, 1.1, 3, g);
  box(CW / 2 - 0.4, 0.5, 1, M.yel, 0, 0.35, -2.2, g); box(1.2, 0.6, 1, M.dark, 0, 2.4, -0.8, g);
  const b = box(0.25, 0.22, 0.25, new THREE.MeshStandardMaterial({ color: 0xff8a00, emissive: 0xff6a00, emissiveIntensity: 1 }), 0, 3.6, -0.8, g); b.castShadow = false;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.1, 1.4, 0.1, M.dark, sx * 0.9, 2.7, -0.8 + sz * 0.7, g);
  box(2.2, 0.12, 1.8, M.yel, 0, 3.45, -0.8, g);
  return g;
}
function makeRoller() {
  const g = new THREE.Group(), drums = [];
  for (const sz of [-1, 1]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.1, 20), M.steel); d.rotation.z = Math.PI / 2; d.position.set(0, 0.8, sz * 1.4); d.castShadow = true; g.add(d); drums.push(d); }
  box(1.8, 1, 1.8, M.yel, 0, 1.7, 0, g); box(1.6, 0.12, 1.4, M.yel, 0, 3.4, 0, g);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.1, 1.2, 0.1, M.dark, sx * 0.7, 2.8, sz * 0.6, g);
  g.userData.drums = drums;
  return g;
}
function makeDump(col) {
  const g = new THREE.Group();
  box(2.5, 2.2, 2.2, mat(col, 0.6), 0, 1.6, 3, g); box(2.5, 0.4, 7.5, M.dark, 0, 0.7, 0.3, g);
  box(2.6, 1.6, 5, mat(0xd08a1e, 0.7), 0, 1.9, -0.8, g);
  for (const z of [3, -0.6, -2.4]) for (const x of [-1.2, 1.2]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12).rotateZ(Math.PI / 2), M.dark); w.position.set(x, 0.55, z); g.add(w); }
  return g;
}
function wheels(g, xs, zs, r = 0.5) { for (const z of zs) for (const x of xs) { const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.4, 10).rotateZ(Math.PI / 2), M.dark); w.position.set(x, r, z); g.add(w); } }
function makeDozer() {   // булдозер: вериги, кабина, гребло отпред
  const g = new THREE.Group();
  for (const sx of [-1, 1]) box(0.8, 1, 4.2, M.dark, sx * 1.3, 0.5, 0, g);
  box(2.4, 1.2, 3, M.yel, 0, 1.5, -0.3, g); box(1.6, 1.3, 1.5, M.yel, 0, 2.7, -0.8, g); box(1.4, 0.8, 1.2, mat(0x6fa8c9, 0.2, 0.3), 0, 2.8, -0.75, g);
  box(3.6, 1.3, 0.3, M.steel, 0, 0.75, 2.6, g);
  return g;
}
function makeGrader() {   // грейдер: дълга рама, кабина отзад, нож по средата
  const g = new THREE.Group();
  box(1.2, 0.5, 7, M.yel, 0, 1.4, 0.5, g); box(2.2, 1.6, 2.2, M.yel, 0, 1.9, -2.2, g); box(1.8, 1, 1.6, mat(0x6fa8c9, 0.2, 0.3), 0, 2.9, -2.2, g);
  box(3.2, 0.6, 0.2, M.steel, 0, 0.6, 0.6, g); wheels(g, [-1.1, 1.1], [3.4, -1.8, -3.0], 0.55);
  return g;
}
function makeMixer() {   // бетоновоз с въртящ се барабан
  const g = new THREE.Group();
  box(2.4, 2, 2.2, mat(0xe8e8e8, 0.6), 0, 1.6, 3, g); box(2.4, 0.4, 7.5, M.dark, 0, 0.7, 0.3, g);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 4.4, 14).rotateX(Math.PI / 2 - 0.25), mat(0xff7a1a, 0.5)); drum.position.set(0, 2.4, -0.9); drum.castShadow = true; g.add(drum);
  wheels(g, [-1.2, 1.2], [3, -0.6, -2.4]); g.userData.drum = drum;
  return g;
}
function makeCrane() {   // автокран със стрела
  const g = new THREE.Group();
  box(2.6, 1.2, 9, M.yel, 0, 1.3, 0, g); box(2.4, 1.6, 2, M.yel, 0, 2.2, 3.6, g); wheels(g, [-1.25, 1.25], [3.6, 1.2, -1.6, -3.4]);
  const boom = new THREE.Group(); boom.position.set(0, 2.3, -2); g.add(boom);
  box(0.8, 0.8, 16, M.yel, 0, 0, 7.5, boom).rotation.x = 0; boom.rotation.x = -0.7;
  box(0.08, 6, 0.08, M.dark, 0, -3, 15.4, boom).rotation.x = 0.7;
  g.userData.boom = boom;
  return g;
}
function makeMarker() {   // машина за маркировка (бял бус с пръскачка) / камион с мантинели
  const g = new THREE.Group();
  box(2.2, 2, 5.2, mat(0xf2f2ee, 0.6), 0, 1.5, 0, g); box(2.4, 0.3, 1.2, mat(0xff6a00, 0.5), 0, 2.65, 0.6, g);
  const b = box(0.3, 0.25, 0.3, new THREE.MeshStandardMaterial({ color: 0xff8a00, emissive: 0xff6a00, emissiveIntensity: 1 }), 0, 2.95, 0.6, g); b.castShadow = false;
  box(2.6, 0.2, 0.4, M.steel, 0, 0.35, -2.8, g); wheels(g, [-1.1, 1.1], [1.8, -1.8]);
  return g;
}
function makeBarrierTruck() {
  const g = makeDump(0x2d6fd1); g.children[2].visible = false;
  for (let k = 0; k < 4; k++) box(2.2, 0.25, 4.6, mat(k % 2 ? 0xffffff : 0xd62828, 0.6), 0, 1.15 + k * 0.28, -0.8, g);
  return g;
}
function makeWorker(vest) {
  const g = new THREE.Group();
  box(0.5, 0.8, 0.35, mat(0x2f3f5c, 0.9), 0, 0.4, 0, g); box(0.6, 0.7, 0.4, mat(vest, 0.6), 0, 1.15, 0, g);
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat(0xe0b48c, 0.8)); h.position.y = 1.7; g.add(h);
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.23, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffd000, 0.5)); hat.position.y = 1.78; g.add(hat);
  return g;
}

// opts: { title, len = 240, river = true, ground = true }
export function buildAutobahnView(A, opts = {}) {
  const g = new THREE.Group();
  // модел от пакета, центриран, мащабиран по дължина и обърнат с предницата към +z (null, ако не е зареден)
  const heavy = key => {
    const [n, len, rot, tint] = HEAVY[key]; if (!A[n]) return null;
    const src = A[n].scene.clone(true), w = new THREE.Group(), inner = new THREE.Group(); inner.add(src); inner.rotation.y = rot; w.add(inner);
    const b = new THREE.Box3().setFromObject(inner), sz = b.getSize(new THREE.Vector3()), k = len / Math.max(sz.x, sz.z), c = b.getCenter(new THREE.Vector3());
    inner.scale.setScalar(k); inner.position.set(-c.x * k, -b.min.y * k, -c.z * k);
    src.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; if (tint) { m.material = m.material.clone(); m.material.color.setHex(tint); } } });
    return w;
  };
  let dz = 0; const dozer = () => heavy(['dozerA', 'dozerB', 'dozerC'][dz++ % 3]) || makeDozer();
  let dk = 0; const dump = col => heavy(['mine', 'dumpR', 'dumpG'][dk++ % 3]) || makeDump(col);
  const mixer = () => heavy('mixer') || makeMixer();
  const LEN = opts.len || 240, z0 = -LEN / 2, RIVER_Z = opts.river === false ? 1e9 : -10, TUNNEL_Z = z0 + 28;   // тунелът е в началото на участъка (далечния край)
  if (opts.ground !== false) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), mat(0x8fb36a, 1)); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; g.add(ground);
  }
  if (opts.river !== false) {
    const water = makeWater({ color: 0x3f86c9, repeat: 30 }); g.userData.water = water;   // вълни (water.js)
    const river = new THREE.Mesh(new THREE.PlaneGeometry(900, RIVER_W), water.material);
    river.rotation.x = -Math.PI / 2; river.position.set(0, 0.01, RIVER_Z); g.add(river);
    for (const sz of [-1, 1]) { const bank = new THREE.Mesh(new THREE.PlaneGeometry(900, 3), mat(0xc9b27a, 1)); bank.rotation.x = -Math.PI / 2; bank.position.set(0, 0.02, RIVER_Z + sz * (RIVER_W / 2 + 1.4)); g.add(bank); }
  }
  const onBridge = z => Math.abs(z - RIVER_Z) < RIVER_W / 2 + 8;
  const inTunnel = z => z < TUNNEL_Z + 2;
  const top = z => onBridge(z) ? Y + 0.42 : 1.16;   // горната повърхност на платното
  const Y = 1.2;   // височина на платното
  const earth = [], struct = [], base = [], asphalt = [], gear = [];
  const zs = []; for (let z = z0; z < z0 + LEN; z += 10) zs.push(z + 5);

  // 0) насип
  for (const zc of zs) {
    if (onBridge(zc)) continue;
    const e = box(W + 10, 0.8, 10, M.earth, 0, 0.4, zc, g); e.userData.z = zc; earth.push(e);
  }
  // 1) мост (колони + плоча) и тунел (хълм с два портала)
  for (let z = RIVER_Z - RIVER_W / 2 - 6; z <= RIVER_Z + RIVER_W / 2 + 6; z += 10) {
    for (const x of [-W / 2 + 4, -MED / 2 - 4, MED / 2 + 4, W / 2 - 4]) { const p = box(2.2, Y, 2.2, M.concrete, x, Y / 2, z, g); p.userData.z = z; struct.push(p); }
    const deck = box(W, 0.9, 10.2, M.concrete, 0, Y - 0.45 + 0.4, z, g); deck.userData.z = z; struct.push(deck);
  }
  const hill = new THREE.Mesh(new THREE.SphereGeometry(70, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6f9a4e, roughness: 1, flatShading: true }));
  hill.scale.set(1.2, 0.55, 0.9); hill.position.set(0, -2, TUNNEL_Z - 62); g.add(hill);
  // истинска планина: подножието ѝ (предният ръб) е точно при входа на тунела, иначе склонът покрива пътя
  loadMountains().then(() => { const o = mtnModel('far1', 340, 62, 0.4); if (!o) return; o.position.set(0, -4, 0); g.add(o); o.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(o); o.position.z = TUNNEL_Z - 8 - bb.max.z; hill.visible = false; });
  // скален откос в подножието и прокопаните отвори за двете платна — видими от самото начало (тунелът се копае паралелно)
  { // неравен скален масив: кутия с много върхове, разместени с шум; челото е наклонено назад и почти равно (там са отворите)
    const FW = W + 60, FH = 22, FD = 34, geo = new THREE.BoxGeometry(FW, FH, FD, 24, 8, 8), P = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i);
      const h = (v.y + FH / 2) / FH, front = v.z > FD / 2 - 0.01, n = Math.sin(v.x * 0.35) * Math.cos(v.z * 0.4 + v.y * 0.3) + Math.sin(v.x * 0.9 + v.y) * 0.5;
      if (v.y > -FH / 2 + 0.01) { v.x += n * 0.8; v.y += h > 0.95 ? n * 2.5 : 0; }
      v.z = front ? v.z - h * 7 + (h > 0.15 ? n * 0.5 : 0) : v.z + n * 1.2 * h;   // челото се накланя назад
      if (Math.abs(v.x) > FW / 2 - 1) v.y -= h * h * 8;   // краищата слизат към тревата
      P.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const face = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x6e5a49, roughness: 1, flatShading: true }));
    face.position.set(0, FH / 2 - 0.5, TUNNEL_Z - FD / 2); face.castShadow = face.receiveShadow = true; g.add(face);
    for (const sx of [-1, 1]) {
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(CW / 2 + 1.2, CW / 2 + 1.2, 1, 28, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), M.dark);
      hole.rotation.z = -Math.PI / 2; hole.scale.set(1, 0.6, 1); hole.position.set(sx * (CW + SH + MED) / 2, Y - 0.6, TUNNEL_Z + 0.05); g.add(hole);
    }
    // зеленина и скали по върха
    for (let k = 0; k < 18; k++) { const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(2 + (k % 3), 1), mat(k % 2 ? 0x4f7a3a : 0x5f8a44, 1)); bush.position.set(-FW / 2 + 4 + k * (FW - 8) / 17, FH - 2 + (k % 3), TUNNEL_Z - 14 - (k % 4) * 4); bush.scale.y = 0.6; g.add(bush); } }
  for (const sx of [-1, 1]) {
    const portal = new THREE.Group();
    box(CW + SH + 4, 9, 2, M.concrete, 0, 4.5, 0, portal);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(CW / 2 + 0.5, CW / 2 + 0.5, 2.2, 24, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), M.dark);
    hole.scale.set(1, 0.55, 1); hole.position.set(0, Y, 0.1); hole.rotation.z = -Math.PI / 2; portal.add(hole);
    portal.position.set(sx * (CW + SH + MED) / 2, 0, TUNNEL_Z); portal.rotation.y = Math.PI; portal.userData.z = TUNNEL_Z; g.add(portal); struct.push(portal);
  }
  // 2) основа (чакъл)
  for (const zc of zs) { if (inTunnel(zc) || onBridge(zc)) continue; const b = box(W + 2, 0.35, 10, M.gravel, 0, 0.97, zc, g); b.userData.z = zc; base.push(b); }
  // 3) асфалт: две платна по 6 ленти, с маркировка
  const lt = laneTex(), aMat = new THREE.MeshStandardMaterial({ map: lt, roughness: 0.85 });
  for (const zc of zs) {
    if (inTunnel(zc)) continue;
    for (const sx of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(CW + SH, 10), aMat); a.rotation.x = -Math.PI / 2; a.position.set(sx * (CW + SH + MED) / 2, top(zc), zc); a.receiveShadow = true; a.userData.z = zc; g.add(a); asphalt.push(a);
    }
  }
  // готовото продължение на аутобана (предишният участък): от края на строежа до хоризонта, с мантинели, лампи и движение
  const EXT0 = z0 + LEN, EXT1 = 440, extLen = EXT1 - EXT0;
  if (opts.ground !== false && extLen > 20) {
    const ext = new THREE.Group(); g.add(ext); g.userData.ext = ext;
    const emb = box(W + 10, 0.8, extLen, M.earth, 0, 0.4, EXT0 + extLen / 2, ext);
    box(W + 2, 0.35, extLen, M.gravel, 0, 0.97, EXT0 + extLen / 2, ext);
    const et = laneTex(); et.wrapT = THREE.RepeatWrapping; et.repeat.set(1, extLen / 10);
    const eMat = new THREE.MeshStandardMaterial({ map: et, roughness: 0.85 });
    for (const sx of [-1, 1]) { const a = new THREE.Mesh(new THREE.PlaneGeometry(CW + SH, extLen), eMat); a.rotation.x = -Math.PI / 2; a.position.set(sx * (CW + SH + MED) / 2, 1.16, EXT0 + extLen / 2); a.receiveShadow = true; ext.add(a); }
    const gr = mat(0xb9bec4, 0.4, 0.6);
    for (const x of [-W / 2 + 0.3, -MED / 2 + 0.3, MED / 2 - 0.3, W / 2 - 0.3]) box(0.25, 0.7, extLen, gr, x, 1.55, EXT0 + extLen / 2, ext);
    for (let z = EXT0 + 20; z < EXT1; z += 40) { box(0.3, 9, 0.3, M.steel, 0, 5.5, z, ext); box(MED + 8, 0.2, 0.4, M.steel, 0, 10, z, ext); }
    // временна бариера там, където започва строежът
    const bt0 = barrierTex(); bt0.repeat.set(W / 2, 1);
    box(W, 1, 0.5, new THREE.MeshStandardMaterial({ map: bt0, roughness: 0.6 }), 0, 1.7, EXT0 + 1.5, ext);
    // коли по готовата част (обръщат преди бариерата)
    const cols = [0xd62828, 0x1f5fbf, 0xf2f2f2, 0x2d8f4e, 0xffb300, 0x333a44];
    const cars = [];
    for (let k = 0; k < 16; k++) {
      const c = new THREE.Group(), col = cols[k % cols.length], big = k % 5 === 0;
      box(big ? 2.4 : 1.8, big ? 2.6 : 1.2, big ? 9 : 4.2, mat(col, 0.45, 0.3), 0, big ? 1.5 : 0.75, 0, c);
      if (!big) box(1.6, 0.7, 2.2, mat(0x1a2630, 0.2, 0.5), 0, 1.55, -0.2, c);
      const side = k % 2 ? 1 : -1, lane = (k >> 1) % 3;
      c.position.set(side * (MED / 2 + SH + LW * (lane + 0.5)), 1.16, 0); c.rotation.y = side > 0 ? 0 : Math.PI;
      ext.add(c); cars.push({ c, side, u: (k * 0.137) % 1, sp: 0.012 + (k % 4) * 0.003 });
    }
    g.userData.extCars = cars; g.userData.extRange = [EXT0 + 8, EXT1];
  }
  // 4) червено-бели мантинели (отстрани и по средата), осветление, портални табели
  const bt = barrierTex(); bt.repeat.set(10 / 2, 1);
  const bMat = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.6 });
  for (const zc of zs) {
    if (inTunnel(zc)) continue;
    const yb = top(zc) + 0.45;
    for (const x of [-W / 2 + 0.3, -MED / 2 + 0.3, MED / 2 - 0.3, W / 2 - 0.3]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 10), bMat); b.position.set(x, yb, zc); b.userData.z = zc; g.add(b); gear.push(b); }
  }
  for (let z = TUNNEL_Z + 14; z < z0 + LEN; z += 24) {
    const pole = box(0.25, 11, 0.25, M.steel, 0, 6.6, z, g); pole.userData.z = z; gear.push(pole);
    const arm = box(MED + 10, 0.2, 0.3, M.steel, 0, 12, z, g); arm.userData.z = z; gear.push(arm);
  }
  const t1 = (opts.title || 'АУТОБАН').toUpperCase();
  for (const [z, dir] of [[TUNNEL_Z + 30, 1], [z0 + LEN - 30, -1]]) {
    const gan = new THREE.Group();
    for (const x of [-W / 2 - 1, W / 2 + 1]) box(0.6, 12, 0.6, M.steel, x, 6, 0, gan);
    box(W + 2, 0.6, 0.8, M.steel, 0, 11.6, 0, gan);
    for (const sx of [-1, 1]) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(CW - 2, 4.6), new THREE.MeshBasicMaterial({ map: gantrySign(t1, sx > 0 ? 'ДЯСНО ПЛАТНО · 6 ленти' : 'ЛЯВО ПЛАТНО · 6 ленти'), side: THREE.DoubleSide }));
      sign.position.set(sx * (CW + SH + MED) / 2, 9.2, dir * 0.5); if (dir < 0) sign.rotation.y = Math.PI; gan.add(sign);
    }
    gan.position.z = z; gan.userData.z = z; g.add(gan); gear.push(gan);
  }
  // строителна площадка на фронта
  const front = new THREE.Group(); g.add(front);
  for (let k = 0; k < 10; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 10), mat(0xff6a00, 0.6)); c.position.set(-W / 2 + k * W / 9, 1.6, 0); front.add(c); }
  const pavers = [makePaver(), makePaver(), makePaver(), makePaver()], rollers = [makeRoller(), makeRoller(), makeRoller()];
  g.add(...pavers, ...rollers);
  const dumps = [0xd62828, 0x1f5fbf, 0xffb300, 0x2d8f4e].map(c => { const d = makeDump(c); g.add(d); return d; });
  const fresh = [-1, 1].map(sx => { const f = new THREE.Mesh(new THREE.PlaneGeometry(CW, 16), new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.55 })); f.rotation.x = -Math.PI / 2; g.add(f); return f; });

  // движение след откриването: 12 ленти, по-бавните камиони вдясно
  const traffic = new THREE.Group(); g.add(traffic);
  const real = AB_MODELS.vehicles.filter(n => n.startsWith('sf-') && A[n]), cars = real, list = [], TRK = A['sf-semi-0'] ? 'sf-semi-0' : A['sf-car-Truck'] ? 'sf-car-Truck' : null;   /* №2 (55): само истински коли и камиони — без детските резерви */
  for (let k = 0; k < 60 && cars.length; k++) {
    const dir = k % 2 ? 1 : -1, lane = k % LANES, truck = lane >= 4 && k % 3 === 0;
    const n = truck && A[TRK] ? TRK : cars[(k * 7) % cars.length], sf = n.startsWith('sf-');
    const o = (A[n].variants ? A[n].variants[k % A[n].variants.length] : A[n].scene).clone(true); o.scale.setScalar(sf ? 1 : truck ? 2.4 : 1.8);   // истинските са в метри o.rotation.y = dir > 0 ? 0 : Math.PI;
    // дясно движение: посока +z е в дясното (x > 0) платно; лента 0 е до разделителя
    const x = dir * (MED / 2 + SH / 2 + LW * (lane + 0.5));
    list.push({ o, dir, x, z: z0 + Math.random() * LEN, v: (truck ? 22 : 30) + Math.random() * 14 + (LANES - lane) * 2 });
    traffic.add(o);
  }

  // ---- оживена строителна площадка: по 12–20 машини на етап по цялата дължина (повече около фронта)
  const xL = sx => sx * (CW + SH + MED) / 2;   // оста на платното
  const crowd = [];
  const KIT = [   // [етап, направа, брой, разпръскване по ширина]
    [0, dozer, 7], [0, makeGrader, 4], [0, () => dump(0xd62828), 5], [0, () => heavy('loader') || makeDozer(), 2],
    [1, () => heavy('mcrane') || makeCrane(), 4], [1, mixer, 5], [1, () => dump(0x1f5fbf), 3], [1, dozer, 2],
    [2, makeGrader, 5], [2, makeRoller, 6], [2, () => dump(0xffb300), 5],
    [3, makePaver, 2], [3, makeRoller, 7], [3, () => dump(0x2d8f4e), 5], [3, mixer, 1],
    [4, makeMarker, 5], [4, makeBarrierTruck, 4], [4, () => heavy('mcrane') || makeCrane(), 2],
  ];
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // всяка машина има своя лента (12 ленти) и свой участък по дължината — не минават една през друга
  const slot = {};
  for (const [st, mk, n] of KIT) for (let k = 0; k < n; k++) {
    const o = mk(); o.visible = false; g.add(o);
    // 6 широки коридора (по 2 ленти; 3 на платно) × редове по дължината — машините не се застъпват дори големите
    const i = slot[st] = (slot[st] ?? -1) + 1, sl = (i * 7) % 6, row = Math.floor(i / 6);
    const sx = sl < 3 ? -1 : 1, li = sl % 3;
    const off = (st === 3 ? -34 : -8) - row * 52 - (sl % 2) * 22;
    crowd.push({ o, st, near: true, x: xL(sx) + (li - 1) * LW * 2, off, amp: 2 + rnd() * 4, sp: 0.25 + rnd() * 0.4, ph: rnd() * 6, paver: mk === makePaver });
  }
  // колове с маркировъчен шнур по границите на платната (виждат се до асфалта) и конуси по разделителя
  const stakeG = new THREE.Group(); g.add(stakeG);
  { const xs = []; for (const sx of [-1, 1]) for (let l = 0; l <= LANES; l++) xs.push(xL(sx) + (l - LANES / 2) * LW);
    const zz = []; for (let z = TUNNEL_Z + 4; z < z0 + LEN; z += 8) if (!onBridge(z)) zz.push(z);
    const stakeM = mat(0xff6a00, 0.6), sGeo = new THREE.BoxGeometry(0.12, 1.4, 0.12), stakes = new THREE.InstancedMesh(sGeo, stakeM, xs.length * zz.length);
    const m4 = new THREE.Matrix4(); let i = 0; for (const x of xs) for (const z of zz) stakes.setMatrixAt(i++, m4.makeTranslation(x, 0.7, z));
    stakeG.add(stakes);
    const pts = []; for (const x of xs) pts.push(x, 1.25, TUNNEL_Z + 4, x, 1.25, z0 + LEN);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    stakeG.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })));
    const cz = []; for (let z = TUNNEL_Z + 6; z < z0 + LEN; z += 6) cz.push(z);
    const cones = new THREE.InstancedMesh(new THREE.ConeGeometry(0.35, 0.9, 8), mat(0xff5a00, 0.6), cz.length * 2);
    i = 0; for (const z of cz) for (const x of [-MED / 2 + 0.6, MED / 2 - 0.6]) cones.setMatrixAt(i++, m4.makeTranslation(x, top(z) + 0.45, z));
    stakeG.add(cones); }
  // кофраж и скеле на моста (етап 1) + две кулокранови до него
  const formG = new THREE.Group(); g.add(formG);
  if (opts.river !== false) for (const [x, z] of [[-W / 2 - 8, RIVER_Z - RIVER_W / 2 - 4], [W / 2 + 26, RIVER_Z + RIVER_W / 2 + 4]]) { const tc = heavy('tower'); if (!tc) break; tc.position.set(x, 0, z); tc.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; formG.add(tc); }
  if (opts.river !== false) {
    const wood = mat(0x9c6b3e, 0.9), scaf = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, wireframe: true });
    for (let z = RIVER_Z - RIVER_W / 2 - 6; z <= RIVER_Z + RIVER_W / 2 + 6; z += 10) {
      box(W, 0.25, 9.6, wood, 0, Y + 0.6, z, formG);
      const sc = new THREE.Mesh(new THREE.BoxGeometry(W - 2, Y + 4, 9, 8, 3, 2), scaf); sc.position.set(0, (Y + 4) / 2 - 0.3, z); formG.add(sc);
    }
  }
  // сервизен път отстрани с колони самосвали, контейнери-офиси, прожектори, работници
  const svc = new THREE.Group(); g.add(svc);
  const SVX = W / 2 + 14;
  { const r = new THREE.Mesh(new THREE.PlaneGeometry(9, LEN), M.gravel); r.rotation.x = -Math.PI / 2; r.position.set(SVX, 0.03, 0); r.receiveShadow = true; svc.add(r);
    const offZ = z0 + LEN * 0.72;
    for (let k = 0; k < 4; k++) { const c = box(2.6, 2.6, 6, mat([0xf2f2ee, 0x1f5fbf, 0xf2f2ee, 0x2d8f4e][k], 0.6), SVX + 10 + (k % 2) * 3, 1.3 + Math.floor(k / 2) * 2.6, offZ + (k % 2 ? 0 : 7), svc); for (let w = -1; w <= 1; w++) box(0.05, 0.8, 1, mat(0x3f6f8f, 0.2, 0.3), c.position.x - 1.33, c.position.y + 0.2, c.position.z + w * 1.8, svc); }
    box(0.15, 5, 0.15, M.steel, SVX + 8, 2.5, offZ - 5, svc);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.2), new THREE.MeshStandardMaterial({ color: 0xffb300, side: THREE.DoubleSide })); flag.position.set(SVX + 9, 4.4, offZ - 5); svc.add(flag); }
  const flood = [];
  for (let z = z0 + 30; z < z0 + LEN - 10; z += 60) { const m = new THREE.Group(); box(0.3, 14, 0.3, M.steel, 0, 7, 0, m); const hd = box(2.2, 0.8, 0.8, new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xffe2a8, emissiveIntensity: 1.2 }), -0.6, 14, 0, m); hd.castShadow = false; m.position.set(-W / 2 - 6, 0, z); g.add(m); flood.push(m); }
  const convoy = [0xd62828, 0x1f5fbf, 0xffb300, 0x2d8f4e, 0xd62828, 0x6b6b6b].map((c, k) => { const d = heavy(k % 2 ? 'dumpG' : 'dumpR') || makeDump(c); d.userData.k = k; svc.add(d); return d; });
  const workers = [];
  for (let k = 0; k < 24; k++) { const w = makeWorker(k % 3 ? 0xff7a00 : 0xd6ff3a); g.add(w); workers.push({ o: w, dx: (rnd() - 0.5) * W, dz: -30 + rnd() * 45, ph: rnd() * 6 }); }
  // височина на повърхността на трасето при дадения етап/фронт
  const surf = (z, stage, fz) => {
    if (onBridge(z)) return stage > 1 || (stage === 1 && z <= fz) ? top(z) : null;
    if (stage > 3 || (stage === 3 && z <= fz)) return top(z);
    if (stage > 2 || (stage === 2 && z <= fz)) return 1.15;
    if (stage > 0 || z <= fz) return 0.8;
    return 0;
  };

  function update(stage, prog, t = 0) {
    if (g.userData.water) g.userData.water.update(t);
    if (g.userData.extCars) { const [za, zb] = g.userData.extRange; for (const q of g.userData.extCars) { const u = (q.u + t * q.sp) % 1, zz = q.side > 0 ? zb - u * (zb - za) : za + u * (zb - za); q.c.position.z = zz; } }
    const fz = z0 + LEN * prog, done = stage >= AB_STAGES.length;
    for (const c of crowd) {
      if (c.st !== stage || done) { c.o.visible = false; continue; }
      let zb = c.near ? fz + c.off : c.off;
      const lo = TUNNEL_Z + 6, hi = z0 + LEN - 6; if (zb < lo) zb = lo + (lo - zb); if (zb > hi) zb = hi - (zb - hi);   // отразяване — да не се трупат в края
      zb = Math.max(lo, Math.min(hi, zb));
      const z = zb + Math.sin(t * c.sp + c.ph) * c.amp, dir = Math.cos(t * c.sp + c.ph);
      const y = c.paver ? null : surf(z, stage, fz);
      if (c.paver) { c.o.visible = false; continue; }   // асфалтополагачите на фронта са по-долу (pavers)
      if (y == null) { c.o.visible = false; continue; }
      c.o.visible = true; c.o.position.set(c.x, y, z); c.o.rotation.y = dir >= 0 ? 0 : Math.PI;
      if (c.o.userData.drums) c.o.userData.drums.forEach(d => d.rotation.x += 0.05 * Math.sign(dir || 1));
      if (c.o.userData.drum) c.o.userData.drum.rotation.z = t * 2;
      if (c.o.userData.boom) c.o.userData.boom.rotation.y = Math.sin(t * 0.3 + c.ph) * 0.8;
    }
    stakeG.visible = !done && stage < 4; formG.visible = stage === 1; svc.visible = !done; flood.forEach(f => { f.visible = !done; });
    convoy.forEach(d => { const k = d.userData.k, L = LEN - 20, u = ((t * 9 + k * L / convoy.length) % L), dir = k % 2 ? 1 : -1, z = dir > 0 ? z0 + 10 + u : z0 + LEN - 10 - u; d.position.set(SVX + (dir > 0 ? 2.3 : -2.3), 0.05, z); d.rotation.y = dir > 0 ? 0 : Math.PI; });
    workers.forEach(w => { w.o.visible = !done; if (done) return; const z = Math.max(TUNNEL_Z + 4, Math.min(z0 + LEN - 4, fz + w.dz + Math.sin(t * 0.4 + w.ph) * 2)); const y = surf(z, stage, fz); w.o.visible = y != null; w.o.position.set(w.dx + Math.cos(t * 0.3 + w.ph) * 1.5, y || 0, z); w.o.rotation.y = w.ph + t * 0.2; });
    reveal(earth, stage > 0 ? 1e9 : fz);
    reveal(struct, stage > 1 ? 1e9 : stage === 1 ? fz : -1e9);
    reveal(base, stage > 2 ? 1e9 : stage === 2 ? fz : -1e9);
    reveal(asphalt, stage > 3 ? 1e9 : stage === 3 ? fz : -1e9);
    reveal(gear, stage > 4 ? 1e9 : stage === 4 ? fz : -1e9);
    front.visible = !done; front.position.z = fz;
    const asph = stage === 3;
    pavers.forEach((p, i) => { p.visible = asph; const sx = i % 2 ? 1 : -1, off = i < 2 ? 0 : -14; p.position.set(sx * (CW + SH + MED) / 2 + (i < 2 ? -LW : LW), top(fz), fz + 1.5 + off); });
    fresh.forEach((f, i) => { f.visible = asph; f.position.set((i ? 1 : -1) * (CW + SH + MED) / 2, 1.2, fz - 8); });
    rollers.forEach((r, k) => {
      r.visible = false;
      const zz = fz - 6 - k * 6 + Math.sin(t * 0.9 + k * 1.7) * 4, dir = Math.cos(t * 0.9 + k * 1.7);
      r.position.set((k - 1) * 12, 1.15, zz); r.rotation.y = dir >= 0 ? 0 : Math.PI;
      r.userData.drums.forEach(d => d.rotation.x += 0.05 * Math.sign(dir || 1));
    });
    dumps.forEach((d, k) => {
      d.visible = false;
      const zz = fz - 12 - k * 10 + Math.sin(t * 0.7 + k) * 5;
      d.position.set((k % 2 ? 1 : -1) * (W / 2 + 6), 0.4, zz); d.rotation.y = Math.cos(t * 0.7 + k) >= 0 ? 0 : Math.PI;   // гледа накъдето се движи
    });
    traffic.visible = done;
    if (done) {
      const dt = list.lastT == null ? 0 : Math.min(0.1, Math.max(0, t - list.lastT)); list.lastT = t;
      for (const c of list) {
        c.z += c.dir * c.v * dt;
        if (c.z > z0 + LEN) c.z -= LEN; else if (c.z < z0) c.z += LEN;
        const tun = inTunnel(c.z);
        c.o.visible = !tun;
        c.o.position.set(c.x, top(c.z), c.z);
      }
    }
  }
  update(opts.stage ?? 0, opts.prog ?? 0);
  return { group: g, update, length: LEN, width: W };
}
