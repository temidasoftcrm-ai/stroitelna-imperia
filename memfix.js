// memfix.js — по-малко памет за текстурите на моделите.
// Всеки GLB носи свое копие на картинките (напр. обща colormap.png на Kenney в десетки къщи) и браузърът пази
// всяко копие два пъти: декодирано в паметта и качено на видеокартата. Тук еднаквите картинки от всички GLB
// се свеждат до една обща (texture.source): three.js качва общия източник веднъж, а копията се освобождават.
// Обектите Texture остават отделни (свои offset/repeat), сменя се само източникът. Зарежда се преди game.js.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { feature } from './lab/feature.js';
import { Texture, BufferAttribute, StaticDrawUsage } from 'three';
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
// 🧠 mem-tex2 (T3, паметта в късна игра): на „Средно“ текстурите на забележителностите (assets/heavy/lm) — до 1024 px (досега в пълен размер, до 2048² — ~21 MB всяка); на „Високо“ — както досега
const MT2 = feature('mem-tex2') && gfxLevel() === 'mid', MT2_LM = 1024;
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
  if (SHRINK && (!lm || VLT || MT2)) root.traverse(o => { for (const m of [].concat(o.material || [])) for (const key in m) { const v = m[key]; if (v && v.isTexture) shrink(v, lm ? (VLT ? VLT_LM : MT2_LM) : MAXT); } });   // vlow-tex: и забележителностите (до 512); mem-tex2: на „Средно“ — до 1024
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
  Object.defineProperty(src, 'data', { configurable: true, get() { if (st.rel) { if (THREE_CHK.test(new Error().stack)) return ph && ph.width === st.rel.w ? ph : (ph = { width: st.rel.w, height: st.rel.h, complete: true, __ph: st }); return st.back(); } if (!d && st.blob) { const ph2 = st.lzph || (st.lzph = { width: st.bw, height: st.bh, complete: false }); if (window.__lzPeek) return ph2; if (THREE_CHK.test(new Error().stack)) { st.lazy(); return ph2; } return st.lazy(); }   /* complete: false — three.js не качва, опитва на следващия кадър (докато декодирането свърши); кодът на играта — 4×4 */ return d instanceof ImageData && !THREE_CHK.test(new Error().stack) ? st.back() : d; }, set(v) { d = v; st.rel = null; st.blob = null; } });
  Object.defineProperty(src, 'needsUpdate', { configurable: true, set(v) { if (v === true && !st.rel) src.version++; } });   // пусната = непроменена (никой няма копие) — клонингът не изисква ново качване
  st.drop = () => { const im = d; d = null; if (im && im.close) im.close(); else if (im instanceof HTMLCanvasElement) im.width = im.height = 0; };
  st.peek = () => d;   // без възстановяване (за измерванията)
  // 🧠 mem-lazy-img: неначертаната картинка — само компресираният файл (Blob); при нужда се декодира отново (докато е готова — 4×4 сиво, после ново качване)
  st.evict = (b, w, h) => { d = null; st.blob = b; st.bw = w; st.bh = h; st.lzph = null; lazyStat.n++;   /* без close()/0×0: същата картинка може да е и в друг Source (цветови варианти) — пуска се само нашата препратка, събирачът я освобождава */ lazyStat.mb += w * h * 4 / 2 ** 20; };
  st.lazy = () => { if (!THREE_CHK.test(new Error().stack)) { const f = ((new Error().stack || '').split('\n').slice(2).find(l => !/memfix\.js/.test(l)) || '').replace(/^.*\/([a-z0-9-]+\.js).*$/i, '$1').trim().slice(0, 40); lazyStat.readers[f] = (lazyStat.readers[f] || 0) + 1; } if (!st.dec) { const { blob, opts } = st.blob; lazyStat.req++; st.dec = decQ(() => CIB(blob, ...(opts || []))).then(bm => { if (!st.blob) { bm.close(); return; } d = bm; st.blob = null; st.dec = null; lazyStat.back++; }).catch(() => { st.dec = null; }); } return PH4(); };
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
  const f0 = P[fn]; P[fn] = function (...a) { const l = a[a.length - 1]; if (l && l.__ph) a[a.length - 1] = l.__ph.back(true); return f0.apply(this, a); };   // mem-lazy-img: докато се декодира — 4×4
}
function markFree(tex) {
  if (!FREE || !tex || !tex.isTexture || tex.__freeOk || tex.isDataTexture || tex.isCompressedTexture || tex.isVideoTexture || !tex.source) return;
  const im = tex.source.__free ? tex.source.__free.peek() || 1 : tex.source.data;   /* вече пуснат общ източник — без да го връщаме */
  if (im !== 1 && !(im instanceof HTMLCanvasElement || (typeof ImageBitmap !== 'undefined' && im instanceof ImageBitmap))) return;
  tex.__freeOk = 1; freeable(tex.source); const up0 = tex.onUpdate; tex.onUpdate = t => { up0 && up0(t); onUp(t); };
  tex.dispose = function () { this.__gone = 1; const st = this.source.__free; if (st && st.rel) void this.source.data; return Object.getPrototypeOf(this).dispose.call(this); };   // преди изтриването във видеокартата — обратно в паметта
  pend.push(new WeakRef(tex)); if (LAZY) { tex.source.__born = tex.source.__born || performance.now(); lazyAll.push(new WeakRef(tex)); }
}
// невидимите още модели (в кеша, скрити по разстояние) — качват се на порции на заден план, после се пускат и техните копия
// ⚡ mem-lite (4.1.x, паметта на слабите компютри): на „Ниско“/„Много ниско“ невидимите модели НЕ се качват предварително — горният цикъл
// качваше на заден план текстурите на всеки зареден модел (и на неизползваните — други градове, варианти): ~1200 текстури до 512² с мип-нива,
// ~1,5 GB във видеокартата, която при вградената карта е обща памет (2,4 GB и засичане на картата на света). Сега — само каквото се рисува.
// 🧠 mem-lazy-img (T3/T2, 31.10): в късна игра кешът пази модели на всички градове — неначертаните държат декодираните картинки (1,15 GB ImageBitmap
// + 304 MB смалени платна на слаб компютър, където фоновото качване е спряно — mem-lite). Картинка, която 30 s след зареждането още не е качвана,
// пази само компресирания си файл (Blob — webp/png/jpg на GLB, или webp от смаленото платно) и се декодира отново, щом потрябва.
const LAZY = feature('mem-lazy-img') && !/[?&]nolazyimg/.test(location.search), lazyStat = { n: 0, mb: 0, back: 0, req: 0, readers: {} }, lazyAll = [], BLOB = new WeakMap();
const CIB = typeof createImageBitmap === 'function' ? createImageBitmap.bind(window) : null;
if (LAZY && CIB) window.createImageBitmap = function (src, ...a) { const p = CIB(src, ...a); return src instanceof Blob ? p.then(bm => { BLOB.set(bm, { blob: src, opts: a }); return bm; }) : p; };   // GLTFLoader (ImageBitmapLoader): кой Blob стана тази картинка
let decN = 0; const decW = []; const decQ = f => new Promise((res, rej) => { const go = () => { decN++; f().then(res, rej).finally(() => { decN--; const n = decW.shift(); if (n) n(); }); }; if (decN < 4) go(); else decW.push(go); });   // най-много 4 декодирания наведнъж (без буря при нов изглед)
let ph4 = null; const PH4 = () => ph4 || (ph4 = (() => { const c = document.createElement('canvas'); c.width = c.height = 4; const g = c.getContext('2d'); g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, 4, 4); return c; })());
if (LAZY && CIB) setInterval(() => { if (document.hidden) return; const now = performance.now(); let k = 0;
  for (let i = lazyAll.length - 1; i >= 0 && k < 80; i--) { const t = lazyAll[i].deref(); if (!t || t.__gone) { lazyAll.splice(i, 1); continue; } const src = t.source, st = src.__free; if (!st || st.rel || st.blob || st.dec) { if (st && (st.rel || st.blob)) lazyAll.splice(i, 1); continue; }
    if (now - (src.__born || now) < 30000) continue; const im = st.peek(); if (!im || !(im.width > 0)) continue;
    if (R && R.properties.get(src).__version === src.version) continue;   // качена — пуска я tex-free
    const w = im.width, h = im.height;
    if (typeof ImageBitmap !== 'undefined' && im instanceof ImageBitmap) { const b = BLOB.get(im); if (b) { st.evict(b, w, h); lazyAll.splice(i, 1); k++; } }
    else if (im instanceof HTMLCanvasElement) { k++; lazyAll.splice(i, 1); im.toBlob(bl => { if (bl && st.peek() === im && !st.rel && !(R && R.properties.get(src).__version === src.version)) st.evict({ blob: bl, opts: [{ imageOrientation: 'none' }] }, w, h); }, 'image/webp', 0.92); } } }, 4000);
