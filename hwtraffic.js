// hwtraffic.js — коли и камиони по магистралата край града: по две ленти във всяка посока, с различна скорост,
// камионите са в дясната (бавна) лента. Колите излизат от единия край и се връщат отначало от другия.
// От време на време (на 25–70 s) по бързата лента профучава спешна кола с включени буркани — линейка, полиция или пожарна,
// понякога на колона (пожарна + полиция); сирената я пуска самият буркан (vehmodels.js), когато е близо до камерата.
import * as THREE from 'three';
import { feature } from './lab/feature.js';

const CARS = ['sedan', 'suv', 'taxi', 'van', 'sedan-sports', 'suv-luxury', 'hatchback-sports', 'police'];
const TRUCKS = ['truck', 'truck-flat', 'delivery', 'truck-dump-red', 'truck-concrete-red'];
const SCALE = new Proxy({ 'truck-dump-red': 0.62, 'truck-concrete-red': 0.62, 'sf-semi-0': 1, 'sf-semi-1': 1 }, { get: (o, k) => typeof k === 'string' && k.startsWith('sf-car-') ? 1 : o[k] });   // sf-* са вече в мащаба на града   // sf-semi-* са вече в мащаба на града   // моделите от строителния пакет са в метри

// parent: групата на магистралата в града; model(name, scale); A: заредените модели
// zc: оста на магистралата (z в света); len: дължина по x; y: височина на платното
export function createHwTraffic(parent, model, A, zc, len, y = 0.92, ab = false) {   // ab — аутобан: 4 ленти на посока, повече коли
  const g = new THREE.Group(); parent.add(g);
  const list = [], half = len / 2;
  // посока +x (на изток) е откъм +z (дясно движение), −x е откъм −z; лента 0 = бърза (към разделителната ивица)
  const laneZ = (dir, lane) => ab ? zc + dir * (2 + 1.8 + lane * 3.6) : zc + dir * (6 + (lane ? 2.2 : -2.2));
  for (let k = 0; k < (ab ? 44 : 28); k++) {
    const truck = k % 3 === 0, dir = k % 2 ? 1 : -1, lane = ab ? (truck ? 3 - (k % 2) : (k >> 1) % 3) : truck ? 1 : (k % 4 < 2 ? 0 : 1);
    const realCars = ['Sedan', 'Hatchback', 'SUV', 'Pickup', 'Taxi', 'Muscle', 'Muscle_2', 'Van', 'Police_SUV'].map(n => 'sf-car-' + n).filter(n => A[n]);
    const names = (truck ? (feature('trucks-real') && A['sf-semi-0'] ? ['sf-semi-0', 'sf-semi-1'] : TRUCKS) : (feature('cars-real') && realCars.length ? realCars : CARS)).filter(n => A[n]);   // модерните ТИР-ове (trucks-real)
    if (!names.length) continue;
    const n = names[(k * 7) % names.length], o = model(n, SCALE[n] || 1.25);
    o.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    const c = { o, dir, x: -half + Math.random() * len, z: laneZ(dir, lane), v: (truck ? 15 : 22) + Math.random() * (truck ? 4 : 10) };
    o.position.set(c.x, y, c.z);
    g.add(o); list.push(c);
  }
  // спешните коли: по един модел от вид, скрити, докато не дойде ред
  const EM = [['police', ['sf-car-Police_SUV', 'sf-car-Police_Sedan', 'police']], ['ambulance', ['sf-car-Ambulance', 'ambulance']], ['fire', ['sf-car-Firetruck', 'firetruck']]];
  const em = [];
  for (const [kind, ns] of EM) { const n = ns.find(x => A[x]); if (!n) continue; const o = model(n, SCALE[n] || 1.25); o.visible = false; o.userData.beaconsOn = 1; o.position.y = y; g.add(o); em.push({ kind, o, on: false }); }
  let emT = 8 + Math.random() * 20;
  function emSend() {
    const free = em.filter(e => !e.on); if (!free.length) return;
    const dir = Math.random() < 0.5 ? 1 : -1, first = free[(Math.random() * free.length) | 0];
    const group = [first]; if (first.kind === 'fire' && Math.random() < 0.6) { const p = free.find(e => e.kind === 'police'); if (p) group.push(p); }   // пожарната — с полицейски ескорт
    group.forEach((e, i) => { e.on = true; e.dir = dir; e.x = -dir * (half + 6 + i * 14); e.v = 34 + Math.random() * 6; e.o.position.set(e.x, y, laneZ(dir, 0)); e.o.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; e.o.visible = true; e.o.userData.sirenOn = false; });
  }
  function update(dt) {
    for (const c of list) {
      c.x += c.dir * c.v * dt;
      if (c.x > half) c.x -= len; else if (c.x < -half) c.x += len;
      c.o.position.x = c.x;
    }
    if (!em.length) return;
    if ((emT -= dt) <= 0) { emSend(); emT = 25 + Math.random() * 45; }
    for (const e of em) if (e.on) {
      e.x += e.dir * e.v * dt; e.o.position.x = e.x;
      for (const c of list) if (c.dir === e.dir && Math.abs(c.o.position.z - e.o.position.z) < 1.5 && (c.x - e.x) * e.dir > 0 && (c.x - e.x) * e.dir < 12) c.x += e.dir * 30 * dt;   // колите отпред се отдръпват напред
      if (e.x * e.dir > half + 6) { e.on = false; e.o.visible = false; }
    }
  }
  return { update, set visible(v) { g.visible = v; }, group: g };
}
