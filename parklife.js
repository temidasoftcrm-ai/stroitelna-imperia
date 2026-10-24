// parklife.js — 🅿️ park-life (f6, backlog 25.10 №5): паркингите оживяват. Сутрин (7–9 ч.) човек отива до паркирана кола, качва се (изчезва при
// шофьорската врата), колата пали светлините, излиза на заден, минава по пътеката, излиза през устието и влиза в трафика като агент; вечер
// (17–19 ч.) — обратно: кола от трафика влиза, паркира на свободно място, слиза човек и отива към близка сграда. Заетостта следва часа.
// Евтино: само паркингите до камерата (до 1–2 движения на паркинг, до MAXM общо); далечните — само скриват/показват колите си (без движение).
// Ползва регистъра на паркингите (parking.js, 55: leave/arrive/park/release) и агентите на трафика (game.js → jpAgents(): route/add/remove/alive/free —
// като citybus.js); в traffic.js нищо не се променя.
// createParkLife(deps) → { update(dt), clear(), force(P, 'am'|'pm'), info() }
//   deps.parks — parking.js; deps.agents() → jpAgents | null; deps.lanes() — лентите (tr2); deps.off() → { x, z } (плана → света);
//   deps.hour() → 0…24; deps.cam() → { x, z }; deps.root() — групата на града; deps.car() → нова кола (Object3D) | null; deps.dark(o) — паркирана (без светлини);
//   deps.ped() → { m, mixer, wa } | null (истински минувач, вече в сцената); deps.dropPed(w); deps.bld(x, z) → { x, z } (тротоарът пред близка сграда)
import { pointOn } from './junctionpaths.js';

const NEAR = 380, MAXM = 6, CAR_V = 2.6, PED_V = 1.6, CAR_LEN = 4.6;
// целевата заетост по часа: нощем пълни, сутрин се изпразват, през деня — наполовина, вечер пак се пълнят
const target = h => h < 6.5 ? 0.85 : h < 9.5 ? 0.85 - 0.5 * Math.min(1, (h - 6.5) / 2.5) : h < 16.5 ? 0.35 : h < 19.5 ? 0.35 + 0.5 * Math.min(1, (h - 16.5) / 3) : 0.85;
const rush = h => (h >= 7 && h < 9.5) ? 'am' : (h >= 17 && h < 19.5) ? 'pm' : null;

