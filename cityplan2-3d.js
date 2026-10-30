// cityplan2-3d.js — 3D изгледът на плана v2 (cityplan2.js): терен, улици, тротоари, бордюри, маркировка, кръстовища и кръгови,
// Тибърът в коритото с мостовете (Рим), паркове, жп линии, градска среда (фенери, платани, светофари, знаци, пейки, фонтани,
// спирки) и „фоновите“ римски квартали (фасади с керемидени покриви — за парцелите, които играта не ползва).
// БЕЗ сградите по парцелите — тях ги слага играта (или демото lab/plan2-3d.html). Всичко е слято или инстанцирано.
// buildPlan2View(P, opts) → THREE.Group; userData: { update(dt, { camera, signals }), setNight(on), refill(), lamps, groundMat, nightMats, blocks, dispose() }
// opts: { osm (данните от cityplan2-osm.js — за Рим), offset: [ox, oz] (изместване към рамката на играта), fillLot(lot) → bool, freeLot(lot) → bool (свободен за строеж — трева, ограда, табела),
//         blocks: true (фоновите квартали в Рим), furniture: true, lampGlow: true (собствени светли петна под фенерите) }
import * as THREE from 'three';
import { timesSquareAds } from './timessq-ads.js';   // Таймс Скуеър: светещите екрани с рекламите
import { makeWater } from './water.js';   // sea2: водата — общият шейдър с вълните
import { feature } from './lab/feature.js';
import { canvasTex, isEmpty } from './texdata.js';   // fac-data (T1): платната → собствени данни
import { varPick, varW, xParts, xDraw, bgPlace } from './bgblocks.js';   // bg-variety / bg-fill: разнообразните и допълнителните фонови сгради
import { crossingsOf } from './pedpaths.js';   // road-geo: зебрите — същите, по които пресичат пешеходците
import { streetReal, lampField, tlightField, lensGeo, pedGeo, lensMatrix, CLASSIC } from './streetreal.js';   // street-real: истинските лампи и светофари (opts.streetReal)
import { kremlinEnsemble } from './kremlin2.js';   // lm-kremlin2: Кремъл от моделите на потребителя (Meshy)
import { romeNear } from './romenear.js';
import { fwFx, fwWaterMat } from './fountainwater.js';   // ⛲ fountain-water: вода, струи и пръски във фонтаните
import { placeStatues, parkSpots } from './statues.js';   // statues: фонтаните и статуите в парковете, зелените площи и по булевардите (opts.statues)   // rome-bld: Рим отблизо — италианските сгради на местата на фасадите (opts.romeNear)
import { t as tr } from './i18n.js';
import { bridgesView } from './bridges.js';   // 🌉 bridges-real (f6): истинските мостове над реката (Париж, Лондон, Москва, Ню Йорк, Вашингтон)   // 🌐 lang-en: надписите на платното (f9, част C)

