// directors3d.js — 🏛️ Директорската зала: 3D заседателна маса с назначените директори (Meshy → Mixamo риг → Blender → glb).
// Моделите: assets/heavy/directors/<име>.glb (само тяло и скелет), клиповете — общи в clips.glb (скелетът на Вера, имената на костите са едни и същи).
// Седят около масата, дишат и си говорят; клик на директор — посочва и докладва (картата долу вдясно). Зад feature('boardroom') (вика се от group.js).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const DIR = 'assets/heavy/directors/';
// дружество → модел; хотелите (Георги Николов) още нямат модел — столът стои празен с табелката
export const DIR_MODEL = { con: 'ivaylo', hw: 'nadya', rail: 'maria', sea: 'stefan', air: 'elena', oil: 'vera', bank: 'boris' };
const FEMALE = new Set(['nadya', 'maria', 'elena', 'vera']);
// столовете: по 4 от двете страни на масата (x = ±), от прозореца към председателя
const SEATS = [[-1, -2.55], [1, -2.55], [-1, -0.85], [1, -0.85], [-1, 0.85], [1, 0.85], [-1, 2.55], [1, 2.55]];
const SIT_X = 1.4, TABLE_W = 2.1, TABLE_L = 7.4, TABLE_H = 0.74, SCALE = 0.9;

const css = `
#boardRoom { position:fixed; inset:0; z-index:9780; background:#07090d; opacity:0; transition:opacity .45s; }
#boardRoom.on { opacity:1; }
#boardRoom canvas { display:block; width:100%; height:100%; }
#boardRoom .top { position:absolute; left:0; right:0; top:0; display:flex; align-items:center; gap:10px; padding:12px 16px; background:linear-gradient(#000c, #0000); color:#fff; font:800 clamp(16px, 2.6vmin, 22px) system-ui, sans-serif; pointer-events:none; }
#boardRoom .top span { flex:1; text-shadow:0 2px 8px #000; }
#boardRoom .top small { display:block; font:500 13px system-ui, sans-serif; color:#cfd6df; }
#boardRoom .x { pointer-events:auto; font:700 18px system-ui, sans-serif; border:0; border-radius:10px; padding:8px 14px; background:rgba(255,255,255,.14); color:#fff; cursor:pointer; }
#boardRoom .load { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#ffd54a; font:700 18px system-ui, sans-serif; pointer-events:none; transition:opacity .4s; }
#boardRoom .card { position:absolute; right:16px; bottom:16px; width:min(360px, calc(100vw - 32px)); background:rgba(12,16,24,.9); border:1px solid rgba(255,255,255,.14); border-radius:14px; padding:14px 16px; color:#d6dbe3; font:500 14px/1.45 system-ui, sans-serif; box-shadow:0 10px 30px #000a; display:none; }
#boardRoom .card.on { display:block; }
#boardRoom .card h3 { margin:0 0 2px; color:#fff; font:800 18px system-ui, sans-serif; }
#boardRoom .card .co { color:#ffd54a; font-weight:700; }
#boardRoom .card .say { margin:10px 0; padding:9px 11px; border-left:3px solid #ffd54a; background:rgba(255,213,74,.07); border-radius:6px; color:#eef1f5; font-style:italic; }
#boardRoom .card .st { display:flex; gap:14px; flex-wrap:wrap; }
#boardRoom .card .st b { color:#fff; }
#boardRoom .card .row { display:flex; gap:8px; margin-top:10px; flex-wrap:wrap; }
#boardRoom .card button { font:700 14px system-ui, sans-serif; border:0; border-radius:10px; padding:9px 14px; cursor:pointer; background:#f5b942; color:#111; }
#boardRoom .card button:disabled { opacity:.45; cursor:default; }
#boardRoom .tip { position:absolute; transform:translate(-50%, -100%); padding:5px 10px; border-radius:999px; background:rgba(0,0,0,.72); color:#fff; font:700 13px system-ui, sans-serif; white-space:nowrap; pointer-events:none; display:none; }
#boardRoom .hint { position:absolute; left:16px; bottom:16px; color:#9aa4b2; font:500 13px system-ui, sans-serif; text-shadow:0 1px 4px #000; pointer-events:none; }
#boardRoom .scr { position:absolute; left:0; top:0; width:min(340px, 78vw); transform:translate(-50%, calc(-100% - 20px)) scale(.85); transform-origin:50% 100%; padding:12px 14px; border-radius:12px; background:linear-gradient(160deg, rgba(14,34,58,.95), rgba(6,14,26,.95)); border:2px solid #5fb8ff; box-shadow:0 0 26px rgba(95,184,255,.45), inset 0 0 30px rgba(95,184,255,.12); color:#dbe9f7; font:500 14px/1.45 system-ui, sans-serif; display:none; opacity:0; transition:opacity .35s, transform .45s cubic-bezier(.2,1.4,.4,1); }
#boardRoom .scr.on { opacity:1; transform:translate(-50%, calc(-100% - 20px)) scale(1); }
#boardRoom .scr::after { content:''; position:absolute; left:50%; bottom:-20px; width:2px; height:18px; background:linear-gradient(#5fb8ff, transparent); transform:translateX(-50%); }
#boardRoom .scr .hd { display:flex; justify-content:space-between; color:#8fd0ff; font:800 11px system-ui, sans-serif; letter-spacing:.06em; text-transform:uppercase; }
#boardRoom .scr .who { color:#fff; font:800 16px system-ui, sans-serif; margin:4px 0 2px; }
#boardRoom .scr .tx { margin:4px 0 8px; }
#boardRoom .scr .cost { color:#ffd54a; font-weight:800; margin-bottom:9px; }
#boardRoom .scr .row { display:flex; gap:6px; flex-wrap:wrap; }
#boardRoom .scr button { font:700 13px system-ui, sans-serif; border:0; border-radius:9px; padding:8px 12px; cursor:pointer; background:rgba(255,255,255,.14); color:#e6e9ee; }
#boardRoom .scr button.y { background:#f5b942; color:#111; }
#boardRoom .scr button:disabled { opacity:.45; cursor:default; }
#boardRoom .bnav { position:absolute; left:50%; top:12px; transform:translateX(-50%); display:none; align-items:center; gap:8px; padding:5px 8px; border-radius:999px; background:rgba(0,0,0,.6); border:1px solid rgba(95,184,255,.5); color:#fff; font:700 14px system-ui, sans-serif; }
#boardRoom .bnav button { border:0; border-radius:999px; width:30px; height:30px; background:rgba(255,255,255,.14); color:#fff; font:800 16px system-ui, sans-serif; cursor:pointer; }
@media (max-width:640px) { #boardRoom .hint { display:none; } #boardRoom .bnav { top:56px; } }
`;

