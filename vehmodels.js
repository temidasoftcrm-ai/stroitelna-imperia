// vehmodels.js — истински 3D модели на строителна техника и коли за трафика (Sketchfab, CC-BY;
// авторите са в CREDITS.txt и „📜 Автори“). Регистрират се в A като { scene } и се ползват през model(име, мащаб).
//   строителна техника — нормализирана до дължина 1 (по z, предницата към +z, колелата на y = 0):
//     sf-roller (валяк), sf-backhoe (трактор-багер), sf-grader (грейдер), sf-dump (самосвал), sf-excavator (багер), sf-mcrane (автокран)
//   коли — от „Free Low Poly Vehicles Pack“ (RgsDev): sf-car-<Име>, в мащаба на града (лек автомобил ≈ CAR_LEN)
import * as THREE from 'three';
import { feature } from './lab/feature.js';
import { NF_MATS } from './nightfloors.js';
import { Sound } from './sound.js';
import { loadVans } from './vanlogo.js';   // бусовете (вместо УАЗ): sf-car-Van — 4 варианта; бригадата — с логото   // сирените на спешните коли (Лабораторията → sirens)   // нощем daynight.js вдига emissiveIntensity — фаровете на ТИР-овете

// истинският мащаб (Лабораторията → real-scale): дължините на колите по истинските им размери (lab/vehicles.html), влекачът с ремаркето — 16,5 м
const RS = feature('real-scale'), HITCH = RS ? 3.1 : 1.2;   // м — колко се застъпват влекачът и полуремаркето
const CAR_LEN = 4.5;   // дължината на седана в света на играта (другите коли са в същия мащаб); 1 единица ≈ 1 м (хората са ~1,9), всички коли — в истинските си метри
const GEAR = {
  roller: { f: 'roller', yaw: 0 }, backhoe: { f: 'backhoe2', yaw: 0 },   /* JCB 3CX (chimeracreations, CC BY) — замества стария (55) */ dump: { f: 'dump', yaw: 0 },
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
  if (feature('cars-more')) jobs.push(loadMoreCars(load, A));
  if (feature('school-bus')) jobs.push(loadSchoolBuses(load, A));   // school-bus (55, №7): училищните автобуси
  if (feature('buses-more')) jobs.push(loadMoreBuses(load, A));   // buses-more (55, №15): градските автобуси по региони   // cars-more (55): още 18 градски коли по региони
  jobs.push(Promise.resolve().then(() => feature('cars-real') && loadRealCars(load, A)).then(() => loadVans(load, A, M_PER)).then(() => feature('trucks-real') && loadRealTrucks(load, A)).then(() => loadPoliceCars(load, A)));
  return Promise.all(jobs);
}

