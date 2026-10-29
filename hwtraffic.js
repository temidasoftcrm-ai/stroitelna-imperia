// hwtraffic.js — коли и камиони по магистралата край града: по две ленти във всяка посока (аутобан — по четири).
// Всяка кола следи предната в своята лента (дистанция, плавно спиране) и я изпреварва по лявата лента, когато там е свободно
// отзад и отпред, после се прибира вдясно; ТИР-овете и автобусите са в дясната (бавна) лента и не изпреварват. Колите излизат от
// единия край и се връщат отначало от другия. Разнообразие: всички истински коли (sf-car-*), бусове, лимузина, полиция, автобуси, камиони.
// От време на време (на 25–70 s) по бързата лента профучава спешна кола с включени буркани — линейка, полиция или пожарна,
// понякога на колона (пожарна + полиция); сирената я пуска самият буркан (vehmodels.js), когато е близо до камерата.
// svc — крайпътният комплекс (highways.js serviceArea): някои коли в посока +x отбиват по асфалта — забавителна лента, отбивка, алея —
// спират на колонките (~10 s зареждане) или паркират на място на паркинга (20–60 s, после на заден), и се връщат по включването.
import * as THREE from 'three';
import { feature } from './lab/feature.js';
import { kidK } from './scale.js';   // детските коли (резервата) в истинския размер
import { createHwChase } from './hwchase.js';   // 🚔 hw-chase: гонка на магистралата (беглец, 3–4 полицейски, хеликоптер; катастрофа или задържане)
import { createHwIncidents } from './hwincidents.js';   // 🚧 hw-incidents: катастрофи/аварии по платната, полиция, конуси, отбиване

const CARS = ['sedan', 'suv', 'taxi', 'van', 'sedan-sports', 'suv-luxury', 'hatchback-sports', 'police'];
const TRUCKS = ['truck', 'truck-flat', 'truck-dump-red', 'truck-concrete-red'];
const SCALE = new Proxy({ 'truck-dump-red': 1.14, 'truck-concrete-red': 1.18,   /* строителният пакет: 7,0 / 7,2 м при мащаб 1 → 8 / 8,5 м (беше 0,62 → 4,4 м, детски) (55) */ 'sf-semi-0': 1, 'sf-semi-1': 1 }, { get: (o, k) => typeof k === 'string' && k.startsWith('sf-car-') ? 1 : o[k] });   // sf-* са вече в мащаба на града
// истинските: [име, тегло] — колкото по-голямо, толкова по-често
const REAL_CARS = [['Sedan', 5], ['Hatchback', 4], ['SUV', 4], ['Pickup', 2], ['Taxi', 2], ['Muscle', 2], ['Muscle_2', 2], ['Van', 3], ['Limousine', 0.4], ['Police_Sedan', 0.5], ['Police_SUV', 0.5]];
const A_MAX = 2.2, B_COMF = 3.2, T_HEAD = 1.2, S0 = 3;

