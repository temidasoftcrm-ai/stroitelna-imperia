// station.js — гарата на фирмата в града: нива 1–5, по един коловоз на ниво. Влаковете, които са у дома,
// стоят паркирани на коловозите. Главната линия (коловоз 0) минава през целия град; останалите са гарови.
import * as THREE from 'three';
import { hasTrainModel, trainCar } from './trainmodels.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// истински гарови сгради (Sketchfab, CC-BY): small — „Train Station - Nieborowice“ (нива 2–4), big — „Milwaukee Road Depot“ (ниво 5)
const ST_MODEL = {};
let stLoad = null;
const loadStationModels = () => stLoad || (stLoad = Promise.all(['small', 'big'].map(k => new Promise(res => new GLTFLoader().load(`assets/heavy/station/${k}.glb`, g => { ST_MODEL[k] = g.scene; res(); }, undefined, () => res())))));
// сградата, вписана в кутия: дължина L по z, без да надвишава ширина W; основата на y = 0
function stationBuilding(k, L, W) {
  const src = ST_MODEL[k]; if (!src) return null;
  const o = src.clone(true), g = new THREE.Group(), inner = new THREE.Group(); inner.add(o); g.add(inner); g.updateMatrixWorld(true);
  let bb = new THREE.Box3().setFromObject(g), sz = bb.getSize(new THREE.Vector3());
  if (sz.x > sz.z) { inner.rotation.y = Math.PI / 2; g.updateMatrixWorld(true); bb = new THREE.Box3().setFromObject(g); sz = bb.getSize(new THREE.Vector3()); }
  inner.scale.setScalar(Math.min(L / sz.z, W / sz.x)); g.updateMatrixWorld(true);
  bb = new THREE.Box3().setFromObject(g); const c = bb.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -bb.min.y, -c.z);
  g.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; } });
  g.userData.h = bb.max.y - bb.min.y;
  return g;
}

export const STATION_LEVELS = [
  { nm: 'Спирка', cost: 40000, days: 2 },
  { nm: 'Малка гара', cost: 70000, days: 3 },
  { nm: 'Гара', cost: 110000, days: 4 },
  { nm: 'Голяма гара', cost: 160000, days: 5 },
  { nm: 'Централна гара', cost: 230000, days: 6 },
];
export const TRACK_GAP = 6.5;   // разстояние между коловозите
const LEN = 600, SCALE = 2.2, CAR = 6.2;   // коловозите минават от край до край на земята (1200 м)

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
// нощно осветление: светещи лампи (emissive) и светли петна по земята (адитивен кръг с плавен ръб)
let poolTex = null;
function pool() {
  if (!poolTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,236,190,1)'); gr.addColorStop(0.45, 'rgba(255,220,160,0.55)'); gr.addColorStop(1, 'rgba(255,210,150,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128); poolTex = new THREE.CanvasTexture(c);
  }
  return new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
}

