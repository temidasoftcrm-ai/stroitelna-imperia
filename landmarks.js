// landmarks.js — разпознаваеми сгради за конкретни градове (процедурни, в нисколигонния стил на Kenney).
// Истанбул: джамия с купол и минарета, Галатската кула и модерни кули като в Левент (Сапфир, извита кула, двойни кули).
// game.js ги слага на парцели в центъра на града (вместо обикновени небостъргачи); всяка сграда се побира в ~15×15.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepNightFloors } from './nightfloors.js';
import { feature } from './lab/feature.js';

export const CITY_LANDMARKS = {
  istanbul: ['hagia', 'galata', 'sapphire', 'twist', 'twin', 'mosque2'],
  budapest: ['ststephen'],
  philadelphia: ['cityhall'],
  rome: ['colosseo', 'stpeter', 'pantheon', 'vittoriano'],
  barcelona: ['sagrada'],
  paris: ['eiffel', 'arc', 'notredame', 'ladefense'],
  london: ['bigben', 'londoneye', 'towerbridge', 'shard'],
  berlin: ['brandenburg', 'fernsehturm', 'reichstag'],
  rotterdam: ['erasmus', 'cubes', 'markthal', 'derotterdam', 'euromast'],
  amsterdam: ['canal', 'rijks', 'centraal', 'adam', 'windmill', 'canal2'],
  // истински модели от Sketchfab (GLB_LM по-долу)
  cairo: ['pyramids'], giza: ['pyramids'],
  dubai: ['burj'], newyork: ['manhattan'], kualalumpur: ['petronas'], moscow: ['stbasil'], toronto: ['cntower'], chicago: ['willis'], shanghai: ['shtower'], rio: ['redeemer'], washington: ['whitehouse'], lasvegas: ['bellagio', 'vegassign'],
};
// забележителности в морето пред града (game.js: refreshLandmarks, само при крайморските градове)
export const SEA_LANDMARKS = { newyork: ['liberty'], sydney: ['opera'] };   // Сидни: операта на нос в залива (не на площада в центъра)
// големите забележителности в отделна зона W×D парцела встрани от центъра (game.js: refreshMines3D → bigLandmarks)
export const BIG_LANDMARKS = { moscow: [['mgu', 4, 2, 0.52]], lasvegas: [['luxor', 2, 2]], istanbul: [['mosque', 3, 2, 0.59, 1]], washington: [['capitol', 3, 3, 1, 0, [3, 2]]] };   // [вид, W, D, дълбочина/ширина на модела, завъртян на 90° (дългата страна на модела е по z), [W, D] ако няма място (малък град) — щом градът порасне, се мести в голямата]
export const LANDMARK_NM = { parliament: 'Парламентът на Унгария', duomo: 'Миланската катедрала (Дуомо)', romanstadium: 'Античният стадион', nevsky: 'Храм-паметник „Св. Александър Невски“', liberty2: 'Статуята на свободата', arc2: 'Триумфалната арка', kotel: 'Котелническа висотка', suleymaniye2: 'Сюлеймание', bluemosque: 'Синята джамия', topkapi: 'Топкапъ', maiden: 'Момината кула', grandbazaar: 'Гранд базар', haydarpasa: 'Гара Хайдарпаша', bigben2: 'Биг Бен', londoneye2: 'Лондонското око', whitehouse: 'Белият дом', capitol: 'Капитолият', vegassign: '„Welcome to Fabulous Las Vegas“', bellagio: 'Беладжо', luxor: 'Луксор', cityhall: 'Кметството на Филаделфия', ststephen: 'Базилика „Св. Стефан“', mgu: 'Московският университет (МГУ)', pyramids: 'Пирамидите в Гиза', burj: 'Бурж Халифа', manhattan: 'Манхатън', liberty: 'Статуята на свободата', opera: 'Операта в Сидни', stbasil: 'Храмът „Св. Василий Блажени“', cntower: 'Си Ен Тауър', willis: 'Уилис Тауър', shtower: 'Шанхайската кула', redeemer: 'Христос Спасителя', mosque: 'Синята джамия', mosque2: 'Сюлейманийе', galata: 'Галатска кула', sapphire: 'Истанбул Сапфир', twist: 'Левент Туист', twin: 'Левент Туинс', colosseum: 'Колизеума', hagia: 'Света София', colosseo: 'Колизеума', sagrada: 'Саграда Фамилия', vatican: 'Ватикана и „Св. Петър“', stpeter: 'Базилика „Св. Петър“', pantheon: 'Пантеона', vittoriano: 'Витториано', erasmus: 'Мостът Еразъм', cubes: 'Кубичните къщи', markthal: 'Маркетхал', derotterdam: 'Де Ротердам', euromast: 'Евромаст', canal: 'Канал с къщи', canal2: 'Канал с къщи', rijks: 'Райксмузеум', centraal: 'Централна гара', adam: 'A’DAM Лукаут', windmill: 'Вятърна мелница', eiffel: 'Айфеловата кула', arc: 'Триумфалната арка', notredame: 'Нотр Дам', ladefense: 'Ла Дефанс', bigben: 'Биг Бен', londoneye: 'Лондонското око', towerbridge: 'Тауър Бридж', shard: 'Шард', brandenburg: 'Бранденбургската врата', fernsehturm: 'Телевизионната кула', reichstag: 'Райхстагът' };
// кои стоят в центъра на града (останалите — в стария град извън центъра)
export const LANDMARK_CENTER = new Set(['pyramids', 'burj', 'manhattan', 'cntower', 'willis', 'shtower', 'eiffel', 'arc', 'bigben', 'shard', 'brandenburg', 'reichstag', 'ladefense', 'sapphire', 'twist', 'twin', 'colosseum', 'colosseo', 'vatican', 'vittoriano', 'derotterdam', 'markthal', 'cubes', 'canal', 'rijks', 'centraal']);
// 🇬🇧 Лондон с истински модели (feature 'london-real'): Биг Бен и London Eye от Poly Pizza вместо процедурните
if (feature('lm-vittoriano')) { CITY_LANDMARKS.rome = CITY_LANDMARKS.rome.map(k => k === 'vittoriano' ? 'vittoriano2' : k); LANDMARK_NM.vittoriano2 = LANDMARK_NM.vittoriano || 'Витториано'; if (LANDMARK_CENTER.has('vittoriano')) LANDMARK_CENTER.add('vittoriano2'); }   // процедурният остава, ако флагът е изключен
if (feature('lm-colosseum2')) { CITY_LANDMARKS.rome = CITY_LANDMARKS.rome.map(k => k === 'colosseo' || k === 'colosseo3' ? 'colosseo4' : k); LANDMARK_NM.colosseo4 = LANDMARK_NM.colosseo || 'Колизеумът'; LANDMARK_CENTER.add('colosseo4'); }   // lm-colosseum2 (f6): новият Колизеум на Темидасофт (Meshy AI) — цял модел, овал 189 × 156 м
else if (feature('lm-colosseo3')) { CITY_LANDMARKS.rome = CITY_LANDMARKS.rome.map(k => k === 'colosseo' ? 'colosseo3' : k); LANDMARK_NM.colosseo3 = LANDMARK_NM.colosseo || 'Колизеумът'; LANDMARK_CENTER.add('colosseo3'); }   // Колизеумът, сглобен в Blender от модела на потребителя (Meshy AI) — с нощното осветление (nightfloors.js)
if (feature('london-real')) { CITY_LANDMARKS.london = ['bigben2', 'londoneye2', 'towerbridge', 'shard']; LANDMARK_CENTER.add('bigben2'); }

const mat = (c, r = 0.8, m = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra });
const add = (g, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
const box = (g, w, h, d, m, x, y, z) => add(g, new THREE.BoxGeometry(w, h, d), m, x, y, z);
const cyl = (g, r1, r2, h, m, x, y, z, seg = 16) => add(g, new THREE.CylinderGeometry(r1, r2, h, seg), m, x, y, z);
const dome = (g, r, m, x, y, z, sy = 1) => { const o = add(g, new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m, x, y, z); o.scale.y = sy; return o; };

// текстура с прозорци: map (дневен цвят) + emissiveMap (светнали прозорци нощем); seed прави различни шарки
function windowTex(cols, rows, seed, base = '#5d7f9a', frame = '#c9d6df') {
  const c = document.createElement('canvas'); c.width = cols * 8; c.height = rows * 8;
  const e = document.createElement('canvas'); e.width = c.width; e.height = c.height;
  const x = c.getContext('2d'), y = e.getContext('2d');
  x.fillStyle = frame; x.fillRect(0, 0, c.width, c.height); y.fillStyle = '#000'; y.fillRect(0, 0, e.width, e.height);
  let s = seed * 9301 + 49297;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    x.fillStyle = base; x.fillRect(i * 8 + 1, j * 8 + 1, 6, 6);
    if (rnd() < 0.45) { y.fillStyle = rnd() < 0.7 ? '#ffd890' : '#cfe6ff'; y.fillRect(i * 8 + 1, j * 8 + 1, 6, 6); }
  }
  const t1 = new THREE.CanvasTexture(c), t2 = new THREE.CanvasTexture(e);
  for (const t of [t1, t2]) { t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; }
  return { map: t1, emissiveMap: t2 };
}
const glassMat = (cols, rows, seed, base, frame) => { const t = windowTex(cols, rows, seed, base, frame); return mat(0xffffff, 0.25, 0.35, { map: t.map, emissiveMap: t.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0 }); };

// ---------------------------------------------------------------- джамия (Синята джамия / Сюлейманийе)
function mosque(variant = 0) {
  const g = new THREE.Group(), lit = [];
  const stone = mat(variant ? 0xd8cdb6 : 0xe2dccd, 0.85, 0, { emissive: 0xffd8a0, emissiveIntensity: 0 }), lead = mat(variant ? 0x7a8792 : 0x8a97a4, 0.5, 0.45, { emissive: 0x9fb8ff, emissiveIntensity: 0 }), gold = mat(0xd8b44a, 0.3, 0.8), dark = mat(0x3a3530, 0.7);
  const lamp = mat(0xfff2c0, 0.4, 0, { emissive: 0xffd890, emissiveIntensity: 0 }); lit.push(lamp);
  box(g, 15, 0.3, 15, mat(0xcfc8b8, 0.95), 0, 0.15, 0);          // площад
  box(g, 10, 4.2, 10, stone, 0, 2.4, 0.5);                       // основният обем
  box(g, 10.6, 0.4, 10.6, stone, 0, 4.6, 0.5);
  for (const [x, z] of [[-4.2, -3.7], [4.2, -3.7], [-4.2, 4.7], [4.2, 4.7]]) { cyl(g, 1.1, 1.1, 0.8, stone, x, 5.2, z, 12); dome(g, 1.1, lead, x, 5.6, z); }   // ъглови куполчета
  // полукуполи на 4-те страни и голям централен купол на барабан с прозорци
  for (const [x, z, ry] of [[0, -3.2, 0], [0, 4.2, Math.PI], [-3.7, 0.5, Math.PI / 2], [3.7, 0.5, -Math.PI / 2]]) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(2.3, 16, 8, 0, Math.PI, 0, Math.PI / 2), lead); h.position.set(x, 4.8, z); h.rotation.y = ry; h.castShadow = true; g.add(h);
  }
  cyl(g, 3.3, 3.4, 1.6, stone, 0, 5.6, 0.5, 24);
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; const w = box(g, 0.35, 0.8, 0.08, dark, Math.sin(a) * 3.38, 5.6, 0.5 + Math.cos(a) * 3.38); w.rotation.y = a; }
  dome(g, 3.5, lead, 0, 6.4, 0.5, 0.85);
  cyl(g, 0.05, 0.05, 1.2, gold, 0, 9.9, 0.5, 6);
  const cres = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.07, 6, 16, Math.PI * 1.5), gold); cres.position.set(0, 10.7, 0.5); cres.rotation.z = Math.PI / 4; g.add(cres);
  // минарета: 6 при Синята джамия, 4 при Сюлейманийе
  const mins = variant ? [[-6, -5.5], [6, -5.5], [-6, 6.5], [6, 6.5]] : [[-6, -5.5], [6, -5.5], [-6, 6.5], [6, 6.5], [-6.6, 0.5], [6.6, 0.5]];
  for (const [x, z] of mins) {
    const h = variant ? 16 : 18;
    cyl(g, 0.55, 0.65, 2, stone, x, 1, z, 10);
    cyl(g, 0.38, 0.45, h, stone, x, 2 + h / 2, z, 10);
    for (const b of [0.55, 0.78, 0.94]) { if (variant && b === 0.94) continue; cyl(g, 0.68, 0.6, 0.3, stone, x, 2 + h * b, z, 12); const l = cyl(g, 0.5, 0.5, 0.12, lamp, x, 2.2 + h * b, z, 12); l.castShadow = false; }
    add(g, new THREE.ConeGeometry(0.46, 2.6, 10), lead, x, 2 + h + 1.3, z);
    cyl(g, 0.03, 0.03, 0.8, gold, x, 2 + h + 2.9, z, 4);
  }
  // двор с аркада отпред (откъм +z)
  for (let k = -2; k <= 2; k++) { cyl(g, 0.22, 0.22, 2, stone, k * 1.8, 1.3, 6.8, 8); dome(g, 0.75, lead, k * 1.8, 2.4, 6.8); }
  box(g, 9.4, 0.3, 1.6, stone, 0, 2.35, 6.8);
  g.userData.lit = lit; g.userData.flood = [stone, lead];   // нощем джамиите са осветени с прожектори
  return g;
}

// ---------------------------------------------------------------- Истанбул: Топкапъ, Момината кула, Гранд базар, Хайдарпаша (процедурни)
function topkapi() {   // дворецът: крепостна стена с кули, дворове, ниски павилиони с оловни куполи, кулата на Справедливостта, кухните с комини
  const g = new THREE.Group(), lit = [], wall = mat(0xd9ccb2, 0.9), lead = mat(0x8a97a4, 0.5, 0.45), roof = mat(0x9a6a4a, 0.85), grass = mat(0x7da25a, 0.95), gold = mat(0xd8b44a, 0.3, 0.8);
  box(g, 15, 0.3, 15, grass, 0, 0.15, 0);
  for (const [w, d, x, z] of [[14, 0.5, 0, -7], [14, 0.5, 0, 7], [0.5, 14, -7, 0], [0.5, 14, 7, 0]]) box(g, w, 1.8, d, wall, x, 1.2, z);
  for (const [x, z] of [[-7, -7], [7, -7], [-7, 7], [7, 7], [0, 7]]) { cyl(g, 0.7, 0.8, 2.8, wall, x, 1.7, z, 10); add(g, new THREE.ConeGeometry(0.85, 1.4, 10), lead, x, 3.8, z); }
  box(g, 0.5, 1.8, 14, wall, -1.5, 1.2, 0); box(g, 0.5, 1.8, 14, wall, 3, 1.2, 0);   // дворовете
  for (const [w, d, x, z] of [[4, 2, -4.5, -4], [3, 3, -4.5, 3], [3, 2, 1, -4.5], [2.5, 2.5, 1, 4], [3, 3, 5, -3], [2.5, 2, 5, 3.5]]) { box(g, w, 1.6, d, wall, x, 1.1, z); add(g, new THREE.ConeGeometry(Math.max(w, d) * 0.72, 0.9, 4), roof, x, 2.35, z).rotation.y = Math.PI / 4; }
  for (const [x, z] of [[-4.5, 3], [5, -3], [1, 4]]) dome(g, 0.8, lead, x, 1.95, z);
  cyl(g, 0.55, 0.6, 5.5, wall, -1.5, 3, -1, 8); add(g, new THREE.ConeGeometry(0.62, 2, 8), lead, -1.5, 6.7, -1); cyl(g, 0.03, 0.03, 0.6, gold, -1.5, 8, -1, 4);   // кулата на Справедливостта
  for (let k = 0; k < 6; k++) cyl(g, 0.28, 0.28, 1.4, wall, 2 + k * 0.7, 2.6, -6.2, 6);   // комините на кухните
  g.userData.lit = lit; g.userData.flood = [wall, lead]; return g;
}
function maiden() {   // Момината кула: островче със стена, сграда и кула с оловен покрив; нощем — светла
  const g = new THREE.Group(), lit = [], stone = mat(0xe4dccb, 0.85, 0, { emissive: 0xffd8a0, emissiveIntensity: 0 }), lead = mat(0x8a97a4, 0.5, 0.45), rock = mat(0x8f8778, 0.95), gold = mat(0xd8b44a, 0.3, 0.8);
  cyl(g, 5.4, 6, 1.2, rock, 0, -0.4, 0, 20); cyl(g, 4.6, 4.8, 1, stone, 0, 0.6, 0, 20);
  box(g, 5, 2.4, 3.4, stone, -0.6, 2.2, 0); add(g, new THREE.ConeGeometry(3.1, 1, 4), lead, -0.6, 3.9, 0).rotation.y = Math.PI / 4;
  cyl(g, 1.2, 1.3, 7, stone, 1.6, 4.5, 0, 12); cyl(g, 1.45, 1.45, 0.4, stone, 1.6, 8.2, 0, 12); cyl(g, 1.05, 1.05, 1.4, mat(0x3a3a3a, 0.5), 1.6, 9.1, 0, 12);
  add(g, new THREE.ConeGeometry(1.3, 2.6, 12), lead, 1.6, 11.1, 0); cyl(g, 0.04, 0.04, 0.8, gold, 1.6, 12.8, 0, 4);
  lit.push(stone); g.userData.lit = lit; g.userData.flood = [stone]; return g;
}
function grandbazaar() {   // Гранд базар: дълги ниски сводести покриви с много малки куполи и входна порта
  const g = new THREE.Group(), wall = mat(0xd6c7a8, 0.9), lead = mat(0x8e98a0, 0.55, 0.35);
  box(g, 15, 0.3, 15, mat(0xcfc8b8, 0.95), 0, 0.15, 0);
  for (let r = -2; r <= 2; r++) { box(g, 13, 1.6, 2, wall, 0, 1.1, r * 2.8); const v = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 13, 10, 1, false, 0, Math.PI), lead); v.rotation.z = Math.PI / 2; v.position.set(0, 1.9, r * 2.8); v.castShadow = true; g.add(v); for (let k = -5; k <= 5; k += 2.5) dome(g, 0.45, lead, k, 2.85, r * 2.8); }
  box(g, 2.6, 3.2, 1, wall, 0, 1.9, 7.3); dome(g, 0.9, lead, 0, 3.5, 7.3);
  g.userData.flood = [wall, lead]; return g;
}
function haydarpasa() {   // гара Хайдарпаша: неоренесансова сграда с две кръгли кули с конусни покриви, на кея
  const g = new THREE.Group(), stone = mat(0xb9a07a, 0.85, 0, { emissive: 0xffd8a0, emissiveIntensity: 0 }), roof = mat(0x4f5a62, 0.6, 0.3), win = mat(0x3a3530, 0.6);
  box(g, 15, 0.3, 15, mat(0xcfc8b8, 0.95), 0, 0.15, 0);
  box(g, 12, 6, 5, stone, 0, 3.3, 0); box(g, 12.4, 0.5, 5.4, stone, 0, 6.5, 0); add(g, new THREE.ConeGeometry(4.4, 2.2, 4), roof, 0, 7.8, 0).scale.set(1.9, 1, 0.8);
  for (let k = -5; k <= 5; k += 1.25) for (const y of [2, 4.2]) box(g, 0.5, 1.1, 0.1, win, k, y, 2.53);
  for (const x of [-6, 6]) { cyl(g, 1.5, 1.5, 8, stone, x, 4.3, 0, 14); add(g, new THREE.ConeGeometry(1.7, 3.2, 14), roof, x, 9.9, 0); }
  g.userData.lit = [stone]; g.userData.flood = [stone]; return g;
}

