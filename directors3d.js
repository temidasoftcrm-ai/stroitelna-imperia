// directors3d.js — 🏛️ Директорската зала: 3D заседателна маса с назначените директори (Meshy → Mixamo риг → Blender → glb).
// Моделите: assets/heavy/directors/<име>.glb (само тяло и скелет), клиповете — общи в clips.glb (скелетът на Вера, имената на костите са едни и същи).
// Седят около масата, дишат и си говорят; клик на директор — посочва и докладва (картата долу вдясно). Зад feature('boardroom') (вика се от group.js).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createHolo } from './boardholo.js';

const DIR = 'assets/heavy/directors/';
const SIT_HIP = [0, -1, -57];   // ханшът в седнала поза (единиците на скелета, см) — по „Sit_Meeting“ / „Sit_Breathing“
// дружество → модел; хотелите (Георги Николов) още нямат модел — столът стои празен с табелката
export const DIR_MODEL = { con: 'ivaylo', hw: 'nadya', rail: 'maria', sea: 'stefan', air: 'elena', hotel: 'georgi', oil: 'vera', bank: 'boris', glob: 'glob' };   // georgi/glob — от потребителя (Meshy); докато ги няма — празен стол
const FEMALE = new Set(['nadya', 'maria', 'elena', 'vera']);
const HAVE = new Set(['ivaylo', 'nadya', 'maria', 'stefan', 'elena', 'vera', 'boris', 'georgi']);   // моделите, които вече са в assets/heavy/directors (без 404 за останалите)
// столовете: по 4 от двете страни на масата (x = ±), от прозореца към председателя
// …и девето — начело откъм картата (side 0): директорът на Глобъл, срещу председателя
const SEATS = [[-1, -2.7], [1, -2.7], [-1, -0.9], [1, -0.9], [-1, 0.9], [1, 0.9], [-1, 2.7], [1, 2.7], [0, -4.25]];
const SIT_X = 1.55, TABLE_W = 2.4, TABLE_L = 7.4, TABLE_H = 0.74, SCALE = 0.9, TURN = 0.3;   // TURN — директорите са леко обърнати към председателя
const seatRy = side => side < 0 ? Math.PI / 2 - TURN : side > 0 ? -Math.PI / 2 + TURN : 0;   // накъде гледа столът (начело — към председателя)

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
#boardRoom .scr .votes { margin:4px 0 6px; font-size:13px; }
#boardRoom .scr .votes div { margin:2px 0; }
#boardRoom .scr .res { font:800 16px system-ui, sans-serif; margin:6px 0 8px; }
#boardRoom .vb { position:absolute; transform:translate(-50%, -100%); padding:3px 9px; border-radius:999px; background:rgba(0,0,0,.72); color:#fff; font:800 15px system-ui, sans-serif; pointer-events:none; white-space:nowrap; }
#boardRoom .vb.y { border:2px solid #5fd38a; } #boardRoom .vb.n { border:2px solid #ff6b6b; }
#boardRoom .top .cfg { pointer-events:auto; font:700 14px system-ui, sans-serif; border:0; border-radius:10px; padding:8px 12px; background:rgba(255,255,255,.14); color:#fff; cursor:pointer; }
#boardRoom .set { position:absolute; left:16px; top:64px; width:min(560px, calc(100vw - 32px)); max-height:calc(100vh - 120px); overflow:auto; display:none; background:rgba(12,16,24,.94); border:1px solid rgba(255,255,255,.14); border-radius:14px; padding:8px; color:#d6dbe3; }
#boardRoom .set.on { display:block; }
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
    // седналите клипове от Mixamo са записани с различен стол: „Pointing While Seated“ е 21 см по-високо, „Asking Question“ — 55 см напред
    // → ханшът на първия кадър се изравнява с общата седнала поза, иначе директорът подскача или влиза в масата
    const hip = c.tracks.find(t => t.name === 'mixamorigHips.position');
    if (hip && /^Sit_/.test(c.name) && c.name !== 'Sit_To_Stand') {
      const v = hip.values, d = [SIT_HIP[0] - v[0], SIT_HIP[1] - v[1], SIT_HIP[2] - v[2]];
      for (let k = 0; k < v.length; k += 3) { v[k] += d[0]; v[k + 1] += d[1]; v[k + 2] += d[2]; }
    }
    out[c.name] = c;
  }
  return out;
}));