window.__lazyImg = () => ({ on: LAZY, ...lazyStat, mb: Math.round(lazyStat.mb), pending: lazyAll.length, inflight: decN + decW.length });
const MEMLITE = feature('mem-lite') && (/low/.test(gfxLevel()) || gfxWeakGpu());   // и на „Средно“/„Високо“ с вградена видеокарта (там видеопаметта е общата памет)
const pend = []; setInterval(() => { if (!R || document.hidden || MEMLITE) return; for (let n = 0; n < 12 && pend.length;) { const t = pend.shift().deref(); if (!t || t.__gone) continue; const st = t.source.__free; if (!st || st.rel || !st.peek()) continue;
  if (R.properties.get(t.source).__version === t.source.version) continue; try { R.initTexture(t); n++; } catch { } } }, 1500);
if (FREE && !/[?&]nomemfix/.test(location.search)) { const p0 = GLTFLoader.prototype.parse; GLTFLoader.prototype.parse = function (data, path, onLoad, onError) {
  return p0.call(this, data, path, gltf => { try { for (const sc of gltf.scenes || [gltf.scene]) sc.traverse(o => { for (const m of [].concat(o.material || [])) for (const k in m) markFree(m[k]); }); } catch (e) { } onLoad(gltf); }, onError); }; }
