// trucks.js — ТИР-ове, които докарват материалите до склада: по един за всяка поръчка, с ремарке според товара
// (самосвал за пясък/чакъл, бетоновоз, платформа за тухли/стомана/дърво, стойка за стъкло).
// game.js подава зависимостите (сцена, модели, път по улиците), за да няма кръгови импорти.
import * as THREE from 'three';
import { feature } from './lab/feature.js';
import { addTruckLamps } from './vehmodels.js';
import { trimRoute } from './junctionpaths.js';

const SPEED = 12, UNLOAD = 2.2, LANE = 1.9;
// в големите градове (плановете по истинска карта, ~1,3 км) пътят от входа до обекта беше 4–5 игрови дни на етап → къщите закъсняваха.
// Сега ТИР-ът се появява най-много MAX_RUN м преди целта (по същия път) и кара толкова бързо, че да стигне за ≤ MAX_T секунди (~0,75 ден)
const MAX_RUN = 450, MAX_T = 18;
const COL = { sand: 0xd9c08a, gravel: 0x9a9a9a, concrete: 0xb8b8b0, bricks: 0xb5523b, steel: 0x6d7a88, wood: 0xa8743f, glass: 0x9fd8ff, furniture: 0x7a5236, marble: 0xf1efe8 };
const KIND = { sand: 'tipper', gravel: 'tipper', concrete: 'mixer', bricks: 'flat', steel: 'flat', wood: 'flat', glass: 'glass', furniture: 'box', marble: 'flat' };
const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 });

// ремарке по вида на товара; връща групата и частта, която се движи при разтоварване
const TRL_REAL = 10.5;
function trailer(matId) {
  const g = new THREE.Group(), kind = KIND[matId] || 'flat', col = COL[matId] ?? 0xcccccc, load = [];
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.35, 8.2), mat(0x2b2f36));
  chassis.position.y = 0.95; g.add(chassis);
  for (const z of [-2.6, -1.4, 2.6]) for (const x of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.35, 12).rotateZ(Math.PI / 2), mat(0x15171a));
    w.position.set(x, 0.48, z); g.add(w);
  }
  let mover = null;
  if (kind === 'tipper') {
    const bed = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.3, 7.6), mat(0xd08a1e));
    box.position.y = 0.65; bed.add(box);
    const heap = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.9, 10).scale(1, 1, 3), mat(col));
    heap.position.y = 1.55; bed.add(heap); load.push(heap);
    bed.position.set(0, 1.12, 0);
    g.add(bed); mover = { obj: bed, kind };
  } else if (kind === 'mixer') {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.75, 6.4, 14).rotateX(Math.PI / 2), mat(0xe8e8e2));
    drum.position.y = 2.3; g.add(drum);
    for (let k = 0; k < 4; k++) {   // ивици по барабана, за да личи въртенето
      const a = k * Math.PI / 2, st = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 6.0), mat(0xff7a00));
      st.position.set(Math.cos(a) * 0.92, Math.sin(a) * 0.92, 0); drum.add(st);
    }
    mover = { obj: drum, kind };
  } else if (kind === 'glass') {
    for (const s of [-1, 1]) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 7), mat(0x55606b));
      frame.position.set(s * 0.25, 2.3, 0); frame.rotation.z = s * 0.12; g.add(frame);
      for (let k = 0; k < 3; k++) {
        const pane = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.1, 6.6), new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.55, metalness: 0.3, roughness: 0.1 }));
        pane.position.set(s * (0.4 + k * 0.12), 2.3, 0); pane.rotation.z = s * 0.12; g.add(pane); load.push(pane);
      }
    }
  } else if (kind === 'box') {   // закрито ремарке (мебели)
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 7.8), mat(0xe8e4dc));
    box.position.y = 2.45; g.add(box); load.push(box);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.5, 7.82), mat(col)); stripe.position.y = 2.2; g.add(stripe); load.push(stripe);
  } else {   // платформа с палети / профили / дъски
    for (let k = 0; k < 4; k++) {
      const geo = matId === 'steel' ? new THREE.BoxGeometry(1.9, 0.45, 1.7) : matId === 'wood' ? new THREE.BoxGeometry(2, 0.75, 1.7) : matId === 'marble' ? new THREE.BoxGeometry(2, 0.35, 1.7) : new THREE.BoxGeometry(1.7, 1.0, 1.6);
      const b = new THREE.Mesh(geo, mat(col));
      b.position.set(0, 1.12 + geo.parameters.height / 2, -2.9 + k * 1.9); g.add(b); load.push(b);
    }
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return { g, mover, load };
}

