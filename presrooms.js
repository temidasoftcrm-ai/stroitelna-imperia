// presrooms.js — президентските зали за Министерския съвет (directors3d.js, o.room = 'us' | 'ru'). Същите размери като Директорската зала,
// за да седят министрите на същите места и камерата да работи еднакво. 🇺🇸 Кабинетната зала: кремави стени, червени завеси,
// портрети, печат с орел и знамена, овална махагонова маса, кожени столове. 🇷🇺 Кремълска зала: бяло и злато, пиластри, полилеи, червена пътека,
// двуглав орел и трикольори, дълга маса от светло дърво. Всичко е процедурно (канвас текстури, кутии) — без външни модели.
import * as THREE from 'three';

const std = (c, r = 0.8, m = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra });
function tex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; }
const rng = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
const addBox = (g, w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
const addCyl = (g, r1, r2, h, m, x, y, z, seg = 16) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };

// ---- знамената (развяват се леко — flags[].update(t))
function usFlag(g, w, h) {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 13; i += 2) { g.fillStyle = '#b22234'; g.fillRect(0, i * h / 13, w, h / 13); }
  g.fillStyle = '#3c3b6e'; g.fillRect(0, 0, w * 0.4, h * 7 / 13);
  g.fillStyle = '#fff'; for (let r = 0; r < 9; r++) for (let c = 0; c < (r % 2 ? 5 : 6); c++) { g.beginPath(); g.arc((c + (r % 2 ? 1 : 0.5)) * w * 0.4 / 6, (r + 0.6) * h * 7 / 13 / 9.6, h * 0.012, 0, 7); g.fill(); }
}
function ruFlag(g, w, h) { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h / 3); g.fillStyle = '#0039a6'; g.fillRect(0, h / 3, w, h / 3); g.fillStyle = '#d52b1e'; g.fillRect(0, 2 * h / 3, w, h / 3); }
function flag(scene, x, z, draw, pole) {
  const t = tex(512, 320, draw), geo = new THREE.PlaneGeometry(1.0, 0.62, 16, 6), base = geo.attributes.position.array.slice();
  const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.9 })); cloth.position.set(x + 0.52, 2.35, z); cloth.castShadow = true; scene.add(cloth);
  addCyl(scene, 0.02, 0.025, 2.75, pole, x, 1.375, z, 8); addCyl(scene, 0.16, 0.2, 0.06, pole, x, 0.03, z, 12);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), pole); top.position.set(x, 2.78, z); scene.add(top);
  return { update: t => { const p = geo.attributes.position.array; for (let i = 0; i < p.length; i += 3) { const u = base[i] + 0.5; p[i + 2] = base[i + 2] + Math.sin(u * 5 - t * 2.2) * 0.05 * u; } geo.attributes.position.needsUpdate = true; } };
}
// ---- гледката през прозореца
const viewUS = () => tex(1024, 768, (g, w, h) => {   // градината: небе, морава, дървета, оградата и Вашингтонският монумент в далечината
  const s = g.createLinearGradient(0, 0, 0, h * 0.62); s.addColorStop(0, '#7fb0e0'); s.addColorStop(1, '#dbe9f4'); g.fillStyle = s; g.fillRect(0, 0, w, h);
  g.fillStyle = '#e9e4d8'; g.beginPath(); g.moveTo(w * 0.7, h * 0.6); g.lineTo(w * 0.712, h * 0.12); g.lineTo(w * 0.724, h * 0.6); g.fill();
  g.fillStyle = '#5e8f3e'; g.fillRect(0, h * 0.6, w, h); const r = rng(5);
  for (let i = 0; i < 26; i++) { g.fillStyle = `hsl(${100 + r() * 30},40%,${22 + r() * 14}%)`; g.beginPath(); g.arc(r() * w, h * (0.56 + r() * 0.08), 30 + r() * 50, 0, 7); g.fill(); }
  g.fillStyle = '#8fbf5e'; g.fillRect(0, h * 0.72, w, h);
});
const viewRU = () => tex(1024, 768, (g, w, h) => {   // зимна Москва: бледо небе, сняг, златни луковици и кремълска стена
  const s = g.createLinearGradient(0, 0, 0, h * 0.66); s.addColorStop(0, '#9fb6cc'); s.addColorStop(1, '#e6ecf1'); g.fillStyle = s; g.fillRect(0, 0, w, h);
  g.fillStyle = '#a8332b'; g.fillRect(0, h * 0.6, w, h * 0.08); for (let x = 0; x < w; x += 36) { g.beginPath(); g.moveTo(x, h * 0.6); g.lineTo(x + 9, h * 0.56); g.lineTo(x + 18, h * 0.6); g.fill(); }
  for (const [x, k] of [[0.25, 1], [0.42, 0.8], [0.6, 1.2], [0.78, 0.9]]) {
    g.fillStyle = '#f1ece0'; g.fillRect(w * x - 26 * k, h * 0.38, 52 * k, h * 0.22);
    g.fillStyle = '#d9a53a'; g.beginPath(); g.ellipse(w * x, h * 0.36, 34 * k, 36 * k, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(w * x - 18 * k, h * 0.33); g.quadraticCurveTo(w * x, h * 0.2, w * x, h * 0.18); g.quadraticCurveTo(w * x, h * 0.2, w * x + 18 * k, h * 0.33); g.fill();
    g.fillRect(w * x - 1.5, h * 0.12, 3, h * 0.07);
  }
  g.fillStyle = '#f4f6f8'; g.fillRect(0, h * 0.68, w, h);
});
// печатът / гербът на стената
const sealUS = () => tex(1024, 1024, (g, w) => {
  const c = w / 2; g.fillStyle = '#1b2b5c'; g.beginPath(); g.arc(c, c, c - 4, 0, 7); g.fill();
  g.strokeStyle = '#d9b45e'; g.lineWidth = 26; g.beginPath(); g.arc(c, c, c - 30, 0, 7); g.stroke();
  g.fillStyle = '#d9b45e'; for (let i = 0; i < 50; i++) { const a = i / 50 * Math.PI * 2; g.beginPath(); g.arc(c + Math.cos(a) * (c - 80), c + Math.sin(a) * (c - 80), 9, 0, 7); g.fill(); }
  // орелът: тяло, разперени криле, глава, щит
  g.fillStyle = '#c9a24a'; g.beginPath(); g.moveTo(c, c - 150); for (const [x, y] of [[c + 60, c - 80], [c + 330, c - 160], [c + 250, c + 10], [c + 90, c + 40], [c + 70, c + 190], [c, c + 230], [c - 70, c + 190], [c - 90, c + 40], [c - 250, c + 10], [c - 330, c - 160], [c - 60, c - 80]]) g.lineTo(x, y); g.closePath(); g.fill();
  g.fillStyle = '#f2ece0'; g.beginPath(); g.arc(c, c - 170, 52, 0, 7); g.fill(); g.fillStyle = '#e0a020'; g.beginPath(); g.moveTo(c + 40, c - 175); g.lineTo(c + 85, c - 160); g.lineTo(c + 40, c - 150); g.fill();
  g.fillStyle = '#fff'; g.fillRect(c - 70, c - 40, 140, 150); g.fillStyle = '#b22234'; for (let i = 0; i < 7; i++) g.fillRect(c - 70 + i * 20, c + 10, 10, 100); g.fillStyle = '#3c3b6e'; g.fillRect(c - 70, c - 40, 140, 50);
});
const sealRU = () => tex(1024, 1200, (g, w, h) => {   // червен щит, златен двуглав орел с корони, свети Георги в средата — стилизиран
  g.fillStyle = '#c0281f'; g.beginPath(); g.moveTo(80, 60); g.lineTo(w - 80, 60); g.lineTo(w - 80, h * 0.62); g.quadraticCurveTo(w / 2, h * 0.98, 80, h * 0.62); g.closePath(); g.fill();
  g.strokeStyle = '#e8c06a'; g.lineWidth = 18; g.stroke();
  const c = w / 2, y = h * 0.42; g.fillStyle = '#e8b94a';
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(c, y); for (let k = 0; k < 6; k++) g.lineTo(c + s * (120 + k * 55), y - 240 + k * 70 + (k % 2) * 30); g.lineTo(c + s * 120, y + 120); g.closePath(); g.fill();   // крилото
    g.beginPath(); g.ellipse(c + s * 85, y - 250, 48, 58, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(c + s * 120, y - 255); g.lineTo(c + s * 175, y - 240); g.lineTo(c + s * 120, y - 225); g.fill();   // главата и клюнът
    g.fillRect(c + s * 85 - 34, y - 360, 68, 50);   // короната
  }
  g.beginPath(); g.ellipse(c, y + 20, 95, 170, 0, 0, 7); g.fill(); g.fillRect(c - 52, y - 470, 104, 80);   // тялото и голямата корона
  g.fillStyle = '#c0281f'; g.fillRect(c - 55, y - 40, 110, 140); g.fillStyle = '#f2f2f2'; g.beginPath(); g.arc(c, y + 30, 34, 0, 7); g.fill();   // щитът със свети Георги
  for (const s of [-1, 1]) { g.fillStyle = '#e8b94a'; g.fillRect(c + s * 60 - 12, y + 190, 24, 110); }
});
const portrait = seed => tex(256, 320, (g, w, h) => {   // маслен портрет: тъмен фон, силует, рамка
  const r = rng(seed); g.fillStyle = `hsl(${20 + r() * 20},30%,${14 + r() * 8}%)`; g.fillRect(0, 0, w, h);
  g.fillStyle = `hsl(${25 + r() * 15},25%,${30 + r() * 10}%)`; g.beginPath(); g.ellipse(w / 2, h * 0.38, 46, 58, 0, 0, 7); g.fill();
  g.fillStyle = '#1d1a18'; g.beginPath(); g.moveTo(40, h); g.quadraticCurveTo(w / 2, h * 0.5, w - 40, h); g.fill();
  g.fillStyle = '#e8e2d6'; g.beginPath(); g.moveTo(w / 2 - 18, h * 0.62); g.lineTo(w / 2, h * 0.8); g.lineTo(w / 2 + 18, h * 0.62); g.fill();
});
const carpetTex = (base, line) => tex(512, 512, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h); g.strokeStyle = line; g.lineWidth = 3;
  for (let x = 32; x < w; x += 64) for (let y = 32; y < h; y += 64) { g.beginPath(); for (let k = 0; k < 5; k++) { const a = k * 2.513 - 1.57; g.lineTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10); } g.closePath(); g.stroke(); }
}, [6, 7]);
const parquet = () => tex(512, 512, (g, w, h) => {
  for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 128) { g.fillStyle = `hsl(28,${35 + ((x + y) % 7) * 2}%,${30 + ((x * 3 + y) % 9)}%)`; g.fillRect(x + ((y / 32) % 2) * 64, y, 126, 30); }
}, [6, 6]);
const woodTex = (hue, l) => tex(512, 1024, (g, w, h) => {
  g.fillStyle = `hsl(${hue},45%,${l}%)`; g.fillRect(0, 0, w, h); const r = rng(9);
  for (let i = 0; i < 260; i++) { const x = r() * w; g.strokeStyle = `hsla(${hue},40%,${l + (r() < 0.5 ? -9 : 7)}%,${0.2 + r() * 0.3})`; g.lineWidth = 1 + r() * 3; g.beginPath(); g.moveTo(x, 0); let xx = x; for (let y = 0; y <= h; y += 64) { xx += Math.sin(y / 260 + i) * 5; g.lineTo(xx, y); } g.stroke(); }
});

