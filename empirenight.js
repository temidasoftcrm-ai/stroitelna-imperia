// empirenight.js — 🌃 empire-night3: Емпайър Стейт нощем по снимките на собственика (01.11: „е това е друго - ТОП нямам думи“, одобрено в Blender).
// Моделът empire3.glb = empire2.glb + изпечена карта „nightdata“ (emissiveTexture, 2048, RGB без алфа, lossless WebP; _source/empire-night/mkdata.py):
//   R — 255 прозорец (тялото под короната, само стените, по етажи) / 128 прожектор / 0 — нищо;
//   G — прозорец: случаен номер на етажа; прожектор: височината в осветената зона (0 — 72-ри етаж … 1 — върхът на антената);
//   B — прозорец: случаен номер на прозореца; прожектор: силата му (короната — по-ярко нагоре, мачтата, лентите по шпила, „мийката“ над всяко стъпало).
// Шейдърът (същата формула като прегледа в Blender — _source/empire-night/preview.py):
//   прозорците — ~28 % отделни + рядко цял етаж, топли и приглушени; рядко някой се пали/гаси (всеки — на 10–20 мин);
//   прожекторът — топло кремаво (короната) → бяло (мачтата и шпилът), × яркостта на текстурата (ребрата и камъкът светят повече от стъклото);
//   празник (Нова година, 4 юли, Коледа — по датата на компютъра; или setEmpireHoliday) — една дъга отдолу нагоре по короната и шпила, бавно се движи.
// Денем — нищо (daynight.js: emissiveIntensity = нощта × nfK през NF_MATS).
import * as THREE from 'three';
import { NF_MATS } from './nightfloors.js';

const U = { t: { value: 0 }, hol: { value: 0 } };
let forced = null;
export function setEmpireHoliday(on) { forced = on == null ? null : !!on; }   // Лабораторията: true/false — насила; null — по датата
export const holidayNow = () => forced ?? holidayToday();   // и за lmnight.js (Лондонското око)
function holidayToday() {
  const d = new Date(), m = d.getMonth() + 1, day = d.getDate();
  return (m === 12 && day >= 24) || (m === 1 && day === 1) || (m === 7 && day === 4);   // Коледа и Нова година (24.12–01.01), 4 юли
}
// → броят на материалите с картата (0 — моделът е без нея: старият empire2 / chrysler)
// cfg: key — кешът на шейдъра; warm/cool — цветът на прожектора (топло долу → студено от G ∈ coolG нагоре); tex — × яркостта на текстурата (Емпайър: ребрата);
//      flK — общ множител на прожектора; hol — празничната дъга
const EMPIRE = { key: 'empire-night3', warm: [1.0, 0.78, 0.5], cool: [0.9, 0.94, 1.0], coolG: [0.36, 0.48], tex: 1, flK: 1, hol: 1 };
// 🌃 chrysler-night3 (собственикът, 01.11: „ок ТОП“; по 3 снимки): триъгълните прозорци в арките на короната — ярко топло бяло, стоманата — тъмна;
// силата вече е изпечена × текстурата (_source/chrysler-night/mkdata.py) — тук без нея; без празник
export const CHRYSLER = { key: 'chrysler-night3', warm: [1.0, 0.88, 0.7], cool: [0.95, 0.97, 1.0], coolG: [0.45, 0.55], tex: 0, flK: 0.42, hol: 0 };
const v3 = a => `vec3(${a.map(x => x.toFixed(3)).join(', ')})`;
export function empireNight(root, cfg = EMPIRE) {
  let n = 0;
  root.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) { const t = m && m.emissiveMap; if (!t || t.name !== 'nightdata' || m.userData.lmNight) continue;
    t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.NearestFilter;   // данни — без смесване на съседните тексели
    m.userData.lmNight = m.userData.empireNight = 1; m.userData.nightFloors = true; m.userData.nfK = 2.6;
    m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = 0; NF_MATS.add(m); n++;
    m.onBeforeRender = () => { U.t.value = performance.now() / 1000; U.hol.value = cfg.hol && (forced ?? holidayToday()) ? 1 : 0; };
    m.onBeforeCompile = sh => { sh.uniforms.uEnT = U.t; sh.uniforms.uEnHol = U.hol;
      sh.fragmentShader = 'uniform float uEnT, uEnHol;\nfloat enH(float a) { return fract(sin(a) * 43758.5453); }\nvec3 enHsv(float h) { vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); return mix(vec3(1.0), k, 0.85); }\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `
        vec4 enD = texture2D(emissiveMap, vEmissiveMapUv);
        float enG = floor(enD.g * 255.0 + 0.5) / 255.0, enB = floor(enD.b * 255.0 + 0.5) / 255.0;
        float enW = step(0.75, enD.r), enF = step(0.25, enD.r) * (1.0 - enW);
        // прозорците
        float enLit = max(step(enH(enB * 127.1 + enG * 311.7), 0.28), step(0.9, enH(enG * 91.7)));
        float enKey = enH(enB * 53.7 + enG * 17.3), enSl = floor(uEnT / (600.0 + 600.0 * fract(enKey * 3.1)) + fract(enKey * 5.3));
        enLit = abs(enLit - step(enH(enKey * 91.7 + enSl * 13.13), 0.03));
        vec3 enWin = vec3(1.0, 0.6, 0.28) * 0.4 * enLit * (0.85 + 0.15 * fract(enG * 2.3));
        // прожекторите
        vec3 enCol = mix(${v3(cfg.warm)}, ${v3(cfg.cool)}, clamp((enG - ${cfg.coolG[0].toFixed(3)}) / ${(cfg.coolG[1] - cfg.coolG[0]).toFixed(3)}, 0.0, 1.0));
        enCol = mix(enCol, enHsv(fract(enG * 0.82 + uEnT * 0.003)), uEnHol * step(0.004, enG));
        float enLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 enFl = enCol * min(1.0, 1.25 * enB) * ${cfg.flK.toFixed(3)} * mix(1.0, 0.12 + 2.4 * pow(enLum, 1.6), ${cfg.tex.toFixed(1)});
        totalEmissiveRadiance *= enWin * enW + enFl * enF;
        diffuseColor.rgb *= 1.0 - 0.75 * clamp(emissive.r / 2.6, 0.0, 1.0);   // нощем фасадата — тъмна (лунната светлина не я огрява като денем; nightfloors я тъмнеше)`); };
    m.customProgramCacheKey = () => cfg.key; m.needsUpdate = true; } });
  return n;
}
