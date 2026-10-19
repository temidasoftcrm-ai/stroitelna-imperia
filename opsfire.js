// opsfire.js — 🔥 оперативната 3D карта „Пожар в жилищен блок“ (логиката: opskinds.js → fire; основата: opskit.js).
// Четири сгради една до друга (№1–4, огнището е в №2) с лице към улицата (по X, z ≈ 13); отсреща — тротоар, зяпачи и сгради.
// Огънят: пламъци от прозорците и покрива според силата (m.b), дим, светлина; изгорелите сгради почерняват (m.burnt).
// Хората чакат по балконите и махат; автостълбата се разгъва до балкона, спасените слизат и отиват до линейките.
// Пожарните коли спират пред блока, пожарникарите гасят с водни струи; хеликоптерът хвърля вода отгоре;
// полицията затваря улицата (коли на двата края, лента) и изтегля зяпачите зад лентата.
import { openOpsScene, THREE } from './opskit.js';

const BLK = ['brick', 'dbrick', 'richmond', 'soviet'].map(k => `assets/heavy/blocks/${k}.glb`), OPP = ['modoffice', 'jade'].map(k => `assets/heavy/blocks/${k}.glb`);
const CARS = 'assets/heavy/cars/', OPS = 'assets/heavy/ops/';
const ROAD_Z = 13.5, FRONT = 5.6, BX = [-21, -7, 7, 21], LANE = ROAD_Z - 2.2;

export function openOpsFire(ops, o = {}) {
  return openOpsScene(ops, o, {
    title: 'Пожар в жилищен блок', sky: 0xa3b2c2, cam: [-14, 26, 42], target: [0, 6, 4], bounds: [-42, 42, -20, 44], maxDist: 75,
    sirens: { fire: 'siren-fire', ladder: 'siren-fire-2', med: 'siren-ambulance', pol: 'siren-police' },
    ambient: { file: 'fire-crackle', vol: m => Math.min(0.85, Math.max(...m.b) / 100 * 0.9 + m.b.filter(v => v > 0).length * 0.05) },   // пращенето на огъня — по-силно с пожара
    cars: {
      fire: [['fire-red', -24], ['fire-us', 8], ['fire-man', 22]].map(([n, x], i) => ({ model: CARS + n + '.glb', kind: 'fire', len: 9, path: [[-95, LANE], [x, LANE]], delay: i * 0.02 })),
      ladder: [{ model: OPS + 'ladder-truck.glb', len: 10, path: [[95, LANE], [-7, LANE]], beacons: true, beaconY: 3.2, lbY: 4 }],
      pol: [{ model: CARS + 'pol-crownvic.glb', kind: 'police', len: 5.4, path: [[-95, ROAD_Z + 2], [-36, ROAD_Z + 0.5]] }, { model: CARS + 'pol-charger.glb', kind: 'police', len: 5.1, path: [[95, ROAD_Z - 2], [36, ROAD_Z - 0.5]], delay: 0.02 }, { model: CARS + 'pol-interceptor.glb', kind: 'police', len: 5.3, path: [[95, ROAD_Z + 2], [30, ROAD_Z + 2.5]], delay: 0.04 }],
      med: [{ model: CARS + 'amb-eu.glb', kind: 'ambulance', len: 7.2, path: [[95, ROAD_Z + 2.2], [27, ROAD_Z + 2.2]] }, { model: CARS + 'amb-us.glb', kind: 'ambulance', len: 7.5, path: [[95, ROAD_Z + 2.2], [18, ROAD_Z + 2.2]], delay: 0.03 }],
    },
    labelAt: (k) => k === 'heli' ? heliLb : null,
    build,
  });
}
let heliLb = null;

