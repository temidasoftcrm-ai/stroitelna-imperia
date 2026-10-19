// opsaid.js — 🤝 оперативната 3D карта „Хуманитарен достъп“ (логиката: opskinds.js → aid; основата: opskit.js).
// Измислен квартал (алтернативен игрови сценарий): гъсти ниски сгради с плоски покриви и водни резервоари, главен път по оста X
// (z = 0) от изток (x = +110) през контролния пункт (x = 46) към квартала. В квартала: склад за помощи (x = 8, z = −16) с опашка,
// медицински пункт (x = −12, z = 16) с генератори, помпена станция (x = −40, z = −22) с чешма.
// Конвоят чака пред пункта, докато е затворен; щом се отвори — минава, разтоварва в склада и обикаля отново. Линейките
// извозват болните през пункта на изток. Бариерата се вдига, складът се пълни с палети, чешмата потича, когато има вода.
import { openOpsScene, THREE } from './opskit.js';

const CARS = 'assets/heavy/cars/', CP = 46, WH = [8, -16], MED = [-12, 16], PUMP = [-40, -22];
export function openOpsAid(ops, o = {}) {
  return openOpsScene(ops, o, {
    title: 'Хуманитарен достъп', sky: 0xd8cdb4, cam: [70, 34, 52], target: [18, 2, 0], bounds: [-50, 70, -40, 40], maxDist: 90,
    sirens: { med: 'siren-ambulance' },
    cars: {
      neg: [{ model: CARS + 'car-accord.glb', path: [[110, -2.2], [CP + 6, -2.2], [CP + 6, -7]] }],
      obs: [{ model: CARS + 'car-renegade.glb', path: [[110, 2.2], [CP + 7, 2.2], [CP + 7, 7]] }],
      water: [{ model: CARS + 'car-truck.glb', len: 7, path: [[-90, 2.2], [PUMP[0] + 3, 2.2], [PUMP[0] + 3, PUMP[1] + 9]] }],
      power: [{ model: CARS + 'car-hilux.glb', kind: 'utility', len: 5.6, path: [[-90, -2.2], [MED[0] - 8, -2.2], [MED[0] - 8, MED[1] - 6]] }],
    },
    labelAt: k => k === 'convoy' ? convLb : k === 'med' ? medLb : null,
    build,
  });
}
let convLb = null, medLb = null;