const M = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92 });
let MAT = null;
export function mats() {
  if (MAT) return MAT;
  MAT = { grass: M(0x7fa462), walk: M(0xc9c4b8), asph: M(0x3a3d42), median: M(0x5f9a45), island: M(0x6aa84f), water: feature('sea2') ? Object.assign(makeWater({ color: 0x2f86c8 }).material, { side: THREE.DoubleSide }) : new THREE.MeshStandardMaterial({ color: 0x3f7fb0, roughness: 0.2, metalness: 0.1, side: THREE.DoubleSide }), sand: M(0xd8c79a), pier: M(0xa9a59c), paint: M(0xf2f2ea) };
  for (const k of ['walk', 'asph', 'median', 'paint']) Object.assign(MAT[k], { polygonOffset: true, polygonOffsetFactor: { walk: -1, asph: -2, median: -3, paint: -4 }[k], polygonOffsetUnits: { walk: -1, asph: -2, median: -3, paint: -4 }[k] });

  const ASPH_T = ctex(256, (g, n) => { g.fillStyle = '#4a4d52'; g.fillRect(0, 0, n, n); for (let i = 0; i < 9000; i++) { const v = 60 + Math.random() * 40 | 0; g.fillStyle = `rgba(${v},${v},${v + 4},${Math.random() * 0.5})`; g.fillRect(Math.random() * n, Math.random() * n, 1.5, 1.5); } });
  const PAVE_T = ctex(256, (g, n) => { g.fillStyle = '#cbc6ba'; g.fillRect(0, 0, n, n); g.strokeStyle = 'rgba(120,112,100,0.55)'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * n / 4, 0); g.lineTo(i * n / 4, n); g.moveTo(0, i * n / 4); g.lineTo(n, i * n / 4); g.stroke(); } for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(90,85,75,${Math.random() * 0.15})`; g.fillRect(Math.random() * n, Math.random() * n, 2, 2); } });
  const COB_T = ctex(256, (g, n) => { g.fillStyle = '#9d8f7c'; g.fillRect(0, 0, n, n); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = 130 + Math.random() * 40 | 0; g.fillStyle = `rgb(${v},${v - 12},${v - 28})`; g.fillRect(x * 16 + (y % 2) * 8 + 1, y * 16 + 1, 14, 14); } }, 3);
  MAT.asph.map = ASPH_T; MAT.asph.color.setHex(0xffffff); MAT.walk.map = PAVE_T; MAT.walk.color.setHex(0xffffff);
  Object.assign(MAT, { urban: M(0xcdbf9f), curb: M(0xe2ded5), apron: new THREE.MeshStandardMaterial({ map: COB_T, roughness: 0.95 }), flower: [M(0xd8434b), M(0xf2c230), M(0x9b59c9)], stone: M(0xb9b2a4), wet: new THREE.MeshStandardMaterial({ color: 0x5aa6d6, roughness: 0.1, metalness: 0.2 }) });
  for (const k of ['curb', 'apron']) Object.assign(MAT[k], { polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
  return MAT;
}
function ctex(n, draw, rep2 = 1) { const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d', FCPU), n); const t = canvasTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep2, rep2); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
// ---- геометрия (слива се в малко мешове)
export function ribbon(pts, w, y, closed = false) {
  const pos = [], idx = [];
  for (let i = 0; i < pts.length; i++) { const a = pts[closed ? (i - 1 + pts.length) % pts.length : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % pts.length : Math.min(pts.length - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    pos.push(pts[i][0] - dz * w / 2, y, pts[i][1] + dx * w / 2, pts[i][0] + dz * w / 2, y, pts[i][1] - dx * w / 2); if (i) { const k = 2 * i; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } }
  return { pos, idx };
}
export function disc(x, z, r, y, r0 = 0, seg = 40) { const pos = [], idx = []; for (let k = 0; k <= seg; k++) { const a = k / seg * Math.PI * 2; pos.push(x + Math.cos(a) * r0, y, z + Math.sin(a) * r0, x + Math.cos(a) * r, y, z + Math.sin(a) * r); if (k) { const i = 2 * k; idx.push(i - 2, i, i - 1, i - 1, i, i + 1); } } return { pos, idx }; }
// сливане на плоските части (ленти, дискове, четириъгълници) в една геометрия: типизирани масиви наведнъж, нормалите — нагоре (всичко е хоризонтално)
export function merge(parts, mat, flat = true) { let nv = 0, ni = 0; for (const p of parts) { nv += p.pos.length; ni += p.idx.length; }
  const pos = new Float32Array(nv), uv = new Float32Array(nv / 3 * 2), nor = new Float32Array(nv), idx = nv / 3 > 65535 ? new Uint32Array(ni) : new Uint16Array(ni); let o = 0, oi = 0;
  for (const p of parts) { const b = o / 3, P0 = p.pos, I0 = p.idx; for (let i = 0; i < P0.length; i++) pos[o + i] = P0[i]; for (let i = 0; i < I0.length; i++) idx[oi + i] = I0[i] + b; o += P0.length; oi += I0.length; }
  for (let i = 0, j = 0; i < nv; i += 3, j += 2) { uv[j] = pos[i] / 6; uv[j + 1] = pos[i + 2] / 6; nor[i + 1] = 1; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  if (!flat) g.computeVertexNormals();   // отвесните (стените на коритото на Тибъра)
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m; }
// линии: изместена полилиния, прекъсната линия, напречна черта
export function offLine(pts, off) { return pts.map((p, k) => { const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [p[0] - (b[1] - a[1]) / l * off, p[1] + (b[0] - a[0]) / l * off]; }); }
export function dashed(pts, dash, gap, w, y, out) { let acc = 0, on = true, run = [pts[0]]; for (let i = 1; i < pts.length; i++) { let a = pts[i - 1]; const b = pts[i]; let d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  while (acc + d >= (on ? dash : gap)) { const need = (on ? dash : gap) - acc, t = need / d, q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; if (on) { run.push(q); out.push(ribbon(run, w, y)); } run = [q]; a = q; d -= need; acc = 0; on = !on; }
  acc += d; if (on) run.push(b); } if (on && run.length > 1) out.push(ribbon(run, w, y)); }
export const circle = (x, z, r, n = 64) => Array.from({ length: n + 1 }, (_, k) => [x + Math.cos(k / n * Math.PI * 2) * r, z + Math.sin(k / n * Math.PI * 2) * r]);
// road-geo: бариера на правия край на улица (към бъдещ квартал / булевард без продължение): два стълба и греда на червено-бели ивици
let BAR_M = null;
function barrier(e, ang, w) {
  if (!BAR_M) { const c = document.createElement('canvas'); c.width = 128; c.height = 16; const g = c.getContext('2d', FCPU); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4f4f0' : '#d32f2f'; g.fillRect(i * 16, 0, 16, 16); } const t = canvasTex(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
    BAR_M = { beam: new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), post: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.5, metalness: 0.4 }), tex: t }; }
  const g = new THREE.Group(), L = Math.max(3, w - 0.6), beam = new THREE.Mesh(new THREE.BoxGeometry(L, 0.28, 0.14), BAR_M.beam);
  BAR_M.tex.repeat.set(Math.round(L / 2), 1); beam.position.y = 0.95; g.add(beam); g.userData.roadBar = true;   /* hw-interchanges (T2): краят, от който тръгва връзката към магистралата, я сваля */
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 8), BAR_M.post); p.position.set(sx * (L / 2 - 0.15), 0.55, 0); g.add(p); }
  g.position.set(e[0] + Math.cos(ang) * 1, 0, e[1] + Math.sin(ang) * 1); g.rotation.y = -(ang + Math.PI / 2);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g;
}
export function quad(a, b, c, d, y) { return { pos: [a[0], y, a[1], b[0], y, b[1], c[0], y, c[1], d[0], y, d[1]], idx: [0, 2, 1, 0, 3, 2] }; }
// ---- нощем светят прозорците на фоновите сгради: emissiveMap от фасадата — тъмните петна (прозорците) се намират като свързани области
// и половината светват топло (случайно, постоянно). Яркостта — emissiveIntensity (daynight.js: winMats → n × winK; демото — setNight).
// fac-reup (55): фасадите на фоновите сгради (платна 128–512 px, InstancedMesh) понякога излизаха черни — стените, не покривите
// (второ зареждане в същия профил, Париж и Вашингтон; в JS текстурите и материалите са същите като при нормалните). Платната се качват
// наново във видеокартата 3, 12 и 40 s след строежа и след всяко пълнене (евтино — малки са); GLB картинките (memfix tex-free) не се пипат.
const FREUP = feature('fac-reup'), RU_AT = [3, 12, 40, Infinity];
// fac-cpu (T1, 26.10): платната на фасадите — в паметта на процесора (willReadFrequently), не в ускорения 2D canvas: Chrome понякога
// изхвърля съдържанието на ускорените платна (при натоварена видеокарта) — те остават празни/черни и fac-reup няма какво да качи наново
export const FCPU = { willReadFrequently: true };
// fac-data (T1, 27.10): willReadFrequently не стига — Chrome пак губи съдържанието на платната (2D „contextlost“ при натоварване) и при всяко
// следващо качване (needsUpdate, нов материал, след загубен WebGL контекст) текстурата става черна. Затова платното се снима веднага след
// рисуването в собствени байтове (Uint8Array → DataTexture, редовете — обърнати, със същите mipmaps) и текстурата вече не зависи от живо платно.
export { canvasTex };   // fac-data: помощникът е в texdata.js (общ за всички модули)
function reupCanvas(G) { const seen = new Set(); G.traverse(o => { if (!o.isInstancedMesh) return; for (const m of [].concat(o.material)) { if (!m || seen.has(m)) continue; seen.add(m);
  for (const t of [m.map, m.emissiveMap]) if (t && (t.isCanvasTexture || t.isDataTexture) && t.image && t.image.width > 0) t.needsUpdate = true;   /* fac-data: вече DataTexture — качва се наново от собствените данни */ } }); }
const WIN_MATS = [];
export function winDrop(set) { for (let i = WIN_MATS.length - 1; i >= 0; i--) if (set.has(WIN_MATS[i])) WIN_MATS.splice(i, 1); }   // fix-stab (game.js winForget): материалите на стария град
// fac-data (T1, 27.10): ако платното на фасадата е било празно още при снимката (изгубено при рисуването) — резервна фасада направо в данните
// (светла стена, решетка от тъмни прозорци, партер), за да не е черна; броят — window.__facEmpty (за __dbg.facDiag)
function facFallback(t) {
  const { width: W, height: H, data: d } = t.image;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, win = y < H * 0.82 && (x % 16) >= 4 && (x % 16) < 12 && (y % 22) >= 5 && (y % 22) < 17, base = y >= H * 0.86;
    const c = win ? [58, 64, 74] : base ? [196, 188, 174] : [222, 214, 200]; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; }
  t.needsUpdate = true; if (typeof window !== 'undefined') window.__facEmpty = (window.__facEmpty || 0) + 1; console.warn('fac-data: празно платно на фасада — резервна фасада', W + 'x' + H);
}
export function nightWin(mat, c, o = {}) {   // export — и за bgblocks.js
  const MD = mat.map && mat.map.isDataTexture && mat.map.image && mat.map.image.data; if (MD && isEmpty(MD)) facFallback(mat.map);   // fac-data
  const W = c.width, H = c.height, src0 = c.getContext('2d', FCPU).getImageData(0, 0, W, H).data, src = isEmpty(src0) && MD && MD.length === W * H * 4 ? MD : src0, lab   /* празното платно — от данните (стъклото подава отделна маска cc) */ = new Int32Array(W * H).fill(-1), out = document.createElement('canvas'); out.width = W; out.height = H;
  const g = out.getContext('2d', FCPU), img = g.createImageData(W, H), D = img.data; let seed = o.seed || 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const dark = i => (src[i * 4] * 0.3 + src[i * 4 + 1] * 0.59 + src[i * 4 + 2] * 0.11) < (o.thr || 95);
  for (let i = 0; i < W * H; i++) { if (lab[i] >= 0 || !dark(i)) continue; const st = [i], px = []; lab[i] = i;
    while (st.length) { const k = st.pop(); px.push(k); const x = k % W, y = (k / W) | 0; for (const n of [x > 0 && k - 1, x < W - 1 && k + 1, y > 0 && k - W, y < H - 1 && k + W]) if (n !== false && lab[n] < 0 && dark(n)) { lab[n] = i; st.push(n); } }
    if (px.length < 6 || px.length > W * H / 20) continue;   // точки и линии — не са прозорци
    const VIV = feature('blk-night');   /* blk-night: блоковете нощем — повече светнали, по-разнообразни (жълто, кехлибарено, топло бяло, хладно бяло, синкаво — телевизор) */
    if (rnd() > (VIV ? Math.max(o.lit || 0.25, 0.42) : (o.lit || 0.25))) continue; const warm = rnd() < 0.9, k2 = VIV ? 0.6 + rnd() * 0.4 : 0.45 + rnd() * 0.4,   /* потребителят: „като дискотека“ — светнали ~25 %, по-тъмни, 10 % бели */ col = VIV ? (h => h < 0.42 ? [255, 160, 70] : h < 0.7 ? [255, 196, 110] : h < 0.83 ? [245, 222, 185] : h < 0.93 ? [190, 210, 255] : [90, 120, 255])(rnd()) : warm ? [255, 196, 110] : [200, 225, 255];
    for (const q of px) { D[q * 4] = col[0] * k2; D[q * 4 + 1] = col[1] * k2; D[q * 4 + 2] = col[2] * k2; } }
  for (let i = 3; i < D.length; i += 4) D[i] = 255;
  g.putImageData(img, 0, 0); const t = canvasTex(out); t.colorSpace = THREE.SRGBColorSpace;
  const R = o.rep ?? 2, RX = Array.isArray(R) ? R[0] : R, RY = Array.isArray(R) ? R[1] : R;   // [по хоризонтала, по вертикала]   // потребителят (чрез 2a): фасадите 2× по-ситно — двойно повече и по-малки прозорци; map и emissiveMap — еднакво, за да съвпадат
  if (mat.map) { if (RX !== 1 || RY !== 1) { mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping; mat.map.repeat.set(RX, RY); t.repeat.set(RX, RY); } t.wrapS = mat.map.wrapS; t.wrapT = mat.map.wrapT; }
  mat.emissive = new THREE.Color(0xffffff); mat.emissiveMap = t; mat.emissiveIntensity = 0; mat.userData.winK = o.k || 0.62; WIN_MATS.push(mat); return mat;
}
// повтаряща се фасада по истинските размери на инстанцията (небостъргачите не са разтеглени): uv × (ширина/период, височина/период)
export function tileByScale(mat, pw, ph) {   // ph = 0 — без повторение по височина (етажите са нарисувани на платното; bgblocks.js)
  mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping; if (mat.emissiveMap) mat.emissiveMap.wrapS = mat.emissiveMap.wrapT = THREE.RepeatWrapping;
  mat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
    #ifdef USE_INSTANCING
      vec3 tsc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
      vec2 trep = vec2((abs(normal.x) > 0.5 ? tsc.z : tsc.x) / ${pw.toFixed(1)}, ${ph ? 'tsc.y / ' + ph.toFixed(1) : '1.0'});
      #ifdef USE_MAP
        vMapUv *= trep;
      #endif
      #ifdef USE_EMISSIVEMAP
        vEmissiveMapUv *= trep;
      #endif
    #endif`); };
  mat.customProgramCacheKey = () => 'tile' + pw + 'x' + ph; return mat;
}
let FAC_MAT = null, lodRoof = null;
function facadeMat() {
  if (FAC_MAT) return FAC_MAT;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d', FCPU);
  g.fillStyle = '#f4ece0'; g.fillRect(0, 0, 128, 128);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) { const x = 14 + k * 38, y = 8 + r * 24; g.fillStyle = '#3d3a36'; g.fillRect(x + 5, y, 12, 16); g.fillStyle = '#5f7a4a'; g.fillRect(x, y, 5, 16); g.fillRect(x + 17, y, 5, 16); g.fillStyle = '#e8e0d2'; g.fillRect(x + 3, y + 16, 16, 2); }
  g.fillStyle = '#d9cfbf'; g.fillRect(0, 104, 128, 24); for (let k = 0; k < 3; k++) { g.fillStyle = '#4a4540'; g.beginPath(); g.moveTo(16 + k * 38, 128); g.lineTo(16 + k * 38, 112); g.arc(27 + k * 38, 112, 11, Math.PI, 0); g.lineTo(38 + k * 38, 128); g.fill(); }
  g.fillStyle = '#cfc5b4'; g.fillRect(0, 0, 128, 4);   // корниз
  const t = canvasTex(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return FAC_MAT = nightWin(new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), c, { seed: 91, thr: 125, rep: [2, 1] });
}
// Истанбул: османска къща — дъски, бели рамки на прозорците, еркер (cumba) на горните етажи; блок — светли балкони и парапети
// Париж: османова сграда — светъл варовик, високи прозорци с ковани балкони на 2-ри и 5-и етаж, партер с витрини; покрив — мансарда от цинк
// Лондон: тухлени терасни къщи (джорджиански) — светла тухлена зидария (тонът — от цвета на инстанцията), бели рамки на прозорците, тъмна врата с колонки
let BRICK_MAT = null;
const BRICK = [0x9a5a3e, 0xb06c4a, 0xc89c6a, 0xd2b07c, 0x8c4a36, 0xbfa07a, 0xa8664a];
const CITY = [0xe8e4da, 0xd9d6cf, 0xc9ccd0, 0xb8c2c8, 0xe2ddd0];   // Сити: офиси от портландски камък и стъкло
function brickMat() {
  if (BRICK_MAT) return BRICK_MAT;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d', FCPU);
  g.fillStyle = '#e6e0d8'; g.fillRect(0, 0, 128, 128); g.fillStyle = 'rgba(70,55,45,0.16)'; for (let y = 0; y < 128; y += 4) { g.fillRect(0, y, 128, 1); for (let x = (y / 4) % 2 ? 0 : 4; x < 128; x += 8) g.fillRect(x, y, 1, 4); }   // тухлите
  for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) { const x = 14 + k * 40, y = 8 + r * 25; g.fillStyle = '#f4f2ec'; g.fillRect(x - 2, y - 2, 18, 22); g.fillStyle = '#2c3440'; g.fillRect(x, y, 14, 18); g.fillStyle = '#f4f2ec'; g.fillRect(x, y + 8, 14, 1.5); g.fillRect(x + 6.3, y, 1.4, 18); }   // бели рамки, прозорци с плъзгащо се крило
  g.fillStyle = '#f2efe6'; g.fillRect(0, 106, 128, 3); g.fillStyle = '#1e2a24'; g.fillRect(56, 110, 16, 18); g.fillStyle = '#f4f2ec'; g.fillRect(52, 110, 3, 18); g.fillRect(73, 110, 3, 18);   // врата с колонки
  const t = canvasTex(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return BRICK_MAT = nightWin(new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 }), c, { seed: 117, rep: [2, 1] });
}
// Ню Йорк: стъклени небостъргачи (окачена фасада — синкаво стъкло с тънки метални профили); старите каменни сгради — тип 2 с NYST
const MOSC = [0xe8c88a, 0xf0dca8, 0xe9b98a, 0xf2e6cc, 0xd9a878, 0xe6d2a2, 0xf1d0c0, 0xdcc49c];   // Москва: охра, жълто, праскова, крем, розово (класицизъм и модерн)
const MOSB = [0x9a4a36, 0x8c3e2e, 0xa85840];   // червена тухла
let GLASS_MAT = null;
const GLASS = [0x9fb4c8, 0x8aa2b8, 0xb5c3cf, 0x7f95a8, 0xa8b8c4, 0x6f8598];
const NYST = [0xcfc6b4, 0xb9a58a, 0x9c8d7a, 0xd8d0c0, 0x8f7f6c, 0xc2b49c];
function glassMat() {
  if (GLASS_MAT) return GLASS_MAT;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d', FCPU);
  const gr = g.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, '#dfe8f0'); gr.addColorStop(1, '#aebfcd'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(40,50,60,0.55)'; for (let y = 0; y < 128; y += 8) g.fillRect(0, y, 128, 1.2); for (let x = 0; x < 128; x += 10.67) g.fillRect(x, 0, 1, 128);   // етажите и профилите
  const t = canvasTex(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; const cc = document.createElement('canvas'); cc.width = cc.height = 128; const g2 = cc.getContext('2d', FCPU); g2.fillStyle = '#fff'; g2.fillRect(0, 0, 128, 128); g2.fillStyle = '#000';
  for (let y = 0; y < 16; y++) for (let x = 0; x < 12; x++) g2.fillRect(Math.round(x * 10.67) + 2, y * 8 + 2, 7, 5);   // стъклото: всяка клетка (етаж × профил) — прозорец
  return GLASS_MAT = tileByScale(nightWin(new THREE.MeshStandardMaterial({ map: t, roughness: 0.25, metalness: 0.35 }), cc, { lit: 0.32, k: 0.8, seed: 99, rep: 1 }), 16, 48);   // 12 профила ≈ 16 м, 16 етажа ≈ 48 м
}
let HAUSS_MAT = null;
const HAUSS = [0xf0e6d2, 0xe9dcc3, 0xf3ead9, 0xe4d6bd, 0xeee2cc];
function haussMat() {
  if (HAUSS_MAT) return HAUSS_MAT;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d', FCPU);
  g.fillStyle = '#f6efe2'; g.fillRect(0, 0, 128, 128); g.fillStyle = 'rgba(120,105,85,0.25)'; for (let y = 0; y < 128; y += 21) g.fillRect(0, y, 128, 1.5);   // корнизите на етажите
  for (let r = 0; r < 5; r++) for (let k = 0; k < 4; k++) { const x = 9 + k * 30, y = 6 + r * 21; g.fillStyle = '#3a4250'; g.fillRect(x, y, 12, 15); g.fillStyle = '#e8dcc6'; g.fillRect(x - 2, y - 2, 16, 2); }
  g.fillStyle = '#1d2024'; for (const y of [27, 90]) { g.fillRect(0, y, 128, 2); for (let x = 0; x < 128; x += 3) g.fillRect(x, y - 4, 1, 4); }   // ковани балкони (2-ри и 5-и етаж)
  g.fillStyle = '#d9cdb5'; g.fillRect(0, 108, 128, 20); g.fillStyle = '#2f3a44'; for (let k = 0; k < 4; k++) g.fillRect(6 + k * 31, 111, 22, 17);   // витрините
  const t = canvasTex(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return HAUSS_MAT = nightWin(new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), c, { seed: 117, rep: [2, 1] });
}
function mansardGeo() { const g = new THREE.BufferGeometry(), v = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5, -0.3, 1, -0.5, 0.3, 1, -0.5, 0.3, 1, 0.5, -0.3, 1, 0.5];   // мансарда: стръмни скатове и плосък връх
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex([0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2]); g.computeVertexNormals(); return g; }
let OTTO_MAT = null, APT_MAT = null;
const OTTO = [0xd9a066, 0xe8c6a0, 0xc97d5d, 0xa9c4cf, 0xb7c9a0, 0xe2d6c0, 0x8a5a3c, 0xd4a9a9], APT = [0xf2efe6, 0xe9e3d4, 0xf3e8d2, 0xe0dcd2, 0xefe2c8];
function ottoMat() {
  if (OTTO_MAT) return OTTO_MAT;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d', FCPU);
  g.fillStyle = '#f4ece0'; g.fillRect(0, 0, 128, 128); g.strokeStyle = 'rgba(80,60,40,0.25)'; g.lineWidth = 1; for (let y = 2; y < 128; y += 5) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }   // дъски
  g.fillStyle = 'rgba(60,45,30,0.35)'; g.fillRect(34, 8, 60, 56); g.fillStyle = '#f7f3ea'; g.fillRect(36, 10, 56, 52);   // еркерът (по-светъл, със сянка)
  for (const [x, y] of [[40, 16], [58, 16], [76, 16], [40, 40], [58, 40], [76, 40], [8, 22], [106, 22], [8, 46], [106, 46]]) { g.fillStyle = '#ffffff'; g.fillRect(x - 1, y - 1, 14, 18); g.fillStyle = '#35404a'; g.fillRect(x, y, 12, 16); }
  g.fillStyle = '#ffffff'; g.fillRect(0, 70, 128, 3); g.fillStyle = '#4a3a2c'; g.fillRect(52, 90, 24, 38); g.fillStyle = '#35404a'; for (const x of [12, 96]) g.fillRect(x, 92, 18, 22);   // корниз, вратата, прозорците на партера
  const t = canvasTex(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return OTTO_MAT = nightWin(new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }), c, { seed: 104, rep: [2, 1] });
}
function aptMat() {
  if (APT_MAT) return APT_MAT;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d', FCPU);
  g.fillStyle = '#f6f3ec'; g.fillRect(0, 0, 128, 128);
  for (let r = 0; r < 5; r++) for (let k = 0; k < 4; k++) { const x = 6 + k * 31, y = 4 + r * 22; g.fillStyle = '#4a5866'; g.fillRect(x, y, 20, 13); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x - 3, y + 13, 26, 4); g.fillStyle = '#d8d4cc'; g.fillRect(x - 3, y + 12, 26, 2); }   // прозорци и балкони
  g.fillStyle = '#c9c4ba'; g.fillRect(0, 114, 128, 14); g.fillStyle = '#3e4a54'; for (let k = 0; k < 4; k++) g.fillRect(8 + k * 31, 116, 18, 12);   // партер — магазини
  const t = canvasTex(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return APT_MAT = tileByScale(nightWin(new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), c, { seed: 91, rep: 1 }), 12, 16);
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
// растерът — разширен с m клетки на всяка страна (крайните клетки се повтарят навън: сушата и протоците продължават) — Истанбул: парцелите и улиците
// стигат до ~210 м извън растера (city-size), а там нямаше суша, само водната равнина (къщите „във водата“)
function seaPad(sea, m) {
  const NX = sea.nx, NZ = sea.nz, W = NX + 2 * m, H = NZ + 2 * m, land = new Uint8Array(NX * NZ); let at = 0, v = 0;
  for (const n of sea.runs) { if (!v) land.fill(1, at, Math.min(at + n, land.length)); at += n; v ^= 1; }
  const runs = []; let cur = 1, len = 0;   // първата серия — суша (може и 0), както в seaGround
  for (let j = 0; j < H; j++) { const r = Math.min(NZ - 1, Math.max(0, j - m)) * NX;
    for (let i = 0; i < W; i++) { const l = land[r + Math.min(NX - 1, Math.max(0, i - m))]; if (l === cur) len++; else { runs.push(len); cur = l; len = 1; } } }
  runs.push(len); return { ...sea, x0: sea.x0 - m * sea.cell, z0: sea.z0 - m * sea.cell, nx: W, nz: H, runs };
}
function seaGround(sea) {
  const pos = [], idx = [];   // серии по редове: runs са по целия растер — тук се режат на редове
  const NX = sea.nx; let at = 0, v = 0;
  for (const n of sea.runs) { let a = at, left = n; while (left > 0) { const j = Math.floor(a / NX), i = a % NX, len = Math.min(left, NX - i);
      if (!v) { const x0 = sea.x0 + i * sea.cell, x1 = x0 + len * sea.cell, z0 = sea.z0 + j * sea.cell, z1 = z0 + sea.cell, b = pos.length / 3; pos.push(x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1); idx.push(b, b + 2, b + 1, b, b + 3, b + 2); }
      a += len; left -= len; }
    at += n; v ^= 1; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// banks-smooth (f6): същата суша, но с плавен бряг — полето „суша“ във върховете на клетките (средно от съседните клетки, размито още веднъж),
// изолинията 0,5 с интерполация по ръбовете (marching squares): пълните клетки — слети в серии по редове, граничните — изрязани по линията
// (Sutherland–Hodgman на квадрата); общите ръбове се интерполират еднакво — без пролуки
function seaGroundSmooth(sea, wallD = 0) {   // wallD — bridges-real: каменните стени на кея до водата (м)
  const NX = sea.nx, NZ = sea.nz, C = sea.cell, land = new Uint8Array(NX * NZ); let at = 0, v = 0;
  for (const n of sea.runs) { if (!v) land.fill(1, at, Math.min(at + n, land.length)); at += n; v ^= 1; }
  const VX = NX + 1, VZ = NZ + 1, F0 = new Float32Array(VX * VZ), F = new Float32Array(VX * VZ);
  for (let j = 0; j < VZ; j++) for (let i = 0; i < VX; i++) { let s = 0, c = 0; for (let dj = -1; dj <= 0; dj++) for (let di = -1; di <= 0; di++) { const x = i + di, z = j + dj; if (x < 0 || z < 0 || x >= NX || z >= NZ) continue; s += land[z * NX + x]; c++; } F0[j * VX + i] = c ? s / c : 0; }
  for (let j = 0; j < VZ; j++) for (let i = 0; i < VX; i++) { let s = 0, c = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const x = i + di, z = j + dj; if (x < 0 || z < 0 || x >= VX || z >= VZ) continue; const w = di || dj ? 1 : 2; s += F0[z * VX + x] * w; c += w; } F[j * VX + i] = s / c; }
  const pos = [], idx = [], T = 0.5, P = (x, z) => { pos.push(x, 0, z); return pos.length / 3 - 1; };
  for (let j = 0; j < NZ; j++) { let run = -1;
    const flush = i => { if (run < 0) return; const x0 = sea.x0 + run * C, x1 = sea.x0 + i * C, z0 = sea.z0 + j * C, z1 = z0 + C, b = P(x0, z0); P(x1, z0); P(x1, z1); P(x0, z1); idx.push(b, b + 2, b + 1, b, b + 3, b + 2); run = -1; };
    for (let i = 0; i < NX; i++) {
      const q = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], f = q.map(([x, z]) => F[z * VX + x]), inN = f.filter(x => x >= T).length;
      if (inN === 4) { if (run < 0) run = i; continue; }
      flush(i); if (!inN) continue;
      const poly = [], cr = []; for (let k = 0; k < 4; k++) { const a = k, b = (k + 1) % 4, fa = f[a], fb = f[b];
        if (fa >= T) poly.push(q[a]);
        if ((fa >= T) !== (fb >= T)) { const t = (T - fa) / (fb - fa), c = [q[a][0] + (q[b][0] - q[a][0]) * t, q[a][1] + (q[b][1] - q[a][1]) * t]; poly.push(c); cr.push(c); } }
      if (wallD) for (let k = 0; k + 1 < cr.length; k += 2) { const [x0, z0] = cr[k], [x1, z1] = cr[k + 1], X0 = sea.x0 + x0 * C, Z0 = sea.z0 + z0 * C, X1 = sea.x0 + x1 * C, Z1 = sea.z0 + z1 * C, w0 = pos.length / 3;
        pos.push(X0, 0, Z0, X1, 0, Z1, X1, -wallD, Z1, X0, -wallD, Z0, X0, 0, Z0, X1, 0, Z1, X1, -wallD, Z1, X0, -wallD, Z0); idx.push(w0, w0 + 1, w0 + 2, w0, w0 + 2, w0 + 3, w0 + 4, w0 + 6, w0 + 5, w0 + 4, w0 + 7, w0 + 6); }   // стената — от двете страни (посоката на изолинията не е еднаква), отделни върхове — иначе нормалите се унищожават
      if (poly.length < 3) continue; const b0 = pos.length / 3; for (const [x, z] of poly) P(sea.x0 + x * C, sea.z0 + z * C);
      for (let k = 1; k < poly.length - 1; k++) idx.push(b0, b0 + k + 1, b0 + k);
    }
    flush(NX); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// ---- Москва: Кремъл (процедурно) — червените стени по истинския триъгълник с кулите (Спаската — най-висока), вътре камбанарията
// „Иван Велики“, катедралите със златни куполи, Големият дворец и Сенатът; ГУМ; паважът на Червения площад и на двора. Всичко — инстанции.
const KREML = [[55.74885, 37.61265], [55.74975, 37.62135], [55.75055, 37.62355], [55.75255, 37.62155], [55.75455, 37.61905], [55.75565, 37.61745], [55.75315, 37.61575], [55.75165, 37.61425], [55.75005, 37.61305]];
const KR_TALL = { 3: 71, 5: 61, 0: 61, 2: 46 };   // Спаската (на площада), Арсеналната, Водовзводната, Беклемишевската — м
function kremlinView(G, D) {
  const K = D.k, at = (la, lo) => [(lo - D.center[1]) * Math.cos(D.center[0] * Math.PI / 180) * 111320 * K, -(la - D.center[0]) * 110540 * K];
  const K2 = feature('lm-kremlin2') && D._kremlin && D._kremlin.parts ? kremlinEnsemble(G, D, D._kremlin, floodMats) : null;   // lm-kremlin2: стената, кулите и дворецът — моделите (kremlin2.js); оттук — само ГУМ и паважът
  const poly = K2 ? K2.poly : KREML.map(([la, lo]) => at(la, lo)), red = M(0xa8402e), green = M(0x3f6b4c), white = M(0xf1ece0), gold = new THREE.MeshStandardMaterial({ color: 0xe6b84a, roughness: 0.3, metalness: 0.8 }), cream = M(0xeadcb8), yellow = M(0xe8cf8a);
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), cone = new THREE.ConeGeometry(0.5, 1, 4).translate(0, 0.5, 0).rotateY(Math.PI / 4), dome = new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.6, 1);
  const L = { box: { red: [], green: [], white: [], cream: [], yellow: [], glass: [] }, cone: { green: [], red: [] }, dome: { gold: [], green: [] } }, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const put = (kind, col, x, z, w, h, d, y = 0, ang = 0) => L[kind][col].push(m4.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(up, ang), new THREE.Vector3(w, h, d)).clone());
  // стените: отсечки по многоъгълника (височина 12 м, дебелина 4,5 м) + зъбци; кули по върховете и през ~45 м
  if (!K2) for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[0] - a[0], b[1] - a[1]);
    put('box', 'red', (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 4.5, 12, len, 0, ang);
    for (let s2 = 2; s2 < len - 1; s2 += 3.2) put('box', 'red', a[0] + (b[0] - a[0]) * s2 / len, a[1] + (b[1] - a[1]) * s2 / len, 4.5, 2, 1.4, 12, ang);   // ласточкины хвосты — зъбците
    const n = Math.max(1, Math.round(len / 45));
    for (let k = 0; k < n; k++) { const t = k / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, H = k ? 24 : (KR_TALL[i] || 34), w = k ? 8 : 11;
      put('box', 'red', x, z, w, H * 0.62, w, 0, ang); put('box', 'red', x, z, w * 0.7, H * 0.18, w * 0.7, H * 0.62, ang); put('cone', 'green', x, z, w * 0.8, H * 0.38, w * 0.8, H * 0.8, ang);
      if (!k && KR_TALL[i]) put('dome', 'gold', x, z, 1.6, 2, 1.6, H * 1.18); } }   // звездите/върховете на главните кули
  // вътре: център на триъгълника
  const cx = poly.reduce((s3, p) => s3 + p[0], 0) / poly.length, cz = poly.reduce((s3, p) => s3 + p[1], 0) / poly.length;
  const [px, pz] = at(55.7503, 37.6160), [sx, sz] = at(55.7520, 37.6198), [ix, iz] = at(55.7508, 37.6176);
  if (!K2) { put('box', 'cream', px, pz, 125, 24, 50, 0, 0.35); put('box', 'green', px, pz, 125, 4, 50, 24, 0.35);   // Големият кремълски дворец
  put('box', 'yellow', sx, sz, 95, 22, 70, 0, 0.75); put('box', 'green', sx, sz, 95, 3, 70, 22, 0.75); put('dome', 'green', sx, sz, 24, 14, 24, 25);   // Сенатът с купола
  put('box', 'white', ix, iz, 13, 60, 13); put('box', 'white', ix, iz, 10, 16, 10, 60); put('dome', 'gold', ix, iz, 10, 12, 10, 76);   // „Иван Велики“ (81 м)
  for (const [la, lo, s4] of [[55.7505, 37.6167, 1], [55.7499, 37.6174, 0.8], [55.7509, 37.6185, 0.75]]) { const [x, z] = at(la, lo);   // катедралите: Успенска, Архангелска, Благовещенска — бели, по 5 златни купола
    put('box', 'white', x, z, 30 * s4, 22 * s4, 38 * s4); for (const [dx, dz, k2] of [[0, 0, 1.3], [-8, -9, 1], [8, -9, 1], [-8, 9, 1], [8, 9, 1]]) { put('box', 'white', x + dx * s4, z + dz * s4, 4 * k2 * s4, 6 * s4, 4 * k2 * s4, 22 * s4); put('dome', 'gold', x + dx * s4, z + dz * s4, 6 * k2 * s4, 6 * k2 * s4, 6 * k2 * s4, 28 * s4); } } }   /* !K2 */
  const [gx, gz] = at(55.7547, 37.6215);   // ГУМ — по дължината на Червения площад: светла фасада, стъклени покриви на пасажите
  if (feature('lm-gum') && D._gum) {   // lm-gum (f6): моделът от Blender (в метри; лицето — към −x, т.е. към Кремъл) в мащаба на картата
    const gm = D._gum.clone(true); gm.scale.setScalar(K); gm.rotation.y = 0.82; gm.position.set(gx, 0.05, gz);
    gm.traverse(o => { if (!o.isMesh) return; o.castShadow = o.receiveShadow = true; const m = o.material = o.material.clone();
      if (m.emissiveMap) { m.emissive = new THREE.Color(0xffffff); m.emissiveIntensity = 0; m.userData.winK = 1; m.userData.flood = 1; WIN_MATS.push(m); }   // нощната карта: прозорците и подсветката на фасадата
      else if (/glass/.test(m.name)) { m.emissive = new THREE.Color(0xffd9a0); m.emissiveIntensity = 0; m.userData.winK = 0.45; m.userData.flood = 1; WIN_MATS.push(m); } });   // стъклените покриви — леко светят отвътре
    floodMats(gm, 0xffd8a0, 0.3); G.add(gm);   // куличките, шатрите — осветени
  } else { put('box', 'cream', gx, gz, 70, 20, 200, 0, 0.82); for (const o of [-22, 0, 22]) { const ox2 = Math.cos(0.82) * o, oz2 = -Math.sin(0.82) * o; put('box', 'glass', gx + ox2, gz + oz2, 12, 5, 195, 20, 0.82); } }
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfd0cc, roughness: 0.2, metalness: 0.5 });
  const MAT2 = { red, green, white, cream, yellow, gold, glass }, GEO = { box, cone, dome };
  for (const kind in L) for (const col in L[kind]) { const arr = L[kind][col]; if (!arr.length) continue; const im = new THREE.InstancedMesh(GEO[kind], MAT2[col], arr.length); arr.forEach((mm, i) => im.setMatrixAt(i, mm)); im.castShadow = im.receiveShadow = true; G.add(im); }
  // паваж: дворът на Кремъл и Червеният площад (тъмен камък)
  const pave = new THREE.MeshStandardMaterial({ color: 0x6d625c, roughness: 0.95 }), sh = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const yard = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2), M(0xb9b09c)); yard.position.y = 0.06; yard.receiveShadow = true; G.add(yard);
  const rs = [[55.7553, 37.6178], [55.7558, 37.6195], [55.7526, 37.6233], [55.7521, 37.6216]].map(([la, lo]) => at(la, lo)), sh2 = new THREE.Shape(rs.map(([x, z]) => new THREE.Vector2(x, -z)));
  const sq = new THREE.Mesh(new THREE.ShapeGeometry(sh2).rotateX(-Math.PI / 2), pave); sq.position.y = 0.07; sq.receiveShadow = true; G.add(sq);
  return { cx, cz };
}
// (rail-tramcut) линията по повърхността (трамвай/метро) — без парчетата в лентата [x0, x1] (жп линията на насипа в Истанбул: T1 минаваше върху релсите)
function cutBand(pts, cut) {
  if (!cut) return [pts];
  const dense = [pts[0]]; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2)); for (let k = 1; k <= n; k++) dense.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
  const out = []; let cur = []; for (const p of dense) { if (p[0] > cut[0] && p[0] < cut[1]) { if (cur.length > 1) out.push(cur); cur = []; } else cur.push(p); }
  if (cur.length > 1) out.push(cur); return out;
}
// 🌊 osm-edge (собственикът, 30.10): градовете по OSM с рамка от суша (Ню Йорк, Париж, Лондон…) — реките свършваха с права линия на ръба на растера.
// Сега: всяка вода, която опира в ръба на растера, продължава навън до края на рамката по посоката на бреговете си (наклонът на двата бряга — от
// клетките навътре; бряг в ъгъла на растера е непознат → успореден на другия, широк поне 150 м). Жп линията на играта (edge.railX) остава на суша
// (коридор през водата — като насип). Извън плана — евтини ниски квартали (един InstancedMesh, без работа на кадър), без водата, плана и жп коридора.
// Всичко е в координатите на плана; F — докъде стига рамката.
function osmEdge(G, D, F, edge) {
  const S2 = D.sea, NX = S2.nx, NZ = S2.nz, C = S2.cell, X0 = S2.x0, Z0 = S2.z0, X1 = X0 + NX * C, Z1 = Z0 + NZ * C, wat = new Uint8Array(NX * NZ); let at = 0, v = 0;
  for (const n of S2.runs) { if (v) wat.fill(1, at, Math.min(at + n, wat.length)); at += n; v ^= 1; }
  const W = (i, j) => i >= 0 && j >= 0 && i < NX && j < NZ && wat[j * NX + i] === 1, MINW = 450 / C, K = Math.min(60, Math.floor(Math.min(NX, NZ) / 4)), quads = [];
  // 1) лентите: серии вода по ръба → четириъгълник навън по наклона на бреговете
  const runsAt = (fixed, byRow, n) => { const out = []; let st = -1; for (let k = 0; k <= n; k++) { const w = k < n && (byRow ? W(k, fixed) : W(fixed, k)); if (w && st < 0) st = k; else if (!w && st >= 0) { if (k - st >= 15) out.push([st, k - 1]); st = -1; } } return out; };   // ≥ 45 м — без каналите
  const near = (L, a0, a1) => L.reduce((b, r) => { const o = Math.min(r[1], a1) - Math.max(r[0], a0); return o > (b ? Math.min(b[1], a1) - Math.max(b[0], a0) : -1) ? r : b; }, null);
  for (const [e, byRow, fixed, inStep, n] of [['N', true, 0, 1, NX], ['S', true, NZ - 1, -1, NX], ['W', false, 0, 1, NZ], ['E', false, NX - 1, -1, NZ]]) {
    for (const [a0, a1] of runsAt(fixed, byRow, n)) {
      if (a0 === 0 && a1 === n - 1) continue;   // цялата страна е вода — продължението идва от съседните страни
      const inner = near(runsAt(fixed + inStep * K, byRow, n), a0, a1); let s0 = inner ? (inner[0] - a0) / K : 0, s1 = inner ? (inner[1] - a1) / K : 0;
      const c0 = a0 === 0, c1 = a1 === n - 1; if (c0 && !c1) s0 = s1; if (c1 && !c0) s1 = s0;
      if (Math.abs(s0 - s1) > 0.12) s0 = s1 = (s0 + s1) / 2;   // бреговете на реката — почти успоредни (иначе ветрило навън)
      // бряг в ъгъла — непознат: успореден на другия; ако серията е по-тясна от 450 м — разширява се плавно навън (за 600 м), без стъпало до растера
      const T = F / C, TP = 600 / C, P = (along, out) => { const u = along * C, d = out * C; return e === 'N' ? [X0 + u, Z0 - d] : e === 'S' ? [X0 + u, Z1 + d] : e === 'W' ? [X0 - d, Z0 + u] : [X1 + d, Z0 + u]; };
      const g0 = c0 && !c1 ? Math.max(0, MINW - (a1 - a0)) : 0, g1 = c1 && !c0 ? Math.max(0, MINW - (a1 - a0)) : 0;
      quads.push([P(a0, 0), P(a1 + 1, 0), ...(g1 ? [P(a1 + 1 - s1 * TP + g1, TP)] : []), P(a1 + 1 - s1 * T + g1, T), P(a0 - s0 * T - g0, T), ...(g0 ? [P(a0 - s0 * TP - g0, TP)] : [])]); } }
  const inPoly = (p, q) => { let c = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) if ((q[i][1] > p[1]) !== (q[j][1] > p[1]) && p[0] < (q[j][0] - q[i][0]) * (p[1] - q[i][1]) / (q[j][1] - q[i][1]) + q[i][0]) c = !c; return c; };
  // 2) заетото (решетка 10 м): улиците и парцелите на плана, растерът, жп коридорът
  const G10 = 10, gx0 = X0 - F, gz0 = Z0 - F, GW = Math.ceil((X1 - X0 + 2 * F) / G10), GH = Math.ceil((Z1 - Z0 + 2 * F) / G10), occ = new Uint8Array(GW * GH);
  const mark = (x0, z0, x1, z1, val = 1) => { const i0 = Math.max(0, Math.floor((x0 - gx0) / G10)), i1 = Math.min(GW - 1, Math.floor((x1 - gx0) / G10)), j0 = Math.max(0, Math.floor((z0 - gz0) / G10)), j1 = Math.min(GH - 1, Math.floor((z1 - gz0) / G10)); for (let j = j0; j <= j1; j++) occ.fill(val, j * GW + i0, j * GW + i1 + 1); };
  for (const r of edge.roads || []) { const hw = (r.w || 8) / 2 + (r.walk || 2) + 4; for (let k = 1; k < r.pts.length; k++) { const a = r.pts[k - 1], b = r.pts[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0; s <= L; s += 5) { const x = a[0] + (b[0] - a[0]) * s / L, z = a[1] + (b[1] - a[1]) * s / L; mark(x - hw, z - hw, x + hw, z + hw); } } }
  for (const L of edge.lots || []) { const r = Math.hypot(L.w || 16, L.d || 16) / 2 + 6; mark(L.x - r, L.z - r, L.x + r, L.z + r); }
  const occAt = (x, z) => { const i = Math.floor((x - gx0) / G10), j = Math.floor((z - gz0) / G10); return i < 0 || j < 0 || i >= GW || j >= GH ? 0 : occ[j * GW + i]; };
  const rail = edge.railX != null ? { L: edge.railX - 40, R: edge.railX + 25, z0: edge.railZ ? edge.railZ[0] : -1e9, z1: edge.railZ ? edge.railZ[1] : 1e9 } : null;
  const inRail = (x, z, m = 0) => rail && x > rail.L - m && x < rail.R + m && z > rail.z0 - m && z < rail.z1 + m;
  // 3) водата: клетки 10 м в лентите, без заетото, растера и жп коридора — слети в серии по редове
  const pos = [], idx = []; let nw = 0;
  const bb = quads.map(q => [Math.min(...q.map(p => p[0])), Math.max(...q.map(p => p[0])), Math.min(...q.map(p => p[1])), Math.max(...q.map(p => p[1]))]);
  const isW = (x, z) => !(x > X0 && x < X1 && z > Z0 && z < Z1) && !occAt(x, z) && !inRail(x, z) && quads.some((q, k) => x >= bb[k][0] && x <= bb[k][1] && z >= bb[k][2] && z <= bb[k][3] && inPoly([x, z], q));
  for (let j = 0; j < GH; j++) { const z = gz0 + (j + 0.5) * G10; let st = -1;
    for (let i = 0; i <= GW; i++) { const w = i < GW && isW(gx0 + (i + 0.5) * G10, z); if (w && st < 0) st = i; else if (!w && st >= 0) { const xa = gx0 + st * G10, xb = gx0 + i * G10, za = gz0 + j * G10, zb = za + G10, b = pos.length / 3; pos.push(xa, 0.04, za, xb, 0.04, za, xb, 0.04, zb, xa, 0.04, zb); idx.push(b, b + 2, b + 1, b, b + 3, b + 2); nw++; st = -1; } } }
  if (idx.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); const m = new THREE.Mesh(g, MAT.water); m.name = 'osmEdgeWater'; m.receiveShadow = true; G.add(m); }
  // 4) ниските квартали: решетка 40 м с отместване; без водата, плана (+40 м), растера и жп коридора (+30 м); до ~2,2 км, все по-редки навън
  const B = edge.bnd || [], bx0 = Math.min(X0, ...B.map(p => p[0])), bx1 = Math.max(X1, ...B.map(p => p[0])), bz0 = Math.min(Z0, ...B.map(p => p[1])), bz1 = Math.max(Z1, ...B.map(p => p[1]));
  const hsh = (x, z) => { const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return h - Math.floor(h); }, M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3(), pts = [], R0 = 2200, ST = 40;
  const busy = (x, z) => occAt(x, z) || occAt(x - 40, z) || occAt(x + 40, z) || occAt(x, z - 40) || occAt(x, z + 40) || (B.length > 2 && inPoly([x, z], B)) || (x > X0 - 20 && x < X1 + 20 && z > Z0 - 20 && z < Z1 + 20);
  for (let x = bx0 - R0; x <= bx1 + R0; x += ST) for (let z = bz0 - R0; z <= bz1 + R0; z += ST) {
    const dd = Math.max(bx0 - x, x - bx1, bz0 - z, z - bz1, 0), r = hsh(x, z); if (r > 0.62 - dd / R0 * 0.42) continue;
    const px = x + (hsh(z, x) - 0.5) * 18, pz = z + (hsh(x + 3, z) - 0.5) * 18;
    if (busy(px, pz) || inRail(px, pz, 30) || isW(px, pz) || isW(px + 12, pz) || isW(px - 12, pz) || isW(px, pz + 12) || isW(px, pz - 12)) continue; pts.push([px, pz, r]); }
  if (pts.length) {
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), pts.length), col = new THREE.Color();
    pts.forEach(([x, z, r], i) => { const w = 12 + r * 16, d = 10 + hsh(z, x) * 14, h = 5 + hsh(x * 2, z) * 12; im.setMatrixAt(i, M4.compose(V.set(x, 0, z), Q.setFromAxisAngle(Sc.set(0, 1, 0), (r - 0.5) * 0.3), Sc.set(w, h, d)));
      im.setColorAt(i, col.setHSL(0.07 + r * 0.05, 0.12 + r * 0.1, 0.5 + hsh(x, z * 3) * 0.2)); });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.receiveShadow = true; im.name = 'osmEdgeSuburbs'; G.add(im); }
  G.userData.osmEdge = { bands: quads.length, waterRuns: nw, suburbs: pts.length };
}
function seaView(G, D, RR, cut = null, edge = null) {
  const S2 = D.sea, IN = D.style === 'paris' || D.style === 'london' || D.style === 'newyork' || D.style === 'moscow' || D.style === 'washington' || D.style === 'lasvegas', w = new THREE.Mesh(new THREE.PlaneGeometry(S2.nx * S2.cell * (IN ? 1 : 1.6), S2.nz * S2.cell * (IN ? 1 : 1.6)).rotateX(-Math.PI / 2), MAT.water); w.position.set(S2.x0 + S2.nx * S2.cell / 2, D.wY ?? -1.2, S2.z0 + S2.nz * S2.cell / 2); G.add(w);
  if (IN) {   // град без море (Париж — само реката): около растера — суша (рамка), не вода
    const W = S2.nx * S2.cell, H = S2.nz * S2.cell, F = 3000, fr = [[-F, -F, W + 2 * F, F], [-F, H, W + 2 * F, F], [-F, 0, F, H], [W, 0, F, H]].map(([x, z, w2, d2]) => new THREE.PlaneGeometry(w2, d2).rotateX(-Math.PI / 2).translate(S2.x0 + x + w2 / 2, 0, S2.z0 + z + d2 / 2));
    const OE = edge && feature('osm-edge'), frM = OE ? Object.assign(MAT.urban.clone(), { polygonOffset: true, polygonOffsetFactor: 3, polygonOffsetUnits: 3 }) : MAT.urban;   // osm-edge: рамката — зад водата, която продължава навън
    for (const f of fr) { const m = new THREE.Mesh(f, frM); m.receiveShadow = true; G.add(m); }
    if (OE) try { osmEdge(G, D, F, edge); } catch (e) { console.warn('osm-edge', e); } }
  const Pi = []; for (const p of D.piers || []) if (p.length > 1) Pi.push(ribbon(p, 4, -0.2)); if (Pi.length) G.add(merge(Pi, MAT.pier));
  const Fe = [], seenF = new Set(); for (const f of D.ferries || []) { const key = f.pts.length > 1 ? [f.pts[0], f.pts[f.pts.length - 1]].map(p => Math.round(p[0] / 40) + ',' + Math.round(p[1] / 40)).sort().join('|') : ''; if (seenF.has(key)) continue; seenF.add(key); dashed(f.pts, 5, 22, 0.7, (D.wY ?? -1.2) + 0.1, Fe); }   /* еднаквите линии (двете посоки) — веднъж */ if (Fe.length) G.add(merge(Fe, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })));   // фериботните линии по водата
  const Mt = []; for (const r of D.metro || []) if (r.kind !== 'rail') for (const pts of cutBand(r.pts, cut)) Mt.push(ribbon(pts, r.kind === 'tram' ? 2.2 : 2.6, 0.085)); if (Mt.length) G.add(merge(Mt, M(0x9a9184)));   // метро/трамвай на повърхността
  romeBridges(G, D);
  // висящите мостове (Босфорския): моделът — дължината по x, центриран; мащабът — от бряг до бряг
  for (const B of D.bigBridges || []) { const proto = (D._models || {})[B.k]; if (!proto) continue; floodMats(proto, 0xd8e8ff, 0.35);   // нощем — осветен (студено бяло, като Босфорския)
    const o = proto.clone(true); o.userData.extShared = 1; const bb = new THREE.Box3().setFromObject(o), len = Math.hypot(B.b[0] - B.a[0], B.b[1] - B.a[1]), k = len / (bb.max.x - bb.min.x);
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
  G.add(merge(Wt, MAT.water)); const wm = merge(Wl, new THREE.MeshStandardMaterial({ color: TRAV, roughness: 0.95, side: THREE.DoubleSide }), false); G.add(wm);
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
// ---- нощем улиците светят оранжево (като от самолет): адитивна ивица по всяка улица за коли — по-ярко по двата края (фенерите), по-тъмно
// в средата; черен цвят + emissive, така че денем (emissiveIntensity 0) не се вижда. Видима и отдалеч (за разлика от фенерите).
function streetGlow(G, P, style) {
  const parts = []; for (const rd of P.roads) if (!rd.noCars && rd.pts.length > 1) parts.push(ribbon(rd.pts, rd.w + 2 * (rd.walk || 2), 0.16));
  if (!parts.length) return null;
  const c = document.createElement('canvas'); c.width = 64; c.height = 1; const g = c.getContext('2d', FCPU), gr = g.createLinearGradient(0, 0, 64, 0);
  gr.addColorStop(0, '#000'); gr.addColorStop(0.12, '#d8d8d8'); gr.addColorStop(0.3, '#383838'); gr.addColorStop(0.5, '#202020'); gr.addColorStop(0.7, '#383838'); gr.addColorStop(0.88, '#d8d8d8'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 64, 1);
  const t = canvasTex(c), mat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: { rome: 0xff7a18, istanbul: 0xffb27a, paris: 0xffb860, london: 0xffa850, moscow: 0xffb070 }[style] ?? 0xff9a3a, emissiveMap: t, emissiveIntensity: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  mat.userData.winK = (style === 'rome' ? 0.85 : 0.75) * (feature('road-glow-soft') ? 0.5 : 1);   // road-glow-soft (f9): нощем наполовина — пътищата не са оранжеви ленти   // Рим — натриево (по-оранжево, малко по-силно), Истанбул — смесено (по-бяло)
  const m = merge(parts, mat), uv = m.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, i % 2, 0.5);   // лентите са двойки връх (ляв, десен) — uv.x напреки
  m.receiveShadow = false; m.renderOrder = 2; G.add(m); return mat;
}
// ---- прожекторите на забележителностите (нощем): при основата — ниска топла „мъгла“ нагоре (отворен цилиндър с градиент, адитивен)
// по периметъра на парцела; самите модели светват с floodMats (играта/демото ги подават на dayNight.winMats)
const WASH_LM = new Set(['colosseo', 'vittoriano', 'pantheon', 'stpeter', 'eiffel', 'notredame', 'arc', 'bigben', 'londoneye', 'shard', 'empire', 'chrysler', 'stpatrick', 'rockefeller', 'radiocity', 'hagia', 'bluemosque', 'galata', 'topkapi', 'grandbazaar', 'suleymaniye', 'stbasil', 'kotelnicheskaya']);
function floodWash(G, P) {
  const lms = P.lots.filter(L => L.lm && WASH_LM.has(L.lm)); if (!lms.length) return null;   // само забележителностите с модел (не празните запазени места)
  const c = document.createElement('canvas'); c.width = 4; c.height = 64; const g = c.getContext('2d', FCPU), gr = g.createLinearGradient(0, 64, 0, 0); gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, '#555'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
  const CP = feature('city-polish');   /* city-polish (f9): отгоре двустранният висок цилиндър изглеждаше като светещ „купол“ около големите парцели (Истанбул) — само външната страна, по-нисък и по-мек */
  const mat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffc070, emissiveMap: canvasTex(c), emissiveIntensity: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: CP ? THREE.FrontSide : THREE.DoubleSide });
  mat.userData.winK = CP ? 0.11 : 0.16;
  const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.15, 1, 28, 1, true).translate(0, 0.5, 0), mat, lms.length), m = new THREE.Matrix4();
  lms.forEach((L, i) => { const r = Math.max(L.w, L.d) * 0.5; im.setMatrixAt(i, m.makeScale(r * 0.92, CP ? Math.min(6, 3 + r * 0.08) : Math.min(14, 4 + r * 0.2), r * 0.92).setPosition(L.x, 0.2, L.z));   /* ниско сияние при основата, не „звънец“ */ });
  im.frustumCulled = false; im.renderOrder = 3; G.add(im); return mat;
}
// материалите на модел-забележителност светват нощем (прожектори): emissive = топъл цвят, emissiveMap = текстурата; вече светещите (nightfloors) — не
export function floodMats(obj, col = 0xffd8a0, k = 0.45) {
  const out = []; obj.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) { if (!m || !('emissive' in m) || m.userData.flood || m.userData.nfK || m.emissiveMap || WIN_MATS.includes(m)) continue;
    m.emissive = new THREE.Color(col); if (m.map) m.emissiveMap = m.map; m.emissiveIntensity = 0; m.userData.winK = k; m.userData.flood = 1; out.push(m); WIN_MATS.push(m); } });   // и в nightMats на изгледа
  return out;
}
// 🌳 истинските дървета (opts.treeModels — trees-real от играта): всяко дърво — части по модел, InstancedMesh; височината = h
function realTrees(G, list, models) {
  const partsOf = src => { src.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(src), h = (b.max.y - b.min.y) || 1, parts = [];
    src.traverse(o => { if (o.isMesh) { const g = o.geometry.clone().applyMatrix4(o.matrixWorld); g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); g.scale(1 / h, 1 / h, 1 / h); parts.push([g, o.material]); } }); return parts; };
  // tree-lod (T2): моделът с лек двойник (src.__lod — дърветата на Meshy) — далечните (> LOD_D м) дървета се рисуват с него
  const vars = models.map(src => ({ parts: partsOf(src), lod: src.__lod ? partsOf(src.__lod) : null })).filter(v => v.parts.length);
  if (!vars.length) return false;
  const by = vars.map(() => []); list.forEach((t, i) => by[(i * 7 + 3) % vars.length].push(t));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const seedOf = ([x, z]) => { const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return h - Math.floor(h); };   /* tree-colors (T2): оцветимите листа — със семе по дърво (aSeed) */
  const mk = (g, mat, n) => { const tt = mat && mat.__tt && mat.__tt.inst, I = new THREE.InstancedMesh(g, tt ? mat.__tt.inst() : mat, n);
    if (tt) { I.customDepthMaterial = I.material.__tt.depth; g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(n), 1)); }
    I.castShadow = true; I.frustumCulled = false; G.add(I); return I; };
  vars.forEach((V, vi) => { const L = by[vi]; if (!L.length) return;
    const M = L.map(([x, z, h], i) => { q.setFromAxisAngle(up, (i * 2.39) % 6.283); return m.compose(v.set(x, 0, z), q, sc.set(h, h, h)).clone(); }), S = L.map(seedOf);
    const near = V.parts.map(([g, mat]) => mk(g, mat, L.length)), far = V.lod ? V.lod.map(([g, mat]) => mk(g, mat, L.length)) : [];
    const fill = (set, idx) => { for (const I of set) { idx.forEach((k, n) => I.setMatrixAt(n, M[k])); I.count = idx.length; I.instanceMatrix.needsUpdate = true; const a = I.geometry.attributes.aSeed; if (a) { idx.forEach((k, n) => { a.array[n] = S[k]; }); a.needsUpdate = true; } } };
    const all = L.map((_, k) => k); fill(near, all); if (!far.length) return; fill(far, []);
    // разпределение по разстоянието до камерата (в рамката на групата), най-много веднъж на 0,4 s и при преместване > 8 м
    const LOD_D = 150, cam = new THREE.Vector3(), last = new THREE.Vector3(1e9, 0, 1e9); let t0 = 0;
    const sortBy = (r, c) => { const now = performance.now(); if (now - t0 < 400) return; t0 = now; cam.copy(c.position); G.worldToLocal(cam); if (cam.distanceTo(last) < 8) return; last.copy(cam);
      const n = [], f = []; L.forEach(([x, z], k) => (Math.hypot(x - cam.x, z - cam.z) < LOD_D ? n : f).push(k)); fill(near, n); fill(far, f); };
    for (const I of [near[0], far[0]]) I.onBeforeRender = sortBy; });
  return true;
}
const T1 = feature('tlight-one'), shortArm = (P, n, a) => { if (!T1) return false; const rd = P.roads[a.road], m = P.nodes[a.end ? rd.from : rd.to]; return rd.L[rd.L.length - 1] < 28 && !!m && m.arms.length >= 3 && m.kind !== 'round' && n.arms.length >= 3; };   // tlight-one (горе)
function* furniture(G, P, o = {}) {   // генератор: yield след всеки път (постепенното строене)
  const FURN = new THREE.Group(); G.add(FURN); let SIG = {};
  const stone = M(0x8a8478), iron = M(0x2a2c2e), lampG = new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffd88a, emissiveIntensity: 0.2 });
  const lamps = [], trees = [], benches = [], bins = [], stops = [], signs = [], fountains = [], at = (rd, s) => { const L = rd.L; let i = 1; while (i < L.length - 1 && L[i] < s) i++; const a = rd.pts[i - 1], b = rd.pts[i], t = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  const NG = new Map(), ngk = (i, j) => i * 100003 + j; for (const n of P.nodes) if (n.arms.length >= 3) { const k = ngk(Math.floor(n.x / 30), Math.floor(n.z / 30)); (NG.get(k) || NG.set(k, []).get(k)).push(n); }   // кръстовищата в мрежа 30 м
  const nearNode = (x, z) => { const i = Math.floor(x / 30), j = Math.floor(z / 30); for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) for (const n of NG.get(ngk(a, b)) || []) if (Math.hypot(n.x - x, n.z - z) < (n.r || 6) + 4) return true; return false; };
  // street-real: улиците и булевардите — модерни LED по 9 м на бордюра (двойните — на разделителната ивица), старият център (по картата — всички улички), кейовете и пешеходните — класически ~5 м
  const SR = o.streetReal && streetReal(), OLD = P.osm ? 1e9 : (P.R || 1200) * 0.45, cx0 = P.center ? P.center.x : 0, cz0 = P.center ? P.center.z : 0;
  for (const rd of P.roads) { yield 0;
    const T = rd.L[rd.L.length - 1], main = rd.cls !== 'street', step = rd.cls === 'quay' ? 24 : main ? 28 : 40, sides = main ? [1, -1] : [1];
    if (SR) { const [mx, mz] = at(rd, T / 2), old = rd.noCars || rd.cls === 'quay' || (rd.cls === 'street' && Math.hypot(mx - cx0, mz - cz0) < OLD), kind = rd.cls === 'quay' ? 'ornate' : old ? CLASSIC[(rd.id | 0) % CLASSIC.length] : rd.median ? 'cobra2' : 'cobra';
      if (kind === 'cobra2') { for (let s = 29; s < T - 10; s += 30) { const [x, z, ux, uz] = at(rd, s); if (!nearNode(x, z)) lamps.push([x, z, Math.atan2(uz, -ux), kind]); } }   /* на ивицата между платната: рамената — към двете платна */
      else for (let s = 10; s < T - 6; s += step) { const [x, z, ux, uz] = at(rd, s); for (const sg of sides) { const o2 = old ? rd.w / 2 + rd.walk - 0.5 : rd.w / 2 + 0.6, px = x - uz * o2 * sg, pz = z + ux * o2 * sg; if (!nearNode(px, pz)) lamps.push([px, pz, Math.atan2(uz * sg, -ux * sg), kind]); } } }
    else for (let s = 10; s < T - 6; s += step) { const [x, z, ux, uz] = at(rd, s); for (const sg of sides) { const o = rd.w / 2 + rd.walk - 0.5, px = x - uz * o * sg, pz = z + ux * o * sg; if (!nearNode(px, pz)) lamps.push([px, pz]); } }
    if (rd.median) for (let s = 14; s < T - 10; s += 30) { const [x, z] = at(rd, s); if (!nearNode(x, z)) trees.push([x, z, 7]); }   // дървета по разделителната ивица
    if (rd.cls === 'quay' || (P.osm && rd.cls === 'blvd')) for (let s = 6; s < T - 6; s += 11) { const [x, z, ux, uz] = at(rd, s); for (const sg of [1, -1]) { const o = rd.w / 2 + rd.walk * 0.55, px = x - uz * o * sg, pz = z + ux * o * sg; if (!nearNode(px, pz) && !(P.waterAt && P.waterAt(px, pz))) trees.push([px, pz, 11]); } }   // платаните по Лунготевере
    if (main && T > 120) for (let s = 60; s < T - 40; s += 260) { const [x, z, ux, uz] = at(rd, s), o = rd.w / 2 + rd.walk - 1.2; stops.push([x - uz * o, z + ux * o, Math.atan2(ux, uz)]); }   // спирки (с навес)
  }
  // площадите на забележителностите: пейки, кошчета, фонтан
  for (const L of P.lots.filter(q => (q.lm && !yardOf(q)) || q.big === 'park')) { const R0 = Math.max(L.w, L.d) / 2 + (L.guard || 4) - 2;
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, x = L.x + Math.cos(a) * R0, z = L.z + Math.sin(a) * R0; (k % 3 ? benches : bins).push([x, z, a + Math.PI / 2]); }
    if (['navona', 'popolo', 'trevi', 'spanishsteps'].includes(L.lm) || (L.big === 'park' && !o.statues)) fountains.push([L.x, L.z]); }   // statues: в парка — истинският фонтан (statues.js)
  // road-geo: лампи около кръговите (по тротоара, без входовете) и прожектори в острова, насочени нагоре (светят с нощта — общият фенер)
  const ups = []; if (o.roadGeo) for (const r of P.rounds || []) { const n = P.nodes[r.node], ro = r.outer + 1.6, ri = r.outer - Math.min(5.5, r.outer - 6) - 2;
    for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * Math.PI * 2; if (n.arms.some(q => Math.abs(Math.atan2(Math.sin(q.angle - a), Math.cos(q.angle - a))) < Math.asin(Math.min(0.95, (P.roads[q.road].w / 2 + 2.5) / ro)))) continue; lamps.push([r.x + Math.cos(a) * ro, r.z + Math.sin(a) * ro, ...(SR ? [Math.atan2(-Math.cos(a), -Math.sin(a)), 'cobra'] : [])]); }
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ups.push([r.x + Math.cos(a) * (ri - 0.7), r.z + Math.sin(a) * (ri - 0.7)]); } }
  // знаци „Стоп“ на второстепенните клонове без светофар
  if (!o.realSigns) for (const n of P.nodes) { if (n.ctrl !== 'yield' || n.kind === 'round') continue; for (const a of n.arms) if (!a.prio && a.stop) {   /* road-signs: истинските знаци са в roadsigns.js (plan2Signs) */ const rd = P.roads[a.road], p = a.stop[1]; signs.push([p[0] + Math.sin(a.angle) * 0.8, p[1] - Math.cos(a.angle) * 0.8, -a.angle + Math.PI / 2]); } }
  const inst = (geo, mat, list, f, shadow = false) => { if (!list.length) return null; const im = new THREE.InstancedMesh(geo, mat, list.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
    list.forEach((it, i) => { f(it, v, q, sc, up); im.setMatrixAt(i, m.compose(v, q, sc)); }); im.castShadow = shadow; im.frustumCulled = false; FURN.add(im); return im; };
  const P1 = (x, y, z) => (it, v, q, sc, up) => { v.set(it[0], y, it[1]); q.setFromAxisAngle(up, it[2] || 0); sc.set(1, 1, 1); };
  let LF = null; if (SR && lamps.length) { LF = lampField(lamps); FURN.add(LF.group); }   // street-real: истинските лампи (инстанции по вид; абажурите светят нощем)
  else if (lamps.length) {
  inst(new THREE.CylinderGeometry(0.09, 0.14, 4.6, 6).translate(0, 2.3, 0), iron, lamps, P1(0, 0, 0), true);   // стълб
  inst(new THREE.CylinderGeometry(0.32, 0.18, 0.7, 6).translate(0, 4.75, 0), lampG, lamps, P1(0, 0, 0)).userData.lamp = 1; }   // фенерът (свети нощем)
  if (o.treeClear) { const C = o.treeClear.map(([k, r]) => [P.lots.find(L => L.lm === k), r]).filter(c => c[0]); for (let i = trees.length - 1; i >= 0; i--) if (C.some(([L, r]) => Math.hypot(trees[i][0] - L.x, trees[i][1] - L.z) < r)) trees.splice(i, 1); }   // lv-sign-clear (f6): без палмите около знака (на ивицата и тротоарите) — вижда се отгоре и отстрани
  if (!(o.treeModels && o.treeModels.length && realTrees(G, trees, o.treeModels))) {
  inst(new THREE.CylinderGeometry(0.22, 0.32, 1, 6).translate(0, 0.5, 0), M(0x6b5a44), trees, (it, v, q, sc) => { v.set(it[0], 0, it[1]); q.identity(); sc.set(1, it[2] * 0.4, 1); }, true);
  inst(new THREE.IcosahedronGeometry(1, 0), M(0x5d8a3e), trees, (it, v, q, sc) => { v.set(it[0], it[2] * 0.62, it[1]); q.identity(); sc.set(it[2] * 0.33, it[2] * 0.28, it[2] * 0.33); }, true); }
  inst(new THREE.BoxGeometry(1.8, 0.45, 0.55).translate(0, 0.45, 0), M(0x6d4c33), benches, P1(0, 0, 0), true);
  inst(new THREE.CylinderGeometry(0.18, 0.22, 0.22, 10).translate(0, 0.45, 0), lampG, ups, P1(0, 0, 0));   /* прожекторите в острова на кръговото (road-geo) */
  inst(new THREE.CylinderGeometry(0.28, 0.24, 0.9, 8).translate(0, 0.45, 0), iron, bins, P1(0, 0, 0));
  inst(new THREE.BoxGeometry(3.2, 0.12, 1.4).translate(0, 2.6, 0), new THREE.MeshStandardMaterial({ color: 0x9fc0d8, transparent: true, opacity: 0.55 }), stops, P1(0, 0, 0));   // навесът на спирката
  inst(new THREE.BoxGeometry(3.2, 2.5, 0.06).translate(0, 1.3, -0.65), new THREE.MeshStandardMaterial({ color: 0xcfe0ea, transparent: true, opacity: 0.35 }), stops, P1(0, 0, 0));
  inst(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5).translate(0, 1.2, 0), iron, signs, P1(0, 0, 0));
  inst(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 8).rotateX(Math.PI / 2).translate(0, 2.35, 0), M(0xc8202a), signs, P1(0, 0, 0));   // „Стоп“
  for (const [x, z] of fountains) { const f = new THREE.Group(), b = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.4, 0.8, 24), M(0xd8cdb4)), w = new THREE.Mesh(new THREE.CircleGeometry(3.6, 24).rotateX(-Math.PI / 2), MAT.wet), c = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 3, 10), M(0xd8cdb4)), t = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.5, 0.5, 14), M(0xd8cdb4));
    b.position.y = 0.4; w.position.y = 0.75; c.position.y = 2; t.position.y = 3.4; f.add(b, w, c, t); if (feature('fountain-water')) { w.material = fwWaterMat(); f.add(fwFx({ water: [[3.6, 1.35]], jet: [3.62, 1.6, 0.08, 0.03], curtains: [[1.54, 3.64, 1.95, 0.77]], splash: [[0.77, 1.95, 24]], crown: [5.22, 3.62, 0.9, 12], u: 7 })); } f.position.set(x, 0, z); f.traverse(o => { if (o.isMesh) o.castShadow = true; }); FURN.add(f); }
  // светофари: стълб вдясно преди стоп линията и глава с 3 лампи; лампите — по фазата на клона (lightsUpdate)
  // tlight-one (f9, T4 от оценката): късата връзка между две кръстовища (двойно платно в OSM) е част от едно голямо кръстовище —
  // по нея без стоп линии, зебри и светофарни глави (иначе — две зебри и два светофара един срещу друг); движението не се пипа
  const heads = []; for (const n of P.nodes) { if (n.ctrl !== 'signal') continue; n.arms.forEach((a, ai) => { if (!a.stop || shortArm(P, n, a)) return; const p = a.stop[1], ox = Math.cos(a.angle), oz = Math.sin(a.angle); heads.push({ node: n.id, arm: ai, x: p[0] + ox * 0.6 - oz * 0.9, z: p[1] + oz * 0.6 + ox * 0.9, rot: Math.atan2(ox, oz) }); }); }
  if (heads.length && SR) {   // street-real (#42.5, #42.6): светофар на конзола на тротоара — на бордюра до стоп линията, главата над платното, пешеходният сигнал до зебрата
    for (const h of heads) { const n = P.nodes[h.node], a = n.arms[h.arm], rd = P.roads[a.road], ux = Math.cos(a.angle), uz = Math.sin(a.angle), p = a.stop[1], d = (p[0] - n.x) * ux + (p[1] - n.z) * uz + 0.4, side = rd.w / 2 + 0.7;
      h.x = n.x + ux * d + uz * side; h.z = n.z + uz * d - ux * side; h.yaw = Math.atan2(-uz, ux); }   /* вдясно на идващата кола: (uz, −ux) */
    const TLF = tlightField(heads.map(h => [h.x, h.z, h.yaw])); FURN.add(TLF.group);
    const bulbs = new THREE.InstancedMesh(lensGeo(), new THREE.MeshBasicMaterial({ color: 0xffffff }), heads.length * 3), ped = new THREE.InstancedMesh(pedGeo(), new THREE.MeshBasicMaterial({ color: 0xffffff }), heads.length * 2), m = new THREE.Matrix4(), c = new THREE.Color(0x333333);
    heads.forEach((h, i) => { TLF.lens[i].forEach((p, k) => { bulbs.setMatrixAt(i * 3 + k, lensMatrix(p, h.yaw, m)); bulbs.setColorAt(i * 3 + k, c); }); TLF.ped[i].forEach((p, k) => { ped.setMatrixAt(i * 2 + k, lensMatrix(p, h.yaw, m)); ped.setColorAt(i * 2 + k, c); }); });
    bulbs.frustumCulled = ped.frustumCulled = false; FURN.add(bulbs, ped); SIG = { heads, bulbs, ped, tl: TLF.group };
  } else if (heads.length) {
    inst(new THREE.CylinderGeometry(0.07, 0.09, 3.4, 6).translate(0, 1.7, 0), iron, heads.map(h => [h.x, h.z]), P1(0, 0, 0), true);
    inst(new THREE.BoxGeometry(0.42, 1.1, 0.32).translate(0, 3.5, 0), M(0x1e2022), heads.map(h => [h.x, h.z, h.rot]), P1(0, 0, 0));
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 5, 3), new THREE.MeshBasicMaterial({ color: 0xffffff }), heads.length * 3), m = new THREE.Matrix4(), c = new THREE.Color(0x333333);
    heads.forEach((h, i) => [3.85, 3.5, 3.15].forEach((y, k) => { bulbs.setMatrixAt(i * 3 + k, m.makeTranslation(h.x + Math.sin(h.rot) * 0.17, y, h.z + Math.cos(h.rot) * 0.17)); bulbs.setColorAt(i * 3 + k, c); }));
    bulbs.frustumCulled = false; FURN.add(bulbs); SIG = { heads, bulbs };
  }
  return { FURN, SIG, lamps: LF ? LF.heads.map(h => [h.x, h.z, h.y]) : lamps, lampMat: LF ? LF.mats : lampG };   // street-real: светлите петна и ореолите — под абажурите (y — височината им)
}


