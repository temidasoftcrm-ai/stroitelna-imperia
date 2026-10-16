// hwtraffic.js — коли и камиони по магистралата край града: по две ленти във всяка посока, с различна скорост,
// камионите са в дясната (бавна) лента. Колите излизат от единия край и се връщат отначало от другия.
import * as THREE from 'three';
import { feature } from './lab/feature.js';

const CARS = ['sedan', 'suv', 'taxi', 'van', 'sedan-sports', 'suv-luxury', 'hatchback-sports', 'police'];
const TRUCKS = ['truck', 'truck-flat', 'delivery', 'truck-dump-red', 'truck-concrete-red'];
const SCALE = { 'truck-dump-red': 0.62, 'truck-concrete-red': 0.62, 'sf-semi-0': 1, 'sf-semi-1': 1 };   // sf-semi-* са вече в мащаба на града   // моделите от строителния пакет са в метри

// parent: групата на магистралата в града; model(name, scale); A: заредените модели
// zc: оста на магистралата (z в света); len: дължина по x; y: височина на платното
export function createHwTraffic(parent, model, A, zc, len, y = 0.92) {
  const g = new THREE.Group(); parent.add(g);
  const list = [], half = len / 2;
  // посока +x (на изток) е откъм +z (дясно движение), −x е откъм −z; лента 0 = бърза (към разделителната ивица)
  const laneZ = (dir, lane) => zc + dir * (6 + (lane ? 2.2 : -2.2));
  for (let k = 0; k < 28; k++) {
    const truck = k % 3 === 0, dir = k % 2 ? 1 : -1, lane = truck ? 1 : (k % 4 < 2 ? 0 : 1);
    const names = (truck ? (feature('trucks-real') && A['sf-semi-0'] ? ['sf-semi-0', 'sf-semi-1'] : TRUCKS) : CARS).filter(n => A[n]);   // модерните ТИР-ове (trucks-real)
    if (!names.length) continue;
    const n = names[(k * 7) % names.length], o = model(n, SCALE[n] || 1.25);
    o.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    const c = { o, dir, x: -half + Math.random() * len, z: laneZ(dir, lane), v: (truck ? 15 : 22) + Math.random() * (truck ? 4 : 10) };
    o.position.set(c.x, y, c.z);
    g.add(o); list.push(c);
  }
  function update(dt) {
    for (const c of list) {
      c.x += c.dir * c.v * dt;
      if (c.x > half) c.x -= len; else if (c.x < -half) c.x += len;
      c.o.position.x = c.x;
    }
  }
  return { update, set visible(v) { g.visible = v; }, group: g };
}