// реалистичните коли (Sketchfab, CC-BY; assets/heavy/cars, нормализирани: дължина 1 по z, предницата към +z, текстури 512 px).
// Заместват част от „Free Low Poly Vehicles Pack“ под същите имена; дължината — истинската в метри × мащаба на града.
const REAL_CARS = {   // име: [файл, дължина в м]
  Sedan: ['car-polo', RS ? 4.05 : 4.4], Hatchback: ['car-p206', 3.8], SUV: ['car-renegade', 4.25], Pickup: ['car-hilux', 5.3], Taxi: ['car-taxi', 4.9],
Muscle: ['car-accord', RS ? 4.9 : 4.7], Muscle_2: ['car-corolla', RS ? 4.63 : 4.2], Police_Sedan: ['pol-crownvic', 5.4], Bus: ['bus-citaro', 12], Limousine: ['car-limo', 7.6], Police_SUV: ['car-polsuv', RS ? 6.0 : 4.9], Truck: ['car-truck', 6.5],
};
const M_PER = CAR_LEN / 4.5;   // седанът от пакета (≈4,5 м) е CAR_LEN в света на играта
// cars-more (55): още градски коли (Sketchfab, CC-BY; нормализирани в Blender — предница +z, колела на 0, истинска дължина в м).
// регионите — тегла: bg България, eu Европа, ru Русия и бившият СССР (изтокът), am Северна Америка, xx останалият свят
export const CAR_POOL = {
  golf2: [3.99, { bg: 3, eu: 3, ru: 1 }], clio2: [3.81, { bg: 2, eu: 3 }], corsab: [3.73, { bg: 3, eu: 3, ru: 1 }], octavia: [4.69, { bg: 3, eu: 3, ru: 2, xx: 1 }],
  felicia: [3.86, { bg: 2, eu: 2, ru: 1 }], logan: [4.36, { bg: 3, eu: 2, ru: 3, xx: 2 }], duster: [4.34, { bg: 3, eu: 2, ru: 3, xx: 2 }], tesla3: [4.69, { eu: 1, am: 3, xx: 1 }],
  wagon: [5.0, { am: 2 }], sienna: [5.08, { am: 3, xx: 1 }], wrangler: [4.22, { am: 3, xx: 1 }], f150: [5.89, { am: 4 }], kenworth: [8.5, { am: 1 }],
  lada2107: [4.13, { bg: 1, ru: 4 }], vaz2104: [4.12, { bg: 1, ru: 3 }], niva: [3.74, { bg: 1, ru: 3 }], moskvich: [4.35, { ru: 2 }], uaz: [4.03, { ru: 2 }],
};
function loadMoreCars(load, A) {
  return Promise.all(Object.entries(CAR_POOL).map(([k, [len]]) => load('assets/heavy/cars/cv-' + k + '.glb').then(g => {
    g.scene.traverse(o => { if (o.isMesh) { o.castShadow = false; if (o.material && o.material.metalness > 0.5) o.material.metalness = 0.3; } });
    const sc = wrap(g.scene, 0, M_PER); addCarLights(sc, null); A['sf-cv-' + k] = { scene: sc };   /* файловете вече са в метри (len — за таблицата) */
  }).catch(e => console.warn('cars-more', k, e))));
}
// buses-more (55, №15): градски автобуси (Sketchfab, CC-BY; нормализирани в Blender като cars-more) — дължина в м и тегла по регион;
// Mercedes Citaro (sf-car-Bus) остава за Европа
export const BUS_POOL = {
  artic: [18.1, { eu: 2, bg: 1, xx: 2 }], roaz: [12.0, { bg: 2, ru: 3, eu: 1 }], trolley: [12.0, { bg: 2, ru: 3 }], xd40: [12.2, { am: 4 }],
};
// buses-more2 (f6): още два от галерията с неизползваните модели (Sketchfab, CC-BY) — ЛиАЗ-5292 (бяло-зелен, московски) предимно в Русия,
// Украйна, Беларус… и малко в България; „Generic Town Bus“ (бял, червен покрив, жълто-червени ленти) — още един вариант навсякъде другаде
if (feature('buses-more2')) Object.assign(BUS_POOL, { liaz: [12.0, { ru: 4, bg: 1 }], town: [12.0, { eu: 1, bg: 1, xx: 2, am: 1 }] });
function loadMoreBuses(load, A) {
  return Promise.all(Object.keys(BUS_POOL).map(k => load('assets/heavy/cars/bus-' + k + '.glb').then(g => {
    g.scene.traverse(o => { if (o.isMesh) { o.castShadow = false; if (o.material && o.material.metalness > 0.5) o.material.metalness = 0.3; } });
    const sc = wrap(g.scene, 0, M_PER); addCarLights(sc, [0.38, 0.25]); A['sf-bus-' + k] = { scene: sc };
  }).catch(e => console.warn('buses-more', k, e))).concat(['f', 'r'].map(h => load('assets/heavy/cars/bus-artic-' + h + '.glb').then(g => {   // bus-artic2 (55, №4): двете секции на съчленения
    g.scene.traverse(o => { if (o.isMesh) { o.castShadow = false; if (o.material && o.material.metalness > 0.5) o.material.metalness = 0.3; } });
    const sc = wrap(g.scene, 0, M_PER); addCarLights(sc); const cut = []; sc.traverse(o => { const l = o.userData.lamp, z = o.position.z; if (h === 'f' ? l === 'rear' || (l === 'blink' && z < 0) : l === 'front' || (l === 'blink' && z > 0) || (!l && o.isMesh && o.geometry?.type === 'PlaneGeometry' && z > 0)) cut.push(o); });
    cut.forEach(o => o.removeFromParent()); A['sf-bus-artic-' + h] = { scene: sc };   /* без стоповете при хармониката (предната) и без фаровете/лъча (задната) */
  }).catch(e => console.warn('bus-artic2', h, e)))));
}
// bus-artic2 (55, №4): съчлененият Volvo на 2 секции (Blender: срязан в средата на хармониката, всяка половина стига 0,4 м отвъд шарнира — застъпват се).
// A['sf-bus-artic-f'] / A['sf-bus-artic-r'] — центрирани като другите (wrap: център по x/z, основа y=0, +z напред); в метри × M_PER.
// Шарнирът: в предната — на z = ARTIC.pf от центъра ѝ; в задната — на z = ARTIC.pr от центъра ѝ (дължините f/r — с застъпването)
export const ARTIC = { f: 10.3, r: 8.6, pf: -4.75, pr: 3.9, len: 18.1 };
// school-bus (55, backlog 25.10 №7): училищните автобуси (Sketchfab, CC-BY — assets/heavy/CREDITS.txt), нормализирани в Blender (+z напред, в метри):
// bus-school — жълтият американски с муцуна (11,6 м); bus-schoolvan — бял микробус Hyundai H350 (6,2 м) с жълта табела отпред и отзад
// (по региона: bg „УЧИЛИЩЕН“, ru „ДЕТИ“, иначе „SCHOOL BUS“). A['sf-bus-school'], A['sf-bus-schoolvan-bg' | '-ru' | '-eu']; schoolBusFor(рег) → името
const SCHOOL_TXT = { bg: 'УЧИЛИЩЕН', ru: 'ДЕТИ', eu: 'SCHOOL BUS' };
function schoolSign(txt) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#f7c600'; x.fillRect(0, 0, 256, 64); x.strokeStyle = '#111'; x.lineWidth = 6; x.strokeRect(3, 3, 250, 58);
  x.fillStyle = '#111'; x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 128, 34, 236);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
}
function loadSchoolBuses(load, A) {
  const prep = g => { g.scene.traverse(o => { if (o.isMesh) { o.castShadow = false; for (const m of [].concat(o.material)) { if (m.metalness > 0.5) m.metalness = 0.3; if (m.emissiveMap) { m.emissive?.setScalar(0.35); } } } }); return g; };   /* емисивната карта на американския (светлините) — не на пълна сила денем */
  return Promise.all([
    load('assets/heavy/cars/bus-school.glb').then(g => { const sc = wrap(prep(g).scene, 0, M_PER); addCarLights(sc); A['sf-bus-school'] = { scene: sc }; }).catch(e => console.warn('school-bus', e)),
    load('assets/heavy/cars/bus-schoolvan.glb').then(g => { prep(g); for (const [r, txt] of Object.entries(SCHOOL_TXT)) {
      const sc = wrap(g.scene.clone(true), 0, M_PER); sc.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(sc), s = b.getSize(new THREE.Vector3()), mat = schoolSign(txt);
      for (const f of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(s.x * 0.62, s.x * 0.155), mat); p.position.set((b.min.x + b.max.x) / 2, b.max.y - s.y * 0.07, f > 0 ? b.max.z - s.z * 0.115 : b.min.z - 0.02); if (f < 0) p.rotation.y = Math.PI; else p.rotation.x = -0.35; sc.add(p); }   /* отпред — над челното стъкло, леко наклонена; отзад — на вратите */
      addCarLights(sc); A['sf-bus-schoolvan-' + r] = { scene: sc }; } }).catch(e => console.warn('school-bus van', e)),
  ]);
}
export const schoolBusFor = reg => reg === 'am' ? 'sf-bus-school' : 'sf-bus-schoolvan-' + (reg === 'bg' ? 'bg' : reg === 'ru' ? 'ru' : 'eu');
export const busesFor = (reg, A) => [...Object.entries(BUS_POOL).filter(([k, [, w]]) => w[reg] && A['sf-bus-' + k]).map(([k, [, w]]) => ['sf-bus-' + k, w[reg]]), ...((reg === 'eu' || reg === 'bg') && A['sf-car-Bus'] ? [['sf-car-Bus', 2]] : [])];
// колите за региона: [[име в A, тегло]…]
export const carsFor = (reg, A) => Object.entries(CAR_POOL).filter(([k, [, w]]) => w[reg] && A['sf-cv-' + k]).map(([k, [, w]]) => ['sf-cv-' + k, w[reg]]);
function loadRealCars(load, A) {
  const SIREN_FILES = new Set(['car-polsuv']);   // REAL_CARS с версия с лещи в cars/sirens (sirens-real) — иначе моделираната лента + процедурната = двойна
  return Promise.all(Object.entries(REAL_CARS).map(([nm, [f, len]]) => load('assets/heavy/cars/' + (feature('sirens-real') && SIREN_FILES.has(f) ? 'sirens/' : '') + f + '.glb').then(g => {
    g.scene.traverse(o => { if (o.isMesh) o.castShadow = false; });
    const sc = wrap(g.scene, 0, len * M_PER);
    if (/^Police/.test(nm)) { sc.userData.lens = LENS[f] || null; addBeacons(sc, len * M_PER, 'police'); }
    addCarLights(sc);
    A['sf-car-' + nm] = { scene: sc };
  }).catch(e => console.warn('real car', nm, e))));
}
// спешните коли за одобрение (Лабораторията → pol-*, fire-*, amb-*): одобрените заместват Police_Sedan / Firetruck / Ambulance,
// всички с мигащи буркани; при няколко одобрени — A[...].variants (game.js model() може да ги редува)
const EMERG_K = { Police_Sedan: 1, Ambulance: 1, Firetruck: 1 };   // всички коли са в истински метри (1 м ≈ 1 единица, хората ~1,9) — спешните вече не се уголемяват
const EMERG = {
  Police_Sedan: [['pol-charger', 5.1], ['pol-crownvic', 5.4], ['pol-interceptor', 5.3], ['pol-nypd', 5.1], ...(feature('pol-new') ? [['pol-logan', 4.36], ['pol-duster', 4.34]] : [['pol-volga', 4.1]])],   // pol-volga — вече ВАЗ 2101 на КАТ (файлът — EMERG_FILE); pol-new — вместо нея Logan и Duster
  Firetruck: [['fire-us', 10], ['fire-man', 10.5], ['fire-titan', 10.8], ['fire-cyber', 10.5]],   // fire-red — изтрита; fire-titan / fire-cyber (f6) — Meshy, Blender: колела wheel_*, буркани siren_*, стълба Ladder
  Ambulance: [['amb-gaz', RS ? 6.2 : 7], ['amb-us', 7.5], ['amb-eu', 7.2]],
};
// почиства модел на кола: маха плоските мешове (сянка/земя под колата — от тях amb-eu беше квадрат 5,8×5,8 и наполовина висок);
// връща завъртането, ако колата лежи по x (дължината трябва да е по z)
// real-sizes (55, одитът на f1): дължината е по каталога, но не по-широка от 2,6 м (пожарната излизаше 3,6 м широка) — еднакво по осите
const capW = (k, W0) => feature('real-sizes') && W0 * k > 2.6 ? 2.6 / W0 : k;
function tidyCar(sc) {
  sc.updateMatrixWorld(true); const all = new THREE.Box3().setFromObject(sc), S = all.getSize(new THREE.Vector3()), big = Math.max(S.x, S.y, S.z), drop = [];
  sc.traverse(m => { if (m.isMesh) { const b = new THREE.Box3().setFromObject(m), s = b.getSize(new THREE.Vector3()); if (s.y < big * 0.01 && Math.max(s.x, s.z) > big * 0.5) drop.push(m); } });
  for (const m of drop) m.parent.remove(m);
  sc.updateMatrixWorld(true); const s2 = new THREE.Box3().setFromObject(sc).getSize(new THREE.Vector3());
  return s2.x > s2.z * 1.15 ? [Math.PI / 2, s2.x, s2.z] : [0, s2.z, s2.x];   // [завъртане, дължина, ширина]
}
// спешна кола за оперативните карти (ops3d.js, opskit.js): копие на модела, почистено и обърнато като в играта, дължина len (м),
// светлинната лента/бурканите (kind: police | fire | ambulance); светят, докато car.userData.beaconsOn е истина (сирените — от картата)
// модели с предница към −Z (вървят на заден ход, ако не се обърнат)
export const CAR_FLIP = new Set(['amb-eu']);
export function emergCar(src, len, kind = 'police', name = '') { const sc0 = src.clone(true); sc0.traverse(m => { if (m.isMesh) m.castShadow = false; }); const [yaw, L0, W0] = tidyCar(sc0), k = capW(len / L0, W0), sc = wrap(sc0, yaw + (CAR_FLIP.has(name) ? Math.PI : 0), k); addBeacons(sc, L0 * k, kind); sc.userData.noSiren = 1; return sc; }
// отбелязаните в Лабораторията „Изтрий и намери нов подобен“: флагът (одобреният) остава, файлът — новият модел (55)
const EMERG_FILE = { 'fire-us': 'fire-us2', 'pol-volga': 'pol-vaz' };
// pol-new (55): полицейските коли от наличните (Blender, _source: scratchpad polcar.py) — Dacia Logan (бяла, синя лента „ПОЛИЦИЯ“, сини буркани) за България/Европа
// и Dacia Duster („ДПС ПОЛИЦИЯ“, червено-синя лента) за Русия; американските — за Америка. Всяка кола — с региона си (userData.polReg), model() избира по града
const POL_REG = { 'pol-logan': ['bg', 'eu', 'xx'], 'pol-duster': ['ru'], 'pol-charger': ['am', 'xx'], 'pol-crownvic': ['am', 'xx'], 'pol-interceptor': ['am', 'xx'], 'pol-nypd': ['am'] };
// 🚒 fire-titan / fire-cyber (f6, решението на потребителя): Red Titan — американските градове; киберпънк пожарната (със стълбата) — само модерните мегаполиси;
// Европа (и останалите) — MAN със стълбата. Действа, щом някоя от двете е включена (иначе пожарните се редуват както досега)
const FIRE_REG = { 'fire-titan': ['am'], 'fire-cyber': ['cyber'], 'fire-man': ['bg', 'eu', 'ru', 'xx'], 'fire-us': ['xx'] };   // в Америка — само Red Titan
export const FIRE_CYBER = new Set(['dubai', 'singapore', 'tokyo', 'shanghai']);
export const fireVariants = (V, reg, cityId) => { if (!feature('fire-titan') && !feature('fire-cyber')) return V; const k = FIRE_CYBER.has(cityId) ? 'cyber' : reg, r = V.filter(v => (v.userData.fireReg || []).includes(k)); return r.length ? r : V; };
export const polVariants = (V, reg) => { const r = V.filter(v => !v.userData.polReg || v.userData.polReg.includes(reg)); return r.length ? r : V; };
// фаровете на спешните коли (отчетени в Blender отпред, лъч до стъклото): [дял от полуширината, дял от височината, колко са навътре от предницата (дял от дължината)]
// emergLights слага там мигащите на смени фарове (emerg-wigwag); без запис — общите места (addTruckLamps)
const LENS = { 'pol-charger': [0.64, 0.47, 0.067], 'pol-crownvic': [0.5, 0.42, 0.033], 'pol-interceptor': [0.6, 0.45, 0.06], 'pol-nypd': [0.64, 0.42, 0.073], 'pol-vaz': [0.7, 0.38, 0.036],
  'car-polsuv': [0.64, 0.5, 0.052], 'fire-us2': [0.46, 0.3, 0.057], 'fire-man': [0.7, 0.3, 0.061], 'amb-gaz': [0.66, 0.36, 0.012], 'amb-us': [0.74, 0.4, 0.047], 'amb-eu': [0.68, 0.28, 0.023] };   // Firetruck (OzerGokmen, CC BY) · VAZ 2101 Road Police (eightismore, CC BY)
