// hwchase.js — 🚔 гонка на магистралата край града (Лабораторията → hw-chase; hwtraffic.js го създава до hw-incidents).
// Рядко (на 25–50 игрови минути, не по време на инцидент): кола-беглец (спортна) влиза в участъка с ~150 км/ч, лъкатуши между лентите
// и изпреварва; след нея 3–4 полицейски коли с бурканите и сирените, разпръснати по лентите; хеликоптерът (aircity.js, police-heli)
// я следи отгоре, нощем — с прожектора (светещ конус, без PointLight). Колите отпред отбиват вдясно и намаляват.
// Изходът се избира в началото: 60% — катастрофа (губи контрол, върти се, удря мантинелата: парчета, дим, огън → изгоряла кола
// assets/heavy/riot/burnt-car-*; полицията я обгражда, лентата се затваря за малко — конуси и „призрак“ като в hw-incidents; идва пътна
// помощ и я вдига); 40% — задържане: PIT (полицейската кола я завърта), блокиране (обграждат я и я спират в дясната лента) или шипове
// (спуканите гуми я спират). Шофьорът слиза с ръце горе (минувач от incidents2 + поза на ръцете), полицаите — до него; после всички си тръгват.
// Колите на гонката са в списъка на трафика (c.inc = 'chase') — другите ги виждат като препятствия; ok/need/vcap — както в hwincidents.js.
// В кадъра — без заделяне на памет (общите временни вектори); групата се скрива, когато камерата е далеч.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { canvasTex } from './texdata.js';
import { feature } from './lab/feature.js';
import { loadInc2, createInc2Kit } from './incidents2.js';

const EVERY = [1500, 3000];   // игрови секунди между две гонки
const SPORTY = ['sf-cv-tesla3', 'sf-car-Muscle', 'sf-car-Muscle_2', 'sf-car-Sedan', 'sf-car-Hatchback'];
const POL = ['sf-car-Police_Sedan', 'sf-car-Police_SUV', 'sf-car-Police_Sedan', 'sf-car-Police_Sedan'];
const BURNT = ['burnt-car-a', 'burnt-car-b'].map(k => new URL(`./assets/heavy/riot/${k}.glb`, import.meta.url).href);
const SUBS = ['pit', 'block', 'spike'];
const TOW_L = 5.66, VF = 42, VP = 52, FAR = 1800;
let TX = null, GM = null, burntP = null;
const tex = () => TX || (TX = (() => {
  const rad = st => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31); for (const [o, col] of st) gr.addColorStop(o, col); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return canvasTex(c); };
  return { smoke: rad([[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]), fire: rad([[0, 'rgba(255,250,200,1)'], [0.35, 'rgba(255,170,40,0.9)'], [1, 'rgba(255,60,0,0)']]) };
})());
const geo = () => GM || (GM = { cone: new THREE.ConeGeometry(0.24, 0.72, 10).translate(0, 0.41, 0), band: new THREE.CylinderGeometry(0.14, 0.18, 0.12, 10).translate(0, 0.45, 0), foot: new THREE.BoxGeometry(0.46, 0.05, 0.46).translate(0, 0.025, 0),
  deb: new THREE.BoxGeometry(0.42, 0.07, 0.3), strip: new THREE.BoxGeometry(0.3, 0.05, 1).translate(0, 0.025, 0), spike: new THREE.ConeGeometry(0.035, 0.11, 4).translate(0, 0.1, 0),
  mOr: new THREE.MeshStandardMaterial({ color: 0xff5a00, roughness: 0.6 }), mW: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }), mK: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 }),
  mDeb: new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.5, metalness: 0.3 }), mGlass: new THREE.MeshStandardMaterial({ color: 0xa8cde0, roughness: 0.1, metalness: 0.2 }),
  mStrip: new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.7 }), mSpike: new THREE.MeshStandardMaterial({ color: 0xc0c4cc, roughness: 0.3, metalness: 0.7 }) });
const loadBurnt = () => burntP || (burntP = Promise.all(BURNT.map(u => new GLTFLoader().loadAsync(u).then(gl => gl.scene).catch(e => { console.warn('hw-chase', u, e); return null; }))).then(L => L.filter(Boolean)));
// изгорялата кола: най-дългата хоризонтала → L по +z, основата на y = 0
function fitTo(src, L) {
  const o = src.clone(true), inner = new THREE.Group(), w = new THREE.Group(); inner.add(o); w.add(inner); w.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(w), s = b.getSize(new THREE.Vector3()); if (s.x > s.z) inner.rotation.y = Math.PI / 2; inner.scale.setScalar(L / (Math.max(s.x, s.z) || 1)); w.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(w), c = b2.getCenter(new THREE.Vector3()); inner.position.set(-c.x, -b2.min.y, -c.z);
  w.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return w;
}

