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
      A['sf-car-' + nm] = { scene: wrap(grp, 0, k) }; addCarLights(A['sf-car-' + nm].scene);
    }
  }).catch(e => console.warn('vehmodels cars', e)).then(() => feature('cars-real') && loadRealCars(load, A)).then(() => loadVans(load, A, M_PER)).then(() => feature('trucks-real') && loadRealTrucks(load, A)).then(() => loadPoliceCars(load, A)));
  return Promise.all(jobs);
}

// реалистичните коли (Sketchfab, CC-BY; assets/heavy/cars, нормализирани: дължина 1 по z, предницата към +z, текстури 512 px).
// Заместват част от „Free Low Poly Vehicles Pack“ под същите имена; дължината — истинската в метри × мащаба на града.
const REAL_CARS = {   // име: [файл, дължина в м]
  Sedan: ['car-polo', RS ? 4.05 : 4.4], Hatchback: ['car-p206', 3.8], SUV: ['car-renegade', 4.25], Pickup: ['car-hilux', 5.3], Taxi: ['car-taxi', 4.9],
Muscle: ['car-accord', RS ? 4.9 : 4.7], Muscle_2: ['car-corolla', RS ? 4.63 : 4.2], Police_Sedan: ['car-crownvic', 5.4], Bus: ['bus-citaro', 12], Limousine: ['car-limo', 7.6], Police_SUV: ['car-polsuv', RS ? 6.0 : 4.9], Truck: ['car-truck', 6.5],
};
const M_PER = CAR_LEN / 4.5;   // седанът от пакета (≈4,5 м) е CAR_LEN в света на играта
function loadRealCars(load, A) {
  return Promise.all(Object.entries(REAL_CARS).map(([nm, [f, len]]) => load('assets/heavy/cars/' + f + '.glb').then(g => {
    g.scene.traverse(o => { if (o.isMesh) o.castShadow = false; });
    const sc = wrap(g.scene, 0, len * M_PER);
    if (/^Police/.test(nm)) addBeacons(sc, len * M_PER, 'police');
    addCarLights(sc);
    A['sf-car-' + nm] = { scene: sc };
  }).catch(e => console.warn('real car', nm, e))));
}
// спешните коли за одобрение (Лабораторията → pol-*, fire-*, amb-*): одобрените заместват Police_Sedan / Firetruck / Ambulance,
// всички с мигащи буркани; при няколко одобрени — A[...].variants (game.js model() може да ги редува)
const EMERG_K = { Police_Sedan: 1, Ambulance: 1, Firetruck: 1 };   // всички коли са в истински метри (1 м ≈ 1 единица, хората ~1,9) — спешните вече не се уголемяват
const EMERG = {
  Police_Sedan: [['pol-charger', 5.1], ['pol-crownvic', 5.4], ['pol-interceptor', 5.3], ['pol-volga', 4.8], ['pol-nypd', 5.1]],
  Firetruck: [['fire-red', 9], ['fire-us', 10], ['fire-man', 10.5]],
  Ambulance: [['amb-gaz', RS ? 6.2 : 7], ['amb-us', 7.5], ['amb-eu', 7.2]],
};
// почиства модел на кола: маха плоските мешове (сянка/земя под колата — от тях amb-eu беше квадрат 5,8×5,8 и наполовина висок);
// връща завъртането, ако колата лежи по x (дължината трябва да е по z)
function tidyCar(sc) {
  sc.updateMatrixWorld(true); const all = new THREE.Box3().setFromObject(sc), S = all.getSize(new THREE.Vector3()), big = Math.max(S.x, S.y, S.z), drop = [];
  sc.traverse(m => { if (m.isMesh) { const b = new THREE.Box3().setFromObject(m), s = b.getSize(new THREE.Vector3()); if (s.y < big * 0.01 && Math.max(s.x, s.z) > big * 0.5) drop.push(m); } });
  for (const m of drop) m.parent.remove(m);
  sc.updateMatrixWorld(true); const s2 = new THREE.Box3().setFromObject(sc).getSize(new THREE.Vector3());
  return s2.x > s2.z * 1.15 ? [Math.PI / 2, s2.x] : [0, s2.z];   // [завъртане, дължина]
}
// спешна кола за оперативните карти (ops3d.js, opskit.js): копие на модела, почистено и обърнато като в играта, дължина len (м),
// светлинната лента/бурканите (kind: police | fire | ambulance); светят, докато car.userData.beaconsOn е истина (сирените — от картата)
// модели с предница към −Z (вървят на заден ход, ако не се обърнат)
export const CAR_FLIP = new Set(['amb-eu']);
export function emergCar(src, len, kind = 'police', name = '') { const sc0 = src.clone(true); sc0.traverse(m => { if (m.isMesh) m.castShadow = false; }); const [yaw, L0] = tidyCar(sc0), sc = wrap(sc0, yaw + (CAR_FLIP.has(name) ? Math.PI : 0), len / L0); addBeacons(sc, len, kind); sc.userData.noSiren = 1; return sc; }
export function loadPoliceCars(load, A) {
  return Promise.all(Object.entries(EMERG).map(([nm, opts]) => {
    const ok = opts.filter(([f]) => feature(f)); if (!ok.length) return null;
    return Promise.all(ok.map(([f, len]) => load('assets/heavy/cars/' + (feature('sirens-real') ? 'sirens/' : '') + f + '.glb').then(g => { g.scene.traverse(m => { if (m.isMesh) m.castShadow = false; }); const [yaw, L0] = tidyCar(g.scene), K = EMERG_K[nm] * len * M_PER, sc = wrap(g.scene, yaw + (CAR_FLIP.has(f) ? Math.PI : 0), K / L0); /* мащабът е във вътрешната група — model() пипа само външния */ addBeacons(sc, K, nm === 'Firetruck' ? 'fire' : nm === 'Ambulance' ? 'ambulance' : 'police'); return sc; }).catch(() => null)))
      .then(list => { list = list.filter(Boolean); if (list.length) A['sf-car-' + nm] = { scene: list[0], variants: list }; });
  }));
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
// стоповете при спиране (и денем) и мигачите — общи материали; traffic.js сменя материала на стоповете и пали мигачите
export const lampMats = (() => { let m = null; return () => m || (m = (() => {
  const t = truckLamps().front.emissiveMap, mk = (col, k) => new THREE.MeshStandardMaterial({ color: 0, emissive: col, emissiveMap: t, emissiveIntensity: k, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  return { brake: mk(0xff1a1a, 2.2), blink: mk(0xffa21a, 2.4) };
})()); })();
export function addTruckLamps(o, len, w = 2.4, y = 1.1, rearZ = null) {
  const L = truckLamps(), B = lampMats();
  for (const sx of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), L.front); f.position.set(sx * w * 0.36, y, len / 2 + 0.05); f.userData.lamp = 'front'; o.add(f);
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), L.rear); r.rotation.y = Math.PI; r.position.set(sx * w * 0.42, y, (rearZ ?? -len / 2) - 0.05); r.userData.lamp = 'rear'; o.add(r);
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
export function addCarLights(sc) {
  if (!feature('car-lights')) return;
  sc.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(sc), s = b.getSize(new THREE.Vector3()), len = s.z;
  const g = new THREE.Group(); g.position.z = (b.min.z + b.max.z) / 2; sc.add(g);
  addTruckLamps(g, len, s.x, s.y * 0.42);
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(s.x * 2.2, len * 2.2), carBeam()); pl.rotation.x = -Math.PI / 2; pl.position.set(0, 0.06, len / 2 + len * 1.1); pl.renderOrder = 2; g.add(pl);
}
function loadRealTrucks(load, A) {
  return Promise.all(TRK.map((f, i) => load('assets/heavy/trucks/' + f + '.glb').then(g => {
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
    A['sf-semi-' + i] = { scene: semi };
  }).catch(e => console.warn('real truck', f, e))));
}