function build(K) {
  const { scene, mat, plane, box, place, own, person, drop, walkTo, fire, puff, spray } = K;
  const jets = Array.from({ length: 6 }, () => K.stream(0.17)), fall = K.curtain();
  // ---- земя, улица, тротоари
  plane(260, 200, mat(0x6d7a5c), 0, 0, 0);
  const asph = mat(0x3b3e44, { roughness: 0.95 }), walkM = mat(0xb1aca2);
  plane(260, 9, asph, 0, 0.02, ROAD_Z); box(260, 0.15, 3, walkM, 0, 0.075, ROAD_Z - 6); box(260, 0.15, 3, walkM, 0, 0.075, ROAD_Z + 6);
  plane(260, 10, mat(0x8f8a80), 0, 0.03, 0);   // двор пред блока
  for (let x = -60; x <= 60; x += 4) plane(2, 0.2, mat(0xf2f2f2), x, 0.04, ROAD_Z);
  // ---- блокът: 4 сгради (собствени материали — почерняват при изгаряне), балкони за хората, точки за пламъците
  const blds = BX.map(() => ({ h: null, mats: [], base: [], wins: [], top: 12, balc: [], fires: [], light: null }));
  BX.forEach((x, i) => K.load(BLK[i]).then(g => { if (!g || K.shut()) return; const b = K.fitTo(g.scene.clone(true), { w: 13, maxH: 24 }); b.position.set(x, 0, FRONT - b.userData.sz.z / 2); scene.add(b); K.shadows(b);
    const B0 = blds[i]; B0.h = b; B0.top = b.userData.sz.y;
    b.traverse(q => { if (!q.isMesh) return; q.material = own(q.material.clone()); B0.mats.push(q.material); B0.base.push(q.material.color.clone()); });
    for (let k = 0; k < 9; k++) B0.wins.push([x + (Math.random() - 0.5) * 11, B0.top * (0.3 + Math.random() * 0.62), FRONT + 0.2]);
    for (let k = 0; k < 3; k++) { const y = B0.top * (0.45 + k * 0.17), bx = x - 4 + k * 4; box(2.4, 0.15, 1.1, mat(0x9b968d), bx, y, FRONT + 0.55); box(2.4, 0.9, 0.06, mat(0x3a3a3a, { metalness: 0.5 }), bx, y + 0.5, FRONT + 1.08); B0.balc.push([bx, y + 0.08, FRONT + 0.5]); }
    B0.fires = B0.wins.map(w => fire(w[0], w[1] - 0.6, w[2] + 0.2, 1.3, 4)); B0.fires.push(fire(x, B0.top, FRONT - 3, 3.2, 8, true)); }));
  // отсреща — две сгради по краищата (средата е свободна за камерата)
  OPP.forEach((p, i) => K.load(p).then(g => { if (!g || K.shut()) return; const b = K.fitTo(g.scene.clone(true), { w: 14, maxH: 22 }); b.position.set(i ? 40 : -40, 0, ROAD_Z + 7.6 + b.userData.sz.z / 2); b.rotation.y = Math.PI; scene.add(b); K.shadows(b); }));
  // полицейската лента (жълто-черна) пред отсрещния тротоар
  const tape = new THREE.Group(); scene.add(tape); tape.visible = false;
  { const tT = K.ctex(128, 16, (g, w, h) => { for (let x = 0; x < w; x += 32) { g.fillStyle = '#ffd400'; g.fillRect(x, 0, 16, h); g.fillStyle = '#111'; g.fillRect(x + 16, 0, 16, h); } }, [30, 1]);
    const tm = own(new THREE.MeshBasicMaterial({ map: tT, side: THREE.DoubleSide })), t1 = new THREE.Mesh(own(new THREE.PlaneGeometry(76, 0.16)), tm); t1.position.set(0, 1.15, ROAD_Z + 6.2); tape.add(t1);
    for (let x = -38; x <= 38; x += 6) box(0.06, 1.1, 0.06, mat(0xdddddd), x, 0.7, ROAD_Z + 6.2, tape); }
  // ---- автостълбата: разгъва се към балкона (процедурна стълба с кошче)
  const ladder = new THREE.Group(); scene.add(ladder); ladder.visible = false; const railM = mat(0xd9d9d9, { metalness: 0.6, roughness: 0.4 });
  const rails = [box(0.08, 1, 0.08, railM, -0.35, 0.5, 0, ladder), box(0.08, 1, 0.08, railM, 0.35, 0.5, 0, ladder)], rungs = [], basket = box(1.2, 0.9, 1.0, mat(0xc62828), 0, 1, 0, ladder);
  for (let k = 0; k < 40; k++) rungs.push(box(0.7, 0.05, 0.05, railM, 0, k * 0.5, 0, ladder));
  // ---- хеликоптерът
  const heli = { h: null, rot: [], x: -90, y: 45, z: -20, t: 0, tgt: null };
  place(OPS + 'heli.glb', { len: 11 }, v => { scene.add(v); v.visible = false; heli.h = v; v.traverse(q => { if (/rotor_pales|moyeu/.test(q.name)) heli.rot.push([q, 'y']); else if (/rotor_anticouple/.test(q.name)) heli.rot.push([q, 'x']); }); });
  heliLb = null;
  // ---- хора
  const waiting = [[], [], [], []], walking = [], crew = [], cops = [], crowd = [];
  let ladderLen = 0, smokeT = 0;
  const target = i => { const B0 = blds[i]; return B0.wins.length ? B0.wins[(Math.random() * B0.wins.length) | 0] : [BX[i], 8, FRONT]; };
  return {
    update(m, tt, dt) {
      if (!K.peds().length) return;
      const P0 = K.peds();
      // зяпачите отсреща (12) — с полицията се изтеглят зад лентата
      while (crowd.length < 12) { const P = person(P0[crowd.length % P0.length]); P.at(-14 + crowd.length * 2.6 + Math.random(), ROAD_Z + 5.2 + Math.random() * 1.2, Math.PI, 0.15); P.anim(crowd.length % 3 ? 'Idle' : 'Phone_Talk_M'); crowd.push(P); }
      const polOn = m.teams.pol.st === 'onsite'; tape.visible = polOn;
      for (const P of crowd) { const tz = polOn ? ROAD_Z + 6.9 + (P.x % 0.8 + 0.8) % 0.8 : P.z; if (polOn && P.z < ROAD_Z + 6.8) { walkTo(P, P.x, tz, 1.4, dt); P.anim('Walk'); } else { P.anim(P.cur === 'Walk' ? 'Idle' : P.cur || 'Idle'); P.ry = Math.PI; P.p.rotation.y = Math.PI; } }
      if (polOn && cops.length < 3) { const P = person(K.cop() || P0[0]); P.at(-8 + cops.length * 9, ROAD_Z + 5.4, 0, 0.15); P.anim('Idle'); cops.push(P); }
      if (!polOn) while (cops.length) drop(cops.pop());
      // огънят по сградите: прозорци и покрив; дим; почерняване
      for (const [i, B0] of blds.entries()) { if (!B0.h) continue; const pw = m.b[i] / 100;
        B0.fires.forEach((F, k) => F.update(tt, k === B0.fires.length - 1 ? pw : (k < Math.ceil(pw * 9) ? Math.min(1, pw * 1.4) : 0)));
        const burn = m.burnt[i]; B0.mats.forEach((mt, k) => { mt.color.copy(B0.base[k]).lerp(new THREE.Color(0x141414), burn * 0.85); });
        if (pw > 0 && Math.random() < dt * (3 + pw * 12)) puff(BX[i] + (Math.random() - 0.5) * 6, B0.top + 1, FRONT - 3, 1.3 + pw, 0.7);
        else if (pw <= 0 && burn > 0.2 && Math.random() < dt * 1.5) puff(BX[i], B0.top, FRONT - 3, 0.8, 0.35); }
      // хората по балконите (до 3 на сграда) — махат
      for (let i = 0; i < 4; i++) { const want = Math.min(3, Math.ceil(m.trapped[i] / 4)), W = waiting[i], B0 = blds[i];
        while (B0.balc.length && W.length < want) { const b = B0.balc[W.length]; const P = person(P0[(i * 3 + W.length) % P0.length]); P.at(b[0], b[2], 0, b[1]); P.anim('Waving'); W.push(P); }
        while (W.length > want) { const P = W.pop(); P.goal = 1; walking.push(P); P.anim('Walk'); P.at(P.x, P.z + 0.6, 0, P.y); } }
      // спасените: слизат (по стълбата или по стълбището) и вървят до линейките
      for (const P of [...walking]) { if (P.y > 0.16) { P.at(P.x, P.z, Math.PI, Math.max(0.15, P.y - dt * 2.4)); continue; }
        if (walkTo(P, 24 + (P.x % 3), ROAD_Z + 0.5, 1.6, dt)) { drop(P); walking.splice(walking.indexOf(P), 1); } }
      // 🪜 автостълбата: от камиона (x = −7) до най-високия балкон с хора
      const lOn = m.teams.ladder.st === 'onsite'; ladder.visible = lOn;
      if (lOn) { const Wb = waiting.findIndex(w => w.length) , tb = Wb >= 0 ? blds[Wb].balc[0] : blds[1].balc[0] || [-7, 8, FRONT]; ladderLen = Math.min(1, ladderLen + dt * 0.35);
        const from = new THREE.Vector3(-7, 3.4, LANE - 0.5), to = new THREE.Vector3(tb[0], tb[1] + 0.5, tb[2] + 1.2), d = to.clone().sub(from), L = d.length() * ladderLen;
        ladder.position.copy(from); ladder.lookAt(to); ladder.rotateX(Math.PI / 2); rails.forEach(r => { r.scale.y = L; r.position.y = L / 2; }); rungs.forEach((r, k) => { r.visible = k * 0.5 < L; }); basket.position.y = L; } else ladderLen = 0;
      // 🚒 пожарникарите и водните струи
      const fOn = m.teams.fire.st === 'onsite';
      if (fOn && crew.length < 6) { const P = person(K.ff() || P0[0]); const k = crew.length, tx = [-24, 8, 22][k >> 1] + (k % 2 ? 2 : -2); P.at(tx, FRONT + 3.2 + (k % 2), Math.PI, 0.15); P.anim('Idle'); crew.push(P); }
      if (!fOn) while (crew.length) drop(crew.pop());
      const D = m.dec || {}, shield = D.tactic === 'shield', weak = m.weakTill > m.t || (m.event && m.event.id === 'hydrant');
      for (const J of jets) J.mesh.scale.setScalar(weak ? 0.55 : 1);
      if (m.event && m.event.id === 'gas' && Math.random() < dt * 6) { const i = m.b.indexOf(Math.max(...m.b)); puff(BX[i] + (Math.random() - 0.5) * 6, 1, FRONT + 1, 0.8, 0.18); }   /* газ — бели струйки при входа */
      if (m.blast) { m.blast = 0; const i = m.b.indexOf(Math.max(...m.b)); for (let k = 0; k < 14; k++) puff(BX[i] + (Math.random() - 0.5) * 8, blds[i] ? blds[i].top * 0.5 : 6, FRONT - 2, 2.5, 0.8); }
      if (fOn) { const hot = [0, 1, 2, 3].filter(i => m.b[i] > 0).sort((a, b) => m.b[b] - m.b[a]); for (const [k, P] of crew.entries()) { const J = jets[k]; if (!hot.length) { J.update(dt, false); continue; } P.tgt = P.tgt && m.b[P.tgtI] > 0 && Math.random() > dt * 0.3 ? P.tgt : (P.tgtI = shield ? (k < 2 || hot.length < 2 ? hot[0] : hot[1 + k % (hot.length - 1)]) : hot[k % Math.min(2, hot.length)], target(P.tgtI)); const t = P.tgt;
          P.p.rotation.y = Math.atan2(t[0] - P.x, t[2] - P.z); J.set([P.x + Math.sin(P.p.rotation.y) * 0.5, 1.3, P.z + Math.cos(P.p.rotation.y) * 0.5], [t[0], t[1], t[2] + 0.3], 1.5 + t[1] * 0.12); J.update(dt, true); } }
      for (let k = crew.length; k < jets.length; k++) jets[k].update(dt, false);
      // 🚁 хеликоптерът: долита, виси над най-силния огън и хвърля вода
      const hOn = m.teams.heli.st === 'onsite', hGo = m.teams.heli.st === 'enroute'; heliLb = null;
      if (heli.h) { heli.h.visible = hOn || hGo; if (!hOn) fall.update(dt, false);
        if (heli.h.visible) { for (const [q, ax] of heli.rot) q.rotation[ax] += dt * 40;
          let ax0, ay0, az0; if (hGo) { const p = Math.min(1, (m.t - m.teams.heli.t0) / m.teams.heli.eta); ax0 = -90 + 80 * p; ay0 = 45 - 10 * p; az0 = -20 + 18 * p; heli.x = ax0; heli.y = ay0; heli.z = az0; }
          else { const hot = [0, 1, 2, 3].filter(i => m.b[i] > 0).sort((a, b) => m.b[b] - m.b[a])[0]; const tx = hot != null ? BX[hot] : -40, ty = hot != null && blds[hot] ? blds[hot].top + 14 : 35;
            heli.x += (tx - heli.x) * Math.min(1, dt * 0.6); heli.z += (FRONT - 3 - heli.z) * Math.min(1, dt * 0.6); heli.y += (ty - heli.y) * Math.min(1, dt * 0.6);
            fall.update(dt, hot != null && Math.abs(tx - heli.x) < 2 && !!blds[hot], heli.x, heli.y - 1.2, hot != null && blds[hot] ? blds[hot].top : 0, heli.z); }
          const hvx = heli.x - (heli.px ?? heli.x), hvz = heli.z - (heli.pz ?? heli.z); if (Math.hypot(hvx, hvz) > 0.01) heli.hdg = Math.atan2(hvx, hvz) + Math.PI; heli.px = heli.x; heli.pz = heli.z;   /* моделът гледа към −Z */
          heli.h.position.set(heli.x, heli.y + Math.sin(tt * 1.3) * 0.3, heli.z); heli.h.rotation.y = heli.hdg ?? -Math.PI / 2; heliLb = [heli.x, heli.y + 3, heli.z]; } }
      // небето: по-тъмно и оранжево, докато гори
      const mx = Math.max(...m.b) / 100; K.sky.setRGB(0.64 - mx * 0.12, 0.7 - mx * 0.2, 0.76 - mx * 0.3); scene.fog.color.copy(K.sky);
      smokeT += dt;
    },
    close() { heliLb = null; },
  };
}