// ---------------------------------------------------------------- Галатска кула
function galata() {
  const g = new THREE.Group(), lit = [];
  const stone = mat(0xc9b79a, 0.9), stone2 = mat(0xb5a385, 0.9), roof = mat(0x5d6b7a, 0.5, 0.35), dark = mat(0x2f2a25, 0.7), gold = mat(0xd8b44a, 0.3, 0.8);
  const lamp = mat(0x3a3020, 0.5, 0, { emissive: 0xffc870, emissiveIntensity: 0 }); lit.push(lamp);
  box(g, 14, 0.3, 14, mat(0xcfc8b8, 0.95), 0, 0.15, 0);
  cyl(g, 3.6, 3.9, 3, stone2, 0, 1.8, 0, 24);
  cyl(g, 3.1, 3.5, 20, stone, 0, 13.3, 0, 24);
  for (let r = 0; r < 5; r++) for (let k = 0; k < 6; k++) { const a = (k + r * 0.5) / 6 * Math.PI * 2, y = 6 + r * 3.6, rr = 3.5 - (y - 3.3) / 20 * 0.4; const w = box(g, 0.4, 1, 0.1, dark, Math.sin(a) * rr, y, Math.cos(a) * rr); w.rotation.y = a; }
  // галерия: светещ пояс с арки и парапет
  cyl(g, 3.5, 3.2, 0.5, stone2, 0, 23.5, 0, 24);
  const band = cyl(g, 3.05, 3.05, 2.2, lamp, 0, 24.9, 0, 24); band.castShadow = false;
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; cyl(g, 0.16, 0.16, 2.2, stone, Math.sin(a) * 3.2, 24.9, Math.cos(a) * 3.2, 6); }
  cyl(g, 3.6, 3.6, 0.5, stone2, 0, 26.2, 0, 24);
  add(g, new THREE.ConeGeometry(3.7, 8.5, 24), roof, 0, 30.7, 0);
  cyl(g, 0.06, 0.06, 1.6, gold, 0, 35.6, 0, 6);
  add(g, new THREE.SphereGeometry(0.25, 8, 6), gold, 0, 36.5, 0);
  // ниски къщи около кулата (стария квартал)
  for (const [x, z, h, c] of [[-5.5, 5, 3, 0xd9b38c], [5.2, 5.4, 3.6, 0xc98a6b], [-5.6, -5, 2.8, 0xe2c79f], [5.5, -4.6, 3.2, 0xb7a08a]]) { box(g, 3, h, 3, mat(c, 0.9), x, h / 2 + 0.3, z); add(g, new THREE.ConeGeometry(2.3, 1.2, 4), mat(0xa2553a, 0.8), x, h + 0.9, z).rotation.y = Math.PI / 4; }
  g.userData.lit = lit;
  return g;
}

// ---------------------------------------------------------------- модерни кули в Левент
function sapphire() {   // най-високата: стъклена призма, скосен връх и шпил
  const g = new THREE.Group(), gl = glassMat(10, 64, 7, '#4f86b5', '#d4e2ec');
  box(g, 14, 0.3, 14, mat(0x9aa0a6, 0.9), 0, 0.15, 0);
  box(g, 12, 6, 12, mat(0x2b3440, 0.4, 0.5), 0, 3.3, 0);   // подиум (мол)
  const H = 92, shape = new THREE.Shape(); shape.moveTo(-4.6, -3.4); shape.lineTo(4.6, -3.4); shape.lineTo(3.4, 3.8); shape.lineTo(-3.4, 3.8); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
  // UV по височина за прозорците
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + pos.getZ(i)) / 9 + 0.5, pos.getY(i) / H);
  const t = add(g, geo, gl, 0, 6.3, 0);
  // скосен връх и шпил
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 4.2, 10, 4), mat(0x9fb7c9, 0.2, 0.7)); cap.position.set(0, 6.3 + H + 5, 0.2); cap.rotation.y = Math.PI / 4; cap.scale.z = 0.8; cap.castShadow = true; g.add(cap);
  cyl(g, 0.15, 0.3, 18, mat(0xdde3e8, 0.3, 0.8), 0, 6.3 + H + 18, 0.2, 8);
  const tip = add(g, new THREE.SphereGeometry(0.4, 8, 6), mat(0xff3030, 0.4, 0, { emissive: 0xff2020, emissiveIntensity: 0 }), 0, 6.3 + H + 27, 0.2);
  g.userData.glass = [gl]; g.userData.blink = [tip.material];
  return g;
}
function twist() {   // извита кула: етажи, всеки завъртян малко повече
  const g = new THREE.Group(), gl = glassMat(8, 4, 3, '#3f9fa6', '#e8f0f0'), slab = mat(0xf2f4f5, 0.6);
  box(g, 14, 0.3, 14, mat(0x9aa0a6, 0.9), 0, 0.15, 0);
  const N = 26, fh = 3;
  for (let k = 0; k < N; k++) {
    const f = new THREE.Group(); f.position.y = 0.3 + k * fh; f.rotation.y = k * 0.055; g.add(f);
    const w = 9.5 - Math.abs(k - N * 0.45) * 0.06;
    box(f, w, fh - 0.45, w * 0.78, gl, 0, (fh - 0.45) / 2, 0).material = gl;
    box(f, w + 0.4, 0.45, w * 0.78 + 0.4, slab, 0, fh - 0.22, 0);
  }
  const crown = new THREE.Group(); crown.position.y = 0.3 + N * fh; crown.rotation.y = N * 0.055; g.add(crown);
  box(crown, 6, 4, 4.6, mat(0xdde3e8, 0.3, 0.7), 0, 2, 0);
  g.userData.glass = [gl];
  return g;
}
function twin() {   // двойни кули със скай-мост
  const g = new THREE.Group(), gl = glassMat(8, 48, 11, '#5d6f86', '#cfd6dd'), gl2 = glassMat(8, 42, 5, '#5d6f86', '#cfd6dd'), steel = mat(0xbfc8d0, 0.3, 0.8);
  box(g, 14, 0.3, 14, mat(0x9aa0a6, 0.9), 0, 0.15, 0);
  box(g, 13, 4, 6, mat(0x2b3440, 0.4, 0.5), 0, 2.3, 0);
  const t1 = box(g, 5, 72, 5, gl, -3.6, 4.3 + 36, 0), t2 = box(g, 5, 62, 5, gl2, 3.6, 4.3 + 31, 0);
  for (const [x, h] of [[-3.6, 72], [3.6, 62]]) {
    box(g, 5.4, 1.2, 5.4, steel, x, 4.3 + h + 0.6, 0);
    add(g, new THREE.ConeGeometry(2.6, 7, 4), steel, x, 4.3 + h + 4.7, 0).rotation.y = Math.PI / 4;
  }
  box(g, 2.4, 3, 3, steel, 0, 44, 0);   // скай-мост
  g.userData.glass = [gl, gl2];
  return g;
}

// ---------------------------------------------------------------- Рим
const TRAV = 0xe3d3b0, TRAV2 = 0xcdb98f;
function colosseum() {   // елипса от 4 етажа арки; едната страна е полусрутена, отвътре — арена
  const g = new THREE.Group(), st = mat(TRAV, 0.9, 0, { emissive: 0xffc070, emissiveIntensity: 0 }), st2 = mat(TRAV2, 0.9, 0, { emissive: 0xffc070, emissiveIntensity: 0 }), dark = mat(0x4a3f33, 0.9), sand = mat(0xd9c08a, 1);
  box(g, 15, 0.3, 15, mat(0xcfc8b8, 0.95), 0, 0.15, 0);
  const RX = 7, RZ = 5.6, N = 40;
  for (let k = 0; k < N; k++) {
    const a = k / N * Math.PI * 2, a2 = (k + 0.5) / N * Math.PI * 2, x = Math.cos(a2) * RX, z = Math.sin(a2) * RZ;
    const ruined = Math.sin(a2) < -0.35 && Math.cos(a2) > -0.2;   // северозападната дъга е по-ниска
    const levels = ruined ? 2 + (k % 2) : 4;
    const seg = 2 * Math.PI * Math.sqrt((RX * RX + RZ * RZ) / 2) / N;
    for (let l = 0; l < levels; l++) {
      const y = 0.3 + l * 1.7, h = l === 3 ? 1.3 : 1.7;
      const pier = box(g, 0.32, h, 0.9, l % 2 ? st2 : st, 0, y + h / 2, 0); pier.position.set(Math.cos(a) * RX, y + h / 2, Math.sin(a) * RZ); pier.rotation.y = -a;
      if (l < 3) { const lin = box(g, seg, 0.32, 0.9, st, x, y + h - 0.16, z); lin.rotation.y = -a2 + Math.PI / 2; const hole = box(g, seg * 0.6, h * 0.6, 0.5, dark, x * 0.97, y + h * 0.4, z * 0.97); hole.rotation.y = -a2 + Math.PI / 2; }
      else { const w = box(g, seg, h, 0.9, st, x, y + h / 2, z); w.rotation.y = -a2 + Math.PI / 2; }
    }
  }
  // трибуни (стъпаловидни елипсовидни пръстени) и арена
  for (let r = 0; r < 4; r++) { const ring = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.6, 40, 1, true), mat(0xbfae8a, 0.95, 0, { side: THREE.DoubleSide })); ring.scale.set(RX - 0.8 - r * 0.9, 1, RZ - 0.8 - r * 0.9); ring.position.y = 3.6 - r * 0.8; g.add(ring); }
  const arena = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.2, 32), sand); arena.scale.set(RX - 4.2, 1, RZ - 4.2); arena.position.y = 0.4; g.add(arena);
  for (let k = 0; k < 6; k++) box(g, (RX - 4.4) * 1.6, 0.25, 0.2, dark, 0, 0.55, -1.8 + k * 0.72);   // подземията (хипогеум)
  g.userData.flood = [st, st2];
  return g;
}
function stpeter() {   // фасада с колонада, голям купол на барабан с колони, площад с полукръгли колонади и обелиск
  const g = new THREE.Group(), st = mat(0xe8dcc0, 0.85, 0, { emissive: 0xffd8a0, emissiveIntensity: 0 }), dome = mat(0x9fb3b8, 0.5, 0.3, { emissive: 0x9fb8ff, emissiveIntensity: 0 }), gold = mat(0xd8b44a, 0.3, 0.8);
  box(g, 15, 0.3, 15, mat(0xd2c8b4, 0.95), 0, 0.15, 0);
  box(g, 9, 6, 6, st, 0, 3.3, -3.5);                           // кораб
  box(g, 10, 7, 1.4, st, 0, 3.8, -0.2);                        // фасада
  for (let k = 0; k < 8; k++) cyl(g, 0.24, 0.26, 5, st, -3.5 + k, 2.8, 0.7, 10);
  box(g, 10.4, 0.6, 1.8, st, 0, 7.4, -0.2);
  for (let k = 0; k < 7; k++) cyl(g, 0.18, 0.18, 0.9, st, -4.5 + k * 1.5, 8.1, 0.4, 8);   // статуи отгоре
  cyl(g, 2.5, 2.5, 2.4, st, 0, 7.5, -4, 24);
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; cyl(g, 0.12, 0.12, 2.2, st, Math.sin(a) * 2.6, 7.5, -4 + Math.cos(a) * 2.6, 6); }
  const d = add(g, new THREE.SphereGeometry(2.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), dome, 0, 8.7, -4); d.scale.y = 1.25;
  cyl(g, 0.45, 0.55, 1.3, st, 0, 12.6, -4, 10); add(g, new THREE.SphereGeometry(0.3, 8, 6), gold, 0, 13.5, -4); box(g, 0.08, 1, 0.08, gold, 0, 14.1, -4); box(g, 0.5, 0.08, 0.08, gold, 0, 14.2, -4);
  for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 1.6, 20, 1, true, sx > 0 ? 0 : Math.PI, Math.PI * 0.75), st); c.position.set(0, 1.1, 4.5); c.rotation.y = sx > 0 ? -Math.PI * 0.12 : Math.PI * 0.12; g.add(c); }
  cyl(g, 0.25, 0.4, 4.5, mat(0xd6c6a2, 0.8), 0, 2.55, 4.5, 4);   // обелиск
  g.userData.flood = [st, dome];
  return g;
}
function pantheon() {   // ротонда с купол и портик с 8 колони и фронтон
  const g = new THREE.Group(), st = mat(0xd6c8a8, 0.9, 0, { emissive: 0xffd8a0, emissiveIntensity: 0 }), lead = mat(0x8c9399, 0.6, 0.3);
  box(g, 15, 0.3, 15, mat(0xcfc8b8, 0.95), 0, 0.15, 0);
  cyl(g, 5, 5, 5, st, 0, 2.8, -1.5, 32); cyl(g, 5.3, 5.3, 0.5, st, 0, 5.3, -1.5, 32);
  for (let r = 0; r < 3; r++) cyl(g, 5 - r * 0.4, 5 - r * 0.3, 0.4, st, 0, 5.8 + r * 0.4, -1.5, 32);
  const d = add(g, new THREE.SphereGeometry(4.6, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), lead, 0, 6.6, -1.5); d.scale.y = 0.62;
  cyl(g, 0.8, 0.8, 0.3, mat(0x2a2522), 0, 9.5, -1.5, 16);   // окулус
  box(g, 7, 4.4, 4, st, 0, 2.5, 4);
  for (let k = 0; k < 8; k++) cyl(g, 0.3, 0.33, 4, mat(0xc9b896, 0.85), -3 + k * 0.86, 2.3, 5.8, 10);
  box(g, 7.6, 0.7, 4.4, st, 0, 4.65, 4.1);
  const tri = new THREE.Shape(); tri.moveTo(-3.8, 0); tri.lineTo(3.8, 0); tri.lineTo(0, 1.6); tri.closePath();
  const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 4.4, bevelEnabled: false }), st); ped.position.set(0, 5, 1.9); ped.castShadow = true; g.add(ped);
  g.userData.flood = [st];
  return g;
}
function vittoriano() {   // бял мраморен „Олтар на отечеството“: стълби, извита колонада, две квадриги
  const g = new THREE.Group(), w = mat(0xf4f1ea, 0.7, 0, { emissive: 0xfff2d8, emissiveIntensity: 0 }), bronze = mat(0x5c6b4e, 0.5, 0.6), gold = mat(0xc9a43a, 0.3, 0.8);
  box(g, 15, 0.3, 15, mat(0xd8d2c4, 0.95), 0, 0.15, 0);
  for (let k = 0; k < 6; k++) box(g, 14 - k * 0.4, 0.5, 12 - k * 1.3, w, 0, 0.55 + k * 0.5, 1.5 - k * 0.65);   // стълби
  box(g, 12, 4, 3.2, w, 0, 5.3, -3.6);
  const col = new THREE.Group(); col.position.set(0, 3.3, -2.2); g.add(col);
  for (let k = 0; k < 16; k++) { const a = -0.9 + k / 15 * 1.8, x = Math.sin(a) * 7, z = -Math.cos(a) * 2 + 2; cyl(col, 0.2, 0.22, 4.2, w, x, 2.1, z, 8); }
  box(g, 13, 0.6, 2.2, w, 0, 7.6, -2.5);
  for (const sx of [-1, 1]) {
    box(g, 2.2, 2.6, 2.4, w, sx * 6.2, 9.2, -2.6);
    const q = new THREE.Group(); q.position.set(sx * 6.2, 10.5, -2.6); g.add(q);
    for (let h = 0; h < 4; h++) box(q, 0.3, 0.9, 1.4, bronze, -0.7 + h * 0.45, 0.6, 0.2);
    box(q, 1.4, 0.6, 0.6, bronze, 0, 0.4, -0.6); const fig = add(q, new THREE.ConeGeometry(0.3, 1.6, 6), bronze, 0, 1.6, -0.6); fig.castShadow = true;
    add(q, new THREE.SphereGeometry(0.2, 6, 4), gold, 0, 2.5, -0.6);
  }
  const statue = new THREE.Group(); statue.position.set(0, 3.6, 2.8); g.add(statue);
  box(statue, 1.6, 1.4, 2.4, w, 0, 0.7, 0); box(statue, 0.6, 1.2, 1.6, bronze, 0, 1.9, 0); add(statue, new THREE.ConeGeometry(0.25, 1, 6), bronze, 0, 2.9, 0.2);
  g.userData.flood = [w];
  return g;
}