// deps: { group, model(name, scale), instanced(name, mats), label(text, color, w), x (оста на главния коловоз) }
export function createStation(deps) {
  const X = deps.x;
  let g = null, level = 0, parked = [], site = null, lamps = [], pools = [], glows = [], night = 0;
  const trackX = k => X - k * TRACK_GAP;
  // deps.path(x, z) → { x, z, yaw }: в крайморските градове линията свива на запад преди морето (trackpath.js)
  const rails = (x, z0, z1) => {
    const q = new THREE.Quaternion(), s = new THREE.Vector3(4, 4, 4), p = new THREE.Vector3(), mats = [], up = new THREE.Vector3(0, 1, 0);
    for (let z = z0; z <= z1; z += 4) { const m = deps.path ? deps.path(x, z) : { x, z, yaw: 0 }; q.setFromAxisAngle(up, m.yaw); mats.push(new THREE.Matrix4().compose(p.set(m.x, 0, m.z), q, s)); }
    return deps.instanced('track', mats);
  };
  // строи гарата за дадено ниво (0 = само главната линия); building: строи се следващото ниво (ограда и скеле)
  let buildingNow = null;
  function build(lv, building = null) {
    buildingNow = building;
    if (g) deps.group.remove(g);
    g = new THREE.Group(); lamps = []; pools = []; glows = [];
    deps.group.add(g);
    level = lv;
    g.add(rails(X, -LEN, LEN));   // главната линия
    if (lv >= 1) {
      const plen = 30 + lv * 8, side = lv >= 3 ? 0x8f8a80 : 0xb9b2a3;
      for (let k = 1; k < lv; k++) g.add(rails(trackX(k), -LEN, LEN));   // гаровите коловози също минават от край до край
      // перон откъм града + островни перони между коловозите
      const main = new THREE.Mesh(new THREE.BoxGeometry(5, 0.8, plen * 2), mat(side));
      main.position.set(X + 5.5, 0.4, 0); main.receiveShadow = main.castShadow = true; g.add(main);
      for (let k = 0; k < lv - 1; k++) {
        const isl = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, plen * 1.6), mat(side));
        isl.position.set(trackX(k) - TRACK_GAP / 2, 0.4, 0); isl.receiveShadow = isl.castShadow = true; g.add(isl);
      }
      // навеси само над пероните (между тях влаковете се виждат отгоре)
      const lampM = mat(0xfff4d6, { emissive: 0xffe2a8, emissiveIntensity: 0.2 }); lamps.push(lampM);
      const canL = 26 + lv * 4, canH = 4.4, canM = mat(lv >= 4 ? 0x46607a : 0x7b3b2a, lv >= 4 ? { metalness: 0.4 } : {});
      const canopy = (x, w) => {
        const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, canL), canM);
        r.position.set(x, canH, 0); r.castShadow = true; g.add(r);
        const strip = new THREE.Mesh(new THREE.BoxGeometry(Math.min(1, w * 0.3), 0.12, canL - 2), lampM); strip.position.set(x, canH - 0.2, 0); g.add(strip);
        const pm = pool(), pl = new THREE.Mesh(new THREE.PlaneGeometry(w + 3, canL + 4), pm); pl.rotation.x = -Math.PI / 2; pl.position.set(x, 0.84, 0); g.add(pl); pools.push([pm, 0.55]);
        for (const z of [-canL / 2 + 2, 0, canL / 2 - 2]) {
          const c = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, canH), mat(0x444444));
          c.position.set(x, canH / 2, z); g.add(c);
        }
      };
      canopy(X + 5.5, 5.5);
      for (let k = 0; k < lv - 1; k++) canopy(trackX(k) - TRACK_GAP / 2, 3);
      // фенери по пероните извън навеса
      const post = (x, z, h = 4.2) => {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, h, 6), mat(0x2f3338)); p.position.set(x, 0.8 + h / 2, z); g.add(p);
        const hd = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.5), lampM); hd.position.set(x, 0.8 + h, z); g.add(hd);
        const pm = pool(), pl = new THREE.Mesh(new THREE.CircleGeometry(4.5, 20), pm); pl.rotation.x = -Math.PI / 2; pl.position.set(x, 0.86, z); g.add(pl); pools.push([pm, 0.6]);
      };
      const outerPlat = [X + 5.5, ...Array.from({ length: lv - 1 }, (_, k) => trackX(k) - TRACK_GAP / 2)];
      outerPlat.forEach((x, i) => { const pl = i ? plen * 0.8 : plen; for (let z = canL / 2 + 5; z < pl - 1; z += 9) { post(x, z); post(x, -z); } });
      // осветителни мачти над коловозите (от ниво 2): високи стълбове с прожектори, светлината пада по целия двор
      if (lv >= 2) {
        const mx = X + 9.5, yardW = (lv - 1) * TRACK_GAP + 12, cx = X + 3 - (lv - 1) * TRACK_GAP / 2;
        for (const z of lv >= 4 ? [-plen * 0.95, 0, plen * 0.95] : [-plen * 0.8, plen * 0.8]) {
          const H = 16 + lv;
          const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, H, 8), mat(0x5a6068, { metalness: 0.5 })); m.position.set(mx, H / 2, z); m.castShadow = true; g.add(m);
          const head = new THREE.Group(); head.position.set(mx, H, z); g.add(head);
          for (let k = -1.5; k <= 1.5; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.9), lampM); f.position.set(-0.3, 0, k * 1); f.rotation.z = 0.5; head.add(f); }
          const fb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 4.4), mat(0x3a3f46)); fb.position.set(0.1, 0, 0); head.add(fb);
          const pm = pool(), pl = new THREE.Mesh(new THREE.PlaneGeometry(yardW, 44), pm); pl.rotation.x = -Math.PI / 2; pl.position.set(cx, 0.9, z); g.add(pl); pools.push([pm, 0.45]);
        }
      }
      // гарова сграда в северния край на перона; расте с нивото
      const hw = 6, hh = 3.5 + lv * 1.3, hl = 8 + lv * 3;
      const real = lv >= 2 ? stationBuilding(lv >= 5 ? 'big' : 'small', lv >= 5 ? 47 : hl + 4, lv >= 5 ? 18 : 10) : null;
      if (lv >= 2 && !real && !stLoad) loadStationModels().then(() => { if (level === lv) build(lv, buildingNow); });
      if (real) {   // истинската сграда — до перона, в северния му край
        real.position.set(X + 5.5 + (lv >= 5 ? 6 : 3), 0, lv >= 5 ? plen + 24.5 : -plen - (hl + 4) / 2 - 1); if (lv >= 5) real.rotation.y = Math.PI; g.add(real);
        const lab = deps.label(`🚉 ${STATION_LEVELS[lv - 1].nm.toUpperCase()} · ${lv} ${lv === 1 ? 'коловоз' : 'коловоза'}`, '#ffffff', 9);
        lab.position.set(real.position.x, real.userData.h + 4, real.position.z); g.add(lab);
      } else {
      const hall = new THREE.Mesh(new THREE.BoxGeometry(hw, hh, hl), mat(lv >= 4 ? 0xd9d4c8 : 0xc9a27a));
      hall.position.set(X + 5.5, hh / 2, -plen - hl / 2 - 1); hall.castShadow = hall.receiveShadow = true; g.add(hall);
      const hroof = new THREE.Mesh(new THREE.BoxGeometry(hw + 0.6, 0.5, hl + 0.6), mat(0x5a3a2a));
      hroof.position.set(X + 5.5, hh + 0.25, hall.position.z); g.add(hroof);
      const winM = mat(0x9fd3ff, { emissive: 0xffd890, emissiveIntensity: 0.1 }); glows.push([winM, 1.4]);
      for (let k = 0; k < Math.min(6, lv + 1); k++) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), winM);
        w.position.set(X + 5.5 + hw / 2 + 0.01, hh * 0.55, hall.position.z - hl / 2 + (k + 0.7) * (hl / (Math.min(6, lv + 1) + 0.4)));
        w.rotation.y = Math.PI / 2; g.add(w);
      }
      if (lv >= 3) {   // часовникова кула
        const tower = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4 + lv, 2.2), mat(0xd9d4c8));
        tower.position.set(X + 5.5, hh + (4 + lv) / 2, hall.position.z + hl / 2 - 1.5); tower.castShadow = true; g.add(tower);
        const clockM = mat(0xffffff, { emissive: 0xfff2c8, emissiveIntensity: 0.4 }); glows.push([clockM, 1.6]);
        const clock = new THREE.Mesh(new THREE.CircleGeometry(0.75, 20), clockM);
        clock.position.set(X + 5.5 + 1.11, tower.position.y + (4 + lv) / 2 - 1.2, tower.position.z); clock.rotation.y = Math.PI / 2; g.add(clock);
      }
      const lab = deps.label(`🚉 ${STATION_LEVELS[lv - 1].nm.toUpperCase()} · ${lv} ${lv === 1 ? 'коловоз' : 'коловоза'}`, '#ffffff', 9);
      lab.position.set(X + 5.5, hh + 3 + (lv >= 3 ? 4 + lv : 0), hall.position.z); g.add(lab);
      }
    }
    site = null;
    if (building) {   // строеж на следващото ниво: оранжева ограда и скеле около новия коловоз
      site = new THREE.Group();
      const k = building - 1, x = k === 0 ? X + 5.5 : trackX(k), w = 6, l = 70;
      const fm = mat(0xff7a00);
      for (const [dx, dz, sx, sz] of [[-w / 2, 0, 0.15, l], [w / 2, 0, 0.15, l], [0, -l / 2, w, 0.15], [0, l / 2, w, 0.15]]) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(sx, 1.1, sz), fm); f.position.set(x + dx, 0.55, dz); site.add(f);
      }
      const pts = [];
      for (let z = -l / 2; z <= l / 2; z += 5) pts.push(x - w / 2, 0, z, x - w / 2, 5, z, x + w / 2, 0, z, x + w / 2, 5, z);
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      site.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xd9a53a })));
      const sl = deps.label(`🔨 Строи се: ${STATION_LEVELS[building - 1].nm}`, '#ffd54a', 9); sl.position.set(x, 8, 0); site.add(sl);
      g.add(site);
    }
    setParked(parked.map(p => p.info));
    setNight(night, true);
  }
  // нощ 0…1: лампите светят, по пероните и коловозите падат светли петна
  function setNight(n, force = false) {
    if (!force && Math.abs(n - night) < 0.01) return;
    night = n;
    for (const m of lamps) m.emissiveIntensity = 0.2 + 2.4 * n;
    for (const [m, k] of pools) m.opacity = k * n;
    for (const [m, k] of glows) m.emissiveIntensity = 0.1 + k * n;
  }
  // trains: [{ id, nm }] — влаковете у дома; всеки стои на свой коловоз (отвън навътре)
  const ROOF_Y = new THREE.MeshStandardMaterial({ color: 0xffd000, emissive: 0x6a5200, emissiveIntensity: 0.35, roughness: 0.5 });
  function setParked(trains) {
    for (const p of parked) g.remove(p.obj);
    parked = [];
    if (!level) return;
    trains.slice(0, level).forEach((t, i) => {
      const k = level - 1 - i, o = new THREE.Group();
      const FREIGHT = ['train-carriage-box', 'train-carriage-container-red', 'train-carriage-flatbed-wood', 'train-carriage-coal', 'train-carriage-container-blue', 'train-carriage-tank', 'train-carriage-lumber'];
      const n = t.wagons || 3;
      const parts = t.pax ? ['train-electric-city-a', ...Array(Math.max(0, n - 2)).fill('train-electric-city-b'), 'train-electric-city-a']
        : ['train-locomotive-a', ...Array.from({ length: n }, (_, j) => FREIGHT[(j + t.id) % FREIGHT.length])];
      // истински модели (trainmodels.js): „Стрела“ — скоростният влак, товарните — дизелов локомотив с бункери и платформи
      const real = t.pax && !t.express && hasTrainModel('paxLoco') ? ['paxLoco', ...Array(Math.max(1, n - 1)).fill('paxCar')]
        : !t.pax && !t.express && hasTrainModel('vl82') ? ['vl82', ...Array.from({ length: n }, (_, j) => ['boxcar', 'hopper2', 'flat'][(j + t.id) % 3])]
        : t.express && hasTrainModel('ave') ? ['ave', ...Array(hasTrainModel('hsw') ? Math.min(4, Math.max(1, n - 2)) : 0).fill('hsw'), 'aveTail'] : !t.pax && !t.express && hasTrainModel('loco') ? ['loco', ...Array.from({ length: n }, (_, j) => (j + t.id) % 3 === 1 ? 'hopper' : 'flat')] : null;
      if (real) {
        let z = 0;
        real.forEach((kd, j) => { const m = trainCar(kd, t.id * 7 + j); z -= m.userData.len / 2; m.position.z = z; z -= m.userData.len / 2 + 0.5; o.add(m); });
        o.position.set(trackX(k), 0.3, -z / 2);
        const lb = deps.label(`🚆 ${t.nm}`, '#ffffff', 5); lb.position.set(0, 6, z / 2); o.add(lb);
        g.add(o); parked.push({ obj: o, info: t });
        return;
      }
      parts.forEach((n, j) => {
        const m = deps.model(n, SCALE); m.position.z = -j * CAR; o.add(m);
        if (t.express) {   // Експрес „Стрела“: жълт покрив на всеки вагон, за да се познава на гарата
          const bb = new THREE.Box3().setFromObject(m), sz = bb.getSize(new THREE.Vector3());
          const roof = new THREE.Mesh(new THREE.BoxGeometry(sz.x * 0.8, 0.18, sz.z * 0.9), ROOF_Y);
          roof.position.set(0, bb.max.y + 0.06, -j * CAR); roof.castShadow = true; o.add(roof);
        }
      });
      o.position.set(trackX(k), 0.3, (parts.length - 1) * CAR / 2);
      const lb = deps.label(`🚆 ${t.nm}`, '#ffffff', 5); lb.position.set(0, 6, -(parts.length - 1) * CAR / 2); o.add(lb);
      g.add(o);
      parked.push({ obj: o, info: t });
    });
  }
  // външният свободен коловоз за минаващите влакове
  const outerX = () => trackX(Math.max(1, level));
  return { build, setParked, setNight, outerX, trackX, get level() { return level; } };
}
