// vehmodels.js — истински 3D модели на строителна техника и коли за трафика (Sketchfab, CC-BY;
// авторите са в CREDITS.txt и „📜 Автори“). Регистрират се в A като { scene } и се ползват през model(име, мащаб).
//   строителна техника — нормализирана до дължина 1 (по z, предницата към +z, колелата на y = 0):
//     sf-roller (валяк), sf-backhoe (трактор-багер), sf-grader (грейдер), sf-dump (самосвал), sf-excavator (багер), sf-mcrane (автокран)
//   коли — от „Free Low Poly Vehicles Pack“ (RgsDev): sf-car-<Име>, в мащаба на града (лек автомобил ≈ CAR_LEN)
import * as THREE from 'three';
import { feature } from './lab/feature.js';
import { NF_MATS } from './nightfloors.js';   // нощем daynight.js вдига emissiveIntensity — фаровете на ТИР-овете

const CAR_LEN = 3.8;   // дължината на седана в света на играта (другите коли са в същия мащаб); беше 3.0 — изглеждаха малки до сградите
const GEAR = {
  roller: { f: 'roller', yaw: 0 }, backhoe: { f: 'backhoe', yaw: 0 }, dump: { f: 'dump', yaw: 0 },
  grader: { f: 'grader', yaw: -Math.PI / 2 },   // ножът и предните колела са към +x
  excavator: { f: 'excavator', yaw: feature('gear-exc') ? 0 : Math.PI / 2 },   // старият: стрелата е към −x → завърта се напред; новият (Лабораторията) вече гледа напред
  mcrane: { f: 'mcrane', yaw: 0 },
};
export const CAR_NAMES = ['Sedan', 'Hatchback', 'SUV', 'Pickup', 'Van', 'Taxi', 'Muscle', 'Muscle_2', 'Sports', 'Roadster', 'Limousine', 'Truck', 'Truck_with_trailer', 'Bus', 'Ambulance', 'Firetruck', 'Police_Sedan', 'Police_SUV', 'Police_Muscle', 'Police_Sports'];

// обект → група с център в началото, колела на y = 0; k — мащаб (null: дължина 1 по z)
function wrap(obj, yaw = 0, k = null) {
  const g = new THREE.Group(), inner = new THREE.Group(); inner.add(obj); inner.rotation.y = yaw; g.add(inner);
  g.updateMatrixWorld(true);
  let bb = new THREE.Box3().setFromObject(g), s = bb.getSize(new THREE.Vector3());
  inner.scale.setScalar(k ?? 1 / s.z); g.updateMatrixWorld(true);
  bb = new THREE.Box3().setFromObject(g); const c = bb.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -bb.min.y, -c.z);
  return g;
}

// load(url) → Promise<gltf>; A — речникът с модели на играта. Връща Promise (липсващ файл не спира играта).
export function loadVehModels(load, A, base = 'assets/heavy/gear/') {
  const jobs = Object.entries(GEAR).map(([k, c]) => load(base + c.f + '.glb').then(g => { A['sf-' + k] = { scene: wrap(g.scene, c.yaw) }; }).catch(e => console.warn('vehmodels', k, e)));
  jobs.push(load(base + 'cars.glb').then(g => {
    const root = g.scene; root.updateMatrixWorld(true);
    let n = root; while (n.children.length === 1) n = n.children[0];
    // мащаб от седана, за да са всички коли в една и съща пропорция
    const sedan = n.children.find(c => c.name === 'Sedan');
    const k = sedan ? CAR_LEN / new THREE.Box3().setFromObject(sedan).getSize(new THREE.Vector3()).z : 0.57;
    for (const nm of CAR_NAMES) {
      const parts = n.children.filter(c => c.name === nm || c.name.startsWith(nm + '_wheel'));
      if (!parts.length) continue;
      const grp = new THREE.Group();
      for (const p of parts) { const q = p.clone(true); q.applyMatrix4(p.parent.matrixWorld); grp.add(q); }   // в световни координати на пакета
      A['sf-car-' + nm] = { scene: wrap(grp, 0, k) };
    }
  }).catch(e => console.warn('vehmodels cars', e)).then(() => feature('cars-real') && loadRealCars(load, A)).then(() => feature('trucks-real') && loadRealTrucks(load, A)));
  return Promise.all(jobs);
}

// реалистичните коли (Sketchfab, CC-BY; assets/heavy/cars, нормализирани: дължина 1 по z, предницата към +z, текстури 512 px).
// Заместват част от „Free Low Poly Vehicles Pack“ под същите имена; дължината — истинската в метри × мащаба на града.
const REAL_CARS = {   // име: [файл, дължина в м]
  Sedan: ['car-polo', 4.4], Hatchback: ['car-p206', 3.8], SUV: ['car-renegade', 4.25], Pickup: ['car-hilux', 5.3], Taxi: ['car-taxi', 4.9],
  Van: ['car-uaz452', 4.4], Muscle: ['car-accord', 4.7], Muscle_2: ['car-corolla', 4.2], Police_Sedan: ['car-crownvic', 5.4], Bus: ['bus-citaro', 12], Limousine: ['car-limo', 7.6], Police_SUV: ['car-polsuv', 4.9], Truck: ['car-truck', 6.5],
};
const M_PER = CAR_LEN / 4.5;   // седанът от пакета (≈4,5 м) е CAR_LEN в света на играта
function loadRealCars(load, A) {
  return Promise.all(Object.entries(REAL_CARS).map(([nm, [f, len]]) => load('assets/heavy/cars/' + f + '.glb').then(g => {
    g.scene.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const sc = wrap(g.scene, 0, len * M_PER);
    if (/^Police/.test(nm)) addBeacons(sc, len * M_PER);
    A['sf-car-' + nm] = { scene: sc };
  }).catch(e => console.warn('real car', nm, e))));
}

