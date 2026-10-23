// citybus.js — градски автобус със спирки (Лабораторията → city-bus, #15): 1–2 линии по булевардите/главните улици, 4–8 спирки
// (навес и табела на тротоара), автобусите карат в трафика като агенти (junction-paths) и стоят ~12 s на всяка спирка.
// Само градовете с плана v2 и трафика по лентите (game.js → jpAgents()).
// createCityBus(deps) → { update(dt), clear(), lines(), stops() }
//   deps.agents() → null | jpAgents (route/add/retarget/remove/alive/free/group); deps.lanes() — лентите на трафика;
//   deps.center() → { x, z } (координатите на плана); deps.R() — радиусът на града; deps.bus() → THREE.Object3D | null (моделът);
//   deps.want() → { lines, perLine } — колко линии и автобуса (растат с града)
import * as THREE from 'three';
import { pointOn } from './junctionpaths.js';

const DWELL = 12, MAIN = /^(blvd|avenue|ring)$/;
const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });

// навес: покрив, задно стъкло, стълбчета, табела с „BUS“; предната страна (+z) — към платното
let SIGN = null;
function shelter() {
  const g = new THREE.Group(), roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 1.7), mat(0x3a4a5a)); roof.position.set(0, 2.55, 0); g.add(roof);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.3, 0.05), new THREE.MeshStandardMaterial({ color: 0xbfe0f0, transparent: true, opacity: 0.35, roughness: 0.1 })); glass.position.set(0, 1.3, -0.8); g.add(glass);
  for (const x of [-1.7, 1.7]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.5, 0.08), mat(0x2b2f36)); p.position.set(x, 1.25, -0.78); g.add(p); }
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.45), mat(0x7a5a3a)); bench.position.set(0, 0.48, -0.5); g.add(bench);
  if (!SIGN) { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); x.fillStyle = '#1d5fbf'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#fff'; x.font = 'bold 26px sans-serif'; x.textAlign = 'center'; x.fillText('BUS', 32, 42); SIGN = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }); }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 6), mat(0x8a8f96)); pole.position.set(2.3, 1.5, 0.3); g.add(pole);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.04), [mat(0x8a8f96), mat(0x8a8f96), mat(0x8a8f96), mat(0x8a8f96), SIGN, SIGN]); sign.position.set(2.3, 2.75, 0.3); sign.rotation.y = Math.PI / 2; g.add(sign);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function createCityBus(deps) {
  let A = null, L = [], G = null, DBG = {};   // L — линиите: { stops: [{ p, s, x, z }], buses: [{ c, obj, i, st, t }] }
  // спирките: най-дясната лента на главна улица, дълга ≥ 70 м; по една в сектор около центъра, на радиус около r0
  // спирките: по една в сектор около центъра, на радиус около r0 (главна улица или широка улица, най-дясната лента)
  function pickStops(cands, n, r0, used) {
    const C = deps.center(), out = [];
    for (let k = 0; k < n; k++) {
      const a0 = k / n * Math.PI * 2 - Math.PI, a1 = (k + 1) / n * Math.PI * 2 - Math.PI; let best = null, bd = 1e9;
      for (const q of cands) { if (used.has(q.p)) continue; const a = Math.atan2(q.z - C.z, q.x - C.x); if (a < a0 || a >= a1) continue; const d = Math.abs(Math.hypot(q.x - C.x, q.z - C.z) - r0) + (MAIN.test(q.p.edge.cls) ? 0 : 60); if (d < bd) { bd = d; best = q; } }
      if (best) { out.push(best); used.add(best.p); for (const sib of best.p.sibs || []) used.add(sib); }
    }
    return out;
  }
  function build() {
    clear(); A = deps.agents(); if (!A) return false; G = new THREE.Group(); G.name = 'cityBus'; A.group.add(G);
    const cands = deps.lanes().filter(l => l.kind === 'lane' && l.ring == null && !l.enter && !l.leave && l.len >= 60 && l.edge && (MAIN.test(l.edge.cls) || (l.edge.w || 0) >= 6) && l.laneI === (l.nLanes || 1) - 1)   /* и улиците с една лента (оттам завива на всички страни) */
      .map((p, i) => { const s = p.len / 2, q = pointOn(p, s); return { i, p, s, x: q.x, z: q.z }; });
    const W = deps.want(), R = deps.R(), used = new Set(); DBG = { cands: cands.length, R, lanes: deps.lanes().length, W };
    for (let li = 0; li < W.lines; li++) {
      const stops = pickStops(cands, 6, R * (li ? 0.62 : 0.32), used);
      if (stops.length < 4) continue;
      for (const st of stops) {   // навесът — на тротоара откъм лентата: от оста на улицата навън, на ръба ѝ + половин тротоар; с лице към платното
        const rd = st.p.edge, P = rd.pts || []; let cx = st.x, cz = st.z, bd = 1e9;
        for (let k = 1; k < P.length; k++) { const a = P[k - 1], b = P[k], dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((st.x - a[0]) * dx + (st.z - a[1]) * dz) / (dx * dx + dz * dz || 1))), x = a[0] + dx * t, z = a[1] + dz * t, d = Math.hypot(x - st.x, z - st.z); if (d < bd) { bd = d; cx = x; cz = z; } }
        let nx = st.x - cx, nz = st.z - cz, nl = Math.hypot(nx, nz); if (nl < 0.1) { const a = pointOn(st.p, st.s - 2), b = pointOn(st.p, st.s + 2); nx = -(b.z - a.z); nz = b.x - a.x; nl = Math.hypot(nx, nz) || 1; } nx /= nl; nz /= nl;
        const off = (rd.w || 7) / 2 + (rd.walk || 2.5) * 0.55, sh = shelter(); sh.position.set(cx + nx * off, 0.12, cz + nz * off); sh.rotation.y = Math.atan2(-nx, -nz); G.add(sh); st.sh = sh;
      }
      L.push({ stops, buses: [] });
    }
    return L.length > 0;
  }
  function spawn(line) {
    const n = line.buses.length, i = (n * Math.max(1, Math.floor(line.stops.length / Math.max(1, deps.want().perLine)))) % line.stops.length, st = line.stops[i];
    if (!A.free(st.p, st.s, 14)) return;   // мястото на спирката е заето — следващия кадър
    const obj = deps.bus(); if (!obj) return; A.group.add(obj);
    const b = new THREE.Box3().setFromObject(obj), len = Math.max(8, b.max.z - b.min.z), w = Math.max(2.3, b.max.x - b.min.x);
    const bus = { obj, i, st: 'dwell', t: DWELL * Math.random() };
    bus.c = A.add({ obj, len, w, h: 3.2, kind: 'bus', name: 'Автобус', route: { paths: [st.p], s0: st.s, s1: st.s, len: 0 }, onArrive: () => { if (bus.st === 'go') { bus.st = 'dwell'; bus.t = DWELL; } } });
    line.buses.push(bus);
  }
  function update(dt) {
    const a = deps.agents(); if (!a) { if (A) clear(); return; }
    if (a !== A || !L.length) { if (!build()) return; }
    const W = deps.want();
    for (const line of L) {
      if (line.buses.length < W.perLine) spawn(line);
      for (const bus of line.buses) {
        if (!A.alive(bus.c)) { line.buses.splice(line.buses.indexOf(bus), 1); break; }   // трафикът е сменен — пак отначало
        if (bus.st !== 'dwell' || (bus.t -= dt) > 0) continue;
        // следващата спирка, до която има път (трафикът е без смяна на лента — недостижимите се прескачат); дълго без път — изчезва и пак се появява на спирка
        const c = bus.c, n = line.stops.length; let ok = false;
        for (let k = 1; k <= n && !ok; k++) { const nx = (bus.i + k) % n, to = line.stops[nx], r = A.route({ p: c.p, s: c.s }, { p: to.p, s: to.s }, true, { anyFrom: true }); if (r && r.len > 20 && (r.paths[0] === c.p || A.laneTo(c, r.paths[0])) && A.retarget(c, r))   /* от която и да е успоредна лента — първо смяна на лентата */ { bus.i = nx; bus.st = 'go'; bus.err = ''; bus.fail = 0; ok = true; } }
        if (!ok) { bus.t = 3; bus.err = 'няма път'; if ((bus.fail = (bus.fail || 0) + 1) > 8) { A.remove(c); if (bus.obj.parent) bus.obj.parent.remove(bus.obj); line.buses.splice(line.buses.indexOf(bus), 1); break; } }   // няма път сега — след малко
      }
    }
  }
  function clear() {
    for (const line of L) for (const bus of line.buses) if (A && A.alive(bus.c)) A.remove(bus.c);
    if (G && G.parent) G.parent.remove(G); G = null; L = []; A = null;
  }
  return { update, clear, lines: () => L.map(l => ({ stops: l.stops.length, buses: l.buses.map(b => ({ t: +(b.t || 0).toFixed(1), err: b.err, pk: b.c?.p?.kind, i: b.i, st: b.st, v: +(b.c?.v || 0).toFixed(1), why: b.c?.why || '' })) })), debug: () => DBG, stops: () => L.flatMap(l => l.stops.map(s => ({ x: s.x, z: s.z }))) };
}