export function loadPoliceCars(load, A) {
  return Promise.all(Object.entries(EMERG).map(([nm, opts]) => {
    const ok = opts.filter(([f]) => feature(f) || (feature('pol-new') && (f === 'pol-logan' || f === 'pol-duster'))); if (!ok.length) return null;   /* pol-new: новите — с общия флаг */
    return Promise.all(ok.map(([f, len]) => load('assets/heavy/cars/' + (feature('sirens-real') ? 'sirens/' : '') + (EMERG_FILE[f] || f) + '.glb').then(g => { g.scene.traverse(m => { if (m.isMesh) m.castShadow = false; }); const [yaw, L0, W0] = tidyCar(g.scene), K = L0 * capW(EMERG_K[nm] * len * M_PER / L0, W0 / M_PER) /* real-sizes: ширината ≤ 2,6 м */, sc = wrap(g.scene, yaw + (CAR_FLIP.has(f) ? Math.PI : 0), K / L0); /* мащабът е във вътрешната група — model() пипа само външния */ sc.userData.lens = LENS[EMERG_FILE[f] || f] || null; if (feature('pol-new') && POL_REG[f]) sc.userData.polReg = POL_REG[f]; if (FIRE_REG[f]) sc.userData.fireReg = FIRE_REG[f]; addBeacons(sc, K, nm === 'Firetruck' ? 'fire' : nm === 'Ambulance' ? 'ambulance' : 'police'); if (feature('car-lens')) addCarLights(sc); /* car-lens: и спешните коли — с фарове (нямаха) */ return sc; }).catch(() => null)))
      .then(list => { list = list.filter(Boolean); if (list.length) A['sf-car-' + nm] = { scene: list[0], variants: list }; });
  }));
}

