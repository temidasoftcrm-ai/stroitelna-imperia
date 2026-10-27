// online3d.js — 3D градът на „Онлайн империя“. Само РИСУВА състоянието от сървъра: централата, строежите (растат според
// start_at/end_at на сървъра) и готовите сгради. Нищо тук не решава пари или прогрес.
// Моделите са същите като в самостоятелната игра (Kenney/Quaternius от assets/). Мрежата е като в game.js: плочки 8 м,
// улица на всеки 3 плочки, ядро 9×9 парцела, офисът на (4,5).
import * as THREE from 'three';
import { canvasTex } from './texdata.js';   // fac-data (T1): статичните платна → собствени данни (не се губят)
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { feature } from './lab/feature.js';
import { loadConstruct } from './construct.js';
import { splitTrees } from './treesplit.js';

const TILE = 8, NB = 9, N = NB * 3 + 1, C = (NB - 1) / 2, HQ = [4, 5];
const tx = i => (i - (N - 1) / 2) * TILE;
const isRoad = (i, j) => i % 3 === 0 || j % 3 === 0;
const KENNEY = ['building-type-a', 'building-type-b'];   // детските c…u вече не се зареждат
// истинските къщи вместо детските Kenney (feature 'houses-real'): A/B (assets/houses) и одобрените h2-* (assets/heavy/houses2)
const H2 = ['h2-greyporch', 'h2-brickcabin', 'h2-pink', 'h2-townhouse', 'h2-blue', 'h2-swedish', 'h2-lodge', 'h2-porch'].filter(n => feature(n));
const REAL = feature('houses-real') && H2.length >= 2 ? ['building-type-a', 'building-type-b', ...H2] : null;
const HOUSES = REAL || KENNEY;
const hFit = n => n.startsWith('h2-') ? 14 : n === 'building-type-a' || n === 'building-type-b' ? 15 : 11;
const SHOPS = 'abcdefgh'.split('').map(c => 'building-' + c);
const SKY = ['building-skyscraper-a', 'building-skyscraper-b', 'building-skyscraper-c'];
const OFFICES = ['building-skyscraper-d', 'building-skyscraper-e', 'office3', 'hirise'];   // office3, hirise — истинските от heavy/blocks2
// trees-kenney-off (Лабораторията 21.10: „Изтрий окончателно“ за tree-large/tree-small): вместо конусите на Kenney — дърветата от горския пакет
const TREES_OFF = feature('trees-kenney-off');
const LIST = {
  roads: ['road-straight', 'road-crossroad', 'road-intersection', 'road-bend', 'construction-cone', 'light-square'],
  houses: [...(REAL ? ['building-type-a', 'building-type-b'] : KENNEY), ...(TREES_OFF ? [] : ['tree-large', 'tree-small'])],
  'heavy/houses2': REAL ? H2 : [],
  commercial: [...SHOPS, ...SKY],
  commercial2: ['building-skyscraper-d', 'building-skyscraper-e'],
  'heavy/blocks2': ['office3', 'hirise'],
};
const OWN_LOTS = 30;   // най-близките до офиса парцели са за строежите на фирмата; останалите — съседите

function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let s = seed || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296; }

