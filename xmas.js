// xmas.js — 🎄 xmas (f9): Коледа по календара на играта (1 декември — 6 януари): голяма елха със светлини и звезда на главния площад,
// светещи звездички по уличните лампи, нощем — по-топли прозорци, част от тях с червени/зелени отблясъци. Извън сезона — нищо.
// const x = createXmas({ parent, spot() → [x, z] | null, lamps() → [{x, y, z}], season() → bool, night() → 0…1, winMats() → Set });  x.update(dt); x.clear()
import * as THREE from 'three';

const COLS = [0xff3b30, 0xffcc00, 0x34c759, 0x0a84ff, 0xff9f0a, 0xffffff];
function tree(H = 14) {
  const g = new THREE.Group(), green = new THREE.MeshStandardMaterial({ color: 0x1f5d34, roughness: 0.9, flatShading: true });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.6, 8), new THREE.MeshStandardMaterial({ color: 0x5b3a22 })); trunk.position.y = 0.8; g.add(trunk);
  const tiers = 5; for (let i = 0; i < tiers; i++) { const r = (H * 0.36) * (1 - i / (tiers + 0.6)), h = H * 0.3, c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 14), green); c.position.y = 1.4 + i * H * 0.17 + h / 2; c.castShadow = true; g.add(c); }
  // светлините: спирала около конуса — инстанции с цвят; примигват
  const N = 180, lg = new THREE.SphereGeometry(0.16, 6, 4), lm = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), L = new THREE.InstancedMesh(lg, lm, N), m = new THREE.Matrix4(), col = new THREE.Color();
  for (let i = 0; i < N; i++) { const t = i / N, y = 1.6 + t * H * 0.92, r = (H * 0.36) * (1 - t) * 0.98 + 0.25, a = t * Math.PI * 2 * 7; m.makeTranslation(Math.cos(a) * r, y, Math.sin(a) * r); L.setMatrixAt(i, m); L.setColorAt(i, col.setHex(COLS[i % COLS.length])); }
  L.instanceColor.needsUpdate = true; g.add(L); g.userData.lights = L;
  // звездата на върха
  const sh = new THREE.Shape(); for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 0.45 : 1.1; k ? sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  const star = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.25, bevelEnabled: false }).center(), new THREE.MeshBasicMaterial({ color: 0xffd84a, toneMapped: false })); star.position.y = 1.6 + H * 0.97; g.add(star); g.userData.star = star;
  return g;
}
export function createXmas(deps) {
  let G = null, deco = null, t = 0, winSaved = null;
  function build() {
    G = new THREE.Group(); G.name = 'xmas'; deps.parent().add(G);
    const p = deps.spot(); if (p) { const tr = tree(14); tr.position.set(p[0], 0, p[1]); G.add(tr); G.userData.tree = tr; }
    // по лампите: малка светеща звезда на върха (инстанции)
    const L = deps.lamps(); if (L.length) { const sh = new THREE.Shape(); for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 0.16 : 0.42; k ? sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      deco = new THREE.InstancedMesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false }), L.length); const m = new THREE.Matrix4(), c = new THREE.Color();
      L.forEach((q, i) => { m.makeTranslation(q.x, q.y + 0.9, q.z); deco.setMatrixAt(i, m); deco.setColorAt(i, c.setHex([0xffd84a, 0xff4d4d, 0x7dff8a][i % 3])); }); deco.instanceColor.needsUpdate = true; deco.frustumCulled = false; G.add(deco); }
  }
  function clear() { if (G) { G.parent && G.parent.remove(G); G.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } G = null; deco = null; restoreWin(); }
  function restoreWin() { if (!winSaved) return; for (const [m, c] of winSaved) m.emissive && m.emissive.copy(c); winSaved = null; }
  function update(dt) {
    if (!deps.season()) { if (G) clear(); return; }
    if (!G || !G.parent) build(); t += dt;
    const n = deps.night(), tr = G.userData.tree;
    if (tr) { const L = tr.userData.lights, c = new THREE.Color(); for (let i = 0; i < L.count; i += 1) { const on = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7)); L.setColorAt(i, c.setHex(COLS[i % COLS.length]).multiplyScalar((0.45 + 0.55 * n) * on)); } L.instanceColor.needsUpdate = true; tr.userData.star.rotation.y = t * 0.6; }
    if (deco) deco.material.color.setScalar(0.4 + 0.6 * n);
    // прозорците нощем: по-топли, всеки трети — с червен/зелен отблясък, който бавно се сменя
    const W = deps.winMats(); if (W && W.size) { if (!winSaved) { winSaved = new Map(); for (const m of W) if (m.emissive) winSaved.set(m, m.emissive.clone()); } let i = 0;
      for (const [m, c0] of winSaved) { const k = i++ % 3; if (k) { m.emissive.copy(c0).lerp(new THREE.Color(1, 0.72, 0.4), 0.3); continue; } const ph = 0.5 + 0.5 * Math.sin(t * 0.7 + i); m.emissive.setRGB(1, 0.25 + 0.5 * ph, 0.25 + 0.15 * (1 - ph)); } }
  }
  return { update, clear, get on() { return !!G } };
}
