// stationaccess.js — 🚉 station-access (f9): път от гарата до най-близката улица и място за паркинг до нея (градовете с плана v2).
// Пътят е истински — ново ребро в графа на плана (P.roads/P.nodes): трафикът (traffic.js planNetwork) и 3D изгледът
// (cityplan2-3d.js) го виждат като всяка улица. Цел: най-близкият подходящ възел (край, чупка или Т — не кръгово, не изход от
// града), а ако няма — Т-кръстовище по средата на улица (тя се разделя на две). Пътят е прав или с една чупка: първо покрай
// линията (свободната ивица до перона), после направо. Не минава през парцели, улици и вода. Парцелите не се пипат (номерата им
// са в записите); новите възли и пътища са в края на масивите. Работи върху копие — кешираният план остава същият.
// stationAccess(P, { x, z0, z1 }) — x: източният ръб на перона (в рамката на плана), z0…z1: докъде е перонът → копие на P с P.access (или P)
// airport-access (T1): същото и за летището — { key: 'airAccess', nm, tag: 'airport', noPark: true, maxLen, ax } (ax — началото на пътя по x, вместо x + полуширината) (пътят е в P[key], паркингът го рисува airportaccess.js)
import { CLS, widthOf, rectCorners, inPoly, nodeKind, nodeShape, attachPlan2 } from './cityplan2.js';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cumLen = pts => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + dist(pts[i], pts[i - 1])); return L; };
const segDist = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)); return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t); };
const angDiff = (a, b) => Math.abs(((a - b) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
const away = (pts, atEnd) => { const P2 = atEnd ? pts.slice().reverse() : pts, p0 = P2[0]; let q = P2[P2.length - 1]; for (const p of P2) if (dist(p, p0) >= 10) { q = p; break; } return Math.atan2(q[1] - p0[1], q[0] - p0[0]); };

export function stationAccess(P, o) {
  if (!P || !P.roads || !P.nodes || o == null) return P;
  const CL = o.cls || 'street', K = CLS[CL], W = widthOf(CL), HALF = W / 2 + K.walk, MAXL = o.maxLen || 600;
  // препятствията: парцелите (с марж — платното и тротоарът), улиците, водата
  const lotPolys = P.lots.map(L => L.poly || rectCorners(L.x, L.z, L.w / 2, L.d / 2, L.rot || 0));
  const lotBox = P.lots.map(L => { const r = Math.hypot(L.w, L.d) / 2; return [L.x - r, L.z - r, L.x + r, L.z + r]; });
  const segs = []; for (const rd of P.roads) for (let i = 1; i < rd.pts.length; i++) segs.push([rd.pts[i - 1], rd.pts[i], rd.w / 2 + (rd.walk || 2.5), rd]);
  // решетка 32 м: парцели и отсечки по клетки (иначе в големите OSM градове търсенето е секунди)
  const G = 32, grid = new Map(), cellK = (i, j) => i * 100003 + j, addBox = (x0, z0, x1, z1, v) => { for (let i = Math.floor(x0 / G); i <= Math.floor(x1 / G); i++) for (let j = Math.floor(z0 / G); j <= Math.floor(z1 / G); j++) { const k = cellK(i, j); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(v); } };
  lotBox.forEach((b, i) => addBox(b[0] - HALF, b[1] - HALF, b[2] + HALF, b[3] + HALF, i));
  segs.forEach((sg, i) => { const [a, b, hw] = sg, m = hw + HALF; addBox(Math.min(a[0], b[0]) - m, Math.min(a[1], b[1]) - m, Math.max(a[0], b[0]) + m, Math.max(a[1], b[1]) + m, -1 - i); });
  const at = p => grid.get(cellK(Math.floor(p[0] / G), Math.floor(p[1] / G))) || [];
  const hitsLot = p => { for (const i of at(p)) { if (i < 0) continue; const b = lotBox[i]; if (p[0] < b[0] - HALF || p[0] > b[2] + HALF || p[1] < b[1] - HALF || p[1] > b[3] + HALF) continue;
    const L = P.lots[i], c = Math.cos(L.rot || 0), s = Math.sin(L.rot || 0), dx = p[0] - L.x, dz = p[1] - L.z;
    if (Math.abs(dx * c - dz * s) <= L.w / 2 + HALF && Math.abs(dx * s + dz * c) <= L.d / 2 + HALF) return true; } return false; };
  const hitsRoad = (p, skip) => at(p).some(i => { if (i >= 0) return false; const [a, b, hw, rd] = segs[-1 - i]; return !skip.has(rd) && segDist(p, a, b) < hw + HALF - 0.5; });
  const water = p => !!(P.waterAt && P.waterAt(p[0], p[1]));
  // пътят pts (от гарата до целта) е свободен: последните 14 м до целта не се проверяват за улици (там е кръстовището), до 40 м — без своите улици
  const clear = (pts, own) => { const L = cumLen(pts), T = L[L.length - 1];
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], l = L[i] - L[i - 1];
      for (let d = 0; d <= l; d += 3) { const p = [a[0] + (b[0] - a[0]) * d / l, a[1] + (b[1] - a[1]) * d / l], left = T - L[i - 1] - d;
        if (water(p) || hitsLot(p) || (left > 14 && hitsRoad(p, left < 40 ? own : new Set()))) return false; } }
    return true; };
  // целите: възли (1–3 клона, обикновени, без пешеходни/мостови/еднопосочни клонове) и точки по улиците (не мост, не еднопосочна)
  const tNodes = P.nodes.filter(n => n.arms.length >= 1 && n.arms.length <= 3 && n.kind !== 'round' && n.endKind !== 'exit'
    && n.arms.every(a => { const rd = P.roads[a.road]; return !rd.noCars && !(rd.bridge && rd.bridge.length) && !rd.oneway; }))
    .map(n => ({ n, p: [n.x, n.z], own: new Set(n.arms.map(a => P.roads[a.road])) }));
  const tOnRoad = A => { const out = [];
    for (const rd of P.roads) { if (rd.noCars || rd.oneway || (rd.bridge && rd.bridge.length)) continue; const T = rd.L[rd.L.length - 1]; if (T < 50) continue;
      let bst = null; for (let i = 1; i < rd.pts.length; i++) { const a = rd.pts[i - 1], b = rd.pts[i], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((A[0] - a[0]) * dx + (A[1] - a[1]) * dz) / l2));
        const J = [a[0] + dx * t, a[1] + dz * t], sJ = rd.L[i - 1] + Math.sqrt(l2) * t, d = dist(A, J);
        if (sJ >= 22 && sJ <= T - 22 && (!bst || d < bst.d)) bst = { rd, J, sJ, i, d, dir: Math.atan2(dz, dx) }; }
      if (bst && !P.nodes.some(nd => dist([nd.x, nd.z], bst.J) < 26)) out.push(bst); }
    return out; };
  let best = null;
  const zMid = (o.z0 + o.z1) / 2;
  const consider = (path, tgt) => {   // path: от гарата до целта; tgt: { n } или { split }; цената — дължината + отдалечаването от средата на перона
    const len = cumLen(path).at(-1), cost = len + 1.5 * Math.abs(path[0][1] - zMid); if (len > MAXL || len < 18 || (best && cost >= best.cost)) return;
    const prev = path[path.length - 2], T = path[path.length - 1], ang = Math.atan2(prev[1] - T[1], prev[0] - T[0]);   // новият клон — навън от целта
    if (tgt.n && tgt.n.arms.some(a => angDiff(a.angle, ang) < (tgt.n.arms.length >= 2 ? 0.8 : 0.6))) return;
    if (tgt.split && (angDiff(ang, tgt.split.dir) < 0.8 || angDiff(ang, tgt.split.dir + Math.PI) < 0.8)) return;
    if (path.length === 3 && angDiff(Math.atan2(path[1][1] - path[0][1], path[1][0] - path[0][0]), Math.atan2(T[1] - path[1][1], T[0] - path[1][0])) > 1.75) return;   // чупка не по-остра от ~100°
    if (!clear(path, tgt.n ? tgt.own : new Set([tgt.split.rd]))) return;
    best = { path, len, cost, ang, ...tgt };
  };
  const byD = (A, L) => L.map(t => [dist(A, t.p || t.J), t]).filter(x => x[0] <= MAXL).sort((a, b) => a[0] - b[0]).map(x => x[1]);   // най-близките първо — щом има път, по-далечните отпадат веднага
  for (let z = o.z0; z <= o.z1; z += 6) {
    const A = [o.ax ?? o.x + HALF + 1, z];
    for (const t of byD(A, tNodes)) consider([A, t.p], t);
    for (const s of byD(A, tOnRoad(A))) consider([A, s.J], { split: s });
  }
  if (!best) for (let dz = 20; dz <= 260 && !best; dz += 10) for (const sg of o.bendX ? [1] : [1, -1]) {   // с една чупка: покрай линията (по z), после направо; bendX (летището) — първо по x, навън
    const z = sg > 0 ? o.z1 : o.z0, A = [o.ax ?? o.x + HALF + 1, z], C = o.bendX ? [A[0] + o.bendX * dz, z] : [A[0], z + sg * dz];
    if (!clear([A, C], new Set())) continue;
    for (const t of byD(C, tNodes)) consider([A, C, t.p], t);
    for (const s of byD(C, tOnRoad(C))) consider([A, C, s.J], { split: s });
  }
  if (!best) return P;
  // копие: масивите и докоснатите възли/улици/парцели са нови; останалото — общо с кеша (не се променя)
  const Q = { ...P, roads: P.roads.slice(), nodes: P.nodes.slice() };
  let n;
  if (best.split) {   // улицата: от началото до J остава със същия номер, от J до края — нова (в края на масива); парцелите по втората част — към нея
    const { rd: r0, J, sJ, i } = best.split, J0 = { id: Q.nodes.length, x: J[0], z: J[1], arms: [] }; Q.nodes.push(J0);
    const p1 = [...r0.pts.slice(0, i), J], p2 = [J, ...r0.pts.slice(i)];
    const r1 = { ...r0, pts: p1, L: cumLen(p1), to: J0.id, bridge: [], deck: [] }, r2 = { ...r0, id: Q.roads.length, pts: p2, L: cumLen(p2), from: J0.id, bridge: [], deck: [] };
    Q.roads[r0.id] = r1; Q.roads.push(r2);
    const nt = Q.nodes[r0.to]; Q.nodes[nt.id] = { ...nt, arms: nt.arms.map(a => a.road === r0.id && a.end === 1 ? { ...a, road: r2.id } : a) };
    if (Q.rounds) Q.rounds = Q.rounds.map(R0 => R0.node === nt.id ? { ...R0, entries: R0.entries.map(e => e.road === r0.id ? { ...e, road: r2.id } : e) } : R0);
    J0.arms.push({ road: r1.id, end: 1, angle: away(p1, true) }, { road: r2.id, end: 0, angle: away(p2, false) });
    Q.lots = P.lots.map(L => L.front && L.front.road === r0.id && L.front.s > sJ ? { ...L, front: { ...L.front, road: r2.id, s: L.front.s - sJ } } : L);   // номерата на парцелите — същите
    n = J0;
  } else { const n0 = best.n; n = { ...n0, arms: n0.arms.map(a => ({ ...a })) }; Q.nodes[n.id] = n; }
  const A = best.path[0], end = { id: Q.nodes.length, x: A[0], z: A[1], arms: [] }; Q.nodes.push(end);
  const rev = best.path.slice().reverse(), pts = [rev[0]];   // от възела към гарата, на ~5 м
  for (let i = 1; i < rev.length; i++) { const a = rev[i - 1], b = rev[i], k = Math.max(1, Math.ceil(dist(a, b) / 5)); for (let j = 1; j <= k; j++) pts.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]); }
  const rd = { id: Q.roads.length, cls: CL, osmBridge: false, noCars: false, nm: o.nm || 'Гарова', oneway: false, pts, L: cumLen(pts), lanes: K.lanes.slice(), laneW: K.laneW, median: K.median, walk: K.walk, w: W, from: n.id, to: end.id, bridge: [], deck: [], [o.tag || 'station']: true };
  Q.roads.push(rd);
  n.arms.push({ road: rd.id, end: 0, angle: away(pts, false) });
  end.arms.push({ road: rd.id, end: 1, angle: away(pts, true) });
  if (n.endKind) { delete n.endKind; if (Q.turns) Q.turns = Q.turns.filter(t => t.node !== n.id); }   // беше задънен край — вече не е
  nodeKind(Q, n); nodeKind(Q, end); end.endKind = 'dead';
  if (n.arms.length >= 3) { n.outline = n.corners = undefined; nodeShape(Q, n); }
  // паркингът: правоъгълник до първата права на пътя (от гарата), без парцели/улици/вода; най-големият, който се побира
  const B = best.path[1], l1 = dist(A, B), ux = (B[0] - A[0]) / l1, uz = (B[1] - A[1]) / l1;
  let park = null;
  if (!o.noPark) for (const [pw, pd] of o.park || [[32, 22], [26, 17], [20, 13]]) for (const side of [1, -1]) for (const along of [pw / 2 + 4, pw / 2 + 14, pw / 2 + 26]) {
    if (park || along + pw / 2 > l1 - 12) continue;
    const off = W / 2 + K.walk + pd / 2 + 1, cx = A[0] + ux * along - uz * off * side, cz = A[1] + uz * along + ux * off * side, rot = Math.atan2(uz * side, -ux * side);   /* като парцелите в играта: +v — към улицата, w — по пътя */
    const corners = rectCorners(cx, cz, pw / 2, pd / 2, rot), probe = [...corners, [cx, cz]];
    if (probe.some(p => water(p) || segs.some(([a, b, hw]) => segDist(p, a, b) < hw + 1) || P.lots.some((L, i) => inPoly(p, lotPolys[i])))) continue;
    if (P.lots.some((L, i) => lotPolys[i].some(q => inPoly(q, corners)))) continue;
    park = { x: cx, z: cz, w: pw, d: pd, rot, side };
  }
  // иначе — площадът пред гарата: до перона, северно или южно от началото на пътя (входът — откъм пътя)
  if (!park && !o.noPark) for (const [pw, pd] of [[30, 18], [24, 15], [18, 12]]) for (const sg of [-1, 1]) {
    if (park) break;
    const cx = o.x + 1 + pw / 2, cz = A[1] + sg * (W / 2 + K.walk + 1 + pd / 2), rot = sg > 0 ? Math.PI : 0;   /* +v (0, cos rot) — към пътя */
    const corners = rectCorners(cx, cz, pw / 2, pd / 2, rot), probe = [...corners, [cx, cz]];
    if (probe.some(p => water(p) || segs.some(([a, b, hw]) => segDist(p, a, b) < hw + 1) || P.lots.some((L, i) => inPoly(p, lotPolys[i])))) continue;
    if (P.lots.some((L, i) => lotPolys[i].some(q => inPoly(q, corners)))) continue;
    if (cumLen(pts).at(-1) > 0 && pts.some(q => Math.abs(q[0] - cx) < pw / 2 && Math.abs(q[1] - cz) < pd / 2 + HALF - 0.5)) continue;   // не върху самия път (ако завива)
    park = { x: cx, z: cz, w: pw, d: pd, rot, side: 0, fore: true };
  }
  attachPlan2(Q);   // лентите и завоите (lanePath/turnPath) — върху копието, за да виждат новия път
  Q[o.key || 'access'] = { split: !!best.split, bend: best.path.length === 3, road: rd.id, node: n.id, end: end.id, a: A, b: [n.x, n.z], len: Math.round(best.len), park };
  return Q;
}
