// seaside.js — море за крайбрежните градове (Варна, Бургас, Констанца, Истанбул, Солун, Атина, Барселона…):
// морето е на север от града, с плаж и крайбрежна алея с палми, пристанище с кей, портални кранове и контейнери,
// фар на вълнолома, кораби на котва и лодки, които плават. Жп линията минава по насип през морето.
import * as THREE from 'three';

import { EXTRA_COASTAL } from './countries.js';
export const SEASIDE = ['varna', 'burgas', 'constanta', 'istanbul', 'thessaloniki', 'athens', 'barcelona', 'amsterdam', 'rotterdam', 'newyork', 'losangeles', 'rio', 'buenosaires', 'capetown', 'dubai', 'mumbai', 'singapore', 'hongkong', 'shanghai', 'tokyo', 'sydney'];
SEASIDE.push(...EXTRA_COASTAL);
export const SEA_MODELS = ['ship-cargo-a', 'ship-cargo-b', 'ship-ocean-liner', 'ship-small', 'boat-sail-a', 'boat-sail-b', 'boat-speed-a', 'boat-fishing-small', 'buoy', 'cargo-container-a', 'cargo-container-b', 'cargo-container-c'];

const mat = (c, r = 0.9, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const box = (w, h, d, m, x, y, z, g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
const rnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function useModel(A, model, n, s) { if (!A[n]) return null; const o = model(n, s); o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; }

// group: групата на града; deps: { A, model(name, scale), label(text, color, w) }
// opts: { zEdge (северният ръб на града), xMin, xMax (ширина на града), railX: [x1, x2] (коридор на жп линията), seed }
export function addSeaside(group, deps, opts) {
  const { A, model } = deps, r = rnd(opts.seed || 777);
  const g = new THREE.Group(); group.add(g);
  const zE = opts.zEdge, x0 = opts.xMin - 400, x1 = opts.xMax + 400, beachD = 22, seaZ = zE - beachD;
  const [rx1, rx2] = opts.railX || [-1e9, -1e9];
  // плаж и крайбрежна алея
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, beachD), mat(0xe6d29a, 1)); sand.rotation.x = -Math.PI / 2; sand.position.set((x0 + x1) / 2, 0.01, zE - beachD / 2); sand.receiveShadow = true; g.add(sand);
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(opts.xMax - opts.xMin + 40, 5), mat(0xcfc3a8, 0.9)); walk.rotation.x = -Math.PI / 2; walk.position.set((opts.xMin + opts.xMax) / 2, 0.03, zE - 3); g.add(walk);
  // море: две части — от двете страни на жп насипа
  const seaMat = new THREE.MeshStandardMaterial({ color: 0x2f86c8, roughness: 0.25, metalness: 0 });
  const parts = [[x0, Math.min(rx1, x1)], [Math.max(rx2, x0), x1]].filter(([a, b]) => b - a > 1);
  const seaD = 900, waves = [];
  for (const [a, b] of parts) {
    const geo = new THREE.PlaneGeometry(b - a, seaD, Math.max(2, Math.round((b - a) / 20)), 40); geo.rotateX(-Math.PI / 2);
    const s = new THREE.Mesh(geo, seaMat); s.position.set((a + b) / 2, 0.04, seaZ - seaD / 2); g.add(s);
    waves.push({ geo, base: Float32Array.from(geo.attributes.position.array) });
  }
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 1.6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })); foam.rotation.x = -Math.PI / 2; foam.position.set((x0 + x1) / 2, 0.08, seaZ); g.add(foam);
  // жп насип през морето
  if (rx2 > rx1) { const e = box(rx2 - rx1, 1.2, seaD, mat(0x8f8a80, 1), (rx1 + rx2) / 2, -0.5, seaZ - seaD / 2, g); e.castShadow = false; }
  // палми по алеята
  const palm = () => {
    const p = new THREE.Group(), h = 6 + r() * 2;
    for (let k = 0; k < 5; k++) { const sgm = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, h / 5, 6), mat(0x8a6a44)); sgm.position.set(k * 0.1, h / 10 + k * h / 5, 0); p.add(sgm); }
    for (let f = 0; f < 6; f++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.6, 4).rotateX(Math.PI / 2).translate(0, 0, 1.8), mat(0x3f9a3a)); l.position.set(0.5, h, 0); l.rotation.set(-0.5, f / 6 * Math.PI * 2, 0); p.add(l); }
    p.traverse(m => { if (m.isMesh) m.castShadow = true; }); return p;
  };
  for (let x = opts.xMin; x <= opts.xMax; x += 14) { const p = palm(); p.position.set(x + r() * 4, 0, zE - 6.5); g.add(p); }
  // чадъри на плажа
  const cols = [0xff5a5a, 0xffd23f, 0x3fa7ff, 0x50d18b];
  for (let k = 0; k < 24; k++) {
    const x = opts.xMin + 20 + r() * (opts.xMax - opts.xMin) * 0.55, z = zE - 10 - r() * 9;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4), mat(0xeeeeee)); pole.position.set(x, 1.2, z); g.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.7, 10), mat(cols[k % 4])); top.position.set(x, 2.5, z); g.add(top);
  }
  // пристанище (източната част): кей, портални кранове, контейнери, товарен кораб
  const px = opts.xMax - 60, pierZ = seaZ - 40;
  box(110, 1.4, 70, mat(0xb8b4aa, 0.9), px, 0.5, seaZ - 34, g);
  const cranes = [];
  for (let k = 0; k < 3; k++) {
    const c = new THREE.Group(), red = mat(k % 2 ? 0xd62828 : 0x1f5fbf, 0.6);
    for (const [sx, sz] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) box(0.8, 22, 0.8, red, sx, 12, sz, c);
    box(10, 1.6, 8, red, 0, 23, 0, c); const boom = box(1.2, 1.2, 46, red, 0, 24.5, -14, c); boom.castShadow = true;
    box(3, 2.4, 3, mat(0xeeeeee), 0, 21, -4, c);
    c.position.set(px - 35 + k * 26, 1.2, pierZ + 8); g.add(c); cranes.push(c);
  }
  for (let k = 0; k < 40; k++) {
    const n = ['cargo-container-a', 'cargo-container-b', 'cargo-container-c'][k % 3];
    const o = useModel(A, model, n, 3.2) || box(4.4, 3.5, 8.8, mat([0xd62828, 0x1f5fbf, 0x2d8f4e, 0xffb300][k % 4], 0.7), 0, 0, 0, new THREE.Group());
    o.position.set(px - 40 + (k % 10) * 8, 1.2 + Math.floor(k / 20) * 3.5, seaZ - 10 - Math.floor((k % 20) / 10) * 10); o.rotation.y = Math.PI / 2;
    g.add(o);
  }
  const cargo = useModel(A, model, 'ship-cargo-a', 6);
  if (cargo) { cargo.position.set(px, 0, pierZ - 18); cargo.rotation.y = Math.PI / 2; g.add(cargo); }
  // фар на вълнолома (западната част)
  const lx = opts.xMin + 30, lz = seaZ - 90;
  box(8, 1.2, 90, mat(0x8f8a80, 1), lx, 0.2, seaZ - 45, g);
  const tower = new THREE.Group();
  for (let k = 0; k < 6; k++) { const sgm = new THREE.Mesh(new THREE.CylinderGeometry(2.2 - k * 0.15, 2.3 - k * 0.15, 3, 16), mat(k % 2 ? 0xd62828 : 0xffffff, 0.6)); sgm.position.y = 1.5 + k * 3; tower.add(sgm); }
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2, 12), new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd060, emissiveIntensity: 1.5 })); lamp.position.y = 19.5; tower.add(lamp);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(4, 60, 16, 1, true).rotateZ(Math.PI / 2).translate(30, 0, 0), new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 19.5; tower.add(beam);
  tower.position.set(lx, 0.8, lz); g.add(tower);
  // кораби на котва и лодки
  const ships = [];
  for (const [n, s, x, z] of [['ship-ocean-liner', 3.2, -120, -260], ['ship-cargo-b', 6, 60, -320], ['ship-small', 2.4, 160, -200]]) {
    const o = useModel(A, model, n, s); if (!o) continue;
    o.position.set((opts.xMin + opts.xMax) / 2 + x, 0, seaZ + z); o.rotation.y = r() * 6; g.add(o); ships.push({ o, ph: r() * 6 });
  }
  const boats = [];
  for (let k = 0; k < 10; k++) {
    const n = ['boat-sail-a', 'boat-sail-b', 'boat-speed-a', 'boat-fishing-small'][k % 4];
    const o = useModel(A, model, n, 2.2); if (!o) continue;
    const z = seaZ - 40 - r() * 200; let x = opts.xMin + r() * (opts.xMax - opts.xMin + 200) - 100;
    if (x > rx1 - 10 && x < rx2 + 10) x = rx2 + 20;
    o.position.set(x, 0, z); g.add(o); boats.push({ o, x0: x, z, ph: r() * 6, sp: 0.4 + r() * 0.8 });
  }
  for (let k = 0; k < 8; k++) { const b = useModel(A, model, 'buoy', 1.6); if (!b) break; b.position.set(opts.xMin + k * 30, 0, seaZ - 30); g.add(b); ships.push({ o: b, ph: r() * 6 }); }
  const sign = deps.label('⚓ ПРИСТАНИЩЕ', '#ffffff', 12); sign.position.set(px, 32, pierZ + 8); g.add(sign);

  // ---- твоите кораби (Фаза „Пристанища“): на кей до старото пристанище, а един влиза/излиза от морето
  // list = [{ kind: 'container'|'bulk'|'tanker'|'cruise', state: 'docked'|'arriving'|'leaving' }]
  const SHIP = { container: ['ship-cargo-a', 6], bulk: ['ship-cargo-b', 6], tanker: ['ship-cargo-a', 6, 0x7a1f1f], cruise: ['ship-ocean-liner', 3.2], coaster: ['ship-small', 3], boat: ['boat-fishing-small', 2.6, null, 'boat-speed-a'] };
  const fleetG = new THREE.Group(); g.add(fleetG);
  const berthZ = seaZ - 69 - 9;
  let movers = [], portLv = 0, lastFleet = [];
  // кейове: 2 пред стария кей, още 2 пред разширението (ниво 4+); останалите кораби чакат на котва
  const berthsAt = () => [[px - 27, berthZ], [px + 27, berthZ], ...(portLv >= 4 ? [[px - 108, seaZ - 64], [px - 72, seaZ - 64]] : [])];
  function makeShip(kind) {
    const [n, sc, tint, alt] = SHIP[kind] || SHIP.container;
    let o = useModel(A, model, n, sc) || (alt ? useModel(A, model, alt, sc) : null) || (SHIP[kind] ? null : useModel(A, model, 'ship-cargo-a', 6));
    if (o && tint) o.traverse(m => { if (m.isMesh && m.material) { m.material = m.material.clone(); const c = m.material.color; if (c && c.r + c.g + c.b > 0.6 && c.r + c.g + c.b < 2.4) c.setHex(tint); } });
    if (!o) { o = new THREE.Group(); box(36, 5, 8, mat(kind === 'cruise' ? 0xffffff : tint || 0x1f3a5f, 0.6), 0, 1, 0, o); box(8, 6, 7, mat(0xeeeeee), kind === 'cruise' ? 0 : 12, 6, 0, o); }
    return o;
  }
  function setFleet(list = []) {
    fleetG.clear(); movers = []; lastFleet = list;
    for (let k = ships.length - 1; k >= 0; k--) if (ships[k].fleet) ships.splice(k, 1);
    const docked = list.filter(f => f.state === 'docked'), moving = list.filter(f => f.state !== 'docked');
    docked.forEach((f, i) => {
      const o = makeShip(f.kind);
      const B = berthsAt();
      const small = f.kind === 'boat' || f.kind === 'coaster';
      if (i < B.length) { o.position.set(B[i][0], 0, B[i][1] + (small ? 5 : 0)); o.rotation.y = Math.PI / 2; }
      else { o.position.set(px - 140 + (i - B.length) * 60, 0, seaZ - 230 - (i % 2) * 50); o.rotation.y = 0.3 + i; }   // на котва, чакат кей
      fleetG.add(o); ships.push({ o, ph: i * 1.7, fleet: true });
    });
    if (cargo) cargo.visible = !docked.length;   // декоративният кораб отстъпва кея на твоите
    moving.slice(0, 2).forEach((f, i) => {
      const o = makeShip(f.kind); fleetG.add(o);
      movers.push({ o, arriving: f.state === 'arriving', x: px + 70 + i * 40, ph: i * 0.5 });
    });
  }
  // ниво на пристанището 0–5: всяко ниво добавя кранове, контейнери и складове около стария кей
  const lvG = [1, 2, 3, 4, 5].map(() => { const q = new THREE.Group(); q.visible = false; g.add(q); return q; });
  { const blue = mat(0x1f5fbf, 0.6), red = mat(0xd62828, 0.6), shed = mat(0xb8bec6, 0.5, 0.4);
    const crane = (q, x, m) => { const c = new THREE.Group(); for (const [sx, sz] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) box(0.8, 22, 0.8, m, sx, 12, sz, c); box(10, 1.6, 8, m, 0, 23, 0, c); box(1.2, 1.2, 46, m, 0, 24.5, -14, c); c.position.set(x, 1.2, pierZ + 8); q.add(c); cranes.push(c); };
    crane(lvG[0], px + 44, blue);
    for (let k = 0; k < 20; k++) box(4.4, 3.5, 8.8, mat([0xd62828, 0x1f5fbf, 0x2d8f4e, 0xffb300][k % 4], 0.7), px - 40 + (k % 10) * 8, 1.2 + 1.75 + 7, seaZ - 10 - Math.floor(k / 10) * 10, lvG[1]).rotation.y = Math.PI / 2;
    for (let k = 0; k < 2; k++) { box(26, 9, 14, shed, px - 30 + k * 32, 5.7, seaZ - 2 + 12, lvG[2]); box(26.6, 0.8, 14.6, mat(0x8a3b2b, 0.7), px - 30 + k * 32, 10.5, seaZ + 10, lvG[2]); }
    box(70, 1.4, 50, mat(0xb8b4aa, 0.9), px - 90, 0.5, seaZ - 30, lvG[3]); crane(lvG[3], px - 100, red); crane(lvG[3], px - 76, red);
    for (let k = 0; k < 24; k++) box(4.4, 3.5, 8.8, mat([0x7b2cbf, 0x0a9396, 0xe8e2d4, 0xd62828][k % 4], 0.7), px - 115 + (k % 8) * 7, 3 + Math.floor(k / 16) * 3.5, seaZ - 14 - Math.floor((k % 16) / 8) * 11, lvG[4]).rotation.y = Math.PI / 2;
    const silo = mat(0xdcdcdc, 0.5, 0.3); for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 18, 16), silo); c.position.set(px - 70 + k * 9, 9, seaZ + 14); c.castShadow = true; lvG[4].add(c); } }
  function setPortLevel(lv = 0) { const was = portLv; portLv = lv; lvG.forEach((q, i) => { q.visible = lv >= i + 1; }); if ((was >= 4) !== (lv >= 4)) setFleet(lastFleet); }

  // t: секунди; night: 0…1 (фарът свети и се върти)
  function update(t, night = 0) {
    for (const mv of movers) {   // влиза от открито море до кея за ~45 с (или обратно), после пак
      const k = ((t / 45 + mv.ph) % 1), u = mv.arriving ? k : 1 - k, e = u * u * (3 - 2 * u);
      mv.o.position.set(mv.x, Math.sin(t * 0.8) * 0.2, berthZ - 420 + (420 - 30) * e);
      mv.o.rotation.y = mv.arriving ? 0 : Math.PI;
    }
    for (const w of waves) {
      const a = w.geo.attributes.position, b = w.base;
      for (let i = 0; i < a.count; i++) a.array[i * 3 + 1] = Math.sin(b[i * 3] * 0.04 + t * 1.2) * 0.04 + Math.cos(b[i * 3 + 2] * 0.05 + t) * 0.03;
      a.needsUpdate = true;
    }
    foam.material.opacity = 0.35 + Math.sin(t * 1.5) * 0.2;
    for (const s of ships) { s.o.position.y = Math.sin(t * 0.8 + s.ph) * 0.25; s.o.rotation.z = Math.sin(t * 0.6 + s.ph) * 0.02; }
    for (const q of boats) { q.o.position.x = q.x0 + Math.sin(t * 0.04 * q.sp + q.ph) * 80; q.o.rotation.y = Math.cos(t * 0.04 * q.sp + q.ph) > 0 ? Math.PI / 2 : -Math.PI / 2; q.o.position.y = Math.sin(t * 1.3 + q.ph) * 0.2; }
    cranes.forEach((c, k) => { c.position.x += Math.sin(t * 0.2 + k) * 0.01; });
    beam.rotation.y = t * 0.8; beam.material.opacity = 0.04 + 0.16 * night; lamp.material.emissiveIntensity = 0.5 + 2 * night;
  }
  return { group: g, update, setFleet, setPortLevel, port: { x: px, z: seaZ, xMax: opts.xMax } };
}