// ---- основното
export function buildPlan2View(P, opts = {}) {
  const TM = {}, T0 = performance.now(); let tm0 = T0, phase = 'start'; const tm = k => { const t = performance.now(); TM[k] = (TM[k] || 0) + t - tm0; tm0 = t; phase = 'after ' + k; };   // замерване по части (userData.timing)
  mats();
  { const gr = opts.ground || {}; MAT.grass.color.setHex(gr.grass ?? 0x7fa462); MAT.median.color.setHex(gr.median ?? 0x5f9a45); MAT.island.color.setHex(gr.island ?? 0x6aa84f); }   // T2 dubai-look: пясъкът и настилката вместо тревата (общите материали — всеки град си ги задава)
  const G = new THREE.Group(), D = opts.osm ? { ...opts.osm, _models: opts.bridgeModels || {}, _kremlin: opts.kremlinModels || null, _gum: opts.gumModel || null } : null;   // bridgeModels: { bosphorus } — висящите мостове G.userData.plan = P;
  if (opts.offset) G.position.set(opts.offset[0], 0, opts.offset[1]);
  if (D && D.sea && opts.bridgesReal && /^(paris|london|moscow|newyork|washington)$/.test(D.style)) D.wY = -6;   // 🌉 bridges-real (f6): реката — по-дълбоко, кейовете — каменни стени, под мостовете — истинските модели (bridges.js)
  const RR = P.R * 1.6, g0 = new THREE.Mesh(new THREE.PlaneGeometry(RR * 2.4, RR * 2.4).rotateX(-Math.PI / 2), D ? MAT.urban : MAT.grass); g0.receiveShadow = true; if (D && D.sea) { const S0 = D.style === 'istanbul' ? seaPad(D.sea, 120) : D.sea; g0.geometry = feature('banks-smooth') || D.wY ? seaGroundSmooth(S0, D.wY ? -D.wY + 0.5 : 0) : seaGround(S0); }   /* banks-smooth (f6): плавен бряг */ else if (D) g0.geometry = romeGround(RR, D); G.add(g0); G.userData.groundMat = g0.material;   // Рим: дворовете и площадите — светъл камък, тревата — само в парковете
  if (P.coastZ) { const sh = new THREE.Shape(); sh.moveTo(-RR * 1.2, -RR * 1.2); for (let i = 0; i <= 80; i++) { const x = -RR * 1.2 + i * RR * 2.4 / 80; sh.lineTo(x, P.coastZ(x)); } sh.lineTo(RR * 1.2, -RR * 1.2); const wg = new THREE.ShapeGeometry(sh); wg.rotateX(Math.PI / 2); const wm = new THREE.Mesh(wg, MAT.water); wm.position.y = 0.02; G.add(wm);
    // бряг: пясъчна ивица по водата и крайбрежна алея до кея; пристанището — кей навътре във водата пред мястото му
    const cl = []; for (let x = -RR * 1.2; x <= RR * 1.2; x += 4) cl.push(x);
    const off = d => cl.map(x => [x, P.coastZ(x) + d]);
    const sand = ribbon(off(0.5), 5, 0.05), prom = ribbon(off(5.2), 4.2, 0.06);
    const sm = merge([sand], MAT.sand), pm = merge([prom], MAT.walk); G.add(sm, pm);
    const port = P.lots.find(L => L.big === 'port');
    if (port && !opts.seaPort) { const rd = P.roads[port.front.road];   /* sea-coast: пристанището (кей, кранове, контейнери) го рисува seaside.js на брега пред парцела — тук гола плоча и кутия */ let best = rd.pts[0]; for (const q of rd.pts) if (Math.hypot(q[0] - port.x, q[1] - port.z) < Math.hypot(best[0] - port.x, best[1] - port.z)) best = q;
      const dz = P.coastZ(best[0]) - best[1], dir = Math.sign(dz) || -1;   // към водата
      const pier = new THREE.Mesh(new THREE.BoxGeometry(port.w * 0.8, 1.2, 70), MAT.pier); pier.position.set(best[0], 0.4, P.coastZ(best[0]) + dir * 35); pier.receiveShadow = true; G.add(pier);
      const sh = new THREE.Mesh(new THREE.BoxGeometry(port.w * 0.9, 9, port.d * 0.7), M(0x6f7f8f)); sh.position.set(port.x, 4.5, port.z); sh.rotation.y = port.rot; sh.castShadow = true; G.add(sh); }   // склад на пристанището
  }
  tm('ground');
  const trees = [];
  if (D) {   // истинската карта: Тибърът (ивица около оста), остров Тиберина, паркове и археологически зони, жп линиите към Термини
    if (D.sea) seaView(G, D, RR, opts.railCut || null, opts.osmEdge ? { ...opts.osmEdge, bnd: P.boundary, lots: P.lots, roads: P.roads } : null); else romeRiver(G, D);
    G.userData.wY = (D.wY ?? -1.2) + 0.1;   // 🚢 osm-ships (game.js): нивото на водата — за корабите на котва
    if (D.wY) bridgesView(G, P, D, opts.bridgesReal, floodMats);   // bridges-real
    const I = D.island; if (I) { const isl = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), M(0xb9ad96)); isl.scale.set(I.w / 2, 1, I.d / 2); isl.rotation.y = I.rot; isl.position.set(I.x, 0.06, I.z); G.add(isl); }
    const gm = { park: M(0x6f9e4f), archaeo: M(0xb7b08a), cemetery: M(0x7d9468), resort: M(0xd8ccb2) };   // resort — lasvegas-osm (55): запазените места на казината (светла настилка, пустинен пейзаж)
    for (const g of P.greensSrc) { const sh = new THREE.Shape(g.poly.map(([x, z]) => new THREE.Vector2(x, z))); const ge = new THREE.ShapeGeometry(sh); ge.rotateX(Math.PI / 2); const m = new THREE.Mesh(ge, gm[g.kind] || gm.park); m.material.side = THREE.DoubleSide; m.position.y = 0.025; m.receiveShadow = true; G.add(m); }
    for (const pl of D.pools || []) { const sh = new THREE.Shape(pl.poly.map(([x, z]) => new THREE.Vector2(x, z))), ge = new THREE.ShapeGeometry(sh).rotateX(Math.PI / 2), m = new THREE.Mesh(ge, MAT.water); m.material.side = THREE.DoubleSide; m.position.y = 0.06; G.add(m);   // 🇺🇸 Вашингтон: басейните на Мола (Огледалният, Втората световна война) — над тревата на парка, с каменен ръб
      const rim = ribbon(pl.poly, 1.2, 0.07, true); G.add(merge([rim], MAT.walk)); }
    const Rl = []; for (const r of D.rail) Rl.push(ribbon(r, 3.2, 0.05)); G.add(merge(Rl, M(0x8c8578)));
  }
  tm('water+greens');
  // ---- улиците, кръстовищата, кръговите и маркировката — на пръстени около фокуса (opts.focus, иначе центъра): всеки пръстен — свои слети
  // мрежи; при opts.progressive първият пръстен е веднага, другите — на порции (pump). RD/ND/TU/RO — пътищата, възлите, обратите, кръговите на пръстена.
  function* streets(RD, ND, TU, RO) {
  const W = [], As = [], Md = [], Pt = [], Is = [], Cb = [];
  // пътят спира на ръба на кръговото; разделителната ивица — на ръба на всяко кръстовище
  const cut = (pts, n0, r0, n1, r1) => pts.filter(p => Math.hypot(p[0] - n0.x, p[1] - n0.z) >= r0 && Math.hypot(p[0] - n1.x, p[1] - n1.z) >= r1);
  // срезовете по дължината на пътя: кръгово — до пръстена; кръстовище — до очертанието му (arm.t от плана, + отместване)
  // road-geo (opts.roadGeo): всеки задънен край вътре в картата има изричен вид — 'cont' (асфалт до близката улица), 'bulb' (компактна площадка
  // за обръщане — само жилищна улица), 'bar' (булевард/с разделителна ивица или към бъдещ квартал — прав край с бариера, никога „лопата“)
  const RG = !!opts.roadGeo, ET = new Map(), ZBM = RG ? crossingsOf(P, { roadGeo: true }) : null;   /* зебрите — общи с пешеходците */
  const endType = n => { if (!RG || n.arms.length !== 1) return null; if (ET.has(n.id)) return ET.get(n.id);
    const a = n.arms[0], rd = P.roads[a.road], pts = rd.pts, e = a.end ? pts[pts.length - 1] : pts[0], pr = a.end ? pts[pts.length - 2] : pts[1];
    let t = null; const jn = ends.onRoad(e, rd.id);   /* #21: краят стъпва върху друга улица (булевард) — без площадка за обръщане (белият кръг през платната); пътят спира до ръба ѝ */
    if (jn) t = { kind: 'join', rd, e, cut: Math.max(0, jn.rd.w / 2 - jn.d) + 0.5, side: Math.max(0, jn.rd.w / 2 + jn.rd.walk - jn.d) };
    else if (ends.inside(n.x, n.z) || n.endKind === 'dead') { const q = ends.inside(n.x, n.z) ? ends.near(e, rd.id, [e[0] - pr[0], e[1] - pr[1]]) : null;
      t = q ? { kind: 'cont', q } : rd.median || rd.cls === 'blvd' || n.endKind === 'grow' ? { kind: 'bar' } : { kind: 'bulb', r: rd.w / 2 + 3 };
      Object.assign(t, { rd, e, ang: Math.atan2(pr[1] - e[1], pr[0] - e[0]) }); } else if (n.endKind === 'grow') t = { kind: 'bar', rd, e, ang: Math.atan2(pr[1] - e[1], pr[0] - e[0]) };
    ET.set(n.id, t); return t; };
  // докъде стигат маркировката/ивицата/тротоарът от задънения край (extra — допълнително отстъпване)
  const deadCut = (n, extra = 0, med = false) => { if (RG && n.kind === 'round') { const o = P.rounds.find(r => r.node === n.id).outer; return med ? o + 14 : o + 9.6; }   /* кръгово: линиите — след зебрата, ивицата — след разделителното островче */
    const b = bendOf(n); if (b) return b.L; const t = endType(n); return !t ? 0 : t.kind === 'bulb' ? t.r + extra : t.kind === 'bar' ? 1.5 + extra : t.kind === 'join' ? t.cut + extra : 0; };
  // възел с два клона (една улица завива): дъга с постоянна ширина вместо чупка — клоновете се режат на L = R·tan(θ/2) (R ≤ 15 м, L ≤ 40% от късия)
  const BN = new Map(), bendOf = n => { if (!RG || n.arms.length !== 2 || n.kind === 'round') return null; if (BN.has(n.id)) return BN.get(n.id);
    const [a, b] = n.arms, ra = P.roads[a.road], rb = P.roads[b.road]; let t = null;
    const gap = Math.abs(Math.atan2(Math.sin(a.angle - b.angle), Math.cos(a.angle - b.angle))), th = Math.PI - gap;
    if (th > 0.15 && a.road !== b.road && Math.abs(ra.w - rb.w) < 0.6 && !ra.median === !rb.median && !ra.noCars && !rb.noCars) {
      const Lmax = Math.min(ra.L[ra.L.length - 1], rb.L[rb.L.length - 1]) * 0.4; let L = 15 * Math.tan(th / 2); if (L > Lmax) L = Lmax;
      if (L > 1) t = { L, a, b, ra, rb }; }
    BN.set(n.id, t); return t; };
  const bendCut = n => { const t = bendOf(n); return t ? t.L : 0; };
  const deadSide = n => { const t = endType(n); if (t && t.kind === 'join') return t.side; if (!t || t.kind !== 'bulb') return 0; const w = t.rd.walk, ro = t.r + w / 2, lo = t.rd.w / 2 + w / 2; return Math.sqrt(Math.max(0, ro * ro - lo * lo)); };
  const arcPts = (cx, cz, r, a0, a1, m = 28) => Array.from({ length: m + 1 }, (_, k) => { const a = a0 + (a1 - a0) * k / m; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; });
  const ST = P.STOP || 4.6, armT = (n, rd, end, far) => { const a = n.arms.find(q => q.road === rd.id && q.end === end); return a && a.t != null ? (far ? a.t : a.t0 ?? a.t) : 0; };   // t0 — докъде е пътят; t — стоп линията (от плана)
  // срез t (по посоката на клона, както в плана) → разстояние по дъгата на пътя от този му край (иначе при извит път остава процеп)
  const sAt = (n, rd, end, t) => { const a = n.arms.find(q => q.road === rd.id && q.end === end); if (!a) return t; const u = [Math.cos(a.angle), Math.sin(a.angle)], L = rd.L, T = L[L.length - 1], N = rd.pts.length;
    let prev = 0, ps = 0; for (let k = 0; k < N; k++) { const i = end ? N - 1 - k : k, p = rd.pts[i], pr = (p[0] - n.x) * u[0] + (p[1] - n.z) * u[1], sk = end ? T - L[i] : L[i]; if (pr >= t) return k ? ps + (sk - ps) * (t - prev) / ((pr - prev) || 1) : sk; prev = pr; ps = sk; } return t; };
  const endCut = (n, rd, end, extra = 0, rpad = -0.5) => n.kind === 'round' ? P.rounds.find(r => r.node === n.id).outer + rpad : n.arms.length >= 3 ? sAt(n, rd, end, armT(n, rd, end, extra > 0) + extra) : RG && n.arms.length === 1 && endType(n)?.kind === 'join' ? endType(n).cut : 0;
  const atS = (rd, s) => { const L = rd.L; let i = 1; while (i < L.length - 1 && L[i] < s) i++; const a = rd.pts[i - 1], b = rd.pts[i], t = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], u: [(b[0] - a[0]) / l, (b[1] - a[1]) / l] }; };
  // срезът на една страна на пътя (sg: +1 — лявата спрямо посоката на pts): при началото на пътя лявата е лявата на клона (tL), при края — дясната (tR)
  const sideCut = (n, rd, end, sg) => { if (n.kind === 'round') return P.rounds.find(r => r.node === n.id).outer + 0.2; if (RG && n.arms.length === 1) return deadSide(n); if (bendOf(n)) return bendCut(n); const a = n.arms.length >= 3 && n.arms.find(q => q.road === rd.id && q.end === end); if (!a || a.tL == null) return 0; return sAt(n, rd, end, (end === 0) === (sg > 0) ? a.tL : a.tR); };
  const trimS = (rd, s0, s1) => { const L = rd.L, T = L[L.length - 1]; if (T - s0 - s1 < 0.5) return []; const out = [atS(rd, s0).p]; for (let k = 0; k < L.length; k++) if (L[k] > s0 + 0.05 && L[k] < T - s1 - 0.05) out.push(rd.pts[k]); out.push(atS(rd, T - s1).p); return out; };
  for (const rd of RD) { yield 0; const nA = P.nodes[rd.from], nB = P.nodes[rd.to], T = rd.L[rd.L.length - 1], ov = n => n.arms.length >= 3 && n.kind !== 'round' ? 2 : 0, c0 = Math.max(0, endCut(nA, rd, 0) - ov(nA), bendCut(nA)), c1 = Math.max(0, endCut(nB, rd, 1) - ov(nB), bendCut(nB)), pr = trimS(rd, c0, c1); if (pr.length < 2) continue;   // асфалтът влиза 2 м под кръстовището — без процеп при извит път
    (rd.noCars ? W : As).push(ribbon(pr, rd.w, rd.noCars ? 0.05 : 0.07));   // пешеходна — паваж
    for (const sg of [1, -1]) { const ps = trimS(rd, sideCut(nA, rd, 0, sg), sideCut(nB, rd, 1, sg)); if (ps.length > 1) { const q = P.osm ? ps.filter((_, k) => k % 2 === 0 || k === ps.length - 1) : ps; W.push(ribbon(offLine(q, sg * (rd.w / 2 + rd.walk / 2)), rd.walk, 0.04)); if (!P.osm || rd.cls !== 'street') Cb.push(ribbon(offLine(q, sg * (rd.w / 2 + 0.15)), 0.3, 0.09)); } }   // Рим: по-рядка геометрия, бордюр само по главните   // тротоар и бордюр — до среза на своята страна
    if (rd.median) {   // разделителната ивица свършва зад стоп линията с нос (стеснява се до 0,4 м)
      const m0 = Math.max(endCut(nA, rd, 0, ST + 3.2), deadCut(nA, 3, true)), m1 = Math.max(endCut(nB, rd, 1, ST + 3.2), deadCut(nB, 3, true)), pm = trimS(rd, m0, m1); if (pm.length < 2 || T - m0 - m1 < 4) continue; Md.push(ribbon(pm, rd.median, 0.1));   // късият път между две близки кръстовища — без ивица
      for (const [n, s, dir] of [[nA, m0, -1], [nB, T - m1, 1]]) { if ((n.arms.length < 3 && !(RG && endType(n))) || n.kind === 'round') continue;   /* road-geo: и пред бариерата ивицата свършва с нос */ const A2 = atS(rd, s), B2 = atS(rd, s + dir * 3), v = [-A2.u[1], A2.u[0]], hw = rd.median / 2;
        Md.push(quad([A2.p[0] + v[0] * hw, A2.p[1] + v[1] * hw], [A2.p[0] - v[0] * hw, A2.p[1] - v[1] * hw], [B2.p[0] - v[0] * 0.2, B2.p[1] - v[1] * 0.2], [B2.p[0] + v[0] * 0.2, B2.p[1] + v[1] * 0.2], 0.1)); } }
    else if (rd.cls === 'street') { const sA = Math.max(endCut(nA, rd, 0, ST + 1, 2), deadCut(nA, 1)), sB = T - Math.max(endCut(nB, rd, 1, ST + 1, 2), deadCut(nB, 1)); for (let s = sA + 2; s < sB - 2; s += 7) { const a = atS(rd, s).p, b = atS(rd, Math.min(sB, s + 3)).p; Pt.push(ribbon([a, b], 0.18, 0.12)); } } }
  // кръстовищата: асфалтът по очертанието (ветрило от възела), тротоарът и бордюрът — по заоблените ъгли; правият ръб при Т остава прав
  const fan = (cx, cz, pts, y) => {   // многоъгълникът на кръстовището — истинска триангулация (earcut): не винаги се вижда целият от възела
    const ps = pts.filter((p, k) => k === 0 || Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1]) > 0.01), tri = THREE.ShapeUtils.triangulateShape(ps.map(p => new THREE.Vector2(p[0], p[1])), []), pos = [], idx = [];
    ps.forEach(p => pos.push(p[0], y, p[1])); for (const [a, b, c] of tri) { const o = (ps[b][0] - ps[a][0]) * (ps[c][1] - ps[a][1]) - (ps[b][1] - ps[a][1]) * (ps[c][0] - ps[a][0]); if (o < 0) idx.push(a, b, c); else idx.push(a, c, b); } return { pos, idx }; };
  const bez = (p0, c, p1, m = 10) => Array.from({ length: m + 1 }, (_, k) => { const t = k / m, u = 1 - t; return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]; });
  const Ap = [], Fl = [[], [], []], rTrees = [], BARS = [];
  for (const n of ND) { if (n.arms.length < 3 || n.kind === 'round' || !n.outline) continue; yield 0;
    As.push(fan(n.x, n.z, n.outline, 0.075));
    for (const c of n.corners) { const curve = c.c ? bez(c.p0, c.c, c.p1) : [c.p0, c.p1], ww = Math.min(P.roads[n.arms[c.a].road].walk, P.roads[n.arms[c.b].road].walk);
      const mid = curve[curve.length >> 1], tst = offLine(curve, 1)[curve.length >> 1], sg = Math.hypot(tst[0] - n.x, tst[1] - n.z) > Math.hypot(mid[0] - n.x, mid[1] - n.z) ? 1 : -1;
      W.push(ribbon(offLine(curve, sg * ww / 2), ww, 0.045)); Cb.push(ribbon(offLine(curve, sg * 0.15), 0.3, 0.09)); }
  }
  // задънените краища вътре в картата (OSM: изхвърлените къси улички прекъсват връзките): близо до друга улица (< 25 м) и с лице към нея —
  // асфалтово продължение до нея; иначе — кръгла площадка за обръщане с тротоар и бордюр (само изгледът; планът и парцелите не се променят)
  if (RG) for (const n of ND) { const t = endType(n); if (!t || t.kind === 'join') continue; const rd = t.rd, e = t.e;   /* road-geo: изричният вид на края */
    if (t.kind === 'cont') { As.push(ribbon([e, t.q], rd.w, 0.072)); W.push(ribbon([e, t.q], rd.w + 2 * rd.walk, 0.044)); continue; }
    if (t.kind === 'bulb') {   /* компактна площадка: асфалтов кръг, тротоарът и бордюрът — дъга без входа (не пресичат улицата) */
      const r = t.r, w = rd.walk, aW = Math.asin(Math.min(0.99, (rd.w / 2 + w / 2) / (r + w / 2))), aC = Math.asin(Math.min(0.99, (rd.w / 2) / (r + 0.15)));
      As.push(disc(e[0], e[1], r, 0.075)); W.push(ribbon(arcPts(e[0], e[1], r + w / 2, t.ang + aW, t.ang + Math.PI * 2 - aW), w, 0.044)); Cb.push(ribbon(arcPts(e[0], e[1], r + 0.15, t.ang + aC, t.ang + Math.PI * 2 - aC), 0.3, 0.09)); continue; }
    BARS.push(t);   /* 'bar' — прав край: бариерата (обект) се слага след сливането */
  }
  if (RG) for (const n of ND) { const b = bendOf(n); if (!b) continue;   /* дъгата на завоя: асфалт, тротоари, бордюри, ивица и маркировка — като на улицата */
    const pt = (arm, rd) => { const T = rd.L[rd.L.length - 1]; return atS(rd, arm.end ? T - b.L : b.L).p; }, pA = pt(b.a, b.ra), pB = pt(b.b, b.rb), rd = b.ra, arc = bez(pA, [n.x, n.z], pB, 14);
    As.push(ribbon(arc, rd.w, 0.07));
    for (const sg of [1, -1]) { W.push(ribbon(offLine(arc, sg * (rd.w / 2 + rd.walk / 2)), rd.walk, 0.04)); if (!P.osm || rd.cls !== 'street') Cb.push(ribbon(offLine(arc, sg * (rd.w / 2 + 0.15)), 0.3, 0.09)); }
    if (rd.median) { Md.push(ribbon(arc, rd.median, 0.1)); for (const sg of [1, -1]) Pt.push(ribbon(offLine(arc, sg * (rd.median / 2 + 0.3)), 0.15, 0.12)); }
    if (rd.cls === 'street' && !rd.median) dashed(arc, 3, 4, 0.18, 0.12, Pt);
    else if (rd.cls !== 'street') for (const sg of [1, -1]) { Pt.push(ribbon(offLine(arc, sg * (rd.w / 2 - 0.4)), 0.15, 0.12)); if (rd.lanes[0] > 1) dashed(offLine(arc, sg * ((rd.median || 0) / 2 + rd.laneW)), 3, 6, 0.15, 0.12, Pt); }
  }
  else for (const n of ND) { if (n.arms.length !== 1 || !ends.inside(n.x, n.z)) continue; const a = n.arms[0], rd = P.roads[a.road], pts = rd.pts, e = a.end ? pts[pts.length - 1] : pts[0], pr = a.end ? pts[pts.length - 2] : pts[1];
    if (ends.onRoad(e, rd.id)) continue;   // #21: стъпва върху друга улица — без кръг
    const q = ends.near(e, rd.id, [e[0] - pr[0], e[1] - pr[1]]);
    if (q) { As.push(ribbon([e, q], rd.w, 0.072)); W.push(ribbon([e, q], rd.w + 2 * rd.walk, 0.044)); }
    else { const r = Math.max(5.5, rd.w / 2 + 2.5); W.push(disc(n.x, n.z, r + rd.walk, 0.045)); As.push(disc(n.x, n.z, r, 0.075)); Cb.push(ribbon(circle(n.x, n.z, r + 0.15, 32), 0.3, 0.09)); } }
  if (!RG) for (const t of TU) { W.push(disc(t.x, t.z, t.r + 2.5, 0.045)); As.push(disc(t.x, t.z, t.r, 0.075)); }   /* road-geo: без кръговете на плана (P.turns) — видът на края е по-горе */
  // маркировка по пътищата: бордюри до среза; булевард — крайни линии, линии до разделителната ивица, прекъснати между лентите (до стоп линията)
  for (const rd of RD) { yield 0;
    const nA = P.nodes[rd.from], nB = P.nodes[rd.to];
    const pl = trimS(rd, Math.max(endCut(nA, rd, 0, ST, 0.2), deadCut(nA, 0.5)), Math.max(endCut(nB, rd, 1, ST, 0.2), deadCut(nB, 0.5))); if (pl.length < 2) continue;
    if (rd.cls !== 'street') { for (const sg of [1, -1]) { Pt.push(ribbon(offLine(pl, sg * (rd.w / 2 - 0.4)), 0.15, 0.12)); if (rd.median) Pt.push(ribbon(offLine(pl, sg * (rd.median / 2 + 0.3)), 0.15, 0.12)); if (rd.lanes[0] > 1) dashed(offLine(pl, sg * (rd.median / 2 + rd.laneW)), 3, 6, 0.15, 0.12, Pt); } }
  }
  // стоп линии (от плана: на t + STOP) и зебри между стоп линията и кръстовището (светофар — на всички клонове; предимство — на второстепенните)
  const zebra = (n, a, d0, skip = RG && P.roads[a.road].median ? P.roads[a.road].median / 2 + 0.2 : 0) => { const rd = P.roads[a.road], ux = Math.cos(a.angle), uz = Math.sin(a.angle), vx = -uz, vz = ux, c = [n.x + ux * d0, n.z + uz * d0];   /* skip — островчето/ивицата по средата остава без ивици (road-geo) */
    for (let t = -rd.w / 2 + 0.6; t <= rd.w / 2 - 0.4; t += 1.1) { if (Math.abs(t) < skip) continue; const p = [c[0] + vx * t, c[1] + vz * t]; Pt.push(ribbon([[p[0] - ux * 1.6, p[1] - uz * 1.6], [p[0] + ux * 1.6, p[1] + uz * 1.6]], 0.55, 0.13)); } };
  // road-geo: зебрата и зоната на кръстовището в другия край на улицата не се застъпват — при късата улица остава една зебра
  // (кръстовището пред кръговото; при равни — тази на светофара); зебра без място изобщо не се рисува
  const zDist = (n, a) => n.kind === 'round' ? P.rounds.find(r => r.node === n.id).outer + 7.5 : n.arms.length >= 3 && (n.ctrl === 'signal' || (n.ctrl === 'yield' && !a.prio)) ? (a.t || n.r) + 2.3 : 0;
  const zoneOf = (n, a) => n.kind === 'round' ? P.rounds.find(r => r.node === n.id).outer + 1 : n.arms.length >= 3 ? (a.t || 0) + ST + 0.5 : deadCut(n, 0);   /* докъде стига възелът по клона без зебрата */
  const zebraOk = (n, a) => { if (!RG) return true; const d = zDist(n, a); if (!d) return false; const rd = P.roads[a.road], T = rd.L[rd.L.length - 1], m = P.nodes[a.end ? rd.from : rd.to], b = m.arms.find(q => q.road === rd.id && q.end !== a.end) || m.arms.find(q => q.road === rd.id); if (!b) return true;
    const dm = zDist(m, b), far = dm ? dm + 1.8 : zoneOf(m, b); if (d + 1.8 + far <= T - 0.5) return true; if (!dm) return false;
    const rank = q => q.kind === 'round' ? 0 : q.ctrl === 'signal' ? 2 : 1; return rank(n) > rank(m) || (rank(n) === rank(m) && n.id < m.id); };
  for (const n of ND) { if (n.arms.length < 3 || n.kind === 'round') continue;
    n.arms.forEach((a, i) => { if (shortArm(P, n, a)) return; if (a.stop) Pt.push(ribbon(a.stop, 0.45, 0.13)); if (RG) { const d = ZBM.get(n.id + ':' + i); if (d) zebra(n, a, d); } else if (n.ctrl === 'signal' || (n.ctrl === 'yield' && !a.prio)) zebra(n, a, (a.t || n.r) + 2.3); }); }   /* road-geo: зебрите на пешеходната мрежа (pedpaths.js — и свързващите) */
  // road-geo: истинско кръгово — платно ~5,5 м, престилка за камионите 2 м (паваж, нисък бордюр), повдигнат остров с бордюр, трева, храсти
  // (opts.plants — истинските модели) и фонтан (opts.fountain) или паметник; бордюрът и линиите — прекъснати на входовете; на всеки вход —
  // разделително островче с бордюр, „отстъпи“ (линия + триъгълници) и една зебра, отдръпната от пръстена
  const roundReal = (r, n) => {
    const lane = Math.min(5.5, r.outer - 6), rin = r.outer - lane, ri = rin - 2, sg = P.drive === 'R' ? 1 : -1, TAU = Math.PI * 2;
    const gaps = n.arms.map(a => { const rd = P.roads[a.road]; return [a.angle, Math.asin(Math.min(0.95, (rd.w / 2 + 0.6) / r.outer))]; });
    const arcs = (rr, pad = 0) => { const A = gaps.map(([c, h]) => [c - h - pad, c + h + pad]).sort((p, q) => p[0] - q[0]), out = []; for (let k = 0; k < A.length; k++) { const a0 = A[k][1], a1 = A[(k + 1) % A.length][0] + (k + 1 === A.length ? TAU : 0); if (a1 - a0 > 0.05) out.push(arcPts(r.x, r.z, rr, a0, a1, Math.max(6, Math.ceil((a1 - a0) * rr / 2)))); } return out; };
    W.push(disc(r.x, r.z, r.outer + 2.5, 0.045)); As.push(disc(r.x, r.z, r.outer, 0.075, rin - 0.1));
    for (const c of arcs(r.outer + 0.15)) Cb.push(ribbon(c, 0.3, 0.09)); for (const c of arcs(r.outer - 0.45, 0.04)) Pt.push(ribbon(c, 0.15, 0.12));
    Ap.push(disc(r.x, r.z, rin, 0.1, ri)); Cb.push(ribbon(circle(r.x, r.z, rin + 0.05), 0.22, 0.11));   /* престилката: паваж, нисък бордюр (камионите минават по нея) */
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(ri, ri, 0.34, 64, 1, true), MAT.curb); wall.position.set(r.x, 0.17, r.z); wall.receiveShadow = true; G.add(wall);   /* повдигнатият остров */
    Is.push(disc(r.x, r.z, ri, 0.34)); Cb.push(ribbon(circle(r.x, r.z, ri - 0.2), 0.4, 0.345));
    const pl = opts.plants || [], nb = Math.max(8, Math.round(ri * 0.9));
    for (let k = 0; k < nb; k++) { const a = k / nb * TAU, rr = ri - 1.6 - (k % 2) * 1.4, x = r.x + Math.cos(a) * rr, z = r.z + Math.sin(a) * rr;
      if (pl.length) { const o = pl[k % pl.length].clone(); o.scale.multiplyScalar(1.1 + (k % 3) * 0.25); o.position.set(x, 0.34, z); o.rotation.y = a * 3; G.add(o); } else Fl[k % 3].push(disc(x, z, 0.8, 0.36, 0, 10)); }
    if (ri > 8) for (let k = 0; k < 4; k++) { const a = (k + 0.5) / 4 * TAU, rr = ri * 0.55; rTrees.push([r.x + Math.cos(a) * rr, r.z + Math.sin(a) * rr, 6]); }
    // ⛲ roundabout-deco (T2): светлият фонтан с вода и струи или паметник (game.js roundDecoOf → roundabout.js)
    // поне един паметник в град с ≥ 3 кръгови — на най-близкото до центъра (детерминирано)
    if (opts.roundDeco) { const AR = P.rounds || RO, near = AR.length >= 3 && AR.reduce((b, q) => Math.hypot(q.x - P.center.x, q.z - P.center.z) < Math.hypot(b.x - P.center.x, b.z - P.center.z) ? q : b) === r; G.add(opts.roundDeco({ x: r.x, z: r.z, ri, seed: n.id + 1, mustMonument: near })); }
    else if (opts.fountain) { const f = opts.fountain.clone(), b = new THREE.Box3().setFromObject(f), sz = b.getSize(new THREE.Vector3()), k = Math.min(ri * 0.55, 8) / Math.max(sz.x, sz.z); f.scale.multiplyScalar(k); f.position.set(r.x, 0.34 - b.min.y * k, r.z); G.add(f); }
    else { const f = new THREE.Group(), bR = Math.min(3.4, ri * 0.32), basin = new THREE.Mesh(new THREE.CylinderGeometry(bR, bR + 0.25, 0.7, 32), MAT.stone), water = new THREE.Mesh(new THREE.CircleGeometry(bR - 0.3, 32).rotateX(-Math.PI / 2), MAT.wet), col = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 2.2, 16), MAT.stone), bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.35, 0.35, 24), MAT.stone);
      basin.position.y = 0.69; water.position.y = 1.0; col.position.y = 1.5; bowl.position.y = 2.6; f.add(basin, water, col, bowl); f.position.set(r.x, 0, r.z); f.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); G.add(f); }
    for (const a of n.arms) { const rd = P.roads[a.road], ux = Math.cos(a.angle), uz = Math.sin(a.angle), vx = -uz, vz = ux, at = (d, t) => [r.x + ux * d + vx * t, r.z + uz * d + vz * t];
      const o0 = r.outer + 0.6, o1 = r.outer + 14, sw0 = rd.median ? rd.median / 2 + 0.7 : 1.4, sw1 = rd.median ? rd.median / 2 : 0.3;   /* разделителното островче: по-широко до пръстена, стеснява се навън */
      const isl = [at(o0, -sw0), at(o0, sw0), at(o1, sw1), at(o1, -sw1)], sh = new THREE.Shape(isl.map(p => new THREE.Vector2(p[0], -p[1])));
      const ig = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.12, bevelSegments: 1 }); ig.rotateX(-Math.PI / 2);
      const im = new THREE.Mesh(ig, [MAT.walk, MAT.curb]); im.receiveShadow = true; G.add(im);   /* повдигнатото островче: горе паваж, страните — бордюр */
      const e0 = sg * (sw0 + 0.25), e1 = sg * (rd.w / 2 - 0.25);   /* „отстъпи“ на влизащата лента: прекъсната линия по ръба на пръстена + триъгълници */
      dashed([at(o0 + 0.2, e0), at(o0 + 0.2, e1)], 0.6, 0.4, 0.35, 0.13, Pt);
      for (let t = Math.min(e0, e1) + 0.5; t < Math.max(e0, e1) - 0.4; t += 1.0) { const c = at(o0 + 1.3, t); Pt.push({ pos: [c[0] - vx * 0.35 - ux * 0.5, 0.13, c[1] - vz * 0.35 - uz * 0.5, c[0] + vx * 0.35 - ux * 0.5, 0.13, c[1] + vz * 0.35 - uz * 0.5, c[0] + ux * 0.5, 0.13, c[1] + uz * 0.5], idx: [0, 2, 1] }); }
      const zd = r.outer + 7.5; if (ZBM.has(n.id + ':' + n.arms.indexOf(a))) zebra(n, a, zd, sw0 + (sw1 - sw0) * (zd - o0) / (o1 - o0) + 0.35); }
  };
  // кръгови: пръстен с бордюри и линии, павирана ивица около острова, трева с цветя и дървета, фонтан; на входовете — островче, „отстъпи“, зебра
  for (const r of RO) { yield 0; const n = P.nodes[r.node];
    if (RG) { roundReal(r, n); continue; }
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
      if (zebraOk(n, a)) zebra(n, a, r.outer + 7.5); }
  }
  if (rTrees.length) trees.push(...rTrees);
  for (const t of BARS) G.add(barrier(t.e, t.ang, t.rd.w));   /* road-geo: бариерите на правите краища */
  for (const [arr, mat] of [[As, MAT.asph], [W, MAT.walk], [Cb, MAT.curb], [Pt, MAT.paint], [Md, MAT.median], [Is, MAT.island], [Ap, MAT.apron], ...Fl.map((f, i) => [f, MAT.flower[i]])]) if (arr.length) { G.add(merge(arr, mat)); yield 0; }   // сливането — по материал, на стъпки
  }
  // дърветата на парковете (големите места park) и на островите на кръговите
  const parkTrees = () => {
    for (const L of P.lots) if (L.big === 'park') { const SP = opts.statues ? parkSpots(L) : [];   /* statues: поляните за фонтана и статуята — без дървета */ for (let k = 0; k < Math.floor(L.w * L.d / 70); k++) { const h = 4 + (k * 7 % 5), u = ((k * 0.7548776662 + 0.5) % 1 - 0.5) * (L.w - 6), v = ((k * 0.5698402910 + 0.5) % 1 - 0.5) * (L.d - 6), c = Math.cos(L.rot), s = Math.sin(L.rot), tx = L.x + u * c + v * s, tz = L.z - u * s + v * c; if (!SP.some(([x, z, r]) => Math.hypot(tx - x, tz - z) < r)) trees.push([tx, tz, h]); } }
    if (trees.length && opts.treeModels && opts.treeModels.length && realTrees(G, trees, opts.treeModels)) {}
    else if (trees.length) {
      const tg = new THREE.CylinderGeometry(0.2, 0.3, 1, 6).translate(0, 0.5, 0), cg = new THREE.IcosahedronGeometry(1, 0), T1 = new THREE.InstancedMesh(tg, M(0x6b4a2e), trees.length), T2 = new THREE.InstancedMesh(cg, M(0x4f8a3a), trees.length), m = new THREE.Matrix4();
      trees.forEach(([x, z, h], i) => { T1.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(1, h * 0.45, 1))); T2.setMatrixAt(i, m.compose(new THREE.Vector3(x, h * 0.55, z), new THREE.Quaternion(), new THREE.Vector3(h * 0.3, h * 0.3, h * 0.3))); });
      T2.castShadow = true; T1.frustumCulled = T2.frustumCulled = false; G.add(T1, T2);
    }
  };
  // задънените краища: рамката на картата (краищата до ръба са продължения извън нея — не се пипат) и точки по улиците през 3 м в мрежа 25 м
  const ends = (() => { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; const S0 = D && D.sea;
    if (S0) { x0 = S0.x0; z0 = S0.z0; x1 = S0.x0 + S0.nx * S0.cell; z1 = S0.z0 + S0.nz * S0.cell; } else for (const [x, z] of P.boundary || []) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    let grid = null; const gk = (x, z) => Math.floor(x / 25) * 100003 + Math.floor(z / 25);
    const build = () => { grid = new Map(); for (const rd of P.roads) { if (rd.noCars) continue; const L = rd.L; for (let s = 0, i = 1; s <= L[L.length - 1]; s += 3) { while (i < L.length - 1 && L[i] < s) i++; const a = rd.pts[i - 1], b = rd.pts[i], t = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1), x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, k = gk(x, z); (grid.get(k) || grid.set(k, []).get(k)).push(x, z, rd.id); } } };
    return { inside: (x, z) => x > x0 + 40 && x < x1 - 40 && z > z0 + 40 && z < z1 - 40,
      near(e, own, dir) { if (!grid) build(); const l = Math.hypot(dir[0], dir[1]) || 1, ux = dir[0] / l, uz = dir[1] / l; let best = null, bd = 25 * 25; const i = Math.floor(e[0] / 25), j = Math.floor(e[1] / 25);
        for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) { const c = grid.get(a * 100003 + b); if (c) for (let k = 0; k < c.length; k += 3) { if (c[k + 2] === own) continue; const dx = c[k] - e[0], dz = c[k + 1] - e[1], d = dx * dx + dz * dz; if (d < bd && d > 0.25 && (dx * ux + dz * uz) / Math.sqrt(d) > 0.5) { bd = d; best = [c[k], c[k + 1]]; } } }   // само напред (до 60° от посоката на пътя)
        return best; },
      onRoad(e, own) { if (!grid) build(); let best = null; const i = Math.floor(e[0] / 25), j = Math.floor(e[1] / 25);   // друга улица, върху чието платно/тротоар е точката → { rd, d }
        for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) { const c = grid.get(a * 100003 + b); if (c) for (let k = 0; k < c.length; k += 3) { if (c[k + 2] === own) continue; const R2 = P.roads[c[k + 2]]?.id === c[k + 2] ? P.roads[c[k + 2]] : P.roads.find(r => r.id === c[k + 2]), d = Math.hypot(c[k] - e[0], c[k + 1] - e[1]); if (R2 && d < R2.w / 2 + R2.walk && (!best || d < best.d)) best = { rd: R2, d }; } }
        return best; } };
  })();
  // ---- главният генератор: пръстените на улиците (най-близките — първи), дърветата, мебелта и светофарите, гарата, надписите, корабите,
  // Кремъл, фоновите сгради, свободните парцели. Всяко yield е малка стъпка; 'usable' — след първия пръстен (opts.progressive: дотук — веднага).
  const ST = { F: null, pools: null, LB: null, BT: null, BL: null, FP: null, night: false, lampsOut: [] };
  const fc = opts.focus || [P.center.x, P.center.z], d2 = (x, z) => (x - fc[0]) ** 2 + (z - fc[1]) ** 2, byD = (arr, xz) => arr.map(a => [a, d2(...xz(a))]).sort((a, b) => a[1] - b[1]).map(a => a[0]);
  function* all() {
    const R = byD(P.roads, rd => rd.pts[rd.pts.length >> 1]), N = byD(P.nodes, n => [n.x, n.z]), Tu = byD(P.turns || [], t => [t.x, t.z]), Ro = byD(P.rounds, r => [r.x, r.z]);
    const CUT = [0, 0.15, 0.4, 0.7, 1], part = (arr, k) => arr.slice(Math.floor(arr.length * CUT[k]), Math.floor(arr.length * CUT[k + 1]));
    // фоновите квартали и свободните парцели: osm-fill (opts.blocksEarly) — веднага след най-близките улици (иначе — накрая, след ~25 s при бавен браузър:
    // около централата „пустиня“ от бежови парцели); те ползват само плана (P), не мешовете на улиците
    function* blocksFill() {
      if ((D && opts.blocks !== false) || opts.blocks === 'bg') ST.BL = yield* romeBlocks(G, P, D ? D.style : 'bg', R, opts.roofs, D);   // 'bg' (bg-fill) — градовете по плана без карта
      tm('blocks'); yield 0;
      // свободните парцели (истинската карта): трева с пръст, ниска ограда отзад и отстрани, табела „Продава се“ откъм улицата (opts.freeLot)
      ST.FP = (D || opts.blocks === 'bg') && opts.freeLot ? freePlots(G, P) : null;
      refill(); tm('fill');
    }
    for (let k = 0; k < 4; k++) { yield* streets(part(R, k), part(N, k), part(Tu, k), part(Ro, k)); tm('streets' + k); if (!k) { yield 'usable'; if (opts.blocksEarly) { yield* blocksFill(); yield 0; } } }
    parkTrees(); tm('trees'); yield 0;
    if (opts.furniture !== false) { const F = ST.F = yield* furniture(G, P, opts);
      if (F && F.lamps.length && opts.lampGlow !== false) {
        const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d', FCPU), gr = g.createRadialGradient(32, 32, 1, 32, 32, 31); gr.addColorStop(0, 'rgba(255,214,140,0.9)'); gr.addColorStop(0.5, 'rgba(255,190,110,0.3)'); gr.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
        ST.pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: canvasTex(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6 }), F.lamps.length);
        const m = new THREE.Matrix4(); F.lamps.forEach(([x, z, y], i) => ST.pools.setMatrixAt(i, y > 7 ? m.makeScale(1.6, 1, 1.6).setPosition(x, 0.15, z) : m.makeTranslation(x, 0.15, z)));   /* street-real: под високите LED — по-широко петно */ ST.pools.visible = false; ST.pools.frustumCulled = false; F.FURN.add(ST.pools);
      }
      ST.lampsOut = F.lamps.filter((_, i) => i % Math.max(1, Math.ceil(F.lamps.length / 160)) === 0).map(([x, z, y]) => ({ x: x + off[0], y: y || 4.8, z: z + off[1] }));
      api.setNight(ST.night); }
    tm('furniture'); yield 0;
    if (D) { ST.glow = streetGlow(G, P, D.style); ST.wash = floodWash(G, P); tm('glow'); yield 0; }
    // Рома Термини (opts.termini): гарата по фасадата към площада (opts.stationModel — моделът на играта, иначе кутия) и перони с навеси и коловози
    const TL = opts.termini ? P.lots.find(L => L.lm === 'termini' || L.lm === 'sirkeci' || L.lm === 'saintlazare' || L.lm === 'waterloo' || L.lm === 'grandcentral' || L.lm === 'kursky' || L.lm === 'unionstation' || L.lm === 'hbf' || L.lm === 'sofiacentral')   /* berlin-osm / sofia-osm (T2) */ : null;   // главната гара: Термини (Рим), Сиркеджи (Истанбул), Сен Лазар (Париж), Ватерло, Гранд Сентрал, Курската
    if (TL) G.add(terminiView(TL, opts.stationModel, opts.stationFacing));   // stationFacing: { face: '-z', depth: 0.8 } — фасадата на модела е към −z (към улицата), сградата заема 80 % от дълбочината
    const TS = opts.timesSquareModel && P.lots.find(L => L.lm === 'timessquare'); if (TS) G.add(timesSquareView(TS, opts.timesSquareModel));   // Ню Йорк: билбордовете около Таймс Скуеър
    { const TSL = P.lots.find(L => L.lm === 'timessquare'); if (TSL) { const L = TSL.vrot != null ? { ...TSL, rot: TSL.vrot } : TSL; ST.TSA = timesSquareAds(L, { side: (L.d >= L.w ? L.w : L.d) / 2 + 2 }); G.add(ST.TSA.group); ST.TSA.setNight(ST.night ? 1 : 0); } }   /* и светещите екрани с рекламите (timessq-ads.js) */
    tm('termini'); yield 0;
    // надписите на картата: водите (Златният рог, Босфорът…, Тибър) и кварталите — спрайтове, отблизо се скриват
    ST.LB = D && opts.labels !== false ? mapLabels(G, D) : null; yield 0;
    ST.BT = D && D.sea && opts.boats !== false ? seaTraffic(G, D, opts.boatModels || {}) : null; if (ST.BT) G.userData.seaBT = ST.BT;   // 🚢 osm-ships: game.js сменя круизния и пресмята моста отново
    ST.RB = D && opts.riverBoats ? riverTraffic(G, D, P, opts.riverBoats) : null;   // river-boats (f9): туристически корабчета и яхти по реката (Тибър, Сена, Темза, Москва)   // Истанбул: фериботи по линиите, кораби по Босфора, лодки в Златния рог
    if (D && D.style === 'moscow') kremlinView(G, D);
    tm('labels+boats'); yield 0;
    // фоновите квартали — фасади с покриви (за парцелите, които играта не ползва: opts.fillLot); пътищата — от най-близките
    if (!opts.blocksEarly) yield* blocksFill();
  }
  const refill = () => { ST.ruT = 0; ST.ruI = 0; if (ST.RN) ST.RN.dirty();   /* rome-bld: парцелите се смениха — наново */   /* fac-reup: след всяко пълнене — отново 3 / 12 / 40 s */ if (ST.BL) ST.BL.fill(opts.fillLot || (() => true), opts.fillAt);   /* fillAt(b) — bg-fill: сградите без парцел (вътре в квартала) */ if (ST.FP) ST.FP.set(opts.freeLot); };
  let sigT = 0;
  const off = opts.offset || [0, 0];
  const job = all(), EST = P.roads.length * 4 + P.nodes.length * 2 + P.rounds.length + 40; let done = false, cancelled = false, units = 0, maxStep = 0, maxAt = '', work = 0, tUsable = 0;
  const step = () => { const t = performance.now(), r = job.next(), dt = performance.now() - t; work += dt; if (dt > maxStep) { maxStep = dt; maxAt = phase; } if (r.done) { done = true; return 'done'; } units++; return r.value; };
  const api = {
    timing: TM, refill,
    get blocks() { return ST.BL ? ST.BL.list : []; },
    hideBlocks: (set, key = 'ruins') => { if (!ST.BL) return; ST.BL.hide(set, key); if (ST.RN) ST.RN.dirty(); },   // fire-ruins: собствен ключ (towers.js / romenear.js крият своите) и близките фасади — наново
    get nightMats() { return [...(ST.F ? [].concat(ST.F.lampMat) : []), ...WIN_MATS, ...(ST.glow ? [ST.glow] : []), ...(ST.wash ? [ST.wash] : [])]; },
    get lamps() { return ST.lampsOut; },   // за daynight.js (до 160) — готови, когато progress стигне 1 (или веднага без progressive)
    setNight(on) { ST.night = !!on; if (ST.TSA) ST.TSA.setNight(on ? 1 : 0); if (ST.F) for (const m of [].concat(ST.F.lampMat)) m.emissiveIntensity = on ? (m.userData.winK || 2.2) : m.userData.winK ? 0 : 0.2; if (ST.pools) ST.pools.visible = !!on; for (const m of [...WIN_MATS, ...(ST.glow ? [ST.glow] : []), ...(ST.wash ? [ST.wash] : [])]) m.emissiveIntensity = on ? (m.userData.winK || 1) : 0; },
    // постепенното строене (opts.progressive): pump(ms) — от frame() на играта, работи до ms милисекунди; progress() — 0…1; cancel() — при смяна на града
    pump(ms = 4) { if (done || cancelled) return 1; const t0 = performance.now(); while (!done && performance.now() - t0 < ms) step(); if (done) TM.total = performance.now() - T0; return api.progress(); },
    progress: () => done ? 1 : Math.min(0.99, units / EST),
    get done() { return done; },
    stats: () => ({ units, est: EST, workMs: Math.round(work), maxStepMs: Math.round(maxStep * 10) / 10, maxAt, usableMs: Math.round(tUsable), totalMs: TM.total ? Math.round(TM.total) : null }),
    cancel() { cancelled = true; try { job.return(); } catch (e) { } },
    // signals — tr.signals() на трафика (traffic.js); camera — дребното се крие отдалеч
    update(dt, o = {}) {
      const F = ST.F;
      if (FREUP) { ST.ruT = (ST.ruT || 0) + dt; if (ST.ruT >= RU_AT[ST.ruI || 0]) { ST.ruI = (ST.ruI || 0) + 1; reupCanvas(G); } }   // fac-reup: фасадите — пак във видеокартата
      if (F && o.camera) F.FURN.visible = o.camera.position.y < 420;
      if (F && F.SIG.tl && o.camera) F.SIG.tl.visible = F.SIG.ped.visible = o.camera.position.y < 220;   // street-real: светофарите (~2,5 хил. триъгълника всеки) — само отблизо
      if (ST.FP && o.camera) ST.FP.near(o.camera.position.y < 260);   // оградите и табелите — само отблизо
      if (ST.LB && o.camera) ST.LB.update(o.camera);
      if (opts.statues && done && ST.SM === undefined && opts.statues.V) ST.SM = placeStatues(G, P, opts.statues.V, opts.statues.o);   // statues: веднъж, когато градът и моделите са готови
      if (opts.romeNear && ST.BL && o.camera) { if (ST.RN === undefined && opts.romeNear.V) ST.RN = (opts.romeNear.fn || romeNear)(G, ST.BL, opts.romeNear.V, { ...opts.romeNear.o, roads: P.roads, lots: P.lots, center: P.center });   /* meshy-tower (f6): fn — towers.js */ if (ST.RN) ST.RN.update(o.camera); }   // rome-bld / it-bld: италианските сгради около камерата ({ V — моделите (може да дойдат по-късно), o — опциите })
      if (ST.BT) ST.BT.update(dt); if (ST.RB) ST.RB.update(dt);
      if (ST.TSA) ST.TSA.update(performance.now() / 1000);   // рекламите на Таймс Скуеър се сменят
      if (!F || !F.SIG.heads || !o.signals || (sigT = (sigT + 1) % 6)) return;
      const byNode = new Map(); for (const s2 of o.signals) byNode.set(s2.node, s2.arms || {});
      F.SIG.heads.forEach((h, i) => { const st = (byNode.get(h.node) || {})[h.arm], cols = SIG_C[st ? st.go : 'red'] || SIG_C.red; for (let k = 0; k < 3; k++) F.SIG.bulbs.setColorAt(i * 3 + k, SC.setHex(cols[k]));
        if (F.SIG.ped) { const walk = !st || (st.go === 'red' && (!st.left || st.left === 'red')); F.SIG.ped.setColorAt(i * 2, SC.setHex(walk ? 0x40ff70 : 0x0f2010)); F.SIG.ped.setColorAt(i * 2 + 1, SC.setHex(walk ? 0x2a1210 : 0xff3020)); } });   // пешеходците: „върви“, когато колите от този клон чакат
      F.SIG.bulbs.instanceColor.needsUpdate = true; if (F.SIG.ped) F.SIG.ped.instanceColor.needsUpdate = true;
    },
    // освобождава геометриите, материалите и текстурите на изгледа — без общите (MAT, фасадите) и без чуждите модели (гарата, корабите, мостът)
    dispose() { api.cancel(); if (ST.TSA) ST.TSA.dispose(); if (ST.RN) ST.RN.dispose(); if (ST.SM) ST.SM.dispose(); const keep = new Set([...Object.values(MAT).flat(), FAC_MAT, OTTO_MAT, APT_MAT, HAUSS_MAT, BRICK_MAT, GLASS_MAT].filter(Boolean));
      const freeMat = m => { if (!m || keep.has(m)) return; for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); } m.dispose(); };
      const walk = o => { if (o.userData && o.userData.extShared) return; if (o.isInstancedMesh) o.dispose(); if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(freeMat); for (const c of o.children) walk(c); };
      walk(G); },
  };
  Object.assign(G.userData, api);
  Object.defineProperty(G.userData, 'blocks', { get: () => ST.BL ? ST.BL.list : [], configurable: true });
  Object.defineProperty(G.userData, 'lamps', { get: () => ST.lampsOut, configurable: true });
  Object.defineProperty(G.userData, 'nightMats', { get: () => api.nightMats, configurable: true });
  Object.defineProperty(G.userData, 'done', { get: () => done, configurable: true });
  if (opts.progressive) { while (!done && step() !== 'usable'); tUsable = performance.now() - T0; }   // веднага: земята, водата и най-близкият пръстен улици
  else { while (!done) step(); tUsable = TM.total = performance.now() - T0; }
  return G;
}