// модерни ТИР-ове (Лабораторията → trucks-real): влекачи Scania S и Volvo FH (Sketchfab, CC-BY; assets/heavy/trucks, дължина 1 по z).
//   A['sf-trk-0|1'] — само влекачът (дължина 1; trucks.js го мащабира и закача своето ремарке с товара)
//   A['sf-semi-0|1'] — влекач + бяло полуремарке с цветна ивица, в мащаба на града (магистралите, hwtraffic.js)
const TRK = ['scania-r', 'volvo'],   /* Scania R (radzig541, CC BY) — замества старата S-Series (55) */ SEMI_COL = [0xd62828, 0x1f5fbf];
export const truckLamps = (() => { let m = null; return () => m || (m = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 1, 32, 32, 31);
  gr.addColorStop(0, 'rgba(255,250,225,1)'); gr.addColorStop(0.35, 'rgba(255,235,180,0.55)'); gr.addColorStop(1, 'rgba(255,220,150,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c), mk = col => { const mm = new THREE.MeshStandardMaterial({ color: 0, emissive: col, emissiveMap: t, emissiveIntensity: 0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); NF_MATS.add(mm); return mm; };
  return { front: mk(0xd8ceb0), rear: mk(0xa01010) };
})()); })();
// фарове (отпред) и стопове (отзад) на обект с предница към +z и дължина len; w — ширина, y — височина на фаровете
// стоповете при спиране (и денем) и мигачите — общи материали; traffic.js сменя материала на стоповете и пали мигачите
export const lampMats = (() => { let m = null; return () => m || (m = (() => {
  const t = truckLamps().front.emissiveMap, mk = (col, k) => new THREE.MeshStandardMaterial({ color: 0, emissive: col, emissiveMap: t, emissiveIntensity: k, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  return { brake: mk(0xff1a1a, 2.2), blink: mk(0xffa21a, 2.4) };
})()); })();
export function addTruckLamps(o, len, w = 2.4, y = 1.1, rearZ = null) {
  const L = truckLamps(), B = lampMats(), fs = feature('car-lens') ? 0.42 : 0.9;
  for (const sx of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), L.front); f.position.set(sx * w * 0.36, y, len / 2 + 0.05); f.userData.lamp = 'front'; o.add(f);
    const r = new THREE.Mesh(new THREE.PlaneGeometry(fs < 0.9 ? fs * 0.62 : 0.5, fs < 0.9 ? fs * 0.62 : 0.5), L.rear);   /* car-lens: стоповете ~0,26 м (бяха 0,5) */ r.rotation.y = Math.PI; r.position.set(sx * w * 0.42, y, (rearZ ?? -len / 2) - 0.05); r.userData.lamp = 'rear'; o.add(r);
    for (const [z, ry] of [[len / 2 + 0.06, 0], [(rearZ ?? -len / 2) - 0.06, Math.PI]]) {   // мигачите: отпред и отзад, в ъглите; лявата страна е +x (колата гледа към +z)
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), B.blink); b.rotation.y = ry; b.position.set(sx * w * 0.47, y + 0.05, z); b.visible = false; b.userData.lamp = 'blink'; b.userData.side = sx > 0 ? 'L' : 'R'; o.add(b);
    }
  }
}
// фаровете на колите (Лабораторията → car-lights): двата фара и стоповете (addTruckLamps) + светло петно на асфалта пред колата —
// конус, който избледнява напред (адитивно, нощем; денем е черно — не се вижда)
let beamM = null;
const carBeam = () => beamM || (beamM = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 128; y++) { const t = y / 127, w = 10 + t * 26, a = Math.pow(1 - t, 1.6) * (t < 0.06 ? t / 0.06 : 1); const g = x.createLinearGradient(32 - w, 0, 32 + w, 0); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, `rgb(${Math.round(255 * a)},${Math.round(236 * a)},${Math.round(190 * a)})`); g.addColorStop(1, 'rgba(0,0,0,1)'); x.fillStyle = g; x.fillRect(32 - w, y, 2 * w, 1); }
  const m = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xfff0d0, emissiveMap: new THREE.CanvasTexture(c), emissiveIntensity: 0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  NF_MATS.add(m); m.userData.nfK = 0.9; return m;
})());
// park-dark: паркираната кола — без фарове, стопове и лъч на пътя (групата от addCarLights е в общия модел, копията я носят)
export const darkParked = o => { if (o && feature('park-dark')) o.traverse(c => { if (c.userData.carLights) c.visible = false; }); return o; };
export function addCarLights(sc) {
  if (!feature('car-lights') || sc.userData.emergLit) return;   // спешните (emerg-lights) си имат свои
  sc.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(sc), s = b.getSize(new THREE.Vector3()), len = s.z;
  const g = new THREE.Group(); g.position.z = (b.min.z + b.max.z) / 2; g.userData.carLights = 1; sc.add(g);   // carLights — паркираните копия я крият (park-dark)
  addTruckLamps(g, len, s.x, s.y * 0.42);
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(s.x * 2.2, len * 2.2), carBeam()); pl.rotation.x = -Math.PI / 2; pl.position.set(0, 0.06, len / 2 + len * 1.1); pl.renderOrder = 2; g.add(pl);
}
// truck-smooth (T1): полуремаркето — отделен възел „semi-trailer“ с шарнир на седлото (userData: zk — седлото, za — оста на ремаркето
// спрямо седлото, zf/zr — предната и задната ос на влекача, в координатите на композицията); колелата — на собствени оси (userData.wheelR),
// въртят се около x. Влекачите имат отделни колела в GLB (Scania: Vheel*, Volvo: Wheel*) — оста е в центъра на всяко.
function semiRig(semi, cab, trL, cabL) {
  semi.updateMatrixWorld(true);
  const zk = trL / 2 - 1.3 * M_PER, T = new THREE.Group(); T.name = 'semi-trailer'; T.position.z = zk;
  semi.userData.semi = { zk, za: -trL / 2 + 1.85 * M_PER - zk, zf: trL / 2 + cabL - HITCH * M_PER - 1.5 * M_PER, zr: zk };
  const rim = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.4, metalness: 0.5 }), dark = new THREE.MeshStandardMaterial({ color: 0x15171a });
  for (const c of [...semi.children]) if (c !== cab && c.position.z < trL / 2 - 0.01) {
    semi.remove(c); c.position.z -= zk; T.add(c);
    if (c.geometry?.type === 'CylinderGeometry') { c.userData.wheelR = 0.5 * M_PER;   // джанта с греди — да се вижда въртенето
      c.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3 * M_PER, 0.3 * M_PER, 0.37 * M_PER, 10).rotateZ(Math.PI / 2), rim), new THREE.Mesh(new THREE.BoxGeometry(0.38 * M_PER, 0.07 * M_PER, 0.58 * M_PER), dark)); }
  }
  semi.add(T);
  const B = new THREE.Box3(), W = []; cab.traverse(m => { if (m.isMesh && /^(vheel|wheel)/i.test(m.name)) W.push(m); });
  for (const m of W) { B.setFromObject(m); const P = new THREE.Group(), s = B.getSize(new THREE.Vector3()); B.getCenter(P.position); P.userData.wheelR = Math.max(0.2, s.y / 2); semi.add(P); P.updateMatrixWorld(true); P.attach(m); }
}
// truck-box (T1): бял камион-фургон (Meshy AI, ТЕМИДАСОФТ) — 8 × 2,6 × 3,3 м, гледа към +z; в Blender: трите оси с колелата — отделни възли
// (wheel_front / wheel_rear1 / wheel_rear2, началото — на оста), фаровете и стоповете — емисионни възли (lamp_head_* / lamp_tail_*). A['sf-car-BoxTruck'] — в мащаба на града
function loadBoxTruck(load, A) {
  return load('assets/heavy/trucks/box-truck.glb').then(g => {
    g.scene.traverse(m => { if (m.isMesh) m.castShadow = false; if (/^wheel_/.test(m.name)) m.userData.wheelR = 0.49 * M_PER; });
    const o = new THREE.Group(); g.scene.scale.setScalar(M_PER); o.add(g.scene); addTruckLamps(o, 8 * M_PER, 2.6 * M_PER, 0.8 * M_PER);
    A['sf-car-BoxTruck'] = { scene: o };
  }).catch(e => console.warn('box truck', e));
}
function loadRealTrucks(load, A) {
  const box = feature('truck-box') ? loadBoxTruck(load, A) : null;   // truck-box — заедно с влекачите (магистралата чака и него)
  return Promise.all([box, ...TRK.map((f, i) => load('assets/heavy/trucks/' + f + '.glb').then(g => {
    g.scene.traverse(m => { if (m.isMesh) { m.castShadow = false; if (f === 'volvo') { m.material = m.material.clone(); m.material.color.multiplyScalar(2.2); } } });   // черният Volvo — малко по-светъл
    A['sf-trk-' + i] = { scene: wrap(g.scene, 0, null) };
    // полуремарке за магистралата: влекач 6 м + ремарке 13,6 м
    const semi = new THREE.Group(), cab = wrap(g.scene.clone(true), 0, null), cabL = 6 * M_PER, trL = 13.6 * M_PER, W = 2.5 * M_PER;
    cab.scale.setScalar(cabL); cab.position.z = trL / 2 + cabL / 2 - HITCH * M_PER; semi.add(cab);
    const box = new THREE.Mesh(new THREE.BoxGeometry(W, 2.9 * M_PER, trL), new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.6 })); box.position.y = 2.65 * M_PER; box.castShadow = false; semi.add(box);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, 0.5 * M_PER, trL * 0.9), new THREE.MeshStandardMaterial({ color: SEMI_COL[i], roughness: 0.5 })); stripe.position.y = 2.2 * M_PER; semi.add(stripe);
    for (const z of [-trL / 2 + 1.2 * M_PER, -trL / 2 + 2.5 * M_PER]) for (const x of [-1, 1]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * M_PER, 0.5 * M_PER, 0.35 * M_PER, 12).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x15171a })); wh.position.set(x * W * 0.42, 0.5 * M_PER, z); semi.add(wh); }
    addTruckLamps(semi, 0, W, 0.9 * M_PER, -trL / 2);
    for (const c of semi.children) if (c.geometry?.type === 'PlaneGeometry' && c.position.z > 0) c.position.z = trL / 2 + cabL - HITCH * M_PER + 0.05;   // фаровете — на челото на влекача
    if (feature('truck-smooth')) semiRig(semi, cab, trL, cabL);
    A['sf-semi-' + i] = { scene: semi };
  }).catch(e => console.warn('real truck', f, e)))]);
}

