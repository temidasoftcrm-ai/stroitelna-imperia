// rivers.js — 🌊 bg-rivers (T2, дизайнерът: „Видин без Дунав, Пловдив без Марица“): изгледът на реката от плана v2 (cityplan2.js → P.river: точки, полуширина)
// в рамката на плана (детето на planView): вода, каменни кейови стени, крайбрежна алея с фенери; мостовете са пътищата над водата (cityplan2.js ги прави сам).
//   game.js: pv.add(riversView(P.p2, () => dayNight.night)) — само в новите игри (S.rivers) с флага.
import * as THREE from 'three';
import { FCPU } from './cityplan2-3d.js';   // fac-cpu (T1): платната — в паметта на процесора (иначе под натоварване стават черни)

const WATER = new THREE.MeshStandardMaterial({ color: 0x3f6a78, roughness: 0.12, metalness: 0.3 });
const STONE = new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.85 });
const PROM = new THREE.MeshStandardMaterial({ color: 0xc9c2b2, roughness: 0.9 });
const GRASS = new THREE.MeshStandardMaterial({ color: 0x6f9a55, roughness: 1 });
const WY = 0.05, TOP = 0.42;

function offset(P, d) { const out = []; for (let i = 0; i < P.length; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; out.push([P[i][0] - dz / l * d, P[i][1] + dx / l * d]); } return out; }
function ribbon(A, B, y) { const pos = [], idx = []; A.forEach((p, i) => { const q = B[i]; pos.push(p[0], y, p[1], q[0], y, q[1]); if (i) { const k = 2 * i; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; }
function wall(P, y0, y1) { const pos = [], idx = []; P.forEach((p, i) => { pos.push(p[0], y0, p[1], p[0], y1, p[1]); if (i) { const k = 2 * i; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; }
const dbl = m => { const c = m.clone(); c.side = THREE.DoubleSide; return c; };

// P — планът v2 (P.river, P.waterAt за бреговете отвъд — Дунав: отсрещният бряг е ливада); night() → 0…1
export function riversView(P, night = () => 0) {
  const RV = P.river, G = new THREE.Group(); G.name = 'river'; if (!RV) return G;
  const pts = RV.pts, hw = RV.hw, far = !RV.quays || !RV.quays.length;   // far — реката по края на града (Дунав): отсреща — само бряг с ливада
  G.add(new THREE.Mesh(ribbon(offset(pts, -hw), offset(pts, hw), WY), dbl(WATER)));
  const lamps = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xffd9a0, emissiveIntensity: 0 }); lamps.onBeforeRender = () => { lamps.emissiveIntensity = 1.8 * night(); };
  const post = new THREE.CylinderGeometry(0.08, 0.1, 3.6, 6).translate(0, 1.8, 0), bulb = new THREE.SphereGeometry(0.28, 8, 6).translate(0, 3.7, 0), dark = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.6 });
  for (const side of [-1, 1]) {
    const edge = offset(pts, side * hw), prom = offset(pts, side * (hw + 5));
    G.add(new THREE.Mesh(wall(edge, WY - 0.3, TOP), dbl(STONE)));   // кейовата стена
    if (far && side < 0) { G.add(new THREE.Mesh(ribbon(edge, offset(pts, side * (hw + 60)), TOP - 0.02), dbl(GRASS))); continue; }   // отсрещният бряг на Дунава — ливада
    G.add(new THREE.Mesh(ribbon(edge, prom, TOP), dbl(PROM)));   // крайбрежната алея
    for (let i = 2; i < prom.length - 1; i += 3) { const p = offset(pts, side * (hw + 1))[i]; if (P.waterAt && P.waterAt(p[0] + (prom[i][0] - p[0]) * 3, p[1] + (prom[i][1] - p[1]) * 3) && !far) continue;
      const a = new THREE.Mesh(post, dark), b = new THREE.Mesh(bulb, lamps); a.position.set(p[0], TOP, p[1]); b.position.copy(a.position); G.add(a, b); }
  }
  G.traverse(m => { if (m.isMesh) m.receiveShadow = true; });
  return G;
}

// 🏰 Баба Вида (Видин) — процедурна средновековна крепост на брега на Дунава: квадратен двор със зъбери, 4 ъглови кули + 2 по-високи,
// ров отпред; нощем топли прожектори отдолу (mats → emissive). size — страната на крепостта (м). Връща { group, update(t, night) }
// грубата каменна зидария (платно): квадри с различен тон и фуги; повтаря се на ~2,4 м (UV в метри — mUV)
let STONE_T = null;
function stoneTex() {
  if (STONE_T) return STONE_T; const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d', FCPU); let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#6f675c'; g.fillRect(0, 0, 256, 256);   // фугите
  for (let y = 0, r = 0; y < 256; r++) { const h = 22 + rnd() * 18; let x = -rnd() * 40; while (x < 256) { const w = 34 + rnd() * 42, v = 150 + rnd() * 55, t = rnd() * 14; g.fillStyle = `rgb(${v + t},${v - 4},${v - 18 - t})`; g.fillRect(x + 2, y + 2, w - 4, h - 4);
    for (let k = 0; k < 14; k++) { const q = v - 30 + rnd() * 50; g.fillStyle = `rgba(${q},${q - 6},${q - 16},0.35)`; g.fillRect(x + 2 + rnd() * (w - 8), y + 2 + rnd() * (h - 8), 3 + rnd() * 6, 2 + rnd() * 4); } x += w; } y += h; }
  STONE_T = new THREE.CanvasTexture(c); STONE_T.colorSpace = THREE.SRGBColorSpace; STONE_T.wrapS = STONE_T.wrapT = THREE.RepeatWrapping; STONE_T.anisotropy = 4; return STONE_T;
}
// UV на кутията в метри (текстурата се повтаря на rep м) + цвят по височината: по-тъмно и мъхово отдолу (влага), светло горе
function mUV(geo, w, h, d, y0, rep = 2.4) { const uv = geo.attributes.uv, n = geo.attributes.normal, p = geo.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < uv.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), fu = ax > 0.5 ? d : w, fv = ay > 0.5 ? d : h; uv.setXY(i, uv.getX(i) * fu / rep, uv.getY(i) * fv / rep);
    const y = y0 + p.getY(i), k = Math.min(1, 0.62 + y / 14); col.set([k, k * 0.98, k * 0.94], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); return geo; }
export function babaVida(size = 34) {
  const g = new THREE.Group(), stone = new THREE.MeshStandardMaterial({ map: stoneTex(), vertexColors: true, roughness: 0.97, emissive: 0xffb36a, emissiveIntensity: 0 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x7a3f2c, roughness: 0.8 }), H = size * 0.32, s = size / 2, t = size * 0.08;
  const box = (w, h, d, x, y, z, m = stone) => { const o = new THREE.Mesh(mUV(new THREE.BoxGeometry(w, h, d), w, h, d, y), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  for (const [w, d, x, z] of [[size, t, 0, -s], [size, t, 0, s], [t, size, -s, 0], [t, size, s, 0]]) {   // стените и зъберите
    box(w, H, d, x, H / 2, z); const n = Math.round(Math.max(w, d) / (t * 1.6)); for (let k = 0; k < n; k++) { const f = (k + 0.5) / n - 0.5; box(w > d ? t * 0.8 : t, t * 0.9, w > d ? t : t * 0.8, x + (w > d ? f * w : 0), H + t * 0.45, z + (w > d ? 0 : f * d)); } }
  for (const [x, z, k] of [[-s, -s, 1.3], [s, -s, 1], [-s, s, 1], [s, s, 1.45], [0, -s, 1.15], [-s * 0.15, s * 0.1, 1.7]]) {   // кулите (последната — донжонът в двора)
    const w = size * 0.2, h = H * k * 1.25; box(w, h, w, x, h / 2, z);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.75, w * 0.8, 4), roof); cap.rotation.y = Math.PI / 4; cap.position.set(x, h + w * 0.4, z); cap.castShadow = true; g.add(cap); }
  return { group: g, kind: 'babavida', update(_, night = 0) { stone.emissiveIntensity = 0.32 * night; } };
}

// ⛰️ тепетата (Пловдив) — скалист хълм с горички: неправилна „шапка“ от икосаедър (сплескан), скали и зелени петна по цвета на върховете; r — радиус, h — височина
export function rockyHill(r, h, seed = 1) {
  const g = new THREE.Group(); let s = seed * 9301 + 49297; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const geo = new THREE.IcosahedronGeometry(1, 3), P = geo.attributes.position, col = new Float32Array(P.count * 3), v = new THREE.Vector3(), rock = new THREE.Color(0x8a8070), grn = new THREE.Color(0x5f7f45), c = new THREE.Color();
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); const n = 0.82 + 0.3 * Math.sin(v.x * 5.1 + seed) * Math.cos(v.z * 4.3 + seed * 2) + 0.12 * rnd(); v.y = Math.max(0, v.y); v.set(v.x * r * n, v.y * h * (0.85 + 0.25 * n), v.z * r * n); P.setXYZ(i, v.x, v.y, v.z);
    c.copy(rock).lerp(grn, Math.max(0, Math.min(1, 0.65 - v.y / h * 0.9 + 0.3 * Math.sin(v.x * 0.3 + v.z * 0.2)))); col.set([c.r, c.g, c.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })); m.castShadow = m.receiveShadow = true; g.add(m);
  g.userData.top = h * 0.95; return g;
}