// сирена: когато бурканите светнат на кола близо до камерата — веднъж на включване, не по-често от 14 s за всички
// няколко записа на вид (Pixabay, CREDITS-pixabay.txt) — всяка кола си избира един и го пази
const SIREN = { police: ['', '-2', '-3', '-4', '-5'].map(k => `assets/sfx/siren-police${k}.mp3`), fire: ['', '-2', '-3', '-4'].map(k => `assets/sfx/siren-fire${k}.mp3`), ambulance: ['assets/sfx/siren-ambulance.mp3'] };
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
const beaconState = (car, t) => car.userData.forceBeacons || car.userData.beaconsOn || Math.sin(t / 20 * Math.PI * 2 + (car.id * 2.39) % 6.28) > 0.1;
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
  onBeforeRender(renderer, scene, camera) { super.onBeforeRender(renderer, scene, camera); const car = carOf(this); if (car) this.material.emissiveIntensity = barLit(car, this.userData.side, this.userData.j, performance.now() / 1000) ? 2.6 : 0.08; }
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
    for (const m of ms) { const mat = BEACON[side ? 'b' : 'r'].clone(); mat.emissive.setHex(col); mat.color.setHex(col).multiplyScalar(0.25); mat.transparent = true; mat.opacity = 0.9;
      const sg = new BarSeg(m.geometry, mat); sg.name = m.name; sg.position.copy(m.position); sg.quaternion.copy(m.quaternion); sg.scale.set(1, 1, 1); sg.castShadow = false;
      sg.userData = { red: false, kind, side, j: 0 }; m.parent.add(sg); m.parent.remove(m); segs.push(sg); } }
  (segs.find(x => x.userData.side === 0) || segs[0]).userData.red = true;   // звукът и sirenKind — от една леща
  car.updateMatrixWorld(true);
  for (const sg of segs) { const g = new BarGlow(new THREE.SpriteMaterial({ map: glowTex, color: cols[sg.userData.side], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    g.position.copy(car.worldToLocal(sg.getWorldPosition(new THREE.Vector3()))); g.position.y += W * 0.04; g.renderOrder = 2; g.scale.setScalar(W * 0.9); g.userData.side = sg.userData.side; car.add(g); }
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
function addBeacons(car, len, kind = 'police') {
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
