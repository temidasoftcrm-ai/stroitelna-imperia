// opshormuz.js — 🌊 оперативната 3D карта „Ормузкият проток — морска криза“ (логиката: opskinds.js → strait; основата: opskit.js).
// Алтернативна игрова хронология. Протокът е по оста X (водата z = −70…60): северен бряг — скалисти хълмове; южен бряг — нефтен
// терминал (резервоари, кей, кранове, фар) и тръбата на алтернативния маршрут покрай брега. Корабният коридор (z ≈ 0) е отбелязан
// с шамандури; в него — мини (изчезват, докато миночистачите работят). На изток — опашка от танкери на котва. Когато има договор
// или ескорт и нищо не спира движението — танкерите минават на запад; ескортът (сиви фрегати) ги придружава; наблюдателите —
// хеликоптер и патрулен катер; при инцидент — дрон над танкер. Алтернативният маршрут — танкери, които товарят на кея на юг.
import { openOpsScene, THREE } from './opskit.js';

const SHIPS = 'assets/heavy/ships/', BOATS = 'assets/heavy/boats/', PORT = 'assets/heavy/port/', CARS = 'assets/heavy/cars/';
const LANE_W = -4, LANE_E = 8, QUEUE_X = 150, TERM = [-70, 78], JETTY_Z = 46, MINES = [[-60, 2], [-25, 5], [5, 0], [35, 6], [70, 2], [100, 4]];
export function openOpsHormuz(ops, o = {}) {
  return openOpsScene(ops, o, {
    title: 'морска криза', sky: 0xc9d6df, cam: [40, 120, 190], target: [10, 0, 10], bounds: [-160, 180, -90, 120], maxDist: 280, minY: 14,
    ambient: { file: 'flood', vol: m => m.out ? 0.05 : 0.1 },
    cars: { dip: [{ model: CARS + 'car-accord.glb', y: 1.2, path: [[-220, 100], [TERM[0] + 36, 100], [TERM[0] + 36, 92]] }] },
    labelAt: k => LB[k] || null,
    build,
  });
}
const LB = {};

