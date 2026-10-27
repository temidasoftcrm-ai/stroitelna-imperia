// 📦 whmats.js (флаг wh-mats, т. 34): дворът на склада — да личи кой материал е кой.
// Три варианта (localStorage 'whMatsMode'): 'icons' — старите купчини + иконка с количество/процент над всяка; 'models' — истински 3D модели
// (палети тухли, бигбег/чували цимент, дъски, стоманени греди + арматура, пясък/чакъл, стъкла на стойка, кашони мебели, мраморни плочи);
// 'both' (по подразбиране) — моделите + иконката, само когато камерата е близо. Броят/височината следят наличността. 1 единица = 1 м.
// Моделите (CC-BY, assets/heavy/CREDITS.txt): assets/heavy/whmat/mat-*.glb; стъклата, мраморът и арматурата — процедурни.
import * as THREE from 'three';
import { canvasTex } from './texdata.js';   // fac-data (T1): статичните платна → собствени данни (не се губят)
import { pickPart } from './blkcut.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const WHM_ICO = { bricks: '🧱', wood: '🪵', steel: '⚙️', gravel: '🪨', sand: '🏖️', concrete: '🧊', glass: '🪟', furniture: '🪑', marble: '💎' };
export const whMatsMode = () => { try { const m = localStorage.getItem('whMatsMode'); return m === 'icons' || m === 'models' ? m : 'both'; } catch (e) { return 'both'; } };
const P = {};   // готовите прототипи: основа y=0, център x,z=0, в метри

// мащаб с един коефициент (никога по оси): най-дългата хоризонтална страна → L (по x), после да се побере в maxZ
function fit(root, L, maxZ = 1e9, alongX = true) {
  const g = new THREE.Group(), o = root; g.add(o); g.updateMatrixWorld(true);
  let b = new THREE.Box3().setFromObject(g), s = b.getSize(new THREE.Vector3());
  if (alongX && s.z > s.x) { o.rotation.y += Math.PI / 2; g.updateMatrixWorld(true); b = new THREE.Box3().setFromObject(g); s = b.getSize(new THREE.Vector3()); }
  const k = Math.min(L / s.x, maxZ / s.z); g.scale.setScalar(k); g.updateMatrixWorld(true); b = new THREE.Box3().setFromObject(g);
  const w = new THREE.Group(); g.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); w.add(g);
  w.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; if (m.material && m.material.metalness > 0.2) { m.material = m.material.clone(); m.material.metalness = 0.1; } } });   // без отражения металните материали са черни
  w.userData.size = b.getSize(new THREE.Vector3()); return w;
}
// EXT_mesh_gpu_instancing (тухлите в пакета) → обикновен меш с всички копия, иначе pickPart вижда само едното
function unInstance(root) {
  const list = []; root.traverse(m => { if (m.isInstancedMesh) list.push(m); });
  for (const im of list) {
    const g0 = new THREE.BufferGeometry(); for (const [nm, A] of Object.entries(im.geometry.attributes)) { const a = new Float32Array(A.count * A.itemSize); for (let i = 0; i < A.count; i++) for (let j = 0; j < A.itemSize; j++) a[i * A.itemSize + j] = j === 0 ? A.getX(i) : j === 1 ? A.getY(i) : j === 2 ? A.getZ(i) : A.getW(i); g0.setAttribute(nm, new THREE.BufferAttribute(a, A.itemSize)); }
    if (im.geometry.index) g0.setIndex(im.geometry.index.clone());
    const M4 = new THREE.Matrix4(), parts = []; for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, M4); parts.push(g0.clone().applyMatrix4(M4)); }
    const m = new THREE.Mesh(mergeGeometries(parts) || g0, im.material); m.name = im.name; m.position.copy(im.position); m.quaternion.copy(im.quaternion); m.scale.copy(im.scale);
    im.parent.add(m); im.removeFromParent();
  }
  return root;
}
const tint = (root, hex) => { root.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.setHex(hex); } }); return root; };

