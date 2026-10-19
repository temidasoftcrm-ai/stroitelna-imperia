// traffic.js — трафикът в града (Лабораторията → traffic2): ленти → дистанция → кръстовища (→ фарове — по-късно).
// Опростена симулация без физика:
//  • Ленти: всяка улица — по една насочена траектория за всяка посока (вдясно или вляво — drive), отрязана преди възлите;
//    през възела — плавни свързващи криви (Безие) от всяка входяща към всяка изходяща лента (без обръщане назад).
//  • Дистанция: колите по пътека са подредени по позиция; всяка следи само предната (в своята пътека или в следващата),
//    ускорение по IDM (минимум + скорост × време + според разликата в скоростите), реалната дължина на колата;
//    твърдо ограничение за една стъпка — никога не минава през предната, дори при забавен кадър.
//  • Кръстовища: светофар с фази (оста А направо/надясно → оста А наляво → оста Б направо/надясно → оста Б наляво, с жълто и
//    кратко всички-червено); без светофар — предимство по главната улица и „дясно“; влиза се само при свободна конфликтна
//    зона (без пресичаща се заета крива) и място на изходящата лента след кръстовището.
//  • Фиксирана стъпка (1/30 s), отделена от рисуването: при 4× се правят повече стъпки, без прескачане; колите се рисуват
//    между последните две стъпки (плавно). Таванът на колите (maxCars) е само визуален — доставките са другаде.
//  • Светлините: фаровете светят с нощта (общият материал — новата кола веднага е в текущото състояние); стоповете — по-ярки при
//    спиране и денем; мигачите — преди и в завоя, независимо от часа; истински прожектори — само за 4-те най-близки до камерата
//    коли нощем (без сенки), с хистерезис около здрача.
// Мрежата: { nodes: [{ id, x, z, signal }], edges: [{ a, b, pts?: [[x,z]…], lanes: 1, w, rank }] } — сега от решетката
// на града (gridNetwork), после — от плана на улиците (част A).
import * as THREE from 'three';
import { lampMats, truckLamps } from './vehmodels.js';

const H = 1 / 30;                 // фиксираната стъпка, s
const V_LANE = 12, V_TURN = 6.5;  // желана скорост по улица / в завой, m/s
const A_MAX = 2.6, B_COMF = 3.5;  // ускорение и комфортно спиране, m/s²
const S0 = 2.2, T_HEAD = 1.1;     // минимална дистанция (m) и време до предната (s)
const G_TIME = 9, Y_TIME = 2.2, L_TIME = 4.5, ALLRED = 0.8;   // фазите на светофара, s

// ---- геометрия: полилиния с натрупани дължини; точка и посока по разстояние s
function mkPath(pts, kind, extra) {
  const cum = [0]; for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  return { pts, cum, len: cum[cum.length - 1], kind, cars: [], ...extra };
}
function at(p, s, out) {
  s = Math.max(0, Math.min(p.len, s)); let k = 1; while (k < p.cum.length - 1 && p.cum[k] < s) k++;
  const a = p.pts[k - 1], b = p.pts[k], d = p.cum[k] - p.cum[k - 1] || 1, t = (s - p.cum[k - 1]) / d;
  out.x = a[0] + (b[0] - a[0]) * t; out.z = a[1] + (b[1] - a[1]) * t; out.yaw = Math.atan2(b[0] - a[0], b[1] - a[1]); return out;
}
// отместване на полилиния встрани (лентата): d > 0 — вдясно по посоката на движение
function offset(pts, d) {
  return pts.map((p, k) => {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    return [p[0] - dz / l * d, p[1] + dx / l * d];   // дясно от посоката (x, z) е (−dz, dx)
  });
}
function trim(pts, a, b) {   // маха a метра отначало и b от края
  const p = mkPath(pts), s0 = Math.min(a, p.len * 0.45), s1 = Math.max(s0 + 0.5, p.len - b), out = [], o = {};
  at(p, s0, o); out.push([o.x, o.z]);
  for (let k = 1; k < pts.length - 1; k++) if (p.cum[k] > s0 && p.cum[k] < s1) out.push(pts[k]);
  at(p, s1, o); out.push([o.x, o.z]); return out;
}
// най-малкият радиус на кривата → скорост в завоя (странично ускорение ≤ 2,5 m/s²), поне 2 m/s
function curveV(pts, vmax) {
  let r = 1e9; for (let k = 1; k < pts.length - 1; k++) { const a = pts[k - 1], b = pts[k], q = pts[k + 1], A = Math.hypot(b[0] - a[0], b[1] - a[1]), B = Math.hypot(q[0] - b[0], q[1] - b[1]), C = Math.hypot(q[0] - a[0], q[1] - a[1]), ar = Math.abs((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])) / 2; if (ar > 1e-6) r = Math.min(r, A * B * C / (4 * ar)); }
  return Math.max(2, Math.min(vmax, Math.sqrt(2.5 * r)));
}
function bezier(p0, p1, p2, n = 10) { const out = []; for (let k = 0; k <= n; k++) { const t = k / n, u = 1 - t; out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]); } return out; }
const segX = (a, b, c, d) => { const r = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]); if (Math.abs(r) < 1e-9) return false; const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / r, u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / r; return t > 0.02 && t < 0.98 && u > 0.02 && u < 0.98; };
function crosses(p, q) { for (let i = 1; i < p.pts.length; i++) for (let j = 1; j < q.pts.length; j++) if (segX(p.pts[i - 1], p.pts[i], q.pts[j - 1], q.pts[j])) return true; return false; }