// ---------------------------------------------------------------- Нидерландия: общи детайли
const water = () => mat(0x3f7fb0, 0.25, 0.1);
// покрив-призма (двускатен) с било по x: ширина w (по x), височина h, дълбочина d (по z)
function gable(g, w, h, d, m, x, y, z) { const sh = new THREE.Shape(); sh.moveTo(-d / 2, 0); sh.lineTo(d / 2, 0); sh.lineTo(0, h); sh.closePath(); const o = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false }), m); o.rotation.y = Math.PI / 2; o.position.set(x - w / 2, y, z); o.castShadow = true; g.add(o); return o; }
function bikes(g, x, z, n = 5) { const m = mat(0x222222, 0.5, 0.4); for (let k = 0; k < n; k++) { const b = new THREE.Group(); for (const dz of [-0.45, 0.45]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.05, 6, 14), m); w.position.set(0, 0.35, dz); w.rotation.y = Math.PI / 2; b.add(w); } box(b, 0.05, 0.05, 0.9, mat([0xd62828, 0x1f5fbf, 0x2d8f4e, 0x222222, 0xffb300][k % 5], 0.5), 0, 0.6, 0); b.position.set(x + k * 0.5, 0.3, z); g.add(b); } }
function tulips(g, x, z, w, d) { box(g, w, 0.3, d, mat(0x6b4a2b, 1), x, 0.45, z); const cols = [0xff2d55, 0xffd60a, 0xff8c00, 0xbf5af2, 0xffffff]; for (let i = 0; i < w * 2; i++) for (let j = 0; j < d * 2; j++) { const t = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), mat(cols[(Math.floor(i / 2) + j) % cols.length], 0.6)); t.position.set(x - w / 2 + 0.25 + i * 0.5, 0.75, z - d / 2 + 0.25 + j * 0.5); g.add(t); } }
function erasmus() {   // „Лебедът“: бял асиметричен пилон с ванти над воден басейн
  const g = new THREE.Group(), white = mat(0xf2f4f6, 0.4, 0.3, { emissive: 0xbfd8ff, emissiveIntensity: 0 }), deck = mat(0x5a6068, 0.6, 0.3), lights = [];
  box(g, 15, 0.12, 15, water(), 0, 0.06, 0);
  box(g, 3.2, 0.6, 15.5, deck, 0, 1.6, 0); box(g, 3.4, 0.25, 15.5, mat(0x3a73c0, 0.6), 0, 1.25, 0);
  const pyl = new THREE.Group(); pyl.position.set(0, 1.9, -3.5); g.add(pyl);
  const leg = box(pyl, 0.7, 13, 0.7, white, 0, 6.5, 0); leg.rotation.x = 0.18; const bend = box(pyl, 0.6, 3, 0.6, white, 0, 12.8, -1.6); bend.rotation.x = 0.9;
  for (let k = 0; k < 8; k++) { const z = 1 + k * 0.85, top = new THREE.Vector3(0, 13.5, -3.2), bot = new THREE.Vector3(0, 1.9, -3.5 + z + 0.5), len = top.distanceTo(bot); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 4), white); c.position.copy(top.clone().add(bot).multiplyScalar(0.5)); c.lookAt(bot); c.rotateX(Math.PI / 2); g.add(c); }
  for (let k = 0; k < 4; k++) { const z = -3.5 - 1 - k * 0.9, top = new THREE.Vector3(0, 12.5, -3.4), bot = new THREE.Vector3(0, 1.9, z), len = top.distanceTo(bot); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 4), white); c.position.copy(top.clone().add(bot).multiplyScalar(0.5)); c.lookAt(bot); c.rotateX(Math.PI / 2); g.add(c); }
  const lm = mat(0xffffff, 0.4, 0, { emissive: 0xffffff, emissiveIntensity: 0 }); lights.push(lm);
  for (let z = -7; z <= 7; z += 2) for (const sx of [-1, 1]) box(g, 0.12, 0.12, 0.12, lm, sx * 1.6, 2.2, z);
  g.userData.flood = [white]; g.userData.lit = lights;
  return g;
}
function cubes() {   // Кубичните къщи: наклонени жълти кубове на шестоъгълни колони
  const g = new THREE.Group(), y = mat(0xf2c200, 0.6), grey = mat(0xb0b4b8, 0.8), win = mat(0x2b3440, 0.3, 0.2, { emissive: 0xffd890, emissiveIntensity: 0 });
  box(g, 15, 0.3, 15, mat(0xcfc8b8, 0.95), 0, 0.15, 0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const x = -4.5 + i * 4.5 + j * 2.2, z = -2.5 + j * 5;
    cyl(g, 0.9, 0.9, 3, grey, x, 1.8, z, 6);
    const c = box(g, 3, 3, 3, y, x, 4.8, z); c.rotation.set(Math.PI / 4, 0, Math.atan(1 / Math.SQRT2));
    const w = box(g, 1.2, 1.2, 0.1, win, x, 4.8, z + 1.6); w.rotation.copy(c.rotation);
  }
  bikes(g, -6, 6.2, 6);
  g.userData.lit = [win];
  return g;
}
function markthal() {   // Маркетхал: подкова-арка с цветен таван, стъклени торцове
  const g = new THREE.Group(), st = mat(0x9ea3a8, 0.7, 0.1, { emissive: 0xffd8a0, emissiveIntensity: 0 }), glass = mat(0x8fb7d6, 0.15, 0.4, { emissive: 0xffd890, emissiveIntensity: 0 });
  box(g, 15, 0.3, 15, mat(0xcfc8b8, 0.95), 0, 0.15, 0);
  // подкова: външна полуелипса минус вътрешна, изтеглена по z
  const sh2 = new THREE.Shape(); { const N = 24; for (let k = 0; k <= N; k++) { const a = k / N * Math.PI; sh2[k ? 'lineTo' : 'moveTo'](Math.cos(a) * 6, Math.sin(a) * 8); } for (let k = N; k >= 0; k--) { const a = k / N * Math.PI; sh2.lineTo(Math.cos(a) * 4.6, Math.sin(a) * 6.6); } sh2.closePath(); }
  const arch = new THREE.Mesh(new THREE.ExtrudeGeometry(sh2, { depth: 12, bevelEnabled: false }), st); arch.position.set(0, 0.3, -6); arch.castShadow = true; g.add(arch);
  const inner = new THREE.Mesh(new THREE.ExtrudeGeometry(sh2, { depth: 11.9, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xff7a3a, roughness: 0.8, side: THREE.BackSide })); inner.scale.set(0.99, 0.99, 1); inner.position.set(0, 0.32, -5.95); g.add(inner);
  for (const sz of [-1, 1]) { const end = new THREE.Mesh(new THREE.CircleGeometry(4.6, 24, 0, Math.PI), glass); end.scale.set(1, 6.6 / 4.6, 1); end.position.set(0, 0.3, sz * 5.9); if (sz < 0) end.rotation.y = Math.PI; g.add(end); }
  tulips(g, -5.5, 6.8, 3, 1); tulips(g, 5.5, 6.8, 3, 1);
  g.userData.flood = [st]; g.userData.lit = [glass];
  return g;
}
function derotterdam() {   // „Де Ротердам“: три стъклени кули, разместени по височина
  const g = new THREE.Group(), gl = glassMat(8, 40, 13, '#546a7d', '#cfd6dd');
  box(g, 15, 0.3, 15, mat(0x9aa0a6, 0.9), 0, 0.15, 0);
  [[-3.5, 0, 34, 0], [0, -1.5, 40, 0.8], [3.5, 0.5, 37, -0.6]].forEach(([x, z, h, dx]) => { box(g, 3.6, h * 0.55, 5, gl, x, 0.3 + h * 0.275, z); box(g, 3.6, h * 0.45, 5, gl, x + dx, 0.3 + h * 0.55 + h * 0.225, z); });
  box(g, 11, 4, 6, mat(0x2b3440, 0.4, 0.5), 0, 2.3, 0);
  g.userData.glass = [gl];
  return g;
}
function euromast() {   // Евромаст: бетонна кула с „гнездо“ и тънка игла отгоре
  const g = new THREE.Group(), conc = mat(0xd9d6cf, 0.7), red = mat(0xc0392b, 0.5), glass = mat(0x6fa8c9, 0.2, 0.4, { emissive: 0xffd890, emissiveIntensity: 0 }), tip = mat(0xff3030, 0.4, 0, { emissive: 0xff2020, emissiveIntensity: 0 });
  box(g, 15, 0.3, 15, mat(0x6f9a4e, 1), 0, 0.15, 0);
  cyl(g, 1.3, 1.6, 24, conc, 0, 12.3, 0, 16);
  cyl(g, 3.2, 2.8, 1.6, conc, 0, 23, 0, 20); cyl(g, 3.1, 3.1, 1.2, glass, 0, 24.4, 0, 20); cyl(g, 3.3, 3.3, 0.4, red, 0, 25.2, 0, 20);
  cyl(g, 0.6, 0.6, 9, mat(0xbfc5ca, 0.4, 0.6), 0, 29.8, 0, 10); cyl(g, 0.9, 0.9, 1.2, glass, 0, 33, 0, 10); cyl(g, 0.12, 0.12, 4, conc, 0, 35.6, 0, 6);
  add(g, new THREE.SphereGeometry(0.25, 8, 6), tip, 0, 37.7, 0);
  for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) { cyl(g, 0.2, 0.25, 1.5, mat(0x6b4a2b), x, 1, z, 6); add(g, new THREE.SphereGeometry(1.3, 8, 6), mat(0x3f8f3a), x, 2.6, z); }
  g.userData.lit = [glass]; g.userData.blink = [tip];
  return g;
}
function canal(seed = 0) {   // канал с тесни цветни къщи с фронтони от двете страни, мостче и лодки
  const g = new THREE.Group(), cols = [0x7a3b2e, 0x2f2f33, 0x8a5a3c, 0x4a5a3a, 0x6b2f2f, 0xe8e1cf, 0x5a4636], win = mat(0xf2efe6, 0.6, 0, { emissive: 0xffd890, emissiveIntensity: 0 });
  box(g, 15, 0.3, 15, mat(0xb8b0a0, 0.95), 0, 0.15, 0);
  box(g, 15, 0.1, 4, water(), 0, 0.32, 0);
  for (const sz of [-1, 1]) for (let k = 0; k < 6; k++) {
    const w = 2.3, h = 5 + ((k * 7 + seed * 3) % 4) * 0.9, x = -6.2 + k * 2.48, z = sz * 4.8, c = mat(cols[(k + seed + (sz > 0 ? 3 : 0)) % cols.length], 0.85);
    box(g, w, h, 4, c, x, 0.3 + h / 2, z);
    const gs = new THREE.Shape(); gs.moveTo(-w / 2, 0); gs.lineTo(-w / 2, 0.5); gs.lineTo(-w / 4, 0.5); gs.lineTo(-w / 4, 1.1); gs.lineTo(w / 4, 1.1); gs.lineTo(w / 4, 0.5); gs.lineTo(w / 2, 0.5); gs.lineTo(w / 2, 0); gs.closePath();   // стъпаловиден фронтон
    const gab = new THREE.Mesh(new THREE.ExtrudeGeometry(gs, { depth: 0.3, bevelEnabled: false }), c); gab.position.set(x, 0.3 + h, z - sz * 2 - (sz > 0 ? 0.3 : 0)); g.add(gab);
    for (let r = 0; r < Math.floor(h / 1.4); r++) for (const dx of [-0.5, 0.5]) box(g, 0.5, 0.8, 0.06, win, x + dx, 1.3 + r * 1.4, z - sz * 2.02);
  }
  const br = mat(0x8a5a3c, 0.9); box(g, 2.6, 0.4, 4.4, br, seed ? 3 : -3, 1.1, 0); box(g, 2.6, 0.5, 0.15, mat(0x2a2a2a), seed ? 3 : -3, 1.55, -2.1); box(g, 2.6, 0.5, 0.15, mat(0x2a2a2a), seed ? 3 : -3, 1.55, 2.1);
  for (let k = 0; k < 3; k++) { const b = new THREE.Group(); box(b, 1.2, 0.5, 3.2, mat([0x2f6f8f, 0x8f2f2f, 0x2f8f4f][k], 0.6), 0, 0.5, 0); box(b, 1, 0.5, 1.2, mat(0xe8e1cf), 0, 0.95, -0.4); b.position.set(-5 + k * 3.6 + seed, 0, (k % 2 ? 1 : -1) * 0.9); b.rotation.y = Math.PI / 2; g.add(b); }
  bikes(g, -6.5, 2.4, 5); bikes(g, 3, -2.4, 4);
  g.userData.lit = [win];
  return g;
}
function rijks() {   // Райксмузеум: червена тухла, две кули със заострени покриви, проход отдолу
  const g = new THREE.Group(), brick = mat(0x9c4a32, 0.9, 0, { emissive: 0xffb070, emissiveIntensity: 0 }), stone = mat(0xe3d8c0, 0.8), slate = mat(0x4a5560, 0.6, 0.2), win = mat(0x2b3440, 0.3, 0.2, { emissive: 0xffd890, emissiveIntensity: 0 });
  box(g, 15, 0.3, 15, mat(0xcfc8b8, 0.95), 0, 0.15, 0);
  box(g, 14, 6, 6, brick, 0, 3.3, -1.5); gable(g, 14, 3, 6.4, slate, 0, 6.3, -1.5);
  for (const sx of [-1, 1]) { box(g, 2.6, 10, 2.6, brick, sx * 2.4, 5.3, 1.2); add(g, new THREE.ConeGeometry(1.9, 4, 4), slate, sx * 2.4, 12.3, 1.2).rotation.y = Math.PI / 4; add(g, new THREE.SphereGeometry(0.25, 6, 4), mat(0xd8b44a, 0.3, 0.8), sx * 2.4, 14.4, 1.2); }
  box(g, 2.2, 3, 2.8, mat(0x2a2522), 0, 1.8, 1.3);   // проходът
  for (let r = 0; r < 2; r++) for (let k = -6; k <= 6; k++) if (Math.abs(k) > 3) box(g, 0.6, 1.2, 0.06, win, k * 0.95, 2.4 + r * 2.4, 1.53);
  for (let k = 0; k < 14; k++) box(g, 0.15, 0.15, 6, stone, -6.5 + k, 6.35, -1.5);
  tulips(g, -4.5, 6, 4, 1.2); tulips(g, 4.5, 6, 4, 1.2);
  g.userData.flood = [brick]; g.userData.lit = [win];
  return g;
}
function centraal() {   // Централна гара: дълга тухлена фасада с две кули с часовници и стъклен перонен покрив отзад
  const g = new THREE.Group(), brick = mat(0x9c4a32, 0.9, 0, { emissive: 0xffb070, emissiveIntensity: 0 }), slate = mat(0x4a5560, 0.6, 0.2), gold = mat(0xd8b44a, 0.3, 0.8), clock = mat(0xffffff, 0.5, 0, { emissive: 0xfff2c8, emissiveIntensity: 0 }), win = mat(0x2b3440, 0.3, 0.2, { emissive: 0xffd890, emissiveIntensity: 0 });
  box(g, 15, 0.3, 15, mat(0xcfc8b8, 0.95), 0, 0.15, 0);
  box(g, 14.5, 4.5, 3.5, brick, 0, 2.55, 1.5);
  gable(g, 14.5, 2.2, 3.9, slate, 0, 4.8, 1.5);
  for (const sx of [-1, 1]) { box(g, 2.2, 8, 2.2, brick, sx * 1.8, 4.3, 3.2); add(g, new THREE.ConeGeometry(1.5, 2.6, 4), gold, sx * 1.8, 9.6, 3.2).rotation.y = Math.PI / 4; const c = new THREE.Mesh(new THREE.CircleGeometry(0.6, 16), clock); c.position.set(sx * 1.8, 7, 4.31); g.add(c); }
  for (let k = -6; k <= 6; k++) if (Math.abs(k) > 2) box(g, 0.6, 1.4, 0.06, win, k * 1.05, 2.6, 3.26);
  const shed = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 14, 20, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: 0xbcd3e3, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.75, side: THREE.DoubleSide })); shed.rotation.z = Math.PI / 2; shed.rotation.y = Math.PI / 2; shed.rotation.x = 0; shed.position.set(0, 0.3, -3.5); shed.scale.set(1, 0.6, 1); g.add(shed);
  bikes(g, -6.5, 6, 10); bikes(g, 1.5, 6, 10);
  g.userData.flood = [brick]; g.userData.lit = [win, clock];
  return g;
}
function adam() {   // A'DAM Лукаут: бяла кула с черни „изместени“ ленти и люлка на покрива
  const g = new THREE.Group(), w = mat(0xf2f2ee, 0.5), dark = mat(0x23262b, 0.4, 0.3), glass = mat(0x6f8fa8, 0.2, 0.4, { emissive: 0xffd890, emissiveIntensity: 0 }), red = mat(0xd62828, 0.5);
  box(g, 15, 0.3, 15, mat(0x9aa0a6, 0.9), 0, 0.15, 0);
  box(g, 5, 26, 5, glass, 0, 13.3, 0);
  for (let k = 0; k < 5; k++) box(g, 5.4, 4.2, 5.4, k % 2 ? dark : w, (k % 2 ? 0.35 : -0.35), 3 + k * 5.2, (k % 2 ? -0.3 : 0.3));   // ленти, изместени като в оригинала
  box(g, 5.4, 0.6, 5.4, w, 0, 26.6, 0);
  box(g, 0.15, 3, 0.15, red, 2.4, 28.4, -1); box(g, 0.15, 3, 0.15, red, 2.4, 28.4, 1); box(g, 0.15, 0.15, 2.2, red, 2.4, 29.9, 0); box(g, 1, 0.2, 0.8, red, 3.5, 28, 0);   // люлката над ръба
  box(g, 15, 0.1, 5, water(), 0, 0.32, 6);
  g.userData.lit = [glass];
  return g;
}
function windmill() {   // холандска мелница: осмоъгълна кула, капа и въртящи се крила, лалета наоколо
  const g = new THREE.Group(), wood = mat(0x4a3a2c, 0.9), cap = mat(0x3a4a3a, 0.8), white = mat(0xf2efe6, 0.7);
  box(g, 15, 0.3, 15, mat(0x6f9a4e, 1), 0, 0.15, 0);
  cyl(g, 1.8, 3, 10, wood, 0, 5.3, 0, 8); add(g, new THREE.ConeGeometry(2.1, 2.4, 8), cap, 0, 11.5, 0);
  box(g, 6, 0.4, 6, wood, 0, 3.5, 0);   // галерия
  const sails = new THREE.Group(); sails.position.set(0, 10, 2.4); g.add(sails);
  for (let k = 0; k < 4; k++) { const arm = new THREE.Group(); arm.rotation.z = k * Math.PI / 2; sails.add(arm); box(arm, 0.25, 7, 0.15, wood, 0, 3.5, 0); box(arm, 1.3, 5.6, 0.06, white, 0.75, 4, 0); }
  tulips(g, -4.5, 5, 4, 2); tulips(g, 4.5, 5, 4, 2); tulips(g, -4.5, -5, 4, 2);
  g.userData.spin = sails;
  return g;
}

