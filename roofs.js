// roofs.js — различни цветове на покривите на къщите (Kenney City Kit).
// Покривите вземат цвета си от зелените ивици в общата текстура colormap.png. Тук се правят копия на текстурата,
// в които зеленото е пребоядисано в керемидено червено или сиво, и всяка къща получава случаен вариант.
import * as THREE from 'three';
import { canvasTex, drawable } from './texdata.js';   // fac-data (T1): статичните платна → собствени данни (не се губят)

// [hue (0–1), наситеност, яркост] на новия цвят; null = оригиналното зелено
export const ROOF_VARIANTS = [
  { nm: 'керемида', hsl: [0.015, 0.62, 0.47] },
  { nm: 'тъмна керемида', hsl: [0.02, 0.55, 0.36] },
  { nm: 'сиво', hsl: [0.6, 0.06, 0.42] },
  { nm: 'графит', hsl: [0.6, 0.08, 0.28] },
  { nm: 'зелено', hsl: null },
];
// по-често червени и сиви, рядко зелени
const WEIGHTS = [3, 2, 3, 2, 1];

const texCache = new Map();   // източник на оригиналната текстура → [текстура за всеки вариант]
const matCache = new Map();   // оригинален материал → [материал за всеки вариант]

// копие на текстурата: всеки „зелен“ пиксел (зеленото доминира) получава новия оттенък, яркостта се пази
function recolor(tex, hsl) {
  const img = drawable(tex.image), c = document.createElement('canvas');   // fac-data: и DataTexture
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), px = d.data, col = new THREE.Color(), tmp = { h: 0, s: 0, l: 0 };
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], gg = px[i + 1], b = px[i + 2];
    if (!(gg > r + 25 && gg > b + 5)) continue;
    col.setRGB(r / 255, gg / 255, b / 255).getHSL(tmp);
    // градиентът в ивицата (по-светло/по-тъмно) се запазва спрямо средната яркост на зеленото (~0.5)
    col.setHSL(hsl[0], hsl[1], Math.min(0.9, Math.max(0.08, hsl[2] + (tmp.l - 0.5) * 0.8)));
    px[i] = col.r * 255; px[i + 1] = col.g * 255; px[i + 2] = col.b * 255;
  }
  g.putImageData(d, 0, 0);
  const t = canvasTex(c);
  t.colorSpace = tex.colorSpace; t.flipY = tex.flipY; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
  t.magFilter = tex.magFilter; t.minFilter = tex.minFilter;
  return t;
}
function variantMat(mat, v) {
  if (!mat.map || !ROOF_VARIANTS[v].hsl) return mat;
  if (!matCache.has(mat)) matCache.set(mat, []);
  const list = matCache.get(mat);
  if (!list[v]) {
    const key = mat.map.source || mat.map;   // по източника: еднаквите картинки от различни GLB (memfix.js) делят едно пребоядисано копие
    if (!texCache.has(key)) texCache.set(key, []);
    const tl = texCache.get(key);
    tl[v] = tl[v] || recolor(mat.map, ROOF_VARIANTS[v].hsl);
    list[v] = mat.clone();
    list[v].map = tl[v];
  }
  return list[v];
}
// избор на вариант: детерминиран по seed (напр. id на парцела), за да не се сменя цветът при презареждане
export function roofVariant(seed) {
  const tot = WEIGHTS.reduce((a, b) => a + b, 0);
  let r = ((Math.imul((seed | 0) + 1, 2654435761) >>> 0) % 1000) / 1000 * tot;
  for (let k = 0; k < WEIGHTS.length; k++) if ((r -= WEIGHTS[k]) < 0) return k;
  return 0;
}
// пребоядисва покрива на обект (къща), направен от model(); материалите се споделят между къщите с еднакъв вариант
export function tintRoof(obj, seed) {
  const v = roofVariant(seed);
  obj.traverse(o => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(m => variantMat(m, v)) : variantMat(o.material, v);
  });
  return obj;
}
