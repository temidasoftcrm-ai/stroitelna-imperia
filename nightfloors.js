// nightfloors.js — нощем етажите на реалистичните сгради (assets/commercial) светват: всеки етаж в свой момент
// (докато се свечерява), в свой оттенък — топло жълто, бяло-синкаво или приглушено; ~20% от етажите остават тъмни.
// Прозорците: маска от текстурата на модела (по модел — стъкла „cool“: хладни синкави панели, или „dark“: по-тъмни от рамката).
// Етажът и „коя сграда“: височината в модела и мястото на сградата → различно светене и при еднакви модели.
// daynight.js пали материалите вечер (emissiveIntensity = нощта 0…1). Зад feature('night-floors') — първо в Лабораторията.
import * as THREE from 'three';
import { feature } from './lab/feature.js';

const MODE = { 'building-a': 'dark', 'building-b': 'cool', 'building-c': 'dark', 'building-d': 'dark', 'building-e': 'cool', 'building-f': 'cool',
  'building-g': 'dark', 'building-h': 'dark', 'building-skyscraper-a': 'dark', 'building-skyscraper-b': 'cool', 'building-skyscraper-c': 'cool',
  // Kenney Commercial 2 (обща палитра colormap): стъклата са синкавите петна; високите варианти (@20…) делят материала
  'building-i': 'kenney', 'building-j': 'kenney', 'building-k': 'kenney', 'building-l': 'kenney', 'building-m': 'kenney', 'building-n': 'kenney',
  'building-skyscraper-d': 'kenney', 'building-skyscraper-e': 'kenney',
  bellagio: 'flood' };   // забележителност (landmarks.js) — хотелът в Лас Вегас: цялата фасада в топла светлина (прожектори), етажите леко различни
const FLOORS = n => ({ bellagio: 28, 'building-skyscraper-d': 8, 'building-skyscraper-e': 8 })[n] || (/skyscraper/.test(n) ? 30 : 9);   // приблизителен брой етажи на модела
export const NF_MATS = new Set();   // материалите с нощни етажи — daynight.js ги пали вечер
const masks = new Map();   // изображение → маска (CanvasTexture)

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
  const key = img; if (masks.has(key)) return masks.get(key);
  const w = img.width, h = img.height, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, w, h), p = d.data, L = new Float32Array(w * h), raw = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { const r = p[4 * i] / 255, gg = p[4 * i + 1] / 255, b = p[4 * i + 2] / 255; L[i] = 0.3 * r + 0.59 * gg + 0.11 * b; p[4 * i + 3] = Math.max(r, gg, b) - Math.min(r, gg, b); raw[i] = b - r; }
  if (mode === 'flood') { const t = tex; masks.set(key, t); return t; }   // прожектори: самата текстура свети
  const loc = mode === 'dark' ? box(L, w, h, Math.max(4, (Math.min(w, h) / 24) | 0)) : null;
  const win = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const sat = p[4 * i + 3];
    win[i] = mode === 'cool' ? +(raw[i] > 0.03 && L[i] > 0.15 && L[i] < 0.85 && sat < 0.35) : mode === 'kenney' ? +(raw[i] > 0.06 && L[i] > 0.1 && L[i] < 0.8) : +(L[i] < loc[i] - 0.08 && L[i] < 0.5 && sat < 0.2);
  }
  const a = mode === 'kenney' ? win : box(win, w, h, 1); if (mode !== 'kenney') for (let i = 0; i < w * h; i++) a[i] = +(a[i] > 0.55);   // без тънките линии (палитрата е от петна — без)
  const m = mode === 'kenney' ? a.map(v => v) : box(a, w, h, 1);
  for (let i = 0; i < w * h; i++) { const v = m[i] > 0.3 ? 255 : 0; p[4 * i] = p[4 * i + 1] = p[4 * i + 2] = v; p[4 * i + 3] = 255; }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.flipY = tex.flipY; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
  masks.set(key, t);
  return t;
}
// подготвя моделя веднъж (материалите се делят от всички сгради с този модел)
export function prepNightFloors(root, name) {
  const mode = MODE[name]; if (!mode || !feature('night-floors')) return;
  const bb = new THREE.Box3().setFromObject(root), floorH = Math.max(1e-3, (bb.max.y - bb.min.y) / FLOORS(name)), y0 = bb.min.y;
  root.traverse(o => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (!m || !m.map || m.userData.nightFloors || !('emissive' in m)) continue;
      if (name === 'building-skyscraper-c' && /roof|heli|top/i.test(m.name || '')) continue;
      const mk = maskFor(m.map, mode); if (!mk) continue;
      m.emissiveMap = mk; m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = 0; m.userData.nightFloors = true; m.userData.winK = 1; NF_MATS.add(m);
      m.onBeforeCompile = sh => {
        sh.uniforms.uFloorH = { value: floorH }; sh.uniforms.uY0 = { value: y0 }; sh.uniforms.uFlood = { value: mode === 'flood' ? 1 : 0 };
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vNfY; varying float vNfSeed;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvNfY = transformed.y; vNfSeed = fract(sin(dot(modelMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vNfY; varying float vNfSeed; uniform float uFloorH; uniform float uY0; uniform float uFlood;')
          .replace('#include <emissivemap_fragment>', `
            #ifdef USE_EMISSIVEMAP
              float nNight = emissive.r;   // нощта 0…1 (daynight.js → emissiveIntensity)
              float fl = floor((vNfY - uY0) / uFloorH);
              float r = fract(sin(fl * 91.17 + vNfSeed * 311.7) * 43758.5453);
              float on = step(r, nNight * 1.05) * step(r, 0.8);   // всеки етаж в свой момент; >0.8 — тъмен
              vec2 cell = floor(vEmissiveMapUv * 48.0);   // и отделните прозорци: ~60% светят (иначе стъклената фасада е цялата бяла)
              on *= step(fract(sin(dot(cell, vec2(127.1, 311.7)) + fl * 17.3 + vNfSeed * 91.3) * 43758.5453), 0.6);
              vec3 col = r < 0.3 ? vec3(1.0, 0.72, 0.38) : r < 0.55 ? vec3(0.62, 0.48, 0.3) : vec3(0.85, 0.9, 1.0);
              if (uFlood > 0.5) { on = nNight; col = vec3(1.0, 0.78, 0.5) * (0.8 + 0.4 * r); }   // прожектори: всичко, топло, етажите малко различни
              totalEmissiveRadiance = texture2D(emissiveMap, vEmissiveMapUv).rgb * col * on * (uFlood > 0.5 ? 0.55 : 1.15);
            #endif`);
      };
      m.customProgramCacheKey = () => 'nightfloors2';
      m.needsUpdate = true;
    }
  });
}
