// roadnet.js — централната пътна мрежа (Лабораторията → road-network): един източник на данни за улиците — сегменти (ос, клас, ленти,
// ширини, ниво: мост/тунел), възли (вид, управление, шаблон) и позволените маневри. От нея се генерират изгледът (roadnet3d.js), лентите и
// кривите за колите (формата на traffic.js: { lanes, nodes }), тротоарите и зебрите за пешеходците и светофарите.
//  • addRoad(pts, cls, { level, tpl }) — автоматично свързване: истинските пресичания на едно ниво (мостът/тунелът — не) разделят сегментите
//    и правят възел; краищата се прилепват към близък възел/улица; възелът се класифицира (край / продължение / завой / Т / + / кръгово).
//  • check(pts, cls, opts) — проверка преди строеж (зелено/червено): сгради, близки кръстовища, остър ъгъл, радиус за ТИР, несъвместими ширини,
//    кръгово (ъгли между входовете, място за разделителното островче). Нищо не се мести и не се трие.
//  • Шаблоните (Т, +, завой, кръгово с една лента, второстепенна към булевард) описват целия възел: очертание, ъгли на бордюра, зебри,
//    стоп линии, входящи/изходящи ленти и кривите на маневрите (допирателни към двете ленти) — без застъпени правоъгълници и кръгове.
//  • Светофарът е на конкретни входящи ленти и маневри: фази от множества непресичащи се криви (лявото — в своя фаза), жълто и всички-червено.
//  • Промяна → само сегментът, съседните възли и лентите/кривите им (update() връща какво е махнато/добавено) — никога целия град, никога на кадър.
// Координати: x — изток, z — юг (както играта); дясно движение по подразбиране.

export const CLASSES = {
  street: { lanes: [1, 1], laneW: 3.25, median: 0, walk: 2.5, rank: 1, vmax: 11, nm: 'улица' },
  avenue: { lanes: [2, 2], laneW: 3.25, median: 0, walk: 3, rank: 2, vmax: 13, nm: 'булевард без ивица' },
  blvd: { lanes: [2, 2], laneW: 3.25, median: 3, walk: 3.5, rank: 3, vmax: 14, nm: 'булевард' },
};
// етапите на строежа (точка 6): ограда → изкоп → основа → асфалт → маркировка → открита; проходима е само откритата и незатворената
export const STAGES = ['fence', 'earth', 'base', 'asphalt', 'markings', 'open'];
export const STAGE_NM = { fence: 'ограда', earth: 'изкоп', base: 'основа', asphalt: 'асфалт', markings: 'маркировка', open: 'открита' };
export const STAGE_T = { fence: 1, earth: 2, base: 1.5, asphalt: 1.5, markings: 0.7 };   // относителна продължителност (×dur)
export const ROUND = { outer: 24, lane: 5.5, apron: 3, splitter: 14 };   // кръгово с една лента: външен радиус, платно, престилка, островчето на входа
const ZW = 3.2, ST = 4.6, R_TIR = 12, MIN_GAP = 30, SNAP_N = 10, LEVEL_H = 6.5, RAMP = 45, TAU = Math.PI * 2;
const widthOf = c => { const k = CLASSES[c]; return (k.lanes[0] + k.lanes[1]) * k.laneW + k.median; };