// сирена: когато бурканите светнат на кола близо до камерата — веднъж на включване, не по-често от 14 s за всички
// няколко записа на вид (Pixabay, CREDITS-pixabay.txt) — всяка кола си избира един и го пази
const SFX = n => new URL('assets/sfx/' + n, import.meta.url).href;   // спрямо модула — и от страниците в lab/ (иначе lab/assets/sfx → 404)
const SIREN = { police: ['', '-2', '-3', '-4', '-5'].map(k => SFX(`siren-police${k}.mp3`)), fire: ['', '-2', '-3', '-4'].map(k => SFX(`siren-fire${k}.mp3`)), ambulance: [SFX('siren-ambulance.mp3')] };
let sirenAt = -1e9;
// сирена от кола (вид police/fire/ambulance) на разстояние d от камерата — общото ограничение (не една върху друга) важи и за incidents.js
export function playSiren(kind, car, d, gap = 6) {
  const t = performance.now() / 1000; if (!feature('sirens2') || t - sirenAt < gap || d > 220) return false;
  sirenAt = t; const L = SIREN[kind] || SIREN.police; car.userData.sirenN ??= (Math.random() * L.length) | 0;
  Sound.file(L[car.userData.sirenN % L.length], Math.max(0.12, 0.8 - d / 260)); return true;
}
export const sirenKind = car => { let k = null; car.traverse(o => { if (!k && o.userData?.kind && o.userData.red) k = o.userData.kind; }); return k; };
// буркан: свой клас, за да оцелее анимацията при clone() (методите са в прототипа); всяко копие си прави свой материал.
// Леща (емисивна сфера) + ореол (спрайт): ляво червено, дясно синьо, редуват се ~2,5 Hz; включват се „от време на време“.
const beaconState = (car, t) => car.userData.forceBeacons || car.userData.beaconsOn || !car.userData.noBeacons && Math.sin(t / 20 * Math.PI * 2 + (car.id * 2.39) % 6.28) > 0.1;
export const beaconsLit = car => !!car && beaconState(car, performance.now() / 1000);   // #14: светят ли бурканите сега (трафикът: колите ѝ правят път)
const carOf = o => { let c = o.parent; while (c && !c.userData.isCar) c = c.parent; return c; };
class Beacon extends THREE.Mesh {
  onBeforeRender(renderer, scene, camera) {
    if (!this.userData.own) { this.material = this.material.clone(); this.userData.own = 1; }
    const car = carOf(this); if (!car) return;
    const t = performance.now() / 1000, on = beaconState(car, t), lit = on && (Math.floor(t * 5) + (this.userData.red ? 0 : 1)) % 2 === 0;
    this.material.emissiveIntensity = lit ? 4 : 0.15;
    if (this.userData.red) {
      if (!car.userData.noSiren && on && (!car.userData.sirenOn || car.userData.forceBeacons) && feature('sirens2') && t - sirenAt > (car.userData.forceBeacons ? 6 : 14) && (!car.userData.forceBeacons || Math.random() < 0.05)) {   // в демото — всеки път друга кола
        const d = this.getWorldPosition(new THREE.Vector3()).distanceTo(camera.position);
        if (d < 160) { sirenAt = t; const L = SIREN[this.userData.kind] || SIREN.police; car.userData.sirenN ??= (Math.random() * L.length) | 0; Sound.file(L[car.userData.sirenN % L.length], Math.max(0.15, 0.7 - d / 260)); }
      }
      car.userData.sirenOn = on;
    }
  }
}
class BeaconGlow extends THREE.Sprite {
  onBeforeRender() {
    if (!this.userData.own) { this.material = this.material.clone(); this.userData.own = 1; }
    const car = carOf(this); if (!car) return;
    const t = performance.now() / 1000, on = beaconState(car, t), lit = on && (Math.floor(t * 5) + (this.userData.red ? 0 : 1)) % 2 === 0;
    this.material.opacity = lit ? 1 : 0;
  }
}
let glowTex = null;
const BEACON = { r: new THREE.MeshStandardMaterial({ color: 0x501010, emissive: 0xff2020, emissiveIntensity: 0.15, roughness: 0.3 }), b: new THREE.MeshStandardMaterial({ color: 0x101850, emissive: 0x2060ff, emissiveIntensity: 0.15, roughness: 0.3 }) };
// светлинна лента на покрива (Лабораторията → beacons2): по 3 сегмента на страна, тройни проблясъци — лявата, после
// дясната страна (~1,4 Hz), вътрешните сегменти закъсняват малко (пробягване); ореол над всяка страна и цветно петно на пътя.
const BAR_COL = { police: [0xff2a2a, 0x2a6bff], ambulance: [0xff2a2a, 0x2a6bff], fire: [0xff2a2a, 0xff7a1a], utility: [0xffa000, 0xffc400] };   // utility — аварийните (енергетици, пътна помощ)
const BAR_T = 0.7, BAR_ON = [[0, 0.07], [0.12, 0.19], [0.24, 0.31]];
const barLit = (car, side, j, t) => { if (!beaconState(car, t)) return false; const u = (((t + (car.id || 0) * 0.37 - j * 0.025) / BAR_T) % 1 + 1) % 1 - side * 0.5; return BAR_ON.some(([a, b]) => u >= a && u < b); };
class BarSeg extends Beacon {
  onBeforeRender(renderer, scene, camera) { super.onBeforeRender(renderer, scene, camera); const car = carOf(this); if (car) this.material.emissiveIntensity = barLit(car, this.userData.side, this.userData.j, performance.now() / 1000) ? 2.6 : 0.35; }   /* угасналата страна — слабо в своя цвят (иначе лентата изглежда едноцветна) */
}
class BarGlow extends THREE.Sprite {
  onBeforeRender() { if (!this.userData.own) { this.material = this.material.clone(); this.userData.own = 1; } const car = carOf(this); if (car) this.material.opacity = barLit(car, this.userData.side, 0, performance.now() / 1000) ? 1 : 0; }
}
class BarPool extends THREE.Mesh {   // петното светлина на пътя: цветът на страната, която свети
  onBeforeRender() { if (!this.userData.own) { this.material = this.material.clone(); this.userData.own = 1; } const car = carOf(this); if (!car) return; const t = performance.now() / 1000, L = barLit(car, 0, 0, t), R = barLit(car, 1, 0, t);
    this.material.opacity = L || R ? 0.8 : 0; if (L || R) this.material.color.setHex(this.userData.cols[L ? 0 : 1]); }
}
// 🚨 истинските сирени (Лабораторията → sirens-real): assets/heavy/cars/sirens/*.glb имат лещи siren_L/siren_R (+L1/R1 отзад, siren_C — един буркан)
// точно върху моделираната лента/бурканите (Blender). Всяка леща става BarSeg (същият ритъм и звук като лентата на beacons2), + ореол и петно на пътя.
const SIREN_COL = { red: 0xff2a2a, blue: 0x2a6bff, white: 0xf4f6ff };
function realSirens(car, kind) {
  const nodes = []; car.traverse(o => { if (/^siren_[LRC]\d*$/.test(o.name)) nodes.push(o); }); if (!nodes.length) return false;
  const bb = new THREE.Box3().setFromObject(car), W = bb.max.x - bb.min.x, Lc = bb.max.z - bb.min.z, cols = [...(BAR_COL[kind] || BAR_COL.police)], segs = [];
  for (const o of nodes) { const side = o.userData.side ?? (/_R/.test(o.name) ? 1 : 0), col = SIREN_COL[o.userData.col] ?? cols[side]; cols[side] = col;
    const ms = []; o.traverse(m => { if (m.isMesh) ms.push(m); });
    for (const m of ms) { const mat = BEACON[side ? 'b' : 'r'].clone(); mat.emissive.setHex(col); mat.color.setHex(col).multiplyScalar(0.25); mat.transparent = true; mat.opacity = 0.6; mat.depthWrite = false;
      const sg = new BarSeg(m.geometry, mat); sg.name = m.name; sg.position.copy(m.position); sg.quaternion.copy(m.quaternion); sg.scale.set(1, 1, 1); sg.castShadow = false;
      sg.userData = { red: false, kind, side, j: 0 }; m.parent.add(sg); m.parent.remove(m); segs.push(sg); } }
  (segs.find(x => x.userData.side === 0) || segs[0]).userData.red = true;   // звукът и sirenKind — от една леща
  car.updateMatrixWorld(true);
  for (const sg of segs) { const g = new BarGlow(new THREE.SpriteMaterial({ map: glowTex, color: cols[sg.userData.side], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    g.position.copy(car.worldToLocal(sg.getWorldPosition(new THREE.Vector3()))); g.position.y += W * 0.04; g.renderOrder = 2; g.scale.setScalar(W * 0.42); g.userData.side = sg.userData.side; car.add(g); }   /* по-малък ореол (бе W·0,9) — светещата страна покриваше цялата лента с един цвят */
  const pool = new BarPool(new THREE.PlaneGeometry(W * 3.2, Lc * 1.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: cols[0], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4 }));
  pool.position.set(0, bb.min.y + 0.06, (bb.min.z + bb.max.z) / 2); pool.userData.cols = cols; pool.renderOrder = 1; car.add(pool);
  return true;
}
function addLightBar(car, kind) {
  const bb = new THREE.Box3().setFromObject(car), W = bb.max.x - bb.min.x, Lc = bb.max.z - bb.min.z, y = bb.max.y + 0.02, z = (bb.min.z + bb.max.z) / 2 + Lc * 0.04;
  const bw = W * 0.66, bd = Math.max(0.12, W * 0.13), bh = Math.max(0.06, W * 0.055), cols = BAR_COL[kind] || BAR_COL.police;
  const base = new THREE.Mesh(new THREE.BoxGeometry(bw, bh * 0.6, bd), new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.5, metalness: 0.4 })); base.position.set(0, y + bh * 0.3, z); car.add(base);
  const sw = bw / 7, geo = new THREE.BoxGeometry(sw * 0.92, bh, bd * 0.9);
  for (const side of [0, 1]) for (let j = 0; j < 3; j++) {
    const k = side ? 'b' : 'r', mat = BEACON[k].clone(); mat.emissive.setHex(cols[side]); mat.color.setHex(cols[side]).multiplyScalar(0.25); mat.transparent = true; mat.opacity = 0.92;
    const m = new BarSeg(geo, mat), x = (side ? 1 : -1) * (bw / 2 - sw * (j + 0.5));
    m.position.set(x, y + bh * 0.6 + bh / 2, z); m.userData = { red: side === 0 && j === 0, kind, side, j }; car.add(m);
  }
  { const mid = new THREE.Mesh(new THREE.BoxGeometry(sw * 0.9, bh * 0.8, bd * 0.85), new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xffffff, emissiveIntensity: 0.3 })); mid.position.set(0, y + bh * 0.6 + bh * 0.4, z); car.add(mid); }
  for (const side of [0, 1]) {
    const g = new BarGlow(new THREE.SpriteMaterial({ map: glowTex, color: cols[side], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    g.position.set((side ? 1 : -1) * bw * 0.32, y + bh * 1.2, z); g.renderOrder = 2; g.scale.setScalar(W * 1.6); g.userData.side = side; car.add(g);
  }
  const pool = new BarPool(new THREE.PlaneGeometry(W * 3.2, Lc * 1.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: cols[0], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4 }));
  pool.position.set(0, bb.min.y + 0.06, (bb.min.z + bb.max.z) / 2); pool.userData.cols = cols; pool.renderOrder = 1; car.add(pool);
}
function addBeacons(car, len, kind = 'police') { addBeacons0(car, len, kind); if (feature('emerg-lights')) emergLights(car, kind); }
function addBeacons0(car, len, kind) {
  if (!glowTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 1, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,255,255,0.7)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(c); }
  car.userData.isCar = true; car.updateMatrixWorld(true);
  if (feature('sirens-real') && realSirens(car, kind)) return;   // моделът си има лентата/бурканите — светят те (assets/heavy/cars/sirens)
  if (feature('beacons2')) return addLightBar(car, kind);
  const bb = new THREE.Box3().setFromObject(car), W = bb.max.x - bb.min.x, y = bb.max.y + 0.06, z = (bb.min.z + bb.max.z) / 2 + len * 0.08, r = Math.max(0.07, W * 0.04);
  const geo = new THREE.SphereGeometry(r, 12, 8);
  for (const [k, sx, col] of [['r', -1, 0xff3030], ['b', 1, 0x3070ff]]) {
    const m = new Beacon(geo, BEACON[k]); m.position.set(sx * W * 0.18, y, z); m.scale.y = 0.7; m.userData.red = k === 'r'; m.userData.kind = kind; car.add(m);
    const g = new BeaconGlow(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); g.position.copy(m.position); g.position.y += r; g.material.depthTest = true; g.renderOrder = 2; g.scale.setScalar(W * 0.6); g.userData.red = k === 'r'; car.add(g);
  }
}

