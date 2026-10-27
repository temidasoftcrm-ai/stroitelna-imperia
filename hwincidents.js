// hwincidents.js — 🚧 инциденти по магистралата край града (Лабораторията → hw-incidents; hwtraffic.js го създава).
// Видове: удар отзад в бързата лента · аварирал ТИР в дясната лента · горяща кола · ТИР изсипа товара.
// Ход (по игровото време — на пауза спира): ударът, колите отзад спират, аварийните светлини мигат → идва полиция с бурканите
// (по бързата лента; при задръстване — по „спасителния коридор“ между лявата и останалите ленти) → спира зад мястото,
// конуси на 60–90 м (стеснение), ремарке със светеща стрелка, полицай маха на колите → колите се престрояват „цип“ преди
// конусите и минават бавно (зяпат) → линейка / пожарна (гасят с маркучите) → пътна помощ вдига останките и ги откарва →
// конусите се прибират, полицията тръгва, лентите се отварят. Изсипаният товар при изходи към града (hw-ramps): платното се
// затваря изцяло, а движението се отбива по изхода преди мястото (втора полицейска кола, конуси и стрелка там).
// Колите не минават през конусите и останките: в лентите стоят „призраци“ (неподвижни препятствия в списъка на трафика).
// Хората, кордонът, маркучите и пътната помощ — от incidents2.js; спешните коли — моделите на играта (sf-car-*), с бурканите.
import * as THREE from 'three';
import { canvasTex } from './texdata.js';   // fac-data (T1): статичните платна → собствени данни (не се губят)
import { feature } from './lab/feature.js';
import { loadInc2, createInc2Kit } from './incidents2.js';
import { flameSprite, flameSize } from './fireflip.js';
import { lampMats } from './vehmodels.js';

const EVERY = [240, 480];   // игрови секунди между два инцидента
const W8 = { rear: 3, truck: 2, fire: 2, spill: 1 };
const KINDS = { police: ['sf-car-Police_SUV', 'sf-car-Police_Sedan', 'police'], ambulance: ['sf-car-Ambulance'], fire: ['sf-car-Firetruck'] };
const TOW_L = 5.66;
let TX = null, CM = null;
const tex = () => TX || (TX = (() => {
  const rad = st => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31); for (const [o, col] of st) gr.addColorStop(o, col); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return canvasTex(c); };
  const c = document.createElement('canvas'); c.width = 128; c.height = 96; const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, 128, 96); x.fillStyle = '#ffb21a';
  const dot = (px, py) => { x.beginPath(); x.arc(px, py, 5.5, 0, 7); x.fill(); };
  for (let i = 0; i < 7; i++) dot(18 + i * 13, 48); for (let i = 1; i <= 3; i++) { dot(96 - i * 11, 48 - i * 11); dot(96 - i * 11, 48 + i * 11); }   // стрелка надясно от точки
  const arrow = canvasTex(c); arrow.colorSpace = THREE.SRGBColorSpace;
  return { smoke: rad([[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]), fire: rad([[0, 'rgba(255,250,200,1)'], [0.35, 'rgba(255,170,40,0.9)'], [1, 'rgba(255,60,0,0)']]), arrow };
})());
const cones = () => CM || (CM = { g: new THREE.ConeGeometry(0.24, 0.72, 10).translate(0, 0.41, 0), b: new THREE.CylinderGeometry(0.14, 0.18, 0.12, 10).translate(0, 0.45, 0), f: new THREE.BoxGeometry(0.46, 0.05, 0.46).translate(0, 0.025, 0),
  m: new THREE.MeshStandardMaterial({ color: 0xff5a00, roughness: 0.6 }), w: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }), k: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 }),
  box: new THREE.MeshStandardMaterial({ color: 0x9a6b3c, roughness: 0.9 }), soot: new THREE.MeshStandardMaterial({ color: 0x1c1b1a, roughness: 1, metalness: 0 }) });
// ремарке със светеща стрелка: лицето (локално +z) — към идващите коли; right — стрелката надясно (по посоката им)
function boardTrailer(right) {
  const g = new THREE.Group(), yel = new THREE.MeshStandardMaterial({ color: 0xf0c020, roughness: 0.6 }), blk = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 }), box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
  box(1.5, 0.5, 1.7, yel, 0, 0.62, 0); box(0.08, 0.08, 1.3, blk, 0, 0.45, -1.4); box(0.12, 1.6, 0.12, blk, 0, 1.6, 0.1); box(2.1, 1.55, 0.1, blk, 0, 2.62, 0.1);
  for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12).rotateZ(Math.PI / 2), blk); w.position.set(sx * 0.8, 0.3, 0); g.add(w); }
  const mat = new THREE.MeshBasicMaterial({ map: tex().arrow, toneMapped: false }), pl = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.45), mat); pl.position.set(0, 2.62, 0.16); if (!right) pl.scale.x = -1; g.add(pl);
  const lamps = [-1, 1].map(sx => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb020, toneMapped: false })); l.position.set(sx * 0.9, 3.5, 0.1); g.add(l); return l; });
  g.userData.blink = on => { mat.color.setScalar(on ? 1 : 0.16); for (const l of lamps) l.material.color.setHex(on ? 0xffb020 : 0x3a2400); };
  return g;
}

