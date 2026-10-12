// greatwall3d.js — 3D за държавната поръчка „Реставрация на Великата китайска стена“ (tenders.js, kind 'greatwall').
// Процедурно: зелени хълмове, по билото им — стената с назъбен парапет и сигнални кули; отпред посетителски център, паркинг и път.
// Реставрацията върви участък по участък (рушащата се стена става нова), после се появяват центърът, паркингът и туристите.
// buildGreatWall(group, deps, opts) → { group, setProg(p 0…1), update(t, night), dispose }; opts: { x, z, rot, scale, prog, sign, ext: [W, D] }.
import * as THREE from 'three';

const mat = (c, r = 0.85, m = 0, e) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...(e ? { emissive: e, emissiveIntensity: 0 } : {}) });
const box = (w, h, d, m, x, y, z, g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };

export function buildGreatWall(group, deps, opts = {}) {
  const g = new THREE.Group(); g.position.set(opts.x || 0, 0, opts.z || 0); g.rotation.y = opts.rot || 0; g.scale.setScalar(opts.scale || 1); group.add(g);
  const [W, D] = opts.ext || [26, 26];
  // хълмовете — сбор от гауски по билото (задната половина на площадката)
  const ridge = x => -D * 0.12 + Math.sin(x * 0.32) * D * 0.13;
  const bumps = [[-W * 0.36, 4.2], [-W * 0.12, 6.0], [W * 0.12, 4.8], [W * 0.36, 6.6]];
  const hill = (x, z) => {
    let h = 0; for (const [bx, a] of bumps) h += a * Math.exp(-((x - bx) ** 2) / (W * W * 0.012) - ((z - ridge(bx)) ** 2) / (D * D * 0.03));
    return h * Math.max(0, Math.min(1, (D * 0.22 - z) / (D * 0.18)));   // отпред терена е равен (центърът и паркингът)
  };
  const hg = new THREE.PlaneGeometry(W, D, 48, 48); hg.rotateX(-Math.PI / 2);
  const pos = hg.attributes.position, col = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = hill(x, z); pos.setY(i, y);
    const k = Math.min(1, y / 6); col.push(0.33 - 0.08 * k, 0.52 - 0.12 * k, 0.24 - 0.06 * k);
  }
  hg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); hg.computeVertexNormals();
  const ground = new THREE.Mesh(hg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); ground.receiveShadow = true; ground.position.y = 0.02; g.add(ground);
  // дървета по склоновете
  const trunk = mat(0x6b4a2b), leaf = mat(0x2f6b34, 0.9);
  for (let i = 0; i < 46; i++) {
    const x = (Math.sin(i * 12.9898) * 0.5) * W * 0.95, z = -D / 2 + 1 + Math.abs(Math.sin(i * 78.233)) * D * 0.62;
    if (Math.abs(z - ridge(x)) < 2.2) continue;
    const y = hill(x, z), t = new THREE.Group(); t.position.set(x, y, z); g.add(t);
    box(0.2, 0.8, 0.2, trunk, 0, 0.4, 0, t); const c = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.6, 7), leaf); c.position.y = 1.4; c.castShadow = true; t.add(c);
  }
  // стената: участъци по билото; всеки има руина (ниска, тъмна, на дупки) и реставриран вид (светъл камък, назъбен парапет)
  const N = 44, x0 = -W / 2 + 0.6, x1 = W / 2 - 0.6, P = [];
  for (let i = 0; i <= N; i++) { const x = x0 + (x1 - x0) * i / N, z = ridge(x); P.push(new THREE.Vector3(x, hill(x, z), z)); }
  const newStone = mat(0xc9b48e, 0.9), oldStone = mat(0x8a7d68, 1), walk = mat(0x9e8f74, 0.95), roofM = mat(0x5a3d2a, 0.8), flagM = mat(0xd62828, 0.7);
  const lampM = mat(0xffe2a0, 0.5, 0, 0xffc860);
  const segs = [];
  for (let i = 0; i < N; i++) {
    const a = P[i], b = P[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z), ang = Math.atan2(b.z - a.z, b.x - a.x), y = (a.y + b.y) / 2;
    const s = new THREE.Group(); s.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2); s.rotation.y = -ang; g.add(s);
    const tilt = Math.atan2(b.y - a.y, len), L = Math.hypot(len, b.y - a.y) + 0.12, H = 1.3;   // наклонена плоча по склона; съседните се застъпват леко
    const ruin = new THREE.Group(); s.add(ruin);
    if (i % 5 !== 2) { const rh = 0.45 + (i * 37 % 5) * 0.1, r0 = box(L * (i % 3 ? 1 : 0.7), rh, 1.0, oldStone, 0, 0, 0, ruin); r0.rotation.z = tilt; r0.position.y = rh / 2 - 0.15; }
    const fix = new THREE.Group(); s.add(fix);
    const sl = new THREE.Group(); sl.rotation.z = tilt; fix.add(sl);
    box(L, H + 0.4, 1.0, newStone, 0, H / 2 - 0.2, 0, sl);
    box(L, 0.06, 0.8, walk, 0, H + 0.03, 0, sl);
    for (const sd of [-1, 1]) for (let k = 0; k < 2; k++) box(L * 0.28, 0.3, 0.14, newStone, (k - 0.5) * L * 0.5, H + 0.15, sd * 0.43, sl);
    segs.push({ ruin, fix });
  }
  // сигнални кули — на всеки 7 участъка; реставрират се заедно с участъка си
  const towers = [];
  for (let i = 5; i < N; i += 11) {
    const a = P[i], t = new THREE.Group(); t.position.copy(a); g.add(t);
    const ruin = new THREE.Group(); t.add(ruin); box(1.5, 1.0, 1.5, oldStone, 0, 0.4, 0, ruin);
    const fix = new THREE.Group(); t.add(fix);
    box(1.7, 2.4, 1.7, newStone, 0, 1.0, 0, fix);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) box(0.26, 0.3, 0.26, newStone, dx * 0.72, 2.35, dz * 0.72, fix);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.7, 4), roofM); roof.position.y = 2.75; roof.rotation.y = Math.PI / 4; roof.castShadow = true; fix.add(roof);
    box(0.04, 0.9, 0.04, mat(0x333333), 0.7, 3.2, 0, fix); box(0.45, 0.26, 0.02, flagM, 0.93, 3.5, 0, fix);
    const lamp = box(0.2, 0.2, 0.2, lampM, 0, 1.7, 0.86, fix);
    towers.push({ i, ruin, fix, lamp });
  }
  // посетителски център, паркинг и пътят (отпред, на равното)
  const front = new THREE.Group(); g.add(front);
  const vc = new THREE.Group(); vc.position.set(-W * 0.22, 0, D * 0.33); front.add(vc);
  box(7, 2.2, 3.6, mat(0xe9e1d0, 0.7), 0, 1.1, 0, vc);
  const glass = mat(0x6fa8d6, 0.15, 0.4, 0x335577); box(6.2, 1.4, 0.05, glass, 0, 1.1, 1.83, vc);
  const vroof = new THREE.Mesh(new THREE.BoxGeometry(8, 0.35, 4.6), roofM); vroof.position.y = 2.4; vroof.castShadow = true; vc.add(vroof);
  for (const sd of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 4.6), roofM); e.position.set(sd * 4.2, 2.55, 0); e.rotation.z = sd * 0.35; vc.add(e); }
  for (const dx of [-2.8, 2.8]) box(0.4, 2.2, 0.4, flagM, dx, 1.1, 2.1, vc);
  const asph = mat(0x3a3d42, 0.95), line = mat(0xf2f2f2, 0.6);
  const road = new THREE.Group(); front.add(road);
  box(2.6, 0.06, D * 0.26, asph, W * 0.18, 0.05, D * 0.37, road);
  for (let k = 0; k < 5; k++) box(0.12, 0.07, 0.8, line, W * 0.18, 0.07, D * 0.27 + k * D * 0.05, road);
  box(W * 0.3, 0.06, 4.2, asph, W * 0.18, 0.05, D * 0.24, road);   // паркинг
  const carC = [0xd62828, 0x1f5fbf, 0xf2f2f2, 0xffb300, 0x2d8f4e, 0x333333, 0xffffff, 0x7a3fbf];
  for (let k = 0; k < 8; k++) box(0.9, 0.5, 1.6, mat(carC[k], 0.4, 0.4), W * 0.06 + k * 0.95, 0.3, D * 0.24 + (k % 2 ? 1.1 : -1.1), road);
  for (let k = 0; k < 2; k++) { const bus = box(1.1, 1.0, 3.6, mat(0xe8e0c8, 0.5, 0.2), W * 0.3 + k * 1.4, 0.55, D * 0.24, road); bus.userData.bus = true; }
  // пътека от центъра към стената и туристи по нея и по стената
  const pathM = mat(0xb8a98a, 1); const path = new THREE.Group(); front.add(path);
  const pA = new THREE.Vector3(-W * 0.22, 0, D * 0.25), pB = P[Math.round(N * 0.3)], steps = 14;
  for (let k = 0; k < steps; k++) { const u = k / steps, x = pA.x + (pB.x - pA.x) * u, z = pA.z + (pB.z - pA.z) * u; box(0.9, 0.08, 1.1, pathM, x, hill(x, z) + 0.06, z, path); }
  const people = [], pc = [0xd62828, 0x1f5fbf, 0xffb300, 0x2d8f4e, 0xffffff, 0xff7aa8];
  for (let k = 0; k < 22; k++) { const o = box(0.22, 0.55, 0.22, mat(pc[k % pc.length], 0.6), 0, 0, 0, front); people.push({ o, ph: k / 22, sp: 0.6 + (k % 5) * 0.12, dir: k % 2 ? 1 : -1 }); }
  // строителна площадка: кран и купчини камък
  const kit = new THREE.Group(); g.add(kit);
  const yel = mat(0xf2b705, 0.6, 0.3), crane = new THREE.Group(); kit.add(crane);
  box(0.5, 7, 0.5, yel, 0, 3.5, 0, crane); const jib = new THREE.Group(); jib.position.y = 7; crane.add(jib);
  box(7, 0.35, 0.35, yel, -2, 0, 0, jib); box(0.9, 0.7, 0.7, mat(0x666666), 1.6, -0.2, 0, jib);
  const piles = []; for (let k = 0; k < 6; k++) { const x = -W * 0.4 + k * W * 0.16, z = D * 0.08; piles.push(box(0.8, 0.4, 0.8, oldStone, x, hill(x, z) + 0.2, z, kit)); }
  const sign = deps.label ? deps.label(opts.sign || '🏯 ВЕЛИКАТА СТЕНА', '#ffe9a8', 16) : null;
  if (sign) { sign.position.set(0, 14, ridge(0)); g.add(sign); }

  let prog = -1, front0 = 0.62;
  function setProg(p) {
    p = Math.max(0, Math.min(1, p)); if (p === prog) return; prog = p;
    const k = Math.min(1, p / 0.8) * N;   // стената: първите 80% от строежа, участък по участък
    segs.forEach((s, i) => { const ok = i < k; s.fix.visible = ok; s.ruin.visible = !ok; });
    for (const t of towers) { const ok = t.i < k; t.fix.visible = ok; t.ruin.visible = !ok; }
    const kc = Math.min(1, Math.max(0, (p - front0) / (1 - front0)));   // центърът и пътят — накрая
    front.visible = kc > 0; vc.scale.y = Math.max(0.01, kc); road.visible = kc > 0.3; path.visible = p >= 1;
    for (const q of people) q.o.visible = p >= 1;
    kit.visible = p < 1; for (const pl of piles) pl.visible = p < 1;
    const at = P[Math.min(N, Math.round(k))]; crane.position.set(at.x, at.y, at.z + 2.5);
    if (sign) sign.visible = p >= 1;
  }
  function update(t, night = 0) {
    for (const tw of towers) tw.lamp.material.emissiveIntensity = tw.fix.visible ? 0.2 + 2.2 * night : 0;
    glass.emissiveIntensity = 0.1 + 1.2 * night;
    if (prog < 1) { jib.rotation.y = Math.sin(t * 0.3) * 1.3; return; }
    // туристите: половината вървят по пътеката, другите — по стената
    for (const [n, q] of people.entries()) {
      const u = ((t * 0.02 * q.sp + q.ph) % 1), v = q.dir > 0 ? u : 1 - u;
      if (n % 2) { const x = pA.x + (pB.x - pA.x) * v, z = pA.z + (pB.z - pA.z) * v; q.o.position.set(x + 0.3 * q.dir, hill(x, z) + 0.35, z); }
      else { const f = v * N, i = Math.min(N - 1, Math.floor(f)), r = f - i, a = P[i], b = P[i + 1]; q.o.position.set(a.x + (b.x - a.x) * r, a.y + (b.y - a.y) * r + 1.3 + 0.3, a.z + (b.z - a.z) * r); }
    }
  }
  setProg(opts.prog ?? 0);
  return { group: g, setProg, update, dispose: () => group.remove(g) };
}
