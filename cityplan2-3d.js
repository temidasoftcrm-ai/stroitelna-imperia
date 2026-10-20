// cityplan2-3d.js — 3D изгледът на плана v2 (cityplan2.js): терен, улици, тротоари, бордюри, маркировка, кръстовища и кръгови,
// Тибърът в коритото с мостовете (Рим), паркове, жп линии, градска среда (фенери, платани, светофари, знаци, пейки, фонтани,
// спирки) и „фоновите“ римски квартали (фасади с керемидени покриви — за парцелите, които играта не ползва).
// БЕЗ сградите по парцелите — тях ги слага играта (или демото lab/plan2-3d.html). Всичко е слято или инстанцирано.
// buildPlan2View(P, opts) → THREE.Group; userData: { update(dt, { camera, signals }), setNight(on), refill(), lamps, groundMat, nightMats, blocks, dispose() }
// opts: { osm (данните от cityplan2-osm.js — за Рим), offset: [ox, oz] (изместване към рамката на играта), fillLot(lot) → bool,
//         blocks: true (фоновите квартали в Рим), furniture: true, lampGlow: true (собствени светли петна под фенерите) }
import * as THREE from 'three';

const M = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92 });
let MAT = null;
export function mats() {
  if (MAT) return MAT;
  MAT = { grass: M(0x7fa462), walk: M(0xc9c4b8), asph: M(0x3a3d42), median: M(0x5f9a45), island: M(0x6aa84f), water: new THREE.MeshStandardMaterial({ color: 0x3f7fb0, roughness: 0.2, metalness: 0.1, side: THREE.DoubleSide }), sand: M(0xd8c79a), pier: M(0xa9a59c), paint: M(0xf2f2ea) };
  for (const k of ['walk', 'asph', 'median', 'paint']) Object.assign(MAT[k], { polygonOffset: true, polygonOffsetFactor: { walk: -1, asph: -2, median: -3, paint: -4 }[k], polygonOffsetUnits: { walk: -1, asph: -2, median: -3, paint: -4 }[k] });

  const ASPH_T = ctex(256, (g, n) => { g.fillStyle = '#4a4d52'; g.fillRect(0, 0, n, n); for (let i = 0; i < 9000; i++) { const v = 60 + Math.random() * 40 | 0; g.fillStyle = `rgba(${v},${v},${v + 4},${Math.random() * 0.5})`; g.fillRect(Math.random() * n, Math.random() * n, 1.5, 1.5); } });
  const PAVE_T = ctex(256, (g, n) => { g.fillStyle = '#cbc6ba'; g.fillRect(0, 0, n, n); g.strokeStyle = 'rgba(120,112,100,0.55)'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * n / 4, 0); g.lineTo(i * n / 4, n); g.moveTo(0, i * n / 4); g.lineTo(n, i * n / 4); g.stroke(); } for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(90,85,75,${Math.random() * 0.15})`; g.fillRect(Math.random() * n, Math.random() * n, 2, 2); } });
  const COB_T = ctex(256, (g, n) => { g.fillStyle = '#9d8f7c'; g.fillRect(0, 0, n, n); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = 130 + Math.random() * 40 | 0; g.fillStyle = `rgb(${v},${v - 12},${v - 28})`; g.fillRect(x * 16 + (y % 2) * 8 + 1, y * 16 + 1, 14, 14); } }, 3);
  MAT.asph.map = ASPH_T; MAT.asph.color.setHex(0xffffff); MAT.walk.map = PAVE_T; MAT.walk.color.setHex(0xffffff);
  Object.assign(MAT, { urban: M(0xcdbf9f), curb: M(0xe2ded5), apron: new THREE.MeshStandardMaterial({ map: COB_T, roughness: 0.95 }), flower: [M(0xd8434b), M(0xf2c230), M(0x9b59c9)], stone: M(0xb9b2a4), wet: new THREE.MeshStandardMaterial({ color: 0x5aa6d6, roughness: 0.1, metalness: 0.2 }) });
  for (const k of ['curb', 'apron']) Object.assign(MAT[k], { polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
  return MAT;
}
function ctex(n, draw, rep2 = 1) { const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep2, rep2); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
// ---- геометрия (слива се в малко мешове)
export function ribbon(pts, w, y, closed = false) {
  const pos = [], idx = [];
  for (let i = 0; i < pts.length; i++) { const a = pts[closed ? (i - 1 + pts.length) % pts.length : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % pts.length : Math.min(pts.length - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    pos.push(pts[i][0] - dz * w / 2, y, pts[i][1] + dx * w / 2, pts[i][0] + dz * w / 2, y, pts[i][1] - dx * w / 2); if (i) { const k = 2 * i; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } }
  return { pos, idx };
}
export function disc(x, z, r, y, r0 = 0, seg = 40) { const pos = [], idx = []; for (let k = 0; k <= seg; k++) { const a = k / seg * Math.PI * 2; pos.push(x + Math.cos(a) * r0, y, z + Math.sin(a) * r0, x + Math.cos(a) * r, y, z + Math.sin(a) * r); if (k) { const i = 2 * k; idx.push(i - 2, i, i - 1, i - 1, i, i + 1); } } return { pos, idx }; }
export function merge(parts, mat) { const pos = [], idx = []; for (const p of parts) { const b = pos.length / 3; pos.push(...p.pos); for (const i of p.idx) idx.push(i + b); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] / 6, pos[i + 2] / 6); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m; }
// линии: изместена полилиния, прекъсната линия, напречна черта
export function offLine(pts, off) { return pts.map((p, k) => { const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [p[0] - (b[1] - a[1]) / l * off, p[1] + (b[0] - a[0]) / l * off]; }); }
export function dashed(pts, dash, gap, w, y, out) { let acc = 0, on = true, run = [pts[0]]; for (let i = 1; i < pts.length; i++) { let a = pts[i - 1]; const b = pts[i]; let d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  while (acc + d >= (on ? dash : gap)) { const need = (on ? dash : gap) - acc, t = need / d, q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; if (on) { run.push(q); out.push(ribbon(run, w, y)); } run = [q]; a = q; d -= need; acc = 0; on = !on; }
  acc += d; if (on) run.push(b); } if (on && run.length > 1) out.push(ribbon(run, w, y)); }
export const circle = (x, z, r, n = 64) => Array.from({ length: n + 1 }, (_, k) => [x + Math.cos(k / n * Math.PI * 2) * r, z + Math.sin(k / n * Math.PI * 2) * r]);
export function quad(a, b, c, d, y) { return { pos: [a[0], y, a[1], b[0], y, b[1], c[0], y, c[1], d[0], y, d[1]], idx: [0, 2, 1, 0, 3, 2] }; }
let FAC_MAT = null, lodRoof = null;
function facadeMat() {
  if (FAC_MAT) return FAC_MAT;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#f4ece0'; g.fillRect(0, 0, 128, 128);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) { const x = 14 + k * 38, y = 8 + r * 24; g.fillStyle = '#3d3a36'; g.fillRect(x + 5, y, 12, 16); g.fillStyle = '#5f7a4a'; g.fillRect(x, y, 5, 16); g.fillRect(x + 17, y, 5, 16); g.fillStyle = '#e8e0d2'; g.fillRect(x + 3, y + 16, 16, 2); }
  g.fillStyle = '#d9cfbf'; g.fillRect(0, 104, 128, 24); for (let k = 0; k < 3; k++) { g.fillStyle = '#4a4540'; g.beginPath(); g.moveTo(16 + k * 38, 128); g.lineTo(16 + k * 38, 112); g.arc(27 + k * 38, 112, 11, Math.PI, 0); g.lineTo(38 + k * 38, 128); g.fill(); }
  g.fillStyle = '#cfc5b4'; g.fillRect(0, 0, 128, 4);   // корниз
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return FAC_MAT = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
}
// Истанбул: османска къща — дъски, бели рамки на прозорците, еркер (cumba) на горните етажи; блок — светли балкони и парапети
// Париж: османова сграда — светъл варовик, високи прозорци с ковани балкони на 2-ри и 5-и етаж, партер с витрини; покрив — мансарда от цинк
let HAUSS_MAT = null;
const HAUSS = [0xf0e6d2, 0xe9dcc3, 0xf3ead9, 0xe4d6bd, 0xeee2cc];
function haussMat() {
  if (HAUSS_MAT) return HAUSS_MAT;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#f6efe2'; g.fillRect(0, 0, 128, 128); g.fillStyle = 'rgba(120,105,85,0.25)'; for (let y = 0; y < 128; y += 21) g.fillRect(0, y, 128, 1.5);   // корнизите на етажите
  for (let r = 0; r < 5; r++) for (let k = 0; k < 4; k++) { const x = 9 + k * 30, y = 6 + r * 21; g.fillStyle = '#3a4250'; g.fillRect(x, y, 12, 15); g.fillStyle = '#e8dcc6'; g.fillRect(x - 2, y - 2, 16, 2); }
  g.fillStyle = '#1d2024'; for (const y of [27, 90]) { g.fillRect(0, y, 128, 2); for (let x = 0; x < 128; x += 3) g.fillRect(x, y - 4, 1, 4); }   // ковани балкони (2-ри и 5-и етаж)
  g.fillStyle = '#d9cdb5'; g.fillRect(0, 108, 128, 20); g.fillStyle = '#2f3a44'; for (let k = 0; k < 4; k++) g.fillRect(6 + k * 31, 111, 22, 17);   // витрините
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return HAUSS_MAT = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
}
function mansardGeo() { const g = new THREE.BufferGeometry(), v = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5, -0.3, 1, -0.5, 0.3, 1, -0.5, 0.3, 1, 0.5, -0.3, 1, 0.5];   // мансарда: стръмни скатове и плосък връх
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex([0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2]); g.computeVertexNormals(); return g; }
let OTTO_MAT = null, APT_MAT = null;
const OTTO = [0xd9a066, 0xe8c6a0, 0xc97d5d, 0xa9c4cf, 0xb7c9a0, 0xe2d6c0, 0x8a5a3c, 0xd4a9a9], APT = [0xf2efe6, 0xe9e3d4, 0xf3e8d2, 0xe0dcd2, 0xefe2c8];
function ottoMat() {
  if (OTTO_MAT) return OTTO_MAT;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#f4ece0'; g.fillRect(0, 0, 128, 128); g.strokeStyle = 'rgba(80,60,40,0.25)'; g.lineWidth = 1; for (let y = 2; y < 128; y += 5) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }   // дъски
  g.fillStyle = 'rgba(60,45,30,0.35)'; g.fillRect(34, 8, 60, 56); g.fillStyle = '#f7f3ea'; g.fillRect(36, 10, 56, 52);   // еркерът (по-светъл, със сянка)
  for (const [x, y] of [[40, 16], [58, 16], [76, 16], [40, 40], [58, 40], [76, 40], [8, 22], [106, 22], [8, 46], [106, 46]]) { g.fillStyle = '#ffffff'; g.fillRect(x - 1, y - 1, 14, 18); g.fillStyle = '#35404a'; g.fillRect(x, y, 12, 16); }
  g.fillStyle = '#ffffff'; g.fillRect(0, 70, 128, 3); g.fillStyle = '#4a3a2c'; g.fillRect(52, 90, 24, 38); g.fillStyle = '#35404a'; for (const x of [12, 96]) g.fillRect(x, 92, 18, 22);   // корниз, вратата, прозорците на партера
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return OTTO_MAT = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
}
function aptMat() {
  if (APT_MAT) return APT_MAT;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#f6f3ec'; g.fillRect(0, 0, 128, 128);
  for (let r = 0; r < 5; r++) for (let k = 0; k < 4; k++) { const x = 6 + k * 31, y = 4 + r * 22; g.fillStyle = '#4a5866'; g.fillRect(x, y, 20, 13); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x - 3, y + 13, 26, 4); g.fillStyle = '#d8d4cc'; g.fillRect(x - 3, y + 12, 26, 2); }   // прозорци и балкони
  g.fillStyle = '#c9c4ba'; g.fillRect(0, 114, 128, 14); g.fillStyle = '#3e4a54'; for (let k = 0; k < 4; k++) g.fillRect(8 + k * 31, 116, 18, 12);   // партер — магазини
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return APT_MAT = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
}
function roofGeo() { const g = new THREE.BufferGeometry(), v = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5, 0, 1, -0.5, 0, 1, 0.5];   // покрив на две води (било по z)
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex([0, 4, 5, 0, 5, 3, 1, 2, 5, 1, 5, 4, 0, 1, 4, 3, 5, 2]); g.computeVertexNormals(); return g; }
// Тибърът: коритото е 7 м под улиците — земята е с дупка по реката, отвесни каменни стени (травертин), водата долу; мостовете — на нивото на улицата, с арки до водата
const RIV_D = 7, TRAV = 0xd8cdb4;
// оста на реката — изгладена (през ~12 м, Чайкин), иначе отместените брегове се самопресичат в завоите и триангулацията се проваля
const smoothRiver = rv => { let p = []; for (let i = 0; i < rv.length; i++) { if (!p.length || Math.hypot(rv[i][0] - p[p.length - 1][0], rv[i][1] - p[p.length - 1][1]) >= 12 || i === rv.length - 1) p.push(rv[i]); }
  for (let it = 0; it < 2; it++) { const q = [p[0]]; for (let i = 0; i < p.length - 1; i++) { const a = p[i], b = p[i + 1]; q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } q.push(p[p.length - 1]); p = q; } return p; };
const RIV = new Map();
let rivOf = rv => RIV.get(rv) || RIV.set(rv, smoothRiver(rv)).get(rv);
const riverPoly = (rv, hw) => [...offLine(rivOf(rv), hw), ...offLine(rivOf(rv), -hw).reverse()];
// море (Истанбул): сушата — слети серии от растера (ред по ред), водата — равнина под нея; кейовете, фериботните линии
function seaGround(sea) {
  const pos = [], idx = [];   // серии по редове: runs са по целия растер — тук се режат на редове
  const NX = sea.nx; let at = 0, v = 0;
  for (const n of sea.runs) { let a = at, left = n; while (left > 0) { const j = Math.floor(a / NX), i = a % NX, len = Math.min(left, NX - i);
      if (!v) { const x0 = sea.x0 + i * sea.cell, x1 = x0 + len * sea.cell, z0 = sea.z0 + j * sea.cell, z1 = z0 + sea.cell, b = pos.length / 3; pos.push(x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1); idx.push(b, b + 2, b + 1, b, b + 3, b + 2); }
      a += len; left -= len; }
    at += n; v ^= 1; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function seaView(G, D, RR) {
  const S2 = D.sea, IN = D.style === 'paris', w = new THREE.Mesh(new THREE.PlaneGeometry(S2.nx * S2.cell * (IN ? 1 : 1.6), S2.nz * S2.cell * (IN ? 1 : 1.6)).rotateX(-Math.PI / 2), MAT.water); w.position.set(S2.x0 + S2.nx * S2.cell / 2, -1.2, S2.z0 + S2.nz * S2.cell / 2); G.add(w);
  if (IN) {   // град без море (Париж — само реката): около растера — суша (рамка), не вода
    const W = S2.nx * S2.cell, H = S2.nz * S2.cell, F = 3000, fr = [[-F, -F, W + 2 * F, F], [-F, H, W + 2 * F, F], [-F, 0, F, H], [W, 0, F, H]].map(([x, z, w2, d2]) => new THREE.PlaneGeometry(w2, d2).rotateX(-Math.PI / 2).translate(S2.x0 + x + w2 / 2, 0, S2.z0 + z + d2 / 2));
    for (const f of fr) { const m = new THREE.Mesh(f, MAT.urban); m.receiveShadow = true; G.add(m); } }
  const Pi = []; for (const p of D.piers || []) if (p.length > 1) Pi.push(ribbon(p, 4, -0.2)); if (Pi.length) G.add(merge(Pi, MAT.pier));
  const Fe = [], seenF = new Set(); for (const f of D.ferries || []) { const key = f.pts.length > 1 ? [f.pts[0], f.pts[f.pts.length - 1]].map(p => Math.round(p[0] / 40) + ',' + Math.round(p[1] / 40)).sort().join('|') : ''; if (seenF.has(key)) continue; seenF.add(key); dashed(f.pts, 5, 22, 0.7, -1.1, Fe); }   // еднаквите линии (двете посоки) — веднъж if (Fe.length) G.add(merge(Fe, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })));   // фериботните линии по водата
  const Mt = []; for (const r of D.metro || []) if (r.kind !== 'rail') Mt.push(ribbon(r.pts, r.kind === 'tram' ? 2.2 : 2.6, 0.085)); if (Mt.length) G.add(merge(Mt, M(0x9a9184)));   // метро/трамвай на повърхността
  romeBridges(G, D);
  // висящите мостове (Босфорския): моделът — дължината по x, центриран; мащабът — от бряг до бряг
  for (const B of D.bigBridges || []) { const proto = (D._models || {})[B.k]; if (!proto) continue;
    const o = proto.clone(true), bb = new THREE.Box3().setFromObject(o), len = Math.hypot(B.b[0] - B.a[0], B.b[1] - B.a[1]), k = len / (bb.max.x - bb.min.x);
    const w = new THREE.Group(); o.scale.setScalar(k); o.position.set(-(bb.min.x + bb.max.x) / 2 * k, -bb.min.y * k - 1.2, -(bb.min.z + bb.max.z) / 2 * k); w.add(o);
    w.position.set((B.a[0] + B.b[0]) / 2, 0, (B.a[1] + B.b[1]) / 2); w.rotation.y = -Math.atan2(B.b[1] - B.a[1], B.b[0] - B.a[0]); w.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); G.add(w); }
}
function romeGround(RR, D) {
  const S2 = RR * 1.2, sh = new THREE.Shape([new THREE.Vector2(-S2, -S2), new THREE.Vector2(S2, -S2), new THREE.Vector2(S2, S2), new THREE.Vector2(-S2, S2)]);
  for (const rv of D.river.slice(0, 1)) { const lim = S2 - D.riverHW - 6, cl = rivOf(rv).filter(([x, z]) => Math.abs(x) < lim && Math.abs(z) < lim); if (cl.length < 2) continue; RIV.set(rv, cl);   /* дупката не бива да излиза от квадрата */
    sh.holes.push(new THREE.Path(riverPoly(rv, D.riverHW).map(([x, z]) => new THREE.Vector2(x, -z)))); }
  const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); return g;   // (x, −z) и завъртане −90° → z като в света, лицето нагоре
}
function wallRibbon(pts, y0, y1) { const pos = [], idx = []; pts.forEach((p, i) => { pos.push(p[0], y0, p[1], p[0], y1, p[1]); if (i) { const k = 2 * i; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); } }); return { pos, idx }; }
function romeRiver(G, D) {
  const Wt = [], Wl = []; for (const rv of D.river.slice(0, 1)) {   /* второто парче на Тибъра в картата е застъпване на първото — две дупки една в друга чупят триангулацията */ Wt.push(ribbon(rivOf(rv), D.riverHW * 2 + 2, -RIV_D + 1)); for (const sg of [1, -1]) Wl.push(wallRibbon(offLine(rivOf(rv), sg * D.riverHW), -RIV_D, 0.02)); }
  G.add(merge(Wt, MAT.water)); const wm = merge(Wl, new THREE.MeshStandardMaterial({ color: TRAV, roughness: 0.95, side: THREE.DoubleSide })); G.add(wm);
  // остров Тиберина: каменни стени до водата и плато на нивото на улицата
  const I = D.island, isl = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, RIV_D, 40), new THREE.MeshStandardMaterial({ color: TRAV, roughness: 0.95 })); isl.scale.set(I.w / 2, 1, I.d / 2); isl.rotation.y = I.rot; isl.position.set(I.x, -RIV_D / 2 + 0.05, I.z); isl.receiveShadow = true; G.add(isl);
  romeBridges(G, D);
}
// мостовете от картата (всички „Ponte …“, и пешеходните): фасада с арки (екструдиран профил), платно, парапети; Сант'Анджело — статуи по парапетите, Систо — „окото“
function romeBridges(G, D) {
  const K = D.k, at = (la, lo) => [(lo - D.center[1]) * Math.cos(D.center[0] * Math.PI / 180) * 111320 * K, -(la - D.center[0]) * 110540 * K];
  const SISTO = at(41.8925, 12.4706), lmSA = (D.landmarks || []).find(l => l.k === 'castelsantangelo');
  const stone = new THREE.MeshStandardMaterial({ color: TRAV, roughness: 0.9 }), pave = MAT.walk, statues = [];
  for (const r of D.roads) { if (!r.bridge || !/^Ponte|Köprüsü/.test(r.nm || '')) continue;
    const a = r.pts[0], b = r.pts[r.pts.length - 1], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 8) continue;
    const ux = dx / L, uz = dz / L, W = r.cls === 'blvd' ? 17 : r.noCars ? 9 : 11, H = RIV_D;
    // профил (u по моста, v нагоре): правоъгълник с арки; Систо — кръгъл отвор над средния стълб
    const sh = new THREE.Shape(); sh.moveTo(0, -H); sh.lineTo(L, -H); sh.lineTo(L, -0.05); sh.lineTo(0, -0.05); sh.closePath();
    const n = Math.max(1, Math.round(L / 16)), pier = Math.min(4, L / n * 0.2), span = (L - pier * (n + 1)) / n;
    for (let k = 0; k < n; k++) { const x0 = pier + k * (span + pier), rr = span / 2, top = Math.min(-1.4, -H + 0.6 + rr); const h = new THREE.Path(); h.moveTo(x0, -H - 0.1); h.lineTo(x0 + span, -H - 0.1); h.lineTo(x0 + span, top - rr); h.absarc(x0 + rr, top - rr, rr, 0, Math.PI, false); h.lineTo(x0, -H - 0.1); sh.holes.push(h); }
    if (Math.hypot((a[0] + b[0]) / 2 - SISTO[0], (a[1] + b[1]) / 2 - SISTO[1]) < 40 && n >= 2) { const e = new THREE.Path(); e.absarc(pier + Math.floor(n / 2) * (span + pier) - pier / 2, -2.3, 1.1, 0, Math.PI * 2, true); sh.holes.push(e); }   // „окото“ на Понте Систо
    const g = new THREE.ExtrudeGeometry(sh, { depth: W, bevelEnabled: false, curveSegments: 10 }); g.translate(0, 0, -W / 2);
    const m = new THREE.Mesh(g, stone); m.castShadow = m.receiveShadow = true; m.position.set(a[0], 0, a[1]); m.rotation.y = -Math.atan2(uz, ux); G.add(m);
    // платното (паваж за пешеходните, асфалт за другите) и парапетите
    const deck = new THREE.Mesh(new THREE.BoxGeometry(L, 0.2, W - 2.4), r.noCars ? pave : MAT.asph); deck.position.set((a[0] + b[0]) / 2, -0.06, (a[1] + b[1]) / 2); deck.rotation.y = -Math.atan2(uz, ux); deck.receiveShadow = true; G.add(deck);
    for (const sg of [1, -1]) { const pr = new THREE.Mesh(new THREE.BoxGeometry(L, 1.1, 0.5), stone); pr.position.set((a[0] + b[0]) / 2 - uz * sg * (W / 2 - 0.25), 0.55, (a[1] + b[1]) / 2 + ux * sg * (W / 2 - 0.25)); pr.rotation.y = -Math.atan2(uz, ux); pr.castShadow = true; G.add(pr);
      if (lmSA && r.nm === "Ponte Sant'Angelo") for (let k = 1; k <= 5; k++) { const t = k / 6; statues.push([a[0] + dx * t - uz * sg * (W / 2 - 0.25), a[1] + dz * t + ux * sg * (W / 2 - 0.25)]); } }
  }
  if (statues.length) {   // ангелите на Бернини: постамент + фигура (инстанции)
    const base = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 1.2, 0.9), stone, statues.length), fig = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.4, 2.2, 8), new THREE.MeshStandardMaterial({ color: 0xf0ece2, roughness: 0.6 }), statues.length), wing = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.8, 0.12), new THREE.MeshStandardMaterial({ color: 0xf0ece2, roughness: 0.6 }), statues.length), M3 = new THREE.Matrix4();
    statues.forEach(([x, z], i) => { base.setMatrixAt(i, M3.makeTranslation(x, 2.1, z)); fig.setMatrixAt(i, M3.makeTranslation(x, 3.8, z)); wing.setMatrixAt(i, M3.makeTranslation(x, 4.3, z)); }); [base, fig, wing].forEach(o => { o.castShadow = true; G.add(o); });
  }
}
// ---- градска среда (инстанции; дребното се крие отдалеч): улични лампи (римски фенери), платани по кейовете, светофари по фазите
// на трафика (traffic.js → tr.signals), знаци „Стоп“ на второстепенните, пейки и кошчета по площадите, фонтани, спирки
function furniture(G, P) {
  const FURN = new THREE.Group(); G.add(FURN); let SIG = {};
  const stone = M(0x8a8478), iron = M(0x2a2c2e), lampG = new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffd88a, emissiveIntensity: 0.2 });
  const lamps = [], trees = [], benches = [], bins = [], stops = [], signs = [], fountains = [], at = (rd, s) => { const L = rd.L; let i = 1; while (i < L.length - 1 && L[i] < s) i++; const a = rd.pts[i - 1], b = rd.pts[i], t = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  const nearNode = (x, z) => P.nodes.some(n => n.arms.length >= 3 && Math.abs(n.x - x) < 30 && Math.abs(n.z - z) < 30 && Math.hypot(n.x - x, n.z - z) < (n.r || 6) + 4);
  for (const rd of P.roads) {
    const T = rd.L[rd.L.length - 1], main = rd.cls !== 'street', step = rd.cls === 'quay' ? 24 : main ? 28 : 40, sides = main ? [1, -1] : [1];
    for (let s = 10; s < T - 6; s += step) { const [x, z, ux, uz] = at(rd, s); for (const sg of sides) { const o = rd.w / 2 + rd.walk - 0.5, px = x - uz * o * sg, pz = z + ux * o * sg; if (!nearNode(px, pz)) lamps.push([px, pz]); } }
    if (rd.median) for (let s = 14; s < T - 10; s += 30) { const [x, z] = at(rd, s); if (!nearNode(x, z)) trees.push([x, z, 7]); }   // дървета по разделителната ивица
    if (rd.cls === 'quay' || (P.osm && rd.cls === 'blvd')) for (let s = 6; s < T - 6; s += 11) { const [x, z, ux, uz] = at(rd, s); for (const sg of [1, -1]) { const o = rd.w / 2 + rd.walk * 0.55, px = x - uz * o * sg, pz = z + ux * o * sg; if (!nearNode(px, pz) && !(P.waterAt && P.waterAt(px, pz))) trees.push([px, pz, 11]); } }   // платаните по Лунготевере
    if (main && T > 120) for (let s = 60; s < T - 40; s += 260) { const [x, z, ux, uz] = at(rd, s), o = rd.w / 2 + rd.walk - 1.2; stops.push([x - uz * o, z + ux * o, Math.atan2(ux, uz)]); }   // спирки (с навес)
  }
  // площадите на забележителностите: пейки, кошчета, фонтан
  for (const L of P.lots.filter(q => q.lm || q.big === 'park')) { const R0 = Math.max(L.w, L.d) / 2 + (L.guard || 4) - 2;
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, x = L.x + Math.cos(a) * R0, z = L.z + Math.sin(a) * R0; (k % 3 ? benches : bins).push([x, z, a + Math.PI / 2]); }
    if (['navona', 'popolo', 'trevi', 'spanishsteps'].includes(L.lm) || L.big === 'park') fountains.push([L.x, L.z]); }
  // знаци „Стоп“ на второстепенните клонове без светофар
  for (const n of P.nodes) { if (n.ctrl !== 'yield' || n.kind === 'round') continue; for (const a of n.arms) if (!a.prio && a.stop) { const rd = P.roads[a.road], p = a.stop[1]; signs.push([p[0] + Math.sin(a.angle) * 0.8, p[1] - Math.cos(a.angle) * 0.8, -a.angle + Math.PI / 2]); } }
  const inst = (geo, mat, list, f, shadow = false) => { if (!list.length) return null; const im = new THREE.InstancedMesh(geo, mat, list.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
    list.forEach((it, i) => { f(it, v, q, sc, up); im.setMatrixAt(i, m.compose(v, q, sc)); }); im.castShadow = shadow; im.frustumCulled = false; FURN.add(im); return im; };
  const P1 = (x, y, z) => (it, v, q, sc, up) => { v.set(it[0], y, it[1]); q.setFromAxisAngle(up, it[2] || 0); sc.set(1, 1, 1); };
  inst(new THREE.CylinderGeometry(0.09, 0.14, 4.6, 6).translate(0, 2.3, 0), iron, lamps, P1(0, 0, 0), true);   // стълб
  inst(new THREE.CylinderGeometry(0.32, 0.18, 0.7, 6).translate(0, 4.75, 0), lampG, lamps, P1(0, 0, 0)).userData.lamp = 1;   // фенерът (свети нощем)
  inst(new THREE.CylinderGeometry(0.22, 0.32, 1, 6).translate(0, 0.5, 0), M(0x6b5a44), trees, (it, v, q, sc) => { v.set(it[0], 0, it[1]); q.identity(); sc.set(1, it[2] * 0.4, 1); }, true);
  inst(new THREE.IcosahedronGeometry(1, 0), M(0x5d8a3e), trees, (it, v, q, sc) => { v.set(it[0], it[2] * 0.62, it[1]); q.identity(); sc.set(it[2] * 0.33, it[2] * 0.28, it[2] * 0.33); }, true);
  inst(new THREE.BoxGeometry(1.8, 0.45, 0.55).translate(0, 0.45, 0), M(0x6d4c33), benches, P1(0, 0, 0), true);
  inst(new THREE.CylinderGeometry(0.28, 0.24, 0.9, 8).translate(0, 0.45, 0), iron, bins, P1(0, 0, 0));
  inst(new THREE.BoxGeometry(3.2, 0.12, 1.4).translate(0, 2.6, 0), new THREE.MeshStandardMaterial({ color: 0x9fc0d8, transparent: true, opacity: 0.55 }), stops, P1(0, 0, 0));   // навесът на спирката
  inst(new THREE.BoxGeometry(3.2, 2.5, 0.06).translate(0, 1.3, -0.65), new THREE.MeshStandardMaterial({ color: 0xcfe0ea, transparent: true, opacity: 0.35 }), stops, P1(0, 0, 0));
  inst(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5).translate(0, 1.2, 0), iron, signs, P1(0, 0, 0));
  inst(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 8).rotateX(Math.PI / 2).translate(0, 2.35, 0), M(0xc8202a), signs, P1(0, 0, 0));   // „Стоп“
  for (const [x, z] of fountains) { const f = new THREE.Group(), b = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.4, 0.8, 24), M(0xd8cdb4)), w = new THREE.Mesh(new THREE.CircleGeometry(3.6, 24).rotateX(-Math.PI / 2), MAT.wet), c = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 3, 10), M(0xd8cdb4)), t = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.5, 0.5, 14), M(0xd8cdb4));
    b.position.y = 0.4; w.position.y = 0.75; c.position.y = 2; t.position.y = 3.4; f.add(b, w, c, t); f.position.set(x, 0, z); f.traverse(o => { if (o.isMesh) o.castShadow = true; }); FURN.add(f); }
  // светофари: стълб вдясно преди стоп линията и глава с 3 лампи; лампите — по фазата на клона (lightsUpdate)
  const heads = []; for (const n of P.nodes) { if (n.ctrl !== 'signal') continue; n.arms.forEach((a, ai) => { if (!a.stop) return; const p = a.stop[1], ox = Math.cos(a.angle), oz = Math.sin(a.angle); heads.push({ node: n.id, arm: ai, x: p[0] + ox * 0.6 - oz * 0.9, z: p[1] + oz * 0.6 + ox * 0.9, rot: Math.atan2(ox, oz) }); }); }
  if (heads.length) {
    inst(new THREE.CylinderGeometry(0.07, 0.09, 3.4, 6).translate(0, 1.7, 0), iron, heads.map(h => [h.x, h.z]), P1(0, 0, 0), true);
    inst(new THREE.BoxGeometry(0.42, 1.1, 0.32).translate(0, 3.5, 0), M(0x1e2022), heads.map(h => [h.x, h.z, h.rot]), P1(0, 0, 0));
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 5, 3), new THREE.MeshBasicMaterial({ color: 0xffffff }), heads.length * 3), m = new THREE.Matrix4(), c = new THREE.Color(0x333333);
    heads.forEach((h, i) => [3.85, 3.5, 3.15].forEach((y, k) => { bulbs.setMatrixAt(i * 3 + k, m.makeTranslation(h.x + Math.sin(h.rot) * 0.17, y, h.z + Math.cos(h.rot) * 0.17)); bulbs.setColorAt(i * 3 + k, c); }));
    bulbs.frustumCulled = false; FURN.add(bulbs); SIG = { heads, bulbs };
  }
  return { FURN, SIG, lamps, lampMat: lampG };
}


// ---- основното
export function buildPlan2View(P, opts = {}) {
  mats();
  const G = new THREE.Group(), D = opts.osm ? { ...opts.osm, _models: opts.bridgeModels || {} } : null;   // bridgeModels: { bosphorus } — висящите мостове G.userData.plan = P;
  if (opts.offset) G.position.set(opts.offset[0], 0, opts.offset[1]);
  const RR = P.R * 1.6, g0 = new THREE.Mesh(new THREE.PlaneGeometry(RR * 2.4, RR * 2.4).rotateX(-Math.PI / 2), D ? MAT.urban : MAT.grass); g0.receiveShadow = true; if (D && D.sea) g0.geometry = seaGround(D.sea); else if (D) g0.geometry = romeGround(RR, D); G.add(g0); G.userData.groundMat = g0.material;   // Рим: дворовете и площадите — светъл камък, тревата — само в парковете
  if (P.coastZ) { const sh = new THREE.Shape(); sh.moveTo(-RR * 1.2, -RR * 1.2); for (let i = 0; i <= 80; i++) { const x = -RR * 1.2 + i * RR * 2.4 / 80; sh.lineTo(x, P.coastZ(x)); } sh.lineTo(RR * 1.2, -RR * 1.2); const wg = new THREE.ShapeGeometry(sh); wg.rotateX(Math.PI / 2); const wm = new THREE.Mesh(wg, MAT.water); wm.position.y = 0.02; G.add(wm);
    // бряг: пясъчна ивица по водата и крайбрежна алея до кея; пристанището — кей навътре във водата пред мястото му
    const cl = []; for (let x = -RR * 1.2; x <= RR * 1.2; x += 4) cl.push(x);
    const off = d => cl.map(x => [x, P.coastZ(x) + d]);
    const sand = ribbon(off(0.5), 5, 0.05), prom = ribbon(off(5.2), 4.2, 0.06);
    const sm = merge([sand], MAT.sand), pm = merge([prom], MAT.walk); G.add(sm, pm);
    const port = P.lots.find(L => L.big === 'port');
    if (port) { const rd = P.roads[port.front.road]; let best = rd.pts[0]; for (const q of rd.pts) if (Math.hypot(q[0] - port.x, q[1] - port.z) < Math.hypot(best[0] - port.x, best[1] - port.z)) best = q;
      const dz = P.coastZ(best[0]) - best[1], dir = Math.sign(dz) || -1;   // към водата
      const pier = new THREE.Mesh(new THREE.BoxGeometry(port.w * 0.8, 1.2, 70), MAT.pier); pier.position.set(best[0], 0.4, P.coastZ(best[0]) + dir * 35); pier.receiveShadow = true; G.add(pier);
      const sh = new THREE.Mesh(new THREE.BoxGeometry(port.w * 0.9, 9, port.d * 0.7), M(0x6f7f8f)); sh.position.set(port.x, 4.5, port.z); sh.rotation.y = port.rot; sh.castShadow = true; G.add(sh); }   // склад на пристанището
  }
  const W = [], As = [], Md = [], Pt = [], Is = [], trees = [], Cb = [];
  if (D) {   // истинската карта: Тибърът (ивица около оста), остров Тиберина, паркове и археологически зони, жп линиите към Термини
    if (D.sea) seaView(G, D, RR); else romeRiver(G, D);
    const I = D.island; if (I) { const isl = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), M(0xb9ad96)); isl.scale.set(I.w / 2, 1, I.d / 2); isl.rotation.y = I.rot; isl.position.set(I.x, 0.06, I.z); G.add(isl); }
    const gm = { park: M(0x6f9e4f), archaeo: M(0xb7b08a), cemetery: M(0x7d9468) };
    for (const g of P.greensSrc) { const sh = new THREE.Shape(g.poly.map(([x, z]) => new THREE.Vector2(x, z))); const ge = new THREE.ShapeGeometry(sh); ge.rotateX(Math.PI / 2); const m = new THREE.Mesh(ge, gm[g.kind] || gm.park); m.material.side = THREE.DoubleSide; m.position.y = 0.025; m.receiveShadow = true; G.add(m); }
    const Rl = []; for (const r of D.rail) Rl.push(ribbon(r, 3.2, 0.05)); G.add(merge(Rl, M(0x8c8578)));
  }
  // пътят спира на ръба на кръговото; разделителната ивица — на ръба на всяко кръстовище
  const cut = (pts, n0, r0, n1, r1) => pts.filter(p => Math.hypot(p[0] - n0.x, p[1] - n0.z) >= r0 && Math.hypot(p[0] - n1.x, p[1] - n1.z) >= r1);
  // срезовете по дължината на пътя: кръгово — до пръстена; кръстовище — до очертанието му (arm.t от плана, + отместване)
  const ST = P.STOP || 4.6, armT = (n, rd, end, far) => { const a = n.arms.find(q => q.road === rd.id && q.end === end); return a && a.t != null ? (far ? a.t : a.t0 ?? a.t) : 0; };   // t0 — докъде е пътят; t — стоп линията (от плана)
  // срез t (по посоката на клона, както в плана) → разстояние по дъгата на пътя от този му край (иначе при извит път остава процеп)
  const sAt = (n, rd, end, t) => { const a = n.arms.find(q => q.road === rd.id && q.end === end); if (!a) return t; const u = [Math.cos(a.angle), Math.sin(a.angle)], L = rd.L, T = L[L.length - 1], N = rd.pts.length;
    let prev = 0, ps = 0; for (let k = 0; k < N; k++) { const i = end ? N - 1 - k : k, p = rd.pts[i], pr = (p[0] - n.x) * u[0] + (p[1] - n.z) * u[1], sk = end ? T - L[i] : L[i]; if (pr >= t) return k ? ps + (sk - ps) * (t - prev) / ((pr - prev) || 1) : sk; prev = pr; ps = sk; } return t; };
  const endCut = (n, rd, end, extra = 0, rpad = -0.5) => n.kind === 'round' ? P.rounds.find(r => r.node === n.id).outer + rpad : n.arms.length >= 3 ? sAt(n, rd, end, armT(n, rd, end, extra > 0) + extra) : 0;
  const atS = (rd, s) => { const L = rd.L; let i = 1; while (i < L.length - 1 && L[i] < s) i++; const a = rd.pts[i - 1], b = rd.pts[i], t = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], u: [(b[0] - a[0]) / l, (b[1] - a[1]) / l] }; };
  // срезът на една страна на пътя (sg: +1 — лявата спрямо посоката на pts): при началото на пътя лявата е лявата на клона (tL), при края — дясната (tR)
  const sideCut = (n, rd, end, sg) => { if (n.kind === 'round') return P.rounds.find(r => r.node === n.id).outer + 0.2; const a = n.arms.length >= 3 && n.arms.find(q => q.road === rd.id && q.end === end); if (!a || a.tL == null) return 0; return sAt(n, rd, end, (end === 0) === (sg > 0) ? a.tL : a.tR); };
  const trimS = (rd, s0, s1) => { const L = rd.L, T = L[L.length - 1]; if (T - s0 - s1 < 0.5) return []; const out = [atS(rd, s0).p]; for (let k = 0; k < L.length; k++) if (L[k] > s0 + 0.05 && L[k] < T - s1 - 0.05) out.push(rd.pts[k]); out.push(atS(rd, T - s1).p); return out; };
  for (const rd of P.roads) { const nA = P.nodes[rd.from], nB = P.nodes[rd.to], T = rd.L[rd.L.length - 1], ov = n => n.arms.length >= 3 && n.kind !== 'round' ? 2 : 0, c0 = Math.max(0, endCut(nA, rd, 0) - ov(nA)), c1 = Math.max(0, endCut(nB, rd, 1) - ov(nB)), pr = trimS(rd, c0, c1); if (pr.length < 2) continue;   // асфалтът влиза 2 м под кръстовището — без процеп при извит път
    (rd.noCars ? W : As).push(ribbon(pr, rd.w, rd.noCars ? 0.05 : 0.07));   // пешеходна — паваж
    for (const sg of [1, -1]) { const ps = trimS(rd, sideCut(nA, rd, 0, sg), sideCut(nB, rd, 1, sg)); if (ps.length > 1) { const q = P.osm ? ps.filter((_, k) => k % 2 === 0 || k === ps.length - 1) : ps; W.push(ribbon(offLine(q, sg * (rd.w / 2 + rd.walk / 2)), rd.walk, 0.04)); if (!P.osm || rd.cls !== 'street') Cb.push(ribbon(offLine(q, sg * (rd.w / 2 + 0.15)), 0.3, 0.09)); } }   // Рим: по-рядка геометрия, бордюр само по главните   // тротоар и бордюр — до среза на своята страна
    if (rd.median) {   // разделителната ивица свършва зад стоп линията с нос (стеснява се до 0,4 м)
      const m0 = endCut(nA, rd, 0, ST + 3.2), m1 = endCut(nB, rd, 1, ST + 3.2), pm = trimS(rd, m0, m1); if (pm.length < 2 || T - m0 - m1 < 4) continue; Md.push(ribbon(pm, rd.median, 0.1));   // късият път между две близки кръстовища — без ивица
      for (const [n, s, dir] of [[nA, m0, -1], [nB, T - m1, 1]]) { if (n.arms.length < 3 || n.kind === 'round') continue; const A2 = atS(rd, s), B2 = atS(rd, s + dir * 3), v = [-A2.u[1], A2.u[0]], hw = rd.median / 2;
        Md.push(quad([A2.p[0] + v[0] * hw, A2.p[1] + v[1] * hw], [A2.p[0] - v[0] * hw, A2.p[1] - v[1] * hw], [B2.p[0] - v[0] * 0.2, B2.p[1] - v[1] * 0.2], [B2.p[0] + v[0] * 0.2, B2.p[1] + v[1] * 0.2], 0.1)); } }
    else if (rd.cls === 'street') { const sA = endCut(nA, rd, 0, ST + 1, 2), sB = T - endCut(nB, rd, 1, ST + 1, 2); for (let s = sA + 2; s < sB - 2; s += 7) { const a = atS(rd, s).p, b = atS(rd, Math.min(sB, s + 3)).p; Pt.push(ribbon([a, b], 0.18, 0.12)); } } }
  // кръстовищата: асфалтът по очертанието (ветрило от възела), тротоарът и бордюрът — по заоблените ъгли; правият ръб при Т остава прав
  const fan = (cx, cz, pts, y) => {   // многоъгълникът на кръстовището — истинска триангулация (earcut): не винаги се вижда целият от възела
    const ps = pts.filter((p, k) => k === 0 || Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1]) > 0.01), tri = THREE.ShapeUtils.triangulateShape(ps.map(p => new THREE.Vector2(p[0], p[1])), []), pos = [], idx = [];
    ps.forEach(p => pos.push(p[0], y, p[1])); for (const [a, b, c] of tri) { const o = (ps[b][0] - ps[a][0]) * (ps[c][1] - ps[a][1]) - (ps[b][1] - ps[a][1]) * (ps[c][0] - ps[a][0]); if (o < 0) idx.push(a, b, c); else idx.push(a, c, b); } return { pos, idx }; };
  const bez = (p0, c, p1, m = 10) => Array.from({ length: m + 1 }, (_, k) => { const t = k / m, u = 1 - t; return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]; });
  const Ap = [], Fl = [[], [], []], rTrees = [];
  for (const n of P.nodes) { if (n.arms.length < 3 || n.kind === 'round' || !n.outline) continue;
    As.push(fan(n.x, n.z, n.outline, 0.075));
    for (const c of n.corners) { const curve = c.c ? bez(c.p0, c.c, c.p1) : [c.p0, c.p1], ww = Math.min(P.roads[n.arms[c.a].road].walk, P.roads[n.arms[c.b].road].walk);
      const mid = curve[curve.length >> 1], tst = offLine(curve, 1)[curve.length >> 1], sg = Math.hypot(tst[0] - n.x, tst[1] - n.z) > Math.hypot(mid[0] - n.x, mid[1] - n.z) ? 1 : -1;
      W.push(ribbon(offLine(curve, sg * ww / 2), ww, 0.045)); Cb.push(ribbon(offLine(curve, sg * 0.15), 0.3, 0.09)); }
  }
  for (const t of P.turns) { W.push(disc(t.x, t.z, t.r + 2.5, 0.045)); As.push(disc(t.x, t.z, t.r, 0.075)); }
  // маркировка по пътищата: бордюри до среза; булевард — крайни линии, линии до разделителната ивица, прекъснати между лентите (до стоп линията)
  for (const rd of P.roads) {
    const nA = P.nodes[rd.from], nB = P.nodes[rd.to];
    const pl = trimS(rd, endCut(nA, rd, 0, ST, 0.2), endCut(nB, rd, 1, ST, 0.2)); if (pl.length < 2) continue;
    if (rd.cls !== 'street') { for (const sg of [1, -1]) { Pt.push(ribbon(offLine(pl, sg * (rd.w / 2 - 0.4)), 0.15, 0.12)); if (rd.median) Pt.push(ribbon(offLine(pl, sg * (rd.median / 2 + 0.3)), 0.15, 0.12)); if (rd.lanes[0] > 1) dashed(offLine(pl, sg * (rd.median / 2 + rd.laneW)), 3, 6, 0.15, 0.12, Pt); } }
  }
  // стоп линии (от плана: на t + STOP) и зебри между стоп линията и кръстовището (светофар — на всички клонове; предимство — на второстепенните)
  const zebra = (n, a, d0) => { const rd = P.roads[a.road], ux = Math.cos(a.angle), uz = Math.sin(a.angle), vx = -uz, vz = ux, c = [n.x + ux * d0, n.z + uz * d0];
    for (let t = -rd.w / 2 + 0.6; t <= rd.w / 2 - 0.4; t += 1.1) { const p = [c[0] + vx * t, c[1] + vz * t]; Pt.push(ribbon([[p[0] - ux * 1.6, p[1] - uz * 1.6], [p[0] + ux * 1.6, p[1] + uz * 1.6]], 0.55, 0.13)); } };
  for (const n of P.nodes) { if (n.arms.length < 3 || n.kind === 'round') continue;
    for (const a of n.arms) { if (a.stop) Pt.push(ribbon(a.stop, 0.45, 0.13)); if (n.ctrl === 'signal' || (n.ctrl === 'yield' && !a.prio)) zebra(n, a, (a.t || n.r) + 2.3); } }
  // кръгови: пръстен с бордюри и линии, павирана ивица около острова, трева с цветя и дървета, фонтан; на входовете — островче, „отстъпи“, зебра
  for (const r of P.rounds) { const n = P.nodes[r.node];
    W.push(disc(r.x, r.z, r.outer + 2.5, 0.045)); As.push(disc(r.x, r.z, r.outer, 0.075, r.island));
    Cb.push(ribbon(circle(r.x, r.z, r.outer + 0.15), 0.3, 0.09)); Pt.push(ribbon(circle(r.x, r.z, r.outer - 0.45), 0.15, 0.12)); Pt.push(ribbon(circle(r.x, r.z, r.island + 0.4), 0.15, 0.12));
    Ap.push(disc(r.x, r.z, r.island, 0.12, r.island - 2.4)); Cb.push(ribbon(circle(r.x, r.z, r.island), 0.3, 0.14)); Cb.push(ribbon(circle(r.x, r.z, r.island - 2.4), 0.3, 0.2)); Is.push(disc(r.x, r.z, r.island - 2.4, 0.2));
    const bedR = (r.island - 2.4) * 0.72; for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; Fl[k % 3].push(disc(r.x + Math.cos(a) * bedR, r.z + Math.sin(a) * bedR, 0.9 + (r.island > 10 ? 0.6 : 0), 0.24, 0, 12)); if (k % 2 === 0 && r.island > 10) rTrees.push([r.x + Math.cos(a + 0.3) * bedR * 0.7, r.z + Math.sin(a + 0.3) * bedR * 0.7, 4.5]); }
    const f = new THREE.Group(), bR = Math.min(3.2, (r.island - 2.4) * 0.35); const basin = new THREE.Mesh(new THREE.CylinderGeometry(bR, bR + 0.2, 0.6, 24), MAT.stone); basin.position.y = 0.5; const water = new THREE.Mesh(new THREE.CircleGeometry(bR - 0.25, 24).rotateX(-Math.PI / 2), MAT.wet); water.position.y = 0.82;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.4, 12), MAT.stone); col.position.y = 1.6; const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.4, 0.4, 16), MAT.stone); bowl.position.y = 2.9;
    f.add(basin, water, col, bowl); f.position.set(r.x, 0, r.z); f.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); G.add(f);
    for (const a of n.arms) { const rd = P.roads[a.road], ux = Math.cos(a.angle), uz = Math.sin(a.angle), vx = -uz, vz = ux, o0 = r.outer + 0.4, o1 = r.outer + 13, sg = P.drive === 'R' ? 1 : -1;
      const sw0 = rd.median ? rd.median / 2 + 0.6 : 1.6, sw1 = rd.median ? rd.median / 2 : 0.25;   // островчето между входа и изхода (при булеварда — носът на разделителната ивица)
      const at = (d, t) => [r.x + ux * d + vx * t, r.z + uz * d + vz * t];
      W.push(quad(at(o0, -sw0), at(o0, sw0), at(o1, sw1), at(o1, -sw1), 0.11)); Cb.push(ribbon([at(o0, -sw0), at(o1, -sw1)], 0.25, 0.13)); Cb.push(ribbon([at(o0, sw0), at(o1, sw1)], 0.25, 0.13)); Cb.push(ribbon([at(o0, -sw0), at(o0, sw0)], 0.25, 0.13));
      dashed([at(o0 + 0.3, -sg * (sw0 + 0.2)), at(o0 + 0.3, -sg * (rd.w / 2 - 0.2))], 0.6, 0.45, 0.4, 0.13, Pt);   // „отстъпи“ на влизащата лента
      zebra(n, a, r.outer + 7.5); }
  }
  if (rTrees.length) trees.push(...rTrees);
  G.add(merge(W, MAT.walk), merge(As, MAT.asph), merge(Md, MAT.median), merge(Is, MAT.island), merge(Cb, MAT.curb), merge(Ap, MAT.apron)); Fl.forEach((f, i) => f.length && G.add(merge(f, MAT.flower[i]))); if (Pt.length) G.add(merge(Pt, MAT.paint));
  // дърветата на парковете (големите места park) и на островите на кръговите
  for (const L of P.lots) if (L.big === 'park') for (let k = 0; k < Math.floor(L.w * L.d / 70); k++) { const h = 4 + (k * 7 % 5), u = ((k * 0.7548776662 + 0.5) % 1 - 0.5) * (L.w - 6), v = ((k * 0.5698402910 + 0.5) % 1 - 0.5) * (L.d - 6), c = Math.cos(L.rot), s = Math.sin(L.rot); trees.push([L.x + u * c + v * s, L.z - u * s + v * c, h]); }
  if (trees.length) {
    const tg = new THREE.CylinderGeometry(0.2, 0.3, 1, 6).translate(0, 0.5, 0), cg = new THREE.IcosahedronGeometry(1, 0), T1 = new THREE.InstancedMesh(tg, M(0x6b4a2e), trees.length), T2 = new THREE.InstancedMesh(cg, M(0x4f8a3a), trees.length), m = new THREE.Matrix4();
    trees.forEach(([x, z, h], i) => { T1.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(1, h * 0.45, 1))); T2.setMatrixAt(i, m.compose(new THREE.Vector3(x, h * 0.55, z), new THREE.Quaternion(), new THREE.Vector3(h * 0.3, h * 0.3, h * 0.3))); });
    T2.castShadow = true; T1.frustumCulled = T2.frustumCulled = false; G.add(T1, T2);
  }
  // градската среда и светофарите
  const F = opts.furniture === false ? null : furniture(G, P);
  // светли петна под фенерите (нощем): един InstancedMesh с адитивна радиална текстура
  let pools = null;
  if (F && F.lamps.length && opts.lampGlow !== false) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 1, 32, 32, 31); gr.addColorStop(0, 'rgba(255,214,140,0.9)'); gr.addColorStop(0.5, 'rgba(255,190,110,0.3)'); gr.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6 }), F.lamps.length);
    const m = new THREE.Matrix4(); F.lamps.forEach(([x, z], i) => pools.setMatrixAt(i, m.makeTranslation(x, 0.15, z))); pools.visible = false; pools.frustumCulled = false; F.FURN.add(pools);
  }
  // Рома Термини (opts.termini): гарата по фасадата към площада (opts.stationModel — моделът на играта, иначе кутия) и перони с навеси и коловози отзад
  const TL = opts.termini ? P.lots.find(L => L.lm === 'termini' || L.lm === 'sirkeci') : null;   // главната гара: Термини (Рим), Сиркеджи (Истанбул)
  if (TL) G.add(terminiView(TL, opts.stationModel));
  // надписите на картата: водите (Златният рог, Босфорът…, Тибър) и кварталите — спрайтове, отблизо се скриват
  const LB = D && opts.labels !== false ? mapLabels(G, D) : null;
  const BT = D && D.sea && opts.boats !== false ? seaTraffic(G, D, opts.boatModels || {}) : null;   // Истанбул: фериботи по линиите, кораби по Босфора, лодки в Златния рог
  // фоновите римски квартали — фасади с покриви (за парцелите, които играта не ползва: opts.fillLot)
  const BL = D && opts.blocks !== false ? romeBlocks(G, P, D.style) : null;
  const refill = () => { if (BL) BL.fill(opts.fillLot || (() => true)); };
  refill();
  let sigT = 0;
  const off = opts.offset || [0, 0];
  Object.assign(G.userData, {
    blocks: BL ? BL.list : [], refill, hideBlocks: set => BL && BL.hide(set), nightMats: F ? [F.lampMat] : [],
    lamps: F ? F.lamps.filter((_, i) => i % Math.max(1, Math.ceil(F.lamps.length / 160)) === 0).map(([x, z]) => ({ x: x + off[0], y: 4.8, z: z + off[1] })) : [],   // за daynight.js (до 160)
    setNight(on) { if (F) F.lampMat.emissiveIntensity = on ? 2.2 : 0.2; if (pools) pools.visible = !!on; },
    // signals — tr.signals() на трафика (traffic.js); camera — дребното се крие отдалеч
    update(dt, o = {}) {
      if (F && o.camera) F.FURN.visible = o.camera.position.y < 420;
      if (LB && o.camera) LB.update(o.camera);
      if (BT) BT.update(dt);
      if (!F || !F.SIG.heads || !o.signals || (sigT = (sigT + 1) % 6)) return;
      const byNode = new Map(); for (const s2 of o.signals) byNode.set(s2.node, s2.arms || {});
      F.SIG.heads.forEach((h, i) => { const st = (byNode.get(h.node) || {})[h.arm], cols = SIG_C[st ? st.go : 'red'] || SIG_C.red; for (let k = 0; k < 3; k++) F.SIG.bulbs.setColorAt(i * 3 + k, SC.setHex(cols[k])); });
      F.SIG.bulbs.instanceColor.needsUpdate = true;
    },
    dispose() { G.traverse(o => { if (o.isInstancedMesh) o.dispose(); if (o.geometry) o.geometry.dispose(); }); },
  });
  return G;
}

// ---- надписи: [lat, lon, текст, вид] — вид 'w' (вода), 'd' (квартал)
const LABELS = {
  istanbul: [[41.0295, 28.9585, 'Златният рог', 'w'], [41.031, 29.012, 'Босфорът', 'w'], [40.995, 28.985, 'Мраморно море', 'w'],
    [41.0055, 28.977, 'Султанахмет', 'd'], [41.0165, 28.973, 'Еминьоню', 'd'], [41.0195, 28.952, 'Фатих', 'd'], [41.0225, 28.976, 'Каракьой', 'd'], [41.0262, 28.974, 'Галата', 'd'],
    [41.0335, 28.978, 'Бейоглу', 'd'], [41.0295, 28.95, 'Фенер', 'd'], [41.034, 28.948, 'Балат', 'd'], [41.0365, 28.987, 'Таксим', 'd'], [41.0315, 28.983, 'Джихангир', 'd'],
    [41.0265, 29.017, 'Ускюдар', 'd'], [40.9905, 29.027, 'Кадъкьой', 'd'], [41.0085, 29.015, 'Харем', 'd'], [41.0125, 28.958, 'Беязът', 'd'], [41.0085, 28.952, 'Аксарай', 'd'], [41.004, 28.959, 'Кумкапъ', 'd']],
  rome: [[41.9, 12.4765, '', ''], [41.8865, 12.4745, 'Тибър', 'w']],
  paris: [[48.8605, 2.3, 'Сена', 'w'], [48.8547, 2.3478, 'о. Сите', 'w'], [48.8517, 2.3567, 'о. Сен Луи', 'w'], [48.8705, 2.3655, 'канал Сен Мартен', 'w']],
};
const RIONI_BG = { Monti: 'Монти', Trevi: 'Треви', Esquilino: 'Есквилино', 'Castro Pretorio': 'Кастро Преторио', Colonna: 'Колона', 'Campo Marzio': 'Кампо Марцио', Trastevere: 'Трастевере', Prati: 'Прати', Ludovisi: 'Лудовизи', Sallustiano: 'Салустиано', Testaccio: 'Тестачо',
  Pigna: 'Пиня', "Sant'Eustachio": 'Сант Еустакио', Parione: 'Парионе', Regola: 'Регола', Ponte: 'Понте', Ripa: 'Рипа', Celio: 'Челио', 'San Saba': 'Сан Саба', "Sant'Angelo": 'Сант Анджело', Campitelli: 'Кампители', Borgo: 'Борго', Flaminio: 'Фламинио', Pinciano: 'Пинчано', Ostiense: 'Остиензе', Gianicolense: 'Джаниколензе', Aurelio: 'Аурелио' };
// Париж: „Paris 7e Arrondissement“ → „7-и арондисман“
const arrBg = nm => { const m = /^Paris (\d+)e/.exec(nm); if (!m) return nm; const n = +m[1], sfx = n === 1 ? 'ви' : n === 2 ? 'ри' : n === 3 || n === 4 ? 'ти' : 'и'; return `${n}-${sfx} арондисман`; };
function labelSprite(text, kind) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), F = kind === 'w' ? 'italic 600 46px Georgia, serif' : '700 38px system-ui, sans-serif';
  g.font = F; const w = Math.ceil(g.measureText(text).width) + 24; c.width = w; c.height = 64; g.font = F; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.lineWidth = 7; g.strokeStyle = kind === 'w' ? 'rgba(10,40,70,0.85)' : 'rgba(30,25,20,0.8)'; g.strokeText(text, w / 2, 34); g.fillStyle = kind === 'w' ? '#cfe8ff' : '#fff6e0'; g.fillText(text, w / 2, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false })); sp.renderOrder = 10; sp.userData.ar = w / 64; return sp;
}
function mapLabels(G, D) {
  const K = D.k, at = (la, lo) => [(lo - D.center[1]) * Math.cos(D.center[0] * Math.PI / 180) * 111320 * K, -(la - D.center[0]) * 110540 * K], out = [];
  for (const [la, lo, text, kind] of LABELS[D.style || 'rome'] || []) { if (!text) continue; const [x, z] = at(la, lo); out.push({ x, z, text, kind }); }
  for (const d of D.districts || []) { if (d.kind !== 'quarter' && !RIONI_BG[d.nm]) continue; const xs = d.poly.map(p => p[0]), zs = d.poly.map(p => p[1]); out.push({ x: xs.reduce((a, b) => a + b) / xs.length, z: zs.reduce((a, b) => a + b) / zs.length, text: RIONI_BG[d.nm] || arrBg(d.nm), kind: 'd' }); }
  const grp = new THREE.Group(); G.add(grp);
  const L = out.map(o => { const sp = labelSprite(o.text, o.kind); sp.position.set(o.x, o.kind === 'w' ? 6 : 30, o.z); grp.add(sp); return { sp, ...o }; });
  return { list: L, update(cam) {   // размерът — постоянен на екрана (по разстоянието); отблизо (под ~140 м) кварталите се крият, водите остават
    const h = cam.position.y; for (const l of L) { const d = Math.hypot(cam.position.x - l.x - G.position.x, cam.position.z - l.z - G.position.z, h), k = Math.max(10, d * (l.kind === 'w' ? 0.05 : 0.035)); l.sp.scale.set(k * l.sp.userData.ar, k, 1); l.sp.visible = l.kind === 'w' ? h > 60 : h > 140 && d < 3000; } } };
}
// ---- морски трафик: фериботите (процедурни — бели, два палуби, комин) по фериботните линии напред-назад със спиране на кея;
// танкери и контейнеровози по Босфора; лодки и платноходки в Златния рог. models: { tanker, container, small: [..] } — прототипи (по желание)
const LANES = { bosphorus: [[41.042, 29.026], [41.034, 29.012], [41.024, 29.006], [41.012, 28.999], [41.0, 28.992], [40.988, 28.98]], horn: [[41.0215, 28.976], [41.0265, 28.966], [41.031, 28.957], [41.036, 28.949]] };
function ferryModel() {
  const g = new THREE.Group(), white = M(0xf4f4f0), dark = M(0x2b2f36), yel = M(0xe7b416), win = M(0x3a5068);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 2.2, 32), white); hull.position.y = 1.1; const keel = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.9, 32.4), dark); keel.position.y = 0.2;
  const d1 = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.2, 24), white); d1.position.y = 3.3; const w1 = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.9, 22), win); w1.position.y = 3.4;
  const d2 = new THREE.Mesh(new THREE.BoxGeometry(5, 1.6, 12), white); d2.position.y = 5.2; const fun = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, 2.6, 10), yel); fun.position.set(0, 7.1, -2); const top = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.5, 10), dark); top.position.set(0, 8.6, -2);
  for (const o of [hull, keel, d1, w1, d2, fun, top]) { o.castShadow = true; g.add(o); } return g;
}
function seaTraffic(G, D, models) {
  const K = D.k, at = (la, lo) => [(lo - D.center[1]) * Math.cos(D.center[0] * Math.PI / 180) * 111320 * K, -(la - D.center[0]) * 110540 * K], grp = new THREE.Group(); grp.position.y = -1.0; G.add(grp);
  const boats = [], cum = p => { const L = [0]; for (let i = 1; i < p.length; i++) L.push(L[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])); return L; };
  const fit = (proto, len) => { if (!proto) return null; const o = proto.clone(true), w = new THREE.Group(), b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3()), long = sz.x > sz.z, k = len / Math.max(sz.x, sz.z); o.scale.setScalar(k); const b2 = new THREE.Box3().setFromObject(o), c = b2.getCenter(new THREE.Vector3()); o.position.set(-c.x, -b2.min.y - 0.6, -c.z); if (long) o.rotation.y = Math.PI / 2; w.add(o); return w; };
  const add = (obj, path, sp, mode, ph) => { if (!obj || path.length < 2) return; const L = cum(path); grp.add(obj); boats.push({ obj, path, L, T: L[L.length - 1], sp, mode, s: ph * L[L.length - 1], dir: 1, wait: 0 }); };
  // фериботите: еднаквите линии — веднъж; по един ферибот на линия (до 14)
  const seen = new Set(); let n = 0;
  for (const f of D.ferries || []) { if (f.pts.length < 2 || n >= 14) continue; const key = [f.pts[0], f.pts[f.pts.length - 1]].map(p => Math.round(p[0] / 40) + ',' + Math.round(p[1] / 40)).sort().join('|'); if (seen.has(key)) continue; seen.add(key); n++; add(fit(models.ferry, 34) || ferryModel(), f.pts, 7, 'shuttle', (n * 0.37) % 1); }   // моделът (Бандърма вапуру) или процедурният
  const bos = LANES.bosphorus.map(q => at(...q)), horn = LANES.horn.map(q => at(...q)), off = (p, d) => p.map(([x, z], i) => { const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [x - (b[1] - a[1]) / l * d, z + (b[0] - a[0]) / l * d]; });
  [[models.tanker, 95, 0.1, 1], [models.container, 110, 0.55, 1], [models.cruise, 120, 0.4, 1], [models.tanker, 85, 0.3, -1], [models.container, 100, 0.8, -1], [models.cruise, 110, 0.95, -1]].forEach(([m, len, ph, side]) => add(fit(m, len), off(side > 0 ? bos : bos.slice().reverse(), 40 * side), 9, 'loop', ph));   // двупосочно: всяка посока в своя половина
  (models.small || []).forEach((m, i) => add(fit(m, i % 2 ? 9 : 12), off(i % 2 ? horn : horn.slice().reverse(), (i % 3 - 1) * 25), 4, 'loop', (i * 0.29) % 1));
  const V = new THREE.Vector3();
  return { update(dt) { dt = Math.min(dt || 0, 0.1);
    for (const b of boats) {
      if (b.wait > 0) { b.wait -= dt; continue; }
      b.s += b.dir * b.sp * dt;
      if (b.mode === 'shuttle' && (b.s >= b.T || b.s <= 0)) { b.s = Math.max(0, Math.min(b.T, b.s)); b.dir *= -1; b.wait = 8; }   // на кея — 8 s
      if (b.mode === 'loop' && b.s >= b.T) b.s = 0;
      let i = 1; while (i < b.L.length - 1 && b.L[i] < b.s) i++; const a = b.path[i - 1], c = b.path[i], t = (b.s - b.L[i - 1]) / ((b.L[i] - b.L[i - 1]) || 1);
      b.obj.position.set(a[0] + (c[0] - a[0]) * t, 0, a[1] + (c[1] - a[1]) * t); b.obj.rotation.y = Math.atan2((c[0] - a[0]) * b.dir, (c[1] - a[1]) * b.dir);
    } } };
}
function terminiView(L, model) {
  const g = new THREE.Group(), nx = -Math.sin(L.rot), nz = -Math.cos(L.rot), tx = Math.cos(L.rot), tz = -Math.sin(L.rot), back = L.d * 0.3, len = 140, N = 9;
  const roof = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.5, metalness: 0.4 }), plat = M(0xb9b2a4), rail = M(0x5a544c), col = M(0x6d7278);
  // сградата: моделът, побран в предните 55 % от парцела, с лицето към площада
  const bw = L.w, bd = L.d * 0.55, bx = L.x - nx * (L.d - bd) / 2, bz = L.z - nz * (L.d - bd) / 2;
  if (model) { const o = model.clone(true), w = new THREE.Group(), inner = new THREE.Group(); inner.add(o); w.add(inner);
    let b = new THREE.Box3().setFromObject(inner), sz = b.getSize(new THREE.Vector3()); if ((sz.x > sz.z) !== (bw > bd)) { inner.rotation.y = Math.PI / 2; b = new THREE.Box3().setFromObject(inner); sz = b.getSize(new THREE.Vector3()); }
    const k = Math.min(bw / sz.x, bd / sz.z); inner.scale.setScalar(k); b = new THREE.Box3().setFromObject(inner); const c = b.getCenter(new THREE.Vector3()); inner.position.set(-c.x, -b.min.y, -c.z);
    w.position.set(bx, 0, bz); w.rotation.y = L.rot; w.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true; }); g.add(w); }
  else { const o = new THREE.Mesh(new THREE.BoxGeometry(bw, 12, bd), M(0xd8d2c4)); o.position.set(bx, 6, bz); o.rotation.y = L.rot; o.castShadow = true; g.add(o); }
  for (let i = 0; i < N; i++) { const u = (i - (N - 1) / 2) * (L.w * 0.9 / N), c = [L.x + tx * u + nx * (back + len / 2), L.z + tz * u + nz * (back + len / 2)];
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, len), plat), r2 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.25, len), roof), tr = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, len + 30), rail);
    for (const [o, y, off] of [[p2, 0.45, 0], [r2, 5.2, 0], [tr, 0.06, L.w * 0.45 / N]]) { o.position.set(c[0] + tx * off + nx * (o === tr ? 15 : 0), y, c[1] + tz * off + nz * (o === tr ? 15 : 0)); o.rotation.y = L.rot; o.castShadow = o !== tr; o.receiveShadow = true; g.add(o); }
    for (let k = -len / 2 + 8; k < len / 2; k += 16) { const cl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4.6, 6), col); cl.position.set(c[0] + nx * k, 2.9, c[1] + nz * k); g.add(cl); } }
  return g;
}
// Рим: затворено застрояване — по двете страни на всяка улица редица от сгради (14 м фасада, 15 м дълбочина, 13–21 м височина),
// в цветовете на Рим; не върху улица, вода, парк/археология или забележителност. Рисуват се като фасада + керемиден покрив (2 инстанции).
const ROMA = [0xd9a066, 0xc8794e, 0xe2c27a, 0xb5654a, 0xd8b48a, 0xe7d3a8, 0xc98f5b, 0xa9583f];
function romeBlocks(G, P, style) {
  const rg = new Map(), gc = 12, key = (x, z) => Math.floor(x / gc) + ',' + Math.floor(z / gc);
  P.roads.forEach(rd => rd.pts.forEach(p => { const k = key(p[0], p[1]); (rg.get(k) || rg.set(k, []).get(k)).push([p[0], p[1], rd.w / 2 + rd.walk + 0.8, rd.id]); }));
  const nearRoad = (x, z, own) => { const i = Math.floor(x / gc), j = Math.floor(z / gc); for (let a = i - 2; a <= i + 2; a++) for (let b = j - 2; b <= j + 2; b++) for (const [px, pz, r, id] of rg.get(a + ',' + b) || []) if (id !== own && Math.hypot(px - x, pz - z) < r) return true; return false; };
  const GB = (P.greensSrc || []).map(g => { const xs = g.poly.map(p => p[0]), zs = g.poly.map(p => p[1]); return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), g.poly]; }), green = (x, z) => GB.some(([x0, z0, x1, z1, poly]) => x >= x0 && x <= x1 && z >= z0 && z <= z1 && inPoly2([x, z], poly)), lms = P.lots.filter(L => L.lm), inLm = (x, z) => lms.some(L => Math.hypot(L.x - x, L.z - z) < Math.max(L.w, L.d) / 2 + (L.guard || 4) + 4);
  // парцелите (за fillLot): кой парцел е под мястото на сградата
  const lg = new Map(), lk = (x, z) => Math.floor(x / 40) + ',' + Math.floor(z / 40); for (const L of P.lots) { const k = lk(L.x, L.z); (lg.get(k) || lg.set(k, []).get(k)).push(L); }
  const lotAt = (x, z) => { const i = Math.floor(x / 40), j = Math.floor(z / 40); for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) for (const L of lg.get(a + ',' + b) || []) { const c = Math.cos(L.rot), s = Math.sin(L.rot), dx = x - L.x, dz = z - L.z; if (Math.abs(dx * c - dz * s) < L.w / 2 + 4 && Math.abs(dx * s + dz * c) < L.d / 2 + 4) return L; } return null; };
  const list = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const IST = style === 'istanbul', PAR = style === 'paris', DEP0 = IST ? 12 : 15, STEP = IST ? 10 : PAR ? 13 : 14, used = new Set();
  for (const rd of P.roads) { if (rd.w > 14) continue;
    const T = rd.L[rd.L.length - 1];
    for (let s = 6; s < T - 6; s += STEP) { let i = 1; while (i < rd.L.length - 1 && rd.L[i] < s) i++; const a = rd.pts[i - 1], b = rd.pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, t = (s - rd.L[i - 1]) / ((rd.L[i] - rd.L[i - 1]) || 1), ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l;
      for (const sg of [1, -1]) for (const DEP of IST ? [DEP0, 8] : [DEP0]) { const off = rd.w / 2 + rd.walk + 0.4 + DEP / 2, x = a[0] + (b[0] - a[0]) * t - uz * off * sg, z = a[1] + (b[1] - a[1]) * t + ux * off * sg;   // Истанбул: ако не се побира — по-плитка (8 м)
        const k = Math.round(x / 6) + ',' + Math.round(z / 6); if (used.has(k)) continue;
        let bad = false; for (const [dx, dz] of [[0, 0], [-uz * sg * DEP / 2, ux * sg * DEP / 2], [ux * STEP / 2, uz * STEP / 2], [-ux * STEP / 2, -uz * STEP / 2]]) { const px = x + dx, pz = z + dz; if (nearRoad(px, pz, rd.id) || P.waterAt(px, pz) || green(px, pz) || inLm(px, pz)) { bad = true; break; } }
        if (bad) continue; used.add(k);
        const h = ((rd.id * 7919 + Math.round(s) * 31 + (sg > 0 ? 17 : 0)) >>> 0) % 1000 / 1000, h2 = ((rd.id * 104729 + Math.round(s) * 13 + (sg > 0 ? 5 : 0)) >>> 0) % 1000 / 1000;
        // Истанбул: османски дървени къщи с еркери (историческият полуостров, Галата — европейският бряг) и бели жилищни блокове
        const ty = PAR ? 3 : !IST ? 0 : (x < 250 && h2 < 0.55) ? 1 : 2, H = ty === 1 ? 8 + h * 4 : ty === 2 ? 15 + h * 8 : ty === 3 ? 18 + h * 4 : 13 + h * 8, col = ty === 1 ? OTTO[Math.floor(h * OTTO.length)] : ty === 2 ? APT[Math.floor(h * APT.length)] : ty === 3 ? HAUSS[Math.floor(h * HAUSS.length)] : ROMA[Math.floor(h * ROMA.length)];   // Париж: османовите сгради — еднаква височина (~6 етажа)
        q.setFromAxisAngle(up, Math.atan2(ux, uz));
        list.push({ x, z, w: STEP, d: DEP, h: H, rot: Math.atan2(uz * sg, -ux * sg), t: ty, col, M: m.compose(new THREE.Vector3(x, H / 2, z), q, new THREE.Vector3(DEP, H, STEP + 0.3)).clone(), lot: lotAt(x, z) }); break; } } }
  // по вид: фасада (текстура) + покрив (римски — на две води; османски — нисък, тъмна керемида; блоковете — плосък)
  const FM = [facadeMat(), ottoMat(), aptMat(), haussMat()], RF = [[roofGeo(), 0xa8553a, 0.3], [roofGeo(), 0x8d4a34, 0.22], [new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), 0xb9b6ae, 0], [mansardGeo(), 0x5e6872, 0.35]];
  const parts = [0, 1, 2, 3].map(t => { const n = Math.max(1, list.filter(b => b.t === t).length), box = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), FM[t], n), roof = new THREE.InstancedMesh(RF[t][0], new THREE.MeshStandardMaterial({ color: RF[t][1], roughness: 0.85, side: THREE.DoubleSide }), n);
    box.frustumCulled = roof.frustumCulled = false; box.receiveShadow = box.castShadow = true; box.count = roof.count = 0; G.add(box, roof); return { box, roof }; });
  const V = new THREE.Vector3(), Q = new THREE.Quaternion(), Sc = new THREE.Vector3(), C = new THREE.Color();
  let hidden = null, fl = () => true;
  const draw = () => { const n = [0, 0, 0, 0];
    for (const b of list) { if ((b.lot && !fl(b.lot)) || (hidden && hidden.has(b))) continue; const t = b.t || 0, { box, roof } = parts[t], i = n[t]++;
      box.setMatrixAt(i, b.M); box.setColorAt(i, C.setHex(b.col)); b.M.decompose(V, Q, Sc);
      roof.setMatrixAt(i, m.compose(V.set(V.x, V.y + Sc.y / 2, V.z), Q, t === 2 ? Sc.set(Sc.x * 1.02, 0.6, Sc.z * 1.02) : Sc.set(Sc.x, Math.min(4, Sc.x * RF[t][2]), Sc.z))); }
    parts.forEach(({ box, roof }, t) => { box.count = roof.count = n[t]; box.instanceMatrix.needsUpdate = roof.instanceMatrix.needsUpdate = true; if (box.instanceColor) box.instanceColor.needsUpdate = true; }); };
  return { list, fill(f) { fl = f; draw(); }, hide(set) { hidden = set; draw(); } };
}
function inPoly2(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > p[1]) !== (zj > p[1]) && p[0] < (xj - xi) * (p[1] - zi) / (zj - zi) + xi) c = !c; } return c; }
const SIG_C = { red: [0xff2a20, 0x2a1210, 0x0f2010], yellow: [0x2a1210, 0xffc020, 0x0f2010], green: [0x2a1210, 0x2a2410, 0x30ff60] }, SC = new THREE.Color();
