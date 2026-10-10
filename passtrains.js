// passtrains.js — минаващи влакове (декорация): двупътна линия от външната страна на гарата, по един коловоз
// за всяка посока, и до 5 влака едновременно — товарни и пътнически (електрически мотриси). Не влияят на играта.
import * as THREE from 'three';
import { placeCars } from './trackpath.js';

const LEN = 600, CAR = 6.2, SCALE = 2.2, GAP = 6.5, MAX = 5;   // от край до край на земята
const FREIGHT = ['train-carriage-box', 'train-carriage-flatbed-wood', 'train-carriage-coal', 'train-carriage-container-red'];

// deps: { scene, group (за коловозите), model(name, scale), instanced(name, mats), x (оста на гаровия коловоз), trackX?, horn() }
export function createPassingTrains(deps) {
  const X0 = deps.trackX ?? deps.x - 4.6;
  // два коловоза: по външния се движи към +z, по следващия — към −z
  const lines = [{ x: X0, dir: 1, list: [] }, { x: X0 - GAP, dir: -1, list: [] }];
  const path = deps.path || ((x, z) => ({ x, z, yaw: 0 }));   // trackpath.js: завоят покрай морето
  const tracks = [];
  for (const L of lines) {
    const q = new THREE.Quaternion(), s = new THREE.Vector3(4, 4, 4), p = new THREE.Vector3(), mats = [], up = new THREE.Vector3(0, 1, 0);
    for (let z = -LEN; z <= LEN; z += 4) { const m = path(L.x, z); q.setFromAxisAngle(up, m.yaw); mats.push(new THREE.Matrix4().compose(p.set(m.x, 0, m.z), q, s)); }
    const tr = deps.instanced('track', mats); deps.group.add(tr); tracks.push(tr);
  }
  let wait = 4 + Math.random() * 6;
  const count = () => lines.reduce((a, L) => a + L.list.length, 0);

  function make(passenger) {
    const g = new THREE.Group();
    let n;
    if (passenger && deps.model && hasModel('train-electric-city-a')) {
      n = 3 + (Math.random() * 3 | 0);
      for (let i = 0; i <= n; i++) {
        const m = deps.model(i === 0 || i === n ? 'train-electric-city-a' : 'train-electric-city-b', SCALE);
        m.position.z = -i * CAR; if (i === n) m.rotation.y = Math.PI; g.add(m);
      }
    } else {
      n = 5 + (Math.random() * 7 | 0);
      g.add(deps.model('train-locomotive-a', SCALE));
      for (let i = 1; i <= n; i++) { const m = deps.model(FREIGHT[(Math.random() * FREIGHT.length) | 0], SCALE); m.position.z = -i * CAR; g.add(m); }
    }
    return { g, len: (n + 1) * CAR };
  }
  const known = {};
  function hasModel(n) { if (!(n in known)) { try { known[n] = !!deps.model(n, 1); } catch { known[n] = false; } } return known[n]; }

  // нов влак на коловоз, на който последният вече е изминал достатъчно (за да не се застъпват)
  function spawn() {
    const free = lines.filter(L => { const last = L.list[L.list.length - 1]; return !last || Math.abs(last.z - (-L.dir * LEN)) > last.len + 90; });
    if (!free.length) return;
    const L = free[(Math.random() * free.length) | 0], passenger = Math.random() < 0.45;
    const { g, len } = make(passenger);
    const z = -L.dir * LEN;
    placeCars(g, path, L.x, z, L.dir, CAR, 0.3);
    deps.scene.add(g);
    const speed = passenger ? 20 + Math.random() * 6 : 11 + Math.random() * 5;
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
        if (ahead) { const gap = (ahead.z - t.z) * L.dir - ahead.len; if (gap < 60) want = Math.min(want, ahead.v * (gap < 25 ? 0.8 : 1)); }
        t.v += (want - t.v) * Math.min(1, dt * 1.5);
        t.z += L.dir * t.v * dt;
        placeCars(t.g, path, L.x, t.z, L.dir, CAR, 0.3);
      }
      while (L.list.length && Math.abs(L.list[0].z) > LEN + L.list[0].len) { deps.scene.remove(L.list[0].g); L.list.shift(); }
    }
  }
  function clear() {
    for (const L of lines) { for (const t of L.list) deps.scene.remove(t.g); L.list.length = 0; }
    for (const tr of tracks) deps.group.remove(tr);
  }
  return { update, clear, get train() { const t = lines[0].list[0] || lines[1].list[0]; return t ? { z: t.z, v: t.v, stop: 0 } : null; }, count };
}