// ---- геометрия
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const cumLen = pts => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + dist(pts[i], pts[i - 1])); return L; };
export function resample(pts, step) { const L = cumLen(pts), T = L[L.length - 1], n = Math.max(1, Math.round(T / step)), out = []; for (let k = 0; k <= n; k++) out.push(at(pts, L, T * k / n).p); return out; }
export function at(pts, L, s) { s = Math.max(0, Math.min(L[L.length - 1], s)); let i = 1; while (i < L.length - 1 && L[i] < s) i++; const a = pts[i - 1], b = pts[i], d = (L[i] - L[i - 1]) || 1, t = (s - L[i - 1]) / d; return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], u: [(b[0] - a[0]) / d, (b[1] - a[1]) / d] }; }
const trimPts = (pts, a, b) => { const L = cumLen(pts), T = L[L.length - 1], s0 = Math.min(a, T * 0.45), s1 = Math.max(s0 + 0.5, T - b), out = [at(pts, L, s0).p]; for (let k = 1; k < pts.length - 1; k++) if (L[k] > s0 + 0.05 && L[k] < s1 - 0.05) out.push(pts[k]); out.push(at(pts, L, s1).p); return out; };
export const offsetPts = (pts, d) => pts.map((p, k) => { const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [p[0] - dz / l * d, p[1] + dx / l * d]; });   // d > 0 — вдясно по посоката
function segX(a, b, c, d) { const r = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]); if (Math.abs(r) < 1e-9) return null; const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / r, u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / r; return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [t, u] : null; }
function project(pts, L, p) { let best = null; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)), q = [a[0] + dx * t, a[1] + dz * t], d = dist(p, q); if (!best || d < best.d) best = { d, s: L[i - 1] + (L[i] - L[i - 1]) * t, p: q }; } return best; }
// крива, допирателна към края на a и началото на b (кубична Безие)
function tangentCurve(pa, da, pb, db, n = 16) { const d = dist(pa, pb), h = Math.max(0.5, d * 0.42), p1 = [pa[0] + da[0] * h, pa[1] + da[1] * h], p2 = [pb[0] - db[0] * h, pb[1] - db[1] * h], out = []; for (let k = 0; k <= n; k++) { const t = k / n, u = 1 - t; out.push([u * u * u * pa[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * pb[0], u * u * u * pa[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * pb[1]]); } return out; }
// завой като на пътя: права → дъга (допирателна към двете ленти, с най-големия радиус, който се побира в ъгъла) → права
// (успоредно на бордюра; кубичната крива режеше вътрешния ъгъл); без пресечна точка (почти успоредни) — кубична
export function filletPath(pa, da, pb, db, Rwant = 0) {   // Rwant — желан радиус (десният завой: концентричен с бордюра); иначе — най-големият
  const r = da[0] * db[1] - da[1] * db[0]; if (Math.abs(r) < 0.05) return tangentCurve(pa, da, pb, db);
  const t = ((pb[0] - pa[0]) * db[1] - (pb[1] - pa[1]) * db[0]) / r, X = [pa[0] + da[0] * t, pa[1] + da[1] * t], u = (X[0] - pb[0]) * db[0] + (X[1] - pb[1]) * db[1];   // X = pa + da·t = pb − db·(−u)
  if (t <= 0.2 || u >= -0.2) return tangentCurve(pa, da, pb, db);
  const th = Math.acos(Math.max(-1, Math.min(1, da[0] * db[0] + da[1] * db[1]))); if (th < 0.08) return [pa, pb]; const Lf = Math.min(t, -u, Rwant ? Rwant * Math.tan(th / 2) : 1e9);
  if (Lf / Math.tan(th / 2) < 4) return tangentCurve(pa, da, pb, db);   // изродена дъга (пресечната точка е почти в края на лентата) — плавна крива вместо чупка
  const R = Lf / Math.tan(th / 2), S1 = [X[0] - da[0] * Lf, X[1] - da[1] * Lf], S2 = [X[0] + db[0] * Lf, X[1] + db[1] * Lf], sg = Math.sign(r), nrm = [-da[1] * sg, da[0] * sg], C = [S1[0] + nrm[0] * R, S1[1] + nrm[1] * R];
  const a0 = Math.atan2(S1[1] - C[1], S1[0] - C[0]), a1 = Math.atan2(S2[1] - C[1], S2[0] - C[0]); let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  const m = Math.max(6, Math.ceil(Math.abs(d) * R / 1.2)), out = [pa]; if (dist(pa, S1) > 0.3) out.push(S1);
  for (let k = 1; k < m; k++) { const a = a0 + d * k / m; out.push([C[0] + Math.cos(a) * R, C[1] + Math.sin(a) * R]); }
  out.push(S2); if (dist(S2, pb) > 0.3) out.push(pb); return out;
}
// най-малкият радиус на полилиния (по три съседни точки)
export function minRadius(pts) { let r = 1e9; for (let k = 1; k < pts.length - 1; k++) { const a = pts[k - 1], b = pts[k], q = pts[k + 1], A = dist(a, b), B = dist(b, q), C = dist(a, q), ar = Math.abs((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])) / 2; if (ar > 1e-6) r = Math.min(r, A * B * C / (4 * ar)); } return r; }
const dirEnd = p => { const a = p.pts[p.pts.length - 2], b = p.pts[p.pts.length - 1], l = dist(a, b) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
const dirStart = p => { const a = p.pts[0], b = p.pts[1], l = dist(a, b) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
const mkPath = (pts, kind, extra) => { const cum = cumLen(pts); return { pts, cum, len: cum[cum.length - 1], kind, cars: [], ...extra }; };
const curveV = (pts, vmax) => Math.max(2, Math.min(vmax, Math.sqrt(2.5 * minRadius(pts))));
const crosses = (p, q) => { for (let i = 1; i < p.pts.length; i++) for (let j = 1; j < q.pts.length; j++) { const x = segX(p.pts[i - 1], p.pts[i], q.pts[j - 1], q.pts[j]); if (x && x[0] > 0.02 && x[0] < 0.98 && x[1] > 0.02 && x[1] < 0.98) return true; } return false; };

export function createRoadNet(o = {}) {
  const net = { nodes: new Map(), segs: new Map(), drive: o.drive || 'R', obstacles: o.obstacles || [], built: { lanes: [], nodes: new Map() }, peds: null };
  let nid = 1, sid = 1;
  const side = net.drive === 'L' ? -1 : 1;

  // ---- модел
  const newNode = (x, z, extra = {}) => { const n = { id: nid++, x, z, segs: new Set(), tpl: null, ...extra }; net.nodes.set(n.id, n); return n; };
  const newSeg = (a, b, pts, cls, level = 0, stage = 'open') => { const s = { id: sid++, a: a.id, b: b.id, pts, L: cumLen(pts), cls, level, ...CLASSES[cls], w: widthOf(cls), stage, prog: 0, closed: null }; s.lanes = CLASSES[cls].lanes.slice(); net.segs.set(s.id, s); a.segs.add(s.id); b.segs.add(s.id); return s; };
  // височина по сегмента: мост/тунел — нагоре/надолу в средата, рампи от двата края
  const yAt = (sg, s) => { if (!sg.level) return 0; const T = sg.L[sg.L.length - 1], r = Math.min(RAMP, T / 2), k = Math.min(1, s / r, (T - s) / r), e = k * k * (3 - 2 * k); return sg.level * LEVEL_H * e; };
  net.yAt = yAt;
  // разделя сегмента в разстояние s → възел; първата част запазва id (a → n), втората е нов сегмент (n → b)
  function splitSeg(sg, s, n) {
    const T = sg.L[sg.L.length - 1], p = at(sg.pts, sg.L, s).p, A = [], B = [p];
    for (let i = 0; i < sg.pts.length; i++) { if (sg.L[i] < s - 0.01) A.push(sg.pts[i]); else if (sg.L[i] > s + 0.01) B.push(sg.pts[i]); }
    A.push(p); const nb = net.nodes.get(sg.b); nb.segs.delete(sg.id);
    const s2 = newSeg(n, nb, B, sg.cls, sg.level, sg.stage); s2.prog = sg.prog; s2.closed = sg.closed && { ...sg.closed }; sg.pts = A;   /* частите наследяват етапа и затварянето */ sg.L = cumLen(A); sg.b = n.id; n.segs.add(sg.id);
    return [sg, s2, T];
  }
  // пресичанията на нова ос pts със същото ниво; краищата — прилепване към възел (≤ 10 м) или улица (≤ половин ширина + 4 м)
  function hitsOf(pts, cls, level) {
    const L = cumLen(pts), T = L[L.length - 1], H = [];
    for (const sg of net.segs.values()) { if ((sg.level || 0) !== (level || 0)) continue;
      for (let i = 1; i < pts.length; i++) for (let j = 1; j < sg.pts.length; j++) { const x = segX(pts[i - 1], pts[i], sg.pts[j - 1], sg.pts[j]); if (!x) continue; const s = L[i - 1] + (L[i] - L[i - 1]) * x[0], so = sg.L[j - 1] + (sg.L[j] - sg.L[j - 1]) * x[1]; if (s < 1 || s > T - 1) continue; H.push({ s, seg: sg, so }); } }
    for (const [s, p] of [[0, pts[0]], [T, pts[pts.length - 1]]]) {
      let bn = null, bd = SNAP_N; for (const n of net.nodes.values()) { const d = dist(p, [n.x, n.z]); if (d < bd) { bd = d; bn = n; } }
      if (bn) { H.push({ s, node: bn }); continue; }
      let bs = null; for (const sg of net.segs.values()) { if ((sg.level || 0) !== (level || 0)) continue; const q = project(sg.pts, sg.L, p); if (q.d < sg.w / 2 + 4 && (!bs || q.d < bs.q.d)) bs = { sg, q }; }
      if (bs) H.push({ s, seg: bs.sg, so: bs.q.s });
    }
    // пресичане до 10 м от края на сегмента — към крайния му възел
    for (const h of H) if (h.seg) { const sg = h.seg, T2 = sg.L[sg.L.length - 1]; if (h.so < SNAP_N) h.node = net.nodes.get(sg.a); else if (h.so > T2 - SNAP_N) h.node = net.nodes.get(sg.b); if (h.node) delete h.seg; }
    H.sort((a, b) => a.s - b.s); const out = []; for (const h of H) { const l = out[out.length - 1]; if (l && h.s - l.s < 8) { if (h.node && !l.node) out[out.length - 1] = h; continue; } out.push(h); }
    return { hits: out, L, T };
  }

  // ---- нова улица: пресичания → възли, сегменти между тях; връща възлите за преизчисляване
  function addRoad(pts0, cls = 'street', opt = {}) {
    const level = opt.level || 0, pts = resample(pts0, 2), { hits, T } = hitsOf(pts, cls, level), dirty = new Set();
    // чупките на нарисуваната улица (> 20°) — възли от вида „завой“ (шаблонът ги прави дъга с радиус за ТИР)
    { const Lc = cumLen(pts0); let acc = 0; const L0 = cumLen(pts); for (let i = 1; i < pts0.length - 1; i++) { const a = pts0[i - 1], b = pts0[i], c = pts0[i + 1], d1 = Math.atan2(b[1] - a[1], b[0] - a[0]), d2 = Math.atan2(c[1] - b[1], c[0] - b[0]); if (Math.abs(Math.atan2(Math.sin(d2 - d1), Math.cos(d2 - d1))) < 0.35) continue; const s = project(pts, L0, b).s; if (!hits.some(h => Math.abs(h.s - s) < 8)) hits.push({ s }); } hits.sort((a, b) => a.s - b.s); }
    // възлите на пресичанията (разделените сегменти — от по-далечната точка към по-близката, за да остане id-то валидно)
    const bySeg = new Map(); for (const h of hits) if (h.seg) (bySeg.get(h.seg.id) || bySeg.set(h.seg.id, []).get(h.seg.id)).push(h);
    for (const [id, list] of bySeg) { list.sort((a, b) => b.so - a.so); for (const h of list) { const sg = net.segs.get(id), p = at(sg.pts, sg.L, h.so).p, n = newNode(p[0], p[1]); dirty.add(net.nodes.get(sg.b).id); splitSeg(sg, h.so, n); h.node = n; dirty.add(sg.a); } }
    // точките на прекъсване по новата ос: началото, пресичанията, краят
    const br = [...hits]; if (!br.length || br[0].s > 0.5) br.unshift({ s: 0 }); if (br[br.length - 1].s < T - 0.5) br.push({ s: T });
    const L = cumLen(pts); for (const b of br) if (!b.node) { const p = at(pts, L, b.s).p; b.node = newNode(p[0], p[1]); }
    const made = [];
    for (let k = 1; k < br.length; k++) {
      const A = br[k - 1], B = br[k], piece = [[A.node.x, A.node.z]]; for (let i = 0; i < pts.length; i++) if (L[i] > A.s + 1 && L[i] < B.s - 1) piece.push(pts[i]); piece.push([B.node.x, B.node.z]);
      if (A.node === B.node || dist(piece[0], piece[piece.length - 1]) < 1) continue;
      made.push(newSeg(A.node, B.node, resample(piece, 2), cls, level, opt.stages ? 'fence' : 'open'));   /* opt.stages — строи се на етапи */ dirty.add(A.node.id); dirty.add(B.node.id);
    }
    if (opt.tpl === 'round') { const mid = br.filter(b => b.node && b.node.segs.size >= 3); for (const b of mid) b.node.tpl = 'round'; }
    for (const id of dirty) { const n = net.nodes.get(id); if (n && opt.ctrl) n.ctrlForced = opt.ctrl; }
    return { segs: made, dirty };
  }
  // кръгово на съществуващ възел (поне 3 клона)
  function setRound(nodeId, on = true) { const n = net.nodes.get(nodeId); if (!n) return null; n.tpl = on ? 'round' : null; return new Set([n.id]); }

  // ---- възел: клонове, вид, управление, шаблон
  function armsOf(n) {
    const out = [];
    for (const id of n.segs) { const sg = net.segs.get(id); if (!sg) continue; for (const end of sg.a === n.id && sg.b === n.id ? [0, 1] : [sg.a === n.id ? 0 : 1]) {
      const P = end === 0 ? sg.pts : sg.pts.slice().reverse(), p0 = P[0]; let q = P[P.length - 1]; for (const p of P) if (dist(p, p0) >= 10) { q = p; break; }
      out.push({ seg: sg.id, end, angle: Math.atan2(q[1] - p0[1], q[0] - p0[0]), hw: sg.w / 2, sg }); } }
    return out.sort((a, b) => a.angle - b.angle);
  }
  function classify(n) {
    const arms = n.arms = armsOf(n), deg = arms.length;
    if (n.tpl === 'round' && deg >= 3) n.kind = 'round';
    else n.kind = deg === 0 ? 'none' : deg === 1 ? 'end' : deg === 2 ? (Math.PI - Math.abs(Math.atan2(Math.sin(arms[0].angle - arms[1].angle), Math.cos(arms[0].angle - arms[1].angle))) < 0.14 ? 'cont' : 'bend') : deg === 3 ? 'T' : deg === 4 ? 'X' : 'X5';
    const mains = arms.filter(a => a.sg.rank >= 2).length;
    n.ctrl = n.ctrlForced || (n.kind === 'round' ? 'round' : deg < 3 ? 'none' : mains >= 2 && (deg === 4 || arms.filter(a => a.sg.rank >= 2).every(a => a.sg.rank >= 2) && mains === deg) ? 'signal' : 'yield');
    for (const a of arms) a.prio = n.ctrl === 'yield' ? (a.sg.rank >= Math.max(...arms.map(q => q.sg.rank)) ? 1 : 0) : 0;   // предимство — най-големият клас (булевардът)
    template(n);
  }
  // шаблонът: срезовете на клоновете (откъде започва възелът), ъглите на бордюра, очертанието, зебрите и стоп линиите
  function template(n) {
    const T = n.tpl_ = { arms: n.arms.map(a => ({ t: 0, tL: 0, tR: 0, zebra: 0, stop: 0 })), outline: null, corners: [], issues: [] };
    const A = n.arms;
    if (n.kind === 'round') {
      const R = T.round = { ...ROUND, ...(n.roundOuter ? { outer: n.roundOuter, lane: Math.min(ROUND.lane, n.roundOuter - 10), apron: Math.min(ROUND.apron, (n.roundOuter - 10) * 0.35) } : {}), x: n.x, z: n.z }; R.ringR = R.outer - R.lane / 2 - 0.6;   /* roundOuter — радиусът от плана (генераторът) */   /* оста на пръстена — малко навътре: надвесът на автобуса отвън, престилката поема вътрешната страна */ R.island = R.outer - R.lane - R.apron;
      A.forEach((a, i) => { const t = T.arms[i]; t.t = t.tL = t.tR = R.outer; t.zebra = R.outer + 7.5; t.lane = R.outer + R.splitter - 7; t.stop = t.lane;
        t.flare = { r0: R.outer - 3, r1: R.outer + R.splitter + 6, h0: a.hw + 6.5, h1: a.hw };   /* клонът се разширява плавно към пръстена (входът/изходът са дъги), без внезапно стесняване */ if (a.sg.L[a.sg.L.length - 1] < R.outer + R.splitter + 15) T.issues.push({ type: 'short', msg: 'клонът е твърде къс за входа на кръговото' }); });
      for (let k = 0; k < A.length; k++) { let g = A[(k + 1) % A.length].angle - A[k].angle; if (k === A.length - 1) g += TAU; if (g < 1.0) T.issues.push({ type: 'angle', msg: 'входовете на кръговото са под по-малко от 60°' }); }
      if (A.some(a => a.sg.median && !a.sg.rank)) T.issues.push({ type: 'width', msg: '' });
      return;
    }
    if (n.kind === 'end') { const sg = A[0].sg; T.end = sg.median || sg.cls === 'blvd' ? { kind: 'bar' } : { kind: 'bulb', r: sg.w / 2 + 3.5 }; return; }
    if (n.kind === 'cont') return;
    if (n.kind === 'bend') {   // плавна дъга с постоянна ширина; радиусът на оста ≥ 12 м (ТИР)
      const th = Math.PI - Math.abs(Math.atan2(Math.sin(A[0].angle - A[1].angle), Math.cos(A[0].angle - A[1].angle))), Lmax = Math.min(...A.map(a => a.sg.L[a.sg.L.length - 1])) * 0.45;
      let R = 22, L = R * Math.tan(th / 2); if (L > Lmax) { L = Lmax; R = L / Math.tan(th / 2); }
      const ptA = arm => { const S = arm.sg, LL = S.L, TT = LL[LL.length - 1], q = at(S.pts, LL, arm.end ? TT - L : L); return { p: q.p, u: arm.end ? [-q.u[0], -q.u[1]] : q.u }; }, pa = ptA(A[0]), pb = ptA(A[1]);
      T.bend = { th, L, R, arc: filletPath(pa.p, [-pa.u[0], -pa.u[1]], pb.p, pb.u) }; T.arms.forEach(t => { t.t = t.tL = t.tR = L; });   /* дъгата на оста — една и съща за асфалта, лентите и проверката */
      if (R < R_TIR) T.issues.push({ type: 'radius', msg: `завоят е с радиус ${R.toFixed(0)} м — ТИР иска поне ${R_TIR} м` });
      if (Math.abs(A[0].sg.w - A[1].sg.w) > 0.5) T.issues.push({ type: 'width', msg: 'различни ширини в завоя — нужен е преход' });
      return;
    }
    // Т / +: ръбовете на платната се пресичат в ъглите; клонът се реже там, където започва заобленият бордюр (rc — за ТИР)
    for (let k = 0; k < A.length; k++) {
      const a = A[k], b = A[(k + 1) % A.length]; let gap = b.angle - a.angle; if (k === A.length - 1) gap += TAU;
      if (gap < 50 / 57.3) T.issues.push({ type: 'angle', msg: 'остър ъгъл между улиците (под 50°)' });
      const uA = [Math.cos(a.angle), Math.sin(a.angle)], uB = [Math.cos(b.angle), Math.sin(b.angle)], nA = [-uA[1], uA[0]], mB = [uB[1], -uB[0]];
      if (gap >= Math.PI - 0.1 || gap < 0.05) { T.corners.push({ a: k, b: (k + 1) % A.length, c: null }); continue; }
      const d = [mB[0] * b.hw - nA[0] * a.hw, mB[1] * b.hw - nA[1] * a.hw], det = -uA[0] * uB[1] + uB[0] * uA[1], sA = (d[0] * -uB[1] + uB[0] * d[1]) / det, sB = (uA[0] * d[1] - uA[1] * d[0]) / det;
      const rc = a.sg.rank >= 2 || b.sg.rank >= 2 ? 12 : 9, L = rc / Math.tan(gap / 2), ta = T.arms[k], tb = T.arms[(k + 1) % A.length];
      ta.tL = Math.max(ta.tL, sA + L); tb.tR = Math.max(tb.tR, sB + L);
      T.corners.push({ a: k, b: (k + 1) % A.length, c: [n.x + nA[0] * a.hw + uA[0] * sA, n.z + nA[1] * a.hw + uA[1] * sA], rc });
    }
    A.forEach((a, i) => { const t = T.arms[i], cap = a.sg.L[a.sg.L.length - 1] / 2 - ST - 2; t.tL = Math.min(t.tL, cap); t.tR = Math.min(t.tR, cap); t.t = Math.max(t.tL, t.tR, a.hw * 0.3); t.zebra = t.t + 0.8 + ZW / 2; t.stop = t.t + ZW + 1.6; t.lane = t.stop;
      if (a.sg.L[a.sg.L.length - 1] < 2 * (t.stop + 4)) T.issues.push({ type: 'gap', msg: 'кръстовищата са твърде близо' }); });
    const edge = (i, sideL, tt) => { const a = A[i], u = [Math.cos(a.angle), Math.sin(a.angle)], v = sideL ? [-u[1], u[0]] : [u[1], -u[0]], t = tt ?? (sideL ? T.arms[i].tL : T.arms[i].tR); return [n.x + v[0] * a.hw + u[0] * t, n.z + v[1] * a.hw + u[1] * t]; };
    T.edge = edge; T.outline = [];
    for (const c of T.corners) { T.outline.push(edge(c.a, false)); const p0 = edge(c.a, true), p1 = edge(c.b, false); c.p0 = p0; c.p1 = p1;
      if (c.c) { const uA = [Math.cos(A[c.a].angle), Math.sin(A[c.a].angle)], uB = [Math.cos(A[c.b].angle), Math.sin(A[c.b].angle)], th = Math.acos(Math.max(-1, Math.min(1, -uA[0] * uB[0] - uA[1] * uB[1]))), Lav = Math.min(dist(p0, c.c), dist(p1, c.c)); c.rEff = Math.max(2, Math.min(c.rc, th > 0.05 ? Lav / Math.tan(th / 2) : c.rc)); c.curve = filletPath(p0, [-uA[0], -uA[1]], p1, uB, c.rEff); T.outline.push(...c.curve); }   /* действителният радиус (късият клон съкращава ъгъла) — и за десния завой */   /* бордюрът на ъгъла — кръгова дъга с радиус rc (по нея карат и колите) */
      else { c.curve = [p0, p1]; T.outline.push(p0, p1); } }
  }

  // ---- лентите на сегмент и кривите на възел (формата на traffic.js)
  const cutIn = (n, i) => { const t = n.tpl_.arms[i]; return n.kind === 'end' ? 0.5 : n.kind === 'cont' ? 0 : t.lane || t.t; };
  const cutOut = (n, i) => { const t = n.tpl_.arms[i]; return n.kind === 'end' ? 0.5 : n.kind === 'cont' ? 0 : n.kind === 'round' ? t.lane : n.kind === 'bend' ? t.t : t.t + 0.5; };
  const armIdx = (n, segId, end) => n.arms.findIndex(a => a.seg === segId && a.end === end);
  const passable = sg => sg.stage === 'open' && !sg.closed;
  net.passable = passable;
  function segLanes(sg) {
    if (!passable(sg)) return [];   // строеж / ремонт — без ленти (колите заобикалят)
    const out = [], nA = net.nodes.get(sg.a), nB = net.nodes.get(sg.b);
    for (const [dir, from, to] of [[1, nA, nB], [-1, nB, nA]]) {
      const n = dir > 0 ? sg.lanes[0] : sg.lanes[1], P = dir > 0 ? sg.pts : sg.pts.slice().reverse(), endTo = dir > 0 ? 1 : 0, endFrom = dir > 0 ? 0 : 1;
      const iOut = armIdx(from, sg.id, endFrom), iIn = armIdx(to, sg.id, endTo);
      for (let i = 0; i < n; i++) {
        const off = side * (sg.median / 2 + (i + 0.5) * sg.laneW), lp = trimPts(offsetPts(P, off), cutOut(from, iOut), cutIn(to, iIn));
        const Lp = mkPath(lp, 'lane', { lat: Math.abs(off), from: from.id, to: to.id, seg: sg.id, edge: { w: sg.w, heavy: sg.cls !== 'street' }, rank: sg.rank, vmax: sg.vmax, laneI: i, nLanes: n, armIn: iIn, armOut: iOut, level: sg.level });
        if (sg.level) { const T = sg.L[sg.L.length - 1]; Lp.ys = Lp.cum.map((q, k) => { const pr = project(sg.pts, sg.L, lp[k]); return yAt(sg, pr.s); }); }
        out.push(Lp);
      }
    }
    for (const l of out) l.sibs = out.filter(q => q.from === l.from && q.to === l.to);   // успоредните ленти в същата посока (маршрутът може да тръгне от която е удобна)
    return out;
  }
  function nodeConns(n, lanesOf) {
    const B = { id: n.id, x: n.x, z: n.z, inL: [], outL: [], conns: [], deg: n.arms.length };
    for (const a of n.arms) for (const l of lanesOf(a.seg)) { if (l.to === n.id && l.armIn === n.arms.indexOf(a)) B.inL.push(l); if (l.from === n.id && l.armOut === n.arms.indexOf(a)) B.outL.push(l); }
    const extraNodes = [];
    if (n.kind === 'round') { roundConns(n, B, extraNodes); return { B, extraNodes }; }
    for (const a of B.inL) for (const b of B.outL) {
      const sameArm = b.armOut === a.armIn; if (sameArm && n.kind !== 'end') continue;
      const ang = ((n.arms[b.armOut].angle - n.arms[a.armIn].angle + Math.PI * 3) % TAU) - Math.PI;
      const kind = sameArm ? 'uturn' : Math.abs(Math.abs(ang) - Math.PI) < 0.6 ? 'straight' : ((ang > 0) === (side > 0) ? 'left' : 'right');   /* x — изток, z — юг: изходът с по-голям ъгъл е наляво при дясно движение (проверено: десните са по-късите) */
      const ok = kind === 'left' ? a.laneI === 0 && b.laneI === 0 : kind === 'right' ? a.laneI === a.nLanes - 1 && b.laneI === b.nLanes - 1 : kind === 'uturn' ? b.laneI === 0 : b.laneI === Math.min(a.laneI, b.nLanes - 1);   /* наляво — от вътрешната, надясно — от външната, направо — в същата; обратният завой (задънен край) — от всяка */
      if (!ok) continue;
      // второстепенна към булевард с разделителна ивица: наляво от второстепенната и през ивицата — само ако ивицата има отвор (кръстовище със светофар)
      let pts;
      if (kind === 'uturn') { const pa = a.pts[a.pts.length - 1], pb = b.pts[0], c = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2], r = dist(pa, pb) / 2, a0 = Math.atan2(pa[1] - c[1], pa[0] - c[0]), da = dirEnd(a); pts = []; const s2 = (Math.cos(a0 + 0.5) - Math.cos(a0)) * da[0] + (Math.sin(a0 + 0.5) - Math.sin(a0)) * da[1] > 0 ? 1 : -1; for (let k = 0; k <= 12; k++) { const ang2 = a0 + s2 * Math.PI * k / 12; pts.push([c[0] + Math.cos(ang2) * r, c[1] + Math.sin(ang2) * r]); } }
      else { const cr = kind === 'right' && n.tpl_.corners && n.tpl_.corners.find(c => c.c && ((c.a === a.armIn && c.b === b.armOut) || (c.b === a.armIn && c.a === b.armOut))), Rw = cr ? (cr.rEff ?? cr.rc) + Math.max(0.8, n.arms[a.armIn].hw - a.lat) : 0;   /* десният — успоредно на бордюра */
        pts = kind === 'straight' ? tangentCurve(a.pts[a.pts.length - 1], dirEnd(a), b.pts[0], dirStart(b), 16) :   /* 16 точки — разместените улици дават S-крива (скоростта и посоката — по истинската ѝ кривина) */ filletPath(a.pts[a.pts.length - 1], dirEnd(a), b.pts[0], dirStart(b), Rw); }
      B.conns.push(mkPath(pts, 'conn', { node: n.id, inL: a, outL: b, turn: kind, vmax: curveV(pts, kind === 'straight' ? (a.vmax || 11) * 0.85 : 7), conf: [] }));
    }
    // бордюрът на ъгъла — от пътя на десния завой (външната лента), отместен навътре с разстоянието лента–бордюр: проектира се по габарита
    // на превозното средство, затова колата никога не излиза от асфалта (и при кос ъгъл, където срезовете на клоновете са неравни)
    if (n.tpl_.corners && n.tpl_.outline) { const T = n.tpl_; let changed = false;
      for (const c of T.corners) { if (!c.c) continue; const R = B.conns.find(q => q.turn === 'right' && q.inL.laneI === q.inL.nLanes - 1 && ((q.inL.armIn === c.a && q.outL.armOut === c.b) || (q.inL.armIn === c.b && q.outL.armOut === c.a))); if (!R) continue;
        const off = Math.max(0.6, n.arms[R.inL.armIn].hw - R.inL.lat); let cv = offsetPts(R.pts, side * off); if (R.inL.armIn !== c.a) cv = cv.slice().reverse(); c.curve = cv; changed = true; }   /* по посоката на завоя: от клона a към клона b */
      if (changed) { T.outline = []; for (const c of T.corners) { T.outline.push(T.edge(c.a, false)); T.outline.push(...c.curve); } } }
    // лента без маневра на този възел (напр. външната лента там, където направо няма) — най-близката възможна, иначе би била задънена
    for (const a of B.inL) if (!B.conns.some(c => c.inL === a)) { const alt = B.conns.filter(c => c.inL.armIn === a.armIn).sort((p, q) => ({ straight: 0, right: 1, left: 2, uturn: 3 })[p.turn] - ({ straight: 0, right: 1, left: 2, uturn: 3 })[q.turn])[0]; if (alt) { const pts = tangentCurve(a.pts[a.pts.length - 1], dirEnd(a), alt.outL.pts[0], dirStart(alt.outL), 16); B.conns.push(mkPath(pts, 'conn', { node: n.id, inL: a, outL: alt.outL, turn: alt.turn, vmax: curveV(pts, 7), conf: [] })); } }
    for (const c of B.conns) for (const d of B.conns) if (c !== d && c.inL !== d.inL && (c.outL === d.outL || crosses(c, d))) c.conf.push(d);
    for (const l of B.inL) l.rank = net.segs.get(l.seg).rank;
    if (n.ctrl === 'signal') B.sig = makePhases(n, B);
    return { B, extraNodes };
  }
  // кръгово: пръстенът (обратно на часовника при дясно движение — ъгълът намалява) се реже при всеки изход и вход; входът изчаква пръстена
  function roundConns(n, B, extra) {
    const R = n.tpl_.round, rc = R.ringR, dir = side > 0 ? -1 : 1, pts = [];
    n.arms.forEach((a, i) => { const lw = a.sg.laneW, dIn = Math.asin(Math.min(0.9, (a.sg.median / 2 + lw / 2) / rc)) + 3.5 / rc, dOut = dIn; pts.push({ ang: a.angle + dir * dIn, in: i }); pts.push({ ang: a.angle - dir * dOut, out: i }); });   /* по посоката на движение: първо изходът на клона, после входът (входящата лента е от другата страна на оста) */
    const key = p => ((dir * p.ang) % TAU + TAU) % TAU; pts.sort((p, q) => key(p) - key(q));   // по посоката на движение
    const segs = [], V = [];
    for (let k = 0; k < pts.length; k++) {
      const a0 = pts[k].ang, k1 = (k + 1) % pts.length; let a1 = pts[k1].ang; let da = (a1 - a0) * dir; while (da <= 0.01) da += TAU; const m = Math.max(2, Math.ceil(da * rc / 2)), P2 = [];
      for (let q = 0; q <= m; q++) { const ang = a0 + dir * da * q / m; P2.push([n.x + Math.cos(ang) * rc, n.z + Math.sin(ang) * rc]); }
      const id = `${n.id}:r${k}`, idN = `${n.id}:r${k1}`; V[k] = V[k] || { id, ring: true, inL: [], outL: [], conns: [], deg: 2 }; V[k1] = V[k1] || { id: idN, ring: true, inL: [], outL: [], conns: [], deg: 2 };
      const L = mkPath(P2, 'lane', { from: id, to: idN, ring: n.id, rank: 3, vmax: 7.5, edge: { w: 99 } }); segs.push(L); V[k].outL.push(L); V[k1].inL.push(L);
    }
    pts.forEach((q, k) => {
      const Vk = V[k], inSeg = segs[(k - 1 + segs.length) % segs.length], outSeg = segs[k];
      const cont = mkPath([inSeg.pts[inSeg.pts.length - 1], outSeg.pts[0]], 'conn', { node: Vk.id, inL: inSeg, outL: outSeg, turn: 'straight', vmax: 7.5, conf: [], cont: true }); Vk.conns.push(cont);
      if (q.out != null) { const outL = B.outL.find(l => l.armOut === q.out && l.laneI === 0); if (outL) { const pp = filletPath(inSeg.pts[inSeg.pts.length - 1], dirEnd(inSeg), outL.pts[0], dirStart(outL)); Vk.conns.push(mkPath(pp, 'conn', { node: Vk.id, inL: inSeg, outL, turn: 'right', vmax: curveV(pp, 6.5), conf: [], exitArm: q.out })); } }
      if (q.in != null) { const inL = B.inL.find(l => l.armIn === q.in && l.laneI === 0); if (inL) { const pp = filletPath(inL.pts[inL.pts.length - 1], dirEnd(inL), outSeg.pts[0], dirStart(outSeg)), c = mkPath(pp, 'conn', { node: n.id, inL, outL: outSeg, turn: 'right', vmax: curveV(pp, 6.5), conf: [cont], ringIn: true, yieldTo: [[inSeg, 16]] });
        const exits = n.arms.map((_, i) => i).filter(i => i !== q.in); c.pickExit = r => exits[(r() * exits.length) | 0]; B.conns.push(c); cont.conf.push(c); } }
    });
    for (const l of B.inL) if (l.laneI > 0) { const t = B.conns.find(c => c.inL.armIn === l.armIn && c.ringIn); if (!t) continue; const pp = tangentCurve(l.pts[l.pts.length - 1], dirEnd(l), t.outL.pts[0], dirStart(t.outL)), c = mkPath(pp, 'conn', { node: n.id, inL: l, outL: t.outL, turn: 'right', vmax: curveV(pp, 6), conf: t.conf.slice(), ringIn: true, yieldTo: t.yieldTo, pickExit: t.pickExit }); B.conns.push(c); for (const d of t.conf) d.conf.push(c); }   // другите ленти на многолентовия клон — също в пръстена
    extra.push(...V); B.ringLanes = segs;
  }
  // светофарът: две оси (клоновете — по посоката mod π, разделени при най-голямата празнина); фази: ос А направо+надясно, А наляво,
  // Б направо+надясно, Б наляво — всяка фаза е множество от криви; конфликтните никога не са заедно
  function makePhases(n, B) {
    const md = n.arms.map((a, i) => ({ i, m: ((a.angle % Math.PI) + Math.PI) % Math.PI })).sort((p, q) => p.m - q.m); let gi = 0, gm = -1;
    for (let k = 0; k < md.length; k++) { const g = (k + 1 < md.length ? md[k + 1].m : md[0].m + Math.PI) - md[k].m; if (g > gm) { gm = g; gi = k; } }
    const axisOf = new Map(); md.forEach((x, k) => { const pos = (k - gi - 1 + md.length) % md.length; axisOf.set(x.i, pos < Math.ceil(md.length / 2) ? 'A' : 'B'); });
    for (const l of B.inL) l.axis = axisOf.get(l.armIn);
    const ph = [], sets = [];
    for (const ax of ['A', 'B']) {
      const go = B.conns.filter(c => c.inL.axis === ax && c.turn !== 'left' && c.turn !== 'uturn'), left = B.conns.filter(c => c.inL.axis === ax && c.turn === 'left');
      if (go.length) { ph.push([ax, 'go']); sets.push(new Set(go)); } if (left.length) { ph.push([ax, 'left']); sets.push(new Set(left)); }
    }
    // неправоъгълно кръстовище (5 клона, кос ъгъл): ако във фаза има пресичащи се криви — разпределение наново (алчно оцветяване по реда на фазите)
    const clash = (c, d) => c.inL !== d.inL && (c.outL === d.outL || crosses(c, d));
    if (sets.some(S => { const L = [...S]; return L.some((c, i) => L.some((d, j) => j > i && clash(c, d))); })) {
      const out = [], lab = []; sets.forEach((S, k) => { for (const c of S) { let placed = false; for (let q = 0; q < out.length && !placed; q++) if (q >= k - 1 && ![...out[q]].some(d => clash(c, d))) { out[q].add(c); placed = true; } if (!placed) { out.push(new Set([c])); lab.push([c.inL.axis, c.turn === 'left' ? 'left' : 'go']); } } });
      return { ph: lab, sets: out, i: 0, t: Math.random() * 9, stage: 'green' };
    }
    return { ph, sets, i: 0, t: Math.random() * 9, stage: 'green' };
  }
  net.verifyPhases = B => { const bad = []; if (!B.sig) return bad; B.sig.sets.forEach((S, k) => { const L = [...S]; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const c = L[i], d = L[j]; if (c.inL !== d.inL && (c.outL === d.outL || crosses(c, d))) bad.push([k, c.turn, d.turn]); } }); return bad; };

  // ---- частично преизчисляване: възлите dirty (и съседните по сегментите им) → шаблони, ленти, криви; връща махнатите/новите пътеки
  const segLanesMap = new Map(), nodeBuilt = new Map();
  function update(dirty) {
    const nodes = new Set(dirty), segs = new Set();
    for (const id of dirty) { const n = net.nodes.get(id); if (!n) continue; for (const s of n.segs) segs.add(s); }
    for (const id of segs) { const sg = net.segs.get(id); if (sg) { nodes.add(sg.a); nodes.add(sg.b); } }
    for (const id of nodes) { const n = net.nodes.get(id); if (n) classify(n); }
    const removed = new Set(), added = [];
    for (const id of segs) { for (const l of segLanesMap.get(id) || []) removed.add(l); const sg = net.segs.get(id); if (!sg) { segLanesMap.delete(id); continue; } const L = segLanes(sg); segLanesMap.set(id, L); added.push(...L); }
    // кривите — на всички възли, чиито ленти са сменени
    const touch = new Set(nodes); for (const id of segs) { const sg = net.segs.get(id); if (sg) { touch.add(sg.a); touch.add(sg.b); } }
    const lanesOf = sid2 => segLanesMap.get(sid2) || [];
    for (const id of touch) {
      const old = nodeBuilt.get(id); if (old) { for (const v of [old.B, ...old.extraNodes]) { for (const c of v.conns) removed.add(c); net.built.nodes.delete(v.id); } for (const l of old.B.ringLanes || []) removed.add(l); }
      const n = net.nodes.get(id); if (!n || !n.arms.length) { nodeBuilt.delete(id); continue; }
      const r = nodeConns(n, lanesOf); nodeBuilt.set(id, r); for (const v of [r.B, ...r.extraNodes]) { net.built.nodes.set(v.id, v); added.push(...v.conns); } added.push(...(r.B.ringLanes || []));
    }
    // лентите в общия списък (на място — трафикът държи същия масив)
    const L = net.built.lanes; for (let k = L.length - 1; k >= 0; k--) if (removed.has(L[k])) L.splice(k, 1);
    for (const p of added) if (p.kind === 'lane' && !L.includes(p)) L.push(p);
    for (const p of added) removed.delete(p);
    net.peds = null;   // тротоарите — наново при нужда (евтино)
    return { removed, added, nodes: [...touch], segs: [...segs] };
  }

  // ---- срезовете на сегмента при възела (общи за изгледа и тротоарите): what — 'asph' | 'walkL' | 'walkR' | 'mark' | 'median'
  function cut(n, segId, end, what) {   // what: 'asph' | 'walkL' | 'walkR' | 'mark' | 'median' — докъде стига сегментът от този възел
    const i = n.arms.findIndex(a => a.seg === segId && a.end === end), T = n.tpl_, t = T.arms[i] || {};
    if (n.kind === 'round') return what === 'median' ? T.round.outer + T.round.splitter : what === 'mark' ? T.round.outer + 9.6 : what === 'asph' ? t.flare.r1 - 0.5 : t.flare.r1;   /* до края на разширението */
    if (n.kind === 'bend') return t.t;
    if (n.kind === 'end') { const e = T.end; if (e.kind === 'bulb') { const sg = n.arms[0].sg; return what === 'asph' ? 0 : what === 'mark' || what === 'median' ? e.r + 1 : Math.sqrt(Math.max(0, (e.r + sg.walk / 2) ** 2 - (sg.w / 2 + sg.walk / 2) ** 2)); } return what === 'mark' || what === 'median' ? 1.5 : 0; }
    if (n.kind === 'cont' || n.kind === 'none') return 0;
    if (what === 'asph') return Math.max(0, Math.min(t.tL, t.tR) - 0.5);
    if (what === 'mark') return t.stop + 0.3; if (what === 'median') return t.stop + 3;
    return (end === 0) === (what === 'walkL') ? t.tL : t.tR;   // тротоарът — срезът на своя ръб
  }

  // ---- пешеходците: тротоарите (срязани там, където и изгледът — net.cut), ъглите по дъгата на бордюра, разширенията и пръстенът на
  // кръговото, завоят, площадката/бариерата; улицата се пресича само по зебрите (на всеки подход: Т, +, кръгово). Кешира се до промяна.
  function pedNet() {
    if (net.peds) return net.peds;
    const X = [], Z = [], adj = [], addP = (x, z) => { X.push(x); Z.push(z); adj.push([]); return X.length - 1; }, link = (a, b, info = null) => { if (a == null || b == null || a === b) return; const d = Math.hypot(X[a] - X[b], Z[a] - Z[b]); adj[a].push([b, d, info]); adj[b].push([a, d, info && { ...info, rev: true }]); };
    const chain = pts => { let prev = null, first = null; for (const p of pts) { const id = addP(p[0], p[1]); if (prev != null) link(prev, id); else first = id; prev = id; } return [first, prev]; };
    const side = new Map();   // 'seg:sgn' → { ids, ss, T }
    for (const sg of net.segs.values()) { if (sg.stage !== 'open') continue; const nA = net.nodes.get(sg.a), nB = net.nodes.get(sg.b), T = sg.L[sg.L.length - 1];   /* строежът е ограден — без тротоар */
      for (const sgn of [1, -1]) { const c0 = cut(nA, sg.id, 0, sgn > 0 ? 'walkL' : 'walkR'), c1 = cut(nB, sg.id, 1, sgn > 0 ? 'walkR' : 'walkL'); if (T - c0 - c1 < 1) continue;
        const m = Math.max(1, Math.round((T - c0 - c1) / 4)), ids = [], ss = []; for (let k = 0; k <= m; k++) { const s = c0 + (T - c0 - c1) * k / m, q = at(sg.pts, sg.L, s), off = sgn * (sg.w / 2 + sg.walk / 2); ids.push(addP(q.p[0] - q.u[1] * off, q.p[1] + q.u[0] * off)); ss.push(s); if (k) link(ids[k - 1], ids[k]); }
        side.set(sg.id + ':' + sgn, { ids, ss, T }); } }
    const armSide = (a, lr) => { const sgn = (a.end === 0) === (lr === 'L') ? 1 : -1, S = side.get(a.seg + ':' + sgn); return S ? { S, id: a.end === 0 ? S.ids[0] : S.ids[S.ids.length - 1] } : null; };
    const sideAt = (a, lr, d) => { const q = armSide(a, lr); if (!q) return null; const s = a.end === 0 ? d : q.S.T - d; let b = 0, bd = 1e9; q.S.ss.forEach((v, k) => { if (Math.abs(v - s) < bd) { bd = Math.abs(v - s); b = k; } }); return q.S.ids[b]; };
    const near = (ids, id) => { let b = null, bd = 1e18; for (const r of ids) { if (r == null) continue; const d = (X[r] - X[id]) ** 2 + (Z[r] - Z[id]) ** 2; if (d < bd) { bd = d; b = r; } } return b; };
    let nCross = 0; const cross = (n, i, d, sig) => { const a = n.arms[i], l = sideAt(a, 'L', d), r = sideAt(a, 'R', d); if (l != null && r != null) { link(l, r, { node: n.id, arm: i, x: (X[l] + X[r]) / 2, z: (Z[l] + Z[r]) / 2, signal: sig }); nCross++; } };
    for (const n of net.nodes.values()) { const T = n.tpl_; if (!T) continue; const A = n.arms;
      if (n.kind === 'cont') { const [a, b] = A; link(armSide(a, 'L')?.id, armSide(b, 'R')?.id); link(armSide(a, 'R')?.id, armSide(b, 'L')?.id); continue; }
      if (n.kind === 'bend') { const [a, b] = A, arc = T.bend.arc; for (const [p, q, sg2] of [[armSide(a, 'L'), armSide(b, 'R'), -1], [armSide(a, 'R'), armSide(b, 'L'), 1]]) { if (!p || !q) continue; const o = offsetPts(arc, sg2 * (a.sg.w / 2 + a.sg.walk / 2)), [f, l] = chain(o.slice(1, -1)); if (f == null) { link(p.id, q.id); continue; } link(near([p.id], f) === p.id ? p.id : p.id, near([f, l], p.id)); link(q.id, near([f, l], q.id)); } continue; }
      if (n.kind === 'end') { const a = A[0], l = armSide(a, 'L'), r = armSide(a, 'R'); if (l && r) link(l.id, r.id); continue; }
      if (n.kind === 'round') { const R = T.round, ro = R.outer + 1.25, ring = [], gaps = A.map((a, i) => [a.angle, Math.asin(Math.min(0.95, (T.arms[i].flare.h0 + 0.3) / R.outer))]), open = ang => !gaps.some(([c, h]) => Math.abs(Math.atan2(Math.sin(ang - c), Math.cos(ang - c))) < h);
        for (let k = 0; k < 48; k++) { const ang = k / 48 * TAU; ring.push(open(ang) ? addP(n.x + Math.cos(ang) * ro, n.z + Math.sin(ang) * ro) : null); } for (let k = 0; k < 48; k++) if (ring[k] != null && ring[(k + 1) % 48] != null) link(ring[k], ring[(k + 1) % 48]);
        A.forEach((a, i) => { const f = T.arms[i].flare, ux = Math.cos(a.angle), uz = Math.sin(a.angle); for (const [lr, sg2] of [['L', 1], ['R', -1]]) { const q = armSide(a, lr); if (!q) continue; const pts = []; for (let k = 0; k <= 6; k++) { const t = k / 6, d = f.r1 - (f.r1 - f.r0) * t; const hh = f.h0 + (f.h1 - f.h0) * ((1 - t) * (1 - t) * (3 - 2 * (1 - t))) + a.sg.walk / 2; pts.push([n.x + ux * d - uz * sg2 * hh, n.z + uz * d + ux * sg2 * hh]); } const [s0, s1] = chain(pts); link(q.id, s0); link(s1, near(ring, s1)); }
          cross(n, i, T.arms[i].zebra, false); });
        continue; }
      // Т / +: ъглите (левият тротоар на клона → десният на следващия) по дъгата на бордюра, отместена навън; зебра на всеки подход
      for (const c of T.corners) { const a = A[c.a], b = A[c.b], p = armSide(a, 'L'), q = armSide(b, 'R'); if (!p || !q) continue; const ww = Math.min(a.sg.walk, b.sg.walk), mid = c.curve[c.curve.length >> 1], o1 = offsetPts(c.curve, ww / 2), o2 = offsetPts(c.curve, -ww / 2), out = Math.hypot(o1[o1.length >> 1][0] - n.x, o1[o1.length >> 1][1] - n.z) > Math.hypot(mid[0] - n.x, mid[1] - n.z) ? o1 : o2, [f, l] = chain(out); link(p.id, f); link(l, q.id); }
      A.forEach((a, i) => cross(n, i, T.arms[i].zebra, n.ctrl === 'signal'));
    }
    function nearest(x, z) { let b = 0, bd = 1e18; for (let i = 0; i < X.length; i++) { const d = (X[i] - x) ** 2 + (Z[i] - z) ** 2; if (d < bd) { bd = d; b = i; } } return b; }
    function route(x0, z0, x1, z1) {
      const a = nearest(x0, z0), b = nearest(x1, z1), g = new Float64Array(X.length).fill(Infinity), prev = new Int32Array(X.length).fill(-1), pinfo = [], h = i => Math.hypot(X[i] - X[b], Z[i] - Z[b]), hp = [];
      const push = (f, i) => { hp.push([f, i]); let k = hp.length - 1; while (k) { const q = (k - 1) >> 1; if (hp[q][0] <= hp[k][0]) break; [hp[q], hp[k]] = [hp[k], hp[q]]; k = q; } };
      const pop = () => { const top = hp[0], last = hp.pop(); if (hp.length) { hp[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < hp.length && hp[l][0] < hp[m][0]) m = l; if (r < hp.length && hp[r][0] < hp[m][0]) m = r; if (m === k) break; [hp[m], hp[k]] = [hp[k], hp[m]]; k = m; } } return top; };
      g[a] = 0; push(h(a), a); while (hp.length) { const [f, u] = pop(); if (f > g[u] + h(u) + 1e-9) continue; if (u === b) break; for (const [v, d, info] of adj[u]) { const ng = g[u] + d + (info ? 6 : 0); if (ng < g[v]) { g[v] = ng; prev[v] = u; pinfo[v] = info; push(ng + h(v), v); } } }
      if (a !== b && prev[b] < 0) return null; const ids = []; for (let k = b; k !== a; k = prev[k]) ids.push(k); ids.push(a); ids.reverse();
      return ids.map((id, k) => { const nx = ids[k + 1], info = nx != null ? pinfo[nx] : null; return info ? { x: X[id], z: Z[id], walk: true, cross: info } : { x: X[id], z: Z[id], walk: true }; });
    }
    let comps = 0; { const seen = new Int8Array(X.length); for (let i = 0; i < X.length; i++) if (!seen[i]) { comps++; const q = [i]; seen[i] = 1; while (q.length) { const u = q.pop(); for (const [v] of adj[u]) if (!seen[v]) { seen[v] = 1; q.push(v); } } } }
    return net.peds = { route, nearest: (x, z) => { const i = nearest(x, z); return { x: X[i], z: Z[i] }; }, stats: { nodes: X.length, crossings: nCross, comps }, X, Z, adj };
  }

  // ---- проверка преди строеж (без промяна на мрежата): проблемите с точка и описание
  function check(pts0, cls = 'street', opt = {}) {
    const P = [], level = opt.level || 0, pts = resample(pts0, 2), w = widthOf(cls), { hits, T } = hitsOf(pts, cls, level);
    if (T < 20) P.push({ type: 'short', at: pts[0], msg: 'улицата е твърде къса' });
    // радиусът: всяка чупка (> 20°) става дъга (шаблонът „завой“) — радиусът ѝ според по-късия съседен участък; плавните криви — по точките
    for (let i = 1; i < pts0.length - 1; i++) { const a = pts0[i - 1], b = pts0[i], c = pts0[i + 1], d1 = Math.atan2(b[1] - a[1], b[0] - a[0]), d2 = Math.atan2(c[1] - b[1], c[0] - b[0]), th = Math.abs(Math.atan2(Math.sin(d2 - d1), Math.cos(d2 - d1)));
      if (th < 0.35) continue; const L = Math.min(dist(a, b), dist(b, c)) * 0.45, R = Math.min(22, L / Math.tan(th / 2)); if (R < R_TIR) P.push({ type: 'radius', at: b, msg: `завой с радиус ${R.toFixed(0)} м — ТИР иска поне ${R_TIR} м (по-дълги прави участъци)` }); }
    { const smooth = pts0.filter((b, i) => { if (!i || i === pts0.length - 1) return true; const a = pts0[i - 1], c = pts0[i + 1], d1 = Math.atan2(b[1] - a[1], b[0] - a[0]), d2 = Math.atan2(c[1] - b[1], c[0] - b[0]); return Math.abs(Math.atan2(Math.sin(d2 - d1), Math.cos(d2 - d1))) < 0.35; });
      if (smooth.length >= 3) { const r = minRadius(smooth); if (r < R_TIR) P.push({ type: 'radius', at: pts[1], msg: `радиус ${r.toFixed(0)} м — ТИР иска поне ${R_TIR} м` }); } }
    // сгради и заети парцели: полоса по оста ± (половин платно + тротоар)
    const half = w / 2 + CLASSES[cls].walk; for (const ob of net.obstacles) { const poly = ob.poly; for (const p of pts) { if (inPoly(p, poly) || polyDist(p, poly) < half) { P.push({ type: 'building', at: p, msg: ob.nm ? `сграда: ${ob.nm}` : 'сграда / зает парцел' }); break; } } }
    // новите възли: твърде близо до друг възел; пресичане на рампа на мост/тунел
    const nn = hits.map(h => h.node ? [h.node.x, h.node.z] : at(h.seg.pts, h.seg.L, h.so).p);
    for (let i = 0; i < nn.length; i++) { for (const n of net.nodes.values()) { const d = dist(nn[i], [n.x, n.z]); if (d > 1 && d < MIN_GAP && !(hits[i].node === n)) { P.push({ type: 'gap', at: nn[i], msg: `кръстовище на ${d.toFixed(0)} м от друго (поне ${MIN_GAP})` }); break; } } if (i && dist(nn[i], nn[i - 1]) < MIN_GAP) P.push({ type: 'gap', at: nn[i], msg: 'две кръстовища твърде близо по новата улица' }); }
    for (const h of hits) { const n = h.node; if (n && n.tpl === 'round' && hits.length && dist([n.x, n.z], pts[0]) > 1 && dist([n.x, n.z], pts[pts.length - 1]) > 1) P.push({ type: 'round', at: [n.x, n.z], msg: 'улица през кръговото' }); }
    for (const h of hits) if (h.seg && h.seg.level) P.push({ type: 'level', at: at(h.seg.pts, h.seg.L, h.so).p, msg: 'пресича мост/тунел на същото ниво' });
    // ъгълът при всяка точка на свързване (с клоновете, които ще има там)
    for (let i = 0; i < hits.length; i++) { const h = hits[i], p = nn[i], L = cumLen(pts), s = h.s, u = at(pts, L, Math.min(T, s + 5)).p, b = at(pts, L, Math.max(0, s - 5)).p, mine = [Math.atan2(u[1] - p[1], u[0] - p[0]), Math.atan2(b[1] - p[1], b[0] - p[0])].filter((_, k) => (k === 0 ? s < T - 2 : s > 2));
      const others = []; if (h.node) { for (const a of armsOf(h.node)) others.push(a.angle); } else { const sg = h.seg, q1 = at(sg.pts, sg.L, Math.min(sg.L[sg.L.length - 1], h.so + 5)).p, q2 = at(sg.pts, sg.L, Math.max(0, h.so - 5)).p; others.push(Math.atan2(q1[1] - p[1], q1[0] - p[0]), Math.atan2(q2[1] - p[1], q2[0] - p[0])); }
      for (const m of mine) for (const q of others) { const g = Math.abs(Math.atan2(Math.sin(m - q), Math.cos(m - q))); if (g < 50 / 57.3) { P.push({ type: 'angle', at: p, msg: `остър ъгъл ${Math.round(g * 57.3)}° (поне 50°)` }); break; } }
      const segW = h.node ? null : h.seg; if (segW && segW.median && cls === 'street' && level === 0) P.push({ type: 'info', at: p, msg: 'второстепенна към булевард — предимство за булеварда' });
    }
    return { ok: !P.some(p => p.type !== 'info'), problems: P, hits: nn };
  }
  const inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if ((poly[i][1] > p[1]) !== (poly[j][1] > p[1]) && p[0] < (poly[j][0] - poly[i][0]) * (p[1] - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c; return c; };
  const polyDist = (p, poly) => { let d = 1e9; for (let i = 0; i < poly.length; i++) { const q = project([poly[i], poly[(i + 1) % poly.length]], [0, dist(poly[i], poly[(i + 1) % poly.length])], p); d = Math.min(d, q.d); } return d; };

  // одит на готовата мрежа: проблемите на шаблоните (островче без място, булевард с площадка за обръщане, остър ъгъл, радиус)
  function audit() { const out = []; for (const n of net.nodes.values()) { if (!n.tpl_) continue; for (const i of n.tpl_.issues) out.push({ node: n.id, kind: n.kind, ...i }); if (n.kind === 'end' && n.tpl_.end.kind === 'bulb' && n.arms[0].sg.median) out.push({ node: n.id, type: 'bulb', msg: 'булевард с площадка за обръщане' }); } return out; }

  // ---- етапите и ремонтите във времето: dur — секунди за цял сегмент (по дължината); връща променените сегменти (за update)
  function tick(dt, dur = 60) {
    const ch = new Set();
    for (const sg of net.segs.values()) {
      if (sg.stage !== 'open') { const T = Math.max(10, sg.L[sg.L.length - 1]) / 100 * dur * (STAGE_T[sg.stage] || 1) / 3; sg.prog += dt / T; if (sg.prog >= 1) { sg.prog = 0; sg.stage = STAGES[STAGES.indexOf(sg.stage) + 1]; ch.add(sg.id); } }
      if (sg.closed) { sg.closed.t -= dt; if (sg.closed.t <= 0) { sg.closed = null; ch.add(sg.id); } }
    }
    return ch;
  }
  // сегментите → възлите им (за update)
  const nodesOf = segIds => { const d = new Set(); for (const id of segIds) { const sg = net.segs.get(id); if (sg) { d.add(sg.a); d.add(sg.b); } } return d; };
  // ремонт: временно затваряне за s секунди; има ли обиколен път (от единия край до другия без този сегмент) — по мрежата на лентите
  function repair(segId, s = 60) { const sg = net.segs.get(segId); if (!sg) return null; sg.closed = { t: s, total: s }; return nodesOf([segId]); }
  // готов граф (генераторът на градове — roadnet-plan2.js): възли и сегменти направо, без автоматичното свързване; сегментът пази
  // ширините от плана (lanes, laneW, median, walk, w); връща възлите за update
  function importGraph(G) {
    const byKey = new Map(), dirty = new Set();
    for (const q of G.nodes) { const n = newNode(q.x, q.z, { key: q.key }); if (q.tpl) n.tpl = q.tpl; if (q.roundOuter) n.roundOuter = q.roundOuter; if (q.ctrl) n.ctrlForced = q.ctrl; byKey.set(q.key, n); dirty.add(n.id); }
    for (const q of G.segs) { const a = byKey.get(q.a), b = byKey.get(q.b); if (!a || !b || a === b) continue; const sg = newSeg(a, b, q.pts, q.cls, q.level || 0);
      for (const k of ['lanes', 'laneW', 'median', 'walk', 'w', 'noCars', 'nm']) if (q[k] != null) sg[k] = Array.isArray(q[k]) ? q[k].slice() : q[k];
      if (q.noCars) sg.lanes = [0, 0]; }
    return dirty;
  }
  Object.assign(net, { importGraph, tick, repair, nodesOf, addRoad, setRound, update, check, audit, cut, pedNet, armsOf, classify, lanesOfSeg: id => segLanesMap.get(id) || [], nodeBuilt: id => nodeBuilt.get(id) });
  return net;
}