// ---- стаята (по картинката на потребителя): мраморна стена със златна карта на света, аплици, скрин и растения;
// отстрани — прозорци към града (снимки от assets/ui/boardroom/window-l|r.webp, ако ги има — иначе нарисуван град); орехова маса с тъмна лента
const ROOM_W = 5.4, ROOM_BACK = -6.2, ROOM_FRONT = 7, ROOM_H = 3.7;
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
// дневен град с кранове (докато няма снимки)
function skyline(seed) {
  return canvasTex(2048, 900, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#8fb6dc'); sky.addColorStop(0.7, '#dbe7f1'); sky.addColorStop(1, '#eef2f4');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const rnd = rng(seed), base = h * 0.8;
    for (const [far, a, b] of [[1, '#9fb2c6', '#b8c7d6'], [0, '#5d7288', '#7f93a8']]) {
      for (let x = -20; x < w;) {
        const bw = 50 + rnd() * (far ? 70 : 120), bh = (far ? 160 : 220) + rnd() * (far ? 260 : 420), y = base - bh;
        const gr = g.createLinearGradient(x, 0, x + bw, 0); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(x, y, bw, bh);
        g.fillStyle = 'rgba(255,255,255,.18)'; for (let yy = y + 8; yy < base; yy += 12) g.fillRect(x, yy, bw, 2);   // етажите
        if (rnd() < 0.3) { g.fillStyle = a; g.beginPath(); g.moveTo(x, y); g.lineTo(x + bw / 2, y - 60 - rnd() * 80); g.lineTo(x + bw, y); g.fill(); }   // шпил
        x += bw + (far ? 6 : 26) + rnd() * 30;
      }
    }
    // строежи с кранове
    g.strokeStyle = '#d9822b'; g.lineWidth = 5;
    for (let k = 0; k < 4; k++) {
      const x = 200 + k * 480 + rnd() * 120, top = 90 + rnd() * 120;
      g.beginPath(); g.moveTo(x, base); g.lineTo(x, top); g.moveTo(x - 60, top); g.lineTo(x + 240, top); g.moveTo(x, top - 30); g.lineTo(x + 240, top); g.moveTo(x, top - 30); g.lineTo(x - 60, top); g.stroke();
      g.beginPath(); g.moveTo(x + 180, top); g.lineTo(x + 180, top + 120); g.stroke();
      g.fillStyle = 'rgba(90,100,110,.85)'; g.fillRect(x + 30, base - 260 - rnd() * 120, 120, 400);   // недостроената кула
    }
    g.fillStyle = '#7f98ad'; g.fillRect(0, base, w, h - base);   // реката
    g.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 60; i++) g.fillRect(rnd() * w, base + 8 + rnd() * (h - base - 10), 40 + rnd() * 80, 2);
    g.fillStyle = '#c9c2b4'; g.fillRect(0, base + 12, w, 16); for (let x = 30; x < w; x += 140) { g.beginPath(); g.arc(x + 70, base + 28, 60, Math.PI, 0); g.fill(); }   // мостът
  });
}
function marbleTex() {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#ddd2bf'; g.fillRect(0, 0, w, h);
    const rnd = rng(11);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${150 + rnd() * 60},${130 + rnd() * 50},${110 + rnd() * 40},.06)`; g.fillRect(rnd() * w, rnd() * h, 30 + rnd() * 90, 30 + rnd() * 90); }
    g.lineWidth = 1.4;
    for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(120,105,90,${0.12 + rnd() * 0.2})`; g.beginPath(); let x = rnd() * w, y = 0; g.moveTo(x, y); while (y < h) { x += (rnd() - 0.5) * 60; y += 30 + rnd() * 50; g.lineTo(x, y); } g.stroke(); }
    g.strokeStyle = 'rgba(80,70,60,.35)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h);   // фугите между плочите
  });
}
function walnutTex() {
  return canvasTex(1024, 2048, (g, w, h) => {
    g.fillStyle = '#4a2a17'; g.fillRect(0, 0, w, h);
    const rnd = rng(5);
    for (let i = 0; i < 420; i++) {
      const x = rnd() * w; g.strokeStyle = `rgba(${rnd() < 0.5 ? '25,12,5' : '120,72,38'},${0.12 + rnd() * 0.25})`; g.lineWidth = 1 + rnd() * 3;
      g.beginPath(); g.moveTo(x, 0); let xx = x; for (let y = 0; y <= h; y += 64) { xx += Math.sin(y / 300 + i) * 6 + (rnd() - 0.5) * 4; g.lineTo(xx, y); } g.stroke();
    }
  });
}
function carpetTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#3c4048'; g.fillRect(0, 0, w, h);
    const rnd = rng(3); g.strokeStyle = 'rgba(200,205,215,.12)'; g.lineWidth = 2;
    for (let y = 0; y < h; y += 16) { g.beginPath(); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x / 40 + y / 25) * 6); g.stroke(); }
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.05})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
  });
}
// златната карта на света (assets/globe/countries.json) върху тъмносин фон
function worldMap() {
  const t = canvasTex(2048, 1080, (g, w, h) => { g.fillStyle = '#12284e'; g.fillRect(0, 0, w, h); });
  fetch('assets/globe/countries.json').then(r => r.json()).then(geo => {
    const g = t.image.getContext('2d'), w = t.image.width, h = t.image.height, P = ([lo, la]) => [(lo + 180) / 360 * w, (84 - la) / (84 + 58) * h];
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#e7c97a'); gr.addColorStop(0.5, '#c79a45'); gr.addColorStop(1, '#e3bf6c');
    g.fillStyle = gr; g.strokeStyle = 'rgba(70,45,10,.45)'; g.lineWidth = 1.2;
    for (const f of geo.features) {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const poly of polys) { g.beginPath(); for (const ring of poly) ring.forEach((c, i) => { const [x, y] = P(c); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.fill('evenodd'); g.stroke(); }
    }
    t.needsUpdate = true;
  }).catch(() => {});
  return t;
}
// логото на дружеството (assets/ui/subs/<k>.webp, прозрачно) — на папките и облегалките
const logoUrl = k => `assets/ui/subs/${k}.webp`;
const logoTexCache = {};
const logoTex = k => logoTexCache[k] || (logoTexCache[k] = new THREE.TextureLoader().load(logoUrl(k), t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; }));
// кожената папка: логото отгоре, името и дружеството под него
function folderTex(name, sub, k) {
  const t = canvasTex(512, 360, (g, w, h) => {
    g.fillStyle = '#17181b'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(201,162,74,.8)'; g.lineWidth = 4; g.strokeRect(14, 14, w - 28, h - 28);
    g.textAlign = 'center'; g.fillStyle = '#e2c27a'; g.font = '700 38px system-ui, sans-serif'; g.fillText(name, w / 2, 262);
    g.fillStyle = '#9aa1ab'; g.font = '500 24px system-ui, sans-serif'; g.fillText(sub, w / 2, 302);
  });
  if (k) { const im = new Image(); im.onload = () => { t.image.getContext('2d').drawImage(im, 256 - 80, 44, 160, 160); t.needsUpdate = true; }; im.src = logoUrl(k); }
  return t;
}
function roundedRect(w, l, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -l / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + l - r); s.quadraticCurveTo(x + w, y + l, x + w - r, y + l);
  s.lineTo(x + r, y + l); s.quadraticCurveTo(x, y + l, x, y + l - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// висок кожен стол в тъмносиньо
function chair(mat, metal, k) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 0.54), mat); seat.position.y = 0.47; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.92, 0.12), mat); back.position.set(0, 1.0, -0.28); back.rotation.x = -0.1; g.add(back);
  if (k) {   // бродираната емблема горе на облегалката — над главата на директора, вижда се отсреща
    const em = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), new THREE.MeshStandardMaterial({ map: logoTex(k), transparent: true, alphaTest: 0.1, roughness: 0.6 }));
    em.position.set(0, 0.3, 0.062); back.add(em);
  }
  for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.44), metal); arm.position.set(sx * 0.31, 0.7, -0.02); g.add(arm); const st = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), metal); st.position.set(sx * 0.31, 0.6, 0.05); g.add(st); }
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.38, 10), metal); post.position.y = 0.22; g.add(post);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 5), metal); base.position.y = 0.03; g.add(base);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function plant(scene, x, z, leafM, potM) {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.62, 24), potM); pot.position.set(x, 0.31, z); pot.castShadow = true; scene.add(pot);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.2, 6), new THREE.MeshStandardMaterial({ color: 0x5a4632 })); trunk.position.set(x, 1.1, z); scene.add(trunk);
  const rnd = rng(Math.round(x * 100 + 999)), geo = new THREE.SphereGeometry(0.11, 7, 5);
  for (let i = 0; i < 46; i++) { const a = rnd() * Math.PI * 2, r = rnd() * 0.45, y = 1.25 + rnd() * 0.9; const lf = new THREE.Mesh(geo, leafM); lf.scale.set(1, 0.55, 1.5); lf.position.set(x + Math.cos(a) * r, y, z + Math.sin(a) * r); lf.rotation.set(rnd(), rnd() * 3, rnd()); lf.castShadow = true; scene.add(lf); }
}
function buildRoom(scene) {
  const H = ROOM_H, D = ROOM_FRONT - ROOM_BACK, cz = (ROOM_FRONT + ROOM_BACK) / 2;
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.95, roughness: 0.28 });
  const carpet = carpetTex(); carpet.wrapS = carpet.wrapT = THREE.RepeatWrapping; carpet.repeat.set(5, 6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W * 2, D), new THREE.MeshStandardMaterial({ map: carpet, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = cz; floor.receiveShadow = true; scene.add(floor);
  // задната стена: мрамор, две пиластри с аплици, златната карта, скринът
  const marble = marbleTex(); marble.wrapS = marble.wrapT = THREE.RepeatWrapping; marble.repeat.set(4, 1.6);
  const marbleM = new THREE.MeshStandardMaterial({ map: marble, roughness: 0.35 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W * 2, H), marbleM); back.position.set(0, H / 2, ROOM_BACK); back.receiveShadow = true; scene.add(back);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W * 2, H), marbleM); front.position.set(0, H / 2, ROOM_FRONT); front.rotation.y = Math.PI; scene.add(front);
  const map = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.43), new THREE.MeshStandardMaterial({ map: worldMap(), roughness: 0.6, metalness: 0.15 }));
  map.position.set(0, 2.05, ROOM_BACK + 0.04); scene.add(map);
  for (const [w, h, x, y] of [[4.72, 0.06, 0, 2.05 + 1.245], [4.72, 0.06, 0, 2.05 - 1.245], [0.06, 2.55, -2.33, 2.05], [0.06, 2.55, 2.33, 2.05]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), gold); f.position.set(x, y, ROOM_BACK + 0.05); scene.add(f); }
  for (const x of [-3.2, 3.2]) {
    const pil = new THREE.Mesh(new THREE.BoxGeometry(0.9, H, 0.25), marbleM); pil.position.set(x, H / 2, ROOM_BACK + 0.12); pil.castShadow = pil.receiveShadow = true; scene.add(pil);
    for (const dx of [-0.46, 0.46]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.025, H, 0.27), gold); st.position.set(x + dx, H / 2, ROOM_BACK + 0.12); scene.add(st); }
    const sc = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.08), new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffd9a0, emissiveIntensity: 2 }));
    sc.position.set(x, 2.25, ROOM_BACK + 0.3); scene.add(sc);
    const l = new THREE.PointLight(0xffc98a, 2.2, 5, 1.8); l.position.set(x, 2.3, ROOM_BACK + 0.6); scene.add(l);
  }
  const cred = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.78, 0.5), new THREE.MeshStandardMaterial({ map: walnutTex(), roughness: 0.35 }));
  cred.position.set(0, 0.39, ROOM_BACK + 0.32); cred.castShadow = cred.receiveShadow = true; scene.add(cred);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), gold); bowl.scale.y = 0.3; bowl.position.set(0, 0.86, ROOM_BACK + 0.32); scene.add(bowl);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 12, 40), gold); ring.position.set(-1.1, 1.0, ROOM_BACK + 0.32); scene.add(ring);
  const leafM = new THREE.MeshStandardMaterial({ color: 0x3d5e2c, roughness: 0.8 }), potM = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.5 });
  // истински саксии — райска птица (Sketchfab, CC BY — assets/heavy/plants/CREDITS.txt): до скрина и в ъглите до прозорците
  for (const [n, x, z, h] of [['paradise', -2.2, ROOM_BACK + 0.55, 1.85], ['paradise', 2.2, ROOM_BACK + 0.55, 1.85], ['paradise', -ROOM_W + 0.7, ROOM_BACK + 1.3, 1.55], ['paradise', ROOM_W - 0.7, ROOM_BACK + 1.3, 1.55]]) {
    loader.loadAsync(`assets/heavy/plants/${n}.glb`).then(g => {
      const m = g.scene; m.scale.setScalar(h); m.position.set(x, 0, z); m.rotation.y = x * 1.7;
      m.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); scene.add(m);
    }).catch(() => plant(scene, x, z, leafM, potM));
  }
  // таванът: светещ корниз над масата
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W * 2, D), new THREE.MeshStandardMaterial({ color: 0xe9e2d6, roughness: 1, emissive: 0x6b6458 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, cz); scene.add(ceil);
  const cove = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.04, 9), new THREE.MeshStandardMaterial({ color: 0xfff6e6, emissive: 0xfff0d8, emissiveIntensity: 1.2 }));
  cove.position.set(0, H - 0.02, 0.4); scene.add(cove);
  // прозорците отстрани: град (снимка или нарисуван), рамки, мраморни колони
  const frameM = new THREE.MeshStandardMaterial({ color: 0x2a2620, metalness: 0.7, roughness: 0.35 });
  for (const side of [-1, 1]) {
    const mat = new THREE.MeshBasicMaterial({ map: skyline(side < 0 ? 7 : 19), toneMapped: false });
    new THREE.TextureLoader().load(`assets/ui/boardroom/window-${side < 0 ? 'l' : 'r'}.webp`, t => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.x = 2; t.anisotropy = 4; mat.map = t; mat.needsUpdate = true; }, undefined, () => {});   // снимката е ~1,8:1, стената — 3,6:1 → два пъти (шевът е под средната рамка)
    const win = new THREE.Mesh(new THREE.PlaneGeometry(D, H), mat); win.position.set(side * ROOM_W, H / 2, cz); win.rotation.y = -side * Math.PI / 2; scene.add(win);
    for (let z = ROOM_BACK; z <= ROOM_FRONT + 0.01; z += D / 8) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, H, 0.1), frameM); m.position.set(side * (ROOM_W - 0.06), H / 2, z); scene.add(m); }
    for (const y of [0.05, H - 0.05]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, D), frameM); m.position.set(side * (ROOM_W - 0.07), y, cz); scene.add(m); }
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.6, H, 0.6), marbleM); col.position.set(side * (ROOM_W - 0.3), H / 2, ROOM_BACK + 0.3); scene.add(col);
  }
  // масата: правоъгълна, полиран орех, тъмна лента по средата, два пиедестала със златен кант
  const wood = walnutTex(); wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.rotation = 0;
  const topM = new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const top = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(TABLE_W, TABLE_L, 0.14), { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3 }), topM);
  top.rotation.x = -Math.PI / 2; top.position.y = TABLE_H - 0.06; top.castShadow = top.receiveShadow = true; scene.add(top);
  // UV-тата на ExtrudeGeometry са в метри — дървото се повтаря по дължината
  wood.repeat.set(0.4, 0.14);
  const inlM = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.25, metalness: 0.4 });
  for (let z = -TABLE_L / 2 + 0.7; z < TABLE_L / 2 - 0.6; z += 1.0) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.006, 0.9), inlM); s.position.set(0, TABLE_H + 0.022, z + 0.45); scene.add(s); }
  const legM = new THREE.MeshStandardMaterial({ map: walnutTex(), roughness: 0.4 });
  for (const z of [-2.1, 2.1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1.0, TABLE_H - 0.08, 1.4), legM); leg.position.set(0, (TABLE_H - 0.08) / 2, z); leg.castShadow = true; scene.add(leg);
    const k = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.04, 1.44), gold); k.position.set(0, 0.03, z); scene.add(k);
  }
  // начело (откъм камерата): кожената подложка на председателя
  const blot = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.012, 0.55), new THREE.MeshStandardMaterial({ color: 0x232325, roughness: 0.6 }));
  blot.position.set(0, TABLE_H + 0.026, TABLE_L / 2 - 0.4); scene.add(blot);
  const leather = new THREE.MeshStandardMaterial({ color: 0x1f3352, roughness: 0.5 }), metal = new THREE.MeshStandardMaterial({ color: 0xb8bdc4, metalness: 0.9, roughness: 0.25 });
  return { leather, metal, gold };
}
// пред всяко място: кожена папка с името, чаша вода на златна подложка
const glassM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.006, ior: 1.5, clearcoat: 1, envMapIntensity: 2.2, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
const waterM = new THREE.MeshPhysicalMaterial({ color: 0xcfe9f7, metalness: 0, roughness: 0.02, transmission: 0.9, thickness: 0.05, ior: 1.33, envMapIntensity: 1.6, transparent: true, opacity: 0.7 });
// профилът на чашата (радиус, височина в m): дебело дъно, леко разширена нагоре, ръбът — двойна стена
const GLASS = new THREE.LatheGeometry([[0, 0], [0.028, 0], [0.031, 0.004], [0.032, 0.014], [0.037, 0.115], [0.0385, 0.118], [0.0365, 0.118], [0.0345, 0.016], [0, 0.014]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
const WATER = new THREE.LatheGeometry([[0, 0.014], [0.034, 0.016], [0.0355, 0.082], [0, 0.082]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
// 🏛️ медальонът на групата в средата на масата: знакът в цвета ѝ и името по ръба (o.brand = { nm, col, ico, group })
function groupMedal(scene, b, gold) {
  const t = canvasTex(1024, 1024, (g, w, h) => {
    const c = w / 2, bg = g.createRadialGradient(c, c, 40, c, c, c);
    bg.addColorStop(0, '#1b2f57'); bg.addColorStop(1, '#0c1730'); g.fillStyle = bg; g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
    g.strokeStyle = b.col || '#c9a24a'; g.lineWidth = 14; g.beginPath(); g.arc(c, c, c - 120, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#d9b45e'; g.lineWidth = 6; g.beginPath(); g.arc(c, c, c - 22, 0, Math.PI * 2); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '300px system-ui, "Noto Color Emoji", sans-serif'; g.fillText(b.ico || '🏛️', c, c + 10);
    // името — по горния ръб, „· ХОЛДИНГ ·“ — по долния
    const arc = (txt, r, top) => {
      g.font = '800 64px system-ui, sans-serif'; g.fillStyle = '#e8c878';
      const chars = [...txt], step = 0.105, a0 = (top ? -Math.PI / 2 : Math.PI / 2) - (top ? 1 : -1) * step * (chars.length - 1) / 2;
      chars.forEach((ch, i) => { const a = a0 + (top ? 1 : -1) * step * i; g.save(); g.translate(c + Math.cos(a) * r, c + Math.sin(a) * r); g.rotate(a + (top ? Math.PI / 2 : -Math.PI / 2)); g.fillText(ch, 0, 0); g.restore(); });
    };
    arc((b.group || b.nm || '').toUpperCase(), c - 70, true); arc('· ХОЛДИНГ ·', c - 70, false);
  });
  const R = 0.72;
  const m = new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }));
  m.rotation.x = -Math.PI / 2; m.position.set(0, TABLE_H + 0.031, 0); scene.add(m);   // горният ръб на картинката — към картата: името се чете от председателя
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.018, 12, 80), gold); rim.rotation.x = -Math.PI / 2; rim.position.set(0, TABLE_H + 0.03, 0); scene.add(rim);
}
function seatProps(scene, side, z, name, sub, gold, k) {
  const fold = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.014, 0.46), [null, null, new THREE.MeshStandardMaterial({ map: folderTex(name, sub, k), roughness: 0.55 }), null, null, null].map(m => m || new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.6 })));
  if (side) { fold.position.set(side * (TABLE_W / 2 - 0.32), TABLE_H + 0.03, z); fold.rotation.y = side < 0 ? -Math.PI / 2 : Math.PI / 2; }
  else fold.position.set(0, TABLE_H + 0.03, -TABLE_L / 2 + 0.34);   // начело
  fold.castShadow = true; scene.add(fold);
  const cz = side ? z + 0.42 : -TABLE_L / 2 + 0.3, cx = side ? side * (TABLE_W / 2 - 0.62) : 0.42;
  const coaster = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.008, 24), gold); coaster.position.set(cx, TABLE_H + 0.027, cz); scene.add(coaster);
  const glass = new THREE.Mesh(GLASS, glassM); glass.position.set(cx, TABLE_H + 0.031, cz); glass.renderOrder = 2; scene.add(glass);
  const water = new THREE.Mesh(WATER, waterM); water.position.copy(glass.position); water.renderOrder = 1; scene.add(water);
}