export function createParkLife(deps) {
  const moves = [], P_ = deps.parks;
  const live = m => !(m.kind === 'am' && (m.st === 'drive' || m.st === 'gone'));   // излязлата кола вече е просто кола в трафика — не държи паркинга
  const busy = P => moves.filter(m => m.P === P && live(m)).length, nLive = () => moves.filter(live).length;
  const cap = P => P.spots.length >= 12 ? 2 : 1;
  // движение по полилиния (светът): obj към следващата точка; rev — първата отсечка на заден (муцуната — назад). → true, когато е стигнал края
  function follow(m, obj, dt, v) {
    const pts = m.pts; if (m.pi >= pts.length) return true;
    let st = v * dt;
    while (st > 0 && m.pi < pts.length) {
      const [x, z] = pts[m.pi], dx = x - obj.position.x, dz = z - obj.position.z, d = Math.hypot(dx, dz);
      if (d < 1e-3) { m.pi++; continue; }
      const k = Math.min(1, st / d); obj.position.x += dx * k; obj.position.z += dz * k; st -= d;
      const back = m.rev && m.pi === 0, want = Math.atan2(dx, dz) + (back ? Math.PI : 0);
      let dy = want - obj.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); obj.rotation.y += dy * Math.min(1, dt * (back ? 2 : 3.2));
      if (k < 1) break; m.pi++;   // остатъкът от стъпката — за следващата точка (без безкраен цикъл от закръгляния)
    }
    return m.pi >= pts.length;
  }
  function walk(m, dt) {
    const w = m.w; if (!w) return true;
    const pts = m.wp; if (m.wi >= pts.length) return true;
    const [x, z] = pts[m.wi], dx = x - w.m.position.x, dz = z - w.m.position.z, d = Math.hypot(dx, dz), st = PED_V * dt;
    if (d <= st) { w.m.position.x = x; w.m.position.z = z; m.wi++; }
    else { w.m.position.x += dx / d * st; w.m.position.z += dz / d * st; w.m.rotation.y = Math.atan2(dx, dz); }
    if (w.mixer) w.mixer.update(dt);
    return m.wi >= pts.length;
  }
  // сградата е далеч — човекът тръгва (или стига) до 10 м от устието, по посока към нея (иначе върви цял игрови ден)
  const near20 = (b, q) => { const dx = b.x - q[0], dz = b.z - q[1], d = Math.hypot(dx, dz); return d <= 10 ? [b.x, b.z] : [q[0] + dx / d * 10, q[1] + dz / d * 10]; };
  const dropW = m => { if (m.w) { deps.dropPed(m.w); m.w = null; } };
  const lightsOn = o => o.traverse(c => { if (c.userData.carLights || (c.isMesh && !c.visible && [].concat(c.material).some(x => x && x.transparent))) c.visible = true; });
  // паркираните са декор (userData.detail, freezeDetail: matrixAutoUpdate = false) — тръгващата се „размразява“, иначе се мести само на хартия
  const thaw = o => { o.matrixAutoUpdate = true; delete o.userData.detail; return o; };
  const toRoot = o => { const R = deps.root(); if (o.parent === R) return; o.updateWorldMatrix(true, false); const p = R.worldToLocal(o.getWorldPosition(o.position.clone())); if (o.parent) o.parent.remove(o); o.position.copy(p); o.position.y = 0; R.add(o); };
  // далечна точка на лентите (за целта/началото на колата): r0–r1 м от (x, z), случайна
  function farLane(x, z, r0 = 150, r1 = 450) {
    const o = deps.off(), L = deps.lanes().filter(l => l.kind === 'lane' && l.ring == null && !l.enter && !l.leave && l.len >= 30);
    for (let k = 0; k < 30 && L.length; k++) { const p = L[(Math.random() * L.length) | 0], s = p.len / 2, q = pointOn(p, s), d = Math.hypot(q.x + o.x - x, q.z + o.z - z); if (d > r0 && d < r1) return { p, s, x: q.x + o.x, z: q.z + o.z }; }
    return null;
  }

  // 🌅 сутрин: човек → колата → навън → трафика
  function leave(P) {
    const s = P_.takenSpot(P); if (!s || !s.car || !s.car.parent) return false;
    const car = s.car, b = near20(deps.bld(s.x, s.z), s.in[0]), w = deps.ped();
    const m = { P, s, kind: 'am', car, st: w ? 'walk' : 'start', t: 0, t0: 0, w, wp: [], wi: 0 };
    if (w) { w.m.position.set(b[0], 0.05, b[1]); m.wp = [b, ...s.in.slice(0, -1), s.door]; }   // от сградата през устието и пътеката до вратата
    moves.push(m); return true;
  }
  // 🌆 вечер: кола от трафика → устието → мястото; слиза човек → към сградата
  function arrive(P, any = false) {   // any — и по-дълъг път (демото в Лабораторията)
    const A = deps.agents(), s = P_.freeSpot(P); if (!A || !s) return false;
    let st = null, r = null;   // началото — на 80–220 м, с най-краткия път до устието (до 300 м; еднопосочните иначе обикалят)
    for (let k = 0; k < (any ? 12 : 5); k++) { const q = farLane(P.x, P.z, 80, any ? 400 : 220); if (!q || !A.free(q.p, q.s, CAR_LEN + 4)) continue; const rq = A.route({ p: q.p, s: q.s }, { x: P.mouthIn[0][0], z: P.mouthIn[0][1] }, false); if (rq && rq.len > 40 && (any || rq.len < 300) && (!r || rq.len < r.len)) { st = q; r = rq; } }
    const obj = r && deps.car(); if (!obj) return false;
    P_.arrive(s); A.group.add(obj);
    const m = { P, s, kind: 'pm', car: obj, st: 'drive', t: 0 };
    m.c = A.add({ obj, len: CAR_LEN, w: 2, h: 1.6, kind: 'car', name: 'Кола', route: r, onArrive: () => { if (m.st === 'drive') m.st = 'enter'; } });
    moves.push(m); return true;
  }
  // край на движението (и при прекъсване): колата е или пак на мястото си, или махната; мястото — заето или свободно
  function done(m) {
    const A = deps.agents(), rm = () => { if (m.car && m.car.parent) m.car.parent.remove(m.car); };
    if (m.c && A && A.alive(m.c)) A.remove(m.c);
    dropW(m);
    if (m.kind === 'am') {
      if (m.st === 'walk' || m.st === 'start') { m.car.visible = true; m.s.state = 'taken'; }   // още не е тръгнала — остава
      else if (m.st === 'out' || m.st === 'join') { rm(); m.s.car = null; P_.release(m.s); }
      else rm();   // drive / gone — мястото вече е освободено
    } else if (m.st !== 'walk') { rm(); if (m.s.state === 'arriving') P_.release(m.s); }   // не е стигнала мястото
    const k = moves.indexOf(m); if (k >= 0) moves.splice(k, 1);
  }
  function step(m, dt) {
    m.t += dt; const A = deps.agents();
    if (m.t > (m.st === 'drive' ? 240 : 150) || !A) { done(m); return; }   // заседнало — чисто отначало
    if (m.kind === 'am') {
      if (m.st === 'walk') { if (walk(m, dt)) { dropW(m); m.st = 'start'; m.t0 = m.t; P_.leave(m.s); thaw(m.car).visible = true; lightsOn(m.car); } return; }   // изчезва при вратата; светлините
      if (m.st === 'start') { if (m.s.state === 'taken') { P_.leave(m.s); thaw(m.car).visible = true; lightsOn(m.car); } if (m.t - m.t0 < 1.5) return; toRoot(m.car); m.pts = m.s.out.slice(1); m.pi = 0; m.rev = !m.s.back; m.st = 'out'; return; }
      if (m.st === 'out') { if (follow(m, m.car, dt, m.pi === 0 && m.rev ? CAR_V * 0.6 : CAR_V)) m.st = 'join'; return; }   // на заден — по-бавно
      if (m.st === 'join') {   // в трафика: най-близката лента до устието, накъдето и да е — щом е свободно
        const o = deps.off(), x = m.car.position.x, z = m.car.position.z;
        if (!m.r) {   // целта — на 120–260 м, с най-краткия път (до ~350 м): излиза от кадъра и изчезва
          for (let k = 0; k < 5; k++) { const q = farLane(x, z, 120, 260); if (!q) continue; const rq = A.route({ x, z }, { x: q.x, z: q.z }, false); if (rq && (!m.r || rq.len < m.r.len)) { m.r = rq; m.to = q; } if (m.r && m.r.len < 350) break; }
          if (!m.r) { done(m); return; } }
        const r = m.r, to = m.to;
        if (!A.free(r.paths[0], r.s0, CAR_LEN + 4)) return;
        if (!m.glide) { const q = pointOn(r.paths[0], r.s0); m.glide = [[q.x + o.x, q.z + o.z]]; m.pts = m.glide; m.pi = 0; m.rev = false; }
        if (!follow(m, m.car, dt, CAR_V * 1.4)) return;
        const r2 = A.route({ p: r.paths[0], s: r.s0 }, { x: to.x, z: to.z }, false) || r;
        if (m.car.parent) m.car.parent.remove(m.car); A.group.add(m.car); m.s.car = null; P_.release(m.s);
        m.c = A.add({ obj: m.car, len: CAR_LEN, w: 2, h: 1.6, kind: 'car', name: 'Кола', route: r2, onArrive: () => { m.st = 'gone'; } });
        m.st = 'drive'; return;
      }
      if (m.st === 'drive') { if (!A.alive(m.c)) m.st = 'gone'; return; }
      if (m.st === 'gone') { done(m); return; }   // стигна далечната цел — изчезва
    } else {
      if (m.st === 'drive') { if (!A.alive(m.c)) done(m); return; }
      if (m.st === 'enter') {   // от лентата — с колата в групата на града, през устието до мястото
        A.remove(m.c); m.c = null; toRoot(m.car); m.pts = m.s.in; m.pi = 0; m.rev = false; m.st = 'in'; return;
      }
      if (m.st === 'in') {
        if (!follow(m, m.car, dt, CAR_V)) return;
        m.s.plKeep = null;   // пазената от далечния паркинг — вече не трябва
        P_.park(m.s, m.car); m.car.position.y = 0; deps.dark(m.car);
        const w = deps.ped(), b = near20(deps.bld(m.s.x, m.s.z), m.s.out[m.s.out.length - 1]);
        if (w) { w.m.position.set(m.s.door[0], 0.05, m.s.door[1]); m.w = w; m.wp = [...m.s.out.slice(1), b]; m.wi = 0; }
        m.st = 'walk'; return;
      }
      if (m.st === 'walk') { if (walk(m, dt)) done(m); return; }
    }
  }
  // далечните паркинги: без движение — колите им се махат/връщат (махнатата се пази в мястото: s.plKeep, s.plPar — пак същият модел)
  function farTick(P, tg) {
    const o = P_.occ(P), n = P.spots.length;
    if (o > tg + 1 / n) { const s = P_.takenSpot(P); if (s && s.car && s.car.parent) { s.plKeep = s.car; s.plPar = s.car.parent; s.plPar.remove(s.car); s.car = null; s.state = 'free'; } }
    else if (o < tg - 1 / n) { const s = P.spots.find(q => q.state === 'free' && q.plKeep && !q.car); if (s) { s.plPar.add(s.plKeep); s.car = s.plKeep; s.plKeep = null; s.state = 'taken'; } }
  }
  function update(dt) {
    if (!P_.list.length) return;
    for (const m of [...moves]) step(m, dt);
    const h = deps.hour(), R = rush(h), tg = target(h), c = deps.cam();
    for (const P of P_.list) {
      const n = P.spots.length; if (n < 2) continue;
      if (Math.hypot(P.x - c.x, P.z - c.z) > NEAR) { if ((P.plT = (P.plT || 0) + dt) > 0.6) { P.plT = 0; farTick(P, tg); } continue; }
      if (nLive() >= MAXM || moves.length >= MAXM * 2 || busy(P) >= cap(P)) continue;
      const o = P_.occ(P), rate = R ? 0.5 : 0.04;   // в пиковия час — често; иначе рядко (една-две коли за деня)
      if (Math.random() > rate * dt) continue;
      if (o > tg + 0.5 / n && (R === 'am' || (!R && Math.random() < 0.5))) leave(P);
      else if (o < tg - 0.5 / n && (R === 'pm' || !R)) arrive(P);
    }
  }
  function clear() { for (const m of [...moves]) done(m); }
  return {
    update, clear,
    force: (P, k) => k === 'pm' ? arrive(P, true) : leave(P),
    info: () => ({ moves: moves.map(m => ({ k: m.kind, st: m.st, t: +m.t.toFixed(1), P: m.P.id, i: m.s.i })), parks: P_.list.length, h: +deps.hour().toFixed(1), target: target(deps.hour()) }),
    moves: () => moves,
    dbg: () => moves.filter(m => m.c).map(m => ({ st: m.st, v: +(m.c.v || 0).toFixed(1), why: m.c.why || '', wait: +(m.c.wait || 0).toFixed(1), x: Math.round(m.c.x), z: Math.round(m.c.z), goal: Math.round(m.c.goal || 0), s: Math.round(m.c.s), ri: m.c.ri, n: (m.c.route || []).length, kind: m.c.p && m.c.p.kind })),
  };
}