// ---- мрежа → ленти, връзки, възли
export function buildLanes(net, drive = 'right') {
  const side = drive === 'left' ? -1 : 1, nodes = new Map(net.nodes.map(n => [n.id, { ...n, inL: [], outL: [], conns: [], deg: 0, rad: 0 }]));
  for (const e of net.edges) { for (const id of [e.a, e.b]) { const n = nodes.get(id); n.deg++; n.rad = Math.max(n.rad, (e.w || 8) * 0.5 + 0.6); } }
  const lanes = [];
  for (const e of net.edges) {
    const A = nodes.get(e.a), B = nodes.get(e.b), pts = e.pts || [[A.x, A.z], [B.x, B.z]], lw = (e.w || 8) / 2 / (e.lanes || 1);
    for (const [from, to, P] of [[A, B, pts], [B, A, [...pts].reverse()]]) for (let k = 0; k < (e.lanes || 1); k++) {
      const lp = trim(offset(P, side * lw * (k + 0.5)), from.deg > 1 ? from.rad : 0, to.deg > 1 ? to.rad : 0);
      const L = mkPath(lp, 'lane', { from: from.id, to: to.id, edge: e, rank: e.rank || 1, vmax: e.vmax || V_LANE });
      lanes.push(L); from.outL.push(L); to.inL.push(L);
    }
  }
  // връзките през възлите: от всяка входяща към всяка изходяща лента (без обратно по същата улица)
  for (const n of nodes.values()) {
    for (const a of n.inL) for (const b of n.outL) {
      if (b.edge === a.edge) continue;
      const p0 = a.pts[a.pts.length - 1], p2 = b.pts[0], da = dirEnd(a), db = dirStart(b);
      const turn = Math.atan2(da[0] * db[1] - da[1] * db[0], da[0] * db[0] + da[1] * db[1]);   // > 0 — наляво (в x,z при поглед отгоре: ляво е −)
      const kind = Math.abs(turn) < 0.35 ? 'straight' : (turn * side < 0 ? 'right' : 'left');
      const ctrl = lineX(p0, da, p2, db) || [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2];
      const C = mkPath(bezier(p0, ctrl, p2, kind === 'straight' ? 2 : 10), 'conn', { node: n.id, inL: a, outL: b, turn: kind, vmax: kind === 'straight' ? V_LANE * 0.8 : V_TURN, occ: 0, conf: [] });
      n.conns.push(C);
    }
    for (const c of n.conns) for (const d of n.conns) if (c !== d && c.inL !== d.inL && (c.outL === d.outL || crosses(c, d))) c.conf.push(d);
    n.sig = n.signal && n.deg >= 3 ? makeSignal(n) : null;
  }
  return { lanes, nodes };
}
const dirEnd = p => { const a = p.pts[p.pts.length - 2], b = p.pts[p.pts.length - 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
const dirStart = p => { const a = p.pts[0], b = p.pts[1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
function lineX(p, d, q, e) { const r = d[0] * e[1] - d[1] * e[0]; if (Math.abs(r) < 0.05) return null; const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / r; return [p[0] + d[0] * t, p[1] + d[1] * t]; }

// ---- светофар: входящите ленти по две оси (по посоката); фази: А направо+надясно, А наляво, Б направо+надясно, Б наляво
function makeSignal(n) {
  const axis = l => { const d = dirEnd(l); return Math.abs(d[0]) > Math.abs(d[1]) ? 'ew' : 'ns'; };
  for (const l of n.inL) l.axis = axis(l);
  const ph = [['ns', 'go'], ['ns', 'left'], ['ew', 'go'], ['ew', 'left']].filter(([ax, k]) => n.inL.some(l => l.axis === ax) && (k === 'go' || n.conns.some(c => c.inL.axis === ax && c.turn === 'left')));
  return { ph, i: 0, t: Math.random() * G_TIME, stage: 'green' };
}
function sigStep(s, dt) {
  s.t += dt; const [, k] = s.ph[s.i], g = k === 'left' ? L_TIME : G_TIME;
  if (s.stage === 'green' && s.t > g) { s.stage = 'yellow'; s.t = 0; }
  else if (s.stage === 'yellow' && s.t > Y_TIME) { s.stage = 'red'; s.t = 0; }
  else if (s.stage === 'red' && s.t > ALLRED) { s.stage = 'green'; s.t = 0; s.i = (s.i + 1) % s.ph.length; }
}
// може ли да тръгне по връзката c (по светофара): зелено за оста и вида на завоя; при „наляво“ във фазата „направо“ — само ако няма
// насрещен поток (тогава лявото е в своята фаза)
function sigAllows(s, c) {
  if (s.stage !== 'green') return false; const [ax, k] = s.ph[s.i];
  if (c.inL.axis !== ax) return false;
  return k === 'left' ? c.turn === 'left' : c.turn !== 'left' || !s.ph.some(p => p[0] === ax && p[1] === 'left');
}
// фазата за изгледа (кръгчетата на светофарите в game.js): оста със зелено и дали е жълто
export const sigView = s => s ? { axis: s.ph[s.i][0], yellow: s.stage === 'yellow', red: s.stage === 'red', left: s.ph[s.i][1] === 'left' } : null;

// ---- симулацията
// opts: { scene, net, drive, makeCar() → { obj, len, kind }, maxCars, onSignal(node, view) }
export function createTraffic(opts) {
  const { lanes, nodes } = opts.built || buildLanes(opts.net, opts.drive);   // built — готова мрежа (planNetwork)
  // собствен генератор (seed) — симулацията не зависи от чуждите Math.random (three.js, интерфейса): еднаква при 1× и 4×
  let seed = (opts.seed || 1) >>> 0;
  const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const cars = [], tmp = {};
  // таван: ~30% от местата по лентите (иначе на късите улици между кръстовищата решетката се задръства)
  const capacity = Math.floor(lanes.reduce((t, l) => t + l.len, 0) / (4.5 + S0 + 2) * 0.3);
  let acc = 0, steps = 0, left = 0;
  const drop = v => { if (v.remove) v.remove(); else if (v.obj) opts.scene.remove(v.obj); };   // колата: обект (obj) или инстанция (set/remove)
  const free = (p, s, L) => p.cars.every(c => Math.abs(c.s - s) > (c.L + L) / 2 + S0 * 2);
  function spawn() {
    for (let k = 0; k < 12; k++) {
      const ins = lanes.filter(l => l.enter), fromEdge = ins.length && rnd() < 0.35, p = fromEdge ? ins[(rnd() * ins.length) | 0] : lanes[(rnd() * lanes.length) | 0]; if (p.len < 10) continue;
      const v = opts.makeCar(); if (!v) return null;
      const s = fromEdge ? 3 : 2 + rnd() * (p.len - 4);   // от входа на града — в началото на лентата
      if (!free(p, s, v.len)) { drop(v); continue; }   // без нова кола на заето място
      const c = { obj: v.obj, set: v.set, rm: v.remove, w: v.w || 1.9, h: v.h || 1.45, L: v.len, kind: v.kind, p, s, v: 0, next: null, px: 0, pz: 0, pyaw: 0, x: 0, z: 0, yaw: 0, wait: 0, a: 0 };
      c.rear = []; c.blinkL = []; c.blinkR = []; if (v.obj) v.obj.traverse(m => { const l = m.userData.lamp; if (l === 'rear') c.rear.push(m); else if (l === 'blink') (m.userData.side === 'L' ? c.blinkL : c.blinkR).push(m); });
      c.rearMat = c.rear[0]?.material; c.brake = false;
      insert(p, c); pickNext(c); at(p, s, tmp); c.x = c.px = tmp.x; c.z = c.pz = tmp.z; c.yaw = c.pyaw = tmp.yaw; cars.push(c); return c;
    }
    return null;
  }
  const insert = (p, c) => { let k = 0; while (k < p.cars.length && p.cars[k].s < c.s) k++; p.cars.splice(k, 0, c); };
  const remove = (p, c) => { const k = p.cars.indexOf(c); if (k >= 0) p.cars.splice(k, 1); };
  // следващата пътека: от лента — случайна връзка на възела (по-рядко обратно); от връзка — изходящата ѝ лента
  function pickNext(c) {
    if (c.p.kind === 'conn') { c.next = c.p.outL; return; }
    const n = nodes.get(c.p.to), L = n.conns.filter(x => x.inL === c.p);
    if (n.ring) { c.next = L.find(x => x.exitArm != null && x.exitArm === c.ringExit) || L.find(x => x.cont) || L[0] || null; return; }   // в пръстена: изходът или напред
    c.next = L.length ? L[(rnd() * L.length) | 0] : null;
    if (c.next && c.next.ringIn) c.ringExit = c.next.pickExit(rnd);   // влиза в кръгово — избира изход (не обратно)
  }
  // предната кола: в същата пътека (следващата по s) или в следващата (последната в нея) — разстояние между броните
  function leader(c) {
    const P = c.p.cars, k = P.indexOf(c);
    if (k < P.length - 1) { const f = P[k + 1]; return { gap: f.s - c.s - (f.L + c.L) / 2, v: f.v }; }
    const rest = c.p.len - c.s;
    if (c.next && c.next.cars.length) { const f = c.next.cars[0]; return { gap: rest + f.s - (f.L + c.L) / 2, v: f.v }; }
    if (c.next && c.next.kind === 'conn' && c.next.outL.cars.length) { const f = c.next.outL.cars[0]; return { gap: rest + c.next.len + f.s - (f.L + c.L) / 2, v: f.v }; }
    return null;
  }
  // може ли да влезе във връзката c.next (стоп линията): светофар/предимство, свободна конфликтна зона, място след кръстовището
  // без предимството: светофар, свободна конфликтна зона, място след кръстовището
  function canGo(c, C) {
    const n = nodes.get(C.node);
    if (n.sig && !sigAllows(n.sig, C)) return false;
    if (C.conf.some(d => d.cars.length)) return false;                       // пресичаща се крива — заета
    const tail = C.outL.cars[0];                                             // място след кръстовището
    if (tail && tail.s - tail.L / 2 < c.L + S0 + 1) return false;
    if (C.yieldTo && C.yieldTo.some(([seg, d]) => seg.cars.some(w => seg.len - w.s < d))) return false;   // кръгово: влизащият изчаква тези в пръстена
    return true;
  }
  function mayEnter(c) {
    const C = c.next; if (!C || C.kind !== 'conn') return true;
    if (!canGo(c, C)) return false;
    // предимство (без светофар): отстъпва само на кола, която чака на стоп линията и сама може да тръгне — иначе вечно блокиране
    if (!nodes.get(C.node).sig) for (const d of C.conf) { const w = d.inL.cars[d.inL.cars.length - 1]; if (w && w !== c && w.next === d && w.wait > 0 && priority(d, C, w, c) && canGo(w, d)) return false; }
    return true;
  }
  // d (кола w) има предимство пред C (кола c): главната улица; при равни — който чака по-дълго (без вечно блокиране)
  const priority = (d, C, w, c) => d.inL.rank !== C.inL.rank ? d.inL.rank > C.inL.rank && c.wait < 6 : w.wait > c.wait + 0.3;
  function step() {
    while (cars.length < Math.min(opts.maxCars || 40, capacity)) if (!spawn()) break;   // и новите коли — на стъпка (еднакво при 1× и 4×)
    for (const n of nodes.values()) if (n.sig) sigStep(n.sig, H);
    for (const c of cars) { c.px = c.x; c.pz = c.z; c.pyaw = c.yaw; }
    for (const c of cars) {
      const vmax = c.p.vmax, ld = leader(c);
      let gap = ld ? ld.gap : 1e9, dv = ld ? c.v - ld.v : 0;
      // стоп линията: ако не може да влезе — виртуално препятствие в края на лентата
      const stop = c.p.kind === 'lane' && c.next && c.p.len - c.s < 22 && !mayEnter(c);
      if (stop) { const g = c.p.len - c.s - c.L / 2 - 0.3; if (g < gap) { gap = g; dv = c.v; } c.wait += H; } else c.wait = 0;
      if (stop && c.wait > 6 && ((c.wait / H) | 0) % 90 === 0) pickNext(c);   // изходът дълго е зает — друга посока (шофьорът заобикаля)
      const ss = S0 + Math.max(0, c.v * T_HEAD + c.v * dv / (2 * Math.sqrt(A_MAX * B_COMF)));
      let a = A_MAX * (1 - Math.pow(c.v / vmax, 4) - (gap < 1e8 ? Math.pow(ss / Math.max(0.1, gap), 2) : 0));
      a = Math.max(-9, Math.min(A_MAX, a)); c.a = a;
      let v = Math.max(0, c.v + a * H), ds = v * H;
      if (gap < 1e8) { const lim = Math.max(0, gap - 0.4); if (ds > lim) { ds = lim; v = Math.min(v, lim / H); } }   // твърдото ограничение за стъпката
      c.v = v; c.s += ds;
      if (c.s >= c.p.len && c.p.leave) { c.gone = true; continue; }   // напуска града
      while (c.s >= c.p.len && c.next) {   // към следващата пътека
        if (c.p.kind === 'lane' && !mayEnter(c) && c.next.kind === 'conn') { c.s = c.p.len; c.v = 0; break; }
        const old = c.p; c.s -= old.len; remove(old, c); c.p = c.next; insert(c.p, c); pickNext(c);
      }
      if (c.s > c.p.len) c.s = c.p.len;
      at(c.p, c.s, tmp); c.x = tmp.x; c.z = tmp.z; c.yaw = tmp.yaw;
    }
    for (let k = cars.length - 1; k >= 0; k--) { const c = cars[k]; if (c.gone) { remove(c.p, c); drop({ obj: c.obj, remove: c.rm }); cars.splice(k, 1); left++; } }
    // блокирана дълго (вечно задръстване на затворен кръг) — изчезва и се появява на свободно място (трафикът е само за гледане)
    for (let k = cars.length - 1; k >= 0; k--) { const c = cars[k]; if (c.v < 0.05) c.stuck = (c.stuck || 0) + H; else c.stuck = 0; if (c.stuck > 40) { remove(c.p, c); drop({ obj: c.obj, remove: c.rm }); cars.splice(k, 1); } }
    steps++;
  }
  // стопове, мигачи и истинските прожектори
  const spots = []; let nightOn = false, LI = null;
  function lights() {
    const blinkOn = (performance.now() % 800) < 400, B = lampMats();
    if (!LI && cars.some(c => c.set)) LI = lampInstances(opts.scene, Math.max(64, (opts.maxCars || 40) * 2));
    if (LI) LI.begin(truckLamps().front.emissiveIntensity);
    for (const c of cars) {
      if (c.set) {   // инстанция: фаровете, стоповете и мигачите — в общите InstancedMesh
        const br = c.a < -0.8 || c.v < 0.3, turn = c.p.kind === 'conn' ? c.p.turn : c.next && c.next.kind === 'conn' && c.p.len - c.s < 28 ? c.next.turn : null;
        LI.car(c.rx, c.rz, c.ryaw, c.L, c.w, c.h, br, blinkOn && (turn === 'left' || turn === 'uturn'), blinkOn && turn === 'right'); continue;
      }
      const br = c.a < -0.8 || c.v < 0.3;
      if (br !== c.brake && c.rear.length) { c.brake = br; for (const m of c.rear) m.material = br ? B.brake : c.rearMat; }
      const turn = c.p.kind === 'conn' ? c.p.turn : c.next && c.next.kind === 'conn' && c.p.len - c.s < 28 ? c.next.turn : null;
      const L = blinkOn && (turn === 'left' || turn === 'uturn'), R = blinkOn && turn === 'right';
      for (const m of c.blinkL) m.visible = L; for (const m of c.blinkR) m.visible = R;
    }
    if (LI) LI.end();
    const n = truckLamps().front.emissiveIntensity;   // нощта (0…1) — от общия материал на фаровете; хистерезис около здрача
    if (!nightOn && n > 0.35) nightOn = true; else if (nightOn && n < 0.2) nightOn = false;
    if (!opts.camera) return;
    if (!spots.length) for (let k = 0; k < 4; k++) { const sp = new THREE.SpotLight(0xfff0d0, 0, 38, 0.55, 0.6, 1.4); sp.castShadow = false; opts.scene.add(sp); opts.scene.add(sp.target); spots.push(sp); }
    const cp = opts.camera.position, near = nightOn ? [...cars].sort((a, b) => ((a.rx - cp.x) ** 2 + (a.rz - cp.z) ** 2) - ((b.rx - cp.x) ** 2 + (b.rz - cp.z) ** 2)).slice(0, 4) : [];
    spots.forEach((sp, k) => { const c = near[k]; sp.intensity = c ? 40 * Math.min(1, n) : 0; if (!c) return; const fx = Math.sin(c.ryaw), fz = Math.cos(c.ryaw);
      sp.position.set(c.rx + fx * c.L * 0.5, 1.1, c.rz + fz * c.L * 0.5); sp.target.position.set(c.rx + fx * 14, 0, c.rz + fz * 14); });
  }
  const lerpA = (a, b, t) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * t; };
  return {
    lanes, nodes, cars, opts,
    // dt — време на играта (с ускорението); maxSteps пази кадъра при голямо ускорение
    update(dt, maxSteps = 16) {
      acc += dt; let n = 0; while (acc >= H && n < maxSteps) { step(); acc -= H; n++; }
      if (acc > H * maxSteps) acc = 0;   // прекалено бавен кадър — без натрупване (колите не прескачат — стъпките са същите)
      const t = acc / H;
      for (const c of cars) { c.rx = c.px + (c.x - c.px) * t; c.rz = c.pz + (c.z - c.pz) * t; c.ryaw = lerpA(c.pyaw, c.yaw, t); if (c.set) c.set(c.rx, 0.05, c.rz, c.ryaw); else { c.obj.position.set(c.rx, 0.05, c.rz); c.obj.rotation.y = c.ryaw; } }
      if (opts.onSignal) for (const nd of nodes.values()) if (nd.sig) opts.onSignal(nd, sigView(nd.sig));
      lights();
    },
    clear() { for (const sp of spots) { opts.scene.remove(sp); opts.scene.remove(sp.target); sp.dispose(); } spots.length = 0; for (const c of cars) drop({ obj: c.obj, remove: c.rm }); cars.length = 0; if (LI) { LI.clear(); LI = null; } for (const l of lanes) l.cars.length = 0; for (const n of nodes.values()) for (const c of n.conns) c.cars.length = 0; },
    stats: () => ({ cars: cars.length, cap: capacity, steps, left, waiting: cars.filter(c => c.wait > 0).length }),
  };
}

// ---- светлините на колите-инстанции: четири общи InstancedMesh (фарове, стопове, мигачи, светлото петно на асфалта пред колата) —
// 4 draw calls за всички коли.
// begin(нощ 0…1) → car(x, z, yaw, дължина, ширина, височина, спира, ляв, десен) за всяка кола → end()
export function lampInstances(scene, max) {
  const t = truckLamps().front.emissiveMap, mk = col => new THREE.MeshBasicMaterial({ color: col, map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const geo = new THREE.PlaneGeometry(0.9, 0.9), F = new THREE.InstancedMesh(geo, mk(0xfff0d0), max), R = new THREE.InstancedMesh(geo, mk(0xffffff), max), K = new THREE.InstancedMesh(geo, mk(0xffa21a), max * 2);
  // петното пред колата: конус, който избледнява напред (адитивно — избледнява към черно); лежи на асфалта, нощем
  const bc = document.createElement('canvas'); bc.width = 64; bc.height = 128; const bx = bc.getContext('2d'); bx.fillStyle = '#000'; bx.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 128; y++) { const q = y / 127, w = 10 + q * 26, a = Math.pow(1 - q, 1.6) * (q < 0.06 ? q / 0.06 : 1), g = bx.createLinearGradient(32 - w, 0, 32 + w, 0); g.addColorStop(0, '#000'); g.addColorStop(0.5, `rgb(${Math.round(255 * a)},${Math.round(236 * a)},${Math.round(190 * a)})`); g.addColorStop(1, '#000'); bx.fillStyle = g; bx.fillRect(32 - w, y, 2 * w, 1); }
  const beamGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);   // единичен квадрат на земята; горният край на текстурата (тясното) — към колата (−z), петното е напред (+z)
  const BM = new THREE.InstancedMesh(beamGeo, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }), max);
  for (const m of [F, R, K, BM]) { m.frustumCulled = false; m.renderOrder = 3; scene.add(m); }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), dim = new THREE.Color(0x5a0808), hot = new THREE.Color(0xff2020);
  let nf = 0, nr = 0, nk = 0, nb = 0, night = 0; const SB = new THREE.Vector3();
  const put = (im, k, x, y, z, yaw, s) => { Q.setFromAxisAngle(Y, yaw); P.set(x, y, z); S.set(s, s, s); M.compose(P, Q, S); im.setMatrixAt(k, M); };
  return {
    begin(n) { night = Math.max(0, Math.min(1, n)); nf = nr = nk = nb = 0; F.material.color.setRGB(night, night * 0.94, night * 0.82); BM.material.color.setScalar(night * 0.9); },
    car(x, z, yaw, L, w, h, brake, bl, br) {
      const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw), y = h * 0.42;   // напред (fx, fz), вляво (rx, rz)
      if (night > 0.02 && nb < max) { const bl2 = Math.max(8, L * 1.7); Q.setFromAxisAngle(Y, yaw); P.set(x + fx * (L / 2 + bl2 / 2), 0.07, z + fz * (L / 2 + bl2 / 2)); SB.set(w * 2.2, 1, bl2); M.compose(P, Q, SB); BM.setMatrixAt(nb++, M); }   // петното на асфалта
      for (const sx of [-1, 1]) {
        if (night > 0.02 && nf < max) put(F, nf++, x + fx * (L / 2 + 0.05) + rx * sx * w * 0.36, y, z + fz * (L / 2 + 0.05) + rz * sx * w * 0.36, yaw, 1);
        if (nr < max && (brake || night > 0.02)) { put(R, nr, x - fx * (L / 2 + 0.05) + rx * sx * w * 0.42, y, z - fz * (L / 2 + 0.05) + rz * sx * w * 0.42, yaw + Math.PI, brake ? 0.62 : 0.5); R.setColorAt(nr++, brake ? hot : dim); }
        if ((sx > 0 ? bl : br) && nk < max * 2) for (const e of [1, -1]) put(K, nk++, x + fx * e * (L / 2 + 0.06) + rx * sx * w * 0.47, y + 0.05, z + fz * e * (L / 2 + 0.06) + rz * sx * w * 0.47, e > 0 ? yaw : yaw + Math.PI, 0.47);
      }
    },
    end() { F.count = nf; R.count = nr; K.count = nk; BM.count = nb; for (const m of [F, R, K, BM]) m.instanceMatrix.needsUpdate = true; if (R.instanceColor) R.instanceColor.needsUpdate = true; },
    clear() { for (const m of [F, R, K, BM]) { scene.remove(m); m.material.dispose(); m.dispose(); } BM.material.map.dispose(); geo.dispose(); beamGeo.dispose(); },   // и паметта (текстурата е общата на фаровете — остава)
  };
}

