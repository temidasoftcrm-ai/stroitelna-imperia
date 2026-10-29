// citylife3.js — 🚏🚗 city-life3: животът около спирките и паркингите.
// 1) createStopLife — хора на трамвайните и автобусните спирки: стоят (оглеждат се, говорят по телефона, пушат), седят на пейката под навеса;
//    когато трамваят/автобусът спре — едни слизат (излизат от вратите на перона и си тръгват по тротоара/през платното), други се качват
//    (отиват до вратите и изчезват вътре); превозното средство чака, докато свършат (busy). Само спирките на ≤ 230 м от камерата са „живи“.
//    const L = createStopLife({ scene, ped() → { m, mixer, walk, idle, extra: [клипове], sit } | null, cam() → { x, z }, hour() → 0…24, sitY });
//    L.stop({ key, kind, x, z, ux, uz, a: [a0, a1], l: [l0, l1], face: [fx, fz] | null, seats: [{ x, z, yaw, y }], exits: [[[x, z], …]], cap });
//    const ev = L.arriveAt(kind, x, z, doors: [{ x, z, nx, nz }]) → null | { need } ; L.busy(ev); L.update(dt); L.clear(); L.info()
// 2) createLotLife — колите на паркинг идват от улицата и си отиват по прост път (улицата → входа → пътеката → мястото), по часа:
//    want(k, h) — дали мястото k е заето в час h. Пускат се една по една (без купчини), на заден от мястото; далеч от камерата — скрити и замразени;
//    при скок на часа (или щом паркингът пак влезе в обхвата) — направо в новото състояние. По желание: шофьорът отива до вратата (сутрин) и обратно.
//    const P = createLotLife({ parent, stalls: [{ x, z, yaw }], path(k) → [[x, z], …] (от улицата до мястото), car(k) → Object3D, want(k, h), hour(),
//      cam() → { x, z } (света), center: [x, z] (света), R, side (1 — дясно движение, −1 — ляво), person() → { obj, mixer, walk, idle } | null, door: [x, z], spin(obj) });
//    P.update(dt); P.info(); P.dispose()
import * as THREE from 'three';

// заетостта на паркинг на гара/летище по часа: денем (7–20 ч.) ~85%, нощем ~15%, плавно сутрин и вечер
export const lotOcc = h => h < 5 ? 0.15 : h < 7 ? 0.15 + 0.7 * (h - 5) / 2 : h < 20 ? 0.85 : h < 22.5 ? 0.85 - 0.7 * (h - 20) / 2.5 : 0.15;
const hourK = h => h < 5 ? 0.12 : h < 7 ? 0.6 : h < 9.5 ? 1 : h < 16 ? 0.6 : h < 19 ? 1 : h < 23 ? 0.45 : 0.15;
const angTo = (a, b, k) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * Math.min(1, k); };

