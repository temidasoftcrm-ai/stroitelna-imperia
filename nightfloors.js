// nightfloors.js — нощем етажите на реалистичните сгради (assets/commercial) светват: всеки етаж в свой момент
// (докато се свечерява), в свой оттенък — топло жълто, бяло-синкаво или приглушено; ~20% от етажите остават тъмни.
// Прозорците: маска от текстурата на модела (по модел — стъкла „cool“: хладни синкави панели, или „dark“: по-тъмни от рамката).
// Етажът и „коя сграда“: височината в модела и мястото на сградата → различно светене и при еднакви модели.
// daynight.js пали материалите вечер (emissiveIntensity = нощта 0…1). Зад feature('night-floors') — първо в Лабораторията.
import * as THREE from 'three';
import { feature } from './lab/feature.js';

const MODE = { ...Object.fromEntries([3, 4, 5, 6, 7, 8, 9, 10].map(l => [`office2-l${l}`, l === 10 ? 'cool' : 'dark'])),   /* 10 — синкавото стъкло на кулата */   // 🆕 новите нива на офиса (game.js OFFICE2): прозорците — по-тъмни от фасадата
  'building-a': 'dark', 'building-b': 'cool', 'building-c': 'dark', 'building-d': 'dark', 'building-e': 'cool', 'building-f': 'cool',
  'building-g': 'dark', 'building-h': 'dark', 'building-skyscraper-a': 'dark', 'building-skyscraper-b': 'cool', 'building-skyscraper-c': 'cool',
  // Kenney Commercial 2 (обща палитра colormap): стъклата са синкавите петна; високите варианти (@20…) делят материала
  'building-i': 'kenney', 'building-j': 'kenney', 'building-k': 'kenney', 'building-l': 'kenney', 'building-m': 'kenney', 'building-n': 'kenney',
  // новите модели D (Singapore Office — като sf-sky-sing) и E (Bank of China): стъклата по етажи, рамките/лъчите — не
  'building-skyscraper-d': ['cool', [/Interior/i, 'flood'], [/Red_Beam|Trimsheet|temp/i, null]], 'building-skyscraper-e': ['cool', [/Lisanne|Color_A06/i, null], [/^Material(\.\d+)?$/, 'coolW']],   // E: Bank of China (cool) или новата синя стъклена кула (com2-sky-e2 — „Material“: сребристо + етажи, без точки)
  bellagio: 'flood', sagrada: 'floodUp', petronas: 'solid', burj: ['coolW', [/material_1/, null]], willis: 'coolW', cntower: 'led',   // Уилис — като Бурж; Си Ен Тауър — цветни LED светлини, които бавно сменят цвета   // Бурж Халифа: студено-бели етажи   // Саграда Фамилия: прожектори отдолу, кулите по-светли нагоре
  // истинските небостъргачи (assets/heavy/sky): режимът може да зависи от материала — [регулярен израз за името, режим|null]
  'sf-sky-usb': ['cool', [/roof/i, null]], 'sf-sky-rand': ['cool'], 'sf-sky-sing': ['cool', [/Interior/i, 'flood'], [/Red_Beam|Trimsheet|temp/i, null]],
  // истинските къщи и блокове (feature 'night-houses'): house-a — стъклата са отделни материали (светят целите); house-b — една текстура,
  // прозорецът е правоъгълник в нея ('houseB' — свети целият, без тъмната рамка); бръшлянът (phong1) — не. Блоковете: прозорците по-тъмни от фасадата ('dark') или отделен материал.
  'building-type-a': [null, [/^Material\.(001|006|008|009|010|011|012)$/, 'flood']], 'building-type-b': [null, [/lambert1/, 'houseB']],
  'sf-blk-brick': [null, [/^Window/i, 'flood']], 'sf-blk-oldbld': [null, [/^Windows/i, 'flood']], 'sf-blk-modoffice': [null, [/Glass/i, 'solid'], [/Light/i, 'flood']],
  'sf-blk-richmond': 'rects:richmond', 'sf-blk-dbrick': 'rects:dbrick', 'sf-blk-jade': 'darkC', 'sf-blk-soviet': 'darkC', 'sf-blk-panel12': ['aux', [/antenna/i, null]], 'sf-blk-gamecity': 'aux', 'sf-blk-asian': 'aux',
  // 'aux': маската е от друга карта в модела (game.js я слага в m.userData.nfAux = { tex, kind }) — panel12: белите прозорци на черно, gamecity/asian: розовите
  // 'darkC': като 'dark', но с по-силно изчистване — снимковите текстури иначе дават шум от светли точки
  // новите къщи (houses2): стъклото — цялото; lodge има интериор — светят подът и таванът зад прозорците; с една текстура — 'darkC'
  'h2-greyporch': [null, [/Glass|^material_0$/i, 'solidW']], 'h2-swedish': [null, [/^Glass$/, 'solidW']], 'h2-lodge': [null, [/Floor|CEILING/i, 'solidW']],   // solidW — цялото стъкло, топло
  'h2-pink': [null, [/WindowsAndDoors/i, 'darkC']], 'h2-townhouse': 'darkC', 'h2-porch': [null, [/^lambert9SG$/, 'solidW']], 'h2-brickcabin': 'whiteS', 'h2-blue': 'solidW',   // porch: стъклото е lambert9SG; h2-blue — само прозорците (MESH_MODE)
  manhattan: ['grid', [/^empire_state$/, 'empire']],
  // Лабораторията → night-nyextra: сградата от градския пакет, Статуята на свободата (прожектори + факлата), круизният кораб (кабините)
  Building_Medium_2_001: 'grid', liberty: 'liberty', cruise: 'ship',
  redeemer: 'redeemer',   // Лабораторията → night-rio: Христос Спасителя — бели прожектори отдолу, топъл пиедестал   // небостъргачите на Ню Йорк (landmarks.js manhattanTowers) — Емпайър Стейт с осветена корона
  colosseo3: ['colosseo', [/^cavea$/, 'colosseoC'], [/^arena$/, null]],
  vittoriano2: 'vittoriano',
  maiden2: 'maiden',
  lazare2: ['lazare', [/^court$/, null]],
  stpatrick2: 'patrick',
  grandcentral2: ['gct', [/^wingroof$/, null]],
  parliament2: 'westm',
  rockefeller2: 'rock',
  empire2: 'empire2',   // Емпайър Стейт (модел на потребителя): тялото тъмно с топли прозорци, горните стъпала, короната и шпилът — осветени
  radiocity2: ['radio', [/^neon_/, 'neon'], [/^storefront$/, 'radioS'], [/^sign_back$/, null]],   // Радио Сити: фасадата топло, прозорците; неонът — слабо и денем, силно нощем; стената под таблото — топло   // Рокфелер Център (като на снимката): фасадата синьо-виолетова, нагоре по-светла; прозорците между ребрата — бяло-топло   // Уестминстър: целият дворец златист (почти без да тъмнее нагоре), прозорците по фасадата и кулите — топло жълто
  // бензиностанциите (потребителят: „ок, пускай ги в играта“ — прегледани в Blender): долната страна на навеса — ярко бяло, витрините на магазина — топло
  'gas-modern': 'gas', 'gas-big': 'gas', 'gas-green': ['gas', [/Collider/i, null]], 'gas-lowpoly': 'gas',   // Гранд Сентръл: кремавата фасада топло отдолу, арковидните прозорци (и по крилото) — златисти
  // заводите и складовете (industry.js; потребителят: „харесват ми заводите, вкарвай ги в играта“ — прегледани в Blender): натриеви прожектори отдолу, част от прозорците по етажи
  ...Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'].map(k => ['ind-building-' + k, 'ind'])), 'ind-water-tower': 'ind',   // „Св. Патрик“: белият мрамор топло отдолу, витражите и розетата светят кехлибарено (само по стените — не покривите)
  // офиси и къщи (потребителят: „да ги качваме в играта“ — прегледани в Blender): стъклените кутии — 'grid2' (мрежа малки прозорци по стените, етажите по истинската
  // височина, приглушено, част от етажите и прозорците светват и угасват); с прозорци в текстурата — 'darkC'
  'b2-office2': 'grid2', 'b2-office3': 'grid2', 'b2-office4': 'grid2', 'b2-office5': 'grid2', 'b2-office6': 'grid2', 'b2-hirise': 'grid2', 'b2-midwest': 'grid2',
  'b2-pp-townhouse': 'grid2', Building_Small_1: 'grid2',   // с текстурата ('darkC') излизаха шарени точки — и те с мрежата   // гара Сен Лазар (като на снимката): фасадата топло отдолу, прозорците златисти, покривите тъмни   // Момината кула (като на снимката): златиста отдолу, прозорците на купола и на къщата светят   // Витториано (като на снимката): белият мрамор — топло-бяло отдолу, колонадата горе — златиста между колоните   // Лабораторията → lm-colosseo3: Колизеумът — топла фасада отдолу, оранжевите арки на етажи 1–3, трибуните слабо
  'sf-sky-night': ['bright'], 'sf-sky-blue': ['cool', [/glass/i, 'solid'], [/./, null]],
  // обществените сгради (services3d.js: болници, полиция, пожарни, кметство, съд, училище) — мрежа прозорци по стените, както офисите
  ...Object.fromEntries(['school', 'fire', 'police', 'fire-l1', 'fire-m1', 'fire-s1', 'fire-s2', 'hosp-l1', 'hosp-l2', 'hosp-m1', 'hosp-m2', 'hosp-s1', 'hosp-s2', 'police-l1', 'police-l2', 'police-m1', 'police-s1', 'police-s2'].map(k => ['svc-' + k, 'grid2'])), 'svc-cityhall': 'vittoriano', 'svc-court': 'vittoriano' };   // кметството и съдът (стари сгради) — топли прожектори отдолу по фасадата, като Колизеума   // забележителност (landmarks.js) — хотелът в Лас Вегас: цялата фасада в топла светлина (прожектори), етажите леко различни
