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
import { OPS_TEAMS, OPS_CHOICES, opsPhaseName, RIOT_AT } from './ops.js';
import { emergCar } from './vehmodels.js';   // линейката и полицейските коли — като в играта (посока, светлинна лента)
const EMC = { med: ['ambulance', 7.2], pol: ['police', 5.4] };

// ---- общият кеш на моделите (зарежда се веднъж; геометриите и материалите му не се освобождават при затваряне)
const SHARED = new WeakSet(), cache = {};
const loader = new GLTFLoader();
const load = p => cache[p] || (cache[p] = loader.loadAsync(p).then(g => { g.scene.traverse(o => { if (o.geometry) SHARED.add(o.geometry); const ms = o.material ? [].concat(o.material) : []; for (const m of ms) { SHARED.add(m); for (const v of Object.values(m)) if (v && v.isTexture) SHARED.add(v); } }); return g; }).catch(() => null));
const PEDS = ['adam', 'brian', 'steve', 'elizabeth', 'kate', 'louise'].map(k => `assets/heavy/people/peds/ped-${k}.glb`);
const ANIMS = 'assets/heavy/people/peds/peds-anims.glb';
const BLD = ['brick', 'richmond', 'dbrick', 'modoffice', 'asian', 'jade'].map(k => `assets/heavy/blocks/${k}.glb`);   // реалистичните сгради от града (Sketchfab, CC BY)
const TLIGHT = 'assets/heavy/signs/tlight.glb', FOREST = 'assets/heavy/trees/forest.glb';
const RIOT = 'assets/heavy/riot/';   // изгорели коли, контейнер, боклук, бусът и полицаят на силите на реда (Sketchfab, CC BY — CREDITS.txt)
const VEH = { neg: 'assets/heavy/cars/car-accord.glb', med: 'assets/heavy/cars/amb-eu.glb', pol: 'assets/heavy/cars/pol-crownvic.glb', riot: RIOT + 'riot-van.glb' };
const TRAFFIC = ['polo', 'corolla', 'taxi', 'renegade', 'p206', 'hilux', 'accord', 'polo', 'taxi', 'corolla', 'renegade', 'p206'].map(k => `assets/heavy/cars/car-${k}.glb`), BUS = 'assets/heavy/cars/bus-citaro.glb';
const HALL = 'assets/heavy/civic/cityhall.glb';
// истинските дървета: пакетът „Tree Pack“ (Sketchfab, CC BY) — стволът и короната са отделни възли; събираме ги по двойки (най-близкия по X)
let treeP = null;
const treeTpl = () => treeP || (treeP = load(FOREST).then(g => { if (!g) return []; g.scene.updateMatrixWorld(true); let root = null; g.scene.traverse(o => { if (o.name === 'RootNode') root = o; }); if (!root) return [];
  const T = root.children.filter(c => /^Tree_Trunk/.test(c.name)), Br = root.children.filter(c => /^Tree_Branches/.test(c.name)), v = new THREE.Vector3(), u = new THREE.Vector3();
  g.scene.traverse(o => { if (o.isMesh && o.material && o.material.map && (o.material.transparent || o.material.alphaTest)) { o.material.transparent = false; o.material.alphaTest = 0.45; o.material.side = THREE.DoubleSide; } });
  return T.map(t => { t.getWorldPosition(v); let best = null, bd = Infinity; for (const b of Br) { b.getWorldPosition(u); const d = Math.abs(u.x - v.x) + Math.abs(u.z - v.z) * 0.1; if (d < bd) { bd = d; best = b; } }
    const grp = new THREE.Group(); for (const o of [t, best].filter(Boolean)) { const c = o.clone(true); o.matrixWorld.decompose(c.position, c.quaternion, c.scale); grp.add(c); } return grp; }); }));