export function whMatsLoad(load) {
  const one = (n, f) => load(`assets/heavy/whmat/mat-${n}.glb`).then(g => { try { f(g.scene); } catch (e) { console.warn('whmats', n, e); } }).catch(() => {});
  return Promise.all([
    one('bricks', s => { P.bricks = fit(pickPart(unInstance(s), -430, -249, -170, 20), 1.2, 1.0); }),   // само палетът с червените тухли (вляво в пакета)
    one('cement', s => { P.concrete = fit(s, 1.2, 1.0); }),   // чували цимент на палет 1,2×1,0
    one('wood', s => { P.wood = fit(s, 3.0, 1.6); }),   // връзка дъски ~3 м
    one('steel', s => { P.steel = fit(s, 6.0); P.steel.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.metalness = 0.35; m.material.roughness = 0.55; m.material.color.setHex(0x9aa3ad); } }); }),   // без отражения металът е черен   // I-греда 6 м
    one('sand', s => { P.sand = fit(s, 2.2); P.gravel = tint(fit(s.clone(true), 2.2), 0x8d8f92); tint(P.sand, 0xf0dcae); }),
    one('box', s => { P.box = fit(s, 1.0); }),   // кашон с мебели ~1,0×0,8 м
  ]);
}

export const whMatsInfo = () => Object.fromEntries(Object.entries(P).map(([k, v]) => [k, v.userData.size.toArray().map(x => +x.toFixed(2))]));   // тест: размерите в метри
// процедурни: стъкла на А-стойка, мраморни плочи на греди, арматура на връзки
const M = {};
const mat = (k, f) => M[k] || (M[k] = f());
const box = (w, h, d, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.castShadow = o.receiveShadow = true; return o; };
let marbleTex = null;
function marbleMap() {
  if (marbleTex) return marbleTex;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#f1efea'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(120,120,130,.45)';
  for (let i = 0; i < 9; i++) { g.lineWidth = 0.6 + (i % 3); g.beginPath(); let x = (i * 53) % 256, y = 0; g.moveTo(x, y); while (y < 256) { x += Math.sin(y * 0.05 + i) * 9 + 4; y += 16; g.lineTo(x % 256, y); } g.stroke(); }
  marbleTex = canvasTex(c); marbleTex.colorSpace = THREE.SRGBColorSpace; return marbleTex;
}
function glassRack(n) {
  const g = new THREE.Group(), steel = mat('rack', () => new THREE.MeshStandardMaterial({ color: 0x3a4a5c, roughness: 0.6, metalness: 0.5 })),
    gl = mat('glass', () => new THREE.MeshStandardMaterial({ color: 0x9fd6d2, roughness: 0.08, metalness: 0.25, transparent: true, opacity: 0.4 })),
    L = 2.4, H = 1.9, A = 0.17;   // А-стойка 2,4 м, наклон ~10°
  g.add(box(L, 0.12, 1.1, steel).translateY(0.06));
  for (const s of [-1, 1]) for (const x of [-L / 2 + 0.1, 0, L / 2 - 0.1]) { const p = box(0.06, H, 0.06, steel); p.position.set(x, H / 2 + 0.1, s * 0.12); p.rotation.x = s * A; g.add(p); }
  g.add(box(L, 0.06, 0.06, steel).translateY(H + 0.08));
  const per = Math.max(1, n * 2);   // стъкла от всяка страна
  for (const s of [-1, 1]) for (let i = 0; i < per; i++) { const p = box(L - 0.15, 1.7, 0.012, gl); const d = 0.2 + i * 0.035; p.position.set(0, 0.97, s * (d + 0.08)); p.rotation.x = s * A; p.castShadow = false; g.add(p); }
  return g;
}
function marbleStack(n) {
  const g = new THREE.Group(), tim = mat('timber', () => new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.9 })),
    mm = mat('marble', () => new THREE.MeshStandardMaterial({ map: marbleMap(), roughness: 0.25, metalness: 0.05 })), cnt = n * 4;   // плочи 1,8×1,1×4 см
  for (const z of [-0.35, 0.35]) g.add(box(1.8, 0.1, 0.1, tim).translateY(0.05).translateZ(z));
  for (let i = 0; i < cnt; i++) g.add(box(1.8, 0.04, 1.1, mm).translateY(0.12 + i * 0.045));
  return g;
}
function steelPile(n) {
  const g = new THREE.Group(), rb = mat('rebar', () => new THREE.MeshStandardMaterial({ color: 0x7a4b32, roughness: 0.8, metalness: 0.4 }));
  if (P.steel) { const sz = P.steel.userData.size, w = Math.max(sz.z, 0.25);   // n реда по 3 греди
    for (let i = 0; i < n * 2; i++) { const b = P.steel.clone(true); b.position.set(0, Math.floor(i / 4) * sz.y, -0.85 + (i % 4) * (w + 0.05)); g.add(b); } }   // 2 греди на всяка четвърт, по 4 на ред
  const bars = mat('rebarG', () => new THREE.CylinderGeometry(0.014, 0.014, 6, 5).rotateZ(Math.PI / 2));
  for (let k = 0; k < n; k++) for (let i = 0; i < 12; i++) { const c = new THREE.Mesh(bars, rb); c.position.set(0, 0.02 + (i % 3) * 0.028 + Math.floor(k / 2) * 0.09, 1.0 + Math.floor(i / 3) * 0.03 + (k % 2) * 0.15); c.castShadow = true; g.add(c); }   // арматура ø14, връзки по 12 пръта
  return g;
}
// стари кубове (за 'icons' и когато моделът не се е заредил)
const cubes = (n, col) => { const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: col ?? 0xcccccc, roughness: 0.9 }); for (let j = 0; j < n; j++) g.add(box(1.3, 0.8, 1.3, m).translateY(0.4 + j * 0.82)); return g; };
const pallets = (pr, n, cols = 2) => { const g = new THREE.Group(), s = pr.userData.size; for (let i = 0; i < n; i++) { const o = pr.clone(true); o.position.set((i % cols - (Math.min(n, cols) - 1) / 2) * (s.x + 0.08), Math.floor(i / cols) * s.y, 0); g.add(o); } return g; };
function pileFor(m, n, f, col) {
  if (m === 'bricks' && P.bricks) return pallets(P.bricks, n);
  if (m === 'concrete' && P.concrete) return pallets(P.concrete, n);
  if (m === 'wood' && P.wood) return pallets(P.wood, n, 1);
  if (m === 'furniture' && P.box) { const g = new THREE.Group(), s = P.box.userData.size; for (let i = 0; i < n * 2; i++) { const o = P.box.clone(true); o.position.set((i % 2 - 0.5) * (s.x + 0.05), Math.floor(i / 4) * s.y, (Math.floor(i / 2) % 2 - 0.5) * (s.z + 0.05)); g.add(o); } return g; }
  if (m === 'sand' || m === 'gravel') { const pr = P[m]; if (!pr) return cubes(n, col); const o = pr.clone(true); o.scale.setScalar(0.5 + 0.5 * f); return o; }   // купчината расте (един мащаб)
  if (m === 'steel') return steelPile(n);
  if (m === 'glass') return glassRack(n);
  if (m === 'marble') return marbleStack(n);
  return cubes(n, col);
}
// местата в двора (локално за city.whYard: отзад е складът при z ≈ −1,4, отпред тротоарът при z ≈ 3,7)
export const SLOT = { bricks: [-5.9, -0.15], concrete: [-3.2, -0.15], wood: [0, -0.15], furniture: [3.1, -0.15], marble: [5.9, -0.15],
  steel: [-4.2, 2.45], glass: [0.35, 2.45], sand: [3.1, 2.45], gravel: [5.9, 2.45] };