// ---- надписи: [lat, lon, текст, вид] — вид 'w' (вода), 'd' (квартал)
const LABELS = {
  istanbul: [[41.0295, 28.9585, 'Златният рог', 'w'], [41.031, 29.012, 'Босфорът', 'w'], [40.995, 28.985, 'Мраморно море', 'w']],   // кварталите — от данните (OSM2.istanbul.districts)
  rome: [[41.9, 12.4765, '', ''], [41.8865, 12.4745, 'Тибър', 'w']],
  london: [[51.5075, -0.1110, 'Темза', 'w']],
  moscow: [[55.7465, 37.6110, 'Москва река', 'w'], [55.7445, 37.6250, 'Водоотводен канал', 'w'], [55.7540, 37.6560, 'Яуза', 'w']],
  newyork: [[40.7600, -74.0040, 'Хъдсън', 'w'], [40.7520, -73.9640, 'Ист Ривър', 'w']],
  washington: [[38.8880, -77.0580, 'Потомак', 'w'], [38.8835, -77.0390, 'Тайдъл Бейсън', 'w']],
  paris: [[48.8605, 2.3, 'Сена', 'w'], [48.8547, 2.3478, 'о. Сите', 'w'], [48.8517, 2.3567, 'о. Сен Луи', 'w'], [48.8705, 2.3655, 'канал Сен Мартен', 'w']],
};
const RIONI_BG = { Monti: 'Монти', Trevi: 'Треви', Esquilino: 'Есквилино', 'Castro Pretorio': 'Кастро Преторио', Colonna: 'Колона', 'Campo Marzio': 'Кампо Марцио', Trastevere: 'Трастевере', Prati: 'Прати', Ludovisi: 'Лудовизи', Sallustiano: 'Салустиано', Testaccio: 'Тестачо',
  Pigna: 'Пиня', "Sant'Eustachio": 'Сант Еустакио', Parione: 'Парионе', Regola: 'Регола', Ponte: 'Понте', Ripa: 'Рипа', Celio: 'Челио', 'San Saba': 'Сан Саба', "Sant'Angelo": 'Сант Анджело', Campitelli: 'Кампители', Borgo: 'Борго', Flaminio: 'Фламинио', Pinciano: 'Пинчано', Ostiense: 'Остиензе', Gianicolense: 'Джаниколензе', Aurelio: 'Аурелио' };
