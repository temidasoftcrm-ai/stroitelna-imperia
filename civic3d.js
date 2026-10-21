// civic3d.js — 3D на обществените държавни поръчки: училище, пожарна, полиция, кметство, съд, музей, опера, гара,
// мост, пречиствателна станция (GLB от Sketchfab, assets/heavy/civic) и процедурни: плувен комплекс, конгресен център,
// вятърен парк, соларен парк, язовирна стена. Същият интерфейс като tender3d.js: { group, setProg, update, dispose }.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const mat = (c, r = 0.8, m = 0, e) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...(e ? { emissive: e, emissiveIntensity: 0 } : {}) });
const box = (w, h, d, m, x, y, z, g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
const cyl = (r1, r2, h, m, x, y, z, g, seg = 12) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };

const glbs = {};
const loadGlb = url => glbs[url] || (glbs[url] = new Promise(res => new GLTFLoader().load(url, g => res(g.scene), undefined, () => res(null))));
// fit: каква част от парцела заема моделът (по по-дългата страна)
const GLB = {
  school: { url: 'assets/heavy/civic/school.glb', fit: 0.8 },
  fire: { url: 'assets/heavy/civic/fire.glb', fit: 0.6, lit: true },
  police: { url: 'assets/heavy/civic/police.glb', fit: 0.75, lit: true },
  cityhall: { url: 'assets/heavy/civic/cityhall.glb', fit: 0.6 },
  court: { url: 'assets/heavy/civic/court.glb', fit: 0.85 },
  museum: { url: 'assets/heavy/civic/museum.glb', fit: 0.8 },
  opera: { url: 'assets/heavy/civic/opera.glb', fit: 0.85 },
  station: { url: 'assets/heavy/station/big.glb', fit: 0.85 },
  bridge: { url: 'assets/heavy/civic/bridge.glb', fit: 1.0 },
  water: { url: 'assets/heavy/civic/water.glb', fit: 0.9 },
};
const GROUND = { bridge: 0x6fae4f, water: 0x9a9a90, wind: 0x7fb35a, solar: 0x7fb35a, dam: 0x7a8a5a, pool: 0xcfc8b8, congress: 0xcfc8b8, station: 0xcfc8b8 };

// строителна площадка: кал и жълто-черна ограда
function fencedDirt(g, W, D) {
  const hw = W / 2, hd = D / 2, f = new THREE.Group(); g.add(f);
  const dirt = box(W, 0.1, D, mat(0x7a5c3e, 1), 0, 0.05, 0, g), yel = mat(0xffc400, 0.6, 0, 0xffb000), blk = mat(0x1d1d1d, 0.8);
  for (const [w, d, x, z] of [[W, 0.15, 0, -hd + 0.1], [W, 0.15, 0, hd - 0.1], [0.15, D, -hw + 0.1, 0], [0.15, D, hw - 0.1, 0]]) {
    const len = Math.max(w, d), n = Math.max(5, Math.round(len / 2));
    for (let i = 0; i < n; i++) { const o = -len / 2 + (i + 0.5) * len / n; box(w > 1 ? len / n : 0.15, 1.4, d > 1 ? len / n : 0.15, i % 2 ? blk : yel, x + (w > 1 ? o : 0), 0.8, z + (d > 1 ? o : 0), f); }
  }
  return { show: v => { dirt.visible = f.visible = v; }, glow: k => { yel.emissiveIntensity = k; } };
}
function crane(g, h, x, z) {
  const c = new THREE.Group(); c.position.set(x, 0, z); g.add(c);
  const y = mat(0xf2b705, 0.6, 0.3); box(1.2, h, 1.2, y, 0, h / 2, 0, c);
  const jib = new THREE.Group(); jib.position.y = h; c.add(jib); box(22, 0.8, 0.8, y, -7, 0, 0, jib); box(2, 1.6, 1.6, mat(0x666666), 4, -0.4, 0, jib);
  return { c, jib };
}
function placeGlb(url, parent, side, alive, glass, lit) {
  loadGlb(url).then(src => {
    if (!src || !alive()) return;
    const o = src.clone(true);
    o.traverse(m => { if (!m.isMesh) return; m.castShadow = m.receiveShadow = true;
      const ms = Array.isArray(m.material) ? m.material : [m.material];
      for (const x of ms) { x.metalness = 0; x.metalnessMap = null; if (x.transparent && x.opacity > 0.9) { x.transparent = false; x.alphaTest = 0.5; x.depthWrite = true; } if (lit) x.color.multiplyScalar(1.8); x.needsUpdate = true; if (/glass|window|vetro|okno/i.test(x.name || '')) { const c = x.clone(); c.emissive = new THREE.Color(0xffd890); c.emissiveIntensity = 0; glass.push(c); m.material = c; } } });
    const bb = new THREE.Box3().setFromObject(o), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    const w = new THREE.Group(); w.add(o); o.position.set(-c.x, -bb.min.y, -c.z); w.scale.setScalar(side / Math.max(sz.x, sz.z)); parent.add(w);
  });
}

