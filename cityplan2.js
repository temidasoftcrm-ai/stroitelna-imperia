// cityplan2.js — план на града v2 (формат: _source/tasks/plan-v2-format.md). Един общ генератор с настройки:
// 4 семейства (eu — европейска, us — американска, coast — крайбрежна, radial — радиална) × 4 размера (s, m, l, xl).
// Ред: граница и вход към града → главни булеварди (скелет) → квартали между тях → второстепенни улици → граф с
// правила (Т и 4-клонни, без 5+, без остри ъгли, без къси връзки и дубли) → кръгови → парцели с лице към улицата.
// Само данни и геометрия (без THREE); един и същ cityId + fam + size + seed + ext → същият план и същите id на парцелите.
// Записът пази само { v: 2, fam, size, seed, ext } — старите градове (план v1, cityplan.js) не се прегенерират.

export const PLAN2_V = 2;
const TAU = Math.PI * 2;
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hashStr(str) { let h = 2166136261; for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// ---- класове пътища: ленти [напред, назад], ширина на лента, разделителна ивица, тротоар
const CLS = {
  blvd: { lanes: [2, 2], laneW: 3.3, median: 3, walk: 3, rank: 4 },
  ring: { lanes: [2, 2], laneW: 3.3, median: 2, walk: 2.5, rank: 3 },
  quay: { lanes: [1, 1], laneW: 3.3, median: 0, walk: 4, rank: 3 },
  street: { lanes: [1, 1], laneW: 3.1, median: 0, walk: 2.5, rank: 1 },
};
const widthOf = c => { const k = CLS[c]; return (k.lanes[0] + k.lanes[1]) * k.laneW + k.median; };
const isMain = c => c === 'blvd' || c === 'ring' || c === 'quay';

// ---- размери: радиус на града, разстояние между улиците в кварталите [успоредни, напречни], брой кръгови
const SIZE = {
  s: { R: 170, a: 64, b: 96, rounds: 0 },
  m: { R: 270, a: 66, b: 104, rounds: 1 },
  l: { R: 390, a: 70, b: 112, rounds: 3 },
  xl: { R: 540, a: 72, b: 118, rounds: 5 },
};
// парцели по зона: [ширина по улицата, дълбочина]
const LOT = { center: [20, 24], business: [26, 28], residential: [16, 20], periphery: [26, 30] };

// ---- геометрия
function catmull(ctrl, step = 4) {   // плавна крива през контролните точки, точки през ~step м
  const P = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]], out = [];
  for (let i = 1; i < P.length - 2; i++) {
    const n = Math.max(1, Math.ceil(dist(P[i], P[i + 1]) / step));
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(P[i - 1][0], P[i][0], P[i + 1][0], P[i + 2][0]), f(P[i - 1][1], P[i][1], P[i + 1][1], P[i + 2][1])]); }
  }
  out.push(ctrl[ctrl.length - 1].slice()); return out;
}
function closedCurve(ctrl, step = 4) {   // затворена крива; последната точка = първата
  const n = ctrl.length, P = [ctrl[n - 1], ...ctrl, ctrl[0], ctrl[1]], out = [];
  for (let i = 1; i <= n; i++) {
    const m = Math.max(1, Math.ceil(dist(P[i], P[i + 1]) / step));
    for (let k = 0; k < m; k++) { const t = k / m, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(P[i - 1][0], P[i][0], P[i + 1][0], P[i + 2][0]), f(P[i - 1][1], P[i][1], P[i + 1][1], P[i + 2][1])]); }
  }
  out.push(out[0].slice()); return out;
}
const cumLen = pts => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + dist(pts[i], pts[i - 1])); return L; };
function resample(pts, step) {
  const L = cumLen(pts), T = L[L.length - 1], n = Math.max(1, Math.round(T / step)), out = [];
  let j = 1;
  for (let k = 0; k <= n; k++) { const s = T * k / n; while (j < L.length - 1 && L[j] < s) j++; const t = (s - L[j - 1]) / ((L[j] - L[j - 1]) || 1); out.push([lerp(pts[j - 1][0], pts[j][0], t), lerp(pts[j - 1][1], pts[j][1], t)]); }
  return out;
}
function segX(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [t, u] : null;
}
function segDist(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}
export function inPoly(p, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > p[1]) !== (zj > p[1]) && p[0] < (xj - xi) * (p[1] - zi) / (zj - zi) + xi) c = !c; }
  return c;
}
export function rectCorners(x, z, hw, hd, rot) {
  const c = Math.cos(rot), s = Math.sin(rot), o = [];
  for (const [u, v] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) o.push([x + u * c + v * s, z - u * s + v * c]);
  return o;
}
function rectsOverlap(a, b, pad = 0) {   // SAT
  const A = rectCorners(a.x, a.z, a.w / 2 + pad, a.d / 2 + pad, a.rot), B = rectCorners(b.x, b.z, b.w / 2, b.d / 2, b.rot);
  for (const P of [A, B]) for (let i = 0; i < 4; i++) {
    const p = P[i], q = P[(i + 1) % 4], nx = q[1] - p[1], nz = p[0] - q[0];
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (const v of A) { const d = v[0] * nx + v[1] * nz; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
    for (const v of B) { const d = v[0] * nx + v[1] * nz; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
    if (a1 < b0 || b1 < a0) return false;
  }
  return true;
}
// мрежа от точки за бързо „най-близко“
function pointGrid(cell) {
  const m = new Map(), k = (x, z) => Math.floor(x / cell) + ',' + Math.floor(z / cell);
  return {
    add(p, v) { const kk = k(p[0], p[1]); (m.get(kk) || m.set(kk, []).get(kk)).push([p, v]); },
    near(p, r, f) { const n = Math.ceil(r / cell), i0 = Math.floor(p[0] / cell), j0 = Math.floor(p[1] / cell); for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (const e of m.get((i0 + i) + ',' + (j0 + j)) || []) if (dist(e[0], p) <= r) f(e[0], e[1]); },
  };
}

// ---- скелет по семейство: граница, вода, главни пътища (линии с клас), центрове на квартали
function skeleton(fam, size, r) {
  const Z = SIZE[size], R = Z.R, rr = (a, b) => lerp(a, b, r()), lines = [], hubs = [{ x: 0, z: 0, main: true }];
  const big = size === 'l' || size === 'xl';
  let bnd = [], waterAt = () => false, coastZ = null;
  const ring = (rad, cls, n = 18, wob = 0.05) => { const ph = rr(0, TAU), c = []; for (let k = 0; k < n; k++) { const a = k / n * TAU; c.push([Math.cos(a) * rad * (1 + wob * Math.sin(3 * a + ph)), Math.sin(a) * rad * (1 + wob * Math.sin(3 * a + ph))]); } lines.push({ cls, pts: closedCurve(c), closed: true }); };
  const radial = (a, r0, r1, cls, bend = 0.06) => { const n = 4, c = []; for (let k = 0; k <= n; k++) { const f = lerp(r0, r1, k / n), b = a + (k && k < n ? rr(-bend, bend) : 0); c.push([Math.cos(b) * f, Math.sin(b) * f]); } lines.push({ cls, pts: catmull(c) }); };
  // граница: леко неправилен кръг (крайбрежният — до брега)
  for (let k = 0; k < 48; k++) { const a = k / 48 * TAU, f = 1 + 0.07 * Math.sin(2 * a + rr(0, 0.3)) + 0.04 * Math.sin(5 * a); bnd.push([Math.cos(a) * R * f, Math.sin(a) * R * f]); }
  const ang0 = rr(0, TAU);
  if (fam === 'eu') {
    const nE = { s: 2, m: 3, l: 4, xl: 5 }[size];
    const angs = Array.from({ length: nE }, (_, i) => ang0 + i * TAU / nE + rr(-0.25, 0.25));
    if (size === 's') { const a = angs[0]; lines.push({ cls: 'blvd', pts: catmull([[Math.cos(a) * R * 1.1, Math.sin(a) * R * 1.1], [Math.cos(a) * R * 0.4 + rr(-15, 15), Math.sin(a) * R * 0.4 + rr(-15, 15)], [rr(-8, 8), rr(-8, 8)], [-Math.cos(a) * R * 0.45, -Math.sin(a) * R * 0.45], [-Math.cos(a) * R * 1.1, -Math.sin(a) * R * 1.1]]) }); }
    else angs.forEach((a, i) => radial(a, i >= 4 ? R * 0.3 : 0, R * 1.1, 'blvd', 0.09));   // до центъра — най-много 4 направления; останалите тръгват от вътрешния пръстен
    if (size === 'm') ring(R * 0.55, 'ring', 16, 0.08);
    if (big) { ring(R * 0.3, 'street', 12, 0.06); ring(R * 0.9, 'ring', 22, 0.05); }
    if (size === 'xl') for (let i = 0; i < 3; i++) { const a = ang0 + (i + 0.5) * TAU / 3, h = { x: Math.cos(a) * R * 0.6, z: Math.sin(a) * R * 0.6 }; hubs.push(h); radial(a + 0.6, R * 0.62, R * 0.6, 'blvd'); }
  } else if (fam === 'radial') {
    const nR = { s: 3, m: 4, l: 6, xl: 8 }[size];
    const rIn = size === 'xl' ? R * 0.28 : R * 0.33;
    for (let i = 0; i < nR; i++) radial(ang0 + i * TAU / nR + rr(-0.12, 0.12), nR > 4 && i % 2 ? rIn : 0, R * 1.1, 'blvd', 0.04);   // до центъра — само основните (≤ 4), другите — от вътрешния пръстен
    if (size === 's') ring(R * 0.5, 'street', 12, 0.04);
    if (size === 'm') ring(R * 0.5, 'ring', 16, 0.04);
    if (size === 'l') { ring(R * 0.33, 'ring', 14, 0.03); ring(R * 0.7, 'street', 20, 0.04); ring(R * 0.93, 'ring', 24, 0.03); }
    if (size === 'xl') { ring(R * 0.28, 'ring', 14, 0.03); ring(R * 0.55, 'ring', 20, 0.03); ring(R * 0.8, 'street', 24, 0.04); ring(R * 0.95, 'ring', 28, 0.03); }
  } else if (fam === 'us') {
    const nB = { s: 0, m: 1, l: 2, xl: 3 }[size], sp = { m: 0, l: 3, xl: 3 }[size] || 0, a = Z.a, b = Z.b;
    lines.push({ cls: 'blvd', pts: resample([[-R * 1.1, 0], [R * 1.1, 0]], 4) });   // главната улица / първият булевард по x
    if (nB >= 1) lines.push({ cls: 'blvd', pts: resample([[0, -R * 1.1], [0, R * 1.1]], 4) });
    if (size === 'l' || size === 'xl') for (const k of [-1, 1]) { lines.push({ cls: 'blvd', pts: resample([[-R * 1.1, k * a * sp], [R * 1.1, k * a * sp]], 4) }); lines.push({ cls: 'blvd', pts: resample([[k * b * sp, -R * 1.1], [k * b * sp, R * 1.1]], 4) }); }
    if (size === 'l' || size === 'xl') { const q = R * 0.93, c = []; for (let k = 0; k < 24; k++) { const t = k / 24 * TAU, s = Math.sign; const x = Math.cos(t), z = Math.sin(t); c.push([s(x) * Math.pow(Math.abs(x), 0.4) * q, s(z) * Math.pow(Math.abs(z), 0.4) * q]); } lines.push({ cls: 'ring', pts: closedCurve(c), closed: true }); }   // периферен скоростен път (заоблен правоъгълник)
    if (size === 'xl') { hubs.push({ x: b * 3, z: a * 3 }, { x: -b * 3, z: -a * 3 }); }
    bnd = []; for (let k = 0; k < 48; k++) { const t = k / 48 * TAU, x = Math.cos(t), z = Math.sin(t), s = Math.sign; bnd.push([s(x) * Math.pow(Math.abs(x), 0.55) * R, s(z) * Math.pow(Math.abs(z), 0.55) * R]); }
  } else if (fam === 'coast') {
    const amp = size === 'xl' ? 0.22 : 0.08, ph = rr(0, TAU), z0 = -R * 0.45;
    coastZ = x => z0 + R * amp * Math.cos(x / R * Math.PI * (size === 'xl' ? 1 : 1.6) + ph) + (size === 'xl' ? R * 0.18 * (1 - Math.cos(x / R * Math.PI)) * 0 : 0);
    if (size === 'xl') coastZ = x => z0 - R * 0.25 + R * 0.35 * Math.cos(x / R * 1.6);   // залив: средата е навътре
    waterAt = (x, z) => z < coastZ(x);
    const off = (d, cls) => { const p = []; for (let x = -R * 1.1; x <= R * 1.1; x += 4) p.push([x, coastZ(x) + d]); lines.push({ cls, pts: p }); };
    off(14, 'quay');
    if (size !== 's') off(R * 0.42, 'blvd');
    if (big) off(R * 0.82, 'ring');
    const nE = { s: 1, m: 2, l: 3, xl: 4 }[size];
    for (let i = 0; i < nE; i++) { const x = lerp(-R * 0.6, R * 0.6, nE === 1 ? 0.5 : i / (nE - 1)) + rr(-20, 20); lines.push({ cls: size === 's' ? 'street' : 'blvd', pts: catmull([[x, coastZ(x) + 14], [x + rr(-25, 25), coastZ(x) + R * 0.5], [x + rr(-30, 30), R * 1.1]]) }); }
    bnd = bnd.map(([x, z]) => [x, Math.max(z, coastZ(x) - 2)]);
    hubs[0] = { x: 0, z: coastZ(0) + R * 0.22, main: true };
    if (size === 'xl') hubs.push({ x: -R * 0.55, z: coastZ(-R * 0.55) + R * 0.2 }, { x: R * 0.55, z: coastZ(R * 0.55) + R * 0.2 });
  }
  return { R, bnd, lines, hubs, waterAt, coastZ };
}

// ---- квартални улици: решетка в рамка (ъгъл), изрязана до района, далеч от главните пътища; краищата — до главния път (Т)
function localStreets(sk, fam, size, r, majorNear) {
  const Z = SIZE[size], R = sk.R, out = [], rr = (a, b) => lerp(a, b, r());
  const C = sk.hubs[0];
  // райони: за радиалния и европейския — клинове по ъгъл между булевардите; за американския — едно; за крайбрежния — ивици по брега
  const regions = [];
  if (fam === 'us') regions.push({ ang: 0, a: Z.a, b: Z.b, ok: () => true, ox: 0, oz: 0 });
  else if (fam === 'coast') { const n = { s: 2, m: 3, l: 4, xl: 6 }[size]; for (let i = 0; i < n; i++) { const x0 = lerp(-R * 1.1, R * 1.1, i / n), x1 = lerp(-R * 1.1, R * 1.1, (i + 1) / n), xm = (x0 + x1) / 2, tz = (sk.coastZ(xm + 5) - sk.coastZ(xm - 5)) / 10; regions.push({ ang: Math.atan(tz), a: Z.a * rr(0.9, 1.1), b: Z.b * rr(0.9, 1.15), ok: p => p[0] >= x0 && p[0] < x1, ox: xm, oz: sk.coastZ(xm) + 14 }); } }
  else {
    const n = { s: 4, m: 6, l: 8, xl: 10 }[size], a0 = r() * TAU;
    for (let i = 0; i < n; i++) { const A0 = a0 + i * TAU / n, A1 = A0 + TAU / n, am = (A0 + A1) / 2;
      const rIn = fam === 'radial' ? R * 0.2 : R * 0.12;
      regions.push({ ang: am + rr(-0.2, 0.2), a: Z.a * rr(0.88, 1.12), b: Z.b * rr(0.9, 1.15), ok: p => { let t = Math.atan2(p[1] - C.z, p[0] - C.x) - A0; t = ((t % TAU) + TAU) % TAU; return t < TAU / n && Math.hypot(p[0] - C.x, p[1] - C.z) > rIn; }, ox: C.x + Math.cos(am) * R * 0.5, oz: C.z + Math.sin(am) * R * 0.5 }); }
  }
  const inside = p => inPoly(p, sk.bnd) && !sk.waterAt(p[0], p[1] - 6);
  const CLEAR = 20;   // до главния път не се стига: краят после се доизтегля до него (Т)
  for (const g of regions) {
    const u = [Math.cos(g.ang), Math.sin(g.ang)], v = [-u[1], u[0]], span = R * 2.4;
    for (const [dir, nrm, sp] of [[u, v, g.a], [v, u, g.b]]) {
      const off0 = rr(0, sp);
      for (let k = -Math.ceil(span / sp); k <= Math.ceil(span / sp); k++) {
        const o = off0 + k * sp, run = [], flush = () => { if (run.length > 1 && dist(run[0], run[run.length - 1]) >= 36) out.push({ cls: 'street', pts: run.slice() }); run.length = 0; };
        for (let s = -span; s <= span; s += 4) {
          const p = [g.ox + nrm[0] * o + dir[0] * s, g.oz + nrm[1] * o + dir[1] * s];
          if (g.ok(p) && inside(p) && majorNear(p, CLEAR) === null) run.push(p); else flush();
        }
        flush();
      }
    }
  }
  return out;
}

// ---- граф: пресичания → възли, ребра между възлите; правила
function buildGraph(lines, opts) {
  const nodes = [], ng = pointGrid(16);
  const nodeAt = (p, rank) => { let best = -1, bd = opts.merge; ng.near(p, opts.merge, (q, i) => { const d = dist(q, p); if (d < bd) { bd = d; best = i; } }); if (best >= 0) { if (rank > nodes[best].rank) { nodes[best].rank = rank; } return best; } nodes.push({ x: p[0], z: p[1], rank }); ng.add(p, nodes.length - 1); return nodes.length - 1; };
  // мрежа от отсечки
  const sg = new Map(), cell = 24, key = (i, j) => i + ',' + j;
  lines.forEach((L, li) => { for (let s = 1; s < L.pts.length; s++) { const a = L.pts[s - 1], b = L.pts[s]; const i0 = Math.floor(Math.min(a[0], b[0]) / cell), i1 = Math.floor(Math.max(a[0], b[0]) / cell), j0 = Math.floor(Math.min(a[1], b[1]) / cell), j1 = Math.floor(Math.max(a[1], b[1]) / cell); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = key(i, j); (sg.get(k) || sg.set(k, []).get(k)).push([li, s]); } } });
  const cuts = lines.map(() => []);
  const seen = new Set();
  for (const arr of sg.values()) for (let x = 0; x < arr.length; x++) for (let y = x + 1; y < arr.length; y++) {
    const [la, sa] = arr[x], [lb, sb] = arr[y]; if (la === lb && Math.abs(sa - sb) < 3) continue;
    const id = la < lb || (la === lb && sa < sb) ? la + ':' + sa + ':' + lb + ':' + sb : lb + ':' + sb + ':' + la + ':' + sa; if (seen.has(id)) continue; seen.add(id);
    const A = lines[la].pts, B = lines[lb].pts, t = segX(A[sa - 1], A[sa], B[sb - 1], B[sb]); if (!t) continue;
    const p = [lerp(A[sa - 1][0], A[sa][0], t[0]), lerp(A[sa - 1][1], A[sa][1], t[0])], rank = Math.max(CLS[lines[la].cls].rank, CLS[lines[lb].cls].rank);
    const n = nodeAt(p, rank); cuts[la].push([sa - 1 + t[0], n]); cuts[lb].push([sb - 1 + t[1], n]);
  }
  const edges = [];
  lines.forEach((L, li) => {
    const c = cuts[li].sort((p, q) => p[0] - q[0]);
    if (!L.closed) { c.unshift([0, nodeAt(L.pts[0], 0)]); c.push([L.pts.length - 1, nodeAt(L.pts[L.pts.length - 1], 0)]); }
    else if (c.length) c.push([c[0][0] + L.pts.length - 1, c[0][1]]);
    const at = f => { const n = L.pts.length - 1, ff = ((f % n) + n) % n, i = Math.min(n - 1, Math.floor(ff)), t = ff - i; return [lerp(L.pts[i][0], L.pts[i + 1][0], t), lerp(L.pts[i][1], L.pts[i + 1][1], t)]; };
    for (let k = 1; k < c.length; k++) {
      const [f0, a] = c[k - 1], [f1, b] = c[k]; if (a === b) continue;
      const pts = [[nodes[a].x, nodes[a].z]]; for (let f = Math.floor(f0) + 1; f < f1; f++) pts.push(at(f)); pts.push([nodes[b].x, nodes[b].z]);
      edges.push({ a, b, cls: L.cls, pts, src: li });
    }
  });
  return { nodes, edges };
}
function edgeLen(e) { let s = 0; for (let i = 1; i < e.pts.length; i++) s += dist(e.pts[i], e.pts[i - 1]); return s; }
function armDir(e, n) {   // посоката на ребро навън от възел n (по първите ~10 м)
  const P = e.a === n ? e.pts : e.pts.slice().reverse(), p0 = P[0]; let q = P[P.length - 1];
  for (const p of P) if (dist(p, p0) >= 10) { q = p; break; }
  return Math.atan2(q[1] - p0[1], q[0] - p0[0]);
}
function applyRules(G, opts) {
  let E = G.edges.filter(e => e.a !== e.b && edgeLen(e) > 0.5);
  const rank = e => CLS[e.cls].rank;
  for (let it = 0; it < 12; it++) {
    let changed = false;
    // дубли (същите два възела) — остава по-важният
    const pair = new Map(); E = E.filter(e => { const k = Math.min(e.a, e.b) + ':' + Math.max(e.a, e.b), o = pair.get(k); if (!o) { pair.set(k, e); return true; } if (rank(e) > rank(o) || (rank(e) === rank(o) && edgeLen(e) < edgeLen(o))) { o.dead = 1; pair.set(k, e); return true; } changed = true; return false; }).filter(e => !e.dead);
    const inc = G.nodes.map(() => []); E.forEach(e => { inc[e.a].push(e); inc[e.b].push(e); });
    const kill = new Set();
    G.nodes.forEach((n, ni) => {
      const arms = inc[ni].filter(e => !kill.has(e)).map(e => ({ e, a: armDir(e, ni) })).sort((p, q) => p.a - q.a);
      if (arms.length < 2) return;
      // остри ъгли: махни по-маловажния/по-късия (само квартални)
      for (let k = 0; k < arms.length; k++) {
        const A = arms[k], B = arms[(k + 1) % arms.length]; let d = B.a - A.a; if (k === arms.length - 1) d += TAU;
        if (arms.length > 1 && d < opts.minAngle) { const w = rank(A.e) < rank(B.e) || (rank(A.e) === rank(B.e) && edgeLen(A.e) < edgeLen(B.e)) ? A.e : B.e; if (rank(w) <= 1 || (rank(A.e) === rank(B.e) && rank(w) <= 3 && w.cls !== 'blvd')) { if (rank(w) <= 1) { kill.add(w); changed = true; return; } } }
      }
      // 5+ клона
      const live = arms.filter(x => !kill.has(x.e));
      if (live.length >= 5) { const loc = live.filter(x => rank(x.e) <= 1).sort((p, q) => edgeLen(p.e) - edgeLen(q.e)); for (let k = 0; k < live.length - 4 && k < loc.length; k++) kill.add(loc[k].e); changed = true; }
    });
    // къси връзки между кръстовища; къси задънени
    const deg = G.nodes.map(() => 0); E.forEach(e => { if (!kill.has(e)) { deg[e.a]++; deg[e.b]++; } });
    for (const e of E) { if (kill.has(e) || rank(e) > 1) continue; const L = edgeLen(e);
      if (L < opts.minLen && deg[e.a] >= 3 && deg[e.b] >= 3) { kill.add(e); changed = true; }
      else if ((deg[e.a] === 1 || deg[e.b] === 1) && L < opts.minStub) { kill.add(e); changed = true; } }
    E = E.filter(e => !kill.has(e));
    if (!changed) break;
  }
  return E;
}

// ---- основното: plan2(cityId, { fam, size, seed, ext })
const cache = new Map();
export function plan2(cityId, o = {}) {
  const fam = o.fam || 'eu', size = o.size || 'm', seed = o.seed ?? hashStr(cityId), ext = o.ext || 0, key = [cityId, fam, size, seed, ext].join(':');
  if (cache.has(key)) return cache.get(key);
  const t0 = Date.now(), r = rng(hashStr(`plan2:${cityId}:${fam}:${size}:${seed}`));
  const sk = skeleton(fam, size, r);
  // главните пътища: мрежа от точки (за отстоянието на кварталните)
  const mg = pointGrid(24); sk.lines.forEach((L, li) => L.pts.forEach(p => mg.add(p, li)));
  const majorNear = (p, rad) => { let hit = null; mg.near(p, rad + widthOf('blvd') / 2, (q, li) => { if (hit === null && dist(p, q) < rad + widthOf(sk.lines[li].cls) / 2) hit = li; }); return hit; };
  const locals = localStreets(sk, fam, size, r, majorNear);
  // краищата на кварталните — доизтеглени напред до главен път (най-много 40 м); там, където вече има кръстовище на ≤ 26 м — към него
  const junc = pointGrid(16), majors = sk.lines;
  const snapEnd = (run, end) => {
    const P = run.pts, p = end ? P[P.length - 1] : P[0], q = end ? P[P.length - 2] : P[1], l = dist(p, q) || 1, d = [(p[0] - q[0]) / l, (p[1] - q[1]) / l];
    for (let s = 2; s <= 44; s += 2) {
      const x = [p[0] + d[0] * s, p[1] + d[1] * s], li = majorNear(x, 0);
      if (li === null) { if (sk.waterAt(x[0], x[1]) || !inPoly(x, sk.bnd)) return; continue; }
      // точката на оста на главния път
      let best = null, bd = 1e9; for (const m of majors[li].pts) { const dd = dist(m, x); if (dd < bd) { bd = dd; best = m; } }
      let snap = null; junc.near(best, 26, q2 => { if (!snap || dist(q2, best) < dist(snap, best)) snap = q2; });
      const tgt = snap || best; if (!snap) junc.add(best, 1);
      const ext2 = []; const n = Math.max(1, Math.ceil(dist(p, tgt) / 4)); for (let k = 1; k <= n; k++) ext2.push([lerp(p[0], tgt[0], k / n), lerp(p[1], tgt[1], k / n)]);
      if (end) P.push(...ext2); else P.unshift(...ext2.reverse());
      return;
    }
  };
  for (const L of locals) { snapEnd(L, 0); snapEnd(L, 1); }
  const lines = [...sk.lines, ...locals].map(L => ({ ...L, pts: L.pts }));
  // граф и правила
  const G = buildGraph(lines, { merge: 7 });
  let E = applyRules(G, { minAngle: 55 * Math.PI / 180, minLen: 30, minStub: 46 });
  // свързаност: само компонентът на центъра
  const adj = G.nodes.map(() => []); E.forEach(e => { adj[e.a].push(e.b); adj[e.b].push(e.a); });
  let c0 = 0, cd = 1e9; G.nodes.forEach((n, i) => { const d = Math.hypot(n.x - sk.hubs[0].x, n.z - sk.hubs[0].z); if (adj[i].length && d < cd) { cd = d; c0 = i; } });
  const seen = new Set([c0]), q = [c0]; for (let h = 0; h < q.length; h++) for (const n of adj[q[h]]) if (!seen.has(n)) { seen.add(n); q.push(n); }
  E = E.filter(e => seen.has(e.a));
  // възли с 2 клона от един и същи път → чупка: пътищата се сливат в едно ребро между кръстовищата
  const inc = G.nodes.map(() => []); E.forEach(e => { inc[e.a].push(e); inc[e.b].push(e); });
  const used = new Set(), roads = [];
  const isJ = n => inc[n].length !== 2 || inc[n][0].cls !== inc[n][1].cls;
  for (const e0 of E) {
    if (used.has(e0)) continue;
    // тръгни от края, който е кръстовище
    let e = e0, a = e.a; let guard = 0;
    while (!isJ(a) && guard++ < 500) { const o = inc[a].find(x => x !== e); if (!o || o === e0 && guard > 1) break; a = o.a === a ? o.b : o.a; e = o; }
    // e е ребро, a — кръстовище в единия му край; върви натам
    const pts = []; let cur = a, ce = e, first = true; guard = 0;
    while (ce && !used.has(ce) && guard++ < 500) {
      used.add(ce); const P = ce.a === cur ? ce.pts : ce.pts.slice().reverse(); pts.push(...(first ? P : P.slice(1))); first = false;
      cur = ce.a === cur ? ce.b : ce.a; if (isJ(cur)) break; ce = inc[cur].find(x => x !== ce && !used.has(x));
    }
    roads.push({ cls: e.cls, from: a, to: cur, pts });
  }
  // изход: възли (само използваните), пътища с параметри
  const live = new Map(); const nodeOut = [];
  const nid = i => { if (!live.has(i)) { live.set(i, nodeOut.length); nodeOut.push({ id: nodeOut.length, x: G.nodes[i].x, z: G.nodes[i].z, arms: [] }); } return live.get(i); };
  const P = { v: PLAN2_V, cityId, fam, size, seed, ext, drive: o.drive || 'R', center: { x: sk.hubs[0].x, z: sk.hubs[0].z }, R: sk.R, boundary: sk.bnd, waterAt: sk.waterAt, coastZ: sk.coastZ, hubs: sk.hubs,
    roads: [], nodes: nodeOut, rounds: [], lots: [], blocks: [], greens: [], landmarks: [] };
  roads.forEach(rd => {
    const k = CLS[rd.cls], pts = resample(rd.pts, 2), id = P.roads.length, a = nid(rd.from), b = nid(rd.to);
    P.roads.push({ id, cls: rd.cls, pts, L: cumLen(pts), lanes: k.lanes.slice(), laneW: k.laneW, median: k.median, walk: k.walk, w: widthOf(rd.cls), from: a, to: b, bridge: [] });
  });
  for (const rd of P.roads) for (const [n, end] of [[rd.from, 0], [rd.to, 1]]) {
    const pts = end ? rd.pts.slice().reverse() : rd.pts, p0 = pts[0]; let qq = pts[pts.length - 1]; for (const p of pts) if (dist(p, p0) >= 10) { qq = p; break; }
    P.nodes[n].arms.push({ road: rd.id, end, angle: Math.atan2(qq[1] - p0[1], qq[0] - p0[0]) });
  }
  // вид и управление на възлите
  for (const n of P.nodes) {
    const ws = n.arms.map(a => P.roads[a.road]), main = ws.filter(r2 => isMain(r2.cls)).length, deg = n.arms.length;
    n.kind = deg === 1 ? 'end' : deg === 2 ? 'bend' : deg === 3 ? 'T' : 'X';
    n.r = deg >= 3 ? Math.max(...ws.map(r2 => r2.w)) / 2 + 3 : 0;
    n.ctrl = deg < 3 ? 'none' : main >= 2 && deg === 4 ? 'signal' : main ? 'yield' : 'none';
    for (const a of n.arms) a.prio = isMain(P.roads[a.road].cls) ? 1 : 0;
  }
  // кръгови: центърът (ако е кръстовище на главни) + важни 4-клонни на булевардите, раздалечени ≥ 0,45R
  const want = SIZE[size].rounds + (fam === 'eu' || fam === 'radial' ? 1 : 0);
  const cand = P.nodes.filter(n => n.arms.length >= 3 && n.arms.length <= 4 && n.arms.filter(a => isMain(P.roads[a.road].cls)).length >= 2)
    .sort((p, q2) => Math.hypot(p.x - P.center.x, p.z - P.center.z) - Math.hypot(q2.x - P.center.x, q2.z - P.center.z));
  if (fam === 'us') cand.length = Math.min(cand.length, 0);   // американската мрежа — светофари
  for (const n of cand) {
    if (P.rounds.length >= want) break;
    if (P.rounds.some(rd => Math.hypot(rd.x - n.x, rd.z - n.z) < sk.R * 0.45)) continue;
    // ъглите между входовете — поне 60°
    const as = n.arms.map(a => a.angle).sort((p, q2) => p - q2); if (as.some((a, i) => (i ? a - as[i - 1] : a + TAU - as[as.length - 1]) < 1.0)) continue;
    const island = n === cand[0] && (fam === 'eu' || fam === 'radial') ? 14 : 9, outer = island + 7;
    n.kind = 'round'; n.ctrl = 'round'; n.r = outer + 2;
    const ring = []; for (let k = 0; k <= 48; k++) { const a = -k / 48 * TAU; ring.push([n.x + Math.cos(a) * (island + 3.5), n.z + Math.sin(a) * (island + 3.5)]); }   // обратно на часовника отгоре (дясно движение)
    P.rounds.push({ node: n.id, x: n.x, z: n.z, island, outer, lanes: 1, ring, entries: n.arms.map(a => ({ road: a.road, angle: a.angle })) });
    P.greens.push({ kind: 'island', poly: ring.map(([x, z]) => [n.x + (x - n.x) * island / (island + 3.5), n.z + (z - n.z) * island / (island + 3.5)]) });
  }
  // стоп линии и конфликтна зона
  for (const n of P.nodes) {
    if (n.arms.length < 3) continue;
    n.conflict = []; for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; n.conflict.push([n.x + Math.cos(a) * n.r, n.z + Math.sin(a) * n.r]); }
    for (const a of n.arms) { const rd = P.roads[a.road], ux = Math.cos(a.angle), uz = Math.sin(a.angle), sx = n.x + ux * n.r, sz = n.z + uz * n.r, rx = uz, rz = -ux;   // влизащите ленти: вдясно спрямо посоката към възела
      const w0 = rd.median / 2, w1 = rd.median / 2 + rd.lanes[a.end ? 0 : 1] * rd.laneW, sgn = P.drive === 'R' ? 1 : -1;
      a.stop = [[sx + rx * w0 * sgn, sz + rz * w0 * sgn], [sx + rx * w1 * sgn, sz + rz * w1 * sgn]]; }
  }
  placeLots(P, sk, r);
  // помощни
  P.lanePath = (roadId, dir, i) => { const rd = P.roads[roadId], pts = dir > 0 ? rd.pts : rd.pts.slice().reverse(), off = (rd.median / 2 + (i + 0.5) * rd.laneW) * (P.drive === 'R' ? 1 : -1);
    return pts.map((p, k) => { const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)], l = dist(a, b) || 1, tx = (b[0] - a[0]) / l, tz = (b[1] - a[1]) / l; return [p[0] - tz * off, p[1] + tx * off]; }); };
  P.pick = (q2 = {}) => { let best = null, bd = 1e18; for (const L of P.lots) { if (L.reserved || (q2.zone && L.zone !== q2.zone) || (q2.minW && L.w < q2.minW) || (q2.minD && L.d < q2.minD)) continue; if (q2.road === 'main' && !isMain(L.front.cls)) continue; if (q2.road === 'street' && isMain(L.front.cls)) continue; if (q2.free && !q2.free(L)) continue; const d = q2.near ? Math.hypot(L.x - q2.near[0], L.z - q2.near[1]) : L.id; if (d < bd) { bd = d; best = L; } } return best; };
  P.reserve = (id, tag) => { if (P.lots[id]) P.lots[id].reserved = tag; };
  P.unreserve = id => { if (P.lots[id]) P.lots[id].reserved = null; };
  P.stats = { ms: Date.now() - t0, roads: P.roads.length, nodes: P.nodes.length, lots: P.lots.length, rounds: P.rounds.length, bad5: P.nodes.filter(n => n.arms.length >= 5).length, ends: P.nodes.filter(n => n.arms.length === 1).length };
  cache.set(key, P); while (cache.size > 24) cache.delete(cache.keys().next().value);
  return P;
}

