// opsrebuild.js — 🏗️ оперативната 3D карта „Възстановяване на район“ (логиката: opskinds.js → rebuild; основата: opskit.js).
// Алтернативна игрова хронология, измислен район „Новоград“. Река по оста X (z = −30); на север — гарата и релсите; мостът (x = 20)
// е срутен → временен стоманен мост (bridge ≥ 40) → ремонтираният каменен (100). На юг — кварталът: панелни блокове (тъмни и с
// дупки и развалини, докато не са ремонтирани; скеле и кран, докато се ремонтират), болница, подстанция, спирка. Сапьорите
// проверяват дворовете (червено-бялата лента изчезва), автобусите връщат хората, нощем прозорците светят, когато има парно.
import { openOpsScene, THREE } from './opskit.js';

const CARS = 'assets/heavy/cars/', RIVER_Z = -30, BR_X = 20, ROAD_Z = 34;
const BLOCKS = [[-60, 6, 'soviet'], [-34, 6, 'soviet'], [-8, 6, 'soviet'], [46, 6, 'soviet'], [72, 6, 'soviet'], [-60, 62, 'soviet'], [-34, 62, 'soviet'], [46, 62, 'soviet']];
const HOSP = [-6, 66], SUB = [76, 62], STOP = [-80, ROAD_Z + 5];
export function openOpsRebuild(ops, o = {}) {
  return openOpsScene(ops, o, {
    title: 'възстановяване на района', sky: 0xb9c3cc, cam: [-40, 70, 130], target: [0, 4, 20], bounds: [-120, 120, -90, 100], maxDist: 200, minY: 10,
    sirens: { med: 'siren-ambulance' },
    cars: {
      sapper: [{ model: 'assets/heavy/vans/van-transit.glb', len: 5.2, path: [[-220, ROAD_Z], [-46, ROAD_Z], [-46, ROAD_Z - 8]] }],
      power: [{ model: CARS + 'car-hilux.glb', kind: 'utility', len: 5.6, path: [[220, ROAD_Z], [SUB[0] - 10, ROAD_Z], [SUB[0] - 10, SUB[1] - 10]] }],
      build: [{ model: 'assets/heavy/gear/dump.glb', len: 7, path: [[-220, ROAD_Z + 3], [-20, ROAD_Z + 3]] }, { model: CARS + 'car-truck.glb', len: 7, path: [[220, ROAD_Z + 3], [60, ROAD_Z + 3]], delay: 0.03 }],
      med: [{ model: CARS + 'amb-eu.glb', kind: 'ambulance', len: 7.2, path: [[-220, ROAD_Z], [HOSP[0] + 10, ROAD_Z], [HOSP[0] + 10, HOSP[1] - 12]] }],
      bridge: [{ model: CARS + 'car-truck.glb', len: 7, path: [[220, ROAD_Z - 3], [BR_X + 10, ROAD_Z - 3], [BR_X + 10, RIVER_Z + 20]] }],
      bus: [{ model: CARS + 'bus-citaro.glb', len: 11.5, path: [[-220, ROAD_Z + 3], [STOP[0], ROAD_Z + 3]] }],
    },
    build,
  });
}