// ---------------------------------------------------------------- Париж, Лондон, Берлин
function arc() {
  const g = new THREE.Group(), st = mat(0xe8dcc0, 0.85, 0, { emissive: 0xffd8a0, emissiveIntensity: 0 }), dark = mat(0x2a2522);
  box(g, 15, 0.3, 15, mat(0xb8b0a0, 0.95), 0, 0.15, 0);
  for (let r = 0; r < 3; r++) { const ring = new THREE.Mesh(new THREE.RingGeometry(5 + r * 1.6, 5.8 + r * 1.6, 32), mat(0x6f9a4e, 1)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.32; g.add(ring); }
  for (const sx of [-1, 1]) box(g, 2.4, 9, 4, st, sx * 2.6, 4.8, 0);
  box(g, 7.6, 2.8, 4, st, 0, 10.7, 0); box(g, 7.9, 0.4, 4.3, st, 0, 12.3, 0);
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 4.02, 16, 1, false, 0, Math.PI), dark); vault.rotation.z = Math.PI / 2; vault.rotation.y = Math.PI / 2; vault.position.set(0, 9.3, 0); g.add(vault);
  box(g, 2.8, 0.1, 3.9, dark, 0, 4.3, 0);
  g.userData.flood = [st];
  return g;
}
function ladefense() {   // Гранд Арш + стъклени кули
  const g = new THREE.Group(), w = mat(0xf2f2ee, 0.5, 0.2, { emissive: 0xdde8ff, emissiveIntensity: 0 }), gl = glassMat(6, 30, 21, '#5e7f9c', '#d4e2ec');
  box(g, 15, 0.3, 15, mat(0xb0b4b8, 0.95), 0, 0.15, 0);
  for (const sx of [-1, 1]) box(g, 1.6, 10, 5, w, sx * 4, 5.3, 2);
  box(g, 9.6, 1.6, 5, w, 0, 11.1, 2); box(g, 9.6, 1.2, 5, w, 0, 0.9, 2);
  box(g, 3.5, 26, 3.5, gl, -5, 13.3, -5); box(g, 3, 20, 3, gl, 5.5, 10.3, -5.5);
  g.userData.flood = [w]; g.userData.glass = [gl];
  return g;
}
function bigben() {   // часовникова кула + парламентът
  const g = new THREE.Group(), st = mat(0xc9b27a, 0.85, 0, { emissive: 0xffd090, emissiveIntensity: 0 }), roof = mat(0x3d4a52, 0.6, 0.3), gold = mat(0xd8b44a, 0.3, 0.8), face = mat(0xfff6dc, 0.4, 0, { emissive: 0xfff2c0, emissiveIntensity: 0 });
  box(g, 15, 0.3, 15, mat(0xb8b0a0, 0.95), 0, 0.15, 0);
  box(g, 14, 5, 4, st, 0, 2.8, -4.5); gable(g, 14, 1.6, 4.2, roof, 0, 5.3, -4.5);
  for (let k = -6; k <= 6; k += 1.5) box(g, 0.25, 6.8, 0.25, st, k, 3.7, -2.45);
  box(g, 3, 4, 3, st, 4.5, 2.3, -4.5); box(g, 2.6, 11, 2.6, st, 4.5, 7.8, -4.5);   // Виктория кула
  box(g, 2.4, 16, 2.4, st, -4.5, 8.3, 2.5);   // Биг Бен
  box(g, 3, 3.4, 3, st, -4.5, 17.9, 2.5);
  for (const [dx, dz, ry] of [[0, 1.52, 0], [0, -1.52, Math.PI], [1.52, 0, Math.PI / 2], [-1.52, 0, -Math.PI / 2]]) { const c = new THREE.Mesh(new THREE.CircleGeometry(1.1, 20), face); c.position.set(-4.5 + dx, 17.9, 2.5 + dz); c.rotation.y = ry; g.add(c); }
  box(g, 2.4, 1.6, 2.4, st, -4.5, 20.4, 2.5); add(g, new THREE.ConeGeometry(1.8, 4.4, 4), roof, -4.5, 23.4, 2.5).rotation.y = Math.PI / 4; add(g, new THREE.SphereGeometry(0.2, 6, 4), gold, -4.5, 25.8, 2.5);
  box(g, 15, 0.1, 3, mat(0x3f7fb0, 0.25, 0.1), 0, 0.32, 6.3);   // Темза
  g.userData.flood = [st]; g.userData.lit = [face];
  return g;
}
function londoneye() {
  const g = new THREE.Group(), w = mat(0xf2f4f6, 0.4, 0.4), pod = mat(0xbfe0ff, 0.2, 0.3, { emissive: 0x8fc8ff, emissiveIntensity: 0 }), ring = mat(0xf2f4f6, 0.4, 0.4, { emissive: 0x6fa0ff, emissiveIntensity: 0 });
  box(g, 15, 0.3, 15, mat(0xb8b0a0, 0.95), 0, 0.15, 0); box(g, 15, 0.1, 5, mat(0x3f7fb0, 0.25, 0.1), 0, 0.32, -4.5);
  const wheel = new THREE.Group(); wheel.position.set(0, 13, -2); g.add(wheel);
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(11, 0.25, 8, 48), ring));
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; const sp = box(wheel, 0.08, 11, 0.08, w, Math.sin(a) * 5.5, Math.cos(a) * 5.5, 0); sp.rotation.z = -a; const p = add(wheel, new THREE.SphereGeometry(0.55, 8, 6), pod, Math.sin(a) * 11, Math.cos(a) * 11, 0.6); p.scale.z = 1.6; }
  for (const sx of [-1, 1]) { const l = box(g, 0.4, 14, 0.4, w, sx * 2.5, 6.5, 1); l.rotation.z = sx * -0.2; }
  g.userData.spin = wheel; g.userData.spinAxis = 'z'; g.userData.lit = [pod, ring];
  return g;
}
function towerbridge() {
  const g = new THREE.Group(), st = mat(0xd8cfb8, 0.85, 0, { emissive: 0xffd8a0, emissiveIntensity: 0 }), blue = mat(0x5f9fd6, 0.5, 0.3), roof = mat(0x3d4a52, 0.6, 0.3);
  box(g, 15, 0.12, 15, mat(0x3f7fb0, 0.25, 0.1), 0, 0.06, 0);
  for (const sx of [-1, 1]) { box(g, 2.6, 2, 3.6, st, sx * 3.5, 1, 0); box(g, 2.2, 11, 3, st, sx * 3.5, 6.5, 0); for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(g, new THREE.ConeGeometry(0.35, 2, 4), roof, sx * 3.5 + dx * 0.9, 13, dz * 1.3); add(g, new THREE.ConeGeometry(1.4, 3, 4), roof, sx * 3.5, 13.5, 0).rotation.y = Math.PI / 4; }
  box(g, 4.8, 0.5, 3, blue, 0, 3, 0); for (const y of [10.5, 11.3]) box(g, 4.8, 0.4, 0.5, blue, 0, y, 0);
  for (const sx of [-1, 1]) { box(g, 5, 0.5, 3, blue, sx * 7.2, 3, 0); const c = box(g, 6, 0.25, 0.25, blue, sx * 6.8, 6.5, 1.4); c.rotation.z = sx * 0.55; const c2 = c.clone(); c2.position.z = -1.4; g.add(c2); }
  g.userData.flood = [st];
  return g;
}
function shard() {
  const g = new THREE.Group(), gl = glassMat(8, 50, 31, '#7f9db5', '#e2eaf0');
  box(g, 15, 0.3, 15, mat(0xb0b4b8, 0.95), 0, 0.15, 0);
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 5.2, 46, 4, 1), gl); sh.rotation.y = Math.PI / 4; sh.position.y = 23.3; sh.castShadow = true; g.add(sh);
  const tip = add(g, new THREE.SphereGeometry(0.3, 6, 4), mat(0xff3030, 0.4, 0, { emissive: 0xff2020, emissiveIntensity: 0 }), 0, 46.6, 0);
  g.userData.glass = [gl]; g.userData.blink = [tip.material];
  return g;
}
function brandenburg() {
  const g = new THREE.Group(), st = mat(0xe3d7b8, 0.85, 0, { emissive: 0xffd8a0, emissiveIntensity: 0 }), bronze = mat(0x4f6b55, 0.5, 0.6);
  box(g, 15, 0.3, 15, mat(0xc8c0ae, 0.95), 0, 0.15, 0);
  box(g, 13, 0.6, 3.6, st, 0, 0.6, 0);
  for (let k = 0; k < 6; k++) { const x = -5.5 + k * 2.2; cyl(g, 0.38, 0.42, 7, st, x, 4.4, 0.9, 12); cyl(g, 0.38, 0.42, 7, st, x, 4.4, -0.9, 12); }
  box(g, 13.2, 1.6, 3.8, st, 0, 8.7, 0); box(g, 8, 1.2, 3, st, 0, 10.1, 0);
  for (const sx of [-1, 1]) box(g, 2.2, 6, 3.4, st, sx * 7.6, 3.6, 0);
  const q = new THREE.Group(); q.position.set(0, 10.7, 0); g.add(q);   // квадригата
  for (let h = 0; h < 4; h++) box(q, 0.4, 1.2, 1.6, bronze, -0.9 + h * 0.6, 0.8, 0.6);
  box(q, 2, 0.8, 1, bronze, 0, 0.5, -0.6); add(q, new THREE.ConeGeometry(0.3, 2, 6), bronze, 0, 1.9, -0.6);
  g.userData.flood = [st];
  return g;
}
function fernsehturm() {
  const g = new THREE.Group(), conc = mat(0xd9d6cf, 0.6), ball = mat(0xb8c0c8, 0.3, 0.7, { emissive: 0x9fb8ff, emissiveIntensity: 0 }), red = mat(0xd62828, 0.5), win = mat(0x2b3440, 0.3, 0.2, { emissive: 0xffd890, emissiveIntensity: 0 });
  box(g, 15, 0.3, 15, mat(0x8fae6a, 1), 0, 0.15, 0);
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2, f = box(g, 1.2, 4, 3, conc, Math.sin(a) * 2, 2, Math.cos(a) * 2); f.rotation.y = a; }
  cyl(g, 0.9, 1.4, 30, conc, 0, 15.3, 0, 16);
  add(g, new THREE.SphereGeometry(3.2, 24, 16), ball, 0, 31.5, 0); cyl(g, 3.25, 3.25, 0.8, win, 0, 31.5, 0, 24);
  for (let k = 0; k < 6; k++) cyl(g, 0.25 - k * 0.025, 0.28 - k * 0.025, 2, k % 2 ? conc : red, 0, 35.5 + k * 2, 0, 8);
  const tip = add(g, new THREE.SphereGeometry(0.25, 6, 4), mat(0xff3030, 0.4, 0, { emissive: 0xff2020, emissiveIntensity: 0 }), 0, 47.2, 0);
  g.userData.lit = [win, ball]; g.userData.blink = [tip.material];
  return g;
}
function reichstag() {
  const g = new THREE.Group(), st = mat(0xcfc6b2, 0.85, 0, { emissive: 0xffd8a0, emissiveIntensity: 0 }), glass = mat(0xbfe0ff, 0.15, 0.4, { emissive: 0x9fc8ff, emissiveIntensity: 0, transparent: true, opacity: 0.75 });
  box(g, 15, 0.3, 15, mat(0x8fae6a, 1), 0, 0.15, 0);
  box(g, 13, 6, 9, st, 0, 3.3, -0.5);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, 2.6, 8, 2.6, st, sx * 5.6, 4.3, sz * 3.6 - 0.5);
  for (let k = 0; k < 6; k++) cyl(g, 0.32, 0.34, 4.6, st, -2.5 + k, 3, 4.2, 10);
  const tri = new THREE.Shape(); tri.moveTo(-3.2, 0); tri.lineTo(3.2, 0); tri.lineTo(0, 1.4); tri.closePath(); const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.8, bevelEnabled: false }), st); ped.position.set(0, 5.6, 3.7); g.add(ped);
  const dome = add(g, new THREE.SphereGeometry(3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 6.3, -0.5); dome.scale.y = 1.15;
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, r = box(g, 0.06, 3.4, 0.06, mat(0x9aa0a6, 0.3, 0.8), Math.sin(a) * 2.2, 7.8, -0.5 + Math.cos(a) * 2.2); r.rotation.set(Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6); }
  const flag = new THREE.Group(); flag.position.set(0, 10.8, -0.5); g.add(flag); cyl(flag, 0.05, 0.05, 2.2, mat(0xdddddd), 0, 0, 0, 6);
  [0x111111, 0xd62828, 0xffcc00].forEach((c, i) => box(flag, 1.6, 0.3, 0.04, new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide }), 0.85, 0.95 - i * 0.3, 0));
  g.userData.flood = [st]; g.userData.lit = [glass];
  return g;
}

// ---- забележителности от готови модели (assets/heavy/lm/*.glb, Sketchfab, CC-BY — виж assets/heavy/CREDITS.txt)
// h — височина в метри на играта; fit — най-много толкова ширина/дължина (парцелът е ~15 м); grid — пакет от сгради, подредени в квартал
const GLB_LM = {
  burj: { h: 70, fit: 14, onLoad: (w, g) => { if (feature('night-burj2')) burjLights(w, g); } }, cntower: { h: 58, fit: 14 }, willis: { h: 46, fit: 14, onLoad: (w, g) => { if (feature('night-willis')) willisLights(w, g); } }, shtower: { h: 56, fit: 14 },
  liberty: { h: 22, fit: 13, plate: 0x7d9a6a }, redeemer: { h: 18, fit: 14, plate: 0x6f8f55 }, stbasil: { h: 20, fit: 15, plate: 0xb9b0a3 },
  opera: { h: 30, fit: 40, plate: 0x4f86b8 }, manhattan: { h: 34, fit: 15, grid: true },
  colosseo: { h: 13, fit: 15, plate: 0xb9ad98 },   // Рим: Колизеумът (Carlos.Maciel)
  empire2: { h: 45, fit: 15, plate: 0x8a8580 },   // Ню Йорк: Емпайър Стейт (модел на потребителя, Meshy AI, олекотен 1,3 млн. → 160 хил. △) — вместо кулата от пакета Манхатън; нощем тъмно тяло с прозорци, светла корона и шпил — nightfloors 'empire2'
  radiocity2: { h: 40, fit: 15, plate: 0x8a8580 },   // Ню Йорк: Радио Сити Мюзик Хол (модел на потребителя, Meshy AI) — в Blender: кулата по-широка и напред до надписите, неоновите „RADIO CITY“ (вертикалните и на таблото около ъгъла), стената под таблото; нощем — nightfloors 'radio'/'neon'
  rockefeller2: { h: 40, fit: 15, plate: 0x8a8580 },   // Ню Йорк: 30 Rockefeller Plaza (модел на потребителя, Meshy AI, олекотен 2,6 млн. → 180 хил. △); нощем синьо-виолетово, нагоре по-светло — nightfloors.js 'rock'
  parliament2: { h: 9, fit: 15, plate: 0x5f6d4f },   // Лондон: Уестминстърският дворец с Биг Бен (модел на потребителя, Meshy AI) — в Blender плочата изрязана до сградите и дворът стеснен (площта ~3 пъти по-малка), 200 хил. △; нощем — nightfloors.js 'westm'
  grandcentral2: { h: 6, fit: 15, plate: 0x8a8580 },   // Ню Йорк: гара Гранд Сентръл (модел на потребителя, Meshy AI) — в Blender удължена назад (3 участъка странични стени с арките + задната стена, плосък покрив), 200 хил. △; нощем — nightfloors.js 'gct'
  stpatrick2: { h: 14, fit: 15, plate: 0x8a8a86 },   // Ню Йорк: катедралата „Св. Патрик“ (модел на потребителя, Meshy AI, олекотен 4,5 млн. → 220 хил. △, 7 MB); нощем — nightfloors.js 'patrick'
  lazare2: { h: 9, fit: 15, plate: 0x8f8a82 },   // Париж: гара Сен Лазар (модел на потребителя, Meshy AI) — в Blender затворена в квадрат (4 фасади, срязани на 45° в ъглите) около вътрешен двор; нощем — nightfloors.js 'lazare'
  arc2: { h: 11, fit: 13, plate: 0xbdb5a4, floodK: 1.2 },   // Париж: Триумфалната арка (модел на потребителя, Meshy AI, олекотен 3,2 млн. → 120 хил. △, 5,7 MB; feature 'lm-arc2') — истински ръст 50 м (game.js LM_REAL_H)
  suleymaniye2: { h: 9.5, fit: 15, plate: 0xc9c0ae, floodK: 1.2 },   // Истанбул: джамията Сюлеймание (модел на потребителя, Meshy AI, олекотен 7,8 млн. → 84 хил. △, 3,8 MB; feature 'lm-suleymaniye2') — истински ръст по минаретата (game.js LM_REAL_H 72 м); нощем — прожекторите по текстурата (floodK)
  maiden2: { h: 10, fit: 15, plate: 0x5d6b78 },   // Истанбул: Момината кула (модел на потребителя, Meshy AI, олекотен 1 млн. → 120 хил. △) — нощем златиста (nightfloors.js 'maiden')
  colosseo3: { h: 13, fit: 15, plate: 0xb9ad98 },
  colosseo4: { h: 13, fit: 15, plate: 0xb9ad98 },   // Рим: Колизеумът (модел на потребителя, Meshy AI, олекотен 1,6 млн. → 160 хил. △; feature 'lm-colosseum2') — в Blender: плочата наоколо изрязана, кръгът → овал 189 × 156 м, височината ~55 м (истинската е 48 — по-ниско арките се смачкват); нощем златист (nightfloors.js 'colosseo')   // Рим: Колизеумът от дъгата на Meshy AI (модел на потребителя) — сглобен в Blender в пълен овал, истинските пропорции 190 × 156 × 48 м (feature 'lm-colosseo3')
  sagrada: { h: 17, fit: 15, plate: 0xc9bfa8 },   // Барселона: Саграда Фамилия (vmmaniac)
  bigben2: { h: 30, fit: 8, plate: 0xb8b0a0 },   // Лондон: Биг Бен (Daqian Dong, Poly Pizza; feature 'london-real')
  londoneye2: { h: 42, fit: 22, plate: 0xb8b0a0 },
  vittoriano2: { h: 12, fit: 22, plate: 0xd8d2c4, ry: Math.PI / 2 },   // Рим: Витториано (модел на потребителя, Meshy AI) — стълбите напред, колонадата отзад (feature 'lm-vittoriano')   // Лондон: London Eye (Ferris Wheel, CreativeTrio, CC0)
  petronas: { h: 60, fit: 15, plate: 0xb9b2a5, floodK: 2.4, silver: 1.3, onLoad: petronasLights },   // silver — стомана и стъкло; нощем — етажите (nightfloors.js)   // Куала Лумпур: кулите Петронас (Meshy AI, от потребителя — 18.10); нощем сребристо осветени, червени светлини на шпиловете
  whitehouse: { h: 9, fit: 15, plate: 0x6f9a55, matte: 0xf4f1ea, rx: -0.28, cut: [[-0.35, 0.95, 0.8, 1.6]], floodK: 2.2, onLoad: whMonument },   // cut — колата от модела, останала на тревата пред южната фасада; floodK — по-силни прожектори нощем   // Вашингтон: Белият дом с крилата (Void); моделът е наклонен ~16° — rx го изправя (иначе едната страна и крилата висят във въздуха)
  capitol: { h: 11, fit: 15, plate: 0x6f8f55, floodK: 3 },   // Вашингтон: Капитолият (Meshy AI, от потребителя — 18.10; преди: фотоскан на ycpan3468)
  // 🇺🇸 Вашингтон по истинската карта (washington-osm): същите модели, но h = истинската височина на модела при основа 15 (иначе lmH лъже и game.js го смачква) — Капитолият 229 × 88 м, Белият дом без обелиска (Монументът е отделно, на истинското си място)
  capitol2: { file: 'capitol', h: 5.75, fit: 15, plate: 0x6f8f55, floodK: 3, ...(feature('was-look') ? { ry: Math.PI } : {}) },   // was-look (55): западната фасада (с терасата) — към Мола
  whitehouse2: { file: 'whitehouse', h: 1.8, fit: 15, plate: 0x6f9a55, matte: 0xf4f1ea, rx: -0.28, cut: [[-0.35, 0.95, 0.8, 1.6]], floodK: 2.2 },
  vegassign: { h: 14, fit: 12, plate: 0xc9b98a, onLoad: (w, g) => { if (feature('night-vegas2')) vegasSignNight(w, g); } },   // Лас Вегас: табелата „Welcome to Fabulous Las Vegas“ (sipulitrade)
  mgu: { h: 16, fit: 15, plate: 0x6f8f55 },
  kotel: { file: 'mgu', h: 14.6, fit: 15, plate: 0x8a8580, crop: [-4.4, 4.4, -3.9, 1.0] },   // Москва: Котелническа висотка (lm-kotel) — моделът на МГУ, изрязан до централната кула с крилата (без парка и площада); ръстът 176 м — game.js LM_REAL_H   // Москва: МГУ — сталинският небостъргач с крилата и парка (Meshy AI); голяма зона 2×2 (BIG_LANDMARKS)
  eiffel: { h: 26, fit: 15, plate: 0xc9bfa8, onLoad: eiffelLights },   // Париж: Айфеловата кула (Meshy AI); нощем златни светлини и проблясване
  cityhall: { h: 18, fit: 15, plate: 0xb9b2a5, flat: true, onLoad: (w, g) => { if (feature('night-cityhall')) cityhallNight(w, g); } },   // Филаделфия: City Hall (Meshy AI; оцветен по върхове — оригиналът е черно-бял)
  ststephen: { h: 16, fit: 15, plate: 0xc9bfa8 },   // Будапеща: базиликата „Св. Стефан“ (Meshy AI)
  mosque: { h: 12, fit: 15, plate: 0xc9c0ae },   // Истанбул: Синята джамия (Meshy AI) — голяма зона 2×2 до центъра
  hagia: { h: 14, fit: 15, plate: 0xc9b99a },   // Истанбул: Света София (Meshy AI)
  notredame: { h: 60, fit: 69, plate: 0xc9bfa8 },   // Париж: Нотр Дам (Meshy AI) — по-голям: катедралата е дълга сграда, иначе изглеждаше като къща
  bellagio: { h: 9, fit: 15, plate: 0xb9b09a, dz: -3.6 },
  luxor: { h: 9, fit: 15, sy: 1.9, plate: 0xd9c08a, onLoad: luxorBeam },
  // Ню Йорк: островът Либърти — диорама на Темидасофт (Meshy AI, платен план; feature 'liberty-island'). В Blender: синята вода и блокът под нея
  // изрязани (по цвета на текстурата и под водната повърхност; подводните камъни и кеят — до водата), 744 → 140 хил. △, 31 → 3,7 MB;
  // материали island / monument (пиедесталът и статуята — прожектори) / torch (пламъкът — свети нощем). h/fit = истинското отношение (1,12 × 1,745):
  // мащабът в game.js е по височината (93 м до върха на факлата), не по парцела. seaY — водата на картата (cityplan2-3d: −1,2): основата е там.
  // София: храм-паметникът „Св. Александър Невски“ (Dimitar Ignatov — iwalk, Sketchfab, CC-BY 4.0; feature 'churches'): плочите отдолу махнати, 341 → 90 хил. △, 40 → 4,9 MB;
  // h/fit — точното отношение (51,7 × 79,4): game.js nevskyPlace мащабира по ръста (52 м), смалено до квартала
  nevsky: { h: 15, fit: 23.1, plate: 0x9a9a92 },
  // lm-more2 (f6): Милано — катедралата Дуомо (mohamedhussien, Sketchfab, CC-BY 4.0; изрязана от фотограметрията на площада, 311 → 61 хил. △, 3,3 MB);
  // Пловдив — Античният стадион (KULTRA LTD, Sketchfab, CC-BY 4.0; 194 → 70 хил. △, 2,6 MB). h/fit — точното отношение; game.js specialLmPlace — истинският ръст
  // lm-budapest (f9): Будапеща — Парламентът (Темидасофт, Meshy AI, платен план; 2,48 млн → 72 хил. △, 4,7 MB). h/fit — отношението на модела (≈ 96 × 268 м);
  // game.js specialLmPlace — в истински ръст (смален до квартала); нощем — златисто осветен (window.__lmNight → dayNight.winMats)
  parliament: { h: 15, fit: 42.9, plate: 0xb8b2a6, onLoad: w => goldNight(w, 0xffc56a, 0.55) },
  duomo: { h: 15, fit: 24.5, plate: 0xb8b2a6 },
  romanstadium: { h: 15, fit: 59.2, plate: 0x9a8f7a },
  liberty2: { h: 15, fit: 23.4, plate: 0x3f6f96, seaY: -1.2, onLoad: libertyIsland },   // Лас Вегас: „Луксор“ — черната пирамида със сфинкса (Meshy AI); нощем лъч от върха   // Лас Вегас: хотел „Беладжо“ (Meshy AI) — отпред езерото с фонтаните (bellagio() по-долу)
};
const glbCache = {};
// нощно златисто осветяване на модел-забележителност: emissive = цвят, emissiveMap = текстурата; играта ги пали нощем (window.__lmNight)
function goldNight(w, col, k) { const seen = new Set(); w.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) { if (!m || seen.has(m) || !('emissive' in m)) continue; seen.add(m);
  m.emissive = new THREE.Color(col); if (m.map) m.emissiveMap = m.map; m.emissiveIntensity = 0; m.userData.winK = k; m.needsUpdate = true; if (window.__lmNight) window.__lmNight(m); } }); }