const OFFICE2_FL = [1, 2, 7, 7, 9, 14, 20, 30, 45, 52];   // етажите на новите нива на офиса (по модела)
const FLOORS = n => (n.startsWith('office2-l') ? OFFICE2_FL[+n.slice(9) - 1] : 0) || (n.startsWith('h2-') ? 2 : 0) || (n.startsWith('svc-') ? (/hosp/.test(n) ? 5 : 3) : 0) || (n.startsWith('ind-') ? 3 : 0) || ({ 'b2-office2': 6, 'b2-office3': 7, 'b2-office4': 9, 'b2-office5': 6, 'b2-office6': 7, 'b2-hirise': 22, 'b2-midwest': 4, 'b2-pp-townhouse': 4, Building_Small_1: 4, 'building-type-a': 1, 'building-type-b': 2, burj: 90, petronas: 88, bellagio: 28, 'building-skyscraper-d': 8, 'building-skyscraper-e': 8 })[n] || (/skyscraper|sf-sky/.test(n) ? 32 : 9);
// когато прозорците са отделна част, но със същия материал като стените: [/името на частта/, режим] — материалът ѝ се клонира
const MESH_MODE = { 'h2-blue': [/Windows/i, 'solidW'] };   // синята къща — прозорците светят целите, топло
// режимът на материала: MODE[name] е низ или [по подразбиране, [/име/, режим|null]…]
const modeOf = (name, m) => { const e = MODE[name]; if (!e || typeof e === 'string') return e; for (const [re, md] of e.slice(1)) if (re.test(m.name || '')) return md; return e[0]; };
const WHITE = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); WHITE.needsUpdate = true;   // приблизителен брой етажи на модела
const NF_K = { petronas: 0.9 };   // по-ярки етажи (снимковата текстура дава тесни прозорци)
export const NF_MATS = new Set();
export const NF_T = { value: 0 };   // време (s) — daynight.js го върти; през нощта етажи угасват и светват
const FEAT = { ...Object.fromEntries(Object.keys(MODE).filter(k => k.startsWith('svc-')).map(k => [k, 'night-civic'])), empire2: 'newyork-osm', radiocity2: 'newyork-osm', rockefeller2: 'newyork-osm', parliament2: 'london-osm', 'gas-modern': 'gas-modern', 'gas-big': 'gas-big', 'gas-green': 'gas-green', 'gas-lowpoly': 'gas-lowpoly', grandcentral2: 'newyork-osm', stpatrick2: 'newyork-osm', lazare2: 'paris-osm', maiden2: 'istanbul-osm', colosseo3: 'lm-colosseo3', vittoriano2: 'lm-vittoriano', redeemer: 'night-rio', manhattan: 'night-manhattan', Building_Medium_2_001: 'night-nyextra', liberty: 'night-nyextra', cruise: 'night-nyextra', ...Object.fromEntries(['greyporch', 'brickcabin', 'pink', 'townhouse', 'blue', 'swedish', 'lodge', 'porch'].map(k => ['h2-' + k, 'night-houses'])), 'building-type-a': 'night-houses', 'building-type-b': 'night-houses', ...Object.fromEntries(['brick', 'oldbld', 'modoffice', 'richmond', 'dbrick', 'jade', 'soviet', 'panel12', 'gamecity', 'asian'].map(k => ['sf-blk-' + k, 'night-houses'])), sagrada: 'night-sagrada', burj: 'night-burj', petronas: 'night-towers', willis: 'night-towers', cntower: 'night-towers', 'building-skyscraper-d': 'night-towers', 'building-skyscraper-e': 'night-towers' };
const WORLD_H = { burj: 70, willis: 46, cntower: 58, 'building-type-b': 12 };   // каменната къща: мешовете са с вътрешен мащаб — етажите по височината в света   // височина в света (landmarks.js GLB_LM.h) — моделът е от много части с различни оси   // отделно „✓ OK“ в Лабораторията (иначе — night-floors)   // материалите с нощни етажи — daynight.js ги пали вечер
// прозорците, маркирани на ръка (u0, v0, u1, v1 в текстурата, v отгоре) — снимковите фасади, където маската по яркост дава петна
const RECTS = {
  houseB: [[0.775, 0.01, 0.925, 0.275]],
  dbrick: [...[[0.055, 0.115], [0.185, 0.245], [0.455, 0.515], [0.585, 0.645]].map(([a, b]) => [a, 0.112, b, 0.225]),
    ...[[0.045, 0.105], [0.185, 0.245], [0.32, 0.38], [0.457, 0.517], [0.595, 0.655]].map(([a, b]) => [a, 0.32, b, 0.425]),
    ...[[0.055, 0.115], [0.185, 0.245], [0.32, 0.38], [0.457, 0.517], [0.59, 0.65]].map(([a, b]) => [a, 0.62, b, 0.73]),
    ...[0.062, 0.2, 0.337].map(v => [0.83, v, 0.94, v + 0.062])],
  richmond: [[0.525, 0.24, 0.675, 0.54], [0.525, 0.56, 0.675, 0.99]],
};
const WHOLE = md => md === 'houseB' || md === 'whiteS' || md === 'solidW' || md.startsWith('rects:');   // маркираните прозорци светят целите, топло (като 'flood', само по маската)
// 'grid' (Лабораторията → night-grid; направено в Blender): истински прозорци по света — 0,8 широки, етаж 1,6 (мащабът на града), с плоча и колони между тях;
// ~40% светят, всеки със своя яркост и оттенък; ~20% от етажите — тъмни. Без маската на текстурата — само по-светлите стъкла малко по-ярко
const GRID = ['building-skyscraper-c', 'building-skyscraper-d', 'building-skyscraper-e', 'sf-sky-usb', 'sf-sky-blue', 'sf-sky-sing'];   // e — Northwestern Mutual (com2-sky-e2): вместо белите ивици на Бурж
const isGrid = name => GRID.includes(name) && feature('night-grid');
// 'petro' (Лабораторията → night-petronas2; направено в Blender по снимки): Петронас — тъмна стомана с вертикални сребристи линии около
// всяка кула, ярки ръбове на стесненията, светла корона, топли приглушени прозорци; подиумът — топло жълт отстрани, тъмен покрив.
// Кулите се намират от самия меш: центровете — по върховете в средата на височината, подиумът — долните 12,8%
function petroGeo(geo) {
  const P = geo.attributes.position, n = P.count; let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) { const y = P.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const lo = y0 + (y1 - y0) * 0.35, hi = y0 + (y1 - y0) * 0.55, xs = [];
  for (let i = 0; i < n; i++) { const y = P.getY(i); if (y > lo && y < hi) xs.push(i); }
  let mx = 0; for (const i of xs) mx += P.getX(i); mx /= xs.length || 1;
  const box = side => { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (const i of xs) { const x = P.getX(i); if ((x > mx) !== side) continue; const z = P.getZ(i); a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, z); d = Math.max(d, z); } return new THREE.Vector2((a + b) / 2, (c + d) / 2); };
  return { y0, y1, tl: box(false), tr: box(true), mx };
}
const masks = new Map();   // режим → (изображение → маска CanvasTexture)