export function createStopLife(o) {
  const stops = new Map(), people = [], evs = [], R_IN = 230, R_OUT = 290, CAP = 64, sitY = o.sitY ?? 0;
  const rnd = Math.random;
  function play(P, n) {
    let c = n === 'walk' ? P.walk : n === 'idle' ? P.idle : n === 'sit' ? P.sit : (P.extra || []).find(q => q.name === n); if (!c) c = P.idle || P.walk; if (!c || P.cur === c) return;
    const a = P.acts[c.name] || (P.acts[c.name] = P.mixer.clipAction(c)); if (P.curA) P.curA.fadeOut(0.3); a.reset().fadeIn(0.3).play(); if (n !== 'walk') a.time = rnd() * c.duration; P.curA = a; P.cur = c; }
  function mk(st) { if (people.length >= CAP) return null; const b = o.ped(); if (!b) return null; const P = { ...b, st, acts: {}, cur: null, curA: null, x: st.x, z: st.z, y: 0, yaw: 0, mode: '', path: null, pi: 0, sp: 1.2 + rnd() * 0.4, t: 0, seat: -1, ev: null }; people.push(P); return P; }
  function drop(P) { if (P.m.parent) P.m.parent.remove(P.m); P.mixer.stopAllAction(); P.mixer.uncacheRoot(P.m); const i = people.indexOf(P); if (i >= 0) people.splice(i, 1); if (P.st) { const j = P.st.wait.indexOf(P); if (j >= 0) P.st.wait.splice(j, 1); if (P.seat >= 0) P.st.used[P.seat] = null; } }
  const pose = P => { P.m.position.set(P.x, P.y + (P.st ? P.st.y : 0), P.z); P.m.rotation.y = P.yaw; };
  function stop(d) { const s = { y: 0, cap: 5, seats: [], exits: [], ...d, live: false, wait: [], used: (d.seats || []).map(() => null), refT: 2 + rnd() * 5, k: 0.7 + rnd() * 0.6 }; stops.set(d.key, s); return s; }
  const lat = st => [-st.uz, st.ux];
  function spot(st) { const n = lat(st); let best = null;
    for (let k = 0; k < 14; k++) { const a = st.a[0] + rnd() * (st.a[1] - st.a[0]), l = st.l[0] + rnd() * (st.l[1] - st.l[0]), x = st.x + st.ux * a + n[0] * l, z = st.z + st.uz * a + n[1] * l;
      best = [x, z]; if (!st.wait.some(P => Math.hypot(P.tx - x, P.tz - z) < 0.9)) break; }
    return best; }
  const faceOf = st => { const n = lat(st), f = st.face || (rnd() < 0.5 ? n : [-n[0], -n[1]]); return Math.atan2(f[0], f[1]) + (rnd() - 0.5) * 1.1; };
  function seatFree(st) { const fr = st.used.map((u, i) => u ? -1 : i).filter(i => i >= 0); return fr.length ? fr[(rnd() * fr.length) | 0] : -1; }
  function settle(P, snap) {   // на мястото си: седнал на пейката или прав на перона
    const st = P.st, si = P.sit && rnd() < 0.55 ? seatFree(st) : -1;   /* седналият клип още не е зареден — прав */
    if (si >= 0) { const S = st.seats[si]; st.used[si] = P; P.seat = si; P.tx = S.x; P.tz = S.z; P.tyaw = S.yaw; } else { const q = spot(st); P.tx = q[0]; P.tz = q[1]; P.tyaw = faceOf(st); }
    if (!st.wait.includes(P)) st.wait.push(P);
    if (snap) { P.x = P.tx; P.z = P.tz; P.yaw = P.tyaw; P.mode = 'wait'; P.t = 0; if (P.seat >= 0) { P.y = st.seats[P.seat].y - 0.46 + sitY; play(P, 'sit'); } else idle(P); pose(P); }
    else { P.mode = 'arrive'; P.path = [[P.tx, P.tz]]; P.pi = 0; play(P, 'walk'); } }
  function idle(P) { const r = rnd(), fem = P.fem; play(P, r < 0.45 ? 'idle' : r < 0.65 ? 'Look_Around' : r < 0.85 ? (fem ? 'Phone_Talk_F' : 'Phone_Talk_M') : 'Smoking'); P.t = 6 + rnd() * 10; }
  const target = st => Math.round(st.cap * st.k * hourK(o.hour()));
  function walk(P, dt) { const q = P.path[P.pi]; if (!q) return true; const dx = q[0] - P.x, dz = q[1] - P.z, d = Math.hypot(dx, dz), s = P.sp * dt;
    if (d > 0.05) P.yaw = angTo(P.yaw, Math.atan2(dx, dz), dt * 8); if (d <= s) { P.x = q[0]; P.z = q[1]; P.pi++; return P.pi >= P.path.length; } P.x += dx / d * s; P.z += dz / d * s; return false; }
  // идва отдалеч (обратно по път за излизане) — до свободно място
  function incoming(st) { const ex = st.exits[(rnd() * st.exits.length) | 0]; if (!ex) return; const P = mk(st); if (!P) return; const p0 = ex[ex.length - 1]; P.x = p0[0]; P.z = p0[1]; P.yaw = 0;
    settle(P, false); P.path = [...ex.slice(0, -1).reverse(), [P.tx, P.tz]]; P.pi = 0; o.scene.add(P.m); pose(P); }
  function arriveAt(kind, x, z, doors) {
    let st = null, bd = 24; for (const s of stops.values()) if (s.kind === kind) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; st = s; } }
    if (!st || !st.live || !doors.length) return null;
    const ev = { st, doors, left: Math.round((1 + rnd() * 3.5) * Math.max(0.35, hourK(o.hour()))), t: 0.6, n: 0 }; evs.push(ev);
    const dIn = D => [D.x - D.nx * 0.5, D.z - D.nz * 0.5], dOut = D => [D.x + D.nx * 0.9, D.z + D.nz * 0.9];
    let nb = 0; for (const P of [...st.wait]) { if (P.mode !== 'wait' && P.mode !== 'arrive') continue; if (rnd() > 0.72) continue;
      let D = doors[0], dd = 1e9; for (const q of doors) { const d = Math.hypot(q.x - P.x, q.z - P.z); if (d < dd) { dd = d; D = q; } }
      st.wait.splice(st.wait.indexOf(P), 1); if (P.seat >= 0) { st.used[P.seat] = null; P.seat = -1; }
      P.mode = 'board'; P.ev = ev; P.t = 0.3 + rnd() * 1.4 + (P.y > 0.01 ? 0.6 : 0); P.path = [dOut(D), dIn(D)]; P.pi = 0; nb++; }
    ev.need = 4 + Math.max(nb * 0.9, ev.left * 0.9); ev.dIn = dIn; ev.dOut = dOut; return ev; }
  const busy = ev => !!ev && ev.st.live && (ev.left > 0 || people.some(P => P.ev === ev && (P.mode === 'board' || (P.mode === 'alight' && P.pi < 1))));
  function alight(ev) { const st = ev.st, D = ev.doors[ev.n++ % ev.doors.length], P = mk(st); if (!P) return; const a = ev.dIn(D), b = ev.dOut(D); P.x = a[0]; P.z = a[1]; P.yaw = Math.atan2(D.nx, D.nz);
    let ex = null, ed = 1e9; for (const e of st.exits) { const d = Math.hypot(e[0][0] - b[0], e[0][1] - b[1]) + rnd() * 6; if (d < ed) { ed = d; ex = e; } }
    P.mode = 'alight'; P.ev = ev; P.path = [b, ...(ex || [[b[0] + D.nx * 6, b[1] + D.nz * 6]])]; P.pi = 0; play(P, 'walk'); o.scene.add(P.m); pose(P); }
  function update(dt) {
    if (!dt) return; const c = o.cam(); if (!c) return;
    for (const st of stops.values()) { const d = Math.hypot(st.x - c.x, st.z - c.z);
      if (!st.live && d < R_IN) { const P0 = mk(st); if (!P0) continue; st.live = true; settle(P0, true); o.scene.add(P0.m); const n = Math.max(1, target(st)); for (let k = 1; k < n; k++) { const P = mk(st); if (!P) break; settle(P, true); o.scene.add(P.m); } }   // минувачите още не са заредени — пак по-късно
      else if (st.live && d > R_OUT) { st.live = false; for (const P of people.filter(q => q.st === st)) drop(P); }
      if (st.live && (st.refT -= dt) <= 0) { st.refT = (5 + rnd() * 10) / Math.max(0.3, hourK(o.hour())); if (st.wait.length < target(st)) incoming(st); } }
    for (let i = evs.length - 1; i >= 0; i--) { const ev = evs[i]; if (!ev.st.live) { evs.splice(i, 1); continue; } if (ev.left > 0 && (ev.t -= dt) <= 0) { ev.left--; ev.t = 0.7 + rnd() * 0.5; alight(ev); } if (ev.left <= 0 && !people.some(P => P.ev === ev)) evs.splice(i, 1); }
    for (const P of [...people]) {
      P.mixer.update(dt);
      if (P.mode === 'wait') { if (P.seat < 0 && (P.t -= dt) <= 0) idle(P); P.yaw = angTo(P.yaw, P.tyaw, dt * 3); pose(P); continue; }
      if (P.mode === 'arrive') { if (walk(P, dt)) { P.mode = 'wait'; if (P.seat >= 0) { P.y = P.st.seats[P.seat].y - 0.46 + sitY; P.yaw = P.tyaw; play(P, 'sit'); } else idle(P); } pose(P); continue; }
      if (P.mode === 'board') { if (P.t > 0) { P.t -= dt; if (P.t <= 0) { P.y = 0; play(P, 'walk'); } else continue; } if (walk(P, dt)) { drop(P); continue; } pose(P); continue; }
      if (P.mode === 'alight') { if (walk(P, dt)) { drop(P); continue; } pose(P); }
    }
  }
  function clear() { for (const P of [...people]) drop(P); evs.length = 0; for (const st of stops.values()) { st.live = false; st.wait.length = 0; st.used.fill(null); } }
  function removeKind(kind) { for (const P of [...people]) if (P.st && P.st.kind === kind) drop(P); for (const [k, s] of [...stops]) if (s.kind === kind) stops.delete(k); for (let i = evs.length - 1; i >= 0; i--) if (evs[i].st.kind === kind) evs.splice(i, 1); }
  const info = () => ({ stops: stops.size, live: [...stops.values()].filter(s => s.live).length, people: people.length, waiting: people.filter(P => P.mode === 'wait').length, sitting: people.filter(P => P.mode === 'wait' && P.seat >= 0).length, board: people.filter(P => P.mode === 'board').length, alight: people.filter(P => P.mode === 'alight').length, arrive: people.filter(P => P.mode === 'arrive').length, evs: evs.length });
  return { stop, arriveAt, busy, update, clear, removeKind, info, stops: () => [...stops.values()], people: () => people };
}

