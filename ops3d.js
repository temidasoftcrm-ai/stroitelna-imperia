// ops3d.js — 🚨 оперативната 3D карта „Градски площад“ (ops.js държи мисията; тук само я показваме).
// Община в дъното, площад отпред, две улици (отпред — по X, вдясно — по Z), спирка, малък парк и сгради наоколо.
// Зони: тълпата в средата, масата за преговори пред стълбите, медицинският пункт вдясно, периметърът на полицията по улицата.
// Колите на екипите идват по улиците и спират на своите места; над всяка — статусът. Позициите се смятат от времето
// на мисията (m.t), затова при повторно отваряне сцената показва точно текущото състояние.
// Само една активна сцена: ново отваряне затваря старата. Затваряне — спира кадъра, миксерите и освобождава всичко
// собствено (общите модели от кеша остават за следващия път). window.__opsScene — за измерване от конзолата.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { OPS_TEAMS, OPS_CHOICES, opsPhaseName } from './ops.js';

// ---- общият кеш на моделите (зарежда се веднъж; геометриите и материалите му не се освобождават при затваряне)
const SHARED = new WeakSet(), cache = {};
const loader = new GLTFLoader();
const load = p => cache[p] || (cache[p] = loader.loadAsync(p).then(g => { g.scene.traverse(o => { if (o.geometry) SHARED.add(o.geometry); const ms = o.material ? [].concat(o.material) : []; for (const m of ms) { SHARED.add(m); for (const v of Object.values(m)) if (v && v.isTexture) SHARED.add(v); } }); return g; }).catch(() => null));
const PEDS = ['adam', 'brian', 'elizabeth', 'kate', 'louise'].map(k => `assets/heavy/people/peds/ped-${k}.glb`);
const ANIMS = 'assets/heavy/people/peds/peds-anims.glb';
const BLD = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(k => `assets/commercial/building-${k}.glb`);
const VEH = { neg: 'assets/heavy/cars/car-accord.glb', med: 'assets/heavy/cars/amb-eu.glb', pol: 'assets/heavy/cars/pol-crownvic.glb' };
const TRAFFIC = ['assets/heavy/cars/car-polo.glb', 'assets/heavy/cars/car-corolla.glb', 'assets/heavy/cars/car-taxi.glb', 'assets/heavy/cars/bus-citaro.glb'];
const HALL = 'assets/heavy/civic/cityhall.glb', TREE = 'assets/nature/tree_oak.glb';

// ---- разположението (метри; площадът е около началото, общината — към −z)
const ST_A = 22, ST_B = 30, ROAD_W = 9;   // улица А: z = 22 (по X); улица Б: x = 30 (по Z)
const SPOT = { neg: [-9, ST_A - 2.2, -Math.PI / 2], pol: [12, ST_A - 2.2, -Math.PI / 2], med: [ST_B - 2.2, 2, Math.PI] };   // [x, z, посока при спиране]
const ENTRY = { neg: [[-70, ST_A - 2.2], [-9, ST_A - 2.2]], pol: [[-70, ST_A - 2.2], [12, ST_A - 2.2]], med: [[ST_B - 2.2, 70], [ST_B - 2.2, 2]] };
const ZONE = { crowd: [-3, 3, 10, 7], talk: [0, -13], med: [19, -3], cordon: ST_A - 5.2 };
const BACK_DAYS = 0.18;

