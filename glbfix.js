// glbfix.js — ⚡ общо за всички GLB модели (флаг perf-fix; _source/tasks/perf-report.md #1 и #3), веднъж при зареждането:
//   • transmission > 0 („истинско“ стъкло — шамандурите Navigation_Buoy_4k): three.js рисува цялата сцена втори път заради него
//     (renderTransmissionPass, 11 хил. → 6 хил. draw calls) → обикновена прозрачност;
//   • прозрачните двустранни материали (стъкла, косите на хората): three r160 ги рисува на два прохода и всеки път им пише
//     needsUpdate (setProgram/getParameters ≈ 13–25% от процесора) → forceSinglePass.
// Закача се на GLTFLoader.prototype.parse — минават всички модули (game.js, directors3d, landmarks, station…), без да се пипат.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ImageBitmapLoader } from 'three';
import { feature } from './lab/feature.js';

export function fixMaterial(m) {
  if (!m) return;
  if (m.transmission > 0) { m.transmission = 0; m.transparent = true; m.opacity = Math.min(m.opacity ?? 1, 0.6); m.depthWrite = false; m.needsUpdate = true; }
  if (m.transparent && m.side === 2 && !m.forceSinglePass) m.forceSinglePass = true;   // 2 = THREE.DoubleSide
}
export function fixScene(root) { root && root.traverse && root.traverse(o => { if (o.material) for (const m of [].concat(o.material)) fixMaterial(m); }); }

if (feature('perf-fix') && !GLTFLoader.prototype.parse.__fix) {
  const parse0 = GLTFLoader.prototype.parse;
  const parse = function (data, path, onLoad, onError) {
    return parse0.call(this, data, path, g => { try { fixScene(g.scene); for (const s of g.scenes || []) if (s !== g.scene) fixScene(s); } catch (e) { } onLoad(g); }, onError);
  };
  parse.__fix = true; GLTFLoader.prototype.parse = parse;
}

// img-retry: картинките вътре в GLB (GLTFLoader → ImageBitmapLoader: fetch(blob:) + createImageBitmap). При град ~1700 картинки тръгват
// наведнъж (до ~750 едновременно декодиране) и при натоварен Chrome (памет, рестарт на GPU процеса) част от тях отказват →
// „THREE.GLTFLoader: Couldn't load texture blob:…“ и моделът остава без текстура. Тук: до 12 наведнъж и още 2 опита (blob адресът
// при грешка не се освобождава — GLTFLoader го пуска чак след успех). Само blob: адресите; ?noimgq — без опашката (за сравнение).
if (!ImageBitmapLoader.prototype.load.__q && !/[?&]noimgq\b/.test(location.search)) {
  const load0 = ImageBitmapLoader.prototype.load, MAXQ = 12, q = [], st = { n: 0, retried: 0, failed: 0, peak: 0 }; let act = 0;
  const pump = () => { while (act < MAXQ && q.length) { act++; st.peak = Math.max(st.peak, act); q.shift()(); } };
  const load = function (url, onLoad, onProgress, onError) {
    if (typeof url !== 'string' || !url.startsWith('blob:')) return load0.call(this, url, onLoad, onProgress, onError);
    st.n++; let tries = 0;
    const go = () => load0.call(this, url, b => { act--; pump(); if (onLoad) onLoad(b); }, onProgress, e => {
      act--; if (++tries <= 2) { st.retried++; setTimeout(() => { q.push(go); pump(); }, 400 * tries); pump(); return; }
      st.failed++; pump(); if (onError) onError(e); });
    q.push(go); pump();
  };
  load.__q = true; ImageBitmapLoader.prototype.load = load;
  window.__imgQ = () => ({ ...st, act, queued: q.length });
}
