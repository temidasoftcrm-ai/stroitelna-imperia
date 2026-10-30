// memfix.js — по-малко памет за текстурите на моделите.
// Всеки GLB носи свое копие на картинките (напр. обща colormap.png на Kenney в десетки къщи) и браузърът пази
// всяко копие два пъти: декодирано в паметта и качено на видеокартата. Тук еднаквите картинки от всички GLB
// се свеждат до една обща (texture.source): three.js качва общия източник веднъж, а копията се освобождават.
// Обектите Texture остават отделни (свои offset/repeat), сменя се само източникът. Зарежда се преди game.js.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { feature } from './lab/feature.js';
import { Texture } from 'three';
import { gfx, gfxLevel, gfxWeakGpu } from './gfxpresets.js';   // 🟠 gfx-lite: „Много ниско“ — текстурите до 256 px и без анизотропно филтриране (при зареждането)

const N = 128, cv = document.createElement('canvas'); cv.width = cv.height = N;
const g2 = cv.getContext('2d', { willReadFrequently: true });
const bySig = new Map();   // подпис на картинката → общ Source
const done = new WeakSet();
const stat = { seen: 0, shared: 0, savedMB: 0, ms: 0 };

// подпис: размер + хеш от умалено копие N×N (картинките на Kenney са с големи цветни петна — умаленото ги различава)
function sig(img) {
  const w = img.width, h = img.height; if (!w || !h) return null;
  try {
    g2.clearRect(0, 0, N, N); g2.drawImage(img, 0, 0, N, N);
    const d = g2.getImageData(0, 0, N, N).data; let a = 2166136261, b = 7;
    for (let i = 0; i < d.length; i++) { a = Math.imul(a ^ d[i], 16777619); b = (Math.imul(b, 31) + d[i]) | 0; }
    return `${w}x${h}:${(a >>> 0).toString(36)}:${(b >>> 0).toString(36)}`;
  } catch { return null; }
}
function share(tex) {
  if (!tex || !tex.isTexture || done.has(tex)) return;
  done.add(tex);
  const src = tex.source, img = src && src.data;
  if (!img || !(img.width > 0) || tex.isDataTexture || tex.isCompressedTexture) return;
  stat.seen++;
  const t0 = performance.now(), k = sig(img); stat.ms += performance.now() - t0; if (!k) return;
  const s = bySig.get(k);
  if (!s) { bySig.set(k, src); return; }
  if (s === src) return;
  tex.source = s; tex.needsUpdate = true;
  stat.shared++; stat.savedMB += img.width * img.height * 4 / 2 ** 20;
}
// по-малки текстури (feature 'tex512'): картинка над 512 px се смалява до 512 по по-дългата страна — камерата никога не стига толкова близо,
// а 1024² е 4× паметта (и в браузъра, и във видеокартата). Забележителностите (assets/heavy/lm) остават с пълната си разделителна способност.
const LITE_T = feature('gfx-lite') && gfx().tex < 512, MAXT = LITE_T ? gfx().tex : 512, small = new WeakSet(), shrunk = { n: 0, savedMB: 0 };
if (LITE_T) Object.defineProperty(Texture.prototype, 'anisotropy', { get: () => 1, set() { }, configurable: true });   // gfx-lite: всички текстури (и платната на града) — анизотропия 1
function shrink(tex, maxT = MAXT) {
  if (!tex || !tex.isTexture || !tex.source || small.has(tex.source)) return; small.add(tex.source);
  const img = tex.source.data; if (!img || tex.isDataTexture || tex.isCompressedTexture) return;
  const w = img.width, h = img.height; if (!(w > maxT || h > maxT)) return;
  const k = maxT / Math.max(w, h), c = document.createElement('canvas'); c.getContext('2d', { willReadFrequently: true }); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  try { c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); } catch { return; }
  tex.source.data = c; tex.needsUpdate = true; if (img.close) img.close();   // ImageBitmap — освобождава декодираната картинка
  shrunk.n++; shrunk.savedMB += (w * h - c.width * c.height) * 4 / 2 ** 20;
}
// 🟠 vlow-tex (T3, „Много ниско“): още по-малко памет за текстурите — без картите за релеф/грапавост/метал/сенки (нормали, roughness/metalness, AO:
// на слаб компютър разликата почти не се вижда, а всяка е още една картинка до 512² на модел) и забележителностите до 512 px (досега — в пълен размер).
// Махат се преди общия кеш (bySig), за да не останат в паметта. Без картата металността ще е 1 навсякъде (тъмно) — затова 0.
const VLT = feature('vlow-tex') && gfxLevel() === 'vlow' && !/[?&]novlt/.test(location.search), VLT_LM = 512, DROP = ['normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'displacementMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap'], vlt = { dropped: 0, mats: 0 };
function dropMaps(root) {
  root.traverse(o => { for (const m of [].concat(o.material || [])) { if (!m || m.__vlt) continue; m.__vlt = 1; let n = 0;
    for (const k of DROP) if (m[k]) { if (k === 'metalnessMap') m.metalness = 0; if (k === 'roughnessMap') m.roughness = Math.max(0.55, m.roughness || 0); m[k] = null; n++; }
    if (n) { m.needsUpdate = true; vlt.dropped += n; vlt.mats++; } } });
}
export function shareTextures(root, path = '') {
  if (VLT) dropMaps(root);
  shareTextures0(root);   // първо общите картинки (подписът се смята от оригинала — бързо), после смаляване веднъж на източник
  const lm = /\/lm\//.test(path);
  if (SHRINK && (!lm || VLT)) root.traverse(o => { for (const m of [].concat(o.material || [])) for (const key in m) { const v = m[key]; if (v && v.isTexture) shrink(v, lm ? VLT_LM : MAXT); } });   // vlow-tex: и забележителностите (до 512)
}
const SHRINK = (feature('tex512') || LITE_T) && !/[?&]notex512/.test(location.search);   // ?notex512 — за сравнение в тестовете
function shareTextures0(root) {
  root.traverse(o => {
    for (const m of [].concat(o.material || [])) for (const key in m) { const v = m[key]; if (v && v.isTexture) share(v); }
  });
}
// всички GLTFLoader (game.js и модулите) минават оттук: сцената се обработва, преди да стигне до кода на играта
const parse = GLTFLoader.prototype.parse;
if (!/[?&]nomemfix/.test(location.search)) GLTFLoader.prototype.parse = function (data, path, onLoad, onError) {
  return parse.call(this, data, path, gltf => { try { for (const sc of gltf.scenes || [gltf.scene]) shareTextures(sc, path || ''); } catch (e) { } onLoad(gltf); }, onError);
};
window.__texShare = () => ({ shrunk: shrunk.n, shrunkMB: Math.round(shrunk.savedMB), ...stat, savedMB: Math.round(stat.savedMB), ms: Math.round(stat.ms), distinct: bySig.size, vlt: VLT ? vlt : null });
// 🧠 копието в паметта след качването (feature 'tex-free'): смалените платна (по-горе) и картинките на моделите остават в браузъра и след като
// видеокартата вече ги има — при голям град ~450 MB платна + ~200 MB ImageBitmap. След качване в главния рендер картинката се пуска;
// ако някой я поиска пак (друга 3D сцена — бордът, услугите; нов вид филтър; roofs/nightfloors), source.data я възстановява синхронно,
// като я чете обратно от текстурата във видеокартата (readPixels). Преди главният рендер да изтрие текстурата (dispose) — също се възстановява.
const FREE = feature('tex-free') && !/[?&]notexfree/.test(location.search), freeStat = { freed: 0, freedMB: 0, back: 0, backMs: 0, lost: 0 };
let R = null, fb = null;
export function setMainRenderer(r) { R = r; }
function readBack(rel, raw) {   // текстурата от видеокартата → ImageData (raw — за качване: точно същите байтове) или ново платно
  const t0 = performance.now(), { w, h } = rel; let c = null;
  try {
    const gl = R.getContext(); if (gl.isContextLost() || !gl.isTexture(rel.gt)) throw 0;
    const pr = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING), pd = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
    fb = fb || gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rel.gt, 0);
    const px = new Uint8ClampedArray(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, pr); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, pd);
    if (rel.flipY) { const row = w * 4, tmp = new Uint8ClampedArray(row); for (let y = 0; y < h >> 1; y++) { const a = y * row, b = (h - 1 - y) * row; tmp.set(px.subarray(a, a + row)); px.copyWithin(a, b, b + row); px.set(tmp, b); } }
    c = new ImageData(px, w, h); if (!raw) c = toCanvas(c);
  } catch { freeStat.lost++; c = toCanvas(new ImageData(w, h)); }   // загубен контекст — остава празно платно със същия размер
  freeStat.back++; freeStat.backMs += performance.now() - t0; return c;
}
function toCanvas(id) { const c = document.createElement('canvas'); c.width = id.width; c.height = id.height; c.getContext('2d').putImageData(id, 0, 0); return c; }   // платното премултиплицира алфата — само за кода извън three.js
function freeable(src) {   // source.data става „мързеливо“ свойство (веднъж на източник)
  if (src.__free) return src.__free; let d = src.data, ph = null; const st = src.__free = { rel: null };
  st.back = raw => { if (st.rel) { d = readBack(st.rel, raw); st.rel = null; } else if (!raw && d instanceof ImageData) d = toCanvas(d); return d; };
  // three.js чете texture.image и само за проверка (клонинг → нова версия на текстурата, без ново качване) — тогава заместител;
  // ако качването наистина стигне до texImage2D/texSubImage2D, заместителят се сменя там с върнатата картинка (по-долу)
  Object.defineProperty(src, 'data', { configurable: true, get() { if (st.rel) { if (THREE_CHK.test(new Error().stack)) return ph && ph.width === st.rel.w ? ph : (ph = { width: st.rel.w, height: st.rel.h, complete: true, __ph: st }); return st.back(); } return d instanceof ImageData && !THREE_CHK.test(new Error().stack) ? st.back() : d; }, set(v) { d = v; st.rel = null; } });
  Object.defineProperty(src, 'needsUpdate', { configurable: true, set(v) { if (v === true && !st.rel) src.version++; } });   // пусната = непроменена (никой няма копие) — клонингът не изисква ново качване
  st.drop = () => { const im = d; d = null; if (im && im.close) im.close(); else if (im instanceof HTMLCanvasElement) im.width = im.height = 0; };
  st.peek = () => d;   // без възстановяване (за измерванията)
  return st;
}
function onUp(tex) {   // three.js вика onUpdate след всяко качване — в кой да е рендер; пускаме само когато главният го има
  const src = tex.source, st = src.__free; if (!R || !st || st.rel) return;
  const p = R.properties.get(tex), im = st.peek(); if (!p.__webglTexture || R.properties.get(src).__version !== src.version || !im || !(im.width > 0)) return;
  if (tex.premultiplyAlpha || tex.type !== THREE_UBYTE || tex.isRenderTargetTexture) return;
  st.rel = { gt: p.__webglTexture, w: im.width, h: im.height, flipY: tex.flipY }; st.drop(); freeStat.freed++; freeStat.freedMB += st.rel.w * st.rel.h * 4 / 2 ** 20;
}
const THREE_UBYTE = 1009;   // THREE.UnsignedByteType
const THREE_CHK = /setTexture2D|uploadTexture/;
if (FREE) for (const P of [window.WebGL2RenderingContext, window.WebGLRenderingContext].filter(Boolean).map(c => c.prototype)) for (const fn of ['texImage2D', 'texSubImage2D']) {
  const f0 = P[fn]; P[fn] = function (...a) { const l = a[a.length - 1]; if (l && l.__ph) a[a.length - 1] = l.__ph.back(true); return f0.apply(this, a); };
}
function markFree(tex) {
  if (!FREE || !tex || !tex.isTexture || tex.__freeOk || tex.isDataTexture || tex.isCompressedTexture || tex.isVideoTexture || !tex.source) return;
  const im = tex.source.__free ? tex.source.__free.peek() || 1 : tex.source.data;   /* вече пуснат общ източник — без да го връщаме */
  if (im !== 1 && !(im instanceof HTMLCanvasElement || (typeof ImageBitmap !== 'undefined' && im instanceof ImageBitmap))) return;
  tex.__freeOk = 1; freeable(tex.source); const up0 = tex.onUpdate; tex.onUpdate = t => { up0 && up0(t); onUp(t); };
  tex.dispose = function () { this.__gone = 1; const st = this.source.__free; if (st && st.rel) void this.source.data; return Object.getPrototypeOf(this).dispose.call(this); };   // преди изтриването във видеокартата — обратно в паметта
  pend.push(new WeakRef(tex));
}
// невидимите още модели (в кеша, скрити по разстояние) — качват се на порции на заден план, после се пускат и техните копия
// ⚡ mem-lite (4.1.x, паметта на слабите компютри): на „Ниско“/„Много ниско“ невидимите модели НЕ се качват предварително — горният цикъл
// качваше на заден план текстурите на всеки зареден модел (и на неизползваните — други градове, варианти): ~1200 текстури до 512² с мип-нива,
// ~1,5 GB във видеокартата, която при вградената карта е обща памет (2,4 GB и засичане на картата на света). Сега — само каквото се рисува.
const MEMLITE = feature('mem-lite') && (/low/.test(gfxLevel()) || gfxWeakGpu());   // и на „Средно“/„Високо“ с вградена видеокарта (там видеопаметта е общата памет)
const pend = []; setInterval(() => { if (!R || document.hidden || MEMLITE) return; for (let n = 0; n < 12 && pend.length;) { const t = pend.shift().deref(); if (!t || t.__gone) continue; const st = t.source.__free; if (!st || st.rel || !st.peek()) continue;
  if (R.properties.get(t.source).__version === t.source.version) continue; try { R.initTexture(t); n++; } catch { } } }, 1500);
if (FREE && !/[?&]nomemfix/.test(location.search)) { const p0 = GLTFLoader.prototype.parse; GLTFLoader.prototype.parse = function (data, path, onLoad, onError) {
  return p0.call(this, data, path, gltf => { try { for (const sc of gltf.scenes || [gltf.scene]) sc.traverse(o => { for (const m of [].concat(o.material || [])) for (const k in m) markFree(m[k]); }); } catch (e) { } onLoad(gltf); }, onError); }; }
window.__texFree = () => ({ on: FREE, ...freeStat, freedMB: Math.round(freeStat.freedMB), backMs: Math.round(freeStat.backMs) });
