// glbfix.js — ⚡ общо за всички GLB модели (флаг perf-fix; _source/tasks/perf-report.md #1 и #3), веднъж при зареждането:
//   • transmission > 0 („истинско“ стъкло — шамандурите Navigation_Buoy_4k): three.js рисува цялата сцена втори път заради него
//     (renderTransmissionPass, 11 хил. → 6 хил. draw calls) → обикновена прозрачност;
//   • прозрачните двустранни материали (стъкла, косите на хората): three r160 ги рисува на два прохода и всеки път им пише
//     needsUpdate (setProgram/getParameters ≈ 13–25% от процесора) → forceSinglePass.
// Закача се на GLTFLoader.prototype.parse — минават всички модули (game.js, directors3d, landmarks, station…), без да се пипат.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
