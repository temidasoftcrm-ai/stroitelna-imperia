// cityplanroute.js — движение по улиците на плана (cityplan.js): техника, коли и пешеходци.
// Пътна мрежа: точки по оста на всяка улица (през ~4 м) + връзки в кръстовищата; най-къс път (A*).
// Връща точки {x, z, road: true} — същия вид, който game.js ползва за пътищата по мрежата 9×9.
import { pointAt } from './cityplan.js';

const nets = new WeakMap();
function net(P) {
  if (nets.has(P)) return nets.get(P);
  const X = [], Z = [], adj = [], of = [];   // of[улица] = индексите на точките ѝ
  const add = (x, z) => { X.push(x); Z.push(z); adj.push([]); return X.length - 1; };
  const link = (a, b) => { if (a === b) return; const d = Math.hypot(X[a] - X[b], Z[a] - Z[b]); adj[a].push([b, d]); adj[b].push([a, d]); };
  for (const st of P.streets) {
    const L = st.L.at(-1), n = Math.max(1, Math.round(L / 4)), ids = [];
    for (let k = 0; k <= n; k++) { const p = pointAt(st, k / n * L); ids.push(add(p.x, p.z)); if (k) link(ids[k - 1], ids[k]); }
    if (st.closed) link(ids[ids.length - 1], ids[0]);
    of.push(ids);
  }
  // кръстовищата: всяка улица, минаваща през възела, се свързва с него през най-близката си точка
  const sq = P.square, hub = add(sq.x, sq.z);
  P.nodes.forEach((nd, ni) => {
    const v = ni === 0 ? hub : add(nd.x, nd.z), sts = new Set(P.edges.filter(e => e.a === ni || e.b === ni).map(e => e.st));
    for (const s of sts) {
      let best = -1, bd = 1e9;
      for (const i of of[s]) { const d = Math.hypot(X[i] - nd.x, Z[i] - nd.z); if (d < bd) { bd = d; best = i; } }
      if (best >= 0 && bd < 12) link(v, best);
    }
  });
  // пътищата до гарата, летището и магистралата (game.js: P.links) — свързват се за най-близката точка на улиците
  const nStreet = X.length;
  for (const st of P.links || []) {
    const L = st.L.at(-1), n = Math.max(1, Math.round(L / 4)), ids = [];
    for (let k = 0; k <= n; k++) { const p = pointAt(st, k / n * L); ids.push(add(p.x, p.z)); if (k) link(ids[k - 1], ids[k]); }
    let best = -1, bd = 1e18; for (let i = 0; i < nStreet; i++) { const d = (X[i] - X[ids[0]]) ** 2 + (Z[i] - Z[ids[0]]) ** 2; if (d < bd) { bd = d; best = i; } }
    if (best >= 0) link(ids[0], best);
  }
  const N = { X, Z, adj, of, hub, nStreet };
  nets.set(P, N);
  return N;
}
function nearest(N, x, z) {
  let best = 0, bd = 1e18;
  for (let i = 0; i < N.X.length; i++) { const d = (N.X[i] - x) ** 2 + (N.Z[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
  return best;
}
function astar(N, a, b) {
  const g = new Float64Array(N.X.length).fill(Infinity), prev = new Int32Array(N.X.length).fill(-1), h = i => Math.hypot(N.X[i] - N.X[b], N.Z[i] - N.Z[b]);
  const open = [[h(a), a]]; g[a] = 0;
  while (open.length) {
    let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;   // мрежата е малка (~1000 точки)
    const [, u] = open.splice(bi, 1)[0];
    if (u === b) break;
    for (const [v, d] of N.adj[u]) { const ng = g[u] + d; if (ng < g[v]) { g[v] = ng; prev[v] = u; open.push([ng + h(v), v]); } }
  }
  if (a !== b && prev[b] < 0) return [a];
  const out = []; for (let k = b; k !== a; k = prev[k]) out.push(k); out.push(a);
  return out.reverse();
}
// път от (x0,z0) до (x1,z1) по улиците; последната точка е самата цел (road: false), както в sendTo
export function planRoute(P, x0, z0, x1, z1) {
  const N = net(P), ids = astar(N, nearest(N, x0, z0), nearest(N, x1, z1));
  const out = ids.map(i => ({ x: N.X[i], z: N.Z[i], road: true }));
  out.push({ x: x1, z: z1, road: false });
  return out;
}
// случайна точка по улица (кола/пешеходец се появява или тръгва натам)
export function randomRoadPoint(P, rnd = Math.random) {
  const N = net(P), i = (rnd() * (N.nStreet ?? N.X.length)) | 0;   // само по улиците в града
  return { x: N.X[i], z: N.Z[i] };
}
// пътят само по улиците (за колите — без последната точка извън пътя)
export function roadRoute(P, x0, z0, x1, z1) { return planRoute(P, x0, z0, x1, z1).slice(0, -1); }