// ---- парцели: по двете страни на всеки път, с лице към улицата; без застъпване на пътища, тротоари, вода и други парцели
function placeLots(P, sk, r) {
  const rg = pointGrid(20); P.roads.forEach(rd => rd.pts.forEach(p => rg.add(p, rd.id)));
  const roadIn = (L, pad) => { const cs = rectCorners(L.x, L.z, L.w / 2, L.d / 2, L.rot), probe = [...cs, [L.x, L.z], ...cs.map((c, i) => [(c[0] + cs[(i + 1) % 4][0]) / 2, (c[1] + cs[(i + 1) % 4][1]) / 2])];
    let hit = false; for (const p of probe) rg.near(p, 16, (q, id) => { const rd = P.roads[id]; if (!hit && dist(p, q) < rd.w / 2 + rd.walk + pad) hit = true; });
    if (hit) return true;
    // и точки от пътя в правоъгълника
    rg.near([L.x, L.z], Math.hypot(L.w, L.d) / 2 + 2, (q, id) => { if (hit) return; const rd = P.roads[id], c = Math.cos(L.rot), s = Math.sin(L.rot), dx = q[0] - L.x, dz = q[1] - L.z; if (Math.abs(dx * c - dz * s) < L.w / 2 + rd.w / 2 && Math.abs(dx * s + dz * c) < L.d / 2 + rd.w / 2) hit = true; });
    return hit; };
  const lg = pointGrid(32), lots = [];
  const zoneOf = (x, z, main) => { const d = Math.hypot(x - P.center.x, z - P.center.z) / P.R; const hub = P.hubs.some((h, i) => i && Math.hypot(x - h.x, z - h.z) < P.R * 0.12);
    return d < 0.22 || hub ? 'center' : main && d < 0.6 ? 'business' : d > 0.82 ? 'periphery' : 'residential'; };
  const order = [...P.roads].sort((a, b) => b.w - a.w || a.id - b.id);
  for (const rd of order) {
    const len = rd.L[rd.L.length - 1], nA = P.nodes[rd.from], nB = P.nodes[rd.to];
    const s0 = (nA.r || 0) + 6, s1 = len - (nB.r || 0) - 6;
    for (const side of [1, -1]) {
      for (let s = s0; s < s1;) {
        const at = ss => { let i = 1; while (i < rd.L.length - 1 && rd.L[i] < ss) i++; const a = rd.pts[i - 1], b = rd.pts[i], t = (ss - rd.L[i - 1]) / ((rd.L[i] - rd.L[i - 1]) || 1), l = dist(a, b) || 1; return { x: lerp(a[0], b[0], t), z: lerp(a[1], b[1], t), tx: (b[0] - a[0]) / l, tz: (b[1] - a[1]) / l }; };
        const m0 = at(s), zone = zoneOf(m0.x, m0.z, isMain(rd.cls));
        let placed = false;
        for (const f of [1, 0.8]) {
          const [w, d] = LOT[zone].map(v => v * f); if (s + w > s1) break;
          const m = at(s + w / 2), nx = -m.tz * side, nz = m.tx * side, off = rd.w / 2 + rd.walk + 1.5 + d / 2;
          const L = { x: m.x + nx * off, z: m.z + nz * off, w, d, rot: Math.atan2(-nx, -nz), zone, front: { road: rd.id, s: s + w / 2, side, cls: rd.cls } };
          const cs = rectCorners(L.x, L.z, w / 2, d / 2, L.rot);
          if (!cs.every(p => inPoly(p, P.boundary) && !P.waterAt(p[0], p[1]))) continue;
          if (P.rounds.some(rr2 => Math.hypot(L.x - rr2.x, L.z - rr2.z) < rr2.outer + Math.hypot(w, d) / 2 + 3)) continue;
          if (roadIn(L, 0.5)) continue;
          let clash = false; lg.near([L.x, L.z], 40, (q, o) => { if (!clash && rectsOverlap(o, L, 0.6)) clash = true; }); if (clash) continue;
          lg.add([L.x, L.z], L); lots.push(L); s += w + 1; placed = true; break;
        }
        if (!placed) s += 4;
      }
    }
  }
  const C = P.center;
  lots.sort((a, b) => Math.round(Math.hypot(a.x - C.x, a.z - C.z)) - Math.round(Math.hypot(b.x - C.x, b.z - C.z)) || Math.atan2(a.z - C.z, a.x - C.x) - Math.atan2(b.z - C.z, b.x - C.x));
  lots.forEach((L, i) => { L.id = i; L.poly = rectCorners(L.x, L.z, L.w / 2, L.d / 2, L.rot); L.area = Math.round(L.w * L.d); L.block = null; L.reserved = null; for (const k of ['x', 'z', 'w', 'd', 'rot']) L[k] = Math.round(L[k] * 100) / 100; });
  P.lots = lots;
}

export const FAMILIES = ['eu', 'us', 'coast', 'radial'], SIZES = ['s', 'm', 'l', 'xl'];
