// riohill.js — 🇧🇷 rio-hill (55): Христос Спасителя на хълм в залива пред центъра на Рио (вместо на площада) — като Корковадо над града.
// Хълмът е отделен меш (градовете по плана v2 са равни): стръмен връх с площадка, гранитни скали, гора от зелени кълба, серпентина
// от крайбрежната улица до върха с лампи (светят нощем). Южното подножие стига до брега — всичко откъм сушата е под земята (не влиза в града).
//   buildRioHill({ x, coast, coastAt, start, statue }) → { group, update, kind } — x — центърът; coast — z на брега срещу него (южното подножие стига дотам); coastAt(x) — z на брега; start — [x, z] на кея; statue — buildLandmark('redeemer')
import * as THREE from 'three';

export function buildRioHill({ x: cx, coast, coastAt, start, statue, R = 100, H = 70 }) {
  const rp = 15, TAU = Math.PI * 2;   // rp — равното на върха
  let sd = 917; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const Rt = a => R * (1 + 0.1 * Math.sin(3 * a + 1.3) + 0.06 * Math.sin(5 * a + 0.4));   // подножието — неправилно
  const cz = coast - Rt(Math.PI / 2) * 0.86, g = new THREE.Group(); g.position.set(cx, 0, cz);   // южното подножие (откъм града, +z) — на брега
  const prof = (r, a) => { const Ra = Rt(a); if (r <= rp) return H; if (r >= Ra) return -2 * Math.min(1, (r - Ra) / (0.18 * Ra)); const f = (r - rp) / (Ra - rp); return H * (1 - f) ** 1.6 * (1 + 0.07 * Math.sin(7 * a + 6 * f) * f) + 2.5 * Math.sqrt(1 - f) * Math.min(1, f * 4); };   /* + ниският бряг около подножието */   // по-стръмно горе, полегато долу
  // серпентината: равномерно изкачване по профила, 1,5 оборота от юг (откъм града) по часовниковата стрелка
  const a0 = Math.atan2(start[1] - cz, start[0] - cx), road = [[start[0] - cx, start[1] - cz, 0]];
  for (let i = 0; i <= 240; i++) { const t = i / 240, y = H * Math.min(t, 0.985), a = a0 - t * 1.5 * TAU, f = 1 - Math.sqrt(y / H), r = rp + 2 + f * (Rt(a) - rp - 2); road.push([Math.cos(a) * r, Math.sin(a) * r, y]); }
  const RW = 3.2;   // половината ширина на пътя
  const near = (x, z) => { let best = 1e9, by = 0; for (let i = 1; i < road.length; i++) { const [x0, z0, y0] = road[i - 1], [x1, z1, y1] = road[i], dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / L2)), d = Math.hypot(x - x0 - u * dx, z - z0 - u * dz); if (d < best) { best = d; by = y0 + u * (y1 - y0); } } return [best, by]; };
  const sm = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  // теренът: полярна мрежа; пътят е врязан в склона (стъпало), откъм сушата — под земята
  const NR = 72, NS = 200, pos = [], col = [], idx = [], land = new Float32Array((NR + 1) * NS), C = new THREE.Color();
  for (let i = 0; i <= NR; i++) for (let j = 0; j < NS; j++) {
    const a = j / NS * TAU, r = i / NR * 1.2 * Rt(a), x = Math.cos(a) * r, z = Math.sin(a) * r;
    let y = prof(r, a); const [d, ry] = near(x, z); if (d < RW + 7 && (y > -0.5 || d < RW + 1.5)) y = THREE.MathUtils.lerp(ry - 0.05, y, sm(RW + 1, RW + 7, d));   /* и насип през водата до брега */
    if (cz + z > coastAt(cx + x) - 0.5) y = Math.min(y, -0.4);   // на сушата (южното подножие) — земята на града е над него
    pos.push(x, y, z); land[i * NS + j] = d;
  }
  for (let i = 0; i < NR; i++) for (let j = 0; j < NS; j++) { const a = i * NS + j, b = i * NS + (j + 1) % NS, c = a + NS, e = b + NS; idx.push(a, b, c, b, e, c); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const N = geo.attributes.normal, n3 = (pos.length / 3) | 0;
  for (let k = 0; k < n3; k++) {
    const y = pos[k * 3 + 1], ny = N.getY(k), x = pos[k * 3], z = pos[k * 3 + 2], w = 0.5 + 0.5 * Math.sin(x * 0.11 + Math.cos(z * 0.09) * 2) * Math.cos(z * 0.13 - x * 0.05);
    if (land[k] < RW + 2.2 && y > -0.3) C.setHex(0x9c8a6a);   // насипът на пътя
    else if (y < 0.8) C.setHex(0xd9c99a);   // пясък до водата
    else if (ny < 0.5 && w > 0.3) C.setHex(0x8b8781).offsetHSL(0, 0, (w - 0.5) * 0.08);   // гранитните стени
    else C.setHex(0x3f6e35).lerp(new THREE.Color(0x6f9a4e), w * 0.7);   // гора и поляни
    col.push(C.r, C.g, C.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const hill = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); hill.castShadow = hill.receiveShadow = true; g.add(hill);
  // пътят: лента над стъпалото
  const rp3 = [], ri = [];
  for (let i = 0; i < road.length; i++) { const p = road[Math.max(0, i - 1)], q = road[Math.min(road.length - 1, i + 1)], dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L * RW, nz = dx / L * RW, [x, z, y] = road[i]; rp3.push(x + nx, y + 0.12, z + nz, x - nx, y + 0.12, z - nz); if (i) { const b = (i - 1) * 2; ri.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); } }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp3, 3)); rg.setIndex(ri); rg.computeVertexNormals();
  const asph = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.95, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 })); asph.receiveShadow = true; g.add(asph);
  // гората: кълба по склоновете (без пътя, скалите и върха)
  const TN = 800, tr = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), TN), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3();
  let n = 0;
  for (let it = 0; it < 6000 && n < TN; it++) {
    const a = rnd() * TAU, r = rp + 6 + rnd() * (Rt(a) * 0.97 - rp - 6), x = Math.cos(a) * r, z = Math.sin(a) * r, y = prof(r, a); if (y < 1.5 || cz + z > coastAt(cx + x) - 4) continue;
    const e = 1.5, sl = Math.hypot(prof(r + e, a) - prof(r - e, a), prof(r, a + e / r) - prof(r, a - e / r)) / (2 * e); if (sl > 1.6) continue;   // по гранита — без дървета
    if (near(x, z)[0] < RW + 2.5) continue;
    const s = 2.2 + rnd() * 1.8; M.compose(V.set(x, y + s * 0.7, z), Q.setFromAxisAngle(V.clone().set(0, 1, 0), rnd() * TAU), Sc.set(s, s * (0.85 + rnd() * 0.3), s)); tr.setMatrixAt(n, M);
    tr.setColorAt(n, C.setHex(rnd() < 0.5 ? 0x2f5e2a : 0x3d7a33).offsetHSL(0, 0, (rnd() - 0.5) * 0.06)); n++;
  }
  tr.count = n; tr.castShadow = true; tr.receiveShadow = true; g.add(tr);
  // площадката на върха: светъл паваж, каменна тераса с парапет; статуята — на терасата, с лице към града (юг)
  const stone = new THREE.MeshStandardMaterial({ color: 0xd6cdb9, roughness: 0.9 }), pave = new THREE.Mesh(new THREE.CylinderGeometry(rp + 1, rp + 1, 0.3, 40), new THREE.MeshStandardMaterial({ color: 0xbdb5a4, roughness: 0.95 }));
  pave.position.y = H + 0.05; pave.receiveShadow = true; g.add(pave);
  const ter = new THREE.Mesh(new THREE.CylinderGeometry(10.5, 11.5, 1.6, 40), stone); ter.position.y = H + 0.8; ter.castShadow = ter.receiveShadow = true; g.add(ter);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(10.5, 10.5, 0.9, 40, 1, true), stone); rail.position.y = H + 2.05; g.add(rail);
  const pl = statue.group.children.find(c => c.isMesh && c.geometry?.type === 'BoxGeometry' && c.geometry.parameters?.width === 15); if (pl) pl.visible = false;   // квадратната плоча на модела
  statue.group.position.set(0, H + 1.6, 0); statue.group.scale.setScalar(1.7); statue.group.rotation.y = Math.atan2(start[0] - cx, start[1] - cz); g.add(statue.group);
  // лампите покрай пътя (нощем — топла светлина)
  const LN = 30, post = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.15, 4, 5), new THREE.MeshStandardMaterial({ color: 0x55585c }), LN), bulbM = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffc870, emissiveIntensity: 0 }), bulb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.4, 8, 6), bulbM, LN);
  for (let k = 0; k < LN; k++) { const i = Math.round(4 + k * (road.length - 6) / (LN - 1)), p = road[i], q = road[i + 1], dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz) || 1, x = p[0] - dz / L * (RW + 0.6), z = p[1] + dx / L * (RW + 0.6);
    post.setMatrixAt(k, M.makeTranslation(x, p[2] + 2, z)); bulb.setMatrixAt(k, M.makeTranslation(x, p[2] + 4.1, z)); }
  g.add(post, bulb);
  return { group: g, kind: statue.kind, update(t, night = 0) { statue.update(t, night); bulbM.emissiveIntensity = 1.8 * night; } };
}