function build(K) {
  const { scene, mat, plane, box, place, own, person, drop, walkTo, puff, ctex } = K;
  const rnd = (a => () => (a = (a * 16807) % 2147483647) / 2147483647)(7);
  // ---- земя, пътища
  plane(300, 220, mat(0xcdb991), 0, 0, 0);
  const road = mat(0x55524c, { roughness: 0.95 }), dirt = mat(0xb9a47c);
  plane(180, 8, road, 25, 0.02, 0);
  for (const x of [-46, -30, -14, 2, 18]) plane(6, 84, dirt, x, 0.015, 0);   // улиците на квартала (север–юг)
  for (const z of [-30, -14, 14, 30]) plane(76, 6, dirt, -14, 0.015, z);      // и изток–запад
  // ---- кварталът: ниски сгради с плоски покриви, резервоари, антени, сенници
  const tones = [0xe6d6b4, 0xd9c49c, 0xefe2c8, 0xcbb48a, 0xe2cfa6].map(c => mat(c)), roofM = mat(0xb9a98a), tankM = mat(0x3d5f8a, { metalness: 0.3 }), awn = [0xc0392b, 0x2e7d32, 0x1565c0, 0xf9a825].map(c => mat(c));
  const winT = ctex(64, 64, (g, w) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, w); g.fillStyle = '#3a3226'; for (const [x, y] of [[10, 12], [38, 12], [10, 40], [38, 40]]) g.fillRect(x, y, 14, 16); }, [1, 1]);
  const lots = [];
  for (const cx of [-38, -22, -6, 10]) for (const cz of [-38, -22, 22, 38]) lots.push([cx, cz]);
  for (const cx of [-38, -22]) for (const cz of [-6, 6]) if (!(cx === -22 && cz === 6)) lots.push([cx, cz < 0 ? -8 : 8]);
  for (const [cx, cz] of lots) { if (Math.hypot(cx - WH[0], cz - WH[1]) < 12 || Math.hypot(cx - MED[0], cz - MED[1]) < 10 || Math.hypot(cx - PUMP[0], cz - PUMP[1]) < 9) continue;
    for (const [dx, dz] of [[-3.2, -3.2], [3.2, -3.2], [-3.2, 3.2], [3.2, 3.2]]) { if (rnd() < 0.12) continue; const w = 5.2 + rnd() * 1.2, d = 5.2 + rnd() * 1.2, h = 4 + Math.floor(rnd() * 4) * 3;
      const m = tones[(rnd() * tones.length) | 0].clone(); own(m); m.map = winT.clone(); m.map.needsUpdate = true; own(m.map); m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping; m.map.repeat.set(Math.round(w / 3), Math.round(h / 3));
      const b = box(w, h, d, m, cx + dx, 0, cz + dz); b.position.y = h / 2; box(w + 0.2, 0.4, d + 0.2, roofM, cx + dx, h, cz + dz);
      if (rnd() < 0.6) { const t = new THREE.Mesh(own(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 10)), tankM); t.position.set(cx + dx + (rnd() - 0.5) * 2, h + 1, cz + dz + (rnd() - 0.5) * 2); t.castShadow = true; scene.add(t); }
      if (rnd() < 0.35) { const a = box(w * 0.6, 0.08, 1.4, awn[(rnd() * 4) | 0], cx + dx, 2.6, cz + dz + (dz > 0 ? -d / 2 - 0.6 : d / 2 + 0.6)); a.rotation.x = dz > 0 ? 0.25 : -0.25; } } }
  // палми (пакетът: Bark_N + Leaf_N)
  K.load('assets/heavy/trees/palms.glb').then(g => { if (!g || K.shut()) return; g.scene.updateMatrixWorld(true); const tpl = []; g.scene.traverse(q => { const mm = /^Bark_(\d+)$/.exec(q.name); if (mm) { const L = g.scene.getObjectByName('Leaf_' + mm[1]); const grp = new THREE.Group(); for (const x of [q, L].filter(Boolean)) { const c = x.clone(true); x.matrixWorld.decompose(c.position, c.quaternion, c.scale); grp.add(c); } tpl.push(grp); } });
    if (!tpl.length) return; for (const [x, z] of [[30, -8], [30, 8], [22, -26], [-2, 26], [-52, 0], [36, 18], [36, -20], [-26, 0], [6, 6]]) { const t = K.fitTo(tpl[(rnd() * tpl.length) | 0].clone(true), { h: 7 + rnd() * 3 }); t.position.set(x, 0, z); t.rotation.y = rnd() * 6; K.shadows(t); scene.add(t); } });
  // ---- контролният пункт: бетонни блокове на зигзаг, кабини, навес, бариера, табела
  const conc = mat(0xb5b0a6), booth = mat(0xe8e4dc);
  for (let i = 0; i < 6; i++) box(1.2, 1, 3, conc, CP + 10 + i * 3, 0, (i % 2 ? 1 : -1) * 2.2);
  for (const z of [-6, 6]) { box(3, 2.8, 3, booth, CP, 0, z); box(3.4, 0.2, 3.4, mat(0x6b7a5a), CP, 2.8, z); }
  box(0.4, 5, 0.4, conc, CP - 2, 0, -6.5); box(0.4, 5, 0.4, conc, CP - 2, 0, 6.5); box(0.6, 0.8, 14, mat(0x6b7a5a), CP - 2, 5, 0);
  const sign = new THREE.Mesh(own(new THREE.PlaneGeometry(9, 1.3)), own(new THREE.MeshBasicMaterial({ map: ctex(512, 76, (g, w, h) => { g.fillStyle = '#1d2a38'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd54a'; g.font = '800 44px system-ui'; g.textAlign = 'center'; g.fillText('КОНТРОЛЕН ПУНКТ', w / 2, 54); }), side: THREE.DoubleSide })));
  sign.position.set(CP - 2.4, 5.9, 0); sign.rotation.y = Math.PI / 2; scene.add(sign);
  const arm = new THREE.Group(); arm.position.set(CP + 1.5, 1.1, -4.6); scene.add(arm); const armB = new THREE.Mesh(own(new THREE.BoxGeometry(0.18, 0.18, 9)), own(new THREE.MeshStandardMaterial({ map: ctex(128, 16, (g, w, h) => { for (let x = 0; x < w; x += 32) { g.fillStyle = '#d32f2f'; g.fillRect(x, 0, 16, h); g.fillStyle = '#fff'; g.fillRect(x + 16, 0, 16, h); } }) }))); armB.position.z = 4.5; armB.castShadow = true; arm.add(armB); box(0.5, 1.1, 0.5, conc, CP + 1.5, 0, -4.6);
  // ---- складът: хале с табела, двор с палети (растат с наличността), маси за раздаване
  { box(20, 7, 12, mat(0xf2f0ea), WH[0], 0, WH[1] - 4); const r = box(20.6, 0.5, 12.6, mat(0x2f6fb0), WH[0], 7, WH[1] - 4);
    const s2 = new THREE.Mesh(own(new THREE.PlaneGeometry(12, 1.6)), own(new THREE.MeshBasicMaterial({ map: ctex(512, 68, (g, w, h) => { g.fillStyle = '#2f6fb0'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '800 40px system-ui'; g.textAlign = 'center'; g.fillText('ХУМАНИТАРЕН СКЛАД', w / 2, 48); }) })));
    s2.position.set(WH[0], 5.6, WH[1] + 2.05); scene.add(s2); plane(22, 10, mat(0xb0a88e), WH[0], 0.03, WH[1] + 7);
    for (const x of [-4, 0, 4]) box(2.6, 0.8, 1, mat(0x8d6e4c), WH[0] + x, 0, WH[1] + 9.5); }
  const palG = own(new THREE.BoxGeometry(1.4, 1.1, 1.2)), palM = mat(0xd9c7a0), pallets = new THREE.InstancedMesh(palG, palM, 48); pallets.castShadow = true; pallets.count = 0; scene.add(pallets); const dm = new THREE.Object3D();
  // ---- медицинският пункт: сграда, палатки, генератори (светят с ток)
  const tentM = mat(0xf2f2f0), red = mat(0xd32f2f);
  box(12, 4, 8, mat(0xefe9dc), MED[0], 0, MED[1] + 4); box(1.6, 1.6, 0.1, red, MED[0], 4.6, MED[1] - 0.05); box(0.5, 1.6, 0.12, mat(0xffffff), MED[0], 4.6, MED[1] - 0.1); box(1.6, 0.5, 0.12, mat(0xffffff), MED[0], 4.6, MED[1] - 0.1);
  for (const dx of [-7, 7]) { const g = new THREE.Group(); g.position.set(MED[0] + dx, 0, MED[1] - 4); scene.add(g); box(4.4, 0.1, 4, tentM, 0, 2.6, 0, g); for (const [x, z] of [[-2.1, -1.9], [2.1, -1.9], [-2.1, 1.9], [2.1, 1.9]]) box(0.08, 2.6, 0.08, tentM, x, 0, z, g); box(1.2, 0.02, 0.36, red, 0, 2.66, 0, g); box(0.36, 0.02, 1.2, red, 0, 2.66, 0, g); }
  const genM = own(new THREE.MeshStandardMaterial({ color: 0x2f6b3a, emissive: 0xffc04a, emissiveIntensity: 0 })); for (const dx of [-4, -2]) box(1.6, 1.2, 1, genM, MED[0] + dx - 6, 0, MED[1] + 10);
  const medLight = new THREE.PointLight(0xffe2a8, 0, 18, 1.6); medLight.position.set(MED[0], 5, MED[1] - 3); scene.add(medLight);
  // ---- помпената станция и чешмата
  box(6, 4, 5, mat(0xd9c49c), PUMP[0], 0, PUMP[1]); const tank = new THREE.Mesh(own(new THREE.CylinderGeometry(2.2, 2.2, 3.4, 16)), mat(0x9aa4ae, { metalness: 0.5 })); tank.position.set(PUMP[0] + 6, 6.4, PUMP[1]); tank.castShadow = true; scene.add(tank);
  for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) box(0.25, 4.7, 0.25, mat(0x6d6d6d), PUMP[0] + 6 + x, 0, PUMP[1] + z);
  const levelM = mat(0x4a90c8), level = box(4.5, 0.2, 0.05, levelM, PUMP[0] + 6, 4.8, PUMP[1] + 2.25); level.position.y = 4.8;
  const tap = [PUMP[0] + 3, PUMP[1] + 5]; box(0.3, 1, 0.3, mat(0x777777), tap[0], 0, tap[1]); const jet = K.stream(0.05);
  // ---- конвоят (3 бели камиона с надпис) и линейките — своя траектория
  const cargoT = Object.fromEntries([['food', 'ХРАНА', '#2f6fb0'], ['water', 'ВОДА', '#1e88e5'], ['meds', 'ЛЕКАРСТВА', '#c62828']].map(([k, t, c]) => [k, ctex(256, 96, (g, w, h) => { g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, w, h); g.fillStyle = c; g.font = `900 ${t.length > 6 ? 30 : 44}px system-ui`; g.textAlign = 'center'; g.fillText(t, w / 2, 62); })])), aidT = cargoT.food, signs = [];
  const trucks = [], ambs = [];
  for (let i = 0; i < 3; i++) place(CARS + 'car-truck.glb', { len: 7.5 }, v => { v.traverse(q => { if (q.isMesh && q.material) { q.material = q.material.clone(); own(q.material); q.material.color.lerp(new THREE.Color(0xf2f2ee), 0.7); } }); const h = new THREE.Group(); h.add(v); const sg = new THREE.Mesh(own(new THREE.PlaneGeometry(4, 1.5)), own(new THREE.MeshBasicMaterial({ map: aidT, side: THREE.DoubleSide }))); signs.push(sg.material); const seal = box(0.5, 0.5, 0.06, mat(0x1565c0, { emissive: 0x1565c0, emissiveIntensity: 0.6 }), 0, 1.2, -3.8, h); seal.visible = false; h.userData.seal = seal; sg.position.set(1.26, 2.4, -1); sg.rotation.y = Math.PI / 2; h.add(sg); h.visible = false; scene.add(h); trucks.push({ h, i, u: -i * 0.12 }); });
  for (let i = 0; i < 2; i++) K.load(CARS + 'amb-us.glb').then(g => { if (!g || K.shut()) return; import('./vehmodels.js').then(V => { const c = V.emergCar(g.scene, 7.5, 'ambulance', 'amb-us'); const h = new THREE.Group(); h.add(c); h.visible = false; scene.add(h); ambs.push({ h, c, i, u: i * 0.5 }); }); });
  // траектории: конвоят — от изток до склада и обратно; линейките — от пункта на изток и обратно
  const CONV = [[112, -2.2], [CP + 8, -2.2], [CP - 6, -2.2], [WH[0] + 14, -2.2], [WH[0] + 14, WH[1] + 9], [WH[0] - 6, WH[1] + 9]];
  const AMB = [[MED[0] + 4, MED[1] - 9], [MED[0] + 4, 2.2], [CP - 6, 2.2], [CP + 8, 2.2], [112, 2.2]];
  const len = P => { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return L; };
  const at = (P, s) => { for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (s <= d || i === P.length - 1) { const t = Math.max(0, Math.min(1, s / d)); return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t, Math.atan2(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])]; } s -= d; } return [...P[P.length - 1], 0]; };
  const LC = len(CONV), LA = len(AMB), GATE = len(CONV.slice(0, 2));
  // ---- хора: опашката пред склада, чакащите пред медицинския пункт, охраната на пункта, минувачи
  const queue = [], patients = [], guards = [], walkers = [], stands = [], standQ = [], order = [], inspectors = [];
  // мобилните пунктове (сенник, маса, табела) — по улиците на квартала; при „чрез общината“ — зелени
  const STANDS = [[-30, -30], [-14, 30], [2, -30], [-46, 14]];
  for (const [x, z] of STANDS) { const g = new THREE.Group(); g.position.set(x, 0, z); g.visible = false; scene.add(g); const cm = mat(0x2f6fb0); box(3.6, 0.08, 2.6, cm, 0, 2.5, 0, g); for (const [a, b] of [[-1.7, -1.2], [1.7, -1.2], [-1.7, 1.2], [1.7, 1.2]]) box(0.06, 2.5, 0.06, mat(0xdddddd), a, 0, b, g); box(2.4, 0.8, 0.8, mat(0x8d6e4c), 0, 0, 0, g); stands.push({ g, cm }); }
  // полевата болница — още палатки до медицинския пункт
  const field = new THREE.Group(); field.visible = false; scene.add(field);
  for (const [dx, dz] of [[-16, 6], [-16, 12], [-22, 9]]) { const g = new THREE.Group(); g.position.set(MED[0] + dx, 0, MED[1] + dz); field.add(g); box(5, 0.1, 4.4, tentM, 0, 2.8, 0, g); for (const [x, z] of [[-2.4, -2.1], [2.4, -2.1], [-2.4, 2.1], [2.4, 2.1]]) box(0.08, 2.8, 0.08, tentM, x, 0, z, g); box(1.2, 0.02, 0.36, red, 0, 2.86, 0, g); box(0.36, 0.02, 1.2, red, 0, 2.86, 0, g); }
  let armA = 0, dust = 0;
  convLb = null; medLb = null;
  return {
    update(m, tt, dt) {
      const P0 = K.peds(); if (!P0.length) return;
      const open = m.access === 'open';
      // охраната (2) и минувачите (10)
      if (!guards.length) for (const z of [-3.6, 3.6]) { const P = person(K.cop() || P0[0]); P.at(CP - 0.5, z, -Math.PI / 2, 0); P.anim('Idle'); guards.push(P); }
      while (walkers.length < 10) { const P = person(P0[walkers.length % P0.length]); const sx = [-46, -30, -14, 2, 18][walkers.length % 5]; P.at(sx + (rnd() - 0.5) * 2, -40 + rnd() * 80, 0, 0); P.d = rnd() < 0.5 ? 1 : -1; P.anim('Walk'); walkers.push(P); }
      for (const P of walkers) { P.z += P.d * 1.3 * dt; if (Math.abs(P.z) > 42) P.d *= -1; P.at(P.x, P.z, P.d > 0 ? 0 : Math.PI, 0); }
      // опашката (до 28) — по-дълга при голяма нужда
      const D = m.dec || {}, crush = m.event && m.event.id === 'crush', mob = D.dist === 'mobile' || D.dist === 'local';
      for (const [i, S0] of stands.entries()) { S0.g.visible = mob; S0.cm.color.setHex(D.dist === 'local' ? 0x2e7d32 : 0x2f6fb0); }
      const sq = mob ? Math.min(24, Math.round(m.need / 3)) : 0;
      while (standQ.length < sq) { const k = standQ.length, [x, z] = STANDS[k % 4], P = person(P0[(k + 5) % P0.length]); P.at(x + (Math.floor(k / 4) % 3 - 1) * 0.9, z + 2 + Math.floor(k / 12) * 1.1, Math.PI, 0); P.anim('Idle'); standQ.push(P); }
      while (standQ.length > sq) drop(standQ.pop());
      field.visible = D.care === 'field';
      if ((D.check === 'full') !== !!inspectors.length) { if (D.check === 'full') for (const z of [-4, -1]) { const P = person(K.cop() || P0[1]); P.at(CP + 9, z, Math.PI / 2, 0); P.anim('Look_Around'); inspectors.push(P); } else while (inspectors.length) drop(inspectors.pop()); }
      const wantOrder = !!m.orderKept && !mob; if (wantOrder !== !!order.length) { if (wantOrder) for (const x of [-6, 0, 6]) { const P = person(K.cop() || P0[0]); P.at(WH[0] + x, WH[1] + 10.6, 0, 0); P.anim('Idle'); order.push(P); } else while (order.length) drop(order.pop()); }
      for (const S0 of signs) { const t = cargoT[D.cargo || 'food']; if (S0.map !== t) { S0.map = t; S0.needsUpdate = true; } }
      for (const T of trucks) T.h.userData.seal && (T.h.userData.seal.visible = D.check === 'seal');
      const qn = mob ? 6 : Math.round(Math.min(28, 6 + m.need / 3.5));
      while (queue.length < qn) { const k = queue.length, P = person(P0[(k + 2) % P0.length]); P.at(WH[0] - 9 + (k % 14) * 1.3, WH[1] + 12 + Math.floor(k / 14) * 1.4, Math.PI, 0); P.anim(k % 4 ? 'Idle' : 'Talk_General'); queue.push(P); }
      for (const [k, P] of queue.entries()) { if (crush) { P.anim(k % 2 ? 'Talk_Arguing' : 'Waving'); P.at(WH[0] - 5 + (k % 8) * 1.2 + Math.sin(tt * 3 + k) * 0.2, WH[1] + 9.8 + Math.floor(k / 8) * 0.8, Math.PI, 0); } else if (P.cur === 'Talk_Arguing' || P.cur === 'Waving') { P.anim('Idle'); P.at(WH[0] - 9 + (k % 14) * 1.3, WH[1] + 12 + Math.floor(k / 14) * 1.4, Math.PI, 0); } }
      while (queue.length > qn) drop(queue.pop());
      // чакащите за лечение (до 14) — седят/стоят пред палатките
      const pn = Math.round(Math.min(14, m.sick * 0.8));
      while (patients.length < pn) { const k = patients.length, P = person(P0[(k + 4) % P0.length]); P.at(MED[0] - 9 + (k % 7) * 2.6, MED[1] - 8.5 - Math.floor(k / 7) * 1.6, Math.PI, 0); P.anim(k % 2 ? 'Idle' : 'Phone_Talk_F'); patients.push(P); }
      while (patients.length > pn) drop(patients.pop());
      // бариерата: вдига се, когато коридорът е отворен
      armA += ((open ? -1.35 : 0) - armA) * Math.min(1, dt * 1.5); arm.rotation.x = armA;
      // склад: палетите следват наличността
      const pc = Math.min(48, Math.round(m.stock / 2.5)); if (pc !== pallets.count) { for (let k = 0; k < pc; k++) { dm.position.set(WH[0] - 7 + (k % 8) * 2, 0.55 + Math.floor(k / 24) * 1.1, WH[1] + 4 - (Math.floor(k / 8) % 3) * 1.6); dm.updateMatrix(); pallets.setMatrixAt(k, dm.matrix); } pallets.count = pc; pallets.instanceMatrix.needsUpdate = true; }
      // ток: генераторите и светлината на пункта
      const pOn = m.teams.power.st === 'onsite' && !(m.event && m.event.id === 'fuel'); genM.emissiveIntensity = pOn ? 0.6 + Math.sin(tt * 20) * 0.1 : 0; medLight.intensity = pOn ? 5 : 0;
      // вода: нивото в резервоара и чешмата
      level.position.y = 4.8 + (m.water / 100) * 3.2; const flow = m.water > 45; jet.set([tap[0], 1, tap[1]], [tap[0] + 0.6, 0.05, tap[1] + 0.2], 0.25); jet.update(dt, flow);
      // 🚚 конвоят: чака пред пункта, докато е затворен; после — до склада и обратно в кръг
      const cOn = m.teams.convoy.st === 'onsite', cGo = m.teams.convoy.st === 'enroute'; convLb = null;
      for (const T of trucks) { T.h.visible = cOn || cGo; if (!T.h.visible) continue;
        const gap = T.i * 11; let s;
        if (cGo) { const p = Math.min(1, (m.t - m.teams.convoy.t0) / m.teams.convoy.eta); s = Math.max(0, p * (GATE - gap)); T.u = 0; }
        else if (!open || m.heldTill > m.t || (m.event && m.event.id === 'held')) s = GATE - gap - 2;
        else { T.u = (T.u + dt * (m.teams.obs.st === 'onsite' ? 0.045 : 0.03)) % 2; const f = T.u < 1 ? T.u : 2 - T.u; s = Math.max(0, GATE - gap - 2 + f * (LC - GATE + gap)); }
        const [x, z, r] = at(CONV, s), back = !cGo && open && T.u >= 1; T.h.position.set(x, 0, z); T.h.rotation.y = back ? r + Math.PI : r;   /* обратно — по същия път, с предницата напред */
        if (open && Math.random() < dt * 6) puff(x, 0.6, z, 0.9, 0.25); if (T.i === 0) convLb = [x, 4, z]; }
      // 🚑 линейките: от медицинския пункт през коридора на изток и обратно (без коридор — чакат пред пункта)
      const aOn = m.teams.med.st === 'onsite', aGo = m.teams.med.st === 'enroute'; medLb = null;
      for (const A of ambs) { A.h.visible = aOn || aGo; A.c.userData.beaconsOn = A.h.visible; if (!A.h.visible) continue; let s;
        if (aGo) s = LA * (1 - Math.min(1, (m.t - m.teams.med.t0) / m.teams.med.eta)) + A.i * 9;
        else if (!open) s = Math.min(len(AMB.slice(0, 3)) - 2 - A.i * 9, LA);
        else { A.u = (A.u + dt * 0.028) % 2; const f = A.u < 1 ? A.u : 2 - A.u; s = f * LA; }
        const goOut = aGo ? false : open ? A.u < 1 : true, [x, z, r] = at(AMB, Math.max(0, Math.min(LA, s))); A.h.position.set(x, 0, z); A.h.rotation.y = goOut ? r : r + Math.PI; if (A.i === 0) medLb = [x, 3.6, z]; }
      // небето: прашна мараня, по-ясно, когато помощта стига
      const k = Math.max(0, 1 - m.need / 100); K.sky.setRGB(0.82 + k * 0.03, 0.78 + k * 0.06, 0.68 + k * 0.14); scene.fog.color.copy(K.sky);
    },
    close() { convLb = medLb = null; },
  };
}
