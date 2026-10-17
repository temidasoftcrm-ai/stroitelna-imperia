// incidents.js — „инцидент“ в града от време на време: две ударени коли насред улицата, идват 2 полицейски, пожарна и линейка
// по улиците (от различни краища, с бурканите и сирена), стоят около минута и се разотиват; после махат и ударените коли.
// game.js дава: scene, model(име, мащаб), has(име) — дали моделът е зареден, route(x0,z0,x1,z1) → точки по улиците,
// point() → случайна точка по улица, focus() → накъде гледа камерата. update(dt движение, rdt истинско време) — в кадъра.
import * as THREE from 'three';
import { feature } from './lab/feature.js';

const HOLD = 60;                      // колко стоят на място (истински секунди)
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
  const vehName = k => ctx.has('sf-car-' + k) ? ['sf-car-' + k, 1] : [{ Police_Sedan: 'police', Police_SUV: 'police', Firetruck: 'firetruck', Ambulance: 'ambulance' }[k], 1.15];

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

  function start(force) {
    clear();
    const at = pickSpot(); if (!at) return null;
    const g = new THREE.Group(); ctx.scene.add(g);
    // ударените коли — накриво една в друга, със струйка дим
    const wn = ['Sedan', 'Hatchback', 'SUV', 'Taxi'].map(k => 'sf-car-' + k).filter(ctx.has), wrecks = [];
    for (let k = 0; k < 2; k++) {
      const o = wn.length ? ctx.model(wn[(Math.random() * wn.length) | 0], 1) : ctx.model('sedan', 1.15);
      o.position.set(at.x + (k ? 1.6 : -1.2), 0, at.z + (k ? 1.1 : -0.8)); o.rotation.y = rnd(0, Math.PI * 2); o.rotation.z = k ? 0.05 : -0.04; g.add(o); wrecks.push(o);
    }
    const puffs = [];
    for (let k = 0; k < 7; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x777777, transparent: true, depthWrite: false, opacity: 0 })); s.userData.ph = k / 7; g.add(s); puffs.push(s); }
    const cars = [];
    [['Police_Sedan', 0], ['Police_SUV', 7], ['Firetruck', 15], ['Ambulance', 26]].forEach(([k, back], n) => {
      const [nm, sc] = vehName(k), st = pickStart(at); if (!nm || !st) return;
      const path = pathTo(st.x, st.z, at, back + 6); if (!path) return;
      const o = ctx.model(nm, sc); o.userData.beaconsOn = 1; o.position.set(st.x, 0, st.z); ctx.scene.add(o);
      cars.push({ o, x: st.x, z: st.z, yaw: 0, path, pi: 0, stage: 'go', delay: n * rnd(1.5, 4), sirenT: 0 });
    });
    inc = { at, g, cars, puffs, wrecks, t: 0, force: !!force };
    return { x: Math.round(at.x), z: Math.round(at.z), cars: cars.length };
  }
  function clear() {
    if (!inc) return;
    ctx.scene.remove(inc.g); for (const c of inc.cars) ctx.scene.remove(c.o);
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
    inc.puffs.forEach(s => { const ph = (inc.t * 0.25 + s.userData.ph) % 1; s.position.set(inc.at.x + Math.sin(ph * 9) * 0.6, 1 + ph * 9, inc.at.z + ph * 2); s.scale.setScalar(1.5 + ph * 5); s.material.opacity = inc.leave ? 0 : 0.55 * (1 - ph); });
    let gone = 0;
    for (const c of inc.cars) {
      if (c.delay > 0) { c.delay -= rdt; c.o.visible = c.delay <= 0; continue; }
      if (c.stage === 'go') {
        if ((c.sirenT -= rdt) <= 0) { c.sirenT = 8; c.o.userData.sirenOn = false; }   // сирената — щом стигне близо до камерата (vehmodels.js)
        if (c.path) move(c, dt); else { c.stage = 'hold'; c.o.userData.sirenOn = true; }
      } else if (c.stage === 'hold') {
        if (inc.cars.every(o => o.stage !== 'go') && inc.hold === undefined) inc.hold = HOLD;
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
      setTimeout(() => inc && inc.leave && inc.g.remove(...inc.wrecks), 9000);   // ударените коли — „репатрак“ ги прибира
    }
    if (inc.leave && gone === inc.cars.length) clear();
    if (inc && inc.t > HOLD + 240) clear();   // предпазно: ако някоя кола заседне
  }
  // за трафика в game.js: къде стоят/карат спешните коли и ударените — да ги заобикаля
  const obstacles = () => !inc ? [] : [...inc.cars.filter(c => c.stage !== 'gone' && c.o.visible).map(c => ({ x: c.x, z: c.z })), ...(inc.leave ? [] : [{ x: inc.at.x, z: inc.at.z }])];
  return { update, start, clear, obstacles, spot: () => inc && inc.at, get active() { return inc && { t: Math.round(inc.t), stages: inc.cars.map(c => c.stage) }; } };
}