// иконката: емоджи + процент + количество, с лента на запълването
function iconSprite(m, q, f, unit) {
  const c = document.createElement('canvas'); c.width = 192; c.height = 224; const g = c.getContext('2d');
  g.fillStyle = 'rgba(15,20,28,.86)'; g.beginPath(); g.roundRect(4, 4, 184, 216, 26); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '84px system-ui, "Noto Color Emoji", sans-serif'; g.fillText(WHM_ICO[m] || '📦', 96, 62);
  g.fillStyle = '#fff'; g.font = 'bold 50px system-ui, sans-serif'; g.fillText(`${Math.round(f * 100)}%`, 96, 140, 176);
  g.fillStyle = '#c9d3dd'; g.font = '28px system-ui, sans-serif'; g.fillText(`${Math.round(q * 10) / 10} ${unit || ''}`, 96, 180, 176);
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(22, 198, 148, 10); g.fillStyle = f > 0.66 ? '#5fd17a' : f > 0.25 ? '#f2c94c' : '#eb5757'; g.fillRect(22, 198, 148 * Math.min(1, f), 10);
  const t = canvasTex(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, fog: false, transparent: true })); s.renderOrder = 11; return s;
}
const _w = new THREE.Vector3(), _s = new THREE.Vector3();
// размерът следи разстоянието (чете се от нормалната камера); 4 етажа (предният ред долу, задният горе, съседите — през един), за да не се застъпват
// в 'both' — само отблизо (избледнява между 45 и 60 м)
function iconFade(s, near, base, tier, ln) {
  s.onBeforeRender = (r, sc, cam) => {
    s.getWorldPosition(_w); const d = cam.position.distanceTo(_w); s.parent.getWorldScale(_s);
    const W = Math.min(4.6, Math.max(1.5, d * 0.05)) / _s.x, H = W * 224 / 192; s.scale.set(W, H, 1); s.position.y = base + H / 2 + tier * H * 1.06;
    s.material.opacity = near ? THREE.MathUtils.clamp((60 - d) / 15, 0, 1) : THREE.MathUtils.clamp((360 - d) / 60, 0, 1);
    if (ln) { ln.geometry.attributes.position.setY(1, s.position.y - H / 2); ln.geometry.attributes.position.needsUpdate = true; ln.material.opacity = s.material.opacity * 0.8; }   // чертичката от купчината до иконката
  };
}

