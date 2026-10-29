// seaside.js — море за крайбрежните градове (Варна, Бургас, Констанца, Истанбул, Солун, Атина, Барселона…):
// морето е на север от града, с плаж и крайбрежна алея с палми, пристанище с кей, портални кранове и контейнери,
// фар на вълнолома, кораби на котва и лодки, които плават. Жп линията минава по насип през морето.
import * as THREE from 'three';
import { canvasTex } from './texdata.js';   // fac-data (T1): статичните платна → собствени данни (не се губят)
import { createPortLights } from './portlights.js';
import { makeWater } from './water.js';
import { loadShipModels, hasShipModel, shipModel, setShipNight, mscTick } from './shipmodels.js';
import { isRealBoat, isRealShip, realBoat, pendingShip, swapPendingShips } from './boatsreal.js';
import { portReal } from './portreal.js';
import { feature } from './lab/feature.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';   // crane-swan (T2)

import { EXTRA_COASTAL } from './countries.js';
export const SEASIDE = ['varna', 'burgas', 'constanta', 'istanbul', 'thessaloniki', 'athens', 'barcelona', 'amsterdam', 'rotterdam', 'newyork', 'losangeles', 'rio', 'buenosaires', 'capetown', 'dubai', 'mumbai', 'singapore', 'hongkong', 'shanghai', 'tokyo', 'sydney'];
SEASIDE.push(...EXTRA_COASTAL);
// sea2: следата зад лодките — V от пяна, избледнява назад (една текстура за всички)
const SEA2 = feature('sea2'), WAKE_GEO = new THREE.PlaneGeometry(7, 26).rotateX(-Math.PI / 2);
let WAKE_T = null;
function wakeTex() {
  if (WAKE_T) return WAKE_T;
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.globalAlpha = 0.28; x.beginPath(); x.moveTo(29, 0); x.lineTo(35, 0); x.lineTo(64, 256); x.lineTo(0, 256); x.closePath(); x.fill();   // разбърканата вода между ръкавите
  x.globalAlpha = 1; x.strokeStyle = gr; x.lineWidth = 5; x.beginPath(); x.moveTo(32, 2); x.lineTo(3, 256); x.moveTo(32, 2); x.lineTo(61, 256); x.stroke();   // двата ръкава на V-то
  return (WAKE_T = canvasTex(c));
}
// sea-coast: с колко брегът (извит) влиза навътре спрямо допирателната в x ± h — с толкова кеят се отмества към морето, за да не стъпва на пясъка в ъглите
const coastBulge = (CO, x, h) => { const sl = (CO(x + 20) - CO(x - 20)) / 40; let m = 0; for (const d of [-h, -h / 2, h / 2, h]) m = Math.max(m, CO(x) + sl * d - CO(x + d)); return m; };
export const SEA_MODELS = ['boat-row-small'];   // детските кораби, лодки и контейнери са изтрити — вместо тях boatsreal.js