// ---- разположението (метри; площадът е около началото, общината — към −z)
const ST_A = 22, ST_B = 30, ROAD_W = 9;   // улица А: z = 22 (по X); улица Б: x = 30 (по Z)
const SPOT = { neg: [-9, ST_A - 2.2, -Math.PI / 2], pol: [12, ST_A - 2.2, -Math.PI / 2], med: [ST_B - 2.2, 2, Math.PI] };   // [x, z, посока при спиране]
const ENTRY = { neg: [[-70, ST_A - 2.2], [-13, ST_A - 2.2]], pol: [[-70, ST_A - 2.2], [12, ST_A - 2.2]], med: [[ST_B - 2.2, 70], [ST_B - 2.2, 2]], riot: [[ST_B - 2.2, -70], [ST_B - 2.2, -6]] };
const RIOT_Z = [13, 10];   // къде се събират провокаторите (до улицата, далеч от масата)
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
#ops3d button:disabled{opacity:.45;cursor:default} #ops3d button.y:hover{filter:brightness(1.12);transform:scale(1.04)} #ops3d button:active{transform:scale(.96)} #ops3d .x{margin-left:auto;font-weight:800}
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
  ctl.target.set(2, 2, 0); ctl.enableDamping = true; ctl.minDistance = 12; ctl.maxDistance = 70; ctl.maxPolarAngle = 1.2; ctl.screenSpacePanning = false; ctl.update();
  const hemi = new THREE.HemisphereLight(0xdfeeff, 0x6b6250, 1.15); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-40, 60, 30); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 160 }); scene.add(sun);
  window.__opsScene = { renderer, scene, get people() { return crowd.length + staff.length + walkers.length; }, get cars() { return cars.length; } };

  // ---- земя, площад, улици (процедурно, канвас текстури)
  const ctex = (w, h, draw, rep) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = own(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; };
  const mat = (c, ex = {}) => own(new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...ex }));
  const plane = (w, d, m, x, y, z) => { const g = own(new THREE.PlaneGeometry(w, d)), p = new THREE.Mesh(g, m); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); p.receiveShadow = true; scene.add(p); return p; };
  const box = (w, h, d, m, x, y, z, par = scene) => { const b = new THREE.Mesh(own(new THREE.BoxGeometry(w, h, d)), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; par.add(b); return b; };
  plane(260, 260, mat(0x7d8a6a), 0, 0, 0);
  const stone = ctex(512, 512, (g, w) => { g.fillStyle = '#cfc6b4'; g.fillRect(0, 0, w, w); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { g.fillStyle = `hsl(38,${12 + Math.random() * 8}%,${70 + Math.random() * 9}%)`; g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); } }, [8, 6]);
  plane(52, 38, mat(0xffffff, { map: stone }), 0, 0.02, -1);
  // улиците: асфалт с шум, маркировка, бордюри и тротоари с плочки, пешеходни пътеки и стоп линии
  const asphT = (dashes) => ctex(512, 128, (g, w, h) => { g.fillStyle = '#3a3d42'; g.fillRect(0, 0, w, h); for (let k = 0; k < 2500; k++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.07})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    if (dashes) { g.fillStyle = '#f2f2f2'; for (let x = 0; x < w; x += 64) g.fillRect(x, h / 2 - 2, 34, 4); g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(0, 6, w, 3); g.fillRect(0, h - 9, w, 3); } }, [26, 1]);
  plane(260, ROAD_W, mat(0xffffff, { map: asphT(true), roughness: 0.95 }), 0, 0.03, ST_A);
  { const rb = plane(260, ROAD_W, mat(0xffffff, { map: asphT(true), roughness: 0.95 }), ST_B, 0.035, 0); rb.rotation.z = Math.PI / 2; }
  plane(ROAD_W, ROAD_W, mat(0xffffff, { map: asphT(false), roughness: 0.95 }), ST_B, 0.04, ST_A);
  const tiles = ctex(256, 256, (g, w) => { g.fillStyle = '#b4afa5'; g.fillRect(0, 0, w, w); g.strokeStyle = '#9a958b'; g.lineWidth = 3; for (let k = 0; k <= w; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, w); g.moveTo(0, k); g.lineTo(w, k); g.stroke(); } }, [1, 1]);
  const walkM = (len, horiz) => { const t = tiles.clone(); t.needsUpdate = true; own(t); t.repeat.set(horiz ? len / 2.4 : 1, horiz ? 1 : len / 2.4); return mat(0xffffff, { map: t }); };
  const curbM = mat(0x8f8b84);
  const sidewalk = (x0, x1, z0, z1) => { const w = x1 - x0, d = z1 - z0, b = box(w, 0.15, d, walkM(Math.max(w, d), w > d), (x0 + x1) / 2, 0.075, (z0 + z1) / 2); b.castShadow = false; return b; };
  const SW = 2.6, eA0 = ST_A - ROAD_W / 2, eA1 = ST_A + ROAD_W / 2, eB0 = ST_B - ROAD_W / 2, eB1 = ST_B + ROAD_W / 2;
  sidewalk(-130, eB0, eA0 - SW, eA0); sidewalk(eB1, 130, eA0 - SW, eA0); sidewalk(-130, eB0, eA1, eA1 + SW); sidewalk(eB1, 130, eA1, eA1 + SW);
  sidewalk(eB0 - SW, eB0, -130, eA0 - SW); sidewalk(eB1, eB1 + SW, -130, eA0 - SW); sidewalk(eB0 - SW, eB0, eA1 + SW, 130); sidewalk(eB1, eB1 + SW, eA1 + SW, 130);
  const stripe = mat(0xf2f2f2, { roughness: 0.7 });
  const zebra = (cx, cz, alongX) => { for (let k = -3; k <= 3; k++) { const p = plane(alongX ? 0.55 : 3.2, alongX ? 3.2 : 0.55, stripe, cx + (alongX ? k * 1.1 : 0), 0.045, cz + (alongX ? 0 : k * 1.1)); p.receiveShadow = true; } };
  zebra(0, ST_A, true); zebra(eB0 - 2.2, ST_A, false); zebra(eB1 + 2.2, ST_A, false); zebra(ST_B, eA0 - 2.2, true); zebra(ST_B, eA1 + 2.2, true);
  // лампи покрай тротоарите
  { const poleM = mat(0x2b2f36, { metalness: 0.6, roughness: 0.4 }), lampM = own(new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xffe2a8, emissiveIntensity: 0.6 }));
    const lamp = (x, z, ry) => { const g = new THREE.Group(); g.position.set(x, 0.15, z); g.rotation.y = ry; scene.add(g); box(0.14, 5.2, 0.14, poleM, 0, 2.6, 0, g); box(0.1, 0.1, 1.3, poleM, 0, 5.1, 0.6, g); box(0.5, 0.16, 0.36, lampM, 0, 5.0, 1.2, g); };
    for (let x = -60; x <= 60; x += 16) if (Math.abs(x - ST_B) > 8) { lamp(x, eA0 - SW + 0.4, 0); lamp(x + 8, eA1 + SW - 0.4, Math.PI); }
    for (let z = -60; z <= 60; z += 16) if (Math.abs(z - ST_A) > 8) { lamp(eB0 - SW + 0.4, z, Math.PI / 2); lamp(eB1 + SW - 0.4, z + 8, -Math.PI / 2); } }
  // светофарите на кръстовището (истински модел; червено/зелено — по фазата)
  const lights = [];
  load(TLIGHT).then(g => { if (!g || shut) return; for (const [x, z, ry, ax] of [[eB0 - 1, eA0 - 1, 0, 'b'], [eB1 + 1, eA1 + 1, Math.PI, 'b'], [eB1 + 1, eA0 - 1, -Math.PI / 2, 'a'], [eB0 - 1, eA1 + 1, Math.PI / 2, 'a']]) {
    const t = fitTo(g.scene.clone(true), { h: 4.6 }); t.position.set(x, 0.15, z); t.rotation.y = ry; scene.add(t); shadows(t);
    const L = { ax, red: [], green: [] }; t.traverse(o => { if (!o.isMesh) return; if (/Red_Emissive/i.test(o.name)) L.red.push(o); else if (/Green_Emissive|Yellow/i.test(o.name)) L.green.push(o); }); lights.push(L); } });
  // парк (вляво) с истински дървета, дървета покрай площада и спирка (на улица А)
  plane(13, 15, mat(0x5f8f42), -21, 0.04, -4);
  const tree = (x, z, h) => treeTpl().then(T => { if (!T.length || shut) return; const t = fitTo(T[(Math.random() * T.length) | 0].clone(true), { h }); t.position.set(x, 0, z); t.rotation.y = Math.random() * 6.28; scene.add(t); shadows(t); });
  for (const [x, z] of [[-25, -9], [-17, -10], [-24, 1], [-18, 0], [-21, -4.5], [-26, -4]]) tree(x, z, 7 + Math.random() * 2.5);
  for (let x = -22; x <= 22; x += 11) tree(x, eA0 - SW + 0.9, 6 + Math.random());
  for (let z = -16; z <= 8; z += 12) tree(eB0 - SW + 0.9, z, 6 + Math.random());
  { const sh = new THREE.Group(); sh.position.set(-24, 0.15, eA0 - 0.5); sh.rotation.y = Math.PI; scene.add(sh); const gl = own(new THREE.MeshPhysicalMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.35, roughness: 0.1 })), fr = mat(0x2c3440, { metalness: 0.6, roughness: 0.4 });
    box(4.2, 0.12, 1.6, fr, 0, 2.6, -0.2, sh); box(4.2, 2.4, 0.06, gl, 0, 1.35, -0.95, sh); for (const x of [-2, 2]) box(0.1, 2.6, 0.1, fr, x, 1.3, -0.9, sh); box(3, 0.1, 0.45, mat(0x6b4a2a), 0, 0.5, -0.65, sh);
    const sg = new THREE.Mesh(own(new THREE.PlaneGeometry(0.9, 0.5)), own(new THREE.MeshBasicMaterial({ map: ctex(180, 100, (g, w, h) => { g.fillStyle = '#1565c0'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '800 46px system-ui'; g.textAlign = 'center'; g.fillText('🚌 12', w / 2, 66); }) }))); sg.position.set(2.4, 2.4, 0.2); sh.add(sg); box(0.08, 2.6, 0.08, fr, 2.4, 1.3, 0.2, sh); }
  // общината и реалистичните сгради наоколо: всяка по размера си, с лицето към улицата — не стъпват на улиците и тротоарите
  load(HALL).then(g => { if (!g || shut) return; const h = fitTo(g.scene.clone(true), { w: 30 }); h.position.set(0, 0, -27); scene.add(h); shadows(h); });
  Promise.all(BLD.map(load)).then(gs => {
    gs = gs.filter(Boolean); if (!gs.length || shut) return; let n = 0;
    const next = w => { const g = gs[n++ % gs.length], b = fitTo(g.scene.clone(true), { w, maxH: 34 }); shadows(b); return b; };
    // ред по оста: along 'x' или 'z' от a0 до a1; edge — близкият ръб; dir — накъдето расте сградата (±1); ry — лицето ѝ
    const row = (along, a0, a1, edge, dir, ry, skip = () => false) => { let c = a0; while (c < a1) { const w = 13 + (n % 4) * 3, b = next(w), sz = b.userData.sz, L = along === 'x' ? (Math.abs(Math.sin(ry)) > 0.5 ? sz.z : sz.x) : (Math.abs(Math.sin(ry)) > 0.5 ? sz.x : sz.z), D = along === 'x' ? (Math.abs(Math.sin(ry)) > 0.5 ? sz.x : sz.z) : (Math.abs(Math.sin(ry)) > 0.5 ? sz.z : sz.x);
      const mid = c + L / 2; if (c + L > a1 || skip(c, c + L)) { c += 4; continue; } b.rotation.y = ry; if (along === 'x') b.position.set(mid, 0, edge + dir * D / 2); else b.position.set(edge + dir * D / 2, 0, mid); scene.add(b); c += L + 2; } };
    const nearB = (a, b) => b > eB0 - SW - 2 && a < eB1 + SW + 2;
    row('x', -100, 100, eA1 + SW + 1, 1, Math.PI, nearB);            // отвъд улица А (лице към площада)
    row('z', -60, eA0 - SW - 1, eB1 + SW + 1, 1, -Math.PI / 2);      // отвъд улица Б
    row('z', -60, eA0 - SW - 1, -30, -1, Math.PI / 2);                // вляво от площада и парка
    row('x', -27, -16, -34, -1, 0); row('x', 16, eB0 - SW - 1, -34, -1, 0);   // до общината
  });
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
  const crowd = [], staff = [], rioters = []; let copSrc = null, shieldSrc = null; const COP_HIP = 0.98;
  // полицаят е в метри, клиповете на минувачите — в сантиметри: само завъртанията (без преместване на таза)
  const rotCache = new Map(), rotOnly = c => rotCache.get(c) || (rotCache.set(c, new THREE.AnimationClip(c.name, c.duration, c.tracks.filter(t => /\.quaternion$/.test(t.name)))), rotCache.get(c));
  const shieldG = own(new THREE.BoxGeometry(0.62, 1.05, 0.05)), shieldM = own(new THREE.MeshPhysicalMaterial({ color: 0xbcd4ff, transparent: true, opacity: 0.55, roughness: 0.2 }));
  function person(src, opt = {}) {
    const body = cloneSkinned(src.scene), p = src === copSrc ? new THREE.Group() : body; if (p !== body) { body.position.y = COP_HIP; p.add(body); }   /* полицаят: центърът му е в таза — повдигаме тялото */
    p.scale.setScalar(src.k * (0.95 + Math.random() * 0.1));
    p.traverse(o => { if (!o.isMesh) return; o.castShadow = true; o.frustumCulled = false;
      if (opt.tint) { o.material = own(o.material.clone()); const hsl = {}; o.material.color.getHSL(hsl); if (!(hsl.h > 0.02 && hsl.h < 0.12 && hsl.l > 0.45)) o.material.color.lerp(new THREE.Color(opt.tint), 0.75); } });
    scene.add(p);
    const mixer = new THREE.AnimationMixer(body), acts = {};
    const anims = src.animations.length ? src.animations : (pedSrc[0] ? pedSrc[0].animations : []);   /* полицаят (riot-cop) е без свои клипове — взима Walk/Idle от минувачите */
    const play = n => { let c = clips[n] || anims.find(a => a.name === n) || anims.find(a => a.name.includes(n)) || anims.find(a => /Idle/.test(a.name)); if (c && src === copSrc) c = rotOnly(c); /* своите са Ped_Walk_* / Ped_Idle */ if (!c) return; if (!acts[n]) acts[n] = mixer.clipAction(c); for (const [k, a] of Object.entries(acts)) if (k !== n && a.isRunning()) a.fadeOut(0.3); acts[n].reset().fadeIn(0.3).play(); };
    const P = { p, body, mixer, play, src, sign: null, x: 0, z: 0, ry: 0, goal: null, sp: 1.3, cur: '' };
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
  function dropPerson(P, list) { scene.remove(P.p); if (P.sign) scene.remove(P.sign); P.mixer.stopAllAction(); P.mixer.uncacheRoot(P.body || P.p); list.splice(list.indexOf(P), 1); }
  // екипите на място: [кой, позиции, анимация, оцветяване]
  const STAFF = {
    neg: { at: [[-0.8, ZONE.talk[1] - 1.1, 0], [0.8, ZONE.talk[1] - 1.1, 0]], org: [[-0.8, ZONE.talk[1] + 1.1, Math.PI], [0.8, ZONE.talk[1] + 1.1, Math.PI]], anim: 'Talk_General', tint: 0x2b2f3a },
    med: { at: [[ZONE.med[0] - 1, ZONE.med[1] + 1, Math.PI / 2], [ZONE.med[0] + 1, ZONE.med[1] + 1.2, -Math.PI / 2]], anim: 'Look_Around', tint: 0xf2f2f2 },
    pol: { at: [[-15, ZONE.cordon - 1, Math.PI], [-3, ZONE.cordon - 1, Math.PI], [9, ZONE.cordon - 1, Math.PI], [20, ZONE.cordon - 1, Math.PI]], anim: 'Look_Around', tint: 0x1f3a7a },
    riot: { at: [6, 8, 10, 12, 14, 16, 18].map(x => [x, RIOT_Z[1] - 5, 0]), anim: 'Idle', tint: 0x23272e, shield: true },
  };
  const staffOn = { neg: false, med: false, pol: false, riot: false };
  function setStaff(k, on) {
    if (staffOn[k] === on || !pedSrc.length) return; staffOn[k] = on;
    if (!on) { for (const P of staff.filter(q => q.team === k)) dropPerson(P, staff); return; }
    const S0 = STAFF[k];
    const cop = (k === 'pol' || k === 'riot') && copSrc;
    const put = (list, tint) => list.forEach(([x, z, ry], i) => { const P = person(cop || pedSrc[(i + (k === 'pol' ? 1 : 0)) % pedSrc.length], { tint: cop ? null : tint }); P.team = k; P.x = x; P.z = z; P.ry = ry; P.p.position.set(x, 0, z); P.p.rotation.y = ry; setAnim(P, S0.anim); P.mixer.update(Math.random() * 2); staff.push(P); });
    put(S0.at, S0.tint); if (S0.org) put(S0.org, null);
    if (S0.shield) for (const P of staff.filter(q => q.team === k)) { const sh = shieldSrc ? fitTo(shieldSrc.scene.clone(true), { h: 1.15 }) : new THREE.Mesh(shieldG, shieldM); if (shieldSrc) { sh.rotation.y = Math.PI / 2; shadows(sh); } sh.position.set(0.1 / P.p.scale.x, (shieldSrc ? 0.35 : 1.0) / P.p.scale.x, 0.45 / P.p.scale.x); sh.scale.setScalar(1 / P.p.scale.x); P.p.add(sh); }
  }

  // ---- 🔥 безредиците: подпалени кофи (пламък, който трепти, и оранжева светлина) и група провокатори
  // огнищата: кофите горят веднага; с растящите щети пламват контейнер, боклук и коли (остават изгорели и след безредиците)
  const flameT = ctex(64, 128, (g, w, h) => { const r = g.createRadialGradient(w / 2, h * 0.7, 2, w / 2, h * 0.6, h * 0.5); r.addColorStop(0, 'rgba(255,240,180,1)'); r.addColorStop(0.35, 'rgba(255,150,40,.9)'); r.addColorStop(0.75, 'rgba(220,60,10,.35)'); r.addColorStop(1, 'rgba(120,20,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
  const flameM = own(new THREE.SpriteMaterial({ map: flameT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const SPOTS = [
    { x: 9, z: 13, bin: true, at: 0, fl: 0.9 }, { x: 14, z: 9.5, bin: true, at: 0, fl: 0.9 }, { x: 17, z: 14, bin: true, at: 0, fl: 0.9 },
    { x: 5, z: 15.2, prop: 'dumpster', len: 2.6, ry: 0.3, at: 4e6, fl: 1.6, light: true },
    { x: 11, z: 15.6, prop: 'trash-pile', len: 1.8, ry: 1.2, at: 9e6, fl: 1.0 }, { x: 21, z: 7, prop: 'trash-pile', len: 1.6, ry: -0.4, at: 14e6, fl: 1.0 },
    { x: 20, z: 15.4, prop: 'burnt-car-a', len: 4.5, ry: 1.75, at: 18e6, fl: 2.2, light: true },
    { x: -3, z: 15.4, prop: 'burnt-car-b', len: 4.6, ry: 1.4, at: 30e6, fl: 2.2, light: true },
    { x: 24.5, z: -4, prop: 'burnt-police', len: 4.8, ry: 0.1, at: 42e6, fl: 2.0 },
    { x: 2, z: 11, prop: 'trash-pile', len: 1.5, ry: 2.4, at: 24e6, fl: 0.9 },
  ];
  const fires = SPOTS.map((S1, i) => { const g = new THREE.Group(); g.position.set(S1.x, 0, S1.z); g.rotation.y = S1.ry || 0; g.visible = false; scene.add(g); let bin = null;
    if (S1.bin) { bin = new THREE.Mesh(own(new THREE.CylinderGeometry(0.4, 0.34, 0.9, 12)), mat(0x2f3b2f, { metalness: 0.4 })); bin.position.y = 0.45; bin.castShadow = true; g.add(bin); }
    const fl = Array.from({ length: S1.prop ? 7 : 4 }, () => { const sp = new THREE.Sprite(flameM); sp.userData.o = [(Math.random() - 0.5) * S1.fl * 0.8, (Math.random() - 0.5) * S1.fl * 0.5, Math.random() * 6]; g.add(sp); return sp; });
    const L = S1.light || i === 0 ? new THREE.PointLight(0xff8a3a, 0, 11, 1.6) : null; if (L) { L.position.y = 1.8; g.add(L); }
    return { S1, g, fl, L, bin, loaded: false }; });
  const showSpot = F => { if (F.loaded || !F.S1.prop) return; F.loaded = true; load(RIOT + F.S1.prop + '.glb').then(gl => { if (!gl || shut) return; const o = fitTo(gl.scene.clone(true), { len: F.S1.len }); shadows(o); F.g.add(o); }); };
  // 🌫️ димът от кофите — общ пул от спрайтове (растат, издигат се и избледняват)
  const smokeT = ctex(64, 64, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 2, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(70,70,70,.85)'); r.addColorStop(1, 'rgba(70,70,70,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
  const smoke = Array.from({ length: 48 }, () => { const sp = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: smokeT, transparent: true, depthWrite: false, opacity: 0 }))); sp.visible = false; scene.add(sp); return { sp, life: 0 }; });
  let smokeT0 = 0;
  // 🍾 хвърлени предмети (бутилки и камъни) — по дъга, после изчезват
  const bottleG = own(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 6)), stoneG = own(new THREE.DodecahedronGeometry(0.1)), bottleM = mat(0x2e6b3a, { roughness: 0.3 }), stoneM = mat(0x777370);
  const flying = [];
  const throwAt = (P, tx, tz) => { const b = new THREE.Mesh(Math.random() < 0.5 ? bottleG : stoneG, Math.random() < 0.5 ? bottleM : stoneM); scene.add(b); flying.push({ b, x0: P.x, z0: P.z, x1: tx + (Math.random() - 0.5) * 2, z1: tz + (Math.random() - 0.5) * 1.5, t: 0, T: 0.8 + Math.random() * 0.4 }); };
  // 🛡️ редицата на силите на реда настъпва; задържаните — по двойки до колата
  let lineZ = RIOT_Z[1] - 5, arrestT = 0, shown = 0; const pairs = [];
  const van = () => [ENTRY.riot[1][0] - 2.4, ENTRY.riot[1][1] + 1];
  const walkTo = (P, x, z, sp, dt) => { const dx = x - P.x, dz = z - P.z, d = Math.hypot(dx, dz); if (d < 0.3) return true; const st = Math.min(d, sp * dt); P.x += dx / d * st; P.z += dz / d * st; P.ry = Math.atan2(dx, dz); return false; };
  function riotScene(m, tt, dt) {
    const on = !!m.riot && !m.out, burnt = m.damage > 0, force = m.teams.riot && m.teams.riot.st === 'onsite';
    for (const [i, F] of fires.entries()) { const lit = (m.riot || m.damage > 0) && m.damage >= F.S1.at; F.g.visible = lit; if (!lit) continue; showSpot(F);
      const burning = on; for (const [j, sp] of F.fl.entries()) { sp.visible = burning; if (!burning) continue; const [ox, oz, ph] = sp.userData.o, u = (tt * 1.6 + ph + j * 0.37) % 1, s0 = F.S1.fl;
        sp.position.set(ox, (F.S1.bin ? 0.9 : 0.4) + u * s0 * 1.3, oz); sp.scale.set(s0 * (0.9 - u * 0.5), s0 * (1.3 - u * 0.4), 1); sp.material.opacity = 1; }
      if (F.L) F.L.intensity = burning ? 7 + Math.sin(tt * 13 + i) * 2.5 : 0; if (!burning && F.bin) F.bin.rotation.z = 1.4; }
    // дим: докато гори — по-гъст; след угасяване — още малко
    smokeT0 -= dt; if ((on || (burnt && Math.random() < 0.15)) && smokeT0 <= 0) { smokeT0 = on ? 0.12 : 0.6; const vis = fires.filter(q => q.g.visible), F = vis[(Math.random() * vis.length) | 0] || fires[0], S0 = smoke.find(q => q.life <= 0); if (S0) { S0.life = 1; S0.sp.visible = true; S0.sp.position.set(F.g.position.x + (Math.random() - 0.5) * 0.4, 2, F.g.position.z + (Math.random() - 0.5) * 0.4); S0.dx = 0.4 + Math.random() * 0.4; } }
    for (const S0 of smoke) if (S0.life > 0) { S0.life -= dt / 4; const a = 1 - S0.life; S0.sp.position.y += dt * 1.4; S0.sp.position.x += dt * S0.dx; S0.sp.scale.setScalar(1 + a * 5); S0.sp.material.opacity = Math.max(0, S0.life) * 0.55; if (S0.life <= 0) S0.sp.visible = false; }
    // провокаторите: допълват се, докато силите на реда ги няма
    if (on && !force && pedSrc.length) while (rioters.filter(P => !P.goal && !P.held).length < 10) { const P = person(pedSrc[(rioters.length + 2) % pedSrc.length], { tint: 0x26282c }); P.x = RIOT_Z[0] + (Math.random() - 0.5) * 10; P.z = RIOT_Z[1] + (Math.random() - 0.5) * 4; P.ry = Math.random() * 6.28; P.p.position.set(P.x, 0, P.z); P.next = 0; setAnim(P, 'Talk_Arguing'); rioters.push(P); }
    if (!on) for (const P of rioters) if (!P.goal && !P.held) { P.goal = [ST_B + 8, 60]; setAnim(P, 'Walk'); }
    // редицата: настъпва, докато има провокатори пред нея
    const officers = staff.filter(q => q.team === 'riot');
    if (force && on) lineZ = Math.min(RIOT_Z[1] + 2, lineZ + 0.5 * dt);
    for (const O of officers) if (!O.busy) { const moving = force && on && lineZ < RIOT_Z[1] + 2; O.z = lineZ; O.ry = 0; O.p.position.set(O.x, 0, O.z); O.p.rotation.y = 0; setAnim(O, moving ? 'Walk' : 'Idle'); }
    // задържане: свободен полицай + най-близкият провокатор → заедно до колата
    if (force && on) { arrestT -= dt; if (arrestT <= 0) { arrestT = 1.4; const O = officers.find(q => !q.busy), cand = rioters.filter(P => !P.goal && !P.held).sort((a, b) => a.z - b.z)[0];
      if (O && cand) { O.busy = true; cand.held = true; O.hx = O.x; setAnim(O, 'Walk'); setAnim(cand, 'Walk'); pairs.push({ O, P: cand, st: 'grab' }); } } }
    for (const pr of [...pairs]) { const { O, P } = pr;
      if (pr.st === 'grab') { if (walkTo(O, P.x, P.z - 0.8, 2.2, dt)) pr.st = 'lead'; }
      else if (pr.st === 'lead') { const [vx, vz] = van(); walkTo(P, vx, vz, 1.6, dt); O.x = P.x - Math.sin(P.ry) * 0.7; O.z = P.z - Math.cos(P.ry) * 0.7; O.ry = P.ry; if (Math.hypot(P.x - vx, P.z - vz) < 0.5) { dropPerson(P, rioters); shown++; pr.st = 'back'; } }
      else if (walkTo(O, O.hx, lineZ, 2.2, dt)) { O.busy = false; pairs.splice(pairs.indexOf(pr), 1); continue; }
      O.p.position.set(O.x, 0, O.z); O.p.rotation.y = O.ry; }
    // провокаторите: тичат, викат и хвърлят по полицията (или по колите и витрините, ако няма полиция)
    const tgt = force ? [RIOT_Z[0], lineZ] : m.teams.pol.st === 'onsite' ? [9, ZONE.cordon - 1] : [ST_B, ST_A];
    for (const P of [...rioters]) {
      if (P.held) { P.p.position.set(P.x, 0, P.z); P.p.rotation.y = P.ry; P.mixer.update(dt); continue; }
      if (P.goal) { if (walkTo(P, P.goal[0], P.goal[1], 2.4, dt)) { dropPerson(P, rioters); continue; } }
      else {
        const minZ = force ? lineZ + 2.5 : RIOT_Z[1] - 3;
        if (P.z < minZ) { walkTo(P, P.x, minZ + 0.5, 3, dt); setAnim(P, 'Walk'); }   // отстъпват пред щитовете
        else if ((P.next -= dt) <= 0) { P.next = 1.5 + Math.random() * 2.5; const r = Math.random();
          if (r < 0.35) { P.tx = Math.max(3, Math.min(22, P.x + (Math.random() - 0.5) * 6)); P.tz = Math.max(minZ, Math.min(16, P.z + (Math.random() - 0.5) * 4)); setAnim(P, 'Walk'); }
          else if (r < 0.7) { P.tx = null; P.ry = Math.atan2(tgt[0] - P.x, tgt[1] - P.z); setAnim(P, 'Waving'); throwAt(P, tgt[0], tgt[1]); }
          else { P.tx = null; setAnim(P, 'Talk_Arguing'); } }
        if (P.tx != null && walkTo(P, P.tx, P.tz, 2.6, dt)) { P.tx = null; setAnim(P, 'Talk_Arguing'); }
      }
      P.p.position.set(P.x, 0, P.z); P.p.rotation.y = P.ry; P.mixer.update(dt * (P.tx != null ? 1.5 : 1));
    }
    for (const f of [...flying]) { f.t += dt / f.T; const u = Math.min(1, f.t); f.b.position.set(f.x0 + (f.x1 - f.x0) * u, 1.8 + Math.sin(u * Math.PI) * 3 - u * 1.7, f.z0 + (f.z1 - f.z0) * u); f.b.rotation.x += dt * 9; if (u >= 1) { scene.remove(f.b); flying.splice(flying.indexOf(f), 1); } }
    hud.textContent = on ? `🔥 Безредици · 🛡️ задържани: ${Math.max(shown, 0)}` : ''; hud.style.display = on ? '' : 'none';
  }
  // 🔊 шумът на протеста (Pixabay): по-силен с напрежението, най-силен при безредици; заглъхва след решението; спира при затваряне
  const noise = new Audio('assets/sfx/protest.mp3'); noise.loop = true; noise.volume = 0; let noiseV = 0;
  const muted = () => !!(o.muted && o.muted());
  function noiseStep(m, dt) { const want = muted() ? 0 : m.out ? 0 : Math.min(0.9, 0.18 + m.tension / 160 + (m.riot ? 0.3 : 0)); noiseV += (want - noiseV) * Math.min(1, dt * 1.5); noise.volume = Math.max(0, Math.min(1, noiseV)); if (noiseV > 0.01 && noise.paused) noise.play().catch(() => {}); else if (noiseV <= 0.01 && !noise.paused) noise.pause(); }
  const hud = document.createElement('div'); hud.style.cssText = 'position:absolute;left:50%;top:58px;transform:translateX(-50%);padding:5px 14px;border-radius:999px;background:#8a1c1ccc;color:#fff;font:800 14px system-ui;display:none;pointer-events:none'; el.appendChild(hud);
  // ---- колите на екипите: позицията — от времето на мисията
  const veh = {}, labels = {};
  for (const k of Object.keys(OPS_TEAMS)) {
    load(VEH[k]).then(g => { if (!g || shut) return; const v = EMC[k] ? emergCar(g.scene, EMC[k][1], EMC[k][0], k === 'med' ? 'amb-eu' : '') : fitTo(g.scene.clone(true), { len: k === 'med' || k === 'riot' ? 6 : 4.8 }); shadows(v); const hold = new THREE.Group(); hold.add(v); hold.visible = false; scene.add(hold); veh[k] = hold; if (EMC[k]) hold.userData.car = v;
      if (k !== 'neg' && !EMC[k]) { const L = []; for (const [c, dx] of [[0xff2020, -0.35], [0x2060ff, 0.35]]) { const b = new THREE.Mesh(own(new THREE.SphereGeometry(0.16, 10, 8)), own(new THREE.MeshBasicMaterial({ color: c }))); b.position.set(dx, k === 'med' ? 2.9 : 1.6, 0.2); hold.add(b); L.push(b); } hold.userData.beacons = L; } });
    const lb = document.createElement('div'); lb.className = 'lb'; lb.style.display = 'none'; el.querySelector('.lbs').appendChild(lb); labels[k] = lb;
  }
  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  // 🚓 колоната: след първата кола идват още (спират в редица зад нея, с малко закъснение)
  const CONVOY = { pol: [['pol-charger', 5.6, 0.02], ['pol-interceptor', 11.2, 0.04], ['pol-nypd', 16.8, 0.06]], riot: [['car-polsuv', 7, 0.03], ['pol-crownvic', 12.5, 0.05]] }, conv = [];
  for (const [k, list] of Object.entries(CONVOY)) for (const [nm, back, delay] of list) load(`assets/heavy/cars/${nm}.glb`).then(g => { if (!g || shut) return; const v = emergCar(g.scene, 5.2, 'police'); const h = new THREE.Group(); h.add(v); h.visible = false; scene.add(h); h.userData.car = v;
    const L = []; if (false) for (const [c, dx] of [[0xff2020, -0.35], [0x2060ff, 0.35]]) { const b = new THREE.Mesh(own(new THREE.SphereGeometry(0.16, 10, 8)), own(new THREE.MeshBasicMaterial({ color: c }))); b.position.set(dx, 1.6, 0.2); h.add(b); L.push(b); } conv.push({ k, h, back, delay, L }); });
  function placeConvoy(m, tt) { for (const c of conv) { const tm = m.teams[c.k]; if (!tm) continue; const [a, b0] = ENTRY[c.k], dir = Math.atan2(b0[0] - a[0], b0[1] - a[1]), ux = Math.sin(dir), uz = Math.cos(dir), b = [b0[0] - ux * c.back, b0[1] - uz * c.back]; let pos = null;
    if (tm.st === 'enroute') { const p = Math.max(0, Math.min(1, (m.t - tm.t0 - c.delay) / tm.eta)); pos = p > 0 ? lerp2(a, b, 1 - Math.pow(1 - p, 2)) : null; }
    else if (tm.st === 'onsite') pos = b;
    else if (tm.st === 'back') { const p = Math.min(1, (m.t - tm.t0) / BACK_DAYS); if (p < 1) pos = lerp2(b, [b[0] + (b[0] - a[0]) * 0.8, b[1] + (b[1] - a[1]) * 0.8], p * p); }
    c.h.visible = !!pos; if (pos) { c.h.position.set(pos[0], 0, pos[1]); c.h.rotation.y = dir; } const on = tm.st === 'enroute' || tm.st === 'onsite'; c.h.userData.car.userData.beaconsOn = on; c.L.forEach((s0, i) => { s0.visible = on && ((tt * 3 + i + c.back) | 0) % 2 === 0; }); } }
  function placeVehicles(m, tt) {
    placeConvoy(m, tt);
    for (const [k, tm] of Object.entries(m.teams)) {
      const h = veh[k], lb = labels[k], T = OPS_TEAMS[k]; if (!lb) continue; let pos = null, ry = 0, txt = '';
      const [a, b] = ENTRY[k], dir = Math.atan2(b[0] - a[0], b[1] - a[1]);
      if (tm.st === 'enroute') { const p = Math.min(1, (m.t - tm.t0) / tm.eta), e = 1 - Math.pow(1 - p, 2); pos = lerp2(a, b, e); ry = dir; txt = `${T.ico} ${T.nm} · на път ${Math.round(p * 100)}%`; }
      else if (tm.st === 'onsite') { pos = b; ry = dir; txt = `${T.ico} ${T.nm} · на място`; }
      else if (tm.st === 'back') { const p = Math.min(1, (m.t - tm.t0) / BACK_DAYS); if (p < 1) { pos = lerp2(b, [b[0] + (b[0] - a[0]) * 0.8, b[1] + (b[1] - a[1]) * 0.8], p * p); ry = dir; txt = `${T.ico} прибира се`; } }
      if (h) { h.visible = !!pos; if (pos) { h.position.set(pos[0], 0, pos[1]); h.rotation.y = ry; } if (h.userData.car) h.userData.car.userData.beaconsOn = tm.st === 'enroute' || tm.st === 'onsite'; const B = h.userData.beacons; if (B) { const on = tm.st === 'enroute' || tm.st === 'onsite'; B.forEach((s, i) => { s.visible = on && ((tt * 3 + i) | 0) % 2 === 0; }); } }
      lb.style.display = pos ? '' : 'none'; if (pos) { lb.textContent = txt; tmp.set(pos[0], k === 'med' ? 3.8 : 2.6, pos[1]).project(cam); lb.style.left = `${(tmp.x + 1) / 2 * innerWidth}px`; lb.style.top = `${(1 - tmp.y) / 2 * innerHeight}px`; if (tmp.z > 1) lb.style.display = 'none'; }
      setStaff(k, tm.st === 'onsite');
    }
    medT.visible = m.teams.med.st === 'onsite'; cordon.visible = m.teams.pol.st === 'onsite';
  }
  const tmp = new THREE.Vector3();
  // 🚨 сирените: докато колата на екипа е на път — по-силно с приближаването, спира на място
  const SIREN = { pol: 'siren-police', riot: 'siren-police-3', med: 'siren-ambulance' }, sirens = {};
  function sirenStep(m) { for (const [k, f] of Object.entries(SIREN)) { const tm = m.teams[k]; const on = tm && tm.st === 'enroute' && !(o.muted && o.muted());
    let a = sirens[k]; if (on && !a) { a = sirens[k] = new Audio(`assets/sfx/${f}.mp3`); a.loop = true; a.volume = 0; a.play().catch(() => {}); }
    if (!a) continue; if (on) a.volume = Math.min(0.75, 0.15 + 0.6 * Math.min(1, (m.t - tm.t0) / tm.eta)); else { a.volume = Math.max(0, a.volume - 0.03); if (a.volume <= 0.01) { a.pause(); a.src = ''; delete sirens[k]; } } } }
  // ---- трафикът: коли и автобус по двете улици, светофар на кръстовището (фази по 7 s), дистанция и спирка за автобуса.
  // Докато полицията държи кордона, улица А е затворена — колите минават само по Б.
  const cars = []; let carsLoaded = false;
  const LANES = [{ ax: 'a', d: 1, off: 2.2 }, { ax: 'a', d: -1, off: -2.2 }, { ax: 'b', d: 1, off: -2.2 }, { ax: 'b', d: -1, off: 2.2 }];
  function loadTraffic() {
    if (carsLoaded) return; carsLoaded = true;
    [...TRAFFIC, BUS, BUS].forEach((p, i) => load(p).then(g => { if (!g || shut) return; const bus = p === BUS, v = fitTo(g.scene.clone(true), { len: bus ? 11.5 : 4.4 }); shadows(v); const h = new THREE.Group(); h.add(v); scene.add(h);
      const L = bus ? LANES[i % 2 ? 1 : 3] : LANES[i % 4]; cars.push({ h, L, u: -95 + ((i * 37) % 190), sp: bus ? 8 : 10 + Math.random() * 4, len: bus ? 12 : 5, bus, wait: 0 }); }));
  }
  const CYCLE = 14, green = (ax, tt) => { const t = tt % CYCLE; return ax === 'a' ? t < 6 : t >= 7 && t < 13; };
  function moveCars(dt, tt, closedA) {
    for (const Lt of lights) { const g = green(Lt.ax, tt); for (const o of Lt.green) o.visible = g; for (const o of Lt.red) o.visible = !g; }
    for (const L of LANES) {
      const lane = cars.filter(c => c.L === L).sort((p, q) => (q.u - p.u) * L.d);   // първият е най-напред
      const jx = L.ax === 'a' ? ST_B : ST_A, stopAt = jx - L.d * (ROAD_W / 2 + 4);
      lane.forEach((c, k) => {
        const hide = closedA && L.ax === 'a'; c.h.visible = !hide; if (hide) return;
        let mv = c.sp * dt; const ahead = lane[k - 1];
        if (ahead && ahead.h.visible) { const gap = (ahead.u - c.u) * L.d - (ahead.len + c.len) / 2 - 2; if (gap >= 0) mv = Math.min(mv, gap); }
        const toStop = (stopAt - c.u) * L.d; if (toStop > 0 && toStop < 14 && !green(L.ax, tt)) mv = Math.min(mv, Math.max(0, toStop - c.len / 2));
        if (c.bus && L.ax === 'a') { const toBus = (-24 - c.u) * L.d; if (c.wait > 0) { c.wait -= dt; mv = 0; } else if (toBus > 0 && toBus < mv + 0.01 && L.d < 0) { c.wait = 4; c.u = -24; mv = 0; } }
        c.u += mv * L.d; if (c.u * L.d > 100) c.u = -100 * L.d;
        if (L.ax === 'a') { c.h.position.set(c.u, 0, ST_A + L.off); c.h.rotation.y = L.d > 0 ? Math.PI / 2 : -Math.PI / 2; }
        else { c.h.position.set(ST_B + L.off, 0, c.u); c.h.rotation.y = L.d > 0 ? 0 : Math.PI; }
      });
    }
  }
  // минувачи по тротоарите (ходят напред-назад)
  const walkers = [];
  function addWalkers() {
    const W = [[eA0 - SW / 2, 'x'], [eA1 + SW / 2, 'x'], [eB0 - SW / 2, 'z'], [eB1 + SW / 2, 'z']];
    for (let k = 0; k < 16; k++) { const [c, ax] = W[k % 4], P = person(pedSrc[k % pedSrc.length]); P.ax = ax; P.c = c + (Math.random() - 0.5) * 1.2; P.u = -70 + Math.random() * 140; P.d = Math.random() < 0.5 ? 1 : -1; P.sp = 1.2 + Math.random() * 0.5; setAnim(P, 'Walk'); P.mixer.update(Math.random() * 2); walkers.push(P); }
  }
  function moveWalkers(dt) { for (const P of walkers) { P.u += P.d * P.sp * dt; if (Math.abs(P.u) > 75) P.d *= -1; const x = P.ax === 'x' ? P.u : P.c, z = P.ax === 'x' ? P.c : P.u; P.p.position.set(x, 0.15, z); P.p.rotation.y = P.ax === 'x' ? (P.d > 0 ? Math.PI / 2 : -Math.PI / 2) : (P.d > 0 ? 0 : Math.PI); P.mixer.update(dt); } }

  // ---- панелът: статус, екипи, решения, хроника
  const pn = el.querySelector('.pn'), phEl = el.querySelector('.ph'); let pnSig = '';
  // бутоните — още при натискане (панелът се прерисува често; click би се изгубил между натискането и пускането)
  pn.addEventListener('pointerdown', e => { const b = e.target.closest('[data-go],[data-ch]'); if (!b || b.disabled) return; e.preventDefault(); if (b.dataset.go) ops.dispatch(b.dataset.go); else ops.choose(b.dataset.ch); pnSig = ''; });
  const B = n => n >= 1e9 ? `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: 2 })} млрд. €` : n >= 1e6 ? `${(n / 1e6).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млн. €` : `${Math.round(n / 1e3)} хил. €`;
  const bar = (v, col) => `<div class="bar"><i style="width:${Math.round(v)}%;background:${col}"></i></div>`;
  function panel(m) {
    const tCol = m.tension >= 60 ? '#ff6b6b' : m.tension >= 35 ? '#ffd54a' : '#5fe39a', left = m.budget - m.spent;
    const sig = [m.phase, m.riot, Math.round(m.damage / 1e6), Math.round(m.tension), Math.round(m.crowd / 5), Math.round(m.talks * 20), m.out, m.log.length, left, ...Object.values(m.teams).map(t => t.st)].join('|');
    if (sig === pnSig) return; pnSig = sig;
    phEl.textContent = opsPhaseName(m.phase, m); phEl.style.background = m.riot && !m.out ? '#8a1c1c' : '';
    const st = tm => ({ ready: '⚪ в готовност', enroute: '🟡 на път', onsite: '🟢 на място', back: m.t - tm.t0 > BACK_DAYS ? '✔️ приключи' : '⚫ прибира се' }[tm.st]);
    let h = `<b>📢 Искането</b><div class="m" style="margin:2px 0 8px;color:#e6edf6">„${m.demand}“</div>
      <div class="m">🌡️ Напрежение: <b style="color:${tCol}">${Math.round(m.tension)}</b></div>${bar(m.tension, tCol)}
      <div class="m">👥 На площада: ~${Math.round(m.crowd)} души${m.faint ? ` · 🥵 припаднали: ${m.faint}` : ''}</div>
      <div class="m">💶 Бюджет на мисията: <b style="color:#e6edf6">${B(left)}</b> от ${B(m.budget)}</div>${m.riot && !m.out ? `<div class="m" style="color:#ff8a8a;margin:4px 0">🔥 <b>Безредици</b> — щети ${B(m.damage)} досега. Изпрати 🛡️ силите на реда или свали напрежението под 50 с разговор.</div>` : m.damage ? `<div class="m">🔥 Щети от безредиците: ${B(m.damage)}${m.arrests ? ` · 🛡️ задържани: ${m.arrests}` : ''}</div>` : ''}<div class="m" style="margin-bottom:6px">ℹ️ Протестът е мирен, докато напрежението е под ${RIOT_AT}. Над ${RIOT_AT} — безредици.</div>`;
    h += `<b>🚗 Екипи</b>${Object.entries(OPS_TEAMS).filter(([k, T]) => !T.riot || m.riot || (m.teams[k] && m.teams[k].st !== 'ready')).map(([k, T]) => `<div class="tm"><span class="i">${T.ico}</span><div style="flex:1"><b>${T.nm}</b><div class="m">${T.job}</div><div class="m">${st(m.teams[k] || { st: 'ready' })} · ${B(T.cost)}</div></div>${(m.teams[k] || { st: 'ready' }).st === 'ready' && !m.out ? `<button class="y" data-go="${k}">Изпрати</button>` : ''}</div>`).join('')}`;
    if (!m.out) {
      if (m.teams.neg.st === 'onsite') h += `<b>🤝 Преговорите</b>${bar(m.talks * 100, '#4fc3f7')}` + (m.talks >= 1 ? Object.entries(OPS_CHOICES).map(([c, C]) => `<button style="display:block;width:100%;text-align:left;margin:4px 0" data-ch="${c}">${C.ico} ${C.nm}${C.k ? ` · ${B(m.budget * C.k)}` : ''}</button>`).join('') : '<div class="m">Изслушват организаторите…</div>');
      else h += `<div class="m" style="margin-top:6px">💡 Без преговарящи няма решение — напрежението расте, а след ${8} дни хората се разотиват недоволни.</div>`;
    } else h += `<div style="margin:8px 0;padding:8px;border-radius:10px;background:${m.out === 'deal' ? '#123d27' : '#3a2f12'}">${m.out === 'deal' ? '✅ Споразумение' : m.out === 'partial' ? '📋 Частично решение' : '🌧️ Протестът се разотиде недоволен'}</div>`;
    h += `<b>📰 Хроника</b>${m.log.map(x => `<div class="m">${x.txt}</div>`).join('')}`;
    pn.innerHTML = h;
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
      const want = m.out ? (m.out === 'partial' ? Math.round(Math.min(70, m.crowd / 3) * 0.4) : 0) : Math.max(12, Math.min(70, Math.round(m.crowd / 3)));
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
      placeVehicles(m, tt); riotScene(m, tt, dt * Math.min(speed, 2)); noiseStep(m, dt); sirenStep(m);
      loadTraffic(); moveCars(dt * Math.min(speed, 2), tt, m.teams.pol.st === 'onsite' && !m.out); moveWalkers(dt * Math.min(speed, 2));
      // светлината: при напрежение — по-сиво и студено, след решението — слънце
      const k = m.out === 'deal' ? 1 : 1 - m.tension / 140; sun.intensity = 1.2 + k * 1.4; sky.setRGB(0.55 + k * 0.12, 0.62 + k * 0.14, 0.7 + k * 0.16); scene.fog.color.copy(sky);
      panel(m);
    }
    ctl.update(); clampCam(); renderer.render(scene, cam);
  }
  function clampCam() { const t = ctl.target, c = cam.position; t.x = Math.max(-24, Math.min(30, t.x)); t.z = Math.max(-20, Math.min(26, t.z)); t.y = 2; c.x = Math.max(-28, Math.min(36, c.x)); c.z = Math.max(-24, Math.min(34, c.z)); if (c.y < 6) c.y = 6; }   // камерата — над площада и улиците, не в сградите
  Promise.all([...PEDS.map(load), load(ANIMS), load(RIOT + 'riot-cop.glb'), load(RIOT + 'shield.glb')]).then(gs => {
    if (shut) return; shieldSrc = gs.pop(); copSrc = gs.pop(); if (copSrc) copSrc.k = 0.97;   /* в поза ~1,9 м */ const an = gs.pop(); if (an) for (const c of an.animations) clips[c.name] = c;
    pedSrc = gs.filter(Boolean).map(g => { if (!g.k) { g.scene.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(g.scene, true); g.k = 1.8 / ((b.max.y - b.min.y) || 1); } return g; });
    ready = true; el.querySelector('.ld').remove(); addWalkers();
  });
  frame();

  const onResize = () => { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); };
  const key = e => { if (e.key === 'Escape') close(); };
  addEventListener('resize', onResize); addEventListener('keydown', key);
  el.querySelector('[data-x]').onclick = () => close();

  function close() {
    if (shut) return; shut = true; cancelAnimationFrame(raf); noise.pause(); noise.src = ''; for (const a of Object.values(sirens)) { a.pause(); a.src = ''; }
    removeEventListener('resize', onResize); removeEventListener('keydown', key);
    for (const L of [crowd, staff, walkers, rioters]) for (const P of [...L]) dropPerson(P, L);
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
function fitTo(o, { len, w, h, maxH }) {
  o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  let k = h ? h / s.y : w ? w / s.x : len / Math.max(s.x, s.z); if (maxH && s.y * k > maxH) k = maxH / s.y;
  const inner = new THREE.Group(); o.position.set(-c.x, -b.min.y, -c.z); inner.add(o); inner.scale.setScalar(k);
  if (len && s.x > s.z) inner.rotation.y = Math.PI / 2;
  const hold = new THREE.Group(); hold.add(inner); hold.userData.sz = (len && s.x > s.z) ? { x: s.z * k, y: s.y * k, z: s.x * k } : { x: s.x * k, y: s.y * k, z: s.z * k }; return hold;
}
function shadows(o) { o.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; } }); }