export async function createCity3D(el, { onProgress } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9fc9ee); scene.fog = new THREE.Fog(0x9fc9ee, 260, 720);
  const camera = new THREE.PerspectiveCamera(45, 1, 1, 2000);
  const hemi = new THREE.HemisphereLight(0xdfefff, 0x5d6b45, 1.15); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.2); sun.position.set(90, 160, 60); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -130, right: 130, top: 130, bottom: -130, near: 1, far: 420 }); sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.46; controls.minDistance = 25; controls.maxDistance = 420;
  const lotXZ = (bi, bj) => [tx(3 * bi + 1.5), tx(3 * bj + 1.5)];
  const [hx, hz] = lotXZ(...HQ);
  controls.target.set(hx, 0, hz); camera.position.set(hx + 95, 110, hz + 120);
  const resize = () => { const w = el.clientWidth || 1, h = el.clientHeight || 1; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(el); resize();

  // ── модели ──
  const A = {}, loader = new GLTFLoader(), jobs = [];
  for (const [dir, list] of Object.entries(LIST)) for (const n of list) jobs.push(new Promise(res => loader.load(`assets/${dir}/${n}.glb`, g => { A[n] = g.scene; res(); }, undefined, () => res())));
  const SF = [];   // trees-kenney-off: отделните дървета (височина 1, основа в 0)
  if (TREES_OFF) for (const [f, opt] of [['forest', { trunksOnly: true }], ['pine', {}]]) jobs.push(new Promise(res => loader.load(`assets/heavy/trees/${f}.glb`, g => { SF.push(...splitTrees(g.scene, opt)); res(); }, undefined, () => res())));
  let done = 0; jobs.forEach(j => j.then(() => onProgress && onProgress(++done / jobs.length)));
  await Promise.all(jobs);
  await loadConstruct(url => new Promise((res, rej) => loader.load(url, res, undefined, rej)), A, true);   // строежите — истинските (construct.js); детските са изтрити
  const size = n => new THREE.Box3().setFromObject(A[n]).getSize(new THREE.Vector3());
  let treeK = 0;
  const model = (n, target) => {
    if (TREES_OFF && n.startsWith('tree-')) {   // истинско дърво ~1,6 × target м високо (конусите на Kenney бяха тънки и до 30 м)
      const o = SF.length ? SF[(treeK++ * 7 + 3) % SF.length].clone(true) : new THREE.Group(); o.scale.setScalar(target * 1.6); o.rotation.y = treeK * 2.39;
      o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      return o;
    }
    const o = A[n].clone(true), s = size(n); o.scale.setScalar(target / Math.max(s.x, s.z));
    o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return o;
  };
  const centerOn = (o, x, z) => { o.position.set(x, 0, z); o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o); o.position.x += x - (b.min.x + b.max.x) / 2; o.position.z += z - (b.min.z + b.max.z) / 2; };

  // ── земя и улици ──
  const world = new THREE.Group(); scene.add(world);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshStandardMaterial({ color: 0x8fb36a, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true; world.add(ground);
  const tiles = { 'road-straight': [], 'road-crossroad': [], 'road-intersection': [], 'road-bend': [] };
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (!isRoad(i, j)) continue;
    const n = j > 0 && isRoad(i, j - 1), s = j < N - 1 && isRoad(i, j + 1), w = i > 0 && isRoad(i - 1, j), e = i < N - 1 && isRoad(i + 1, j), cnt = n + s + w + e;
    let k = 'road-straight', rot = 0;
    if (cnt === 4) k = 'road-crossroad';
    else if (cnt === 3) { k = 'road-intersection'; rot = !n ? Math.PI : !s ? 0 : !w ? -Math.PI / 2 : Math.PI / 2; }
    else if (cnt === 2 && n && s) rot = Math.PI / 2;
    else if (cnt === 2 && w && e) rot = 0;
    else { k = 'road-bend'; rot = s && e ? 0 : s && w ? -Math.PI / 2 : n && w ? Math.PI : Math.PI / 2; }
    tiles[k].push(new THREE.Matrix4().compose(new THREE.Vector3(tx(i), 0, tx(j)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(TILE, TILE, TILE)));
  }
  for (const [k, mats] of Object.entries(tiles)) {
    if (!A[k] || !mats.length) continue;
    A[k].updateMatrixWorld(true);
    A[k].traverse(m => { if (!m.isMesh) return; const im = new THREE.InstancedMesh(m.geometry, m.material, mats.length); mats.forEach((M, i) => im.setMatrixAt(i, M.clone().multiply(m.matrixWorld))); im.receiveShadow = true; world.add(im); });
  }

  // ── парцели: свои (най-близо до офиса) и на съседите ──
  const lots = [];
  for (let bi = 0; bi < NB; bi++) for (let bj = 0; bj < NB; bj++) {
    if (bi === HQ[0] && bj === HQ[1]) continue;
    const [x, z] = lotXZ(bi, bj), d = Math.max(Math.abs(bi - C), Math.abs(bj - C));
    lots.push({ bi, bj, x, z, zone: d <= 1 ? 'center' : d <= 2 ? 'mid' : 'outer', dist: Math.hypot(bi - HQ[0], bj - HQ[1]) });
  }
  lots.sort((a, b) => a.dist - b.dist || a.bi - b.bi || a.bj - b.bj);
  const own = lots.slice(0, OWN_LOTS), others = lots.slice(OWN_LOTS);
  let filler = new THREE.Group(), hqObj = null, sign = null; world.add(filler);

  function label(text, color = '#fff') {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d');
    g.fillStyle = 'rgba(15,20,28,.85)'; g.beginPath(); g.roundRect(4, 4, 504, 88, 20); g.fill();
    g.font = 'bold 42px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(text, 256, 50);
    const t = canvasTex(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); s.scale.set(16, 3, 1); s.renderOrder = 10; return s;
  }
  const setLabel = (s, text, color) => { const nw = label(text, color); s.material.map.dispose(); s.material.map = nw.material.map; s.material.needsUpdate = true; };

  // околният град: детерминиран по името на града (съседните фирми и жителите)
  function setCity(cityId, brand) {
    world.remove(filler); filler = new THREE.Group(); world.add(filler);
    const r = rng(hash(cityId));
    for (const l of others) {
      const ch = l.zone === 'center' ? 0.8 : l.zone === 'mid' ? 0.65 : 0.5;
      if (r() > ch) { for (let k = 0; k < 2; k++) { const t = model(r() < 0.5 ? 'tree-large' : 'tree-small', 6 + r() * 3); t.position.set(l.x + (r() - 0.5) * 12, 0, l.z + (r() - 0.5) * 12); filler.add(t); } continue; }
      const n = l.zone === 'center' ? (r() < 0.6 ? SKY : SHOPS) : l.zone === 'mid' ? (r() < 0.7 ? SHOPS : HOUSES) : HOUSES;
      const nm = n[(r() * n.length) | 0], o = model(nm, n === HOUSES ? hFit(nm) : 12.5); o.rotation.y = Math.floor(r() * 4) * Math.PI / 2; centerOn(o, l.x, l.z); filler.add(o);
    }
    for (const l of own) for (let k = 0; k < 2; k++) { const t = model('tree-small', 5 + r() * 2); t.position.set(l.x + (r() - 0.5) * 12, 0, l.z + (r() - 0.5) * 12); t.userData.ownTree = l; filler.add(t); }
    // централата
    if (hqObj) world.remove(hqObj);
    hqObj = model('building-g', 14);   /* централата — истински офис (вместо детския Building_Medium_2_001) */ centerOn(hqObj, hx, hz); world.add(hqObj);
    sign = label(`${brand.ico} ${brand.nm}`, brand.col); hqObj.updateMatrixWorld(true);
    sign.position.set(hx, new THREE.Box3().setFromObject(hqObj).max.y + 4, hz); world.add(sign);
  }

  // ── строежите на фирмата ──
  const sites = new Map();   // build id → { obj, b, site, lab, top }
  const modelFor = b => { const h = hash('b' + b.id); return b.kind === 'house' ? [HOUSES[h % HOUSES.length], hFit(HOUSES[h % HOUSES.length])] : b.kind === 'shop' ? [SHOPS[h % SHOPS.length], 12.5] : b.kind === 'office' ? [OFFICES[h % OFFICES.length], 12.5] : [SKY[h % SKY.length], 12.5]; };
  const lotOf = b => own[(b.lot - 1) % OWN_LOTS];
  function syncBuilds(builds) {
    const want = new Map();
    // на един парцел стои последният строеж (старите готови сгради се заменят от по-новите)
    for (const b of builds.slice().sort((a, b) => a.id - b.id)) want.set((b.lot - 1) % OWN_LOTS, b);
    for (const [id, s] of sites) if (![...want.values()].some(b => b.id === id)) { world.remove(s.obj); sites.delete(id); }
    for (const b of want.values()) {
      let s = sites.get(b.id);
      if (s && s.status !== b.status) { world.remove(s.obj); sites.delete(b.id); s = null; }
      if (s) { s.b = b; continue; }
      const l = lotOf(b), [nm, sz] = modelFor(b), g = new THREE.Group(), bld = model(nm, sz);
      bld.rotation.y = (hash('r' + b.id) % 4) * Math.PI / 2; centerOn(bld, l.x, l.z); g.add(bld);
      bld.updateMatrixWorld(true); const top = new THREE.Box3().setFromObject(bld).max.y;
      s = { obj: g, b, bld, top, status: b.status };
      if (b.status === 'running') {
        const dirt = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 1 }));
        dirt.rotation.x = -Math.PI / 2; dirt.position.set(l.x, 0.03, l.z); dirt.receiveShadow = true; g.add(dirt);
        for (const [dx, dz] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) { const c = model('construction-cone', 0.9); c.position.set(l.x + dx, 0, l.z + dz); g.add(c); }
        if (b.kind !== 'house') { const cr = model('crane-tower', 9); cr.position.set(l.x - 5, 0, l.z - 5); g.add(cr); }
        const p = model('planks-wood-a', 2.5); p.position.set(l.x + 5, 0, l.z + 5); g.add(p);
        s.lab = label('🏗️'); s.lab.position.set(l.x, top + 6, l.z); g.add(s.lab);
      }
      // дърветата на парцела изчезват, щом започне строеж
      filler.children.filter(t => t.userData.ownTree === l).forEach(t => t.visible = false);
      world.add(g); sites.set(b.id, s);
    }
  }
  // напредък по сървърното време (offset = server_now − Date.now() при последното четене)
  let offset = 0;
  const STAGES = ['Изкоп', 'Основи', 'Конструкция', 'Довършване'];
  function animate() {
    const now = Date.now() + offset;
    for (const s of sites.values()) {
      if (s.status !== 'running') continue;
      const t0 = Date.parse(s.b.start_at), t1 = Date.parse(s.b.end_at), p = Math.max(0, Math.min(1, (now - t0) / (t1 - t0)));
      // изкоп и основи — сградата още я няма; после расте нагоре
      const grow = p < 0.3 ? 0.001 : (p - 0.3) / 0.7;
      s.bld.scale.y = s.bld.scale.x * Math.max(0.001, grow); s.bld.visible = grow > 0.002;
      const st = STAGES[Math.min(3, Math.floor(p * 4))], txt = `${st} ${Math.floor(p * 100)}%`;
      if (s.lab && s.lab.userData.t !== txt) { setLabel(s.lab, txt, '#ffd54a'); s.lab.userData.t = txt; s.lab.position.y = Math.max(8, s.top * Math.max(0.15, grow)) + 6; }
    }
    controls.update(); renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(animate);
  return {
    setCity, syncBuilds,
    setServerTime(iso) { offset = Date.parse(iso) - Date.now(); },
    focusLot(lot) { const l = own[(lot - 1) % OWN_LOTS]; controls.target.set(l.x, 0, l.z); camera.position.set(l.x + 45, 55, l.z + 60); },
    dispose() { renderer.setAnimationLoop(null); renderer.dispose(); renderer.forceContextLoss(); el.removeChild(renderer.domElement); },
  };
}