// стомана и стъкло: текстурата се обезцветява и изсветлява (Meshy дава кафеникав камък), металът блести малко
function silverize(root, k = 1.25) {
  const done = new Set();
  root.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) {
    if (!m || done.has(m)) continue; done.add(m);
    const img = m.map && m.map.image; if (img && img.width) {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
      for (let i = 0; i < a.length; i += 4) { const l = Math.min(255, (a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11) * k + 18); a[i] = l * 0.97; a[i + 1] = l * 0.99; a[i + 2] = Math.min(255, l * 1.04); }
      x.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = m.map.colorSpace; t.flipY = m.map.flipY; t.wrapS = m.map.wrapS; t.wrapT = m.map.wrapT; m.map = t;
    }
    m.metalness = 0.45; m.roughness = 0.35; m.needsUpdate = true;
  } });
}
function loadLm(kind) {
  return glbCache[kind] || (glbCache[kind] = new GLTFLoader().loadAsync(`assets/heavy/lm/${GLB_LM[kind]?.file || kind}.glb`).then(gl => {
    gl.scene.traverse(o => { if (o.isMesh && !o.geometry.attributes.normal) o.geometry.computeVertexNormals(); });
    if (GLB_LM[kind]?.silver) silverize(gl.scene, GLB_LM[kind].silver);   // преди етажите — маската на прозорците е от вече сребристата текстура
    prepNightFloors(gl.scene, kind);   // нощем прозорците светват по етажи (само моделите от nightfloors.js — Беладжо)
    return gl.scene;
  }).catch(() => null));
}
// пакет от сгради в редица → плътен квартал: възлите, които се застъпват (кула + шпил), са една сграда.
// Ниските с широка основа отпадат, останалите се нареждат на редове (най-високите отзад), за да е колкото може по-висок в 15 м
// Манхатън по един небостъргач на парцел (game.js, feature 'ny-spread'): отделните кули от модела, всяка с основа на y = 0 и център (0, 0);
// мащабът е общ — най-високата е висока 1 (game.js ги вдига до истинския ръст). Подредени от най-високата.
export function manhattanTowers() {
  return loadLm('manhattan').then(src => {
    if (!src) return [];
    src.updateMatrixWorld(true);
    let items = [];
    src.traverse(o => { if (!o.isMesh) return; const b = new THREE.Box3().setFromObject(o); const c = b.getCenter(new THREE.Vector3()), it = items.find(x => c.x > x.b0.min.x && c.x < x.b0.max.x && c.z > x.b0.min.z && c.z < x.b0.max.z); if (it) { it.b.union(b); it.m.push(o); } else items.push({ b, b0: b.clone(), m: [o] }); });
    for (const it of items) { it.w = it.b.max.x - it.b.min.x; it.d = it.b.max.z - it.b.min.z; it.h = it.b.max.y - it.b.min.y; }
    const med = [...items].map(x => x.w * x.d).sort((a, b) => a - b)[items.length >> 1];
    items = items.filter(x => (x.w * x.d < med * 2.5 || x.h > 4) && x.h > 0).sort((a, b) => b.h - a.h);
    const H = items[0]?.h || 1;
    return items.map(it => {
      const part = new THREE.Group(), inner = new THREE.Group(); part.add(inner);
      for (const m of it.m) { const c = m.clone(); c.matrixAutoUpdate = false; c.matrix.copy(m.matrixWorld); c.castShadow = c.receiveShadow = true; const mt = c.material; if (mt && mt.metalness > 0.4) { mt.metalness = 0.25; mt.roughness = Math.max(mt.roughness ?? 0.5, 0.45); } inner.add(c); }   // без огледална среда металът излиза черен (като glbLm)
      const c = it.b.getCenter(new THREE.Vector3()); inner.position.set(-c.x, -it.b.min.y, -c.z); part.scale.setScalar(1 / H);
      const nmOf = m => { for (let o = m; o; o = o.parent) if (o.name && !/^(Object_|root|GLTF|Sketchfab|RootNode)/i.test(o.name)) return o.name; return ''; };
      part.userData = { h: it.h / H, w: Math.max(it.w, it.d) / H, nm: it.m.map(nmOf).find(Boolean) || '' };   // nm — коя сграда е (emp_state, christler, metlife, new_york_times…)
      prepNightFloors(part, 'manhattan');   // нощем: прозорците и короната на Емпайър Стейт (Лабораторията → night-manhattan)
      return part;
    });
  });
}
function gridOf(src) {
  src.updateMatrixWorld(true);
  let items = [];
  src.traverse(o => { if (!o.isMesh) return; const b = new THREE.Box3().setFromObject(o); const c = b.getCenter(new THREE.Vector3()), it = items.find(x => c.x > x.b0.min.x && c.x < x.b0.max.x && c.z > x.b0.min.z && c.z < x.b0.max.z); if (it) { it.b.union(b); it.m.push(o); } else items.push({ b, b0: b.clone(), m: [o] }); });
  for (const it of items) { it.w = it.b.max.x - it.b.min.x; it.d = it.b.max.z - it.b.min.z; it.h = it.b.max.y - it.b.min.y; }
  const med = [...items].map(x => x.w * x.d).sort((a, b) => a - b)[items.length >> 1];
  items = items.filter(x => x.w * x.d < med * 2.5 || x.h > 4).sort((a, b) => b.h - a.h);
  const gap = 0.06, row = Math.sqrt(items.reduce((a, x) => a + (x.w + gap) * (x.d + gap), 0)) * 1.1, g = new THREE.Group();
  let x = 0, z = 0, rowD = 0;
  for (const it of items) {
    if (x > 0 && x + it.w > row) { x = 0; z += rowD + gap; rowD = 0; }
    const part = new THREE.Group();
    for (const m of it.m) { const c = m.clone(); c.matrixAutoUpdate = false; c.matrix.copy(m.matrixWorld); part.add(c); }
    part.position.set(x - it.b.min.x, -it.b.min.y, z - it.b.min.z); g.add(part);
    x += it.w + gap; rowD = Math.max(rowD, it.d);
  }
  return g;
}
// изрязва сканирания терен около сградата (фотограметрия): махат се триъгълниците извън правоъгълника [x0, x1, z0, z1]
// (в координатите на модела, вписан в 15), а стърчащите им върхове се прибират до ръба. Геометрията се клонира — кешът остава цял
// обратното на cropLm: маха триъгълниците в правоъгълниците (в същите координати — моделът, сведен до 15 по по-дългата страна)
function cutLm(w, m, boxes) {
  w.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(w, true), s = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3()), k = 15 / Math.max(s.x, s.z), v = new THREE.Vector3();
  m.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(), p = g.attributes.position, M = o.matrixWorld, keep = [];
    for (let i = 0; i < p.count; i += 3) {
      let cx = 0, cz = 0; for (let t = 0; t < 3; t++) { v.fromBufferAttribute(p, i + t).applyMatrix4(M); cx += (v.x - c.x) * k / 3; cz += (v.z - c.z) * k / 3; }
      if (!boxes.some(([x0, x1, z0, z1]) => cx >= x0 && cx <= x1 && cz >= z0 && cz <= z1)) keep.push(i);
    }
    const ng = new THREE.BufferGeometry();
    for (const [n, at] of Object.entries(g.attributes)) { const a = new at.array.constructor(keep.length * 3 * at.itemSize); keep.forEach((i, j) => a.set(at.array.subarray(i * at.itemSize, (i + 3) * at.itemSize), j * 3 * at.itemSize)); ng.setAttribute(n, new THREE.BufferAttribute(a, at.itemSize, at.normalized)); }
    o.geometry = ng;
  });
}
function cropLm(w, m, [x0, x1, z0, z1]) {
  w.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(w, true), s = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3()), k = 15 / Math.max(s.x, s.z);
  const v = new THREE.Vector3(), cl = (a, lo, hi) => Math.max(lo, Math.min(hi, a));
  m.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(), p = g.attributes.position, M = o.matrixWorld, Mi = M.clone().invert(), keep = [];
    for (let i = 0; i < p.count; i += 3) {
      let cx = 0, cz = 0; for (let t = 0; t < 3; t++) { v.fromBufferAttribute(p, i + t).applyMatrix4(M); cx += (v.x - c.x) * k / 3; cz += (v.z - c.z) * k / 3; }
      if (cx >= x0 && cx <= x1 && cz >= z0 && cz <= z1) keep.push(i);
    }
    for (const i of keep) for (let t = 0; t < 3; t++) { v.fromBufferAttribute(p, i + t).applyMatrix4(M); v.x = cl((v.x - c.x) * k, x0, x1) / k + c.x; v.z = cl((v.z - c.z) * k, z0, z1) / k + c.z; v.applyMatrix4(Mi); p.setXYZ(i + t, v.x, v.y, v.z); }
    const ng = new THREE.BufferGeometry();
    for (const [n, at] of Object.entries(g.attributes)) { const a = new at.array.constructor(keep.length * 3 * at.itemSize); keep.forEach((i, j) => a.set(at.array.subarray(i * at.itemSize, (i + 3) * at.itemSize), j * 3 * at.itemSize)); ng.setAttribute(n, new THREE.BufferAttribute(a, at.itemSize, at.normalized)); }
    o.geometry = ng;
  });
}
// размерът на забележителност от модел (GLB_LM.fit — основата ѝ след зареждането); null за процедурните (те са готови веднага)
export const hasLandmark = kind => !!BUILD[kind];   // има ли модел (иначе buildLandmark дава Галата)
export const lmFit = kind => (GLB_LM[kind] && GLB_LM[kind].fit) || null;
export const lmH = kind => (GLB_LM[kind] && GLB_LM[kind].h) || null;   // височината на модела (след зареждането)
function glbLm(kind) {
  const C = GLB_LM[kind], g = new THREE.Group(), flood = [];
  const plate = box(g, 15, 0.3, 15, mat(C.plate ?? 0x9a9a92, 0.95), 0, 0.15, 0);
  const ph = add(g, new THREE.BoxGeometry(4, C.h, 4), mat(0x9aa4ae, 0.8, 0, { transparent: true, opacity: 0.25 }), 0, C.h / 2, 0);   // докато се зарежда
  g.userData.flood = flood;
  loadLm(kind).then(src => {
    g.remove(ph); if (!src) return;
    const m = C.grid ? gridOf(src) : src.clone(true), w = new THREE.Group(); w.add(m); if (C.rx) m.rotation.x = C.rx; if (C.ry) m.rotation.y = C.ry;
    if (C.crop) cropLm(w, m, C.crop);
    if (C.cut) cutLm(w, m, C.cut);
    const b = new THREE.Box3().setFromObject(w, !!(C.ry || C.crop)), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    const k = Math.min(C.h / s.y, C.fit / Math.max(s.x, s.z));
    const y0 = feature('lm-ground') && !plate.visible ? 0 : 0.3;   // lm-ground: на истинската карта плочата е скрита (landmarkPlan2) — моделът стъпва на земята, не на 0,3 над нея (×мащаба: Капитолият висеше на ~3 м и сянката се отделяше от основата)
    m.position.set(-c.x, -b.min.y, -c.z); w.scale.setScalar(k); w.position.y = y0 - (C.sink || 0) * s.y * k; w.position.z = C.dz || 0; if (C.sy) w.scale.y *= C.sy;   // sy — по-стръмно (ниските модели от Meshy)
    w.traverse(o => {
      if (!o.isMesh) return; o.castShadow = o.receiveShadow = true;
      if (C.matte && o.material) { o.material = o.material.clone(); o.material.color.set(C.matte); o.material.metalness = 0; o.material.roughness = 0.8; o.material.metalnessMap = o.material.roughnessMap = o.material.map = null; o.material.needsUpdate = true; }   // светла фасада (Белият дом): текстурата е тъмна — само бял цвят + релефът (normalMap)
      if (C.flat && o.material) { o.material = o.material.clone(); o.material.flatShading = true; o.material.vertexColors = !!o.geometry.attributes.color; o.material.needsUpdate = true; }   // плоско осветени стени (без нормали от модела)
      const mt = o.material; if (mt && mt.metalness > 0.4) { mt.metalness = 0.25; mt.roughness = Math.max(mt.roughness ?? 0.5, 0.45); }   // без огледална среда металът излиза черен
      if (mt && mt.emissive && !mt.emissiveMap && !flood.includes(mt)) { mt.emissive.set(0xffe4b8); if (mt.map) { mt.emissiveMap = mt.map; mt.needsUpdate = true; } mt.emissiveIntensity = 0; if (C.floodK) mt.userData.floodK = C.floodK; flood.push(mt); }   // прожектори: светва текстурата, не плосък бежов цвят
    });
    if (C.base) box(g, s.x * k + 0.6, 0.35, s.z * k + 0.6, mat(C.base, 0.9), 0, y0 + 0.175, C.dz || 0);   // каменна основа — назъбените краища на скана се сливат с нея
    g.add(w);
    if (C.onLoad) C.onLoad(w, g);
    if (g.userData.sign) g.userData.sign.position.y = s.y * k + 4;
  });
  return g;
}
function pyramids() {   // Гиза: Хеопс, Хефрен (с бялата облицовка на върха), Микерин, три малки „на царици“ и Сфинксът
  const g = new THREE.Group(), sand = mat(0xe2c487, 1), st = mat(0xd4b06a, 0.95, 0, { emissive: 0xffb860, emissiveIntensity: 0 }), cap = mat(0xf1e6cc, 0.8, 0, { emissive: 0xffd9a0, emissiveIntensity: 0 });
  box(g, 15, 0.3, 15, sand, 0, 0.15, 0);
  const pyr = (s, h, x, z, m = st) => { const o = add(g, new THREE.ConeGeometry(s * Math.SQRT1_2, h, 4, 1), m, x, 0.3 + h / 2, z); o.rotation.y = Math.PI / 4; return o; };
  pyr(6.2, 5.6, -3.2, -2.6);                     // Хеопс
  pyr(5.6, 5.3, 2.4, 0.6);                       // Хефрен
  const tip = add(g, new THREE.ConeGeometry(1.1 * Math.SQRT1_2, 1.05, 4, 1), cap, 2.4, 0.3 + 5.3 - 0.52, 0.6); tip.rotation.y = Math.PI / 4;
  pyr(3, 2.8, 5.2, 4.8);                         // Микерин
  for (let k = 0; k < 3; k++) pyr(1.2, 1.1, 2.6 + k * 1.6, 6.6);   // пирамидите на цариците
  // Сфинксът: тяло, лапи и глава, гледа на изток
  const sph = new THREE.Group(); sph.position.set(-4.6, 0.3, 4.4); sph.rotation.y = -Math.PI / 2; g.add(sph);
  box(sph, 1.1, 0.9, 3, st, 0, 0.45, 0); box(sph, 1.1, 0.35, 1.2, st, 0, 0.18, 2); box(sph, 0.8, 0.9, 0.8, st, 0, 1.2, 1.2); box(sph, 1.2, 0.7, 0.3, st, 0, 1.25, 0.95);
  // пясъчни дюни и палми покрай
  for (const [x, z, r] of [[-6, 6.3, 1.1], [6.3, -5.8, 1.3], [-6.4, -6.4, 0.9]]) { const d = add(g, new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), sand, x, 0.3, z); d.scale.y = 0.35; }
  [[6.4, -1.8], [6.6, -3], [-6.6, 1.6]].forEach(([x, z], i) => { const rt = realTree(null, 3.2, i); if (rt) { rt.position.set(x, 0.3, z); g.add(rt); return; } add(g, new THREE.CylinderGeometry(0.08, 0.12, 2.2, 5), mat(0x7a5c3e), x, 1.4, z); for (let k = 0; k < 5; k++) { const l = add(g, new THREE.ConeGeometry(0.25, 1.4, 4), mat(0x3f8f3a), x, 2.5, z); l.rotation.z = 1.2; l.rotation.y = k * 1.26; l.position.x += Math.cos(k * 1.26) * 0.5; l.position.z -= Math.sin(k * 1.26) * 0.5; } });
  g.userData.flood = [st, cap];
  return g;
}