// parent: групата на магистралата в града; model(name, scale); A: заредените модели
// zc: оста на магистралата (z в света); len: дължина по x; y: височина на платното
export function createHwTraffic(parent, model, A, zc, len, y = 0.92, ab = false, lift = null, svc = null, ramps = null) {   // ramps — изходите към града (highways.js cityRamps: пътищата в координатите на изгледа)   // lift(x) — надлезът над релсите (highways.js overLift)   // ab — аутобан: 4 ленти на посока
  const g = new THREE.Group(); parent.add(g);
  const list = [], half = len / 2, NL = ab ? 4 : 2, RIGHT = NL - 1;
  // посока +x (на изток) е откъм +z (дясно движение), −x е откъм −z; лента 0 = бърза (към разделителната ивица)
  const laneZ = (dir, lane) => ab ? zc + dir * (2 + 1.8 + lane * 3.6) : zc + dir * (6 + (lane ? 2.2 : -2.2));
  const lenOf = o => { o.updateMatrixWorld(true); const b = new THREE.Box3(); if (feature('hw-incidents')) o.traverse(m => { if (m.isMesh && !(m.material && m.material.transparent)) b.expandByObject(m); }); if (b.isEmpty()) b.setFromObject(o); const s = b.getSize(new THREE.Vector3()); return   /* hw-incidents: дължината без лъчите на фаровете (car-lights ги правеше ~13 м) — опашката е плътна, ударът — броня в броня */ Math.max(3.5, Math.min(20, Math.max(s.x, s.z))); };
  const realCars = REAL_CARS.filter(([n]) => A['sf-car-' + n]), wsum = realCars.reduce((t, [, w]) => t + w, 0);
  const pickCar = r => { let t = r * wsum; for (const [n, w] of realCars) { if ((t -= w) <= 0) return 'sf-car-' + n; } return 'sf-car-' + realCars[0][0]; };
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < (ab ? 64 : 44); k++) {   // потребителят: „повече движение по магистралата“ (беше 44 / 28)
    const truck = k % 3 === 0, bus = !truck && k % 7 === 3 && A['sf-car-Bus'], dir = k % 2 ? 1 : -1;
    const semis = feature('trucks-real') && A['sf-semi-0'] ? ['sf-semi-0', 'sf-semi-1', ...(A['sf-car-Truck'] ? ['sf-car-Truck'] : [])] : ['sf-car-Truck'];
    if (feature('truck-box') && A['sf-car-BoxTruck']) semis.push('sf-car-BoxTruck');   /* truck-box (T1): белият камион-фургон — един от 3–4 тежки */   /* №2: без детските TRUCKS */
    const coach = feature('hw-coach') && !truck && k % 5 === 2 && ['sf-coach-a', 'sf-coach-b'].filter(n => A[n]);   /* hw-coach (T2): междуградските автобуси на потребителя (Meshy) — по няколко във всяка посока */
    const names = (truck ? semis : coach && coach.length ? coach : bus ? ['sf-car-Bus'] : realCars.length ? [pickCar(rnd())] : []).filter(n => A[n]);   /* №2 (55): само истински коли — без детските CARS */   // модерните ТИР-ове (trucks-real)
    if (!names.length) continue;
    const n = names[(rnd() * names.length) | 0], o = model(n, /^sf-coach-/.test(n) ? 1 : SCALE[n] || kidK(n, 1.25));   /* автобусите — в метри */
    o.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    const heavy = truck || !!bus || /^sf-coach-/.test(n), lane = heavy ? RIGHT : (ab ? (k >> 1) % NL : (k % 4 < 2 ? 0 : 1)), v0 = heavy ? 15 + rnd() * 4 : 22 + rnd() * 10;
    const c = { o, dir, x: 0, lane, z: laneZ(dir, lane), v: v0 * 0.8, v0, L: lenOf(o), heavy, cool: 0 };
    g.add(o); list.push(c);
  }
  // начално разположение — без застъпване: във всяка лента подред, с дистанция
  { const by = new Map(); for (const c of list) { const k = c.dir + ':' + c.lane; (by.get(k) || by.set(k, []).get(k)).push(c); }
    for (const L of by.values()) { const step = len / L.length, off = rnd() * step; L.forEach((c, i) => { c.x = -half + off + i * step; c.o.position.set(c.x, y, c.z); }); } }
  // спешните коли: по един модел от вид, скрити, докато не дойде ред
  const EM = [['police', ['sf-car-Police_SUV', 'sf-car-Police_Sedan']], ['ambulance', ['sf-car-Ambulance']], ['fire', ['sf-car-Firetruck']]];
  const em = [];
  for (const [kind, ns] of EM) { const n = ns.find(x => A[x]); if (!n) continue; const o = model(n, SCALE[n] || kidK(n, 1.25)); o.visible = false; o.userData.beaconsOn = 1; o.position.y = y; g.add(o); em.push({ kind, o, on: false }); }
  let emT = 8 + Math.random() * 20;
  function emSend() {
    const free = em.filter(e => !e.on); if (!free.length) return;
    const dir = Math.random() < 0.5 ? 1 : -1, first = free[(Math.random() * free.length) | 0];
    const group = [first]; if (first.kind === 'fire' && Math.random() < 0.6) { const p = free.find(e => e.kind === 'police'); if (p) group.push(p); }   // пожарната — с полицейски ескорт
    group.forEach((e, i) => { e.on = true; e.dir = dir; e.x = -dir * (half + 6 + i * 14); e.v = 34 + Math.random() * 6; e.o.position.set(e.x, y, laneZ(dir, 0)); e.o.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; e.o.visible = true; e.o.userData.sirenOn = false; });
  }
  // разстоянието напред от a до b по посоката (с прехвърлянето от края в началото)
  const ahead = (a, b) => (((b.x - a.x) * a.dir) % len + len) % len;
  // предната кола в лента lane (по z — включително тези, които влизат/излизат от нея)
  const inLane = (q, lane, zl) => q.lane === lane || Math.abs(q.z - zl) < 2.4;   // в лентата: целта ѝ или физически в нея (и по средата на смяната — и в двете)
  function leaderIn(c, lane) { const zl = laneZ(c.dir, lane); let best = null, bd = 1e9; for (const q of list) { if (q === c || q.dir !== c.dir || q.s || q.away || !inLane(q, lane, zl)) continue; const d = ahead(c, q); if (d > 0.01 && d < bd) { bd = d; best = q; } } return best ? { q: best, gap: bd - (best.L + c.L) / 2 } : null; }
  function followerIn(c, lane) { const zl = laneZ(c.dir, lane); let best = null, bd = 1e9; for (const q of list) { if (q === c || q.dir !== c.dir || q.s || q.away || !inLane(q, lane, zl)) continue; const d = ahead(q, c); if (d > 0.01 && d < bd) { bd = d; best = q; } } return best ? { q: best, gap: bd - (best.L + c.L) / 2 } : null; }
  const freeLane = (c, lane, back = 22, front = 30) => { const l = leaderIn(c, lane), f = followerIn(c, lane); return (!l || l.gap > front) && (!f || f.gap > back + Math.max(0, f.q.v - c.v) * 2); };
  const idm = (c, ld) => { let a = A_MAX * (1 - Math.pow(c.v / (c.vl || c.v0), 4));   /* vl — ограничението около инцидента (hw-incidents) */ if (ld) { const dv = c.v - ld.q.v, ss = S0 + Math.max(0, c.v * T_HEAD + c.v * dv / (2 * Math.sqrt(A_MAX * B_COMF))); a -= A_MAX * Math.pow(ss / Math.max(0.5, ld.gap), 2); } return Math.max(-8, Math.min(A_MAX, a)); };

  // ---- крайпътният комплекс: пътят по асфалта (координати на изгледа x напреки, z по оста → света: x = z, z = zc − x)
  const W = (vx, vz) => [vz, zc - vx];
  const bays = feature('hw-gas2') ? [{ busy: null, dz: -1.8 }, { busy: null, dz: 6 }] : [{ busy: null, dz: -7 }, { busy: null, dz: 3 }], spaces = [];   // hw-gas2: до колонките, в лентата между островите (извън стълбовете)
  if (svc) for (let z = svc.z0 + 58; z <= svc.z1 - 58; z += 4) if (Math.abs(z - svc.zs) > 18) spaces.push({ z, busy: null });
  // гладка крива през точките (Катмул–Ром), точка на ~1 м
  function smooth(P) { const out = []; for (let i = 0; i < P.length - 1; i++) { const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)], n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]))); for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); } } out.push(P[P.length - 1]); return out; }
  const legOf = (P, o = {}) => { const pts = smooth(P), cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, cum, len: cum[cum.length - 1], ...o }; };
  function svcPlan(c) {
    const { xE, z0, z1, zs } = svc, aisle = xE - 19, inn = [[c.x, c.z], W(xE + 1.8, z0 + 2), W(xE - 2.3, z0 + 24), W(xE - 9.5, z0 + 44), W(aisle, z0 + 60)], out = z => [W(aisle, z), W(aisle, z1 - 60), W(xE - 9.5, z1 - 44), W(xE - 2.3, z1 - 24), W(xE + 1.8, z1 - 2), [z1 + 30, laneZ(1, RIGHT)]];
    const G2 = feature('hw-gas2'), bay = Math.random() < 0.75 && bays.find(b => !b.busy), sp = !bay && spaces.filter(q => !q.busy);   // hw-gas2: навесът е ~3 м — ТИР-овете не влизат
    if (bay) { bay.busy = c; const zb = zs + bay.dz; if (G2) { const zin = zs - 16, zo = zs + 17; return { res: bay, legs: [legOf([...inn, W(aisle - 3, zin - 8), W(xE - 30, zin), W(xE - 30, zb)], { stop: 10 + Math.random() * 10, slow: 5 }), legOf([W(xE - 30, zb), W(xE - 30, zo), W(aisle - 2, zo + 10), ...out(zo + 18)], { slow: 6 })] }; }   // hw-gas2: влиза и излиза право по лентата
      return { res: bay, legs: [legOf([...inn, W(aisle - 4, zb - 20), W(xE - 29, zb - 6), W(xE - 30, zb)], { stop: 8 + Math.random() * 5, slow: 5 }), legOf([W(xE - 30, zb), W(xE - 29, zb + 8), W(aisle - 2, zb + 20), ...out(zb + 28)], { slow: 6 })] }; }   /* колонката: ~10 s зареждане */
    if (sp && sp.length) { const q = sp[(Math.random() * sp.length) | 0]; q.busy = c; const za = q.z - 9;
      return { res: q, legs: [legOf([...inn, W(aisle, za), W(aisle - 12, q.z - 2), W(xE - 49, q.z)], { stop: 20 + Math.random() * 40, slow: 4 }), legOf([W(xE - 49, q.z), W(aisle - 12, q.z + 1), W(aisle - 2, q.z + 7)], { rev: true, slow: 2.5 }), legOf([W(aisle - 2, q.z + 7), W(aisle, q.z + 14), ...out(q.z + 20).slice(1)], { slow: 6 })] }; }
    return null;
  }
  function svcStep(c, dt) {
    const S = c.s, L = S.legs[S.i], rest = L.len - S.d;
    if (S.wait > 0) { S.wait -= dt; c.v = 0; if (S.wait <= 0) { S.i++; S.d = 0; if (S.i >= S.legs.length) return done(c); } return; }
    const last = S.i === S.legs.length - 1; let tv = S.i === 0 && S.d < 30 ? 14 : last && rest < 45 && !S.exit ? 20 : L.slow ?? 8;   /* забавителната лента / в комплекса / ускорителната лента */
    if (S.exit) tv = Math.min(S.d < 70 ? 16 : L.slow ?? 9, Math.sqrt(2 * 2.5 * Math.max(0, rest)) + 2);   // изходът към града — забавя към кръстовището
    if (last && rest < 30 && !S.exit) { const md = S.mdir || 1, ghost = { x: L.pts[L.pts.length - 1][0], dir: md, L: c.L, v: c.v, lane: RIGHT, z: laneZ(md, RIGHT) }; if (!freeLane(ghost, RIGHT, 25, 20)) tv = Math.min(tv, Math.sqrt(2 * 3 * Math.max(0, rest - 4))); }   /* включване — само в свободно място */
    if (L.stop || L.rev) tv = Math.min(tv, Math.sqrt(2 * 2.5 * Math.max(0, rest - 0.3)) + 0.3);   // спира плавно на колонката / в мястото
    { const h = c.o.rotation.y + (L.rev ? Math.PI : 0), fx = Math.sin(h), fz = Math.cos(h); for (const q of list) { if (q === c || !q.s) continue; const dx = q.x - c.x, dz = q.z - c.z, along = dx * fx + dz * fz, side = Math.abs(-dx * fz + dz * fx); if (along > 0 && along < (c.L + q.L) / 2 + 4 && side < 2.2) { tv = Math.min(tv, Math.max(0, (along - (c.L + q.L) / 2 - 1.5) * 0.8)); } } }   /* в комплекса — зад предната кола (и при включването една по една) */
    c.v += Math.sign(tv - c.v) * Math.min(Math.abs(tv - c.v), 3 * dt); S.d += c.v * dt;
    if (S.d >= L.len) { if (L.stop) { S.wait = L.stop; S.d = L.len; } else if (last && S.exit) return away(c); else if (last) { const md = S.mdir || 1, ghost = { x: L.pts[L.pts.length - 1][0], dir: md, L: c.L, v: 12, lane: RIGHT, z: laneZ(md, RIGHT) }; if (freeLane(ghost, RIGHT, 30, 20)) return done(c); S.d = L.len - 0.01; c.v = 0; } else { S.i++; S.d = 0; } }   /* края на ускорителната лента — включване само в свободно място, иначе чака */
    const L2 = S.legs[Math.min(S.i, S.legs.length - 1)], p = at(L2, Math.min(S.d, L2.len)), q = at(L2, Math.min(S.d + 1.5, L2.len)), q0 = at(L2, Math.max(0, S.d - 1.5));
    c.x = p[0]; c.z = p[1]; c.o.position.set(p[0], L2.ramp ? rampY(zc - p[1]) : y, p[1]); const dx = q[0] - q0[0], dz = q[1] - q0[1]; if (Math.hypot(dx, dz) > 0.05) c.o.rotation.y = Math.atan2(dx, dz) + (L2.rev ? Math.PI : 0);
    if (SM) pose(c, dt);   // truck-smooth
  }
  const at = (L, s) => { let i = 1; while (i < L.cum.length - 1 && L.cum[i] < s) i++; const a = L.pts[i - 1], b = L.pts[i], t = (s - L.cum[i - 1]) / ((L.cum[i] - L.cum[i - 1]) || 1); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
  function done(c) { const md = c.s.mdir || 1; if (c.s.res) c.s.res.busy = null; c.s = null; c.dir = md; c.lane = RIGHT; c.z = laneZ(md, RIGHT); c.o.rotation.y = md > 0 ? Math.PI / 2 : -Math.PI / 2; c.v = Math.max(c.v, 12); }
  // изходите към града: колата излиза по рампата и „влиза в града“ (скрива се); след малко се връща по някой от входовете
  // hw-interchanges (T2): ramps — един изход (както досега) или масив от изходи (по едно кръстовище на 2–3 км); RP/rampCx — първият (за hw-incidents)
  const RA = Array.isArray(ramps) ? ramps.filter(Boolean) : ramps ? [ramps] : [];
  const RPs = RA.map(R => ({ RP: Object.fromEntries(Object.entries(R).filter(([k]) => k !== 'xe').map(([k, P]) => [k, legOf(P.map(([vx, vz]) => W(vx, vz)), { slow: 9, ramp: true })])), cx: R.nearOff[0][1] - 330 }));
  const RP = RPs.length ? RPs[0].RP : null; ramps = RA[0] || null;
  const rampY = vx => { const t = Math.max(0, Math.min(1, (Math.abs(vx) - ramps.xe - 3) / 6)); return y + (0.25 - 0.95) * t * t * (3 - 2 * t); };   // като highways.js rampY: от насипа — до земята
  const rampCx = RPs.length ? RPs[0].cx : 0;
  // 🚛 truck-smooth (T1): наклон по истинския наклон на пътя (височината под предната и задната ос, изгладено), полуремаркето — на шарнира
  // на седлото (следва го със своята ос, със собствен наклон и завъртане), колелата се въртят; плавно престрояване (странична скорост с ускорение)
  const SM = feature('truck-smooth'), TQ = new THREE.Vector3();
  const hAt = (c, wx, wz) => { const L = c.s && c.s.legs[Math.min(c.s.i, c.s.legs.length - 1)]; return L ? (L.ramp ? rampY(zc - wz) : y) : y + (lift ? lift(wx) : 0); };
  const rigOf = c => { const S = c.o.userData.semi, W = []; c.o.traverse(m => { if (m.userData.wheelR) W.push(m); }); return { T: S ? c.o.getObjectByName('semi-trailer') : null, zf: S ? S.zf : (c.L || 4.5) * 0.32, zr: S ? S.zr : -(c.L || 4.5) * 0.32, zk: S ? S.zk : 0, D: S ? -S.za : 0, W }; };
  function pose(c, dt) {
    const o = c.o, R = c.rig || (c.rig = rigOf(c)), h = o.rotation.y, fx = Math.sin(h), fz = Math.cos(h), px = o.position.x, pz = o.position.z, k = Math.min(1, dt * 5);
    const hf = hAt(c, px + fx * R.zf, pz + fz * R.zf), hr = hAt(c, px + fx * R.zr, pz + fz * R.zr), tp = Math.atan2(hf - hr, R.zf - R.zr);
    c.pt = c.pt == null ? tp : c.pt + (tp - c.pt) * k; o.rotation.order = 'YXZ'; o.rotation.x = -c.pt; o.position.y = hr - R.zr * Math.sin(c.pt);   // задната ос — на платното
    for (const w of R.W) w.rotation.x += (c.v || 0) * dt / w.userData.wheelR;
    if (!R.T) return;
    const kx = px + fx * R.zk, kz = pz + fz * R.zk;   // седлото; оста на ремаркето го следва (теглене): A = K − посока(K − A)·D
    if (!c.ta || Math.hypot(kx - c.ta.x, kz - c.ta.z) > R.D * 1.5) c.ta = { x: kx - fx * R.D, z: kz - fz * R.D };
    TQ.set(kx - c.ta.x, 0, kz - c.ta.z).normalize(); c.ta.x = kx - TQ.x * R.D; c.ta.z = kz - TQ.z * R.D;
    let rel = Math.atan2(TQ.x, TQ.z) - h; rel = Math.max(-0.9, Math.min(0.9, Math.atan2(Math.sin(rel), Math.cos(rel))));
    const hk = o.position.y + R.zk * Math.sin(c.pt), ha = hAt(c, c.ta.x, c.ta.z), tq = Math.atan2(hk - ha, R.D); c.tpt = c.tpt == null ? tq : c.tpt + (tq - c.tpt) * k;
    R.T.rotation.set(-(c.tpt - c.pt), rel, 0, 'YXZ');
  }
  function away(c) { c.s = null; c.away = 6 + Math.random() * 20; c.o.visible = false; c.v = 0; }
  function comeBack(c) { const near = Math.random() < 0.5, R1 = RPs[(Math.random() * RPs.length) | 0].RP, L = near ? R1.nearOn : R1.farOn, p0 = L.pts[0]; if (list.some(q => q.s && Math.hypot(q.x - p0[0], q.z - p0[1]) < 12)) { c.away = 3; return; }
    c.away = 0; c.o.visible = true; c.x = p0[0]; c.z = p0[1]; c.v = 6; c.s = { legs: [L], i: 0, d: 0, wait: 0, mdir: near ? -1 : 1 }; }

  // 🚧 hw-incidents (hwincidents.js): ударените коли, спешните и „призраците“ (конусите) са в list с c.inc — движи ги инцидентът;
  // INC.need — задължително престрояване, INC.ok — не влиза в затворена лента, INC.vcap — бавно покрай мястото, c.rg — спасителният коридор
  const INC = feature('hw-incidents') ? createHwIncidents({ g, list, laneZ, NL, RIGHT, half, len, y, lift, ab, leaderIn, followerIn, freeLane, mk: n => model(n, SCALE[n] || kidK(n, 1.25)), A, lenOf, rampCx: RP ? rampCx : null, svc, em }) : null;
  const CH = feature('hw-chase') ? createHwChase({ g, list, laneZ, NL, RIGHT, half, len, y, lift, ab, model, A, lenOf, svc, rampCx: RP ? rampCx : null, inc: () => INC }) : null;   // 🚔 hw-chase (hwchase.js)
  function update(dt) {
    if (INC && !(CH && CH.busy && !INC.busy)) INC.update(dt);   /* hw-chase: по време на гонка — без нов инцидент */
    if (CH) CH.update(dt);
    for (const c of list) {
      if (c.inc) continue;
      if (c.away > 0) { c.away -= dt; if (c.away <= 0) comeBack(c); continue; }
      if (c.s) { svcStep(c, dt); continue; }
      const px = c.x, ld = leaderIn(c, c.lane);
      // изпреварване: по-бавен отпред — наляво, ако там е свободно; после — обратно вдясно
      c.cool -= dt;
      const mm = (INC || CH) && c.cool <= 0 && !c.rg && Math.abs(c.z - laneZ(c.dir, c.lane)) < 0.3 ? (INC && INC.need(c)) || (CH && CH.need(c)) || null : null;   /* hw-incidents: престрояване пред затворената лента („цип“) */
      if (mm) { if (freeLane(c, mm.l, mm.b, mm.f)) { c.lane = mm.l; c.cool = 1.5; } }
      else if (!c.heavy && c.cool <= 0 && Math.abs(c.z - laneZ(c.dir, c.lane)) < 0.3) {
        if (c.lane > 0 && ld && ld.gap < 45 && ld.q.v < c.v0 - 2.5 && freeLane(c, c.lane - 1) && (!INC || INC.ok(c, c.lane - 1)) && (!CH || CH.ok(c, c.lane - 1))) { c.lane--; c.cool = 4; }
        else if (c.lane < RIGHT && (!INC || INC.ok(c, c.lane + 1)) && (!CH || CH.ok(c, c.lane + 1)) && freeLane(c, c.lane + 1, 18, 45) && (!ld || ld.gap > 35 || ld.q.v > c.v0 - 1)) { c.lane++; c.cool = 6; }
      }
      let ld2 = leaderIn(c, c.lane); const zf = (c.z - laneZ(c.dir, 0)) / (laneZ(c.dir, 1) - laneZ(c.dir, 0)); for (const zc0 of INC || CH ? [Math.floor(zf), Math.ceil(zf)].filter(k => Math.abs(zf - k) < 0.6) : [Math.round(zf)]) if (zc0 !== c.lane && zc0 >= 0 && zc0 <= RIGHT) { const lo = leaderIn(c, zc0); if (lo && (!ld2 || lo.gap < ld2.gap)) ld2 = lo; }   /* при смяна — и предната в старата лента (hw-incidents: във всяка лента, в която е колата) */
      c.vl = INC ? INC.vcap(c) : 0; if (CH) { const v2 = CH.vcap(c); if (v2 && (!c.vl || v2 < c.vl)) c.vl = v2; }   /* hw-chase: колите пред гонката намаляват, покрай мястото — бавно */
      let a = idm(c, ld2), v = Math.max(0, c.v + a * dt), ds = v * dt;
      if (ld2) { const lim = Math.max(0, ld2.gap - 0.6); if (ds > lim) { ds = lim; v = Math.min(v, lim / Math.max(dt, 1e-3)); } }   // никога през предната
      c.v = v; c.x += c.dir * ds;
      // напреки: плавно към лентата (~1,8 м/с), леко завъртане по посоката
      const zt = laneZ(c.dir, c.lane) + (c.rg || 0); let dz = Math.sign(zt - c.z) * Math.min(Math.abs(zt - c.z), 1.8 * dt);
      if (SM) { const want = Math.max(-1.8, Math.min(1.8, (zt - c.z) * 1.4)); c.vz = (c.vz || 0) + Math.max(-1.6 * dt, Math.min(1.6 * dt, want - (c.vz || 0))); dz = c.vz * dt; }   // truck-smooth: странична скорост с ускорение — без рязко тръгване/спиране встрани
      c.z += dz;
      if (svc && c.dir > 0 && px < svc.z0 - 30 && c.x >= svc.z0 - 30 && c.lane === RIGHT && !c.heavy && Math.random() < 0.45 && list.filter(q => q.s).length < 5) {   // отбива
        const plan = svcPlan(c); if (plan) { c.s = { ...plan, i: 0, d: 0, wait: 0 }; continue; }
      }
      const dv = INC && INC.divert(c);   /* hw-incidents: платното е затворено — всички излизат (полицията отбива) */
      if (RP && c.lane === RIGHT && !c.s && (dv || list.filter(q => q.s || q.away).length < 7)) {   // излиза към града (по-рядко камионите)
        let ex = false; for (const X of RPs) { const T = X.cx - c.dir * 330; if ((px - T) * c.dir < 0 && (c.x - T) * c.dir >= 0 && Math.random() < (dv ? 1 : c.heavy ? 0.06 : 0.16)) { c.s = { legs: [c.dir < 0 ? X.RP.nearOff : X.RP.farOff], i: 0, d: 0, wait: 0, exit: true }; ex = true; break; } } if (ex) continue; }
      if (c.x > half) c.x -= len; else if (c.x < -half) c.x += len;
      c.o.position.set(c.x, y + (lift ? lift(c.x) : 0), c.z);
      c.o.rotation.y = (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) - c.dir * Math.atan2(dz / Math.max(dt, 1e-3), Math.max(3, c.v)) ;
      if (SM) pose(c, dt);   // truck-smooth
    }
    if (!em.length) return;
    if ((emT -= dt) <= 0) { if ((!INC || !INC.busy) && !(CH && CH.busy)) emSend(); emT = 25 + Math.random() * 45; }   /* по време на инцидент — без минаващи спешни */
    for (const e of em) if (e.on) {
      e.x += e.dir * e.v * dt; e.o.position.x = e.x; if (lift) e.o.position.y = y + lift(e.x); if (SM) pose(e, dt);   /* truck-smooth */
      for (const c of list) if (!c.s && !c.inc && (!INC || INC.ok(c, 1)) && c.dir === e.dir && c.lane === 0 && (c.x - e.x) * e.dir > 0 && (c.x - e.x) * e.dir < 40 && c.cool <= 0 && freeLane(c, 1, 10, 12)) { c.lane = 1; c.cool = 3; }   // колите отпред се отместват вдясно
      if (e.x * e.dir > half + 6) { e.on = false; e.o.visible = false; }
    }
  }
  // hw-gas2 (Лабораторията): една кола — веднага пред колонка (после стои 10–20 s и се връща по ускорителната лента)
  function svcForce() { if (!svc) return null; for (const c of list) { if (c.s || c.away > 0 || c.inc || c.heavy || c.dir < 0) continue;
      for (let k = 0; k < 6; k++) { const plan = svcPlan(c); if (!plan) break; if (plan.legs[0].stop) { c.s = { ...plan, i: 0, d: plan.legs[0].len - 0.4, wait: 0 }; c.lane = RIGHT; c.v = 1; return c; } plan.res.busy = null; } }
    return null; }
  return { update, svcForce, set visible(v) { g.visible = v; }, group: g, list, inc: INC, chase: CH };
}