const HW_NM = { rear: '💥 Катастрофа на магистралата', truck: '🚛 Аварирал ТИР на магистралата', fire: '🔥 Горяща кола на магистралата', spill: '📦 ТИР изсипа товара на магистралата' };   // ui-batch2: известието
// T — от hwtraffic.js: групата, списъкът с колите, лентите, препятствията (leaderIn/followerIn/freeLane) и моделите
export function createHwIncidents(T) {
  const { g, list, laneZ, NL, RIGHT, half, y, lift, ab, freeLane, leaderIn, followerIn, mk, A, lenOf, rampCx, svc, em } = T;
  const LW = ab ? 3.6 : 4.4, SH = ab ? 1 : 0.9, BR = lampMats(), V = new THREE.Vector3(), Q = new THREE.Quaternion();
  const Y = x => y + (lift ? lift(x) : 0), YAW = d => d > 0 ? Math.PI / 2 : -Math.PI / 2, Wd = c => c.W || (c.W = Math.max(1.8, Math.min(2.55, c.L * 0.42)));
  const rnd = (a, b) => a + Math.random() * (b - a);
  let I = null, wait = rnd(...EVERY) * 0.6, K2 = null, kp = null, req = null; const pend = [];
  const sOf = x => (x - I.X0) * I.D, xOf = s => I.X0 + I.D * s, pose = c => c.o.position.set(c.x, Y(c.x), c.z);
  const firstOpen = () => { for (let l = 0; l < NL; l++) if (!I.closed.has(l)) return l; return 0; };
  // мястото: ~250 м преди него (опашката, полицията идва отзад) и 90 м след него — по платното; когато се затваря дясната лента,
  // конусите (−130…+90 м) — не върху отбивката/включването на комплекса и на изходите към града
  function valid(x, D, ty) {
    const a = Math.min(x - D * 250, x + D * 90), b = Math.max(x - D * 250, x + D * 90);
    if (a < -half + 15 || b > half - 15) return false;
    if (ty === 'rear') return true;
    const c0 = Math.min(x - D * 130, x + D * 90), c1 = Math.max(x - D * 130, x + D * 90), hit = (p, q) => q > c0 && p < c1;
    if (svc && D > 0 && hit(svc.z0 - 40, svc.z1 + 40)) return false;
    if (rampCx != null) { const T = rampCx - D * 330, M = rampCx + D * 300; if (hit(T - 30, T + 30) || hit(Math.min(M - D * 40, M + D * 40), Math.max(M - D * 40, M + D * 40))) return false; }
    return true;
  }
  function pickCar(type, D, pref) {
    const want = type === 'rear' ? c => !c.heavy && c.lane === 0 : type === 'fire' ? c => !c.heavy && c.lane === RIGHT : c => c.heavy && c.lane === RIGHT;
    let best = null, bd = 1e9;
    for (const c of list) { const xs = c.x + D * c.v * c.v / (2 * (type === 'rear' ? 8 : type === 'spill' ? 4.5 : 2.6));   // къде ще спре
      if (c.inc || c.s || c.away || c.dir !== D || !want(c) || Math.abs(c.z - laneZ(D, c.lane)) > 0.3 || !valid(xs, D, type) || Math.abs(xs - pref) > 260) continue;
      let b = null; if (type === 'rear') { const f = followerIn(c, 0); if (!f || f.gap > 55 || f.q.inc || f.q.heavy || f.q.s || f.q.lane !== 0 || Math.abs(f.q.z - laneZ(D, 0)) > 0.3) continue; b = f.q; }
      const d = Math.abs(xs - pref); if (d < bd) { bd = d; best = [c, b]; } }
    return best;
  }
  // ---- хора (incidents2): на (s, z) с лице към (ts, tz)
  function put(kind, anim, s, z, ts, tz, arr) { if (!K2) return null; const x = xOf(s), p = K2.put(I.G, kind, anim, x, z, xOf(ts), tz); if (p) { p.position.y = Y(x); (arr || I.pp).push(p); } return p; }
  const drop = arr => { for (const p of arr.splice(0)) if (p.parent) p.parent.remove(p); };
  // ---- конуси и „призраци“ (неподвижни препятствия в лентите)
  function cone(s, z, arr) { const C = cones(), c = new THREE.Group(), x = xOf(s); c.add(new THREE.Mesh(C.g, C.m), new THREE.Mesh(C.b, C.w), new THREE.Mesh(C.f, C.k)); c.position.set(x, Y(x), z); I.G.add(c); arr.push(c); }
  function coneLine(arr, s0, z0, s1, z1, step, skip) { const n = Math.max(1, Math.round(Math.abs(s1 - s0) / step)); for (let k = 0; k <= n; k++) { const s = s0 + (s1 - s0) * k / n; if (!skip || !skip(s)) cone(s, z0 + (z1 - z0) * k / n, arr); } }
  function ghost(l, s, L = 0.6, hard = false) { const q = { ghost: true, inc: 'ghost', hard, dir: I.D, lane: l, z: laneZ(I.D, l), x: xOf(s), L, v: 0, v0: 1, W: LW - 0.3, cool: 0, heavy: true }; list.push(q); I.ghosts.push(q); return q; }
  const unlist = q => { const i = list.indexOf(q); if (i >= 0) list.splice(i, 1); };
  // краищата на затворения блок: zo — външният ръб (откъм банкета или разделителя), zb — границата с отворените ленти
  function edges(set) { const D = I.D, ls = [...set].sort((a, b) => a - b); return ls[0] === 0 ? { zo: laneZ(D, 0) - D * (LW / 2 - 0.45), zb: laneZ(D, ls[ls.length - 1]) + D * LW / 2, other: laneZ(D, RIGHT) + D * (LW / 2 - 0.45) } : { zo: laneZ(D, RIGHT) + D * (LW / 2 - 0.45), zb: laneZ(D, ls[0]) - D * LW / 2, other: laneZ(D, 0) - D * (LW / 2 - 0.45) }; }

  // ---- за hwtraffic.js: може ли колата c в лента l (не влиза в затворените около мястото)
  function ok(c, l) {
    if (!I || !I.formed || c.dir !== I.D) return true; const s = sOf(c.x);
    if (I.div && l < RIGHT && s > I.div.s - 600 && s < I.div.s + 5) return false;   // отбиването: само дясната лента до изхода
    return !(I.closed.has(l) && s > I.s0 - 220 && s < I.s1);
  }
  // задължително престрояване (и ТИР-овете): от затворената лента — към най-близката отворена; „цип“ — с малки дистанции до конусите
  function need(c) {
    if (I && I.formed && c.dir === I.D) {
      const s = sOf(c.x);
      if (I.div && c.lane < RIGHT && s > I.div.s - 600 && s < I.div.s - 3) { const d = I.div.s - 150 - s; return { l: c.lane + 1, b: d < 70 ? 4 : 12, f: d < 70 ? 4 : 15 }; }
      if (I.closed.has(c.lane) && s > I.s0 - 260 && s < (I.cones.length ? I.s0 + 2 : I.s1)) {
        let best = null; for (let l = 0; l < NL; l++) if (!I.closed.has(l) && (best == null || Math.abs(l - c.lane) < Math.abs(best - c.lane))) best = l;
        if (best == null) return null; const d = I.s0 - s; return { l: c.lane + Math.sign(best - c.lane), b: d < 70 ? 4 : 12, f: d < 70 ? 4 : 16 };
      }
    }
    if (c.heavy && c.lane < RIGHT && ok(c, c.lane + 1)) return { l: c.lane + 1, b: 20, f: 30 };   // ТИР-овете — обратно вдясно след мястото
    return null;
  }
  // скоростта: преди и покрай мястото — бавно (зяпат), плавно намаляване; насрещното платно — малко по-бавно; „цип“ — пуска една кола от затворената лента
  function vcap(c) {
    if (!I || !I.formed) return 0; const s = sOf(c.x);
    if (c.dir !== I.D) return Math.abs(s) < 140 ? 19 : 0;
    if (s < I.s0 - 400 || s > I.s1 + 60) return 0;
    const vz = I.cones.length ? 12 : 15, z0 = I.s0 - 140; let v = s < z0 ? Math.sqrt(vz * vz + 4 * (z0 - s)) : vz;
    if (I.cones.length && !I.closed.has(c.lane) && s > I.s0 - 120 && s < I.s0) for (const q of list) { if (q.inc || q.dir !== c.dir || Math.abs(q.lane - c.lane) !== 1 || !I.closed.has(q.lane) || q.v > 2) continue; const d = (q.x - c.x) * c.dir; if (d > 2 && d < 14) { v = Math.min(v, 1); break; } }
    return v < c.v0 ? v : 0;
  }
  const divert = c => !!(I && I.div && c.dir === I.D);

  // ---- спешните коли: свои „шофьори“ — лента, спиране на място (slot), коридор при задръстване, никога през препятствие
  function spawn(kind, slot, o = {}) {
    const D = I.D, x = -D * (half - 4), lane = I.cones.length || I.div ? firstOpen() : 0;
    if (list.some(q => q.dir === D && !q.ghost && Math.abs(q.x - x) < 35 && Math.abs(q.z - laneZ(D, lane)) < 2.6)) return null;
    let m = null, L = null;
    if (kind === 'tow') { m = K2 && K2.tow(!!o.big); if (!m) return null;   /* tow-trucks: на магистралата при голям ремонт — тежкият влекач */ if (o.big) m.scale.setScalar(10 / TOW_L); L = o.big ? 10 : TOW_L; }
    else { const n = KINDS[kind].find(q => A[q]); if (!n) return null; m = mk(n); m.userData.beaconsOn = 1; m.userData.sirenOn = false; }
    m.rotation.y = YAW(D);
    const c = { o: m, dir: D, x, lane, z: laneZ(D, lane), v: 24, v0: 28, L: L ?? lenOf(m), heavy: false, cool: 0, inc: 'resp', R: { kind, slot, ph: 'go', stopX: xOf(slot[0]), corrT: 0, big: o.big } };
    pose(c); I.G.add(m); list.push(c); I.resp.push(c); return c;
  }
  // препятствието отпред по ширина (не по лента): коли, спешни, останки; конусите (призраците) — само твърдите (товарът)
  function obst(c) { let best = null, bd = 1e9; const w = Wd(c) / 2;
    for (const q of list) { if (q === c || q.dir !== c.dir || q.s || q.away || q.inc === 'respawn' || (q.ghost && !q.hard) || q === c.R.cargo) continue; const d = (q.x - c.x) * c.dir; if (d <= 0 || d > 300) continue; if (Math.abs(q.z - c.z) > w + Wd(q) / 2 + 0.15) continue; if (d < bd) { bd = d; best = q; } }
    return best ? { q: best, gap: bd - (best.L + c.L) / 2 } : null; }
  const latFree = (c, z) => !list.some(q => q !== c && q.dir === c.dir && !q.s && !q.away && q.inc !== 'respawn' && (!q.ghost || q.hard) && q !== c.R.cargo && Math.abs(q.x - c.x) < (q.L + c.L) / 2 + 0.8 && Math.abs(q.z - z) < (Wd(q) + Wd(c)) / 2 + 0.1 && Math.abs(q.z - z) < Math.abs(q.z - c.z));
  function drive(c, dt) {
    const R = c.R, D = c.dir; let vt = R.ph === 'leave' ? 27 : 28, zt;
    const dS = R.stopX == null ? 1e9 : (R.stopX - c.x) * D;
    // коридорът: при задръстване отпред (далеч от мястото) — между лявата и останалите ленти; колите отпред се отместват
    const jam = R.ph === 'go' && dS > 170 && sOf(c.x) < I.s0 - 170 && list.some(q => q.dir === D && !q.inc && !q.s && !q.away && q.v < 7 && (d => d > 0 && d < 220)((q.x - c.x) * D));
    if (jam) R.corrT = 2; else R.corrT -= dt;
    R.corr = R.corrT > 0;
    if (R.corr) { zt = (laneZ(D, 0) + laneZ(D, 1)) / 2; c.lane = 0; }
    else {
      let want = c.lane;
      const pre = !I.cones.length;   // преди конусите (първата полиция): влиза в лентата на мястото отрано, отзад; после — през пролуката до мястото
      if (R.ph === 'go') want = (pre ? dS < 70 : dS < 8) ? R.slot[1] : (I.cones.length || I.div ? firstOpen() : 0);
      else if (R.ph === 'leave' && sOf(c.x) < I.s1) { const ld = leaderIn(c, c.lane); if (ld && ld.q.inc && ld.q.inc !== 'resp' && !ld.q.ghost) { let b = null; for (let l = 0; l < NL; l++) if (!I.closed.has(l) && (b == null || Math.abs(l - c.lane) < Math.abs(b - c.lane))) b = l; if (b != null) want = b; } }   // останките отпред — излиза през пролуката в отворената лента
      if (c.lane !== want && Math.abs(c.z - laneZ(D, c.lane)) < 0.3 && (c.cool -= dt) <= 0) {
        const nl = c.lane + Math.sign(want - c.lane), near = dS < 60 || R.ph !== 'go', at = R.ph === 'go' && nl === R.slot[1] && !pre;
        let go = freeLane(c, nl, at ? 1.5 : near ? 4 : 14, at ? 1.5 : near ? 4 : 14);   // на мястото (зад конусите) — само неподвижните са там
        if (go && R.ph === 'go' && nl === R.slot[1]) { const ld = leaderIn(c, nl); if (ld && (ld.q.x - R.stopX) * D < (ld.q.L + c.L) / 2 - 0.5) go = false; }   // в лентата на мястото — само ако до него няма друг
        if (go) { c.lane = nl; c.cool = 0.8; }
      }
      zt = laneZ(D, c.lane);
      if (R.ph === 'go' && c.lane !== R.slot[1]) vt = Math.min(vt, Math.sqrt(2 * 2.5 * Math.max(0, dS - (pre ? 30 : 0))));   // спира (до мястото / 30 м преди него) и се престроява
    }
    if (R.ph === 'go' && !R.corr) vt = Math.min(vt, Math.sqrt(2 * 2.5 * Math.max(0, dS)) + (dS > 0.3 ? 0.4 : 0));
    if (R.ph === 'hold') vt = 0;
    const ld = obst(c); if (ld) vt = Math.min(vt, Math.sqrt(ld.q.v * ld.q.v + 2 * 4 * Math.max(0, ld.gap - 2.5)));
    c.v += Math.max(-7 * dt, Math.min(2.6 * dt, vt - c.v)); c.v = Math.max(0, c.v);
    let ds = c.v * dt; if (ld) ds = Math.min(ds, Math.max(0, ld.gap - 0.6)); if (R.ph === 'go' && !R.corr && c.lane === R.slot[1]) ds = Math.min(ds, Math.max(0, dS));
    c.x += D * ds;
    const dz = Math.sign(zt - c.z) * Math.min(Math.abs(zt - c.z), 1.6 * dt); if (dz && latFree(c, c.z + dz)) c.z += dz;
    pose(c); c.o.rotation.y = YAW(D) - D * Math.atan2(dz / Math.max(dt, 1e-3), Math.max(3, c.v));
    if (R.ph === 'go' && c.lane === R.slot[1] && !R.corr && Math.abs(dS) < 0.6 && c.v < 0.3 && Math.abs(c.z - zt) < 0.05) { R.ph = 'hold'; R.tPark = I.t; c.v = 0; }
    if (R.ph === 'leave' && c.x * D > half - 3) despawn(c);
  }
  function leave(c) { if (!c || c.R.ph === 'leave' || c.R.ph === 'gone') return; c.R.ph = 'leave'; c.R.stopX = null; if (c.R.kind !== 'tow') c.o.userData.beaconsOn = 0; }
  function despawn(c) { c.R.ph = 'gone'; unlist(c); if (c.R.cargo) { g.attach(c.R.cargo.o); toPend(c.R.cargo); c.R.cargo = null; } c.o.parent && c.o.parent.remove(c.o); }
  const parked = c => c && c.R.ph === 'hold', gone = c => !c || c.R.ph === 'gone' || (c.R.ph === 'leave' && sOf(c.x) > I.s1 + 30);
  // повредените коли се връщат в движението отначалото (след пътната помощ)
  function toPend(c) { unlist(c); c.inc = 'respawn'; c.o.visible = false; c.rg = 0; if (!pend.includes(c)) pend.push(c); }
  function hazOff(c) { for (const m of c.haz || []) m.visible = false; if (I) I.haz = I.haz.filter(m => !(c.haz || []).includes(m)); }
  function unfreeze(c) { delete c.inc; c.v = 0; hazOff(c); }
  function respawn() {
    for (const c of pend.slice()) { const lane = c.heavy ? RIGHT : (Math.random() * NL) | 0, x = -c.dir * (half - 3), z = laneZ(c.dir, lane);
      if (list.some(q => q !== c && q.dir === c.dir && !q.s && !q.away && Math.abs(q.x - x) < 40 && Math.abs(q.z - z) < 2.6)) continue;
      pend.splice(pend.indexOf(c), 1); delete c.inc; list.push(c); Object.assign(c, { x, z, lane, v: c.v0 * 0.7, cool: 2 }); if (c._sc) c.o.scale.copy(c._sc); c.o.rotation.set(0, YAW(c.dir), 0); c.o.visible = true; pose(c);
      if (c.soot) { for (const [m, mt] of c.soot) { if (mt === 'hide') m.visible = true; else m.material = mt; } c.soot = null; } for (const m of c.haz || []) m.visible = false; }
  }
  // пътната помощ вдига останките (3 s) и ги закача отзад
  function hoist(tw, w, dt) {
    const R = tw.R;
    if (!R.load) { w._sc = w.o.scale.clone(); const sc = tw.o.scale.x, d = new THREE.Object3D(); d.position.set(0, 0.35 / sc, -(tw.L / 2 + w.L / 2 - 0.35) / sc); d.rotation.x = w.L > 12 ? -0.035 : -0.09; tw.o.add(d); tw.o.updateMatrixWorld(true);
      R.load = { t: 0, p0: w.o.position.clone(), q0: w.o.quaternion.clone(), d }; drop(I.drivers.splice(0, w === I.wreck[0] ? 1 : 0)); }
    const Lo = R.load; if (Lo.t >= 1) return true; Lo.t = Math.min(1, Lo.t + dt / 3); const u = Lo.t * Lo.t * (3 - 2 * Lo.t);
    g.updateMatrixWorld(true); const p1 = g.worldToLocal(Lo.d.getWorldPosition(V)), q1 = g.getWorldQuaternion(Q).invert().multiply(Lo.d.getWorldQuaternion(new THREE.Quaternion()));
    w.o.position.lerpVectors(Lo.p0, p1, u); w.o.quaternion.slerpQuaternions(Lo.q0, q1, u);
    if (Lo.t >= 1) { tw.o.attach(w.o); R.cargo = w; w.inc = 'cargo'; unlist(w); hazOff(w); return true; }
    return false;
  }

  function start(type, o = {}) {
    if (K2 === null) { if (!kp) kp = loadInc2().then(l => { K2 = l ? createInc2Kit(l) : false; }).catch(() => { K2 = false; }); return kp.then(() => start(type, o)); }
    if (I) finish();
    type = W8[type] ? type : (r => { for (const k in W8) if ((r -= W8[k]) <= 0) return k; return 'rear'; })(Math.random() * 8);
    const D = o.dir || (Math.random() < 0.5 ? 1 : -1);
    let pref = o.x ?? (rampCx != null ? rampCx + D * 150 : D * 60);
    if (!valid(pref, D, type)) { let bx = null; for (let x = -half; x <= half; x += 10) if (valid(x, D, type) && (bx == null || Math.abs(x - pref) < Math.abs(bx - pref))) bx = x; if (bx == null) return { fail: 'spot', half, rampCx, svc: svc && [Math.round(svc.z0), Math.round(svc.z1)] }; pref = bx; }
    const pk = pickCar(type, D, pref); if (!pk) { req = { type, o: { ...o, dir: D }, t: o.retry ?? 40 }; return { pending: true, pref: Math.round(pref) }; }   // няма подходяща кола там сега — опитва пак, докато дойде
    req = null;
    const [a, b] = pk;
    I = { type, D, X0: a.x, WL: a.L, t: 0, G: new THREE.Group(), wreck: b ? [a, b] : [a], resp: [], ghosts: [], cones: [], cones2: [], closed: new Set(), s0: -1, s1: 30, haz: [], pp: [], drivers: [], medics: [], ffs: [], boxes: [], fx: { flames: [], puffs: [] }, hoses: [], fire: 0, formed: false, ph: 'crash' };
    g.add(I.G);
    for (const e of em) if (e.on && e.dir === D) { e.on = false; e.o.visible = false; }   // минаващата спешна кола в това платно — не през мястото
    a.inc = 'stop'; a.dec = type === 'rear' ? 8 : type === 'spill' ? 4.5 : 2.6; a.zt = laneZ(D, a.lane) + (type === 'truck' || type === 'fire' ? D * (ab ? 0.45 : 0.7) : 0);
    if (b) { b.inc = 'crash'; b.zt = laneZ(D, 0); }
    for (const c of I.wreck) { c.rg = 0; c.haz = []; c.o.traverse(m => { if (m.userData.lamp === 'blink') c.haz.push(m); }); I.haz.push(...c.haz); }
    if (feature('ui-batch2')) try {   // ui-batch2: известието с „👁️ Гледай“ (game.js incNotice) — мястото и камерата като в hwIncLook, в световни координати
      const p = spot(); g.updateWorldMatrix(true, false); const w = (x, yy, z) => g.localToWorld(new THREE.Vector3(x, yy, z)), at = w(p.x - p.D * 10, 1, p.z), cam = w(p.x - p.D * 80, 26, p.z + p.D * 34);
      dispatchEvent(new CustomEvent('stroi-inc', { detail: { nm: HW_NM[type] || '🚧 Инцидент на магистралата', x: at.x, z: at.z, cam: { x: cam.x, y: cam.y, z: cam.z } } }));
    } catch { }
    return { type, dir: D, x: Math.round(a.x), lane: a.lane, pair: !!b };
  }
  // ударът: първата спира рязко (или плавно — аварирала/горяща), втората се забива в нея
  function form(dt) {
    const [a, b] = I.wreck, D = I.D;
    if (a.inc === 'stop') { a.v = Math.max(0, a.v - a.dec * dt); let st = a.v * dt; const ld = leaderIn(a, a.lane); if (ld) st = Math.min(st, Math.max(0, ld.gap - 0.6)); a.x += D * st; a.z += Math.sign(a.zt - a.z) * Math.min(Math.abs(a.zt - a.z), 0.8 * dt); pose(a); if (a.v === 0 && Math.abs(a.zt - a.z) < 0.02) a.inc = 'wreck'; }
    if (b && b.inc === 'crash') { b.v = Math.max(a.inc === 'wreck' ? 6 : 0, b.v - 2.5 * dt); const gap = (a.x - b.x) * D - (a.L + b.L) / 2, st = b.v * dt;
      if (a.inc === 'wreck' && st >= gap - 0.05) { b.x += D * Math.max(0, gap - 0.05); b.v = 0; b.inc = 'wreck'; a.o.rotation.y = YAW(D) + 0.13; b.o.rotation.y = YAW(D) - 0.2; a.z -= D * 0.25; b.z += D * 0.2; pose(a); }
      else b.x += D * Math.min(st, Math.max(0, gap - 0.05));
      pose(b); }
    if (I.wreck.every(c => c.inc === 'wreck')) onFormed();
  }
  function onFormed() {
    const D = I.D, ty = I.type, a = I.wreck[0]; let r = 1e9, f = -1e9; for (const c of I.wreck) { r = Math.min(r, c.x * D - c.L / 2); f = Math.max(f, c.x * D + c.L / 2); }
    I.X0 = r * D; I.WL = f - r; I.formed = true; I.tF = I.t; I.ph = 'wait';
    I.closed = new Set(ty === 'rear' ? (ab ? [0, 1] : [0]) : ty === 'truck' ? [RIGHT] : ab ? [RIGHT - 1, RIGHT] : [RIGHT]);
    const WL = I.WL, big = ty === 'truck', tl = big ? 10 : TOW_L;
    I.slots = { rear: { P: [-24, 0], AMB: [-10, 0], TOW: [WL + 5 + tl / 2, 0] }, truck: { P: [-24, RIGHT], TOW: [WL + 5 + tl / 2, RIGHT] }, fire: { P: [-34, RIGHT], FIRE: [-15, RIGHT], TOW: [WL + 5 + tl / 2, RIGHT] }, spill: { P: [-28, RIGHT] } }[ty];
    const SL = I.slots, TL = I.closed.size > 1 ? 90 : 60, t1 = SL.P[0] - 10.6;
    I.S = { TL, t1, t0: t1 - TL, end: (SL.TOW ? SL.TOW[0] + tl / 2 : WL) + 4 }; I.s1 = I.S.end + 15; I.s0 = -1; I.big = big;
    I.gaps = [['AMB', 6.6], ['FIRE', 10], ['TOW', tl]].filter(([k]) => SL[k]).map(([k, L]) => [SL[k][0] - L / 2 - 2.5, SL[k][0] + L / 2 + 2.5]);
    const E = edges(I.closed), edge = laneZ(D, RIGHT) + D * (LW / 2 + 1.3);   // зад мантинелата, на банкета
    if (ty === 'rear') { const z = ab ? laneZ(D, 1) - D * 0.4 : laneZ(D, 0) - D * 1.85; put('ped', 'phone', WL * 0.78, z, WL * 0.3, z, I.drivers); put('ped', 'argue', WL * 0.25, z, WL * 0.78, z, I.drivers); I.steam = 1; }
    else put('ped', ty === 'spill' ? 'argue' : 'phone', ty === 'spill' ? WL * 0.2 : -8, edge, 0, a.z, I.drivers);
    if (ty === 'spill') { const C = cones(); for (let k = 0; k < 18; k++) { const s = rnd(-12, -1), z = E.zb + (E.zo - E.zb) * rnd(0.08, 0.95), x = xOf(s), bx = new THREE.Mesh(new THREE.BoxGeometry(rnd(0.6, 1.1), rnd(0.5, 0.9), rnd(0.6, 1.1)), C.box); bx.position.set(x, Y(x) + 0.35, z); bx.rotation.set(rnd(-0.3, 0.3), rnd(0, 6.28), rnd(-0.3, 0.3)); I.G.add(bx); I.boxes.push(bx); }
      for (const l of I.closed) ghost(l, -6.5, 11.5, true); I.s0 = -13; }
    if (ty === 'fire' || ty === 'rear') { const t = tex(), fire = ty === 'fire';
      for (let k = 0; k < (fire ? 9 : 5); k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.smoke, color: fire ? 0x333333 : 0xbbbbbb, transparent: true, depthWrite: false, opacity: 0 })); s.userData.ph = k / (fire ? 9 : 5); I.G.add(s); I.fx.puffs.push(s); }
      if (fire) for (let k = 0; k < 3; k++) { const s = feature('fire-real') ? flameSprite() : new THREE.Sprite(new THREE.SpriteMaterial({ map: t.fire, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.userData.flip = feature('fire-real'); s.userData.k = k; I.G.add(s); I.fx.flames.push(s); } }
  }
  // конусите: стеснение (taper) от външния ръб до границата, линия покрай мястото (с пролуки, откъдето влизат линейката/пожарната/пътната помощ),
  // ремарке със стрелка в стеснението, полицай, който маха на колите; призраци в затворените ленти в началото на стеснението
  function setCones() {
    const E = edges(I.closed), S = I.S, skip = s => I.gaps.some(([a, b]) => s > a && s < b);
    coneLine(I.cones, S.t0, E.zo, S.t1, E.zb, 6.5); coneLine(I.cones, S.t1 + 9, E.zb, S.end, E.zb, 9, skip);
    for (const l of I.closed) ghost(l, S.t0 - 1); I.s0 = S.t0 - 1;
    const bd = boardTrailer(!I.closed.has(RIGHT)), sb = S.t0 + S.TL * 0.6, xb = xOf(sb); bd.position.set(xb, Y(xb), E.zo + (E.zb - E.zo) * 0.27); bd.rotation.y = YAW(-I.D); I.G.add(bd); I.boards = [bd];
    put('cop', 'wave', S.t0 + S.TL * 0.35, E.zo + (E.zb - E.zo) * 0.15, S.t0 - 40, E.zo + (E.zb - E.zo) * 0.5, I.pp);
    if (I.type === 'rear') put('cop', 'talk', I.WL * 0.5, I.drivers[0] ? I.drivers[0].position.z + I.D * (ab ? 1.4 : 0) : laneZ(I.D, 0), I.WL * 0.78, I.drivers[0] ? I.drivers[0].position.z : laneZ(I.D, 0), I.pp);
    I.ph = 'work'; I.tC = I.t;
  }
  // отбиването (изсипан товар, има изходи): втората полиция преди изхода, конусите затварят левите ленти → всички излизат
  function setDivert() {
    const D = I.D, sd = I.div.s, zm = laneZ(D, 0) - D * (LW / 2 - 0.45), zbR = laneZ(D, RIGHT) - D * LW / 2, zr = laneZ(D, RIGHT) + D * (LW / 2 - 0.45);
    coneLine(I.cones2, sd - 150, zm, sd - 40, zbR, 7); coneLine(I.cones2, sd - 31, zbR, sd + 25, zbR, 8); coneLine(I.cones2, sd + 27, zbR, sd + 27, zr, 1.4);
    for (let l = 0; l < RIGHT; l++) ghost(l, sd - 151); ghost(RIGHT, sd + 26);
    const bd = boardTrailer(true), x = xOf(sd - 80); bd.position.set(x, Y(x), zm + (zbR - zm) * 0.22); bd.rotation.y = YAW(-D); I.G.add(bd); I.boards.push(bd);
    put('cop', 'wave', sd - 8, zbR - D * 1.2, sd - 60, zbR, I.pp); I.div.on = true;
  }
  function closeAll() {   // цялото платно: второ стеснение от другия ръб — „V“ до мястото
    const E = edges(I.closed), S = I.S; coneLine(I.cones, S.t0, E.other, S.t1, E.zb, 6.5);
    for (let l = 0; l < NL; l++) if (!I.closed.has(l)) { ghost(l, S.t0 - 1); I.closed.add(l); }
    I.full = true; I.tFull = I.t;
  }
  const clearOf = (s0, s1, all) => { const E = edges(I.closed), sg = Math.sign(E.zo - E.zb); return !list.some(q => !q.inc && !q.s && !q.away && q.dir === I.D && (s => s > s0 && s < s1)(sOf(q.x)) && (all || (q.z - E.zb) * sg > -Wd(q) / 2 - 0.2)); };

  function update(dt) {
    respawn();
    if (!I && req && req.t <= 0) req = null;   // заявката (за тест) изтече — иначе автоматичните инциденти не тръгват повече
    if (!I && req && (req.t -= dt) > 0 && (req.k = (req.k || 0) + dt) > 0.5) { req.k = 0; start(req.type, { ...req.o, retry: req.t }); }
    if (!I) { if (feature('hw-incidents') && !req && (wait -= dt) <= 0) { wait = rnd(...EVERY); const r = start(); if (!r || r.pending || r.fail) wait = 20, req = null; } return; }
    I.t += dt;
    if (!I.formed) { form(dt); if (!I.formed && I.t > 30) { for (const c of I.wreck) { c.v = 0; c.inc = 'wreck'; } onFormed(); } if (!I.formed) return; }
    const D = I.D, ty = I.type, SL = I.slots, t = I.t;
    // аварийните (по игровото време), стоповете на колите отзад, коридорът
    { const on = Math.floor(t * 1.5) % 2 === 0; for (const m of I.haz) m.visible = on; }
    for (const c of list) { if (c.inc || c.s || c.away) continue; c.rg = 0;
      if (c.dir === D) { const s = sOf(c.x), br = s > -700 && s < I.s1 && ((c.v < (c._pv ?? c.v) - 0.8 * dt) || c.v < 1.5); if (br !== !!c._br) { if (!c._rear) { c._rear = []; c.o.traverse(m => { if (m.userData.lamp === 'rear') c._rear.push(m); }); c._rm = c._rear[0] && c._rear[0].material; } for (const m of c._rear) m.material = br ? BR.brake : c._rm; c._br = br; } }
      c._pv = c.v; }
    for (const r of I.resp) if (r.R.corr) for (const q of list) { if (q.inc || q.dir !== D || q.s || q.away) continue; const d = (q.x - r.x) * D; if (d > 0 && d < 200 && sOf(q.x) < I.s0 - 150 && Math.abs(q.z - laneZ(D, q.lane)) < SH + 0.35) q.rg = (q.lane === 0 ? -1 : 1) * D * SH; }
    for (const c of I.resp.slice()) if (c.R.ph !== 'gone') drive(c, dt);
    // огън, дим, пара
    if (ty === 'fire') { if (!I.hose) I.fire = Math.min(1, I.fire + dt / 8); else I.fire = Math.max(0, I.fire - dt / 18);
      if (I.fire > 0.6 && !I.wreck[0].soot) { const c = I.wreck[0], C = cones(); c.soot = []; c.o.traverse(m => { if (!m.isMesh || m.userData.lamp) return; if ([].concat(m.material).some(q => q && q.transparent)) { c.soot.push([m, 'hide']); m.visible = false; } else { c.soot.push([m, m.material]); m.material = C.soot; } }); } }
    { const a = I.wreck[0], cg = a.R || a.inc === 'respawn' ? null : a, bx = cg ? cg.x : 0, k = ty === 'fire' ? I.fire : I.steam ? Math.max(0, 1 - (t - I.tF) / 60) * 0.5 : 0, P = cg && cg.o.parent === g;
      I.fx.puffs.forEach(s => { const ph = (t * 0.22 + s.userData.ph) % 1, big = ty === 'fire' ? 1.7 : 0.6, hx = ty === 'rear' ? a.x + D * a.L * 0.4 : bx; s.position.set(hx + Math.sin(ph * 9) * 0.5 * big, Y(hx) + 1 + ph * 9 * big, a.z + ph * 2 * big); s.scale.setScalar((1.2 + ph * 5) * big); s.material.opacity = P ? 0.55 * (1 - ph) * Math.min(1, k + (ty === 'fire' && I.hose && I.fire < 0.5 ? 0.25 : 0)) : 0; });
      I.fx.flames.forEach(s => { const f = 0.75 + 0.25 * Math.sin(t * 11 + s.userData.k * 2) * Math.sin(t * 7.3 + s.userData.k), sz = (s.userData.k ? 2.2 : 3.2) * I.fire, x = bx + (s.userData.k - 1) * 0.9 * D; s.visible = P && I.fire > 0.02; s.position.set(x, Y(x) + 0.9 + (s.userData.flip ? -sz * 0.35 : 0), a.z + (s.userData.k === 2 ? 0.4 : 0)); if (s.userData.flip) flameSize(s, Math.max(0.01, sz * (1.2 + 0.2 * f))); else s.scale.set(Math.max(0.01, sz * f * 0.8), Math.max(0.01, sz * f * 1.25), 1); }); }
    for (const H of I.hoses) { const on = I.fire > 0.02, a = H.p.position.clone(); const q = new THREE.Vector3(I.wreck[0].x, Y(I.wreck[0].x) + 1, I.wreck[0].z), d = Math.hypot(q.x - a.x, q.z - a.z) || 1; a.x += (q.x - a.x) / d * 0.6; a.z += (q.z - a.z) / d * 0.6; a.y += 1.2; if (on) H.s.set(a, q, Math.min(3, d * 0.18)); H.s.update(dt, on); }
    if (K2) K2.update(dt, null);
    if (I.boards) { const on = Math.floor(performance.now() / 500) % 2 === 0; for (const b of I.boards) b.userData.blink(on); }
    // ---- ходът
    if (!I.P && t - I.tF > 4) I.P = spawn('police', SL.P);
    if (I.ph === 'wait' && parked(I.P) && clearOf(I.S.t0 - 5, I.S.end + 2)) setCones();
    if (I.ph === 'work') {
      const tc = t - I.tC;
      if (SL.AMB && !I.AMB && tc > 2) I.AMB = spawn('ambulance', SL.AMB);
      if (SL.FIRE && !I.FIRE && tc > 1) I.FIRE = spawn('fire', SL.FIRE);
      if (I.AMB && parked(I.AMB)) { if (!I.medics.length) for (const p of I.drivers.slice(0, 2)) for (const k of [-1, 1]) put('medic', 'idle', (p.position.x - I.X0) * D + k * 1.1, p.position.z + D * 0.6 * (ab ? 1 : -0.3), (p.position.x - I.X0) * D, p.position.z, I.medics); if (t - I.AMB.R.tPark > 22) { leave(I.AMB); drop(I.medics); } }
      if (I.FIRE && parked(I.FIRE)) { if (!I.ffs.length && K2) { const zc = laneZ(D, RIGHT); for (const [s, z] of [[-7, zc - D * 1.4], [I.WL + 2.8, zc + D * 0.5]]) { const p = put('ff', 'idle', s, z, I.WL / 2, I.wreck[0].z, I.ffs); if (p) I.hoses.push({ p, s: K2.stream(I.G) }); } }
        if (t - I.FIRE.R.tPark > 3) I.hose = true; if (I.hose && I.fire <= 0 && (I.fireOut ??= t) && t - I.fireOut > 10) { leave(I.FIRE); drop(I.ffs); for (const H of I.hoses) H.s.update(0, false); I.hoses = []; } }
      const towOk = ty === 'rear' ? tc > 12 : ty === 'truck' ? tc > 3 : ty === 'fire' ? I.hose && I.fire < 0.3 : false;
      if (SL.TOW && !I.TOW && towOk && K2) { if (I.noTow ??= !K2.tow()) { I.TOW = { R: { ph: 'leave', kind: 'tow' } }; unfreeze(I.wreck[0]); } else I.TOW = spawn('tow', SL.TOW, { big: I.big }); }   // без модел на пътната помощ — колата тръгва сама
      if (I.TOW && I.TOW.o && parked(I.TOW) && (!I.FIRE || I.fire <= 0)) { if (hoist(I.TOW, I.wreck[0], dt) && (I.TOW.R.lt = (I.TOW.R.lt ?? 0) + dt) > 2) leave(I.TOW); }
      // ударената отзад (по-леко) — тръгва сама след пътната помощ
      if (ty === 'rear' && I.wreck[1] && I.wreck[1].inc === 'wreck' && I.TOW && I.TOW.R.ph === 'leave' && (!I.TOW.o || sOf(I.TOW.x) > I.WL + 30)) { unfreeze(I.wreck[1]); drop(I.drivers); }
      if (ty === 'spill') {
        if (rampCx != null && !I.div && tc > 3) I.div = { s: sOf(rampCx - D * 330) };
        if (I.div && !I.P2) I.P2 = spawn('police', [I.div.s - 18, RIGHT - 1]);
        if (I.div && !I.div.on && parked(I.P2)) setDivert();
        if (I.div && I.div.on && !I.full && clearOf(I.div.s - 5, I.S.end + 5, true)) closeAll();
        const go = I.div ? I.full && t - I.tFull > 3 : tc > 5;
        if (go && !I.workers) { I.workers = []; for (const k of [0, 1]) put('cop', 'idle', -4 - k * 5, laneZ(D, RIGHT) - D * k * 1.2, -8, laneZ(D, RIGHT), I.workers); I.tW = t; }
        if (I.workers && I.boxes.length && (I.tB = (I.tB ?? 2) - dt) <= 0) { I.tB = 1.2; const bx = I.boxes.pop(); bx.parent.remove(bx); }   // прибират товара
        if (I.workers && !I.boxes.length && I.wreck[0].inc === 'wreck') { unlistGhosts(true); unfreeze(I.wreck[0]); drop(I.drivers); }
      }
      // готово: останките са махнати, линейката/пожарната са тръгнали → прибиране на конусите
      const wreckGone = I.wreck.every(c => c.inc !== 'wreck' && c.inc !== 'stop' && (c.inc || !list.includes(c) || sOf(c.x) > I.s1 + 20 || c.s || c.away));
      if (wreckGone && gone(I.AMB) && gone(I.FIRE) && (!SL.TOW || gone(I.TOW))) { I.ph = 'clear'; I.tK = t; drop(I.workers || []); }
    }
    if (I.ph === 'clear') {
      I.kT = (I.kT || 0) + dt; while (I.kT > 0.35 && (I.cones.length || I.cones2.length)) { I.kT -= 0.35; const c = (I.cones2.length ? I.cones2 : I.cones).pop(); c.parent.remove(c); }   // конусите — един по един
      if (!I.cones.length && !I.cones2.length && I.kT > 1) { for (const b of I.boards || []) b.parent.remove(b); I.boards = []; drop(I.pp); unlistGhosts(); I.closed.clear(); I.div = null; I.full = false; leave(I.P); leave(I.P2); I.ph = 'leave'; }
    }
    if (I.ph === 'leave' && I.resp.every(c => c.R.ph === 'gone')) finish();
    if (I && t > 480) finish();   // предпазно
  }
  function unlistGhosts(hardOnly = false) { for (const q of I.ghosts.slice()) if (!hardOnly || q.hard) { unlist(q); I.ghosts.splice(I.ghosts.indexOf(q), 1); } }
  function finish() {
    if (!I) return;
    for (const c of I.resp) if (c.R.ph !== 'gone') despawn(c);
    unlistGhosts();
    for (const c of I.wreck) if (c.inc) toPend(c);
    for (const c of list) { c.rg = 0; if (c._br) { for (const m of c._rear) m.material = c._rm; c._br = false; } }
    for (const m of I.haz) m.visible = false;
    if (K2) K2.reset(); g.remove(I.G); I = null; wait = rnd(...EVERY);
  }
  // за Лабораторията/тестовете: къде е, какво става, застъпвания (коли една в друга) и коли в затворената зона
  function info(full) {
    if (!I) return { on: false, models: Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.find(q => A[q]) || null])), pend: pend.length, req: req && [req.type, Math.round(req.t)], k2: K2 === null ? 'loading' : !!K2 };
    let ov = 0, intr = 0; const L = list.filter(q => !q.ghost && !q.s && !q.away && q.inc !== 'respawn' && (!q.o || q.o.visible));
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i], b = L[j]; if (a.dir !== b.dir || (a.R && a.R.cargo === b) || (b.R && b.R.cargo === a) || (a.inc === 'wreck' && b.inc === 'wreck')) continue; if (Math.abs(a.z - b.z) < (Wd(a) + Wd(b)) / 2 - 0.25 && Math.abs(a.x - b.x) < (a.L + b.L) / 2 - 0.3) ov++; }
    if (I.cones.length) { const E = edges(I.closed), sg = Math.sign(E.zo - E.zb); for (const q of L) if (!q.inc && q.dir === I.D && (s => s > I.S.t1 && s < I.S.end)(sOf(q.x)) && (q.z - E.zb) * sg > -Wd(q) / 2 + 0.3) intr++; }
    const DQ = list.filter(q => !q.inc && q.dir === I.D && !q.s && !q.away);
    const near = full ? list.filter(q => q.dir === I.D && !q.s && !q.away && Math.abs(sOf(q.x) - 0) < 90).map(q => [Math.round(sOf(q.x)), q.lane, +(q.z - laneZ(I.D, q.lane)).toFixed(1), +q.v.toFixed(1), q.inc || '', Math.round(q.L), q.heavy ? 'H' : '', +(q.cool || 0).toFixed(1)].join(' ')).sort((a, b) => parseFloat(a) - parseFloat(b)) : undefined;
    return { near, on: true, type: I.type, D: I.D, ph: I.ph, t: Math.round(I.t), x: Math.round(I.X0), closed: [...I.closed], cones: I.cones.length + I.cones2.length, div: I.div ? (I.div.on ? 'on' : 'set') : null, full: !!I.full, fire: +I.fire.toFixed(2),
      resp: I.resp.map(c => `${c.R.kind}:${c.R.ph}:${Math.round(sOf(c.x))}:${c.lane}${c.R.corr ? 'C' : ''}`), queue: DQ.filter(q => q.v < 3 && sOf(q.x) < 0 && sOf(q.x) > -700).length, slow: DQ.filter(q => q.v < 13 && Math.abs(sOf(q.x)) < 150).length, away: list.filter(q => q.away > 0 || q.s).length, overlap: ov, intrude: intr };
  }
  const spot = () => I && { x: I.formed ? I.X0 : (a => a.x + I.D * a.v * a.v / (2 * a.dec))(I.wreck[0]), z: (laneZ(I.D, 0) + laneZ(I.D, RIGHT)) / 2, D: I.D, s0: I.S ? I.S.t0 : -80 };
  return { update, start, finish, ok, need, vcap, divert, info, spot, get busy() { return !!I; } };
}