// 🧠 mem-data-free (T3): големите DataTexture от платната (texdata.js canvasTex — порталите над магистралите, билбордовете; над 512², т.е. извън texGuard)
// пазеха копие на пикселите (~80 MB в късна игра). След качване в главния рендер копието се пуска; поиска ли го някой (drawable, ново качване) —
// чете се обратно от видеокартата (readBack), както при tex-free.
const DFREE = feature('mem-data-free') && !/[?&]nodatafree/.test(location.search), dfStat = { n: 0, mb: 0, back: 0 };
if (DFREE) window.__freeDataTex = t => { if (!t || !t.isDataTexture || t.__dfree) return; t.__dfree = 1; const up0 = t.onUpdate;
  t.onUpdate = tt => { up0 && up0(tt); dfStat.calls = (dfStat.calls || 0) + 1; const img = tt.image; if (!R || !img || img.__rel || !img.data) { dfStat.skip = (!R ? 'R' : !img ? 'img' : img.__rel ? 'rel' : 'data'); return; } const p = R.properties.get(tt); if (!p.__webglTexture || tt.type !== THREE_UBYTE) { dfStat.skip = 'wt:' + !!p.__webglTexture + ':' + tt.type; return; }
    let d = img.data; const rel = { gt: p.__webglTexture, w: img.width, h: img.height, flipY: tt.flipY }; img.__rel = rel; dfStat.n++; dfStat.mb += d.byteLength / 2 ** 20;
    Object.defineProperty(img, 'data', { configurable: true, get() { if (img.__rel) { const id = readBack(img.__rel, true), px = id && id.data ? id.data : id && id.getContext ? id.getContext('2d').getImageData(0, 0, id.width, id.height).data : new Uint8ClampedArray(img.width * img.height * 4); d = new Uint8Array(px.buffer, px.byteOffset, px.byteLength); img.__rel = null; dfStat.back++; } return d; }, set(v) { d = v; img.__rel = null; } });
    d = null; };
  if (!MEMLITE) dfPend.push(new WeakRef(t)); };   // невидимите (порталите далеч) — качват се на заден план, за да се пусне копието (с дискретна видеокарта паметта отива във видеопаметта; при вградена — не)