// Айфеловата кула нощем: златно осветление + хиляди проблясващи светлинки (като всеки час в Париж) и прожектор на върха
// Петронас нощем: кулите светят сребристо-бели (прожекторите — floodK), а на двата шпила мигат червени светлини за самолетите
const _ws = new THREE.Vector3();
// Уилис тауър нощем (night-willis): двете антени — червени светлини за самолетите на върха и по средата, мигат на смени
// 🌃 Бурж Халифа нощем (флаг night-burj2): LED лентите по ръбовете на крилата, които следват стъпалата, пръстени-подсветки при основата и на всяко
// стъпало, червена светлина и ореол на върха — изпечени в Блендър от профила на модела (_source/burj_lights.py → assets/heavy/lm/burj-lights.glb,
// в координатите на burj.glb). Светлината: по лентите се катерят светли „вълни“, цветът бавно прелива синьо ↔ златно (като шоуто на фасадата).
// 🌙 Филаделфия: кметството нощем (флаг night-cityhall). Моделът е с цветове по върховете и без текстура — общото осветяване на забележителностите
// (flood: еднакъв кремав emissive) го правеше плоско бяло. Тук: прожектори отдолу (по-силни долу и по лицата нагоре — релефът личи), бавно
// въртящо се „махало“ на светлината, топли прозорци в тъмните ниши (някои угасват/светват), светещ връх на кулата.
function cityhallNight(w, g) {
  w.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(w), c = b.getCenter(new THREE.Vector3());
  const U = { uN: { value: 0 }, uT: { value: 0 }, uY0: { value: b.min.y }, uY1: { value: b.max.y }, uC: { value: new THREE.Vector2(c.x, c.z) }, uCell: { value: (b.max.y - b.min.y) / 60 } }, mats = new Set();
  w.traverse(o => { if (o.isMesh && o.material) mats.add(o.material); });
  const fl = g.userData.flood || []; for (const m of mats) { const i = fl.indexOf(m); if (i >= 0) fl.splice(i, 1);   // без общия flood
    m.emissive.set(0xffffff); m.emissiveIntensity = 1; m.emissiveMap = null;
    m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vChP; varying vec3 vChN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvChP = (modelMatrix * vec4(transformed, 1.0)).xyz; vChN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vChP; varying vec3 vChN; uniform float uN; uniform float uT; uniform float uY0; uniform float uY1; uniform vec2 uC; uniform float uCell;\nfloat chH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }')
        .replace('#include <emissivemap_fragment>', `
          float h = clamp((vChP.y - uY0) / max(uY1 - uY0, 0.01), 0.0, 1.0), lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
          vec3 n = normalize(vChN); float ang = atan(vChP.z - uC.y, vChP.x - uC.x);
          float sweep = 0.55 + 0.45 * sin(uT * 0.35 + ang * 2.0);   // светлината бавно обикаля сградата
          float flood = (1.0 - 0.75 * h) * (0.8 + 0.2 * clamp(0.5 + n.y, 0.0, 1.0)) * sweep;   // отдолу — по-силно; ръбовете и корнизите (нагоре) — по-светли
          vec3 e = diffuseColor.rgb * vec3(1.0, 0.78, 0.5) * flood * 0.32;
          float dk = smoothstep(0.42, 0.22, lum) * step(0.04, h) * step(h, 0.72) * step(abs(n.y), 0.35);   // тъмните ниши по стените — прозорците
          vec2 cell = floor(vec2(dot(vChP.xz - uC, vec2(-n.z, n.x)), vChP.y) / uCell); float r = chH(cell), r2 = chH(cell + floor(uT / 9.0 + r * 7.0));
          e += vec3(1.0, 0.72, 0.38) * dk * step(r2, 0.5) * (0.18 + 0.14 * r);   /* слабо — цветовете на модела са на петна, силните „прозорци“ ставаха шарка */
          e += vec3(1.0, 0.9, 0.7) * smoothstep(0.82, 0.95, h) * (0.5 + 0.15 * sin(uT * 1.3));   // върхът на кулата свети
          totalEmissiveRadiance = e * uN;`);
    }; m.customProgramCacheKey = () => 'cityhall-night'; m.needsUpdate = true; }
  const prev = g.userData.sparkle;
  let mk = '';   // lm-fit-sq (55) мащабира/мести забележителността след зареждането — височината и центърът се смятат наново, щом матрицата се смени
  g.userData.sparkle = (t, night) => { if (prev) prev(t, night); U.uT.value = t; U.uN.value = night;
    if (night > 0) { w.updateMatrixWorld(); const e = w.matrixWorld.elements, k = e[0].toFixed(4) + e[5].toFixed(4) + e[12].toFixed(2) + e[13].toFixed(2) + e[14].toFixed(2);
      if (k !== mk) { mk = k; b.setFromObject(w); b.getCenter(c); U.uY0.value = b.min.y; U.uY1.value = b.max.y; U.uC.value.set(c.x, c.z); U.uCell.value = (b.max.y - b.min.y) / 60; } } };
}
// 🎰 „Welcome to Fabulous Las Vegas“ нощем (флаг night-vegas2): общото осветяване (кремав emissive) затриваше цветовете на табелата —
// тук всеки материал свети със своя цвят: крушките (жълтите) — бягаща вълна около табелата, буквите — бяло и червено, звездата мига; меко сияние на земята
function vegasSignNight(w, g) {
  const fl = g.userData.flood || [], U = { uT: { value: 0 }, uN: { value: 0 } }, by = {};
  w.traverse(o => { if (!o.isMesh || !o.material) return; const m = o.material, i = fl.indexOf(m); if (i >= 0) fl.splice(i, 1); by[m.name] = by[m.name] || []; by[m.name].push(o); });
  const glow = (nm, col) => (by[nm] || []).forEach(o => { o.material.emissive.set(col); o.material.emissiveMap = null; o.material.emissiveIntensity = 0; o.material.needsUpdate = true; });
  glow('Material.011', 0xffffff); glow('Material.002', 0xff2a1a); glow('Material.007', 0x1a2a9a); glow('Material', 0xffc040);
  for (const o of by['Material.006'] || []) {   // крушките — бягаща светлина по ъгъла около средата на табелата
    o.geometry.computeBoundingBox(); const c = o.geometry.boundingBox.getCenter(new THREE.Vector3()), m = o.material; m.emissive.set(0xffe27a); m.emissiveIntensity = 1;
    m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U); sh.uniforms.uCc = { value: new THREE.Vector2(c.x, c.z) };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vVsP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvVsP = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vVsP; uniform float uT; uniform float uN; uniform vec2 uCc;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat vsA = atan(vVsP.z - uCc.y, vVsP.x - uCc.x) / 6.2832; float vsOn = 0.25 + 0.75 * step(0.5, fract(vsA * 14.0 - uT * 1.6));\ntotalEmissiveRadiance *= vsOn * uN * 1.6;'); };
    m.customProgramCacheKey = () => 'vegas-bulbs'; m.needsUpdate = true; }
  const b = new THREE.Box3().setFromObject(w), sz = b.getSize(new THREE.Vector3()), gc = document.createElement('canvas'); gc.width = gc.height = 64;
  { const x = gc.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,200,120,1)'); gr.addColorStop(1, 'rgba(255,120,60,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); }
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.36, w.position.z || 0); pool.scale.set(Math.max(sz.x, sz.z) * 1.4, Math.max(sz.x, sz.z) * 1.1, 1); g.add(pool);
  const prev = g.userData.sparkle;
  g.userData.sparkle = (t, night) => { if (prev) prev(t, night); U.uT.value = t; U.uN.value = night;
    for (const nm of ['Material.011', 'Material.002', 'Material.007']) for (const o of by[nm] || []) o.material.emissiveIntensity = night * (nm === 'Material.007' ? 0.6 : 1.3);
    const star = (t % 1.6) < 0.8; for (const o of by['Material'] || []) o.material.emissiveIntensity = night * (star ? 2.2 : 0.4);   // звездата
    pool.material.opacity = 0.55 * night; };
}
let burjLm = null;
function burjLights(w, g) {
  const m = w.children[0]; if (!m) return;
  const U = { uT: { value: 0 }, uN: { value: 0 } };
  const led = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT; uniform float uN; varying vec2 vUv;
      void main(){ float v = vUv.y, s = vUv.x;
        float wave = pow(fract(v * 2.2 - uT * 0.11 + s * 0.5), 8.0) + 0.6 * pow(fract(v * 5.0 - uT * 0.23 + s * 1.7), 14.0);   // светлите вълни се катерят нагоре
        float hue = 0.5 + 0.5 * sin(uT * 0.17 + v * 2.5);   // синьо ↔ златно, бавно
        vec3 c = mix(vec3(0.25, 0.55, 1.0), vec3(1.0, 0.72, 0.32), hue);
        gl_FragColor = vec4(c * (0.22 + 1.6 * wave) * (0.75 + 0.25 * v) * uN, 1.0); }` });
  const ring = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT; uniform float uN; varying vec2 vUv;
      void main(){ float k = pow(1.0 - vUv.y, 2.2);   // подсветка отдолу — избледнява нагоре
        vec3 c = mix(vec3(1.0, 0.86, 0.62), vec3(0.6, 0.75, 1.0), 0.5 + 0.5 * sin(uT * 0.17 + vUv.x * 3.0));
        gl_FragColor = vec4(c * k * 1.3 * uN, 1.0); }` });
  const red = new THREE.MeshBasicMaterial({ color: 0xff2020 }), gc = document.createElement('canvas'); gc.width = gc.height = 64;
  { const x = gc.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,240,220,0.5)'); gr.addColorStop(1, 'rgba(255,240,220,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  (burjLm || (burjLm = new GLTFLoader().loadAsync('assets/heavy/lm/burj-lights.glb').then(gl => gl.scene).catch(() => null))).then(src => {
    if (!src) return; const L = src.clone(true); let tip = null;
    L.traverse(o => { if (!o.isMesh) return; o.castShadow = o.receiveShadow = false; o.frustumCulled = false;
      o.material = /Led/.test(o.name) ? led : /Ring/.test(o.name) ? ring : red; if (/Tip/.test(o.name)) tip = o; });
    m.add(L);
    if (tip) { tip.geometry.computeBoundingBox(); const c = tip.geometry.boundingBox.getCenter(new THREE.Vector3()); glow.position.copy(c); m.add(glow); glow.userData.r = tip.geometry.boundingBox.getSize(new THREE.Vector3()).x; }
  });
  const prev = g.userData.sparkle;
  g.userData.sparkle = (t, night) => { if (prev) prev(t, night); U.uT.value = t; U.uN.value = night;
    const on = (t % 2) < 0.9; red.color.setRGB(on ? 1 : 0.15, on ? 0.12 : 0.02, on ? 0.12 : 0.02);   // авиационната светлина
    glow.material.opacity = night * (0.75 + 0.25 * Math.sin(t * 2.3)); if (glow.userData.r) glow.scale.setScalar(glow.userData.r * (on ? 9 : 6)); };
}
function willisLights(w, g) {
  w.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(w), H = b.max.y - b.min.y, v = new THREE.Vector3(), top = [];
  w.traverse(o => { if (!o.isMesh) return; const P = o.geometry.attributes.position; for (let i = 0; i < P.count; i += 2) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); if (v.y > b.min.y + H * 0.88) top.push(v.clone()); } });
  if (!top.length) return;
  const tb = new THREE.Box3().setFromPoints(top), alongX = tb.max.x - tb.min.x >= tb.max.z - tb.min.z, mid = tb.getCenter(new THREE.Vector3());
  const ants = [false, true].map(sd => { const h = top.filter(p => ((alongX ? p.x - mid.x : p.z - mid.z) > 0) === sd); return h.length ? new THREE.Box3().setFromPoints(h) : null; }).filter(Boolean);
  const ws = w.getWorldScale(new THREE.Vector3()).x || 1, loc = (x, y, z) => w.worldToLocal(new THREE.Vector3(x, y, z));
  const reds = [0, 1].map(() => mat(0x400000, 0.4, 0, { emissive: 0xff2020, emissiveIntensity: 0 }));
  ants.forEach(a => { const c = a.getCenter(new THREE.Vector3()), r = H * 0.0035 / ws;
    for (const [f, k] of [[1, 0], [0.55, 1]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(Math.max(r, 0.05), 8, 6), reds[k]); m.position.copy(loc(c.x, a.min.y + (a.max.y - a.min.y) * f + (f === 1 ? r * ws : 0), c.z)); w.add(m); } });
  const prev = g.userData.sparkle;
  g.userData.sparkle = (t, night) => { if (prev) prev(t, night); const on = Math.sin(t * 2.0) > 0.25; reds[0].emissiveIntensity = (on ? 2.6 : 0.12) * (0.2 + night); reds[1].emissiveIntensity = (!on ? 2.0 : 0.12) * (0.2 + night); };
}
function petronasLights(w, g) {
  // върховете — от самия меш (кутията на групата включва и други неща): върховете над 90% от височината, разделени на две по дългата ос
  w.updateMatrixWorld(true); let big = null; w.traverse(o => { if (o.isMesh && (!big || o.geometry.attributes.position.count > big.geometry.attributes.position.count)) big = o; });
  const b = new THREE.Box3().setFromObject(big || w), red = mat(0x400000, 0.4, 0, { emissive: 0xff2020, emissiveIntensity: 0 }), v = new THREE.Vector3(), top = [];
  if (big) { const P = big.geometry.attributes.position; for (let i = 0; i < P.count; i += 3) { v.fromBufferAttribute(P, i).applyMatrix4(big.matrixWorld); if (v.y > b.min.y + (b.max.y - b.min.y) * 0.9) top.push(v.clone()); } }
  const tb = new THREE.Box3().setFromPoints(top.length ? top : [b.min, b.max]), alongX = tb.max.x - tb.min.x >= tb.max.z - tb.min.z, mid = tb.getCenter(new THREE.Vector3());
  const half = s => top.filter(p => ((alongX ? p.x - mid.x : p.z - mid.z) > 0) === s), tips = [false, true].map(s => { const h = half(s); return h.length ? new THREE.Box3().setFromPoints(h).getCenter(new THREE.Vector3()) : mid.clone(); });
  // всичко се закача за модела (w) — в града моделът после се мащабира още, а светлините трябва да го следват
  const ws = w.getWorldScale(new THREE.Vector3()).x || 1, loc = (x, y, z) => w.worldToLocal(new THREE.Vector3(x, y, z));
  for (const t of tips) { const r = new THREE.Mesh(new THREE.SphereGeometry(0.35 / ws, 8, 6), red); r.position.copy(loc(t.x, b.max.y + 0.2, t.z)); w.add(r); }
  const prev = g.userData.sparkle;
  // Лабораторията → night-petronas2: нощем иглите блестят — бял ореол с четири лъча (като на снимките), леко трепти
  let glints = null;
  if (feature('night-petronas2')) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,248,230,0.7)'); gr.addColorStop(0.5, 'rgba(255,240,210,0.12)'); gr.addColorStop(1, 'rgba(255,240,210,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128); x.fillStyle = 'rgba(255,250,240,0.55)'; x.fillRect(0, 62, 128, 4); x.fillRect(62, 0, 4, 128);
    const sm = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
    glints = tips.map(t => { const s = new THREE.Sprite(sm); s.position.copy(loc(t.x, b.max.y - (b.max.y - b.min.y) * 0.06, t.z)); w.add(s); return s; });
  }
  g.userData.sparkle = (t, night) => { if (prev) prev(t, night); red.emissiveIntensity = (Math.sin(t * 2.2) > 0.2 ? 2.4 : 0.15) * (0.25 + night);
    if (glints) { const sw = w.getWorldScale(_ws).x || 1, H = (b.max.y - b.min.y) / ws * sw; glints.forEach((s, k) => { s.material.opacity = night * (0.85 + 0.15 * Math.sin(t * 3.1 + k * 2)); s.scale.setScalar(H * (0.12 + Math.sin(t * 1.7 + k) * 0.008) / sw); }); } };   // ореолът ~12% от височината на кулите
}
// Вашингтон: паметникът на Вашингтон (обелискът) на южната поляна пред Белия дом — бял мрамор, пирамидка на върха,
// червени светлини за самолетите и кръг от знамена около основата; нощем е осветен с прожектори като Белия дом
function whMonument(w, g) {
  const o = new THREE.Group(); o.position.set(0, 0.3, -6); g.add(o);   // южната поляна (моделът е обърнат — фасадата с колоните е към −z)
  const marble = mat(0xf1ede4, 0.75, 0, { emissive: 0xffe4b8, emissiveIntensity: 0 }); marble.userData.floodK = 2.6;
  cyl(o, 2.4, 2.6, 0.25, mat(0xcfc8b8, 0.9), 0, 0.12, 0, 24);   // кръглата площадка
  box(o, 1.5, 0.3, 1.5, marble, 0, 0.4, 0);
  const H = 9.5, shaft = add(o, new THREE.CylinderGeometry(0.36 * Math.SQRT2, 0.5 * Math.SQRT2, H, 4, 1), marble, 0, 0.55 + H / 2, 0); shaft.rotation.y = Math.PI / 4;
  const tip = add(o, new THREE.ConeGeometry(0.36 * Math.SQRT2, 1, 4, 1), marble, 0, 0.55 + H + 0.5, 0); tip.rotation.y = Math.PI / 4;
  const red = mat(0x400000, 0.4, 0, { emissive: 0xff2020, emissiveIntensity: 0 }), lights = [];
  for (const [x, z] of [[0.28, 0], [-0.28, 0], [0, 0.28], [0, -0.28]]) lights.push(add(o, new THREE.SphereGeometry(0.06, 6, 4), red, x, 0.55 + H - 0.35, z));
  const pole = mat(0xdddddd, 0.4, 0.4), stars = new THREE.MeshStandardMaterial({ color: 0x2b3a8a, side: THREE.DoubleSide }), stripes = new THREE.MeshStandardMaterial({ color: 0xc8102e, side: THREE.DoubleSide });
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = Math.cos(a) * 2.1, z = Math.sin(a) * 2.1; cyl(o, 0.03, 0.03, 1.8, pole, x, 1.1, z, 5); const f = add(o, new THREE.PlaneGeometry(0.5, 0.3), k % 2 ? stars : stripes, x + 0.25, 1.8, z); f.rotation.y = -a; }
  (g.userData.flood = g.userData.flood || []).push(marble);
  const prev = g.userData.sparkle;
  g.userData.sparkle = (t, night) => { if (prev) prev(t, night); red.emissiveIntensity = (Math.sin(t * 2.4) > 0.3 ? 2.2 : 0.15) * (0.25 + night); };
}
function eiffelLights(w, g) {
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), v = new THREE.Vector3(), pts = [], top = new THREE.Vector3(0, -1e9, 0);
  w.traverse(o => { if (!o.isMesh) return; const pa = o.geometry.attributes.position; for (let i = 0; i < pa.count; i += 37) { v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv); pts.push(v.x, v.y, v.z); if (v.y > top.y) top.copy(v); } });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const n = pts.length / 3, ph = new Float32Array(n).map(() => Math.random() * 100), col = new Float32Array(n * 3); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pm = new THREE.PointsMaterial({ size: 0.42, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const sp = new THREE.Points(geo, pm); g.add(sp);
  const beam = add(g, new THREE.CylinderGeometry(0.05, 0.6, 30, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 0, 0, 0);
  beam.geometry.translate(0, 15, 0); beam.rotation.z = Math.PI / 2 - 0.15; beam.position.copy(top); beam.castShadow = false;
  const pivot = new THREE.Group(); pivot.position.copy(top); g.add(pivot); g.remove(beam); beam.position.set(0, 0, 0); pivot.add(beam);
  w.traverse(o => { if (o.isMesh && o.material) { const m = o.material; m.emissive = new THREE.Color(0xffb347); if (m.map) m.emissiveMap = m.map; m.emissiveIntensity = 0; m.userData.floodK = 2.2; m.needsUpdate = true; (g.userData.flood = g.userData.flood || []).includes(m) || g.userData.flood.push(m); } });
  const prev = g.userData.sparkle;
  g.userData.sparkle = (t, night) => {
    prev && prev(t, night);
    sp.visible = beam.visible = night > 0.05;
    if (!sp.visible) return;
    const on = (t % 60) < 12;   // всяка минута игра — 12 s проблясване
    pm.opacity = night; for (let i = 0; i < n; i++) { const b = on ? (Math.sin(t * 17 + ph[i] * 7) > 0.6 ? 1 : 0.05) : 0.25; col[i * 3] = b; col[i * 3 + 1] = b * 0.92; col[i * 3 + 2] = b * 0.75; }
    geo.attributes.color.needsUpdate = true;
    beam.material.opacity = 0.35 * night; pivot.rotation.y = t * 0.8;
  };
}

// „Луксор“: най-силният прожектор на света — лъч от върха на пирамидата право в небето (само нощем)
// Островът Либърти (liberty2): основата на модела — на водната повърхност на картата; нощем прожектори само по пиедестала и статуята, пламъкът свети
function libertyIsland(w, g) {
  const fl = g.userData.flood || [], mats = {}; w.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m) mats[m.name] = m; });
  const isl = mats.island, mon = mats.monument, tor = mats.torch;
  for (const m of [isl, tor]) { const i = fl.indexOf(m); if (m && i >= 0) fl.splice(i, 1); }   // островът (трева, алеи, дървета) — тъмен; пламъкът — отделно
  if (isl) { isl.emissiveIntensity = 0; isl.emissiveMap = null; isl.emissive?.set(0x000000); isl.needsUpdate = true; }
  if (mon) mon.userData.floodK = 1.3;
  if (tor) { tor.emissive = new THREE.Color(0xffb347); tor.emissiveMap = tor.map || null; tor.emissiveIntensity = 0.3; tor.needsUpdate = true; }
  noFlood(g);   // играта (game.js floodMats на истинската карта) не осветява острова
  // пламъкът: върхът на модела + ореол нощем
  g.updateMatrixWorld(true);
  const top = new THREE.Vector3(0, -1e9, 0), v = new THREE.Vector3(), inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  w.traverse(o => { if (!o.isMesh) return; const pa = o.geometry.attributes.position; for (let i = 0; i < pa.count; i += 2) { v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); if (v.y > top.y) top.copy(v); } });
  top.applyMatrix4(inv);
  const gm = new THREE.MeshBasicMaterial({ color: 0xffc56a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = add(g, new THREE.SphereGeometry(0.45, 12, 8), gm, top.x, top.y - 0.25, top.z); glow.castShadow = false; glow.visible = false;
  // водата: основата на модела (локално y0 в групата) — на seaY в света на града; групата е мащабирана и вдигната от landmarkPlan2 (game.js)
  const base = w.position.y; let sy = 0, py = NaN;
  const sit = () => { if (g.scale.y === sy && g.position.y === py) return; sy = g.scale.y; py = g.position.y; w.position.y = base + (GLB_LM.liberty2.seaY - py) / (sy || 1); };
  const prev = g.userData.sparkle;
  g.userData.sparkle = (t, night) => { prev && prev(t, night); sit();
    if (tor) tor.emissiveIntensity = 0.3 + 2.4 * night * (0.93 + 0.07 * Math.sin(t * 9));
    glow.visible = night > 0.05; gm.opacity = 0.75 * night * (0.9 + 0.1 * Math.sin(t * 7)); };
  sit();
}
function luxorBeam(w, g) {
  g.updateMatrixWorld(true);
  const top = new THREE.Vector3(0, -1e9, 0), v = new THREE.Vector3(), inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  w.traverse(o => { if (!o.isMesh) return; const pa = o.geometry.attributes.position; for (let i = 0; i < pa.count; i += 3) { v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); if (v.y > top.y) top.copy(v); } });
  top.applyMatrix4(inv);
  const bm = new THREE.MeshBasicMaterial({ color: 0xfff6dc, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const beam = add(g, new THREE.CylinderGeometry(0.18, 0.5, 90, 10, 1, true), bm, top.x, top.y + 45, top.z);
  beam.castShadow = false; beam.visible = false;
  const prev = g.userData.sparkle;
  g.userData.sparkle = (t, night) => { prev && prev(t, night); beam.visible = night > 0.05; bm.opacity = 0.55 * night * (0.92 + 0.08 * Math.sin(t * 7)); };
}

// „Беладжо“: моделът отзад, отпред езерото с прочутите танцуващи фонтани (водни стълбове, които се вдигат на вълни; нощем светят)
function bellagio() {
  const g = glbLm('bellagio');
  const lake = add(g, new THREE.BoxGeometry(14.4, 0.12, 6.2), mat(0x2e7fb8, 0.15, 0.1, { emissive: 0x0a3a66, emissiveIntensity: 0 }), 0, 0.31, 3.9);
  box(g, 14.8, 0.4, 0.3, mat(0xe8dfcc, 0.8), 0, 0.35, 7.1);   // балюстрада покрай тротоара
  const wm = new THREE.MeshStandardMaterial({ color: 0xf2fbff, transparent: true, opacity: 0.75, roughness: 0.2, emissive: 0xcfe8ff, emissiveIntensity: 0 });
  const jets = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 25 - 0.5) * 2.2, x = Math.sin(a) * 6.2, z = 4.6 - Math.cos(a) * 1.6;   // дъга пред хотела
    const j = add(g, new THREE.ConeGeometry(0.16, 1, 6, 1, true), wm, x, 0.37, z); j.geometry.translate(0, 0.5, 0); j.position.y = 0.37;
    jets.push({ j, i });
  }
  g.userData.flood = g.userData.flood || [];
  const V2 = feature('night-vegas2');   // нощем: истински водни струи (адитивни, светят отдолу), мъгла отгоре, отблясък по водата
  let jetM = null, mistM = null, glowW = null;
  if (V2) { const c = document.createElement('canvas'); c.width = 32; c.height = 128; const x = c.getContext('2d');
    const gx = x.createLinearGradient(0, 0, 32, 0); gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(0.5, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gx; x.fillRect(0, 0, 32, 128);
    x.globalCompositeOperation = 'destination-in'; const gy = x.createLinearGradient(0, 0, 0, 128); gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.25, 'rgba(0,0,0,0.8)'); gy.addColorStop(1, 'rgba(0,0,0,1)'); x.fillStyle = gy; x.fillRect(0, 0, 32, 128);
    jetM = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: 0xdff2ff, transparent: true, depthWrite: false, opacity: 0.85 });
    const m = document.createElement('canvas'); m.width = m.height = 64; const y = m.getContext('2d'), gr = y.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); y.fillStyle = gr; y.fillRect(0, 0, 64, 64);
    mistM = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(m), color: 0xe8f6ff, transparent: true, depthWrite: false, opacity: 0.5 });
    glowW = add(g, new THREE.PlaneGeometry(14, 5.6), new THREE.MeshBasicMaterial({ map: mistM.map, color: 0x6fb8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }), 0, 0.39, 4.2); glowW.rotation.x = -Math.PI / 2;
    for (const J of jets) { J.j.visible = false; const s = new THREE.Sprite(jetM); s.center.set(0.5, 0); s.position.copy(J.j.position); g.add(s); J.s = s; const mi = new THREE.Sprite(mistM); g.add(mi); J.m = mi; } }
  g.userData.sparkle = (t, night) => {
    const show = Math.floor(t / 12) % 3, ph = t % 12;   // три „номера“, всеки по 12 s
    for (const J of jets) { const { j, i } = J;
      let h = show === 0 ? 2.5 + 2 * Math.sin(t * 2.2 - i * 0.45) : show === 1 ? (Math.abs(i - 12.5) < ph * 1.4 ? 5.5 - Math.abs(i - 12.5) * 0.25 : 0.2) : 1.5 + 4 * Math.max(0, Math.sin(t * 3 + (i % 2) * Math.PI));
      j.scale.set(1, Math.max(0.05, h), 1); j.visible = !V2 && h > 0.15;
      if (V2) { const on = h > 0.15, H = Math.max(0.05, h) * 1.25; J.s.visible = J.m.visible = on; if (on) { J.s.scale.set(0.22 + 0.03 * H, H, 1); J.m.position.set(J.j.position.x, 0.37 + H * 0.92, J.j.position.z); J.m.scale.setScalar(0.45 + H * 0.12); } }
    }
    if (V2) { jetM.blending = mistM.blending = night > 0.3 ? THREE.AdditiveBlending : THREE.NormalBlending; jetM.color.setRGB(0.75 + 0.25 * night, 0.88 + 0.12 * night, 1); jetM.opacity = 0.55 + 0.15 * night; mistM.opacity = 0.2 + 0.1 * night;   // нощем светят отдолу (бяло-синьо)
      let sum = 0; for (const J of jets) sum += J.j.scale.y; glowW.material.opacity = night * Math.min(0.45, sum / jets.length / 8); }
    wm.emissiveIntensity = 1.4 * night; lake.material.emissiveIntensity = 0.8 * night;
  };
  return g;
}
const BUILD = { pyramids, ...Object.fromEntries(Object.keys(GLB_LM).map(k => [k, () => glbLm(k)])), arc, ladefense, bigben, londoneye, towerbridge, shard, brandenburg, fernsehturm, reichstag, erasmus, cubes, markthal, derotterdam, euromast, canal: () => canal(0), canal2: () => canal(1), rijks, centraal, adam, windmill, bellagio, mosque2: () => mosque(1), bluemosque: () => mosque(0), topkapi, maiden, grandbazaar, haydarpasa, galata, sapphire, twist, twin, colosseum, stpeter, pantheon, vittoriano };
// 🎰 lv-hotels: хотелите на Стрипа, изрязани от сканирания „Las Vegas strip“ (Brian Trepanier, Sketchfab, CC-BY 4.0) — един GLB
// (assets/heavy/lm/lvstrip-hotels.glb), всеки хотел — възел с името си: в метри, земята на y = 0, центърът (0, 0), север = −z (като картата).
// Текстурата е изпечена (без нормали — плоско осветени стени, като сканът); нощем светва цялата фасада (flood, като другите забележителности)
let lvSrc = null;
function lvHotel(nm) {
  const g = new THREE.Group(), flood = []; g.userData.flood = flood;
  (lvSrc ||= new GLTFLoader().loadAsync('assets/heavy/lm/lvstrip-hotels.glb').then(gl => gl.scene).catch(() => null)).then(src => {
    const n = src && src.getObjectByName(nm); if (!n) return;
    const m = n.clone(true);
    m.traverse(o => { if (!o.isMesh) return; o.castShadow = o.receiveShadow = true; const mt = o.material = o.material.clone(); mt.flatShading = true; mt.metalness = 0; mt.roughness = 0.85; mt.color.setScalar(2);   /* сканът е тъмен (сенките и стъклата са в текстурата) — ×2, колкото светлите фасади наоколо */
      if (feature('lv-night') && mt.emissiveMap) { mt.emissive.set(0xffffff); mt.userData.floodK = 2.2; }   /* lv-night: нощната карта от GLB (night_<възел> — прозорците, короните, партерът) по нощната крива на flood */
      else { mt.emissive.set(0xffe4b8); mt.emissiveMap = mt.map; mt.userData.floodK = 1.4; }
      mt.emissiveIntensity = 0; mt.needsUpdate = true; flood.push(mt); });
    const top = new THREE.Box3().setFromObject(m).max.y; g.add(m);   // m още е без родител — кутията е в координатите на групата
    if (g.userData.sign) g.userData.sign.position.y = top + 6;
    if (feature('lv-night2')) lvNight2(nm, n, m, g);
  });
  return g;
}
// 🎰 lv-night2 (f9): нощта на хотелите от скана — всичко в метрите на възела (position · scale + translation; север = −z, групата е ×0,4 / ×0,7):
// Парис — Айфеловата кула в златно (решетката свети по текстурата, ребрата — златни линии, искри), балонът (неонови ивици) и подсветка отдолу по хотела;
// Планет Холивуд — ръбовете на V-кулата в преливащи цветове и LED екранът към Стрипа; Космополитън — сините ивици по кулите и светещата „шапка“
// над входа с екран над нея; Ария и Вдара — сребристи ръбове. Добавя се към emission на lv-night (f6) — не я заменя; яркостта — по night (плавно при залез)
const LV_TOWERS = {   // контурите на кулите отгоре (x, z, височина на покрива) — от скана (височинна карта по триъгълниците, опростена до ~1,5 м)
  planethollywood: [[[65,104,128],[50,97,128],[4,3,130],[50,-95,128],[61,-102,128],[70,-97,128],[74,-87,128],[56,-51,130],[60,-47,130],[52,-29,133],[34,-3,130],[34,5,130],[60,49,130],[58,57,130],[74,89,128]]],
  cosmopolitan: [[[143,1,182],[95,1,179],[90,-4,184],[90,-44,184],[145,-47,179],[148,-36,171]], [[15,41,187],[-45,41,192],[-105,17,190],[-149,15,191],[-150,-8,189],[-91,-13,191],[-43,7,190],[15,9,191]]],
  aria: [[[161,-84,188],[121,-84,190],[59,-108,188],[19,-108,190],[16,-133,188],[73,-138,190],[127,-116,186],[161,-116,189]], [[27,116,152],[18,99,152],[32,83,152],[40,65,152],[44,19,150],[65,-2,146],[70,19,155],[66,69,155],[50,107,155]],
    [[1,270,183],[-10,253,188],[-20,223,187],[-22,163,186],[-10,121,184],[7,112,178],[16,129,182],[6,153,185],[2,197,185],[6,223,185],[16,245,181],[10,261,188]]],
  vdara: [[[52,18,147],[20,2,147],[-8,0,147],[-18,-10,180],[-46,-2,180],[-65,-17,173],[-56,-24,173],[-24,-34,173],[28,-32,173],[38,-16,180],[57,-7,180],[53,3,180],[59,9,147]]],
  mgmgrand: [[[105,117,92],[84,114,93],[79,9,93],[-1,7,62],[-32,-6,53],[-13,-19,55],[63,-19,94],[76,-28,91],[82,-128,94],[89,-133,93],[108,-128,94],[108,-46,94],[117,-19,92],[220,-16,94],[215,5,90],[123,5,94],[108,14,93]],
    [[-40,4,42],[-153,4,42],[-153,-16,42],[-40,-16,42]]] };   // lv-night3: кулата-кръст на MGM (горе) и ниското западно крило
