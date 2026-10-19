// opskit.js — 🚨 общата основа на оперативните 3D карти (наводнение, пожар; площадът — ops3d.js, по-старият).
// Дава: рендер, камера с граници, светлини, кеш на моделите, хора с анимации (минувачи, полицай, пожарникар — Mixamo),
// колите на екипите (идват по пътя, сирени, мигащи светлини, надпис със статуса), огън/дим/водни струи, панела (статус,
// екипи, решения, хроника) и чистото затваряне (кадър, миксери, звуци, собствени геометрии/материали; общите модели остават).
// Мисията е в ops.js / opskinds.js — тук само я показваме; времето на мисията тече от сцената, докато е отворена.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { KINDS } from './opskinds.js';
import { feature } from './lab/feature.js';
import { flameSprite, flameSize } from './fireflip.js';   // истинските пламъци (Блендър) — Лабораторията → fire-real
import { emergCar } from './vehmodels.js';   // спешните коли — като в играта: правилна посока и светлинна лента
export { THREE };

const SHARED = new WeakSet(), cache = {}, loader = new GLTFLoader();
export const load = p => cache[p] || (cache[p] = loader.loadAsync(p).then(g => { g.scene.traverse(o => { if (o.geometry) SHARED.add(o.geometry); for (const m of o.material ? [].concat(o.material) : []) { SHARED.add(m); for (const v of Object.values(m)) if (v && v.isTexture) SHARED.add(v); } }); return g; }).catch(() => null));
export const PEDS = ['adam', 'brian', 'steve', 'elizabeth', 'kate', 'louise'].map(k => `assets/heavy/people/peds/ped-${k}.glb`);
const ANIMS = 'assets/heavy/people/peds/peds-anims.glb', COP = 'assets/heavy/riot/riot-cop.glb', FF = 'assets/heavy/ops/firefighter.glb';
// нормализиране → обвивка: len — най-дългата хоризонтала (колите се обръщат по +Z), w — ширина, h — височина; долу на y = 0
export function fitTo(o, { len, w, h, maxH }) {
  o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  let k = h ? h / s.y : w ? w / s.x : len / Math.max(s.x, s.z); if (maxH && s.y * k > maxH) k = maxH / s.y;
  const inner = new THREE.Group(); o.position.set(-c.x, -b.min.y, -c.z); inner.add(o); inner.scale.setScalar(k); if (len && s.x > s.z) inner.rotation.y = Math.PI / 2;
  const hold = new THREE.Group(); hold.add(inner); hold.userData.sz = (len && s.x > s.z) ? { x: s.z * k, y: s.y * k, z: s.x * k } : { x: s.x * k, y: s.y * k, z: s.z * k }; return hold;
}
export const shadows = o => o.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true; });

