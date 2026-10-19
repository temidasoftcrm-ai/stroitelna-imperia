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
// Мрежата: { nodes: [{ id, x, z, signal }], edges: [{ a, b, pts?: [[x,z]…], lanes: 1, w, rank }] } — сега от решетката
// на града (gridNetwork), после — от плана на улиците (част A).
import * as THREE from 'three';

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
  const { lanes, nodes } = buildLanes(opts.net, opts.drive);
  const cars = [], tmp = {}, rnd = Math.random;
  // таван: ~30% от местата по лентите (иначе на късите улици между кръстовищата решетката се задръства)
  const capacity = Math.floor(lanes.reduce((t, l) => t + l.len, 0) / (4.5 + S0 + 2) * 0.3);
  let acc = 0, steps = 0;
  const free = (p, s, L) => p.cars.every(c => Math.abs(c.s - s) > (c.L + L) / 2 + S0 * 2);
  function spawn() {
    for (let k = 0; k < 12; k++) {
      const p = lanes[(rnd() * lanes.length) | 0]; if (p.len < 10) continue;
      const v = opts.makeCar(); if (!v) return null;
      const s = 2 + rnd() * (p.len - 4);
      if (!free(p, s, v.len)) { opts.scene.remove(v.obj); continue; }   // без нова кола на заето място
      const c = { obj: v.obj, L: v.len, kind: v.kind, p, s, v: 0, next: null, px: 0, pz: 0, pyaw: 0, x: 0, z: 0, yaw: 0, wait: 0, a: 0 };
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
    c.next = L.length ? L[(rnd() * L.length) | 0] : null;
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
    return !(tail && tail.s - tail.L / 2 < c.L + S0 + 1);
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
      while (c.s >= c.p.len && c.next) {   // към следващата пътека
        if (c.p.kind === 'lane' && !mayEnter(c) && c.next.kind === 'conn') { c.s = c.p.len; c.v = 0; break; }
        const old = c.p; c.s -= old.len; remove(old, c); c.p = c.next; insert(c.p, c); pickNext(c);
      }
      if (c.s > c.p.len) c.s = c.p.len;
      at(c.p, c.s, tmp); c.x = tmp.x; c.z = tmp.z; c.yaw = tmp.yaw;
    }
    // блокирана дълго (вечно задръстване на затворен кръг) — изчезва и се появява на свободно място (трафикът е само за гледане)
    for (let k = cars.length - 1; k >= 0; k--) { const c = cars[k]; if (c.v < 0.05) c.stuck = (c.stuck || 0) + H; else c.stuck = 0; if (c.stuck > 40) { remove(c.p, c); opts.scene.remove(c.obj); cars.splice(k, 1); } }
    steps++;
  }
  const lerpA = (a, b, t) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * t; };
  return {
    lanes, nodes, cars, opts,
    // dt — време на играта (с ускорението); maxSteps пази кадъра при голямо ускорение
    update(dt, maxSteps = 16) {
      while (cars.length < Math.min(opts.maxCars || 40, capacity)) if (!spawn()) break;
      acc += dt; let n = 0; while (acc >= H && n < maxSteps) { step(); acc -= H; n++; }
      if (acc > H * maxSteps) acc = 0;   // прекалено бавен кадър — без натрупване (колите не прескачат — стъпките са същите)
      const t = acc / H;
      for (const c of cars) { c.obj.position.set(c.px + (c.x - c.px) * t, 0.05, c.pz + (c.z - c.pz) * t); c.obj.rotation.y = lerpA(c.pyaw, c.yaw, t); }
      if (opts.onSignal) for (const nd of nodes.values()) if (nd.sig) opts.onSignal(nd, sigView(nd.sig));
    },
    clear() { for (const c of cars) opts.scene.remove(c.obj); cars.length = 0; for (const l of lanes) l.cars.length = 0; for (const n of nodes.values()) for (const c of n.conns) c.cars.length = 0; },
    stats: () => ({ cars: cars.length, cap: capacity, steps, waiting: cars.filter(c => c.wait > 0).length }),
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