function build(K) {
  const { scene, mat, plane, box, own, place, person, drop, walkTo } = K;
  scene.fog.near = 160; scene.fog.far = 380;
  const rnd = (a => () => (a = (a * 16807) % 2147483647) / 2147483647)(5);
  // ---- земя, река, улици, релси
  const grassM = mat(0x75805e); plane(500, 400, grassM, 0, 0, 20);
  const nT = new THREE.TextureLoader().load('assets/heavy/water/waternormals.jpg'); nT.wrapS = nT.wrapT = THREE.RepeatWrapping; nT.repeat.set(20, 2); own(nT);
  const river = new THREE.Mesh(own(new THREE.PlaneGeometry(500, 24)), own(new THREE.MeshStandardMaterial({ color: 0x4a6470, roughness: 0.2, metalness: 0.2, normalMap: nT }))); river.rotation.x = -Math.PI / 2; river.position.set(0, -0.6, RIVER_Z); scene.add(river);
  for (const z of [RIVER_Z - 12.5, RIVER_Z + 12.5]) box(500, 1.6, 1, mat(0x8f8a80), 0, -0.8, z);
  const asph = mat(0x45474b, { roughness: 0.95 }); plane(500, 10, asph, 0, 0.02, ROAD_Z); plane(8, 60, asph, -46, 0.03, 34); plane(8, 66, asph, BR_X, 0.03, RIVER_Z + 33);
  plane(500, 8, asph, 0, 0.02, -58); for (const z of [-66, -68.5]) box(500, 0.25, 0.25, mat(0x6a6a6a, { metalness: 0.7 }), 0, 0.12, z);
  for (let x = -250; x < 250; x += 1.6) box(0.3, 0.12, 4, mat(0x5a4a3a), x, 0.06, -67.2);
  place('assets/heavy/station/small.glb', { w: 34, maxH: 14 }, s => { s.position.set(BR_X, 0, -82); s.rotation.y = 0; scene.add(s); });
  // ---- мостът: опорите, срутената среда (наклонени плочи във водата), временният стоманен, ремонтираният каменен
  const stoneM = mat(0x8a857a); for (const z of [RIVER_Z - 9, RIVER_Z + 9]) box(8, 3, 4, stoneM, BR_X, -1.5, z);
  const broken = new THREE.Group(); scene.add(broken); { const a = box(8, 1, 10, stoneM, 0, 0, 0, broken); a.position.set(BR_X, -0.6, RIVER_Z - 4); a.rotation.x = 0.35; const b = box(8, 1, 9, stoneM, 0, 0, 0, broken); b.position.set(BR_X, -0.8, RIVER_Z + 4); b.rotation.x = -0.4; }
  const temp = new THREE.Group(); scene.add(temp); temp.visible = false; { const st = mat(0x6b7a8a, { metalness: 0.6, roughness: 0.4 }); box(7, 0.4, 30, st, BR_X, 0.4, RIVER_Z, temp); for (const x of [-3.4, 3.4]) { box(0.3, 2.4, 30, st, BR_X + x, 1.6, RIVER_Z, temp); for (let z = -14; z <= 14; z += 3) { const d = box(0.2, 3.2, 0.2, st, BR_X + x, 1.6, RIVER_Z + z, temp); d.rotation.x = (z / 3) % 2 ? 0.6 : -0.6; } } }
  let fixed = null; place('assets/heavy/bridge/stone.glb', { len: 34 }, b => { b.position.set(BR_X, -0.6, RIVER_Z); b.rotation.y = Math.PI / 2; b.visible = false; scene.add(b); fixed = b; });
  // ---- блоковете: материали за „повреда“, дупки по фасадата, развалини, скеле
  const blocks = BLOCKS.map(([x, z, kind], i) => { const B0 = { x, z, mats: [], base: [], hole: null, rubble: new THREE.Group(), scaf: new THREE.Group(), win: [], h: 20, w: 18 };
    K.load(`assets/heavy/blocks/${kind}.glb`).then(g => { if (!g || K.shut()) return; const b = K.fitTo(g.scene.clone(true), { h: 24 + (i % 3) * 3 }); if (b.userData.sz.x > 24) { const k = 24 / b.userData.sz.x; b.scale.setScalar(k); for (const ax of ['x', 'y', 'z']) b.userData.sz[ax] *= k; }   /* по височина (като в града), не по-широк от парцела */ b.position.set(x, 0, z); b.rotation.y = z > 30 ? 0 : Math.PI; scene.add(b); K.shadows(b);
      B0.h = b.userData.sz.y; B0.w = b.userData.sz.x; const d = b.userData.sz.z; b.traverse(q => { if (q.isMesh) { q.material = own(q.material.clone()); B0.mats.push(q.material); B0.base.push(q.material.color.clone()); } });
      const fz = z > 30 ? z - d / 2 - 0.05 : z + d / 2 + 0.05, hm = mat(0x1a1715);
      B0.hole = new THREE.Group(); scene.add(B0.hole); for (let k = 0; k < 3; k++) { const hb = box(3 + rnd() * 4, 2.5 + rnd() * 3, 0.3, hm, x - B0.w / 2 + 3 + rnd() * (B0.w - 6), B0.h * (0.35 + rnd() * 0.55), fz, B0.hole); }
      const wm = own(new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffc56a, emissiveIntensity: 0 })); for (let k = 0; k < 14; k++) { const wb = box(1.2, 1.4, 0.1, wm, x - B0.w / 2 + 2 + (k % 7) * (B0.w - 4) / 6, 3 + Math.floor(k / 7) * B0.h * 0.35 + rnd() * 3, fz + (z > 30 ? -0.08 : 0.08), scene); B0.win.push(wb); } B0.winM = wm;
      const sm = mat(0x9a8f7a); for (let k = 0; k < 7; k++) { const r = box(1 + rnd() * 2.5, 0.6 + rnd() * 1.2, 1 + rnd() * 2, sm, x - B0.w / 2 + rnd() * B0.w, 0, fz + (z > 30 ? -2 - rnd() * 3 : 2 + rnd() * 3), B0.rubble); r.rotation.y = rnd() * 3; } scene.add(B0.rubble);
      const sf = mat(0xc9b38a, { metalness: 0.3 }); for (let yy = 0; yy < B0.h; yy += 3) box(B0.w + 1, 0.15, 1.2, sf, x, yy, fz + (z > 30 ? -0.8 : 0.8), B0.scaf); for (let xx = -B0.w / 2; xx <= B0.w / 2; xx += 3) box(0.15, B0.h, 0.15, sf, x + xx, B0.h / 2, fz + (z > 30 ? -1.3 : 1.3), B0.scaf); scene.add(B0.scaf); B0.scaf.visible = false; });
    return B0; });
  // болницата, подстанцията, кранът, спирката
  const hospital = { mats: [], base: [] }; K.load('assets/heavy/civic2/hosp-m1.glb').then(g => { if (!g || K.shut()) return; const h = K.fitTo(g.scene.clone(true), { w: 30, maxH: 18 }); h.position.set(HOSP[0], 0, HOSP[1] + 6); scene.add(h); K.shadows(h); h.traverse(q => { if (q.isMesh) { q.material = own(q.material.clone()); hospital.mats.push(q.material); hospital.base.push(q.material.color.clone()); } }); });
  { const gm = mat(0x9aa0a6, { metalness: 0.6 }); for (const dx of [-4, 0, 4]) box(2.6, 2.4, 2, mat(0x4a4f55), SUB[0] + dx, 0, SUB[1]); box(12, 0.3, 0.3, gm, SUB[0], 3.4, SUB[1]); }
  const subLight = new THREE.PointLight(0x9fd0ff, 0, 20, 1.6); subLight.position.set(SUB[0], 6, SUB[1]); scene.add(subLight);
  let crane = null; place('assets/heavy/construct/sf-towercrane.glb', { h: 38 }, c => { c.visible = false; scene.add(c); crane = c; });
  place('assets/heavy/construct/sf-skip.glb', { len: 5 }, c => { c.position.set(-20, 0, 24); scene.add(c); });
  { const g = new THREE.Group(); g.position.set(STOP[0], 0, STOP[1] + 2); scene.add(g); box(4, 0.12, 1.6, mat(0x2c3440), 0, 2.6, 0, g); box(0.1, 2.6, 0.1, mat(0x2c3440), -1.9, 1.3, -0.6, g); box(0.1, 2.6, 0.1, mat(0x2c3440), 1.9, 1.3, -0.6, g); }
  // улични лампи — светят, когато има ток
  const lampM = own(new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xffe2a8, emissiveIntensity: 0 })); for (let x = -100; x <= 100; x += 20) { box(0.15, 5, 0.15, mat(0x2b2f36), x, 2.5, ROAD_Z - 6); box(0.5, 0.16, 0.36, lampM, x, 5, ROAD_Z - 5.6); }
  // сапьорите: лента около непроверените дворове; невзривеният боеприпас — червено флагче
  const tapeT = K.ctex(128, 16, (g, w, h) => { for (let x = 0; x < w; x += 32) { g.fillStyle = '#e53935'; g.fillRect(x, 0, 16, h); g.fillStyle = '#fff'; g.fillRect(x + 16, 0, 16, h); } }, [10, 1]);
  const tapeM = own(new THREE.MeshBasicMaterial({ map: tapeT, side: THREE.DoubleSide })), tapes = BLOCKS.map(([x, z]) => { const g = new THREE.Group(); scene.add(g); const zz = z > 30 ? z - 16 : z + 16;
    for (const [a, b, c, d] of [[x - 12, zz - 4, x + 12, zz - 4], [x - 12, zz + 4, x + 12, zz + 4], [x - 12, zz - 4, x - 12, zz + 4], [x + 12, zz - 4, x + 12, zz + 4]]) { const L = Math.hypot(c - a, d - b), t = new THREE.Mesh(own(new THREE.PlaneGeometry(L, 0.15)), tapeM); t.position.set((a + c) / 2, 0.9, (b + d) / 2); t.rotation.y = -Math.atan2(d - b, c - a); g.add(t); } return g; });
  const flag = new THREE.Group(); scene.add(flag); flag.visible = false; box(0.08, 1.4, 0.08, mat(0xdddddd), 0, 0.7, 0, flag); box(0.6, 0.4, 0.04, mat(0xd32f2f), 0.3, 1.2, 0, flag); flag.position.set(-34, 0, 24);
  // студът: сняг (частици) и побеляване на тревата; отоплителните пунктове (оранжеви палатки)
  const snowG = own(new THREE.BufferGeometry()), SN = 900, sp = new Float32Array(SN * 3); for (let i = 0; i < SN; i++) { sp[i * 3] = (rnd() - 0.5) * 240; sp[i * 3 + 1] = rnd() * 60; sp[i * 3 + 2] = (rnd() - 0.5) * 200 + 10; } snowG.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const snow = new THREE.Points(snowG, own(new THREE.PointsMaterial({ color: 0xffffff, size: 0.45, transparent: true, opacity: 0.85 }))); snow.visible = false; scene.add(snow);
  const heatTents = new THREE.Group(); scene.add(heatTents); heatTents.visible = false; for (const [x, z] of [[-60, 30], [46, 30]]) { const g = new THREE.Group(); g.position.set(x, 0, z); heatTents.add(g); box(4, 0.1, 3.6, mat(0xff8f00), 0, 2.4, 0, g); for (const [a, b] of [[-1.9, -1.7], [1.9, -1.7], [-1.9, 1.7], [1.9, 1.7]]) box(0.08, 2.4, 0.08, mat(0xff8f00), a, 1.2, b, g); }
  const glass = new THREE.Color(), grassBase = grassM.color.clone();
  // ---- хора: сапьорите (в дворовете), жителите (от спирката към блоковете), строителите
  const sappers = [], residents = [], workers = [];
  return {
    update(m, tt, dt) {
      nT.offset.x = (tt * 0.03) % 1;
      const on = k => m.teams[k] && m.teams[k].st === 'onsite', P0 = K.peds();
      // мостът
      broken.visible = m.bridge < 40; temp.visible = m.bridge >= 40 && m.bridge < 100; if (fixed) fixed.visible = m.bridge >= 100;
      // блоковете: повредата намалява с ремонта (по ред), скеле и кран на ремонтирания в момента
      const done = m.homes / 100 * blocks.length, cur = Math.floor(done);
      blocks.forEach((B0, i) => { const r = Math.max(0, Math.min(1, done - i + 0.2)); const dmg = (1 - r) * 0.75;
        B0.mats.forEach((mt, k) => mt.color.copy(B0.base[k]).lerp(glass.setHex(0x2b2723), dmg)); if (B0.hole) B0.hole.visible = r < 0.6; B0.rubble.visible = r < 0.9;
        B0.scaf.visible = on('build') && i === cur && r < 1; const lit = m.heat > 50 && m.home > i * 60; if (B0.winM) B0.winM.emissiveIntensity = lit ? 1.2 + Math.sin(tt * 0.5 + i) * 0.1 : 0; for (const wb of B0.win) wb.visible = lit; });   // топлите прозорци — само в отоплените блокове с хора
      if (crane) { const B0 = blocks[Math.min(blocks.length - 1, cur)]; crane.visible = on('build') && m.homes < 100; crane.position.set(B0.x + 14, 0, B0.z + (B0.z > 30 ? -14 : 14)); crane.rotation.y = tt * 0.08; }
      // болницата и токът
      hospital.mats.forEach((mt, k) => mt.color.copy(hospital.base[k]).lerp(glass.setHex(0x2b2723), (1 - m.hosp / 100) * 0.6));
      lampM.emissiveIntensity = m.power > 50 ? 1.2 : 0; subLight.intensity = m.power > 50 ? 4 + Math.sin(tt * 9) * 0.5 : 0;
      // сапьорите и лентите
      tapes.forEach((t, i) => { t.visible = m.safe < (i + 1) * 100 / tapes.length; });
      const sw = on('sapper') && m.safe < 100 ? 4 : 0; while (P0.length && sappers.length < sw) { const P = person(K.ff() || P0[0], { tint: 0x4b6b3a }); const B0 = BLOCKS[sappers.length * 2 % BLOCKS.length]; P.at(B0[0], B0[1] > 30 ? B0[1] - 16 : B0[1] + 16, 0, 0); P.anim('Walk'); P.home = [P.x, P.z]; sappers.push(P); }
      while (sappers.length > sw) drop(sappers.pop());
      for (const [i, P] of sappers.entries()) { const a = tt * 0.35 + i; walkTo(P, P.home[0] + Math.cos(a) * 9, P.home[1] + Math.sin(a * 1.3) * 3, 0.9, dt); }
      flag.visible = !!(m.event && m.event.id === 'uxo');
      // жителите (до 30): от спирката към блоковете, остават пред входовете
      const want = Math.min(30, Math.round(m.home / 20));
      while (P0.length && residents.length < want) { const k = residents.length, P = person(P0[k % P0.length]); const B0 = BLOCKS[k % BLOCKS.length]; P.at(STOP[0] + rnd() * 3, STOP[1], 0, 0); P.goal = [B0[0] - 6 + (k % 4) * 4, B0[1] > 30 ? B0[1] - 12 : B0[1] + 12]; P.anim('Walk'); residents.push(P); }
      while (residents.length > want) drop(residents.pop());
      for (const P of residents) if (P.goal && walkTo(P, P.goal[0], P.goal[1], 1.4, dt)) { P.goal = null; P.anim(rnd() < 0.5 ? 'Idle' : 'Talk_General'); }
      // строителите на скелето
      const ww = on('build') ? 5 : 0; while (P0.length && workers.length < ww) { const P = person(K.ff() || P0[0], { tint: 0xf9a825 }); workers.push(P); P.anim('Idle'); } while (workers.length > ww) drop(workers.pop());
      { const B0 = blocks[Math.min(blocks.length - 1, cur)]; workers.forEach((P, k) => { const fz = B0.z > 30 ? B0.z - 11 : B0.z + 11; P.at(B0.x - 7 + k * 3.5, fz, B0.z > 30 ? Math.PI : 0, 0); }); }
      // зимата: след ден 3 — сняг и побеляване; отоплителни пунктове при „печки“
      const winter = Math.min(1, Math.max(0, (m.t - 2.6) / 0.8)); snow.visible = winter > 0.05; if (snow.visible) { const p = snowG.attributes.position; for (let i = 0; i < SN; i++) { let y = p.getY(i) - dt * 4; if (y < 0) y = 60; p.setY(i, y); } p.needsUpdate = true; }
      grassM.color.copy(grassBase).lerp(glass.setHex(0xdfe4e8), winter * 0.6); heatTents.visible = !!m.heatAid && m.heat < 70;
      K.sky.setRGB(0.66 + winter * 0.06, 0.71 + winter * 0.06, 0.76 + winter * 0.06); scene.fog.color.copy(K.sky);
    },
  };
}
