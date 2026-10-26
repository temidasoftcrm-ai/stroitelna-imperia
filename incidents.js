// incidents.js — инциденти в града от време на време: 12 вида (блъснат пешеходец, челна катастрофа, кола в стълб, кола по таван,
// верижна катастрофа, горяща кола, паднал моторист, изсипан товар, пожар в сграда, инфаркт на тротоара, котка на дърво, изтичане на газ).
// Спешните коли (полиция, пожарна, линейка, пътна помощ) идват по улиците от различни краища с бурканите (и сирена, когато камерата е близо),
// стоят на място и се разотиват; после се махат и следите от инцидента. Леките са по-чести, тежките — не по-често от веднъж на ~10 минути.
// game.js дава: scene, model(име, мащаб), has(име) — дали моделът е зареден, route(x0,z0,x1,z1) → точки по улиците,
// point() → случайна точка по улица, focus() → накъде гледа камерата. update(dt движение, rdt истинско време) — в кадъра.
import * as THREE from 'three';
import { feature } from './lab/feature.js';
import { spinWheels } from './wheelspin.js';
import { kidK } from './scale.js';   // детските коли (резервата) в истинския размер
import { playSiren, sirenKind } from './vehmodels.js';
import { flameSprite, flameSize } from './fireflip.js';
import { loadInc2, createInc2Kit } from './incidents2.js';   // 🚨 incidents2 (55): истинските хора, кордон, гасене, пътна помощ, истински мотор   // истинските пламъци (Блендър) — Лабораторията → fire-real

const HOLD = 60;                      // колко стоят на място (истински секунди) — по подразбиране; всеки вид има свое
const HEAVY_GAP = 600;                // тежките (кола по таван, верижна, изсипан товар, пожар в сграда) — не по-често от веднъж на 10 мин
const EVERY = [240, 420];             // на колко време идва нов инцидент (истински секунди, само докато гледаш града)
const SPEED = 14;                     // по-бързи от обикновените коли (11 м/с), минават и на червено
const LANE = 1.9;                     // вдясно от оста на улицата — както колите в game.js