const mat = (c, r = 0.9, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const box = (w, h, d, m, x, y, z, g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
const rnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function useModel(A, model, n, s) {
  if (isRealBoat(n)) return realBoat(A, model, n, s) || (isRealShip(n) ? pendingShip(n, s) : null);   // истинските (boatsreal.js); товарните идват малко след града
  if (!A[n]) return null; const o = model(n, s); o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o;
}

// ⚡ флаг perf-fix2 (perf-report): еднаквите статични модели (контейнерите, палмите) — InstancedMesh по модел и родител:
// ~84 контейнера × няколко части и десетки палми → по един draw call на част. list: [{ o, key }] — вече добавени в родителя си.
const _inv = new THREE.Matrix4(), _m = new THREE.Matrix4();
function instancify(list) {
  const groups = new Map();
  for (const { o, key } of list) { if (!o || !o.parent) continue; const k = key + '|' + o.parent.uuid; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); }
  for (const objs of groups.values()) {
    if (objs.length < 2) continue;
    const T = objs[0], parent = T.parent; let bad = false; const parts = [];
    T.updateMatrixWorld(true); _inv.copy(T.matrixWorld).invert();
    T.traverse(m => { if (m.isSkinnedMesh || m.isInstancedMesh) bad = true; else if (m.isMesh && m.visible) parts.push({ m, rel: _inv.clone().multiply(m.matrixWorld) }); });
    if (bad || !parts.length) continue;
    for (const { m, rel } of parts) {
      const im = new THREE.InstancedMesh(m.geometry, m.material, objs.length);
      objs.forEach((o, i) => { o.updateMatrix(); im.setMatrixAt(i, _m.multiplyMatrices(o.matrix, rel)); });
      im.castShadow = m.castShadow; im.receiveShadow = m.receiveShadow; im.computeBoundingSphere(); im.userData.inst = T.userData.src || 'seaside'; parent.add(im);
    }
    for (const o of objs) parent.remove(o);
  }
}

// group: групата на града; deps: { A, model(name, scale), label(text, color, w) }
// opts: { zEdge (северният ръб на града), xMin, xMax (ширина на града), railX: [x1, x2] (коридор на жп линията), seed }
export function addSeaside(group, deps, opts) {
  const { A, model } = deps, r = rnd(opts.seed || 777);
  const g = new THREE.Group(); group.add(g);
  const zE = opts.zEdge, x0 = opts.xMin - 400, x1 = opts.xMax + 400, beachD = 22, seaZ = zE - beachD;
  const CO = feature('sea-coast') && opts.coast ? opts.coast : null;   // sea-coast: бреговата линия на плана v2 (крива) — тогава правият плаж, алеята, палмите и чадърите не се правят (планът си има свои по брега)
  const [rx1, rx2] = opts.railX || [-1e9, -1e9];
  // плаж и крайбрежна алея
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, beachD), mat(0xe6d29a, 1)); sand.rotation.x = -Math.PI / 2; sand.position.set((x0 + x1) / 2, 0.01, zE - beachD / 2); sand.receiveShadow = true; g.add(sand);
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(opts.xMax - opts.xMin + 40, 5), mat(0xcfc3a8, 0.9)); walk.rotation.x = -Math.PI / 2; walk.position.set((opts.xMin + opts.xMax) / 2, 0.03, zE - 3); g.add(walk);
  // море: две части — от двете страни на жп насипа
  const water = makeWater({ color: 0x2f86c8, repeat: 60 }), seaMat = water.material;   // вълни с отблясъци (water.js)
  const parts = [[x0, Math.min(rx1, x1)], [Math.max(rx2, x0), x1]].filter(([a, b]) => b - a > 1);
  const seaD = 900, waves = [];
  for (const [a, b] of parts) {
    const geo = new THREE.PlaneGeometry(b - a, seaD, Math.max(2, Math.round((b - a) / 20)), 40); geo.rotateX(-Math.PI / 2);
    const s = new THREE.Mesh(geo, seaMat); s.position.set((a + b) / 2, 0.04, seaZ - seaD / 2); g.add(s);
    waves.push({ geo, base: Float32Array.from(geo.attributes.position.array) });
  }
  if (CO) sand.visible = walk.visible = false;   // sea-coast: пясъкът и алеята — тези на плана, по брега
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 1.6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })); foam.rotation.x = -Math.PI / 2; foam.position.set((x0 + x1) / 2, 0.08, seaZ); g.add(foam);
  if (CO) foam.visible = false;
  // жп насип през морето
  if (rx2 > rx1) { const e = box(rx2 - rx1, 1.2, seaD, mat(0x8f8a80, 1), (rx1 + rx2) / 2, -0.5, seaZ - seaD / 2, g); e.castShadow = false; }
  // палми по алеята
  const palm = () => {
    const p = new THREE.Group(), h = 6 + r() * 2;
    for (let k = 0; k < 5; k++) { const sgm = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, h / 5, 6), mat(0x8a6a44)); sgm.position.set(k * 0.1, h / 10 + k * h / 5, 0); p.add(sgm); }
    for (let f = 0; f < 6; f++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.6, 4).rotateX(Math.PI / 2).translate(0, 0, 1.8), mat(0x3f9a3a)); l.position.set(0.5, h, 0); l.rotation.set(-0.5, f / 6 * Math.PI * 2, 0); p.add(l); }
    p.traverse(m => { if (m.isMesh) m.castShadow = true; }); return p;
  };
  const sfp = [0, 1, 2, 3].map(i => `sf-palm-${i}`).filter(n => A && A[n]);   // хубавите палми (Sketchfab), ако са заредени
  let pk = 0; const INST = feature('perf-fix2'), inst = [];
  if (!CO) for (let x = opts.xMin; x <= opts.xMax; x += 14) { const pn = sfp.length ? sfp[pk++ % sfp.length] : null, p = pn ? model(pn, 8 + r() * 3) : palm(); p.position.set(x + r() * 4, 0, zE - 6.5); if (sfp.length) p.rotation.y = r() * 6; g.add(p); if (pn) inst.push({ o: p, key: pn }); }
  // чадъри на плажа
  const cols = [0xff5a5a, 0xffd23f, 0x3fa7ff, 0x50d18b];
  if (CO) { /* sea-coast: чадърите — не по правата линия във водата */ } else if (INST) {   // ⚡ perf-fix2: 48 отделни мрежи → 2 (цветът — по инстанция)
    const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4), mat(0xeeeeee), 24), tops = new THREE.InstancedMesh(new THREE.ConeGeometry(1.7, 0.7, 10), mat(0xffffff), 24), col = new THREE.Color();
    for (let k = 0; k < 24; k++) {
      const x = opts.xMin + 20 + r() * (opts.xMax - opts.xMin) * 0.55, z = zE - 10 - r() * 9;
      poles.setMatrixAt(k, _m.makeTranslation(x, 1.2, z)); tops.setMatrixAt(k, _m.makeTranslation(x, 2.5, z)); tops.setColorAt(k, col.setHex(cols[k % 4]));
    }
    for (const q of [poles, tops]) { q.computeBoundingSphere(); g.add(q); }
  } else for (let k = 0; k < 24; k++) {
    const x = opts.xMin + 20 + r() * (opts.xMax - opts.xMin) * 0.55, z = zE - 10 - r() * 9;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4), mat(0xeeeeee)); pole.position.set(x, 1.2, z); g.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.7, 10), mat(cols[k % 4])); top.position.set(x, 2.5, z); g.add(top);
  }
  // пристанище (източната част): кей, портални кранове, контейнери, товарен кораб
  const px = CO && opts.port ? opts.port.x : opts.xMax - 60, pSeaZ = CO ? CO(px) - 3 - coastBulge(CO, px, 60) : seaZ, pierZ = pSeaZ - 40;   // sea-coast: кейът — от брега пред пристанищния парцел на плана (3 м навътре във водата — до пясъка, не върху алеята)
  // sea-coast: всичко на пристанището е в своя група, завъртяна по посоката на брега (допирателната в px) около точката на брега — кеят е перпендикулярен на брега
  const pg = CO ? new THREE.Group() : g;
  if (CO) { const th = -Math.atan((CO(px + 20) - CO(px - 20)) / 40), c = Math.cos(th), sn = Math.sin(th); pg.rotation.y = th; pg.position.set(px - (px * c + pSeaZ * sn), 0, pSeaZ - (-px * sn + pSeaZ * c)); g.add(pg); }
  box(110, 1.4, 70, mat(0xb8b4aa, 0.9), px, 0.5, pSeaZ - 34, pg);
  const cranes = [], PL = createPortLights();
  // нощно осветление на кея: прожектори по брега и по ръба на кея
  for (const [mx, mz] of [[-50, -2], [0, -2], [50, -2], [-50, -64], [0, -64], [50, -64]]) PL.mast(pg, px + mx, pSeaZ + mz, { h: 20, r: 26 });
  for (let k = 0; k < 3; k++) {
    const c = new THREE.Group(), red = mat(k % 2 ? 0xd62828 : 0x1f5fbf, 0.6);
    for (const [sx, sz] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) box(0.8, 22, 0.8, red, sx, 12, sz, c);
    box(10, 1.6, 8, red, 0, 23, 0, c); const boom = box(1.2, 1.2, 46, red, 0, 24.5, -14, c); boom.castShadow = true;
    box(3, 2.4, 3, mat(0xeeeeee), 0, 21, -4, c);
    PL.beaconAt(c, 0, 24.4, 0); PL.beaconAt(c, 0, 25.6, -36.5, 0.5);
    c.position.set(px - 35 + k * 26, 1.2, pierZ + 8); pg.add(c); cranes.push(c);
  }
  for (let k = 0; k < 40; k++) {
    const n = ['cargo-container-a', 'cargo-container-b', 'cargo-container-c'][k % 3];
    const real = useModel(A, model, n, 3.2), o = real || box(4.4, 3.5, 8.8, mat([0xd62828, 0x1f5fbf, 0x2d8f4e, 0xffb300][k % 4], 0.7), 0, 0, 0, new THREE.Group());
    o.position.set(px - 40 + (k % 10) * 8, 1.2 + Math.floor(k / 20) * 3.5, pSeaZ - 10 - Math.floor((k % 20) / 10) * 10); o.rotation.y = Math.PI / 2;
    if (CO && opts.port && opts.port.lot) { const Lt = opts.port.lot, u = ((k % 10) - 4.5) * 7, v = (Math.floor((k % 20) / 10) - 0.5) * 14, cr = Math.cos(Lt.rot || 0), sr = Math.sin(Lt.rot || 0);   // sea-coast: контейнерният двор — на пристанищния парцел (не на кутия-склад)
      o.position.set(Lt.x + u * cr + v * sr, (real ? 0 : 1.75) + Math.floor(k / 20) * 3.5 + (feature('port-real') ? 0.2 : 0), Lt.z - u * sr + v * cr); o.rotation.y = (Lt.rot || 0) + Math.PI / 2; }
    g.add(o); if (real) inst.push({ o, key: n });
  }
  // 📦 port-real: контейнерният двор на парцела (сушата) — асфалтов депо-плац с ограда и осветление, не на тревата
  if (CO && opts.port && opts.port.lot && feature('port-real')) {
    const Lt = opts.port.lot, r0 = Lt.rot || 0, cr = Math.cos(r0), sr = Math.sin(r0), W = 78, D = 32, at = (u, v) => [Lt.x + u * cr + v * sr, Lt.z - u * sr + v * cr];
    const dep = new THREE.Group(); dep.position.set(Lt.x, 0, Lt.z); dep.rotation.y = r0; g.add(dep);
    box(W, 0.2, D, mat(0x3c3f44, 0.95), 0, 0.1, 0, dep); box(W - 1, 0.01, 0.25, mat(0xe8e2c8, 0.8), 0, 0.21, 0, dep);   // асфалтът и разделителната линия между редовете
    const fen = mat(0x8a9097, 0.5, 0.6), net = mat(0x9aa0a6, 0.6, 0.3); net.transparent = true; net.opacity = 0.35; net.depthWrite = false;   // оградата — мрежа (полупрозрачна); входът — откъм +x (отворена половина)
    for (const [fx, fz, fw, fd] of [[0, -D / 2, W, 0.08], [0, D / 2, W, 0.08], [-W / 2, 0, 0.08, D], [W / 2, -D / 4 - 2, 0.08, D / 2 - 4]]) box(fw, 2, fd, net, fx, 1.1, fz, dep);
    for (let k = 0; k <= 8; k++) for (const fz of [-D / 2, D / 2]) box(0.12, 2.2, 0.12, fen, -W / 2 + k * W / 8, 1.1, fz, dep);
    for (const u of [-W / 2 + 6, W / 2 - 6]) { const [mx, mz] = at(u, 0); PL.mast(g, mx, mz, { h: 18, r: 24 }); }
  }
  let cargo = useModel(A, model, 'ship-cargo-a', 6);
  // 🏗️ crane-swan (T2): два „лебедови“ портални крана (модел на T3, ind/crane-swan.glb: Body + Slew) в двата края на кея, откъм морето;
  // горната част (Slew) бавно се върти, червена светлина на върха мига нощем (portlights)
  const swans = [];
  if (feature('crane-swan')) new GLTFLoader().loadAsync('assets/heavy/ind/crane-swan.glb').then(gl => {
    for (const [dx, ph] of [[-47, 0], [47, 2.1]]) { const o = gl.scene.clone(true); o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      o.position.set(px + dx, 1.2, pSeaZ - 60); o.rotation.y = Math.PI; pg.add(o); const sl = o.getObjectByName('Slew'); const b = new THREE.Box3().setFromObject(o); if (sl) { const sb = new THREE.Box3().setFromObject(sl); PL.beaconAt(sl, 0, (sb.max.y - sb.min.y) * 0.55, 0); } else PL.beaconAt(o, 0, (b.max.y - o.position.y) * 0.8, 0);   /* светлината — върху въртящата се част (кабината), не над стрелата */
      if (sl) swans.push({ sl, r0: sl.rotation.y, ph }); } }).catch(e => console.warn('crane-swan', e));
  if (cargo) { cargo.position.set(px, 0, pierZ - 18); cargo.rotation.y = Math.PI / 2; pg.add(cargo); }
  // фар на вълнолома (западната част)
  const lx = opts.xMin + 30, lSeaZ = CO ? CO(lx) : seaZ, lz = lSeaZ - 90;   // вълноломът с фара — от брега
  box(8, 1.2, 90, mat(0x8f8a80, 1), lx, 0.2, lSeaZ - 45, g);
  const tower = new THREE.Group();
  for (let k = 0; k < 6; k++) { const sgm = new THREE.Mesh(new THREE.CylinderGeometry(2.2 - k * 0.15, 2.3 - k * 0.15, 3, 16), mat(k % 2 ? 0xd62828 : 0xffffff, 0.6)); sgm.position.y = 1.5 + k * 3; tower.add(sgm); }
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2, 12), new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd060, emissiveIntensity: 1.5 })); lamp.position.y = 19.5; tower.add(lamp);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(4, 60, 16, 1, true).rotateZ(Math.PI / 2).translate(30, 0, 0), new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 19.5; tower.add(beam);
  tower.position.set(lx, 0.8, lz); g.add(tower);
  // кораби на котва и лодки
  const ships = [];
  const linerRot = r() * 6;   // на котва: круизният кораб е истинският (shipmodels.js) — слага се, щом се зареди
  for (const [n, s, x, z] of [['ship-cargo-b', 6, 60, -320], ['ship-small', 2.4, 160, -200]]) {
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
  const sign = deps.label('⚓ ПРИСТАНИЩЕ', '#ffffff', 12); sign.position.set(px, 32, pierZ + 8); pg.add(sign);

  // ---- твоите кораби (Фаза „Пристанища“): на кей до старото пристанище, а един влиза/излиза от морето
  // list = [{ kind: 'container'|'bulk'|'tanker'|'cruise', state: 'docked'|'arriving'|'leaving' }]
  const SHIP = { container: ['ship-cargo-a', 6], bulk: ['ship-cargo-b', 6], tanker: ['ship-cargo-a', 6, 0x7a1f1f], cruise: ['ship-cargo-b', 6] /* докато истинският круизен не е зареден */, coaster: ['ship-small', 3], boat: ['boat-fishing-small', 2.6, null, 'boat-speed-a'] };
  const fleetG = new THREE.Group(); pg.add(fleetG);
  const berthZ = pSeaZ - 69 - 9;
  let movers = [], portLv = 0, lastFleet = [], msc = null;   // msc — MSC Irina на кея до крановете (ship-msc, ниво 5)
  // кейове: 2 пред стария кей, още 2 пред разширението (ниво 4+); останалите кораби чакат на котва
  // [x, ръбът на кея по z]; морето е към −z
  const berthsAt = () => [[px - 27, pSeaZ - 69], [px + 27, pSeaZ - 69], ...(portLv >= 4 && !(portLv >= 5 && msc) ? [[px - 108, pSeaZ - 55], [px - 72, pSeaZ - 55]] : [])];   // ship-msc: на ниво 5 кеят на разширението е на MSC Irina
  // половината ширина на кораба (по z, след завъртането) — за да стои до кея, а не в него
  const halfBeam = o => { o.position.set(0, 0, 0); o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o); return (b.max.z - b.min.z) / 2; };
  function makeShip(kind) {
    if (hasShipModel(kind)) return shipModel(kind);   // истинските кораби (shipmodels.js)
    if (kind === 'bulk' && hasShipModel('tanker')) return shipModel('tanker');   // насипният — същият голям корпус
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
      if (i < B.length) { o.rotation.y = Math.PI / 2; const hb = halfBeam(o); o.position.set(B[i][0], 0, B[i][1] - hb - (small ? 1 : 2)); }
      else { o.position.set(px - 140 + (i - B.length) * 60, 0, pSeaZ - 230 - (i % 2) * 50); o.rotation.y = 0.3 + i; }   // на котва, чакат кей
      fleetG.add(o); ships.push({ o, ph: i * 1.7, fleet: true });
    });
    if (cargo) cargo.visible = !docked.length;   // декоративният кораб отстъпва кея на твоите
    moving.slice(0, 2).forEach((f, i) => {
      const big = f.kind === 'container' && hasShipModel('msc'), o = big ? shipModel('msc') : makeShip(f.kind); fleetG.add(o);   // ship-msc: контейнеровозът, който влиза/излиза — MSC Irina
      movers.push({ o, arriving: f.state === 'arriving', x: px + 70 + i * 40 + (big ? 30 : 0), ph: i * 0.5, msc: big });
    });
  }
  // ниво на пристанището 0–5: всяко ниво добавя кранове, контейнери и складове около стария кей
  const lvG = [1, 2, 3, 4, 5].map(() => { const q = new THREE.Group(); q.visible = false; pg.add(q); return q; });
  // 📦 port-real (потребителят: „да разделим контейнерите от сградите … само за контейнерите“): контейнерният двор — на нова платформа на изток от кея, долепена до него
  // (ниво 2: 60 × 52 м; ниво 5: още 44 м), бетонен ръб, кнехти и кранци към водата; складовете остават на стария кей без контейнери. yard — и за portreal.js (RTG, страдъл карите)
  const YD = feature('port-real'), yard = YD ? { x0: px + 55, wA: 60, wB: 44, z0: pSeaZ - 58, z1: pSeaZ - 6 } : null;
  if (yard) {
    const conc = mat(0xb8b4aa, 0.9), kerb = mat(0x8f8a80, 0.9), rub = mat(0x1a1a1a, 0.9), bol = mat(0x2b2b2b, 0.6, 0.4), D = yard.z1 - yard.z0, zc = (yard.z0 + yard.z1) / 2;
    const plat = (q0, x0, w, east) => { const q = new THREE.Group(); q0.add(q);   /* в своя група — portreal.js взима цилиндрите направо в lvG[4] за силози */
      box(w, 1.4, D, conc, x0 + w / 2, 0.5, zc, q); box(w, 0.5, 0.8, kerb, x0 + w / 2, 1.45, yard.z0 + 0.4, q);
      for (let x = x0 + 5; x < x0 + w - 2; x += 10) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.7, 10), bol); b.position.set(x, 1.55, yard.z0 + 1); q.add(b); box(1.6, 1.3, 0.5, rub, x, 0.55, yard.z0 - 0.25, q); }
      if (east) { box(0.8, 0.5, D, kerb, x0 + w - 0.4, 1.45, zc, q); for (let z = yard.z0 + 6; z < yard.z1 - 2; z += 10) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.7, 10), bol); b.position.set(x0 + w - 1, 1.55, z); q.add(b); box(0.5, 1.3, 1.6, rub, x0 + w + 0.25, 0.55, z, q); } }
    };
    plat(lvG[1], yard.x0, yard.wA, true); plat(lvG[4], yard.x0 + yard.wA, yard.wB, true);
    PL.mast(lvG[1], yard.x0 + yard.wA / 2, yard.z0 + 3, { h: 20, r: 26 }); PL.mast(lvG[4], yard.x0 + yard.wA + yard.wB / 2, yard.z0 + 3, { h: 20, r: 26 });
    // блок контейнери: 2 блока × 2 реда × bays по x, на етажи; между блоковете — платно за страдъл карите
    yard.at = (k, X0, bays) => { const per = bays * 4, tier = Math.floor(k / per), r = k % per, blk = Math.floor(r / (bays * 2)), row = Math.floor((r % (bays * 2)) / bays), bay = r % bays; return [X0 + 6 + bay * 9.4 + 4.7, tier, yard.z1 - 9 - blk * 16 - row * 4.8]; };
    yard.gx = yard.x0 + yard.wA + yard.wB / 2; yard.gz = yard.z1 - 11.4; yard.sx = yard.x0 + yard.wA / 2; yard.sz = [yard.z1 - 19.5, yard.z0 + 8];
  }
  { const blue = mat(0x1f5fbf, 0.6), red = mat(0xd62828, 0.6), shed = mat(0xb8bec6, 0.5, 0.4);
    const crane = (q, x, m) => { const c = new THREE.Group(); for (const [sx, sz] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) box(0.8, 22, 0.8, m, sx, 12, sz, c); box(10, 1.6, 8, m, 0, 23, 0, c); box(1.2, 1.2, 46, m, 0, 24.5, -14, c); PL.beaconAt(c, 0, 24.4, 0); PL.beaconAt(c, 0, 25.6, -36.5, 0.5); c.position.set(x, 1.2, pierZ + 8); q.add(c); cranes.push(c); };
    crane(lvG[0], px + 44, blue);
    for (let k = 0; k < 20; k++) {   // третият ред контейнери (истинските — boatsreal.js), иначе цветни кутии
      const o = useModel(A, model, ['cargo-container-a', 'cargo-container-b', 'cargo-container-c'][k % 3], 3.2);
      const [yx, yt, yz] = yard ? yard.at(k, yard.x0, 5) : [px - 40 + (k % 10) * 8, 2, pSeaZ - 10 - Math.floor(k / 10) * 10];   // port-real: на платформата (иначе — третият етаж над стария двор)
      if (o) { o.position.set(yx, 1.2 + yt * 3.5, yz); o.rotation.y = Math.PI / 2; lvG[1].add(o); inst.push({ o, key: ['cargo-container-a', 'cargo-container-b', 'cargo-container-c'][k % 3] }); }
      else box(4.4, 3.5, 8.8, mat([0xd62828, 0x1f5fbf, 0x2d8f4e, 0xffb300][k % 4], 0.7), yx, 1.2 + 1.75 + yt * 3.5, yz, lvG[1]).rotation.y = Math.PI / 2;
    }
    for (let k = 0; k < 2; k++) { box(26, 9, 14, shed, px - 30 + k * 32, 5.7, pSeaZ - 2 + (CO ? -12 : 12), lvG[2]); box(26.6, 0.8, 14.6, mat(0x8a3b2b, 0.7), px - 30 + k * 32, 10.5, pSeaZ + (CO ? -14 : 10), lvG[2]); }
    box(70, 1.4, 50, mat(0xb8b4aa, 0.9), px - 90, 0.5, pSeaZ - 30, lvG[3]); PL.mast(lvG[3], px - 118, pSeaZ - 8, { h: 18, r: 24 }); PL.mast(lvG[3], px - 62, pSeaZ - 52, { h: 18, r: 24 }); crane(lvG[3], px - 100, red); crane(lvG[3], px - 76, red);
    for (let k = 0; k < 24; k++) {   // контейнерите на разширението (истинските — boatsreal.js), иначе цветни кутии
      const o = useModel(A, model, ['cargo-container-a', 'cargo-container-b', 'cargo-container-c'][k % 3], 3.2);
      const [yx, yt, yz] = yard ? yard.at(k, yard.x0 + yard.wA, 3) : [px - 115 + (k % 8) * 7, Math.floor(k / 16), pSeaZ - 14 - Math.floor((k % 16) / 8) * 11];   // port-real: на втората част на платформата, под RTG
      if (o) { o.position.set(yx, 1.25 + yt * 3.5, yz); o.rotation.y = Math.PI / 2; lvG[4].add(o); inst.push({ o, key: ['cargo-container-a', 'cargo-container-b', 'cargo-container-c'][k % 3] }); }
      else box(4.4, 3.5, 8.8, mat([0x7b2cbf, 0x0a9396, 0xe8e2d4, 0xd62828][k % 4], 0.7), yx, 3 + yt * 3.5, yz, lvG[4]).rotation.y = Math.PI / 2;
    }
    const silo = mat(0xdcdcdc, 0.5, 0.3); for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 18, 16), silo); c.position.set(px - 70 + k * 9, 9, pSeaZ + (CO ? -10 : 14)); c.castShadow = true; lvG[4].add(c); } }
  if (INST) instancify(inst);
  // истинските кранове, фар, склад, зърнен терминал, страдъл карите и яхтите (portreal.js)
  const portUp = feature('port-real') ? portReal({ g: pg, yg: g, ySeaZ: seaZ, lvG, cranes, tower, lamp, beam, px, seaZ: pSeaZ, pierZ, x0: opts.xMin - 150, x1: opts.xMax + 150, yard }) : null;
  // щом истинските кораби се заредят: пречертай флота и смени декоративния кораб на кея с танкер (до ръба на кея)
  loadShipModels().then(() => {
    if (cargo && hasShipModel('tanker')) { const o = shipModel('tanker'), p0 = cargo.position.clone(), hb0 = halfBeam(cargo); cargo.position.copy(p0); o.rotation.y = cargo.rotation.y; const hb = halfBeam(o); o.position.set(p0.x, 0, pSeaZ - 69 - hb - 2); o.visible = cargo.visible; const cp = cargo.parent || g; cp.remove(cargo); cp.add(o); cargo = o; }
    swapPendingShips(g, ships);
    if (hasShipModel('cruise')) { const o = shipModel('cruise'); o.position.set((opts.xMin + opts.xMax) / 2 - 120, 0, seaZ - 260); o.rotation.y = linerRot; g.add(o); ships.push({ o, ph: r() * 6 }); }   // на котва
    if (hasShipModel('msc')) { const o = shipModel('msc'); o.rotation.y = Math.PI / 2; const hb = halfBeam(o); o.rotation.y = Math.PI / 2; o.position.set(px - 110, 0, pSeaZ - 55 - hb - 2); lvG[4].add(o); ships.push({ o, ph: r() * 6 }); msc = o; }   // ship-msc: на ниво 5 — на кея до червените кранове
    setFleet(lastFleet);
  });
  function setPortLevel(lv = 0) { const was = portLv; portLv = lv; lvG.forEach((q, i) => { q.visible = lv >= i + 1; }); if ((was >= 4) !== (lv >= 4) || (msc && (was >= 5) !== (lv >= 5))) setFleet(lastFleet); }

  // t: секунди; night: 0…1 (фарът свети и се върти)
  function update(t, night = 0) {
    for (const w of swans) w.sl.rotation.y = w.r0 + Math.sin(t * 0.12 + w.ph) * 1.1;   // crane-swan: стрелата бавно се върти над кея
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
    if (SEA2) {   // sea2: люлеене по вълните (и надлъжно) + пенлива следа зад движещите се лодки
      for (const s of ships) s.o.rotation.x = Math.sin(t * 0.47 + s.ph * 1.3) * 0.012;
      for (const q of boats) {
        const v = Math.cos(t * 0.04 * q.sp + q.ph), dir = v > 0 ? 1 : -1;
        q.o.rotation.z = Math.sin(t * 1.1 + q.ph) * 0.05; q.o.rotation.x = Math.sin(t * 0.9 + q.ph * 2) * 0.035;
        if (!q.wake) { q.wake = new THREE.Mesh(WAKE_GEO, new THREE.MeshBasicMaterial({ map: wakeTex(), transparent: true, depthWrite: false, opacity: 0 })); q.wake.renderOrder = 2; g.add(q.wake); }
        q.wake.position.set(q.o.position.x - dir * 13, 0.14, q.o.position.z); q.wake.rotation.y = -dir * Math.PI / 2; q.wake.material.opacity = Math.min(1, Math.abs(v) * 1.4) * 0.75;
      }
    }
    cranes.forEach((c, k) => { c.position.x += Math.sin(t * 0.2 + k) * 0.01; });
    if (msc) mscTick(msc, t, false); for (const mv of movers) if (mv.msc) mscTick(mv.o, t, true);   // ship-msc: радарът, пяната зад кърмата
    PL.setNight(night, t); water.update(t); setShipNight(night);
    if (portUp) portUp(t, night);
    beam.rotation.y = t * 0.8; beam.material.opacity = 0.04 + 0.16 * night; lamp.material.emissiveIntensity = 0.5 + 2 * night;
  }
  const api = { group: g, update, setFleet, setPortLevel, port: { x: px, z: pSeaZ, xMax: opts.xMax } };
  g.name = 'seaside'; g.userData.sea = api;   // за тестовете
  return api;
}