// ---- процедурните
function pool(b, W, D) {   // плувен комплекс: стъклена зала с извит покрив + открит басейн отпред
  const glassM = mat(0x9fc6dc, 0.15, 0.3, 0xffe2a8), water = mat(0x3fb0d8, 0.1, 0.2), white = mat(0xf2f2ee, 0.6);
  box(W * 0.7, 6, D * 0.45, glassM, 0, 3, -D * 0.18, b);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(D * 0.24, D * 0.24, W * 0.72, 20, 1, false, 0, Math.PI), white); roof.rotation.z = Math.PI / 2; roof.scale.set(1, 1, 0.35); roof.position.set(0, 6, -D * 0.18); roof.castShadow = true; b.add(roof);
  box(W * 0.5, 0.4, D * 0.22, white, 0, 0.2, D * 0.26, b); box(W * 0.46, 0.1, D * 0.18, water, 0, 0.42, D * 0.26, b);
  for (let k = 1; k < 6; k++) box(0.1, 0.05, D * 0.18, mat(0xffffff), -W * 0.23 + k * W * 0.46 / 6, 0.5, D * 0.26, b);
  return [glassM];
}
function congress(b, W, D) {   // конгресен център: ниска широка основа + стъклен куб + козирка
  const glassM = mat(0x5f8fb0, 0.15, 0.4, 0xffe2a8), stone = mat(0xe8e4da, 0.7), dark = mat(0x33373d, 0.5, 0.3);
  box(W * 0.8, 4, D * 0.6, stone, 0, 2, -D * 0.05, b); box(W * 0.5, 9, D * 0.35, glassM, -W * 0.08, 8.5, -D * 0.08, b);
  box(W * 0.56, 0.6, D * 0.41, dark, -W * 0.08, 13.3, -D * 0.08, b); box(W * 0.6, 0.5, 5, dark, 0, 4.5, D * 0.27, b);
  for (let k = 0; k < 6; k++) cyl(0.25, 0.25, 4.3, dark, -W * 0.27 + k * W * 0.108, 2.2, D * 0.27 + 2, b, 8);
  return [glassM];
}
function wind(b, W, D, rot) {   // вятърен парк: 6 турбини с въртящи се перки
  const white = mat(0xf4f4f2, 0.5);
  for (let i = 0; i < 6; i++) {
    const x = (i % 3 - 1) * W * 0.3, z = (Math.floor(i / 3) - 0.5) * D * 0.5 + (i % 2) * 2;
    cyl(0.35, 0.6, 22, white, x, 11, z, b); box(1, 1, 2.6, white, x, 22.3, z, b);
    const hub = new THREE.Group(); hub.position.set(x, 22.3, z + 1.4); b.add(hub); rot.push(hub);
    for (let k = 0; k < 3; k++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9, 0.15), white); bl.geometry.translate(0, 4.5, 0); bl.rotation.z = k * Math.PI * 2 / 3; bl.castShadow = true; hub.add(bl); }
  }
  return [];
}
function solar(b, W, D) {   // соларен парк: редове наклонени панели и малка подстанция
  const panel = mat(0x1d2f5a, 0.25, 0.6), frame = mat(0x9aa0a6, 0.5, 0.5);
  for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) {
    const x = -W * 0.36 + c * W * 0.2 + W * 0.04, z = -D * 0.38 + r * D * 0.13;
    const p = box(W * 0.17, 0.12, 2.6, panel, x, 1.4, z, b); p.rotation.x = -0.45; box(0.2, 1.2, 0.2, frame, x, 0.6, z, b);
  }
  box(4, 3, 3, mat(0xd8d4c8, 0.7), W * 0.38, 1.5, D * 0.4, b);
  return [];
}
function dam(b, W, D) {   // язовирна стена: извита бетонна стена, водата зад нея, преливник отпред
  const concrete = mat(0xb8b4aa, 0.9), water = mat(0x2f6f9a, 0.1, 0.3), road = mat(0x3d4247, 0.9);
  box(W * 0.96, 0.6, D * 0.45, water, 0, 5.5, -D * 0.25, b);
  for (let k = -5; k <= 5; k++) { const a = k / 5 * 0.35, R = W * 0.9, s = box(W * 0.1, 9, 3, concrete, Math.sin(a) * R, 4.5, Math.cos(a) * R - R + 1, b); s.rotation.y = a; }
  box(W * 0.96, 0.3, 2, road, 0, 9.2, 0.3, b);
  box(4, 0.2, D * 0.4, mat(0x5aa0c8, 0.1, 0.2), 0, 0.3, D * 0.22, b);
  return [];
}
const PROC = { pool, congress, wind, solar, dam };

