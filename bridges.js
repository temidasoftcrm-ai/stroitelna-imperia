// bridges.js — 🌉 bridges-real (f6): мостовете над реката в градовете по истинската карта (Париж, Лондон, Москва, Ню Йорк, Вашингтон) — истински модели
// под платното на улицата (платното, лентите и колите остават където са — на нивото на улицата; моделът е под и около тях).
// Къс пролет (< 140 м; и всички в Париж и Москва) — каменен мост с арки („Stone Bridge 3arch“), повторен по дължината и разтегнат по ширината;
// дълъг (в Ню Йорк, Лондон, Вашингтон) — висящ („LowPoly Manhattan Bridge“). Реката е по-дълбока (cityplan2-3d.js: D.wY), за да се виждат арките.
// Моделите: assets/heavy/bridge/stone.glb, assets/heavy/civic/bridge.glb (CREDITS.txt там).
//   bridgesView(G, P, D, { stone, susp }, flood) → група (или null)
import * as THREE from 'three';

// платното в модела (височината на горната настилка, единиците на модела) — измерено в Blender по хоризонталните лица
const DECK = { stone: 13.0, susp: 1.02 };
const LONG = new Set(['newyork', 'london', 'washington']);
const prepped = new WeakMap();
// веднъж за модела: дългата ос — по x, центриран по x/z, платното — на y = 0
function prep(src, kind) {
  if (prepped.has(src)) return prepped.get(src);
  const o = src.clone(true), g = new THREE.Group(); g.add(o); let b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3());
  if (s.z > s.x) { o.rotation.y = Math.PI / 2; o.updateMatrixWorld(true); b = new THREE.Box3().setFromObject(o); s = b.getSize(new THREE.Vector3()); }
  const c = b.getCenter(new THREE.Vector3()); o.position.set(-c.x, -b.min.y - DECK[kind] * (s.y / (b.max.y - b.min.y)), -c.z);
  o.traverse(m => { if (!m.isMesh) return; m.castShadow = m.receiveShadow = true; const mt = m.material; if (mt && mt.metalness > 0.4) { mt.metalness = 0.3; mt.roughness = Math.max(mt.roughness ?? 0.5, 0.5); } });
  const r = { g, L: s.x, W: s.z, H: s.y, deck: DECK[kind] }; prepped.set(src, r); return r;
}
const pt = (rd, s) => { const L = rd.L; let i = 1; while (i < L.length - 1 && L[i] < s) i++; const a = rd.pts[i - 1], b = rd.pts[i], t = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };

export function bridgesView(G, P, D, M, flood) {
  if (!M || !M.stone || !D.wY) return null;
  const root = new THREE.Group(); root.name = 'bridgesReal'; root.userData.extShared = true;
  const S = prep(M.stone, 'stone'), U = M.susp ? prep(M.susp, 'susp') : null, depth = -D.wY + 1.5;   // арките — до дъното (малко под водата)
  if (flood) { flood(S.g, 0xffd9a0, 0.3); if (U) flood(U.g, 0xd8e8ff, 0.4); }
  let n = 0;
  for (const rd of P.roads) { if (!rd.bridge || !rd.bridge.length || /^Ponte|Köprüsü/.test(rd.nm || '')) continue;
    const T = rd.L[rd.L.length - 1];
    for (const [b0, b1] of rd.bridge) { const s0 = Math.max(0, b0 + 1), s1 = Math.min(T, b1 - 1); if (s1 - s0 < 10) continue;
      const a = pt(rd, s0), b = pt(rd, s1), len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 10) continue;
      const W = (rd.w || 8) + 2 * (rd.walk || 2) + 1, ang = -Math.atan2(b[1] - a[1], b[0] - a[0]), w = new THREE.Group();
      w.position.set((a[0] + b[0]) / 2, -0.12, (a[1] + b[1]) / 2); w.rotation.y = ang;
      if (U && (len >= 140 && LONG.has(D.style))) {   // висящ: целият по дължината, кулите — в истинската пропорция
        const k = len / U.L, o = U.g.clone(true); o.scale.set(k, k * 0.8, W / U.W); w.add(o); w.userData.kind = 'susp';
      } else {   // каменен: арките до водата; толкова пъти, колкото се побират с близки до оригинала пропорции
        const sy = depth / S.deck, nT = Math.max(1, Math.round(len / (S.L * sy * 1.15))), sx = len / (nT * S.L);
        for (let i = 0; i < nT; i++) { const o = S.g.clone(true); o.scale.set(sx, sy, W / S.W); o.position.x = -len / 2 + (i + 0.5) * len / nT; w.add(o); }
        w.userData.kind = 'stone'; }
      w.userData.road = rd.id; root.add(w); n++; } }
  if (!n) return null;
  G.add(root); return root;
}