const LV_EDGE = { planethollywood: { base: 40 }, cosmopolitan: { col: 0x2f6bff, base: 45 }, aria: { col: 0xdfe9ff, base: 45 }, vdara: { col: 0xdfe9ff, base: 45 }, mgmgrand: { col: 0x2bff8a, base: 15 } };
const LV_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
function lvNight2(nm, node, m, g) {
  if ((nm === 'mgmgrand' || nm === 'nyny') && !feature('lv-night3')) return;   // lv-night3 (f9): нощта на MGM Grand и Ню Йорк-Ню Йорк (lv-hotels2)
  const U = { uT: { value: 0 }, uN: { value: 0 }, uSc: { value: node.scale.x }, uTr: { value: node.position.clone() } }, add = [];   // add — светлините, които гаснат денем
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const sprite = (col, x, y, z, sx, sy) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })); sp.position.set(x, y, z); sp.scale.set(sx, sy, 1); g.add(sp); add.push([sp.material, 1]); return sp; };
  // Парис: шейдърът на скана — решетката на кулата, балонът, подсветката (само за paris_mat)
  if (nm === 'paris') m.traverse(o => { if (!o.isMesh) return; const mt = o.material;
    mt.onBeforeCompile = sh => { Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uSc; uniform vec3 uTr; varying vec3 vLvP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLvP = position * uSc + uTr;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uT; uniform float uN; varying vec3 vLvP;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec3 lp = vLvP; float lum = dot(diffuseColor.rgb, vec3(0.333));
          vec2 de = lp.xz - vec2(-87.6, -33.4); float rc = 4.0 + 22.0 * exp(-(lp.y - 30.0) / 30.0);   // кулата — ромб с ребрата по осите (L1 радиус)
          float inT = step(29.0, lp.y) * (1.0 - smoothstep(rc * 1.08, rc * 1.3, abs(de.x) + abs(de.y)));
          float h = fract(sin(dot(floor(lp * 1.3), vec3(12.9898, 78.233, 37.719))) * 43758.5453), spk = step(0.975, fract(h * 7.0 + uT * 0.9)) * step(0.5, fract(uT / 20.0));   // искри — 10 с от всеки 20
          vec3 lv = inT * (vec3(1.0, 0.5, 0.08) * (0.35 + 1.5 * lum) + spk * vec3(1.0, 0.95, 0.85) * 5.0);
          vec3 db = lp - vec3(-125.5, 44.0, 88.0); float inB = 1.0 - smoothstep(12.8, 14.5, length(db));   // балонът
          vec3 bc = mix(vec3(1.0, 0.3, 0.65), vec3(0.35, 0.6, 1.0), 0.5 + 0.5 * sin(uT * 0.6 + atan(db.z, db.x) * 2.0));
          lv += inB * bc * (0.5 + lum) * (0.5 + 1.3 * pow(0.5 + 0.5 * sin(lp.y * 0.9 - uT * 2.2), 3.0));
          lv += (1.0 - inT) * (1.0 - inB) * vec3(1.0, 0.8, 0.55) * diffuseColor.rgb * pow(1.0 - clamp(lp.y / 125.0, 0.0, 1.0), 2.2) * 0.8;   // подсветка на хотела отдолу
          totalEmissiveRadiance = totalEmissiveRadiance * (1.0 - 0.75 * max(inT, inB) * uN) + lv * uN; }`); };   /* кулата и балонът — без бялото осветяване на фасадата (иначе златото избледнява) */
    mt.customProgramCacheKey = () => 'lv-night2-paris'; mt.needsUpdate = true; });
  if (nm === 'paris') {   // ребрата на кулата — златни линии (4 ребра по профила), прожекторът на върха, ореолът на балона
    const gold = new THREE.MeshBasicMaterial({ color: 0xffb648, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }); add.push([gold, 0.9]);
    for (let k = 0; k < 4; k++) { const a = 0.09 + k * Math.PI / 2, P = []; for (let y = 30; y <= 148; y += 6) { const r = 4 + 22 * Math.exp(-(y - 30) / 30) + 0.6; P.push(new THREE.Vector3(-87.6 + Math.cos(a) * r, y, -33.4 + Math.sin(a) * r)); }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(P), 40, 0.55, 4, false), gold)); }
    U.beacon = sprite(0xfff1c8, -87.6, 151, -33.4, 10, 14); sprite(0xff6fb0, -125.5, 44, 88, 34, 46);
  }
  // lv-night3: MGM — кулата-кръст свети в смарагдово зелено (стъклото по текстурата, вълна нагоре), подиумът — топло отдолу;
  // Ню Йорк-Ню Йорк — короната на „Емпайър“ сменя цветовете на 12 с (бяло-златно, червено-бяло-синьо, зелено, лилаво), шпилът на „Крайслер“ — бели шеврони
  const LV3 = { mgmgrand: `float inA = min(1.0, step(78.0, lp.x) * step(lp.x, 113.0) * step(-136.0, lp.z) * step(lp.z, 121.0) + step(-19.0, lp.z) * step(lp.z, 8.0) * step(-156.0, lp.x) * step(lp.x, 222.0)) * smoothstep(14.0, 20.0, lp.y);
          vec3 lv = inA * vec3(0.1, 1.0, 0.5) * (0.1 + 0.75 * lum) * (0.5 + 0.6 * lp.y / 94.0) * (0.75 + 0.25 * sin(lp.y * 0.12 - uT * 0.8));
          lv += (1.0 - inA) * vec3(1.0, 0.85, 0.6) * diffuseColor.rgb * pow(1.0 - clamp(lp.y / 40.0, 0.0, 1.0), 2.0) * 0.6; float cut = inA * 0.4;`,
    nyny: `vec2 de = abs(lp.xz - vec2(-55.5, 26.5)); float we = lp.y < 144.0 ? 16.5 : 6.0, inE = step(124.0, lp.y) * (1.0 - smoothstep(we, we + 1.5, max(de.x, de.y)));
          float th = mod(floor(uT / 12.0), 4.0), tr = mod(floor((lp.y - 124.0) / 5.0), 3.0);
          vec3 ec = th < 0.5 ? vec3(1.0, 0.86, 0.6) : th < 1.5 ? (tr < 0.5 ? vec3(1.0, 0.1, 0.1) : tr < 1.5 ? vec3(1.0) : vec3(0.15, 0.3, 1.0)) : th < 2.5 ? vec3(0.1, 1.0, 0.35) : mix(vec3(0.7, 0.2, 1.0), vec3(1.0, 0.4, 0.8), tr * 0.5);
          vec2 dc = abs(lp.xz - vec2(7.0, -89.0)); float hw = 12.5 - (lp.y - 104.0) * 0.27, inC = step(104.0, lp.y) * (1.0 - smoothstep(hw + 0.5, hw + 2.0, max(dc.x, dc.y)));
          float chev = step(fract((lp.y + 0.9 * min(dc.x, dc.y)) / 5.0), 0.3);   // шевроните — по лицата на шпила, към средата нагоре
          vec3 lv = inE * ec * (0.45 + 1.3 * lum) + inC * vec3(0.95, 0.95, 1.0) * (0.25 * lum + chev * (0.6 + 1.0 * lum));
          float inL = (1.0 - smoothstep(0.0, 3.0, max(max(75.0 - lp.x, lp.x - 95.0), max(60.0 - lp.z, lp.z - 78.0)))) * (1.0 - smoothstep(30.0, 38.0, lp.y));   // Статуята на свободата (по f6: ъгълът към Тропикана) — мек зелен прожектор отдолу
          lv += inL * vec3(0.3, 1.0, 0.75) * diffuseColor.rgb * (0.2 + 0.4 * (1.0 - clamp(lp.y / 38.0, 0.0, 1.0)));
          float cut = max(inE, inC); lv += (1.0 - cut) * vec3(1.0, 0.82, 0.6) * diffuseColor.rgb * pow(1.0 - clamp(lp.y / 60.0, 0.0, 1.0), 2.5) * 0.5;` };
  if (LV3[nm]) m.traverse(o => { if (!o.isMesh) return; const mt = o.material;
    mt.onBeforeCompile = sh => { Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uSc; uniform vec3 uTr; varying vec3 vLvP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLvP = position * uSc + uTr;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uT; uniform float uN; varying vec3 vLvP;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec3 lp = vLvP; float lum = dot(diffuseColor.rgb, vec3(0.333)); ${LV3[nm]}
          totalEmissiveRadiance = totalEmissiveRadiance * (1.0 - 0.6 * cut * uN) + lv * uN; }`); };
    mt.customProgramCacheKey = () => 'lv-night3-' + nm; mt.needsUpdate = true; });
  if (nm === 'nyny') { U.emp = sprite(0xffd9a0, -55.5, 140, 26.5, 44, 34); sprite(0xe8eeff, 7, 128, -89, 26, 40);   // ореолите над двете корони
    U.blink = [sprite(0xff2020, -55.5, 163.5, 26.5, 5, 5), sprite(0xff2020, 7, 149.5, -89, 5, 5)]; }   // червените светлини на върховете
  // ръбовете на кулите: светещи ивици по покрива и по ъглите (InstancedMesh от кутийки)
  const T = LV_TOWERS[nm], E = LV_EDGE[nm];
  if (T && E) { const L = []; for (const poly of T) for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length], o = poly[(i + poly.length - 1) % poly.length];
      const dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz), y = Math.min(p[2], q[2]) - 1; L.push([(p[0] + q[0]) / 2, y, (p[1] + q[1]) / 2, len + 1, 1.2, 1, Math.atan2(-dz, dx), y]);   // покривът
      const a1 = Math.atan2(p[1] - o[1], p[0] - o[0]), a2 = Math.atan2(dz, dx), turn = Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1)));
      if (turn > 0.5) L.push([p[0], (E.base + p[2]) / 2, p[1], 0.9, p[2] - E.base, 0.9, 0, p[2]]); }   // ъгъл (завой > 30°) — вертикална ивица
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }), L.length), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), c = new THREE.Color(E.col || 0xffffff);
    L.forEach((b, i) => { im.setMatrixAt(i, M4.compose(new THREE.Vector3(b[0], b[1], b[2]), Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b[6]), new THREE.Vector3(b[3], b[4], b[5]))); im.setColorAt(i, c); });
    im.frustumCulled = false; g.add(im); add.push([im.material, E.col === 0xdfe9ff ? 0.75 : 0.9]); U.edges = { im, L, chase: nm === 'planethollywood' };
    for (const poly of T) { const tp = poly.reduce((a, p) => p[2] > a[2] ? p : a); sprite(E.col || 0xd070ff, tp[0], tp[2] + 2, tp[1], 26, 18); }   // ореол над покрива
  }
  // LED екрани: Планет Холивуд — по фасадата на подиума към Стрипа (−x); Космополитън — „шапката“ над входа и екранът над нея (+x)
  const led = (pal) => new THREE.ShaderMaterial({ uniforms: { ...U, uPal: { value: pal } }, vertexShader: LV_VS, fragmentShader: `uniform float uT; uniform float uN; uniform float uPal; varying vec2 vUv;
    void main(){ vec2 uv = vUv; float seg = floor(uv.x * 4.0), ph = floor(uT / 5.0 + seg * 0.37);   // 4 панела, всеки сменя „рекламата“ на 5 с
      vec3 c1 = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + fract(ph * 0.618 + uPal)));
      float st = 0.5 + 0.5 * sin(uv.x * 22.0 + uv.y * 7.0 - uT * 3.0); vec2 q = fract(uv * vec2(4.0, 1.0)) - vec2(0.5 + 0.3 * sin(uT + seg), 0.5 + 0.3 * cos(uT * 1.3 + seg));
      vec3 c = c1 * (0.35 + 0.45 * st) + smoothstep(0.3, 0.0, length(q * vec2(1.0, 0.6))) * vec3(1.0);
      float pix = step(0.18, fract(uv.x * 260.0)) * step(0.18, fract(uv.y * 64.0)); c *= (1.0 - step(0.985, fract(uv.x * 4.0))) * (0.65 + 0.35 * pix);
      gl_FragColor = vec4(c * (0.35 + 0.95 * uN), 1.0); }` });   // денем — по-слабо (екраните светят и денем)
  if (nm === 'planethollywood') { const sc = new THREE.Mesh(new THREE.PlaneGeometry(80, 19), led(0.0)); sc.position.set(-86.2, 22.5, 12); sc.rotation.y = -Math.PI / 2; g.add(sc); sprite(0xb060ff, -92, 20, 12, 90, 30); }
  if (nm === 'cosmopolitan') { const hat = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 46), led(0.55)); hat.position.set(162, 13, 32); g.add(hat);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(58, 13), led(0.3)); sc.position.set(167.6, 23.5, 32); sc.rotation.y = Math.PI / 2; g.add(sc); sprite(0xff5fd0, 172, 12, 32, 60, 22); }
  if (nm === 'mgmgrand') { const py = new THREE.Mesh(new THREE.BoxGeometry(12.2, 40, 7), led(0.12)); py.position.set(-177.3, 52, 45.6); g.add(py); sprite(0x40ffa0, -177.3, 52, 45.6, 30, 56); }   // lv-night3: пилонът-екран на ъгъла
  const prev = g.userData.sparkle, hc = new THREE.Color();
  g.userData.sparkle = (t, night) => { if (prev) prev(t, night); U.uT.value = t; U.uN.value = night;
    for (const [mt, k] of add) mt.opacity = k * night;
    if (U.beacon) U.beacon.material.opacity = night * (0.6 + 0.4 * Math.sin(t * 2.5));
    if (U.blink) for (const b of U.blink) b.material.opacity = night * (Math.sin(t * 3) > 0.4 ? 1 : 0.1);
    if (U.emp) U.emp.material.color.setHex([0xffd9a0, 0xff9aa8, 0x40ff80, 0xc060ff][Math.floor(t / 12) % 4]);   // ореолът — в цвета на короната
    const e = U.edges; if (e && e.chase && night > 0.01) { e.L.forEach((b, i) => e.im.setColorAt(i, hc.setHSL((0.75 + 0.12 * Math.sin(t * 0.7 - b[7] * 0.02 - i * 0.35)) % 1, 1, 0.55))); e.im.instanceColor.needsUpdate = true; } };   // V-кулата: лилаво ↔ розово ↔ синьо, вълна по ъглите
}
Object.assign(BUILD, { lvparis: () => lvHotel('paris'), lvph: () => lvHotel('planethollywood'), lvcosmo: () => lvHotel('cosmopolitan'), lvaria: () => lvHotel('aria'), lvvdara: () => lvHotel('vdara') });
Object.assign(LANDMARK_NM, { lvparis: 'Парис Лас Вегас', lvph: 'Планет Холивуд', lvcosmo: 'Космополитън', lvaria: 'Ария', lvvdara: 'Вдара' });
// 🎰 lv-hotels2: от същия скан — MGM Grand (зелената кула-кръст, казиното и входът на ъгъла с Тропикана) и Ню Йорк-Ню Йорк (небостъргачите,
// Статуята на свободата, Бруклинският мост, влакчето) — възлите mgmgrand и nyny в lvstrip-hotels.glb (с нощните карти като другите)
Object.assign(BUILD, { lvmgm: () => lvHotel('mgmgrand'), lvnyny: () => lvHotel('nyny') });
Object.assign(LANDMARK_NM, { lvmgm: 'Ем Джи Ем Гранд', lvnyny: 'Ню Йорк-Ню Йорк' });
// 🇺🇸 Вашингтон по истинската карта (washington-osm): Монументът на Вашингтон, Мемориалите на Линкълн и Джеферсън — процедурни, в истински метри
// (game.js ги свежда до мащаба на картата по LM_REAL_H, както другите); без квадратната плоча — стоят на Мола
function wmonument() {   // обелискът: 169 м, основа 16,8 м → 10,5 м под пирамидката; долната трета (до 46 м) — по-светъл мрамор (строежът спрял 1854–1879); кръг от 50 знамена
  const g = new THREE.Group(), m1 = mat(0xf3efe6, 0.7, 0, { emissive: 0xffe9c8, emissiveIntensity: 0 }), m2 = mat(0xe6dfd0, 0.72, 0, { emissive: 0xffe9c8, emissiveIntensity: 0 });
  m1.userData.floodK = m2.userData.floodK = 2.2;
  cyl(g, 30, 31, 0.5, mat(0xd9d3c4, 0.95), 0, 0.25, 0, 40);   // кръглата площадка
  const S2 = Math.SQRT2 / 2, sq = (rb, rt, h, m, y) => { const o = add(g, new THREE.CylinderGeometry(rt * S2, rb * S2, h, 4, 1), m, 0, y + h / 2, 0); o.rotation.y = Math.PI / 4; return o; };
  const w = y => 16.8 - (16.8 - 10.5) * y / 152;   // страната на шахтата на височина y
  box(g, 20, 1.2, 20, m2, 0, 1.1, 0);
  sq(w(0), w(46), 46, m1, 1.7); sq(w(46), w(152), 106, m2, 47.7); sq(10.5, 0.3, 17, m2, 153.7);   // шахтата на две части + пирамидката
  const red = mat(0x400000, 0.4, 0, { emissive: 0xff2020, emissiveIntensity: 0 });
  for (const [x, z] of [[5.6, 0], [-5.6, 0], [0, 5.6], [0, -5.6]]) add(g, new THREE.SphereGeometry(0.5, 6, 4), red, x, 152, z);
  const pole = mat(0xdddddd, 0.4, 0.4), stars = new THREE.MeshStandardMaterial({ color: 0x2b3a8a, side: THREE.DoubleSide }), stripes = new THREE.MeshStandardMaterial({ color: 0xc8102e, side: THREE.DoubleSide });
  for (let k = 0; k < 50; k++) { const a = k / 50 * Math.PI * 2, x = Math.cos(a) * 25, z = Math.sin(a) * 25; cyl(g, 0.12, 0.12, 9, pole, x, 4.95, z, 5); const f = add(g, new THREE.PlaneGeometry(2.4, 1.5), k % 2 ? stars : stripes, x - Math.sin(a) * 1.2, 8.5, z + Math.cos(a) * 1.2); f.rotation.y = -a + Math.PI / 2; }
  g.userData.flood = [m1, m2]; noFlood(g);
  g.userData.sparkle = (t, night) => { red.emissiveIntensity = (Math.sin(t * 2.4) > 0.3 ? 2.2 : 0.15) * (0.25 + night); };
  return g;
}
function lincoln() {   // гръцки храм: 58 × 36 м, 36 дорийски колони (по една за щат), атик; лицето (стълбите) — към +z, отвътре — седящият Линкълн
  const g = new THREE.Group(), mb = mat(0xf2eee6, 0.75, 0, { emissive: 0xffe9c8, emissiveIntensity: 0 }), st = mat(0xd8d2c4, 0.9), dark = mat(0x3a3832, 0.9);
  mb.userData.floodK = 2;
  box(g, 64, 3, 44, st, 0, 1.5, -2);   // терасата
  for (let k = 0; k < 8; k++) box(g, 34 - k * 0.5, 3 - k * 0.375, 1.6, st, 0, (3 - k * 0.375) / 2, 20 + k * 1.6);   // широките стълби към Мола
  box(g, 58, 1.8, 36, mb, 0, 3.9, 0);   // стилобатът
  box(g, 46, 13.4, 24, mb, 0, 4.8 + 6.7, 0); box(g, 14, 10, 0.3, dark, 0, 4.8 + 5, 12.05);   // целата и тъмният вход между колоните
  box(g, 3.2, 3.4, 3, mb, 0, 6.5, 9.5); box(g, 3, 2.6, 2.4, mb, 0, 9.4, 9.2);   // седящият Линкълн (5,8 м)
  const cols = []; for (let i = 0; i < 12; i++) { const x = -26.5 + i * 53 / 11; cols.push([x, -16], [x, 16]); } for (let j = 1; j < 7; j++) { const z = -16 + j * 32 / 7; cols.push([-26.5, z], [26.5, z]); }
  for (const [x, z] of cols) cyl(g, 1.0, 1.13, 13.4, mb, x, 4.8 + 6.7, z, 10);
  box(g, 58.6, 3.4, 36.6, mb, 0, 18.2 + 1.7, 0);   // антаблементът (фризът с имената на щатите)
  box(g, 52, 1, 30, st, 0, 22.1, 0); box(g, 50, 2.6, 28, mb, 0, 23.9, 0);   // атикът
  g.userData.flood = [mb]; noFlood(g);
  return g;
}
function jefferson() {   // ротонда с 26 йонийски колони и плитък купол (39 м), портик с фронтон към +z (Тайдъл Бейсън и Белия дом)
  const g = new THREE.Group(), mb = mat(0xf2eee6, 0.72, 0, { emissive: 0xffe9c8, emissiveIntensity: 0 }), st = mat(0xd8d2c4, 0.9);
  mb.userData.floodK = 2;
  cyl(g, 42, 43, 1.5, st, 0, 0.75, 0, 48); cyl(g, 30, 32, 2.5, mb, 0, 2.75, 0, 48);   // терасата и стъпалата
  cyl(g, 19, 19, 14, mb, 0, 4 + 7, 0, 40);   // вътрешният барабан
  for (let k = 0; k < 26; k++) { const a = k / 26 * Math.PI * 2; cyl(g, 0.8, 0.9, 12.7, mb, Math.sin(a) * 25, 4 + 6.35, Math.cos(a) * 25, 10); }
  cyl(g, 26.5, 26.5, 3, mb, 0, 16.7 + 1.5, 0, 48); cyl(g, 24, 25, 3, mb, 0, 21.2, 0, 48);   // антаблементът и атикът
  const d = add(g, new THREE.SphereGeometry(22.5, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), mb, 0, 22.7, 0); d.scale.y = 0.72;   // куполът (връх ~39 м)
  for (let k = 0; k < 8; k++) cyl(g, 0.8, 0.9, 12.7, mb, -11.6 + k * 23.2 / 7, 4 + 6.35, 36, 10);   // портикът
  for (const sx of [-1, 1]) for (let r = 1; r < 3; r++) cyl(g, 0.8, 0.9, 12.7, mb, sx * 11.6, 4 + 6.35, 36 - r * 4.5, 10);
  box(g, 26, 2.5, 13, mb, 0, 4 + 1.25 - 2.5, 32); box(g, 27, 3, 14, mb, 0, 16.7 + 1.5, 31);
  const tri = new THREE.Shape(); tri.moveTo(-13.5, 0); tri.lineTo(13.5, 0); tri.lineTo(0, 5.5); tri.closePath();
  const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 14, bevelEnabled: false }), mb); ped.position.set(0, 19.7, 24); ped.castShadow = true; g.add(ped);
  for (let k = 0; k < 10; k++) box(g, 26 - k * 0.3, 2.5 - k * 0.25, 1.2, st, 0, (2.5 - k * 0.25) / 2, 38.6 + k * 1.2);   // стълбите към водата
  g.userData.flood = [mb]; noFlood(g);
  return g;
}
// нощем в града (cityplan2-3d floodMats) светват само мраморите — не площадката, стъпалата и знамената
function noFlood(g) { const keep = new Set(g.userData.flood); g.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m && !keep.has(m)) m.userData.flood = 1; }); }
Object.assign(BUILD, { wmonument, lincoln, jefferson });
Object.assign(LANDMARK_NM, { capitol2: 'Капитолият', whitehouse2: 'Белият дом', wmonument: 'Монументът на Вашингтон', lincoln: 'Мемориалът на Линкълн', jefferson: 'Мемориалът на Джеферсън' });