// 🕰️ Часовниковата кула на Сахат тепе — каменна кула с дървен покрив и циферблати (светят нощем)
export function clockTower(h = 9) {
  const g = new THREE.Group(), st = new THREE.MeshStandardMaterial({ color: 0xc9b896, roughness: 0.95 }), wd = new THREE.MeshStandardMaterial({ color: 0x5a3a28, roughness: 0.8 }), face = new THREE.MeshStandardMaterial({ color: 0xf2ead8, emissive: 0xfff1c8, emissiveIntensity: 0 });
  const w = h * 0.28, b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), st); b.position.y = h / 2; g.add(b);
  const top = new THREE.Mesh(new THREE.BoxGeometry(w * 1.1, h * 0.22, w * 1.1), wd); top.position.y = h + h * 0.11; g.add(top);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.85, h * 0.3, 4), wd); cap.rotation.y = Math.PI / 4; cap.position.y = h * 1.37; g.add(cap);
  for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.CircleGeometry(w * 0.32, 16), face), a = k * Math.PI / 2; f.position.set(Math.sin(a) * (w / 2 + 0.02), h * 0.8, Math.cos(a) * (w / 2 + 0.02)); f.rotation.y = a; g.add(f); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, update(_, night = 0) { face.emissiveIntensity = 1.4 * night; } };
}