export function createIncidents(ctx) {
  let inc = null, wait = 150;         // първият — след ~2,5 минути в града
  let K2 = null; const I2 = () => feature('incidents2') && K2;
  const k2p = feature('incidents2') ? loadInc2().then(l => { if (l) K2 = createInc2Kit(l); }) : null;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const smokeTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  })();
  const vehName = k => ctx.has('sf-car-' + k) ? ['sf-car-' + k, 1] : [null, 1];   /* №2 (55): без детските резерви — колата просто не идва */   /* резервата в истинския размер (55) */

  // мястото — по улица, близо до това, което гледаш (за да се види); отделно — откъде тръгва всяка кола (120–300 м по-далеч)
  function pickSpot() {
    const f = ctx.focus(); let best = null, bd = 1e18;
    for (let k = 0; k < 80; k++) { const p = ctx.point(); if (!p || (ctx.spotOk && !ctx.spotOk(p.x, p.z))) continue; const d = Math.hypot(p.x - f.x, p.z - f.z); if (d < bd) { bd = d; best = p; } }   // не в кръгово движение и не до кръстовище
    return best;
  }
  function pickStart(at) {
    let best = null, bs = -1;
    for (let k = 0; k < 30; k++) { const p = ctx.point(); if (!p) continue; const d = Math.hypot(p.x - at.x, p.z - at.z), s = d < 120 ? d : d > 300 ? 600 - d : 300; if (s > bs) { bs = s; best = p; } }
    return best;
  }
  // пътят до мястото; последната точка се отмества назад по посоката на идване — колите не застават една в друга
  function pathTo(x0, z0, at, back) {
    const path = ctx.route(x0, z0, at.x, at.z).map(p => ({ x: p.x, z: p.z, ln: p.ln, rg: p.rg }));
    if (!path.length) return null;
    if (back > 0) {   // спира back м преди мястото, по пътя си (не кара до самото място и после назад — през останките)
      let rem = back; while (path.length > 1) { const a = path[path.length - 2], b = path[path.length - 1], l = Math.hypot(b.x - a.x, b.z - a.z); if (l > rem) { const t = rem / l; path[path.length - 1] = { x: b.x + (a.x - b.x) * t, z: b.z + (a.z - b.z) * t }; break; } rem -= l; path.pop(); }
      // не спира в кръгово движение или на кръстовище (там е островът/паметникът): още назад по пътя, до 40 м
      for (let k = 0; k < 40 && path.length > 1 && ctx.spotOk && !ctx.spotOk(path[path.length - 1].x, path[path.length - 1].z, 3, 9); k++) { const a = path[path.length - 2], b = path[path.length - 1], l = Math.hypot(b.x - a.x, b.z - a.z); if (l <= 1) path.pop(); else path[path.length - 1] = { x: b.x + (a.x - b.x) / l, z: b.z + (a.z - b.z) / l }; }
      path[path.length - 1].last = true; return path;
    }
    const e = path[path.length - 1], pv = path[path.length - 2] || { x: x0, z: z0 }, dx = e.x - pv.x, dz = e.z - pv.z, l = Math.hypot(dx, dz) || 1;
    const ro = path[0].ln ? LANE : 0;   // пътят по лентите — и последната точка в лентата (вдясно от оста на улицата)
    path.push({ x: at.x - dx / l * back - dz / l * ro, z: at.z - dz / l * back + dx / l * ro, last: true });
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
  const car = (k, sc = 1) => { const wn = (k ? [k] : ['Sedan', 'Hatchback', 'SUV', 'Taxi', 'Pickup']).map(n => 'sf-car-' + n).filter(ctx.has); return wn.length ? ctx.model(wn[(Math.random() * wn.length) | 0], sc) : new THREE.Group(); };   /* №2 (55): без детската кола */
  function moto() { const m = new THREE.Group(), dk = M(0x222222), rd = M(0xc81e1e, 0.4);
    for (const z of [-0.65, 0.65]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 6, 14), dk); w.position.set(0, 0.32, z); w.rotation.y = Math.PI / 2; m.add(w); }
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 1.1), rd); b.position.y = 0.6; m.add(b); m.rotation.z = Math.PI / 2 - 0.15; m.position.y = 0.3; const w = new THREE.Group(); w.add(m); return w; }
  function tree(h = 8) {   // дърво: моделът на играта, иначе процедурно (ствол + корона)
    { const n = ['sf-tree-0', 'sf-tree-1', 'sf-tree-2', 'sf-tree-3'].find(ctx.has); if (n) { const o = ctx.model(n, h); o.rotation.y = rnd(0, 6.28); return o; } }   // истинското дърво (височина 1 → h)
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
      const y = (feature('pile-axis') ? (Math.random() < 0.5 ? 0 : Math.PI) + rnd(-0.12, 0.12) : rnd(0, 6.28)), dx = Math.sin(y), dz = Math.cos(y); for (let k = 0; k < 4; k++) { const c = car(); c.position.set(dx * k * 4.3, 0, dz * k * 4.3); c.rotation.y = y + rnd(-0.25, 0.25); g.add(c); }   // pile-axis (f6): колоната — по улицата (локалната z = посоката на пътя, roadAt), не напреки на тревата
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
  // ---- incidents2: същите 12 вида в рамката на улицата (+z — по улицата, x — напречно; платното до ±hw, тротоарите до ±(hw + walk)).
  // Кордонът и конусите през платната се показват, щом екипите пристигнат; зяпачите — по тротоарите зад лентата.
  const roadFrame = at => { const r = (ctx.roadAt && ctx.roadAt(at.x, at.z)) || { dx: 0, dz: 1, w: 8, walk: 2 }; return { ...r, hw: r.w / 2, walk: Math.max(1.6, r.walk) }; };
  // булевард с разделителна ивица: сцената — в дясното платно (центърът му); вляво от нея е ивицата
  const carriage = (at, R) => { if (!R.median) return at; const cw = R.hw - R.median / 2, s0 = R.median / 2 + cw / 2; R.hw = cw / 2; R.mid = R.median; return { ...at, x: at.x + R.dz * s0, z: at.z - R.dx * s0 }; };
  const lenOf = o => { const s = K2.bodyBox(o).getSize(new THREE.Vector3()); return Math.max(s.x, s.z); }, hOf = o => K2.bodyBox(o).getSize(new THREE.Vector3()).y;
  function base(g, R, o = {}) {   // кордон през цялата улица (len — половината дължина), конуси през платната отвъд него, полицаи, които спират движението, зяпачи
    const L = o.len || 10, X = R.hw + R.walk * 0.4, XL = R.mid ? R.hw + 0.4 : X, cl = new THREE.Group(); g.add(cl); cl.visible = false;
    if (o.close !== false) R.blkL = Math.max(R.blkL || 0, L + 3);   // traffic-gap: конусите през платната — колите спират пред тях   // XL — откъм разделителната ивица: до края на платното
    if (o.cordon !== false) K2.cordon(cl, o.pts || [[-XL, -L], [X, -L], [X, L], [-XL, L]]);
    if (o.close !== false) for (const z of [-L - 3, L + 3]) for (let x = -R.hw + 0.7; x <= R.hw - 0.6; x += 1.6) { const c = cone(); c.position.set(x, 0, z); cl.add(c); }
    for (let k = 0; k < (o.cops ?? 2); k++) { const sz = k ? 1 : -1; K2.put(g, 'cop', 'wave', sz * R.hw * 0.4, sz * (L + 5), sz * R.hw * 0.4, sz * (L + 30)); }   // с лице към колите, които спира
    const n = o.crowd ?? 6, cx = R.hw + R.walk * 0.8;
    if (R.mid && !o.crowdSide) o.crowdSide = 1;   // на булеварда — само откъм тротоара
    if (o.crowdSide) K2.crowd(g, n, o.crowdSide * cx, -L * 0.7, L * 0.7); else { K2.crowd(g, Math.ceil(n / 2), cx, -L * 0.7, L * 0.7); K2.crowd(g, Math.floor(n / 2), -cx, -L * 0.6, L * 0.6); }
    return cl; }
  const medics = (g, x, z, n = 2) => { for (let k = 0; k < n; k++) K2.put(g, 'medic', 'idle', x + (k ? -1.1 : 1.1), z + 0.5, x, z); };
  // #28 (jam-police): задръстване на кръстовище — идва полицейска кола (паркира на бордюра), полицаят в средата регулира (трафикът: tr.police);
  // само по повикване от game.js (w: 0 — не идва случайно)
  TYPES.jam = { nm: '🚓 Полицай регулира движението', w: 0, hold: 45, cars: [['Police_Sedan', 16]], props(g) { if (K2) K2.put(g, 'cop', 'wave', 0, 0, 0, 6); else { const p = person(false); g.add(p); } } };
  // #3 (police-chase, backlog 25.10): полицейско преследване — кола-беглец кара бързо по улиците (през червено, изпреварва в насрещното),
  // 1–3 полицейски коли с бурканите и сирените я гонят по същия път; накрая я заклещват — полицаите слизат, арест, сцената се разпуска
  TYPES.chase = { nm: '🚨 Полицейско преследване', get w() { return feature('police-chase') ? 1 : 0; }, hold: 40, chase: true, cars: [], props() {} };
  const TYPES2 = {
    ped: { props(g, at, R) { const v = K2.person('ped', 'idle', { lying: true }); v.position.set(0.8, 0, 0.6); v.rotation.y = rnd(0, 6.28); g.add(v);
      const c = car(); c.position.set(R.hw * 0.45, 0, -6); c.rotation.y = 0.12; g.add(c); K2.put(g, 'ped', 'argue', R.hw * 0.45 + 1.6, -4.4, 0.8, 0.6);   // шофьорът
      medics(g, 0.8, 0.6); K2.put(g, 'cop', 'talk', R.hw * 0.45 + 2.4, -5.4, R.hw * 0.45 + 1.6, -4.4);
      return { closure: base(g, R, { len: 11 }) }; } },
    headon: { props(g, at, R) { const a = car(), b = car(), la = lenOf(a), lb = lenOf(b);   // челно: предниците се допират, леко разминати (удар с припокриване)
      a.position.set(0.45, 0, -la / 2 + 0.15); a.rotation.y = 0.13; b.position.set(-0.35, 0, lb / 2 - 0.15); b.rotation.y = Math.PI - 0.16; g.add(a, b);
      medics(g, 2.3, -la / 2); K2.put(g, 'ff', 'idle', -2.4, lb / 2, -0.35, lb / 2);
      return { smokes: [[0.4, 0.9, -0.6], [-0.3, 0.9, 0.6]], closure: base(g, R, { len: 12, crowd: 7 }) }; } },
    pole: { cars: [['Ambulance', 3], ['Firetruck', 19]], props(g, at, R) { const tx = R.hw + R.walk * 0.55, t = tree(7); t.position.set(tx, 0, 0); g.add(t);
      const c = car(), l = lenOf(c); c.position.set(tx - 0.35 - l / 2, 0, 0); c.rotation.y = Math.PI / 2; c.rotation.x = -0.03; g.add(c);   // носът в дървото
      medics(g, tx - l / 2, -1.9); K2.put(g, 'ff', 'idle', tx - l - 0.8, 1.4, tx - l / 2, 0);
      return { smokes: [[tx - 1, 1, 0]], closure: base(g, R, { len: 10, crowd: 5, crowdSide: -1 }) }; } },
    roll: { cars: [['Police_Sedan', 0], ['Firetruck', 8], ['Ambulance', 21]], props(g, at, R) { const c = car(), h = hOf(c); c.position.set(0, h, 0); c.rotation.set(0, rnd(-0.6, 0.6), Math.PI); g.add(c);
      medics(g, 2.4, 1.2); K2.put(g, 'ff', 'idle', -2.2, -1.5, 0, 0); K2.put(g, 'ff', 'talk', -2.6, 1.8, 0, 0);
      return { smokes: [[0, 0.5, 0.8]], closure: base(g, R, { len: 12, crowd: 7 }) }; } },
    pile: { props(g, at, R) { let z = -8; const cs = []; for (let k = 0; k < 4; k++) { const c = car(), l = lenOf(c); z += l / 2; c.position.set(R.hw * 0.4 + rnd(-0.4, 0.4), 0, z); c.rotation.y = rnd(-0.18, 0.18); g.add(c); cs.push([z, l]); z += l / 2 + 0.05; }   // броните се допират
      medics(g, -0.6, cs[1][0]); K2.put(g, 'ff', 'idle', -0.8, cs[2][0], R.hw * 0.4, cs[2][0]);
      return { smokes: cs.slice(0, 3).map(([zz, l]) => [R.hw * 0.4, 0.9, zz + l / 2 - 0.6]), closure: base(g, R, { len: 15, crowd: 8 }) }; } },
    carfire: { cars: [['Firetruck', 8], ['Police_Sedan', 20]], props(g, at, R) { const c = car(), soot = new THREE.MeshStandardMaterial({ color: 0x1c1b1a, roughness: 1, metalness: 0 }); c.traverse(m => { if (!m.isMesh) return; if ([].concat(m.material).some(q => q && q.transparent)) { m.visible = false; return; } m.material = Array.isArray(m.material) ? m.material.map(() => soot) : soot; }); g.add(c);   // изгоряла — опушена, без боята; без лъча на фаровете и стъклата (прозрачните)
      const f1 = K2.put(g, 'ff', 'idle', -2.6, -4.5, 0, 0), f2 = K2.put(g, 'ff', 'idle', 2.8, 4, 0, 0);   // от двете страни — струите се виждат
      return { smoke: [0, 2, 0], fire: [[0, 1.6, 0, 3.2], [1, 1.2, 0.8, 2.2]], hoses: [[f1, [0, 1, 0]], [f2, [0.6, 1, 0.4]]], wreck: c, tow: true, closure: base(g, R, { len: 12, crowd: 7 }) }; } },
    moto: { props(g, at, R) { const m = K2.moto() || moto(); m.position.set(1.2, 0, 0.3); m.rotation.y = rnd(0, 6.28); g.add(m);
      const p = K2.person('ped', 'idle', { lying: true }); p.position.set(-1.2, 0, 2.4); p.rotation.y = rnd(0, 6.28); g.add(p);
      medics(g, -1.2, 2.4); return { closure: base(g, R, { len: 9, cops: 1, crowd: 5 }) }; } },
    spill: { cars: [['Police_SUV', 0], ['Police_Sedan', 22]], props(g, at, R) { const t = car('Truck'); t.position.set(R.hw * 0.45, 0, 4); g.add(t); const cm = M(0x9a6b3c);
      for (let k = 0; k < 16; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(rnd(0.6, 1.1), rnd(0.5, 0.9), rnd(0.6, 1.1)), cm); b.position.set(rnd(-R.hw + 0.8, R.hw - 0.8), 0.35, rnd(-6, 0)); b.rotation.set(rnd(-0.3, 0.3), rnd(0, 6.28), rnd(-0.3, 0.3)); g.add(b); }
      K2.put(g, 'ped', 'argue', R.hw * 0.45 + 1.7, 5.5, 0, 0); return { closure: base(g, R, { len: 13, crowd: 4 }) }; } },
    bfire: { props(g, at, R) {   // огънят — В сградата: в прозорците на фасадата към улицата (0,5 м навътре) и на покрива; пожарникарите гасят от улицата
      const b = ctx.building && ctx.building(at.x, at.z), cl = base(g, R, { len: 14, crowd: 0 }); if (!b) return { smoke: [0, 3, 6], fire: [[0, 1.5, 6, 4]], closure: cl };
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, h = b.h, out = [[b.x0 - at.x, 'x0'], [at.x - b.x1, 'x1'], [b.z0 - at.z, 'z0'], [at.z - b.z1, 'z1']].sort((p, q) => q[0] - p[0])[0][1];
      const fp = f => out === 'x0' ? [b.x0 + 0.5, b.z0 + (b.z1 - b.z0) * f] : out === 'x1' ? [b.x1 - 0.5, b.z0 + (b.z1 - b.z0) * f] : out === 'z0' ? [b.x0 + (b.x1 - b.x0) * f, b.z0 + 0.5] : [b.x0 + (b.x1 - b.x0) * f, b.z1 - 0.5];
      const sz = Math.min(5, 1.8 + h * 0.08), fires = [[0.28, 0.35], [0.7, 0.55], [0.5, 0.78]].map(([f, y]) => { const [x, z] = fp(f); return [x, Math.max(1.4, h * y), z, sz]; });
      fires.push([cx, h - 0.3, cz, sz * 1.2]);
      const bl = g.worldToLocal(new THREE.Vector3(cx, 0, cz)), s = Math.sign(bl.x) || 1, f1 = K2.put(g, 'ff', 'idle', s * (R.hw - 0.6), -3, bl.x, bl.z), f2 = K2.put(g, 'ff', 'idle', s * (R.hw - 0.4), 3.5, bl.x, bl.z);
      K2.put(g, 'ff', 'talk', -s * 1, 6, 0, 0); K2.crowd(g, 7, -s * (R.hw + R.walk * 0.8), -9, 9, bl.x, bl.z);
      return { smokeW: [cx, h + 1, cz], fireW: fires, hosesW: [[f1, fires[0]], [f2, fires[1]]], closure: cl }; } },
    heart: { cars: [['Ambulance', 0], ['Police_Sedan', 11]], props(g, at, R) { const x = R.hw + R.walk * 0.5, v = K2.person('ped', 'idle', { lying: true }); v.position.set(x, 0, 0); v.rotation.y = Math.PI / 2; g.add(v);
      medics(g, x, 0); K2.put(g, 'cop', 'talk', x + 0.3, -3, x, 0); K2.put(g, 'ped', 'phone', x - 0.2, 3.2, x, 0);   // който се обади на 112
      const X0 = R.hw + 0.2, X1 = R.hw + R.walk + 1.6; return { closure: base(g, R, { pts: [[X0, -4.5], [X1, -4.5], [X1, 4.5], [X0, 4.5]], close: false, cops: 0, crowd: 4, crowdSide: -1, len: 5 }), open: true }; } },
    cat: { props(g, at, R) { const x = R.hw + R.walk * 0.55, t = tree(9); t.position.set(x, 0, 6); g.add(t);
      const cat = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), M(0xff9a30)); cat.position.set(x + 0.9, 6.6, 6); g.add(cat);
      K2.put(g, 'ff', 'idle', x - 1.6, 4.6, x, 6); K2.put(g, 'ff', 'talk', x - 1.2, 7.8, x, 6); for (let k = 0; k < 4; k++) K2.put(g, 'ped', k % 2 ? 'phone' : 'look', x - 3 + k * 1.3, 10.5 + rnd(-0.5, 0.5), x, 6);
      return { open: true }; } },
    gas: { cars: [['Police_Sedan', 0], ['Firetruck', 9], ['Police_SUV', 24]], props(g, at, R) { const mh = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 16), M(0x333333)); mh.position.y = 0.03; g.add(mh);
      K2.put(g, 'ff', 'idle', 1.6, 2.5, 0, 0); K2.put(g, 'ff', 'talk', -1.8, -2.2, 0, 0);
      return { smoke: [0, 0.2, 0], gas: true, closure: base(g, R, { len: 16, crowd: 8 }) }; } },
  };
  let lastHeavy = -1e9;
  function pickType(force) {
    if (force && TYPES[force]) return force;
    const now = performance.now() / 1000, ok = Object.entries(TYPES).filter(([, T]) => !T.heavy || now - lastHeavy > HEAVY_GAP);
    let x = Math.random() * ok.reduce((a, [, T]) => a + T.w, 0); for (const [k, T] of ok) { x -= T.w; if (x <= 0) return k; } return ok[0][0];
  }

  function start(force, at0) {   // at0 — мястото (иначе случайно около камерата)
    if (k2p && !K2 && !start.wait) { start.wait = 1; k2p.then(() => { start.wait = 0; start(force, at0); }); return { pending: true }; }   // incidents2: изчаква хората и моделите (първия път)
    clear();
    const type = pickType(typeof force === 'string' ? force : null), T = TYPES[type];
    let at = at0 || pickSpot(); if (!at) return null;
    if (T.chase) return startChase(at, !!force);
    if (type === 'bfire' && ctx.building) {   // пожар в сграда: първо сградата (близо до камерата), после улицата до нея
      const f = ctx.focus(), b = ctx.building(f.x, f.z, 400);   // най-близката сграда до 400 м (иначе огънят е на улицата)
      if (b) { const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; let bd = 1e18; for (let k = 0; k < 90; k++) { const p = ctx.point(); if (!p || (ctx.spotOk && !ctx.spotOk(p.x, p.z))) continue; const d = Math.hypot(p.x - cx, p.z - cz); if (d < bd) { bd = d; at = p; } } }
    }
    if (T.heavy) lastHeavy = performance.now() / 1000;
    const T2 = I2() && TYPES2[type], R = T2 && roadFrame(at);   // incidents2: в рамката на улицата
    if (R && R.x != null && type !== 'bfire' && feature('inc-roadframe')) at = { ...at, x: R.x, z: R.z };   // inc-roadframe (f6): мястото понякога беше до пешеходна алея (на тревата, рамката — напреки на истинската улица) → на платното
    if (R && type !== 'bfire') at = carriage(at, R);
    const g = new THREE.Group(); g.position.set(at.x, 0, at.z); g.rotation.y = R ? Math.atan2(R.dx, R.dz) : rnd(0, 6.28); ctx.scene.add(g); g.updateMatrixWorld(true);
    const fx = (T2 ? T2.props(g, at, R) : T.props(g, at)) || {};
    g.updateMatrixWorld(true);
    const W = v => new THREE.Vector3(...v).applyMatrix4(g.matrixWorld);
    const puffs = [], flames = [];
    if (fx.smoke || fx.smokeW) { const o = fx.smokeW ? new THREE.Vector3(...fx.smokeW) : W(fx.smoke); for (let k = 0; k < 8; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: fx.gas ? 0xcfe0c0 : fx.fire || fx.fireW ? 0x333333 : 0x777777, transparent: true, depthWrite: false, opacity: 0 })); s.userData.ph = k / 8; s.userData.o = o; s.userData.big = fx.fire || fx.fireW ? 1.8 : fx.gas ? 0.6 : 1; ctx.scene.add(s); puffs.push(s); } }
    for (const sp of fx.smokes || []) { const o = W(sp); for (let k = 0; k < 6; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x6a6a6a, transparent: true, depthWrite: false, opacity: 0 })); s.userData.ph = k / 6; s.userData.o = o; s.userData.big = 1; ctx.scene.add(s); puffs.push(s); } }   // incidents2: дим от няколко коли
    for (const f of [...(fx.fire || []).map(f => [W(f.slice(0, 3)), f[3]]), ...(fx.fireW || []).map(f => [new THREE.Vector3(...f.slice(0, 3)), f[3]])]) { const o = f[0]; for (let k = 0; k < 3; k++) { const s = feature('fire-real') ? flameSprite() : new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.userData.flip = feature('fire-real'); s.userData.o = o; s.userData.sz = f[1]; s.userData.ph = k * 2.1; ctx.scene.add(s); flames.push(s); } }
    const cars = [];
    const hoses = [...(fx.hoses || []).map(([p, t]) => [p, W(t)]), ...(fx.hosesW || []).map(([p, t]) => [p, new THREE.Vector3(t[0], t[1], t[2])])].filter(([p]) => p).map(([p, t]) => ({ p, t, s: K2.stream(ctx.scene) }));   // пожарникарите с маркучите
    ((T2 && T2.cars) || T.cars).forEach(([k, back], n) => {
      const [nm, sc] = vehName(k), home = feature('emerg-home') && ctx.station ? ctx.station(k, at) : null, st = home || pickStart(at); if (!nm || !st || !ctx.has(nm) && nm.startsWith('sf-')) return;   // #11: от участъка/болницата/пожарната, ако ги има
      const path = pathTo(st.x, st.z, at, back + 7); if (!path) return;
      const o = ctx.model(nm, sc); o.userData.beaconsOn = 1; o.userData.noSiren = 1;   // сирените ги пуска update() — според разстоянието до камерата
      o.position.set(st.x, 0, st.z); ctx.scene.add(o);
      cars.push({ home, o, x: st.x, z: st.z, yaw: 0, path, pi: 0, stage: 'go', delay: n * rnd(1.5, 4), kind: sirenKind(o) || { Firetruck: 'fire', Ambulance: 'ambulance' }[k] || (k === 'Truck' ? null : 'police') });
    });
    inc = { at, g, cars, puffs, flames, type, hold0: T.hold, t: 0, force: !!force, fx, hoses, R };
    return { x: Math.round(at.x), z: Math.round(at.z), cars: cars.length, type, nm: T.nm };
  }
  // #3: беглецът тръгва 120–300 м от мястото на ареста, минава през още една точка (по-дълго гонене) и спира в at; полицията — по същия път след него
  function startChase(at, force) {
    const st = pickStart(at); if (!st) return null; let mid = null;
    for (let k = 0; k < 40 && !mid; k++) { const p = ctx.point(); if (p && Math.hypot(p.x - at.x, p.z - at.z) > 120 && Math.hypot(p.x - at.x, p.z - at.z) < 330 && Math.hypot(p.x - st.x, p.z - st.z) > 120) mid = p; }
    const r1 = ctx.route(st.x, st.z, (mid || at).x, (mid || at).z), r2 = mid ? ctx.route(mid.x, mid.z, at.x, at.z) : [];
    const path = [...r1, ...r2.slice(1)].map(p => ({ x: p.x, z: p.z, ln: p.ln, rg: p.rg })); if (path.length < 2) return null;
    const R = I2() ? roadFrame(at) : null, g = new THREE.Group(); g.position.set(at.x, 0, at.z); ctx.scene.add(g);
    const cars = [], fo = car(); fo.position.set(st.x, 0, st.z); ctx.scene.add(fo);
    cars.push({ o: fo, x: st.x, z: st.z, yaw: Math.atan2(path[1].x - path[0].x, path[1].z - path[0].z), path, pi: 0, stage: 'go', delay: 0, kind: null, flee: true, spd: 16, dist: 0, lat: 0 });
    const n = 1 + ((Math.random() * 3) | 0);
    for (let k = 0; k < n; k++) { const [nm] = vehName(k === 1 ? 'Police_SUV' : 'Police_Sedan'); if (!nm) continue; const o = ctx.model(nm, 1); o.userData.beaconsOn = 1; o.userData.noSiren = 1; o.position.set(st.x, 0, st.z); o.visible = false; ctx.scene.add(o);
      cars.push({ o, x: st.x, z: st.z, yaw: cars[0].yaw, path: path.map(p => ({ ...p })), pi: 0, stage: 'go', delay: 2.2 + k * 1.7, kind: 'police', spd: 18, dist: 0, lat: 0, cop: k }); }
    if (cars.length < 2) { ctx.scene.remove(g); for (const c of cars) ctx.scene.remove(c.o); return null; }
    inc = { at, g, cars, puffs: [], flames: [], type: 'chase', hold0: TYPES.chase.hold, t: 0, force, fx: {}, hoses: [], R };
    ctx.started && ctx.started('chase', at);
    return { x: Math.round(at.x), z: Math.round(at.z), cars: cars.length, type: 'chase', nm: TYPES.chase.nm };
  }
  // #3: скоростта по пътя — беглецът изпреварва (насрещното платно) на моменти; полицаите го настигат, но не минават през колата пред себе си
  function chaseStep(rdt, dt) {
    const C = inc.cars, F = C[0], t = inc.t;
    if (F.stage === 'go') { const wp = F.path && F.path[Math.min(F.path.length - 1, F.pi + 8)], want = Math.sin(t * 0.55) > 0.55 && !(wp && wp.rg) && !(F.path && F.path[F.pi]?.rg) ? -2 * LANE : 0;   /* в кръстовището/кръговото — без изпреварване (не в острова) */ F.lat += (want - F.lat) * Math.min(1, rdt * 2.5); F.spd = 15 + 3 * Math.abs(Math.sin(t * 0.3)); }
    for (let k = 1; k < C.length; k++) { const c = C[k], ld = C[k - 1]; if (c.stage !== 'go' || c.delay > 0) continue; const gap = c.pi < ld.pi ? Math.hypot(ld.x - c.x, ld.z - c.z) : 0;   // по пътя (точките са на ~2 м): само зад колата пред себе си
      c.spd = Math.min(18.5, Math.max(0, gap - 7) / Math.max(dt, 1e-3));   // не по-близо от 7 м (и при голям кадър) c.lat += ((k % 2 && !c.path?.[Math.min(c.path.length - 1, c.pi + 6)]?.rg ? -1.2 : 0) - c.lat) * Math.min(1, rdt * 2);   // в лявата половина — вижда беглеца
      if (ld.stage !== 'go' && gap < 8.5 && c.spd < 0.5) { c.stage = 'hold'; c.path = null; if (c.cop === 1) { c.yaw += 0.5; c.o.rotation.y = c.yaw; } } }   // заклещват го; втората — накриво
    if (!inc.arrest && inc.hold !== undefined) arrest();
  }
  function arrest() {   // полицаите — до вратата на беглеца, той — до колата с ръце нагоре (incidents2: истинските хора; иначе — човечета)
    const F = inc.cars[0], g = inc.g; inc.arrest = true; g.position.set(F.x, 0, F.z); g.rotation.y = F.yaw; g.updateMatrixWorld(true);
    const cops = inc.cars.length - 1;
    if (K2) { K2.put(g, 'ped', 'argue', -2.1, 0.4, 0, 0); for (let k = 0; k < Math.max(2, cops); k++) K2.put(g, 'cop', k ? 'wave' : 'talk', -2.6 - (k % 2) * 1.2, -1.4 + k * 1.6, -2.1, 0.4); K2.crowd(g, 5, (inc.R ? inc.R.hw + inc.R.walk * 0.8 : 7), -8, 8, 0, 0); }
    else { const p = person(false, 0x222222); p.position.set(-2.1, 0, 0.4); g.add(p); for (let k = 0; k < Math.max(2, cops); k++) { const q = person(false, 0x1d3a7a); q.position.set(-2.8, 0, -1.4 + k * 1.6); g.add(q); } }
  }
  function clear() {
    if (!inc) return;
    ctx.scene.remove(inc.g); for (const c of inc.cars) ctx.scene.remove(c.o); for (const s of [...inc.puffs, ...inc.flames]) ctx.scene.remove(s);
    if (inc.wreckOn) ctx.scene.remove(inc.wreckOn); if (K2) K2.reset();
    inc = null;
  }
  function move(c, dt) {   // колкото път се пада за кадъра — и през няколко точки (иначе при малко кадри в секунда пълзят)
    let st = (c.spd ?? SPEED) * dt; const st0 = st;   // #3: преследването — своя скорост и отместване (изпреварване)
    while (c.path && st > 1e-4) {
      const wp = c.path[c.pi];
      let x2 = wp.x, z2 = wp.z;
      if (c.pi > 0) { const pv = c.path[c.pi - 1], dx = wp.x - pv.x, dz = wp.z - pv.z, l = Math.hypot(dx, dz) || 1, lo = (c.path[0].ln ? 0 : LANE) + (c.lat || 0);   /* ln — пътят е по лентите на трафика (вече вдясно) */ x2 += -dz / l * lo; z2 += dx / l * lo; }
      const dx = x2 - c.x, dz = z2 - c.z, d = Math.hypot(dx, dz);
      if (d <= st) { c.x = x2; c.z = z2; st -= d; if (++c.pi >= c.path.length) c.path = null; }
      else { c.x += dx / d * st; c.z += dz / d * st; st = 0; const w = Math.atan2(dx, dz); let dy = w - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); c.yaw += dy * Math.min(1, dt * 8); }
    }
    if (c.dist != null) c.dist += st0 - st;
    c.o.position.set(c.x, 0, c.z); c.o.rotation.y = c.yaw; spinWheels(c.o);   // fire-titan / fire-cyber (f6): колелата на моделите от Blender (wheel_*; другите коли — без промяна)
  }
  // пътната помощ (incidents2, горяща кола): идва след гасенето, спира пред останките, повдига ги отзад за 3 s и тръгва с тях
  function towStep(rdt, fireOn) {
    if (!inc.towC && inc.hold !== undefined && !inc.leave && fireOn <= 0.03) {
      const o = K2.tow(), st = pickStart(inc.at), wl = lenOf(inc.fx.wreck), path = o && st && pathTo(st.x, st.z, inc.at, -(wl / 2 + 2.83 + 0.6));   // спира отвъд останките — задницата му до тях
      if (!o || !path) { inc.towC = { done: true }; return; }
      o.position.set(st.x, 0, st.z); ctx.scene.add(o); inc.towC = { o, x: st.x, z: st.z, yaw: 0, path, pi: 0, stage: 'go', delay: 0, kind: null, wl }; inc.cars.push(inc.towC); return;
    }
    const c = inc.towC; if (!c || c.done || c.stage !== 'hold') return;
    const w = inc.fx.wreck;
    if (!c.load) { ctx.scene.attach(w); inc.wreckOn = w; const d = new THREE.Object3D(); d.position.set(0, 0.32, -(2.83 + c.wl / 2 - 0.35)); d.rotation.x = -0.1; c.o.add(d); c.o.updateMatrixWorld(true);
      c.load = { t: 0, p0: w.position.clone(), q0: w.quaternion.clone(), d }; }
    const Lo = c.load; Lo.t = Math.min(1, Lo.t + rdt / 3); const p1 = Lo.d.getWorldPosition(new THREE.Vector3()), q1 = Lo.d.getWorldQuaternion(new THREE.Quaternion()), u = Lo.t * Lo.t * (3 - 2 * Lo.t);
    w.position.lerpVectors(Lo.p0, p1, u); w.quaternion.slerpQuaternions(Lo.q0, q1, u);
    if (Lo.t >= 1) { c.o.attach(w); inc.wreckOn = null; c.done = true; }
  }
  let TS = 1;   // за тестовете (__dbg.incidentSpeed): по-бързо време на инцидента
  function update(dt, rdt) {
    dt *= TS; rdt *= TS;
    if (!inc) {
      if (!feature('incidents') || !ctx.ready()) return;
      if ((wait -= rdt) <= 0) { wait = rnd(...EVERY); start(); }
      return;
    }
    inc.t += rdt;
    // дим над ударените коли, докато има някой на място
    // дим и пламъци (пожарната ги гаси: след като пристигне, пламъците намаляват)
    const fireOn = !inc.cars.some(c => c.kind === 'fire') ? 1 : Math.max(0, 1 - (inc.hold0 - (inc.hold ?? inc.hold0)) / (inc.hold0 * 0.7));
    inc.puffs.forEach(s => { const ph = (inc.t * 0.25 + s.userData.ph) % 1, o = s.userData.o, b = s.userData.big; s.position.set(o.x + Math.sin(ph * 9) * 0.6 * b, o.y + ph * 9 * b, o.z + ph * 2); s.scale.setScalar((1.5 + ph * 5) * b); s.material.opacity = inc.leave || inc.towC?.load ? 0 : 0.55 * (1 - ph) * (inc.flames.length ? 0.4 + 0.6 * fireOn : 1); });
    inc.flames.forEach(s => { const o = s.userData.o, f = 0.75 + 0.25 * Math.sin(inc.t * 11 + s.userData.ph) * Math.sin(inc.t * 7.3 + s.userData.ph * 2); s.position.set(o.x + Math.sin(inc.t * 3 + s.userData.ph) * 0.2, o.y + (s.userData.ph % 2) * 0.3, o.z); if (s.userData.flip) { s.position.y -= s.userData.sz * 0.45; flameSize(s, s.userData.sz * (1.3 + 0.2 * f)); } else s.scale.set(s.userData.sz * f * 0.8, s.userData.sz * f * 1.25, 1); s.material.opacity = inc.leave ? 0 : fireOn; });
    // 🚨 incidents2: хората (близо до камерата), кордонът щом екипите пристигнат, маркучите докато гори, пътната помощ след гасенето
    if (inc.fx && K2) {
      const cam = ctx.cam && ctx.cam(); K2.update(dt, cam);
      if (inc.fx.closure) inc.fx.closure.visible = !inc.leave && inc.cars.some(c => c.stage === 'hold');
      const wet = !inc.leave && inc.hold !== undefined && fireOn > 0.04;
      for (const H of inc.hoses) { if (wet) { const a = H.p.getWorldPosition(new THREE.Vector3()), q = H.t; const d = Math.hypot(q.x - a.x, q.z - a.z) || 1; a.x += (q.x - a.x) / d * 0.6; a.z += (q.z - a.z) / d * 0.6; a.y = 1.2; H.s.set(a, q, Math.min(4, d * 0.18)); } H.s.update(dt, wet); }
      if (inc.fx.tow) towStep(rdt, fireOn);
    }
    // сирените: докато колите идват и стоят на място — щом камерата е близо (до ~200 м), на ~7 s свири една от тях (редуват се: линейка, пожарна, полиция)
    if (!inc.leave && ctx.cam && (inc.sT = (inc.sT ?? 0) - rdt) <= 0) {
      const cam = ctx.cam(), on = inc.cars.filter(c => c.kind && c.o.visible && (c.stage === 'go' || c.stage === 'hold'));
      if (on.length) { const c = on[(inc.sI = (inc.sI ?? -1) + 1) % on.length], d = Math.hypot(c.x - cam.x, c.z - cam.z, cam.y);
        inc.sT = playSiren(c.kind, c.o, d, 5) ? 7 : 1; }
    }
    if (inc.type === 'chase' && !inc.leave) chaseStep(rdt, dt);
    let gone = 0;
    for (const c of inc.cars) {
      if (c.delay > 0) { c.delay -= rdt; c.o.visible = c.delay <= 0; continue; }
      if (c.stage === 'go') {
        if (c.path) move(c, dt); else { c.stage = 'hold'; if (inc.type === 'jam') { c.o.position.x -= Math.cos(c.yaw) * 3.2; c.o.position.z += Math.sin(c.yaw) * 3.2; c.x = c.o.position.x; c.z = c.o.position.z; } }   // #28: полицейската — на бордюра, не в лентата
      } else if (c.stage === 'hold') {
        if (inc.cars.every(o => o.stage !== 'go') && inc.hold === undefined) inc.hold = inc.hold0 || HOLD;
      } else if (c.stage === 'leave') {
        if (c.wait > 0) c.wait -= rdt; else if (c.path) move(c, dt); else { c.stage = 'gone'; ctx.scene.remove(c.o); }
      }
      if (c.stage === 'gone') gone++;
    }
    if (inc.hold !== undefined && !inc.leave && (inc.hold -= rdt) <= 0 && (!inc.fx?.tow || !K2 || inc.towC?.done || inc.t > inc.hold0 + 150)) {   // с пътна помощ — след като натовари останките   // разотиват се — с малки паузи, всяка в своя посока
      inc.leave = true;
      inc.cars.forEach((c, n) => {
        c.o.userData.beaconsOn = 0;
        const to = c.home || pickStart(inc.at), path = to && ctx.route(c.x, c.z, to.x, to.z).map(p => ({ x: p.x, z: p.z, ln: p.ln, rg: p.rg }));
        c.stage = 'leave'; c.path = path && path.length ? path : null; c.pi = 0; c.wait = n * 3; c.spd = SPEED; c.lat = 0;
        if (c.flee) c.wait = inc.cars.length * 3;   // #3: колата на беглеца — последна (кара я полицай)
        if (!c.path) { c.stage = 'gone'; ctx.scene.remove(c.o); }
      });
      if (inc.type === 'chase') inc.g.visible = false; else setTimeout(() => { if (inc && inc.leave) inc.g.visible = false; }, 9000);   // #3: арестуваният е в полицейската кола   // следите от инцидента се махат малко след като тръгнат
    }
    if (inc.leave && gone === inc.cars.length) clear();
    if (inc && inc.t > (inc.hold0 || HOLD) + 240) clear();   // предпазно: ако някоя кола заседне
  }
  // за трафика в game.js: къде стоят/карат спешните коли и ударените — да ги заобикаля
  // incidents2: къде движението спира (traffic.js opts.blockers) — центърът на затворената улица, докато има екипи на място
  const blockers = () => !inc || inc.leave || !inc.fx || !inc.R || inc.fx.open || !inc.cars.some(c => c.stage === 'hold') ? [] : [blk()];
  // 🚧 traffic-gap: кордонът по улицата — r: от центъра до конусите и до най-далечната спряла спешна кола (+ 3 м), dx/dz — посоката на улицата, w — половината платно;
  // traffic.js спира колите пред него от двете страни (не в центъра), затваря пътеките наоколо и обръща чакащите дълго
  const blk = () => { const at = inc.at, R = inc.R; if (!feature('traffic-gap')) return { x: at.x, z: at.z };
    let r = R.blkL || 13; for (const c of inc.cars) if (c.stage === 'hold' && c.o.visible) r = Math.max(r, Math.abs((c.x - at.x) * R.dx + (c.z - at.z) * R.dz) + 4);
    return { x: at.x, z: at.z, r: Math.min(r, 45), dx: R.dx, dz: R.dz, w: R.hw + 1.2 }; };
  const obstacles = () => !inc ? [] : [...inc.cars.filter(c => c.stage !== 'gone' && c.o.visible).map(c => ({ x: c.x, z: c.z })), ...(inc.leave ? [] : [{ x: inc.at.x, z: inc.at.z }])];
  const movers = () => !inc ? [] : inc.cars.filter(c => c.stage === 'go' && c.o.visible).map(c => ({ x: c.x, z: c.z, yaw: c.yaw, l: 5, w: 2.4, em: !!c.kind }));   // идващите спешни коли (колите от трафика спират пред тях)
  const follow = () => inc && inc.type === 'chase' && !inc.leave ? { x: inc.cars[0].x, z: inc.cars[0].z } : null;   // #3: камерата след беглеца
  return { update, start, clear, obstacles, blockers, movers, follow, speed: k => { TS = k || 1; return TS; }, spot: () => inc && inc.at, frame: () => inc && inc.R ? { x: inc.at.x, z: inc.at.z, dx: inc.R.dx, dz: inc.R.dz, hw: inc.R.hw, type: inc.type } : null, types: () => Object.keys(TYPES), get active() { return inc && { t: Math.round(inc.t), type: inc.type, x: Math.round(inc.at.x), z: Math.round(inc.at.z), stages: inc.cars.map(c => c.stage), hold: inc.hold == null ? null : Math.round(inc.hold), cars: inc.cars.map(c => [c.stage, c.path ? c.path.length - c.pi : 0, Math.round(Math.hypot(c.x - inc.at.x, c.z - inc.at.z)), Math.round(c.delay || 0)]), tow: inc.towC ? (inc.towC.done ? 'done' : inc.towC.load ? 'load' : inc.towC.stage || '?') : null }; } };
}
