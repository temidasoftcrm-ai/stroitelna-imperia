// lmnight.js — 🌃 процедурната нощ на забележителностите (собственикът, 01.11: „да топ са вкарваме ги“; одобрено в Blender — scratchpad lm5/*.blend).
// Без изпечена карта: светлината се смята в шейдъра от мястото в модела (q — 0…1 по кутията на модела, y — нагоре) и яркостта на текстурата (lum),
// по същата формула като прегледа в Blender (vertex color 'night'). Нощем: emissiveIntensity = нощта × nfK (daynight.js през NF_MATS); фасадата тъмнее.
//   lm-night-sofia: Александър Невски; lm-night-sf: Голдън Гейт; lm-night-london: Уестминстър с Биг Бен (циферблатите), Лондонското око.
//   lm-night-tokyo: Токийската кула — наситено оранжева решетка (Landmark Light), двете обсерватории — бели пояси, антената — бяла;
//                   Tokyo Skytree — синя решетка (нагоре по-светла), бавно минава в лилаво и обратно (Iki ↔ Miyabi), обсерваториите — бели пръстени.
import * as THREE from 'three';
import { NF_MATS } from './nightfloors.js';
import { feature } from './lab/feature.js';
import { holidayNow } from './empirenight.js';   // празниците (Нова година, 4 юли, Коледа) — Лондонското око в розово-червено