// opts: { x, z, scale, prog, sign, ext: [W, D], kind }
export function buildCivic(group, deps, opts = {}) {
  const kind = opts.kind, [W, D] = opts.ext || [26, 26];
  const g = new THREE.Group(); g.position.set(opts.x || 0, 0, opts.z || 0); g.scale.setScalar(opts.scale || 1); group.add(g);
  const site = fencedDirt(g, W, D), done = new THREE.Group(); g.add(done);
  box(W, 0.1, D, mat(GROUND[kind] || 0x6fae4f, 0.95), 0, 0.05, 0, done);
  if (kind === 'bridge') { box(W * 0.4, 0.12, D, mat(0x3f7fa8, 0.15, 0.3), 0, 0.1, 0, done); for (const s of [-1, 1]) box(0.6, 0.6, D, mat(0x8a7f70, 0.95), s * W * 0.2, 0.3, 0, done); }
  if (!PROC[kind]) for (const [x, z] of [[-W / 2 + 2, D / 2 - 2], [W / 2 - 2, D / 2 - 2], [-W / 2 + 2, -D / 2 + 2], [W / 2 - 2, -D / 2 + 2]]) {
    if (kind === 'bridge') continue;
    cyl(0.22, 0.28, 1.6, mat(0x6b4a2b), x, 0.8, z, done, 6); const c = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8), mat(0x3f8f3a)); c.position.set(x, 2.6, z); c.castShadow = true; done.add(c);
  }
  const body = new THREE.Group(); g.add(body);
  const glass = [], rot = [];
  let alive = true;
  if (GLB[kind]) placeGlb(GLB[kind].url, body, (kind === 'bridge' ? Math.max(W, D) : Math.min(W, D)) * GLB[kind].fit, () => alive, glass, GLB[kind].lit);
  else if (PROC[kind]) glass.push(...PROC[kind](body, W, D, rot));
  const sign = deps.label ? deps.label(opts.sign || '🏛️', '#ffe9a8', 16) : null;
  if (sign) { sign.position.set(0, 18, 0); g.add(sign); }
  const kit = crane(g, 20, W / 2 - 3, -D / 2 + 3);
  const scaf = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, 10, D * 0.6, 6, 4, 6), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, wireframe: true })); g.add(scaf);
  let prog = -1;
  for (const h of rot) h.userData.keep = true;   // перките се въртят — не се сливат
  g.userData.mergeWhen = () => prog >= 1 && (!GLB[kind] || body.children.length > 0);   // ⚡ perf-cliff (citycull.js): готовата сграда е статична — сливане по материал
  function setProg(p) {
    p = Math.max(0, Math.min(1, p)); if (p === prog) return; prog = p;
    const k = Math.max(0, Math.min(1, (p - 0.1) / 0.85)); body.visible = k > 0; body.scale.y = Math.max(0.001, k);
    kit.c.visible = scaf.visible = p < 1; scaf.scale.y = Math.max(0.05, Math.min(1, p * 1.15)); scaf.position.y = 5 * scaf.scale.y;
    if (sign) sign.visible = p >= 1;
    done.visible = p >= 1; site.show(p < 1);
  }
  function update(t, night = 0) {
    site.glow(0.05 + 0.5 * night);
    for (const m of glass) m.emissiveIntensity = prog >= 1 ? 0.05 + 0.8 * night : 0;
    if (prog >= 1) for (const h of rot) h.rotation.z = t * 1.2;
    if (prog < 1) kit.jib.rotation.y = Math.sin(t * 0.25) * 1.2;
  }
  setProg(opts.prog ?? 0);
  return { group: g, setProg, update, dispose: () => { alive = false; group.remove(g); } };
}
export const CIVIC_KINDS = new Set([...Object.keys(GLB), ...Object.keys(PROC)]);