// 💡 светлините на спешните коли (Лабораторията → emerg-lights): фарове + стопове и светло петно пред колата (като car-lights),
// по-голям ореол на сирените, цветни петна на пътя отляво/отдясно (редуват се с проблясъците), окраската леко свети нощем,
// пожарните — бели работни светлини отстрани, линейките — задни прожектори. Само емисивни материали и спрайтове — без истински светлини/сенки.
const nightK = () => truckLamps().front.emissiveIntensity;   // 0 денем … 1 нощем (daynight.js → NF_MATS)
// нощните петна и лампи — MeshBasic (без отблясъци денем), прозрачността следва нощта; всеки материал е с една сила k
let EL = null;
const elMats = () => EL || (EL = (() => {
  const mk = (col, k, map = glowTex) => { const m = new THREE.MeshBasicMaterial({ color: col, map, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 }); m.userData.k = k; return m; };
  return { front: mk(0xfff2d8, 1), rear: mk(0xff2010, 0.9), work: mk(0xfff4e0, 1), pool: mk(0xfff0d8, 0.32), scene: mk(0xffffff, 0.4), beam: mk(0xfff0d0, 0.75, carBeam().emissiveMap) };
})());
class ElNight extends THREE.Mesh { onBeforeRender() { const k = this.material.userData.k; if (k != null) this.material.opacity = nightK() * k; } }   // стоповете при спиране (traffic.js сменя материала) — без k
// фаровете на спешната кола: докато бурканите светят — мигат на смени ляво/дясно (по 0,25 s); иначе — като ElNight
class ElWig extends THREE.Mesh { onBeforeRender() { if (!this.userData.own) { this.material = this.material.clone(); this.userData.own = 1; } const car = carOf(this), t = performance.now() / 1000;
  this.material.opacity = car && beaconState(car, t) ? ((Math.floor(t * 4) + this.userData.side) % 2 ? 0.95 : 0.06) : nightK() * (this.material.userData.k ?? 1); } }
