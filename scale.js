// scale.js — една истинска мярка за всички 3D модели: 1 единица = 1 м (Лабораторията → real-scale).
// Каталог: за всеки модел — категория и по какво се мащабира: превозните средства — по дължина, хората — по ръст,
// сградите — по височината до стряхата (етажи × височина на етаж), без покрива, комините и антените. Мащабът е еднакъв по трите оси.
//   import { SCALE, scaleFor, measure } from './scale.js';
//   const k = scaleFor('car-renegade', gltf.scene); obj.scale.setScalar(k);
// measure(obj) → { w, d, h, len, eave } в единиците на модела (len — по-дългата хоризонтална страна; eave — височината до стряхата)
import * as THREE from 'three';

export const STOREY = 3, GROUND = 3.6;   // м: етаж; партер на търговска сграда
// by: 'len' — дължина (м), 'h' — височина до най-горната точка (м), 'eave' — до стряхата (м; покривът е отгоре)
export const SCALE = {
  // хора
  'ped-adam': { cat: 'person', by: 'h', m: 1.75, f: 'assets/heavy/people/peds/ped-adam.glb' },
  // превозни средства
  'car-polo': { cat: 'car', by: 'len', m: 4.5, f: 'assets/heavy/cars/car-polo.glb' },
  'car-renegade': { cat: 'jeep', by: 'len', m: 4.25, f: 'assets/heavy/cars/car-renegade.glb' },
  'gear-dump': { cat: 'dumptruck', by: 'len', m: 8, f: 'assets/heavy/gear/dump.glb', note: 'самосвал 8 × 2,5 × 3,3 м' },
  'van-sprinter': { cat: 'van', by: 'len', m: 5.9, f: 'assets/heavy/vans/van-sprinter.glb', note: 'бусът на бригадата 5,9 × 2,0 × 2,5 м' },
  'bus-citaro': { cat: 'bus', by: 'len', m: 12, f: 'assets/heavy/cars/bus-citaro.glb' },
  'trk-scania': { cat: 'tractor-unit', by: 'len', m: 6, f: 'assets/heavy/trucks/scania-r.glb', note: 'влекач 6 м + ремарке 13,6 м − 3,1 м застъпване = 16,5 м' },
  // сгради: eave — етажи × 3 м (+ цокъл 0,3 м)
  'h2-lodge': { cat: 'house', by: 'eave', m: 1 * STOREY + 0.3, floors: 1, f: 'assets/heavy/houses2/h2-lodge.glb' },
  'h2-townhouse': { cat: 'house', by: 'eave', m: 3 * STOREY + 0.3, floors: 3, f: 'assets/heavy/houses2/h2-townhouse.glb' },
};
export const TRAILER = 13.6, SEMI = 16.5;

// размери в собствените единици на модела (след матриците на възлите); eave — най-високият „пълен“ хоризонтален срез:
// срезовете по височина; стената покрива ≥ 85 % от основата по двете оси, покривът се стеснява (комините и антените са тесни — не се броят)
export function measure(obj) {
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj), s = b.getSize(new THREE.Vector3()), N = 40, sx = new Float32Array(N * 2).fill(Infinity), sz = new Float32Array(N * 2).fill(Infinity);
  for (let i = 0; i < N; i++) { sx[i * 2 + 1] = sz[i * 2 + 1] = -Infinity; }
  const v = new THREE.Vector3();
  obj.traverse(o => { if (!o.isMesh || !o.geometry.attributes.position) return; const p = o.geometry.attributes.position, step = Math.max(1, Math.floor(p.count / 20000));
    for (let i = 0; i < p.count; i += step) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); const k = Math.min(N - 1, Math.max(0, Math.floor((v.y - b.min.y) / (s.y || 1) * N)));
      if (v.x < sx[k * 2]) sx[k * 2] = v.x; if (v.x > sx[k * 2 + 1]) sx[k * 2 + 1] = v.x; if (v.z < sz[k * 2]) sz[k * 2] = v.z; if (v.z > sz[k * 2 + 1]) sz[k * 2 + 1] = v.z; } });
  let eave = s.y;
  for (let k = N - 1; k >= 0; k--) { const wx = sx[k * 2 + 1] - sx[k * 2], wz = sz[k * 2 + 1] - sz[k * 2]; if (wx >= s.x * 0.85 && wz >= s.z * 0.85) { eave = (k + 1) / N * s.y; break; } }
  return { w: s.x, d: s.z, h: s.y, len: Math.max(s.x, s.z), eave, box: b };
}
// еднаквият мащаб (по трите оси) за модела key от каталога
export function scaleFor(key, obj, m = null) {
  const c = SCALE[key]; if (!c) return 1; const q = measure(obj), val = c.by === 'len' ? q.len : c.by === 'eave' ? q.eave : q.h;
  return (m ?? c.m) / (val || 1);
}

