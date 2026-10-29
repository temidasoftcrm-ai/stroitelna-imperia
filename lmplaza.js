// lmplaza.js — 🏛️ lm-plaza (f6, прегледът на дизайнера: „около главните забележителности е гола земя, нощем свети само сградата“):
// площад около забележителността — настилка до бордюра на околните улици (зона = основата ×1,6–2,2, поне 20 м пръстен), пейки и лампи през ~12 м,
// дървета по периметъра, 2–4 сергии/кафене по ръба, информационна табела; по вид: руина — травертин, въже-ограда, будка за билети;
// храм — фонтан пред входа; кула — кръгъл подход; небостъргач — модерен площад с водни ивици; паметник — кръгъл площад с цветя.
// Нощем — топли лампи и прожектори (светещи материали + адитивни петна, без истински светлини). Всичко — InstancedMesh (евтино).
//   game.js: lmPlazaTick() → lmPlaza(o, { streets, night, low }) за забележителностите от PLAZA_KIND, щом моделът им е зареден.
import * as THREE from 'three';
import { groundMat } from './cityground.js';
import { feature } from './lab/feature.js';
import { fwFx, fwWaterMat } from './fountainwater.js';   // ⛲ fountain-water: вода, струи и пръски във фонтаните

export const PLAZA_KIND = { romanstadium: 'ruin', colosseo: 'ruin', colosseo3: 'ruin', colosseo4: 'ruin', nevsky: 'temple', stpeter: 'temple', hagia: 'temple', bluemosque: 'temple',
  sagrada: 'temple', westminster: 'temple', westminster3: 'temple', eiffel: 'tower', burj: 'sky', burj2: 'sky', empire: 'sky', empire2: 'sky' };
// 🏛️ lm-plaza2 (T2, прегледът на града: „площад пред всяка забележителност“): и всички останали — по вид; без онези във водата/на хълм/с свой площад
export const PLAZA_KIND2 = { chrysler2: 'sky', onewtc: 'sky', rockefeller2: 'sky', radiocity2: 'sky', petronas: 'sky', ndk: 'sky', mbs3: 'sky', bellagio: 'sky', luxor: 'sky', skytree: 'tower', galata2: 'tower', bigben2: 'tower', fernsehturm2: 'tower', cntower: 'tower',
  stpatrick2: 'temple', suleymaniye2: 'temple', notredame: 'temple', duomo: 'temple', mosque: 'temple', lazare2: 'temple', ststephen: 'temple', parliament: 'square', parliament2: 'square', capitol: 'square', capitol2: 'square',
  whitehouse: 'square', whitehouse2: 'square', cityhall: 'square', grandcentral2: 'square', vittoriano2: 'square', kotel: 'square', parthenon: 'ruin', arc2: 'monument', vegassign: 'monument' };
export const PLAZA_SKIP = new Set(['supertrees', 'manhattan', 'liberty', 'liberty2', 'opera', 'mbs2', 'burjarab', 'maiden2', 'redeemer', 'mgu', 'londoneye2']);
export const plazaKind = (k, plaza2) => PLAZA_KIND[k] || (plaza2 && !PLAZA_SKIP.has(k) ? PLAZA_KIND2[k] || 'auto' : null);
const PAVE = { ruin: 0xc9bfa7, temple: 0xb8b0a2, tower: 0xbab4a8, sky: 0xc4c6c8, monument: 0xb8b0a2, square: 0xc2b9a8 };   // травертин / светъл камък / бетон
// lm-plaza2: рамката само по видимите мешове — без скритата плоча (lm-ground; при телевизионната кула ×36 = 550 м) и без спрайтовете на сиянието
export function visBox(g) { g.updateMatrixWorld(true); const B = new THREE.Box3(), b = new THREE.Box3();
  g.traverseVisible(o => { if (!o.isMesh || o.isSprite || !o.geometry) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); B.union(b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld)); }); return B; }
const inLot = (L, x, z, m = 0) => { const c = Math.cos(L.rot || 0), s = Math.sin(L.rot || 0), dx = x - L.x, dz = z - L.z; return Math.abs(dx * c - dz * s) <= (L.w || 16) / 2 + m && Math.abs(dx * s + dz * c) <= (L.d || 16) / 2 + m; };