class ElWash extends THREE.Sprite {   // цветното сияние върху каросерията — страната, която свети
  onBeforeRender() { if (!this.userData.own) { this.material = this.material.clone(); this.userData.own = 1; } const car = carOf(this); if (car) this.material.opacity = barLit(car, this.userData.side, 0, performance.now() / 1000) ? this.userData.k * (0.4 + 0.6 * nightK()) : 0; }
}
class ElPool extends THREE.Mesh {     // петно на пътя отстрани на колата, в цвета на своята страна
  onBeforeRender() { if (!this.userData.own) { this.material = this.material.clone(); this.userData.own = 1; } const car = carOf(this); if (car) this.material.opacity = barLit(car, this.userData.side, 0, performance.now() / 1000) ? 0.85 * (0.3 + 0.7 * nightK()) : 0; }
}
const LIVERY = new Map();   // материал на модела → копие, което нощем леко свети с текстурата си
function emergLights(car, kind) {
  car.userData.emergLit = 1; car.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(car), s = bb.getSize(new THREE.Vector3()), W = s.x, len = s.z, cz = (bb.min.z + bb.max.z) / 2, y0 = bb.min.y, E = elMats();
  let cols = BAR_COL[kind] || BAR_COL.police; const glows = [];
  car.traverse(o => { if (o instanceof BarPool) cols = o.userData.cols; if (o instanceof BarGlow || o instanceof BeaconGlow) glows.push(o); else if (o.isMesh && !(o instanceof Beacon) && !(o instanceof BarPool)) {
    const ms = Array.isArray(o.material) ? o.material : [o.material], out = ms.map(m => { if (!m?.isMeshStandardMaterial || !m.map || m.transparent || m.emissive.getHex()) return m;
      let L = LIVERY.get(m); if (!L) { L = m.clone(); L.emissive.setHex(0xffffff); L.emissiveMap = m.map; L.emissiveIntensity = 0; L.userData.nfK = 0.13; NF_MATS.add(L); LIVERY.set(m, L); } return L; });
    o.material = Array.isArray(o.material) ? out : out[0]; } });
  for (const g of glows) g.scale.multiplyScalar(1.7);   // по-силен ореол
  car.traverse(o => { if (o instanceof BarPool) o.scale.set(1.3, 1, 1.5); });
  const g = new THREE.Group(); g.position.z = cz; car.add(g);
  addTruckLamps(g, len, W, y0 + Math.min(s.y * 0.38, 1.0));
  const LZ = car.userData.lens; if (LZ) for (const o of g.children) if (o.userData.lamp === 'front') o.position.set(Math.sign(o.position.x) * LZ[0] * W / 2, y0 + LZ[1] * s.y, len / 2 - LZ[2] * len + 0.03);   // точно върху фаровете на модела
  for (const o of [...g.children]) if (o.userData.lamp === 'front' || o.userData.lamp === 'rear') {   // фаровете/стоповете — без отблясъци денем (MeshBasic); userData.lamp остава за traffic.js
    const front = o.userData.lamp === 'front' && feature('emerg-wigwag'), m = new (front ? ElWig : ElNight)(o.geometry, E[o.userData.lamp]); m.position.copy(o.position); m.rotation.copy(o.rotation); m.userData = front ? { ...o.userData, side: o.position.x > 0 ? 1 : 0 } : o.userData; g.add(m); g.remove(o); }   // фаровете — на смени при бурканите
  const beam = new ElNight(new THREE.PlaneGeometry(W * 2.2, len * 1.8), E.beam); beam.rotation.x = -Math.PI / 2; beam.position.set(0, y0 + 0.06, len / 2 + len * 0.9); beam.renderOrder = 2; g.add(beam);
  for (const side of [0, 1]) {
    const sx = side ? 1 : -1;
    const w = new ElWash(new THREE.SpriteMaterial({ map: glowTex, color: cols[side], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    w.position.set(sx * W * 0.25, y0 + s.y * 0.75, 0); w.scale.setScalar(Math.max(W, s.y) * 2.6); w.userData = { side, k: 0.45 }; w.renderOrder = 2; g.add(w);
    const p = new ElPool(new THREE.PlaneGeometry(W * 2.4, len * 1.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: cols[side], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4 }));
    p.position.set(sx * W * 1.3, y0 + 0.07, 0); p.userData = { side }; p.renderOrder = 1; g.add(p);
  }
  const plate = (x, y, z, ry, k = 0.55) => { const m = new ElNight(new THREE.PlaneGeometry(k, k), E.work); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); };
  const ground = (x, z, w, d, M = E.pool) => { const m = new ElNight(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), M); m.position.set(x, y0 + 0.08, z); m.renderOrder = 1; g.add(m); };
  if (kind === 'fire') {   // работните светлини: по три отстрани, високо, и бяло петно на земята до колата
    for (const sx of [-1, 1]) { for (const f of [-0.3, 0, 0.3]) plate(sx * (W / 2 + 0.04), y0 + s.y * 0.62, f * len, sx * Math.PI / 2); ground(sx * (W / 2 + W * 0.7), 0, W * 1.4, len * 0.75); }
  } else if (kind === 'ambulance') {   // задните прожектори горе в ъглите + петно зад колата
    for (const sx of [-1, 1]) plate(sx * W * 0.4, y0 + s.y * 0.86, -len / 2 - 0.05, Math.PI, 0.45);
    ground(0, -len / 2 - len * 0.22, W * 1.6, len * 0.45, E.scene);
  }
}