// Париж: „Paris 7e Arrondissement“ → „7-и арондисман“
const arrBg = nm => { const m = /^Paris (\d+)e/.exec(nm); if (!m) return nm; const n = +m[1], sfx = n === 1 ? 'ви' : n === 2 ? 'ри' : n === 3 || n === 4 ? 'ти' : 'и'; return `${n}-${sfx} арондисман`; };
function labelSprite(text, kind) {
  text = tr(text);
  const c = document.createElement('canvas'), g = c.getContext('2d', FCPU), F = kind === 'w' ? 'italic 600 46px Georgia, serif' : '700 38px system-ui, sans-serif';
  g.font = F; const w = Math.ceil(g.measureText(text).width) + 24; c.width = w; c.height = 64; g.font = F; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.lineWidth = 7; g.strokeStyle = kind === 'w' ? 'rgba(10,40,70,0.85)' : 'rgba(30,25,20,0.8)'; g.strokeText(text, w / 2, 34); g.fillStyle = kind === 'w' ? '#cfe8ff' : '#fff6e0'; g.fillText(text, w / 2, 34);
  const t = canvasTex(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false })); sp.renderOrder = 10; sp.userData.ar = w / 64; return sp;
}
function mapLabels(G, D) {
  const K = D.k, at = (la, lo) => [(lo - D.center[1]) * Math.cos(D.center[0] * Math.PI / 180) * 111320 * K, -(la - D.center[0]) * 110540 * K], out = [];
  for (const [la, lo, text, kind] of LABELS[D.style || 'rome'] || []) { if (!text) continue; const [x, z] = at(la, lo); out.push({ x, z, text, kind }); }
  for (const d of D.districts || []) { if (d.kind !== 'quarter' && !RIONI_BG[d.nm]) continue; const xs = d.poly.map(p => p[0]), zs = d.poly.map(p => p[1]); out.push({ x: d.lab ? d.lab[0] : xs.reduce((a, b) => a + b) / xs.length, z: d.lab ? d.lab[1] : zs.reduce((a, b) => a + b) / zs.length, text: RIONI_BG[d.nm] || arrBg(d.nm), kind: 'd' }); }
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
  const K = D.k, at = (la, lo) => [(lo - D.center[1]) * Math.cos(D.center[0] * Math.PI / 180) * 111320 * K, -(la - D.center[0]) * 110540 * K], grp = new THREE.Group(); grp.position.y = (D.wY ?? -1.2) + 0.2; G.add(grp);
  const boats = [], cum = p => { const L = [0]; for (let i = 1; i < p.length; i++) L.push(L[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])); return L; };
  for (const m of [models.ferry, models.cruise, models.tanker, models.container, ...(models.small || [])]) if (m) floodMats(m, 0xffe2b0, m === models.cruise ? 0.5 : 0.3);   // корабите нощем — с осветени палуби
  const fit = (proto, len, dr = null) => { if (!proto) return null; const o = proto.clone(true), w = new THREE.Group(); o.userData.extShared = 1; const b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3()), long = sz.x > sz.z, k = len / Math.max(sz.x, sz.z); o.scale.setScalar(k); const b2 = new THREE.Box3().setFromObject(o), c = b2.getCenter(new THREE.Vector3()); o.position.set(-c.x, -b2.min.y - (dr != null ? dr * (b2.max.y - b2.min.y) : 0.6), -c.z); if (long) o.rotation.y = Math.PI / 2; w.add(o); return w; };   /* dr — газенето като част от височината (osm-ships: големите кораби) */
  const add = (obj, path, sp, mode, ph) => { if (!obj || path.length < 2) return; const L = cum(path); grp.add(obj); boats.push({ obj, path, L, T: L[L.length - 1], sp, mode, s: ph * L[L.length - 1], dir: 1, wait: 0 }); };
  // фериботите: еднаквите линии — веднъж; по един ферибот на линия (до 14)
  const seen = new Set(); let n = 0;
  for (const f of D.ferries || []) { if (f.pts.length < 2 || n >= 14) continue; const key = [f.pts[0], f.pts[f.pts.length - 1]].map(p => Math.round(p[0] / 40) + ',' + Math.round(p[1] / 40)).sort().join('|'); if (seen.has(key)) continue; seen.add(key); n++; add(fit(models.ferry, 34) || ferryModel(), f.pts, 7, 'shuttle', (n * 0.37) % 1); }   // моделът (Бандърма вапуру) или процедурният
  const bos = LANES.bosphorus.map(q => at(...q)), horn = LANES.horn.map(q => at(...q)), off = (p, d) => p.map(([x, z], i) => { const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [x - (b[1] - a[1]) / l * d, z + (b[0] - a[0]) / l * d]; });
  const LN = (k, d) => (models.len && models.len[k]) || d, DR = k => models.draft ? models.draft[k] ?? null : null;   // 🚢 osm-ships: истинските дължини (круизният ~300 м) и газенето
  [['tanker', 95, 0.1, 1], ['container', 110, 0.55, 1], ['cruise', 120, 0.4, 1], ['tanker', 85, 0.3, -1], ['container', 100, 0.8, -1], ['cruise', 110, 0.95, -1]].forEach(([k, len, ph, side]) => { const n0 = boats.length; add(((w) => (w && (w.userData.seaShip = k), w))(fit(models[k], LN(k, len), DR(k))), off(side > 0 ? bos : bos.slice().reverse(), models.len ? 75 : 40 * side), 9, 'loop', ph); if (boats.length > n0) { boats[n0].lane = side; boats[n0].ph = ph; } });   // двупосочно: всяка посока в своя половина (osm-ships: обратният път сам обръща страната — отместването е +75 и за двете посоки)   // двупосочно: всяка посока в своя половина
  (models.small || []).forEach((m, i) => add(fit(m, i % 2 ? 9 : 12), off(i % 2 ? horn : horn.slice().reverse(), (i % 3 - 1) * 25), 4, 'loop', (i * 0.29) % 1));
  const V = new THREE.Vector3();
  // 🚢 osm-ships: под мостовете — лъч нагоре по пътя на всеки голям кораб (през 40 м); по-висок от долния ръб на моста минус 5 м → смален (еднакво по осите)
  const cap = () => { if (!models.len) return; G.updateMatrixWorld(true); const wy = grp.getWorldPosition(new THREE.Vector3()).y, rc = new THREE.Raycaster(), UP = new THREE.Vector3(0, 1, 0), P0 = new THREE.Vector3(), bx = new THREE.Box3(), mb = new THREE.Box3();
    for (const b of boats) { if (!b.obj.userData.seaShip) continue; bx.makeEmpty(); for (const [x, z] of b.path) bx.expandByPoint(G.localToWorld(P0.set(x, 0, z))); bx.expandByScalar(60); bx.min.y = wy + 8; bx.max.y = wy + 400;
      const T = []; G.traverse(m => { if (!m.isMesh || m.isInstancedMesh || m.isSprite) return; for (let p = m; p; p = p.parent) if (p === grp) return; if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); mb.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); if (mb.intersectsBox(bx) && mb.max.y > wy + 8) T.push(m); });
      if (!T.length) continue; let low = Infinity;   /* най-ниският връх над водата (+8 м) до 35 м от пътя — долният ръб на моста там, където корабът минава */
      const segs = b.path.slice(1).map((c, i) => [G.localToWorld(new THREE.Vector3(b.path[i][0], 0, b.path[i][1])), G.localToWorld(new THREE.Vector3(c[0], 0, c[1]))]);
      const near = (x, z) => { for (const [p, q] of segs) { const dx = q.x - p.x, dz = q.z - p.z, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - p.x) * dx + (z - p.z) * dz) / l2)), ex = p.x + dx * t - x, ez = p.z + dz * t - z; if (ex * ex + ez * ez < 35 * 35) return true; } return false; };
      for (const m of T) { const A = m.geometry.attributes.position; for (let i = 0; i < A.count; i++) { P0.fromBufferAttribute(A, i).applyMatrix4(m.matrixWorld); const h = P0.y - wy; if (h > 8 && h < low && near(P0.x, P0.z)) { low = h; b.lowP = [P0.x, P0.z]; } } }
      if (low !== Infinity) { b.low = +low.toFixed(1); const lp = G.worldToLocal(new THREE.Vector3(b.lowP[0], 0, b.lowP[1])); let bs = 0, bd = Infinity; for (let i = 1; i < b.path.length; i++) { const a = b.path[i - 1], c = b.path[i], dx = c[0] - a[0], dz = c[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((lp.x - a[0]) * dx + (lp.z - a[1]) * dz) / l2)), e = Math.hypot(a[0] + dx * t - lp.x, a[1] + dz * t - lp.z); if (e < bd) { bd = e; bs = b.L[i - 1] + t * (b.L[i] - b.L[i - 1]); } } b.lowS = bs; }   /* къде по пътя е мостът (за камерата) */
      if (low === Infinity) continue; b.obj.updateMatrixWorld(true); const top = new THREE.Box3().setFromObject(b.obj).max.y - wy, lim = low - 5;
      if (top > lim && top > 0) b.need = true; }
    // по-висок от моста: пътят на ЦЯЛАТА лента спира преди моста (по-дългата страна) — всички кораби в лентата са по един и същи път, в една посока, с една скорост
    // и с отместени фази (≥ 0,15 от пътя) → не се застъпват; корабите остават в истински размер. Остане ли по-малко от 600 м — смаляване (както преди)
    for (const ln of [1, -1]) { const B = boats.filter(q => q.lane === ln && q.obj.userData.seaShip); const need = B.filter(q => q.need && q.lowS != null); if (!need.length || B[0].cut != null) continue;
      const P0p = B[0].path, L0 = cum(P0p), T0 = L0[L0.length - 1]; let s0 = 0, s1 = T0;
      for (const q of need) { const hl = new THREE.Box3().setFromObject(q.obj).getSize(new THREE.Vector3()), half = Math.max(hl.x, hl.z) / 2 + 80, a0 = q.lowS - half, a1 = q.lowS + half; if (a0 > T0 - a1) s1 = Math.min(s1, a0); else s0 = Math.max(s0, a1); }
      if (s1 - s0 < 600) { for (const q of need) { const t2 = new THREE.Box3().setFromObject(q.obj).max.y - wy, l2 = q.low - 5; if (t2 > l2) { q.obj.scale.multiplyScalar(Math.max(0.3, l2 / t2)); q.capped = +(l2 / t2).toFixed(2); } } continue; }
      const pt = q => { let i = 1; while (i < L0.length - 1 && L0[i] < q) i++; const A = P0p[i - 1], C = P0p[i], f = Math.min(1, Math.max(0, (q - L0[i - 1]) / ((L0[i] - L0[i - 1]) || 1))); return [A[0] + (C[0] - A[0]) * f, A[1] + (C[1] - A[1]) * f]; };
      const P = [pt(s0)]; for (let i = 1; i < P0p.length - 1; i++) if (L0[i] > s0 && L0[i] < s1) P.push(P0p[i]); P.push(pt(s1)); const L = cum(P), T = L[L.length - 1];
      for (const q of B) { q.path = P; q.L = L; q.T = T; q.s = (q.ph ?? 0) * T; q.mode = 'loop'; q.cut = s0 > 0 ? 0 : T; q.capped = 'lane'; } } };
  let capT = 0, capped = false;
  return { cap, boats, update(dt) { dt = Math.min(dt || 0, 0.1); if (!capped && (capT += dt) > 2) { capped = true; try { cap(); } catch (e) { console.warn('osm-ships cap', e); } }
    for (const b of boats) {
      if (b.wait > 0) { b.wait -= dt; continue; }
      b.s += b.dir * b.sp * dt;
      if (b.mode === 'shuttle' && (b.s >= b.T || b.s <= 0)) { b.s = Math.max(0, Math.min(b.T, b.s)); b.dir *= -1; b.wait = 8; }   // на кея — 8 s
      if (b.mode === 'loop' && b.s >= b.T) b.s = 0;
      let i = 1; while (i < b.L.length - 1 && b.L[i] < b.s) i++; const a = b.path[i - 1], c = b.path[i], t = (b.s - b.L[i - 1]) / ((b.L[i] - b.L[i - 1]) || 1);
      b.obj.position.set(a[0] + (c[0] - a[0]) * t, 0, a[1] + (c[1] - a[1]) * t); b.obj.rotation.y = Math.atan2((c[0] - a[0]) * b.dir, (c[1] - a[1]) * b.dir);
    } } };
}
// ---- river-boats (f9): реката — линията D.river (Рим) или средата на водата по колони (Париж, Лондон, Москва: реката е в маската sea);
// по нея — туристически корабчета (ниски, ~28 м) напред-назад в две ленти и малки яхти; само водни ивици 25–260 м (не морето)
function riverPath(D, P) {
  if (D.river && D.river.length) { const r = D.river.slice().sort((a, b) => b.length - a.length)[0], B = P.boundary, ins = p => !B || inPoly2(p, B);   // OSM реката продължава извън града — само най-дългото парче вътре
    let best = [], cur = []; for (const p of r) { if (ins(p)) cur.push(p); else { if (cur.length > best.length) best = cur; cur = []; } } if (cur.length > best.length) best = cur; return best.length > 4 ? best : null; }
  if (!P.waterAt || !P.boundary) return null;
  const xs = P.boundary.map(p => p[0]), zs = P.boundary.map(p => p[1]), X0 = Math.min(...xs), X1 = Math.max(...xs), Z0 = Math.min(...zs), Z1 = Math.max(...zs), ST = 10;
  const chain = byX => { const pts = [], A0 = byX ? X0 : Z0, A1 = byX ? X1 : Z1, B0 = byX ? Z0 : X0, B1 = byX ? Z1 : X1; let prev = null, best = [], cur = [];
    for (let a = A0; a <= A1; a += ST) { const segs = []; let st = null;
      for (let b = B0; b <= B1 + ST; b += ST) { const w = b <= B1 && P.waterAt(byX ? a : b, byX ? b : a); if (w && st == null) st = b; else if (!w && st != null) { const wd = b - st; if (wd >= 25 && wd <= 260) segs.push((st + b - ST) / 2); st = null; } }
      let m = null; if (segs.length) m = prev == null ? segs[0] : segs.reduce((q, v) => Math.abs(v - prev) < Math.abs(q - prev) ? v : q);
      if (m != null && (prev == null || Math.abs(m - prev) < 45)) { cur.push(byX ? [a, m] : [m, a]); prev = m; } else { if (cur.length > best.length) best = cur; cur = m != null ? [byX ? [a, m] : [m, a]] : []; prev = m; } }
    return cur.length > best.length ? cur : best; };
  const a = chain(true), b = chain(false), r = a.length >= b.length ? a : b; return r.length > 20 ? r : null;
}
function riverTraffic(G, D, P, models) {
  const path0 = riverPath(D, P); if (!path0) return null;
  const grp = new THREE.Group(); grp.position.y = (D.wY ?? -1.2) + 0.2; G.add(grp);
  const cum = p => { const L = [0]; for (let i = 1; i < p.length; i++) L.push(L[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])); return L; };
  const off = (p, d) => p.map(([x, z], i) => { const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [x - (b[1] - a[1]) / l * d, z + (b[0] - a[0]) / l * d]; });
  const fit = (proto, len, hMax) => { if (!proto) return null; const o = proto.clone(true), w = new THREE.Group(); o.userData.extShared = 1; const b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3()), long = sz.x > sz.z, k = len / Math.max(sz.x, sz.z), ky = Math.min(k, hMax / Math.max(0.1, sz.y));
    o.scale.set(k, ky, k); if (long) o.rotation.y = Math.PI / 2; w.add(o); w.updateMatrixWorld(true); const b2 = new THREE.Box3().setFromObject(w), c = b2.getCenter(new THREE.Vector3()); o.position.set(-c.x, -b2.min.y - 0.4, -c.z); return w; };   // ниско — минава под мостовете
  for (const m of [models.tour, ...(models.small || [])]) if (m) floodMats(m, 0xffe2b0, 0.4);
  const T = cum(path0).at(-1), boats = [], n = Math.max(1, Math.min(5, Math.round(T / 380)));
  const add = (obj, path, sp, ph, mode) => { if (!obj) return; const L = cum(path); grp.add(obj); boats.push({ obj, path, L, T: L[L.length - 1], sp, s: ph * L[L.length - 1], dir: 1, wait: 0, mode }); };
  const lane = Math.max(4, Math.min(14, (D.riverHW || 30) * 0.35));
  for (let i = 0; i < n; i++) add(fit(models.tour, 28, 4.2), off(i % 2 ? path0.slice().reverse() : path0, lane), 3.2, (i + 0.3) / n, 'shuttle');   // туристическите — по своята лента, обръщат в края
  (models.small || []).forEach((m, i) => { if (i < 3) add(fit(m, 10, 3.5), off(i % 2 ? path0 : path0.slice().reverse(), -lane * 0.6), 5 + i, (i * 0.37 + 0.1) % 1, 'shuttle'); });
  return { update(dt) { dt = Math.min(dt || 0, 0.1);
    for (const b of boats) {
      if (b.wait > 0) { b.wait -= dt; continue; } b.s += b.dir * b.sp * dt;
      if (b.s >= b.T || b.s <= 0) { b.s = Math.max(0, Math.min(b.T, b.s)); b.dir *= -1; b.wait = 6; }
      let i = 1; while (i < b.L.length - 1 && b.L[i] < b.s) i++; const a = b.path[i - 1], c = b.path[i], t = (b.s - b.L[i - 1]) / ((b.L[i] - b.L[i - 1]) || 1);
      b.obj.position.set(a[0] + (c[0] - a[0]) * t, 0, a[1] + (c[1] - a[1]) * t); b.obj.rotation.y = Math.atan2((c[0] - a[0]) * b.dir, (c[1] - a[1]) * b.dir);
    } }, info: () => ({ len: Math.round(T), boats: boats.length }) };
}
// ---- Таймс Скуеър: ъгловата сграда с билбордове (assets/heavy/lm/timessq.glb, Building-studio, CC BY; плакатите — наши реклами) в 4 копия
// по двата края на площада (по дългата му ос), обърнати към него; нощем билбордовете светят сами (emissiveMap = map → WIN_MATS)
function timesSquareView(L0, model) {
  const L = L0.vrot != null ? { ...L0, rot: L0.vrot } : L0;
  const g = new THREE.Group(), lit = new Set();
  model.traverse(o => { const uv = o.isMesh && o.geometry.attributes.uv; let rep = false; if (uv) for (let i = 0; i < uv.count && !rep; i++) rep = Math.abs(uv.getX(i)) > 1.05 || Math.abs(uv.getY(i)) > 1.05;   /* стените (повтаряща се текстура) не светят — само билбордовете */
    if (o.isMesh && !rep) for (const m of [].concat(o.material)) if (m && m.map && !lit.has(m) && !WIN_MATS.includes(m)) { m.emissive = new THREE.Color(0xffffff); m.emissiveMap = m.map; m.emissiveIntensity = 0; m.userData.winK = 1.6; WIN_MATS.push(m); lit.add(m); } });
  const b0 = new THREE.Box3().setFromObject(model), s0 = b0.getSize(new THREE.Vector3()), FP = 30, k = FP / Math.max(s0.x, s0.z);   // основа ~30 м
  const c = Math.cos(L.rot), sn = Math.sin(L.rot), long = L.d >= L.w, half = (long ? L.d : L.w) / 2, side = (long ? L.w : L.d) / 2 + FP / 2 + 2;
  for (const [u, v] of [[-1, -0.55], [1, -0.55], [-1, 0.55], [1, 0.55]]) {   // u — от двете страни на площада, v — по дължината му
    const lx = long ? u * side : v * half, lz = long ? v * half : u * side, x = L.x + lx * c + lz * sn, z = L.z - lx * sn + lz * c;
    const o = model.clone(true); o.userData.extShared = 1; const w = new THREE.Group(), inner = new THREE.Group(); inner.add(o); w.add(inner);
    inner.scale.setScalar(k); const b = new THREE.Box3().setFromObject(inner), cc = b.getCenter(new THREE.Vector3()); inner.position.set(-cc.x, -b.min.y, -cc.z);
    w.position.set(x, 0, z); w.rotation.y = Math.atan2(L.x - x, L.z - z) + Math.PI;   // лицето (с билбордовете) — към площада
    w.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true; }); g.add(w); }
  return g;
}
// was-union (f9): Юниън Стейшън (Вашингтон) — гаровият терен в осите на парцела (u — напречно, v — назад от площада, м от центъра му):
// сградата (bu) с лицето (v = front) към Columbus Circle / Massachusetts Ave, перонните навеси (pu) зад нея до H Street (v = back);
// фоновите сгради, пейките и парцелите за строеж — не върху него (парцелът на забележителността е по-голям и стърчеше над кръговото)
export const STATION_YARD = { unionstation: { bu: [-16, 70], front: -36, pu: [-16, 70], back: 134, maxH: 44 } };   // maxH — по-висока от was-look (34 м): кулата на station-big ограничава ръста
export const yardOf = L => (feature('was-union') && L && STATION_YARD[L.lm]) || null;
export const inYard = (L, x, z, pad = 0) => { const Y = yardOf(L); if (!Y) return null; const r = L.rot || 0, dx = x - L.x, dz = z - L.z, u = dx * Math.cos(r) - dz * Math.sin(r), v = -dx * Math.sin(r) - dz * Math.cos(r);
  return (u > Y.bu[0] - pad && u < Y.bu[1] + pad && v > Y.front - pad && v < Y.front + 60 + pad) || (u > Y.pu[0] - pad && u < Y.pu[1] + pad && v > Y.front - pad && v < Y.back + pad); };