function build(K) {
  const { scene, mat, plane, box, own, place } = K;
  scene.fog.near = 220; scene.fog.far = 520;
  const rnd = (a => () => (a = (a * 16807) % 2147483647) / 2147483647)(11);
  // ---- вода
  const nT = new THREE.TextureLoader().load('assets/heavy/water/waternormals.jpg'); nT.wrapS = nT.wrapT = THREE.RepeatWrapping; nT.repeat.set(30, 14); own(nT);
  const water = new THREE.Mesh(own(new THREE.PlaneGeometry(700, 400)), own(new THREE.MeshStandardMaterial({ color: 0x1d6075, roughness: 0.18, metalness: 0.25, normalMap: nT, normalScale: new THREE.Vector2(0.8, 0.8) })));
  water.rotation.x = -Math.PI / 2; water.position.y = 0; water.receiveShadow = true; scene.add(water);
  // ---- северният бряг: скалисти хълмове (изместена равнина)
  { const g = own(new THREE.PlaneGeometry(700, 120, 140, 30)), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), d = (y + 60) / 120; P.setZ(i, Math.max(0, d * 34 + Math.sin(x * 0.03) * 8 * d + Math.sin(x * 0.11 + y * 0.2) * 3 * d + rnd() * 2 * d - 1.5)); }
    g.computeVertexNormals(); const n = new THREE.Mesh(g, mat(0x9b8463, { flatShading: true })); n.rotation.x = -Math.PI / 2; n.position.set(0, 0, -128); n.receiveShadow = n.castShadow = true; scene.add(n); }
  // ---- южният бряг: пясък, път, терминал
  const sand = mat(0xd8c49a); box(700, 1.2, 80, sand, 0, 0, 100).castShadow = false; plane(700, 8, mat(0x4a4a4a), 0, 1.22, 100);
  // резервоарите на терминала
  const tankM = mat(0xe8e8e2, { metalness: 0.3, roughness: 0.5 });
  for (let i = 0; i < 8; i++) { const t = new THREE.Mesh(own(new THREE.CylinderGeometry(7, 7, 9, 24)), tankM); t.position.set(TERM[0] - 30 + (i % 4) * 18, 5.7, TERM[1] + 12 + Math.floor(i / 4) * 18); t.castShadow = true; scene.add(t); }
  // кеят и тръбопроводът (алтернативният маршрут): светещи стрелки по тръбата, когато тече
  box(8, 1.5, 34, mat(0x8f8a80), TERM[0], 0.5, JETTY_Z + 14); box(30, 1.5, 6, mat(0x8f8a80), TERM[0], 0.5, JETTY_Z);
  const pipeM = mat(0x7c8790, { metalness: 0.6, roughness: 0.35 }), pipe = new THREE.Mesh(own(new THREE.CylinderGeometry(0.9, 0.9, 190, 10)), pipeM); pipe.rotation.z = Math.PI / 2; pipe.position.set(-165, 2.2, 66); pipe.castShadow = true; scene.add(pipe);
  const arrowM = own(new THREE.MeshBasicMaterial({ color: 0xffb300 })), arrows = [];
  for (let k = 0; k < 18; k++) { const a = new THREE.Mesh(own(new THREE.ConeGeometry(0.9, 2.2, 6)), arrowM); a.rotation.z = -Math.PI / 2; a.visible = false; scene.add(a); arrows.push(a); }
  place(PORT + 'sf-stscrane.glb', { h: 26 }, c => { c.position.set(TERM[0] + 10, 1, JETTY_Z + 6); c.rotation.y = Math.PI; scene.add(c); });
  place(PORT + 'sf-lighthouse.glb', { h: 22 }, c => { c.position.set(60, 1.2, 66); scene.add(c); });
  place(PORT + 'sf-warehouse.glb', { w: 22 }, c => { c.position.set(TERM[0] + 36, 1.2, 112); scene.add(c); });   // офисът — тук идват дипломатите
  // ---- коридорът: шамандури (червени/зелени), мини
  const buoyR = mat(0xd32f2f), buoyG = mat(0x2e7d32), buoys = [];
  for (let x = -150; x <= 170; x += 30) for (const [z, m] of [[-14, buoyR], [18, buoyG]]) { const b = new THREE.Mesh(own(new THREE.CylinderGeometry(0.8, 1.1, 3, 10)), m); b.position.set(x, 1, z); scene.add(b); buoys.push(b); }
  const mineM = mat(0x2b2b2b, { metalness: 0.6, roughness: 0.4 }), mines = MINES.map(([x, z]) => { const g = new THREE.Group(); g.position.set(x, 0.6, z); scene.add(g); const s0 = new THREE.Mesh(own(new THREE.SphereGeometry(1.1, 12, 8)), mineM); g.add(s0);
    for (let k = 0; k < 8; k++) { const sp = new THREE.Mesh(own(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 5)), mineM); const a = k / 8 * Math.PI * 2; sp.position.set(Math.cos(a) * 1.2, (k % 2) * 0.6 - 0.3, Math.sin(a) * 1.2); sp.lookAt(0, 0, 0); sp.rotateX(Math.PI / 2); g.add(sp); } return g; });
  // ---- фрегатите на ескорта (процедурни, сиви) и катерите
  const frig = () => { const g = new THREE.Group(), gm = mat(0x7a8590, { metalness: 0.3, roughness: 0.5 }), dk = mat(0x5f6870);
    const hull = box(5, 3, 30, gm, 0, -0.6, 0, g); box(3.6, 3.2, 8, gm, 0, 2.4, -2, g); box(2.6, 2, 4, dk, 0, 5.6, -2, g); box(0.4, 7, 0.4, dk, 0, 6, -1, g); box(1.2, 1, 3, dk, 0, 2.4, 9, g);
    const bow = new THREE.Mesh(own(new THREE.ConeGeometry(2.5, 6, 4)), gm); bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.position.set(0, 0.9, 17.8); bow.scale.set(1, 1, 0.6); g.add(bow); scene.add(g); g.visible = false; return g; };
  const frigates = [frig(), frig()];
  const sweepers = []; for (let i = 0; i < 2; i++) place(BOATS + 'sf-fishship.glb', { len: 14 }, v => { v.traverse(q => { if (q.isMesh && q.material) { q.material = q.material.clone(); own(q.material); q.material.color.lerp(new THREE.Color(0x8a96a0), 0.6); } }); v.visible = false; scene.add(v); sweepers.push({ h: v, x: -40 + i * 40, z: 20 + i * 6 }); });
  let patrol = null; place(BOATS + 'sf-yacht.glb', { len: 12 }, v => { v.visible = false; scene.add(v); patrol = v; });
  // ---- хеликоптерът на наблюдателите и дронът при инцидент
  const heli = { h: null, rot: [] }; place('assets/heavy/ops/heli.glb', { len: 11 }, v => { v.visible = false; scene.add(v); heli.h = v; v.traverse(q => { if (/rotor_pales|moyeu/.test(q.name)) heli.rot.push([q, 'y']); else if (/rotor_anticouple/.test(q.name)) heli.rot.push([q, 'x']); }); });
  const drone = new THREE.Group(); scene.add(drone); drone.visible = false; box(1.6, 0.4, 1.6, mat(0x333333), 0, 0, 0, drone); for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) box(1, 0.08, 0.15, mat(0x111111), x, 0.3, z, drone);
  const blink = new THREE.Mesh(own(new THREE.SphereGeometry(0.25, 8, 6)), own(new THREE.MeshBasicMaterial({ color: 0xff2020 }))); blink.position.y = -0.3; drone.add(blink);
  // ---- танкерите: на котва (опашката), в движение през протока, на кея (алтернативният маршрут)
  let tankT = null, contT = null; K.load(SHIPS + 'tanker.glb').then(g => { tankT = g; }); K.load(SHIPS + 'container.glb').then(g => { contT = g; });
  const ship = (kind = 'tanker') => { const T = kind === 'tanker' ? tankT : contT || tankT; if (!T) return null; const v = K.fitTo(T.scene.clone(true), { len: kind === 'tanker' ? 46 : 40 }); K.shadows(v); scene.add(v); return v; };
  const anchored = [], transit = [], alt = [];
  let spawnT = 0, altT = 0, t0 = 0;
  for (const k of Object.keys(LB)) delete LB[k];
  return {
    update(m, tt, dt) {
      nT.offset.x = (tt * 0.01) % 1; nT.offset.y = (tt * 0.018) % 1;
      const on = k => m.teams[k] && m.teams[k].st === 'onsite', D = m.dec || {}, route = D.route || (on('escort') ? 'convoy' : on('alt') ? 'alt' : 'convoy');
      const paused = m.pauseTill > m.t || (m.event && ['incident', 'mine'].includes(m.event.id)), going = (on('escort') || m.agree) && !paused && route !== 'alt';
      // опашката на котва (до 14), леко люлеене
      if (tankT) { const want = Math.min(14, Math.round(m.queue * 0.7)); while (anchored.length < want) { const k = anchored.length, v = ship(k % 4 === 3 ? 'container' : 'tanker'); if (!v) break; v.userData.p = [QUEUE_X + (k % 5) * 30 + rnd() * 6, -40 + Math.floor(k / 5) * 32 + rnd() * 8, -Math.PI / 2 + (rnd() - 0.5) * 0.4]; anchored.push(v); }
        while (anchored.length > want) scene.remove(anchored.pop());
        for (const [k, v] of anchored.entries()) { const [x, z, r] = v.userData.p; v.position.set(x, Math.sin(tt * 0.8 + k) * 0.15, z); v.rotation.set(Math.sin(tt * 0.6 + k) * 0.01, r + Math.sin(tt * 0.2 + k) * 0.03, 0); } }
      // през протока — на запад по коридора; с ескорт — една фрегата отпред, една отзад
      spawnT -= dt; if (going && spawnT <= 0 && transit.length < 6 && m.queue > 1) { spawnT = (D.rules === 'close' ? 7 : 10) * (m.mines > 0.5 ? 1.8 : 1) * (m.agree ? 1 : 1.3); const v = ship(rnd() < 0.25 ? 'container' : 'tanker'); if (v) transit.push({ v, x: 200, z: LANE_W + (rnd() - 0.5) * 3 }); }
      const sp = paused ? 0 : (D.rules === 'close' ? 8 : D.rules === 'calm' ? 5.5 : 6.5) * (m.slowTill > m.t ? 0.5 : 1);
      for (const T of [...transit]) { T.x -= sp * dt; if (T.x < -260) { scene.remove(T.v); transit.splice(transit.indexOf(T), 1); continue; } T.v.position.set(T.x, Math.sin(tt + T.x * 0.05) * 0.12, T.z); T.v.rotation.y = -Math.PI / 2; }
      // ескортът
      const esc = on('escort'); const lead = transit[0];
      frigates.forEach((f, i) => { f.visible = esc || m.teams.escort.st === 'enroute'; if (!f.visible) return; let x, z;
        if (m.teams.escort.st === 'enroute') { const p = Math.min(1, (m.t - m.teams.escort.t0) / m.teams.escort.eta); x = -260 + 200 * p + i * 40; z = LANE_E + 6; }
        else if (lead) { x = lead.x + (i ? 45 : -45); z = lead.z + (i ? 12 : -12) * (D.rules === 'close' ? 0.6 : 1); }
        else { x = -30 + i * 60 + Math.sin(tt * 0.1 + i) * 30; z = LANE_E + 4; }
        const px = f.position.x, pz = f.position.z; f.position.x += (x - px) * Math.min(1, dt * 0.8); f.position.z += (z - pz) * Math.min(1, dt * 0.8); f.position.y = Math.sin(tt + i) * 0.1;
        const vx = f.position.x - px, vz = f.position.z - pz; if (Math.hypot(vx, vz) > 0.01) f.rotation.y = Math.atan2(vx, vz); });
      LB.escort = esc ? [frigates[0].position.x, 12, frigates[0].position.z] : null;
      // мините и миночистачите
      const nMines = Math.ceil(m.mines - 0.001); mines.forEach((g, i) => { g.visible = i < nMines; g.position.y = 0.5 + Math.sin(tt * 1.3 + i) * 0.15; });
      const mOn = on('mines'); sweepers.forEach((S0, i) => { S0.h.visible = mOn; if (!mOn) return; const tgt = mines.find((g, k) => g.visible && k % 2 === i) || mines.find(g => g.visible); const tx = tgt ? tgt.position.x + 9 : -100 + i * 30, tz = tgt ? tgt.position.z + 6 : 30;
        const dx = tx - S0.x, dz = tz - S0.z, d = Math.hypot(dx, dz); if (d > 0.5) { S0.x += dx / d * Math.min(d, 9 * dt); S0.z += dz / d * Math.min(d, 9 * dt); S0.h.rotation.y = Math.atan2(dx, dz); } S0.h.position.set(S0.x, Math.sin(tt + i) * 0.1, S0.z); });
      LB.mines = mOn && sweepers[0] ? [sweepers[0].x, 8, sweepers[0].z] : null;
      // наблюдателите: хеликоптер в кръг над коридора + патрулен катер
      const wOn = on('watch'); if (heli.h) { heli.h.visible = wOn; if (wOn) { for (const [q, ax] of heli.rot) q.rotation[ax] += dt * 40; const a = tt * 0.12; heli.h.position.set(Math.cos(a) * 90, 30, Math.sin(a) * 40); heli.h.rotation.y = -a + Math.PI; } }
      if (patrol) { patrol.visible = wOn; if (wOn) { const a = tt * 0.08 + 2; patrol.position.set(Math.cos(a) * 120, 0.1, 30 + Math.sin(a) * 8); patrol.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a) * 0.07) ; } }
      LB.watch = wOn && heli.h ? [heli.h.position.x, 36, heli.h.position.z] : null;
      // инцидент: дрон над първия танкер (или над коридора)
      const inc = m.event && m.event.id === 'incident'; drone.visible = inc; if (inc) { const T = transit[0]; drone.position.set((T ? T.x : 20) + Math.sin(tt * 2) * 4, 22 + Math.sin(tt * 3) * 1, (T ? T.z : 0) + Math.cos(tt * 2) * 4); blink.visible = ((tt * 4) | 0) % 2 === 0; }
      // алтернативният маршрут: танкер товари на кея и тръгва на запад; стрелките по тръбата текат
      const aOn = on('alt'); arrows.forEach((a, i) => { a.visible = aOn; if (aOn) a.position.set(-255 + ((i * 11 + tt * 8) % 182), 3.6, 66); });
      if (aOn && tankT) { altT -= dt; if (!alt.length || (altT <= 0 && alt.length < 3)) { altT = route === 'alt' ? 14 : 26; const v = ship('tanker'); if (v) alt.push({ v, st: 'load', t: 8, x: TERM[0] - 3, z: JETTY_Z - 10 }); } }
      for (const A of [...alt]) { if (A.st === 'load') { A.t -= dt; if (A.t <= 0) A.st = 'go'; } else { A.x -= 6 * dt; A.z += (14 - A.z) * Math.min(1, dt * 0.2); if (A.x < -270) { scene.remove(A.v); alt.splice(alt.indexOf(A), 1); continue; } } A.v.position.set(A.x, Math.sin(tt + A.x) * 0.1, A.z); A.v.rotation.y = -Math.PI / 2; }
      if (!aOn) while (alt.length) scene.remove(alt.pop().v);
      LB.alt = aOn ? [TERM[0], 24, TERM[1] + 20] : null; LB.reserve = on('reserve') ? [TERM[0] - 10, 18, TERM[1] + 30] : null; LB.dip = null;
      // небето: по-ясно с намаляване на напрежението
      const k = 1 - m.tension / 100; K.sky.setRGB(0.68 + k * 0.1, 0.74 + k * 0.1, 0.8 + k * 0.1); scene.fog.color.copy(K.sky);
      t0 += dt;
    },
  };
}