const dfPend = []; if (DFREE) setInterval(() => { if (!R || document.hidden) return; for (let n = 0; n < 4 && dfPend.length;) { const t = dfPend.shift().deref(); if (!t || !t.image || t.image.__rel) continue; try { R.initTexture(t); n++; } catch { } } }, 1000);
window.__dataFree = () => ({ on: DFREE, ...dfStat, mb: Math.round(dfStat.mb) });
// 🧠 mem-geo-free (T3, 31.10): масивите с върховете на статичната геометрия (~240 MB в късна игра) остават в паметта и след качването във видеокартата.
// Атрибут на ARRAY_BUFFER, непроменен 20 s след качването, пуска масива си; поиска ли го някой (лъч при пожар, кутия, ново качване) —
// чете се обратно синхронно от видеокартата (WebGL2 getBufferSubData през COPY_READ_BUFFER, без да пипа VAO). Индексите не се пипат
// (ELEMENT_ARRAY_BUFFER не се чете обратно). Загубен контекст → буферите са изгубени → при възстановяване страницата се презарежда (записът е направен).
const GEO = feature('mem-geo-free') && !/[?&]nogeofree/.test(location.search) && typeof WebGL2RenderingContext !== 'undefined', geoStat = { n: 0, mb: 0, back: 0, fail: 0 }, geoAll = [];
let lastUp = null, EMPTY_GEO = null;
if (GEO) { const bd = WebGL2RenderingContext.prototype.bufferData; WebGL2RenderingContext.prototype.bufferData = function (target, src, usage, ...r) { lastUp = target === this.ARRAY_BUFFER && src && src.byteLength > 0 && usage === this.STATIC_DRAW ?   /* и малките: изгледите на един GLB делят буфер — и един жив държи целия */ { gl: this, buf: this.getParameter(this.ARRAY_BUFFER_BINDING) } : null; return bd.call(this, target, src, usage, ...r); };
  BufferAttribute.prototype.onUploadCallback = function () { const u = lastUp; lastUp = null; if (!u || this.__geo || this.usage !== StaticDrawUsage || this.isInstancedBufferAttribute || !R || u.gl !== R.getContext()) return; this.__geo = { gl: u.gl, buf: u.buf, v: this.version, t: performance.now() }; geoAll.push(new WeakRef(this)); };
  setInterval(() => { if (document.hidden) return; const now = performance.now(); for (let i = geoAll.length - 1; i >= 0; i--) { const at = geoAll[i].deref(); if (!at) { geoAll.splice(i, 1); continue; } const g = at.__geo; if (!g || g.freed) { geoAll.splice(i, 1); continue; } if (at.version !== g.v) { geoAll.splice(i, 1); continue; } if (now - g.t < 20000) continue; geoFree(at); geoAll.splice(i, 1); } }, 5000);
  addEventListener('webglcontextrestored', () => { if (geoStat.n) { try { sessionStorage.setItem('stroi-geo-reload', '1'); } catch { } location.reload(); } }, true); }
function geoFree(at) { const g = at.__geo, arr = at.array; if (!arr || !arr.byteLength) return; const C = arr.constructor, len = arr.length; let a = null; g.freed = 1; geoStat.n++; geoStat.mb += arr.byteLength / 2 ** 20;
  Object.defineProperty(at, 'array', { configurable: true, get() { if (!a && g.freed && window.__lzPeek) return EMPTY_GEO || (EMPTY_GEO = new Float32Array(0)); if (!a && g.freed) { a = new C(len); const gl = g.gl; try { if (gl.isContextLost() || !gl.isBuffer(g.buf)) throw 0; const pb = gl.getParameter(gl.COPY_READ_BUFFER_BINDING); gl.bindBuffer(gl.COPY_READ_BUFFER, g.buf); gl.getBufferSubData(gl.COPY_READ_BUFFER, 0, a); gl.bindBuffer(gl.COPY_READ_BUFFER, pb); geoStat.back++; } catch { geoStat.fail++; } g.freed = 0; } return a; }, set(v) { a = v; g.freed = 0; } }); }
window.__geoFree = () => ({ on: GEO, ...geoStat, mb: Math.round(geoStat.mb), pending: geoAll.length });
window.__texFree = () => ({ on: FREE, ...freeStat, freedMB: Math.round(freeStat.freedMB), backMs: Math.round(freeStat.backMs) });