function terminiView(L0, model, sf = {}) {
  const L = L0.vrot != null ? { ...L0, rot: L0.vrot } : L0;   // vrot — истинското завъртане (Ню Йорк)
  const g = new THREE.Group(), nx = -Math.sin(L.rot), nz = -Math.cos(L.rot), tx = Math.cos(L.rot), tz = -Math.sin(L.rot), len = 140, N = 9;
  const roof = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.5, metalness: 0.4 }), plat = M(0xb9b2a4), rail = M(0x5a544c), col = M(0x6d7278);
  const Y = yardOf(L0) && { ...yardOf(L0) };   // was-union: гаровият терен (сградата и пероните само в него)
  // сградата: моделът, побран в предните 55 % от парцела, с лицето към площада
  const ms = model && new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()), sq = ms && Math.abs(ms.x / ms.z - 1) < 0.25;   // квадратен модел (Сен Лазар — сграда около двор) — по-дълбоко в парцела
  const dep = sf.depth || (sq ? 1 : 0.55), back = L.d * Math.max(0.3, dep - 0.5), bw = sq ? L.d : L.w, bd = L.d * dep, bx =   /* квадратният модел — квадрат с цялата дълбочина */ L.x - nx * (L.d - bd) / 2, bz = L.z - nz * (L.d - bd) / 2;
  if (model) { const o = model.clone(true), w = new THREE.Group(), inner = new THREE.Group(); o.userData.extShared = 1; inner.add(o); w.add(inner);
    let b = new THREE.Box3().setFromObject(inner), sz = b.getSize(new THREE.Vector3()); if ((sz.x > sz.z) !== (bw > bd)) { inner.rotation.y = Math.PI / 2; b = new THREE.Box3().setFromObject(inner); sz = b.getSize(new THREE.Vector3()); }
    if (sf.face === '-z') inner.rotation.y += Math.PI;   // лицето (−z) — към улицата пред гарата, пероните — зад нея
    const k = Math.min(bw / sz.x, bd / sz.z, sf.maxW ? sf.maxW / sz.x : 1e9, (Y && Y.maxH || sf.maxH) ? (Y && Y.maxH || sf.maxH) / sz.y : 1e9);   /* maxH — и по височина (Юниън Стейшън с кулата на station-big) */ inner.scale.setScalar(k); b = new THREE.Box3().setFromObject(inner); const c = b.getCenter(new THREE.Vector3()); inner.position.set(-c.x, -b.min.y, -c.z);   // maxW — най-широката фасада (Гранд Сентрал — иначе огромна)
    const ad = sz.z * k; w.position.set(L.x - nx * (L.d - ad) / 2, 0, L.z - nz * (L.d - ad) / 2); if (Y) { const bu = (Y.bu[0] + Y.bu[1]) / 2, v = Y.front + ad / 2; w.position.set(L.x + tx * bu + nx * v, 0, L.z + tz * bu + nz * v); Y.v0 = Y.front + ad + 3; }   /* was-union: лицето — на Y.front, пероните — зад сградата */   /* лицето — на улицата отпред, колкото и да е дълбока сградата */ w.rotation.y = L.rot; w.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true; }); g.add(w); }
  else { const o = new THREE.Mesh(new THREE.BoxGeometry(bw, 12, bd), M(0xd8d2c4)); o.position.set(bx, 6, bz); o.rotation.y = L.rot; o.castShadow = true; g.add(o); }
  const v0 = Y ? (Y.v0 ?? Y.front + 40) : 0, YL = Y ? Y.back - v0 : len, YN = Y ? Math.max(4, Math.round((Y.pu[1] - Y.pu[0]) / 9.5)) : N, YS = Y ? (Y.pu[1] - Y.pu[0]) / YN : 0;   // was-union: от гърба на сградата до H Street, през ширината pu
  for (let i = 0; i < YN; i++) { const u = Y ? Y.pu[0] + YS * (i + 0.25) : (i - (N - 1) / 2) * (L.w * 0.9 / N), vc = Y ? v0 + YL / 2 : back + len / 2, c = [L.x + tx * u + nx * vc, L.z + tz * u + nz * vc], len2 = Y ? YL : len, tx2 = Y ? 0 : 15;
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, len2), plat), r2 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.25, len2), roof), tr = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, len2 + 2 * tx2), rail);
    for (const [o, y, off] of [[p2, 0.45, 0], [r2, 5.2, 0], [tr, 0.06, Y ? YS / 2 : L.w * 0.45 / N]]) { o.position.set(c[0] + tx * off + nx * (o === tr ? tx2 : 0), y, c[1] + tz * off + nz * (o === tr ? tx2 : 0)); o.rotation.y = L.rot; o.castShadow = o !== tr; o.receiveShadow = true; g.add(o); }
    for (let k = -len2 / 2 + 8; k < len2 / 2; k += 16) { const cl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4.6, 6), col); cl.position.set(c[0] + nx * k, 2.9, c[1] + nz * k); g.add(cl); } }
  return g;
}
// Рим: затворено застрояване — по двете страни на всяка улица редица от сгради (14 м фасада, 15 м дълбочина, 13–21 м височина),
// в цветовете на Рим; не върху улица, вода, парк/археология или забележителност. Рисуват се като фасада + керемиден покрив (2 инстанции).
const ROMA = [0xd9a066, 0xc8794e, 0xe2c27a, 0xb5654a, 0xd8b48a, 0xe7d3a8, 0xc98f5b, 0xa9583f];
function* romeBlocks(G, P, style, ROADS = P.roads, ROOFS = null, D0 = null) {   // ROOFS — покривите на града (tokyo-look / dubai-look / sg-look): [{ col, flat }] по вида   // генератор: yield след всеки път; ROADS — подредени (най-близките първи)
  const rg = new Map(), gc = 12, key = (x, z) => Math.floor(x / gc) * 100003 + Math.floor(z / gc);   // числови ключове (низовете бяха половината време)
  P.roads.forEach(rd => rd.pts.forEach(p => { const k = key(p[0], p[1]); (rg.get(k) || rg.set(k, []).get(k)).push([p[0], p[1], rd.w / 2 + rd.walk + 0.8, rd.id]); }));
  const nearRoad = (x, z, own) => { const i = Math.floor(x / gc), j = Math.floor(z / gc); for (let a = i - 2; a <= i + 2; a++) for (let b = j - 2; b <= j + 2; b++) for (const [px, pz, r, id] of rg.get(a * 100003 + b) || []) if (id !== own && Math.hypot(px - x, pz - z) < r) return true; return false; };
  const GB = (P.greensSrc || []).map(g => { const xs = g.poly.map(p => p[0]), zs = g.poly.map(p => p[1]); return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), g.poly]; });
  const GG = new Map(); for (const gb of GB) for (let i = Math.floor(gb[0] / 50); i <= Math.floor(gb[2] / 50); i++) for (let j = Math.floor(gb[1] / 50); j <= Math.floor(gb[3] / 50); j++) { const k = i * 100003 + j; (GG.get(k) || GG.set(k, []).get(k)).push(gb); }   // парковете в мрежа 50 м
  const green = (x, z) => { const c = GG.get(Math.floor(x / 50) * 100003 + Math.floor(z / 50)); return !!c && c.some(([x0, z0, x1, z1, poly]) => x >= x0 && x <= x1 && z >= z0 && z <= z1 && inPoly2([x, z], poly)); }, lms = P.lots.filter(L => L.lm), inLm = (x, z) => lms.some(L => inYard(L, x, z, 4) ?? Math.hypot(L.x - x, L.z - z) < Math.max(L.w, L.d) / 2 + (L.guard || 4) + 4);   /* was-union: гаровият терен вместо кръга */
  // парцелите (за fillLot): кой парцел е под мястото на сградата
  const AP = P.access && P.access.park, inAcc = (x, z) => { if (!AP) return false; const c = Math.cos(AP.rot), sn = Math.sin(AP.rot), dx = x - AP.x, dz = z - AP.z; return Math.abs(dx * c - dz * sn) < AP.w / 2 + 3 && Math.abs(dx * sn + dz * c) < AP.d / 2 + 3; };   // station-access (f9): без фасади върху паркинга до гарата
  const lg = new Map(), lk = (x, z) => Math.floor(x / 40) * 100003 + Math.floor(z / 40); for (const L of P.lots) { const k = lk(L.x, L.z); (lg.get(k) || lg.set(k, []).get(k)).push(L); }
  const lotAt = (x, z) => { const i = Math.floor(x / 40), j = Math.floor(z / 40); for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) for (const L of lg.get(a * 100003 + b) || []) { const c = Math.cos(L.rot), s = Math.sin(L.rot), dx = x - L.x, dz = z - L.z; if (Math.abs(dx * c - dz * s) < L.w / 2 + 4 && Math.abs(dx * s + dz * c) < L.d / 2 + 4) return L; } return null; };
  const WC = new Map(), wat = (x, z) => { const k = Math.round(x / 3) * 100003 + Math.round(z / 3); let v = WC.get(k); if (v === undefined) { v = P.waterAt(x, z); WC.set(k, v); } return v; };   // водата — с кеш по 3 м (реката на Рим е скъпа)
  // без застъпване: на ъглите сградите от двете пресичащи се улици падаха една в друга (Рим: 2183 двойки) — центърът на новата трябва да е
  // на поне 0,72 × min(фасада, дълбочина) от вече сложените (съседите по една улица са на точно една фасада — остават)
  const PG = new Map(), pgk = (x, z) => Math.floor(x / 12) * 100003 + Math.floor(z / 12), mark = (x, z) => { const k = pgk(x, z); (PG.get(k) || PG.set(k, []).get(k)).push(x, z); };
  let MIN2 = 0; const clash = (x, z) => { const i = Math.floor(x / 12), j = Math.floor(z / 12); for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) { const c = PG.get(a * 100003 + b); if (c) for (let q = 0; q < c.length; q += 2) if ((c[q] - x) ** 2 + (c[q + 1] - z) ** 2 < MIN2) return true; } return false; };
  const romeOuter = (x, z) => { const L = lotAt(x, z); return !!L && (L.tier || 1) >= 3; };
  const list = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const IST = style === 'istanbul', PAR = style === 'paris', LON = style === 'london', NY = style === 'newyork', MOS = style === 'moscow', WAS = style === 'washington', LV = style === 'lasvegas', DEP0 = IST ? 12 : 15, STEP = IST ? 10 : PAR ? 13 : LON ? 11 : NY ? 17 : 14, used = new Set(); MIN2 = (0.72 * Math.min(STEP, IST ? 8 : DEP0)) ** 2;
  const OSMH = feature('osm-heights') && !!P.osm;   // osm-heights (T2): височините по нивото на квартала
  // 🗽 ny-tall (собственикът: забележителностите са в истински ръст, обикновените сгради — в мащаба на картата): в Манхатън (Мидтаун — от 8-мо авеню на изток, без Хелс Кичън; Даунтаун/ФиДи)
  // обикновените сгради — по-високи (кулите ×2, другите ×1,6, до 250 м). Само височината на инстанцията (y) — без нови триъгълници и draw call-ове;
  // прозорците се повтарят по мащаба (tileByScale) — повече етажи, не разтеглени. Бруклин, Куинс и ниските квартали — както са
  const OD = D0 && D0.center ? D0 : null, NYT = NY && feature('ny-tall') && OD && OD.k ? (x, z) => { const la = OD.center[0] - z / (110540 * OD.k), lo = OD.center[1] + x / (Math.cos(OD.center[0] * Math.PI / 180) * 111320 * OD.k); return (la > 40.742 && la < 40.768 && lo > -73.992 && lo < -73.965) || (la > 40.700 && la < 40.722 && lo > -74.020 && lo < -73.998); } : null;
  const BG = style === 'bg', VAR = (PAR || IST || (WAS && feature('was-fed')) || (MOS && feature('dc-msk-fac'))) && feature('bg-variety'),   /* T2 dc-msk-fac: и Москва */ XK = VAR || BG;   /* was-fed (55): и Вашингтон — федералният варовик */
  // was-fed (55): във Вашингтон парцелите са тесни (12 м), а сградите — до 19 м: всяка сграда — в своя парцел (по осите му, 0,6 м от ръбовете, лицето към улицата),
  // по една на парцел и без застъпване с вече сложените (правоъгълниците, не само центровете); wasFit → { x, z, w — по улицата, d, ax, az — посоката на улицата } или null
  const WF = WAS && feature('was-fed'), WU = new Set(), RG = new Map(), rgk = (x, z) => Math.floor(x / 30) * 100003 + Math.floor(z / 30);
  const rov = (p, o) => { for (const [ex, ez] of [[p.ax, p.az], [-p.az, p.ax], [o.ax, o.az], [-o.az, o.ax]]) { const r = b => b.w / 2 * Math.abs(b.ax * ex + b.az * ez) + b.d / 2 * Math.abs(-b.az * ex + b.ax * ez); if (Math.abs((o.x - p.x) * ex + (o.z - p.z) * ez) >= r(p) + r(o) - 0.2) return false; } return true; };
  const wasFit = (x, z, ux, uz, sg, W0, D0) => { const L = lotAt(x, z); let f = { x, z, w: W0, d: D0, ax: ux, az: uz };
    if (L) { if (WU.has(L)) return null; const c = Math.cos(L.rot || 0), s = Math.sin(L.rot || 0), du = c * ux - s * uz, dv = s * ux + c * uz, al = Math.abs(du) >= Math.abs(dv), sa = (al ? du : dv) < 0 ? -1 : 1, ax = (al ? c : s) * sa, az = (al ? -s : c) * sa, ha = (al ? L.w : L.d) / 2, hb = (al ? L.d : L.w) / 2, w = Math.min(W0, 2 * ha - 1.2), d = Math.min(D0, 2 * hb - 1.2);
      if (w < 6 || d < 6) return null; const o = hb - 0.6 - d / 2;   /* лицето — 0,6 м от ръба към улицата */ f = { x: L.x + az * sg * o, z: L.z - ax * sg * o, w, d, ax, az }; }
    const i = Math.floor(f.x / 30), j = Math.floor(f.z / 30); for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) for (const o of RG.get(a * 100003 + b) || []) if (rov(f, o)) return null;
    const k = rgk(f.x, f.z); (RG.get(k) || RG.set(k, []).get(k)).push(f); if (L) WU.add(L); return f; };   // bg-variety: Париж/Истанбул — разнообразни; bg-fill: градовете по плана без карта (bgblocks.js)
  for (const rd of BG ? [] : ROADS) { if (rd.w > 14 || rd.station) continue; yield 0;   /* station-access: покрай пътя до гарата — без фасади */
    const T = rd.L[rd.L.length - 1];
    for (let e0 = 6 - STEP / 2, SW = STEP, s = 6; s < T - 6; e0 += SW, SW = VAR ? varW(rd.id, e0, STEP) : STEP, s = e0 + SW / 2) { let i = 1;   /* SW — ширината (bg-variety: по-тесни/по-широки) */ while (i < rd.L.length - 1 && rd.L[i] < s) i++; const a = rd.pts[i - 1], b = rd.pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, t = (s - rd.L[i - 1]) / ((rd.L[i] - rd.L[i - 1]) || 1), ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l;
      for (const sg of [1, -1]) for (const DEP of IST ? [DEP0, 8] : [DEP0]) { let off = rd.w / 2 + rd.walk + 0.4 + DEP / 2, x = a[0] + (b[0] - a[0]) * t - uz * off * sg, z = a[1] + (b[1] - a[1]) * t + ux * off * sg;   // Истанбул: ако не се побира — по-плитка (8 м)
        const k = Math.round(x / 6) * 100003 + Math.round(z / 6); if (used.has(k)) continue;
        let bad = false; for (const [dx, dz] of [[0, 0], [-uz * sg * DEP / 2, ux * sg * DEP / 2], [ux * SW / 2, uz * SW / 2], [-ux * SW / 2, -uz * SW / 2]]) { const px = x + dx, pz = z + dz; if (nearRoad(px, pz, rd.id) || wat(px, pz) || green(px, pz) || inLm(px, pz) || inAcc(px, pz)) { bad = true; break; } }
        if (bad || clash(x, z)) continue; let bw = SW, bd = DEP, fx = ux, fz = uz; if (WF) { const f = wasFit(x, z, ux, uz, sg, SW, DEP); if (!f) continue; ({ x, z, w: bw, d: bd, ax: fx, az: fz } = f); }   /* was-fed: в парцела */ used.add(k); mark(x, z);
        const h = ((rd.id * 7919 + Math.round(s) * 31 + (sg > 0 ? 17 : 0)) >>> 0) % 1000 / 1000, h2 = ((rd.id * 104729 + Math.round(s) * 13 + (sg > 0 ? 5 : 0)) >>> 0) % 1000 / 1000;
        // Истанбул: османски дървени къщи с еркери (историческият полуостров, Галата — европейският бряг) и бели жилищни блокове
        let ty = WAS ? (h2 < 0.3 ? 4 : 2) /* Вашингтон: федерални сгради от светъл камък (ограничението за височина — ниски) и тухлени къщи */ : LV ? 2 /* Лас Вегас: ниски бежови сгради с плосък покрив зад казината */ : MOS ? (h2 < 0.2 ? 4 : 6) : NY ? (h2 < 0.3 ? 5 : 2) : LON ? (x > 150 && h2 < 0.5 ? 2 : 4) /* Лондон: тухлени къщи; в Сити (на изток) — половината офиси */ : PAR ? 3 : !IST ? 0 : (x < 250 && h2 < 0.55) ? 1 : 2, H = ty === 1 ? 8 + h * 4 : ty === 6 ? 15 + h * 9 : ty === 5 ? (42 + h * h * 58) * 0.85 /* потребителят: сините кули −15 %; */ /* Ню Йорк: кулите 42–100 м — Емпайър Стейт (171 м в играта) стърчи като на снимките */ : ty === 4 && MOS ? 14 + h * 6 : ty === 2 ? (NY ? 18 + h * 24 : LON ? 22 + h * 16 : WAS ? 15 + h * 9 : LV ? 8 + h * 10 : 15 + h * 8) : ty === 4 ? 12 + h * 5 : ty === 3 ? 18 + h * 4 : (romeOuter(x, z) ? 15 + h * 9 : 13 + h * 7) /* Рим: центърът 13–20 м (4–6 ет.), външните рионе 15–24 м (до 7) */, col = ty === 1 ? OTTO[Math.floor(h * OTTO.length)] : ty === 6 ? MOSC[Math.floor(h * MOSC.length)] : ty === 4 && MOS ? MOSB[Math.floor(h * MOSB.length)] : ty === 5 ? GLASS[Math.floor(h * GLASS.length)] : ty === 2 ? (NY ? NYST : LON || WAS ? CITY : APT)[Math.floor(h * (NY ? NYST : LON || WAS ? CITY : APT).length)] : ty === 4 ? BRICK[Math.floor(h * BRICK.length)] : ty === 3 ? HAUSS[Math.floor(h * HAUSS.length)] : ROMA[Math.floor(h * ROMA.length)];   // Париж: османовите сгради — еднаква височина (~6 етажа)
        let rc = null, ex = null; if (VAR) ({ t: ty, H, col, rc, ex } = varPick(style, h, h2, MOS ? (romeOuter(x, z) ? 9 : 0) : ty));
        // osm-heights (T2, одитът): центърът — по-висок, по нивото на квартала (tier 1 — център); ~5 % акценти в центъра — неравна линия на покривите;
        // Париж и Вашингтон — без (истинските им ограничения за височина)
        if (OSMH && !PAR && !WAS) { const L0 = lotAt(x, z), tr = L0 ? (L0.tier || 1) : 3; H *= tr <= 1 ? 1.25 : tr === 2 ? 1.1 : tr >= 4 ? 0.85 : 1; if (tr <= 2 && h2 > 0.95) H *= 1.5; }
        const nyT = !!(NYT && NYT(x, z)); if (nyT) H = Math.min(250, H * (ty === 5 ? 2 : 1.6));   // 🗽 ny-tall   /* dc-msk-fac: Москва — външните райони (tier ≥ 3) панелни */   // bg-variety: вид, етажи, цвят, покрив (bgblocks.js)
        q.setFromAxisAngle(up, Math.atan2(fx, fz));
        list.push({ x, z, w: bw, d: bd, h: H, rot: Math.atan2(fz * sg, -fx * sg), t: ty, col, rc, ex, ...(NYT ? { nyTall: nyT } : {}), M: m.compose(new THREE.Vector3(x, H / 2, z), q, new THREE.Vector3(ty === 5 ? bd * 0.8 : bd, H, ty === 5 ? bw * 0.78 : bw + (WF ? 0 : 0.3))).clone(), lot: lotAt(x, z) }); break; } } }   // небостъргачите — по-тесни от стъпката: улички между кулите, не слепени
  if (BG) yield* bgPlace(P, list);   // bg-fill: по парцелите и във вътрешността на кварталите
  // по вид: фасада (текстура) + покрив (римски — на две води; османски — нисък, тъмна керемида; блоковете — плосък)
  const FM = [facadeMat(), ottoMat(), aptMat(), haussMat(), brickMat(), glassMat(), haussMat()], RF = [[roofGeo(), 0xa8553a, 0.3], [roofGeo(), 0x8d4a34, 0.22], [new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), 0xb9b6ae, 0], [mansardGeo(), 0x5e6872, 0.35], [roofGeo(), 0x4f555c, 0.16], [new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), 0x5d646b, 0], [roofGeo(), 0x5f7a66, 0.14]];   // Москва: нисък покрив от боядисана ламарина (зелено-сив)
  if (ROOFS) ROOFS.forEach((r, i) => { if (r && RF[i]) RF[i] = [r.flat ? new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0) : RF[i][0], r.col ?? RF[i][1], r.flat ? 0 : RF[i][2]]; });   // T2: tokyo-look / dubai-look / sg-look
  const parts = XK ? xParts(G, list, FM, RF) /* само видовете, които ги има */ : [0, 1, 2, 3, 4, 5, 6].map(t => { const n = Math.max(1, list.filter(b => b.t === t).length), box = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), FM[t], n), roof = new THREE.InstancedMesh(RF[t][0], new THREE.MeshStandardMaterial({ color: RF[t][1], roughness: 0.85, side: THREE.DoubleSide }), n);
    box.frustumCulled = roof.frustumCulled = false; box.receiveShadow = box.castShadow = true; box.count = roof.count = 0; roof.userData.roof = 1; G.add(box, roof); return { box, roof }; });   /* snow-roofs: userData.roof */
  const V = new THREE.Vector3(), Q = new THREE.Quaternion(), Sc = new THREE.Vector3(), C = new THREE.Color();
  let hidden = null, fl = () => true, fa = null; const HS = {};   // fire-ruins: скритите по ключ ('' — towers.js / romenear.js, 'ruins' — изгорелите), рисува се обединението
  // 🎰 lv-neon (T1): Лас Вегас нощем — неон по фоновите сгради: светещ контур по ръба на покрива, вертикална неонова лента на ъгъла
  // и светещ надпис-лента на фасадата (~2/3 от сградите), пет неонови цвята; денем — тъмни тънки ленти. Една InstancedMesh на цвят.
  const NE = LV && feature('lv-neon') ? (() => {
    const COLS = [0xff2bd6, 0x22e6ff, 0xffc21a, 0x8a3dff, 0x3dff7a], geo = new THREE.BoxGeometry(1, 1, 1), per = 8;
    const ims = COLS.map(c => { const m = new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.5, emissive: c, emissiveIntensity: 0, toneMapped: false }); m.userData.winK = 2.4; m.userData.flood = 1; WIN_MATS.push(m);
      const im = new THREE.InstancedMesh(geo, m, Math.max(1, list.length * per)); im.count = 0; im.frustumCulled = false; G.add(im); return im; });
    const L4 = new THREE.Matrix4(), O = new THREE.Matrix4(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), Q0 = new THREE.Quaternion();
    return () => { const n = COLS.map(() => 0);
      for (const b of list) { if ((b.lot && !fl(b.lot)) || (hidden && hidden.has(b)) || (fa && !fa(b))) continue;
        const hh = ((Math.round(b.x * 7) * 73856093) ^ (Math.round(b.z * 7) * 19349663)) >>> 0; if (hh % 3 === 0) continue;
        const ci = (hh >>> 3) % COLS.length, im = ims[ci], H = b.h, sx = b.M.elements, X = Math.hypot(sx[0], sx[1], sx[2]), Z = Math.hypot(sx[8], sx[9], sx[10]), t = 0.5;
        const put = (px, py, pz, kx, ky, kz) => { L4.compose(P3.set(px, py, pz), Q0, S3.set(kx, ky, kz)); im.setMatrixAt(n[ci]++, O.multiplyMatrices(b.M, L4)); };
        for (const sz of [-0.5, 0.5]) put(0, 0.5, sz, 1 + t / X, t / H, t / Z);   // контурът на покрива
        for (const sx2 of [-0.5, 0.5]) put(sx2, 0.5, 0, t / X, t / H, 1 + t / Z);
        if (hh % 5 < 3) for (const cz of [-0.5, 0.5]) put(0.5, 0, cz, 0.6 / X, 0.94, 0.6 / Z);   // вертикалните ленти на ъглите
        if (hh % 7 < 4 && H > 6) for (const fx2 of [-1, 1]) put(fx2 * (0.5 + 0.08 / X), 0.5 - 2.6 / H, 0, 0.16 / X, 2.2 / H, 0.75);   // надписът под покрива — на двете дълги фасади (локално ±x е към улицата и отзад)
      }
      ims.forEach((im, i) => { im.count = n[i]; im.instanceMatrix.needsUpdate = true; }); };
  })() : null;
  const XS = {}, draw = XK ? () => xDraw(G, list, parts, b => (b.lot && !fl(b.lot)) || !!(fa && !fa(b)) || (hidden && hidden.has(b)), XS) : () => { const n = [0, 0, 0, 0, 0, 0, 0];
    for (const b of list) { if ((b.lot && !fl(b.lot)) || (hidden && hidden.has(b)) || (fa && !fa(b))) continue; const t = b.t || 0, { box, roof } = parts[t], i = n[t]++;   /* fa — и тук (bg-room: OSM градовете без bg-variety) */
      box.setMatrixAt(i, b.M); box.setColorAt(i, C.setHex(b.col)); b.M.decompose(V, Q, Sc);
      roof.setMatrixAt(i, m.compose(V.set(V.x, V.y + Sc.y / 2, V.z), Q, t === 2 || t === 5 ? Sc.set(Sc.x * (t === 5 ? 0.8 : 1.02), t === 5 ? 3 : 0.6, Sc.z * (t === 5 ? 0.8 : 1.02)) : Sc.set(Sc.x, Math.min(4, Sc.x * RF[t][2]), Sc.z))); }
    parts.forEach(({ box, roof }, t) => { box.count = roof.count = n[t]; box.instanceMatrix.needsUpdate = roof.instanceMatrix.needsUpdate = true; if (box.instanceColor) box.instanceColor.needsUpdate = true; }); };
  return { list, fill(f, at) { fl = f; fa = at || null; draw(); if (NE) NE(); }, hide(set, key = '') { if (set && set.size) HS[key] = set; else delete HS[key]; const ks = Object.keys(HS); hidden = !ks.length ? null : ks.length === 1 ? HS[ks[0]] : new Set(ks.flatMap(k => [...HS[k]])); draw(); if (NE) NE(); }, shown: b => !((b.lot && !fl(b.lot)) || (fa && !fa(b)) || (HS.ruins && HS.ruins.has(b))) };   // shown — rome-bld: дали фасадата е там (без скритите)
}
// ---- свободните парцели: петно трева с пръст (по целия парцел), ниска дървена ограда отзад и отстрани, табела „ПРОДАВА СЕ“ отпред
// (лицето на парцела е локално +z — към улицата). Инстанции; set(fn) — кои парцели са свободни; near(on) — оградите/табелите само отблизо.
function freePlots(G, P) {
  const lots = P.lots.filter(L => !L.big && !L.lm), N = Math.max(1, lots.length);
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d', FCPU); g.fillStyle = '#7d9a55'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) { const x = Math.random() * 128, y = Math.random() * 128, r = 2 + Math.random() * 7; g.fillStyle = Math.random() < 0.35 ? 'rgba(122,98,66,0.55)' : `rgba(${90 + Math.random() * 40 | 0},${120 + Math.random() * 40 | 0},${60 + Math.random() * 20 | 0},0.5)`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  const gt = canvasTex(cv); gt.colorSpace = THREE.SRGBColorSpace; gt.wrapS = gt.wrapT = THREE.RepeatWrapping;
  const patch = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: gt, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }), N);
  const fence = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), M(0x8a7458), N * 3);
  const sc = document.createElement('canvas'); sc.width = 128; sc.height = 64; const s2 = sc.getContext('2d', FCPU); s2.fillStyle = '#f4f1ea'; s2.fillRect(0, 0, 128, 64); s2.fillStyle = '#c62828'; s2.fillRect(0, 0, 128, 18); s2.fillStyle = '#fff'; s2.font = 'bold 14px system-ui'; s2.textAlign = 'center'; s2.fillText(tr('ПРОДАВА СЕ'), 64, 14);
  s2.fillStyle = '#2b2b2b'; s2.font = 'bold 20px system-ui'; s2.fillText(tr('ПАРЦЕЛ'), 64, 44); s2.strokeStyle = '#c62828'; s2.lineWidth = 3; s2.strokeRect(1.5, 1.5, 125, 61);
  const st = canvasTex(sc); st.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshStandardMaterial({ map: st, roughness: 0.8, side: THREE.DoubleSide }), N), post = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 1.9, 0.1).translate(0, 0.95, 0), M(0x5a5048), N);
  for (const m of [patch, fence, board, post]) { m.count = 0; m.frustumCulled = false; G.add(m); } patch.receiveShadow = true; fence.castShadow = board.castShadow = true;
  const T = new THREE.Matrix4(), L4 = new THREE.Matrix4(), O = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), V = new THREE.Vector3(), S3 = new THREE.Vector3(), C = new THREE.Color();
  const at = (im, i, x, y, z, sx, sy, sz, ry = 0) => { L4.compose(V.set(x, y, z), q.setFromAxisAngle(up, ry), S3.set(sx, sy, sz)); im.setMatrixAt(i, O.multiplyMatrices(T, L4)); };
  return {
    set(fn) { let n = 0, nf = 0;
      for (const L of lots) { if (!fn(L)) continue; T.compose(V.set(L.x, 0, L.z), q.setFromAxisAngle(up, L.rot || 0), S3.set(1, 1, 1));
        const w = L.w - 0.6, d = L.d - 0.6, h = ((L.id * 2654435761) >>> 0) % 1000 / 1000;
        at(patch, n, 0, 0.05, 0, w, 1, d); patch.setColorAt(n, C.setHSL(0.24 + h * 0.05, 0.25, 0.8 + h * 0.15));
        at(fence, nf++, 0, 0, -d / 2, w, 0.7, 0.08); at(fence, nf++, -w / 2, 0, 0, 0.08, 0.7, d); at(fence, nf++, w / 2, 0, 0, 0.08, 0.7, d);   // отзад и отстрани (отпред — отворено към улицата)
        const sx = (h - 0.5) * w * 0.5; at(post, n, sx, 0, d / 2 - 0.6, 1, 1, 1); at(board, n, sx, 1.75, d / 2 - 0.62, 1, 1, 1);
        n++; }
      patch.count = board.count = post.count = n; fence.count = nf;
      for (const m of [patch, fence, board, post]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } },
    near(on) { fence.visible = board.visible = post.visible = on; },
  };
}
function inPoly2(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > p[1]) !== (zj > p[1]) && p[0] < (xj - xi) * (p[1] - zi) / (zj - zi) + xi) c = !c; } return c; }
const SIG_C = { red: [0xff2a20, 0x2a1210, 0x0f2010], yellow: [0x2a1210, 0xffc020, 0x0f2010], green: [0x2a1210, 0x2a2410, 0x30ff60] }, SC = new THREE.Color();
