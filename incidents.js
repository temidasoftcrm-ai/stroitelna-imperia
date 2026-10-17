// incidents.js — инциденти в града от време на време: 12 вида (блъснат пешеходец, челна катастрофа, кола в стълб, кола по таван,
// верижна катастрофа, горяща кола, паднал моторист, изсипан товар, пожар в сграда, инфаркт на тротоара, котка на дърво, изтичане на газ).
// Спешните коли (полиция, пожарна, линейка, пътна помощ) идват по улиците от различни краища с бурканите (и сирена, когато камерата е близо),
// стоят на място и се разотиват; после се махат и следите от инцидента. Леките са по-чести, тежките — не по-често от веднъж на ~10 минути.
// game.js дава: scene, model(име, мащаб), has(име) — дали моделът е зареден, route(x0,z0,x1,z1) → точки по улиците,
// point() → случайна точка по улица, focus() → накъде гледа камерата. update(dt движение, rdt истинско време) — в кадъра.
import * as THREE from 'three';
import { feature } from './lab/feature.js';
import { playSiren, sirenKind } from './vehmodels.js';

const HOLD = 60;                      // колко стоят на място (истински секунди) — по подразбиране; всеки вид има свое
const HEAVY_GAP = 600;                // тежките (кола по таван, верижна, изсипан товар, пожар в сграда) — не по-често от веднъж на 10 мин
const EVERY = [240, 420];             // на колко време идва нов инцидент (истински секунди, само докато гледаш града)
const SPEED = 14;                     // по-бързи от обикновените коли (11 м/с), минават и на червено
const LANE = 1.9;                     // вдясно от оста на улицата — както колите в game.js