// trees-more: истинско дърво (протото от играта — deps.trees) с височина h вместо зелен конус; null — няма модели или флагът е изключен
let lmTrees = () => null; export const setLmTrees = f => { lmTrees = f; };   // game.js: истинските дървета на града (plan2Trees — в пустинните палми)
const realTree = (deps, h, i) => { const T0 = (deps && deps.trees) || lmTrees(), T = feature('trees-more') && T0 && T0.length ? T0 : null; if (!T) return null;
  const P = T[i % T.length], o = P.clone(true), b = new THREE.Box3().setFromObject(P); o.scale.multiplyScalar(h / ((b.max.y - b.min.y) || 1)); o.rotation.y = i * 2.39; o.traverse(m => { if (m.isMesh) m.castShadow = true; }); return o; };
// остров в морето за забележителност (Статуята на свободата — на звездовидния Форт Ууд на остров Либърти)
export function buildSeaLandmark(kind, deps = {}) {
  if (kind === 'opera') return operaPoint(deps);
  const o = buildLandmark(kind, deps), g = new THREE.Group();
  const star = new THREE.Shape(), N = 11, R1 = 15, R0 = 10.5;
  for (let i = 0; i <= N * 2; i++) { const a = i / (N * 2) * Math.PI * 2, r = i % 2 ? R0 : R1, x = Math.cos(a) * r, y = Math.sin(a) * r; i ? star.lineTo(x, y) : star.moveTo(x, y); }
  const island = new THREE.Mesh(new THREE.CylinderGeometry(24, 27, 2.2, 40), mat(0x6f9a55, 1)); island.position.y = 0.4; island.receiveShadow = true; g.add(island);
  const shore = new THREE.Mesh(new THREE.CylinderGeometry(27.5, 28.5, 0.6, 40), mat(0xd9c99a, 1)); shore.position.y = -0.2; g.add(shore);
  const fort = new THREE.Mesh(new THREE.ExtrudeGeometry(star, { depth: 2.2, bevelEnabled: false }), mat(0xb8ab92, 0.95)); fort.rotation.x = -Math.PI / 2; fort.position.y = 1.5; fort.castShadow = fort.receiveShadow = true; g.add(fort);
  [[-18, 8], [-14, 14], [16, 10], [12, -17], [-17, -12]].forEach(([x, z], i) => { const rt = realTree(deps, 6.5, i); if (rt) { rt.position.set(x, 1.5, z); g.add(rt); return; } const t = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5, 7), mat(0x3f7f3a, 1)); t.position.set(x, 4, z); t.castShadow = true; g.add(t); });
  box(g, 3, 0.6, 14, mat(0x8d8a84, 0.9), 0, 0.9, 30);   // кей за фериботите
  if (o.group.children[0]) o.group.children[0].visible = false;   // без квадратната плоча
  o.group.position.y = 3.4; o.group.scale.setScalar(1.9); g.add(o.group);
  return { group: g, update: o.update };
}

// Сидни: операта на нос Бенелонг — гранитна площадка в залива, свързана с брега с широка крайбрежна алея; платната гледат към морето.
// Групата е обърната (rotation.y = π в game.js): локално −z е към брега, +z — към морето.
function operaPoint(deps) {
  const o = buildLandmark('opera', deps), g = new THREE.Group();
  const granite = mat(0xcbb79a, 0.95), wall = mat(0x9a8c78, 1), walk = mat(0xd8cdb8, 0.9);
  const plat = box(g, 70, 2.4, 58, granite, 0, 0.0, 6); plat.castShadow = false;   // площадката (~1 м над водата)
  box(g, 72, 1.6, 60, wall, 0, -0.9, 6);   // каменният бряг около нея
  box(g, 34, 2.3, 70, walk, 0, -0.05, -55).castShadow = false;   // алеята към брега (Circular Quay)
  box(g, 36, 1.6, 72, wall, 0, -0.9, -55);
  const stairs = box(g, 44, 0.8, 10, mat(0xe2d8c4, 0.9), 0, 1.4, -19); stairs.castShadow = false;   // монументалното стълбище пред входа (откъм града)
  for (let k = 0; k < 14; k++) { const rt = realTree(deps, 6, k); if (rt) { rt.position.set(k % 2 ? 15 : -15, 1.2, -30 - k * 3.4); g.add(rt); continue; } const t = new THREE.Mesh(new THREE.ConeGeometry(1.4, 4.2, 7), mat(0x3f7f3a, 1)); t.position.set(k % 2 ? 15 : -15, 3.3, -30 - k * 3.4); t.castShadow = true; g.add(t); }   // дървета по алеята
  const lampM = mat(0xfff2c0, 0.4, 0, { emissive: 0xffd890, emissiveIntensity: 0 }), lamps = [];
  for (let k = 0; k < 8; k++) for (const x of [-34, 34]) { cyl(g, 0.12, 0.12, 3, mat(0x444444), x, 2.7, -18 + k * 7, 6); lamps.push(add(g, new THREE.SphereGeometry(0.35, 8, 6), lampM, x, 4.3, -18 + k * 7)); }
  if (o.group.children[0]) o.group.children[0].visible = false;   // без квадратната плоча
  o.group.position.set(0, 1.2, 8); o.group.scale.setScalar(3.4); o.group.rotation.y = Math.PI; g.add(o.group);   // платната — към морето
  return { group: g, update: (t, night) => { o.update(t, night); lampM.emissiveIntensity = 0.1 + 1.6 * night; } };
}

// kind → { group, update(t, night) }
export function buildLandmark(kind, deps = {}) {
  const g = (BUILD[kind] || BUILD.galata)();
  if (deps.label && LANDMARK_NM[kind]) {
    const box3 = new THREE.Box3().setFromObject(g), s = deps.label(LANDMARK_NM[kind], '#ffe9a8', 10);
    s.position.set(0, box3.max.y + 4, 0); s.visible = false; g.add(s); g.userData.sign = s;
  }
  const lit0 = g.userData;
  const flood = { get length() { return (lit0.flood || []).length; }, [Symbol.iterator]() { return (lit0.flood || [])[Symbol.iterator](); } }, lit = g.userData.lit || [], glass = g.userData.glass || [], blink = g.userData.blink || [];
  function update(t, night = 0) {
    for (const m of lit) m.emissiveIntensity = 0.1 + 1.6 * night;
    for (const m of flood) m.emissiveIntensity = (m.emissiveMap ? 0.55 : 0.28) * (m.userData.floodK || 1) * night;   // floodK — по-силно (Айфеловата кула)
    for (const m of glass) m.emissiveIntensity = 0.02 + 1.1 * night;
    for (const m of blink) m.emissiveIntensity = (Math.sin(t * 3) > 0.5 ? 2 : 0.2) * (0.3 + night);
    if (g.userData.sparkle) g.userData.sparkle(t, night);
    if (g.userData.spin) g.userData.spin.rotation.z = t * (g.userData.spinAxis ? 0.05 : 0.6);
  }
  return { group: g, update, kind };   // kind — за златния надпис в играта
}