// ---- машините и обзавеждането на строежите (истински размери; моделите от vehmodels.js са с дължина 1, на construct.js — в кутията на детските)
// by: 'len' — по дължина, 'h' — по височина (валякът: моделът е висок — по дължина излиза 4,3 м висок); spec — за таблицата в Лабораторията
export const SITE = {
  'sf-mcrane': { by: 'len', m: 13.5, nm: 'автокран (5 оси)', spec: '13,5–15 × 3,0 × 4,0' },
  'sf-excavator': { by: 'len', m: 9.6, nm: 'багер 20 т (със стрелата)', spec: '9,5–10 × 2,8 × 3,0' },
  'sf-dump': { by: 'len', m: 8, nm: 'самосвал', spec: '8 × 2,5 × 3,3' },
  'sf-grader': { by: 'len', m: 8.5, nm: 'грейдер', spec: '8,5 × 2,5 × 3,3' },
  'sf-backhoe': { by: 'len', m: 5.9, nm: 'трактор-багер (JCB 3CX)', spec: '5,6–5,9 × 2,35 × 2,9' },   /* новият модел — със сгънатото рамо (55) */   // по височината до кабината: дължината на модела е с изпънатото задно рамо
  'sf-roller': { by: 'h', m: 3.0, nm: 'валяк', spec: '4,5–5 × 2,2 × 3,0' },
  'container-office-green': { by: 'len', m: 6.06, nm: 'фургон (20 ft)', spec: '6,06 × 2,44 × 2,6' },
  'toilet-portable': { by: 'h', m: 2.3, nm: 'тоалетна', spec: '1,1 × 1,2 × 2,3' },
  'container-rubble-red': { by: 'len', m: 4.0, nm: 'контейнер за отпадъци', spec: '4,0 × 1,8 × 1,5' },
};
// множителят за model(name, k) в играта: от измерените размери на заредения модел (A[name]) до целта
export function siteK(A, name) {
  const c = SITE[name], o = A[name] && (A[name].scene || A[name]); if (!c || !o) return 1;
  const b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3()), v = c.by === 'h' ? s.y : Math.max(s.x, s.z);
  return c.m / (v || 1);
}