const T = { value: 0 }, HOL = { value: 0 };
// kind → { flag, nfK, glsl } — glsl: тяло на функция, вход q (vec3, 0…1 по кутията на модела), s (размерите на кутията / височината), lum (float), glass (float 0/1), t (s); изход vec3 c
const CFG = {
  tokyotower: { flag: 'lm-night-tokyo', nfK: 0.85, glsl: `
    float h = q.y, k = (0.18 + pow(lum, 1.2)) * (1.15 - 0.4 * h);
    vec3 c = vec3(1.0, 0.38, 0.08) * k;
    if (h > 0.8) c = vec3(1.0, 0.95, 0.85) * 0.6 * (0.18 + pow(lum, 1.2));
    if ((h > 0.44 && h < 0.49) || (h > 0.735 && h < 0.765)) c = vec3(1.0, 0.95, 0.85);` },
  skytree: { flag: 'lm-night-tokyo', nfK: 0.7, glass: /boli/i, glsl: `
    float h = q.y, k = (0.15 + 0.9 * lum) * (0.6 + 0.6 * h), mi = smoothstep(-0.25, 0.25, sin(t * 0.021));   // ~5 мин синьо, ~5 мин лилаво
    vec3 col = mix(vec3(0.25, 0.55, 1.0), vec3(0.55, 0.25, 1.0), mi), wh = vec3(0.9, 0.95, 1.0);
    vec3 c = col * k;
    if (glass > 0.5) c = mix(vec3(0.7, 0.85, 1.0), vec3(0.85, 0.75, 1.0), mi) * 0.6;
    if (h > 0.75) c = wh * 0.5 * k;
    if ((h > 0.545 && h < 0.57) || (h > 0.70 && h < 0.72)) c = wh * 1.2;` },
  // lm-night-sf: Голдън Гейт — кулите златисто-оранжеви (International Orange), по-силно отдолу; въжетата — по-слабо; по ръбовете на платното — редица топли лампи; платното — тъмно (q.z — по дължината)
  goldengate: { flag: 'lm-night-sf', nfK: 0.85, glsl: `
    float w = q.x, L = q.z, h = q.y;
    bool tower = (abs(L - 0.2) < 0.035 || abs(L - 0.8) < 0.035) && h > 0.06;
    vec3 tw = vec3(1.0, 0.42, 0.1), c = vec3(1.0, 0.55, 0.18) * 0.35 * (0.2 + lum);
    if (tower) c = tw * 0.85 * (0.3 + lum) * (0.7 + 0.3 * (1.0 - h));
    if (h < 0.13 && !tower) { c = tw * 0.05; if (h > 0.075 && abs(w - 0.5) > 0.33 && abs(w - 0.5) < 0.4 && fract(L * 90.0) < 0.14) c = vec3(1.0, 0.72, 0.32) * 1.8; }` },
  // lm-night-london: Уестминстър — топли златисти прожектори по фасадите; часовниковата кула (до единия край) — по-ярък връх и 4 светещи кремаво-бели циферблата (кръгове в средата на стените)
  westminster3: { flag: 'lm-night-london', nfK: 1.0, glsl: `
    vec3 warm = vec3(1.0, 0.46, 0.07), c = warm * (0.12 + 1.9 * pow(lum, 1.5));   // собственикът (снимка, „виж цветовете“): наситено златисто-оранжево, ярко
    float dx = (q.x - 0.038) * s.x, dy = (q.z - 0.895) * s.z, dz = (q.y - 0.555) * s.y;
    bool bb = abs(dx) < 0.1 && abs(dy) < 0.1;
    if (bb && q.y > 0.66) c = warm * (0.5 + 1.6 * pow(lum, 1.1));
    float r = abs(dx) > abs(dy) ? length(vec2(dy, dz)) : length(vec2(dx, dz)), e = max(abs(dx), abs(dy));
    if (bb && r < 0.05 && e > 0.04 && q.y > 0.48 && q.y < 0.63) c = vec3(1.0, 0.9, 0.62) * 2.0;` },
  // lm-night-london: Лондонското око — обиколката и спиците сини (празник — розово-червени), кабинките — топло бяло, краката — тъмни;
  // частите — по цвета от палитрата (линейно: сивото на обиколката ~0,1, окачването ~0,2, белите кабинки > 0,6, тъмносиньото < 0,05)
  londoneye2: { flag: 'lm-night-london', nfK: 1.0, glsl: `
    vec3 col = mix(vec3(0.12, 0.35, 1.0), vec3(1.0, 0.2, 0.45), hol), c = vec3(0.02, 0.025, 0.04);
    if (lum > 0.06 && lum < 0.14) c = col * 1.1;
    else if (lum >= 0.14 && lum < 0.3) c = col * 0.35;
    else if (lum > 0.6) c = vec3(1.0, 0.93, 0.8);` },
  // lm-night-sofia: Александър Невски (собственикът, 01.11: снимка — „ето как свети“; одобрено в Blender „ок вкарваме го“): фасадите — наситено златисто-жълти
  // прожектори, барабанът под главния купол — кремаво бял, зелените куполи — тъмнозелени, позлатените — златни, прозорците и вратите — тъмни (частите — по материалите AN_*)
  nevsky: { flag: 'lm-night-sofia', nfK: 1.0, cls: n => /roof_Gold/.test(n) ? 2 : n === 'AN_roof' ? 1 : /windows/.test(n) ? 3 : /door/.test(n) ? 4 : 0, glsl: `
    float h = q.y, k = clamp((h - 0.55) / 0.15, 0.0, 1.0), cl = glass;
    vec3 c = mix(vec3(1.0, 0.6, 0.18), vec3(1.0, 0.9, 0.72), k) * (0.12 + 1.0 * pow(lum, 1.6));
    if (cl > 0.5 && cl < 1.5) c = vec3(0.2, 0.55, 0.32) * (0.1 + 0.6 * pow(lum, 1.3));
    else if (cl > 1.5 && cl < 2.5) c = vec3(1.0, 0.62, 0.12) * (0.4 + 1.3 * lum);
    else if (cl > 2.5 && cl < 3.5) c = vec3(1.0, 0.6, 0.3) * 0.05;
    else if (cl > 3.5) c = vec3(1.0, 0.6, 0.3) * 0.1;` },
};
export const lmNightKinds = () => Object.keys(CFG).filter(k => feature(CFG[k].flag));
// → броят на материалите (0 — няма настройка за този вид или флагът е изключен)
export function lmNight(root, kind) {
  const C = CFG[kind]; if (!C || !feature(C.flag)) return 0;
  if (root.userData.lmNight) return 0; root.userData.lmNight = 1;
  root.updateMatrixWorld(true);   // спрямо корена (Голдън Гейт се завърта при поставянето — осите на модела остават същите)
  const inv = root.matrixWorld.clone().invert(), bb = new THREE.Box3(), tb = new THREE.Box3();
  root.traverse(o => { if (!o.isMesh) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); bb.union(tb.copy(o.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld))); });
  const sz = bb.getSize(new THREE.Vector3()), S = new THREE.Vector3(sz.x / sz.y, 1, sz.z / sz.y);
  const norm = new THREE.Matrix4().makeScale(1 / Math.max(sz.x, 1e-6), 1 / Math.max(sz.y, 1e-6), 1 / Math.max(sz.z, 1e-6)).multiply(new THREE.Matrix4().makeTranslation(-bb.min.x, -bb.min.y, -bb.min.z));
  let n = 0;
  root.traverse(o => { if (!o.isMesh) return; const M = new THREE.Matrix4().multiplyMatrices(norm, inv).multiply(o.matrixWorld);
    o.material = [].concat(o.material).map(m0 => { if (!m0 || !('emissive' in m0)) return m0; const m = m0.clone();
      const glass = C.cls ? C.cls(m.name) : C.glass && C.glass.test(m.name) ? 1 : 0;   // cls — номер на частта по името на материала (Невски)
      m.userData.lmNight = 1; m.userData.nightFloors = true; m.userData.nfK = C.nfK; m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = 0; NF_MATS.add(m); n++;
      m.onBeforeRender = () => { T.value = performance.now() / 1000; HOL.value = holidayNow() ? 1 : 0; };
      m.onBeforeCompile = sh => { sh.uniforms.uLnM = { value: M }; sh.uniforms.uLnT = T; sh.uniforms.uLnG = { value: glass }; sh.uniforms.uLnS = { value: S }; sh.uniforms.uLnH = HOL;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 uLnM; varying vec3 vLnQ;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLnQ = (uLnM * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform float uLnT, uLnG, uLnH; uniform vec3 uLnS; varying vec3 vLnQ;\nvec3 lnNight(vec3 q, vec3 s, float lum, float glass, float t, float hol) {${C.glsl}\n  return c; }`)
          .replace('#include <emissivemap_fragment>', `float lnLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
            totalEmissiveRadiance *= lnNight(clamp(vLnQ, 0.0, 1.0), uLnS, lnLum, uLnG, uLnT, uLnH);
            diffuseColor.rgb *= 1.0 - 0.75 * clamp(emissive.r / ${C.nfK.toFixed(2)}, 0.0, 1.0);`); };
      m.customProgramCacheKey = () => 'lmnight-' + kind + glass; m.needsUpdate = true; return m; });
    if (o.material.length === 1) o.material = o.material[0]; });
  return n;
}
