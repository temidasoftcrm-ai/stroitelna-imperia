// memfix.js — по-малко памет за текстурите на моделите.
// Всеки GLB носи свое копие на картинките (напр. обща colormap.png на Kenney в десетки къщи) и браузърът пази
// всяко копие два пъти: декодирано в паметта и качено на видеокартата. Тук еднаквите картинки от всички GLB
// се свеждат до една обща (texture.source): three.js качва общия източник веднъж, а копията се освобождават.
// Обектите Texture остават отделни (свои offset/repeat), сменя се само източникът. Зарежда се преди game.js.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { feature } from './lab/feature.js';

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
const MAXT = 512, small = new WeakSet(), shrunk = { n: 0, savedMB: 0 };
function shrink(tex) {
  if (!tex || !tex.isTexture || !tex.source || small.has(tex.source)) return; small.add(tex.source);
  const img = tex.source.data; if (!img || tex.isDataTexture || tex.isCompressedTexture) return;
  const w = img.width, h = img.height; if (!(w > MAXT || h > MAXT)) return;
  const k = MAXT / Math.max(w, h), c = document.createElement('canvas'); c.getContext('2d', { willReadFrequently: true }); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  try { c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); } catch { return; }
  tex.source.data = c; tex.needsUpdate = true; if (img.close) img.close();   // ImageBitmap — освобождава декодираната картинка
  shrunk.n++; shrunk.savedMB += (w * h - c.width * c.height) * 4 / 2 ** 20;
}
export function shareTextures(root, path = '') {
  shareTextures0(root);   // първо общите картинки (подписът се смята от оригинала — бързо), после смаляване веднъж на източник
  if (SHRINK && !/\/lm\//.test(path)) root.traverse(o => { for (const m of [].concat(o.material || [])) for (const key in m) { const v = m[key]; if (v && v.isTexture) shrink(v); } });
}
const SHRINK = feature('tex512') && !/[?&]notex512/.test(location.search);   // ?notex512 — за сравнение в тестовете
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
window.__texShare = () => ({ shrunk: shrunk.n, shrunkMB: Math.round(shrunk.savedMB), ...stat, savedMB: Math.round(stat.savedMB), ms: Math.round(stat.ms), distinct: bySig.size });