// ---- залата
// o: { title, brand: { nm, col, ico, group }, proposals(): [{ id, dir, ico, text, cost, can }], onDecide(id, 'yes'|'no'|'later'), seats(): [{ k, ico, company, what, open, director, lv, lvMax, inc, bonus, bonusPct, up: {cost, can}|null, hire: {cost, can}|null }], fmt, onUp(k), onHire(k), sound(n) }
export function openBoardroom(o) {
  document.getElementById('boardRoom')?.remove();
  if (!document.getElementById('boardRoomCss')) { const s = document.createElement('style'); s.id = 'boardRoomCss'; s.textContent = css; document.head.appendChild(s); }
  const el = document.createElement('div'); el.id = 'boardRoom';
  el.innerHTML = `<div class="top"><span>🏛️ Директорската зала<small></small></span><button class="cfg" style="display:none">⚙️ Бюджети и автопилот</button><button class="x" title="Затвори (Esc)">✕</button></div><div class="set"></div><div class="load">👔 Директорите влизат…</div><div class="tip"></div><div class="bnav"><button class="pv" title="Предишното">‹</button><span>📋 Предложение <b></b></span><button class="nx" title="Следващото">›</button></div><div class="scr"></div><div class="card"></div><div class="hint">🖱️ Клик на директор — доклад · влачи — обиколи масата</div>`;
  el.querySelector('.top small').textContent = o.title || '';
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.prepend(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xdbe7f1);
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const cam = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 60);
  cam.position.set(0, 1.75, TABLE_L / 2 + 2.6);   // от мястото на председателя, към картата
  const ctl = new OrbitControls(cam, renderer.domElement);
  ctl.target.set(0, 1.15, -3); ctl.enableDamping = true; ctl.enablePan = false; ctl.minDistance = 2.5; ctl.maxDistance = 8; ctl.maxPolarAngle = 1.55; ctl.minPolarAngle = 0.6; ctl.update();
  scene.add(new THREE.HemisphereLight(0xf4f8ff, 0x6d5c48, 0.8));
  const sun = new THREE.DirectionalLight(0xfff2de, 1.6); sun.position.set(9, 6, 2);   // дневна светлина откъм десните прозорци sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 25 }); sun.shadow.bias = -0.0004; scene.add(sun);
  const fill = new THREE.DirectionalLight(0xe6efff, 0.6); fill.position.set(-9, 5, 3); scene.add(fill);
  for (const z of [-2.4, 0, 2.4]) { const p = new THREE.PointLight(0xfff0d8, 1.6, 6, 1.6); p.position.set(0, 3.3, z); scene.add(p); }
  const { leather, metal, gold } = buildRoom(scene);
  if (o.brand) groupMedal(scene, o.brand, gold);
  // холограмата над медальона (boardholo.js): държавата, градовете и бюджетът на текущото предложение
  const holo = createHolo(scene, { fmt: n => (o.fmt ? o.fmt(Math.round(n)) : Math.round(n).toLocaleString('bg-BG')), base: new THREE.Vector3(0, TABLE_H + 0.14, 0) });

  const tip = el.querySelector('.tip'), card = el.querySelector('.card'), hits = [], people = [];
  let sel = null, shut = false, raf = 0, nextChat = 4;
  const clock = new THREE.Clock();
  const seatsNow = () => o.seats();
  // столове и табелки за всички дружества; директорите — където има назначен
  const list = seatsNow();
  list.forEach((s, i) => {
    const [side, z] = SEATS[i] || SEATS[SEATS.length - 1], x = side * SIT_X;
    const ch = chair(leather, metal, s.open ? s.k : null); ch.position.set(x, 0, z); ch.rotation.y = seatRy(side); scene.add(ch);
    s.chair = ch;
    const sub = !s.open ? '🔒 още не е основано' : s.director ? s.company : '👔 свободно място';
    seatProps(scene, side, z, s.director || s.company, sub, gold, s.open ? s.k : null);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.9), new THREE.MeshBasicMaterial()); hit.visible = false;
    hit.position.set(x, 0.85, z); hit.userData.seat = i; scene.add(hit); hits.push(hit);
  });

  // директорите идват асинхронно: стаята се вижда веднага
  loadClips().then(async clips => {
    const pick = (...n) => n.map(x => clips[x]).filter(Boolean);
    await Promise.all(list.map(async (s, i) => {
      const mk = s.director && DIR_MODEL[s.k]; if (!mk || !HAVE.has(mk)) return;
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
      wrap.rotation.y = seatRy(side); wrap.position.set(side * SIT_X, 0, z); wrap.updateMatrixWorld(true);
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
  const scr = el.querySelector('.scr'), nav = el.querySelector('.bnav'), aim = new THREE.Vector3(0, 1.15, -3), hp = new THREE.Vector3();
  let props = [], qi = 0, scrSeat = -1;
  function board(go = qi) {
    clearBadges();
    props = o.proposals ? o.proposals() : [];
    nav.style.display = props.length ? 'flex' : 'none';
    holo.show(props.length ? props[(go + props.length) % props.length] : null);
    if (!props.length) { scr.classList.remove('on'); setTimeout(() => { if (!props.length) scr.style.display = 'none'; }, 350); scrSeat = -1; aim.set(0, 1.15, -3); return; }
    qi = (go + props.length) % props.length;
    const p = props[qi], i = list.findIndex(s => s.k === p.dir), s = list[i];
    nav.querySelector('b').textContent = `${qi + 1} / ${props.length}`;
    if (p.info) {   // 🏦 докладът на банката — винаги първи: какво имаме и какво може да се отпусне; само „Продължи →“
      scr.innerHTML = `<div class="hd"><span>🏦 Докладът на банката</span><span>${qi + 1} / ${props.length}</span></div><div class="who"></div><div class="tx"></div>${p.avail != null ? `<div class="cost">💶 за инвестиции: ${f(p.avail)} €${p.reserve ? ` · резерв ${f(p.reserve)} €` : ''}</div>` : ''}<div class="row"><button class="y">Продължи →</button></div>`;
      scr.querySelector('.y').onclick = () => board(qi + 1);
    } else {
      const fit = p.inBudget == null ? '' : p.inBudget ? '<div class="fit" style="color:#5fd38a;font-weight:700;margin:-4px 0 8px">✅ в рамките на бюджета за инвестиции</div>' : '<div class="fit" style="color:#ffb347;font-weight:700;margin:-4px 0 8px">⚠️ над бюджета за инвестиции</div>';
      scr.innerHTML = `<div class="hd"><span>📋 Предложение към борда</span><span>${qi + 1} / ${props.length}</span></div><div class="who"></div><div class="tx"></div>${p.cost ? `<div class="cost">💶 ${f(p.cost)} €</div>` : ''}${fit}<div class="row"><button class="y">✓ Да</button><button class="n">✖ Не</button><button class="l">⏳ По-късно</button></div>`;
      const y = scr.querySelector('.y'); y.disabled = p.can === false; if (y.disabled) y.title = 'Нямаш достатъчно пари';
      for (const [c, a] of [['y', 'yes'], ['n', 'no'], ['l', 'later']]) scr.querySelector('.' + c).onclick = () => { const r = o.onDecide && o.onDecide(p.id, a); if (r && r.need === 'vote') showVote(r); else after(a === 'yes' ? 'ok' : a); };   // решеното изчезва — на същото място идва следващото
    }
    scr.querySelector('.who').textContent = `${p.ico || s?.ico || ''} ${s?.director || s?.company || ''}`;
    scr.querySelector('.tx').textContent = p.text;
    scrSeat = i; card.classList.remove('on'); sel = i;
    scr.style.display = 'block'; scr.classList.remove('on'); requestAnimationFrame(() => requestAnimationFrame(() => scr.classList.add('on')));
    if (i >= 0) present(i);
  }
  // 🗳️ гласуването (банката възрази — boardlogic.js): над всеки директор ✋✅ / ✋❌, „за“ вдигат ръка; на екрана — резултатът и решението ти
  const badges = [];
  function clearBadges() { badges.forEach(b => b.el.remove()); badges.length = 0; }
  function showVote(r) {
    const { v, p } = r; clearBadges();
    const res = v.passed ? ['приема се', '#5fd38a'] : v.tie ? ['равен глас — решаваш ти', '#ffd54a'] : ['отхвърля се', '#ff6b6b'];
    scr.innerHTML = `<div class="hd"><span>🗳️ Гласуване на борда</span><span>${v.yes} : ${v.no}</span></div><div class="tx"></div><div class="votes"></div><div class="res" style="color:${res[1]}">${v.yes} : ${v.no} — ${res[0]}</div><div class="row"></div>`;
    scr.querySelector('.tx').textContent = `🏦 Банката възрази: ${v.bank.why}. „${p.text}“${p.cost ? ` (${f(p.cost)} €)` : ''}`;
    const vs = scr.querySelector('.votes');
    for (const x of v.votes) { const d = document.createElement('div'), m = document.createElement('b'); m.textContent = x.yes ? '✔ ' : '✖ '; m.style.color = x.yes ? '#43d17a' : '#ff4d4d'; m.style.fontWeight = '900'; d.appendChild(m); d.appendChild(document.createTextNode(`${x.name} — ${x.why}`)); vs.appendChild(d); }   // ✖ против — червено, ✔ за — зелено (емоджито ❌ излизаше сиво „×“)
    const row = scr.querySelector('.row');
    const btn = (t, how, y) => { const b = document.createElement('button'); b.textContent = t; if (y) b.className = 'y'; b.onclick = () => { o.onResolve && o.onResolve(p.id, how); after(how === 'drop' ? 'later' : 'ok'); }; row.appendChild(b); };
    if (v.passed || v.tie) btn(v.tie ? '✓ Решавам „за“' : '✓ Изпълни', 'pass', true); else btn('⚖️ Наложи (вето)', 'veto', true);
    btn('🏦 С кредит', 'loan'); btn('⏳ Отложи', 'drop');
    for (const x of v.votes) {
      const i = list.findIndex(s => s.k === x.dir); if (i < 0) continue;
      const el2 = document.createElement('div'); el2.className = 'vb ' + (x.yes ? 'y' : 'n'); el2.textContent = x.yes ? '✋ за' : '✖ против'; el.insertBefore(el2, scr); badges.push({ el: el2, i });   // под екрана, да не го закриват
      const q = people.find(z => z.i === i); if (q && x.yes) { q.busy = 0; play(q, q.point[0], true); }   // „за“ — вдигат ръка
    }
    o.sound && o.sound('click');
  }
  const headOf = (i, out) => { const q = people.find(z => z.i === i), h = q && q.m.getObjectByName('mixamorigHead'); if (h) h.getWorldPosition(out); else { const [side, z] = SEATS[i]; out.set(side * SIT_X, 1.25, z); } return out; };
  const bp = new THREE.Vector3();
  function placeBadges() {
    for (const b of badges) {
      headOf(b.i, bp); bp.y += 0.22; bp.project(cam);
      b.el.style.display = bp.z > 1 ? 'none' : ''; b.el.style.left = (bp.x + 1) / 2 * innerWidth + 'px'; b.el.style.top = (1 - bp.y) / 2 * innerHeight + 'px';
    }
  }
  // ⚙️ бюджети и автопилот (boardlogic.js) — панел в залата
  const cfg = el.querySelector('.cfg'), setEl = el.querySelector('.set');
  const fillSet = () => { setEl.innerHTML = o.settings(); o.bindSettings && o.bindSettings(setEl, fillSet); };
  if (o.settings && o.settings()) { cfg.style.display = ''; cfg.onclick = () => { setEl.classList.toggle('on'); if (setEl.classList.contains('on')) fillSet(); }; }
  // решението: холограмата светва (зелено / кехлибарено / червено) и след миг идва следващото
  let afterT = 0;
  function after(kind) { holo.flash(kind); scr.querySelectorAll('button').forEach(b => b.disabled = true); clearTimeout(afterT); afterT = setTimeout(() => !shut && board(qi), 1100); }
  nav.querySelector('.pv').onclick = () => board(qi - 1);
  nav.querySelector('.nx').onclick = () => board(qi + 1);
  // екранът следва главата на директора (или стола, ако няма модел); камерата бавно се обръща към него
  function placeScreen(dt) {
    if (scrSeat < 0) { ctl.target.lerp(aim, 1 - Math.exp(-dt * 1.5)); return; }
    const p = people.find(q => q.i === scrSeat), h = p && p.m.getObjectByName('mixamorigHead');
    if (h) h.getWorldPosition(hp); else { const [side, z] = SEATS[scrSeat]; hp.set(side * SIT_X, 1.25, z); }
    aim.set(hp.x * 0.25, 1.15, -3 + (hp.z + 3) * 0.4); ctl.target.lerp(aim, 1 - Math.exp(-dt * 1.5));
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
    placeScreen(dt); placeBadges(); holo.update(dt); ctl.update();
    if (cam.position.y > ROOM_H - 0.3) cam.position.y = ROOM_H - 0.3;   // камерата — под тавана
    renderer.render(scene, cam);
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
      holo.dispose(); scene.environment && scene.environment.dispose(); pmrem.dispose(); renderer.dispose(); el.remove();
    }, 450);
  }
  return { close };
}

// демо за Лабораторията: всички 7 директора на масата (+ хотелите — свободно място) и примерни предложения към борда
const DEMO_PROPS = [
  { id: 'bank:brief:1', dir: 'bank', ico: '🏦', info: true, avail: 7.4e8, reserve: 1.8e8, text: 'В касата има 920 млн. €. След месечния резерв от 180 млн. € можем да отпуснем до 740 млн. € за инвестиции този месец.' },
  { id: 'demo-air', dir: 'air', ico: '✈️', text: 'Имаме 10 гейта за ъпдейт в 4 летища — общо 720 млн. €. Да ги направим ли?', cost: 7.2e8, inBudget: true, days: 90, geo: { country: 'BGR', kind: 'airport', cities: [{ nm: 'София', lat: 42.7, lon: 23.32 }, { nm: 'Пловдив', lat: 42.15, lon: 24.75 }, { nm: 'Варна', lat: 43.21, lon: 27.91 }, { nm: 'Бургас', lat: 42.5, lon: 27.47 }] } },
  { id: 'demo-hotel', dir: 'hotel', ico: '🏨', text: 'Предлагам два нови хотела в Испания — в Мадрид и Барселона.', cost: 1.8e8, inBudget: true, days: 120, income: 2.4e6, geo: { country: 'ESP', kind: 'hotel', cities: [{ nm: 'Мадрид', lat: 40.42, lon: -3.7 }, { nm: 'Барселона', lat: 41.39, lon: 2.17 }] } },
  { id: 'demo-rail', dir: 'rail', ico: '🚆', text: 'Да построим 24 нови линии и да купим 22 влака?', cost: 3.2e7, inBudget: false },
  { id: 'demo-oil', dir: 'oil', ico: '🛢️', text: 'Договор за доставка на гориво: Шанхай — 2 млн. барела, +18 млн. € за 60 дни. Приемаме ли?', cost: 0 },
  { id: 'demo-hw', dir: 'hw', ico: '🛣️', text: 'За 5-те нови филиала няма мрежа — да строим аутобани за 3 млн. € и да купим 52 ТИР-а?', cost: 3e6, inBudget: true, days: 60, geo: { country: 'DEU', kind: 'route', cities: [{ nm: 'Берлин', lat: 52.52, lon: 13.4 }, { nm: 'Хамбург', lat: 53.55, lon: 9.99 }, { nm: 'Мюнхен', lat: 48.14, lon: 11.58 }, { nm: 'Кьолн', lat: 50.94, lon: 6.96 }, { nm: 'Франкфурт', lat: 50.11, lon: 8.68 }], route: [[0, 1], [0, 2], [3, 4], [4, 2]] } },
  { id: 'demo-bank', dir: 'bank', ico: '🏦', text: 'Дали сме 22 млрд. € заеми; има искания за още 12 млрд. Да ги одобрим ли?', cost: 0 },
];
export function demoBoardroom() {
  const C = [['con', '🏗️', 'Констръкшън', 'Ивайло Петров', 5, 2.1e6], ['hw', '🛣️', 'Толроуд', 'Надя Иванова', 5, 1.4e6], ['rail', '🚆', 'Рейл', 'Мария Стоянова', 5, 9.8e5], ['sea', '🚢', 'Оушън Експрес', 'Стефан Колев', 5, 1.1e6],
    ['air', '✈️', 'Флайеър', 'Елена Димитрова', 5, 1.6e6], ['hotel', '🏨', 'Хотелс', 'Георги Николов', 5, 7.2e5], ['oil', '🛢️', 'Петролиум', 'Вера Ангелова', 5, 3.4e6], ['bank', '🏦', 'Банк', 'Борис Тодоров', 5, 2.7e6], ['glob', '🌍', 'Глобъл Ризортс & Констръкшън', null, 0, 0]];
  return openBoardroom({
    title: 'Титан Груп — демо', brand: { nm: 'Титан', col: '#4fc3f7', ico: '🗿', group: 'Титан Груп' },
    proposals: () => DEMO_PROPS.filter(p => !p.done),
    onDecide: (id, a) => {
      const p = DEMO_PROPS.find(q => q.id === id); if (!p) return null;
      if (a === 'yes' && id === 'demo-air') return { need: 'vote', p, v: { bank: { why: 'изяжда 72% от касата (над 40%)' }, yes: 3, no: 3, tie: true, passed: false, votes: [
        { dir: 'air', name: 'Елена Димитрова', yes: true, why: 'моето предложение' }, { dir: 'bank', name: 'Борис Тодоров', yes: false, why: 'рисково: изяжда 72% от касата' },
        { dir: 'rail', name: 'Мария Стоянова', yes: false, why: 'чакат 32 млн. € за Титан Рейл' }, { dir: 'con', name: 'Ивайло Петров', yes: true, why: 'полезно за холдинга' },
        { dir: 'sea', name: 'Стефан Колев', yes: true, why: 'полезно за холдинга' }, { dir: 'oil', name: 'Вера Ангелова', yes: false, why: 'не сега' }] } };
      p.done = a; return null;
    },
    onResolve: (id, how) => { const p = DEMO_PROPS.find(q => q.id === id); if (p) p.done = how; },
    seats: () => C.map(([k, ico, suf, d, lv, inc]) => ({ k, ico, company: 'Титан ' + suf, what: '', open: true, director: d, lv, lvMax: 5, inc, bonus: inc * (lv * 0.1 + (d ? 0.15 : 0)), bonusPct: Math.round((lv * 0.1 + (d ? 0.15 : 0)) * 100), up: lv < 5 ? { cost: 5e6, can: true } : null, hire: !d && lv >= 5 ? { cost: 4e6, can: true } : null })),
  });
}
