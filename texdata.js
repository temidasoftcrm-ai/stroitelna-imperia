// texdata.js — платната → собствени данни (fac-data, T1, 27.10). Chrome понякога губи съдържанието на 2D платната (контекстът се губи при
// натоварване) и при всяко следващо качване в графичната карта текстурата идва празна/черна. Статичните платна (нарисувани веднъж) се снимат
// веднага в Uint8Array → DataTexture (flipY като платното, с mipmaps), така текстурата не зависи от живо платно.
// Платната, които се прерисуват (броячи, часовници, екрани), остават CanvasTexture. drawable(img) — платно за кода, който чете картинката.
import * as THREE from 'three';

const CPU = { willReadFrequently: true }, STAT = { n: 0, px: 0, ms: 0, empty: 0, emptyAt: [] };
export const isEmpty = d => { for (let i = 3; i < d.length; i += 4 * 37) if (d[i]) return false; return true; };   // нито един непрозрачен пиксел (на всеки 37-и)
if (typeof window !== 'undefined') window.__texData = () => ({ ...STAT, ms: Math.round(STAT.ms), emptyAt: STAT.emptyAt.slice(0, 20) });   // колко снимки и колко време (тестовете)
export function canvasTex(c) {
  if (!c || !c.width || !c.height || !c.getContext) return new THREE.CanvasTexture(c);
  const t0 = performance.now(), W = c.width, H = c.height, d = new Uint8Array(c.getContext('2d', CPU).getImageData(0, 0, W, H).data.buffer);
  STAT.n++; STAT.px += W * H; STAT.ms += performance.now() - t0; if (isEmpty(d)) { STAT.empty++; STAT.emptyAt.push(W + 'x' + H); }   // празно платно (изгубено още при рисуването) — за facDiag
  // като CanvasTexture: flipY = true (редът 0 — горе), за да работи и кодът, който после сменя flipY (напр. по GLB текстурата)
  const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); t.flipY = true; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t;
}
// fac-data: кодът, който рисува/чете картинката на текстура (маски, преоцветяване, изрязване), получава платно и за DataTexture
// (image = { data, width, height }, редът 0 — горе, както в платното); кешира се за всяка картинка
const DRAW = new WeakMap();
export function drawable(img) {
  if (!img || !img.data || !img.width || typeof img.getContext === 'function') return img;
  let c = DRAW.get(img); if (c) return c;
  c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  c.getContext('2d', CPU).putImageData(new ImageData(new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.width * img.height * 4), img.width, img.height), 0, 0);
  DRAW.set(img, c); return c;
}