export function createLotLife(o) {
  const g = new THREE.Group(); g.name = 'lotLife'; o.parent.add(g);
  let seed = ((o.seed || 11) % 2147483646) + 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const side = o.side || 1, R = o.R || 340, cars = [], walkers = [];
  const offPath = (pts, k) => {   // дясната лента; точката пред мястото и самото място — без отместване
    const n = pts.length, out = []; for (let i = 0; i < n; i++) { if (i >= n - 2) { out.push(pts[i].slice()); continue; }
      const a = pts[Math.max(0, i - 1)], b = pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, off = k * side; out.push([pts[i][0] - dz / l * off, pts[i][1] + dx / l * off]); }
    return out; };
  const cum = P => { const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return L; };
  const at = (c, s) => { const P = c.P, L = c.L; let i = 1; while (i < L.length - 1 && L[i] < s) i++; const a = P[i - 1], b = P[i], t = Math.max(0, Math.min(1, (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1))); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[0] - a[0], b[1] - a[1]), i]; };
  o.stalls.forEach((S, k) => { const obj = o.car(k); if (!obj) return; obj.visible = false; g.add(obj); const pts = o.path(k); if (!pts || pts.length < 2) { g.remove(obj); return; }
    const P = offPath(pts, o.lane ?? 1.5); cars.push({ k, S, obj, P, L: cum(P), T: 0, st: 'out', s: 0, v: 0, hold: 0, yaw: S.yaw ?? 0 }); });
  for (const c of cars) c.T = c.L[c.L.length - 1];
  const park = c => { c.st = 'in'; c.obj.visible = true; c.obj.position.set(c.S.x, c.S.y || 0, c.S.z); c.obj.rotation.y = c.yaw = c.S.yaw ?? c.yaw; };
  const gone = c => { c.st = 'out'; c.obj.visible = false; };
  let lastH = null, far = true, gap = 0, chk = 0;
  function person(from, to, then) { const b = o.person && o.person(); if (!b) { then && then(); return; } g.add(b.obj); const w = { ...b, x: from[0], z: from[1], path: to, pi: 0, then }; if (b.walk) b.mixer.clipAction(b.walk).play(); b.obj.position.set(w.x, 0, w.z); walkers.push(w); }
  const dropW = w => { g.remove(w.obj); w.mixer.stopAllAction(); walkers.splice(walkers.indexOf(w), 1); };
  function update(dt) {
    if ((chk -= dt) <= 0) { chk = 0.5; const c = o.cam(); const C = typeof o.center === 'function' ? o.center() : o.center, f2 = !c || Math.hypot(c.x - C[0], c.z - C[1]) > R; if (f2 !== far) { far = f2; g.visible = !far; if (!far) lastH = null; } }
    if (far) return;
    const h = o.hour();
    const dh = ((h - (lastH ?? h) + 36) % 24) - 12, jump = lastH == null || Math.abs(dh) > 0.4; lastH = h;   // скок на часа (> 0,4 ч) или пак в обхвата — направо
    if (jump) { for (const w of [...walkers]) dropW(w); for (const c of cars) { if (o.want(c.k, h)) park(c); else gone(c); } return; }
    gap -= dt;
    for (const c of cars) { const w = o.want(c.k, h);
      if (gap <= 0 && c.st === 'out' && w) { c.st = 'arr'; c.s = 0; c.v = 5; c.hold = 0; c.obj.visible = true; c.obj.position.set(c.P[0][0], 0, c.P[0][1]); c.obj.rotation.y = Math.atan2(c.P[1][0] - c.P[0][0], c.P[1][1] - c.P[0][1]); gap = 1.4 + rnd() * 1.6; }
      else if (gap <= 0 && c.st === 'in' && !w) { gap = 1.4 + rnd() * 1.6; if (o.door) { c.st = 'call'; person(o.door, [[c.S.x + Math.cos(c.yaw) * 1.6, c.S.z - Math.sin(c.yaw) * 1.6]], () => { c.st = 'dep'; c.s = c.T; c.v = 0; c.hold = 0; }); } else { c.st = 'dep'; c.s = c.T; c.v = 0; c.hold = 0; } } }
    const mv = cars.filter(c => c.st === 'arr' || c.st === 'dep');
    for (const c of mv) {
      const dir = c.st === 'arr' ? 1 : -1, rev = dir < 0 && c.s > c.L[c.L.length - 2];   // на заден от мястото
      const [x, z, hd] = at(c, c.s), fy = rev ? c.yaw : dir > 0 ? hd : hd + Math.PI, fx = Math.sin(fy) * (rev ? -1 : 1), fz = Math.cos(fy) * (rev ? -1 : 1);
      let block = false; if (c.hold < 4) for (const q of mv) { if (q === c) continue; const dx = q.obj.position.x - x, dz = q.obj.position.z - z, f = dx * fx + dz * fz; if (f > 0.5 && f < 8 && Math.abs(dx * fz - dz * fx) < 1.7) { block = true; break; } }
      const left = dir > 0 ? c.T - c.s : c.s, vmax = left < 10 || rev ? 2.6 : (o.v || 8);
      if (block) { c.v = 0; c.hold += dt; } else { c.hold = 0; c.v = Math.min(vmax, c.v + 3 * dt); c.s += dir * c.v * dt; }
      if (dir > 0 && c.s >= c.T) { park(c); if (o.door) person([c.S.x + Math.cos(c.yaw) * 1.6, c.S.z - Math.sin(c.yaw) * 1.6], [o.door]); continue; }
      if (dir < 0 && c.s <= 0) { gone(c); continue; }
      const [x2, z2, h2] = at(c, c.s); c.obj.position.set(x2, 0, z2); const want = rev ? c.yaw : dir > 0 ? h2 : h2 + Math.PI; c.obj.rotation.y = angTo(c.obj.rotation.y, want, dt * 5); if (!rev) c.yaw = c.st === 'dep' ? c.yaw : c.obj.rotation.y; if (o.spin) o.spin(c.obj); }
    for (const w of [...walkers]) { w.mixer.update(dt); const q = w.path[w.pi]; if (!q) { dropW(w); if (w.then) w.then(); continue; } const dx = q[0] - w.x, dz = q[1] - w.z, d = Math.hypot(dx, dz), s = 1.35 * dt;
      if (d <= s) { w.x = q[0]; w.z = q[1]; w.pi++; } else { w.x += dx / d * s; w.z += dz / d * s; w.obj.rotation.y = Math.atan2(dx, dz) + (o.personFlip ? Math.PI : 0); } w.obj.position.set(w.x, 0, w.z); }
  }
  const info = () => ({ cars: cars.length, in: cars.filter(c => c.st === 'in').length, arr: cars.filter(c => c.st === 'arr').length, dep: cars.filter(c => c.st === 'dep' || c.st === 'call').length, walkers: walkers.length, far, mv: cars.filter(c => c.st === 'arr' || c.st === 'dep').map(c => [c.st, Math.round(c.s), Math.round(c.T)]) });
  return { group: g, update, info, cars, dispose() { for (const w of [...walkers]) dropW(w); o.parent.remove(g); } };
}
