// directors3d.js — 🏛️ Директорската зала: 3D заседателна маса с назначените директори (Meshy → Mixamo риг → Blender → glb).
// Моделите: assets/heavy/directors/<име>.glb (само тяло и скелет), клиповете — общи в clips.glb (скелетът на Вера, имената на костите са едни и същи).
// Седят около масата, дишат и си говорят; клик на директор — посочва и докладва (картата долу вдясно). Зад feature('boardroom') (вика се от group.js).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createHolo } from './boardholo.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildPresRoom } from './presrooms.js';   // 🇺🇸/🇷🇺 президентските зали (Министерският съвет)
import { createRoomSound } from './roomsound.js';   // шум на залата, хартия, чукче, аплодисменти, говор на глас

const DIR = 'assets/heavy/directors/';
const SIT_HIP = [0, -1, -57];
// поза в покой по директор (иначе — редуване по място): ръцете на масата или в скута
const REST = { boris: ['Sit_Table_Idle'], elena: ['Sit_Table_Idle'], vera: ['Sit_Breathing'], georgi: ['Sit_Breathing'], maria: ['Sit_Table_Idle'], stefan: ['Sit_Breathing'], nadya: ['Sit_Table_Idle'], ivaylo: ['Sit_Table_Idle'], mayor: ['Sit_Breathing'], glob: ['Sit_Table_Idle'] };   // ханшът в седнала поза (единиците на скелета, см) — по „Sit_Meeting“ / „Sit_Breathing“
// дружество → модел; хотелите (Георги Николов) още нямат модел — столът стои празен с табелката
export const DIR_MODEL = { con: 'ivaylo', hw: 'nadya', rail: 'maria', sea: 'stefan', air: 'elena', hotel: 'georgi', oil: 'vera', bank: 'boris', glob: 'glob', mayor: 'mayor' };
const TEMP_MODEL = { mayor: 'maria', glob: 'ivaylo' };   // временен аватар, докато потребителят направи истинския в Meshy
const LOGOS = new Set(['con', 'hw', 'rail', 'sea', 'air', 'hotel', 'oil', 'bank', 'glob']);   // assets/ui/subs/<k>.webp   // georgi/glob — от потребителя (Meshy); докато ги няма — празен стол
const FEMALE = new Set(['nadya', 'maria', 'elena', 'vera', 'mayor']);
const HAVE = new Set(['ivaylo', 'nadya', 'maria', 'stefan', 'elena', 'vera', 'boris', 'georgi', 'mayor', 'glob']);   // моделите, които вече са в assets/heavy/directors (без 404 за останалите)
// столовете: по 4 от двете страни на масата (x = ±), от прозореца към председателя
// …и девето — начело откъм картата (side 0): директорът на Глобъл, срещу председателя
const SEATS = [[-1, -2.7], [1, -2.7], [-1, -0.9], [1, -0.9], [-1, 0.9], [1, 0.9], [-1, 2.7], [1, 2.7], [0, -4.25, -0.5], [0, -4.25, 0.5], [0, -4.25]];   // [10] — начело в средата (министър-председателят)   // начело — Глобъл и градоначалникът на Империал Сити (10-ото място)
const seatX = i => { const [side, , dx] = SEATS[i] || SEATS[SEATS.length - 1]; return side * SIT_X + (dx || 0); };
const SIT_X = 1.66, TABLE_W = 2.4, TABLE_L = 7.4, TABLE_H = 0.7, SCALE = 0.9, TURN = 0.3;   // TURN — директорите са леко обърнати към председателя
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
#boardRoom .top .tg { pointer-events:auto; font:16px system-ui, sans-serif; border:0; border-radius:10px; padding:7px 10px; background:rgba(255,255,255,.14); color:#fff; cursor:pointer; }
#boardRoom .top .tg.off { opacity:.4; text-decoration:line-through; }
#boardRoom .top .hn { font-style:normal; }
#boardRoom .top .cfg { pointer-events:auto; font:700 14px system-ui, sans-serif; border:0; border-radius:10px; padding:8px 12px; background:rgba(255,255,255,.14); color:#fff; cursor:pointer; }
#boardRoom .set { position:absolute; left:16px; top:64px; width:min(560px, calc(100vw - 32px)); max-height:calc(100vh - 120px); overflow:auto; display:none; background:rgba(12,16,24,.94); border:1px solid rgba(255,255,255,.14); border-radius:14px; padding:8px; color:#d6dbe3; }
#boardRoom .set.on { display:block; }
#boardRoom .scr.wide { width:min(620px, 92vw); max-height:calc(100vh - 140px); overflow:auto; }
#boardRoom .scr .rep .card { display:block; position:static; width:auto; background:transparent; border:0; padding:0; margin:0; box-shadow:none; }
#boardRoom .scr .rep .meta { color:#cfe3f5; }
#boardRoom .scr .q { margin:2px 0; font-size:13px; } #boardRoom .scr .q b { color:#8fd0ff; }
#boardRoom .scr .fit { font-weight:700; margin:6px 0 8px; }
#boardRoom .scr .fin { margin:6px 0 10px; font-size:13px; } #boardRoom .scr .fin div { display:flex; justify-content:space-between; gap:12px; padding:2px 0; border-bottom:1px solid rgba(255,255,255,.07); }
#boardRoom .vb.c { border:2px solid #ffb347; }
#boardRoom .scr button.vt { background:rgba(95,184,255,.18); color:#cfeaff; } #boardRoom .scr button.vt.imp { background:#5fb8ff; color:#08131f; flex-basis:100%; }
#boardRoom .bnav { position:absolute; left:50%; top:12px; transform:translateX(-50%); display:none; align-items:center; gap:8px; padding:5px 8px; border-radius:999px; background:rgba(0,0,0,.6); border:1px solid rgba(95,184,255,.5); color:#fff; font:700 14px system-ui, sans-serif; }
#boardRoom .bnav button { border:0; border-radius:999px; width:30px; height:30px; background:rgba(255,255,255,.14); color:#fff; font:800 16px system-ui, sans-serif; cursor:pointer; }
@media (max-width:640px) { #boardRoom .hint { display:none; } #boardRoom .bnav { top:56px; } }
`;

// ---- моделите и клиповете се зареждат веднъж (после само се добавят в новата сцена)
const loader = new GLTFLoader();
const cache = {};
const CLIPS_V = 3;   // вдигни, когато clips.glb се смени (иначе браузърът пази стария)
const MODEL_V = { elena: 4, maria: 3, mayor: 3, nadya: 3, vera: 3, boris: 2, georgi: 2, glob: 2, ivaylo: 2, stefan: 2 };   // вдигни за директор, чийто .glb е сменен (поправените модели — иначе браузърът пази стария)
const loadGlb = n => cache[n] || (cache[n] = loader.loadAsync(DIR + n + '.glb' + (n === 'clips' ? `?v=${CLIPS_V}` : MODEL_V[n] ? `?v=${MODEL_V[n]}` : '')));
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
  // гласуването (вдигната ръка, клатене на пръст) е записано прав — от тях взимаме само горната част на тялото, а ханшът и краката
  // идват от седналото дишане; иначе директорът се изправя и потъва в пода
  const UPPER = /Spine|Neck|Head|Shoulder|Arm|Hand/, seat = out.Sit_Breathing;
  for (const n of ['Sit_Raise_Hand', 'Sit_Disapprove']) {
    const c = out[n]; if (!c || !seat) continue;
    c.tracks = [...c.tracks.filter(t => UPPER.test(t.name)), ...seat.tracks.filter(t => !UPPER.test(t.name)).map(t => t.clone())];
    c.resetDuration();
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
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.54), mat); seat.position.y = 0.47; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.92, 0.12), mat); back.position.set(0, 1.0, -0.28); back.rotation.x = -0.1; g.add(back);
  if (k) {   // бродираната емблема горе на облегалката — над главата на директора, вижда се отсреща
    const em = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), new THREE.MeshStandardMaterial({ map: logoTex(k), transparent: true, alphaTest: 0.1, roughness: 0.6 }));
    em.position.set(0, 0.3, 0.062); back.add(em);
  }
  for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.4), metal); arm.position.set(sx * 0.43, 0.56, -0.04); g.add(arm); const st = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), metal); st.position.set(sx * 0.43, 0.5, 0.05); g.add(st); }   // подлакътниците — по-ниско и по-навън, лактите не влизат в тях
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
// без transmission: той рисува цялата сцена още веднъж на всеки кадър (20 чаши = отделен пълен проход); отражението идва от envMap
const glassM = new THREE.MeshStandardMaterial({ color: 0xcfe2f0, metalness: 0.1, roughness: 0.04, envMapIntensity: 1.6, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
const waterM = new THREE.MeshStandardMaterial({ color: 0xbfe2f5, metalness: 0, roughness: 0.03, envMapIntensity: 1.8, transparent: true, opacity: 0.45, depthWrite: false });
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
    g.textAlign = 'center'; g.textBaseline = 'middle'; if (!b.img) { g.font = '300px system-ui, "Noto Color Emoji", sans-serif'; g.fillText(b.ico || '🏛️', c, c + 10); }
    // името — по горния ръб, „· ХОЛДИНГ ·“ — по долния
    const arc = (txt, r, top) => {
      g.font = '800 64px system-ui, sans-serif'; g.fillStyle = '#e8c878';
      const chars = [...txt], step = 0.105, a0 = (top ? -Math.PI / 2 : Math.PI / 2) - (top ? 1 : -1) * step * (chars.length - 1) / 2;
      chars.forEach((ch, i) => { const a = a0 + (top ? 1 : -1) * step * i; g.save(); g.translate(c + Math.cos(a) * r, c + Math.sin(a) * r); g.rotate(a + (top ? Math.PI / 2 : -Math.PI / 2)); g.fillText(ch, 0, 0); g.restore(); });
    };
    arc((b.group || b.nm || '').toUpperCase(), c - 70, true); arc(b.sub || '· ХОЛДИНГ ·', c - 70, false);
  });
  if (b.img) { const im = new Image(); im.onload = () => { const g = t.image.getContext('2d'), c = t.image.width / 2, r = c - 135, k = Math.min(2 * r / im.width, 2 * r / im.height); g.drawImage(im, c - im.width * k / 2, c - im.height * k / 2, im.width * k, im.height * k); t.needsUpdate = true; }; im.src = b.img; }   // гербът — в средата, щом се зареди
  const R = 0.72;
  const m = new THREE.Mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }));
  m.rotation.x = -Math.PI / 2; m.position.set(0, TABLE_H + 0.031, 0); scene.add(m);   // горният ръб на картинката — към картата: името се чете от председателя
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.018, 12, 80), gold); rim.rotation.x = -Math.PI / 2; rim.position.set(0, TABLE_H + 0.03, 0); scene.add(rim);
}
// неподвижните мешове с еднакъв материал → един меш (световни координати); пропуска хората, холограмата, невидимите и по-сложните
function mergeStatic(scene, skip) {
  scene.updateMatrixWorld(true);
  const by = new Map(), drop = [];
  scene.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || !o.visible || Array.isArray(o.material) || o.material.transparent || o.userData.keep) return;
    for (let p = o.parent; p; p = p.parent) if (skip.has(p) || !p.visible) return;
    const g = o.geometry, at = Object.keys(g.attributes).sort().join(','); if (g.morphAttributes && Object.keys(g.morphAttributes).length) return;
    const k = o.material.uuid + '|' + at + '|' + (g.index ? 1 : 0) + '|' + o.castShadow + o.receiveShadow;
    (by.get(k) || by.set(k, []).get(k)).push(o);
  });
  for (const list of by.values()) {
    if (list.length < 2) continue;
    const geos = list.map(o => o.geometry.clone().applyMatrix4(o.matrixWorld)); let m = null;
    try { m = mergeGeometries(geos, false); } catch { m = null; }
    geos.forEach(g => g.dispose()); if (!m) continue;
    const mesh = new THREE.Mesh(m, list[0].material); mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow; mesh.matrixAutoUpdate = false; scene.add(mesh);
    for (const o of list) { o.parent && o.parent.remove(o); drop.push(o.geometry); }
  }
  drop.forEach(g => g.dispose());
}
function seatProps(scene, side, z, name, sub, gold, k, dx = 0) {
  const fold = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.014, 0.46), [null, null, new THREE.MeshStandardMaterial({ map: folderTex(name, sub, k), roughness: 0.55 }), null, null, null].map(m => m || new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.6 })));
  if (side) { fold.position.set(side * (TABLE_W / 2 - 0.32), TABLE_H + 0.03, z); fold.rotation.y = side < 0 ? -Math.PI / 2 : Math.PI / 2; }
  else fold.position.set(dx, TABLE_H + 0.03, -TABLE_L / 2 + 0.34);   // начело
  fold.castShadow = true; scene.add(fold);
  const cz = side ? z + 0.42 : -TABLE_L / 2 + 0.3, cx = side ? side * (TABLE_W / 2 - 0.62) : dx + 0.3;
  const coaster = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.008, 24), gold); coaster.position.set(cx, TABLE_H + 0.027, cz); scene.add(coaster);
  const glass = new THREE.Mesh(GLASS, glassM); glass.position.set(cx, TABLE_H + 0.031, cz); glass.renderOrder = 2; scene.add(glass);
  const water = new THREE.Mesh(WATER, waterM); water.position.copy(glass.position); water.renderOrder = 1; scene.add(water);
}

// ⭐ „важен проект“ (подчертан бутон за гласуване): стратегическите решения — държавни/общински търгове, нови филиали, линии, летища и пристанища,
// „Стрела“, мегапроекти, кредити на държави, акции и дивиденти, придобивания и концесии — и всичко над 1 млрд. € или над половината от свободните пари.
// Рутинното (техника, ТИР-ове, влакове, самолети, кораби, надграждане, квартали, гари, линии на корабите/самолетите, петролни сделки) — не.
const KEY_IMP = /^(tender|branches|lines|short|hs|new|r66|abup|loan|cap|ipo|buyback|sdiv|div|mw|conc|acq|deal|aid|peace|crisis|hz)/;
const KEY_ROUTINE = /^(gear|trucks|trains|trainup|planes|planeup|ships|shipup|upg|districts|stations|routes|stars|resext|sell|offer|brief)/;
function isImportant(p, F) {
  if (p.important || p.mustVote || (p.geo && p.geo.kind === 'loan')) return true;
  const key = (String(p.id || '').split(':')[1] || '').replace(/[0-9.-]+$/, ''), cost = p.cost || 0, free = F ? Math.max(0, F.free) : Infinity;
  if (cost >= 1e9 || (free > 0 && cost >= free * 0.5 && cost >= 5e7)) return true;   // много пари — винаги
  if (KEY_ROUTINE.test(key)) return false;
  return KEY_IMP.test(key) || /tender/.test(key);
}

// ---- залата
// o: { title, brand: { nm, col, ico, group }, proposals(): [{ id, dir, ico, text, cost, can }], onDecide(id, 'yes'|'no'|'later'), seats(): [{ k, ico, company, what, open, director, lv, lvMax, inc, bonus, bonusPct, up: {cost, can}|null, hire: {cost, can}|null }], fmt, onUp(k), onHire(k), sound(n) }
export function openBoardroom(o) {
  document.getElementById('boardRoom')?.remove();
  if (!document.getElementById('boardRoomCss')) { const s = document.createElement('style'); s.id = 'boardRoomCss'; s.textContent = css; document.head.appendChild(s); }
  const el = document.createElement('div'); el.id = 'boardRoom';
  el.innerHTML = `<div class="top"><span><i class="hn"></i><small></small></span><button class="tg cine" title="Камерата следва говорещия">🎥</button><button class="tg voice" title="Говор на глас (български глас на браузъра)" style="display:none">🗣️</button><button class="tg snd" title="Звук на залата">🔊</button><button class="cfg" style="display:none">⚙️ Бюджети и автопилот</button><button class="x" title="Затвори (Esc)">✕</button></div><div class="set"></div><div class="load"></div><div class="tip"></div><div class="bnav"><button class="pv" title="Предишното">‹</button><span>📋 Предложение <b></b></span><button class="nx" title="Следващото">›</button></div><div class="scr"></div><div class="card"></div><div class="hint">🖱️ Клик на директор — доклад · влачи — обиколи масата · ⌨️ Enter — Да · N — Не · L — По-късно · ← →</div>`;
  const ROOM = o.room || 'corp';   // 'corp' — Директорската зала; 'us' / 'ru' — Министерският съвет в президентската зала
  el.querySelector('.top .hn').textContent = o.hallTitle || '🏛️ Директорската зала';
  if (/^⛔/.test(o.hallTitle || '')) el.querySelector('.top').style.background = 'linear-gradient(#7a0f0fcc, #0000)';   // извънредно заседание
  el.querySelector('.load').textContent = o.loadText || '👔 Директорите влизат…';
  el.querySelector('.top small').textContent = o.title || '';
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  window.__overlay3d = (window.__overlay3d || 0) + 1;
  window.__room = { renderer, get scene() { return scene; } };   // за измерване от конзолата (кадри, draw calls, триъгълници)   // game.js спира да рисува 3D града, докато залата е отворена
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
  const sun = new THREE.DirectionalLight(0xfff2de, 1.6); sun.position.set(9, 6, 2); sun.castShadow = true;   // дневна светлина откъм десните прозорци
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 25 }); sun.shadow.bias = -0.0004; scene.add(sun);
  const fill = new THREE.DirectionalLight(0xe6efff, 0.6); fill.position.set(-9, 5, 3); scene.add(fill);
  for (const z of [-2.4, 0, 2.4]) { const p = new THREE.PointLight(0xfff0d8, 1.6, 6, 1.6); p.position.set(0, 3.3, z); scene.add(p); }
  const R = ROOM === 'corp' ? buildRoom(scene) : buildPresRoom(scene, ROOM, { ROOM_W, ROOM_BACK, ROOM_FRONT, ROOM_H, TABLE_W, TABLE_L, TABLE_H, roundedRect });
  const { leather, metal, gold } = R;
  if (o.brand) groupMedal(scene, ROOM === 'corp' ? o.brand : { ...o.brand, img: `assets/heavy/presroom/${ROOM === 'ru' ? 'arms-ru' : 'seal-us'}.webp` }, gold);   // в президентските зали — гербът на Империал Сити вместо знака
  // холограмата над медальона (boardholo.js): държавата, градовете и бюджетът на текущото предложение
  const short = n => { const a = Math.abs(n), r = (v, u) => `${(n / v).toLocaleString('bg-BG', { maximumFractionDigits: a / v >= 100 ? 0 : 1 })} ${u}`; return a >= 1e12 ? r(1e12, 'трлн.') : a >= 1e9 ? r(1e9, 'млрд.') : a >= 1e6 ? r(1e6, 'млн.') : Math.round(n).toLocaleString('bg-BG'); };   // холограмата — съкратено (310 млрд., 2,9 трлн.)
  const holo = createHolo(scene, { fmt: short, base: new THREE.Vector3(0, TABLE_H + 0.14, 0) });

  const tip = el.querySelector('.tip'), card = el.querySelector('.card'), hits = [], people = [];
  let sel = null, shut = false, raf = 0, nextChat = 4;
  const clock = new THREE.Clock();
  const seatsNow = () => o.seats();
  // столове и табелки за всички дружества; директорите — където има назначен
  const list = seatsNow();
  list.forEach((s, i) => {
    s.si = s.seat ?? i; const [side, z] = SEATS[s.si] || SEATS[SEATS.length - 1], x = seatX(s.si);
    const ch = chair(leather, metal, s.logo !== false && s.open && LOGOS.has(s.k) ? s.k : null); ch.position.set(x, 0, z); ch.rotation.y = seatRy(side); scene.add(ch);
    s.chair = ch;
    const sub = !s.open ? '🔒 още не е основано' : s.director ? s.company : '👔 свободно място';
    seatProps(scene, side, z, s.director || s.company, sub, gold, s.logo !== false && s.open && LOGOS.has(s.k) ? s.k : null, (SEATS[s.si] || [])[2] || 0);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.9), new THREE.MeshBasicMaterial()); hit.visible = false;
    hit.position.set(x, 0.85, z); hit.userData.seat = i; scene.add(hit); hits.push(hit);
  });

  // директорите идват асинхронно: стаята се вижда веднага
  loadClips().then(async clips => {
    const pick = (...n) => n.map(x => clips[x]).filter(Boolean);
    await Promise.all(list.map(async (s, i) => {
      let mk = s.director && (s.model || DIR_MODEL[s.k]); if (mk && !HAVE.has(mk)) mk = TEMP_MODEL[s.k]; if (!mk || !HAVE.has(mk)) return;
      let g; try { g = await loadGlb(mk); } catch { return; }
      if (shut) return;
      const m = cloneSkinned(g.scene); m.scale.setScalar(SCALE); m.position.set(0, 0, 0); m.rotation.set(0, 0, 0);   // клонинг — един модел може да седи и като временен аватар
      m.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; c.frustumCulled = false; } });
      const [side, z] = SEATS[s.si];
      const fem = FEMALE.has(mk);
      const mixer = new THREE.AnimationMixer(m);
      // покой: ръцете почиват — на масата („Sit_Table_Idle“) или в скута / на облегалката („Sit_Breathing“); различно за всеки директор
      // (вид, темпо, начален кадър). Жестовете („Sit_Meeting_*“, „Sit_Talk_*“) — само докато директорът говори, после обратно в покой.
      const rest = pick(...(REST[mk] || (i % 3 === 1 ? ['Sit_Breathing', 'Sit_Table_Idle'] : ['Sit_Table_Idle', 'Sit_Breathing'])));
      const base = rest[0];
      const p = { s, i, m, mixer, side, z, fem, base: mixer.clipAction(base), cur: null, busy: 0 };
      p.base.timeScale = 0.85 + ((i * 37) % 10) / 33;
      p.talk = pick(...(fem ? ['Sit_Meeting_F', 'Sit_Table_Ask'] : ['Sit_Table_Ask', 'Sit_Point_Forward'])).map(c => mixer.clipAction(c));   // без „Sit_Talk_M/2“ и „Sit_Meeting_M“ — там ръцете се кръстосват и влизат една в друга пред гърдите
      p.point = pick('Sit_Point_Forward', 'Sit_Point').map(c => mixer.clipAction(c));
      [p.raise, p.nay, p.clap] = ['Sit_Raise_Hand', 'Sit_Disapprove', 'Sit_Clap'].map(n => clips[n] ? mixer.clipAction(clips[n]) : null);   // гласуването (Mixamo): вдигната ръка, клатене на пръст, ръкопляскане
      p.base.play(); p.cur = p.base; mixer.update(Math.random() * base.duration);
      // столът — под ханша от позата; тялото — обърнато към масата, ханшът на SIT_X от средата
      const wrap = new THREE.Group(); wrap.add(m); scene.add(wrap);
      wrap.rotation.y = seatRy(side); wrap.position.set(seatX(s.si), 0, z); wrap.updateMatrixWorld(true);
      const hips = m.getObjectByName('mixamorigHips'), hp = new THREE.Vector3();
      if (hips) {
        hips.getWorldPosition(hp);
        wrap.position.x += seatX(s.si) - hp.x; wrap.position.z += z - hp.z; wrap.updateMatrixWorld(true);
        hips.getWorldPosition(hp); s.chair.position.set(hp.x + side * 0.06, THREE.MathUtils.clamp(hp.y - 0.58, -0.15, 0.15), hp.z);
      }
      p.wrap = wrap; p.restTable = base.name === 'Sit_Table_Idle'; p.ikW = p.restTable ? 1 : 0;
      // ръцете на масата: в покой директорът се придърпва към масата (раменете ~18 см от ръба), столът — с него
      if (p.restTable) { m.updateMatrixWorld(true); const la = m.getObjectByName('mixamorigLeftArm'), ra = m.getObjectByName('mixamorigRightArm');
        if (la && ra) { const a = new THREE.Vector3(), b = new THREE.Vector3(); la.getWorldPosition(a); ra.getWorldPosition(b); a.add(b).multiplyScalar(0.5);
          const hx = TABLE_W / 2, hz = TABLE_L / 2, P = new THREE.Vector3(THREE.MathUtils.clamp(a.x, -hx, hx), 0, THREE.MathUtils.clamp(a.z, -hz, hz)), d = new THREE.Vector3(P.x - a.x, 0, P.z - a.z), L = d.length();
          if (L > 0.2) { d.multiplyScalar((L - 0.18) / L); wrap.position.add(d); s.chair.position.add(d); wrap.updateMatrixWorld(true); } } }
      people.push(p);
    }));
    el.querySelector('.load').style.opacity = 0; snd.ambience(true);
    mergeStatic(scene, new Set([holo.root, ...people.map(p => p.wrap)].filter(Boolean)));   // ~500 draw calls → под 150
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
  // ✋ ръцете в покой — върху масата: малко IK (CCD, мишница + предмишница) към точка над плота под китката; плавно се изключва,
  // докато директорът жестикулира (говори, гласува, ръкопляска) и се включва, когато се върне в покой
  const ikA = new THREE.Vector3(), ikB = new THREE.Vector3(), ikT = new THREE.Vector3(), ikQ = new THREE.Quaternion(), ikP = new THREE.Quaternion(), ikW0 = new THREE.Quaternion();
  // глава и шия — леко вдигнати и обърнати към целта (до ~45° встрани, без да се навеждат към плота); плавно
  const lookAt = new THREE.Vector3(), hlA = new THREE.Vector3(), hlQ = new THREE.Quaternion(), hlP = new THREE.Quaternion(), hlF = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function headLook(p, tgt, dt) {
    p.lookW = (p.lookW || 0) + (((tgt ? 1 : 0) * (p.cur === p.base ? 1 : 0.35)) - (p.lookW || 0)) * Math.min(1, dt * 2.5); if (p.lookW < 0.02 || !tgt) return;
    // само завъртане около вертикалата (без наклон: дъгата от „напред“ към съсед до теб накланяше главата към рамото) + лек кимок нагоре/надолу
    for (const [nm, k] of [['mixamorigNeck', 0.4], ['mixamorigHead', 0.6]]) {
      const b = p.m.getObjectByName(nm); if (!b) continue; b.updateMatrixWorld(true); b.getWorldPosition(hlA); b.getWorldQuaternion(hlP);
      hlF.set(0, 0, 1).applyQuaternion(hlP); const want = tgt.clone().sub(hlA);
      let yaw = Math.atan2(want.x, want.z) - Math.atan2(hlF.x, hlF.z); yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw)); yaw = THREE.MathUtils.clamp(yaw, -0.8, 0.8) * k * p.lookW;
      hlQ.setFromAxisAngle(UP, yaw); hlP.premultiply(hlQ);
      const pitch = THREE.MathUtils.clamp(Math.atan2(want.y, Math.hypot(want.x, want.z)), -0.15, 0.2) * k * p.lookW * 0.5; hlF.set(0, 0, 1).applyQuaternion(hlP); hlA.set(hlF.z, 0, -hlF.x).normalize();   // оста „дясно“ (хоризонтална)
      if (hlA.lengthSq() > 0.5) { hlQ.setFromAxisAngle(hlA, -pitch); hlP.premultiply(hlQ); }
      b.parent.getWorldQuaternion(hlQ); b.quaternion.copy(hlQ.invert().multiply(hlP)); b.updateMatrixWorld(true);
    }
  }
  function restIK(p, dt) {
    if (!p.restTable) return; p.ikW += ((p.cur === p.base ? 1 : 0) - p.ikW) * Math.min(1, dt * 3); if (p.ikW < 0.02) return;
    p.m.updateMatrixWorld(true);
    for (const S0 of ['Left', 'Right']) {
      const arm = p.m.getObjectByName(`mixamorig${S0}Arm`), fore = p.m.getObjectByName(`mixamorig${S0}ForeArm`), hand = p.m.getObjectByName(`mixamorig${S0}Hand`); if (!arm || !fore || !hand) continue;
      hand.getWorldPosition(ikT); ikT.x = THREE.MathUtils.clamp(ikT.x, -TABLE_W / 2 + 0.1, TABLE_W / 2 - 0.1); ikT.z = THREE.MathUtils.clamp(ikT.z, -TABLE_L / 2 + 0.1, TABLE_L / 2 - 0.1); ikT.y = TABLE_H + 0.035;
      for (let it = 0; it < 3; it++) for (const b of [fore, arm]) {
        b.getWorldPosition(ikA); hand.getWorldPosition(ikB); const v1 = ikB.sub(ikA).normalize(), v2 = ikT.clone().sub(ikA).normalize();
        ikQ.setFromUnitVectors(v1, v2); ikQ.slerp(ikW0.identity(), 1 - Math.min(1, p.ikW)); b.getWorldQuaternion(ikP); ikP.premultiply(ikQ);
        b.parent.getWorldQuaternion(ikQ); b.quaternion.copy(ikQ.invert().multiply(ikP)); b.updateMatrixWorld(true);
      }
      // дланта — легнала на плота: пръстите напред (по посоката на предмишницата), не нагоре
      const fin = p.m.getObjectByName(`mixamorig${S0}HandMiddle1`); if (fin) { hand.getWorldPosition(ikA); fin.getWorldPosition(ikB); fore.getWorldPosition(ikT);
        const cur = ikB.sub(ikA).normalize(), want = ikA.clone().sub(ikT); want.y = Math.min(want.y, 0) * 0.15 - 0.08 * want.length(); want.normalize();
        ikQ.setFromUnitVectors(cur, want); ikQ.slerp(ikW0.identity(), 1 - Math.min(1, p.ikW)); hand.getWorldQuaternion(ikP); ikP.premultiply(ikQ); hand.parent.getWorldQuaternion(ikQ); hand.quaternion.copy(ikQ.invert().multiply(ikP)); hand.updateMatrixWorld(true); }
    }
  }

  // картата с доклада
  const f = n => (o.fmt ? o.fmt(Math.round(n)) : Math.round(n).toLocaleString('bg-BG'));
  function say(s) {
    if (s.minister) return s.brief || 'Министерството работи по програмата на кабинета.';
    if (!s.open) return `${s.company} още не е основано. Когато стане, тук ще седне директорът му.`;
    if (!s.director) return `Мястото е свободно. Назначи директор на ${s.company} — носи още +15% от прихода всеки ден.`;
    if (s.up) return `Приходът ни е +${f(s.inc)} €/ден. Предлагам развитие до ниво ${s.lv + 1} — още +${f(s.inc * 0.1)} €/ден за холдинга.`;
    return `Работим на пълни обороти: +${f(s.inc)} €/ден, от които +${f(s.bonus)} € бонус за холдинга. Всичко е под контрол.`;
  }
  function showCard(i, quiet) {
    const s = seatsNow()[i]; if (!s) return;
    sel = i;
    if (s.minister) { card.innerHTML = '<h3></h3><div class="co"></div><div class="say"></div>'; card.querySelector('h3').textContent = s.director; card.querySelector('.co').textContent = `${s.ico} ${s.company}`; card.querySelector('.say').textContent = '„' + say(s) + '“'; card.classList.add('on'); if (!quiet) present(i); return; }
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
  // редът на заседанието: 📊 отчет за предишните решения → 🏦 Борис (парите) → предложенията → 🏦 обобщението на Борис
  function stepsNow() {
    const ps = o.proposals ? o.proposals() : [], rep = o.report ? o.report() : '', out = [];
    if (rep) out.push({ step: 'report', html: rep });
    out.push(...ps);
    if (o.summary && ps.length) out.push({ step: 'summary', dir: 'bank' });
    return out;
  }
  const B = n => Math.abs(n) >= 1e9 ? `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млрд. €` : Math.abs(n) >= 1e6 ? `${(n / 1e6).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млн. €` : `${f(n)} €`;
  const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function board(go = qi) {
    clearBadges();
    props = stepsNow();
    nav.style.display = props.length ? 'flex' : 'none';
    if (!props.length) { holo.show(null); scr.classList.remove('on'); setTimeout(() => { if (!props.length) scr.style.display = 'none'; }, 350); scrSeat = -1; aim.set(0, 1.15, -3); return; }
    qi = (go + props.length) % props.length;
    const p = props[qi], i = list.findIndex(s => s.k === (p.step === 'report' ? '' : p.dir)), s = list[i], n = `${qi + 1} / ${props.length}`;
    nav.querySelector('b').textContent = n;
    const F = o.frame ? o.frame() : null;
    holo.show(p.step === 'report' ? null : p.info || p.step === 'summary' ? { info: true, avail: F ? F.free : p.avail, reserve: F ? F.op : p.reserve } : p);
    scr.classList.toggle('wide', p.step === 'report');
    const hd = (t) => `<div class="hd"><span>${t}</span><span>${n}</span></div><div class="who"></div>`;
    if (p.step === 'report') {   // 📊 отчетът (boardlogic.reportHtml) — с бутоните удължи / пренасочи / прекрати
      scr.innerHTML = `${hd(o.reportTitle || '📊 Отчет за предишните решения')}<div class="rep"></div><div class="row"><button class="y">Продължи →</button></div>`;
      scr.querySelector('.rep').innerHTML = p.html; o.bindReport && o.bindReport(scr.querySelector('.rep'), () => board(qi));
      scr.querySelector('.y').onclick = () => board(qi + 1);
    } else if (p.info || p.step === 'summary') {   // 🏦 Борис: парите в началото, обобщението накрая
      const rows = F && p.info ? [['Налични пари', F.cash], ['Резервирани за одобрени проекти', -F.reserved], ['Оперативен резерв', -F.op], ['Достъпни за нови решения', F.free]].filter(([, v], j) => j === 0 || j === 3 || v) : [];   // без „−0 €“
      scr.innerHTML = `${hd(p.info ? (o.bankTitle || '🏦 Банката: с какво разполагаме') : '🏦 Обобщение на заседанието')}<div class="tx"></div>${rows.length ? `<div class="fin">${rows.map(([k, v], j) => `<div><span>${k}</span><b style="color:${k.startsWith('Достъпни') ? '#5fd38a' : v < 0 ? '#ffb347' : '#fff'}">${B(v)}</b></div>`).join('')}${F.loan ? `<div><span>+ свободен кредит</span><b>${B(F.loan)}</b></div>` : ''}</div>` : p.avail != null ? `<div class="cost">💶 за инвестиции: ${f(p.avail)} €${p.reserve ? ` · резерв ${f(p.reserve)} €` : ''}</div>` : ''}<div class="row"><button class="y">${p.info ? 'Продължи →' : '✓ Закрий заседанието'}</button></div>`;
      scr.querySelector('.tx').textContent = p.info ? (o.speech ? o.speech() : p.text) : o.summary();
      scr.querySelector('.y').onclick = () => { if (p.info) return board(qi + 1); cheer(); setTimeout(close, 2200); };   // 👏 закриване — с аплодисменти
    } else {   // 📋 предложение: петте въпроса — какво, защо, колко, кога, какво ще донесе
      const q = (k, v) => v ? `<div class="q"><b>${k}:</b> ${esc(v)}</div>` : '';
      const gain = p.gainTxt || (p.gain ? `+${B(p.gain)}/месец` : p.income ? `+${f(p.income)} €/ден` : '');
      const must = !!(p.mustVote && o.voteOn), Fr = o.frame ? o.frame() : null, imp = isImportant(p, Fr);
      const fit = p.inBudget == null ? '' : p.inBudget ? '<div class="fit" style="color:#5fd38a">✅ в рамките на бюджета за инвестиции</div>' : '<div class="fit" style="color:#ffb347">⚠️ над бюджета за инвестиции</div>';
      scr.innerHTML = `${hd('📋 Предложение към борда')}<div class="tx"></div>${q('Защо', p.why)}${q('Колко', p.cost ? B(p.cost) : 'без разход')}${q('Кога', p.days ? `~${p.days} дни` : '')}${q('Очакваме', gain)}${p.needsGear ? q('Условие', p.needsGear) : ''}${fit}<div class="row">${must ? `<button class="vt imp">🗳️ Решава бордът — гласуване</button>` : `<button class="y">✓ Да</button>${p.small ? `<button class="sm">½ По-малък вариант · ${B(p.small.cost)}</button>` : ''}`}<button class="n">✖ Не</button><button class="l">⏳ По-късно</button>${o.voteOn && !must ? `<button class="vt${imp ? ' imp' : ''}">${imp ? '⭐ Важен проект — 🗳️ на гласуване' : '🗳️ Подложи на гласуване'}</button>` : ''}</div>${must ? '<div class="q" style="margin-top:6px;color:#8fd0ff">🏛️ Мегапроект: само с мнозинство в борда.</div>' : ''}`;
      const vt = scr.querySelector('.vt'); if (vt) vt.onclick = () => { const r = o.voteOn(p.id); if (r) showVote(r, true); };
      const y = scr.querySelector('.y') || {}; y.disabled = p.can === false; if (y.disabled) y.title = 'Нямаш достатъчно пари';
      for (const [c, a] of [['y', 'yes'], ['sm', 'small'], ['n', 'no'], ['l', 'later']]) { const b = scr.querySelector('.' + c); if (b) b.onclick = () => { const r = o.onDecide && o.onDecide(p.id, a); if (r && r.need === 'vote') showVote(r); else { const ok = (a === 'yes' || a === 'small') && !(r && r.done === false); if (ok && imp) cheer(); after(ok ? 'ok' : a === 'yes' || a === 'small' ? 'no' : a); } }; }   // решеното изчезва — на същото място идва следващото
      scr.querySelector('.tx').textContent = `${p.ico || ''} ${p.text}`;
    }
    const bi = p.step === 'summary' || p.info ? list.findIndex(z => z.k === (o.bankKey || 'bank')) : p.step === 'report' && o.reportDir ? list.findIndex(z => z.k === o.reportDir) : i, bs = list[bi];   // отчета го чете o.reportDir (в кабинета — министър-председателят)   // парите докладва банката (в кабинета — финансовият министър)
    scr.querySelector('.who').textContent = p.step === 'report' && !(o.reportDir && bs) ? '👔 Директорите докладват' : `${bs?.ico || p.ico || ''} ${bs?.director || bs?.company || ''}`;
    scrSeat = p.step === 'report' && !(o.reportDir && bi >= 0) ? -2 : bi; card.classList.remove('on'); sel = bi;
    scr.style.display = 'block'; scr.classList.remove('on'); requestAnimationFrame(() => requestAnimationFrame(() => scr.classList.add('on')));
    if (bi >= 0) present(bi);
    snd.paper(); shot(p.step === 'report' ? -1 : bi);
    const spoken = p.step === 'report' ? '' : p.info ? (o.speech ? o.speech() : p.text) : p.step === 'summary' ? o.summary() : p.text;
    if (spoken) snd.speak(spoken, { voiceOn, female: !!(bs && people.find(q => q.i === bi)?.fem) });
  }
  // 🗳️ съвещателният вот (boardlogic.js): над всеки директор ✔ за / ◐ условно / ✖ против; решението е винаги твое
  const badges = [];
  function clearBadges() { badges.forEach(b => b.el.remove()); badges.length = 0; }
  // гласуването: директорите гласуват един по един — „за“ вдигат ръка, над всеки ✋ за / ◐ условно / ✖ против, броячът расте; накрая — резултатът и решението ти
  let voteTok = 0;
  // 👏 прието — всички ръкопляскат (и звукът на аплодисментите)
  function cheer() { snd.applause(2.2); for (const q of people) if (q.clap) { q.busy = 0; play(q, q.clap, true); } }
  function showVote(r, mine) {
    const { v, p } = r, tok = ++voteTok; clearBadges();
    scr.innerHTML = `<div class="hd"><span>🗳️ ${mine ? 'Гласуване на борда' : 'Съвещателен вот'}</span><span class="cnt">0 : 0</span></div><div class="tx"></div><div class="votes"></div><div class="res"></div><div class="row"></div>`;
    scr.querySelector('.tx').textContent = `${v.bank && !v.bank.ok ? `🏦 Банката възразява: ${v.bank.why}. ` : ''}„${p.text}“${p.cost ? ` (${B(p.cost)})` : ''}`;
    const vs = scr.querySelector('.votes'), cnt = scr.querySelector('.cnt'); let y = 0, n = 0, k = 0;
    const step = () => {
      if (shut || tok !== voteTok) return;
      const x = v.votes[k++];
      if (x) {
        x.yes ? y++ : n++; cnt.textContent = `${y} : ${n}`;
        const d = document.createElement('div'), m = document.createElement('b'); m.textContent = x.cond ? '◐ ' : x.yes ? '✔ ' : '✖ '; m.style.color = x.cond ? '#ffb347' : x.yes ? '#43d17a' : '#ff4d4d'; m.style.fontWeight = '900'; d.appendChild(m); d.appendChild(document.createTextNode(`${x.name} — ${x.why}`)); vs.appendChild(d);
        const i = list.findIndex(s => s.k === x.dir);
        if (i >= 0) {
          const el2 = document.createElement('div'); el2.className = 'vb ' + (x.cond ? 'c' : x.yes ? 'y' : 'n'); el2.textContent = x.cond ? '◐ условно' : x.yes ? '✋ за' : '✖ против'; el.insertBefore(el2, scr); badges.push({ el: el2, i });
          const q = people.find(z => z.i === i); if (q) { q.busy = 0; play(q, x.yes ? q.raise || q.point[0] : q.nay || q.talk[0], true); }   // „за“ — вдига ръка, „против“ — клати пръст
        }
        o.sound && o.sound('click');
        setTimeout(step, 650); return;
      }
      const ok = y > n;
      scr.querySelector('.res').innerHTML = `<span style="color:${ok ? '#5fd38a' : y === n ? '#ffd54a' : '#ff6b6b'}">${y} за : ${n} против — ${ok ? 'бордът подкрепя' : y === n ? 'равен глас' : 'бордът е против'}. Решението е твое.</span>`;
      const row = scr.querySelector('.row');
      const btn = (t, how, cls) => { const b = document.createElement('button'); b.textContent = t; if (cls) b.className = cls; b.onclick = () => { if (how === 'no') { o.onDecide && o.onDecide(p.id, 'no'); after('no'); return; } const rr = o.onResolve && o.onResolve(p.id, how, v), done = how !== 'drop' && !(rr && rr.done === false); if (done) cheer(); after(how === 'drop' ? 'later' : done ? 'ok' : 'no'); }; row.appendChild(b); };
      if (ok || !p.mustVote) btn(ok ? '✓ Одобри (както реши бордът)' : '✓ Одобри въпреки това', p.isSmall ? 'small' : 'pass', 'y');   // мегапроект — без мнозинство не минава
      if (p.small) btn(`½ По-малък вариант · ${B(p.small.cost)}`, 'small');
      if (v.bank && !v.bank.ok) btn('🏦 С кредит', 'loan');
      btn(ok ? '✖ Отхвърли' : '✖ Отхвърли (както реши бордът)', 'no', 'n'); btn('⏳ Отложи', 'drop', 'l');
    };
    setTimeout(step, 500);
  }
  const headOf = (i, out) => { const q = people.find(z => z.i === i), h = q && q.m.getObjectByName('mixamorigHead'); if (h) h.getWorldPosition(out); else { const si = list[i]?.si ?? i, [, z] = SEATS[si]; out.set(seatX(si), 1.25, z); } return out; };
  const bp = new THREE.Vector3();
  function placeBadges() {
    for (const b of badges) {
      headOf(b.i, bp); bp.y += 0.22; bp.project(cam);
      b.el.style.display = bp.z > 1 ? 'none' : ''; b.el.style.left = (bp.x + 1) / 2 * innerWidth + 'px'; b.el.style.top = (1 - bp.y) / 2 * innerHeight + 'px';
    }
  }
  // 🔊 звукът, 🗣️ говорът и 🎥 камерата — бутони горе; изборът се помни в браузъра
  const pref = (k, d) => { try { const v = localStorage.getItem('room.' + k); return v == null ? d : v === '1'; } catch { return d; } };
  const savePref = (k, v) => { try { localStorage.setItem('room.' + k, v ? '1' : '0'); } catch { } };
  const snd = createRoomSound(); snd.setOn(o.sfx !== false && pref('snd', true));
  let voiceOn = pref('voice', true), cine = pref('cine', true);
  const tgl = (c, v) => el.querySelector('.top .' + c).classList.toggle('off', !v);
  tgl('snd', snd.isOn()); tgl('voice', voiceOn); tgl('cine', cine);
  el.querySelector('.top .snd').onclick = () => { snd.setOn(!snd.isOn()); savePref('snd', snd.isOn()); tgl('snd', snd.isOn()); if (snd.isOn()) snd.ambience(true); };
  el.querySelector('.top .voice').onclick = () => { voiceOn = !voiceOn; savePref('voice', voiceOn); tgl('voice', voiceOn); if (!voiceOn) snd.hush(); };
  el.querySelector('.top .cine').onclick = () => { cine = !cine; savePref('cine', cine); tgl('cine', cine); shot(cine ? sel ?? -1 : -1); };
  const showVoice = () => { if (snd.canSpeak()) el.querySelector('.top .voice').style.display = ''; };
  showVoice(); setTimeout(showVoice, 1200);
  // 🎥 кинематографичната камера: плавно отива при говорещия (през масата, малко отгоре), а при отчета/края — общ план; влаченето я спира
  const OVER = { pos: new THREE.Vector3(0, 1.75, TABLE_L / 2 + 2.6), tgt: new THREE.Vector3(0, 1.15, -3) };
  let tw = null; const sp = new THREE.Vector3();
  function shot(bi) {
    if (!cine) return;
    let pos = OVER.pos.clone(), tgt = OVER.tgt.clone();
    if (bi != null && bi >= 0) {
      // среден план откъм председателя: говорещият и холограмата над масата са в кадър заедно (холограмата не застава пред лицето)
      headOf(bi, sp); tgt = sp.clone().lerp(new THREE.Vector3(0, 1.15, 0), 0.35);
      pos = new THREE.Vector3(sp.x * 0.3, 1.95, Math.min(sp.z + 3.4, TABLE_L / 2 + 2.4));
    }
    tw = { p0: cam.position.clone(), t0: ctl.target.clone(), p1: pos, t1: tgt, k: 0 };
  }
  function camStep(dt) {
    if (!tw) return; tw.k = Math.min(1, tw.k + dt / 1.4); const e = tw.k < 0.5 ? 2 * tw.k * tw.k : 1 - Math.pow(-2 * tw.k + 2, 2) / 2;
    cam.position.lerpVectors(tw.p0, tw.p1, e); ctl.target.lerpVectors(tw.t0, tw.t1, e); if (tw.k >= 1) tw = null;
  }
  ctl.addEventListener('start', () => { tw = null; });
  // ⚙️ бюджети и автопилот (boardlogic.js) — панел в залата
  const cfg = el.querySelector('.cfg'), setEl = el.querySelector('.set');
  const fillSet = () => { setEl.innerHTML = o.settings(); o.bindSettings && o.bindSettings(setEl, fillSet); };
  if (o.settings && o.settings()) { cfg.style.display = ''; cfg.onclick = () => { setEl.classList.toggle('on'); if (setEl.classList.contains('on')) fillSet(); }; }
  // решението: холограмата светва (зелено / кехлибарено / червено) и след миг идва следващото
  let afterT = 0;
  function after(kind) { if (kind === 'ok') snd.gavel(); holo.flash(kind); scr.querySelectorAll('button').forEach(b => b.disabled = true); clearTimeout(afterT); const done = props[qi]?.id; decided.add(done); afterT = setTimeout(() => !shut && board(nextStep()), 1100); }   // аплодисментите — в cheer()
  // след решение — следващото нерешено предложение (отчетът и речта на банката не се повтарят); ако няма — обобщението
  const decided = new Set();
  function nextStep() { const st = stepsNow(); let k = st.findIndex(p => p.step !== 'report' && !p.info && p.step !== 'summary' && !decided.has(p.id)); if (k < 0) k = st.findIndex(p => p.step === 'summary'); return k < 0 ? 0 : k; }
  nav.querySelector('.pv').onclick = () => board(qi - 1);
  nav.querySelector('.nx').onclick = () => board(qi + 1);
  // екранът следва главата на директора (или стола, ако няма модел); камерата бавно се обръща към него
  function placeScreen(dt) {
    if (scrSeat === -2) { aim.set(0, 1.15, -3); if (!cine) ctl.target.lerp(aim, 1 - Math.exp(-dt * 1.5)); scr.style.visibility = ''; scr.style.left = innerWidth / 2 + 'px'; scr.style.top = (scr.offsetHeight + 70) + 'px'; return; }   // отчетът — горе в средата
    if (scrSeat < 0) { if (!cine) ctl.target.lerp(aim, 1 - Math.exp(-dt * 1.5)); return; }
    const p = people.find(q => q.i === scrSeat), h = p && p.m.getObjectByName('mixamorigHead');
    if (h) h.getWorldPosition(hp); else { const si = list[scrSeat]?.si ?? scrSeat, [, z] = SEATS[si]; hp.set(seatX(si), 1.25, z); }
    aim.set(hp.x * 0.25, 1.15, -3 + (hp.z + 3) * 0.4); if (!cine) ctl.target.lerp(aim, 1 - Math.exp(-dt * 1.5));
    hp.y += 0.3; hp.project(cam);
    if (hp.z > 1) { scr.style.visibility = 'hidden'; return; }
    scr.style.visibility = '';
    const w = scr.offsetWidth, H = scr.offsetHeight;
    let px = (hp.x + 1) / 2 * innerWidth, py = (1 - hp.y) / 2 * innerHeight;
    if (cine && innerWidth > 700) { px += px < innerWidth / 2 ? -(w / 2 + 70) : w / 2 + 70; py += H / 2 + 60; if (px - w / 2 < 8 || px + w / 2 > innerWidth - 8) px = px < innerWidth / 2 ? innerWidth - w / 2 - 16 : w / 2 + 16; }   // близък план — екранът до главата, не върху лицето
    const x = THREE.MathUtils.clamp(px, w / 2 + 8, innerWidth - w / 2 - 8), y = THREE.MathUtils.clamp(py, H + 96, innerHeight - 20);
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
  // ⌨️ Enter/интервал — Да (или Продължи), N — Не, L — По-късно, ← → — предишното/следващото, Esc — затвори
  const key = e => {
    if (e.key === 'Escape') return close();
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
    const btn = c => { const b = scr.querySelector(c); if (b && !b.disabled && scr.style.display !== 'none') { b.click(); e.preventDefault(); } };
    if (e.key === 'Enter' || e.key === ' ') btn('.row button.y'); else if (/^[nн]$/i.test(e.key)) btn('.row button.n'); else if (/^[lл]$/i.test(e.key)) btn('.row button.l');
    else if (e.key === 'ArrowRight') { board(qi + 1); e.preventDefault(); } else if (e.key === 'ArrowLeft') { board(qi - 1); e.preventDefault(); }
  };
  addEventListener('keydown', key);
  el.querySelector('.x').onclick = () => close();

  function loop() {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    // от време на време някой взима думата
    nextChat -= dt;
    if (nextChat <= 0 && people.length) {
      nextChat = 9 + Math.random() * 9;   // по-рядко: жестовете — само на говорещия
      const free = people.filter(p => p.busy <= 0 && p.i !== sel); const p = free[(Math.random() * free.length) | 0];
      if (p) play(p, p.talk[(Math.random() * p.talk.length) | 0], true);
    }
    // 👀 към кого гледат: говорещия (избрания / жестикулиращия), иначе — холограмата над масата
    const talker = people.find(q => q.i === sel) || people.find(q => q.busy > 0);
    if (talker) talker.m.getObjectByName('mixamorigHead')?.getWorldPosition(lookAt); else lookAt.set(0, TABLE_H + 0.45, 0);
    for (const p of people) { p.mixer.update(dt); if (p.busy > 0 && (p.busy -= dt) <= 0) back(p); restIK(p, dt); headLook(p, p === talker ? null : lookAt, dt); }
    placeScreen(dt); placeBadges(); holo.update(dt); camStep(dt); R.update && R.update(clock.elapsedTime); ctl.update();
    if (cam.position.y > ROOM_H - 0.3) cam.position.y = ROOM_H - 0.3;   // камерата — под тавана
    cam.position.x = Math.max(-ROOM_W + 1.4, Math.min(ROOM_W - 1.4, cam.position.x)); cam.position.z = Math.max(ROOM_BACK + 1.2, Math.min(ROOM_FRONT - 0.8, cam.position.z));   // и в залата — пред завесите, не в стените
    renderer.render(scene, cam);
  }
  loop();

  function close() {
    if (shut) return; shut = true; try { o.onClose && o.onClose(); } catch {}
    window.__overlay3d = Math.max(0, (window.__overlay3d || 1) - 1);
    removeEventListener('keydown', key); removeEventListener('resize', onResize);
    el.classList.remove('on');
    setTimeout(() => {
      cancelAnimationFrame(raf); ctl.dispose();
      for (const p of people) { p.mixer.stopAllAction(); p.wrap.remove(p.m); }   // моделите остават в кеша за следващия път
      scene.traverse(c => { if (c.isMesh && !c.isSkinnedMesh) { c.geometry.dispose(); const ms = [].concat(c.material); ms.forEach(mm => { mm.map && mm.map.dispose(); mm.dispose(); }); } });
      snd.ambience(false); snd.hush(); holo.dispose(); scene.environment && scene.environment.dispose(); pmrem.dispose(); renderer.dispose(); el.remove();
    }, 450);
  }
  return { close };
}

// 🏛️ Министерският съвет (етап 3): същите герои с нови роли. k — ключът на министерството (dir на предложенията), seat — мястото на масата
export const MINISTERS = [
  { k: 'fin', ico: '💰', name: 'Борис Тодоров', model: 'boris', title: 'Министър на финансите и държавния резерв', what: 'бюджет, данъци, дълг, резерв и извънредно финансиране', seat: 0 },
  { k: 'reg', ico: '🏘️', name: 'Георги Николов', model: 'georgi', title: 'Министър на регионалното развитие и благоустройството', what: 'жилища, развитие на градовете, обществени сгради и туризъм', seat: 1 },
  { k: 'def', ico: '🛡️', name: 'Ивайло Петров', model: 'ivaylo', title: 'Министър на отбраната', what: 'военна инфраструктура, снабдяване, оборудване и готовност', seat: 2 },
  { k: 'roads', ico: '🛣️', name: 'Надя Иванова', model: 'nadya', title: 'Министър на пътната инфраструктура', what: 'национални пътища, мостове, ремонти и достъп до регионите', seat: 3 },
  { k: 'rail', ico: '🚆', name: 'Мария Стоянова', model: 'maria', title: 'Министър на железниците и обществения транспорт', what: 'жп мрежата, товарните коридори и градския транспорт', seat: 4 },
  { k: 'sea', ico: '⚓', name: 'Стефан Колев', model: 'stefan', title: 'Министър на морското дело и външната търговия', what: 'пристанища, търговски маршрути и доставки', seat: 5 },
  { k: 'air', ico: '✈️', name: 'Елена Димитрова', model: 'elena', title: 'Министър на авиацията и международните връзки', what: 'летища, въздушни връзки и международни споразумения', seat: 6 },
  { k: 'energy', ico: '⚡', name: 'Вера Ангелова', model: 'vera', title: 'Министър на енергетиката', what: 'горива, електроцентрали, енергийна сигурност и нови източници', seat: 7 },
  { k: 'pm', ico: '🏛️', name: 'Десислава Илиева', model: 'mayor', title: 'Министър-председател', what: 'координация на министрите, програмата на кабинета и регионите', seat: 10 },
];
// o: като openBoardroom + cc: 'US' | 'RU'; o.brief(k) → какво казва министърът при клик (по желание). Парите докладва финансовият министър (bankKey 'fin').
export function openCabinet(o) {
  const ru = o.cc === 'RU';
  return openBoardroom({
    ...o, room: ru ? 'ru' : 'us', bankKey: 'fin', bankTitle: '💰 Финансите: с какво разполагаме',
    hallTitle: (o.title && /извънредно/i.test(o.title) ? '⛔ ' : '') + (ru ? '🇷🇺 Кремъл — Министерски съвет' : '🇺🇸 Белият дом — Кабинет на САЩ'), reportDir: 'pm', reportTitle: o.title && /извънредно/i.test(o.title) ? '⛔ Извънредно заседание — най-важното' : '🏛️ Министър-председателят: най-важното този месец', loadText: '🎩 Министрите влизат…',
    seats: () => MINISTERS.map(m => ({ k: m.k, ico: m.ico, company: m.title, what: m.what, director: m.name, model: m.model, seat: m.seat, open: true, logo: false, minister: true, brief: o.brief ? o.brief(m.k) : '' })),
  });
}
// демо за Лабораторията: Министерският съвет в 🇺🇸 / 🇷🇺 залата
export function demoCabinet(cc = 'US') {
  const ru = cc === 'RU', C = ru ? 'RUS' : 'USA', city = ru ? [{ nm: 'Москва', lat: 55.75, lon: 37.62 }, { nm: 'Казан', lat: 55.79, lon: 49.12 }, { nm: 'Екатеринбург', lat: 56.84, lon: 60.6 }] : [{ nm: 'Хюстън', lat: 29.76, lon: -95.37 }, { nm: 'Далас', lat: 32.78, lon: -96.8 }, { nm: 'Денвър', lat: 39.74, lon: -104.99 }];
  const P = [
    { id: 'fin:brief:1', dir: 'fin', ico: '💰', info: true, text: '' },
    { id: 'roads:hw', dir: 'roads', ico: '🛣️', text: `Национална магистрала ${city[0].nm} — ${city[2].nm}: 1400 км, 6 ленти.`, why: 'регионите на запад са откъснати', cost: 1.4e10, days: 720, gainTxt: '+2% растеж в регионите', inBudget: true, geo: { country: C, kind: 'route', cities: city, route: [[0, 1], [1, 2]] } },
    { id: 'energy:plant', dir: 'energy', ico: '⚡', text: 'Нова АЕЦ и два вятърни парка — 4 GW.', why: 'зимата идва, резервът е 6%', cost: 2.2e10, days: 1460, gainTxt: 'енергийна независимост', inBudget: false, small: { cost: 6e9 }, geo: { country: C, kind: 'energy', cities: city.slice(1, 3) } },
    { id: 'def:base', dir: 'def', ico: '🛡️', text: 'Модернизация на две бази и нови радари по границата.', why: 'готовността е под 70%', cost: 8e9, days: 540, gainTxt: 'готовност 90%', inBudget: true },
    { id: 'air:deal', dir: 'air', ico: '✈️', text: 'Споразумение „Открито небе“ с 12 държави.', why: 'туризъм и бизнес полети', cost: 0, days: 90, gainTxt: '+18 нови линии', inBudget: true },
  ];
  return openCabinet({
    cc, title: ru ? 'Държавата — демо' : 'The State — demo', brand: { nm: ru ? 'Россия' : 'USA', col: ru ? '#d52b1e' : '#3c3b6e', ico: '🦅', group: ru ? 'Правителство' : 'Белият дом', sub: ru ? '· МИНИСТЕРСКИ СЪВЕТ ·' : '· КАБИНЕТ НА САЩ ·' },
    proposals: () => P.filter(p => !p.done),
    onDecide: (id, a) => { const p = P.find(q => q.id === id); if (p) p.done = a; return null; },
    speech: () => `Държавната хазна има ${ru ? '4,1' : '6,8'} трилиона. Резервът е 8%. За нови програми тази година можем да отделим ${ru ? '120' : '310'} милиарда.`,
    frame: () => ({ cash: ru ? 4.1e12 : 6.8e12, reserved: 9e11, op: 2.9e12, free: ru ? 1.2e11 : 3.1e11, loan: 5e11 }),
    summary: () => `Одобрихме ${P.filter(p => p.done === 'yes' || p.done === 'small').length} програми. Кабинетът продължава.`,
    brief: k => ({ pm: 'Координирам министрите. Тази седмица — пътищата и зимата.', fin: 'Дефицитът е 2,4%. Има място за две големи програми.' })[k] || '',
  });
}

// демо за Лабораторията: всички 7 директора на масата (+ хотелите — свободно място) и примерни предложения към борда
let DEMO_REPORT = true;
const DEMO_PROPS = [
  { id: 'bank:brief:1', dir: 'bank', ico: '🏦', info: true, avail: 7.4e8, reserve: 1.8e8, text: 'В касата има 920 млн. €. След месечния резерв от 180 млн. € можем да отпуснем до 740 млн. € за инвестиции този месец.' },
  { id: 'demo-air', dir: 'air', ico: '✈️', text: 'Имаме 10 гейта за ъпдейт в 4 летища — общо 720 млн. €. Да ги направим ли?', cost: 7.2e8, inBudget: true, days: 90, geo: { country: 'BGR', kind: 'airport', cities: [{ nm: 'София', lat: 42.7, lon: 23.32 }, { nm: 'Пловдив', lat: 42.15, lon: 24.75 }, { nm: 'Варна', lat: 43.21, lon: 27.91 }, { nm: 'Бургас', lat: 42.5, lon: 27.47 }] } },
  { id: 'con:gear:3', dir: 'con', ico: '🚜', text: 'Липсват 3 машини за обектите. Предлагам да ги купя.', cost: 4.2e5, count: 3, inBudget: true, days: 2 },
  { id: 'rail:hs:2', dir: 'rail', ico: '⚡', text: 'Предлагам да надградя 2 дълги линии за влака „Стрела“ — 300 км/ч.', cost: 8.884e7, count: 2, inBudget: true, days: 180 },
  { id: 'bank:sdiv40:1', dir: 'bank', ico: '🤝', text: 'Акционерите са недоволни и акцията пада. Предлагам да вдигнем дивидента на 40% от печалбата.', cost: 0, inBudget: true },
  { id: 'rail:trains:3', dir: 'rail', ico: '🚆', text: 'Линиите поемат още 3 влака. Предлагам да купя 3 средни товарни влака.', cost: 3.6e7, count: 3, inBudget: true, days: 10, geo: { country: 'BGR', kind: 'rail', cities: [{ nm: 'София', lat: 42.7, lon: 23.32 }, { nm: 'Варна', lat: 43.21, lon: 27.91 }], route: [[0, 1]] } },
  { id: 'rail:trainup:4', dir: 'rail', ico: '⬆️', text: 'Предлагам да надградя 4 малки влака до големи — повече вагони, повече товар.', cost: 2.4e7, count: 4, inBudget: true, days: 5 },
  { id: 'demo-hotel', dir: 'hotel', ico: '🏨', text: 'Предлагам два нови хотела в Испания — в Мадрид и Барселона.', why: 'туристите в Испания растат с 8% годишно, нямаме хотел там', gainTxt: '+72 млн. €/месец след откриването', small: { text: 'Само хотел в Барселона', cost: 9e7 }, cost: 1.8e8, inBudget: true, days: 120, income: 2.4e6, geo: { country: 'ESP', kind: 'hotel', cities: [{ nm: 'Мадрид', lat: 40.42, lon: -3.7 }, { nm: 'Барселона', lat: 41.39, lon: 2.17 }] } },
  { id: 'demo-rail', dir: 'rail', ico: '🚆', text: 'Да построим 24 нови линии и да купим 22 влака?', cost: 3.2e7, inBudget: false },
  { id: 'demo-oil', dir: 'oil', ico: '🛢️', text: 'Договор за доставка на гориво: Шанхай — 2 млн. барела, +18 млн. € за 60 дни. Приемаме ли?', cost: 0, days: 60, income: 3e5, geo: { country: 'CHN', kind: 'oil', cities: [{ nm: 'Шанхай', lat: 31.23, lon: 121.47 }, { nm: 'Нинбо', lat: 29.87, lon: 121.55 }] } },
  { id: 'demo-hw', dir: 'hw', ico: '🛣️', text: 'За 5-те нови филиала няма мрежа — да строим аутобани за 3 млн. € и да купим 52 ТИР-а?', cost: 3e6, inBudget: true, days: 60, geo: { country: 'DEU', kind: 'route', cities: [{ nm: 'Берлин', lat: 52.52, lon: 13.4 }, { nm: 'Хамбург', lat: 53.55, lon: 9.99 }, { nm: 'Мюнхен', lat: 48.14, lon: 11.58 }, { nm: 'Кьолн', lat: 50.94, lon: 6.96 }, { nm: 'Франкфурт', lat: 50.11, lon: 8.68 }], route: [[0, 1], [0, 2], [3, 4], [4, 2]] } },
  { id: 'demo-energy', dir: 'con', ico: '⚡', text: 'Соларен и вятърен парк край Бургас и Варна — 120 MW.', cost: 9e7, inBudget: true, days: 150, gainTxt: '+3,1 млн. €/месец', geo: { country: 'BGR', kind: 'energy', cities: [{ nm: 'Бургас', lat: 42.5, lon: 27.47 }, { nm: 'Варна', lat: 43.21, lon: 27.91 }] } },
  { id: 'demo-bank', dir: 'bank', ico: '🏦', text: 'Аржентина иска кредит от 1,2 млрд. € за 5 години при 7,5% годишно. Рейтинг BBB. Да го отпуснем ли?', why: 'държавата плаща редовно, лихвата е над пазарната', cost: 1.2e9, inBudget: false, days: 1825, gainTxt: '+7,5 млн. €/месец лихва', geo: { country: 'ARG', kind: 'loan', rating: 'BBB', ratingCol: '#ffd54a', amt: 1.2e9, cities: [{ nm: 'Буенос Айрес', lat: -34.6, lon: -58.38 }] } },
];
export function demoBoardroom() {
  const C = [['con', '🏗️', 'Констръкшън', 'Ивайло Петров', 5, 2.1e6], ['hw', '🛣️', 'Толроуд', 'Надя Иванова', 5, 1.4e6], ['rail', '🚆', 'Рейл', 'Мария Стоянова', 5, 9.8e5], ['sea', '🚢', 'Оушън Експрес', 'Стефан Колев', 5, 1.1e6],
    ['air', '✈️', 'Флайеър', 'Елена Димитрова', 5, 1.6e6], ['hotel', '🏨', 'Хотелс', 'Георги Николов', 5, 7.2e5], ['oil', '🛢️', 'Петролиум', 'Вера Ангелова', 5, 3.4e6], ['bank', '🏦', 'Банк', 'Борис Тодоров', 5, 2.7e6], ['glob', '🌍', 'Глобъл Ризортс & Констръкшън', 'Александър Владимиров', 0, 0], ['mayor', '🏙️', 'Империал Сити', 'Десислава Илиева', 0, 0]];
  return openBoardroom({
    title: 'Титан Груп — демо', brand: { nm: 'Титан', col: '#4fc3f7', ico: '🗿', group: 'Титан Груп' },
    proposals: () => DEMO_PROPS.filter(p => !p.done),
    report: () => DEMO_REPORT ? '<div class="card"><div class="meta">🚆 <b>Мария Стоянова: „2 от 3 одобрени проекта са изпълнени. Линията Варна — Бургас чака влакове.“</b></div><div class="meta" style="margin-left:18px">⚠️ <b style="color:#ffb347">забавено</b> · Линия Варна — Бургас · 70% · срок ден 412 <button class="btn2" data-bc="1|extend">📅 Удължи</button> <button class="btn2" data-bc="1|stop">✖ Прекрати</button></div><div class="meta">✈️ <b>Елена Димитрова: „1 от 1 одобрени проекта са изпълнени.“</b></div></div>' : '',
    bindReport: (box, rr) => box.querySelectorAll('[data-bc]').forEach(b => b.onclick = () => { DEMO_REPORT = false; rr(); }),
    speech: () => 'Разполагаме с 920 млн. €. От тях 60 млн. € са поети ангажименти, а 120 млн. € предлагам да останат като оперативен резерв. За нови инвестиции имаме 740 млн. €.',
    frame: () => ({ cash: 9.2e8, reserved: 6e7, op: 1.2e8, free: 7.4e8, loan: 5e8 }),
    summary: () => `Одобрихме ${DEMO_PROPS.filter(p => p.done === 'yes' || p.done === 'small' || p.done === 'pass').length} инвестиции. Остават 740 млн. € за нови решения.`,
    onDecide: (id, a) => {
      const p = DEMO_PROPS.find(q => q.id === id); if (!p) return null;
      if (a === 'yes' && id === 'demo-air') return { need: 'vote', p, v: { bank: { why: 'изяжда 72% от касата (над 40%)' }, yes: 3, no: 3, tie: true, passed: false, votes: [
        { dir: 'air', name: 'Елена Димитрова', yes: true, why: 'моето предложение' }, { dir: 'bank', name: 'Борис Тодоров', yes: false, why: 'рисково: изяжда 72% от касата' },
        { dir: 'rail', name: 'Мария Стоянова', yes: false, why: 'чакат 32 млн. € за Титан Рейл' }, { dir: 'con', name: 'Ивайло Петров', yes: true, why: 'полезно за холдинга' },
        { dir: 'sea', name: 'Стефан Колев', yes: true, why: 'полезно за холдинга' }, { dir: 'oil', name: 'Вера Ангелова', yes: false, why: 'не сега' }] } };
      p.done = a; return null;
    },
    onResolve: (id, how) => { const p = DEMO_PROPS.find(q => q.id === id); if (p) p.done = how; },
    voteOn: id => { const p = DEMO_PROPS.find(q => q.id === id); if (!p) return null; const D = [['con', 'Ивайло Петров'], ['hw', 'Надя Иванова'], ['rail', 'Мария Стоянова'], ['sea', 'Стефан Колев'], ['air', 'Елена Димитрова'], ['oil', 'Вера Ангелова'], ['bank', 'Борис Тодоров']];
      const votes = D.map(([dir, name], i) => ({ dir, name, yes: dir === p.dir || (i + p.id.length) % 3 !== 0, cond: dir === 'con' && i % 2 === 0, why: dir === p.dir ? 'моето предложение' : (i + p.id.length) % 3 ? 'полезно за холдинга' : 'чакат пари за моето дружество' }));
      const yes = votes.filter(v => v.yes).length; return { p, v: { votes, yes, no: votes.length - yes, passed: yes > votes.length / 2, bank: { ok: true } } }; },
    seats: () => C.map(([k, ico, suf, d, lv, inc]) => ({ k, ico, company: 'Титан ' + suf, what: '', open: true, director: d, lv, lvMax: 5, inc, bonus: inc * (lv * 0.1 + (d ? 0.15 : 0)), bonusPct: Math.round((lv * 0.1 + (d ? 0.15 : 0)) * 100), up: lv < 5 ? { cost: 5e6, can: true } : null, hire: !d && lv >= 5 ? { cost: 4e6, can: true } : null })),
  });
}