// ---- превозните средства: истинските размери [дължина, ширина, височина] м — за проверката в Лабораторията (lab/vehicles.html)
export const VEH_SPEC = {
  'car-polo': [4.05, 1.75, 1.46, 'VW Polo'], 'car-p206': [3.84, 1.67, 1.43, 'Peugeot 206'], 'car-renegade': [4.24, 1.81, 1.69, 'Jeep Renegade'], 'car-hilux': [5.33, 1.86, 1.82, 'Toyota Hilux'],
  'car-taxi': [5.0, 1.85, 1.5, 'такси'], 'car-accord': [4.9, 1.86, 1.45, 'Honda Accord'], 'car-corolla': [4.63, 1.78, 1.44, 'Toyota Corolla'],
  'bus-citaro': [12.0, 2.55, 3.1, 'Mercedes Citaro'], 'car-limo': [7.6, 2.0, 1.5, 'лимузина'], 'car-polsuv': [5.05, 2.0, 1.78, 'полицейски джип'], 'car-truck': [6.5, 2.3, 3.0, 'камион с фургон'],
  'pol-charger': [5.08, 1.9, 1.48, 'Dodge Charger'], 'pol-crownvic': [5.39, 1.98, 1.47, 'Crown Victoria'], 'pol-interceptor': [5.05, 2.0, 1.78, 'Police Interceptor'], 'pol-nypd': [5.08, 1.9, 1.48, 'Charger NYPD'],
  'fire-us': [10.0, 2.5, 3.0, 'пожарна (САЩ)'], 'fire-us2': [10.0, 2.5, 3.0, 'пожарна (САЩ, помпена)'], 'pol-vaz': [4.07, 1.61, 1.44, 'ВАЗ 2101 на КАТ'], 'fire-man': [10.5, 2.5, 3.4, 'MAN със стълба'],
  'amb-gaz': [6.2, 2.1, 2.6, 'ГАЗела'], 'amb-us': [7.0, 2.4, 2.9, 'линейка (САЩ)'], 'amb-eu': [6.9, 2.1, 2.9, 'линейка (Европа)'],
  'van-sprinter': [5.9, 2.0, 2.5, 'Sprinter'], 'van-ducato': [5.4, 2.05, 2.5, 'Ducato'], 'van-mb207': [5.3, 2.0, 2.5, 'Mercedes 207'], 'van-transit': [5.2, 1.97, 2.3, 'Transit'],
  // cars-more (55): още градски коли — нормализирани в Blender (предница +z, колела на 0, истинска дължина), assets/heavy/cars/cv-*.glb
  'cv-golf2': [3.99, 1.67, 1.41, 'VW Golf II'], 'cv-clio2': [3.81, 1.64, 1.42, 'Renault Clio 2'], 'cv-corsab': [3.73, 1.61, 1.42, 'Opel Corsa B'], 'cv-octavia': [4.69, 1.83, 1.46, 'Škoda Octavia'],
  'cv-felicia': [3.86, 1.64, 1.42, 'Škoda Felicia'], 'cv-logan': [4.36, 1.73, 1.52, 'Dacia Logan'], 'cv-duster': [4.34, 1.8, 1.69, 'Dacia Duster'], 'cv-tesla3': [4.69, 1.85, 1.44, 'Tesla Model 3 (EV)'],
  'cv-wagon': [5.0, 1.85, 1.39, 'комби (80-те, САЩ)'], 'cv-sienna': [5.08, 1.98, 1.75, 'Toyota Sienna (миниван)'], 'cv-wrangler': [4.22, 1.87, 1.83, 'Jeep Wrangler'], 'cv-f150': [5.89, 2.03, 1.96, 'Ford F-150 (пикап)'],
  'cv-kenworth': [8.5, 2.6, 3.9, 'Kenworth W900 (влекач, САЩ)'], 'cv-lada2107': [4.13, 1.62, 1.44, 'Лада 2107'], 'cv-vaz2104': [4.12, 1.62, 1.44, 'ВАЗ 2104 (комби)'], 'cv-niva': [3.74, 1.68, 1.64, 'Лада Нива'],
  'cv-moskvich': [4.35, 1.69, 1.4, 'Москвич 2141'], 'cv-uaz': [4.03, 1.79, 2.05, 'УАЗ 469'],
  'bus-artic': [18.1, 2.55, 3.1, 'Volvo B340M — съчленен (хармоника)'], 'bus-roaz': [12.0, 2.55, 3.0, 'РоАЗ-5236'], 'bus-trolley': [12.0, 2.5, 3.4, 'тролейбус ЗиУ-682 (без щангите)'], 'bus-xd40': [12.2, 2.6, 3.3, 'New Flyer XD40 (САЩ)'],
  'trk-semi': [16.5, 2.55, 4.0, 'влекач + полуремарке'], 'trk-cab': [6.0, 2.5, 3.9, 'влекач (кабина)'],
  'sf-mcrane': [13.5, 3.0, 4.0, 'автокран'], 'sf-excavator': [9.6, 2.9, 3.1, 'багер 20 т'], 'sf-dump': [8.0, 2.5, 3.3, 'самосвал'], 'sf-grader': [8.5, 2.5, 3.3, 'грейдер'], 'sf-backhoe': [5.9, 2.35, 2.9, 'трактор-багер JCB 3CX'], 'sf-roller': [4.5, 2.2, 3.0, 'валяк'],
};

// ---- детските коли (Kenney, assets/vehicles) — резервите, докато истинските не са заредени: [собствена дължина, истинска дължина] м
export const KID_LEN = {
  sedan: [2.55, 4.5], 'sedan-sports': [2.55, 4.5], suv: [2.55, 4.7], 'suv-luxury': [2.85, 5.0], 'hatchback-sports': [2.85, 4.2], taxi: [2.75, 4.8], van: [2.75, 5.0],
  police: [2.9, 4.9], truck: [2.95, 8.0], 'truck-flat': [2.745, 8.0], tractor: [1.98, 5.0], 'tractor-shovel': [2.0, 7.0],
};
// множителят за model(name, k): детската кола в истинския ѝ размер (иначе d)
export const kidK = (n, d = 1) => KID_LEN[n] ? KID_LEN[n][1] / KID_LEN[n][0] : d;

