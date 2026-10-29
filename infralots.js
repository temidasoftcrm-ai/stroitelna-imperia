// infralots.js — 🏗️ infra-lots (T2): парцелът на гарата откъм града — павиран и с бордюр, пред сградата обръщало (таксита, автобуси) с остров
// по средата, такси стоянка до входа, спирка, два паркинга (на север и на юг), лампи. Пътят до гарата (station-access) идва до източния ръб (E, ez).
// const a = buildStationLot({ THREE, parent, X, zs, lv, bld: Box3|null, E, zc, ez, ex, trees: [scene], lampMat, poolMat, seed });  a.dispose()
export function buildStationLot(o) {
  const { THREE } = o, g = new THREE.Group(); g.name = 'stationLot'; o.parent.add(g);
  const own = [], M = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.receiveShadow = true; own.push(geo); g.add(m); return m; };
  const flat = (x0, z0, x1, z1, mat, y) => { const m = M(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat, (x0 + x1) / 2, y, (z0 + z1) / 2); m.rotation.x = -Math.PI / 2; return m; };
  const box = (x0, z0, x1, z1, h, mat, y = 0) => { const m = M(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), mat, (x0 + x1) / 2, y + h / 2, (z0 + z1) / 2); m.castShadow = true; return m; };
  let seed = ((o.seed || 7) % 2147483646) + 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const S = (c, r = 0.92) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const stone = S(0xcdc4b2), asph = S(0x4b4f55, 0.95), kerb = S(0xb9b4aa), grass = S(0x7fa35e, 1), white = new THREE.MeshBasicMaterial({ color: 0xe8e8e4 }), yellow = new THREE.MeshBasicMaterial({ color: 0xf2c200 });
  const X = o.X, zs = o.zs || 0, E = o.E, ZC = o.zc, x0 = X + 8.6, ez = o.ez != null ? o.ez : zs;
  const xb = X + 50.5;   // обръщалото е на едно място за всички нива — пред фасадата на ниво 5 (по-малките сгради: павиран площад до него)
  const ex = o.ex != null ? o.ex : E, edge = Math.abs(ez - zs) > ZC - 1 ? Math.sign(ez - zs) : 0;   // edge: пътят идва през южния (+1) / северния (−1) ръб
  // ---- павето и бордюрът (на север, юг и изток; отвор — където идва пътят)
  flat(x0, zs - ZC, E, zs + ZC, stone, 0.07);
  for (const sg of [-1, 1]) { const z = sg < 0 ? zs - ZC - 0.5 : zs + ZC; if (edge === sg) { box(x0, z, ex - 5, z + 0.5, 0.25, kerb); box(ex + 5, z, E, z + 0.5, 0.25, kerb); } else box(x0, z, E, z + 0.5, 0.25, kerb); }
  if (edge) box(E - 0.5, zs - ZC, E, zs + ZC, 0.25, kerb); else { box(E - 0.5, zs - ZC, E, ez - 6, 0.25, kerb); box(E - 0.5, ez + 6, E, zs + ZC, 0.25, kerb); }
  // ---- обръщалото пред входа: платно 7 м около остров с трева и дървета
  const rx0 = xb + 1, rx1 = E - 8, rz = 30, RW = 7;
  flat(rx0, zs - rz, rx1, zs + rz, asph, 0.13);
  flat(rx0 + RW, zs - rz + RW, rx1 - RW, zs + rz - RW, grass, 0.16);
  box(rx0 + RW, zs - rz + RW, rx1 - RW, zs - rz + RW + 0.3, 0.2, kerb, 0.05); box(rx0 + RW, zs + rz - RW - 0.3, rx1 - RW, zs + rz - RW, 0.2, kerb, 0.05);
  box(rx0 + RW, zs - rz + RW, rx0 + RW + 0.3, zs + rz - RW, 0.2, kerb, 0.05); box(rx1 - RW - 0.3, zs - rz + RW, rx1 - RW, zs + rz - RW, 0.2, kerb, 0.05);
  // от обръщалото до пътя: на изток (ez — срещу обръщалото), покрай източния ръб (пътят е встрани) или право през паркинга до южния/северния ръб
  const zr = Math.max(zs - rz + 4, Math.min(zs + rz - 4, ez)), side = !edge && Math.abs(ez - zr) > 1;
  if (edge) flat(ex - 3.5, edge > 0 ? zs + rz - 0.5 : ez, ex + 3.5, edge > 0 ? ez : zs - rz + 0.5, asph, 0.135);
  else if (!side) flat(rx1 - 0.5, zr - 3.5, Math.max(E, ex) + 0.6, zr + 3.5, asph, 0.13);
  else { flat(rx1 - 0.5, zr - 3.5, E - 0.5, zr + 3.5, asph, 0.13); flat(E - 7.5, Math.min(zr, ez) - 3.5, E - 0.5, Math.max(zr, ez) + 3.5, asph, 0.13); if (ex > E - 3) flat(E - 7.5, ez - 3.5, ex + 0.6, ez + 3.5, asph, 0.13); }
  for (let z = zs - rz + 4; z < zs + rz - 4; z += 6) flat(rx0 + RW / 2 - 0.1, z, rx0 + RW / 2 + 0.1, z + 3, white, 0.17);   // разделителната линия пред входа
  // такси стоянката (жълто) — до входа, и спирката на автобуса — на северното платно
  for (let k = 0; k < 5; k++) { const z = zs - 13 + k * 6.5; flat(rx0 + 0.2, z, rx0 + 2.8, z + 0.18, yellow, 0.17); }
  flat(rx0 + 0.2, zs - 13, rx0 + 0.38, zs + 19.5, yellow, 0.17);
  { const z1 = edge > 0 ? zs - rz - 3 : zs + rz + 0.6, sx = (rx0 + rx1) / 2;   /* спирката — на платното без лентата към пътя */ box(sx - 6, z1, sx + 6, z1 + 2.4, 0.15, kerb, 0.04); const gl = new THREE.MeshStandardMaterial({ color: 0x9fc7dd, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.45 });
    box(sx - 4, z1 + 1.9, sx + 4, z1 + 2.1, 2.4, gl, 0.2); box(sx - 4.3, z1 + 0.2, sx + 4.3, z1 + 2.3, 0.15, S(0x37474f, 0.5), 2.6);
    for (const dx of [-3.9, 3.9]) box(sx + dx - 0.08, z1 + 1.9, sx + dx + 0.08, z1 + 2.1, 2.6, S(0x37474f, 0.5), 0.2);
    const zb = edge > 0 ? zs - rz + 2.4 : zs + rz - 2.6; for (let k = 0; k < 3; k++) flat(sx - 12 + k * 7, zb, sx - 12 + k * 7 + 6, zb + 0.2, yellow, 0.17); }
  // ---- паркингите: на север и на юг от обръщалото, редове по 2,6 м с пътека по средата
  const lots = [[zs + rz + 6, zs + ZC - 3], [zs - ZC + 3, zs - rz - 6]], parkX0 = xb + 1, parkX1 = side ? E - 9 : E - 3;
  const cars = [0xc62828, 0x1565c0, 0xeeeeee, 0x212121, 0x9e9e9e, 0x2e7d32, 0xf9a825, 0x5d4037].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.4 })), cg = new THREE.BoxGeometry(1.8, 1.4, 4.3), cgT = new THREE.BoxGeometry(1.6, 0.6, 2.2); own.push(cg, cgT);
  const glass = S(0x263238, 0.2);
  for (const [za, zb] of lots) { if (zb - za < 14 || parkX1 - parkX0 < 12) continue;
    flat(parkX0, za, parkX1, zb, asph, 0.13); const mid = (za + zb) / 2;
    for (let x = parkX0 + 1.5; x + 2.6 < parkX1 - 6; x += 2.6) for (const [a, b] of [[za + 0.6, mid - 3.2], [mid + 3.2, zb - 0.6]]) {
      flat(x - 0.06, a, x + 0.06, b, white, 0.17);
      if (edge && Math.sign(a - zs) === edge && Math.abs(x + 1.3 - ex) < 5.5) continue;   // лентата към пътя
      if (rnd() < 0.55) { const c = new THREE.Mesh(cg, cars[Math.floor(rnd() * cars.length)]); c.position.set(x + 1.3, 0.75, (a + b) / 2); c.castShadow = true; g.add(c); const t = new THREE.Mesh(cgT, glass); t.position.set(x + 1.3, 1.75, (a + b) / 2 + 0.2); g.add(t); } }
    flat(parkX1 - 6, mid - 3.2, parkX1 - 0.5, mid + 3.2, asph, 0.14); }
  // ---- лампите: около обръщалото и по паркингите; нощем — светли петна
  { const post = new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.5, metalness: 0.5 }), pg = new THREE.CylinderGeometry(0.09, 0.13, 6, 6), hg = new THREE.BoxGeometry(0.9, 0.25, 0.45); own.push(pg, hg);
    const at = []; for (let z = zs - rz; z <= zs + rz; z += 15) at.push([rx1 + 1.2, z]); for (const x of [rx0 + RW + 2, rx1 - RW - 2]) for (const z of [zs - rz + RW + 2, zs + rz - RW - 2]) at.push([x, z]);
    for (const [za, zb] of lots) if (zb - za >= 14) for (let x = parkX0 + 6; x < parkX1 - 4; x += 18) at.push([x, (za + zb) / 2]);
    for (const [x, z] of at) { const p = new THREE.Mesh(pg, post); p.position.set(x, 3, z); g.add(p); const h = new THREE.Mesh(hg, o.lampMat || post); h.position.set(x, 6.05, z); g.add(h);
      if (o.poolMat) { const pl = M(new THREE.CircleGeometry(7, 20), o.poolMat, x, 0.16, z); pl.rotation.x = -Math.PI / 2; pl.renderOrder = 2; } } }
  // ---- дърветата: на острова и по ръба на парцела към града
  const spots = []; for (let z = zs - rz + RW + 4; z <= zs + rz - RW - 4; z += 8) spots.push([(rx0 + rx1) / 2, z]);
  for (let z = zs - ZC + 5; z <= zs + ZC - 5; z += 11) if (Math.abs(z - ez) > 9) spots.push([E - 2.2, z]);
  if (o.trees && o.trees.length) spots.forEach(([x, z], k) => { const inner = new THREE.Group(); inner.add(o.trees[k % o.trees.length].clone(true)); inner.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(inner), h = (b.max.y - b.min.y) || 1, s = (6 + rnd() * 2.5) / h;
    inner.scale.setScalar(s); inner.position.set(-(b.min.x + b.max.x) / 2 * s, -b.min.y * s, -(b.min.z + b.max.z) / 2 * s); const w = new THREE.Group(); w.add(inner); w.position.set(x, 0, z); w.rotation.y = rnd() * 6.28; w.traverse(m => { if (m.isMesh) m.castShadow = true; }); g.add(w); });
  return { group: g, info: { xb: Math.round(xb), ring: [Math.round(rx0), Math.round(rx1)], ez: Math.round(ez) }, dispose() { o.parent.remove(g); own.forEach(x => x.dispose()); } };
}