function box(a, w, h, r) {   // средно в квадрат (2r+1)² — интегрално изображение
  const W = w + 1, I = new Float32Array(W * (h + 1));
  for (let y = 0; y < h; y++) { let s = 0; for (let x = 0; x < w; x++) { s += a[y * w + x]; I[(y + 1) * W + x + 1] = I[y * W + x + 1] + s; } }
  const o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    o[y * w + x] = (I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0]) / ((x1 - x0) * (y1 - y0));
  }
  return o;
}
function maskFor(tex, mode) {
  const img = tex.image; if (!img || !img.width) return null;
  const byMode = masks.get(mode) || masks.set(mode, new WeakMap()).get(mode); if (byMode.has(img)) return byMode.get(img);
  const w = img.width, h = img.height, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, w, h), p = d.data, L = new Float32Array(w * h), raw = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { const r = p[4 * i] / 255, gg = p[4 * i + 1] / 255, b = p[4 * i + 2] / 255; L[i] = 0.3 * r + 0.59 * gg + 0.11 * b; p[4 * i + 3] = Math.max(r, gg, b) - Math.min(r, gg, b); raw[i] = b - r; }
  if (mode === 'flood' || mode === 'floodUp') return tex;
  if (mode === 'white' || mode === 'whiteS' || mode === 'magenta') {   // whiteS — само чисто белите стъкла   // готова карта на прозорците (вж. 'aux')
    for (let i = 0; i < w * h; i++) { const r = p[4 * i], gg = p[4 * i + 1], b = p[4 * i + 2], on = mode === 'white' ? L[i] > 0.5 : mode === 'whiteS' ? L[i] > 0.93 && p[4 * i + 3] < 0.5 : r > 150 && b > 150 && gg < 110; p[4 * i] = p[4 * i + 1] = p[4 * i + 2] = on ? 255 : 0; p[4 * i + 3] = 255; }
    g.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(c); t.flipY = tex.flipY; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; byMode.set(img, t); return t;
  }
  if (mode.startsWith('rects:') || mode === 'houseB') {   // прозорците от RECTS — свети целият правоъгълник без най-тъмните пиксели на рамката
    const R = RECTS[mode === 'houseB' ? 'houseB' : mode.slice(6)];
    for (let i = 0; i < w * h; i++) { const u = (i % w) / w, v = ((i / w) | 0) / h, on = L[i] > 0.12 && R.some(([u0, v0, u1, v1]) => u > u0 && u < u1 && v > v0 && v < v1); p[4 * i] = p[4 * i + 1] = p[4 * i + 2] = on ? 255 : 0; p[4 * i + 3] = 255; }
    g.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(c); t.flipY = tex.flipY; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; byMode.set(img, t); return t;
  }
  if (mode === 'coolW' || mode === 'led') return tex;   // Бурж: самата текстура, меко сребристо (без петна)   // прожектори / осветени стаи: самата текстура свети
  const dk = mode === 'dark' || mode === 'darkC', R = mode === 'darkC' ? Math.max(2, (Math.min(w, h) / 160) | 0) : 1;
  const loc = dk ? box(L, w, h, Math.max(4, (Math.min(w, h) / 24) | 0)) : null;
  const win = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const sat = p[4 * i + 3];
    win[i] = mode === 'bright' ? +(L[i] > 0.32) : mode === 'cool' ? +(raw[i] > 0.03 && L[i] > 0.15 && L[i] < 0.85 && sat < 0.35) : mode === 'kenney' ? +(raw[i] > 0.06 && L[i] > 0.1 && L[i] < 0.8) : +(L[i] < loc[i] - 0.08 && L[i] < 0.5 && sat < 0.2);
  }
  const a = mode === 'kenney' ? win : box(win, w, h, R); if (mode !== 'kenney') for (let i = 0; i < w * h; i++) a[i] = +(a[i] > (mode === 'darkC' ? 0.7 : 0.55));   // без тънките линии (палитрата е от петна — без)
  const m = mode === 'kenney' ? a.map(v => v) : box(a, w, h, R);
  for (let i = 0; i < w * h; i++) { const v = m[i] > 0.3 ? 255 : 0; p[4 * i] = p[4 * i + 1] = p[4 * i + 2] = v; p[4 * i + 3] = 255; }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.flipY = tex.flipY; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
  byMode.set(img, t);
  return t;
}
// бензиностанциите нощем: под навеса — кръгло светло петно на асфалта (адитивно; пали се с нощта като етажите — NF_MATS)
let poolTex = null;
function gasPool(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), bb = new THREE.Box3().setFromObject(root).applyMatrix4(inv), H = bb.max.y - bb.min.y;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), box = new THREE.Box3(), M = new THREE.Matrix4();
  root.traverse(o => { if (!o.isMesh || !o.geometry?.attributes.position) return; M.multiplyMatrices(inv, o.matrixWorld); const P = o.geometry.attributes.position, I = o.geometry.index, n = I ? I.count : P.count;
    for (let t = 0; t + 2 < n; t += 3) { a.fromBufferAttribute(P, I ? I.getX(t) : t).applyMatrix4(M); b.fromBufferAttribute(P, I ? I.getX(t + 1) : t + 1).applyMatrix4(M); c.fromBufferAttribute(P, I ? I.getX(t + 2) : t + 2).applyMatrix4(M);
      e1.subVectors(b, a); e2.subVectors(c, a); e1.cross(e2); const L = e1.length(); if (L < 1e-9) continue; e1.divideScalar(L);
      if (e1.y < -0.7 && a.y > bb.min.y + 0.25 * H) { box.expandByPoint(a); box.expandByPoint(b); box.expandByPoint(c); } } });   // долните страни на навеса
  if (box.isEmpty()) return;
  if (!poolTex) { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, '#fff'); gr.addColorStop(0.55, '#8a8a8a'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); poolTex = new THREE.CanvasTexture(cv); }
  const w = (box.max.x - box.min.x) * 1.3, d = (box.max.z - box.min.z) * 1.3;
  const mt = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xf0f3ff, emissiveMap: poolTex, emissiveIntensity: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  mt.userData.nfK = 0.55; mt.userData.nightFloors = true; NF_MATS.add(mt);   // nightFloors — да не го пипа traverse-ът по-долу
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mt); m.position.set((box.min.x + box.max.x) / 2, bb.min.y + H * 0.01, (box.min.z + box.max.z) / 2); m.renderOrder = 2; m.userData.noShadow = true; root.add(m);
}
// подготвя моделя веднъж (материалите се делят от всички сгради с този модел)
export function prepNightFloors(root, name) {
  if (!MODE[name] || !feature(FEAT[name] || 'night-floors')) return;
  if (/^gas-/.test(name)) gasPool(root);   // бензиностанцията: светло петно на асфалта под навеса (отгоре долната страна не се вижда)
  const bb = new THREE.Box3().setFromObject(root), floorH = Math.max(1e-3, (bb.max.y - bb.min.y) / FLOORS(name)), y0 = bb.min.y;
  root.traverse(o => {
    if (!o.isMesh) return;
    const mr = MESH_MODE[name]; if (mr) { if (!mr[0].test(o.name || '')) return; if (!Array.isArray(o.material) && o.material && !o.material.userData.meshMode) { o.material = o.material.clone(); o.material.userData.meshMode = mr[1]; } }   // по частта на модела (синята къща: само прозорците)
    if (name === 'redeemer' && !Array.isArray(o.material) && o.material) o.material = o.material.clone();   // статуята е от няколко части — всяка със своя височина спрямо целия модел
    for (const m of [].concat(o.material)) {
      if (!m || m.userData.nightFloors || !('emissive' in m)) continue;
      if (name === 'building-skyscraper-c' && /roof|heli|top/i.test(m.name || '')) continue;
      let mode = m.userData.meshMode || modeOf(name, m); if (isGrid(name) && (mode || name === 'sf-sky-blue')) mode = 'grid';   /* синият — и стъклото (vraymm) */ if (name === 'petronas' && feature('night-petronas2')) mode = 'petro';
      if (!mode || (!m.map && mode !== 'solid' && mode !== 'solidW' && mode !== 'grid' && mode !== 'petro' && mode !== 'empire' && mode !== 'liberty' && mode !== 'ship' && mode !== 'redeemer' && mode !== 'colosseo' && mode !== 'colosseoC' && mode !== 'vittoriano' && mode !== 'maiden' && mode !== 'lazare' && mode !== 'grid2' && mode !== 'patrick' && mode !== 'ind' && mode !== 'gct' && mode !== 'gas' && mode !== 'westm' && mode !== 'rock' && mode !== 'radio' && mode !== 'neon' && mode !== 'radioS' && mode !== 'empire2') || (mode === 'aux' && !m.userData.nfAux)) continue;
      const mk = mode === 'solid' || mode === 'solidW' || mode === 'grid' || mode === 'petro' || mode === 'empire' || mode === 'liberty' || mode === 'ship' || mode === 'redeemer' || mode === 'colosseo' || mode === 'colosseoC' || mode === 'vittoriano' || mode === 'maiden' || mode === 'lazare' || mode === 'grid2' || mode === 'patrick' || mode === 'ind' || mode === 'gct' || mode === 'gas' || mode === 'westm' || mode === 'rock' || mode === 'radio' || mode === 'neon' || mode === 'radioS' || mode === 'empire2' ? WHITE : mode === 'aux' ? maskFor(m.userData.nfAux.tex, m.userData.nfAux.kind) : maskFor(m.map, mode); if (!mk) continue;
      m.userData.nfName = name; m.emissiveMap = mk; m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = 0; m.userData.nightFloors = true; m.userData.winK = 1; m.userData.nfK = NF_K[name] || 1; NF_MATS.add(m);
      const ax = new THREE.Vector3(0, 1, 0);   // оста „нагоре“ в координатите на меша
      m.onBeforeCompile = sh => {
        let fH = floorH, fY0 = y0, fHt = bb.max.y - bb.min.y;
        if (mode === 'coolW' || mode === 'led' || mode === 'empire' || mode === 'liberty' || mode === 'ship' || mode === 'redeemer' || mode === 'colosseo' || mode === 'colosseoC' || mode === 'vittoriano' || mode === 'maiden' || mode === 'lazare' || mode === 'grid2' || mode === 'patrick' || mode === 'ind' || mode === 'gct' || mode === 'gas' || mode === 'westm' || mode === 'rock' || mode === 'radio' || mode === 'neon' || mode === 'radioS' || mode === 'empire2') {   // Бурж (и Емпайър Стейт): височината по оста на меша, която в модела сочи нагоре (възлите на модела са завъртени/мащабирани)
          root.updateMatrixWorld(true); const M = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(o.matrixWorld), e = M.elements;
          const ys = [e[1], e[5], e[9]], k = ys.map(Math.abs).indexOf(Math.max(...ys.map(Math.abs))), sg = Math.sign(ys[k]) || 1;
          ax.set(k === 0 ? sg : 0, k === 1 ? sg : 0, k === 2 ? sg : 0);
          o.geometry.computeBoundingBox(); const gb = o.geometry.boundingBox, lo = ['x', 'y', 'z'][k];
          const a0 = sg > 0 ? gb.min[lo] : -gb.max[lo], a1 = sg > 0 ? gb.max[lo] : -gb.min[lo];
          fY0 = a0; fHt = Math.max(1e-3, a1 - a0); fH = fHt / FLOORS(name);
          if (mode === 'redeemer' || mode === 'colosseo' || mode === 'colosseoC' || mode === 'vittoriano' || mode === 'maiden' || mode === 'lazare' || mode === 'grid2' || mode === 'patrick' || mode === 'ind' || mode === 'gct' || mode === 'gas' || mode === 'westm' || mode === 'rock' || mode === 'radio' || mode === 'neon' || mode === 'radioS' || mode === 'empire2') { const v1 = sg * (bb.min.y - e[13]) / ys[k], v2 = sg * (bb.max.y - e[13]) / ys[k]; fY0 = Math.min(v1, v2); fHt = Math.max(1e-3, Math.abs(v2 - v1)); }   // по целия модел, не по тази част
          if (mode === 'grid2' || mode === 'ind') fH = fHt / FLOORS(name);   // етажите — по височината на целия модел
        }
        sh.uniforms.uAx = { value: ax }; sh.uniforms.uWH = { value: WORLD_H[name] || 0 };
        if (WORLD_H[name]) { fY0 = 0; fHt = WORLD_H[name]; fH = fHt / FLOORS(name); }   // в света: от земята до върха
        sh.uniforms.uFloorH = { value: fH }; sh.uniforms.uY0 = { value: fY0 }; sh.uniforms.uFlood = { value: mode === 'flood' || WHOLE(mode) ? 1 : mode === 'floodUp' ? 2 : 0 }; sh.uniforms.uCoolW = { value: mode === 'coolW' ? 1 : mode === 'led' ? 2 : 0 }; sh.uniforms.uT = NF_T; sh.uniforms.uH = { value: fHt }; sh.uniforms.uSolid = { value: mode === 'solid' ? 1 : 0 }; sh.uniforms.uGrid = { value: mode === 'grid' ? 1 : mode === 'petro' ? 2 : mode === 'empire' ? 3 : mode === 'liberty' ? 4 : mode === 'ship' ? 5 : mode === 'redeemer' ? 6 : mode === 'colosseo' ? 7 : mode === 'colosseoC' ? 8 : mode === 'vittoriano' ? 9 : mode === 'maiden' ? 10 : mode === 'lazare' ? 11 : mode === 'grid2' ? 12 : mode === 'patrick' ? 13 : mode === 'ind' ? 14 : mode === 'gct' ? 15 : mode === 'gas' ? 16 : mode === 'westm' ? 17 : mode === 'rock' ? 18 : mode === 'neon' ? 19 : mode === 'radioS' ? 20 : mode === 'radio' ? 21 : mode === 'empire2' ? 22 : 0 };
        const pg = mode === 'petro' ? petroGeo(o.geometry) : null;
        sh.uniforms.uPetro = { value: pg ? new THREE.Vector4(pg.y0, pg.y1, pg.mx, 0) : new THREE.Vector4() }; sh.uniforms.uPTL = { value: pg ? pg.tl : new THREE.Vector2() }; sh.uniforms.uPTR = { value: pg ? pg.tr : new THREE.Vector2() };
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vNfY; varying float vNfSeed; varying vec3 vNfW; varying vec3 vNfL; varying vec3 vNfN; varying vec3 vNfWN; uniform vec3 uAx; uniform float uWH;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvNfY = uWH > 0.0 ? (modelMatrix * vec4(transformed, 1.0)).y : dot(transformed, uAx); vNfSeed = fract(sin(dot(modelMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453); vNfW = (modelMatrix * vec4(transformed, 1.0)).xyz; vNfL = transformed; vNfN = objectNormal; vNfWN = mat3(modelMatrix) * objectNormal;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vNfY; varying float vNfSeed; uniform float uFloorH; uniform float uY0; uniform float uFlood; uniform float uSolid; uniform float uH; uniform float uCoolW; uniform float uT; uniform float uGrid; varying vec3 vNfW; varying vec3 vNfL; varying vec3 vNfN; varying vec3 vNfWN; uniform vec4 uPetro; uniform vec3 uAx; uniform vec2 uPTL; uniform vec2 uPTR;')
          .replace('#include <emissivemap_fragment>', `
            #ifdef USE_EMISSIVEMAP
              float nNight = emissive.r;   // нощта 0…1 (daynight.js → emissiveIntensity)
              float fl = floor((vNfY - uY0) / uFloorH);
              float r = fract(sin(fl * 91.17 + vNfSeed * 311.7) * 43758.5453);
              float on = step(r, nNight * 1.05) * step(r, 0.8);   // всеки етаж в свой момент; >0.8 — тъмен
              float tw = fract(sin((fl + 7.0 * floor(uT / 9.0 + r * 6.0 + vNfSeed * 5.0)) * 12.9898) * 43758.5453);
              if (nNight > 0.95 && tw > 0.86) on = (r < 0.92 ? 1.0 - on : on);   // живот през нощта: от време на време етаж угасва/светва
              vec2 cell = floor(vEmissiveMapUv * (uCoolW > 0.5 ? 12.0 : 48.0));   // Бурж — едри петна (стаи), не шум   // и отделните прозорци: ~60% светят (иначе стъклената фасада е цялата бяла)
              float wf = fract(sin(dot(cell, vec2(127.1, 311.7)) + fl * 17.3 + vNfSeed * 91.3) * 43758.5453);
              on *= step(wf, uCoolW > 0.5 ? 0.3 : 0.6);   // Бурж Халифа — по-рядко
              if (uCoolW > 0.5) on *= step(r, 0.35);        // и само ~1/3 от етажите
              vec3 col = r < 0.3 ? vec3(1.0, 0.72, 0.38) : r < 0.55 ? vec3(0.62, 0.48, 0.3) : vec3(0.85, 0.9, 1.0);
              if (uCoolW > 0.5) col = vec3(0.82, 0.9, 1.0) * (0.45 + 0.3 * r);   // студено бяло, по-меко (Бурж Халифа)
              if (uFlood > 0.5) { on = nNight; col = vec3(1.0, 0.78, 0.5) * (0.8 + 0.4 * r); }   // прожектори: всичко, топло, етажите малко различни
              if (uFlood > 1.5) col = vec3(1.0, 0.8, 0.52) * (0.55 + 0.9 * clamp((vNfY - uY0) / uH, 0.0, 1.0));   // нагоре — по-светло (кулите)
              vec3 tx = texture2D(emissiveMap, vEmissiveMapUv).rgb;
              totalEmissiveRadiance = tx * col * on * (uFlood > 0.5 ? 0.55 : 1.15);
              if (uGrid > 21.5) {   // Емпайър Стейт: короната (над 68% от височината) — топло-бяло, нагоре по-светло; тялото — само прозорците (тъмното в текстурата)
                float hz = clamp((vNfY - uY0) / uH, 0.0, 1.0), lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
                vec3 nn = normalize(vNfN); float vt = step(abs(dot(nn, uAx)), 0.3);
                float crown = clamp((hz - 0.64) * 4.0, 0.0, 1.0), dk = clamp((0.06 - lum) * 14.0, 0.0, 1.0) * vt * step(0.02, hz) * step(hz, 0.68);
                vec3 cr = mix(vec3(0.95, 0.82, 0.6), diffuseColor.rgb * 2.6, 0.3);   // короната — почти равно (текстурата на Meshy е на петна), малко от нея за релефа
                totalEmissiveRadiance = (cr * crown * (0.8 + 0.4 * hz) + vec3(1.0, 0.75, 0.4) * dk * 1.2) * nNight;
              } else if (uGrid > 18.5) {   // Радио Сити: 19 — неонът (цветът на материала; слабо и денем), 20 — стената под таблото (топло), 21 — фасадата топло отдолу, прозорците
                float hz = clamp((vNfY - uY0) / uH, 0.0, 1.0), lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
                vec3 nn = normalize(vNfN); float vt = step(abs(dot(nn, uAx)), 0.3);
                float dk = clamp((0.09 - lum) * 14.0, 0.0, 1.0) * vt * step(0.03, hz);
                totalEmissiveRadiance = uGrid < 19.5 ? diffuseColor.rgb * (0.35 + 2.4 * nNight)
                  : uGrid < 20.5 ? diffuseColor.rgb * vec3(1.0, 0.85, 0.6) * 0.9 * nNight
                  : (diffuseColor.rgb * vec3(1.0, 0.7, 0.42) * 0.5 * max(0.0, 1.0 - 1.4 * hz) + vec3(1.0, 0.78, 0.45) * dk * 1.3) * nNight;
              } else if (uGrid > 17.5) {   // Рокфелер Център: синьо-виолетови прожектори, нагоре по-светло; прозорците (тъмното между ребрата) — бяло-топло
                float hz = clamp((vNfY - uY0) / uH, 0.0, 1.0), lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
                vec3 nn = normalize(vNfN); float vt = step(abs(dot(nn, uAx)), 0.35);
                float dk = clamp((0.06 - lum) * 14.0, 0.0, 1.0) * step(0.04, hz) * step(hz, 0.96) * vt;
                totalEmissiveRadiance = (diffuseColor.rgb * vec3(0.5, 0.45, 1.0) * 0.9 * (0.35 + 0.65 * hz) + vec3(1.0, 0.92, 0.75) * dk * 1.3) * nNight;
              } else if (uGrid > 16.5) {   // Уестминстър: златисто отвсякъде (нагоре малко по-тъмно); прозорците (тъмното в текстурата, по стените) — топло жълто
                float hz = clamp((vNfY - uY0) / uH, 0.0, 1.0), lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
                vec3 nn = normalize(vNfN); float vt = step(abs(dot(nn, uAx)), 0.35);
                float dk = clamp((0.08 - lum) * 14.0, 0.0, 1.0) * step(0.03, hz) * step(hz, 0.92) * vt;
                totalEmissiveRadiance = (diffuseColor.rgb * vec3(1.0, 0.7, 0.32) * 0.85 * (1.0 - 0.2 * hz) + vec3(1.0, 0.82, 0.45) * dk * 1.8) * nNight;
              } else if (uGrid > 15.5) {   // бензиностанциите: долната страна на навеса (нормалата надолу, над 25% от височината) — ярко бяло; витрините (тъмното, по стените, долу) — топло
                float hz = clamp((vNfY - uY0) / uH, 0.0, 1.0), lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
                vec3 nn = normalize(vNfN); float dn = dot(nn, uAx), vt = step(abs(dn), 0.25);
                float canopy = step(dn, -0.7) * step(0.25, hz), shop = clamp((0.18 - lum) * 10.0, 0.0, 1.0) * vt * step(hz, 0.6);
                totalEmissiveRadiance = (vec3(0.95, 0.97, 1.0) * canopy * 2.5 + vec3(1.0, 0.75, 0.4) * shop * 1.2) * nNight;
              } else if (uGrid > 14.5) {   // Гранд Сентръл: кремавата фасада топло отдолу; арковидните прозорци (тъмното в текстурата, по стените, 8–60%) — златисти
                float hz = clamp((vNfY - uY0) / uH, 0.0, 1.0), lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
                vec3 nn = normalize(vNfN); float vt = step(abs(dot(nn, uAx)), 0.35);
                float dk = clamp((0.05 - lum) * 14.0, 0.0, 1.0) * step(0.08, hz) * step(hz, 0.6) * vt;
                totalEmissiveRadiance = (diffuseColor.rgb * vec3(1.0, 0.88, 0.68) * 0.45 * (1.0 - 0.35 * hz) + vec3(1.0, 0.6, 0.22) * dk * 2.2) * nNight;
              } else if (uGrid > 13.5) {   // заводите: натриеви прожектори отдолу (оранжево, нагоре гасне); прозорците (тъмното в текстурата, по стените) — ~50% от етажите, 25% светват и угасват
                float hz = clamp((vNfY - uY0) / uH, 0.0, 1.0), lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), fl = floor((vNfY - uY0) / uFloorH);
                vec3 nn = normalize(vNfN); float vt = step(abs(dot(nn, uAx)), 0.25);
                float rl = fract(sin(fl * 47.3 + vNfSeed * 91.7) * 43758.5453), tt = floor(uT / 1.5 + rl * 7.0) * step(rl, 0.25);
                float rf = fract(sin(fl * 91.17 + vNfSeed * 311.7 + tt * 13.7) * 43758.5453), fOn = step(rf, nNight * 1.05) * step(rf, 0.5);
                float win = clamp((0.14 - lum) * 14.0, 0.0, 1.0) * vt * fOn * step(0.04, hz);
                totalEmissiveRadiance = (diffuseColor.rgb * vec3(1.0, 0.55, 0.2) * 0.55 * max(0.0, 1.0 - 1.2 * hz) * (1.0 - win) + vec3(1.0, 0.85, 0.55) * win * 1.2) * nNight;
              } else if (uGrid > 12.5) {   // „Св. Патрик“: мраморът топло-бяло отдолу; витражите (тъмното в текстурата, по стените, 3–56%) — кехлибарено
                float hz = clamp((vNfY - uY0) / uH, 0.0, 1.0), lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
                vec3 nn = normalize(vNfN); float vt = step(abs(dot(nn, uAx)), 0.35);
                float dk = clamp((0.08 - lum) * 14.0, 0.0, 1.0) * step(0.03, hz) * step(hz, 0.56) * vt;
                totalEmissiveRadiance = (diffuseColor.rgb * vec3(1.0, 0.82, 0.6) * 0.45 * (1.0 - 0.35 * hz) + vec3(1.0, 0.5, 0.15) * dk * 2.2) * nNight;
              } else if (uGrid > 11.5) {   // офисите (grid2): мрежа малки прозорци по стените — етаж uH/етажите, прозорец през половин етаж; ~72% от етажите, ~55% от прозорците;
                // 25% от етажите и 20% от прозорците светват и угасват с времето; топло жълто, тук-там приглушено бяло (както в Blender)
                float fh = uFloorH, gz = (vNfY - uY0) / fh, fl = floor(gz), fz = fract(gz);
                vec3 nn = normalize(vNfN), nh = nn - dot(nn, uAx) * uAx; vec3 t3 = cross(uAx, normalize(nh + 1e-5));
                float gh = dot(vNfL, t3) / (fh * 0.5), gc = floor(gh), fhh = fract(gh);
                float gap = step(0.4, fz) * step(fz, 0.8) * step(0.25, fhh) * step(fhh, 0.75) * step(abs(dot(nn, uAx)), 0.2) * step(0.8, gz) * step(vNfY - uY0, uH - fh * 0.45);   // без приземието и без парапета на покрива
                float rl = fract(sin(fl * 47.3 + vNfSeed * 91.7) * 43758.5453), live = step(rl, 0.25), tt = floor(uT / 1.5 + rl * 7.0) * live;
                float rf = fract(sin(fl * 91.17 + vNfSeed * 311.7 + tt * 13.7) * 43758.5453), fOn = step(rf, nNight * 1.05) * step(rf, 0.72);
                float rw = fract(sin(dot(vec2(gc, fl), vec2(19.1, 73.7)) + vNfSeed * 5.1) * 43758.5453), wt = floor(uT / 1.5 + rw * 9.0) * step(rw, 0.2);
                float wv = fract(sin(dot(vec2(gc, fl), vec2(127.1, 311.7)) + vNfSeed * 91.3 + wt * 3.1) * 43758.5453), wc = fract(sin(fl * 12.9898 + vNfSeed * 78.2) * 43758.5453);
                vec3 gcol = wc < 0.7 ? vec3(1.0, 0.62, 0.28) : vec3(0.75, 0.8, 0.9);
                totalEmissiveRadiance = gcol * gap * fOn * step(wv, 0.55) * 0.65;
              } else if (uGrid > 10.5) {   // гара Сен Лазар: фасадата топло отдолу (нагоре — тъмно, покривите), прозорците (тъмното в текстурата, 4–58% от височината) — златисти
                float hz = clamp((vNfY - uY0) / uH, 0.0, 1.0), lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
                float dk = clamp((0.14 - lum) * 14.0, 0.0, 1.0) * step(0.04, hz) * step(hz, 0.58);
                totalEmissiveRadiance = (diffuseColor.rgb * vec3(1.0, 0.62, 0.3) * 0.55 * max(0.0, 1.0 - 0.7 * hz) + vec3(1.0, 0.55, 0.15) * dk * 2.0) * nNight;
              } else if (uGrid > 9.5) {   // Момината кула: всичко златисто отдолу; прозорците (тъмното в текстурата) на купола (55–76%) и на къщата (8–30%) — топло жълто
                float hz = clamp((vNfY - uY0) / uH, 0.0, 1.0), lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
                float dk = clamp((0.2 - lum) * 14.0, 0.0, 1.0) * (step(0.55, hz) * step(hz, 0.76) + step(0.08, hz) * step(hz, 0.3));
                totalEmissiveRadiance = (diffuseColor.rgb * vec3(1.0, 0.45, 0.1) * 0.6 * (1.0 - 0.3 * hz) + vec3(1.0, 0.7, 0.25) * dk * 2.2) * nNight;
              } else if (uGrid > 8.5) {   // Витториано: мраморът — топло-бяло отдолу, нагоре малко по-тъмно; колонадата (тъмното между колоните, 54–86% от височината) — златисто
                float hz = clamp((vNfY - uY0) / uH, 0.0, 1.0), lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
                float dk = clamp((0.3 - lum) * 14.0, 0.0, 1.0) * step(0.54, hz) * step(hz, 0.86);
                totalEmissiveRadiance = (diffuseColor.rgb * vec3(1.0, 0.8, 0.55) * 0.7 * (1.0 - 0.45 * hz) + vec3(1.0, 0.55, 0.15) * dk * 2.2) * nNight;
              } else if (uGrid > 6.5) {   // Колизеумът (като на снимката): фасадата — топло отдолу, нагоре по-тъмно; арките (тъмните отвори в текстурата) на етажи 1–3 — оранжево; 8 — трибуните, слабо
                float hz = clamp((vNfY - uY0) / uH, 0.0, 1.0), lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
                float dk = clamp((0.16 - lum) * 14.0, 0.0, 1.0) * step(0.03, hz) * step(hz, 0.73);
                totalEmissiveRadiance = uGrid > 7.5 ? diffuseColor.rgb * vec3(1.0, 0.6, 0.3) * 0.25 * nNight
                  : (diffuseColor.rgb * vec3(1.0, 0.5, 0.18) * 0.6 * (1.0 - 0.65 * hz) + vec3(1.0, 0.36, 0.05) * dk * 1.6) * nNight;
              } else if (uGrid > 5.5) {   // Христос Спасителя: статуята — бяла, леко хладна, по-светла където гледа надолу (прожекторите са отдолу), нагоре по-меко; пиедесталът (долните 21%) — топло
                float hz = clamp((vNfY - uY0) / uH, 0.0, 1.0), st = step(0.21, hz);
                vec3 wn = normalize(vNfWN); float face = 0.75 + 0.4 * max(-wn.y, 0.0), fall = 1.15 - 0.45 * hz;
                totalEmissiveRadiance = (diffuseColor.rgb * st * face * fall * vec3(0.95, 0.98, 1.08) * 1.25 + diffuseColor.rgb * (1.0 - st) * 0.45 * vec3(1.1, 0.9, 0.7)) * nNight;
              } else if (uGrid > 4.5) {   // круизният кораб: кабините — в координатите на меша (корабът се движи), ~20 палуби, само корпусът и надстройката
                float hz = clamp((vNfY - uY0) / uH, 0.0, 1.0), fh = uH / 20.0, ww = fh * 0.53;
                vec3 nn = normalize(vNfN), nh = nn - dot(nn, uAx) * uAx; vec3 t3 = cross(uAx, normalize(nh + 1e-5));
                float gz = (vNfY - uY0) / fh, gh = dot(vNfL, t3) / ww, fz = fract(gz), fhh = fract(gh), gf = floor(gz), gc = floor(gh);
                float gap = step(0.35, fz) * step(fz, 0.8) * step(0.12, fhh) * step(fhh, 0.88) * step(abs(dot(nn, uAx)), 0.12) * step(0.12, hz) * step(hz, 0.78);
                float wv = fract(sin(dot(vec2(gc, gf), vec2(127.1, 311.7))) * 43758.5453), wd = fract(sin(dot(vec2(gc, gf), vec2(269.5, 183.3))) * 43758.5453);
                vec3 gcol = wd < 0.5 ? vec3(1.0, 0.72, 0.38) : vec3(1.0, 0.92, 0.75);
                totalEmissiveRadiance = gcol * gap * step(0.25, wv) * (0.3 + 0.7 * wd) * nNight * 0.9;
              } else if (uGrid > 3.5) {   // Статуята на свободата: прожектори отдолу (бледо зелено-бяло, нагоре по-тъмно) и златният пламък на факлата
                float hz = clamp((vNfY - uY0) / uH, 0.0, 1.0);
                totalEmissiveRadiance = (diffuseColor.rgb * (0.95 - 0.5 * hz) * vec3(0.85, 1.05, 0.95) * 0.7 + vec3(1.0, 0.75, 0.3) * step(0.955, hz) * 5.0) * nNight;
              } else if (uGrid > 1.5 && uGrid < 2.5) {   // Петронас (вж. 'petro'): всичко в координатите на меша
                float ph = (vNfL.y - uPetro.x) / (uPetro.y - uPetro.x), tw = step(0.128, ph), pd = 1.0 - tw;
                vec2 pc = vNfL.x > uPetro.z ? uPTR : uPTL, dv = vNfL.xz - pc;
                float an = atan(dv.y, dv.x), st = fract(an * 64.0 / 6.2832), vl = step(st, 0.16);
                vec3 nn = normalize(vNfN); float vert = step(abs(nn.y), 0.35), ledge = step(0.6, nn.y);
                float up = pow(max((ph - 0.128) / 0.872, 0.0), 1.4);
                float fz = fract(ph * 103.0), band = step(0.3, fz) * step(fz, 0.85), wr = fract(sin(floor(ph * 103.0) * 91.17) * 43758.5453);
                float crown = smoothstep(0.8, 0.9, ph), tip = step(0.9, ph);
                float pz = fract(ph * 90.0), pb = 0.2 + 0.8 * step(0.25, pz);
                vec3 e = vec3(0.55, 0.62, 0.8) * 0.04 * tw
                  + vec3(0.85, 0.9, 1.0) * tw * vert * vl * (0.25 + up)
                  + vec3(1.0, 0.78, 0.5) * tw * band * wr * 0.22
                  + vec3(1.0, 0.93, 0.8) * tw * ledge * 1.6
                  + vec3(1.0, 0.95, 0.85) * tw * crown * 1.2 + vec3(1.0) * tip * 2.0
                  + vec3(1.0, 0.72, 0.38) * pd * vert * pb * 1.0;
                totalEmissiveRadiance = e * nNight;
              } else if (uGrid > 0.5) {   // прозорците по света (вж. 'grid'); 3 — Емпайър Стейт: отгоре осветен като истинския
                vec3 wn = normalize(vNfWN); vec2 tg = normalize(vec2(-wn.z, wn.x) + 1e-5);   // по посоката на стената — и по скосените (One WTC)
                float gz = vNfW.y / 1.6, gf = floor(gz), fz = fract(gz), gh = dot(vNfW.xz, tg) / 0.8, gc = floor(gh), fh = fract(gh);
                float gap = step(0.28, fz) * step(fz, 0.92) * step(0.1, fh) * step(fh, 0.9) * step(abs(wn.y), 0.12);   // покривите, пирамидите, шпиловете — не
                float rf = fract(sin(gf * 91.17 + vNfSeed * 311.7) * 43758.5453);
                float fOn = step(rf, nNight * 1.05) * step(0.22, rf);   // етажът — в свой момент; ~20% тъмни
                float wv = fract(sin(dot(vec2(gc, gf), vec2(127.1, 311.7)) + vNfSeed * 91.3) * 43758.5453), wd = fract(sin(dot(vec2(gc, gf), vec2(269.5, 183.3)) + vNfSeed * 17.1) * 43758.5453);
                float wp = fract(sin(dot(vec2(gc, gf), vec2(419.2, 371.9)) + vNfSeed * 47.7) * 43758.5453);
                float lit = step(0.6, wv);   // ~40% от прозорците
                if (wp < 0.2) { float wt = floor(uT / 6.0 + wd * 9.0); lit = step(0.5, fract(sin(dot(vec3(gc, gf, wt), vec3(12.99, 78.23, 37.71)) + vNfSeed * 5.3) * 43758.5453)); }   // ~20% светват и угасват — всеки в свой момент
                vec3 gcol = wv < 0.75 ? vec3(1.0, 0.72, 0.38) : wv < 0.9 ? vec3(1.0, 0.9, 0.7) : vec3(0.75, 0.85, 1.0);
                totalEmissiveRadiance = gcol * gap * fOn * lit * (0.25 + 0.75 * wd) * (0.6 + 0.4 * dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))) * 0.9;
                if (uGrid > 2.5) {   // Емпайър Стейт: горните етажи — колоните осветени отвън, короната — вертикални ивици, иглата — бяла на пояси
                  float hz = clamp((vNfY - uY0) / uH, 0.0, 1.0), vt = step(abs(wn.y), 0.4);
                  float band = smoothstep(0.64, 0.68, hz) * (1.0 - smoothstep(0.735, 0.745, hz)), crown = smoothstep(0.735, 0.745, hz) * (1.0 - smoothstep(0.835, 0.845, hz));
                  float spire = smoothstep(0.835, 0.845, hz), tip = smoothstep(0.97, 0.99, hz), up = smoothstep(0.64, 0.84, hz);
                  float pier = step(fract(dot(vNfW.xz, tg) / 0.6), 0.45), strip = step(fract(dot(vNfW.xz, tg) / 0.4), 0.38), ring = step(0.35, fract(hz * 70.0));
                  vec3 es = vec3(1.0, 0.86, 0.6) * band * vt * (pier * 1.4 + 0.3) + vec3(1.0, 0.9, 0.7) * crown * (strip * (up * 1.4 + 1.1) + 0.3)
                    + vec3(0.95, 0.97, 1.0) * spire * (ring * 2.0 + 0.5) + vec3(1.0) * tip * 3.0;
                  totalEmissiveRadiance = totalEmissiveRadiance * (1.0 - step(0.64, hz)) + es * nNight;
                }
              } else if (uCoolW > 1.5) {   // Си Ен Тауър: цветни LED по височината, бавно преливат (като истинската нощем)
                float hl = clamp((vNfY - uY0) / uH, 0.0, 1.0);
                vec3 led = 0.5 + 0.5 * cos(6.2832 * (uT * 0.03 + hl * 0.6 + vec3(0.0, 0.33, 0.67)));
                totalEmissiveRadiance = (tx * 0.6 + 0.25) * led * nNight * 0.9;
              } else if (uCoolW > 0.5) {   // Бурж: сребристо, нагоре по-светло + тук-там цял светнал етаж (той също се сменя с времето)
                float hb = clamp((vNfY - uY0) / uH, 0.0, 1.0), fb = floor(hb * 60.0);   // 60 етажа
                float rb = fract(sin(fb * 12.9898 + floor(uT / 14.0 + fract(fb * 0.618) * 4.0) * 78.233) * 43758.5453);
                float band = step(rb, 0.16) * step(0.06, hb) * step(hb, 0.9) * nNight;   // ~5 светнали етажа; сменят се с времето
                vec3 tl = max(tx, vec3(0.22));   // тъмно стъкло (Уилис) — все пак да се вижда
                totalEmissiveRadiance = tl * vec3(0.72, 0.84, 1.0) * nNight * (0.12 + 0.55 * pow(hb, 1.6)) + tl * vec3(1.0, 0.93, 0.8) * band * 1.6;   // светнал етаж — прозорците от текстурата, топло
              }
              if (uFlood > 1.5) {   // Саграда: тук-там светнал прозорец — тъмните отвори в камъка, по случайни петна
                vec2 wc = floor(vEmissiveMapUv * 90.0);
                float wr = fract(sin(dot(wc, vec2(41.3, 289.1))) * 43758.5453);
                float dk = 1.0 - smoothstep(0.12, 0.3, dot(tx, vec3(0.3, 0.59, 0.11)));
                totalEmissiveRadiance += vec3(1.0, 0.7, 0.32) * dk * step(wr, 0.18) * nNight * 1.6;
              }
            #endif`);
      };
      m.customProgramCacheKey = () => 'nightfloors20' + (mode === 'petro' ? 'p' : '');
      m.needsUpdate = true;
    }
  });
}