// ---- моделите и клиповете се зареждат веднъж (после само се добавят в новата сцена)
const loader = new GLTFLoader();
const cache = {};
const loadGlb = n => cache[n] || (cache[n] = loader.loadAsync(DIR + n + '.glb'));
// от клиповете остават само ротациите + позицията на ханша (останалото е от скелета на Вера и би изкривило другите)
let clipsP = null;
const loadClips = () => clipsP || (clipsP = loadGlb('clips').then(g => {
  const out = {};
  for (const c of g.animations) {
    c.tracks = c.tracks.filter(t => t.name.endsWith('.quaternion') || t.name === 'mixamorigHips.position');
    out[c.name] = c;
  }
  return out;
}));

// ---- стаята: под, стени, прозорец с панорама на града, маса, столове, лампи
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function skyline() {
  return canvasTex(2048, 640, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#1d2a4a'); sky.addColorStop(0.45, '#c46a3c'); sky.addColorStop(0.7, '#f3b25e'); sky.addColorStop(1, '#ffd89a');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,240,200,.9)'; g.beginPath(); g.arc(w * 0.68, h * 0.66, 46, 0, Math.PI * 2); g.fill();   // слънцето
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const [far, col, win] of [[1, '#4a3a4e', 0.12], [0, '#1b1820', 0.32]]) {
      for (let x = -20; x < w;) {
        const bw = 40 + rnd() * (far ? 70 : 110), bh = (far ? 120 : 160) + rnd() * (far ? 200 : 330), y = h - bh;
        g.fillStyle = col; g.fillRect(x, y, bw, bh);
        if (rnd() < 0.25) g.fillRect(x + bw * 0.4, y - 40, 4, 40);   // антена
        g.fillStyle = 'rgba(255,214,140,.85)';
        for (let yy = y + 10; yy < h - 8; yy += 14) for (let xx = x + 6; xx < x + bw - 6; xx += 11) if (rnd() < win) g.fillRect(xx, yy, 5, 7);
        x += bw + (far ? 4 : 14) + rnd() * 18;
      }
    }
    // кран — строителна империя
    g.strokeStyle = '#2a2228'; g.lineWidth = 6; g.beginPath(); g.moveTo(w * 0.2, h); g.lineTo(w * 0.2, h * 0.22); g.lineTo(w * 0.33, h * 0.22); g.moveTo(w * 0.17, h * 0.22); g.lineTo(w * 0.2, h * 0.22); g.stroke();
  });
}
function woodTex() {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#5a3b26'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {   // дъски
      const x = i * 64; g.fillStyle = `hsl(25, 38%, ${22 + (i * 37 % 9)}%)`; g.fillRect(x, 0, 62, h);
      g.strokeStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 9; k++) { g.beginPath(); const xx = x + 6 + k * 6; g.moveTo(xx, 0); g.bezierCurveTo(xx + 4, h * 0.3, xx - 4, h * 0.7, xx + 2, h); g.stroke(); }
    }
  });
}
function plateTex(name, sub) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#16181d'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c9a24a'; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10);
    g.textAlign = 'center'; g.fillStyle = '#f2d27a'; g.font = '700 42px system-ui, sans-serif'; g.fillText(name, w / 2, 58);
    g.fillStyle = '#c7ccd4'; g.font = '500 28px system-ui, sans-serif'; g.fillText(sub, w / 2, 100);
  });
}
function roundedRect(w, l, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -l / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + l - r); s.quadraticCurveTo(x + w, y + l, x + w - r, y + l);
  s.lineTo(x + r, y + l); s.quadraticCurveTo(x, y + l, x, y + l - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function chair(mat, metal) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.52), mat); seat.position.y = 0.46; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.78, 0.09), mat); back.position.set(0, 0.92, -0.27); back.rotation.x = -0.12; g.add(back);
  for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.42), mat); arm.position.set(sx * 0.3, 0.68, -0.02); g.add(arm); }
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.38, 10), metal); post.position.y = 0.22; g.add(post);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 5), metal); base.position.y = 0.03; g.add(base);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function buildRoom(scene) {
  const wood = woodTex(); wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(3, 3);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 14), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 9.4), new THREE.MeshStandardMaterial({ color: 0x1f2a3a, roughness: 0.95 }));
  rug.rotation.x = -Math.PI / 2; rug.position.y = 0.005; rug.receiveShadow = true; scene.add(rug);
  const wallM = new THREE.MeshStandardMaterial({ color: 0xd9cbb4, roughness: 0.85 }), H = 3.8;
  for (const [x, z, ry, w] of [[-8, 0, Math.PI / 2, 14], [8, 0, -Math.PI / 2, 14], [0, 7, Math.PI, 16]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), wallM); m.position.set(x, H / 2, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(16, 14), new THREE.MeshStandardMaterial({ color: 0xece6dc, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H; scene.add(ceil);
  // панорамният прозорец (цялата далечна стена) с рамки
  const view = new THREE.Mesh(new THREE.PlaneGeometry(16, H), new THREE.MeshBasicMaterial({ map: skyline(), toneMapped: false }));
  view.position.set(0, H / 2, -7); scene.add(view);
  const frameM = new THREE.MeshStandardMaterial({ color: 0x1a1c20, metalness: 0.6, roughness: 0.4 });
  for (let x = -8; x <= 8; x += 2) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.08, H, 0.08), frameM); f.position.set(x, H / 2, -6.96); scene.add(f); }
  const sill = new THREE.Mesh(new THREE.BoxGeometry(16, 0.12, 0.12), frameM); sill.position.set(0, 0.06, -6.95); scene.add(sill);
  // масата: тъмен орех, заоблени ъгли, два крака-пиедестала
  const top = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(TABLE_W, TABLE_L, 0.5), { depth: 0.06, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }),
    new THREE.MeshStandardMaterial({ color: 0x3b2416, roughness: 0.28, metalness: 0.05 }));
  top.rotation.x = -Math.PI / 2; top.position.y = TABLE_H - 0.06; top.castShadow = top.receiveShadow = true; scene.add(top);
  const legM = new THREE.MeshStandardMaterial({ color: 0x24160d, roughness: 0.5 });
  for (const z of [-2.2, 2.2]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, TABLE_H - 0.06, 1.2), legM); leg.position.set(0, (TABLE_H - 0.06) / 2, z); leg.castShadow = true; scene.add(leg); }
  // логото на групата в средата на масата — златен диск
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.012, 48), new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.9, roughness: 0.25 }));
  disc.position.set(0, TABLE_H + 0.01, 0); scene.add(disc);
  // лампите над масата
  const lampM = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffe2a8, emissiveIntensity: 1.4 });
  for (const z of [-2.4, 0, 2.4]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 32), lampM); l.position.set(0, H - 0.6, z); scene.add(l); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.58, 4), frameM); c.position.set(0, H - 0.29, z); scene.add(c); }
  // растения в ъглите до прозореца
  const potM = new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.6 }), leafM = new THREE.MeshStandardMaterial({ color: 0x2f6b34, roughness: 0.8 });
  for (const x of [-6.8, 6.8]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.6, 20), potM); pot.position.set(x, 0.3, -5.9); scene.add(pot);
    for (let i = 0; i < 7; i++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), leafM); lf.scale.set(0.6, 1.6, 0.6); lf.position.set(x + Math.sin(i * 2.4) * 0.22, 1.0 + (i % 3) * 0.28, -5.9 + Math.cos(i * 2.4) * 0.22); lf.rotation.z = Math.sin(i) * 0.5; lf.castShadow = true; scene.add(lf); }
  }
  // председателският стол (ти) — начело на масата, откъм камерата
  const leather = new THREE.MeshStandardMaterial({ color: 0x16120f, roughness: 0.45 }), metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.3 });
  const boss = chair(leather, metal); boss.scale.setScalar(1.1); boss.position.set(0, 0, TABLE_L / 2 + 0.6); boss.rotation.y = Math.PI; scene.add(boss);
  return { leather, metal };
}