let MATS = null;
const mats = () => MATS || (MATS = {
  pole: new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.6, metalness: 0.4 }),
  head: Object.assign(new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xffd9a0, emissiveIntensity: 0 }), { name: 'plazaLamp' }),
  bench: new THREE.MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.9 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 1 }),
  crown: new THREE.MeshStandardMaterial({ color: 0x4f7f3c, roughness: 0.95 }),
  stall: new THREE.MeshStandardMaterial({ color: 0xe8e1cf, roughness: 0.8 }),
  awning: [0xc0392b, 0x2e6da4, 0x2f8f4f, 0xd68a1e].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })),
  rope: new THREE.MeshStandardMaterial({ color: 0x8a1f1f, roughness: 0.8 }),
  water: new THREE.MeshStandardMaterial({ color: 0x3f7f9f, roughness: 0.1, metalness: 0.3, emissive: 0x2a7fbf, emissiveIntensity: 0 }),
  flower: [0xd8434b, 0xf2c230, 0x9b59c9, 0xf2f2f2].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })),
  tub: new THREE.MeshStandardMaterial({ color: 0x9c978d, roughness: 0.95 }), bush: new THREE.MeshStandardMaterial({ color: 0x3f6f34, roughness: 0.95 }),   // lm-plaza2: каменните сандъци с храсти
  sign: new THREE.MeshStandardMaterial({ color: 0x1f3a5a, roughness: 0.6, emissive: 0x6fa0d8, emissiveIntensity: 0 }),
  glow: new THREE.MeshBasicMaterial({ color: 0xffc98a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
});

// улиците наоколо → onRoad(x, z): върху платното или тротоара (+1,5 м)
function roadMask(streets, cx, cz, R) {
  const P = []; for (const s of streets || []) { const hw = (s.w || 8) / 2 + 1.5; const pts = s.pts || [];
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], ax = a.x ?? a[0], az = a.z ?? a[1], bx = b.x ?? b[0], bz = b.z ?? b[1];
      if (Math.min(ax, bx) > cx + R + hw || Math.max(ax, bx) < cx - R - hw || Math.min(az, bz) > cz + R + hw || Math.max(az, bz) < cz - R - hw) continue; P.push([ax, az, bx, bz, hw]); } }
  return (x, z) => { for (const [ax, az, bx, bz, hw] of P) { const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), px = ax + dx * t - x, pz = az + dz * t - z; if (px * px + pz * pz < hw * hw) return true; } return false; };
}

function inst(geo, mat, list) {   // list: [[x, y, z, sx, sy, sz, ry]]
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), U = new THREE.Vector3(0, 1, 0);
  list.forEach((p, i) => m.setMatrixAt(i, M.compose(new THREE.Vector3(p[0], p[1], p[2]), Q.setFromAxisAngle(U, p[6] || 0), new THREE.Vector3(p[3], p[4], p[5]))));
  m.count = list.length; m.castShadow = true; m.receiveShadow = true; return m;
}