// модерни ТИР-ове (Лабораторията → trucks-real): влекачи Scania S и Volvo FH (Sketchfab, CC-BY; assets/heavy/trucks, дължина 1 по z).
//   A['sf-trk-0|1'] — само влекачът (дължина 1; trucks.js го мащабира и закача своето ремарке с товара)
//   A['sf-semi-0|1'] — влекач + бяло полуремарке с цветна ивица, в мащаба на града (магистралите, hwtraffic.js)
const TRK = ['scania', 'volvo'], SEMI_COL = [0xd62828, 0x1f5fbf];
export const truckLamps = (() => { let m = null; return () => m || (m = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 1, 32, 32, 31);
  gr.addColorStop(0, 'rgba(255,250,225,1)'); gr.addColorStop(0.35, 'rgba(255,235,180,0.55)'); gr.addColorStop(1, 'rgba(255,220,150,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c), mk = col => { const mm = new THREE.MeshStandardMaterial({ color: 0, emissive: col, emissiveMap: t, emissiveIntensity: 0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); NF_MATS.add(mm); return mm; };
  return { front: mk(0xd8ceb0), rear: mk(0xa01010) };
})()); })();
// фарове (отпред) и стопове (отзад) на обект с предница към +z и дължина len; w — ширина, y — височина на фаровете
export function addTruckLamps(o, len, w = 2.4, y = 1.1, rearZ = null) {
  const L = truckLamps();
  for (const sx of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), L.front); f.position.set(sx * w * 0.36, y, len / 2 + 0.05); o.add(f);
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), L.rear); r.rotation.y = Math.PI; r.position.set(sx * w * 0.42, y, (rearZ ?? -len / 2) - 0.05); o.add(r);
  }
}
function loadRealTrucks(load, A) {
  return Promise.all(TRK.map((f, i) => load('assets/heavy/trucks/' + f + '.glb').then(g => {
    g.scene.traverse(m => { if (m.isMesh) { m.castShadow = true; if (f === 'volvo') { m.material = m.material.clone(); m.material.color.multiplyScalar(2.2); } } });   // черният Volvo — малко по-светъл
    A['sf-trk-' + i] = { scene: wrap(g.scene, 0, null) };
    // полуремарке за магистралата: влекач 6 м + ремарке 13,6 м
    const semi = new THREE.Group(), cab = wrap(g.scene.clone(true), 0, null), cabL = 6 * M_PER, trL = 13.6 * M_PER, W = 2.5 * M_PER;
    cab.scale.setScalar(cabL); cab.position.z = trL / 2 + cabL / 2 - 1.2 * M_PER; semi.add(cab);
    const box = new THREE.Mesh(new THREE.BoxGeometry(W, 2.9 * M_PER, trL), new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.6 })); box.position.y = 2.65 * M_PER; box.castShadow = true; semi.add(box);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, 0.5 * M_PER, trL * 0.9), new THREE.MeshStandardMaterial({ color: SEMI_COL[i], roughness: 0.5 })); stripe.position.y = 2.2 * M_PER; semi.add(stripe);
    for (const z of [-trL / 2 + 1.2 * M_PER, -trL / 2 + 2.5 * M_PER]) for (const x of [-1, 1]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * M_PER, 0.5 * M_PER, 0.35 * M_PER, 12).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x15171a })); wh.position.set(x * W * 0.42, 0.5 * M_PER, z); semi.add(wh); }
    addTruckLamps(semi, 0, W, 0.9 * M_PER, -trL / 2);
    for (const c of semi.children) if (c.geometry?.type === 'PlaneGeometry' && c.position.z > 0) c.position.z = trL / 2 + cabL - 1.2 * M_PER + 0.05;   // фаровете — на челото на влекача
    A['sf-semi-' + i] = { scene: semi };
  }).catch(e => console.warn('real truck', f, e))));
}

// буркани на полицейските коли: синьо/червено, мигат; около половината коли ги включват „от време на време“ (по ~20 s)
const BEACON = { r: new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2020, emissiveIntensity: 0 }), b: new THREE.MeshStandardMaterial({ color: 0x000a40, emissive: 0x2050ff, emissiveIntensity: 0 }) };
function addBeacons(car, len) {
  car.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(car), y = bb.max.y + 0.02, w = (bb.max.x - bb.min.x) * 0.22, z = (bb.min.z + bb.max.z) / 2 + len * 0.05;
  const bar = new THREE.Group(); bar.position.set(0, y, z); car.add(bar);
  const geo = new THREE.BoxGeometry(w, 0.09, 0.14);
  for (const [k, sx] of [['r', -1], ['b', 1]]) {
    const m = new THREE.Mesh(geo, BEACON[k]); m.position.x = sx * w * 0.55; bar.add(m);
    m.onBeforeRender = function () {   // всяко копие (clone) има свой uuid → своя фаза; мигат на смени
      const t = performance.now() / 1000, h = (this.parent.parent ? this.parent.parent.uuid.charCodeAt(0) + this.parent.parent.uuid.charCodeAt(3) : 0);
      const on = Math.sin(t / 20 * Math.PI * 2 + h) > 0.1;   // включени ~45% от времето
      const blink = (Math.floor(t * 6) + (k === 'r' ? 0 : 1)) % 2 === 0;
      this.material.emissiveIntensity = on && blink ? 3 : 0;
    };
  }
}
