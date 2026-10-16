// vehmodels.js — истински 3D модели на строителна техника и коли за трафика (Sketchfab, CC-BY;
// авторите са в CREDITS.txt и „📜 Автори“). Регистрират се в A като { scene } и се ползват през model(име, мащаб).
//   строителна техника — нормализирана до дължина 1 (по z, предницата към +z, колелата на y = 0):
//     sf-roller (валяк), sf-backhoe (трактор-багер), sf-grader (грейдер), sf-dump (самосвал), sf-excavator (багер), sf-mcrane (автокран)
//   коли — от „Free Low Poly Vehicles Pack“ (RgsDev): sf-car-<Име>, в мащаба на града (лек автомобил ≈ CAR_LEN)
import * as THREE from 'three';
import { feature } from './lab/feature.js';

const CAR_LEN = 3.0;   // дължината на седана в света на играта (другите коли са в същия мащаб)
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
  }).catch(e => console.warn('vehmodels cars', e)).then(() => feature('cars-real') && loadRealCars(load, A)));
  return Promise.all(jobs);
}

// реалистичните коли (Sketchfab, CC-BY; assets/heavy/cars, нормализирани: дължина 1 по z, предницата към +z, текстури 512 px).
// Заместват част от „Free Low Poly Vehicles Pack“ под същите имена; дължината — истинската в метри × мащаба на града.
const REAL_CARS = {   // име: [файл, дължина в м]
  Sedan: ['car-polo', 4.4], Hatchback: ['car-p206', 3.8], SUV: ['car-renegade', 4.25], Pickup: ['car-hilux', 5.3], Taxi: ['car-taxi', 4.9],
  Van: ['car-uaz452', 4.4], Muscle: ['car-accord', 4.7], Muscle_2: ['car-corolla', 4.2], Police_Sedan: ['car-crownvic', 5.4], Bus: ['bus-citaro', 12],
};
const M_PER = CAR_LEN / 4.5;   // седанът от пакета (≈4,5 м) е CAR_LEN в света на играта
function loadRealCars(load, A) {
  return Promise.all(Object.entries(REAL_CARS).map(([nm, [f, len]]) => load('assets/heavy/cars/' + f + '.glb').then(g => {
    g.scene.traverse(o => { if (o.isMesh) o.castShadow = true; });
    A['sf-car-' + nm] = { scene: wrap(g.scene, 0, len * M_PER) };
  }).catch(e => console.warn('real car', nm, e))));
}
