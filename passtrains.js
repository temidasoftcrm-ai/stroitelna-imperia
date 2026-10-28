// passtrains.js — минаващи влакове (декорация): двупътна линия от външната страна на гарата, по един коловоз
// за всяка посока, и до 5 влака едновременно — товарни и пътнически (електрически мотриси). Не влияят на играта.
import { feature } from './lab/feature.js';
import * as THREE from 'three';
import { placeCars } from './trackpath.js';
const TVAR = feature('trains-variety');
import { hasTrainModel, trainCar } from './trainmodels.js';

const LEN0 = 600, CAR = 6.2, SCALE = 2.2, GAP = 6.5, MAX = 5;   // от край до край на земята
const FREIGHT = ['train-carriage-box', 'train-carriage-flatbed-wood', 'train-carriage-coal', 'train-carriage-container-red'];

// deps: { scene, group (за коловозите), model(name, scale), instanced(name, mats), x (оста на гаровия коловоз), trackX?, horn() }
export function createPassingTrains(deps) {
  const LEN = deps.len || LEN0, ZN = deps.zN != null ? Math.max(-LEN, deps.zN) : -LEN, DEAD = deps.zN != null;   // rail-coast: северният край — буфери; влаковете идват от юг, спират и се връщат   // rail-crossings: до тунела в края на земята (иначе 600)
  const X0 = deps.trackX ?? deps.x - 4.6;
  // два коловоза: по външния се движи към +z, по следващия — към −z
  const lines = [{ x: X0, dir: 1, list: [] }, { x: X0 - GAP, dir: -1, list: [] }];
  const path = deps.path || ((x, z) => ({ x, z, yaw: 0 }));   // trackpath.js: завоят покрай морето
  const tracks = [];
  for (const L of lines) {
    const q = new THREE.Quaternion(), s = new THREE.Vector3(4, 4, 4), p = new THREE.Vector3(), mats = [], up = new THREE.Vector3(0, 1, 0);
    for (let z = ZN; z <= LEN; z += 4) { const m = path(L.x, z); q.setFromAxisAngle(up, m.yaw); mats.push(new THREE.Matrix4().compose(p.set(m.x, 0, m.z), q, s)); }
    const tr = deps.instanced('track', mats); deps.group.add(tr); tracks.push(tr);
  }
  let wait = 4 + Math.random() * 6;
  const count = () => lines.reduce((a, L) => a + L.list.length, 0);

  let tvN = 0;   // trains-variety: номерът на влака — коя композиция
  function make(passenger, express) {
    const g = new THREE.Group();
    let n;
    const lenOf = () => g.children.reduce((a, m) => a + (m.userData.len ? m.userData.len + 0.5 : CAR), 0);
    if (express === 'oe' && hasTrainModel('oeLoco') && hasTrainModel('oeCar')) {   // „Ориент Експрес“ — след изпълнената поръчка
      g.add(trainCar('oeLoco')); for (let i = 0; i < 5; i++) g.add(trainCar('oeCar'));
      return { g, len: lenOf(), express: true };
    }
    if (express && hasTrainModel('ave')) {   // „Стрела“ — скоростен влак (челен вагон отпред и отзад)
      g.add(trainCar('ave')); if (hasTrainModel('hsw')) for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) g.add(trainCar('hsw')); g.add(trainCar('aveTail'));
      return { g, len: lenOf(), express: true };
    }
    if (TVAR && (passenger ? hasTrainModel('elLoco') : hasTrainModel('upLoco'))) {   // 🚆 trains-variety (T1): 4 пътнически и 3 товарни композиции — по реда (детерминистично)
      const n = tvN++, r = (k => () => (k = (k * 16807) % 2147483647) / 2147483647)(7919 * (n + 1)), pick = a => a[(r() * a.length) | 0], has = k => hasTrainModel(k);
      if (passenger) { const v = n % 4, [loco, cars] = v === 0 ? ['elLoco', ['silverCar']] : v === 1 ? ['elLoco', ['nightCar']] : v === 2 ? ['steamLoco', ['paxCar', 'silverCar']] : ['paxLoco', ['paxCar', 'nightCar']];
        g.add(trainCar(has(loco) ? loco : 'elLoco')); const C = cars.filter(has); for (let i = 0, k = 3 + (r() * 4 | 0); i < k; i++) g.add(trainCar(pick(C.length ? C : ['silverCar'])));
        return { g, len: lenOf() }; }
      const v = n % 3, loco = v === 1 && has('vl82') ? 'vl82' : 'upLoco', W = (v === 0 ? ['cistern', 'cistern', 'gondola', 'timber', 'srrCar'] : v === 1 ? ['wmCoal', 'wmCoal', 'hopX', 'gondola', 'hopper2'] : ['autorack', 'autorack', 'flat', 'boxcar', 'srrCar', 'timber']).filter(has);
      g.add(trainCar(loco)); if (v === 2 && r() < 0.5) g.add(trainCar('upLoco'));   // понякога — два локомотива
      for (let i = 0, k = 6 + (r() * 7 | 0); i < k; i++) g.add(trainCar(pick(W.length ? W : ['srrCar']), (r() * 99) | 0));
      return { g, len: lenOf() };
    }
    if (passenger && hasTrainModel('paxLoco') && hasTrainModel('paxCar')) {   // пътнически: ЧС200 + сини вагони (trains-real)
      g.add(trainCar('paxLoco')); for (let i = 0, k = 3 + (Math.random() * 4 | 0); i < k; i++) g.add(trainCar('paxCar'));
      return { g, len: lenOf() };
    }
    if (!passenger && hasTrainModel('vl82')) {   // товарен: ВЛ82 + покрити, въглищни и платформи с контейнери (trains-real)
      g.add(trainCar('vl82'));
      for (let i = 0, k = 5 + (Math.random() * 6 | 0); i < k; i++) { const r = Math.random(); g.add(trainCar(r < 0.35 ? 'boxcar' : r < 0.7 ? 'hopper2' : 'flat', (Math.random() * 99) | 0)); }
      return { g, len: lenOf() };
    }
    if (!passenger && hasTrainModel('loco')) {   // товарен: дизелов локомотив + бункери и платформи с контейнери
      n = 4 + (Math.random() * 6 | 0);
      g.add(trainCar('loco'));
      for (let i = 1; i <= n; i++) g.add(trainCar(Math.random() < 0.45 ? 'hopper' : 'flat', (Math.random() * 99) | 0));
      return { g, len: lenOf() };
    }
    {   // резерва без истинските модели: само вагони (детските локомотиви и мотриси са изтрити)
      n = 5 + (Math.random() * 7 | 0); const fr = FREIGHT.filter(hasModel); if (!fr.length) return { g, len: 0 };
      for (let i = 1; i <= n; i++) { const m = deps.model(fr[(Math.random() * fr.length) | 0], SCALE); m.position.z = -i * CAR; g.add(m); }
    }
    return { g, len: (n + 1) * CAR };
  }
  const known = {};
  function hasModel(n) { if (!(n in known)) { try { known[n] = !!deps.model(n, 1); } catch { known[n] = false; } } return known[n]; }

  // нов влак на коловоз, на който последният вече е изминал достатъчно (за да не се застъпват)
  function spawn() {
    const free = lines.filter(L => DEAD ? L.dir < 0 && !L.list.length : (() => { const last = L.list[L.list.length - 1]; return !last || Math.abs(last.z - (-L.dir * LEN)) > last.len + 90; })());
    if (!free.length) return;
    const L = free[(Math.random() * free.length) | 0], passenger = Math.random() < 0.45, express = passenger && deps.orient && deps.orient() && Math.random() < 0.3 ? 'oe' : passenger && Math.random() < 0.35;
    const { g, len } = make(passenger, express);
    const z = -L.dir * LEN;
    placeCars(g, path, L.x, z, L.dir, CAR, 0.3);
    deps.scene.add(g);
    const speed = express === 'oe' ? 16 + Math.random() * 3 : express ? 34 + Math.random() * 6 : passenger ? 20 + Math.random() * 6 : 11 + Math.random() * 5;
    L.list.push({ g, z, len, speed, v: speed });
    if (deps.horn && Math.random() < 0.5) deps.horn();
  }
  // dt в секунди игрово време
  function update(dt) {
    wait -= dt;
    if (wait <= 0 && count() < MAX) { spawn(); wait = 6 + Math.random() * 10; }
    for (const L of lines) {
      for (let i = 0; i < L.list.length; i++) {
        const t = L.list[i], ahead = L.list[i - 1];
        // не настига влака пред себе си: ако е близо, кара с неговата скорост
        let want = t.speed;
        if (t.back) want = t.speed * 0.7;
        else if (ahead) { const gap = (ahead.z - t.z) * L.dir - ahead.len; if (gap < 60) want = Math.min(want, ahead.v * (gap < 25 ? 0.8 : 1)); }
        if (DEAD && !t.back) { const left = t.z - Math.max(ZN + 3, deps.stopZ ?? -1e9); want = Math.min(want, Math.max(0, Math.sqrt(2 * 0.6 * Math.max(0, left)))); if (left < 0.5 && t.v < 0.6) { t.v = 0; t.wait = (t.wait ?? 15) - dt; if (t.wait <= 0) { t.back = true; t.z += t.len; } } }   // rail-coast: спира пред буферите, после се връща
        t.v += (want - t.v) * Math.min(1, dt * 1.5);
        const dir = t.back ? 1 : L.dir; t.z += dir * t.v * dt;
        placeCars(t.g, path, L.x, t.z, dir, CAR, 0.3);
      }
      while (L.list.length && Math.abs(L.list[0].z) > LEN + L.list[0].len) { deps.scene.remove(L.list[0].g); L.list.shift(); }
    }
  }
  function clear() {
    for (const L of lines) { for (const t of L.list) deps.scene.remove(t.g); L.list.length = 0; }
    for (const tr of tracks) deps.group.remove(tr);
  }
  // rail-crossings: всички влакове по линията — главата (z), дължината и скоростта със знака на посоката
  const trainsAt = () => lines.flatMap(L => L.list.map(t => ({ z: t.z, len: t.len, v: L.dir * t.v, x: L.x, ref: t })));
  return { update, clear, trainsAt, get train() { const t = lines[0].list[0] || lines[1].list[0]; return t ? { z: t.z, v: t.v, stop: 0 } : null; }, count };
}
