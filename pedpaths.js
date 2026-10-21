// pedpaths.js — пешеходците по тротоарите на плана v2 (Лабораторията → ped-paths): тротоар от двете страни на всяка улица (срязан там,
// където го реже и изгледът — ъглите на кръстовището, ръба на кръговото), ъглите свързват тротоарите на съседните клонове по дъгата на
// бордюра, около кръговото — пръстен; улицата се пресича САМО по зебрите (същото правило като cityplan2-3d.js: светофар — всички клонове,
// предимство — второстепенните, кръгово — всеки вход; road-geo — една зебра на къса улица). Пешеходната зона (noCars) — свободно.
// makePedNet(P, { roadGeo }) → { route(x0, z0, x1, z1) → [{ x, z, walk: true, cross? }], nearest(x, z), stats }
// cross: { node, arm, x, z, signal } — преди тази точка пешеходецът чака пролука/зелено (вж. game.js)

const STEP = 4;

// зебрите на плана: { 'node:arm' → разстояние от възела } — правилото на изгледа + (road-geo) свързващи зебри на второстепенните кръстовища,
// колкото да е свързана мрежата на тротоарите (иначе цели квартали остават без пресичане); и изгледът (road-geo) рисува точно тези
const ZC = new WeakMap();
export function crossingsOf(P, o = {}) { const k = !!o.roadGeo; let c = ZC.get(P); if (c && c.k === k) return c.map; makePedNet(P, o); return ZC.get(P).map; }

