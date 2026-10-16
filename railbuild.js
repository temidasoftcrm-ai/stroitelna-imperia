// railbuild.js — 3D изглед на строежа на жп линия (двупътна, електрифицирана), като при магистралите.
// Етапите се извеждат от прогреса на линията (0..1): 4 равни етапа.
// game.js ползва: RAIL_STAGES, railStageOf(prog), buildRailView(A, opts) → { group, update(stage, prog, t) }.
import * as THREE from 'three';
import { makeWater } from './water.js';
import { hasTrainModel, trainCar } from './trainmodels.js';

export const RAIL_STAGES = [
  { nm: 'Земни работи', ico: '🚜' },
  { nm: 'Баластра призма', ico: '🪨' },
  { nm: 'Траверси и релси', ico: '🛤️' },
  { nm: 'Контактна мрежа и сигнализация', ico: '⚡' },
];
export function railStageOf(prog) {
  const k = Math.min(prog, 0.9999) * RAIL_STAGES.length;
  return { stage: Math.floor(k), prog: k - Math.floor(k) };
}

const LEN = 240, RIVER_Z = 20, RIVER_W = 26;
const TRACK_X = [-2.4, 2.4];       // оста на двата коловоза
const GAUGE = 1.6;                 // разстояние между релсите (леко увеличено, за да се вижда)
const mat = (c, r = 0.9, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const M = {
  earth: mat(0x7a5a3a, 1), ballast: mat(0x8f8b85, 1), sleeper: mat(0xb8b2a6, 0.9), rail: mat(0x7b6a5a, 0.4, 0.6),
  pole: mat(0x8a9097, 0.5, 0.5), wire: new THREE.LineBasicMaterial({ color: 0x2a2a2a }), yel: mat(0xffb300, 0.55),
  dark: mat(0x2a2a2c, 0.8), red: mat(0xd63b2f, 0.6), concrete: mat(0xbdbab2, 0.9),
};
const box = (w, h, d, m, x, y, z, g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
const reveal = (list, front) => { for (const o of list) o.visible = o.userData.z <= front; };

// машина за полагане на релси (портал върху коловоза, който носи траверси)
function makeLayer() {
  const g = new THREE.Group();
  box(3.4, 1.3, 9, M.yel, 0, 1.6, 0, g);
  box(3.4, 0.5, 9, M.dark, 0, 0.7, 0, g);
  for (const z of [-3.5, 3.5]) for (const x of [-1.5, 1.5]) box(0.25, 3.6, 0.25, M.yel, x, 3.7, z, g);
  box(3.6, 0.3, 7.6, M.yel, 0, 5.5, 0, g);
  box(2.2, 1.6, 1.8, M.dark, 0, 3.1, 3.4, g);
  const stack = new THREE.Group(); g.add(stack);
  for (let k = 0; k < 6; k++) box(2.6, 0.18, 0.25, M.sleeper, 0, 2.4 + k * 0.2, -1 + (k % 2) * 0.4, stack);
  const beacon = box(0.25, 0.22, 0.25, new THREE.MeshStandardMaterial({ color: 0xff8a00, emissive: 0xff6a00, emissiveIntensity: 1 }), 0, 5.8, 3, g);
  beacon.castShadow = false;
  return g;
}

export function buildRailView(A, opts = {}) {
  const g = new THREE.Group(), z0 = -LEN / 2;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), mat(0x8fb36a, 1));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; g.add(ground);
  const water = makeWater({ color: 0x3f86c9, repeat: 24 });   // реката с вълни (като при магистралите)
  const river = new THREE.Mesh(new THREE.PlaneGeometry(600, RIVER_W), water.material);
  river.rotation.x = -Math.PI / 2; river.position.set(0, 0.01, RIVER_Z); g.add(river);
  const onBridge = z => Math.abs(z - RIVER_Z) < RIVER_W / 2 + 4;
  const Y = 1.2;   // височина на баластрата

  const earth = [], ballast = [], track = [], wires = [];
  for (let z = z0; z < z0 + LEN; z += 10) {
    const zc = z + 5;
    if (onBridge(zc)) continue;
    const e = box(16, 0.7, 10, M.earth, 0, 0.35, zc, g); e.userData.z = zc; earth.push(e);
    // баластрата е трапец: по-широка основа и по-тесен връх
    const b1 = box(13, 0.35, 10, M.ballast, 0, 0.88, zc, g); b1.userData.z = zc; ballast.push(b1);
    const b2 = box(11, 0.3, 10, M.ballast, 0, 1.05, zc, g); b2.userData.z = zc; ballast.push(b2);
  }
  // жп мост: бетонни колони и плоча (колоните идват с баласта, плочата също)
  for (let z = RIVER_Z - RIVER_W / 2 - 4; z <= RIVER_Z + RIVER_W / 2 + 4; z += 8) {
    for (const x of [-4.5, 4.5]) { const c = box(1.2, Y, 1.2, M.concrete, x, Y / 2, z, g); c.userData.z = z; ballast.push(c); }
  }
  for (let z = RIVER_Z - RIVER_W / 2 - 4; z < RIVER_Z + RIVER_W / 2 + 4; z += 8) {
    const d = box(12, 0.5, 8, M.concrete, 0, Y - 0.05, z + 4, g); d.userData.z = z + 4; ballast.push(d);
    const pr = box(0.3, 1.1, 8, M.pole, 6, Y + 0.6, z + 4, g); pr.userData.z = z + 4; track.push(pr);
    const pl = box(0.3, 1.1, 8, M.pole, -6, Y + 0.6, z + 4, g); pl.userData.z = z + 4; track.push(pl);
  }
  // траверси: инстанцирани, на всеки 0.9 м за двата коловоза
  const sleepers = [];
  for (let z = z0 + 0.5; z < z0 + LEN; z += 0.9) for (const x of TRACK_X) sleepers.push([x, z]);
  const sGeo = new THREE.BoxGeometry(2.6, 0.18, 0.28);
  const sMesh = new THREE.InstancedMesh(sGeo, M.sleeper, sleepers.length);
  const m4 = new THREE.Matrix4();
  sleepers.forEach(([x, z], i) => { m4.makeTranslation(x, Y + 0.12, z); sMesh.setMatrixAt(i, m4); });
  sMesh.castShadow = sMesh.receiveShadow = true;
  g.add(sMesh);
  // релси: отсечки по 10 м (за да се появяват с фронта)
  for (let z = z0; z < z0 + LEN; z += 10) for (const x of TRACK_X) for (const s of [-1, 1]) {
    const r = box(0.12, 0.16, 10, M.rail, x + s * GAUGE / 2, Y + 0.29, z + 5, g); r.userData.z = z + 5; track.push(r);
  }
  // контактна мрежа: стълб с конзола на всеки 30 м + провод над всеки коловоз; светофари
  const H = Y + 6.2;
  for (let z = z0 + 8; z < z0 + LEN; z += 30) {
    const grp = new THREE.Group(); grp.userData.z = z; g.add(grp); wires.push(grp);
    box(0.35, H, 0.35, M.pole, 6.8, H / 2, z, grp);
    box(0.35, H, 0.35, M.pole, -6.8, H / 2, z, grp);
    box(14, 0.25, 0.25, M.pole, 0, H, z, grp);                                   // портална греда
    for (const x of TRACK_X) box(0.08, 0.6, 0.08, M.dark, x, H - 0.4, z, grp);  // окачване
  }
  for (const x of TRACK_X) {   // проводите — по една линия на сегмент от 30 м
    for (let z = z0 + 8; z < z0 + LEN - 30; z += 30) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, H - 0.7, z), new THREE.Vector3(x, H - 1.1, z + 15), new THREE.Vector3(x, H - 0.7, z + 30)]);
      const ln = new THREE.Line(geo, M.wire); ln.userData.z = z + 30; g.add(ln); wires.push(ln);
    }
  }
  for (const [z, side] of [[z0 + 25, 1], [z0 + LEN - 30, -1]]) {
    const sg = new THREE.Group(); sg.userData.z = z; g.add(sg); wires.push(sg);
    box(0.2, 4, 0.2, M.dark, side * 5.2, 2 + Y, z, sg);
    box(0.6, 1.4, 0.4, M.dark, side * 5.2, 4.2 + Y, z, sg);
    for (const [k, c] of [[0, 0x30ff60], [1, 0xff3030]]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshBasicMaterial({ color: c })); l.position.set(side * 5.2, 4.6 - k * 0.5 + Y, z + 0.22 * side); sg.add(l);
    }
  }
  // машини: багер и самосвали (Kenney), машина за полагане на релси (процедурна)
  const clone = (n, s) => { const o = A[n].scene.clone(true); o.scale.setScalar(s); o.traverse(m => { if (m.isMesh) m.castShadow = true; }); g.add(o); return o; };
  // истинската техника на играта (vehmodels.js: дължина 1, предницата към +z), иначе Kenney
  const trucks = [];
  for (let k = 0; k < 2; k++) { if (A['sf-dump']) trucks.push(clone('sf-dump', 7.5)); else if (A.truck) trucks.push(clone('truck', 2.2)); }
  if (A['sf-excavator']) trucks.push(clone('sf-excavator', 8.5)); else if (A['tractor-shovel']) trucks.push(clone('tractor-shovel', 2.2));
  if (A['sf-backhoe']) trucks.push(clone('sf-backhoe', 6.5));
  const layer = makeLayer(); g.add(layer);
  // влак на готовата линия
  const train = new THREE.Group();
  const realTrain = (grp, kinds) => { let z = 0; for (const kd of kinds) { const m = trainCar(kd, z | 0); if (!m) return false; const k = 2.4 * 6.6 / 6.6; z -= m.userData.len / 2; m.position.z = z; z -= m.userData.len / 2 + 0.5; grp.add(m); } return true; };
  if (hasTrainModel('vl82')) realTrain(train, ['vl82', 'boxcar', 'hopper2', 'flat', 'boxcar']);
  else if (hasTrainModel('loco')) realTrain(train, ['loco', 'hopper', 'flat', 'hopper', 'flat']);
  else if (A['train-locomotive-a']) {
    ['train-locomotive-a', 'train-carriage-container-red', 'train-carriage-box', 'train-carriage-coal', 'train-carriage-flatbed-wood'].forEach((n, i) => {
      if (!A[n]) return; const o = A[n].scene.clone(true); o.scale.setScalar(2.4); o.position.z = -i * 6.6; train.add(o);
    });
  }
  g.add(train);
  // втори влак в обратна посока по другия коловоз: пътнически (електрически мотриси)
  const train2 = new THREE.Group();
  if (hasTrainModel('paxLoco') && hasTrainModel('paxCar')) realTrain(train2, ['paxLoco', 'paxCar', 'paxCar', 'paxCar']);
  else ['train-electric-city-a', 'train-electric-city-b', 'train-electric-city-b', 'train-electric-city-a'].forEach((n, i) => {
    if (!A[n]) return; const o = A[n].scene.clone(true); o.scale.setScalar(2.4); o.position.z = -i * 6.6; if (i === 3) o.rotation.y = Math.PI; train2.add(o);
  });
  train2.rotation.y = Math.PI;
  g.add(train2);

  function update(stage, prog, t = 0) {
    water.update(t);
    const fz = z0 + LEN * prog, done = stage > 3;
    reveal(earth, stage > 0 ? 1e9 : fz);
    reveal(ballast, stage > 1 ? 1e9 : stage === 1 ? fz : -1e9);
    reveal(track, stage > 2 ? 1e9 : stage === 2 ? fz : -1e9);
    reveal(wires, done ? 1e9 : stage === 3 ? fz : -1e9);
    // траверсите се появяват с фронта на етап 3
    const nVis = stage > 2 ? sleepers.length : stage === 2 ? sleepers.filter(([, z]) => z <= fz).length : 0;
    sMesh.count = nVis;
    // машината за полагане: върху левия коловоз, точно на фронта
    layer.visible = stage === 2;
    layer.position.set(TRACK_X[0], Y + 0.1, fz + 4);
    trucks.forEach((tr, k) => {
      tr.visible = !done && stage < 2;
      tr.position.set((k % 2 ? 1 : -1) * 10, 0, fz - 10 - k * 9 + Math.sin(t * 0.8 + k) * 4);
      tr.rotation.y = Math.cos(t * 0.8 + k) >= 0 ? 0 : Math.PI;   // гледа накъдето се движи
    });
    // готовата линия: влак минава от единия край до другия
    train.visible = done && train.children.length > 0;
    if (train.visible) { const T = 14, k = (t % T) / T; train.position.set(TRACK_X[1], Y + 0.32, z0 - 40 + (LEN + 80) * k); }
    train2.visible = done && train2.children.length > 0;
    if (train2.visible) { const T = 11, k = ((t + 5) % T) / T; train2.position.set(TRACK_X[0], Y + 0.32, z0 + LEN + 40 - (LEN + 80) * k); }
  }
  update(opts.stage ?? 0, opts.prog ?? 0);
  return { group: g, update };
}