// o — забележителността ({ group, kind }); deps: { streets (в рамката на играта), night() → 0…1, low (gfx „Много ниско“ — без дребните неща),
//   lm-plaza2: plaza2, lots (парцелите — площадът не влиза в чужд), water(x, z), ped() → { m, mixer } (истински минувач) }
export function lmPlaza(o, deps = {}) {
  o.group.updateMatrixWorld(true); const B = deps.plaza2 ? visBox(o.group) : new THREE.Box3().setFromObject(o.group), C = B.getCenter(new THREE.Vector3()), S = B.getSize(new THREE.Vector3());
  const hx = S.x / 2, hz = S.z / 2, k0 = plazaKind(o.kind, deps.plaza2) || 'monument', type = k0 === 'auto' ? (Math.max(hx, hz) < 12 ? 'monument' : 'square') : k0, M = mats(), G = new THREE.Group(); G.name = 'lmPlaza';
  const round = type === 'tower' || type === 'monument';
  const Hx = Math.min(130, Math.max(hx * 1.8, hx + 20)), Hz = Math.min(130, Math.max(hz * 1.8, hz + 20)), Hr = Math.max(Hx, Hz);
  const inZone = (x, z) => round ? Math.hypot(x - C.x, z - C.z) < Hr : Math.pow(Math.abs(x - C.x) / Hx, 4) + Math.pow(Math.abs(z - C.z) / Hz, 4) < 1;   // заоблен правоъгълник
  const inFoot = (x, z, m = 0) => Math.abs(x - C.x) < hx + m && Math.abs(z - C.z) < hz + m;
  const road = roadMask(deps.streets, C.x, C.z, Hr + 10);
  // lm-plaza2: без чуждите парцели (своят — този под сградата) и без водата
  const nearL = deps.plaza2 ? (deps.lots || []).filter(L => Math.abs(L.x - C.x) < Hr + 40 && Math.abs(L.z - C.z) < Hr + 40 && !inLot(L, C.x, C.z, 2) && !(L.busy === 'landmark' && inFoot(L.x, L.z))) : [];
  const onRoad = deps.plaza2 ? (x, z) => road(x, z) || (deps.water && deps.water(x, z)) || nearL.some(L => inLot(L, x, z, 0.5)) : road;
  // настилката: клетки 2 м в зоната, без улиците (под сградата — също, не се вижда)
  const pos = [], step = 2; for (let x = C.x - Hx; x < C.x + Hx; x += step) for (let z = C.z - Hz; z < C.z + Hz; z += step) {
    const mx = x + step / 2, mz = z + step / 2; if (!inZone(mx, mz) || onRoad(mx, mz)) continue;
    pos.push(x, 0, z, x + step, 0, z + step, x + step, 0, z, x, 0, z, x, 0, z + step, x + step, 0, z + step); }
  if (pos.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    const pm = new THREE.Mesh(g, groundMat({ kind: 'pave', col: PAVE[type], tile: type === 'ruin' ? 1.8 : type === 'sky' ? 3 : 1.4 })); pm.position.y = 0.045; pm.receiveShadow = true; G.add(pm); }
  // периметърът: точки през ~12 м по ръба на зоната (2 м навътре)
  const ring = [], N = Math.max(12, Math.round(2 * Math.PI * Hr / 12));
  for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), e = round ? Hr : 1 / Math.pow(Math.pow(Math.abs(c) / Hx, 4) + Math.pow(Math.abs(s) / Hz, 4), 0.25);
    const x = C.x + c * (e - 3), z = C.z + s * (e - 3); if (onRoad(x, z) || inFoot(x, z, 4)) continue; ring.push([x, z, a]); }
  if (deps.plaza2 && ring.length < 6) for (let r = Hr - 5, r0 = Math.max(hx, hz) + 3; r >= r0; r -= 2) {   // lm-plaza2: ръбът е на улицата (островът в кръговото, arc2) — по-навътре, по най-външния свободен кръг
    const n = Math.max(8, Math.round(2 * Math.PI * r / 10)), q = [];
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, x = C.x + Math.cos(a) * r, z = C.z + Math.sin(a) * r; if (!onRoad(x, z) && !inFoot(x, z, 2.5)) q.push([x, z, a]); }
    if (q.length >= Math.max(6, n / 2)) { ring.length = 0; ring.push(...q); break; } }
  const lamps = [], benches = [], trees = [];
  ring.forEach(([x, z, a], i) => { if (i % 2 === 0) lamps.push([x, z]); else benches.push([x, z, -a + Math.PI / 2]); if (!deps.low && i % 2 === 1) { const tx = x + Math.cos(a) * 2.5, tz = z + Math.sin(a) * 2.5; if (!onRoad(tx, tz)) trees.push([tx, tz]); } });
  G.add(inst(new THREE.CylinderGeometry(0.08, 0.1, 4.2, 6), M.pole, lamps.map(([x, z]) => [x, 2.1, z, 1, 1, 1])));
  G.add(inst(new THREE.SphereGeometry(0.32, 10, 8), M.head, lamps.map(([x, z]) => [x, 4.3, z, 1, 1, 1])));
  G.add(inst(new THREE.BoxGeometry(1.8, 0.45, 0.5), M.bench, benches.map(([x, z, r]) => [x, 0.45, z, 1, 1, 1, r])));
  if (trees.length) { G.add(inst(new THREE.CylinderGeometry(0.18, 0.25, 2.4, 6), M.trunk, trees.map(([x, z]) => [x, 1.2, z, 1, 1, 1]))); G.add(inst(new THREE.SphereGeometry(1.8, 10, 8), M.crown, trees.map(([x, z], i) => [x, 3.4, z, 1, 0.9 + (i % 3) * 0.1, 1]))); }
  // сергии/кафене: 2–4 по ръба (вътре в зоната, между пейките)
  const stalls = []; for (const f of [0.15, 0.4, 0.65, 0.9]) { const p = ring[Math.floor(f * ring.length)]; if (!p) continue; const x = C.x + (p[0] - C.x) * 0.9, z = C.z + (p[1] - C.z) * 0.9; if (!onRoad(x, z) && !inFoot(x, z, 3)) stalls.push([x, z, -p[2] + Math.PI / 2]); }
  // lm-plaza2: кафенето — само на площад ≥ ~60 м, на външния ръб, далеч от основата (≥ 1,5×) и извън конуса пред лицето на забележителността
  const ry = o.group.rotation.y, fx = Math.sin(ry), fz = Math.cos(ry), Rf = Math.max(hx, hz);
  if (deps.plaza2) for (let i = stalls.length - 1; i >= 0; i--) { const [x, z, r] = stalls[i], dx = x - C.x, dz = z - C.z, L = Math.hypot(dx, dz) || 1;   // сергиите — също извън конуса отпред; твърде близките — навън до 1,5× основата или встрани, иначе без тях
    if ((dx * fx + dz * fz) / L > 0.64) { stalls.splice(i, 1); continue; }
    if (L >= 1.5 * Rf) continue; const q = [[1.5 * Rf / L, 0], [1.5 * Rf / L, 0.6], [1.5 * Rf / L, -0.6]].map(([k, da]) => { const a = Math.atan2(dz, dx) + da, R = L * k; return [C.x + Math.cos(a) * R, C.z + Math.sin(a) * R, r - da]; })
      .find(([x2, z2]) => { const ex = x2 - C.x, ez = z2 - C.z, L2 = Math.hypot(ex, ez) || 1; return !onRoad(x2, z2) && !inFoot(x2, z2, 3) && (ex * fx + ez * fz) / L2 <= 0.64 && L2 >= 1.5 * Rf; });
    if (q) stalls[i] = q; else stalls.splice(i, 1); }
  const cafeAt = !deps.plaza2 ? 0 : 2 * Math.min(Hx, Hz) < 60 ? -1 : stalls.findIndex(([x, z]) => { const dx = x - C.x, dz = z - C.z, L = Math.hypot(dx, dz) || 1; return L >= 1.5 * Rf && Math.abs(dx * fx + dz * fz) / L < 0.64; });
  if (deps.cafe && stalls.length > 1 && cafeAt >= 0) { const cf = deps.cafe(); if (cf) { const s0 = stalls.splice(cafeAt, 1)[0], b = new THREE.Box3().setFromObject(cf), z = b.getSize(new THREE.Vector3()), k = 12 / Math.max(z.x, z.z, 1);   // ☕ shop-cafe: кафене (~12 м) на мястото на една сергия
    cf.scale.multiplyScalar(k); cf.position.set(s0[0], 0.05, s0[1]); cf.rotation.y = s0[2] + Math.PI; G.add(cf); G.userData.cafe = true; } }
  if (!deps.low && stalls.length) { G.add(inst(new THREE.BoxGeometry(2.6, 2.2, 1.8), M.stall, stalls.map(([x, z, r]) => [x, 1.1, z, 1, 1, 1, r])));
    stalls.forEach(([x, z, r], i) => { const aw = new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 2.4), M.awning[i % 4]); aw.position.set(x, 2.35, z); aw.rotation.y = r; aw.rotation.x = 0.12; G.add(aw); }); }
  G.userData.cafeSlots = stalls.map(([x, z, r]) => ({ x, z, r }));   // shop-cafe: тук може да застане кафенето (когато моделът е готов)
  // информационна табела — към най-близката улица от центъра
  { const p = ring[0]; if (p) { const sg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 0.1), M.sign); sg.position.set(C.x + (p[0] - C.x) * 0.8, 1.4, C.z + (p[1] - C.z) * 0.8); sg.rotation.y = -p[2] + Math.PI / 2; G.add(sg); } }
  // по вид
  if (type === 'ruin') {   // въже-ограда на 4 м около основата и будка за билети
    const posts = []; for (let t = 0; t < 1; t += 1 / 60) { const a = t * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), e = 1 / Math.pow(Math.pow(Math.abs(c) / (hx + 4), 4) + Math.pow(Math.abs(s) / (hz + 4), 4), 0.25), x = C.x + c * e, z = C.z + s * e; if (!onRoad(x, z)) posts.push([x, 0.5, z, 1, 1, 1]); }
    G.add(inst(new THREE.CylinderGeometry(0.06, 0.06, 1, 6), M.pole, posts));
    G.add(inst(new THREE.BoxGeometry(0.05, 0.05, 1), M.rope, posts.map((p, i) => { const q = posts[(i + 1) % posts.length], dx = q[0] - p[0], dz = q[2] - p[2], L = Math.hypot(dx, dz); return L > 6 ? null : [(p[0] + q[0]) / 2, 0.85, (p[2] + q[2]) / 2, 1, 1, L, Math.atan2(dx, dz)]; }).filter(Boolean)));   // въжето между стълбчетата (не над улиците)
    if (stalls[0]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 2.2), M.awning[0]); b.position.set(stalls[0][0], 1.3, stalls[0][1]); G.add(b); }
  }
  if (type === 'temple' || type === 'square') {   // фонтан пред храма (и пред обществената сграда — lm-plaza2) — от страната с най-много настилка
    let best = null; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = C.x + dx * (hx + (Hx - hx) * 0.55), z = C.z + dz * (hz + (Hz - hz) * 0.55); if (!onRoad(x, z) && (!best || Math.abs(dx) * Hx + Math.abs(dz) * Hz > best.w)) best = { x, z, w: Math.abs(dx) * Hx + Math.abs(dz) * Hz }; }
    if (best) { const bs = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.7, 28), M.stall); bs.position.set(best.x, 0.35, best.z); const w = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 0.1, 28), M.water); w.position.set(best.x, 0.68, best.z); const c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 10), M.stall); c2.position.set(best.x, 1.4, best.z); G.add(bs, w, c2); if (feature('fountain-water')) { w.material = fwWaterMat(); const fx = fwFx({ jet: [2.5, 1.8, 0.09, 0.03], splash: [[0.74, 1.7, 20], [0.74, 0.6, 10]], crown: [4.3, 0.74, 1.6, 16], u: 7 }); fx.position.set(best.x, 0, best.z); G.add(fx); } }
  }
  if (type === 'sky') {   // водни ивици в настилката
    for (const s of [-1, 1]) { const x = C.x + s * (hx + (Hx - hx) * 0.45); if (onRoad(x, C.z)) continue; const w = new THREE.Mesh(new THREE.BoxGeometry(2, 0.06, Math.min(2 * Hz * 0.7, 60)), M.water); w.position.set(x, 0.08, C.z); G.add(w); }
  }
  if (deps.plaza2) {   // сандъци с храсти и цветя: по двойка до всяка втора пейка (по дългата ѝ ос), при кулата/паметника — и 8 кръгли около основата
    const tubs = [], round8 = []; benches.forEach(([x, z, r], i) => { if (i % 2) return; const ux = Math.cos(r) * 1.75, uz = -Math.sin(r) * 1.75;
      for (const s of [-1, 1]) { const tx = x + s * ux, tz = z + s * uz; if (!onRoad(tx, tz) && !inFoot(tx, tz, 2)) tubs.push([tx, tz, r]); } });
    if (type === 'monument' || type === 'tower') for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * Math.PI * 2, rr = Rf + 6, x = C.x + Math.cos(a) * rr, z = C.z + Math.sin(a) * rr; if (!onRoad(x, z)) round8.push([x, z]); }
    G.add(inst(new THREE.BoxGeometry(1.1, 0.55, 1.1), M.tub, tubs.map(([x, z, r]) => [x, 0.275, z, 1, 1, 1, r])));
    G.add(inst(new THREE.CylinderGeometry(1.3, 1.4, 0.5, 16), M.tub, round8.map(([x, z]) => [x, 0.25, z, 1, 1, 1])));
    const bush = tubs.map(([x, z]) => [x, 0.75, z, 1, 0.65, 1]).concat(round8.map(([x, z]) => [x, 0.7, z, 2.4, 0.7, 2.4]));
    G.add(inst(new THREE.SphereGeometry(0.48, 10, 7), M.bush, bush));
    const dots = []; bush.forEach(([x, , z, sx], i) => { for (let k = 0; k < (sx > 1 ? 7 : 3); k++) { const a = k * 2.4 + i, d = 0.25 * sx; dots.push([x + Math.cos(a) * d, 0.98 + (sx > 1 ? 0.02 : 0), z + Math.sin(a) * d, 1, 1, 1]); } });
    M.flower.forEach((mt, i) => G.add(inst(new THREE.SphereGeometry(0.09, 5, 4), mt, dots.filter((_, k) => k % 4 === i))));
  } else if (type === 'monument' || type === 'tower') {   // цветни лехи в кръг
    const fl = []; for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2, r = Math.max(hx, hz) + 6, x = C.x + Math.cos(a) * r, z = C.z + Math.sin(a) * r; if (!onRoad(x, z)) fl.push([x, 0.25, z, 1, 1, 1]); }
    M.flower.forEach((mt, i) => G.add(inst(new THREE.SphereGeometry(0.5, 6, 5), mt, fl.filter((_, k) => k % 4 === i))));
  }
  // lm-plaza2: минувачите — по алея на 5 м около основата (обратно, щом алеята свърши в улица/чужд парцел)
  const walk = [];
  if (deps.plaza2 && deps.ped && !deps.low && pos.length) {
    const ax = hx + 5, az = hz + 5, P = []; for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), e = round ? Math.max(ax, az) : 1 / Math.pow(Math.pow(Math.abs(c) / ax, 4) + Math.pow(Math.abs(s) / az, 4), 0.25), x = C.x + c * e, z = C.z + s * e; P.push(inZone(x, z) && !onRoad(x, z) ? [x, z] : null); }
    const ok = P.map((p, i) => i).filter(i => P[i]), n = Math.min(8, Math.floor(ok.length / 5));
    for (let k = 0; k < n; k++) { const w = deps.ped(); if (!w) break; const i = ok[(k * 7919) % ok.length]; w.m.position.set(P[i][0], 0.06, P[i][1]); G.add(w.m); walk.push({ ...w, i, f: 0, dir: k % 2 ? 1 : -1, v: 1.1 + (k % 4) * 0.12 }); }
    let t0 = 0; const tick = () => { const now = performance.now() / 1000, dt = t0 ? Math.min(0.1, now - t0) : 0; t0 = now; if (!dt) return;
      for (const w of walk) { let j = (w.i + w.dir + 64) % 64; if (!P[j]) { w.dir = -w.dir; j = (w.i + w.dir + 64) % 64; if (!P[j]) continue; } const a = P[w.i], b = P[j], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        w.f += w.v * dt / L; if (w.f >= 1) { w.f = 0; w.i = j; continue; } w.m.position.set(a[0] + (b[0] - a[0]) * w.f, 0.06, a[1] + (b[1] - a[1]) * w.f); w.m.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); if (w.mixer) w.mixer.update(dt); } };
    const pm = G.children[0]; if (walk.length && pm) pm.onBeforeRender = tick;   // само когато площадът е в кадър
  }
  // нощ: лампите и табелата светят (сградата — със своето осветяване; адитивните „прожектори“ изглеждаха като полупрозрачни листове)
  const night = deps.night || (() => 0);
  M.head.onBeforeRender = () => { const n = night(); M.head.emissiveIntensity = 2.2 * n; M.sign.emissiveIntensity = 0.8 * n; M.water.emissiveIntensity = 0.35 * n;  };
  G.userData.plaza = { type, lamps: lamps.length, benches: benches.length, trees: trees.length, stalls: stalls.length, cells: pos.length / 18, Hx: Math.round(Hx), Hz: Math.round(Hz), walkers: walk.length, kind: o.kind };
  return G;
}