let cur = null;
export function openOpsSquare(ops, o = {}) {
  if (cur) cur.close();
  const m0 = ops.active(); if (!m0) return null;
  const owned = [];   // собствени геометрии/материали/текстури — освобождават се при затваряне
  const own = x => { owned.push(x); return x; };
  // ---- прозорецът
  const el = document.createElement('div'); el.id = 'ops3d';
  el.style.cssText = 'position:fixed;inset:0;z-index:9790;background:#0b1220;color:#e6edf6;font:500 14px/1.45 system-ui,sans-serif';
  el.innerHTML = `<style>
#ops3d .tb{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:10px;padding:10px 14px;background:linear-gradient(#000c,#0000);pointer-events:none}
#ops3d .tb *{pointer-events:auto} #ops3d h2{margin:0;font:800 18px system-ui,sans-serif} #ops3d .ph{padding:3px 10px;border-radius:999px;background:#1d2a42;font-weight:700}
#ops3d button{background:#1d2a42;color:#e6edf6;border:1px solid #2d3f60;border-radius:9px;padding:7px 11px;cursor:pointer;font:inherit} #ops3d button.y{background:#ffd54a;color:#111;border-color:#ffd54a;font-weight:700}
#ops3d button:disabled{opacity:.45;cursor:default} #ops3d .x{margin-left:auto;font-weight:800}
#ops3d .pn{position:absolute;right:12px;top:58px;bottom:12px;width:min(340px,calc(100vw - 24px));overflow:auto;background:#0c1220e8;border:1px solid #22304a;border-radius:14px;padding:12px}
#ops3d .m{color:#9fb0c8;font-size:13px} #ops3d .bar{height:7px;background:#22304a;border-radius:4px;overflow:hidden;margin:3px 0 8px} #ops3d .bar i{display:block;height:100%}
#ops3d .tm{border:1px solid #22304a;border-radius:10px;padding:8px;margin:6px 0;display:flex;gap:8px;align-items:center} #ops3d .tm .i{font-size:22px}
#ops3d .lb{position:absolute;transform:translate(-50%,-100%);padding:3px 9px;border-radius:999px;background:#000b;color:#fff;font:700 12px system-ui,sans-serif;white-space:nowrap;pointer-events:none}
#ops3d .ld{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:700 16px system-ui,sans-serif;opacity:.8}
@media (max-width:700px){#ops3d .pn{top:auto;height:44vh}}
</style><div class="tb"><h2>🚨 ${m0.city} — Градски площад</h2><span class="ph"></span><button data-sp>⏩ ×1</button><button class="x" data-x>✕</button></div>
<div class="ld">🚨 Подготвям площада…</div><div class="lbs"></div><div class="pn"></div>`;
  document.body.appendChild(el);
  window.__overlay3d = (window.__overlay3d || 0) + 1;
  ops.setViewing(true);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.prepend(renderer.domElement);
  const scene = new THREE.Scene(), sky = new THREE.Color(0xa9c3db); scene.background = sky; scene.fog = new THREE.Fog(0xa9c3db, 90, 190);
  const cam = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.5, 400); cam.position.set(-16, 17, 30);
  const ctl = new OrbitControls(cam, renderer.domElement);
  ctl.target.set(2, 2, 0); ctl.enableDamping = true; ctl.minDistance = 14; ctl.maxDistance = 95; ctl.maxPolarAngle = 1.38; ctl.screenSpacePanning = false; ctl.update();
  const hemi = new THREE.HemisphereLight(0xdfeeff, 0x6b6250, 1.15); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-40, 60, 30); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 160 }); scene.add(sun);
  window.__opsScene = { renderer, scene, get people() { return crowd.length + staff.length; } };

  // ---- земя, площад, улици (процедурно, канвас текстури)
  const ctex = (w, h, draw, rep) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = own(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; };
  const mat = (c, ex = {}) => own(new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...ex }));
  const plane = (w, d, m, x, y, z) => { const g = own(new THREE.PlaneGeometry(w, d)), p = new THREE.Mesh(g, m); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); p.receiveShadow = true; scene.add(p); return p; };
  const box = (w, h, d, m, x, y, z, par = scene) => { const b = new THREE.Mesh(own(new THREE.BoxGeometry(w, h, d)), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; par.add(b); return b; };
  plane(260, 260, mat(0x7d8a6a), 0, 0, 0);
  const stone = ctex(512, 512, (g, w) => { g.fillStyle = '#cfc6b4'; g.fillRect(0, 0, w, w); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { g.fillStyle = `hsl(38,${12 + Math.random() * 8}%,${70 + Math.random() * 9}%)`; g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); } }, [8, 6]);
  plane(52, 38, mat(0xffffff, { map: stone }), 0, 0.02, -1);
  const asph = mat(0x3b3f45), dash = ctex(256, 32, (g, w, h) => { g.fillStyle = '#3b3f45'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8e8e8'; g.fillRect(0, h / 2 - 2, w / 2, 4); }, [20, 1]);
  plane(260, ROAD_W, mat(0xffffff, { map: dash }), 0, 0.03, ST_A);
  const rb = plane(260, ROAD_W, mat(0xffffff, { map: dash }), ST_B, 0.035, 0); rb.rotation.z = Math.PI / 2;
  plane(ROAD_W, ROAD_W, asph, ST_B, 0.04, ST_A);
  const walk = mat(0xa9a59c);
  plane(260, 2.4, walk, 0, 0.05, ST_A - ROAD_W / 2 - 1.2); plane(260, 2.4, walk, 0, 0.05, ST_A + ROAD_W / 2 + 1.2);
  { const s = plane(2.4, 260, walk, ST_B - ROAD_W / 2 - 1.2, 0.05, 0); s.position.y = 0.05; plane(2.4, 260, walk, ST_B + ROAD_W / 2 + 1.2, 0.05, 0); }
  // парк (вляво) и спирка (на улица А)
  plane(13, 15, mat(0x5f8f42), -21, 0.04, -4);
  for (const [x, z] of [[-25, -9], [-17, -10], [-24, 1], [-18, 0], [-21, -4.5]]) load(TREE).then(g => { if (!g || shut) return; const t = fitTo(g.scene.clone(true), { h: 6 + Math.random() * 2 }); t.position.set(x, 0, z); scene.add(t); });
  { const sh = new THREE.Group(); sh.position.set(-24, 0, ST_A - ROAD_W / 2 - 1.6); scene.add(sh); const gl = own(new THREE.MeshPhysicalMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.35, roughness: 0.1 })), fr = mat(0x2c3440, { metalness: 0.6, roughness: 0.4 });
    box(4.2, 0.12, 1.6, fr, 0, 2.6, -0.2, sh); box(4.2, 2.4, 0.06, gl, 0, 1.35, -0.95, sh); for (const x of [-2, 2]) box(0.1, 2.6, 0.1, fr, x, 1.3, -0.9, sh); box(3, 0.1, 0.45, mat(0x6b4a2a), 0, 0.5, -0.65, sh);
    const sg = new THREE.Mesh(own(new THREE.PlaneGeometry(0.9, 0.5)), own(new THREE.MeshBasicMaterial({ map: ctex(180, 100, (g, w, h) => { g.fillStyle = '#1565c0'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '800 46px system-ui'; g.textAlign = 'center'; g.fillText('🚌 12', w / 2, 66); }) }))); sg.position.set(2.4, 2.4, 0.2); sh.add(sg); box(0.08, 2.6, 0.08, fr, 2.4, 1.3, 0.2, sh); }
  // общината и сградите наоколо
  load(HALL).then(g => { if (!g || shut) return; const h = fitTo(g.scene.clone(true), { w: 30 }); h.position.set(0, 0, -27); scene.add(h); shadows(h); });
  const ring = [[-34, -26, 0], [-36, -8, Math.PI / 2], [-38, 9, Math.PI / 2], [38, -26, 0], [42, -8, -Math.PI / 2], [42, 10, -Math.PI / 2], [-30, 36, Math.PI], [-8, 37, Math.PI], [14, 36, Math.PI], [44, 36, Math.PI], [-52, 36, Math.PI]];
  ring.forEach(([x, z, ry], i) => load(BLD[i % BLD.length]).then(g => { if (!g || shut) return; const b = fitTo(g.scene.clone(true), { w: 14 + (i % 3) * 3 }); b.position.set(x, 0, z); b.rotation.y = ry; scene.add(b); shadows(b); }));
  // зоните: масата за преговори (с навес), медицинската палатка
  const talk = new THREE.Group(); talk.position.set(ZONE.talk[0], 0, ZONE.talk[1]); scene.add(talk);
  const wood = mat(0x6b4a2a), white = mat(0xf3f3f0), canvasM = mat(0x2d5ea8);
  box(3.2, 0.08, 1.2, wood, 0, 0.78, 0, talk); for (const [x, z] of [[-1.4, -0.5], [1.4, -0.5], [-1.4, 0.5], [1.4, 0.5]]) box(0.08, 0.78, 0.08, wood, x, 0.39, z, talk);
  box(5, 0.08, 4, canvasM, 0, 2.8, 0, talk); for (const [x, z] of [[-2.4, -1.9], [2.4, -1.9], [-2.4, 1.9], [2.4, 1.9]]) box(0.08, 2.8, 0.08, white, x, 1.4, z, talk);
  const medT = new THREE.Group(); medT.position.set(ZONE.med[0], 0, ZONE.med[1]); scene.add(medT);
  { const tm = mat(0xffffff); box(4.4, 0.1, 4, tm, 0, 2.6, 0, medT); for (const [x, z] of [[-2.1, -1.9], [2.1, -1.9], [-2.1, 1.9], [2.1, 1.9]]) box(0.08, 2.6, 0.08, tm, x, 1.3, z, medT);
    const cross = mat(0xd32f2f); box(1.2, 0.02, 0.36, cross, 0, 2.66, 0, medT); box(0.36, 0.02, 1.2, cross, 0, 2.66, 0, medT); box(1.8, 0.5, 0.7, white, 0, 0.25, -1.2, medT); }
  medT.visible = false;
  // периметърът (конуси и огради по улица А) — когато полицията е на място
  const cordon = new THREE.Group(); scene.add(cordon); cordon.visible = false;
  { const cone = mat(0xff6d00), bar = mat(0xe8e8e8); for (let x = -26; x <= 26; x += 3.2) { const c = new THREE.Mesh(own(new THREE.ConeGeometry(0.25, 0.75, 10)), cone); c.position.set(x, 0.37, ZONE.cordon); c.castShadow = true; cordon.add(c); }
    for (let x = -24; x <= 24; x += 6) box(2.6, 0.9, 0.08, bar, x, 0.55, ZONE.cordon + 0.6, cordon); }

  // ---- хора: протестиращи (с плакати), екипите (преговарящи, медици, полицаи)
  let pedSrc = [], clips = {};
  const SIGN_TXT = ['ЧУЙТЕ НИ!', 'ДИАЛОГ', 'ЗА НАС', (m0.demand.split(' ').slice(0, 2).join(' ') || 'ПРОМЯНА').toUpperCase()];
  const signM = SIGN_TXT.map(t => own(new THREE.MeshStandardMaterial({ map: ctex(256, 160, (g, w, h) => { g.fillStyle = '#fbf8ef'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c62828'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); g.fillStyle = '#1a1a1a'; g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = 46; g.font = `900 ${fs}px system-ui`; while (g.measureText(t).width > w - 30 && fs > 20) g.font = `900 ${fs -= 3}px system-ui`; g.fillText(t, w / 2, h / 2); }), side: THREE.DoubleSide, roughness: 0.8 })));
  const signG = own(new THREE.PlaneGeometry(0.9, 0.56)), stickG = own(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 6)), stickM = mat(0x8d6e4c);
  const crowd = [], staff = [];
  function person(src, opt = {}) {
    const p = cloneSkinned(src.scene); p.scale.setScalar(src.k * (0.95 + Math.random() * 0.1));
    p.traverse(o => { if (!o.isMesh) return; o.castShadow = true; o.frustumCulled = false;
      if (opt.tint) { o.material = own(o.material.clone()); const hsl = {}; o.material.color.getHSL(hsl); if (!(hsl.h > 0.02 && hsl.h < 0.12 && hsl.l > 0.45)) o.material.color.lerp(new THREE.Color(opt.tint), 0.75); } });
    scene.add(p);
    const mixer = new THREE.AnimationMixer(p), acts = {};
    const play = n => { const c = clips[n] || src.animations.find(a => a.name === n); if (!c) return; if (!acts[n]) acts[n] = mixer.clipAction(c); for (const [k, a] of Object.entries(acts)) if (k !== n && a.isRunning()) a.fadeOut(0.3); acts[n].reset().fadeIn(0.3).play(); };
    const P = { p, mixer, play, src, sign: null, x: 0, z: 0, ry: 0, goal: null, sp: 1.3, cur: '' };
    return P;
  }
  const setAnim = (P, n) => { if (P.cur === n) return; P.cur = n; P.play(n); };
  function addProtester() {
    const src = pedSrc[(Math.random() * pedSrc.length) | 0], P = person(src), [cx, cz, rx, rz] = ZONE.crowd;
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
    P.x = cx + Math.cos(a) * rx * r; P.z = cz + Math.sin(a) * rz * r; P.ry = Math.PI + (Math.random() - 0.5) * 0.6;
    P.p.position.set(P.x, 0, P.z); P.p.rotation.y = P.ry;
    if (Math.random() < 0.55) { const sg = new THREE.Group(), b = new THREE.Mesh(signG, signM[(Math.random() * signM.length) | 0]), s = new THREE.Mesh(stickG, stickM); b.position.y = 0.6; b.castShadow = true; s.position.y = 0; sg.add(b, s); scene.add(sg); P.sign = sg; P.ph = Math.random() * 6; }
    setAnim(P, Math.random() < 0.5 ? 'Waving' : Math.random() < 0.5 ? 'Talk_Arguing' : 'Idle'); P.mixer.update(Math.random() * 3);
    crowd.push(P); return P;
  }
  function dropPerson(P, list) { scene.remove(P.p); if (P.sign) scene.remove(P.sign); P.mixer.stopAllAction(); P.mixer.uncacheRoot(P.p); list.splice(list.indexOf(P), 1); }
  // екипите на място: [кой, позиции, анимация, оцветяване]
  const STAFF = {
    neg: { at: [[-0.8, ZONE.talk[1] - 1.1, 0], [0.8, ZONE.talk[1] - 1.1, 0]], org: [[-0.8, ZONE.talk[1] + 1.1, Math.PI], [0.8, ZONE.talk[1] + 1.1, Math.PI]], anim: 'Talk_General', tint: 0x2b2f3a },
    med: { at: [[ZONE.med[0] - 1, ZONE.med[1] + 1, Math.PI / 2], [ZONE.med[0] + 1, ZONE.med[1] + 1.2, -Math.PI / 2]], anim: 'Look_Around', tint: 0xf2f2f2 },
    pol: { at: [[-15, ZONE.cordon - 1, Math.PI], [-3, ZONE.cordon - 1, Math.PI], [9, ZONE.cordon - 1, Math.PI], [20, ZONE.cordon - 1, Math.PI]], anim: 'Look_Around', tint: 0x1f3a7a },
  };
  const staffOn = { neg: false, med: false, pol: false };
  function setStaff(k, on) {
    if (staffOn[k] === on || !pedSrc.length) return; staffOn[k] = on;
    if (!on) { for (const P of staff.filter(q => q.team === k)) dropPerson(P, staff); return; }
    const S0 = STAFF[k];
    const put = (list, tint) => list.forEach(([x, z, ry], i) => { const P = person(pedSrc[(i + (k === 'pol' ? 1 : 0)) % pedSrc.length], { tint }); P.team = k; P.x = x; P.z = z; P.ry = ry; P.p.position.set(x, 0, z); P.p.rotation.y = ry; setAnim(P, S0.anim); P.mixer.update(Math.random() * 2); staff.push(P); });
    put(S0.at, S0.tint); if (S0.org) put(S0.org, null);
  }

  // ---- колите на екипите: позицията — от времето на мисията
  const veh = {}, labels = {};
  for (const k of Object.keys(OPS_TEAMS)) {
    load(VEH[k]).then(g => { if (!g || shut) return; const v = fitTo(g.scene.clone(true), { len: k === 'med' ? 6 : 4.8 }); shadows(v); const hold = new THREE.Group(); hold.add(v); hold.visible = false; scene.add(hold); veh[k] = hold;
      if (k !== 'neg') { const L = []; for (const [c, dx] of [[0xff2020, -0.35], [0x2060ff, 0.35]]) { const b = new THREE.Mesh(own(new THREE.SphereGeometry(0.16, 10, 8)), own(new THREE.MeshBasicMaterial({ color: c }))); b.position.set(dx, k === 'med' ? 2.9 : 1.6, 0.2); hold.add(b); L.push(b); } hold.userData.beacons = L; } });
    const lb = document.createElement('div'); lb.className = 'lb'; lb.style.display = 'none'; el.querySelector('.lbs').appendChild(lb); labels[k] = lb;
  }
  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  function placeVehicles(m, tt) {
    for (const [k, tm] of Object.entries(m.teams)) {
      const h = veh[k], lb = labels[k], T = OPS_TEAMS[k]; let pos = null, ry = 0, txt = '';
      const [a, b] = ENTRY[k], dir = Math.atan2(b[0] - a[0], b[1] - a[1]);
      if (tm.st === 'enroute') { const p = Math.min(1, (m.t - tm.t0) / tm.eta), e = 1 - Math.pow(1 - p, 2); pos = lerp2(a, b, e); ry = dir; txt = `${T.ico} ${T.nm} · на път ${Math.round(p * 100)}%`; }
      else if (tm.st === 'onsite') { pos = b; ry = dir; txt = `${T.ico} ${T.nm} · на място`; }
      else if (tm.st === 'back') { const p = Math.min(1, (m.t - tm.t0) / BACK_DAYS); if (p < 1) { pos = lerp2(b, [b[0] + (b[0] - a[0]) * 0.8, b[1] + (b[1] - a[1]) * 0.8], p * p); ry = dir; txt = `${T.ico} прибира се`; } }
      if (h) { h.visible = !!pos; if (pos) { h.position.set(pos[0], 0, pos[1]); h.rotation.y = ry; } const B = h.userData.beacons; if (B) { const on = tm.st === 'enroute' || tm.st === 'onsite'; B.forEach((s, i) => { s.visible = on && ((tt * 3 + i) | 0) % 2 === 0; }); } }
      lb.style.display = pos ? '' : 'none'; if (pos) { lb.textContent = txt; tmp.set(pos[0], k === 'med' ? 3.8 : 2.6, pos[1]).project(cam); lb.style.left = `${(tmp.x + 1) / 2 * innerWidth}px`; lb.style.top = `${(1 - tmp.y) / 2 * innerHeight}px`; if (tmp.z > 1) lb.style.display = 'none'; }
      setStaff(k, tm.st === 'onsite');
    }
    medT.visible = m.teams.med.st === 'onsite'; cordon.visible = m.teams.pol.st === 'onsite';
  }
  const tmp = new THREE.Vector3();
  // ---- трафикът: улиците са затворени по време на протеста; след него колите тръгват отново
  const cars = [];
  function trafficOn(on) {
    if (on && !cars.length) TRAFFIC.forEach((p, i) => load(p).then(g => { if (!g || shut) return; const v = fitTo(g.scene.clone(true), { len: /bus/.test(p) ? 11 : 4.4 }); const h = new THREE.Group(); h.add(v); scene.add(h); cars.push({ h, axis: i % 2 ? 'b' : 'a', s: Math.random() * 140, sp: 9 + Math.random() * 4, lane: i < 2 ? 1 : -1 }); }));
    if (!on) for (const c of cars.splice(0)) scene.remove(c.h);
  }
  function moveCars(dt) { for (const c of cars) { c.s = (c.s + c.sp * dt) % 150; const u = c.lane > 0 ? c.s - 75 : 75 - c.s; if (c.axis === 'a') { c.h.position.set(u, 0, ST_A + c.lane * 2.2); c.h.rotation.y = c.lane > 0 ? Math.PI / 2 : -Math.PI / 2; } else { c.h.position.set(ST_B + c.lane * 2.2, 0, -u); c.h.rotation.y = c.lane > 0 ? Math.PI : 0; } } }

  // ---- панелът: статус, екипи, решения, хроника
  const pn = el.querySelector('.pn'), phEl = el.querySelector('.ph'); let pnSig = '';
  const B = n => n >= 1e9 ? `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: 2 })} млрд. €` : n >= 1e6 ? `${(n / 1e6).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млн. €` : `${Math.round(n / 1e3)} хил. €`;
  const bar = (v, col) => `<div class="bar"><i style="width:${Math.round(v)}%;background:${col}"></i></div>`;
  function panel(m) {
    const tCol = m.tension >= 60 ? '#ff6b6b' : m.tension >= 35 ? '#ffd54a' : '#5fe39a', left = m.budget - m.spent;
    const sig = [m.phase, Math.round(m.tension), Math.round(m.crowd / 5), Math.round(m.talks * 20), m.out, m.log.length, left, ...Object.values(m.teams).map(t => t.st)].join('|');
    if (sig === pnSig) return; pnSig = sig;
    phEl.textContent = opsPhaseName(m.phase);
    const st = tm => ({ ready: '⚪ в готовност', enroute: '🟡 на път', onsite: '🟢 на място', back: m.t - tm.t0 > BACK_DAYS ? '✔️ приключи' : '⚫ прибира се' }[tm.st]);
    let h = `<b>📢 Искането</b><div class="m" style="margin:2px 0 8px;color:#e6edf6">„${m.demand}“</div>
      <div class="m">🌡️ Напрежение: <b style="color:${tCol}">${Math.round(m.tension)}</b></div>${bar(m.tension, tCol)}
      <div class="m">👥 На площада: ~${Math.round(m.crowd)} души${m.faint ? ` · 🥵 припаднали: ${m.faint}` : ''}</div>
      <div class="m">💶 Бюджет на мисията: <b style="color:#e6edf6">${B(left)}</b> от ${B(m.budget)}</div><div class="m" style="margin-bottom:6px">ℹ️ Протестът е мирен и остава мирен — изходът зависи от решенията ти.</div>`;
    h += `<b>🚗 Екипи</b>${Object.entries(OPS_TEAMS).map(([k, T]) => `<div class="tm"><span class="i">${T.ico}</span><div style="flex:1"><b>${T.nm}</b><div class="m">${T.job}</div><div class="m">${st(m.teams[k])} · ${B(T.cost)}</div></div>${m.teams[k].st === 'ready' && !m.out ? `<button class="y" data-go="${k}">Изпрати</button>` : ''}</div>`).join('')}`;
    if (!m.out) {
      if (m.teams.neg.st === 'onsite') h += `<b>🤝 Преговорите</b>${bar(m.talks * 100, '#4fc3f7')}` + (m.talks >= 1 ? Object.entries(OPS_CHOICES).map(([c, C]) => `<button style="display:block;width:100%;text-align:left;margin:4px 0" data-ch="${c}">${C.ico} ${C.nm}${C.k ? ` · ${B(m.budget * C.k)}` : ''}</button>`).join('') : '<div class="m">Изслушват организаторите…</div>');
      else h += `<div class="m" style="margin-top:6px">💡 Без преговарящи няма решение — напрежението расте, а след ${8} дни хората се разотиват недоволни.</div>`;
    } else h += `<div style="margin:8px 0;padding:8px;border-radius:10px;background:${m.out === 'deal' ? '#123d27' : '#3a2f12'}">${m.out === 'deal' ? '✅ Споразумение' : m.out === 'partial' ? '📋 Частично решение' : '🌧️ Протестът се разотиде недоволен'}</div>`;
    h += `<b>📰 Хроника</b>${m.log.map(x => `<div class="m">${x.txt}</div>`).join('')}`;
    pn.innerHTML = h;
    pn.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { ops.dispatch(b.dataset.go); pnSig = ''; });
    pn.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => { ops.choose(b.dataset.ch); pnSig = ''; });
  }

  // ---- кадърът
  let speed = 1, raf = 0, shut = false, crowdT = 0, ready = false;
  const spB = el.querySelector('[data-sp]'); spB.onclick = () => { speed = speed === 1 ? 3 : speed === 3 ? 6 : 1; spB.textContent = `⏩ ×${speed}`; };
  const clock = new THREE.Clock();
  function frame() {
    if (shut) return; raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1), tt = clock.elapsedTime;
    ops.step(dt * speed / 24);   // 1 игрови ден = 24 s (като играта на ×1)
    const m = ops.active();
    if (!m) { close(); return; }
    if (ready) {
      // тълпата следва броя (до 40 фигури); при решение хората си тръгват към улиците
      const leave = m.out && (m.out !== 'partial');
      const want = m.out ? (m.out === 'partial' ? Math.round(Math.min(40, m.crowd / 6) * 0.4) : 0) : Math.max(8, Math.min(40, Math.round(m.crowd / 6)));
      crowdT += dt;
      if (crowdT > 0.25) { crowdT = 0; const stay = crowd.filter(P => !P.goal);
        if (stay.length < want) addProtester();
        else if (stay.length > want) { const P = stay[(Math.random() * stay.length) | 0]; P.goal = Math.random() < 0.5 ? [-60, ST_A + 6] : [ST_B + 6, 60]; setAnim(P, 'Walk'); if (P.sign && leave) { scene.remove(P.sign); P.sign = null; } } }
      const calm = m.tension < 30 || m.out;
      for (const P of [...crowd]) {
        if (P.goal) { const dx = P.goal[0] - P.x, dz = P.goal[1] - P.z, d = Math.hypot(dx, dz); if (d < 1) { dropPerson(P, crowd); continue; } P.x += dx / d * P.sp * dt * speed; P.z += dz / d * P.sp * dt * speed; P.ry = Math.atan2(dx, dz); P.p.position.set(P.x, 0, P.z); P.p.rotation.y = P.ry; }
        else if (Math.random() < 0.004) setAnim(P, calm ? (Math.random() < 0.7 ? 'Idle' : 'Talk_General') : (Math.random() < 0.6 ? 'Waving' : 'Talk_Arguing'));
        if (P.sign) { const up = calm ? 1.4 : 1.75 + Math.sin(tt * 3 + P.ph) * 0.12; P.sign.position.set(P.x + 0.25 * Math.cos(P.ry), up, P.z - 0.25 * Math.sin(P.ry)); P.sign.rotation.y = P.ry; }
        P.mixer.update(dt * Math.min(speed, 2));
      }
      for (const P of staff) P.mixer.update(dt);
      placeVehicles(m, tt);
      trafficOn(m.phase === 'resolved' && m.out !== 'partial'); moveCars(dt * speed);
      // светлината: при напрежение — по-сиво и студено, след решението — слънце
      const k = m.out === 'deal' ? 1 : 1 - m.tension / 140; sun.intensity = 1.2 + k * 1.4; sky.setRGB(0.55 + k * 0.12, 0.62 + k * 0.14, 0.7 + k * 0.16); scene.fog.color.copy(sky);
      panel(m);
    }
    ctl.update(); clampCam(); renderer.render(scene, cam);
  }
  function clampCam() { const t = ctl.target; t.x = Math.max(-30, Math.min(34, t.x)); t.z = Math.max(-24, Math.min(30, t.z)); t.y = 2; if (cam.position.y < 3) cam.position.y = 3; }
  Promise.all([...PEDS.map(load), load(ANIMS)]).then(gs => {
    if (shut) return; const an = gs.pop(); if (an) for (const c of an.animations) clips[c.name] = c;
    pedSrc = gs.filter(Boolean).map(g => { if (!g.k) { g.scene.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(g.scene, true); g.k = 1.8 / ((b.max.y - b.min.y) || 1); } return g; });
    ready = true; el.querySelector('.ld').remove();
  });
  frame();

  const onResize = () => { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); };
  const key = e => { if (e.key === 'Escape') close(); };
  addEventListener('resize', onResize); addEventListener('keydown', key);
  el.querySelector('[data-x]').onclick = () => close();

  function close() {
    if (shut) return; shut = true; cancelAnimationFrame(raf);
    removeEventListener('resize', onResize); removeEventListener('keydown', key);
    for (const P of [...crowd]) dropPerson(P, crowd); for (const P of [...staff]) dropPerson(P, staff);
    ctl.dispose();
    scene.traverse(o => { if (o.geometry && !SHARED.has(o.geometry)) owned.push(o.geometry); });
    for (const x of new Set(owned)) if (!SHARED.has(x)) x.dispose && x.dispose();
    renderer.renderLists.dispose(); renderer.dispose(); renderer.forceContextLoss();
    el.remove(); window.__overlay3d = Math.max(0, (window.__overlay3d || 1) - 1);
    ops.setViewing(false); if (cur === api) cur = null; window.__opsScene = null; o.onClose && o.onClose();
  }
  const api = { close }; cur = api; return api;
}
// нормализиране → обвивка: размер по най-дългата хоризонтала (len — колите се обръщат по +Z), ширина (w) или височина (h); долу на y = 0, центрирано
function fitTo(o, { len, w, h }) {
  o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const k = h ? h / s.y : w ? w / s.x : len / Math.max(s.x, s.z);
  const inner = new THREE.Group(); o.position.set(-c.x, -b.min.y, -c.z); inner.add(o); inner.scale.setScalar(k);
  if (len && s.x > s.z) inner.rotation.y = Math.PI / 2;
  const hold = new THREE.Group(); hold.add(inner); return hold;
}
function shadows(o) { o.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; } }); }
