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

// fac-data (T1): проверка след качването — текстура с данни в паметта, но празна във видеокартата (качването изгубено) → още едно качване.
// Сравнява средното на ЦЕЛИЯ образ (не ъгъла — ореолите и лъчите са прозрачни по краищата). Връща { checked, fixed }; window.__texGuard — броячът.
export function texGuard(renderer, scene) {
  const gl = renderer.getContext(), P = renderer.properties, fb = gl.createFramebuffer(), seen = new Set(), st = { checked: 0, fixed: 0, list: [] };
  const meanA = (d, n) => { let s = 0; const k = Math.max(1, Math.floor(n / 4096)); let c = 0; for (let i = 0; i < n; i += k, c++) s += d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2] + d[i * 4 + 3]; return s / c / 4; };
  const pr = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  scene.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) { const t = m && m.map; if (!t || !t.isDataTexture || seen.has(t)) continue; seen.add(t);
    const im = t.image, gt = P.get(t).__webglTexture; if (!im || !im.data || !gt || !gl.isTexture(gt)) continue; const W = im.width, H = im.height; if (W * H > 512 * 512) continue;
    const cpu = meanA(im.data, W * H); if (cpu < 8) continue; st.checked++;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, gt, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) continue; const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    if (meanA(px, W * H) < 2) { t.needsUpdate = true; st.fixed++; st.list.push(W + 'x' + H); } } });
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, pr); gl.deleteFramebuffer(fb);   // fb отново: без проверени текстури е вързан екранът (null) → „framebufferTexture2D: no framebuffer bound“
  if (typeof window !== 'undefined') { const g = window.__texGuardStat ||= { runs: 0, fixed: 0 }; g.runs++; g.fixed += st.fixed; } return st;
}
