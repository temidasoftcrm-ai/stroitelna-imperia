// sitemerge.js — ⚡ флаг site-merge: строежите на играча. Мерене (21.11, Пловдив, „Ниско“): 2 строежа = ~226 рисувания от ~910 в кадъра —
// палетът с тухли е 67 части при 2 материала, тоалетната 26 части / 26 материала (едни и същи, повторени), кулокранът 91 / 91,
// всеки работник 13 части / 11 едноцветни материала. Тук — веднъж върху шаблоните (A[n]), преди клонирането:
//   mergeProps(A, имена) — еднаквите материали стават един, после частите на модела се сливат по материал (mergeKids от citycull.js);
//   bakeWorker(сцена) — цветовете на едноцветните материали на човека → цвят на върховете, един общ материал, после mergeSkinned → 1–2 рисувания.
import * as THREE from 'three';
import { mergeKids } from './citycull.js';
import { mergeSkinned } from './skinmerge.js';

const r2 = x => (x == null ? '' : Math.round(x * 100) / 100);
const tx = t => (t ? (t.source ? t.source.uuid : t.uuid) + ':' + t.offset.x + ',' + t.offset.y + ':' + t.repeat.x + ',' + t.repeat.y + ':' + t.rotation + ':' + t.flipY + ':' + t.wrapS + t.wrapT : '');
const matKey = m => [m.type, m.color && m.color.getHexString(), m.emissive && m.emissive.getHexString(), r2(m.emissiveIntensity), r2(m.roughness), r2(m.metalness), r2(m.opacity), m.transparent, r2(m.alphaTest), m.side, m.vertexColors, m.depthWrite, m.flatShading,
  tx(m.map), tx(m.normalMap), tx(m.roughnessMap), tx(m.metalnessMap), tx(m.aoMap), tx(m.emissiveMap), tx(m.alphaMap)].join('|');

// еднаквите по свойства материали в модела → един (Sketchfab повтаря материала на всяка част)
export function dedupeMats(root) {
  const seen = new Map(); let n = 0;
  root.traverse(m => { if (!m.isMesh || Array.isArray(m.material) || !m.material) return; const k = matKey(m.material), s = seen.get(k);
    if (!s) seen.set(k, m.material); else if (s !== m.material) { m.material = s; n++; } });
  return n;
}
export function mergeProps(A, names) {
  const out = {};
  for (const n of names) { const s = A[n] && (A[n].scene || A[n]); if (!s || s.userData.siteMerged) continue; s.userData.siteMerged = 1;
    let b = 0; s.traverse(m => { if (m.isMesh) b++; });
    try { dedupeMats(s); mergeKids(s, 2); } catch (e) { console.warn('site-merge', n, e); }
    let a = 0; s.traverse(m => { if (m.isMesh) a++; }); out[n] = b + '→' + a; }
  return out;
}

// работникът: едноцветните непрозрачни части (без текстури) → цвят на върховете + един материал; после сливане в един SkinnedMesh
export function bakeWorker(root) {
  if (!root || root.userData.workerBaked) return null; root.userData.workerBaked = 1;
  const parts = []; root.traverse(m => { if (!m.isSkinnedMesh || Array.isArray(m.material)) return; const t = m.material;
    if (!t || !t.isMeshStandardMaterial || t.map || t.normalMap || t.transparent || t.alphaTest || t.vertexColors || t.emissiveMap) return; parts.push(m); });
  if (parts.length < 2) return null;
  let rs = 0, ms = 0; for (const m of parts) { rs += m.material.roughness; ms += m.material.metalness; }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rs / parts.length, metalness: ms / parts.length, name: 'workerBaked' });
  const KEEP = new Set(['position', 'normal', 'skinIndex', 'skinWeight']);
  for (const m of parts) { const g = m.geometry.clone(); for (const k of Object.keys(g.attributes)) if (!KEEP.has(k)) g.deleteAttribute(k);
    const c = m.material.color, n = g.attributes.position.count, f = new Float32Array(n * 3); for (let i = 0; i < n; i++) { f[i * 3] = c.r; f[i * 3 + 1] = c.g; f[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(f, 3)); m.geometry = g; m.material = mat; }
  return mergeSkinned(root);
}