// ---- залата
// o: { title, proposals(): [{ id, dir, ico, text, cost, can }], onDecide(id, 'yes'|'no'|'later'), seats(): [{ k, ico, company, what, open, director, lv, lvMax, inc, bonus, bonusPct, up: {cost, can}|null, hire: {cost, can}|null }], fmt, onUp(k), onHire(k), sound(n) }
export function openBoardroom(o) {
  document.getElementById('boardRoom')?.remove();
  if (!document.getElementById('boardRoomCss')) { const s = document.createElement('style'); s.id = 'boardRoomCss'; s.textContent = css; document.head.appendChild(s); }
  const el = document.createElement('div'); el.id = 'boardRoom';
  el.innerHTML = `<div class="top"><span>🏛️ Директорската зала<small></small></span><button class="x" title="Затвори (Esc)">✕</button></div><div class="load">👔 Директорите влизат…</div><div class="tip"></div><div class="bnav"><button class="pv" title="Предишното">‹</button><span>📋 Предложение <b></b></span><button class="nx" title="Следващото">›</button></div><div class="scr"></div><div class="card"></div><div class="hint">🖱️ Клик на директор — доклад · влачи — обиколи масата</div>`;
  el.querySelector('.top small').textContent = o.title || '';
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.prepend(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0d12);
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const cam = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 60);
  cam.position.set(0, 3.5, TABLE_L / 2 + 3.2);
  const ctl = new OrbitControls(cam, renderer.domElement);
  ctl.target.set(0, 0.95, -0.6); ctl.enableDamping = true; ctl.enablePan = false; ctl.minDistance = 2.2; ctl.maxDistance = 9.5; ctl.maxPolarAngle = 1.45; ctl.minPolarAngle = 0.5; ctl.update();
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x3a3024, 0.55));
  const sun = new THREE.DirectionalLight(0xffd9a8, 1.7); sun.position.set(3, 7, -9); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 25 }); sun.shadow.bias = -0.0004; scene.add(sun);
  for (const z of [-2.4, 0, 2.4]) { const p = new THREE.PointLight(0xffe2b0, 3.2, 7, 1.6); p.position.set(0, 3.0, z); scene.add(p); }
  const { leather, metal } = buildRoom(scene);

  const tip = el.querySelector('.tip'), card = el.querySelector('.card'), hits = [], people = [];
  let sel = null, shut = false, raf = 0, nextChat = 4;
  const clock = new THREE.Clock();
  const seatsNow = () => o.seats();
  // столове и табелки за всички дружества; директорите — където има назначен
  const list = seatsNow();
  list.forEach((s, i) => {
    const [side, z] = SEATS[i] || SEATS[SEATS.length - 1], x = side * SIT_X;
    const ch = chair(leather, metal); ch.position.set(x, 0, z); ch.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(ch);
    s.chair = ch;
    const sub = !s.open ? '🔒 още не е основано' : s.director ? s.company : '👔 свободно място';
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.17), new THREE.MeshBasicMaterial({ map: plateTex(s.director || s.company, sub), toneMapped: false }));
    plate.position.set(side * (TABLE_W / 2 - 0.3), TABLE_H + 0.06, z);
    plate.rotation.set(0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0); plate.rotateX(-0.9); scene.add(plate);   // обърната към отсрещната страна
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.9), new THREE.MeshBasicMaterial()); hit.visible = false;
    hit.position.set(x, 0.85, z); hit.userData.seat = i; scene.add(hit); hits.push(hit);
  });

  // директорите идват асинхронно: стаята се вижда веднага
  loadClips().then(async clips => {
    const pick = (...n) => n.map(x => clips[x]).filter(Boolean);
    await Promise.all(list.map(async (s, i) => {
      const mk = s.director && DIR_MODEL[s.k]; if (!mk) return;
      let g; try { g = await loadGlb(mk); } catch { return; }
      if (shut) return;
      const m = g.scene; m.scale.setScalar(SCALE); m.position.set(0, 0, 0); m.rotation.set(0, 0, 0);
      m.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; c.frustumCulled = false; } });
      const [side, z] = SEATS[i];
      const fem = FEMALE.has(mk);
      const mixer = new THREE.AnimationMixer(m);
      const base = pick(fem ? 'Sit_Meeting_F' : 'Sit_Meeting_M', 'Sit_Table_Idle')[0];
      const p = { s, i, m, mixer, side, z, fem, base: mixer.clipAction(base), cur: null, busy: 0 };
      p.talk = pick('Sit_Talk_M', 'Sit_Table_Ask', fem ? 'Sit_Meeting_F' : 'Sit_Talk_2').map(c => mixer.clipAction(c));
      p.point = pick('Sit_Point_Forward', 'Sit_Point').map(c => mixer.clipAction(c));
      p.base.play(); p.cur = p.base; mixer.update(Math.random() * base.duration);
      // столът — под ханша от позата; тялото — обърнато към масата, ханшът на SIT_X от средата
      const wrap = new THREE.Group(); wrap.add(m); scene.add(wrap);
      wrap.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; wrap.position.set(side * SIT_X, 0, z); wrap.updateMatrixWorld(true);
      const hips = m.getObjectByName('mixamorigHips'), hp = new THREE.Vector3();
      if (hips) {
        hips.getWorldPosition(hp);
        wrap.position.x += side * SIT_X - hp.x; wrap.position.z += z - hp.z; wrap.updateMatrixWorld(true);
        hips.getWorldPosition(hp); s.chair.position.set(hp.x + side * 0.06, THREE.MathUtils.clamp(hp.y - 0.58, -0.15, 0.15), hp.z);
      }
      p.wrap = wrap; people.push(p);
    }));
    el.querySelector('.load').style.opacity = 0;
    board(0);   // бордът започва с първото предложение
  }).catch(e => { console.warn('boardroom', e); el.querySelector('.load').textContent = 'Моделите не се заредиха.'; });

  // смяна на клип с меко преливане; one-shot → обратно към основния
  function play(p, a, once) {
    if (!a || a === p.cur) return;
    a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = !!once; a.fadeIn(0.5).play();
    p.cur && p.cur.fadeOut(0.5); p.cur = a;
    if (once) p.busy = a.getClip().duration - 0.5;
  }
  const back = p => { p.busy = 0; play(p, p.base); };

  // картата с доклада
  const f = n => (o.fmt ? o.fmt(Math.round(n)) : Math.round(n).toLocaleString('bg-BG'));
  function say(s) {
    if (!s.open) return `${s.company} още не е основано. Когато стане, тук ще седне директорът му.`;
    if (!s.director) return `Мястото е свободно. Назначи директор на ${s.company} — носи още +15% от прихода всеки ден.`;
    if (s.up) return `Приходът ни е +${f(s.inc)} €/ден. Предлагам развитие до ниво ${s.lv + 1} — още +${f(s.inc * 0.1)} €/ден за холдинга.`;
    return `Работим на пълни обороти: +${f(s.inc)} €/ден, от които +${f(s.bonus)} € бонус за холдинга. Всичко е под контрол.`;
  }
  function showCard(i, quiet) {
    const s = seatsNow()[i]; if (!s) return;
    sel = i;
    const stars = s.open ? `${'★'.repeat(s.lv)}${'☆'.repeat(s.lvMax - s.lv)} ниво ${s.lv}` : '';
    card.innerHTML = `<h3></h3><div class="co"></div><div class="say"></div><div class="st">${s.open ? `<span>${stars}</span><span>приход <b>+${f(s.inc)} €/ден</b></span>${s.bonus ? `<span>бонус <b style="color:#ffd54a">+${f(s.bonus)} €</b> (+${s.bonusPct}%)</span>` : ''}` : ''}</div><div class="row"></div>`;
    card.querySelector('h3').textContent = s.director || (s.open ? '👔 Свободно място' : '🔒 Неосновано');
    card.querySelector('.co').textContent = `${s.ico} ${s.company}${s.director ? ' — директор' : ''}`;
    card.querySelector('.say').textContent = '„' + say(s) + '“';
    const row = card.querySelector('.row');
    if (s.up) { const b = document.createElement('button'); b.textContent = `⬆️ Одобрявам развитието · ${f(s.up.cost)} €`; b.disabled = !s.up.can; b.onclick = () => { o.onUp && o.onUp(s.k); showCard(i); }; row.appendChild(b); }
    if (s.hire) { const b = document.createElement('button'); b.textContent = `👔 Назначи директор · ${f(s.hire.cost)} €`; b.disabled = !s.hire.can; b.onclick = () => { o.onHire && o.onHire(s.k); close(); setTimeout(() => openBoardroom(o), 450); }; row.appendChild(b); }
    card.classList.add('on');
    if (!quiet) present(i);
  }
  const present = i => { const p = people.find(q => q.i === i); if (p && p.busy <= 0) { play(p, p.point[(Math.random() * p.point.length) | 0], true); o.sound && o.sound('click'); } };

  // 📋 бордът: директорът посочва и над главата му светва екран с предложението (Да / Не / По-късно); после — следващият.
  // „Да“ купува/строи наведнъж (game.js), „Не“/„По-късно“ — group.js помни до кога да мълчи
  const scr = el.querySelector('.scr'), nav = el.querySelector('.bnav'), aim = new THREE.Vector3(0, 0.95, -0.6), hp = new THREE.Vector3();
  let props = [], qi = 0, scrSeat = -1;
  function board(go = qi) {
    props = o.proposals ? o.proposals() : [];
    nav.style.display = props.length ? 'flex' : 'none';
    if (!props.length) { scr.classList.remove('on'); setTimeout(() => { if (!props.length) scr.style.display = 'none'; }, 350); scrSeat = -1; aim.set(0, 0.95, -0.6); return; }
    qi = (go + props.length) % props.length;
    const p = props[qi], i = list.findIndex(s => s.k === p.dir), s = list[i];
    nav.querySelector('b').textContent = `${qi + 1} / ${props.length}`;
    scr.innerHTML = `<div class="hd"><span>📋 Предложение към борда</span><span>${qi + 1} / ${props.length}</span></div><div class="who"></div><div class="tx"></div>${p.cost ? `<div class="cost">💶 ${f(p.cost)} €</div>` : ''}<div class="row"><button class="y">✓ Да</button><button class="n">✖ Не</button><button class="l">⏳ По-късно</button></div>`;
    scr.querySelector('.who').textContent = `${p.ico || s?.ico || ''} ${s?.director || s?.company || ''}`;
    scr.querySelector('.tx').textContent = p.text;
    const y = scr.querySelector('.y'); y.disabled = p.can === false; if (y.disabled) y.title = 'Нямаш достатъчно пари';
    for (const [c, a] of [['y', 'yes'], ['n', 'no'], ['l', 'later']]) scr.querySelector('.' + c).onclick = () => { o.onDecide && o.onDecide(p.id, a); board(qi); };   // решеното изчезва — на същото място идва следващото
    scrSeat = i; card.classList.remove('on'); sel = i;
    scr.style.display = 'block'; scr.classList.remove('on'); requestAnimationFrame(() => requestAnimationFrame(() => scr.classList.add('on')));
    if (i >= 0) present(i);
  }
  nav.querySelector('.pv').onclick = () => board(qi - 1);
  nav.querySelector('.nx').onclick = () => board(qi + 1);
  // екранът следва главата на директора (или стола, ако няма модел); камерата бавно се обръща към него
  function placeScreen(dt) {
    if (scrSeat < 0) { ctl.target.lerp(aim, 1 - Math.exp(-dt * 1.5)); return; }
    const p = people.find(q => q.i === scrSeat), h = p && p.m.getObjectByName('mixamorigHead');
    if (h) h.getWorldPosition(hp); else { const [side, z] = SEATS[scrSeat]; hp.set(side * SIT_X, 1.25, z); }
    aim.set(hp.x * 0.25, 0.95, -0.6 + (hp.z + 0.6) * 0.5); ctl.target.lerp(aim, 1 - Math.exp(-dt * 1.5));
    hp.y += 0.3; hp.project(cam);
    if (hp.z > 1) { scr.style.visibility = 'hidden'; return; }
    scr.style.visibility = '';
    const w = scr.offsetWidth, H = scr.offsetHeight;
    const x = THREE.MathUtils.clamp((hp.x + 1) / 2 * innerWidth, w / 2 + 8, innerWidth - w / 2 - 8), y = Math.max((1 - hp.y) / 2 * innerHeight, H + 96);
    scr.style.left = x + 'px'; scr.style.top = y + 'px';
  }

  // мишката: посочване (табелка с името) и клик (доклад); влаченето върти камерата
  const ray = new THREE.Raycaster(), mv = new THREE.Vector2();
  let down = null;
  const hitAt = e => { const r = renderer.domElement.getBoundingClientRect(); mv.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mv, cam); return ray.intersectObjects(hits)[0]; };
  renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return; down = null;
    const h = hitAt(e); if (!h) { card.classList.remove('on'); sel = null; return; }
    const i = h.object.userData.seat, pi = props.findIndex(p => p.dir === list[i].k);
    if (pi >= 0) board(pi); else showCard(i);
  });
  renderer.domElement.addEventListener('pointermove', e => {
    const h = hitAt(e); renderer.domElement.style.cursor = h ? 'pointer' : 'grab';
    if (!h) { tip.style.display = 'none'; return; }
    const s = list[h.object.userData.seat]; tip.textContent = s.director ? `${s.director} · ${s.ico}` : `${s.ico} ${s.company}`;
    tip.style.left = e.clientX + 'px'; tip.style.top = (e.clientY - 12) + 'px'; tip.style.display = 'block';
  });
  const onResize = () => { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); };
  addEventListener('resize', onResize);
  const key = e => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', key);
  el.querySelector('.x').onclick = () => close();

  function loop() {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    // от време на време някой взима думата
    nextChat -= dt;
    if (nextChat <= 0 && people.length) {
      nextChat = 5 + Math.random() * 7;
      const free = people.filter(p => p.busy <= 0 && p.i !== sel); const p = free[(Math.random() * free.length) | 0];
      if (p) play(p, p.talk[(Math.random() * p.talk.length) | 0], true);
    }
    for (const p of people) { p.mixer.update(dt); if (p.busy > 0 && (p.busy -= dt) <= 0) back(p); }
    placeScreen(dt); ctl.update(); renderer.render(scene, cam);
  }
  loop();

  function close() {
    if (shut) return; shut = true;
    removeEventListener('keydown', key); removeEventListener('resize', onResize);
    el.classList.remove('on');
    setTimeout(() => {
      cancelAnimationFrame(raf); ctl.dispose();
      for (const p of people) { p.mixer.stopAllAction(); p.wrap.remove(p.m); }   // моделите остават в кеша за следващия път
      scene.traverse(c => { if (c.isMesh && !c.isSkinnedMesh) { c.geometry.dispose(); const ms = [].concat(c.material); ms.forEach(mm => { mm.map && mm.map.dispose(); mm.dispose(); }); } });
      scene.environment && scene.environment.dispose(); pmrem.dispose(); renderer.dispose(); el.remove();
    }, 450);
  }
  return { close };
}