// T — от hwtraffic.js: групата, списъкът с колите, лентите, моделите; T.inc() — hw-incidents (не едновременно с инцидент)
export function createHwChase(T) {
  const { g, list, laneZ, NL, RIGHT, half, len, y, lift, ab, model, A, lenOf, svc, rampCx } = T;
  const LW = ab ? 3.6 : 4.4, Y = x => y + (lift ? lift(x) : 0), YAW = d => d > 0 ? Math.PI / 2 : -Math.PI / 2, Wd = c => c.W || (c.W = Math.max(1.8, Math.min(2.55, c.L * 0.42)));
  const rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), OB = { q: null, gap: 0 }, FO = { x: 0, y: 0, z: 0, fx: 1, fz: 0, fast: false };
  const AX = new THREE.Vector3(), CUR = new THREE.Vector3(), WANT = new THREE.Vector3(), QA = new THREE.Quaternion(), QB = new THREE.Quaternion(), QP = new THREE.Quaternion();
  let C = null, K2 = null, kp = null, wait = rnd(...EVERY) * 0.5;
  const api = { cam: null };
  const sOf = x => (x - C.X0) * C.D, xOf = s => C.X0 + C.D * s;
  const pose = c => { c.o.position.set(c.x, Y(c.x), c.z); c.o.rotation.y = YAW(c.dir) - c.dir * Math.atan2(c.vz, Math.max(3, c.v)) + c.ch.yaw; };
  const unlist = q => { const i = list.indexOf(q); if (i >= 0) list.splice(i, 1); };

  // ---- мястото на изхода: не върху отбивката на комплекса и на изходите към града; до края — място за спирането
  function valid(s0, s1, D, X0) {
    if (s0 < 60 || s1 > len - 40) return false;
    const a = Math.min(X0 + D * s0, X0 + D * s1), b = Math.max(X0 + D * s0, X0 + D * s1), hit = (p, q) => q > a && p < b;
    if (svc && D > 0 && hit(svc.z0 - 40, svc.z1 + 40)) return false;
    if (rampCx != null) { const Tx = rampCx - D * 330, M = rampCx + D * 300; if (hit(Tx - 40, Tx + 40) || hit(M - 50, M + 50)) return false; }
    return true;
  }
  // ---- препятствието отпред по ширина (коли, полиция; без призраците), свободна лента, празното отпред в лента
  function obst(c) {
    let best = null, bd = 1e9; const w = Wd(c) / 2;
    for (let i = 0; i < list.length; i++) { const q = list[i]; if (q === c || q.dir !== c.dir || q.s || q.away > 0 || q.ghost || q.inc === 'respawn' || q.inc === 'cargo') continue; const d = (q.x - c.x) * c.dir; if (d <= 0 || d > 260) continue; if (Math.abs(q.z - c.z) > w + Wd(q) / 2 + 0.25) continue; if (d < bd) { bd = d; best = q; } }
    if (!best) return null; OB.q = best; OB.gap = bd - (best.L + c.L) / 2; return OB;
  }
  function laneFree(c, l, back, front) {
    const zl = laneZ(c.dir, l), w = Wd(c) / 2;
    for (let i = 0; i < list.length; i++) { const q = list[i]; if (q === c || q.dir !== c.dir || q.s || q.away > 0 || q.ghost || q.inc === 'respawn') continue; if (Math.abs(q.z - zl) > w + Wd(q) / 2 + 0.2) continue; const d = (q.x - c.x) * c.dir, h = (q.L + c.L) / 2; if (d > -h - back - Math.max(0, q.v - c.v) * (d < 0 ? 1.2 : 0) && d < h + front) return false; }
    return true;
  }
  function gapIn(c, l) {
    const zl = laneZ(c.dir, l), w = Wd(c) / 2; let bd = 400;
    for (let i = 0; i < list.length; i++) { const q = list[i]; if (q === c || q.dir !== c.dir || q.s || q.away > 0 || q.ghost || q.inc === 'respawn') continue; if (Math.abs(q.z - zl) > w + Wd(q) / 2 + 0.25) continue; const d = (q.x - c.x) * c.dir - (q.L + c.L) / 2; if (d > -1 && d < bd) bd = d; }
    return bd;
  }
  // ---- движение: скорост (ускорение/спиране), никога през предната, напреки — към лентата (zt — свое място напреки)
  function drive(c, vt, dt, acc, dec, lat, zt) {
    const ob = obst(c); let lim = 1e9;
    if (ob) { vt = Math.min(vt, Math.sqrt(ob.q.v * ob.q.v + 2 * 7 * Math.max(0, ob.gap - 2.5))); lim = Math.max(0, ob.gap - 0.5); }
    c.v = Math.max(0, c.v + clamp(vt - c.v, -dec * dt, acc * dt));
    const ds = Math.min(c.v * dt, lim, c.ch.lim ?? 1e9); c.x += c.dir * ds;
    const tz = zt ?? laneZ(c.dir, c.lane), want = clamp((tz - c.z) * 2.2, -lat, lat); c.vz += clamp(want - c.vz, -lat * 2.5 * dt, lat * 2.5 * dt);
    if (Math.abs(tz - c.z) <= Math.abs(c.vz * dt) + 0.004) { c.z = tz; c.vz = 0; } else c.z += c.vz * dt;
    pose(c);
  }
  // смяна на лентата пред бавна кола: към по-празната съседна (ако е свободна)
  function dodge(c, ob, cool) {
    if (!ob || ob.gap > 55 || ob.q.v > c.v - 0.5 || Math.abs(c.z - laneZ(c.dir, c.lane)) > 0.6) return false;
    let best = -1, bg = ob.gap + 8; for (let k = -1; k <= 1; k += 2) { const l = c.lane + k; if (l < 0 || l >= NL || !laneFree(c, l, 3, 10)) continue; const gl = gapIn(c, l); if (gl > bg) { bg = gl; best = l; } }
    if (best < 0) return false; c.lane = best; c.ch.cool = cool; return true;
  }
  function car(n, role) {
    const o = model(n, 1); o.rotation.y = YAW(C.D); o.visible = false; C.G.add(o);
    const c = { o, dir: C.D, x: C.X0, lane: 0, z: laneZ(C.D, 0), v: 0, v0: 30, L: lenOf(o), heavy: false, cool: 0, inc: 'chase', vz: 0, ch: { role, ph: 'run', yaw: 0, spin: 0, cool: 0, wT: 1, k: 0, inL: false } };
    C.cars.push(c); return c;
  }
  const enter = c => { if (c.ch.inL) return; c.ch.inL = true; list.push(c); c.o.visible = true; };
  function despawn(c) { c.ch.ph = 'gone'; unlist(c); c.ch.inL = false; if (c.o.parent) c.o.parent.remove(c.o); }
  function emit(ph) {
    try { const F = C && C.F; g.updateWorldMatrix(true, false); V.set(F ? F.x : 0, F ? Y(F.x) : y, F ? F.z : 0); g.localToWorld(V);
      dispatchEvent(new CustomEvent('stroi-hwchase', { detail: { ph, out: C ? C.out : null, sub: C ? C.sub : null, x: V.x, z: V.z } })); } catch { }
  }

  // ---- начало: out — 'crash' | 'stop' | 'pit' | 'block' | 'spike' | без (60% катастрофа / 40% задържане)
  function start(kind, o = {}) {
    if (K2 === null) { if (!kp) kp = loadInc2().then(l => { K2 = l ? createInc2Kit(l) : false; }).catch(() => { K2 = false; }); return kp.then(() => start(kind, o)); }
    const inc = T.inc && T.inc(); if (inc && inc.busy) { if (!o.force) return { fail: 'incident' }; inc.finish(); }
    if (C) finish(true);
    const fn = SPORTY.find(n => A[n]), pn = POL.filter(n => A[n]); if (!fn || !pn.length) return { fail: 'models' };
    const out = kind === 'crash' || kind === 'stop' ? kind : SUBS.includes(kind) ? 'stop' : Math.random() < 0.6 ? 'crash' : 'stop';
    const sub = out === 'stop' ? (SUBS.includes(kind) ? kind : SUBS[(Math.random() * 3) | 0]) : null;
    const D = o.dir || (Math.random() < 0.5 ? 1 : -1), X0 = -D * (half - 6);
    let sEnd = null; const lo = Math.max(220, len * 0.32), hi = Math.max(lo, len * 0.62), r0 = Math.random();
    for (let k = 0; k <= 30 && sEnd == null; k++) { const s = lo + (hi - lo) * ((r0 + k * 0.618) % 1); if (valid(s - 60, s + 280, D, X0)) sEnd = s; }
    if (sEnd == null) { const s = Math.min(len * 0.4, len - 330); if (s < 150) return { fail: 'short', len }; sEnd = s; }
    C = { out, sub, D, X0, sEnd, t: 0, ph: 'wait', G: new THREE.Group(), cars: [], P: [], F: null, tow: null, cl: null, ghost: null, cones: [], pp: [], drv: null, deb: [], puffs: [], flames: [], fire: 0, burnt: null, strip: null, haz: [], sF: null, head: 0, tail: 0, lq: null, lT: 0 };
    g.add(C.G); if (out === 'crash') loadBurnt().then(L => { if (C) C.burntL = L; });   // изгорялата кола — отрано
    C.F = car(fn, 'fug'); C.F.ch.vmax = VF + rnd(-2, 3); C.F.v0 = 40;
    const n = sub === 'spike' ? 3 : 3 + (Math.random() < 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) { const c = car(pn[k % pn.length], 'pol'); c.ch.k = k; c.o.userData.beaconsOn = 1; c.o.userData.sirenOn = false; C.P.push(c); }
    if (sub === 'spike') {   // шиповете: полицията вече чака на мястото (дясната лента е затворена) — четвъртата кола и полицай на банкета
      const c = car(pn[0], 'spk'); c.ch.k = 3; c.o.userData.beaconsOn = 1; c.o.userData.sirenOn = false; c.ch.ph = 'park'; c.lane = RIGHT; c.x = xOf(sEnd + 14); c.z = laneZ(D, RIGHT); c.v = 0; c.ch.yaw = -0.12; pose(c); enter(c); C.P.push(c);
      setCl(RIGHT, sEnd - 30, sEnd + 22); C.cl.soft = true;   /* без „зяпане“ — колите само се престрояват пред полицейската кола */
      if (K2) { const zb = laneZ(D, RIGHT) + D * (LW / 2 + 0.6), p = K2.put(C.G, 'cop', 'wave', xOf(sEnd + 6), zb, xOf(sEnd - 60), zb); if (p) { p.position.y = Y(p.position.x); C.pp.push(p); } }
    }
    return { out, sub, dir: D, sEnd: Math.round(sEnd), len: Math.round(len), police: n, fug: fn };
  }
  // ---- затворената лента: „призрак“ в началото ѝ (колите отзад спират и се престрояват); конусите — когато всичко е спряло
  function setCl(lane, s0, s1) {
    C.cl = { lane, s0, s1 };
    if (!C.ghost) { C.ghost = { ghost: true, inc: 'ghost', hard: false, dir: C.D, lane, z: 0, x: 0, L: 0.6, v: 0, v0: 1, W: LW - 0.3, cool: 0, heavy: true }; list.push(C.ghost); }
    C.ghost.lane = lane; C.ghost.z = laneZ(C.D, lane); C.ghost.x = xOf(s0 - 1);
  }
  function edges(lane) { const D = C.D; return lane === 0 ? { zo: laneZ(D, 0) - D * (LW / 2 - 0.45), zb: laneZ(D, 0) + D * LW / 2 } : { zo: laneZ(D, lane) + D * (LW / 2 - 0.45), zb: laneZ(D, lane) - D * LW / 2 }; }
  function cone(s, z) { const M = geo(), c = new THREE.Group(), x = xOf(s); c.add(new THREE.Mesh(M.cone, M.mOr), new THREE.Mesh(M.band, M.mW), new THREE.Mesh(M.foot, M.mK)); c.position.set(x, Y(x), z); C.G.add(c); C.cones.push(c); }
  function setCones() {
    const E = edges(C.cl.lane), s0 = C.cl.s0, s1 = C.cl.s1;
    for (let k = 0; k <= 5; k++) cone(s0 + k * 6, E.zo + (E.zb - E.zo) * k / 5);
    for (let s = s0 + 39; s <= s1; s += 9) cone(s, E.zb);
  }
  function put(kind, anim, s, z, ts, tz) { if (!K2) return null; const x = xOf(s), p = K2.put(C.G, kind, anim, x, z, xOf(ts), tz); if (p) { p.position.y = Y(x); C.pp.push(p); } return p; }
  const dropPeople = () => { for (const p of C.pp.splice(0)) if (p.parent) p.parent.remove(p); C.drv = null; };
  // ръцете горе: мишниците встрани, предмишниците нагоре (костите на Mixamo — оста им Y е по костта)
  function handsUp(p) { const B = {}; p.traverse(m => { const n = m.name || ''; if (/LeftArm$/.test(n)) B.la = m; else if (/RightArm$/.test(n)) B.ra = m; else if (/LeftForeArm$/.test(n)) B.lf = m; else if (/RightForeArm$/.test(n)) B.rf = m; }); return B.la && B.ra && B.lf && B.rf ? B : null; }
  function aim(b, wx, wy, wz) { b.getWorldQuaternion(QA); CUR.set(0, 1, 0).applyQuaternion(QA); WANT.set(wx, wy, wz).normalize(); QB.setFromUnitVectors(CUR, WANT); QA.premultiply(QB); b.parent.getWorldQuaternion(QP); b.quaternion.copy(QP.invert().multiply(QA)); b.updateMatrixWorld(true); }
  function poseUp(p, B) { p.updateMatrixWorld(true); AX.setFromMatrixColumn(p.matrixWorld, 0).normalize(); const x = AX.x, z = AX.z; aim(B.la, x, 0.3, z); aim(B.lf, x * 0.12, 1, z * 0.12); aim(B.ra, -x, 0.3, -z); aim(B.rf, -x * 0.12, 1, -z * 0.12); }

  // ---- катастрофата: парчета, дим, огън
  function crashFx() {
    const M = geo(), t = tex(), F = C.F, x = F.x + C.D * F.L * 0.4;
    for (let k = 0; k < 12; k++) { const m = new THREE.Mesh(M.deb, k % 3 ? M.mDeb : M.mGlass); m.position.set(x, Y(x) + 0.6, F.z); m.scale.setScalar(rnd(0.5, 1.4)); C.G.add(m); C.deb.push({ m, vx: C.D * rnd(4, 14), vy: rnd(2, 6), vz: rnd(-5, 5), r: rnd(-8, 8) }); }
    for (let k = 0; k < 7; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.smoke, color: 0x3a3a3a, transparent: true, depthWrite: false, opacity: 0 })); s.userData.ph = k / 7; C.G.add(s); C.puffs.push(s); }
    for (let k = 0; k < 3; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.fire, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.userData.k = k; s.visible = false; C.G.add(s); C.flames.push(s); }
    loadBurnt();
  }
  function fxStep(dt) {
    const F = C.F, t = C.t, th = C.tHit;
    for (let i = 0; i < C.deb.length; i++) { const d = C.deb[i], m = d.m; if (d.vy === 0 && d.vx === 0) continue; d.vy -= 9.8 * dt; m.position.x += d.vx * dt; m.position.y += d.vy * dt; m.position.z += d.vz * dt; m.rotation.x += d.r * dt; m.rotation.y += d.r * 0.7 * dt; const gy = Y(m.position.x) + 0.04; if (m.position.y <= gy) { m.position.y = gy; d.vy = d.vy < -2 ? -d.vy * 0.25 : 0; d.vx *= 0.5; d.vz *= 0.5; d.r *= 0.5; if (d.vy === 0 && Math.abs(d.vx) < 0.4) { d.vx = d.vz = 0; } } }
    const on = F.ch.ph !== 'cargo' && F.ch.ph !== 'gone', ts = t - th;
    C.fire = ts < 2 ? 0 : ts < 6 ? (ts - 2) / 4 : ts < 18 ? 1 : Math.max(0, 1 - (ts - 18) / 6);
    if ((C.fire > 0.7 || ts > 6) && on && !C.burnt && C.burntL && C.burntL.length) {   /* моделът може да дойде и по-късно (бавна мрежа) — сменя се, докато колата е още там */   // изгоря: моделът → изгорялата кола (ако е заредена)
      try { const b = fitTo(C.burntL[(Math.random() * C.burntL.length) | 0], F.L); for (const m of F.o.children) m.visible = false; b.scale.divideScalar(F.o.scale.x || 1); F.o.add(b); C.burnt = b; } catch (e) { C.burnt = 'err'; C.err = String(e); console.warn('hw-chase burnt', e); } }
    const k = on ? Math.max(C.fire, Math.max(0, 1 - ts / 70) * 0.5) : 0, bx = F.x;
    for (let i = 0; i < C.puffs.length; i++) { const s = C.puffs[i], ph = (t * 0.22 + s.userData.ph) % 1; s.position.set(bx + Math.sin(ph * 9) * 0.6, Y(bx) + 1 + ph * 12, F.z + ph * 2.5); s.scale.setScalar((1.3 + ph * 6) * 1.4); s.material.opacity = 0.6 * (1 - ph) * k; }
    for (let i = 0; i < C.flames.length; i++) { const s = C.flames[i], kk = s.userData.k, f = 0.75 + 0.25 * Math.sin(t * 11 + kk * 2) * Math.sin(t * 7.3 + kk), sz = (kk ? 2 : 3) * C.fire, x = bx + (kk - 1) * 0.9 * C.D; s.visible = on && C.fire > 0.02; s.position.set(x, Y(x) + 0.5 + sz * 0.45, F.z + (kk === 2 ? 0.4 : 0)); s.scale.set(Math.max(0.01, sz * f * 0.8), Math.max(0.01, sz * f * 1.25), 1); }
  }

  // ---- гонката: беглецът лъкатуши и изпреварва; полицията — след него, по лентите
  function runF(F, dt, weave, noDodge) {
    const ch = F.ch; ch.wT -= dt; ch.cool -= dt;
    const ob = noDodge ? null : obst(F);
    if (!(ob && ch.cool <= 0 && dodge(F, ob, rnd(1, 2))) && weave && ch.wT <= 0) { ch.wT = rnd(1.6, 3.4); const l = F.lane + (Math.random() < 0.5 ? -1 : 1); if (l >= 0 && l < NL && laneFree(F, l, 3, 25)) F.lane = l; }
    drive(F, ch.vmax, dt, 5, 9, 5.5, ch.zt);
  }
  function runP(c, dt) {
    const F = C.F, ch = c.ch, k = ch.k, want = (F.lane + k) % NL, dist = (F.x - c.x) * c.dir - c.v * dt, d0 = 16 + 11 * k; ch.cool -= dt;
    const vt = clamp(F.v + (dist - d0) * 0.7, 0, VP);
    if (!ch.inL && sOf(c.x) >= 0) enter(c);
    if (ch.inL) { const ob = obst(c);
      if (!(ob && ob.q !== F && ch.cool <= 0 && dodge(c, ob, 1.2)) && c.lane !== want && ch.cool <= 0 && Math.abs(c.z - laneZ(c.dir, c.lane)) < 0.5) { const l = c.lane + Math.sign(want - c.lane); if (laneFree(c, l, 4, 8)) { c.lane = l; ch.cool = 1; } } }
    drive(c, vt, dt, 6, 9, 4.5);
  }
  // ---- PIT: полицейската кола се изравнява със задницата на беглеца в съседната лента и го побутва — той се завърта
  function pitStep(dt) {
    const F = C.F, P = C.P[0], ch = P.ch;
    if (ch.ph !== 'pit') { ch.ph = 'pit'; ch.adj = F.lane > 0 ? F.lane - 1 : F.lane + 1; }
    if (ch.hit) { P.ch.lim = null; drive(P, Math.max(0, F.v - 6), dt, 3, 6, 3); return; }
    if (P.lane !== ch.adj && Math.abs(P.z - laneZ(P.dir, P.lane)) < 0.5 && laneFree(P, P.lane + Math.sign(ch.adj - P.lane), 2, 4)) P.lane += Math.sign(ch.adj - P.lane);
    const tx = F.x - P.dir * ((F.L + P.L) / 2 - 1.7), err = (tx - P.x) * P.dir - P.v * dt, sg = Math.sign(laneZ(P.dir, ch.adj) - laneZ(P.dir, F.lane));
    const near = P.lane === ch.adj && Math.abs(err) < 1.5 && Math.abs(P.z - laneZ(P.dir, ch.adj)) < 0.3;
    if (near) ch.push = true;
    const zt = ch.push ? F.z + sg * ((Wd(F) + Wd(P)) / 2 - 0.05) : undefined;
    drive(P, clamp(F.v + clamp(err * 1.4, -10, 9), 0, VP + 4), dt, 7, 9, ch.push ? 2.2 : 4.5, zt);
    if (ch.push && Math.abs(P.z - F.z) <= (Wd(F) + Wd(P)) / 2 + 0.02) { ch.hit = true; F.ch.spin = -sg * C.D * rnd(2.8, 3.6); F.ch.vzc = -sg * 1.5; F.ch.lose = true; }
  }
  // ---- блокиране: една отпред (в лентата му), една до него, една отзад — предната намалява, докато всички спрат
  // скоростта, с която c догонва мястото си на gap зад F — без да го подмине (пътят за спиране)
  const catchUp = (F, c, gap, dt) => { const e = (F.x - c.x) * c.dir - gap - c.v * dt; return e > 0 ? Math.min(VP + 4, F.v + Math.sqrt(2 * 6 * e)) : Math.max(0, F.v + e * 0.9); };
  function blockStep(dt) {
    const F = C.F, Ld = C.P[0], Sd = C.P[1], Rr = C.P[2], X = C.P[3], pass = F.lane > 0 ? F.lane - 1 : F.lane + 1;
    const ahead = (Ld.x - F.x) * F.dir, need = (F.L + Ld.L) / 2;
    if (!C.brk) {
      if (Ld.lane !== F.lane || ahead < need) { const want = ahead < need + 4 ? pass : F.lane; if (Ld.lane !== want && Math.abs(Ld.z - laneZ(Ld.dir, Ld.lane)) < 0.5 && laneFree(Ld, Ld.lane + Math.sign(want - Ld.lane), want === F.lane ? 1 : 3, want === F.lane ? 1 : 6)) Ld.lane += Math.sign(want - Ld.lane);
        drive(Ld, ahead < need + 4 ? F.v + 12 : Math.max(0, F.ch.vmax - (ahead - need - 6) * 0.8), dt, 7, 9, 4); }
      else drive(Ld, Math.max(0, F.ch.vmax - (ahead - need - 6) * 0.8), dt, 7, 9, 4);   /* 6 м пред него */
      if (Ld.lane === F.lane && Math.abs(Ld.z - F.z) < 0.6 && ahead < need + 14 && Math.abs(((Sd.x - F.x) * F.dir)) < 6) { C.brk = true; Ld.ch.vb = Ld.v; }
      if (sOf(F.x) > C.sEnd + 250) { C.brk = true; Ld.ch.vb = Ld.v; F.ch.force = true; }
    } else { Ld.ch.vb = Math.max(0, Ld.ch.vb - 2.6 * dt); drive(Ld, Ld.ch.vb, dt, 3, 4, 3); }
    if (Sd) { if (Sd.lane !== pass && Math.abs(Sd.z - laneZ(Sd.dir, Sd.lane)) < 0.5 && laneFree(Sd, Sd.lane + Math.sign(pass - Sd.lane), 2, 2)) Sd.lane += Math.sign(pass - Sd.lane); drive(Sd, catchUp(F, Sd, 0, dt), dt, 7, 9, 4); }
    if (Rr) { if (Rr.lane !== F.lane && Math.abs(Rr.z - laneZ(Rr.dir, Rr.lane)) < 0.5 && laneFree(Rr, Rr.lane + Math.sign(F.lane - Rr.lane), 2, 2)) Rr.lane += Math.sign(F.lane - Rr.lane); drive(Rr, catchUp(F, Rr, (F.L + Rr.L) / 2 + 6, dt), dt, 7, 9, 4); }
    if (X) runP(X, dt);
  }

  function stopped() {
    const F = C.F, D = C.D; C.ph = 'box'; C.tStop = C.t; F.v = 0; F.vz = 0; C.sF = sOf(F.x);
    let Lc = 0, bd = 1e9; for (let l = 0; l < NL; l++) { const d = Math.abs(F.z - laneZ(D, l)); if (d < bd) { bd = d; Lc = l; } } F.lane = Lc;
    setCl(Lc, C.sF - 60, C.sF + (C.out === 'crash' ? 45 : 36));
    F.o.traverse(m => { if (m.userData.lamp === 'blink') C.haz.push(m); });
    const P = C.P.filter(c => c.ch.ph !== 'gone'), sF = C.sF, a0 = C.out === 'crash' ? 15 : 11;
    for (const c of P) if (!c.ch.inL) { c.x = xOf(Math.max(0, Math.min(sOf(c.x), sF - 60))); enter(c); }
    const ahead = P.filter(c => sOf(c.x) > sF - 3).sort((a, b) => sOf(a.x) - sOf(b.x)), behind = P.filter(c => sOf(c.x) <= sF - 3).sort((a, b) => sOf(b.x) - sOf(a.x));
    const nA = Math.max(ahead.length, P.length >= 4 ? 2 : 1); while (ahead.length < nA && behind.length > 1) ahead.push(behind.shift()); ahead.sort((a, b) => sOf(a.x) - sOf(b.x));   // по-близкият — по-близкото място
    { let pv = sF + a0 - 12; for (const c of ahead) { let sl = pv + 12; const s = sOf(c.x); if (s > sl) sl = Math.min(s, sl + 30); c.ch.slot = pv = sl; } }   /* вече отминала мястото си — спира, където е (без дълго назад) */ behind.forEach((c, i) => { c.ch.slot = sF - 9 - i * 12; });
    for (const c of P) { c.ch.ph = 'slot'; c.ch.pass = c.ch.slot > sF && sOf(c.x) < sF + (F.L + c.L) / 2 + 2; c.ch.lim = null; }
    if (C.out === 'stop') emit('stop');
  }
  function goSlot(c, dt) {
    const ch = c.ch, F = C.F, Lc = C.cl.lane, Lo = Lc === 0 ? 1 : Lc - 1, s = sOf(c.x), dS = ch.slot - s;
    if (ch.pass && s > C.sF + (F.L + c.L) / 2 + 2.5) ch.pass = false;
    const want = ch.pass ? Lo : Lc;
    if (c.lane !== want && Math.abs(c.z - laneZ(c.dir, c.lane)) < 0.6) { if (laneFree(c, c.lane + Math.sign(want - c.lane), 1, 1)) c.lane += Math.sign(want - c.lane); }
    let vt = ch.pass ? 15 : Math.min(24, Math.sqrt(2 * 3.5 * Math.max(0, dS)) + (dS > 0.4 ? 0.4 : 0));
    if (!ch.pass && c.lane !== Lc && dS < 30) vt = Math.min(vt, Math.max(3, dS * 0.5));
    if (!ch.pass && dS < -0.5) { if (backFree(c)) c.x -= c.dir * Math.min(2 * dt, -dS - 0.2); c.v = 0; c.ch.lim = null; drive(c, 0, dt, 1, 9, 2); }   // назад до мястото си
    else { ch.lim = c.lane === Lc && !ch.pass ? Math.max(0, dS) : null; drive(c, vt, dt, 4, 8, 3.5); }
    ch.blk = c.v < 0.3 && Math.abs(c.vz) < 0.05 ? (ch.blk || 0) + dt : 0;
    if ((c.lane === Lc && Math.abs(dS) < 0.7 && c.v < 0.4 && Math.abs(c.z - laneZ(c.dir, Lc)) < 0.08) || ch.blk > 6) {   /* заклещена (кола между тях) — остава, където е */
      ch.ph = 'park'; ch.lim = null; c.v = 0; ch.yaw = ch.k % 2 ? 0.14 : -0.1; pose(c);
    }
  }
  function backFree(c) { const w = Wd(c) / 2; for (let i = 0; i < list.length; i++) { const q = list[i]; if (q === c || q.dir !== c.dir || q.s || q.away > 0 || q.ghost || q.inc === 'respawn') continue; if (Math.abs(q.z - c.z) > w + Wd(q) / 2 + 0.2) continue; const d = (c.x - q.x) * c.dir; if (d > 0 && d < (q.L + c.L) / 2 + 1.2) return false; } return true; }
  function leaveStep(c, dt) {
    const ch = c.ch;
    if (ch.role === 'fug' && Math.abs(ch.yaw) > 0.04) { ch.yaw = Math.atan2(Math.sin(ch.yaw), Math.cos(ch.yaw)); ch.yaw -= Math.sign(ch.yaw) * Math.min(Math.abs(ch.yaw), 0.7 * dt); drive(c, 1.5, dt, 1, 4, 1); return; }   // колата на беглеца (кара я полицай) — първо се изправя
    ch.lim = null; drive(c, 27, dt, 3.2, 8, 2.5);
    if (c.x * c.dir > half - 4) despawn(c);
  }
  // ---- пътната помощ (катастрофа): по отворената лента до мястото пред останките, встрани в затворената, вдига ги (3 s), тръгва
  function towStep(dt) {
    const F = C.F, Lc = C.cl.lane, Lo = Lc === 0 ? 1 : Lc - 1;
    if (!C.tow) { const m = K2 && K2.tow(false); if (!m) { C.tow = { ch: { ph: 'none' } }; return; }
      m.rotation.y = YAW(C.D); C.G.add(m); const c = { o: m, dir: C.D, x: C.X0, lane: Lo, z: laneZ(C.D, Lo), v: 22, v0: 26, L: TOW_L, heavy: false, cool: 0, inc: 'chase', vz: 0, ch: { role: 'tow', ph: 'go', yaw: 0, inL: false, k: 0 } };
      if (!laneFree(c, Lo, 10, 30)) { C.G.remove(m); return; } C.cars.push(c); C.tow = c; enter(c); pose(c); return; }
    const c = C.tow, ch = c.ch; if (ch.ph === 'none' || ch.ph === 'gone') return;
    const sT = C.sF + (F.L + TOW_L) / 2 + 1.4, dS = sT - sOf(c.x);
    if (ch.ph === 'go') { ch.lim = Math.max(0, dS); drive(c, dS > 0.3 ? Math.min(24, Math.sqrt(2 * 3 * dS) + 0.3) : 0, dt, 3, 7, 2); if (dS < 0.6 && c.v < 0.5) { ch.ph = 'in'; c.lane = Lc; ch.lim = 0; } return; }
    if (ch.ph === 'in') { drive(c, 0, dt, 1, 8, 1.4); if (Math.abs(c.z - laneZ(c.dir, Lc)) < 0.03) { ch.ph = 'hoist'; dropPeople(); } return; }
    if (ch.ph === 'hoist') {
      if (!ch.load) { const sc = c.o.scale.x || 1, d = new THREE.Object3D(); d.position.set(0, 0.35 / sc, -(TOW_L / 2 + F.L / 2 - 0.35) / sc); d.rotation.x = -0.09; c.o.add(d); ch.load = { t: 0, p0: F.o.position.clone(), q0: F.o.quaternion.clone(), d }; }
      const Lo2 = ch.load; Lo2.t = Math.min(1, Lo2.t + dt / 3); const u = Lo2.t * Lo2.t * (3 - 2 * Lo2.t);
      C.G.updateMatrixWorld(true); Lo2.d.getWorldPosition(V); C.G.worldToLocal(V); C.G.getWorldQuaternion(Q).invert(); Lo2.d.getWorldQuaternion(Q2); Q.multiply(Q2);
      F.o.position.lerpVectors(Lo2.p0, V, u); F.o.quaternion.slerpQuaternions(Lo2.q0, Q, u);
      if (Lo2.t >= 1) { c.o.attach(F.o); F.ch.ph = 'cargo'; unlist(F); F.ch.inL = false; for (const m of C.haz) m.visible = false; ch.ph = 'out'; ch.lim = null; c.lane = Lo; ch.tOut = C.t; }
      return;
    }
    if (ch.ph === 'out') { if (Math.abs(c.z - laneZ(c.dir, Lo)) > 0.05) drive(c, 0, dt, 1, 8, 1.4); else leaveStep(c, dt); }
  }

  function update(dt) {
    if (!C) {
      if (feature('hw-chase') && wait < 90 && !burntP) loadBurnt();   /* изгорялата кола — малко преди гонката */
      if (feature('hw-chase') && (wait -= dt) <= 0) { wait = rnd(...EVERY); const inc = T.inc && T.inc(); if (!(inc && inc.busy)) Promise.resolve(start()).then(r => { if (r && r.fail) wait = 90; }); }
      return;
    }
    C.t += dt; const F = C.F, D = C.D;
    if (api.cam && F.o.parent) { F.o.getWorldPosition(V); C.G.visible = V.distanceTo(api.cam.position) < FAR; }
    if (C.ph === 'wait') {   // въезд: свободна лента в началото на участъка
      for (let l = 0; l < NL && C.ph === 'wait'; l++) { F.lane = l; F.z = laneZ(D, l); F.x = C.X0; if (laneFree(F, l, 10, 45)) { F.v = F.ch.vmax; enter(F); pose(F); C.ph = 'run'; C.tRun = C.t;
        C.P.forEach((c, i) => { if (c.ch.role !== 'pol') return; c.lane = (l + i) % NL; c.z = laneZ(D, c.lane); c.x = xOf(-22 - i * 13); c.v = VF; pose(c); });
        emit('start'); } }
      if (C.ph === 'wait' && C.t > 25) finish();
      return;
    }
    if (K2 && C.pp.length) K2.update(dt, api.cam ? api.cam.position : null);   // хората — преди позата на ръцете
    // колоната: челото и опашката (за отбиващите коли отпред)
    C.head = sOf(F.x); C.tail = C.head; for (let i = 0; i < C.P.length; i++) { const c = C.P[i]; if (c.ch.inL && c.ch.role === 'pol') C.tail = Math.min(C.tail, sOf(c.x)); }
    if (C.ph === 'run') {
      runF(F, dt, true);
      for (let i = 0; i < C.P.length; i++) { const c = C.P[i]; if (c.ch.role === 'pol') runP(c, dt); }
      const s = C.head, sub = C.sub;
      if (C.out === 'crash' && s >= C.sEnd) { C.ph = 'act'; F.ch.spin = (Math.random() < 0.5 ? -1 : 1) * rnd(2.2, 3); F.ch.side = Math.random() < 0.6 ? 1 : -1; F.ch.vzc = F.ch.side * D * rnd(6, 8); F.ch.lose = true; }
      else if (sub === 'pit' && s >= C.sEnd - 170) C.ph = 'act';
      else if (sub === 'block' && s >= Math.max(80, C.sEnd - 120)) { C.ph = 'act'; F.ch.vmax = 37; }
      else if (sub === 'spike' && s >= C.sEnd - 170) C.ph = 'act';
      if (C.ph !== 'act' && s > len - 260) { C.ph = 'act'; F.ch.force = true; }   // предпазно: краят на участъка — спира
    } else if (C.ph === 'act') {
      const ch = F.ch;
      if (ch.lose) {   // загуби контрол: върти се, плъзга се напреки, намалява; при катастрофа — в мантинелата
        ch.yaw += ch.spin * dt; ch.spin *= Math.exp(-(C.out === 'crash' && !C.tHit ? 0.25 : 1.1) * dt); F.v = Math.max(0, F.v - (C.out === 'crash' ? 6.5 : 7.5) * dt);
        const ob = obst(F); let ds = F.v * dt; if (ob) ds = Math.min(ds, Math.max(0, ob.gap - 0.3)); if (ob && ob.gap < 0.6 && F.v > 3) F.v *= 0.6; F.x += D * ds;
        const zR = laneZ(D, RIGHT) + D * (LW / 2 - Wd(F) / 2 + 0.3), zM = laneZ(D, 0) - D * (LW / 2 - Wd(F) / 2 + 0.3);
        F.z += ch.vzc * dt;
        if (C.out === 'crash' && !C.tHit && ((ch.side > 0 && (F.z - zR) * D >= 0) || (ch.side < 0 && (F.z - zM) * D <= 0) || C.t - C.tAct > 6)) {
          F.z = ch.side > 0 ? zR : zM; ch.vzc = -ch.vzc * 0.12; F.v *= 0.5; ch.spin = -ch.spin * 0.45 + rnd(-0.8, 0.8); C.tHit = C.t; crashFx(); emit('crash'); }
        else { ch.vzc *= Math.exp(-(C.tHit || C.out !== 'crash' ? 1.6 : 0) * dt); if ((F.z - zR) * D > 0) { F.z = zR; ch.vzc = 0; } if ((F.z - zM) * D < 0) { F.z = zM; ch.vzc = 0; } }
        F.o.position.set(F.x, Y(F.x), F.z); F.o.rotation.y = YAW(D) + ch.yaw;
        if (F.v < 0.25 && (C.out !== 'crash' || C.tHit)) stopped();
        if (C.tHit != null && C.ph === 'act') fxStep(dt);
      } else if (ch.flat || ch.force) {   // спукани гуми / предпазно: намалява и отбива вдясно към банкета
        F.ch.vmax = Math.max(0, F.ch.vmax - (ch.force ? 3 : 5.2) * dt);
        if (F.lane !== RIGHT && Math.abs(F.z - laneZ(D, F.lane)) < 0.6 && laneFree(F, F.lane + 1, 2, 6)) F.lane++;
        ch.zt = F.lane === RIGHT && F.v < 18 ? laneZ(D, RIGHT) + D * Math.min(0.75, (LW - Wd(F)) / 2 - 0.05) : undefined;
        ch.yaw = ch.flat ? Math.sin(C.t * 7) * 0.05 * Math.min(1, F.v / 15) : 0;
        drive(F, F.ch.vmax, dt, 2, 7, 2.2, ch.zt);
        if (F.v < 0.2 && F.ch.vmax <= 0.05) { ch.yaw = 0; stopped(); }
      } else runF(F, dt, false, C.sub === 'block' || C.sub === 'pit');
      if (C.ph === 'act') {
        if (C.sub === 'pit' && !ch.force) { pitStep(dt); for (let i = 1; i < C.P.length; i++) runP(C.P[i], dt); if (!C.P[0].ch.hit && C.head > C.sEnd + 220) ch.force = true; }
        else if (C.sub === 'block') { if (C.brk) { ch.zt = F.lane === RIGHT && F.v < 15 ? laneZ(D, RIGHT) + D * Math.min(0.75, (LW - Wd(F)) / 2 - 0.05) : undefined; if (F.v < 0.2 && C.P[0].ch.vb <= 0) stopped(); } if (C.ph === 'act') blockStep(dt); if (F.lane !== RIGHT && !C.brk && Math.abs(F.z - laneZ(D, F.lane)) < 0.5 && laneFree(F, F.lane + 1, 3, 6)) F.lane++; }
        else { for (let i = 0; i < C.P.length; i++) { const c = C.P[i]; if (c.ch.role === 'pol') runP(c, dt); } }
        if (C.sub === 'spike') {
          if (!C.strip && C.head < C.sEnd) { const M = geo(), sg = new THREE.Group(), z0 = laneZ(D, 0) - D * LW / 2, z1 = laneZ(D, RIGHT) + D * LW / 2, w = Math.abs(z1 - z0), x = xOf(C.sEnd); const b = new THREE.Mesh(M.strip, M.mStrip); b.scale.z = w; sg.add(b);
            for (let k = 0; k < 24; k++) { const sp = new THREE.Mesh(M.spike, M.mSpike); sp.position.set((k % 2 ? 0.07 : -0.07), 0, (k / 23 - 0.5) * (w - 0.2)); sg.add(sp); } sg.position.set(x, Y(x), (z0 + z1) / 2); C.G.add(sg); C.strip = sg; }
          if (!ch.flat && C.head >= C.sEnd) { ch.flat = true; C.tFlat = C.t; F.ch.vmax = F.v; }
          if (C.strip && ch.flat && C.t - C.tFlat > 2.5) { C.G.remove(C.strip); C.strip = null; }   // полицаят прибира шиповете
        }
      }
      if (C.ph === 'act' && C.tAct == null) C.tAct = C.t;
    } else {   // след спирането: полицията обгражда, хората, конусите, пътната помощ, тръгване
      const tS = C.t - C.tStop, crash = C.out === 'crash';
      { const on = Math.floor(C.t * 1.5) % 2 === 0; for (let i = 0; i < C.haz.length; i++) C.haz[i].visible = on && F.ch.ph !== 'cargo' && !C.burnt && (C.ph === 'box' || C.ph === 'hold'); }
      let parked = 0, total = 0;
      for (let i = 0; i < C.P.length; i++) { const c = C.P[i], ph = c.ch.ph; if (ph === 'gone') continue; total++; if (ph === 'slot') goSlot(c, dt); else if (ph === 'leave') leaveStep(c, dt); else if (ph === 'park') parked++; }
      if (C.ph === 'box' && (parked === total || tS > 14)) { C.ph = 'hold'; C.tHold = C.t; if (!C.cones.length) setCones(); }
      if (!C.drv && !C.drvDone && tS > (crash ? 5 : 2.5) && K2) {   // шофьорът зад колата с ръце горе, двама полицаи до него
        C.drvDone = true; const sg = Math.sign(edges(C.cl.lane).zo - edges(C.cl.lane).zb), sD = C.sF - F.L / 2 - 1.7, zD = F.z;
        const d = put('ped', 'idle', sD, zD, sD - 4, zD); if (d) C.drv = { p: d, B: handsUp(d) };
        put('cop', 'talk', sD - 2.4, zD - sg * 1.2, sD, zD); put('cop', 'idle', sD - 2.1, zD + sg * 1.1, sD, zD);
      }
      if (C.drv && C.drv.B && C.G.visible) poseUp(C.drv.p, C.drv.B);
      if (crash) { fxStep(dt); if (tS > 14 && (!C.tow || C.tow.ch.ph !== 'none')) towStep(dt); }
      const done = crash ? C.tow && (C.tow.ch.ph === 'none' || (C.tow.ch.ph === 'out' && C.t - C.tow.ch.tOut > 3) || C.tow.ch.ph === 'gone') : tS > 22;
      if (C.ph === 'hold' && done) {   // всички си тръгват: отпред назад, през ~1,3 s; беглецът — отведен (колата — с полицай)
        C.ph = 'leave'; dropPeople(); if (C.tow && C.tow.ch.ph === 'none') { F.o.visible = false; despawn(F); }
        C.lq = C.P.filter(c => c.ch.ph !== 'gone'); if (!crash) C.lq.push(F); C.lq.sort((a, b) => sOf(b.x) - sOf(a.x)); C.lT = 0;
        for (const m of C.haz) m.visible = false;
      }
      if (C.ph === 'leave') {
        if (C.lq.length && (C.lT -= dt) <= 0) { const c = C.lq.shift(); c.ch.ph = 'leave'; c.o.userData.beaconsOn = 0; C.lT = 1.3; }
        if (!crash && F.ch.ph === 'leave') leaveStep(F, dt);
        let away = !C.lq.length; for (let i = 0; i < C.P.length && away; i++) { const c = C.P[i]; if (c.ch.ph !== 'gone' && sOf(c.x) <= C.cl.s1 + 25) away = false; }
        if (away && (crash || F.ch.ph === 'gone' || sOf(F.x) > C.cl.s1 + 25)) C.ph = 'clear';
      }
      if (C.ph === 'clear') {
        if (!crash && F.ch.ph === 'leave') leaveStep(F, dt);
        C.kT = (C.kT || 0) + dt; while (C.kT > 0.35 && C.cones.length) { C.kT -= 0.35; const c = C.cones.pop(); c.parent && c.parent.remove(c); }
        let all = !C.cones.length && C.kT > 1.5; for (let i = 0; i < C.cars.length && all; i++) { const ph = C.cars[i].ch.ph; if (ph !== 'gone' && ph !== 'none' && ph !== 'cargo') all = false; }
        if (all) finish();
      }
    }
    if (C && C.t > 420) finish();   // предпазно
  }
  function finish(quiet) {
    if (!C) return;
    for (const c of C.cars) if (c.ch.ph !== 'gone') despawn(c);
    if (C.ghost) unlist(C.ghost);
    if (K2) K2.reset(); g.remove(C.G); C = null; wait = rnd(...EVERY);
    if (!quiet) emit('end');
  }
  // ---- за hwtraffic.js: колите отпред отбиват вдясно и намаляват; затворената лента — престрояване („цип“), бавно покрай мястото
  const yieldZ = (c, s) => C && (C.ph === 'run' || C.ph === 'act') && c.dir === C.D && !c.inc && s > C.tail - 10 && s < C.head + 240;
  function need(c) {
    if (!C || c.dir !== C.D || C.ph === 'wait') return null; const s = sOf(c.x), cl = C.cl;
    if (cl && c.lane === cl.lane && s > cl.s0 - (cl.soft ? 150 : 260) && s < cl.s1) { const d = cl.s0 - s; return { l: cl.lane === 0 ? 1 : cl.lane - 1, b: d < 70 ? 4 : 12, f: d < 70 ? 4 : 16 }; }
    if (yieldZ(c, s) && c.lane < RIGHT && !(cl && cl.lane === c.lane + 1 && s > cl.s0 - 260 && s < cl.s1)) return { l: c.lane + 1, b: 8, f: 8 };   /* отбиват вдясно — лявата остава за гонката */
    return null;
  }
  function ok(c, l) {
    if (!C || c.dir !== C.D || C.ph === 'wait') return true; const s = sOf(c.x), cl = C.cl;
    if (cl && l === cl.lane && s > cl.s0 - 220 && s < cl.s1) return false;
    return !(l < c.lane && yieldZ(c, s));
  }
  function vcap(c) {
    if (!C || C.ph === 'wait') return 0; const s = sOf(c.x), cl = C.cl;
    if (c.dir !== C.D) return cl && !cl.soft && C.sF != null && Math.abs(s - C.sF) < 140 ? 19 : 0;
    let v = yieldZ(c, s) ? Math.max(9, c.v0 * 0.6) : 0;
    if (cl && !cl.soft && s > cl.s0 - 400 && s < cl.s1 + 40) { const z0 = cl.s0 - 140, vv = s < z0 ? Math.sqrt(169 + 4 * (z0 - s)) : 13; v = v ? Math.min(v, vv) : vv; }
    return v && v < c.v0 ? v : 0;
  }
  // ---- камерата и хеликоптерът: къде е беглецът (в света) и накъде е гонката
  function follow() {
    if (!C) return null; const F = C.F;
    if (C.ph !== 'wait' && F.o.parent && F.ch.ph !== 'gone' && !(F.ch.ph === 'cargo' && C.tow && C.tow.ch.ph === 'gone')) F.o.getWorldPosition(V); else { const s = C.ph === 'wait' ? 0 : C.sF ?? C.head; V.set(xOf(s), Y(xOf(s)), F.z); g.updateWorldMatrix(true, false); g.localToWorld(V); }
    V2.set(C.D, 0, 0).transformDirection(g.matrixWorld); FO.x = V.x; FO.y = V.y; FO.z = V.z; FO.fx = V2.x; FO.fz = V2.z; FO.fast = C.ph === 'run' || C.ph === 'act'; return FO;
  }
  // за Лабораторията/тестовете
  function info() {
    if (!C) return { on: false, wait: Math.round(wait), k2: K2 === null ? 'loading' : !!K2, fug: SPORTY.find(n => A[n]) || null, police: POL.filter(n => A[n]) };
    let ov = 0; const L = list.filter(q => !q.ghost && !q.s && !(q.away > 0) && q.inc !== 'respawn' && q.inc !== 'cargo' && (!q.o || q.o.visible));
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i], b = L[j]; if (a.dir !== b.dir || (a.inc !== 'chase' && b.inc !== 'chase')) continue; if (Math.abs(a.z - b.z) < (Wd(a) + Wd(b)) / 2 - 0.3 && Math.abs(a.x - b.x) < (a.L + b.L) / 2 - 0.4) ov++; }
    return { on: true, out: C.out, sub: C.sub, ph: C.ph, t: +C.t.toFixed(1), D: C.D, len: Math.round(len), sEnd: Math.round(C.sEnd), sF: C.sF != null ? Math.round(C.sF) : null, vis: C.G.visible,
      F: [Math.round(sOf(C.F.x)), C.F.lane, +C.F.v.toFixed(1), +C.F.z.toFixed(1), C.F.ch.ph], P: C.P.map(c => `${c.ch.ph}:${Math.round(sOf(c.x))}:${c.lane}:${c.v.toFixed(0)}${c.ch.pass ? ':p' : ''}${c.ch.slot != null ? ':' + Math.round(c.ch.slot) : ''}`), tow: C.tow ? (C.tow.o ? [C.tow.ch.ph, Math.round(sOf(C.tow.x)), C.tow.lane, +C.tow.v.toFixed(1), (o => o ? [Math.round(sOf(o.q.x)), o.q.lane, +o.q.z.toFixed(1), +o.q.v.toFixed(1), o.q.inc || '', +o.gap.toFixed(1)] : null)(obst(C.tow))] : C.tow.ch.ph) : null,
      cl: C.cl && [C.cl.lane, Math.round(C.cl.s0), Math.round(C.cl.s1)], cones: C.cones.length, people: C.pp.length, burnt: C.burnt === 'err' ? C.err : !!C.burnt, burntL: C.burntL ? C.burntL.length : null, fire: +C.fire.toFixed(2), hit: C.tHit != null,
      yielding: list.filter(q => !q.inc && yieldZ(q, sOf(q.x))).length, overlap: ov };
  }
  return Object.assign(api, { update, start, finish, need, ok, vcap, follow, target: follow, info, get busy() { return !!C; } });
}