// ---- сградите в играта (real-scale): цялата височина с покрива, м — една еднаква мярка по трите оси; къщите по етажите
// (1 етаж ≈ 3 м до стряхата + покрив), така че едноетажната е по-ниска от триетажната. Тук са изброени тези, на които етажите се виждат по модела.
export const REAL_BLD = {
  'h2-lodge': 3.5, 'h2-brickcabin': 6.0, 'h2-pink': 5.3, 'h2-swedish': 6.5, 'building-type-b': 5.5,   // едноетажни (с таван)
  'h2-greyporch': 8.5, 'h2-blue': 9.5, 'h2-porch': 8.5, 'building-type-a': 8.0,                           // двуетажни
  'h2-townhouse': 12.0,                                                                                     // триетажна
  'building-a': 6.2, 'building-e': 6.0, 'building-f': 7.0, 'building-b': 11.5, 'building-c': 15.0, 'building-d': 16.5,   // магазини/офиси: 2, 2, 2, 4, 5, 5–6 етажа
};
// сгради, които в истински размер не се побират на парцел 16 м (дълги редови сгради) — не се избират при real-scale
export const TOO_LONG = new Set(['building-g', 'building-h']);
// еднаквият мащаб: височината H (от REAL_BLD или дадена), но не по-широка от maxW (тогава — по ширината; никога разтягане само по една ос)
export function realScaleK(n, size, maxW, H = null) {
  const h = H ?? REAL_BLD[n]; if (!h) return null; const len = Math.max(size.x, size.z);
  return Math.min(h / Math.max(0.01, size.y), maxW / Math.max(0.01, len));
}

// ---- панелните блокове в секции (real-sizes, задачи №9/№12; blkcut.js): цялата височина H (м) и дългата ос на модела;
// cuts — секциите: частта от дължината по axis, която се запазва и огледа (0,2 → ~0,4 от целия блок; < 0 — от другия край),
// или [[ос, част], …] — няколко рязания. В парцела влиза най-голямата секция, която се побира при истинската височина;
// не се побере ли и последната — тя, смалена (както досега).
// panel12: 12 етажа, моделът е в метри (54 × 11 × 40 м с машинните помещения) → 39 / 22 / 14 м; soviet: 6 етажа, 26 × 11 м → 18 / 14 м;
// richmond: 3 етажа над цокъла, 24 × 23 × 12 м (в см) → крилото без портика, 14 × 14 м.
export const SECTIONS = {
  'sf-blk-panel12': { H: 40, axis: 'x', cuts: [0.36, 0.2, 0.13] },
  'sf-blk-soviet': { H: 19, axis: 'z', cuts: [0.35, 0.27] },
  'sf-blk-richmond': { H: 12.5, axis: 'x', cuts: [[['x', -0.3], ['z', -0.31]]] },
  'b2-office2': { H: 25, axis: 'x', cuts: [[['x', 0.18], ['z', -0.36]], [['x', 0.11], ['z', -0.22]]] },   // №46: П-образният неокласически офис 65 × 33 × 25 м (~7 етажа, в см) → 23 × 24 или 14 × 15 м (лицето към улицата, ъгълът със стъклото)
  // №8 (55): офисът в общия парцел (нива 4–10) — секция, която влиза в парцела в истинската височина (беше смален до ~13 м ширина → 8–11 м висок)
  ...Object.fromEntries([4, 5, 6, 7, 8, 9, 10].map(l => ['office2-l' + l, { H: 0, axis: 'x', cuts: [[['x', 0.33], ['z', -0.33]], [['x', 0.25], ['z', -0.25]], [['x', 0.17], ['z', -0.17]]] }])),
  'b2-office5': { H: 20, axis: 'x', cuts: [[['x', 0.36], ['z', -0.36]], [['x', 0.27], ['z', -0.27]]] },   // №9: сивият 5-етажен офис с паркинг 32 × 31 × 24 м (см) → 19 или 15 м отпред
  'office2-l1': { H: 2.95, axis: 'x', cuts: [-0.25, -0.12] },   // офисът на ниво 1: Г-образен комплекс 25 × 7,6 × 2,95 м; дясното крило е само един ред контейнери → 12,5 или 6 м × ~3,8 м; не се смалява от campusFit
};
export const sectName = (n, i) => `${n}-s${i + 1}`;
// size(name) → Vector3 на модела; връща [името, k] — избраната секция и еднаквият мащаб
export function pickSection(n, size, maxW) {
  const S = SECTIONS[n]; if (!S) return null; const h = size(n).y, k = S.H / Math.max(0.01, h);
  const all = [n, ...S.cuts.map((f, i) => sectName(n, i))].map(v => { try { const s = size(v); return s ? [v, Math.max(s.x, s.z)] : null; } catch (e) { return null; } }).filter(Boolean);
  for (const [v, len] of all) if (len * k <= maxW) return [v, k];
  const [v, len] = all.at(-1); return [v, Math.min(k, maxW / Math.max(0.01, len))];
}
