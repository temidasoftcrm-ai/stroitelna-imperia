// meshysky.js — 🏙️ meshy-sky2 (f6): двата небостъргача от Meshy AI (собствени на ТЕМИДАСОФТ — assets/heavy/CREDITS.txt) в градовете със стъклени кули.
// „Golden Tower“ (sky/gold.glb, ~80 м) и „Blue Spire Oasis“ (sky/bluespire.glb, ~95 м) — олекотени в Blender, в метри, основата на земята.
// Възлите в модела: Body — сградата (прозорците нощем — nightfloors.js, както другите sf-sky-*); Beacon — червената авиационна лампа на върха
// (клип „beacon“ в GLB-то; тук мига през общия материал — без AnimationMixer за всяко копие); Accent — нисък „плащ“ около долната половина
// с градиент във върховите цветове: нощното осветяване отдолу (златно / синьо), адитивно.
//   game.js: при зареждането — meshySkyPrep(gltf.scene, () => dayNight.night); в SF_SKY — само в MESHY_SKY_CITIES.
import * as THREE from 'three';
import { feature } from './lab/feature.js';
import { NF_MATS } from './nightfloors.js';

// 🏙️ sky-cocoon (собственикът, 01.11: „много хубав небостъргач, трябва да го сложим при рандом“): Cocoon Tower (204 м) и ар деко кулата с мол отдолу (190 м, за центъра).
// В Blender: долният „разтопен“ ръб (Meshy) е отрязан, основата на 0; Body носи изпечена нощна карта (emissiveMap) — маска по яркостта на base color:
// тъмното стъкло свети топло, светлата решетка/камъкът не; покривът (Roof) е отделен материал без светене; Accent — студеното осветяване отдолу; Beacon — червената лампа.
const COCOON = feature('sky-cocoon');
export const MESHY_SKY_NEW = COCOON ? { cocoon: 'sky/cocoon.glb', decomall: 'sky/decomall.glb' } : {};
const GOLDN = feature('gold-night2');   // 🌃 gold-night2: Golden Tower с нова нощ (gold2.glb — същият модел + карта „nightdata“)
export const MESHY_SKY = { gold: GOLDN ? 'sky/gold2.glb' : 'sky/gold.glb',bluespire: 'sky/bluespire.glb', skyspire: 'sky/skyspire.glb', skyspire2: 'sky/skyspire2.glb', skyw: 'sky/sky-white.glb', skywarm: 'sky/sky-warm.glb', skyblue: 'sky/sky-blue.glb', skyviolet: 'sky/sky-violet.glb', ...MESHY_SKY_NEW };   // + четири кули (Meshy) с различни акценти нощем: бяло, топло, синьо, виолетово
export const MESHY_SKY_NY = { nydeco: 'sky/nydeco.glb' };   // 🇺🇸 lm-ny2: каменната ар деко кула — само в Ню Йорк   // „Skyspire Nexus“ — в Blender разделен на две: извитата двойна кула (skyspire, 110 м) и единичната (skyspire2, 95 м) — целият комплекс е широк колкото е висок и на парцел излизаше 15 м
export const MESHY_SKY_H = { 'sf-sky-gold': 80, 'sf-sky-bluespire': 95, 'sf-sky-skyspire': 110, 'sf-sky-skyspire2': 95, 'sf-sky-skyw': 180, 'sf-sky-skywarm': 200, 'sf-sky-skyblue': 170, 'sf-sky-skyviolet': 190, 'sf-sky-nydeco': 200, 'sf-sky-cocoon': 204, 'sf-sky-decomall': 190 };
// sky-cocoon: изпечените нощни прозорци (Body.emissiveMap) — денем 0, нощем daynight.js ги пали през NF_MATS; без nightfloors.js (там няма MODE за тях)
// sky-cocoon: същото за облика на офиса (officestyle.js няма dayNight) — нощта се чете от изпечения материал (daynight.js му дава n × nfK)
const BAKED_K = 1.2;   // яркостта на изпечените прозорци нощем (daynight.js: n × nfK)
export function meshyOfficePrep(root) {
  const bm = meshyBakedNight(root);
  meshySkyPrep(root, () => bm ? Math.min(1, bm.emissiveIntensity / BAKED_K) : 0);
}
// 🌃 gold-night2 (собственикът, 01.11: „да оправим осветлението на този небостъргач и да го анимираме“ → „да направим по етажи — да не е като коледна елха —
// и чат-пат някой прозорец рандом“; одобрено в Blender „ок е“): вместо петната на nightfloors 'dark' — изпечена data карта (Blender, по позицията на тексела):
// R — прозорецът (етаж 3 м × ос 2,6 м, поясът 5–84 % от височината, само стените), G — случаен номер на етажа, B — на прозореца (със страната), A < 0,75 — короната.
// Шейдърът: светят цели етажи (~58 %, един топъл тон, яркостта по етажа), в етажа ~3 % обратно; рядко (≈ веднъж на 10–15 s за сградата) отделен прозорец
// се пали/гаси (всеки — на 6–12 мин), етажите — на 1–2 часа; короната — леко топло отдолу. Същата формула като прегледа в Blender (scratchpad goldnight2.py).
const GOLD_T = { value: 0 };
function goldNight(root) {
  let n = 0; root.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) { const t = m && m.emissiveMap; if (!t || t.name !== 'nightdata' || m.userData.goldNight) continue;
    t.colorSpace = THREE.NoColorSpace; m.userData.goldNight = 1; m.userData.nightFloors = true; m.userData.nfK = 1.1;
    m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = 0; NF_MATS.add(m); n++;   // daynight.js: emissiveIntensity = нощта × nfK
    m.onBeforeRender = () => { GOLD_T.value = performance.now() / 1000; };
    m.onBeforeCompile = sh => { sh.uniforms.uGoldT = GOLD_T;
      sh.fragmentShader = 'uniform float uGoldT;\nfloat gnFr(float a) { return fract(a); }\nfloat gnH(float a) { return fract(sin(a) * 43758.5453); }\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `
        vec4 gnD = texture2D(emissiveMap, vEmissiveMapUv);
        float gnG = floor(gnD.g * 255.0 + 0.5) / 255.0, gnB = floor(gnD.b * 255.0 + 0.5) / 255.0;
        float gnFs = floor(uGoldT / (3600.0 + 3600.0 * gnFr(gnG * 5.1)) + gnFr(gnG * 9.7));
        float gnFloor = step(0.45, gnH(gnG * 91.7 + gnFs * 13.13));
        float gnExc = step(gnFr(gnB * 7.77), 0.03);
        float gnKey = gnH(gnB * 127.1 + gnG * 311.7), gnPw = 360.0 + 360.0 * gnFr(gnKey * 3.1);
        float gnSl = floor(uGoldT / gnPw + gnFr(gnKey * 5.3));
        float gnTog = step(gnH(gnKey * 91.7 + gnSl * 13.13), 0.04);
        float gnLit = abs(abs(gnFloor - gnExc) - gnTog);   // XOR
        float gnBr = 0.85 + 0.15 * gnFr(gnG * 2.3);
        totalEmissiveRadiance *= vec3(1.0, 0.68, 0.36) * step(0.5, gnD.r) * gnLit * gnBr + vec3(1.0, 0.78, 0.45) * step(gnD.a, 0.75) * 0.06;`); };
    m.customProgramCacheKey = () => 'gold-night2'; m.needsUpdate = true; } });
  return n;
}
export function meshyBakedNight(root) {   // → изпеченият материал (или null — старите кули не се пипат)
  if (goldNight(root)) return null;   // gold-night2: своята нощ (не „изпечените“ на sky-cocoon)
  let bm = null; root.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m && m.emissiveMap && !bm) bm = m; });
  if (!bm) return null;
  root.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m && 'metalness' in m) m.metalness = Math.min(m.metalness, 0.15); });   // Meshy слага метал → без огледална среда кулата излиза черна денем
  if (!bm.userData.nightFloors) { bm.emissive.setRGB(1, 1, 1); bm.emissiveIntensity = 0; bm.userData.nightFloors = true; bm.userData.nfK = BAKED_K; NF_MATS.add(bm); }
  return bm;
}
// градовете със стъклени небостъргачи (не старите европейски центрове)
export const MESHY_SKY_CITIES = new Set(['newyork', 'chicago', 'losangeles', 'toronto', 'mexicocity', 'saopaulo', 'dubai', 'mumbai', 'singapore', 'hongkong', 'shanghai', 'beijing', 'seoul', 'tokyo', 'sydney', 'moscow',
  'houston', 'miami', 'sanfrancisco', 'abudhabi', 'doha', 'kualalumpur', 'bangkok', 'osaka', 'taipei', 'shenzhen', 'jakarta']);

export function meshySkyPrep(root, night) {
  // материалите са общи за всички копия (clone(true) не копира Object3D.onBeforeRender) — затова Material.onBeforeRender
  const beacon = new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  beacon.onBeforeRender = () => { const n = night(); beacon.opacity = (performance.now() / 1000) % 1.5 < 0.25 ? 0.2 + 0.8 * n : 0.04 * n; };   // 0,25 с на всеки 1,5 с (като клипа); денем по-слабо
  const accent = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0 });
  accent.onBeforeRender = () => { accent.opacity = 0.85 * night(); };
  meshyBakedNight(root);   // sky-cocoon: само моделите с изпечена нощна карта (другите нямат emissiveMap)
  root.traverse(o => {
    if (!o.isMesh) return;
    const nm = (o.name + ' ' + (o.parent && o.parent.name)) || '';
    if (/\bBeacon/.test(nm)) { o.material = beacon; o.scale.setScalar(1.8); o.castShadow = o.receiveShadow = false; }   // ×1,8 — да се вижда и когато кулата е смалена до парцела
    else if (/\bAccent/.test(nm)) { o.material = accent; o.castShadow = o.receiveShadow = false; o.renderOrder = 2; }
  });
}
