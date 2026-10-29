// stationarea.js — 🌳 station-area (T1): площадът и паркът около гарата — павиран площад пред сградата с фонтан, пейки и лампи,
// малка детска площадка (пясъчник, люлка, пързалка), дървета по свободните места. Само на свободната земя: free(x, z) от game.js
// (без парцели, улици, вода, паркинга на гарата и депото). Решетка 3 м източно от перона (откъм града), по дължината на гарата.
// const a = buildStationArea({ THREE, parent, X, zs, lv, bld: Box3|null, free, trees: [scene], fountain: () => obj|null, lampMat, poolMat, seed });  a.dispose()
import { fwFx, fwWaterMat } from './fountainwater.js';   // ⛲ fountain-water: вода, струи и пръски във фонтаните
import { feature } from './lab/feature.js';
const C = 3;

export function buildStationArea(o) {
  const { THREE } = o, g = new THREE.Group(); g.name = 'stationArea'; o.parent.add(g);
  const own = [], M = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); own.push(geo); g.add(m); return m; };
  let seed = ((o.seed || 11) % 2147483646) + 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const lv = Math.max(1, o.lv || 1), plen = 30 + lv * 8, X = o.X, zs = o.zs || 0;
  // решетката: x — от ръба на перона на изток, z — от сградата на север до южния край на перона
  const x0 = X + 9, x1 = X + 9 + 66, z0 = zs - plen - 46, z1 = zs + plen + 6, NI = Math.ceil((x1 - x0) / C), NJ = Math.ceil((z1 - z0) / C);
  const bld = o.bld ? o.bld.clone().expandByScalar(2.5) : null;
  const cell = new Uint8Array(NI * NJ);   // 0 — заето, 1 — свободно, 2 — площад, 3 — площадка, 4 — дърво/пейка
  const cx = i => x0 + (i + 0.5) * C, cz = j => z0 + (j + 0.5) * C;
  for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) { const x = cx(i), z = cz(j); if (bld && x > bld.min.x && x < bld.max.x && z > bld.min.z && z < bld.max.z) continue; if (o.free(x, z)) cell[i * NJ + j] = 1; }
  const at = (i, j) => i >= 0 && j >= 0 && i < NI && j < NJ ? cell[i * NJ + j] : 0;
  // свободни квадрати k×k (за фонтана и площадката)
  const square = (i, j, k, v = 1) => { for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) if (at(i + a, j + b) !== v) return false; return true; };
  // входът: източната страна на сградата (или средата на перона, ако сградата я няма)
  const ex = bld ? bld.max.x + 1 : X + 10, ez = bld ? (bld.min.z + bld.max.z) / 2 : zs;
  // ---- площадът: свободните клетки до ~24 м от входа, свързани с него
  const stone = new THREE.MeshStandardMaterial({ color: 0xc9c0ae, roughness: 0.92 }), stone2 = new THREE.MeshStandardMaterial({ color: 0xb3a892, roughness: 0.92 });
  const R = 18 + lv * 1.5, plaza = []; let dbg = null;
  { const seen = new Set(), q = []; let s0 = null, bd = 1e9; for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) if (at(i, j) === 1) { const d = Math.hypot(cx(i) - ex, cz(j) - ez); if (d < bd) { bd = d; s0 = [i, j]; } }
    dbg = { ex: Math.round(ex), ez: Math.round(ez), bd: Math.round(bd), bld: bld ? [bld.min.x, bld.min.z, bld.max.x, bld.max.z].map(Math.round) : null };
    if (s0 && bd < 32) { const sx = cx(s0[0]), sz = cz(s0[1]); q.push(s0); seen.add(s0[0] * NJ + s0[1]); while (q.length) { const [i, j] = q.shift(); if (Math.hypot(cx(i) - sx, cz(j) - sz) > R) continue;   /* площадът — около най-близкото свободно място до входа */ cell[i * NJ + j] = 2; plaza.push([i, j]);
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (i + a) * NJ + j + b; if (at(i + a, j + b) === 1 && !seen.has(k)) { seen.add(k); q.push([i + a, j + b]); } } } } }
  if (plaza.length) { const geo = new THREE.BoxGeometry(C, 0.12, C), im = new THREE.InstancedMesh(geo, stone, plaza.length), m4 = new THREE.Matrix4(); own.push(geo);
    plaza.forEach(([i, j], k) => { im.setMatrixAt(k, m4.makeTranslation(cx(i), 0.06, cz(j))); if ((i + j) % 2) im.setColorAt(k, new THREE.Color(0xd8cfbd)); else im.setColorAt(k, new THREE.Color(0xc4baa5)); });
    im.receiveShadow = true; g.add(im); }
  // фонтанът: в средата на най-голямото 3×3 от площада (≥ 9 м), иначе — без
  let fnt = null; { let best = null; for (const [i, j] of plaza) if (square(i - 1, j - 1, 3, 2)) { const d = Math.hypot(cx(i) - ex, cz(j) - ez); if (d > 7 && (!best || Math.abs(d - 12) < best.d)) best = { i, j, d: Math.abs(d - 12) }; }
    if (best) { const x = cx(best.i), z = cz(best.j); fnt = [x, z]; const f = o.fountain && o.fountain();
      if (f) { const b = new THREE.Box3().setFromObject(f), sz = b.getSize(new THREE.Vector3()), k = 7 / Math.max(sz.x, sz.z, 0.01); f.scale.multiplyScalar(k); f.position.set(x, 0.12, z); g.add(f); }
      else { M(new THREE.CylinderGeometry(3.4, 3.7, 0.7, 28), stone2, x, 0.35, z); const w = M(new THREE.CircleGeometry(3.0, 28), new THREE.MeshStandardMaterial({ color: 0x4f8fb5, roughness: 0.15, metalness: 0.2 }), x, 0.66, z); w.rotation.x = -Math.PI / 2;
        M(new THREE.CylinderGeometry(0.35, 0.5, 2.0, 12), stone2, x, 1.0, z); M(new THREE.CylinderGeometry(1.1, 0.6, 0.25, 16), stone2, x, 2.0, z); if (feature('fountain-water')) { w.material = fwWaterMat(); const fx = fwFx({ water: [[2.09, 1.0]], jet: [2.1, 1.4, 0.07, 0.025], curtains: [[1.12, 2.12, 1.45, 0.67]], splash: [[0.67, 1.45, 22]], crown: [3.5, 2.1, 0.7, 12], u: 7 }); fx.position.set(x, 0, z); g.add(fx); } } } }
  // ---- детската площадка: свободен квадрат 4×4 клетки (12 м), най-близо до площада, но не в него
  let play = null; { let bd = 1e9; for (let i = 0; i < NI - 3; i++) for (let j = 0; j < NJ - 3; j++) if (square(i, j, 4)) { const d = Math.hypot(cx(i + 1.5) - ex, cz(j + 1.5) - ez); if (d > 14 && d < bd) { bd = d; play = [i, j]; } } }
  if (play) { const [pi, pj] = play, x = cx(pi) + 1.5 * C, z = cz(pj) + 1.5 * C; for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) cell[(pi + a) * NJ + pj + b] = 3;
    const rub = new THREE.MeshStandardMaterial({ color: 0x5f8a5a, roughness: 1 }), sand = new THREE.MeshStandardMaterial({ color: 0xe0cf9a, roughness: 1 }), red = new THREE.MeshStandardMaterial({ color: 0xd2483c, roughness: 0.6 }), blu = new THREE.MeshStandardMaterial({ color: 0x2f74c0, roughness: 0.6 }), yel = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6 });
    M(new THREE.BoxGeometry(11.4, 0.08, 11.4), rub, x, 0.04, z).receiveShadow = true;
    M(new THREE.BoxGeometry(3.6, 0.22, 3.6), sand, x - 3, 0.11, z - 3);   // пясъчникът
    for (const s of [-1, 1]) { const p = M(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), red, x + 2.6 + s * 1.5, 1.3, z - 3); p.castShadow = true; }   // люлката
    M(new THREE.CylinderGeometry(0.07, 0.07, 3.1, 6), red, x + 2.6, 2.6, z - 3).rotation.z = Math.PI / 2;
    for (const s of [-0.6, 0.6]) M(new THREE.BoxGeometry(0.5, 0.06, 0.22), blu, x + 2.6 + s, 0.55, z - 3);
    const tw = M(new THREE.BoxGeometry(1.6, 1.8, 1.6), yel, x + 2.4, 0.9, z + 2.6); tw.castShadow = true;   // пързалката: кула и наклон
    const sl = M(new THREE.BoxGeometry(0.9, 0.08, 3.6), blu, x + 2.4, 1.0, z + 4.6); sl.rotation.x = 0.5; sl.castShadow = true;
    M(new THREE.ConeGeometry(1.2, 0.9, 4), red, x + 2.4, 2.25, z + 2.6).rotation.y = Math.PI / 4;
    for (let k = 0; k < 3; k++) M(new THREE.CylinderGeometry(0.06, 0.06, 0.8 + k * 0.4, 6), [red, blu, yel][k], x - 3.2 + k * 1.2, 0.4 + k * 0.2, z + 3); }   // стълбчета за катерене
  // ---- пейките: по ръба на площада (клетка от площада до свободна), с лице навътре; кошчета до някои
  const bench = new THREE.Group(); { const wd = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.8 }), ir = new THREE.MeshStandardMaterial({ color: 0x2f3338, roughness: 0.6 });
    const s = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.5), wd); s.position.y = 0.45; const bk = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.06), wd); bk.position.set(0, 0.75, -0.24);
    bench.add(s, bk); for (const sx of [-0.75, 0.75]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.45, 0.45), ir); l.position.set(sx, 0.22, 0); bench.add(l); } }
  const benches = [], lampsAt = [];
  plaza.forEach(([i, j], k) => { for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (at(i + a, j + b) !== 1) continue; if ((i * 7 + j * 13 + a * 3 + b) % 3) continue;
    benches.push([cx(i) + a * 1.1, cz(j) + b * 1.1, Math.atan2(-a, -b)]); if (benches.length % 3 === 0) lampsAt.push([cx(i) + a * 1.3, cz(j) + b * 1.3]); break; } });
  if (play) { const [pi, pj] = play; for (const [x, z, r] of [[cx(pi) - 1.6, cz(pj) + 4.5, Math.PI / 2], [cx(pi) - 1.6, cz(pj) + 7.5, Math.PI / 2]]) benches.push([x, z, r]); lampsAt.push([cx(pi) - 1.6, cz(pj) - 1]); }
  for (const [x, z, r] of benches.slice(0, 26)) { const b = bench.clone(); b.position.set(x, 0.12, z); b.rotation.y = r; g.add(b); }
  // ---- лампите: по ръба на площада и до площадката; нощем — светли петна
  if (plaza.length > 6) for (let k = 0; k < plaza.length; k += 9) { const [i, j] = plaza[k]; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => at(i + a, j + b) !== 2)) lampsAt.push([cx(i), cz(j)]); }
  { const post = new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.5, metalness: 0.5 }), pg = new THREE.CylinderGeometry(0.07, 0.1, 4.2, 6), hg = new THREE.SphereGeometry(0.28, 10, 8); own.push(pg, hg);
    const seen = []; for (const [x, z] of lampsAt) { if (seen.some(([a, b]) => Math.hypot(a - x, b - z) < 9)) continue; seen.push([x, z]); if (seen.length > 14) break;
      const p = new THREE.Mesh(pg, post); p.position.set(x, 2.1, z); g.add(p); const h = new THREE.Mesh(hg, o.lampMat || post); h.position.set(x, 4.3, z); g.add(h);
      if (o.poolMat) { const pl = M(new THREE.CircleGeometry(6, 20), o.poolMat, x, 0.16, z); pl.rotation.x = -Math.PI / 2; pl.renderOrder = 2; } } }
  // ---- дърветата: по свободните клетки, на ≥ 7 м едно от друго и от площада/площадката; повече до перона (сянка)
  const trees = []; if (o.trees && o.trees.length) { const cand = []; for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) if (at(i, j) === 1 && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => at(i + a, j + b) === 1)) cand.push([i, j, rnd()]);
    cand.sort((a, b) => a[2] - b[2]);
    for (const [i, j] of cand) { const x = cx(i), z = cz(j); if (trees.some(([a, b]) => Math.hypot(a - x, b - z) < 7)) continue; if (fnt && Math.hypot(fnt[0] - x, fnt[1] - z) < 8) continue; trees.push([x, z]); if (trees.length >= 10 + lv * 4) break; }
    trees.forEach(([x, z], k) => { const inner = new THREE.Group(); inner.add(o.trees[k % o.trees.length].clone(true)); inner.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(inner), h = (b.max.y - b.min.y) || 1, s = (6.5 + rnd() * 3) / h;
      inner.scale.setScalar(s); inner.position.set(-(b.min.x + b.max.x) / 2 * s, -b.min.y * s, -(b.min.z + b.max.z) / 2 * s); const w = new THREE.Group(); w.add(inner); w.position.set(x, 0, z); w.rotation.y = rnd() * 6.28;
      w.traverse(m => { if (m.isMesh) m.castShadow = true; }); g.add(w); }); }
  return { group: g, info: { dbg, plaza: plaza.length, fountain: !!fnt, play: !!play, benches: Math.min(26, benches.length), trees: trees.length, free: cell.reduce((a, v) => a + (v ? 1 : 0), 0) }, dispose() { o.parent.remove(g); own.forEach(x => x.dispose()); } };
}