// ---- мрежата от сегашната решетка на града (докато планът с лентите от част A не е готов)
// g: { NBI, NBJ, tx(i), isRoad(i, j), TILE, signal(i, j) → bool, main(i|j) → rank }
export function gridNetwork(g) {
  const nodes = [], edges = [], id = (i, j) => i * 1000 + j, has = new Set();
  for (let bi = 0; bi <= g.NBI; bi++) for (let bj = 0; bj <= g.NBJ; bj++) {
    const i = 3 * bi, j = 3 * bj; if (!g.isRoad(i, j)) continue;
    nodes.push({ id: id(i, j), x: g.tx(i), z: g.tx(j), signal: g.signal(i, j) }); has.add(id(i, j));
  }
  for (let bi = 0; bi <= g.NBI; bi++) for (let bj = 0; bj <= g.NBJ; bj++) {
    const i = 3 * bi, j = 3 * bj; if (!has.has(id(i, j))) continue;
    if (has.has(id(i + 3, j)) && g.isRoad(i + 1, j) && g.isRoad(i + 2, j)) edges.push({ a: id(i, j), b: id(i + 3, j), w: g.TILE * 0.95, lanes: 1, rank: g.rank ? g.rank('j', j) : 1 });
    if (has.has(id(i, j + 3)) && g.isRoad(i, j + 1) && g.isRoad(i, j + 2)) edges.push({ a: id(i, j), b: id(i, j + 3), w: g.TILE * 0.95, lanes: 1, rank: g.rank ? g.rank('i', i) : 1 });
  }
  return { nodes, edges };
}

