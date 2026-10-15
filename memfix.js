// memfix.js — по-малко памет за текстурите на моделите.
// Всеки GLB носи свое копие на картинките (напр. обща colormap.png на Kenney в десетки къщи) и браузърът пази
// всяко копие два пъти: декодирано в паметта и качено на видеокартата. Тук еднаквите картинки от всички GLB
// се свеждат до една обща (texture.source): three.js качва общия източник веднъж, а копията се освобождават.
// Обектите Texture остават отделни (свои offset/repeat), сменя се само източникът. Зарежда се преди game.js.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
export function shareTextures(root) {
  root.traverse(o => {
    for (const m of [].concat(o.material || [])) for (const key in m) { const v = m[key]; if (v && v.isTexture) share(v); }
  });
}
// всички GLTFLoader (game.js и модулите) минават оттук: сцената се обработва, преди да стигне до кода на играта
const parse = GLTFLoader.prototype.parse;
if (!/[?&]nomemfix/.test(location.search)) GLTFLoader.prototype.parse = function (data, path, onLoad, onError) {
  return parse.call(this, data, path, gltf => { try { for (const sc of gltf.scenes || [gltf.scene]) shareTextures(sc); } catch (e) { } onLoad(gltf); }, onError);
};
window.__texShare = () => ({ ...stat, savedMB: Math.round(stat.savedMB), ms: Math.round(stat.ms), distinct: bySig.size });