// влекач: кабина над предната ос, решетка, фарове, ауспуси; цветът е по поръчката
const CAB_COLS = [0xd62828, 0xf2f2ee, 0x1f5fbf, 0xf2a900, 0x2d8f4e];
function tractorUnit(color) {
  const g = new THREE.Group();
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.45, 4.2), mat(0x2b2f36));
  chassis.position.set(0, 0.95, 0); g.add(chassis);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.3, 2.1), mat(color));
  cab.position.set(0, 2.3, 1.05); g.add(cab);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 1.7), mat(color));
  roof.position.set(0, 3.75, 0.85); roof.rotation.x = -0.15; g.add(roof);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.95), new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.5, roughness: 0.15 }));
  glass.position.set(0, 2.85, 2.11); g.add(glass);
  const grill = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), mat(0x999da3));
  grill.position.set(0, 1.75, 2.11); g.add(grill);
  for (const x of [-0.95, 0.95]) {
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.22), new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffeeaa, emissiveIntensity: 0.6 }));
    lamp.position.set(x, 1.45, 2.12); g.add(lamp);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 8), mat(0xb8bcc2));
    pipe.position.set(x * 1.35, 3.0, -0.15); g.add(pipe);
  }
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.35, 0.3), mat(0x3a3f46));
  bumper.position.set(0, 1.0, 2.2); g.add(bumper);
  for (const z of [1.3, -1.2]) for (const x of [-1.05, 1.05]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.4, 12).rotateZ(Math.PI / 2), mat(0x15171a));
    w.position.set(x, 0.52, z); g.add(w);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return g;
}