export function createIncidents(ctx) {
  let inc = null, wait = 150;         // първият — след ~2,5 минути в града
  const rnd = (a, b) => a + Math.random() * (b - a);
  const smokeTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  })();
  const vehName = k => ctx.has('sf-car-' + k) ? ['sf-car-' + k, 1] : [{ Police_Sedan: 'police', Police_SUV: 'police', Firetruck: 'firetruck', Ambulance: 'ambulance', Truck: 'truck' }[k], 1.15];

  // мястото — по улица, близо до това, което гледаш (за да се види); отделно — откъде тръгва всяка кола (120–300 м по-далеч)
  function pickSpot() {
    const f = ctx.focus(); let best = null, bd = 1e18;
    for (let k = 0; k < 40; k++) { const p = ctx.point(); if (!p) continue; const d = Math.hypot(p.x - f.x, p.z - f.z); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  function pickStart(at) {
    let best = null, bs = -1;
    for (let k = 0; k < 30; k++) { const p = ctx.point(); if (!p) continue; const d = Math.hypot(p.x - at.x, p.z - at.z), s = d < 120 ? d : d > 300 ? 600 - d : 300; if (s > bs) { bs = s; best = p; } }
    return best;
  }
  // пътят до мястото; последната точка се отмества назад по посоката на идване — колите не застават една в друга
  function pathTo(x0, z0, at, back) {
    const path = ctx.route(x0, z0, at.x, at.z).map(p => ({ x: p.x, z: p.z }));
    if (!path.length) return null;
    const e = path[path.length - 1], pv = path[path.length - 2] || { x: x0, z: z0 }, dx = e.x - pv.x, dz = e.z - pv.z, l = Math.hypot(dx, dz) || 1;
    path.push({ x: at.x - dx / l * back, z: at.z - dz / l * back, last: true });
    return path;
  }

  // ---- реквизит: човек (прав/легнал), конус, лента, щайга, огън, дим, дърво, мотор
  const M = (c, r = 0.8, e) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...(e ? { emissive: e, emissiveIntensity: 1 } : {}) });
  const SHIRT = [0x2f6fd6, 0xd63a2f, 0x2fa05a, 0xe0b030, 0x7a4fd0, 0x444a55], skin = M(0xe0b090);
  function person(lying, col) {
    const p = new THREE.Group(), body = M(col ?? SHIRT[(Math.random() * SHIRT.length) | 0]), legs = M(0x2a2f3a);
    const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.55, 4, 8), body); t.position.y = 1.15; p.add(t);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), skin); h.position.y = 1.68; p.add(h);
    for (const sd of [-1, 1]) { const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.6, 3, 6), legs); l.position.set(sd * 0.11, 0.42, 0); p.add(l); }
    if (lying) { p.rotation.z = Math.PI / 2; p.position.y = 0.25; const w = new THREE.Group(); w.add(p); return w; }
    return p;
  }
  const coneM = M(0xff6a00, 0.6), whiteM = M(0xffffff, 0.6);
  function cone() { const c = new THREE.Group(), k = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.75, 10), coneM); k.position.y = 0.375; c.add(k); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.12, 10), whiteM); b.position.y = 0.42; c.add(b); return c; }
  function tape(g, pts) {   // червено-бяла лента между конусите
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, l), M(i % 2 ? 0xffffff : 0xe02020)); m.position.set((a[0] + b[0]) / 2, 0.75, (a[1] + b[1]) / 2); m.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); g.add(m); }
    for (const [x, z] of pts) { const c = cone(); c.position.set(x, 0, z); g.add(c); }
  }
  const fireTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 40, 2, 32, 34, 30); g.addColorStop(0, 'rgba(255,250,200,1)'); g.addColorStop(0.35, 'rgba(255,170,40,0.9)'); g.addColorStop(1, 'rgba(255,60,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const car = (k, sc = 1) => { const wn = (k ? [k] : ['Sedan', 'Hatchback', 'SUV', 'Taxi', 'Pickup']).map(n => 'sf-car-' + n).filter(ctx.has); return wn.length ? ctx.model(wn[(Math.random() * wn.length) | 0], sc) : ctx.model('sedan', 1.15); };
  function moto() { const m = new THREE.Group(), dk = M(0x222222), rd = M(0xc81e1e, 0.4);
    for (const z of [-0.65, 0.65]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 6, 14), dk); w.position.set(0, 0.32, z); w.rotation.y = Math.PI / 2; m.add(w); }
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 1.1), rd); b.position.y = 0.6; m.add(b); m.rotation.z = Math.PI / 2 - 0.15; m.position.y = 0.3; const w = new THREE.Group(); w.add(m); return w; }
  function tree(h = 8) {   // дърво: моделът на играта, иначе процедурно (ствол + корона)
    const t = new THREE.Group(), tr = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, h * 0.45, 8), M(0x6b4a2b)); tr.position.y = h * 0.225; t.add(tr);
    for (const [y, r] of [[0.55, 0.32], [0.72, 0.27], [0.86, 0.18]]) { const c = new THREE.Mesh(new THREE.SphereGeometry(h * r, 10, 8), M(0x3f7f3a)); c.position.y = h * y; t.add(c); }
    return t;
  }
  // ---- видовете: w — тегло (колко често), hold — колко стоят, heavy — тежък, cars — [вид, отстъп назад], props(g, ctx) → { smoke: [x,y,z], fire: [[x,y,z,размер]] }
  const TYPES = {
    ped: { nm: '🚶 Блъснат пешеходец', w: 3, hold: 55, cars: [['Ambulance', 0], ['Police_Sedan', 9]], props(g) {
      const v = person(true); v.position.set(0.8, 0, 0.5); g.add(v); const c = car(); c.position.set(-2.8, 0, -1.2); c.rotation.y = rnd(0, 6.28); g.add(c);
      for (let k = 0; k < 5; k++) { const p = person(false); const a = k / 5 * 6.28; p.position.set(Math.cos(a) * 4 + 1, 0, Math.sin(a) * 4 + 0.5); p.rotation.y = -a - Math.PI / 2; g.add(p); } } },
    headon: { nm: '💥 Челна катастрофа', w: 3, hold: 65, cars: [['Police_Sedan', 0], ['Police_SUV', 8], ['Ambulance', 17]], props(g) {
      const y = rnd(0, 6.28); for (const [k, sd] of [[0, -1], [1, 1]]) { const c = car(); c.position.set(sd * 2.1, 0, sd * 0.4); c.rotation.y = y + (k ? Math.PI : 0) + rnd(-0.3, 0.3); c.rotation.z = rnd(-0.05, 0.05); g.add(c); }
      return { smoke: [0, 1, 0] }; } },
    pole: { nm: '🌳 Кола в дърво', w: 2, hold: 60, cars: [['Firetruck', 0], ['Ambulance', 14]], props(g) {
      const t = tree(7); t.position.set(0, 0, 0); g.add(t);
      const c = car(); c.position.set(0, 0, -2.6); c.rotation.x = -0.06; g.add(c); return { smoke: [0, 1, -1.2] }; } },
    roll: { nm: '🙃 Кола по таван', w: 1, hold: 85, heavy: true, cars: [['Police_Sedan', 0], ['Firetruck', 8], ['Ambulance', 21], ['Truck', 30]], props(g) {
      const c = car(); c.position.set(0, 1.5, 0); c.rotation.set(0, rnd(0, 6.28), Math.PI); g.add(c); tape(g, [[-5, -5], [5, -5], [5, 5], [-5, 5]]); return { smoke: [0, 0.5, 0] }; } },
    pile: { nm: '🚗🚗🚗 Верижна катастрофа', w: 1, hold: 80, heavy: true, cars: [['Police_Sedan', 0], ['Police_SUV', 7], ['Ambulance', 15]], props(g) {
      const y = rnd(0, 6.28), dx = Math.sin(y), dz = Math.cos(y); for (let k = 0; k < 4; k++) { const c = car(); c.position.set(dx * k * 4.3, 0, dz * k * 4.3); c.rotation.y = y + rnd(-0.25, 0.25); g.add(c); }
      for (let k = 0; k < 4; k++) { const c = cone(); c.position.set(-dx * (5 + k * 2) + dz * 1.5, 0, -dz * (5 + k * 2) - dx * 1.5); g.add(c); } return { smoke: [dx * 6, 1, dz * 6] }; } },
    carfire: { nm: '🔥 Горяща кола', w: 2, hold: 70, cars: [['Firetruck', 0], ['Police_Sedan', 13]], props(g) {
      const c = car(); c.position.set(0, 0, 0); c.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color.multiplyScalar(0.25); } }); g.add(c); return { smoke: [0, 2, 0], fire: [[0, 1.6, 0, 3.2], [1, 1.2, 0.8, 2.2]] }; } },
    moto: { nm: '🏍️ Паднал моторист', w: 2, hold: 50, cars: [['Ambulance', 0]], props(g) {
      const m = moto(); m.position.set(1.5, 0, 0); m.rotation.y = rnd(0, 6.28); g.add(m); const p = person(true, 0x111111); p.position.set(-1.2, 0, 1); g.add(p); } },
    spill: { nm: '📦 Камион изсипа товара', w: 1, hold: 90, heavy: true, cars: [['Police_SUV', 0], ['Truck', 9]], props(g) {
      const t = car('Truck'); t.position.set(0, 0, 3); g.add(t); const cm = M(0x9a6b3c);
      for (let k = 0; k < 14; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(rnd(0.6, 1.1), rnd(0.5, 0.9), rnd(0.6, 1.1)), cm); b.position.set(rnd(-3, 3), 0.35, rnd(-5, 0)); b.rotation.set(rnd(-0.3, 0.3), rnd(0, 6.28), rnd(-0.3, 0.3)); g.add(b); }
      tape(g, [[-4.5, -7], [4.5, -7], [4.5, 1], [-4.5, 1]]); } },
    bfire: { nm: '🔥🏢 Пожар в сграда', w: 1, hold: 100, heavy: true, cars: [['Firetruck', 0], ['Firetruck', 12], ['Police_Sedan', 24]], props(g, at) {
      // най-близката сграда до мястото: пламъци от прозорците на фасадата към улицата и черен дим от покрива
      const b = ctx.building && ctx.building(at.x, at.z); if (!b) return { smoke: [0, 3, 6], fire: [[0, 1.5, 6, 4]] };
      const fx = Math.max(b.x0, Math.min(b.x1, at.x)), fz = Math.max(b.z0, Math.min(b.z1, at.z)), nx = Math.sign(at.x - fx) * 0.8, nz = Math.sign(at.z - fz) * 0.8, along = nx ? [0, 1] : [1, 0], h = b.h;
      return { smokeW: [(b.x0 + b.x1) / 2, h + 1, (b.z0 + b.z1) / 2], fireW: [[fx + nx - along[0] * 2, h * 0.35, fz + nz - along[1] * 2, Math.min(6, 2 + h * 0.12)], [fx + nx + along[0] * 2, h * 0.55, fz + nz + along[1] * 2, Math.min(6, 2 + h * 0.12)], [fx + nx, h * 0.75, fz + nz, Math.min(6, 2 + h * 0.1)]] }; } },
    heart: { nm: '❤️ Инфаркт на тротоара', w: 3, hold: 45, cars: [['Ambulance', 0]], props(g) {
      const p = person(true); p.position.set(0, 0, 4.5); g.add(p); for (let k = 0; k < 3; k++) { const s = person(false); s.position.set(-1.5 + k * 1.5, 0, 6); s.rotation.y = Math.PI; g.add(s); } } },
    cat: { nm: '🐈 Котка на дърво', w: 1, hold: 60, cars: [['Firetruck', 0]], props(g) {
      const t = tree(9); t.position.set(0, 0, 6); g.add(t);
      const cat = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), M(0xff9a30)); cat.position.set(0.9, 6.6, 6); g.add(cat); for (let k = 0; k < 3; k++) { const s = person(false); s.position.set(-2 + k * 1.5, 0, 9); g.add(s); } } },
    gas: { nm: '⚠️ Изтичане на газ', w: 1, hold: 75, cars: [['Police_Sedan', 0], ['Firetruck', 9]], props(g) {
      tape(g, [[-6, -6], [6, -6], [6, 6], [-6, 6]]); const mh = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 16), M(0x333333)); mh.position.y = 0.03; g.add(mh); return { smoke: [0, 0.2, 0], gas: true }; } },
  };
  let lastHeavy = -1e9;
  function pickType(force) {
    if (force && TYPES[force]) return force;
    const now = performance.now() / 1000, ok = Object.entries(TYPES).filter(([, T]) => !T.heavy || now - lastHeavy > HEAVY_GAP);
    let x = Math.random() * ok.reduce((a, [, T]) => a + T.w, 0); for (const [k, T] of ok) { x -= T.w; if (x <= 0) return k; } return ok[0][0];
  }

  function start(force) {
    clear();
    const type = pickType(typeof force === 'string' ? force : null), T = TYPES[type];
    let at = pickSpot(); if (!at) return null;
    if (type === 'bfire' && ctx.building) {   // пожар в сграда: първо сградата (близо до камерата), после улицата до нея
      const f = ctx.focus(), b = ctx.building(f.x, f.z);
      if (b) { const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; let bd = 1e18; for (let k = 0; k < 60; k++) { const p = ctx.point(); if (!p) continue; const d = Math.hypot(p.x - cx, p.z - cz); if (d < bd) { bd = d; at = p; } } }
    }
    if (T.heavy) lastHeavy = performance.now() / 1000;
    const g = new THREE.Group(); g.position.set(at.x, 0, at.z); g.rotation.y = rnd(0, 6.28); ctx.scene.add(g);
    const fx = T.props(g, at) || {};
    g.updateMatrixWorld(true);
    const W = v => new THREE.Vector3(...v).applyMatrix4(g.matrixWorld);
    const puffs = [], flames = [];
    if (fx.smoke || fx.smokeW) { const o = fx.smokeW ? new THREE.Vector3(...fx.smokeW) : W(fx.smoke); for (let k = 0; k < 8; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: fx.gas ? 0xcfe0c0 : fx.fire || fx.fireW ? 0x333333 : 0x777777, transparent: true, depthWrite: false, opacity: 0 })); s.userData.ph = k / 8; s.userData.o = o; s.userData.big = fx.fire || fx.fireW ? 1.8 : fx.gas ? 0.6 : 1; ctx.scene.add(s); puffs.push(s); } }
    for (const f of [...(fx.fire || []).map(f => [W(f.slice(0, 3)), f[3]]), ...(fx.fireW || []).map(f => [new THREE.Vector3(...f.slice(0, 3)), f[3]])]) { const o = f[0]; for (let k = 0; k < 3; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.userData.o = o; s.userData.sz = f[1]; s.userData.ph = k * 2.1; ctx.scene.add(s); flames.push(s); } }
    const cars = [];
    T.cars.forEach(([k, back], n) => {
      const [nm, sc] = vehName(k), st = pickStart(at); if (!nm || !st || !ctx.has(nm) && nm.startsWith('sf-')) return;
      const path = pathTo(st.x, st.z, at, back + 7); if (!path) return;
      const o = ctx.model(nm, sc); o.userData.beaconsOn = 1; o.userData.noSiren = 1;   // сирените ги пуска update() — според разстоянието до камерата
      o.position.set(st.x, 0, st.z); ctx.scene.add(o);
      cars.push({ o, x: st.x, z: st.z, yaw: 0, path, pi: 0, stage: 'go', delay: n * rnd(1.5, 4), kind: sirenKind(o) || { Firetruck: 'fire', Ambulance: 'ambulance' }[k] || (k === 'Truck' ? null : 'police') });
    });
    inc = { at, g, cars, puffs, flames, type, hold0: T.hold, t: 0, force: !!force };
    return { x: Math.round(at.x), z: Math.round(at.z), cars: cars.length, type, nm: T.nm };
  }
  function clear() {
    if (!inc) return;
    ctx.scene.remove(inc.g); for (const c of inc.cars) ctx.scene.remove(c.o); for (const s of [...inc.puffs, ...inc.flames]) ctx.scene.remove(s);
    inc = null;
  }
  function move(c, dt) {
    const wp = c.path[c.pi];
    let x2 = wp.x, z2 = wp.z;
    if (c.pi > 0) { const pv = c.path[c.pi - 1], dx = wp.x - pv.x, dz = wp.z - pv.z, l = Math.hypot(dx, dz) || 1; x2 += -dz / l * LANE; z2 += dx / l * LANE; }
    const dx = x2 - c.x, dz = z2 - c.z, d = Math.hypot(dx, dz), st = SPEED * dt;
    if (d <= st) { c.x = x2; c.z = z2; if (++c.pi >= c.path.length) c.path = null; }
    else { c.x += dx / d * st; c.z += dz / d * st; const w = Math.atan2(dx, dz); let dy = w - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); c.yaw += dy * Math.min(1, dt * 8); }
    c.o.position.set(c.x, 0, c.z); c.o.rotation.y = c.yaw;
  }
  function update(dt, rdt) {
    if (!inc) {
      if (!feature('incidents') || !ctx.ready()) return;
      if ((wait -= rdt) <= 0) { wait = rnd(...EVERY); start(); }
      return;
    }
    inc.t += rdt;
    // дим над ударените коли, докато има някой на място
    // дим и пламъци (пожарната ги гаси: след като пристигне, пламъците намаляват)
    const fireOn = !inc.cars.some(c => c.kind === 'fire') ? 1 : Math.max(0, 1 - (inc.hold0 - (inc.hold ?? inc.hold0)) / (inc.hold0 * 0.7));
    inc.puffs.forEach(s => { const ph = (inc.t * 0.25 + s.userData.ph) % 1, o = s.userData.o, b = s.userData.big; s.position.set(o.x + Math.sin(ph * 9) * 0.6 * b, o.y + ph * 9 * b, o.z + ph * 2); s.scale.setScalar((1.5 + ph * 5) * b); s.material.opacity = inc.leave ? 0 : 0.55 * (1 - ph) * (inc.flames.length ? 0.4 + 0.6 * fireOn : 1); });
    inc.flames.forEach(s => { const o = s.userData.o, f = 0.75 + 0.25 * Math.sin(inc.t * 11 + s.userData.ph) * Math.sin(inc.t * 7.3 + s.userData.ph * 2); s.position.set(o.x + Math.sin(inc.t * 3 + s.userData.ph) * 0.2, o.y + (s.userData.ph % 2) * 0.3, o.z); s.scale.set(s.userData.sz * f * 0.8, s.userData.sz * f * 1.25, 1); s.material.opacity = inc.leave ? 0 : fireOn; });
    // сирените: докато колите идват и стоят на място — щом камерата е близо (до ~200 м), на ~7 s свири една от тях (редуват се: линейка, пожарна, полиция)
    if (!inc.leave && ctx.cam && (inc.sT = (inc.sT ?? 0) - rdt) <= 0) {
      const cam = ctx.cam(), on = inc.cars.filter(c => c.kind && c.o.visible && (c.stage === 'go' || c.stage === 'hold'));
      if (on.length) { const c = on[(inc.sI = (inc.sI ?? -1) + 1) % on.length], d = Math.hypot(c.x - cam.x, c.z - cam.z, cam.y);
        inc.sT = playSiren(c.kind, c.o, d, 5) ? 7 : 1; }
    }
    let gone = 0;
    for (const c of inc.cars) {
      if (c.delay > 0) { c.delay -= rdt; c.o.visible = c.delay <= 0; continue; }
      if (c.stage === 'go') {
        if (c.path) move(c, dt); else c.stage = 'hold';
      } else if (c.stage === 'hold') {
        if (inc.cars.every(o => o.stage !== 'go') && inc.hold === undefined) inc.hold = inc.hold0 || HOLD;
      } else if (c.stage === 'leave') {
        if (c.wait > 0) c.wait -= rdt; else if (c.path) move(c, dt); else { c.stage = 'gone'; ctx.scene.remove(c.o); }
      }
      if (c.stage === 'gone') gone++;
    }
    if (inc.hold !== undefined && !inc.leave && (inc.hold -= rdt) <= 0) {   // разотиват се — с малки паузи, всяка в своя посока
      inc.leave = true;
      inc.cars.forEach((c, n) => {
        c.o.userData.beaconsOn = 0;
        const to = pickStart(inc.at), path = to && ctx.route(c.x, c.z, to.x, to.z).map(p => ({ x: p.x, z: p.z }));
        c.stage = 'leave'; c.path = path && path.length ? path : null; c.pi = 0; c.wait = n * 3;
        if (!c.path) { c.stage = 'gone'; ctx.scene.remove(c.o); }
      });
      setTimeout(() => { if (inc && inc.leave) inc.g.visible = false; }, 9000);   // следите от инцидента се махат малко след като тръгнат
    }
    if (inc.leave && gone === inc.cars.length) clear();
    if (inc && inc.t > (inc.hold0 || HOLD) + 240) clear();   // предпазно: ако някоя кола заседне
  }
  // за трафика в game.js: къде стоят/карат спешните коли и ударените — да ги заобикаля
  const obstacles = () => !inc ? [] : [...inc.cars.filter(c => c.stage !== 'gone' && c.o.visible).map(c => ({ x: c.x, z: c.z })), ...(inc.leave ? [] : [{ x: inc.at.x, z: inc.at.z }])];
  return { update, start, clear, obstacles, spot: () => inc && inc.at, types: () => Object.keys(TYPES), get active() { return inc && { t: Math.round(inc.t), type: inc.type, stages: inc.cars.map(c => c.stage) }; } };
}
