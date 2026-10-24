// schoolbus.js — училищният автобус (backlog 25.10 №7, флаг school-bus): сутрин в 7 ч. тръгва от жилищните квартали, събира децата
// и ги оставя пред училищата; в 13 ч. — обратно (децата се качват пред училището и слизат в кварталите). Кара в трафика като агент
// (junction-paths, като citybus.js); пред училището стои ~15 s, в квартала ~8 s. Денонощието в играта е ~72 s — всеки курс се кара докрай.
// createSchoolBus(deps) → { update(dt), clear(), state(), start(kind) }
//   deps.agents() → null | jpAgents; deps.lanes(); deps.hour() → 0..24; deps.schools() → [{ x, z }] (координатите на плана);
//   deps.homes() → [{ x, z }] — застроени парцели; deps.center() → { x, z }; deps.bus() → THREE.Object3D | null; deps.n() → брой автобуси;
//   deps.kid() → { obj, tick(dt), walk(on) } | null — дете (истински пешеходец, смален); deps.side — +1 дясно движение, -1 ляво
import * as THREE from 'three';

const DW_SCHOOL = 15, DW_HOME = 8, KID_V = 1.4;

export function createSchoolBus(deps) {
  let A = null, buses = [], kids = [], lastH = null, DBG = {};
  // спирката: най-близката лента (не в пръстена, не вход/изход на града) до точката; s — проекцията ѝ
  function stopAt(pt, lanes) {
    let best = null, bd = 1e9;
    for (const p of lanes) { const P = p.pts; let acc = 0;
      for (let k = 1; k < P.length; k++) { const a = P[k - 1], b = P[k], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1e-6, t = Math.max(0, Math.min(1, ((pt.x - a[0]) * dx + (pt.z - a[1]) * dz) / (l * l))), d = Math.hypot(a[0] + dx * t - pt.x, a[1] + dz * t - pt.z);
        if (d < bd) { const s = acc + l * t; if (s > 8 && s < p.len - 8) { bd = d; best = { p, s, x: pt.x, z: pt.z, d }; } } acc += l; } }
    return best;
  }
  // курсът: сутрин — квартали → училища; следобед — училища → квартали. Кварталите — 3 застроени парцела, далеч от училищата и един от друг
  function plan(kind, k = 0) {
    const L = deps.lanes().filter(l => l.kind === 'lane' && l.ring == null && !l.enter && !l.leave && l.len >= 30 && l.laneI === (l.nLanes || 1) - 1);
    const S = deps.schools(); DBG.sch = S.length; DBG.lanes = L.length; if (!S.length || !L.length) return null;
    const H = deps.homes(), far = h => Math.min(...S.map(s => Math.hypot(s.x - h.x, s.z - h.z))), picked = [];
    const cand = H.filter(h => far(h) > 120).sort(() => Math.random() - 0.5);
    for (const h of cand) { if (picked.length >= 3) break; if (picked.every(q => Math.hypot(q.x - h.x, q.z - h.z) > 90)) picked.push(h); }
    const C = deps.center(), ang = q => Math.atan2(q.z - C.z, q.x - C.x); picked.sort((a, b) => ang(a) - ang(b));
    const sch0 = [...S].sort((a, b) => ang(a) - ang(b)), sch = [...sch0.slice(k % sch0.length), ...sch0.slice(0, k % sch0.length)].slice(0, 4);   // вторият автобус — от друго училище
    const homes = picked.map(h => stopAt(h, L)).filter(Boolean).map(s => ({ ...s, school: false })), schools = sch.map(h => stopAt(h, L)).filter(Boolean).map(s => ({ ...s, school: true }));
    DBG.homes = homes.length; DBG.sstops = schools.length; if (!schools.length) return null;
    return kind === 'am' ? [...homes, ...schools] : [...schools, ...homes];
  }
  function spawn(kind, k) {
    const stops = plan(kind, k); if (!stops || stops.length < 2) { DBG.err = 'няма спирки'; return; }
    const st = stops[0]; if (!A.free(st.p, st.s, 14)) { DBG.err = 'спирката е заета'; return; }
    const obj = deps.bus(); if (!obj) { DBG.err = 'няма модел'; return; }
    A.group.add(obj); const b = new THREE.Box3().setFromObject(obj), len = Math.max(5, b.max.z - b.min.z), w = Math.max(2, b.max.x - b.min.x);
    const bus = { obj, kind, stops, i: 0, st: 'dwell', t: (st.school ? DW_SCHOOL : DW_HOME) + k * 4, k, onboard: 0 };
    bus.c = A.add({ obj, len, w, h: 3, kind: 'bus', name: 'Училищен автобус', route: { paths: [st.p], s0: st.s, s1: st.s, len: 0 }, onArrive: () => { if (bus.st === 'go') { bus.st = 'dwell'; arrived(bus); } } });
    buses.push(bus); arrived(bus);
  }
  // на спирката: сутрин в квартала децата се качват, пред училището слизат; следобед — обратно
  function arrived(bus) {
    const sp = bus.stops[bus.i]; bus.t = sp.school ? DW_SCHOOL : DW_HOME;
    const boarding = bus.kind === 'am' ? !sp.school : sp.school, n = boarding ? 3 + ((Math.random() * 4) | 0) : Math.min(bus.onboard, 4 + ((Math.random() * 4) | 0));
    if (boarding) bus.onboard += n; else bus.onboard -= n;
    const c = bus.c, yaw = c.yaw, side = deps.side || 1, rx = -Math.cos(yaw) * side, rz = Math.sin(yaw) * side;   // към тротоара (вдясно при дясно движение)
    const door = { x: c.x + rx * 1.6 + Math.sin(yaw) * 1.5, z: c.z + rz * 1.6 + Math.cos(yaw) * 1.5 }, curb = { x: c.x + rx * 6, z: c.z + rz * 6 };
    const away = { x: sp.x, z: sp.z }, dA = Math.hypot(away.x - curb.x, away.z - curb.z), tgt = dA > 25 ? { x: curb.x + (away.x - curb.x) / dA * 25, z: curb.z + (away.z - curb.z) / dA * 25 } : away;   // към училището/вкъщи (до 25 м от тротоара)
    for (let k = 0; k < n; k++) { const K = deps.kid(); const a = boarding ? { x: tgt.x + (Math.random() - 0.5) * 4, z: tgt.z + (Math.random() - 0.5) * 4 } : door, b = boarding ? door : { x: tgt.x + (Math.random() - 0.5) * 5, z: tgt.z + (Math.random() - 0.5) * 5 };
      if (K) { K.obj.position.set(a.x, 0, a.z); K.obj.visible = false; A.group.add(K.obj); } kids.push({ K, a, b, mid: curb, t: -k * 0.7 - (boarding ? 0 : 0.8), leg: 0 }); }   // K = null — пешеходците още се зареждат (опитва пак)
  }
  function kidStep(dt) {   // дете: a → тротоарът → b, после изчезва (в автобуса / в училището)
    for (let i = kids.length - 1; i >= 0; i--) { const q = kids[i]; q.t += dt; if (q.t < 0) continue;
      if (!q.K) { if (q.t > 20) { kids.splice(i, 1); continue; } q.K = deps.kid(); if (!q.K) continue; q.K.obj.position.set(q.a.x, 0, q.a.z); q.K.obj.visible = false; A.group.add(q.K.obj); }
      const o = q.K.obj; if (!o.visible) { o.visible = true; q.K.walk(true); }
      const to = q.leg === 0 ? q.mid : q.b, dx = to.x - o.position.x, dz = to.z - o.position.z, d = Math.hypot(dx, dz), st = KID_V * dt;
      if (d <= st) { o.position.set(to.x, 0, to.z); if (q.leg++ >= 1) { o.removeFromParent(); kids.splice(i, 1); continue; } } else { o.position.x += dx / d * st; o.position.z += dz / d * st; o.rotation.y = Math.atan2(dx, dz); }
      q.K.tick(dt); }
  }
  function update(dt) {
    const a = deps.agents(); if (!a) { if (A) clear(); return; }
    if (a !== A) { clear(); A = a; deps.prep && deps.prep(); }   // децата — истинските пешеходци (зареждат се отрано)
    const h = deps.hour(); if (lastH != null) { for (const [hh, kind] of [[7, 'am'], [13, 'pm']]) if (lastH < hh && h >= hh && !buses.some(b => b.kind === kind)) start(kind); } lastH = h;
    kidStep(dt);
    for (let j = buses.length - 1; j >= 0; j--) { const bus = buses[j];
      if (!A.alive(bus.c)) { bus.obj.removeFromParent(); buses.splice(j, 1); continue; }
      if (bus.st !== 'dwell' || (bus.t -= dt) > 0) continue;
      if (bus.i >= bus.stops.length - 1) { A.remove(bus.c); bus.obj.removeFromParent(); buses.splice(j, 1); continue; }   // последната спирка — курсът свърши (автобусът се прибира)
      const c = bus.c; let ok = false;
      for (let k = 1; bus.i + k < bus.stops.length && !ok; k++) { const to = bus.stops[bus.i + k], r = A.route({ p: c.p, s: c.s }, { p: to.p, s: to.s }, true, { anyFrom: true, hop: true });
        if (r && r.len > 15 && (r.paths[0] === c.p || A.laneTo(c, r.paths[0])) && A.retarget(c, r)) { bus.i += k; bus.st = 'go'; bus.fail = 0; ok = true; } }   // недостижимата спирка се прескача
      if (!ok) { bus.t = 3; if ((bus.fail = (bus.fail || 0) + 1) > 8) { A.remove(c); bus.obj.removeFromParent(); buses.splice(j, 1); } } }
  }
  function start(kind) { if (!A) A = deps.agents(); if (!A) return false; const n = deps.n(); DBG = { kind, n }; for (let k = 0; k < n; k++) spawn(kind, k); return buses.length > 0; }
  function clear() { for (const b of buses) { if (A && A.alive(b.c)) A.remove(b.c); b.obj.removeFromParent(); } for (const q of kids) q.K?.obj.removeFromParent(); buses = []; kids = []; A = null; }
  return { update, clear, start, state: () => ({ ...DBG, kids: kids.length, kidsK: kids.filter(q => q.K).map(q => [Math.round(q.K.obj.position.x), Math.round(q.K.obj.position.z), q.K.obj.visible, +q.K.obj.scale.x.toFixed(3), q.leg, +q.t.toFixed(1)]), buses: buses.map(b => ({ kind: b.kind, i: b.i, n: b.stops.length, st: b.st, t: +b.t.toFixed(1), school: b.stops[b.i].school, onboard: b.onboard, v: +(b.c?.v || 0).toFixed(1), x: Math.round(b.c?.x || 0), z: Math.round(b.c?.z || 0) })) }) };
}