export function makePedNet(P, o = {}) {
  const RG = !!o.roadGeo, ST = P.STOP || 4.6;
  const X = [], Z = [], adj = [], add = (x, z) => { X.push(x); Z.push(z); adj.push([]); return X.length - 1; };
  const link = (a, b, info = null) => { if (a == null || b == null || a === b) return; const d = Math.hypot(X[a] - X[b], Z[a] - Z[b]); adj[a].push([b, d, info]); adj[b].push([a, d, info && { ...info, rev: true }]); };
  const roundOf = n => n.kind === 'round' ? P.rounds.find(r => r.node === n.id) : null;
  // срезът на тротоара при възела: кръгово — до ръба; кръстовище — срезът на своя ръб (tL/tR, както изгледа); иначе — до края
  const cut = (n, rd, end, sg) => { const R = roundOf(n); if (R) return R.outer + 0.2; if (n.arms.length < 3) return 0; const a = n.arms.find(q => q.road === rd.id && q.end === end); if (!a || a.tL == null) return 0; return (end === 0) === (sg > 0) ? a.tL : a.tR; };
  const ptAt = (rd, s, off) => { const L = rd.L; let i = 1; while (i < L.length - 1 && L[i] < s) i++; const a = rd.pts[i - 1], b = rd.pts[i], t = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [a[0] + (b[0] - a[0]) * t - (b[1] - a[1]) / l * off, a[1] + (b[1] - a[1]) * t + (b[0] - a[0]) / l * off]; };   // off > 0 — същата страна като offLine в изгледа
  // тротоарите: по страни; side[road][sg] = { ids, ss } (точките през ~4 м и разстоянието им по пътя)
  const side = new Map();
  for (const rd of P.roads) {
    const T = rd.L[rd.L.length - 1], nA = P.nodes[rd.from], nB = P.nodes[rd.to];
    for (const sg of [1, -1]) {
      const c0 = cut(nA, rd, 0, sg), c1 = cut(nB, rd, 1, sg); if (T - c0 - c1 < 1) continue;
      const n = Math.max(1, Math.round((T - c0 - c1) / STEP)), ids = [], ss = [];
      for (let k = 0; k <= n; k++) { const s = c0 + (T - c0 - c1) * k / n, p = ptAt(rd, s, sg * (rd.w / 2 + rd.walk / 2)); ids.push(add(p[0], p[1])); ss.push(s); if (k) link(ids[k - 1], ids[k]); }
      side.set(rd.id + ':' + sg, { ids, ss, T });
    }
    if (rd.noCars) { const L = side.get(rd.id + ':1'), Rr = side.get(rd.id + ':-1'); if (L && Rr) for (let k = 0; k < Math.min(L.ids.length, Rr.ids.length); k += 3) link(L.ids[k], Rr.ids[Math.min(Rr.ids.length - 1, k)]); }   // пешеходна зона — навсякъде
  }
  // краят на тротоара на клона a при възела: 'L' — левият спрямо посоката навън по клона, 'R' — десният
  const armSide = (a, lr) => { const sg = (a.end === 0) === (lr === 'L') ? 1 : -1, S = side.get(a.road + ':' + sg); return S ? { S, sg, id: a.end === 0 ? S.ids[0] : S.ids[S.ids.length - 1] } : null; };
  // точката на тротоара на разстояние d от възела по клона
  const sideAt = (a, lr, d) => { const q = armSide(a, lr); if (!q) return null; const { S } = q, s = a.end === 0 ? d : S.T - d; let best = 0, bd = 1e9; S.ss.forEach((v, k) => { const e = Math.abs(v - s); if (e < bd) { bd = e; best = k; } }); return S.ids[best]; };
  // зебрите — същото правило като изгледа (cityplan2-3d.js: zDist / zoneOf / zebraOk)
  const zDist = (n, a) => { const R = roundOf(n); return R ? R.outer + 7.5 : n.arms.length >= 3 && (n.ctrl === 'signal' || (n.ctrl === 'yield' && !a.prio)) ? (a.t || n.r) + 2.3 : 0; };
  const zoneOf = (n, a) => { const R = roundOf(n); return R ? R.outer + 1 : n.arms.length >= 3 ? (a.t || 0) + ST + 0.5 : 0; };
  const zebraOk = (n, a) => { const d = zDist(n, a); if (!d) return false; if (!RG) return true; const rd = P.roads[a.road], T = rd.L[rd.L.length - 1], m = P.nodes[a.end ? rd.from : rd.to], b = m.arms.find(q => q.road === rd.id && q.end !== a.end) || m.arms.find(q => q.road === rd.id); if (!b) return true;
    const dm = zDist(m, b), far = dm ? dm + 1.8 : zoneOf(m, b); if (d + 1.8 + far <= T - 0.5) return true; if (!dm) return false;
    const rank = q => q.kind === 'round' ? 0 : q.ctrl === 'signal' ? 2 : 1; return rank(n) > rank(m) || (rank(n) === rank(m) && n.id < m.id); };
  let nCross = 0; const ZB = new Map();
  // свързващите зебри (road-geo): обединение на компонентите на тротоарите (без зебрите) → зебра на второстепенно кръстовище, ако свързва две
  let uf = null; const find = i => { while (uf[i] !== i) { uf[i] = uf[uf[i]]; i = uf[i]; } return i; }, uni = (a, b) => { a = find(a); b = find(b); if (a !== b) uf[a] = b; };
  const fits = (n, a, d) => { const rd = P.roads[a.road], T = rd.L[rd.L.length - 1], m = P.nodes[a.end ? rd.from : rd.to], b = m.arms.find(q => q.road === rd.id && q.end !== a.end) || m.arms.find(q => q.road === rd.id); if (!b) return true; const dm = zDist(m, b), far = dm ? dm + 1.8 : zoneOf(m, b); return d + 1.8 + far <= T - 0.5; };
  for (const n of P.nodes) {
    const R = roundOf(n);
    if (R) {   // пръстенът-тротоар около кръговото; тротоарите на клоновете — до най-близката му точка
      const ro = R.outer + 1.25, ring = [], gaps = n.arms.map(q => [q.angle, Math.asin(Math.min(0.95, (P.roads[q.road].w / 2 + 0.3) / ro))]);   /* пръстенът е прекъснат там, където клонът влиза — улицата се пресича само по зебрата */
      const open = a => !gaps.some(([c, h]) => Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c))) < h);
      for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 2; ring.push(open(a) ? add(R.x + Math.cos(a) * ro, R.z + Math.sin(a) * ro) : null); }
      for (let k = 0; k < 40; k++) { const a = ring[k], b = ring[(k + 1) % 40]; if (a != null && b != null && open((k + 0.5) / 40 * Math.PI * 2)) link(a, b); }
      const near = id => { let b = null, bd = 1e9; for (const r of ring) { if (r == null) continue; const d = (X[r] - X[id]) ** 2 + (Z[r] - Z[id]) ** 2; if (d < bd) { bd = d; b = r; } } return b; };
      n.arms.forEach((a, i) => { for (const lr of ['L', 'R']) { const q = armSide(a, lr); if (q) link(q.id, near(q.id)); } if (zebraOk(n, a)) ZB.set(n.id + ':' + i, zDist(n, a)); });
      continue;
    }
    if (n.arms.length === 1) { const a = n.arms[0], l = armSide(a, 'L'), r = armSide(a, 'R'); if (l && r) link(l.id, r.id); continue; }   // задънен край — около него
    if (n.arms.length === 2) { const [a, b] = n.arms; for (const [p, q] of [[armSide(a, 'L'), armSide(b, 'R')], [armSide(a, 'R'), armSide(b, 'L')]]) if (p && q) link(p.id, q.id); continue; }   // завой — тротоарът продължава
    // кръстовище: ъглите (левият тротоар на клона a → десният на следващия b) по дъгата на бордюра; зебрите
    for (const c of n.corners || []) {
      const A = n.arms[c.a], B = n.arms[c.b], p = armSide(A, 'L'), q = armSide(B, 'R'); if (!p || !q) continue;
      if (c.c) { const ww = Math.min(P.roads[A.road].walk, P.roads[B.road].walk), dx = c.c[0] - n.x, dz = c.c[1] - n.z, l = Math.hypot(dx, dz) || 1, ctl = [c.c[0] + dx / l * ww * 0.7, c.c[1] + dz / l * ww * 0.7];
        let prev = p.id; for (let k = 1; k < 4; k++) { const t = k / 4, u = 1 - t, x = u * u * X[p.id] + 2 * u * t * ctl[0] + t * t * X[q.id], z = u * u * Z[p.id] + 2 * u * t * ctl[1] + t * t * Z[q.id], id = add(x, z); link(prev, id); prev = id; } link(prev, q.id); }
      else link(p.id, q.id);
    }
    n.arms.forEach((a, i) => { if (zebraOk(n, a)) ZB.set(n.id + ':' + i, zDist(n, a)); });
  }
  // връзките без зебрите → компоненти; зебрите на правилото ги сливат; свързващите — само ако сливат две различни (второстепенните клонове първо)
  uf = new Int32Array(X.length).map((_, i) => i);   /* след всички точки (ъглите, пръстените) */
  for (let i = 0; i < X.length; i++) for (const [v] of adj[i]) uni(i, v);
  const crossAt = (n, i, d) => { const a = n.arms[i], l = sideAt(a, 'L', d), r = sideAt(a, 'R', d); return l != null && r != null ? [l, r] : null; };
  for (const [k, d] of ZB) { const [ni, i] = k.split(':').map(Number), q = crossAt(P.nodes[ni], i, d); if (q) uni(q[0], q[1]); }
  if (RG) { const cand = []; for (const n of P.nodes) { if (n.arms.length < 3 || roundOf(n)) continue; n.arms.forEach((a, i) => { if (!ZB.has(n.id + ':' + i)) cand.push({ n, i, d: (a.t || n.r) + 2.3, minor: a.prio ? 1 : 0 }); }); }
    cand.sort((p, q) => p.minor - q.minor);
    const dbg = P._pedDbg = { cand: cand.length, noSide: 0, same: 0, noFit: 0, added: 0 };
    for (const c of cand) { const q = crossAt(c.n, c.i, c.d); if (!q) { dbg.noSide++; continue; } if (find(q[0]) === find(q[1])) { dbg.same++; continue; } if (!fits(c.n, c.n.arms[c.i], c.d)) { dbg.noFit++; continue; } ZB.set(c.n.id + ':' + c.i, c.d); uni(q[0], q[1]); dbg.added++; } }
  for (const [k, d] of ZB) { const [ni, i] = k.split(':').map(Number), n = P.nodes[ni], q = crossAt(n, i, d); if (!q) continue; link(q[0], q[1], { node: ni, arm: i, x: (X[q[0]] + X[q[1]]) / 2, z: (Z[q[0]] + Z[q[1]]) / 2, signal: n.ctrl === 'signal' }); nCross++; }
  ZC.set(P, { k: RG, map: ZB });
  function nearest(x, z) { let b = 0, bd = 1e18; for (let i = 0; i < X.length; i++) { const d = (X[i] - x) ** 2 + (Z[i] - z) ** 2; if (d < bd) { bd = d; b = i; } } return b; }
  function route(x0, z0, x1, z1) {
    const a = nearest(x0, z0), b = nearest(x1, z1), g = new Float64Array(X.length).fill(Infinity), prev = new Int32Array(X.length).fill(-1), pinfo = new Array(X.length), h = i => Math.hypot(X[i] - X[b], Z[i] - Z[b]);
    const hp = [], push = (f, i) => { hp.push([f, i]); let k = hp.length - 1; while (k) { const q = (k - 1) >> 1; if (hp[q][0] <= hp[k][0]) break; [hp[q], hp[k]] = [hp[k], hp[q]]; k = q; } };
    const pop = () => { const top = hp[0], last = hp.pop(); if (hp.length) { hp[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < hp.length && hp[l][0] < hp[m][0]) m = l; if (r < hp.length && hp[r][0] < hp[m][0]) m = r; if (m === k) break; [hp[m], hp[k]] = [hp[k], hp[m]]; k = m; } } return top; };
    g[a] = 0; push(h(a), a);
    while (hp.length) { const [f, u] = pop(); if (f > g[u] + h(u) + 1e-9) continue; if (u === b) break; for (const [v, d, info] of adj[u]) { const ng = g[u] + d + (info ? 6 : 0); if (ng < g[v]) { g[v] = ng; prev[v] = u; pinfo[v] = info; push(ng + h(v), v); } } }   // зебрата струва малко повече (не се пресича без нужда)
    if (a !== b && prev[b] < 0) return null;   // друг остров на мрежата (няма зебра натам)
    const ids = []; for (let k = b; k !== a; k = prev[k]) ids.push(k); ids.push(a); ids.reverse();
    return ids.map((id, k) => { const nx = ids[k + 1], info = nx != null ? pinfo[nx] : null; return info ? { x: X[id], z: Z[id], walk: true, cross: info } : { x: X[id], z: Z[id], walk: true }; });
  }
  return { route, nearest: (x, z) => { const i = nearest(x, z); return { x: X[i], z: Z[i] }; }, stats: { nodes: X.length, crossings: nCross }, X, Z, adj };
}