let cur = null;
// cfg: { title, sky, cam: [x, y, z], target: [x, y, z], bounds: [x0, x1, z0, z1], minY, maxDist, build(kit) → { update(m, tt, dt), close? } }
export function openOpsScene(ops, o, cfg) {
  if (cur) cur.close();
  const m0 = ops.active(); if (!m0) return null; const K = KINDS[m0.k];
  const owned = [], own = x => { owned.push(x); return x; };
  const el = document.createElement('div'); el.id = 'ops3d';
  el.style.cssText = 'position:fixed;inset:0;z-index:9790;background:#0b1220;color:#e6edf6;font:500 14px/1.45 system-ui,sans-serif';
  el.innerHTML = `<style>
#ops3d .tb{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:10px;padding:10px 14px;background:linear-gradient(#000c,#0000);pointer-events:none}
#ops3d .tb *{pointer-events:auto} #ops3d h2{margin:0;font:800 18px system-ui,sans-serif} #ops3d .ph{padding:3px 10px;border-radius:999px;background:#1d2a42;font-weight:700}
#ops3d button{background:#1d2a42;color:#e6edf6;border:1px solid #2d3f60;border-radius:9px;padding:7px 11px;cursor:pointer;font:inherit} #ops3d button.y{background:#ffd54a;color:#111;border-color:#ffd54a;font-weight:700}
#ops3d button.y:hover{filter:brightness(1.12);transform:scale(1.04)} #ops3d button:active{transform:scale(.96)} #ops3d .x{margin-left:auto;font-weight:800}
#ops3d .pn{position:absolute;right:12px;top:58px;bottom:12px;width:min(340px,calc(100vw - 24px));overflow:auto;background:#0c1220e8;border:1px solid #22304a;border-radius:14px;padding:12px}
#ops3d .m{color:#9fb0c8;font-size:13px} #ops3d .bar{height:7px;background:#22304a;border-radius:4px;overflow:hidden;margin:3px 0 8px} #ops3d .bar i{display:block;height:100%}
#ops3d .tm{border:1px solid #22304a;border-radius:10px;padding:8px;margin:6px 0;display:flex;gap:8px;align-items:center} #ops3d .tm .i{font-size:22px}
#ops3d .lb{position:absolute;transform:translate(-50%,-100%);padding:3px 9px;border-radius:999px;background:#000b;color:#fff;font:700 12px system-ui,sans-serif;white-space:nowrap;pointer-events:none}
#ops3d .ld{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:700 16px system-ui,sans-serif;opacity:.8}
@media (max-width:700px){#ops3d .pn{top:auto;height:44vh}}
</style><div class="tb"><h2>${K.ico} ${m0.city} — ${cfg.title}</h2><span class="ph"></span><button data-sp>⏩ ×1</button><button class="x" data-x>✕</button></div>
<div class="ld">${K.ico} Подготвям картата…</div><div class="lbs"></div><div class="pn"></div>`;
  document.body.appendChild(el);
  window.__overlay3d = (window.__overlay3d || 0) + 1; ops.setViewing(true);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.prepend(renderer.domElement);
  const scene = new THREE.Scene(), sky = new THREE.Color(cfg.sky || 0xa9c3db); scene.background = sky; scene.fog = new THREE.Fog(sky.getHex(), 90, 200);
  const cam = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.5, 450); cam.position.set(...(cfg.cam || [-20, 20, 34]));
  const ctl = new OrbitControls(cam, renderer.domElement); ctl.target.set(...(cfg.target || [0, 2, 0])); ctl.enableDamping = true; ctl.minDistance = 12; ctl.maxDistance = cfg.maxDist || 75; ctl.maxPolarAngle = 1.2; ctl.update();
  const hemi = new THREE.HemisphereLight(0xdfeeff, 0x6b6250, 1.1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.1); sun.position.set(-40, 60, 30); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 180 }); scene.add(sun);

  // ---- малки помощници за сцената
  const ctex = (w, h, draw, rep) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = own(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; };
  const mat = (c, ex = {}) => own(new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...ex }));
  const plane = (w, d, m, x, y, z) => { const p = new THREE.Mesh(own(new THREE.PlaneGeometry(w, d)), m); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); p.receiveShadow = true; scene.add(p); return p; };
  const box = (w, h, d, m, x, y, z, par = scene) => { const b = new THREE.Mesh(own(new THREE.BoxGeometry(w, h, d)), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; par.add(b); return b; };
  let shut = false;
  const place = (path, opt, cb) => load(path).then(g => { if (!g || shut) return null; const v = fitTo(g.scene.clone(true), opt); shadows(v); cb && cb(v); return v; });

  // ---- хора: минувачи (свои клипове), полицай и пожарникар (Mixamo — само завъртанията от клиповете на минувачите, повдигнати от таза)
  let pedSrc = [], copSrc = null, ffSrc = null; const clips = {}, people = [];
  const rotCache = new Map(), rotOnly = c => rotCache.get(c) || (rotCache.set(c, new THREE.AnimationClip(c.name, c.duration, c.tracks.filter(t => /\.quaternion$/.test(t.name)))), rotCache.get(c));
  function person(src, opt = {}) {
    const rig = src === copSrc || src === ffSrc, body = cloneSkinned(src.scene), p = rig ? new THREE.Group() : body; if (rig) { body.position.y = 0.98; p.add(body); }
    p.scale.setScalar((rig ? 0.97 : src.k) * (0.95 + Math.random() * 0.1));
    p.traverse(q => { if (!q.isMesh) return; q.castShadow = true; q.frustumCulled = false; if (opt.tint) { q.material = own(q.material.clone()); q.material.color.lerp(new THREE.Color(opt.tint), 0.6); } });
    scene.add(p); const mixer = new THREE.AnimationMixer(body), acts = {}, anims = src.animations.length && !rig ? src.animations : (pedSrc[0] ? pedSrc[0].animations : []);
    const play = n => { let c = clips[n] || anims.find(a => a.name === n) || anims.find(a => a.name.includes(n)) || anims.find(a => /Idle/.test(a.name)); if (!c) return; if (rig) c = rotOnly(c);
      if (!acts[n]) acts[n] = mixer.clipAction(c); for (const [k, a] of Object.entries(acts)) if (k !== n && a.isRunning()) a.fadeOut(0.3); acts[n].reset().fadeIn(0.3).play(); };
    const P = { p, body, mixer, play, src, x: 0, z: 0, y: 0, ry: 0, cur: '', anim(n) { if (this.cur !== n) { this.cur = n; play(n); } }, at(x, z, ry, y = 0) { this.x = x; this.z = z; this.y = y; if (ry != null) this.ry = ry; p.position.set(x, y, z); p.rotation.y = this.ry; } };
    people.push(P); return P;
  }
  function drop(P) { scene.remove(P.p); P.mixer.stopAllAction(); P.mixer.uncacheRoot(P.body); const i = people.indexOf(P); if (i >= 0) people.splice(i, 1); }
  const walkTo = (P, x, z, sp, dt) => { const dx = x - P.x, dz = z - P.z, d = Math.hypot(dx, dz); if (d < 0.3) return true; const s0 = Math.min(d, sp * dt); P.at(P.x + dx / d * s0, P.z + dz / d * s0, Math.atan2(dx, dz), P.y); return false; };
  const pedsReady = Promise.all([...PEDS.map(load), load(ANIMS), load(COP), load(FF), load('assets/heavy/directors/clips.glb')]).then(gs => {
    if (shut) return; const dc = gs.pop(); if (dc) for (const c of dc.animations) if (/^Sit_/.test(c.name)) clips[c.name] = c;   /* седнали пози (Mixamo, от директорите) */ ffSrc = gs.pop(); copSrc = gs.pop(); const an = gs.pop(); if (an) for (const c of an.animations) clips[c.name] = c;
    pedSrc = gs.filter(Boolean).map(g => { if (!g.k) { g.scene.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(g.scene, true); g.k = 1.8 / ((b.max.y - b.min.y) || 1); } return g; });
  });

  // ---- огън и дим (спрайтове), водни струи
  const flameT = ctex(64, 128, (g, w, h) => { const r = g.createRadialGradient(w / 2, h * 0.7, 2, w / 2, h * 0.6, h * 0.5); r.addColorStop(0, 'rgba(255,240,180,1)'); r.addColorStop(0.35, 'rgba(255,150,40,.9)'); r.addColorStop(0.75, 'rgba(220,60,10,.35)'); r.addColorStop(1, 'rgba(120,20,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
  const flameM = own(new THREE.SpriteMaterial({ map: flameT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const smokeT = ctex(64, 64, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 2, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(60,60,60,.9)'); r.addColorStop(1, 'rgba(60,60,60,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
  const waterT = ctex(32, 32, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 1, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(220,240,255,.95)'); r.addColorStop(1, 'rgba(160,200,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
  // огнище: { g, update(tt, power 0–1) } — power мащабира пламъците и светлината
  function fire(x, y, z, size = 1, n = 6, light = false) {
    const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
    const flip = feature('fire-real');
    const fl = Array.from({ length: flip ? Math.max(2, Math.ceil(n * 0.6)) : n }, (_, j) => { const sp = flip ? flameSprite() : new THREE.Sprite(flameM); sp.userData.o = [(Math.random() - 0.5) * size * 0.9, (Math.random() - 0.5) * size * 0.5, Math.random() * 6 + j]; g.add(sp); return sp; });
    const L = light ? new THREE.PointLight(0xff8a3a, 0, 14, 1.6) : null; if (L) { L.position.y = size; g.add(L); }
    return { g, update(tt, pw) { for (const [j, sp] of fl.entries()) { sp.visible = pw > 0.02; if (!sp.visible) continue; const [ox, oz, ph] = sp.userData.o, u = (tt * 1.5 + ph * 0.37) % 1, s0 = size * (0.4 + pw * 0.8);
      if (flip) { sp.position.set(ox, -size * 0.15, oz); flameSize(sp, s0 * (2.4 + 0.3 * Math.sin(tt * 2.3 + ph))); continue; }   // кадрите на симулацията се движат сами — само ръстът диша
      sp.position.set(ox, u * s0 * 1.4, oz); sp.scale.set(s0 * (0.9 - u * 0.5), s0 * (1.3 - u * 0.4), 1); } if (L) L.intensity = pw > 0.02 ? (5 + Math.sin(tt * 13 + x) * 2) * pw * 1.6 : 0; } };
  }
  const smoke = Array.from({ length: 70 }, () => { const sp = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: smokeT, transparent: true, depthWrite: false, opacity: 0 }))); sp.visible = false; scene.add(sp); return { sp, life: 0 }; });
  const puff = (x, y, z, big = 1, dark = 0.55) => { const S0 = smoke.find(q => q.life <= 0); if (!S0) return; S0.life = 1; S0.big = big; S0.dark = dark; S0.sp.visible = true; S0.sp.position.set(x + (Math.random() - 0.5) * big, y, z + (Math.random() - 0.5) * big); S0.dx = 0.5 + Math.random() * 0.5; };
  const drops = Array.from({ length: 260 }, () => { const sp = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: waterT, transparent: true, depthWrite: false }))); sp.visible = false; sp.scale.setScalar(0.35); scene.add(sp); return { sp, t: 1 }; });
  // водна струя от a до b (дъга) — няколко капки на кадър
  const spray = (a, b, arc = 3, n = 2) => { for (let k = 0; k < n; k++) { const D = drops.find(q => q.t >= 1); if (!D) return; D.t = Math.random() * 0.1; D.a = a; D.b = [b[0] + (Math.random() - 0.5) * 1.2, b[1] + (Math.random() - 0.5) * 0.8, b[2] + (Math.random() - 0.5) * 1.2]; D.arc = arc; D.sp.visible = true; } };
  // 💧 водна струя: прозрачна тръба по дъгата с течащи ивици (текстурата се движи по дължината) + пръски при удара
  const streakT = ctex(64, 256, (g, w, h) => { g.clearRect(0, 0, w, h); for (let k = 0; k < 26; k++) { const x = Math.random() * w, y = Math.random() * h, l = 30 + Math.random() * 90, gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(235,245,255,${0.5 + Math.random() * 0.5})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x, y, 2 + Math.random() * 4, l); } g.fillStyle = 'rgba(200,225,255,.18)'; g.fillRect(0, 0, w, h); }, [2, 4]);
  const streams = [];
  function stream(r = 0.12) {
    const T = streakT.clone(); T.needsUpdate = true; own(T); const m = own(new THREE.MeshBasicMaterial({ map: T, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.85 }));
    const mesh = new THREE.Mesh(own(new THREE.BufferGeometry()), m); mesh.visible = false; scene.add(mesh); let key = '';
    const S0 = { mesh, set(a, b, arc) { const k = [...a, ...b, arc].map(v => v.toFixed(1)).join(); if (k === key) return; key = k; mesh.geometry.dispose();
        const mid = new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + arc, (a[2] + b[2]) / 2), curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(...a), mid, new THREE.Vector3(...b));
        mesh.geometry = new THREE.TubeGeometry(curve, 28, r, 8, false); T.repeat.set(1, Math.max(2, curve.getLength() / 3)); S0.b = b; },
      update(dt, on) { mesh.visible = on; if (on) { T.offset.y -= dt * 2.2; if (S0.b && Math.random() < 0.7) spray([S0.b[0], S0.b[1] + 0.3, S0.b[2]], [S0.b[0] + (Math.random() - 0.5) * 2, S0.b[1] - 1.5, S0.b[2] + 1.2], 0.8, 1); } } };
    streams.push(S0); return S0;
  }
  // водна завеса (под хеликоптера): отворен конус с течащи ивици надолу
  function curtain() { const T = streakT.clone(); T.needsUpdate = true; own(T); const m = own(new THREE.MeshBasicMaterial({ map: T, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.75 }));
    const mesh = new THREE.Mesh(own(new THREE.CylinderGeometry(0.5, 3.2, 1, 16, 1, true)), m); mesh.visible = false; scene.add(mesh); T.repeat.set(3, 2);
    return { mesh, update(dt, on, x, y0, y1, z) { mesh.visible = on; if (!on) return; const h = Math.max(0.5, y0 - y1); mesh.scale.set(1, h, 1); mesh.position.set(x, (y0 + y1) / 2, z); T.offset.y += dt * 1.8; } }; }
  function fx(dt) {
    for (const S0 of smoke) if (S0.life > 0) { S0.life -= dt / 5; const a = 1 - S0.life; S0.sp.position.y += dt * 1.8 * S0.big; S0.sp.position.x += dt * S0.dx; S0.sp.scale.setScalar((1 + a * 6) * S0.big); S0.sp.material.opacity = Math.max(0, S0.life) * S0.dark; if (S0.life <= 0) S0.sp.visible = false; }
    for (const D of drops) if (D.t < 1) { D.t += dt * 1.6; const u = Math.min(1, D.t); D.sp.position.set(D.a[0] + (D.b[0] - D.a[0]) * u, D.a[1] + (D.b[1] - D.a[1]) * u + Math.sin(u * Math.PI) * D.arc, D.a[2] + (D.b[2] - D.a[2]) * u); if (u >= 1) D.sp.visible = false; }
  }

  // ---- колите на екипите: cfg.cars[k] = [{ model, len, path: [[x, z]…], delay, beacons, y }] — позицията се смята от времето на мисията
  const TT = ops.teamsOf(m0), vehicles = [], labels = {};
  const addCar = (k, i, c, v, car) => { const h = new THREE.Group(); h.add(v); h.visible = false; scene.add(h);
    const L = []; if (c.beacons && !car) for (const [col, dx] of [[0xff2020, -0.35], [0x2060ff, 0.35]]) { const b = new THREE.Mesh(own(new THREE.SphereGeometry(0.16, 10, 8)), own(new THREE.MeshBasicMaterial({ color: col }))); b.position.set(dx, c.beaconY || 1.7, 0.2); h.add(b); L.push(b); }
    vehicles.push({ k, i, c, h, L, car }); };
  for (const [k, list] of Object.entries(cfg.cars || {})) for (const [i, c] of list.entries())
    if (c.kind) load(c.model).then(g => { if (!g || shut) return; const car = emergCar(g.scene, c.len || 5, c.kind, (c.model.match(/([\w-]+)\.glb$/) || [])[1]); addCar(k, i, c, car, car); });   // c.kind: police | fire | ambulance
    else place(c.model, { len: c.len || 4.8 }, v => { if (/ladder-truck|dump-truck/.test(c.model)) v.rotation.y = Math.PI; addCar(k, i, c, v, null); });   // тези модели са с кабината назад
  for (const k of Object.keys(TT)) { const lb = document.createElement('div'); lb.className = 'lb'; lb.style.display = 'none'; el.querySelector('.lbs').appendChild(lb); labels[k] = lb; }
  const along = (path, u) => { let tot = 0; const seg = []; for (let i = 1; i < path.length; i++) { const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); seg.push(d); tot += d; } let s = u * tot;
    for (let i = 0; i < seg.length; i++) { if (s <= seg[i] || i === seg.length - 1) { const t = Math.min(1, s / (seg[i] || 1)), a = path[i], b = path[i + 1]; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[0] - a[0], b[1] - a[1])]; } s -= seg[i]; } return [...path[path.length - 1], 0]; };
  const tmp = new THREE.Vector3();
  function placeCars(m, tt) {
    const lbPos = {};
    for (const V of vehicles) { const tm = m.teams[V.k]; if (!tm) continue; let pos = null; const d = V.c.delay || 0;
      if (tm.st === 'enroute') { const p = Math.max(0, Math.min(1, (m.t - tm.t0 - d) / tm.eta)); if (p > 0) pos = along(V.c.path, 1 - Math.pow(1 - p, 2)); }
      else if (tm.st === 'onsite') pos = along(V.c.path, 1);
      else if (tm.st === 'back') { const p = Math.min(1, (m.t - tm.t0) / 0.18); if (p < 1) pos = along([...V.c.path].reverse(), p * p); }
      V.h.visible = !!pos; if (pos) { V.h.position.set(pos[0], V.c.y || 0, pos[1]); V.h.rotation.y = pos[2]; if (V.i === 0) lbPos[V.k] = [pos[0], (V.c.y || 0) + (V.c.lbY || 3), pos[1]]; }
      const on = tm.st === 'enroute' || tm.st === 'onsite'; V.L.forEach((s0, j) => { s0.visible = on && ((tt * 3 + j + V.i) | 0) % 2 === 0; }); if (V.car) V.car.userData.beaconsOn = on;
    }
    for (const [k, lb] of Object.entries(labels)) { const tm = m.teams[k], at = lbPos[k] || (cfg.labelAt && cfg.labelAt(k, m)); if (!at || !tm || (tm.st !== 'enroute' && tm.st !== 'onsite')) { lb.style.display = 'none'; continue; }
      const T = TT[k]; lb.textContent = tm.st === 'enroute' ? `${T.ico} ${T.nm} · на път ${Math.round(Math.min(1, (m.t - tm.t0) / tm.eta) * 100)}%` : `${T.ico} ${T.nm} · на място`;
      tmp.set(...at).project(cam); lb.style.display = tmp.z > 1 ? 'none' : ''; lb.style.left = `${(tmp.x + 1) / 2 * innerWidth}px`; lb.style.top = `${(1 - tmp.y) / 2 * innerHeight}px`; }
  }
  // 🚨 сирени: докато екипът е на път (cfg.sirens = { k: 'siren-police' … })
  const sirens = {};
  function sirenStep(m) { for (const [k, f] of Object.entries(cfg.sirens || {})) { const tm = m.teams[k], on = tm && tm.st === 'enroute' && !(o.muted && o.muted()); let a = sirens[k];
    if (on && !a) { a = sirens[k] = new Audio(`assets/sfx/${f}.mp3`); a.loop = true; a.volume = 0; a.play().catch(() => {}); } if (!a) continue;
    if (on) a.volume = Math.min(0.7, 0.15 + 0.55 * Math.min(1, (m.t - tm.t0) / tm.eta)); else { a.volume = Math.max(0, a.volume - 0.03); if (a.volume <= 0.01) { a.pause(); a.src = ''; delete sirens[k]; } } } }
  // фонов звук (cfg.ambient = { file, vol(m) })
  const amb = cfg.ambient ? new Audio(`assets/sfx/${cfg.ambient.file}.mp3`) : null; if (amb) { amb.loop = true; amb.volume = 0; } let ambV = 0;
  const ambStep = (m, dt) => { if (!amb) return; const want = o.muted && o.muted() ? 0 : cfg.ambient.vol(m); ambV += (want - ambV) * Math.min(1, dt * 1.5); amb.volume = Math.max(0, Math.min(1, ambV)); if (ambV > 0.01 && amb.paused) amb.play().catch(() => {}); else if (ambV <= 0.01 && !amb.paused) amb.pause(); };

  // ---- панелът
  const pn = el.querySelector('.pn'), phEl = el.querySelector('.ph'); let pnSig = '';
  pn.addEventListener('pointerdown', e => { const b = e.target.closest('[data-go],[data-ch],[data-dc]'); if (!b) return; e.preventDefault(); if (b.dataset.dc) { const [id, k] = b.dataset.dc.split('|'); ops.decide(id, k); } else if (b.dataset.go) ops.dispatch(b.dataset.go); else ops.choose(b.dataset.ch); pnSig = ''; });
  const B = n => n >= 1e9 ? `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: 2 })} млрд. €` : n >= 1e6 ? `${(n / 1e6).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млн. €` : `${Math.round(n / 1e3)} хил. €`;
  const bar = (v, col) => `<div class="bar"><i style="width:${Math.max(0, Math.min(100, Math.round(v)))}%;background:${col}"></i></div>`;
  function panel(m) {
    const rows = K.stats(m, B), left = m.budget - m.spent, ready = ops.ready();
    const decs = (K.decisions || []).filter(D => !m.out && (D.when ? D.when(m) : true) && (D.pick || D.ev || !(m.dec && m.dec[D.id])));
    const sig = JSON.stringify([rows, m.phase, m.out, m.log.length, left, ready, Object.values(m.teams).map(t => t.st), decs.map(D => D.id), m.dec, m.event && m.event.id]);
    if (sig === pnSig) return; pnSig = sig; phEl.textContent = K.phases[m.phase] || m.phase;
    const st = tm => ({ ready: '⚪ в готовност', enroute: '🟡 на път', onsite: '🟢 на място', back: '✔️ приключи' }[tm.st]);
    let h = rows.map(r => Array.isArray(r) ? `<div class="m">${r[0]}: <b style="color:${r[2]}">${Math.round(r[1])}</b></div>${bar(r[1], r[2])}` : `<div class="m">${r}</div>`).join('');
    h += `<div class="m" style="margin:4px 0 6px">💶 Бюджет на мисията: <b style="color:#e6edf6">${B(left)}</b> от ${B(m.budget)}</div>`;
    h += `<b>🚗 Екипи</b>${Object.entries(TT).map(([k, T]) => `<div class="tm"><span class="i">${T.ico}</span><div style="flex:1"><b>${T.nm}</b><div class="m">${T.job}</div><div class="m">${st(m.teams[k])} · ${B(T.cost)}</div></div>${m.teams[k].st === 'ready' && !m.out ? `<button class="y" data-go="${k}">Изпрати</button>` : ''}</div>`).join('')}`;
    if (m.out) h += `<div style="margin:8px 0;padding:8px;border-radius:10px;background:${m.out === 'deal' ? '#123d27' : '#3a2f12'}">${m.out === 'deal' ? '✅ Решено' : m.out === 'partial' ? '📋 Частично решение' : '🌧️ Без решение'}</div>`;
    const decH = decs.map(D => `<div style="margin:8px 0;padding:8px;border-radius:10px;border:1px solid ${D.ev ? '#ff8a65' : '#ffd54a'};background:${D.ev ? '#3a1d14' : '#2a2412'}"><b>${D.ico} ${D.title}</b>${D.txt ? `<div class="m">${D.txt(m)}</div>` : ''}${D.opts.map(O => { const cur = D.pick && m.dec && m.dec[D.id] === O.k;
      return `<button style="display:block;width:100%;text-align:left;margin:4px 0;${cur ? 'background:#ffd54a;color:#111;border-color:#ffd54a;font-weight:700' : ''}" data-dc="${D.id}|${O.k}">${O.ico} ${O.nm}${O.cost ? ` · ${B(O.cost)}` : ''}<div class="m" style="${cur ? 'color:#333' : ''}">${O.txt || ''}</div></button>`; }).join('')}</div>`).join('');
    h = h.replace('<b>🚗 Екипи</b>', decH + '<b>🚗 Екипи</b>');   /* решенията — над екипите, за да се виждат */
    if (!m.out && ready && !decs.some(D => !D.pick)) h += `<b>🏗️ Решението</b>${Object.entries(K.choices).map(([c, C]) => `<button style="display:block;width:100%;text-align:left;margin:4px 0" data-ch="${c}">${C.ico} ${C.nm}${C.k ? ` · ${B(m.budget * C.k)}` : ''}</button>`).join('')}`;
    h += `<b>📰 Хроника</b>${m.log.map(x => `<div class="m">${x.txt}</div>`).join('')}`;
    pn.innerHTML = h;
  }

  // ---- кадърът
  const kit = { THREE, scene, cam, ctl, sun, hemi, sky, el, own, ctex, mat, plane, box, place, load, fitTo, shadows, person, drop, walkTo, people, peds: () => pedSrc, cop: () => copSrc, ff: () => ffSrc, pedsReady, fire, puff, spray, stream, curtain, B, shut: () => shut };
  const S1 = cfg.build(kit);
  let speed = 1, raf = 0; const spB = el.querySelector('[data-sp]'); spB.onclick = () => { speed = speed === 1 ? 3 : speed === 3 ? 6 : 1; spB.textContent = `⏩ ×${speed}`; };
  const clock = new THREE.Clock();
  pedsReady.then(() => { const L = el.querySelector('.ld'); L && L.remove(); });
  function frame() {
    if (shut) return; raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1), tt = clock.elapsedTime;
    ops.step(dt * speed / 24); const m = ops.active(); if (!m) { close(); return; }
    const vd = dt * Math.min(speed, 2);
    S1.update && S1.update(m, tt, vd); placeCars(m, tt); fx(vd); for (const P of people) P.mixer.update(vd); sirenStep(m); ambStep(m, dt); panel(m);
    ctl.update(); const [x0, x1, z0, z1] = cfg.bounds || [-40, 40, -40, 40], t = ctl.target, c = cam.position;
    t.x = Math.max(x0, Math.min(x1, t.x)); t.z = Math.max(z0, Math.min(z1, t.z)); c.x = Math.max(x0 - 6, Math.min(x1 + 6, c.x)); c.z = Math.max(z0 - 6, Math.min(z1 + 6, c.z)); if (c.y < (cfg.minY || 6)) c.y = cfg.minY || 6;
    renderer.render(scene, cam);
  }
  frame();
  const onResize = () => { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); };
  const key = e => { if (e.key === 'Escape') close(); };
  addEventListener('resize', onResize); addEventListener('keydown', key); el.querySelector('[data-x]').onclick = () => close();
  window.__opsScene = { renderer, scene, get people() { return people.length; } };
  function close() {
    if (shut) return; shut = true; cancelAnimationFrame(raf); removeEventListener('resize', onResize); removeEventListener('keydown', key);
    if (amb) { amb.pause(); amb.src = ''; } for (const a of Object.values(sirens)) { a.pause(); a.src = ''; }
    S1.close && S1.close(); for (const P of [...people]) drop(P); ctl.dispose();
    scene.traverse(q => { if (q.geometry && !SHARED.has(q.geometry)) owned.push(q.geometry); });
    for (const x of new Set(owned)) if (!SHARED.has(x)) x.dispose && x.dispose();
    renderer.renderLists.dispose(); renderer.dispose(); renderer.forceContextLoss();
    el.remove(); window.__overlay3d = Math.max(0, (window.__overlay3d || 1) - 1); ops.setViewing(false); if (cur === api) cur = null; window.__opsScene = null; o.onClose && o.onClose();
  }
  const api = { close }; cur = api; return api;
}