// H: { ROOM_W, ROOM_BACK, ROOM_FRONT, ROOM_H, TABLE_W, TABLE_L, TABLE_H, roundedRect }
export function buildPresRoom(scene, cc, H) {
  const { ROOM_W, ROOM_BACK, ROOM_FRONT, ROOM_H: RH, TABLE_W, TABLE_L, TABLE_H } = H, D = ROOM_FRONT - ROOM_BACK, cz = (ROOM_FRONT + ROOM_BACK) / 2, RU = cc === 'ru';
  const gold = std(0xd9a53a, 0.3, 1), wallM = std(RU ? 0xf3efe6 : 0xefe5cf, 0.85), trimM = std(RU ? 0xffffff : 0xf8f4ea, 0.6);
  const flags = [];
  // под
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W * 2, D), RU ? std(0xffffff, 0.45, 0, { map: parquet() }) : std(0xffffff, 0.95, 0, { map: carpetTex('#1d3566', 'rgba(217,180,94,.55)') }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = cz; floor.receiveShadow = true; scene.add(floor);
  if (RU) { const run = new THREE.Mesh(new THREE.PlaneGeometry(TABLE_W + 2.6, TABLE_L + 3), std(0xa3191d, 0.95)); run.rotation.x = -Math.PI / 2; run.position.set(0, 0.004, 0); run.receiveShadow = true; scene.add(run); }
  // стени: задна (печат/герб и знамена), предна, странични с прозорци
  for (const [z, ry] of [[ROOM_BACK, 0], [ROOM_FRONT, Math.PI]]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W * 2, RH), wallM); w.position.set(0, RH / 2, z); w.rotation.y = ry; w.receiveShadow = true; scene.add(w); }
  const view = RU ? viewRU() : viewUS(), drape = std(RU ? 0xe8d8a8 : 0x9b1c22, 0.9), drapeTie = gold;
  for (const side of [-1, 1]) {
    const x = side * ROOM_W, wall = new THREE.Mesh(new THREE.PlaneGeometry(D, RH), wallM); wall.position.set(x, RH / 2, cz); wall.rotation.y = -side * Math.PI / 2; scene.add(wall);
    for (let k = 0; k < 3; k++) {   // три високи прозореца на страна, с рамки, завеси и (в Русия) арка
      const z = ROOM_BACK + D * (0.22 + k * 0.28), ww = 1.5, wh = RU ? 2.3 : 2.4, y0 = 0.75;
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: view, toneMapped: false })); pane.position.set(x - side * 0.02, y0 + wh / 2, z); pane.rotation.y = -side * Math.PI / 2; scene.add(pane);
      if (RU) { const arch = new THREE.Mesh(new THREE.CircleGeometry(ww / 2, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ map: view, toneMapped: false })); arch.position.set(x - side * 0.02, y0 + wh, z); arch.rotation.y = -side * Math.PI / 2; scene.add(arch); }
      for (const dz of [-ww / 2, 0, ww / 2]) addBox(scene, 0.06, wh, 0.06, trimM, x - side * 0.04, y0 + wh / 2, z + dz);
      addBox(scene, 0.06, 0.06, ww, trimM, x - side * 0.04, y0 + wh * 0.62, z);
      for (const s of [-1, 1]) { const c = addBox(scene, 0.1, RH - 0.25, 0.42, drape, x - side * 0.12, (RH - 0.25) / 2, z + s * (ww / 2 + 0.24)); c.scale.z = 1; addBox(scene, 0.12, 0.08, 0.46, drapeTie, x - side * 0.13, 1.2, z + s * (ww / 2 + 0.24)); }
    }
    // между прозорците — портрети (САЩ) или златни пиластри (Русия)
    for (let k = 0; k < 2; k++) {
      const z = ROOM_BACK + D * (0.36 + k * 0.28);
      if (RU) { addBox(scene, 0.12, RH, 0.36, std(0xffffff, 0.6), x - side * 0.06, RH / 2, z); addBox(scene, 0.14, RH, 0.05, gold, x - side * 0.07, RH / 2, z); }
      else { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.88), std(0xffffff, 0.7, 0, { map: portrait(11 + k * 7 + (side > 0 ? 3 : 0)) })); p.position.set(x - side * 0.03, 2.0, z); p.rotation.y = -side * Math.PI / 2; scene.add(p); addBox(scene, 0.05, 1.0, 0.82, gold, x - side * 0.015, 2.0, z); }
    }
  }
  // ламперия и корниз
  for (const [w, x, z, ry] of [[ROOM_W * 2, 0, ROOM_BACK + 0.04, 0], [ROOM_W * 2, 0, ROOM_FRONT - 0.04, 0]]) { addBox(scene, w, RU ? 0.9 : 1.0, 0.05, trimM, x, RU ? 0.45 : 0.5, z); addBox(scene, w, 0.14, 0.14, RU ? gold : trimM, x, RH - 0.07, z); }
  for (const side of [-1, 1]) addBox(scene, 0.14, 0.14, D, RU ? gold : trimM, side * (ROOM_W - 0.07), RH - 0.07, cz);
  // задната стена: печат с орел (САЩ) или герб (Русия) между две знамена; в Русия — и златни пиластри
  const seal = new THREE.Mesh(RU ? new THREE.PlaneGeometry(1.5, 1.76) : new THREE.CircleGeometry(0.95, 64), std(0xffffff, 0.5, 0.1, { map: RU ? sealRU() : sealUS(), transparent: RU, alphaTest: RU ? 0.1 : 0 }));
  seal.position.set(0, 2.2, ROOM_BACK + 0.05); scene.add(seal);
  if (!RU) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.035, 10, 80), gold); ring.position.set(0, 2.2, ROOM_BACK + 0.06); scene.add(ring); }
  const pole = std(RU ? 0xd9a53a : 0xc9a24a, 0.3, 1);
  flags.push(flag(scene, -1.85, ROOM_BACK + 0.45, RU ? ruFlag : usFlag, pole), flag(scene, 1.25, ROOM_BACK + 0.45, RU ? ruFlag : usFlag, pole));
  if (RU) for (const x of [-3.6, -2.6, 2.6, 3.6]) { addBox(scene, 0.36, RH, 0.12, std(0xffffff, 0.6), x, RH / 2, ROOM_BACK + 0.06); addBox(scene, 0.05, RH, 0.14, gold, x, RH / 2, ROOM_BACK + 0.07); }
  else { const fp = new THREE.Group(); scene.add(fp); addBox(fp, 1.6, 1.1, 0.25, std(0xf4efe4, 0.5), -3.6, 0.55, ROOM_BACK + 0.13); addBox(fp, 0.9, 0.7, 0.1, std(0x1a1210, 0.9), -3.6, 0.4, ROOM_BACK + 0.21); addBox(fp, 1.6, 1.1, 0.25, std(0xf4efe4, 0.5), 3.6, 0.55, ROOM_BACK + 0.13); }
  // таван и полилеи (светят)
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W * 2, D), std(RU ? 0xf6f1e4 : 0xf4efe4, 1, 0, { emissive: 0x6b6458 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, RH, cz); scene.add(ceil);
  const bulb = std(0xfff3d6, 0.3, 0, { emissive: 0xffe2a8, emissiveIntensity: 1.6 }), crystal = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.7 });   // без transmission — отделен проход на сцената
  for (const z of RU ? [-2.6, 0, 2.6] : [-1.6, 1.6]) {
    const ch = new THREE.Group(); ch.position.set(0, RH - 0.9, z); scene.add(ch);
    addCyl(ch, 0.01, 0.01, 0.7, gold, 0, 0.55, 0, 6);
    for (const [r, y, n] of RU ? [[0.55, 0, 12], [0.4, 0.22, 9], [0.25, 0.42, 6]] : [[0.5, 0.05, 10]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.018, 6, 40), gold); ring.rotation.x = Math.PI / 2; ring.position.y = y; ch.add(ring);
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), bulb); b.position.set(Math.cos(a) * r, y + 0.05, Math.sin(a) * r); ch.add(b); if (RU) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.12, 6), crystal); c.position.set(Math.cos(a) * r, y - 0.08, Math.sin(a) * r); c.rotation.x = Math.PI; ch.add(c); } }
    }
    const l = new THREE.PointLight(0xffe2b0, 2.2, 7, 1.6); l.position.y = -0.1; ch.add(l);
  }
  // масата: овална махагонова (САЩ) или дълга от светло дърво със златен кант (Русия)
  const wood = woodTex(RU ? 34 : 12, RU ? 58 : 24); wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(0.4, 0.14);
  const top = new THREE.Mesh(new THREE.ExtrudeGeometry(H.roundedRect(TABLE_W, TABLE_L, RU ? 0.12 : TABLE_W / 2), { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3 }), new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.12 }));
  top.rotation.x = -Math.PI / 2; top.position.y = TABLE_H - 0.06; top.castShadow = top.receiveShadow = true; scene.add(top);
  if (RU) { const inl = addBox(scene, 0.06, 0.004, TABLE_L - 0.6, gold, 0, TABLE_H + 0.02, 0); inl.castShadow = false; }
  const legM = std(RU ? 0xcfb48a : 0x3a1a10, 0.45);
  for (const z of [-2.1, 2.1]) { addBox(scene, 1.0, TABLE_H - 0.08, 1.4, legM, 0, (TABLE_H - 0.08) / 2, z); addBox(scene, 1.04, 0.04, 1.44, gold, 0, 0.03, z); }
  // столовете: кафява кожа с месинг (САЩ) / слонова кост и злато (Русия)
  return { leather: std(RU ? 0xf1e7cf : 0x5a2e1b, RU ? 0.75 : 0.5), metal: RU ? gold : std(0xb08d57, 0.35, 0.9), gold, update: t => { for (const f of flags) f.update(t); } };
}