// демо за Лабораторията: всички 7 директора на масата (+ хотелите — свободно място) и примерни предложения към борда
const DEMO_PROPS = [
  { id: 'demo-air', dir: 'air', ico: '✈️', text: 'Имаме 10 гейта за ъпдейт в 4 летища — общо 720 млн. €. Да ги направим ли?', cost: 7.2e8 },
  { id: 'demo-rail', dir: 'rail', ico: '🚆', text: 'Да построим 24 нови линии и да купим 22 влака?', cost: 3.2e7 },
  { id: 'demo-oil', dir: 'oil', ico: '🛢️', text: 'Договор за доставка на гориво: Шанхай — 2 млн. барела, +18 млн. € за 60 дни. Приемаме ли?', cost: 0 },
  { id: 'demo-hw', dir: 'hw', ico: '🛣️', text: 'За 5-те нови филиала няма мрежа — да строим аутобани за 3 млн. € и да купим 52 ТИР-а?', cost: 3e6 },
  { id: 'demo-bank', dir: 'bank', ico: '🏦', text: 'Дали сме 22 млрд. € заеми; има искания за още 12 млрд. Да ги одобрим ли?', cost: 0 },
];
export function demoBoardroom() {
  const C = [['con', '🏗️', 'Констръкшън', 'Ивайло Петров', 5, 2.1e6], ['hw', '🛣️', 'Толроуд', 'Надя Иванова', 5, 1.4e6], ['rail', '🚆', 'Рейл', 'Мария Стоянова', 5, 9.8e5], ['sea', '🚢', 'Оушън Експрес', 'Стефан Колев', 5, 1.1e6],
    ['air', '✈️', 'Флайеър', 'Елена Димитрова', 5, 1.6e6], ['hotel', '🏨', 'Хотелс', null, 3, 7.2e5], ['oil', '🛢️', 'Петролиум', 'Вера Ангелова', 5, 3.4e6], ['bank', '🏦', 'Банк', 'Борис Тодоров', 5, 2.7e6]];
  return openBoardroom({
    title: 'Титан Груп — демо',
    proposals: () => DEMO_PROPS.filter(p => !p.done),
    onDecide: (id, a) => { const p = DEMO_PROPS.find(q => q.id === id); if (p) p.done = a; },
    seats: () => C.map(([k, ico, suf, d, lv, inc]) => ({ k, ico, company: 'Титан ' + suf, what: '', open: true, director: d, lv, lvMax: 5, inc, bonus: inc * (lv * 0.1 + (d ? 0.15 : 0)), bonusPct: Math.round((lv * 0.1 + (d ? 0.15 : 0)) * 100), up: lv < 5 ? { cost: 5e6, can: true } : null, hire: !d && lv >= 5 ? { cost: 4e6, can: true } : null })),
  });
}