// дворът: items = [{ m, q, cap, unit, col }]
// подредба в зададена площ [ширина, дълбочина]: редове отзад напред; ако не се побира — целият двор се смалява (един мащаб, до 0,5)
const FOOT = { steel: [6.0, 2.2], glass: [2.4, 1.1], sand: [2.2, 2.2], gravel: [2.2, 2.2], bricks: [2.1, 1.0], concrete: [2.2, 1.0], wood: [2.3, 1.6], furniture: [1.9, 1.8], marble: [1.8, 1.1] };
function areaLayout(w, d) {
  const ids = Object.keys(FOOT); let best = null;
  for (let k = 1; k >= 0.5 && !best; k -= 0.05) { const W = w / k, D = d / k, rows = [[]]; let x = 0;
    for (const m of ids) { const fw = FOOT[m][0]; if (x + fw > W && rows[rows.length - 1].length) { rows.push([]); x = 0; } rows[rows.length - 1].push(m); x += fw + 0.35; }
    const dep = rows.map(r => Math.max(...r.map(m => FOOT[m][1]))), tot = dep.reduce((a, b) => a + b, 0) + 0.3 * (rows.length - 1);
    if ((tot <= D && rows.every(r => r.reduce((a, m) => a + FOOT[m][0] + 0.35, -0.35) <= W)) || k < 0.53) best = { k, rows, dep, tot }; }
  const S2 = {}; let z = -best.tot / 2;
  best.rows.forEach((r, ri) => { let x = -r.reduce((a, m) => a + FOOT[m][0] + 0.35, -0.35) / 2; z += best.dep[ri] / 2;
    r.forEach((m, j) => { S2[m] = [x + FOOT[m][0] / 2, z, (best.rows.length - 1 - ri) * 2 + j % 2]; x += FOOT[m][0] + 0.35; }); z += best.dep[ri] / 2 + 0.3; });
  return { k: best.k, slot: S2 };
}
export function whMatsYard(y, items, mode = whMatsMode()) {
  for (const t of y.userData.whmTex || []) { t.map && t.map.dispose(); t.dispose(); }
  y.userData.whmTex = [];
  while (y.children.length) y.remove(y.children[0]);
  const ar = y.userData.area, L = ar ? areaLayout(ar[0], ar[1]) : null; y.scale.setScalar(L ? L.k : 1);   // campus2: площта на ивицата пред склада
  const ic = []; let top = 0, ti = 0;
  for (const it of items) {
    const f = Math.min(1, it.q / Math.max(1, it.cap)), n = Math.ceil(f * 4), sl = (L ? L.slot : SLOT)[it.m] || [0, 0];
    if (n > 0) { const p = mode === 'icons' ? cubes(n, it.col) : pileFor(it.m, n, f, it.col); p.updateMatrixWorld(true); ti = new THREE.Box3().setFromObject(p).max.y; top = Math.max(top, ti); p.position.set(sl[0], 0, sl[1]); y.add(p); }   // връх — преди да влезе в двора (локално)
    else ti = 0;
    if (mode !== 'models') ic.push([it, f, sl, ti]);
  }
  const rows = {}; ic.sort((a, b) => a[2][0] - b[2][0]);
  for (const [it, f, sl, t0] of ic) { const back = sl[1] < 1, k = rows[back] = (rows[back] ?? -1) + 1, tier = sl.length > 2 ? sl[2] : (back ? 2 : 0) + k % 2;
    const s = iconSprite(it.m, it.q, f, it.unit); s.position.set(sl[0], top + 0.8, sl[1]); s.scale.set(1.5, 1.75, 1);
    const lg = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([sl[0], t0 + 0.05, sl[1], sl[0], top + 0.8, sl[1]], 3)), ln = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, fog: false }));
    ln.renderOrder = 10; ln.frustumCulled = false; y.add(ln); y.userData.whmTex.push(lg, ln.material);
    iconFade(s, mode === 'both', top + 0.8, tier, ln); y.add(s); y.userData.whmTex.push(s.material); }
}