// deps: { scene, label(text, color, width), roadPath(x0, z0, x1, z1) → [{x, z}], entry() → {x, z}, matInfo(id) → {ico, nm, unit},
//   agents() → null | { group, route(from, to, heavy), add(spec), retarget(c, r), remove(c), alive(c) } — junction-paths: ТИР-ът е агент в трафика
//   (по лентите, през кръстовищата и кръговите по кривите, влекачът и ремаркето на шарнира); иначе — старото движение по точките }
export function createTirs(deps) {
  const list = [];
  // диагностика на доставките: колко метра/секунди е карал всеки ТИР (window.__tirLog; window.__tirDebug = true — и в конзолата)
  const log = []; if (typeof window !== 'undefined') window.__tirs = list;
  function logDel(t, how) {
    const e = { id: t.order.id, mat: t.order.matId, qty: t.order.qty, m: Math.round(t.len || 0), s: +(t.age || 0).toFixed(1), how };
    log.push(e); if (log.length > 60) log.shift(); if (typeof window !== 'undefined') { window.__tirLog = log; if (window.__tirDebug) console.info('[ТИР]', e); }
  }
  function build(order, art) {   // art — влекачът и ремаркето поотделно (агент в трафика: ремаркето следва шарнира)
    const root = new THREE.Group();
    let cab = null;
    const CL = feature('real-scale') ? 6 : 4.6;   /* real-scale (55): истинската кабина на влекача — 6 м */
    if (feature('trucks-real') && deps.model) try { const m = deps.model('sf-trk-' + (order.id % 2), CL); cab = new THREE.Group(); cab.add(m); addTruckLamps(cab, CL, 2.5, 1.1); } catch (e) { cab = null; }   // модерният влекач (trucks-real); фаровете — на немащабираната група
    if (!cab) cab = tractorUnit(CAB_COLS[order.id % CAB_COLS.length]);
    cab.position.z = art ? 0 : 3.6 + (CL - 4.6) / 2;   // влекачът отпред (+z е посоката на движение)
    root.add(cab);
    const tr = trailer(order.matId);
    if (feature('real-scale')) tr.g.scale.z = TRL_REAL / 8.2;   /* real-scale: градско ремарке 10,5 м */
    tr.g.position.z = art ? 0 : -1.6 - (tr.g.scale.z * 8.2 - 8.2) / 2;
    if (!art) root.add(tr.g);
    const mi = deps.matInfo(order.matId);
    const tag = deps.label(`🚚 ${mi.ico} ${mi.nm} · ${order.qty} ${mi.unit}`, '#ffffff', 7);
    tag.position.y = 5.2; root.add(tag);
    if (art) { art.add(root); art.add(tr.g); } else deps.scene.add(root);
    return { root, trl: art ? tr.g : null, mover: tr.mover, load: tr.load, tag };
  }
  const AG_MAX = 220;   // агентът: влекач, ремарке (м); появява се най-много толкова преди целта
  const CAB_L = () => feature('real-scale') ? 6 : 4.6, TRL_L = () => (feature('real-scale') ? TRL_REAL : 8.2) + 0.4;   // агентът: влекач, ремарке (м)
  function agentStart(t, A) {
    const r = trimRoute(A.route(deps.entry(), t.target, true), AG_MAX); if (!r) return false;
    if (A.free && !A.free(r.paths[0], r.s0, CAB_L() + TRL_L() + 0.4)) { t.t = -1.5; t.wq = t.wq || 0; return true; }   /* мястото на тръгване е заето — след малко */
    t.agent = A.add({ obj: t.root, len: CAB_L() + TRL_L() + 0.4, w: 2.5, h: 3.8, kind: 'truck', name: 'ТИР ' + t.order.id, route: r, cab: CAB_L(), trailer: { obj: t.trl, len: TRL_L() },
      onArrive: () => { if (t.state === 'go') { t.state = 'unload'; t.u = 0; } else if (t.state === 'back') t.done = true; } });
    t.A = A; t.len = r.len; t.age = 0; t.lim = 12 + r.len / 8; t.root.visible = t.trl.visible = true; return true;   /* t.lim — след толкова секунди без пристигане доставката минава направо (без безкрайно обикаляне) */
  }
  // order: { id, matId, qty }; target: { x, z } — дворът на склада; onArrive(order) се вика при разтоварване.
  // ТИР-ът спира на улицата пред склада (най-близката плочка път), разтоварва и се връща празен откъдето е дошъл.
  function send(order, target, onArrive, delay = 0) {
    const A = deps.agents && deps.agents();
    if (A) { const t = { order, target, onArrive, ...build(order, A.group), state: 'go', t: -delay, x: 0, z: 0 }; t.root.visible = t.trl.visible = false; list.push(t); if (delay <= 0 && !agentStart(t, A)) { logDel(t, 'без път'); onArrive && onArrive(order); dropT(t); return null; } return t; }   /* без маршрут — доставено без пътя (като преди) */
    const e = deps.entry();
    let path = deps.roadPath(e.x, e.z, target.x, target.z), x = e.x, z = e.z;
    { let rem = 0; for (let i = path.length - 1; i > 0; i--) { rem += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z); if (rem > MAX_RUN) { x = path[i - 1].x; z = path[i - 1].z; path = path.slice(i); break; } } }
    let len = Math.hypot(path[0]?.x - x || 0, path[0]?.z - z || 0); for (let i = 1; i < path.length; i++) len += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
    const t = { order, target, onArrive, ...build(order), x, z, yaw: 0, path, pi: 0, state: 'go', t: -delay, v: Math.max(SPEED, len / MAX_T), len, age: 0 };
    t.root.position.set(t.x, 0, t.z);
    t.root.visible = delay <= 0;
    list.push(t);
    return t;
  }
  function follow(t, dt) {
    const wp = t.path[t.pi];
    let tx = wp.x, tz = wp.z;
    if (!wp.last && t.pi > 0) {   // дясно движение
      const pv = t.path[t.pi - 1], dx = wp.x - pv.x, dz = wp.z - pv.z, l = Math.hypot(dx, dz) || 1;
      tx += -dz / l * LANE; tz += dx / l * LANE;
    }
    const dx = tx - t.x, dz = tz - t.z, d = Math.hypot(dx, dz), step = (t.v || SPEED) * dt;
    if (d <= step) { t.x = tx; t.z = tz; t.pi++; if (d > 0.05) t.yaw = Math.atan2(dx, dz); }   // при бързо време прескача точките — иначе остава обърнат накриво
    else {
      t.x += dx / d * step; t.z += dz / d * step;
      let dy = Math.atan2(dx, dz) - t.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      t.yaw += dy * Math.min(1, dt * 6);
    }
    t.root.position.set(t.x, 0, t.z);
    t.root.rotation.y = t.yaw;
    return t.pi >= t.path.length;
  }
  const dropT = t => { if (t.agent && t.A) t.A.remove(t.agent); t.agent = null; for (const o of [t.root, t.trl]) if (o && o.parent) o.parent.remove(o); const k = list.indexOf(t); if (k >= 0) list.splice(k, 1); };
  // агентът: движението е на трафика; тук — само разтоварването и обратният маршрут до изхода
  function updAgent(t, dt) {
    if (t.t < 0 || !t.agent) { t.t += dt; if (t.t < 0) { if (t.wq != null && (t.wq += dt) > 20) { logDel(t, 'няма място'); t.onArrive && t.onArrive(t.order); dropT(t); } return; }   /* t.wq — колко чака свободно място за тръгване; след 20 с — направо */ const A = deps.agents && deps.agents(); if (!A || !agentStart(t, A)) { logDel(t, 'без път'); t.onArrive && t.onArrive(t.order); dropT(t); } return; }   // без трафик (друг град) — доставено без пътя
    { const gp = t.A.group.position; t.x = t.agent.x + gp.x; t.z = t.agent.z + gp.z; t.state2 = t.agent.why || ''; }   /* за камерата (lookTir) и дебъга */
    if (!t.A.alive(t.agent)) { if (t.state === 'go') { logDel(t, 'друг град'); t.onArrive && t.onArrive(t.order); } dropT(t); return; }   // трафикът е сменен (друг град)
    t.age += dt;
    if (t.state === 'go' && t.age > t.lim) { logDel(t, 'направо'); t.onArrive && t.onArrive(t.order); dropT(t); return; }   // заседнал/обикаля — стоката е доставена направо
    if (t.state === 'back' && t.age > 40) { dropT(t); return; }   // празен на връщане — изчезва след 40 с, без да обикаля
    if (t.mover && t.mover.kind === 'mixer') t.mover.obj.rotation.z += dt * (t.state === 'unload' ? 6 : 2);
    if (t.state === 'unload') {
      t.u += dt; const k2 = Math.min(1, t.u / UNLOAD);
      if (t.mover && t.mover.kind === 'tipper') { t.mover.obj.rotation.x = -Math.sin(k2 * Math.PI) * 0.75; t.mover.obj.position.z = -Math.sin(k2 * Math.PI) * 0.6; }
      if (t.u >= UNLOAD) {
        logDel(t, 'по пътя'); t.onArrive && t.onArrive(t.order); for (const m of t.load) m.visible = false; t.tag.visible = false;
        if (t.mover && t.mover.kind === 'tipper') { t.mover.obj.rotation.x = 0; t.mover.obj.position.z = 0; }
        const c = t.agent, r = t.A.route({ p: c.p, s: c.s }, deps.entry(), true);
        if (r && t.A.retarget(c, r)) { t.state = 'back'; t.age = 0; } else dropT(t);
      }
    } else if (t.done) dropT(t);
  }
  function update(dt) {
    for (let k = list.length - 1; k >= 0; k--) {
      const t = list[k];
      if (t.A !== undefined || t.trl) { updAgent(t, dt); continue; }
      if (t.t < 0) { t.t += dt; if (t.t >= 0) t.root.visible = true; else continue; }
      if (t.mover && t.mover.kind === 'mixer') t.mover.obj.rotation.z += dt * (t.state === 'unload' ? 6 : 2);
      if (t.state !== 'unload' && deps.blocked && deps.blocked(t.x, t.z, t.yaw)) { t.wb = (t.wb || 0) + dt; if (t.wb < 8) continue; } else t.wb = 0;   // кола отпред — чака (до 8 s)
      if (t.state === 'go') {
        t.age += dt; if (follow(t, dt)) { t.state = 'unload'; t.u = 0; }
      } else if (t.state === 'unload') {
        t.u += dt;
        const k2 = Math.min(1, t.u / UNLOAD);
        if (t.mover && t.mover.kind === 'tipper') { t.mover.obj.rotation.x = -Math.sin(k2 * Math.PI) * 0.75; t.mover.obj.position.z = -Math.sin(k2 * Math.PI) * 0.6; }
        if (t.u >= UNLOAD) {
          logDel(t, 'по пътя'); t.onArrive && t.onArrive(t.order);
          for (const m of t.load) m.visible = false;   // празен
          if (t.mover && t.mover.kind === 'tipper') { t.mover.obj.rotation.x = 0; t.mover.obj.position.z = 0; }
          t.tag.visible = false;
          t.state = 'back';
          const e = deps.entry();
          t.path = deps.roadPath(t.x, t.z, e.x, e.z); t.pi = 0;
        }
      } else if (follow(t, dt)) {
        deps.scene.remove(t.root);
        list.splice(k, 1);
      }
    }
  }
  function clear() { for (const t of [...list]) { if (t.trl) dropT(t); else deps.scene.remove(t.root); } list.length = 0; }
  return { send, update, clear, list, log };
}