// ---- мрежата от плана на улиците v2 (cityplan2.js, част A): ленти — plan.lanePath, завои — plan.turnPath, кръгови — plan.roundPath
const RANK_V = { blvd: 14, ring: 11, quay: 12, hw: 22, street: 11, access: 8 };
export function planNetwork(P) {
  const nodes = new Map(), lanes = [], NV = id => nodes.get(id);
  const carArms = n => n.arms.filter(a => !P.roads[a.road].noCars).length;   // пешеходните зони (roads[].noCars, напр. Рим) — без коли
  for (const n of P.nodes) nodes.set(n.id, { id: n.id, x: n.x, z: n.z, kind: n.kind, ctrl: n.ctrl, exit: n.endKind === 'exit', inL: [], outL: [], conns: [], deg: carArms(n) });
  // ленти: по всяко ребро, във всяка посока; armIn — клонът на крайния възел, armOut — на началния
  const armOf = (nodeId, roadId, end) => P.nodes[nodeId].arms.findIndex(a => a.road === roadId && a.end === end);
  for (const rd of P.roads) for (const dir of [1, -1]) {
    const n = rd.noCars ? 0 : rd.lanes[dir > 0 ? 0 : 1] || 0, from = dir > 0 ? rd.from : rd.to, to = dir > 0 ? rd.to : rd.from;
    const rank = P.nodes[to].arms[armOf(to, rd.id, dir > 0 ? 1 : 0)]?.rank ?? (rd.cls === 'blvd' ? 4 : 1);
    for (let i = 0; i < n; i++) {
      const L = mkPath(P.lanePath(rd.id, dir, i), 'lane', { from, to, edge: rd, rank, vmax: RANK_V[rd.cls] || V_LANE, laneI: i, nLanes: n, armIn: armOf(to, rd.id, dir > 0 ? 1 : 0), armOut: armOf(from, rd.id, dir > 0 ? 0 : 1) });
      lanes.push(L); NV(from).outL.push(L); NV(to).inL.push(L);
    }
  }
  for (const n of P.nodes) {
    const N = NV(n.id);
    if (n.kind === 'round') { roundNet(P, n, N, nodes, lanes); continue; }
    if (N.exit) { for (const l of N.inL) l.leave = true; for (const l of N.outL) l.enter = true; continue; }   // изход от града: идват и си отиват оттук
    for (const a of N.inL) {
      // задънен край — обратен завой; иначе — към всеки друг клон
      const outs = N.deg === 1 ? N.outL.filter(b => b.edge === a.edge) : N.outL.filter(b => b.armOut !== a.armIn);
      for (const b of outs) {
        const ang = (P.nodes[n.id].arms[b.armOut].angle - P.nodes[n.id].arms[a.armIn].angle + Math.PI * 3) % (Math.PI * 2) - Math.PI;   // ъгъл между клоновете
        const kind = N.deg === 1 ? 'uturn' : Math.abs(Math.abs(ang) - Math.PI) < 0.6 ? 'straight' : ((ang > 0) === (P.drive === 'R') ? 'right' : 'left');
        // коя лента към коя: наляво — от вътрешната към вътрешната, надясно — от външната към външната, направо — същата
        const ok = kind === 'left' ? a.laneI === 0 && b.laneI === 0 : kind === 'right' ? a.laneI === a.nLanes - 1 && b.laneI === b.nLanes - 1 : kind === 'uturn' ? a.laneI === 0 && b.laneI === 0 : b.laneI === Math.min(a.laneI, b.nLanes - 1);
        if (!ok) continue;
        const pts = kind === 'uturn' ? uturnPath(P, n, a, b) : P.turnPath(n.id, a.armIn, a.laneI, b.armOut, b.laneI);
        N.conns.push(mkPath(pts, 'conn', { node: n.id, inL: a, outL: b, turn: kind, vmax: curveV(pts, kind === 'straight' ? (a.vmax || V_LANE) * 0.8 : V_TURN), conf: [] }));
      }
    }
    for (const c of N.conns) for (const d of N.conns) if (c !== d && c.inL !== d.inL && (c.outL === d.outL || crosses(c, d))) c.conf.push(d);
    for (const l of N.inL) l.rank = l.rank || 1;
    N.sig = n.ctrl === 'signal' && N.deg >= 3 ? makeSignal(N) : null;
  }
  return { lanes, nodes };
}
// обратен завой в задънен край: по кръга за обръщане от плана (P.turns), иначе — крива през възела
function uturnPath(P, n, a, b) {
  const A = a.pts[a.pts.length - 1], B = b.pts[0], t = (P.turns || []).find(q => q.node === n.id);
  if (!t) return bezier(A, [n.x, n.z], B, 10);
  const r = Math.max(3, t.r - 2), a0 = Math.atan2(A[1] - t.z, A[0] - t.x), a1 = Math.atan2(B[1] - t.z, B[0] - t.x), dir = P.drive === 'L' ? 1 : -1;   // дясно движение — обратно на часовника отгоре (x — изток, z — юг)
  let d = (a1 - a0) * dir; while (d <= 0.3) d += Math.PI * 2;
  const out = [A]; for (let k = 1; k < 16; k++) { const ang = a0 + dir * d * k / 16; out.push([t.x + Math.cos(ang) * r, t.z + Math.sin(ang) * r]); } out.push(B); return out;
}
// кръгово: пръстенът се реже на отсечки при всеки вход и изход; във всяка точка — възел с връзка „напред“ и (при изход) „навън“
function roundNet(P, n, N, nodes, lanes) {
  const ri = P.rounds.findIndex(r => r.node === n.id), R = P.rounds[ri], ring = R.ring, rp = mkPath(ring, 'tmp'), T = rp.len;
  const pts = []; R.entries.forEach((e, k) => { pts.push({ s: e.inS, in: k }); pts.push({ s: e.outS, out: k }); });
  pts.sort((a, b) => a.s - b.s);
  const segs = [], o = {};
  for (let k = 0; k < pts.length; k++) {   // отсечка от точка k до k+1 (по пръстена, затворено)
    const s0 = pts[k].s, s1 = k + 1 < pts.length ? pts[k + 1].s : pts[0].s + T, P2 = [];
    for (let s = s0; s < s1 - 0.01; s += 2) { at(rp, s % T, o); P2.push([o.x, o.z]); }
    at(rp, s1 % T, o); P2.push([o.x, o.z]);
    const id = `r${ri}:${k}`, idN = `r${ri}:${(k + 1) % pts.length}`;
    if (!nodes.has(id)) nodes.set(id, { id, ring: true, inL: [], outL: [], conns: [], deg: 2 });
    if (!nodes.has(idN)) nodes.set(idN, { id: idN, ring: true, inL: [], outL: [], conns: [], deg: 2 });
    const L = mkPath(P2.length > 1 ? P2 : [P2[0], P2[0]], 'lane', { from: id, to: idN, ring: ri, rank: 3, vmax: 7.5 });
    lanes.push(L); nodes.get(id).outL.push(L); nodes.get(idN).inL.push(L); segs.push(L);
  }
  pts.forEach((q, k) => {
    const V = nodes.get(`r${ri}:${k}`), inSeg = segs[(k - 1 + segs.length) % segs.length], outSeg = segs[k];
    const cont = mkPath([inSeg.pts[inSeg.pts.length - 1], outSeg.pts[0]], 'conn', { node: V.id, inL: inSeg, outL: outSeg, turn: 'straight', vmax: 7.5, conf: [], cont: true });
    V.conns.push(cont);
    if (q.out != null) {   // изход: от пръстена към излизащата лента на клона
      const arm = R.entries[q.out].arm, outL = N.outL.find(l => l.armOut === arm && l.laneI === 0);
      if (outL) { const c = mkPath(P.roundPath(ri, q.out, 'out'), 'conn', { node: V.id, inL: inSeg, outL, turn: 'right', vmax: 6, conf: [], exitArm: arm }); V.conns.push(c); }
    }
    if (q.in != null) {    // вход: от влизащата лента на клона към пръстена — изчаква колите в пръстена отпреди тази точка
      const arm = R.entries[q.in].arm, inL = N.inL.find(l => l.armIn === arm && l.laneI === 0);
      if (inL) {
        const c = mkPath(P.roundPath(ri, q.in, 'in'), 'conn', { node: n.id, inL, outL: outSeg, turn: 'right', vmax: 6, conf: [cont], ringIn: true, yieldTo: [[inSeg, 16]] });
        const exits = R.entries.map(e => e.arm).filter(a => a !== arm); c.pickExit = r => exits[(r() * exits.length) | 0];
        N.conns.push(c); cont.conf.push(c);
      }
    }
  });
}

